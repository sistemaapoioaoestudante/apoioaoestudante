@echo off
setlocal
cd /d "%~dp0.."

REM ---------------------------------------------------------------------------
REM Liga o acesso das professoras pelo celular (rede privada Tailscale).
REM
REM   1. Conecta este computador ao Tailscale com a CONTA DA ESCOLA (abre o
REM      navegador para entrar).
REM   2. Publica o sistema so dentro dessa rede privada, com HTTPS.
REM
REM Passo a passo completo e como convidar cada professora:
REM docs\acesso-remoto.md (ou "Meu perfil" da coordenacao, no sistema).
REM ---------------------------------------------------------------------------

set "TS=%ProgramFiles%\Tailscale\tailscale.exe"
if not exist "%TS%" (
    echo [ERRO] O Tailscale nao esta instalado neste computador.
    echo Instale em https://tailscale.com/download ou rode o instalador do
    echo Apoio ao Estudante de novo, marcando "Acesso pelo celular".
    pause
    exit /b 1
)

REM Porta do sistema (PORT no .env; padrao 3000)
set "PORTA=3000"
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if /i "%%a"=="PORT" set "PORTA=%%b"
    )
)

REM Ja conectado? Pula direto para o passo 2.
"%TS%" status >nul 2>&1
if not errorlevel 1 goto publicar

echo Passo 1 de 2: entrar no Tailscale com a conta da escola.
echo (o navegador vai abrir; use a conta da ESCOLA, nao uma pessoal)
echo.
"%TS%" up --hostname=apoio-escola
if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel conectar ao Tailscale. Tente de novo.
    pause
    exit /b 1
)

:publicar
echo.
echo Passo 2 de 2: publicar o sistema na rede privada (HTTPS).
"%TS%" serve --bg %PORTA%
if errorlevel 1 (
    echo.
    echo [ERRO] O Tailscale nao aceitou publicar o sistema. Confira se o HTTPS
    echo esta ligado no painel do Tailscale (DNS ^> HTTPS Certificates).
    pause
    exit /b 1
)

echo.
echo Pronto! Endereco do sistema para as professoras:
"%TS%" serve status
echo.
echo Agora convide cada professora (Meu perfil da coordenacao ^> "Acesso das
echo professoras pelo celular").
pause
