// (Р7, 27.11) ядра Rust в странице (WASM в движке браузера) на настоящем матче: та же связка bridge.js, тот же счёт тиков в странице.
// node tools/r7/kernels/js/page_run.js <sim.html> <матч> <тиков> <chromium|firefox|webkit> <js|wasm> [shadow|speed] [повторов=3]
// js — база (без ядер). Каждый повтор — новая страница. Вывод: мс на тик (по performance.now страницы), хэш, счётчики ядра.
const pw = require('playwright'), fs = require('fs'), path = require('path'), url = require('url');
const [sim, m, T, eng, be, mode, R0] = process.argv.slice(2), R = +(R0 || 3);
const BR = fs.readFileSync(path.join(__dirname, 'bridge.js'), 'utf8');
const WASM = fs.readFileSync(path.join(__dirname, '..', 'target/wasm32-unknown-unknown/release/sim_r7_kernels.wasm')).toString('base64');
(async () => {
  const br = await pw[eng].launch(); const runs = [];
  for (let r = 0; r < R; r++) {
    const p = await br.newPage(); await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await p.goto(url.pathToFileURL(path.resolve(sim)).href); await p.waitForTimeout(1500);
    const res = await p.evaluate(async ([BR, WASM, be, mode, m, T]) => {
      __ev('clockPause(true); 1');
      let st = null;
      if (be !== 'js') { (0, eval)(BR); const bytes = Uint8Array.from(atob(WASM), c => c.charCodeAt(0)); st = R7attach(__ev, { backend: 'wasm', mode, wasmBytes: bytes }); }
      __ev('freshMatch(' + m + '); 1'); const t0 = performance.now(); __ev('while(tick < ' + T + ') stepTick(); 1'); const ms = performance.now() - t0;
      const h = __ev('(function(){ var s = JSON.stringify([score, bots.map(function(b){ return [b.id, b.x, b.y, b.z, b.hp, b.alive, b.facing]; })]), x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; })()');
      if (st) { delete st.M; delete st.ids; delete st.vals; }
      return { ms_per_tick: ms / T, hash: h, kern: st };
    }, [BR, WASM, be, mode || 'speed', m, T]);
    runs.push(res); await p.close();
  }
  await br.close();
  const v = runs.map(x => x.ms_per_tick);
  console.log(JSON.stringify({ sim: path.basename(sim), engine: eng, backend: be, mode: mode || 'speed', match: +m, ticks: +T, ms_mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(4), ms_min: +Math.min(...v).toFixed(4), ms_max: +Math.max(...v).toFixed(4),
    hash: [...new Set(runs.map(x => x.hash))], kern: runs[0].kern }));
})().catch(e => { console.error(e); process.exit(2); });
