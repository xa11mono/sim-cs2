// (28.11, система проверок H-3) Общая часть проверок L1 (tools/rebuild/l1.js) и L2 (tools/rebuild/l2.js): дочерние процессы на учёте,
// очередь (один уровень проверок за раз), допуск по памяти, кэш результатов, кэш сборок, задачи проверок. Устройство и ключи — l1.js.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..'), ARGS = process.argv.slice(2), opt = n => ARGS.includes('--' + n);
const val = (n, d) => { const a = ARGS.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
// общие параметры проверок (L1 и L2 — одни): --no-cache, --verify-cache, --par=N, --reserve-mb=N
const NOCACHE = opt('no-cache'), VERIFY = opt('verify-cache');
const PAR = Math.max(1, +val('par', Math.min(4, os.cpus().length))), RESERVE_MB = +val('reserve-mb', 1536), TASK_MS = 90 * 60 * 1000;
const git = a => cp.execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const short = s => s.slice(0, 8);
const OUTD = path.join(git(['rev-parse', '--git-common-dir']).replace(/^(?!\/|[A-Za-z]:)/, ROOT + '/'), 'sim-l1');
const CACHE = path.join(OUTD, 'cache'); [OUTD, path.join(CACHE, 'build'), path.join(CACHE, 'res'), path.join(OUTD, 'queue')].forEach(d => fs.mkdirSync(d, { recursive: true }));
const timings = [], stat = { hit: 0, run: 0, verified: 0, verifyBad: [] };
const env = Object.assign({}, process.env, { NODE_PATH: [process.env.NODE_PATH, path.join(ROOT, 'tools', 'rebuild', 'node_modules')].filter(Boolean).join(path.delimiter) });
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const sha256 = x => crypto.createHash('sha256').update(x).digest('hex'), fileSha = f => sha256(fs.readFileSync(f));
const sec = ms => (ms / 1000).toFixed(1);

// ---------- дочерние процессы: все на учёте; выход / сигнал — добить (дерево процесса: на Linux — группа, на Windows — taskkill /T)
const KIDS = new Set();
function killTree(p) { try { if (process.platform === 'win32') cp.spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F']); else process.kill(-p.pid, 'SIGKILL'); } catch (e) { try { p.kill('SIGKILL'); } catch (e2) {} } }
const run = (cmd, args, o = {}) => new Promise(res => {
  const p = cp.spawn(cmd, args, Object.assign({ cwd: ROOT, env, detached: process.platform !== 'win32' }, o)); KIDS.add(p); let out = '', err = '', late = false;
  const timer = setTimeout(() => { late = true; killTree(p); }, o.timeoutMs || TASK_MS);
  p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; }); p.on('error', e => { err += e.message; });
  p.on('close', (code, signal) => { clearTimeout(timer); KIDS.delete(p); res({ code: code ?? 1, out, err: err + (late ? ' (тайм-аут)' : '') + (signal ? ' (сигнал ' + signal + ')' : '') }); });
});
const H = { scenes: null };   // хозяин браузера сцен (scene_batch.js), поднимается при первой сцене
function cleanup() { KIDS.forEach(killTree); KIDS.clear(); }
process.on('exit', cleanup); ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(s => process.on(s, () => { cleanup(); process.exit(130); }));

// ---------- очередь: билет (время постановки + pid), очередь идёт по билетам; живой владелец замка — ждать; мёртвый — замок снять
const QD = path.join(OUTD, 'queue'); let TICKET = null;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function queueEnter(tag) {   // tag — что проверяется (для надписи «в очереди за …»)
  TICKET = path.join(QD, Date.now() + '-' + process.pid + '-' + tag); fs.writeFileSync(TICKET, String(process.pid)); let said = false;
  for (;;) {
    const T = fs.readdirSync(QD).filter(f => /^\d+-\d+-/.test(f)).sort((a, b) => +a.split('-')[0] - +b.split('-')[0] || a.localeCompare(b));
    const live = T.filter(f => { const pid = +f.split('-')[1]; if (alive(pid)) return true; try { fs.unlinkSync(path.join(QD, f)); } catch (e) {} return false; });
    if (live[0] === path.basename(TICKET)) return;
    if (!said) { console.log(tag + ': в очереди за ' + live.slice(0, live.indexOf(path.basename(TICKET))).map(f => f.split('-')[2]).join(', ')); said = true; }
    await new Promise(r => setTimeout(r, 3000));
  }
}
const queueLeave = () => { try { if (TICKET) fs.unlinkSync(TICKET); } catch (e) {} };

// ---------- память: новая задача ждёт, пока свободно не меньше запаса (Linux — MemAvailable; иначе os.freemem)
function availMb() { try { const m = /MemAvailable:\s+(\d+)/.exec(fs.readFileSync('/proc/meminfo', 'utf8')); if (m) return +m[1] / 1024; } catch (e) {} return os.freemem() / 1048576; }
let running = 0, memWaits = 0, peakRunning = 0;
async function pool(tasks, n) {   // tasks: [{ name, est, fn }] — сначала долгие (оценка по прошлому замеру), чтобы хвост был короче
  const order = tasks.map((t, i) => i).sort((a, b) => (tasks[b].est || 0) - (tasks[a].est || 0)), R = new Array(tasks.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (i < order.length) { const k = order[i++];
    while (running > 0 && availMb() < RESERVE_MB) { memWaits++; await new Promise(r => setTimeout(r, 2000)); }
    running++; peakRunning = Math.max(peakRunning, running); try { R[k] = await tasks[k].fn(); } finally { running--; } } }));
  return R;
}

