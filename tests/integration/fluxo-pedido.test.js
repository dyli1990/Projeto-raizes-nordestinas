const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, prisma, resetarBanco, obterTokens, bearer } = require('../helpers');

after(() => prisma.$disconnect());

// Fluxo A (crítico): Pedido -> Pagamento mock -> Atualização de status.
describe('Fluxo A: pedido -> pagamento mock -> status', () => {
  let tokens;
  let pedidoId;

  before(async () => {
    await resetarBanco();
    tokens = await obterTokens();
  });

  test('cardápio público da unidade traz preços locais e disponibilidade', async () => {
    const res = await api().get('/unidades/1/cardapio');
    assert.equal(res.status, 200);
    const tapioca = res.body.itens.find((i) => i.produtoId === 1);
    assert.equal(tapioca.preco, 22.9);
    assert.equal(tapioca.disponivel, true);
  });

  test('cria pedido pelo APP com cupom: 201, total calculado e estoque baixado', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({
        unidadeId: 1,
        canalPedido: 'APP',
        itens: [
          { produtoId: 1, quantidade: 2 },
          { produtoId: 6, quantidade: 1 },
        ],
        codigoPromocao: 'NORDESTE10',
      });

    assert.equal(res.status, 201);
    assert.equal(res.headers.location, `/pedidos/${res.body.id}`);
    assert.equal(res.body.status, 'AGUARDANDO_PAGAMENTO');
    assert.equal(res.body.canalPedido, 'APP');
    assert.equal(res.body.subtotal, 55.3);
    assert.equal(res.body.desconto, 5.53);
    assert.equal(res.body.total, 49.77);
    pedidoId = res.body.id;

    const estoque = await prisma.estoque.findUnique({ where: { unidadeId_produtoId: { unidadeId: 1, produtoId: 1 } } });
    assert.equal(estoque.quantidade, 48);
  });

  test('criação do pedido gera registro de auditoria', async () => {
    const res = await api()
      .get(`/auditoria?acao=PEDIDO_CRIADO&entidadeId=${pedidoId}`)
      .set(bearer(tokens.admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].detalhes.canalPedido, 'APP');
  });

  test('pagamento recusado mantém o pedido AGUARDANDO_PAGAMENTO', async () => {
    const res = await api()
      .post('/pagamentos')
      .set(bearer(tokens.maria))
      .set('Idempotency-Key', 'teste-recusado-0001')
      .send({ pedidoId, metodo: 'CARTAO_CREDITO', tokenPagamento: 'tok_recusado' });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'RECUSADO');
    assert.equal(res.body.motivoRecusa, 'SALDO_INSUFICIENTE');
    assert.equal(res.body.pedido.status, 'AGUARDANDO_PAGAMENTO');
    assert.match(res.body.mensagem, /recusado/i);
  });

  test('pagamento aprovado move o pedido para EM_PREPARO e acumula pontos', async () => {
    const res = await api()
      .post('/pagamentos')
      .set(bearer(tokens.maria))
      .set('Idempotency-Key', 'teste-aprovado-0001')
      .send({ pedidoId, metodo: 'CARTAO_CREDITO', tokenPagamento: 'tok_aprovado' });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'APROVADO');
    assert.equal(res.body.pedido.status, 'EM_PREPARO');
    assert.match(res.body.transacaoExternaId, /^mock_/);

    const saldo = await api().get('/fidelidade/saldo').set(bearer(tokens.maria));
    assert.equal(saldo.body.saldoPontos, 150 + 49);
  });

  test('repetir a mesma Idempotency-Key não cobra de novo (200 + Idempotent-Replayed)', async () => {
    const res = await api()
      .post('/pagamentos')
      .set(bearer(tokens.maria))
      .set('Idempotency-Key', 'teste-aprovado-0001')
      .send({ pedidoId, metodo: 'CARTAO_CREDITO', tokenPagamento: 'tok_aprovado' });

    assert.equal(res.status, 200);
    assert.equal(res.headers['idempotent-replayed'], 'true');
    assert.equal(await prisma.pagamento.count({ where: { pedidoId, status: 'APROVADO' } }), 1);
  });

  test('novo pagamento para pedido já pago retorna 409', async () => {
    const res = await api()
      .post('/pagamentos')
      .set(bearer(tokens.maria))
      .send({ pedidoId, metodo: 'PIX' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'PEDIDO_NAO_AGUARDA_PAGAMENTO');
  });

  test('cozinha marca PRONTO; atendente marca ENTREGUE; histórico completo', async () => {
    const pronto = await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(tokens.cozinha)).send({ status: 'PRONTO' });
    assert.equal(pronto.status, 200);
    assert.equal(pronto.body.status, 'PRONTO');

    const entregue = await api()
      .patch(`/pedidos/${pedidoId}/status`)
      .set(bearer(tokens.atendente))
      .send({ status: 'ENTREGUE' });
    assert.equal(entregue.status, 200);
    assert.deepEqual(
      entregue.body.historico.map((h) => h.statusNovo),
      ['AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE']
    );
  });

  test('transição a partir de status final retorna 409', async () => {
    const res = await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(tokens.admin)).send({ status: 'PRONTO' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'TRANSICAO_STATUS_INVALIDA');
  });

  test('filtra pedidos por canalPedido', async () => {
    await api()
      .post('/pedidos')
      .set(bearer(tokens.atendente))
      .send({ unidadeId: 1, canalPedido: 'BALCAO', itens: [{ produtoId: 2, quantidade: 1 }] })
      .expect(201);

    const balcao = await api().get('/pedidos?canalPedido=BALCAO').set(bearer(tokens.gerente));
    assert.equal(balcao.status, 200);
    assert.ok(balcao.body.data.length >= 1);
    assert.ok(balcao.body.data.every((p) => p.canalPedido === 'BALCAO'));
    assert.equal(balcao.body.meta.page, 1);
  });
});

