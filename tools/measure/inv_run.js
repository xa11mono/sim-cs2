// (Р0.6, 24.11) Запуск инвариантов I-01…I-32 (tools/measure/invariants.js — наблюдатель в странице, только чтение).
//   node tools/measure/inv_run.js sim.html [--match=3] [--ticks=20000] [--out=отчёт.json]     — инварианты на тиках матча
//   node tools/measure/inv_run.js sim.html --special [--match=3] [--out=…]                   — отдельные прогоны: I-15, I-24/I-32, I-29 (граф),
//                                                                                            I-22, I-23, I-30 (через tools/measure/diverge.js)
//   node tools/measure/inv_run.js sim.html --neutral [--match=3] [--ticks=…]                 — наблюдатель не меняет игру: хэш позиций с ним и без
const { chromium } = require('playwright'), url = require('url'), fs = require('fs'), path = require('path'), cp = require('child_process');
const args = process.argv.slice(2), opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const sim = args.find(x => !x.startsWith('--'));
if (!sim) { console.error('node tools/measure/inv_run.js sim.html [--match=3] [--ticks=20000] [--special|--neutral] [--out=…]'); process.exit(2); }
const MATCH = +opt('match', 3), TICKS = +opt('ticks', 20000), CHUNK = 500;
const INVJS = fs.readFileSync(path.join(__dirname, 'invariants.js'), 'utf8');
async function page(browser) { const p = await browser.newPage(); await p.route(/^https?:/, r => r.abort()); await p.goto(url.pathToFileURL(path.resolve(sim)).href); await p.waitForTimeout(1200); return p; }
const ev = (p, code) => p.evaluate(c => __ev(c), code);
// хэш позиций как в fingerprint.js (x, y, взгляд, HP, жив) — для проверки нейтральности
const HASH = `window.HH = {h: 2166136261 >>> 0, F: new Float64Array(1)}; HH.U = new Uint32Array(HH.F.buffer);
  HH.mix = function(v){ HH.F[0] = +v || 0; HH.h = Math.imul(HH.h ^ HH.U[0], 16777619) >>> 0; HH.h = Math.imul(HH.h ^ HH.U[1], 16777619) >>> 0; };
  HH.tick = function(){ bots.forEach(function(b){ HH.mix(b.x); HH.mix(b.y); HH.mix(b.facing); HH.mix(b.hp); HH.mix(b.alive ? 1 : 0); }); };`;
