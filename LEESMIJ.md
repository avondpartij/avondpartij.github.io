# Avondpartij website

Live: **https://avondpartij.github.io/**

Alles wat je aanpast, zet je online met één bestand: **`update-stats.bat`**.
Dubbelklik erop, typ `j` als het vraagt "Alles meteen online zetten?" en druk Enter.
Binnen een paar minuten staat het op de website (ververs de pagina met Ctrl+F5).

---

## 1. Cijfers bijwerken na een match

1. Vul de match in de Excel in zoals altijd en sla op.
2. Dubbelklik op `update-stats.bat` en typ `j`.

Staat de Excel niet op `C:\Users\elias\Desktop\Avondpartij\Statistieken_Avondpartij_totaal.xlsm`?
Sleep het Excel-bestand dan op `update-stats.bat` in plaats van te dubbelklikken.

---

## 2. Een uitgeknipt hoofd toevoegen of vervangen

Een hoofd verschijnt op vier plaatsen: op de speelkaart in de top 3, op de spelerskaart,
achter het klassement (op grote schermen) en in het spelletje Hooghouden.

**Stap 1: het hoofd uitknippen** (kies één manier)

- **Paint in Windows 11:** open de foto in Paint, klik op *Achtergrond verwijderen*.
  Snijd bij met *Bijsnijden* zodat het hoofd het beeld vult.
  Kies *Bestand > Opslaan als > PNG-afbeelding*.
- **iPhone:** open de foto, hou je vinger op het hoofd tot het oplicht, kies *Delen > Afbeelding bewaren*.
  Stuur het bestand naar je computer.
- **Website:** remove.bg (gratis), download het resultaat als PNG.

Belangrijk: het moet een **PNG met doorzichtige achtergrond** zijn. Een JPG werkt niet
(die heeft altijd een witte rand).

**Stap 2: de juiste naam geven**

Geef het bestand **exact dezelfde naam als de speler in de Excel**, met `.png` erachter.
Hoofdletters maken niet uit, spaties wel.

| Speler in de Excel | Bestandsnaam      |
|--------------------|-------------------|
| Keane VI           | `Keane VI.png`    |
| Robbe G            | `Robbe G.png`     |
| Elias VdB          | `Elias VdB.png`   |

**Stap 3: in de juiste map zetten**

Zet het bestand in de map **`assets\koppen`**. Bestaat er al een bestand met die naam,
vervang het dan.

**Stap 4: online zetten**

Dubbelklik op `update-stats.bat` en typ `j`.
Het venster toont "Hoofden gevonden voor: ..." zodat je ziet of jouw speler erbij staat.
Staat er "LET OP: ... hoort bij geen enkele speler", dan klopt de naam niet.

**Hoofd verwijderen?** Wis het bestand uit `assets\koppen` en draai `update-stats.bat`.

Tip: hou de afbeelding klein, ongeveer 400 x 400 pixels. In Paint: *Formaat wijzigen* > *Pixels*.

---

## 3. Een gewone foto op een spelerskaart

Voor spelers zonder uitgeknipt hoofd kan je een gewone foto tonen op hun kaart.

1. Geef de foto de naam van de speler, bv. `Milan V.jpg`.
2. Zet hem in de map **`assets\fotos`**.
3. Dubbelklik op `update-stats.bat` en typ `j`.

Heeft een speler zowel een hoofd als een foto, dan wint het hoofd.
Foto weghalen: wis het bestand en draai `update-stats.bat`.

---

## 4. De grote foto's van de website vervangen

Vervang het bestand door een nieuw bestand **met exact dezelfde naam**:

| Waar op de website                        | Bestand                  |
|-------------------------------------------|--------------------------|
| Opening (de foto in het donker)           | `assets\opening.jpg`     |
| Club in cijfers (foto naast de cijfers)   | `assets\club.jpg`        |
| Logo rechtsboven                          | `assets\patch.png`       |
| Icoontje in het browsertabblad            | `assets\logo-basic.jpg`  |

Daarna: dubbelklik op `update-stats.bat` en typ `j`.

Hou grote foto's onder de 600 KB (ongeveer 1400 pixels breed) zodat de site snel laadt
op een gsm. In Paint: *Formaat wijzigen* > *Pixels* > breedte 1400.

---

## Lokaal bekijken voor je iets online zet

Open een terminal in deze map en typ:

```
node tools/serve.js
```

Open daarna http://localhost:5173 in je browser.
