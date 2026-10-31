// ======================================================================
//  ZONA MORTA — dados do mundo (fonte única)
//  Itens, monstros, preços, mapas, portais, contêineres e criaturas.
//  Usado pelo jogo (jogo/index.html, embutido) e pelo servidor
//  (servidor-jogo/dados.js é uma cópia gerada deste arquivo).
// ======================================================================
const R = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const chance = p => Math.random()*100 < p;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const cheb = (a,b) => Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hash = (x,y) => { let h = x*374761393 + y*668265263; h=(h^(h>>13))*1274126177; return (h^(h>>16))>>>0; };
// ---------------------------------------------------------------- TILES
const T = {GRAMA:0,TERRA:1,AREIA:2,ASF:3,PISO:4,PAREDE:5,AGUA:6,ARVORE:7,ENTULHO:8,CARRO:9,RAD:10,BUEIRO:11,ESCADA:12,PORTA:13,ESGC:14,ESGP:15,LODO:16,POCO:17,CALC:18,FOGO:19};
const TP = [
  {n:"grama",mm:"#3f6b2a"},{n:"terra",mm:"#6b5236"},{n:"areia",mm:"#b49a64"},{n:"asfalto",mm:"#45454a"},
  {n:"piso",mm:"#6e6253"},{n:"parede",b:1,op:1,obj:"parede",mm:"#8a8580"},{n:"água",b:1,mm:"#2a5a85"},
  {n:"árvore",b:1,op:1,obj:"arvore",mm:"#1f4515"},{n:"entulho",b:1,obj:"entulho",mm:"#777"},
  {n:"carro abandonado",b:1,obj:"carro",mm:"#8a4a2a"},{n:"poça radioativa",rad:3,mm:"#7aff3a"},
  {n:"bueiro",mm:"#ffcc00"},{n:"escada",mm:"#ffcc00"},{n:"porta",mm:"#7a5a3a"},
  {n:"chão do esgoto",mm:"#4a463e"},{n:"parede",b:1,op:1,obj:"parede2",mm:"#222"},{n:"lodo",rad:.6,mm:"#5a6a2a"},
  {n:"poço",b:1,obj:"poco",mm:"#5ad1ff"},{n:"calçada",mm:"#777779"},{n:"fogueira",b:1,obj:"fogo",mm:"#ff8a20"}
];
function mk(W,H){ return {W,H,t:new Uint8Array(W*H),pz:new Uint8Array(W*H),visto:new Uint8Array(W*H)}; }
// ---------------------------------------------------------------- ITENS
const ITENS = {
  tampinha:{n:"Tampinha",ic:"🪙",st:1,d:"A moeda do fim do mundo."},
  lata:{n:"Lata de feijão",ic:"🥫",st:1,t:"comida",fome:30,d:"Mata a fome (+30)."},
  cereal:{n:"Barra de cereal",ic:"🍫",st:1,t:"comida",fome:12,d:"Lanche rápido (+12)."},
  carne_rato:{n:"Carne de rato",ic:"🍖",st:1,t:"comida",fome:8,rad:5,d:"+8 fome, mas é radioativa."},
  carne_cao:{n:"Carne de cão",ic:"🥩",st:1,t:"comida",fome:16,d:"+16 fome. Não pense muito."},
  garrafa:{n:"Garrafa d'água",ic:"💧",st:1,t:"bebida",sede:35,d:"Água limpa (+35 sede)."},
  agua_suja:{n:"Água suja",ic:"🫙",st:1,t:"bebida",sede:22,rad:8,d:"+22 sede, mas dá radiação."},
  refri:{n:"Refrigerante quente",ic:"🥤",st:1,t:"bebida",sede:15,fome:4,d:"Doce e quente (+15 sede)."},
  bandagem:{n:"Bandagem",ic:"🩹",st:1,t:"cura",hp:45,d:"Recupera 45 de vida."},
  medkit:{n:"Kit médico",ic:"💉",st:1,t:"cura",hp:140,d:"Recupera 140 de vida."},
  iodo:{n:"Pílula de iodo",ic:"💊",st:1,t:"antirad",rad:50,d:"Remove 50 de radiação."},
  cauda:{n:"Cauda de rato",ic:"🐀",st:1,d:"O Sargento Rocha paga por isso."},
  couro:{n:"Couro de cão",ic:"🟫",st:1,d:"Vende bem."},
  ferrao:{n:"Ferrão radioativo",ic:"🦂",st:1,d:"Brilha no escuro. Vende bem."},
  sucata:{n:"Sucata",ic:"🔩",st:1,d:"Ferro velho."},
  componente:{n:"Componente eletrônico",ic:"🔌",st:1,d:"Valioso para o Seu Zé."},
  coroa:{n:"Coroa do Rei dos Esgotos",ic:"👑",d:"Prova de que o Rei caiu."},
  pedra:{n:"Pedra",ic:"🪨",st:1,mun:1,d:"Munição de estilingue."},
  flecha:{n:"Flecha",ic:"🏹",st:1,mun:1,d:"Munição de arco."},
  bala:{n:"Bala .38",ic:"🔸",st:1,mun:1,d:"Munição de pistola."},
  cartucho:{n:"Cartucho",ic:"🔴",st:1,mun:1,d:"Munição de espingarda."},
  canivete:{n:"Canivete",ic:"🔪",slot:"arma",atk:7},
  faca:{n:"Faca de caça",ic:"🔪",slot:"arma",atk:11},
  taco:{n:"Taco de beisebol",ic:"🏏",slot:"arma",atk:15},
  pe_cabra:{n:"Pé-de-cabra",ic:"🔧",slot:"arma",atk:19},
  facao:{n:"Facão",ic:"🗡️",slot:"arma",atk:23},
  machado:{n:"Machado de incêndio",ic:"🪓",slot:"arma",atk:29},
  motosserra:{n:"Motosserra do Carniça",ic:"🪚",slot:"arma",atk:44,maos2:1},
  estilingue:{n:"Estilingue",ic:"🪃",slot:"arma",atk:9,alc:4,mun:"pedra"},
  arco:{n:"Arco recurvo",ic:"🏹",slot:"arma",atk:17,alc:5,mun:"flecha",maos2:1},
  pistola:{n:"Revólver .38",ic:"🔫",slot:"arma",atk:27,alc:5,mun:"bala"},
  espingarda:{n:"Espingarda",ic:"💥",slot:"arma",atk:39,alc:4,mun:"cartucho",maos2:1},
  tampa:{n:"Tampa de lixo",ic:"🛡️",slot:"escudo",def:8},
  escudo_placa:{n:"Escudo de placa",ic:"🛡️",slot:"escudo",def:14},
  escudo_motim:{n:"Escudo antimotim",ic:"🛡️",slot:"escudo",def:22},
  bone:{n:"Boné",ic:"🧢",slot:"cabeca",arm:1,cor:"#c33"},
  capacete_obra:{n:"Capacete de obra",ic:"⛑️",slot:"cabeca",arm:2,cor:"#e8c020"},
  mascara:{n:"Máscara de gás",ic:"😷",slot:"cabeca",arm:1,antirad:1,cor:"#333"},
  capacete_mil:{n:"Capacete militar",ic:"🪖",slot:"cabeca",arm:3,cor:"#4a5a2a"},
  camiseta:{n:"Camiseta",ic:"👕",slot:"corpo",arm:1,cor:"#3a6ab0"},
  jaqueta:{n:"Jaqueta de couro",ic:"🧥",slot:"corpo",arm:3,cor:"#5a3a20"},
  colete_sucata:{n:"Colete de sucata",ic:"🦺",slot:"corpo",arm:5,cor:"#7a7a7a"},
  colete_bal:{n:"Colete balístico",ic:"🦺",slot:"corpo",arm:8,cor:"#2a3a2a"},
  jeans:{n:"Calça jeans",ic:"👖",slot:"pernas",arm:1,cor:"#2a3a6a"},
  cargo:{n:"Calça cargo",ic:"👖",slot:"pernas",arm:2,cor:"#5a5a3a"},
  caneleira:{n:"Caneleiras de pneu",ic:"👖",slot:"pernas",arm:3,cor:"#222"},
  tenis:{n:"Tênis surrado",ic:"👟",slot:"pes",arm:1},
  coturno:{n:"Coturno",ic:"🥾",slot:"pes",arm:2},
  tocha:{n:"Tocha",ic:"🔥",slot:"luz",luz:3.5},
  lanterna:{n:"Lanterna",ic:"🔦",slot:"luz",luz:5.5}
};
const PRECO = {lata:8,cereal:3,garrafa:6,refri:4,bandagem:15,medkit:60,iodo:35,tocha:20,lanterna:150,pedra:1,flecha:2,bala:4,cartucho:8,
  canivete:15,faca:40,taco:90,pe_cabra:220,facao:380,machado:900,motosserra:4000,estilingue:30,arco:260,pistola:850,espingarda:2600,
  tampa:30,escudo_placa:320,escudo_motim:1300,bone:10,capacete_obra:120,mascara:420,capacete_mil:900,camiseta:5,jaqueta:90,
  colete_sucata:420,colete_bal:1600,jeans:10,cargo:130,caneleira:480,tenis:8,coturno:160};
