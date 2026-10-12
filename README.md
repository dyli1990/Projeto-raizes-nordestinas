# Raízes do Nordeste — API Back-end

API REST da rede de lanchonetes **Raízes do Nordeste** (matriz + unidades), desenvolvida para o
**Projeto Multidisciplinar 2026 — Trilha Back-end**.

A API atende vários canais de venda (**APP, TOTEM, BALCAO, PICKUP, WEB**) e entrega, de ponta a ponta e com
persistência em banco, o **Fluxo A: Pedido → Pagamento (gateway mock) → Atualização de status**, além de
estoque por unidade, cardápio por unidade, promoções, programa de fidelidade, LGPD e auditoria.

| | |
|---|---|
| Repositório | <https://github.com/dyli1990/Projeto-raizes-nordestinas.git> |
| Swagger (local) | <http://localhost:3000/docs> |
| OpenAPI JSON | <http://localhost:3000/docs/openapi.json> |
| Coleção Postman | [`postman/raizes-do-nordeste.postman_collection.json`](postman/raizes-do-nordeste.postman_collection.json) |
| DER | [`docs/diagramas/der.png`](docs/diagramas/der.png) (fonte: [`prisma/schema.prisma`](prisma/schema.prisma)) |
| Evidência dos testes | [`docs/evidencias/resultado-postman.md`](docs/evidencias/resultado-postman.md) |

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias e requisitos](#tecnologias-e-requisitos)
- [Como executar (passo a passo)](#como-executar-passo-a-passo)
- [Documentação da API (Swagger)](#documentação-da-api-swagger)
- [Usuários de demonstração](#usuários-de-demonstração)
- [Fluxo principal em 4 chamadas](#fluxo-principal-em-4-chamadas)
- [Como rodar os testes](#como-rodar-os-testes)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Documentação técnica](#documentação-técnica)

## Funcionalidades

- **Autenticação JWT** com perfis `ADMIN`, `GERENTE`, `ATENDENTE`, `COZINHA` e `CLIENTE` e escopo por unidade.
- **Cardápio por unidade** (preço local + disponibilidade calculada pelo estoque).
- **Estoque por unidade** com entradas, saídas, histórico e baixa atômica na venda.
- **Pedidos multicanal** com `canalPedido` obrigatório, filtro `?canalPedido=` e paginação.
- **Máquina de status**: `AGUARDANDO_PAGAMENTO → EM_PREPARO (cozinha) → PRONTO → ENTREGUE` ou `CANCELADO`.
- **Pagamento via gateway externo simulado (mock)**: aprovado, recusado, instável (timeout + nova tentativa)
  e indisponível (503), com **idempotência** (`Idempotency-Key`) e estorno no cancelamento.
- **Fidelidade** (1 ponto por real; 10 pontos = R$ 1,00) somente com consentimento.
- **Promoções** por cupom (rede toda ou por unidade, com vigência).
- **LGPD**: consentimentos versionados, exportação de dados e anonimização da conta.
- **Auditoria** de ações sensíveis e log estruturado com `X-Request-Id`.
- **Erro padronizado** em todas as falhas: `{ error, message, details[], timestamp, path, requestId }`.

## Tecnologias e requisitos

| Item | Versão / ferramenta |
|---|---|
| Linguagem | JavaScript (Node.js **20 ou superior** — testado no Node 22) |
| Framework HTTP | Express 5 |
| Banco de dados | SQLite (arquivo local, não precisa instalar servidor) |
| ORM / migrations / seed | Prisma 6 |
| Validação | Zod 4 |
| Segurança | jsonwebtoken (JWT), bcryptjs, helmet, express-rate-limit, cors |
| Documentação | OpenAPI 3 + swagger-ui-express |
| Testes | node:test + supertest; Postman/Newman |

Pré-requisitos: **Node.js 20+** e **npm** (vem com o Node) e **Git**. Nada mais precisa ser instalado.

## Como executar (passo a passo)

### 1. Clonar o repositório

```bash
git clone https://github.com/dyli1990/Projeto-raizes-nordestinas.git
```

```bash
cd Projeto-raizes-nordestinas
```

### 2. Instalar as dependências

```bash
npm install
```

O `postinstall` já gera o Prisma Client.

### 3. Configurar as variáveis de ambiente

Copie o arquivo de exemplo (Linux/macOS/Git Bash):

```bash
cp .env.example .env
```

No Windows (PowerShell ou CMD): `copy .env.example .env`

| Variável | Para que serve | Valor padrão |
|---|---|---|
| `PORT` | Porta HTTP | `3000` |
| `NODE_ENV` | Ambiente | `development` |
| `DATABASE_URL` | Arquivo do SQLite (relativo à pasta `prisma/`) | `file:./dev.db` |
| `JWT_SECRET` | Segredo de assinatura do JWT (**troque em produção**, ≥ 32 caracteres) | valor de exemplo |
| `JWT_EXPIRES_IN` | Validade do token em segundos | `3600` |
| `CORS_ORIGINS` | Origens permitidas (separadas por vírgula) | `*` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error`, `silent` | `info` |
| `PAYMENT_MOCK_LATENCY_MS` / `PAYMENT_TIMEOUT_MS` / `PAYMENT_MAX_RETRIES` | Latência simulada, timeout e novas tentativas do gateway | `150` / `2000` / `2` |

### 4. Criar o banco, aplicar as migrations e o seed

```bash
npm run setup
```

Equivale a `npx prisma migrate deploy` (cria `prisma/dev.db` com as 14 tabelas) seguido de
`npx prisma db seed` (3 unidades, 9 produtos, cardápios, estoques, 7 usuários e 3 promoções).
Para voltar os dados ao estado inicial a qualquer momento: `npm run db:seed`.

### 5. Iniciar a API

```bash
npm run dev
```

(ou `npm start` sem recarregamento automático). A API sobe em <http://localhost:3000>.

### 6. Acessar a documentação

Abra <http://localhost:3000/docs>, faça `POST /auth/login` com um usuário de demonstração, clique em
**Authorize** e cole o `accessToken`.

## Documentação da API (Swagger)

- **Swagger UI:** `http://localhost:3000/docs` (rota `/docs`)
- **Especificação OpenAPI 3:** `http://localhost:3000/docs/openapi.json` — arquivo-fonte em
  [`src/api/docs/openapi.yaml`](src/api/docs/openapi.yaml)
- Contém os 35 endpoints implementados, perfis exigidos, exemplos de request/response, códigos de status e o
  padrão de erro. Resumo por recurso em [`docs/3-api-endpoints.md`](docs/3-api-endpoints.md).

## Usuários de demonstração

| Perfil | E-mail | Senha | Unidade |
|---|---|---|---|
| ADMIN (matriz) | `admin@raizes.dev` | `Admin@123` | toda a rede |
| GERENTE | `gerente.recife@raizes.dev` | `Gerente@123` | 1 — Recife |
| ATENDENTE | `atendente.recife@raizes.dev` | `Atendente@123` | 1 — Recife |
| COZINHA | `cozinha.recife@raizes.dev` | `Cozinha@123` | 1 — Recife |
| GERENTE | `gerente.fortaleza@raizes.dev` | `Gerente@123` | 2 — Fortaleza |
| CLIENTE | `maria@example.com` | `Cliente@123` | fidelidade ativa (150 pontos) |
| CLIENTE | `joao@example.com` | `Cliente@123` | sem consentimento de fidelidade |

São dados fictícios, criados apenas pelo seed de desenvolvimento.

### Gateway de pagamento simulado

O campo `tokenPagamento` (que num gateway real seria o token do cartão) define o resultado:

| `tokenPagamento` | Resultado |
|---|---|
| `tok_aprovado` (ou omitido) | `APROVADO` → pedido vai para `EM_PREPARO` |
| `tok_recusado` | `RECUSADO` (saldo insuficiente) → pedido continua `AGUARDANDO_PAGAMENTO` |
| `tok_cartao_bloqueado` | `RECUSADO` (cartão bloqueado) |
| `tok_instavel` | 1ª chamada sofre timeout; a nova tentativa aprova (`tentativasGateway: 2`) |
| `tok_indisponivel` | gateway fora do ar → **503** e pagamento com status `ERRO` |

## Fluxo principal em 4 chamadas

```bash
# 1) Login do cliente
curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"maria@example.com","senha":"Cliente@123"}'

# 2) Criar pedido pelo APP (use o accessToken retornado)
curl -s -X POST http://localhost:3000/pedidos -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"unidadeId":1,"canalPedido":"APP","itens":[{"produtoId":1,"quantidade":2},{"produtoId":6,"quantidade":1}]}'

# 3) Pagar com o gateway mock
curl -s -X POST http://localhost:3000/pagamentos -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 6f1d2c3b-0000-4000-8000-000000000001" -d '{"pedidoId":1,"metodo":"PIX"}'

# 4) Consultar o pedido (status EM_PREPARO, histórico e pagamentos)
curl -s http://localhost:3000/pedidos/1 -H "Authorization: Bearer <TOKEN>"
```

## Como rodar os testes

| Comando | O que faz |
|---|---|
| `npm test` | Cria `prisma/test.db`, aplica as migrations e roda os **66 testes** (unidade + integração) |
| `npm run test:unit` | Só os testes de unidade (domínio e gateway), sem banco |
| `npm run test:postman` | Cria `prisma/postman.db`, sobe a API e executa a **coleção Postman** com o Newman; gera `docs/evidencias/resultado-postman.md` |

### Pelo Postman

1. `npm run setup` e `npm run dev`;
2. Postman → **Import** → [`postman/raizes-do-nordeste.postman_collection.json`](postman/raizes-do-nordeste.postman_collection.json);
3. **Run collection**, pastas na ordem `01` → `10` (os tokens e IDs são salvos automaticamente em variáveis da coleção);
4. Para repetir do zero: `npm run db:seed`.

Os 35 cenários (T01–T35), com pré-condições, entradas e saídas esperadas, estão em
[`docs/5-plano-de-testes.md`](docs/5-plano-de-testes.md).

## Estrutura do projeto

```text
├── prisma/
│   ├── schema.prisma          # modelo de dados (fonte do DER)
│   ├── migrations/            # migrations versionadas (SQL)
│   └── seed.js                # dados de demonstração
├── src/
│   ├── api/                   # camada de interface: rotas, middlewares, controllers,
│   │                          #   schemas (Zod), presenters e OpenAPI
│   ├── application/           # casos de uso (pedidos, pagamentos, estoque, LGPD...)
│   ├── domain/                # regras de negócio puras (status, canais, fidelidade...)
│   ├── infrastructure/        # Prisma/repositórios, gateway mock, JWT/bcrypt, logs
│   ├── config/env.js
│   ├── app.js
│   └── server.js
├── tests/                     # unit/ e integration/
├── postman/                   # coleção Postman (plano de testes)
├── scripts/                   # banco de teste e execução da coleção
└── docs/                      # requisitos, modelagem, API, LGPD, testes, diagramas e evidências
```

## Documentação técnica

1. [Análise do problema e requisitos](docs/1-requisitos.md) — RF/RNF, multicanalidade e priorização do MVP
2. [Modelagem e arquitetura](docs/2-modelagem.md) — casos de uso, descrição de feature, DER, classes, sequência e camadas
3. [API e endpoints](docs/3-api-endpoints.md) — contrato, convenções e padrão de erro
4. [LGPD, privacidade e segurança](docs/4-lgpd-seguranca.md) — dados coletados, base legal, consentimento, auditoria
5. [Plano de testes](docs/5-plano-de-testes.md) — 35 cenários e checklist de cobertura

### Implementado × proposto

Implementado: requisitos RF01–RF18 (ver [requisitos](docs/1-requisitos.md)). Propostas de evolução: notificação
de pedido pronto, webhook assíncrono do gateway (PIX), dashboard por canal/unidade, refresh token/logout,
expiração automática de pedidos não pagos e migração para PostgreSQL em produção.

---

Projeto acadêmico — Dylines Guanipa, 2026.
