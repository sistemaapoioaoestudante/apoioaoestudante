// Cabecalhos de seguranca enviados em todas as respostas.
//
// - Content-Security-Policy: o navegador so executa scripts/estilos vindos do
//   proprio sistema (public/). Mesmo que algum texto malicioso escape do
//   esc() do front-end, um <script> injetado ou um onerror="..." nao roda.
// - X-Content-Type-Options: impede o navegador de "adivinhar" o tipo de um
//   arquivo (ex: tratar um JSON como HTML).
// - X-Frame-Options / frame-ancestors: impede outro site de abrir o sistema
//   escondido dentro de um <iframe> para enganar quem esta logado.
// - Referrer-Policy: nao vaza o endereco interno do sistema para links externos.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer"
};

function withSecurityHeaders(headers = {}) {
  return { ...SECURITY_HEADERS, ...headers };
}

module.exports = { SECURITY_HEADERS, withSecurityHeaders };
