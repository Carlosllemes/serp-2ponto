# SERP Links API

API para extrair links indexados e verificar ranking de keywords no Google.

## Endpoints

### API (requer `x-api-key`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/api/extract-links` | Extrai links indexados |
| GET/POST | `/api/check-ranking` | Verifica posição de keyword |

### Admin (requer `x-admin-key`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/admin/metrics` | Todas métricas |
| GET | `/admin/metrics/:company` | Métricas por empresa |
| GET | `/admin/keys` | Listar API Keys |
| POST | `/admin/keys` | Criar API Key |
| DELETE | `/admin/keys/:key` | Desativar Key |

### Público

| Endpoint | Descrição |
|----------|-----------|
| GET `/health` | Health check |
| GET `/docs` | Swagger UI |

## Deploy

```bash
export ADMIN_KEY=sua-chave-admin
export CAPMONSTER_API_KEY=sua-chave-capmonster
./deploy-docker.sh
```

## Uso

### Extrair links indexados

```bash
curl -H "x-api-key: API_KEY" \
  "https://serp.clemes.dev/api/extract-links?domain=example.com"
```

**Resposta:**
```json
{
  "success": true,
  "domain": "example.com",
  "totalLinks": 150,
  "links": ["https://example.com/page1", "..."]
}
```

### Verificar ranking de keyword

```bash
curl -X POST -H "x-api-key: API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "keyword": "melhores notebooks"}' \
  "https://serp.clemes.dev/api/check-ranking"
```

**Resposta (encontrado):**
```json
{
  "success": true,
  "domain": "example.com",
  "keyword": "melhores notebooks",
  "position": 15,
  "url": "https://example.com/notebooks",
  "page": 2
}
```

**Resposta (não encontrado nas 10 páginas):**
```json
{
  "success": true,
  "domain": "example.com",
  "keyword": "melhores notebooks",
  "position": "+100",
  "url": null,
  "page": null
}
```

### Admin: Ver métricas

```bash
curl -H "x-admin-key: ADMIN_KEY" \
  "https://serp.clemes.dev/admin/metrics/grupoideal"
```

**Resposta:**
```json
{
  "company": "grupoideal",
  "requests": 150,
  "captchasSolved": 5,
  "successfulExtractions": 140,
  "failedExtractions": 10,
  "totalLinksExtracted": 2500,
  "lastRequest": "2026-01-18T10:00:00Z"
}
```

### Admin: Criar API Key

```bash
curl -X POST -H "x-admin-key: ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company": "empresa", "name": "Nome Empresa"}' \
  "https://serp.clemes.dev/admin/keys"
```

## Variáveis

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta | 3010 |
| `ADMIN_KEY` | Chave admin | e2fc9813d8741e3ce1fc09b100f52442 |
| `CAPMONSTER_API_KEY` | CapMonster | - |

## Estrutura

```
src/
├── services/
│   ├── indexed-links/      # Extração de links
│   └── keyword-ranking/    # Verificação de ranking
├── shared/                 # Código compartilhado
├── api/
│   ├── routes/            # Rotas modularizadas
│   └── middleware/        # Auth e rate limit
├── metrics.js             # Sistema de métricas
└── server.js              # Entry point
```

## Comandos

```bash
docker service logs serp_serp-api -f   # Logs
docker stack rm serp                    # Remover
./deploy-docker.sh                      # Deploy
```

## Rate Limit

10 requisições/minuto por IP nas rotas `/api/*`.
