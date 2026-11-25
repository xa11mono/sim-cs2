// (Т-2, 25.11, вопрос владельца) SERIES между матчами: (1) что с ним делает штатный переход к следующему матчу в этой сборке — два матча
// подряд, SERIES после каждого перехода; (2) влияет ли SERIES на ход игры — снимок в момент перехода, две новые страницы: SERIES как есть
// и SERIES = {bo, maps:{}}; отпечаток (позиции, взгляд, HP, оружие, деньги) по тикам до конца следующего матча. Игру не меняет.
// Запуск: node tools/rebuild/series_check.js sim.html [--match=11] [--matches=2] [--influence=1] [--out=…]
'use strict';
const fs = require('fs'), path = require('path'), pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const SIM = path.resolve(process.argv[2]), M = +(A.match || 11), N = +(A.matches || 2);
const FP = `window.SE = function(K){ var out = [], F64 = new Float64Array(1), U = new Uint32Array(F64.buffer), M0 = matchNum;
  for(var t = 0; t < K && matchNum === M0; t++){ stepTick(); var h = 2166136261 >>> 0;
    function mix(v){ F64[0] = +v || 0; h = Math.imul(h ^ U[0], 16777619) >>> 0; h = Math.imul(h ^ U[1], 16777619) >>> 0; }
    function mixS(s){ s = String(s == null ? '' : s); for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; }
    mix(tick); mixS(roundState); bots.forEach(function(b){ mix(b.x); mix(b.y); mix(b.facing); mix(b.hp); mix(b.alive ? 1 : 0); mixS(b.weapon && b.weapon.key); mix(b.money); });
    out.push(h); }
  return out; };`;
async function page(br) { const ctx = await br.newContext(); const p = await ctx.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(1200); await DVS.stopFrames(p); await p.evaluate(c => __ev(c), FP + '1'); return p; }
(async () => {
  const br = await pw.chromium.launch(), res = { sim: path.basename(SIM), start: M, transitions: [] };
  const p = await page(br);
  await p.evaluate(m => __ev(`freshMatch(${m}); 1`), M);
  let snap = null;
  for (let k = 0; k < N; k++) {
    const r = await p.evaluate(() => __ev(`var M0 = matchNum, n = 0; while(matchNum === M0 && n < 600000){ stepTick(); n++; }
      JSON.stringify({from: M0, to: matchNum, ticks: n, series: SERIES, score_new: [score.CT, score.T]})`)).then(JSON.parse);
    res.transitions.push(r); console.error('переход', r.from, '→', r.to, JSON.stringify(r.series));
    if (k === 0 && A.influence) snap = await p.evaluate(() => __ev('mkPack(mkSnapshot())'));
  }
  if (snap) {   // влияние SERIES: две страницы со снимка момента перехода, до конца матча
    const run = async reset => { const q = await page(br); await q.evaluate(t => { window.__S = t; }, snap);
      return q.evaluate(rs => __ev(`mkOpenSnap(window.__S); ${rs ? 'SERIES = {bo: SERIES.bo, maps: {}};' : ''} JSON.stringify(SE(600000))`), reset).then(JSON.parse); };
    const [a, b] = await Promise.all([run(false), run(true)]);
    const k = a.findIndex((h, i) => h !== b[i]);
    res.influence = { ticks_compared: Math.min(a.length, b.length), same: k < 0 && a.length === b.length, first_diff_step: k < 0 ? null : k };
  }
  await br.close();
  console.log(JSON.stringify(res)); if (A.out) fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
