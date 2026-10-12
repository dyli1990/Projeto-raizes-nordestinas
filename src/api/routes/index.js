const { Router } = require('express');
const { autenticar, autorizar } = require('../middlewares/auth');
const { validar } = require('../middlewares/validate');
const { limiteLogin } = require('../middlewares/rate-limit');
const { Perfil } = require('../../domain/enums');
const { paramsId } = require('../schemas/comum');
const authSchemas = require('../schemas/auth.schema');
const catalogoSchemas = require('../schemas/catalogo.schema');
const pedidosSchemas = require('../schemas/pedidos.schema');
const consultaSchemas = require('../schemas/consulta.schema');
const auth = require('../controllers/auth.controller');
const usuarios = require('../controllers/usuarios.controller');
const catalogo = require('../controllers/catalogo.controller');
const pedidos = require('../controllers/pedidos.controller');

const { ADMIN, GERENTE, ATENDENTE, COZINHA, CLIENTE } = Perfil;
const EQUIPE = [ADMIN, GERENTE, ATENDENTE, COZINHA];

const router = Router();

// ----- /auth ----------------------------------------------------------------
router.post('/auth/registro', validar({ body: authSchemas.registro }), auth.registrar);
router.post('/auth/login', limiteLogin, validar({ body: authSchemas.login }), auth.login);
router.get('/auth/me', autenticar, auth.me);

// ----- /usuarios ------------------------------------------------------------
router.post('/usuarios', autenticar, autorizar(ADMIN), validar({ body: authSchemas.criarUsuario }), usuarios.criar);
router.get('/usuarios', autenticar, autorizar(ADMIN), validar({ query: authSchemas.listarUsuarios }), usuarios.listar);
router.get('/usuarios/me', autenticar, usuarios.me);
router.get('/usuarios/me/consentimentos', autenticar, usuarios.consultarConsentimentos);
router.put(
  '/usuarios/me/consentimentos',
  autenticar,
  autorizar(CLIENTE),
  validar({ body: authSchemas.consentimento }),
  usuarios.atualizarConsentimento
);
router.get('/usuarios/me/dados', autenticar, usuarios.exportarDados);
router.delete('/usuarios/me', autenticar, autorizar(CLIENTE), usuarios.anonimizar);

// ----- /unidades e cardápio -------------------------------------------------
router.get('/unidades', validar({ query: catalogoSchemas.listarUnidades }), catalogo.listarUnidades);
router.post('/unidades', autenticar, autorizar(ADMIN), validar({ body: catalogoSchemas.unidade }), catalogo.criarUnidade);
router.get('/unidades/:id', validar({ params: paramsId }), catalogo.obterUnidade);
router.get(
  '/unidades/:id/cardapio',
  validar({ params: paramsId, query: catalogoSchemas.consultarCardapio }),
  catalogo.consultarCardapio
);
router.put(
  '/unidades/:id/cardapio/:produtoId',
  autenticar,
  autorizar(ADMIN, GERENTE),
  validar({ params: catalogoSchemas.paramsCardapio, body: catalogoSchemas.itemCardapio }),
  catalogo.salvarItemCardapio
);

// ----- /produtos ------------------------------------------------------------
router.get('/produtos', validar({ query: catalogoSchemas.listarProdutos }), catalogo.listarProdutos);
router.get('/produtos/:id', validar({ params: paramsId }), catalogo.obterProduto);
router.post('/produtos', autenticar, autorizar(ADMIN), validar({ body: catalogoSchemas.produto }), catalogo.criarProduto);
router.put(
  '/produtos/:id',
  autenticar,
  autorizar(ADMIN),
  validar({ params: paramsId, body: catalogoSchemas.atualizarProduto }),
  catalogo.atualizarProduto
);
router.delete('/produtos/:id', autenticar, autorizar(ADMIN), validar({ params: paramsId }), catalogo.desativarProduto);

// ----- /estoque -------------------------------------------------------------
router.get('/estoque', autenticar, autorizar(...EQUIPE), validar({ query: catalogoSchemas.consultarEstoque }), catalogo.consultarEstoque);
router.post(
  '/estoque/movimentacoes',
  autenticar,
  autorizar(ADMIN, GERENTE),
  validar({ body: catalogoSchemas.movimentacao }),
  catalogo.movimentarEstoque
);
router.get(
  '/estoque/movimentacoes',
  autenticar,
  autorizar(ADMIN, GERENTE),
  validar({ query: catalogoSchemas.consultarEstoque }),
  catalogo.listarMovimentacoes
);

// ----- /promocoes -----------------------------------------------------------
router.get('/promocoes', validar({ query: catalogoSchemas.listarPromocoes }), catalogo.listarPromocoes);
router.post('/promocoes', autenticar, autorizar(ADMIN), validar({ body: catalogoSchemas.promocao }), catalogo.criarPromocao);

// ----- /pedidos -------------------------------------------------------------
router.post(
  '/pedidos',
  autenticar,
  autorizar(CLIENTE, ATENDENTE, GERENTE, ADMIN),
  validar({ body: pedidosSchemas.criarPedido }),
  pedidos.criarPedido
);
router.get('/pedidos', autenticar, validar({ query: pedidosSchemas.listarPedidos }), pedidos.listarPedidos);
router.get('/pedidos/:id', autenticar, validar({ params: paramsId }), pedidos.obterPedido);
router.patch(
  '/pedidos/:id/status',
  autenticar,
  validar({ params: paramsId, body: pedidosSchemas.atualizarStatus }),
  pedidos.atualizarStatus
);

// ----- /pagamentos (gateway mock) -------------------------------------------
router.post(
  '/pagamentos',
  autenticar,
  autorizar(CLIENTE, ATENDENTE, GERENTE, ADMIN),
  validar({ body: pedidosSchemas.solicitarPagamento }),
  pedidos.solicitarPagamento
);
router.get('/pagamentos/:id', autenticar, validar({ params: paramsId }), pedidos.obterPagamento);

// ----- /fidelidade ----------------------------------------------------------
router.get('/fidelidade/saldo', autenticar, autorizar(CLIENTE), pedidos.saldoFidelidade);
router.get(
  '/fidelidade/extrato',
  autenticar,
  autorizar(CLIENTE),
  validar({ query: consultaSchemas.paginada }),
  pedidos.extratoFidelidade
);

// ----- /auditoria -----------------------------------------------------------
router.get(
  '/auditoria',
  autenticar,
  autorizar(ADMIN),
  validar({ query: consultaSchemas.listarAuditoria }),
  pedidos.listarAuditoria
);

module.exports = router;
