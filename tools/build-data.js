// Leest de Avondpartij-Excel en schrijft data/stats.js voor de website.
// Gebruik: node build-data.js "pad\naar\Statistieken_Avondpartij_totaal.xlsm"
// Macro's worden niet uitgevoerd: het bestand wordt enkel als data gelezen.

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const DEFAULT_EXCEL = 'C:\\Users\\elias\\Desktop\\Avondpartij\\Statistieken_Avondpartij_totaal.xlsm';

// Hoofden en foto's worden gevonden op bestandsnaam = spelersnaam uit de Excel:
//   assets/koppen/Keane VI.png   -> uitgeknipt hoofd (PNG met transparante achtergrond)
//   assets/fotos/Keane VI.jpg    -> gewone foto (enkel gebruikt als er geen hoofd is)
const ASSETS = path.join(__dirname, '..', 'assets');

function findImages(folder, exts) {
  const dir = path.join(ASSETS, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => exts.includes(path.extname(f).toLowerCase()))
    .map(f => ({
      key: path.basename(f, path.extname(f)).trim().toLowerCase(),
      file: f,
      url: folder + '/' + encodeURIComponent(f),
      kb: Math.round(fs.statSync(path.join(dir, f)).size / 1024),
    }));
}

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

  const heads = findImages('koppen', ['.png']);
  const photos = findImages('fotos', ['.jpg', '.jpeg', '.png', '.webp']);
  const find = (list, name) => list.find(i => i.key === name.toLowerCase());

  const players = {};
  for (const p of perf) {
    const head = find(heads, p.name), photo = find(photos, p.name);
    const pl = players[p.name] || (players[p.name] = {
      name: p.name, face: head ? head.url : null, photo: photo ? photo.url : null,
      active: active[p.name] !== false, seasons: {}, games: [],
    });
    const s = pl.seasons[p.s] || (pl.seasons[p.s] = { c: 0, g: 0, a: 0 });
    s.c += p.c; s.g += p.g; s.a += p.a;
    if (p.md != null) pl.games.push([p.s, p.md, p.g, p.a]);
  }

  const seasons = [...new Set(matches.map(m => m.s).concat(perf.map(p => p.s)))].sort((a, b) => a - b);
  const last = matches[matches.length - 1] || null;

  const data = {
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

  // Controle op foto's: verkeerde naam of te groot bestand
  const names = new Set(data.players.map(p => p.name.toLowerCase()));
  for (const [folder, list] of [['koppen', heads], ['fotos', photos]]) {
    for (const img of list) {
      if (!names.has(img.key)) console.log(`LET OP: assets/${folder}/${img.file} hoort bij geen enkele speler. Gebruik exact de naam uit de Excel.`);
      if (img.kb > 600) console.log(`LET OP: assets/${folder}/${img.file} is ${img.kb} KB. Maak hem kleiner (max. 600 KB) zodat de site snel blijft.`);
    }
  }
  const withHead = data.players.filter(p => p.face).map(p => p.name);
  console.log(`Hoofden gevonden voor: ${withHead.join(', ') || 'niemand'}.`);

  const played = matches.length;
  console.log(`Klaar: ${data.players.length} spelers, ${played} matchen, seizoenen ${seasons.join(', ')}.`);
  if (last) console.log(`Laatste match: seizoen ${last.s}, matchdag ${last.md} tegen ${last.tegen} (${last.gv}-${last.gt}).`);
  console.log(`Geschreven naar ${out}`);
})().catch(err => {
  console.error('Er ging iets mis bij het lezen van de Excel:', err.message);
  process.exit(1);
});
