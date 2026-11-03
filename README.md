# Controle Financeiro Doméstico

**Demo:** https://davidjeiel.github.io/financeiro-domestico/

Aplicação web para controle de finanças pessoais. Organiza receitas, despesas e cartões de crédito por competências mensais, com relatórios, calendário e exportação de dados.

**Não há banco de dados nem servidor.** O usuário entra com a conta Google direto no navegador e os dados ficam em uma planilha **Financeiro Doméstico** no Google Drive dele.

---

## Índice

- [Como funciona](#como-funciona)
- [Configurando o login Google](#configurando-o-login-google)
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
2. Em **Settings → Secrets and variables → Actions → Variables**, crie a variável `VITE_GOOGLE_CLIENT_ID` com o Client ID.
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
| `/lancamentos` | Lista e cadastro de movimentações |
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
| `/workspaces` | Workspaces |
| `/shared-accounts` | Contas compartilhadas |
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
│   │   ├── session.ts     # Liga o login à planilha e ao usuário
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

- Os dados de cada usuário ficam na planilha dele. **Workspaces, convites e contas compartilhadas** continuam funcionando dentro da planilha do usuário, mas um convite não chega a outra conta Google (não há servidor central para isso).
- Se o app estiver aberto em duas abas ao mesmo tempo, a última gravação prevalece; use **Recarregar dados** para sincronizar.
- O token do Google dura cerca de 1 hora; depois disso o app pede um novo automaticamente (pode ser preciso entrar de novo).
