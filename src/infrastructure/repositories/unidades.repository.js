const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  buscarPorId: (id) => db.unidade.findUnique({ where: { id } }),

  criar: (dados) => db.unidade.create({ data: dados }),

  async listar({ cidade, uf, skip, take }) {
    const where = { ativa: true };
    if (cidade) where.cidade = cidade;
    if (uf) where.uf = uf;
    const [itens, total] = await Promise.all([
      db.unidade.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      db.unidade.count({ where }),
    ]);
    return { itens, total };
  },
});
