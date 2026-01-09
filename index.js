const playwright = require('playwright');
const fs = require('fs');

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

async function main() {
    const domain = process.argv[2];
    if (!domain) {
        console.error('Uso: node script.js <dominio.com.br>');
        process.exit(1);
    }

    // Configura browser com user-agent realista
    const browser = await playwright.chromium.launch({ headless: false }); // headless: false para debug ou reCAPTCHA manual
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    console.log("Nova página criada");

    try {
        // Navega para o Google
        await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log("Página do Google carregada");
        await page.waitForTimeout(randomDelay(1000, 3000)); // Delay aleatório

        // Simula rolagem para parecer humano
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(randomDelay(500, 1500));

        // Localiza o campo de busca
        const searchInput = page.locator('textarea[name="q"]');
        await searchInput.waitFor({ state: 'visible', timeout: 10000 });
        console.log("Campo de busca encontrado");

        // Preenche o campo e faz a busca
        await searchInput.fill(`site:${domain}`);
        console.log(`Campo preenchido com: site:${domain}`);
        await page.waitForTimeout(randomDelay(500, 1500)); // Delay antes de pressionar Enter
        await searchInput.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        console.log(`Pesquisa realizada para: ${domain}`);

        // Verifica se há reCAPTCHA
        const captcha = await page.locator('form#captcha-form').count();
        if (captcha > 0) {
            console.log("reCAPTCHA detectado! Resolva manualmente ou use um serviço como 2Captcha.");
            // Para resolver manualmente, aguarde interação (com headless: false)
            await page.waitForTimeout(30000); // Aguarda 30s para resolução manual
        }

        const allLinks = new Set(); // Usa Set para evitar duplicatas

        while (true) {
            // Extrai links da página atual
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('#search a[href]'))
                    .map(a => a.href)
                    .filter(href => href.startsWith('http')); // Filtra apenas URLs absolutas
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
            await page.waitForTimeout(randomDelay(2000, 5000)); // Delay maior entre páginas
        }

        // Salva os links em um arquivo
        const linksArray = Array.from(allLinks);
        fs.writeFileSync('links.txt', linksArray.join('\n'));
        console.log(`Total de links extraídos: ${linksArray.length}. Salvos em links.txt`);
    } catch (error) {
        console.error('Erro:', error);
        await page.screenshot({ path: 'error_screenshot.png' });
        console.log("Screenshot de erro salvo em error_screenshot.png");
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
});