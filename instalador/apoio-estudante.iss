; ---------------------------------------------------------------------------
; Instalador do Apoio ao Estudante (Inno Setup 6)
;
; Instalador "online": leva so o sistema (poucos MB) e, durante a
; instalacao, baixa o que faltar no computador:
;   - Node.js  (roda o sistema)            nodejs.org
;   - Ollama   (IA local)                  ollama.com
;   - Tailscale (opcional: celular)        tailscale.com
; e o modelo de IA escolhido.
;
; O que ele deixa pronto:
;   - sistema sempre no ar: tarefa do Windows que abre o sistema quando o
;     computador liga (windows\tarefa.ps1 + windows\servico.cmd);
;   - icone perto do relogio que avisa antes de desligar o computador
;     (windows\bandeja.ps1);
;   - conta da coordenacao criada com o e-mail e a senha informados (ou, na
;     troca de computador, os dados trazidos do computador antigo).
;
; Atualizar (instalar por cima) mantem os dados (pasta data) e o .env.
;
; Compilar:  ISCC.exe instalador\apoio-estudante.iss
; Resultado: instalador\saida\instalar-apoio-ao-estudante-<versao>.exe
; ---------------------------------------------------------------------------

#define Nome "Apoio ao Estudante"
#define Versao "1.0.9"
#define Porta "3000"
#define NodeVersao "24.21.0"
#define NodeUrl "https://nodejs.org/dist/v" + NodeVersao + "/node-v" + NodeVersao + "-x64.msi"
#define OllamaUrl "https://ollama.com/download/OllamaSetup.exe"
#define TailscaleUrl "https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi"

