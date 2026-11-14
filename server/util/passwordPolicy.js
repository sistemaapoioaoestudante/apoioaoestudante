// Regras para uma senha nova ser aceita. Usado em todos os lugares que
// definem senha: troca pela propria pessoa (routes/auth.js), cadastro e
// redefinicao pela coordenacao (routes/teachers.js).
const MIN_LENGTH = 8;

// Senhas obvias demais - as primeiras tentadas por qualquer pessoa que
// quisesse entrar na conta de outra. Comparacao sem diferenciar maiusculas.
const TOO_COMMON = [
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "senha123",
  "senha1234",
  "password",
  "escola123",
  "professora",
  "coordenacao",
  "qwerty123",
  "abcd1234"
];

/**
 * Valida uma senha nova.
 * @param {string} password
 * @returns {string | null} mensagem de erro para mostrar, ou null se a senha for aceita
 */
function validateNewPassword(password) {
  const value = String(password || "");
  if (value.length < MIN_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`;
  }
  if (TOO_COMMON.includes(value.toLowerCase())) {
    return "Essa senha é muito fácil de adivinhar. Escolha outra.";
  }
  if (/^(.)\1+$/.test(value)) {
    return "A senha não pode ser um único caractere repetido.";
  }
  return null;
}

module.exports = { MIN_LENGTH, validateNewPassword };
