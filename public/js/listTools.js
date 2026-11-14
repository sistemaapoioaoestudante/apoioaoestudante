// ---------------------------------------------------------------------------
// Ferramentas comuns das listas com filtro (alunos, professoras, turmas,
// deficiencias, historico): preencher os <select> de filtro, comparar textos
// sem acento e escrever a contagem ("18 alunos").
// ---------------------------------------------------------------------------

const ListTools = (() => {
  /** Texto sem acento e em minusculas: "joao" encontra "João". */
  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  /** O texto contem a busca? (busca vazia = sempre sim) */
  function matches(text, query) {
    const search = normalize(query).trim();
    return !search || normalize(text).includes(search);
  }

  /**
   * Preenche um <select> de filtro mantendo a opcao escolhida, se ainda existir.
   * @param {HTMLSelectElement} select
   * @param {{ value: string, label: string }[]} options
   * @param {string|null} allLabel - primeira opcao ("Todas as turmas"); null = sem ela
   */
  function fillSelect(select, options, allLabel) {
    const current = select.value;
    const first = allLabel === null ? "" : `<option value="">${esc(allLabel)}</option>`;
    select.innerHTML = first + options.map((item) => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join("");
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  /** Ordena por nome em portugues (acentos no lugar certo). */
  function byName(field = "name") {
    return (a, b) => String(a[field] || "").localeCompare(String(b[field] || ""), "pt-BR");
  }

  /** Escreve "3 alunos" / "Nenhum aluno encontrado." numa linha de contagem. */
  function setCount(element, count, singular, plural, emptyText) {
    element.textContent = count ? countLabel(count, singular, plural) : emptyText;
  }

  return { normalize, matches, fillSelect, byName, setCount };
})();
