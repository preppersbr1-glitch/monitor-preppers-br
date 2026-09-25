// Botão "mostrar senha" (olho) em todo <input type="password"> da página.
// Uso: <script src="senha.js" defer></script>
(function () {
  var EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function add(input) {
    if (input.dataset.olho) return;
    input.dataset.olho = '1';
    var cs = getComputedStyle(input);
    // o invólucro assume as margens do campo para o layout não mudar
    var wrap = document.createElement('span');
    wrap.style.cssText = 'position:relative;display:block;margin:' + cs.marginTop + ' ' + cs.marginRight + ' ' + cs.marginBottom + ' ' + cs.marginLeft;
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.margin = '0';
    input.style.paddingRight = '44px';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pbr-olho';
    btn.setAttribute('aria-label', 'Mostrar senha');
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'Mostrar senha';
    btn.innerHTML = EYE;
    btn.style.cssText = 'position:absolute;right:4px;top:0;bottom:0;width:38px;display:flex;align-items:center;justify-content:center;' +
      'background:none;border:0;padding:0;margin:0;cursor:pointer;color:#4a7a60;opacity:.85';
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });   // não tira o foco do campo
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var show = input.type === 'password';
      var pos = input.selectionStart;
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.style.color = show ? '#00ff88' : '#4a7a60';
      btn.setAttribute('aria-pressed', String(show));
      btn.title = btn.getAttribute('aria-label') === 'Mostrar senha' ? 'Ocultar senha' : 'Mostrar senha';
      btn.setAttribute('aria-label', btn.title);
      if (document.activeElement === input && pos != null) { try { input.setSelectionRange(pos, pos); } catch (err) {} }
    });
    wrap.appendChild(btn);
  }

  var css = document.createElement('style');
  css.textContent = '.pbr-olho{-webkit-tap-highlight-color:transparent;outline:none}.pbr-olho:focus{outline:none;background:none!important}.pbr-olho:focus-visible{outline:1px solid #00ff88;border-radius:3px}';
  document.head.appendChild(css);

  function run() { document.querySelectorAll('input[type="password"]').forEach(add); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
