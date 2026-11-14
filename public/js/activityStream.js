// ---------------------------------------------------------------------------
// Recebe as atividades da IA em tempo real.
//
// O servidor (server/routes/activities.js) responde aos pedacos, uma linha
// JSON por evento: "start", "activity" (ate 3x), e por fim "done" ou
// "error". Este modulo le essas linhas conforme chegam e chama onEvent()
// para cada uma - e o atendimento rapido (js/quickService.js) quem decide como mostrar na tela.
//
// Se o servidor recusar logo de cara (ex: IA desligada, aluno de outra
// turma), a Promise e rejeitada com um Error que traz .status e .code.
// ---------------------------------------------------------------------------

const ActivityStream = (() => {
  /**
   * @param {string} url - ex: /api/activities?studentId=...&goalCode=...
   * @param {{ signal?: AbortSignal, onEvent: (event: object) => void }} options
   * @returns {Promise<void>} resolve quando o servidor encerra a resposta
   */
  async function open(url, { signal, onEvent }) {
    const response = await fetch(url, { credentials: "include", signal });

    if (!response.ok) {
      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        /* resposta sem JSON */
      }
      const failure = new Error((data && data.error) || `Erro inesperado (HTTP ${response.status}).`);
      failure.status = response.status;
      failure.code = data && data.code;
      throw failure;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line) onEvent(JSON.parse(line));
      }
    }
  }

  return { open };
})();
