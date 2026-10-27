# Avondpartij website

## Cijfers bijwerken na een match

1. Vul de match in de Excel in zoals altijd en sla op.
2. Dubbelklik op `update-stats.bat`. Dat leest de Excel en schrijft `data/stats.js`.
   - De Excel wordt standaard gezocht op `C:\Users\elias\Desktop\Avondpartij\Statistieken_Avondpartij_totaal.xlsm`.
   - Staat hij ergens anders? Sleep het Excel-bestand op `update-stats.bat`.
3. Zet de nieuwe `data/stats.js` online (zie hieronder).

## Lokaal bekijken

```
node tools/serve.js
```

Open daarna http://localhost:5173.

## Online zetten met GitHub Pages

1. Maak op GitHub een nieuwe repository (bv. `avondpartij`) en zet de inhoud van deze map erin.
2. Ga naar Settings, dan Pages, kies "Deploy from a branch", branch `main`, map `/ (root)`.
3. Na elke update: commit en push `data/stats.js`. GitHub Pages zet het binnen een minuut online.

## Nieuwe hoofden of foto's

Zet een uitgeknipt hoofd (PNG met transparante achtergrond) in `assets/` en koppel het aan de speler
in `tools/build-data.js` bij `FACES`. Draai daarna `update-stats.bat` opnieuw.
