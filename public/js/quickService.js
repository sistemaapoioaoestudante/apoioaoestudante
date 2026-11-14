// ---------------------------------------------------------------------------
// Atendimento rapido (tela da professora)
//
// Escolha de turma, aluno, tema e objetivo da BNCC; geracao das atividades
// pela IA (uma de cada vez, com fila e reconexao); atividade selecionada e
// registro do resultado; observacao sobre o aluno.
// ---------------------------------------------------------------------------

// Elementos da tela usados neste modulo
const themeInput = el("themeInput");
const bnccDescription = el("bnccDescription");
const studentSummary = el("studentSummary");
const studentSummaryEmpty = el("studentSummaryEmpty");
const activitiesGrid = el("activitiesGrid");
const activitiesEmpty = el("activitiesEmpty");
const sharedObjective = el("sharedObjective");
const activitiesSourceLine = el("activitiesSourceLine");
const observationDialog = el("observationDialog");
const observationTitle = el("observationTitle");
const studentObservationInput = el("studentObservation");

// ---- sugestões de tema --------------------------------------------------------

// Botões com temas comuns: um clique preenche o campo "Tema do dia".
function renderThemeChips() {
  const container = el("themeChips");
  container.innerHTML = UiText.THEME_SUGGESTIONS.map(
    (theme) => `<button type="button" class="theme-chip" data-theme="${esc(theme)}">${esc(theme)}</button>`
  ).join("");
  container.querySelectorAll("[data-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      themeInput.value = button.dataset.theme;
      themeInput.focus();
    });
  });
}

// ---- atendimento rápido ----------------------------------------------------

function teacherRecordForCurrentUser() {
  if (!state.user || state.user.role !== "teacher") return null;
  return state.teachers.find((teacher) => teacher.id === state.user.teacherId) || null;
}

function visibleClasses() {
  const current = state.classes.filter((klass) => klass.schoolYear === state.activeYear);
  if (state.user && state.user.role === "admin") return current;
  const teacher = teacherRecordForCurrentUser();
  if (!teacher) return []; // professora sem cadastro ligado: nenhuma turma
  return current.filter((klass) => (teacher.classIds || []).includes(klass.id)).sort(ListTools.byName());
}

function populateClassSelect() {
  const classes = visibleClasses();
  classSelect.innerHTML = classes.length
    ? classes.map((klass) => `<option value="${esc(klass.id)}">${esc(klass.name)}</option>`).join("")
    : `<option value="">Nenhuma turma vinculada</option>`;
  ListTools.fillSelect(el("studentsClassFilter"), classes.map((klass) => ({ value: klass.id, label: klass.name })), "Todas as turmas");
}

function getSelectedClass() {
  return state.classes.find((klass) => klass.id === classSelect.value) || visibleClasses()[0];
}

async function handleClassChange() {
  populateBnccSelect();
  await populateStudentSelect();
  await handleStudentChange();
}

// BNCC agrupado por campo de experiência (cada código aparece dentro do
// campo a que pertence).
function populateBnccSelect() {
  const classInfo = getSelectedClass();
  if (!classInfo) {
    bnccSelect.innerHTML = "";
    bnccDescription.textContent = "";
    return;
  }
  const goals = state.bnccGoals.filter((goal) => goal.level === classInfo.level);
  const byField = new Map();
  goals.forEach((goal) => {
    if (!byField.has(goal.field)) byField.set(goal.field, []);
    byField.get(goal.field).push(goal);
  });
  bnccSelect.innerHTML = Array.from(byField.entries())
    .map(
      ([field, items]) => `
    <optgroup label="${esc(field)}">
      ${items.map((goal) => `<option value="${esc(goal.code)}">${esc(goal.code)} — ${esc(shortText(goal.text, 60))}</option>`).join("")}
    </optgroup>
  `
    )
    .join("");
  updateBnccDescription();
}

function updateBnccDescription() {
  const goal = state.bnccGoals.find((item) => item.code === bnccSelect.value);
  bnccDescription.textContent = goal ? `${goal.field}: ${goal.text}` : "";
}

