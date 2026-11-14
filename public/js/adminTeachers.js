// ---------------------------------------------------------------------------
// Coordenacao - Professoras e contas da coordenacao
//
// Cadastro de professoras (com login proprio e turmas), senha provisoria e
// exclusao com a senha da coordenacao. Tambem as outras contas da
// coordenacao (sempre fica pelo menos uma).
// ---------------------------------------------------------------------------

// ---- professoras ------------------------------------------------------------

function renderAdminTeachers() {
  const table = el("teachersTable");
  const classesById = Object.fromEntries(state.classes.map((klass) => [klass.id, klass]));
  ListTools.fillSelect(
    el("teachersClassFilter"),
    activeClasses().map((klass) => ({ value: klass.id, label: klass.name })),
    "Todas as turmas"
  );
  const classFilter = el("teachersClassFilter").value;
  const search = el("teachersSearch").value;

  const teachers = state.teachers
    .filter((teacher) => !classFilter || (teacher.classIds || []).includes(classFilter))
    .filter((teacher) => ListTools.matches(`${teacher.name} ${teacher.email || ""}`, search))
    .sort(ListTools.byName());

  ListTools.setCount(el("teachersCount"), teachers.length, "professora", "professoras", "Nenhuma professora encontrada com esses filtros.");
  table.innerHTML = teachers
    .map((teacher) => {
      const classNames = (teacher.classIds || [])
        .map((id) => classesById[id])
        .filter((klass) => klass && klass.schoolYear === state.activeYear)
        .map((klass) => klass.name);
      return `
      <article class="entity-card">
        <div class="entity-card-head">
          <div class="avatar small-avatar" aria-hidden="true">${esc(initials(teacher.name))}</div>
          <div>
            <h2 class="title-sm" id="teacher-name-${esc(teacher.id)}">${esc(teacher.name)}</h2>
            <p class="entity-meta">${esc(teacher.email || "sem login")}</p>
          </div>
        </div>
        <p class="entity-meta">${classNames.length ? `Turmas: ${esc(classNames.join(", "))}` : `<span class="warning-text">Sem turma em ${esc(state.activeYear)}</span>`}</p>
        <div class="row-actions">
          <button class="secondary-action small-action" type="button" data-edit-teacher="${esc(teacher.id)}" aria-describedby="teacher-name-${esc(teacher.id)}">Editar</button>
          <button class="secondary-action small-action" type="button" data-password-teacher="${esc(teacher.id)}" aria-describedby="teacher-name-${esc(teacher.id)}">Redefinir senha</button>
          <button class="danger-outline small-action" type="button" data-delete-teacher="${esc(teacher.id)}" aria-describedby="teacher-name-${esc(teacher.id)}">Excluir</button>
        </div>
      </article>`;
    })
    .join("");

  table.querySelectorAll("[data-edit-teacher]").forEach((button) => {
    button.addEventListener("click", () => openTeacherDialog(button.dataset.editTeacher));
  });
  table.querySelectorAll("[data-password-teacher]").forEach((button) => {
    button.addEventListener("click", () => openTeacherPasswordDialog("teacher", button.dataset.passwordTeacher));
  });
  table.querySelectorAll("[data-delete-teacher]").forEach((button) => {
    button.addEventListener("click", () => deleteTeacher(button.dataset.deleteTeacher));
  });
  renderCoordinators();
}

/** Turmas do ano ativo para marcar no cadastro da professora. */
function renderTeacherClassCheckboxes(selectedIds) {
  el("teacherClassesCheckboxes").innerHTML =
    activeClasses()
      .map(
        (klass) => `
    <label class="checkbox-option">
      <input type="checkbox" value="${esc(klass.id)}" ${selectedIds.includes(klass.id) ? "checked" : ""} />
      ${esc(klass.name)}
    </label>`
      )
      .join("") || `<p class="muted">Cadastre as turmas de ${esc(state.activeYear)} primeiro.</p>`;
}

