#!/bin/bash

# Script de deploy para VPS (Digital Ocean, AWS, etc.)
# Uso: chmod +x deploy.sh && ./deploy.sh

set -e  # Para o script se houver erro

echo "🚀 Iniciando deploy..."

# Cria diretório de logs se não existir
mkdir -p logs

# =============================================
# 1. INSTALAR DEPENDÊNCIAS DO SISTEMA (PLAYWRIGHT)
# =============================================
echo "🔧 Instalando dependências do sistema para Playwright..."

# Detecta o sistema operacional
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    OS=$(uname -s)
fi

echo "Sistema detectado: $OS $VERSION"

# Instala dependências baseado no OS
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    echo "📦 Instalando pacotes para Ubuntu/Debian..."
    
    # Atualiza repositórios
    sudo apt update || true
    
    # Pacotes para Ubuntu 24.04+ (com sufixo t64)
    if [ "${VERSION%%.*}" -ge 24 ] 2>/dev/null; then
        echo "Ubuntu 24.04+ detectado, usando pacotes t64..."
        sudo apt install -y \
            libatk1.0-0t64 \
            libatk-bridge2.0-0t64 \
            libcups2t64 \
            libatspi2.0-0t64 \
            libxcomposite1 \
            libxdamage1 \
            libxfixes3 \
            libxrandr2 \
            libgbm1 \
            libcairo2 \
            libpango-1.0-0 \
            libasound2t64 \
            libnss3 \
            libnspr4 \
            libdrm2 \
            libxkbcommon0 \
            fonts-liberation \
            xdg-utils \
            wget \
            ca-certificates || true
    else
        # Pacotes para Ubuntu < 24.04
        echo "Ubuntu < 24.04 detectado..."
        sudo apt install -y \
            libatk1.0-0 \
            libatk-bridge2.0-0 \
            libcups2 \
            libatspi2.0-0 \
            libxcomposite1 \
            libxdamage1 \
            libxfixes3 \
            libxrandr2 \
            libgbm1 \
            libcairo2 \
            libpango-1.0-0 \
            libasound2 \
            libnss3 \
            libnspr4 \
            libdrm2 \
            libxkbcommon0 \
            fonts-liberation \
            xdg-utils \
            wget \
            ca-certificates || true
    fi
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
    echo "📦 Instalando pacotes para CentOS/RHEL/Fedora..."
    sudo yum install -y \
        atk \
        at-spi2-atk \
        cups-libs \
        libXcomposite \
        libXdamage \
        libXrandr \
        mesa-libgbm \
        pango \
        alsa-lib \
        nss \
        libdrm \
        libxkbcommon \
        xdg-utils \
        wget || true
fi

echo "✅ Dependências do sistema instaladas!"

# =============================================
# 2. INSTALAR DEPENDÊNCIAS DO NODE.JS
# =============================================
echo "📦 Instalando dependências do Node.js..."
npm install

# =============================================
# 3. INSTALAR BROWSERS DO PLAYWRIGHT
# =============================================
echo "🌐 Instalando browsers do Playwright..."
npx playwright install chromium

# Tenta instalar deps do playwright (pode falhar se já instalou manualmente)
npx playwright install-deps chromium 2>/dev/null || echo "⚠️ playwright install-deps falhou, mas dependências já foram instaladas manualmente"

# =============================================
# 4. CONFIGURAR PM2
# =============================================
# Verifica se PM2 está instalado
if ! command -v pm2 &> /dev/null
then
    echo "📦 Instalando PM2..."
    npm install -g pm2
fi

# Para o processo existente se estiver rodando
echo "🔄 Reiniciando processos PM2..."
pm2 stop serp-2ponto 2>/dev/null || true
pm2 delete serp-2ponto 2>/dev/null || true

# Limpa cache do PM2
pm2 flush 2>/dev/null || true

# Inicia o servidor com PM2
echo "▶️  Iniciando servidor..."
pm2 start ecosystem.config.js

# Salva configuração do PM2
pm2 save

# =============================================
# 5. CONFIGURAR FIREWALL
# =============================================
echo "🔥 Configurando firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 3010/tcp 2>/dev/null || true
    echo "Porta 3010 liberada no UFW"
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --add-port=3010/tcp --permanent 2>/dev/null || true
    sudo firewall-cmd --reload 2>/dev/null || true
    echo "Porta 3010 liberada no firewalld"
fi

# =============================================
# 6. VERIFICAÇÃO FINAL
# =============================================
echo ""
echo "🔍 Verificando status..."
sleep 2
pm2 status

echo ""
echo "📋 Últimos logs:"
pm2 logs serp-2ponto --lines 5 --nostream

echo ""
echo "============================================"
echo "✅ Deploy concluído!"
echo "============================================"
echo ""
echo "🌐 API disponível em:"
echo "   - Local: http://localhost:3010/health"
echo "   - Externo: http://$(curl -s ifconfig.me 2>/dev/null || echo 'SEU_IP'):3010/health"
echo ""
echo "💡 Comandos úteis:"
echo "   pm2 status        - Ver status"
echo "   pm2 logs          - Ver logs em tempo real"
echo "   pm2 restart all   - Reiniciar"
echo "   pm2 stop all      - Parar"
echo ""
echo "🔧 Para iniciar PM2 no boot do sistema:"
echo "   pm2 startup"
echo "   pm2 save"
