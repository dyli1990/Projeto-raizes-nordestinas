const { AppError } = require('../../domain/errors');

// Converte os issues do Zod para o formato de "details" do erro padrão.
function formatarIssues(issues) {
  return issues.map((issue) => ({
    field:
      issue.path
        .map((parte, i) => (typeof parte === 'number' ? `[${parte}]` : `${i > 0 ? '.' : ''}${parte}`))
        .join('') || '(corpo)',
    issue: issue.message,
  }));
}

// Valida body, query e params com schemas Zod.
//  - body inválido            -> 422 VALIDACAO_FALHOU
//  - query/params inválidos   -> 400 PARAMETRO_INVALIDO
// Os dados já convertidos ficam em req.valid (o Express 5 não permite
// sobrescrever req.query).
function validar({ body, query, params } = {}) {
  return (req, res, next) => {
    req.valid = req.valid || {};

    for (const [origem, schema, status, codigo, mensagem] of [
      ['params', params, 400, 'PARAMETRO_INVALIDO', 'Parâmetro de rota inválido.'],
      ['query', query, 400, 'PARAMETRO_INVALIDO', 'Parâmetro de consulta inválido.'],
      ['body', body, 422, 'VALIDACAO_FALHOU', 'Os dados enviados são inválidos.'],
    ]) {
      if (!schema) continue;
      const entrada = origem === 'body' ? (req.body ?? {}) : req[origem];
      const resultado = schema.safeParse(entrada);
      if (!resultado.success) {
        throw new AppError(status, codigo, mensagem, formatarIssues(resultado.error.issues));
      }
      req.valid[origem] = resultado.data;
    }
    next();
  };
}

module.exports = { validar, formatarIssues };
