// Testes automaticos da API: controle de acesso, protecoes de seguranca e
// validacao dos cadastros. Rodar com:  npm run testar
//
// Cada execucao cria um banco de DEMONSTRACAO numa pasta temporaria
// (variavel DATA_DIR) e sobe o servidor numa porta livre - o banco real da
// escola (data/apoio.sqlite) nunca e lido nem alterado.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "apoio-teste-"));
const NEW_PASSWORD = "SenhaDeTeste2026";
let server;
let base;
const cookies = {};

/** Porta livre qualquer. */
function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function request(method, url, { cookie = "", body, headers = {} } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: { cookie, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* nao era JSON */ }
  return { status: response.status, data, headers: response.headers };
}

/** Entra com a senha de demonstracao e troca pela senha de teste. */
async function loginAndChangePassword(email) {
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200, `login de ${email}`);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const blocked = await request("GET", "/api/students", { cookie });
  assert.equal(blocked.status, 403, "senha provisoria bloqueia o resto da API");
  const changed = await request("PUT", "/api/auth/password", { cookie, body: { currentPassword: "123456", newPassword: NEW_PASSWORD } });
  assert.equal(changed.status, 200, "troca de senha");
  return cookie;
}

before(async () => {
  const env = { ...process.env, DATA_DIR };
  const seed = spawnSync(process.execPath, ["server/seedData/seed.js"], { cwd: ROOT, env, encoding: "utf8" });
  assert.equal(seed.status, 0, seed.stderr);

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["server/index.js"], { cwd: ROOT, env: { ...env, PORT: String(port), AI_PROVIDER: "", UPDATE_CHECK: "0" }, stdio: "ignore" });
  // Espera o servidor subir (ate 20 s - num computador ocupado pode demorar)
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    try { up = (await fetch(base + "/")).ok; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  assert.ok(up, "o servidor de teste nao subiu");
  cookies.teacher = await loginAndChangePassword("professora@escola.com");
  cookies.admin = await loginAndChangePassword("coordenacao@escola.com");
});

