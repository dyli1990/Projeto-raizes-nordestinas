const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  criar: (dados) => db.pagamento.create({ data: dados }),

  buscarPorId: (id) => db.pagamento.findUnique({ where: { id }, include: { pedido: true } }),

  buscarPorIdempotencyKey: (idempotencyKey) =>
    db.pagamento.findUnique({ where: { idempotencyKey }, include: { pedido: true } }),

  buscarAprovadoDoPedido: (pedidoId) =>
    db.pagamento.findFirst({ where: { pedidoId, status: 'APROVADO' } }),

  atualizar: (id, dados) =>
    db.pagamento.update({ where: { id }, data: dados, include: { pedido: true } }),
});
