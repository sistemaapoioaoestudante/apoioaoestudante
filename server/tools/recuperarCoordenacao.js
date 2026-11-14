// Recupera o acesso da coordenacao quando a senha foi esquecida.
//
// Usado pelo recuperar-acesso.bat, que so roda com permissao de
// ADMINISTRADOR do Windows: quem consegue isso ja controla o computador (e
// os dados), entao essa e a "prova" de que a pessoa pode recuperar o acesso.
// Nao depende de internet nem de e-mail.
//
// O que faz: mostra as contas da coordenacao, cria uma senha PROVISORIA
// para a escolhida (troca obrigatoria no proximo login) e registra no
// historico de alteracoes.
//
//   node server/tools/recuperarCoordenacao.js            (pergunta qual conta)
//   node server/tools/recuperarCoordenacao.js email@...  (conta direta)
const crypto = require("crypto");
const readline = require("readline");
const fs = require("fs");
const config = require("../config");
const store = require("../store");
const { hashPassword } = require("../util/hash");
const { makeId } = require("../util/id");

/** Senha provisoria facil de ler e digitar (sem 0/O, 1/l). */
function provisionalPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(10), (b) => letters[b % letters.length]).join("");
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function main() {
  if (!fs.existsSync(config.DB_PATH)) {
    console.error(`[ERRO] Banco não encontrado em ${config.DB_PATH}.`);
    process.exit(1);
  }
  const admins = store.getAll("users").filter((user) => user.role === "admin");
  if (!admins.length) {
    console.error("[ERRO] Nenhuma conta da coordenação encontrada.");
    process.exit(1);
  }

  console.log("Contas da coordenação cadastradas:");
  admins.forEach((user, index) => console.log(`  ${index + 1}) ${user.name}  -  login: ${user.email}`));
  console.log("");

  let target = null;
  const byArgument = process.argv[2];
  if (byArgument) {
    target = admins.find((user) => user.email.toLowerCase() === byArgument.toLowerCase());
  } else if (admins.length === 1) {
    const answer = await ask(`Criar uma senha provisória para ${admins[0].email}? (S/N): `);
    if (/^s/i.test(answer)) target = admins[0];
  } else {
    const answer = Number(await ask(`Digite o número da conta (1 a ${admins.length}) ou Enter para cancelar: `));
    target = admins[answer - 1] || null;
  }
  if (!target) {
    console.log("Nada foi alterado.");
    return;
  }

  const password = provisionalPassword();
  store.transaction(() => {
    store.update("users", target.id, { passwordHash: hashPassword(password), mustChangePassword: true });
    store.insert("auditLog", {
      id: makeId("log"),
      at: new Date().toISOString(),
      actorId: null,
      actorName: "Recuperação pelo Windows",
      actorRole: null,
      action: "recuperar acesso",
      entity: "coordenação",
      entityId: target.id,
      details: target.name
    });
  });
  store.close();

  console.log("");
  console.log("Pronto! Anote agora (não aparece de novo):");
  console.log(`  Login: ${target.email}`);
  console.log(`  Senha provisória: ${password}`);
  console.log("No próximo login, o sistema pede para criar uma senha nova.");
}

main().catch((error) => {
  console.error(`[ERRO] ${error.message}`);
  process.exit(1);
});
