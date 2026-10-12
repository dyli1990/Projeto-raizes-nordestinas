const env = require('../../config/env');

// Logger estruturado (JSON por linha), pronto para ser coletado por
// ferramentas como Loki/ELK. Nunca registramos corpo de requisição, senha,
// token ou dados pessoais: apenas metadados técnicos.
const NIVEIS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const nivelMinimo = NIVEIS[env.logLevel] ?? NIVEIS.info;

const CAMPOS_SENSIVEIS = ['senha', 'password', 'authorization', 'token', 'accessToken', 'tokenPagamento'];

function sanitizar(dados) {
  if (!dados || typeof dados !== 'object') return dados;
  const copia = Array.isArray(dados) ? [...dados] : { ...dados };
  for (const chave of Object.keys(copia)) {
    if (CAMPOS_SENSIVEIS.includes(chave)) copia[chave] = '[REDACTED]';
    else if (copia[chave] && typeof copia[chave] === 'object') copia[chave] = sanitizar(copia[chave]);
  }
  return copia;
}

function escrever(nivel, mensagem, dados) {
  if (NIVEIS[nivel] < nivelMinimo) return;
  const linha = JSON.stringify({
    time: new Date().toISOString(),
    level: nivel,
    msg: mensagem,
    ...sanitizar(dados),
  });
  if (nivel === 'error' || nivel === 'warn') process.stderr.write(linha + '\n');
  else process.stdout.write(linha + '\n');
}

module.exports = {
  debug: (msg, dados) => escrever('debug', msg, dados),
  info: (msg, dados) => escrever('info', msg, dados),
  warn: (msg, dados) => escrever('warn', msg, dados),
  error: (msg, dados) => escrever('error', msg, dados),
  sanitizar,
};
