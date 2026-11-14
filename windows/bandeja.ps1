# ---------------------------------------------------------------------------
# Icone do Apoio ao Estudante perto do relogio do Windows + aviso ao desligar.
#
# Abre sozinho quando alguem entra no Windows (o instalador registra). Faz
# tres coisas:
#   1. Mostra se o sistema esta no ar (passe o mouse sobre o icone).
#   2. Menu com "Abrir o sistema" e "Copia de seguranca no pendrive".
#   3. Se alguem mandar DESLIGAR ou REINICIAR o computador com o sistema no
#      ar, o Windows mostra o aviso abaixo e pergunta se quer desligar mesmo
#      assim. (O sistema mora neste computador: desligado, as professoras
#      ficam sem acesso.)
#
# Sem janela. Usa so o que ja vem no Windows (PowerShell + .NET).
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"

$pasta = Split-Path -Parent $PSScriptRoot  # pasta do sistema
$aviso = "O Apoio ao Estudante vai sair do ar. As professoras não conseguem " +
         "acessar o sistema até o computador ser ligado de novo."

# Porta do sistema (PORT no .env; padrao 3000)
$porta = 3000
$env_ = Join-Path $pasta ".env"
if (Test-Path $env_) {
    foreach ($linha in Get-Content $env_) {
        if ($linha -match '^\s*PORT\s*=\s*(\d+)') { $porta = [int]$Matches[1] }
    }
}
$endereco = "http://127.0.0.1:$porta/"

# So uma copia por usuario (evita dois icones)
$criado = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\ApoioEstudanteBandeja", [ref]$criado)
if (-not $criado) { exit }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Janela invisivel que recebe o aviso de desligamento do Windows.
# WM_QUERYENDSESSION: o Windows pergunta se pode desligar. Com o sistema no
# ar, respondemos "ainda nao" e registramos o motivo - o Windows mostra a
# tela "Este aplicativo esta impedindo o desligamento", com o nosso texto e
# o botao "Desligar mesmo assim".
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class JanelaDesligamento : Form {
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern bool ShutdownBlockReasonCreate(IntPtr hWnd, string motivo);
    [DllImport("user32.dll")]
    static extern bool ShutdownBlockReasonDestroy(IntPtr hWnd);

    const int WM_QUERYENDSESSION = 0x11;
    const int WM_ENDSESSION = 0x16;

    public string Motivo = "";
    public Func<bool> SistemaNoAr = () => true;

    public JanelaDesligamento() {
        // Fora da tela e transparente, mas "visivel" para o Windows (janela
        // invisivel nao consegue mostrar o aviso)
        ShowInTaskbar = false;
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        Location = new System.Drawing.Point(-32000, -32000);
        Size = new System.Drawing.Size(1, 1);
        Opacity = 0;
    }

    protected override void WndProc(ref Message m) {
        if (m.Msg == WM_QUERYENDSESSION && SistemaNoAr()) {
            ShutdownBlockReasonCreate(Handle, Motivo);
            m.Result = IntPtr.Zero; // "ainda nao": o Windows mostra o aviso
            return;
        }
        if (m.Msg == WM_ENDSESSION) {
            ShutdownBlockReasonDestroy(Handle);
        }
        base.WndProc(ref m);
    }
}
"@

# O sistema responde? (pergunta rapida ao proprio computador)
function Sistema-NoAr {
    try {
        $req = [System.Net.WebRequest]::Create($endereco)
        $req.Timeout = 1500
        $resp = $req.GetResponse()
        $resp.Close()
        return $true
    } catch {
        return $false
    }
}

$janela = New-Object JanelaDesligamento
$janela.Motivo = $aviso
$janela.SistemaNoAr = [Func[bool]] { Sistema-NoAr }

# ---- icone e menu ------------------------------------------------------------
$icone = New-Object System.Windows.Forms.NotifyIcon
$arquivoIcone = Join-Path $PSScriptRoot "icone.ico"
if (Test-Path $arquivoIcone) {
    $icone.Icon = New-Object System.Drawing.Icon($arquivoIcone)
} else {
    $icone.Icon = [System.Drawing.SystemIcons]::Application
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$abrir = $menu.Items.Add("Abrir o sistema")
$abrir.Font = New-Object System.Drawing.Font($abrir.Font, [System.Drawing.FontStyle]::Bold)
$abrir.add_Click({ Start-Process $endereco })
$backup = $menu.Items.Add("Cópia de segurança no pendrive...")
$backup.add_Click({ Start-Process -FilePath (Join-Path $pasta "backup-pendrive.bat") -WorkingDirectory $pasta })
$icone.ContextMenuStrip = $menu
$icone.add_DoubleClick({ Start-Process $endereco })

# Atualiza o texto do icone a cada 30 segundos
$ultimoEstado = $null
function Atualizar-Estado {
    $noAr = Sistema-NoAr
    if ($noAr) {
        $icone.Text = "Apoio ao Estudante: no ar"
    } else {
        $icone.Text = "Apoio ao Estudante: fora do ar"
    }
    # Avisa uma vez quando o sistema cai (depois de ter estado no ar)
    if ($script:ultimoEstado -eq $true -and -not $noAr) {
        $icone.ShowBalloonTip(8000, "Apoio ao Estudante", "O sistema saiu do ar. Ele tenta voltar sozinho em alguns segundos.", [System.Windows.Forms.ToolTipIcon]::Warning)
    }
    $script:ultimoEstado = $noAr
}

$relogio = New-Object System.Windows.Forms.Timer
$relogio.Interval = 30000
$relogio.add_Tick({ Atualizar-Estado })
$relogio.Start()

$icone.Visible = $true
Atualizar-Estado

$janela.Show()
[System.Windows.Forms.Application]::Run($janela)

$icone.Visible = $false
$icone.Dispose()
$mutex.ReleaseMutex()
