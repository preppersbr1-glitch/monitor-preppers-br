// Menu do site — PREPPERS BR
// Uso, no <head>:  <script src="menu.js" defer></script>
// Troca o menu de textos do cabeçalho (<nav>) por (no celular a barra vira uma grade de 6 colunas com nomes curtos, campo "c"):
//  · uma BARRA DE BOTÕES logo abaixo do cabeçalho, com todas as abas sempre visíveis (no celular ela desliza para o lado);
//  · o botão ☰ MENU no cabeçalho (fica preso no topo ao rolar), que abre um painel com todas as abas em cartões.
// A lista de abas mora aqui, num lugar só: para criar/renomear uma aba, mude ABAS abaixo.
(function () {
  var script = document.currentScript;
  var BASE = (script && script.src) ? script.src.replace(/menu\.js(\?.*)?$/, '') : '';
  // nivel: publico · sentinela (conta grátis) · operador · comando — só para mostrar o selo; quem bloqueia é o nivel.js
  var ABAS = [
    { href: 'index.html', id: 'index', ic: '📡', t: 'Monitor', d: 'Alertas e ameaças em tempo real', nivel: 'publico' },
    { href: 'defesa-civil.html', id: 'defesa-civil', c: 'D. Civil', ic: '🚨', t: 'Defesa Civil', d: 'Avisos oficiais por região', nivel: 'sentinela' },
    { href: 'solar.html', id: 'solar', ic: '☀️', t: 'Solar', d: 'Tempestades solares e clima espacial', nivel: 'sentinela' },
    { href: 'monitor-global.html', id: 'monitor-global', c: 'Global', ic: '🌍', t: 'Global', d: 'Mapa de ameaças e mercados', nivel: 'operador' },
    { href: 'comunidade.html', id: 'comunidade', c: 'Comunid.', ic: '💬', t: 'Comunidade', d: 'Fórum e bate-papo ao vivo', nivel: 'sentinela' },
    { href: 'cursos.html', id: 'cursos', ic: '🎓', t: 'Cursos', d: 'Treinamentos de sobrevivência', nivel: 'sentinela' },
    { href: 'guia.html', id: 'guia', ic: '📕', t: 'Guia', d: 'Guia Definitivo de Preparação', nivel: 'publico', cor: 'ambar' },
    { href: 'dispositivo.html', id: 'dispositivo', c: 'Rádio', ic: '📻', t: 'Dispositivo', d: 'Rádio LoRa: mensagens sem internet', nivel: 'sentinela' },
    { href: 'jogo/', id: 'jogo', ic: '🎮', t: 'Jogo', d: 'Zona Morta: RPG de sobrevivência', nivel: 'sentinela' },
    { href: 'mentoria.html', id: 'mentoria', c: 'Mentor', ic: '🎖️', t: 'Mentoria', d: 'Fale direto com o fundador', nivel: 'comando', cor: 'ambar' },
    { href: 'membros.html', id: 'membros', c: 'Membros', ic: '🏅', t: 'Membros', d: 'Sua conta e os planos', nivel: 'publico' }
  ];
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
    '.pm{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;justify-content:flex-end;font-family:Rajdhani,system-ui,sans-serif}' +
    // barra de botões (todas as abas)
    '.pm-barra{position:relative;z-index:90;background:linear-gradient(180deg,rgba(8,17,12,.98),rgba(5,10,8,.96));border-bottom:1px solid #1a3d2a;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.35);font-family:Rajdhani,system-ui,sans-serif}' +
    '.pm-trilho{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:1800px;margin:0 auto;padding:10px 16px}' +
    '.pm-b{display:flex;align-items:center;gap:7px;padding:8px 13px;border-radius:9px;border:1px solid #1d4430;text-decoration:none;white-space:nowrap;' +
      'background:linear-gradient(180deg,#10261b,#0a170f);color:#a8dcc2;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;' +
      'box-shadow:0 2px 0 rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.05);transition:transform .12s,border-color .15s,color .15s,box-shadow .15s,background .15s}' +
    '.pm-b i{font-style:normal;font-size:16px;line-height:1}' +
    '.pm-b:hover{transform:translateY(-1px);color:#00ff88;border-color:#00cc6a;box-shadow:0 4px 14px rgba(0,0,0,.45),0 0 14px rgba(0,255,136,.18),inset 0 1px 0 rgba(255,255,255,.06)}' +
    '.pm-b:active{transform:translateY(1px)}' +
    '.pm-b.on{background:linear-gradient(180deg,#22ff95,#00c766);color:#03170c;border-color:#5dffb4;box-shadow:0 0 18px rgba(0,255,136,.35),inset 0 1px 0 rgba(255,255,255,.35)}' +
    '.pm-b.ambar{color:#ffc23d;border-color:rgba(255,179,0,.4);background:linear-gradient(180deg,#2a2210,#17120a)}' +
    '.pm-b.ambar:hover{color:#ffd166;border-color:#ffb300;box-shadow:0 4px 14px rgba(0,0,0,.45),0 0 14px rgba(255,179,0,.22)}' +
    '.pm-b.ambar.on{background:linear-gradient(180deg,#ffcf4d,#f0a000);color:#1d1300;border-color:#ffe08a;box-shadow:0 0 18px rgba(255,179,0,.4)}' +
    '@media(max-width:1440px){.pm-trilho{gap:6px}.pm-b{padding:7px 10px;font-size:14px;letter-spacing:.6px}}' +
    '.pm-b .tc{display:none}' +
    // tablet: botões menores, quebrando em duas linhas · celular: grade de 6 colunas (ícone em cima, nome curto embaixo)
    '@media(max-width:900px){.pm-trilho{gap:6px;padding:9px 12px}.pm-b{padding:7px 10px;font-size:13px}}' +
    '@media(max-width:600px){.pm-trilho{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;padding:8px 8px 9px}' +
      '.pm-b{flex-direction:column;justify-content:center;gap:3px;padding:6px 2px 5px;border-radius:8px;font-size:9.5px;letter-spacing:.2px;min-width:0;text-align:center}' +
      '.pm-b i{font-size:18px}.pm-b .tl{display:none}.pm-b .tc{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis}}' +
    '@media(max-width:360px){.pm-b{font-size:8.5px}.pm-b i{font-size:16px}}' +
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
    // celular/tablet: cabeçalho numa linha só (logo + ☰ MENU)
    '@media(min-width:981px){header{flex-wrap:nowrap!important}}' +
    '@media(max-width:980px){.pm{flex:0 1 auto}}' +
    '@media(max-width:980px){header{flex-wrap:nowrap!important;height:auto!important;min-height:56px;padding-top:8px!important;padding-bottom:8px!important}header .header-status{display:none!important}' +
      'header .logo{min-width:0!important;flex:0 1 auto!important;overflow:hidden!important}header .logo>div{min-width:0!important;overflow:hidden!important}header .logo-text,header .logo-sub{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.pm{flex:none!important}}' +
    '@media(max-width:520px){.pm-btn{padding:9px 12px}.pm-grade{grid-template-columns:1fr 1fr;gap:8px}.pm-pain{top:8px;padding:14px 12px}' +
      '.pm-c{flex-direction:column;gap:8px;padding:11px}.pm-c .ic{width:40px;height:40px;font-size:21px}.pm-c .n{font-size:11px;letter-spacing:1.5px}.pm-c .d{font-size:13px}}';
  document.head.appendChild(css);

  function montar() {
    var velho = document.querySelector('header nav, header .links');
    if (!velho) return;

    var pm = document.createElement('div');
    pm.className = 'pm';
    pm.innerHTML = '<button class="pm-btn" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="pm-painel"><b aria-hidden="true"><span></span><span></span><span></span></b>MENU</button>';
    velho.parentNode.replaceChild(pm, velho);

    // barra de botões logo abaixo do cabeçalho
    var barra = document.createElement('div');
    barra.className = 'pm-barra'; barra.setAttribute('role', 'navigation'); barra.setAttribute('aria-label', 'Menu principal');
    barra.innerHTML = '<div class="pm-trilho">' + ABAS.map(function (a) {
      return '<a class="pm-b' + (a.cor ? ' ' + a.cor : '') + (a.id === atual ? ' on' : '') + '" href="' + BASE + a.href + '"' + (a.id === atual ? ' aria-current="page"' : '') +
        ' title="' + esc(a.d) + '"><i aria-hidden="true">' + a.ic + '</i><span class="tl">' + esc(a.t) + '</span><span class="tc" aria-hidden="true">' + esc(a.c || a.t) + '</span></a>';
    }).join('') + '</div>';
    var header = pm.closest('header') || document.querySelector('header');
    header.parentNode.insertBefore(barra, header.nextSibling);
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
