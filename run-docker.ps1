# Script de build e execução com Docker/Podman no Windows
# Uso: .\run-docker.ps1

param(
    [ValidateSet('build', 'up', 'down', 'logs', 'restart', 'clean')]
    [string]$Command = 'up'
)

$ErrorActionPreference = "Stop"

# Cores para output
$Colors = @{
    Green  = "`e[32m"
    Red    = "`e[31m"
    Yellow = "`e[33m"
    Reset  = "`e[0m"
}

function Write-Status {
    param([string]$Message, [string]$Type = 'info')
    
    $Color = switch($Type) {
        'success' { $Colors.Green }
        'error'   { $Colors.Red }
        'warning' { $Colors.Yellow }
        default   { $Colors.Yellow }
    }
    
    $Symbol = switch($Type) {
        'success' { '✓' }
        'error'   { '✗' }
        'warning' { '⚠' }
        default   { '→' }
    }
    
    Write-Host "$Color$Symbol $Message$($Colors.Reset)"
}

function Test-DockerRunning {
    try {
        $null = docker ps 2>$null
        return $true
    } catch {
        return $false
    }
}

function Test-PodmanRunning {
    try {
        $null = podman ps 2>$null
        return $true
    } catch {
        return $false
    }
}

function Get-ContainerEngine {
    if (Test-DockerRunning) {
        return 'docker'
    } elseif (Test-PodmanRunning) {
        return 'podman'
    } else {
        Write-Status "Docker e Podman não estão rodando!" "error"
        Write-Status "Por favor inicie Docker Desktop ou Podman Machine" "warning"
        exit 1
    }
}

# Validar engine
$Engine = Get-ContainerEngine
Write-Status "Usando: $Engine" "success"

# Mudar para diretório do projeto
Set-Location $PSScriptRoot

# Executar comando
switch($Command) {
    'build' {
        Write-Status "Construindo imagem Docker..." "warning"
        & $Engine build -t financeiro-domestico:latest .
        if($LASTEXITCODE -eq 0) {
            Write-Status "Build concluído com sucesso!" "success"
        } else {
            Write-Status "Erro no build!" "error"
            exit 1
        }
    }
    
    'up' {
        Write-Status "Iniciando containers..." "warning"
        
        if ($Engine -eq 'docker') {
            $ComposeCmd = 'docker-compose'
        } else {
            $ComposeCmd = 'podman-compose'
        }
        
        # Verificar se docker-compose/podman-compose está instalado
        try {
            & $ComposeCmd --version >$null 2>&1
        } catch {
            Write-Status "$ComposeCmd não encontrado, executando manual..." "warning"
            
            # MySQL
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
            
            # App
            Write-Status "Iniciando Aplicação..." "warning"
            & $Engine run -d `
                --name financeiro-app `
                --link financeiro-db:mysql `
                -e NODE_ENV=production `
                -e DATABASE_URL=mysql://fiscaluser:fiscal123@mysql:3306/financeiro `
                -p 3000:3000 `
                financeiro-domestico:latest | Out-Null
            
            Write-Status "✓ Containers iniciados com sucesso!" "success"
        }
        
        if ($?) {
            & $ComposeCmd -f docker-compose.yml up -d
            Write-Status "✓ Containers iniciados com sucesso!" "success"
            Write-Status "Aplicação disponível em: http://localhost:3000" "success"
        }
    }
    
    'down' {
        Write-Status "Parando containers..." "warning"
        if ($Engine -eq 'docker') {
            $ComposeCmd = 'docker-compose'
        } else {
            $ComposeCmd = 'podman-compose'
        }
        
        try {
            & $ComposeCmd down 2>$null
        } catch {
            & $Engine stop financeiro-app financeiro-db -t 10 2>$null
            & $Engine rm financeiro-app financeiro-db -f 2>$null
        }
        Write-Status "Containers parados" "success"
    }
    
    'logs' {
        Write-Status "Mostrando logs..." "warning"
        if ($Engine -eq 'docker') {
            & docker-compose logs -f
        } else {
            & podman-compose logs -f
        }
    }
    
    'restart' {
        Write-Status "Reiniciando containers..." "warning"
        & $Engine restart financeiro-app financeiro-db
        Write-Status "Containers reiniciados" "success"
    }
    
    'clean' {
        Write-Status "Limpando containers e imagens..." "warning"
        & $Engine stop financeiro-app financeiro-db -t 10 2>$null
        & $Engine rm financeiro-app financeiro-db -f 2>$null
        & $Engine rmi financeiro-domestico:latest -f 2>$null
        & $Engine volume prune -f 2>$null
        Write-Status "Limpeza concluída" "success"
    }
    
    default {
        Write-Status "Comando desconhecido: $Command" "error"
        Write-Status "Comandos disponíveis: build, up, down, logs, restart, clean" "warning"
    }
}

# Se foi 'up', mostrar informações
if ($Command -eq 'up' -and $LASTEXITCODE -eq 0) {
    Write-Host "`n"
    Write-Status "═════════════════════════════════════════" "success"
    Write-Status "APLICAÇÃO INICIADA COM SUCESSO!" "success"
    Write-Status "═════════════════════════════════════════" "success"
    Write-Host ""
    Write-Status "Acesso:" "info"
    Write-Host "  Aplicação: http://localhost:3000"
    Write-Host "  Banco:     localhost:3306"
    Write-Host ""
    Write-Status "Credenciais do Banco:" "info"
    Write-Host "  Usuário: fiscaluser"
    Write-Host "  Senha:   fiscal123"
    Write-Host ""
    Write-Status "Comandos úteis:" "info"
    Write-Host "  Ver logs:        .\run-docker.ps1 logs"
    Write-Host "  Parar:           .\run-docker.ps1 down"
    Write-Host "  Reiniciar:       .\run-docker.ps1 restart"
    Write-Host "  Limpar tudo:     .\run-docker.ps1 clean"
    Write-Host ""
}