after(async () => {
  // Espera o servidor fechar de verdade: no Windows o arquivo do banco fica
  // travado enquanto o processo estiver aberto e a pasta nao pode ser apagada.
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test("sem login, a API responde 401", async () => {
  for (const url of ["/api/students", "/api/teachers", "/api/feedbacks", "/api/audit", "/api/needs"]) {
    assert.equal((await request("GET", url)).status, 401, url);
  }
});

test("professora nao recebe dados pessoais dos alunos", async () => {
  const { data } = await request("GET", "/api/students", { cookie: cookies.teacher });
  assert.ok(data.students.length > 0);
  for (const student of data.students) {
    for (const field of ["fullName", "birthDate", "guardian", "phone", "documentsNote"]) {
      assert.ok(!(field in student), `campo ${field} vazou`);
    }
  }
});

test("professora nao acessa aluno de outra turma", async () => {
  // Turma nova, sem a professora de demonstracao, com um aluno
  const klass = (await request("POST", "/api/classes", { cookie: cookies.admin, body: { name: "Turma Isolada", level: "Jardim" } })).data.class;
  const needs = (await request("GET", "/api/needs", { cookie: cookies.admin })).data.needs;
  const created = await request("POST", "/api/students", {
    cookie: cookies.admin,
    body: { fullName: "Aluno Isolado", shortName: "Aluno I.", age: 5, classId: klass.id, disability: needs[0].name, needId: needs[0].id, profile: "Perfil", strengths: [], cautions: [], birthDate: "01/01/2021", guardian: "Resp", phone: "0000" }
  });
  assert.equal(created.status, 201);
  const mine = new Set((await request("GET", "/api/students", { cookie: cookies.teacher })).data.students.map((s) => s.id));
  const all = (await request("GET", "/api/students", { cookie: cookies.admin })).data.students;
  const other = all.find((s) => !mine.has(s.id));
  assert.ok(other, "o banco de demonstracao precisa ter aluno de outra turma");
  assert.equal((await request("GET", `/api/students/${other.id}/summary`, { cookie: cookies.teacher })).status, 403);
  assert.equal((await request("GET", `/api/feedbacks?studentId=${other.id}`, { cookie: cookies.teacher })).status, 403);
  assert.equal((await request("POST", `/api/students/${other.id}/observation`, { cookie: cookies.teacher, body: { text: "x" } })).status, 403);
});

test("professora nao usa rotas da coordenacao", async () => {
  assert.equal((await request("POST", "/api/classes", { cookie: cookies.teacher, body: { name: "X", level: "Jardim" } })).status, 403);
  assert.equal((await request("GET", "/api/audit", { cookie: cookies.teacher })).status, 403);
  assert.equal((await request("GET", "/api/ai/settings", { cookie: cookies.teacher })).status, 403);
});

test("bloqueia alteracao vinda de outro site (CSRF)", async () => {
  const body = { name: "Turma CSRF", level: "Jardim" };
  assert.equal((await request("POST", "/api/classes", { cookie: cookies.admin, body, headers: { Origin: "http://site-malicioso.example" } })).status, 403);
  assert.equal((await request("POST", "/api/classes", { cookie: cookies.admin, body, headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
});

test("robustez: cookie malformado, JSON invalido e caminho para fora de public/", async () => {
  assert.equal((await request("GET", "/api/auth/me", { cookie: "apoio_estudante_sid=%E0" })).status, 401);
  const bad = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{x" });
  assert.equal(bad.status, 400);
  assert.equal((await fetch(base + "/..%2f..%2fdata%2fapoio.sqlite")).status, 404);
  const home = await fetch(base + "/");
  assert.match(home.headers.get("content-security-policy"), /script-src 'self'/);
});

test("turma com nome so de espacos e recusada", async () => {
  assert.equal((await request("POST", "/api/classes", { cookie: cookies.admin, body: { name: "   ", level: "Jardim" } })).status, 400);
});

test("aluno com campos obrigatorios vazios e recusado", async () => {
  const classes = (await request("GET", "/api/classes", { cookie: cookies.admin })).data.classes;
  const needs = (await request("GET", "/api/needs", { cookie: cookies.admin })).data.needs;
  const response = await request("POST", "/api/students", {
    cookie: cookies.admin,
    body: { fullName: "", shortName: "", age: 4, classId: classes[0].id, disability: "x", needId: needs[0].id, profile: "", strengths: [], cautions: [], birthDate: "", guardian: "", phone: "" }
  });
  assert.equal(response.status, 400);
  assert.match(response.data.error, /Nome completo/);
});

test("editar professora com e-mail repetido nao altera nada", async () => {
  const created = await request("POST", "/api/teachers", {
    cookie: cookies.admin,
    body: { name: "Professora Teste", email: "teste@escola.com", password: "Provisoria2026", classIds: [] }
  });
  assert.equal(created.status, 201);
  const teachers = (await request("GET", "/api/teachers", { cookie: cookies.admin })).data.teachers;
  const target = teachers.find((t) => t.email === "teste@escola.com");
  const response = await request("PUT", `/api/teachers/${target.id}`, {
    cookie: cookies.admin,
    body: { name: "NOME ALTERADO", classIds: [], email: "professora@escola.com" }
  });
  assert.equal(response.status, 409);
  const after = (await request("GET", "/api/teachers", { cookie: cookies.admin })).data.teachers.find((t) => t.id === target.id);
  assert.equal(after.name, target.name);
  assert.deepEqual(after.classIds, target.classIds);
});

test("muitas senhas erradas bloqueiam o login", async () => {
  let locked = false;
  for (let i = 0; i < 6; i++) {
    const response = await request("POST", "/api/auth/login", { body: { email: "ninguem@escola.com", password: `errada${i}` } });
    if (response.status === 429) locked = true;
  }
  assert.ok(locked);
});

// ---- recursos novos: coordenacao, situacao do aluno, virada de ano --------

test("coordenacao nao gera atividades (so a professora, que aplica)", async () => {
  const response = await request("GET", "/api/activities?studentId=joao&goalCode=EI02EO01", { cookie: cookies.admin });
  assert.equal(response.status, 403);
});

test("contas da coordenacao: cria outra, redefine a outra, nunca a propria", async () => {
  const created = await request("POST", "/api/coordinators", {
    cookie: cookies.admin,
    body: { name: "Direção", email: "direcao@escola.com", password: "Provisoria2026" }
  });
  assert.equal(created.status, 201);
  const { coordinators } = (await request("GET", "/api/coordinators", { cookie: cookies.admin })).data;
  const me = coordinators.find((item) => item.isMe);
  const other = coordinators.find((item) => !item.isMe);
  assert.equal((await request("PUT", `/api/coordinators/${other.id}/password`, { cookie: cookies.admin, body: { password: "OutraSenha2026" } })).status, 200);
  assert.equal((await request("DELETE", `/api/coordinators/${me.id}`, { cookie: cookies.admin })).status, 400);
});

test("excluir professora ou outra conta da coordenacao exige a propria senha", async () => {
  const created = await request("POST", "/api/coordinators", {
    cookie: cookies.admin,
    body: { name: "Vice", email: "vice@escola.com", password: "Provisoria2026" }
  });
  assert.equal(created.status, 201);
  const other = (await request("GET", "/api/coordinators", { cookie: cookies.admin })).data.coordinators.find((item) => item.email === "vice@escola.com");
  const delOther = (body) => request("DELETE", `/api/coordinators/${other.id}`, { cookie: cookies.admin, body });
  assert.equal((await delOther({})).status, 400); // sem senha
  assert.equal((await delOther({ password: "errada" })).status, 400); // senha errada
  assert.equal((await delOther({ password: NEW_PASSWORD })).status, 200);

  const teacher = await request("POST", "/api/teachers", {
    cookie: cookies.admin,
    body: { name: "Professora Excluir", email: "excluir.prof@escola.com", password: "Provisoria2026", classIds: [] }
  });
  assert.equal(teacher.status, 201, JSON.stringify(teacher.data));
  const teacherId = teacher.data.teacher.id;
  const delTeacher = (body) => request("DELETE", `/api/teachers/${teacherId}`, { cookie: cookies.admin, body });
  assert.equal((await delTeacher({})).status, 400);
  assert.equal((await request("GET", "/api/teachers", { cookie: cookies.admin })).data.teachers.some((t) => t.id === teacherId), true);
  assert.equal((await delTeacher({ password: NEW_PASSWORD })).status, 200);
  assert.equal((await request("GET", "/api/coordinators", { cookie: cookies.teacher })).status, 403);
});

test("aluno transferido some para a professora, mas fica para a coordenacao", async () => {
  const mine = (await request("GET", "/api/students", { cookie: cookies.teacher })).data.students;
  const target = mine[0];
  const changed = await request("PUT", `/api/students/${target.id}/status`, { cookie: cookies.admin, body: { status: "transferido", note: "teste" } });
  assert.equal(changed.status, 200);
  const after = (await request("GET", "/api/students", { cookie: cookies.teacher })).data.students;
  assert.ok(!after.some((student) => student.id === target.id));
  assert.equal((await request("GET", `/api/students/${target.id}/summary`, { cookie: cookies.teacher })).status, 403);
  const admin = (await request("GET", "/api/students", { cookie: cookies.admin })).data.students;
  assert.equal(admin.find((student) => student.id === target.id).status, "transferido");
  await request("PUT", `/api/students/${target.id}/status`, { cookie: cookies.admin, body: { status: "ativo" } });
});

test("foto de perfil: aceita imagem pequena e recusa outro conteudo", async () => {
  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  assert.equal((await request("PUT", "/api/auth/photo", { cookie: cookies.teacher, body: { photo: tinyPng } })).status, 200);
  assert.equal((await request("PUT", "/api/auth/photo", { cookie: cookies.teacher, body: { photo: "data:text/html;base64,PHNjcmlwdD4=" } })).status, 400);
  const me = (await request("GET", "/api/auth/me", { cookie: cookies.teacher })).data.user;
  assert.equal(me.photo, tinyPng);
});

test("painel da coordenacao e historico com filtros", async () => {
  const dashboard = await request("GET", "/api/dashboard", { cookie: cookies.admin });
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.data.totals.students > 0);
  assert.equal((await request("GET", "/api/dashboard", { cookie: cookies.teacher })).status, 403);
  const audit = await request("GET", "/api/audit?acao=login", { cookie: cookies.admin });
  assert.ok(audit.data.entries.length > 0 && audit.data.entries.every((entry) => entry.action === "login"));
});

test("virada de ano: exige destino de todas as turmas e move/conclui os alunos", async () => {
  const { classes, activeYear } = (await request("GET", "/api/classes", { cookie: cookies.admin })).data;
  const current = classes.filter((klass) => klass.schoolYear === activeYear);
  const plan = current.map((klass) =>
    klass.level === "Jardim"
      ? { classId: klass.id, action: "move", toName: `${klass.name} novo`, toLevel: "Pré I" }
      : { classId: klass.id, action: "conclude" }
  );
  assert.equal((await request("POST", "/api/school-years/rollover", { cookie: cookies.admin, body: { toYear: activeYear + 1, plan: plan.slice(1) } })).status, 400);
  const done = await request("POST", "/api/school-years/rollover", { cookie: cookies.admin, body: { toYear: activeYear + 1, plan } });
  assert.equal(done.status, 200);
  const after = (await request("GET", "/api/classes", { cookie: cookies.admin })).data;
  assert.equal(after.activeYear, activeYear + 1);
  const students = (await request("GET", "/api/students", { cookie: cookies.admin })).data.students;
  assert.ok(students.some((student) => student.status === "concluiu"));
  // turma de ano encerrado nao recebe aluno novo
  const old = current[0];
  const needs = (await request("GET", "/api/needs", { cookie: cookies.admin })).data.needs;
  const refused = await request("POST", "/api/students", {
    cookie: cookies.admin,
    body: { fullName: "Novo", shortName: "N.", age: 4, classId: old.id, disability: needs[0].name, needId: needs[0].id, profile: "p", strengths: [], cautions: [], birthDate: "01/01/2022", guardian: "r", phone: "0" }
  });
  assert.equal(refused.status, 400);
});

test("endereco de acesso das professoras: so coordenacao e so https", async () => {
  assert.equal((await request("GET", "/api/access-info", { cookie: cookies.teacher })).status, 403);
  assert.equal((await request("PUT", "/api/access-info", { cookie: cookies.admin, body: { accessUrl: "http://inseguro.example" } })).status, 400);
  const saved = await request("PUT", "/api/access-info", { cookie: cookies.admin, body: { accessUrl: "https://apoio-escola.rede.ts.net/qualquer/caminho" } });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.accessUrl, "https://apoio-escola.rede.ts.net");
  assert.equal((await request("GET", "/api/access-info", { cookie: cookies.admin })).data.accessUrl, "https://apoio-escola.rede.ts.net");
});

test("atualizacao do sistema: so a coordenacao ve e pede; versao e publica", async () => {
  const version = await request("GET", "/api/version");
  assert.equal(version.status, 200);
  assert.equal(version.data.version, require("../package.json").version);
  assert.equal((await request("GET", "/api/updates")).status, 401);
  assert.equal((await request("GET", "/api/updates", { cookie: cookies.teacher })).status, 403);
  assert.equal((await request("POST", "/api/updates/install", { cookie: cookies.teacher, body: {} })).status, 403);
  const info = await request("GET", "/api/updates", { cookie: cookies.admin });
  assert.equal(info.status, 200);
  assert.equal(info.data.current, version.data.version);
  assert.equal(info.data.available, false, "sem conferir (UPDATE_CHECK=0), nao ha versao nova");
  // Sem versao nova, nada e instalado
  assert.equal((await request("POST", "/api/updates/install", { cookie: cookies.admin, body: {} })).status, 400);
});

test("troca de senha: obrigatoria sem a atual; voluntaria exige a atual", async () => {
  // Professora nova, com senha provisoria
  await request("POST", "/api/teachers", {
    cookie: cookies.admin,
    body: { name: "Professora Senha", email: "senha@escola.com", password: "Provisoria2026", classIds: [] }
  });
  const first = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "senha@escola.com", password: "Provisoria2026" }) });
  const cookie = first.headers.get("set-cookie").split(";")[0];
  // Nova igual a provisoria: recusada
  assert.equal((await request("PUT", "/api/auth/password", { cookie, body: { newPassword: "Provisoria2026" } })).status, 400);
  // Obrigatoria: so a senha nova basta
  assert.equal((await request("PUT", "/api/auth/password", { cookie, body: { newPassword: "MinhaSenha2026" } })).status, 200);
  // Voluntaria (ja nao e provisoria): sem a atual, recusada; com a atual, aceita
  assert.equal((await request("PUT", "/api/auth/password", { cookie, body: { newPassword: "OutraSenha2026" } })).status, 400);
  assert.equal((await request("PUT", "/api/auth/password", { cookie, body: { currentPassword: "errada", newPassword: "OutraSenha2026" } })).status, 400);
  assert.equal((await request("PUT", "/api/auth/password", { cookie, body: { currentPassword: "MinhaSenha2026", newPassword: "OutraSenha2026" } })).status, 200);
});

test("quem nao troca a senha provisoria continua bloqueado e o sistema pede de novo", async () => {
  await request("POST", "/api/teachers", {
    cookie: cookies.admin,
    body: { name: "Professora Adiou", email: "adiou@escola.com", password: "Provisoria2026", classIds: [] }
  });
  const loginOnce = async () => {
    const response = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "adiou@escola.com", password: "Provisoria2026" }) });
    return { cookie: response.headers.get("set-cookie").split(";")[0], user: (await response.json()).user };
  };
  // 1o login: senha provisoria; ela NAO troca e tenta usar o sistema
  const first = await loginOnce();
  assert.equal(first.user.mustChangePassword, true);
  const blocked = await request("GET", "/api/students", { cookie: first.cookie });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, "PASSWORD_CHANGE_REQUIRED");
  // Recarregar a pagina (/api/auth/me) continua avisando a troca pendente
  assert.equal((await request("GET", "/api/auth/me", { cookie: first.cookie })).data.user.mustChangePassword, true);
  // Sai e entra de novo outro dia: continua exigindo a troca
  await request("POST", "/api/auth/logout", { cookie: first.cookie });
  const second = await loginOnce();
  assert.equal(second.user.mustChangePassword, true);
  assert.equal((await request("GET", "/api/students", { cookie: second.cookie })).status, 403);
});

