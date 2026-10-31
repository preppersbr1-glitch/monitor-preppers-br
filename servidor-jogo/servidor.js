"use strict";
// ======================================================================
//  ZONA MORTA — servidor multiplayer
//  Node.js + WebSocket. O servidor manda no mundo: posições, monstros,
//  combate, loot, NPCs, missões e contas. O navegador só desenha e pede.
// ======================================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const D = require("./dados.js");
const { T, TP, ITENS, PRECO, MONS, MAPA, R, chance, clamp, cheb, norm, xpNivel, tileEm, pzEm } = D;

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "dados");
const ORIGENS = (process.env.ORIGENS || "").split(",").map(s => s.trim()).filter(Boolean);
const MAX_JOGADORES = +(process.env.MAX_JOGADORES || 150);
const EXIGIR_CONTA = process.env.EXIGIR_CONTA === "1";   // "1" = só conta do site; padrão: login próprio do jogo (nome + senha)
const FIREBASE_PROJETO = process.env.FIREBASE_PROJETO || "comunidade-preppers-br-f5253";
const TEMPLO = { mapa: "sup", x: 17, y: 36 };
const MAX_INV = 24;
const VISAO_X = 10, VISAO_Y = 8;

// ---------------------------------------------------------------- MUNDO
MAPA.sup = D.gerarSup();
MAPA.esg = D.gerarEsg();
const MAPAS_ENVIO = {};
for (const k of ["sup", "esg"]) {
  const M = MAPA[k];
  MAPAS_ENVIO[k] = { W: M.W, H: M.H, t: Buffer.from(M.t).toString("base64"), pz: Buffer.from(M.pz).toString("base64") };
}
const inicio = Date.now();
const agora = () => Date.now() - inicio;
let tJogo = 0;

// ---------------------------------------------------------------- CONTAS (persistência em arquivo)
let CONTAS = {};
const ARQ = path.join(DATA_DIR, "contas.json");
try { fs.mkdirSync(DATA_DIR, { recursive: true }); CONTAS = JSON.parse(fs.readFileSync(ARQ, "utf8")); console.log(`Contas carregadas: ${Object.keys(CONTAS).length}`); }
catch (e) { console.log("Sem arquivo de contas ainda — começando do zero."); }
let contasSujas = false;
function gravarContas() {
  if (!contasSujas) return; contasSujas = false;
  try { const tmp = ARQ + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(CONTAS)); fs.renameSync(tmp, ARQ); }
  catch (e) { console.error("Erro ao gravar contas:", e.message); }
}
setInterval(gravarContas, 20000);
const hashSenha = (senha, salt) => crypto.scryptSync(senha, salt, 32).toString("hex");

// ---------------------------------------------------------------- CONTA DO SITE (Firebase Auth)
// Confere o "ID token" do Firebase que o navegador manda: assinatura RSA do Google, projeto e validade.
const https = require("https");
let CERTS = null, certsAte = 0;
function baixarCerts() {
  if (process.env.TESTE_CERT) return Promise.resolve({ teste: fs.readFileSync(process.env.TESTE_CERT, "utf8") });
  if (CERTS && Date.now() < certsAte) return Promise.resolve(CERTS);
  return new Promise((ok, falha) => {
    https.get("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com", res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try {
        CERTS = JSON.parse(d); const m = /max-age=(\d+)/.exec(res.headers["cache-control"] || "");
        certsAte = Date.now() + (m ? +m[1] : 3600) * 1000; ok(CERTS); } catch (e) { falha(e); } });
    }).on("error", falha);
  });
}
async function verificarToken(token) {
  const p = String(token || "").split("."); if (p.length !== 3) throw new Error("token inválido");
  const cab = JSON.parse(Buffer.from(p[0], "base64url").toString()), dados = JSON.parse(Buffer.from(p[1], "base64url").toString());
  if (cab.alg !== "RS256") throw new Error("algoritmo inválido");
  const certs = await baixarCerts(); const cert = process.env.TESTE_CERT ? certs.teste : certs[cab.kid];
  if (!cert) throw new Error("chave desconhecida");
  const ok = crypto.createVerify("RSA-SHA256").update(p[0] + "." + p[1]).verify(cert, Buffer.from(p[2], "base64url"));
  const agoraS = Math.floor(Date.now() / 1000);
  if (!ok) throw new Error("assinatura inválida");
  if (dados.aud !== FIREBASE_PROJETO || dados.iss !== "https://securetoken.google.com/" + FIREBASE_PROJETO) throw new Error("projeto errado");
  if (!(dados.exp > agoraS) || dados.iat > agoraS + 300 || !dados.sub) throw new Error("token vencido");
  return { uid: dados.sub, email: dados.email || "" };
}

// ---------------------------------------------------------------- CONTA DE GAME MASTER
// Só o hash da senha fica aqui (o repositório é público). A senha está com o dono do jogo.
const GM = { nome: "GM Julio", salt: "ad6acc5ae5050dc4e724c51f", hash: "95369405025fff9f253756d14d5bf982e2912b806e6882cf36095ed0640b3605" };
const NIVEL_MAX = 300;
const nomeReservado = n => /^(gm|adm|admin|god)\b/i.test(norm(n)) && norm(n) !== norm(GM.nome);
function personagemGM() {
  const s = novoPersonagem(GM.nome);
  Object.assign(s, { lvl: NIVEL_MAX, xp: xpNivel(NIVEL_MAX), fome: 100, sede: 100, rad: 0,
    sk: { corpo: { v: 150, t: 0 }, dist: { v: 150, t: 0 }, def: { v: 150, t: 0 } },
    eq: { arma: "motosserra", corpo: "colete_bal", pernas: "caneleira", pes: "coturno", cabeca: "capacete_mil", escudo: null, luz: "lanterna" },
    inv: [{ id: "espingarda", q: 1 }, { id: "pistola", q: 1 }, { id: "arco", q: 1 }, { id: "machado", q: 1 }, { id: "escudo_motim", q: 1 },
      { id: "mascara", q: 1 }, { id: "cartucho", q: 999 }, { id: "bala", q: 999 }, { id: "flecha", q: 999 }, { id: "medkit", q: 99 },
      { id: "lata", q: 99 }, { id: "garrafa", q: 99 }, { id: "iodo", q: 99 }, { id: "tampinha", q: 99999 }] });
  s.hp = 145 + s.lvl * 15; return s;
}
function garantirGM() {
  const k = norm(GM.nome); const c = CONTAS[k] || (CONTAS[k] = { save: personagemGM(), criado: Date.now() });
  Object.assign(c, { salt: GM.salt, hash: GM.hash, adm: true }); contasSujas = true;
}

