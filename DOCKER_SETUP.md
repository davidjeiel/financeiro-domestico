# Guia de Execução com Docker/Podman

## Pré-requisitos

### Opção 1: Docker Desktop (Windows)
1. Baixar Docker Desktop em: https://www.docker.com/products/docker-desktop
2. Instalar e iniciar o Docker Desktop
3. Aguardar até que o daemon esteja rodando (ícone do Docker na bandeja do sistema)

### Opção 2: Podman (Windows via WSL2)
1. Instalar WSL2: https://learn.microsoft.com/en-us/windows/wsl/install
2. Instalar Podman: `choco install podman` (via Chocolatey) ou baixar em: https://podman.io/
3. Inicializar máquina: `podman machine init`
4. Inicia máquina: `podman machine start`

## Arquivos Criados

- **Dockerfile** - Imagem Docker multi-stage
- **docker-compose.yml** - Orquestração com MySQL
- **run-docker.sh** - Script de execução (Windows: usar PowerShell)

## Configuração e Execução

### Com Docker Compose (RECOMENDADO)

```powershell
# Navegar até o diretório do projeto
cd "e:\Codigos\projetos\financeiro-domestico"

# Iniciar todos os containers (MySQL + App)
docker-compose up -d

# Ver logs da aplicação
docker-compose logs -f app

# Ver logs do banco de dados
docker-compose logs -f mysql

# Parar os containers
docker-compose down

# Parar e remover dados (limpar tudo)
docker-compose down -v
```

### Build Manual com Docker

```powershell
# Navegar até o diretório do projeto
cd "e:\Codigos\projetos\financeiro-domestico"

# Build da imagem
docker build -t financeiro-domestico:latest .

# Executar MySQL
docker run -d `
  --name financeiro-db `
  -e MYSQL_ROOT_PASSWORD=root_password `
  -e MYSQL_DATABASE=financeiro `
  -e MYSQL_USER=fiscaluser `
  -e MYSQL_PASSWORD=fiscal123 `
  -p 3306:3306 `
  mysql:8

# Executar a aplicação
docker run -d `
  --name financeiro-app `
  --link financeiro-db:mysql `
  -e NODE_ENV=production `
  -e DATABASE_URL=mysql://fiscaluser:fiscal123@mysql:3306/financeiro `
  -p 3000:3000 `
  financeiro-domestico:latest
```

### Com Podman (Similar ao Docker)

```powershell
# Usar os mesmos comandos acima, substituindo 'docker' por 'podman'

# Exemplo:
podman-compose up -d
# ou
podman build -t financeiro-domestico:latest .
podman run -d ... (mesmos parâmetros)
```

## Acessar a Aplicação

- **URL**: http://localhost:3000
- **Banco de Dados**: localhost:3306
- **Usuário DB**: fiscaluser
- **Senha DB**: fiscal123

## Comandos Úteis

```powershell
# Listar containers rodando
docker ps

# Visualizar logs
docker logs financeiro-app
docker logs financeiro-db

# Entrar em um container
docker exec -it financeiro-app sh
docker exec -it financeiro-db mysql -u root -p

# Parar container específico
docker stop financeiro-app
docker stop financeiro-db

# Remover container
docker rm financeiro-app
docker rm financeiro-db

# Remover imagem
docker rmi financeiro-domestico:latest
docker rmi mysql:8

# Limpar tudo (containers e volumes não utilizados)
docker system prune -a --volumes
```

## Troubleshooting

### Docker daemon não está rodando
- **Windows with Docker Desktop**: Abrir Docker Desktop manualmente
- Verify status: `docker ps`

### Aplicação conecta no banco de dados
- Verificar: `docker logs financeiro-db`
- Verificar se MySQL está saudável: `docker exec financeiro-db mysqladmin ping -u root -proot_password`
- Reconnect: `docker-compose restart app`

### Porta 3000 já em uso
```powershell
# Usar porta diferente no docker-compose.yml
# Mudar:  "3000:3000" para "3001:3000"
# Acessar em: http://localhost:3001
```

### Porta 3306 já em uso
```powershell
# Similar a porta 3000
# Mudar: "3306:3306" para "3307:3306"
# E atualizar DATABASE_URL na aplicação
```

## Variáveis de Ambiente

```
NODE_ENV=production        # Modo de operação
DATABASE_URL=...           # Conexão MySQL (obrigatório)
PORT=3000                  # Porta da aplicação (padrão: 3000)
```

## Próximos Passos (Dev)

Para desenvolvimento local sem containers:

```powershell
# Instalar dependências
pnpm install

# Executar modo desenvolvimento
pnpm dev

# Build para produção
pnpm build

# Iniciar em produção
pnpm start
```

**Obs**: Você ainda precisará de um MySQL rodando localmente ou em outro container para dev.
