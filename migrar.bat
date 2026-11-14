@echo off
setlocal
cd /d "%~dp0"

REM ---------------------------------------------------------------------------
REM Traz TODOS os dados do sistema de outro computador para ESTE, pela rede
REM privada da escola (Tailscale). Use no computador NOVO.
REM
REM Antes de comecar: o computador antigo ligado, com o sistema aberto; o
REM Tailscale conectado nos dois.
REM Pede o e-mail e a senha da coordenacao. Nada e apagado no antigo.
REM
REM Se o sistema estiver instalado como tarefa do Windows (instalador), ele e
REM encerrado durante a migracao e iniciado de novo no fim - por isso pede
REM permissao de administrador.
REM ---------------------------------------------------------------------------

set "TAREFA="
schtasks /query /tn "Apoio ao Estudante" >nul 2>&1
if not errorlevel 1 set "TAREFA=1"

if defined TAREFA (
    net session >nul 2>&1
    if errorlevel 1 (
        echo A migracao precisa de permissao de administrador do Windows.
        echo Confirme na janela que vai abrir.
        powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
        exit /b
    )
    powershell -NoProfile -ExecutionPolicy Bypass -File "windows\tarefa.ps1" -Parar
)

REM Node gravado pelo instalador (ou o do PATH)
if exist "windows\caminhos.cmd" call "windows\caminhos.cmd"
if not defined NODE_EXE set "NODE_EXE=node"

"%NODE_EXE%" "server\tools\migrar.js"

if defined TAREFA powershell -NoProfile -ExecutionPolicy Bypass -File "windows\tarefa.ps1" -Iniciar
echo.
pause
