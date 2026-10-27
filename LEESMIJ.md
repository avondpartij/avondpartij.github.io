# Avondpartij website

Live: https://avondpartij.github.io/avondpartij/

## Cijfers bijwerken na een match

1. Vul de match in de Excel in zoals altijd en sla op.
2. Dubbelklik op `update-stats.bat`.
   - Het leest de Excel en maakt `data/stats.js` opnieuw.
   - Daarna vraagt het "Nieuwe cijfers meteen online zetten?". Typ `j` en druk Enter.
   - Binnen een paar minuten staan de nieuwe cijfers op de website.
3. Staat de Excel niet op `C:\Users\elias\Desktop\Avondpartij\Statistieken_Avondpartij_totaal.xlsm`?
   Sleep het Excel-bestand dan op `update-stats.bat`.

## Lokaal bekijken

```
node tools/serve.js
```

Open daarna http://localhost:5173.

## Andere aanpassingen online zetten

Heb je iets anders aangepast (tekst, kleuren, foto's)? Open een terminal in deze map en typ:

```
git add -A
git commit -m "Beschrijving van de aanpassing"
git push
```

## Nieuwe hoofden of foto's

Zet een uitgeknipt hoofd (PNG met transparante achtergrond) in `assets/` en koppel het aan de speler
in `tools/build-data.js` bij `FACES`. Draai daarna `update-stats.bat` opnieuw.
