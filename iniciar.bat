@echo off
setlocal
cd /d "%~dp0"

REM ---------------------------------------------------------------------------
REM Abre o Apoio ao Estudante.
REM
REM Instalado pelo instalador, o sistema ja fica no ar sozinho (tarefa do
REM Windows, ver windows\servico.cmd): aqui so abrimos o navegador.
REM Sem o instalador (copia manual da pasta), este arquivo confere o Node.js
REM e a IA, abre o sistema nesta janela e o navegador.
REM ---------------------------------------------------------------------------

REM Porta (PORT) e modelo de IA (OLLAMA_MODEL) configurados no .env
set "PORTA=3000"
set "MODELO=qwen2.5:7b"
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if /i "%%a"=="PORT" set "PORTA=%%b"
        if /i "%%a"=="OLLAMA_MODEL" set "MODELO=%%b"
    )
)

REM Ja esta no ar? So abre o navegador.
curl.exe -s -o nul --max-time 3 http://127.0.0.1:%PORTA%/
if not errorlevel 1 (
    start "" http://127.0.0.1:%PORTA%
    exit /b 0
)

echo Iniciando o Apoio ao Estudante...
echo (esta janela precisa ficar aberta enquanto voce estiver usando o sistema)
echo.

REM --- Passo 1: Node.js e obrigatorio - sem ele o sistema nao roda ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Node.js nao foi encontrado nesta maquina.
    echo.
    echo O sistema precisa do Node.js para funcionar. Baixe e instale em:
    echo   https://nodejs.org
    echo ^(baixe a versao "LTS" e siga o instalador com as opcoes padrao^)
    echo.
    echo Depois de instalar, feche esta janela e clique de novo em iniciar.bat.
    echo.
    pause
    exit /b 1
)

REM --- Passo 2: Ollama - a IA local que gera as atividades ---
where ollama >nul 2>nul
if errorlevel 1 (
    echo [AVISO] O Ollama nao foi encontrado nesta maquina.
    echo O sistema abre normalmente, mas a GERACAO DE ATIVIDADES fica
    echo indisponivel ate o Ollama ser instalado. Ele e gratuito:
    echo   https://ollama.com/download
    echo e depois rode "ollama pull %MODELO%" em um terminal. Veja o passo
    echo a passo completo no README.md.
    echo.
) else (
    REM Ollama esta instalado - confere se o modelo do .env ja foi baixado
    ollama list 2>nul | findstr /i /c:"%MODELO%" >nul
    if errorlevel 1 (
        echo O modelo de IA ^(%MODELO%^) ainda nao esta baixado
        echo nesta maquina. Baixando agora - isso acontece so uma vez e pode
        echo levar alguns minutos, dependendo da internet...
        echo.
        ollama pull %MODELO%
        if errorlevel 1 (
            echo.
            echo [AVISO] Nao foi possivel baixar o modelo agora ^(sem internet,
            echo ou o Ollama ainda nao abriu em segundo plano^). A geracao de
            echo atividades fica indisponivel ate o modelo ser baixado.
            echo Pode tentar de novo mais tarde rodando
            echo "ollama pull %MODELO%" em um terminal.
            echo.
        )
    )
)

start "" cmd /c "timeout /t 2 >nul && start http://127.0.0.1:%PORTA%"

node server\index.js

echo.
echo O servidor foi encerrado.
pause
