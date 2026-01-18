#!/bin/bash

# Script de deploy com Docker
# Uso: chmod +x deploy-docker.sh && ./deploy-docker.sh
# Ou: bash deploy-docker.sh

set -e

echo "🐳 Deploy com Docker iniciando..."

# =============================================
# 1. VERIFICAR DOCKER
# =============================================
if [ ! -x "$(which docker 2>/dev/null)" ]; then
    echo "❌ Docker não está instalado!"
    exit 1
fi

echo "✅ Docker encontrado: $(which docker)"

# Verifica docker compose (v2) ou docker-compose (v1)
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif docker-compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose não está instalado!"
    exit 1
fi

echo "✅ Docker Compose: $COMPOSE_CMD"

# =============================================
# 2. PARAR CONTAINER EXISTENTE
# =============================================
echo "🔄 Parando container existente (se houver)..."
docker stop serp-2ponto 2>/dev/null || true
docker rm serp-2ponto 2>/dev/null || true

# =============================================
# 3. BUILD DA IMAGEM
# =============================================
echo "🔨 Construindo imagem Docker..."
docker build -t serp-2ponto:latest .

# =============================================
# 4. INICIAR COM DOCKER COMPOSE
# =============================================
echo "▶️  Iniciando container..."

# Verifica se rede do Traefik existe
if docker network ls | grep -q "network"; then
    echo "Usando docker-compose.yml (com Traefik)..."
    $COMPOSE_CMD up -d
else
    echo "Rede 'network' não encontrada."
    echo "Usando docker-compose.simple.yml (acesso direto pela porta 3010)..."
    $COMPOSE_CMD -f docker-compose.simple.yml up -d
fi

# =============================================
# 5. VERIFICAÇÃO
# =============================================
echo ""
echo "🔍 Verificando container..."
sleep 3
docker ps | grep serp-2ponto

echo ""
echo "📋 Logs do container:"
docker logs serp-2ponto --tail 10

echo ""
echo "============================================"
echo "✅ Deploy com Docker concluído!"
echo "============================================"
echo ""
echo "🌐 API disponível em:"
echo "   - http://localhost:3010/health"
echo "   - http://$(curl -s ifconfig.me 2>/dev/null || echo 'SEU_IP'):3010/health"
echo ""
echo "💡 Comandos úteis:"
echo "   docker logs serp-2ponto -f     - Ver logs em tempo real"
echo "   docker restart serp-2ponto     - Reiniciar"
echo "   docker stop serp-2ponto        - Parar"
echo "   docker exec -it serp-2ponto sh - Acessar container"
