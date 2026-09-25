# Firmware PreppersBR — Heltec WiFi LoRa 32 V4

Rádio mesh LoRa (SX1262, 915 MHz, AES-128) com GPS, tela OLED, app web pelo WiFi da placa
(`192.168.4.1` / `preppersbr.local`) e serviço Bluetooth LE.

## Arduino IDE

1. **Settings → Additional boards manager URLs:**
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. **Boards Manager:** instale **esp32 by Espressif Systems** (testado com 3.3.12).
3. **Library Manager:** instale
   | Biblioteca | Autor | Versão testada |
   |---|---|---|
   | RadioLib | Jan Gromeš | 7.7.1 |
   | TinyGPSPlus | Mikal Hart | 1.0.3 |
   | U8g2 | oliver | 2.36.19 |
   | NimBLE-Arduino | h2zero | 2.5.1 |
4. **Tools:**
   | Opção | Valor |
   |---|---|
   | Board | Heltec WiFi LoRa 32(V4) |
   | Partition Scheme | **16M Flash (3MB APP/9.9MB FATFS)** — no esquema padrão o firmware ocupa 98% |
   | USB CDC On Boot | Enabled (mensagens no Serial Monitor, 115200) |

## secrets.h (obrigatório)

A chave do mesh e a senha padrão do WiFi **não ficam no GitHub** (repositório público).
Copie `HeltecV4PreppersV2/secrets.h.example` para `HeltecV4PreppersV2/secrets.h` e preencha.
Todas as placas da rede precisam da **mesma** `MESH_PSK`. Sem o arquivo, a compilação para com
a mensagem "Falta secrets.h".

## Compilar pela linha de comando

```sh
arduino-cli compile -b esp32:esp32:heltec_wifi_lora_32_V4:PartitionScheme=app3M_fat9M_16MB,CDCOnBoot=cdc firmware/HeltecV4PreppersV2
```
