// ═══════════════════════════════════════════════════════════════════════════
//  PREPPERS BR — Pagamentos (Cloudflare Worker)
//  Assinatura recorrente no cartão pelo Mercado Pago → libera o nível no Firebase.
//
//  Rotas
//    GET  /            situação da configuração (sem mostrar nenhum segredo)
//    POST /assinar     { plano: "operador"|"comando", periodo: "mensal"|"anual" }
//                      Authorization: Bearer <token de login do Firebase>
//                      → { url } do checkout do Mercado Pago
//    POST /cancelar    Authorization: Bearer <token>  → cancela a assinatura do próprio membro
//    POST /webhook     avisos do Mercado Pago (assinaturas e cobranças)
//    GET  /admin/cursos  lista as aulas pagas publicadas      } Authorization: Bearer <ADMIN_TOKEN>
//    POST /admin/cursos  { "<slug>": { title, html }, ... }    } só grava em cursos/<slug>
//
//  Segredos (Cloudflare → Worker → Settings → Variables and Secrets, tipo "Secret")
//    MP_ACCESS_TOKEN           Access Token do Mercado Pago (de teste ou de produção)
//    MP_WEBHOOK_SECRET         "Assinatura secreta" dos Webhooks do Mercado Pago
//    FIREBASE_SERVICE_ACCOUNT  conteúdo inteiro do JSON da conta de serviço do Firebase
//      ou, se o painel disser que é grande demais, em duas partes:
//    FIREBASE_CLIENT_EMAIL     o "client_email" do JSON
//    FIREBASE_PRIVATE_KEY      o "private_key" do JSON (de -----BEGIN até END PRIVATE KEY-----)
//  Opcionais (tipo "Text")
//    MP_PAYER_EMAIL_TESTE      só em teste: e-mail do usuário comprador de teste do Mercado Pago
//    ADMIN_TOKEN (Secret)      senha de publicação das aulas pagas (mín. 32 caracteres). Sem ela, /admin fica desligado.
//    SITE_URL, FIREBASE_PROJECT_ID, FIREBASE_DB_URL, ORIGENS_EXTRAS (separadas por vírgula)
//
//  Nada aqui confia no site: o preço vem desta tabela e o nível só muda depois de
//  consultar a assinatura direto na API do Mercado Pago.
// ═══════════════════════════════════════════════════════════════════════════

const PADRAO = {
  SITE_URL: 'https://preppersbr.com',
  FIREBASE_PROJECT_ID: 'comunidade-preppers-br-f5253',
  FIREBASE_DB_URL: 'https://comunidade-preppers-br-f5253-default-rtdb.firebaseio.com',
  MP_API: 'https://api.mercadopago.com',
};

// Preços em reais. Mudou aqui, muda para as próximas assinaturas (as já feitas mantêm o valor).
const PLANOS = {
  operador: { nome: 'Operador', mensal: 29, anual: 290 },
  comando: { nome: 'Comando', mensal: 79, anual: 790 },
};
const MESES = { mensal: 1, anual: 12 };
const TOLERANCIA_DIAS = 3;   // dias de acesso além da próxima cobrança (atraso de processamento do cartão)

const cfg = (env, k) => (env && env[k]) || PADRAO[k];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (req.method === 'GET' && url.pathname === '/') return json(status(env), 200, cors);
      if (req.method === 'POST' && url.pathname === '/assinar') return json(await assinar(req, env), 200, cors);
      if (req.method === 'POST' && url.pathname === '/cancelar') return json(await cancelar(req, env), 200, cors);
      if (req.method === 'POST' && url.pathname === '/webhook') return json(await webhook(req, env, url), 200, {});
      if (url.pathname === '/admin/cursos' && (req.method === 'GET' || req.method === 'POST')) return json(await adminCursos(req, env), 200, {});
      return json({ erro: 'não encontrado' }, 404, cors);
    } catch (e) {
      const st = e.status || 500;
      if (st >= 500) console.error('erro', url.pathname, e.message);
      return json({ erro: e.publico || 'Erro interno. Tente de novo em instantes.' }, st, cors);
    }
  },
};