async function populateStudentSelect() {
  const classInfo = getSelectedClass();
  if (!classInfo) {
    studentSelect.innerHTML = "";
    return;
  }
  const { students } = await api("GET", "/api/students");
  state.studentsInClass = students.filter((student) => student.classId === classInfo.id);
  // Nenhum aluno pré-selecionado: a professora escolhe de propósito antes de
  // ver qualquer dado pedagógico ou atividade (ver handleStudentChange).
  studentSelect.innerHTML =
    `<option value="">Selecione um aluno...</option>` +
    state.studentsInClass
      .map((student) => `<option value="${esc(student.id)}">${esc(student.shortName)} - ${esc(student.age)} anos - ${esc(student.disability)}</option>`)
      .join("");
}

async function handleStudentChange() {
  if (!studentSelect.value) {
    studentSummary.innerHTML = "";
    studentSummaryEmpty.hidden = false;
    activitiesGrid.innerHTML = "";
    sharedObjective.hidden = true;
    assignmentPanel.hidden = true;
    cancelActivityGeneration(); // trocou para "nenhum aluno" no meio da geracao
    activitiesEmpty.hidden = false; // dica "Escolha um aluno..."
    setActivitiesStatus(null, "");
    return;
  }
  studentSummaryEmpty.hidden = true;
  await renderStudentSummary();
  await checkOpenAssignment();
}

async function renderStudentSummary() {
  const studentId = studentSelect.value;
  if (!studentId) return;
  const { student, classInfo, need, observation, history, historyTotal } = await api("GET", `/api/students/${studentId}/summary`);

  studentSummary.innerHTML = `
    <div class="student-card-head">
      <div class="avatar" aria-hidden="true">${esc(initials(student.shortName))}</div>
      <div>
        <h2>${esc(student.shortName)}</h2>
        <p>${esc(student.age)} anos · ${esc(classInfo.name)} · ${esc(student.disability)}</p>
      </div>
    </div>
    <ul class="summary-list">
      <li>${esc(student.profile)}</li>
      <li>Base da deficiência: ${esc(need.summary)}</li>
      <li>Funciona bem: ${esc(student.strengths.join(", ") || "nenhum ponto forte cadastrado.")}</li>
      <li>Cuidados: ${esc(student.cautions.join(", ") || "nenhum cuidado cadastrado.")}</li>
      <li>Observação da professora: ${esc(observation || "nenhuma observação registrada.")}</li>
    </ul>
    <button class="secondary-action full-action" type="button" data-observation-student="${esc(student.id)}">Registrar observação</button>
    <div class="history-list">
      <h3>Últimos registros</h3>
      ${
        history.length
          ? history.map((item) => `<div class="history-item"><strong>${esc(item.result)}</strong>${esc(item.theme)} · ${esc(item.activityTitle)}<br>${esc(item.notes || "Sem observações adicionais.")}</div>`).join("")
          : `<div class="history-item">Nenhuma atividade registrada ainda para este aluno.</div>`
      }
      ${
        historyTotal > history.length
          ? `<button class="text-action" type="button" data-full-history>Ver histórico completo (${esc(historyTotal)} registros)</button>`
          : ""
      }
    </div>
  `;
  const fullHistory = studentSummary.querySelector("[data-full-history]");
  if (fullHistory) fullHistory.addEventListener("click", () => StudentHistory.open(student.id, student.shortName));

  studentSummary.querySelector("[data-observation-student]").addEventListener("click", (e) => {
    openObservation(e.currentTarget.dataset.observationStudent, observation);
  });
}

// ---- atividade selecionada e registro do resultado --------------------------

async function checkOpenAssignment() {
  const studentId = studentSelect.value;
  const { assignments } = await api("GET", `/api/assignments?studentId=${encodeURIComponent(studentId)}&status=selecionada`);
  if (assignments.length) {
    // Atividade em andamento é um estado real que já existia antes de abrir
    // esta tela - mostrar automaticamente não é "gerar sem pedir", é só
    // exibir o que já estava em curso.
    state.currentAssignment = assignments[0];
    renderAssignmentPanel();
  } else {
    // Não gera atividades sozinho ao trocar de aluno - só limpa a área,
    // esperando o clique explícito em "Gerar/Consultar atividades".
    state.currentAssignment = null;
    assignmentPanel.hidden = true;
    clearActivitiesArea();
  }
}

function clearActivitiesArea() {
  cancelActivityGeneration(); // trocou de aluno no meio de uma geração
  activitiesGrid.innerHTML = "";
  activitiesEmpty.hidden = false;
  sharedObjective.hidden = true;
  setActivitiesStatus(null, "");
}

