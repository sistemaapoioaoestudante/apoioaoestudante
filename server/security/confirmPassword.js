// ---------------------------------------------------------------------------
// Confirmacao com a senha de quem esta logado, para acoes que nao tem volta
// (excluir aluno, professora ou conta da coordenacao).
//
// Por que: o login pode ficar aberto num computador da escola. Sem isso,
// qualquer pessoa que encontrasse o sistema aberto conseguiria apagar dados
// com dois cliques. Senha errada conta como tentativa de login: depois de
// varios erros, a pessoa fica bloqueada por um tempo (igual ao login).
// ---------------------------------------------------------------------------
const { HttpError } = require("../router");
const { verifyPassword } = require("../util/hash");
const loginThrottle = require("./loginThrottle");
const { clientIp } = require("./network");

/**
 * Lanca erro 400 se a senha enviada em req.body.password nao for a de quem
 * esta logado.
 * @param {object} req - requisicao ja autenticada (req.user preenchido)
 */
function assertOwnPassword(req) {
  const email = req.user.email.toLowerCase();
  const ip = clientIp(req);
  loginThrottle.assertNotLocked(email, ip);
  const password = String((req.body || {}).password || "");
  if (!password) {
    throw new HttpError(400, "Digite a sua senha da coordenação para confirmar a exclusão.");
  }
  if (!verifyPassword(password, req.user.passwordHash)) {
    loginThrottle.registerFailure(email, ip);
    throw new HttpError(400, "Senha incorreta. Digite a sua senha da coordenação para confirmar a exclusão.");
  }
}

module.exports = { assertOwnPassword };
