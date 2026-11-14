// ---------------------------------------------------------------------------
// Coordenacao - Alunos
//
// Cadastro completo (dados pessoais so aparecem para a coordenacao),
// situacao na escola (ativo, transferido, concluiu, saiu) e exclusao
// definitiva com nome completo + senha da coordenacao.
// ---------------------------------------------------------------------------

// ---- alunos (coordenacao) ------------------------------------------------------

/** Busca todos os alunos (com dados pessoais) uma vez; os filtros sao locais. */
async function loadAdminStudents() {
  const { students } = await api("GET", "/api/students");
  state.adminStudents = students;
}

function renderAdminStudents() {
  const grid = el("adminGrid");
  const students = state.adminStudents || [];
  const classesById = Object.fromEntries(state.classes.map((klass) => [klass.id, klass]));
  ListTools.fillSelect(
    el("adminStudentsClassFilter"),
    activeClasses().map((klass) => ({ value: klass.id, label: klass.name })),
    "Todas as turmas"
  );
  ListTools.fillSelect(
    el("adminStudentsNeedFilter"),
    state.needs.slice().sort(ListTools.byName()).map((need) => ({ value: need.id, label: need.name })),
    "Todas as deficiências"
  );
  const classFilter = el("adminStudentsClassFilter").value;
  const needFilter = el("adminStudentsNeedFilter").value;
  const statusFilter = el("adminStudentsStatusFilter").value;
  const search = el("adminStudentsSearch").value;

  const filtered = students
    .filter((student) => !classFilter || student.classId === classFilter)
    .filter((student) => !needFilter || student.needId === needFilter)
    .filter((student) => !statusFilter || student.status === statusFilter)
    .filter((student) => ListTools.matches(`${student.fullName} ${student.shortName}`, search))
    .sort(ListTools.byName("fullName"));

  ListTools.setCount(el("adminStudentsCount"), filtered.length, "aluno", "alunos", "Nenhum aluno encontrado com esses filtros.");
  const groups = groupByClass(filtered);
  grid.innerHTML = groups
    .map(
      (group) => `
    <section class="class-group">
      <h2 class="class-group-title">${esc(group.classInfo ? `${group.classInfo.name} · ${group.classInfo.schoolYear}` : "Sem turma")}</h2>
      <div class="admin-grid">
        ${group.students.map((student) => adminStudentCard(student, classesById)).join("")}
      </div>
    </section>`
    )
    .join("");

  grid.querySelectorAll("[data-edit-student]").forEach((button) => {
    button.addEventListener("click", () => openStudentDialog(button.dataset.editStudent));
  });
  grid.querySelectorAll("[data-status-student]").forEach((button) => {
    button.addEventListener("click", () => openStudentStatusDialog(button.dataset.statusStudent));
  });
  grid.querySelectorAll("[data-history-student]").forEach((button) => {
    button.addEventListener("click", () => StudentHistory.open(button.dataset.historyStudent, button.dataset.historyName));
  });
}

function adminStudentCard(student, classesById) {
  const klass = classesById[student.classId];
  const editable = student.status === "ativo" || (klass && klass.schoolYear === state.activeYear);
  return `
    <article class="admin-card ${student.status !== "ativo" ? "is-inactive" : ""}">
      <div class="entity-card-head">
        <h3 class="title-sm" id="admin-student-name-${esc(student.id)}">${esc(student.fullName)}</h3>
        <span class="status-badge status-${esc(student.status)}">${esc(STATUS_LABELS[student.status] || student.status)}</span>
      </div>
      <p>${esc(student.age)} anos · ${esc(student.disability)} · ${esc(countLabel(student.feedbackCount, "atividade registrada", "atividades registradas"))}</p>
      ${student.status !== "ativo" && student.statusNote ? `<p class="muted">${esc(student.statusNote)}${student.statusDate ? ` (${esc(student.statusDate.split("-").reverse().join("/"))})` : ""}</p>` : ""}
      <details class="admin-private">
        <summary class="private-label"><span aria-hidden="true">🔒</span> Dados pessoais (só a coordenação vê)</summary>
        <p><strong>Nascimento:</strong> ${esc(student.birthDate)}</p>
        <p><strong>Responsável:</strong> ${esc(student.guardian)}</p>
        <p><strong>Contato:</strong> ${esc(student.phone)}</p>
        <p><strong>Documentos:</strong> ${esc(student.documentsNote || "nenhum registrado.")}</p>
      </details>
      <div class="row-actions">
        ${editable ? `<button class="secondary-action small-action" type="button" data-edit-student="${esc(student.id)}" aria-describedby="admin-student-name-${esc(student.id)}">Editar</button>` : ""}
        <button class="secondary-action small-action" type="button" data-status-student="${esc(student.id)}" aria-describedby="admin-student-name-${esc(student.id)}">Situação</button>
        <button class="secondary-action small-action" type="button" data-history-student="${esc(student.id)}" data-history-name="${esc(student.shortName)}" aria-describedby="admin-student-name-${esc(student.id)}">Histórico</button>
      </div>
    </article>`;
}

