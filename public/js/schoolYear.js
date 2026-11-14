// ---------------------------------------------------------------------------
// Virada do ano letivo (coordenacao): para cada turma do ano que termina, a
// coordenacao escolhe se os alunos passam para uma turma nova (nome e nivel)
// ou se concluem. Tudo e confirmado de uma vez (POST /api/school-years/rollover).
// ---------------------------------------------------------------------------

const SchoolYear = (() => {
  /** Sugestao de destino: Jardim -> Pre I (mesma letra); Pre I -> conclui. */
  function suggestion(klass) {
    if (klass.level === "Jardim") {
      return { action: "move", toName: klass.name.replace(/Jardim/i, "Pré I"), toLevel: "Pré I" };
    }
    return { action: "conclude", toName: "", toLevel: "Pré I" };
  }

  function bind() {
    el("rolloverButton").addEventListener("click", open);
    DialogForms.bind(el("rolloverForm"), submit, { afterClose: () => FocusReturn.restore() });
  }

  function open() {
    const year = state.activeYear;
    const classes = activeClasses();
    el("rolloverTitle").textContent = `Virar o ano letivo: ${year} → ${year + 1}`;
    el("rolloverIntro").textContent = classes.length
      ? `Escolha o destino dos alunos ativos de cada turma de ${year}.`
      : `Não há turmas em ${year}. A virada só abre o ano de ${year + 1}.`;
    el("rolloverConfirm").checked = false;
    el("rolloverPlan").innerHTML = classes
      .map((klass) => {
        const plan = suggestion(klass);
        const count = (state.adminStudents || []).filter((student) => student.classId === klass.id && student.status === "ativo").length;
        return `
        <fieldset class="rollover-row" data-class-id="${esc(klass.id)}">
          <legend>${esc(klass.name)} (${esc(klass.level)}) · ${esc(countLabel(count, "aluno ativo", "alunos ativos"))}</legend>
          <label class="inline-field">Destino
            <select data-field="action">
              <option value="move" ${plan.action === "move" ? "selected" : ""}>Passam para a turma</option>
              <option value="conclude" ${plan.action === "conclude" ? "selected" : ""}>Concluem (saem da educação infantil)</option>
            </select>
          </label>
          <label class="inline-field" data-move>Nome da turma em ${esc(year + 1)}
            <input type="text" data-field="toName" value="${esc(plan.toName)}" maxlength="60" />
          </label>
          <label class="inline-field" data-move>Nível
            <select data-field="toLevel">
              <option value="Pré I" ${plan.toLevel === "Pré I" ? "selected" : ""}>Pré I</option>
              <option value="Jardim" ${plan.toLevel === "Jardim" ? "selected" : ""}>Jardim</option>
            </select>
          </label>
        </fieldset>`;
      })
      .join("");
    // Esconde nome/nivel quando a turma "conclui"
    el("rolloverPlan").querySelectorAll(".rollover-row").forEach((row) => {
      const sync = () => {
        const moving = row.querySelector('[data-field="action"]').value === "move";
        row.querySelectorAll("[data-move]").forEach((item) => {
          item.hidden = !moving;
        });
      };
      row.querySelector('[data-field="action"]').addEventListener("change", sync);
      sync();
    });
    FocusReturn.open(el("rolloverDialog"));
  }

  async function submit() {
    const plan = [...el("rolloverPlan").querySelectorAll(".rollover-row")].map((row) => ({
      classId: row.dataset.classId,
      action: row.querySelector('[data-field="action"]').value,
      toName: row.querySelector('[data-field="toName"]').value.trim(),
      toLevel: row.querySelector('[data-field="toLevel"]').value
    }));
    const missingName = plan.findIndex((step) => step.action === "move" && !step.toName);
    if (missingName >= 0) {
      const input = el("rolloverPlan").querySelectorAll('[data-field="toName"]')[missingName];
      input.id = input.id || "rolloverMissingName";
      throw DialogForms.fieldError("Escreva o nome da turma nova.", input.id);
    }
    if (!el("rolloverConfirm").checked) throw DialogForms.fieldError("Marque a confirmação para virar o ano.", "rolloverConfirm");
    const result = await api("POST", "/api/school-years/rollover", { toYear: state.activeYear + 1, plan });
    showToast(
      `Ano letivo ${result.toYear} aberto: ${countLabel(result.moved, "aluno passou", "alunos passaram")} de turma e ${countLabel(result.concluded, "concluiu", "concluíram")}. Agora vincule as professoras às turmas novas.`
    );
    await refreshAdminData();
  }

  return { bind, open };
})();
