// Dados de DEMONSTRACAO (todos ficticios) - usados por "npm run seed" e
// "npm run reset-db" para treinar a equipe e testar o sistema.
//
// Nada aqui e de crianca real: nomes inventados, responsavel "ficticio" e
// telefone (00) 00000-0000. Para uso real, comece com "npm run iniciar-escola"
// (banco vazio) - ver README.
//
// Base montada para cobrir as situacoes do dia a dia:
//   - 5 turmas (2 de Jardim, 3 de Pre I);
//   - 7 professoras, incluindo quem atende 2 turmas e quem ainda nao tem
//     turma (para testar o acesso e o aviso de turma sem professora);
//   - 18 alunos, com TODAS as deficiencias da base representadas;
//   - observacoes e registros de atividades em alguns alunos, para as telas
//     de historico ja terem conteudo.
//
// Idades: a BNCC usa EI02 (ate 3 anos e 11 meses) no Jardim e EI03 (4 a 5
// anos e 11 meses) no Pre I - por isso Jardim tem alunos de 3 anos e Pre I
// de 4 e 5.
const { hashPassword } = require("../util/hash");

const DEMO_PASSWORD = "123456"; // obrigatorio trocar no 1o login
const FAKE_PHONE = "(00) 00000-0000";
const FAKE_GUARDIAN = "Responsável fictício";

const classes = [
  { id: "jardim-a", name: "Jardim A", level: "Jardim" },
  { id: "jardim-b", name: "Jardim B", level: "Jardim" },
  { id: "pre-i-a", name: "Pré I A", level: "Pré I" },
  { id: "pre-i-b", name: "Pré I B", level: "Pré I" },
  { id: "pre-i-c", name: "Pré I C", level: "Pré I" }
];

// email: login de cada professora (todas com a senha de demonstracao)
const teachers = [
  { id: "ana", name: "Ana Paula", classIds: ["jardim-a", "pre-i-b"], email: "professora@escola.com" },
  { id: "carla", name: "Carla Mendes", classIds: ["jardim-a"], email: "carla@escola.com" },
  { id: "beatriz", name: "Beatriz Oliveira", classIds: ["jardim-b"], email: "beatriz@escola.com" },
  { id: "denise", name: "Denise Ferreira", classIds: ["pre-i-a"], email: "denise@escola.com" },
  { id: "marina", name: "Marina Costa", classIds: ["pre-i-b"], email: "marina@escola.com" },
  // Professora de apoio (AEE): acompanha duas turmas
  { id: "fernanda", name: "Fernanda Lopes", classIds: ["pre-i-a", "pre-i-c"], email: "fernanda@escola.com" },
  // Recem-contratada, ainda sem turma: entra no sistema mas nao ve alunos
  { id: "gabriela", name: "Gabriela Nunes", classIds: [], email: "gabriela@escola.com" }
];

/** Monta um aluno ficticio com os campos que todo cadastro precisa. */
function student(id, fullName, shortName, age, birthDate, classId, needId, disability, profile, strengths, cautions, documentsNote = "") {
  return {
    id,
    fullName,
    shortName,
    age,
    classId,
    disability,
    needId,
    profile,
    strengths,
    cautions,
    birthDate,
    guardian: FAKE_GUARDIAN,
    phone: FAKE_PHONE,
    documentsNote
  };
}

