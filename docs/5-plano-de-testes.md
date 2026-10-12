# Plano de testes

## Estratégia

| Nível | Ferramenta | O que cobre | Como executar |
|---|---|---|---|
| Unidade | `node:test` | Regras de domínio (máquina de status, canais, fidelidade, promoções, LGPD, acesso) e gateway mock (timeout, nova tentativa, indisponibilidade) | `npm run test:unit` |
| Integração | `node:test` + `supertest` + SQLite de teste | API completa com banco real: fluxo pedido → pagamento → status e todos os erros | `npm test` (66 testes) |
| Ponta a ponta (evidência) | **Coleção Postman** + Newman | 35 cenários (T01–T35) organizados em pastas, com asserções automáticas | Postman *Run collection* ou `npm run test:postman` |

**Resultado da última execução:** `npm test` → 66/66 aprovados; `npm run test:postman` → 45 requisições,
91 asserções, 0 falhas (ver [evidencias/resultado-postman.md](evidencias/resultado-postman.md)).

## Como reproduzir com o Postman

1. Suba a API com dados limpos: `npm run setup` (migrations + seed) e `npm run dev`.
2. No Postman: **Import** → `postman/raizes-do-nordeste.postman_collection.json`.
3. Confira a variável de coleção `baseUrl` (`http://localhost:3000`).
4. Clique em **Run collection** e execute as pastas **na ordem** (01 → 10). Não é preciso copiar tokens: os
   logins da pasta 01 salvam os tokens (`tokenCliente`, `tokenAdmin`, …) e os pedidos criados salvam os IDs
   (`pedidoId`, …) em variáveis da coleção.
5. Para rodar de novo do zero, reaplique o seed (`npm run db:seed`).

Alternativa sem Postman instalado: `npm run test:postman` cria um banco exclusivo, sobe a API, roda a
coleção com o Newman e grava a evidência em `docs/evidencias/resultado-postman.md`.

**Usuários do seed:** `maria@example.com` / `Cliente@123` (cliente com fidelidade e 150 pontos),
`joao@example.com` / `Cliente@123` (sem consentimento de fidelidade), `admin@raizes.dev` / `Admin@123`,
`gerente.recife@raizes.dev` / `Gerente@123`, `atendente.recife@raizes.dev` / `Atendente@123`,
`cozinha.recife@raizes.dev` / `Cozinha@123`, `gerente.fortaleza@raizes.dev` / `Gerente@123`.

## Cenários (T01–T35)

Pré-condição comum: seed aplicado e pastas executadas em ordem. **P** = positivo, **N** = negativo.

