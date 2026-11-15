// Feedbacks: o registro de "funcionou / nao funcionou" de uma atividade
// aplicada a um aluno. Normalmente nascem do fluxo de atividades
// (routes/assignments.js); esta rota permite tambem o registro avulso.
//
// Controle de acesso (ver server/access/studentAccess.js): a professora so
// le e registra feedbacks de alunos das turmas dela.
const store = require("../store");
const { sendJson, HttpError } = require("../router");
const { requireAuth } = require("../middleware/auth");
const { makeId } = require("../util/id");
const { visibleStudents, assertCanAccessStudent } = require("../access/studentAccess");

const VALID_RESULTS = ["Funcionou bem", "Funcionou parcialmente", "Não funcionou"];

function register(router) {
  router.get("/api/feedbacks", requireAuth, (req, res) => {
    const { studentId, teacherId } = req.query;

    let feedbacks;
    if (studentId) {
      assertCanAccessStudent(req.user, studentId); // 404/403 claros em vez de lista vazia
      feedbacks = store.findBy("feedbacks", { studentId });
    } else {
      // So os feedbacks de alunos que este usuario pode ver.
      feedbacks = store.findBy("feedbacks", { studentId: visibleStudents(req.user).map((student) => student.id) });
    }
    if (teacherId) feedbacks = feedbacks.filter((item) => item.teacherId === teacherId);

    sendJson(res, 200, { feedbacks });
  });

  router.post("/api/feedbacks", requireAuth, (req, res) => {
    const { studentId, theme, activityTitle, result, notes } = req.body || {};
    if (!studentId || !activityTitle || !result) {
      throw new HttpError(400, "Informe aluno, atividade e resultado do feedback.");
    }
    if (!VALID_RESULTS.includes(result)) {
      throw new HttpError(400, "Resultado de feedback inválido.");
    }
    assertCanAccessStudent(req.user, studentId);

    // Professora: o feedback e sempre dela. Coordenacao pode registrar em
    // nome de uma professora (teacherId no corpo), se precisar.
    const teacherId = req.user.role === "teacher" ? req.user.teacherId : req.body.teacherId || null;
    const teacher = teacherId ? store.getById("teachers", teacherId) : null;

    const feedback = store.insert("feedbacks", {
      id: makeId("fb"),
      studentId,
      teacherId: teacher ? teacher.id : null, // id inexistente vira "sem professora"
      teacherName: teacher ? teacher.name : req.user.name,
      theme: theme || "Tema livre",
      activityTitle: String(activityTitle),
      result,
      notes: String(notes || "").trim(),
      date: new Date().toLocaleDateString("pt-BR")
    });

    sendJson(res, 201, { feedback });
  });
}

module.exports = { register };
