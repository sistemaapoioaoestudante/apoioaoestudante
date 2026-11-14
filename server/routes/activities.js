// Geracao das atividades do Atendimento Rapido, pela IA local (Ollama).
//
// GET /api/activities?studentId=...&goalCode=...&theme=...
//     [&quantidade=1..3&evitar=titulo1|titulo2]  <- completar as que faltaram
//
// A resposta chega AOS POUCOS, uma linha JSON por evento (formato NDJSON),
// para a tela mostrar cada atividade assim que ela fica pronta:
//   {"type":"start","goal":{...},"total":3,"label":"...","warming":false}
//   {"type":"activity","index":0,"activity":{...}}     <- ate 3 vezes
//   {"type":"done","count":3}                          <- terminou bem
//   {"type":"error","message":"...","count":N}         <- parou antes (N ja entregues)
//
// So a PROFESSORA gera atividades (e quem aplica). A coordenacao acompanha
// pelo painel e pelos registros - gerar ocuparia o computador por minutos e
// atrasaria as professoras.
//
// Se a IA estiver desligada ou falhar, a professora recebe uma mensagem
// clara e pode completar so as que faltaram - nunca atividades de outra
// origem misturadas com as da IA.
const store = require("../store");
const { HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { assertCanAccessStudent } = require("../access/studentAccess");
const { getNeedForDisability } = require("../engine/needMatcher");
const { isAiConfigured, getProviderLabel, streamActivities } = require("../ai/aiService");
const { ACTIVITY_COUNT, normalizeActivity } = require("../ai/activityFormat");
const { isWarmingUp } = require("../ai/warmup");
const { startOrJoin, follow } = require("../ai/generationJobs");
const { withSecurityHeaders } = require("../util/securityHeaders");

// Limites de tempo. Medido num i5-8265U sem placa de video: 3 atividades em
// ~100s com o modelo pronto; trocar de modelo soma ~40s de carga e uma
// geracao pode esperar o "aquecimento" terminar.
//   - TOTAL: teto absoluto da geracao.
//   - FIRST_TEXT: ate a IA comecar a escrever (inclui carregar o modelo).
//   - IDLE: depois que comecou, quanto tempo sem escrever nada e considerado travado.
const TOTAL_TIMEOUT_MS = 5 * 60 * 1000;
const FIRST_TEXT_TIMEOUT_MS = 3 * 60 * 1000;
const IDLE_TIMEOUT_MS = 60 * 1000;

/** Junta tudo o que a IA precisa saber sobre o aluno (sem dados pessoais). */
function buildGenerationInput({ student, goal, classInfo, theme }) {
  const need = getNeedForDisability(student, store.getAll("needs"));
  const failedTitles = store
    .getAll("feedbacks")
    .filter((item) => item.studentId === student.id && item.result === "Não funcionou")
    .map((item) => item.activityTitle);
  return {
    needName: need.name,
    barriers: need.barriers,
    strategies: need.strategies,
    resources: need.resources,
    strengths: student.strengths,
    cautions: student.cautions,
    theme,
    bnccCode: goal.code,
    goalText: goal.text,
    classLevel: classInfo.level,
    failedTitles,
    studentObservation: store.getMap("studentObservations")[student.id] || "",
    needObservation: store.getMap("needObservations")[need.id] || ""
  };
}

/** Le "quantidade" e "evitar" (completar as atividades que faltaram). */
function partialRequest(query) {
  const requested = Number(query.quantidade || ACTIVITY_COUNT);
  const count = Number.isInteger(requested) && requested >= 1 && requested <= ACTIVITY_COUNT ? requested : ACTIVITY_COUNT;
  const avoidTitles = String(query.evitar || "")
    .split("|")
    .map((title) => title.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, ACTIVITY_COUNT);
  return { count, avoidTitles };
}

function register(router) {
  router.get("/api/activities", requireAuth, requireRole("teacher"), async (req, res) => {
    const { studentId, goalCode } = req.query;
    const theme = String(req.query.theme || "").trim().slice(0, 120);
    if (!studentId || !goalCode) throw new HttpError(400, "Informe studentId e goalCode.");
    const { count: wanted, avoidTitles } = partialRequest(req.query);

    const student = assertCanAccessStudent(req.user, studentId);
    const classInfo = store.getById("classes", student.classId);
    if (!classInfo) throw new HttpError(400, "Turma do aluno não encontrada.");
    const goal = store.getAll("bnccGoals").find((item) => item.code === goalCode);
    if (!goal) throw new HttpError(400, "Objetivo BNCC não encontrado.");

    if (!isAiConfigured()) {
      throw new HttpError(
        503,
        "A IA está desligada neste sistema. Peça à coordenação para ativá-la em IA (o Ollama precisa estar aberto neste computador)."
      );
    }

    // A partir daqui a resposta e enviada aos pedacos.
    res.writeHead(
      200,
      withSecurityHeaders({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" })
    );
    const send = (event) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(event)}
`);
    };

    // O pedido vira um "trabalho" (server/ai/generationJobs.js): continua no
    // computador da escola mesmo se a conexao cair (celular apagou a tela) e
    // entra na fila se outra professora estiver gerando. O mesmo pedido de
    // novo (reconectar) acompanha o trabalho que ja esta em andamento.
    const key = [student.id, goal.code, theme, wanted, avoidTitles.join("|")].join("#");
    const input = buildGenerationInput({ student, goal, classInfo, theme });
    const job = startOrJoin({
      userId: req.user.id,
      key,
      run: (job) => runGeneration(job, { input, student, goal, theme, wanted, avoidTitles })
    });

    const stopFollowing = follow(job, (event) => {
      if (event.type === "end") res.end();
      else send(event);
    });
    // Conexao caiu: so para de acompanhar - a geracao continua
    res.on("close", stopFollowing);
  });
}

/** Faz a geracao dentro do trabalho, com os limites de tempo. */
async function runGeneration(job, { input, student, goal, theme, wanted, avoidTitles }) {
  const controller = new AbortController();
  const stop = (message) => controller.abort(new Error(message));
  // Cancelamento do trabalho (a pessoa pediu outra coisa) tambem para a IA
  job.signal.addEventListener("abort", () => stop(job.signal.reason?.message || "Geração cancelada."), { once: true });
  const totalTimer = setTimeout(
    () => stop("A IA passou de 5 minutos sem terminar. O computador pode estar sobrecarregado — tente completar em instantes."),
    TOTAL_TIMEOUT_MS
  );
  let idleTimer = setTimeout(
    () => stop("A IA não começou a responder em 3 minutos. Confira se o Ollama está aberto e tente de novo."),
    FIRST_TEXT_TIMEOUT_MS
  );
  const onText = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => stop("A IA parou de responder por 1 minuto. Tente completar as atividades que faltaram."), IDLE_TIMEOUT_MS);
  };

  // warming = o modelo ainda esta sendo carregado (a tela avisa que demora mais)
  job.emit({ type: "start", goal, total: wanted, label: getProviderLabel(), warming: isWarmingUp() });
  let count = 0;
  try {
    count = await streamActivities(input, {
      signal: controller.signal,
      count: wanted,
      avoidTitles,
      onText,
      onActivity: (raw, index) => {
        count = index + 1;
        job.emit({ type: "activity", index, activity: normalizeActivity(raw, { student, goal, theme, index }) });
      }
    });
    if (count < wanted) {
      job.emit({ type: "error", count, message: `A IA terminou, mas só entregou ${count} de ${wanted} atividade(s) completa(s).` });
    } else {
      job.emit({ type: "done", count });
    }
  } catch (error) {
    console.error("Falha ao gerar atividades com a IA:", error.message);
    job.emit({ type: "error", count, message: error.message });
  } finally {
    clearTimeout(totalTimer);
    clearTimeout(idleTimer);
  }
}

module.exports = { register };
