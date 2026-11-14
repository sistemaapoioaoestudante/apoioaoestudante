// Cria o banco SQLite (data/apoio.sqlite) na primeira execucao (ou com --force).
// Rodado automaticamente pelo server/index.js se o banco ainda nao existir,
// e tambem pode ser chamado manualmente:
//
//   npm run seed           - cria o banco com dados de DEMONSTRACAO (se nao existir)
//   npm run reset-db       - apaga e recria com dados de demonstracao
//   npm run iniciar-escola - apaga e recria VAZIO para uso real: so a BNCC,
//                            a base de deficiencias e UMA conta da coordenacao
//                            (com senha provisoria mostrada uma unica vez)
//
// Antes de apagar um banco existente, uma copia dele e salva em
// data/backups/antes-do-reset-<data-hora>.sqlite.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const store = require("../store");
const { hashPassword } = require("../util/hash");
const { validateNewPassword } = require("../util/passwordPolicy");
const bnccGoals = require("./bnccGoals");
const needsBase = require("./needsBase");
const demo = require("./demo");

/** Copia o banco atual para data/backups e apaga os arquivos dele. */
function backupAndDeleteCurrent() {
  const dir = path.join(config.DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `antes-do-reset-${stamp}.sqlite`);
  store.backupTo(target);
  store.close();
  console.log(`Cópia de segurança do banco anterior: data/backups/${path.basename(target)}`);
  // O SQLite usa ate 3 arquivos: o banco e dois auxiliares (-wal e -shm)
  for (const file of [config.DB_PATH, `${config.DB_PATH}-wal`, `${config.DB_PATH}-shm`]) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (error) {
      throw new Error(`Não foi possível apagar ${path.basename(file)}. Feche o sistema (a janela do servidor) e tente de novo.`);
    }
  }
}

/**
 * Senha da coordenacao vinda do instalador (variavel COORD_PASSWORD). Se
 * ninguem informou, gera uma provisoria. Retorna { password, provisional }.
 */
function coordinationPassword() {
  const informed = process.env.COORD_PASSWORD;
  if (informed) {
    const problem = validateNewPassword(informed);
    if (problem) throw new Error(`Senha da coordenação recusada: ${problem}`);
    return { password: informed, provisional: false };
  }
  return { password: provisionalPassword(), provisional: true };
}

/** Senha provisoria aleatoria e facil de digitar (sem 0/O, 1/l). */
function provisionalPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => letters[b % letters.length]).join("");
}

function run({ force = false, empty = false } = {}) {
  const alreadyExists = fs.existsSync(config.DB_PATH);
  if (alreadyExists && !force) {
    console.log("data/apoio.sqlite já existe - nada foi alterado.");
    console.log("Para APAGAR e recriar, feche o sistema e rode de novo com --force no final");
    console.log('(ex: "npm run iniciar-escola -- --force"). Uma cópia do banco atual é salva antes.');
    return;
  }

  if (alreadyExists && force) backupAndDeleteCurrent();

  // Tudo numa transacao so: se qualquer cadastro falhar, o banco fica vazio
  // (e nao pela metade). store.load() cria o arquivo e as tabelas.
  store.load();

  if (empty) {
    // Uso real: nenhuma turma, professora ou aluno ficticio.
    const email = (process.env.COORD_EMAIL || "coordenacao@escola.com").trim().toLowerCase();
    const { password, provisional } = coordinationPassword();
    store.transaction(() => {
      store.replaceCollection("bnccGoals", bnccGoals);
      store.replaceCollection("needs", needsBase);
      store.replaceCollection("users", [
        {
          id: "user-coordenacao",
          email,
          passwordHash: hashPassword(password),
          mustChangePassword: provisional, // senha gerada: troca obrigatoria no 1o login
          role: "admin",
          name: "Coordenação Pedagógica",
          teacherId: null
        }
      ]);
    });
    console.log("Banco da escola criado VAZIO em data/apoio.sqlite (sem dados de demonstração).");
    if (provisional) {
      console.log("Única conta de acesso (anote agora - não aparece de novo):");
      console.log(`  Coordenação -> ${email}  /  senha provisória: ${password}`);
      console.log("No primeiro login o sistema pede uma senha nova.");
    } else {
      console.log(`Conta da coordenação criada: ${email} (com a senha informada na instalação).`);
    }
    console.log("Depois, cadastre turmas, professoras e alunos em Coordenação.");
    store.close();
    return;
  }

  store.transaction(() => {
    // Ordem importa: turmas e deficiencias antes de professoras e alunos
    store.replaceCollection("bnccGoals", bnccGoals);
    store.replaceCollection("needs", needsBase);
    store.replaceCollection("classes", demo.classes);
    store.replaceCollection("teachers", demo.teachers);
    store.replaceCollection("students", demo.students);
    store.replaceCollection("users", demo.buildUsers());
    store.replaceCollection("studentObservations", { ...demo.studentObservations });
    store.replaceCollection("feedbacks", demo.feedbacks.map((item) => ({ ...item })));
  });

  console.log("Banco de DEMONSTRAÇÃO criado em data/apoio.sqlite (dados fictícios).");
  console.log(`${demo.classes.length} turmas, ${demo.teachers.length} professoras, ${demo.students.length} alunos.`);
  console.log(`Contas de acesso (todas com a senha ${demo.DEMO_PASSWORD}):`);
  store.getAll("users").forEach((user) => {
    console.log(`  ${user.role === "admin" ? "Coordenação" : "Professora "} -> ${user.email}  (${user.name})`);
  });
  console.log("No primeiro login, o sistema obriga cada pessoa a criar uma senha nova.");
}

if (require.main === module) {
  const force = process.argv.includes("--force");
  const empty = process.argv.includes("--escola");
  // Apagar um banco existente SEMPRE exige --force escrito de proposito
  // (e com o sistema fechado - aberto, o Windows nao deixa apagar o arquivo).
  try {
    run({ force, empty });
    store.close();
  } catch (error) {
    console.error(`[ERRO] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { run };
