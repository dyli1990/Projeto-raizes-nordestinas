# LGPD, privacidade e segurança no back-end

## Inventário de dados pessoais

| Dado | Titular | Finalidade | Base legal (Lei 13.709/2018) | Retenção |
|---|---|---|---|---|
| Nome | Cliente / equipe | Identificar o pedido e o usuário | Execução de contrato (art. 7º, V) | Enquanto a conta existir; anonimizado na exclusão |
| E-mail | Cliente / equipe | Login e contato sobre o pedido | Execução de contrato (art. 7º, V) | Idem |
| Senha (apenas hash bcrypt) | Cliente / equipe | Autenticação | Execução de contrato (art. 7º, V) | Idem; invalidada na exclusão |
| Telefone (opcional) | Cliente | Aviso de retirada (proposto) | Execução de contrato (art. 7º, V) | Idem |
| Histórico de pedidos e pagamentos | Cliente | Prestação do serviço e obrigações fiscais | Cumprimento de obrigação legal (art. 7º, II) | 5 anos (legislação tributária), **sem identificação** após anonimização |
| Pontos de fidelidade | Cliente | Programa Raízes+ | **Consentimento** (art. 7º, I) | Até a revogação/exclusão |
| Preferência de marketing | Cliente | Ofertas e campanhas | **Consentimento** (art. 7º, I) | Até a revogação |
| IP e ações na auditoria | Cliente / equipe | Segurança e rastreabilidade | Legítimo interesse (art. 7º, IX) e Marco Civil (art. 15) | 6 meses (proposta de expurgo automático) |

**Minimização:** a API **não coleta CPF, data de nascimento nem endereço** (não são necessários para retirar
um lanche) e **não recebe nem armazena dados de cartão** — apenas o token gerado pelo gateway e o ID da
transação devolvido por ele. O telefone é opcional.

## Registro do consentimento

- No cadastro (`POST /auth/registro`) o titular precisa aceitar os termos (`aceiteTermos: true`) e escolhe
  **separadamente** se adere à fidelidade (`consentimentoFidelidade`) e ao marketing (`consentimentoMarketing`).
- Cada decisão vira uma linha na tabela `consentimentos` com **tipo, concedido (sim/não), versão do termo,
  canal e data**. A tabela é *append-only*: revogar não apaga o registro anterior, cria outro — isso serve de
  prova (art. 8º, §2º: o ônus da prova do consentimento é do controlador).
- O titular pode conceder ou revogar a qualquer momento: `PUT /usuarios/me/consentimentos`.
- **Efeito prático:** sem consentimento FIDELIDADE, o cliente não acumula pontos e não pode resgatar
  (422 `CONSENTIMENTO_FIDELIDADE_AUSENTE`).

## Direitos do titular (art. 18) implementados

| Direito | Endpoint |
|---|---|
| Confirmação e acesso | `GET /usuarios/me`, `GET /usuarios/me/consentimentos` |
| Portabilidade (dados em formato estruturado) | `GET /usuarios/me/dados` (JSON com titular, consentimentos, pedidos e extrato de pontos) |
| Revogação do consentimento | `PUT /usuarios/me/consentimentos` |
| Eliminação | `DELETE /usuarios/me` → anonimização |
| Correção | Proposto (`PATCH /usuarios/me`) |

## Estratégia de retenção e anonimização

`DELETE /usuarios/me` não apaga fisicamente o cliente, porque os pedidos precisam ser guardados por
obrigação fiscal. Em vez disso:

1. nome vira "Titular anonimizado", e-mail vira `anonimizado+{id}@raizes.invalid`, telefone é apagado;
2. a senha é substituída por um hash aleatório e a conta é desativada — o token atual deixa de funcionar
   (o middleware consulta o usuário a cada requisição);
3. todos os consentimentos são revogados (novas linhas);
4. os pedidos permanecem, mas deixam de identificar a pessoa;
5. a ação é registrada na auditoria (`CONTA_ANONIMIZADA`).

A exclusão é bloqueada (409 `PEDIDOS_EM_ANDAMENTO`) enquanto houver pedido em andamento, para não
comprometer a entrega/estorno.

