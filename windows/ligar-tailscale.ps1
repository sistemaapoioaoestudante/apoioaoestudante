# ---------------------------------------------------------------------------
# Liga este computador ao Tailscale SEM janela (usado no fim da instalacao).
#
#   1. Se o computador ainda nao entrou no Tailscale, pede o login e abre a
#      pagina de login no navegador (conta da escola).
#   2. Espera o login (ate 15 minutos).
#   3. Publica o sistema na rede privada, com HTTPS (tailscale serve).
#
# O mesmo passo, com janela e mensagens, e o atalho do menu Iniciar
# "Configurar acesso pelo celular" (windows\configurar-celular.bat).
# ---------------------------------------------------------------------------
$pasta = Split-Path -Parent $PSScriptRoot

# Tailscale (pasta de 64 bits, mesmo se este PowerShell for de 32 bits)
$ts = @(
    (Join-Path $env:ProgramW6432 "Tailscale\tailscale.exe"),
    (Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"),
    (Join-Path $env:SystemDrive "Program Files\Tailscale\tailscale.exe")
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $ts) { exit 1 }

# Porta do sistema (PORT no .env; padrao 3000)
$porta = 3000
$env_ = Join-Path $pasta ".env"
if (Test-Path $env_) {
    $linha = Select-String -Path $env_ -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
    if ($linha) { $porta = [int]$linha.Matches[0].Groups[1].Value }
}

function Estado {
    try { return (& $ts status --json 2>$null | ConvertFrom-Json) } catch { return $null }
}

$estado = Estado
if (-not $estado -or $estado.BackendState -ne "Running") {
    Start-Process -FilePath $ts -ArgumentList "up", "--hostname=apoio-escola" -WindowStyle Hidden
    $abriu = $false
    for ($i = 0; $i -lt 900; $i++) {
        Start-Sleep -Seconds 1
        $estado = Estado
        if ($estado -and $estado.BackendState -eq "Running") { break }
        if (-not $abriu -and $estado -and $estado.AuthURL) {
            Start-Process $estado.AuthURL   # pagina de login no navegador
            $abriu = $true
        }
    }
}

if ($estado -and $estado.BackendState -eq "Running") {
    & $ts serve --bg $porta *> $null
}
