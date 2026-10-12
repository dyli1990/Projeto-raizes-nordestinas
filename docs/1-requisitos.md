# Análise do problema e requisitos

## Contexto do negócio

A **Raízes do Nordeste** é uma rede de lanchonetes de comida nordestina em expansão, organizada como
**matriz + unidades** (modelo de franquia). A matriz define o catálogo de produtos, as campanhas e as
regras do programa de fidelidade; cada unidade tem **cardápio com preço local, estoque próprio e equipe
própria** (gerente, atendentes e cozinha).

Os pedidos chegam por **vários canais** — aplicativo (APP), site (WEB), autoatendimento na loja (TOTEM),
retirada agendada (PICKUP) e atendimento presencial (BALCAO). Hoje cada canal funciona de forma isolada,
o que gera três problemas: venda de itens sem estoque, falta de visão consolidada por canal/unidade e
dificuldade de cumprir a LGPD (dados de clientes espalhados e sem registro de consentimento).

O objetivo do back-end é ser a **fonte única de verdade** para pedidos, estoque, pagamentos e
fidelização, expondo uma API REST consumida por todos os canais.

## Atores e perfis de acesso

| Ator | Perfil (role) | Escopo |
|---|---|---|
| Cliente (App/Web/Totem/Pickup) | `CLIENTE` | Apenas os próprios pedidos e dados |
| Atendente (balcão) | `ATENDENTE` | Pedidos da sua unidade; registra pedidos de balcão e entregas |
| Cozinha | `COZINHA` | Pedidos da sua unidade; marca pedidos como prontos |
| Gerente da unidade | `GERENTE` | Cardápio, estoque, pedidos e cancelamentos da sua unidade |
| Administrador (matriz) | `ADMIN` | Toda a rede: unidades, catálogo, promoções, usuários e auditoria |
| Gateway de pagamento | sistema externo | Autoriza e estorna pagamentos (simulado/mock) |

## Requisitos funcionais (RF)

Prioridade pelo método **MoSCoW**: *M* = Must (obrigatório no MVP), *S* = Should (importante),
*C* = Could (desejável).

| ID | Requisito | Prioridade | Situação | Onde está |
|---|---|:---:|---|---|
| RF01 | Cadastro de clientes com aceite de termos e registro de consentimentos | M | Implementado | `POST /auth/registro` |
| RF02 | Autenticação com token JWT e autorização por perfil (roles) | M | Implementado | `POST /auth/login` + middlewares |
| RF03 | Cadastro de usuários da equipe vinculados a uma unidade | S | Implementado | `POST /usuarios` |
| RF04 | Gestão de unidades da rede | S | Implementado | `GET/POST /unidades` |
| RF05 | Catálogo central de produtos (CRUD, exclusão lógica) | M | Implementado | `/produtos` |
| RF06 | Cardápio por unidade (preço local e disponibilidade) | M | Implementado | `GET/PUT /unidades/{id}/cardapio` |
| RF07 | Controle de estoque por unidade: entrada, saída e saldo | M | Implementado | `/estoque`, `/estoque/movimentacoes` |
| RF08 | Restrição de venda por indisponibilidade (sem estoque → não vende) | M | Implementado | `POST /pedidos` (409) |
| RF09 | Realização de pedido com itens, valores, status e **canalPedido** | M | Implementado | `POST /pedidos` |
| RF10 | Consulta e filtro de pedidos por canal, status e unidade (paginado) | M | Implementado | `GET /pedidos?canalPedido=` |
| RF11 | Atualização de status: cozinha → pronto → entregue / cancelado | M | Implementado | `PATCH /pedidos/{id}/status` |
| RF12 | Cancelamento com devolução de estoque, estorno e devolução de pontos | S | Implementado | `PATCH /pedidos/{id}/status` |
| RF13 | Solicitação de pagamento a serviço externo (mock) e registro do retorno | M | Implementado | `POST /pagamentos` |
| RF14 | Idempotência do pagamento (evitar cobrança dupla) | S | Implementado | cabeçalho `Idempotency-Key` |
| RF15 | Fidelização: acúmulo de pontos e resgate simples, **somente com consentimento** | S | Implementado | `/fidelidade`, `pontosResgatar` |
| RF16 | Promoções/campanhas por cupom (rede toda ou por unidade, com vigência) | S | Implementado | `/promocoes`, `codigoPromocao` |
| RF17 | Direitos do titular: consentimento, exportação e anonimização | M | Implementado | `/usuarios/me/...` |
| RF18 | Trilha de auditoria de ações sensíveis | M | Implementado | `GET /auditoria` |
| RF19 | Notificação ao cliente quando o pedido fica pronto (push/SMS) | C | Proposto | — |
| RF20 | Confirmação assíncrona do gateway por webhook (PIX) | C | Proposto | — |
| RF21 | Relatórios consolidados por canal/unidade (dashboard) | C | Parcial | filtros de `GET /pedidos` |
| RF22 | Renovação de token (refresh) e logout com revogação | C | Proposto | — |

## Requisitos não funcionais (RNF)

