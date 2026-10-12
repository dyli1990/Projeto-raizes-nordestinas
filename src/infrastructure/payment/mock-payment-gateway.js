const { randomUUID } = require('node:crypto');

// Simulação de um gateway de pagamento externo (ex.: adquirente de cartão
// ou PSP de PIX). NÃO processa dinheiro real.
//
// O resultado é determinístico, controlado pelo campo "tokenPagamento" —
// que, num gateway real, seria o token do cartão gerado no front-end
// (o back-end nunca recebe número de cartão):
//
//   tok_aprovado (ou omitido) -> APROVADO
//   tok_recusado              -> RECUSADO (saldo insuficiente)
//   tok_cartao_bloqueado      -> RECUSADO (cartão bloqueado)
//   tok_instavel              -> 1ª chamada falha por timeout, a nova tentativa aprova
//   tok_indisponivel          -> gateway fora do ar em todas as tentativas

class GatewayIndisponivelError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GatewayIndisponivelError';
  }
}

const RECUSAS = {
  tok_recusado: { codigoRetorno: '51', motivo: 'SALDO_INSUFICIENTE', mensagem: 'Saldo insuficiente.' },
  tok_cartao_bloqueado: { codigoRetorno: '62', motivo: 'CARTAO_BLOQUEADO', mensagem: 'Cartão bloqueado.' },
};

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class MockPaymentGateway {
  constructor({ latencyMs = 150 } = {}) {
    this.latencyMs = latencyMs;
    this.chamadasInstaveis = new Map();
  }

  async autorizar({ referencia, valorCentavos, metodo, tokenPagamento }) {
    await dormir(this.latencyMs);
    const token = tokenPagamento || 'tok_aprovado';

    if (token === 'tok_indisponivel') {
      throw new GatewayIndisponivelError('Gateway de pagamento indisponível (HTTP 503).');
    }
    if (token === 'tok_instavel') {
      const chamadas = (this.chamadasInstaveis.get(referencia) || 0) + 1;
      this.chamadasInstaveis.set(referencia, chamadas);
      if (chamadas === 1) {
        // Simula uma resposta que nunca chega: quem chama deve aplicar timeout.
        // unref() evita que este timer segure o processo aberto.
        await new Promise((resolve) => setTimeout(resolve, 60_000).unref());
      }
    }

    const transacaoId = `mock_${randomUUID()}`;
    const recusa = RECUSAS[token];
    if (recusa) {
      return { status: 'RECUSADO', transacaoId, ...recusa, valorCentavos, metodo };
    }

    const resposta = {
      status: 'APROVADO',
      transacaoId,
      codigoRetorno: '00',
      codigoAutorizacao: String(Math.floor(100000 + Math.random() * 900000)),
      valorCentavos,
      metodo,
    };
    if (metodo === 'PIX') {
      resposta.pix = {
        txid: transacaoId.replace(/-/g, '').slice(0, 25),
        copiaECola: `00020126580014BR.GOV.BCB.PIX0136${transacaoId}5204000053039865802BR5925RAIZES DO NORDESTE MOCK`,
      };
    }
    return resposta;
  }

  async estornar({ transacaoId, valorCentavos }) {
    await dormir(this.latencyMs);
    return { status: 'ESTORNADO', estornoId: `estorno_${randomUUID()}`, transacaoId, valorCentavos };
  }
}

module.exports = { MockPaymentGateway, GatewayIndisponivelError };