const students = [
  // ---- Jardim A (3 anos) ----
  student("joao", "João Miguel Alves", "João M.", 3, "14/05/2023", "jardim-a", "tea-1", "TEA nível 1",
    "Prefere apoio visual, atividades curtas e previsíveis.",
    ["desenho guiado", "pareamento de imagens", "rotina visual"],
    ["evitar sons altos", "evitar vídeos longos", "evitar mudanças bruscas"],
    "Laudo e ficha administrativa disponíveis para a coordenação"),
  student("mateus", "Mateus Ribeiro Lima", "Mateus R.", 3, "02/02/2023", "jardim-a", "atraso-fala", "Atraso na fala/linguagem",
    "Participa melhor com imagens, escolhas simples e tempo extra para responder (a professora não completa a resposta por ele).",
    ["cartões de escolha", "histórias com imagens", "imitação de gestos"],
    ["evitar perguntas longas"],
    "Observações fonoaudiológicas restritas à coordenação"),
  student("helena", "Helena Martins Prado", "Helena M.", 3, "30/07/2023", "jardim-a", "sindrome-down", "Síndrome de Down",
    "Gosta de música e de imitar gestos; aprende melhor com repetição e demonstração.",
    ["imitação de gestos", "objetos reais", "atividades curtas"],
    ["evitar mudanças bruscas"]),
  student("davi", "Davi Henrique Souza", "Davi H.", 3, "11/10/2023", "jardim-a", "tdah", "TDAH",
    "Muita energia no início da manhã; rende mais com tarefas curtas e movimento entre elas.",
    ["atividades curtas", "materiais táteis"],
    ["evitar vídeos longos"]),

  // ---- Jardim B (3 anos) ----
  student("alice", "Alice Ferreira Gomes", "Alice F.", 3, "05/03/2023", "jardim-b", "deficiencia-auditiva", "Deficiência auditiva",
    "Usa aparelho auditivo; acompanha melhor olhando para o rosto de quem fala e com apoio visual.",
    ["apoio visual", "cartões de escolha", "imitação de gestos"],
    ["evitar sons altos"],
    "Audiometria recente na pasta da coordenação"),
  student("bernardo", "Bernardo Lima Castro", "Bernardo L.", 3, "19/09/2023", "jardim-b", "deficiencia-motora", "Deficiência física/motora",
    "Usa cadeira adaptada; precisa de materiais grandes e fáceis de pegar, com mesa na altura certa.",
    ["objetos reais", "materiais táteis", "contornos grossos"],
    ["evitar texturas desconhecidas"],
    "Relatório de fisioterapia disponível para a coordenação"),
  student("cecilia", "Cecília Duarte Reis", "Cecília D.", 3, "23/12/2023", "jardim-b", "tea-2", "TEA nível 2",
    "Comunicação principalmente por gestos e figuras; precisa de rotina bem marcada e avisos antes das transições.",
    ["rotina visual", "pareamento de imagens", "cartões de escolha"],
    ["evitar sons altos", "evitar mudanças bruscas", "evitar texturas desconhecidas"]),

  // ---- Pré I A (4 a 5 anos) ----
  student("enzo", "Enzo Gabriel Rocha", "Enzo G.", 4, "08/04/2022", "pre-i-a", "tea-1", "TEA nível 1",
    "Interesse intenso por dinossauros; usar o tema ajuda a manter a atenção.",
    ["histórias com imagens", "rotina visual", "apoio visual"],
    ["evitar sons altos"]),
  student("isabela", "Isabela Nogueira Pinto", "Isabela N.", 5, "17/01/2021", "pre-i-a", "baixa-visao", "Baixa visão",
    "Senta perto da lousa; responde bem a alto contraste e letras grandes.",
    ["contornos grossos", "materiais táteis", "objetos reais"],
    [],
    "Relatório oftalmológico disponível para a coordenação"),
  student("lucas", "Lucas Andrade Silva", "Lucas A.", 4, "29/06/2022", "pre-i-a", "tdah", "TDAH",
    "Precisa de pausas curtas e de uma tarefa por vez, com começo, meio e fim visíveis.",
    ["atividades curtas", "rotina visual"],
    ["evitar perguntas longas", "evitar vídeos longos"]),
  student("manuela", "Manuela Costa Ramos", "Manuela C.", 5, "03/11/2021", "pre-i-a", "atraso-fala", "Atraso na fala/linguagem",
    "Entende bem, mas fala pouco; usa cartões para escolher e responder.",
    ["cartões de escolha", "histórias com imagens"],
    ["evitar perguntas longas"]),

  // ---- Pré I B (4 a 5 anos) ----
  student("livia", "Lívia Santos Rocha", "Lívia S.", 5, "21/08/2021", "pre-i-b", "baixa-visao", "Baixa visão",
    "Responde bem a alto contraste, objetos concretos, letras grandes e descrição verbal à distância.",
    ["materiais táteis", "contornos grossos", "objetos reais"],
    [],
    "Relatório oftalmológico disponível para a coordenação"),
  student("miguel", "Miguel Barbosa Teixeira", "Miguel B.", 4, "12/02/2022", "pre-i-b", "sindrome-down", "Síndrome de Down",
    "Muito sociável; aprende com músicas, gestos e objetos concretos.",
    ["imitação de gestos", "objetos reais", "materiais táteis"],
    []),
  student("sofia", "Sofia Almeida Cardoso", "Sofia A.", 4, "25/05/2022", "pre-i-b", "deficiencia-auditiva", "Deficiência auditiva",
    "Usa alguns sinais de Libras; precisa ver o rosto de quem fala e de instruções com imagens.",
    ["apoio visual", "imitação de gestos", "pareamento de imagens"],
    ["evitar sons altos"]),

  // ---- Pré I C (4 a 5 anos) ----
  student("theo", "Théo Martins Freitas", "Théo M.", 5, "14/03/2021", "pre-i-c", "tea-2", "TEA nível 2",
    "Fica mais tranquilo com fones abafadores e um cantinho calmo; aceita bem atividades de encaixe.",
    ["pareamento de imagens", "materiais táteis", "rotina visual"],
    ["evitar sons altos", "evitar mudanças bruscas"],
    "Laudo na pasta da coordenação"),
  student("valentina", "Valentina Pereira Moura", "Valentina P.", 4, "07/09/2022", "pre-i-c", "deficiencia-motora", "Deficiência física/motora",
    "Pouca força nas mãos; usa lápis engrossado e prefere peças grandes.",
    ["contornos grossos", "objetos reais", "desenho guiado"],
    []),
  student("rafael", "Rafael Moreira Dias", "Rafael M.", 5, "18/12/2021", "pre-i-c", "tdah", "TDAH",
    "Gosta de ser ajudante da professora; tarefas com movimento funcionam melhor.",
    ["atividades curtas", "materiais táteis", "imitação de gestos"],
    ["evitar vídeos longos"]),
  // Cadastro sem deficiência ligada à base: mostra o aviso de
  // "perfil não mapeado" e serve para treinar a edição do cadastro.
  student("yasmin", "Yasmin Carvalho Lopes", "Yasmin C.", 4, "01/10/2022", "pre-i-c", null, "Em avaliação",
    "Em avaliação pela equipe; observar e registrar o que funciona.",
    ["apoio visual"],
    [])
];

