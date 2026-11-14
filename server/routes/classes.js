const store = require("../store");
const { sendJson, HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAction } = require("../util/audit");
const { activeYear } = require("../access/schoolYear");

function register(router) {
  router.get("/api/classes", requireAuth, (req, res) => {
    // activeYear: a tela mostra so as turmas do ano letivo ativo no dia a dia
    sendJson(res, 200, { classes: store.getAll("classes"), activeYear: activeYear() });
  });

  router.post("/api/classes", requireAuth, requireRole("admin"), (req, res) => {
    const { level } = req.body || {};
    // trim ANTES de conferir: antes um nome so com espacos ("   ") passava
    // e criava uma turma sem nome na lista
    const name = String((req.body || {}).name || "").trim();
    if (!name || !level) throw new HttpError(400, "Informe nome e nível da turma.");
    if (!["Pré I", "Jardim"].includes(level)) {
      throw new HttpError(400, 'O nível da turma deve ser "Pré I" ou "Jardim".');
    }
    // Turma nova sempre no ano letivo ativo
    const created = store.insert("classes", { name, level, schoolYear: activeYear() });
    logAction(req.user, "criar", "turma", created.id, created.name);
    sendJson(res, 201, { class: created });
  });

  router.put("/api/classes/:id", requireAuth, requireRole("admin"), (req, res) => {
    const existing = store.getById("classes", req.params.id);
    if (!existing) throw new HttpError(404, "Turma não encontrada.");
    const { name, level } = req.body || {};
    if (level && !["Pré I", "Jardim"].includes(level)) {
      throw new HttpError(400, 'O nível da turma deve ser "Pré I" ou "Jardim".');
    }
    if (name !== undefined && !String(name).trim()) {
      throw new HttpError(400, "O nome da turma não pode ficar vazio.");
    }
    const updated = store.update("classes", req.params.id, {
      name: name !== undefined ? String(name).trim() : existing.name,
      level: level || existing.level
    });
    logAction(req.user, "editar", "turma", updated.id, updated.name);
    sendJson(res, 200, { class: updated });
  });

  // Professoras da turma, escolhidas na propria tela da turma (tambem da
  // para vincular pelo cadastro de cada professora).
  router.put("/api/classes/:id/teachers", requireAuth, requireRole("admin"), (req, res) => {
    const existing = store.getById("classes", req.params.id);
    if (!existing) throw new HttpError(404, "Turma não encontrada.");
    const wanted = new Set((Array.isArray((req.body || {}).teacherIds) ? req.body.teacherIds : []).map(String));
    store.transaction(() => {
      store.getAll("teachers").forEach((teacher) => {
        const has = (teacher.classIds || []).includes(existing.id);
        if (has === wanted.has(teacher.id)) return;
        const classIds = has ? teacher.classIds.filter((id) => id !== existing.id) : [...teacher.classIds, existing.id];
        store.update("teachers", teacher.id, { classIds });
      });
    });
    logAction(req.user, "editar", "turma", existing.id, `${existing.name}: professoras vinculadas`);
    sendJson(res, 200, { ok: true });
  });

  router.delete("/api/classes/:id", requireAuth, requireRole("admin"), (req, res) => {
    const existing = store.getById("classes", req.params.id);
    if (!existing) throw new HttpError(404, "Turma não encontrada.");
    const hasStudents = store.getAll("students").some((student) => student.classId === req.params.id);
    const hasTeachers = store.getAll("teachers").some((teacher) => (teacher.classIds || []).includes(req.params.id));
    if (hasStudents || hasTeachers) {
      throw new HttpError(409, "Não é possível excluir: existem alunos ou professoras vinculados a esta turma.");
    }
    store.remove("classes", req.params.id);
    logAction(req.user, "excluir", "turma", req.params.id, existing.name);
    sendJson(res, 200, { ok: true });
  });
}

module.exports = { register };
