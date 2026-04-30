#!/bin/bash

# Script para executar Financeiro Domestico no Podman via WSL
# Uso: bash run-podman.sh [comando]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções
log_info() {
    echo -e "${BLUE}→ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_podman() {
    if ! command -v podman &> /dev/null; then
        log_error "Podman não instalado"
        echo "Instale com: apt-get install podman (Debian/Ubuntu)"
        return 1
    fi
    
    if ! podman ps &> /dev/null; then
        log_warning "Podman daemon não respondendo"
        return 1
    fi
    
    return 0
}

build_image() {
    log_warning "Construindo imagem Docker..."
    podman build -t financeiro-domestico:latest .
    if [ $? -eq 0 ]; then
        log_success "Build concluído"
    else
        log_error "Build falhou"
        return 1
    fi
}

start_mysql() {
    log_warning "Iniciando MySQL..."
    
    podman run -d \
        --name financeiro-db \
        -e MYSQL_ROOT_PASSWORD=root_password \
        -e MYSQL_DATABASE=financeiro \
        -e MYSQL_USER=fiscaluser \
        -e MYSQL_PASSWORD=fiscal123 \
        -p 3306:3306 \
        -v financeiro_mysql_data:/var/lib/mysql \
        mysql:8
    
    log_warning "Aguardando MySQL ficar pronto..."
    sleep 10
    
    if podman exec financeiro-db mysqladmin ping -u root -proot_password &> /dev/null; then
        log_success "MySQL pronto"
    else
        log_error "MySQL não respondendo"
        return 1
    fi
}

start_app() {
    log_warning "Iniciando Aplicação..."
    
    podman run -d \
        --name financeiro-app \
        --network host \
        -e NODE_ENV=production \
        -e DATABASE_URL=mysql://fiscaluser:fiscal123@localhost:3306/financeiro \
        -p 3000:3000 \
        financeiro-domestico:latest
    
    sleep 2
    
    if podman logs financeiro-app 2>&1 | grep -q "listening\|started"; then
        log_success "Aplicação iniciada"
    else
        log_warning "Verifique logs: podman logs financeiro-app"
    fi
}

stop_containers() {
    log_warning "Parando containers..."
    podman stop financeiro-app financeiro-db 2>/dev/null || true
    podman rm financeiro-app financeiro-db 2>/dev/null || true
    log_success "Containers parados"
}

clean_all() {
    log_warning "Limpando tudo..."
    
    stop_containers
    
    podman rmi financeiro-domestico:latest 2>/dev/null || true
    podman volume rm financeiro_mysql_data 2>/dev/null || true
    podman system prune -a -f 2>/dev/null || true
    
    log_success "Limpeza concluída"
}

show_status() {
    echo ""
    log_info "Status dos containers:"
    podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
}

show_help() {
    cat << EOF
${BLUE}Financeiro Domestico - Executor Podman${NC}

Uso: bash run-podman.sh [comando]

Comandos:
  build       - Construir imagem Docker
  up          - Iniciar containers
  down        - Parar containers
  status      - Mostrar status
  logs        - Ver logs da aplicação
  logs-db     - Ver logs do banco
  logs-all    - Ver logs de tudo
  shell-app   - Entrar no container da app
  shell-db    - Entrar no MySQL
  clean       - Remover tudo
  help        - Mostrar esta ajuda

Exemplos:
  bash run-podman.sh build
  bash run-podman.sh up
  bash run-podman.sh logs
  bash run-podman.sh down
EOF
}

# Main
COMMAND=${1:-help}

case $COMMAND in
    build)
        check_podman || exit 1
        build_image
        ;;
    
    up)
        check_podman || exit 1
        
        # Verificar se imagem existe
        if ! podman image exists financeiro-domestico:latest; then
            log_warning "Imagem não encontrada, fazendo build..."
            build_image || exit 1
        fi
        
        # Parar se rodando
        podman stop financeiro-app financeiro-db 2>/dev/null || true
        podman rm financeiro-app financeiro-db 2>/dev/null || true
        
        start_mysql || exit 1
        start_app || exit 1
        
        echo ""
        log_success "═══════════════════════════════════════════"
        log_success "APLICAÇÃO INICIADA COM SUCESSO!"
        log_success "═══════════════════════════════════════════"
        echo ""
        show_status
        log_success "Acesso: http://localhost:3000"
        echo ""
        ;;
    
    down)
        check_podman || exit 1
        stop_containers
        ;;
    
    status)
        check_podman || exit 1
        show_status
        ;;
    
    logs)
        check_podman || exit 1
        podman logs -f financeiro-app
        ;;
    
    logs-db)
        check_podman || exit 1
        podman logs -f financeiro-db
        ;;
    
    logs-all)
        check_podman || exit 1
        podman logs -f financeiro-app &
        podman logs -f financeiro-db
        ;;
    
    shell-app)
        check_podman || exit 1
        podman exec -it financeiro-app sh
        ;;
    
    shell-db)
        check_podman || exit 1
        podman exec -it financeiro-db bash
        ;;
    
    clean)
        check_podman || exit 1
        clean_all
        ;;
    
    help|--help|-h)
        show_help
        ;;
    
    *)
        log_error "Comando desconhecido: $COMMAND"
        show_help
        exit 1
        ;;
esac
