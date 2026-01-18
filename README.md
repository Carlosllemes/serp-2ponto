# SERP Links API

API para extrair links indexados no Google.

## Endpoints

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/health` | - | Health check |
| GET | `/docs` | - | Swagger UI |
| GET/POST | `/api/extract-links` | API Key | Extrair links |
| GET | `/admin/metrics` | Admin | Todas métricas |
| GET | `/admin/metrics/:company` | Admin | Métricas empresa |
| GET | `/admin/keys` | Admin | Listar API Keys |
| POST | `/admin/keys` | Admin | Criar API Key |
| DELETE | `/admin/keys/:key` | Admin | Desativar Key |

## Deploy

```bash
export ADMIN_KEY=sua-chave-admin
export CAPMONSTER_API_KEY=sua-chave-capmonster
./deploy-docker.sh
```

## Uso

### Extrair links

```bash
curl -H "x-api-key: API_KEY" \
  "https://serp.clemes.dev/api/extract-links?domain=example.com"
```

### Admin: Ver métricas

```bash
curl -H "x-admin-key: ADMIN_KEY" \
  "https://serp.clemes.dev/admin/metrics"
```

### Admin: Criar API Key

```bash
curl -X POST -H "x-admin-key: ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company": "grupoideal", "name": "Grupo Ideal"}' \
  "https://serp.clemes.dev/admin/keys"
```

## Variáveis

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta (3010) |
| `ADMIN_KEY` | Chave admin |
| `CAPMONSTER_API_KEY` | CapMonster |

## Métricas por empresa

```json
{
  "requests": 150,
  "captchasSolved": 5,
  "successfulExtractions": 140,
  "failedExtractions": 10,
  "totalLinksExtracted": 2500,
  "lastRequest": "2026-01-18T10:00:00Z"
}
```

## Comandos

```bash
docker service logs serp_serp-api -f   # Logs
docker stack rm serp                    # Remover
./deploy-docker.sh                      # Deploy
```
