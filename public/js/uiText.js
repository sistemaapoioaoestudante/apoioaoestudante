// ---------------------------------------------------------------------------
// Textos da interface que dependem da pagina ou do perfil de quem esta logado.
//
// Fica separado das telas para que ajustar um titulo, um icone ou uma frase
// nao exija mexer em logica nenhuma. Tudo aqui e texto puro (inserido na
// tela com textContent - nunca vira HTML).
// ---------------------------------------------------------------------------

const UiText = (() => {
  // Titulo, icone e subtitulo de cada pagina (aparecem no topo da tela e no
  // titulo da aba do navegador). O subtitulo pode variar por perfil.
  const VIEWS = {
    dashboard: {
      icon: "📊",
      title: "Painel",
      subtitle: { admin: "Panorama do ano letivo: números, pendências e últimas atividades." }
    },
    quick: {
      icon: "✨",
      title: "Atendimento rápido",
      subtitle: { teacher: "Escolha o aluno e o tema: a IA sugere 3 atividades (leva de 1 a 3 minutos)." }
    },
    students: {
      icon: "🧒",
      title: "Meus alunos",
      subtitle: { teacher: "Os alunos ativos das suas turmas, com o perfil pedagógico de cada um." }
    },
    needs: {
      icon: "📚",
      title: "Deficiências",
      subtitle: {
        teacher: "Estratégias, cuidados e percepções da equipe sobre cada deficiência.",
        admin: "Cadastre deficiências e complete as estratégias (à mão ou com a IA)."
      }
    },
    teacher: {
      icon: "🙋",
      title: "Meu perfil",
      subtitle: { teacher: "Sua foto, sua senha e suas turmas.", admin: "Sua foto e sua senha." }
    },
    classes: {
      icon: "🏫",
      title: "Turmas",
      subtitle: { admin: "Turmas do ano letivo, com alunos e professoras. A virada de ano fica aqui." }
    },
    teachers: {
      icon: "👩‍🏫",
      title: "Professoras",
      subtitle: { admin: "Cadastro das professoras, turmas de cada uma e contas da coordenação." }
    },
    studentsAdmin: {
      icon: "🧒",
      title: "Alunos",
      subtitle: { admin: "Cadastro completo, dados pessoais e situação de cada aluno na escola." }
    },
    history: {
      icon: "🕘",
      title: "Histórico de alterações",
      subtitle: { admin: "Quem fez o quê e quando. Use os filtros para encontrar uma ação." }
    },
    ai: {
      icon: "🤖",
      title: "Inteligência artificial",
      subtitle: { admin: "Liga a IA local e escolhe o modelo usado para gerar as atividades." }
    }
  };

  // Sugestoes rapidas para o campo "Tema do dia".
  const THEME_SUGGESTIONS = ["Animais", "Cores", "Família", "Corpo humano", "Natureza", "Alimentação", "Brinquedos", "Folclore"];

  /** Frase legivel para uma linha do historico de alteracoes. */
  function describeAuditEntry(entry) {
    const who = entry.actorName || "Sistema";
    const what = entry.entity ? `${entry.entity}` : "";
    const detail = entry.details ? `: ${entry.details}` : "";
    switch (entry.action) {
      case "login":
        return `${who} entrou no sistema`;
      case "logout":
        return `${who} saiu do sistema`;
      case "trocar senha":
        return `${who} trocou a própria senha`;
      case "criar":
        return `${who} cadastrou ${what}${detail}`;
      case "editar":
        return `${who} editou ${what}${detail}`;
      case "excluir":
        return `${who} excluiu ${what}${detail}`;
      case "redefinir senha":
        return `${who} redefiniu a senha de uma professora`;
      case "situação":
        return `${who} mudou a situação de ${what}${detail}`;
      case "virada de ano":
        return `${who} virou o ano letivo${detail}`;
      case "recuperar acesso":
        return `Acesso da coordenação recuperado pelo Windows${detail}`;
      case "consultar-ia":
        return `${who} completou a deficiência com a IA${detail}`;
      default:
        return `${who}: ${entry.action} ${what}${detail}`;
    }
  }

  /**
   * Rotulo curto para a origem de um registro da base de deficiencias.
   * O icone vem separado para a tela marca-lo como decorativo (aria-hidden):
   * sem isso o leitor de tela anunciava "brilhos", "escola"...
   * @returns {{ icon: string, text: string }}
   */
  function needSourceLabel(source) {
    const text = String(source || "");
    if (/gerada por ia/i.test(text)) return { icon: "✨", text: "Completado pela IA" };
    if (/coordena/i.test(text)) return { icon: "🏫", text: "Criado pela coordenação" };
    return { icon: "📚", text: "Base do sistema" };
  }

  function viewTitle(viewId) {
    return (VIEWS[viewId] || VIEWS.quick).title;
  }

  function viewIcon(viewId) {
    return (VIEWS[viewId] || VIEWS.quick).icon;
  }

  function viewSubtitle(viewId, role) {
    const subtitles = (VIEWS[viewId] || VIEWS.quick).subtitle;
    return subtitles[role] || subtitles.teacher || subtitles.admin || "";
  }

  return { THEME_SUGGESTIONS, viewTitle, viewIcon, viewSubtitle, describeAuditEntry, needSourceLabel };
})();
