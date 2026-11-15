// Camada de dados: SQLite (arquivo data/apoio.sqlite).
//
// O SQLite vem EMBUTIDO no Node (modulo "node:sqlite", Node 22.13 ou mais
// novo) - nada para instalar a parte, nenhum pacote do npm.
//
// Por que SQLite:
//   - cada alteracao grava so o que mudou, com garantia de "tudo ou nada"
//     (transacoes): uma queda de energia no meio nunca deixa o banco pela
//     metade;
//   - o proprio banco recusa dados quebrados (ver server/db/schema.js):
//     e-mail repetido, aluno sem turma, registro apontando para algo que
//     nao existe;
//   - aguenta varias pessoas usando ao mesmo tempo e permite backup com o
//     sistema rodando (backupTo).
//
// As rotas usam uma interface simples (getAll, getById, findBy, countBy,
// insert, update, remove, getMap, setMapValue); a traducao entre as linhas do banco e os
// objetos das rotas fica em server/db/collections.js.
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const config = require("./config");
const { makeId } = require("./util/id");
const { MIGRATIONS } = require("./db/schema");
const { MAPS, definitionOf, rowToRecord, recordToColumns, toColumn } = require("./db/collections");
const { translateDbError } = require("./db/errors");

let db = null;
let transactionDepth = 0;

/** Abre o banco (uma vez) e aplica as migracoes que faltarem. */
function load() {
  if (db) return db;
  config.ensureDataDir();
  db = new DatabaseSync(config.DB_PATH);
  // foreign_keys: liga as regras entre tabelas (desligadas por padrao no SQLite)
  // WAL: leituras nao esperam gravacoes e o arquivo resiste melhor a quedas
  // synchronous=FULL: cada transacao confirmada ja esta no disco
  // busy_timeout: se outro processo (ex: backup) estiver usando, espera ate 5s
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
  migrate();
  return db;
}

