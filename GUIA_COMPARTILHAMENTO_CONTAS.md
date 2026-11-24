# Guia: contas compartilhadas e responsável pelo pagamento

Este guia explica como lançar contas junto com outra pessoa e indicar, em cada
lançamento, quem é o responsável pelo pagamento (ou, nas receitas, quem recebe).

---

## Como funciona

O app trabalha com **áreas de trabalho**. Cada área é uma planilha no Google Drive:

| Área | Planilha | Quem vê |
|---|---|---|
| **Pessoal** | *Financeiro Doméstico* | Só você |
| **Compartilhada** | *Financeiro Doméstico — &lt;nome&gt;* | Você e as pessoas convidadas |

Dentro de uma área compartilhada todos veem e editam os **mesmos** lançamentos,
cartões, faturas e categorias. A área pessoal continua separada: o que você lança
nela não aparece para ninguém.

Você troca de área pelo seletor **Área de trabalho** na barra lateral.

---

## Passo a passo

### 1. Criar a área compartilhada

1. Menu lateral → **Áreas e pessoas**.
2. **Nova área compartilhada** → dê um nome (ex.: "Casa") → **Criar e abrir**.

A planilha é criada no **seu** Drive e você é o dono da área.

### 2. Convidar a outra pessoa

1. Ainda em **Áreas e pessoas**, com a área compartilhada ativa, informe o
   **e-mail da conta Google** da pessoa (e um nome, se quiser) → **Convidar**.
2. O Google envia um e-mail avisando que a planilha foi compartilhada, com o link
   de entrada no app. O mesmo link aparece na tela, com o botão **Copiar link**,
   para mandar por WhatsApp, por exemplo.

A pessoa aparece na lista como **Convite pendente** e já pode ser escolhida
como responsável pelos lançamentos.

### 3. A pessoa convidada entra

1. Abre o link do convite e entra com a conta Google convidada.
2. Na primeira vez, o app abre uma janela do Google pedindo para **selecionar a
   planilha** da área → **Selecionar**. (O app só tem acesso aos arquivos que a
   própria pessoa liberar.)
3. Pronto: a área aparece no seletor da barra lateral dela.

### 4. Lançar indicando o responsável

No formulário de nova movimentação, escolha **Responsável pelo pagamento**
(em receitas: **Quem recebe**). O padrão é quem está lançando.

O responsável também pode ser alterado:

- ao editar um lançamento;
- em lote: selecione vários lançamentos → **Editar** → *Atualizar Responsável pelo pagamento*.

---

## De qual receita sai cada despesa

Além de quem paga, dá para indicar **com qual dinheiro** a despesa é paga:

1. Ao lançar (ou editar) uma despesa, em **Pago com a receita**, clique em
   **Vincular receita**.
2. Escolha a receita (a lista mostra quanto ainda está disponível em cada uma) e
   o valor. O app já sugere o que falta cobrir.
3. Para dividir, vincule mais de uma receita — ex.: R$ 500 do salário e
   R$ 400 do freela.

Ao abrir uma receita você vê as despesas pagas com ela, quanto está
**comprometido** e quanto **sobra**. Na lista, a coluna **Receita** mostra
"Sobra R$ …" nas receitas e "Coberta" / "Falta R$ …" nas despesas.

---

## Pessoas sem acesso

Em **Áreas e pessoas → Pessoa sem acesso ao app** você cadastra alguém só para
aparecer como responsável (um filho, a diarista, um parente que paga uma conta).
Essa pessoa não recebe convite nem acesso à planilha. Funciona inclusive na área
pessoal.

---

## Acompanhando quem paga o quê

Na tela **Lançamentos**:

- a coluna **Responsável** mostra a pessoa de cada lançamento (com filtro e ordenação);
- acima da lista aparecem os totais por pessoa no período: quanto ela **paga**
  (e quanto já foi pago) e quanto **recebe**. Clique em uma pessoa para filtrar.

A exportação (CSV/XLSX) inclui a coluna **Responsável**.

---

## Removendo alguém

Em **Áreas e pessoas**, clique na lixeira ao lado da pessoa. O app retira a
permissão dela na planilha do Drive. Os lançamentos antigos continuam mostrando o
nome dela (riscado), para o histórico não se perder. O dono da área não pode ser
removido.

---

## Perguntas frequentes

**A outra pessoa vê minha área pessoal?**
Não. Só a área compartilhada para a qual foi convidada.

**Posso ter mais de uma área compartilhada?**
Sim — por exemplo, "Casa" com o cônjuge e "Viagem 2027" com amigos. Cada uma
tem as próprias pessoas e lançamentos.

**E se os dois lançarem ao mesmo tempo?**
O app relê a planilha antes de cada gravação, então lançamentos feitos em
momentos diferentes não se perdem. Gravações exatamente simultâneas ainda
podem se sobrepor; em caso de dúvida use **Configurações → Google Sheets →
Recarregar dados**.

**O link do convite não funciona para a pessoa.**
Confira se ela entrou com o mesmo e-mail que foi convidado e se o site tem o
seletor do Google configurado (variáveis `VITE_GOOGLE_API_KEY` e
`VITE_GOOGLE_APP_ID`, ver README).
