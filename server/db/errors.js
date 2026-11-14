// Traduz os erros de regra do SQLite (e-mail repetido, registro ligado a
// outro, valor invalido) em respostas HTTP com mensagem em portugues.
//
// As rotas ja conferem quase tudo antes de gravar e dao mensagens mais
// especificas; isto aqui e a rede de seguranca para o que escapar - em vez
// de "Erro interno no servidor", a pessoa ve o que aconteceu.
const { HttpError } = require("../router");

const UNIQUE_MESSAGES = {
  "users.email": "Já existe uma conta com este e-mail.",
  "users.teacher_id": "Esta professora já tem uma conta de acesso.",
  "classes.school_year": "Já existe uma turma com esse nome neste ano letivo.",
  "school_years.year": "Esse ano letivo já existe.",
  "assignments.student_id": "Já existe uma atividade em andamento para este aluno. Registre o resultado ou cancele antes de selecionar outra."
};

/**
 * @param {Error} error - erro lancado pelo node:sqlite
 * @returns {Error} HttpError (regra violada) ou o proprio erro (falha real)
 */
function translateDbError(error) {
  if (!error || error.code !== "ERR_SQLITE_ERROR") return error;
  const message = String(error.message || "");

  if (message.startsWith("UNIQUE constraint failed")) {
    const target = message.split(":")[1]?.trim().split(",")[0];
    return new HttpError(409, UNIQUE_MESSAGES[target] || "Este registro já existe.");
  }
  if (message.startsWith("FOREIGN KEY constraint failed")) {
    return new HttpError(
      409,
      "Operação recusada: o registro está ligado a outros dados (ex: alunos ou professoras na turma) ou aponta para algo que não existe."
    );
  }
  if (message.startsWith("CHECK constraint failed") || message.startsWith("NOT NULL constraint failed")) {
    return new HttpError(400, "Dados inválidos: confira os campos obrigatórios e os valores informados.");
  }
  return error;
}

module.exports = { translateDbError };
