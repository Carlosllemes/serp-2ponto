const express = require('express');
const cors = require('cors');
const { extractLinks } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint principal para extrair links
app.post('/api/extract-links', async (req, res) => {
    try {
        const { domain, proxy, captchaApiKey } = req.body;
        
        // Usa API key do body ou variável de ambiente
        const apiKey = captchaApiKey || process.env.CAPMONSTER_API_KEY;

        if (!domain) {
            return res.status(400).json({ 
                error: 'O parâmetro "domain" é obrigatório' 
            });
        }

        console.log(`Iniciando extração de links para: ${domain}`);
        if (proxy) {
            console.log(`Usando proxy: ${proxy}`);
        }
        if (apiKey) {
            console.log(`CapMonster API Key configurada`);
        }

        const links = await extractLinks(domain, proxy, apiKey);

        res.json({
            success: true,
            domain,
            totalLinks: links.length,
            links
        });
    } catch (error) {
        console.error('Erro ao extrair links:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint GET para facilitar testes
app.get('/api/extract-links', async (req, res) => {
    try {
        const { domain, proxy, captchaApiKey } = req.query;
        
        // Usa API key do query ou variável de ambiente
        const apiKey = captchaApiKey || process.env.CAPMONSTER_API_KEY;

        if (!domain) {
            return res.status(400).json({ 
                error: 'O parâmetro "domain" é obrigatório. Exemplo: /api/extract-links?domain=example.com' 
            });
        }

        console.log(`Iniciando extração de links para: ${domain}`);
        if (proxy) {
            console.log(`Usando proxy: ${proxy}`);
        }
        if (apiKey) {
            console.log(`CapMonster API Key configurada`);
        }

        const links = await extractLinks(domain, proxy, apiKey);

        res.json({
            success: true,
            domain,
            totalLinks: links.length,
            links
        });
    } catch (error) {
        console.error('Erro ao extrair links:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint de saúde
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 Endpoint: http://localhost:${PORT}/api/extract-links`);
    console.log(`💡 Exemplo GET: http://localhost:${PORT}/api/extract-links?domain=example.com`);
});
