// Liga os nomes usados pelo resto do sistema ("students", "needs"...) as
// tabelas do SQLite, e converte cada linha do banco no objeto que as rotas
// ja conheciam (camelCase, listas como arrays, true/false).
//
// Assim as rotas continuam escrevendo `student.fullName` e
// `need.strategies` - so a camada de dados sabe que no banco isso e
// `full_name` e um texto JSON.

/** "fullName" -> "full_name" */
function toColumn(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** "full_name" -> "fullName" */
function toKey(column) {
  return column.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

// key: nome da chave primaria; json: colunas guardadas como JSON;
// bool: colunas 0/1 que viram true/false; columns: todas as colunas
// (qualquer outro campo e recusado - pega erro de digitacao no codigo).
const COLLECTIONS = {
  classes: { table: "classes", key: "id", columns: ["id", "name", "level", "school_year"] },
  schoolYears: { table: "school_years", key: "year", columns: ["year", "status"] },
  // Historico de turma por ano (chave composta: so insercao e leitura)
  studentEnrollments: { table: "student_enrollments", key: "student_id", columns: ["student_id", "school_year", "class_id"] },
  teachers: { table: "teachers", key: "id", columns: ["id", "name"], virtual: ["classIds"] },
  users: {
    table: "users",
    key: "id",
    columns: ["id", "email", "password_hash", "must_change_password", "password_changed_at", "role", "name", "teacher_id", "photo"],
    bool: ["must_change_password"]
  },
  bnccGoals: { table: "bncc_goals", key: "code", columns: ["code", "level", "field", "text"] },
  needs: {
    table: "needs",
    key: "id",
    columns: ["id", "name", "source", "summary", "barriers", "strategies", "resources", "activity_matches", "custom", "draft"],
    json: ["barriers", "strategies", "resources", "activity_matches"],
    bool: ["custom", "draft"]
  },
  students: {
    table: "students",
    key: "id",
    columns: ["id", "full_name", "short_name", "age", "class_id", "disability", "need_id", "profile", "strengths", "cautions", "birth_date", "guardian", "phone", "documents_note", "status", "status_date", "status_note"],
    json: ["strengths", "cautions"]
  },
  assignments: {
    table: "assignments",
    key: "id",
    columns: ["id", "student_id", "class_id", "teacher_id", "teacher_name", "theme", "goal_code", "activity", "status", "notes", "created_at", "resolved_at", "feedback_id"],
    json: ["activity"]
  },
  feedbacks: {
    table: "feedbacks",
    key: "id",
    columns: ["id", "student_id", "assignment_id", "teacher_id", "teacher_name", "theme", "activity_title", "result", "notes", "date"]
  },
  auditLog: {
    table: "audit_log",
    key: "id",
    columns: ["id", "at", "actor_id", "actor_name", "actor_role", "action", "entity", "entity_id", "details"]
  }
};

// "Mapas" chave -> valor (observacoes e configuracoes).
const MAPS = {
  studentObservations: { table: "student_observations", key: "student_id", value: "text" },
  needObservations: { table: "need_observations", key: "need_id", value: "text" },
  aiSettings: { table: "settings", key: "key", value: "value", prefix: "ai." },
  // Configuracoes da escola (ex: endereco de acesso das professoras)
  schoolSettings: { table: "settings", key: "key", value: "value", prefix: "school." }
};

function definitionOf(collection) {
  const definition = COLLECTIONS[collection];
  if (!definition) throw new Error(`Coleção desconhecida no banco: ${collection}`);
  return definition;
}

/** Linha do SQLite -> objeto usado pelas rotas. */
function rowToRecord(definition, row) {
  const record = {};
  for (const column of definition.columns) {
    let value = row[column];
    if (definition.json && definition.json.includes(column)) value = value == null ? null : JSON.parse(value);
    else if (definition.bool && definition.bool.includes(column)) value = Boolean(value);
    record[toKey(column)] = value;
  }
  return record;
}

/**
 * Objeto das rotas -> { coluna: valor } pronto para gravar.
 * Campos desconhecidos geram erro (melhor falhar alto do que perder dado).
 */
function recordToColumns(definition, record) {
  const values = {};
  for (const [key, raw] of Object.entries(record)) {
    if (definition.virtual && definition.virtual.includes(key)) continue;
    const column = toColumn(key);
    if (!definition.columns.includes(column)) {
      throw new Error(`Campo "${key}" não existe na tabela ${definition.table}.`);
    }
    let value = raw === undefined ? null : raw;
    if (definition.json && definition.json.includes(column)) value = value == null ? null : JSON.stringify(value);
    else if (definition.bool && definition.bool.includes(column)) value = value ? 1 : 0;
    else if (typeof value === "boolean") value = value ? 1 : 0;
    values[column] = value;
  }
  return values;
}

module.exports = { COLLECTIONS, MAPS, definitionOf, rowToRecord, recordToColumns, toColumn };
