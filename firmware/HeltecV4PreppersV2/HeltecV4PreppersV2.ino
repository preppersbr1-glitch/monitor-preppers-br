// ============================================================
//  PreppersBR V2 — Heltec WiFi LoRa 32 V4.2 / V4.3 (ESP32-S3)
//  GPS: GPIO45=VCC, RX=39, TX=38 (corrigido para V4.3)
//  SX1262 · OLED 128x64 · L76K GNSS · Web AP · BLE · LoRa Mesh AES
// ============================================================

// Versão do firmware mostrada na abertura, na tela HOME e no Serial
#define FW_VERSION "v4"

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <RadioLib.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <nvs_flash.h>
#include <U8g2lib.h>
#include <NimBLEDevice.h>
#include "mbedtls/aes.h"
#include "web_html.h"
// Chave do mesh e senha padrão do WiFi — copie secrets.h.example para secrets.h e preencha.
// secrets.h não vai para o GitHub (repositório público).
#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Falta secrets.h: copie secrets.h.example para secrets.h (mesma pasta) e preencha MESH_PSK e CFG_WPASS_DEF."
#endif

// ── SX1262 ───────────────────────────────────────────────────
#define LORA_CS    8
#define LORA_DIO1  14
#define LORA_RST   12
#define LORA_BUSY  13

// ── OLED ─────────────────────────────────────────────────────
#define OLED_SDA   17
#define OLED_SCL   18
#define OLED_RST   21

// ── Outros ───────────────────────────────────────────────────
#define BTN_PRG    0
#define LED_PIN    35
#define BAT_ADC    1
#define ADC_CTRL   37
#define VEXT_PIN   36   // LOW = liga OLED e outros periféricos
// Bip de mensagem nova: a Heltec V4 NÃO tem buzzer de fábrica. Solde um buzzer de 3,3 V
// (ativo ou passivo) entre o GPIO4 e o GND. Sem buzzer ligado nada acontece; -1 desativa.
#define BUZZER_PIN 4
#define BUZZER_FREQ 2700 // Hz (ressonância da maioria dos buzzers pequenos)

// ── Amplificador de RF (FEM) — Heltec V4 ─────────────────────
// A V4 tem um FEM externo entre o SX1262 e a antena (PA na transmissão, LNA na recepção).
// Sem ligar esses pinos o sinal não é amplificado e o alcance cai muito.
// V4.2 = GC1109 (CPS no GPIO46) · V4.3 = KCT8103L (CTX no GPIO5). Detecção igual à do Meshtastic.
#define FEM_POWER  7    // HIGH = liga o LDO do FEM
#define FEM_CSD    2    // HIGH = chip do FEM ligado (lido como entrada no boot: HIGH = KCT8103L)
#define FEM_GC_CPS 46   // GC1109: HIGH = PA completo na transmissão
#define FEM_KCT_CTX 5   // KCT8103L: LOW = LNA ligado na recepção, HIGH = PA na transmissão

// ── GPS — Heltec V4.3 ────────────────────────────────────────
// GPIO45 = alimentação separada do módulo GPS (LOW=ligado)
// Sem GPIO45 LOW o módulo não tem energia → sempre 0 bytes
// RX=39 TX=38 confirmado por openelab.io e outras fontes do V4
#define GPS_VCC    45   // LOW = alimenta GPS (separado do VEXT!)
#define GPS_RX     39   // MCU UART RX ← GPS TX
#define GPS_TX     38   // MCU UART TX → GPS RX
#define GPS_EN     34   // LOW = GPS ativo (GPS_EN_ACTIVE=LOW)
#define GPS_RESET  42   // pulse LOW para reset
#define GPS_STDBY  40   // HIGH = acordado
#define GPS_PPS    41   // entrada PPS

// ── LoRa config ──────────────────────────────────────────────
#define LORA_FREQ   915.0
#define LORA_BW     125.0
#define LORA_SF     9
#define LORA_CR     7
#define LORA_SYNC   0x12
#define LORA_POWER  20   // dBm no SX1262; o FEM soma ~+8 dB → ~28 dBm na antena (limite ANATEL: 30 dBm)
#define LORA_TCXO   1.8f

// ── Geral ────────────────────────────────────────────────────
#define SOS_INTERVAL  10000UL
#define MAX_NODES     10
#define MAX_MSGS      8
#define MAX_DMS       24
#define MSG_LEN       56
#define DM_LEN        88
#define N_PAGES       7
#define MESH_HOP      3

// ── BLE UUIDs ────────────────────────────────────────────────
#define BLE_SVC  "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_STAT "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_MSGS "beb5483f-36e1-4688-b7f5-ea07361b26a8"
#define BLE_SEND "beb54840-36e1-4688-b7f5-ea07361b26a8"
#define BLE_SOS  "beb54841-36e1-4688-b7f5-ea07361b26a8"
#define BLE_DMS  "beb54842-36e1-4688-b7f5-ea07361b26a8"

// ── AES-128-CTR PSK ──────────────────────────────────────────
// MESH_PSK fica em secrets.h (fora do GitHub). Todas as placas da rede precisam da mesma chave.

// ── Structs ──────────────────────────────────────────────────
struct Node { char id[8]; float lat,lon,alt; bool sos; unsigned long last_ms; };
struct Msg  { char from[8]; char text[MSG_LEN]; bool mine; };
struct DMsg { char peer[8]; char from[8]; char text[DM_LEN]; bool mine; };
struct Cfg  { char callsign[8]; float lora_freq,lora_bw; uint8_t lora_sf;
              uint32_t beacon_s; char wifi_pass[32]; };

// ── Objetos ──────────────────────────────────────────────────
SX1262      radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
// I2C por hardware: o SW_I2C (bit a bit) travava o loop() a cada redesenho da tela
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, OLED_RST, OLED_SCL, OLED_SDA);
WebServer   webServer(80);
DNSServer   dnsServer;
Preferences prefs;

// ── Estado GPS ───────────────────────────────────────────────
bool     g_fix=false;
double   g_lat=0, g_lon=0;
float    g_alt=0;
uint8_t  g_sat=0;
uint32_t g_uart_bytes=0;

// ── Estado LoRa ──────────────────────────────────────────────
bool          l_ok=false;
bool          fem_kct=false;   // true = KCT8103L (V4.3), false = GC1109 (V4.2)
volatile bool l_rxFlag=false;
int           l_tx=0, l_rx=0;
float         l_rssi=0;
unsigned long tx_last=0;

// ── Mesh ─────────────────────────────────────────────────────
Node  nodes[MAX_NODES]; int n_nodes=0;
Msg   msgs[MAX_MSGS];   int n_msgs=0, msg_ver=0;
DMsg  dms[MAX_DMS];     int n_dms=0,  dm_ver=0;

// ── Dedup ────────────────────────────────────────────────────
#define DEDUP_SZ 24
struct DedupE { uint32_t id; uint32_t ms; };
DedupE dedupBuf[DEDUP_SZ];
uint8_t dedupHead=0;

// ── UI ───────────────────────────────────────────────────────
int           page=0;
// Aviso de mensagem nova: tela cheia por alguns segundos + LED + bip
#define NOTIF_MS   6000
unsigned long notif_until=0;
char notif_title[16]="", notif_from[8]="", notif_text[96]="";
int beep_left=0, beep_on_ms=120; unsigned long beep_next=0; bool beep_state=false;
bool          dirty=false;
unsigned long draw_last=0;

// ── SOS / Bat ────────────────────────────────────────────────
bool          sos_on=false;
unsigned long sos_last=0;
float         bat_pct=0;
unsigned long bat_last=0;

// ── Clima ────────────────────────────────────────────────────
float w_temp=0,w_hum=0,w_wind=0;
bool  w_valid=false;

// ── Config ───────────────────────────────────────────────────
Cfg  cfg;
bool cfg_restart=false;
unsigned long cfg_restart_ms=0;
String myid="HELTEC";
char   wifi_ssid[24]="PreppersBR";

