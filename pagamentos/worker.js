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
//  Alertas push (Web Push padrão, sem serviço extra; veja "ALERTAS PUSH" mais abaixo)
//    GET  /push/chave        chave pública para o navegador assinar os alertas
//    GET  /alertas           últimos alertas enviados (público)
//    POST /push/estado | /push/registrar | /push/prefs | /push/remover | /push/teste | /push/mentoria
//                            Authorization: Bearer <token de login do Firebase>
//    POST /admin/alerta      { titulo, texto, link, uf }   } só o administrador do site
//    POST /admin/push        resumo dos alertas            } (login com o e-mail de admin)
//  Gatilho agendado (Cloudflare → Worker → Settings → Triggers → Cron: "* * * * *"):
//    verifica terremotos (USGS) e tempestades solares (NOAA) e entrega a fila de alertas.
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
  operador: { nome: 'Operador', mensal: 9.90, anual: 99 },
  comando: { nome: 'Comando', mensal: 29.90, anual: 299 },
};
const MESES = { mensal: 1, anual: 12 };
const TOLERANCIA_DIAS = 3;   // dias de acesso além da próxima cobrança (atraso de processamento do cartão)

const cfg = (env, k) => (env && env[k]) || PADRAO[k];

export default {
  async scheduled(evento, env, ctx) { ctx.waitUntil(rodarAlertas(env).catch(e => console.error('alertas', e.message))); },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (req.method === 'GET' && url.pathname === '/') return json(status(env), 200, cors);
      if (req.method === 'POST' && url.pathname === '/assinar') return json(await assinar(req, env), 200, cors);
      if (req.method === 'POST' && url.pathname === '/cancelar') return json(await cancelar(req, env), 200, cors);
      if (req.method === 'POST' && url.pathname === '/webhook') return json(await webhook(req, env, url), 200, {});
      if (url.pathname === '/admin/cursos' && (req.method === 'GET' || req.method === 'POST')) return json(await adminCursos(req, env), 200, {});
      if (req.method === 'GET' && url.pathname === '/push/chave') return json({ chave: (await chavesVapid(env)).publica }, 200, cors);
      if (req.method === 'GET' && url.pathname === '/alertas') return json(await ultimosAlertas(env), 200, { ...cors, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=60' });
      if (req.method === 'POST' && ROTAS_PUSH[url.pathname]) return json(await ROTAS_PUSH[url.pathname](req, env, ctx), 200, cors);
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
    alertas_push: 'ligados (versão ' + VERSAO_ALERTAS + ')',
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
  if (!m) throw falha(401, 'Faça login para continuar.');
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
  return { uid: dados.sub, email: dados.email || '', verificado: dados.email_verified === true };
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
  const [rota, consulta] = caminho.split('?');
  const u = urlDb(env, rota);   // ?ns= do emulador vem junto
  new URLSearchParams(consulta || '').forEach((v, k) => u.searchParams.set(k, v));
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

// ═══════════════════════════════════════════════════════════════════════════
//  ALERTAS PUSH — todas as contas do site (Sentinela, Operador, Comando) e o administrador.
//  A Sala de Mentoria continua só para Comando em dia.
//  Web Push padrão (RFC 8030/8291/8292): funciona no Chrome, Edge, Firefox, Android e,
//  com o site adicionado à Tela de Início, no iPhone/iPad. A chave VAPID é criada
//  sozinha na primeira vez e fica em segredos/vapid no Firebase (nenhum visitante lê).
//
//  Banco (só este Worker escreve; as regras não liberam nada disso para o site):
//    push/<uid>        { prefs: { sismo, solar, avisos, mentoria, uf }, tok: { <id>: { s, ts, ua } }, adm }
//    alertas/hist      histórico dos alertas enviados        alertas/fila   entregas pendentes
//    alertas/vistos    eventos já avisados (não repete)      alertas/estado última verificação
// ═══════════════════════════════════════════════════════════════════════════
const VERSAO_ALERTAS = '2';
const ADMIN_EMAIL_PADRAO = 'preppersbr1@gmail.com';
const TIPOS_PUSH = ['sismo', 'solar', 'avisos', 'mentoria'];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const LOTE = 28;              // entregas por execução (o plano grátis da Cloudflare permite 50 chamadas externas)
const MAX_APARELHOS = 8;

const ehAdmin = (env, u) => u.verificado && u.email && u.email.toLowerCase() === String(env.ADMIN_EMAIL || ADMIN_EMAIL_PADRAO).toLowerCase();
function nivelPago(m) {
  return m && (m.level === 'operador' || m.level === 'comando') && Number(m.paidUntil) > Date.now() ? m.level : '';
}
async function hex(txt) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function corpoJson(req) { try { return (await req.json()) || {}; } catch (e) { return {}; } }
function limparPrefs(p, anterior) {
  const a = anterior || {}, o = {};
  TIPOS_PUSH.forEach(t => { o[t] = p && typeof p[t] === 'boolean' ? p[t] : (typeof a[t] === 'boolean' ? a[t] : true); });
  const uf = p && 'uf' in p ? p.uf : a.uf;
  o.uf = UFS.includes(uf) ? uf : '';
  return o;
}
function limparAssinatura(s) {
  if (!s || typeof s.endpoint !== 'string' || !s.keys) throw falha(400, 'Assinatura de alertas inválida.');
  let u; try { u = new URL(s.endpoint); } catch (e) { throw falha(400, 'Assinatura de alertas inválida.'); }
  if (u.protocol !== 'https:' || s.endpoint.length > 1000) throw falha(400, 'Assinatura de alertas inválida.');
  const p256dh = String(s.keys.p256dh || ''), auth = String(s.keys.auth || '');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) throw falha(400, 'Assinatura de alertas inválida.');
  return { endpoint: s.endpoint, keys: { p256dh, auth } };
}

// ── chave VAPID (criada uma vez, guardada no banco) ────────────────────────
let vapidCache = null;
async function chavesVapid(env) {
  if (vapidCache) return vapidCache;
  let v = await db(env, 'GET', 'segredos/vapid');
  if (!v || !v.privada || !v.publica) {
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const novo = { privada: await crypto.subtle.exportKey('jwk', par.privateKey), publica: b64u.enc(await crypto.subtle.exportKey('raw', par.publicKey)), criada: Date.now() };
    // grava só se ainda não existir (duas execuções ao mesmo tempo não criam chaves diferentes)
    const r = await fetch(urlDb(env, 'segredos/vapid'), { method: 'PUT', headers: { Authorization: 'Bearer ' + await tokenFirebase(env), 'Content-Type': 'application/json', 'if-match': 'null_etag' }, body: JSON.stringify(novo) });
    v = r.ok ? novo : await db(env, 'GET', 'segredos/vapid');
    if (!v || !v.privada) throw new Error('não foi possível criar a chave dos alertas');
  }
  vapidCache = { publica: v.publica, privada: await crypto.subtle.importKey('jwk', v.privada, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
  return vapidCache;
}
function urlDb(env, caminho) {
  const base = new URL(cfg(env, 'FIREBASE_DB_URL'));
  const u = new URL(base.origin + base.pathname.replace(/\/$/, '') + '/' + caminho + '.json');
  base.searchParams.forEach((v, k) => u.searchParams.set(k, v));
  return u;
}

// ── Web Push: criptografia aes128gcm (RFC 8291) + assinatura VAPID (RFC 8292) ──
const junta = (...ps) => { const t = ps.reduce((n, p) => n + p.length, 0), o = new Uint8Array(t); let i = 0; ps.forEach(p => { o.set(p, i); i += p.length; }); return o; };
const txt = s => new TextEncoder().encode(s);
async function hmac(chave, dado) {
  const k = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dado));
}
async function cifrar(assinatura, texto, sal, parLocal) {
  const uaPub = b64u.dec(assinatura.keys.p256dh), auth = b64u.dec(assinatura.keys.auth);
  const par = parLocal || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const uaChave = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const segredo = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaChave }, par.privateKey, 256));
  const ikm = await hmac(await hmac(auth, segredo), junta(txt('WebPush: info\0'), uaPub, asPub, [1]));
  sal = sal || crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, junta(txt('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, junta(txt('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, junta(txt(texto), [2])));
  return junta(sal, [0, 0, 16, 0], [asPub.length], asPub, cifrado);
}
async function vapidJwt(env, endpoint) {
  const v = await chavesVapid(env);
  const corpo = b64u.encStr(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' +
    b64u.encStr(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: cfg(env, 'SITE_URL') }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.privada, txt(corpo));
  return 'vapid t=' + corpo + '.' + b64u.enc(sig) + ', k=' + v.publica;
}
// → 'ok' | 'sumiu' (aparelho desinstalou/recusou: apagar) | 'erro ...'
async function enviarPush(env, assinatura, msg) {
  try {
    const corpo = await cifrar(assinatura, JSON.stringify(msg));
    const r = await fetch(assinatura.endpoint, {
      method: 'POST', body: corpo,
      headers: { Authorization: await vapidJwt(env, assinatura.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '43200', Urgency: 'high' },
    });
    if (r.status >= 200 && r.status < 300) return 'ok';
    if (r.status === 404 || r.status === 410) return 'sumiu';
    return 'erro ' + r.status + ' ' + (await r.text()).slice(0, 120);
  } catch (e) { return 'erro ' + e.message; }
}

// ── rotas do site ──────────────────────────────────────────────────────────
async function quem(req, env) {
  const u = await usuario(req, env);
  const adm = ehAdmin(env, u);
  const m = adm ? null : await db(env, 'GET', 'members/' + u.uid);
  // qualquer conta logada recebe alertas; plano pago vencido conta como Sentinela
  const nivel = adm ? 'admin' : (nivelPago(m) || 'sentinela');
  return { u, adm, nivel };
}
const ROTAS_PUSH = {
  '/push/estado': async (req, env) => {
    const { u, nivel } = await quem(req, env);
    const p = (await db(env, 'GET', 'push/' + u.uid)) || {};
    return { pode: true, nivel, prefs: limparPrefs(null, p.prefs), aparelhos: Object.keys(p.tok || {}).length, chave: (await chavesVapid(env)).publica };
  },
  '/push/registrar': async (req, env) => {
    const { u, adm, nivel } = await quem(req, env);
    const b = await corpoJson(req);
    const s = limparAssinatura(b.assinatura);
    const p = (await db(env, 'GET', 'push/' + u.uid)) || {};
    const tok = p.tok || {}, id = await hex(s.endpoint);
    const mudanca = { ['tok/' + id]: { s, ts: Date.now(), ua: String(b.aparelho || '').slice(0, 60) }, prefs: limparPrefs(b.prefs, p.prefs), adm: adm || null };
    // aparelhos demais: sai o mais antigo
    const ids = Object.keys(tok).filter(k => k !== id).sort((a, c) => (tok[a].ts || 0) - (tok[c].ts || 0));
    while (ids.length >= MAX_APARELHOS) mudanca['tok/' + ids.shift()] = null;
    await db(env, 'PATCH', 'push/' + u.uid, mudanca);
    return { ok: true, prefs: mudanca.prefs, aparelhos: Math.min(ids.length + 1, MAX_APARELHOS) };
  },
  '/push/prefs': async (req, env) => {
    const { u, nivel } = await quem(req, env);
    const b = await corpoJson(req);
    const atual = await db(env, 'GET', 'push/' + u.uid + '/prefs');
    const prefs = limparPrefs(b.prefs, atual);
    await db(env, 'PUT', 'push/' + u.uid + '/prefs', prefs);
    return { ok: true, prefs };
  },
  '/push/remover': async (req, env) => {
    const u = await usuario(req, env);
    const b = await corpoJson(req);
    if (b.endpoint) await db(env, 'DELETE', 'push/' + u.uid + '/tok/' + await hex(String(b.endpoint)));
    else await db(env, 'DELETE', 'push/' + u.uid);
    return { ok: true };
  },
  '/push/teste': async (req, env) => {
    const { u, nivel } = await quem(req, env);
    const tok = (await db(env, 'GET', 'push/' + u.uid + '/tok')) || {};
    if (!Object.keys(tok).length) throw falha(404, 'Nenhum aparelho com alertas ativos.');
    const msg = { titulo: '✅ Alertas PREPPERS BR ativos', texto: 'Este aparelho vai receber os alertas que você escolheu.', link: '/membros.html#alertas', tag: 'teste' };
    const res = await Promise.all(Object.entries(tok).map(async ([id, t]) => [id, await enviarPush(env, t.s, msg)]));
    const sumiram = res.filter(r => r[1] === 'sumiu');
    if (sumiram.length) await db(env, 'PATCH', 'push/' + u.uid + '/tok', Object.fromEntries(sumiram.map(r => [r[0], null])));
    const erro = res.find(r => r[1].startsWith('erro'));
    return { enviados: res.filter(r => r[1] === 'ok').length, removidos: sumiram.length, erro: erro ? erro[1] : null };
  },
  // admin respondeu na Sala de Mentoria → avisa o membro; membro Comando escreveu → avisa o admin
  '/push/mentoria': async (req, env, ctx) => {
    const { u, adm, nivel } = await quem(req, env);
    const b = await corpoJson(req);
    const msg = { tipo: 'mentoria', link: '/mentoria.html', tag: 'mentoria' };
    if (adm) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(b.uid || ''))) throw falha(400, 'membro inválido');
      const m = await db(env, 'GET', 'members/' + b.uid);
      if (nivelPago(m) !== 'comando') return { enviados: 0 };
      Object.assign(msg, { titulo: '🎖️ Resposta na Sala de Mentoria', texto: 'O fundador do PREPPERS BR respondeu sua mensagem. Toque para ler.' });
      return { enviados: await enfileirar(env, ctx, msg, (uid, p) => uid === b.uid && p.prefs && p.prefs.mentoria !== false) };
    }
    if (nivel !== 'comando') throw falha(403, 'A Sala de Mentoria é do plano Comando.');
    const ult = await db(env, 'GET', 'alertas/mentoriaAviso/' + u.uid);
    if (ult && Date.now() - ult < 5 * 60e3) return { enviados: 0, aguarde: true };   // no máximo um aviso a cada 5 min por membro
    await db(env, 'PUT', 'alertas/mentoriaAviso/' + u.uid, Date.now());
    const nome = String(b.nome || '').replace(/[<>]/g, '').slice(0, 40) || 'Um membro Comando';
    Object.assign(msg, { titulo: '🎖️ Nova mensagem na Mentoria', texto: nome + ' escreveu na Sala de Mentoria.', link: '/admin.html#mentoria' });
    return { enviados: await enfileirar(env, ctx, msg, (uid, p) => p.adm === true && (!p.prefs || p.prefs.mentoria !== false)) };
  },
  '/admin/alerta': async (req, env, ctx) => {
    const { adm } = await quem(req, env);
    if (!adm) throw falha(403, 'Só o administrador envia alertas.');
    const b = await corpoJson(req);
    const titulo = String(b.titulo || '').trim().slice(0, 80), texto = String(b.texto || '').trim().slice(0, 300);
    if (!titulo || !texto) throw falha(400, 'Escreva o título e o texto do alerta.');
    let link = String(b.link || '').trim();
    if (link && !/^\/[^/]/.test(link) && !/^https:\/\//.test(link)) link = '';
    const uf = UFS.includes(b.uf) ? b.uf : '';
    const msg = { tipo: 'avisos', titulo, texto, link: link || '/', tag: 'aviso-' + Date.now() };
    const n = await enfileirar(env, ctx, msg, (uid, p) => p.prefs && p.prefs.avisos !== false && (!uf || p.prefs.uf === uf || p.adm === true));
    await registrarHist(env, msg, uf);
    return { alvos: n };
  },
  '/admin/push': async (req, env) => {
    const { adm } = await quem(req, env);
    if (!adm) throw falha(403, 'Só o administrador.');
    const [push, membros, estado, fila] = await Promise.all([db(env, 'GET', 'push'), db(env, 'GET', 'members'), db(env, 'GET', 'alertas/estado'), db(env, 'GET', 'alertas/fila?shallow=true')]);
    const r = { membros: 0, aparelhos: 0, tipos: {}, ufs: {}, estado: estado || null, filaPendente: Object.keys(fila || {}).length };
    Object.entries(push || {}).forEach(([uid, p]) => {
      const n = Object.keys(p.tok || {}).length;
      if (!n) return;
      r.membros++; r.aparelhos += n;
      TIPOS_PUSH.forEach(t => { if (!p.prefs || p.prefs[t] !== false) r.tipos[t] = (r.tipos[t] || 0) + 1; });
      if (p.prefs && p.prefs.uf) r.ufs[p.prefs.uf] = (r.ufs[p.prefs.uf] || 0) + 1;
    });
    r.ultimos = (await ultimosAlertas(env)).alertas;
    return r;
  },
};