// ── utilidades ─────────────────────────────────────────────────────────────
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}
function falha(status, publico) { const e = new Error(publico); e.status = status; e.publico = publico; return e; }
function corsHeaders(req, env) {
  const site = cfg(env, 'SITE_URL');
  const ok = [site, site.replace('://', '://www.')].concat(((env && env.ORIGENS_EXTRAS) || '').split(',').map(s => s.trim()).filter(Boolean));
  const origem = req.headers.get('Origin');
  return ok.includes(origem)
    ? { 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : { Vary: 'Origin' };
}
// Conta de serviço: JSON inteiro ou as duas partes separadas
function contaServico(env) {
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) return { client_email: env.FIREBASE_CLIENT_EMAIL.trim(), private_key: env.FIREBASE_PRIVATE_KEY };
  try { const j = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || ''); if (j.client_email && j.private_key) return j; } catch (e) {}
  return null;
}
function status(env) {
  const sa = !!contaServico(env);
  const tk = env.MP_ACCESS_TOKEN || '';
  return {
    servico: 'preppers-pagamentos',
    mercado_pago: tk ? (tk.startsWith('TEST-') ? 'configurado (chave TEST-)' : 'configurado (chave APP_USR-: produção ou vendedor de teste)') : 'FALTA MP_ACCESS_TOKEN',
    webhook_assinatura: env.MP_WEBHOOK_SECRET ? 'configurada' : 'FALTA MP_WEBHOOK_SECRET',
    firebase: sa ? 'configurado' : 'FALTA FIREBASE_SERVICE_ACCOUNT (JSON inteiro) ou FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY',
    comprador_teste: env.MP_PAYER_EMAIL_TESTE ? 'definido' : 'não definido',
    publicacao_aulas: (env.ADMIN_TOKEN || '').length >= 32 ? 'ligada' : 'desligada (sem ADMIN_TOKEN)',
  };
}
const b64u = {
  enc(buf) { let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  encStr(str) { return b64u.enc(new TextEncoder().encode(str)); },
  dec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; },
};

// ── login do Firebase (token de ID do usuário) ─────────────────────────────
let chavesGoogle = { at: 0, keys: null };
async function chavesFirebase() {
  if (chavesGoogle.keys && Date.now() - chavesGoogle.at < 3600e3) return chavesGoogle.keys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('chaves do Google indisponíveis');
  chavesGoogle = { at: Date.now(), keys: (await r.json()).keys };
  return chavesGoogle.keys;
}
async function usuario(req, env) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) throw falha(401, 'Faça login para assinar.');
  const partes = m[1].split('.');
  if (partes.length !== 3) throw falha(401, 'Login inválido. Entre de novo.');
  let cab, dados;
  try { cab = JSON.parse(new TextDecoder().decode(b64u.dec(partes[0]))); dados = JSON.parse(new TextDecoder().decode(b64u.dec(partes[1]))); }
  catch (e) { throw falha(401, 'Login inválido. Entre de novo.'); }
  const proj = cfg(env, 'FIREBASE_PROJECT_ID'), agora = Date.now() / 1000;
  if (cab.alg !== 'RS256' || dados.aud !== proj || dados.iss !== 'https://securetoken.google.com/' + proj ||
      !dados.sub || dados.exp < agora || dados.iat > agora + 300) throw falha(401, 'Seu login expirou. Entre de novo.');
  const jwk = (await chavesFirebase()).find(k => k.kid === cab.kid);
  if (!jwk) throw falha(401, 'Seu login expirou. Entre de novo.');
  const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, b64u.dec(partes[2]), new TextEncoder().encode(partes[0] + '.' + partes[1]));
  if (!ok) throw falha(401, 'Login inválido. Entre de novo.');
  return { uid: dados.sub, email: dados.email || '' };
}