// ── BLE ──────────────────────────────────────────────────────
NimBLEServer*         bleServer=nullptr;
NimBLECharacteristic* bleCharStatus=nullptr;
NimBLECharacteristic* bleCharMsgs=nullptr;
NimBLECharacteristic* bleCharSend=nullptr;
NimBLECharacteristic* bleCharSos=nullptr;
NimBLECharacteristic* bleCharDms=nullptr;
bool bleConnected=false;
QueueHandle_t cmdQ=nullptr;   // envios pedidos pelo app (WiFi ou BLE); o loop() transmite pelo rádio
#define CMD_LEN 128
#define BLE_JSON_MAX 500          // limite do ATT: valor de característica BLE tem no máximo 512 bytes
unsigned long ble_notify_last=0;
int  ble_msg_ver=-1;
int  ble_dm_ver=-1;

float phone_lat=0,phone_lon=0;
bool  phone_fix=false;

// ============================================================
// UTILITÁRIOS
// ============================================================
// strncpy que sempre termina a string
static void scopy(char* dst,const char* src,size_t cap){ strncpy(dst,src,cap-1); dst[cap-1]='\0'; }

// Escapa texto para JSON (aspas, barra invertida e caracteres de controle)
String jsonEsc(const char* in){
    String o; o.reserve(strlen(in)+8);
    for(const char* p=in;*p;p++){
        char c=*p;
        if(c=='"'||c=='\\'){ o+='\\'; o+=c; }
        else if((uint8_t)c<0x20){ char b[8]; snprintf(b,sizeof(b),"\\u%04x",c); o+=b; }
        else o+=c;
    }
    return o;
}

// Callsign/ID: 1–7 caracteres A-Z a-z 0-9 _ - (os símbolos [ ] > | quebram o protocolo)
bool validId(const String& s){
    if(s.length()<1||s.length()>7) return false;
    for(size_t i=0;i<s.length();i++){ char c=s[i]; if(!isalnum((unsigned char)c)&&c!='_'&&c!='-') return false; }
    return true;
}

// Texto de mensagem: '|' é separador do protocolo (|H:n) e não pode aparecer no texto
String cleanMsg(String m){ m.trim(); m.replace("|","/"); return m; }

// ── FEM (amplificador) ──
void femInit(){
    pinMode(FEM_POWER,OUTPUT); digitalWrite(FEM_POWER,HIGH); delay(5);
    pinMode(FEM_CSD,INPUT); delay(1);
    fem_kct=(digitalRead(FEM_CSD)==HIGH);
    pinMode(FEM_CSD,OUTPUT); digitalWrite(FEM_CSD,HIGH);
    if(fem_kct){ pinMode(FEM_KCT_CTX,OUTPUT); digitalWrite(FEM_KCT_CTX,LOW); }
    else       { pinMode(FEM_GC_CPS,OUTPUT);  digitalWrite(FEM_GC_CPS,LOW); }
    Serial.printf("[FEM] %s\n",fem_kct?"KCT8103L (V4.3)":"GC1109 (V4.2)");
}
void femTx(){ digitalWrite(fem_kct?FEM_KCT_CTX:FEM_GC_CPS,HIGH); }
void femRx(){ digitalWrite(fem_kct?FEM_KCT_CTX:FEM_GC_CPS,LOW); }

// Transmite com o PA ligado e volta a escutar
void radioSend(uint8_t* buf,size_t len){
    femTx();
    radio.transmit(buf,len);
    femRx();
    l_rxFlag=false;      // o DIO1 também dispara no fim da transmissão: não é pacote recebido
    radio.startReceive();
}

// ============================================================
// CONFIG
// ============================================================
// Faixa suportada pela antena/FEM da V4: 863–928 MHz
bool radioCfgOk(float f,float bw,int sf){
    return f>=863.0f&&f<=928.0f && (bw==62.5f||bw==125.0f||bw==250.0f) && sf>=7&&sf<=12;
}
void loadCfg(){
    prefs.begin("pbr",true);
    prefs.getString("cs",cfg.callsign,sizeof(cfg.callsign));
    if(cfg.callsign[0]) myid=String(cfg.callsign);
    else scopy(cfg.callsign,myid.c_str(),sizeof(cfg.callsign));
    // Antes estes valores eram gravados mas nunca lidos: a config de rádio do app se perdia ao reiniciar
    cfg.lora_freq=prefs.getFloat("freq",LORA_FREQ);
    cfg.lora_bw=prefs.getFloat("bw",LORA_BW);
    cfg.lora_sf=prefs.getUChar("sf",LORA_SF);
    if(!radioCfgOk(cfg.lora_freq,cfg.lora_bw,cfg.lora_sf)){
        cfg.lora_freq=LORA_FREQ; cfg.lora_bw=LORA_BW; cfg.lora_sf=LORA_SF;
    }
    cfg.beacon_s=prefs.getUInt("bsec",10);
    if(cfg.beacon_s<5||cfg.beacon_s>600) cfg.beacon_s=10;
    prefs.getString("wpass",cfg.wifi_pass,sizeof(cfg.wifi_pass));
    if(!cfg.wifi_pass[0]) scopy(cfg.wifi_pass,CFG_WPASS_DEF,sizeof(cfg.wifi_pass));
    prefs.end();
}
void saveCfg(){
    prefs.begin("pbr",false);
    prefs.putString("cs",cfg.callsign);
    prefs.putFloat("freq",cfg.lora_freq);
    prefs.putFloat("bw",cfg.lora_bw);
    prefs.putUChar("sf",cfg.lora_sf);
    prefs.putUInt("bsec",cfg.beacon_s);
    prefs.putString("wpass",cfg.wifi_pass);
    prefs.end();
}

// ============================================================
// BATERIA — confirmado funcionando, não modificar
// ============================================================
void readBat(){
    pinMode(ADC_CTRL,OUTPUT); digitalWrite(ADC_CTRL,HIGH); delay(50);
    analogSetPinAttenuation(BAT_ADC,ADC_2_5db);
    for(int i=0;i<5;i++) analogRead(BAT_ADC);
    long sum=0; for(int i=0;i<16;i++) sum+=analogRead(BAT_ADC);
    int raw=sum/16;
    digitalWrite(ADC_CTRL,LOW);
    float mv=raw*1500.0f/4095.0f;
    float v=mv/1000.0f*4.9f*1.045f;
    float np=constrain((v-3.0f)/1.2f*100.0f,0.0f,100.0f);
    if(abs(np-bat_pct)>=1.0f){ bat_pct=np; dirty=true; }
    else bat_pct=np;
    Serial.printf("[BAT] raw=%d v=%.2f pct=%.0f\n",raw,v,bat_pct);
}

// ============================================================
// CRYPTO AES-128-CTR
// ============================================================
void meshCrypt(const uint8_t* in, uint8_t* out, size_t len, uint32_t pktId){
    uint8_t nonce[16]={0};
    nonce[0]=pktId&0xFF; nonce[1]=(pktId>>8)&0xFF;
    nonce[2]=(pktId>>16)&0xFF; nonce[3]=(pktId>>24)&0xFF;
    mbedtls_aes_context ctx; mbedtls_aes_init(&ctx);
    mbedtls_aes_setkey_enc(&ctx,MESH_PSK,128);
    size_t nc_off=0; uint8_t sb[16]={0},nc[16];
    memcpy(nc,nonce,16);
    mbedtls_aes_crypt_ctr(&ctx,len,&nc_off,nc,sb,in,out);
    mbedtls_aes_free(&ctx);
}
bool dedupSeen(uint32_t id){
    uint32_t now=millis();
    for(int i=0;i<DEDUP_SZ;i++)
        if(dedupBuf[i].id==id && id!=0 && now-dedupBuf[i].ms<600000UL) return true;
    dedupBuf[dedupHead]={id,now}; dedupHead=(dedupHead+1)%DEDUP_SZ;
    return false;
}
void meshTx(const char* pt){
    uint32_t pid=esp_random();
    size_t n=strlen(pt); if(n>115) n=115;
    uint8_t buf[120];
    buf[0]=pid&0xFF; buf[1]=(pid>>8)&0xFF; buf[2]=(pid>>16)&0xFF; buf[3]=(pid>>24)&0xFF;
    meshCrypt((const uint8_t*)pt,buf+4,n,pid);
    dedupSeen(pid);
    radioSend(buf,(size_t)(4+n));
    l_tx++; dirty=true;
    Serial.printf("[LoRa] TX %08X: %s\n",pid,pt);
}

