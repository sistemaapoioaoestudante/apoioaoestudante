// ---------------------------------------------------------------------------
// Painel da coordenacao: panorama do ano letivo ativo (numeros gerais,
// avisos que pedem acao, alunos por turma e ultimas atividades registradas).
// Dados de GET /api/dashboard (server/routes/dashboard.js).
// ---------------------------------------------------------------------------

const Dashboard = (() => {
  /** Lista de avisos: cada um so aparece se tiver algo para mostrar. */
  function alertsHtml(alerts) {
    const items = [
      [alerts.classesWithoutTeacher, "Turmas sem professora", "classes"],
      [alerts.teachersWithoutClass, "Professoras sem turma neste ano", "teachers"],
      [alerts.studentsWithoutNeed, "Alunos sem deficiência ligada à base", "studentsAdmin"],
      [alerts.draftNeeds, "Deficiências em rascunho (a completar)", "needs"]
    ].filter(([list]) => list.length);
    if (!items.length) return `<p class="ai-status-line is-ok">Tudo em ordem: nenhum cadastro pendente.</p>`;
    return `<ul class="dashboard-alerts">${items
      .map(
        ([list, label, view]) => `
      <li>
        <strong>${esc(label)} (${esc(list.length)}):</strong> ${esc(list.slice(0, 6).join(", "))}${list.length > 6 ? "…" : ""}
        <button type="button" class="text-action" data-go-view="${esc(view)}">Resolver</button>
      </li>`
      )
      .join("")}</ul>`;
  }

  async function render() {
    const container = el("dashboardContent");
    showLoading(container, "Carregando o painel...");
    try {
      const data = await api("GET", "/api/dashboard");
      const { totals, results } = data;
      const tiles = [
        [totals.students, "alunos ativos", "studentsAdmin"],
        [totals.teachers, "professoras", "teachers"],
        [totals.classes, `turmas em ${data.year}`, "classes"],
        [totals.needs, "deficiências na base", "needs"],
        [totals.activitiesLastWeek, "atividades registradas (7 dias)", null]
      ];
      container.innerHTML = `
        <div class="dashboard-tiles">
          ${tiles
            .map(
              ([value, label, view]) => `
            <${view ? `button type="button" data-go-view="${esc(view)}"` : "div"} class="stat-tile dashboard-tile">
              <strong>${esc(value)}</strong><span>${esc(label)}</span>
            </${view ? "button" : "div"}>`
            )
            .join("")}
        </div>

        <section class="panel dashboard-section">
          <h2 class="title-sm">Precisa de atenção</h2>
          ${alertsHtml(data.alerts)}
        </section>

        <div class="dashboard-columns">
          <section class="panel dashboard-section">
            <h2 class="title-sm">Alunos por turma</h2>
            ${
              data.byClass.length
                ? `<table class="data-table">
              <thead><tr><th scope="col">Turma</th><th scope="col">Alunos</th><th scope="col">Professoras</th></tr></thead>
              <tbody>${data.byClass
                .map(
                  (klass) => `<tr><th scope="row">${esc(klass.name)} <span class="muted">(${esc(klass.level)})</span></th><td>${esc(klass.students)}</td><td>${esc(klass.teachers.join(", ") || "—")}</td></tr>`
                )
                .join("")}</tbody>
            </table>`
                : `<p class="muted">Nenhuma turma cadastrada em ${esc(data.year)}.</p>`
            }
          </section>

          <section class="panel dashboard-section">
            <h2 class="title-sm">Alunos por deficiência</h2>
            ${
              data.studentsByNeed.length
                ? `<ul class="bar-list">${data.studentsByNeed
                    .map((item) => {
                      // barra proporcional a deficiencia mais frequente (a maior ocupa tudo)
                      const width = Math.round((item.count / Math.max(1, data.studentsByNeed[0].count)) * 100);
                      // largura aplicada depois via JS (a CSP bloqueia style="..." no HTML)
                      return `<li><span>${esc(item.name)}</span><span class="bar" aria-hidden="true"><span data-width="${width}"></span></span><strong>${esc(item.count)}</strong></li>`;
                    })
                    .join("")}</ul>`
                : `<p class="muted">Nenhum aluno ativo ainda.</p>`
            }
          </section>
        </div>

        <section class="panel dashboard-section">
          <h2 class="title-sm">Resultado das atividades (últimos 7 dias)</h2>
          <p class="dashboard-results">
            <span class="status-badge status-ativo">Funcionou bem: ${esc(results["Funcionou bem"] || 0)}</span>
            <span class="status-badge status-transferido">Parcialmente: ${esc(results["Funcionou parcialmente"] || 0)}</span>
            <span class="status-badge status-saiu">Não funcionou: ${esc(results["Não funcionou"] || 0)}</span>
          </p>
          <h3 class="title-sm">Últimas atividades registradas</h3>
          ${
            data.recentActivities.length
              ? `<ul class="recent-list">${data.recentActivities
                  .map((item) => `<li><strong>${esc(item.student)}</strong> · ${esc(item.title)} — ${esc(item.result)} <span class="muted">(${esc(item.teacher)}, ${esc(item.date)})</span></li>`)
                  .join("")}</ul>`
              : `<p class="muted">Nenhuma atividade registrada ainda.</p>`
          }
        </section>`;

      container.querySelectorAll("[data-width]").forEach((bar) => {
        bar.style.width = `${Number(bar.dataset.width) || 0}%`;
      });

      // Atalhos: clicar num numero ou em "Resolver" abre a tela certa
      container.querySelectorAll("[data-go-view]").forEach((button) => {
        button.addEventListener("click", () => showView(button.dataset.goView, { focusTitle: true }));
      });
    } catch (error) {
      container.innerHTML = `<p class="muted">Não foi possível carregar o painel.</p>`;
      showToast(error.message, true);
    }
  }

  return { render };
})();
