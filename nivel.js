// Controle de acesso por nível — PREPPERS BR
// Uso, no <head> da página:  <script src="nivel.js" data-nivel="sentinela"></script>
//   data-nivel: sentinela (conta grátis) · operador · comando · admin
// A página fica escondida até conferir o login e o nível (members/<uid>/level no Firebase).
// Conteúdo pago de verdade NÃO fica no HTML (o repositório é público): a página marca um elemento com
// data-conteudo="<slug>" e este script busca cursos/<slug> no banco, que só entrega a quem tem o nível.
(function () {
  var script = document.currentScript;
  var NEED = (script && script.dataset.nivel) || 'sentinela';
  var RANK = { visitante: 0, sentinela: 1, operador: 2, comando: 3, admin: 9 };
  var NAMES = { sentinela: 'SENTINELA (conta grátis)', operador: 'OPERADOR', comando: 'COMANDO', admin: 'ADMIN' };
  var ADMIN_EMAIL = 'preppersbr1@gmail.com';
  var CONFIG = {
    apiKey: 'AIzaSyDFD02ywD0i_lTHwgJ8BRwwb6fwbh3VgC8',
    authDomain: 'comunidade-preppers-br-f5253.firebaseapp.com',
    databaseURL: 'https://comunidade-preppers-br-f5253-default-rtdb.firebaseio.com',
    projectId: 'comunidade-preppers-br-f5253'
  };
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.0/';

  var css = document.createElement('style');
  css.textContent =
    'html.pbr-wait body{visibility:hidden}' +
    '.pbr-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;' +
    'background:#050a08;visibility:visible;font-family:Rajdhani,system-ui,sans-serif;color:#c8fce8}' +
    '.pbr-box{max-width:440px;width:100%;background:#0a1610;border:1px solid #1a3d2a;border-radius:6px;padding:28px 24px;text-align:center}' +
    '.pbr-box .i{font-size:38px;margin-bottom:8px}' +
    '.pbr-box h2{font-family:Orbitron,sans-serif;font-size:15px;letter-spacing:3px;color:#00ff88;margin:0 0 10px}' +
    '.pbr-box p{font-size:15px;line-height:1.6;margin:0 0 18px;color:#c8fce8}' +
    '.pbr-box small{display:block;font-family:"Share Tech Mono",monospace;font-size:10px;color:#4a7a60;letter-spacing:1px;margin-top:14px}' +
    '.pbr-btn{display:inline-block;margin:4px;padding:11px 18px;border-radius:3px;font-family:"Share Tech Mono",monospace;font-size:12px;letter-spacing:1px;text-decoration:none;cursor:pointer;border:1px solid #00cc6a}' +
    '.pbr-btn.p{background:#00ff88;color:#000;font-weight:bold}.pbr-btn.g{background:transparent;color:#00ff88}';
  document.head.appendChild(css);
  document.documentElement.classList.add('pbr-wait');

  var resolveReady;
  window.PBR = { need: NEED, ready: new Promise(function (r) { resolveReady = r; }) };

  function back() { return encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash); }
  function gate(icon, title, text, buttons, note) {
    function show() {
      var g = document.createElement('div');
      g.className = 'pbr-gate';
      g.innerHTML = '<div class="pbr-box"><div class="i">' + icon + '</div><h2>' + title + '</h2><p>' + text + '</p>' + buttons +
        (note ? '<small>' + note + '</small>' : '') + '</div>';
      document.body.appendChild(g);
    }
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
  function open() { document.documentElement.classList.remove('pbr-wait'); }

  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('não carregou ' + src)); };
      document.head.appendChild(s);
    });
  }
  function sdk() {
    var p = Promise.resolve();
    if (!window.firebase || !firebase.initializeApp) p = p.then(function () { return load(SDK + 'firebase-app-compat.js'); });
    return p.then(function () { return firebase.auth ? null : load(SDK + 'firebase-auth-compat.js'); })
      .then(function () { return firebase.database ? null : load(SDK + 'firebase-database-compat.js'); })
      .then(function () { if (!firebase.apps.length) firebase.initializeApp(CONFIG); });
  }

  // Conteúdo protegido: cursos/<slug> no banco (as regras só entregam para Operador, Comando ou admin)
  function loadContent() {
    var el = document.querySelector('[data-conteudo]');
    if (!el) return;
    el.innerHTML = '<p style="padding:30px;text-align:center;font-family:\'Share Tech Mono\',monospace;color:#4a7a60">▋ CARREGANDO CONTEÚDO...</p>';
    firebase.app().database(CONFIG.databaseURL).ref('cursos/' + el.dataset.conteudo).once('value').then(function (s) {
      var v = s.val();
      if (!v || !v.html) { el.innerHTML = '<p style="padding:30px;text-align:center;color:#ffb300">Conteúdo ainda não publicado. Avise o administrador.</p>'; return; }
      el.innerHTML = v.html;
      document.dispatchEvent(new CustomEvent('pbr-conteudo'));
    }, function () {
      el.innerHTML = '<p style="padding:30px;text-align:center;color:#ff3333">Sem permissão para este conteúdo. Seu plano precisa ser Operador ou Comando.</p>';
    });
  }

  var timer = setTimeout(function () {
    gate('📡', 'SEM CONEXÃO', 'Não foi possível conferir seu acesso agora. Verifique a internet e tente de novo.',
      '<a class="pbr-btn p" href="" onclick="location.reload();return false">TENTAR DE NOVO</a>');
  }, 15000);

  sdk().then(function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) {
        clearTimeout(timer);
        gate('🔒', 'ÁREA DE MEMBROS', 'Esta página é exclusiva para membros. Crie sua conta <b>grátis</b> ou entre para continuar.',
          '<a class="pbr-btn p" href="membros.html?entrar=1&volta=' + back() + '">ENTRAR / CRIAR CONTA</a><a class="pbr-btn g" href="index.html">VOLTAR AO INÍCIO</a>',
          'NÍVEL NECESSÁRIO: ' + NAMES[NEED]);
        resolveReady({ user: null, level: 'visitante', ok: false });
        return;
      }
      var isAdmin = (user.email || '').toLowerCase() === ADMIN_EMAIL && user.emailVerified;
      var ref = firebase.app().database(CONFIG.databaseURL).ref('members/' + user.uid);
      ref.once('value').then(function (s) {
        var m = s.val();
        if (!m) {   // conta criada pela Comunidade, sem cadastro de membro: vira Sentinela
          m = { name: user.displayName || (user.email || '').split('@')[0], email: user.email || '', level: 'sentinela', createdAt: Date.now() };
          ref.set(m).catch(function () {});
        }
        return m;
      }, function () { return { level: 'sentinela' }; }).then(function (m) {
        clearTimeout(timer);
        var level = isAdmin ? 'admin' : (m.level || 'sentinela');
        // plano pago vencido (paidUntil no passado) volta a valer como Sentinela
        if (!isAdmin && m.paidUntil && m.paidUntil < Date.now() && RANK[level] > 1) level = 'sentinela';
        var ok = (RANK[level] || 0) >= RANK[NEED];
        window.PBR.user = user; window.PBR.level = level;
        if (ok) { open(); loadContent(); }
        else gate('⭐', 'CONTEÚDO ' + NAMES[NEED], 'Seu plano atual é <b>' + (NAMES[level] || level) + '</b>. Este conteúdo faz parte do plano <b>' + NAMES[NEED] + '</b> ou superior.',
          '<a class="pbr-btn p" href="membros.html">VER PLANOS</a><a class="pbr-btn g" href="cursos.html">VOLTAR</a>');
        resolveReady({ user: user, level: level, ok: ok });
      });
    });
  }).catch(function () {
    clearTimeout(timer);
    gate('📡', 'SEM CONEXÃO', 'Não foi possível carregar o sistema de login. Verifique a internet e tente de novo.',
      '<a class="pbr-btn p" href="" onclick="location.reload();return false">TENTAR DE NOVO</a>');
  });
})();
