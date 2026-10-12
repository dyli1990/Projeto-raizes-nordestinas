const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const {
  Perfil,
  StatusPedido,
  StatusPagamento,
  TipoMovimentacao,
  OrigemMovimentacao,
  TipoTransacaoFidelidade,
} = require('../domain/enums');
const {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BusinessRuleError,
} = require('../domain/errors');
const { validarCanalParaPerfil, validarTransicao, exigeMotivo, calcularSubtotal } = require('../domain/pedido');
const { validarPromocao, calcularDescontoPromocao } = require('../domain/promocao');
const { validarResgate } = require('../domain/fidelidade');
const { ehAdmin, garantirAcessoUnidade, podeVerPedido } = require('../domain/acesso');
const auditoria = require('./auditoria.service');
const fidelidade = require('./fidelidade.service');
const pagamentos = require('./pagamentos.service');
const { buscarUnidadeAtiva } = require('./unidades.service');
const { paginar } = require('./paginacao');

// ---------------------------------------------------------------------------
// Criação do pedido (fluxo crítico)
// ---------------------------------------------------------------------------

async function resolverCliente(ator, clienteIdInformado) {
  if (ator.perfil === Perfil.CLIENTE) {
    if (clienteIdInformado && clienteIdInformado !== ator.id) {
      throw new ForbiddenError('PERFIL_SEM_PERMISSAO', 'O cliente só pode criar pedidos para si mesmo.', [
        { field: 'clienteId', issue: 'Omita o campo ou informe o seu próprio ID.' },
      ]);
    }
    return ator.id;
  }
  if (!clienteIdInformado) return null; // balcão sem identificação do cliente
  const cliente = await repos.usuarios().buscarPorId(clienteIdInformado);
  if (!cliente || cliente.perfil !== Perfil.CLIENTE || !cliente.ativo) {
    throw new NotFoundError('CLIENTE_NAO_ENCONTRADO', `Cliente ${clienteIdInformado} não encontrado.`, [
      { field: 'clienteId', issue: 'Cliente inexistente ou inativo.' },
    ]);
  }
  return cliente.id;
}

// Monta os itens com preço vindo do cardápio da unidade (nunca do cliente).
async function montarItens(unidadeId, itensSolicitados) {
  const ids = itensSolicitados.map((item) => item.produtoId);
  const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicados.length) {
    throw new BusinessRuleError('ITENS_DUPLICADOS', 'Cada produto deve aparecer uma única vez no pedido.', [
      { field: 'itens', issue: `Produto(s) repetido(s): ${[...new Set(duplicados)].join(', ')}. Some as quantidades.` },
    ]);
  }

  const cardapio = await repos.cardapio().buscarItens(unidadeId, ids);
  const porProduto = new Map(cardapio.map((item) => [item.produtoId, item]));

  const naoEncontrados = [];
  const indisponiveis = [];
  itensSolicitados.forEach(({ produtoId }, index) => {
    const item = porProduto.get(produtoId);
    if (!item || !item.produto.ativo) {
      naoEncontrados.push({ field: `itens[${index}].produtoId`, issue: `Produto ${produtoId} não está no cardápio da unidade ${unidadeId}.` });
    } else if (!item.disponivel) {
      indisponiveis.push({ field: `itens[${index}].produtoId`, issue: `${item.produto.nome} está indisponível nesta unidade.` });
    }
  });
  if (naoEncontrados.length) {
    throw new NotFoundError('PRODUTO_NAO_ENCONTRADO', 'Um ou mais produtos não existem no cardápio desta unidade.', naoEncontrados);
  }
  if (indisponiveis.length) {
    throw new ConflictError('PRODUTO_INDISPONIVEL', 'Um ou mais produtos estão indisponíveis.', indisponiveis);
  }

  return itensSolicitados.map(({ produtoId, quantidade }) => {
    const item = porProduto.get(produtoId);
    return {
      produtoId,
      nomeProduto: item.produto.nome,
      quantidade,
      precoUnitarioCentavos: item.precoCentavos,
      subtotalCentavos: item.precoCentavos * quantidade,
    };
  });
}

