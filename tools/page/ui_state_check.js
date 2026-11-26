// (Р5.1 / Р5.2 / Р5.4 / Р5.10, владелец 26.11) Интерфейс не меняет игру: одна и та же последовательность настоящих действий (клики Playwright по
// элементам страницы — меню открываются кликом; клавиши — клавиатура Playwright) в вариантах, которые отличаются только показом, даёт одно и то
// же ПОЛНОЕ состояние игры (tools/measure/dv_state.js — все переменные снимка). Кадр — настоящий цикл страницы frameBody с заданными метками
// времени (60 к/с, 30 к/с с рывками, «скрытая вкладка» — один кадр через минуту). Не сравниваются только MK* (инструмент отметок) и поля
// показа, для которых разбор кода доказал, что ядро их не читает (rebuild/gen/ui.json showFields, tools/rebuild/frame_contract.js). Кэши
// (класс «кэш»: их наполняет и показ — путь для рисунка) сравниваются по общим ключам: значения равны; лишние ключи — в отчёт.
// Варианты: base — без рисунка (кадр остановлен, тики шагами); draw60; draw30 (рывки, скрытая вкладка); layers (все слои); view3d (3D, от
// первого лица); hud (обсервер O, размер окна); seq — действия, меняющие игру (пауза / продолжение, отметка M и отмена, «раунд заново»), в
// обычном режиме, в Worker (--worker-sim=<сборка --worker>) и в локальном режиме (--local=<адрес tools/node/local_server.js>).
// Запуск: node tools/page/ui_state_check.js <sim.html> [--worker-sim=…] [--local=http://127.0.0.1:8766] [--match=3] [--ticks=5000] [--only=…]
'use strict';
const pw = require('playwright'), url = require('url'), path = require('path'), fs = require('fs');
const DVS = require('../measure/dv_state.js'), ROOT = path.join(__dirname, '..', '..');
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const SIM = path.resolve(process.argv[2]), M = +(A.match || 3), T = +(A.ticks || 5000), ONLY = A.only ? A.only.split(',') : null;
const REG = require('../../rebuild/state_classes.json'), UI = require('../../rebuild/gen/ui.json');
const CACHE = new Set(Object.keys(REG).filter(k => k.startsWith('g:') && REG[k].class === 'кэш').map(k => k.slice(2)));
// поля показа, которые ядро не читает (доказательство — разбор кода, rebuild/gen/ui.json): не сравниваются
const DSUB = {}; (require('../../rebuild/ui_boundary_known.json').diagnosticSubfields || []).forEach(x => { (DSUB[x.field] = DSUB[x.field] || []).push(x.sub); });
const rx = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SHOWF = UI.showFields.filter(x => !x.read_by_core.length).map(x => rx(x.field)), SHOWV = (UI.showVars || []).filter(x => !x.read_by_core.length).map(x => rx(x.var));
const SET = DVS.setupCode(DVS.skipDefault().replace(/\)\$$/, '|WK_STAT|' + SHOWV.join('|') + ')$'), DVS.SKIPF_DEFAULT.replace(/\)\$$/, '|' + SHOWF.join('|') + ')$')) + '\n1';
// класс различия: игра — провал; диагностика (переменная / поле класса «диагностика» реестра; включает слой) — отдельной строкой
const gameVar = k => !/^(диагностика|показ)$/.test((REG['g:' + k] || {}).class || ''), gameField = f => !/^(диагностика|показ|не поле бота)$/.test((REG['b:' + f] || {}).class || '');
async function open(br, file, q, base) {
  const p = await br.newPage({ viewport: { width: 1600, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/^https?:/, r => (r.request().url().startsWith('http://127.0.0.1:') ? r.continue() : r.abort()));
  await p.addInitScript(() => { let s = 1; Math.random = () => { s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0; return (s >>> 8) / 16777216; }; window.requestAnimationFrame = () => 0; });
  await p.goto((base || url.pathToFileURL(file).href) + q); await p.waitForTimeout(1200); await p.evaluate(c => __ev(c), SET); p.errs = errs; p.ts = 1000; return p;
}
// настоящий клик по элементу: в закрытом меню — сначала клик по его заголовку
async function click(p, sel) {
  const vis = await p.isVisible(sel); if (!vis) { const opened = await p.evaluate(s => { const d = document.querySelector(s); const dd = d && d.closest('details'); if (dd && !dd.open) { dd.querySelector('summary').click(); return true; } return false; }, sel); }
  await p.click(sel, { timeout: 5000 });
}
const ev = (p, s) => p.evaluate(s => __ev(s), s);
// кадры страницы: dts — длительности кадров (мс) по кругу; до тика ≥ цель − 40, остаток — шагами (одинаково во всех вариантах)
async function frames(p, until, dts, worker) {
  let i = 0, guard = 0;
  while (guard++ < 200000) {
    const k = worker ? 1 : 30, seq = []; for (let j = 0; j < k; j++) { p.ts += dts[i++ % dts.length]; seq.push(p.ts); }
    // кадр — только пока до цели больше 40 тиков (кадр после «скрытой вкладки» — до FRAME_CATCHUP_MS, ~16 тиков): цель не проскакивается
    const tk = await p.evaluate(([S, U]) => { for (const t of S) { if (__ev('tick') >= U - 40) break; __ev('frameBody(' + t + ')'); } return __ev('tick'); }, [seq, until]);
    // Worker / Node: ждать ответ и сразу положить кадр (иначе страница видит тик на кадр позже — действие пришлось бы на другой тик)
    if (worker) { for (let w = 0; w < 400 && await ev(p, 'WK.on && WK.busy'); w++) await p.waitForTimeout(5); await ev(p, 'if(WK.on && WK.F){ frameApply(WK.F); WK.F = null; } 1'); }
    if (tk >= until - 40 || await ev(p, 'paused')) return tk;   // пауза: кадры идут, тиков нет
  }
}
async function framesN(p, n, dts, worker) {   // ровно n кадров (разминка: тики не идут, кадры — да)
  for (let i = 0; i < n; i++) { p.ts += dts[i % dts.length]; await ev(p, 'frameBody(' + p.ts + '); 1');
    if (worker) { for (let w = 0; w < 400 && await ev(p, 'WK.on && WK.busy'); w++) await p.waitForTimeout(5); await ev(p, 'if(WK.on && WK.F){ frameApply(WK.F); WK.F = null; } 1'); } }
}
async function finish(p, worker) {   // ровно до T и состояние (Worker / Node — сперва на страницу: снимок ядра)
  if (await ev(p, 'WK.on')) { await p.evaluate(t => new Promise(ok => { const w = __ev('WK.w'); const h = e => { if (e.data.tick >= t || e.data.S) { w.removeEventListener('message', h); ok(); } }; w.addEventListener('message', h); __ev('WK.busy = true; 1'); w.postMessage({ cmd: 'to', t, now: 1e6 }); }), T);
    await p.evaluate(() => new Promise(ok => { __ev('wkToPage')(ok); })); }
  await ev(p, `while(tick < ${T}) stepTick(); 1`);
  return { tick: await ev(p, 'tick'), st: JSON.parse(await ev(p, 'JSON.stringify(DV.state())')), errs: p.errs };
}
async function start(p) {   // новый матч — как владелец: разминка выключена, номер матча, кнопка «Новый матч»
  if (await p.isChecked('#chkWarm')) await click(p, '#chkWarm');
  await p.fill('#inpMatchNum', String(M)); await click(p, '#btnFreshMatch');
  for (let w = 0; w < 200 && await ev(p, 'WK.on && (WK.busy || WK.hand)'); w++) await p.waitForTimeout(20);
}
const F60 = [16.667], F30 = [33.3, 33.3, 100, 5, 33.3, 250];
// элементы показа с id из реестра (rebuild/gen/ui.json): кроме паузы (своя проверка), выгрузки файла, отметки (своя проверка) и входов игры
const VIEW_IDS = [...new Set(UI.handlers.filter(h => h.el && h.el[0] === '#' && /^(click|change|input)$/.test(h.ev) && h.class !== 'меняет игру').map(h => h.el))]
  .filter(id => !/^#(btnPause|btnExportProject|btnMark|mkCancel|mkCopy|mkFile|mkText|mkX|mkLX|hlP|btnFreshMatch|btnRestartRound)$/.test(id)).concat(['#chkVis', '#chkWallbang', '#btn3d']);
// действие с элементом: флажок — щёлкнуть (on / off), список — следующий пункт / вернуть, ползунок — другое значение / вернуть, кнопка — щёлкнуть
const SKIPPED = {}, DONE = {};
const STATIC_IDS = ['#chkWarm', '#inpMatchNum', '#btnFreshMatch', '#btnPause', '#mkCancel', '#btnRestartRound', '#btn3d', '#v3Fp', '#btnWarmSkip'], KEYS = ['m', 'o', 'ArrowRight', 'ArrowLeft'];
async function act(p, id, how, worker) {
  const t = await p.evaluate(s => { const e = document.querySelector(s); return e ? (e.tagName === 'SELECT' ? 'select' : e.type === 'range' ? 'range' : e.type === 'checkbox' ? 'checkbox' : 'button') : null; }, id);
  if (!t) return;
  // невидимый (панель режима закрыта) — пользователь его не нажмёт: пропуск, в отчёт
  if (!(await p.isVisible(id))) { await p.evaluate(s => { const d = document.querySelector(s); const dd = d && d.closest('details'); if (dd && !dd.open) dd.querySelector('summary').click(); }, id);
    if (!(await p.isVisible(id))) { (SKIPPED[id] = SKIPPED[id] || 0); SKIPPED[id]++; return; } }
  (DONE[id] = DONE[id] || 0); DONE[id]++;
  if (t === 'select') { const o = await p.evaluate(s => { const e = document.querySelector(s); return { v: e.value, all: [...e.options].map(x => x.value) }; }, id); p.__sel = p.__sel || {};
    if (how !== 'off') { p.__sel[id] = o.v; const nv = o.all[(o.all.indexOf(o.v) + 1) % o.all.length]; await p.selectOption(id, nv); } else if (p.__sel[id] != null) await p.selectOption(id, p.__sel[id]); return; }
  if (t === 'range') { await p.focus(id); for (let i = 0; i < 3; i++) await p.keyboard.press(how !== 'off' ? 'ArrowRight' : 'ArrowLeft'); return; }   // ползунок — клавишами, как человек
  if (t === 'checkbox' && how === 'off' && !(await p.isChecked(id))) return;
  await click(p, id);
}
const VARIANTS = {
  base: async (p) => { await start(p); await DVS.stopFrames(p); await ev(p, 'clockPause(false); 1'); },
  draw60: async (p) => { await start(p); await frames(p, T, F60); },
  draw30: async (p) => { await start(p); await frames(p, T / 2, F30); p.ts += 60000; await ev(p, 'frameBody(' + p.ts + '); 1'); await frames(p, T, F30); },
  layers: async (p) => { await start(p);
    for (const id of await p.evaluate(() => [...document.querySelectorAll('details.dd input[type=checkbox]')].filter(c => /^chk/.test(c.id) && !c.checked && c.closest('details').querySelector('summary').textContent === 'Слои').map(c => c.id))) await click(p, '#' + id);
    await frames(p, T, F60); },
  view3d: async (p) => { await start(p); await frames(p, T / 3, F60); await click(p, '#btn3d'); await frames(p, 2 * T / 3, F60);
    if (await p.isVisible('#v3Fp')) await click(p, '#v3Fp'); await frames(p, T, F60); },
  hud: async (p) => { await start(p); await frames(p, T / 3, F60); await p.keyboard.press('o'); await p.setViewportSize({ width: 1100, height: 700 }); await frames(p, 2 * T / 3, F30);
    await p.keyboard.press('o'); await p.setViewportSize({ width: 1600, height: 1000 }); await frames(p, T, F60); },
  // все элементы «только показ» / настройки показа с id (rebuild/gen/ui.json) — настоящими кликами по ходу игры: включить, кадры, вернуть
  allview: async (p) => { await start(p); const step = Math.floor(T / (VIEW_IDS.length + 2)); let at = step;
    for (const id of VIEW_IDS) { if (!(await p.$(id))) continue; at += step; await frames(p, at - step / 2, F60); await act(p, id, 'on'); await frames(p, at, F60); await act(p, id, 'off'); }
    await frames(p, T, F60); },
  // меняет игру: одна и та же последовательность в обычном режиме, Worker и Node — все элементы, которые меняют игру без мыши по карте
  allcmd: async (p, worker) => { if (!(await p.isChecked('#chkWarm'))) await click(p, '#chkWarm'); await p.fill('#inpMatchNum', String(M)); await click(p, '#btnFreshMatch');   // разминка
    await framesN(p, 300, F60, worker); if (await p.isVisible('#btnWarmSkip')) await click(p, '#btnWarmSkip');   // 5 с разминки, затем «пропустить»
    for (let w = 0; w < 200 && await ev(p, 'WARM.on || (WK.on && (WK.busy || WK.hand))'); w++) await framesN(p, 5, F60, worker);
    if (await ev(p, 'paused')) await click(p, '#btnPause');
    const seqAt = [['#btnRestartRound'], ['#hlP', 'set'], ['#selSeries', 'set'], ['#btnSandbox', 'on', '#btnSandbox'], ['#btnDemoView', 'on', '#btnDemoView'], ['#btnToTake'], ['#btnRpLast'],
      ['#chkMapEdit', 'on', '#chkMapEdit'], ['#chkLineups', 'on', '#chkLineups'], ['#btnBack10']];
    const step = Math.floor(T / (seqAt.length + 2)); let at = step;
    for (const [id, how, off] of seqAt) { at += step; await frames(p, at - step / 2, F60, worker); if (!(await p.$(id))) continue; await act(p, id, how || 'on', worker);
      for (let w = 0; w < 300 && await ev(p, '(WK.on && (WK.busy || WK.hand)) || MK.busy'); w++) await p.waitForTimeout(20);
      if (await ev(p, 'paused')) await click(p, '#btnPause');
      await frames(p, at, F60, worker); if (off) { await act(p, off, 'off', worker); if (await ev(p, 'paused')) await click(p, '#btnPause'); } }
    await frames(p, T, F60, worker); },
  // меняет игру: одна и та же последовательность в обычном режиме, Worker и Node
  seqM: async (p, worker) => { await start(p); await frames(p, 2500, F60, worker); await p.keyboard.press('m');
    for (let w = 0; w < 200 && await ev(p, '!MK.cur'); w++) await p.waitForTimeout(20);
    await click(p, '#mkCancel'); if (await ev(p, 'paused')) await click(p, '#btnPause'); await frames(p, T, F60, worker); },
  seqP: async (p, worker) => { await start(p); await frames(p, 1500, F60, worker);
    await click(p, '#btnPause'); for (let i = 0; i < 20; i++) await frames(p, 1e9, F60, worker); await click(p, '#btnPause'); await frames(p, T, F60, worker); },
  seq: async (p, worker) => { await start(p); await frames(p, 1500, F60, worker);
    await click(p, '#btnPause'); for (let i = 0; i < 20; i++) await frames(p, 1e9, F60, worker); await click(p, '#btnPause');   // пауза — кадры идут, тиков нет
    await frames(p, 2500, F60, worker); await p.keyboard.press('m');
    for (let w = 0; w < 200 && await ev(p, '!MK.cur'); w++) await p.waitForTimeout(20);
    await click(p, '#mkCancel'); if (await ev(p, 'paused')) await click(p, '#btnPause');
    await frames(p, 3500, F60, worker); await click(p, '#btnRestartRound');
    for (let w = 0; w < 200 && await ev(p, 'WK.on && (WK.busy || WK.hand)'); w++) await p.waitForTimeout(20);
    await frames(p, T, F60, worker); },
};
// сравнение: игра — точно; кэш — общие ключи равны (лишние — от показа, в отчёт)
function compare(a, b) {
  const out = { game: [], cacheDiff: [], cacheExtra: [] };
  out.diag = [];
  for (const k of new Set([...Object.keys(a.st), ...Object.keys(b.st)])) { if (a.st[k] === b.st[k]) continue; (CACHE.has(k) ? out.cacheDiff : k === 'bots' ? (out.bots = true, out.game) : gameVar(k) ? out.game : out.diag).push(k); }
  return out;
}
async function cacheKeys(p, names) {   // для различающихся кэшей: значения по общим ключам
  return p.evaluate(N => { const o = {}; N.forEach(n => { try { o[n] = JSON.parse(DV.last[n]); } catch (e) { o[n] = null; } }); return o; }, names);
}
(async () => {
  const br = await pw.chromium.launch(); let bad = 0; const R = {};
  const run = async (name, file, q, base, worker) => { const p = await open(br, file, q, base); if (worker && !(await ev(p, 'WK.on'))) throw new Error(name + ': режим ' + q + ' не включился');
    await VARIANTS[name.split(':')[0]](p, worker); const r = await finish(p, worker); r.page = p; R[name] = r; return r; };
  const report = async (name, ref) => { const a = R[ref], b = R[name], c = compare(a, b);
    let cacheNote = '';
    if (c.cacheDiff.length) { const ka = await cacheKeys(a.page, c.cacheDiff), kb = await cacheKeys(b.page, c.cacheDiff); const realDiff = [];
      for (const n of c.cacheDiff) { const x = ka[n], y = kb[n]; if (!x || !y || typeof x !== 'object' || Array.isArray(x) || x.m) { realDiff.push(n); continue; }
        // поля-памятки неизменяемых данных (MK_STATIC_FIELDS: _dz, _jcf, _jcq, _npz, zid — ленивый ответ функции от геометрии) — не значение кэша
        const memo = v => JSON.stringify(v, (k, w) => (/^(_dz|_jcf|_jcq|_npz|zid)$/.test(k) ? undefined : w)).replace(/\{"#":\d+\}/g, '"#"');
        const common = Object.keys(x).filter(q => q in y); if (common.some(q => memo(x[q]) !== memo(y[q]))) realDiff.push(n); else c.cacheExtra.push(n + ' (+' + (Object.keys(x).length - common.length) + ' / +' + (Object.keys(y).length - common.length) + ')'); }
      c.game.push(...realDiff.map(n => n + ' (кэш: разные значения по общим ключам)')); }
    if (c.cacheExtra.length) cacheNote = '; кэш — лишние ключи от показа (значения общих равны): ' + c.cacheExtra.join(', ');
    if (c.bots) {   // боты — по полям: игровые поля — провал, поля диагностики — отдельной строкой
      // каждое поле каждого бота — отдельно (номера общих ссылок дерева DV сдвигаются от лишнего объекта раньше по обходу); ссылка на бота — @id
      const BFS = `(function(){ var ids = new Map(); bots.forEach(function(b){ ids.set(b, b.id); });
        function enc(v, seen){ if(v === undefined) return {u: 1}; if(typeof v === 'number') return v !== v ? 'NaN' : (v === 0 && 1/v < 0) ? '-0' : v === Infinity ? 'I' : v === -Infinity ? '-I' : v;
          if(typeof v === 'function') return {f: v.name || 1}; if(v === null || typeof v !== 'object') return v; if(ids.has(v) && seen.length) return '@' + ids.get(v);
          if(seen.indexOf(v) >= 0) return '^'; seen = seen.concat([v]);
          if(Array.isArray(v) || ArrayBuffer.isView(v)) return Array.prototype.map.call(v, function(x){ return enc(x, seen); });
          if(v instanceof Map){ var m = []; v.forEach(function(x, k){ m.push([enc(k, seen), enc(x, seen)]); }); return {m: m}; }
          if(v instanceof Set){ var q = []; v.forEach(function(x){ q.push(enc(x, seen)); }); return {s: q}; }
          var o = {}; Object.keys(v).forEach(function(k){ if(!DV.skipf.test(k)) o[k] = enc(v[k], seen); }); return o; }
        var SUB = ${JSON.stringify(DSUB)};   // подполя диагностики (rebuild/ui_boundary_known.json diagnosticSubfields) — с обоснованием
        function strip(k, v){ var q = SUB[k]; if(!q || v == null) return v; var cut = function(x){ if(!x || typeof x !== 'object') return x; var y = {}; Object.keys(x).forEach(function(z){ if(q.indexOf(z) < 0) y[z] = x[z]; }); return y; };
          return Array.isArray(v) ? v.map(cut) : cut(v); }
        return JSON.stringify(bots.map(function(b){ var o = {}; Object.keys(b).forEach(function(k){ if(!DV.skipf.test(k)) o[k] = JSON.stringify(enc(strip(k, b[k]), [b])); }); return o; })); })()`;
      const fa = JSON.parse(await a.page.evaluate(x => __ev(x), BFS)), fb = JSON.parse(await b.page.evaluate(x => __ev(x), BFS)), F = new Set();
      fa.forEach((x, i) => { const y = fb[i] || {}; Object.keys(Object.assign({}, x, y)).forEach(f => { if (x[f] !== y[f]) F.add(f); }); });
      c.game.splice(c.game.indexOf('bots'), 1); [...F].forEach(f => (gameField(f) ? c.game : c.diag).push('bots.' + f)); }
    if (c.diag.length) cacheNote += '; диагностика (не игра по реестру): ' + c.diag.join(', ');
    if (A.detail) for (const k of [...c.game, ...c.diag, ...c.cacheDiff].map(x => x.split(' ')[0].split('.')[0]).filter((x, i, L) => L.indexOf(x) === i).slice(0, 6)) {   // --detail: где первое различие
      const x = await a.page.evaluate(k => DV.last[k] || '', k), y = await b.page.evaluate(k => DV.last[k] || '', k); let i = 0; while (i < x.length && x[i] === y[i]) i++;
      console.log('    ' + k + ' @' + i + '\n      ' + ref + ': …' + x.slice(Math.max(0, i - 160), i + 120) + '\n      ' + name + ': …' + y.slice(Math.max(0, i - 160), i + 120)); }
    const ok = a.tick === b.tick && !c.game.length; if (!ok) bad++;
    console.log((ok ? '✓ ' : '✗ ') + name + ' = ' + ref + ' (тик ' + b.tick + ', переменных ' + Object.keys(b.st).length + ')' + (c.game.length ? ' — РАЗНЫЕ: ' + c.game.slice(0, 15).join(', ') : '') + cacheNote + (b.errs.length ? '; ошибки страницы: ' + b.errs.slice(0, 2).join(' | ') : '')); };
  const want = n => !ONLY || ONLY.includes(n);
  await run('base', SIM, '');
  for (const n of ['draw60', 'draw30', 'layers', 'view3d', 'hud', 'allview']) if (want(n)) { await run(n, SIM, ''); await report(n, 'base'); }
  if (want('allcmd')) { await run('allcmd', SIM, '');
    if (A['worker-sim']) { await run('allcmd:worker', path.resolve(A['worker-sim']), '?worker=1', null, true); await report('allcmd:worker', 'allcmd'); }
    if (A.local) { await run('allcmd:local', null, '/?local=1', A.local, true); await report('allcmd:local', 'allcmd'); } }
  for (const n of ['seqM', 'seqP']) if (ONLY && ONLY.includes(n)) { await run(n, SIM, ''); await report(n, 'base'); if (A['worker-sim']) { await run(n + ':worker', path.resolve(A['worker-sim']), '?worker=1', null, true); await report(n + ':worker', n); } }
  if (want('seq')) {
    await run('seq', SIM, '');
    if (A['worker-sim']) { await run('seq:worker', path.resolve(A['worker-sim']), '?worker=1', null, true); await report('seq:worker', 'seq'); }
    if (A.local) { await run('seq:local', null, '/?local=1', A.local, true); await report('seq:local', 'seq'); }
  }
  if (Object.keys(DONE).length || Object.keys(SKIPPED).length) console.log('элементы: нажаты ' + Object.keys(DONE).join(' ') + (Object.keys(SKIPPED).length ? '; не видны без режима (пропущены): ' + Object.keys(SKIPPED).join(' ') : ''));
  // --record: успешный прогон дописывает покрытие (rebuild/gen/ui_tested.json — объединение по прогонам): нажатые элементы, клавиши, варианты
  if (A.record && !bad) { const F = path.join(ROOT, 'rebuild', 'gen', 'ui_tested.json'); let o = {}; try { o = JSON.parse(fs.readFileSync(F, 'utf8')); } catch (e) {}
    const U = (a, b) => [...new Set([...(a || []), ...b])].sort();
    o = { _: 'покрытие проверки полного состояния (tools/page/ui_state_check.js --record; только успешные прогоны): элементы, клавиши, варианты', ids: U(o.ids, Object.keys(DONE).concat(STATIC_IDS)),
      keys: U(o.keys, KEYS), variants: U(o.variants, Object.keys(R)), skipped: U(o.skipped, Object.keys(SKIPPED)), frame: true, resize: true, date: new Date().toISOString().slice(0, 10) };
    fs.writeFileSync(F, JSON.stringify(o, null, 1) + '\n'); console.log('покрытие записано: ' + F); }
  await br.close(); console.log(bad ? 'НЕ ПРОШЛО: ' + bad : 'итог: всё равно'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