describe('Regras e erros do pedido', () => {
  let tokens;

  before(async () => {
    await resetarBanco();
    tokens = await obterTokens();
  });

  test('sem token: 401 no formato padrão de erro', async () => {
    const res = await api().get('/pedidos');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'TOKEN_AUSENTE');
    for (const campo of ['message', 'details', 'timestamp', 'path', 'requestId']) assert.ok(campo in res.body);
  });

  test('canalPedido ausente: 422 com detalhe do campo', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 1, itens: [{ produtoId: 1, quantidade: 1 }] });
    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'VALIDACAO_FALHOU');
    assert.equal(res.body.details[0].field, 'canalPedido');
  });

  test('canalPedido inválido e quantidade negativa: 422', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 1, canalPedido: 'DRONE', itens: [{ produtoId: 1, quantidade: -2 }] });
    assert.equal(res.status, 422);
    const campos = res.body.details.map((d) => d.field);
    assert.ok(campos.includes('canalPedido'));
    assert.ok(campos.includes('itens[0].quantidade'));
  });

  test('cliente não pode usar o canal BALCAO: 422', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 1, canalPedido: 'BALCAO', itens: [{ produtoId: 1, quantidade: 1 }] });
    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'CANAL_NAO_PERMITIDO');
  });

  test('produto fora do cardápio da unidade: 404', async () => {
    // Bolo de rolo (8) não é vendido em Fortaleza (unidade 2).
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 2, canalPedido: 'WEB', itens: [{ produtoId: 8, quantidade: 1 }] });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'PRODUTO_NAO_ENCONTRADO');
  });

  test('unidade inexistente: 404', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 999, canalPedido: 'APP', itens: [{ produtoId: 1, quantidade: 1 }] });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'UNIDADE_NAO_ENCONTRADA');
  });

  test('estoque insuficiente: 409 e nenhuma baixa parcial', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({
        unidadeId: 1,
        canalPedido: 'TOTEM',
        itens: [
          { produtoId: 1, quantidade: 1 },
          { produtoId: 8, quantidade: 5 },
        ],
      });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'ESTOQUE_INSUFICIENTE');
    assert.deepEqual(res.body.details, [{ field: 'itens[1].quantidade', issue: 'Disponível: 3' }]);

    const tapioca = await prisma.estoque.findUnique({ where: { unidadeId_produtoId: { unidadeId: 1, produtoId: 1 } } });
    assert.equal(tapioca.quantidade, 50, 'a transação deve desfazer a baixa do item 0');
  });

  test('cupom expirado: 422 PROMOCAO_INVALIDA', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 1, canalPedido: 'APP', itens: [{ produtoId: 1, quantidade: 1 }], codigoPromocao: 'SAOJOAO2025' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'PROMOCAO_INVALIDA');
  });

  test('resgate de pontos sem consentimento de fidelidade: 422', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokens.joao))
      .send({ unidadeId: 1, canalPedido: 'APP', itens: [{ produtoId: 1, quantidade: 1 }], pontosResgatar: 10 });
    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'CONSENTIMENTO_FIDELIDADE_AUSENTE');
  });

  test('cliente não vê pedido de outro cliente (404)', async () => {
    const criado = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 1, canalPedido: 'APP', itens: [{ produtoId: 2, quantidade: 1 }] });
    const res = await api().get(`/pedidos/${criado.body.id}`).set(bearer(tokens.joao));
    assert.equal(res.status, 404);
  });

  test('gerente de outra unidade não lista pedidos de Recife (403)', async () => {
    const res = await api().get('/pedidos?unidadeId=1').set(bearer(tokens.gerenteFortaleza));
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'ACESSO_UNIDADE_NEGADO');
  });

  test('gateway fora do ar: 503 e pedido continua aguardando pagamento', async () => {
    const criado = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 1, canalPedido: 'PICKUP', itens: [{ produtoId: 3, quantidade: 1 }] });
    const res = await api()
      .post('/pagamentos')
      .set(bearer(tokens.maria))
      .send({ pedidoId: criado.body.id, metodo: 'CARTAO_DEBITO', tokenPagamento: 'tok_indisponivel' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'GATEWAY_PAGAMENTO_INDISPONIVEL');

    const pedido = await api().get(`/pedidos/${criado.body.id}`).set(bearer(tokens.maria));
    assert.equal(pedido.body.status, 'AGUARDANDO_PAGAMENTO');
    assert.equal(pedido.body.pagamentos[0].status, 'ERRO');
  });

  test('cliente não pode pagar em DINHEIRO (exclusivo do caixa): 422', async () => {
    const criado = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 1, canalPedido: 'APP', itens: [{ produtoId: 7, quantidade: 1 }] });
    const res = await api()
      .post('/pagamentos')
      .set(bearer(tokens.maria))
      .send({ pedidoId: criado.body.id, metodo: 'DINHEIRO' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'METODO_NAO_PERMITIDO');
  });
});

