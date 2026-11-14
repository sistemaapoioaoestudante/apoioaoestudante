// Liga um aluno ao registro certo da Base de deficiencias.
//
// Usado para montar o pedido a IA (barreiras, estrategias e recursos da
// deficiencia do aluno) e para o resumo pedagogico do Atendimento Rapido.

// Usado quando não há nenhuma correspondência (nem por needId, nem por
// nome). Assim uma deficiência não cadastrada nunca recebe, sem aviso,
// recomendações pensadas para outra.
const GENERIC_NEED = {
  id: "generico",
  name: "Perfil não mapeado",
  source: "Gerado automaticamente",
  summary: "Não foi encontrada uma correspondência exata na base de deficiências para este aluno. As sugestões da IA serão mais genéricas - vale revisar o cadastro do aluno ou completar a base de deficiências.",
  barriers: [],
  strategies: ["observação individual", "adaptação conforme o perfil observado da criança"],
  resources: [],
  activityMatches: [],
  custom: false
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos para comparar com folga
    .trim();
}

/**
 * Encontra o registro da base de necessidades para um aluno.
 * Preferência: student.needId (referência direta, definida no cadastro) -
 * assim a ligação não depende de o texto da deficiência bater com nada.
 * Sem needId (ex: "Em avaliação"), compara pelo nome contra TODAS as
 * necessidades cadastradas, inclusive as criadas pela própria escola.
 */
function getNeedForDisability(student, needs) {
  const list = needs || [];

  if (student.needId) {
    const byId = list.find((need) => need.id === student.needId);
    if (byId) return byId;
  }

  const normalizedDisability = normalize(student.disability);
  if (normalizedDisability) {
    const byName = list.find((need) => {
      const name = normalize(need.name);
      return name && (name === normalizedDisability || normalizedDisability.includes(name) || name.includes(normalizedDisability));
    });
    if (byName) return byName;
  }

  return GENERIC_NEED;
}

module.exports = { GENERIC_NEED, getNeedForDisability };
