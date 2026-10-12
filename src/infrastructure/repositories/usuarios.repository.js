const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  buscarPorEmail: (email) => db.usuario.findUnique({ where: { email } }),

  buscarPorId: (id) => db.usuario.findUnique({ where: { id } }),

  criar: (dados) => db.usuario.create({ data: dados }),

  atualizar: (id, dados) => db.usuario.update({ where: { id }, data: dados }),

  async listar({ perfil, unidadeId, skip, take }) {
    const where = { anonimizadoEm: null };
    if (perfil) where.perfil = perfil;
    if (unidadeId) where.unidadeId = unidadeId;
    const [itens, total] = await Promise.all([
      db.usuario.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      db.usuario.count({ where }),
    ]);
    return { itens, total };
  },
});