// ---------------------------------------------------------------- PERSONAGEM
const CAMPOS = ["nome", "mapa", "x", "y", "dir", "lvl", "xp", "hp", "fome", "sede", "rad", "sk", "inv", "eq", "quest", "mortes"];
function novoPersonagem(nome) {
  return { nome, mapa: "sup", x: 17, y: 36, dir: 0, lvl: 1, xp: 0, hp: 160, fome: 80, sede: 80, rad: 0,
    sk: { corpo: { v: 10, t: 0 }, dist: { v: 10, t: 0 }, def: { v: 10, t: 0 } },
    inv: [{ id: "lata", q: 2 }, { id: "garrafa", q: 2 }, { id: "bandagem", q: 2 }, { id: "tampinha", q: 25 }, { id: "tampa", q: 1 }],
    eq: { arma: "canivete", corpo: "camiseta", pernas: "jeans", pes: "tenis", cabeca: null, escudo: null, luz: null },
    quest: { ratos: 0, saq: 0, saqMortes: 0, rei: 0, carnica: 0 }, mortes: 0 };
}
// valida um personagem vindo de fora (backup do navegador)
function sanear(s, nome) {
  const b = novoPersonagem(nome); if (!s || typeof s !== "object") return b;
  const num = (v, a, z, d) => (typeof v === "number" && isFinite(v)) ? clamp(Math.floor(v), a, z) : d;
  b.lvl = num(s.lvl, 1, 300, 1); b.xp = num(s.xp, 0, 1e12, 0);
  if (b.xp < xpNivel(b.lvl)) b.xp = xpNivel(b.lvl);
  b.fome = num(s.fome, 0, 100, 80); b.sede = num(s.sede, 0, 100, 80); b.rad = 0; b.mortes = num(s.mortes, 0, 1e6, 0);
  if (s.sk) for (const k of ["corpo", "dist", "def"]) if (s.sk[k]) b.sk[k] = { v: num(s.sk[k].v, 10, 200, 10), t: num(s.sk[k].t, 0, 1e9, 0) };
  if (Array.isArray(s.inv)) b.inv = s.inv.filter(x => x && ITENS[x.id]).slice(0, MAX_INV).map(x => ({ id: x.id, q: num(x.q, 1, 100000, 1) }));
  if (s.eq) for (const k of Object.keys(b.eq)) b.eq[k] = (s.eq[k] && ITENS[s.eq[k]] && ITENS[s.eq[k]].slot === k) ? s.eq[k] : null;
  if (s.quest) for (const k of Object.keys(b.quest)) b.quest[k] = num(s.quest[k], 0, 1e6, 0);
  b.hp = 145 + b.lvl * 15;
  return b;
}
const hpMax = j => 145 + j.lvl * 15;
const ehGM = j => !!j.adm;
const velP = j => Math.max(170, 260 - j.lvl * 3);
const tentativas = v => Math.floor(30 * Math.pow(1.1, v - 10));
function armadura(j) { let a = 0; for (const s of ["cabeca", "corpo", "pernas", "pes"]) if (j.eq[s]) a += ITENS[j.eq[s]].arm || 0; return a; }

// ---------------------------------------------------------------- ESTADO DO MUNDO
const JOG = new Map();     // id -> jogador conectado
let CRI = [];              // criaturas
let CORPOS = [];           // corpos/pilhas
let uid = 1;
const NPCS = [
  { id: "ze", nome: "Seu Zé", mapa: "sup", x: 12, y: 32,
    vende: ["lata", "cereal", "garrafa", "refri", "tocha", "lanterna", "pedra", "flecha", "bala", "cartucho"],
    compra: { cauda: 3, couro: 9, ferrao: 22, sucata: 3, componente: 18, carne_rato: 1, carne_cao: 3, coroa: 400 } },
  { id: "ana", nome: "Doutora Ana", mapa: "sup", x: 21, y: 39, vende: ["bandagem", "medkit", "iodo"], compra: {} },
  { id: "cida", nome: "Dona Cida", mapa: "sup", x: 12, y: 40,
    vende: ["faca", "taco", "pe_cabra", "facao", "machado", "estilingue", "arco", "pistola", "espingarda", "tampa", "escudo_placa", "escudo_motim",
      "bone", "capacete_obra", "mascara", "capacete_mil", "jaqueta", "colete_sucata", "colete_bal", "cargo", "caneleira", "coturno"], compra: "equip" },
  { id: "rocha", nome: "Sargento Rocha", mapa: "sup", x: 23, y: 34, vende: [], compra: {} }
];
const precoCompra = (n, id) => n.compra === "equip" ? ((ITENS[id].slot && PRECO[id]) ? Math.floor(PRECO[id] / 3) : 0) : (n.compra[id] || 0);

// ---------------------------------------------------------------- MENSAGENS
function enviar(j, msg) { if (j.ws.readyState === 1) j.ws.send(JSON.stringify(msg)); }
function ev(j, e) { j.eventos.push(e); }
// evento visível para quem está perto
function evPerto(mapa, x, y, e, raio = 12) { for (const j of JOG.values()) if (j.mapa === mapa && Math.abs(j.x - x) <= raio && Math.abs(j.y - y) <= raio) ev(j, e); }
const logJ = (j, txt, cls) => ev(j, ["log", txt, cls || "c-sis"]);
const texto = (mapa, x, y, txt, cor, fala) => evPerto(mapa, x, y, ["txt", x, y, txt, cor, fala ? 1 : 0]);
const efeito = (mapa, x, y, cor) => evPerto(mapa, x, y, ["fx", x, y, cor]);
const marcarEu = j => { j.sujo = true; };

