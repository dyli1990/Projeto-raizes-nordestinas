// Dinheiro é tratado internamente em centavos (inteiros).

function paraCentavos(reais) {
  return Math.round(Number(reais) * 100);
}

function paraReais(centavos) {
  return Math.round(centavos) / 100;
}

module.exports = { paraCentavos, paraReais };