// ============================================================
// GPS
// ============================================================
void gpsSendConfig(){
    // Comandos PCAS — módulo ATGM336H/L76K no heltec_v4
    gpsSerial.write("$PCAS04,7*1E\r\n");                           delay(250);
    gpsSerial.write("$PCAS03,1,0,0,0,1,0,0,0,0,0,,,0,0*02\r\n"); delay(250);
    gpsSerial.write("$PCAS11,3*1E\r\n");                           delay(250);
    Serial.println("[GPS] config PCAS enviada");
}

void gpsDiag(const char* label){
    Serial.printf("[GPS-DIAG] %s — aguardando 4s...\n", label);
    uint32_t n=0, t0=millis();
    uint8_t first[32]; uint8_t fn=0;
    while(millis()-t0<4000){
        if(gpsSerial.available()){
            uint8_t b=gpsSerial.read(); n++;
            if(fn<32) first[fn++]=b;
        }
    }
    Serial.printf("[GPS-DIAG] bytes=%u\n",n);
    if(n>0){
        Serial.print("[GPS-DIAG] ascii: ");
        for(int i=0;i<fn;i++){
            if(first[i]>=32&&first[i]<127) Serial.write(first[i]);
            else Serial.printf("[%02X]",first[i]);
        }
        Serial.println();
        Serial.printf("[GPS-DIAG] NMEA=$: %s\n", first[0]=='$'?"SIM":"NAO");
    }
    g_uart_bytes += n;
}

void gpsBegin(){
    // ── Sequência GPS V4.3 ─────────────────────────────────
    // 1. UART PRIMEIRO (antes dos GPIO — ordem do Meshtastic)
    gpsSerial.setRxBufferSize(512);
    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
    Serial.printf("[GPS] UART1 RX=%d TX=%d\n", GPS_RX, GPS_TX);

    // 2. RESET deassertado
    pinMode(GPS_RESET, OUTPUT); digitalWrite(GPS_RESET, HIGH);

    // 3. PPS como entrada
    pinMode(GPS_PPS, INPUT);

    // 4. EN ativo-LOW = ligar GPS
    pinMode(GPS_EN, OUTPUT); digitalWrite(GPS_EN, LOW);

    // 5. STDBY: HIGH = acordado (STANDBY_ACTIVE=LOW → awake=HIGH)
    pinMode(GPS_STDBY, OUTPUT); digitalWrite(GPS_STDBY, HIGH);

    Serial.println("[GPS] GPIO config feita, aguardando 1000ms...");
    delay(1000);

    // Diagnóstico com pinos atuais
    gpsDiag("RX=39 TX=38 (V4.3)");

    // 6. Config PCAS
    gpsSendConfig();

    // Segundo diagnóstico após config
    gpsDiag("pos-PCAS");
}

void gpsUpdate(){
    bool old_fix=g_fix; uint8_t old_sat=g_sat;
    static uint32_t last_byte_ms=0, last_cfg_ms=0;
    while(gpsSerial.available()){
        uint8_t c=(uint8_t)gpsSerial.read();
        gps.encode((char)c);
        g_uart_bytes++; last_byte_ms=millis();
    }
    uint32_t now=millis();
    // Watchdog: reenviar config se parou de receber
    if(now>15000 && last_byte_ms>0
       && (now-last_byte_ms)>30000 && (now-last_cfg_ms)>35000){
        Serial.println("[GPS] watchdog reconfig");
        last_cfg_ms=now; gpsSendConfig();
    }
    if(gps.location.isValid() && gps.location.age()<2000){
        g_fix=true; g_lat=gps.location.lat(); g_lon=gps.location.lng();
        g_alt=gps.altitude.isValid()?gps.altitude.meters():0;
        g_sat=gps.satellites.isValid()?gps.satellites.value():0;
    } else { g_fix=false; }
    if(g_fix!=old_fix || g_sat!=old_sat) dirty=true;
}

// ============================================================
// LORA
// ============================================================
void IRAM_ATTR loraISR(){ l_rxFlag=true; }

// Encontra o nó pelo ID; se não existir, usa uma vaga livre ou substitui o nó sem contato há mais tempo
// (antes, com 10 nós conhecidos, nenhum nó novo aparecia mais)
int nodeSlot(const String& id){
    for(int i=0;i<n_nodes;i++) if(id==nodes[i].id) return i;
    int idx;
    if(n_nodes<MAX_NODES) idx=n_nodes++;
    else { idx=0; for(int i=1;i<n_nodes;i++) if(nodes[i].last_ms<nodes[idx].last_ms) idx=i; }
    memset(&nodes[idx],0,sizeof(Node));
    scopy(nodes[idx].id,id.c_str(),sizeof(nodes[idx].id));
    return idx;
}

// Mostra o aviso em tela cheia, pisca o LED e bipa (beeps vezes, on_ms cada). Não bloqueia:
// o bip é tocado por beepUpdate() no loop.
void newMsgAlert(const char* title,const char* from,const char* text,int beeps,int on_ms){
    scopy(notif_title,title,sizeof(notif_title));
    scopy(notif_from,from,sizeof(notif_from));
    scopy(notif_text,text,sizeof(notif_text));
    notif_until=millis()+NOTIF_MS;
    beep_left=beeps*2; beep_on_ms=on_ms; beep_next=millis(); beep_state=false;
    dirty=true;
}
void beepOut(bool on){
    digitalWrite(LED_PIN,on?HIGH:LOW);
#if BUZZER_PIN >= 0
    ledcWriteTone(BUZZER_PIN,on?BUZZER_FREQ:0);
#endif
}
void beepUpdate(){
    if(beep_left<=0||(long)(millis()-beep_next)<0) return;
    beep_state=!beep_state; beepOut(beep_state); beep_left--;
    beep_next=millis()+(beep_state?beep_on_ms:120);
    if(beep_left<=0&&beep_state){ beepOut(false); beep_state=false; }
}
void loraParse(String &raw){
    if(raw.length()<4 || raw.charAt(1)!='[') return;
    int ei=raw.indexOf(']'); if(ei<0) return;
    int hi=raw.lastIndexOf("|H:"); if(hi>0) raw=raw.substring(0,hi);
    String sid=raw.substring(2,ei);
    if(raw.charAt(0)!='D' && sid.length()>7) sid=sid.substring(0,7);
    String pay=raw.substring(ei+1);
    char type=raw.charAt(0);

    // ── Mensagem direta D[FROM>TO]texto — parsear antes do bloco genérico
    // para evitar escrever "FROM>TO" no campo id[8] do nó
    if(type=='D'){
        int gi=sid.indexOf('>');
        if(gi<0) return;
        String dm_from=sid.substring(0,gi).substring(0,7);
        String dm_to  =sid.substring(gi+1).substring(0,7);
        if(dm_from==String(cfg.callsign)) return; // eco do próprio envio
        // Registrar remetente na lista de nós com ID correto
        int idx=nodeSlot(dm_from);
        if(idx>=0){ nodes[idx].last_ms=millis(); dirty=true; }
        // Só armazenar se o destinatário sou eu
        if(dm_to==String(cfg.callsign)){
            if(n_dms>=MAX_DMS){ memmove(dms,dms+1,sizeof(DMsg)*(MAX_DMS-1)); n_dms=MAX_DMS-1; }
            scopy(dms[n_dms].peer,dm_from.c_str(),sizeof(dms[n_dms].peer));
            scopy(dms[n_dms].from,dm_from.c_str(),sizeof(dms[n_dms].from));
            scopy(dms[n_dms].text,pay.c_str(),DM_LEN);
            dms[n_dms].mine=false; n_dms++; dm_ver++; page=4; dirty=true;
            newMsgAlert("MSG PRIVADA",dm_from.c_str(),pay.c_str(),2,120);
            Serial.printf("[DM] de %s: %s\n",dm_from.c_str(),pay.c_str());
        }
        return; // DMs não entram no bloco genérico abaixo
    }

    // ── Broadcast / Chat / SOS ────────────────────────────────
    if(sid==String(cfg.callsign)) return;
    int idx=nodeSlot(sid);
    if(idx<0) return;
    nodes[idx].last_ms=millis(); dirty=true;
    if(type=='B'){
        float la,lo,al,sp; int sa,ba;
        if(sscanf(pay.c_str(),"%f,%f,%f,%f,%d,%d",&la,&lo,&al,&sp,&sa,&ba)>=2){
            nodes[idx].lat=la; nodes[idx].lon=lo; nodes[idx].alt=al;
        }
        nodes[idx].sos=false;
    } else if(type=='C'){
        if(n_msgs>=MAX_MSGS){ memmove(msgs,msgs+1,sizeof(Msg)*(MAX_MSGS-1)); n_msgs=MAX_MSGS-1; }
        scopy(msgs[n_msgs].from,sid.c_str(),sizeof(msgs[n_msgs].from));
        scopy(msgs[n_msgs].text,pay.c_str(),MSG_LEN);
        msgs[n_msgs].mine=false; n_msgs++; msg_ver++; page=3; dirty=true;
        newMsgAlert("NOVA MENSAGEM",sid.c_str(),pay.c_str(),1,150);
    } else if(type=='S'){
        float la,lo;
        if(sscanf(pay.c_str(),"%f,%f",&la,&lo)>=2){ nodes[idx].lat=la; nodes[idx].lon=lo; }
        nodes[idx].sos=true;
        if(n_msgs>=MAX_MSGS){ memmove(msgs,msgs+1,sizeof(Msg)*(MAX_MSGS-1)); n_msgs=MAX_MSGS-1; }
        scopy(msgs[n_msgs].from,sid.c_str(),sizeof(msgs[n_msgs].from));
        snprintf(msgs[n_msgs].text,MSG_LEN,"!SOS! %s",sid.c_str());
        msgs[n_msgs].mine=false; n_msgs++; msg_ver++; page=3; dirty=true;
        newMsgAlert("!!  SOS  !!",sid.c_str(),"Pedido de socorro na rede",5,350);
    }
}

