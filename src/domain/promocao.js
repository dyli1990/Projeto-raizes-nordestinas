const { TipoDesconto } = require('./enums');
const { BusinessRuleError } = require('./errors');

// Uma promoção é aplicada por código (cupom) na criação do pedido.
// Pode valer para a rede toda (unidadeId nulo) ou para uma unidade.
function validarPromocao(promocao, { unidadeId, agora = new Date() }) {
  const invalida = (issue) =>
    new BusinessRuleError('PROMOCAO_INVALIDA', 'Código promocional inválido para este pedido.', [
      { field: 'codigoPromocao', issue },
    ]);

  if (!promocao || !promocao.ativa) throw invalida('Promoção inexistente ou inativa.');
  if (agora < promocao.inicio) throw invalida('Promoção ainda não iniciada.');
  if (agora > promocao.fim) throw invalida('Promoção expirada.');
  if (promocao.unidadeId && promocao.unidadeId !== unidadeId) {
    throw invalida('Promoção não é válida nesta unidade.');
  }
}

function calcularDescontoPromocao(promocao, subtotalCentavos) {
  if (promocao.tipoDesconto === TipoDesconto.PERCENTUAL) {
    return Math.round((subtotalCentavos * promocao.valor) / 100);
  }
  return Math.min(promocao.valor, subtotalCentavos);
}

module.exports = { validarPromocao, calcularDescontoPromocao };