// ── fila de entrega ────────────────────────────────────────────────────────
// Monta a lista de aparelhos de quem pode receber (plano pago em dia, ou admin) e entrega o primeiro lote já.
async function enfileirar(env, ctx, msg, filtro, cache, semEntregar) {
  const [push, membros] = cache || await Promise.all([db(env, 'GET', 'push'), db(env, 'GET', 'members')]);
  const alvos = [];
  Object.entries(push || {}).forEach(([uid, p]) => {
    if (!p || !p.tok) return;
    if (msg.tipo && msg.tipo !== 'mentoria' && msg.tipo !== 'avisos' && p.prefs && p.prefs[msg.tipo] === false) return;
    if (!filtro(uid, p)) return;
    Object.entries(p.tok).forEach(([id, t]) => { if (t && t.s) alvos.push({ u: uid, i: id, s: t.s }); });
  });
  if (!alvos.length) return 0;
  await db(env, 'POST', 'alertas/fila', { msg, alvos, criado: Date.now() });
  if (semEntregar) return alvos.length;
  const entrega = entregarFila(env, LOTE - 6).catch(e => console.error('fila', e.message));
  if (ctx && ctx.waitUntil) ctx.waitUntil(entrega); else await entrega;
  return alvos.length;
}
async function entregarFila(env, orcamento) {
  const fila = await db(env, 'GET', 'alertas/fila?orderBy="$key"&limitToFirst=3');
  if (!fila) return 0;
  let feitos = 0;
  const apagar = {};
  for (const [id, item] of Object.entries(fila)) {
    if (orcamento <= 0) break;
    const alvos = item.alvos || [];
    const agora = alvos.slice(0, orcamento), resto = alvos.slice(orcamento);
    orcamento -= agora.length;
    const msg = { titulo: item.msg.titulo, texto: item.msg.texto, link: item.msg.link || '/', tag: item.msg.tag || '' };
    const res = await Promise.all(agora.map(a => enviarPush(env, a.s, msg)));
    res.forEach((r, k) => { if (r === 'ok') feitos++; else if (r === 'sumiu') apagar['push/' + agora[k].u + '/tok/' + agora[k].i] = null; else console.warn('push', r); });
    apagar['alertas/fila/' + id] = resto.length ? { ...item, alvos: resto } : null;
    if (Date.now() - (item.criado || 0) > 6 * 3600e3) apagar['alertas/fila/' + id] = null;   // velho demais: descarta
  }
  if (Object.keys(apagar).length) await db(env, 'PATCH', '', apagar);
  return feitos;
}
async function registrarHist(env, msg, uf) {
  await db(env, 'POST', 'alertas/hist', { tipo: msg.tipo || 'avisos', titulo: msg.titulo, texto: msg.texto, link: msg.link || '/', uf: uf || null, ts: Date.now() });
}
async function ultimosAlertas(env) {
  const h = (await db(env, 'GET', 'alertas/hist?orderBy="$key"&limitToLast=15')) || {};
  return { alertas: Object.values(h).sort((a, b) => b.ts - a.ts).map(a => ({ tipo: a.tipo, titulo: a.titulo, texto: a.texto, link: a.link, uf: a.uf || null, ts: a.ts })) };
}

