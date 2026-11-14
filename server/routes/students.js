// Este arquivo concentra o controle de acesso a dados sensiveis do aluno:
// diferente do protótipo original (onde a separacao professora/coordenacao
// era so uma classe CSS escondendo campos no navegador), aqui os campos
// privados simplesmente NUNCA sao colocados no JSON de resposta quando quem
// pede e uma professora. Abrir o DevTools do navegador nao muda isso.
const store = require("../store");
const { sendJson, HttpError } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");
const { makeId } = require("../util/id");
const { getNeedForDisability } = require("../engine/needMatcher");
const { logAction } = require("../util/audit");
const { teacherOwnsStudent, visibleStudents } = require("../access/studentAccess");
const { assertActiveClass } = require("../access/schoolYear");
const { assertOwnPassword } = require("../security/confirmPassword");

// Situacoes possiveis do aluno na escola. So "ativo" aparece para a professora.
const STATUSES = ["ativo", "transferido", "concluiu", "saiu"];

const PRIVATE_FIELDS = ["fullName", "birthDate", "guardian", "phone", "documentsNote"];
const MIN_AGE = 0;
const MAX_AGE = 6; // publico do produto e Pre I / Jardim (~3 a 5 anos)

// Textos obrigatorios que nao podem chegar vazios, e o nome de cada um na
// mensagem de erro (a coordenacao le "Responsável", nao "guardian").
const REQUIRED_TEXT = ["fullName", "shortName", "disability", "profile", "birthDate", "guardian", "phone"];
const FIELD_LABELS = {
  fullName: "Nome completo",
  shortName: "Nome de exibição",
  age: "Idade",
  classId: "Turma",
  disability: "Deficiência",
  needId: "Deficiência / necessidade",
  profile: "Perfil pedagógico",
  strengths: "Pontos fortes",
  cautions: "Cuidados",
  birthDate: "Data de nascimento",
  guardian: "Responsável",
  phone: "Telefone de contato"
};

function serializeStudent(student, role, context = studentContext()) {
  const base = {
    id: student.id,
    shortName: student.shortName,
    age: student.age,
    classId: student.classId,
    disability: student.disability,
    needId: student.needId || null,
    profile: student.profile,
    strengths: student.strengths || [],
    cautions: student.cautions || [],
    // observacao pedagogica e contagem de feedbacks nao sao dados privados
    // (nao identificam a familia/documentos do aluno), entao vao para as
    // duas visoes - isso evita uma segunda chamada so para contar feedbacks.
    observation: context.observations[student.id] || "",
    feedbackCount: context.feedbackCounts.get(student.id) || 0,
    // Situacao na escola (ativo, transferido, concluiu, saiu)
    status: student.status || "ativo",
    statusDate: student.statusDate || null,
    statusNote: student.statusNote || ""
  };
  if (role === "admin") {
    PRIVATE_FIELDS.forEach((field) => {
      base[field] = student[field] || "";
    });
  }
  return base;
}

/**
 * Dados auxiliares lidos UMA vez para uma lista inteira de alunos (em vez
 * de duas consultas por aluno).
 */
function studentContext() {
  const feedbackCounts = new Map();
  store.getAll("feedbacks").forEach((item) => {
    feedbackCounts.set(item.studentId, (feedbackCounts.get(item.studentId) || 0) + 1);
  });
  return { observations: store.getMap("studentObservations"), feedbackCounts };
}

// As regras de quem pode ver qual aluno ficam em server/access/studentAccess.js.

