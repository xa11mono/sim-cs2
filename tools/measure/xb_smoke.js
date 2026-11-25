// (Р0.14, 24.11) Кросс-браузерная проверка текущего состояния (без отдельного кода игры под браузер): один движок Playwright за запуск.
// Что пишет: открылась ли страница, ошибки страницы и консоли, хэш позиций матча за N тиков (как fingerprint: x, y, взгляд, HP, жив),
// хэши Math этого движка (те же входы, что стенд артефакта: docs/reports/audit_2026-11-24/stage4/bench/core.js), WASM и Worker
// (Blob обычный / модуль, data:) в автономном HTML, снимок экрана после загрузки. Игру не меняет.
//   node tools/measure/xb_smoke.js sim.html <chromium|firefox|webkit> <out.json> [матч=3] [тиков=2000]
const pw = require('playwright'), url = require('url'), fs = require('fs'), path = require('path');
const [sim, engine, out, M = '3', T = '2000'] = process.argv.slice(2);
if (!sim || !engine || !out) { console.error('node tools/measure/xb_smoke.js sim.html <chromium|firefox|webkit> out.json [матч] [тиков]'); process.exit(2); }
const BENCH = path.join(__dirname, '..', '..', 'docs', 'reports', 'audit_2026-11-24', 'stage4', 'bench');
(async () => {
  const R = { engine, match: +M, ticks: +T, errors: [], console: [] }; let b;
  try { b = await pw[engine].launch(); R.version = b.version(); } catch (e) { R.launch = String(e.message || e).slice(0, 300); fs.writeFileSync(out, JSON.stringify(R, null, 1)); return; }
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => R.errors.length < 30 && R.errors.push(String(e.message || e).slice(0, 200)));
    p.on('console', m => { if (m.type() === 'error' && R.console.length < 30) R.console.push(m.text().slice(0, 200)); });
    await p.route(/^https?:/, r => r.abort());
    const t0 = Date.now(); await p.goto(url.pathToFileURL(path.resolve(sim)).href); await p.waitForTimeout(1500); R.loadMs = Date.now() - t0;
    await p.screenshot({ path: out.replace(/\.json$/, '.png') });
    R.hasEv = await p.evaluate(() => typeof window.__ev === 'function');
    if (R.hasEv) {
      const t1 = Date.now();
      R.game = JSON.parse(await p.evaluate(([m, t]) => __ev(`var h = 2166136261 >>> 0, F = new Float64Array(1), U = new Uint32Array(F.buffer);
        function mix(v){ F[0] = +v || 0; h = Math.imul(h ^ U[0], 16777619) >>> 0; h = Math.imul(h ^ U[1], 16777619) >>> 0; }
        freshMatch(${m}); for(var i = 0; i < ${t}; i++){ stepTick(); bots.forEach(function(b){ mix(b.x); mix(b.y); mix(b.facing); mix(b.hp); mix(b.alive ? 1 : 0); }); }
        JSON.stringify({tick: tick, round: roundNum, hash: h})`), [M, T]));
      R.gameMs = Date.now() - t1;
    }
    // Math движка и WASM / Worker — автономная страница стенда (make_standalone.js), без игры
    const core = fs.readFileSync(path.join(BENCH, 'core.js'), 'utf8').replace(/if\(typeof module[^\n]*\n/, '');
    const wasmF = path.join(BENCH, 'prec', 'target', 'wasm32-unknown-unknown', 'release', 'prec.wasm');
    const q = await b.newPage(); await q.setContent('<!doctype html><meta charset=utf-8><body>probe');
    await q.addScriptTag({ content: core });
    R.math = await q.evaluate(() => hashes(jsFill(20000)));
    if (fs.existsSync(wasmF)) {
      const w64 = fs.readFileSync(wasmF).toString('base64');
      R.wasm = await q.evaluate(async ([b64, src]) => {
        const bytes = () => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
        const o = {}; try { const i = new WebAssembly.Instance(new WebAssembly.Module(bytes()), {}); o.sync = true; o.libm = hashes(wasmFill(i, 1, 20000)); } catch (e) { o.sync = String(e); }
        const wk = (kind) => new Promise(res => { const body = src + '\nself.onmessage=function(m){try{var i=new WebAssembly.Instance(new WebAssembly.Module(m.data),{});postMessage({libm:hashes(wasmFill(i,1,20000))});}catch(e){postMessage({err:String(e)});}};';
          let w; const t = setTimeout(() => res({ err: 'нет ответа 15 с' }), 15000);
          try { w = kind === 'data' ? new Worker('data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(body)))) : new Worker(URL.createObjectURL(new Blob([body], { type: 'text/javascript' })), kind === 'module' ? { type: 'module' } : undefined);
            w.onmessage = m => { clearTimeout(t); res(m.data); w.terminate(); }; w.onerror = e => { clearTimeout(t); res({ err: 'ошибка Worker: ' + (e.message || '') }); }; w.postMessage(bytes()); }
          catch (e) { clearTimeout(t); res({ err: String(e) }); } });
        o.workerBlob = await wk('blob'); o.workerModule = await wk('module'); o.workerData = await wk('data');
        o.sab = typeof SharedArrayBuffer !== 'undefined'; o.coi = !!self.crossOriginIsolated; return o; }, [w64, core]);
    } else R.wasm = 'нет prec.wasm (собрать: задание rust)';
  } catch (e) { R.fatal = String(e.message || e).slice(0, 300); }
  await b.close(); fs.writeFileSync(out, JSON.stringify(R, null, 1)); console.log(engine, R.version, R.game ? 'тиков ' + R.game.tick + ' хэш ' + R.game.hash : 'игра не запустилась', 'ошибок ' + R.errors.length);
})();
