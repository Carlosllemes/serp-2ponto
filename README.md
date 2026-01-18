# SERP Links API

API para extrair links indexados e verificar ranking de keywords no Google.

## Endpoints

### API (requer `x-api-key`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/api/extract-links` | Extrai links indexados |
| GET/POST | `/api/check-ranking` | Verifica posição de keyword |
| POST | `/api/jobs/ranking` | Cria job para batch de keywords |
| GET | `/api/jobs/:job_id` | Consulta status do job |
| GET | `/api/jobs` | Lista seus jobs |
| DELETE | `/api/jobs/:job_id` | Cancela job |

### Admin (requer `x-admin-key`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/admin/metrics` | Todas métricas |
| GET | `/admin/metrics/:company` | Métricas por empresa |
| GET | `/admin/keys` | Listar API Keys |
| POST | `/admin/keys` | Criar API Key |
| DELETE | `/admin/keys/:key` | Desativar Key |
| GET | `/admin/jobs` | Listar todos os jobs |
| GET | `/admin/jobs/:job_id` | Detalhes de um job |
| DELETE | `/admin/jobs/:job_id` | Deletar job |

### Público

| Endpoint | Descrição |
|----------|-----------|
| GET `/health` | Health check |
| GET `/docs` | Swagger UI |
| GET `/results/:filename.csv` | Download CSV (público) |

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

### Processar keywords em lote (Jobs)

**Criar job:**
```bash
curl -X POST -H "x-api-key: API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "keywords": ["palavra 1", "palavra 2", "palavra 3"]
  }' \
  "https://serp.clemes.dev/api/jobs/ranking"
```

**Resposta:**
```json
{
  "success": true,
  "job_id": "job_1737234567890_a1b2c3d4",
  "status": "pending",
  "total": 3,
  "message": "Job criado. Use GET /api/jobs/:job_id para consultar progresso"
}
```

**Consultar progresso:**
```bash
curl -H "x-api-key: API_KEY" \
  "https://serp.clemes.dev/api/jobs/job_1737234567890_a1b2c3d4"
```

**Resposta (processando):**
```json
{
  "job_id": "job_1737234567890_a1b2c3d4",
  "domain": "example.com",
  "status": "processing",
  "progress": {
    "current": 2,
    "total": 3
  },
  "results": [
    {
      "keyword": "palavra 1",
      "position": 15,
      "url": "https://example.com/page1",
      "page": 2,
      "processedAt": "2026-01-18T22:00:00Z"
    },
    {
      "keyword": "palavra 2",
      "position": "+100",
      "url": null,
      "page": null,
      "processedAt": "2026-01-18T22:02:00Z"
    }
  ],
  "created": "2026-01-18T21:55:00Z",
  "updated": "2026-01-18T22:02:15Z"
}
```

**Resposta (completo):**
```json
{
  "job_id": "job_1737234567890_a1b2c3d4",
  "status": "completed",
  "progress": {
    "current": 3,
    "total": 3
  },
  "results": [...],
  "completedAt": "2026-01-18T22:04:30Z",
  "csv_download": "/results/job_1737234567890_a1b2c3d4.csv"
}
```

**Baixar CSV (sem autenticação):**
```bash
curl -O "https://serp.clemes.dev/results/job_1737234567890_a1b2c3d4.csv"
```

**Formato CSV:**
```csv
Keyword,Position,URL,Page,Status,Processed At
"palavra 1",15,"https://example.com/page1",2,Success,2026-01-18T22:00:00Z
"palavra 2",+100,,,Success,2026-01-18T22:02:00Z
"palavra 3",1,"https://example.com/",1,Success,2026-01-18T22:04:00Z
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

## Jobs (Processamento em lote)

### Características
- Até 500 keywords por job
- Processamento em background
- 5 keywords simultâneas (paralelismo)
- **CSV gerado automaticamente quando completa**
- **Download público (sem autenticação)**
- **Arquivos mantidos por 2 dias**
- Limpeza automática de jobs e CSVs antigos

### Como funciona
1. Cria job com `POST /api/jobs/ranking`
2. Recebe `job_id`
3. Consulta progresso com `GET /api/jobs/:job_id`
4. Quando `status: "completed"`:
   - Todos resultados em `results`
   - Campo `csv_download` com URL pública
   - Baixa CSV sem autenticação

### Status dos jobs
- `pending`: Aguardando processamento
- `processing`: Em execução
- `completed`: Finalizado
- `cancelled`: Cancelado

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
