const unidadesService = require('../../application/unidades.service');
const produtosService = require('../../application/produtos.service');
const estoqueService = require('../../application/estoque.service');
const promocoesService = require('../../application/promocoes.service');
const { paraCentavos } = require('../../domain/money');
const { TipoDesconto } = require('../../domain/enums');
const present = require('../presenters');
const { contexto } = require('../middlewares/request-context');

// ----- Unidades e cardápio --------------------------------------------------

async function listarUnidades(req, res) {
  const filtros = req.valid.query;
  res.json(present.paginado(await unidadesService.listarUnidades(filtros), filtros, present.unidade));
}

async function obterUnidade(req, res) {
  res.json(present.unidade(await unidadesService.buscarUnidadeAtiva(req.valid.params.id)));
}

async function criarUnidade(req, res) {
  const unidade = await unidadesService.criarUnidade(req.user, contexto(req), req.valid.body);
  res.status(201).location(`/unidades/${unidade.id}`).json(present.unidade(unidade));
}

async function consultarCardapio(req, res) {
  const { unidade, itens } = await unidadesService.consultarCardapio(req.valid.params.id, req.valid.query);
  res.json({ unidade: present.unidade(unidade), itens: itens.map(present.itemCardapio) });
}

async function salvarItemCardapio(req, res) {
  const { id: unidadeId, produtoId } = req.valid.params;
  const { preco, disponivel } = req.valid.body;
  const item = await unidadesService.salvarItemCardapio(req.user, contexto(req), {
    unidadeId,
    produtoId,
    precoCentavos: paraCentavos(preco),
    disponivel,
  });
  res.json(present.itemCardapio(item));
}

// ----- Produtos (catálogo da matriz) ----------------------------------------

function dadosProduto({ precoBase, ...resto }) {
  return precoBase === undefined ? resto : { ...resto, precoBaseCentavos: paraCentavos(precoBase) };
}

async function listarProdutos(req, res) {
  const filtros = req.valid.query;
  res.json(present.paginado(await produtosService.listarProdutos(filtros), filtros, present.produto));
}

async function obterProduto(req, res) {
  res.json(present.produto(await produtosService.buscarProduto(req.valid.params.id)));
}

async function criarProduto(req, res) {
  const produto = await produtosService.criarProduto(req.user, contexto(req), dadosProduto(req.valid.body));
  res.status(201).location(`/produtos/${produto.id}`).json(present.produto(produto));
}

async function atualizarProduto(req, res) {
  const produto = await produtosService.atualizarProduto(
    req.user,
    contexto(req),
    req.valid.params.id,
    dadosProduto(req.valid.body)
  );
  res.json(present.produto(produto));
}

async function desativarProduto(req, res) {
  await produtosService.desativarProduto(req.user, contexto(req), req.valid.params.id);
  res.status(204).end();
}

// ----- Estoque por unidade --------------------------------------------------

async function consultarEstoque(req, res) {
  const filtros = req.valid.query;
  res.json(present.paginado(await estoqueService.consultarSaldos(req.user, filtros), filtros, present.estoque));
}

async function movimentarEstoque(req, res) {
  const { movimentacao, estoque, produto } = await estoqueService.movimentar(req.user, contexto(req), req.valid.body);
  res.status(201).json({
    movimentacao: present.movimentacao({ ...movimentacao, estoque: { ...estoque, produto } }),
    saldoAtual: estoque.quantidade,
  });
}

async function listarMovimentacoes(req, res) {
  const filtros = req.valid.query;
  res.json(
    present.paginado(await estoqueService.listarMovimentacoes(req.user, filtros), filtros, present.movimentacao)
  );
}

// ----- Promoções ------------------------------------------------------------

async function listarPromocoes(req, res) {
  const promocoes = await promocoesService.listarVigentes(req.valid.query);
  res.json({ data: promocoes.map(present.promocao) });
}

async function criarPromocao(req, res) {
  const { valor, ...dados } = req.valid.body;
  const promocao = await promocoesService.criarPromocao(req.user, contexto(req), {
    ...dados,
    valor: dados.tipoDesconto === TipoDesconto.VALOR_FIXO ? paraCentavos(valor) : valor,
  });
  res.status(201).json(present.promocao(promocao));
}

module.exports = {
  listarUnidades,
  obterUnidade,
  criarUnidade,
  consultarCardapio,
  salvarItemCardapio,
  listarProdutos,
  obterProduto,
  criarProduto,
  atualizarProduto,
  desativarProduto,
  consultarEstoque,
  movimentarEstoque,
  listarMovimentacoes,
  listarPromocoes,
  criarPromocao,
};
