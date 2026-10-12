const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const { NotFoundError } = require('../domain/errors');
const auditoria = require('./auditoria.service');
const { paginar } = require('./paginacao');

async function buscarProduto(id) {
  const produto = await repos.produtos().buscarPorId(id);
  if (!produto || !produto.ativo) {
    throw new NotFoundError('PRODUTO_NAO_ENCONTRADO', `Produto ${id} não encontrado.`);
  }
  return produto;
}

function listarProdutos(filtros) {
  return repos.produtos().listar({ ...filtros, ...paginar(filtros) });
}

function criarProduto(ator, ctx, dados) {
  return transaction(async (tx) => {
    const produto = await repos.produtos(tx).criar(dados);
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.PRODUTO_CRIADO,
      entidade: 'Produto',
      entidadeId: produto.id,
    });
    return produto;
  });
}

async function atualizarProduto(ator, ctx, id, dados) {
  await buscarProduto(id);
  return transaction(async (tx) => {
    const produto = await repos.produtos(tx).atualizar(id, dados);
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.PRODUTO_ATUALIZADO,
      entidade: 'Produto',
      entidadeId: id,
      detalhes: { campos: Object.keys(dados) },
    });
    return produto;
  });
}

// Exclusão lógica: o produto sai do catálogo, mas o histórico de pedidos
// que o referenciam continua íntegro.
async function desativarProduto(ator, ctx, id) {
  await buscarProduto(id);
  await transaction(async (tx) => {
    await repos.produtos(tx).atualizar(id, { ativo: false });
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.PRODUTO_DESATIVADO,
      entidade: 'Produto',
      entidadeId: id,
    });
  });
}

module.exports = { buscarProduto, listarProdutos, criarProduto, atualizarProduto, desativarProduto };
