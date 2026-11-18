// Atualizacao do sistema (ver server/updates/updater.js).
//
// GET  /api/version          versao deste sistema (sem login: a tela usa para
//                            saber quando a atualizacao terminou)
// GET  /api/updates          ha versao nova? (so coordenacao)
// POST /api/updates/check    conferir agora (so coordenacao)
// POST /api/updates/install  baixar e instalar a versao nova (so coordenacao)
const { sendJson, HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAction } = require("../util/audit");
const updater = require("../updates/updater");

function register(router) {
  router.get("/api/version", (req, res) => {
    sendJson(res, 200, { version: updater.CURRENT });
  });

  router.get("/api/updates", requireAuth, requireRole("admin"), async (req, res) => {
    // Ainda nao conferiu desde que o sistema ligou: confere agora
    if (updater.ENABLED && !updater.info().checkedAt) await updater.check();
    sendJson(res, 200, updater.info());
  });

  router.post("/api/updates/check", requireAuth, requireRole("admin"), async (req, res) => {
    sendJson(res, 200, await updater.check());
  });

  router.post("/api/updates/install", requireAuth, requireRole("admin"), async (req, res) => {
    let result;
    try {
      result = await updater.install();
    } catch (error) {
      throw new HttpError(400, error.message);
    }
    logAction(req.user, "atualizar sistema", "sistema", null, `da versão ${result.current} para ${result.latest}`);
    sendJson(res, 200, result);
  });
}

module.exports = { register };
