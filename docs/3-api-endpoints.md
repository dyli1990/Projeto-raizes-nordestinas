# API e endpoints (contrato)

- **Base URL local:** `http://localhost:3000`
- **Swagger UI:** `http://localhost:3000/docs` · **OpenAPI JSON:** `http://localhost:3000/docs/openapi.json`
- **Autenticação:** `Authorization: Bearer <accessToken>` (JWT obtido em `POST /auth/login`)
- **Formato:** JSON (UTF-8); valores monetários em reais com duas casas (`49.77`)

## Convenções

| Regra | Aplicação |
|---|---|
| URLs no plural | `/pedidos`, `/produtos`, `/unidades`, `/pagamentos` |
| IDs no path | `/pedidos/{id}`, `/unidades/{id}/cardapio/{produtoId}` |
| Paginação | `?page=1&limit=10` (máx. 100) → resposta `{ "data": [...], "meta": { page, limit, total, totalPages } }` |
| 200 / 201 / 204 | consulta ou alteração / criação (com cabeçalho `Location`) / sem conteúdo |
| 400 | parâmetro de rota/consulta inválido, JSON malformado, `Idempotency-Key` inválida |
| 401 / 403 | não autenticado / sem permissão (perfil ou unidade) |
| 404 | recurso inexistente **ou fora do escopo do usuário** (não revela IDs de terceiros) |
| 409 | conflito com o estado atual: estoque, status, duplicidade, pedido já pago |
| 422 | corpo inválido (validação) ou regra de negócio violada |
| 429 / 503 | limite de requisições / gateway de pagamento indisponível |
| Rastreio | toda resposta traz o cabeçalho `X-Request-Id` |

## Padrão de erro (único para todas as falhas)

```json
{
  "error": "ESTOQUE_INSUFICIENTE",
  "message": "Não há quantidade suficiente para um ou mais itens.",
  "details": [{ "field": "itens[1].quantidade", "issue": "Disponível: 3" }],
  "timestamp": "2026-10-12T21:44:10.777Z",
  "path": "/pedidos",
  "requestId": "bd74d814-5a67-4450-b416-f27e53c76997"
}
```

`error` é um código estável (para o front-end tratar), `message` é legível para o usuário e `details`
aponta o campo exato. Erros inesperados retornam 500 `ERRO_INTERNO` **sem** stack trace; o detalhe fica
apenas no log do servidor, ligado pelo `requestId`.

## Endpoints por recurso

