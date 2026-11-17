// Anúncio do Guia Definitivo de Preparação — PREPPERS BR
// Uso, no <head>:  <script src="anuncio-guia.js" defer></script>
//   data-faixa="nao"  → telas de chat: sem a faixa no fim da página e o cartão aparece no alto (não cobre a caixa de mensagem)
// Mostra: (1) cartão flutuante que aparece depois de alguns segundos ou de rolar a página, e que o visitante
// pode fechar (some por 3 dias); (2) faixa fixa antes do rodapé. Ambos levam para guia.html (página de venda).
(function () {
  var script = document.currentScript;
  var BASE = (script && script.src) ? script.src.replace(/anuncio-guia\.js(\?.*)?$/, '') : '';
  var FAIXA = !(script && script.dataset.faixa === 'nao');
  var pagina = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  if (/^guia$/.test(pagina) || /^admin$/.test(pagina)) return;

  var CHAVE = 'pbr-anuncio-guia-fechado', PAUSA = 3 * 864e5;
  var GANCHOS = [
    'Quando a luz cai, o socorro nas primeiras horas é <em>você</em>.',
    'Se a torneira secasse hoje, sua família teria água para 3 dias?',
    'Enchente, apagão ou desabastecimento: você sabe o que fazer <em>primeiro</em>?',
    'A maioria começa pela compra errada. O guia mostra a <em>ordem certa</em>.',
    'Bombeiros e SAMU ficam sobrecarregados em minutos. E a sua família?'
  ];
  var gancho = GANCHOS[Math.floor(Math.random() * GANCHOS.length)];
  function link(onde) { return BASE + 'guia.html?utm_source=site&utm_medium=' + onde + '&utm_campaign=' + encodeURIComponent(pagina); }
  function ler() { try { return +localStorage.getItem(CHAVE) || 0; } catch (e) { return 0; } }
  function gravar() { try { localStorage.setItem(CHAVE, String(Date.now())); } catch (e) {} }
  var CAPA = BASE + 'img/guia/capa-mini.jpg';

  var css = document.createElement('style');
  css.textContent =
    '.pga,.pgf{font-family:Rajdhani,system-ui,sans-serif;color:#c8fce8;box-sizing:border-box}' +
    '.pga *,.pgf *{box-sizing:border-box}' +
    '.pga em,.pgf em{font-style:normal;color:#00ff88}' +
    '.pga-capa,.pgf-capa{display:block;border-radius:3px;box-shadow:0 6px 18px rgba(0,0,0,.6),0 0 0 1px rgba(0,255,136,.25);object-fit:cover;flex:none}' +
    '.pga-tag,.pgf-tag{font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:2px;color:#ffb300}' +
    '.pga-cta,.pgf-cta{display:inline-block;background:#00ff88;color:#000!important;font-family:Orbitron,sans-serif;font-weight:900;font-size:12px;letter-spacing:1.5px;' +
      'text-decoration:none!important;padding:11px 16px;border-radius:3px;box-shadow:0 0 18px rgba(0,255,136,.35);white-space:nowrap;transition:transform .15s}' +
    '.pga-cta:hover,.pgf-cta:hover{transform:translateY(-1px)}' +
    '.pga-letra,.pgf-letra{font-family:"Share Tech Mono",monospace;font-size:11px;color:#4a7a60;letter-spacing:1px}' +
    // cartão flutuante
    '.pga{position:fixed;right:18px;bottom:18px;z-index:1400;width:360px;max-width:calc(100vw - 24px);background:rgba(8,18,13,.97);border:1px solid #00cc6a;' +
      'border-radius:8px;padding:14px 14px 13px;display:flex;gap:13px;box-shadow:0 12px 40px rgba(0,0,0,.7),0 0 24px rgba(0,255,136,.12);' +
      'transform:translateY(130%);opacity:0;transition:transform .45s cubic-bezier(.2,.9,.3,1.2),opacity .3s}' +
    '.pga.on{transform:none;opacity:1}' +
    '.pga-capa{width:78px;height:110px}' +
    '.pga-txt{min-width:0;flex:1}' +
    '.pga-h{font-weight:700;font-size:17px;line-height:1.25;margin:4px 22px 6px 0}' +
    '.pga-p{font-size:14px;line-height:1.4;color:#9fd8bf;margin:0 0 10px}' +
    '.pga-x{position:absolute;top:2px;right:2px;width:38px;height:38px;border:0;background:none;color:#4a7a60;font-size:22px;line-height:1;cursor:pointer;border-radius:50%}' +
    '.pga-x:hover{color:#00ff88}' +
    '.pga .pga-letra{display:block;margin-top:7px}' +
    '@media(max-width:600px){.pga{left:10px;right:10px;bottom:10px;width:auto;max-width:none;padding:12px}.pga-capa{width:64px;height:90px}.pga-h{font-size:16px}.pga-p{display:none}}' +
    '.pga.no-iframe-radio{bottom:70px}' +
    // telas de chat: no alto, para não cobrir a caixa de mensagem
    '.pga.topo{top:84px;bottom:auto;transform:translateY(-160%)}.pga.topo.on{transform:none}' +
    // faixa antes do rodapé
    '.pgf{max-width:1100px;width:100%;min-width:0;grid-column:1/-1;margin:28px auto;padding:0 16px}' +
    '.pgf-box{display:flex;align-items:center;gap:22px;padding:20px 22px;border:1px solid #1a3d2a;border-left:3px solid #00ff88;border-radius:6px;' +
      'background:linear-gradient(110deg,rgba(0,255,136,.07),rgba(10,22,16,.95) 45%,rgba(255,179,0,.05))}' +
    '.pgf-capa{width:96px;height:136px}' +
    '.pgf-txt{flex:1;min-width:0}' +
    '.pgf-h{font-family:Orbitron,sans-serif;font-weight:900;font-size:19px;letter-spacing:2px;color:#e8fff4;margin:5px 0 6px}' +
    '.pgf-g{font-size:18px;font-weight:600;line-height:1.35;margin:0 0 6px}' +
    '.pgf-p{font-size:15px;line-height:1.45;color:#9fd8bf;margin:0}' +
    '.pgf-acao{text-align:center;flex:none}' +
    '.pgf-preco{font-family:Orbitron,sans-serif;font-weight:900;font-size:26px;color:#00ff88;margin-bottom:8px}' +
    '.pgf-preco small{display:block;font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:2px;color:#4a7a60;font-weight:400}' +
    '.pgf .pgf-letra{margin-top:7px}' +
    '@media(max-width:700px){.pgf-box{flex-wrap:wrap;gap:12px 14px;padding:16px}.pgf-capa{width:70px;height:99px}.pgf-txt{flex:1 1 180px}.pgf-p{display:none}.pgf-g{font-size:17px;margin:0}' +
      '.pgf-acao{flex:1 1 100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left}.pgf-preco{margin:0;font-size:22px}.pgf-h{font-size:16px}.pgf .pgf-letra{display:none}}';
  document.head.appendChild(css);

  function faixa() {
    var f = document.createElement('aside');
    f.className = 'pgf'; f.setAttribute('aria-label', 'Guia Definitivo de Preparação');
    f.innerHTML = '<div class="pgf-box">' +
      '<a href="' + link('faixa') + '"><img class="pgf-capa" src="' + CAPA + '" alt="Capa do Guia Definitivo de Preparação" loading="lazy" width="96" height="136"></a>' +
      '<div class="pgf-txt"><div class="pgf-tag">📕 PREPPERS BR /// MANUAL DE CAMPO</div>' +
      '<div class="pgf-h">GUIA DEFINITIVO DE PREPARAÇÃO</div>' +
      '<p class="pgf-g">' + gancho + '</p>' +
      '<p class="pgf-p">41 capítulos e 20 diagramas práticos — água, comida, abrigo, energia, saúde, segurança e comunicação — adaptados à realidade brasileira. Em PDF e pronto para imprimir.</p></div>' +
      '<div class="pgf-acao"><div class="pgf-preco">R$ 47<small>PAGAMENTO ÚNICO</small></div>' +
      '<a class="pgf-cta" href="' + link('faixa') + '">QUERO MEU GUIA ▸</a><div class="pgf-letra">Garantia de 7 dias</div></div></div>';
    var rodape = document.querySelector('footer');
    if (rodape && rodape.parentNode) rodape.parentNode.insertBefore(f, rodape);
    else { var main = document.querySelector('main'); if (main) main.appendChild(f); }
  }

  function cartao() {
    if (Date.now() - ler() < PAUSA) return;
    var c = document.createElement('aside');
    c.className = 'pga'; c.setAttribute('aria-label', 'Guia Definitivo de Preparação');
    c.innerHTML = '<button class="pga-x" type="button" aria-label="Fechar anúncio" title="Fechar">×</button>' +
      '<a href="' + link('cartao') + '"><img class="pga-capa" src="' + CAPA + '" alt="Capa do Guia" width="78" height="110"></a>' +
      '<div class="pga-txt"><div class="pga-tag">📕 GUIA DEFINITIVO · R$ 47</div>' +
      '<div class="pga-h">' + gancho + '</div>' +
      '<p class="pga-p">O manual passo a passo para proteger sua família, com o que se encontra no Brasil.</p>' +
      '<a class="pga-cta" href="' + link('cartao') + '">CONHECER O GUIA ▸</a>' +
      '<span class="pga-letra">41 capítulos · PDF + impressão · garantia 7 dias</span></div>';
    // dentro do Rádio (página aberta por cima, com o botão de voltar no canto): sobe um pouco no celular
    try { if (window.top !== window && innerWidth <= 600) c.classList.add('no-iframe-radio'); } catch (e) {}
    if (!FAIXA) c.classList.add('topo');
    c.querySelector('.pga-x').onclick = function () { gravar(); c.classList.remove('on'); setTimeout(function () { c.remove(); }, 500); };
    c.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', gravar); });
    document.body.appendChild(c);
    var mostrou = false;
    function mostrar() { if (mostrou) return; mostrou = true; removeEventListener('scroll', rolou); requestAnimationFrame(function () { c.classList.add('on'); }); }
    function rolou() { var h = document.documentElement; if ((h.scrollTop || document.body.scrollTop) > Math.min(600, (h.scrollHeight - innerHeight) * 0.35)) mostrar(); }
    addEventListener('scroll', rolou, { passive: true });
    setTimeout(mostrar, 9000);
  }

  function iniciar() { if (FAIXA) faixa(); cartao(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
