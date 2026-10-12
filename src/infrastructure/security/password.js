const bcrypt = require('bcryptjs');

// bcrypt com custo 10: hash lento e com salt aleatório embutido.
const CUSTO = 10;

function gerarHash(senha) {
  return bcrypt.hash(senha, CUSTO);
}

function comparar(senha, hash) {
  return bcrypt.compare(senha, hash);
}

// Hash usado quando o usuário não existe, para que o tempo de resposta do
// login seja semelhante em ambos os casos (evita enumeração de e-mails).
const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia-para-tempo-constante', CUSTO);

module.exports = { gerarHash, comparar, HASH_FICTICIO };
