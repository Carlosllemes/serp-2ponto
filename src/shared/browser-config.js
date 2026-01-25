// Configurações compartilhadas do Playwright entre serviços

// Função para gerar user-agent atualizado
function getUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Função para gerar headers HTTP realistas
function getRealisticHeaders(userAgent) {
    return {
        // Mantém headers enxutos e coerentes.
        // Evite setar manualmente: Accept-Encoding/Connection/sec-ch-ua/etc (podem dar mismatch com Chromium).
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1',
        'Sec-GPC': '1',
    };
}

// Função para delay aleatório
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Configuração padrão do browser
function getBrowserConfig(proxy = null) {
    const userAgent = getUserAgent();
    
    const config = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--window-size=1920,1080'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    };

    if (proxy) {
        config.proxy = { server: proxy };
    }

    return config;
}

// Configuração do contexto
function getContextConfig(userAgent) {
    return {
        userAgent,
        viewport: { width: 1920, height: 1080 },
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        permissions: [],
        extraHTTPHeaders: getRealisticHeaders(userAgent),
        javaScriptEnabled: true,
    };
}

// Script de inicialização para esconder automação
const initScript = `
    // Remove navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    
    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
    });
    
    // Mock languages
    Object.defineProperty(navigator, 'languages', {
        get: () => ['pt-BR', 'pt', 'en-US', 'en']
    });
    
    // Remove chrome automation
    if (window.chrome) {
        Object.defineProperty(window.chrome, 'runtime', { get: () => undefined });
    }
`;

module.exports = {
    getUserAgent,
    getRealisticHeaders,
    randomDelay,
    getBrowserConfig,
    getContextConfig,
    initScript
};