// ---------- кэш результатов
let RT = null;   // среда исполнения — часть ключа
function runtime() { if (RT) return RT; let pw = '?', chr = '?';
  try { pw = require('playwright/package.json').version; } catch (e) {} try { chr = require('playwright').chromium.executablePath().replace(/.*[\\/](chrom[^\\/]*)[\\/].*/i, '$1'); } catch (e) {}
  return (RT = [process.version, process.platform, process.arch, 'pw' + pw, chr].join(' ')); }
const TOOL_FILES = ['src/q.js', 'tools/measure/inv_run.js', 'tools/measure/diverge.js', 'tools/rebuild/scene_run.js', 'tools/rebuild/scene_batch.js', 'tools/rebuild/checks_lib.js'];
const toolSum = (() => { let s = null; return () => s || (s = sha256(TOOL_FILES.concat(fs.readdirSync(path.join(ROOT, 'tools', 'measure')).filter(f => /\.(js|cjs)$/.test(f)).map(f => 'tools/measure/' + f))
  .sort().map(f => f + ':' + (fs.existsSync(path.join(ROOT, f)) ? fileSha(path.join(ROOT, f)) : '-')).join('\n'))); })();
async function cached(kind, key, est, compute) {   // compute → { ok: bool, ... }; ключ — массив
  const K = sha256(JSON.stringify([kind, key, toolSum(), runtime()])), F = path.join(CACHE, 'res', K + '.json');
  const have = !NOCACHE && fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : null;
  if (have && !VERIFY) { stat.hit++; return Object.assign({ cached: true }, have.v); }
  const t = Date.now(), v = await compute(); stat.run++; timings.push([kind + ' ' + key.filter(x => typeof x !== 'string' || x.length < 40).join(' '), Date.now() - t]);
  if (have && VERIFY) { stat.verified++; if (JSON.stringify(have.v) !== JSON.stringify(v)) stat.verifyBad.push(kind + ' ' + JSON.stringify(key).slice(0, 120)); }
  if (v.ok) { const tmp = F + '.' + process.pid; fs.writeFileSync(tmp, JSON.stringify({ kind, key, at: new Date().toISOString(), ms: Date.now() - t, v })); fs.renameSync(tmp, F); }
  return v;
}
const estOf = (kind, key) => { try { return JSON.parse(fs.readFileSync(path.join(CACHE, 'res', sha256(JSON.stringify([kind, key, toolSum(), runtime()])) + '.json'), 'utf8')).ms; } catch (e) { return 0; } };

