const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  buscarPorCodigo: (codigo) => db.promocao.findUnique({ where: { codigo } }),

  criar: (dados) => db.promocao.create({ data: dados }),

  listarVigentes({ unidadeId, agora = new Date() }) {
    const where = { ativa: true, inicio: { lte: agora }, fim: { gte: agora } };
    if (unidadeId) where.OR = [{ unidadeId: null }, { unidadeId }];
    return db.promocao.findMany({ where, orderBy: { id: 'asc' } });
  },
});