// Observacoes das professoras (aparecem no perfil do aluno)
const studentObservations = {
  joao: "Aceita melhor atividades com começo, meio e fim visíveis. Avisar antes de trocar de atividade.",
  livia: "Rende mais sentada na primeira fileira, perto da janela (luz natural).",
  theo: "Nos dias de chuva fica mais agitado com o barulho; o cantinho calmo ajuda."
};

// Registros de atividades ja aplicadas (historico do aluno)
const feedbacks = [
  { id: "fb-demo-1", studentId: "joao", teacherId: "ana", teacherName: "Ana Paula", theme: "Animais", activityTitle: "Caixa de animais por cores", result: "Funcionou bem", notes: "Participou com apoio visual até o fim.", date: "10/11/2026" },
  { id: "fb-demo-2", studentId: "joao", teacherId: "carla", teacherName: "Carla Mendes", theme: "Música", activityTitle: "Roda com instrumentos", result: "Não funcionou", notes: "O barulho incomodou; saiu da roda.", date: "11/11/2026" },
  { id: "fb-demo-3", studentId: "livia", teacherId: "marina", teacherName: "Marina Costa", theme: "Cores", activityTitle: "Pareamento de cartões grandes", result: "Funcionou parcialmente", notes: "Precisou de cartões ainda maiores.", date: "12/11/2026" },
  { id: "fb-demo-4", studentId: "enzo", teacherId: "denise", teacherName: "Denise Ferreira", theme: "Dinossauros", activityTitle: "Pegadas no chão da sala", result: "Funcionou bem", notes: "", date: "12/11/2026" }
];

/** Contas de acesso: uma para cada professora + coordenacao. */
function buildUsers() {
  const teacherUsers = teachers.map((teacher) => ({
    id: teacher.id === "ana" ? "user-professora" : `user-${teacher.id}`,
    email: teacher.email,
    passwordHash: hashPassword(DEMO_PASSWORD),
    mustChangePassword: true, // senha de demonstracao: troca obrigatoria no 1o login
    role: "teacher",
    name: teacher.name,
    teacherId: teacher.id
  }));
  const coordination = {
    id: "user-coordenacao",
    email: "coordenacao@escola.com",
    passwordHash: hashPassword(DEMO_PASSWORD),
    mustChangePassword: true,
    role: "admin",
    name: "Coordenação Pedagógica",
    teacherId: null
  };
  return [...teacherUsers, coordination];
}

/** Professoras sem o campo de login (o e-mail mora so na conta de acesso). */
const teacherRecords = teachers.map(({ email, ...record }) => record);

module.exports = { classes, teachers: teacherRecords, students, studentObservations, feedbacks, buildUsers, DEMO_PASSWORD };