void loraRX(){
    if(!l_rxFlag) return; l_rxFlag=false;
    size_t rxLen=radio.getPacketLength();
    if(rxLen<5||rxLen>120){ radio.startReceive(); return; }
    uint8_t rxBuf[120]={0};
    if(radio.readData(rxBuf,rxLen)!=RADIOLIB_ERR_NONE){ radio.startReceive(); return; }
    l_rssi=radio.getRSSI();
    uint32_t pid=(uint32_t)rxBuf[0]|((uint32_t)rxBuf[1]<<8)|
                 ((uint32_t)rxBuf[2]<<16)|((uint32_t)rxBuf[3]<<24);
    if(dedupSeen(pid)){ radio.startReceive(); return; }
    size_t encLen=rxLen-4;
    uint8_t plain[116]={0};
    meshCrypt(rxBuf+4,plain,encLen,pid);
    plain[encLen]='\0';
    String s=String((char*)plain);
    l_rx++;
    Serial.printf("[LoRa] RX %08X RSSI=%.0f: %s\n",pid,l_rssi,s.c_str());
    int hi=s.lastIndexOf("|H:"); int hop=0;
    if(hi>=0){ hop=s.substring(hi+3).toInt(); }
    loraParse(s);
    if(hop>0){
        int si=s.lastIndexOf("|H:");
        String base=(si>=0)?s.substring(0,si):s;
        String relay=base+"|H:"+String(hop-1);
        size_t rn=relay.length(); if(rn>115) rn=115;
        uint8_t rb[120];
        rb[0]=pid&0xFF; rb[1]=(pid>>8)&0xFF; rb[2]=(pid>>16)&0xFF; rb[3]=(pid>>24)&0xFF;
        meshCrypt((const uint8_t*)relay.c_str(),rb+4,rn,pid);
        delay(random(10,80));
        radioSend(rb,(size_t)(4+rn));
        Serial.printf("[LoRa] RELAY hop=%d\n",hop-1);
        return;
    }
    radio.startReceive();
}

void loraTxBeacon(){
    char buf[100];
    if(g_fix) snprintf(buf,sizeof(buf),"B[%s]%.5f,%.5f,%.0f,0,%d,%.0f|H:%d",
        cfg.callsign,g_lat,g_lon,g_alt,g_sat,(double)bat_pct,MESH_HOP);
    else snprintf(buf,sizeof(buf),"B[%s]0,0,0,0,0,%.0f|H:%d",
        cfg.callsign,(double)bat_pct,MESH_HOP);
    meshTx(buf);
}
void loraTxChat(const char* msg){
    char buf[MSG_LEN+24];
    snprintf(buf,sizeof(buf),"C[%s]%s|H:%d",cfg.callsign,msg,MESH_HOP);
    meshTx(buf);
    if(n_msgs>=MAX_MSGS){ memmove(msgs,msgs+1,sizeof(Msg)*(MAX_MSGS-1)); n_msgs=MAX_MSGS-1; }
    scopy(msgs[n_msgs].from,cfg.callsign,sizeof(msgs[n_msgs].from));
    scopy(msgs[n_msgs].text,msg,MSG_LEN);
    msgs[n_msgs].mine=true; n_msgs++; msg_ver++; dirty=true;
}
void loraTxSOS(){
    char buf[80];
    if(g_fix) snprintf(buf,sizeof(buf),"S[%s]%.5f,%.5f|H:%d",
        cfg.callsign,g_lat,g_lon,MESH_HOP);
    else snprintf(buf,sizeof(buf),"S[%s]0,0|H:%d",cfg.callsign,MESH_HOP);
    meshTx(buf);
}
void loraTxDM(const char* to, const char* msg){
    // Formato: D[FROM>TO]texto|H:N — só TO exibe, todos repetem
    char buf[120];
    snprintf(buf,sizeof(buf),"D[%s>%s]%s|H:%d",cfg.callsign,to,msg,MESH_HOP);
    meshTx(buf);
    // Salva cópia local
    if(n_dms>=MAX_DMS){ memmove(dms,dms+1,sizeof(DMsg)*(MAX_DMS-1)); n_dms=MAX_DMS-1; }
    scopy(dms[n_dms].peer,to,sizeof(dms[n_dms].peer));
    scopy(dms[n_dms].from,cfg.callsign,sizeof(dms[n_dms].from));
    scopy(dms[n_dms].text,msg,DM_LEN);
    dms[n_dms].mine=true; n_dms++; dm_ver++;
}

