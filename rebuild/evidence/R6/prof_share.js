// (Р6, 27.11) доли кандидатов К-1…К-9 в тике по профилю V8 (node --cpu-prof): собственное и ВКЛЮЧИТЕЛЬНОЕ время функции (образец считается
// у функции один раз, если она есть в стеке), от времени stepTick. Запуск: сначала профиль
//   node --cpu-prof --cpu-prof-dir=<папка> rebuild/evidence/R6/prof_share.js run <core.js> <матч> <тиков>
// затем доли: node rebuild/evidence/R6/prof_share.js share <файл .cpuprofile>
const fs = require('fs'), path = require('path');
const [cmd, a1, a2, a3] = process.argv.slice(2);
if (cmd === 'run') { const EV = require(path.join(__dirname, '../../../tools/node/core_run.js')).load(a1); EV('freshMatch(' + a2 + '); while(tick < ' + a3 + ') stepTick(); 1'); process.exit(0); }
// кандидаты плана (stage3/PERFORMANCE_PLAN.md) — функции, по которым считается доля
const K = {
  'К-1 поиск пути': ['zoneDijkstra', 'buildWaypointPath0', 'funnel', 'pathQ', 'pathPts', 'pathLenTo'],
  'К-2 лучи и видимость': ['m3Cast', 'visLine', 'visParts', 'visFloorAt', 'hasLOS', 'm3SolidHit'],
  'К-3 подбор броска': ['nadeSolve', 'nadeGuess', 'throwNadeTry', 'nadeThrowSpot', 'nadeFly', 'nadeStep', 'm3NadeTrace'],
  'К-4 точка в многоугольнике': ['pointInPoly', 'navAt', 'navFloorNear'],
  'К-5 план взгляда': ['lookPlan', 'lookCands0', 'lookKnowCands', 'lookTick'],
  'К-6 первый тик раунда': ['pickSpots', 'postViewPoint'],
  'К-7 цена известных врагов': ['knownSegCost', 'knownPathSpots'],
  'К-8 знание и войс': ['knowTick', 'beliefTick', 'teamChannel'],
};
const P = JSON.parse(fs.readFileSync(a1, 'utf8')), byId = new Map(P.nodes.map(n => [n.id, n])), parent = new Map();
P.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
const dt = new Map(); P.samples.forEach((s, i) => dt.set(s, (dt.get(s) || 0) + (P.timeDeltas[i + 1] || 0)));
const self = {}, incl = {}; let total = 0, tickT = 0;
for (const [id, t] of dt) { total += t; const n = byId.get(id); self[n.callFrame.functionName] = (self[n.callFrame.functionName] || 0) + t;
  const seen = new Set(); for (let x = id; x !== undefined; x = parent.get(x)) { const f = byId.get(x).callFrame.functionName; if (!seen.has(f)) { seen.add(f); incl[f] = (incl[f] || 0) + t; } } }
tickT = incl.stepTick || total;
const pct = v => +(100 * (v || 0) / tickT).toFixed(1);
const out = { profile: path.basename(a1), total_ms: Math.round(total / 1000), stepTick_ms: Math.round(tickT / 1000), candidates: {} };
for (const [k, L] of Object.entries(K)) out.candidates[k] = { functions: Object.fromEntries(L.map(f => [f, { incl_pct: pct(incl[f]), self_pct: pct(self[f]) }])) };
out.gc_pct = pct(self['(garbage collector)']);
out.top_self = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([f, v]) => [f || '(анонимная)', pct(v)]);
console.log(JSON.stringify(out, null, 1));
