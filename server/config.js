// Configuracao da aplicacao. Nao depende de nenhum pacote externo (dotenv "na mao"):
// se existir um arquivo .env na raiz do projeto, ele e lido e as chaves viram
// variaveis de ambiente (sem sobrescrever o que ja estiver definido no shell).
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT_DIR, ".env");

function loadDotEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadDotEnv();

// DATA_DIR pode ser trocado por variavel de ambiente - usado pelos testes
// automaticos (tests/), que rodam numa pasta temporaria e nunca tocam o
// banco de verdade da escola.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, "data");
// Banco SQLite (ver server/store.js).
const DB_PATH = path.join(DATA_DIR, "apoio.sqlite");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}


module.exports = {
  ROOT_DIR,
  DATA_DIR,
  DB_PATH,
  PORT: Number(process.env.PORT) || 3000,
  HOST: process.env.HOST || "127.0.0.1",
  // IA local: "ollama" liga a IA (precisa do Ollama instalado e aberto nesta
  // maquina); vazio = IA desligada (a tela avisa que a IA esta desativada).
  // A tela "menu IA da coordenacao" pode sobrescrever isso (ver server/ai/ollamaClient.js).
  AI_PROVIDER: (process.env.AI_PROVIDER || "").trim().toLowerCase(),
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || "qwen2.5:7b",
  // Acesso de outros aparelhos (ver server/security/network.js e docs/acesso-remoto.md)
  TRUST_PROXY: process.env.TRUST_PROXY === "1",
  HTTPS_PFX: process.env.HTTPS_PFX ? path.resolve(ROOT_DIR, process.env.HTTPS_PFX) : "",
  HTTPS_PFX_PASSWORD: process.env.HTTPS_PFX_PASSWORD || "",
  ALLOW_INSECURE_LAN: process.env.ALLOW_INSECURE_LAN === "1",
  ensureDataDir
};
