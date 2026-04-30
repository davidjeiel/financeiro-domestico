# Execução com Docker/Podman - Guia Rápido

## ✅ Arquivos Criados

1. **Dockerfile** - Imagem Docker multi-stage otimizada de ~200MB
2. **docker-compose.yml** - Orquestração com MySQL + Aplicação
3. **run-docker.ps1** - Script PowerShell para Windows
4. **DOCKER_SETUP.md** - Guia completo de configuração
5. **.dockerignore** - Otimização do build

## 🚀 Iniciar em 30 segundos (Windows)

### Com Docker Desktop aberto:

```powershell
cd "e:\Codigos\projetos\financeiro-domestico"
.\run-docker.ps1 up
```

Pronto! Acesse em: **http://localhost:3000**

### Alternativa: Docker Compose direto

```powershell
docker-compose up -d
```

## 📋 Comandos Principais

```powershell
# Iniciar tudo
.\run-docker.ps1 up

# Ver logs em tempo real
.\run-docker.ps1 logs

# Parar tudo
.\run-docker.ps1 down

# Reiniciar
.\run-docker.ps1 restart

# Limpar tudo (remove containers, volumes e imagens)
.\run-docker.ps1 clean

# Rebuild da imagem
.\run-docker.ps1 build
```

## ⚠️ Pré-requisitos

**Opção 1: Docker** (Recomendado)
- Baixar: https://www.docker.com/products/docker-desktop
- Instalar e iniciar Docker Desktop
- Verificar: `docker --version`

**Opção 2: Podman**
- Instalar via Chocolatey: `choco install podman`
- Iniciar máquina: `podman machine init && podman machine start`

## 🔍 Debug

```powershell
# Ver containers rodando
docker ps

# Ver logs da aplicação
docker logs financeiro-app

# Ver logs do MySQL
docker logs financeiro-db

# Acessar container da app
docker exec -it financeiro-app sh

# Acessar MySQL
docker exec -it financeiro-db mysql -u root -proot_password financeiro
```

## 🗄️ Banco de Dados

- **Host**: localhost:3306
- **Usuário**: fiscaluser
- **Senha**: fiscal123
- **Database**: financeiro

## 🌐 Acessar Aplicação

- **URL**: http://localhost:3000
- **Portas expostas**:
  - 3000 → Aplicação
  - 3306 → MySQL

## 📝 Estrutura da Build

```
Build Stage (builder):
  ├─ Node 20 Alpine
  ├─ pnpm install
  ├─ Copy patches (fixes)
  ├─ Copy source code
  └─ Run build (Vite + esbuild)

Runtime Stage:
  ├─ Node 20 Alpine (minimal)
  ├─ pnpm install --production
  ├─ Copy dist/
  ├─ Expose port 3000
  └─ Health check
```

**Tamanho da imagem**: ~600-700MB (com dependências Python/build tools)

## 🆘 Troubleshooting

### Docker daemon não responds
```powershell
# Abrir Docker Desktop manualmente
# Verificar: docker ps
```

### Aplicação não conecta ao MySQL
```powershell
# Verificar logs
docker logs financeiro-app
docker logs financeiro-db

# Aguardar MySQL ficar pronto (~10s)
```

### Porta já em uso
```powershell
# Editar docker-compose.yml
# Mudar "3000:3000" → "3001:3000"
# Acessar em http://localhost:3001
```

## 📚 Documentação Completa

Ver [DOCKER_SETUP.md](DOCKER_SETUP.md) para instruções detalhadas.

---

**Criado automaticamente com Dockerfile multi-stage otimizado** ✨
