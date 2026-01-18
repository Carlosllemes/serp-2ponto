const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const JOBS_FILE = path.join(__dirname, '..', 'jobs.json');

// Inicializa arquivo se não existir
if (!fs.existsSync(JOBS_FILE)) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify({ jobs: {} }, null, 2));
}

// Carrega jobs do arquivo
function loadJobs() {
    try {
        if (fs.existsSync(JOBS_FILE)) {
            return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Erro ao carregar jobs:', e.message);
    }
    return { jobs: {} };
}

// Salva jobs no arquivo
function saveJobs(data) {
    try {
        fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar jobs:', e.message);
    }
}

// Cria novo job
function createJob(company, domain, keywords) {
    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const data = loadJobs();
    
    data.jobs[jobId] = {
        id: jobId,
        company,
        domain,
        keywords,
        status: 'pending',
        progress: {
            current: 0,
            total: keywords.length
        },
        results: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        csvFile: null
    };
    
    saveJobs(data);
    return jobId;
}

// Atualiza job
function updateJob(jobId, updates) {
    const data = loadJobs();
    
    if (!data.jobs[jobId]) {
        return false;
    }
    
    data.jobs[jobId] = {
        ...data.jobs[jobId],
        ...updates,
        updated: new Date().toISOString()
    };
    
    saveJobs(data);
    return true;
}

// Busca job
function getJob(jobId) {
    const data = loadJobs();
    return data.jobs[jobId] || null;
}

// Lista jobs de uma empresa
function getJobsByCompany(company) {
    const data = loadJobs();
    return Object.values(data.jobs).filter(job => job.company === company);
}

// Lista todos os jobs
function getAllJobs() {
    const data = loadJobs();
    return Object.values(data.jobs);
}

// Cancela job
function cancelJob(jobId) {
    const data = loadJobs();
    
    if (!data.jobs[jobId]) {
        return false;
    }
    
    if (data.jobs[jobId].status === 'completed') {
        return false; // Não pode cancelar job completo
    }
    
    data.jobs[jobId].status = 'cancelled';
    data.jobs[jobId].updated = new Date().toISOString();
    data.jobs[jobId].completedAt = new Date().toISOString();
    
    saveJobs(data);
    return true;
}

// Deleta job (admin)
function deleteJob(jobId) {
    const data = loadJobs();
    
    if (!data.jobs[jobId]) {
        return false;
    }
    
    delete data.jobs[jobId];
    saveJobs(data);
    return true;
}

// Busca próximo job pendente
function getNextPendingJob() {
    const data = loadJobs();
    const pending = Object.values(data.jobs)
        .filter(job => job.status === 'pending')
        .sort((a, b) => new Date(a.created) - new Date(b.created));
    
    return pending[0] || null;
}

// Limpa jobs antigos (completos há mais de 2 dias)
function cleanOldJobs() {
    const data = loadJobs();
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [jobId, job] of Object.entries(data.jobs)) {
        if (job.status === 'completed' && job.completedAt) {
            const completedTime = new Date(job.completedAt).getTime();
            if (completedTime < twoDaysAgo) {
                delete data.jobs[jobId];
                cleaned++;
            }
        }
    }
    
    if (cleaned > 0) {
        saveJobs(data);
        console.log(`🧹 Limpeza: ${cleaned} jobs antigos removidos`);
    }
    
    return cleaned;
}

module.exports = {
    createJob,
    updateJob,
    getJob,
    getJobsByCompany,
    getAllJobs,
    cancelJob,
    deleteJob,
    getNextPendingJob,
    cleanOldJobs
};