function renderAssignmentPanel() {
  const assignment = state.currentAssignment;
  if (!assignment) {
    assignmentPanel.hidden = true;
    return;
  }
  activitiesGrid.innerHTML = "";
  activitiesEmpty.hidden = true;
  sharedObjective.hidden = true;
  el("suggestionsTitle").textContent = "Atividade em andamento";
  el("suggestionsSubtitle").textContent = "Selecione o resultado quando a atividade for aplicada.";
  el("assignmentType").textContent = assignment.activity.type;
  el("assignmentTitle").textContent = assignment.activity.title;
  const resourceBox = el("assignmentResource");
  resourceBox.textContent = assignment.activity.resource;
  resourceBox.className = `resource-box ${assignment.activity.resourceClass || ""}`;
  el("assignmentMethod").textContent = assignment.activity.method;
  el("assignmentAdaptation").textContent = assignment.activity.adaptation;
  el("assignmentNotes").value = "";
  assignmentPanel.hidden = false;
}

async function resolveAssignment(result) {
  if (!state.currentAssignment) return;
  try {
    await api("PUT", `/api/assignments/${state.currentAssignment.id}/resolve`, {
      result,
      notes: el("assignmentNotes").value.trim()
    });
    showToast("Resultado registrado.");
    state.currentAssignment = null;
    el("suggestionsTitle").textContent = "Ideias de atividades";
    el("suggestionsSubtitle").textContent = "";
    await renderStudentSummary();
    await renderStudentsView();
    await checkOpenAssignment();
    el("suggestionsTitle").focus(); // o painel com os botoes de resultado sumiu
  } catch (error) {
    showToast(error.message, true);
  }
}

async function cancelAssignment() {
  if (!state.currentAssignment) return;
  const confirmed = await confirmDialog({
    title: "Desistir desta atividade?",
    message: "Nenhum resultado será registrado e você poderá gerar ou escolher outra atividade para este aluno.",
    confirmLabel: "Desistir da atividade",
    cancelLabel: "Manter atividade",
    danger: false
  });
  if (!confirmed) return;
  try {
    await api("DELETE", `/api/assignments/${state.currentAssignment.id}`);
    state.currentAssignment = null;
    el("suggestionsTitle").textContent = "Ideias de atividades";
    el("suggestionsSubtitle").textContent = "";
    await checkOpenAssignment();
    el("suggestionsTitle").focus();
  } catch (error) {
    showToast(error.message, true);
  }
}

// ---- geração de atividades pela IA (uma de cada vez) -------------------------
//
// As 3 atividades são geradas pela IA local numa única consulta, e cada uma
// aparece na tela assim que fica pronta (o servidor manda aos pedaços - ver
// public/js/activityStream.js). Não existe mais "motor por regras": se a IA
// estiver desligada ou falhar, a professora vê uma mensagem clara e um botão
// para tentar de novo - nunca atividades de outra origem misturadas.

const ACTIVITY_TOTAL = 3;

// Cancela uma geração em andamento (ex: a professora trocou de aluno) - o
// servidor percebe a conexão fechando e para de usar o processador.
function cancelActivityGeneration() {
  if (state.activityAbort) {
    state.activityAbort.abort();
    state.activityAbort = null;
  }
}

/**
 * Linha de situação acima das atividades.
 * @param {"progress"|"ok"|"error"|null} kind - null esconde a linha
 * @param {string} message
 * @param {{ retry?: boolean }} [options] - mostra o botão "Gerar novamente"
 */
// Aviso de tempo mostrado durante toda a geração: a professora sabe que
// pode levar minutos e não acha que o sistema travou.
const GENERATION_TIME_HINT = "Isso leva de 1 a 3 minutos — as atividades aparecem aqui uma de cada vez.";

/** Texto de progresso: "preparando a atividade 2 de 3…" + aviso de tempo. */
function progressMessage() {
  const next = state.lastActivities.length + 1;
  const warming = state.generationWarming ? " A IA está sendo preparada (cerca de 1 minuto a mais na primeira vez)." : "";
  return `A IA está preparando a atividade ${next} de ${ACTIVITY_TOTAL}…${warming} ${GENERATION_TIME_HINT}`;
}

/**
 * @param {"progress"|"ok"|"error"|null} kind - null esconde a linha
 * @param {string} message
 * @param {{ retry?: "all"|"missing"|null }} [options] - botão de tentar de novo
 */