function descItem(id){ const it=ITENS[id]; if(it.d) return it.d; const p=[];
  if(it.atk) p.push(`Ataque ${it.atk}`); if(it.alc) p.push(`alcance ${it.alc}, usa ${ITENS[it.mun].n.toLowerCase()}`);
  if(it.maos2) p.push("duas mãos"); if(it.def) p.push(`Defesa ${it.def}`); if(it.arm) p.push(`Armadura ${it.arm}`);
  if(it.antirad) p.push("protege de radiação"); if(it.luz) p.push(`Luz ${it.luz}`); return p.join(", ")+"."; }

// ---------------------------------------------------------------- MONSTROS
const HUM = (pele,roupa,calca,cabelo,extra) => ({pele,roupa,calca,cabelo,extra});
const MONS = {
  rato:{n:"Rato Mutante",hp:20,atk:6,arm:0,xp:8,vel:380,spr:"rato",loot:[["tampinha",70,1,4],["cauda",55,1,1],["carne_rato",35,1,1]]},
  barata:{n:"Barata Gigante",hp:32,atk:9,arm:1,xp:14,vel:420,spr:"barata",loot:[["tampinha",60,1,6],["sucata",25,1,1]]},
  cao:{n:"Cão Raivoso",hp:45,atk:13,arm:1,xp:22,vel:270,spr:"cao",loot:[["couro",45,1,1],["carne_cao",35,1,1],["tampinha",30,1,3]]},
  carnical:{n:"Carniçal",hp:85,atk:17,arm:2,xp:42,vel:480,spr:"hum",c:HUM("#7c9a5c","#5a4a3a","#3a3a4a","#2d3a22"),
    loot:[["tampinha",70,4,15],["bandagem",12,1,1],["jeans",6,1,1],["agua_suja",25,1,1],["bone",5,1,1]]},
  saqueador:{n:"Saqueador",hp:95,atk:19,arm:3,xp:55,vel:330,spr:"hum",c:HUM("#c99a72","#7a2a22","#33405a","#2a1a10","bandana"),saq:1,
    loot:[["tampinha",85,8,28],["faca",8,1,1],["jaqueta",5,1,1],["lata",22,1,1],["garrafa",22,1,1],["pe_cabra",3,1,1],["taco",6,1,1],["tampa",6,1,1]]},
  atirador:{n:"Saqueador Atirador",hp:80,atk:23,arm:2,xp:70,vel:360,spr:"hum",alc:4,proj:"#ffd23a",c:HUM("#a8784f","#3a4a2a","#2a2a2a","#111","oculos"),saq:1,
    loot:[["bala",55,3,10],["tampinha",80,8,25],["pistola",3,1,1],["bandagem",15,1,1],["cargo",5,1,1]]},
  escorp:{n:"Escorpião Radioativo",hp:115,atk:24,arm:4,xp:90,vel:400,spr:"escorp",rad:6,
    loot:[["ferrao",40,1,1],["tampinha",45,3,12],["componente",8,1,1],["iodo",8,1,1]]},
  mutante:{n:"Mutante Brutamontes",hp:260,atk:36,arm:6,xp:240,vel:500,spr:"hum",esc:1.4,c:HUM("#8a6aa8","#3a2a2a","#2a2020","#4a3a5a"),
    loot:[["tampinha",90,25,70],["machado",6,1,1],["colete_sucata",6,1,1],["medkit",12,1,1],["componente",22,1,2],["caneleira",3,1,1]]},
  rei:{n:"Rei dos Esgotos",hp:700,atk:42,arm:6,xp:1200,vel:380,spr:"rato",esc:1.9,boss:1,coroa:1,invoca:"rato",
    loot:[["tampinha",100,150,300],["capacete_mil",35,1,1],["escudo_placa",55,1,1],["medkit",100,2,3],["coroa",100,1,1]]},
  carnica:{n:"Carniça, Senhor da Estrada",hp:1600,atk:58,arm:10,xp:4000,vel:300,spr:"hum",esc:1.5,alc:4,boss:1,proj:"#ff5a2a",
    c:HUM("#b07a58","#5a1010","#1a1a1a","#111","espinhos"),
    loot:[["motosserra",100,1,1],["tampinha",100,800,1500],["colete_bal",60,1,1],["medkit",100,3,5],["escudo_motim",25,1,1]]}
};

