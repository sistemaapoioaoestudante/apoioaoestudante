// Historico de alteracoes (so coordenacao - envolve nomes de professoras e
// alunos, entao segue a mesma regra de acesso administrativo).
//
// GET /api/audit?pessoa=&acao=&assunto=&de=AAAA-MM-DD&ate=AAAA-MM-DD&busca=&pagina=1
//   - todos os filtros sao opcionais e podem ser combinados;
//   - devolve 50 registros por pagina, do mais novo para o mais antigo, e as
//     listas de pessoas/acoes/assuntos que existem (para montar os filtros).
const store = require("../store");
const { sendJson } = require("../router");
const { requireAuth, requireRole } = require("../middleware/auth");

const PAGE_SIZE = 50;

/** Texto sem acento e em minusculas (busca "joao" acha "João"). */
function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** "AAAA-MM-DD" valido ou null. */
function dateParam(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null;
}

function register(router) {
  router.get("/api/audit", requireAuth, requireRole("admin"), (req, res) => {
    const { pessoa, acao, assunto, busca } = req.query;
    const from = dateParam(req.query.de);
    const to = dateParam(req.query.ate);
    const page = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);

    const all = store.getAll("auditLog").reverse(); // mais novo primeiro
    const search = normalize(busca);
    const filtered = all.filter((entry) => {
      const day = String(entry.at || "").slice(0, 10);
      if (pessoa && entry.actorName !== pessoa) return false;
      if (acao && entry.action !== acao) return false;
      if (assunto && entry.entity !== assunto) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (search && !normalize(`${entry.actorName} ${entry.action} ${entry.entity} ${entry.details}`).includes(search)) return false;
      return true;
    });

    const distinct = (field) => [...new Set(all.map((entry) => entry[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    sendJson(res, 200, {
      entries: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: filtered.length,
      page,
      pageSize: PAGE_SIZE,
      options: { people: distinct("actorName"), actions: distinct("action"), entities: distinct("entity") }
    });
  });
}

module.exports = { register };
