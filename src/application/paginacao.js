const LIMITE_PADRAO = 10;
const LIMITE_MAXIMO = 100;

function paginar({ page = 1, limit = LIMITE_PADRAO } = {}) {
  const take = Math.min(Math.max(limit, 1), LIMITE_MAXIMO);
  const pagina = Math.max(page, 1);
  return { skip: (pagina - 1) * take, take };
}

function metadados({ page = 1, limit = LIMITE_PADRAO }, total) {
  const take = Math.min(Math.max(limit, 1), LIMITE_MAXIMO);
  return { page, limit: take, total, totalPages: Math.ceil(total / take) };
}

module.exports = { paginar, metadados, LIMITE_PADRAO, LIMITE_MAXIMO };
