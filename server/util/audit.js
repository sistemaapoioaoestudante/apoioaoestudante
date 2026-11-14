// Trilha de auditoria simples: registra quem fez o que, e quando, em acoes
// administrativas (cadastro/edicao/exclusao de turma, professora e aluno,
// redefinicao de senha, criacao/remocao de deficiencia). Com varias pessoas
// usando o sistema, permite saber quem alterou o que.
const store = require("../store");
const { makeId } = require("./id");

// Limite de registros guardados. Cada login/logout tambem vira um registro:
// sem limite, o banco cresceria para sempre. A tela mostra so os 100
// ultimos; 5000 cobrem bem mais de um ano letivo.
const MAX_ENTRIES = 5000;

function logAction(user, action, entity, entityId, details) {
  try {
    store.insert("auditLog", {
      id: makeId("log"),
      at: new Date().toISOString(),
      actorId: user ? user.id : null,
      actorName: user ? user.name : "Sistema",
      actorRole: user ? user.role : null,
      action,
      entity,
      entityId: entityId || null,
      details: details || ""
    });
    store.keepNewest("auditLog", MAX_ENTRIES);
  } catch (error) {
    // Auditoria nunca deve derrubar a requisicao principal.
    console.error("Falha ao registrar auditoria:", error.message);
  }
}

module.exports = { logAction };