// ---------------------------------------------------------------- MOVIMENTO E CAMINHO
function livre(m, x, y, ign, monstro) {
  const tl = tileEm(m, x, y); if (TP[tl].b) return false;
  if (monstro && (pzEm(m, x, y) || tl === T.BUEIRO || tl === T.ESCADA)) return false;
  for (const c of CRI) if (c !== ign && c.mapa === m && c.x === x && c.y === y) return false;
  for (const n of NPCS) if (n.mapa === m && n.x === x && n.y === y) return false;
  for (const j of JOG.values()) if (j !== ign && j.vivo && j.mapa === m && j.x === x && j.y === y) return false;
  return true;
}
function caminho(m, sx, sy, tx, ty, raio, ent) {
  const M = MAPA[m]; const key = (x, y) => y * M.W + x; const prev = new Map(); const fila = [[sx, sy]]; prev.set(key(sx, sy), -1);
  const ok = (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1 && !(x === tx && y === ty);
  if (ok(sx, sy)) return [];
  let h = 0;
  while (h < fila.length) {
    const [x, y] = fila[h++];
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= M.W || ny >= M.H || prev.has(k)) continue;
      if (Math.abs(nx - sx) > raio || Math.abs(ny - sy) > raio) continue;
      if (!livre(m, nx, ny, ent, true)) continue;
      prev.set(k, key(x, y));
      if (ok(nx, ny)) { const out = []; let c = k; while (c !== key(sx, sy)) { out.unshift([c % M.W, (c / M.W) | 0]); c = prev.get(c); } return out; }
      fila.push([nx, ny]);
    }
  }
  return null;
}
function linhaDeVisao(m, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  while (true) { if (!(x0 === x1 && y0 === y1) && TP[tileEm(m, x0, y0)].op) return false;
    if (x0 === x1 && y0 === y1) return true; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function passo(e, dx, dy) { if (dx) e.dir = dx < 0 ? 2 : 3; else e.dir = dy > 0 ? 0 : 1; e.x += dx; e.y += dy; }

// ---------------------------------------------------------------- INVENTÁRIO
const contar = (j, id) => j.inv.filter(s => s.id === id).reduce((a, s) => a + s.q, 0);
const temItem = (j, id, q = 1) => contar(j, id) >= q;
function darItem(j, id, q = 1) {
  const it = ITENS[id]; let resto = q;
  if (it.st) { const s = j.inv.find(s => s.id === id); if (s) { s.q += q; resto = 0; } else if (j.inv.length < MAX_INV) { j.inv.push({ id, q }); resto = 0; } }
  else while (resto > 0 && j.inv.length < MAX_INV) { j.inv.push({ id, q: 1 }); resto--; }
  if (resto > 0) { largarNoChao(j.mapa, j.x, j.y, id, resto); logJ(j, `Mochila cheia! ${it.n} ficou no chão.`, "c-verm"); }
  marcarEu(j);
}
function tirarItem(j, id, q = 1) {
  for (let i = j.inv.length - 1; i >= 0 && q > 0; i--) { const s = j.inv[i]; if (s.id !== id) continue; const t = Math.min(q, s.q); s.q -= t; q -= t; if (s.q <= 0) j.inv.splice(i, 1); }
  marcarEu(j);
}
function largarNoChao(mapa, x, y, id, q) {
  let p = CORPOS.find(c => c.mapa === mapa && c.x === x && c.y === y && c.pilha);
  if (!p) { p = { id: uid++, mapa, x, y, nome: "Itens no chão", itens: [], ate: agora() + 180000, pilha: 1 }; CORPOS.push(p); }
  const ex = ITENS[id].st && p.itens.find(s => s.id === id); if (ex) ex.q += q; else p.itens.push({ id, q });
}
function usarItem(j, idx) {
  const s = j.inv[idx]; if (!s) return; const it = ITENS[s.id];
  if (it.slot) return equipar(j, idx);
  if (it.t === "comida") { if (j.fome >= 98) return logJ(j, "Você está cheio.", "c-cinza"); j.fome = Math.min(100, j.fome + it.fome); if (it.rad) j.rad += it.rad; if (it.sede) j.sede = Math.min(100, j.sede + it.sede); texto(j.mapa, j.x, j.y, "Nhac", "#e8c060"); }
  else if (it.t === "bebida") { if (j.sede >= 98) return logJ(j, "Você não está com sede.", "c-cinza"); j.sede = Math.min(100, j.sede + it.sede); if (it.rad) j.rad += it.rad; if (it.fome) j.fome = Math.min(100, j.fome + it.fome); texto(j.mapa, j.x, j.y, "Gulp", "#7ac8ff"); }
  else if (it.t === "cura") { if (j.hp >= hpMax(j)) return logJ(j, "Sua vida já está cheia.", "c-cinza"); const h = Math.min(it.hp, hpMax(j) - j.hp); j.hp += h; texto(j.mapa, j.x, j.y, "+" + h, "#4bd16b"); efeito(j.mapa, j.x, j.y, "#4bd16b"); }
  else if (it.t === "antirad") { j.rad = Math.max(0, j.rad - it.rad); texto(j.mapa, j.x, j.y, "-rad", "#9aff6a"); }
  else return;
  if (!ehGM(j)) { s.q--; if (s.q <= 0) j.inv.splice(idx, 1); }
  marcarEu(j);
}
function equipar(j, idx) {
  const s = j.inv[idx], it = ITENS[s.id], slot = it.slot;
  j.inv.splice(idx, 1);
  const dev = []; if (j.eq[slot]) dev.push(j.eq[slot]);
  if (slot === "arma" && it.maos2 && j.eq.escudo) { dev.push(j.eq.escudo); j.eq.escudo = null; }
  if (slot === "escudo" && j.eq.arma && ITENS[j.eq.arma].maos2) { dev.push(j.eq.arma); j.eq.arma = null; }
  j.eq[slot] = s.id; for (const d of dev) darItem(j, d, 1);
  logJ(j, `Você equipou: ${it.n}.`, "c-cinza"); marcarEu(j);
}
function desequipar(j, slot) {
  if (!j.eq.hasOwnProperty(slot) || !j.eq[slot]) return;
  if (j.inv.length >= MAX_INV) return logJ(j, "Mochila cheia.", "c-verm");
  const id = j.eq[slot]; j.eq[slot] = null; darItem(j, id, 1);
}

// ---------------------------------------------------------------- COMBATE
function treinar(j, k) {
  const s = j.sk[k]; s.t++;
  if (s.t >= tentativas(s.v)) { s.t = 0; s.v++; logJ(j, `Você avançou em ${{ corpo: "Corpo a corpo", dist: "Distância", def: "Defesa" }[k]} para ${s.v}.`); marcarEu(j); }
}
function ganharXP(j, n) {
  j.xp += n; ev(j, ["txt", j.x, j.y, String(n), "#ffffff", 0]); logJ(j, `Você ganhou ${n} pontos de experiência.`, "c-cinza");
  while (j.xp >= xpNivel(j.lvl + 1)) { j.lvl++; j.hp = hpMax(j); logJ(j, `Você avançou do Nível ${j.lvl - 1} para o Nível ${j.lvl}.`, "c-ouro"); texto(j.mapa, j.x, j.y, "LEVEL UP!", "#e8c060"); efeito(j.mapa, j.x, j.y, "#e8c060"); }
  marcarEu(j);
}
function ataqueJogador(j, now) {
  const m = j.alvo; if (!m) return;
  if (m.hp <= 0 || !CRI.includes(m) || m.mapa !== j.mapa || cheb(j, m) > 9) { j.alvo = null; ev(j, ["alvo", null]); return; }
  if (now < j.proxAtk || pzEm(j.mapa, j.x, j.y)) return;
  const arma = ITENS[j.eq.arma], dist = cheb(j, m), ranged = arma && arma.alc;
  if (ranged) {
    if (dist > arma.alc || !linhaDeVisao(j.mapa, j.x, j.y, m.x, m.y)) return;
    if (ehGM(j)) {} else if (!temItem(j, arma.mun)) { if (now - (j.avisoMun || 0) > 4000) { j.avisoMun = now; logJ(j, `Sem munição (${ITENS[arma.mun].n})!`, "c-verm"); } return; }
    else tirarItem(j, arma.mun, 1);
  } else if (dist > 1) return;
  j.proxAtk = now + 1500;
  const d = MONS[m.tipo], sk = ranged ? j.sk.dist : j.sk.corpo;
  j.dir = Math.abs(m.x - j.x) >= Math.abs(m.y - j.y) ? (m.x > j.x ? 3 : 2) : (m.y > j.y ? 0 : 1);
  if (ranged) evPerto(j.mapa, j.x, j.y, ["proj", j.x, j.y, m.x, m.y, "#ffffff"]);
  treinar(j, ranged ? "dist" : "corpo");
  m.aggro = j.id;
  if (ranged && !chance(Math.min(92, 55 + sk.v * 1.1))) { texto(m.mapa, m.x, m.y, "errou", "#aaaaaa"); return; }
  const atk = arma ? arma.atk : 4, max = Math.floor(atk * (sk.v + 10) / 22 + j.lvl / 3);
  const dano = R(Math.ceil(max * .45), max) - R(0, d.arm);
  if (dano <= 0) { texto(m.mapa, m.x, m.y, "puff", "#bbbbbb"); return; }
  m.hp -= dano; m.danos[j.id] = (m.danos[j.id] || 0) + dano;
  texto(m.mapa, m.x, m.y, String(dano), "#ff3030"); efeito(m.mapa, m.x, m.y, "#aa0000"); evPerto(m.mapa, m.x, m.y, ["hit", m.id]);
  if (m.hp <= 0) matar(m);
}
function matar(m) {
  const d = MONS[m.tipo];
  CRI = CRI.filter(c => c !== m);
  if (m.spawn) { m.spawn.vivos--; m.spawn.ultMorte = agora(); }
  if (m.mestre) m.mestre.invocados--;
  const itens = [];
  if (!m.invocado) for (const [id, pct, mn, mx] of d.loot) if (chance(pct)) { const q = R(mn, mx); if (ITENS[id].st) itens.push({ id, q }); else for (let i = 0; i < q; i++) itens.push({ id, q: 1 }); }
  CORPOS.push({ id: uid++, mapa: m.mapa, x: m.x, y: m.y, nome: `Corpo de ${d.n}`, itens, ate: agora() + (d.boss ? 240000 : 90000), tipo: m.tipo });
  // XP dividido pelo dano causado
  const total = Object.values(m.danos).reduce((a, b) => a + b, 0) || 1;
  for (const [jid, dmg] of Object.entries(m.danos)) {
    const j = JOG.get(+jid); if (!j) continue;
    logJ(j, `${d.n} foi derrotado.${itens.length ? " Clique no corpo para ver o loot." : ""}`, "c-cinza");
    if (!m.invocado) ganharXP(j, Math.max(1, Math.round(d.xp * dmg / total)));
    if (d.saq && j.quest.saq === 1) { j.quest.saqMortes++; logJ(j, `Missão: saqueadores ${Math.min(10, j.quest.saqMortes)}/10.`, "c-verde"); marcarEu(j); }
    if (m.tipo === "carnica" && j.quest.carnica <= 1) { j.quest.carnica = 2; logJ(j, "Carniça está morto! Volte ao Sargento Rocha.", "c-ouro"); marcarEu(j); }
    if (m.tipo === "rei") logJ(j, "O Rei dos Esgotos caiu! Pegue a COROA no corpo dele.", "c-ouro");
  }
  if (d.boss) for (const j of JOG.values()) logJ(j, `★ ${d.n} foi derrotado por ${Object.keys(m.danos).map(k => JOG.get(+k)).filter(Boolean).map(j => j.nome).join(", ")}!`, "c-ouro");
  for (const j of JOG.values()) if (j.alvo === m) { j.alvo = null; ev(j, ["alvo", null]); }
}
function ataqueMonstro(m, d, j, now, ranged) {
  m.proxAtk = now + 2000;
  if (ranged) evPerto(m.mapa, m.x, m.y, ["proj", m.x, m.y, j.x, j.y, d.proj || "#ffffff"]);
  if (ehGM(j)) { texto(j.mapa, j.x, j.y, "imune", "#e8c060"); return; }
  let dano = R(0, d.atk);
  const esc = ITENS[j.eq.escudo];
  if (esc) { treinar(j, "def"); if (dano > 0 && chance(Math.min(55, esc.def * 1.4 + j.sk.def.v * .5))) { texto(j.mapa, j.x, j.y, "bloqueou", "#7ac8ff"); return; } }
  const arm = armadura(j); dano -= R(Math.floor(arm / 2), arm);
  if (dano <= 0) { texto(j.mapa, j.x, j.y, "puff", "#bbbbbb"); return; }
  j.hp -= dano; texto(j.mapa, j.x, j.y, String(dano), "#ff3030"); efeito(j.mapa, j.x, j.y, "#aa0000");
  logJ(j, `Você perdeu ${dano} de vida por um ataque de ${d.n}.`, "c-cinza");
  if (d.rad && !(j.eq.cabeca && ITENS[j.eq.cabeca].antirad)) j.rad += d.rad;
  if (j.hp <= 0) morrer(j, `por ${d.n}`);
}
function morrer(j, causa) {
  if (ehGM(j)) { j.hp = hpMax(j); return; }
  const perda = Math.floor(j.xp * .1); j.xp -= perda; while (j.lvl > 1 && j.xp < xpNivel(j.lvl)) j.lvl--;
  const tamp = Math.floor(contar(j, "tampinha") * .1); if (tamp) tirarItem(j, "tampinha", tamp);
  j.mortes++;
  CORPOS.push({ id: uid++, mapa: j.mapa, x: j.x, y: j.y, nome: `Corpo de ${j.nome}`, itens: [], ate: agora() + 60000, tipo: "player" });
  for (const o of JOG.values()) if (o !== j && o.mapa === j.mapa && cheb(o, j) <= 12) logJ(o, `${j.nome} morreu ${causa}.`, "c-verm");
  Object.assign(j, { mapa: TEMPLO.mapa, x: TEMPLO.x, y: TEMPLO.y, hp: hpMax(j), rad: 0, alvo: null, npc: null, filaPassos: [] });
  j.fome = Math.max(j.fome, 60); j.sede = Math.max(j.sede, 60);
  ev(j, ["morte", causa, perda, tamp]); ev(j, ["alvo", null]); ev(j, ["npc", null]);
  enviarPos(j); marcarEu(j);
}
function enviarPos(j) { ev(j, ["pos", j.mapa, j.x, j.y]); }

// ---------------------------------------------------------------- NPCs E MISSÕES
function missao(j) {
  const q = j.quest; marcarEu(j);
  if (q.ratos === 0) { q.ratos = 1; return "Os ratos mutantes estão roendo nossos estoques. Traga 5 CAUDAS DE RATO e eu te recompenso. Tem muitos perto da estrada leste."; }
  if (q.ratos === 1) { if (!temItem(j, "cauda", 5)) return `Ainda faltam caudas. Você tem ${contar(j, "cauda")}/5.`;
    tirarItem(j, "cauda", 5); q.ratos = 2; darItem(j, "capacete_obra", 1); darItem(j, "tampinha", 60); ganharXP(j, 300);
    return "Bom trabalho, recruta! Tome este capacete e 60 tampinhas. Volte quando quiser outra MISSÃO."; }
  if (q.saq === 0) { q.saq = 1; q.saqMortes = 0; return "Saqueadores dominam as ruínas da cidade, a leste. Elimine 10 deles. Atiradores contam. Pode levar amigos!"; }
  if (q.saq === 1) { if (q.saqMortes < 10) return `Saqueadores eliminados: ${q.saqMortes}/10. Continue.`;
    q.saq = 2; darItem(j, "pistola", 1); darItem(j, "bala", 30); ganharXP(j, 1500); return "A cidade está respirando de novo. Tome este revólver e 30 balas. Quando estiver pronto, peça outra MISSÃO."; }
  if (q.rei === 0) { q.rei = 1; return "Tem algo grande no ESGOTO. Os ratos obedecem a ele. Desça pelo BUEIRO na cidade e me traga a COROA do Rei dos Esgotos."; }
  if (q.rei === 1) { if (!temItem(j, "coroa", 1)) return "Sem a coroa, sem conversa. O bueiro fica na cidade, perto do cruzamento.";
    tirarItem(j, "coroa", 1); q.rei = 2; darItem(j, "colete_bal", 1); ganharXP(j, 4000); return "Pela minha farda... você conseguiu! Este colete balístico é seu. Agora só falta UMA MISSÃO."; }
  if (q.carnica === 0) { q.carnica = 1; return "Carniça, o Senhor da Estrada. Ele mora num covil murado no extremo SUDOESTE do deserto radioativo. Junte um grupo e acabe com ele."; }
  if (q.carnica === 1) return "Carniça ainda respira. O covil fica no sudoeste do deserto. Leve medkits, máscara de gás e companhia.";
  if (q.carnica === 2) { q.carnica = 3; ganharXP(j, 15000); darItem(j, "tampinha", 2000);
    for (const o of JOG.values()) logJ(o, `★ ${j.nome} se tornou HERÓI DO ABRIGO ESPERANÇA! ★`, "c-ouro");
    return "Carniça está morto. Você é o Herói do Abrigo Esperança. 2000 tampinhas e minha eterna gratidão."; }
  return "Não tenho mais missões, herói. Mas o mundo lá fora continua perigoso — continue ficando forte.";
}
const OLA = {
  ze: j => `Opa, ${j.nome}! Tenho comida, água, luz e munição. Diga TROCAR. Também compro as tralhas que você achar lá fora.`,
  ana: j => `Olá, ${j.nome}. Posso CURAR seus ferimentos ou tirar sua RADIAÇÃO. Também tenho remédios para TROCAR.`,
  cida: j => `Hm. ${j.nome}, né? Armas e proteção. Diga TROCAR. Compro equipamento usado por um terço do preço.`,
  rocha: j => `Sentido, ${j.nome}! Sargento Rocha, defensor do Abrigo Esperança. Temos uma MISSÃO pra quem tem coragem.`
};
function respostaNpc(n, j, t) {
  if (n.id === "ze") { if (/troca|compr|vend|trade/.test(t)) { ev(j, ["trade", "ze"]); return "Dá uma olhada. Preço justo, palavra de Zé."; }
    if (/agua|sede/.test(t)) return "O poço aqui do lado é de graça. Lá fora, água é ouro.";
    if (/noite|escur|luz/.test(t)) return "De noite não se enxerga um palmo. Leva uma TOCHA ou LANTERNA."; }
  if (n.id === "ana") {
    if (/cura/.test(t)) { if (j.hp >= hpMax(j)) return "Você está inteiro. Vá com cuidado.";
      if (j.lvl > 8) { if (!temItem(j, "tampinha", 15)) return "Para você agora são 15 tampinhas. Remédio está caro."; tirarItem(j, "tampinha", 15); }
      j.hp = hpMax(j); efeito(j.mapa, j.x, j.y, "#4bd16b"); marcarEu(j); return j.lvl > 8 ? "Pronto. 15 tampinhas, obrigada." : "Pronto, novinho. Para iniciantes é de graça."; }
    if (/radia/.test(t)) { if (j.rad < 1) return "Seu contador Geiger está limpo.";
      if (!temItem(j, "tampinha", 20)) return "Descontaminar custa 20 tampinhas."; tirarItem(j, "tampinha", 20); j.rad = 0; marcarEu(j); return "Banho químico feito. Radiação zerada."; }
    if (/troca|compr|trade/.test(t)) { ev(j, ["trade", "ana"]); return "Aqui estão."; } }
  if (n.id === "cida") { if (/troca|compr|vend|trade/.test(t)) { ev(j, ["trade", "cida"]); return "Escolhe logo, que eu tenho mais o que fazer."; }
    if (/radia|mascara/.test(t)) return "Se for pro deserto do sul, leve uma MÁSCARA DE GÁS. A radiação lá come gente viva."; }
  if (n.id === "rocha" && /miss|tarefa|quest|trabalho/.test(t)) return missao(j);
  return null;
}
function npcDiz(n, j, txt) {
  logJ(j, `${n.nome}: ${txt}`, "c-npc");
  texto(n.mapa, n.x, n.y, txt.length > 46 ? txt.slice(0, 44) + "…" : txt, "#7ac8ff", true);
}
const LUGARES = { abrigo: ["sup", 17, 36], cidade: ["sup", 66, 31], mata: ["sup", 20, 10], lago: ["sup", 39, 20], deserto: ["sup", 30, 54],
  covil: ["sup", 11, 60], esgoto: ["esg", 5, 5], rei: ["esg", 34, 26], bueiro: ["sup", 77, 30] };
function lugarLivre(mapa, x, y) {
  for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy; const M = MAPA[mapa]; if (nx < 1 || ny < 1 || nx >= M.W - 1 || ny >= M.H - 1) continue;
    if (livre(mapa, nx, ny, null, false) && tileEm(mapa, nx, ny) !== T.BUEIRO && tileEm(mapa, nx, ny) !== T.ESCADA) return [nx, ny]; }
  return null;
}
function comandoGM(j, txt) {
  const [cmd, ...a] = txt.slice(1).trim().split(/\s+/); const c = norm(cmd || "");
  const ok = (m) => logJ(j, m, "c-ouro");
  if (c === "ajuda" || c === "help") return ok("Comandos: /ir <abrigo|cidade|mata|lago|deserto|covil|esgoto|rei|bueiro> · /ir x y [sup|esg] · /item <id> [qtd] · /itens · /nivel <n> · /invocar <monstro> [qtd] · /monstros · /matar · /invisivel · /hora <0-23> · /quem");
  if (c === "ir") {
    let mapa, x, y;
    if (LUGARES[norm(a[0] || "")]) [mapa, x, y] = LUGARES[norm(a[0])];
    else if (a.length >= 2 && !isNaN(a[0]) && !isNaN(a[1])) { mapa = a[2] === "esg" ? "esg" : (a[2] === "sup" ? "sup" : j.mapa); x = +a[0]; y = +a[1]; }
    else return ok("Use: /ir cidade  ou  /ir 40 20  (mapas: sup, esg)");
    const p = lugarLivre(mapa, x | 0, y | 0); if (!p) return ok("Não achei lugar livre ali.");
    Object.assign(j, { mapa, x: p[0], y: p[1], alvo: null, filaPassos: [] }); enviarPos(j); ev(j, ["alvo", null]); efeito(j.mapa, j.x, j.y, "#e8c060");
    return ok(`Teletransportado para ${mapa === "esg" ? "esgoto" : "superfície"} ${p[0]},${p[1]}.`);
  }
  if (c === "item") { const id = a[0]; if (!ITENS[id]) return ok("Item não existe. Veja /itens"); darItem(j, id, clamp(+a[1] || 1, 1, 99999)); return ok(`Criado: ${ITENS[id].n}.`); }
  if (c === "itens") return ok("Itens: " + Object.keys(ITENS).join(", "));
  if (c === "nivel") { const n = clamp(+a[0] | 0, 1, NIVEL_MAX); j.lvl = n; j.xp = xpNivel(n); j.hp = hpMax(j); marcarEu(j); return ok(`Nível ${n}.`); }
  if (c === "monstros") return ok("Monstros: " + Object.keys(MONS).join(", "));
  if (c === "invocar") { const t = a[0]; if (!MONS[t]) return ok("Monstro não existe. Veja /monstros"); let n = 0;
    for (let i = 0; i < clamp(+a[1] || 1, 1, 10); i++) { const p = lugarLivre(j.mapa, j.x + R(-2, 2), j.y + R(-2, 2)); if (!p || pzEm(j.mapa, p[0], p[1])) continue;
      CRI.push({ id: uid++, tipo: t, mapa: j.mapa, x: p[0], y: p[1], dir: 0, hp: MONS[t].hp, proxMov: 0, proxAtk: 0, aggro: null, invocados: 0, danos: {} }); n++; efeito(j.mapa, p[0], p[1], "#ff5050"); }
    return ok(`Invocado: ${n}× ${MONS[t].n}.`); }
  if (c === "matar") { let n = 0; for (const m of [...CRI]) if (m.mapa === j.mapa && cheb(m, j) <= 7) { m.danos = { [j.id]: 1 }; m.hp = 0; matar(m); n++; } return ok(`${n} criatura(s) eliminada(s).`); }
  if (c === "invisivel") { j.invisivel = !j.invisivel; for (const m of CRI) if (m.aggro === j.id) m.aggro = null; return ok(j.invisivel ? "Invisível: monstros te ignoram." : "Visível de novo."); }
  if (c === "hora") { const h = clamp(+a[0] || 0, 0, 23); tJogo = (((h - 9 + 24) % 24) / 24) * 20 * 60 * 1000; return ok(`Hora do mundo: ${h}:00.`); }
  if (c === "quem") return ok(`Online (${JOG.size}): ` + [...JOG.values()].map(o => `${o.nome} [${o.lvl}] ${o.mapa} ${o.x},${o.y}`).join(" · "));
  return ok("Comando desconhecido. Digite /ajuda");
}
function fala(j, txtBruto) {
  const txt = String(txtBruto || "").replace(/[<>]/g, "").slice(0, 80).trim(); if (!txt) return;
  if (txt[0] === "/") { if (ehGM(j)) comandoGM(j, txt); else logJ(j, "Comandos são só para o Game Master.", "c-cinza"); return; }
  const now = agora(); if (now - (j.ultFala || 0) < 300) return; j.ultFala = now;
  // todo mundo perto ouve (como o "say" do Tibia)
  for (const o of JOG.values()) if (o.mapa === j.mapa && cheb(o, j) <= 9) ev(o, ["log", `${j.nome} [${j.lvl}]: ${txt}`, o === j ? "c-eu" : "c-ouvir"]);
  texto(j.mapa, j.x, j.y, txt.length > 46 ? txt.slice(0, 44) + "…" : txt, "#ffff66", true);
  const t = norm(txt);
  if (/^(oi|ola|hi|hello|bom dia|boa tarde|boa noite|e ai)/.test(t)) {
    const n = NPCS.filter(n => n.mapa === j.mapa && cheb(j, n) <= 3).sort((a, b) => cheb(j, a) - cheb(j, b))[0];
    if (n) { j.npc = n; ev(j, ["npc", n.id]); npcDiz(n, j, OLA[n.id](j)); }
    return;
  }
  const n = j.npc; if (!n) return;
  if (/tchau|bye|adeus|ate mais/.test(t)) { npcDiz(n, j, `Até mais, ${j.nome}.`); j.npc = null; ev(j, ["npc", null]); return; }
  const r = respostaNpc(n, j, t);
  npcDiz(n, j, r || "Hm? Não entendi.");
}
function comprar(j, nid, id, q) {
  const n = NPCS.find(n => n.id === nid); q = clamp(q | 0, 1, 100);
  if (!n || j.npc !== n || cheb(j, n) > 4 || !n.vende.includes(id)) return;
  if (!ITENS[id].st) q = 1;
  const p = ehGM(j) ? 0 : PRECO[id] * q; if (!temItem(j, "tampinha", p)) return;
  if (!ITENS[id].st && j.inv.length >= MAX_INV) return logJ(j, "Mochila cheia.", "c-verm");
  tirarItem(j, "tampinha", p); darItem(j, id, q); logJ(j, `Você comprou ${q}× ${ITENS[id].n} por ${p} tampinhas.`, "c-cinza");
}
function vender(j, nid, id, q) {
  const n = NPCS.find(n => n.id === nid); if (!n || j.npc !== n || cheb(j, n) > 4 || !ITENS[id]) return;
  const pr = precoCompra(n, id); q = clamp(q | 0, 1, contar(j, id)); if (!pr || !q) return;
  tirarItem(j, id, q); darItem(j, "tampinha", pr * q); logJ(j, `Você vendeu ${q}× ${ITENS[id].n} por ${pr * q} tampinhas.`, "c-cinza");
}

// ---------------------------------------------------------------- SPAWNS
const SPAWNS = D.DEF_SPAWNS.map(([mapa, tipo, x, y, r, q, tempo]) => ({ mapa, tipo, x, y, r, q, tempo: tempo * 1000, vivos: 0, ultMorte: -1e9 }));
function gerarMonstro(s) {
  for (let k = 0; k < 40; k++) {
    const x = s.x + R(-s.r, s.r), y = s.y + R(-s.r, s.r);
    if (!livre(s.mapa, x, y, null, true)) continue;
    if (k < 35 && [...JOG.values()].some(j => j.mapa === s.mapa && cheb(j, { x, y }) < 6)) continue;
    const d = MONS[s.tipo];
    CRI.push({ id: uid++, tipo: s.tipo, mapa: s.mapa, x, y, dir: 0, hp: d.hp, spawn: s, proxMov: 0, proxAtk: 0, aggro: null, invocados: 0, danos: {} });
    s.vivos++; return true;
  }
  return false;
}
for (const s of SPAWNS) for (let i = 0; i < s.q; i++) gerarMonstro(s);
garantirGM();

// ---------------------------------------------------------------- LOOP DO MUNDO
function alvoMonstro(m) {
  let melhor = null, md = 99;
  const raio = ({ rato: 4, barata: 5, cao: 6 })[m.tipo] || 7;
  for (const j of JOG.values()) {
    if (!j.vivo || j.invisivel || j.mapa !== m.mapa || pzEm(j.mapa, j.x, j.y)) continue;
    const d = cheb(m, j); const lim = m.aggro === j.id ? 11 : raio;
    if (d <= lim && (d < md || (d === md && m.aggro === j.id))) { md = d; melhor = j; }
  }
  return melhor;
}
function andarAte(m, j) {
  const c = caminho(m.mapa, m.x, m.y, j.x, j.y, 10, m);
  if (c && c.length) return passo(m, c[0][0] - m.x, c[0][1] - m.y);
  const dx = Math.sign(j.x - m.x), dy = Math.sign(j.y - m.y);
  if (dx && livre(m.mapa, m.x + dx, m.y, m, true)) passo(m, dx, 0); else if (dy && livre(m.mapa, m.x, m.y + dy, m, true)) passo(m, 0, dy);
}
function fugirDe(m, j) {
  const op = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => livre(m.mapa, m.x + dx, m.y + dy, m, true))
    .sort((a, b) => cheb({ x: m.x + b[0], y: m.y + b[1] }, j) - cheb({ x: m.x + a[0], y: m.y + a[1] }, j));
  if (op.length && cheb({ x: m.x + op[0][0], y: m.y + op[0][1] }, j) > cheb(m, j)) passo(m, op[0][0], op[0][1]);
}
function processarPassos(j, now) {
  while (j.filaPassos.length && now >= j.proxMov - 40) {
    const [x, y] = j.filaPassos.shift();
    const dx = x - j.x, dy = y - j.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy) || !livre(j.mapa, x, y, j, false)) { j.filaPassos = []; enviarPos(j); return; }
    passo(j, dx, dy); j.proxMov = Math.max(now, j.proxMov) + velP(j) * (dx && dy ? 1.4 : 1) - 25;
    const tl = tileEm(j.mapa, j.x, j.y);
    if (tl === T.BUEIRO) { Object.assign(j, { mapa: "esg", x: 5, y: 5, alvo: null }); j.filaPassos = []; logJ(j, "Você desce pelo bueiro. O cheiro é insuportável..."); enviarPos(j); ev(j, ["alvo", null]); return; }
    if (tl === T.ESCADA) { Object.assign(j, { mapa: "sup", x: 77, y: 30, alvo: null }); j.filaPassos = []; logJ(j, "Você sobe a escada de volta à superfície."); enviarPos(j); ev(j, ["alvo", null]); return; }
    if (j.npc && cheb(j, j.npc) > 4) { logJ(j, `${j.npc.nome}: Até mais, ${j.nome}.`, "c-npc"); j.npc = null; ev(j, ["npc", null]); }
  }
}
let ultSeg = 0, ultSpawn = 0, ultSnap = 0, ultT = agora();
function tick() {
  const now = agora(); tJogo += now - ultT; ultT = now;
  for (const j of JOG.values()) { if (!j.vivo) continue; processarPassos(j, now); ataqueJogador(j, now); }
  // monstros perto de algum jogador
  for (const m of CRI) {
    if (![...JOG.values()].some(j => j.vivo && j.mapa === m.mapa && cheb(j, m) <= 15)) continue;
    const d = MONS[m.tipo]; const j = alvoMonstro(m);
    if (j) {
      const dist = cheb(m, j), vis = linhaDeVisao(m.mapa, m.x, m.y, j.x, j.y);
      if (d.alc) {
        if (now >= m.proxAtk && dist <= d.alc && vis) ataqueMonstro(m, d, j, now, dist > 1);
        if (now >= m.proxMov) { m.proxMov = now + d.vel;
          if (dist <= 2 && !d.boss) fugirDe(m, j); else if (dist > d.alc || !vis || (d.boss && dist > 1)) andarAte(m, j); }
      } else {
        if (dist <= 1 && now >= m.proxAtk && now >= m.proxMov - d.vel * .5) ataqueMonstro(m, d, j, now, false);
        if (dist > 1 && now >= m.proxMov) { m.proxMov = now + d.vel; andarAte(m, j); }
      }
      if (d.invoca && m.invocados < 4 && now > (m.proxInv || 0)) { m.proxInv = now + 9000;
        for (let i = 0; i < 2; i++) { const x = m.x + R(-2, 2), y = m.y + R(-2, 2);
          if (livre(m.mapa, x, y, null, true)) { CRI.push({ id: uid++, tipo: d.invoca, mapa: m.mapa, x, y, dir: 0, hp: MONS[d.invoca].hp, proxMov: 0, proxAtk: 0, aggro: j.id, invocado: 1, mestre: m, danos: {} }); m.invocados++; efeito(m.mapa, x, y, "#77aa55"); } }
        evPerto(m.mapa, m.x, m.y, ["log", `${d.n} chama seus súditos!`, "c-verm"]); }
    } else if (now >= m.proxMov) {
      m.proxMov = now + R(1200, 3200); m.aggro = null;
      const [dx, dy] = [[0, 1], [0, -1], [1, 0], [-1, 0]][R(0, 3)]; const nx = m.x + dx, ny = m.y + dy, sp = m.spawn;
      if ((!sp || (Math.abs(nx - sp.x) <= sp.r + 2 && Math.abs(ny - sp.y) <= sp.r + 2)) && livre(m.mapa, nx, ny, m, true)) passo(m, dx, dy);
    }
  }
  if (now - ultSeg >= 1000) { ultSeg = now; necessidades(now); }
  if (now - ultSpawn >= 2000) { ultSpawn = now;
    for (const s of SPAWNS) if (s.vivos < s.q && now - s.ultMorte > s.tempo && ![...JOG.values()].some(j => j.mapa === s.mapa && cheb(j, s) < 8)) { gerarMonstro(s); s.ultMorte = now - s.tempo + R(3000, 9000); }
    CORPOS = CORPOS.filter(c => c.ate > now);
  }
  if (now - ultSnap >= 100) { ultSnap = now; for (const j of JOG.values()) if (j.vivo) snapshot(j); }
}
function necessidades(now) {
  for (const j of JOG.values()) {
    if (!j.vivo) continue;
    if (ehGM(j)) { j.fome = 100; j.sede = 100; j.rad = 0; j.hp = hpMax(j); continue; }
    j.fome = Math.max(0, j.fome - 1 / 8); j.sede = Math.max(0, j.sede - 1 / 6);
    const tl = TP[tileEm(j.mapa, j.x, j.y)], mascara = j.eq.cabeca && ITENS[j.eq.cabeca].antirad;
    if (tl.rad) { j.rad = Math.min(100, j.rad + tl.rad * (mascara ? .2 : 1)); if (!mascara && chance(30)) texto(j.mapa, j.x, j.y, "☢", "#9aff3a"); }
    else j.rad = Math.max(0, j.rad - .25);
    j.seg = (j.seg || 0) + 1;
    if (j.seg % 2 === 0 && j.fome > 15 && j.sede > 15 && j.hp < hpMax(j) && j.rad < 60) j.hp = Math.min(hpMax(j), j.hp + 1 + Math.floor(j.lvl / 6));
    if ((j.fome <= 0 || j.sede <= 0) && j.seg % 3 === 0) { j.hp -= 4; texto(j.mapa, j.x, j.y, "4", "#ff3030");
      if (j.seg % 15 === 0) logJ(j, j.fome <= 0 ? "Você está morrendo de FOME!" : "Você está morrendo de SEDE!", "c-verm");
      if (j.hp <= 0) { morrer(j, j.fome <= 0 ? "de fome" : "de sede"); continue; } }
    else if ((j.fome < 20 || j.sede < 20) && j.seg % 25 === 0) logJ(j, j.fome < 20 ? "Você está com fome." : "Você está com sede.", "c-ouro");
    if (j.rad >= 60 && j.seg % 2 === 0) { const dd = j.rad >= 85 ? 6 : 3; j.hp -= dd; texto(j.mapa, j.x, j.y, String(dd), "#9aff3a"); if (j.hp <= 0) morrer(j, "pela radiação"); }
    if (j.npc && (j.npc.mapa !== j.mapa || cheb(j, j.npc) > 4)) { logJ(j, `${j.npc.nome}: Até mais, ${j.nome}.`, "c-npc"); j.npc = null; ev(j, ["npc", null]); }
  }
}
function snapshot(j) {
  const perto = e => e.mapa === j.mapa && Math.abs(e.x - j.x) <= VISAO_X && Math.abs(e.y - j.y) <= VISAO_Y;
  const msg = { t: "s", tj: Math.round(tJogo),
    eu: [Math.round(j.hp), Math.round(j.fome * 10) / 10, Math.round(j.sede * 10) / 10, Math.round(j.rad), j.xp, j.lvl],
    c: CRI.filter(perto).map(m => [m.id, m.tipo, m.x, m.y, m.dir, Math.max(0, m.hp)]),
    j: [...JOG.values()].filter(o => o !== j && o.vivo && perto(o)).map(o => [o.id, o.nome, o.x, o.y, o.dir, Math.round(Math.max(0, o.hp) / hpMax(o) * 100), o.lvl, velP(o),
      [o.eq.arma, o.eq.escudo, o.eq.cabeca, o.eq.corpo, o.eq.pernas, o.eq.pes]]),
    k: CORPOS.filter(perto).map(c => [c.id, c.x, c.y, c.tipo || "", c.itens.length ? 1 : 0, c.pilha ? 1 : 0]) };
  if (j.eventos.length) { msg.e = j.eventos; j.eventos = []; }
  if (j.sujo) { j.sujo = false; msg.p = { inv: j.inv, eq: j.eq, sk: j.sk, quest: j.quest, mortes: j.mortes }; }
  enviar(j, msg);
}
setInterval(tick, 50);

