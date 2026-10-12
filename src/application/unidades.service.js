const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const { NotFoundError } = require('../domain/errors');
const { garantirAcessoUnidade } = require('../domain/acesso');
const auditoria = require('./auditoria.service');
const { paginar } = require('./paginacao');

async function buscarUnidadeAtiva(unidadeId) {
  const unidade = await repos.unidades().buscarPorId(unidadeId);
  if (!unidade || !unidade.ativa) {
    throw new NotFoundError('UNIDADE_NAO_ENCONTRADA', `Unidade ${unidadeId} não encontrada.`, [
      { field: 'unidadeId', issue: 'Unidade inexistente ou inativa.' },
    ]);
  }
  return unidade;
}

function listarUnidades(filtros) {
  return repos.unidades().listar({ ...filtros, ...paginar(filtros) });
}

async function criarUnidade(ator, ctx, dados) {
  return transaction(async (tx) => {
    const unidade = await repos.unidades(tx).criar(dados);
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.UNIDADE_CRIADA,
      entidade: 'Unidade',
      entidadeId: unidade.id,
    });
    return unidade;
  });
}

async function consultarCardapio(unidadeId, filtros) {
  const unidade = await buscarUnidadeAtiva(unidadeId);
  const itens = await repos.cardapio().listarPorUnidade(unidadeId, filtros);
  return { unidade, itens };
}

// Define preço/disponibilidade de um produto do catálogo nesta unidade.
async function salvarItemCardapio(ator, ctx, { unidadeId, produtoId, precoCentavos, disponivel }) {
  await buscarUnidadeAtiva(unidadeId);
  garantirAcessoUnidade(ator, unidadeId);
  const produto = await repos.produtos().buscarPorId(produtoId);
  if (!produto || !produto.ativo) {
    throw new NotFoundError('PRODUTO_NAO_ENCONTRADO', `Produto ${produtoId} não encontrado.`);
  }

  return transaction(async (tx) => {
    const item = await repos.cardapio(tx).salvar(unidadeId, produtoId, { precoCentavos, disponivel });
    const estoque = await repos.estoque(tx).garantir(unidadeId, produtoId);
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.CARDAPIO_ATUALIZADO,
      entidade: 'ItemCardapio',
      entidadeId: item.id,
      detalhes: { unidadeId, produtoId, precoCentavos, disponivel },
    });
    return { ...item, quantidadeEstoque: estoque.quantidade };
  });
}

module.exports = { buscarUnidadeAtiva, listarUnidades, criarUnidade, consultarCardapio, salvarItemCardapio };
