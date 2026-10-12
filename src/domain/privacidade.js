// Regras de privacidade (LGPD) independentes de banco ou HTTP.

const VERSAO_TERMO_ATUAL = '2026.1';

// Mascara e-mails em logs e auditoria: "maria.silva@example.com" -> "m***a@e***.com"
function mascararEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [usuario, dominio] = email.split('@');
  const partesDominio = dominio.split('.');
  const nomeDominio = partesDominio.shift() || '';
  const mascara = (texto) =>
    texto.length <= 2 ? `${texto[0] || ''}***` : `${texto[0]}***${texto[texto.length - 1]}`;
  return `${mascara(usuario)}@${mascara(nomeDominio)}${partesDominio.length ? '.' + partesDominio.join('.') : ''}`;
}

// Dados que substituem os dados pessoais quando o titular pede exclusão.
// Pedidos são mantidos (obrigação fiscal), mas deixam de identificar a pessoa.
function dadosAnonimizados(usuarioId) {
  return {
    nome: 'Titular anonimizado',
    email: `anonimizado+${usuarioId}@raizes.invalid`,
    telefone: null,
    ativo: false,
    anonimizadoEm: new Date(),
  };
}

module.exports = { VERSAO_TERMO_ATUAL, mascararEmail, dadosAnonimizados };
