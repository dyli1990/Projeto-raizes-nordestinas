require('dotenv').config();

function inteiro(nome, padrao) {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') return padrao;
  const numero = Number.parseInt(valor, 10);
  if (Number.isNaN(numero)) {
    throw new Error(`Variável de ambiente ${nome} deve ser um número inteiro.`);
  }
  return numero;
}

const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: inteiro('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: inteiro('JWT_EXPIRES_IN', 3600),
  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info'),
  payment: {
    latencyMs: inteiro('PAYMENT_MOCK_LATENCY_MS', 150),
    timeoutMs: inteiro('PAYMENT_TIMEOUT_MS', 2000),
    maxRetries: inteiro('PAYMENT_MAX_RETRIES', 2),
  },
};

// Falha rápido: sem segredo JWT a API não pode emitir nem validar tokens.
if (!env.jwtSecret) {
  throw new Error('JWT_SECRET não configurado. Copie .env.example para .env.');
}
if (env.isProduction && env.jwtSecret.length < 32) {
  throw new Error('Em produção, JWT_SECRET deve ter pelo menos 32 caracteres.');
}
if (!env.databaseUrl) {
  throw new Error('DATABASE_URL não configurada. Copie .env.example para .env.');
}

module.exports = env;
