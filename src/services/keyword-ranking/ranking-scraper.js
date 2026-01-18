const playwright = require('playwright');
const { solveRecaptcha, extractSiteKey, injectRecaptchaToken, detectCaptcha } = require('../../shared/captcha-solver');
const { getUserAgent, randomDelay, getBrowserConfig, getContextConfig, initScript } = require('../../shared/browser-config');

/**
 * Verifica a posição de um domínio no Google para uma keyword
 * @param {string} domain - Domínio a ser verificado (ex: example.com)
 * @param {string} keyword - Palavra-chave para buscar
 * @param {string} captchaApiKey - API Key do CapMonster (opcional)
 * @param {function} onEvent - Callback para eventos (captcha_solved)
 * @returns {Promise<{position: string|number, url: string|null, page: number|null}>}
 */
async function checkKeywordRanking(domain, keyword, captchaApiKey = null, onEvent = null) {
    const userAgent = getUserAgent();
    const launchOptions = getBrowserConfig();
    const contextOptions = getContextConfig(userAgent);
    
    // Geolocation para Brasil
    contextOptions.geolocation = { latitude: -23.5505, longitude: -46.6333 };
    contextOptions.permissions = ['geolocation'];

    let browser;
    try {
        browser = await playwright.chromium.launch(launchOptions);
    } catch (error) {
        if (error.message && error.message.includes('Executable doesn\'t exist')) {
            throw new Error(
                'Navegador Playwright não instalado. Execute: npm run install:browsers'
            );
        }
        throw error;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Script anti-detecção
    await page.addInitScript(initScript);

    let foundPosition = null;
    let foundUrl = null;
    let foundPage = null;

    try {
        // Navega para o Google
        await page.goto('https://www.google.com', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        console.log(`🔍 Buscando ranking para "${keyword}"`);
        await page.waitForTimeout(randomDelay(1000, 2000));

        // Fecha popup de cookies
        try {
            const cookieSelectors = [
                'button[id="L2AGLb"]',
                'button[id="W0wltc"]',
                '[aria-label="Aceitar tudo"]',
                '[aria-label="Accept all"]'
            ];
            
            for (const selector of cookieSelectors) {
                const cookieButton = page.locator(selector).first();
                if (await cookieButton.count() > 0) {
                    await cookieButton.click({ timeout: 3000 }).catch(() => {});
                    await page.waitForTimeout(1000);
                    break;
                }
            }
        } catch (cookieError) {
            console.log("Popup de cookies não encontrada");
        }

        // Preenche o campo de busca
        const searchSelectors = [
            'textarea[name="q"]',
            'input[name="q"]',
            '[aria-label="Pesquisar"]',
            '#APjFqb'
        ];
        
        let searchInput;
        for (const selector of searchSelectors) {
            searchInput = page.locator(selector).first();
            if (await searchInput.count() > 0) {
                try {
                    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
                    break;
                } catch (e) {
                    continue;
                }
            }
        }

        if (!searchInput || await searchInput.count() === 0) {
            throw new Error('Campo de busca não encontrado');
        }

        // Usa JavaScript para preencher diretamente
        await page.evaluate((kw) => {
            const input = document.querySelector('textarea[name="q"], input[name="q"]');
            if (input) {
                input.value = kw;
                const form = input.closest('form');
                if (form) form.submit();
            }
        }, keyword);

        await page.waitForTimeout(randomDelay(2000, 3000));

        // Detecta e resolve CAPTCHA se necessário
        if (await detectCaptcha(page)) {
            console.log('⚠️ CAPTCHA detectado');
            
            if (!captchaApiKey) {
                throw new Error('CAPTCHA detectado mas captchaApiKey não fornecido');
            }

            const siteKey = await extractSiteKey(page);
            if (!siteKey) {
                throw new Error('CAPTCHA detectado mas sitekey não encontrado');
            }

            console.log('🔐 Resolvendo CAPTCHA...');
            const token = await solveRecaptcha(page.url(), siteKey, captchaApiKey);
            
            if (!token) {
                throw new Error('Falha ao resolver CAPTCHA');
            }

            await injectRecaptchaToken(page, token);
            console.log('✅ CAPTCHA resolvido');
            
            if (onEvent) onEvent('captcha_solved');
            
            await page.waitForTimeout(3000);
        }

        // Extrai resultados de cada página (1-10)
        let globalPosition = 0;
        
        for (let pageNum = 1; pageNum <= 10; pageNum++) {
            console.log(`📄 Analisando página ${pageNum}/10`);

            // Aguarda resultados carregarem
            await page.waitForTimeout(randomDelay(1500, 2500));

            // Extrai todos os links orgânicos da página
            const resultsOnPage = await page.evaluate(() => {
                const results = [];
                
                // Seletores de resultados orgânicos do Google
                const selectors = [
                    'div.g a[href]:not([href^="#"])',
                    'div[data-hveid] a[href]:not([href^="#"])',
                    'a[jsname="UWckNb"]',
                    'div.yuRUbf a'
                ];
                
                const links = new Set();
                
                for (const selector of selectors) {
                    document.querySelectorAll(selector).forEach(el => {
                        const href = el.href;
                        if (href && 
                            !href.includes('google.com') && 
                            !href.includes('youtube.com') &&
                            !href.startsWith('#') &&
                            href.startsWith('http')) {
                            links.add(href);
                        }
                    });
                }
                
                return Array.from(links);
            });

            console.log(`  Encontrados ${resultsOnPage.length} resultados na página ${pageNum}`);

            // Verifica se o domínio está entre os resultados
            for (let i = 0; i < resultsOnPage.length; i++) {
                globalPosition++;
                const url = resultsOnPage[i];
                
                try {
                    const urlHost = new URL(url).hostname.toLowerCase();
                    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
                    
                    if (urlHost === cleanDomain || 
                        urlHost === `www.${cleanDomain}` || 
                        urlHost.endsWith(`.${cleanDomain}`)) {
                        
                        foundPosition = globalPosition;
                        foundUrl = url;
                        foundPage = pageNum;
                        
                        console.log(`✅ Domínio encontrado na posição ${foundPosition}!`);
                        console.log(`   URL: ${url}`);
                        
                        await browser.close();
                        
                        return {
                            position: foundPosition,
                            url: foundUrl,
                            page: foundPage
                        };
                    }
                } catch (e) {
                    // URL inválida, ignora
                    continue;
                }
            }

            // Se não é a última página, vai para a próxima
            if (pageNum < 10) {
                try {
                    // Procura botão "Próxima" ou link de paginação
                    const nextButton = page.locator('a[id="pnnext"]').first();
                    
                    if (await nextButton.count() > 0) {
                        await nextButton.click();
                        await page.waitForTimeout(randomDelay(2000, 3500));
                        
                        // Verifica CAPTCHA novamente após mudar de página
                        if (await detectCaptcha(page)) {
                            console.log('⚠️ CAPTCHA na navegação entre páginas');
                            
                            if (!captchaApiKey) {
                                throw new Error('CAPTCHA detectado mas captchaApiKey não fornecido');
                            }

                            const siteKey = await extractSiteKey(page);
                            const token = await solveRecaptcha(page.url(), siteKey, captchaApiKey);
                            await injectRecaptchaToken(page, token);
                            
                            if (onEvent) onEvent('captcha_solved');
                            
                            await page.waitForTimeout(3000);
                        }
                    } else {
                        console.log(`⚠️ Botão "Próxima" não encontrado na página ${pageNum}`);
                        break;
                    }
                } catch (navError) {
                    console.log(`Erro ao navegar para página ${pageNum + 1}:`, navError.message);
                    break;
                }
            }
        }

        // Se chegou aqui, não encontrou nas 10 páginas
        console.log(`❌ Domínio não encontrado nas primeiras 10 páginas (${globalPosition} resultados analisados)`);
        
        await browser.close();
        
        return {
            position: '+100',
            url: null,
            page: null
        };

    } catch (error) {
        console.error('Erro ao verificar ranking:', error.message);
        if (browser) await browser.close();
        throw error;
    }
}

module.exports = { checkKeywordRanking };
