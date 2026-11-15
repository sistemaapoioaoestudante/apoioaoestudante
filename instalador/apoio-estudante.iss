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
; Resultado: instalador\saida\instalar-apoio-ao-estudante.exe
; ---------------------------------------------------------------------------

#define Nome "Apoio ao Estudante"
#define Versao "1.0.1"
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
OutputBaseFilename=instalar-apoio-ao-estudante
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
Name: "celular"; Description: "{cm:TarefaCelular}"; GroupDescription: "{cm:GrupoExtras}"; Flags: unchecked
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
Name: "{autoprograms}\{#Nome}\Configurar acesso pelo celular"; Filename: "{app}\windows\configurar-celular.bat"; WorkingDir: "{app}"; IconFilename: "{app}\windows\icone.ico"; Tasks: celular
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
; Icone perto do relogio ja nesta sessao
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\windows\bandeja.ps1"""; \
  Flags: runasoriginaluser nowait runhidden; Tasks: servico; Check: not EhMigracao
; Troca de computador: traz os dados agora
Filename: "{app}\migrar.bat"; WorkingDir: "{app}"; Description: "Trazer agora os dados do computador antigo"; \
  Flags: postinstall shellexec waituntilterminated; Check: EhMigracao
; Configurar o celular (entrar no Tailscale com a conta da escola)
Filename: "{app}\windows\configurar-celular.bat"; WorkingDir: "{app}"; Description: "Configurar agora o acesso pelo celular (Tailscale)"; \
  Flags: postinstall shellexec unchecked waituntilterminated; Tasks: celular
Filename: "http://127.0.0.1:{#Porta}/"; Description: "Abrir o {#Nome}"; Flags: postinstall shellexec nowait

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

// Variavel de ambiente so deste processo (passa a senha ao seed sem gravar
// em disco nem na linha de comando)
function SetEnvironmentVariable(Nome: string; Valor: string): Boolean;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

// ---- consultas -------------------------------------------------------------

// Ja existe um banco nesta pasta? (atualizacao: nada de conta nova)
function EhAtualizacao: Boolean;
begin
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

// Inicia o servico (que tambem abre o Ollama) e baixa o modelo de IA
procedure PrepararIa;
var
  Ollama: string;
  Codigo: Integer;
begin
  Ollama := CaminhoOllama;
  if Ollama = '' then Exit;
  // O Ollama aberto na sessao da pessoa usaria outra pasta de modelos:
  // fecha; o servico abre o dele, com a pasta modelos-ia
  Rodar('taskkill.exe', '/f /im "ollama app.exe"', False);
  Rodar('taskkill.exe', '/f /im ollama.exe', False);
  Sleep(1500);
  SetEnvironmentVariable('OLLAMA_MODELS', ExpandConstant('{app}\modelos-ia'));
  if WizardIsTaskSelected('servico') and not EhMigracao then
    Rodar('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\windows\tarefa.ps1') + '" -Instalar', False)
  else
    // Sem o servico: abre o Ollama so para baixar o modelo
    Exec(Ollama, 'serve', '', SW_HIDE, ewNoWait, Codigo);
  Sleep(5000);
  if EhAtualizacao then Exit; // modelo ja baixado na primeira instalacao
  Status('Baixando o modelo de IA (' + ModeloEscolhido + '). Acompanhe na janela preta...');
  if not Rodar(Ollama, 'pull ' + ModeloEscolhido, True) then
    MsgBox('Não foi possível baixar o modelo de IA agora. O sistema funciona, mas só gera atividades depois do download.' + #13#10 +
      'Para tentar de novo: abra o Prompt de Comando e rode "ollama pull ' + ModeloEscolhido + '".', mbInformation, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
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

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    MsgBox('O sistema foi removido. Os dados da escola continuam em ' + ExpandConstant('{app}\data') +
      ' (apague a pasta só se tiver certeza).', mbInformation, MB_OK);
end;
