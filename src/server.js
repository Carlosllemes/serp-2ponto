const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const limiter = require('./api/middleware/rate-limit');
const indexedLinksRoutes = require('./api/routes/indexed-links');
const keywordRankingRoutes = require('./api/routes/keyword-ranking');
const adminRoutes = require('./api/routes/admin');

const app = express();
const PORT = process.env.PORT || 3010;

// Trust proxy (necessário quando atrás de Traefik/nginx)
app.set('trust proxy', true);

// Swagger config
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SERP Links API',
            version: '2.0.0',
            description: 'API para extrair links indexados e verificar ranking no Google'
        },
        servers: [{ url: `http://localhost:${PORT}` }],
        components: {
            securitySchemes: {
                ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
                AdminKeyAuth: { type: 'apiKey', in: 'header', name: 'x-admin-key' }
            }
        },
        tags: [
            { name: 'API', description: 'Endpoints de extração e ranking' },
            { name: 'Admin', description: 'Endpoints administrativos' }
        ]
    },
    apis: ['./src/api/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rate limiting em rotas /api
app.use('/api', limiter);

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

// Rotas
app.use('/api', indexedLinksRoutes);
app.use('/api', keywordRankingRoutes);
app.use('/admin', adminRoutes);

app.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
    console.log(`Docs: http://localhost:${PORT}/docs`);
});
