// (Р4.4, 26.11) хэш кадра холста: кадры страницы остановлены, матч доведён до тика, draw() вызывается один раз с закреплёнными часами
// показа (nowTs) — один кадр одинаков у двух сборок, если рисование то же. Для проверки переноса кода показа (деление draw).
// Запуск: node tools/page/frame_hash.js <sim.html> [--match=3] [--ticks=3000,9000,20000] [--layers=1 — включить все галочки слоёв]
'use strict';
const path = require('path'), pw = require('playwright'), crypto = require('crypto');
const DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const SIM = path.resolve(process.argv[2]);
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const M = +(A.match || 3), TICKS = (A.ticks || '3000,9000,20000').split(',').map(Number);
(async () => {
  const br = await pw.chromium.launch(); const p = await br.newPage({ viewport: { width: 1600, height: 1000 } }); await p.route(/^https?:/, r => r.abort());
  // часы страницы закреплены до скриптов игры: время появления меток показа (звуки, трассеры) — одинаково у двух запусков
  await p.addInitScript(() => { let t = 1000, s = 1; Math.random = () => { s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0; return (s >>> 8) / 16777216; }; performance.now = () => t; window.requestAnimationFrame = () => 0; window.setTimeout = () => 0; window.setInterval = () => 0; Date.now = () => 1.7e12 + t; window.__clk = v => { t = v; }; });
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(500);
  if (A.layers) await p.evaluate(() => document.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = true; }));
  await p.evaluate(m => __ev('nowTs = 1e6; freshMatch(' + m + '); 1'), M);
  const out = [];
  for (const T of TICKS) {
    const h = await p.evaluate(t => __ev(`while(tick < ${t}){ stepTick(); nowTs = 1e6; } nowTs = 1e6; draw();
      var c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, x = 2166136261 >>> 0;
      for(var i = 0; i < d.length; i += 4) x = Math.imul(x ^ (d[i] | d[i+1] << 8 | d[i+2] << 16), 16777619) >>> 0; c.width + 'x' + c.height + ':' + x`), T);
    out.push(T + ' ' + h);
  }
  await br.close(); console.log(out.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