// ============================================================
// OLED
// ============================================================
// Páginas: 0=HOME 1=GPS 2=LORA 3=CHAT 4=DM 5=CFG 6=SOS
static const char* PAGE_NAMES[]={"HOME","GPS","LORA","CHAT","DM","CFG","SOS"};
void drawStatusBar(){
    u8g2.setFont(u8g2_font_4x6_tr);
    u8g2.setCursor(0,6);  u8g2.print(g_fix?"GPS:OK":"GPS:--");
    u8g2.setCursor(40,6); u8g2.printf("LR:%s",l_ok?"OK":"--");
    u8g2.setCursor(80,6); u8g2.printf("BAT:%.0f%%",bat_pct);
    u8g2.drawHLine(0,7,128);
}
void drawNavBar(){
    u8g2.drawHLine(0,56,128); u8g2.setFont(u8g2_font_4x6_tr);
    int w=128/N_PAGES;
    for(int i=0;i<N_PAGES;i++){
        int x=i*w;
        if(i==page){ u8g2.drawBox(x,57,w,7); u8g2.setDrawColor(0);
            u8g2.setCursor(x+1,63); u8g2.print(PAGE_NAMES[i]); u8g2.setDrawColor(1);
        } else { u8g2.setCursor(x+1,63); u8g2.print(PAGE_NAMES[i]); }
    }
}
void drawHome(){
    u8g2.setFont(u8g2_font_7x13B_tr); u8g2.setCursor(0,20);
    u8g2.printf("ID: %s",cfg.callsign);
    u8g2.setFont(u8g2_font_6x10_tr);
    u8g2.setCursor(0,32); u8g2.printf("Nos: %d",n_nodes);
    u8g2.setCursor(0,42); u8g2.printf("TX:%d  RX:%d",l_tx,l_rx);
    if(l_rx>0){ u8g2.setCursor(0,52); u8g2.printf("RSSI:%.0fdBm",l_rssi); }
    u8g2.setFont(u8g2_font_4x6_tr); u8g2.setCursor(128-u8g2.getStrWidth(FW_VERSION),52); u8g2.print(FW_VERSION);
    if(g_fix && gps.time.isValid()){
        u8g2.setFont(u8g2_font_4x6_tr); u8g2.setCursor(80,20);
        u8g2.printf("%02d:%02d",gps.time.hour(),gps.time.minute());
    }
}
void drawGPS(){
    u8g2.setFont(u8g2_font_6x10_tr);
    if(!g_fix){
        u8g2.setCursor(0,18); u8g2.print("Buscando sinal...");
        u8g2.setCursor(0,30); u8g2.printf("Sats: %d",g_sat);
        u8g2.setCursor(0,42); u8g2.printf("UART:%lu bytes",g_uart_bytes);
        return;
    }
    u8g2.setCursor(0,18); u8g2.printf("LAT: %.5f",g_lat);
    u8g2.setCursor(0,28); u8g2.printf("LON: %.5f",g_lon);
    u8g2.setCursor(0,38); u8g2.printf("ALT: %.0fm",g_alt);
    u8g2.setCursor(0,48); u8g2.printf("SAT: %d",g_sat);
}
void drawLoRa(){
    u8g2.setFont(u8g2_font_6x10_tr);
    u8g2.setCursor(0,18); u8g2.printf("%.1f MHz",cfg.lora_freq);
    u8g2.setCursor(0,28); u8g2.printf("SF%d  BW%.0fkHz",cfg.lora_sf,cfg.lora_bw);
    u8g2.setCursor(0,38); u8g2.printf("TX:%d  RX:%d",l_tx,l_rx);
    if(l_rx>0){ u8g2.setCursor(0,48); u8g2.printf("RSSI:%.0fdBm",l_rssi); }
}
void drawChat(){
    u8g2.setFont(u8g2_font_5x7_tr);
    int s=max(0,n_msgs-6); int y=16;
    for(int i=s;i<n_msgs;i++){
        char line[28]; snprintf(line,sizeof(line),"%s:%s",msgs[i].from,msgs[i].text);
        u8g2.setCursor(0,y); u8g2.print(line); y+=8;
    }
    if(!n_msgs){ u8g2.setCursor(10,32); u8g2.print("Sem mensagens."); }
}
void drawDM(){
    u8g2.setFont(u8g2_font_4x6_tr);
    u8g2.setCursor(0,14);
    if(n_dms==0){
        u8g2.setFont(u8g2_font_5x7_tr);
        u8g2.setCursor(5,30); u8g2.print("Sem msgs privadas");
        u8g2.setCursor(5,42); u8g2.print("Aguardando DMs...");
        return;
    }
    // Mostra os últimos 5 DMs (from → texto truncado)
    int start=max(0,n_dms-5); int y=14;
    for(int i=start;i<n_dms;i++){
        char line[26];
        if(dms[i].mine)
            snprintf(line,sizeof(line),">>%s:%.16s",dms[i].peer,dms[i].text);
        else
            snprintf(line,sizeof(line),"<<%s:%.16s",dms[i].from,dms[i].text);
        u8g2.setCursor(0,y); u8g2.print(line); y+=9;
    }
}
void drawConfig(){
    u8g2.setFont(u8g2_font_4x6_tr);
    u8g2.setCursor(0,14); u8g2.printf("ID: %s",cfg.callsign);
    u8g2.setCursor(0,22); u8g2.printf("Freq: %.1f MHz",cfg.lora_freq);
    u8g2.setCursor(0,30); u8g2.printf("SF:%d  BW:%.0f kHz",cfg.lora_sf,cfg.lora_bw);
    u8g2.setCursor(0,38); u8g2.printf("Beacon: %d s",cfg.beacon_s);
    u8g2.setCursor(0,46); u8g2.printf("WiFi: %s",wifi_ssid);
    u8g2.setCursor(0,54); u8g2.print("Alterar via app web");
}
void drawSOS(){
    u8g2.setFont(u8g2_font_7x13B_tr);
    if(sos_on){
        if((millis()/500)%2==0){ u8g2.setCursor(30,28); u8g2.print("! SOS !"); }
        u8g2.setFont(u8g2_font_5x7_tr);
        u8g2.setCursor(10,42); u8g2.print("Hold 2s p/ cancelar");
    } else {
        u8g2.setCursor(8,28); u8g2.print("SEM SOS ATIVO");
        u8g2.setFont(u8g2_font_5x7_tr);
        u8g2.setCursor(5,42); u8g2.print("Hold 2s p/ ativar SOS");
    }
}
void drawNotif(){
    u8g2.clearBuffer();
    u8g2.setDrawColor(1); u8g2.drawBox(0,0,128,15);
    u8g2.setDrawColor(0); u8g2.setFont(u8g2_font_7x13B_tr);
    u8g2.setCursor((128-u8g2.getStrWidth(notif_title))/2,12); u8g2.print(notif_title);
    u8g2.setDrawColor(1); u8g2.setFont(u8g2_font_6x10_tr);
    u8g2.setCursor(0,26); u8g2.print("de: "); u8g2.print(notif_from);
    // texto quebrado em até 3 linhas de 25 caracteres
    u8g2.setFont(u8g2_font_5x7_tr);
    int len=strlen(notif_text);
    for(int l=0;l<3&&l*25<len;l++){
        char ln[26]; scopy(ln,notif_text+l*25,sizeof(ln));
        u8g2.setCursor(0,37+l*9); u8g2.print(ln);
    }
    u8g2.setFont(u8g2_font_4x6_tr); u8g2.setCursor(22,63); u8g2.print("PRG: fechar aviso");
    u8g2.sendBuffer();
}
void updateDisplay(){
    if(notif_until){ drawNotif(); return; }
    u8g2.clearBuffer(); drawStatusBar();
    switch(page){
        case 0: drawHome();   break;
        case 1: drawGPS();    break;
        case 2: drawLoRa();   break;
        case 3: drawChat();   break;
        case 4: drawDM();     break;
        case 5: drawConfig(); break;
        case 6: drawSOS();    break;
    }
    drawNavBar(); u8g2.sendBuffer();
}

