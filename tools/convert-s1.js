// Leest het overzicht met de selecties van seizoen 1 (Seizoen1_selecties.xlsx)
// en bewaart het als seizoen1-selecties.json in deze map.
// update-stats.bat doet dit automatisch zolang het overzicht op het bureaublad staat.
// Los gebruiken: node convert-s1.js "pad\naar\Seizoen1_selecties.xlsx"
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const DEFAULT_FILE = 'C:/Users/elias/Desktop/Seizoen1_selecties.xlsx';
const JSON_FILE = path.join(__dirname, 'seizoen1-selecties.json');

// Andere schrijfwijzen in het overzicht -> naam zoals in de grote Excel
const ALIASES = { 'rein v': 'Rein VD', 'japser vdp': 'Jasper VdP' };

async function readSelections(file) {
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
  if (!headerRow) throw new Error('In het overzicht van seizoen 1 staat geen rij met MD1, MD2, ...');

  const out = { seizoen: 1, matchen: {}, uitslagen: {} };
  for (let c = 1; c <= ws.columnCount; c++) {
    const m = /^MD\s*(\d+)$/i.exec(val(ws.getRow(headerRow).getCell(c)));
    if (!m) continue;
    const md = +m[1], names = [];
    for (let r = headerRow + 1; r < (resultRow ? resultRow - 2 : ws.rowCount + 1); r++) {
      let n = val(ws.getRow(r).getCell(c));
      if (!n) continue;
      n = ALIASES[n.toLowerCase()] || n;
      if (names.includes(n)) console.log(`LET OP: ${n} staat dubbel bij MD${md} in het overzicht van seizoen 1.`);
      else names.push(n);
    }
    out.matchen[md] = names;
    if (resultRow) out.uitslagen[md] = val(ws.getRow(resultRow).getCell(c));
  }
  return out;
}

// Neemt het overzicht opnieuw over als het bestand bestaat; anders blijft de bewaarde versie.
async function refresh(file = DEFAULT_FILE) {
  if (!fs.existsSync(file)) return false;
  const out = await readSelections(file);
  fs.writeFileSync(JSON_FILE, JSON.stringify(out, null, 1) + '\n');
  return true;
}

module.exports = { readSelections, refresh, JSON_FILE };

if (require.main === module) {
  refresh(process.argv[2] || DEFAULT_FILE)
    .then(ok => console.log(ok ? `Geschreven naar ${JSON_FILE}` : 'Overzicht niet gevonden.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
