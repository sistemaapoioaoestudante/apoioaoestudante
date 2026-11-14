// Testes da camada de dados (SQLite): as regras do banco precisam segurar
// dados quebrados mesmo que alguma rota esqueca de conferir.
//
// Rodam num banco temporario (DATA_DIR) - nunca no banco da escola.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "apoio-store-"));
process.env.DATA_DIR = DATA_DIR;

const config = require("../server/config");
const seed = require("../server/seedData/seed");
const store = require("../server/store");

/** Espera um erro HTTP com o codigo indicado. */
function rejects(fn, statusCode) {
  assert.throws(fn, (error) => error.statusCode === statusCode, `esperava erro ${statusCode}`);
}

before(() => {
  const log = console.log;
  console.log = () => {}; // o seed imprime as contas de demonstracao
  try {
    seed.run();
  } finally {
    console.log = log;
  }
});

after(() => {
  store.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("o banco e criado com a base de demonstracao", () => {
  assert.ok(fs.existsSync(config.DB_PATH));
  assert.equal(store.getAll("classes").length, 5);
  assert.equal(store.getAll("students").length, 18);
  assert.ok(store.getAll("bnccGoals").length > 50);
  const teacher = store.getById("teachers", "ana");
  assert.deepEqual(teacher.classIds, ["jardim-a", "pre-i-b"]);
  const need = store.getById("needs", "tea-1");
  assert.ok(Array.isArray(need.strategies) && need.strategies.length > 0, "listas voltam como array");
  assert.equal(typeof store.getAll("users")[0].mustChangePassword, "boolean");
});

test("e-mail repetido e recusado, mesmo com maiusculas", () => {
  rejects(() => store.insert("users", { email: "PROFESSORA@escola.com", passwordHash: "a:b", role: "admin", name: "X", teacherId: null }), 409);
});

test("aluno sem turma valida, idade fora da faixa ou nome vazio e recusado", () => {
  const base = { fullName: "Teste", shortName: "T.", age: 4, classId: "pre-i-a", needId: "tdah", disability: "TDAH", strengths: [], cautions: [] };
  rejects(() => store.insert("students", { ...base, classId: "turma-que-nao-existe" }), 409);
  rejects(() => store.insert("students", { ...base, age: 9 }), 400);
  rejects(() => store.insert("students", { ...base, fullName: "   " }), 400);
  rejects(() => store.insert("classes", { name: "X", level: "Maternal" }), 400);
});

test("turma com alunos ou professora nao pode ser excluida", () => {
  rejects(() => store.remove("classes", "jardim-a"), 409);
  assert.ok(store.getById("classes", "jardim-a"));
});

test("excluir aluno apaga junto observacao, atividades e registros", () => {
  store.insert("assignments", {
    studentId: "joao",
    teacherName: "Ana Paula",
    activity: { title: "Teste" },
    status: "selecionada",
    createdAt: new Date().toISOString()
  });
  assert.ok(store.getMap("studentObservations").joao);
  assert.ok(store.getAll("feedbacks").some((item) => item.studentId === "joao"));
  assert.ok(store.remove("students", "joao"));
  assert.equal(store.getMap("studentObservations").joao, undefined);
  assert.ok(!store.getAll("feedbacks").some((item) => item.studentId === "joao"));
  assert.ok(!store.getAll("assignments").some((item) => item.studentId === "joao"));
});

test("excluir professora apaga a conta dela, mas mantem o historico de registros", () => {
  const feedbacksBefore = store.getAll("feedbacks").filter((item) => item.teacherName === "Marina Costa").length;
  assert.ok(feedbacksBefore > 0);
  store.remove("teachers", "marina");
  assert.ok(!store.getAll("users").some((user) => user.teacherId === "marina"));
  const kept = store.getAll("feedbacks").filter((item) => item.teacherName === "Marina Costa");
  assert.equal(kept.length, feedbacksBefore);
  assert.ok(kept.every((item) => item.teacherId === null));
});

test("so uma atividade em andamento por aluno", () => {
  const open = { studentId: "livia", teacherName: "X", activity: { title: "A" }, status: "selecionada", createdAt: new Date().toISOString() };
  store.insert("assignments", open);
  rejects(() => store.insert("assignments", { ...open, activity: { title: "B" } }), 409);
});

test("transacao: se uma parte falha, nada e gravado", () => {
  const before = store.getAll("classes").length;
  assert.throws(() =>
    store.transaction(() => {
      store.insert("classes", { name: "Turma Nova", level: "Jardim" });
      store.insert("classes", { name: "Turma Ruim", level: "Nivel invalido" });
    })
  );
  assert.equal(store.getAll("classes").length, before);
});

test("professora com turma inexistente e recusada", () => {
  rejects(() => store.insert("teachers", { name: "Nova", classIds: ["nao-existe"] }), 409);
  assert.ok(!store.getAll("teachers").some((t) => t.name === "Nova"));
});

test("campo desconhecido gera erro (evita perder dado por erro de digitacao)", () => {
  assert.throws(() => store.update("classes", "pre-i-c", { nome: "X" }), /não existe/);
});

test("historico guarda so os registros mais novos", () => {
  for (let i = 0; i < 5; i++) store.insert("auditLog", { at: new Date().toISOString(), action: `teste ${i}` });
  store.keepNewest("auditLog", 3);
  const log = store.getAll("auditLog");
  assert.equal(log.length, 3);
  assert.equal(log[2].action, "teste 4");
});

test("backup com o banco aberto gera um arquivo valido", () => {
  const target = path.join(DATA_DIR, "copia-teste.sqlite");
  store.backupTo(target);
  const { DatabaseSync } = require("node:sqlite");
  const copy = new DatabaseSync(target, { readOnly: true });
  assert.equal(copy.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.ok(copy.prepare("SELECT count(*) AS n FROM students").get().n > 0);
  copy.close();
});
