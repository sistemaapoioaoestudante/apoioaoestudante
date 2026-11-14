// Aquecimento da IA: deixa o modelo pronto antes da primeira professora.
//
// Medido no notebook da escola: a primeira consulta depois de o modelo ser
// carregado gasta ~80-90s so para carregar e LER as instrucoes, antes de
// escrever qualquer coisa. Nas consultas seguintes o Ollama reaproveita essa
// leitura (as instrucoes sao sempre as mesmas) e isso cai para menos de 1s.
//
// Por isso, ao iniciar o sistema (e ao salvar a configuracao da IA), fazemos
// uma consulta "de mentira" em segundo plano com as mesmas instrucoes das
// atividades, pedindo so 1 palavra de resposta. Ninguem espera por ela - o
// servidor ja atende normalmente enquanto o aquecimento acontece.
const { ACTIVITY_SYSTEM_PROMPT } = require("./prompts");
const { callOllama, isAiConfigured, getProviderLabel } = require("./ollamaClient");

const WARMUP_TIMEOUT_MS = 5 * 60 * 1000;

let running = false;

/** Dispara o aquecimento em segundo plano. Nunca lanca erro. */
function warmUpModel() {
  if (!isAiConfigured() || running) return;
  running = true;
  const startedAt = Date.now();
  console.log(`  Preparando a IA (${getProviderLabel()}) em segundo plano...`);

  callOllama({
    systemPrompt: ACTIVITY_SYSTEM_PROMPT,
    userPrompt: "Responda apenas: ok",
    format: null, // resposta livre - so queremos que o modelo leia as instrucoes
    extraOptions: { num_predict: 1 }, // 1 palavra basta (nao muda o modelo carregado)
    signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS)
  })
    .then(() => {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  IA pronta para uso (preparada em ${seconds}s).`);
    })
    .catch((error) => {
      console.log(`  Aviso: não foi possível preparar a IA agora (${error.message})`);
    })
    .finally(() => {
      running = false;
    });
}

/** O modelo esta sendo preparado agora? (a tela avisa a professora) */
function isWarmingUp() {
  return running;
}

module.exports = { warmUpModel, isWarmingUp };
