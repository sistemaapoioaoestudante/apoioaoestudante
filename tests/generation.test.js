// Testes da geracao de atividades SEM a IA de verdade: um "Ollama de
// mentira" responde no mesmo formato, rapido e previsivel. Confere:
//   - as 3 atividades chegam uma de cada vez e terminam com "done";
//   - se a conexao cai no meio (celular apagou a tela), a geracao continua
//     e, ao reconectar, a tela recebe tudo;
//   - duas professoras ao mesmo tempo: a segunda entra na fila;
//   - "completar as que faltaram" pede so a quantidade certa.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "apoio-ia-"));
let fakeOllama;
let server;
let base;
const cookies = {};
const seenRequests = [];

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Atividade no formato exigido pelo esquema (server/ai/activityFormat.js). */
function fakeActivity(n) {
  return {
    type: `Tipo ${n}`,
    tone: "green",
    resourceClass: "manipulative",
    title: `Atividade de teste ${n}`,
    resource: "Massinha",
    method: "Mostre e faça junto.",
    adaptation: "Use apoio visual.",
    time: "10 min",
    supportLevel: "Apoio moderado"
  };
}

/** "Ollama" que escreve a resposta aos poucos (cada atividade ~400ms). */
function startFakeOllama(port) {
  fakeOllama = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const payload = JSON.parse(body || "{}");
      seenRequests.push(payload);
      if (!payload.stream) {
        res.end(JSON.stringify({ message: { content: "ok" }, done: true })); // aquecimento
        return;
      }
      const count = payload.format?.properties?.atividades?.maxItems || 3;
      const text = JSON.stringify({ atividades: Array.from({ length: count }, (_, i) => fakeActivity(i + 1)) });
      const pieces = text.match(/.{1,40}/g);
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      for (const piece of pieces) {
        if (res.destroyed) return;
        res.write(`${JSON.stringify({ message: { content: piece }, done: false })}\n`);
        await new Promise((r) => setTimeout(r, 1200 / pieces.length * count));
      }
      res.end(`${JSON.stringify({ message: { content: "" }, done: true })}\n`);
    });
  });
  return new Promise((resolve) => fakeOllama.listen(port, "127.0.0.1", resolve));
}

async function login(email) {
  const first = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "123456" }) });
  const cookie = first.headers.get("set-cookie").split(";")[0];
  await fetch(`${base}/api/auth/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ currentPassword: "123456", newPassword: "SenhaDeTeste2026" })
  });
  return cookie;
}

/** Le o fluxo de eventos (NDJSON) ate o fim, ou ate `stopAfter` eventos. */
async function readEvents(url, cookie, { stopAfter = Infinity } = {}) {
  const controller = new AbortController();
  const response = await fetch(base + url, { headers: { cookie }, signal: controller.signal });
  assert.equal(response.status, 200);
  const events = [];
  let pending = "";
  try {
    for await (const chunk of response.body) {
      pending += Buffer.from(chunk).toString("utf8");
      let newline;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line) events.push(JSON.parse(line));
        if (events.length >= stopAfter) {
          controller.abort(); // "celular apagou a tela"
          return events;
        }
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  }
  return events;
}

before(async () => {
  const env = { ...process.env, DATA_DIR };
  assert.equal(spawnSync(process.execPath, ["server/seedData/seed.js"], { cwd: ROOT, env }).status, 0);
  const ollamaPort = await freePort();
  await startFakeOllama(ollamaPort);
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["server/index.js"], {
    cwd: ROOT,
    env: { ...env, PORT: String(port), AI_PROVIDER: "ollama", OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`, OLLAMA_MODEL: "falso" },
    stdio: "ignore"
  });
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    try { up = (await fetch(base + "/")).ok; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  assert.ok(up);
  cookies.ana = await login("professora@escola.com"); // Jardim A e Pré I B
  cookies.carla = await login("carla@escola.com"); // Jardim A
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  if (fakeOllama) fakeOllama.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("gera as 3 atividades, uma de cada vez", async () => {
  const events = await readEvents("/api/activities?studentId=joao&goalCode=EI02EO01&theme=Animais", cookies.ana);
  const types = events.map((event) => event.type);
  assert.equal(types[0], "start");
  assert.equal(types.filter((type) => type === "activity").length, 3);
  assert.equal(types.at(-1), "done");
});

test("conexao cai no meio: a geracao continua e a reconexao recebe tudo", async () => {
  const url = "/api/activities?studentId=joao&goalCode=EI02EO01&theme=Cores";
  const partial = await readEvents(url, cookies.ana, { stopAfter: 2 }); // start + 1a atividade
  assert.equal(partial.length, 2);
  await new Promise((r) => setTimeout(r, 300));
  const resumed = await readEvents(url, cookies.ana);
  assert.equal(resumed.filter((event) => event.type === "activity").length, 3);
  assert.equal(resumed.at(-1).type, "done");
});

test("duas professoras ao mesmo tempo: a segunda entra na fila", async () => {
  const [first, second] = await Promise.all([
    readEvents("/api/activities?studentId=joao&goalCode=EI02EO01&theme=Fila1", cookies.ana),
    new Promise((r) => setTimeout(r, 100)).then(() => readEvents("/api/activities?studentId=mateus&goalCode=EI02EO01&theme=Fila2", cookies.carla))
  ]);
  assert.equal(first.at(-1).type, "done");
  assert.ok(second.some((event) => event.type === "queued"), "a segunda deveria esperar na fila");
  assert.equal(second.at(-1).type, "done");
});

test("completar so as que faltaram pede a quantidade certa", async () => {
  const before = seenRequests.length;
  const events = await readEvents(
    `/api/activities?studentId=joao&goalCode=EI02EO01&theme=Animais&quantidade=1&evitar=${encodeURIComponent("Atividade A|Atividade B")}`,
    cookies.ana
  );
  assert.equal(events.filter((event) => event.type === "activity").length, 1);
  const sent = seenRequests.slice(before).find((request) => request.stream);
  assert.equal(sent.format.properties.atividades.maxItems, 1);
  assert.match(sent.messages[1].content, /APENAS 1 atividade/);
});
