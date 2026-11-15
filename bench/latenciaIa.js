// ---------------------------------------------------------------------------
// Tempo de geracao das atividades pela IA local (Ollama), como a professora
// percebe: do clique em "Gerar" ate a 1a atividade aparecer e ate as 3
// estarem prontas. Usa o servidor de verdade e o Ollama deste computador.
//
//   - 1 chamada "a frio": o modelo e descarregado antes (ollama stop) e a
//     chamada sai logo que o sistema abre, entao inclui carregar o modelo;
//   - 5 chamadas "a quente", com temas diferentes.
//
// Uso:  node bench/latenciaIa.js [modelo]    (padrao: o OLLAMA_MODEL do .env ou llama3.2)
// Resultado em bench/resultados/latencia-ia-<modelo>.json
// ---------------------------------------------------------------------------
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createDemoData, startServer, stopServer, login, percentile, round, removeDir, machineInfo } = require("./comum");
const config = require("../server/config");

const MODELO = process.argv[2] || config.OLLAMA_MODEL || "llama3.2";
const TEMAS = ["Animais da fazenda", "Cores e formas", "Frutas", "Meios de transporte", "Família"];

/** Pede as atividades e mede o tempo da 1a e da ultima. */
async function gerar(base, cookie, tema) {
  const url = `${base}/api/activities?studentId=joao&goalCode=EI02EO01&theme=${encodeURIComponent(tema)}`;
  const t0 = Date.now();
  const response = await fetch(url, { headers: { cookie } });
  let primeira = null;
  let atividades = 0;
  let erro = null;
  let pendente = "";
  for await (const chunk of response.body) {
    pendente += Buffer.from(chunk).toString("utf8");
    let quebra;
    while ((quebra = pendente.indexOf("\n")) >= 0) {
      const linha = pendente.slice(0, quebra).trim();
      pendente = pendente.slice(quebra + 1);
      if (!linha) continue;
      const evento = JSON.parse(linha);
      if (evento.type === "activity") {
        atividades++;
        if (primeira === null) primeira = (Date.now() - t0) / 1000;
      }
      if (evento.type === "error") erro = evento.message || "erro";
    }
  }
  return { tema, primeiraS: round(primeira, 1), totalS: round((Date.now() - t0) / 1000, 1), atividades, erro };
}

(async () => {
  console.log(`Modelo: ${MODELO}`);
  spawnSync("ollama", ["stop", MODELO], { stdio: "ignore" }); // descarrega: chamada a frio
  const dir = createDemoData("ia");
  // A 1a chamada sai logo depois de o sistema abrir, com o modelo fora da
  // memoria: e o que a professora espera logo depois de o computador ligar.
  const { base, child } = await startServer(dir, {
    AI_PROVIDER: "ollama",
    OLLAMA_MODEL: MODELO,
    OLLAMA_BASE_URL: config.OLLAMA_BASE_URL
  });
  const chamadas = [];
  try {
    const cookie = await login(base, "professora@escola.com");
    for (let i = 0; i < TEMAS.length + 1; i++) {
      const tema = i === 0 ? "Brincadeiras de roda" : TEMAS[i - 1];
      const r = { tipo: i === 0 ? "a frio" : "a quente", ...(await gerar(base, cookie, tema)) };
      chamadas.push(r);
      console.log(`  ${JSON.stringify(r)}`);
    }
  } finally {
    await stopServer(child);
    removeDir(dir);
  }
  const quentes = chamadas.filter((c) => c.tipo === "a quente");
  const resumo = {
    modelo: MODELO,
    frioTotalS: chamadas[0].totalS,
    frioPrimeiraS: chamadas[0].primeiraS,
    primeiraP50: round(percentile(quentes.map((c) => c.primeiraS), 50), 1),
    totalP50: round(percentile(quentes.map((c) => c.totalS), 50), 1),
    totalP95: round(percentile(quentes.map((c) => c.totalS), 95), 1),
    completas: `${chamadas.filter((c) => c.atividades === 3).length}/${chamadas.length}`
  };
  console.log(JSON.stringify(resumo));
  fs.mkdirSync(path.join(__dirname, "resultados"), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, "resultados", `latencia-ia-${MODELO.replace(/[:/]/g, "-")}.json`),
    JSON.stringify({ data: new Date().toISOString(), maquina: machineInfo(), resumo, chamadas }, null, 2)
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
