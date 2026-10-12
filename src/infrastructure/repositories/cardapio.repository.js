const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  async listarPorUnidade(unidadeId, { categoria } = {}) {
    const where = { unidadeId, produto: { ativo: true } };
    if (categoria) where.produto.categoria = categoria;
    const [itens, estoques] = await Promise.all([
      db.itemCardapio.findMany({ where, include: { produto: true }, orderBy: { produtoId: 'asc' } }),
      db.estoque.findMany({ where: { unidadeId } }),
    ]);
    const saldo = new Map(estoques.map((e) => [e.produtoId, e.quantidade]));
    return itens.map((item) => ({ ...item, quantidadeEstoque: saldo.get(item.produtoId) ?? 0 }));
  },

  buscarItens: (unidadeId, produtoIds) =>
    db.itemCardapio.findMany({
      where: { unidadeId, produtoId: { in: produtoIds } },
      include: { produto: true },
    }),

  salvar: (unidadeId, produtoId, dados) =>
    db.itemCardapio.upsert({
      where: { unidadeId_produtoId: { unidadeId, produtoId } },
      create: { unidadeId, produtoId, ...dados },
      update: dados,
      include: { produto: true },
    }),
});