// ---------------------------------------------------------------- GERAÇÃO DOS MAPAS
const MAPA = {};
const tileEm = (m,x,y) => { const M=MAPA[m]; return (!M||x<0||y<0||x>=M.W||y>=M.H) ? T.ESGP : M.t[y*M.W+x]; };
const pzEm = (m,x,y) => { const M=MAPA[m]; return !!M && x>=0&&y>=0&&x<M.W&&y<M.H && M.pz[y*M.W+x]===1; };
function xpNivel(L){ return Math.round(50/3*(L**3 - 6*L**2 + 17*L - 12)); }
// ---------------------------------------------------------------- TILES NOVOS (v4)
Object.assign(T, {METAL:20,METALP:21,ROCHA:22,ROCHAP:23,TRILHO:24,AZULEJO:25,PEDRA:26,DESCE:27,SOBE:28,PORTAF:29,CONT:30,PLACA:31,
  CAMA:32,CAMA2:33,CONSOLE:34,TANQUE:35,CRISTAL:36,GRADE:37,MADEIRA:38,CONCRETO:39,ARBUSTO:40,BARRACA:41,BLOQ:42,MESA:43});
TP.push(
  {n:"piso de metal",mm:"#6a6e72"},{n:"parede blindada",b:1,op:1,obj:"parede3",mm:"#3a3e44"},
  {n:"chão de rocha",mm:"#5a5248"},{n:"rocha",b:1,op:1,obj:"rocha",mm:"#2a2420"},
  {n:"trilhos",mm:"#3a3a3a"},{n:"parede de azulejo",b:1,op:1,obj:"parede4",mm:"#7a8a8a"},
  {n:"pedras",mm:"#8a7a6a"},{n:"descida",mm:"#ffcc00"},{n:"subida",mm:"#ffcc00"},
  {n:"porta fechada",b:1,op:1,obj:"portaf",mm:"#7a5a3a"},{n:"contêiner",b:1,obj:"cont",mm:"#b08a4a"},
  {n:"placa",b:1,obj:"placa",mm:"#9a7a4a"},{n:"cama",b:1,obj:"cama",mm:"#5a7a4a"},{n:"cama",b:1,mm:"#5a7a4a"},
  {n:"computador",b:1,obj:"console",mm:"#5ad1ff"},{n:"purificador de água",b:1,obj:"tanque",mm:"#5ad1ff"},
  {n:"cristal radioativo",b:1,obj:"cristal",rad:0,mm:"#7aff3a"},{n:"cerca",b:1,obj:"grade",mm:"#8a8a7a"},
  {n:"assoalho",mm:"#7a5230"},{n:"concreto",mm:"#7a7a78"},{n:"arbusto",b:1,obj:"arbusto",mm:"#2a5a1c"},
  {n:"barraca",b:1,obj:"barraca",mm:"#7a6a3a"},{n:"",b:1,mm:"#555"},{n:"mesa",b:1,obj:"mesa",mm:"#9a8a6a"}
);
const PORTAIS = new Set([T.BUEIRO,T.ESCADA,T.DESCE,T.SOBE]);

// ---------------------------------------------------------------- ITENS E MONSTROS NOVOS
Object.assign(ITENS, {
  mre:{n:"Ração militar",ic:"🍱",st:1,t:"comida",fome:60,d:"Comida de soldado (+60 fome)."},
  cristal:{n:"Cristal radioativo",ic:"💎",st:1,d:"Brilha verde. Tião do Metrô paga bem."},
  teia:{n:"Seda de aranha",ic:"🕸️",st:1,d:"Resistente. Vende bem."},
  chip:{n:"Chip militar",ic:"💾",st:1,d:"Tecnologia do velho exército."},
  soro:{n:"Soro do Experimento X",ic:"🧪",d:"Prova de que o Experimento X caiu."},
  rifle:{n:"Fuzil de assalto",ic:"🔫",slot:"arma",atk:47,alc:5,mun:"bala",maos2:1},
  armadura_tat:{n:"Armadura tática",ic:"🦺",slot:"corpo",arm:11,cor:"#1e2a1e"}
});
Object.assign(PRECO, {mre:25,cristal:0,teia:0,chip:0,rifle:5200,armadura_tat:6000});
Object.assign(MONS, {
  morcego:{n:"Morcego Mutante",hp:28,atk:10,arm:0,xp:16,vel:230,spr:"morcego",loot:[["tampinha",40,1,4]]},
  aranha:{n:"Aranha Gigante",hp:130,atk:27,arm:3,xp:105,vel:330,spr:"aranha",loot:[["teia",55,1,2],["tampinha",40,4,14]]},
  soldado:{n:"Soldado Zumbi",hp:190,atk:33,arm:8,xp:175,vel:430,spr:"hum",
    loot:[["bala",60,4,12],["mre",30,1,1],["chip",20,1,1],["capacete_mil",4,1,1],["colete_bal",2,1,1],["tampinha",70,10,40]]},
  drone:{n:"Drone de Segurança",hp:150,atk:30,arm:10,xp:195,vel:300,spr:"drone",alc:5,proj:"#5ad1ff",
    loot:[["componente",50,1,2],["chip",35,1,1],["sucata",60,1,3]]},
  experimento:{n:"Experimento X",hp:2600,atk:72,arm:12,xp:8000,vel:330,spr:"hum",esc:1.7,boss:1,invoca:"soldado",
    loot:[["soro",100,1,1],["rifle",60,1,1],["armadura_tat",40,1,1],["tampinha",100,1500,3000],["medkit",100,4,6]]}
});

