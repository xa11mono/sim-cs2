// (Р6 К-6, 27.11) профиль ОДНОГО тика (первый тик раунда и др.): инспектор V8 (Profiler) включается только вокруг этого тика;
// включительное время функций. node rebuild/evidence/R6/k6_tick_prof.js <core.js> <матч> <тик1,тик2,…>
const insp = require('inspector'), path = require('path'); const [core, m, TL] = process.argv.slice(2);
const EV = require('../../../tools/node/core_run.js').load(core); const s = new insp.Session(); s.connect();
const post = (k, p) => new Promise((ok, no) => s.post(k, p || {}, (e, r) => e ? no(e) : ok(r)));
(async () => {
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 50 });
  EV('freshMatch(' + m + '); 1'); const out = [];
  for (const T of TL.split(',').map(Number)) {
    EV('while(tick < ' + (T - 1) + ') stepTick(); 1');
    await post('Profiler.start'); const t0 = performance.now(); EV('stepTick(); 1'); const ms = performance.now() - t0; const { profile: P } = await post('Profiler.stop');
    const byId = new Map(P.nodes.map(n => [n.id, n])), par = new Map(); P.nodes.forEach(n => (n.children || []).forEach(c => par.set(c, n.id)));
    const incl = {}; let tot = 0; P.samples.forEach((id, i) => { const d = P.timeDeltas[i] || 0; tot += d; const seen = new Set();
      for (let x = id; x !== undefined; x = par.get(x)) { const f = byId.get(x).callFrame.functionName || '(анонимная)'; if (!seen.has(f)) { seen.add(f); incl[f] = (incl[f] || 0) + d; } } });
    out.push({ tick: T, roundState: EV('roundState'), ms: +ms.toFixed(1), top_incl_pct: Object.entries(incl).filter(([f]) => !/^\(|stepTick|^$/.test(f)).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([f, v]) => [f, +(100 * v / tot).toFixed(1)]) });
  }
  console.log(JSON.stringify({ core: path.basename(core), match: +m, ticks: out }, null, 1));
})();
