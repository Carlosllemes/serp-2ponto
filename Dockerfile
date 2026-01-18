# Dockerfile para SERP-2ponto API
# Usa imagem oficial do Playwright que já tem browsers instalados
FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências (incluindo playwright)
RUN npm install

# Copia o resto do código
COPY . .

# Cria arquivo de métricas se não existir
RUN touch api-keys.json || true

# Cria diretório de logs
RUN mkdir -p logs

# Expõe a porta
EXPOSE 3010

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3010

# Comando para iniciar
CMD ["node", "server.js"]