function openTeacherDialog(teacherId) {
  state.editingTeacherId = teacherId || null;
  const teacher = teacherId ? state.teachers.find((item) => item.id === teacherId) : null;
  el("teacherDialogTitle").textContent = teacher ? "Editar professora" : "Cadastrar professora";
  el("teacherDialogSubmit").textContent = teacher ? "Salvar alterações" : "Salvar professora";
  el("teacherNameInput").value = teacher ? teacher.name : "";
  el("teacherEmailInput").value = teacher ? teacher.email || "" : "";
  el("teacherPasswordInput").value = "";
  el("teacherPasswordFieldWrap").hidden = Boolean(teacher);
  el("teacherPasswordInput").required = !teacher;
  el("teacherDialogHint").textContent = teacher ? 'Para trocar a senha de acesso, use o botão "Redefinir senha" na lista.' : "";
  // Turmas de anos encerrados continuam ligadas (historico), mas nao aparecem para marcar
  renderTeacherClassCheckboxes(teacher ? teacher.classIds || [] : []);
  FocusReturn.open(el("teacherDialog"));
}


async function saveTeacher() {
  const checked = readCheckboxGroup("teacherClassesCheckboxes");
  const name = el("teacherNameInput").value.trim();
  const email = el("teacherEmailInput").value.trim();
  if (!name) throw DialogForms.fieldError("Escreva o nome completo da professora.", "teacherNameInput");
  if (!email) throw DialogForms.fieldError("Escreva o e-mail que ela vai usar para entrar.", "teacherEmailInput");
  if (state.editingTeacherId) {
    // Mantem os vinculos com turmas de anos encerrados (historico)
    const teacher = state.teachers.find((item) => item.id === state.editingTeacherId);
    const activeIds = new Set(activeClasses().map((klass) => klass.id));
    const oldYears = (teacher.classIds || []).filter((id) => !activeIds.has(id));
    const { orphanClasses } = await api("PUT", `/api/teachers/${state.editingTeacherId}`, { name, email, classIds: [...oldYears, ...checked] }).catch(
      emailFieldError("teacherEmailInput")
    );
    warnOrphanClasses(orphanClasses);
  } else {
    const password = el("teacherPasswordInput").value;
    if (password.length < 8) {
      throw DialogForms.fieldError("A senha provisória precisa ter pelo menos 8 caracteres.", "teacherPasswordInput");
    }
    await api("POST", "/api/teachers", { name, email, password, classIds: checked }).catch(emailFieldError("teacherEmailInput"));
  }
  showToast("Professora salva.");
  await refreshAdminData();
}

/**
 * Redefinir senha (provisoria) de uma professora ou de outra conta da coordenacao.
 * @param {"teacher"|"coordinator"} kind
 */
function openTeacherPasswordDialog(kind, id) {
  state.passwordTarget = { kind, id };
  const person =
    kind === "teacher" ? state.teachers.find((item) => item.id === id) : (state.coordinators || []).find((item) => item.id === id);
  el("teacherPasswordTitle").textContent = person ? `Nova senha para ${person.name}` : "Nova senha de acesso";
  el("teacherNewPasswordInput").value = "";
  FocusReturn.open(el("teacherPasswordDialog"));
}

async function saveTeacherPassword() {
  const password = el("teacherNewPasswordInput").value;
  if (password.length < 8) {
    throw DialogForms.fieldError("A senha provisória precisa ter pelo menos 8 caracteres.", "teacherNewPasswordInput");
  }
  const { kind, id } = state.passwordTarget;
  const url = kind === "teacher" ? `/api/teachers/${id}/password` : `/api/coordinators/${id}/password`;
  await api("PUT", url, { password });
  showToast("Senha provisória definida. A pessoa cria a própria senha no próximo login.");
}

