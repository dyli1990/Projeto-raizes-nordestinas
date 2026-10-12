const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const { TipoMovimentacao, OrigemMovimentacao } = require('../domain/enums');
const { ConflictError, NotFoundError, ForbiddenError } = require('../domain/errors');
const { ehAdmin, garantirAcessoUnidade } = require('../domain/acesso');
const auditoria = require('./auditoria.service');
const { buscarUnidadeAtiva } = require('./unidades.service');
const { paginar } = require('./paginacao');

// Equipe de unidade só enxerga o próprio estoque; ADMIN vê a rede toda.
function escopoDeUnidade(ator, unidadeIdFiltro) {
  if (ehAdmin(ator)) return unidadeIdFiltro;
  if (unidadeIdFiltro && unidadeIdFiltro !== ator.unidadeId) {
    throw new ForbiddenError('ACESSO_UNIDADE_NEGADO', 'Usuário sem acesso a esta unidade.', [
      { field: 'unidadeId', issue: `Unidade ${unidadeIdFiltro} não pertence ao seu escopo.` },
    ]);
  }
  return ator.unidadeId;
}

function consultarSaldos(ator, filtros) {
  const unidadeId = escopoDeUnidade(ator, filtros.unidadeId);
  return repos.estoque().listar({ ...filtros, unidadeId, ...paginar(filtros) });
}

function listarMovimentacoes(ator, filtros) {
  const unidadeId = escopoDeUnidade(ator, filtros.unidadeId);
  return repos.estoque().listarMovimentacoes({ ...filtros, unidadeId, ...paginar(filtros) });
}

// Entrada (compra/reposição) ou saída manual (perda, consumo interno).
async function movimentar(ator, ctx, { unidadeId, produtoId, tipo, quantidade, motivo }) {
  await buscarUnidadeAtiva(unidadeId);
  garantirAcessoUnidade(ator, unidadeId);
  const produto = await repos.produtos().buscarPorId(produtoId);
  if (!produto) throw new NotFoundError('PRODUTO_NAO_ENCONTRADO', `Produto ${produtoId} não encontrado.`);

  return transaction(async (tx) => {
    const estoqueRepo = repos.estoque(tx);
    let estoque;

    if (tipo === TipoMovimentacao.ENTRADA) {
      estoque = await estoqueRepo.incrementar(unidadeId, produtoId, quantidade);
    } else {
      const baixou = await estoqueRepo.baixarSeDisponivel(unidadeId, produtoId, quantidade);
      const atual = await estoqueRepo.buscar(unidadeId, produtoId);
      if (!baixou) {
        throw new ConflictError('ESTOQUE_INSUFICIENTE', 'Saída maior que o saldo disponível.', [
          { field: 'quantidade', issue: `Disponível: ${atual?.quantidade ?? 0}` },
        ]);
      }
      estoque = atual;
    }

    const movimentacao = await estoqueRepo.registrarMovimentacao({
      estoqueId: estoque.id,
      tipo,
      origem: OrigemMovimentacao.MANUAL,
      quantidade,
      saldoApos: estoque.quantidade,
      motivo,
      usuarioId: ator.id,
    });

    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.ESTOQUE_MOVIMENTADO,
      entidade: 'Estoque',
      entidadeId: estoque.id,
      detalhes: { unidadeId, produtoId, tipo, quantidade, saldoApos: estoque.quantidade },
    });

    return { movimentacao, estoque, produto };
  });
}

module.exports = { consultarSaldos, listarMovimentacoes, movimentar };
