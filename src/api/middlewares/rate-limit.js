const { rateLimit } = require('express-rate-limit');
const env = require('../../config/env');
const { corpoErro } = require('./error-handler');

function limitador({ windowMs, limit, mensagem }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.isTest,
    handler: (req, res) =>
      res.status(429).json(corpoErro(req, { error: 'MUITAS_REQUISICOES', message: mensagem })),
  });
}

// Proteção contra força bruta no login.
const limiteLogin = limitador({
  windowMs: 60_000,
  limit: 20,
  mensagem: 'Muitas tentativas de login. Aguarde 1 minuto.',
});

// Limite geral por IP (proteção básica contra abuso).
const limiteGeral = limitador({
  windowMs: 60_000,
  limit: 600,
  mensagem: 'Limite de requisições excedido. Tente novamente em instantes.',
});

module.exports = { limiteLogin, limiteGeral };
