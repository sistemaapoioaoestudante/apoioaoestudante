// ---------------------------------------------------------------------------
// Ensaio de carga na API real: varias professoras usando ao mesmo tempo.
//
// Para cada cenario de volume (P = uma escola, dados de demonstracao;
// M = 20 escolas, ver dadosFicticios.js) sobe o servidor de verdade, entra
// como professora e dispara requisicoes simultaneas em tres rotas:
//   - lista de alunos            (leitura)    GET  /api/students
//   - resumo do aluno            (leitura)    GET  /api/students/:id/summary
//   - registro de resultado      (gravacao)   POST /api/feedbacks
// com 10 e 50 "professoras" simultaneas. Mede vazao (requisicoes por
// segundo), latencia p50/p95 e erros.
//
// Uso:  node bench/carga.js            (resultado em bench/resultados/carga.json)
// ---------------------------------------------------------------------------
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { ROOT, createDemoData, startServer, stopServer, login, percentile, round, removeDir, machineInfo } = require("./comum");

const REQUESTS_PER_RUN = 2000;
const CONCURRENCY = [10, 50];

/** Dispara `total` requisicoes com `concurrency` clientes ao mesmo tempo. */
async function run(makeRequest, total, concurrency) {
  const times = [];
  let errors = 0;
  let next = 0;
  const started = process.hrtime.bigint();
  async function client() {
    while (next < total) {
      const n = next++;
      const t0 = process.hrtime.bigint();
      try {
        const response = await makeRequest(n);
        await response.arrayBuffer();
        if (!response.ok) errors++;
      } catch {
        errors++;
      }
      times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, client));
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  return {
    vazao: round(total / seconds, 1),
    p50: round(percentile(times, 50), 1),
    p95: round(percentile(times, 95), 1),
    erros: errors
  };
}

async function scenario(name) {
  const dir = createDemoData(name);
  if (name === "M") {
    const grow = spawnSync(process.execPath, ["bench/dadosFicticios.js"], { cwd: ROOT, env: { ...process.env, DATA_DIR: dir }, encoding: "utf8" });
    if (grow.status !== 0) throw new Error(grow.stderr);
    process.stdout.write(`  ${grow.stdout.trim()}\n`);
  }
  const { base, child } = await startServer(dir);
  const results = [];
  try {
    const cookie = await login(base, "professora@escola.com");
    const { students } = await (await fetch(`${base}/api/students`, { headers: { cookie } })).json();
    const ids = students.map((student) => student.id);
    const routes = [
      ["Lista de alunos (leitura)", () => fetch(`${base}/api/students`, { headers: { cookie } })],
      ["Resumo do aluno (leitura)", (n) => fetch(`${base}/api/students/${ids[n % ids.length]}/summary`, { headers: { cookie } })],
      [
        "Registro de resultado (gravação)",
        (n) =>
          fetch(`${base}/api/feedbacks`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ studentId: ids[n % ids.length], theme: "Ensaio", activityTitle: `Ensaio ${n}`, result: "Funcionou bem", notes: "" })
          })
      ]
    ];
    for (const [route, makeRequest] of routes) {
      for (const concurrency of CONCURRENCY) {
        const result = await run(makeRequest, REQUESTS_PER_RUN, concurrency);
        results.push({ cenario: name, rota: route, simultaneas: concurrency, alunosDaProfessora: ids.length, ...result });
        process.stdout.write(`  ${name} | ${route} | ${concurrency} simultaneas -> ${JSON.stringify(result)}\n`);
      }
    }
  } finally {
    await stopServer(child);
    removeDir(dir);
  }
  return results;
}

(async () => {
  const resultados = [];
  for (const name of ["P", "M"]) {
    console.log(`Cenario ${name}...`);
    resultados.push(...(await scenario(name)));
  }
  const saida = { data: new Date().toISOString(), maquina: machineInfo(), requisicoesPorRodada: REQUESTS_PER_RUN, resultados };
  fs.mkdirSync(path.join(__dirname, "resultados"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "resultados", "carga.json"), JSON.stringify(saida, null, 2));
  console.log("Resultado salvo em bench/resultados/carga.json");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
