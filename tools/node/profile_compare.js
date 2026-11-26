// (Р5.3, 26.11, владелец: «профиль CPU и памяти Node и Chromium на одинаковом ходе матча, в одинаковой среде; что — симуляция, что —
// эмуляция браузера») одна сборка, один матч, один отрезок тиков (код — отпечаток, как tools/measure/fingerprint.js) в двух средах:
// Chromium (Playwright, профиль — CDP Profiler) и Node (основной контекст, профиль — node:inspector). Время по функциям раскладывается
// на части по описанию файлов игры (rebuild/files.json): симуляция (math / infra / decide / engine / watch), показ (show / page), среда
// (функции не из игры: заглушки DOM, сборщик мусора, служебное движка). Безымянная функция — к ближайшей именованной выше по стеку.
// Память: куча JS после загрузки и после отрезка. Запуск: node tools/node/profile_compare.js <sim.html> [--match=3] [--ticks=5000] [--out=…]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..'), G = require(path.join(ROOT, 'tools', 'rebuild', 'game_src.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const SIM = path.resolve(process.argv[2]), M = +(A.match || 3), T = +(A.ticks || 5000);
const CODE = fs.readFileSync(path.join(ROOT, 'tools', 'measure', 'fingerprint.js'), 'utf8').replaceAll('__M__', String(M)).replace('t < 400000', 't < ' + T);
// функция → часть: объявления функций по файлам игры
const acorn = require('acorn'), walk = require('acorn-walk'), PART = {};
for (const f of G.gameFiles().filter(f => /\.(js|ts)$/.test(f))) { let ast; const t = G.readGame(f).replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' '));
  for (const [a, b] of [['', ''], ['', '\n})();'], ['(function(){\n', ''], ['(function(){\n', '\n})();']]) { try { ast = acorn.parse(a + t + b, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); break; } catch (e) {} }
  if (!ast) continue; const part = G.filePart(f), cat = ['show', 'page'].includes(part) ? 'показ' : 'симуляция';
  walk.full(ast, n => { if (n.type === 'FunctionDeclaration' && n.id) PART[n.id.name] = [cat, f];
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && /Function/.test(n.init.type)) PART[n.id.name] = PART[n.id.name] || [cat, f]; }); }
function classify(prof) {   // самостоятельное время (мс) по частям и топ функций
  const N = new Map(prof.nodes.map(n => [n.id, n])), par = new Map(); prof.nodes.forEach(n => (n.children || []).forEach(c => par.set(c, n.id)));
  const named = id => { for (let n = N.get(id); n; n = N.get(par.get(n.id))) { const fn = n.callFrame.functionName; if (fn && PART[fn]) return fn; if (fn && !PART[fn] && fn !== '') return '~' + fn; } return '(служебное)'; };
  const self = new Map(); prof.samples.forEach((s, i) => self.set(s, (self.get(s) || 0) + (prof.timeDeltas[i] || 0) / 1000));
  const byCat = {}, byFn = {};
  for (const [id, ms] of self) { const n = N.get(id), raw = n.callFrame.functionName;
    let fn = raw && PART[raw] ? raw : null, cat;
    if (fn) cat = PART[fn][0];
    else if (['(garbage collector)'].includes(raw)) { cat = 'среда: сборка мусора'; fn = raw; }
    else if (['(idle)', '(program)', '(root)'].includes(raw)) { cat = 'среда: служебное'; fn = raw; }
    else { const up = named(id); if (up[0] !== '~' && PART[up]) { cat = PART[up][0]; fn = up + ' (влож.)'; } else { cat = /run_page|stub|Proxy/.test(n.callFrame.url + raw) ? 'среда: заглушки DOM' : 'среда: прочее'; fn = (raw || '(аноним)') + ' ' + path.basename(n.callFrame.url || ''); } }
    byCat[cat] = (byCat[cat] || 0) + ms; byFn[fn] = (byFn[fn] || 0) + ms; }
  const tot = Object.values(byCat).reduce((a, b) => a + b, 0);
  return { total_ms: Math.round(tot), parts: Object.fromEntries(Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, { ms: Math.round(v), share: +(v / tot * 100).toFixed(1) }])),
    top: Object.entries(byFn).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, Math.round(v)]) };
}
(async () => {
  // Chromium
  const pw = require('playwright'); const br = await pw.chromium.launch(); const p = await br.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; window.setTimeout = () => 0; window.setInterval = () => 0; });
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(500);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage'); const h0 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
  const t0 = Date.now(); const outB = await p.evaluate(c => __ev(c), CODE); const msB = Date.now() - t0;
  const profB = (await cdp.send('Profiler.stop')).profile; const h1 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  await cdp.send('HeapProfiler.collectGarbage'); const h1g = (await cdp.send('Runtime.getHeapUsage')).usedSize; await br.close();
  // Node — отдельный процесс (основной контекст), тот же код
  const tmp = path.join(require('os').tmpdir(), 'prof_' + process.pid + '.json');
  const nodeOut = cp.execFileSync(process.execPath, ['--expose-gc', path.join(__dirname, 'profile_node_child.js'), SIM, tmp], { input: CODE, maxBuffer: 1 << 28, encoding: 'utf8' });
  const N = JSON.parse(fs.readFileSync(tmp, 'utf8')); fs.unlinkSync(tmp);
  const res = { sim: path.basename(path.dirname(SIM)) + '/' + path.basename(SIM), match: M, ticks: T,
    same_fingerprint: JSON.parse(outB).hash === JSON.parse(N.out).hash, hash: [JSON.parse(outB).hash, JSON.parse(N.out).hash],
    chromium: { wall_ms: msB, heap_load_mb: +(h0 / 1048576).toFixed(1), heap_after_mb: +(h1 / 1048576).toFixed(1), heap_after_gc_mb: +(h1g / 1048576).toFixed(1), cpu: classify(profB) },
    node: { wall_ms: N.ms, heap_load_mb: N.h0, heap_after_mb: N.h1, heap_after_gc_mb: N.h1g, rss_mb: N.rss, cpu: classify(N.prof) } };
  if (A.out) fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
  const line = (k, r) => console.log(k.padEnd(9) + ' ' + String(r.wall_ms).padStart(6) + ' мс; куча: загрузка ' + r.heap_load_mb + ' МБ, после ' + r.heap_after_mb + ' (после сборки ' + r.heap_after_gc_mb + '); ' +
    Object.entries(r.cpu.parts).map(([c, v]) => c + ' ' + v.share + '%').join(', '));
  console.log('отпечаток ' + (res.same_fingerprint ? 'одинаковый ' : 'РАЗНЫЙ ') + res.hash.join(' / ')); line('Chromium', res.chromium); line('Node', res.node);
})().catch(e => { console.error(e); process.exit(1); });
