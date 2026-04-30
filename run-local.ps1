# Script para executar localmente sem containers
# Requer Node.js e npm instalados

param(
    [switch]$SkipBuild,
    [switch]$DevMode
)

# Cores
$Colors = @{
    Green  = "`e[32m"
    Red    = "`e[31m"
    Yellow = "`e[33m"
    Blue   = "`e[34m"
    Reset  = "`e[0m"
}

function Write-Status {
    param([string]$Message, [string]$Type = 'info')
    
    $Color = switch($Type) {
        'success' { $Colors.Green }
        'error'   { $Colors.Red }
        'warning' { $Colors.Yellow }
        'info'    { $Colors.Blue }
        default   { $Colors.Blue }
    }
    
    $Symbol = switch($Type) {
        'success' { '✓' }
        'error'   { '✗' }
        'warning' { '⚠' }
        default   { '→' }
    }
    
    Write-Host "$Color$Symbol $Message$($Colors.Reset)"
}

# Verificar Node.js
Write-Status "Verificando Node.js..." "info"
try {
    $nodeVersion = node --version
    Write-Status "Node.js: $nodeVersion" "success"
} catch {
    Write-Status "Node.js não encontrado. Instale em: https://nodejs.org" "error"
    exit 1
}

# Verificar npm
Write-Status "Verificando npm..." "info"
try {
    $npmVersion = npm --version
    Write-Status "npm: $npmVersion" "success"
} catch {
    Write-Status "npm não encontrado" "error"
    exit 1
}

# Instalar dependências se necessário
if (-not (Test-Path "node_modules")) {
    Write-Status "Instalando dependências..." "warning"
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Status "Erro ao instalar dependências" "error"
        exit 1
    }
}

# Build se necessário
if (-not $SkipBuild -and -not (Test-Path "dist")) {
    Write-Status "Fazendo build da aplicação..." "warning"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Status "Erro no build" "error"
        exit 1
    }
    Write-Status "Build concluído" "success"
}

# Verificar se há banco de dados
$hasDatabase = $false
$databaseUrl = $env:DATABASE_URL

if ($databaseUrl) {
    Write-Status "DATABASE_URL configurada: $databaseUrl" "info"
    $hasDatabase = $true
} else {
    Write-Status "DATABASE_URL não configurada - aplicação pode não funcionar completamente" "warning"
    Write-Status "Para testar sem banco: DATABASE_URL='sqlite::memory:'" "info"
}

# Executar aplicação
if ($DevMode) {
    Write-Status "Iniciando em modo desenvolvimento..." "warning"
    Write-Status "Pressione Ctrl+C para parar" "info"
    Write-Host ""
    npm run dev
} else {
    Write-Status "Iniciando aplicação..." "warning"
    Write-Status "Aplicação disponível em: http://localhost:3000" "success"
    Write-Host ""
    Write-Status "Pressione Ctrl+C para parar" "info"
    Write-Host ""
    
    # Definir variáveis de ambiente se não houver banco
    if (-not $hasDatabase) {
        $env:NODE_ENV = "development"
        $env:DATABASE_URL = "sqlite::memory:"
        Write-Status "Usando SQLite em memória (dados temporários)" "warning"
    }
    
    node dist/index.js
}
