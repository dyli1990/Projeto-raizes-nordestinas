const { AppError } = require('../../domain/errors');
const logger = require('../../infrastructure/logging/logger');

// Formato único de erro para TODAS as falhas da API:
// { error, message, details[], timestamp, path, requestId }
function corpoErro(req, { error, message, details = [] }) {
  return {
    error,
    message,
    details,
    timestamp: new Date().toISOString(),
    path: req.originalUrl.split('?')[0],
    requestId: req.id,
  };
}

function rotaNaoEncontrada(req, res) {
  res.status(404).json(
    corpoErro(req, {
      error: 'ROTA_NAO_ENCONTRADA',
      message: `Rota ${req.method} ${req.originalUrl.split('?')[0]} não existe. Consulte /docs.`,
    })
  );
}

// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json(corpoErro(req, err));
  }

  // JSON malformado no corpo da requisição.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json(
      corpoErro(req, { error: 'JSON_INVALIDO', message: 'O corpo da requisição não é um JSON válido.' })
    );
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json(corpoErro(req, { error: 'CORPO_MUITO_GRANDE', message: 'Requisição excede 100 KB.' }));
  }

  // Violação de unicidade no banco (ex.: corrida em cadastro/idempotência).
  if (err.code === 'P2002') {
    return res.status(409).json(
      corpoErro(req, {
        error: 'REGISTRO_DUPLICADO',
        message: 'Já existe um registro com estes dados.',
        details: [{ field: String(err.meta?.target ?? ''), issue: 'Valor deve ser único.' }],
      })
    );
  }

  // Erro inesperado: registra detalhes no log, mas não os expõe ao cliente.
  logger.error('Erro não tratado', { requestId: req.id, erro: err.message, stack: err.stack });
  return res.status(500).json(
    corpoErro(req, {
      error: 'ERRO_INTERNO',
      message: 'Ocorreu um erro inesperado. Informe o requestId ao suporte.',
    })
  );
}

module.exports = { tratarErros, rotaNaoEncontrada, corpoErro };
