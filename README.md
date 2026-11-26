# Controle Financeiro Doméstico

**Demo:** https://davidjeiel.github.io/financeiro-domestico/

Aplicação web para controle de finanças pessoais. Organiza receitas, despesas e cartões de crédito por competências mensais, com relatórios, calendário e exportação de dados.

**Não há banco de dados nem servidor.** O usuário entra com a conta Google direto no navegador e os dados ficam em uma planilha **Financeiro Doméstico** no Google Drive dele.

---

## Índice

- [Como funciona](#como-funciona)
- [Configurando o login Google](#configurando-o-login-google)
- [Áreas de trabalho compartilhadas](#áreas-de-trabalho-compartilhadas)
- [Filtros de lançamentos](#filtros-de-lançamentos)
- [Desenvolvimento](#desenvolvimento)
- [Deploy no GitHub Pages](#deploy-no-github-pages)
- [Scripts disponíveis](#scripts-disponíveis)
- [Páginas da aplicação](#páginas-da-aplicação)
- [Estrutura do projeto](#estrutura-do-projeto)

---

## Como funciona

1. O usuário clica em **Entrar com Google**. O [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model) abre um popup e devolve um token de acesso ao navegador.
2. O app procura no Drive do usuário a planilha que ele mesmo criou (marcada com `appProperties`) ou cria uma nova.
3. Cada tipo de registro é uma aba (`Lancamentos`, `Cartoes`, `Faturas`, `Categorias`, `Contas`…). A linha 1 de cada aba tem os nomes das colunas.
4. Todos os dados são carregados em memória no login; cada alteração é gravada de volta na planilha.

A lógica que antes ficava no servidor (router tRPC) agora roda no navegador via `unstable_localLink` do tRPC — as páginas continuam usando `trpc.*.useQuery/useMutation` normalmente.

**Permissões pedidas:** perfil/e-mail e `drive.file`, que dá acesso **somente aos arquivos criados pelo próprio app** (não ao Drive inteiro).

> Evite renomear as abas ou a primeira linha de cada aba. Se editar a planilha manualmente, use **Configurações → Google Sheets → Recarregar dados**.

---

## Configurando o login Google

É preciso um **OAuth Client ID** do Google (é público, não é segredo):

1. No [Google Cloud Console](https://console.cloud.google.com/), crie (ou escolha) um projeto.
2. Em **APIs e serviços → Biblioteca**, ative a **Google Sheets API** e a **Google Drive API**.
3. Em **APIs e serviços → Tela de permissão OAuth**, configure o app (tipo *Externo*) e adicione os escopos `openid`, `email`, `profile` e `.../auth/drive.file`. Enquanto o app estiver em modo de teste, cadastre os e-mails que poderão entrar em **Usuários de teste**.
4. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web** e, em **Origens JavaScript autorizadas**, adicione:
   - `http://localhost:3000` (desenvolvimento)
   - `https://davidjeiel.github.io` (GitHub Pages)
5. Copie o Client ID para a variável `VITE_GOOGLE_CLIENT_ID`.
6. *(Para áreas compartilhadas)* Ative também a **Google Picker API**, crie uma **Chave de API** em **Credenciais** (restrinja às mesmas origens e às APIs Picker/Drive) e anote o **Número do projeto** (Painel do projeto). Eles vão nas variáveis `VITE_GOOGLE_API_KEY` e `VITE_GOOGLE_APP_ID`. O `VITE_GOOGLE_APP_ID` precisa ser o **número** (só dígitos), não o ID textual do projeto; se estiver vazio ou errado, o app usa o número que aparece no início do Client ID.

---

## Áreas de trabalho compartilhadas

Cada **área de trabalho** é uma planilha própria:

- **Pessoal** — a planilha *Financeiro Doméstico* de cada usuário (como sempre foi).
- **Compartilhada** — uma planilha *Financeiro Doméstico — &lt;nome&gt;* criada em **Áreas e pessoas → Nova área compartilhada**. Todos os participantes leem e gravam a mesma planilha, então veem os mesmos lançamentos, cartões, faturas e categorias.

A área ativa é escolhida no seletor da barra lateral.

**Convidando alguém**

1. Na área compartilhada, em **Áreas e pessoas**, informe o e-mail Google da pessoa e clique em **Convidar**.
2. O app compartilha a planilha pelo Google Drive (permissão de edição) e o Google envia um e-mail com o link `…/join/<id>`.
3. A pessoa abre o link, entra com a conta Google e, na primeira vez, seleciona a planilha na janela do Google (**Google Picker**). Isso é exigido pelo escopo `drive.file`: o app só acessa arquivos criados por ele para aquele usuário ou escolhidos no Picker.

> **O botão "Abrir" do e-mail do Google abre só a planilha, não o app.** Quem entrar no app pelo endereço normal não verá a área até liberá-la: no seletor **Área de trabalho** da barra lateral, escolha **➕ Entrar em área compartilhada comigo…** (ou o botão de mesmo nome em **Áreas e pessoas**) e selecione a planilha. Se a área não abrir, o app agora mostra o motivo em vez de voltar em silêncio para a Pessoal.

**Responsável pelo pagamento**

Todo lançamento (receita, despesa ou cartão) tem o campo **Responsável pelo pagamento** (em receitas, **Quem recebe**). O padrão é quem está lançando. As opções são as pessoas da área:

- participantes que já entraram;
- convidados que ainda não abriram a área;
- **pessoas sem acesso** (ex.: um filho, a diarista), que só servem para indicar responsabilidade — funcionam também na área pessoal.

Na lista de lançamentos há a coluna **Responsável** (com filtro e ordenação) e, acima dela, o total que cada pessoa paga/recebe no período; clicar em uma pessoa filtra os lançamentos dela. A edição individual, a edição em lote e a exportação (CSV/XLSX) também incluem o responsável.

**Colunas novas na planilha**: `Lancamentos.responsibleUserId` e `Lancamentos.createdBy`; `Usuarios.status` e `Usuarios.color`. Planilhas existentes são atualizadas automaticamente no primeiro acesso.

**Transferir lançamentos entre áreas**

Selecione lançamentos na lista e use o botão **Transferir** (ou **Transferir** na edição de um lançamento) para movê-los para outra área de trabalho. Antes de confirmar, o app mostra o que muda:

- **Cartões:** cada cartão de origem é ligado a um cartão da área de destino (sugestão: o de mesmo nome) ou a uma cópia criada lá; as faturas são recalculadas nos dois lados.
- **Responsável:** vira a pessoa de mesmo e-mail na área de destino (ou, para pessoas sem acesso, de mesmo nome); sem correspondente, fica sem responsável.
- **Vínculos com receitas** da área de origem são desfeitos.
- Competência, categoria, notas e links são mantidos; categorias que faltarem são criadas no destino.

Os lançamentos são gravados primeiro no destino e só depois removidos da origem.

**Despesa paga com receita**

Uma despesa (ou compra no cartão) pode ser vinculada a uma ou mais receitas — "a conta de luz sai do salário de março" —, informando quanto sai de cada uma. O vínculo é feito no cadastro (lançamentos simples) ou na edição da despesa, em **Pago com a receita**.

- O app não deixa vincular mais que o valor da despesa nem mais que o disponível da receita.
- Na edição de uma receita aparecem as despesas pagas com ela, o **comprometido** e o que **sobra**.
- Na lista de lançamentos, a coluna **Receita** mostra o que sobra de cada receita e se cada despesa está coberta (com filtro "com/sem vínculo"); o card de saldo mostra as **receitas livres**.
- Excluir um lançamento, ou trocar uma despesa para receita (e vice-versa), apaga os vínculos dele.

Os vínculos ficam na aba `Vinculos` (`expenseId`, `incomeId`, `amount`).

---

## Cartão de crédito nos lançamentos

- **Faturas agrupadas:** na lista de lançamentos, as compras de um cartão aparecem numa única linha **Fatura &lt;cartão&gt;**, com o vencimento e o valor total. Clique na linha (ou na seta) para expandir e ver cada compra; as compras continuam editáveis e selecionáveis.
- **Mês do vencimento:** nas duas visões (**Competência** e **Mensal**), a fatura entra no mês em que vence, que é quando o dinheiro sai. Ex.: num cartão que fecha dia 18 e vence dia 25, em novembro aparece a fatura que fecha em 18/11 e vence em 25/11 (compras de 19/10 a 18/11); as compras feitas a partir de 19/11 aparecem em dezembro. O mesmo vale para o dashboard e os relatórios. Ao lançar uma compra no cartão, o app avisa em qual fatura ela entrou.
- **Cor do cartão:** a linha da fatura e as compras dentro dela ficam com o fundo na cor cadastrada do cartão, esmaecida (a fatura um pouco mais forte), com uma faixa lateral na cor do cartão.
- **Coluna Pago:** um ícone mostra a situação — ✓ verde (pago/recebido), relógio âmbar (pendente/a receber), ! vermelho (despesa ou fatura vencida e não paga) e gráfico azul (fatura paga em parte). Em receitas e despesas, clicar no ícone alterna entre pago e pendente; nas compras do cartão o ícone mostra a situação da fatura (o pagamento é feito em *Pagar*).
- **Faturas por cartão:** em **Cartões**, selecione um cartão para ver as faturas dele, filtrando por ano e mês de vencimento. Cada fatura abre as compras e pode ser paga (total ou parcial) ou ter os pagamentos zerados. O antigo menu *Faturas* foi removido (`/invoices` leva para Cartões).
- **Pagamento:** o botão **Pagar** da linha da fatura registra um pagamento **total** ou **parcial**. A fatura fica *Aberta*, *Parcial · falta R$ …* ou *Paga*, e o "Pago" do card de Cartão soma o que já foi pago nas faturas.
- **Parcelamento:** em *Nova movimentação → Parcelada*, informe o **valor total** e o número de parcelas (2 a 72). O app cria uma parcela por mês com o valor dividido (a diferença de centavos fica na 1ª). No cartão, a 1ª parcela cai na fatura da data da compra, respeitando o dia de fechamento, e as seguintes nas faturas seguintes. A lista mostra "2/10" ao lado da descrição.
- Compras simples no cartão também passam a ir para a fatura certa pelo dia de fechamento do cartão.
- **Vencimento da fatura:** se o dia de vencimento é maior que o de fechamento (ex.: fecha 18, vence 25), a fatura vence no mesmo mês em que fecha; se é menor (ex.: fecha 28, vence 5), vence no mês seguinte. Dias inexistentes no mês (ex.: 31 em fevereiro) usam o último dia. As datas gravadas nas faturas são recalculadas automaticamente pelo cartão.
- **Compras na fatura errada:** compras antigas que ficaram gravadas no mês aberto na tela, e não na fatura da data da compra, geram um aviso em **Cartões** e **Lançamentos**. Em *Revisar e corrigir* o app mostra cada compra com o vencimento atual e o novo; só as marcadas são movidas, e os totais das faturas são refeitos.
- **Ordem manual:** arraste uma linha pela alça (⋮⋮) para mudar a posição; a linha de uma fatura leva todas as compras dela. Também funciona pelo teclado (foco na alça, espaço, setas, espaço). A ordem fica gravada na planilha (`Lancamentos.sortOrder`); ordenar por uma coluna sobrepõe a ordem manual, e o botão **Ordem manual** volta a ela.

---

## Lançamentos fixos sem data final

- Ao criar um lançamento **Recorrente** (em Lançamentos ou Fixos/Parcelados), a **data limite é opcional**: em branco, repete sem fim.
- A planilha guarda a **regra** (aba `Recorrencias`), e o app gera os lançamentos **com 1 ano de antecedência** (até o fim do 12º mês à frente), então a despesa ou receita aparece em todos os meses do próximo ano. Os seguintes aparecem sozinhos conforme o tempo passa (ao abrir o app, e uma vez por dia com ele aberto). Cada ocorrência leva a série (`recurrenceGroup`) e a data (`recurrenceDate`), o que impede gerar duas vezes — inclusive com duas pessoas numa área compartilhada.
- **Valor estimado:** com *O valor muda a cada mês* marcado (padrão), cada ocorrência nasce como **≈ estimado** (`isEstimated`) até o valor real ser confirmado: botão ✓ na lista, editar o valor (ou marcar *Valor confirmado*) ou marcar como pago. Os cards de totais mostram quanto ainda é estimativa.
- **Na edição de uma ocorrência:** *Aplicar valor, descrição, categoria e responsável aos próximos meses* (não mexe nos pagos) e *Encerrar recorrência após este lançamento* (remove as futuras não pagas).
- **Excluir** um lançamento recorrente pergunta o alcance, mostrando quantos lançamentos cada opção remove:
  - *Somente esta* — as outras continuam; aquela data não volta a ser gerada.
  - *Esta e as próximas* — remove as futuras não pagas e encerra a recorrência (futuras já pagas ficam).
  - *Esta, as próximas e as anteriores não pagas* — também limpa o que ficou para trás sem pagamento; as pagas continuam no histórico. Se nada sobrar, a regra é apagada.
  Vínculos com receitas dos lançamentos removidos também saem. A exclusão em lote continua removendo só os lançamentos selecionados.
- **Fixos/Parcelados** lista as recorrências gravadas, com a próxima data e quantas estão estimadas; dá para **encerrar**. Séries antigas, criadas com data final, podem **continuar sem data final**.

---

## Despesas fixas × variáveis (Relatórios)

- **Fixa** = lançamento recorrente. Ao criar um lançamento como **Recorrente** (ou em Fixos/Parcelados), cada lançamento da série guarda a frequência (`Lancamentos.recurrence`) e o id da série (`recurrenceGroup`). Variável = todo o resto (parcelas incluídas).
- Em **Relatórios**, a seção *Despesas fixas × variáveis* (despesas e compras no cartão, por competência) mostra: total de fixas e variáveis do mês e a fatia de cada uma, quanto da receita as fixas comprometem, a evolução dos últimos 6 meses, a divisão por categoria e a lista das fixas do mês. Os números e valores da tabela abrem os lançamentos filtrados.
- **Dados antigos:** séries criadas antes dessa marca aparecem como variáveis. O relatório sugere as despesas que se repetem (mesmo tipo, categoria, descrição, valor e cartão em 3+ competências) para marcar como fixas de uma vez. Também dá para marcar/desmarcar na edição do lançamento (*Despesa fixa (recorrente)*) ou em lote (*Atualizar natureza*). Na lista, lançamentos fixos têm o selo **fixa**.

---

## Filtros de lançamentos

- **Painel de filtros** (botão *Filtros* em Lançamentos): período, tipo, categoria, cartão, **descrição** e faixa de valores. A descrição é buscada por trecho, sem diferenciar maiúsculas, acentos ou espaços sobrando ("farmacia" encontra "Farmácia São João"). Cada critério ativo aparece como etiqueta em *Filtrando por*, com × para remover.
- **Salvar filtro:** grava na planilha (aba *FiltrosSalvos*) o período e todos os critérios do painel. *Aplicar filtro salvo* restaura os dois.
- **Página Filtros:** cria, edita e exclui filtros salvos; vários tipos, categorias ou cartões marcados valem como "qualquer um deles". *Aplicar* abre Lançamentos já filtrado; *Usar como padrão* aplica o filtro ao abrir Lançamentos quando não há outro filtro ativo (só um filtro é padrão por vez).
- Sem datas, o filtro vale para o mês aberto na tela.

## Desenvolvimento

```sh
cp .env.local.example .env.local   # preencha VITE_GOOGLE_CLIENT_ID
pnpm install
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Com Podman/Docker (opcional)

```sh
podman compose up --build
```

O `compose.yaml` só sobe o servidor de desenvolvimento do Vite na porta 3000 (lendo o `.env.local`). Para uma imagem de produção, o `Dockerfile` gera os arquivos estáticos e os serve com nginx:

```sh
podman build --build-arg VITE_GOOGLE_CLIENT_ID=<seu-client-id> -t financeiro .
podman run -p 3000:3000 financeiro
```

---

## Deploy no GitHub Pages

O app é 100% estático: é construído e publicado no GitHub Pages a cada push na branch `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

URL de acesso: **https://davidjeiel.github.io/financeiro-domestico/**

### Primeira vez

1. Em **Settings → Pages**, selecione **GitHub Actions** como *Source*.
2. Em **Settings → Secrets and variables → Actions → Variables**, crie a variável `VITE_GOOGLE_CLIENT_ID` com o Client ID (e, para áreas compartilhadas, `VITE_GOOGLE_API_KEY` e `VITE_GOOGLE_APP_ID`).
3. Confirme que `https://davidjeiel.github.io` está nas origens autorizadas do Client ID.
4. Faça um push na `main` (ou rode manualmente em **Actions → Deploy to GitHub Pages → Run workflow**).

Para alterar o base path (ex.: domínio próprio), edite `VITE_BASE_URL` no workflow:

```yaml
VITE_BASE_URL: /   # domínio próprio
VITE_BASE_URL: /financeiro-domestico/   # GitHub Pages padrão
```

---

## Scripts disponíveis

| Script | Descrição |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento (Vite) em http://localhost:3000 |
| `pnpm build` | Gera os arquivos estáticos em `dist/public/` |
| `pnpm preview` | Serve localmente o build gerado |
| `pnpm test` | Executa os testes (Vitest) |
| `pnpm check` | Verifica tipos TypeScript |
| `pnpm format` | Formata o código com Prettier |

---

## Páginas da aplicação

| Rota | Descrição |
|---|---|
| `/` | Landing page pública |
| `/dashboard` | Resumo financeiro do mês atual |
| `/lancamentos` | Lista e cadastro de movimentações — visão **Competência** ou **Mensal**; compras no cartão agrupadas por fatura (expansível, com pagamento parcial/total); ordem manual arrastando as linhas |
| `/filters` | Filtros salvos: criar, editar, aplicar em Lançamentos e definir o padrão |
| `/cards` | Cartões de crédito; ao selecionar um cartão, as faturas dele (filtro por ano e mês) |
| `/calendar` | Visão calendário das movimentações |
| `/reports` | Gráficos e relatórios financeiros |
| `/export` | Exportação de dados (CSV/XLSX) |
| `/competency-config` | Configuração de datas de competência |
| `/recurring-installments` | Despesas fixas e parcelamentos |
| `/settings` | Configurações da conta |
| `/accounts` | Contas bancárias |
| `/categories` | Categorias (tipologias) |
| `/workspaces` | Áreas de trabalho e pessoas (responsáveis, convites) |
| `/join/:id` | Link de convite para uma área compartilhada |
| `/settings` → aba Google Sheets | Link da planilha e recarregar dados |

---

## Estrutura do projeto

```
financeiro-domestico/
├── client/src/
│   ├── data/            # Camada de dados (roda no navegador)
│   │   ├── google.ts      # Login Google (GIS) e fetch autenticado
│   │   ├── sheetStore.ts  # Leitura/gravação das abas da planilha
│   │   ├── schema.ts      # Tabelas (abas), colunas e tipos
│   │   ├── db.ts          # Operações de dados (competências, lançamentos…)
│   │   ├── session.ts     # Liga o login à planilha da área ativa e ao usuário
│   │   ├── workspaces.ts  # Áreas compartilhadas: criar, listar, compartilhar no Drive
│   │   └── router.ts      # Router tRPC executado localmente
│   ├── pages/           # Páginas da aplicação
│   ├── components/      # Componentes reutilizáveis
│   └── lib/             # Utilitários e cliente tRPC
├── shared/              # Constantes compartilhadas
├── Dockerfile           # Build estático + nginx
├── Dockerfile.dev       # Servidor de desenvolvimento (Vite)
├── compose.yaml         # Podman/Docker Compose (desenvolvimento)
└── .env.local           # Variáveis locais (não versionado)
```

### Limitações

- Em áreas compartilhadas o app relê a planilha antes de cada gravação (e a cada ~20 s nas consultas), mas duas gravações exatamente simultâneas ainda podem se sobrepor — a última prevalece. Use **Recarregar dados** se algo parecer desatualizado.
- Para entrar em uma área criada por outra pessoa, o site precisa ter `VITE_GOOGLE_API_KEY` e `VITE_GOOGLE_APP_ID` configurados (Google Picker).
- Remover alguém da área retira a permissão da planilha no Drive; os lançamentos antigos continuam mostrando o nome da pessoa.
- Se o app estiver aberto em duas abas ao mesmo tempo, a última gravação prevalece; use **Recarregar dados** para sincronizar.
- O token do Google dura cerca de 1 hora; depois disso o app pede um novo automaticamente (pode ser preciso entrar de novo).
