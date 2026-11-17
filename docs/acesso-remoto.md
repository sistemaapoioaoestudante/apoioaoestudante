# Acesso das professoras por celular, tablet e outros computadores

O sistema e a IA rodam **num computador da escola**, e os dados das crianças não saem dele. Por padrão, o sistema só abre nesse próprio computador.

Para as professoras entrarem de outros aparelhos, há dois caminhos seguros. Em nenhum deles o sistema fica aberto na internet.

| Caminho | Funciona onde | Instalar nos aparelhos | Dificuldade |
|---|---|---|---|
| **A. Rede privada (Tailscale)**, o recomendado | Na escola, em casa, no 4G | App Tailscale (grátis), uma vez | Fácil |
| **B. Rede da escola com HTTPS** | Só no Wi-Fi da escola | Aceitar o certificado da escola, uma vez | Média |

> O sistema **se recusa a abrir para a rede sem HTTPS**. Isso evita que senhas e dados das crianças passem abertos pelo Wi-Fi.

---

## Caminho A: rede privada com Tailscale (recomendado)

O Tailscale cria uma rede privada e criptografada só entre os aparelhos que a escola autorizar. O computador da escola continua fechado para a internet: o Tailscale entrega as conexões já protegidas (HTTPS) para o sistema.

### No computador da escola (uma vez)
**Com o instalador:** marque "Acesso das professoras pelo celular" na instalação. Depois abra, no menu Iniciar, **Apoio ao Estudante → Configurar acesso pelo celular** e entre com a **conta da escola** (não uma conta pessoal). No fim, a janela mostra o endereço do sistema, algo como `https://apoio-escola.nome-da-rede.ts.net`.

**Sem o instalador:**
1. Instale o Tailscale: <https://tailscale.com/download> (gratuito para uso pequeno).
2. No arquivo `.env` do sistema, deixe `HOST=127.0.0.1` e `TRUST_PROXY=1`.
3. Abra o sistema (`iniciar.bat`) e rode `windows\configurar-celular.bat`. Ele faz o login no Tailscale e publica o sistema (`tailscale serve`).

### Liberar cada professora (coordenação)
O passo a passo também está no sistema, em **Meu perfil** da coordenação, na área **"Acesso das professoras pelo celular"**. Lá dá para salvar o endereço e copiar uma mensagem pronta para o WhatsApp.

