const authService = require('../../application/auth.service');
const usuariosService = require('../../application/usuarios.service');
const present = require('../presenters');
const { contexto } = require('../middlewares/request-context');

async function registrar(req, res) {
  const { consentimentoFidelidade, consentimentoMarketing, aceiteTermos, ...dados } = req.valid.body;
  const usuario = await authService.registrarCliente(
    { ...dados, consentimentos: { fidelidade: consentimentoFidelidade, marketing: consentimentoMarketing } },
    contexto(req)
  );
  res.status(201).location(`/usuarios/me`).json(present.usuario(usuario));
}

async function login(req, res) {
  const { accessToken, tokenType, expiresIn, usuario } = await authService.login(req.valid.body, contexto(req));
  res.json({ accessToken, tokenType, expiresIn, user: present.usuarioResumo(usuario) });
}

async function me(req, res) {
  const usuario = await usuariosService.buscarPerfil(req.user.id);
  res.json(present.usuario(usuario));
}

module.exports = { registrar, login, me };
