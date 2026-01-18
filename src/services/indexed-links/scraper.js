const playwright = require('playwright');
const { solveRecaptcha, extractSiteKey, injectRecaptchaToken, detectCaptcha } = require('../../shared/captcha-solver');
const { getUserAgent, randomDelay, getBrowserConfig, getContextConfig, initScript } = require('../../shared/browser-config');

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

// Funções auxiliares agora vêm de browser-config

/**
 * Extrai links do Google para um domínio específico
 * @param {string} domain - Domínio a ser pesquisado (ex: example.com)
 * @param {string} proxy - Proxy opcional no formato: http://user:pass@host:port ou http://host:port
 * @param {string} captchaApiKey - API Key do CapMonster (opcional, mas necessário se houver CAPTCHA)
 * @returns {Promise<string[]>} Array de links encontrados
 */
async function extractLinks(domain, proxy = null, captchaApiKey = null, onEvent = null) {
    const userAgent = getUserAgent();
    const launchOptions = getBrowserConfig(proxy);
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
                'Browsers do Playwright não estão instalados. Execute: npm run install:browsers ou npx playwright install chromium'
            );
        }
        throw error;
    }
    
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Remove propriedades que indicam automação
    // Script anti-detecção
    await page.addInitScript(initScript);

    try {
        // Navega para o Google com headers melhorados
        await page.goto('https://www.google.com', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000,
            referer: 'https://www.google.com/'
        });
        console.log("Página do Google carregada");
        await page.waitForTimeout(randomDelay(1000, 2000));

        // Tenta fechar popup de consentimento de cookies do Google (GDPR)
        try {
            // Botões comuns de aceitar cookies
            const cookieSelectors = [
                'button[id="L2AGLb"]',           // "Aceitar tudo" em português
                'button[id="W0wltc"]',           // "Rejeitar tudo"
                '[aria-label="Aceitar tudo"]',
                '[aria-label="Accept all"]',
                'button:has-text("Aceitar tudo")',
                'button:has-text("Accept all")',
                'button:has-text("Concordo")',
                'button:has-text("I agree")',
                'div[role="dialog"] button:first-of-type',
                '.QS5gu.sy4vM'                   // Classe comum do botão
            ];
            
            for (const selector of cookieSelectors) {
                const cookieButton = page.locator(selector).first();
                if (await cookieButton.count() > 0) {
                    console.log("🍪 Popup de cookies detectada, fechando...");
                    await cookieButton.click({ timeout: 3000 }).catch(() => {});
                    await page.waitForTimeout(1000);
                    break;
                }
            }
        } catch (cookieError) {
            console.log("Nenhuma popup de cookies encontrada ou erro ao fechar:", cookieError.message);
        }

        await page.waitForTimeout(randomDelay(500, 1000));

        // Simula rolagem para parecer humano
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(randomDelay(500, 1500));

        // Tenta diferentes seletores para o campo de busca
        let searchInput;
        const searchSelectors = [
            'textarea[name="q"]',
            'input[name="q"]',
            '[aria-label="Pesquisar"]',
            '[aria-label="Search"]',
            '#APjFqb'
        ];
        
        for (const selector of searchSelectors) {
            searchInput = page.locator(selector).first();
            if (await searchInput.count() > 0) {
                try {
                    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
                    console.log(`Campo de busca encontrado: ${selector}`);
                    break;
                } catch (e) {
                    continue;
                }
            }
        }

        if (!searchInput || await searchInput.count() === 0) {
            throw new Error('Campo de busca não encontrado');
        }

        // Preenche o campo de forma mais humana (digitando)
        const searchQuery = `site:${domain}`;
        
        // Usa JavaScript para focar e preencher (evita problemas de overlay)
        await page.evaluate((query) => {
            const input = document.querySelector('textarea[name="q"]') || document.querySelector('input[name="q"]');
            if (input) {
                input.focus();
                input.value = query;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, searchQuery);
        
        console.log(`Campo preenchido com: ${searchQuery}`);
        await page.waitForTimeout(randomDelay(500, 1000));
        
        // Pressiona Enter via JavaScript também
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        console.log(`Pesquisa realizada para: ${domain}`);
        
        // Screenshot de debug após a busca
        try {
            await page.screenshot({ path: '/app/logs/debug_after_search.png', fullPage: true });
            console.log("📸 Screenshot de debug salvo em /app/logs/debug_after_search.png");
        } catch (e) {
            console.log("Não foi possível salvar screenshot de debug");
        }
        
        // Log da URL atual
        console.log(`📍 URL atual: ${page.url()}`);

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
                    
                    // Notifica que CAPTCHA foi resolvido
                    if (onEvent) onEvent('captcha_solved');
                    
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

            // Log todos os links encontrados para debug
            console.log(`🔗 Links brutos encontrados na página: ${links.length}`);
            if (links.length > 0) {
                console.log(`   Primeiros 3: ${links.slice(0, 3).join(', ')}`);
            }

            // Filtra links válidos para o domínio
            links.forEach(href => {
                if (isValidUrl(href, domain)) {
                    allLinks.add(href);
                }
            });

            console.log(`✅ Links válidos para ${domain}: ${allLinks.size}`);

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
