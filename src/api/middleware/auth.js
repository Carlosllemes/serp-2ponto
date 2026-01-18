const metrics = require('../../metrics');

const ADMIN_KEY = process.env.ADMIN_KEY || 'admin_secret_key';

// Middleware de autenticação por API Key
const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API Key ausente. Envie no header x-api-key' });
    }
    
    const keyData = metrics.validateApiKey(apiKey);
    if (!keyData) {
        return res.status(401).json({ error: 'API Key inválida ou desativada' });
    }
    
    req.company = keyData.company;
    req.companyName = keyData.name;
    next();
};

// Middleware de autenticação admin
const adminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_KEY) {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
};

module.exports = { authMiddleware, adminAuth };
