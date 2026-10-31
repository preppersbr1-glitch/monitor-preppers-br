"use strict";
// ======================================================================
// Zona Morta — dados do mundo (extraídos de jogo/index.html).
// Itens, monstros, preços, spawns e geração do mapa. Se mudar esses dados
// no jogo, atualize aqui também (mesmos ids).
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
function gerarSup(){
  const W=96,H=72,M=mk(W,H),r=mulberry(4242);
  const S=(x,y,v)=>{ if(x>=0&&y>=0&&x<W&&y<H) M.t[y*W+x]=v; };
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    let v; if(y>=48 && x<54) v = r()<.75?T.AREIA:T.TERRA;
    else if(x>=55 && y>=8 && y<=62) v=T.CALC;
    else v = r()<.72?T.GRAMA:T.TERRA;
    S(x,y,v);
  }
  // floresta
  for(let y=1;y<=26;y++) for(let x=1;x<=49;x++) if(r()<.30) S(x,y,T.ARVORE);
  for(let x=1;x<=50;x++){ S(x,18,T.TERRA); S(x,19,T.TERRA); }
  for(let y=1;y<=28;y++){ S(14,y,T.TERRA); S(15,y,T.TERRA); S(30,y,T.TERRA); S(31,y,T.TERRA); }
  for(const [cx,cy] of [[20,10],[40,23],[9,8],[24,24],[8,23]]) for(let y=cy-3;y<=cy+3;y++) for(let x=cx-3;x<=cx+3;x++) S(x,y,r()<.7?T.GRAMA:T.TERRA);
  // lago
  for(let y=5;y<=19;y++) for(let x=31;x<=47;x++) if(((x-39)/7.5)**2+((y-12)/4.6)**2<1) S(x,y,T.AGUA);
  // deserto
  for(let y=48;y<H;y++) for(let x=1;x<54;x++){ const q=r(); if(q<.035) S(x,y,T.ENTULHO); else if(q<.055) S(x,y,T.ARVORE); }
  for(let i=0;i<22;i++){ const cx=R(5,50), cy=R(50,69); S(cx,cy,T.RAD); if(chance(70)) S(cx+1,cy,T.RAD); if(chance(50)) S(cx,cy+1,T.RAD); }
  // cidade em ruínas
  for(let bx=56;bx<94;bx+=10) for(let by=10;by<62;by+=10){
    for(let x=bx;x<bx+10;x++){ S(x,by,T.ASF); S(x,by+1,T.ASF); }
    for(let y=by;y<by+10;y++){ S(bx,y,T.ASF); S(bx+1,y,T.ASF); }
    if(r()<.15){ for(let k=0;k<8;k++) S(bx+R(3,8),by+R(3,8),T.ENTULHO); continue; }
    const x1=bx+3+R(0,1), y1=by+3+R(0,1), x2=bx+8-R(0,1), y2=by+8-R(0,1);
    for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++){
      const borda = x===x1||x===x2||y===y1||y===y2;
      if(borda) S(x,y, r()<.08 ? (r()<.5?T.ENTULHO:T.PISO) : T.PAREDE);
      else S(x,y, r()<.07?T.ENTULHO:T.PISO);
    }
    const portas=[[R(x1+1,x2-1),y2],[x1,R(y1+1,y2-1)],[R(x1+1,x2-1),y1],[x2,R(y1+1,y2-1)]];
    for(let k=0;k<2;k++){ const p=portas.splice(R(0,portas.length-1),1)[0]; S(p[0],p[1],T.PORTA); }
  }
  for(let y=62;y<=63;y++) for(let x=56;x<95;x++) S(x,y,T.ASF);
  // estradas principais
  for(let x=24;x<=56;x++) for(let y=35;y<=37;y++) S(x,y,T.ASF);
  for(let y=1;y<=70;y++) for(let x=50;x<=52;x++) S(x,y,T.ASF);
  for(let i=0;i<W*H;i++) if(M.t[i]===T.ASF && r()<.03){ const x=i%W,y=(i/W)|0; if(!(y>=35&&y<=37)&&!(x>=50&&x<=52)) M.t[i]=T.CARRO; }
  // Abrigo Esperança (zona segura)
  for(let y=28;y<=44;y++) for(let x=8;x<=26;x++){
    const borda = x===8||x===26||y===28||y===44;
    if(borda) S(x,y,T.PAREDE); else { S(x,y, (x>=13&&x<=21&&y>=32&&y<=40)?T.PISO:(r()<.6?T.GRAMA:T.TERRA)); M.pz[y*W+x]=1; }
  }
  for(const [x,y] of [[26,35],[26,36],[26,37],[17,28],[18,28],[17,44],[18,44]]){ S(x,y,T.PORTA); M.pz[y*W+x]=1; }
  S(14,33,T.POCO); S(11,31,T.FOGO); S(23,41,T.FOGO); S(17,31,T.FOGO);
  // covil do Carniça
  for(let y=57;y<=69;y++) for(let x=4;x<=18;x++){
    const borda=x===4||x===18||y===57||y===69;
    if(borda) S(x,y, r()<.12?T.ENTULHO:T.PAREDE); else S(x,y, r()<.05?T.ENTULHO:T.TERRA);
  }
  S(11,57,T.TERRA); S(12,57,T.TERRA);
  // borda do mundo
  for(let x=0;x<W;x++){ S(x,0,T.ARVORE); S(x,H-1,x<54?T.ENTULHO:T.ENTULHO); }
  for(let y=0;y<H;y++){ S(0,y,T.ARVORE); S(W-1,y,T.ENTULHO); }
  S(76,30,T.BUEIRO);
  return M;
}
function gerarEsg(){
  const W=44,H=32,M=mk(W,H),r=mulberry(99);
  M.t.fill(T.ESGP);
  const cv=(x1,y1,x2,y2)=>{ for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++) M.t[y*W+x]=T.ESGC; };
  cv(2,3,41,6); cv(2,14,41,17); cv(2,25,33,28); cv(3,2,6,29); cv(19,2,22,29); cv(35,2,38,24); cv(32,21,42,30);
  cv(8,8,14,12); cv(26,8,32,12); cv(11,6,12,8); cv(29,6,30,8); cv(8,19,15,23); cv(11,17,12,19);
  for(let x=8;x<=17;x++) M.t[16*W+x]=T.LODO; for(let x=24;x<=33;x++) M.t[15*W+x]=T.LODO;
  for(let i=0;i<W*H;i++) if(M.t[i]===T.ESGC && r()<.035) M.t[i]=T.ENTULHO;
  M.t[4*W+4]=T.ESCADA; M.t[5*W+5]=T.ESGC; M.t[4*W+5]=T.ESGC; M.t[5*W+4]=T.ESGC;
  return M;
}
const tileEm = (m,x,y) => { const M=MAPA[m]; return (x<0||y<0||x>=M.W||y>=M.H) ? T.ESGP : M.t[y*M.W+x]; };
const pzEm = (m,x,y) => { const M=MAPA[m]; return x>=0&&y>=0&&x<M.W&&y<M.H && M.pz[y*M.W+x]===1; };

