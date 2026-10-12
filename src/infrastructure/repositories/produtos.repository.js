const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  buscarPorId: (id) => db.produto.findUnique({ where: { id } }),

  criar: (dados) => db.produto.create({ data: dados }),

  atualizar: (id, dados) => db.produto.update({ where: { id }, data: dados }),

  async listar({ categoria, busca, skip, take }) {
    const where = { ativo: true };
    if (categoria) where.categoria = categoria;
    if (busca) where.nome = { contains: busca };
    const [itens, total] = await Promise.all([
      db.produto.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      db.produto.count({ where }),
    ]);
    return { itens, total };
  },
});
