# Controle Financeiro Doméstico

Aplicação web para controle de finanças pessoais. Organiza receitas, despesas e cartões de crédito por competências mensais, com relatórios, calendário e exportação de dados.

---

## Índice

- [Requisitos](#requisitos)
- [Primeiro uso com Podman](#primeiro-uso-com-podman)
- [Configuração do ambiente](#configuração-do-ambiente)
- [Modos de login](#modos-de-login)
- [Desenvolvimento sem containers](#desenvolvimento-sem-containers)
- [Scripts disponíveis](#scripts-disponíveis)
- [Páginas da aplicação](#páginas-da-aplicação)
- [Banco de dados e migrações](#banco-de-dados-e-migrações)

---

## Requisitos

| Ferramenta | Versão mínima | Para que serve |
|---|---|---|
| [Podman](https://podman.io/) | 4.x | Rodar os containers localmente |
| [Podman Desktop](https://podman-desktop.io/) *(opcional)* | qualquer | Interface gráfica para gerenciar containers |
| [Node.js](https://nodejs.org/) | 22.x | Necessário apenas para desenvolvimento fora de container |
| [pnpm](https://pnpm.io/) | 10.4.1 | Gerenciador de pacotes (apenas dev fora de container) |

> Para rodar via containers (recomendado), somente o Podman é necessário — Node e pnpm não precisam estar instalados na máquina.

---

## Primeiro uso com Podman

### 1. Inicie a máquina virtual do Podman (Windows/macOS)

```sh
podman machine start
```

### 2. Copie o arquivo de configuração

```sh
cp .env.local.example .env.local
```

> O arquivo `.env.local` já vem preenchido com valores para desenvolvimento local. Edite conforme necessário (veja [Configuração do ambiente](#configuração-do-ambiente)).

### 3. Suba os containers

```sh
podman compose up --build
```

O comando irá:
1. Baixar a imagem do MySQL 8
2. Construir a imagem da aplicação
3. Aguardar o banco estar saudável
4. Aplicar as migrações automaticamente
5. Iniciar o servidor em modo de desenvolvimento

### 4. Acesse a aplicação

Abra [http://localhost:3000](http://localhost:3000) no navegador.

---

## Configuração do ambiente

Crie o arquivo `.env.local` na raiz do projeto. Abaixo estão todas as variáveis disponíveis:

```dotenv
# ─── Banco de dados ───────────────────────────────────────────────────────────
# Quando rodando via containers, o hostname deve ser "db" (nome do serviço).
# Quando rodando localmente sem container, use "localhost".
DATABASE_URL=mysql://fiscaluser:fiscal123@localhost:3306/financeiro

# ─── Autenticação ─────────────────────────────────────────────────────────────
# Segredo usado para assinar os tokens JWT de sessão.
# Troque por um valor longo e aleatório em produção.
JWT_SECRET=financeiro-jwt-secret-local-dev

# ─── Login local (somente para desenvolvimento) ───────────────────────────────
# Habilita o formulário de senha simples no lugar do OAuth.
# Deixe "true" para uso local/Podman; remova ou coloque "false" em produção.
LOCAL_LOGIN_ENABLED=true
LOCAL_LOGIN_PASSWORD=admin123

# ─── Identificação da aplicação ───────────────────────────────────────────────
VITE_APP_ID=financeiro-local
# OpenID do usuário criado automaticamente pelo login local.
OWNER_OPEN_ID=local:admin

# ─── OAuth externo (Google, etc.) ─────────────────────────────────────────────
# Deixe em branco para usar o login local.
# Preencha com a URL do servidor OAuth para habilitar "Entrar com Google".
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
```

### Variáveis obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão MySQL |
| `JWT_SECRET` | Segredo JWT — use uma string longa e aleatória |

### Variáveis opcionais / ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `LOCAL_LOGIN_ENABLED` | `false` | Habilita login por senha simples |
| `LOCAL_LOGIN_PASSWORD` | — | Senha para o login local |
| `OWNER_OPEN_ID` | — | OpenID do usuário administrador local |
| `VITE_APP_ID` | — | Identificador da aplicação |
| `OAUTH_SERVER_URL` | — | URL do servidor OAuth (backend) |
| `VITE_OAUTH_PORTAL_URL` | — | URL do portal de login OAuth (frontend) |

---

## Modos de login

A aplicação detecta automaticamente o ambiente pela presença de `VITE_OAUTH_PORTAL_URL`:

### Ambiente local (Podman / `pnpm dev`)

Quando `VITE_OAUTH_PORTAL_URL` está vazio, a tela de login exibe um formulário de senha simples:

```
┌─────────────────────────────────┐
│      Controle Financeiro        │
│  Ambiente local — senha de teste│
│                                 │
│  Senha: [__________________]    │
│         [      Entrar      ]    │
└─────────────────────────────────┘
```

- **Senha padrão:** `admin123` (configurada em `LOCAL_LOGIN_PASSWORD`)
- O usuário criado tem nome **Admin Local** e openId definido em `OWNER_OPEN_ID`
- Para alterar a senha, edite `LOCAL_LOGIN_PASSWORD` no `.env.local` e reinicie o container

### Ambiente de produção / nuvem

Quando `VITE_OAUTH_PORTAL_URL` está configurado, a tela exibe o botão **Entrar com Google** que redireciona para o fluxo OAuth.

---

## Desenvolvimento sem containers

Para rodar a aplicação diretamente na máquina (sem Podman):

### 1. Suba apenas o banco de dados

```sh
# Com Podman:
podman run -d \
  --name financeiro-db \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=financeiro \
  -e MYSQL_USER=fiscaluser \
  -e MYSQL_PASSWORD=fiscal123 \
  mysql:8

# Ou com Docker:
docker run -d \
  --name financeiro-db \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=financeiro \
  -e MYSQL_USER=fiscaluser \
  -e MYSQL_PASSWORD=fiscal123 \
  mysql:8
```

### 2. Configure o `.env.local`

Certifique-se de que `DATABASE_URL` usa `localhost` (não `db`):

```dotenv
DATABASE_URL=mysql://fiscaluser:fiscal123@localhost:3306/financeiro
```

### 3. Instale as dependências

```sh
pnpm install
```

### 4. Aplique as migrações

```sh
pnpm db:push
```

### 5. Inicie o servidor de desenvolvimento

```sh
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## Scripts disponíveis

| Script | Descrição |
|---|---|
| `pnpm dev` | Inicia servidor de desenvolvimento com hot-reload (Vite + tsx) |
| `pnpm build` | Compila frontend (Vite) e backend (esbuild) para `dist/` |
| `pnpm start` | Inicia o servidor compilado em modo produção |
| `pnpm db:push` | Gera e aplica migrações do banco de dados |
| `pnpm test` | Executa a suíte de testes (Vitest) |
| `pnpm check` | Verifica tipos TypeScript sem compilar |
| `pnpm format` | Formata o código com Prettier |

### Comandos Podman

```sh
# Subir tudo (com rebuild da imagem)
podman compose up --build

# Subir sem rebuild
podman compose up

# Parar os containers
podman compose down

# Parar e remover os dados do banco
podman compose down -v

# Ver logs em tempo real
podman compose logs -f app

# Acessar o shell do container da aplicação
podman exec -it financeiro-domestico-app-1 sh
```

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

---

## Banco de dados e migrações

O banco de dados é **MySQL 8**. O schema é gerenciado pelo [Drizzle ORM](https://orm.drizzle.team/).

### Migrações automáticas (containers)

Ao subir com `podman compose up`, as migrações são aplicadas automaticamente antes do servidor iniciar via `docker-entrypoint.sh`.

### Migrações manuais (desenvolvimento local)

```sh
# Gera o arquivo SQL da migração e aplica no banco
pnpm db:push
```

### Localização dos arquivos

```
drizzle/
├── schema.ts          # Definição das tabelas (fonte da verdade)
├── relations.ts       # Relações entre tabelas
├── 0000_*.sql         # Arquivo de migração gerado
├── 0001_*.sql
├── ...
└── meta/              # Snapshots internos do Drizzle
```

> **Atenção:** nunca edite os arquivos `.sql` ou o diretório `meta/` manualmente. Alterações no schema devem ser feitas em `drizzle/schema.ts` seguidas de `pnpm db:push`.

---

## Estrutura do projeto

```
financeiro-domestico/
├── client/src/          # Frontend React + Vite
│   ├── pages/           # Páginas da aplicação
│   ├── components/      # Componentes reutilizáveis
│   └── lib/             # Utilitários e configuração tRPC
├── server/              # Backend Express
│   ├── _core/           # Infraestrutura (auth, env, rotas base)
│   ├── db.ts            # Funções de acesso ao banco
│   └── routers.ts       # Roteador tRPC principal
├── drizzle/             # Schema e migrações do banco
├── shared/              # Tipos e constantes compartilhados
├── Dockerfile           # Build de produção (multi-stage)
├── Dockerfile.dev       # Build de desenvolvimento
├── compose.yaml         # Orquestração Podman/Docker Compose
├── docker-entrypoint.sh # Script de inicialização do container
└── .env.local           # Variáveis de ambiente locais (não versionado)
```
