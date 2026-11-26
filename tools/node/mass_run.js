// (Р5.8, 26.11) массовая симуляция: N матчей в worker_threads — у каждого потока своё ядро (dist/core-<карта>.js, свой изолят V8, своё
// состояние), матч — runMatch({match}) (engine/match/round.js). --check — те же матчи ещё раз по одному в отдельных процессах и сверка
// итогов (раунды, убийства, гранаты) бит в бит: параллельный запуск обязан давать ту же игру. Игру не меняет.
// Запуск: node tools/node/mass_run.js <core.js> [--matches=3,7,11,13] [--threads=2] [--ticks=400000] [--check] [--pack=карта.simmap] [--out=…]
// --check с --pack сверяет с ядром --check-core=<core со встроенной картой> (по одному, в процессах)
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
// (Р5.8) память на матч: куча V8 своего потока (у потока свой изолят) — после загрузки ядра, пик за матч (раз в 640 тиков, onTick runMatch —
// только чтение) и в конце; игру не меняет
const v8 = require('v8'), heapMb = () => v8.getHeapStatistics().used_heap_size / 1048576;
const run1 = (core, m, ticks, map) => { if (map) globalThis.__SIM_MAP = map; const EV = require('./core_run.js').load(core), H = { load: heapMb(), peak: 0 };
  globalThis.__heapTick = () => { H.peak = Math.max(H.peak, heapMb()); };
  const r = JSON.parse(EV('JSON.stringify(runMatch({match: ' + m + ', maxTicks: ' + ticks + ', onTick: function(t){ if(t % 640 === 0) __heapTick(); }}))'));
  H.end = heapMb(); H.peak = Math.max(H.peak, H.end); return { r, heap: { load_mb: Math.round(H.load), peak_mb: Math.round(H.peak), end_mb: Math.round(H.end) } }; };
if (!isMainThread) { const t0 = Date.now(), o = run1(workerData.core, workerData.m, workerData.ticks, workerData.map); parentPort.postMessage({ m: workerData.m, ms: Date.now() - t0, r: o.r, heap: o.heap }); return; }
if (process.argv[2] === '--one') { process.stdout.write(JSON.stringify(run1(process.argv[3], +process.argv[4], +process.argv[5]).r)); process.exit(0); }
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const CORE = path.resolve(process.argv[2]), M = (A.matches || '3,7,11,13').split(',').map(Number), TH = +(A.threads || 2), TK = +(A.ticks || 400000);
const key = r => JSON.stringify([r.match, r.ticks, r.rounds, r.kills, r.nades]);
// (Р5.8, 26.11) --pack=<карта.simmap> (ядро — core_build.py --pack): неизменяемая геометрия карты распаковывается один раз в SharedArrayBuffer и
// передаётся потокам по ссылке ({sab} — декодер геометрии берёт как есть, только чтение); остальное — копия на поток (карта меняется при загрузке)
async function sharedMap(pack) {
  const zlib = require('zlib'), L = await import(require('url').pathToFileURL(path.join(__dirname, '..', 'map-pack', 'load.mjs')).href);
  const map = L.openMapPack(fs.readFileSync(pack)).createMatchMap(), sabs = [];
  L.map3dBlocks.forEach(p => { const [o, k] = L.blockLocation(map.map3d, p), b = o && o[k]; if (!(b instanceof Uint8Array)) return;
    const raw = zlib.inflateSync(b), sab = new SharedArrayBuffer(raw.byteLength); new Uint8Array(sab).set(raw); o[k] = { sab }; sabs.push(sab); });
  return { map, sabs };
}
const sabHash = sabs => require('crypto').createHash('sha256').update(Buffer.concat(sabs.map(s => Buffer.from(new Uint8Array(s))))).digest('hex');
(async () => {
  const SH = A.pack ? await sharedMap(A.pack) : null, h0 = SH && sabHash(SH.sabs);
  const q = M.slice(), res = {}, t0 = Date.now(); let peak = 0;
  const mem = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 500);
  await Promise.all(Array.from({ length: Math.min(TH, q.length) }, async () => { while (q.length) { const m = q.shift();
    res[m] = await new Promise((ok, bad) => { const w = new Worker(__filename, { workerData: { core: CORE, m, ticks: TK, map: SH && SH.map } }); w.once('message', ok); w.once('error', bad); }); } }));
  clearInterval(mem); const wall = Date.now() - t0;
  const out = { core: path.basename(CORE), matches: M, threads: TH, wall_ms: wall, rss_peak_mb: Math.round(peak / 1048576), node: process.version, v8: process.versions.v8, cpus: os.cpus().length,
    per_match: M.map(m => ({ match: m, ms: res[m].ms, ticks: res[m].r.ticks, score: res[m].r.score, heap: res[m].heap })) };
  if (SH) { out.shared_mb = Math.round(SH.sabs.reduce((a, s) => a + s.byteLength, 0) / 1048576); out.shared_unchanged = sabHash(SH.sabs) === h0; }
  if (A.check) { out.check = M.map(m => { const s = JSON.parse(cp.execFileSync(process.execPath, [__filename, '--one', A['check-core'] ? path.resolve(A['check-core']) : CORE, String(m), String(TK)], { maxBuffer: 1 << 28, encoding: 'utf8' }));
    return { match: m, same: key(s) === key(res[m].r) }; }); out.same_all = out.check.every(c => c.same); }
  if (A.out) fs.writeFileSync(A.out, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ threads: TH, wall_ms: wall, rss_peak_mb: out.rss_peak_mb, shared_mb: out.shared_mb, shared_unchanged: out.shared_unchanged, per_match: out.per_match.map(p => p.match + ': ' + p.ticks + ' тиков ' + Math.round(p.ms / 1000) + ' с, куча ' + p.heap.load_mb + '→пик ' + p.heap.peak_mb + ' МБ'), same_all: out.same_all }));
})().catch(e => { console.error(e); process.exit(1); });