function setActivitiesStatus(kind, message, { retry = null } = {}) {
  activitiesSourceLine.className = "ai-status-line" + (kind ? ` is-${kind}` : "");
  activitiesSourceLine.hidden = !kind;
  const missing = ACTIVITY_TOTAL - state.lastActivities.length;
  const retryLabel = retry === "missing" ? `Gerar ${missing === 1 ? "a que faltou" : `as ${missing} que faltaram`}` : "Gerar novamente";
  activitiesSourceLine.innerHTML = kind
    ? `<span>${esc(message)}</span>${retry ? ` <button type="button" class="text-action" data-retry-activities>${esc(retryLabel)}</button>` : ""}`
    : "";
  const retryButton = activitiesSourceLine.querySelector("[data-retry-activities]");
  if (retryButton) {
    retryButton.addEventListener("click", () => {
      if (retry === "missing") loadActivities({ complete: true });
      else el("plannerForm").requestSubmit();
    });
  }
}

/**
 * Pede as atividades à IA.
 * @param {{ complete?: boolean }} [options] - complete: mantém as que já
 *   vieram e pede só as que faltaram (sem repetir as já geradas)
 */
async function loadActivities({ complete = false } = {}) {
  if (state.currentAssignment) return; // já existe uma atividade em andamento - o painel dela é quem manda na tela
  const studentId = studentSelect.value;
  const goalCode = bnccSelect.value;
  cancelActivityGeneration();
  if (!complete) {
    state.lastActivities = [];
    activitiesGrid.innerHTML = "";
    sharedObjective.hidden = true;
  }
  if (!studentId || !goalCode) {
    activitiesEmpty.hidden = false;
    setActivitiesStatus(null, "");
    return;
  }

  activitiesEmpty.hidden = true;
  state.generationWarming = false;
  setActivitiesStatus("progress", progressMessage());
  const controller = new AbortController();
  state.activityAbort = controller;
  let url = `/api/activities?studentId=${encodeURIComponent(studentId)}&goalCode=${encodeURIComponent(goalCode)}&theme=${encodeURIComponent(themeInput.value)}`;
  if (complete) {
    const missing = ACTIVITY_TOTAL - state.lastActivities.length;
    const titles = state.lastActivities.map((activity) => activity.title).join("|");
    url += `&quantidade=${missing}&evitar=${encodeURIComponent(titles)}`;
  }

  // A geração continua no computador da escola mesmo se a conexão cair
  // (ex: a tela do celular apagou). Se cair, a tela reconecta sozinha ao
  // MESMO pedido e recebe tudo o que já ficou pronto (server/ai/generationJobs.js).
  const base = state.lastActivities.length; // atividades que já estavam na tela
  for (let attempt = 0; ; attempt++) {
    try {
      await ActivityStream.open(url, { signal: controller.signal, onEvent: handleActivityEvent });
      break;
    } catch (error) {
      if (controller.signal.aborted) break; // cancelado de propósito (troca de aluno)
      if (error.status === 401 || error.code === "PASSWORD_CHANGE_REQUIRED") {
        window.location.reload();
        return;
      }
      // Sem status = conexão caiu (não foi o servidor que recusou): tenta de novo
      if (error.status === undefined && attempt < 5) {
        setActivitiesStatus("progress", "A conexão caiu, mas a IA continua trabalhando. Reconectando…");
        await waitUntilVisible(3000);
        // o servidor reenvia tudo deste pedido: tira o que veio na tentativa anterior
        state.lastActivities.length = base;
        while (activitiesGrid.children.length > base) activitiesGrid.lastElementChild.remove();
        continue;
      }
      showGenerationProblem(error.message);
      break;
    }
  }
  if (state.activityAbort === controller) state.activityAbort = null;
}

/** Espera alguns segundos e, se a tela estiver apagada/escondida, até ela voltar. */
function waitUntilVisible(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!document.hidden) return resolve();
      document.addEventListener("visibilitychange", function onVisible() {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", onVisible);
        resolve();
      });
    }, ms);
  });
}