// ============================================================
// WEB
// ============================================================
void webHandleRoot(){ webServer.sendHeader("Cache-Control","no-store"); webServer.send_P(200,"text/html",WEB_HTML); }
void webHandleData(){
    char tbuf[6]="--:--";
    if(g_fix && gps.time.isValid()) snprintf(tbuf,6,"%02d:%02d",gps.time.hour(),gps.time.minute());
    String nl="[";
    for(int i=0;i<n_nodes;i++){
        if(i) nl+=",";
        char nb[128];
        snprintf(nb,sizeof(nb),"{\"id\":\"%s\",\"lat\":%.6f,\"lon\":%.6f,\"alt\":%.1f,\"sos\":%s}",
            jsonEsc(nodes[i].id).c_str(),(double)nodes[i].lat,(double)nodes[i].lon,(double)nodes[i].alt,nodes[i].sos?"true":"false");
        nl+=nb;
    }
    nl+="]";
    String ml="[";
    for(int i=0;i<n_msgs;i++){
        if(i) ml+=",";
        String fr=jsonEsc(msgs[i].from),tx=jsonEsc(msgs[i].text);
        ml+="{\"from\":\""+fr+"\",\"text\":\""+tx+"\",\"mine\":";
        ml+=msgs[i].mine?"true":"false"; ml+="}";
    }
    ml+="]";
    // DMs (mensagens privadas)
    String dl="[";
    for(int i=0;i<n_dms;i++){
        if(i) dl+=",";
        String dp=jsonEsc(dms[i].peer),df=jsonEsc(dms[i].from),dt=jsonEsc(dms[i].text);
        dl+="{\"peer\":\""+dp+"\",\"from\":\""+df+"\",\"text\":\""+dt+"\",\"mine\":";
        dl+=dms[i].mine?"true":"false"; dl+="}";
    }
    dl+="]";
    String j="{";
    j+="\"myid\":\"";  j+=jsonEsc(cfg.callsign); j+="\"";
    j+=",\"fix\":";    j+=(g_fix?"true":"false");
    j+=",\"lat\":";    j+=String(g_lat,6);
    j+=",\"lon\":";    j+=String(g_lon,6);
    j+=",\"alt\":";    j+=String(g_alt,1);
    j+=",\"sat\":";    j+=g_sat;
    j+=",\"lora\":";   j+=(l_ok?"true":"false");
    j+=",\"bat\":";    j+=String(bat_pct,0);
    j+=",\"tx\":";     j+=l_tx;
    j+=",\"rx\":";     j+=l_rx;
    j+=",\"rssi\":";   j+=(int)l_rssi;
    j+=",\"nc\":";     j+=n_nodes;
    j+=",\"nodes\":";  j+=n_nodes;
    j+=",\"mysos\":";  j+=(sos_on?"true":"false");
    j+=",\"mn\":";     j+=msg_ver;
    j+=",\"dmver\":";  j+=dm_ver;
    j+=",\"time\":\""; j+=tbuf; j+="\"";
    j+=",\"nodeList\":"; j+=nl;
    j+=",\"msgs\":";   j+=ml;
    j+=",\"dms\":";    j+=dl;
    if(w_valid){ j+=",\"temp\":"; j+=String(w_temp,1); }
    j+="}";
    webServer.send(200,"application/json",j);
}
void webHandleSos(){
    if(webServer.method()==HTTP_POST){
        String act=webServer.arg("action");
        if(act=="on"&&!sos_on){ sos_on=true; sos_last=millis(); if(l_ok) loraTxSOS(); }
        else if(act=="off"&&sos_on){ sos_on=false; if(l_ok) loraTxBeacon(); }
        dirty=true;
    }
    webServer.send(200,"text/plain",sos_on?"1":"0");
}
void webHandleSend(){
    if(webServer.method()!=HTTP_POST){ webServer.send(405); return; }
    String m=cleanMsg(webServer.arg("m"));
    if(!m.length()){ webServer.send(400,"text/plain","Mensagem vazia"); return; }
    // limite em bytes: acentos ocupam 2 bytes
    if(m.length()>=MSG_LEN){ webServer.send(400,"text/plain","Mensagem longa demais"); return; }
    if(!l_ok){ webServer.send(503,"text/plain","Radio LoRa com erro"); return; }
    if(!queueCmd('M',std::string(m.c_str()))){ webServer.send(503,"text/plain","Fila cheia, tente de novo"); return; }
    webServer.send(200,"text/plain","OK");
}
void webHandleLocation(){
    if(webServer.method()!=HTTP_POST){ webServer.send(405); return; }
    String la=webServer.arg("lat"),lo=webServer.arg("lon");
    if(la.length()&&lo.length()){ phone_lat=la.toDouble(); phone_lon=lo.toDouble(); phone_fix=true; }
    webServer.send(200,"text/plain","OK");
}
void webHandleWeather(){
    if(webServer.method()!=HTTP_POST){ webServer.send(405); return; }
    String ts=webServer.arg("temp"),hs=webServer.arg("hum"),ws=webServer.arg("wind");
    if(ts.length()){ w_temp=ts.toFloat(); w_valid=true; }
    if(hs.length()) w_hum=hs.toFloat();
    if(ws.length()) w_wind=ws.toFloat();
    dirty=true; webServer.send(200,"text/plain","OK");
}
void webHandleGetConfig(){
    String j="{\"callsign\":\""; j+=jsonEsc(cfg.callsign); j+="\"";
    j+=",\"lora_freq\":"; j+=String(cfg.lora_freq,1);
    j+=",\"lora_sf\":";   j+=cfg.lora_sf;
    j+=",\"lora_bw\":";   j+=String(cfg.lora_bw,1);
    j+=",\"beacon_s\":";  j+=cfg.beacon_s;
    j+=",\"wifi_pass\":\""; j+=jsonEsc(cfg.wifi_pass); j+="\"}";
    webServer.send(200,"application/json",j);
}
void webHandleSetConfig(){
    if(webServer.method()!=HTTP_POST){ webServer.send(405); return; }
    String cs=webServer.arg("callsign"),bs=webServer.arg("beacon_s"),wp=webServer.arg("wifi_pass");
    String fs=webServer.arg("lora_freq"),ss=webServer.arg("lora_sf"),bws=webServer.arg("lora_bw");
    cs.trim();
    // valida tudo antes de alterar qualquer valor
    if(!validId(cs)){ webServer.send(400,"text/plain","Call sign: 1-7 letras, numeros, _ ou -"); return; }
    if(!bs.length()||bs.toInt()<5||bs.toInt()>600){ webServer.send(400,"text/plain","Beacon: 5 a 600 s"); return; }
    if(wp.length()<8||wp.length()>31){ webServer.send(400,"text/plain","Senha WiFi: 8 a 31 caracteres"); return; }
    float nf=fs.length()?fs.toFloat():cfg.lora_freq, nbw=bws.length()?bws.toFloat():cfg.lora_bw;
    int nsf=ss.length()?ss.toInt():cfg.lora_sf;
    if(!radioCfgOk(nf,nbw,nsf)){ webServer.send(400,"text/plain","Radio: 863-928 MHz, SF7-12, BW 62.5/125/250"); return; }
    scopy(cfg.callsign,cs.c_str(),sizeof(cfg.callsign));
    cfg.beacon_s=bs.toInt();
    cfg.lora_freq=nf; cfg.lora_sf=nsf; cfg.lora_bw=nbw;
    scopy(cfg.wifi_pass,wp.c_str(),sizeof(cfg.wifi_pass));
    saveCfg(); cfg_restart=true; cfg_restart_ms=millis();
    webServer.send(200,"text/plain","OK");
}
void webHandleSendDM(){
    if(webServer.method()!=HTTP_POST){ webServer.send(405); return; }
    String to=webServer.arg("to"); String m=cleanMsg(webServer.arg("m"));
    to.trim();
    if(!validId(to)){ webServer.send(400,"text/plain","Destinatario invalido"); return; }
    if(!m.length()||m.length()>DM_LEN-1){ webServer.send(400,"text/plain","Mensagem vazia ou longa demais"); return; }
    if(!l_ok){ webServer.send(503,"text/plain","Radio LoRa com erro"); return; }
    String cmd="D["+to+"]"+m;
    if(!queueCmd('M',std::string(cmd.c_str()))){ webServer.send(503,"text/plain","Fila cheia, tente de novo"); return; }
    webServer.send(200,"text/plain","OK");
}
void webHandleRedirect(){ webServer.sendHeader("Location","http://192.168.4.1/",true); webServer.send(302,"text/plain",""); }
void webHandle204(){ webServer.send(204,"text/plain",""); }

