const repos = require('../infrastructure/repositories');
const { TipoConsentimento, TipoTransacaoFidelidade } = require('../domain/enums');
const { calcularPontosAcumulados, calcularDescontoPorPontos } = require('../domain/fidelidade');
const { paginar } = require('./paginacao');

async function temConsentimentoFidelidade(usuarioId, db) {
  const atuais = await repos.consentimentos(db).atuais(usuarioId);
  return Boolean(atuais[TipoConsentimento.FIDELIDADE]?.concedido);
}

// Chamado quando o pagamento é aprovado (dentro da transação do pagamento).
async function acumularPorPedido(tx, pedido) {
  if (!pedido.clienteId) return null;
  if (!(await temConsentimentoFidelidade(pedido.clienteId, tx))) return null;

  const pontos = calcularPontosAcumulados(pedido.totalCentavos);
  if (pontos <= 0) return null;

  const conta = await repos.fidelidade(tx).garantirConta(pedido.clienteId);
  const { transacao } = await repos.fidelidade(tx).lancar({
    contaId: conta.id,
    tipo: TipoTransacaoFidelidade.ACUMULO,
    pontos,
    descricao: `Pontos do pedido #${pedido.id}`,
    pedidoId: pedido.id,
  });
  return transacao;
}

// Cancelamento: devolve os pontos resgatados e retira os pontos acumulados.
async function estornarDoPedido(tx, pedido) {
  if (!pedido.clienteId) return;
  const lancamentos = await repos.fidelidade(tx).buscarLancamentosDoPedido(pedido.id);
  if (!lancamentos.length) return;

  let conta = await repos.fidelidade(tx).garantirConta(pedido.clienteId);
  for (const lancamento of lancamentos) {
    let pontos = 0;
    if (lancamento.tipo === TipoTransacaoFidelidade.RESGATE) pontos = -lancamento.pontos;
    if (lancamento.tipo === TipoTransacaoFidelidade.ACUMULO) pontos = -Math.min(lancamento.pontos, conta.saldoPontos);
    if (pontos === 0) continue;
    ({ conta } = await repos.fidelidade(tx).lancar({
      contaId: conta.id,
      tipo: TipoTransacaoFidelidade.ESTORNO,
      pontos,
      descricao: `Estorno do pedido #${pedido.id} (${lancamento.tipo.toLowerCase()})`,
      pedidoId: pedido.id,
    }));
  }
}

async function consultarSaldo(usuarioId) {
  const [conta, consentimentoAtivo] = await Promise.all([
    repos.fidelidade().buscarConta(usuarioId),
    temConsentimentoFidelidade(usuarioId),
  ]);
  const saldoPontos = conta?.saldoPontos ?? 0;
  return {
    saldoPontos,
    equivalenteEmCentavos: calcularDescontoPorPontos(saldoPontos),
    consentimentoAtivo,
  };
}

async function extrato(usuarioId, filtros) {
  const conta = await repos.fidelidade().buscarConta(usuarioId);
  if (!conta) return { itens: [], total: 0 };
  return repos.fidelidade().listarTransacoes(conta.id, paginar(filtros));
}

module.exports = { temConsentimentoFidelidade, acumularPorPedido, estornarDoPedido, consultarSaldo, extrato };
