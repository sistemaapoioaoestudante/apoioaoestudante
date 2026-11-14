// Testes do acesso de outros aparelhos (server/security/network.js):
//   - abrir para a rede SEM HTTPS e recusado;
//   - com certificado (HTTPS_PFX), o cookie de login sai com "Secure";
//   - pelo Tailscale (TRUST_PROXY=1), o sistema reconhece HTTPS e o IP real.
// O certificado de teste e criado numa pasta temporaria com o openssl (vem
// com o Git para Windows); sem openssl, o teste de HTTPS e pulado.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const https = require("node:https");

const ROOT = path.join(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "apoio-rede-"));
const children = [];

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Sobe o sistema com o .env indicado; devolve { port, exitCode? }. */
async function startServer(extraEnv, name) {
  const dataDir = path.join(TMP, name);
  fs.mkdirSync(dataDir, { recursive: true });
  const env = { ...process.env, DATA_DIR: dataDir, AI_PROVIDER: "", ...extraEnv };
  spawnSync(process.execPath, ["server/seedData/seed.js"], { cwd: ROOT, env });
  const port = await freePort();
  const child = spawn(process.execPath, ["server/index.js"], { cwd: ROOT, env: { ...env, PORT: String(port) }, stdio: ["ignore", "ignore", "pipe"] });
  children.push(child);
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const exited = new Promise((resolve) => child.once("exit", resolve));
  return { child, port, exited, stderr: () => stderr };
}

after(async () => {
  for (const child of children) {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
    }
  }
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("abrir para a rede sem HTTPS e recusado", async () => {
  const { exited, stderr } = await startServer({ HOST: "0.0.0.0" }, "inseguro");
  const code = await exited;
  assert.equal(code, 1);
  assert.match(stderr(), /SEM HTTPS/);
});

test("Tailscale (TRUST_PROXY): reconhece HTTPS e marca o cookie como Secure", async () => {
  const { port } = await startServer({ TRUST_PROXY: "1" }, "tailscale");
  let response;
  for (let i = 0; i < 100; i++) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", "X-Forwarded-For": "100.64.0.7" },
        body: JSON.stringify({ email: "coordenacao@escola.com", password: "123456" })
      });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /; Secure/);
});

const hasOpenssl = spawnSync("openssl", ["version"]).status === 0;

test("rede da escola com certificado: atende em HTTPS com cookie Secure", { skip: !hasOpenssl && "openssl indisponível" }, async () => {
  const key = path.join(TMP, "chave.pem");
  const cert = path.join(TMP, "cert.pem");
  const pfx = path.join(TMP, "escola.pfx");
  assert.equal(spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=escola-teste"]).status, 0);
  assert.equal(spawnSync("openssl", ["pkcs12", "-export", "-out", pfx, "-inkey", key, "-in", cert, "-passout", "pass:teste123"]).status, 0);

  const { port } = await startServer({ HOST: "127.0.0.1", HTTPS_PFX: pfx, HTTPS_PFX_PASSWORD: "teste123" }, "https");
  const result = await new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = https.request(
        { host: "127.0.0.1", port, path: "/api/auth/login", method: "POST", rejectUnauthorized: false, headers: { "Content-Type": "application/json" } },
        (res) => {
          res.resume();
          resolve({ status: res.statusCode, cookie: String(res.headers["set-cookie"]) });
        }
      );
      req.on("error", (error) => (left > 0 ? setTimeout(() => tryOnce(left - 1), 200) : reject(error)));
      req.end(JSON.stringify({ email: "coordenacao@escola.com", password: "123456" }));
    };
    tryOnce(100);
  });
  assert.equal(result.status, 200);
  assert.match(result.cookie, /; Secure/);
});
