@echo off
setlocal
cd /d "%~dp0"

REM ---------------------------------------------------------------------------
REM Recuperar o acesso da coordenacao (senha esquecida).
REM
REM So funciona com permissao de ADMINISTRADOR do Windows: quem tem a senha
REM de administrador deste computador ja controla os dados, entao pode
REM recuperar o acesso. Por isso o computador da escola PRECISA ter senha
REM no Windows (ver README.md).
REM ---------------------------------------------------------------------------

REM "net session" so funciona como administrador: se falhar, pede permissao
net session >nul 2>&1
if errorlevel 1 (
    echo Este procedimento precisa de permissao de administrador do Windows.
    echo Confirme na janela que vai abrir.
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Recuperar acesso da coordenacao - Apoio ao Estudante
echo.
node "server\tools\recuperarCoordenacao.js"
echo.
pause
