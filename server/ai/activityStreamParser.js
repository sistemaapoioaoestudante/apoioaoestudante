// Separa as atividades ENQUANTO a IA ainda esta escrevendo.
//
// A IA escreve o texto { "atividades": [ {...}, {...}, {...} ] } aos poucos
// (cerca de 3 palavras por segundo neste computador). Em vez de esperar o
// texto inteiro, este leitor acompanha o que chega e, assim que uma
// atividade { ... } fecha, entrega ela pronta - a professora ve a 1a
// atividade cerca de 1 minuto antes das outras.
//
// Como funciona: percorre o texto caractere por caractere contando chaves
// { } (ignorando as que aparecem dentro de textos entre aspas). Dentro da
// lista de atividades, cada vez que a contagem volta a zero, um objeto
// terminou e e convertido com JSON.parse.

/**
 * @param {(activity: object) => void} onActivity - chamado a cada atividade completa
 * @returns {{ push: (text: string) => void }}
 */
function createActivityStreamParser(onActivity) {
  let buffer = ""; // todo o texto recebido ate agora
  let position = 0; // ate onde ja foi lido
  let insideList = false; // ja passou do "[" da lista de atividades?
  let depth = 0; // profundidade de chaves dentro da lista
  let objectStart = -1; // onde comecou a atividade atual
  let inString = false; // dentro de um texto entre aspas?
  let escaped = false; // caractere anterior foi uma barra invertida?

  function push(text) {
    buffer += text;

    // Ainda procurando o inicio da lista: "atividades": [
    if (!insideList) {
      const match = /"atividades"\s*:\s*\[/.exec(buffer);
      if (!match) return;
      insideList = true;
      position = match.index + match[0].length;
    }

    for (; position < buffer.length; position++) {
      const char = buffer[position];

      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        if (depth === 0) objectStart = position;
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0 && objectStart >= 0) {
          const raw = buffer.slice(objectStart, position + 1);
          objectStart = -1;
          try {
            onActivity(JSON.parse(raw));
          } catch (error) {
            // Objeto malformado: ignora - quem chama confere se vieram 3.
          }
        }
      }
    }
  }

  return { push };
}

module.exports = { createActivityStreamParser };
