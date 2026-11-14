// Fila e "trabalhos" de geracao de atividades.
//
// Por que existe: com professoras usando celular, a conexao cai a toda hora
// (tela apaga, troca de app, Wi-Fi oscila), e a geracao leva de 1 a 3
// minutos. Para a professora nao perder essa espera:
//
//   - cada pedido vira um TRABALHO que continua no computador da escola
//     mesmo sem ninguem conectado; ao reconectar (mesmo pedido), a tela
//     recebe tudo o que ja ficou pronto e acompanha o resto;
//   - os trabalhos entram numa FILA: o computador gera um de cada vez (dois
//     ao mesmo tempo deixariam os dois lentos e estourariam o tempo); quem
//     esta esperando ve "ha N pedidos na frente";
//   - cada pessoa tem no maximo UM trabalho: se ela pedir outra coisa (outro
//     aluno, outro tema), o anterior e cancelado - ela ja seguiu em frente;
//   - trabalho terminado fica guardado por 15 minutos (reconectar depois
//     ainda mostra o resultado) e depois e descartado.

const KEEP_DONE_MS = 15 * 60 * 1000;

const jobs = new Map(); // chave do pedido -> trabalho
const latestByUser = new Map(); // usuario -> chave do trabalho mais recente
let queueTail = Promise.resolve(); // fila: um trabalho por vez
let waiting = 0; // trabalhos esperando a vez (para mostrar a posicao)
let running = false; // ha um trabalho gerando agora?

/** Remove trabalhos terminados ha mais de 15 minutos. */
function prune(now = Date.now()) {
  for (const [key, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > KEEP_DONE_MS) jobs.delete(key);
  }
}

/** Entrega um evento a quem esta acompanhando e guarda para quem reconectar. */
function emit(job, event) {
  job.events.push(event);
  job.listeners.forEach((listener) => listener(event));
}

/**
 * Comeca um trabalho (ou devolve o que ja existe para o mesmo pedido).
 * @param {object} options
 * @param {string} options.userId - dono do trabalho
 * @param {string} options.key - identifica o pedido (aluno, objetivo, tema...)
 * @param {(job: object) => Promise<void>} options.run - faz a geracao,
 *   chamando job.emit(evento); deve respeitar job.signal (cancelamento)
 * @returns {object} o trabalho ({ events, listeners, signal, ... })
 */
function startOrJoin({ userId, key, run }) {
  prune();
  const fullKey = `${userId}|${key}`;
  const existing = jobs.get(fullKey);
  if (existing && !existing.cancelled) return existing;

  // Pessoa pediu outra coisa: cancela o trabalho anterior dela
  const previousKey = latestByUser.get(userId);
  const previous = previousKey && jobs.get(previousKey);
  if (previous && !previous.finishedAt) previous.cancel("Você pediu outra geração; a anterior foi cancelada.");
  latestByUser.set(userId, fullKey);

  const controller = new AbortController();
  const job = {
    key: fullKey,
    events: [],
    listeners: new Set(),
    signal: controller.signal,
    finishedAt: null,
    cancelled: false,
    emit: (event) => emit(job, event),
    cancel: (reason) => {
      job.cancelled = true;
      controller.abort(new Error(reason));
    }
  };
  jobs.set(fullKey, job);

  // Entra na fila: espera os trabalhos da frente terminarem
  // Na frente: quem ja esta esperando + o que esta gerando agora
  const ahead = waiting + (running ? 1 : 0);
  waiting += 1;
  if (ahead > 0) job.emit({ type: "queued", ahead });
  queueTail = queueTail
    .then(async () => {
      waiting -= 1;
      running = true;
      if (job.signal.aborted) {
        job.emit({ type: "error", count: 0, message: job.signal.reason?.message || "Geração cancelada." });
        return;
      }
      try {
        await run(job);
      } catch (error) {
        job.emit({ type: "error", count: 0, message: error.message });
      }
    })
    .finally(() => {
      running = false;
      job.finishedAt = Date.now();
      job.emit({ type: "end" }); // aviso interno: fecha as conexoes que acompanham
    });
  return job;
}

/**
 * Acompanha um trabalho: manda o que ja aconteceu e depois cada evento novo.
 * @returns {() => void} para parar de acompanhar (a geracao continua)
 */
function follow(job, onEvent) {
  job.events.forEach(onEvent);
  if (job.finishedAt) return () => {};
  job.listeners.add(onEvent);
  return () => job.listeners.delete(onEvent);
}

module.exports = { startOrJoin, follow };
