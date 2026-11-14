// ---------------------------------------------------------------------------
// Apoio ao Estudante - nucleo do front-end
//
// Estado compartilhado e ferramentas usadas por todas as telas: escape de
// HTML, chamadas a API, avisos (toast), botao ocupado e janela de
// confirmacao. Nenhum dado sensivel de aluno mora no front-end: tudo vem
// do servidor, que ja aplica o controle de acesso por papel.
//
// Carregado PRIMEIRO no index.html (os outros modulos usam estas funcoes).
// ---------------------------------------------------------------------------

const state = {
  user: null,
  classes: [],
  teachers: [],
  bnccGoals: [],
  needs: [],
  tags: { strengthTags: [], cautionTags: [] },
  lastActivities: [],
  activityAbort: null, // AbortController da geração de atividades em andamento
  generationLabel: null,
  currentAssignment: null,
  observationStudentId: null,
  observationNeedId: null,
  editingClassId: null,
  editingTeacherId: null,
  editingStudentId: null,
  passwordTeacherId: null,
  sessionActive: false,
  aiStatus: null
};

// ---- seguranca: escape de HTML ---------------------------------------------
// Todo texto vindo do servidor (nomes, observacoes, respostas da IA etc.) e
// inserido nas telas via innerHTML. Sem escapar, um texto como
// "<img src=x onerror=...>" digitado numa observacao viraria codigo rodando
// no navegador de quem abrisse a tela (inclusive a coordenacao). Toda
// interpolacao dentro de um template HTML deve passar por esc().
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/** Mostra "Carregando..." numa área enquanto os dados chegam do servidor. */
function showLoading(container, message = "Carregando...") {
  container.innerHTML = `<p class="loading" role="status">${esc(message)}</p>`;
}

// ---- helpers de API --------------------------------------------------------

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (response.status === 401 && state.sessionActive) {
    // A sessao caiu no meio do uso (servidor reiniciou, expirou etc.):
    // avisa o motivo antes de voltar para a tela de login.
    state.sessionActive = false;
    showToast("Sua sessão expirou. Faça login novamente.", true);
    setTimeout(() => window.location.reload(), 1600);
    throw new Error("Sessão expirada.");
  }

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json() : null;
  if (response.status === 403 && data && data.code === "PASSWORD_CHANGE_REQUIRED") {
    // A conta exige troca de senha (ex: a coordenacao redefiniu) -
    // recarregar faz o boot() abrir a tela de troca obrigatoria.
    window.location.reload();
    throw new Error(data.error);
  }
  if (!response.ok) {
    throw new Error((data && data.error) || `Algo deu errado no servidor (código ${response.status}). Tente de novo; se continuar, avise a coordenação.`);
  }
  return data;
}

// Busca por nome ignora acentuacao (ex: "joao" encontra "João") - sem isso a
// busca falhava silenciosamente para qualquer nome acentuado.
function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Aviso flutuante. Sucesso vai para a regiao "status" (o leitor de tela le
// quando terminar o que esta falando); erro vai para a regiao "alert" (le na
// hora). As duas regioes ficam sempre na pagina - ver index.html.
// O tempo na tela cresce com o tamanho do texto (da para ler os avisos
// longos) e erros ficam mais tempo.
function showToast(message, isError = false) {
  const status = el("toast");
  const alertRegion = el("toastAlert");
  status.replaceChildren();
  alertRegion.replaceChildren();
  const bubble = document.createElement("p");
  bubble.className = isError ? "toast toast-error" : "toast";
  bubble.textContent = message;
  (isError ? alertRegion : status).append(bubble);
  clearTimeout(showToast._timer);
  const duration = Math.max(isError ? 8000 : 5000, String(message).length * 70);
  showToast._timer = setTimeout(() => bubble.remove(), duration);
}

async function withButtonBusy(button, label, fn) {
  const original = button.textContent;
  button.disabled = true;
  if (label) button.textContent = label;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

// Substitui o confirm() nativo do navegador (que destoava do visual do
// sistema) por um dialogo com a mesma identidade do resto do app.
// O botao de desistir tambem pode ter nome proprio (ex: "Manter atividade")
// quando "Cancelar" ficaria ambiguo com a propria acao.
//
// askPassword: true mostra um campo "Sua senha" (exclusoes sem volta). Nesse
// caso a promessa devolve a senha digitada (ou null se a pessoa desistiu).
function confirmDialog({ title = "Tem certeza?", message = "", confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger = true, askPassword = false } = {}) {
  const dialog = el("confirmDialog");
  el("confirmTitle").textContent = title;
  // Enter no campo de senha confirma. Sem isso, o navegador usaria o
  // primeiro botao do formulario ("Cancelar") e a exclusao seria cancelada.
  el("confirmPassword").onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      el("confirmSubmit").click();
    }
  };
  el("confirmMessage").textContent = message;
  const passwordField = el("confirmPasswordField");
  const passwordInput = el("confirmPassword");
  passwordField.hidden = !askPassword;
  passwordInput.required = askPassword;
  passwordInput.value = "";
  el("confirmCancel").textContent = cancelLabel;
  const submit = el("confirmSubmit");
  submit.textContent = confirmLabel;
  submit.classList.toggle("danger-action", danger);
  FocusReturn.open(dialog);
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => {
        const confirmed = dialog.returnValue === "default";
        const password = passwordInput.value;
        passwordInput.value = ""; // a senha nao fica guardada na tela
        if (!askPassword) resolve(confirmed);
        else resolve(confirmed ? password : null);
      },
      { once: true }
    );
  });
}

// ---- elementos e utilitarios -----------------------------------------------

const el = (id) => document.getElementById(id);

function isAdminUser() {
  return Boolean(state.user && state.user.role === "admin");
}

/** Corta um texto longo no limite de caracteres, terminando em "...". */
function shortText(text, max) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/** "1 atividade registrada" / "3 atividades registradas" (plural certo). */
function countLabel(count, singular, plural) {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? singular : plural}`;
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .replace(".", "");
}
