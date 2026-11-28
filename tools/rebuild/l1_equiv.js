// (28.11, система проверок H-3) Эквивалентность двух отчётов L1 одного коммита (старая система ↔ новая): те же хэши короткого отпечатка
// (родитель и коммит), те же строки наблюдателя инвариантов / I-23 / ядра (без пометки «· кэш»), те же ответы каждой сцены (родитель и
// коммит), тот же итог (без времени). Сцена, которой нет в одном отчёте, — разница; ошибка исполнения в любом — разница.
// Запуск: node tools/rebuild/l1_equiv.js <старый.md> <новый.md> [--json]  → код 0 — равны по всем пунктам
'use strict';
const fs = require('fs');
const [a, b] = process.argv.slice(2).filter(x => !x.startsWith('--')), JS = process.argv.includes('--json');
function parse(f) {
  const t = fs.readFileSync(f, 'utf8'), R = { status: '', fp: {}, chk: {}, scenes: {} };
  const st = /^Итог: \*\*(.*?)\*\*/m.exec(t); R.status = st ? st[1].replace(/ \(страницы равны\)$/, '') : '?';
  let sec = '';
  for (const raw of t.split('\n')) {
    if (raw.startsWith('## ')) { sec = raw; continue; }
    const l = raw.replace(/ · кэш$/, '');
    let m;
    if (/Короткий отпечаток/.test(sec) && (m = /^- (\w+) м(\d+): (.*)$/.exec(l))) R.fp[m[1] + ' м' + m[2]] = m[3].replace(/ \((тот же|\*\*другой\*\*|\*\*проверить\*\*)\)$/, '');
    else if (/Инварианты и ядра/.test(sec) && (m = /^- (.+?): (код .*)$/.exec(l))) R.chk[m[1]] = m[2];
    else if (/сцены/i.test(sec) && (m = /^- ([\w-]+): (.*)$/.exec(l))) {
      let v = m[2], pc;
      if ((pc = /^(.*) \(тот же: страница \w+ та же\)$/.exec(v))) v = [pc[1], pc[1]];
      else if ((pc = /^(.*) \(тот же\)$/.exec(v))) v = [pc[1], pc[1]];
      else if ((pc = /^(.*) → \*\*(.*)\*\*$/.exec(v))) v = [pc[1], pc[2]];
      else v = ['?', v];
      R.scenes[m[1]] = v;
    }
  }
  return R;
}
const A = parse(a), B = parse(b), diff = [];
if (A.status.replace(/ · .*/, '') !== B.status.replace(/ · .*/, '')) diff.push('итог: ' + A.status + ' ≠ ' + B.status);
for (const k of new Set([...Object.keys(A.fp), ...Object.keys(B.fp)])) if (A.fp[k] !== B.fp[k]) diff.push('отпечаток ' + k + ': ' + A.fp[k] + ' ≠ ' + B.fp[k]);
for (const k of new Set([...Object.keys(A.chk), ...Object.keys(B.chk)])) if (A.chk[k] !== B.chk[k]) diff.push(k + ': ' + A.chk[k] + ' ≠ ' + B.chk[k]);
const errs = v => v.some(x => /ошибка/.test(x));
for (const k of new Set([...Object.keys(A.scenes), ...Object.keys(B.scenes)])) {
  const x = A.scenes[k], y = B.scenes[k];
  if (!x || !y) diff.push('сцена ' + k + ': нет в ' + (x ? 'новом' : 'старом'));
  else if (errs(x) || errs(y)) diff.push('сцена ' + k + ': ошибка исполнения (' + x.join(' → ') + ' | ' + y.join(' → ') + ')');
  else if (x[0] !== y[0] || x[1] !== y[1]) diff.push('сцена ' + k + ': ' + x.join(' → ') + ' ≠ ' + y.join(' → '));
}
const res = { equal: !diff.length, fp: Object.keys(A.fp).length, checks: Object.keys(A.chk).length, scenes: Object.keys(A.scenes).length, diff };
console.log(JS ? JSON.stringify(res, null, 1) : (diff.length ? 'РАЗНЫЕ:\n- ' + diff.join('\n- ') : 'равны: итог, отпечатков ' + res.fp + ', проверок ' + res.checks + ', сцен ' + res.scenes));
process.exit(diff.length ? 1 : 0);
