// ---------------------------------------------------------------------------
// Meu perfil (professora e coordenacao): nome, foto, trocar senha, turmas e
// numeros da professora.
//
// Foto: o navegador reduz a imagem para 256x256 (JPEG) ANTES de enviar - a
// foto fica pequena (~20-40 KB), vai para o banco e entra no backup. Nunca
// foto de aluno (aviso na tela).
// ---------------------------------------------------------------------------

// Elementos da tela usados neste modulo
const teacherStats = el("teacherStats");

const Profile = (() => {
  const PHOTO_SIZE = 256;

  function bind() {
    el("changePasswordButton").addEventListener("click", () => PasswordChange.openVoluntary());
    el("profilePhotoInput").addEventListener("change", onPhotoChosen);
    el("removePhotoButton").addEventListener("click", removePhoto);
  }

  /** Mostra a foto (ou as iniciais) num elemento de avatar. */
  function paintAvatar(element, user) {
    element.textContent = "";
    element.classList.toggle("has-photo", Boolean(user.photo));
    if (user.photo) {
      const img = document.createElement("img");
      img.src = user.photo;
      img.alt = ""; // decorativa: o nome aparece ao lado
      element.append(img);
    } else {
      element.textContent = initials(user.name);
    }
  }

  /** Atualiza topo da tela + perfil depois de mudar a foto. */
  function applyUser(user) {
    state.user = { ...state.user, ...user };
    paintAvatar(el("currentUserInitials"), state.user);
    paintAvatar(el("profilePhoto"), state.user);
    el("removePhotoButton").hidden = !state.user.photo;
  }

  /** Le o arquivo escolhido, reduz no navegador e envia. */
  async function onPhotoChosen(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showToast("Escolha uma imagem JPG, PNG ou WEBP.", true);
      return;
    }
    try {
      const photo = await resize(file);
      const { user } = await api("PUT", "/api/auth/photo", { photo });
      applyUser(user);
      showToast("Foto atualizada.");
    } catch (error) {
      showToast(error.message || "Não foi possível usar essa imagem.", true);
    }
  }

  /** Le o arquivo como "data:" (a CSP da pagina permite data:, nao blob:). */
  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Não foi possível ler essa imagem."));
      reader.readAsDataURL(file);
    });
  }

  /** Recorta no centro (quadrado) e reduz para PHOTO_SIZE, em JPEG. */
  async function resize(file) {
    const url = await readAsDataUrl(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = PHOTO_SIZE;
        canvas.height = PHOTO_SIZE;
        canvas
          .getContext("2d")
          .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        reject(new Error("Não foi possível abrir essa imagem."));
      };
      img.src = url;
    });
  }

  async function removePhoto() {
    try {
      const { user } = await api("DELETE", "/api/auth/photo");
      applyUser(user);
      showToast("Foto removida.");
      el("profilePhotoInput").focus();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  /** Desenha a tela Meu perfil. */
  async function render() {
    const user = state.user;
    el("profileRoleLabel").textContent = user.role === "admin" ? "Coordenação" : "Professora";
    el("teacherName").textContent = user.name;
    el("profileEmail").textContent = `Login: ${user.email}`;
    applyUser({});
    AccessGuide.render(); // coordenacao: como liberar o acesso das professoras

    const stats = el("teacherStats");
    const classesBox = el("profileClasses");
    if (user.role !== "teacher") {
      stats.innerHTML = "";
      classesBox.innerHTML = "";
      return;
    }
    // Professora: turmas dela no ano atual (deixa claro por que ve esses alunos)
    const classes = visibleClasses();
    classesBox.innerHTML = `
      <h3 class="title-sm">Suas turmas em ${esc(state.activeYear)}</h3>
      ${classes.length ? `<p>${esc(classes.map((klass) => klass.name).join(", "))}</p>` : `<p class="muted">Nenhuma turma vinculada ainda. Fale com a coordenação.</p>`}
      <p class="hint-text">Você vê só os alunos ativos dessas turmas.</p>`;
    try {
      const teacher = teacherRecordForCurrentUser();
      const { students } = await api("GET", "/api/students");
      const { feedbacks } = teacher ? await api("GET", `/api/feedbacks?teacherId=${encodeURIComponent(teacher.id)}`) : { feedbacks: [] };
      stats.innerHTML = `
        <div class="stat-tile"><strong>${esc(classes.length)}</strong><span>${esc(classes.length === 1 ? "turma" : "turmas")}</span></div>
        <div class="stat-tile"><strong>${esc(students.length)}</strong><span>${esc(students.length === 1 ? "aluno" : "alunos")}</span></div>
        <div class="stat-tile"><strong>${esc(feedbacks.length)}</strong><span>${esc(feedbacks.length === 1 ? "atividade registrada" : "atividades registradas")}</span></div>`;
    } catch (error) {
      showToast(error.message, true);
    }
  }

  return { bind, render, applyUser, paintAvatar };
})();
