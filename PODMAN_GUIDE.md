# Executar Financeiro Doméstico no Podman

## ⚠️ Pré-requisitos

### Instalar Podman no Windows

#### Opção 1: Via Chocolatey (Recomendado)
```powershell
# Abrir PowerShell como Administrador
choco install podman
```

#### Opção 2: Instalador direto
1. Baixar em: https://podman.io/docs/installation/windows
2. Executar instalador
3. Seguir assistente

#### Opção 3: Winget
```powershell
winget install RedHat.Podman
```

### Verificar Instalação
```powershell
podman version
```

## 🚀 Iniciar Aplicação

### Passo 1: Inicializar Máquina Virtual Podman

Se primeira vez:
```powershell
# Criar máquina com recursos apropriados
podman machine init --cpus=4 --memory=4096
```

Iniciar máquina:
```powershell
podman machine start
```

Verificar status:
```powershell
podman machine list
```

### Passo 2: Navegar até o Projeto
```powershell
cd "e:\Codigos\projetos\financeiro-domestico"
```

### Passo 3: Build da Imagem Docker

```powershell
podman build -t financeiro-domestico:latest .
```

**Tempo estimado**: 3-5 minutos na primeira vez (cache nas próximas)

### Passo 4: Iniciar Containers

#### Opção A: Com podman-compose (Recomendado)

Instalar podman-compose se não tiver:
```powershell
pip install podman-compose
```

Iniciar:
```powershell
podman-compose up -d
```

Ver logs:
```powershell
podman-compose logs -f app
```

Parar:
```powershell
podman-compose down
```

#### Opção B: Manual com Podman

Iniciar MySQL:
```powershell
podman run -d `
  --name financeiro-db `
  -e MYSQL_ROOT_PASSWORD=root_password `
  -e MYSQL_DATABASE=financeiro `
  -e MYSQL_USER=fiscaluser `
  -e MYSQL_PASSWORD=fiscal123 `
  -p 3306:3306 `
  -v financeiro_mysql_data:/var/lib/mysql `
  mysql:8
```

Aguardar MySQL ficar pronto (~10s):
```powershell
Start-Sleep -Seconds 10

# Ou verificar:
podman exec financeiro-db mysqladmin ping -u root -proot_password
```

Iniciar Aplicação:
```powershell
podman run -d `
  --name financeiro-app `
  --network host `
  -e NODE_ENV=production `
  -e DATABASE_URL=mysql://fiscaluser:fiscal123@localhost:3306/financeiro `
  -p 3000:3000 `
  financeiro-domestico:latest
```

## 🌐 Acessar Aplicação

- **URL**: http://localhost:3000
- **Banco**: localhost:3306
- **Usuário**: fiscaluser
- **Senha**: fiscal123

## 📊 Comandos Úteis

```powershell
# Ver containers rodando
podman ps

# Ver todos os containers (inclusive parados)
podman ps -a

# Ver logs em tempo real
podman logs -f financeiro-app
podman logs -f financeiro-db

# Entrar em um container
podman exec -it financeiro-app sh
podman exec -it financeiro-db bash

# Parar containers
podman stop financeiro-app financeiro-db

# Remover containers
podman rm financeiro-app financeiro-db

# Ver imagens
podman images

# Remover imagem
podman rmi financeiro-domestico:latest

# Limpar volumes
podman volume ls
podman volume rm financeiro_mysql_data

# Limpar tudo (containers, volumes, imagens não utilizadas)
podman system prune -a --volumes
```

## 🆘 Troubleshooting

### Erro: "Cannot connect to Podman socket"

Causas e soluções:
```powershell
# 1. Máquina não iniciada
podman machine start

# 2. Conexão SSH corrompida - resetar
podman machine rm podman-machine-default
podman machine init
podman machine start

# 3. Verificar status da máquina
podman machine list
podman system info

# 4. Ver conexões disponíveis
podman system connection list
```

### Erro: "Cannot get image size"

Causa: Daemon caiu durante build.

Solução:
```powershell
# Parar máquina
podman machine stop

# Aguardar 10 segundos
Start-Sleep -Seconds 10

# Reiniciar
podman machine start

# Retry build
podman build -t financeiro-domestico:latest .
```

### Aplicação conecta no MySQL

```powershell
# Verificar logs
podman logs financeiro-app
podman logs financeiro-db

# Testar conectividade MySQL
podman exec financeiro-db mysqladmin ping -u root -proot_password

# Verificar se está pronta
podman exec financeiro-db mysql -u root -proot_password financeiro -e "SELECT 1"

# Reiniciar aplicação
podman restart financeiro-app
```

### Porta 3000/3306 Já em Uso

```powershell
# Encontrar processo usando a porta
netstat -ano | Select-String "3000"

# Ou usar PowerShell:
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
   Get-Process -ErrorAction SilentlyContinue | Stop-Process -Force

# Ou usar porta diferente
podman run -d -p 3001:3000 ...
# Acessar em http://localhost:3001
```

### Sem Espaço em Disco

```powershell
# Limpar imagens não utilizadas
podman image prune -a

# Limpar volumes não utilizados
podman volume prune

# Ver uso de espaço
podman system df
```

## 📝 Variáveis de Ambiente

Customizar variáveis ao iniciar:

```powershell
podman run -d `
  -e NODE_ENV=production `
  -e DATABASE_URL=mysql://user:pass@host:3306/db `
  -e PORT=3000 `
  -e LOG_LEVEL=debug `
  financeiro-domestico:latest
```

## 🔄 Workflow Desenvolvimento

Para desenvolvimento com hot-reload:

```powershell
# Sem containers - instalar deps localmente
pnpm install

# Iniciar banco de dados em container
podman run -d `
  --name db-dev `
  -p 3306:3306 `
  -e MYSQL_ROOT_PASSWORD=root `
  -e MYSQL_DATABASE=financeiro `
  mysql:8

# Executar aplicação localmente
pnpm dev

# Quando terminar desenvolvimento
podman stop db-dev
podman rm db-dev
```

## 📚 Documentação Podman

- Oficial: https://docs.podman.io/
- Podman Compose: https://github.com/containers/podman-compose
- Comparação Docker vs Podman: https://podman.io/

---

**Última atualização**: 26/04/2026
**Status**: Testado com Podman 5.8+
