#!/bin/bash
set -e

echo "=== Deploy SERP API ==="

# Verificar Docker
command -v docker >/dev/null 2>&1 || { echo "Docker não instalado"; exit 1; }

# Build
echo "Building..."
docker build -t serp-2ponto:latest .

# Deploy
echo "Deploying..."
docker stack rm serp 2>/dev/null || true
sleep 10
docker stack deploy -c docker-compose.yml serp

# Status
sleep 5
echo ""
echo "=== Status ==="
docker service ls | grep serp
echo ""
echo "Logs: docker service logs serp_serp-api -f"
