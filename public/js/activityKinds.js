// ---------------------------------------------------------------------------
// Tipos de atividade: icone e nome amigavel de cada "resourceClass".
//
// A IA sempre devolve um destes 6 valores (o servidor garante isso pelo
// esquema fixo - ver server/ai/activityFormat.js). A cor de cada tipo fica
// no CSS (public/css/screens.css, seletores .activity-card[data-kind]).
// ---------------------------------------------------------------------------

const ActivityKinds = (() => {
  const KINDS = {
    manipulative: { icon: "🖐️", label: "Mão na massa" },
    story: { icon: "📖", label: "História e linguagem" },
    movement: { icon: "🤸", label: "Movimento" },
    sequence: { icon: "🧩", label: "Sequência e pareamento" },
    digital: { icon: "💻", label: "Recurso digital" },
    visual: { icon: "🎨", label: "Arte e registro visual" }
  };

  const FALLBACK = { icon: "⭐", label: "Atividade" };

  /** @returns {{ icon: string, label: string }} */
  function get(resourceClass) {
    return KINDS[resourceClass] || FALLBACK;
  }

  return { get };
})();
