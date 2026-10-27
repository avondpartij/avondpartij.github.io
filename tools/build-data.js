// Leest de Avondpartij-Excel en schrijft data/stats.js voor de website.
// Gebruik: node build-data.js "pad\naar\Statistieken_Avondpartij_totaal.xlsm"
// Macro's worden niet uitgevoerd: het bestand wordt enkel als data gelezen.

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const DEFAULT_EXCEL = 'C:\\Users\\elias\\Desktop\\Avondpartij\\Statistieken_Avondpartij_totaal.xlsm';

// Spelers met een uitgeknipt hoofd (assets/head-*.png) of een foto.
const FACES = {
  'Jasper VdP': 'head-jasper.png',
  'Keane VI': 'head-keane.png',
  'Maarten M': 'head-maarten.png',
  'Robbe VL': 'head-robbe.png',
};
const PHOTOS = {
  'Keane VI': 'keane.jpg',
};

function cellValue(cell) {
  let v = cell.value;
  if (v && typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ('result' in v) v = v.result;
    else if (v.richText) v = v.richText.map(r => r.text).join('');
    else if ('formula' in v || 'sharedFormula' in v) v = null;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v == null ? '' : v;
}

function readTable(wb, sheetName, firstDataRow, cols) {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`Tabblad "${sheetName}" niet gevonden in de Excel.`);
  const rows = [];
  ws.eachRow((row, i) => {
    if (i < firstDataRow) return;
    const r = [];
    for (let c = 1; c <= cols; c++) r.push(cellValue(row.getCell(c)));
    rows.push(r);
  });
  return rows;
}

const num = v => (v === '' || v == null || isNaN(+v) ? 0 : +v);

(async () => {
  const excelPath = process.argv[2] || DEFAULT_EXCEL;
  if (!fs.existsSync(excelPath)) {
    console.error(`Excel niet gevonden: ${excelPath}`);
    process.exit(1);
  }

  // exceljs leest .xlsm prima zolang de extensie .xlsx is: kopieer naar een tijdelijk bestand.
  const tmp = path.join(require('os').tmpdir(), `avp-stats-${Date.now()}.xlsx`);
  fs.copyFileSync(excelPath, tmp);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(tmp);
  } finally {
    fs.unlinkSync(tmp);
  }

  // Wedstrijden: Seizoen | MD | Fase | Datum | Tegenstander | Goals AVP | Goals tegen | ...
  const matches = readTable(wb, 'Wedstrijden', 5, 9)
    .filter(r => r[0] !== '' && r[1] !== '' && r[5] !== '' && r[6] !== '')
    .map(r => ({
      s: num(r[0]), md: num(r[1]), fase: String(r[2] || ''), datum: String(r[3] || ''),
      tegen: String(r[4] || ''), gv: num(r[5]), gt: num(r[6]),
    }))
    .sort((a, b) => a.s - b.s || a.md - b.md);

  // Prestaties: Seizoen | MD | Speler | Caps | Goals | Assists | ...
  const perf = readTable(wb, 'Prestaties', 5, 6)
    .filter(r => r[0] !== '' && r[2] !== '')
    .map(r => ({
      s: num(r[0]), md: r[1] === '' ? null : num(r[1]), name: String(r[2]).trim(),
      c: num(r[3]), g: num(r[4]), a: num(r[5]),
    }));

  // Actieve spelers uit Lijsten (kolom A naam, B actief)
  const active = {};
  readTable(wb, 'Lijsten', 4, 2).forEach(r => {
    if (r[0] !== '') active[String(r[0]).trim()] = String(r[1]).toLowerCase() !== 'nee';
  });

  const players = {};
  for (const p of perf) {
    const pl = players[p.name] || (players[p.name] = {
      name: p.name, face: FACES[p.name] || null, photo: PHOTOS[p.name] || null,
      active: active[p.name] !== false, seasons: {}, games: [],
    });
    const s = pl.seasons[p.s] || (pl.seasons[p.s] = { c: 0, g: 0, a: 0 });
    s.c += p.c; s.g += p.g; s.a += p.a;
    if (p.md != null) pl.games.push([p.s, p.md, p.g, p.a]);
  }

  const seasons = [...new Set(matches.map(m => m.s).concat(perf.map(p => p.s)))].sort((a, b) => a - b);
  const last = matches[matches.length - 1] || null;

  const data = {
    generated: new Date().toISOString(),
    current: seasons[seasons.length - 1],
    seasons,
    lastMatch: last,
    matches,
    players: Object.values(players).sort((a, b) => a.name.localeCompare(b.name)),
  };

  const out = path.join(__dirname, '..', 'data', 'stats.js');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out,
    '// Automatisch gemaakt door tools/build-data.js. Niet met de hand aanpassen.\n' +
    'window.AVP_DATA = ' + JSON.stringify(data) + ';\n');

  const played = matches.length;
  console.log(`Klaar: ${data.players.length} spelers, ${played} matchen, seizoenen ${seasons.join(', ')}.`);
  if (last) console.log(`Laatste match: seizoen ${last.s}, matchdag ${last.md} tegen ${last.tegen} (${last.gv}-${last.gt}).`);
  console.log(`Geschreven naar ${out}`);
})().catch(err => {
  console.error('Er ging iets mis bij het lezen van de Excel:', err.message);
  process.exit(1);
});
