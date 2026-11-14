const store = require("../store");
const { sendJson, HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { hashPassword } = require("../util/hash");
const { makeId } = require("../util/id");
const { logAction } = require("../util/audit");
const { validateNewPassword } = require("../util/passwordPolicy");
const { destroyUserSessions } = require("../session");
const { assertOwnPassword } = require("../security/confirmPassword");

function register(router) {
  // Qualquer pessoa autenticada pode ver a lista (o seletor de professora do
  // atendimento rápido precisa disso); dados de login (senha) nunca saem
  // daqui. O e-mail de acesso só é anexado para a coordenação (que é quem
  // pode editá-lo) - para professora seria dado administrativo de outra
  // pessoa, sem necessidade pedagógica de aparecer.
  router.get("/api/teachers", requireAuth, (req, res) => {
    const teachers = store.getAll("teachers").map((teacher) => {
      if (req.user.role !== "admin") return teacher;
      const user = store.getAll("users").find((item) => item.teacherId === teacher.id);
      return { ...teacher, email: user ? user.email : "" };
    });
    sendJson(res, 200, { teachers });
  });

  router.post("/api/teachers", requireAuth, requireRole("admin"), (req, res) => {
    const { classIds, email, password } = req.body || {};
    const name = String((req.body || {}).name || "").trim(); // "   " conta como vazio
    if (!name || !email || !password) {
      throw new HttpError(400, "Informe nome, e-mail e senha da professora.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      throw new HttpError(400, "E-mail inválido. Confira se está no formato nome@escola.com.");
    }
    const policyError = validateNewPassword(password);
    if (policyError) throw new HttpError(400, policyError);
    const normalizedEmail = String(email).trim().toLowerCase();
    const emailInUse = store.getAll("users").some((user) => user.email.toLowerCase() === normalizedEmail);
    if (emailInUse) throw new HttpError(409, "Já existe uma conta com este e-mail.");

    // Professora + conta de acesso juntas: se a conta falhar (ex: e-mail
    // repetido), a professora tambem nao fica cadastrada pela metade.
    const teacher = store.transaction(() => {
      const created = store.insert("teachers", {
        id: makeId("tch"),
        name,
        classIds: Array.isArray(classIds) ? classIds.map(String) : []
      });
      store.insert("users", {
        id: makeId("usr"),
        email: normalizedEmail,
        passwordHash: hashPassword(String(password)),
        // Senha criada pela coordenacao e provisoria: a professora cria a
        // propria no primeiro login.
        mustChangePassword: true,
        role: "teacher",
        name: created.name,
        teacherId: created.id
      });
      return created;
    });

    logAction(req.user, "criar", "professora", teacher.id, teacher.name);
    sendJson(res, 201, { teacher });
  });

  router.put("/api/teachers/:id", requireAuth, requireRole("admin"), (req, res) => {
    const existing = store.getById("teachers", req.params.id);
    if (!existing) throw new HttpError(404, "Professora não encontrada.");
    const { name, classIds, email } = req.body || {};
    if (name !== undefined && !String(name).trim()) {
      throw new HttpError(400, "O nome da professora não pode ficar vazio.");
    }

    // Confere o e-mail ANTES de gravar qualquer coisa: se ele for recusado,
    // nome e turmas tambem ficam como estavam.
    const user = store.getAll("users").find((item) => item.teacherId === req.params.id);
    const userPatch = {};
    if (user && email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) throw new HttpError(400, "O e-mail não pode ficar vazio.");
      if (normalizedEmail !== user.email.toLowerCase()) {
        const emailInUse = store.getAll("users").some((item) => item.id !== user.id && item.email.toLowerCase() === normalizedEmail);
        if (emailInUse) throw new HttpError(409, "Já existe uma conta com este e-mail.");
        userPatch.email = normalizedEmail;
      }
    }

    // Professora + conta de acesso gravadas juntas (tudo ou nada)
    const updated = store.transaction(() => {
      const saved = store.update("teachers", req.params.id, {
        name: name !== undefined ? String(name).trim() : existing.name,
        classIds: Array.isArray(classIds) ? classIds.map(String) : existing.classIds
      });
      if (user) {
        if (name) userPatch.name = saved.name;
        if (Object.keys(userPatch).length) store.update("users", user.id, userPatch);
      }
      return saved;
    });

    // Turma que ficou sem nenhuma professora: e permitido (pode ser algo
    // temporario), mas o front-end recebe a lista para avisar a coordenacao.
    const orphanClasses = store
      .getAll("classes")
      .filter((klass) => klass.id && !store.getAll("teachers").some((t) => (t.classIds || []).includes(klass.id)))
      .map((klass) => klass.name);

    logAction(req.user, "editar", "professora", updated.id, updated.name);
    sendJson(res, 200, { teacher: updated, orphanClasses });
  });

  router.put("/api/teachers/:id/password", requireAuth, requireRole("admin"), (req, res) => {
    const { password } = req.body || {};
    const policyError = validateNewPassword(password);
    if (policyError) throw new HttpError(400, policyError);
    const user = store.getAll("users").find((item) => item.teacherId === req.params.id);
    if (!user) throw new HttpError(404, "Login desta professora não encontrado.");
    // Senha redefinida pela coordenacao tambem e provisoria, e quem estava
    // logado com a senha antiga em qualquer aparelho e desconectado.
    store.update("users", user.id, { passwordHash: hashPassword(String(password)), mustChangePassword: true });
    destroyUserSessions(user.id);
    logAction(req.user, "redefinir senha", "professora", req.params.id, null);
    sendJson(res, 200, { ok: true });
  });

  router.delete("/api/teachers/:id", requireAuth, requireRole("admin"), (req, res) => {
    const existing = store.getById("teachers", req.params.id);
    if (!existing) throw new HttpError(404, "Professora não encontrada.");
    // Exclusao sem volta: exige a senha de quem esta excluindo
    assertOwnPassword(req);
    // A conta de acesso e os vinculos com turmas somem junto (ON DELETE
    // CASCADE); o historico de registros fica, so sem a professora ligada.
    store.remove("teachers", req.params.id);

    const remainingTeachers = store.getAll("teachers");
    const orphanClasses = (existing.classIds || [])
      .filter((classId) => !remainingTeachers.some((t) => (t.classIds || []).includes(classId)))
      .map((classId) => store.getById("classes", classId)?.name)
      .filter(Boolean);

    logAction(req.user, "excluir", "professora", req.params.id, existing.name);
    sendJson(res, 200, { ok: true, orphanClasses });
  });
}

module.exports = { register };