// ── verificação automática (gatilho agendado) ──────────────────────────────
const SOL_TXT = {
  7: ['☀️ TEMPESTADE SOLAR FORTE (G3)', 'Índice Kp 7 atingido. GPS e rádio HF podem falhar; redes elétricas em alerta.'],
  8: ['☀️ TEMPESTADE SOLAR SEVERA (G4)', 'Índice Kp 8 atingido. Falhas em GPS, rádio HF e satélites são prováveis. Tenha rádio e lanternas à mão.'],
  9: ['☀️ TEMPESTADE SOLAR EXTREMA (G5)', 'Índice Kp 9 atingido: o nível mais alto da escala da NOAA. Risco a redes elétricas e comunicações.'],
};
function traduzLugar(p) { return String(p || 'local não informado').replace(/ of /g, ' de ').replace(/^near /i, 'perto de '); }
async function eventosSismo() {
  const r = await fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=3&orderby=time&limit=200&starttime=' + new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19), { cf: { cacheTtl: 30 } });
  if (!r.ok) throw new Error('USGS ' + r.status);
  const d = await r.json(), ev = [];
  (d.features || []).forEach(f => {
    const p = f.properties || {}, [lon, lat] = (f.geometry && f.geometry.coordinates) || [0, 0], M = Number(p.mag) || 0;
    const brasil = /brazil/i.test(p.place || '');
    const americaSul = lat > -56 && lat < 13 && lon > -82 && lon < -34;
    if (!(brasil && M >= 3 || americaSul && M >= 6.5 || M >= 7)) return;
    const tsu = p.tsunami === 1 ? ' Há alerta de tsunami: siga as autoridades locais.' : '';
    ev.push({
      chave: 'q_' + f.id, tipo: 'sismo', tag: 'sismo-' + f.id, link: '/defesa-civil.html',
      titulo: (brasil ? '🇧🇷 TREMOR NO BRASIL' : M >= 8 ? '🌍 TERREMOTO GIGANTE' : '🌍 TERREMOTO FORTE') + ' — M' + M.toFixed(1),
      texto: traduzLugar(p.place) + ' · prof. ' + Math.round((f.geometry.coordinates[2]) || 0) + ' km · ' + new Date(p.time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) + ' (Brasília).' + tsu,
    });
  });
  return ev;
}
async function eventosSol() {
  const r = await fetch('https://services.swpc.noaa.gov/products/alerts.json', { cf: { cacheTtl: 30 } });
  if (!r.ok) throw new Error('NOAA ' + r.status);
  const ev = [];
  (await r.json()).forEach(a => {
    const t = Date.parse(String(a.issue_datetime || '').replace(' ', 'T') + 'Z');
    if (!(Date.now() - t < 6 * 3600e3)) return;
    const msg = String(a.message || ''), cod = (msg.match(/Message Code:\s*([A-Z0-9]+)/) || [])[1] || '';
    const k = (cod.match(/^ALTK0([7-9])$/) || [])[1];
    if (k) ev.push({ chave: 's_' + cod + '_' + Math.floor(t / 432e5), tipo: 'solar', tag: 'solar-k', link: '/solar.html', titulo: SOL_TXT[k][0], texto: SOL_TXT[k][1] });
    const x = msg.match(/X-ray Class:\s*(X\d+(?:\.\d+)?)/) || (/^SUMX/.test(cod) && msg.match(/exceeded\s+(X\d+)/));
    if (x) ev.push({ chave: 's_X_' + Math.floor(t / 216e5), tipo: 'solar', tag: 'solar-x', link: '/solar.html', titulo: '☀️ EXPLOSÃO SOLAR CLASSE ' + x[1], texto: 'Erupção forte registrada pela NOAA: rádio HF pode ficar mudo por até 1 hora no lado iluminado da Terra.' });
  });
  return ev;
}
async function rodarAlertas(env) {
  const estado = { ts: Date.now(), erros: {} };
  const fontes = await Promise.all([
    eventosSismo().catch(e => { estado.erros.usgs = e.message; return []; }),
    eventosSol().catch(e => { estado.erros.noaa = e.message; return []; }),
  ]);
  const eventos = [].concat(...fontes);
  const vistos = await db(env, 'GET', 'alertas/vistos');
  const mudar = {}, unicos = {};
  const novos = eventos.filter(e => !(vistos && vistos[e.chave]) && !unicos[e.chave] && (unicos[e.chave] = 1));
  // primeira execução: só anota o que já existe (não dispara alertas antigos de uma vez).
  // Depois, no máximo 3 por execução (limite de chamadas da Cloudflare); o resto sai na próxima.
  const agora = vistos ? novos.slice(0, 3) : [];
  (vistos ? agora : novos).forEach(e => { mudar['alertas/vistos/' + e.chave] = Date.now(); });
  // limpa marcas com mais de 30 dias
  Object.entries(vistos || {}).forEach(([k, t]) => { if (Date.now() - t > 30 * 864e5) mudar['alertas/vistos/' + k] = null; });
  if (!vistos) mudar['alertas/vistos/_inicio'] = Date.now();
  estado.novos = agora.length;
  mudar['alertas/estado'] = estado;
  await db(env, 'PATCH', '', mudar);
  if (agora.length) {
    const cache = await Promise.all([db(env, 'GET', 'push'), db(env, 'GET', 'members')]);
    for (const e of agora) {
      const msg = { tipo: e.tipo, titulo: e.titulo, texto: e.texto, link: e.link, tag: e.tag };
      await registrarHist(env, msg);
      await enfileirar(env, null, msg, () => true, cache, true);
    }
  }
  await entregarFila(env, agora.length ? LOTE - 8 : LOTE);
}