async function calcularDescontos({ unidadeId, clienteId, subtotalCentavos, codigoPromocao, pontosResgatar }) {
  let descontoPromocao = 0;
  let promocaoId = null;
  if (codigoPromocao) {
    const promocao = await repos.promocoes().buscarPorCodigo(codigoPromocao.toUpperCase());
    validarPromocao(promocao, { unidadeId });
    descontoPromocao = calcularDescontoPromocao(promocao, subtotalCentavos);
    promocaoId = promocao.id;
  }

  let descontoPontos = 0;
  if (pontosResgatar > 0) {
    if (!clienteId) {
      throw new BusinessRuleError('CLIENTE_OBRIGATORIO', 'Resgate de pontos exige um cliente identificado.', [
        { field: 'clienteId', issue: 'Informe o cliente para resgatar pontos.' },
      ]);
    }
    if (!(await fidelidade.temConsentimentoFidelidade(clienteId))) {
      throw new BusinessRuleError(
        'CONSENTIMENTO_FIDELIDADE_AUSENTE',
        'O cliente não aderiu ao programa de fidelidade (consentimento LGPD necessário).',
        [{ field: 'pontosResgatar', issue: 'Conceda o consentimento FIDELIDADE em PUT /usuarios/me/consentimentos.' }]
      );
    }
    const conta = await repos.fidelidade().buscarConta(clienteId);
    descontoPontos = validarResgate({
      pontos: pontosResgatar,
      saldoPontos: conta?.saldoPontos ?? 0,
      valorRestanteCentavos: subtotalCentavos - descontoPromocao,
    });
  }

  return { descontoCentavos: descontoPromocao + descontoPontos, promocaoId };
}

async function criarPedido(ator, ctx, dados) {
  const { unidadeId, canalPedido, codigoPromocao, observacao } = dados;
  const pontosResgatar = dados.pontosResgatar || 0;

  validarCanalParaPerfil(canalPedido, ator.perfil);
  await buscarUnidadeAtiva(unidadeId);
  if (ator.perfil !== Perfil.CLIENTE) garantirAcessoUnidade(ator, unidadeId);

  const clienteId = await resolverCliente(ator, dados.clienteId);
  const itens = await montarItens(unidadeId, dados.itens);
  const subtotalCentavos = calcularSubtotal(itens);
  const { descontoCentavos, promocaoId } = await calcularDescontos({
    unidadeId,
    clienteId,
    subtotalCentavos,
    codigoPromocao,
    pontosResgatar,
  });
  const totalCentavos = subtotalCentavos - descontoCentavos;
  // Pedido 100% pago com pontos não passa pelo gateway: vai direto para a cozinha.
  const statusInicial = totalCentavos === 0 ? StatusPedido.EM_PREPARO : StatusPedido.AGUARDANDO_PAGAMENTO;

  return transaction(async (tx) => {
    const estoqueRepo = repos.estoque(tx);

    // 1) Reserva (baixa) de estoque item a item, de forma atômica.
    const faltas = [];
    for (const [index, item] of itens.entries()) {
      const baixou = await estoqueRepo.baixarSeDisponivel(unidadeId, item.produtoId, item.quantidade);
      if (!baixou) {
        const atual = await estoqueRepo.buscar(unidadeId, item.produtoId);
        faltas.push({ field: `itens[${index}].quantidade`, issue: `Disponível: ${atual?.quantidade ?? 0}` });
      }
    }
    if (faltas.length) {
      // Lançar dentro da transação desfaz as baixas já feitas.
      throw new ConflictError('ESTOQUE_INSUFICIENTE', 'Não há quantidade suficiente para um ou mais itens.', faltas);
    }

    // 2) Pedido + itens.
    const pedido = await repos.pedidos(tx).criar({
      unidadeId,
      clienteId,
      operadorId: ator.perfil === Perfil.CLIENTE ? null : ator.id,
      canalPedido,
      status: statusInicial,
      subtotalCentavos,
      descontoCentavos,
      totalCentavos,
      promocaoId,
      pontosResgatados: pontosResgatar,
      observacao: observacao || null,
      itens,
    });

    // 3) Movimentações de estoque vinculadas ao pedido (rastreabilidade).
    for (const item of itens) {
      const estoque = await estoqueRepo.buscar(unidadeId, item.produtoId);
      await estoqueRepo.registrarMovimentacao({
        estoqueId: estoque.id,
        tipo: TipoMovimentacao.SAIDA,
        origem: OrigemMovimentacao.PEDIDO,
        quantidade: item.quantidade,
        saldoApos: estoque.quantidade,
        motivo: `Venda - pedido #${pedido.id} (${canalPedido})`,
        pedidoId: pedido.id,
        usuarioId: ator.id,
      });
    }

    // 4) Histórico de status.
    await repos.pedidos(tx).registrarHistorico({
      pedidoId: pedido.id,
      statusAnterior: null,
      statusNovo: statusInicial,
      usuarioId: ator.id,
      motivo: totalCentavos === 0 ? 'Pedido quitado integralmente com pontos' : `Pedido criado via ${canalPedido}`,
    });

    // 5) Débito dos pontos resgatados.
    if (pontosResgatar > 0) {
      const conta = await repos.fidelidade(tx).garantirConta(clienteId);
      const { conta: atualizada } = await repos.fidelidade(tx).lancar({
        contaId: conta.id,
        tipo: TipoTransacaoFidelidade.RESGATE,
        pontos: -pontosResgatar,
        descricao: `Resgate no pedido #${pedido.id}`,
        pedidoId: pedido.id,
      });
      if (atualizada.saldoPontos < 0) {
        throw new ConflictError('SALDO_PONTOS_INSUFICIENTE', 'Saldo de pontos insuficiente para o resgate.');
      }
    }

    // 6) Auditoria.
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.PEDIDO_CRIADO,
      entidade: 'Pedido',
      entidadeId: pedido.id,
      detalhes: { canalPedido, unidadeId, status: statusInicial, totalCentavos, quantidadeItens: itens.length },
    });

    return repos.pedidos(tx).buscarPorId(pedido.id);
  });
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

