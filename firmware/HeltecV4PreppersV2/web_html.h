#pragma once
#include <pgmspace.h>

static const char WEB_HTML[] PROGMEM = R"RAW(<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>PreppersBR</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{background:#000;color:#0f0;font-family:monospace;display:flex;flex-direction:column;height:100%}
#hdr{background:#111;padding:7px;text-align:center;font-size:17px;font-weight:bold;border-bottom:1px solid #0f0;letter-spacing:2px;flex-shrink:0}
#tabs{display:flex;background:#0a0a0a;border-bottom:1px solid #222;flex-shrink:0;overflow-x:auto}
.tab{flex:1;min-width:48px;padding:6px 2px;text-align:center;cursor:pointer;font-size:11px;color:#444;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap}
.tab.on{color:#0f0;border-bottom-color:#0f0}
#st{background:#0a0a0a;padding:3px 8px;font-size:10px;color:#666;display:flex;justify-content:space-between;flex-wrap:wrap;flex-shrink:0;border-bottom:1px solid #111}
.pg{display:none;flex:1;flex-direction:column;overflow:hidden;min-height:0}
.pg.on{display:flex}
/* RADIO */
#nd{background:#0a0a0a;padding:3px 8px;font-size:11px;color:#0ff;border-bottom:1px solid #1a1a1a;flex-shrink:0}
#msgs{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:5px;min-height:0}
.mi,.mo{border-radius:6px;padding:5px 8px;max-width:88%}
.mi{background:#0a1a0a;align-self:flex-start}
.mo{background:#1a1a00;align-self:flex-end}
.mt{color:#444;font-size:10px;display:block}
.mi .mt{color:#686}.mo .mt{color:#886}
.mi .tx{color:#0f0}.mo .tx{color:#ff0}
.ck{margin-left:6px;font-size:10px;color:#886}.ck.ok{color:#0af}
#inp{background:#111;padding:8px;padding-bottom:max(8px,env(safe-area-inset-bottom));border-top:2px solid #0f0;display:flex;gap:6px;flex-shrink:0}
#txf{flex:1;background:#1a1a1a;color:#0f0;border:1px solid #0f0;padding:10px 8px;font:16px monospace;border-radius:6px;outline:none}
#snd{background:#0f0;color:#000;border:none;padding:10px 14px;font:bold 14px monospace;border-radius:6px;cursor:pointer;flex-shrink:0}
/* MAPA */
#map{flex:1;min-height:0;position:relative}
#cv{display:block;width:100%;height:100%;background:#000811}
#mapi{background:#0a0a0a;padding:4px 8px;font-size:11px;color:#666;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;border-top:1px solid #111}
#bloc{background:#0ff;color:#000;border:none;padding:4px 10px;border-radius:4px;font:bold 11px monospace;cursor:pointer}
/* LORA */
#lora-nodes-view{flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0}
#lora-mesh-bar{background:#001800;padding:5px 10px;font-size:11px;color:#0a0;border-bottom:1px solid #0f02;display:flex;align-items:center;gap:6px;flex-shrink:0}
.pulse{width:7px;height:7px;border-radius:50%;background:#0f0;animation:p 1.2s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.2}}
#lora-list{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px}
.ncard{background:#0a110a;border:1px solid #1a3a1a;border-radius:8px;padding:8px 10px}
.ncard.nsos{border-color:#900;background:#110000}
.nhdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.nid{color:#0f0;font-size:14px;font-weight:bold;letter-spacing:1px}
.ndist{color:#0a0;font-size:12px}
.nact{display:flex;align-items:center;gap:8px}
.dmbtn{background:none;border:1px solid #0a0;color:#0f0;padding:4px 10px;border-radius:4px;font:12px monospace;cursor:pointer}
.dmbtn:active{background:#0f02}
.dbadge{background:#f00;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px}
#lora-empty{text-align:center;color:#333;padding:30px;font-size:13px}
/* DM view */
#lora-dm-view{flex:1;display:none;flex-direction:column;min-height:0}
#lora-dm-hdr{background:#0a110a;padding:8px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #1a3a1a;flex-shrink:0}
#lora-dm-back{background:none;border:1px solid #0a0;color:#0f0;padding:4px 10px;border-radius:4px;font:12px monospace;cursor:pointer}
#lora-dm-peer{color:#0ff;font-size:14px;font-weight:bold;letter-spacing:1px}
#lora-dm-msgs{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:5px;min-height:0}
#lora-dm-inp{background:#111;padding:8px;padding-bottom:max(8px,env(safe-area-inset-bottom));border-top:1px solid #1a3a1a;display:flex;gap:6px;flex-shrink:0}
#lora-dm-txf{flex:1;background:#1a1a1a;color:#0f0;border:1px solid #0f0;padding:9px 8px;font:15px monospace;border-radius:6px;outline:none}
#lora-dm-snd{background:#0a0;color:#fff;border:none;padding:9px 12px;font:bold 13px monospace;border-radius:6px;cursor:pointer;flex-shrink:0}
/* CLIMA */
#cli{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:10px}
.card{background:#0a110a;border:1px solid #1a3a1a;border-radius:8px;padding:10px}
.card h3{color:#0f0;font-size:11px;margin-bottom:8px;border-bottom:1px solid #1a3a1a;padding-bottom:4px;letter-spacing:1px}
.row{display:flex;justify-content:space-between;margin:3px 0;font-size:12px}
.lbl{color:#444}.val{color:#0f0}
.bigt{font-size:42px;text-align:center;color:#ff0;padding:6px 0}
.wdsc{text-align:center;color:#666;font-size:13px;margin-bottom:6px}
/* CONF */
#cfi{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:10px}
.cinp{background:#1a1a1a;color:#0f0;border:1px solid #0f0;padding:5px 8px;font:13px monospace;border-radius:4px;width:150px}
.cbtn{background:#0f0;color:#000;border:none;padding:9px 18px;font:bold 14px monospace;border-radius:6px;cursor:pointer;display:block;margin:4px auto}
/* SOS */
#tbsos{color:#700}
#tbsos.on{color:#f55;border-bottom-color:#f55}
#sosi{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px}
/* REDE */
#neti{flex:1;overflow-y:auto}
#netsum{padding:8px 10px;font-size:11px;color:#686;border-bottom:1px solid #1a3a1a}
#netsum b{color:#0f0}
.nc{padding:9px 10px;border-bottom:1px solid #112211}
.nc .tp{display:flex;align-items:center;gap:7px}
.nc .dt{width:9px;height:9px;border-radius:50%;background:#333;flex:none}
.nc.on .dt{background:#0f0;box-shadow:0 0 5px #0f0}
.nc.sos .dt{background:#f33;box-shadow:0 0 5px #f33}
.nc .id{font-size:14px;font-weight:bold;color:#0f0}
.nc.off .id{color:#464}
.nc .sx{margin-left:auto;font-size:10px;color:#464}
.nc.on .sx{color:#0f0}
.nc .gd{display:flex;flex-wrap:wrap;gap:3px 14px;margin-top:5px;font-size:11px;color:#9c9}
.nc.me{background:#061006}
.sosbig{width:160px;height:160px;border-radius:50%;background:#900;color:#fff;font:bold 20px monospace;border:4px solid #f55;cursor:pointer;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:manipulation;line-height:1.4;box-shadow:0 0 24px #9004}
.sosbig.active{background:#f00;box-shadow:0 0 40px #f00}
.canbig{width:100%;padding:12px;border-radius:8px;background:#1a0000;color:#f55;font:bold 14px monospace;border:2px solid #f55;cursor:pointer}
</style></head>
<body>
<div id="hdr">&#128225; PREPPERS BR</div>
<div id="tabs">
  <button class="tab on"  onclick="stab(0)">&#128222; RADIO</button>
  <button class="tab"     onclick="stab(1)">&#128507; MAPA</button>
  <button class="tab"     onclick="stab(2)">Contatos</button>
  <button class="tab"     onclick="stab(3)">&#127782; CLIMA</button>
  <button class="tab"     onclick="stab(4)">&#9881; CONF</button>
  <button id="tbsos" class="tab" onclick="stab(5)">&#128682; SOS</button>
  <button class="tab"     onclick="stab(6)">&#128752; REDE</button>
</div>
<div id="st">
  <span id="s0">GPS:--</span>
  <span id="s1">LoRa:--</span>
  <span id="s2">Bat:--%</span>
  <span id="s3">--:--</span>
</div>

<!-- PG0: RADIO -->
<div id="pg0" class="pg on">
  <div id="nd">NOS: --</div>
  <div id="msgs"></div>
  <div id="inp">
    <input id="txf" type="text" placeholder="Mensagem LoRa (rede aberta)..." maxlength="55" autocomplete="off">
    <button id="snd" onclick="snd()">&#9658;SEND</button>
  </div>
</div>

<!-- PG1: MAPA -->
<div id="pg1" class="pg">
  <div id="map"><canvas id="cv"></canvas></div>
  <div id="mapi">
    <span id="mpos">Sem posicao GPS</span>
    <button id="bloc" onclick="getLoc()">&#128205; MEU LOCAL</button>
  </div>
</div>

<!-- PG2: LORA — nos + DM privado -->
<div id="pg2" class="pg">
  <!-- View: lista de nos -->
  <div id="lora-nodes-view" style="display:flex;flex-direction:column;flex:1;min-height:0">
    <div id="lora-mesh-bar">
      <div class="pulse"></div>
      <span>REPETIDORA MESH: ATIVA &nbsp;|&nbsp; CRIPTOGRAFIA AES-128</span>
    </div>
    <div id="lora-list"></div>
  </div>
  <!-- View: conversa privada -->
  <div id="lora-dm-view">
    <div id="lora-dm-hdr">
      <button id="lora-dm-back" onclick="closeDM()">&#8592; VOLTAR</button>
      <span id="lora-dm-peer">---</span>
      <span id="lora-dm-dist" style="margin-left:auto;color:#0a0;font-size:11px"></span>
    </div>
    <div id="lora-dm-msgs"></div>
    <div id="lora-dm-inp">
      <input id="lora-dm-txf" type="text" placeholder="Mensagem privada..." maxlength="80" autocomplete="off">
      <button id="lora-dm-snd" onclick="sendDM()">&#9658; ENVIAR</button>
    </div>
  </div>
</div>

<!-- PG3: CLIMA -->
<div id="pg3" class="pg">
  <div id="cli">
    <div class="card">
      <h3>&#127782; METEOROLOGIA</h3>
      <div class="bigt" id="wt">--&#176;C</div>
      <div class="wdsc" id="wd">Aguardando localizacao...</div>
      <div class="row"><span class="lbl">Umidade</span><span class="val" id="wh">--%</span></div>
      <div class="row"><span class="lbl">Vento</span><span class="val" id="ww">-- km/h</span></div>
    </div>
    <div class="card">
      <h3>&#127758; POSICAO GPS</h3>
      <div class="row"><span class="lbl">Latitude</span><span class="val" id="glat">--</span></div>
      <div class="row"><span class="lbl">Longitude</span><span class="val" id="glon">--</span></div>
      <div class="row"><span class="lbl">Altitude</span><span class="val" id="galt">-- m</span></div>
      <div class="row"><span class="lbl">Satelites</span><span class="val" id="gsat">--</span></div>
    </div>
    <div class="card">
      <h3>&#128261; SISTEMA</h3>
      <div class="row"><span class="lbl">ID do dispositivo</span><span class="val" id="smyid">--</span></div>
      <div class="row"><span class="lbl">Nos ativos</span><span class="val" id="snc">--</span></div>
      <div class="row"><span class="lbl">TX / RX</span><span class="val" id="str">--/--</span></div>
      <div class="row"><span class="lbl">RSSI ultimo</span><span class="val" id="srs">-- dBm</span></div>
      <div class="row"><span class="lbl">Bateria</span><span class="val" id="sbat">--%</span></div>
    </div>
  </div>
</div>

<!-- PG4: CONF -->
<div id="pg4" class="pg">
  <div id="cfi">
    <div class="card">
      <h3>&#128268; CONFIGURACAO DO DISPOSITIVO</h3>
      <div class="row"><span class="lbl">Call Sign (ID)</span>
        <input id="cf0" class="cinp" maxlength="7" placeholder="PBR01" autocomplete="off"></div>
      <div class="row"><span class="lbl">Beacon (s)</span>
        <input id="cf1" class="cinp" type="number" min="5" max="600" placeholder="30"></div>
      <div class="row"><span class="lbl">Freq LoRa</span>
        <select id="cf2" class="cinp">
          <option value="868.0">868 MHz</option>
          <option value="915.0" selected>915 MHz</option>
        </select></div>
      <div class="row"><span class="lbl">SF (Spreading Factor)</span>
        <select id="cf3" class="cinp">
          <option value="7">SF7 (rapido)</option>
          <option value="8">SF8</option>
          <option value="9" selected>SF9</option>
          <option value="10">SF10</option>
          <option value="11">SF11</option>
          <option value="12">SF12 (alcance)</option>
        </select></div>
      <div class="row"><span class="lbl">Largura de Banda</span>
        <select id="cf4" class="cinp">
          <option value="62.5">62.5 kHz</option>
          <option value="125.0" selected>125 kHz</option>
          <option value="250.0">250 kHz</option>
        </select></div>
      <div class="row"><span class="lbl">Senha WiFi (min 8)</span>
        <input id="cf5" class="cinp" maxlength="31" placeholder="minimo 8 caracteres" autocomplete="off"></div>
      <div style="text-align:center;margin:14px 0 6px">
        <button class="cbtn" onclick="saveCfg()">&#128190; SALVAR &amp; REINICIAR</button>
      </div>
      <div id="cfmsg" style="text-align:center;font-size:13px;padding:4px;color:#666"></div>
    </div>
    <div class="card">
      <h3>&#8505; NOTA</h3>
      <p style="font-size:12px;color:#555;line-height:1.6">Todos os nos da rede devem usar a mesma frequencia, SF e BW. Apos salvar o dispositivo reinicia em ~2s. Call sign: ate 7 letras/numeros, _ ou -.</p>
    </div>
  </div>
</div>

<!-- PG5: SOS -->
<div id="pg5" class="pg">
  <div id="sosi">
    <div id="sosst" style="text-align:center;padding:10px 14px;font-size:13px;color:#555;border:1px solid #222;border-radius:8px;background:#111">Nenhuma emergencia ativa</div>
    <div style="display:flex;justify-content:center;padding:14px 0">
      <button id="sosbtn" class="sosbig" onclick="sendSOS()">&#128682;<br>SOS</button>
    </div>
    <button id="soscbtn" class="canbig" onclick="cancelSOS()" style="display:none">&#10005; CANCELAR SOS</button>
    <div class="card">
      <h3>&#9888; EMERGENCIA</h3>
      <p style="font-size:12px;color:#555;line-height:1.6">SOS transmitido via LoRa Mesh para todos os nos com sua posicao GPS. Use somente em emergencia real.</p>
    </div>
  </div>
</div>

<!-- PG6: REDE (todas as placas ouvidas) -->
<div id="pg6" class="pg">
  <div id="neti">
    <div id="netsum"></div>
    <div id="netl"></div>
    <p style="padding:10px;font-size:10px;color:#464;line-height:1.6">online = ouvida nos ultimos 3 beacons &middot; direto = sua placa ouve essa placa sem repetidor &middot; via repetidor = chega passando por outras placas &middot; sinal e bateria do ultimo pacote</p>
  </div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
// ── Estado global ──────────────────────────────────────────
var cnt=-1, dm_ver_seen=-1, akChat=-1, akDm=-1;
// ✓ = sua placa transmitiu · ✓✓ = outra placa confirmou (no chat aberto, com o número de placas)
function ck(m,chat){if(!m.mine)return '';if(m.a===undefined)return '<span class="ck" title="enviando">…</span>';
  if(!m.a)return '<span class="ck" title="enviada pelo radio">\u2713</span>';
  return '<span class="ck ok" title="recebida por '+m.a+' placa(s)">\u2713\u2713'+(chat&&m.a>1?' '+m.a:'')+'</span>';}
var lmap=null, myMk=null, celMk=null, ndMks={};
var dLat=0, dLon=0, dFix=false;
var cLat=0, cLon=0, cOk=false;
var wFetched=false;
var nlist=[], sosActive=false;
var myId='PBR';

// ── DM (mensagem privada) ──────────────────────────────────
var dmPeer=null;
var dmStore={};  // {peer: [{from,text,mine}, ...]}

function haversine(a,b,c,d){
  var R=6371000,r1=a*Math.PI/180,r2=c*Math.PI/180;
  var dr=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180;
  var x=Math.sin(dr/2)*Math.sin(dr/2)+Math.cos(r1)*Math.cos(r2)*Math.sin(dl/2)*Math.sin(dl/2);
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m';}

function openDM(peer){
  dmPeer=peer;
  document.getElementById('lora-nodes-view').style.display='none';
  var dv=document.getElementById('lora-dm-view');
  dv.style.display='flex';dv.style.flexDirection='column';dv.style.flex='1';dv.style.minHeight='0';
  document.getElementById('lora-dm-peer').textContent='\uD83D\uDCAC '+peer;
  var nd=nlist.find(function(n){return n.id===peer;});
  var dist='';
  if(nd&&nd.lat&&nd.lon&&dFix) dist=fmtDist(haversine(dLat,dLon,nd.lat,nd.lon));
  document.getElementById('lora-dm-dist').textContent=dist;
  renderDM();
}
function closeDM(){
  dmPeer=null;
  document.getElementById('lora-dm-view').style.display='none';
  document.getElementById('lora-nodes-view').style.display='flex';
}
// O celular pode deixar o WiFi da placa "dormindo": a primeira requisição depois de um tempo parado
// falha e a segunda passa. Tenta até 3 vezes antes de avisar.
function postRetry(url,body,n){
  n=n||3;
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body})
    .catch(function(e){if(n<=1)throw e;return new Promise(function(r){setTimeout(r,700);}).then(function(){return postRetry(url,body,n-1);});});
}
function renderDM(){
  if(!dmPeer)return;
  var el=document.getElementById('lora-dm-msgs');
  var msgs=dmStore[dmPeer]||[];
  el.innerHTML='';
  if(!msgs.length){
    el.innerHTML='<div style="text-align:center;color:#333;padding:20px;font-size:12px">Sem mensagens com '+esc(dmPeer)+'<br>Envie a primeira mensagem!</div>';
    return;
  }
  msgs.forEach(function(m){
    var dv=document.createElement('div');
    dv.className=m.mine?'mo':'mi';
    dv.innerHTML='<span class="mt">'+esc(m.from)+'</span><span class="tx">'+esc(m.text)+'</span>'+ck(m,false);
    el.appendChild(dv);
  });
  el.scrollTop=el.scrollHeight;
}
function sendDM(){
  var inp=document.getElementById('lora-dm-txf');
  var v=inp.value.trim();
  if(!v||!dmPeer)return;
  postRetry('/senddm','to='+encodeURIComponent(dmPeer)+'&m='+encodeURIComponent(v))
  .then(function(r){
    if(r.ok){
      inp.value='';
      if(!dmStore[dmPeer])dmStore[dmPeer]=[];
      dmStore[dmPeer].push({from:myId,text:v,mine:true});
      renderDM();setTimeout(upd,600);setTimeout(upd,1500);
    } else r.text().then(function(e){alert('Nao enviado: '+e);});
  }).catch(function(){alert('Sem conexao com a placa');});
}
document.getElementById('lora-dm-txf').addEventListener('keydown',function(e){if(e.key==='Enter')sendDM();});

function renderLoraNodes(){
  var el=document.getElementById('lora-list');
  if(!nlist.length){
    el.innerHTML='<div id="lora-empty">Nenhum no ativo na rede.<br><br>Aguardando beacons LoRa...</div>';
    return;
  }
  var html='';
  nlist.forEach(function(n){
    var dist='';
    if(dFix&&n.lat&&n.lon) dist=fmtDist(haversine(dLat,dLon,n.lat,n.lon));
    var unread=(dmStore[n.id]||[]).filter(function(m){return !m.mine;}).length;
    html+='<div class="ncard'+(n.sos?' nsos':'')+'">'
      +'<div class="nhdr">'
      +'<span class="nid">'+esc(n.id)+(n.sos?' &#128682;':'')+' </span>'
      +'<span class="ndist">'+(dist||'---')+'</span>'
      +'</div>'
      +'<div class="nact">'
      +'<button class="dmbtn" data-peer="'+esc(n.id)+'" onclick="openDM(this.dataset.peer)">&#128172; PRIVADO</button>'
      +(unread?'<span class="dbadge">'+unread+'</span>':'')
      +'</div>'
      +'</div>';
  });
  el.innerHTML=html;
}

// ── SOS ───────────────────────────────────────────────────
function sendSOS(){
  if(!confirm('CONFIRMAR ENVIO DE SOS?\n\nTodos os nos da rede serao alertados!')) return;
  fetch('/sos',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'action=on'})
  .then(function(r){if(r.ok){sosActive=true;updSosUI();}});
}
function cancelSOS(){
  fetch('/sos',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'action=off'})
  .then(function(r){if(r.ok){sosActive=false;updSosUI();}});
}
function updSosUI(){
  var s=document.getElementById('sosst'),b=document.getElementById('sosbtn');
  var c=document.getElementById('soscbtn'),t=document.getElementById('tbsos');
  if(sosActive){
    s.textContent='SOS ATIVO — Transmitindo a cada 10s';
    s.style.cssText='text-align:center;padding:10px 14px;font-size:13px;color:#f00;border:2px solid #f00;border-radius:8px;background:#200';
    b.className='sosbig active';b.style.pointerEvents='none';
    c.style.display='block';if(t)t.style.color='#f55';
  }else{
    s.textContent='Nenhuma emergencia ativa';
    s.style.cssText='text-align:center;padding:10px 14px;font-size:13px;color:#555;border:1px solid #222;border-radius:8px;background:#111';
    b.className='sosbig';b.style.pointerEvents='';c.style.display='none';if(t)t.style.color='';
  }
}

// ── Tabs ──────────────────────────────────────────────────
function stab(n){
  document.querySelectorAll('.tab').forEach(function(t,i){t.classList.toggle('on',i===n);});
  document.querySelectorAll('.pg').forEach(function(p,i){p.classList.toggle('on',i===n);});
  if(n===1)initMap();
  if(n===2)renderLoraNodes();
  if(n===4)loadCfg();
  if(n===6)renderNet();
}

// ── Rede: todas as placas que esta placa ja ouviu ──────────
var lastD=null;
function agoT(s){return s<60?'agora':s<3600?Math.round(s/60)+' min':Math.round(s/3600)+' h';}
function renderNet(){
  var d=lastD;if(!d||!document.getElementById('pg6').classList.contains('on'))return;
  var lim=Math.max(90,3*(d.bs||30));
  var list=(d.nodeList||[]).slice().sort(function(a,b){return (a.age>lim)-(b.age>lim)||a.age-b.age;});
  var on=list.filter(function(n){return n.age<=lim;}),dir=on.filter(function(n){return n.h===0;});
  document.getElementById('netsum').innerHTML='<b>'+list.length+'</b> placa(s) na rede &middot; <b>'+on.length+'</b> online &middot; <b>'+dir.length+'</b> ao alcance direto';
  var h='<div class="nc me on"><div class="tp"><span class="dt"></span><span class="id">'+esc(d.myid||'')+'</span><span class="sx">SUA PLACA</span></div>'
    +'<div class="gd"><span>Bateria '+d.bat+'%</span><span>'+(d.fix?'GPS '+d.sat+' sat':'sem GPS')+'</span><span>LoRa '+(d.lora?'ok':'ERRO')+'</span><span>TX/RX '+(d.tx||0)+'/'+(d.rx||0)+'</span></div></div>';
  list.forEach(function(n){
    var ok=n.age<=lim,g=[];
    if(n.h===0)g.push('&#128246; direto');else if(n.h>0)g.push('&#128257; via '+n.h+' repetidor'+(n.h>1?'es':''));
    if(n.h===0&&n.r)g.push('sinal '+n.r+' dBm &middot; SNR '+n.q);
    if(n.b>=0)g.push('bateria '+n.b+'%');
    if(dFix&&(n.lat||n.lon)){var m=haversine(dLat,dLon,n.lat,n.lon);g.push(m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m');}
    else if(!(n.lat||n.lon))g.push('sem posicao');
    g.push(n.age<60?'visto agora':'visto ha '+agoT(n.age));
    h+='<div class="nc '+(n.sos?'sos ':'')+(ok?'on':'off')+'"><div class="tp"><span class="dt"></span><span class="id">'+esc(n.id)+(n.sos?' SOS':'')+'</span><span class="sx">'+(ok?'ONLINE':'sem sinal ha '+agoT(n.age))+'</span></div>'
      +'<div class="gd"><span>'+g.join('</span><span>')+'</span></div></div>';
  });
  if(!list.length)h+='<p style="padding:20px;text-align:center;color:#464;font-size:12px">Nenhuma outra placa ouvida ainda.</p>';
  document.getElementById('netl').innerHTML=h;
}

// ── Config ────────────────────────────────────────────────
function loadCfg(){
  fetch('/config').then(function(r){return r.json();}).then(function(d){
    document.getElementById('cf0').value=d.callsign||'';
    document.getElementById('cf1').value=d.beacon_s||30;
    var f=document.getElementById('cf2');
    for(var i=0;i<f.options.length;i++) if(Math.abs(parseFloat(f.options[i].value)-(d.lora_freq||915))<1)f.selectedIndex=i;
    var s=document.getElementById('cf3');
    for(var i=0;i<s.options.length;i++) if(parseInt(s.options[i].value)===(d.lora_sf||9))s.selectedIndex=i;
    var bw=document.getElementById('cf4');
    for(var i=0;i<bw.options.length;i++) if(Math.abs(parseFloat(bw.options[i].value)-(d.lora_bw||125))<1)bw.selectedIndex=i;
    document.getElementById('cf5').value=d.wifi_pass||'';
    document.getElementById('cfmsg').textContent='';
  }).catch(function(){document.getElementById('cfmsg').textContent='Erro ao carregar config';});
}
function saveCfg(){
  var body='callsign='+encodeURIComponent(document.getElementById('cf0').value)
    +'&beacon_s='+document.getElementById('cf1').value
    +'&lora_freq='+document.getElementById('cf2').value
    +'&lora_sf='+document.getElementById('cf3').value
    +'&lora_bw='+document.getElementById('cf4').value
    +'&wifi_pass='+encodeURIComponent(document.getElementById('cf5').value);
  var msg=document.getElementById('cfmsg');
  msg.style.color='#ff0';msg.textContent='Salvando...';
  fetch('/config',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body})
  .then(function(r){
    if(r.ok){msg.style.color='#0f0';msg.textContent='Salvo! Reiniciando em 2s...';}
    else r.text().then(function(e){msg.style.color='#f00';msg.textContent='Erro: '+e;});
  }).catch(function(){msg.style.color='#f00';msg.textContent='Sem conexao';});
}

// ── Mapa Leaflet ──────────────────────────────────────────
function mkIco(c,s){
  return L&&L.divIcon?L.divIcon({className:'',
    html:'<div style="width:'+s+'px;height:'+s+'px;border-radius:50%;background:'+c+';border:2px solid #fff;box-shadow:0 0 6px '+c+'"></div>',
    iconSize:[s,s],iconAnchor:[s/2,s/2]}):null;
}
function initMap(){
  var el=document.getElementById('map');
  if(typeof L==='undefined'||typeof L.map==='undefined'){
    var cv=document.getElementById('cv');
    if(!cv){el.innerHTML='<canvas id="cv" style="width:100%;height:100%;background:#000811"></canvas>';}
    drawCV();return;
  }
  if(lmap){lmap.invalidateSize();updMks();return;}
  el.innerHTML='';
  lmap=L.map(el,{zoomControl:true,attributionControl:false})
    .setView(dFix?[dLat,dLon]:[-15.78,-47.93],dFix?14:4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(lmap);
  updMks();
}
function updMks(){
  if(!lmap)return;
  if(dFix){
    if(!myMk)myMk=L.marker([dLat,dLon],{icon:mkIco('#0f0',14)}).addTo(lmap).bindPopup(myId);
    else{myMk.setLatLng([dLat,dLon]);myMk.getPopup()&&myMk.getPopup().setContent(myId);}
  }
  if(cOk){
    if(!celMk)celMk=L.marker([cLat,cLon],{icon:mkIco('#0ff',12)}).addTo(lmap).bindPopup('Celular');
    else celMk.setLatLng([cLat,cLon]);
  }
  nlist.forEach(function(n){
    if(!n.lat||!n.lon)return;
    var lbl=n.id+(n.sos?' SOS':'');
    if(!ndMks[n.id])ndMks[n.id]=L.marker([n.lat,n.lon],{icon:mkIco(n.sos?'#f00':'#ff0',10)}).addTo(lmap).bindPopup(lbl);
    else{ndMks[n.id].setLatLng([n.lat,n.lon]);ndMks[n.id].getPopup()&&ndMks[n.id].getPopup().setContent(lbl);}
  });
}

// ── Canvas radar (fallback offline) ───────────────────────
function drawCV(){
  var cv=document.getElementById('cv');if(!cv)return;
  cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;
  var ctx=cv.getContext('2d'),w=cv.width,h=cv.height,cx=w/2,cy=h/2;
  var R=Math.min(w,h)*0.44;
  ctx.fillStyle='#000811';ctx.fillRect(0,0,w,h);
  // Aneis de distancia
  var rings=[{r:.33,lbl:'3km'},{r:.66,lbl:'6km'},{r:1,lbl:'10km'}];
  rings.forEach(function(rg){
    ctx.strokeStyle='#0f03';ctx.lineWidth=1;ctx.beginPath();
    ctx.arc(cx,cy,R*rg.r,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#0f04';ctx.font='9px monospace';
    ctx.fillText(rg.lbl,cx+R*rg.r+2,cy-2);
  });
  // Cruz
  ctx.strokeStyle='#0f03';ctx.beginPath();
  ctx.moveTo(cx,cy-R);ctx.lineTo(cx,cy+R);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-R,cy);ctx.lineTo(cx+R,cy);ctx.stroke();
  // Norte
  ctx.fillStyle='#0f06';ctx.font='10px monospace';ctx.fillText('N',cx-4,cy-R-4);
  ctx.fillText('S',cx-3,cy+R+12);ctx.fillText('L',cx+R+4,cy+4);ctx.fillText('O',cx-R-12,cy+4);
  // Meu marcador
  ctx.fillStyle='#0f0';ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0';ctx.font='bold 10px monospace';ctx.fillText(myId,cx+10,cy+4);
  // Celular
  if(cOk&&dFix){
    var sc=R/10000;
    var dx=(cLon-dLon)*111000*Math.cos(dLat*Math.PI/180)*sc;
    var dy=-(cLat-dLat)*111000*sc;
    var px=cx+dx,py=cy+dy;
    if(px>4&&px<w-4&&py>4&&py<h-4){
      ctx.fillStyle='#0ff';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#0ff';ctx.font='9px monospace';ctx.fillText('CEL',px+7,py+4);
    }
  }
  // Nos da rede
  nlist.forEach(function(n){
    if(!n.lat||!n.lon||!dFix)return;
    var dlat=(n.lat-dLat)*111000,dlon=(n.lon-dLon)*111000*Math.cos(dLat*Math.PI/180);
    var d=Math.sqrt(dlat*dlat+dlon*dlon);
    var b=Math.atan2(dlon,dlat);
    var rs=Math.min(d/10000,1)*R;
    var px=cx+rs*Math.sin(b),py=cy-rs*Math.cos(b);
    ctx.fillStyle=n.sos?'#f00':'#ff0';
    ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=n.sos?'#f00':'#ff0';ctx.font='bold 10px monospace';
    ctx.fillText(n.id,px+7,py+4);
  });
  document.getElementById('mpos').textContent=dFix?
    (myId+': '+dLat.toFixed(5)+', '+dLon.toFixed(5)):
    'Sem GPS no dispositivo';
}

// ── Geoloc celular ────────────────────────────────────────
function getLoc(){
  if(!navigator.geolocation){alert('GPS nao disponivel');return;}
  navigator.geolocation.getCurrentPosition(function(p){
    cLat=p.coords.latitude;cLon=p.coords.longitude;cOk=true;
    fetch('/location',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:'lat='+cLat+'&lon='+cLon});
    updMks();
    var cv=document.getElementById('cv');if(cv)drawCV();
    if(!wFetched)fetchWx(cLat,cLon);
  },function(e){alert('Erro GPS: '+e.message);},{timeout:8000});
}

// ── Clima ─────────────────────────────────────────────────
var WX={0:'Ceu limpo',1:'Poucas nuvens',2:'Parcialmente nublado',3:'Nublado',
  45:'Neblina',51:'Garoa',61:'Chuva leve',63:'Chuva',65:'Chuva forte',
  71:'Neve',80:'Pancadas',81:'Pancadas mod.',82:'Pancadas fortes',
  95:'Tempestade',99:'Tempestade c/ granizo'};
function fetchWx(lat,lon){
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+
    '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=America%2FSao_Paulo')
  .then(function(r){return r.json();}).then(function(d){
    wFetched=true;var c=d.current;
    document.getElementById('wt').textContent=c.temperature_2m+'\xb0C';
    document.getElementById('wd').textContent=WX[c.weather_code]||('Cod '+c.weather_code);
    document.getElementById('wh').textContent=c.relative_humidity_2m+'%';
    document.getElementById('ww').textContent=c.wind_speed_10m+' km/h';
    fetch('/weather',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:'temp='+c.temperature_2m+'&hum='+c.relative_humidity_2m+'&wind='+c.wind_speed_10m});
  }).catch(function(){document.getElementById('wd').textContent='Sem internet - ligue dados moveis';});
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

// ── Polling principal ─────────────────────────────────────
function upd(){
  fetch('/data').then(function(r){return r.json();}).then(function(d){
    // IDs e estado
    if(d.myid)myId=d.myid;
    dFix=d.fix;dLat=d.lat||0;dLon=d.lon||0;
    nlist=d.nodeList||[];
    lastD=d;renderNet();

    // Status bar
    document.getElementById('s0').textContent='GPS:'+(d.fix?'OK':'SEM');
    document.getElementById('s1').textContent='LoRa:'+(d.lora?'OK':'ERR');
    document.getElementById('s2').textContent='Bat:'+d.bat+'%';
    document.getElementById('s3').textContent=d.time;
    document.getElementById('nd').textContent='NOS: '+d.nodes+'  |  ID: '+myId;

    // Info CLIMA
    document.getElementById('glat').textContent=d.fix?Number(d.lat).toFixed(6):'--';
    document.getElementById('glon').textContent=d.fix?Number(d.lon).toFixed(6):'--';
    document.getElementById('galt').textContent=d.alt?Number(d.alt).toFixed(0)+' m':'--';
    document.getElementById('gsat').textContent=d.sat||'--';
    document.getElementById('snc').textContent=d.nc||0;
    document.getElementById('str').textContent=(d.tx||0)+'/'+(d.rx||0);
    document.getElementById('srs').textContent=(d.rssi||0)+' dBm';
    document.getElementById('sbat').textContent=d.bat+'%';
    document.getElementById('smyid').textContent=myId;
    if(d.temp)document.getElementById('wt').textContent=d.temp+'\xb0C';

    // ── Mensagens radio (chat aberto) ─────────────────────────
    var mnChanged=(d.mn!==cnt);
    if(mnChanged||d.ak!==akChat){
      cnt=d.mn;akChat=d.ak;
      var el=document.getElementById('msgs');el.innerHTML='';
      var lastIncoming=null;
      (d.msgs||[]).forEach(function(m){
        var dv=document.createElement('div');
        dv.className=m.mine?'mo':'mi';
        dv.innerHTML='<span class="mt">'+esc(m.from)+'</span><span class="tx">'+esc(m.text)+'</span>'+ck(m,true);
        el.appendChild(dv);
        if(!m.mine)lastIncoming=m;
      });
      el.scrollTop=el.scrollHeight;
      // Auto-abrir aba RADIO quando chega mensagem de outro nó
      if(lastIncoming&&mnChanged) stab(0);
    }

    // ── DMs (mensagens privadas) ───────────────────────────────
    if(d.dmver!==undefined&&(d.dmver!==dm_ver_seen||d.ak!==akDm)){
      var isNew=(dm_ver_seen>=0&&d.dmver>dm_ver_seen);
      dm_ver_seen=d.dmver;akDm=d.ak;
      // Reconstruir dmStore do servidor (fonte de verdade)
      dmStore={};
      var latestIncomingPeer=null;
      (d.dms||[]).forEach(function(dm){
        if(!dmStore[dm.peer])dmStore[dm.peer]=[];
        dmStore[dm.peer].push({from:dm.from,text:dm.text,mine:dm.mine,a:dm.a});
        if(!dm.mine)latestIncomingPeer=dm.peer;
      });
      if(isNew&&latestIncomingPeer){
        // Auto-abrir conversa privada quando chega DM novo
        stab(2);
        openDM(latestIncomingPeer);
      } else if(dmPeer){
        renderDM();
      }
      // Badge na aba Contatos
      var loraTab=document.querySelectorAll('.tab')[2];
      var hasUnread=Object.keys(dmStore).some(function(k){
        return k!==dmPeer&&(dmStore[k]||[]).some(function(m){return !m.mine;});
      });
      loraTab.textContent=hasUnread?'Contatos (!)':'Contatos';
    }

    // Mapa
    updMks();
    var cv=document.getElementById('cv');
    var pg1on=document.getElementById('pg1').classList.contains('on');
    if(cv&&pg1on)drawCV();
    if(dFix&&!wFetched)fetchWx(dLat,dLon);

    // SOS
    if(d.mysos!==undefined&&d.mysos!==sosActive){sosActive=d.mysos;updSosUI();}

    // Aba LORA
    if(document.getElementById('pg2').classList.contains('on'))renderLoraNodes();

    // Auto-geolocalizacao celular
    if(!cOk&&navigator.geolocation){
      navigator.geolocation.getCurrentPosition(function(p){
        cLat=p.coords.latitude;cLon=p.coords.longitude;cOk=true;
        fetch('/location',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:'lat='+cLat+'&lon='+cLon});
        if(!wFetched)fetchWx(cLat,cLon);
      },function(){},{timeout:4000,maximumAge:60000});
    }
  }).catch(function(){});
}

// ── Chat aberto (RADIO) ───────────────────────────────────
function snd(){
  var t=document.getElementById('txf'),v=t.value.trim();
  if(!v)return;
  postRetry('/send','m='+encodeURIComponent(v)).then(function(r){
      if(r.ok){t.value='';setTimeout(upd,600);setTimeout(upd,1500);return;}
      r.text().then(function(e){alert('Nao enviado: '+e);});
    }).catch(function(){alert('Sem conexao com a placa');});
}
document.getElementById('txf').addEventListener('keydown',function(e){if(e.key==='Enter')snd();});

// ── Altura viewport (teclado virtual) ─────────────────────
function setVH(){
  var h=window.visualViewport?window.visualViewport.height:window.innerHeight;
  document.body.style.height=h+'px';
}
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',setVH);
  window.visualViewport.addEventListener('scroll',setVH);
}
window.addEventListener('resize',setVH);
setVH();

upd();setInterval(upd,3000);
</script>
</body></html>)RAW";
