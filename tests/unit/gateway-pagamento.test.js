process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-apenas-para-testes-automatizados';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MockPaymentGateway, GatewayIndisponivelError } = require('../../src/infrastructure/payment/mock-payment-gateway');
const { ResilientPaymentGateway } = require('../../src/infrastructure/payment/resilient-gateway');

const criar = () =>
  new ResilientPaymentGateway(new MockPaymentGateway({ latencyMs: 1 }), { timeoutMs: 100, maxRetries: 2, backoffMs: 1 });

const pedido = { referencia: 'pagamento-1', valorCentavos: 4977, metodo: 'CARTAO_CREDITO' };

describe('Gateway de pagamento simulado', () => {
  test('aprova por padrão e devolve id da transação', async () => {
    const { resultado, tentativas } = await criar().autorizar(pedido);
    assert.equal(resultado.status, 'APROVADO');
    assert.match(resultado.transacaoId, /^mock_/);
    assert.equal(tentativas, 1);
  });

  test('recusa com motivo quando o token é tok_recusado (sem nova tentativa)', async () => {
    const { resultado, tentativas } = await criar().autorizar({ ...pedido, tokenPagamento: 'tok_recusado' });
    assert.equal(resultado.status, 'RECUSADO');
    assert.equal(resultado.motivo, 'SALDO_INSUFICIENTE');
    assert.equal(tentativas, 1);
  });

  test('PIX devolve código copia e cola', async () => {
    const { resultado } = await criar().autorizar({ ...pedido, metodo: 'PIX' });
    assert.ok(resultado.pix.copiaECola.startsWith('000201'));
  });

  test('tolera falha transitória: timeout na 1ª chamada e aprovação na 2ª', async () => {
    const { resultado, tentativas } = await criar().autorizar({ ...pedido, referencia: 'instavel-1', tokenPagamento: 'tok_instavel' });
    assert.equal(resultado.status, 'APROVADO');
    assert.equal(tentativas, 2);
  });

  test('desiste após esgotar as tentativas quando o gateway está fora do ar', async () => {
    await assert.rejects(criar().autorizar({ ...pedido, tokenPagamento: 'tok_indisponivel' }), (erro) => {
      assert.ok(erro instanceof GatewayIndisponivelError);
      assert.equal(erro.tentativas, 3);
      return true;
    });
  });
});
