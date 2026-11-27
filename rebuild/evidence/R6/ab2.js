// (Р6, 27.11) замер «база против кандидата»: R повторов попеременно (база, кандидат, база, …), каждый — новый процесс Node (без прогрева
// JIT от прошлого прогона), матч m до тика T; мс на тик, среднее и разброс (мин–макс) по повторам; выигрыш принимается, только если
// худший прогон кандидата быстрее лучшего прогона базы (правило этапа: выигрыш больше разброса повторов). Равенство игры — локатор
// (tools/measure/diverge.js), здесь — контрольный хэш мест, здоровья и счёта в конце.
// Запуск: node rebuild/evidence/R6/ab2.js <база core.js> <кандидат core.js> <матч> <тиков> [повторов=5]
const cp = require('child_process'), path = require('path');
const [A, B, m, T, R0] = process.argv.slice(2), R = +(R0 || 5);
if (process.env.AB_ONE) {   // один прогон в своём процессе
  const EV = require(path.join(__dirname, '../../../tools/node/core_run.js')).load(process.env.AB_ONE);
  EV('freshMatch(' + m + '); 1'); const t0 = process.hrtime.bigint(); EV(`while(tick < ${T}) stepTick(); 1`); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const h = EV('(function(){ var s = JSON.stringify([score, bots.map(function(b){ return [b.id, b.x, b.y, b.z, b.hp, b.alive, b.facing]; })]), x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; })()');
  console.log(JSON.stringify({ ms_per_tick: ms / T, hash: h })); process.exit(0);
}
const one = core => JSON.parse(cp.execFileSync(process.execPath, [__filename, A, B, m, T], { env: Object.assign({}, process.env, { AB_ONE: core }) }).toString());
const res = { base: [], cand: [] };
for (let i = 0; i < R; i++) { res.base.push(one(A)); res.cand.push(one(B)); }
const st = L => { const v = L.map(x => x.ms_per_tick); return { mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(4), min: +Math.min(...v).toFixed(4), max: +Math.max(...v).toFixed(4), hash: [...new Set(L.map(x => x.hash))] }; };
const b = st(res.base), c = st(res.cand);
console.log(JSON.stringify({ base: path.basename(A), cand: path.basename(B), match: +m, ticks: +T, repeats: R, base_ms: b, cand_ms: c,
  gain_pct: +((1 - c.mean / b.mean) * 100).toFixed(1), beyond_spread: c.max < b.min, same_hash: b.hash.length === 1 && c.hash.length === 1 && b.hash[0] === c.hash[0],
  runs: { base: res.base.map(x => +x.ms_per_tick.toFixed(4)), cand: res.cand.map(x => +x.ms_per_tick.toFixed(4)) } }));
