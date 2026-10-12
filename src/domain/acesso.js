const { Perfil, PERFIS_DE_UNIDADE } = require('./enums');
const { ForbiddenError } = require('./errors');

// Políticas de acesso por unidade (multiunidade/franquia):
//  - ADMIN (matriz) acessa todas as unidades;
//  - GERENTE, ATENDENTE e COZINHA só acessam a própria unidade;
//  - CLIENTE só acessa os próprios pedidos.

function ehAdmin(ator) {
  return ator.perfil === Perfil.ADMIN;
}

function ehEquipeDeUnidade(ator) {
  return PERFIS_DE_UNIDADE.includes(ator.perfil);
}

function garantirAcessoUnidade(ator, unidadeId) {
  if (ehAdmin(ator)) return;
  if (ehEquipeDeUnidade(ator) && ator.unidadeId === unidadeId) return;
  throw new ForbiddenError('ACESSO_UNIDADE_NEGADO', 'Usuário sem acesso a esta unidade.', [
    { field: 'unidadeId', issue: `Unidade ${unidadeId} não pertence ao seu escopo.` },
  ]);
}

function podeVerPedido(ator, pedido) {
  if (ehAdmin(ator)) return true;
  if (ator.perfil === Perfil.CLIENTE) return pedido.clienteId === ator.id;
  return ehEquipeDeUnidade(ator) && pedido.unidadeId === ator.unidadeId;
}

module.exports = { ehAdmin, ehEquipeDeUnidade, garantirAcessoUnidade, podeVerPedido };