// ---------------------------------------------------------------- CONEXÕES
function salvarJogador(j) {
  const c = CONTAS[j.conta]; if (!c) return;
  const s = {}; for (const k of CAMPOS) s[k] = j[k];
  if (pzEm(j.mapa, j.x, j.y) || true) {} // posição salva como está
  c.save = JSON.parse(JSON.stringify(s)); c.visto = Date.now(); contasSujas = true;
}
setInterval(() => { for (const j of JOG.values()) salvarJogador(j); }, 30000);

function nomeEmUso(n, exceto) { const k = norm(n); return Object.entries(CONTAS).some(([ch, c]) => ch !== exceto && c.save && norm(c.save.nome || "") === k); }
function login(ws, msg, ip, site) {
  const nome = String(msg.nome || "").trim().replace(/\s+/g, " ");
  const senha = String(msg.senha || "");
  if (JOG.size >= MAX_JOGADORES) return { erro: "Servidor lotado. Tente daqui a pouco." };
  let chave, c, novo = false;
  const backupOk = n => msg.backup && msg.backup.nome && norm(msg.backup.nome) === norm(n);
  if (site) {                                       // conta do site preppersbr.com
    chave = "fb:" + site.uid; c = CONTAS[chave];
    if (!c) {
      if (!/^[A-Za-zÀ-ÿ0-9 ]{3,14}$/.test(nome)) return { erro: "Escolha um nome de personagem com 3 a 14 letras ou números." };
      if (nomeEmUso(nome, chave) || nomeReservado(nome)) return { erro: "Esse nome de personagem já existe. Escolha outro." };
      c = CONTAS[chave] = { email: site.email, save: backupOk(nome) ? sanear(msg.backup, nome) : novoPersonagem(nome), criado: Date.now() };
      contasSujas = true; novo = true;
    }
  } else {                                          // nome + senha (só se EXIGIR_CONTA=0)
    if (EXIGIR_CONTA) return { erro: "Entre com sua conta do site preppersbr.com para jogar online." };
    if (!/^[A-Za-zÀ-ÿ0-9 ]{3,14}$/.test(nome)) return { erro: "Nome deve ter de 3 a 14 letras ou números." };
    if (senha.length < 4 || senha.length > 64) return { erro: "A senha precisa ter pelo menos 4 caracteres." };
    chave = norm(nome); c = CONTAS[chave];
    if (c) { if (!c.salt || hashSenha(senha, c.salt) !== c.hash) return { erro: "Senha incorreta para este nome." }; }
    else {
      if (nomeEmUso(nome, chave) || nomeReservado(nome)) return { erro: "Esse nome de personagem já existe. Escolha outro." };
      const salt = crypto.randomBytes(12).toString("hex");
      c = CONTAS[chave] = { salt, hash: hashSenha(senha, salt), save: backupOk(nome) ? sanear(msg.backup, nome) : novoPersonagem(nome), criado: Date.now() };
      contasSujas = true; novo = true;
    }
  }
  for (const o of JOG.values()) if (o.conta === chave) { enviar(o, { t: "erro", msg: "Sua conta entrou em outro lugar." }); o.ws.close(); desconectar(o); }
  const s = Object.assign(novoPersonagem(c.save.nome || nome), c.save);
  if (!livre(s.mapa, s.x, s.y, null, false) || TP[tileEm(s.mapa, s.x, s.y)].b) Object.assign(s, { mapa: TEMPLO.mapa, x: TEMPLO.x, y: TEMPLO.y });
  const j = Object.assign(s, { id: uid++, ws, conta: chave, vivo: true, adm: !!c.adm, alvo: null, npc: null, proxAtk: 0, proxMov: 0, filaPassos: [], eventos: [], sujo: true, ip });
  JOG.set(j.id, j);
  console.log(`+ ${j.nome} entrou (${JOG.size} online)`);
  for (const o of JOG.values()) if (o !== j) logJ(o, `${j.nome} entrou no mundo.`, "c-verde");
  return { j, novo };
}
function desconectar(j) {
  if (!JOG.has(j.id)) return;
  salvarJogador(j); j.vivo = false; JOG.delete(j.id);
  for (const m of CRI) if (m.aggro === j.id) m.aggro = null;
  for (const o of JOG.values()) logJ(o, `${j.nome} saiu do mundo.`, "c-cinza");
  console.log(`- ${j.nome} saiu (${JOG.size} online)`);
  gravarContas();
}
function tratar(j, m) {
  switch (m.t) {
    case "p": if (j.filaPassos.length < 3 && Number.isInteger(m.x) && Number.isInteger(m.y)) j.filaPassos.push([m.x, m.y]); break;
    case "alvo": { const c = CRI.find(c => c.id === m.id); j.alvo = (c && c.mapa === j.mapa && cheb(c, j) <= 9) ? c : null; if (j.alvo) j.alvo.aggro = j.id; break; }
    case "fala": fala(j, m.txt); break;
    case "usar": if (Number.isInteger(m.i)) usarItem(j, m.i); break;
    case "deseq": desequipar(j, String(m.slot)); break;
    case "largar": if (Number.isInteger(m.i) && j.inv[m.i]) { const s = j.inv.splice(m.i, 1)[0]; largarNoChao(j.mapa, j.x, j.y, s.id, s.q); marcarEu(j); logJ(j, `Você largou ${ITENS[s.id].n}.`, "c-cinza"); } break;
    case "abrir": { const c = CORPOS.find(c => c.id === m.id); if (c && c.mapa === j.mapa && cheb(c, j) <= 1) enviarCont(j, c); break; }
    case "pegar": case "pegarTudo": {
      const c = CORPOS.find(c => c.id === m.id); if (!c || c.mapa !== j.mapa || cheb(c, j) > 1) break;
      const idxs = m.t === "pegarTudo" ? c.itens.map((_, i) => i) : [m.i];
      for (const i of idxs.reverse()) { const s = c.itens[i]; if (!s) continue;
        if ((!ITENS[s.id].st || !j.inv.find(x => x.id === s.id)) && j.inv.length >= MAX_INV) { logJ(j, "Sua mochila está cheia.", "c-verm"); break; }
        c.itens.splice(i, 1); darItem(j, s.id, s.q); logJ(j, `Você pegou ${s.q > 1 ? s.q + "× " : ""}${ITENS[s.id].n}.`, "c-cinza"); }
      if (c.pilha && !c.itens.length) CORPOS = CORPOS.filter(x => x !== c);
      enviarCont(j, c); break; }
    case "comprar": comprar(j, m.npc, m.id, m.q); break;
    case "vender": vender(j, m.npc, m.id, m.q); break;
    case "poco": if (tileEm(j.mapa, m.x, m.y) === T.POCO && cheb(j, m) <= 1) { j.sede = 100; texto(j.mapa, j.x, j.y, "Gulp", "#7ac8ff"); logJ(j, "Você bebe a água fresca do poço. Sede saciada.", "c-npc"); } break;
  }
}
function enviarCont(j, c) { enviar(j, { t: "cont", id: c.id, nome: c.nome, itens: c.itens }); }