async function play(p, withInv) {
  await ev(p, HASH + (withInv ? '\n' + INVJS : '') + `\nfreshMatch(${MATCH}); 1`);
  for (let t = 0; t < TICKS; t += CHUNK)
    await ev(p, `for(var i = 0; i < ${CHUNK}; i++){ var t0 = performance.now(); stepTick(); var dt = performance.now() - t0; ${withInv ? 'INV.tick(dt);' : ''} HH.tick(); } 1`);
  return JSON.parse(await ev(p, `JSON.stringify({tick: tick, round: roundNum, hash: HH.h, inv: ${withInv ? 'INV.R' : 'null'}, evErrs: (typeof simEvIn === 'function' && simEvIn.errs) || []})`));
}
function diverge(extra) {
  const r = cp.spawnSync('node', [path.join(__dirname, 'diverge.js'), sim, sim, '--match=' + MATCH].concat(extra), { encoding: 'utf8', env: process.env });
  return { exit: r.status, out: (r.stdout || '').trim().split('\n').slice(0, 6).join(' | ') };
}
(async () => {
  const browser = await chromium.launch(), rep = { sim, match: MATCH, ticks: TICKS };
  if (args.includes('--neutral')) {
    const [a, b] = await Promise.all([page(browser), page(browser)]);
    const [ra, rb] = await Promise.all([play(a, true), play(b, false)]);
    rep.neutral = { withInv: ra.hash, without: rb.hash, same: ra.hash === rb.hash && ra.tick === rb.tick, tick: ra.tick };
    console.log('наблюдатель ' + (rep.neutral.same ? 'не меняет игру' : 'МЕНЯЕТ ИГРУ') + ': хэш ' + ra.hash + ' / ' + rb.hash + ' на тике ' + ra.tick);
  } else if (args.includes('--special')) {
    const p = await page(browser);
    // граф навмеша: связи zoneGraph «откуда>куда» (как в разборе этапа 2B)
    rep.graph = JSON.parse(await ev(p, `(function(){
      function snap(){ var s = {}; for(var k in zoneGraph) (zoneGraph[k] || []).forEach(function(e){ s[k + '>' + e.to] = 1; }); return s; }
      function cmp(a, b){ var x = Object.keys(a).filter(function(k){ return !b[k]; }).length, y = Object.keys(b).filter(function(k){ return !a[k]; }).length; return {onlyFirst: x, onlySecond: y, same: !x && !y}; }
      var load = snap(); if(typeof navTallDone !== 'undefined' && !navTallDone && typeof navCutTall === 'function') navCutTall(); var loadCut = snap();
      freshMatch(${MATCH}); var fresh = snap();
      rebuildNav(); if(typeof navCutTall === 'function') navCutTall(); var reb = snap();
      var walls = null; if(typeof applyWalls === 'function'){ applyWalls(true); if(typeof navCutTall === 'function') navCutTall(); walls = snap(); }
      return JSON.stringify({edges: Object.keys(loadCut).length, 'I-15 freshMatch = загрузка': cmp(loadCut, fresh), 'I-24/I-32 rebuildNav+navCutTall = загрузка': cmp(loadCut, reb),
        'I-29 applyWalls (стены сборки, без базы владельца) = загрузка': walls ? cmp(loadCut, walls) : 'нет applyWalls'}); })()`));
    await p.close();
    // I-22: newMatch после матча = свежий матч того же номера (2000 тиков после); I-23: снимок в новой странице = игра (2000 тиков);
    // I-30: перестановка двух ботов одной стороны в массиве bots — ожидаемо меняет игру: первый тик и переменные
    const played = +opt('played', 3000);
    // I-22 по определению — отпечаток (позиции, взгляд, HP по тикам), а не полное состояние: номер тика и часы матча newMatch не обнуляет
    { const [a, b] = await Promise.all([page(browser), page(browser)]);
      const n = await ev(a, HASH + `\nfreshMatch(${MATCH}); for(var i = 0; i < ${played}; i++) stepTick(); newMatch(); matchNum`);
      await ev(b, HASH + `\nfreshMatch(${n}); 1`);
      const seq = p2 => ev(p2, `var S = []; for(var i = 0; i < 2000; i++){ stepTick(); HH.h = 2166136261 >>> 0; HH.tick(); S.push(HH.h); } JSON.stringify(S)`).then(JSON.parse);
      const [sa, sb] = await Promise.all([seq(a), seq(b)]), k = sa.findIndex((h, i) => h !== sb[i]);
      rep['I-22'] = { match: n, ticksCompared: 2000, firstDiffTickAfterStart: k, same: k < 0 }; await a.close(); await b.close(); }
    rep['I-23'] = diverge(['--ticks=2000', '--snap-at=' + played]);
    rep['I-30'] = diverge(['--ticks=4000', '--start-b=freshMatch(' + MATCH + '); var _i = bots.findIndex(function(b){ return b.team === "T"; }); var _t = bots[_i]; bots[_i] = bots[_i + 1]; bots[_i + 1] = _t;']);
    console.log(JSON.stringify(rep, null, 1));
  } else {
    const p = await page(browser), r = await play(p, true);
    Object.assign(rep, { endTick: r.tick, round: r.round, evErrs: r.evErrs, inv: r.inv });
    for (const [id, v] of Object.entries(r.inv).sort()) console.log(id + ': ' + v.n + (v.hist ? ' | наибольшее по ключу: ' + JSON.stringify(Object.entries(v.hist).sort((a, b) => b[1] - a[1]).slice(0, 4)) : '') + (v.eps.length ? ' | первый: ' + JSON.stringify(v.eps[0]).slice(0, 160) : ''));
  }
  if (opt('out', '')) fs.writeFileSync(opt('out', ''), JSON.stringify(rep, null, 1));
  await browser.close();
})();
