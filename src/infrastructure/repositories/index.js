// Repositórios (camada de infraestrutura). Cada fábrica recebe o cliente do
// banco — o padrão (prisma) ou o transacional (tx) — e expõe apenas as
// operações de persistência de que a camada de aplicação precisa.
module.exports = {
  usuarios: require('./usuarios.repository'),
  consentimentos: require('./consentimentos.repository'),
  unidades: require('./unidades.repository'),
  produtos: require('./produtos.repository'),
  cardapio: require('./cardapio.repository'),
  estoque: require('./estoque.repository'),
  pedidos: require('./pedidos.repository'),
  pagamentos: require('./pagamentos.repository'),
  fidelidade: require('./fidelidade.repository'),
  promocoes: require('./promocoes.repository'),
  auditoria: require('./auditoria.repository'),
};
