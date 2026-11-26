// (Р5.2, 26.11; --local — Р5.4) режим Worker / локальный режим (процесс Node) равен обычному: страница сборки `src/build.py --worker`, открытая с ?worker=1, ведёт матч в Worker (ядро из
// #simCore через Blob-URL) и рисует по кадру; та же страница без флага ведёт матч сама. На одних тиках рисунки равны попиксельно (часы и кадры
// закреплены, как в tools/page/frame_hash.js). Запуск: node tools/page/worker_check.js <sim-worker.html> [--match=3] [--ticks=3000,9000] [--layers=1]
'use strict';
const pw = require('playwright'), url = require('url');
const SIM = require('path').resolve(process.argv[2]);
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const M = +(A.match || 3), TICKS = (A.ticks || '3000,9000').split(',').map(Number);
const HASH = `paused = true; nowTs = 1e6; draw(); var c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, x = 2166136261 >>> 0;
  for(var i = 0; i < d.length; i += 4) x = Math.imul(x ^ (d[i] | d[i+1] << 8 | d[i+2] << 16), 16777619) >>> 0; c.width + 'x' + c.height + ':' + x`;
async function page(br, q, base) {
  const p = await br.newPage({ viewport: { width: 1600, height: 1000 } }); await p.route(/^https?:/, r => (r.request().url().startsWith('http://127.0.0.1:') ? r.continue() : r.abort()));   // сеть — нет, локальный сервер (Р5.4) — да
  await p.addInitScript(() => { let t = 1000, s = 1; Math.random = () => { s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0; return (s >>> 8) / 16777216; }; performance.now = () => t; window.requestAnimationFrame = () => 0;
    window.setTimeout = () => 0; window.setInterval = () => 0; Date.now = () => 1.7e12; });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto((base || url.pathToFileURL(SIM).href) + q); await p.waitForTimeout(800);
  if (A.layers) await p.evaluate(() => document.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = true; }));
  p.errs = errs; return p;
}
// команда Worker'у и ожидание кадра (ответ приходит в WK.F)
const wk = (p, m) => p.evaluate(m => new Promise((ok, bad) => { const w = __ev('WK.w'); const t0 = Date.now();
  w.addEventListener('message', function h(e){ w.removeEventListener('message', h); __ev('frameApply(WK.F); WK.F = null; WK.busy = false; 1'); ok(e.data.tick); });
  __ev('WK.busy = true; 1'); w.postMessage(m); }), m);
(async () => {
  // --local=<адрес> (Р5.4): страница B — с локального сервера tools/node/local_server.js (симуляция — процесс Node), иначе — режим Worker
  const br = await pw.chromium.launch(); const a = await page(br, ''), b = A.local ? await page(br, '/?local=1', A.local) : await page(br, '?worker=1'); let bad = 0;
  if (!(await b.evaluate(() => __ev('WK.on')))) throw new Error('режим Worker не включился (нет #simCore? сборка без --worker)');
  // часы и случайность Worker — закрепить так же, как у страниц (закрепление страницы на Worker не действует): Worker запускается заново
  if (!A.local) await b.evaluate(() => __ev(`WK.w.terminate(); var pre = "(function(){ var t = 1000, s = 1; Math.random = function(){ s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0; return (s >>> 8) / 16777216; }; performance.now = function(){ return t; }; Date.now = function(){ return 1.7e12; }; })();\\n";
    WK.w = new Worker(URL.createObjectURL(new Blob([pre + document.getElementById("simCore").textContent], {type: "text/javascript"}))); WK.w.onmessage = function(e){ WK.F = e.data.F; WK.busy = false; }; 1`));
  await a.evaluate(m => __ev('nowTs = 1e6; freshMatch(' + m + '); 1'), M);
  await wk(b, { cmd: 'match', n: M, now: 1e6 });
  for (const T of TICKS) {
    const hA = await a.evaluate(s => __ev(s), `while(tick < ${T}){ stepTick(); nowTs = 1e6; } ` + HASH);
    const tb = await wk(b, { cmd: 'to', t: T, now: 1e6 });
    const hB = await b.evaluate(s => __ev(s), HASH);
    const same = hA === hB; if (!same) bad++;
    const K = A.local ? 'Node' : 'Worker'; console.log('тик ' + T + ' (' + K + ' ' + tb + '): страница ' + hA + ' / ' + K + ' ' + hB + (same ? ' = равны' : ' — РАЗНЫЕ'));
  }
  if (a.errs.length || b.errs.length) console.log('ошибки страниц: ' + a.errs.concat(b.errs).slice(0, 3).join(' | '));
  await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
