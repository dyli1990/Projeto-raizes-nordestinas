const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  buscar: (unidadeId, produtoId) =>
    db.estoque.findUnique({ where: { unidadeId_produtoId: { unidadeId, produtoId } } }),

  garantir: (unidadeId, produtoId) =>
    db.estoque.upsert({
      where: { unidadeId_produtoId: { unidadeId, produtoId } },
      create: { unidadeId, produtoId, quantidade: 0 },
      update: {},
    }),

  // Baixa atômica: só decrementa se houver saldo suficiente. Evita vender
  // além do estoque mesmo com pedidos simultâneos (horário de pico).
  async baixarSeDisponivel(unidadeId, produtoId, quantidade) {
    const { count } = await db.estoque.updateMany({
      where: { unidadeId, produtoId, quantidade: { gte: quantidade } },
      data: { quantidade: { decrement: quantidade } },
    });
    return count === 1;
  },

  incrementar: (unidadeId, produtoId, quantidade) =>
    db.estoque.upsert({
      where: { unidadeId_produtoId: { unidadeId, produtoId } },
      create: { unidadeId, produtoId, quantidade },
      update: { quantidade: { increment: quantidade } },
    }),

  registrarMovimentacao: (dados) => db.movimentacaoEstoque.create({ data: dados }),

  async listar({ unidadeId, produtoId, skip, take }) {
    const where = {};
    if (unidadeId) where.unidadeId = unidadeId;
    if (produtoId) where.produtoId = produtoId;
    const [itens, total] = await Promise.all([
      db.estoque.findMany({
        where,
        skip,
        take,
        include: { produto: true, unidade: true },
        orderBy: [{ unidadeId: 'asc' }, { produtoId: 'asc' }],
      }),
      db.estoque.count({ where }),
    ]);
    return { itens, total };
  },

  async listarMovimentacoes({ unidadeId, produtoId, skip, take }) {
    const where = { estoque: {} };
    if (unidadeId) where.estoque.unidadeId = unidadeId;
    if (produtoId) where.estoque.produtoId = produtoId;
    const [itens, total] = await Promise.all([
      db.movimentacaoEstoque.findMany({
        where,
        skip,
        take,
        include: { estoque: { include: { produto: true } } },
        orderBy: { id: 'desc' },
      }),
      db.movimentacaoEstoque.count({ where }),
    ]);
    return { itens, total };
  },
});
