const express = require('express');
const metrics = require('../../metrics');
const jobManager = require('../../job-manager');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

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
router.get('/metrics', adminAuth, (req, res) => {
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
router.get('/metrics/:company', adminAuth, (req, res) => {
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
router.get('/keys', adminAuth, (req, res) => {
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
router.post('/keys', adminAuth, (req, res) => {
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
router.delete('/keys/:apiKey', adminAuth, (req, res) => {
    const success = metrics.deactivateApiKey(req.params.apiKey);
    
    if (success) {
        res.json({ message: 'API Key desativada' });
    } else {
        res.status(404).json({ error: 'API Key não encontrada' });
    }
});

// ==================== ADMIN JOBS ====================

/**
 * @swagger
 * /admin/jobs:
 *   get:
 *     tags: [Admin]
 *     summary: Lista todos os jobs
 *     security:
 *       - AdminKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de jobs
 */
router.get('/jobs', adminAuth, (req, res) => {
    const jobs = jobManager.getAllJobs();
    res.json({
        total: jobs.length,
        jobs: jobs.map(job => ({
            job_id: job.id,
            company: job.company,
            domain: job.domain,
            status: job.status,
            progress: job.progress,
            keywords_count: job.keywords.length,
            created: job.created,
            completedAt: job.completedAt
        }))
    });
});

/**
 * @swagger
 * /admin/jobs/{job_id}:
 *   get:
 *     tags: [Admin]
 *     summary: Detalhes de um job
 *     security:
 *       - AdminKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do job
 *       404:
 *         description: Job não encontrado
 */
router.get('/jobs/:job_id', adminAuth, (req, res) => {
    const job = jobManager.getJob(req.params.job_id);
    
    if (!job) {
        return res.status(404).json({ error: 'Job não encontrado' });
    }
    
    res.json(job);
});

/**
 * @swagger
 * /admin/jobs/{job_id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Deleta um job
 *     security:
 *       - AdminKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job deletado
 *       404:
 *         description: Job não encontrado
 */
router.delete('/jobs/:job_id', adminAuth, (req, res) => {
    const success = jobManager.deleteJob(req.params.job_id);
    
    if (success) {
        res.json({ message: 'Job deletado' });
    } else {
        res.status(404).json({ error: 'Job não encontrado' });
    }
});

module.exports = router;
