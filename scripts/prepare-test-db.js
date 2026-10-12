// Cria um banco SQLite exclusivo para os testes (prisma/test.db) e aplica as
// migrations. Os testes populam os dados com o seed antes de cada arquivo.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const pastaPrisma = path.join(__dirname, '..', 'prisma');
for (const arquivo of ['test.db', 'test.db-journal']) {
  fs.rmSync(path.join(pastaPrisma, arquivo), { force: true });
}

execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'file:./test.db' },
});