test("excluir aluno exige o nome completo e a senha da coordenacao", async () => {
  const { classes, activeYear } = (await request("GET", "/api/classes", { cookie: cookies.admin })).data;
  const klass = classes.find((item) => item.schoolYear === activeYear);
  const needs = (await request("GET", "/api/needs", { cookie: cookies.admin })).data.needs;
  const created = await request("POST", "/api/students", {
    cookie: cookies.admin,
    body: { fullName: "Aluno Para Excluir", shortName: "Excluir", age: 4, classId: klass.id, disability: needs[0].name, needId: needs[0].id, profile: "p", strengths: [], cautions: [], birthDate: "01/01/2022", guardian: "r", phone: "0" }
  });
  assert.equal(created.status, 201);
  const id = created.data.student.id;
  const del = (body) => request("DELETE", `/api/students/${id}`, { cookie: cookies.admin, body });
  assert.equal((await del({})).status, 400); // sem nada
  assert.equal((await del({ confirmName: "Outro Nome", password: NEW_PASSWORD })).status, 400); // nome errado
  assert.equal((await del({ confirmName: "aluno para excluir", password: "errada" })).status, 400); // senha errada
  assert.equal((await request("GET", "/api/students", { cookie: cookies.admin })).data.students.some((s) => s.id === id), true);
  assert.equal((await del({ confirmName: "  aluno  para excluir ", password: NEW_PASSWORD })).status, 200); // certo (sem diferenca de maiusculas/espacos)
  assert.equal((await request("GET", "/api/students", { cookie: cookies.admin })).data.students.some((s) => s.id === id), false);
});