| ID | Requisito | Como foi atendido |
|---|---|---|
| RNF01 | **Segurança** | Senha com bcrypt (custo 10); JWT HS256 com expiração de 1 h; RBAC por perfil e escopo por unidade; `helmet`; CORS configurável; *rate limit* no login (20/min/IP) e global; validação de toda entrada com Zod; erros sem *stack trace*. |
| RNF02 | **LGPD** | Minimização (sem CPF e sem dados de cartão), consentimento registrado e versionado, exportação e anonimização de dados, e-mail mascarado na auditoria. Ver [LGPD e segurança](4-lgpd-seguranca.md). |
| RNF03 | **Logs e auditoria** | Log estruturado em JSON por requisição (método, rota, status, duração, usuário, `requestId`) sem corpo/dados pessoais; tabela `logs_auditoria` gravada na mesma transação da ação sensível. |
| RNF04 | **Desempenho em horários de pico** | Baixa de estoque atômica e condicional (`UPDATE … WHERE quantidade >= q`), índices por unidade/status/canal, paginação obrigatória (máx. 100), corpo limitado a 100 KB e timeout na chamada ao gateway. Proposta de evolução: PostgreSQL com pool, cache do cardápio e fila para notificações. |
| RNF05 | **Disponibilidade** | API *stateless* (JWT), pronta para várias instâncias atrás de um balanceador; `GET /health` verifica o banco; encerramento gracioso (SIGTERM). |
| RNF06 | **Tolerância a falhas no pagamento** | Pagamento registrado como `PENDENTE` antes da chamada externa; timeout + até 2 novas tentativas com *backoff* exponencial; status `ERRO` e resposta 503 quando o gateway cai; idempotência; estorno de compensação em caso de cobrança concorrente. |
| RNF07 | **Documentação** | OpenAPI 3 em `/docs` (Swagger UI) com exemplos de request/response e códigos de status. |
| RNF08 | **Testabilidade** | 66 testes automatizados (unidade + integração) e coleção Postman com 35 cenários executável via Newman. |
| RNF09 | **Manutenibilidade** | Arquitetura em camadas (API, Application, Domain, Infrastructure) e regras de negócio isoladas e testáveis. |
| RNF10 | **Portabilidade do banco** | Persistência via Prisma ORM com migrations versionadas; trocar SQLite por PostgreSQL exige apenas mudar o `provider` e a `DATABASE_URL`. |

## Multicanalidade (requisito de domínio)

O canal de origem é **dado de domínio** do pedido, não um detalhe de interface:

- `pedidos.canalPedido` é um **ENUM obrigatório** (`APP`, `TOTEM`, `BALCAO`, `PICKUP`, `WEB`) com índice no banco;
- `POST /pedidos` sem `canalPedido`, ou com valor fora do ENUM, retorna **422** no formato de erro padrão;
- regra de negócio: `BALCAO` só pode ser usado pela equipe da unidade (cliente recebe 422 `CANAL_NAO_PERMITIDO`);
- `GET /pedidos?canalPedido=TOTEM&status=…` permite consolidar e acompanhar o fluxo por canal;
- o canal é gravado na auditoria (`PEDIDO_CRIADO`), na movimentação de estoque ("Venda - pedido #12 (TOTEM)")
  e no histórico de status, garantindo **rastreabilidade operacional entre canais**.

## Priorização e escopo do MVP

O roteiro pede um fluxo crítico fechado ponta a ponta. Foi escolhido o **Fluxo A — Pedido → Pagamento mock →
Atualização de status**, porque é o fluxo que gera receita e concentra as regras mais importantes do negócio
(estoque, valores, canal, pagamento externo, fidelidade e auditoria).

Para que o Fluxo A funcione de verdade, partes do **Fluxo B (estoque por unidade)** também foram entregues:
sem saldo por unidade não é possível impedir a venda de itens indisponíveis.

**Implementado (MVP):** RF01–RF18, todos com persistência real, documentação Swagger e testes.

**Proposto (evolução):** RF19–RF22. Ficaram fora do MVP por dependerem de integrações reais (push/SMS,
webhook do provedor de pagamento) ou por não serem necessários para fechar o fluxo crítico. A arquitetura
já prevê esses pontos: o gateway é uma interface substituível e a auditoria/histórico já fornecem os eventos
que alimentariam notificações e relatórios.

**Decisões técnicas e trade-offs:**

| Decisão | Motivo | Trade-off |
|---|---|---|
| Node.js + Express 5 + Prisma | Ecossistema maduro, migrations versionadas e tipagem do cliente gerado | Menos "opinativo" que frameworks como NestJS: a organização em camadas foi feita manualmente |
| SQLite | Execução local sem instalar servidor de banco; o corretor roda com `npm run setup` | Concorrência de escrita limitada; em produção, usar PostgreSQL (mesmo schema Prisma) |
| Valores em centavos (inteiros) | Evitar erros de arredondamento de ponto flutuante | Conversão para reais na camada de API |
| Pagamento síncrono com mock | Fecha o fluxo e permite testar aprovado/recusado/indisponível de forma determinística | PIX real é assíncrono → webhook proposto (RF20) |
| Estoque baixado na criação do pedido (reserva) | Evita vender o mesmo item duas vezes no pico | Pedido não pago segura o estoque até ser cancelado (proposta: expiração automática) |
