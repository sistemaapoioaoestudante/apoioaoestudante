// ---------------------------------------------------------------------------
// Historico de alteracoes (coordenacao): filtros por pessoa, acao, assunto,
// periodo e busca livre; registros agrupados por dia, 50 por pagina.
// Dados de GET /api/audit (server/routes/audit.js).
// ---------------------------------------------------------------------------

const AuditHistory = (() => {
  let page = 1;
  let debounce = null;

  const FILTER_IDS = ["historySearch", "historyPerson", "historyAction", "historyEntity", "historyFrom", "historyTo"];

  function bind() {
    FILTER_IDS.forEach((id) => {
      const field = el(id);
      field.addEventListener(id === "historySearch" ? "input" : "change", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          page = 1;
          render();
        }, 250);
      });
    });
    el("historyFilters").addEventListener("submit", (event) => event.preventDefault());
    el("historyClear").addEventListener("click", () => {
      FILTER_IDS.forEach((id) => {
        el(id).value = "";
      });
      page = 1;
      render();
    });
  }

  function query() {
    const params = new URLSearchParams({
      busca: el("historySearch").value.trim(),
      pessoa: el("historyPerson").value,
      acao: el("historyAction").value,
      assunto: el("historyEntity").value,
      de: el("historyFrom").value,
      ate: el("historyTo").value,
      pagina: String(page)
    });
    [...params.keys()].forEach((key) => {
      if (!params.get(key)) params.delete(key);
    });
    return params.toString();
  }

  /** "2026-11-14" -> "sexta-feira, 14 de novembro de 2026" */
  function dayLabel(isoDate) {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  async function render() {
    const table = el("historyTable");
    showLoading(table, "Carregando histórico...");
    try {
      const data = await api("GET", `/api/audit?${query()}`);
      const { options } = data;
      ListTools.fillSelect(el("historyPerson"), options.people.map((name) => ({ value: name, label: name })), "Todas as pessoas");
      ListTools.fillSelect(el("historyAction"), options.actions.map((name) => ({ value: name, label: name })), "Todas as ações");
      ListTools.fillSelect(el("historyEntity"), options.entities.map((name) => ({ value: name, label: name })), "Todos os assuntos");

      ListTools.setCount(el("historyCount"), data.total, "registro encontrado", "registros encontrados", "Nenhuma ação encontrada com esses filtros.");

      // Agrupa por dia (data local)
      const groups = new Map();
      data.entries.forEach((entry) => {
        const local = new Date(entry.at);
        const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
      });
      table.innerHTML = [...groups.entries()]
        .map(
          ([day, entries]) => `
        <section class="history-day">
          <h2 class="title-sm">${esc(dayLabel(day))}</h2>
          <ul class="history-entries">
            ${entries
              .map(
                (entry) => `
              <li>
                <time datetime="${esc(entry.at)}">${esc(new Date(entry.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}</time>
                <span class="history-action">${esc(entry.action)}</span>
                <span>${esc(UiText.describeAuditEntry(entry))}</span>
              </li>`
              )
              .join("")}
          </ul>
        </section>`
        )
        .join("");

      // Paginacao
      const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
      el("historyPager").innerHTML =
        pages > 1
          ? `<button type="button" class="secondary-action small-action" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Anteriores</button>
             <span>Página ${esc(page)} de ${esc(pages)}</span>
             <button type="button" class="secondary-action small-action" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Próximos</button>`
          : "";
      el("historyPager").querySelectorAll("[data-page]").forEach((button) => {
        button.addEventListener("click", () => {
          page = Number(button.dataset.page);
          render().then(() => el("historyCount").focus());
        });
      });
    } catch (error) {
      table.innerHTML = "";
      showToast(error.message, true);
    }
  }

  return { bind, render };
})();
