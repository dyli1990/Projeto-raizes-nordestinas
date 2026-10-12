const { prisma } = require('../database/prisma');

module.exports = (db = prisma) => ({
  buscarConta: (usuarioId) => db.contaFidelidade.findUnique({ where: { usuarioId } }),

  garantirConta: (usuarioId) =>
    db.contaFidelidade.upsert({ where: { usuarioId }, create: { usuarioId }, update: {} }),

  // Lançamento = linha no extrato + atualização do saldo (na transação do chamador).
  async lancar({ contaId, tipo, pontos, descricao, pedidoId }) {
    const transacao = await db.transacaoFidelidade.create({
      data: { contaId, tipo, pontos, descricao, pedidoId },
    });
    const conta = await db.contaFidelidade.update({
      where: { id: contaId },
      data: { saldoPontos: { increment: pontos } },
    });
    return { transacao, conta };
  },

  buscarLancamentosDoPedido: (pedidoId) => db.transacaoFidelidade.findMany({ where: { pedidoId } }),

  async listarTransacoes(contaId, { skip, take }) {
    const where = { contaId };
    const [itens, total] = await Promise.all([
      db.transacaoFidelidade.findMany({ where, skip, take, orderBy: { id: 'desc' } }),
      db.transacaoFidelidade.count({ where }),
    ]);
    return { itens, total };
  },
});
