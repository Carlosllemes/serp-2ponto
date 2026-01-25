const fs = require('fs');
const path = require('path');

function sanitizeName(input) {
    return String(input || 'default')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'default';
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getStorageStatePath(serviceName, company) {
    const safeService = sanitizeName(serviceName);
    const safeCompany = sanitizeName(company);
    const baseDir = path.join(__dirname, '..', '..', 'state', safeService);
    ensureDir(baseDir);
    return path.join(baseDir, `${safeCompany}.json`);
}

function loadStorageStateIfExists(statePath) {
    try {
        if (fs.existsSync(statePath)) {
            const raw = fs.readFileSync(statePath, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        // Se estiver corrompido, ignora (e sobrescreve depois)
        console.warn('Falha ao ler storageState, ignorando:', e.message);
    }
    return null;
}

async function saveStorageStateAtomic(context, statePath) {
    const dir = path.dirname(statePath);
    ensureDir(dir);

    const tmpPath = `${statePath}.tmp`;
    const data = await context.storageState();

    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, statePath);
}

module.exports = {
    getStorageStatePath,
    loadStorageStateIfExists,
    saveStorageStateAtomic,
};

