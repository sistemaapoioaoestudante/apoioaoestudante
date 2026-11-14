// ---------------------------------------------------------------------------
// menu IA da coordenacao: liga/desliga a IA local (Ollama) e escolhe o modelo.
// Usa as funcoes gerais do nucleo, js/core.js (api, el, esc, showToast).
// ---------------------------------------------------------------------------

// Elementos da tela usados neste modulo
const aiSettingsForm = el("aiSettingsForm");
const aiSettingsStatusLine = el("aiSettingsStatusLine");
const aiProviderInput = el("aiProviderInput");
const aiOllamaFields = el("aiOllamaFields");
const aiOllamaBaseUrlInput = el("aiOllamaBaseUrlInput");
const aiOllamaModelInput = el("aiOllamaModelInput");
const aiOllamaModelList = el("aiOllamaModelList");
const aiRefreshModelsButton = el("aiRefreshModelsButton");
const aiModelListStatus = el("aiModelListStatus");
const aiModelChoices = el("aiModelChoices");

/** Liga os eventos da tela de IA (chamado uma vez, no boot). */
function bindAiSettingsEvents() {
  aiProviderInput.addEventListener("change", () => {
    updateAiProviderFieldsVisibility();
    if (aiProviderInput.value === "ollama") loadOllamaModelOptions();
  });
  aiRefreshModelsButton.addEventListener("click", () => loadOllamaModelOptions());
  aiModelChoices.addEventListener("click", (event) => {
    const button = event.target.closest("[data-model]");
    if (!button) return;
    aiOllamaModelInput.value = button.dataset.model;
    aiOllamaModelInput.focus(); // o leitor de tela le o campo ja preenchido
  });
  aiSettingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAiSettings();
  });
}

function updateAiProviderFieldsVisibility() {
  const provider = aiProviderInput.value;
  aiOllamaFields.hidden = provider !== "ollama";
}

// Consulta o proprio Ollama (via o backend, que repassa a chamada) para
// descobrir quais modelos ja estao baixados nesta maquina, e mostra eles
// como botoes clicaveis (clicar preenche o campo Modelo na hora). Tambem
// preenche a <datalist> do campo como reforco, mas os botoes sao o jeito
// principal de escolher - o autocompletar nativo do navegador so sugere
// opcoes que comecem com o texto ja digitado no campo, entao se o campo
// ja tiver algo escrito (ex: "llama3.2", valor padrao antes de trocar) os
// outros modelos ficam escondidos da sugestao nativa, o que confundia.
async function loadOllamaModelOptions() {
  const baseUrl = aiOllamaBaseUrlInput.value.trim();
  aiModelListStatus.textContent = "Consultando modelos instalados...";
  aiModelChoices.hidden = true;
  aiModelChoices.innerHTML = "";
  aiRefreshModelsButton.disabled = true;
  try {
    const query = baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : "";
    const result = await api("GET", `/api/ai/ollama-models${query}`);
    const models = result.models || [];
    aiOllamaModelList.innerHTML = models.map((name) => `<option value="${esc(name)}"></option>`).join("");
    if (result.error) {
      aiModelListStatus.textContent = result.error;
    } else if (models.length) {
      aiModelListStatus.textContent = `${countLabel(models.length, "modelo encontrado", "modelos encontrados")} neste computador. Clique em um para usar:`;
      aiModelChoices.innerHTML = models
        .map((name) => `<button type="button" class="model-chip" data-model="${esc(name)}">${esc(name)}</button>`)
        .join("");
      aiModelChoices.hidden = false;
    } else {
      aiModelListStatus.textContent = "Nenhum modelo baixado ainda nesta máquina (use \"ollama pull qwen2.5:7b\" em um terminal).";
    }
  } catch (error) {
    aiModelListStatus.textContent = error.message;
  } finally {
    aiRefreshModelsButton.disabled = false;
  }
}

async function renderAiSettings() {
  try {
    const settings = await api("GET", "/api/ai/settings");
    aiProviderInput.value = settings.provider || "";
    aiOllamaBaseUrlInput.value = settings.ollamaBaseUrl || "";
    aiOllamaModelInput.value = settings.ollamaModel || "";
    updateAiProviderFieldsVisibility();
    aiSettingsStatusLine.textContent = settings.configured
      ? `IA ativa agora: ${settings.effectiveLabel}.`
      : "Nenhuma IA ativa no momento — a geração de atividades fica indisponível até ativar o Ollama.";
    aiModelListStatus.textContent = "";
    aiOllamaModelList.innerHTML = "";
    aiModelChoices.hidden = true;
    aiModelChoices.innerHTML = "";
    if (aiProviderInput.value === "ollama") loadOllamaModelOptions();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveAiSettings() {
  const provider = aiProviderInput.value;
  const payload = { provider };
  if (provider === "ollama") {
    payload.ollamaBaseUrl = aiOllamaBaseUrlInput.value.trim();
    payload.ollamaModel = aiOllamaModelInput.value.trim();
  }
  const submitButton = el("aiSettingsSubmit");
  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";
  try {
    await api("PUT", "/api/ai/settings", payload);
    showToast("Configuração de IA salva.");
    await renderAiSettings();
    await loadAiStatus();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
}
