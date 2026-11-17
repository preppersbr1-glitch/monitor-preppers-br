// Menu do site — PREPPERS BR
// Uso, no <head>:  <script src="menu.js" defer></script>
// Troca o menu de textos do cabeçalho (<nav>) por: abas com ícone (no computador) + botão ☰ MENU que abre um
// painel com TODAS as abas em cartões (ícone, nome, descrição e o plano necessário). No celular fica só o botão.
// A lista de abas mora aqui, num lugar só: para criar/renomear uma aba, mude ABAS abaixo.
(function () {
  var script = document.currentScript;
  var BASE = (script && script.src) ? script.src.replace(/menu\.js(\?.*)?$/, '') : '';
  // nivel: publico · sentinela (conta grátis) · operador · comando — só para mostrar o selo; quem bloqueia é o nivel.js
  // topo: 1 = aparece no cabeçalho do computador · 2 = só em telas largas · 0 = só no painel
  var ABAS = [
    { href: 'index.html', id: 'index', ic: '📡', t: 'Monitor', d: 'Alertas e ameaças em tempo real', nivel: 'publico', topo: 1 },
    { href: 'defesa-civil.html', id: 'defesa-civil', ic: '🚨', t: 'Defesa Civil', d: 'Avisos oficiais por região', nivel: 'sentinela', topo: 1 },
    { href: 'solar.html', id: 'solar', ic: '☀️', t: 'Solar', d: 'Tempestades solares e clima espacial', nivel: 'sentinela', topo: 1 },
    { href: 'monitor-global.html', id: 'monitor-global', ic: '🌍', t: 'Global', d: 'Mapa de ameaças e mercados', nivel: 'operador', topo: 1 },
    { href: 'comunidade.html', id: 'comunidade', ic: '💬', t: 'Comunidade', d: 'Fórum e bate-papo ao vivo', nivel: 'sentinela', topo: 2 },
    { href: 'cursos.html', id: 'cursos', ic: '🎓', t: 'Cursos', d: 'Treinamentos de sobrevivência', nivel: 'sentinela', topo: 1 },
    { href: 'guia.html', id: 'guia', ic: '📕', t: 'Guia', d: 'Guia Definitivo de Preparação', nivel: 'publico', topo: 1, cor: 'ambar' },
    { href: 'dispositivo.html', id: 'dispositivo', ic: '📻', t: 'Dispositivo', d: 'Rádio LoRa: mensagens sem internet', nivel: 'sentinela', topo: 2 },
    { href: 'jogo/', id: 'jogo', ic: '🎮', t: 'Jogo', d: 'Zona Morta: RPG de sobrevivência', nivel: 'sentinela', topo: 0 },
    { href: 'mentoria.html', id: 'mentoria', ic: '🎖️', t: 'Mentoria', d: 'Fale direto com o fundador', nivel: 'comando', topo: 0, cor: 'ambar' },
    { href: 'membros.html', id: 'membros', ic: '🏅', t: 'Membros', d: 'Sua conta e os planos', nivel: 'publico', topo: 1 }
  ];
  // quando falta espaço no cabeçalho do computador, as abas saem nesta ordem (continuam no painel ☰ MENU)
  var SAI_PRIMEIRO = ['dispositivo', 'comunidade', 'solar', 'defesa-civil', 'global', 'guia', 'cursos', 'membros', 'index'];
  var SELO = { sentinela: 'CONTA GRÁTIS', operador: '⭐ OPERADOR', comando: '🎖️ COMANDO' };

  // página atual (as aulas contam como Cursos; o rádio como Dispositivo)
  var arq = location.pathname.split('/').filter(Boolean);
  var atual = (arq[arq.length - 1] || 'index.html').replace(/\.html$/, '');
  if (/^curso-/.test(atual)) atual = 'cursos';
  if (atual === 'radio') atual = 'dispositivo';
  if (/^jogo/.test(arq[arq.length - 2] || '') || /^jogo/.test(atual)) atual = 'jogo';

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = document.createElement('style');
  css.textContent =
    '.pm{display:flex;align-items:center;gap:4px;min-width:0;flex:1 1 auto;justify-content:center;font-family:Rajdhani,system-ui,sans-serif}' +
    '.pm-a{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:5px;border:1px solid transparent;color:#7fb79a;text-decoration:none;' +
      'font-size:15px;font-weight:600;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;position:relative;transition:color .15s,background .15s,border-color .15s}' +
    '.pm-a i{font-style:normal;font-size:15px;line-height:1;filter:saturate(.8)}' +
    '.pm-a:hover{color:#00ff88;background:rgba(0,255,136,.06);border-color:#0b4a2c}' +
    '.pm-a.on{color:#00ff88;background:rgba(0,255,136,.1);border-color:#00cc6a;box-shadow:0 0 14px rgba(0,255,136,.15) inset}' +
    '.pm-a.on::after{content:"";position:absolute;left:12px;right:12px;bottom:-7px;height:2px;border-radius:2px;background:#00ff88;box-shadow:0 0 8px #00ff88}' +
    '.pm-a.ambar{color:#ffb300}.pm-a.ambar:hover,.pm-a.ambar.on{color:#ffc940;background:rgba(255,179,0,.08);border-color:rgba(255,179,0,.45)}' +
    '.pm-btn{display:flex;align-items:center;gap:8px;margin-left:6px;padding:8px 14px;border-radius:5px;border:1px solid #00cc6a;background:rgba(0,255,136,.08);color:#00ff88;' +
      'font-family:Orbitron,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;cursor:pointer;white-space:nowrap;transition:background .15s,box-shadow .15s}' +
    '.pm-btn:hover{background:rgba(0,255,136,.16);box-shadow:0 0 16px rgba(0,255,136,.2)}' +
    '.pm-btn b{display:inline-flex;flex-direction:column;gap:3px;width:16px}.pm-btn b span{display:block;height:2px;border-radius:2px;background:currentColor;transition:transform .25s,opacity .2s}' +
    '.pm-aqui{display:none;font-family:"Share Tech Mono",monospace;font-size:12px;letter-spacing:1.5px;color:#7fb79a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}' +
    // painel com todas as abas
    '.pm-fundo{position:fixed;inset:0;z-index:3000;background:rgba(2,6,4,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;visibility:hidden;transition:opacity .2s,visibility .2s}' +
    '.pm-fundo.on{opacity:1;visibility:visible}' +
    '.pm-pain{position:absolute;top:14px;left:50%;width:min(940px,calc(100% - 24px));max-height:calc(100% - 28px);overflow-y:auto;transform:translate(-50%,-14px);transition:transform .25s;' +
      'background:linear-gradient(180deg,#0b1912,#070f0b);border:1px solid #1a3d2a;border-radius:10px;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 0 1px rgba(0,255,136,.05);padding:18px 18px 16px;' +
      'font-family:Rajdhani,system-ui,sans-serif;color:#c8fce8}' +
    '.pm-fundo.on .pm-pain{transform:translate(-50%,0)}' +
    '.pm-cab{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px}' +
    '.pm-tit{font-family:Orbitron,sans-serif;font-size:14px;font-weight:900;letter-spacing:4px;color:#00ff88}' +
    '.pm-tit small{display:block;font-family:"Share Tech Mono",monospace;font-size:11px;font-weight:400;letter-spacing:2px;color:#4a7a60;margin-top:3px}' +
    '.pm-x{width:42px;height:42px;border-radius:50%;border:1px solid #1a3d2a;background:none;color:#7fb79a;font-size:22px;cursor:pointer;flex:none}' +
    '.pm-x:hover{color:#00ff88;border-color:#00cc6a}' +
    '.pm-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}' +
    '.pm-c{display:flex;gap:12px;align-items:flex-start;padding:13px;border-radius:8px;border:1px solid #163524;background:rgba(10,22,16,.85);text-decoration:none;color:#c8fce8;position:relative;' +
      'transition:transform .15s,border-color .15s,box-shadow .15s,background .15s}' +
    '.pm-c:hover{transform:translateY(-2px);border-color:#00cc6a;background:rgba(0,255,136,.06);box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 18px rgba(0,255,136,.12)}' +
    '.pm-c .ic{flex:none;width:44px;height:44px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:23px;' +
      'background:radial-gradient(circle at 30% 25%,rgba(0,255,136,.22),rgba(0,255,136,.04));border:1px solid rgba(0,255,136,.22)}' +
    '.pm-c .tx{min-width:0}' +
    '.pm-c .n{display:block;font-family:Orbitron,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;color:#e8fff4;text-transform:uppercase}' +
    '.pm-c .d{display:block;font-size:15px;line-height:1.3;color:#8fc4a9;margin-top:3px}' +
    '.pm-c .s{display:inline-block;white-space:nowrap;margin-top:7px;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:1.5px;padding:2px 7px;border-radius:3px;' +
      'color:#00cc6a;border:1px solid rgba(0,204,106,.35)}' +
    '.pm-c .s.operador{color:#00aaff;border-color:rgba(0,170,255,.4)}.pm-c .s.comando{color:#ffb300;border-color:rgba(255,179,0,.45)}' +
    '.pm-c.on{border-color:#00ff88;background:rgba(0,255,136,.09)}' +
    '.pm-c .s.aqui{color:#00ff88;border-color:#00ff88;background:rgba(0,255,136,.1)}' +
    '.pm-c.ambar .ic{background:radial-gradient(circle at 30% 25%,rgba(255,179,0,.25),rgba(255,179,0,.04));border-color:rgba(255,179,0,.35)}' +
    '.pm-c.ambar:hover{border-color:#ffb300;box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 18px rgba(255,179,0,.14)}' +
    '.pm-rod{margin-top:14px;padding-top:12px;border-top:1px solid #12301f;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:1.5px;color:#4a7a60;text-align:center}' +
    'body.pm-trava{overflow:hidden}' +
    // computador médio: menos abas no topo · celular/tablet: só o botão (o painel faz o resto)
    '.pm-a.fora{display:none}' +
    '@media(min-width:981px){header{flex-wrap:nowrap!important}}' +
    '@media(max-width:1180px){.pm-a{padding:7px 8px;font-size:14px;letter-spacing:.5px}.pm-a i{display:none}}' +
    '@media(max-width:980px){.pm .pm-a{display:none}.pm{flex:0 1 auto;justify-content:flex-end;gap:10px}.pm-aqui{display:block}}' +
    '@media(max-width:980px){header{flex-wrap:nowrap!important;height:auto!important;min-height:56px;padding-top:8px!important;padding-bottom:8px!important}header .header-status{display:none!important}' +
      'header .logo{min-width:0;flex:0 1 auto}header .logo-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}' +
    '@media(max-width:520px){.pm-aqui{display:none}.pm-btn{padding:9px 12px}.pm-grade{grid-template-columns:1fr 1fr;gap:8px}.pm-pain{top:8px;padding:14px 12px}' +
      '.pm-c{flex-direction:column;gap:8px;padding:11px}.pm-c .ic{width:40px;height:40px;font-size:21px}.pm-c .n{font-size:11px;letter-spacing:1.5px}.pm-c .d{font-size:13px}}';
  document.head.appendChild(css);

  function montar() {
    var velho = document.querySelector('header nav, header .links');
    if (!velho) return;
    var aqui = ABAS.filter(function (a) { return a.id === atual; })[0];

    var pm = document.createElement('div');
    pm.className = 'pm'; pm.setAttribute('role', 'navigation'); pm.setAttribute('aria-label', 'Menu principal');
    pm.innerHTML = ABAS.filter(function (a) { return a.topo; }).map(function (a) {
      return '<a data-id="' + a.id + '" class="pm-a' + (a.topo === 2 ? ' p2' : '') + (a.cor ? ' ' + a.cor : '') + (a.id === atual ? ' on' : '') + '" href="' + BASE + a.href + '"' +
        (a.id === atual ? ' aria-current="page"' : '') + '><i aria-hidden="true">' + a.ic + '</i>' + esc(a.t) + '</a>';
    }).join('') +
      (aqui ? '<span class="pm-aqui">' + aqui.ic + ' ' + esc(aqui.t.toUpperCase()) + '</span>' : '') +
      '<button class="pm-btn" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="pm-painel"><b aria-hidden="true"><span></span><span></span><span></span></b>MENU</button>';
    velho.parentNode.replaceChild(pm, velho);

    var fundo = document.createElement('div');
    fundo.className = 'pm-fundo'; fundo.id = 'pm-painel';
    fundo.setAttribute('role', 'dialog'); fundo.setAttribute('aria-modal', 'true'); fundo.setAttribute('aria-label', 'Todas as abas do site');
    fundo.innerHTML = '<div class="pm-pain"><div class="pm-cab"><div class="pm-tit">NAVEGAÇÃO<small>TODAS AS ABAS DO PREPPERS BR</small></div>' +
      '<button class="pm-x" type="button" aria-label="Fechar menu">×</button></div><div class="pm-grade">' +
      ABAS.map(function (a) {
        return '<a class="pm-c' + (a.cor ? ' ' + a.cor : '') + (a.id === atual ? ' on' : '') + '" href="' + BASE + a.href + '"' + (a.id === atual ? ' aria-current="page"' : '') + '>' +
          '<span class="ic" aria-hidden="true">' + a.ic + '</span><span class="tx"><span class="n">' + esc(a.t) + '</span><span class="d">' + esc(a.d) + '</span>' +
          (a.id === atual ? '<span class="s aqui">● VOCÊ ESTÁ AQUI</span>' : SELO[a.nivel] ? '<span class="s ' + a.nivel + '">' + SELO[a.nivel] + '</span>' : '') + '</span></a>';
      }).join('') + '</div><div class="pm-rod">🔓 CONTA GRÁTIS · ⭐ OPERADOR · 🎖️ COMANDO — veja os planos em Membros</div></div>';
    document.body.appendChild(fundo);

    // mostra no cabeçalho só as abas que cabem, sem passar da borda da tela
    function caber() {
      var abas = pm.querySelectorAll('.pm-a');
      abas.forEach(function (a) { a.classList.remove('fora'); });
      if (getComputedStyle(abas[0] || pm).display === 'none') return;   // celular: só o botão
      var doc = document.documentElement;
      function passa() { return pm.scrollWidth > pm.clientWidth + 1 || doc.scrollWidth > doc.clientWidth + 1; }
      for (var i = 0; i < SAI_PRIMEIRO.length && passa(); i++) {
        var id = SAI_PRIMEIRO[i] === 'global' ? 'monitor-global' : SAI_PRIMEIRO[i];
        var a = pm.querySelector('.pm-a[data-id="' + id + '"]');
        if (a && id !== atual) a.classList.add('fora');
      }
    }
    caber();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(caber);
    var tmr; addEventListener('resize', function () { clearTimeout(tmr); tmr = setTimeout(caber, 120); });

    var btn = pm.querySelector('.pm-btn'), ultimoFoco = null;
    function abrir() {
      ultimoFoco = document.activeElement;
      fundo.classList.add('on'); document.body.classList.add('pm-trava'); btn.setAttribute('aria-expanded', 'true');
      setTimeout(function () { var c = fundo.querySelector('.pm-c.on') || fundo.querySelector('.pm-c'); if (c) c.focus({ preventScroll: true }); }, 60);
    }
    function fechar() {
      if (!fundo.classList.contains('on')) return;
      fundo.classList.remove('on'); document.body.classList.remove('pm-trava'); btn.setAttribute('aria-expanded', 'false');
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
    }
    btn.addEventListener('click', abrir);
    fundo.querySelector('.pm-x').addEventListener('click', fechar);
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(); });
    // ao escolher uma aba o painel fecha (no Rádio a página abre por cima e o painel não pode ficar aberto)
    fundo.querySelectorAll('.pm-c').forEach(function (a) { a.addEventListener('click', function () { setTimeout(fechar, 0); }); });
    document.addEventListener('keydown', function (e) {
      if (!fundo.classList.contains('on')) return;
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key === 'Tab') {   // mantém o Tab dentro do painel
        var f = fundo.querySelectorAll('a,button'), p = f[0], u = f[f.length - 1];
        if (e.shiftKey && document.activeElement === p) { e.preventDefault(); u.focus(); }
        else if (!e.shiftKey && document.activeElement === u) { e.preventDefault(); p.focus(); }
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
