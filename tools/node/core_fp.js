// (Р5, 26.11) отпечатки полных матчей на ядре без показа (dist/core-<карта>.js) в чистом Node — по процессу на матч, параллельно —
// и сверка с эталоном (папка fp_<N>.json[.gz], как у tools/measure/fingerprint.sh). Быстрая облачная проверка правки «игра не
// менялась»; не замена Э1 на ПК (браузеры, страница). Ядро = страница — доказывается Э2 (прогон ПК).
// Запуск: node tools/node/core_fp.js <core.js> <эталон-папка> [--matches=3,7,11] [--par=4] [--out=папка]
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const A = Object.fromEntries(process.argv.slice(4).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const CORE = path.resolve(process.argv[2]), REF = process.argv[3] && path.resolve(process.argv[3]);
const M = (A.matches || '3,7,11,13,17,19,23,29').split(',').map(Number), PAR = +(A.par || 4);
if (process.argv[2] === '--child') {   // дочерний: один матч
  const m = +process.argv[4], code = fs.readFileSync(path.join(ROOT, 'tools', 'measure', 'fingerprint.js'), 'utf8').replaceAll('__M__', String(m));
  const EV = require('./core_run.js').load(process.argv[3]); process.stdout.write(String(EV(code))); process.exit(0);
}
const ref = m => { for (const f of ['fp_' + m + '.json', 'fp_' + m + '.json.gz']) { const p = path.join(REF, f); if (fs.existsSync(p)) { const b = fs.readFileSync(p); return JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(b) : b).toString()); } } return null; };
const run = m => new Promise(res => { const t0 = Date.now(); let out = '';
  const c = cp.spawn(process.execPath, [__filename, '--child', CORE, String(m)], { stdio: ['ignore', 'pipe', 'inherit'] });
  c.stdout.on('data', d => out += d); c.on('close', () => res({ m, ms: Date.now() - t0, fp: out ? JSON.parse(out) : null })); });
(async () => {
  const q = M.slice(), R = []; let bad = 0;
  const report = r => { const e = REF && ref(r.m), same = e && r.fp && e.hash === r.fp.hash && JSON.stringify(e.rounds) === JSON.stringify(r.fp.rounds);
    if (!same) bad++;
    let diff = ''; if (e && r.fp && !same) { const i = r.fp.rounds.findIndex((x, k) => JSON.stringify(x) !== JSON.stringify(e.rounds[k])); diff = ' первый другой раунд ' + (i + 1); }
    if (A.out) { fs.mkdirSync(A.out, { recursive: true }); fs.writeFileSync(path.join(A.out, 'fp_' + r.m + '.json'), JSON.stringify(r.fp)); }
    console.log('матч ' + r.m + ': ' + (r.fp ? r.fp.hash : 'ОШИБКА') + (e ? (same ? ' = эталон' : ' ≠ эталон ' + e.hash + diff) : ' (эталона нет)') + ', ' + (r.ms / 1000).toFixed(0) + ' с'); };
  await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => { while (q.length) { const r = await run(q.shift()); R.push(r); report(r); } }));   // строка — по готовности матча
  console.log((bad ? 'РАЗНЫЕ: ' + bad : 'все ' + R.length + ' = эталон'));
  process.exit(bad ? 1 : 0);
})();