// ---------------------------------------------------------------- MAPAS DO MUNDO
// Portais: [mapa, x, y]  ->  [mapa, x, y]  (ida e volta)
const PT = {
  bunkerElev:["bunker",22,3], supHatch:["sup",38,72],
  supMetroA:["sup",130,79], supMetroB:["sup",178,62], metroA:["metro",18,5], metroB:["metro",118,5],
  supBueiroA:["sup",151,85], supBueiroB:["sup",125,104], esgA:["esg",8,7], esgB:["esg",40,31],
  supUsina:["sup",68,119], supBuraco:["sup",96,133], cavA:["caverna",10,10], cavB:["caverna",85,60],
  supBase:["sup",170,130], baseA:["base",6,6]
};
const LINKS = [];
for (const [a,b] of [["bunkerElev","supHatch"],["supMetroA","metroA"],["supMetroB","metroB"],["supBueiroA","esgA"],["supBueiroB","esgB"],
  ["supUsina","cavA"],["supBuraco","cavB"],["supBase","baseA"]]) { LINKS.push([PT[a],PT[b]]); LINKS.push([PT[b],PT[a]]); }
function linkEm(m,x,y){ for (const [a,b] of LINKS) if (a[0]===m && a[1]===x && a[2]===y) return b; return null; }
const NOME_MAPA = {bunker:"Bunker 47",sup:"Superfície",esg:"Esgotos",metro:"Metrô",caverna:"Cavernas",base:"Base Subterrânea"};
// pontos onde os jogadores nascem / renascem
const TEMPLO = {mapa:"bunker",x:8,y:7};
// NPCs (posições — os diálogos ficam no jogo e no servidor)
const NPC_POS = {ze:["bunker",22,22],ana:["bunker",37,7],cida:["bunker",8,22],rocha:["bunker",37,22],tiao:["metro",68,6]};

function novoMapa(W,H,fill){ const M=mk(W,H); M.t.fill(fill); M.cont=new Map(); M.placas=new Map(); return M; }
function ferramentas(M,seed){
  const r=mulberry(seed), W=M.W, H=M.H;
  const ok=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const S=(x,y,v)=>{ if(ok(x,y)) M.t[y*W+x]=v; }, G=(x,y)=>ok(x,y)?M.t[y*W+x]:-1;
  const rect=(x1,y1,x2,y2,v)=>{ for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) S(x,y,v); };
  const borda=(x1,y1,x2,y2,v)=>{ for(let x=x1;x<=x2;x++){ S(x,y1,v); S(x,y2,v); } for(let y=y1;y<=y2;y++){ S(x1,y,v); S(x2,y,v); } };
  const sala=(x1,y1,x2,y2,piso,parede)=>{ rect(x1,y1,x2,y2,piso); borda(x1,y1,x2,y2,parede); };
  const pz=(x1,y1,x2,y2)=>{ for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) if(ok(x,y)) M.pz[y*W+x]=1; };
  const cont=(x,y,tipo)=>{ S(x,y,T.CONT); M.cont.set(x+","+y,tipo); };
  const placa=(x,y,txt)=>{ S(x,y,T.PLACA); M.placas.set(x+","+y,txt); };
  const cama=(x,y)=>{ S(x,y,T.CAMA); S(x,y+1,T.CAMA2); };
  const ri=(a,b)=>a+Math.floor(r()*(b-a+1));
  // cava um corredor a partir de (x,y) na direção (dx,dy) até encontrar chão
  const cavar=(x,y,dx,dy,piso)=>{ for(let k=0;k<40;k++){ x+=dx; y+=dy; const t=G(x,y); if(t<0) return; if(!TP[t].b) return; S(x,y,piso); } };
  const limpar=(x1,y1,x2,y2,v)=>{ for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++){ S(x,y,v); M.cont.delete(x+","+y); M.placas.delete(x+","+y); } };
  return {r,S,G,rect,borda,sala,pz,cont,placa,cama,ri,ok,cavar,limpar};
}
const andavel = t => !TP[t].b;

// ---- BUNKER 47 (início, zona segura)
function gerarBunker(){
  const M=novoMapa(46,32,T.METALP), g=ferramentas(M,47);
  g.rect(2,15,43,16,T.METAL);
  const salas=[[2,2,14,13],[16,2,29,13],[31,2,43,13],[2,18,14,29],[16,18,29,29],[31,18,43,29]];
  for(const [x1,y1,x2,y2] of salas){ g.sala(x1-1,y1-1,x2+1,y2+1,T.METAL,T.METALP); }
  g.rect(2,15,43,16,T.METAL);
  for(const [x1,y1,x2,y2] of salas){ const cx=(x1+x2)>>1; const py=y1<15?y2+1:y1-1; g.S(cx,py,T.PORTA); g.S(cx+1,py,T.PORTA); }
  // dormitório
  for(const x of [3,5,7,9,11,13]){ g.cama(x,3); g.cama(x,11); }
  g.cont(3,7,"armario"); g.cont(13,7,"armario"); g.placa(8,9,"Dormitório do Bunker 47. Você acordou aqui depois do colapso. Descanse numa cama para recuperar a vida.");
  // refeitório: mesas, purificador, elevador
  for(const x of [18,21,24,27]) for(const y of [7,10]) g.S(x,y,T.MESA);
  g.S(17,3,T.TANQUE); g.S(28,3,T.TANQUE); g.cont(29,12,"geladeira");
  g.S(22,3,T.SOBE); g.S(23,3,T.METAL);
  g.placa(24,3,"ELEVADOR → SUPERFÍCIE. Lá fora: ratos, cães, saqueadores e coisa pior. Volte vivo.");
  g.placa(16,5,"Purificador de água: use para beber de graça.");
  // enfermaria
  for(const x of [33,35,39,41]) g.cama(x,3);
  g.cont(32,11,"medico"); g.cont(43,11,"medico");
  // arsenal
  for(const x of [3,5,11,13]) g.cont(x,19,"militar");
  g.placa(4,27,"Arsenal. Dona Cida troca armas e proteção por tampinhas.");
  // mercado
  for(const x of [17,19,26,28]) g.cont(x,19,"caixa");
  // comando
  for(let x=33;x<=41;x++) g.S(x,19,T.CONSOLE);
  g.placa(32,27,"Sala de Comando. O Sargento Rocha distribui as MISSÕES.");
  g.pz(0,0,45,31);
  return M;
}

