@echo off
rem Werk de website bij met de laatste cijfers uit de Excel en zet ze online.
rem Sleep eventueel een ander Excel-bestand op dit bestand om dat te gebruiken.
cd /d "%~dp0tools"
if not exist node_modules (
  echo Eerste keer: hulpmiddelen installeren...
  call npm install --silent
)
node build-data.js %1
if errorlevel 1 goto einde

cd /d "%~dp0"
echo.
set /p ONLINE=Nieuwe cijfers meteen online zetten? (j/n):
if /i not "%ONLINE%"=="j" goto einde

git add data/stats.js
git diff --cached --quiet && (
  echo Geen nieuwe cijfers: de website is al up-to-date.
  goto einde
)
git commit -q -m "Cijfers bijgewerkt"
git push -q
if errorlevel 1 (
  echo Online zetten mislukt. Controleer je internetverbinding en probeer opnieuw.
) else (
  echo Klaar! Binnen een paar minuten staat alles op https://avondpartij.github.io/avondpartij/
)

:einde
echo.
pause
