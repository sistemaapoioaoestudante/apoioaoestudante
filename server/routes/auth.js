const store = require("../store");
const { verifyPassword, hashPassword } = require("../util/hash");
const { validateNewPassword } = require("../util/passwordPolicy");
const {
  createSession,
  destroySession,
  destroyUserSessions,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE
} = require("../session");
const { sendJson, HttpError } = require("../router");
const { requireAuth } = require("../middleware/auth");
const { logAction } = require("../util/audit");
const loginThrottle = require("../security/loginThrottle");
const { isHttps, clientIp } = require("../security/network");

// Hash "de mentira" usado quando o e-mail nao existe: o tempo de resposta
// fica igual ao de uma senha errada, para nao dar pista de quais e-mails
// tem conta no sistema.
const DUMMY_HASH = hashPassword("senha-inexistente-para-igualar-tempo");

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    teacherId: user.teacherId,
    // true = senha provisoria; o front-end abre a tela de troca obrigatoria.
    mustChangePassword: Boolean(user.mustChangePassword),
    photo: user.photo || null // foto de perfil (data:image/...) ou null
  };
}

// Foto de perfil: o navegador ja reduz a imagem (ver public/js/profilePhoto.js);
// aqui so aceitamos imagem pequena dos formatos comuns.
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const PHOTO_MAX_LENGTH = 280000; // ~200 KB

function register(router) {
  router.put("/api/auth/photo", requireAuth, (req, res) => {
    const photo = String((req.body || {}).photo || "");
    if (!PHOTO_PATTERN.test(photo)) throw new HttpError(400, "Envie uma imagem JPG, PNG ou WEBP.");
    if (photo.length > PHOTO_MAX_LENGTH) throw new HttpError(400, "A foto ficou grande demais. Escolha outra imagem.");
    const updated = store.update("users", req.user.id, { photo });
    sendJson(res, 200, { user: publicUser(updated) });
  });

  router.delete("/api/auth/photo", requireAuth, (req, res) => {
    const updated = store.update("users", req.user.id, { photo: null });
    sendJson(res, 200, { user: publicUser(updated) });
  });

  router.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new HttpError(400, "Informe usuário e senha.");
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const ip = clientIp(req); // IP real, mesmo vindo pelo Tailscale
    loginThrottle.assertNotLocked(normalizedEmail, ip);

    const user = store.getAll("users").find((item) => item.email.toLowerCase() === normalizedEmail);
    const passwordOk = verifyPassword(String(password), user ? user.passwordHash : DUMMY_HASH);
    if (!user || !passwordOk) {
      loginThrottle.registerFailure(normalizedEmail, ip);
      throw new HttpError(401, "Usuário ou senha inválidos.");
    }
    loginThrottle.registerSuccess(normalizedEmail);
    const sessionId = createSession(user.id);
    setSessionCookie(res, sessionId, isHttps(req));
    logAction(user, "login", "sessão", user.id, null);
    sendJson(res, 200, { user: publicUser(user) });
  });

  router.post("/api/auth/logout", (req, res) => {
    const cookies = req.cookies || {};
    if (cookies[SESSION_COOKIE]) destroySession(cookies[SESSION_COOKIE]);
    if (req.user) logAction(req.user, "logout", "sessão", req.user.id, null);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
  });

  router.get("/api/auth/me", requireAuth, (req, res) => {
    sendJson(res, 200, { user: publicUser(req.user) });
  });

  // Troca da propria senha (qualquer pessoa logada). Exige a senha atual,
  // para que alguem que encontre um computador com a sessao aberta nao
  // consiga tomar a conta. Depois da troca, as sessoes abertas em outros
  // aparelhos sao encerradas; a sessao atual continua valendo.
  router.put("/api/auth/password", requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    // Troca OBRIGATORIA (senha provisoria, logo apos o login): a pessoa
    // acabou de digitar a provisoria para entrar, entao nao pedimos de novo.
    // Na troca VOLUNTARIA a senha atual continua obrigatoria: protege quem
    // deixou o sistema aberto num aparelho de alguem tomar a conta.
    const provisional = Boolean(req.user.mustChangePassword);
    if (!newPassword || (!provisional && !currentPassword)) {
      throw new HttpError(400, provisional ? "Informe a senha nova." : "Informe a senha atual e a senha nova.");
    }
    if (!provisional && !verifyPassword(String(currentPassword), req.user.passwordHash)) {
      throw new HttpError(400, "A senha atual está incorreta.");
    }
    // A nova nunca pode ser igual a atual (inclusive a provisoria)
    if (verifyPassword(String(newPassword), req.user.passwordHash)) {
      throw new HttpError(400, "A senha nova precisa ser diferente da atual.");
    }
    const policyError = validateNewPassword(newPassword);
    if (policyError) throw new HttpError(400, policyError);

    const updated = store.update("users", req.user.id, {
      passwordHash: hashPassword(String(newPassword)),
      mustChangePassword: false,
      passwordChangedAt: new Date().toISOString()
    });
    destroyUserSessions(req.user.id, req.cookies[SESSION_COOKIE]);
    logAction(req.user, "trocar senha", "sessão", req.user.id, null);
    sendJson(res, 200, { user: publicUser(updated) });
  });
}

module.exports = { register, publicUser };
