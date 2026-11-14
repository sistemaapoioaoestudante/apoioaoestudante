// Acesso de outros aparelhos (celular, tablet, outros computadores) com
// seguranca. Tres modos, escolhidos no .env:
//
// 1) SO ESTE COMPUTADOR (padrao): HOST=127.0.0.1. Nada fica exposto na rede.
//
// 2) REDE PRIVADA - TAILSCALE (recomendado para "qualquer lugar"):
//      HOST=127.0.0.1 e TRUST_PROXY=1
//    O sistema continua fechado para a rede; o Tailscale ("tailscale serve")
//    recebe as conexoes JA CRIPTOGRAFADAS (HTTPS) dos aparelhos autorizados e
//    repassa para ca. Funciona na escola, em casa e no 4G. Ver
//    docs/acesso-remoto.md. TRUST_PROXY=1 faz o sistema confiar nos
//    cabecalhos que o Tailscale manda (IP real e "era HTTPS") - so quando a
//    conexao vem do proprio computador (127.0.0.1).
//
// 3) REDE DA ESCOLA COM HTTPS: HOST=0.0.0.0 + HTTPS_PFX (certificado)
//    O proprio sistema atende em HTTPS na rede local.
//
// Por seguranca, o sistema SE RECUSA a abrir para a rede (HOST diferente de
// 127.0.0.1) sem HTTPS: senhas e dados de criancas passariam abertos pelo
// Wi-Fi. (So com ALLOW_INSECURE_LAN=1, para testes.)
const fs = require("fs");
const config = require("../config");

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

function isLoopback(address) {
  return LOOPBACK.has(String(address || ""));
}

/** A requisicao veio do proprio computador (ex: do Tailscale)? */
function fromThisComputer(req) {
  return isLoopback(req.socket && req.socket.remoteAddress);
}

/** Confia nos cabecalhos do intermediario (Tailscale) para esta requisicao? */
function trustedProxy(req) {
  return config.TRUST_PROXY && fromThisComputer(req);
}

/** IP de quem fez a requisicao (o real, quando vem pelo Tailscale). */
function clientIp(req) {
  if (trustedProxy(req)) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return (req.socket && req.socket.remoteAddress) || "desconhecido";
}

/** A conexao do aparelho com o sistema e criptografada (HTTPS)? */
function isHttps(req) {
  if (req.socket && req.socket.encrypted) return true;
  return trustedProxy(req) && String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https";
}

/**
 * Opcoes de HTTPS direto (modo 3), ou null.
 * @returns {{ pfx: Buffer, passphrase: string } | null}
 */
function httpsOptions() {
  if (!config.HTTPS_PFX) return null;
  if (!fs.existsSync(config.HTTPS_PFX)) {
    throw new Error(`Certificado HTTPS não encontrado em ${config.HTTPS_PFX} (veja docs/acesso-remoto.md).`);
  }
  return { pfx: fs.readFileSync(config.HTTPS_PFX), passphrase: config.HTTPS_PFX_PASSWORD || "" };
}

/** Confere a configuracao antes de abrir: nunca expor sem HTTPS. */
function assertSafeNetworkConfig(hasHttps) {
  if (isLoopback(config.HOST) || hasHttps || config.ALLOW_INSECURE_LAN) return;
  throw new Error(
    `HOST=${config.HOST} abriria o sistema para a rede SEM HTTPS (senhas e dados das crianças passariam abertos). ` +
      "Use o Tailscale (HOST=127.0.0.1 + TRUST_PROXY=1) ou configure HTTPS_PFX. Veja docs/acesso-remoto.md."
  );
}

module.exports = { clientIp, isHttps, httpsOptions, assertSafeNetworkConfig, isLoopback };
