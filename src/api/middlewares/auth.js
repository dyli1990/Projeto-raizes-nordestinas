const { verificarToken } = require('../../infrastructure/security/token');
const repos = require('../../infrastructure/repositories');
const { UnauthorizedError, ForbiddenError } = require('../../domain/errors');

// Autenticação: exige "Authorization: Bearer <jwt>" válido e usuário ativo.
async function autenticar(req, res, next) {
  const cabecalho = req.get('Authorization') || '';
  const [tipo, token] = cabecalho.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new UnauthorizedError('TOKEN_AUSENTE', 'Envie o token de acesso no cabeçalho Authorization: Bearer <token>.');
  }

  let payload;
  try {
    payload = verificarToken(token);
  } catch (erro) {
    const expirado = erro.name === 'TokenExpiredError';
    throw new UnauthorizedError(
      expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO',
      expirado ? 'Token expirado. Faça login novamente.' : 'Token inválido.'
    );
  }

  // Consulta o banco para refletir desativação/anonimização imediatamente.
  const usuario = await repos.usuarios().buscarPorId(Number(payload.sub));
  if (!usuario || !usuario.ativo) {
    throw new UnauthorizedError('TOKEN_INVALIDO', 'Usuário inexistente ou inativo.');
  }

  req.user = { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil, unidadeId: usuario.unidadeId };
  next();
}

// Autorização por perfil (RBAC).
function autorizar(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.user.perfil)) {
      throw new ForbiddenError('ACESSO_NEGADO', 'Seu perfil não tem permissão para esta operação.', [
        { field: 'perfil', issue: `Perfis autorizados: ${perfis.join(', ')}.` },
      ]);
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
