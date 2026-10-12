const jwt = require('jsonwebtoken');
const env = require('../../config/env');

const EMISSOR = 'raizes-do-nordeste-api';

function emitirToken(usuario) {
  const accessToken = jwt.sign(
    { perfil: usuario.perfil, unidadeId: usuario.unidadeId ?? null },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      subject: String(usuario.id),
      issuer: EMISSOR,
      expiresIn: env.jwtExpiresIn,
    }
  );
  return { accessToken, tokenType: 'Bearer', expiresIn: env.jwtExpiresIn };
}

// Lança erro do jsonwebtoken (TokenExpiredError/JsonWebTokenError) se inválido.
function verificarToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: EMISSOR });
}

module.exports = { emitirToken, verificarToken };
