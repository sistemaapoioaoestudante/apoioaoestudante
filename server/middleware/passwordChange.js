// Troca de senha obrigatoria.
//
// Quando um usuario tem `mustChangePassword: true` (senha provisoria criada
// pela coordenacao, ou a senha da base de demonstracao), ele so consegue
// usar as rotas abaixo ate criar a propria senha. Qualquer outra rota da API
// responde 403 com code "PASSWORD_CHANGE_REQUIRED" - o front-end reconhece
// esse codigo e abre a tela de troca de senha (public/js/passwordChange.js).
//
// A checagem fica no servidor (e nao so na tela) para que nao de para pular
// a troca chamando a API diretamente.
const ALLOWED_WHILE_PENDING = new Set([
  "GET /api/auth/me",
  "PUT /api/auth/password",
  "POST /api/auth/logout",
  "POST /api/auth/login"
]);

const PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";

/**
 * @param {object} req - requisicao, com req.user ja resolvido
 * @param {string} pathname
 * @returns {boolean} true se a requisicao deve ser bloqueada
 */
function isBlockedByPendingPasswordChange(req, pathname) {
  if (!req.user || !req.user.mustChangePassword) return false;
  return !ALLOWED_WHILE_PENDING.has(`${req.method} ${pathname}`);
}

module.exports = { isBlockedByPendingPasswordChange, PASSWORD_CHANGE_REQUIRED };
