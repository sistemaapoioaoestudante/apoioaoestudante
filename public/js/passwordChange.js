// ---------------------------------------------------------------------------
// Troca de senha (tela + chamadas a API)
//
// Dois usos:
//   1) Obrigatorio: logo depois do login, se o servidor disser que a senha e
//      provisoria (user.mustChangePassword). A janela nao pode ser fechada -
//      as opcoes sao trocar a senha ou sair. O servidor tambem bloqueia o
//      resto da API ate a troca (server/middleware/passwordChange.js).
//   2) Voluntario: botao "Trocar senha" no topo da tela, a qualquer momento.
//
// Este arquivo nao depende de variaveis globais do nucleo (js/core.js): as funcoes que
// ele usa (api, showToast, logout) sao recebidas em PasswordChange.init().
// O HTML da janela fica em index.html (<dialog id="passwordChangeDialog">).
// ---------------------------------------------------------------------------

const PasswordChange = (() => {
  const MIN_LENGTH = 8; // mesmo valor de server/util/passwordPolicy.js

  let deps = null; // { api, showToast, logout }
  let mandatory = false;
  let resolvePending = null; // resolve da Promise de requireChange()

  const byId = (id) => document.getElementById(id);

  /**
   * Liga os eventos da janela. Chamar uma vez, no boot do app.
   * @param {{ api: Function, showToast: Function, logout: Function }} dependencies
   */
  function init(dependencies) {
    deps = dependencies;
    const dialog = byId("passwordChangeDialog");

    byId("passwordChangeForm").addEventListener("submit", onSubmit);
    byId("passwordChangeCancel").addEventListener("click", () => dialog.close());
    byId("passwordChangeLogout").addEventListener("click", () => deps.logout());

    // Tecla Esc fecharia a janela - no modo obrigatorio isso nao pode.
    dialog.addEventListener("cancel", (event) => {
      if (mandatory) event.preventDefault();
    });
  }

  /**
   * Modo obrigatorio. Resolve com o usuario atualizado depois da troca.
   * @returns {Promise<object>}
   */
  function requireChange() {
    open(true);
    return new Promise((resolve) => {
      resolvePending = resolve;
    });
  }

  /** Modo voluntario (botao "Trocar senha"). */
  function openVoluntary() {
    open(false);
  }

  function open(isMandatory) {
    mandatory = isMandatory;
    byId("passwordChangeForm").reset();
    byId("passwordChangeError").textContent = "";
    byId("passwordChangeIntro").textContent = isMandatory
      ? "Você está usando uma senha provisória. Para continuar, crie uma senha só sua."
      : "Escolha uma senha nova para a sua conta.";
    byId("passwordChangeCancel").hidden = isMandatory;
    byId("passwordChangeLogout").hidden = !isMandatory;
    // Troca obrigatoria (1o acesso): a pessoa acabou de digitar a senha
    // provisoria para entrar - nao pedimos de novo. Na troca voluntaria a
    // senha atual continua sendo pedida (protege sessao esquecida aberta).
    const current = byId("passwordChangeCurrent");
    current.closest("label").hidden = isMandatory;
    current.required = !isMandatory;
    byId("passwordChangeDialog").showModal();
    (isMandatory ? byId("passwordChangeNew") : current).focus();
  }

  // Validacao rapida no navegador so para dar resposta imediata - a regra
  // que vale de verdade e a do servidor.
  function validateLocally(current, next, confirmation) {
    if (!mandatory && !current) return "Preencha a senha atual.";
    if (!next) return "Preencha a senha nova.";
    if (next.length < MIN_LENGTH) return `A senha nova precisa ter pelo menos ${MIN_LENGTH} caracteres.`;
    if (next !== confirmation) return "A confirmação não é igual à senha nova.";
    if (!mandatory && next === current) return "A senha nova precisa ser diferente da atual.";
    return null;
  }

  async function onSubmit(event) {
    event.preventDefault();
    const errorLine = byId("passwordChangeError");
    const submitButton = byId("passwordChangeSubmit");
    const current = byId("passwordChangeCurrent").value;
    const next = byId("passwordChangeNew").value;
    const confirmation = byId("passwordChangeConfirm").value;

    const localError = validateLocally(current, next, confirmation);
    if (localError) {
      errorLine.textContent = localError;
      return;
    }

    errorLine.textContent = "";
    submitButton.disabled = true;
    try {
      const { user } = await deps.api("PUT", "/api/auth/password", {
        currentPassword: mandatory ? undefined : current,
        newPassword: next
      });
      byId("passwordChangeDialog").close();
      deps.showToast("Senha alterada com sucesso.");
      if (resolvePending) {
        resolvePending(user);
        resolvePending = null;
      }
    } catch (error) {
      errorLine.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  }

  return { init, requireChange, openVoluntary };
})();
