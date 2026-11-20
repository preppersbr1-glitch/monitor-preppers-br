// Alertas push do PREPPERS BR — painel "🔔 ALERTAS PUSH" da página Membros.
// Uso: <script src="alertas.js" defer></script> + um <div id="alertas"></div> na página.
// A página chama PBRAlertas.mostrar(usuarioFirebase, nivel) sempre que o login ou o plano mudar.
// Quem envia é o Worker (pagamentos/worker.js); o aparelho recebe pelo sw-alertas.js.
(function () {
  var API = 'https://preppers-pagamentos.preppersbr1.workers.dev';
  var SW = 'sw-alertas.js';
  var TIPOS = [
    { k: 'sismo', ic: '🌍', n: 'Terremotos', d: 'Tremores no Brasil (M3+), fortes na América do Sul (M6.5+) e grandes no mundo (M7+).' },
    { k: 'solar', ic: '☀️', n: 'Tempestades solares', d: 'Tempestades geomagnéticas fortes (G3 a G5) e explosões solares classe X.' },
    { k: 'avisos', ic: '📢', n: 'Avisos do PREPPERS BR', d: 'Crises, enchentes, alertas da Defesa Civil e do INMET enviados pelo fundador.' },
    { k: 'mentoria', ic: '🎖️', n: 'Sala de Mentoria', d: 'Quando houver resposta nova para você na Sala de Mentoria.', so: ['comando', 'admin'] }
  ];
  var UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

  var user = null, nivel = '', estado = null, assinado = false, ocupado = false, ultimo = '', recarregou = false;

  var css = document.createElement('style');
  css.textContent =
    '#alertas{margin:0 0 16px;scroll-margin-top:150px}' +
    '.pal{background:var(--card,#0a1610);border:1px solid var(--border,#1a3d2a);border-radius:4px;overflow:hidden;font-family:Rajdhani,sans-serif;color:var(--text,#c8fce8)}' +
    '.pal.on{border-color:rgba(0,255,136,.45)}' +
    '.pal-cab{padding:12px 16px;border-bottom:1px solid var(--border,#1a3d2a);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:rgba(0,255,136,.03)}' +
    '.pal-tit{font-family:Orbitron,sans-serif;font-size:13px;font-weight:700;letter-spacing:3px;color:var(--green,#00ff88)}' +
    '.pal-st{font-family:"Share Tech Mono",monospace;font-size:12px;letter-spacing:1px;padding:4px 9px;border-radius:3px;border:1px solid}' +
    '.pal-st.ok{color:#00ff88;border-color:rgba(0,255,136,.5);background:rgba(0,255,136,.08)}.pal-st.off{color:#ffb300;border-color:rgba(255,179,0,.45)}' +
    '.pal-c{padding:16px}' +
    '.pal-p{font-size:16px;line-height:1.5;margin:0 0 12px}' +
    '.pal-tipos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:0 0 14px}' +
    '.pal-t{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--border,#1a3d2a);border-radius:6px;cursor:pointer;background:rgba(0,0,0,.2);transition:border-color .15s}' +
    '.pal-t:hover{border-color:#00cc6a}.pal-t input{margin-top:4px;width:18px;height:18px;accent-color:#00ff88;flex:none}' +
    '.pal-t b{display:block;font-size:16px;color:#e8fff4}.pal-t small{display:block;font-size:13.5px;color:#8fc4a9;line-height:1.35;margin-top:2px}' +
    '.pal-uf{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px;font-size:15px}' +
    '.pal-uf select{background:#050a08;border:1px solid var(--border,#1a3d2a);color:#c8fce8;font-family:"Share Tech Mono",monospace;font-size:14px;padding:7px 10px;border-radius:3px}' +
    '.pal-acoes{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '.pal-b{font-family:Orbitron,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;padding:11px 16px;border-radius:3px;cursor:pointer;border:1px solid #00cc6a;background:rgba(0,255,136,.1);color:#00ff88}' +
    '.pal-b.p{background:#00ff88;color:#000;box-shadow:0 0 18px rgba(0,255,136,.3)}.pal-b.g{border-color:var(--border,#1a3d2a);background:none;color:#8fc4a9}' +
    '.pal-b:disabled{opacity:.5;cursor:default}' +
    '.pal-msg{font-family:"Share Tech Mono",monospace;font-size:13px;margin-top:10px;line-height:1.6;min-height:1px}' +
    '.pal-aviso{border-left:3px solid #ffb300;background:rgba(255,179,0,.06);padding:10px 12px;border-radius:3px;font-size:15px;line-height:1.55;margin:0 0 12px}' +
    '.pal-aviso ol{margin:6px 0 0 20px}' +
    '.pal-hist{margin-top:16px;border-top:1px dashed var(--border,#1a3d2a);padding-top:12px}' +
    '.pal-hist h4{font-family:"Share Tech Mono",monospace;font-size:12px;letter-spacing:2px;color:#4a7a60;font-weight:400;margin:0 0 8px}' +
    '.pal-h{display:flex;gap:10px;font-size:14.5px;line-height:1.4;padding:5px 0}.pal-h time{font-family:"Share Tech Mono",monospace;font-size:12px;color:#4a7a60;white-space:nowrap;padding-top:2px}' +
    '.pal-h b{color:#e8fff4}';
  document.head.appendChild(css);

  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function suportado() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function ios() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function instalado() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function aparelho() {
    var u = navigator.userAgent, so = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || ios() ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : 'Aparelho';
    var nav = /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /SamsungBrowser/.test(u) ? 'Samsung' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
    return so + (nav ? ' · ' + nav : '');
  }
  function chaveBytes(b64) {
    var s = (b64 + '===='.slice(b64.length % 4)).replace(/-/g, '+').replace(/_/g, '/'), bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function chamar(rota, corpo) {
    return user.getIdToken().then(function (tk) {
      return fetch(API + rota, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify(corpo || {}) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || ('Erro ' + r.status)); return j; });
    }).catch(function (e) {
      if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) throw new Error('Sem conexão com o servidor de alertas. Tente de novo.');
      throw e;
    });
  }
  function registro() { return navigator.serviceWorker.register(SW).then(function () { return navigator.serviceWorker.ready; }); }
  function assinaturaAtual() {
    if (!suportado()) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration().then(function (r) { return r ? r.pushManager.getSubscription() : null; }).catch(function () { return null; });
  }
  function prefsDaTela() {
    var p = {};
    TIPOS.forEach(function (t) { var c = $('pal-' + t.k); if (c) p[t.k] = c.checked; });
    var uf = $('pal-uf'); if (uf) p.uf = uf.value;
    return p;
  }
  function msg(t, cor) { var m = $('pal-msg'); if (m) { m.style.color = cor || '#8fc4a9'; m.innerHTML = t; } }

  // ── telas ──
  function htmlTipos() {
    var p = (estado && estado.prefs) || {};
    return '<div class="pal-tipos">' + TIPOS.filter(function (t) { return !t.so || t.so.indexOf(nivel) !== -1; }).map(function (t) {
      return '<label class="pal-t"><input type="checkbox" id="pal-' + t.k + '"' + (p[t.k] !== false ? ' checked' : '') + '><span><b>' + t.ic + ' ' + t.n + '</b><small>' + t.d + '</small></span></label>';
    }).join('') + '</div>' +
      '<div class="pal-uf"><span>📍 Seu estado (para avisos regionais):</span><select id="pal-uf"><option value="">Não informar (recebo todos)</option>' +
      UFS.map(function (u) { return '<option' + (p.uf === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div>';
  }
  function desenhar() {
    var box = $('alertas'); if (!box) return;
    if (!user) { box.innerHTML = ''; return; }
    var cab = function (st) { return '<div class="pal-cab"><span class="pal-tit">🔔 ALERTAS PUSH</span>' + (st || '') + '</div>'; };
    if (!estado) { box.innerHTML = '<div class="pal">' + cab() + '<div class="pal-c"><p class="pal-p">▋ Carregando seus alertas...</p></div></div>'; return; }
    var corpo = '';
    if (!suportado() && ios() && !instalado()) {
      corpo = '<div class="pal-aviso"><b>No iPhone e iPad, os alertas só funcionam com o PREPPERS BR na Tela de Início:</b><ol>' +
        '<li>Abra este site no <b>Safari</b> e toque em <b>Compartilhar</b> (o quadrado com a seta ↑).</li>' +
        '<li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>' +
        '<li>Abra o PREPPERS BR <b>pelo ícone da máscara</b> na Tela de Início, entre em Membros e ative aqui.</li></ol>' +
        '<small style="color:#8fc4a9">Precisa do iOS 16.4 ou mais novo.</small>' +
        (window.PBRInstalar ? '<div style="margin-top:10px"><button class="pal-b p" type="button" onclick="PBRInstalar.abrir()">📲 VER COMO INSTALAR</button></div>' : '') + '</div>';
    } else if (!suportado()) {
      corpo = '<div class="pal-aviso">Este navegador não recebe alertas push. Use o <b>Chrome</b>, <b>Edge</b>, <b>Firefox</b> ou <b>Safari</b> atualizados.</div>';
    } else if (Notification.permission === 'denied') {
      corpo = '<div class="pal-aviso"><b>As notificações do PREPPERS BR estão bloqueadas neste navegador.</b><br>Toque no <b>cadeado 🔒</b> ao lado do endereço do site → <b>Notificações</b> → <b>Permitir</b>, e recarregue a página.' +
        (ios() ? '<br>No iPhone: <b>Ajustes → Notificações → PREPPERS BR</b> → Permitir.' : '') + '</div>' + htmlTipos();
    } else {
      corpo = (assinado ? '<p class="pal-p">Este aparelho recebe os alertas marcados abaixo. As mudanças são salvas na hora.</p>'
        : '<p class="pal-p">Escolha o que quer receber e ative. Os alertas chegam como notificação do sistema, <b>mesmo com o site fechado</b>.</p>') +
        htmlTipos() + '<div class="pal-acoes">' +
        (assinado ? '<button class="pal-b" id="pal-teste">📨 ENVIAR TESTE</button><button class="pal-b g" id="pal-desligar">DESATIVAR NESTE APARELHO</button>'
          : '<button class="pal-b p" id="pal-ligar">🔔 ATIVAR ALERTAS NESTE APARELHO</button>') + '</div>';
    }
    var nAp = estado.aparelhos || 0;
    var outros = assinado ? nAp - 1 : nAp;
    box.innerHTML = '<div class="pal' + (assinado ? ' on' : '') + '">' + cab(assinado ? '<span class="pal-st ok">● ATIVOS NESTE APARELHO</span>' : '<span class="pal-st off">DESLIGADOS NESTE APARELHO</span>') +
      '<div class="pal-c">' + corpo + '<div class="pal-msg" id="pal-msg">' + (outros > 0 ? 'Também ativos em mais ' + outros + ' aparelho' + (outros > 1 ? 's' : '') + ' seu' + (outros > 1 ? 's' : '') + '.' : '') + '</div>' + hist() + '</div></div>';
    var b;
    if ((b = $('pal-ligar'))) b.onclick = ligar;
    if ((b = $('pal-teste'))) b.onclick = teste;
    if ((b = $('pal-desligar'))) b.onclick = desligar;
    TIPOS.forEach(function (t) { var c = $('pal-' + t.k); if (c) c.onchange = salvarPrefs; });
    if ((b = $('pal-uf'))) b.onchange = salvarPrefs;
    if (ultimo) msg(ultimo[0], ultimo[1]);
    if (location.hash === '#alertas' && !desenhar.rolou) { desenhar.rolou = true; setTimeout(function () { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300); }
  }
  var historico = null;
  function hist() {
    if (!historico || !historico.length) return '';
    return '<div class="pal-hist"><h4>ÚLTIMOS ALERTAS ENVIADOS</h4>' + historico.slice(0, 5).map(function (a) {
      var d = new Date(a.ts);
      return '<div class="pal-h"><time>' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</time><span><b>' + esc(a.titulo) + '</b> — ' + esc(a.texto) + (a.uf ? ' <small>(' + esc(a.uf) + ')</small>' : '') + '</span></div>';
    }).join('') + '</div>';
  }

  // ── ações ──
  function ligar() {
    if (ocupado) return; ocupado = true;
    var b = $('pal-ligar'); if (b) { b.disabled = true; b.textContent = 'ATIVANDO...'; }
    var prefs = prefsDaTela();
    // o pedido de permissão precisa sair direto do toque no botão (Safari)
    Promise.resolve(Notification.requestPermission()).then(function (perm) {
      if (perm !== 'granted') throw new Error(perm === 'denied' ? 'BLOQUEADO' : 'Você não permitiu as notificações. Toque em ativar de novo e escolha "Permitir".');
      return registro();
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        // assinatura feita com outra chave: refaz
        if (s && s.options && s.options.applicationServerKey) {
          var a = new Uint8Array(s.options.applicationServerKey), c = chaveBytes(estado.chave);
          if (a.length !== c.length || a.some(function (x, i) { return x !== c[i]; })) return s.unsubscribe().then(function () { return null; });
        }
        return s;
      }).then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(estado.chave) }); });
    }).then(function (s) {
      return chamar('/push/registrar', { assinatura: s.toJSON(), prefs: prefs, aparelho: aparelho() });
    }).then(function (j) {
      assinado = true; estado.prefs = j.prefs; estado.aparelhos = j.aparelhos;
      ultimo = ['✅ Alertas ativados! Enviamos um teste: ele deve aparecer em alguns segundos.', '#00ff88'];
      desenhar();
      return chamar('/push/teste').catch(function () {});
    }).catch(function (e) {
      ultimo = [e.message === 'BLOQUEADO' ? '' : '⚠️ ' + esc(e.message), '#ff6b6b'];
      desenhar();
    }).then(function () { ocupado = false; });
  }
  function salvarPrefs() {
    var p = prefsDaTela();
    if (!assinado) { estado.prefs = Object.assign({}, estado.prefs, p); return; }
    msg('Salvando...');
    chamar('/push/prefs', { prefs: p }).then(function (j) { estado.prefs = j.prefs; ultimo = ['✓ Preferências salvas.', '#00ff88']; msg(ultimo[0], ultimo[1]); })
      .catch(function (e) { msg('⚠️ ' + esc(e.message), '#ff6b6b'); });
  }
  function teste() {
    var b = $('pal-teste'); b.disabled = true;
    msg('Enviando teste...');
    chamar('/push/teste').then(function (j) {
      ultimo = j.enviados ? ['📨 Teste enviado para ' + j.enviados + ' aparelho' + (j.enviados > 1 ? 's' : '') + '. Se não aparecer, confira se as notificações do navegador estão ligadas no sistema.', '#00ff88']
        : ['⚠️ O teste não foi entregue' + (j.erro ? ' (' + esc(j.erro) + ')' : '') + '. Desative e ative de novo neste aparelho.', '#ffb300'];
      msg(ultimo[0], ultimo[1]);
    }).catch(function (e) { msg('⚠️ ' + esc(e.message), '#ff6b6b'); }).then(function () { b.disabled = false; });
  }
  function desligar() {
    var b = $('pal-desligar'); b.disabled = true;
    assinaturaAtual().then(function (s) {
      if (!s) return;
      var ep = s.endpoint;
      return s.unsubscribe().catch(function () {}).then(function () { return chamar('/push/remover', { endpoint: ep }); });
    }).then(function () {
      assinado = false; estado.aparelhos = Math.max(0, (estado.aparelhos || 1) - 1);
      ultimo = ['Alertas desativados neste aparelho.', '#ffb300']; desenhar();
    }).catch(function (e) { b.disabled = false; msg('⚠️ ' + esc(e.message), '#ff6b6b'); });
  }

  function carregarHist() {
    fetch(API + '/alertas').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.alertas) { historico = j.alertas; desenhar(); }
    }).catch(function () {});
  }

  window.PBRAlertas = {
    mostrar: function (u, lv) {
      var mudou = !user || !u || user.uid !== u.uid || nivel !== lv;
      user = u; nivel = lv || '';
      if (!u) { estado = null; desenhar(); return; }
      if (!mudou) return;
      estado = null; desenhar();
      Promise.all([chamar('/push/estado'), assinaturaAtual()]).then(function (r) {
        estado = r[0]; var s = r[1];
        nivel = estado.nivel || nivel;
        assinado = !!s;
        desenhar();
        // renova o registro deste aparelho a cada visita (o navegador às vezes troca o endereço de entrega)
        if (s && !recarregou && Notification.permission === 'granted') {
          recarregou = true;
          chamar('/push/registrar', { assinatura: s.toJSON(), aparelho: aparelho() }).then(function (j) { estado.aparelhos = j.aparelhos; }).catch(function () {});
        }
      }).catch(function (e) {
        estado = { prefs: {}, aparelhos: 0, chave: '' }; ultimo = ['⚠️ ' + esc(e.message), '#ff6b6b']; desenhar();
      });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', carregarHist); else carregarHist();
})();
