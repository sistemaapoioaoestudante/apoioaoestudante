// Acesso das professoras por outros aparelhos (so coordenacao).
//
// Guarda o ENDERECO do sistema que as professoras usam (ex:
// https://apoio-escola.<rede>.ts.net). Ele fica no banco e nao no codigo
// porque muda de escola para escola: cada escola tem a propria rede
// Tailscale. A tela "Meu perfil" da coordenacao usa isso para montar a
// mensagem pronta para enviar as professoras (public/js/accessGuide.js).
//
// GET /api/access-info  - endereco salvo (ou vazio)
// PUT /api/access-info  - salva o endereco (so https://)
const store = require("../store");
const { sendJson, HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAction } = require("../util/audit");

/** Aceita so um endereco https:// sem caminho extra; devolve "https://host". */
function normalizeAccessUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  let parsed;
  try {
    parsed = new URL(text);
  } catch (error) {
    throw new HttpError(400, "Endereço inválido. Exemplo: https://apoio-escola.nome-da-rede.ts.net");
  }
  if (parsed.protocol !== "https:") {
    throw new HttpError(400, "O endereço precisa começar com https:// (conexão protegida).");
  }
  return `https://${parsed.host}`;
}

function register(router) {
  router.get("/api/access-info", requireAuth, requireRole("admin"), (req, res) => {
    sendJson(res, 200, { accessUrl: store.getMap("schoolSettings").accessUrl || "" });
  });

  router.put("/api/access-info", requireAuth, requireRole("admin"), (req, res) => {
    const accessUrl = normalizeAccessUrl((req.body || {}).accessUrl);
    store.setMapValue("schoolSettings", "accessUrl", accessUrl);
    logAction(req.user, "editar", "acesso remoto", "accessUrl", accessUrl || "(removido)");
    sendJson(res, 200, { accessUrl });
  });
}

module.exports = { register };
