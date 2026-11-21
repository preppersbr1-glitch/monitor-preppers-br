// Depoimentos do Guia — prova social da página de venda (guia.html)
// - Mostra os depoimentos aprovados no Admin (a seção fica escondida enquanto não houver nenhum).
// - Formulário para quem comprou: nota, comentário, nome, cidade e o e-mail da compra (não aparece no site).
// - Link direto que já abre o formulário: https://preppersbr.com/guia.html#depoimento
//   (use na página de obrigado do Hotmart, no e-mail aos compradores, no PDF e no Instagram).
(function () {
  var API = 'https://preppers-pagamentos.preppersbr1.workers.dev';
  var MOSTRAR = 6;
  var UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  var lista = [], abertoEm = 0, nota = 0;

  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function estrelas(n) { var s = ''; for (var i = 1; i <= 5; i++) s += '<span class="' + (i <= Math.round(n) ? 'on' : '') + '">★</span>'; return '<span class="depo-est" aria-label="' + n + ' de 5 estrelas">' + s + '</span>'; }
  function iniciais(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function mesAno(ts) { return new Date(ts).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', ''); }

  function cartao(d) {
    return '<article class="depo-c">' +
      '<div class="depo-top">' + estrelas(d.nota) + (d.verificado ? '<span class="depo-ver" title="O e-mail confere com uma compra no Hotmart">✓ COMPRA VERIFICADA</span>' : '') + '</div>' +
      '<p class="depo-txt">“' + esc(d.texto) + '”</p>' +
      '<div class="depo-quem"><span class="depo-av" aria-hidden="true">' + esc(iniciais(d.nome)) + '</span><span><b>' + esc(d.nome) + '</b>' +
      '<small>' + esc([d.cidade, d.uf].filter(Boolean).join(' · ')) + (d.cidade || d.uf ? ' · ' : '') + mesAno(d.ts) + '</small></span></div></article>';
  }
  function desenhar(todos) {
    var sec = $('depoimentos'); if (!sec) return;
    if (!lista.length) { sec.hidden = true; return; }
    sec.hidden = false;
    var media = lista.reduce(function (s, d) { return s + d.nota; }, 0) / lista.length;
    $('depo-resumo').innerHTML = estrelas(media) + ' <b>' + media.toFixed(1).replace('.', ',') + '</b> de 5 · ' + lista.length + ' depoimento' + (lista.length > 1 ? 's' : '') + ' de leitores';
    $('depo-grid').innerHTML = lista.slice(0, todos ? lista.length : MOSTRAR).map(cartao).join('');
    $('depo-mais').hidden = todos || lista.length <= MOSTRAR;
  }
  function carregar() {
    fetch(API + '/depoimentos').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.depoimentos) { lista = j.depoimentos; desenhar(false); }
    }).catch(function () {});
  }

  // ── formulário ──
  function abrir(e) {
    if (e) e.preventDefault();
    var m = $('depo-modal'); if (!m) return;
    m.classList.add('on'); abertoEm = Date.now();
    $('depo-form').hidden = false; $('depo-ok').hidden = true;
    setTimeout(function () { var n = $('depo-nome'); if (n) n.focus(); }, 50);
  }
  function fechar() { var m = $('depo-modal'); if (m) m.classList.remove('on'); if (/depoimento/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); }
  function marcar(n) {
    nota = n;
    [].forEach.call(document.querySelectorAll('#depo-notas button'), function (b, i) { b.classList.toggle('on', i < n); b.setAttribute('aria-pressed', i < n ? 'true' : 'false'); });
    $('depo-nota-txt').textContent = ['Toque nas estrelas', 'Não gostei', 'Poderia ser melhor', 'Bom', 'Muito bom', 'Excelente!'][n];
  }
  function enviar(e) {
    e.preventDefault();
    var msg = $('depo-msg'), btn = $('depo-enviar');
    function erro(t) { msg.textContent = t; msg.style.color = 'var(--red)'; }
    if (!nota) return erro('Escolha de 1 a 5 estrelas.');
    var dados = {
      nome: $('depo-nome').value.trim(), cidade: $('depo-cidade').value.trim(), uf: $('depo-uf').value,
      texto: $('depo-texto').value.trim(), email: $('depo-email').value.trim(), nota: nota,
      autorizo: $('depo-autorizo').checked, site: $('depo-site').value, tempo: Date.now() - abertoEm
    };
    if (dados.nome.length < 2) return erro('Escreva seu nome.');
    if (dados.texto.length < 20) return erro('Conte um pouco mais (mínimo de 20 letras).');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(dados.email)) return erro('Informe o e-mail usado na compra.');
    if (!dados.autorizo) return erro('Marque a autorização para publicarmos seu depoimento.');
    btn.disabled = true; btn.textContent = 'ENVIANDO...'; msg.textContent = '';
    fetch(API + '/depoimento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function () {
        $('depo-form').hidden = true; $('depo-ok').hidden = false; $('depo-form').reset(); marcar(0);
        try { localStorage.setItem('pbr-depoimento-enviado', String(Date.now())); } catch (x) {}
      })
      .catch(function (x) { erro(/Failed to fetch|NetworkError|Load failed/i.test(x.message) ? 'Sem conexão. Tente de novo.' : x.message); })
      .then(function () { btn.disabled = false; btn.textContent = 'ENVIAR DEPOIMENTO ▸'; });
  }

  function iniciar() {
    var uf = $('depo-uf');
    if (uf) uf.insertAdjacentHTML('beforeend', UFS.map(function (u) { return '<option>' + u + '</option>'; }).join(''));
    [].forEach.call(document.querySelectorAll('.js-depo-abrir'), function (a) { a.addEventListener('click', abrir); });
    var notas = $('depo-notas');
    if (notas) [].forEach.call(notas.querySelectorAll('button'), function (b, i) { b.addEventListener('click', function () { marcar(i + 1); }); });
    var t = $('depo-texto'), c = $('depo-cont');
    if (t && c) t.addEventListener('input', function () { c.textContent = t.value.length + '/800'; });
    if ($('depo-form')) $('depo-form').addEventListener('submit', enviar);
    if ($('depo-x')) $('depo-x').addEventListener('click', fechar);
    if ($('depo-fechar-ok')) $('depo-fechar-ok').addEventListener('click', fechar);
    var m = $('depo-modal');
    if (m) m.addEventListener('click', function (e) { if (e.target === m) fechar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m && m.classList.contains('on')) fechar(); });
    if ($('depo-mais')) $('depo-mais').addEventListener('click', function () { desenhar(true); });
    // link direto: guia.html#depoimento (ou ?depoimento=1) já abre o formulário
    if (/^#(deixar-)?depoimento$/.test(location.hash) || /[?&]depoimento=1/.test(location.search)) setTimeout(abrir, 300);
    carregar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
