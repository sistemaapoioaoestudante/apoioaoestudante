// Teste da migracao entre computadores (server/tools/migrar.js):
// um sistema "antigo" rodando e um "novo" (pastas temporarias diferentes).
// Confere: so a coordenacao exporta; senha errada nao muda nada; a migracao
// traz os dados, guarda o banco que existia no novo e registra no historico.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.join(__dirname, "..");
const OLD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "apoio-antigo-"));
const NEW_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "apoio-novo-"));
const PASSWORD = "SenhaDeTeste2026";
let server;
let base;
let newPort;

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function api(method, url, { cookie = "", body } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json().catch(() => null), headers: response.headers };
}

async function loginChanging(email) {
  const first = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "123456" }) });
  const cookie = first.headers.get("set-cookie").split(";")[0];
  await api("PUT", "/api/auth/password", { cookie, body: { currentPassword: "123456", newPassword: PASSWORD } });
  return cookie;
}

/** Roda a ferramenta de migracao "no computador novo", com respostas pela entrada. */
function migrate(email, answers) {
  return spawnSync(process.execPath, ["server/tools/migrar.js", base, "--email", email], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: NEW_DIR, PORT: String(newPort) },
    input: answers.join("\n") + "\n",
    encoding: "utf8"
  });
}

function count(dir, sql) {
  const db = new DatabaseSync(path.join(dir, "apoio.sqlite"), { readOnly: true });
  try {
    return db.prepare(sql).get().n;
  } finally {
    db.close();
  }
}

before(async () => {
  for (const dir of [OLD_DIR, NEW_DIR]) {
    assert.equal(spawnSync(process.execPath, ["server/seedData/seed.js"], { cwd: ROOT, env: { ...process.env, DATA_DIR: dir } }).status, 0);
  }
  const port = await freePort();
  newPort = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["server/index.js"], { cwd: ROOT, env: { ...process.env, DATA_DIR: OLD_DIR, PORT: String(port), AI_PROVIDER: "" }, stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    try { up = (await fetch(base + "/")).ok; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  assert.ok(up);
  const admin = await loginChanging("coordenacao@escola.com");
  await loginChanging("professora@escola.com");
  // Um dado que so existe no computador antigo
  assert.equal((await api("POST", "/api/classes", { cookie: admin, body: { name: "Turma Migrada", level: "Jardim" } })).status, 201);
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  for (const dir of [OLD_DIR, NEW_DIR]) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("professora nao consegue exportar o banco", async () => {
  const first = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "professora@escola.com", password: PASSWORD }) });
  const cookie = first.headers.get("set-cookie").split(";")[0];
  assert.equal((await api("GET", "/api/backup/export", { cookie })).status, 403);
  const result = migrate("professora@escola.com", [PASSWORD, "S"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /COORDENAÇÃO/);
});

test("senha errada: nada muda no computador novo", () => {
  const before = count(NEW_DIR, "SELECT count(*) AS n FROM classes");
  const result = migrate("coordenacao@escola.com", ["senha-errada", "S"]);
  assert.notEqual(result.status, 0);
  assert.equal(count(NEW_DIR, "SELECT count(*) AS n FROM classes"), before);
});

test("migracao traz os dados, guarda o banco anterior e registra no historico", () => {
  const result = migrate("coordenacao@escola.com", [PASSWORD, "S"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Pronto!/);
  assert.equal(count(NEW_DIR, "SELECT count(*) AS n FROM classes WHERE name = 'Turma Migrada'"), 1);
  assert.equal(count(NEW_DIR, "SELECT count(*) AS n FROM audit_log WHERE action = 'migração recebida'"), 1);
  assert.equal(count(OLD_DIR, "SELECT count(*) AS n FROM audit_log WHERE action = 'exportar banco'"), 1);
  const kept = fs.readdirSync(path.join(NEW_DIR, "backups")).filter((name) => name.startsWith("antes-da-migracao-"));
  assert.equal(kept.length, 1);
  assert.ok(!fs.existsSync(path.join(NEW_DIR, "migracao-recebida.tmp")));
});
