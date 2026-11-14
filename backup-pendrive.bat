@echo off
setlocal
cd /d "%~dp0"

REM ---------------------------------------------------------------------------
REM Copia o banco do sistema (data\apoio.sqlite e os backups diarios) para um
REM pendrive ou HD externo. Os backups automaticos ficam NO MESMO computador
REM (data\backups) e nao protegem contra o computador estragar ou ser roubado.
REM Rode este arquivo pelo menos uma vez por semana.
REM
REM ATENCAO: o arquivo copiado tem dados pessoais das criancas (LGPD).
REM Guarde o pendrive em local trancado e nao use para outras coisas.
REM ---------------------------------------------------------------------------

echo Copia de seguranca do Apoio ao Estudante para pendrive
echo.

if not exist "data\apoio.sqlite" (
    echo [ERRO] Nao encontrei data\apoio.sqlite nesta pasta. Nada foi copiado.
    pause
    exit /b 1
)

set /p DRIVE="Digite a LETRA do pendrive (ex: E) e aperte Enter: "
set "DRIVE=%DRIVE::=%"
if "%DRIVE%"=="" (
    echo Nenhuma letra digitada. Nada foi copiado.
    pause
    exit /b 1
)
if not exist "%DRIVE%:\" (
    echo [ERRO] A unidade %DRIVE%: nao foi encontrada. Confira se o pendrive esta conectado.
    pause
    exit /b 1
)

REM Data e hora no formato AAAA-MM-DD_HHMM (nao depende do idioma do Windows)
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%d"
set "TARGET=%DRIVE%:\ApoioEstudante-backup\%STAMP%"

mkdir "%TARGET%" 2>nul
REM Copia feita pelo proprio banco: segura mesmo com o sistema aberto
node "server\tools\backupAgora.js" "%TARGET%\apoio.sqlite"
if errorlevel 1 (
    echo [ERRO] Nao foi possivel copiar o banco para %TARGET%.
    pause
    exit /b 1
)
if exist "data\backups" xcopy /e /i /y /q "data\backups" "%TARGET%\backups" >nul

echo.
echo Pronto! Copia salva em %TARGET%
echo Para restaurar: feche o sistema, apague data\apoio.sqlite-wal e data\apoio.sqlite-shm
echo (se existirem) e copie o apoio.sqlite do pendrive para a pasta data.
echo.
pause
