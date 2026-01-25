const express = require('express');
const { checkKeywordRanking } = require('../../services/keyword-ranking/ranking-scraper');
const metrics = require('../../metrics');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/check-ranking:
 *   post:
 *     tags: [API]
 *     summary: Verifica posição de domínio no Google para uma keyword
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
 *               - keyword
 *             properties:
 *               domain:
 *                 type: string
 *                 example: example.com
 *               keyword:
 *                 type: string
 *                 example: melhores notebooks 2024
 *     responses:
 *       200:
 *         description: Posição encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 domain:
 *                   type: string
 *                 keyword:
 *                   type: string
 *                 position:
 *                   type: string
 *                   description: Posição (1-100 ou "+100")
 *                 url:
 *                   type: string
 *                   nullable: true
 *                 page:
 *                   type: number
 *                   nullable: true
 *       401:
 *         description: API Key inválida
 */
router.post('/check-ranking', authMiddleware, async (req, res) => {
    const { domain, keyword } = req.body;
    const captchaApiKey = process.env.CAPMONSTER_API_KEY;
    let captchaSolved = false;

    if (!domain || !keyword) {
        return res.status(400).json({ 
            error: 'Parâmetros "domain" e "keyword" são obrigatórios' 
        });
    }

    console.log(`[${new Date().toISOString()}] [${req.company}] Verificando ranking: ${domain} para "${keyword}"`);

    try {
        const result = await checkKeywordRanking(domain, keyword, captchaApiKey, (event) => {
            if (event === 'captcha_solved') captchaSolved = true;
        }, req.company);

        metrics.logRequest(req.company, {
            success: true,
            captchaSolved,
            linksCount: 0 // Não conta links no ranking
        });

        res.json({
            success: true,
            domain,
            keyword,
            position: result.position,
            url: result.url,
            page: result.page
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [${req.company}] Erro:`, error.message);
        
        metrics.logRequest(req.company, { failed: true, captchaSolved });
        
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/check-ranking:
 *   get:
 *     tags: [API]
 *     summary: Verifica posição (via GET)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Posição encontrada
 */
router.get('/check-ranking', authMiddleware, async (req, res) => {
    const { domain, keyword } = req.query;
    const captchaApiKey = process.env.CAPMONSTER_API_KEY;
    let captchaSolved = false;

    if (!domain || !keyword) {
        return res.status(400).json({ 
            error: 'Parâmetros "domain" e "keyword" são obrigatórios' 
        });
    }

    console.log(`[${new Date().toISOString()}] [${req.company}] Verificando ranking: ${domain} para "${keyword}"`);

    try {
        const result = await checkKeywordRanking(domain, keyword, captchaApiKey, (event) => {
            if (event === 'captcha_solved') captchaSolved = true;
        }, req.company);

        metrics.logRequest(req.company, {
            success: true,
            captchaSolved,
            linksCount: 0
        });

        res.json({
            success: true,
            domain,
            keyword,
            position: result.position,
            url: result.url,
            page: result.page
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [${req.company}] Erro:`, error.message);
        
        metrics.logRequest(req.company, { failed: true, captchaSolved });
        
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
