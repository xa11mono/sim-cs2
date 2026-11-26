// (Р3.6, 25.11) пробы новых счётчиков рядом со старыми: stall по причинам (PROB.sub) — положительная и похожая отрицательная сцена на
// каждую причину; старый PROB.n.stall не меняется. Фикстура та же, что в probe_detectors.cjs (VM, неизменённый 545). Запуск из корня:
// node rebuild/diagnostics-audit/probe_r36.cjs
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, 'probe_detectors.cjs'), 'utf8');
// фикстура и run() — из probe_detectors.cjs (без его сцен и вывода)
const head = src.slice(0, src.indexOf("run('P01_wall_block'"));
const M = { exports: {} }; vm.runInThisContext('(function(require, module, __dirname){' + head + '; module.exports = {fixture, motion, cases, run};})')(require, M, __dirname);
const { motion, fixture, cases, run } = M.exports;
const sub = f => f.c.PROB.sub || {};
run('R36_geom', () => { const f = motion(); f.c.crossed = true; f.advance(6 * 64);
  assert.equal(f.c.PROB.n.stall, 1); assert.equal(sub(f)['stall.geom'], 1); assert.equal(f.c.PROB.ev[0].sub, 'stall.geom'); assert(f.c.PROB.ev[0].why);
  return { observed: sub(f), detail: 'стена на шаге → stall.geom (старый stall = 1)' }; });
run('R36_free', () => { const f = motion(); f.advance(6 * 64, t => { f.a.baseX = f.a.x = (t % (5 * 64)) / 8; });
  assert.equal(sub(f)['stall.free'], 1); assert(!sub(f)['stall.geom']);
  return { observed: sub(f), detail: 'шаг свободен, а стоит → stall.free, не geom' }; });
run('R36_block', () => { const f = fixture(); f.a.atPost = true; f.a.holding = true;
  f.advance(10 * 64, t => { if (t % 64 === 0) f.a._dlog.push([t, 'место', 'отказ «route:site»: занят «contact:hold»']); });
  assert.equal(sub(f)['stall.block'], 1); assert(!sub(f)['stall.geom'] && !sub(f)['stall.free']);
  return { observed: sub(f), detail: 'задача выше не пускает (отказы арбитра) → stall.block' }; });
run('R36_hold_none', () => { const f = motion(); f.a.atPost = true; f.a.holding = true; f.a.curSpeed = 0; f.advance(6 * 64);
  assert.equal(Object.keys(sub(f)).length, 0);
  return { observed: sub(f), detail: 'держит пост по плану — ни одного stall.*' }; });
run('R36_overlap_split', () => { const f = motion();
  f.advance(10 * 64, t => { if (t % 64 === 0) f.a._dlog.push([t, 'место', 'отказ «route:site»: занят «contact:hold»']); });
  assert.equal(f.c.PROB.n.stall, 2); assert.equal(sub(f)['stall.block'], 1); assert.equal(Object.values(sub(f)).reduce((a, b) => a + b, 0), 2);
  return { observed: sub(f), detail: 'одно стояние даёт два старых stall (известный двойной счёт, P05) — по причинам видно: block + второе' }; });
// флешка без реакции по знанию (watch.js): W03 Codex — источник неизвестен → старый счёт 1, новый 0; знал (видел бросавшего) → новый 1;
// знал, но ослеплён → новый 0; знал, но в бою → новый 0
const flash = (setup) => { const f = fixture(true); f.a.facing = Math.PI; f.advance(1); setup && setup(f);
  f.c.detonate({ type: 'flash', thrower: f.b, team: 'T', x: 10, y: 0, z: 100, ox: 20, oy: 0 }); f.advance(96, () => setup && setup.each && setup.each(f)); return f.watch(); };
run('R36_flash_unknown', () => { const w = flash(); assert.equal(w.dangerBy['флешка без реакции'], 1); assert(!w.n['danger.flashKnown']);
  return { observed: { old: 1, known: w.n['danger.flashKnown'] || 0 }, detail: 'источник неизвестен: старый счёт 1, новый 0 (поворота не требует)' }; });
run('R36_flash_known', () => { const w = flash(f => { f.a._visible = [f.b]; }); assert.equal(w.n['danger.flashKnown'], 1);
  return { observed: { old: w.dangerBy['флешка без реакции'], known: 1 }, detail: 'видел бросавшего, не повернулся, не ушёл → новый 1' }; });
run('R36_flash_known_blind', () => { const s = f => { f.a._visible = [f.b]; }; s.each = f => { f.a.blindUntil = f.c.tick + 100; };
  const w = flash(s); assert(!w.n['danger.flashKnown']);
  return { observed: { old: w.dangerBy['флешка без реакции'], known: 0 }, detail: 'знал, но ослеплён — реакции не требуется → новый 0' }; });
run('R36_flash_known_fight', () => { const s = f => { f.a._visible = [f.b]; f.a._sawEnemy = true; };
  const w = flash(s); assert(!w.n['danger.flashKnown']);
  return { observed: { old: w.dangerBy['флешка без реакции'], known: 0 }, detail: 'знал, но в бою (видит врага) → новый 0' }; });
// полнота: у каждого увеличения счётчика — событие с причиной (PROB.all, W.all), а не выборка
run('R36_all_complete', () => { const f = motion(); f.advance(10 * 64, t => { if (t % 64 === 0) f.a._dlog.push([t, 'место', 'отказ «route:site»: занят «contact:hold»']); });
  const P = f.c.PROB; assert.equal(P.all.length, P.n.stall + P.n.nav + P.n.tug); assert(P.all.every(e => e.why && e.text));
  const w = flash(s0 => { s0.a._visible = [s0.b]; }); const nD = w.n.danger, nA = (w.all.danger || []).length; assert.equal(nA, nD);
  return { observed: { prob: P.all.length, danger: nA }, detail: 'PROB.all = сумма счётчиков, у каждого события причина; W.all.danger = W.n.danger' }; });
console.log(JSON.stringify({ type: 'Р3.6: новые счётчики stall.* рядом со старым', cases: cases }, null, 2));
