const express = require('express');
const jobManager = require('../../job-manager');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/jobs/ranking:
 *   post:
 *     tags: [API]
 *     summary: Cria job para processar múltiplas keywords
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
 *               - keywords
 *             properties:
 *               domain:
 *                 type: string
 *                 example: example.com
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["palavra 1", "palavra 2", "palavra 3"]
 *     responses:
 *       200:
 *         description: Job criado
 *       400:
 *         description: Parâmetros inválidos
 */
router.post('/jobs/ranking', authMiddleware, (req, res) => {
    const { domain, keywords } = req.body;

    if (!domain || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ 
            error: 'Parâmetros "domain" e "keywords" (array) são obrigatórios' 
        });
    }

    if (keywords.length > 500) {
        return res.status(400).json({ 
            error: 'Máximo de 500 keywords por job' 
        });
    }

    const jobId = jobManager.createJob(req.company, domain, keywords);

    console.log(`[${new Date().toISOString()}] [${req.company}] Job criado: ${jobId} - ${keywords.length} keywords`);

    res.json({
        success: true,
        job_id: jobId,
        status: 'pending',
        total: keywords.length,
        message: 'Job criado. Use GET /api/jobs/:job_id para consultar progresso'
    });
});

/**
 * @swagger
 * /api/jobs/{job_id}:
 *   get:
 *     tags: [API]
 *     summary: Consulta status de um job
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status do job
 *       404:
 *         description: Job não encontrado
 */
router.get('/jobs/:job_id', authMiddleware, (req, res) => {
    const job = jobManager.getJob(req.params.job_id);

    if (!job) {
        return res.status(404).json({ error: 'Job não encontrado' });
    }

    // Verifica se o job pertence à empresa
    if (job.company !== req.company) {
        return res.status(403).json({ error: 'Acesso negado a este job' });
    }

    const response = {
        job_id: job.id,
        domain: job.domain,
        status: job.status,
        progress: job.progress,
        results: job.results,
        created: job.created,
        updated: job.updated,
        startedAt: job.startedAt,
        completedAt: job.completedAt
    };

    // Adiciona URL de download se CSV foi gerado
    if (job.csvFile) {
        response.csv_download = `/results/${job.csvFile}`;
    }

    res.json(response);
});

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     tags: [API]
 *     summary: Lista seus jobs
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de jobs
 */
router.get('/jobs', authMiddleware, (req, res) => {
    const jobs = jobManager.getJobsByCompany(req.company);

    res.json({
        total: jobs.length,
        jobs: jobs.map(job => ({
            job_id: job.id,
            domain: job.domain,
            status: job.status,
            progress: job.progress,
            created: job.created,
            completedAt: job.completedAt,
            csv_download: job.csvFile ? `/results/${job.csvFile}` : null
        }))
    });
});

/**
 * @swagger
 * /api/jobs/{job_id}:
 *   delete:
 *     tags: [API]
 *     summary: Cancela um job
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job cancelado
 *       404:
 *         description: Job não encontrado
 */
router.delete('/jobs/:job_id', authMiddleware, (req, res) => {
    const job = jobManager.getJob(req.params.job_id);

    if (!job) {
        return res.status(404).json({ error: 'Job não encontrado' });
    }

    if (job.company !== req.company) {
        return res.status(403).json({ error: 'Acesso negado a este job' });
    }

    const success = jobManager.cancelJob(req.params.job_id);

    if (success) {
        res.json({ message: 'Job cancelado' });
    } else {
        res.status(400).json({ error: 'Não foi possível cancelar o job' });
    }
});

module.exports = router;
