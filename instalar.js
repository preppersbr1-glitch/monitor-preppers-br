// "Instalar o app" do PREPPERS BR.
// Uso, no <head> (depois do menu.js):  <script src="instalar.js" defer></script>
// - iPhone/iPad: a Apple não deixa o site abrir o aviso de instalação. Mostramos um cartão com o
//   passo a passo (Compartilhar → Adicionar à Tela de Início), com setas apontando para o botão certo.
// - Android/computador (Chrome, Edge, Samsung): usa o aviso de instalação do próprio navegador.
// - Já aberto como app: não mostra nada. Fechar o cartão esconde por 14 dias.
// Também põe o botão "📲 INSTALAR APP" no painel do ☰ MENU.
(function () {
  if (window.top !== window) return;   // dentro do Rádio (página aberta por cima)
  var script = document.currentScript;
  var BASE = (script && script.src) ? script.src.replace(/instalar\.js(\?.*)?$/, '') : '';
  var CHAVE = 'pbr-instalar-fechado', PAUSA = 14 * 864e5;
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var ipad = ios && !/iPhone|iPod/.test(ua);
  var instalado = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  var dentroDeApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|Twitter|LinkedInApp|GSA\//.test(ua);
  var safariNoIphone = ios && !dentroDeApp;
  var pedido = null;   // aviso de instalação guardado (Android/Chrome)
  // tela de abertura do app no iPhone (sem ela o iOS mostra uma tela branca ao abrir)
  if (ios && !document.querySelector('link[rel="apple-touch-startup-image"]')) {
    [[440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2]].forEach(function (t) {
      var l = document.createElement('link'); l.rel = 'apple-touch-startup-image';
      l.media = '(device-width: ' + t[0] + 'px) and (device-height: ' + t[1] + 'px) and (-webkit-device-pixel-ratio: ' + t[2] + ') and (orientation: portrait)';
      l.href = BASE + 'img/abertura/' + (t[0] * t[2]) + 'x' + (t[1] * t[2]) + '.png';
      document.head.appendChild(l);
    });
  }
  if (instalado) return;

  function ler() { try { return +localStorage.getItem(CHAVE) || 0; } catch (e) { return 0; } }
  function gravar() { try { localStorage.setItem(CHAVE, String(Date.now())); } catch (e) {} }

  var css = document.createElement('style');
  css.textContent =
    '.pin-fundo{position:fixed;inset:0;z-index:3100;background:rgba(2,6,4,.55);opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s}' +
    '.pin-fundo.on{opacity:1;visibility:visible}' +
    '.pin{position:fixed;left:50%;bottom:0;z-index:3101;width:min(460px,100%);transform:translate(-50%,110%);transition:transform .4s cubic-bezier(.2,.9,.3,1.1);' +
      'background:#08120d;border:1px solid #00cc6a;border-bottom:0;border-radius:16px 16px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));' +
      'box-shadow:0 -12px 40px rgba(0,0,0,.6),0 0 30px rgba(0,255,136,.12);font-family:Rajdhani,system-ui,sans-serif;color:#c8fce8;box-sizing:border-box}' +
    '.pin *{box-sizing:border-box}.pin.on{transform:translate(-50%,0)}' +
    '.pin.topo{top:0;bottom:auto;border-radius:0 0 16px 16px;border-top:0;border-bottom:1px solid #00cc6a;padding-top:calc(18px + env(safe-area-inset-top));transform:translate(-50%,-110%)}.pin.topo.on{transform:translate(-50%,0)}' +
    '.pin-x{position:absolute;top:6px;right:6px;width:40px;height:40px;border:0;background:none;color:#4a7a60;font-size:24px;cursor:pointer;border-radius:50%}' +
    '.pin.topo .pin-x{top:calc(6px + env(safe-area-inset-top))}' +
    '.pin-cab{display:flex;gap:13px;align-items:center;margin:0 34px 12px 0}' +
    '.pin-cab img{width:58px;height:58px;border-radius:13px;flex:none;box-shadow:0 4px 14px rgba(0,0,0,.6),0 0 0 1px rgba(0,255,136,.3)}' +
    '.pin-cab b{display:block;font-family:Orbitron,sans-serif;font-size:14px;letter-spacing:2px;color:#00ff88}' +
    '.pin-cab span{display:block;font-size:15px;line-height:1.35;color:#9fd8bf;margin-top:3px}' +
    '.pin ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}' +
    '.pin li{display:flex;gap:11px;align-items:center;font-size:16.5px;line-height:1.35;background:rgba(0,255,136,.04);border:1px solid #163524;border-radius:9px;padding:9px 11px}' +
    '.pin li i{font-style:normal;flex:none;width:26px;height:26px;border-radius:50%;background:#00ff88;color:#000;font-family:Orbitron,sans-serif;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center}' +
    '.pin li b{color:#fff}' +
    '.pin-ic{display:inline-flex;vertical-align:-5px;width:24px;height:24px;border-radius:6px;background:#1c2a24;align-items:center;justify-content:center;margin:0 2px}' +
    '.pin-ic svg{width:17px;height:17px;fill:none;stroke:#3ea6ff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.pin-nota{font-family:"Share Tech Mono",monospace;font-size:11.5px;letter-spacing:.5px;color:#4a7a60;margin-top:10px;line-height:1.5}' +
    '.pin-b{display:block;width:100%;margin-top:12px;padding:13px;border:0;border-radius:6px;background:#00ff88;color:#000;font-family:Orbitron,sans-serif;font-weight:900;font-size:13px;letter-spacing:2px;cursor:pointer;box-shadow:0 0 18px rgba(0,255,136,.3)}' +
    '.pin-seta{position:fixed;z-index:3102;font-size:34px;color:#00ff88;text-shadow:0 0 14px rgba(0,255,136,.8);pointer-events:none;opacity:0;transition:opacity .3s;animation:pinPula 1s ease-in-out infinite}' +
    '.pin-seta.on{opacity:1}' +
    '@keyframes pinPula{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}' +
    '.pin-seta.cima{animation-name:pinSobe}@keyframes pinSobe{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}' +
    // botão no painel do ☰ MENU
    '.pin-menu{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:12px;padding:12px;border-radius:8px;border:1px dashed #00cc6a;background:rgba(0,255,136,.06);' +
      'color:#00ff88;font-family:Orbitron,sans-serif;font-weight:700;font-size:12px;letter-spacing:2px;cursor:pointer}' +
    '.pin-menu:hover{background:rgba(0,255,136,.12)}';
  document.head.appendChild(css);

  var ICONE_COMPARTILHAR = '<span class="pin-ic" aria-label="Compartilhar"><svg viewBox="0 0 24 24"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg></span>';
  var ICONE_MAIS = '<span class="pin-ic" aria-label="Adicionar"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg></span>';
  var ICONE_PONTOS = '<span class="pin-ic" aria-label="Mais opções" style="color:#3ea6ff;font-weight:900;font-size:15px;letter-spacing:1px">···</span>';

  var fundo, cartao, seta;
  function conteudo() {
    var cab = '<div class="pin-cab"><img src="' + BASE + 'apple-touch-icon.png" alt="" width="58" height="58"><div><b>INSTALE O APP</b>' +
      '<span>PREPPERS BR na tela inicial: abre em tela cheia, como um app' + (ios ? ', e recebe alertas push' : ' — e recebe alertas push') + '.</span></div></div>';
    if (ios && dentroDeApp) {
      return cab + '<ol><li><i>1</i><span>Toque nos <b>···</b> ou no ícone de <b>abrir no navegador</b> deste aplicativo.</span></li>' +
        '<li><i>2</i><span>Escolha <b>Abrir no Safari</b>.</span></li><li><i>3</i><span>No Safari, toque em ☰ MENU → <b>📲 INSTALAR APP</b> e siga os passos.</span></li></ol>';
    }
    if (ios) {
      return cab + '<ol>' +
        '<li><i>1</i><span>Toque em ' + ICONE_COMPARTILHAR + ' <b>Compartilhar</b> ' + (ipad ? 'no alto da tela, ao lado do endereço.' : 'na barra do Safari.') +
          ' Se não aparecer, toque antes em ' + ICONE_PONTOS + '.</span></li>' +
        '<li><i>2</i><span>Role a lista e toque em ' + ICONE_MAIS + ' <b>Adicionar à Tela de Início</b>.</span></li>' +
        '<li><i>3</i><span>Toque em <b>Adicionar</b>. Pronto: abra pelo ícone da máscara.</span></li></ol>' +
        '<div class="pin-nota">Funciona no Safari (e no Chrome do iPhone, pelo mesmo botão Compartilhar). Alertas push no iPhone pedem iOS 16.4 ou mais novo.</div>';
    }
    if (pedido) return cab + '<button class="pin-b" type="button" id="pin-instalar">📲 INSTALAR AGORA</button>';
    return cab + '<ol><li><i>1</i><span>Abra o menu do navegador (<b>⋮</b> ou <b>☰</b>).</span></li>' +
      '<li><i>2</i><span>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</span></li></ol>';
  }
  function montar() {
    if (cartao) return;
    fundo = document.createElement('div'); fundo.className = 'pin-fundo';
    cartao = document.createElement('div'); cartao.className = 'pin'; cartao.setAttribute('role', 'dialog'); cartao.setAttribute('aria-label', 'Instalar o app PREPPERS BR');
    seta = document.createElement('div'); seta.className = 'pin-seta'; seta.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fundo); document.body.appendChild(cartao); document.body.appendChild(seta);
    fundo.addEventListener('click', function () { fechar(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cartao.classList.contains('on')) fechar(true); });
  }
  function abrir() {
    montar();
    cartao.innerHTML = '<button class="pin-x" type="button" aria-label="Fechar">×</button>' + conteudo();
    cartao.querySelector('.pin-x').onclick = function () { fechar(true); };
    var b = cartao.querySelector('#pin-instalar');
    if (b) b.onclick = function () {
      var p = pedido; if (!p) return;
      p.prompt();
      p.userChoice.then(function (r) { if (r && r.outcome === 'accepted') { pedido = null; atualizarMenu(); } fechar(false); }).catch(function () { fechar(false); });
    };
    // iPhone: a barra do Safari fica embaixo → cartão no alto e seta para baixo; iPad: botão no alto → cartão embaixo e seta para cima
    var noTopo = safariNoIphone && !ipad;
    cartao.classList.toggle('topo', noTopo);
    if (safariNoIphone) {
      seta.className = 'pin-seta' + (ipad ? ' cima' : '');
      seta.textContent = ipad ? '⬆' : '⬇';
      seta.style.cssText = ipad ? 'top:8px;right:120px' : 'bottom:calc(10px + env(safe-area-inset-bottom));left:calc(50% - 14px)';
    }
    fundo.classList.add('on');
    requestAnimationFrame(function () { cartao.classList.add('on'); if (safariNoIphone) seta.classList.add('on'); });
    window.PBR_INSTALAR_ABERTO = true;
  }
  function fechar(lembrar) {
    if (!cartao) return;
    if (lembrar) gravar();
    cartao.classList.remove('on'); fundo.classList.remove('on'); seta.classList.remove('on');
    window.PBR_INSTALAR_ABERTO = false;
  }
  function disponivel() { return ios || !!pedido; }

  // botão no painel do ☰ MENU
  function atualizarMenu() {
    var pain = document.querySelector('.pm-pain'); if (!pain) return;
    var b = pain.querySelector('.pin-menu');
    if (!disponivel()) { if (b) b.remove(); return; }
    if (b) return;
    b = document.createElement('button'); b.type = 'button'; b.className = 'pin-menu'; b.innerHTML = '📲 INSTALAR APP NA TELA INICIAL';
    b.onclick = function () { var x = document.querySelector('.pm-fundo .pm-x'); if (x) x.click(); setTimeout(abrir, 220); };
    var rod = pain.querySelector('.pm-rod'); pain.insertBefore(b, rod || null);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); pedido = e; atualizarMenu();
    agendar();
  });
  window.addEventListener('appinstalled', function () { pedido = null; atualizarMenu(); fechar(false); gravar(); });

  var agendado = false;
  function agendar() {
    if (agendado || Date.now() - ler() < PAUSA || !disponivel()) return;
    if (!ios && !/Android/.test(ua)) return;   // no computador só pelo menu (o navegador já mostra o ícone de instalar)
    var pg = (location.pathname.split('/').pop() || 'index.html');
    if (/^(guia|admin)\.html$/.test(pg)) return;
    agendado = true;
    setTimeout(function () {
      // não abre por cima de outro painel ou digitação
      if (document.querySelector('.pm-fundo.on') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { agendado = false; return setTimeout(agendar, 15000); }
      abrir();
    }, 6000);
  }

  window.PBRInstalar = { abrir: abrir, disponivel: disponivel };
  function iniciar() { atualizarMenu(); if (ios) agendar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
