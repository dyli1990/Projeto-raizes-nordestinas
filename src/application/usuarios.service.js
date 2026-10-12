const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const { gerarHash } = require('../infrastructure/security/password');
const { PERFIS_DE_UNIDADE } = require('../domain/enums');
const { ConflictError, NotFoundError, BusinessRuleError } = require('../domain/errors');
const auditoria = require('./auditoria.service');
const { paginar } = require('./paginacao');

// Criação de usuários da equipe (e de clientes no balcão) pelo ADMIN.
async function criarUsuario(ator, ctx, { nome, email, senha, telefone, perfil, unidadeId }) {
  if (PERFIS_DE_UNIDADE.includes(perfil) && !unidadeId) {
    throw new BusinessRuleError('UNIDADE_OBRIGATORIA', `O perfil ${perfil} precisa estar vinculado a uma unidade.`, [
      { field: 'unidadeId', issue: 'Obrigatório para GERENTE, ATENDENTE e COZINHA.' },
    ]);
  }
  if (unidadeId) {
    const unidade = await repos.unidades().buscarPorId(unidadeId);
    if (!unidade) throw new NotFoundError('UNIDADE_NAO_ENCONTRADA', `Unidade ${unidadeId} não encontrada.`);
  }
  if (await repos.usuarios().buscarPorEmail(email)) {
    throw new ConflictError('EMAIL_JA_CADASTRADO', 'Já existe uma conta com este e-mail.', [
      { field: 'email', issue: 'E-mail já cadastrado.' },
    ]);
  }

  const senhaHash = await gerarHash(senha);
  return transaction(async (tx) => {
    const usuario = await repos.usuarios(tx).criar({
      nome,
      email,
      telefone: telefone || null,
      senhaHash,
      perfil,
      unidadeId: PERFIS_DE_UNIDADE.includes(perfil) ? unidadeId : null,
    });
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.USUARIO_CRIADO,
      entidade: 'Usuario',
      entidadeId: usuario.id,
      detalhes: { perfil, unidadeId: usuario.unidadeId },
    });
    return usuario;
  });
}

async function listarUsuarios(ator, ctx, filtros) {
  const resultado = await repos.usuarios().listar({ ...filtros, ...paginar(filtros) });
  // Listagem de dados pessoais por um administrador também é auditada (LGPD).
  await auditoria.registrar({
    ator,
    ctx,
    acao: auditoria.Acao.DADOS_PESSOAIS_CONSULTADOS,
    entidade: 'Usuario',
    detalhes: { filtros: { perfil: filtros.perfil, unidadeId: filtros.unidadeId }, quantidade: resultado.itens.length },
  });
  return resultado;
}

async function buscarPerfil(usuarioId) {
  const usuario = await repos.usuarios().buscarPorId(usuarioId);
  if (!usuario) throw new NotFoundError('USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
  return usuario;
}

module.exports = { criarUsuario, listarUsuarios, buscarPerfil };
