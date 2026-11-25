@echo off
chcp 65001 >nul
echo ======================================================
echo    PUBLICANDO PROJETO NO GITHUB (techpowerdf/power-tech)
echo ======================================================
echo.

cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"

echo 1. Verificando status dos arquivos...
git status

echo.
echo 2. Enviando para o GitHub (main)...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo  SUCESSO! O projeto foi publicado no GitHub!
    echo ======================================================
) else (
    echo.
    echo ======================================================
    echo  ATENCAO: Se solicitada autorizacao, faca o login no
    echo  navegador para concluir o envio ao GitHub.
    echo ======================================================
)
echo.
pause
