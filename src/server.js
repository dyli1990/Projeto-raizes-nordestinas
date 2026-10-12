const env = require('./config/env');
const { criarApp } = require('./app');
const { prisma } = require('./infrastructure/database/prisma');
const logger = require('./infrastructure/logging/logger');

const app = criarApp();

const server = app.listen(env.port, () => {
  logger.info('API Raízes do Nordeste iniciada', {
    url: `http://localhost:${env.port}`,
    swagger: `http://localhost:${env.port}/docs`,
    ambiente: env.nodeEnv,
  });
  if (!env.isTest) {
    console.log(`\n  API:     http://localhost:${env.port}\n  Swagger: http://localhost:${env.port}/docs\n`);
  }
});

// Encerramento gracioso: termina as requisições em andamento e fecha o banco.
function encerrar(sinal) {
  logger.info('Encerrando API', { sinal });
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));

module.exports = server;