## Controles de segurança

| Controle | Implementação |
|---|---|
| Armazenamento seguro de senha | bcrypt com salt e custo 10 (`infrastructure/security/password.js`) |
| Política de senha | mínimo 8 caracteres, com letra e número |
| Autenticação por token | JWT HS256, `sub` = id do usuário, expiração de 1 h, emissor validado; segredo vindo de variável de ambiente (exigido ≥ 32 caracteres em produção) |
| Autorização por perfil (RBAC) | middleware `autorizar(...perfis)` em cada rota + regras por transição de status no domínio |
| Escopo por unidade | equipe só acessa pedidos/estoque da própria unidade (403 `ACESSO_UNIDADE_NEGADO`) |
| Anti-enumeração | pedido de outro cliente retorna 404; login com e-mail inexistente responde igual a senha errada e em tempo semelhante (hash fictício) |
| Força bruta | *rate limit* de 20 logins/min por IP (429) e limite global |
| Validação de entrada | Zod em body, query e params; corpo máximo de 100 KB |
| Respostas sem exposição | presenters com lista branca de campos (nunca `senhaHash`); erro 500 sem stack trace |
| Cabeçalhos HTTP | `helmet` (CSP, HSTS, X-Content-Type-Options…), `x-powered-by` desativado, CORS configurável |
| Logs sem dados pessoais | log JSON só com metadados; campos como `senha`, `token`, `authorization` são mascarados |
| Integridade financeira | idempotência de pagamento, compare-and-set de status, transações atômicas |

## Logs e auditoria de ações sensíveis

Toda ação sensível grava uma linha em `logs_auditoria` **dentro da mesma transação** da operação (se a
operação falha, o log é desfeito junto — não existem registros "fantasmas"):

| Ação | Quando |
|---|---|
| `LOGIN_SUCESSO` / `LOGIN_FALHA` | autenticação (e-mail mascarado: `m***a@e***e.com`) |
| `USUARIO_CRIADO`, `CONSENTIMENTO_ALTERADO`, `CONTA_ANONIMIZADA` | ciclo de vida do titular |
| `DADOS_PESSOAIS_CONSULTADOS`, `DADOS_PESSOAIS_EXPORTADOS` | acesso a dados pessoais (listagem pelo ADMIN, portabilidade) |
| `PEDIDO_CRIADO`, `PEDIDO_STATUS_ALTERADO`, `PEDIDO_CANCELADO` | fluxo do pedido (com canal, de/para e motivo) |
| `PAGAMENTO_SOLICITADO`, `PAGAMENTO_APROVADO`, `PAGAMENTO_RECUSADO`, `PAGAMENTO_ERRO`, `PAGAMENTO_ESTORNADO` | integração com o gateway |
| `ESTOQUE_MOVIMENTADO`, `CARDAPIO_ATUALIZADO`, `PRODUTO_*`, `PROMOCAO_CRIADA`, `UNIDADE_CRIADA` | operações administrativas |

Cada registro guarda usuário, ação, entidade, id, detalhes (JSON), IP e `requestId` — o mesmo id devolvido
no cabeçalho `X-Request-Id` e presente no log técnico, o que permite ligar uma reclamação do cliente à
requisição exata. Consulta: `GET /auditoria?entidade=Pedido&entidadeId=1` (somente ADMIN).

Exemplo real (`GET /auditoria?acao=PEDIDO_CRIADO`):

```json
{
  "id": 5,
  "acao": "PEDIDO_CRIADO",
  "entidade": "Pedido",
  "entidadeId": "1",
  "usuarioId": 6,
  "detalhes": { "canalPedido": "APP", "unidadeId": 1, "status": "AGUARDANDO_PAGAMENTO", "totalCentavos": 4977, "quantidadeItens": 2 },
  "ip": "::ffff:127.0.0.1",
  "requestId": "0f6c2b9e-8f0a-4a57-9a8f-3e2d1c0b9a87",
  "data": "2026-10-12T21:44:10.530Z"
}
```
