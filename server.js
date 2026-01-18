const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { extractLinks } = require('./scraper');
const metrics = require('./metrics');

const app = express();
const PORT = process.env.PORT || 3010;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin_secret_key';

// Swagger config
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SERP Links API',
            version: '1.0.0',
            description: 'API para extrair links indexados no Google'
        },
        servers: [{ url: `http://localhost:${PORT}` }],
        components: {
            securitySchemes: {
                ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
                AdminKeyAuth: { type: 'apiKey', in: 'header', name: 'x-admin-key' }
            }
        },
        tags: [
            { name: 'API', description: 'Endpoints de extração' },
            { name: 'Admin', description: 'Endpoints administrativos' }
        ]
    },
    apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rate limiting: 10 req/min por IP
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Rate limit excedido. Aguarde 1 minuto.' }
});
app.use('/api', limiter);

// Auth middleware
const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API Key ausente. Envie no header x-api-key' });
    }
    
    const keyData = metrics.validateApiKey(apiKey);
    if (!keyData) {
        return res.status(401).json({ error: 'API Key inválida ou desativada' });
    }
    
    req.company = keyData.company;
    req.companyName = keyData.name;
    next();
};

// Admin auth
const adminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
};

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [API]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /api/extract-links:
 *   post:
 *     tags: [API]
 *     summary: Extrai links indexados no Google
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - domain
 *             properties:
 *               domain:
 *                 type: string
 *                 example: example.com
 *     responses:
 *       200:
 *         description: Links extraídos
 *       401:
 *         description: API Key inválida
 */
app.post('/api/extract-links', authMiddleware, async (req, res) => {
    const { domain } = req.body;
    const captchaApiKey = process.env.CAPMONSTER_API_KEY;
    let captchaSolved = false;

    if (!domain) {
        return res.status(400).json({ error: 'Parâmetro "domain" obrigatório' });
    }

    console.log(`[${new Date().toISOString()}] [${req.company}] Extraindo: ${domain}`);

    try {
        const links = await extractLinks(domain, null, captchaApiKey, (event) => {
            if (event === 'captcha_solved') captchaSolved = true;
        });

        // Registra métricas
        metrics.logRequest(req.company, {
            success: true,
            captchaSolved,
            linksCount: links.length
        });

        res.json({
            success: true,
            domain,
            totalLinks: links.length,
            links
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [${req.company}] Erro:`, error.message);
        
        metrics.logRequest(req.company, { failed: true, captchaSolved });
        
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/extract-links:
 *   get:
 *     tags: [API]
 *     summary: Extrai links (via GET)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Links extraídos
 */
app.get('/api/extract-links', authMiddleware, async (req, res) => {
    const { domain } = req.query;
    const captchaApiKey = process.env.CAPMONSTER_API_KEY;
    let captchaSolved = false;

    if (!domain) {
        return res.status(400).json({ error: 'Parâmetro "domain" obrigatório' });
    }

    console.log(`[${new Date().toISOString()}] [${req.company}] Extraindo: ${domain}`);

    try {
        const links = await extractLinks(domain, null, captchaApiKey, (event) => {
            if (event === 'captcha_solved') captchaSolved = true;
        });

        metrics.logRequest(req.company, {
            success: true,
            captchaSolved,
            linksCount: links.length
        });

        res.json({
            success: true,
            domain,
            totalLinks: links.length,
            links
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [${req.company}] Erro:`, error.message);
        
        metrics.logRequest(req.company, { failed: true, captchaSolved });
        
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * @swagger
 * /admin/metrics:
 *   get:
 *     tags: [Admin]
 *     summary: Lista métricas de todas as empresas
 *     security:
 *       - AdminKeyAuth: []
 *     responses:
 *       200:
 *         description: Métricas de uso
 *       403:
 *         description: Acesso negado
 */
app.get('/admin/metrics', adminAuth, (req, res) => {
    res.json(metrics.getAllMetrics());
});

/**
 * @swagger
 * /admin/metrics/{company}:
 *   get:
 *     tags: [Admin]
 *     summary: Métricas de uma empresa específica
 *     security:
 *       - AdminKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: company
 *         required: true
 *         schema:
 *           type: string
 *         example: grupoideal
 *     responses:
 *       200:
 *         description: Métricas da empresa
 *       404:
 *         description: Empresa não encontrada
 */
app.get('/admin/metrics/:company', adminAuth, (req, res) => {
    const data = metrics.getMetrics(req.params.company);
    if (!data) {
        return res.status(404).json({ error: 'Empresa não encontrada' });
    }
    res.json({ company: req.params.company, ...data });
});

/**
 * @swagger
 * /admin/keys:
 *   get:
 *     tags: [Admin]
 *     summary: Lista todas as API Keys
 *     security:
 *       - AdminKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de API Keys
 */
app.get('/admin/keys', adminAuth, (req, res) => {
    res.json(metrics.listApiKeys());
});

/**
 * @swagger
 * /admin/keys:
 *   post:
 *     tags: [Admin]
 *     summary: Cria nova API Key
 *     security:
 *       - AdminKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company
 *               - name
 *             properties:
 *               company:
 *                 type: string
 *                 example: grupoideal
 *               name:
 *                 type: string
 *                 example: Grupo Ideal
 *     responses:
 *       200:
 *         description: API Key criada
 *       400:
 *         description: Campos obrigatórios ausentes
 */
app.post('/admin/keys', adminAuth, (req, res) => {
    const { company, name } = req.body;
    
    if (!company || !name) {
        return res.status(400).json({ error: 'company e name são obrigatórios' });
    }
    
    // Gerar API Key
    const apiKey = `${company.substring(0, 3)}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    metrics.addApiKey(apiKey, company, name);
    
    res.json({ 
        message: 'API Key criada',
        apiKey,
        company,
        name
    });
});

/**
 * @swagger
 * /admin/keys/{apiKey}:
 *   delete:
 *     tags: [Admin]
 *     summary: Desativa uma API Key
 *     security:
 *       - AdminKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: apiKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API Key desativada
 *       404:
 *         description: API Key não encontrada
 */
app.delete('/admin/keys/:apiKey', adminAuth, (req, res) => {
    const success = metrics.deactivateApiKey(req.params.apiKey);
    
    if (success) {
        res.json({ message: 'API Key desativada' });
    } else {
        res.status(404).json({ error: 'API Key não encontrada' });
    }
});

app.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
    console.log(`Docs: http://localhost:${PORT}/docs`);
});