// ============================================================
// BLE
// ============================================================
class BLESrvCB : public NimBLEServerCallbacks {
    // ao conectar, força o envio do estado atual (status, mensagens e privadas) no próximo loop()
    void onConnect(NimBLEServer*,NimBLEConnInfo&){ bleConnected=true; ble_msg_ver=-1; ble_dm_ver=-1; ble_notify_last=0; dirty=true; }
    void onDisconnect(NimBLEServer*,NimBLEConnInfo&,int){ bleConnected=false; NimBLEDevice::startAdvertising(); }
};
// Envios entram numa fila e o loop() transmite (processCmds):
// - BLE: os callbacks do NimBLE rodam em outra tarefa e não podem usar o SPI do rádio
// - WiFi: o app recebe a resposta na hora, sem esperar os ~0,5 s da transmissão LoRa
static bool queueCmd(char kind,const std::string& v){
    char b[CMD_LEN]; b[0]=kind; scopy(b+1,v.c_str(),sizeof(b)-1);
    return cmdQ && xQueueSend(cmdQ,b,0)==pdTRUE;
}
class BLESendCB : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* c,NimBLEConnInfo&){ queueCmd('M',c->getValue()); }
};
class BLESosCB : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* c,NimBLEConnInfo&){ queueCmd('S',c->getValue()); }
};
void processCmds(){
    char b[CMD_LEN];
    while(cmdQ && xQueueReceive(cmdQ,b,0)==pdTRUE){
        String v=String(b+1); v.trim();
        if(b[0]=='S'){
            if(v=="1"&&!sos_on){ sos_on=true; sos_last=millis(); if(l_ok) loraTxSOS(); dirty=true; }
            else if(v=="0"&&sos_on){ sos_on=false; if(l_ok) loraTxBeacon(); dirty=true; }
            bleCharSos->setValue(sos_on?"1":"0");
            if(bleConnected) bleCharSos->notify();
            continue;
        }
        if(v.length()<1||!l_ok) continue;
        if(v.startsWith("D[")){                 // mensagem privada: D[DESTINO]texto
            int cb=v.indexOf(']');
            if(cb>2){
                String to=v.substring(2,cb);
                String msg=cleanMsg(v.substring(cb+1));
                if(validId(to)&&msg.length()>0&&(int)msg.length()<DM_LEN)
                    loraTxDM(to.c_str(),msg.c_str());
            }
        } else {
            v=cleanMsg(v);
            if((int)v.length()<MSG_LEN) loraTxChat(v.c_str());
        }
    }
}
static float hav(float lat1,float lon1,float lat2,float lon2){
    float R=6371000.0f;
    float dr=(lat2-lat1)*PI/180.0f, dl=(lon2-lon1)*PI/180.0f;
    float r1=lat1*PI/180.0f, r2=lat2*PI/180.0f;
    float a=sinf(dr/2)*sinf(dr/2)+cosf(r1)*cosf(r2)*sinf(dl/2)*sinf(dl/2);
    return R*2.0f*atan2f(sqrtf(a),sqrtf(1-a));
}
String bleBuildStatus(){
    String j="{\"id\":\""; j+=jsonEsc(cfg.callsign); j+="\"";
    j+=",\"bat\":"; j+=(int)bat_pct;
    j+=",\"fix\":"; j+=(g_fix?"true":"false");
    j+=",\"lat\":"; j+=String(g_lat,5);
    j+=",\"lon\":"; j+=String(g_lon,5);
    j+=",\"alt\":"; j+=String(g_alt,1);
    j+=",\"sat\":"; j+=g_sat;
    j+=",\"rssi\":"; j+=(int)l_rssi;
    j+=",\"tx\":"; j+=l_tx; j+=",\"rx\":"; j+=l_rx;
    j+=",\"sos\":"; j+=(sos_on?"true":"false");
    j+=",\"lora\":"; j+=(l_ok?"true":"false");
    j+=",\"nodes\":"; j+=n_nodes;
    j+=",\"nlist\":[";
    // nós mais recentes primeiro, até caber no limite do BLE
    int order[MAX_NODES]; for(int i=0;i<n_nodes;i++) order[i]=i;
    for(int i=1;i<n_nodes;i++) for(int k=i;k>0&&nodes[order[k]].last_ms>nodes[order[k-1]].last_ms;k--){ int t=order[k]; order[k]=order[k-1]; order[k-1]=t; }
    bool first=true;
    for(int n=0;n<n_nodes;n++){
        int i=order[n];
        String e="{\"id\":\""+jsonEsc(nodes[i].id)+"\"";
        if(nodes[i].lat!=0.0f||nodes[i].lon!=0.0f){
            e+=",\"lat\":"; e+=String(nodes[i].lat,4);
            e+=",\"lon\":"; e+=String(nodes[i].lon,4);
            if(g_fix) { e+=",\"d\":"; e+=(int)hav(g_lat,g_lon,nodes[i].lat,nodes[i].lon); }
        }
        if(nodes[i].sos) e+=",\"sos\":true";
        e+=",\"age\":"; e+=(unsigned long)((millis()-nodes[i].last_ms)/1000); e+="}";
        if(j.length()+e.length()+16>BLE_JSON_MAX) break;
        if(!first) j+=","; j+=e; first=false;
    }
    j+="],\"ble\":true}";
    return j;
}
// Listas para o BLE: do fim para o começo (mais novas), até BLE_JSON_MAX bytes.
// Cada item leva "v" (versão) para o app não duplicar ao juntar com o que já recebeu.
String bleBuildMsgs(){
    String body="";
    for(int i=n_msgs-1;i>=0;i--){
        String e="{\"v\":"+String(msg_ver-(n_msgs-1-i))+",\"from\":\""+jsonEsc(msgs[i].from)+"\",\"text\":\""+jsonEsc(msgs[i].text)+"\",\"mine\":"+(msgs[i].mine?"true":"false")+"}";
        if(body.length()+e.length()+3>BLE_JSON_MAX) break;
        body=body.length()?e+","+body:e;
    }
    return "["+body+"]";
}
String bleBuildDms(){
    String body="";
    for(int i=n_dms-1;i>=0;i--){
        String e="{\"v\":"+String(dm_ver-(n_dms-1-i))+",\"peer\":\""+jsonEsc(dms[i].peer)+"\",\"from\":\""+jsonEsc(dms[i].from)+"\",\"text\":\""+jsonEsc(dms[i].text)+"\",\"mine\":"+(dms[i].mine?"true":"false")+"}";
        if(body.length()+e.length()+3>BLE_JSON_MAX) break;
        body=body.length()?e+","+body:e;
    }
    return "["+body+"]";
}
void bleBegin(){
    cmdQ=xQueueCreate(8,CMD_LEN);
    char nm[24]; snprintf(nm,sizeof(nm),"%s",cfg.callsign[0]?cfg.callsign:"PreppersBR");
    NimBLEDevice::init(nm); NimBLEDevice::setPower(9);
    NimBLEDevice::setMTU(517);   // JSON de status passa de 20 bytes: sem MTU maior a notificação chega cortada
    bleServer=NimBLEDevice::createServer(); bleServer->setCallbacks(new BLESrvCB());
    NimBLEService* svc=bleServer->createService(BLE_SVC);
    bleCharStatus=svc->createCharacteristic(BLE_STAT,NIMBLE_PROPERTY::READ|NIMBLE_PROPERTY::NOTIFY);
    bleCharStatus->setValue(bleBuildStatus().c_str());
    bleCharMsgs=svc->createCharacteristic(BLE_MSGS,NIMBLE_PROPERTY::READ|NIMBLE_PROPERTY::NOTIFY);
    bleCharMsgs->setValue(bleBuildMsgs().c_str());
    bleCharSend=svc->createCharacteristic(BLE_SEND,NIMBLE_PROPERTY::WRITE);
    bleCharSend->setCallbacks(new BLESendCB());
    bleCharSos=svc->createCharacteristic(BLE_SOS,NIMBLE_PROPERTY::READ|NIMBLE_PROPERTY::WRITE|NIMBLE_PROPERTY::NOTIFY);
    bleCharSos->setValue("0"); bleCharSos->setCallbacks(new BLESosCB());
    bleCharDms=svc->createCharacteristic(BLE_DMS,NIMBLE_PROPERTY::READ|NIMBLE_PROPERTY::NOTIFY);
    bleCharDms->setValue(bleBuildDms().c_str());
    svc->start();
    NimBLEAdvertising* adv=NimBLEDevice::getAdvertising();
    adv->addServiceUUID(BLE_SVC);
    // Nome no scan response: UUID 128-bit ocupa os 31 bytes do adv principal,
    // scan response tem espaço próprio garantido para o nome legível.
    NimBLEAdvertisementData sr;
    sr.setName(nm);
    adv->setScanResponseData(sr);
    NimBLEDevice::startAdvertising();
    Serial.printf("[BLE] %s\n",nm);
}
void bleUpdate(){
    if(!bleConnected) return;
    unsigned long now=millis();
    if(now-ble_notify_last>5000||(dirty&&now-ble_notify_last>500)){
        String st=bleBuildStatus(); bleCharStatus->setValue(st.c_str()); bleCharStatus->notify();
        ble_notify_last=now;
    }
    if(msg_ver!=ble_msg_ver){
        ble_msg_ver=msg_ver;
        String ms=bleBuildMsgs(); bleCharMsgs->setValue(ms.c_str()); bleCharMsgs->notify();
    }
    if(dm_ver!=ble_dm_ver){
        ble_dm_ver=dm_ver;
        String ds=bleBuildDms(); bleCharDms->setValue(ds.c_str()); bleCharDms->notify();
    }
}

