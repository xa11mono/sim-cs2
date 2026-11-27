// (Р7, 27.11) ядра Rust в странице (WASM в движке браузера), встроенные в игру: режим r7Mode (ts | shadow | speed), настоящий матч.
// node tools/r7/kernels/js/page_run.js <sim.html> <матч> <тиков> <chromium|firefox|webkit> <ts|shadow|speed> [повторов=3]
// Каждый повтор — новая страница. Вывод: мс на тик (performance.now страницы, без freshMatch), хэш итога, сверок и расхождений ядро ≠ эталон.
const pw = require('playwright'), path = require('path'), url = require('url');
const [sim, m, T, eng, mode, R0] = process.argv.slice(2), R = +(R0 || 3);
(async () => {
  const br = await pw[eng].launch(); const runs = []; const errs = [];
  for (let r = 0; r < R; r++) {
    const p = await br.newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await p.goto(url.pathToFileURL(path.resolve(sim)).href); await p.waitForTimeout(1500);
    const res = await p.evaluate(([mode, m, T]) => {
      __ev('clockPause(true); 1'); const set = __ev('r7Mode("' + mode + '")');
      __ev('freshMatch(' + m + '); 1'); const t0 = performance.now(); __ev('while(tick < ' + T + ') stepTick(); 1'); const ms = performance.now() - t0;
      const h = __ev('(function(){ var s = JSON.stringify([score, bots.map(function(b){ return [b.id, b.x, b.y, b.z, b.hp, b.alive, b.facing]; })]), x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; })()');
      return { mode_set: set, ms_per_tick: ms / T, hash: h, n: __ev('R7.n'), bad: __ev('R7.bad'), first: __ev('JSON.stringify(R7.first)') };
    }, [mode, m, T]);
    runs.push(res); await p.close();
  }
  await br.close();
  const v = runs.map(x => x.ms_per_tick);
  console.log(JSON.stringify({ sim: path.basename(sim), engine: eng, mode, mode_set: runs[0].mode_set, match: +m, ticks: +T, ms_mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(4),
    ms_min: +Math.min(...v).toFixed(4), ms_max: +Math.max(...v).toFixed(4), hash: [...new Set(runs.map(x => x.hash))], n: runs[0].n, bad: runs.map(x => x.bad), first: runs[0].first, page_errors: errs }));
})().catch(e => { console.error(e); process.exit(2); });
