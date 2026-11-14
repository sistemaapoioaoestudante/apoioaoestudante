// Freio contra tentativas repetidas de senha.
//
// Dois contadores independentes:
//   - por e-mail: protege UMA conta de alguem tentando varias senhas nela;
//   - por IP: protege contra um aparelho testando muitas contas diferentes
//     (trocar de e-mail a cada tentativa nao escapa do bloqueio).
//
// Fica em memoria: reiniciar o servidor zera os contadores. Aceitavel para
// uma escola; os registros vencidos sao limpos sozinhos para o Map nao
// crescer sem limite.
const { HttpError } = require("../router");

const RULES = {
  email: { maxFailures: 5, windowMs: 15 * 60 * 1000, lockMs: 60 * 1000 },
  ip: { maxFailures: 20, windowMs: 15 * 60 * 1000, lockMs: 10 * 60 * 1000 }
};

// chave ("email:..." ou "ip:...") -> { failures, firstAt, lockedUntil }
const entries = new Map();

function cleanup(now) {
  for (const [key, entry] of entries) {
    const rule = RULES[key.split(":")[0]];
    const expired = now - entry.firstAt > rule.windowMs && entry.lockedUntil < now;
    if (expired) entries.delete(key);
  }
}

function keysFor(email, ip) {
  return [`email:${email}`, `ip:${ip}`];
}

/** Lanca 429 se o e-mail ou o IP estiverem bloqueados no momento. */
function assertNotLocked(email, ip) {
  const now = Date.now();
  cleanup(now);
  for (const key of keysFor(email, ip)) {
    const entry = entries.get(key);
    if (entry && entry.lockedUntil > now) {
      const seconds = Math.ceil((entry.lockedUntil - now) / 1000);
      throw new HttpError(429, `Muitas tentativas incorretas. Aguarde ${seconds}s antes de tentar de novo.`);
    }
  }
}

function registerFailure(email, ip) {
  const now = Date.now();
  for (const key of keysFor(email, ip)) {
    const rule = RULES[key.split(":")[0]];
    let entry = entries.get(key);
    if (!entry || now - entry.firstAt > rule.windowMs) {
      entry = { failures: 0, firstAt: now, lockedUntil: 0 };
    }
    entry.failures += 1;
    if (entry.failures >= rule.maxFailures) {
      entry.lockedUntil = now + rule.lockMs;
      entry.failures = 0;
      entry.firstAt = now;
    }
    entries.set(key, entry);
  }
}

/** Login certo: zera o contador do e-mail (o do IP so vence com o tempo). */
function registerSuccess(email) {
  entries.delete(`email:${email}`);
}

// O IP de quem pede vem de server/security/network.js (clientIp): so confia em
// X-Forwarded-For quando a conexao vem do proprio computador (Tailscale).
module.exports = { assertNotLocked, registerFailure, registerSuccess };
