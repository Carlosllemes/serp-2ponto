const rateLimit = require('express-rate-limit');

// Rate limiting: 10 req/min por IP
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Rate limit excedido. Aguarde 1 minuto.' }
});

module.exports = limiter;
