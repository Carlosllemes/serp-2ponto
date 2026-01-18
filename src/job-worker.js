const { checkKeywordRanking } = require('./services/keyword-ranking/ranking-scraper');
const jobManager = require('./job-manager');
const metrics = require('./metrics');

const CONCURRENT_LIMIT = 5; // Máximo de keywords processando simultaneamente
const DELAY_BETWEEN_KEYWORDS = 2000; // 2s entre cada keyword

let isProcessing = false;
let activeProcesses = 0;

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
                }
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
    jobManager.updateJob(job.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        results: results
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