// ---------- сборки: ключ входов, кэш страниц
const BI = JSON.parse(fs.readFileSync(path.join(__dirname, 'build_inputs.json'), 'utf8')), EXCL = BI.exclude.map(r => new RegExp(r)), CHK = BI.check_only.map(r => new RegExp(r));
let TOOLV = null;
function toolVersions() { if (TOOLV) return TOOLV; let esb = '?';
  try { esb = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'rebuild', 'node_modules', 'esbuild', 'package.json'), 'utf8')).version; } catch (e) {}
  const py = cp.spawnSync(PY, ['-V'], { encoding: 'utf8' }); return (TOOLV = [process.version, (py.stdout || py.stderr || '').trim(), 'esbuild ' + esb, 'inputs v' + BI.version].join(' ')); }
function inputKey(rev, map) {
  const tree = git(['ls-tree', '-r', '--full-tree', rev]).split('\n').filter(l => { const p = l.slice(l.indexOf('\t') + 1); return !EXCL.some(r => r.test(p)); });
  return sha256([map, toolVersions()].concat(tree).join('\n'));
}
function pruneBuilds(keep = 40) { const D = path.join(CACHE, 'build'), F = fs.readdirSync(D).filter(f => f.endsWith('.html')).map(f => [f, fs.statSync(path.join(D, f)).mtimeMs]).sort((a, b) => b[1] - a[1]);
  F.slice(keep).forEach(([f]) => { try { fs.unlinkSync(path.join(D, f)); } catch (e) {} }); }
async function buildAll(maps, tmp, revs) {   // revs { p: родитель, c: коммит } (L2 — только c) → { R: { p: {map: {file, sha, from}}, c: … }, bad, wt }
  const K = Object.keys(revs), R = {}, need = {}, wt = {}; K.forEach(k => { R[k] = {}; need[k] = []; });
  for (const [k, rev] of Object.entries(revs)) for (const m of maps) { const key = inputKey(rev, m), f = path.join(CACHE, 'build', key + '-' + m + '.html');
    R[k][m] = { file: f, key }; if (!NOCACHE && fs.existsSync(f)) { R[k][m].from = 'кэш'; fs.utimesSync(f, new Date(), new Date()); } else need[k].push(m); }
  // одинаковые входы родителя и коммита — одна сборка
  if (R.p) for (const m of [...need.c]) if (R.c[m].key === R.p[m].key) { need.c = need.c.filter(x => x !== m); R.c[m].same = true; }
  const bad = [];
  await Promise.all(K.filter(k => need[k].length).map(async k => {
    const rev = revs[k], w = wt[k] = path.join(tmp, 'wt-' + k); git(['worktree', 'add', '--quiet', '--detach', w, rev]);
    // node_modules сборки — из основной копии (в части коммитов в git лежала ссылка на чужую папку — заменить)
    const nm = path.join(w, 'tools', 'rebuild', 'node_modules'); try { if (fs.lstatSync(nm).isSymbolicLink()) fs.unlinkSync(nm); } catch (e) {}
    try { fs.symlinkSync(path.join(ROOT, 'tools', 'rebuild', 'node_modules'), nm, 'junction'); } catch (e) {}
    const builder = path.join(w, 'src', 'build.py'), multi = fs.readFileSync(builder, 'utf8').includes('L1_MULTI_MAP_V1'), tmpOut = m => path.join(tmp, k + '-' + m + '.html');
    const calls = multi ? [need[k].flatMap(m => ['--map-output', m, tmpOut(m)])] : need[k].map(m => ['--map', m, tmpOut(m)]);
    for (const a of calls) { const t = Date.now(), r = await run(PY, [builder].concat(a), { cwd: w }); timings.push(['сборка ' + k + ' ' + a.filter(x => maps.includes(x)).join('+'), Date.now() - t]);
      if (r.code) { bad.push('сборка ' + k + ': ' + (r.err || r.out).trim().slice(-300)); return; } }
    for (const m of need[k]) { const f = R[k][m].file, part = f + '.' + process.pid; fs.copyFileSync(tmpOut(m), part); fs.renameSync(part, f); R[k][m].from = 'собрана'; }
  }));
  for (const m of maps) { if (R.c[m].same) R.c[m].from = 'та же, что у родителя (входы равны)'; }
  for (const k of K) for (const m of maps) if (fs.existsSync(R[k][m].file)) R[k][m].sha = fileSha(R[k][m].file);
  return { R, bad, wt };
}