// ---- SUPERFÍCIE (192 x 144)
function gerarSup(){
  const W=192,H=144, M=novoMapa(W,H,T.GRAMA), g=ferramentas(M,4242), r=g.r;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    let v;
    if(y>=96 && x<120) v = r()<.78?T.AREIA:T.TERRA;
    else if(x>=112 && y>=40 && y<=112) v=T.CALC;
    else if(x>=128 && y>=116) v=T.CONCRETO;
    else v = r()<.74?T.GRAMA:T.TERRA;
    g.S(x,y,v);
  }
  // Mata do Norte
  for(let y=1;y<=56;y++) for(let x=1;x<=104;x++){ const q=r(); if(q<.27) g.S(x,y,T.ARVORE); else if(q<.31) g.S(x,y,T.ARBUSTO); }
  for(let x=1;x<=104;x++){ g.S(x,30,T.TERRA); g.S(x,31,T.TERRA); }
  for(let y=1;y<=60;y++){ for(const tx of [20,21,50,51,80,81]) g.S(tx,y,T.TERRA); }
  for(const [cx,cy,rr] of [[34,14,5],[70,44,5],[12,48,4],[88,12,5],[40,48,4]]) for(let y=cy-rr;y<=cy+rr;y++) for(let x=cx-rr;x<=cx+rr;x++) g.S(x,y,r()<.7?T.GRAMA:T.TERRA);
  for(let y=12;y<=38;y++) for(let x=44;x<=78;x++) if(((x-61)/14)**2+((y-24)/8)**2<1) g.S(x,y,T.AGUA);
  for(let y=6;y<=14;y++) for(let x=8;x<=18;x++) if(((x-13)/5)**2+((y-10)/3.5)**2<1) g.S(x,y,T.AGUA);
  // Fazendas (nordeste)
  for(let y=4;y<=34;y++) for(let x=112;x<=188;x++) g.S(x,y, r()<.8?T.GRAMA:T.TERRA);
  for(const [fx,fy] of [[118,6],[150,6],[118,22],[166,20]]){
    for(let y=fy;y<=fy+9;y++) for(let x=fx;x<=fx+16;x++) if((y-fy)%2===0) g.S(x,y,T.TERRA);
    g.borda(fx-1,fy-1,fx+17,fy+10,T.GRADE); g.S(fx+8,fy+10,T.TERRA);
  }
  for(const [hx,hy] of [[138,8],[176,6],[140,24]]){
    g.sala(hx,hy,hx+8,hy+7,T.MADEIRA,T.PAREDE); g.S(hx+4,hy+7,T.PORTAF);
    g.cont(hx+1,hy+1,"geladeira"); g.cont(hx+7,hy+1,"armario"); g.cont(hx+1,hy+5,"caixa"); g.S(hx+4,hy+3,T.MESA);
  }
  g.placa(140,33,"Fazenda Boa Vista. Os donos sumiram. A despensa ainda pode ter comida.");
  // cidade em ruínas
  for(let bx=112;bx<190;bx+=13) for(let by=40;by<112;by+=13){
    for(let x=bx;x<bx+13;x++){ g.S(x,by,T.ASF); g.S(x,by+1,T.ASF); }
    for(let y=by;y<by+13;y++){ g.S(bx,y,T.ASF); g.S(bx+1,y,T.ASF); }
    const q=r();
    if(q<.12){ for(let k=0;k<10;k++) g.S(bx+g.ri(3,11),by+g.ri(3,11),T.ENTULHO); continue; }
    const x1=bx+3+g.ri(0,1), y1=by+3+g.ri(0,1), x2=bx+11-g.ri(0,1), y2=by+11-g.ri(0,1);
    const piso = r()<.5?T.PISO:T.MADEIRA;
    for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++){
      const bd=x===x1||x===x2||y===y1||y===y2;
      if(bd) g.S(x,y, r()<.06 ? T.ENTULHO : T.PAREDE); else g.S(x,y, r()<.05?T.ENTULHO:piso);
    }
    const portas=[[g.ri(x1+1,x2-1),y2],[x1,g.ri(y1+1,y2-1)],[g.ri(x1+1,x2-1),y1],[x2,g.ri(y1+1,y2-1)]];
    for(let k=0;k<2;k++){ const p=portas.splice(g.ri(0,portas.length-1),1)[0]; g.S(p[0],p[1], r()<.6?T.PORTAF:T.PORTA); }
    const tipos=["armario","geladeira","caixa","lixeira","armario","caixa"];
    for(let k=0;k<g.ri(1,3);k++){ const cx=g.ri(x1+1,x2-1), cy=g.ri(y1+1,y2-1); if(g.G(cx,cy)===piso) g.cont(cx,cy, r()<.06?"cofre":tipos[g.ri(0,tipos.length-1)]); }
  }
  for(let y=112;y<=113;y++) for(let x=112;x<191;x++) g.S(x,y,T.ASF);
  // hospital e delegacia
  g.limpar(138,52,162,68,T.CALC); g.limpar(164,86,182,100,T.CALC);
  g.sala(140,54,160,66,T.PISO,T.PAREDE); g.S(150,66,T.PORTA); g.S(151,66,T.PORTA); g.S(140,60,T.PORTAF);
  for(const x of [142,145,148,154,157]){ g.cama(x,56); } for(const x of [142,146,150,154,158]) g.cont(x,63,"medico");
  g.placa(149,68,"HOSPITAL SANTA CASA. Remédios lá dentro — e muita gente desesperada procurando também.");
  g.sala(166,88,180,98,T.PISO,T.PAREDE); g.S(173,98,T.PORTAF);
  for(const x of [168,171,175,178]) g.cont(x,90,"militar"); g.cont(168,96,"cofre");
  g.placa(172,100,"DELEGACIA. O arsenal foi saqueado, mas nem tudo foi levado.");
  // estradas
  for(let x=40;x<192;x++) for(let y=71;y<=73;y++) g.S(x,y,T.ASF);
  for(let y=0;y<144;y++) for(let x=100;x<=102;x++) g.S(x,y,T.ASF);
  for(let i=0;i<W*H;i++) if(M.t[i]===T.ASF && r()<.028){ const x=i%W,y=(i/W)|0; if(!(y>=71&&y<=73&&x<112)&&!(x>=100&&x<=102)) { M.t[i]=T.CARRO; M.cont.set(x+","+y,"carro"); } }
  // deserto radioativo
  for(let y=96;y<H-1;y++) for(let x=1;x<118;x++){ if(M.t[y*W+x]!==T.AREIA && M.t[y*W+x]!==T.TERRA) continue; const q=r(); if(q<.025) g.S(x,y,T.ENTULHO); else if(q<.04) g.S(x,y,T.ARVORE); else if(q<.043) g.cont(x,y,"mochila"); }
  for(let i=0;i<46;i++){ const cx=g.ri(4,114), cy=g.ri(98,140); g.S(cx,cy,T.RAD); if(r()<.7) g.S(cx+1,cy,T.RAD); if(r()<.5) g.S(cx,cy+1,T.RAD); }
  // usina nuclear (entrada das cavernas)
  g.sala(58,110,78,128,T.CONCRETO,T.PAREDE); g.S(68,128,T.PORTA); g.S(69,128,T.PORTA);
  for(const [x,y] of [[61,113],[75,113],[61,125],[75,125],[64,116],[72,122]]) g.S(x,y,T.CRISTAL);
  for(let y=113;y<=116;y++) for(let x=66;x<=71;x++) g.S(x,y,T.RAD);
  g.cont(60,127,"militar"); g.placa(66,130,"USINA NUCLEAR ANGRA-SUL. PERIGO: RADIAÇÃO. Um buraco no porão desce para as cavernas.");
  // covil do Carniça
  g.sala(6,118,28,138,T.TERRA,T.PAREDE); g.S(17,118,T.TERRA); g.S(18,118,T.TERRA);
  for(let k=0;k<14;k++) g.S(g.ri(8,26),g.ri(120,136),T.ENTULHO);
  g.placa(17,116,"VOLTA. Território do CARNIÇA.");
  // base militar
  g.borda(128,116,190,142,T.GRADE); g.S(140,116,T.CONCRETO); g.S(141,116,T.CONCRETO);
  for(const [bx,by] of [[134,122],[150,126],[176,120]]){ g.sala(bx,by,bx+9,by+7,T.METAL,T.METALP); g.S(bx+4,by+7,T.PORTAF);
    g.cont(bx+1,by+1,"militar"); g.cont(bx+8,by+1,"militar"); g.S(bx+4,by+2,T.CONSOLE); }
  g.placa(142,114,"BASE MILITAR 7 — ÁREA RESTRITA. Os sinais de vida no subsolo não são humanos.");
  // acampamento do Bunker 47 (zona segura)
  g.rect(26,62,52,82,T.TERRA);
  for(let y=63;y<=81;y++) for(let x=27;x<=51;x++) if(r()<.55) g.S(x,y,T.GRAMA);
  g.rect(33,68,44,77,T.PEDRA);
  g.borda(26,62,52,82,T.GRADE);
  for(const [x,y] of [[52,71],[52,72],[52,73],[38,62],[39,62],[38,82],[39,82]]) g.S(x,y,T.TERRA);
  for(const [x,y] of [[29,65],[47,65],[29,78]]){ g.S(x,y,T.BARRACA); g.S(x+1,y,T.BLOQ); g.S(x,y+1,T.BLOQ); g.S(x+1,y+1,T.BLOQ); }
  g.S(34,66,T.FOGO); g.S(45,79,T.FOGO); g.S(46,67,T.POCO);
  g.placa(50,70,"ACAMPAMENTO DO BUNKER 47 — zona segura. A escotilha no centro desce para o bunker.");
  g.placa(54,74,"→ Leste: ruínas da cidade.   ↑ Norte: mata.   ↓ Sul: deserto radioativo.");
  g.pz(26,62,52,82);
  // portais (sempre por último, com o entorno livre)
  for(const k of ["supHatch","supMetroA","supMetroB","supBueiroA","supBueiroB","supUsina","supBuraco","supBase"]){
    const [,x,y]=PT[k]; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const t=g.G(x+dx,y+dy); if(TP[t] && TP[t].b) g.S(x+dx,y+dy, k==="supHatch"?T.PEDRA : (y>=96&&x<120?T.AREIA:(x>=128&&y>=116?T.CONCRETO:T.CALC))); M.cont.delete((x+dx)+","+(y+dy)); }
    g.S(x,y, k.startsWith("supBueiro")?T.BUEIRO:T.DESCE);
  }
  for(const k of ["supMetroA","supMetroB"]){ const [,x,y]=PT[k]; g.placa(x+2,y-1,"Estação de METRÔ. Escadas para o subsolo."); }
  // borda do mundo
  for(let x=0;x<W;x++){ g.S(x,0,T.ARVORE); g.S(x,H-1,T.ENTULHO); }
  for(let y=0;y<H;y++){ g.S(0,y,T.ARVORE); g.S(W-1,y,T.ENTULHO); }
  return M;
}

