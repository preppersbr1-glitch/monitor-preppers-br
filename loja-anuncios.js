// Vitrine da loja Outlanders Adventure — PREPPERS BR
// Uso, no <head> (depois do anuncio-guia.js):  <script src="loja-anuncios.js" defer></script>
//   data-faixa="nao" → não mostra (telas de chat)
// Busca ao vivo a lista pública da loja Shopify (/products.json): só entram produtos publicados no site, com
// pelo menos uma variação disponível para compra e com foto. A cada visita os produtos são sorteados.
(function () {
  var script = document.currentScript;
  if (script && script.dataset.faixa === 'nao') return;
  var pagina = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  if (/^(guia|admin)$/.test(pagina)) return;

  var LOJA = 'https://outlandersadventure.com';
  var CACHE = 'pbr-loja-produtos', VALIDADE = 30 * 60 * 1000;   // 30 min: produto desativado some logo
  var QTD = 6;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function real(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function sortear(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function img(src, w) { if (!src) return ''; return src + (src.indexOf('?') < 0 ? '?' : '&') + 'width=' + w; }
  function link(h) { return LOJA + '/products/' + encodeURIComponent(h) + '?utm_source=preppersbr&utm_medium=vitrine&utm_campaign=' + encodeURIComponent(pagina); }

  // só o necessário de cada produto ativo
  function limpar(lista) {
    var out = [];
    (lista || []).forEach(function (p) {
      var vs = (p.variants || []).filter(function (v) { return v.available && Number(v.price) > 0; });
      var foto = (p.images && p.images[0] && p.images[0].src) || '';
      if (!vs.length || !foto || !p.handle) return;
      vs.sort(function (a, b) { return Number(a.price) - Number(b.price); });
      var v = vs[0], de = Number(v.compare_at_price) > Number(v.price) ? Number(v.compare_at_price) : 0;
      out.push({ h: p.handle, t: p.title, img: foto, preco: Number(v.price), de: de, varias: vs.length > 1 && Number(vs[vs.length - 1].price) > Number(v.price) });
    });
    return out;
  }
  function produtos() {
    try { var c = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); if (c && Date.now() - c.em < VALIDADE && c.lista.length) return Promise.resolve(c.lista); } catch (e) {}
    return fetch(LOJA + '/products.json?limit=250', { mode: 'cors', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { var l = limpar(d.products); try { sessionStorage.setItem(CACHE, JSON.stringify({ em: Date.now(), lista: l })); } catch (e) {} return l; });
  }

  var css = document.createElement('style');
  css.textContent =
    '.plj{max-width:1100px;width:100%;min-width:0;grid-column:1/-1;margin:28px auto;padding:0 16px;font-family:Rajdhani,system-ui,sans-serif;color:#c8fce8;box-sizing:border-box}' +
    '.plj *{box-sizing:border-box}' +
    '.plj-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}' +
    '.plj-tag{font-family:"Share Tech Mono",monospace;font-size:10px;letter-spacing:2px;color:#4a7a60}' +
    '.plj-tit{font-family:Orbitron,sans-serif;font-weight:900;font-size:16px;letter-spacing:3px;color:#ffb300;margin-top:3px}' +
    '.plj-sub{font-size:15px;color:#8fc4a9;margin-top:2px}' +
    '.plj-ver{font-family:"Share Tech Mono",monospace;font-size:12px;letter-spacing:1.5px;color:#ffb300;text-decoration:none;border:1px solid rgba(255,179,0,.45);padding:7px 12px;border-radius:4px;white-space:nowrap}' +
    '.plj-ver:hover{background:rgba(255,179,0,.08)}' +
    '.plj-grade{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}' +
    '.plj-c{display:flex;flex-direction:column;border:1px solid #1a3d2a;border-radius:8px;overflow:hidden;background:rgba(10,22,16,.92);text-decoration:none;color:#c8fce8;' +
      'transition:transform .15s,border-color .15s,box-shadow .15s}' +
    '.plj-c:hover{transform:translateY(-3px);border-color:#ffb300;box-shadow:0 10px 26px rgba(0,0,0,.5),0 0 18px rgba(255,179,0,.12)}' +
    '.plj-f{position:relative;aspect-ratio:1/1;background:#f4f4f2;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
    '.plj-f img{width:100%;height:100%;object-fit:contain;display:block}' +
    '.plj-off{position:absolute;top:8px;left:8px;background:#ff3333;color:#fff;font-family:Orbitron,sans-serif;font-size:11px;font-weight:900;padding:3px 7px;border-radius:3px}' +
    '.plj-i{padding:10px 11px 12px;display:flex;flex-direction:column;gap:6px;flex:1}' +
    '.plj-n{font-size:16px;font-weight:600;line-height:1.25;color:#e8fff4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}' +
    '.plj-p{margin-top:auto;font-family:Orbitron,sans-serif;font-weight:900;font-size:17px;color:#00ff88}' +
    '.plj-p small{display:block;font-family:"Share Tech Mono",monospace;font-weight:400;font-size:11px;color:#4a7a60;letter-spacing:1px}' +
    '.plj-p s{color:#6f8f7f;font-family:"Share Tech Mono",monospace;font-weight:400;font-size:12px;margin-right:5px}' +
    '.plj-b{display:block;text-align:center;background:#ffb300;color:#000;font-family:Orbitron,sans-serif;font-weight:900;font-size:11px;letter-spacing:1.5px;padding:9px;border-radius:4px}' +
    '.plj-c:nth-child(n+5){display:none}' +
    '@media(max-width:900px){.plj-grade{grid-template-columns:repeat(3,1fr)}.plj-c:nth-child(n+4){display:none}}' +
    // celular: carrossel deslizando para o lado (com 6 produtos)
    '@media(max-width:600px){.plj-grade{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;padding-bottom:6px;margin:0 -16px;padding-left:16px;padding-right:16px;scrollbar-width:none}' +
      '.plj-grade::-webkit-scrollbar{display:none}.plj-c,.plj-c:nth-child(n+4),.plj-c:nth-child(n+5){display:flex;flex:0 0 62%;scroll-snap-align:start}.plj-n{font-size:15px}.plj-tit{font-size:14px}}';
  document.head.appendChild(css);

  function montar(lista) {
    if (!lista || !lista.length) return;
    var sorteio = sortear(lista).slice(0, QTD);
    var v = document.createElement('aside');
    v.className = 'plj'; v.setAttribute('aria-label', 'Produtos da loja Outlanders Adventure');
    v.innerHTML = '<div class="plj-cab"><div><div class="plj-tag">PARCEIRO OFICIAL · ANÚNCIO</div><div class="plj-tit">🏕️ LOJA OUTLANDERS ADVENTURE</div>' +
      '<div class="plj-sub">Equipamentos testados em campo para a sua preparação</div></div>' +
      '<a class="plj-ver" href="' + LOJA + '/?utm_source=preppersbr&utm_medium=vitrine&utm_campaign=' + encodeURIComponent(pagina) + '" target="_blank" rel="noopener">VER A LOJA ▸</a></div>' +
      '<div class="plj-grade">' + sorteio.map(function (p) {
        var off = p.de ? Math.round((1 - p.preco / p.de) * 100) : 0;
        return '<a class="plj-c" href="' + link(p.h) + '" target="_blank" rel="noopener">' +
          '<div class="plj-f"><img src="' + esc(img(p.img, 400)) + '" alt="' + esc(p.t) + '" loading="lazy" width="400" height="400">' + (off >= 5 ? '<span class="plj-off">-' + off + '%</span>' : '') + '</div>' +
          '<div class="plj-i"><div class="plj-n">' + esc(p.t) + '</div>' +
          '<div class="plj-p">' + (p.de ? '<s>' + real(p.de) + '</s>' : '') + (p.varias ? '<small>a partir de</small>' : '') + real(p.preco) + '</div>' +
          '<span class="plj-b">VER PRODUTO ▸</span></div></a>';
      }).join('') + '</div>';
    var rodape = document.querySelector('footer');
    if (rodape && rodape.parentNode) rodape.parentNode.insertBefore(v, rodape);
    else { var main = document.querySelector('main'); if (main) main.appendChild(v); else return; }
    // foto quebrada: some o cartão
    v.querySelectorAll('.plj-f img').forEach(function (im) { im.addEventListener('error', function () { var c = im.closest('.plj-c'); if (c) c.remove(); }); });
  }

  function iniciar() { produtos().then(montar).catch(function (e) { console.warn('Loja Outlanders: vitrine indisponível', e); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
