# Evidência de execução — coleção Postman

Gerado automaticamente por `npm run test:postman` (Newman) em 2026-10-12T22:20:49.850Z.

- Requisições: **45** (falhas: 0)
- Asserções: **91** (falhas: 0)
- Duração total: 7 s

| Requisição | Método | Rota | Status | Asserções |
|---|---|---|---|---|
| T01 - Login válido (CLIENTE) | POST | `/auth/login` | 200 | ✅ 2/2 |
| Setup - Login ADMIN | POST | `/auth/login` | 200 | ✅ 2/2 |
| Setup - Login GERENTE (Recife) | POST | `/auth/login` | 200 | ✅ 2/2 |
| Setup - Login ATENDENTE (Recife) | POST | `/auth/login` | 200 | ✅ 2/2 |
| Setup - Login COZINHA (Recife) | POST | `/auth/login` | 200 | ✅ 2/2 |
| Setup - Login GERENTE (Fortaleza) | POST | `/auth/login` | 200 | ✅ 2/2 |
| Setup - Login CLIENTE (João) | POST | `/auth/login` | 200 | ✅ 2/2 |
| T02 - Login com senha inválida (401) | POST | `/auth/login` | 401 | ✅ 2/2 |
| T03 - Cadastro de cliente com consentimento (201) | POST | `/auth/registro` | 201 | ✅ 2/2 |
| T04 - Cadastro com e-mail, senha e aceite inválidos (422) | POST | `/auth/registro` | 422 | ✅ 3/3 |
| T05 - Consultar cardápio da unidade 1 (público) | GET | `/unidades/1/cardapio` | 200 | ✅ 2/2 |
| Listar unidades (paginado) | GET | `/unidades?page=1&limit=10` | 200 | ✅ 2/2 |
| Listar produtos por categoria | GET | `/produtos?categoria=LANCHES&page=1&limit=5` | 200 | ✅ 1/1 |
| T06 - Criar pedido APP com itens válidos e cupom (201) | POST | `/pedidos` | 201 | ✅ 2/2 |
| T07 - Listar pedidos filtrando por canalPedido=APP | GET | `/pedidos?canalPedido=APP&status=AGUARDANDO_PAGAMENTO&page=1&limit=10` | 200 | ✅ 2/2 |
| Detalhar pedido | GET | `/pedidos/1` | 200 | ✅ 1/1 |
| T08 - Pagamento recusado pelo gateway (tok_recusado) | POST | `/pagamentos` | 201 | ✅ 2/2 |
| T09 - Pagamento aprovado com Idempotency-Key (201) | POST | `/pagamentos` | 201 | ✅ 2/2 |
| T10 - Reenvio com a mesma Idempotency-Key (200, sem nova cobrança) | POST | `/pagamentos` | 200 | ✅ 3/3 |
| T11 - Pagar pedido que já foi pago (409) | POST | `/pagamentos` | 409 | ✅ 2/2 |
| T12 - Cozinha marca pedido como PRONTO | PATCH | `/pedidos/1/status` | 200 | ✅ 2/2 |
| T13 - Cozinha tenta marcar como ENTREGUE (403) | PATCH | `/pedidos/1/status` | 403 | ✅ 2/2 |
| T14 - Atendente marca pedido como ENTREGUE | PATCH | `/pedidos/1/status` | 200 | ✅ 2/2 |
| T15 - Alterar pedido já ENTREGUE (409) | PATCH | `/pedidos/1/status` | 409 | ✅ 2/2 |
| T16 - Auditoria registra criação e mudanças de status do pedido (ADMIN) | GET | `/auditoria?entidade=Pedido&entidadeId=1` | 200 | ✅ 2/2 |
| T17 - Saldo de pontos após a compra (fidelidade) | GET | `/fidelidade/saldo` | 200 | ✅ 2/2 |
| Extrato de pontos | GET | `/fidelidade/extrato?page=1&limit=10` | 200 | ✅ 1/1 |
| T18 - Listar pedidos sem token (401) | GET | `/pedidos` | 401 | ✅ 2/2 |
| T19 - Cliente tenta criar produto (403) | POST | `/produtos` | 403 | ✅ 2/2 |
| T20 - Pedido sem canalPedido (422) | POST | `/pedidos` | 422 | ✅ 3/3 |
| T21 - Pedido com canal inválido e quantidade negativa (422) | POST | `/pedidos` | 422 | ✅ 3/3 |
| T22 - Pedido com produto fora do cardápio da unidade (404) | POST | `/pedidos` | 404 | ✅ 2/2 |
| T23 - Pedido com estoque insuficiente (409) | POST | `/pedidos` | 409 | ✅ 3/3 |
| T24 - Cliente consulta pedido de outro cliente (404) | GET | `/pedidos/1` | 404 | ✅ 2/2 |
| T25 - Parâmetro de rota inválido (400) | GET | `/pedidos/abc` | 400 | ✅ 2/2 |
| T26 - Consultar saldo de estoque da unidade (GERENTE) | GET | `/estoque?unidadeId=1&page=1&limit=20` | 200 | ✅ 2/2 |
| T27 - Registrar entrada de estoque (GERENTE) | POST | `/estoque/movimentacoes` | 201 | ✅ 2/2 |
| T28 - Gerente de outra unidade movimenta estoque de Recife (403) | POST | `/estoque/movimentacoes` | 403 | ✅ 2/2 |
| T29 - Criar pedido TOTEM com resgate de pontos (201) | POST | `/pedidos` | 201 | ✅ 2/2 |
| T30 - Pagamento PIX com gateway instável (aprovado após nova tentativa) | POST | `/pagamentos` | 201 | ✅ 2/2 |
| T31 - Gerente cancela pedido pago (estorno + devolução de estoque) | PATCH | `/pedidos/2/status` | 200 | ✅ 2/2 |
| T32 - Criar pedido PICKUP (201) | POST | `/pedidos` | 201 | ✅ 1/1 |
| T33 - Gateway de pagamento indisponível (503) | POST | `/pagamentos` | 503 | ✅ 2/2 |
| T34 - Cliente concede consentimento de fidelidade | PUT | `/usuarios/me/consentimentos` | 200 | ✅ 2/2 |
| T35 - Exportar dados pessoais do titular | GET | `/usuarios/me/dados` | 200 | ✅ 2/2 |