| Recurso | Método e rota | Acesso | Finalidade | Códigos |
|---|---|---|---|---|
| Saúde | `GET /health` | público | API e banco no ar | 200, 503 |
| /auth | `POST /auth/registro` | público | Cadastro de cliente + consentimentos | 201, 409, 422 |
| | `POST /auth/login` | público | Login, retorna JWT | 200, 401, 422, 429 |
| | `GET /auth/me` | JWT | Usuário autenticado | 200, 401 |
| /usuarios | `POST /usuarios` | ADMIN | Cria usuário da equipe | 201, 401, 403, 404, 409, 422 |
| | `GET /usuarios` | ADMIN | Lista usuários (acesso auditado) | 200, 401, 403 |
| | `GET /usuarios/me` | JWT | Perfil + consentimentos | 200, 401 |
| | `GET /usuarios/me/consentimentos` | JWT | Consentimentos atuais | 200, 401 |
| | `PUT /usuarios/me/consentimentos` | CLIENTE | Concede/revoga consentimento | 200, 401, 403, 422 |
| | `GET /usuarios/me/dados` | JWT | Exporta dados (portabilidade) | 200, 401 |
| | `DELETE /usuarios/me` | CLIENTE | Anonimiza a conta | 204, 401, 403, 409 |
| /unidades | `GET /unidades` | público | Lista unidades (paginado) | 200, 400 |
| | `POST /unidades` | ADMIN | Cria unidade | 201, 401, 403, 422 |
| | `GET /unidades/{id}` | público | Detalha unidade | 200, 400, 404 |
| | `GET /unidades/{id}/cardapio` | público | Cardápio com preço local e disponibilidade | 200, 400, 404 |
| | `PUT /unidades/{id}/cardapio/{produtoId}` | ADMIN, GERENTE (da unidade) | Define preço/disponibilidade | 200, 401, 403, 404, 422 |
| /produtos | `GET /produtos` | público | Catálogo (paginado, filtros) | 200, 400 |
| | `GET /produtos/{id}` | público | Detalha produto | 200, 400, 404 |
| | `POST /produtos` | ADMIN | Cria produto | 201, 401, 403, 422 |
| | `PUT /produtos/{id}` | ADMIN | Atualiza (parcial) | 200, 401, 403, 404, 422 |
| | `DELETE /produtos/{id}` | ADMIN | Exclusão lógica | 204, 401, 403, 404 |
| /estoque | `GET /estoque` | equipe (própria unidade) | Saldo por unidade | 200, 401, 403 |
| | `POST /estoque/movimentacoes` | ADMIN, GERENTE | Entrada/saída manual | 201, 401, 403, 404, 409, 422 |
| | `GET /estoque/movimentacoes` | ADMIN, GERENTE | Histórico de movimentações | 200, 401, 403 |
| /promocoes | `GET /promocoes` | público | Campanhas vigentes | 200 |
| | `POST /promocoes` | ADMIN | Cria campanha | 201, 401, 403, 409, 422 |
| /pedidos | `POST /pedidos` | CLIENTE, ATENDENTE, GERENTE, ADMIN | **Cria pedido (fluxo crítico)** | 201, 401, 403, 404, 409, 422 |
| | `GET /pedidos` | JWT (escopo por perfil) | Lista com filtros `canalPedido`, `status`, `unidadeId` | 200, 400, 401, 403 |
| | `GET /pedidos/{id}` | JWT (escopo por perfil) | Detalhe com itens, histórico e pagamentos | 200, 400, 401, 404 |
| | `PATCH /pedidos/{id}/status` | conforme a transição | Atualiza status / cancela | 200, 401, 403, 404, 409, 422, 503 |
| /pagamentos | `POST /pagamentos` | CLIENTE, ATENDENTE, GERENTE, ADMIN | **Solicita pagamento ao gateway (mock)** | 201, 200, 400, 401, 403, 404, 409, 422, 503 |
| | `GET /pagamentos/{id}` | JWT (escopo por perfil) | Consulta pagamento | 200, 401, 404 |
| /fidelidade | `GET /fidelidade/saldo` | CLIENTE | Saldo de pontos | 200, 401, 403 |
| | `GET /fidelidade/extrato` | CLIENTE | Extrato (paginado) | 200, 401, 403 |
| /auditoria | `GET /auditoria` | ADMIN | Trilha de auditoria (filtros) | 200, 401, 403 |

## Documentação detalhada dos endpoints do fluxo crítico

### /auth — Login

- **Finalidade:** autenticar o usuário e retornar o token de acesso.
- **Método/Rota:** `POST /auth/login` · **Auth:** público (limite de 20 tentativas/min por IP)
- **Request:**

```json
{ "email": "maria@example.com", "senha": "Cliente@123" }
```