/** Trata cada evento que o servidor manda durante a geração. */
function handleActivityEvent(event) {
  if (event.type === "queued") {
    // Outra professora está gerando: este pedido espera a vez
    setActivitiesStatus(
      "progress",
      `Na fila: ${countLabel(event.ahead, "pedido", "pedidos")} na frente. A geração começa sozinha quando chegar a vez — pode continuar usando o sistema.`
    );
  } else if (event.type === "start") {
    state.generationLabel = event.label;
    state.generationWarming = Boolean(event.warming);
    sharedObjective.hidden = false;
    sharedObjective.textContent = `Objetivo BNCC: ${event.goal.code} - ${event.goal.text}`;
    setActivitiesStatus("progress", progressMessage());
  } else if (event.type === "activity") {
    state.generationWarming = false;
    state.lastActivities.push(event.activity);
    appendActivityCard(event.activity);
    if (state.lastActivities.length < ACTIVITY_TOTAL) setActivitiesStatus("progress", progressMessage());
  } else if (event.type === "done") {
    setActivitiesStatus("ok", `Atividades geradas pela IA (${state.generationLabel}).`);
  } else if (event.type === "error") {
    showGenerationProblem(event.message);
  }
}

// Se já vieram algumas atividades, oferece completar só as que faltaram
// (sem perder as que já estão na tela); se não veio nenhuma, gerar de novo.
function showGenerationProblem(message) {
  const delivered = state.lastActivities.length;
  const prefix = delivered
    ? `A IA gerou ${delivered} de ${ACTIVITY_TOTAL} atividades.`
    : "Não foi possível gerar as atividades.";
  setActivitiesStatus("error", `${prefix} ${message}`, { retry: delivered ? "missing" : "all" });
}

/** Adiciona UM cartão de atividade ao final da grade. */
function appendActivityCard(activity) {
  const canSelect = !(state.user && state.user.role === "admin");
  const kind = ActivityKinds.get(activity.resourceClass);
  activitiesGrid.insertAdjacentHTML(
    "beforeend",
    `
    <article class="activity-card is-new" data-kind="${esc(activity.resourceClass)}">
      <div class="activity-card-head">
        <span class="activity-icon" aria-hidden="true">${esc(kind.icon)}</span>
        <span class="activity-type">${esc(activity.type || kind.label)}</span>
      </div>
      <h3 id="activity-title-${esc(activity.id)}">${esc(activity.title)}</h3>
      <div class="resource-box ${esc(activity.resourceClass)}">${esc(activity.resource)}</div>
      <p><strong>Como aplicar:</strong> ${esc(activity.method)}</p>
      <details class="activity-more">
        <summary>Ver adaptação e detalhes</summary>
        <p><strong>Adaptação:</strong> ${esc(activity.adaptation)}</p>
        <div class="meta-row">
          <span>${esc(activity.time)}</span>
          <span>${esc(activity.supportLevel)}</span>
        </div>
      </details>
      ${canSelect ? `<button class="primary-action full-action" type="button" data-select-activity="${esc(activity.id)}" aria-describedby="activity-title-${esc(activity.id)}">Escolher esta atividade</button>` : ""}
    </article>
  `
  );
  const button = activitiesGrid.lastElementChild.querySelector("[data-select-activity]");
  if (button) button.addEventListener("click", () => selectActivity(button.dataset.selectActivity));
}

async function selectActivity(activityId) {
  const activity = state.lastActivities.find((item) => item.id === activityId);
  if (!activity) return;
  try {
    const { assignment } = await api("POST", "/api/assignments", { studentId: studentSelect.value, activity });
    state.currentAssignment = assignment;
    renderAssignmentPanel();
    showToast("Atividade selecionada.");
    // O cartao clicado sumiu: o foco vai para o titulo da atividade escolhida
    el("assignmentTitle").focus();
  } catch (error) {
    showToast(error.message, true);
  }
}

function openObservation(studentId, currentValue) {
  state.observationStudentId = studentId;
  const student = state.studentsInClass?.find((s) => s.id === studentId);
  observationTitle.textContent = student ? `Observação sobre ${student.shortName}` : "Registrar observação";
  studentObservationInput.value = currentValue || "";
  FocusReturn.open(observationDialog);
}

// As funcoes save*() abaixo sao chamadas por DialogForms.bind(): se lancarem
// erro, a janela continua aberta e mostra a mensagem (nada do que foi
// digitado se perde).
async function saveObservation() {
  if (!state.observationStudentId) return;
  await api("POST", `/api/students/${state.observationStudentId}/observation`, {
    text: studentObservationInput.value.trim()
  });
  showToast("Observação salva.");
  await renderStudentSummary();
  await renderStudentsView();
}
