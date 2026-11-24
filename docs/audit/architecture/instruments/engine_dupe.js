// Диагностика (аудит v598): что в двух готовых страницах общее (движок, стили, шрифты, звуки) и что своё (данные карты).
// Запуск: node docs/audit/architecture/instruments/engine_dupe.js ancient-radar.html mirage-radar.html [--json out.json]
// Только читает; ничего не меняет.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [a, b] = process.argv.slice(2, 4);
const outIdx = process.argv.indexOf('--json');
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const read = (f) => fs.readFileSync(f, 'utf8');
const B = (s) => Buffer.byteLength(s, 'utf8');
const h = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

function parts(text) {
  const scripts = [...text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => ({ start: m.index, open: m.index + m[0].indexOf('>') + 1, end: m.index + m[0].length - 9, text: m[1] }));
  scripts.sort((x, y) => y.text.length - x.text.length);
  const big = scripts[0];
  const styles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  function cutLiteral(s, name) {
    const at = s.indexOf('var ' + name + '=');
    if (at < 0) return { skipped: s, literal: '' };
    let i = s.indexOf('{', at), depth = 0, q = null, j = i;
    for (; j < s.length; j++) {
      const c = s[j];
      if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; }
      else if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) break;
    }
    return { skipped: s.slice(0, at) + '@@' + name + '@@' + s.slice(j + 1), literal: s.slice(at, j + 1) };
  }
  let core = cutLiteral(big.text, 'MAP');
  const snd = cutLiteral(core.skipped, 'SND_DATA');
  return { scripts, big, styles, core: snd.skipped.replace(/\s+/g, ''), mapLiteral: core.literal, sndLiteral: snd.literal, markup: text.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style[^>]*>[\s\S]*?<\/style>/g, '') };
}

const A = parts(read(a)), Bp = parts(read(b));
const rows = [];
function cmp(name, x, y) {
  rows.push({ name, a: B(x), b: B(y), same: x === y, samePct: x === y ? 100 : (100 * Math.min(B(x), B(y)) / Math.max(B(x), B(y))).toFixed(1), hashA: h(x), hashB: h(y) });
}
cmp('движок (скрипт без MAP/SND)', A.core, Bp.core);
cmp('литерал MAP (JSON-текст)', A.mapLiteral, Bp.mapLiteral);
cmp('SND_DATA (звуки)', A.sndLiteral, Bp.sndLiteral);
cmp('CSS (все <style>)', A.styles.join('\n/*---*/\n'), Bp.styles.join('\n/*---*/\n'));
cmp('HTML-разметка (без script/style)', A.markup, Bp.markup);

const out = { files: [path.resolve(a), path.resolve(b)], rows, engine_bytes: Math.max(B(A.core), B(Bp.core)),
  shared_per_build: B(A.core) + A.styles.join('').length + B(A.sndLiteral) };
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log('движок без MAP/SND: A ' + B(A.core) + ' B ' + B(Bp.core) + (A.core === Bp.core ? '  ОДИНАКОВЫ (бит в бит)' : '  отличаются'));
console.log('  sha1 A ' + h(A.core) + '  B ' + h(Bp.core));
for (const r of rows) console.log('  ' + r.name.padEnd(32) + ' A ' + String(r.a).padStart(9) + '  B ' + String(r.b).padStart(9) + '  совпало ' + r.samePct + '%  ' + r.same);
console.log('общий движок на одну сборку: ' + out.engine_bytes + ' B; вместе со звуками и CSS: ' + out.shared_per_build + ' B');
