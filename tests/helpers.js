// Configuração comum dos testes de integração. Precisa ser importado ANTES
// da aplicação para que as variáveis de ambiente de teste prevaleçam.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.LOG_LEVEL = 'silent';
process.env.PAYMENT_MOCK_LATENCY_MS = '5';
process.env.PAYMENT_TIMEOUT_MS = '300';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-apenas-para-testes-automatizados';

const supertest = require('supertest');
const { criarApp } = require('../src/app');
const { prisma } = require('../src/infrastructure/database/prisma');
const { seed } = require('../prisma/seed');

const app = criarApp();

const USUARIOS = {
  admin: ['admin@raizes.dev', 'Admin@123'],
  gerente: ['gerente.recife@raizes.dev', 'Gerente@123'],
  atendente: ['atendente.recife@raizes.dev', 'Atendente@123'],
  cozinha: ['cozinha.recife@raizes.dev', 'Cozinha@123'],
  gerenteFortaleza: ['gerente.fortaleza@raizes.dev', 'Gerente@123'],
  maria: ['maria@example.com', 'Cliente@123'],
  joao: ['joao@example.com', 'Cliente@123'],
};

const api = () => supertest(app);

async function resetarBanco() {
  await seed(prisma);
}

// Faz login em todos os perfis do seed e devolve { perfil: token }.
async function obterTokens() {
  const tokens = {};
  for (const [chave, [email, senha]] of Object.entries(USUARIOS)) {
    const res = await api().post('/auth/login').send({ email, senha });
    if (res.status !== 200) throw new Error(`Falha no login de ${email}: ${res.status}`);
    tokens[chave] = res.body.accessToken;
  }
  return tokens;
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, api, prisma, resetarBanco, obterTokens, bearer, USUARIOS };
