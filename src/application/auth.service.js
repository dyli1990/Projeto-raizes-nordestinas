const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const { gerarHash, comparar, HASH_FICTICIO } = require('../infrastructure/security/password');
const { emitirToken } = require('../infrastructure/security/token');
const { Perfil, TipoConsentimento } = require('../domain/enums');
const { ConflictError, UnauthorizedError } = require('../domain/errors');
const { VERSAO_TERMO_ATUAL, mascararEmail } = require('../domain/privacidade');
const auditoria = require('./auditoria.service');

// Autocadastro de clientes (App/Web/Totem). Perfis de equipe são criados
// apenas pelo ADMIN em /usuarios.
async function registrarCliente({ nome, email, senha, telefone, consentimentos, canal }, ctx) {
  const existente = await repos.usuarios().buscarPorEmail(email);
  if (existente) {
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
      perfil: Perfil.CLIENTE,
    });

    for (const tipo of Object.values(TipoConsentimento)) {
      const concedido = tipo === TipoConsentimento.FIDELIDADE ? consentimentos.fidelidade : consentimentos.marketing;
      await repos.consentimentos(tx).registrar({
        usuarioId: usuario.id,
        tipo,
        concedido: Boolean(concedido),
        versaoTermo: VERSAO_TERMO_ATUAL,
        canal: canal || null,
      });
    }
    if (consentimentos.fidelidade) await repos.fidelidade(tx).garantirConta(usuario.id);

    await auditoria.registrar({
      db: tx,
      ator: usuario,
      ctx,
      acao: auditoria.Acao.USUARIO_CRIADO,
      entidade: 'Usuario',
      entidadeId: usuario.id,
      detalhes: { perfil: usuario.perfil, origem: 'AUTOCADASTRO', consentimentos },
    });
    return usuario;
  });
}

async function login({ email, senha }, ctx) {
  const usuario = await repos.usuarios().buscarPorEmail(email);
  // Compara mesmo quando o usuário não existe para manter tempo de resposta constante.
  const senhaConfere = await comparar(senha, usuario?.senhaHash || HASH_FICTICIO);

  if (!usuario || !senhaConfere || !usuario.ativo) {
    await auditoria.registrar({
      ator: usuario && usuario.ativo ? usuario : null,
      ctx,
      acao: auditoria.Acao.LOGIN_FALHA,
      entidade: 'Usuario',
      entidadeId: usuario?.id,
      detalhes: { email: mascararEmail(email) },
    });
    // Mensagem genérica: não revela se o e-mail existe.
    throw new UnauthorizedError('CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.');
  }

  await auditoria.registrar({
    ator: usuario,
    ctx,
    acao: auditoria.Acao.LOGIN_SUCESSO,
    entidade: 'Usuario',
    entidadeId: usuario.id,
  });

  return { ...emitirToken(usuario), usuario };
}

module.exports = { registrarCliente, login };
