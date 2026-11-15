// ---------------------------------------------------------------------------
// Aumenta um banco de demonstracao ate o cenario M (volume de uma rede com
// 20 escolas): 100 turmas, 4.000 alunos e 40.000 registros de atividades.
// Tudo ficticio, com a mesma estrutura do sistema.
//
// Uso (a pasta ja deve ter o banco de demonstracao):
//   DATA_DIR=<pasta> node bench/dadosFicticios.js
// ---------------------------------------------------------------------------
const store = require("../server/store");

const TURMAS = 100;
const ALUNOS = 4000;
const REGISTROS = 40000;
const RESULTADOS = ["Funcionou bem", "Funcionou parcialmente", "Não funcionou"];

const needs = store.getAll("needs");
const year = store.getAll("schoolYears").find((item) => item.status === "ativo").year;
const existingClasses = store.getAll("classes").length;
const existingStudents = store.getAll("students").length;

store.transaction(() => {
  // Turmas extras (as 5 de demonstracao ja existem)
  const classIds = store.getAll("classes").map((klass) => klass.id);
  for (let i = existingClasses; i < TURMAS; i++) {
    const id = `bench-turma-${i}`;
    store.insert("classes", { id, name: `Turma ficticia ${i}`, level: i % 2 ? "Jardim" : "Pré I", schoolYear: year });
    classIds.push(id);
  }

  // A professora do ensaio (Ana) passa a ter 5 turmas, como numa escola real
  const ana = store.getById("teachers", "ana");
  store.update("teachers", "ana", { classIds: [...ana.classIds, ...classIds.slice(5, 8)] });

  // Alunos distribuidos pelas turmas
  const studentIds = store.getAll("students").map((student) => student.id);
  for (let i = existingStudents; i < ALUNOS; i++) {
    const id = `bench-aluno-${i}`;
    const need = needs[i % needs.length];
    store.insert("students", {
      id,
      fullName: `Aluno Ficticio ${i}`,
      shortName: `Aluno ${i}`,
      age: 4,
      classId: classIds[i % classIds.length],
      disability: need.name,
      needId: need.id,
      profile: "Perfil ficticio para o ensaio de desempenho.",
      strengths: ["apoio visual"],
      cautions: [],
      birthDate: "01/01/2022",
      guardian: "Responsável fictício",
      phone: "(00) 00000-0000",
      documentsNote: ""
    });
    studentIds.push(id);
  }

  // Registros de atividades (10 por aluno, em media)
  for (let i = 0; i < REGISTROS; i++) {
    store.insert("feedbacks", {
      id: `bench-registro-${i}`,
      studentId: studentIds[i % studentIds.length],
      teacherId: null,
      teacherName: "Professora fictícia",
      theme: "Tema do ensaio",
      activityTitle: `Atividade ficticia ${i % 50}`,
      result: RESULTADOS[i % 3],
      notes: "",
      date: "01/11/2026"
    });
  }
});

console.log(
  `Cenario M: ${store.getAll("classes").length} turmas, ${store.getAll("students").length} alunos, ${store.getAll("feedbacks").length} registros.`
);
store.close();
