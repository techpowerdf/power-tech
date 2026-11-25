@echo off
chcp 65001 >nul
echo ======================================================
echo    SINCRONIZANDO PROJETO NO GITHUB (techpowerdf/power-tech)
echo ======================================================
echo.

cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"

echo 1. Adicionando alterações...
git add -A

echo.
echo 2. Registrando alterações...
git commit -m "atualizacao automatica: login padrao, escrita dinamica e correcoes" 2>nul

echo.
echo 3. Enviando para o GitHub (main)...
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo  SUCESSO! O projeto foi sincronizado no GitHub!
    echo ======================================================
) else (
    echo.
    echo ======================================================
    echo  ATENÇÃO: Se solicitada autorização, confirme o envio.
    echo ======================================================
)
echo.
pause
