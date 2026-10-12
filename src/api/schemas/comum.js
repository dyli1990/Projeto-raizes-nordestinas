const { z } = require('zod');

// Mensagens de validação em português + mensagem clara para campo ausente.
z.config(z.locales.pt());
z.config({
  customError: (issue) =>
    issue.code === 'invalid_type' && issue.input === undefined ? 'Campo obrigatório.' : undefined,
});

const id = z.coerce.number().int().positive();
const idBody = z.number().int().positive();

const paramsId = z.object({ id });

const paginacao = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

const email = z.string().trim().toLowerCase().email('E-mail inválido.').max(160);

const senha = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra.')
  .regex(/\d/, 'A senha deve conter ao menos um número.');

const telefone = z.string().regex(/^\d{10,11}$/, 'Informe DDD + número, apenas dígitos (10 ou 11).');

const nome = z.string().trim().min(3, 'Informe ao menos 3 caracteres.').max(120);

// Valores em reais (ex.: 39.9). Convertidos para centavos na camada de API.
const valorReais = z.number().positive('O valor deve ser maior que zero.').max(100000);

module.exports = { z, id, idBody, paramsId, paginacao, email, senha, telefone, nome, valorReais };
