// ---------------------------------------------------------------------------
// Coordenacao - Turmas
//
// Lista de turmas por ano letivo e nivel, cadastro e exclusao (so turma
// vazia) e professoras de cada turma.
// ---------------------------------------------------------------------------

// ---- turmas ---------------------------------------------------------------

function renderAdminClasses() {
  const table = el("classesTable");
  const years = [...new Set(state.classes.map((klass) => klass.schoolYear))].sort((a, b) => b - a);
  if (!years.includes(state.activeYear)) years.unshift(state.activeYear);
  ListTools.fillSelect(
    el("classesYearFilter"),
    years.map((year) => ({ value: String(year), label: year === state.activeYear ? `${year} (ano atual)` : `${year} (encerrado)` })),
    null
  );
  if (!el("classesYearFilter").dataset.touched) el("classesYearFilter").value = String(state.activeYear);
  el("classesYearFilter").dataset.touched = "1";

  const year = Number(el("classesYearFilter").value);
  const level = el("classesLevelFilter").value;
  const search = el("classesSearch").value;
  const isCurrentYear = year === state.activeYear;
  el("schoolYearLine").textContent = `Ano letivo atual: ${state.activeYear}`;

  const classes = state.classes
    .filter((klass) => klass.schoolYear === year)
    .filter((klass) => !level || klass.level === level)
    .filter((klass) => ListTools.matches(klass.name, search))
    .sort(ListTools.byName());

  ListTools.setCount(el("classesCount"), classes.length, "turma", "turmas", "Nenhuma turma encontrada com esses filtros.");
  table.innerHTML = classes
    .map((klass) => {
      const teachers = state.teachers.filter((teacher) => (teacher.classIds || []).includes(klass.id)).map((teacher) => teacher.name);
      const students = (state.adminStudents || []).filter((student) => student.classId === klass.id && student.status === "ativo").length;
      return `
      <article class="entity-card">
        <div class="entity-card-head">
          <h2 class="title-sm" id="class-name-${esc(klass.id)}">${esc(klass.name)}</h2>
          <span class="activity-type">${esc(klass.level)} · ${esc(klass.schoolYear)}</span>
        </div>
        <p class="entity-meta"><strong>${esc(countLabel(students, "aluno ativo", "alunos ativos"))}</strong></p>
        <p class="entity-meta">${teachers.length ? `Professoras: ${esc(teachers.join(", "))}` : `<span class="warning-text">Sem professora vinculada</span>`}</p>
        ${
          isCurrentYear
            ? `<div class="row-actions">
          <button class="secondary-action small-action" type="button" data-class-teachers="${esc(klass.id)}" aria-describedby="class-name-${esc(klass.id)}">Professoras</button>
          <button class="secondary-action small-action" type="button" data-edit-class="${esc(klass.id)}" aria-describedby="class-name-${esc(klass.id)}">Editar</button>
          <button class="danger-outline small-action" type="button" data-delete-class="${esc(klass.id)}" aria-describedby="class-name-${esc(klass.id)}">Excluir</button>
        </div>`
            : `<p class="hint-text">Ano encerrado: só consulta.</p>`
        }
      </article>`;
    })
    .join("");

  table.querySelectorAll("[data-class-teachers]").forEach((button) => {
    button.addEventListener("click", () => openClassTeachersDialog(button.dataset.classTeachers));
  });
  table.querySelectorAll("[data-edit-class]").forEach((button) => {
    button.addEventListener("click", () => openClassDialog(button.dataset.editClass));
  });
  table.querySelectorAll("[data-delete-class]").forEach((button) => {
    button.addEventListener("click", () => deleteClass(button.dataset.deleteClass));
  });
}

function openClassDialog(classId) {
  state.editingClassId = classId || null;
  const klass = classId ? state.classes.find((item) => item.id === classId) : null;
  el("classDialogTitle").textContent = klass ? "Editar turma" : `Cadastrar turma (${state.activeYear})`;
  el("classDialogSubmit").textContent = klass ? "Salvar alterações" : "Salvar turma";
  el("classNameInput").value = klass ? klass.name : "";
  el("classLevelInput").value = klass ? klass.level : "Jardim";
  FocusReturn.open(el("classDialog"));
}

async function saveClass() {
  const payload = { name: el("classNameInput").value.trim(), level: el("classLevelInput").value };
  if (!payload.name) throw DialogForms.fieldError("Escreva o nome da turma.", "classNameInput");
  if (state.editingClassId) {
    await api("PUT", `/api/classes/${state.editingClassId}`, payload);
  } else {
    await api("POST", "/api/classes", payload);
  }
  showToast("Turma salva.");
  await refreshAdminData();
}

async function deleteClass(classId) {
  const klass = state.classes.find((item) => item.id === classId);
  const confirmed = await confirmDialog({
    title: klass ? `Excluir a turma ${klass.name}?` : "Excluir esta turma?",
    message: "Só dá para excluir turma sem alunos e sem professoras. Isso não pode ser desfeito.",
    confirmLabel: "Excluir turma"
  });
  if (!confirmed) return;
  try {
    await api("DELETE", `/api/classes/${classId}`);
    showToast("Turma excluída.");
    await refreshAdminData();
    FocusReturn.restore(el("addClassButton"));
  } catch (error) {
    showToast(error.message, true);
  }
}

/** Vincular professoras pela propria turma. */
function openClassTeachersDialog(classId) {
  const klass = state.classes.find((item) => item.id === classId);
  state.classTeachersId = classId;
  el("classTeachersTitle").textContent = klass ? `Professoras da turma ${klass.name}` : "Professoras da turma";
  const teachers = state.teachers.slice().sort(ListTools.byName());
  el("classTeachersCheckboxes").innerHTML =
    teachers
      .map(
        (teacher) => `
    <label class="checkbox-option">
      <input type="checkbox" value="${esc(teacher.id)}" ${(teacher.classIds || []).includes(classId) ? "checked" : ""} />
      ${esc(teacher.name)}
    </label>`
      )
      .join("") || `<p class="muted">Nenhuma professora cadastrada ainda.</p>`;
  FocusReturn.open(el("classTeachersDialog"));
}

async function saveClassTeachers() {
  const teacherIds = readCheckboxGroup("classTeachersCheckboxes");
  await api("PUT", `/api/classes/${state.classTeachersId}/teachers`, { teacherIds });
  showToast("Professoras da turma salvas.");
  await refreshAdminData();
}
