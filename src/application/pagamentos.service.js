const { randomUUID } = require('node:crypto');
const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const { paymentGateway, GatewayIndisponivelError } = require('../infrastructure/payment');
const logger = require('../infrastructure/logging/logger');
const { Perfil, StatusPedido, StatusPagamento, MetodoPagamento } = require('../domain/enums');
const {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ServiceUnavailableError,
} = require('../domain/errors');
const { podeVerPedido } = require('../domain/acesso');
const auditoria = require('./auditoria.service');
const fidelidade = require('./fidelidade.service');

// Fluxo: Pedido (AGUARDANDO_PAGAMENTO) -> solicitação ao gateway externo
// (mock) -> registro do pagamento -> atualização do status do pedido.

async function carregarPedido(ator, pedidoId) {
  const pedido = await repos.pedidos().buscarPorId(pedidoId);
  if (!pedido || !podeVerPedido(ator, pedido)) {
    throw new NotFoundError('PEDIDO_NAO_ENCONTRADO', `Pedido ${pedidoId} não encontrado.`, [
      { field: 'pedidoId', issue: 'Pedido inexistente ou fora do seu escopo.' },
    ]);
  }
  return pedido;
}

// Remove do payload do gateway qualquer coisa que não precisamos guardar.
function sanitizarResposta(resposta) {
  if (!resposta) return null;
  const { transacaoId, status, codigoRetorno, codigoAutorizacao, motivo, mensagem, pix } = resposta;
  return { transacaoId, status, codigoRetorno, codigoAutorizacao, motivo, mensagem, pix };
}

async function chamarGateway({ pagamento, pedido, metodo, tokenPagamento }) {
  // Dinheiro é recebido no caixa da unidade: não passa pelo gateway.
  if (metodo === MetodoPagamento.DINHEIRO) {
    return {
      resultado: { status: StatusPagamento.APROVADO, transacaoId: `caixa_${randomUUID()}`, codigoRetorno: '00' },
      tentativas: 0,
    };
  }
  return paymentGateway.autorizar({
    referencia: `pagamento-${pagamento.id}`,
    valorCentavos: pedido.totalCentavos,
    metodo,
    tokenPagamento,
  });
}

