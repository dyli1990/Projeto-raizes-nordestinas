const { randomBytes } = require('node:crypto');
const repos = require('../infrastructure/repositories');
const { transaction } = require('../infrastructure/database/prisma');
const { gerarHash } = require('../infrastructure/security/password');
const { TipoConsentimento } = require('../domain/enums');
const { ConflictError } = require('../domain/errors');
const { STATUS_EM_ANDAMENTO } = require('../domain/pedido');
const { VERSAO_TERMO_ATUAL, dadosAnonimizados } = require('../domain/privacidade');
const auditoria = require('./auditoria.service');

// Casos de uso dos direitos do titular (LGPD, art. 18).

async function consultarConsentimentos(usuarioId) {
  const atuais = await repos.consentimentos().atuais(usuarioId);
  return Object.values(TipoConsentimento).map((tipo) => ({
    tipo,
    concedido: atuais[tipo]?.concedido ?? false,
    versaoTermo: atuais[tipo]?.versaoTermo ?? null,
    atualizadoEm: atuais[tipo]?.createdAt ?? null,
  }));
}

async function atualizarConsentimento(ator, ctx, { tipo, concedido, canal }) {
  await transaction(async (tx) => {
    await repos.consentimentos(tx).registrar({
      usuarioId: ator.id,
      tipo,
      concedido,
      versaoTermo: VERSAO_TERMO_ATUAL,
      canal: canal || null,
    });
    if (tipo === TipoConsentimento.FIDELIDADE && concedido) {
      await repos.fidelidade(tx).garantirConta(ator.id);
    }
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.CONSENTIMENTO_ALTERADO,
      entidade: 'Usuario',
      entidadeId: ator.id,
      detalhes: { tipo, concedido, versaoTermo: VERSAO_TERMO_ATUAL },
    });
  });
  return consultarConsentimentos(ator.id);
}

// Portabilidade/acesso: devolve tudo o que a rede guarda sobre o titular.
async function exportarDados(ator, ctx) {
  const [usuario, consentimentos, pedidos, conta] = await Promise.all([
    repos.usuarios().buscarPorId(ator.id),
    repos.consentimentos().listarPorUsuario(ator.id),
    repos.pedidos().listarDoCliente(ator.id),
    repos.fidelidade().buscarConta(ator.id),
  ]);
  const extrato = conta ? await repos.fidelidade().listarTransacoes(conta.id, { skip: 0, take: 1000 }) : { itens: [] };

  await auditoria.registrar({
    ator,
    ctx,
    acao: auditoria.Acao.DADOS_PESSOAIS_EXPORTADOS,
    entidade: 'Usuario',
    entidadeId: ator.id,
  });

  return { usuario, consentimentos, pedidos, fidelidade: { conta, transacoes: extrato.itens } };
}

// Eliminação: anonimiza os dados pessoais e mantém os pedidos sem
// identificação (retenção fiscal), revogando todos os consentimentos.
async function anonimizarConta(ator, ctx) {
  const emAndamento = await repos.pedidos().contarEmAndamentoDoCliente(ator.id, STATUS_EM_ANDAMENTO);
  if (emAndamento > 0) {
    throw new ConflictError(
      'PEDIDOS_EM_ANDAMENTO',
      'Não é possível excluir a conta com pedidos em andamento. Aguarde a entrega ou cancele-os.',
      [{ field: 'pedidos', issue: `${emAndamento} pedido(s) em andamento.` }]
    );
  }

  // Senha aleatória descartada: a conta deixa de permitir login.
  const senhaHash = await gerarHash(randomBytes(32).toString('hex'));

  await transaction(async (tx) => {
    await repos.usuarios(tx).atualizar(ator.id, { ...dadosAnonimizados(ator.id), senhaHash });
    for (const tipo of Object.values(TipoConsentimento)) {
      await repos.consentimentos(tx).registrar({
        usuarioId: ator.id,
        tipo,
        concedido: false,
        versaoTermo: VERSAO_TERMO_ATUAL,
        canal: 'ANONIMIZACAO',
      });
    }
    await auditoria.registrar({
      db: tx,
      ator,
      ctx,
      acao: auditoria.Acao.CONTA_ANONIMIZADA,
      entidade: 'Usuario',
      entidadeId: ator.id,
    });
  });
}

module.exports = { consultarConsentimentos, atualizarConsentimento, exportarDados, anonimizarConta };
