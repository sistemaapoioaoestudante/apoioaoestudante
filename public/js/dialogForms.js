// ---------------------------------------------------------------------------
// Formularios dentro de janelas (<dialog>): salvar, mostrar erro e fechar.
//
// A janela so fecha quando o salvamento da certo. Se der errado (campo
// faltando, e-mail repetido, servidor fora), a mensagem aparece DENTRO da
// janela (role="alert", lida pelo NVDA), o campo com problema fica marcado
// (aria-invalid) e recebe o foco - e o que a pessoa digitou nao se perde.
//
// Uso (nos modulos das telas):
//   DialogForms.bind(form, async () => { ... salvar ... });
//   dentro de save: throw DialogForms.fieldError("Mensagem", "idDoCampo");
// ---------------------------------------------------------------------------

const DialogForms = (() => {
  /**
   * Erro ligado a um campo do formulario.
   * @param {string} message - o que aconteceu e como resolver
   * @param {string} [fieldId] - id do campo com problema
   */
  function fieldError(message, fieldId) {
    const error = new Error(message);
    error.fieldId = fieldId || null;
    return error;
  }

  /**
   * Cria o paragrafo de erro (antes dos botoes) ja com o texto. Ele e
   * criado de novo a cada erro: um role="alert" que entra na pagina com
   * texto e anunciado pelo NVDA; um que estava vazio e escondido, nem sempre.
   */
  function errorLine(form, message) {
    const line = document.createElement("p");
    line.className = "form-error";
    line.id = `${form.id}-error`;
    line.setAttribute("role", "alert");
    line.dataset.formError = "";
    line.textContent = message;
    form.insertBefore(line, form.querySelector(".dialog-actions"));
    return line;
  }

  /** Remove a mensagem e as marcacoes de campo invalido. */
  function clear(form) {
    const line = form.querySelector("[data-form-error]");
    if (line) line.remove();
    form.querySelectorAll("[aria-invalid]").forEach((field) => {
      field.removeAttribute("aria-invalid");
      const ids = (field.getAttribute("aria-describedby") || "").split(" ").filter((id) => id && id !== `${form.id}-error`);
      if (ids.length) field.setAttribute("aria-describedby", ids.join(" "));
      else field.removeAttribute("aria-describedby");
    });
  }

  /** Mostra o erro na janela e leva o foco ao campo com problema. */
  function show(form, error) {
    const line = errorLine(form, error.message);
    const field = error.fieldId ? document.getElementById(error.fieldId) : null;
    if (field) {
      field.setAttribute("aria-invalid", "true");
      const ids = (field.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      if (!ids.includes(line.id)) field.setAttribute("aria-describedby", [...ids, line.id].join(" "));
      field.focus();
    }
  }

  /**
   * Liga o envio do formulario da janela a uma funcao de salvar.
   * Botoes com value="cancel" continuam fechando a janela sem salvar.
   * @param {HTMLFormElement} form
   * @param {() => Promise<void>} save - lanca erro se nao conseguir salvar
   * @param {{ afterClose?: () => void }} [options] - roda depois de fechar
   */
  function bind(form, save, { afterClose } = {}) {
    const dialog = form.closest("dialog");

    // Toda vez que a janela abre, comeca sem mensagem de erro antiga.
    new MutationObserver(() => {
      if (dialog.open) clear(form);
    }).observe(dialog, { attributes: true, attributeFilter: ["open"] });

    form.addEventListener("submit", async (event) => {
      const submitter = event.submitter;
      if (submitter && submitter.value === "cancel") return; // Fechar/Cancelar
      event.preventDefault(); // nao fecha ainda: so fecha se salvar
      clear(form);
      const original = submitter ? submitter.textContent : "";
      if (submitter) {
        submitter.disabled = true;
        submitter.textContent = "Salvando...";
      }
      try {
        await save();
        dialog.close("default");
        if (afterClose) afterClose();
      } catch (error) {
        show(form, error);
      } finally {
        if (submitter) {
          submitter.disabled = false;
          submitter.textContent = original;
        }
      }
    });
  }

  return { bind, fieldError };
})();
