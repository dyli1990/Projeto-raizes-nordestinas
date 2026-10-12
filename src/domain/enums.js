// Enums de domínio. Espelham os enums do prisma/schema.prisma para que as
// regras de negócio não dependam do ORM.

const Perfil = Object.freeze({
  ADMIN: 'ADMIN',
  GERENTE: 'GERENTE',
  ATENDENTE: 'ATENDENTE',
  COZINHA: 'COZINHA',
  CLIENTE: 'CLIENTE',
});

// Perfis de colaboradores vinculados a uma unidade específica.
const PERFIS_DE_UNIDADE = Object.freeze([Perfil.GERENTE, Perfil.ATENDENTE, Perfil.COZINHA]);
const PERFIS_EQUIPE = Object.freeze([Perfil.ADMIN, ...PERFIS_DE_UNIDADE]);

const CanalPedido = Object.freeze({
  APP: 'APP',
  TOTEM: 'TOTEM',
  BALCAO: 'BALCAO',
  PICKUP: 'PICKUP',
  WEB: 'WEB',
});

const StatusPedido = Object.freeze({
  AGUARDANDO_PAGAMENTO: 'AGUARDANDO_PAGAMENTO',
  EM_PREPARO: 'EM_PREPARO',
  PRONTO: 'PRONTO',
  ENTREGUE: 'ENTREGUE',
  CANCELADO: 'CANCELADO',
});

const MetodoPagamento = Object.freeze({
  PIX: 'PIX',
  CARTAO_CREDITO: 'CARTAO_CREDITO',
  CARTAO_DEBITO: 'CARTAO_DEBITO',
  DINHEIRO: 'DINHEIRO',
});

const StatusPagamento = Object.freeze({
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  RECUSADO: 'RECUSADO',
  ERRO: 'ERRO',
  ESTORNADO: 'ESTORNADO',
});

const TipoMovimentacao = Object.freeze({ ENTRADA: 'ENTRADA', SAIDA: 'SAIDA' });

const OrigemMovimentacao = Object.freeze({
  MANUAL: 'MANUAL',
  PEDIDO: 'PEDIDO',
  CANCELAMENTO: 'CANCELAMENTO',
});

const TipoConsentimento = Object.freeze({ FIDELIDADE: 'FIDELIDADE', MARKETING: 'MARKETING' });

const TipoTransacaoFidelidade = Object.freeze({
  ACUMULO: 'ACUMULO',
  RESGATE: 'RESGATE',
  ESTORNO: 'ESTORNO',
});

const TipoDesconto = Object.freeze({ PERCENTUAL: 'PERCENTUAL', VALOR_FIXO: 'VALOR_FIXO' });

module.exports = {
  Perfil,
  PERFIS_DE_UNIDADE,
  PERFIS_EQUIPE,
  CanalPedido,
  StatusPedido,
  MetodoPagamento,
  StatusPagamento,
  TipoMovimentacao,
  OrigemMovimentacao,
  TipoConsentimento,
  TipoTransacaoFidelidade,
  TipoDesconto,
};
