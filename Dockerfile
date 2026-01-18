# Dockerfile para SERP-2ponto API
FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências
RUN npm ci --only=production

# Copia o resto do código
COPY . .

# Instala apenas o Chromium (já vem no image base, mas garante)
RUN npx playwright install chromium

# Cria diretório de logs
RUN mkdir -p logs

# Expõe a porta
EXPOSE 3010

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3010

# Comando para iniciar
CMD ["node", "server.js"]
