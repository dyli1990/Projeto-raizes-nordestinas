const { z, idBody, paginacao } = require('./comum');
const { CanalPedido, StatusPedido, MetodoPagamento } = require('../../domain/enums');

const CANAIS = Object.values(CanalPedido);

// canalPedido é obrigatório: o canal de origem é dado de domínio (multicanalidade).
const canalPedido = z.enum(CANAIS, {
  error: (issue) =>
    issue.input === undefined
      ? `canalPedido é obrigatório. Valores aceitos: ${CANAIS.join(', ')}.`
      : `canalPedido inválido. Valores aceitos: ${CANAIS.join(', ')}.`,
});

const criarPedido = z.object({
  unidadeId: idBody,
  canalPedido,
  clienteId: idBody.optional(),
  itens: z
    .array(
      z.object({
        produtoId: idBody,
        quantidade: z
          .number()
          .int('A quantidade deve ser um número inteiro.')
          .min(1, 'A quantidade deve ser no mínimo 1.')
          .max(50, 'A quantidade máxima por item é 50.'),
      })
    )
    .min(1, 'Informe ao menos um item.')
    .max(30, 'Máximo de 30 itens por pedido.'),
  codigoPromocao: z.string().trim().min(3).max(30).optional(),
  pontosResgatar: z.number().int().min(0).optional(),
  observacao: z.string().trim().max(200).optional(),
});

const listarPedidos = z.object({
  canalPedido: z.enum(CANAIS).optional(),
  status: z.enum(Object.values(StatusPedido)).optional(),
  unidadeId: z.coerce.number().int().positive().optional(),
  ...paginacao,
});

const atualizarStatus = z.object({
  status: z.enum(Object.values(StatusPedido)),
  motivo: z.string().trim().min(3, 'Descreva o motivo com ao menos 3 caracteres.').max(200).optional(),
});

const solicitarPagamento = z.object({
  pedidoId: idBody,
  metodo: z.enum(Object.values(MetodoPagamento)),
  // Token gerado pelo gateway no front-end (o back-end nunca recebe dados do cartão).
  tokenPagamento: z.string().trim().max(100).optional(),
});

const idempotencyKey = z
  .string()
  .regex(/^[\w-]{8,100}$/, 'Idempotency-Key deve ter de 8 a 100 caracteres (letras, números, "-" ou "_").')
  .optional();

module.exports = { criarPedido, listarPedidos, atualizarStatus, solicitarPagamento, idempotencyKey };
