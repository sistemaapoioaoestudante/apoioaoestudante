// Faz uma copia do banco AGORA para o arquivo indicado. Usado pelo
// backup-pendrive.bat:  node server\tools\backupAgora.js E:\pasta\apoio.sqlite
//
// Funciona com o sistema aberto: o SQLite monta um retrato consistente do
// banco (copiar o arquivo direto, com o sistema rodando, poderia gerar uma
// copia incompleta).
const fs = require("fs");
const path = require("path");
const config = require("../config");
const store = require("../store");

const target = process.argv[2];
if (!target) {
  console.error("Uso: node server/tools/backupAgora.js <arquivo-de-destino.sqlite>");
  process.exit(1);
}
if (!fs.existsSync(config.DB_PATH)) {
  console.error(`[ERRO] Banco não encontrado em ${config.DB_PATH}.`);
  process.exit(1);
}

try {
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  store.backupTo(path.resolve(target));
  store.close();
  console.log(`Cópia do banco salva em ${path.resolve(target)}`);
} catch (error) {
  console.error(`[ERRO] ${error.message}`);
  process.exit(1);
}
