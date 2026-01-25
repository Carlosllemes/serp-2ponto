const playwright = require('playwright');
const { solveRecaptcha, extractSiteKey, injectRecaptchaToken, detectCaptcha } = require('../../shared/captcha-solver');
const { getUserAgent, randomDelay, getBrowserConfig, getContextConfig, initScript } = require('../../shared/browser-config');
const { getStorageStatePath, loadStorageStateIfExists, saveStorageStateAtomic } = require('../../shared/storage-state');
const { makeUuleFromLatLng } = require('../../shared/uule');

/**
 * Verifica a posição de um domínio no Google para uma keyword
 * @param {string} domain - Domínio a ser verificado (ex: example.com)
 * @param {string} keyword - Palavra-chave para buscar
 * @param {string} captchaApiKey - API Key do CapMonster (opcional)
 * @param {function} onEvent - Callback para eventos (captcha_solved)
 * @param {string} company - Identificador da empresa (para cookies/storageState)
 * @returns {Promise<{position: string|number, url: string|null, page: number|null}>}
 */
async function checkKeywordRanking(domain, keyword, captchaApiKey = null, onEvent = null, company = 'default') {
    const userAgent = getUserAgent();
    const launchOptions = getBrowserConfig();
    const contextOptions = getContextConfig(userAgent);
    
    // Centro de São Paulo (Praça da Sé / região central)
    const spCenter = { latitude: -23.55052, longitude: -46.63331 };
    contextOptions.geolocation = spCenter;
    contextOptions.permissions = ['geolocation'];
    contextOptions.locale = 'pt-BR';
    contextOptions.timezoneId = 'America/Sao_Paulo';

    // Cookies/sessão por empresa
    const statePath = getStorageStatePath('keyword-ranking', company);
    const existingState = loadStorageStateIfExists(statePath);

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

    const context = await browser.newContext({
        ...contextOptions,
        storageState: existingState || undefined,
    });
    const page = await context.newPage();

    // Script anti-detecção
    await page.addInitScript(initScript);

    let foundPosition = null;
    let foundUrl = null;
    let foundPage = null;

    async function acceptGoogleConsentIfAny() {
        try {
            const cookieSelectors = [
                'button[id="L2AGLb"]',
                'button[id="W0wltc"]',
                '[aria-label="Aceitar tudo"]',
                '[aria-label="Accept all"]',
                'button:has-text("Aceitar tudo")',
                'button:has-text("Accept all")',
                'button:has-text("Concordo")',
                'button:has-text("I agree")',
                'div[role="dialog"] button:first-of-type',
            ];
            for (const selector of cookieSelectors) {
                const btn = page.locator(selector).first();
                if (await btn.count()) {
                    await btn.click({ timeout: 3000 }).catch(() => {});
                    await page.waitForTimeout(800);
                    break;
                }
            }
        } catch (e) {
            // ignore
        }
    }

    async function solveCaptchaIfNeeded() {
        if (!(await detectCaptcha(page))) return false;

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

        await page.waitForTimeout(2500);
        // Após injetar token, um reload costuma estabilizar a SERP
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        return true;
    }

    try {
        console.log(`🔍 Buscando ranking para "${keyword}" [company=${company}]`);

        // UULE + params para aproximar resultados do Centro de SP
        const uule = makeUuleFromLatLng(spCenter.latitude, spCenter.longitude);

        // Extrai resultados de cada página (1-10) preservando params via start=
        let globalPosition = 0;
        
        for (let pageNum = 1; pageNum <= 10; pageNum++) {
            console.log(`📄 Analisando página ${pageNum}/10`);
            const start = (pageNum - 1) * 10;
            const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&hl=pt-BR&gl=br&pws=0&uule=${uule}&start=${start}`;

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(randomDelay(800, 1400));

            await acceptGoogleConsentIfAny();
            await solveCaptchaIfNeeded();
            await page.waitForTimeout(randomDelay(900, 1600));

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
        }

        // Se chegou aqui, não encontrou nas 10 páginas
        console.log(`❌ Domínio não encontrado nas primeiras 10 páginas (${globalPosition} resultados analisados)`);
        
        await saveStorageStateAtomic(context, statePath).catch(() => {});
        await browser.close();
        
        return {
            position: '+100',
            url: null,
            page: null
        };

    } catch (error) {
        console.error('Erro ao verificar ranking:', error.message);
        // tenta salvar state mesmo em erro (pode ajudar a manter cookies de consent)
        await saveStorageStateAtomic(context, statePath).catch(() => {});
        if (browser) await browser.close();
        throw error;
    }
}

module.exports = { checkKeywordRanking };