async function deleteTeacher(teacherId) {
  const teacher = state.teachers.find((item) => item.id === teacherId);
  const password = await confirmDialog({
    title: `Excluir ${teacher ? teacher.name : "esta professora"}?`,
    message: "O acesso dela ao sistema também será removido. As atividades que ela registrou continuam no histórico dos alunos. Isso não pode ser desfeito.",
    confirmLabel: "Excluir professora",
    askPassword: true
  });
  if (password === null) return;
  try {
    const { orphanClasses } = await api("DELETE", `/api/teachers/${teacherId}`, { password });
    showToast("Professora excluída.");
    warnOrphanClasses(orphanClasses);
    await refreshAdminData();
    FocusReturn.restore(el("addTeacherButton"));
  } catch (error) {
    showToast(error.message, true);
  }
}

// ---- contas da coordenacao ----------------------------------------------------

async function renderCoordinators() {
  const table = el("coordinatorsTable");
  try {
    const { coordinators } = await api("GET", "/api/coordinators");
    state.coordinators = coordinators;
    table.innerHTML = coordinators
      .map(
        (person) => `
      <div class="table-row">
        <div class="table-row-title">
          <strong id="coordinator-name-${esc(person.id)}">${esc(person.name)}${person.isMe ? " (você)" : ""}</strong>
          <span class="muted">${esc(person.email)}</span>
        </div>
        ${
          person.isMe
            ? `<span class="hint-text">Sua senha: troque em Meu perfil.</span>`
            : `<div class="row-actions">
          <button class="secondary-action small-action" type="button" data-password-coordinator="${esc(person.id)}" aria-describedby="coordinator-name-${esc(person.id)}">Redefinir senha</button>
          <button class="danger-outline small-action" type="button" data-delete-coordinator="${esc(person.id)}" aria-describedby="coordinator-name-${esc(person.id)}">Excluir</button>
        </div>`
        }
      </div>`
      )
      .join("");
    if (coordinators.length === 1) {
      table.insertAdjacentHTML(
        "beforeend",
        `<p class="warning-text">Só existe uma conta da coordenação. Crie uma segunda (ex: direção) para não ficar sem acesso se a senha for esquecida.</p>`
      );
    }
    table.querySelectorAll("[data-password-coordinator]").forEach((button) => {
      button.addEventListener("click", () => openTeacherPasswordDialog("coordinator", button.dataset.passwordCoordinator));
    });
    table.querySelectorAll("[data-delete-coordinator]").forEach((button) => {
      button.addEventListener("click", () => deleteCoordinator(button.dataset.deleteCoordinator));
    });
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveCoordinator() {
  const name = el("coordinatorNameInput").value.trim();
  const email = el("coordinatorEmailInput").value.trim();
  const password = el("coordinatorPasswordInput").value;
  if (!name) throw DialogForms.fieldError("Escreva o nome.", "coordinatorNameInput");
  if (!email) throw DialogForms.fieldError("Escreva o e-mail de acesso.", "coordinatorEmailInput");
  if (password.length < 8) throw DialogForms.fieldError("A senha provisória precisa ter pelo menos 8 caracteres.", "coordinatorPasswordInput");
  await api("POST", "/api/coordinators", { name, email, password }).catch(emailFieldError("coordinatorEmailInput"));
  showToast("Conta da coordenação criada.");
  await renderCoordinators();
}

async function deleteCoordinator(id) {
  const person = (state.coordinators || []).find((item) => item.id === id);
  const password = await confirmDialog({
    title: `Excluir a conta de ${person ? person.name : "coordenação"}?`,
    message: "A pessoa perde o acesso ao sistema. Isso não pode ser desfeito.",
    confirmLabel: "Excluir conta",
    askPassword: true
  });
  if (password === null) return;
  try {
    await api("DELETE", `/api/coordinators/${id}`, { password });
    showToast("Conta excluída.");
    await renderCoordinators();
    FocusReturn.restore(el("addCoordinatorButton"));
  } catch (error) {
    showToast(error.message, true);
  }
}
