# ✅ Guia de Execução - Corrigido

## 🐛 Problema Identificado

**Erro anterior:**
```
Error: ENOENT: no such file or directory, open 'E:\Codigos\projetos\client\index.html'
```

**Causa:** O path resolver estava usando `import.meta.dirname` que em produção (compilado em `dist/`) não resolvia corretamente os caminhos relativos.

**Solução:** Usar `process.cwd()` para referências absolutas.

✅ **Já corrigido em** [server/_core/vite.ts](server/_core/vite.ts)

---

## 🚀 Executar Localmente (Recomendado)

### Pré-requisitos
- Node.js 20+
- npm ou pnpm
- MySQL 8+ rodando (local ou em container)

### Passos

#### 1. Instalar dependências
```powershell
cd "e:\Codigos\projetos\financeiro-domestico"
npm install --legacy-peer-deps
```

#### 2. Variáveis de ambiente
Criar `.env.local`:
```
NODE_ENV=production
DATABASE_URL=mysql://user:password@localhost:3306/financeiro
PORT=3000
```

#### 3. Build
```powershell
npm run build
```

Output esperado:
```
✓ built in 11.60s
  dist\index.js  50.7kb
⚡ Done in 160ms
```

#### 4. Executar em Produção
```powershell
node dist/index.js
```

Output esperado:
```
[OAuth] Initialized with baseURL: 
Server running on http://localhost:3000/
```

✅ Acessar em **http://localhost:3000**

---

## 🐳 Com Docker/Podman

### Build da imagem
```powershell
docker build -t financeiro-domestico:latest .
# ou com Podman:
podman build -t financeiro-domestico:latest .
```

### Executar com docker-compose
```powershell
docker-compose up -d
# ou
podman-compose up -d
```

Ver logs:
```powershell
docker-compose logs -f app
```

### Ou manual

#### 1. Iniciar MySQL
```powershell
docker run -d `
  --name financeiro-db `
  -e MYSQL_ROOT_PASSWORD=root_password `
  -e MYSQL_DATABASE=financeiro `
  -e MYSQL_USER=fiscaluser `
  -e MYSQL_PASSWORD=fiscal123 `
  -p 3306:3306 `
  -v financeiro_mysql_data:/var/lib/mysql `
  mysql:8
```

Aguardar 10 segundos:
```powershell
Start-Sleep -Seconds 10
```

#### 2. Iniciar App
```powershell
docker run -d `
  --name financeiro-app `
  -e NODE_ENV=production `
  -e DATABASE_URL=mysql://fiscaluser:fiscal123@localhost:3306/financeiro `
  -p 3000:3000 `
  financeiro-domestico:latest
```

Ver logs:
```powershell
docker logs -f financeiro-app
```

---

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|------------|
| `NODE_ENV` | `production` ou `development` | Sim |
| `DATABASE_URL` | String de conexão MySQL | Sim |
| `PORT` | Porta (padrão: 3000) | Não |
| `OAUTH_SERVER_URL` | URL do servidor OAuth | Não |

---

## ✅ Verificação de Saúde

### Localmente
```powershell
Invoke-WebRequest -Uri "http://localhost:3000"
# Output: StatusCode 200
```

### No Docker
```powershell
docker logs financeiro-app
# Deve mostrar: "Server running on http://localhost:3000/"
```

---

## 📊 Estrutura do Build

```
pnpm build executará:
├─ vite build          → Compila React/client → dist/public/
└─ esbuild              → Compila server/index.ts → dist/index.js

Resultado:
dist/
├─ index.js             ← Servidor Node
└─ public/
   ├─ index.html        ← SPA
   ├─ assets/           ← CSS/JS compilados
   └─ __manus__/        ← Arquivos estáticos
```

---

## 🆘 Se Ainda Tiver Problemas

### Erro: "No such file or directory"
```powershell
# Verificar se dist/ foi criado
Get-ChildItem dist/
# Deve conter: index.js e public/

# Se não tiver:
npm run build
```

### Erro: "ENOENT"
```powershell
# Verificar arquivos necessários
Get-ChildItem dist/public/index.html  # Deve existir
Get-ChildItem dist/index.js           # Deve existir

# Se não existem, refazer build
npm run build
```

### Porta em uso
```powershell
# Findark processo na porta 3000
netstat -ano | Select-String "3000"

# Ou usar porta diferente
$env:PORT=3001
node dist/index.js
```

### MySQL não conecta
```powershell
# Verificar string de conexão em .env.local
# Formato: mysql://user:pass@host:port/database

# Testar conexão
# Use um cliente MySQL ou:
docker exec financeiro-db mysql -u root -proot_password -e "SELECT 1"
```

---

## 📝 Troubleshooting Checklist

- [ ] Node.js 20+ instalado: `node --version`
- [ ] Dependências instaladas: `npm install`
- [ ] Build bem-sucedido: `npm run build`
- [ ] dist/index.js existe: `ls dist/`
- [ ] dist/public/index.html existe: `ls dist/public/`
- [ ] DATABASE_URL configurado em .env
- [ ] MySQL rodando e acessível
- [ ] Porta 3000 disponível (ou mudar PORT)
- [ ] NODE_ENV=production

---

## 🎯 Próximas Ações

1. **Teste Local** (mais rápido para debug)
   ```powershell
   npm run build
   node dist/index.js
   ```

2. **Docker** (mais isolado)
   ```powershell
   docker-compose up
   ```

3. **Produção** (com reverse proxy, SSL, etc)
   - Use a imagem Docker em um serviço
   - Configure nginx/Apache como proxy reverso
   - Configure SSL/TLS

---

**Status**: ✅ Corrigido em 26/04/2026
**Arquivo Alterado**: [server/_core/vite.ts](server/_core/vite.ts)
