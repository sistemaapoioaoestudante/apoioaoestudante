# ---------------------------------------------------------------------------
# Tarefa do Windows que mantem o Apoio ao Estudante no ar.
#
# A tarefa roda windows\servico.cmd quando o computador liga, como servico
# do sistema (SYSTEM): o Apoio ao Estudante fica no ar mesmo antes de
# alguem entrar no Windows e nunca e encerrado por tempo de execucao.
#
# Uso (como administrador):
#   tarefa.ps1 -Instalar   cria (ou recria) a tarefa e ja inicia o sistema
#   tarefa.ps1 -Parar      encerra o sistema (ex: antes da migracao)
#   tarefa.ps1 -Iniciar    inicia o sistema de novo
#   tarefa.ps1 -Remover    encerra e apaga a tarefa (desinstalacao)
# ---------------------------------------------------------------------------
param(
    [switch]$Instalar,
    [switch]$Parar,
    [switch]$Iniciar,
    [switch]$Remover
)
$ErrorActionPreference = "Stop"

$nome = "Apoio ao Estudante"
$pasta = Split-Path -Parent $PSScriptRoot
$servidor = Join-Path $pasta "server\index.js"

function Existe-Tarefa {
    return [bool](Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue)
}

# Encerra a tarefa e o Node que ela abriu (a tarefa encerra so o servico.cmd)
function Encerrar-Sistema {
    if (Existe-Tarefa) { Stop-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue }
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($servidor) } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($Instalar) {
    $servico = Join-Path $PSScriptRoot "servico.cmd"
    $acao = New-ScheduledTaskAction -Execute $env:ComSpec -Argument "/c `"$servico`"" -WorkingDirectory $pasta
    $gatilho = New-ScheduledTaskTrigger -AtStartup
    $quem = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    # Sem limite de tempo, funciona na bateria e tenta de novo se falhar
    $regras = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
    Encerrar-Sistema
    Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Principal $quem `
        -Settings $regras -Description "Mantem o Apoio ao Estudante no ar (abre quando o computador liga)." -Force | Out-Null
    Start-ScheduledTask -TaskName $nome
    Write-Host "Tarefa criada e sistema iniciado."
}
elseif ($Parar) {
    Encerrar-Sistema
    Write-Host "Sistema encerrado."
}
elseif ($Iniciar) {
    if (Existe-Tarefa) { Start-ScheduledTask -TaskName $nome; Write-Host "Sistema iniciado." }
}
elseif ($Remover) {
    Encerrar-Sistema
    if (Existe-Tarefa) { Unregister-ScheduledTask -TaskName $nome -Confirm:$false }
    # Fecha o icone perto do relogio (windows\bandeja.ps1)
    Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains("bandeja.ps1") } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host "Tarefa removida."
}
else {
    Write-Host "Use -Instalar, -Parar, -Iniciar ou -Remover."
    exit 1
}
