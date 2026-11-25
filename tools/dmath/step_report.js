// (Р2.3) Сводка шага замены для доказательств: node tools/dmath/step_report.js <f> <папка> <выход.json>
// Подмена (обязана быть бит в бит) и причина: первый расходящийся тик, первый различный вызов, разница ответов в ulp, совпадает ли
// функция вызова с заменённой и одинаковы ли аргументы.
'use strict';
const fs = require('fs'), path = require('path');
const [F, D, OUT] = process.argv.slice(2);
const F64 = new Float64Array(1), U = new BigInt64Array(F64.buffer);
const ord = x => { F64[0] = x; const b = U[0]; return b < 0n ? -(b & 0x7fffffffffffffffn) : b; };   // порядковый номер double
const ulps = (a, b) => (typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b)) ? Number(ord(a) > ord(b) ? ord(a) - ord(b) : ord(b) - ord(a)) : null;
const rd = f => { try { return JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); } catch (e) { return null; } };
const rep = { f: F, maps: {} };
for (const m of ['ancient', 'mirage']) {
  const s = rd(F + '_shim_' + m + '.json'), r = rd(F + '_real_' + m + '.json'), o = {};
  o.shim = s ? (s.found ? { same: false, tick: s.tick, vars: s.vars } : { same: true, checkedTo: s.checkedTo }) : null;
  if (r) {
    if (!r.found) o.real = { diverges: false, checkedTo: r.checkedTo };
    else { const fc = r.math && r.math.first; o.real = { diverges: true, tick: r.tick, vars: r.vars, calls: r.math && r.math.calls, firstCall: fc };
      if (fc) { const [fa, aa, ra] = fc.a, [fb, ab, rb] = fc.b; o.real.attribution = { sameFunction: fa === fb, isReplaced: fa === F || (F === 'hypot' && fa === 'hypot'),
        sameArgs: JSON.stringify(aa) === JSON.stringify(ab), ulps: ulps(ra, rb), before: ra, after: rb, viaDM: fc.b[3] === 'DM' }; } }
  }
  rep.maps[m] = o;
}
fs.writeFileSync(OUT, JSON.stringify(rep, null, 1)); console.log(JSON.stringify(rep).slice(0, 1500));
