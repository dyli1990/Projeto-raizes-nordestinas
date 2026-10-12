const repos = require('../infrastructure/repositories');
const { paginar } = require('./paginacao');

// Ações auditadas. Mantidas como constantes para facilitar consultas.
const Acao = Object.freeze({
  LOGIN_SUCESSO: 'LOGIN_SUCESSO',
  LOGIN_FALHA: 'LOGIN_FALHA',
  USUARIO_CRIADO: 'USUARIO_CRIADO',
  CONSENTIMENTO_ALTERADO: 'CONSENTIMENTO_ALTERADO',
  DADOS_PESSOAIS_EXPORTADOS: 'DADOS_PESSOAIS_EXPORTADOS',
  DADOS_PESSOAIS_CONSULTADOS: 'DADOS_PESSOAIS_CONSULTADOS',
  CONTA_ANONIMIZADA: 'CONTA_ANONIMIZADA',
  UNIDADE_CRIADA: 'UNIDADE_CRIADA',
  PRODUTO_CRIADO: 'PRODUTO_CRIADO',
  PRODUTO_ATUALIZADO: 'PRODUTO_ATUALIZADO',
  PRODUTO_DESATIVADO: 'PRODUTO_DESATIVADO',
  CARDAPIO_ATUALIZADO: 'CARDAPIO_ATUALIZADO',
  ESTOQUE_MOVIMENTADO: 'ESTOQUE_MOVIMENTADO',
  PROMOCAO_CRIADA: 'PROMOCAO_CRIADA',
  PEDIDO_CRIADO: 'PEDIDO_CRIADO',
  PEDIDO_STATUS_ALTERADO: 'PEDIDO_STATUS_ALTERADO',
  PEDIDO_CANCELADO: 'PEDIDO_CANCELADO',
  PAGAMENTO_SOLICITADO: 'PAGAMENTO_SOLICITADO',
  PAGAMENTO_APROVADO: 'PAGAMENTO_APROVADO',
  PAGAMENTO_RECUSADO: 'PAGAMENTO_RECUSADO',
  PAGAMENTO_ERRO: 'PAGAMENTO_ERRO',
  PAGAMENTO_ESTORNADO: 'PAGAMENTO_ESTORNADO',
});

// Registra uma ação sensível. `db` permite gravar dentro da mesma transação
// do caso de uso: se a operação falhar, o log também é desfeito.
function registrar({ db, ator, ctx, acao, entidade, entidadeId, detalhes }) {
  return repos.auditoria(db).registrar({
    usuarioId: ator?.id ?? null,
    acao,
    entidade,
    entidadeId: entidadeId != null ? String(entidadeId) : null,
    detalhes: detalhes ? JSON.stringify(detalhes) : null,
    ip: ctx?.ip ?? null,
    requestId: ctx?.requestId ?? null,
  });
}

function listar(filtros) {
  return repos.auditoria().listar({ ...filtros, ...paginar(filtros) });
}

module.exports = { Acao, registrar, listar };