const DEF_SPAWNS = [
  ["sup","rato",35,42,4,3,25],["sup","rato",42,33,4,2,25],["sup","rato",20,10,5,4,25],["sup","rato",24,24,4,3,25],
  ["sup","cao",40,23,5,3,30],["sup","cao",9,8,4,3,30],["sup","cao",8,23,3,2,30],["sup","cao",60,40,4,2,30],
  ["sup","saqueador",64,16,5,3,40],["sup","saqueador",84,22,6,3,40],["sup","saqueador",67,46,5,2,40],["sup","atirador",73,44,5,2,45],
  ["sup","atirador",86,34,4,2,45],["sup","saqueador",86,52,5,3,40],["sup","carnical",64,54,5,3,35],["sup","carnical",84,14,5,3,35],["sup","carnical",76,26,4,2,35],
  ["sup","escorp",30,56,6,4,45],["sup","escorp",44,52,5,3,45],["sup","carnical",40,64,5,3,35],["sup","mutante",26,63,4,2,60],["sup","mutante",44,66,4,1,60],
  ["sup","carnica",11,64,2,1,600],
  ["esg","rato",12,5,4,4,20],["esg","barata",21,10,4,4,25],["esg","rato",30,16,5,4,20],["esg","barata",12,27,4,3,25],["esg","barata",37,12,4,3,25],
  ["esg","barata",11,21,3,3,25],["esg","rei",38,26,1,1,300]
];
function xpNivel(L){ return Math.round(50/3*(L**3 - 6*L**2 + 17*L - 12)); }
module.exports={R,chance,clamp,cheb,norm,mulberry,hash,T,TP,mk,ITENS,PRECO,MONS,MAPA,gerarSup,gerarEsg,tileEm,pzEm,DEF_SPAWNS,xpNivel};
