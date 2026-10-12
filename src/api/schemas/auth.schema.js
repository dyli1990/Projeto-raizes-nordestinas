const { z, email, senha, telefone, nome, paginacao, idBody } = require('./comum');
const { CanalPedido, Perfil, TipoConsentimento } = require('../../domain/enums');

const registro = z.object({
  nome,
  email,
  senha,
  telefone: telefone.optional(),
  aceiteTermos: z.literal(true, {
    error: 'É necessário aceitar os Termos de Uso e a Política de Privacidade.',
  }),
  consentimentoFidelidade: z.boolean().default(false),
  consentimentoMarketing: z.boolean().default(false),
  canal: z.enum(Object.values(CanalPedido)).optional(),
});

const login = z.object({
  email,
  senha: z.string().min(1, 'Informe a senha.'),
});

const criarUsuario = z.object({
  nome,
  email,
  senha,
  telefone: telefone.optional(),
  perfil: z.enum(Object.values(Perfil)),
  unidadeId: idBody.optional(),
});

const listarUsuarios = z.object({
  perfil: z.enum(Object.values(Perfil)).optional(),
  unidadeId: z.coerce.number().int().positive().optional(),
  ...paginacao,
});

const consentimento = z.object({
  tipo: z.enum(Object.values(TipoConsentimento)),
  concedido: z.boolean(),
  canal: z.enum(Object.values(CanalPedido)).optional(),
});

module.exports = { registro, login, criarUsuario, listarUsuarios, consentimento };
