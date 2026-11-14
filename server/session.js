// Sessoes de login simples, guardadas em memoria (Map). Isso significa que
// reiniciar o servidor derruba os logins ativos (a pessoa so precisa entrar
// de novo) - troca aceitavel para nao depender de um pacote externo de
// sessao/armazenamento. Se no futuro isso incomodar, e facil persistir esse
// Map numa tabela do banco SQLite (server/db/schema.js).
const crypto = require("crypto");

const SESSION_COOKIE = "apoio_estudante_sid";
// Dois prazos (computador e celulares compartilhados na escola):
//   - IDLE: sem usar o sistema por 2 horas, o login cai (uma sessao
//     esquecida aberta nao vale o dia todo);
//   - MAX: mesmo em uso, entra de novo depois de 12 horas.
const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
const SESSION_MAX_MS = 12 * 60 * 60 * 1000;
const SESSION_TTL_MS = SESSION_MAX_MS; // validade do cookie no navegador

const sessions = new Map();

/** Remove sessoes vencidas (mesmo as que ninguem voltou a usar). */
function pruneExpired(now) {
  for (const [id, session] of sessions) {
    if (session.expiresAt < now || session.maxAt < now) sessions.delete(id);
  }
}

function createSession(userId) {
  const now = Date.now();
  pruneExpired(now);
  const id = crypto.randomBytes(24).toString("hex");
  sessions.set(id, { userId, expiresAt: now + SESSION_IDLE_MS, maxAt: now + SESSION_MAX_MS });
  return id;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt < now || session.maxAt < now) {
    sessions.delete(sessionId);
    return null;
  }
  // Cada requisicao renova o prazo de inatividade (ate o limite de 12h).
  session.expiresAt = Math.min(now + SESSION_IDLE_MS, session.maxAt);
  return session;
}

function destroySession(sessionId) {
  sessions.delete(sessionId);
}

// Encerra todas as sessoes abertas de um usuario (ex: depois de trocar ou
// redefinir a senha - quem estava logado com a senha antiga em outro
// aparelho precisa entrar de novo). `exceptSessionId` preserva a sessao de
// quem acabou de trocar a propria senha.
function destroyUserSessions(userId, exceptSessionId = null) {
  for (const [id, session] of sessions) {
    if (session.userId === userId && id !== exceptSessionId) sessions.delete(id);
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((pair) => {
    const [key, ...rest] = pair.trim().split("=");
    if (!key) return;
    // Cookie malformado (ex: "%E0") nao pode quebrar a requisicao -
    // so e ignorado.
    try {
      cookies[key] = decodeURIComponent(rest.join("="));
    } catch (error) {
      /* ignora este cookie */
    }
  });
  return cookies;
}

/**
 * @param {boolean} [secure] - conexao HTTPS: o cookie so viaja criptografado
 *   (nunca por http aberto no Wi-Fi)
 */
function setSessionCookie(res, sessionId, secure = false) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? "; Secure" : ""}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

module.exports = {
  SESSION_COOKIE,
  createSession,
  getSession,
  destroySession,
  destroyUserSessions,
  parseCookies,
  setSessionCookie,
  clearSessionCookie
};
