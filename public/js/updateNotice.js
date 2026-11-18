// ---------------------------------------------------------------------------
// Aviso de versao nova do sistema (so para a coordenacao).
//
// - Ao entrar, pergunta ao servidor se ha versao nova (GET /api/updates).
// - "Atualizar agora": confirma, pede a atualizacao (POST /api/updates/install)
//   e espera o sistema voltar com a versao nova (GET /api/version, sem
//   login); entao recarrega a pagina.
// - Sem atualizacao automatica neste computador: mostra "Baixar instalador".
// ---------------------------------------------------------------------------

const UpdateNotice = (() => {
  let info = null;
  let waiting = null;

  function bind() {
    el("updateInstall").addEventListener("click", installNow);
  }

  async function render() {
    const banner = el("updateBanner");
    if (!isAdminUser()) {
      banner.hidden = true;
      return;
    }
    try {
      info = await api("GET", "/api/updates");
    } catch (error) {
      banner.hidden = true;
      return;
    }
    if (info.installing) {
      show(info);
      startWaiting(info.installing.version);
      return;
    }
    if (!info.available) {
      banner.hidden = true;
      return;
    }
    show(info);
  }

  function show(data) {
    el("updateBanner").hidden = false;
    el("updateTitle").textContent = `Versão nova disponível: ${data.latest}`;
    el("updateLine").textContent = data.canInstall
      ? `Este computador está na versão ${data.current}. A atualização mantém todos os dados da escola. O sistema fica fora do ar por alguns minutos.`
      : `Este computador está na versão ${data.current}. Baixe o instalador novo e rode por cima: os dados da escola são mantidos.`;
    el("updateNotesWrap").hidden = !data.notes;
    el("updateNotes").textContent = data.notes || "";
    el("updateInstall").hidden = !data.canInstall || Boolean(data.installing);
    const download = el("updateDownload");
    download.hidden = data.canInstall || !data.pageUrl;
    if (data.pageUrl) download.href = data.pageUrl;
  }

  async function installNow() {
    if (!info) return;
    const ok = await confirmDialog({
      title: `Atualizar para a versão ${info.latest}?`,
      message:
        "O sistema fica fora do ar por alguns minutos enquanto atualiza. Avise as professoras. Os dados da escola são mantidos. A página recarrega sozinha quando terminar.",
      confirmLabel: "Atualizar agora",
      danger: false
    });
    if (!ok) return;
    const button = el("updateInstall");
    button.disabled = true;
    el("updateStatus").textContent = "Baixando a versão nova…";
    try {
      const result = await api("POST", "/api/updates/install");
      button.hidden = true;
      startWaiting(result.latest);
    } catch (error) {
      el("updateStatus").textContent = error.message;
      button.disabled = false;
    }
  }

  /** Espera o sistema voltar com a versao nova (ate 20 minutos) e recarrega. */
  function startWaiting(version) {
    if (waiting) return;
    el("updateInstall").hidden = true;
    el("updateStatus").textContent = `Atualizando para a versão ${version}… Não desligue o computador. A página recarrega sozinha quando terminar.`;
    const limit = Date.now() + 20 * 60 * 1000;
    waiting = setInterval(async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        const data = await response.json();
        if (data.version === version) {
          clearInterval(waiting);
          location.reload();
        }
      } catch (error) {
        // fora do ar durante a atualizacao: continua esperando
      }
      if (Date.now() > limit) {
        clearInterval(waiting);
        waiting = null;
        el("updateStatus").textContent =
          "A atualização está demorando mais que o normal. Recarregue a página em alguns minutos. Se continuar na versão antiga, rode o instalador novo à mão.";
      }
    }, 5000);
  }

  return { bind, render };
})();
