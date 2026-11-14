@echo off
setlocal
REM ---------------------------------------------------------------------------
REM Mantem o Apoio ao Estudante no ar.
REM
REM Rodado pelo Agendador de Tarefas do Windows quando o computador liga
REM (tarefa "Apoio ao Estudante", criada pelo instalador), antes mesmo de
REM alguem entrar no Windows. Sem janela.
REM
REM   1. Se a IA local (Ollama) nao estiver respondendo, inicia o Ollama.
REM   2. Inicia o sistema. Se ele fechar por algum erro, abre de novo em
REM      10 segundos.
REM
REM O que o sistema escreve vai para data\servico.log (refeito a cada inicio).
REM ---------------------------------------------------------------------------

cd /d "%~dp0.."

REM Caminhos do Node e do Ollama (e a pasta dos modelos de IA) gravados
REM pelo instalador
if exist "%~dp0caminhos.cmd" call "%~dp0caminhos.cmd"
if not defined NODE_EXE set "NODE_EXE=node"

if not exist "data" mkdir "data"

:inicio
if defined OLLAMA_EXE (
    curl.exe -s -o nul --max-time 3 http://127.0.0.1:11434/
    if errorlevel 1 start "" /b "%OLLAMA_EXE%" serve
)

REM Caminho completo: permite achar e encerrar este processo (windows\tarefa.ps1)
"%NODE_EXE%" "%CD%\server\index.js" > "data\servico.log" 2>&1

REM Fechou: espera 10 segundos e abre de novo ("timeout" nao funciona sem
REM janela, por isso o ping)
ping -n 11 127.0.0.1 >nul
goto inicio