function requireStudentPayload(body, { partial } = { partial: false }) {
  const errors = [];
  const fields = {};

  function need(key, transform = (v) => v) {
    if (body[key] === undefined) {
      if (!partial) errors.push(key);
      return;
    }
    fields[key] = transform(body[key]);
  }

  function optional(key, transform = (v) => v, fallback = "") {
    if (body[key] === undefined) {
      if (!partial) fields[key] = fallback;
      return;
    }
    fields[key] = transform(body[key]);
  }

  need("fullName", (v) => String(v).trim());
  need("shortName", (v) => String(v).trim());
  need("age", (v) => {
    const age = Number(v);
    if (!Number.isFinite(age) || age < MIN_AGE || age > MAX_AGE) {
      throw new HttpError(400, `Idade inválida: informe um número entre ${MIN_AGE} e ${MAX_AGE}.`);
    }
    return age;
  });
  need("classId", (v) => String(v));
  need("disability", (v) => String(v).trim());
  // needId é a referência de verdade usada pelo motor de recomendação -
  // exigida no cadastro (não só um texto livre de "deficiência") para que a
  // ligação aluno -> base de necessidades nunca dependa de nomes baterem.
  need("needId", (v) => {
    const id = String(v || "").trim();
    if (!id) throw new HttpError(400, "Selecione a deficiência/necessidade do aluno.");
    return id;
  });
  need("profile", (v) => String(v).trim());
  need("strengths", (v) => (Array.isArray(v) ? v.map(String) : String(v).split(",").map((s) => s.trim()).filter(Boolean)));
  need("cautions", (v) => (Array.isArray(v) ? v.map(String) : String(v).split(",").map((s) => s.trim()).filter(Boolean)));
  need("birthDate", (v) => String(v).trim());
  need("guardian", (v) => String(v).trim());
  need("phone", (v) => String(v).trim());
  // "Documentos/observacoes administrativas" e o unico campo pessoal que
  // pode legitimamente nao existir (nem toda crianca tem laudo ou observacao
  // administrativa) - por isso e opcional, diferente dos demais.
  optional("documentsNote", (v) => String(v).trim(), "");

  // Campo obrigatorio enviado VAZIO (ex: "" ou so espacos) tambem conta como
  // ausente.
  REQUIRED_TEXT.forEach((key) => {
    if (key in fields && !fields[key]) errors.push(key);
  });

  if (errors.length) {
    throw new HttpError(400, `Preencha os campos obrigatórios: ${errors.map((key) => FIELD_LABELS[key] || key).join(", ")}.`);
  }
  return fields;
}