// ---- ESGOTOS (debaixo da cidade)
function gerarEsg(){
  const M=novoMapa(80,56,T.ESGP), g=ferramentas(M,99), r=g.r;
  for(const y of [6,18,30,42]) g.rect(2,y-1,77,y+1,T.ESGC);
  for(const x of [7,23,39,55,71]) g.rect(x-1,2,x+1,53,T.ESGC);
  for(const y of [18,42]) for(let x=3;x<77;x++) if(r()<.85) g.S(x,y,T.LODO);
  for(const [x1,y1,x2,y2] of [[10,9,18,15],[26,21,34,27],[44,9,52,15],[58,21,66,27],[12,33,20,39],[42,33,50,39]]){ g.rect(x1,y1,x2,y2,T.ESGC); for(let k=0;k<3;k++) g.S(g.ri(x1,x2),g.ri(y1,y2),T.ENTULHO); g.cont(x2,y1,"caixa"); }
  g.rect(58,44,76,53,T.ESGC); g.rect(55,42,60,45,T.ESGC);
  for(let i=0;i<M.W*M.H;i++) if(M.t[i]===T.ESGC && r()<.03) M.t[i]=T.ENTULHO;
  for(const [x1,y1,x2,y2] of [[10,9,18,15],[26,21,34,27],[44,9,52,15],[58,21,66,27],[12,33,20,39],[42,33,50,39]]){
    const cy=(y1+y2)>>1; g.limpar(x1-5,cy,x1+1,cy,T.ESGC); g.limpar(x2-1,y1-3,x2-1,y1+1,T.ESGC); }
  for(const k of ["esgA","esgB"]){ const [,x,y]=PT[k]; g.rect(x-1,y-1,x+1,y+1,T.ESGC); g.S(x,y,T.ESCADA); }
  g.placa(10,5,"Esgoto da cidade. Os ratos aqui obedecem a alguém...");
  return M;
}

