// ---------------------------------------------------------------------------
// Atualizacao do sistema.
//
// - Confere, ao ligar e a cada 12 horas, se saiu uma versao nova no
//   repositorio PUBLICO de versoes (so instaladores; o codigo e privado).
//   A consulta nao leva nenhum dado da escola: e so "qual e a ultima versao?".
// - A coordenacao ve o aviso na tela e clica em "Atualizar agora".
// - O sistema baixa o instalador, confere a assinatura do arquivo (SHA-256
//   publicado pelo GitHub) e roda o instalador em modo silencioso, numa
//   tarefa do Windows separada (a tarefa do sistema e encerrada durante a
//   atualizacao). Os dados da escola (pasta data) e o .env sao mantidos.
//
// UPDATE_CHECK=0 desliga a conferencia (usado nos testes automaticos).
// UPDATE_REPO troca o repositorio de versoes ("dono/nome").
// ---------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const config = require("../config");

const REPO = process.env.UPDATE_REPO || "sistemaapoioaoestudante/apoioaoestudante-versoes";
const ENABLED = process.env.UPDATE_CHECK !== "0";
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;
const MAX_INSTALLER_BYTES = 80 * 1024 * 1024;
const TASK_NAME = "Apoio ao Estudante - atualizar";
const CURRENT = require("../../package.json").version;

const state = {
  latest: null, // "1.0.9"
  notes: "",
  pageUrl: "", // pagina da versao (para baixar a mao)
  asset: null, // { name, url, size, sha256 }
  checkedAt: null,
  error: null,
  installing: null // { version, startedAt }
};

/** Compara "1.2.10" com "1.2.9": >0 se a for maior. */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Le a resposta do GitHub e guarda so o que interessa. */
function readRelease(release) {
  const version = String(release.tag_name || "").replace(/^v/i, "");
  if (!/^\d+(\.\d+)*$/.test(version)) throw new Error("Versão publicada em formato desconhecido.");
  const exe = (release.assets || []).find((a) => /^instalar-apoio-ao-estudante.*\.exe$/i.test(a.name));
  const digest = exe && /^sha256:([0-9a-f]{64})$/i.exec(exe.digest || "");
  return {
    latest: version,
    notes: String(release.body || "").slice(0, 4000),
    pageUrl: /^https:\/\/github\.com\//.test(release.html_url || "") ? release.html_url : "",
    asset: exe ? { name: exe.name, url: exe.browser_download_url, size: exe.size, sha256: digest ? digest[1].toLowerCase() : null } : null
  };
}

/** Pergunta ao GitHub qual e a ultima versao. Sem internet: guarda o erro e segue. */
async function check() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "ApoioAoEstudante-atualizador" },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`O site de versões respondeu ${response.status}.`);
    Object.assign(state, readRelease(await response.json()), { error: null });
  } catch (error) {
    state.error = error.name === "TimeoutError" ? "Sem resposta do site de versões (internet?)." : error.message;
  }
  state.checkedAt = new Date().toISOString();
  return info();
}

/** O sistema roda com permissao de administrador (servico do instalador)? */
let adminCache = null;
function runningAsAdmin() {
  if (process.platform !== "win32") return false;
  if (adminCache === null) {
    const result = spawnSync("net", ["session"], { windowsHide: true, stdio: "ignore" });
    adminCache = result.status === 0;
  }
  return adminCache;
}

function info() {
  const available = Boolean(state.latest && compareVersions(state.latest, CURRENT) > 0);
  return {
    current: CURRENT,
    latest: state.latest,
    available,
    notes: available ? state.notes : "",
    pageUrl: state.pageUrl,
    checkedAt: state.checkedAt,
    error: state.error,
    installing: state.installing,
    // Atualizar com um clique: precisa do instalador com assinatura e do
    // sistema rodando como servico (administrador). Senao, baixar a mao.
    canInstall: Boolean(available && state.asset && state.asset.sha256 && runningAsAdmin())
  };
}

/** Baixa o instalador e confere o SHA-256. Devolve o caminho do arquivo. */
async function download() {
  const { asset } = state;
  if (!asset || !asset.sha256) throw new Error("A versão nova não tem instalador com assinatura. Baixe pela página de versões.");
  if (asset.size > MAX_INSTALLER_BYTES) throw new Error("Instalador grande demais.");
  const response = await fetch(asset.url, { headers: { "User-Agent": "ApoioAoEstudante-atualizador" }, signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok) throw new Error(`Não foi possível baixar o instalador (${response.status}).`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_INSTALLER_BYTES) throw new Error("Instalador grande demais.");
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  if (hash !== asset.sha256) throw new Error("O arquivo baixado não confere com a versão publicada. Nada foi instalado.");
  const dir = path.join(config.DATA_DIR, "atualizacao");
  fs.mkdirSync(dir, { recursive: true });
  const name = asset.name.replace(/[^\w.-]/g, "_");
  const file = path.join(dir, name);
  fs.writeFileSync(file, data);
  return file;
}

/**
 * Baixa e roda o instalador novo em modo silencioso, numa tarefa do Windows
 * propria (assim ele continua rodando quando a tarefa do sistema e encerrada).
 */
async function install() {
  const current = info();
  if (state.installing) throw new Error("A atualização já está em andamento.");
  if (!current.available) throw new Error("Este computador já está na versão mais nova.");
  if (!current.canInstall) throw new Error("Este computador não consegue atualizar sozinho. Baixe o instalador pela página de versões.");

  const file = await download();
  const log = path.join(path.dirname(file), "instalacao.log");
  const command = `"${file}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /LOG="${log}"`;
  const create = spawnSync(
    "schtasks",
    ["/create", "/f", "/tn", TASK_NAME, "/sc", "once", "/st", "00:00", "/sd", "01/01/2030", "/ru", "SYSTEM", "/rl", "HIGHEST", "/tr", command],
    { windowsHide: true, encoding: "utf8" }
  );
  if (create.status !== 0) throw new Error("Não foi possível preparar a atualização (tarefa do Windows).");
  const run = spawnSync("schtasks", ["/run", "/tn", TASK_NAME], { windowsHide: true, encoding: "utf8" });
  if (run.status !== 0) throw new Error("Não foi possível iniciar a atualização (tarefa do Windows).");

  state.installing = { version: state.latest, startedAt: new Date().toISOString() };
  return info();
}

let started = false;
function start() {
  if (!ENABLED || started) return;
  started = true;
  setTimeout(check, 60 * 1000).unref();
  setInterval(check, CHECK_EVERY_MS).unref();
}

module.exports = { start, check, info, install, compareVersions, readRelease, CURRENT, REPO, ENABLED };
