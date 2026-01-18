const playwright = require('playwright');
const { solveRecaptcha, extractSiteKey, injectRecaptchaToken, detectCaptcha } = require('./captcha-solver');

// Função para validar se o link pertence ao domínio (com ou sem www/subdomínios)
function isValidUrl(href, domain) {
    try {
        const urlHost = new URL(href).hostname.toLowerCase();
        const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
        return urlHost === cleanDomain || urlHost === `www.${cleanDomain}` || urlHost.endsWith(`.${cleanDomain}`);
    } catch (e) {
        return false;
    }
}

// Função para gerar delay aleatório
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Charset': 'UTF-8',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'User-Agent': userAgent,
        'DNT': '1',
        'Referer': 'https://www.google.com/'
    };
}

/**
 * Extrai links do Google para um domínio específico
 * @param {string} domain - Domínio a ser pesquisado (ex: example.com)
 * @param {string} proxy - Proxy opcional no formato: http://user:pass@host:port ou http://host:port
 * @param {string} captchaApiKey - API Key do CapMonster (opcional, mas necessário se houver CAPTCHA)
 * @returns {Promise<string[]>} Array de links encontrados
 */
async function extractLinks(domain, proxy = null, captchaApiKey = null) {
    // Configurações otimizadas para VPS/produção com anti-detecção
    const userAgent = getUserAgent();
    const launchOptions = {
        headless: true, // Modo headless para VPS
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled', // Remove flag de automação
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--disable-web-security',
            '--disable-features=BlinkGenPropertyTrees',
            '--window-size=1920,1080',
            '--start-maximized'
        ]
    };

    // Configura o contexto com headers e configurações realistas
    const contextOptions = {
        userAgent: userAgent,
        viewport: { width: 1920, height: 1080 }, // Viewport mais comum
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        geolocation: { latitude: -23.5505, longitude: -46.6333 }, // São Paulo
        permissions: ['geolocation'],
        colorScheme: 'light',
        // Extra HTTP headers para parecer mais real
        extraHTTPHeaders: getRealisticHeaders(userAgent),
        // Simula permissões e plugins
        hasTouch: false,
        isMobile: false,
        // Cookies e storage
        storageState: undefined, // Pode ser preenchido com cookies salvos
        // Ignora HTTPS errors se necessário
        ignoreHTTPSErrors: false
    };

    // Adiciona proxy se fornecido
    if (proxy) {
        contextOptions.proxy = {
            server: proxy
        };
    }

    let browser;
    try {
        browser = await playwright.chromium.launch(launchOptions);
    } catch (error) {
        if (error.message && error.message.includes('Executable doesn\'t exist')) {
            throw new Error(
                'Browsers do Playwright não estão instalados. Execute: npm run install:browsers ou npx playwright install chromium'
            );
        }
        throw error;
    }
    
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Remove propriedades que indicam automação
    await page.addInitScript(() => {
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Sobrescreve plugins para parecer real
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        // Sobrescreve languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['pt-BR', 'pt', 'en-US', 'en']
        });

        // Chrome runtime
        window.chrome = {
            runtime: {}
        };

        // Permissões
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });

    try {
        // Navega para o Google com headers melhorados
        await page.goto('https://www.google.com', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000,
            referer: 'https://www.google.com/'
        });
        console.log("Página do Google carregada");
        await page.waitForTimeout(randomDelay(1000, 3000));

        // Simula rolagem para parecer humano
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(randomDelay(500, 1500));

        // Localiza o campo de busca
        const searchInput = page.locator('textarea[name="q"]');
        await searchInput.waitFor({ state: 'visible', timeout: 10000 });
        console.log("Campo de busca encontrado");

        // Preenche o campo de forma mais humana (digitando)
        const searchQuery = `site:${domain}`;
        await searchInput.click(); // Clica primeiro
        await page.waitForTimeout(randomDelay(200, 500));
        
        // Digita letra por letra para parecer humano
        for (const char of searchQuery) {
            await searchInput.type(char, { delay: randomDelay(50, 150) });
        }
        
        console.log(`Campo preenchido com: ${searchQuery}`);
        await page.waitForTimeout(randomDelay(800, 2000)); // Aguarda um pouco antes de enviar
        
        // Pressiona Enter
        await searchInput.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        console.log(`Pesquisa realizada para: ${domain}`);

        // Verifica e resolve CAPTCHA se necessário
        const hasCaptcha = await detectCaptcha(page);
        if (hasCaptcha) {
            console.log("⚠️ CAPTCHA detectado!");
            
            if (captchaApiKey) {
                try {
                    console.log("🔧 Tentando resolver CAPTCHA usando CapMonster...");
                    const siteKey = await extractSiteKey(page);
                    
                    if (!siteKey) {
                        throw new Error('Não foi possível extrair o sitekey do reCAPTCHA');
                    }
                    
                    console.log(`🔑 Sitekey encontrado: ${siteKey.substring(0, 20)}...`);
                    const currentUrl = page.url();
                    const token = await solveRecaptcha(captchaApiKey, currentUrl, siteKey);
                    
                    await injectRecaptchaToken(page, token);
                    console.log("✅ Token do CAPTCHA injetado. Aguardando validação...");
                    
                    // Aguarda a página processar o token
                    await page.waitForTimeout(3000);
                    
                    // Recarrega ou submete se necessário
                    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
                    console.log("📄 Página recarregada após resolução do CAPTCHA");
                } catch (captchaError) {
                    console.error("❌ Erro ao resolver CAPTCHA:", captchaError.message);
                    throw new Error(`CAPTCHA detectado mas não foi possível resolver: ${captchaError.message}`);
                }
            } else {
                throw new Error(
                    'CAPTCHA detectado. Configure CAPMONSTER_API_KEY no .env ou envie captchaApiKey na requisição para resolver automaticamente.'
                );
            }
        }

        const allLinks = new Set(); // Usa Set para evitar duplicatas

        while (true) {
            // Extrai links da página atual
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('#search a[href]'))
                    .map(a => a.href)
                    .filter(href => href.startsWith('http'));
            });

            // Filtra links válidos para o domínio
            links.forEach(href => {
                if (isValidUrl(href, domain)) {
                    allLinks.add(href);
                }
            });

            console.log(`Links encontrados até agora: ${allLinks.size}`);

            // Verifica se há botão "Próximo"
            const nextButton = await page.locator('a[id="pnnext"]');
            if (await nextButton.count() === 0) {
                console.log("Nenhuma página seguinte encontrada. Finalizando...");
                break;
            }

            // Simula rolagem e clique humano
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(randomDelay(1000, 3000));
            await nextButton.click();
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            await page.waitForTimeout(randomDelay(2000, 5000));
        }

        const linksArray = Array.from(allLinks);
        console.log(`Total de links extraídos: ${linksArray.length}`);
        return linksArray;
    } catch (error) {
        console.error('Erro durante scraping:', error);
        // Tira screenshot em caso de erro
        try {
            await page.screenshot({ path: 'error_screenshot.png' });
            console.log("Screenshot de erro salvo em error_screenshot.png");
        } catch (screenshotError) {
            console.error('Erro ao tirar screenshot:', screenshotError);
        }
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = { extractLinks };
