// (v272) iso_rec + smoke_rec за один проход (R.smoke). Ниже — iso_rec:
// (v269, пункт 2) Смерти T до планта: роль, задача (тег поста), один ли (нет своего ≤350 px), разменяли ли за 3 с.
// И раз в секунду — доля времени «один» по задачам (T, до планта). Только запись.
freshMatch(__M__);
var M0 = matchNum, TT = __T__;
var lastCar = null;   // носитель на начало тика (при смерти бомба падает раньше feedKill)
var R = {match: M0, deaths: [], time: {}, carT: [0, 0], rounds: 0}, S = {kills: 0, killsSmoke: 0, hits: []}, rs = null, pend = [];
function tagOf(b){ return b.post ? String(b.post.tag).split(":")[0].replace(/[AB]$/, "").replace(/[0-9]+$/, "") : "-"; }
function alone(b){ return !bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) <= 350; }); }
var ofk = feedKill; feedKill = function(att, vic){
  if(roundState === "live" && !(bomb && bomb.state === "planted")){
    if(vic.team === "T"){ var tt = teamTac.T, row = {t: tick, sec: Math.round((tick-roundStartTick)/64), id: vic.id, role: vic.tRole, tag: tagOf(vic), alone: alone(vic) ? 1 : 0,
      phase: tt ? tt.phase : "?", tac: tt && tt.tac ? tt.tac.id : null, att: att ? att.id : null, traded: 0,
      carrier: vic === lastCar ? 1 : 0, mateD: Math.round(Math.min.apply(null, [99999].concat(bots.filter(function(o){ return o !== vic && o.alive && o.team === "T"; }).map(function(o){ return Math.hypot(o.x-vic.x, o.y-vic.y); })))),
      zone: zoneUserName(zoneIdAt(vic.x, vic.y)) || "?", wave2: tt && tt.wave2 ? 1 : 0, talive: bots.filter(function(o){ return o !== vic && o.alive && o.team === "T"; }).length, w1alive: bots.filter(function(o){ return o.alive && o.team === "T" && /^(entry|support|awp)$/.test(o.tRole); }).length}; R.deaths.push(row); pend.push(row); }
    if(vic.team === "CT") pend.forEach(function(p){ if(p.att === vic.id && tick - p.t <= 192) p.traded = 1; });
  }
  return ofk.apply(this, arguments); };
var oad = applyDamage; applyDamage = function(att, b, dmg, src){ var al = b.alive, x = b.x, y = b.y; var r = oad.apply(this, arguments);
  if(roundState === "live" && src === "bullet" && att && att.team !== b.team && al){
    var thru = !!att._smokeShot || (typeof smokeBlocks === "function" && smokeBlocks(att.x, att.y, x, y));
    if(!b.alive){ S.kills++; if(thru) S.killsSmoke++; }
    else if(thru) S.hits.push({t: tick, vic: b.id, att: att.id, x: Math.round(x), y: Math.round(y), shotBack: null, moved: null});
  }
  return r; };
for(var t = 0; t < TT; t++){
  var before = {}; bots.forEach(function(b){ before[b.id] = b.ammo; });
  lastCar = bomb ? bomb.carrier : null;
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ if(roundState === "live"){ R.rounds++; pend = []; } rs = roundState; }
  if(roundState === "live"){
  bots.forEach(function(b){ if(b.ammo < before[b.id] && !b._sawEnemy) {
    S.hits.forEach(function(h){ if(h.vic === b.id && h.shotBack === null && tick - h.t <= 2*TICK_HZ) h.shotBack = tick - h.t; }); } });
  S.hits.forEach(function(h){ if(h.moved === null && tick - h.t <= 2*TICK_HZ){ var v = bots.filter(function(o){ return o.id === h.vic; })[0];
    if(v && v.alive && Math.hypot(v.x-h.x, v.y-h.y) > 60) h.moved = tick - h.t; } });
  }
  if(roundState !== "live" || tick % 64 || (bomb && bomb.state === "planted")) continue;
  if(bomb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive){ R.carT[0]++; R.carT[1] += alone(bomb.carrier) ? 1 : 0; }
  bots.forEach(function(b){ if(!b.alive || b.team !== "T") return; var k = b.tRole + "|" + tagOf(b), o = R.time[k] || (R.time[k] = [0, 0]); o[0]++; o[1] += alone(b) ? 1 : 0; });
}
R.smoke = S;
JSON.stringify(R);
