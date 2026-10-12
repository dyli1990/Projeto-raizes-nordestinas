const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validarTransicao, validarCanalParaPerfil, calcularSubtotal } = require('../../src/domain/pedido');
const { calcularPontosAcumulados, validarResgate } = require('../../src/domain/fidelidade');
const { validarPromocao, calcularDescontoPromocao } = require('../../src/domain/promocao');
const { mascararEmail } = require('../../src/domain/privacidade');
const { podeVerPedido, garantirAcessoUnidade } = require('../../src/domain/acesso');

describe('Máquina de status do pedido', () => {
  test('cozinha move EM_PREPARO -> PRONTO', () => {
    assert.doesNotThrow(() => validarTransicao('EM_PREPARO', 'PRONTO', 'COZINHA'));
  });

  test('atendente entrega pedido PRONTO', () => {
    assert.doesNotThrow(() => validarTransicao('PRONTO', 'ENTREGUE', 'ATENDENTE'));
  });

  test('não permite pular o pagamento (AGUARDANDO_PAGAMENTO -> EM_PREPARO)', () => {
    assert.throws(() => validarTransicao('AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'ADMIN'), {
      status: 409,
      error: 'TRANSICAO_STATUS_INVALIDA',
    });
  });

  test('status final não pode ser alterado', () => {
    assert.throws(() => validarTransicao('ENTREGUE', 'CANCELADO', 'ADMIN'), { status: 409 });
  });

  test('cozinha não pode marcar como ENTREGUE (403)', () => {
    assert.throws(() => validarTransicao('PRONTO', 'ENTREGUE', 'COZINHA'), {
      status: 403,
      error: 'PERFIL_SEM_PERMISSAO',
    });
  });

  test('cliente não cancela pedido que já está em preparo', () => {
    assert.throws(() => validarTransicao('EM_PREPARO', 'CANCELADO', 'CLIENTE'), { status: 403 });
  });
});

describe('Multicanalidade', () => {
  test('cliente pode usar APP, TOTEM, PICKUP e WEB', () => {
    for (const canal of ['APP', 'TOTEM', 'PICKUP', 'WEB']) {
      assert.doesNotThrow(() => validarCanalParaPerfil(canal, 'CLIENTE'));
    }
  });

  test('canal BALCAO é exclusivo da equipe', () => {
    assert.throws(() => validarCanalParaPerfil('BALCAO', 'CLIENTE'), { status: 422, error: 'CANAL_NAO_PERMITIDO' });
    assert.doesNotThrow(() => validarCanalParaPerfil('BALCAO', 'ATENDENTE'));
  });
});

describe('Valores, fidelidade e promoções', () => {
  test('subtotal soma preço x quantidade em centavos', () => {
    assert.equal(
      calcularSubtotal([
        { precoUnitarioCentavos: 2290, quantidade: 2 },
        { precoUnitarioCentavos: 950, quantidade: 1 },
      ]),
      5530
    );
  });

  test('acumula 1 ponto por real pago, descartando centavos', () => {
    assert.equal(calcularPontosAcumulados(4977), 49);
    assert.equal(calcularPontosAcumulados(99), 0);
  });

  test('resgate converte 10 pontos em R$ 1,00', () => {
    assert.equal(validarResgate({ pontos: 50, saldoPontos: 150, valorRestanteCentavos: 5000 }), 500);
  });

  test('resgate acima do saldo gera 409', () => {
    assert.throws(() => validarResgate({ pontos: 200, saldoPontos: 150, valorRestanteCentavos: 5000 }), {
      status: 409,
      error: 'SALDO_PONTOS_INSUFICIENTE',
    });
  });

  test('resgate não pode superar o valor do pedido', () => {
    assert.throws(() => validarResgate({ pontos: 100, saldoPontos: 150, valorRestanteCentavos: 500 }), {
      status: 422,
      error: 'RESGATE_EXCEDE_TOTAL',
    });
  });

  const promocao = {
    ativa: true,
    tipoDesconto: 'PERCENTUAL',
    valor: 10,
    unidadeId: null,
    inicio: new Date('2026-01-01'),
    fim: new Date('2026-12-31'),
  };

  test('promoção percentual calcula desconto arredondado', () => {
    assert.equal(calcularDescontoPromocao(promocao, 5530), 553);
  });

  test('promoção de valor fixo não ultrapassa o subtotal', () => {
    assert.equal(calcularDescontoPromocao({ ...promocao, tipoDesconto: 'VALOR_FIXO', valor: 1000 }, 800), 800);
  });

  test('promoção expirada ou de outra unidade é rejeitada', () => {
    assert.throws(() => validarPromocao(promocao, { unidadeId: 1, agora: new Date('2027-01-10') }), {
      error: 'PROMOCAO_INVALIDA',
    });
    assert.throws(() => validarPromocao({ ...promocao, unidadeId: 2 }, { unidadeId: 1, agora: new Date('2026-05-01') }), {
      error: 'PROMOCAO_INVALIDA',
    });
  });
});

describe('Privacidade e acesso', () => {
  test('mascara e-mail para logs de auditoria', () => {
    assert.equal(mascararEmail('maria@example.com'), 'm***a@e***e.com');
    assert.equal(mascararEmail('invalido'), '***');
  });

  test('cliente só vê os próprios pedidos; equipe só os da unidade', () => {
    const pedido = { clienteId: 6, unidadeId: 1 };
    assert.equal(podeVerPedido({ id: 6, perfil: 'CLIENTE' }, pedido), true);
    assert.equal(podeVerPedido({ id: 7, perfil: 'CLIENTE' }, pedido), false);
    assert.equal(podeVerPedido({ id: 2, perfil: 'GERENTE', unidadeId: 1 }, pedido), true);
    assert.equal(podeVerPedido({ id: 5, perfil: 'GERENTE', unidadeId: 2 }, pedido), false);
    assert.equal(podeVerPedido({ id: 1, perfil: 'ADMIN' }, pedido), true);
  });

  test('gerente de outra unidade recebe 403', () => {
    assert.throws(() => garantirAcessoUnidade({ perfil: 'GERENTE', unidadeId: 2 }, 1), {
      status: 403,
      error: 'ACESSO_UNIDADE_NEGADO',
    });
  });
});
