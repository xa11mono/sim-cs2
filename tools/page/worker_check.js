// (Р5.2, 26.11; --local — Р5.4) режим Worker / локальный режим (процесс Node) равен обычному: страница сборки `src/build.py --worker`, открытая с ?worker=1, ведёт матч в Worker (ядро из
// #simCore через Blob-URL) и рисует по кадру; та же страница без флага ведёт матч сама. На одних тиках рисунки равны попиксельно (часы и кадры
// закреплены, как в tools/page/frame_hash.js). Запуск: node tools/page/worker_check.js <sim-worker.html> [--match=3] [--ticks=3000,9000] [--layers=1] [--modes]
// | --measure=20 [--browser=…]
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
// (Р5.2) --measure=<с> [--browser=chromium|firefox|webkit] [--out=…]: замер передачи кадров Worker → страница в живой странице (часы не
// закреплены): байт на кадр, мс упаковки (Worker), распаковки и применения (страница), длинных задач по вине передачи (распаковка + применение
// кадра > 50 мс) и длинных задач вообще (Long Tasks API, где есть). Матч --match идёт в Worker без паузы
async function measure() {
  const br = await pw[A.browser || 'chromium'].launch(), p = await br.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.route(/^https?:/, r => r.abort()); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url.pathToFileURL(SIM).href + '?worker=1'); await p.waitForTimeout(1500);
  if (!(await p.evaluate(() => __ev('WK.on')))) throw new Error('режим Worker не включился');
  await p.evaluate(m => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask' }); } catch (e) { window.__lt = null; }
    __ev('wkSend({cmd: "match", n: ' + m + ', now: nowTs}); clockPause(false); 1'); }, M);
  await p.waitForTimeout(2000); await p.evaluate(() => { __ev('WK_STAT = {n: 0, bytes: 0, maxBytes: 0, enc: 0, dec: 0, apply: 0, maxMs: 0, long: 0}; 1'); if (window.__lt) window.__lt.length = 0; });
  const t0 = await p.evaluate(() => __ev('tick')); await p.waitForTimeout(+A.measure * 1000);
  const r = await p.evaluate(() => ({ S: __ev('WK_STAT'), tick: __ev('tick'), on: __ev('WK.on'), lt: window.__lt, ua: navigator.userAgent }));
  const S = r.S, n = S.n || 1, out = { browser: A.browser || 'chromium', ua: r.ua, sec: +A.measure, frames: S.n, fps: +(S.n / A.measure).toFixed(1), ticks: r.tick - t0, worker_on: r.on,
    bytes_avg: Math.round(S.bytes / n), bytes_max: S.maxBytes, enc_ms_avg: +(S.enc / n).toFixed(2), dec_ms_avg: +(S.dec / n).toFixed(2), apply_ms_avg: +(S.apply / n).toFixed(2),
    page_ms_max: +S.maxMs.toFixed(1), long_by_transfer: S.long, long_tasks_all: r.lt ? r.lt.length : 'нет Long Tasks API', errors: errs.slice(0, 3) };
  console.log(JSON.stringify(out, null, 1)); if (A.out) require('fs').writeFileSync(A.out, JSON.stringify(out, null, 1));
  await br.close(); process.exit(S.long || !S.n || !r.on ? 1 : 0);
}
(async () => {
  if (A.measure) return measure();
  // --local=<адрес> (Р5.4): страница B — с локального сервера tools/node/local_server.js (симуляция — процесс Node), иначе — режим Worker
  const br = await pw.chromium.launch(); const a = await page(br, ''), b = A.local ? await page(br, '/?local=1', A.local) : await page(br, '?worker=1'); let bad = 0;
  if (!(await b.evaluate(() => __ev('WK.on')))) throw new Error('режим Worker не включился (нет #simCore? сборка без --worker)');
  // часы и случайность Worker — закрепить так же, как у страниц (закрепление страницы на Worker не действует): Worker запускается заново
  if (!A.local) await b.evaluate(() => __ev(`WK.w.terminate(); wkStart("(function(){ var t = 1000, s = 1; Math.random = function(){ s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0; return (s >>> 8) / 16777216; }; performance.now = function(){ return t; }; Date.now = function(){ return 1.7e12; }; })();\\n"); 1`));
  await a.evaluate(m => __ev('nowTs = 1e6; freshMatch(' + m + '); 1'), M);
  await wk(b, { cmd: 'match', n: M, now: 1e6 });
  for (const T of TICKS) {
    const hA = await a.evaluate(s => __ev(s), `clockPause(false); while(tick < ${T}){ stepTick(); mkAfterTicks(); nowTs = 1e6; } ` + HASH);   // снимки перемотки — как у Worker (to)
    const tb = await wk(b, { cmd: 'to', t: T, now: 1e6 });
    const hB = await b.evaluate(s => __ev(s), HASH);
    const same = hA === hB; if (!same) bad++;
    const K = A.local ? 'Node' : 'Worker'; console.log('тик ' + T + ' (' + K + ' ' + tb + '): страница ' + hA + ' / ' + K + ' ' + hB + (same ? ' = равны' : ' — РАЗНЫЕ'));
  }
  // (Р5.2, режимы) --modes: управление, меняющее игру, в режиме Worker — перехват → снимок Worker → страница ведёт игру → назад в Worker.
  // A — обычная страница, B — Worker; на одних тиках: кнопка «раунд заново» (перехват клика), страница до T2, возврат в Worker, Worker до T3,
  // отметка клавишей M (перехват клавиши): снимок отметки и «снимок до» (снимки перемотки Worker'а ушли на страницу) — равны
  if (A.modes) {
    const T1 = TICKS[TICKS.length - 1], T2 = T1 + 1500, T3 = T2 + 1500, K = A.local ? 'Node' : 'Worker';
    const run = (p, T) => p.evaluate(s => __ev(s), `clockPause(false); while(tick < ${T}){ stepTick(); mkAfterTicks(); nowTs = 1e6; } ` + HASH);
    // ожидание условия опросом из Node (requestAnimationFrame / setTimeout страницы закреплены — waitForFunction страницы не опрашивает)
    const until = async (p, js, what) => { for (let i = 0; i < 300; i++) { if (await p.evaluate(s => __ev(s), js)) return; await new Promise(r => setTimeout(r, 200)); }
      throw new Error(what + ': ' + (await p.evaluate(() => __ev('JSON.stringify({on: WK.on, hand: WK.hand, cb: !!WK.cb, busy: WK.busy, tick: tick, stay: WK.stay})'))) + ' ' + p.errs.slice(0, 3).join(' | ')); };
    const handed = p => until(p, '!WK.on && !WK.hand', 'симуляция не перешла на страницу');
    const cmp = (what, x, y) => { const ok = x === y; if (!ok) bad++; console.log(what + ': страница ' + x + ' / ' + K + ' ' + y + (ok ? ' = равны' : ' — РАЗНЫЕ')); };
    await a.evaluate(() => __ev('document.getElementById("btnRestartRound").click(); clockPause(false); 1'));
    await b.evaluate(() => __ev('document.getElementById("btnRestartRound").click(); 1'));
    await handed(b); await b.evaluate(() => __ev('clockPause(false); 1'));
    cmp('«раунд заново» (тик ' + T1 + '), страница до ' + T2, await run(a, T2), await run(b, T2));
    await b.evaluate(() => __ev('wkPageFrame(1e9); 1')); await until(b, 'WK.on && !WK.busy', 'назад в ' + K + ' не вернулась');
    await b.evaluate(() => __ev('frameApply(WK.F); WK.F = null; 1'));
    const hA3 = await run(a, T3), t3 = await wk(b, { cmd: 'to', t: T3, now: 1e6 }), hB3 = await b.evaluate(s => __ev(s), HASH);
    cmp('назад в ' + K + ', до ' + T3 + ' (' + t3 + ')', hA3, hB3);
    // снимки сравниваются как у локатора (tools/measure/dv_state.js: состояние игры без кэшей и показа — кэши страницы и Worker'а наполняет
    // разный рисунок): снимок кладётся в страницу (mkRestore) и снимается DV.state
    // и без кэшей (класс «кэш» реестра): их наполняет и показ страницы (путь для рисунка — CLIMB_AT), у Worker'а показа нет — общие записи равны
    const CACHE = Object.keys(require('../../rebuild/state_classes.json')).filter(k => k.startsWith('g:') && (require('../../rebuild/state_classes.json')[k] || {}).class === 'кэш').map(k => k.slice(2));
    const DVS = require('../measure/dv_state.js'), SET = DVS.setupCode(DVS.skipDefault().replace(/\)\$$/, '|' + CACHE.join('|') + ')$'), DVS.SKIPF_DEFAULT) + '\n1';
    await a.evaluate(c => __ev(c), SET); await b.evaluate(c => __ev(c), SET);
    const MKS = `var c = MK.cur, st = function(S){ mkRestore(S); return DV.state(); };
      JSON.stringify(c ? {tick: c.tick, snap: st(c.snap), preTick: c.pre && c.pre.tick, pre: c.pre ? st(c.pre.data) : null} : null)`;
    const h = o => o ? require('crypto').createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 10) : 'нет';
    const key = p => p.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' })); });
    await key(a); await key(b); await handed(b);
    const sa = JSON.parse(await a.evaluate(s => __ev(s), MKS)), sb = JSON.parse(await b.evaluate(s => __ev(s), MKS));
    const MKH = x => x ? 'тик ' + x.tick + ' снимок ' + h(x.snap) + ', до: тик ' + x.preTick + ' ' + h(x.pre) : 'отметка не открылась';
    const dif = (x, y) => x && y ? Object.keys(Object.assign({}, x, y)).filter(k => x[k] !== y[k]) : [];
    if (sa && sb) { const d1 = dif(sa.snap, sb.snap), d2 = dif(sa.pre, sb.pre); if (d1.length || d2.length) console.log('  разные переменные — снимок: ' + d1.slice(0, 20).join(', ') + '; до: ' + d2.slice(0, 20).join(', ')); }
    cmp('отметка M', MKH(sa), MKH(sb));
  }
  if (a.errs.length || b.errs.length) console.log('ошибки страниц: ' + a.errs.concat(b.errs).slice(0, 3).join(' | '));
  await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
