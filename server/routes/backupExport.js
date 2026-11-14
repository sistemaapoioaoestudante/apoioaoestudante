// Exporta o banco inteiro - usado SO para migrar o sistema para outro
// computador (server/tools/migrar.js, no computador novo).
//
// GET /api/backup/export  (so coordenacao)
//
// Seguranca:
//   - exige login da coordenacao (professora recebe 403);
//   - so por conexao protegida: HTTPS (Tailscale ou certificado) ou pelo
//     proprio computador; nunca por http aberto na rede;
//   - registra no historico quem pediu e quando;
//   - a copia e feita com o sistema rodando, sem risco de sair pela metade
//     (store.backupTo usa o "VACUUM INTO" do SQLite) e o arquivo temporario
//     e apagado assim que termina de ser enviado.
// O arquivo leva tudo (inclusive os hashes das senhas, para as contas
// continuarem funcionando no computador novo) - por isso so a coordenacao.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const store = require("../store");
const { HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAction } = require("../util/audit");
const { isHttps } = require("../security/network");
const { withSecurityHeaders } = require("../util/securityHeaders");
const { SCHEMA_VERSION } = require("../db/schema");

function register(router) {
  router.get("/api/backup/export", requireAuth, requireRole("admin"), (req, res) => {
    const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket && req.socket.remoteAddress);
    if (!isHttps(req) && !local) {
      throw new HttpError(403, "A cópia do banco só pode ser feita por conexão protegida (HTTPS).");
    }

    const tmp = path.join(os.tmpdir(), `apoio-export-${crypto.randomBytes(8).toString("hex")}.sqlite`);
    store.backupTo(tmp);
    const size = fs.statSync(tmp).size;
    logAction(req.user, "exportar banco", "migração", null, "cópia completa para outro computador");

    res.writeHead(
      200,
      withSecurityHeaders({
        "Content-Type": "application/vnd.sqlite3",
        "Content-Length": String(size),
        "Content-Disposition": 'attachment; filename="apoio-migracao.sqlite"',
        "Cache-Control": "no-store",
        // versao da estrutura do banco: o computador novo confere se e compativel
        "X-Schema-Version": String(SCHEMA_VERSION)
      })
    );
    const stream = fs.createReadStream(tmp);
    const cleanup = () => fs.rm(tmp, { force: true }, () => {});
    stream.on("close", cleanup);
    stream.on("error", cleanup);
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  });
}

module.exports = { register };
