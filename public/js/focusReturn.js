// ---------------------------------------------------------------------------
// Devolve o foco do teclado ao lugar certo depois de abrir uma janela.
//
// Problema que resolve: ao salvar ou excluir algo, a lista da tela e
// redesenhada (innerHTML) e o botao que abriu a janela deixa de existir. O
// foco caia no <body> e quem usa teclado ou leitor de tela (NVDA) perdia o
// lugar na pagina e tinha de recomecar do topo.
//
// Como funciona: antes de abrir a janela guardamos um "endereco" do botao
// (o id dele ou um atributo data-*, que sobrevive ao redesenho). Depois de
// redesenhar, restore() procura de novo o botao com esse endereco. Se ele
// nao existe mais (ex: o item foi excluido), o foco vai para o titulo da
// pagina.
// ---------------------------------------------------------------------------

const FocusReturn = (() => {
  let savedSelector = null;

  /** Monta um seletor que encontra o mesmo botao depois do redesenho. */
  function selectorFor(element) {
    if (!element || element === document.body) return null;
    if (element.id) return `#${CSS.escape(element.id)}`;
    const dataAttr = Array.from(element.attributes).find((attr) => attr.name.startsWith("data-"));
    if (dataAttr) return `[${dataAttr.name}="${CSS.escape(dataAttr.value)}"]`;
    return null;
  }

  /** Guarda o elemento que esta com o foco agora. */
  function remember() {
    savedSelector = selectorFor(document.activeElement);
  }

  /** Guarda o foco atual e abre a janela (substitui dialog.showModal()). */
  function open(dialog) {
    remember();
    dialog.showModal();
  }

  /**
   * Leva o foco de volta ao elemento guardado (ou ao titulo da pagina).
   * @param {HTMLElement} [fallback] - para onde ir se o elemento sumiu
   */
  function restore(fallback) {
    const target = savedSelector ? document.querySelector(savedSelector) : null;
    savedSelector = null;
    // offsetParent null = elemento escondido (nao pode receber o foco)
    if (target && target.offsetParent !== null && !target.disabled) {
      target.focus();
      return;
    }
    (fallback || document.getElementById("pageTitle")).focus();
  }

  return { remember, open, restore };
})();
