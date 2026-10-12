const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const { ConflictError, BusinessRuleError } = require('../domain/errors');
const auditoria = require('./auditoria.service');
const { buscarUnidadeAtiva } = require('./unidades.service');

function listarVigentes({ unidadeId }) {
  return repos.promocoes().listarVigentes({ unidadeId });
}

async function criarPromocao(ator, ctx, dados) {
  if (dados.fim <= dados.inicio) {
    throw new BusinessRuleError('PERIODO_INVALIDO', 'A data final deve ser posterior à inicial.', [
      { field: 'fim', issue: 'Deve ser maior que "inicio".' },
    ]);
  }
  if (dados.unidadeId) await buscarUnidadeAtiva(dados.unidadeId);
  if (await repos.promocoes().buscarPorCodigo(dados.codigo)) {
    throw new ConflictError('PROMOCAO_JA_EXISTE', `Já existe uma promoção com o código ${dados.codigo}.`, [
      { field: 'codigo', issue: 'Código já utilizado.' },
    ]);
  }

  return transaction(async (tx) => {
    const promocao = await repos.promocoes(tx).criar(dados);
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.PROMOCAO_CRIADA,
      entidade: 'Promocao',
      entidadeId: promocao.id,
      detalhes: { codigo: promocao.codigo },
    });
    return promocao;
  });
}

module.exports = { listarVigentes, criarPromocao };
