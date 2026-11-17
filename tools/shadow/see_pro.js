// В142, шаг 3 (13.11.2026): «что знал каждый» у про — кто кого увидел, той же меркой, что у ботов (запись rec2.js `see`: начало видимости).
// Видимость — как в игре: поле зрения BAL.fov = 110° по взгляду (yaw демки), луч от глаз (z + 64) до груди (z + 48) по 3D-геометрии карты
// (m3Line 'sight', 035_map3d). Дым — из демки (smokegrenade_detonate): шар радиусом 144 ед. на 18 с, линия ближе радиуса к центру — закрыта
// (проектное приближение: настоящий дым CS2 — объём неровной формы, рассеивается и простреливается).
// Раз в 0,5 с (32 тика) по каждой паре T — CT. Вывод: tools/shadow/see_pro_<карта>.json
//   {rounds: [{demo, num, t0, t1, see: [[t от t0, кто, сторона, кого, дистанция ед., x, y кто (радар), x, y кого, скорость кто, кого (ед/с)], …]}]}
// Запуск: node tools/shadow/see_pro.js mirage
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const M3 = require('../map3d/map3d.js');
const map = process.argv[2] || 'mirage', ROOT = path.join(__dirname, '..', '..'), DD = path.join(ROOT, 'data', 'maps', map, 'demos');
const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'maps', map, 'map3d.json'), 'utf8'));
const M = M3.m3Load(J, u => zlib.inflateSync(u));
const FOV = 110 / 2 * Math.PI / 180, STEP = 32;
function csv(f){
  const L = zlib.gunzipSync(fs.readFileSync(f)).toString('utf8').replace(/\r/g, '').split('\n'), H = L[0].split(','), out = [];
  for(let i = 1; i < L.length; i++){ if(!L[i]) continue; const c = L[i].split(','), o = {}; H.forEach((h, k) => o[h] = c[k]); out.push(o); }
  return out;
}
const demos = fs.readdirSync(DD).filter(f => f.endsWith('_ticks.csv.gz')).map(f => f.replace('_ticks.csv.gz', ''));
const rounds = [];
let rays = 0, t0all = Date.now();
for(const d of demos){
  const fe = path.join(DD, d + '_round_freeze_end.csv.gz'), re = path.join(DD, d + '_round_end.csv.gz');
  if(!fs.existsSync(fe) || !fs.existsSync(re)) continue;
  const FE = csv(fe), RE = csv(re).map(r => +r.tick).sort((a, b) => a - b);
  const byNum = {}; FE.forEach(r => { byNum[r.total_rounds_played] = +r.tick; });   // последний конец закупки на номер раунда
  const starts = Object.keys(byNum).map(k => [+k, byNum[k]]).sort((a, b) => a[1] - b[1]);
  const SMK = fs.existsSync(path.join(DD, d + '_smokegrenade_detonate.csv.gz')) ? csv(path.join(DD, d + '_smokegrenade_detonate.csv.gz')).map(r => [+r.tick, +r.x, +r.y, +r.z]) : [];
  const T = csv(path.join(DD, d + '_ticks.csv.gz'));
  const byTick = new Map();
  for(const r of T){ if(r.is_warmup_period === 'True' || r.is_alive !== 'True') continue; const tk = +r.tick; if(!byTick.has(tk)) byTick.set(tk, []); byTick.get(tk).push(r); }
  const ticks = [...byTick.keys()].sort((a, b) => a - b);
  for(let si = 0; si < starts.length; si++){
    const [num, t0] = starts[si]; let t1 = RE.find(x => x > t0); const nx = si + 1 < starts.length ? starts[si+1][1] : Infinity;
    if(t1 === undefined || t1 > nx) t1 = nx; if(!isFinite(t1) || t1 - t0 < 640) continue;
    const see = [], prev = {}, last = {};
    for(const tk of ticks){
      if(tk < t0 || tk > t1 || (tk - t0) % STEP >= 16) continue;   // выборка 0,25 с — берём одну из двух
      const P = byTick.get(tk).map(r => { const rr = M3.m3Radar(M, +r.X, +r.Y); return {sid: r.steamid, side: r.team_num === '3' ? 'CT' : 'T', X: +r.X, Y: +r.Y, Z: +r.Z, yaw: +r.yaw * Math.PI / 180, x: rr[0], y: rr[1]}; });
      const now = {};
      for(const a of P){ const L0 = last[a.sid]; a.v = L0 ? Math.round(Math.hypot(a.X - L0[0], a.Y - L0[1]) / ((tk - L0[2]) / 64)) : 0; }
      for(const a of P) for(const b of P){
        if(a.side === b.side) continue;
        const dx = b.X - a.X, dy = b.Y - a.Y, dist = Math.hypot(dx, dy); if(dist > 4000) continue;
        let da = Math.atan2(dy, dx) - a.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); if(Math.abs(da) > FOV) continue;
        rays++;
        let smoked = false;
        for(const q of SMK){ if(tk < q[0] || tk > q[0] + 18*64) continue;   // отрезок a → b против шара дыма (в плоскости, по высоте — ±150 ед.)
          const ux = q[1] - a.X, uy = q[2] - a.Y, L2 = dx*dx + dy*dy, t = Math.max(0, Math.min(1, (ux*dx + uy*dy) / Math.max(1, L2)));
          if(Math.hypot(a.X + dx*t - q[1], a.Y + dy*t - q[2]) < 144 && Math.abs(a.Z + (b.Z - a.Z)*t - q[3]) < 150){ smoked = true; break; } }
        if(smoked) continue;
        if(!M3.m3Line(M, a.x, a.y, a.Z + 64, b.x, b.y, b.Z + 48, 'sight')) continue;
        const k = a.sid + '>' + b.sid; now[k] = 1;
        if(!prev[k]) see.push([Math.round((tk - t0) / 64 * 10) / 10, a.sid, a.side, b.sid, Math.round(dist), Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y), a.v, b.v]);
      }
      for(const k in prev) delete prev[k]; Object.assign(prev, now);
      for(const a of P) last[a.sid] = [a.X, a.Y, tk];
    }
    rounds.push({demo: d, num: num, t0: t0, t1: t1, see: see});
  }
  process.stderr.write(d + ' ' + rounds.length + ' раундов, лучей ' + rays + ', ' + Math.round((Date.now() - t0all) / 1000) + ' с\n');
}
const out = path.join(__dirname, 'see_pro_' + map + '.json');
fs.writeFileSync(out, JSON.stringify({fov: 110, step: STEP, rounds: rounds}));
console.log(out, rounds.length, 'раундов', rays, 'лучей');
