const usuariosService = require('../../application/usuarios.service');
const privacidadeService = require('../../application/privacidade.service');
const present = require('../presenters');
const { contexto } = require('../middlewares/request-context');

async function criar(req, res) {
  const usuario = await usuariosService.criarUsuario(req.user, contexto(req), req.valid.body);
  res.status(201).json(present.usuario(usuario));
}

async function listar(req, res) {
  const filtros = req.valid.query;
  const resultado = await usuariosService.listarUsuarios(req.user, contexto(req), filtros);
  res.json(present.paginado(resultado, filtros, present.usuario));
}

async function me(req, res) {
  const usuario = await usuariosService.buscarPerfil(req.user.id);
  const consentimentos = await privacidadeService.consultarConsentimentos(req.user.id);
  res.json({ ...present.usuario(usuario), consentimentos });
}

async function consultarConsentimentos(req, res) {
  res.json(await privacidadeService.consultarConsentimentos(req.user.id));
}

async function atualizarConsentimento(req, res) {
  res.json(await privacidadeService.atualizarConsentimento(req.user, contexto(req), req.valid.body));
}

// LGPD art. 18, II e V: acesso e portabilidade dos dados.
async function exportarDados(req, res) {
  const dados = await privacidadeService.exportarDados(req.user, contexto(req));
  res.json({
    geradoEm: new Date().toISOString(),
    titular: present.usuario(dados.usuario),
    consentimentos: dados.consentimentos.map((c) => ({
      tipo: c.tipo,
      concedido: c.concedido,
      versaoTermo: c.versaoTermo,
      canal: c.canal,
      data: c.createdAt,
    })),
    pedidos: dados.pedidos.map(present.pedido),
    fidelidade: {
      saldoPontos: dados.fidelidade.conta?.saldoPontos ?? 0,
      transacoes: dados.fidelidade.transacoes.map(present.transacaoFidelidade),
    },
  });
}

// LGPD art. 18, VI: eliminação (anonimização) dos dados pessoais.
async function anonimizar(req, res) {
  await privacidadeService.anonimizarConta(req.user, contexto(req));
  res.status(204).end();
}

module.exports = { criar, listar, me, consultarConsentimentos, atualizarConsentimento, exportarDados, anonimizar };