const servidor = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/saude") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`Servidor Zona Morta online — ${JOG.size} jogador(es) conectados.\nJogue em https://preppersbr.com/jogo/`);
});
const wss = new WebSocketServer({ server: servidor, maxPayload: 16 * 1024,
  verifyClient: info => !ORIGENS.length || ORIGENS.includes(info.origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(info.origin || "") || info.origin === "null" });
wss.on("connection", (ws, req) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  let j = null, cont = 0, janela = Date.now(), entrando = false;
  ws.isAlive = true; ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", raw => {
    const n = Date.now(); if (n - janela > 1000) { janela = n; cont = 0; } if (++cont > 60) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; } if (!m || typeof m.t !== "string") return;
    if (!j) {
      if (m.t !== "login" || entrando) return;
      entrando = true;
      (m.token ? verificarToken(m.token) : Promise.resolve(null)).then(site => {
        if (ws.readyState !== 1) return;
        const r = login(ws, m, ip, site);
        entrando = false;
        if (r.erro) { ws.send(JSON.stringify({ t: "erro", msg: r.erro })); return; }
        j = r.j;
        ws.send(JSON.stringify({ t: "ok", id: j.id, novo: r.novo, mapas: MAPAS_ENVIO, tj: Math.round(tJogo),
          eu: Object.fromEntries(CAMPOS.map(k => [k, j[k]])), online: [...JOG.values()].map(o => o.nome) }));
      }).catch(e => { entrando = false; console.log("token recusado:", e.message);
        if (ws.readyState === 1) ws.send(JSON.stringify({ t: "erro", msg: "Não consegui confirmar sua conta do site. Saia e entre de novo em preppersbr.com/membros.html." })); });
      return;
    }
    if (j.vivo) tratar(j, m);
  });
  ws.on("close", () => { if (j) desconectar(j); });
  ws.on("error", () => {});
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch (e) {} } }, 30000);
function encerrar() { for (const j of JOG.values()) salvarJogador(j); contasSujas = true; gravarContas(); process.exit(0); }
process.on("SIGTERM", encerrar); process.on("SIGINT", encerrar);
servidor.listen(PORT, () => console.log(`Zona Morta: servidor na porta ${PORT} — ${CRI.length} criaturas no mundo.`));
