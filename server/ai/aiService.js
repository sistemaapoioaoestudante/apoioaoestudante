// Ponto unico de uso da IA pelo resto do sistema. Dois usos:
//  1) streamActivities - gera as 3 atividades do Atendimento Rapido a partir
//     do perfil do aluno, tema e objetivo BNCC, entregando cada atividade
//     assim que fica pronta (server/routes/activities.js).
//  2) generateNeedInsightsWithAI - botao "Consultar IA" da Base de
//     deficiencias: sugere barreiras/estrategias/recursos a partir do nome.
//
// As outras pecas ficam nesta mesma pasta (server/ai/):
//   prompts.js              - os textos de instrucao enviados a IA
//   ollamaClient.js         - configuracao e chamada ao Ollama (IA local)
//   activityFormat.js       - esquema fixo, conferencia e padronizacao das atividades
//   activityStreamParser.js - separa cada atividade enquanto a IA escreve
//   warmup.js               - deixa o modelo pronto ao iniciar o sistema
const { ACTIVITY_SYSTEM_PROMPT, NEED_SYSTEM_PROMPT } = require("./prompts");
const { callOllama, streamOllama, isAiConfigured, getProviderLabel, getEffectiveSettings } = require("./ollamaClient");
const { responseSchemaFor, ACTIVITY_COUNT, isCompleteActivity } = require("./activityFormat");
const { createActivityStreamParser } = require("./activityStreamParser");

/**
 * Monta o pedido com o perfil do aluno. Nenhum dado pessoal (nome completo,
 * data de nascimento, responsavel, telefone, documentos) entra aqui - so o
 * perfil pedagogico, o tema e o objetivo BNCC.
 * @param {object} input
 * @param {string} input.needName
 * @param {string[]} input.barriers
 * @param {string[]} input.strategies
 * @param {string[]} input.resources
 * @param {string[]} input.strengths
 * @param {string[]} input.cautions
 * @param {string} input.theme
 * @param {string} input.bnccCode
 * @param {string} input.goalText
 * @param {string} input.classLevel
 * @param {string[]} [input.failedTitles] - atividades ja marcadas "Nao funcionou" para este aluno
 * @param {string} [input.studentObservation]
 * @param {string} [input.needObservation]
 * @returns {string}
 */
function buildActivityUserPrompt(input) {
  return [
    `Necessidade educacional: ${input.needName}.`,
    input.barriers?.length ? `Barreiras típicas: ${input.barriers.join(", ")}.` : "",
    input.strategies?.length ? `Estratégias recomendadas para essa necessidade: ${input.strategies.join(", ")}.` : "",
    input.resources?.length ? `Recursos recomendados: ${input.resources.join(", ")}.` : "",
    input.strengths?.length ? `Pontos fortes deste aluno: ${input.strengths.join(", ")}.` : "",
    input.cautions?.length ? `Cuidados a evitar com este aluno: ${input.cautions.join(", ")}.` : "",
    input.needObservation ? `Percepção da equipe sobre esta necessidade: ${input.needObservation}.` : "",
    input.studentObservation ? `Observação pedagógica sobre este aluno: ${input.studentObservation}.` : "",
    `Turma/faixa: ${input.classLevel}.`,
    `Tema do dia: ${input.theme || "Tema livre"}.`,
    `Objetivo BNCC (${input.bnccCode}): ${input.goalText}.`,
    input.failedTitles?.length
      ? `Atividades já tentadas sem sucesso com este aluno (não repita nem gere parecido): ${input.failedTitles.join(", ")}.`
      : ""
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Gera as 3 atividades numa UNICA chamada ao Ollama, com o esquema fixo, e
 * entrega cada uma assim que fica completa. Atividades incompletas nunca
 * sao entregues.
 * Com `count` menor que 3, gera so as que faltaram de uma tentativa
 * anterior, sem repetir as que ja apareceram (`avoidTitles`).
 * @param {object} input - ver buildActivityUserPrompt
 * @param {object} handlers
 * @param {AbortSignal} [handlers.signal]
 * @param {(activity: object, index: number) => void} handlers.onActivity
 * @param {() => void} [handlers.onText] - a IA escreveu algo (sinal de que esta viva)
 * @param {number} [handlers.count=3]
 * @param {string[]} [handlers.avoidTitles]
 * @returns {Promise<number>} quantas atividades completas foram entregues
 */
async function streamActivities(input, { signal, onActivity, onText, count = ACTIVITY_COUNT, avoidTitles = [] }) {
  let delivered = 0;
  const parser = createActivityStreamParser((activity) => {
    if (delivered >= count || !isCompleteActivity(activity)) return;
    onActivity(activity, delivered);
    delivered += 1;
  });

  // As instrucoes fixas (ACTIVITY_SYSTEM_PROMPT) nunca mudam - o Ollama
  // reaproveita a leitura delas. O pedido de "so N" vai no texto do pedido.
  const partial = count < ACTIVITY_COUNT
    ? `\nIMPORTANTE: nesta resposta gere APENAS ${count} atividade(s), de tipo diferente destas já criadas (não repita nem faça parecido): ${avoidTitles.join("; ")}.`
    : "";

  await streamOllama({
    systemPrompt: ACTIVITY_SYSTEM_PROMPT,
    userPrompt: buildActivityUserPrompt(input) + partial,
    format: responseSchemaFor(count),
    signal,
    onText: (text) => {
      if (onText) onText();
      parser.push(text);
    }
  });
  return delivered;
}

/**
 * Botao "Consultar IA" da base de deficiencias.
 * @param {object} input
 * @param {string} input.needName - nome da deficiencia/necessidade (ex: "Baixa visao")
 * @param {string} [input.observation] - observacao de uma professora, se houver
 * @returns {Promise<object>} objeto no formato descrito em NEED_SYSTEM_PROMPT
 */
async function generateNeedInsightsWithAI({ needName, observation }) {
  const userPrompt = observation
    ? `Deficiência/necessidade: "${needName}". Observação registrada por uma professora sobre uma criança com esse perfil: "${observation}".`
    : `Deficiência/necessidade: "${needName}". Nenhuma observação adicional registrada ainda.`;
  return callOllama({ systemPrompt: NEED_SYSTEM_PROMPT, userPrompt });
}

module.exports = {
  isAiConfigured,
  getProviderLabel,
  getEffectiveSettings,
  streamActivities,
  generateNeedInsightsWithAI
};
