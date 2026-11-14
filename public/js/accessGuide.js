// ---------------------------------------------------------------------------
// "Acesso das professoras pelo celular" (Meu perfil da coordenacao).
//
// - Guarda o endereco do sistema (GET/PUT /api/access-info). Se ainda nao
//   foi salvo e a coordenacao abriu o sistema pelo endereco do Tailscale
//   (...ts.net), ele ja vem preenchido com esse endereco.
// - "Copiar mensagem para a professora": texto pronto para o WhatsApp, com
//   o passo a passo e o endereco (o link do convite e colado pela
//   coordenacao, porque cada convite vale para uma pessoa).
// ---------------------------------------------------------------------------

const AccessGuide = (() => {
  let saved = "";

  function bind() {
    el("accessUrlForm").addEventListener("submit", save);
    el("copyTeacherMessage").addEventListener("click", copyMessage);
  }

  /** Endereco atual: o salvo; senao, o do proprio navegador se for Tailscale. */
  function suggestedUrl() {
    if (saved) return saved;
    return /\.ts\.net$/i.test(location.hostname) ? location.origin : "";
  }

  async function render() {
    const box = el("accessGuide");
    box.hidden = !isAdminUser();
    if (box.hidden) return;
    try {
      const { accessUrl } = await api("GET", "/api/access-info");
      saved = accessUrl || "";
    } catch (error) {
      saved = "";
    }
    el("accessUrlInput").value = suggestedUrl();
    el("accessGuideStatus").textContent = saved
      ? ""
      : el("accessUrlInput").value
        ? "Endereço preenchido a partir deste navegador. Clique em Salvar endereço para guardar."
        : "Abra o sistema pelo endereço do Tailscale (…ts.net) uma vez, ou cole o endereço acima e salve.";
  }

  async function save(event) {
    event.preventDefault();
    try {
      const { accessUrl } = await api("PUT", "/api/access-info", { accessUrl: el("accessUrlInput").value.trim() });
      saved = accessUrl;
      el("accessUrlInput").value = accessUrl;
      el("accessGuideStatus").textContent = "Endereço salvo.";
    } catch (error) {
      el("accessGuideStatus").textContent = error.message;
      el("accessUrlInput").focus();
    }
  }

  /** Mensagem pronta para enviar a professora. */
  function teacherMessage(url) {
    return [
      "Olá! Para acessar o Apoio ao Estudante pelo celular:",
      "",
      "1) Instale o app Tailscale (Play Store ou App Store) e entre com o seu e-mail.",
      "2) Abra este convite e toque em \"Accept invite\" (aceitar convite):",
      "[COLE AQUI O LINK DO CONVITE]",
      "3) Deixe o Tailscale conectado e abra no navegador:",
      url,
      "4) Entre com o seu e-mail e a senha provisória do sistema e crie a sua senha.",
      "",
      "Dica: no menu do navegador, use \"Adicionar à tela inicial\" para abrir como aplicativo."
    ].join("\n");
  }

  async function copyMessage() {
    const url = el("accessUrlInput").value.trim() || saved;
    if (!url) {
      el("accessGuideStatus").textContent = "Preencha e salve o endereço do sistema primeiro.";
      el("accessUrlInput").focus();
      return;
    }
    const text = teacherMessage(url);
    try {
      await navigator.clipboard.writeText(text);
      el("accessGuideStatus").textContent = "Mensagem copiada. Cole no WhatsApp e troque [COLE AQUI O LINK DO CONVITE] pelo link do Tailscale.";
    } catch (error) {
      // Sem permissao de area de transferencia: mostra o texto para copiar a mao
      el("accessGuideStatus").textContent = `Não foi possível copiar automaticamente. Copie o texto abaixo:\n\n${text}`;
    }
  }

  return { bind, render };
})();