function populateStudentClassOptions(currentClassId) {
  const options = activeClasses();
  // Aluno de turma antiga sendo editado: mostra a turma dele tambem
  const current = state.classes.find((klass) => klass.id === currentClassId);
  if (current && !options.includes(current)) options.unshift(current);
  el("studentClassInput").innerHTML = options
    .map((klass) => `<option value="${esc(klass.id)}">${esc(klass.name)}${klass.schoolYear !== state.activeYear ? ` (${esc(klass.schoolYear)})` : ""}</option>`)
    .join("");
}

function populateStudentNeedOptions(selectedId) {
  el("studentNeedInput").innerHTML =
    `<option value="">Selecione...</option>` +
    state.needs
      .slice()
      .sort(ListTools.byName())
      .map((need) => `<option value="${esc(need.id)}" ${need.id === selectedId ? "selected" : ""}>${esc(need.name)}</option>`)
      .join("");
}

function renderCheckboxGroup(containerId, tags, selected) {
  el(containerId).innerHTML = tags
    .map(
      (tag) => `
    <label class="checkbox-option">
      <input type="checkbox" value="${esc(tag)}" ${selected.includes(tag) ? "checked" : ""} />
      ${esc(tag)}
    </label>`
    )
    .join("");
}

function readCheckboxGroup(containerId) {
  return Array.from(el(containerId).querySelectorAll("input:checked")).map((input) => input.value);
}

function openStudentDialog(studentId) {
  state.editingStudentId = studentId || null;
  const student = studentId ? (state.adminStudents || []).find((item) => item.id === studentId) : null;
  populateStudentClassOptions(student ? student.classId : null);

  el("studentDialogTitle").textContent = student ? "Editar aluno" : "Cadastrar aluno";
  el("studentDialogSubmit").textContent = student ? "Salvar alterações" : "Salvar aluno";

  el("studentFullNameInput").value = student ? student.fullName : "";
  el("studentShortNameInput").value = student ? student.shortName : "";
  el("studentAgeInput").value = student ? student.age : "";
  el("studentClassInput").value = student ? student.classId : activeClasses()[0]?.id || "";
  populateStudentNeedOptions(student ? student.needId : null);
  el("studentProfileInput").value = student ? student.profile : "";
  renderCheckboxGroup("studentStrengthsCheckboxes", state.tags.strengthTags, student ? student.strengths : []);
  renderCheckboxGroup("studentCautionsCheckboxes", state.tags.cautionTags, student ? student.cautions : []);
  el("studentBirthDateInput").value = student ? student.birthDate : "";
  el("studentGuardianInput").value = student ? student.guardian : "";
  el("studentPhoneInput").value = student ? student.phone : "";
  el("studentDocumentsInput").value = student ? student.documentsNote : "";

  FocusReturn.open(el("studentDialog"));
}

