// ---------------------------------------------------------------------------
// Ensaio da camada de dados (SQLite), sem o servidor HTTP no meio.
//
//  1. Tempo de gravacao e de consulta de um registro, nos cenarios P (uma
//     escola) e M (20 escolas): 200 repeticoes, relatando p50 e p95.
//  2. Integridade sob gravacao simultanea: 4 processos gravam 250 registros
//     cada um, ao mesmo tempo, no mesmo banco; confere se algum se perdeu.
//
// Uso:  node bench/persistencia.js     (resultado em bench/resultados/persistencia.json)
// ---------------------------------------------------------------------------
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { ROOT, createDemoData, percentile, round, removeDir, machineInfo } = require("./comum");

const REPETICOES = 200;
const PROCESSOS = 4;
const POR_PROCESSO = 250;

// ---- modo "filho": usado pelo proprio ensaio ---------------------------------
// node bench/persistencia.js --medir         -> mede gravacao/consulta e imprime JSON
// node bench/persistencia.js --gravar <n> <p> -> grava n registros (processo p)
if (process.argv[2] === "--medir") {
  const store = require("../server/store");
  const tAbrir = process.hrtime.bigint();
  store.load();
  const abrir = Number(process.hrtime.bigint() - tAbrir) / 1e6;
  const studentIds = store.getAll("students").map((student) => student.id);
  const gravar = [];
  const consultarAluno = [];
  for (let i = 0; i < REPETICOES; i++) {
    const studentId = studentIds[i % studentIds.length];
    let t0 = process.hrtime.bigint();
    store.insert("feedbacks", {
      studentId,
      teacherName: "Ensaio",
      theme: "Ensaio",
      activityTitle: `Gravacao ${i}`,
      result: "Funcionou bem",
      notes: "",
      date: "01/11/2026"
    });
    gravar.push(Number(process.hrtime.bigint() - t0) / 1e6);
    t0 = process.hrtime.bigint();
    store.getById("students", studentId);
    consultarAluno.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const tamanhoMB = fs.statSync(require("../server/config").DB_PATH).size / 1024 ** 2;
  console.log(
    JSON.stringify({
      registros: store.getAll("feedbacks").length,
      alunos: studentIds.length,
      tamanhoMB: round(tamanhoMB, 2),
      abrirBancoMs: round(abrir, 1),
      gravacaoP50: round(percentile(gravar, 50), 3),
      gravacaoP95: round(percentile(gravar, 95), 3),
      consultaP50: round(percentile(consultarAluno, 50), 3),
      consultaP95: round(percentile(consultarAluno, 95), 3)
    })
  );
  store.close();
  return;
}
if (process.argv[2] === "--gravar") {
  const store = require("../server/store");
  const total = Number(process.argv[3]);
  const processo = process.argv[4];
  let falhas = 0;
  for (let i = 0; i < total; i++) {
    try {
      store.insert("feedbacks", {
        id: `concorrencia-${processo}-${i}`,
        studentId: "joao",
        teacherName: "Ensaio",
        theme: "Concorrência",
        activityTitle: `Processo ${processo} registro ${i}`,
        result: "Funcionou bem",
        notes: "",
        date: "01/11/2026"
      });
    } catch {
      falhas++;
    }
  }
  console.log(JSON.stringify({ falhas }));
  store.close();
  return;
}

// ---- ensaio ------------------------------------------------------------------

function medirCenario(nome) {
  const dir = createDemoData(nome);
  const env = { ...process.env, DATA_DIR: dir };
  if (nome === "M") {
    const grow = spawnSync(process.execPath, ["bench/dadosFicticios.js"], { cwd: ROOT, env, encoding: "utf8" });
    if (grow.status !== 0) throw new Error(grow.stderr);
  }
  const out = spawnSync(process.execPath, ["bench/persistencia.js", "--medir"], { cwd: ROOT, env, encoding: "utf8" });
  removeDir(dir);
  if (out.status !== 0) throw new Error(out.stderr);
  return { cenario: nome, ...JSON.parse(out.stdout.trim().split("\n").pop()) };
}

async function integridade() {
  const rodadas = [];
  for (let rodada = 1; rodada <= 3; rodada++) {
    const dir = createDemoData(`concorrencia-${rodada}`);
    const env = { ...process.env, DATA_DIR: dir };
    const antes = Number(spawnSync(process.execPath, ["-e", "const s=require('./server/store');console.log(s.getAll('feedbacks').length);s.close()"], { cwd: ROOT, env, encoding: "utf8" }).stdout.trim());
    const filhos = Array.from({ length: PROCESSOS }, (_, p) =>
      new Promise((resolve) => {
        let saida = "";
        const filho = spawn(process.execPath, ["bench/persistencia.js", "--gravar", String(POR_PROCESSO), String(p)], { cwd: ROOT, env });
        filho.stdout.on("data", (d) => (saida += d));
        filho.on("exit", () => resolve(JSON.parse(saida.trim() || '{"falhas":-1}')));
      })
    );
    const falhas = (await Promise.all(filhos)).reduce((soma, f) => soma + f.falhas, 0);
    const depois = Number(spawnSync(process.execPath, ["-e", "const s=require('./server/store');console.log(s.getAll('feedbacks').length);s.close()"], { cwd: ROOT, env, encoding: "utf8" }).stdout.trim());
    const gravados = depois - antes;
    rodadas.push({ rodada, esperados: PROCESSOS * POR_PROCESSO, gravados, perdidos: PROCESSOS * POR_PROCESSO - gravados, falhasRelatadas: falhas });
    console.log(`  rodada ${rodada}: ${JSON.stringify(rodadas.at(-1))}`);
    removeDir(dir);
  }
  return rodadas;
}

(async () => {
  console.log("Gravacao e consulta...");
  const desempenho = ["P", "M"].map((nome) => {
    const r = medirCenario(nome);
    console.log(`  ${JSON.stringify(r)}`);
    return r;
  });
  console.log("Integridade com gravacao simultanea...");
  const concorrencia = await integridade();
  const saida = { data: new Date().toISOString(), maquina: machineInfo(), repeticoes: REPETICOES, desempenho, concorrencia };
  fs.mkdirSync(path.join(__dirname, "resultados"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "resultados", "persistencia.json"), JSON.stringify(saida, null, 2));
  console.log("Resultado salvo em bench/resultados/persistencia.json");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
