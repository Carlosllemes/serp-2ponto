const { checkKeywordRanking } = require('./services/keyword-ranking/ranking-scraper');
const jobManager = require('./job-manager');
const metrics = require('./metrics');
const fs = require('fs');
const path = require('path');

const CONCURRENT_LIMIT = 5; // Máximo de keywords processando simultaneamente
const DELAY_BETWEEN_KEYWORDS = 2000; // 2s entre cada keyword
const RESULTS_DIR = path.join(__dirname, '..', 'public', 'results');

let isProcessing = false;
let activeProcesses = 0;

// Garante que diretório de resultados existe
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Gera CSV dos resultados
function generateCSV(job, results) {
    const csvLines = [
        'Keyword,Position,URL,Page,Status,Processed At'
    ];

    results.forEach(result => {
        const keyword = `"${result.keyword.replace(/"/g, '""')}"`;
        const position = result.position || (result.error ? 'Error' : 'N/A');
        const url = result.url ? `"${result.url}"` : '';
        const page = result.page || '';
        const status = result.error ? 'Failed' : 'Success';
        const processedAt = result.processedAt || '';

        csvLines.push(`${keyword},${position},${url},${page},${status},${processedAt}`);
    });

    const filename = `${job.id}.csv`;
    const filepath = path.join(RESULTS_DIR, filename);
    
    fs.writeFileSync(filepath, csvLines.join('\n'), 'utf8');
    
    return filename;
}

// Limpa arquivos antigos (mais de 2 dias)
function cleanOldFiles() {
    try {
        const files = fs.readdirSync(RESULTS_DIR);
        const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
        let cleaned = 0;

        files.forEach(file => {
            const filepath = path.join(RESULTS_DIR, file);
            const stats = fs.statSync(filepath);
            
            if (stats.mtimeMs < twoDaysAgo) {
                fs.unlinkSync(filepath);
                cleaned++;
            }
        });

        if (cleaned > 0) {
            console.log(`🗑️ Limpeza: ${cleaned} arquivos CSV antigos removidos`);
        }

        return cleaned;
    } catch (error) {
        console.error('Erro ao limpar arquivos:', error.message);
        return 0;
    }
}

// Processa um job
async function processJob(job, captchaApiKey) {
    console.log(`[Worker] Iniciando job ${job.id} - ${job.keywords.length} keywords`);
    
    jobManager.updateJob(job.id, {
        status: 'processing',
        startedAt: new Date().toISOString()
    });

    const results = [];
    let captchasSolved = 0;

    for (let i = 0; i < job.keywords.length; i++) {
        const keyword = job.keywords[i];
        
        // Aguarda se já tem muitos processos rodando
        while (activeProcesses >= CONCURRENT_LIMIT) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        activeProcesses++;

        try {
            console.log(`[Worker] [${job.id}] Processando keyword ${i + 1}/${job.keywords.length}: "${keyword}"`);
            
            let captchaSolvedInThisRequest = false;
            
            const result = await checkKeywordRanking(
                job.domain, 
                keyword, 
                captchaApiKey,
                (event) => {
                    if (event === 'captcha_solved') {
                        captchaSolvedInThisRequest = true;
                        captchasSolved++;
                    }
                },
                job.company
            );

            results.push({
                keyword,
                ...result,
                processedAt: new Date().toISOString()
            });

            // Atualiza progresso
            jobManager.updateJob(job.id, {
                progress: {
                    current: i + 1,
                    total: job.keywords.length
                },
                results: results
            });

            console.log(`[Worker] [${job.id}] ✅ "${keyword}" → Posição ${result.position}`);

        } catch (error) {
            console.error(`[Worker] [${job.id}] ❌ Erro em "${keyword}":`, error.message);
            
            results.push({
                keyword,
                error: error.message,
                position: null,
                url: null,
                page: null,
                processedAt: new Date().toISOString()
            });

            jobManager.updateJob(job.id, {
                progress: {
                    current: i + 1,
                    total: job.keywords.length
                },
                results: results
            });
        } finally {
            activeProcesses--;
        }

        // Delay entre keywords
        if (i < job.keywords.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_KEYWORDS));
        }

        // Verifica se foi cancelado
        const currentJob = jobManager.getJob(job.id);
        if (currentJob.status === 'cancelled') {
            console.log(`[Worker] Job ${job.id} cancelado`);
            return;
        }
    }

    // Job completo
    const csvFilename = generateCSV(job, results);
    
    jobManager.updateJob(job.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        results: results,
        csvFile: csvFilename
    });

    // Registra métricas
    const successCount = results.filter(r => !r.error).length;
    const failCount = results.filter(r => r.error).length;

    metrics.logRequest(job.company, {
        success: successCount > 0,
        captchaSolved: captchasSolved > 0,
        linksCount: 0
    });

    console.log(`[Worker] ✅ Job ${job.id} completo: ${successCount} sucesso, ${failCount} falhas, ${captchasSolved} CAPTCHAs resolvidos`);
    console.log(`[Worker] 📄 CSV gerado: ${csvFilename}`);
}

// Loop principal do worker
async function startWorker(captchaApiKey) {
    if (isProcessing) return;
    
    console.log('🔧 Worker iniciado');
    isProcessing = true;

    // Limpa jobs antigos a cada 1h
    setInterval(() => {
        jobManager.cleanOldJobs();
    }, 60 * 60 * 1000);

    // Limpa arquivos CSV antigos a cada 6h
    setInterval(() => {
        cleanOldFiles();
    }, 6 * 60 * 60 * 1000);

    // Limpa imediatamente na inicialização
    cleanOldFiles();

    while (isProcessing) {
        try {
            const job = jobManager.getNextPendingJob();
            
            if (job) {
                await processJob(job, captchaApiKey);
            } else {
                // Sem jobs pendentes, aguarda 5s
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error('[Worker] Erro no worker:', error);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

// Para o worker
function stopWorker() {
    isProcessing = false;
    console.log('🛑 Worker parado');
}

module.exports = {
    startWorker,
    stopWorker
};
