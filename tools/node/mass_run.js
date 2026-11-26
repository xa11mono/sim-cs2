// (Р5.8, 26.11) массовая симуляция: N матчей в worker_threads — у каждого потока своё ядро (dist/core-<карта>.js, свой изолят V8, своё
// состояние), матч — runMatch({match}) (engine/match/round.js). --check — те же матчи ещё раз по одному в отдельных процессах и сверка
// итогов (раунды, убийства, гранаты) бит в бит: параллельный запуск обязан давать ту же игру. Игру не меняет.
// Запуск: node tools/node/mass_run.js <core.js> [--matches=3,7,11,13] [--threads=2] [--ticks=400000] [--check] [--out=…]
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const run1 = (core, m, ticks) => { const EV = require('./core_run.js').load(core); return JSON.parse(EV('JSON.stringify(runMatch({match: ' + m + ', maxTicks: ' + ticks + '}))')); };
if (!isMainThread) { const t0 = Date.now(), r = run1(workerData.core, workerData.m, workerData.ticks); parentPort.postMessage({ m: workerData.m, ms: Date.now() - t0, r }); return; }
if (process.argv[2] === '--one') { process.stdout.write(JSON.stringify(run1(process.argv[3], +process.argv[4], +process.argv[5]))); process.exit(0); }
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const CORE = path.resolve(process.argv[2]), M = (A.matches || '3,7,11,13').split(',').map(Number), TH = +(A.threads || 2), TK = +(A.ticks || 400000);
const key = r => JSON.stringify([r.match, r.ticks, r.rounds, r.kills, r.nades]);
(async () => {
  const q = M.slice(), res = {}, t0 = Date.now(); let peak = 0;
  const mem = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 500);
  await Promise.all(Array.from({ length: Math.min(TH, q.length) }, async () => { while (q.length) { const m = q.shift();
    res[m] = await new Promise((ok, bad) => { const w = new Worker(__filename, { workerData: { core: CORE, m, ticks: TK } }); w.once('message', ok); w.once('error', bad); }); } }));
  clearInterval(mem); const wall = Date.now() - t0;
  const out = { core: path.basename(CORE), matches: M, threads: TH, wall_ms: wall, rss_peak_mb: Math.round(peak / 1048576), node: process.version, v8: process.versions.v8, cpus: os.cpus().length,
    per_match: M.map(m => ({ match: m, ms: res[m].ms, ticks: res[m].r.ticks, score: res[m].r.score })) };
  if (A.check) { out.check = M.map(m => { const s = JSON.parse(cp.execFileSync(process.execPath, [__filename, '--one', CORE, String(m), String(TK)], { maxBuffer: 1 << 28, encoding: 'utf8' }));
    return { match: m, same: key(s) === key(res[m].r) }; }); out.same_all = out.check.every(c => c.same); }
  if (A.out) fs.writeFileSync(A.out, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ threads: TH, wall_ms: wall, rss_peak_mb: out.rss_peak_mb, per_match: out.per_match.map(p => p.match + ': ' + p.ticks + ' тиков ' + Math.round(p.ms / 1000) + ' с'), same_all: out.same_all }));
})().catch(e => { console.error(e); process.exit(1); });
