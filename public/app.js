// ---------------------------------------------------------------------------
// Apoio ao Estudante - inicio e navegacao
//
// Login, carregamento inicial, menu por papel (professora x coordenacao) e
// troca de telas. Carregado POR ULTIMO no index.html: chama boot(), que
// liga os eventos de todos os modulos.
// ---------------------------------------------------------------------------

// Elementos da tela usados neste modulo
const loginScreen = el("loginScreen");
const appShell = el("appShell");
const loginForm = el("loginForm");
const loginEmail = el("loginEmail");
const loginPassword = el("loginPassword");
const loginError = el("loginError");
const loginSubmit = el("loginSubmit");
const logoutButton = el("logoutButton");
const currentUserRole = el("currentUserRole");
const currentUserName = el("currentUserName");
const mobileNavToggle = el("mobileNavToggle");
const sidebar = el("sidebar");
const classSelect = el("classSelect");
const studentSelect = el("studentSelect");
const bnccSelect = el("bnccSelect");
const generateActivitiesButton = el("generateActivitiesButton");
const assignmentPanel = el("assignmentPanel");
const observationForm = el("observationForm");
const addNeedButton = el("addNeedButton");
const aiStatusLine = el("aiStatusLine");
const needObservationForm = el("needObservationForm");
const newNeedDialog = el("newNeedDialog");
const newNeedForm = el("newNeedForm");
const newNeedName = el("newNeedName");
const newNeedObservation = el("newNeedObservation");

// ---- boot -------------------------------------------------------------------

async function boot() {
  bindStaticEvents();
  // Modulo de troca de senha (public/js/passwordChange.js).
  PasswordChange.init({ api, showToast, logout });
  try {
    const { user } = await api("GET", "/api/auth/me");
    await onLogin(user);
  } catch (error) {
    // ninguém logado ainda - fica na tela de login
  }
}

async function onLogin(user) {
  // Senha provisoria: nada do sistema abre ate a pessoa criar a propria senha.
  if (user.mustChangePassword) {
    user = await PasswordChange.requireChange();
  }
  state.user = user;
  state.sessionActive = true;
  document.body.classList.remove("login-mode");
  document.body.classList.add("app-mode");
  loginScreen.setAttribute("hidden", "");
  appShell.removeAttribute("hidden");

  const isAdmin = user.role === "admin";
  currentUserRole.textContent = isAdmin ? "Coordenação" : "Professora";
  currentUserName.textContent = user.name;
  Profile.applyUser(user); // foto ou iniciais no topo

  // Menu conforme o perfil (data-role no index.html). A coordenacao nao tem
  // "Atendimento rapido": quem gera e aplica atividades e a professora.
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.hidden = !item.dataset.role.split(" ").includes(user.role);
  });
  addNeedButton.hidden = !isAdmin;
  renderThemeChips();

  try {
    await loadReferenceData();
    if (isAdmin) {
      await loadAdminStudents();
    } else {
      populateClassSelect();
      await handleClassChange();
    }
    await loadAiStatus();
  } catch (error) {
    showToast(error.message, true);
  }
  // Tela inicial: painel (coordenacao) ou atendimento rapido (professora).
  // O foco vai para o titulo: a tela de login some e, sem isso, o foco caia
  // no <body> (o leitor de tela ficava sem saber onde estava).
  showView(isAdmin ? "dashboard" : "quick", { focusTitle: true });
}

async function loadReferenceData() {
  const [classesRes, teachersRes, goalsRes, needsRes, tagsRes] = await Promise.all([
    api("GET", "/api/classes"),
    api("GET", "/api/teachers"),
    api("GET", "/api/bncc-goals"),
    api("GET", "/api/needs"),
    api("GET", "/api/tags")
  ]);
  state.classes = classesRes.classes;
  state.activeYear = classesRes.activeYear; // ano letivo ativo (ex: 2026)
  state.teachers = teachersRes.teachers;
  state.bnccGoals = goalsRes.goals;
  state.needs = needsRes.needs;
  state.tags = tagsRes;
}

function logout() {
  api("POST", "/api/auth/logout").finally(() => {
    window.location.reload();
  });
}

// ---- navegação ----------------------------------------------------------

