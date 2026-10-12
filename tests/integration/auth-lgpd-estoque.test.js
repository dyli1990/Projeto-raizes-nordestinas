const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, prisma, resetarBanco, obterTokens, bearer } = require('../helpers');

after(() => prisma.$disconnect());

describe('Autenticação e autorização', () => {
  let tokens;

  before(async () => {
    await resetarBanco();
    tokens = await obterTokens();
  });

  test('login válido devolve token JWT e dados mínimos do usuário', async () => {
    const res = await api().post('/auth/login').send({ email: 'maria@example.com', senha: 'Cliente@123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.tokenType, 'Bearer');
    assert.equal(res.body.expiresIn, 3600);
    assert.deepEqual(Object.keys(res.body.user).sort(), ['id', 'nome', 'perfil', 'unidadeId']);
  });

  test('senha errada: 401 genérico e tentativa auditada com e-mail mascarado', async () => {
    const res = await api().post('/auth/login').send({ email: 'maria@example.com', senha: 'errada123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'CREDENCIAIS_INVALIDAS');

    const log = await prisma.logAuditoria.findFirst({ where: { acao: 'LOGIN_FALHA' }, orderBy: { id: 'desc' } });
    assert.equal(JSON.parse(log.detalhes).email, 'm***a@e***e.com');
  });

  test('token inválido: 401', async () => {
    const res = await api().get('/auth/me').set(bearer('token.falso.123'));
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'TOKEN_INVALIDO');
  });

  test('cliente tentando criar produto: 403', async () => {
    const res = await api()
      .post('/produtos')
      .set(bearer(tokens.maria))
      .send({ nome: 'Pamonha', categoria: 'SOBREMESAS', precoBase: 8.5 });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'ACESSO_NEGADO');
  });

  test('cadastro de cliente: 201 sem expor senha/hash e com consentimentos registrados', async () => {
    const res = await api().post('/auth/registro').send({
      nome: 'Ana Souza',
      email: 'ANA@Example.com',
      senha: 'Senha@123',
      aceiteTermos: true,
      consentimentoFidelidade: true,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, 'ana@example.com');
    assert.equal(res.body.perfil, 'CLIENTE');
    assert.ok(!('senha' in res.body) && !('senhaHash' in res.body));

    const salvo = await prisma.usuario.findUnique({ where: { email: 'ana@example.com' } });
    assert.match(salvo.senhaHash, /^\$2[aby]\$10\$/, 'senha armazenada com bcrypt');
    assert.equal(await prisma.consentimento.count({ where: { usuarioId: salvo.id } }), 2);
  });

  test('cadastro com e-mail repetido: 409', async () => {
    const res = await api()
      .post('/auth/registro')
      .send({ nome: 'Outra Maria', email: 'maria@example.com', senha: 'Senha@123', aceiteTermos: true });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'EMAIL_JA_CADASTRADO');
  });

  test('cadastro sem aceite dos termos, e-mail e senha inválidos: 422', async () => {
    const res = await api().post('/auth/registro').send({ nome: 'Zé', email: 'nao-e-email', senha: '123' });
    assert.equal(res.status, 422);
    const campos = res.body.details.map((d) => d.field);
    for (const campo of ['nome', 'email', 'senha', 'aceiteTermos']) assert.ok(campos.includes(campo), campo);
  });

  test('JSON malformado: 400', async () => {
    const res = await api().post('/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'JSON_INVALIDO');
  });

  test('rota inexistente: 404 no formato padrão', async () => {
    const res = await api().get('/nao-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'ROTA_NAO_ENCONTRADA');
  });
});

describe('Estoque por unidade', () => {
  let tokens;

  before(async () => {
    await resetarBanco();
    tokens = await obterTokens();
  });

  test('gerente registra entrada e o saldo é atualizado', async () => {
    const res = await api()
      .post('/estoque/movimentacoes')
      .set(bearer(tokens.gerente))
      .send({ unidadeId: 1, produtoId: 8, tipo: 'ENTRADA', quantidade: 10, motivo: 'Reposição do fornecedor' });
    assert.equal(res.status, 201);
    assert.equal(res.body.saldoAtual, 13);
    assert.equal(res.body.movimentacao.origem, 'MANUAL');
  });

  test('saída maior que o saldo: 409', async () => {
    const res = await api()
      .post('/estoque/movimentacoes')
      .set(bearer(tokens.gerente))
      .send({ unidadeId: 1, produtoId: 8, tipo: 'SAIDA', quantidade: 999, motivo: 'Teste de saída' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'ESTOQUE_INSUFICIENTE');
  });

  test('gerente de Fortaleza não movimenta estoque de Recife: 403', async () => {
    const res = await api()
      .post('/estoque/movimentacoes')
      .set(bearer(tokens.gerenteFortaleza))
      .send({ unidadeId: 1, produtoId: 1, tipo: 'ENTRADA', quantidade: 1, motivo: 'Tentativa indevida' });
    assert.equal(res.status, 403);
  });

  test('item sem saldo aparece indisponível no cardápio', async () => {
    await api()
      .post('/estoque/movimentacoes')
      .set(bearer(tokens.gerente))
      .send({ unidadeId: 1, produtoId: 8, tipo: 'SAIDA', quantidade: 13, motivo: 'Lote vencido' })
      .expect(201);
    const cardapio = await api().get('/unidades/1/cardapio');
    assert.equal(cardapio.body.itens.find((i) => i.produtoId === 8).disponivel, false);
  });

  test('consulta de saldo é restrita à unidade do colaborador', async () => {
    const res = await api().get('/estoque').set(bearer(tokens.cozinha));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.every((e) => e.unidadeId === 1));
  });
});

describe('LGPD: consentimento, exportação e anonimização', () => {
  let tokens;

  before(async () => {
    await resetarBanco();
    tokens = await obterTokens();
  });

  test('cliente concede consentimento de fidelidade (registro imutável + auditoria)', async () => {
    const res = await api()
      .put('/usuarios/me/consentimentos')
      .set(bearer(tokens.joao))
      .send({ tipo: 'FIDELIDADE', concedido: true, canal: 'APP' });
    assert.equal(res.status, 200);
    assert.equal(res.body.find((c) => c.tipo === 'FIDELIDADE').concedido, true);
    assert.equal(await prisma.consentimento.count({ where: { usuarioId: 7, tipo: 'FIDELIDADE' } }), 2);
  });

  test('exportação de dados devolve titular, consentimentos e pedidos', async () => {
    const res = await api().get('/usuarios/me/dados').set(bearer(tokens.maria));
    assert.equal(res.status, 200);
    assert.equal(res.body.titular.email, 'maria@example.com');
    assert.ok(Array.isArray(res.body.consentimentos));
    assert.equal(res.body.fidelidade.saldoPontos, 150);
  });

  test('anonimização é bloqueada com pedido em andamento (409)', async () => {
    await api()
      .post('/pedidos')
      .set(bearer(tokens.joao))
      .send({ unidadeId: 1, canalPedido: 'WEB', itens: [{ produtoId: 2, quantidade: 1 }] })
      .expect(201);
    const res = await api().delete('/usuarios/me').set(bearer(tokens.joao));
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'PEDIDOS_EM_ANDAMENTO');
  });

  test('anonimização remove dados pessoais e invalida o acesso', async () => {
    const res = await api().delete('/usuarios/me').set(bearer(tokens.maria));
    assert.equal(res.status, 204);

    const usuario = await prisma.usuario.findUnique({ where: { id: 6 } });
    assert.equal(usuario.nome, 'Titular anonimizado');
    assert.equal(usuario.telefone, null);
    assert.ok(usuario.anonimizadoEm);

    const depois = await api().get('/auth/me').set(bearer(tokens.maria));
    assert.equal(depois.status, 401);
    const login = await api().post('/auth/login').send({ email: 'maria@example.com', senha: 'Cliente@123' });
    assert.equal(login.status, 401);
  });
});