1. Abra o painel do Tailscale (<https://console.tailscale.com/admin/machines>) com a conta da escola.
2. Encontre a máquina onde o sistema roda, `apoio-escola`. Não é nenhum dos celulares.
3. Clique em **…** → **Share…**. Na janela "Share machine", escolha:
   - **Share via email**: digite o e-mail da professora e clique em **Share**. O convite chega no e-mail dela.
   - **Copy share link**: clique em **Copy share link** e mande o link para a professora. Deixe **"Reusable link"** desmarcado: assim cada link vale para uma pessoa só.

**Endereço do sistema:** clique em `apoio-escola` no painel e copie o **Full domain** (ex: `apoio-escola.tail1234ab.ts.net`). O endereço é ele com `https://` na frente. Salve uma vez em Meu perfil da coordenação. Ele só muda se o sistema for instalado com outro nome de computador ou com outra conta do Tailscale. Ao trocar de computador, use o mesmo nome `apoio-escola` e remova o computador antigo no painel.

**Importante:** no computador `apoio-escola`, use **… → Disable key expiry**. Sem isso, o Tailscale desconecta o computador depois de uns 6 meses e as professoras perdem o acesso.

### Em cada celular, tablet ou computador das professoras (uma vez)
1. Instale o app **Tailscale** (Play Store, App Store ou o site).
2. Entre no app com a conta pessoal e aceite o convite que a coordenação enviou (pelo e-mail ou pelo link): **Accept invite**.
3. Abra no navegador o endereço `https://...ts.net`. Dá para salvar como atalho na tela inicial ("Adicionar à tela inicial"); ele abre como um aplicativo.

### Segurança
- **Quem acessa:** só aparelhos autorizados no painel do Tailscale. Professora que sair da escola: remova o aparelho dela lá **e** exclua ou desative a conta dela no sistema.
- **Criptografia:** a conexão é criptografada de ponta a ponta, mesmo no 4G ou num Wi-Fi público.
- **Login no sistema:** continua valendo. Ele cai após 2 horas sem uso e há bloqueio após várias senhas erradas.
- **O computador da escola precisa ficar ligado** (ver "Deixar o computador ativo" no fim).

---

## Caminho B: só na rede da escola, com HTTPS

O próprio sistema atende em HTTPS. É preciso um certificado. Abaixo, o caminho com o PowerShell do Windows, sem instalar nada.

### 1. Criar o certificado (no computador da escola, como administrador)
No PowerShell **como administrador**, troque `SENHA-DO-CERTIFICADO` por uma senha forte e rode:
```powershell
$cert = New-SelfSignedCertificate -DnsName "apoio-escola", $env:COMPUTERNAME -CertStoreLocation Cert:\LocalMachine\My -NotAfter (Get-Date).AddYears(3)
$senha = ConvertTo-SecureString "SENHA-DO-CERTIFICADO" -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath "C:\caminho\do\sistema\data\escola.pfx" -Password $senha
Export-Certificate -Cert $cert -FilePath "C:\caminho\do\sistema\data\escola-publico.cer"
```
O arquivo `escola.pfx` fica na pasta `data`, que **não** vai para o Git.

### 2. Configurar o `.env`
```
HOST=0.0.0.0
HTTPS_PFX=data/escola.pfx
HTTPS_PFX_PASSWORD=SENHA-DO-CERTIFICADO
```

### 3. Liberar a porta no firewall do Windows
É só para a rede local: escolha o perfil "Privado". No PowerShell como administrador:
```powershell
New-NetFirewallRule -DisplayName "Apoio ao Estudante" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow
```

### 4. Nos aparelhos
- **Endereço:** `https://<endereço-IP-do-computador>:3000`. O IP aparece com o comando `ipconfig`. Peça ao responsável pela rede para **fixar esse IP** no roteador.
- **Certificado:** na primeira vez, o navegador avisa que o certificado não é conhecido. Para sumir o aviso, instale o `escola-publico.cer` no aparelho como certificado confiável.

> **Atenção:** use uma rede Wi-Fi **só da equipe**, separada da rede de alunos e visitantes.

---

## Trocar o sistema de computador (migração)

Todos os dados vão do computador antigo para o novo **pela rede privada da escola**, sem pendrive. São alunos, turmas, professoras, registros, fotos, histórico e configurações.

**Antes de começar**
- O computador **antigo** está ligado, com o sistema aberto e o Tailscale conectado.
- Você tem o e-mail e a senha da **coordenação**. Professora não consegue migrar.
- Você tem a conta da escola no Tailscale.

**No computador novo**
1. Rode o instalador e escolha **Troca de computador**. Ele instala o Tailscale junto.
2. Na última tela, deixe as opções marcadas e clique em **Concluir**. Elas rodam nesta ordem:
   - **"Entrar no Tailscale com a conta da escola"**: entre com a mesma conta da escola. O novo vai aparecer como `apoio-escola-1`, porque o nome `apoio-escola` ainda é do antigo. Quando aparecer "Pronto!", aperte uma tecla.
   - **"Trazer agora os dados do computador antigo"**: começa logo depois.

   Se fechou o instalador antes, use o menu Iniciar: primeiro **Configurar acesso pelo celular**, depois **Trazer dados de outro computador**.
3. Informe o endereço do antigo (ex: `https://apoio-escola.nome-da-rede.ts.net`), o e-mail e a senha da coordenação. A senha não aparece ao digitar.
4. O programa baixa a cópia, confere se ela está íntegra e coloca no lugar. Se já havia dados no computador novo, eles são guardados em `data/backups/antes-da-migracao-<data>.sqlite`.
5. O sistema volta a ficar no ar sozinho. Abra (menu Iniciar → **Abrir o Apoio ao Estudante**) e confira os dados.

**Depois de conferir**
1. No painel do Tailscale, **remova o computador antigo** ("Machines" → … → "Remove").
2. Renomeie o novo para `apoio-escola` ("Machines" → … → "Edit machine name"). O endereço volta a ser o mesmo de antes.
3. No computador novo, rode de novo **Configurar acesso pelo celular** (publica o sistema no endereço de sempre).
4. **Reenvie os convites** às professoras (Meu perfil da coordenação → "Acesso das professoras"). O compartilhamento do Tailscale é ligado ao computador.

O computador antigo não é apagado: os dados continuam lá até você desligá-lo. A migração fica registrada no histórico dos dois computadores.

**Sem o computador antigo** (ex: ele quebrou): use o backup do pendrive. Copie o `apoio.sqlite` mais recente para a pasta `data` do computador novo, com o sistema fechado.

## Deixar o computador ativo
O sistema só responde com o computador ligado e sem suspender. No Windows:
- **Configurações → Sistema → Energia → Tela e suspensão:** "Suspender" = **Nunca**, quando ligado na tomada.
- **Sempre no ar:** instalado pelo instalador (opção "Deixar o sistema sempre no ar"), o sistema abre sozinho quando o computador liga, mesmo antes de alguém entrar no Windows, e volta sozinho se fechar por algum erro.
- **Aviso ao desligar:** o ícone do Apoio ao Estudante perto do relógio mostra se o sistema está no ar. Se alguém mandar desligar ou reiniciar o computador, o Windows avisa que as professoras vão ficar sem acesso e pergunta se quer desligar mesmo assim.

## Várias professoras ao mesmo tempo
- **Fila:** o computador gera as atividades de uma pessoa por vez. Quem pedir enquanto outra gera vê "Na fila: 1 pedido na frente", e a geração começa sozinha.
- **Tela do celular apagou:** a geração continua no computador da escola. Ao voltar, a tela reconecta e mostra o que ficou pronto.
