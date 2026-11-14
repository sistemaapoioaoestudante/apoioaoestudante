// Anos letivos e "virada de ano" (so coordenacao).
//
// GET  /api/school-years           - anos, com quantas turmas/alunos cada um tem
// POST /api/school-years/rollover  - encerra o ano ativo e abre o seguinte
//
// Na virada, a coordenacao diz o que acontece com CADA turma do ano ativo:
//   { classId, action: "move", toName, toLevel }  -> os alunos ativos vao
//        para a turma nova (criada no ano seguinte com esse nome e nivel;
//        duas turmas podem ir para o mesmo nome e viram uma so)
//   { classId, action: "conclude" }               -> os alunos ativos
//        "concluem" (saem da educacao infantil)
// Tudo numa unica transacao: ou a virada acontece inteira, ou nada muda.
// O historico (em que turma o aluno estava em cada ano) fica em
// student_enrollments; as turmas antigas continuam guardadas para consulta.
// As professoras NAO sao copiadas para as turmas novas: a coordenacao vincula
// de novo (as turmas e professoras costumam mudar de um ano para o outro).
const store = require("../store");
const { sendJson, HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAction } = require("../util/audit");
const { activeYear } = require("../access/schoolYear");

const LEVELS = ["Pré I", "Jardim"];
const MAX_AGE = 6;

function register(router) {
  router.get("/api/school-years", requireAuth, requireRole("admin"), (req, res) => {
    const classes = store.getAll("classes");
    const students = store.getAll("students");
    const years = store
      .getAll("schoolYears")
      .sort((a, b) => b.year - a.year)
      .map((item) => {
        const classIds = new Set(classes.filter((klass) => klass.schoolYear === item.year).map((klass) => klass.id));
        return {
          ...item,
          classCount: classIds.size,
          activeStudentCount: students.filter((student) => classIds.has(student.classId) && student.status === "ativo").length
        };
      });
    sendJson(res, 200, { years, activeYear: activeYear() });
  });

  router.post("/api/school-years/rollover", requireAuth, requireRole("admin"), (req, res) => {
    const fromYear = activeYear();
    const toYear = Number((req.body || {}).toYear);
    const plan = Array.isArray((req.body || {}).plan) ? req.body.plan : [];
    if (!Number.isInteger(toYear) || toYear <= fromYear || toYear > fromYear + 1) {
      throw new HttpError(400, `O próximo ano letivo deve ser ${fromYear + 1}.`);
    }

    const currentClasses = store.getAll("classes").filter((klass) => klass.schoolYear === fromYear);
    const planByClass = new Map(plan.map((step) => [String(step.classId), step]));
    // Toda turma do ano precisa de um destino (nenhum aluno fica "perdido")
    const missing = currentClasses.filter((klass) => !planByClass.has(klass.id));
    if (missing.length) {
      throw new HttpError(400, `Defina o destino de todas as turmas. Faltam: ${missing.map((klass) => klass.name).join(", ")}.`);
    }
    for (const step of planByClass.values()) {
      if (step.action === "move") {
        if (!String(step.toName || "").trim()) throw new HttpError(400, "Informe o nome de cada turma nova.");
        if (!LEVELS.includes(step.toLevel)) throw new HttpError(400, 'O nível da turma nova deve ser "Pré I" ou "Jardim".');
      } else if (step.action !== "conclude") {
        throw new HttpError(400, "Destino de turma inválido.");
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const summary = store.transaction(() => {
      // 1) Encerra o ano atual e abre o seguinte (so pode haver um ativo)
      store.update("schoolYears", fromYear, { status: "encerrado" });
      store.insert("schoolYears", { year: toYear, status: "ativo" });

      const newClassByName = new Map();
      let moved = 0;
      let concluded = 0;
      for (const klass of currentClasses) {
        const step = planByClass.get(klass.id);
        const activeStudents = store.getAll("students").filter((student) => student.classId === klass.id && student.status === "ativo");
        // 2) Guarda em que turma cada aluno esteve neste ano
        activeStudents.forEach((student) => {
          store.insert("studentEnrollments", { studentId: student.id, schoolYear: fromYear, classId: klass.id });
        });

        if (step.action === "conclude") {
          activeStudents.forEach((student) => {
            store.update("students", student.id, { status: "concluiu", statusDate: today, statusNote: `Concluiu em ${fromYear} (${klass.name})` });
          });
          concluded += activeStudents.length;
          continue;
        }

        // 3) Cria (uma vez) a turma de destino e move os alunos para ela
        const key = String(step.toName).trim().toLowerCase();
        let target = newClassByName.get(key);
        if (!target) {
          target = store.insert("classes", { name: String(step.toName).trim(), level: step.toLevel, schoolYear: toYear });
          newClassByName.set(key, target);
        }
        activeStudents.forEach((student) => {
          store.update("students", student.id, { classId: target.id, age: Math.min(MAX_AGE, (Number(student.age) || 0) + 1) });
        });
        moved += activeStudents.length;
      }
      return { moved, concluded, newClasses: newClassByName.size };
    });

    logAction(
      req.user,
      "virada de ano",
      "ano letivo",
      String(toYear),
      `${fromYear} → ${toYear}: ${summary.moved} aluno(s) passaram de turma, ${summary.concluded} concluíram, ${summary.newClasses} turma(s) nova(s)`
    );
    sendJson(res, 200, { ok: true, fromYear, toYear, ...summary });
  });
}

module.exports = { register };
