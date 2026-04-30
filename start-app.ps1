# Script para iniciar Docker/Podman e executar o projeto
# Requer privilégios de administrador

param(
    [switch]$Admin
)

# Cores para output
$Colors = @{
    Green  = "`e[32m"
    Red    = "`e[31m"
    Yellow = "`e[33m"
    Cyan   = "`e[36m"
    Reset  = "`e[0m"
}

function Write-Status {
    param([string]$Message, [string]$Type = 'info')
    
    $Color = switch($Type) {
        'success' { $Colors.Green }
        'error'   { $Colors.Red }
        'warning' { $Colors.Yellow }
        'info'    { $Colors.Cyan }
        default   { $Colors.Cyan }
    }
    
    $Symbol = switch($Type) {
        'success' { '✓' }
        'error'   { '✗' }
        'warning' { '⚠' }
        default   { '→' }
    }
    
    Write-Host "$Color$Symbol $Message$($Colors.Reset)"
}

# Requisição de admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    if ($Admin) {
        Write-Status "Falha ao obter privilégios de administrador!" "error"
        exit 1
    }
    Write-Status "Solicitando privilégios de administrador..." "warning"
    $Arguments = "-NoExit -File `"$PSCommandPath`" -Admin"
    Start-Process powershell -Verb RunAs -ArgumentList $Arguments
    exit 0
}

# Verificar Docker
function Test-DockerRunning {
    try {
        $null = docker ps 2>$null
        return $true
    } catch {
        return $false
    }
}

# Verificar Podman
function Test-PodmanRunning {
    try {
        $null = podman ps 2>$null
        return $true
    } catch {
        return $false
    }
}

# Principais
Write-Host ""
Write-Host "$($Colors.Cyan)═══════════════════════════════════════════════════════════$($Colors.Reset)"
Write-Host "$($Colors.Cyan)        Inicializador - Financeiro Doméstico$($Colors.Reset)"
Write-Host "$($Colors.Cyan)═══════════════════════════════════════════════════════════$($Colors.Reset)"
Write-Host ""

# Verificar Docker
Write-Status "Verificando Docker..." "info"
if (Test-DockerRunning) {
    Write-Status "Docker já está rodando!" "success"
    $Engine = 'docker'
} else {
    Write-Status "Docker não está rodando. Tentando iniciar..." "warning"
    
    $DockerApp = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $DockerApp) {
        Write-Status "Iniciando Docker Desktop..." "warning"
        Start-Process $DockerApp -WindowStyle Normal
        Write-Status "Docker Desktop iniciado. Aguardando daemon ficar pronto..." "warning"
        
        # Aguardar até 60 segundos
        $MaxRetries = 30
        $Retry = 0
        while ($Retry -lt $MaxRetries) {
            Start-Sleep -Seconds 2
            if (Test-DockerRunning) {
                Write-Status "Docker daemon pronto!" "success"
                $Engine = 'docker'
                break
            }
            $Retry++
            Write-Host -NoNewline "."
        }
        
        if ($Engine -ne 'docker') {
            Write-Status "Docker não respondeu após 60 segundos" "error"
            Write-Status "Por favor, verifique Docker Desktop manualmente" "warning"
            exit 1
        }
    } else {
        Write-Status "Docker Desktop não encontrado em $DockerApp" "error"
        Write-Status "Procurando alternativas..." "warning"
        
        if (Test-PodmanRunning) {
            Write-Status "Podman encontrado e rodando!" "success"
            $Engine = 'podman'
        } else {
            Write-Status "Nenhum container engine encontrado!" "error"
            Write-Host ""
            Write-Host "Opções:"
            Write-Host "  1. Docker Desktop: https://www.docker.com/products/docker-desktop"
            Write-Host "  2. Podman: https://podman.io/docs/installation"
            Write-Host ""
            exit 1
        }
    }
}

Write-Host ""
Write-Status "Engine: $Engine" "success"
Write-Host ""

# Mudar para diretório do projeto
$ProjectPath = Split-Path -Parent $PSCommandPath
Set-Location $ProjectPath
Write-Status "Diretório: $ProjectPath" "info"

# Verificar docker-compose
$ComposeCmd = if ($Engine -eq 'docker') { 'docker-compose' } else { 'podman-compose' }
Write-Status "Verificando $ComposeCmd..." "info"

try {
    & $ComposeCmd --version >$null 2>&1
    Write-Status "$ComposeCmd encontrado" "success"
    $UseCompose = $true
} catch {
    Write-Status "$ComposeCmd não encontrado. Usando $Engine direto" "warning"
    $UseCompose = $false
}

Write-Host ""

# Executar
if ($UseCompose) {
    Write-Status "Iniciando containers com $ComposeCmd..." "warning"
    & $ComposeCmd up -d
} else {
    Write-Status "Iniciando MySQL..." "warning"
    & $Engine run -d `
        --name financeiro-db `
        -e MYSQL_ROOT_PASSWORD=root_password `
        -e MYSQL_DATABASE=financeiro `
        -e MYSQL_USER=fiscaluser `
        -e MYSQL_PASSWORD=fiscal123 `
        -p 3306:3306 `
        mysql:8 | Out-Null
    
    Write-Status "Aguardando MySQL ficar pronto..." "warning"
    Start-Sleep -Seconds 10
    
    Write-Status "Iniciando Aplicação..." "warning"
    & $Engine run -d `
        --name financeiro-app `
        --link financeiro-db:mysql `
        -e NODE_ENV=production `
        -e DATABASE_URL=mysql://fiscaluser:fiscal123@mysql:3306/financeiro `
        -p 3000:3000 `
        financeiro-domestico:latest | Out-Null
}

# Aguardar um pouco e mostrar status
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "$($Colors.Green)═══════════════════════════════════════════════════════════$($Colors.Reset)"
Write-Host "$($Colors.Green)✓ APLICAÇÃO INICIADA COM SUCESSO!$($Colors.Reset)"
Write-Host "$($Colors.Green)═══════════════════════════════════════════════════════════$($Colors.Reset)"
Write-Host ""

# Status dos containers
Write-Status "Status dos Containers:" "info"
& $Engine ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host ""
Write-Status "Acesso:" "success"
Write-Host "  🌐 Aplicação: http://localhost:3000"
Write-Host "  🗄️  Banco:     localhost:3306"
Write-Host ""

Write-Status "Credenciais:" "info"
Write-Host "  Usuário: fiscaluser"
Write-Host "  Senha:   fiscal123"
Write-Host ""

Write-Status "Comandos úteis:" "info"
Write-Host "  Ver logs:    $Engine logs -f financeiro-app"
Write-Host "  Parar:       $engine stop financeiro-app financeiro-db"
Write-Host "  Remover:     $engine rm -f financeiro-app financeiro-db"
Write-Host ""

Write-Status "Pressione Ctrl+C para sair" "warning"
Write-Host ""

# Ver logs em tempo real
& $Engine logs -f financeiro-app
