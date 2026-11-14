// ---------------------------------------------------------------------------
// Meus alunos (visao pedagogica)
//
// Cartoes dos alunos agrupados por turma, com busca e filtros. A professora
// ve so os alunos ativos das turmas dela (regra aplicada pelo servidor).
// ---------------------------------------------------------------------------

// Elementos da tela usados neste modulo
const studentsGrid = el("studentsGrid");

// ---- alunos (visão pedagógica) ---------------------------------------------

function groupByClass(students) {
  const classesById = Object.fromEntries(state.classes.map((k) => [k.id, k]));
  const groups = new Map();
  students.forEach((student) => {
    const classInfo = classesById[student.classId];
    const key = classInfo ? classInfo.id : "sem-turma";
    if (!groups.has(key)) groups.set(key, { classInfo, students: [] });
    groups.get(key).students.push(student);
  });
  // Turmas em ordem alfabetica
  return Array.from(groups.values()).sort((x, y) =>
    String(x.classInfo ? x.classInfo.name : "~").localeCompare(String(y.classInfo ? y.classInfo.name : "~"), "pt-BR")
  );
}

async function renderStudentsView() {
  if (!studentsGrid.children.length) showLoading(studentsGrid, "Carregando alunos...");
  try {
    const { students } = await api("GET", "/api/students");
    ListTools.fillSelect(
      el("studentsNeedFilter"),
      state.needs
        .filter((need) => students.some((student) => student.needId === need.id))
        .sort(ListTools.byName())
        .map((need) => ({ value: need.id, label: need.name })),
      "Todas as deficiências"
    );
    const classFilter = el("studentsClassFilter").value;
    const needFilter = el("studentsNeedFilter").value;
    const filtered = students
      .filter((student) => !classFilter || student.classId === classFilter)
      .filter((student) => !needFilter || student.needId === needFilter)
      .filter((student) => ListTools.matches(student.shortName, el("studentsSearch").value))
      .sort(ListTools.byName("shortName"));

    ListTools.setCount(el("studentsCount"), filtered.length, "aluno", "alunos", "");
    const groups = groupByClass(filtered);
    if (!groups.length) {
      studentsGrid.innerHTML = students.length
        ? `<p class="muted">Nenhum aluno encontrado. Confira o nome digitado ou limpe os filtros.</p>`
        : `<p class="muted">Nenhum aluno nas suas turmas ainda. Se faltar alguém, fale com a coordenação.</p>`;
      return;
    }

    studentsGrid.innerHTML = groups
      .map(
        (group) => `
      <section class="class-group">
        <h2 class="class-group-title">${esc(group.classInfo ? group.classInfo.name : "Sem turma")}</h2>
        <div class="students-grid">
          ${group.students
            .map(
              (student) => `
            <article class="mini-card">
              <div class="student-card-head">
                <div class="avatar" aria-hidden="true">${esc(initials(student.shortName))}</div>
                <div>
                  <h3 id="student-name-${esc(student.id)}">${esc(student.shortName)}</h3>
                  <p>${esc(student.age)} anos</p>
                </div>
              </div>
              <div class="meta-row"><span>${esc(student.disability)}</span><span>${esc(countLabel(student.feedbackCount, "atividade registrada", "atividades registradas"))}</span></div>
              <p>${esc(student.profile)}</p>
              <p><strong>Observação:</strong> ${esc(student.observation || "nenhuma observação registrada.")}</p>
              <p><strong>Cuidados:</strong> ${esc(student.cautions.join(", ") || "nenhum cadastrado.")}</p>
              <div class="row-actions">
                <button class="secondary-action small-action" type="button" data-observation-student="${esc(student.id)}" data-observation-current="${esc(student.observation || "")}" aria-describedby="student-name-${esc(student.id)}">Registrar observação</button>
                ${student.feedbackCount ? `<button class="text-action" type="button" data-history-student="${esc(student.id)}" data-history-name="${esc(student.shortName)}" aria-describedby="student-name-${esc(student.id)}">Ver histórico</button>` : ""}
              </div>
            </article>
          `
            )
            .join("")}
        </div>
      </section>
    `
      )
      .join("");

    studentsGrid.querySelectorAll("[data-observation-student]").forEach((button) => {
      button.addEventListener("click", () => openObservation(button.dataset.observationStudent, button.dataset.observationCurrent));
    });
    studentsGrid.querySelectorAll("[data-history-student]").forEach((button) => {
      button.addEventListener("click", () => StudentHistory.open(button.dataset.historyStudent, button.dataset.historyName));
    });
  } catch (error) {
    showToast(error.message, true);
  }
}
