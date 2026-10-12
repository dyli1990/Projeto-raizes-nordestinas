const { paraReais } = require('../../domain/money');
const { metadados } = require('../../application/paginacao');

// Presenters: definem EXATAMENTE quais campos saem da API (lista branca).
// Assim, campos internos como senhaHash nunca são serializados por engano,
// e valores em centavos são convertidos para reais.

const usuario = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  telefone: u.telefone,
  perfil: u.perfil,
  unidadeId: u.unidadeId,
  ativo: u.ativo,
  createdAt: u.createdAt,
});

const usuarioResumo = (u) => ({ id: u.id, nome: u.nome, perfil: u.perfil, unidadeId: u.unidadeId });

const unidade = (u) => ({
  id: u.id,
  nome: u.nome,
  cidade: u.cidade,
  uf: u.uf,
  endereco: u.endereco,
  ativa: u.ativa,
});

const produto = (p) => ({
  id: p.id,
  nome: p.nome,
  descricao: p.descricao,
  categoria: p.categoria,
  precoBase: paraReais(p.precoBaseCentavos),
  ativo: p.ativo,
});

const itemCardapio = (i) => ({
  produtoId: i.produtoId,
  nome: i.produto.nome,
  descricao: i.produto.descricao,
  categoria: i.produto.categoria,
  preco: paraReais(i.precoCentavos),
  // Disponível = liberado pela unidade E com saldo em estoque.
  disponivel: i.disponivel && i.quantidadeEstoque > 0,
});

const estoque = (e) => ({
  id: e.id,
  unidadeId: e.unidadeId,
  unidade: e.unidade?.nome,
  produtoId: e.produtoId,
  produto: e.produto?.nome,
  quantidade: e.quantidade,
  atualizadoEm: e.updatedAt,
});

const movimentacao = (m) => ({
  id: m.id,
  estoqueId: m.estoqueId,
  unidadeId: m.estoque?.unidadeId,
  produtoId: m.estoque?.produtoId,
  produto: m.estoque?.produto?.nome,
  tipo: m.tipo,
  origem: m.origem,
  quantidade: m.quantidade,
  saldoApos: m.saldoApos,
  motivo: m.motivo,
  pedidoId: m.pedidoId,
  usuarioId: m.usuarioId,
  createdAt: m.createdAt,
});

const promocao = (p) => ({
  id: p.id,
  codigo: p.codigo,
  descricao: p.descricao,
  tipoDesconto: p.tipoDesconto,
  valor: p.tipoDesconto === 'VALOR_FIXO' ? paraReais(p.valor) : p.valor,
  unidadeId: p.unidadeId,
  inicio: p.inicio,
  fim: p.fim,
  ativa: p.ativa,
});

function lerJson(texto) {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

const pagamento = (p) => ({
  id: p.id,
  pedidoId: p.pedidoId,
  metodo: p.metodo,
  status: p.status,
  valor: paraReais(p.valorCentavos),
  transacaoExternaId: p.transacaoExternaId,
  motivoRecusa: p.motivoRecusa,
  tentativasGateway: p.tentativasGateway,
  gateway: lerJson(p.respostaGateway),
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const pedido = (p) => ({
  id: p.id,
  unidadeId: p.unidadeId,
  unidade: p.unidade?.nome,
  canalPedido: p.canalPedido,
  status: p.status,
  clienteId: p.clienteId,
  operadorId: p.operadorId,
  itens: (p.itens || []).map((i) => ({
    produtoId: i.produtoId,
    nome: i.nomeProduto,
    quantidade: i.quantidade,
    precoUnitario: paraReais(i.precoUnitarioCentavos),
    subtotal: paraReais(i.subtotalCentavos),
  })),
  subtotal: paraReais(p.subtotalCentavos),
  desconto: paraReais(p.descontoCentavos),
  total: paraReais(p.totalCentavos),
  pontosResgatados: p.pontosResgatados,
  promocaoId: p.promocaoId,
  observacao: p.observacao,
  ...(p.historico && {
    historico: p.historico.map((h) => ({
      statusAnterior: h.statusAnterior,
      statusNovo: h.statusNovo,
      motivo: h.motivo,
      usuarioId: h.usuarioId,
      data: h.createdAt,
    })),
  }),
  ...(p.pagamentos && { pagamentos: p.pagamentos.map(pagamento) }),
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const MENSAGENS_PAGAMENTO = {
  APROVADO: 'Pagamento aprovado. Pedido enviado para a cozinha (EM_PREPARO).',
  RECUSADO: 'Pagamento recusado pela operadora. O pedido continua AGUARDANDO_PAGAMENTO; tente outro meio de pagamento.',
  ESTORNADO: 'Pagamento estornado.',
  ERRO: 'Falha de comunicação com o gateway. Tente novamente.',
  PENDENTE: 'Pagamento em processamento.',
};

const resultadoPagamento = ({ pagamento: pag, pedido: ped }) => ({
  ...pagamento(pag),
  pedido: { id: ped.id, status: ped.status, total: paraReais(ped.totalCentavos) },
  mensagem: MENSAGENS_PAGAMENTO[pag.status],
});

const transacaoFidelidade = (t) => ({
  id: t.id,
  tipo: t.tipo,
  pontos: t.pontos,
  descricao: t.descricao,
  pedidoId: t.pedidoId,
  data: t.createdAt,
});

const logAuditoria = (l) => ({
  id: l.id,
  acao: l.acao,
  entidade: l.entidade,
  entidadeId: l.entidadeId,
  usuarioId: l.usuarioId,
  detalhes: lerJson(l.detalhes),
  ip: l.ip,
  requestId: l.requestId,
  data: l.createdAt,
});

const paginado = ({ itens, total }, filtros, mapear) => ({
  data: itens.map(mapear),
  meta: metadados(filtros, total),
});

module.exports = {
  usuario,
  usuarioResumo,
  unidade,
  produto,
  itemCardapio,
  estoque,
  movimentacao,
  promocao,
  pagamento,
  pedido,
  resultadoPagamento,
  transacaoFidelidade,
  logAuditoria,
  paginado,
};