// ── Firebase como administrador (conta de serviço) ─────────────────────────
let tokenAdm = { exp: 0, tk: '' };
async function tokenFirebase(env) {
  if (tokenAdm.tk && Date.now() < tokenAdm.exp - 60e3) return tokenAdm.tk;
  const sa = contaServico(env);
  if (!sa) throw new Error('conta de serviço do Firebase ausente ou inválida');
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64u.encStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u.encStr(JSON.stringify({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
  }));
  const pem = sa.private_key.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const chave = await crypto.subtle.importKey('pkcs8', b64u.dec(pem.replace(/\+/g, '-').replace(/\//g, '_')), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(corpo));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + corpo + '.' + b64u.enc(sig),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('Google recusou a conta de serviço: ' + (j.error_description || j.error || r.status));
  tokenAdm = { tk: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tokenAdm.tk;
}
async function db(env, metodo, caminho, corpo) {
  const base = new URL(cfg(env, 'FIREBASE_DB_URL'));
  const u = new URL(base.origin + base.pathname.replace(/\/$/, '') + '/' + caminho + '.json');
  base.searchParams.forEach((v, k) => u.searchParams.set(k, v));   // ?ns= do emulador
  const r = await fetch(u, { method: metodo, headers: { Authorization: 'Bearer ' + await tokenFirebase(env), 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  if (!r.ok) throw new Error('Firebase ' + metodo + ' ' + caminho + ': ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

// ── Mercado Pago ───────────────────────────────────────────────────────────
async function mp(env, metodo, caminho, corpo) {
  if (!env.MP_ACCESS_TOKEN) throw falha(503, 'Pagamentos ainda não configurados. Avise o administrador.');
  const r = await fetch(cfg(env, 'MP_API') + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error('Mercado Pago ' + metodo + ' ' + caminho + ': ' + r.status + ' ' + JSON.stringify(j).slice(0, 300));
    e.status = r.status === 404 ? 404 : 502; e.mp = j; throw e;
  }
  return j;
}

async function assinar(req, env) {
  const u = await usuario(req, env);
  let pedido = {};
  try { pedido = await req.json(); } catch (e) {}
  const plano = PLANOS[pedido.plano], periodo = pedido.periodo;
  if (!plano || !MESES[periodo]) throw falha(400, 'Plano inválido.');
  const email = env.MP_PAYER_EMAIL_TESTE || u.email;
  if (!email) throw falha(400, 'Sua conta precisa de um e-mail para assinar.');
  // já tem assinatura ativa? evita cobrar duas vezes
  const atual = await db(env, 'GET', 'members/' + u.uid + '/sub');
  if (atual && atual.status === 'authorized') throw falha(409, 'Você já tem uma assinatura ativa. Cancele a atual antes de trocar de plano.');
  const valor = plano[periodo];
  const pa = await mp(env, 'POST', '/preapproval', {
    reason: 'Preppers BR — Plano ' + plano.nome + ' (' + periodo + ')',
    external_reference: u.uid + '|' + pedido.plano + '|' + periodo,
    payer_email: email,
    back_url: cfg(env, 'SITE_URL') + '/membros.html?assinatura=retorno',
    auto_recurring: { frequency: MESES[periodo], frequency_type: 'months', transaction_amount: valor, currency_id: 'BRL' },
    status: 'pending',
  });
  await db(env, 'PATCH', 'members/' + u.uid + '/sub', { id: pa.id, status: pa.status || 'pending', plano: pedido.plano, periodo, valor, atualizado: Date.now() });
  return { url: pa.init_point };
}

async function cancelar(req, env) {
  const u = await usuario(req, env);
  const sub = await db(env, 'GET', 'members/' + u.uid + '/sub');
  if (!sub || !sub.id) throw falha(404, 'Nenhuma assinatura encontrada.');
  await mp(env, 'PUT', '/preapproval/' + encodeURIComponent(sub.id), { status: 'cancelled' });
  const r = await sincronizar(env, sub.id);
  return { ok: true, status: r.status, acessoAte: r.paidUntil || null };
}

// Lê a assinatura no Mercado Pago e grava o resultado no Firebase. Nível só sobe com cobrança aprovada;
// cancelada/pausada não tira o acesso já pago: ele termina sozinho em paidUntil (o site confere a data).
async function sincronizar(env, idAssinatura) {
  const pa = await mp(env, 'GET', '/preapproval/' + encodeURIComponent(idAssinatura));
  const [uid, plano, periodo] = String(pa.external_reference || '').split('|');
  if (!/^[A-Za-z0-9]{6,128}$/.test(uid || '') || !PLANOS[plano] || !MESES[periodo]) return { ignorado: 'referência desconhecida' };
  const resumo = pa.summarized || {};
  const sub = {
    id: pa.id, status: pa.status, plano, periodo,
    valor: (pa.auto_recurring && pa.auto_recurring.transaction_amount) || PLANOS[plano][periodo],
    cobrancas: resumo.charged_quantity || 0,
    proxima: pa.next_payment_date ? Date.parse(pa.next_payment_date) : null,
    atualizado: Date.now(),
  };
  const atual = await db(env, 'GET', 'members/' + uid);
  // aviso atrasado de uma assinatura antiga (ex.: cancelou A e assinou B) não sobrescreve a atual
  if (atual && atual.sub && atual.sub.id && atual.sub.id !== pa.id && pa.status !== 'authorized') return { ignorado: 'assinatura antiga', uid };
  const membro = { sub };
  if (pa.status === 'authorized' && sub.cobrancas > 0) {
    const ultima = resumo.last_charged_date ? Date.parse(resumo.last_charged_date) : Date.now();
    const base = Math.max(sub.proxima || 0, ultima + MESES[periodo] * 30 * 864e5);
    membro.level = plano;
    membro.paidUntil = Math.max((atual && atual.paidUntil) || 0, base + TOLERANCIA_DIAS * 864e5);
  }
  await db(env, 'PATCH', 'members/' + uid, membro);
  return { uid, status: pa.status, level: membro.level || null, paidUntil: membro.paidUntil || null };
}

// x-signature: "ts=...,v1=<hmac>"; base: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
async function assinaturaValida(req, env, dataId) {
  const sig = req.headers.get('x-signature') || '';
  const p = Object.fromEntries(sig.split(',').map(s => s.trim().split('=')).filter(x => x.length === 2));
  if (!p.ts || !p.v1) return false;
  let base = '';
  if (dataId) base += 'id:' + (/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId) + ';';
  const rid = req.headers.get('x-request-id');
  if (rid) base += 'request-id:' + rid + ';';
  base += 'ts:' + p.ts + ';';
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.MP_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const h = [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(base)))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (h.length !== p.v1.length) return false;
  let d = 0; for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ p.v1.charCodeAt(i);
  return d === 0;
}

async function webhook(req, env, url) {
  let corpo = {};
  try { corpo = await req.json(); } catch (e) {}
  const tipo = url.searchParams.get('type') || url.searchParams.get('topic') || corpo.type || '';
  const dataId = url.searchParams.get('data.id') || url.searchParams.get('id') || (corpo.data && corpo.data.id) || '';
  if (!env.MP_WEBHOOK_SECRET) throw falha(503, 'webhook sem assinatura configurada');
  if (!(await assinaturaValida(req, env, String(dataId)))) throw falha(401, 'assinatura inválida');
  if (!dataId) return { ignorado: 'sem id' };
  if (tipo === 'subscription_preapproval') return sincronizar(env, dataId);
  if (tipo === 'subscription_authorized_payment') {
    const cobranca = await mp(env, 'GET', '/authorized_payments/' + encodeURIComponent(dataId));
    return cobranca.preapproval_id ? sincronizar(env, cobranca.preapproval_id) : { ignorado: 'cobrança sem assinatura' };
  }
  return { ignorado: tipo || 'tipo desconhecido' };
}

// ── Publicação das aulas pagas (cursos/<slug>) com a senha de publicação ───
async function adminCursos(req, env) {
  const tk = env.ADMIN_TOKEN || '';
  if (tk.length < 32) throw falha(404, 'não encontrado');
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  const dado = new TextEncoder().encode(m ? m[1] : ''), certo = new TextEncoder().encode(tk);
  let d = dado.length ^ certo.length;
  for (let i = 0; i < certo.length; i++) d |= certo[i] ^ (dado[i] || 0);
  if (d !== 0) throw falha(401, 'senha de publicação inválida');
  if (req.method === 'GET') {
    const c = (await db(env, 'GET', 'cursos')) || {};
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { title: v.title || k, kb: Math.round(((v.html || '').length) / 1024), updatedAt: v.updatedAt || null }]));
  }
  let dados;
  try { dados = await req.json(); } catch (e) { throw falha(400, 'JSON inválido'); }
  const up = {}, nomes = [];
  for (const [slug, c] of Object.entries(dados || {})) {
    if (!/^[a-z0-9-]{2,60}$/.test(slug) || !c || typeof c.html !== 'string' || !c.html.trim() || c.html.length > 500000) throw falha(400, 'curso inválido: ' + slug);
    up[slug] = { title: String(c.title || slug).slice(0, 120), html: c.html, updatedAt: Date.now() };
    nomes.push(slug);
  }
  if (!nomes.length) throw falha(400, 'nenhum curso enviado');
  await db(env, 'PATCH', 'cursos', up);
  return { publicados: nomes };
}
