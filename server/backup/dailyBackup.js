// Backup automatico do banco (data/apoio.sqlite).
//
// Como funciona:
//   - Ao iniciar o servidor e depois a cada hora, confere se ja existe o
//     backup de hoje em data/backups/ (apoio-AAAA-MM-DD.sqlite). Se nao
//     existir, copia o banco para la - com o sistema rodando, sem risco de
//     copia pela metade (store.backupTo usa o "VACUUM INTO" do SQLite).
//   - Mantem os ultimos KEEP_DAYS backups e apaga os mais antigos.
//
// Para voltar a um dia anterior: feche o sistema, apague data/apoio.sqlite
// (e os arquivos apoio.sqlite-wal / apoio.sqlite-shm, se existirem) e copie
// o backup desejado para data/apoio.sqlite.
//
// IMPORTANTE: estes backups ficam no MESMO computador. Para proteger contra
// o computador estragar ou ser roubado, use o backup-pendrive.bat.
const fs = require("fs");
const path = require("path");
const config = require("../config");
const store = require("../store");

const BACKUP_DIR = path.join(config.DATA_DIR, "backups");
const KEEP_DAYS = 30;
const CHECK_EVERY_MS = 60 * 60 * 1000; // 1 hora
const DAILY_FILE = /^apoio-\d{4}-\d{2}-\d{2}\.sqlite$/;

/** Data local no formato AAAA-MM-DD (o nome do arquivo do dia). */
function todayStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Apaga os backups diarios alem dos KEEP_DAYS mais recentes. */
function pruneOldBackups() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => DAILY_FILE.test(name))
    .sort(); // o nome com a data ja ordena do mais antigo para o mais novo
  files.slice(0, Math.max(0, files.length - KEEP_DAYS)).forEach((name) => {
    fs.unlinkSync(path.join(BACKUP_DIR, name));
  });
}

/** Faz o backup do dia, se ainda nao existir. Nunca derruba o servidor. */
function runBackupIfDue() {
  try {
    if (!fs.existsSync(config.DB_PATH)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const target = path.join(BACKUP_DIR, `apoio-${todayStamp()}.sqlite`);
    if (fs.existsSync(target)) return;

    // Grava num nome temporario e so depois renomeia: um backup pela metade
    // nunca fica com o nome final.
    const tmp = `${target}.tmp`;
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    store.backupTo(tmp);
    fs.renameSync(tmp, target);
    pruneOldBackups();
    console.log(`  Backup do dia salvo em data/backups/${path.basename(target)}`);
  } catch (error) {
    console.error("Falha ao fazer o backup do banco:", error.message);
  }
}

/** Liga o backup automatico. Chamado uma vez por server/index.js. */
function startDailyBackup() {
  runBackupIfDue();
  // unref(): o timer nao impede o servidor de encerrar com Ctrl+C.
  setInterval(runBackupIfDue, CHECK_EVERY_MS).unref();
}

module.exports = { startDailyBackup, runBackupIfDue, BACKUP_DIR };
