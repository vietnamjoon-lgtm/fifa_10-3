@echo off
cd /d "%~dp0"
start "TOUCHLINE SERVER" /min tools\node.exe server.mjs
timeout /t 2 /nobreak >nul
start "" http://localhost:4173
