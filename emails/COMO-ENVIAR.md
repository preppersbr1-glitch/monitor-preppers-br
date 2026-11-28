# E-mail marketing do Guia — como enviar pelo Brevo

O e-mail está pronto em `emails/guia-membros.html`. A lista de membros sai do Admin.

## 1. Criar a conta (grátis)
1. Entre em **brevo.com** → **Cadastre-se grátis** (até 300 e-mails por dia).
2. Confirme o e-mail e preencha os dados da empresa (o Brevo pede um endereço: ele aparece no rodapé por lei).

## 2. Autenticar o domínio (para não cair no spam)
1. Brevo → **Configurações → Remetentes, domínios e IPs → Domínios → Adicionar um domínio** → `preppersbr.com`.
2. O Brevo mostra alguns registros **DNS** (TXT/CNAME para DKIM, DMARC e o código Brevo).
3. Coloque esses registros onde o domínio `preppersbr.com` é administrado (Registro.br, Cloudflare, GoDaddy...).
4. Volte ao Brevo e clique em **Autenticar**. Pode levar de minutos a algumas horas.
5. Em **Remetentes**, crie `contato@preppersbr.com` (nome: **Julio · PREPPERS BR**).

## 3. Importar os membros
1. Admin do site → **MEMBROS** → **⬇ EXPORTAR E-MAILS (CSV)** (sem filtro = todos; ou escolha um plano antes).
2. Brevo → **Contatos → Importar contatos → Importar um arquivo** → envie o `.csv`.
3. Confira as colunas: `EMAIL` → Email, `FIRSTNAME` → Nome (FIRSTNAME), `PLANO` → crie o atributo **PLANO** (texto).
4. Coloque numa lista nova, por exemplo **Membros do site**.
5. Na pergunta sobre consentimento, confirme que são pessoas que criaram conta no seu site.

## 4. Criar a campanha
1. Brevo → **Campanhas → Criar campanha → E-mail**.
2. **Assunto** (escolha um, ou faça teste A/B com dois):
   - `{{ contact.FIRSTNAME }}, se a luz cair hoje, sua família sabe o que fazer?`
   - `O manual de preparação feito para o Brasil (R$ 39,50)`
   - `Água para 3 dias? O guia mostra a ordem certa`
3. **Pré-visualização**: `41 capítulos, 20 diagramas e checklists prontos para imprimir.`
4. **Remetente**: `contato@preppersbr.com` · **Destinatários**: lista *Membros do site*.
5. **Conteúdo** → **Editor HTML / Colar seu código** → apague tudo e cole o conteúdo de `emails/guia-membros.html`.
6. **Enviar um teste** para o seu e-mail e confira no celular.
7. **Agendar**: terça a quinta, entre 19h e 21h, costuma ter mais abertura.

## Regras importantes (LGPD)
- O link **Descadastrar** (`{{ unsubscribe }}`) já está no rodapé — não remova.
- Quem se descadastrar fica bloqueado no Brevo automaticamente; nas próximas campanhas, importe a lista de novo sem medo: o Brevo não envia para quem saiu.
- Não compre listas nem envie para quem não tem conta no site.

## Depois do envio
- Brevo → **Estatísticas**: aberturas, cliques e descadastros.
- As vendas vindas do e-mail aparecem com `utm_campaign=guia-membros` (Hotmart → origem da venda / Google Analytics).
- Quem comprou: peça o depoimento 5–7 dias depois com o link `https://preppersbr.com/guia.html#depoimento`.