async function solicitarPagamento(ator, ctx, { pedidoId, metodo, tokenPagamento, idempotencyKey }) {
  // Idempotência: repetir a mesma requisição (ex.: timeout no app e novo
  // envio) devolve o mesmo pagamento, sem cobrar duas vezes.
  if (idempotencyKey) {
    const existente = await repos.pagamentos().buscarPorIdempotencyKey(idempotencyKey);
    if (existente) {
      if (existente.pedidoId !== pedidoId) {
        throw new ConflictError('IDEMPOTENCY_KEY_REUTILIZADA', 'Esta Idempotency-Key já foi usada em outro pedido.', [
          { field: 'Idempotency-Key', issue: 'Gere uma nova chave para cada pagamento.' },
        ]);
      }
      await carregarPedido(ator, pedidoId);
      return { pagamento: existente, pedido: await repos.pedidos().buscarPorId(pedidoId), reprocessado: true };
    }
  }

  const pedido = await carregarPedido(ator, pedidoId);
  if (pedido.status !== StatusPedido.AGUARDANDO_PAGAMENTO) {
    throw new ConflictError('PEDIDO_NAO_AGUARDA_PAGAMENTO', 'Este pedido não está aguardando pagamento.', [
      { field: 'pedidoId', issue: `Status atual: ${pedido.status}.` },
    ]);
  }
  if (metodo === MetodoPagamento.DINHEIRO && ator.perfil === Perfil.CLIENTE) {
    throw new BusinessRuleError('METODO_NAO_PERMITIDO', 'Pagamento em dinheiro só pode ser registrado no caixa da unidade.', [
      { field: 'metodo', issue: 'Use PIX, CARTAO_CREDITO ou CARTAO_DEBITO.' },
    ]);
  }

  // 1) Registra a tentativa ANTES de chamar o gateway: se a API cair no
  //    meio do caminho, fica o rastro de um pagamento PENDENTE.
  let pagamento = await repos.pagamentos().criar({
    pedidoId,
    metodo,
    status: StatusPagamento.PENDENTE,
    valorCentavos: pedido.totalCentavos,
    idempotencyKey: idempotencyKey || randomUUID(),
  });
  await auditoria.registrar({
    ator,
    ctx,
    acao: auditoria.Acao.PAGAMENTO_SOLICITADO,
    entidade: 'Pagamento',
    entidadeId: pagamento.id,
    detalhes: { pedidoId, metodo, valorCentavos: pedido.totalCentavos },
  });

  // 2) Chamada ao gateway externo (com timeout e novas tentativas).
  let resposta;
  try {
    resposta = await chamarGateway({ pagamento, pedido, metodo, tokenPagamento });
  } catch (erro) {
    if (!(erro instanceof GatewayIndisponivelError)) throw erro;
    await repos.pagamentos().atualizar(pagamento.id, {
      status: StatusPagamento.ERRO,
      motivoRecusa: 'GATEWAY_INDISPONIVEL',
      tentativasGateway: erro.tentativas || 1,
    });
    await auditoria.registrar({
      ator,
      ctx,
      acao: auditoria.Acao.PAGAMENTO_ERRO,
      entidade: 'Pagamento',
      entidadeId: pagamento.id,
      detalhes: { pedidoId, tentativas: erro.tentativas },
    });
    throw new ServiceUnavailableError(
      'GATEWAY_PAGAMENTO_INDISPONIVEL',
      'O serviço de pagamento está indisponível no momento. O pedido continua aguardando pagamento; tente novamente.',
      [{ field: 'pagamentoId', issue: `Tentativa ${pagamento.id} registrada com status ERRO.` }]
    );
  }

  const { resultado, tentativas } = resposta;
  const respostaGateway = JSON.stringify(sanitizarResposta(resultado));

  // 3a) Recusado: o pedido continua AGUARDANDO_PAGAMENTO (o cliente pode tentar outro meio).
  if (resultado.status === StatusPagamento.RECUSADO) {
    pagamento = await repos.pagamentos().atualizar(pagamento.id, {
      status: StatusPagamento.RECUSADO,
      transacaoExternaId: resultado.transacaoId,
      motivoRecusa: resultado.motivo,
      tentativasGateway: tentativas,
      respostaGateway,
    });
    await auditoria.registrar({
      ator,
      ctx,
      acao: auditoria.Acao.PAGAMENTO_RECUSADO,
      entidade: 'Pagamento',
      entidadeId: pagamento.id,
      detalhes: { pedidoId, motivo: resultado.motivo },
    });
    return { pagamento, pedido: await repos.pedidos().buscarPorId(pedidoId), reprocessado: false };
  }

  // 3b) Aprovado: pagamento + status do pedido + pontos, tudo na mesma transação.
  try {
    await transaction(async (tx) => {
      const avancou = await repos.pedidos(tx).atualizarStatusSe(
        pedidoId,
        StatusPedido.AGUARDANDO_PAGAMENTO,
        StatusPedido.EM_PREPARO
      );
      if (!avancou) {
        throw new ConflictError('PEDIDO_JA_PAGO', 'O pedido foi pago ou cancelado por outra operação.');
      }
      await repos.pagamentos(tx).atualizar(pagamento.id, {
        status: StatusPagamento.APROVADO,
        transacaoExternaId: resultado.transacaoId,
        tentativasGateway: tentativas,
        respostaGateway,
      });
      await repos.pedidos(tx).registrarHistorico({
        pedidoId,
        statusAnterior: StatusPedido.AGUARDANDO_PAGAMENTO,
        statusNovo: StatusPedido.EM_PREPARO,
        motivo: `Pagamento ${pagamento.id} aprovado (${metodo})`,
        usuarioId: ator.id,
      });
      await fidelidade.acumularPorPedido(tx, pedido);
      await auditoria.registrar({
        db: tx,
        ator,
        ctx,
        acao: auditoria.Acao.PAGAMENTO_APROVADO,
        entidade: 'Pagamento',
        entidadeId: pagamento.id,
        detalhes: { pedidoId, metodo, valorCentavos: pedido.totalCentavos },
      });
      await auditoria.registrar({
        db: tx,
        ator,
        ctx,
        acao: auditoria.Acao.PEDIDO_STATUS_ALTERADO,
        entidade: 'Pedido',
        entidadeId: pedidoId,
        detalhes: { de: StatusPedido.AGUARDANDO_PAGAMENTO, para: StatusPedido.EM_PREPARO, origem: 'PAGAMENTO' },
      });
    });
  } catch (erro) {
    if (erro.error === 'PEDIDO_JA_PAGO') {
      // Corrida entre dois pagamentos: devolve o dinheiro desta tentativa.
      await compensarPagamentoDuplicado(pagamento, resultado, tentativas);
    }
    throw erro;
  }

  return {
    pagamento: await repos.pagamentos().buscarPorId(pagamento.id),
    pedido: await repos.pedidos().buscarPorId(pedidoId),
    reprocessado: false,
  };
}

async function compensarPagamentoDuplicado(pagamento, resultado, tentativas) {
  try {
    const estorno = await estornarNoGateway({ ...pagamento, transacaoExternaId: resultado.transacaoId });
    await repos.pagamentos().atualizar(pagamento.id, {
      status: StatusPagamento.ESTORNADO,
      transacaoExternaId: resultado.transacaoId,
      tentativasGateway: tentativas,
      respostaGateway: JSON.stringify({ autorizacao: sanitizarResposta(resultado), estorno }),
    });
  } catch (erro) {
    logger.error('Falha ao estornar pagamento duplicado', { pagamentoId: pagamento.id, erro: erro.message });
  }
}

async function estornarNoGateway(pagamento) {
  if (pagamento.metodo === MetodoPagamento.DINHEIRO) {
    return { status: StatusPagamento.ESTORNADO, estornoId: `caixa_${randomUUID()}`, observacao: 'Devolução no caixa' };
  }
  try {
    const { resultado } = await paymentGateway.estornar({
      transacaoId: pagamento.transacaoExternaId,
      valorCentavos: pagamento.valorCentavos,
    });
    return resultado;
  } catch (erro) {
    if (erro instanceof GatewayIndisponivelError) {
      throw new ServiceUnavailableError(
        'GATEWAY_PAGAMENTO_INDISPONIVEL',
        'Não foi possível estornar o pagamento agora. O pedido não foi cancelado; tente novamente.'
      );
    }
    throw erro;
  }
}

async function obterPagamento(ator, id) {
  const pagamento = await repos.pagamentos().buscarPorId(id);
  if (!pagamento || !podeVerPedido(ator, pagamento.pedido)) {
    throw new NotFoundError('PAGAMENTO_NAO_ENCONTRADO', `Pagamento ${id} não encontrado.`);
  }
  return pagamento;
}

module.exports = { solicitarPagamento, estornarNoGateway, obterPagamento };
