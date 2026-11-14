// Migra o sistema de outro computador para ESTE, pela rede privada da escola
// (Tailscale). Roda no computador NOVO, com o sistema daqui FECHADO.
//
//   node server/tools/migrar.js https://apoio-escola.<rede>.ts.net
//   (ou dois cliques em migrar.bat, que pergunta o endereco)
//
// O que acontece:
//   1. pede o e-mail e a senha da COORDENACAO (a senha nao aparece na tela);
//   2. entra no computador antigo e baixa uma copia completa do banco
//      (GET /api/backup/export - so a coordenacao consegue);
//   3. confere a copia: arquivo integro, e de uma versao que este sistema
//      entende, tem conta da coordenacao;
//   4. se ja existir um banco aqui, guarda uma copia dele em
//      data/backups/antes-da-migracao-<data>.sqlite e so entao substitui;
//   5. abre o banco novo (atualizando a estrutura, se este sistema for mais
//      novo) e registra a migracao no historico.
// Nada e apagado no computador antigo: depois de conferir, a coordenacao
// desliga/remove o antigo (ver docs/acesso-remoto.md).
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const { DatabaseSync } = require("node:sqlite");
const config = require("../config");
const { SCHEMA_VERSION } = require("../db/schema");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const emailArgIndex = args.indexOf("--email");
const EMAIL_ARG = emailArgIndex >= 0 ? args[emailArgIndex + 1] : "";
const ADDRESS = args.find((item, index) => !item.startsWith("--") && index !== emailArgIndex + 1);

const TMP_PATH = path.join(config.DATA_DIR, "migracao-recebida.tmp");
let sourceAddress = ""; // endereco do computador antigo (vai para o historico)

function fail(message) {
  console.error("");
  console.error(`[ERRO] ${message}`);
  console.error("Nada foi alterado neste computador.");
  fs.rmSync(TMP_PATH, { force: true });
  process.exit(1);
}

// ---- perguntas no terminal ----------------------------------------------------

/** Le uma linha. Com `hidden`, nao mostra o que e digitado (senha). */
function ask(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) {
    // Sem terminal (ex: testes): le as respostas da entrada padrao, em ordem
    return readPipedLine();
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      if (hidden) rl.output.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

let pipedLines = null;
async function readPipedLine() {
  if (!pipedLines) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    pipedLines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
  }
  return (pipedLines.shift() || "").trim();
}

// ---- passos -----------------------------------------------------------------------

/** O sistema deste computador precisa estar fechado (o banco seria substituido). */
async function assertLocalSystemClosed() {
  try {
    await fetch(`http://127.0.0.1:${config.PORT}/`, { signal: AbortSignal.timeout(1500) });
    fail(`O sistema está aberto NESTE computador (porta ${config.PORT}). Feche a janela dele e rode a migração de novo.`);
  } catch (error) {
    // nao respondeu = fechado, pode seguir
  }
}

/** Endereco do computador antigo, limpo: "https://host[:porta]". */
function normalizeAddress(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch (error) {
    fail("Endereço inválido. Exemplo: https://apoio-escola.nome-da-rede.ts.net");
  }
  const local = ["127.0.0.1", "localhost"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !local) {
    fail("Use o endereço com https:// (a cópia do banco só viaja por conexão protegida).");
  }
  return `${parsed.protocol}//${parsed.host}`;
}

async function login(base, email, password) {
  let response;
  try {
    response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    fail(`Não foi possível falar com ${base}. Confira se o computador antigo está ligado, com o sistema aberto e o Tailscale conectado nos dois. (${error.message})`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) fail(data.error || `O computador antigo recusou o login (código ${response.status}).`);
  if (data.user.role !== "admin") fail("Só uma conta da COORDENAÇÃO pode fazer a migração.");
  if (data.user.mustChangePassword) fail("Essa conta está com senha provisória. Entre no sistema antigo, crie a senha nova e tente de novo.");
  return response.headers.get("set-cookie").split(";")[0];
}

async function download(base, cookie) {
  const response = await fetch(`${base}/api/backup/export`, { headers: { cookie } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    fail(data.error || `O computador antigo recusou a cópia (código ${response.status}).`);
  }
  config.ensureDataDir();
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(TMP_PATH));
  // Avisa o antigo que terminou (encerra a sessao usada na migracao)
  fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie } }).catch(() => {});
}

