const { prisma } = require('../database/prisma');

const DETALHES = {
  itens: { orderBy: { id: 'asc' } },
  historico: { orderBy: { id: 'asc' } },
  pagamentos: { orderBy: { id: 'asc' } },
  unidade: true,
};

module.exports = (db = prisma) => ({
  criar: ({ itens, ...dados }) =>
    db.pedido.create({ data: { ...dados, itens: { create: itens } }, include: DETALHES }),

  buscarPorId: (id) => db.pedido.findUnique({ where: { id }, include: DETALHES }),

  // Atualização condicional (compare-and-set): só altera se o status ainda
  // for o esperado. Protege contra duas operações concorrentes no mesmo pedido.
  async atualizarStatusSe(id, statusAtual, statusNovo) {
    const { count } = await db.pedido.updateMany({
      where: { id, status: statusAtual },
      data: { status: statusNovo },
    });
    return count === 1;
  },

  registrarHistorico: (dados) => db.historicoStatusPedido.create({ data: dados }),

  contarEmAndamentoDoCliente: (clienteId, statusEmAndamento) =>
    db.pedido.count({ where: { clienteId, status: { in: statusEmAndamento } } }),

  async listar({ filtros, skip, take }) {
    const [itens, total] = await Promise.all([
      db.pedido.findMany({
        where: filtros,
        skip,
        take,
        include: { itens: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'desc' },
      }),
      db.pedido.count({ where: filtros }),
    ]);
    return { itens, total };
  },

  listarDoCliente: (clienteId) =>
    db.pedido.findMany({ where: { clienteId }, include: { itens: true }, orderBy: { id: 'asc' } }),
});
