// Диагностика (аудит v598): разбор литерала MAP в готовой странице — ключи и их байты.
// Запуск: node docs/audit/architecture/instruments/map_keys.js <страница.html> [--json <out>]
// Только читает файл; рабочий код и сборку не меняет.
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const outIdx = process.argv.indexOf('--json');
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const text = fs.readFileSync(file, 'utf8');

function extractMap(t) {
  const start = t.indexOf('var MAP=');
  if (start < 0) throw new Error('нет var MAP=');
  const i = start + 'var MAP='.length;
  let depth = 0, q = null, j = i;
  while (j < t.length) {
    const c = t[j];
    if (q) {
      if (c === '\\') { j += 2; continue; }
      if (c === q) q = null;
    } else if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
    j++;
  }
  return { js: t.slice(i, j + 1), start: i, end: j + 1 };
}

const { js, start, end } = extractMap(text);
const MAP = eval('(' + js + ')');
const bytes = (v) => Buffer.byteLength(JSON.stringify(v), 'utf8');
const sumBytes = (keys) => keys.reduce((a, k) => a + (MAP[k] !== undefined ? bytes(MAP[k]) : 0), 0);

const rows = Object.keys(MAP).map((k) => {
  const v = MAP[k];
  let len = '';
  if (Array.isArray(v)) len = 'n=' + v.length;
  else if (v && typeof v === 'object') len = 'keys=' + Object.keys(v).length;
  else if (typeof v === 'string') len = 'str';
  return { key: k, bytes: bytes(v), type: Array.isArray(v) ? 'array' : typeof v, len };
}).sort((a, b) => b.bytes - a.bytes);
const total = rows.reduce((a, r) => a + r.bytes, 0);

const out = {
  file: path.resolve(file),
  page_bytes: fs.statSync(file).size,
  page_chars: text.length,
  map_literal_bytes: Buffer.byteLength(js, 'utf8'),
  map_start: start,
  map_end: end,
  map_json_bytes: total,
  keys: rows,
  details: {},
};

for (const k of ['map3d', 'navmesh', 'zones', 'cover', 'heights', 'wallbang', 'walls', 'lineups', 'nadelanes', 'nadeguess', 'tactics', 'pro', 'nadeplan', 'zoneprops']) {
  const v = MAP[k];
  if (v === undefined) continue;
  if (Array.isArray(v)) { out.details[k] = { type: 'array', n: v.length, bytes: bytes(v) }; continue; }
  if (typeof v !== 'object') continue;
  out.details[k] = {
    type: 'object', bytes: bytes(v),
    keys: Object.keys(v).map((kk) => {
      const vv = v[kk];
      let n = '';
      if (Array.isArray(vv)) n = 'n=' + vv.length;
      else if (typeof vv === 'string') n = 'str ' + vv.length;
      else if (typeof vv === 'number') n = 'num ' + vv;
      return { k: kk, bytes: bytes(vv), n };
    }).sort((a, b) => b.bytes - a.bytes),
  };
}

console.log('== ' + file + '  page ' + out.page_bytes + ' B');
console.log('MAP literal ' + out.map_literal_bytes + ' B at ' + start + '..' + end + ' (' + (100 * out.map_literal_bytes / out.page_bytes).toFixed(1) + '% страницы)');
console.log('ключи MAP (сумма JSON ' + total + ' B):');
for (const r of rows.slice(0, 40)) console.log('  ' + String(r.bytes).padStart(9) + ' ' + (100 * r.bytes / total).toFixed(1).padStart(5) + '%  ' + r.key.padEnd(14) + ' ' + r.type + ' ' + r.len);
if (rows.length > 40) console.log('  ... ещё ' + (rows.length - 40) + ' ключей, сумма ' + rows.slice(40).reduce((a, r) => a + r.bytes, 0) + ' B');
for (const [k, d] of Object.entries(out.details)) {
  if (!d.keys) continue;
  console.log('  -- ' + k + ' (' + d.bytes + ' B)');
  for (const kk of d.keys.slice(0, 12)) console.log('     ' + String(kk.bytes).padStart(9) + '  ' + kk.k + '  ' + kk.n);
}
if (outFile) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(out, null, 1)); console.log('json -> ' + outFile); }
