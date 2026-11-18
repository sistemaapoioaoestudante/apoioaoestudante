# ---------------------------------------------------------------------------
# Abre no navegador a pagina de login do Tailscale.
#
# Usado por configurar-celular.bat: o "tailscale up" no Windows so escreve o
# endereco de login na janela preta, sem abrir o navegador. Este script
# espera o endereco aparecer (ate ~60 s) e abre a pagina sozinho.
# ---------------------------------------------------------------------------
param([string]$Ts)

for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try {
        $estado = & $Ts status --json 2>$null | ConvertFrom-Json
    } catch {
        continue
    }
    if ($estado.BackendState -eq "Running") { exit 0 }   # ja entrou: nada a abrir
    if ($estado.AuthURL) {
        Start-Process $estado.AuthURL
        exit 0
    }
}
