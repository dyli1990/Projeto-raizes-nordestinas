// Seed de demonstração: recria unidades, cardápio, estoque, usuários de cada
// perfil e promoções. É usado pelo `npm run setup`, pelos testes automatizados
// e pela coleção Postman (sempre parte do mesmo estado conhecido).
//
// ATENÇÃO: apaga os dados existentes. Use apenas em desenvolvimento/testes.

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const VERSAO_TERMO = '2026.1';

const UNIDADES = [
  { nome: 'Raízes do Nordeste - Boa Viagem', cidade: 'Recife', uf: 'PE', endereco: 'Av. Boa Viagem, 1200' },
  { nome: 'Raízes do Nordeste - Aldeota', cidade: 'Fortaleza', uf: 'CE', endereco: 'Rua Silva Paulet, 450' },
  { nome: 'Raízes do Nordeste - Pelourinho', cidade: 'Salvador', uf: 'BA', endereco: 'Largo do Pelourinho, 18' },
];

// [nome, categoria, preço base em centavos, descrição]
const PRODUTOS = [
  ['Tapioca de Carne de Sol com Queijo Coalho', 'LANCHES', 2290, 'Tapioca recheada com carne de sol desfiada e queijo coalho.'],
  ['Cuscuz Nordestino com Ovo', 'LANCHES', 1490, 'Cuscuz de milho com ovo, manteiga da terra e queijo.'],
  ['Baião de Dois', 'PRATOS', 3290, 'Arroz, feijão verde, queijo coalho e nata.'],
  ['Escondidinho de Macaxeira com Carne de Sol', 'PRATOS', 2990, 'Purê de macaxeira gratinado com carne de sol.'],
  ['Acarajé', 'LANCHES', 1800, 'Bolinho de feijão-fradinho com vatapá e camarão.'],
  ['Suco de Cajá 500 ml', 'BEBIDAS', 950, 'Suco natural de cajá.'],
  ['Caldo de Cana 500 ml', 'BEBIDAS', 800, 'Caldo de cana gelado.'],
  ['Bolo de Rolo (fatia)', 'SOBREMESAS', 990, 'Bolo de rolo pernambucano com goiabada.'],
  ['Cartola', 'SOBREMESAS', 1690, 'Banana frita, queijo manteiga, açúcar e canela.'],
];

// Cardápio e estoque por unidade: [índice do produto, preço em centavos, quantidade em estoque]
const CARDAPIOS = {
  0: [ // Recife
    [0, 2290, 50], [1, 1490, 40], [2, 3290, 30], [3, 2990, 25],
    [5, 950, 60], [6, 800, 60], [7, 990, 3], [8, 1690, 20],
  ],
  1: [ // Fortaleza (preços regionais diferentes, sem bolo de rolo)
    [0, 2190, 40], [1, 1390, 40], [2, 3190, 30], [3, 2890, 20],
    [5, 900, 50], [6, 750, 50], [8, 1590, 15],
  ],
  2: [ // Salvador (com acarajé)
    [0, 2390, 30], [2, 3390, 25], [4, 1800, 40], [5, 990, 40], [8, 1790, 10],
  ],
};

async function limpar(prisma) {
  // Ordem respeita as chaves estrangeiras.
  await prisma.logAuditoria.deleteMany();
  await prisma.transacaoFidelidade.deleteMany();
  await prisma.contaFidelidade.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.historicoStatusPedido.deleteMany();
  await prisma.movimentacaoEstoque.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.promocao.deleteMany();
  await prisma.estoque.deleteMany();
  await prisma.itemCardapio.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.consentimento.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.unidade.deleteMany();
  // Reinicia os contadores de ID (SQLite) para que os IDs do seed sejam previsíveis.
  await prisma.$executeRawUnsafe('DELETE FROM sqlite_sequence');
}

