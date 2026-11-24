@echo off
chcp 65001 > nul
title InfoTech Gestão - Assistência Técnica & Vendas
echo ================================================================
echo           INFOTECH GESTÃO - ASSISTÊNCIA TÉCNICA E VENDAS
echo           Computadores, Monitores, Notebooks e Impressoras
echo ================================================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo [1/3] Verificando integridade dos arquivos...
if not exist "dist" (
    echo Compilando modulos...
    call npm.cmd run build
)

echo [2/3] Iniciando Servidor Local e Rotina de Backup Diario...
start /b "" node server\index.js

echo [3/3] Abrindo Aplicativo Executavel...
call npx.cmd electron .

if errorlevel 1 (
    echo Abrindo tela no navegador...
    start "" http://localhost:4567
)
