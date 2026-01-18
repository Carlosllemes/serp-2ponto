#!/bin/bash

# Script de deploy para VPS (Digital Ocean, AWS, etc.)

echo "🚀 Iniciando deploy..."

# Cria diretório de logs se não existir
mkdir -p logs

# Instala dependências
echo "📦 Instalando dependências..."
npm install

# Instala browsers do Playwright
echo "🌐 Instalando browsers do Playwright..."
npx playwright install chromium
npx playwright install-deps chromium

# Verifica se PM2 está instalado
if ! command -v pm2 &> /dev/null
then
    echo "📦 Instalando PM2..."
    npm install -g pm2
fi

# Para o processo existente se estiver rodando
pm2 stop serp-2ponto 2>/dev/null || true
pm2 delete serp-2ponto 2>/dev/null || true

# Inicia o servidor com PM2
echo "▶️  Iniciando servidor..."
pm2 start ecosystem.config.js

# Salva configuração do PM2
pm2 save

# Configura PM2 para iniciar no boot (opcional)
echo "💡 Para iniciar PM2 no boot, execute: pm2 startup"
echo "✅ Deploy concluído!"
echo ""
echo "Comandos úteis:"
echo "  pm2 status       - Ver status"
echo "  pm2 logs         - Ver logs"
echo "  pm2 restart      - Reiniciar"
echo "  pm2 stop         - Parar"
