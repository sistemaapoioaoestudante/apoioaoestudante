// ---------------------------------------------------------------------------
// Funcoes comuns dos ensaios de desempenho (pasta bench/).
//
// Cada ensaio cria um banco FICTICIO numa pasta temporaria (variavel
// DATA_DIR) e sobe o servidor de verdade numa porta livre: o banco real da
// escola nunca e lido nem alterado.
// ---------------------------------------------------------------------------
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const net = require("node:net");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DEMO_PASSWORD = "123456";
const BENCH_PASSWORD = "SenhaDoEnsaio2026";

/** Porta livre no proprio computador. */
function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Pasta temporaria com o banco de demonstracao (cenario P). */
function createDemoData(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `apoio-bench-${prefix}-`));
  const result = spawnSync(process.execPath, ["server/seedData/seed.js"], { cwd: ROOT, env: { ...process.env, DATA_DIR: dir } });
  if (result.status !== 0) throw new Error(`seed falhou: ${result.stderr}`);
  return dir;
}

/** Sobe o servidor real e espera ele responder. */
async function startServer(dataDir, extraEnv = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), AI_PROVIDER: "", ...extraEnv },
    stdio: "ignore"
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + "/")).ok) return { base, child };
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  child.kill();
  throw new Error("o servidor nao respondeu");
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await exited;
}

/** Entra com uma conta de demonstracao e troca a senha provisoria. */
async function login(base, email) {
  const first = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: DEMO_PASSWORD })
  });
  const cookie = first.headers.get("set-cookie").split(";")[0];
  await fetch(`${base}/api/auth/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ newPassword: BENCH_PASSWORD })
  });
  return cookie;
}

/** Percentil (0-100) de uma lista de numeros. */
function percentile(values, p) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

/** Arredonda para exibir. */
function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

/** Dados do computador (vao junto com os resultados). */
function machineInfo() {
  const cpus = os.cpus();
  return {
    processador: cpus[0] ? cpus[0].model.trim() : "?",
    nucleosLogicos: cpus.length,
    memoriaGB: round(os.totalmem() / 1024 ** 3, 1),
    sistema: `${os.type()} ${os.release()}`,
    node: process.version
  };
}

module.exports = { ROOT, freePort, createDemoData, startServer, stopServer, login, percentile, round, removeDir, machineInfo };
