// (Р5, 27.11) Режимы страницы до и после переноса расчёта в ядро (engine/core/modes.js): одна и та же последовательность настоящих действий
// (клики Playwright по кнопкам и панелям, Shift + клик по карте, кадры страницы frameBody) в двух сборках даёт одно и то же ПОЛНОЕ состояние
// игры (tools/measure/dv_state.js) после каждого шага: разминка (кадры, «Начать матч»), песочница (вкл, «ИИ никому», ИИ / ход одному, приказ,
// перетаскивание, выкл), раунд из демки (если в карте есть раунды демок), повтор клатча (кадры с рисованием повтора). Math.random страницы —
// одинаковый посев в обеих сборках (разминка случайна по замыслу). Не сравниваются только MK* и поля / переменные показа, которые ядро не
// читает (как ui_state_check.js), и переменные режимов показа, которых нет в одной из сборок.
// --dm-native: в обеих сборках DM.sin / DM.cos = Math.sin / Math.cos движка (у V8 они расходятся с DM в ~0,9 % аргументов на последний бит):
// отделяет единственное ожидаемое различие — расчёт режима теперь по DM.* (правило ядра Р2), а раньше по Math.* показа.
// Запуск: node tools/page/modes_check.js <старая.html> <новая.html> [--match=3] [--dm-native] [--out=отчёт.json]
'use strict';
const pw = require('playwright'), url = require('url'), path = require('path'), fs = require('fs');
const DVS = require('../measure/dv_state.js');
const A = Object.fromEntries(process.argv.slice(4).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const OLD = path.resolve(process.argv[2]), NEW = path.resolve(process.argv[3]), M = +(A.match || 3);
const UI = require('../../rebuild/gen/ui.json'), REG = require('../../rebuild/state_classes.json');
const rx = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SHOWF = UI.showFields.filter(x => !x.read_by_core.length).map(x => rx(x.field)), SHOWV = (UI.showVars || []).filter(x => !x.read_by_core.length).map(x => rx(x.var));
const SET = DVS.setupCode(DVS.skipDefault().replace(/\)\$$/, '|WK_STAT|' + SHOWV.join('|') + ')$'), DVS.SKIPF_DEFAULT.replace(/\)\$$/, '|' + SHOWF.join('|') + ')$')) + '\n1';
const gameVar = k => !/^(диагностика|показ)$/.test((REG['g:' + k] || {}).class || '');
async function open(br, file) {
  const p = await br.newPage({ viewport: { width: 1600, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/^https?:/, r => r.abort());
  await p.addInitScript(() => { let s = 1; Math.random = () => { s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0; return (s >>> 8) / 16777216; }; window.requestAnimationFrame = () => 0; });
  await p.goto(url.pathToFileURL(file).href); await p.waitForTimeout(1200); await p.evaluate(c => __ev(c), SET); if (A['dm-native']) await ev(p, 'DM.sin = Math.sin; DM.cos = Math.cos; DM.atan2 = Math.atan2; DM.hypot = Math.hypot; 1'); p.errs = errs; p.ts = 1000; return p;
}
const ev = (p, s) => p.evaluate(s => __ev(s), s);
async function click(p, sel, opt) {
  if (!(await p.isVisible(sel))) await p.evaluate(s => { const d = document.querySelector(s); const dd = d && d.closest('details'); if (dd && !dd.open) dd.querySelector('summary').click(); }, sel);
  await p.click(sel, Object.assign({ timeout: 5000 }, opt || {}));
}
async function framesN(p, n) { for (let i = 0; i < n; i++) { p.ts += 16.667; await ev(p, 'frameBody(' + p.ts + '); 1'); } }
async function state(p) { return JSON.parse(await ev(p, 'JSON.stringify({tick: tick, st: DV.state()})')); }
// экранная точка мира (как navScreenToWorld наоборот): холст карты, вид view
// камера показа плавно следует по часам страницы (performance.now) — перед кликом по карте одна и та же в обеих сборках (показ, не игра)
async function scr(p, x, y) { await ev(p, 'view.scale = 0.5; view.panX = 300; view.panY = 0; 1'); return JSON.parse(await ev(p, '(function(){ var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; return JSON.stringify({x: r.left + (' + x + '*view.scale + view.panX)/d, y: r.top + (' + y + '*view.scale + view.panY)/d}); })()')); }
// пути различий (до n): объект — по ключам, массив — по номерам
function paths(x, y, pre, out, n) { if (out.length >= n) return out; if (JSON.stringify(x) === JSON.stringify(y)) return out;
  if (x && y && typeof x === 'object' && typeof y === 'object') { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) paths(x[k], y[k], pre + '.' + k, out, n); return out; }
  out.push(pre + ': ' + JSON.stringify(x).slice(0, 60) + ' ≠ ' + JSON.stringify(y).slice(0, 60)); return out; }
function diff(a, b) {   // различия игровых переменных и полей
  const D = []; const ks = new Set([...Object.keys(a.st), ...Object.keys(b.st)]);
  for (const k of ks) { if (!(k in a.st) || !(k in b.st)) { if (gameVar(k)) D.push(k + ' (есть только в ' + (k in a.st ? 'старой' : 'новой') + ')'); continue; }
    if (JSON.stringify(a.st[k]) !== JSON.stringify(b.st[k]) && gameVar(k)) { let d = k; D.paths = (D.paths || []).concat(paths(a.st[k], b.st[k], k, [], 6));
      if (k === 'bots' && Array.isArray(a.st[k])) { const F = new Set(); a.st[k].forEach((o, i) => { const q = b.st[k][i] || {}; for (const f of new Set([...Object.keys(o), ...Object.keys(q)])) if (JSON.stringify(o[f]) !== JSON.stringify(q[f])) F.add(f); }); d += '[' + [...F].slice(0, 12).join(',') + ']'; }
      else if (a.st[k] && typeof a.st[k] === 'object') { const F = new Set(); for (const f of new Set([...Object.keys(a.st[k]), ...Object.keys(b.st[k] || {})])) if (JSON.stringify(a.st[k][f]) !== JSON.stringify((b.st[k] || {})[f])) F.add(f); d += '[' + [...F].slice(0, 12).join(',') + ']'; }
      D.push(d); } }
  if (a.tick !== b.tick) D.unshift('tick ' + a.tick + ' ≠ ' + b.tick);
  return D;
}
const STEPS = [
  ['разминка: «Новый матч» с разминкой, 400 кадров', async p => { if (!(await p.isChecked('#chkWarm'))) await click(p, '#chkWarm'); await p.fill('#inpMatchNum', String(M)); await click(p, '#btnFreshMatch'); await framesN(p, 400); }],
  ['разминка: «Начать матч»', async p => { await click(p, '#btnWarmSkip'); await framesN(p, 60); }],
  ['песочница: вкл, 200 кадров', async p => { await click(p, '#btnSandbox'); await framesN(p, 200); }],
  ['песочница: «ИИ никому», «ИИ» и «ход» первому, 120 кадров', async p => { await click(p, '[data-sb="allOff"]'); await click(p, '.sb-list [data-sb="ai"]'); await click(p, '.sb-list [data-sb="walk"]'); await framesN(p, 120); }],
  ['песочница: выбрать бота, Shift + клик — приказ, 200 кадров', async p => { await click(p, '.sb-list [data-sb="sel"]');
    const w = JSON.parse(await ev(p, 'JSON.stringify({x: bots[0].x + 150, y: bots[0].y})')); const s = await scr(p, w.x, w.y);
    await p.keyboard.down('Shift'); await p.mouse.click(s.x, s.y); await p.keyboard.up('Shift'); await framesN(p, 200); }],
  ['песочница: перетащить бота мышью, 60 кадров', async p => { const w = JSON.parse(await ev(p, 'JSON.stringify((function(){ var b = bots.filter(function(o){ return o.alive; })[1]; return {x: b.x, y: b.y}; })())'));
    const s0 = await scr(p, w.x, w.y), s1 = await scr(p, w.x + 60, w.y + 40); await p.mouse.move(s0.x, s0.y); await p.mouse.down(); await p.mouse.move(s1.x, s1.y, { steps: 5 }); await p.mouse.up(); await framesN(p, 60); }],
  ['песочница: «ИИ всем», выкл, 120 кадров', async p => { await click(p, '[data-sb="allOn"]'); await click(p, '#btnSandbox'); await framesN(p, 120); }],
  ['раунд из демки (первый в списке), 300 кадров', async p => { if (!(await p.isVisible('#btnDemoView'))) return 'нет раундов демок'; await click(p, '#btnDemoView');
    if (!(await p.$('[data-dv="0"]'))) return 'нет кнопки раунда'; await click(p, '[data-dv="0"]'); await framesN(p, 300); }],
  ['раунд из демки: стоп, панель закрыть', async p => { if (!(await p.$('[data-dv="stop"]'))) return 'нет'; await click(p, '[data-dv="stop"]'); await click(p, '#btnDemoView'); await framesN(p, 30); }],
  ['повтор клатча: до конца раундов с рисованием повтора', async p => { if (await p.$('#chkRp') && !(await p.isChecked('#chkRp'))) await click(p, '#chkRp');
    await p.fill('#inpMatchNum', String(M)); if (await p.isChecked('#chkWarm')) await click(p, '#chkWarm'); await click(p, '#btnFreshMatch');
    let n = 0; for (; n < 60; n++) { await ev(p, 'for(var i=0;i<400;i++) stepTick(); 1'); await framesN(p, 20); if (await ev(p, 'typeof RP !== "undefined" && RP.on')) break; }
    if (await ev(p, 'typeof RP !== "undefined" && RP.on')) { await framesN(p, 240); return 'повтор показан'; } return 'повтор не начался за ' + n + ' шагов'; }],
];
(async () => {
  const br = await pw.chromium.launch(); const P = [await open(br, OLD), await open(br, NEW)]; const rep = { old: OLD, new: NEW, match: M, steps: [] }; let bad = 0;
  for (const [name, fn] of STEPS.slice(0, +(A.steps || STEPS.length))) {   // --steps=N — первые N шагов
    const notes = []; for (const p of P) notes.push(await fn(p));
    const [a, b] = [await state(P[0]), await state(P[1])], D = diff(a, b); if (D.length) bad++;
    const where = []; for (const k of D.filter(x => !/ /.test(x)).map(x => x.split('[')[0]).slice(0, 3)) {   // первое различие строки состояния (DV.last)
      const x = await P[0].evaluate(k => (window.DV.last || {})[k] || '', k), y = await P[1].evaluate(k => (window.DV.last || {})[k] || '', k); let i = 0; while (i < x.length && x[i] === y[i]) i++;
      try { const X = JSON.parse(x), Y = JSON.parse(y); if (Array.isArray(X)) { const F = []; X.forEach((o, j) => { if (o && typeof o === 'object') for (const f of Object.keys(o)) if (JSON.stringify(o[f]) !== JSON.stringify((Y[j] || {})[f])) F.push(j + '.' + f + '=' + JSON.stringify(o[f]).slice(0, 50) + '≠' + JSON.stringify((Y[j] || {})[f]).slice(0, 50)); }); where.push(k + ' поля: ' + F.slice(0, 14).join('; ')); } } catch (e) {}
      where.push(k + ' @' + i + ' старая: …' + x.slice(Math.max(0, i - 200), i + 100) + ' | новая: …' + y.slice(Math.max(0, i - 200), i + 100)); }
    const r = { step: name, where, tick: [a.tick, b.tick], equal: !D.length, diff: D.slice(0, 20), paths: D.paths, note: notes[0] || undefined, note_new: notes[1] !== notes[0] ? notes[1] : undefined, errs: P.map(p => p.errs.splice(0)) };
    rep.steps.push(r); console.log((D.length ? '✗ ' : '✓ ') + name + ' — тик ' + a.tick + (D.length ? ' / ' + b.tick + ': ' + D.slice(0, 8).join(', ') : '') + (notes[0] ? ' (' + notes[0] + ')' : '') + (r.errs.some(e => e.length) ? ' ошибки: ' + JSON.stringify(r.errs) : ''));
  }
  rep.equal = !bad; if (A.out) fs.writeFileSync(A.out, JSON.stringify(rep, null, 1));
  console.log(bad ? 'итог: различий в шагах ' + bad : 'итог: всё равно'); await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