// ---- METRÔ
function gerarMetro(){
  const M=novoMapa(140,26,T.AZULEJO), g=ferramentas(M,77), r=g.r;
  g.rect(2,10,137,15,T.TRILHO);
  for(const [x1,x2] of [[10,26],[60,76],[110,126]]){ g.rect(x1,3,x2,9,T.CALC); g.rect(x1,16,x2,21,T.CALC); }
  for(let x=4;x<136;x++) if(r()<.04) g.S(x,g.ri(10,15),T.ENTULHO);
  for(const x of [34,48,88,100]) { g.cont(x,12,"carro"); }
  g.cont(12,20,"lixeira"); g.cont(24,20,"caixa"); g.cont(112,20,"lixeira"); g.cont(124,4,"caixa");
  for(const k of ["metroA","metroB"]){ const [,x,y]=PT[k]; g.S(x,y,T.ESCADA); }
  g.placa(70,4,"ESTAÇÃO CENTRAL — território neutro do Tião. Sem brigas aqui.");
  g.pz(60,3,76,9);
  return M;
}

// ---- CAVERNAS (debaixo do deserto)
function gerarCaverna(){
  const W=96,H=72, M=novoMapa(W,H,T.ROCHAP), g=ferramentas(M,1313), r=g.r;
  let c=new Uint8Array(W*H); for(let i=0;i<W*H;i++) c[i]=r()<.45?1:0;
  for(let it=0;it<5;it++){ const n=new Uint8Array(W*H);
    for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){ let k=0; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) k+=c[(y+dy)*W+x+dx]; n[y*W+x]= k>=5?1:0; }
    for(let i=0;i<W;i++){ n[i]=1; n[(H-1)*W+i]=1; } for(let y=0;y<H;y++){ n[y*W]=1; n[y*W+W-1]=1; } c=n; }
  for(let i=0;i<W*H;i++) M.t[i]= c[i]?T.ROCHAP:T.ROCHA;
  // túnel garantido entre as duas entradas e pelas salas
  const pts=[[10,10],[30,20],[50,12],[70,24],[45,40],[20,55],[60,58],[85,60]];
  for(let i=0;i<pts.length-1;i++){ let [x,y]=pts[i]; const [tx,ty]=pts[i+1];
    while(x!==tx||y!==ty){ g.rect(x-1,y-1,x+1,y+1,T.ROCHA); if(r()<.5 && x!==tx) x+=Math.sign(tx-x); else if(y!==ty) y+=Math.sign(ty-y); else x+=Math.sign(tx-x); } }
  // remove bolsões isolados
  const vis=new Uint8Array(W*H), fila=[10*W+10]; vis[10*W+10]=1;
  while(fila.length){ const i=fila.pop(), x=i%W, y=(i/W)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const j=(y+dy)*W+x+dx; if(!vis[j] && M.t[j]!==T.ROCHAP){ vis[j]=1; fila.push(j); } } }
  for(let i=0;i<W*H;i++) if(M.t[i]!==T.ROCHAP && !vis[i]) M.t[i]=T.ROCHAP;
  for(let i=0;i<W*H;i++){ if(M.t[i]!==T.ROCHA) continue; const x=i%W,y=(i/W)|0;
    const parede = M.t[i-1]===T.ROCHAP || M.t[i+1]===T.ROCHAP || M.t[i-W]===T.ROCHAP;
    const q=r(); if(parede && q<.05) M.t[i]=T.CRISTAL; else if(q<.012) M.t[i]=T.RAD; else if(q<.016){ M.t[i]=T.CONT; M.cont.set(x+","+y,"mochila"); } }
  for(const k of ["cavA","cavB"]){ const [,x,y]=PT[k]; g.rect(x-1,y-1,x+1,y+1,T.ROCHA); for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) M.cont.delete((x+dx)+","+(y+dy)); g.S(x,y,T.ESCADA); }
  return M;
}

// ---- BASE SUBTERRÂNEA (final)
function gerarBase(){
  const M=novoMapa(64,48,T.METALP), g=ferramentas(M,7777), r=g.r;
  g.rect(3,5,60,7,T.CONCRETO); g.rect(30,5,32,44,T.CONCRETO); g.rect(3,24,60,26,T.CONCRETO); g.rect(5,5,7,44,T.CONCRETO);
  const labs=[[10,10,26,20],[36,10,58,20],[10,30,26,42]];
  for(const [x1,y1,x2,y2] of labs){ g.sala(x1-1,y1-1,x2+1,y2+1,T.METAL,T.METALP); g.S(((x1+x2)>>1),y1-1,T.PORTAF); g.S(x1-1,((y1+y2)>>1),T.PORTA);
    g.cavar((x1+x2)>>1,y1-1,0,-1,T.CONCRETO); g.cavar(x1-1,(y1+y2)>>1,-1,0,T.CONCRETO);
    for(let x=x1+1;x<x2;x+=3) g.S(x,y1+1,T.CONSOLE); g.cont(x2,y2,"militar"); g.cont(x1,y2,"medico"); }
  g.rect(8,8,9,9,T.CONCRETO); g.rect(27,25,29,25,T.CONCRETO);
  g.sala(39,29,59,45,T.METAL,T.METALP); g.S(39,37,T.PORTAF); g.rect(33,36,38,38,T.CONCRETO);
  for(const [x,y] of [[42,32],[56,32],[42,42],[56,42]]) g.S(x,y,T.CONSOLE);
  g.placa(34,35,"LABORATÓRIO 0 — PROJETO X. ACESSO PROIBIDO. Se você está lendo isto, corra.");
  for(let i=0;i<M.W*M.H;i++) if(M.t[i]===T.CONCRETO && r()<.02) M.t[i]=T.ENTULHO;
  const [,x,y]=PT.baseA; g.rect(x-1,y-1,x+1,y+1,T.CONCRETO); g.S(x,y,T.ESCADA);
  return M;
}
function gerarMundo(){
  MAPA.bunker=gerarBunker(); MAPA.sup=gerarSup(); MAPA.esg=gerarEsg(); MAPA.metro=gerarMetro(); MAPA.caverna=gerarCaverna(); MAPA.base=gerarBase();
}
const MAPAS = ["bunker","sup","esg","metro","caverna","base"];

