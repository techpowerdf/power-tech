@echo off
chcp 65001 >nul
title Power Tech - Criando Atalho na Área de Trabalho
color 0E
cd /d "%~dp0"

echo ========================================================
echo   CRIANDO ATALHO "POWER TECH" NA ÁREA DE TRABALHO
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut((Join-Path $desktop 'Power Tech.lnk')); $s.TargetPath = (Join-Path $env:SystemRoot 'System32\wscript.exe'); $s.Arguments = (Join-Path '%~dp0' 'iniciar_oculto.vbs'); $s.WorkingDirectory = '%~dp0'; $icon = (Join-Path '%~dp0' 'public\logo.ico'); if (Test-Path $icon) { $s.IconLocation = $icon + ',0' }; $s.Description = 'Power Tech - Assistência Técnica & Vendas (Sem CMD)'; $s.WindowStyle = 1; $s.Save(); }"

if %errorlevel% equ 0 (
    echo [SUCESSO] Atalho atualizado na sua Área de Trabalho com sucesso!
    echo.
    echo O sistema iniciará automaticamente em segundo plano,
    echo SEM a tela preta do prompt de comando (CMD 100%% oculto)!
) else (
    echo [AVISO] Não foi possível criar automaticamente.
)

echo.
echo ========================================================
pause
