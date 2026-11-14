// Vocabulario fixo usado no cadastro de aluno para "pontos fortes" e "cuidados".
// A coordenacao escolhe a partir desta lista (checkbox) em vez de digitar
// texto livre - assim o cadastro fica padronizado entre alunos e os termos
// chegam claros para a IA, que os usa para priorizar o que funciona com a
// crianca e evitar o que deve ser evitado.
const STRENGTH_TAGS = [
  "materiais táteis",
  "objetos reais",
  "atividades curtas",
  "histórias com imagens",
  "cartões de escolha",
  "rotina visual",
  "imitação de gestos",
  "pareamento de imagens",
  "contornos grossos",
  "desenho guiado",
  "apoio visual"
];

const CAUTION_TAGS = [
  "evitar texturas desconhecidas",
  "evitar perguntas longas",
  "evitar mudanças bruscas",
  "evitar sons altos",
  "evitar vídeos longos"
];

module.exports = { STRENGTH_TAGS, CAUTION_TAGS };
