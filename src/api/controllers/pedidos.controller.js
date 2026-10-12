const pedidosService = require('../../application/pedidos.service');
const pagamentosService = require('../../application/pagamentos.service');
const fidelidadeService = require('../../application/fidelidade.service');
const auditoriaService = require('../../application/auditoria.service');
const { paraReais } = require('../../domain/money');
const { BadRequestError } = require('../../domain/errors');
const { idempotencyKey: idempotencyKeySchema } = require('../schemas/pedidos.schema');
const { formatarIssues } = require('../middlewares/validate');
const present = require('../presenters');
const { contexto } = require('../middlewares/request-context');

// ----- Pedidos --------------------------------------------------------------

async function criarPedido(req, res) {
  const pedido = await pedidosService.criarPedido(req.user, contexto(req), req.valid.body);
  res.status(201).location(`/pedidos/${pedido.id}`).json(present.pedido(pedido));
}

async function listarPedidos(req, res) {
  const filtros = req.valid.query;
  const resultado = await pedidosService.listarPedidos(req.user, filtros);
  res.json(present.paginado(resultado, filtros, present.pedido));
}

async function obterPedido(req, res) {
  res.json(present.pedido(await pedidosService.obterPedido(req.user, req.valid.params.id)));
}

async function atualizarStatus(req, res) {
  const pedido = await pedidosService.atualizarStatus(req.user, contexto(req), req.valid.params.id, req.valid.body);
  res.json(present.pedido(pedido));
}

// ----- Pagamentos -----------------------------------------------------------

async function solicitarPagamento(req, res) {
  const chave = idempotencyKeySchema.safeParse(req.get('Idempotency-Key') || undefined);
  if (!chave.success) {
    throw new BadRequestError(
      'PARAMETRO_INVALIDO',
      'Cabeçalho Idempotency-Key inválido.',
      formatarIssues(chave.error.issues).map((d) => ({ ...d, field: 'Idempotency-Key' }))
    );
  }

  const resultado = await pagamentosService.solicitarPagamento(req.user, contexto(req), {
    ...req.valid.body,
    idempotencyKey: chave.data,
  });

  if (resultado.reprocessado) res.set('Idempotent-Replayed', 'true');
  res
    .status(resultado.reprocessado ? 200 : 201)
    .location(`/pagamentos/${resultado.pagamento.id}`)
    .json(present.resultadoPagamento(resultado));
}

async function obterPagamento(req, res) {
  res.json(present.pagamento(await pagamentosService.obterPagamento(req.user, req.valid.params.id)));
}

// ----- Fidelidade -----------------------------------------------------------

async function saldoFidelidade(req, res) {
  const saldo = await fidelidadeService.consultarSaldo(req.user.id);
  res.json({
    saldoPontos: saldo.saldoPontos,
    equivalenteEmReais: paraReais(saldo.equivalenteEmCentavos),
    consentimentoAtivo: saldo.consentimentoAtivo,
    regras: {
      acumulo: '1 ponto a cada R$ 1,00 pago',
      resgate: '10 pontos = R$ 1,00 de desconto (informe pontosResgatar ao criar o pedido)',
    },
  });
}

async function extratoFidelidade(req, res) {
  const filtros = req.valid.query;
  const resultado = await fidelidadeService.extrato(req.user.id, filtros);
  res.json(present.paginado(resultado, filtros, present.transacaoFidelidade));
}

// ----- Auditoria ------------------------------------------------------------

async function listarAuditoria(req, res) {
  const filtros = req.valid.query;
  res.json(present.paginado(await auditoriaService.listar(filtros), filtros, present.logAuditoria));
}

module.exports = {
  criarPedido,
  listarPedidos,
  obterPedido,
  atualizarStatus,
  solicitarPagamento,
  obterPagamento,
  saldoFidelidade,
  extratoFidelidade,
  listarAuditoria,
};