/** Confere a copia antes de usar. Devolve um resumo do que veio. */
function verify() {
  let db;
  try {
    db = new DatabaseSync(TMP_PATH, { readOnly: true });
  } catch (error) {
    fail(`A cópia recebida não é um banco válido (${error.message}).`);
  }
  try {
    const integrity = db.prepare("PRAGMA integrity_check").get().integrity_check;
    if (integrity !== "ok") fail(`A cópia recebida está danificada (${integrity}). Tente de novo.`);
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version > SCHEMA_VERSION) {
      fail(`O computador antigo tem uma versão MAIS NOVA do sistema (banco v${version}; este entende até v${SCHEMA_VERSION}). Atualize o sistema deste computador primeiro.`);
    }
    const count = (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
    const admins = db.prepare("SELECT count(*) AS n FROM users WHERE role = 'admin'").get().n;
    if (!admins) fail("A cópia não tem nenhuma conta da coordenação.");
    return { version, users: count("users"), teachers: count("teachers"), classes: count("classes"), students: count("students"), feedbacks: count("feedbacks") };
  } finally {
    db.close();
  }
}

/** Guarda o banco que ja existe aqui e coloca a copia no lugar. */
async function install() {
  if (fs.existsSync(config.DB_PATH)) {
    if (!FORCE) {
      const answer = await ask("Já existe um banco neste computador. Substituir pelo do computador antigo? (uma cópia do atual será guardada) [S/N]: ");
      if (!/^s/i.test(answer)) fail("Migração cancelada.");
    }
    const store = require("../store");
    const dir = path.join(config.DATA_DIR, "backups");
    fs.mkdirSync(dir, { recursive: true });
    const keep = path.join(dir, `antes-da-migracao-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`);
    store.backupTo(keep);
    store.close();
    console.log(`Cópia do banco que estava aqui: data/backups/${path.basename(keep)}`);
    for (const file of [config.DB_PATH, `${config.DB_PATH}-wal`, `${config.DB_PATH}-shm`]) fs.rmSync(file, { force: true });
  }
  fs.renameSync(TMP_PATH, config.DB_PATH);

  // Abre pelo sistema: aplica as atualizacoes de estrutura e registra no historico
  const store = require("../store");
  store.load();
  store.insert("auditLog", {
    at: new Date().toISOString(),
    actorName: "Migração",
    action: "migração recebida",
    entity: "sistema",
    details: `dados trazidos de ${sourceAddress}`
  });
  store.close();
}

async function main() {
  console.log("Migração do Apoio ao Estudante para este computador");
  console.log("");
  await assertLocalSystemClosed();

  const base = normalizeAddress(ADDRESS || (await ask("Endereço do computador ANTIGO (ex: https://apoio-escola.nome-da-rede.ts.net): ")));
  sourceAddress = base;
  const email = EMAIL_ARG || (await ask("E-mail da coordenação: "));
  const password = await ask("Senha da coordenação (não aparece ao digitar): ", { hidden: true });
  if (!email || !password) fail("Informe o e-mail e a senha da coordenação.");

  console.log("Entrando no computador antigo...");
  const cookie = await login(base, email, password);
  console.log("Baixando a cópia do banco (pode levar alguns segundos)...");
  await download(base, cookie);
  const summary = verify();
  console.log(
    `Cópia conferida: ${summary.students} alunos, ${summary.classes} turmas, ${summary.teachers} professoras, ${summary.feedbacks} registros de atividades, ${summary.users} contas.`
  );
  await install();

  console.log("");
  console.log("Pronto! Os dados do computador antigo estão neste computador.");
  console.log("Próximos passos:");
  console.log("  1. Abra o sistema aqui (iniciar.bat) e confira os dados.");
  console.log("  2. No painel do Tailscale, remova o computador antigo e deixe este com o nome apoio-escola.");
  console.log("  3. Reenvie os convites às professoras (Meu perfil da coordenação).");
}

main().catch((error) => fail(error.message));
