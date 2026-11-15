// Regras de acesso a alunos - UM unico lugar para responder "esta pessoa
// pode ver/mexer neste aluno?".
//
// Regra do produto:
//   - Coordenacao (role "admin") enxerga todos os alunos.
//   - Professora (role "teacher") so enxerga alunos das turmas vinculadas a
//     ela (teacher.classIds).
//
// Toda rota que recebe um studentId deve usar assertCanAccessStudent()
// (ou filtrar listas com visibleStudents()). Manter a regra num so lugar
// evita que uma rota nova esqueca a checagem.
const store = require("../store");
const { HttpError } = require("../router");

/**
 * Turmas que o usuario pode ver. `null` significa "todas" (coordenacao).
 * @param {object} user - req.user
 * @returns {string[] | null}
 */
function visibleClassIds(user) {
  if (user.role === "admin") return null;
  const teacher = store.getById("teachers", user.teacherId);
  return teacher ? teacher.classIds || [] : [];
}

/**
 * @param {object} user - req.user
 * @param {object} student - registro do aluno
 * @returns {boolean}
 */
function teacherOwnsStudent(user, student) {
  const classIds = visibleClassIds(user);
  if (classIds === null) return true;
  // Professora so ve aluno ATIVO das turmas dela: quem foi transferido,
  // concluiu ou saiu da escola some da tela dela (o historico continua
  // guardado e visivel para a coordenacao).
  return classIds.includes(student.classId) && (student.status || "ativo") === "ativo";
}

/**
 * Lista de alunos que o usuario pode ver.
 * @param {object} user - req.user
 * @returns {object[]}
 */
function visibleStudents(user) {
  const classIds = visibleClassIds(user);
  if (classIds === null) return store.getAll("students");
  // So os alunos ativos das turmas dela, consultados no banco (indice)
  return store.findBy("students", { classId: classIds, status: "ativo" });
}

/**
 * Busca o aluno e garante que o usuario tem acesso a ele.
 * Lanca 404 (aluno inexistente) ou 403 (aluno de outra turma).
 * @param {object} user - req.user
 * @param {string} studentId
 * @returns {object} o registro do aluno
 */
function assertCanAccessStudent(user, studentId) {
  const student = store.getById("students", studentId);
  if (!student) throw new HttpError(404, "Aluno não encontrado.");
  if (!teacherOwnsStudent(user, student)) {
    throw new HttpError(403, "Este aluno não está em nenhuma das suas turmas.");
  }
  return student;
}

module.exports = {
  visibleClassIds,
  teacherOwnsStudent,
  visibleStudents,
  assertCanAccessStudent
};
