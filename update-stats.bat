@echo off
rem Werk de website bij: nieuwe cijfers uit de Excel, en nieuwe foto's of hoofden in de map assets.
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
set /p ONLINE=Alles meteen online zetten? (j/n):
if /i not "%ONLINE%"=="j" goto einde

git add -A
git diff --cached --quiet && (
  echo Niets nieuws: de website is al up-to-date.
  goto einde
)
git commit -q -m "Website bijgewerkt"
git push -q
if errorlevel 1 (
  echo Online zetten mislukt. Controleer je internetverbinding en probeer opnieuw.
) else (
  echo Klaar! Binnen een paar minuten staat alles op https://avondpartij.github.io/
)

:einde
echo.
pause