- **Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": 6, "nome": "Maria Cliente", "perfil": "CLIENTE", "unidadeId": null }
}
```

- **Status codes:** 200, 401 (`CREDENCIAIS_INVALIDAS`), 422 (`VALIDACAO_FALHOU`), 429.

### /unidades — Consultar cardápio da unidade

- **Finalidade:** listar o que a unidade vende, com preço local e disponibilidade (estoque > 0).
- **Método/Rota:** `GET /unidades/{id}/cardapio` · **Auth:** público
- **Parâmetros:** path `id` (inteiro); query `categoria` (LANCHES, PRATOS, BEBIDAS, SOBREMESAS)
- **Response 200:**

```json
{
  "unidade": { "id": 1, "nome": "Raízes do Nordeste - Boa Viagem", "cidade": "Recife", "uf": "PE", "endereco": "Av. Boa Viagem, 1200", "ativa": true },
  "itens": [
    { "produtoId": 1, "nome": "Tapioca de Carne de Sol com Queijo Coalho", "descricao": "…", "categoria": "LANCHES", "preco": 22.9, "disponivel": true }
  ]
}
```

- **Status codes:** 200, 400, 404 (`UNIDADE_NAO_ENCONTRADA`).

### /pedidos — Criar pedido (fluxo crítico)

- **Finalidade:** criar um pedido validando canal, cardápio e estoque da unidade e calculando o total.
- **Método/Rota:** `POST /pedidos` · **Auth:** JWT — CLIENTE, ATENDENTE, GERENTE ou ADMIN
- **Body:** `unidadeId` (obrigatório), `canalPedido` (obrigatório, ENUM), `itens[]` (obrigatório, 1–30 itens,
  `quantidade` 1–50), `clienteId` (apenas equipe), `codigoPromocao`, `pontosResgatar`, `observacao`.
- **Request:**

```json
{
  "unidadeId": 1,
  "canalPedido": "APP",
  "itens": [
    { "produtoId": 1, "quantidade": 2 },
    { "produtoId": 6, "quantidade": 1 }
  ],
  "codigoPromocao": "NORDESTE10"
}
```

- **Response 201** (cabeçalho `Location: /pedidos/1`):

```json
{
  "id": 1,
  "unidadeId": 1,
  "unidade": "Raízes do Nordeste - Boa Viagem",
  "canalPedido": "APP",
  "status": "AGUARDANDO_PAGAMENTO",
  "clienteId": 6,
  "operadorId": null,
  "itens": [
    { "produtoId": 1, "nome": "Tapioca de Carne de Sol com Queijo Coalho", "quantidade": 2, "precoUnitario": 22.9, "subtotal": 45.8 },
    { "produtoId": 6, "nome": "Suco de Cajá 500 ml", "quantidade": 1, "precoUnitario": 9.5, "subtotal": 9.5 }
  ],
  "subtotal": 55.3,
  "desconto": 5.53,
  "total": 49.77,
  "pontosResgatados": 0,
  "promocaoId": 1,
  "historico": [{ "statusAnterior": null, "statusNovo": "AGUARDANDO_PAGAMENTO", "motivo": "Pedido criado via APP", "usuarioId": 6, "data": "2026-10-12T21:44:10.512Z" }],
  "pagamentos": [],
  "createdAt": "2026-10-12T21:44:10.512Z",
  "updatedAt": "2026-10-12T21:44:10.512Z"
}
```

- **Status codes:** 201; 401/403; 404 (unidade/produto inexistente); 409 (`ESTOQUE_INSUFICIENTE`,
  `PRODUTO_INDISPONIVEL`, `SALDO_PONTOS_INSUFICIENTE`); 422 (`VALIDACAO_FALHOU`, `CANAL_NAO_PERMITIDO`,
  `PROMOCAO_INVALIDA`, `CONSENTIMENTO_FIDELIDADE_AUSENTE`).
- **Erro 422 (canalPedido ausente):**

```json
{
  "error": "VALIDACAO_FALHOU",
  "message": "Os dados enviados são inválidos.",
  "details": [{ "field": "canalPedido", "issue": "canalPedido é obrigatório. Valores aceitos: APP, TOTEM, BALCAO, PICKUP, WEB." }],
  "timestamp": "2026-10-12T21:44:10.800Z",
  "path": "/pedidos",
  "requestId": "6c0e5a52-3a4f-4d55-9a0c-2f6f2d0f7b1e"
}
```

### /pedidos — Listar com filtro por canal

- **Método/Rota:** `GET /pedidos?canalPedido=APP&status=AGUARDANDO_PAGAMENTO&page=1&limit=10`
- **Auth:** JWT. CLIENTE vê os próprios; equipe vê a própria unidade (403 se pedir outra); ADMIN vê tudo.
- **Response 200:** `{ "data": [ <Pedido> ], "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 } }`
- **Status codes:** 200, 400 (filtro inválido), 401, 403.

### /pedidos — Atualizar status

- **Método/Rota:** `PATCH /pedidos/{id}/status` · **Auth:** JWT, perfil conforme a transição
- **Request:** `{ "status": "PRONTO" }` ou `{ "status": "CANCELADO", "motivo": "Cliente desistiu" }`

| De | Para | Perfis |
|---|---|---|
| AGUARDANDO_PAGAMENTO | CANCELADO | CLIENTE (dono), ATENDENTE, GERENTE, ADMIN |
| EM_PREPARO | PRONTO | COZINHA, GERENTE, ADMIN |
| EM_PREPARO | CANCELADO | GERENTE, ADMIN (com estorno) |
| PRONTO | ENTREGUE | ATENDENTE, GERENTE, ADMIN |

- **Status codes:** 200; 403 (`PERFIL_SEM_PERMISSAO`); 404; 409 (`TRANSICAO_STATUS_INVALIDA`);
  422 (`MOTIVO_OBRIGATORIO`); 503 (estorno indisponível).

### /pagamentos — Solicitar pagamento (gateway mock)

- **Finalidade:** enviar a cobrança ao serviço externo, registrar o retorno e atualizar o pedido.
- **Método/Rota:** `POST /pagamentos` · **Auth:** JWT — CLIENTE (PIX/cartão) ou equipe (inclui DINHEIRO)
- **Cabeçalho opcional:** `Idempotency-Key: <uuid>` (recomendado)
- **Request:**

```json
{ "pedidoId": 1, "metodo": "CARTAO_CREDITO", "tokenPagamento": "tok_aprovado" }
```

O `tokenPagamento` representa o token que um gateway real geraria no front-end — o back-end **nunca recebe
número de cartão**. No mock ele define o resultado: `tok_aprovado`, `tok_recusado`, `tok_cartao_bloqueado`,
`tok_instavel` (timeout na 1ª tentativa) e `tok_indisponivel` (503).

- **Response 201 — aprovado:**

```json
{
  "id": 2,
  "pedidoId": 1,
  "metodo": "CARTAO_CREDITO",
  "status": "APROVADO",
  "valor": 49.77,
  "transacaoExternaId": "mock_8f0c2b1e-5d4a-4c3b-9a2e-1f0d9c8b7a6e",
  "motivoRecusa": null,
  "tentativasGateway": 1,
  "gateway": { "transacaoId": "mock_8f0c…", "status": "APROVADO", "codigoRetorno": "00", "codigoAutorizacao": "482913" },
  "pedido": { "id": 1, "status": "EM_PREPARO", "total": 49.77 },
  "mensagem": "Pagamento aprovado. Pedido enviado para a cozinha (EM_PREPARO)."
}
```

- **Response 201 — recusado:** mesmo formato com `"status": "RECUSADO"`, `"motivoRecusa": "SALDO_INSUFICIENTE"`,
  `"pedido": { "status": "AGUARDANDO_PAGAMENTO" }` e mensagem orientando a tentar outro meio.
- **Status codes:** 201 (tentativa processada); 200 (reenvio idempotente, cabeçalho `Idempotent-Replayed: true`);
  400 (`Idempotency-Key` inválida); 401/403; 404; 409 (`PEDIDO_NAO_AGUARDA_PAGAMENTO`,
  `IDEMPOTENCY_KEY_REUTILIZADA`); 422 (`METODO_NAO_PERMITIDO`); 503 (`GATEWAY_PAGAMENTO_INDISPONIVEL`).

> **Por que 201 também para recusa?** A tentativa de pagamento é um recurso criado e persistido; a recusa é
> um resultado de negócio do gateway, não um erro do cliente da API. O status do pagamento e do pedido
> retornam explicitamente para o App/Totem/Web decidir o próximo passo.

### /estoque — Movimentar estoque

- **Método/Rota:** `POST /estoque/movimentacoes` · **Auth:** ADMIN ou GERENTE da unidade
- **Request:** `{ "unidadeId": 1, "produtoId": 8, "tipo": "ENTRADA", "quantidade": 20, "motivo": "Reposição do fornecedor" }`
- **Response 201:** `{ "movimentacao": { "tipo": "ENTRADA", "origem": "MANUAL", "quantidade": 20, "saldoApos": 23, … }, "saldoAtual": 23 }`
- **Status codes:** 201, 401, 403 (`ACESSO_UNIDADE_NEGADO`), 404, 409 (saída maior que o saldo), 422.
