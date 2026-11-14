// ---------------------------------------------------------------------------
// Base de deficiencias
//
// Lista de deficiencias/necessidades com barreiras, estrategias e recursos.
// Professora comenta; coordenacao cadastra, exclui e consulta a IA.
// ---------------------------------------------------------------------------

// Elementos da tela usados neste modulo
const needsGrid = el("needsGrid");
const needObservationDialog = el("needObservationDialog");
const needObservationTitle = el("needObservationTitle");
const needObservationText = el("needObservationText");

// ---- base de necessidades ---------------------------------------------------

async function renderNeedsView() {
  if (!needsGrid.children.length) showLoading(needsGrid, "Carregando a base...");
  const isAdmin = state.user && state.user.role === "admin";
  try {
    const [{ needs }, { students }] = await Promise.all([api("GET", "/api/needs"), api("GET", "/api/students")]);
    state.needs = needs;
    const active = students.filter((student) => (student.status || "ativo") === "ativo");
    const studentCount = (need) => active.filter((student) => student.needId === need.id).length;
    const filter = el("needsFilter").value;
    const shown = needs
      .filter((need) => ListTools.matches(need.name, el("needsSearch").value))
      .filter((need) => filter !== "withStudents" || studentCount(need) > 0)
      .filter((need) => filter !== "draft" || need.draft)
      .sort(ListTools.byName());
    ListTools.setCount(el("needsCount"), shown.length, "deficiência", "deficiências", "Nenhuma deficiência encontrada com esses filtros.");
    needsGrid.innerHTML = shown
      .map(
        (need) => `
      <article class="need-card">
        <div class="need-header">
          <span class="activity-type"><span aria-hidden="true">${esc(UiText.needSourceLabel(need.source).icon)}</span> ${esc(UiText.needSourceLabel(need.source).text)}</span>
          ${need.draft ? `<span class="draft-badge">Rascunho</span>` : ""}
          <div class="need-actions">
            ${isAdmin ? `<button class="secondary-action small-action" type="button" data-consult-need="${esc(need.id)}" aria-describedby="need-name-${esc(need.id)}"><span aria-hidden="true">✨</span> Completar com IA</button>` : ""}
            <button class="secondary-action small-action" type="button" data-observe-need="${esc(need.id)}" aria-describedby="need-name-${esc(need.id)}">Registrar percepção</button>
            ${
              need.custom && isAdmin
                ? `<button class="danger-outline small-action" type="button" data-delete-need="${esc(need.id)}" aria-describedby="need-name-${esc(need.id)}">Excluir</button>`
                : ""
            }
          </div>
        </div>
        <h2 class="title-sm" id="need-name-${esc(need.id)}">${esc(need.name)}</h2>
        <p class="entity-meta">${esc(countLabel(studentCount(need), isAdmin ? "aluno ativo" : "aluno seu", isAdmin ? "alunos ativos" : "alunos seus"))}</p>
        <p>${esc(need.summary)}</p>
        <div class="teacher-note">
          <strong>Percepção da equipe</strong>
          <p>${esc(need.observation || "Nenhuma observação registrada para esta deficiência.")}</p>
        </div>
        <div>
          <strong>Estratégias</strong>
          <p>${esc(need.strategies.join(", ") || "ainda não preenchido.")}</p>
        </div>
        <div>
          <strong>Cuidados</strong>
          <p>${esc(need.barriers.join(", ") || "ainda não preenchido.")}</p>
        </div>
        <div>
          <strong>Atividades favoráveis</strong>
          <p>${esc(need.activityMatches.join(", ") || "ainda não preenchido.")}</p>
        </div>
      </article>
    `
      )
      .join("");

    needsGrid.querySelectorAll("[data-consult-need]").forEach((button) => {
      button.addEventListener("click", () => consultAiForNeed(button.dataset.consultNeed));
    });
    needsGrid.querySelectorAll("[data-observe-need]").forEach((button) => {
      button.addEventListener("click", () => openNeedObservation(button.dataset.observeNeed));
    });
    needsGrid.querySelectorAll("[data-delete-need]").forEach((button) => {
      button.addEventListener("click", () => deleteNeed(button.dataset.deleteNeed));
    });
  } catch (error) {
    showToast(error.message, true);
  }
}

function openNeedObservation(needId) {
  const need = state.needs.find((item) => item.id === needId);
  state.observationNeedId = needId;
  needObservationTitle.textContent = need ? `Percepção sobre ${need.name}` : "Registrar percepção";
  needObservationText.value = (need && need.observation) || "";
  FocusReturn.open(needObservationDialog);
}

async function saveNeedObservation() {
  if (!state.observationNeedId) return;
  await api("PUT", `/api/needs/${state.observationNeedId}/observation`, { text: needObservationText.value.trim() });
  showToast("Percepção salva.");
  await renderNeedsView();
}

async function saveNewNeed() {
  const name = newNeedName.value.trim();
  if (!name) throw DialogForms.fieldError("Escreva o nome da deficiência ou necessidade.", "newNeedName");
  await api("POST", "/api/needs", { name, observation: newNeedObservation.value.trim() });
  showToast("Deficiência adicionada à base como rascunho.");
  await renderNeedsView();
}

async function deleteNeed(needId) {
  const confirmed = await confirmDialog({
    title: "Excluir da base?",
    message: `"${(state.needs.find((item) => item.id === needId) || {}).name || "Este registro"}" sai da base de deficiências. Alunos cadastrados com outra deficiência não são afetados. Isso não pode ser desfeito.`,
    confirmLabel: "Excluir da base"
  });
  if (!confirmed) return;
  try {
    await api("DELETE", `/api/needs/${needId}`);
    showToast("Deficiência excluída da base.");
    await renderNeedsView();
    FocusReturn.restore();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function consultAiForNeed(needId) {
  const need = state.needs.find((item) => item.id === needId);
  if (!need) return;

  if (!state.aiStatus || !state.aiStatus.configured) {
    showToast(
      "A IA está desligada. Ative o Ollama em IA, no menu (ele precisa estar aberto neste computador).",
      true
    );
    return;
  }

  FocusReturn.remember(); // o botao sera recriado quando a lista redesenhar
  const hasContent = need.barriers.length || need.strategies.length || need.resources.length;
  if (hasContent) {
    const confirmed = await confirmDialog({
      title: "Substituir conteúdo por sugestão da IA?",
      message: `"${need.name}" já tem barreiras, estratégias ou recursos preenchidos. Consultar a IA agora vai substituir esse conteúdo pela sugestão gerada. Continuar?`,
      confirmLabel: "Consultar e substituir",
      danger: true
    });
    if (!confirmed) return;
  }

  showToast(`Consultando ${state.aiStatus.label || "IA"}... isso pode levar alguns segundos.`);
  try {
    await api("POST", `/api/needs/${needId}/consult-ai`);
    showToast("Sugestão da IA aplicada.");
    await renderNeedsView();
    FocusReturn.restore();
  } catch (error) {
    showToast(error.message, true);
  }
}
