// Zet het overzicht met de selecties van seizoen 1 om naar seizoen1-selecties.json.
// Eenmalig nodig: seizoen 1 is afgelopen, het JSON-bestand blijft in de website-map staan.
// Gebruik: node convert-s1.js "pad\naar\Seizoen1_selecties.xlsx"
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Andere schrijfwijzen in het overzicht -> naam zoals in de grote Excel
const ALIASES = { 'rein v': 'Rein VD', 'japser vdp': 'Jasper VdP' };

(async () => {
  const file = process.argv[2] || 'C:/Users/elias/Desktop/Seizoen1_selecties.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const val = c => { let v = c.value; if (v && typeof v === 'object') v = v.result ?? (v.richText ? v.richText.map(t => t.text).join('') : ''); return v == null ? '' : String(v).trim(); };

  // Zoek de rij met MD1, MD2, ... en de rij "Uitslagen"
  let headerRow = null, resultRow = null;
  ws.eachRow((r, i) => {
    if (!headerRow && /^MD\s*1$/i.test(val(r.getCell(1)))) headerRow = i;
    if (/^uitslagen$/i.test(val(r.getCell(1)))) resultRow = i + 2;
  });
  if (!headerRow) throw new Error('Rij met MD1, MD2, ... niet gevonden.');

  const out = { seizoen: 1, matchen: {}, uitslagen: {} };
  for (let c = 1; c <= ws.columnCount; c++) {
    const m = /^MD\s*(\d+)$/i.exec(val(ws.getRow(headerRow).getCell(c)));
    if (!m) continue;
    const md = +m[1], names = [];
    for (let r = headerRow + 1; r < (resultRow ? resultRow - 2 : ws.rowCount + 1); r++) {
      let n = val(ws.getRow(r).getCell(c));
      if (!n) continue;
      n = ALIASES[n.toLowerCase()] || n;
      if (names.includes(n)) console.log(`LET OP: ${n} staat dubbel bij MD${md}.`);
      else names.push(n);
    }
    out.matchen[md] = names;
    if (resultRow) out.uitslagen[md] = val(ws.getRow(resultRow).getCell(c));
  }
  const dest = path.join(__dirname, 'seizoen1-selecties.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  console.log(`Geschreven: ${Object.keys(out.matchen).length} matchen naar ${dest}`);
})().catch(e => { console.error(e.message); process.exit(1); });
