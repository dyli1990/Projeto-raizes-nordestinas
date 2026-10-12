const env = require('../../config/env');
const { MockPaymentGateway, GatewayIndisponivelError } = require('./mock-payment-gateway');
const { ResilientPaymentGateway } = require('./resilient-gateway');

// Ponto único de criação do gateway. Para integrar um provedor real bastaria
// trocar o MockPaymentGateway por um adaptador com os mesmos métodos
// (autorizar/estornar), sem alterar a camada de aplicação.
const paymentGateway = new ResilientPaymentGateway(
  new MockPaymentGateway({ latencyMs: env.payment.latencyMs }),
  { timeoutMs: env.payment.timeoutMs, maxRetries: env.payment.maxRetries }
);

module.exports = { paymentGateway, GatewayIndisponivelError };
