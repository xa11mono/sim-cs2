// (v269, пункт 2) Смерти T до планта: роль, задача (тег поста), один ли (нет своего ≤350 px), разменяли ли за 3 с.
// И раз в секунду — доля времени «один» по задачам (T, до планта). Только запись.
freshMatch(__M__);
var M0 = matchNum, TT = __T__;
var R = {match: M0, deaths: [], time: {}, rounds: 0}, rs = null, pend = [];
function tagOf(b){ return b.post ? String(b.post.tag).split(":")[0].replace(/[AB]$/, "").replace(/[0-9]+$/, "") : "-"; }
function alone(b){ return !bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) <= 350; }); }
var ofk = feedKill; feedKill = function(att, vic){
  if(roundState === "live" && !(bomb && bomb.state === "planted")){
    if(vic.team === "T"){ var tt = teamTac.T, row = {t: tick, sec: Math.round((tick-roundStartTick)/64), id: vic.id, role: vic.tRole, tag: tagOf(vic), alone: alone(vic) ? 1 : 0,
      phase: tt ? tt.phase : "?", tac: tt && tt.tac ? tt.tac.id : null, att: att ? att.id : null, traded: 0,
      carrier: bomb && bomb.carrier === vic ? 1 : 0, mateD: Math.round(Math.min.apply(null, [99999].concat(bots.filter(function(o){ return o !== vic && o.alive && o.team === "T"; }).map(function(o){ return Math.hypot(o.x-vic.x, o.y-vic.y); })))),
      zone: zoneUserName(zoneIdAt(vic.x, vic.y)) || "?", wave2: tt && tt.wave2 ? 1 : 0, w1alive: bots.filter(function(o){ return o.alive && o.team === "T" && /^(entry|support|awp)$/.test(o.tRole); }).length}; R.deaths.push(row); pend.push(row); }
    if(vic.team === "CT") pend.forEach(function(p){ if(p.att === vic.id && tick - p.t <= 192) p.traded = 1; });
  }
  return ofk.apply(this, arguments); };
for(var t = 0; t < TT; t++){
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ if(roundState === "live"){ R.rounds++; pend = []; } rs = roundState; }
  if(roundState !== "live" || tick % 64 || (bomb && bomb.state === "planted")) continue;
  bots.forEach(function(b){ if(!b.alive || b.team !== "T") return; var k = b.tRole + "|" + tagOf(b), o = R.time[k] || (R.time[k] = [0, 0]); o[0]++; o[1] += alone(b) ? 1 : 0; });
}
JSON.stringify(R);
