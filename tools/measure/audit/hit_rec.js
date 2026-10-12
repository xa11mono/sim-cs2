// Этап 3, P0-1: позиции, HP и скорость раз в 16 тиков (как в демках: ticks.csv с health), выстрелы и смерти.
// Чтобы попадания/урон по окнам стрельбы считались у ботов так же, как у про (tools/measure/audit/hit_bake.py). Только запись.
freshMatch(__M__);
var M0 = matchNum, TT = __T__;
var R = {match: M0, pos: [], shots: [], kills: [], rounds: [], plants: []}, rs = null, cur = null;
var ots = tryShoot; tryShoot = function(sh, tg, dist){ var a0 = sh.ammo, l0 = sh.lastShotTick; var r = ots.apply(this, arguments);
  if(roundState === "live" && (sh.ammo < a0 || sh.lastShotTick !== l0)) R.shots.push([tick, sh.id, Math.round(sh.curSpeed||0), tg.id, Math.round(dist)]); return r; };
var ofk = feedKill; feedKill = function(att, vic){ if(roundState === "live") R.kills.push([tick, att ? att.id : null, vic.id, att ? att.team : null, vic.team]); return ofk.apply(this, arguments); };
for(var t = 0; t < TT; t++){
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ if(roundState === "live"){ cur = {t0: tick}; R.rounds.push(cur); } else if(cur && cur.t1 == null){ cur.t1 = tick; } rs = roundState; }
  if(roundState !== "live") continue;
  if(bomb && bomb.state === "planted" && cur && cur.plant == null){ cur.plant = tick; }
  if(tick % 16 === 0) bots.forEach(function(b){ if(b.alive) R.pos.push([tick, b.id, b.team === "CT" ? 1 : 0, Math.round(b.x), Math.round(b.y), Math.max(0, Math.round(b.hp)), Math.round(b.curSpeed||0)]); });
}
if(cur && cur.t1 == null) cur.t1 = tick;
JSON.stringify(R);