function register(router) {
  router.get("/api/students", requireAuth, (req, res) => {
    const context = studentContext();
    const students = visibleStudents(req.user).map((student) => serializeStudent(student, req.user.role, context));
    sendJson(res, 200, { students });
  });

  router.get("/api/students/:id", requireAuth, (req, res) => {
    const student = store.getById("students", req.params.id);
    if (!student) throw new HttpError(404, "Aluno não encontrado.");
    if (!teacherOwnsStudent(req.user, student)) {
      throw new HttpError(403, "Este aluno não está em nenhuma das suas turmas.");
    }
    sendJson(res, 200, { student: serializeStudent(student, req.user.role) });
  });

  // Resumo pedagogico usado pelo "Atendimento rápido": perfil + necessidade +
  // observacao da professora + ultimos feedbacks. Nunca inclui dados privados,
  // mesmo para coordenacao, porque essa tela e sempre a visao pedagogica.
  router.get("/api/students/:id/summary", requireAuth, (req, res) => {
    const student = store.getById("students", req.params.id);
    if (!student) throw new HttpError(404, "Aluno não encontrado.");
    if (!teacherOwnsStudent(req.user, student)) {
      throw new HttpError(403, "Este aluno não está em nenhuma das suas turmas.");
    }
    const classInfo = store.getById("classes", student.classId);
    const need = getNeedForDisability(student, store.getAll("needs"));
    const observation = store.getMap("studentObservations")[student.id] || "";
    const history = store
      .getAll("feedbacks")
      .filter((item) => item.studentId === student.id);
    // O resumo mostra os 3 mais recentes; a tela tem "Ver histórico completo"
    // (GET /api/feedbacks?studentId=...), com todos os registros.
    const latest = history.slice(-3).reverse();

    sendJson(res, 200, {
      student: serializeStudent(student, "teacher"),
      classInfo,
      need,
      observation,
      history: latest,
      historyTotal: history.length
    });
  });

  router.post("/api/students", requireAuth, requireRole("admin"), (req, res) => {
    const fields = requireStudentPayload(req.body || {});
    assertActiveClass(fields.classId); // aluno novo so entra em turma do ano ativo
    if (fields.needId && !store.getById("needs", fields.needId)) throw new HttpError(400, "Deficiência/necessidade inválida.");
    const created = store.insert("students", { id: makeId("stu"), ...fields });
    logAction(req.user, "criar", "aluno", created.id, created.shortName);
    sendJson(res, 201, { student: serializeStudent(created, "admin") });
  });

  router.put("/api/students/:id", requireAuth, requireRole("admin"), (req, res) => {
    const existing = store.getById("students", req.params.id);
    if (!existing) throw new HttpError(404, "Aluno não encontrado.");
    const fields = requireStudentPayload(req.body || {}, { partial: true });
    if (fields.classId && fields.classId !== existing.classId) assertActiveClass(fields.classId);
    if (fields.needId && !store.getById("needs", fields.needId)) {
      throw new HttpError(400, "Deficiência/necessidade inválida.");
    }
    const updated = store.update("students", req.params.id, fields);
    logAction(req.user, "editar", "aluno", updated.id, updated.shortName);
    sendJson(res, 200, { student: serializeStudent(updated, "admin") });
  });

  router.delete("/api/students/:id", requireAuth, requireRole("admin"), (req, res) => {
    const existing = store.getById("students", req.params.id);
    if (!existing) throw new HttpError(404, "Aluno não encontrado.");
    // Exclusao DEFINITIVA so com o nome completo digitado (protege contra
    // clique por engano). No dia a dia, a coordenacao usa a "Situacao"
    // (transferido, concluiu, saiu), que guarda o historico. Excluir e para
    // cadastro feito por engano ou pedido de apagamento da familia (LGPD).
    const normalizeName = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
    if (normalizeName((req.body || {}).confirmName) !== normalizeName(existing.fullName)) {
      throw new HttpError(400, "Para excluir, digite o nome completo do aluno exatamente como está no cadastro.");
    }
    // E a senha de quem esta excluindo: garante que e a coordenacao, e nao
    // alguem que encontrou o sistema aberto. Senha errada conta como
    // tentativa de login (bloqueio apos varios erros, igual ao login).
    assertOwnPassword(req);
    // Registros, atividades e observacoes do aluno somem junto, numa unica
    // operacao (regra do banco: ON DELETE CASCADE - ver server/db/schema.js)
    store.remove("students", req.params.id);
    logAction(req.user, "excluir", "aluno", req.params.id, existing.shortName);
    sendJson(res, 200, { ok: true });
  });

  // Situacao do aluno na escola: transferido, concluiu ou saiu (ou volta a
  // ficar ativo). Em vez de excluir - assim o historico continua guardado.
  router.put("/api/students/:id/status", requireAuth, requireRole("admin"), (req, res) => {
    const existing = store.getById("students", req.params.id);
    if (!existing) throw new HttpError(404, "Aluno não encontrado.");
    const status = String((req.body || {}).status || "");
    if (!STATUSES.includes(status)) throw new HttpError(400, "Situação inválida.");
    if (status === "ativo") assertActiveClass(existing.classId); // voltar: so numa turma do ano ativo
    const note = String((req.body || {}).note || "").trim().slice(0, 300);
    const updated = store.update("students", req.params.id, {
      status,
      statusDate: status === "ativo" ? null : new Date().toISOString().slice(0, 10),
      statusNote: status === "ativo" ? "" : note
    });
    logAction(req.user, "situação", "aluno", updated.id, `${updated.shortName}: ${status}${note ? ` (${note})` : ""}`);
    sendJson(res, 200, { student: serializeStudent(updated, "admin") });
  });

  router.post("/api/students/:id/observation", requireAuth, (req, res) => {
    const existing = store.getById("students", req.params.id);
    if (!existing) throw new HttpError(404, "Aluno não encontrado.");
    if (!teacherOwnsStudent(req.user, existing)) {
      throw new HttpError(403, "Este aluno não está em nenhuma das suas turmas.");
    }
    // Limite de tamanho: a observacao tambem vai para a IA (texto muito longo
    // empurraria as instrucoes para fora do que o modelo consegue ler)
    const text = String((req.body || {}).text || "").trim().slice(0, 2000);
    store.setMapValue("studentObservations", req.params.id, text);
    sendJson(res, 200, { ok: true, observation: text });
  });
}

module.exports = { register, serializeStudent, teacherOwnsStudent };
