// Estrutura do banco SQLite (tabelas, regras e indices).
//
// Cada item de MIGRATIONS e uma "versao" do banco. O numero da versao atual
// fica gravado no proprio arquivo (PRAGMA user_version). Ao iniciar, o
// sistema aplica so as versoes que ainda faltam, em ordem, cada uma dentro de
// uma transacao (ou aplica inteira, ou nada). Assim uma atualizacao do
// sistema pode acrescentar tabelas/colunas SEM apagar os dados da escola.
//
// REGRA para mudancas futuras: nunca editar uma versao que ja foi
// publicada - sempre acrescentar uma nova no final da lista.
//
// __ANO_ATUAL__ e trocado pelo ano corrente quando a versao e aplicada
// (ver server/store.js): e o primeiro ano letivo do sistema.
//
// As regras abaixo sao a "ultima barreira": mesmo que alguma rota esqueca de
// conferir algo, o proprio banco recusa dados quebrados (e-mail repetido,
// aluno sem turma, turma com nivel invalido, registro apontando para algo
// que nao existe...).

const MIGRATIONS = [
  // ---- versao 1: estrutura inicial ---------------------------------------
  `
  -- Anos letivos. So um fica "ativo" por vez; os encerrados ficam para
  -- consulta (turmas e historico continuam guardados).
  CREATE TABLE school_years (
    year   INTEGER PRIMARY KEY CHECK (year BETWEEN 2000 AND 2100),
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado'))
  );
  CREATE UNIQUE INDEX idx_one_active_year ON school_years(status) WHERE status = 'ativo';
  INSERT INTO school_years (year, status) VALUES (__ANO_ATUAL__, 'ativo');

  -- Turmas. O nome nao se repete dentro do mesmo ano letivo.
  CREATE TABLE classes (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL CHECK (trim(name) <> ''),
    level       TEXT NOT NULL CHECK (level IN ('Pré I', 'Jardim')),
    school_year INTEGER NOT NULL DEFAULT __ANO_ATUAL__ REFERENCES school_years(year)
  );
  CREATE UNIQUE INDEX idx_class_name_per_year ON classes(school_year, name COLLATE NOCASE);

  CREATE TABLE teachers (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (trim(name) <> '')
  );

  -- Turmas de cada professora. Excluir a professora apaga os vinculos;
  -- excluir uma turma com professora vinculada e recusado.
  CREATE TABLE teacher_classes (
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id   TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    PRIMARY KEY (teacher_id, class_id)
  );
  CREATE INDEX idx_teacher_classes_class ON teacher_classes(class_id);

  -- Contas de acesso. Coordenacao (admin) nao tem professora ligada;
  -- toda conta de professora aponta para exatamente uma professora.
  CREATE TABLE users (
    id                   TEXT PRIMARY KEY,
    email                TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (email LIKE '%_@_%'),
    password_hash        TEXT NOT NULL CHECK (instr(password_hash, ':') > 0),
    must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
    password_changed_at  TEXT,
    role                 TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
    name                 TEXT NOT NULL CHECK (trim(name) <> ''),
    teacher_id           TEXT UNIQUE REFERENCES teachers(id) ON DELETE CASCADE,
    -- Foto de perfil, ja reduzida pelo navegador. Fica no proprio banco
    -- para entrar no backup. Limite ~200 KB.
    photo                TEXT CHECK (photo IS NULL OR (photo LIKE 'data:image/%' AND length(photo) <= 280000)),
    CHECK ((role = 'teacher') = (teacher_id IS NOT NULL))
  );

  CREATE TABLE bncc_goals (
    code  TEXT PRIMARY KEY,
    level TEXT NOT NULL CHECK (level IN ('Pré I', 'Jardim')),
    field TEXT NOT NULL,
    text  TEXT NOT NULL
  );

  -- Base de deficiencias. Listas (barreiras, estrategias...) ficam em JSON.
  CREATE TABLE needs (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL CHECK (trim(name) <> ''),
    source           TEXT NOT NULL DEFAULT '',
    summary          TEXT NOT NULL DEFAULT '',
    barriers         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(barriers) AND json_type(barriers) = 'array'),
    strategies       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(strategies) AND json_type(strategies) = 'array'),
    resources        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(resources) AND json_type(resources) = 'array'),
    activity_matches TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(activity_matches) AND json_type(activity_matches) = 'array'),
    custom           INTEGER NOT NULL DEFAULT 0 CHECK (custom IN (0, 1)),
    draft            INTEGER NOT NULL DEFAULT 0 CHECK (draft IN (0, 1))
  );

  -- Alunos. Excluir uma turma ou deficiencia com aluno ligado e recusado.
  -- Situacao: quem foi transferido, concluiu ou saiu some das telas do dia a
  -- dia, mas o historico continua guardado.
  CREATE TABLE students (
    id             TEXT PRIMARY KEY,
    full_name      TEXT NOT NULL CHECK (trim(full_name) <> ''),
    short_name     TEXT NOT NULL CHECK (trim(short_name) <> ''),
    age            INTEGER NOT NULL CHECK (age BETWEEN 0 AND 6),
    class_id       TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    disability     TEXT NOT NULL DEFAULT '',
    need_id        TEXT REFERENCES needs(id) ON DELETE RESTRICT,
    profile        TEXT NOT NULL DEFAULT '',
    strengths      TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(strengths) AND json_type(strengths) = 'array'),
    cautions       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(cautions) AND json_type(cautions) = 'array'),
    birth_date     TEXT NOT NULL DEFAULT '',
    guardian       TEXT NOT NULL DEFAULT '',
    phone          TEXT NOT NULL DEFAULT '',
    documents_note TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'transferido', 'concluiu', 'saiu')),
    status_date    TEXT,
    status_note    TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_students_class ON students(class_id);
  CREATE INDEX idx_students_need ON students(need_id);
  CREATE INDEX idx_students_status ON students(status);

  -- Em que turma o aluno esteve em cada ano (preenchido na virada de ano).
  CREATE TABLE student_enrollments (
    student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_year INTEGER NOT NULL REFERENCES school_years(year),
    class_id    TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    PRIMARY KEY (student_id, school_year)
  );

  -- Observacoes (uma por aluno / por deficiencia). Somem junto com o
  -- aluno ou a deficiencia.
  CREATE TABLE student_observations (
    student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    text       TEXT NOT NULL
  );
  CREATE TABLE need_observations (
    need_id TEXT PRIMARY KEY REFERENCES needs(id) ON DELETE CASCADE,
    text    TEXT NOT NULL
  );

  -- Atividade escolhida para um aluno. So pode existir UMA em andamento
  -- ("selecionada") por aluno de cada vez (indice unico parcial abaixo).
  CREATE TABLE assignments (
    id           TEXT PRIMARY KEY,
    student_id   TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id     TEXT,
    teacher_id   TEXT REFERENCES teachers(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL DEFAULT '',
    theme        TEXT NOT NULL DEFAULT '',
    goal_code    TEXT,
    activity     TEXT NOT NULL CHECK (json_valid(activity) AND json_type(activity) = 'object'),
    status       TEXT NOT NULL CHECK (status IN ('selecionada', 'concluida', 'parcial', 'nao_funcionou')),
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    resolved_at  TEXT,
    feedback_id  TEXT
  );
  CREATE INDEX idx_assignments_student ON assignments(student_id);
  CREATE UNIQUE INDEX idx_one_open_assignment ON assignments(student_id) WHERE status = 'selecionada';

  -- "Funcionou / nao funcionou". O historico continua mesmo se a professora
  -- for excluida (teacher_id vira NULL, o nome fica guardado).
  CREATE TABLE feedbacks (
    id             TEXT PRIMARY KEY,
    student_id     TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assignment_id  TEXT REFERENCES assignments(id) ON DELETE SET NULL,
    teacher_id     TEXT REFERENCES teachers(id) ON DELETE SET NULL,
    teacher_name   TEXT NOT NULL DEFAULT '',
    theme          TEXT NOT NULL DEFAULT '',
    activity_title TEXT NOT NULL CHECK (trim(activity_title) <> ''),
    result         TEXT NOT NULL CHECK (result IN ('Funcionou bem', 'Funcionou parcialmente', 'Não funcionou')),
    notes          TEXT NOT NULL DEFAULT '',
    date           TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_feedbacks_student ON feedbacks(student_id);

  -- Historico de alteracoes. Sem chave estrangeira de proposito: o registro
  -- de "quem fez" continua valendo mesmo depois de a pessoa ser excluida.
  CREATE TABLE audit_log (
    id         TEXT PRIMARY KEY,
    at         TEXT NOT NULL,
    actor_id   TEXT,
    actor_name TEXT NOT NULL DEFAULT '',
    actor_role TEXT,
    action     TEXT NOT NULL,
    entity     TEXT,
    entity_id  TEXT,
    details    TEXT NOT NULL DEFAULT ''
  );

  -- Configuracoes simples chave/valor (ex: configuracao da IA).
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `
];

module.exports = { MIGRATIONS, SCHEMA_VERSION: MIGRATIONS.length };
