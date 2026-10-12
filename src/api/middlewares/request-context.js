const { randomUUID } = require('node:crypto');
const logger = require('../../infrastructure/logging/logger');

// Gera/propaga o X-Request-Id e registra um log de acesso por requisição.
// O log contém apenas metadados (método, rota, status, duração, usuário),
// nunca o corpo da requisição.
function requestContext(req, res, next) {
  const recebido = req.get('X-Request-Id');
  req.id = recebido && /^[\w-]{8,64}$/.test(recebido) ? recebido : randomUUID();
  res.set('X-Request-Id', req.id);

  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const duracaoMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    logger.info('http_request', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(duracaoMs),
      userId: req.user?.id,
    });
  });
  next();
}

// Contexto repassado aos casos de uso para auditoria.
function contexto(req) {
  return { ip: req.ip, requestId: req.id };
}

module.exports = { requestContext, contexto };
