const http = require("http");
const https = require("https");
const fs = require("fs");
const config = require("./config");
const store = require("./store");
const { Router, HttpError, sendJson, readJsonBody, parseUrl } = require("./router");
const { parseCookies, getSession, SESSION_COOKIE } = require("./session");
const { serveStatic } = require("./staticServer");
const { withSecurityHeaders } = require("./util/securityHeaders");
const { isBlockedByPendingPasswordChange, PASSWORD_CHANGE_REQUIRED } = require("./middleware/passwordChange");
const { isCrossSiteWrite } = require("./middleware/originGuard");
const { startDailyBackup } = require("./backup/dailyBackup");
const { warmUpModel } = require("./ai/warmup");
const { httpsOptions, assertSafeNetworkConfig } = require("./security/network");

// Garante que o banco existe antes de subir o servidor (primeira execucao).
if (!fs.existsSync(config.DB_PATH)) {
  require("./seedData/seed").run({ force: false });
}

// Copia diaria do banco em data/backups/ (mantem os ultimos 30 dias).
startDailyBackup();

const router = new Router();
require("./routes/auth").register(router);
require("./routes/classes").register(router);
require("./routes/teachers").register(router);
require("./routes/students").register(router);
require("./routes/bncc").register(router);
require("./routes/needs").register(router);
require("./routes/activities").register(router);
require("./routes/assignments").register(router);
require("./routes/feedbacks").register(router);
require("./routes/tags").register(router);
require("./routes/audit").register(router);
require("./routes/ai").register(router);
require("./routes/schoolYears").register(router);
require("./routes/dashboard").register(router);
require("./routes/coordinators").register(router);
require("./routes/access").register(router);
require("./routes/backupExport").register(router);

// Acesso pela rede so com HTTPS (ver server/security/network.js). Se a
// configuracao for insegura, explica e nao abre.
let tls = null;
try {
  tls = httpsOptions();
  assertSafeNetworkConfig(Boolean(tls));
} catch (error) {
  console.error("");
  console.error(`  [ERRO] ${error.message}`);
  console.error("");
  process.exit(1);
}

async function handleRequest(req, res) {
  // TUDO fica dentro do try, inclusive ler a URL e os cookies: um cookie
  // malformado (ex: "%E0") nao pode derrubar o servidor.
  try {
    const { pathname, query } = parseUrl(req);
    req.query = query;
    req.cookies = parseCookies(req);

    // Resolve usuario autenticado (se houver) a partir do cookie de sessao.
    req.user = null;
    const session = getSession(req.cookies[SESSION_COOKIE]);
    if (session) {
      const user = store.getById("users", session.userId);
      if (user) req.user = user;
    }

    if (pathname.startsWith("/api/")) {
      // Bloqueia alteracoes de dados disparadas por outros sites (CSRF).
      if (isCrossSiteWrite(req)) {
        sendJson(res, 403, { error: "Requisição bloqueada: origem não permitida." });
        return;
      }
      // Senha provisoria: so libera as rotas de troca de senha/login/logout.
      if (isBlockedByPendingPasswordChange(req, pathname)) {
        sendJson(res, 403, {
          error: "Crie uma senha nova antes de continuar.",
          code: PASSWORD_CHANGE_REQUIRED
        });
        return;
      }
      if (["POST", "PUT", "DELETE"].includes(req.method)) {
        req.body = await readJsonBody(req);
      } else {
        req.body = {};
      }
      const handled = await router.handle(req, res, pathname);
      if (!handled) {
        sendJson(res, 404, { error: "Rota de API não encontrada." });
      }
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res, pathname);
      return;
    }

    res.writeHead(405, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Método não permitido.");
  } catch (error) {
    // Erros "esperados" (JSON invalido, corpo grande demais...) ja trazem o
    // codigo HTTP certo; o resto vira 500 sem expor detalhes internos.
    if (error instanceof HttpError) {
      sendJson(res, error.statusCode, { error: error.message });
      return;
    }
    console.error("Erro não tratado:", error);
    if (!res.writableEnded) {
      sendJson(res, 500, { error: "Erro interno no servidor." });
    }
  }
}

// HTTPS quando ha certificado (modo "rede da escola"); senao HTTP, que so
// atende este computador ou o Tailscale (ver server/security/network.js).
const server = tls ? https.createServer(tls, handleRequest) : http.createServer(handleRequest);

// Ultima rede de seguranca: uma promise com erro esquecida em algum lugar
// e registrada no console em vez de derrubar o sistema para todas.
process.on("unhandledRejection", (error) => console.error("Erro não tratado (promise):", error));

// Erro ao subir o servidor (ex: porta ja em uso porque o sistema ja esta
// aberto em outra janela) - explica e encerra, em vez de falhar calado.
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error("");
    console.error(`  [ERRO] A porta ${config.PORT} já está em uso.`);
    console.error("  O sistema provavelmente já está aberto em outra janela.");
    console.error("");
  } else {
    console.error("  [ERRO] Não foi possível iniciar o servidor:", error.message);
  }
  process.exit(1);
});

server.listen(config.PORT, config.HOST, () => {
  console.log("");
  const shownHost = config.HOST === "0.0.0.0" ? "<endereço deste computador na rede>" : config.HOST;
  console.log("  Apoio ao Estudante rodando");
  console.log(`  -> ${tls ? "https" : "http"}://${shownHost}:${config.PORT}`);
  if (config.TRUST_PROXY) console.log("  Acesso remoto pelo Tailscale ativado (TRUST_PROXY=1).");
  console.log("");
  // Senhas de acesso nunca são mostradas aqui: só o seed (server/seedData/
  // seed.js) mostra a senha provisória, uma única vez, ao criar o banco.
  console.log("  Pressione Ctrl+C para encerrar o servidor.");
  console.log("");
  // Deixa a IA pronta em segundo plano (ver server/ai/warmup.js).
  warmUpModel();
});