// ---- tabelas de loot dos contêineres  [item, chance%, min, max]
const CONT_INFO = {
  armario:{n:"Armário",loot:[["camiseta",15,1,1],["jeans",12,1,1],["bone",10,1,1],["bandagem",30,1,2],["tampinha",50,3,15],["refri",25,1,1],["cargo",4,1,1],["jaqueta",4,1,1]]},
  geladeira:{n:"Geladeira",loot:[["lata",50,1,2],["refri",40,1,2],["garrafa",40,1,2],["agua_suja",25,1,1],["cereal",30,1,2]]},
  caixa:{n:"Caixa",loot:[["sucata",55,1,3],["componente",15,1,1],["pedra",30,5,15],["flecha",15,3,8],["tampinha",40,2,10],["cereal",15,1,1]]},
  carro:{n:"Carro abandonado",loot:[["tampinha",55,3,20],["bala",20,2,6],["garrafa",25,1,1],["sucata",40,1,2],["componente",12,1,1],["bandagem",15,1,1],["tocha",5,1,1]]},
  lixeira:{n:"Lixeira",loot:[["sucata",40,1,2],["cereal",15,1,1],["agua_suja",30,1,1],["tampinha",35,1,6],["carne_rato",15,1,1]]},
  mochila:{n:"Mochila abandonada",loot:[["lata",30,1,1],["garrafa",30,1,1],["bandagem",30,1,2],["iodo",20,1,1],["tampinha",60,5,25],["bala",15,3,8],["mascara",2,1,1]]},
  militar:{n:"Caixa militar",loot:[["bala",55,5,15],["cartucho",30,2,6],["mre",40,1,2],["iodo",25,1,1],["medkit",15,1,1],["colete_sucata",3,1,1],["capacete_mil",2,1,1],["rifle",1,1,1]]},
  medico:{n:"Armário de remédios",loot:[["bandagem",60,1,3],["medkit",20,1,1],["iodo",35,1,2]]},
  cofre:{n:"Cofre",loot:[["tampinha",100,40,200],["componente",40,1,2],["chip",15,1,1]]}
};
const CONT_TEMPO = 8*60*1000;     // tempo até o contêiner encher de novo
function rolarLoot(tab){ const out=[]; for(const [id,pct,mn,mx] of tab) if(chance(pct)) out.push({id,q:R(mn,mx)}); return out; }

// ---- criaturas por mapa  [mapa, tipo, x, y, raio, quantidade, segundos para renascer]
const DEF_SPAWNS = [
  ["sup","rato",58,72,5,3,25],["sup","rato",66,80,4,3,25],["sup","rato",56,60,4,2,25],
  ["sup","rato",30,40,6,4,25],["sup","rato",70,46,5,3,25],["sup","cao",40,22,6,3,30],["sup","cao",12,46,5,3,30],["sup","cao",88,14,5,3,30],
  ["sup","cao",86,36,6,3,30],["sup","javali_x",0,0,0,0,0],
  ["sup","cao",124,14,6,3,30],["sup","saqueador",150,14,6,2,40],["sup","cao",172,30,6,3,30],
  ["sup","saqueador",120,50,6,3,40],["sup","saqueador",160,46,6,3,40],["sup","atirador",182,52,5,2,45],["sup","carnical",130,92,6,3,35],
  ["sup","carnical",150,104,6,3,35],["sup","saqueador",170,76,6,3,40],["sup","atirador",186,96,5,2,45],["sup","carnical",118,64,5,3,35],
  ["sup","carnical",150,60,5,3,35],["sup","atirador",172,92,4,2,45],
  ["sup","escorp",40,104,8,4,45],["sup","escorp",90,112,8,4,45],["sup","carnical",60,136,6,3,35],["sup","mutante",36,128,5,2,60],
  ["sup","mutante",100,124,5,2,60],["sup","escorp",68,121,5,3,45],["sup","carnica",17,130,2,1,600],
  ["sup","soldado",150,132,8,3,50],["sup","soldado",180,128,6,3,50],["sup","drone",165,124,6,2,55],
  ["esg","rato",12,6,5,4,20],["esg","barata",23,12,4,4,25],["esg","rato",39,18,6,4,20],["esg","barata",30,24,4,3,25],["esg","rato",55,30,6,4,20],
  ["esg","barata",14,36,4,3,25],["esg","barata",46,36,4,3,25],["esg","rato",71,12,6,4,20],["esg","rei",68,49,1,1,300],
  ["metro","carnical",40,12,8,4,35],["metro","rato",30,12,8,4,20],["metro","saqueador",95,12,8,3,40],["metro","carnical",100,12,8,3,35],["metro","atirador",118,18,4,2,45],
  ["caverna","morcego",30,20,8,5,20],["caverna","morcego",60,58,8,5,20],["caverna","aranha",50,12,6,3,45],["caverna","escorp",70,24,7,4,45],
  ["caverna","aranha",45,40,6,3,45],["caverna","mutante",20,55,6,2,60],["caverna","escorp",80,58,6,3,45],
  ["base","soldado",18,6,6,3,50],["base","drone",31,15,5,2,55],["base","soldado",18,15,5,3,50],["base","drone",47,15,6,3,55],
  ["base","soldado",18,36,5,3,50],["base","soldado",45,25,8,3,50],["base","experimento",50,38,2,1,900]
].filter(s=>MONS[s[1]]);

if (typeof module !== "undefined") module.exports={R,chance,clamp,cheb,norm,mulberry,hash,T,TP,mk,ITENS,PRECO,MONS,MAPA,tileEm,pzEm,xpNivel,
  PORTAIS,PT,LINKS,linkEm,NOME_MAPA,TEMPLO,NPC_POS,gerarMundo,MAPAS,CONT_INFO,CONT_TEMPO,rolarLoot,DEF_SPAWNS,descItem};
