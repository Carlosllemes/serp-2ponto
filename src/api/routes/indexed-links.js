const express = require('express');
const { extractLinks } = require('../../services/indexed-links/scraper');
const metrics = require('../../metrics');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

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
router.post('/extract-links', authMiddleware, async (req, res) => {
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
router.get('/extract-links', authMiddleware, async (req, res) => {
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

module.exports = router;