async function obterPedido(ator, id) {
  const pedido = await repos.pedidos().buscarPorId(id);
  // 404 também para pedidos de terceiros: não revelamos que o ID existe.
  if (!pedido || !podeVerPedido(ator, pedido)) {
    throw new NotFoundError('PEDIDO_NAO_ENCONTRADO', `Pedido ${id} não encontrado.`);
  }
  return pedido;
}

function listarPedidos(ator, filtros) {
  const where = {};
  if (filtros.canalPedido) where.canalPedido = filtros.canalPedido;
  if (filtros.status) where.status = filtros.status;

  if (ator.perfil === Perfil.CLIENTE) {
    where.clienteId = ator.id;
    if (filtros.unidadeId) where.unidadeId = filtros.unidadeId;
  } else if (ehAdmin(ator)) {
    if (filtros.unidadeId) where.unidadeId = filtros.unidadeId;
  } else {
    if (filtros.unidadeId) garantirAcessoUnidade(ator, filtros.unidadeId);
    where.unidadeId = ator.unidadeId;
  }

  return repos.pedidos().listar({ filtros: where, ...paginar(filtros) });
}

// ---------------------------------------------------------------------------
// Atualização de status (cozinha -> pronto -> entregue / cancelado)
// ---------------------------------------------------------------------------

async function atualizarStatus(ator, ctx, id, { status, motivo }) {
  const pedido = await obterPedido(ator, id);
  validarTransicao(pedido.status, status, ator.perfil);
  if (exigeMotivo(status) && !motivo) {
    throw new BusinessRuleError('MOTIVO_OBRIGATORIO', 'Informe o motivo do cancelamento.', [
      { field: 'motivo', issue: 'Obrigatório para status CANCELADO.' },
    ]);
  }

  const cancelando = status === StatusPedido.CANCELADO;
  // Pedido já pago: estorna no gateway antes de cancelar (fora da transação
  // do banco, pois é uma chamada externa).
  const pagamentoAprovado = cancelando ? await repos.pagamentos().buscarAprovadoDoPedido(id) : null;
  const estorno = pagamentoAprovado ? await pagamentos.estornarNoGateway(pagamentoAprovado) : null;

  await transaction(async (tx) => {
    const alterou = await repos.pedidos(tx).atualizarStatusSe(id, pedido.status, status);
    if (!alterou) {
      throw new ConflictError(
        'PEDIDO_ALTERADO_CONCORRENTEMENTE',
        'O pedido foi alterado por outra operação. Consulte-o novamente.'
      );
    }
    await repos.pedidos(tx).registrarHistorico({
      pedidoId: id,
      statusAnterior: pedido.status,
      statusNovo: status,
      motivo: motivo || null,
      usuarioId: ator.id,
    });

    if (cancelando) {
      for (const item of pedido.itens) {
        const estoque = await repos.estoque(tx).incrementar(pedido.unidadeId, item.produtoId, item.quantidade);
        await repos.estoque(tx).registrarMovimentacao({
          estoqueId: estoque.id,
          tipo: TipoMovimentacao.ENTRADA,
          origem: OrigemMovimentacao.CANCELAMENTO,
          quantidade: item.quantidade,
          saldoApos: estoque.quantidade,
          motivo: `Devolução - cancelamento do pedido #${id}`,
          pedidoId: id,
          usuarioId: ator.id,
        });
      }
      if (pagamentoAprovado) {
        await repos.pagamentos(tx).atualizar(pagamentoAprovado.id, {
          status: StatusPagamento.ESTORNADO,
          respostaGateway: JSON.stringify({ autorizacao: JSON.parse(pagamentoAprovado.respostaGateway || '{}'), estorno }),
        });
        await auditoria.registrar({
          db: tx,
          ator,
          ctx,
          acao: auditoria.Acao.PAGAMENTO_ESTORNADO,
          entidade: 'Pagamento',
          entidadeId: pagamentoAprovado.id,
          detalhes: { pedidoId: id, valorCentavos: pagamentoAprovado.valorCentavos },
        });
      }
      await fidelidade.estornarDoPedido(tx, pedido);
    }

    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: cancelando ? auditoria.Acao.PEDIDO_CANCELADO : auditoria.Acao.PEDIDO_STATUS_ALTERADO,
      entidade: 'Pedido',
      entidadeId: id,
      detalhes: { de: pedido.status, para: status, motivo: motivo || undefined },
    });
  });

  return repos.pedidos().buscarPorId(id);
}

module.exports = { criarPedido, obterPedido, listarPedidos, atualizarStatus };