describe('Cancelamento com estorno', () => {
  let tokens;

  before(async () => {
    await resetarBanco();
    tokens = await obterTokens();
  });

  test('gerente cancela pedido pago: estorno, devolução de estoque e de pontos', async () => {
    const criado = await api()
      .post('/pedidos')
      .set(bearer(tokens.maria))
      .send({ unidadeId: 1, canalPedido: 'APP', itens: [{ produtoId: 3, quantidade: 2 }], pontosResgatar: 50 });
    assert.equal(criado.status, 201);
    assert.equal(criado.body.total, 60.8); // 65,80 - 5,00 em pontos
    const pedidoId = criado.body.id;

    await api().post('/pagamentos').set(bearer(tokens.maria)).send({ pedidoId, metodo: 'PIX' }).expect(201);

    const semMotivo = await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(tokens.gerente)).send({ status: 'CANCELADO' });
    assert.equal(semMotivo.status, 422);
    assert.equal(semMotivo.body.error, 'MOTIVO_OBRIGATORIO');

    const cliente = await api()
      .patch(`/pedidos/${pedidoId}/status`)
      .set(bearer(tokens.maria))
      .send({ status: 'CANCELADO', motivo: 'Desisti' });
    assert.equal(cliente.status, 403, 'cliente não cancela pedido já em preparo');

    const res = await api()
      .patch(`/pedidos/${pedidoId}/status`)
      .set(bearer(tokens.gerente))
      .send({ status: 'CANCELADO', motivo: 'Falta de gás na cozinha' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'CANCELADO');
    assert.equal(res.body.pagamentos[0].status, 'ESTORNADO');

    const estoque = await prisma.estoque.findUnique({ where: { unidadeId_produtoId: { unidadeId: 1, produtoId: 3 } } });
    assert.equal(estoque.quantidade, 30);

    const saldo = await api().get('/fidelidade/saldo').set(bearer(tokens.maria));
    assert.equal(saldo.body.saldoPontos, 150, 'pontos resgatados voltam e os acumulados saem');

    const auditoria = await api().get(`/auditoria?entidade=Pedido&entidadeId=${pedidoId}`).set(bearer(tokens.admin));
    assert.ok(auditoria.body.data.some((l) => l.acao === 'PEDIDO_CANCELADO'));
  });
});
