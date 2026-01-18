# serp-2ponto

API simples para extrair links indexados no Google usando scraping com Playwright. Pronta para deploy em VPS (Digital Ocean, AWS, etc.).

## 🚀 Instalação Local

```bash
# 1. Instalar dependências
npm install

# 2. Instalar browsers do Playwright (necessário após instalação)
npm run install:browsers
# ou
npx playwright install chromium
```

**⚠️ Importante**: Após `npm install`, você precisa instalar os browsers do Playwright executando `npm run install:browsers` ou `npx playwright install chromium`.

## 📖 Como Usar

### Modo API

Inicie o servidor:

```bash
npm start
# ou
npm run api
```

O servidor estará rodando em `http://localhost:3010`

### Endpoints

#### 1. Extrair links (POST)

```bash
# Sem API Key do CapMonster (retorna erro se houver CAPTCHA)
curl -X POST http://localhost:3010/api/extract-links \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com"
  }'

# Com API Key do CapMonster (resolve CAPTCHA automaticamente)
curl -X POST http://localhost:3010/api/extract-links \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "captchaApiKey": "sua_api_key_aqui"
  }'
```

#### 2. Extrair links (GET - para testes)

```bash
curl "http://localhost:3010/api/extract-links?domain=example.com"
```

#### 3. Health check

```bash
curl http://localhost:3010/health
```

### Resposta da API

```json
{
  "success": true,
  "domain": "example.com",
  "totalLinks": 150,
  "links": [
    "https://example.com/page1",
    "https://example.com/page2",
    ...
  ]
}
```

## 🖥️ Deploy em VPS (Digital Ocean, AWS, etc.)

### Pré-requisitos

- Node.js 18+ instalado
- Git instalado
- Acesso SSH ao servidor VPS

### Passo a passo

#### 1. Conecte-se ao seu VPS

```bash
ssh root@seu-vps-ip
# ou
ssh usuario@seu-vps-ip
```

#### 2. Clone o repositório

```bash
cd /var/www  # ou diretório de sua preferência
git clone https://github.com/seu-usuario/serp-2ponto.git
cd serp-2ponto
```

#### 3. Execute o script de deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

O script irá:
- Instalar dependências
- Instalar browsers do Playwright
- Instalar PM2 (se não estiver instalado)
- Iniciar o servidor

#### 4. Configure PM2 para iniciar no boot (opcional)

```bash
pm2 startup
# Siga as instruções exibidas
pm2 save
```

#### 5. Ajuste o firewall (se necessário)

```bash
# Ubuntu/Debian
sudo ufw allow 3010/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=3010/tcp --permanent
sudo firewall-cmd --reload
```

### Gerenciamento com PM2

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs serp-2ponto

# Reiniciar
pm2 restart serp-2ponto

# Parar
pm2 stop serp-2ponto

# Monitorar
pm2 monit
```

### Configurando Nginx (Recomendado)

Para expor a API através de um domínio com HTTPS:

```nginx
# /etc/nginx/sites-available/serp-api
server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative o site:

```bash
sudo ln -s /etc/nginx/sites-available/serp-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Depois, configure SSL com Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.seudominio.com
```

## 🔧 Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` (opcional):

```env
PORT=3010
NODE_ENV=production
```

### Porta

A porta padrão é `3010`. Para alterar:

```bash
PORT=8080 npm start
```

Ou edite `ecosystem.config.js`:

```javascript
env: {
  PORT: 8080
}
```

## 🛠️ Modo CLI (Original)

Para usar o script original via linha de comando:

```bash
npm run dev dominio.com.br
```

## 📦 Estrutura do Projeto

```
serp-2ponto/
├── server.js          # Servidor Express
├── scraper.js         # Lógica de scraping
├── index.js           # Script CLI original
├── ecosystem.config.js # Configuração PM2
├── deploy.sh          # Script de deploy
└── package.json
```

## 🔐 Resolvendo CAPTCHA com CapMonster

A API agora suporta resolução automática de CAPTCHA usando CapMonster Cloud! 🎉

### Configuração

1. **Obtenha uma API Key do CapMonster**
   - Acesse: https://capmonster.cloud/
   - Crie uma conta e obtenha sua API Key
   - A API key está disponível no painel após criar a conta

2. **Configure a API Key**

   **Opção 1: Variável de ambiente (Recomendado)**
   ```bash
   export CAPMONSTER_API_KEY=sua_api_key_aqui
   # ou crie arquivo .env
   echo "CAPMONSTER_API_KEY=sua_api_key_aqui" > .env
   ```

   **Opção 2: Via requisição API**
   ```bash
   curl -X POST http://localhost:3010/api/extract-links \
     -H "Content-Type: application/json" \
     -d '{
       "domain": "example.com",
       "captchaApiKey": "sua_api_key_aqui"
     }'
   ```

3. **A API resolve automaticamente**
   - Quando um CAPTCHA é detectado, a API tenta resolver usando CapMonster
   - Se não houver API Key configurada, retorna erro informativo

### Como funciona

1. A API detecta CAPTCHA na página do Google
2. Extrai o sitekey do reCAPTCHA
3. Envia para CapMonster resolver (leva ~10-30 segundos)
4. Injeta o token resolvido na página
5. Continua o scraping normalmente

### Custo

- CapMonster cobra por CAPTCHA resolvido
- Preços competitivos e pagamento apenas quando usa
- Sem API Key = erro quando houver CAPTCHA

## ⚠️ Observações

- O Google pode detectar automação e apresentar reCAPTCHA
- **Com CapMonster**: CAPTCHAs são resolvidos automaticamente (se API Key configurada)
- **Sem CapMonster**: API retorna erro quando encontra CAPTCHA
- Em VPS, o modo headless está ativado por padrão
- A API retorna todos os links encontrados em todas as páginas de resultados
- Playwright instala automaticamente os browsers necessários

## 🔐 Segurança (Opcional)

Para uso em produção, considere:

1. **Rate Limiting**: Adicione limite de requisições por IP
2. **Autenticação**: Adicione API keys ou JWT
3. **HTTPS**: Use certificado SSL (Let's Encrypt)
4. **CORS**: Configure CORS adequadamente no `server.js`

## 📝 Recursos da VPS

**Recomendações mínimas:**
- RAM: 1GB+ (Playwright precisa de memória)
- CPU: 1 vCPU
- Disco: 10GB+

**Otimizações:**
- Playwright usa ~200-300MB por instância
- Cada scraping pode levar alguns minutos
- Configure limites de memória no PM2 se necessário

## 🐛 Troubleshooting

### Erro "browser not found"

```bash
npx playwright install chromium
```

### Erro de permissões no VPS

```bash
sudo chown -R $USER:$USER /var/www/serp-2ponto
```

### Servidor não inicia

Verifique os logs:

```bash
pm2 logs serp-2ponto
# ou
cat logs/pm2-error.log
```
