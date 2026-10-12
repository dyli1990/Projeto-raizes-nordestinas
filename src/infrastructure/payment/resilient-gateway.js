const { GatewayIndisponivelError } = require('./mock-payment-gateway');
const logger = require('../logging/logger');

// Decorator de resiliência para qualquer gateway de pagamento:
//  - timeout por chamada (não deixamos o pedido "pendurado" no pico);
//  - novas tentativas com backoff exponencial para falhas transitórias;
//  - devolve quantas tentativas foram feitas, para registro no pagamento.
// Recusas de negócio (cartão recusado) NÃO são repetidas.

class ResilientPaymentGateway {
  constructor(gateway, { timeoutMs = 2000, maxRetries = 2, backoffMs = 100 } = {}) {
    this.gateway = gateway;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.backoffMs = backoffMs;
  }

  async executar(operacao, args) {
    let tentativas = 0;
    let ultimoErro;

    while (tentativas <= this.maxRetries) {
      tentativas += 1;
      try {
        const resultado = await this.comTimeout(this.gateway[operacao](args));
        return { resultado, tentativas };
      } catch (erro) {
        ultimoErro = erro;
        logger.warn('Falha ao chamar gateway de pagamento', {
          operacao,
          tentativa: tentativas,
          erro: erro.message,
        });
        if (tentativas <= this.maxRetries) {
          await new Promise((r) => setTimeout(r, this.backoffMs * 2 ** (tentativas - 1)));
        }
      }
    }

    const erro = new GatewayIndisponivelError(ultimoErro?.message || 'Gateway indisponível.');
    erro.tentativas = tentativas;
    throw erro;
  }

  comTimeout(promessa) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new GatewayIndisponivelError(`Timeout de ${this.timeoutMs} ms no gateway.`)),
        this.timeoutMs
      );
    });
    return Promise.race([promessa, timeout]).finally(() => clearTimeout(timer));
  }

  autorizar(args) {
    return this.executar('autorizar', args);
  }

  estornar(args) {
    return this.executar('estornar', args);
  }
}

module.exports = { ResilientPaymentGateway };
