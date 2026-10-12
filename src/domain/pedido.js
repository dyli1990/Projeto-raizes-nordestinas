const { Perfil, CanalPedido, StatusPedido } = require('./enums');
const { ConflictError, ForbiddenError, BusinessRuleError } = require('./errors');

// Máquina de estados do pedido.
//
//   AGUARDANDO_PAGAMENTO --(pagamento aprovado)--> EM_PREPARO (cozinha)
//   EM_PREPARO --> PRONTO --> ENTREGUE
//   AGUARDANDO_PAGAMENTO | EM_PREPARO --> CANCELADO
//
// A passagem AGUARDANDO_PAGAMENTO -> EM_PREPARO não pode ser feita
// manualmente: só acontece quando o gateway de pagamento aprova a cobrança.
// Para cada transição manual definimos quais perfis podem executá-la.
const TRANSICOES_MANUAIS = Object.freeze({
  [StatusPedido.AGUARDANDO_PAGAMENTO]: {
    [StatusPedido.CANCELADO]: [Perfil.CLIENTE, Perfil.ATENDENTE, Perfil.GERENTE, Perfil.ADMIN],
  },
  [StatusPedido.EM_PREPARO]: {
    [StatusPedido.PRONTO]: [Perfil.COZINHA, Perfil.GERENTE, Perfil.ADMIN],
    [StatusPedido.CANCELADO]: [Perfil.GERENTE, Perfil.ADMIN],
  },
  [StatusPedido.PRONTO]: {
    [StatusPedido.ENTREGUE]: [Perfil.ATENDENTE, Perfil.GERENTE, Perfil.ADMIN],
  },
  [StatusPedido.ENTREGUE]: {},
  [StatusPedido.CANCELADO]: {},
});

const STATUS_EM_ANDAMENTO = Object.freeze([
  StatusPedido.AGUARDANDO_PAGAMENTO,
  StatusPedido.EM_PREPARO,
  StatusPedido.PRONTO,
]);

// Canais que o próprio cliente pode usar. O balcão é operado pela equipe.
const CANAIS_DO_CLIENTE = Object.freeze([
  CanalPedido.APP,
  CanalPedido.TOTEM,
  CanalPedido.PICKUP,
  CanalPedido.WEB,
]);

function validarTransicao(statusAtual, statusNovo, perfil) {
  const destinos = TRANSICOES_MANUAIS[statusAtual] || {};
  const perfisPermitidos = destinos[statusNovo];

  if (!perfisPermitidos) {
    const permitidos = Object.keys(destinos);
    throw new ConflictError(
      'TRANSICAO_STATUS_INVALIDA',
      `Não é possível alterar o pedido de ${statusAtual} para ${statusNovo}.`,
      [
        {
          field: 'status',
          issue: permitidos.length
            ? `A partir de ${statusAtual} são permitidos: ${permitidos.join(', ')}.`
            : `${statusAtual} é um status final.`,
        },
      ]
    );
  }

  if (!perfisPermitidos.includes(perfil)) {
    throw new ForbiddenError(
      'PERFIL_SEM_PERMISSAO',
      `O perfil ${perfil} não pode alterar o pedido para ${statusNovo}.`,
      [{ field: 'status', issue: `Perfis autorizados: ${perfisPermitidos.join(', ')}.` }]
    );
  }
}

function validarCanalParaPerfil(canalPedido, perfil) {
  if (perfil === Perfil.CLIENTE && !CANAIS_DO_CLIENTE.includes(canalPedido)) {
    throw new BusinessRuleError(
      'CANAL_NAO_PERMITIDO',
      `O canal ${canalPedido} é exclusivo da equipe da unidade.`,
      [{ field: 'canalPedido', issue: `Canais disponíveis ao cliente: ${CANAIS_DO_CLIENTE.join(', ')}.` }]
    );
  }
}

function exigeMotivo(statusNovo) {
  return statusNovo === StatusPedido.CANCELADO;
}

function estaEmAndamento(status) {
  return STATUS_EM_ANDAMENTO.includes(status);
}

function calcularSubtotal(itens) {
  return itens.reduce((total, item) => total + item.precoUnitarioCentavos * item.quantidade, 0);
}

module.exports = {
  TRANSICOES_MANUAIS,
  STATUS_EM_ANDAMENTO,
  CANAIS_DO_CLIENTE,
  validarTransicao,
  validarCanalParaPerfil,
  exigeMotivo,
  estaEmAndamento,
  calcularSubtotal,
};
