const { ConflictError, BusinessRuleError } = require('./errors');

// Regras do programa de fidelidade "Raízes+":
//  - acúmulo: 1 ponto para cada R$ 1,00 efetivamente pago (centavos descartados);
//  - resgate: cada ponto vale R$ 0,10 de desconto (10 pontos = R$ 1,00);
//  - só participa quem deu consentimento FIDELIDADE (LGPD, art. 7º, I).
const PONTOS_POR_REAL = 1;
const CENTAVOS_POR_PONTO = 10;

function calcularPontosAcumulados(valorPagoCentavos) {
  return Math.floor(valorPagoCentavos / 100) * PONTOS_POR_REAL;
}

function calcularDescontoPorPontos(pontos) {
  return pontos * CENTAVOS_POR_PONTO;
}

function validarResgate({ pontos, saldoPontos, valorRestanteCentavos }) {
  if (pontos > saldoPontos) {
    throw new ConflictError('SALDO_PONTOS_INSUFICIENTE', 'Saldo de pontos insuficiente para o resgate.', [
      { field: 'pontosResgatar', issue: `Saldo disponível: ${saldoPontos} pontos.` },
    ]);
  }
  const desconto = calcularDescontoPorPontos(pontos);
  if (desconto > valorRestanteCentavos) {
    const maximo = Math.floor(valorRestanteCentavos / CENTAVOS_POR_PONTO);
    throw new BusinessRuleError('RESGATE_EXCEDE_TOTAL', 'O desconto em pontos não pode superar o valor do pedido.', [
      { field: 'pontosResgatar', issue: `Máximo resgatável neste pedido: ${maximo} pontos.` },
    ]);
  }
  return desconto;
}

module.exports = {
  PONTOS_POR_REAL,
  CENTAVOS_POR_PONTO,
  calcularPontosAcumulados,
  calcularDescontoPorPontos,
  validarResgate,
};
