// Painel da coordenacao: um panorama geral da escola no ano letivo ativo.
//
// GET /api/dashboard (so coordenacao)
const store = require("../store");
const { sendJson } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { activeYear } = require("../access/schoolYear");

/** "dd/mm/aaaa" -> Date (datas dos registros sao gravadas assim). */
function parseBrDate(text) {
  const [day, month, year] = String(text || "").split("/").map(Number);
  return year ? new Date(year, month - 1, day) : null;
}

function register(router) {
  router.get("/api/dashboard", requireAuth, requireRole("admin"), (req, res) => {
    const year = activeYear();
    const classes = store.getAll("classes").filter((klass) => klass.schoolYear === year);
    const classIds = new Set(classes.map((klass) => klass.id));
    const students = store.getAll("students").filter((student) => classIds.has(student.classId) && student.status === "ativo");
    const teachers = store.getAll("teachers");
    const needs = store.getAll("needs");
    const feedbacks = store.getAll("feedbacks");

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const lastWeek = feedbacks.filter((item) => {
      const date = parseBrDate(item.date);
      return date && date.getTime() >= weekAgo;
    });

    const studentsByNeed = needs
      .map((need) => ({ name: need.name, count: students.filter((student) => student.needId === need.id).length }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);

    const byClass = classes
      .map((klass) => ({
        id: klass.id,
        name: klass.name,
        level: klass.level,
        students: students.filter((student) => student.classId === klass.id).length,
        teachers: teachers.filter((teacher) => (teacher.classIds || []).includes(klass.id)).map((teacher) => teacher.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const results = { "Funcionou bem": 0, "Funcionou parcialmente": 0, "Não funcionou": 0 };
    lastWeek.forEach((item) => {
      results[item.result] = (results[item.result] || 0) + 1;
    });

    const studentNames = new Map(store.getAll("students").map((student) => [student.id, student.shortName]));
    sendJson(res, 200, {
      year,
      totals: {
        teachers: teachers.length,
        students: students.length,
        classes: classes.length,
        needs: needs.length,
        activitiesLastWeek: lastWeek.length
      },
      results,
      byClass,
      studentsByNeed,
      // Avisos que pedem acao da coordenacao
      alerts: {
        classesWithoutTeacher: byClass.filter((klass) => !klass.teachers.length).map((klass) => klass.name),
        studentsWithoutNeed: students.filter((student) => !student.needId).map((student) => student.shortName),
        teachersWithoutClass: teachers.filter((teacher) => !(teacher.classIds || []).some((id) => classIds.has(id))).map((teacher) => teacher.name),
        draftNeeds: needs.filter((need) => need.draft).map((need) => need.name)
      },
      recentActivities: feedbacks
        .slice(-5)
        .reverse()
        .map((item) => ({
          date: item.date,
          student: studentNames.get(item.studentId) || "",
          teacher: item.teacherName,
          title: item.activityTitle,
          result: item.result
        }))
    });
  });
}

module.exports = { register };
