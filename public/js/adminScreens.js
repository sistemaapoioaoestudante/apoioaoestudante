// ---------------------------------------------------------------------------
// Telas da coordenacao - base comum
//
// Liga os eventos das telas Turmas, Professoras e Alunos (cada uma tem o
// seu modulo: adminClasses.js, adminTeachers.js, adminStudents.js) e guarda
// o que elas dividem: situacoes do aluno, turmas do ano ativo, recarga dos
// dados e avisos comuns.
//
// Usa as funcoes gerais do nucleo, js/core.js (api, el, esc, showToast,
// state, confirmDialog...) e os modulos FocusReturn, DialogForms e ListTools.
// Cada lista tem busca e filtros, e mostra quantos itens encontrou.
// ---------------------------------------------------------------------------

const STATUS_LABELS = { ativo: "Ativo", transferido: "Transferido", concluiu: "Concluiu", saiu: "Saiu" };

/** Turmas do ano letivo ativo (as de anos encerrados ficam so para consulta). */
function activeClasses() {
  return state.classes.filter((klass) => klass.schoolYear === state.activeYear).sort(ListTools.byName());
}

/** Liga os eventos das telas da coordenacao (chamado uma vez, no boot). */
function bindAdminEvents() {
  const restoreFocus = { afterClose: () => FocusReturn.restore() };

  // Turmas
  el("addClassButton").addEventListener("click", () => openClassDialog());
  DialogForms.bind(el("classForm"), saveClass, restoreFocus);
  DialogForms.bind(el("classTeachersForm"), saveClassTeachers, restoreFocus);
  ["classesSearch", "classesYearFilter", "classesLevelFilter"].forEach((id) => {
    el(id).addEventListener(id === "classesSearch" ? "input" : "change", () => renderAdminClasses());
  });

  // Professoras e contas da coordenacao
  el("addTeacherButton").addEventListener("click", () => openTeacherDialog());
  DialogForms.bind(el("teacherForm"), saveTeacher, restoreFocus);
  DialogForms.bind(el("teacherPasswordForm"), saveTeacherPassword, restoreFocus);
  el("teachersSearch").addEventListener("input", () => renderAdminTeachers());
  el("teachersClassFilter").addEventListener("change", () => renderAdminTeachers());
  el("addCoordinatorButton").addEventListener("click", () => {
    ["coordinatorNameInput", "coordinatorEmailInput", "coordinatorPasswordInput"].forEach((id) => {
      el(id).value = "";
    });
    FocusReturn.open(el("coordinatorDialog"));
  });
  DialogForms.bind(el("coordinatorForm"), saveCoordinator, restoreFocus);

  // Alunos
  el("addStudentButton").addEventListener("click", () => openStudentDialog());
  DialogForms.bind(el("studentForm"), saveStudent, restoreFocus);
  DialogForms.bind(el("studentStatusForm"), saveStudentStatus, restoreFocus);
  el("deleteStudentButton").addEventListener("click", deleteStudent);
  el("adminStudentsSearch").addEventListener("input", () => renderAdminStudents());
  ["adminStudentsClassFilter", "adminStudentsNeedFilter", "adminStudentsStatusFilter"].forEach((id) => {
    el(id).addEventListener("change", () => renderAdminStudents());
  });

  bindAiSettingsEvents(); // js/aiSettings.js
  SchoolYear.bind(); // js/schoolYear.js (virada de ano)
}

/** Recarrega turmas/professoras/alunos e redesenha as telas da coordenacao. */
async function refreshAdminData() {
  await loadReferenceData();
  await loadAdminStudents();
  renderAdminClasses();
  renderAdminTeachers();
  renderAdminStudents();
}

/**
 * Erro do servidor sobre e-mail (repetido ou invalido) aponta o campo
 * E-mail: ele fica marcado e recebe o foco.
 */
function emailFieldError(fieldId) {
  return (error) => {
    if (/e-mail/i.test(error.message)) throw DialogForms.fieldError(error.message, fieldId);
    throw error;
  };
}

function warnOrphanClasses(orphanClasses) {
  if (orphanClasses && orphanClasses.length) {
    showToast(`Atenção: a turma "${orphanClasses.join('", "')}" ficou sem nenhuma professora vinculada.`, true);
  }
}
