# Zona Morta — servidor multiplayer

Servidor do modo **online** do jogo em [preppersbr.com/jogo](https://preppersbr.com/jogo/).
Node.js + WebSocket. O servidor manda no mundo inteiro: posições, monstros, combate,
loot, NPCs, missões, trocas, chat e contas (nome + senha, com hash scrypt).

## Colocar no ar (Render, plano grátis)

1. Entre em <https://render.com> e crie uma conta usando **"Sign in with GitHub"**.
2. No painel: **New → Blueprint**.
3. Escolha o repositório `monitor-preppers-br` e clique em **Connect / Apply**.
   O Render lê o arquivo `render.yaml` da raiz e cria o serviço `zona-morta-servidor` sozinho.
4. Espere o deploy ficar **Live** (uns 2–3 minutos). O endereço será algo como
   `https://zona-morta-servidor.onrender.com`.
5. Se o endereço for diferente desse, o jogo precisa saber: troque `SERVIDOR_PADRAO`
   em `jogo/index.html` (use `wss://` no lugar de `https://`).

Pronto: em preppersbr.com/jogo, use **JOGAR ONLINE**.

## Quem pode jogar

Só quem tem **conta no site** (qualquer nível, a partir de Sentinela, que é grátis).
A página `jogo/` usa o `nivel.js`, e o servidor confere o *ID token* do Firebase de cada
jogador (assinatura do Google + projeto `comunidade-preppers-br-f5253`). Cada conta do site
tem um personagem; o nome é escolhido no primeiro acesso.

Para testes locais sem Firebase: `EXIGIR_CONTA=0` libera entrar com nome + senha.

## Coisas para saber

- **Plano grátis dorme** depois de 15 minutos sem ninguém conectado. O primeiro jogador
  a entrar espera até ~1 minuto para o servidor acordar.
- **Plano grátis não tem disco permanente.** Quando o servidor reinicia ou atualiza, o
  arquivo de contas é apagado. Para não perder ninguém, o jogo guarda uma cópia do
  personagem no navegador de cada jogador e, se a conta sumir do servidor, recria a conta
  com essa cópia no próximo login.
  Para guardar tudo no servidor de verdade: plano **Starter** + um **Disk** montado em
  `/var/data` e a variável `DATA_DIR=/var/data`.
- Como o backup vem do navegador, um jogador mais esperto consegue editar o próprio
  personagem quando a conta é recriada. Para um jogo do canal isso é aceitável; com disco
  permanente o problema some.

## Variáveis de ambiente

| Variável | Para quê | Padrão |
|---|---|---|
| `PORT` | Porta HTTP/WebSocket (o Render define) | `8080` |
| `ORIGENS` | Sites que podem conectar, separados por vírgula | todos |
| `DATA_DIR` | Pasta onde fica `contas.json` | `./dados` |
| `MAX_JOGADORES` | Limite de conectados | `150` |
| `EXIGIR_CONTA` | `1` = só conta do site; `0` = aceita nome + senha | `1` |
| `FIREBASE_PROJETO` | Projeto Firebase das contas do site | `comunidade-preppers-br-f5253` |

## Rodar no seu computador

```bash
cd servidor-jogo
npm install
EXIGIR_CONTA=0 node servidor.js
```
Depois abra o jogo com `?servidor=ws://localhost:8080` no fim do endereço.

## Arquivos

- `servidor.js` — o mundo: loop de 20 ticks/s, IA dos monstros, combate, NPCs, contas.
- `dados.js` — itens, monstros, preços, spawns e geração do mapa. **É uma cópia dos dados
  de `jogo/index.html`**: se mudar um item ou monstro no jogo, mude aqui também.