| ID | Tipo | Cenário | Endpoint | Pré-condição | Entrada | Esperado (status + response) | Evidência (nome na coleção) |
|---|:---:|---|---|---|---|---|---|
| T01 | P | Login válido | `POST /auth/login` | usuário do seed | `{email: maria@…, senha}` | 200 + `accessToken`, `tokenType: Bearer`, `expiresIn: 3600`, sem `senhaHash` | 01 - Auth / T01 - Login válido (CLIENTE) |
| T02 | N | Senha inválida | `POST /auth/login` | — | senha errada | 401 `CREDENCIAIS_INVALIDAS` (erro padrão) | 01 - Auth / T02 |
| T03 | P | Cadastro com consentimento | `POST /auth/registro` | e-mail novo | nome, e-mail, senha, `aceiteTermos`, consentimentos | 201, perfil CLIENTE, sem senha/hash | 01 - Auth / T03 |
| T04 | N | Campos inválidos/ausentes | `POST /auth/registro` | — | e-mail inválido, senha curta, sem aceite | 422 `VALIDACAO_FALHOU` com `details` de email, senha, aceiteTermos | 01 - Auth / T04 |
| T05 | P | Cardápio por unidade | `GET /unidades/1/cardapio` | — | path `id=1` | 200 + itens com `preco` e `disponivel` | 02 / T05 |
| T06 | P | **Pedido com itens válidos** | `POST /pedidos` | T01 (token cliente) | unidade 1, `canalPedido: APP`, 2 itens, cupom NORDESTE10 | 201, `AGUARDANDO_PAGAMENTO`, subtotal 55,30, total 49,77 | 03 / T06 |
| T07 | P | Filtro por canal | `GET /pedidos?canalPedido=APP` | T06 | query canal/status/paginação | 200, todos com `canalPedido = APP`, `meta` | 03 / T07 |
| T08 | N | **Pagamento mock recusado** | `POST /pagamentos` | T06 | `tokenPagamento: tok_recusado` | 201, `status: RECUSADO`, `motivoRecusa: SALDO_INSUFICIENTE`, pedido segue `AGUARDANDO_PAGAMENTO` | 04 / T08 |
| T09 | P | **Pagamento mock aprovado → status atualizado** | `POST /pagamentos` | T08 | `tok_aprovado` + `Idempotency-Key` | 201, `APROVADO`, `transacaoExternaId mock_…`, pedido `EM_PREPARO` | 04 / T09 |
| T10 | P | Idempotência | `POST /pagamentos` | T09 | mesma `Idempotency-Key` | 200 + `Idempotent-Replayed: true`, sem nova cobrança | 04 / T10 |
| T11 | N | Pagar pedido já pago | `POST /pagamentos` | T09 | mesmo pedido | 409 `PEDIDO_NAO_AGUARDA_PAGAMENTO` | 04 / T11 |
| T12 | P | Cozinha → PRONTO | `PATCH /pedidos/{id}/status` | T09 (token cozinha) | `{status: PRONTO}` | 200, `status: PRONTO` | 05 / T12 |
| T13 | N | **Perfil sem permissão (403)** | `PATCH /pedidos/{id}/status` | T12 | cozinha envia `ENTREGUE` | 403 `PERFIL_SEM_PERMISSAO` | 05 / T13 |
| T14 | P | Atendente → ENTREGUE | `PATCH /pedidos/{id}/status` | T12 | `{status: ENTREGUE}` | 200, histórico AGUARDANDO_PAGAMENTO → EM_PREPARO → PRONTO → ENTREGUE | 05 / T14 |
| T15 | N | Transição inválida | `PATCH /pedidos/{id}/status` | T14 | `{status: PRONTO}` | 409 `TRANSICAO_STATUS_INVALIDA` | 05 / T15 |
| T16 | P | **Auditoria de ação sensível** | `GET /auditoria?entidade=Pedido&entidadeId={id}` | T14 (token admin) | filtros | 200, contém `PEDIDO_CRIADO` e `PEDIDO_STATUS_ALTERADO` | 06 / T16 |
| T17 | P | Pontos acumulados | `GET /fidelidade/saldo` | T09 | — | 200, `consentimentoAtivo: true`, saldo > 150 | 06 / T17 |
| T18 | N | **Sem token (401)** | `GET /pedidos` | — | sem `Authorization` | 401 `TOKEN_AUSENTE` | 07 / T18 |
| T19 | N | **Perfil sem permissão (403)** | `POST /produtos` | token cliente | produto válido | 403 `ACESSO_NEGADO` | 07 / T19 |
| T20 | N | **Campo obrigatório ausente** | `POST /pedidos` | token cliente | sem `canalPedido` | 422, `details[0].field = canalPedido` | 07 / T20 |
| T21 | N | **Tipo/formato inválido** | `POST /pedidos` | token cliente | `canalPedido: DRONE`, `quantidade: -2` | 422 com `canalPedido` e `itens[0].quantidade` | 07 / T21 |
| T22 | N | **Produto/unidade inexistente (404)** | `POST /pedidos` | — | produto 8 na unidade 2 (fora do cardápio) | 404 `PRODUTO_NAO_ENCONTRADO` | 07 / T22 |
| T23 | N | **Estoque insuficiente (409)** | `POST /pedidos` | estoque do produto 8 = 3 | quantidade 50 | 409 `ESTOQUE_INSUFICIENTE`, `issue: "Disponível: N"` | 07 / T23 |
| T24 | N | Pedido de outro cliente | `GET /pedidos/{id}` | T06 (token João) | id do pedido da Maria | 404 `PEDIDO_NAO_ENCONTRADO` | 07 / T24 |
| T25 | N | Parâmetro inválido | `GET /pedidos/abc` | token | id não numérico | 400 `PARAMETRO_INVALIDO` | 07 / T25 |
| T26 | P | Saldo por unidade | `GET /estoque?unidadeId=1` | token gerente | — | 200, só unidade 1 | 08 / T26 |
| T27 | P | Entrada de estoque | `POST /estoque/movimentacoes` | token gerente | ENTRADA de 20 | 201, `saldoAtual = saldoApos` | 08 / T27 |
| T28 | N | Gerente de outra unidade | `POST /estoque/movimentacoes` | token gerente Fortaleza | unidade 1 | 403 `ACESSO_UNIDADE_NEGADO` | 08 / T28 |
| T29 | P | Pedido TOTEM com resgate de pontos | `POST /pedidos` | cliente com consentimento | `pontosResgatar: 50` | 201, desconto 5,00 | 09 / T29 |
| T30 | P | Gateway instável (tolerância a falhas) | `POST /pagamentos` | T29 | `tok_instavel` | 201, `APROVADO`, `tentativasGateway: 2` | 09 / T30 |
| T31 | P | Cancelamento com estorno | `PATCH /pedidos/{id}/status` | T30 (token gerente) | `CANCELADO` + motivo | 200, `CANCELADO`, pagamento `ESTORNADO` | 09 / T31 |
| T32 | P | Pedido PICKUP | `POST /pedidos` | token cliente | canal PICKUP | 201 | 09 / T32 |
| T33 | N | Gateway indisponível | `POST /pagamentos` | T32 | `tok_indisponivel` | 503 `GATEWAY_PAGAMENTO_INDISPONIVEL` | 09 / T33 |
| T34 | P | Consentimento LGPD | `PUT /usuarios/me/consentimentos` | token João | FIDELIDADE = true | 200, consentimento ativo | 10 / T34 |
| T35 | P | Portabilidade LGPD | `GET /usuarios/me/dados` | token cliente | — | 200 com titular, consentimentos, pedidos e fidelidade, sem `senhaHash` | 10 / T35 |