// ============================================================
// WiFi
// ============================================================
void wifiBegin(){
    snprintf(wifi_ssid,sizeof(wifi_ssid),"PreppersBR-%s",myid.c_str());
    WiFi.softAP(wifi_ssid,cfg.wifi_pass);
    IPAddress apIP=WiFi.softAPIP();
    Serial.printf("[WiFi] SSID:%s  IP:%s\n",wifi_ssid,apIP.toString().c_str());
    dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer.start(53,"*",apIP);
    webServer.on("/",HTTP_GET,webHandleRoot);
    webServer.on("/data",HTTP_GET,webHandleData);
    webServer.on("/sos",HTTP_ANY,webHandleSos);
    webServer.on("/send",HTTP_POST,webHandleSend);
    webServer.on("/location",HTTP_POST,webHandleLocation);
    webServer.on("/weather",HTTP_POST,webHandleWeather);
    webServer.on("/config",HTTP_GET,webHandleGetConfig);
    webServer.on("/config",HTTP_POST,webHandleSetConfig);
    webServer.on("/senddm",HTTP_POST,webHandleSendDM);
    webServer.on("/generate_204",HTTP_GET,webHandle204);
    webServer.on("/gen_204",HTTP_GET,webHandle204);
    auto ok=[](){webServer.send(200,"text/html","<HTML><BODY>Success</BODY></HTML>");};
    webServer.on("/hotspot-detect.html",HTTP_GET,ok);
    webServer.on("/library/test/success.html",HTTP_GET,ok);
    webServer.on("/success.txt",HTTP_GET,[](){ webServer.send(200,"text/plain","success"); });
    webServer.on("/ncsi.txt",HTTP_GET,[](){ webServer.send(200,"text/plain","Microsoft NCSI"); });
    webServer.on("/connecttest.txt",HTTP_GET,[](){ webServer.send(200,"text/plain","Microsoft Connect Test"); });
    webServer.onNotFound(webHandleRedirect);
    webServer.begin();
    if(MDNS.begin("preppersbr")){ MDNS.addService("http","tcp",80); }
}

// ============================================================
// BOTAO
// ============================================================
void handleButton(){
    static bool last=HIGH; static unsigned long pms=0, chg=0;
    bool state=digitalRead(BTN_PRG); unsigned long now=millis();
    if(state!=last && now-chg<30) return;   // debounce: ignora repiques do botão
    if(state!=last) chg=now;
    if(state==LOW&&last==HIGH) pms=now;
    if(state==HIGH&&last==LOW){
        unsigned long held=now-pms;
        if(notif_until&&held<500){ notif_until=0; dirty=true; }   // toque curto só fecha o aviso
        else if(held>2000&&page==6){ sos_on=!sos_on; if(!sos_on) loraTxBeacon(); dirty=true; }
        else if(held<500){ page=(page+1)%N_PAGES; dirty=true; }
    }
    last=state;
}

// ============================================================
// SETUP
// ============================================================
void setup(){
    Serial.begin(115200);
    { unsigned long t=millis(); while(!Serial&&millis()-t<3000); }
    Serial.println("\n[BOOT] PreppersBR " FW_VERSION " — Heltec V4");

    pinMode(LED_PIN,OUTPUT);
#if BUZZER_PIN >= 0
    ledcAttach(BUZZER_PIN,BUZZER_FREQ,8); ledcWriteTone(BUZZER_PIN,0);
#endif
    for(int i=0;i<6;i++){ digitalWrite(LED_PIN,HIGH); delay(100); digitalWrite(LED_PIN,LOW); delay(100); }

    {
        esp_err_t r=nvs_flash_init();
        if(r==ESP_ERR_NVS_NO_FREE_PAGES||r==ESP_ERR_NVS_NEW_VERSION_FOUND||r!=ESP_OK){
            nvs_flash_erase(); nvs_flash_init();
        }
    }

    // VEXT geral — alimenta OLED e outros periféricos (GPIO36 LOW = ON)
    pinMode(VEXT_PIN,OUTPUT); digitalWrite(VEXT_PIN,LOW);
    Serial.println("[BOOT] VEXT(36) ON");

    // GPS VCC — pino SEPARADO que alimenta o módulo GPS no V4.3
    // SEM este pino o GPS nunca recebe energia → sempre 0 bytes
    pinMode(GPS_VCC,OUTPUT); digitalWrite(GPS_VCC,LOW);
    Serial.println("[BOOT] GPS_VCC(45) ON");

    delay(300);  // aguarda estabilização das fontes

    // ID do dispositivo
    uint64_t mac=ESP.getEfuseMac();
    char tmp[8];
    snprintf(tmp,sizeof(tmp),"H%02X%02X",(uint8_t)((mac>>32)&0xFF),(uint8_t)((mac>>40)&0xFF));
    myid=String(tmp);
    Serial.printf("[BOOT] ID: %s\n",myid.c_str());

    loadCfg();
    pinMode(BTN_PRG,INPUT_PULLUP);

    // OLED
    u8g2.setBusClock(400000); u8g2.begin(); u8g2.setContrast(255);
    u8g2.clearBuffer(); u8g2.setFont(u8g2_font_7x13B_tr);
    u8g2.setCursor(10,20); u8g2.print("PreppersBR " FW_VERSION);
    u8g2.setFont(u8g2_font_5x7_tr);
    u8g2.setCursor(20,34); u8g2.print("Heltec V4");
    u8g2.setCursor(5,46);  u8g2.print("Iniciando GPS...");
    u8g2.sendBuffer();

    // GPS init
    gpsBegin();

    // LoRa
    femInit();
    SPI.begin(9,11,10,8);
    {
        int st=radio.begin(cfg.lora_freq,cfg.lora_bw,cfg.lora_sf,
                           LORA_CR,LORA_SYNC,LORA_POWER,8,LORA_TCXO);
        if(st!=RADIOLIB_ERR_NONE && (cfg.lora_freq!=LORA_FREQ||cfg.lora_bw!=LORA_BW||cfg.lora_sf!=LORA_SF)){
            // config salva não funcionou: volta ao padrão para a placa não ficar sem rádio
            Serial.printf("[LoRa] Erro %d com config salva, usando padrao\n",st);
            cfg.lora_freq=LORA_FREQ; cfg.lora_bw=LORA_BW; cfg.lora_sf=LORA_SF;
            st=radio.begin(cfg.lora_freq,cfg.lora_bw,cfg.lora_sf,LORA_CR,LORA_SYNC,LORA_POWER,8,LORA_TCXO);
        }
        if(st!=RADIOLIB_ERR_NONE){ Serial.printf("[LoRa] Erro: %d\n",st); l_ok=false; }
        else {
            radio.setDio2AsRfSwitch(true);
            radio.setDio1Action(loraISR);
            radio.startReceive();
            l_ok=true;
            Serial.printf("[LoRa] OK %.1fMHz SF%d\n",cfg.lora_freq,cfg.lora_sf);
        }
    }

    bleBegin();
    wifiBegin();
    readBat(); delay(100); readBat();   // a 1ª leitura do ADC após o boot sai baixa (~1,7 V): descarta

    tx_last=millis()-(unsigned long)cfg.beacon_s*1000UL+5000UL;
    updateDisplay();
    Serial.println("[BOOT] COMPLETO");
}

// ============================================================
// LOOP
// ============================================================
void loop(){
    unsigned long now=millis();
    gpsUpdate();
    if(l_ok) loraRX();
    if(l_ok && now-tx_last>(unsigned long)cfg.beacon_s*1000UL){ loraTxBeacon(); tx_last=now; }
    if(sos_on && l_ok && now-sos_last>SOS_INTERVAL){ loraTxSOS(); sos_last=now; }
    if(now-bat_last>15000){ readBat(); bat_last=now; }
    dnsServer.processNextRequest();
    webServer.handleClient();
    processCmds();
    bleUpdate();
    handleButton();
    beepUpdate();
    if(notif_until&&(long)(now-notif_until)>=0){ notif_until=0; dirty=true; }   // aviso acabou: volta para a tela da mensagem
    if(cfg_restart && now-cfg_restart_ms>800) ESP.restart();
    static unsigned long blink_last=0;
    if(page==6&&sos_on&&now-blink_last>=500){ dirty=true; blink_last=now; }
    if(now-draw_last>3000) dirty=true;
    if(dirty){ dirty=false; updateDisplay(); draw_last=now; }
}