async function saveStudent() {
  const needId = el("studentNeedInput").value || null;
  const needOption = needId ? state.needs.find((item) => item.id === needId) : null;
  if (!el("studentClassInput").value) throw DialogForms.fieldError(`Cadastre uma turma de ${state.activeYear} primeiro.`, "studentClassInput");
  if (!needId) throw DialogForms.fieldError("Escolha a deficiência ou necessidade do aluno.", "studentNeedInput");
  const payload = {
    fullName: el("studentFullNameInput").value.trim(),
    shortName: el("studentShortNameInput").value.trim(),
    age: Number(el("studentAgeInput").value),
    classId: el("studentClassInput").value,
    needId,
    disability: needOption ? needOption.name : "Não informado",
    profile: el("studentProfileInput").value.trim(),
    strengths: readCheckboxGroup("studentStrengthsCheckboxes"),
    cautions: readCheckboxGroup("studentCautionsCheckboxes"),
    birthDate: el("studentBirthDateInput").value.trim(),
    guardian: el("studentGuardianInput").value.trim(),
    phone: el("studentPhoneInput").value.trim(),
    documentsNote: el("studentDocumentsInput").value.trim()
  };
  if (state.editingStudentId) {
    await api("PUT", `/api/students/${state.editingStudentId}`, payload);
  } else {
    await api("POST", "/api/students", payload);
  }
  showToast("Aluno salvo.");
  await refreshAdminData();
}

function openStudentStatusDialog(studentId) {
  const student = (state.adminStudents || []).find((item) => item.id === studentId);
  state.statusStudentId = studentId;
  el("studentStatusTitle").textContent = student ? `Situação de ${student.shortName}` : "Situação do aluno";
  el("studentStatusInput").value = student ? student.status : "ativo";
  el("studentStatusNote").value = student && student.status !== "ativo" ? student.statusNote || "" : "";
  // Area de exclusao sempre comeca fechada e vazia
  el("deleteStudentZone").open = false;
  el("deleteStudentExpected").textContent = student ? student.fullName : "";
  // Pode haver alunos com o mesmo nome: mostra dados para conferir que e a
  // crianca certa (a exclusao e sempre deste cadastro, nunca "por nome")
  const klass = student && state.classes.find((item) => item.id === student.classId);
  el("deleteStudentWho").textContent = student
    ? `Confira: ${student.fullName} · turma ${klass ? `${klass.name} (${klass.schoolYear})` : "—"} · nascimento ${student.birthDate || "—"} · responsável ${student.guardian || "—"}`
    : "";
  el("deleteStudentConfirm").value = "";
  el("deleteStudentPassword").value = "";
  el("deleteStudentStatus").textContent = "";
  FocusReturn.open(el("studentStatusDialog"));
}

async function saveStudentStatus() {
  await api("PUT", `/api/students/${state.statusStudentId}/status`, {
    status: el("studentStatusInput").value,
    note: el("studentStatusNote").value.trim()
  });
  showToast("Situação do aluno salva.");
  await refreshAdminData();
}

/**
 * Exclusao DEFINITIVA (dentro da janela "Situacao", area fechada, longe do
 * botao Editar). Exige digitar o nome completo E a senha da coordenacao, e
 * o servidor confere os dois.
 */
async function deleteStudent() {
  const student = (state.adminStudents || []).find((item) => item.id === state.statusStudentId);
  const typed = el("deleteStudentConfirm").value;
  const sameName = (a, b) => String(a || "").trim().replace(/\s+/g, " ").toLowerCase() === String(b || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!student || !sameName(typed, student.fullName)) {
    el("deleteStudentStatus").textContent = "O nome digitado não confere. Digite o nome completo exatamente como aparece acima.";
    el("deleteStudentConfirm").setAttribute("aria-invalid", "true");
    el("deleteStudentConfirm").focus();
    return;
  }
  el("deleteStudentConfirm").removeAttribute("aria-invalid");
  const password = el("deleteStudentPassword").value;
  if (!password) {
    el("deleteStudentStatus").textContent = "Digite a sua senha da coordenação para confirmar.";
    el("deleteStudentPassword").focus();
    return;
  }
  try {
    await api("DELETE", `/api/students/${student.id}`, { confirmName: typed, password });
    el("studentStatusDialog").close();
    showToast(`${student.shortName} foi excluído definitivamente.`);
    await refreshAdminData();
    FocusReturn.restore(el("addStudentButton"));
  } catch (error) {
    el("deleteStudentStatus").textContent = error.message;
    el("deleteStudentPassword").value = "";
    el(/senha/i.test(error.message) ? "deleteStudentPassword" : "deleteStudentConfirm").focus();
  }
}
