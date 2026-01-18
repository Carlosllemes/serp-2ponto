#!/bin/bash

# Script de deploy com Docker Swarm
# Uso: chmod +x deploy-docker.sh && ./deploy-docker.sh

set -e

echo "🐳 Deploy com Docker Swarm iniciando..."

# =============================================
# 1. VERIFICAR DOCKER
# =============================================
if [ ! -x "$(which docker 2>/dev/null)" ]; then
    echo "❌ Docker não está instalado!"
    exit 1
fi

echo "✅ Docker encontrado: $(which docker)"

# =============================================
# 2. BUILD DA IMAGEM
# =============================================
echo "🔨 Construindo imagem Docker..."
docker build -t serp-2ponto:latest .

# =============================================
# 3. REMOVER STACK EXISTENTE (se houver)
# =============================================
echo "🔄 Removendo stack existente (se houver)..."
docker stack rm serp 2>/dev/null || true
sleep 5

# =============================================
# 4. DEPLOY COM DOCKER SWARM
# =============================================
echo "▶️  Fazendo deploy no Swarm..."
docker stack deploy -c docker-compose.yml serp

# =============================================
# 5. VERIFICAÇÃO
# =============================================
echo ""
echo "🔍 Aguardando serviço iniciar..."
sleep 10

echo ""
echo "📋 Status do serviço:"
docker service ls | grep serp

echo ""
echo "📋 Logs do serviço:"
docker service logs serp_serp-api --tail 20 2>/dev/null || echo "Aguardando logs..."

echo ""
echo "============================================"
echo "✅ Deploy com Docker Swarm concluído!"
echo "============================================"
echo ""
echo "🌐 API disponível em:"
echo "   - https://serp.textopro.com.br/health"
echo ""
echo "💡 Comandos úteis:"
echo "   docker service ls                    - Ver serviços"
echo "   docker service logs serp_serp-api -f - Ver logs em tempo real"
echo "   docker service scale serp_serp-api=2 - Escalar réplicas"
echo "   docker stack rm serp                 - Remover stack"
