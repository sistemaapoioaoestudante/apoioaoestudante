// Formato das atividades geradas pela IA: o "molde" exigido do Ollama, a
// conferencia de cada atividade recebida e a padronizacao para a tela.
//
// Por que um esquema fixo: com ele, o Ollama e OBRIGADO a montar exatamente
// { "atividades": [N itens] } com todos os campos. Um pedido generico de
// "JSON" deixa o modelo escrever uma atividade so e parar.

const TONES = ["green", "violet", "rose", "teal", "gold"];
const RESOURCE_CLASSES = ["manipulative", "story", "movement", "sequence", "digital", "visual"];
const SUPPORT_LEVELS = ["Apoio próximo", "Apoio moderado"];
const ACTIVITY_COUNT = 3;

const TEXT_FIELDS = ["type", "title", "resource", "method", "adaptation", "time"];

const ACTIVITY_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string" },
    tone: { type: "string", enum: TONES },
    resourceClass: { type: "string", enum: RESOURCE_CLASSES },
    title: { type: "string" },
    resource: { type: "string" },
    method: { type: "string" },
    adaptation: { type: "string" },
    time: { type: "string" },
    supportLevel: { type: "string", enum: SUPPORT_LEVELS }
  },
  // A ordem importa: "supportLevel" e o ultimo campo de cada atividade.
  required: ["type", "tone", "resourceClass", "title", "resource", "method", "adaptation", "time", "supportLevel"]
};

/** Esquema enviado ao Ollama no campo "format". */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    atividades: { type: "array", minItems: ACTIVITY_COUNT, maxItems: ACTIVITY_COUNT, items: ACTIVITY_SCHEMA }
  },
  required: ["atividades"]
};

/**
 * Esquema para gerar so `count` atividades (usado para completar as que
 * faltaram quando a geracao anterior foi interrompida).
 * @param {number} count - 1 a 3
 */
function responseSchemaFor(count) {
  if (count === ACTIVITY_COUNT) return RESPONSE_SCHEMA;
  return {
    type: "object",
    properties: { atividades: { type: "array", minItems: count, maxItems: count, items: ACTIVITY_SCHEMA } },
    required: ["atividades"]
  };
}

/**
 * A atividade veio completa? (todos os textos preenchidos)
 * So atividades completas aparecem para a professora.
 * @param {object} item
 * @returns {boolean}
 */
function isCompleteActivity(item) {
  return Boolean(item) && TEXT_FIELDS.every((field) => typeof item[field] === "string" && item[field].trim());
}

/**
 * Padroniza uma atividade da IA no formato que a tela usa, ligando-a ao
 * aluno e ao objetivo BNCC. Campos que viram classe CSS (tone,
 * resourceClass) sao conferidos de novo por seguranca.
 * @param {object} item - atividade crua da IA
 * @param {{ student: object, goal: object, theme: string, index: number }} context
 */
function normalizeActivity(item, { student, goal, theme, index }) {
  const safeTheme = (theme || "").trim() || "Tema livre";
  const text = (value) => String(value || "").trim();
  return {
    id: `${student.id}-ia-${Date.now()}-${index}`,
    type: text(item.type),
    tone: TONES.includes(item.tone) ? item.tone : TONES[index % TONES.length],
    resourceClass: RESOURCE_CLASSES.includes(item.resourceClass) ? item.resourceClass : "manipulative",
    title: text(item.title),
    resource: text(item.resource),
    method: text(item.method),
    adaptation: text(item.adaptation),
    time: text(item.time),
    supportLevel: SUPPORT_LEVELS.includes(item.supportLevel) ? item.supportLevel : "Apoio moderado",
    theme: safeTheme,
    studentId: student.id,
    goalCode: goal.code,
    objective: `${goal.code} - ${goal.text}`,
    generatedBy: "ia"
  };
}

module.exports = { ACTIVITY_COUNT, RESPONSE_SCHEMA, responseSchemaFor, isCompleteActivity, normalizeActivity };
