// Protecao contra requisicoes forjadas por outros sites (CSRF).
//
// O problema: enquanto a professora esta logada, qualquer pagina aberta em
// outra aba do navegador poderia tentar enviar um POST/PUT/DELETE para o
// sistema (ex: um formulario escondido), e o navegador mandaria junto o
// cookie de sessao.
//
// A defesa: navegadores modernos informam de onde veio cada requisicao
// (cabecalhos "Origin" e "Sec-Fetch-Site"). Para metodos que ALTERAM dados,
// so aceitamos requisicoes vindas do proprio sistema. Isso complementa o
// cookie SameSite=Lax (server/session.js) - duas barreiras independentes.
const UNSAFE_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * @param {import("http").IncomingMessage} req
 * @returns {boolean} true se a requisicao deve ser recusada
 */
function isCrossSiteWrite(req) {
  if (!UNSAFE_METHODS.has(req.method)) return false;

  // "same-origin" = veio do proprio sistema; "none" = digitado/favorito.
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;

  // Navegadores mais antigos sem Sec-Fetch-Site: compara Origin com Host.
  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(origin).host !== req.headers.host;
    } catch (error) {
      return true; // Origin malformado
    }
  }

  // Sem nenhum dos cabecalhos: nao e um navegador fazendo requisicao
  // entre sites (ex: um script local) - o cookie e a sessao continuam
  // sendo exigidos normalmente pelas rotas.
  return false;
}

module.exports = { isCrossSiteWrite };