async function seed(prisma) {
  await limpar(prisma);

  const unidades = [];
  for (const dados of UNIDADES) unidades.push(await prisma.unidade.create({ data: dados }));

  const produtos = [];
  for (const [nome, categoria, precoBaseCentavos, descricao] of PRODUTOS) {
    produtos.push(await prisma.produto.create({ data: { nome, categoria, precoBaseCentavos, descricao } }));
  }

  for (const [indiceUnidade, itens] of Object.entries(CARDAPIOS)) {
    const unidade = unidades[Number(indiceUnidade)];
    for (const [indiceProduto, precoCentavos, quantidade] of itens) {
      const produto = produtos[indiceProduto];
      await prisma.itemCardapio.create({ data: { unidadeId: unidade.id, produtoId: produto.id, precoCentavos } });
      const estoque = await prisma.estoque.create({
        data: { unidadeId: unidade.id, produtoId: produto.id, quantidade },
      });
      await prisma.movimentacaoEstoque.create({
        data: {
          estoqueId: estoque.id,
          tipo: 'ENTRADA',
          origem: 'MANUAL',
          quantidade,
          saldoApos: quantidade,
          motivo: 'Carga inicial (seed)',
        },
      });
    }
  }

  const hash = (senha) => bcrypt.hashSync(senha, 10);
  const [recife, fortaleza] = unidades;

  const usuarios = [
    { nome: 'Administrador da Rede', email: 'admin@raizes.dev', senha: 'Admin@123', perfil: 'ADMIN' },
    { nome: 'Gerente Recife', email: 'gerente.recife@raizes.dev', senha: 'Gerente@123', perfil: 'GERENTE', unidadeId: recife.id },
    { nome: 'Atendente Recife', email: 'atendente.recife@raizes.dev', senha: 'Atendente@123', perfil: 'ATENDENTE', unidadeId: recife.id },
    { nome: 'Cozinha Recife', email: 'cozinha.recife@raizes.dev', senha: 'Cozinha@123', perfil: 'COZINHA', unidadeId: recife.id },
    { nome: 'Gerente Fortaleza', email: 'gerente.fortaleza@raizes.dev', senha: 'Gerente@123', perfil: 'GERENTE', unidadeId: fortaleza.id },
    { nome: 'Maria Cliente', email: 'maria@example.com', senha: 'Cliente@123', perfil: 'CLIENTE', telefone: '81999990000', fidelidade: true, pontos: 150 },
    { nome: 'João Cliente', email: 'joao@example.com', senha: 'Cliente@123', perfil: 'CLIENTE', fidelidade: false },
  ];

  for (const { senha, fidelidade, pontos, ...dados } of usuarios) {
    const usuario = await prisma.usuario.create({ data: { ...dados, senhaHash: hash(senha) } });
    if (usuario.perfil !== 'CLIENTE') continue;

    await prisma.consentimento.create({
      data: { usuarioId: usuario.id, tipo: 'FIDELIDADE', concedido: fidelidade, versaoTermo: VERSAO_TERMO, canal: 'SEED' },
    });
    await prisma.consentimento.create({
      data: { usuarioId: usuario.id, tipo: 'MARKETING', concedido: false, versaoTermo: VERSAO_TERMO, canal: 'SEED' },
    });
    if (fidelidade) {
      const conta = await prisma.contaFidelidade.create({ data: { usuarioId: usuario.id, saldoPontos: pontos } });
      await prisma.transacaoFidelidade.create({
        data: { contaId: conta.id, tipo: 'ACUMULO', pontos, descricao: 'Bônus de boas-vindas (seed)' },
      });
    }
  }

  await prisma.promocao.createMany({
    data: [
      {
        codigo: 'NORDESTE10',
        descricao: '10% de desconto em toda a rede',
        tipoDesconto: 'PERCENTUAL',
        valor: 10,
        inicio: new Date('2026-01-01T00:00:00Z'),
        fim: new Date('2027-12-31T23:59:59Z'),
      },
      {
        codigo: 'RECIFE5',
        descricao: 'R$ 5,00 de desconto na unidade Boa Viagem',
        tipoDesconto: 'VALOR_FIXO',
        valor: 500,
        unidadeId: recife.id,
        inicio: new Date('2026-01-01T00:00:00Z'),
        fim: new Date('2027-12-31T23:59:59Z'),
      },
      {
        codigo: 'SAOJOAO2025',
        descricao: 'Campanha de São João 2025 (encerrada)',
        tipoDesconto: 'PERCENTUAL',
        valor: 15,
        inicio: new Date('2025-06-01T00:00:00Z'),
        fim: new Date('2025-06-30T23:59:59Z'),
      },
    ],
  });
}

module.exports = { seed };

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => console.log('Seed concluído: 3 unidades, 9 produtos, 7 usuários e 3 promoções.'))
    .catch((erro) => {
      console.error(erro);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
