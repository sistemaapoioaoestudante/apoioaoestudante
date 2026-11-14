// Conversa com o Ollama (a IA que roda localmente nesta maquina).
//
// O Ollama e um programa gratuito que roda modelos de IA abertos (ex:
// qwen2.5) sem internet e sem enviar nenhum dado para fora da escola - por
// isso e a unica IA suportada pelo sistema (dados de criancas sao dados
// sensiveis pela LGPD).
//
// Configuracao, nesta ordem de prioridade:
//  1) Tela "menu IA da coordenacao" (salva no banco, tabela settings) -
//     da para trocar endereco/modelo sem mexer em arquivo nem reiniciar.
//  2) Arquivo .env (AI_PROVIDER=ollama, OLLAMA_BASE_URL, OLLAMA_MODEL).
// Sem nenhum dos dois, a IA fica desligada e a tela avisa a professora.
//
// Duas formas de chamar:
//  - callOllama():   espera a resposta inteira (usado no "Consultar IA").
//  - streamOllama(): recebe a resposta aos pedacos, enquanto a IA escreve
//                    (usado nas atividades, para mostrar uma de cada vez).
//
// Sem dependencias externas: usa o "fetch" que ja vem com o Node (>=18).
const config = require("../config");
const store = require("../store");

// Quanto tempo o Ollama mantem o modelo carregado na memoria depois do
// ultimo uso. Recarregar do disco + reler as instrucoes custa ~80-90s num
// computador sem placa de video (medido no notebook da escola), entao vale
// manter carregado durante todo o turno. Ocupa ~5 GB de RAM enquanto isso.
const OLLAMA_KEEP_ALIVE = "4h";

// IMPORTANTE: nao passar opcoes como num_ctx / num_thread aqui. Medido: mudar
// essas opcoes entre uma chamada e outra obriga o Ollama a recarregar o
// modelo e reler tudo do zero (217-231s em vez de ~141s). Os valores padrao
// do Ollama foram os mais rapidos.

/** Configuracao valida agora (tela tem prioridade sobre o .env). */
function getEffectiveSettings() {
  const stored = store.getMap("aiSettings") || {};
  return {
    // "off" = desligada pela tela (tem prioridade sobre o AI_PROVIDER do .env)
    provider: stored.provider === "off" ? "" : stored.provider || config.AI_PROVIDER || "",
    ollamaBaseUrl: stored.ollamaBaseUrl || config.OLLAMA_BASE_URL,
    ollamaModel: stored.ollamaModel || config.OLLAMA_MODEL
  };
}

/** A IA so esta ativa quando o provedor configurado e "ollama". */
function isAiConfigured() {
  return getEffectiveSettings().provider === "ollama";
}

/** Texto curto para mostrar na tela, ex: "Ollama local (qwen2.5:7b)". */
function getProviderLabel() {
  if (!isAiConfigured()) return null;
  return `Ollama local (${getEffectiveSettings().ollamaModel})`;
}

/** Monta o corpo do pedido - igual para as duas formas de chamada. */
function buildRequest({ systemPrompt, userPrompt, format, stream, extraOptions }) {
  const settings = getEffectiveSettings();
  return {
    url: `${settings.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`,
    model: settings.ollamaModel,
    body: JSON.stringify({
      model: settings.ollamaModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      stream,
      format,
      keep_alive: OLLAMA_KEEP_ALIVE,
      ...(extraOptions ? { options: extraOptions } : {})
    })
  };
}

/** Traduz falhas de rede em mensagens que fazem sentido para a escola. */
function explainFetchError(error, signal, model) {
  if (signal && signal.aborted) {
    // Quem cancelou explica o motivo (tempo limite ou professora saiu da tela).
    return signal.reason instanceof Error ? signal.reason : new Error("A geração foi cancelada.");
  }
  const settings = getEffectiveSettings();
  return new Error(
    `Não foi possível conectar ao Ollama em ${settings.ollamaBaseUrl}. Verifique se o Ollama está aberto neste computador e se o modelo "${model}" foi baixado (comando "ollama pull ${model}"). Detalhe técnico: ${error.message}`
  );
}

/**
 * Pede e espera a resposta inteira, ja convertida de JSON.
 * @param {object} params
 * @param {string} params.systemPrompt - instrucoes (ver server/ai/prompts.js)
 * @param {string} params.userPrompt - o pedido em si
 * @param {string|object} [params.format="json"] - "json" ou um esquema JSON
 * @param {AbortSignal} [params.signal] - para cancelar (ex: tempo limite)
 * @param {object} [params.extraOptions] - opcoes de geracao (ex: num_predict)
 * @returns {Promise<any>}
 */
async function callOllama({ systemPrompt, userPrompt, format = "json", signal, extraOptions }) {
  const request = buildRequest({ systemPrompt, userPrompt, format, stream: false, extraOptions });
  let response;
  try {
    response = await fetch(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: request.body, signal });
  } catch (error) {
    throw explainFetchError(error, signal, request.model);
  }
  if (!response.ok) {
    throw new Error(`O Ollama respondeu com erro (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  const content = (data.message && data.message.content) || "";
  if (format === null) return content;
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error("O Ollama respondeu, mas o conteúdo não é um JSON válido. Tente de novo.");
  }
}

/**
 * Pede e recebe a resposta aos pedacos, conforme a IA escreve.
 * @param {object} params - mesmos de callOllama, mais:
 * @param {(text: string) => void} params.onText - chamado a cada pedaco de texto
 * @returns {Promise<string>} o texto completo, quando a IA terminar
 */
async function streamOllama({ systemPrompt, userPrompt, format, signal, onText }) {
  const request = buildRequest({ systemPrompt, userPrompt, format, stream: true });
  let response;
  try {
    response = await fetch(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: request.body, signal });
  } catch (error) {
    throw explainFetchError(error, signal, request.model);
  }
  if (!response.ok) {
    throw new Error(`O Ollama respondeu com erro (${response.status}): ${await response.text()}`);
  }

  // O Ollama manda uma linha JSON por pedaco: {"message":{"content":"..."},"done":false}
  const decoder = new TextDecoder();
  let pending = "";
  let fullText = "";
  try {
    for await (const chunk of response.body) {
      pending += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (!line) continue;
        const piece = JSON.parse(line);
        if (piece.error) throw new Error(`O Ollama respondeu com erro: ${piece.error}`);
        const text = (piece.message && piece.message.content) || "";
        if (text) {
          fullText += text;
          onText(text);
        }
      }
    }
  } catch (error) {
    if (signal && signal.aborted) throw explainFetchError(error, signal, request.model);
    throw error;
  }
  return fullText;
}

module.exports = { getEffectiveSettings, isAiConfigured, getProviderLabel, callOllama, streamOllama };
