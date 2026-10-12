const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  registrar: (dados) => db.logAuditoria.create({ data: dados }),

  async listar({ acao, entidade, entidadeId, usuarioId, skip, take }) {
    const where = {};
    if (acao) where.acao = acao;
    if (entidade) where.entidade = entidade;
    if (entidadeId) where.entidadeId = String(entidadeId);
    if (usuarioId) where.usuarioId = usuarioId;
    const [itens, total] = await Promise.all([
      db.logAuditoria.findMany({ where, skip, take, orderBy: { id: 'desc' } }),
      db.logAuditoria.count({ where }),
    ]);
    return { itens, total };
  },
});
