const { z, paginacao } = require('./comum');

const paginada = z.object({ ...paginacao });

const listarAuditoria = z.object({
  acao: z.string().trim().toUpperCase().optional(),
  entidade: z.string().trim().optional(),
  entidadeId: z.string().trim().optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  ...paginacao,
});

module.exports = { paginada, listarAuditoria };
