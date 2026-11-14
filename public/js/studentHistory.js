// ---------------------------------------------------------------------------
// "Ver histórico completo" de um aluno: todas as atividades registradas,
// com filtro por resultado. O resumo do Atendimento rapido mostra so as 3
// mais recentes; aqui aparecem todas (GET /api/feedbacks?studentId=...).
// ---------------------------------------------------------------------------

const StudentHistory = (() => {
  let items = [];

  function bind() {
    el("studentHistoryResult").addEventListener("change", draw);
  }

  function draw() {
    const filter = el("studentHistoryResult").value;
    const shown = items.filter((item) => !filter || item.result === filter);
    ListTools.setCount(el("studentHistoryCount"), shown.length, "registro", "registros", "Nenhum registro com esse resultado.");
    el("studentHistoryList").innerHTML = shown
      .map(
        (item) => `
      <article class="history-item">
        <strong>${esc(item.result)}</strong>
        ${esc(item.date)} · ${esc(item.theme)} · ${esc(item.activityTitle)}
        <br><span class="muted">${esc(item.teacherName || "")}</span>
        ${item.notes ? `<p>${esc(item.notes)}</p>` : ""}
      </article>`
      )
      .join("");
  }

  /**
   * @param {string} studentId
   * @param {string} name - nome curto do aluno (titulo da janela)
   */
  async function open(studentId, name) {
    try {
      const { feedbacks } = await api("GET", `/api/feedbacks?studentId=${encodeURIComponent(studentId)}`);
      items = feedbacks.slice().reverse(); // mais recente primeiro
      el("studentHistoryTitle").textContent = `Atividades registradas: ${name || "aluno"}`;
      el("studentHistoryResult").value = "";
      draw();
      FocusReturn.open(el("studentHistoryDialog"));
    } catch (error) {
      showToast(error.message, true);
    }
  }

  return { bind, open };
})();
