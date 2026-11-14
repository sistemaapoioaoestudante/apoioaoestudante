// Status e configuracao da IA local (Ollama - ver server/ai/ollamaClient.js).
//
// GET /api/ai/status          - qualquer usuario logado: a IA esta ativa?
//                               (a interface mostra um aviso quando nao esta)
// GET /api/ai/settings        - tela "menu IA da coordenacao" (so coordenacao)
// PUT /api/ai/settings        - salva provedor/endereco/modelo, sem precisar
//                               mexer no .env nem reiniciar o servidor. Fica
//                               no banco (tabela settings) e tem prioridade
//                               sobre o .env.
// GET /api/ai/ollama-models   - pergunta ao proprio Ollama quais modelos ja
//                               estao baixados nesta maquina (endpoint
//                               nativo "/api/tags" DELE - nao confundir com o
//                               "/api/tags" deste sistema). Se o Ollama
//                               estiver fechado, devolve lista vazia + aviso.
const store = require("../store");
const { sendJson, HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAction } = require("../util/audit");
const { isAiConfigured, getProviderLabel, getEffectiveSettings } = require("../ai/aiService");
const config = require("../config");
const { warmUpModel } = require("../ai/warmup");

// "" = IA desligada (ou usar o que estiver no .env); "ollama" = IA local.
const VALID_PROVIDERS = ["", "ollama"];

/**
 * Aceita so enderecos http(s) - evita que o campo seja usado para o
 * servidor acessar outros tipos de recurso (file:, etc.).
 * @returns {string} o endereco limpo (sem "/" no final)
 */
function normalizeBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(text);
  } catch (error) {
    throw new HttpError(400, "Endereço do Ollama inválido (ex: http://127.0.0.1:11434).");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(400, "O endereço do Ollama deve começar com http:// ou https://.");
  }
  return text;
}

function register(router) {
  router.get("/api/ai/status", requireAuth, (req, res) => {
    sendJson(res, 200, { configured: isAiConfigured(), label: getProviderLabel() });
  });

  router.get("/api/ai/settings", requireAuth, requireRole("admin"), (req, res) => {
    const stored = store.getMap("aiSettings") || {};
    const effective = getEffectiveSettings();
    sendJson(res, 200, {
      provider: stored.provider === "off" ? "" : stored.provider || "",
      ollamaBaseUrl: effective.ollamaBaseUrl,
      ollamaModel: effective.ollamaModel,
      // O que esta ativo de fato (considerando o .env como reserva), para a
      // tela mostrar "usando Ollama via .env" quando nada foi salvo ainda.
      effectiveLabel: getProviderLabel(),
      configured: isAiConfigured()
    });
  });

  router.get("/api/ai/ollama-models", requireAuth, requireRole("admin"), async (req, res) => {
    let baseUrl;
    try {
      baseUrl = normalizeBaseUrl(req.query.baseUrl || getEffectiveSettings().ollamaBaseUrl);
    } catch (error) {
      sendJson(res, 200, { models: [], error: error.message });
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const models = Array.isArray(data.models)
        ? data.models.map((item) => item && item.name).filter(Boolean)
        : [];
      sendJson(res, 200, { models });
    } catch (error) {
      sendJson(res, 200, {
        models: [],
        error: `Não foi possível consultar os modelos em ${baseUrl}. Verifique se o Ollama está aberto nesta máquina. Detalhe: ${error.message}`
      });
    }
  });

  router.put("/api/ai/settings", requireAuth, requireRole("admin"), (req, res) => {
    const body = req.body || {};
    const provider = String(body.provider || "").trim().toLowerCase();
    if (!VALID_PROVIDERS.includes(provider)) {
      throw new HttpError(400, 'Provedor inválido. Use "ollama" ou deixe em branco para desativar.');
    }

    // As tres configuracoes sao gravadas juntas (tudo ou nada)
    const ollamaBaseUrl = provider === "ollama" ? normalizeBaseUrl(body.ollamaBaseUrl || config.OLLAMA_BASE_URL) : null;
    const ollamaModel = provider === "ollama" ? String(body.ollamaModel || "").trim() || config.OLLAMA_MODEL : null;
    store.transaction(() => {
      if (provider === "ollama") {
        store.setMapValue("aiSettings", "ollamaBaseUrl", ollamaBaseUrl);
        store.setMapValue("aiSettings", "ollamaModel", ollamaModel);
      }
      // "Nenhum" grava "off" (e nao vazio): assim a escolha da tela vale
      // mesmo com AI_PROVIDER=ollama no .env
      store.setMapValue("aiSettings", "provider", provider || "off");
    });

    logAction(req.user, "editar", "configuracao-ia", "aiSettings", `Provedor definido para: ${provider || "nenhum (IA desligada)"}`);
    // Modelo novo (ou recem-ativado): ja deixa pronto em segundo plano.
    warmUpModel();
    sendJson(res, 200, { ok: true, configured: isAiConfigured(), effectiveLabel: getProviderLabel() });
  });
}

module.exports = { register };
