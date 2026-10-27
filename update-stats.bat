@echo off
rem Werk de website bij met de laatste cijfers uit de Excel.
rem Sleep eventueel een ander Excel-bestand op dit bestand om dat te gebruiken.
cd /d "%~dp0tools"
if not exist node_modules (
  echo Eerste keer: hulpmiddelen installeren...
  call npm install --silent
)
node build-data.js %1
echo.
pause
