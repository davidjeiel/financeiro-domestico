# Controle Financeiro Doméstico

**Demo:** https://davidjeiel.github.io/financeiro-domestico/

Aplicação web para controle de finanças pessoais. Organiza receitas, despesas e cartões de crédito por competências mensais, com relatórios, calendário e exportação de dados.

**Não há banco de dados nem servidor.** O usuário entra com a conta Google direto no navegador e os dados ficam em uma planilha **Financeiro Doméstico** no Google Drive dele.

---

## Índice

- [Como funciona](#como-funciona)
- [Configurando o login Google](#configurando-o-login-google)
- [Áreas de trabalho compartilhadas](#áreas-de-trabalho-compartilhadas)
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
6. *(Para áreas compartilhadas)* Ative também a **Google Picker API**, crie uma **Chave de API** em **Credenciais** (restrinja às mesmas origens e às APIs Picker/Drive) e anote o **Número do projeto** (Painel do projeto). Eles vão nas variáveis `VITE_GOOGLE_API_KEY` e `VITE_GOOGLE_APP_ID`.

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

**Responsável pelo pagamento**

Todo lançamento (receita, despesa ou cartão) tem o campo **Responsável pelo pagamento** (em receitas, **Quem recebe**). O padrão é quem está lançando. As opções são as pessoas da área:

- participantes que já entraram;
- convidados que ainda não abriram a área;
- **pessoas sem acesso** (ex.: um filho, a diarista), que só servem para indicar responsabilidade — funcionam também na área pessoal.

Na lista de lançamentos há a coluna **Responsável** (com filtro e ordenação) e, acima dela, o total que cada pessoa paga/recebe no período; clicar em uma pessoa filtra os lançamentos dela. A edição individual, a edição em lote e a exportação (CSV/XLSX) também incluem o responsável.

**Colunas novas na planilha**: `Lancamentos.responsibleUserId` e `Lancamentos.createdBy`; `Usuarios.status` e `Usuarios.color`. Planilhas existentes são atualizadas automaticamente no primeiro acesso.

**Despesa paga com receita**

Uma despesa (ou compra no cartão) pode ser vinculada a uma ou mais receitas — "a conta de luz sai do salário de março" —, informando quanto sai de cada uma. O vínculo é feito no cadastro (lançamentos simples) ou na edição da despesa, em **Pago com a receita**.

- O app não deixa vincular mais que o valor da despesa nem mais que o disponível da receita.
- Na edição de uma receita aparecem as despesas pagas com ela, o **comprometido** e o que **sobra**.
- Na lista de lançamentos, a coluna **Receita** mostra o que sobra de cada receita e se cada despesa está coberta (com filtro "com/sem vínculo"); o card de saldo mostra as **receitas livres**.
- Excluir um lançamento, ou trocar uma despesa para receita (e vice-versa), apaga os vínculos dele.

Os vínculos ficam na aba `Vinculos` (`expenseId`, `incomeId`, `amount`).

---

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
| `/lancamentos` | Lista e cadastro de movimentações — visão **Competência** (cartão no mês da fatura) ou **Mensal** (pela data do lançamento); a última escolha fica salva |
| `/cards` | Gerenciamento de cartões de crédito |
| `/invoices` | Faturas dos cartões por competência |
| `/calendar` | Visão calendário das movimentações |
| `/reports` | Gráficos e relatórios financeiros |
| `/export` | Exportação de dados (CSV/XLSX) |
| `/filters` | Filtros salvos para movimentações |
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
