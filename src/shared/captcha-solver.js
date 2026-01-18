/**
 * Módulo para resolver reCAPTCHA usando CapMonster Cloud API
 */

/**
 * Resolve um reCAPTCHA v2 usando CapMonster
 * @param {string} apiKey - API Key do CapMonster
 * @param {string} pageUrl - URL da página onde o CAPTCHA está
 * @param {string} siteKey - Sitekey do reCAPTCHA
 * @returns {Promise<string>} Token do reCAPTCHA resolvido
 */
async function solveRecaptcha(apiKey, pageUrl, siteKey) {
    if (!apiKey) {
        throw new Error('API Key do CapMonster não fornecida. Configure CAPMONSTER_API_KEY no .env');
    }

    console.log('🔐 Enviando CAPTCHA para CapMonster...');

    // Cria a task no CapMonster
    const createTaskBody = {
        clientKey: apiKey,
        task: {
            type: 'RecaptchaV2Task',
            websiteURL: pageUrl,
            websiteKey: siteKey
        }
    };

    const createTaskResponse = await fetch('https://api.capmonster.cloud/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createTaskBody)
    });

    const createTaskData = await createTaskResponse.json();

    if (createTaskData.errorId !== 0) {
        throw new Error(`Erro ao criar task no CapMonster: ${createTaskData.errorCode || createTaskData.errorDescription || 'Erro desconhecido'}`);
    }

    const taskId = createTaskData.taskId;
    console.log(`📋 Task ID: ${taskId}. Aguardando resolução...`);

    // Poll para obter a solução (tentar por até 2 minutos)
    const maxAttempts = 60; // 60 tentativas * 2 segundos = 2 minutos
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2 segundos

        const getResultBody = {
            clientKey: apiKey,
            taskId: taskId
        };

        const resultResponse = await fetch('https://api.capmonster.cloud/getTaskResult', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getResultBody)
        });

        const resultData = await resultResponse.json();

        if (resultData.errorId !== 0) {
            throw new Error(`Erro ao obter resultado do CapMonster: ${resultData.errorCode || resultData.errorDescription || 'Erro desconhecido'}`);
        }

        if (resultData.status === 'ready') {
            console.log('✅ CAPTCHA resolvido com sucesso!');
            if (resultData.solution && resultData.solution.gRecaptchaResponse) {
                return resultData.solution.gRecaptchaResponse;
            } else {
                throw new Error('Resposta do CapMonster não contém gRecaptchaResponse');
            }
        }

        if (resultData.status !== 'processing') {
            throw new Error(`Status inesperado do CapMonster: ${resultData.status}`);
        }

        if (i % 5 === 0) {
            console.log(`⏳ Aguardando resolução... (${i * 2}s / ~120s)`);
        }
    }

    throw new Error('Timeout: CAPTCHA não foi resolvido a tempo');
}

/**
 * Extrai o sitekey do reCAPTCHA da página
 * @param {import('playwright').Page} page - Página do Playwright
 * @returns {Promise<string|null>} Sitekey encontrado ou null
 */
async function extractSiteKey(page) {
    try {
        // Tenta encontrar o sitekey em vários lugares
        const siteKey = await page.evaluate(() => {
            // Procura em data-sitekey
            const recaptchaDiv = document.querySelector('[data-sitekey]');
            if (recaptchaDiv) {
                return recaptchaDiv.getAttribute('data-sitekey');
            }

            // Procura em iframe
            const iframe = document.querySelector('iframe[src*="recaptcha"]');
            if (iframe && iframe.src) {
                const match = iframe.src.match(/k=([^&]+)/);
                if (match) return match[1];
            }

            // Procura em scripts
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
                const content = script.innerHTML || script.textContent || '';
                const match = content.match(/sitekey['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
                if (match) return match[1];
            }

            return null;
        });

        return siteKey;
    } catch (error) {
        console.error('Erro ao extrair sitekey:', error);
        return null;
    }
}

/**
 * Injeta o token do reCAPTCHA na página
 * @param {import('playwright').Page} page - Página do Playwright
 * @param {string} token - Token do reCAPTCHA resolvido
 */
async function injectRecaptchaToken(page, token) {
    await page.evaluate((tkn) => {
        // Procura textarea existente
        let textarea = document.querySelector('textarea[name="g-recaptcha-response"]');
        
        if (textarea) {
            textarea.value = tkn;
            // Dispara eventos para notificar o reCAPTCHA
            const event = new Event('input', { bubbles: true });
            textarea.dispatchEvent(event);
        } else {
            // Cria textarea se não existir
            textarea = document.createElement('textarea');
            textarea.name = 'g-recaptcha-response';
            textarea.style.display = 'none';
            textarea.value = tkn;
            document.body.appendChild(textarea);
        }

        // Dispara callback do reCAPTCHA se existir
        if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
            window.grecaptcha.getResponse();
        }
    }, token);
}

/**
 * Verifica se há CAPTCHA na página usando vários métodos
 * @param {import('playwright').Page} page - Página do Playwright
 * @returns {Promise<boolean>} true se CAPTCHA detectado
 */
async function detectCaptcha(page) {
    try {
        // Múltiplos seletores para detectar CAPTCHA
        const hasCaptcha = await page.evaluate(() => {
            // Form com ID captcha-form
            if (document.querySelector('form#captcha-form')) return true;
            
            // Div com reCAPTCHA
            if (document.querySelector('[data-sitekey]')) return true;
            
            // Iframe do reCAPTCHA
            if (document.querySelector('iframe[src*="recaptcha"]')) return true;
            
            // Mensagem de erro do Google sobre CAPTCHA
            const bodyText = document.body.textContent || '';
            if (bodyText.includes('unusual traffic') || 
                bodyText.includes('automated queries') ||
                bodyText.includes('recaptcha')) {
                return true;
            }

            return false;
        });

        return hasCaptcha;
    } catch (error) {
        return false;
    }
}

module.exports = {
    solveRecaptcha,
    extractSiteKey,
    injectRecaptchaToken,
    detectCaptcha
};
