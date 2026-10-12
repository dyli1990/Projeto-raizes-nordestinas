const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const env = require('./config/env');
const { prisma } = require('./infrastructure/database/prisma');
const { requestContext } = require('./api/middlewares/request-context');
const { limiteGeral } = require('./api/middlewares/rate-limit');
const { tratarErros, rotaNaoEncontrada } = require('./api/middlewares/error-handler');
const routes = require('./api/routes');

const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, 'api', 'docs', 'openapi.yaml'), 'utf8'));

function criarApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestContext);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? '*' : env.corsOrigins,
      exposedHeaders: ['X-Request-Id', 'Location', 'Idempotent-Replayed'],
    })
  );
  app.use(limiteGeral);
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (req, res) => res.redirect('/docs'));

  app.get('/health', async (req, res) => {
    let database = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'indisponivel';
    }
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degradado',
      database,
      uptimeSegundos: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Documentação OpenAPI/Swagger (o Swagger UI precisa de scripts inline).
  app.get('/docs/openapi.json', (req, res) => res.json(openapi));
  app.use(
    '/docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openapi, {
      customSiteTitle: 'Raízes do Nordeste API',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    })
  );

  app.use(routes);

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}

module.exports = { criarApp };
