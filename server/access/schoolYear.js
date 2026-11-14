// Ano letivo ativo (so um por vez - regra do banco em server/db/schema.js).
//
// Turmas novas e alunos novos sempre entram no ano ativo. Anos encerrados
// ficam guardados so para consulta (historico).
const store = require("../store");
const { HttpError } = require("../router");

/** @returns {number} o ano letivo ativo (ex: 2026) */
function activeYear() {
  const active = store.getAll("schoolYears").find((item) => item.status === "ativo");
  if (!active) throw new HttpError(500, "Nenhum ano letivo ativo encontrado.");
  return active.year;
}

/**
 * Garante que a turma existe e e do ano letivo ativo (nao da para colocar
 * aluno numa turma de um ano ja encerrado).
 * @returns {object} a turma
 */
function assertActiveClass(classId) {
  const klass = store.getById("classes", classId);
  if (!klass) throw new HttpError(400, "Turma inválida.");
  if (klass.schoolYear !== activeYear()) {
    throw new HttpError(400, `A turma ${klass.name} é do ano letivo de ${klass.schoolYear}, que já foi encerrado.`);
  }
  return klass;
}

module.exports = { activeYear, assertActiveClass };
