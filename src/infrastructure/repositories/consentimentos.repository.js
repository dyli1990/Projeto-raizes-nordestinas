const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  registrar: (dados) => db.consentimento.create({ data: dados }),

  listarPorUsuario: (usuarioId) =>
    db.consentimento.findMany({ where: { usuarioId }, orderBy: { id: 'asc' } }),

  // Estado atual = registro mais recente de cada tipo.
  async atuais(usuarioId) {
    const registros = await db.consentimento.findMany({
      where: { usuarioId },
      orderBy: { id: 'desc' },
    });
    const atuais = {};
    for (const registro of registros) {
      if (!atuais[registro.tipo]) atuais[registro.tipo] = registro;
    }
    return atuais;
  },
});
