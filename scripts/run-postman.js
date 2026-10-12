// Executa a coleção Postman de ponta a ponta, sem passos manuais:
//  1) cria um banco exclusivo (prisma/postman.db) com migrations + seed;
//  2) sobe a API numa porta livre;
//  3) roda a coleção com o Newman (CLI do Postman);
//  4) salva as evidências em docs/evidencias/.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./postman.db';
process.env.LOG_LEVEL = 'silent';
process.env.PAYMENT_MOCK_LATENCY_MS = '20';
process.env.PAYMENT_TIMEOUT_MS = '500';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-apenas-para-execucao-da-colecao';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const newman = require('newman');

const raiz = path.join(__dirname, '..');
const colecao = path.join(raiz, 'postman', 'raizes-do-nordeste.postman_collection.json');
const pastaEvidencias = path.join(raiz, 'docs', 'evidencias');

// Banco novo a cada execução: apaga só o arquivo exclusivo da coleção
// (nunca o banco de desenvolvimento) e aplica as migrations.
for (const arquivo of ['postman.db', 'postman.db-journal']) {
  fs.rmSync(path.join(raiz, 'prisma', arquivo), { force: true });
}
execSync('npx prisma migrate deploy', { cwd: raiz, stdio: 'inherit', env: process.env });

const { criarApp } = require('../src/app');
const { prisma } = require('../src/infrastructure/database/prisma');
const { seed } = require('../prisma/seed');

seed(prisma).then(iniciar);

function iniciar() {
  const server = criarApp().listen(0, () => executarColecao(server));
}

function executarColecao(server) {
  const baseUrl = `http://localhost:${server.address().port}`;
  console.log(`\nAPI de teste em ${baseUrl}\n`);
  fs.mkdirSync(pastaEvidencias, { recursive: true });

  newman.run(
    {
      collection: require(colecao),
      envVar: [{ key: 'baseUrl', value: baseUrl }],
      reporters: ['cli', 'json'],
      reporter: { json: { export: path.join(pastaEvidencias, 'newman-report.json') } },
    },
    async (erro, resumo) => {
      server.close();
      await prisma.$disconnect();
      if (erro) {
        console.error(erro);
        process.exit(1);
      }
      fs.writeFileSync(path.join(pastaEvidencias, 'resultado-postman.md'), gerarRelatorio(resumo));
      const falhas = resumo.run.failures.length;
      console.log(`\nEvidências salvas em docs/evidencias/ (${falhas} falha(s)).`);
      process.exit(falhas ? 1 : 0);
    }
  );
}

function gerarRelatorio(resumo) {
  const { stats, executions, timings } = resumo.run;
  const linhas = [
    '# Evidência de execução — coleção Postman',
    '',
    `Gerado automaticamente por \`npm run test:postman\` (Newman) em ${new Date().toISOString()}.`,
    '',
    `- Requisições: **${stats.requests.total}** (falhas: ${stats.requests.failed})`,
    `- Asserções: **${stats.assertions.total}** (falhas: ${stats.assertions.failed})`,
    `- Duração total: ${Math.round((timings.completed - timings.started) / 1000)} s`,
    '',
    '| Requisição | Método | Rota | Status | Asserções |',
    '|---|---|---|---|---|',
  ];
  for (const execucao of executions) {
    const req = execucao.request;
    const rota = '/' + req.url.path.join('/') + (req.url.query.count() ? '?' + req.url.getQueryString() : '');
    const asserts = execucao.assertions || [];
    const ok = asserts.filter((a) => !a.error).length;
    const icone = ok === asserts.length ? '✅' : '❌';
    linhas.push(
      `| ${execucao.item.name} | ${req.method} | \`${rota}\` | ${execucao.response?.code ?? '-'} | ${icone} ${ok}/${asserts.length} |`
    );
  }
  return linhas.join('\n') + '\n';
}