// ---------- проверки
const HASH = 'var s = JSON.stringify([score, bots.map(function(b){ return [b.id, b.x, b.y, b.z, b.hp, b.alive, b.facing]; })]), x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; x';
const lastLine = r => (r.out.trim().split('\n').filter(Boolean).pop() || r.err.trim().split('\n').pop() || '').slice(0, 300);
const fpTask = (b, m, n) => ({ est: estOf('fp', [b.sha, n, 15000]), fn: () => cached('fp', [b.sha, n, 15000], 0, async () => {
  const r = await run('node', [path.join(ROOT, 'src', 'q.js'), b.file, 'freshMatch(' + n + '); while(tick < 15000) stepTick(); ' + HASH]); const h = r.out.trim().split('\n').pop();
  return r.code || !/^\d+$/.test(h) ? { ok: false, h: 'ошибка', err: (r.err || r.out).trim().slice(-200) } : { ok: true, h }; }) });
const invTask = (b, m) => ({ est: estOf('inv', [b.sha, 3, 15000]), fn: () => cached('inv', [b.sha, 3, 15000], 0, async () => { const o = path.join(os.tmpdir(), 'l1inv_' + process.pid + '_' + m + '.json');
  const r = await run('node', [path.join(ROOT, 'tools', 'measure', 'inv_run.js'), b.file, '--match=3', '--ticks=15000', '--out=' + o]); try { fs.unlinkSync(o); } catch (e) {}
  return { ok: !/тайм-аут|сигнал/.test(r.err), code: r.code, t: lastLine(r) }; }) });
const i23Task = (b, m) => ({ est: estOf('i23', [b.sha, 3, 3000, 6000]), fn: () => cached('i23', [b.sha, 3, 3000, 6000], 0, async () => {
  const r = await run('node', [path.join(ROOT, 'tools', 'measure', 'diverge.js'), b.file, b.file, '--match=3', '--snap-at=3000', '--ticks=6000']);
  return { ok: !/тайм-аут|сигнал/.test(r.err), code: r.code, t: lastLine(r) }; }) });
const shTask = (b, m) => ({ est: estOf('sh', [b.sha, 3, 3000]), fn: () => cached('sh', [b.sha, 3, 3000], 0, async () => {
  if (!/function r7Mode\(/.test(fs.readFileSync(b.file, 'utf8'))) return { ok: true, code: 0, t: 'в этой версии ядер Rust нет — не применимо' };
  const r = await run('node', [path.join(ROOT, 'src', 'q.js'), b.file, 'r7Mode("shadow"); freshMatch(3); while(tick < 3000) stepTick(); "сверок " + R7.n + ", расхождений " + R7.bad']);
  const t = r.code ? 'ошибка' : r.out.trim().split('\n').pop(); return { ok: r.code === 0, code: /расхождений 0$/.test(t) ? 0 : 1, t }; }) });
const SR = require('./scene_run.js');
const sceneTask = (id, b, sims) => { const deps = SR.sceneInfo(id).deps.map(f => f + ':' + (fs.existsSync(path.join(ROOT, f)) ? fileSha(path.join(ROOT, f)) : '-')), key = [b.sha, id].concat(deps);
  return { est: estOf('scene', key), fn: () => cached('scene', key, 0, async () => {
    if (!H.scenes) H.scenes = new (require('./scene_batch.js').SceneHost)({ timeoutMs: TASK_MS });
    const r = await H.scenes.run(id, sims); return 'error' in r ? { ok: false, error: r.error } : { ok: true, output: r.output }; }) }; };

module.exports = { ROOT, ARGS, opt, val, NOCACHE, VERIFY, PAR, TASK_MS, git, short, OUTD, CACHE, env, PY, sha256, fileSha, sec, run, H, cleanup,
  queueEnter, queueLeave, availMb, pool, cached, estOf, EXCL, CHK, inputKey, pruneBuilds, buildAll, fpTask, invTask, i23Task, shTask, sceneTask, SR, lastLine,
  timings, stat, mem: () => ({ running, memWaits, peakRunning }) };
