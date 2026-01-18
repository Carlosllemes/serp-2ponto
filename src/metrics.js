const fs = require('fs');
const path = require('path');

// api-keys.json está na raiz do projeto, não em src/
const METRICS_FILE = path.join(__dirname, '..', 'api-keys.json');

// Carrega dados do arquivo
function loadData() {
    try {
        if (fs.existsSync(METRICS_FILE)) {
            return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Erro ao carregar métricas:', e.message);
    }
    return { keys: {}, usage: {} };
}

// Salva dados no arquivo
function saveData(data) {
    try {
        fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Erro ao salvar métricas:', e.message);
    }
}

// Valida API Key e retorna dados da empresa
function validateApiKey(apiKey) {
    const data = loadData();
    const keyData = data.keys[apiKey];
    
    if (!keyData) return null;
    if (!keyData.active) return null;
    
    return keyData;
}

// Registra uma requisição
function logRequest(company, options = {}) {
    const data = loadData();
    
    if (!data.usage[company]) {
        data.usage[company] = {
            requests: 0,
            captchasSolved: 0,
            successfulExtractions: 0,
            failedExtractions: 0,
            totalLinksExtracted: 0,
            lastRequest: null
        };
    }
    
    data.usage[company].requests++;
    data.usage[company].lastRequest = new Date().toISOString();
    
    if (options.captchaSolved) {
        data.usage[company].captchasSolved++;
    }
    
    if (options.success) {
        data.usage[company].successfulExtractions++;
        data.usage[company].totalLinksExtracted += (options.linksCount || 0);
    } else if (options.failed) {
        data.usage[company].failedExtractions++;
    }
    
    saveData(data);
}

// Retorna métricas de uma empresa
function getMetrics(company) {
    const data = loadData();
    return data.usage[company] || null;
}

// Retorna todas as métricas
function getAllMetrics() {
    const data = loadData();
    return data.usage;
}

// Lista todas as API Keys (sem mostrar a chave completa)
function listApiKeys() {
    const data = loadData();
    const keys = [];
    
    for (const [key, info] of Object.entries(data.keys)) {
        keys.push({
            key: key.substring(0, 8) + '...',
            company: info.company,
            name: info.name,
            active: info.active,
            created: info.created
        });
    }
    
    return keys;
}

// Adiciona nova API Key
function addApiKey(apiKey, company, name) {
    const data = loadData();
    
    data.keys[apiKey] = {
        company,
        name,
        created: new Date().toISOString().split('T')[0],
        active: true
    };
    
    if (!data.usage[company]) {
        data.usage[company] = {
            requests: 0,
            captchasSolved: 0,
            successfulExtractions: 0,
            failedExtractions: 0,
            totalLinksExtracted: 0,
            lastRequest: null
        };
    }
    
    saveData(data);
    return data.keys[apiKey];
}

// Desativa API Key
function deactivateApiKey(apiKey) {
    const data = loadData();
    
    if (data.keys[apiKey]) {
        data.keys[apiKey].active = false;
        saveData(data);
        return true;
    }
    
    return false;
}

module.exports = {
    validateApiKey,
    logRequest,
    getMetrics,
    getAllMetrics,
    listApiKeys,
    addApiKey,
    deactivateApiKey
};
