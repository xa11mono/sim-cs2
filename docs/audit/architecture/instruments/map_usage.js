// Диагностика (аудит v598): какие поля набора карты (MAP.*) движок читает явно, а какие — нет.
// Запуск: node docs/audit/architecture/instruments/map_usage.js <страница.html> [--json out.json]
// Только читает; ничего не меняет. «0 ссылок» — не приговор: поле может читаться через цикл по MAP
// (проверять отдельно), но это первый список на проверку неиспользуемого.
const fs = require('fs');
const path = require('path');
const file = process.argv[2];
const outIdx = process.argv.indexOf('--json');
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const text = fs.readFileSync(file, 'utf8');
const ROOT = path.dirname(path.resolve(file));
const GAME = path.join(ROOT, 'src', 'game');

const start = text.indexOf('var MAP=');
let i = text.indexOf('{', start), depth = 0, q = null, j = i;
for (; j < text.length; j++) {
  const c = text[j];
  if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; }
  else if (c === '"' || c === "'" || c === '`') q = c;
  else if (c === '{') depth++;
  else if (c === '}' && --depth === 0) break;
}
const MAP = eval('(' + text.slice(i, j + 1) + ')');
const keys = Object.keys(MAP);

let src = '';
for (const f of fs.readdirSync(GAME).filter((f) => /\.(js|html)$/.test(f)).sort()) src += fs.readFileSync(path.join(GAME, f), 'utf8') + '\n';

const rows = keys.map((k) => {
  const direct = (src.match(new RegExp('MAP\\.' + k + '\\b', 'g')) || []).length;
  const bracket = (src.match(new RegExp('MAP\\[' + JSON.stringify(k) + '\\]', 'g')) || []).length;
  const word = (src.match(new RegExp('\\b' + k + '\\b', 'g')) || []).length;
  return { key: k, direct, bracket, word, bytes: Buffer.byteLength(JSON.stringify(MAP[k]), 'utf8') };
}).sort((a, b) => b.bytes - a.bytes);

const out = { file: path.resolve(file), keys: rows, total_bytes: rows.reduce((a, r) => a + r.bytes, 0) };
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log('поле'.padEnd(14) + 'байт'.padStart(10) + '  MAP.x  MAP["x"]  слово');
for (const r of rows) console.log(r.key.padEnd(14) + String(r.bytes).padStart(10) + '  ' + String(r.direct).padStart(5) + '  ' + String(r.bracket).padStart(7) + '  ' + String(r.word).padStart(6) + (r.direct + r.bracket === 0 ? '   ← нет прямых ссылок' : ''));

