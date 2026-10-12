require('../../config/env');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Executa a função dentro de uma transação. Os repositórios recebem o
// cliente transacional (tx), garantindo atomicidade das operações do caso de
// uso (ex.: baixar estoque + criar pedido + registrar auditoria).
function transaction(fn) {
  return prisma.$transaction(fn, { maxWait: 5000, timeout: 15000 });
}

module.exports = { prisma, transaction };