/** Aplica, em ordem, as versoes do schema que este arquivo ainda nao tem. */
function migrate() {
  const current = db.prepare("PRAGMA user_version").get().user_version;
  if (current >= MIGRATIONS.length) return;
  // Durante a migracao as regras entre tabelas ficam desligadas (o SQLite
  // exige isso para acrescentar colunas com referencia) e sao conferidas
  // por completo no fim: se algo ficou apontando para o vazio, desfaz tudo.
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    for (let version = current; version < MIGRATIONS.length; version++) {
      const sql = MIGRATIONS[version].replaceAll("__ANO_ATUAL__", String(new Date().getFullYear()));
      db.exec("BEGIN IMMEDIATE");
      try {
        db.exec(sql);
        const broken = db.prepare("PRAGMA foreign_key_check").all();
        if (broken.length) throw new Error(`${broken.length} registro(s) com referência quebrada`);
        db.exec(`PRAGMA user_version = ${version + 1}`);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw new Error(`Falha ao atualizar a estrutura do banco (versão ${version + 1}): ${error.message}`);
      }
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

/** Executa uma consulta traduzindo erros de regra para mensagens claras. */
function run(fn) {
  load();
  try {
    return fn();
  } catch (error) {
    throw translateDbError(error);
  }
}

/** Objeto "sem prototipo" do node:sqlite -> objeto comum. */
function plain(row) {
  return row ? { ...row } : null;
}

/**
 * Executa varias alteracoes como UMA so: se qualquer uma falhar, nenhuma
 * fica gravada. Pode ser chamada dentro de outra transacao (usa SAVEPOINT).
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function transaction(fn) {
  load();
  const savepoint = `sp_${transactionDepth}`;
  db.exec(transactionDepth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
  transactionDepth += 1;
  try {
    const result = fn();
    transactionDepth -= 1;
    db.exec(transactionDepth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
    return result;
  } catch (error) {
    transactionDepth -= 1;
    if (transactionDepth === 0) db.exec("ROLLBACK");
    else db.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
    throw translateDbError(error);
  }
}

// ---- turmas de cada professora (tabela teacher_classes) -----------------

function classIdsByTeacher() {
  const map = new Map();
  db.prepare("SELECT teacher_id, class_id FROM teacher_classes ORDER BY rowid").all().forEach((row) => {
    if (!map.has(row.teacher_id)) map.set(row.teacher_id, []);
    map.get(row.teacher_id).push(row.class_id);
  });
  return map;
}

function setTeacherClasses(teacherId, classIds) {
  db.prepare("DELETE FROM teacher_classes WHERE teacher_id = ?").run(teacherId);
  const insert = db.prepare("INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)");
  [...new Set((classIds || []).map(String))].forEach((classId) => insert.run(teacherId, classId));
}

function withClassIds(collection, records) {
  if (collection !== "teachers") return records;
  const byTeacher = classIdsByTeacher();
  return records.map((record) => ({ ...record, classIds: byTeacher.get(record.id) || [] }));
}

// ---- leitura -----------------------------------------------------------

/** Todos os registros, na ordem em que foram criados. */
function getAll(collection) {
  return run(() => {
    const definition = definitionOf(collection);
    const rows = db.prepare(`SELECT * FROM ${definition.table} ORDER BY rowid`).all();
    return withClassIds(collection, rows.map((row) => rowToRecord(definition, row)));
  });
}

function getById(collection, id) {
  return run(() => {
    const definition = definitionOf(collection);
    const row = db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.key} = ?`).get(id ?? null);
    if (!row) return null;
    return withClassIds(collection, [rowToRecord(definition, row)])[0];
  });
}

/**
 * Registros que atendem a todos os criterios, consultados no proprio banco
 * (usa os indices - ex: os registros de UM aluno, sem ler os da escola toda).
 * Um criterio com lista vira "coluna IN (...)".
 * @example findBy("feedbacks", { studentId: "joao", result: "Não funcionou" })
 * @example findBy("students", { classId: ["jardim-a", "pre-i-b"] })
 */
function findBy(collection, criteria) {
  return run(() => {
    const definition = definitionOf(collection);
    const where = [];
    const params = [];
    for (const [key, value] of Object.entries(criteria || {})) {
      const column = toColumn(key);
      if (!definition.columns.includes(column)) throw new Error(`Campo "${key}" não existe na tabela ${definition.table}.`);
      if (Array.isArray(value)) {
        if (!value.length) return []; // lista vazia: nenhum registro atende
        where.push(`${column} IN (${value.map(() => "?").join(", ")})`);
        params.push(...value);
      } else {
        where.push(`${column} = ?`);
        params.push(value ?? null);
      }
    }
    const sql = `SELECT * FROM ${definition.table}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY rowid`;
    const rows = db.prepare(sql).all(...params);
    return withClassIds(collection, rows.map((row) => rowToRecord(definition, row)));
  });
}

/**
 * Quantos registros existem para cada valor de um campo (contado pelo banco).
 * Com `values`, conta so esses valores (ex: os alunos de uma professora).
 * @example countBy("feedbacks", "studentId") -> Map { "joao" => 2, ... }
 * @example countBy("feedbacks", "studentId", ["joao", "livia"])
 */
function countBy(collection, key, values) {
  return run(() => {
    const definition = definitionOf(collection);
    const column = toColumn(key);
    if (!definition.columns.includes(column)) throw new Error(`Campo "${key}" não existe na tabela ${definition.table}.`);
    if (Array.isArray(values) && !values.length) return new Map();
    const where = Array.isArray(values) ? ` WHERE ${column} IN (${values.map(() => "?").join(", ")})` : "";
    const rows = db
      .prepare(`SELECT ${column} AS chave, COUNT(*) AS total FROM ${definition.table}${where} GROUP BY ${column}`)
      .all(...(Array.isArray(values) ? values : []));
    return new Map(rows.map((row) => [row.chave, row.total]));
  });
}

// ---- gravacao ----------------------------------------------------------

function insertRow(collection, record) {
  const definition = definitionOf(collection);
  const withId = definition.key === "id" ? { id: record.id || makeId(collection.slice(0, 3)), ...record } : { ...record };
  const values = recordToColumns(definition, withId);
  const columns = Object.keys(values);
  db.prepare(`INSERT INTO ${definition.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(
    ...columns.map((column) => values[column])
  );
  if (collection === "teachers") setTeacherClasses(withId.id, record.classIds);
  return withId[definition.key];
}

function insert(collection, record) {
  return transaction(() => getById(collection, insertRow(collection, record)));
}

/** Altera so os campos enviados. Devolve o registro atualizado (ou null). */
function update(collection, id, patch) {
  return transaction(() => {
    const definition = definitionOf(collection);
    if (!getById(collection, id)) return null;
    const { [definition.key]: ignored, ...rest } = patch || {};
    const values = recordToColumns(definition, rest);
    const columns = Object.keys(values);
    if (columns.length) {
      db.prepare(`UPDATE ${definition.table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE ${definition.key} = ?`).run(
        ...columns.map((column) => values[column]),
        id
      );
    }
    if (collection === "teachers" && Array.isArray(rest.classIds)) setTeacherClasses(id, rest.classIds);
    return getById(collection, id);
  });
}

/**
 * Exclui um registro. O que depende dele e tratado pelas regras do banco:
 * observacoes, atividades e registros de um aluno somem junto; uma turma
 * com alunos NAO pode ser excluida (erro 409).
 */
function remove(collection, id) {
  return transaction(() => {
    const definition = definitionOf(collection);
    return db.prepare(`DELETE FROM ${definition.table} WHERE ${definition.key} = ?`).run(id).changes > 0;
  });
}

/** Apaga os registros mais antigos, deixando so os `keep` mais recentes. */
function keepNewest(collection, keep) {
  return run(() => {
    const { table } = definitionOf(collection);
    db.prepare(`DELETE FROM ${table} WHERE rowid NOT IN (SELECT rowid FROM ${table} ORDER BY rowid DESC LIMIT ?)`).run(keep);
  });
}

/** Troca TODO o conteudo de uma colecao ou mapa (usado so pelo seed). */
function replaceCollection(name, records) {
  return transaction(() => {
    if (MAPS[name]) {
      const map = MAPS[name];
      clearMap(map);
      Object.entries(records || {}).forEach(([key, value]) => writeMapValue(map, key, value));
      return;
    }
    const { table } = definitionOf(name);
    db.prepare(`DELETE FROM ${table}`).run();
    (records || []).forEach((record) => insertRow(name, record));
  });
}

// ---- mapas chave -> valor (observacoes, configuracao da IA) -------------

function mapDefinition(mapName) {
  const map = MAPS[mapName];
  if (!map) throw new Error(`Mapa desconhecido no banco: ${mapName}`);
  return map;
}

function clearMap(map) {
  if (map.prefix) db.prepare(`DELETE FROM ${map.table} WHERE ${map.key} LIKE ?`).run(`${map.prefix}%`);
  else db.prepare(`DELETE FROM ${map.table}`).run();
}

function writeMapValue(map, key, value) {
  db.prepare(
    `INSERT INTO ${map.table} (${map.key}, ${map.value}) VALUES (?, ?) ON CONFLICT(${map.key}) DO UPDATE SET ${map.value} = excluded.${map.value}`
  ).run(`${map.prefix || ""}${key}`, String(value ?? ""));
}

/** Mapa inteiro como objeto { chave: valor }. */
function getMap(mapName) {
  return run(() => {
    const map = mapDefinition(mapName);
    const rows = map.prefix
      ? db.prepare(`SELECT ${map.key} AS k, ${map.value} AS v FROM ${map.table} WHERE ${map.key} LIKE ?`).all(`${map.prefix}%`)
      : db.prepare(`SELECT ${map.key} AS k, ${map.value} AS v FROM ${map.table}`).all();
    const result = {};
    rows.forEach((row) => {
      result[map.prefix ? row.k.slice(map.prefix.length) : row.k] = row.v;
    });
    return result;
  });
}

/** Grava um valor. Texto vazio apaga a entrada (ex: observacao apagada). */
function setMapValue(mapName, key, value) {
  return run(() => {
    const map = mapDefinition(mapName);
    if (value === "" || value == null) deleteMapValue(mapName, key);
    else writeMapValue(map, key, value);
    return getMap(mapName);
  });
}

function deleteMapValue(mapName, key) {
  return run(() => {
    const map = mapDefinition(mapName);
    db.prepare(`DELETE FROM ${map.table} WHERE ${map.key} = ?`).run(`${map.prefix || ""}${key}`);
  });
}

// ---- backup e encerramento -----------------------------------------------

/**
 * Copia o banco inteiro para outro arquivo, com o sistema rodando. A copia e
 * sempre consistente (o SQLite monta um retrato do banco num instante so).
 * @param {string} targetPath - arquivo de destino (nao pode existir)
 */
function backupTo(targetPath) {
  load();
  if (fs.existsSync(targetPath)) throw new Error(`O arquivo de backup já existe: ${targetPath}`);
  db.prepare("VACUUM INTO ?").run(targetPath);
}

/** Fecha o banco (usado pelo seed e pelos testes). */
function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  load,
  transaction,
  getAll,
  getById,
  findBy,
  countBy,
  insert,
  update,
  remove,
  keepNewest,
  replaceCollection,
  getMap,
  setMapValue,
  deleteMapValue,
  backupTo,
  close
};
