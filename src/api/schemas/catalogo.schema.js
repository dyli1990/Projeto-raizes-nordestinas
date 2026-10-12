const { z, id, idBody, paginacao, valorReais } = require('./comum');
const { TipoMovimentacao, TipoDesconto } = require('../../domain/enums');

const CATEGORIAS = ['LANCHES', 'PRATOS', 'BEBIDAS', 'SOBREMESAS'];

const texto = (min, max) => z.string().trim().min(min).max(max);

const unidade = z.object({
  nome: texto(3, 120),
  cidade: texto(2, 80),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'UF deve ter 2 letras.'),
  endereco: texto(5, 200),
});

const listarUnidades = z.object({
  cidade: z.string().trim().optional(),
  uf: z.string().trim().toUpperCase().optional(),
  ...paginacao,
});

const produto = z.object({
  nome: texto(3, 120),
  descricao: texto(0, 500).optional(),
  categoria: z.enum(CATEGORIAS),
  precoBase: valorReais,
});

const atualizarProduto = produto
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, { message: 'Informe ao menos um campo para atualizar.' });

const listarProdutos = z.object({
  categoria: z.enum(CATEGORIAS).optional(),
  busca: z.string().trim().max(60).optional(),
  ...paginacao,
});

const consultarCardapio = z.object({ categoria: z.enum(CATEGORIAS).optional() });

const paramsCardapio = z.object({ id, produtoId: id });

const itemCardapio = z.object({
  preco: valorReais,
  disponivel: z.boolean().default(true),
});

const movimentacao = z.object({
  unidadeId: idBody,
  produtoId: idBody,
  tipo: z.enum(Object.values(TipoMovimentacao)),
  quantidade: z.number().int('A quantidade deve ser inteira.').positive('A quantidade deve ser maior que zero.').max(10000),
  motivo: texto(3, 200),
});

const consultarEstoque = z.object({
  unidadeId: z.coerce.number().int().positive().optional(),
  produtoId: z.coerce.number().int().positive().optional(),
  ...paginacao,
});

const promocao = z
  .object({
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,30}$/, 'Use de 3 a 30 letras, números, "_" ou "-".'),
    descricao: texto(3, 200),
    tipoDesconto: z.enum(Object.values(TipoDesconto)),
    valor: valorReais,
    unidadeId: idBody.optional(),
    inicio: z.coerce.date(),
    fim: z.coerce.date(),
  })
  .refine((p) => p.tipoDesconto !== TipoDesconto.PERCENTUAL || (Number.isInteger(p.valor) && p.valor <= 100), {
    message: 'Para PERCENTUAL, informe um inteiro entre 1 e 100.',
    path: ['valor'],
  });

const listarPromocoes = z.object({ unidadeId: z.coerce.number().int().positive().optional() });

module.exports = {
  CATEGORIAS,
  unidade,
  listarUnidades,
  produto,
  atualizarProduto,
  listarProdutos,
  consultarCardapio,
  paramsCardapio,
  itemCardapio,
  movimentacao,
  consultarEstoque,
  promocao,
  listarPromocoes,
};