function bindStaticEvents() {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    try {
      await withButtonBusy(loginSubmit, "Entrando...", async () => {
        const { user } = await api("POST", "/api/auth/login", {
          email: loginEmail.value.trim(),
          password: loginPassword.value
        });
        await onLogin(user);
      });
    } catch (error) {
      loginError.textContent = error.message;
    }
  });

  logoutButton.addEventListener("click", logout);

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      showView(button.dataset.view, { focusTitle: true });
      setMobileNav(false);
    });
  });

  mobileNavToggle.addEventListener("click", () => {
    setMobileNav(!sidebar.classList.contains("open"));
    // Abriu: o foco vai para a pagina atual do menu (senao o Tab seguia
    // pelo conteudo escondido atras da gaveta)
    // (a gaveta aberta fica visivel na hora - ver .sidebar.open em layout.css)
    if (sidebar.classList.contains("open")) {
      (sidebar.querySelector('[aria-current="page"]') || sidebar.querySelector(".nav-item")).focus();
    }
  });

  // Esc fecha a gaveta do menu (celular) e devolve o foco ao botao "Menu"
  sidebar.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("open")) {
      setMobileNav(false);
      mobileNavToggle.focus();
    }
  });

  classSelect.addEventListener("change", () => handleClassChange());
  studentSelect.addEventListener("change", () => handleStudentChange());
  bnccSelect.addEventListener("change", () => updateBnccDescription());

  el("plannerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const originalLabel = generateActivitiesButton.textContent;
    generateActivitiesButton.disabled = true;
    generateActivitiesButton.textContent = "Gerando… (1 a 3 min)";
    try {
      await loadActivities();
    } finally {
      generateActivitiesButton.disabled = false;
      generateActivitiesButton.textContent = originalLabel;
    }
  });

  // Janelas: so fecham quando salvar der certo; o erro aparece dentro delas
  // e o foco volta ao botao que abriu a janela (js/dialogForms.js e
  // js/focusReturn.js).
  const restoreFocus = { afterClose: () => FocusReturn.restore() };
  DialogForms.bind(observationForm, saveObservation, restoreFocus);
  DialogForms.bind(needObservationForm, saveNeedObservation, restoreFocus);
  DialogForms.bind(newNeedForm, saveNewNeed, restoreFocus);

  addNeedButton.addEventListener("click", () => {
    newNeedName.value = "";
    newNeedObservation.value = "";
    FocusReturn.open(newNeedDialog);
  });

  el("cancelAssignment").addEventListener("click", () => cancelAssignment());
  assignmentPanel.querySelectorAll("[data-resolve]").forEach((button) => {
    button.addEventListener("click", () => resolveAssignment(button.dataset.resolve));
  });

  el("studentsSearch").addEventListener("input", () => renderStudentsView());
  el("studentsClassFilter").addEventListener("change", () => renderStudentsView());
  el("studentsNeedFilter").addEventListener("change", () => renderStudentsView());
  el("needsSearch").addEventListener("input", () => renderNeedsView());
  el("needsFilter").addEventListener("change", () => renderNeedsView());

  Profile.bind(); // js/profile.js
  AccessGuide.bind(); // js/accessGuide.js (acesso das professoras)
  StudentHistory.bind(); // js/studentHistory.js
  AuditHistory.bind(); // js/auditHistory.js
  bindAdminEvents(); // js/adminScreens.js
}

/** Abre ou fecha a gaveta do menu (so existe no celular/tablet). */
function setMobileNav(open) {
  sidebar.classList.toggle("open", open);
  mobileNavToggle.setAttribute("aria-expanded", String(open));
}

// Troca a página visível e atualiza o topo (ícone, título e subtítulo vêm de
// public/js/uiText.js), a página atual do menu e o título da aba do navegador.
// focusTitle: quando a troca veio do menu, o foco vai para o título da página
// nova - assim o leitor de tela anuncia onde a pessoa chegou.
function showView(viewId, { focusTitle = false } = {}) {
  const role = state.user ? state.user.role : "teacher";
  document.querySelectorAll(".nav-item").forEach((item) => {
    const isCurrent = item.dataset.view === viewId;
    item.classList.toggle("active", isCurrent);
    if (isCurrent) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  el("pageIcon").textContent = UiText.viewIcon(viewId);
  el("pageTitle").textContent = UiText.viewTitle(viewId);
  el("pageSubtitle").textContent = UiText.viewSubtitle(viewId, role);
  document.title = `${UiText.viewTitle(viewId)} · Apoio ao Estudante`;
  if (focusTitle) el("pageTitle").focus();
  loadView(viewId);
}

/** Carrega os dados da tela que acabou de abrir (sempre atualizados). */
function loadView(viewId) {
  const loaders = {
    dashboard: () => Dashboard.render(),
    students: () => renderStudentsView(),
    needs: () => renderNeedsView(),
    teacher: () => Profile.render(),
    classes: () => renderAdminClasses(),
    teachers: () => renderAdminTeachers(),
    studentsAdmin: () => renderAdminStudents(),
    history: () => AuditHistory.render(),
    ai: () => renderAiSettings()
  };
  if (loaders[viewId]) Promise.resolve(loaders[viewId]()).catch((error) => showToast(error.message, true));
}

async function loadAiStatus() {
  try {
    state.aiStatus = await api("GET", "/api/ai/status");
  } catch (error) {
    state.aiStatus = { configured: false, label: null };
  }
  if (aiStatusLine) {
    aiStatusLine.textContent = state.aiStatus.configured
      ? "IA ativa neste computador."
      : isAdminUser()
        ? "A IA está desligada. Ative em IA, no menu."
        : "A IA está desligada. Peça à coordenação para ativá-la.";
  }
}

boot();
