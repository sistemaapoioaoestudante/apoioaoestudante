// Contas da coordenacao (so coordenacao).
//
// Ter mais de uma conta (ex: coordenacao + direcao) e a forma mais simples
// de nunca ficar trancado para fora: se alguem esquecer a senha, a outra
// pessoa redefine. Sem nenhuma outra conta, ainda existe o
// "recuperar-acesso.bat" (precisa da senha de administrador do Windows).
//
// GET    /api/coordinators               - lista (sem senhas)
// POST   /api/coordinators               - nova conta (senha provisoria)
// PUT    /api/coordinators/:id/password  - redefine (provisoria) a senha de OUTRA conta
// DELETE /api/coordinators/:id           - exclui OUTRA conta (sempre fica pelo menos uma)
const store = require("../store");
const { sendJson, HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { hashPassword } = require("../util/hash");
const { assertOwnPassword } = require("../security/confirmPassword");
const { makeId } = require("../util/id");
const { logAction } = require("../util/audit");
const { validateNewPassword } = require("../util/passwordPolicy");
const { destroyUserSessions } = require("../session");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function coordinators() {
  return store.getAll("users").filter((user) => user.role === "admin");
}

/** Conta da coordenacao que NAO e a de quem esta pedindo. */
function otherCoordinator(req) {
  const target = store.getById("users", req.params.id);
  if (!target || target.role !== "admin") throw new HttpError(404, "Conta da coordenação não encontrada.");
  if (target.id === req.user.id) {
    throw new HttpError(400, "Para a sua própria conta, use \"Trocar senha\" em Meu perfil.");
  }
  return target;
}

function register(router) {
  router.get("/api/coordinators", requireAuth, requireRole("admin"), (req, res) => {
    sendJson(res, 200, {
      coordinators: coordinators().map((user) => ({ id: user.id, name: user.name, email: user.email, isMe: user.id === req.user.id }))
    });
  });

  router.post("/api/coordinators", requireAuth, requireRole("admin"), (req, res) => {
    const name = String((req.body || {}).name || "").trim();
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    const password = String((req.body || {}).password || "");
    if (!name) throw new HttpError(400, "Informe o nome.");
    if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, "E-mail inválido. Confira se está no formato nome@escola.com.");
    const policyError = validateNewPassword(password);
    if (policyError) throw new HttpError(400, policyError);
    const created = store.insert("users", {
      id: makeId("usr"),
      email,
      passwordHash: hashPassword(password),
      mustChangePassword: true, // provisoria: a pessoa cria a propria no 1o login
      role: "admin",
      name,
      teacherId: null
    });
    logAction(req.user, "criar", "coordenação", created.id, created.name);
    sendJson(res, 201, { coordinator: { id: created.id, name: created.name, email: created.email } });
  });

  router.put("/api/coordinators/:id/password", requireAuth, requireRole("admin"), (req, res) => {
    const target = otherCoordinator(req);
    const password = String((req.body || {}).password || "");
    const policyError = validateNewPassword(password);
    if (policyError) throw new HttpError(400, policyError);
    store.update("users", target.id, { passwordHash: hashPassword(password), mustChangePassword: true });
    destroyUserSessions(target.id);
    logAction(req.user, "redefinir senha", "coordenação", target.id, target.name);
    sendJson(res, 200, { ok: true });
  });

  router.delete("/api/coordinators/:id", requireAuth, requireRole("admin"), (req, res) => {
    const target = otherCoordinator(req);
    if (coordinators().length <= 1) throw new HttpError(409, "O sistema precisa de pelo menos uma conta da coordenação.");
    assertOwnPassword(req); // exclusao sem volta: confirma com a propria senha
    store.remove("users", target.id);
    destroyUserSessions(target.id);
    logAction(req.user, "excluir", "coordenação", target.id, target.name);
    sendJson(res, 200, { ok: true });
  });
}

module.exports = { register };
