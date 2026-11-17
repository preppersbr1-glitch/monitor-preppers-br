# Pagamentos — assinatura no cartão (Mercado Pago + Cloudflare)

```
membros.html ──ASSINAR──▶ Worker /assinar ──▶ Mercado Pago (cria assinatura) ──▶ checkout
Mercado Pago ──aviso──▶ Worker /webhook ──consulta MP──▶ Firebase members/<uid> (level, paidUntil, sub)
```

- **worker.js** é o programa inteiro (um arquivo, sem instalar nada). Preços ficam nele (`PLANOS`).
- O site só guarda o endereço do Worker (`PAGAMENTOS_URL` em `membros.html`). Nenhum segredo vai para o site.
- Acesso: nível sobe quando há cobrança aprovada; `paidUntil` = próxima cobrança + 3 dias.
  Cancelou ou o cartão falhou: não há novas cobranças e o acesso acaba sozinho em `paidUntil`.

## 1. Mercado Pago — aplicação e credenciais

1. Entre em **mercadopago.com.br/developers** → **Suas integrações → Criar aplicação**.
2. Tipo **Pagamentos online**; quando perguntar o produto, escolha **Assinaturas**.
3. Para testar: dentro da aplicação, **Contas de teste → Criar conta de teste**: crie uma **Vendedor** e uma **Comprador** (país Brasil).
   - Entre no painel de desenvolvedor **com a conta Vendedor de teste**, crie uma aplicação nela e copie o
     **Access Token** dela (começa com `APP_USR-`). É este que vai no Worker durante os testes.
   - Anote o **e-mail da conta Comprador de teste** (vai em `MP_PAYER_EMAIL_TESTE`).
4. Para valer de verdade: na sua aplicação real, **Credenciais de produção** (o Mercado Pago pede dados do negócio)
   e copie o **Access Token** de produção.

**O Access Token é secreto.** Ele só vai no painel da Cloudflare (passo 3). Nunca no site, no GitHub ou em conversas.

## 2. Firebase — conta de serviço

console.firebase.google.com → projeto **comunidade-preppers-br** → ⚙️ **Configurações do projeto → Contas de serviço**
→ **Gerar nova chave privada**. Baixa um arquivo `.json`: guarde com cuidado (dá acesso total ao banco).

## 3. Cloudflare — criar o Worker

1. Crie a conta grátis em **dash.cloudflare.com**.
2. **Workers & Pages → Create → Start with Hello World** → nome **`preppers-pagamentos`** → **Deploy**.
3. **Edit code** → apague tudo, cole o conteúdo de `pagamentos/worker.js` → **Deploy**.
4. **Settings → Variables and Secrets → Add** (tipo **Secret** nos três primeiros):

| Nome | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago (de teste no passo 1.3, depois o de produção) |
| `MP_WEBHOOK_SECRET` | "Assinatura secreta" dos webhooks (passo 4) |
| `FIREBASE_SERVICE_ACCOUNT` | o conteúdo **inteiro** do arquivo `.json` do passo 2 |
| ou, se o painel disser *too large*: `FIREBASE_CLIENT_EMAIL` | o valor de `"client_email"` do `.json` (sem aspas) |
| e `FIREBASE_PRIVATE_KEY` | o valor de `"private_key"` do `.json`, de `-----BEGIN PRIVATE KEY-----` até `-----END PRIVATE KEY-----\n` (sem as aspas) |
| `MP_PAYER_EMAIL_TESTE` (Text) | só durante o teste: e-mail do Comprador de teste. **Apague ao ir para produção.** |

5. Abra o endereço do Worker (`https://preppers-pagamentos.<sua-conta>.workers.dev`). Deve mostrar algo como
   `{"mercado_pago":"configurado ...","webhook_assinatura":"configurada","firebase":"configurado"}`.

## 4. Mercado Pago — webhooks

Na aplicação (a de teste ou a de produção) → **Webhooks → Configurar notificações**:
- URL: `https://preppers-pagamentos.<sua-conta>.workers.dev/webhook`
- Eventos: **Planos e assinaturas** (assinaturas e pagamentos recorrentes)
- **Salvar** → copie a **Assinatura secreta** e coloque em `MP_WEBHOOK_SECRET` (passo 3.4).

## 5. Ligar no site

Passe o endereço do Worker para colocar em `PAGAMENTOS_URL` (`membros.html`). O endereço não é segredo.

## 6. Testar

Com as credenciais de teste: entre no site com uma conta, **Membros → Operador → Mensal → Pagar com cartão**.
No checkout, entre com a **conta Comprador de teste** e use um cartão de teste do Mercado Pago
(developers → Cartões de teste; nome do titular `APRO` = aprovado). Volte ao site: em segundos o nível muda para Operador.
Teste também **Cancelar assinatura**.

## 7. Produção

Troque `MP_ACCESS_TOKEN` pelo de produção, **apague `MP_PAYER_EMAIL_TESTE`**, configure o webhook na aplicação de
produção e troque `MP_WEBHOOK_SECRET` pela assinatura secreta dela.

## Mudar preços

Edite `PLANOS` no `worker.js` (e o texto/`PRECOS` em `membros.html`). Vale para assinaturas novas; as existentes
continuam com o valor contratado.

## Publicação das aulas pagas (opcional)

Com o secret `ADMIN_TOKEN` (mín. 32 caracteres, gere com `openssl rand -hex 32`), o Worker aceita
`POST /admin/cursos` com `Authorization: Bearer <ADMIN_TOKEN>` e corpo `{ "<slug>": { "title", "html" } }`:
grava só em `cursos/<slug>` no Firebase. `GET /admin/cursos` lista o que está publicado. Sem o secret a rota não existe.