Total: **19 positivos e 16 negativos** (mínimo exigido: 6 e 4).

## Checklist de cobertura obrigatória

| Exigência do roteiro | Cenários |
|---|---|
| Login com token válido | T01 |
| Acesso sem token (401) | T18 (e T02 para credenciais inválidas) |
| Perfil sem permissão (403) | T13, T19, T28 |
| Campo obrigatório ausente (400/422) | T04, T20 |
| Tipo/formato inválido (400/422) | T04 (e-mail), T21 (quantidade negativa), T25 |
| Pedido válido → criado (201) | T06, T29, T32 |
| Produto/unidade inexistente (404) | T22 |
| Estoque insuficiente (409) | T23 |
| Pagamento mock aprovado → status atualizado | T09, T30 |
| Pagamento mock recusado → status e mensagem coerentes | T08 (e T33 para indisponibilidade) |
| Ação sensível gera registro de auditoria | T16 |

## Testes automatizados (complementares)

Os arquivos em `tests/` repetem esses cenários e acrescentam verificações que só são possíveis olhando o
banco, por exemplo: o rollback total do estoque quando um dos itens falta, o hash bcrypt gravado, a
devolução exata de estoque e pontos no cancelamento, o e-mail mascarado na auditoria de login e o bloqueio
de login após a anonimização.