[Setup]
AppId={{6E2B7C1A-4F5D-4C8E-9A31-2B7D5E0C9F14}
AppName={#Nome}
AppVersion={#Versao}
AppVerName={#Nome} {#Versao}
AppPublisher={#Nome}
; Fora de "Arquivos de Programas": o sistema grava os dados na propria pasta
DefaultDirName={sd}\ApoioEstudante
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
WizardImageFile=arte\lateral.bmp,arte\lateral@2x.bmp
WizardSmallImageFile=arte\topo.bmp,arte\topo@2x.bmp
SetupIconFile=arte\icone.ico
UninstallDisplayIcon={app}\windows\icone.ico
UninstallDisplayName={#Nome}
OutputDir=saida
OutputBaseFilename=instalar-apoio-ao-estudante-{#Versao}
Compression=lzma2/max
SolidCompression=yes
CloseApplications=no

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Messages]
ptbr.WelcomeLabel2=Este assistente instala o [name] neste computador.%n%nO computador da escola guarda o sistema, os dados das crianças e a IA. Nada vai para a internet.%n%nO instalador baixa o que faltar (Node.js, Ollama e o modelo de IA). Deixe a internet ligada e o computador na tomada.

[CustomMessages]
ptbr.TarefaServico=Deixar o sistema sempre no ar (abre sozinho quando o computador liga)
ptbr.TarefaSuspender=Não deixar o computador suspender quando estiver na tomada
ptbr.TarefaCelular=Acesso das professoras pelo celular (instala o Tailscale, rede privada)
ptbr.TarefaAtalho=Criar atalho na Área de Trabalho
ptbr.GrupoAcesso=Funcionamento:
ptbr.GrupoExtras=Extras:

[Tasks]
Name: "servico"; Description: "{cm:TarefaServico}"; GroupDescription: "{cm:GrupoAcesso}"
Name: "semsuspender"; Description: "{cm:TarefaSuspender}"; GroupDescription: "{cm:GrupoAcesso}"
Name: "celular"; Description: "{cm:TarefaCelular}"; GroupDescription: "{cm:GrupoExtras}"
Name: "atalho"; Description: "{cm:TarefaAtalho}"; GroupDescription: "{cm:GrupoExtras}"

[Dirs]
; Dados da escola: o sistema (rodando como servico) e a coordenacao gravam aqui
Name: "{app}\data"; Permissions: users-modify
Name: "{app}\modelos-ia"; Permissions: users-modify

[Files]
Source: "..\server\*"; DestDir: "{app}\server"; Flags: recursesubdirs ignoreversion
Source: "..\public\*"; DestDir: "{app}\public"; Flags: recursesubdirs ignoreversion
Source: "..\windows\*"; DestDir: "{app}\windows"; Flags: ignoreversion
Source: "arte\icone.ico"; DestDir: "{app}\windows"; Flags: ignoreversion
Source: "..\docs\*"; DestDir: "{app}\docs"; Flags: recursesubdirs ignoreversion
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\.env.example"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\iniciar.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\backup-pendrive.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\recuperar-acesso.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\migrar.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Abre o sistema no navegador (atalho de internet)
Name: "{autoprograms}\{#Nome}\Abrir o {#Nome}"; Filename: "http://127.0.0.1:{#Porta}/"; IconFilename: "{app}\windows\icone.ico"
Name: "{autodesktop}\{#Nome}"; Filename: "http://127.0.0.1:{#Porta}/"; IconFilename: "{app}\windows\icone.ico"; Tasks: atalho
Name: "{autoprograms}\{#Nome}\Cópia de segurança no pendrive"; Filename: "{app}\backup-pendrive.bat"; WorkingDir: "{app}"; IconFilename: "{app}\windows\icone.ico"
Name: "{autoprograms}\{#Nome}\Configurar acesso pelo celular"; Filename: "{app}\windows\configurar-celular.bat"; WorkingDir: "{app}"; IconFilename: "{app}\windows\icone.ico"; Check: UsaTailscale
Name: "{autoprograms}\{#Nome}\Trazer dados de outro computador"; Filename: "{app}\migrar.bat"; WorkingDir: "{app}"; IconFilename: "{app}\windows\icone.ico"
Name: "{autoprograms}\{#Nome}\Recuperar acesso da coordenação"; Filename: "{app}\recuperar-acesso.bat"; WorkingDir: "{app}"; IconFilename: "{app}\windows\icone.ico"
Name: "{autoprograms}\{#Nome}\Manual de acesso pelo celular"; Filename: "{app}\docs\acesso-remoto.md"

[Registry]
; Icone perto do relogio (com o aviso ao desligar) para quem entrar no Windows
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "ApoioEstudante"; \
  ValueData: "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\windows\bandeja.ps1"""; \
  Flags: uninsdeletevalue; Tasks: servico
; Pasta dos modelos de IA, a mesma para o servico e para o Ollama de quem
; entrar no Windows (so cria se ainda nao existir)
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; ValueType: string; \
  ValueName: "OLLAMA_MODELS"; ValueData: "{app}\modelos-ia"; Flags: createvalueifdoesntexist

[Run]
; Atualizacao pelo proprio sistema (server/updates/updater.js): o instalador
; roda em modo silencioso, como SYSTEM - nada de janelas nem paginas
; (skipifsilent / not WizardSilent).
; Icone perto do relogio ja nesta sessao
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\windows\bandeja.ps1"""; \
  Flags: runasoriginaluser nowait runhidden; Tasks: servico; Check: (not EhMigracao) and (not WizardSilent)
; Troca de computador: PRIMEIRO entra no Tailscale (os dados vem do
; computador antigo pela rede privada), DEPOIS traz os dados. O [Run] roda
; nesta ordem, e cada passo espera o anterior terminar.
Filename: "{app}\windows\configurar-celular.bat"; WorkingDir: "{app}"; Description: "Entrar no Tailscale com a conta da escola (necessário para trazer os dados)"; \
  Flags: postinstall shellexec waituntilterminated skipifsilent; Check: EhMigracao
Filename: "{app}\migrar.bat"; WorkingDir: "{app}"; Description: "Trazer agora os dados do computador antigo"; \
  Flags: postinstall shellexec waituntilterminated skipifsilent; Check: EhMigracao
; Primeira instalacao: configurar o celular (entrar no Tailscale com a conta da escola)
; (marcado: no fim da instalacao abre so a pagina de login do Tailscale no
; navegador, sem janela preta - windows\ligar-tailscale.ps1)
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\windows\ligar-tailscale.ps1"""; \
  Description: "Ligar este computador ao Tailscale agora (abre a página de login com a conta da escola)"; \
  Flags: postinstall runhidden nowait runasoriginaluser skipifsilent; Tasks: celular; Check: not EhMigracao
Filename: "http://127.0.0.1:{#Porta}/"; Description: "Abrir o {#Nome}"; Flags: postinstall shellexec nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\windows\tarefa.ps1"" -Remover"; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoverTarefa"

[UninstallDelete]
Type: files; Name: "{app}\windows\caminhos.cmd"

[Code]
// ---------------------------------------------------------------------------
// Paginas proprias e passos da instalacao
// ---------------------------------------------------------------------------

var
  PaginaTipo: TInputOptionWizardPage;       // escola nova x troca de computador
  PaginaConta: TInputQueryWizardPage;       // e-mail e senha da coordenacao
  PaginaModelo: TInputOptionWizardPage;     // modelo de IA
  PaginaDownload: TDownloadWizardPage;      // baixa Node/Ollama/Tailscale
  BaixarNode, BaixarOllama, BaixarTailscale: Boolean;
  // Fotografia tirada ANTES de copiar os arquivos: depois que CriarBanco
  // cria o banco, conferir o arquivo de novo daria "atualizacao" numa
  // primeira instalacao (e o modelo de IA nao seria baixado).
  Instalando, EraAtualizacao: Boolean;

// Variavel de ambiente so deste processo (passa a senha ao seed sem gravar
// em disco nem na linha de comando)
function SetEnvironmentVariable(Nome: string; Valor: string): Boolean;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

// ---- consultas -------------------------------------------------------------

// Ja existe um banco nesta pasta? (atualizacao: nada de conta nova)
function EhAtualizacao: Boolean;
begin
  if Instalando then
    Result := EraAtualizacao
  else
    Result := FileExists(ExpandConstant('{app}\data\apoio.sqlite'));
end;

function EhMigracao: Boolean;
begin
  Result := (not EhAtualizacao) and (PaginaTipo.SelectedValueIndex = 1);
end;

function CaminhoNode: string;
var
  Pasta: string;
begin
  Result := '';
  if RegQueryStringValue(HKLM, 'SOFTWARE\Node.js', 'InstallPath', Pasta) and FileExists(AddBackslash(Pasta) + 'node.exe') then
    Result := AddBackslash(Pasta) + 'node.exe'
  else if FileExists(ExpandConstant('{commonpf64}\nodejs\node.exe')) then
    Result := ExpandConstant('{commonpf64}\nodejs\node.exe');
end;

// Node instalado E novo o bastante (precisa do SQLite embutido, Node 22.13+)
function NodeServe: Boolean;
var
  Codigo: Integer;
begin
  Result := (CaminhoNode <> '') and
    Exec(CaminhoNode, '-e "require(''node:sqlite'')"', '', SW_HIDE, ewWaitUntilTerminated, Codigo) and (Codigo = 0);
end;

function CaminhoOllama: string;
begin
  Result := '';
  if FileExists(ExpandConstant('{localappdata}\Programs\Ollama\ollama.exe')) then
    Result := ExpandConstant('{localappdata}\Programs\Ollama\ollama.exe')
  else if FileExists(ExpandConstant('{commonpf64}\Ollama\ollama.exe')) then
    Result := ExpandConstant('{commonpf64}\Ollama\ollama.exe');
end;

// Tailscale em uso: pedido para o celular, ou troca de computador (os dados
// vem por ele). Mostra o atalho "Configurar acesso pelo celular".
function UsaTailscale: Boolean;
begin
  Result := WizardIsTaskSelected('celular') or EhMigracao;
end;

function TemTailscale: Boolean;
begin
  Result := FileExists(ExpandConstant('{commonpf64}\Tailscale\tailscale.exe'));
end;

function ModeloEscolhido: string;
begin
  if PaginaModelo.SelectedValueIndex = 1 then
    Result := 'qwen2.5:7b'
  else
    Result := 'llama3.2';
end;

// ---- paginas -----------------------------------------------------------------

procedure InitializeWizard;
begin
  PaginaTipo := CreateInputOptionPage(wpSelectDir,
    'Como vai ser esta instalação?', 'Escolha uma opção.',
    'Na troca de computador, todos os dados (alunos, turmas, professoras, registros e fotos) vêm do computador antigo pela rede privada da escola.',
    True, False);
  PaginaTipo.Add('Primeira instalação na escola (começa vazio)');
  PaginaTipo.Add('Troca de computador: trazer os dados do computador antigo');
  PaginaTipo.SelectedValueIndex := 0;

  PaginaConta := CreateInputQueryPage(PaginaTipo.ID,
    'Conta da coordenação', 'Quem vai cadastrar turmas, professoras e alunos.',
    'Anote estes dados num lugar seguro. A senha precisa ter pelo menos 8 caracteres e não pode ser óbvia (ex: 12345678).');
  PaginaConta.Add('E-mail da coordenação:', False);
  PaginaConta.Add('Senha:', True);
  PaginaConta.Add('Repita a senha:', True);

  PaginaModelo := CreateInputOptionPage(PaginaConta.ID,
    'Inteligência artificial', 'Qual modelo de IA gera as atividades?',
    'Os dois funcionam sem internet depois de baixados. Dá para trocar depois, no menu IA da coordenação.',
    True, False);
  PaginaModelo.Add('Rápido: llama3.2 (download de ~2 GB). Recomendado para computador sem placa de vídeo.');
  PaginaModelo.Add('Mais detalhado: qwen2.5:7b (download de ~4,7 GB). Mais lento em computador simples.');
  PaginaModelo.SelectedValueIndex := 0;

  PaginaDownload := CreateDownloadPage('Baixando o que falta', 'Isso pode levar alguns minutos, dependendo da internet.', nil);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (PageID = PaginaTipo.ID) or (PageID = PaginaModelo.ID) then
    Result := EhAtualizacao
  else if PageID = PaginaConta.ID then
    Result := EhAtualizacao or EhMigracao;
end;

// Senhas faceis demais (o sistema tem a mesma regra: server/util/passwordPolicy.js)
function SenhaObvia(Senha: string): Boolean;
begin
  Result := Pos('|' + Lowercase(Senha) + '|',
    '|12345678|123456789|1234567890|senha123|senha1234|password|qwerty123|escola123|87654321|11111111|00000000|') > 0;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Email, Senha: string;
begin
  Result := True;

  if CurPageID = PaginaConta.ID then
  begin
    Email := Trim(PaginaConta.Values[0]);
    Senha := PaginaConta.Values[1];
    if (Pos('@', Email) < 2) or (Pos('.', Email) = 0) then
    begin
      MsgBox('Escreva um e-mail válido para a coordenação.', mbError, MB_OK);
      Result := False;
    end
    else if Length(Senha) < 8 then
    begin
      MsgBox('A senha precisa ter pelo menos 8 caracteres.', mbError, MB_OK);
      Result := False;
    end
    else if SenhaObvia(Senha) then
    begin
      MsgBox('Essa senha é fácil demais de adivinhar. Escolha outra.', mbError, MB_OK);
      Result := False;
    end
    else if Senha <> PaginaConta.Values[2] then
    begin
      MsgBox('As duas senhas não são iguais. Digite de novo.', mbError, MB_OK);
      Result := False;
    end;
  end;

  // Antes de instalar: baixa o que falta (com barra de progresso)
  if CurPageID = wpReady then
  begin
    BaixarNode := not NodeServe;
    BaixarOllama := CaminhoOllama = '';
    BaixarTailscale := (WizardIsTaskSelected('celular') or EhMigracao) and not TemTailscale;
    if BaixarNode or BaixarOllama or BaixarTailscale then
    begin
      PaginaDownload.Clear;
      if BaixarNode then PaginaDownload.Add('{#NodeUrl}', 'node.msi', '');
      if BaixarOllama then PaginaDownload.Add('{#OllamaUrl}', 'OllamaSetup.exe', '');
      if BaixarTailscale then PaginaDownload.Add('{#TailscaleUrl}', 'tailscale.msi', '');
      PaginaDownload.Show;
      try
        try
          PaginaDownload.Download;
        except
          if PaginaDownload.AbortedByUser then
            Log('Download cancelado pela pessoa.')
          else
            SuppressibleMsgBox('Não foi possível baixar: ' + AddPeriod(GetExceptionMessage) + #13#10 +
              'Confira a internet e tente de novo.', mbCriticalError, MB_OK, IDOK);
          Result := False;
        end;
      finally
        PaginaDownload.Hide;
      end;
    end;
  end;
end;

// ---- passos depois de copiar os arquivos ------------------------------------

procedure Status(Texto: string);
begin
  WizardForm.StatusLabel.Caption := Texto;
  WizardForm.FilenameLabel.Caption := '';
end;

// Roda um programa e espera; devolve True se terminou sem erro
function Rodar(Programa, Parametros: string; Visivel: Boolean): Boolean;
var
  Codigo, Modo: Integer;
begin
  if Visivel then Modo := SW_SHOW else Modo := SW_HIDE;
  Result := Exec(Programa, Parametros, ExpandConstant('{app}'), Modo, ewWaitUntilTerminated, Codigo) and (Codigo = 0);
  if not Result then Log(Format('Falhou (%d): %s %s', [Codigo, Programa, Parametros]));
end;

procedure InstalarDependencias;
begin
  if BaixarNode then
  begin
    Status('Instalando o Node.js...');
    Rodar('msiexec.exe', '/i "' + ExpandConstant('{tmp}\node.msi') + '" /qn /norestart', False);
  end;
  if BaixarOllama then
  begin
    Status('Instalando o Ollama (IA local)...');
    Rodar(ExpandConstant('{tmp}\OllamaSetup.exe'), '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', False);
  end;
  if BaixarTailscale then
  begin
    Status('Instalando o Tailscale (acesso pelo celular)...');
    Rodar('msiexec.exe', '/i "' + ExpandConstant('{tmp}\tailscale.msi') + '" /qn /norestart', False);
  end;
end;

// Caminhos usados pelo servico (windows\servico.cmd) e pelos .bat
procedure GravarCaminhos;
var
  Linhas: TArrayOfString;
begin
  SetArrayLength(Linhas, 4);
  Linhas[0] := '@REM Gerado pelo instalador - caminhos dos programas usados pelo sistema';
  Linhas[1] := '@set "NODE_EXE=' + CaminhoNode + '"';
  Linhas[2] := '@set "OLLAMA_EXE=' + CaminhoOllama + '"';
  Linhas[3] := '@set "OLLAMA_MODELS=' + ExpandConstant('{app}\modelos-ia') + '"';
  SaveStringsToFile(ExpandConstant('{app}\windows\caminhos.cmd'), Linhas, False);
end;

// .env so na primeira instalacao (atualizacao mantem o que a escola ajustou)
procedure GravarEnv;
var
  Linhas: TArrayOfString;
begin
  if FileExists(ExpandConstant('{app}\.env')) then Exit;
  SetArrayLength(Linhas, 9);
  Linhas[0] := '# Gerado pelo instalador. Modelo completo em .env.example.';
  Linhas[1] := 'AI_PROVIDER=ollama';
  Linhas[2] := 'OLLAMA_BASE_URL=http://127.0.0.1:11434';
  Linhas[3] := 'OLLAMA_MODEL=' + ModeloEscolhido;
  Linhas[4] := 'PORT={#Porta}';
  Linhas[5] := '# Sistema so neste computador; o celular entra pelo Tailscale (HTTPS)';
  Linhas[6] := 'HOST=127.0.0.1';
  Linhas[7] := 'TRUST_PROXY=1';
  Linhas[8] := '';
  SaveStringsToFile(ExpandConstant('{app}\.env'), Linhas, False);
end;

// Banco novo da escola com a conta da coordenacao (sem dados de exemplo)
procedure CriarBanco;
begin
  if EhAtualizacao or EhMigracao then Exit;
  Status('Criando o banco da escola...');
  SetEnvironmentVariable('COORD_EMAIL', Trim(PaginaConta.Values[0]));
  SetEnvironmentVariable('COORD_PASSWORD', PaginaConta.Values[1]);
  if not Rodar(CaminhoNode, '"' + ExpandConstant('{app}\server\seedData\seed.js') + '" --escola', False) then
    MsgBox('Não foi possível criar o banco da escola. Rode o instalador de novo.', mbError, MB_OK);
  SetEnvironmentVariable('COORD_PASSWORD', '');
  SetEnvironmentVariable('COORD_EMAIL', '');
end;

// Modelo a baixar: na atualizacao, o que a escola ja usa (.env); senao, o escolhido
function ModeloParaBaixar: string;
var
  Linhas: TArrayOfString;
  I: Integer;
begin
  Result := ModeloEscolhido;
  if EhAtualizacao and LoadStringsFromFile(ExpandConstant('{app}\.env'), Linhas) then
    for I := 0 to GetArrayLength(Linhas) - 1 do
      if Pos('OLLAMA_MODEL=', Trim(Linhas[I])) = 1 then
        Result := Trim(Copy(Trim(Linhas[I]), 14, 200));
end;

// O modelo esta na pasta do sistema (modelos-ia)? E o arquivo que o Ollama
// grava ao terminar o download: manifests\...\library\<nome>\<versao>
function ModeloNaPasta(Modelo: string): Boolean;
var
  Nome, Versao: string;
  P: Integer;
begin
  P := Pos(':', Modelo);
  if P > 0 then
  begin
    Nome := Copy(Modelo, 1, P - 1);
    Versao := Copy(Modelo, P + 1, 200);
  end
  else
  begin
    Nome := Modelo;
    Versao := 'latest';
  end;
  Result := FileExists(ExpandConstant('{app}\modelos-ia\manifests\registry.ollama.ai\library\') + Nome + '\' + Versao);
end;

// Espera o Ollama responder (ate ~40 s)
procedure EsperarOllama;
var
  I, Codigo: Integer;
begin
  for I := 1 to 20 do
  begin
    if Exec('curl.exe', '-s -o nul --max-time 2 http://127.0.0.1:11434/', '', SW_HIDE, ewWaitUntilTerminated, Codigo) and (Codigo = 0) then
      Exit;
    Sleep(2000);
  end;
end;

// Fecha qualquer Ollama aberto (o da sessao da pessoa usaria outra pasta de
// modelos) e abre o do sistema, com a pasta modelos-ia
procedure AbrirOllamaDoSistema(Primeira: Boolean);
var
  Codigo: Integer;
  Tarefa: string;
begin
  Tarefa := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\windows\tarefa.ps1') + '" ';
  if not Primeira then
    Rodar('powershell.exe', Tarefa + '-Parar', False);
  Rodar('taskkill.exe', '/f /im "ollama app.exe"', False);
  Rodar('taskkill.exe', '/f /im ollama.exe', False);
  Sleep(1500);
  SetEnvironmentVariable('OLLAMA_MODELS', ExpandConstant('{app}\modelos-ia'));
  if WizardIsTaskSelected('servico') and not EhMigracao then
  begin
    if Primeira then
      Rodar('powershell.exe', Tarefa + '-Instalar', False)
    else
      Rodar('powershell.exe', Tarefa + '-Iniciar', False);
  end
  else
    // Sem o servico: abre o Ollama so para baixar o modelo
    Exec(CaminhoOllama, 'serve', '', SW_HIDE, ewNoWait, Codigo);
  EsperarOllama;
end;

// Inicia o servico (que tambem abre o Ollama) e baixa o modelo de IA,
// conferindo se ele chegou mesmo na pasta do sistema
procedure PrepararIa;
var
  Ollama, Modelo: string;
begin
  Ollama := CaminhoOllama;
  if Ollama = '' then Exit;
  Modelo := ModeloParaBaixar;
  AbrirOllamaDoSistema(True);
  if ModeloNaPasta(Modelo) then Exit; // ja baixado (ex: atualizacao)

  Status('Baixando o modelo de IA (' + Modelo + '). Acompanhe na janela preta...');
  Rodar(Ollama, 'pull ' + Modelo, True);
  if not ModeloNaPasta(Modelo) then
  begin
    // Outro Ollama atendeu (ou a internet caiu): abre o do sistema e tenta de novo
    Log('Modelo nao chegou em modelos-ia; tentando de novo com o Ollama do sistema.');
    Status('Conferindo o modelo de IA e tentando de novo...');
    AbrirOllamaDoSistema(False);
    Rodar(Ollama, 'pull ' + Modelo, True);
  end;
  if not ModeloNaPasta(Modelo) then
    MsgBox('Não foi possível baixar o modelo de IA (' + Modelo + ') agora. O sistema funciona, mas só gera atividades depois do download.' + #13#10#13#10 +
      'Para tentar de novo: confira a internet e rode este instalador outra vez (por cima). Os dados são mantidos.', mbInformation, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  // Antes de copiar qualquer arquivo: e atualizacao ou primeira instalacao?
  if CurStep = ssInstall then
  begin
    EraAtualizacao := FileExists(ExpandConstant('{app}\data\apoio.sqlite'));
    Instalando := True;
  end;

  if CurStep = ssPostInstall then
  begin
    InstalarDependencias;
    GravarCaminhos;
    GravarEnv;
    CriarBanco;
    if WizardIsTaskSelected('semsuspender') then
    begin
      Status('Ajustando a energia do computador...');
      Rodar('powercfg.exe', '/change standby-timeout-ac 0', False);
      Rodar('powercfg.exe', '/change hibernate-timeout-ac 0', False);
    end;
    PrepararIa;
    // Na troca de computador o servico so e criado depois de trazer os dados
    if WizardIsTaskSelected('servico') and EhMigracao then
      Rodar('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\windows\tarefa.ps1') + '" -Instalar', False);
    // Atualizacao pelo proprio sistema: apaga a tarefa de uso unico que
    // rodou este instalador (server/updates/updater.js)
    if WizardSilent then
      Rodar('schtasks.exe', '/delete /f /tn "Apoio ao Estudante - atualizar"', False);
  end;
end;

// Mensagem na tela final
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
var
  Baixar: string;
begin
  Baixar := '';
  if not NodeServe then Baixar := Baixar + Space + 'Node.js {#NodeVersao}' + NewLine;
  if CaminhoOllama = '' then Baixar := Baixar + Space + 'Ollama (IA local)' + NewLine;
  if (WizardIsTaskSelected('celular') or EhMigracao) and not TemTailscale then Baixar := Baixar + Space + 'Tailscale' + NewLine;
  if not EhAtualizacao then Baixar := Baixar + Space + 'Modelo de IA ' + ModeloEscolhido + NewLine;

  Result := MemoDirInfo + NewLine + NewLine + MemoTasksInfo;
  if Baixar <> '' then
    Result := Result + NewLine + NewLine + 'Será baixado da internet:' + NewLine + Baixar;
  if EhAtualizacao then
    Result := Result + NewLine + NewLine + 'Atualização: os dados da escola e as configurações são mantidos.';
end;

// Desinstalar: o sistema sai sempre. Os dados da escola e o modelo de IA so
// saem se a pessoa confirmar (a resposta padrao e "Nao"; na desinstalacao
// silenciosa nada e apagado).
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Dados, Modelos: string;
  Codigo: Integer;
begin
  if CurUninstallStep <> usPostUninstall then Exit;
  Dados := ExpandConstant('{app}\data');
  Modelos := ExpandConstant('{app}\modelos-ia');

  if DirExists(Dados) then
  begin
    if (SuppressibleMsgBox(
          'O sistema foi removido.' + #13#10#13#10 +
          'Deseja apagar também os DADOS DA ESCOLA (alunos, turmas, professoras, registros e cópias de segurança)?' + #13#10#13#10 +
          'Isso NÃO pode ser desfeito. Se for trocar de computador ou reinstalar depois, responda Não: ' +
          'os dados ficam em ' + Dados + '.',
          mbConfirmation, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES) and
       (SuppressibleMsgBox(
          'Tem certeza? Todos os dados das crianças deste computador serão apagados para sempre.' + #13#10#13#10 +
          'Dica: antes, use "Cópia de segurança no pendrive" se quiser guardar uma cópia.',
          mbError, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES) then
    begin
      if DelTree(Dados, True, True, True) then
        Log('Dados da escola apagados a pedido da pessoa.')
      else
        MsgBox('Não foi possível apagar tudo em ' + Dados + '. Reinicie o computador e apague a pasta à mão.', mbError, MB_OK);
    end;
  end;

  if DirExists(Modelos) then
  begin
    if SuppressibleMsgBox(
         'Deseja apagar também o modelo de inteligência artificial (cerca de 2 a 5 GB)?' + #13#10#13#10 +
         'Ele não tem dados das crianças. Se for reinstalar o sistema neste computador, responda Não para não precisar baixar de novo.',
         mbConfirmation, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES then
    begin
      // O Ollama do sistema pode estar com os arquivos abertos
      Exec('taskkill.exe', '/f /im ollama.exe', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
      Sleep(1500);
      if not DelTree(Modelos, True, True, True) then
        MsgBox('Não foi possível apagar tudo em ' + Modelos + '. Reinicie o computador e apague a pasta à mão.', mbError, MB_OK);
    end;
  end;

  // Pasta do sistema vazia: remove
  RemoveDir(ExpandConstant('{app}'));
  if DirExists(Dados) then
    SuppressibleMsgBox('O sistema foi removido. Os dados da escola continuam em ' + Dados + '.', mbInformation, MB_OK, IDOK)
  else
    SuppressibleMsgBox('O sistema foi removido.', mbInformation, MB_OK, IDOK);
end;
