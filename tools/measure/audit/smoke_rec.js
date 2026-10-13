// (v271) Стрельба через смок: урон/убийства сквозь дым (стрелок в smokeShots) и ответ того, по кому стреляли:
// стреляет в ответ сквозь дым / уходит с линии (сдвиг > 60 px) за 2 с. Только запись.
freshMatch(__M__);
var M0 = matchNum, TT = __T__;
var R = {match: M0, kills: 0, killsSmoke: 0, hits: [], shotsSmoke: [], rounds: 0}, rs = null;
var oad = applyDamage; applyDamage = function(att, b, dmg, src){ var al = b.alive, x = b.x, y = b.y; var r = oad.apply(this, arguments);
  if(roundState === "live" && src === "bullet" && att && att.team !== b.team && al){
    var thru = !!att._smokeShot || (typeof smokeBlocks === "function" && smokeBlocks(att.x, att.y, x, y));
    if(!b.alive){ R.kills++; if(thru) R.killsSmoke++; }
    else if(thru) R.hits.push({t: tick, vic: b.id, att: att.id, x: Math.round(x), y: Math.round(y), shotBack: null, moved: null});
  }
  return r; };
var oss = smokeShots;
for(var t = 0; t < TT; t++){
  var before = {}; bots.forEach(function(b){ before[b.id] = b.ammo; });
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ if(roundState === "live") R.rounds++; rs = roundState; }
  if(roundState !== "live") continue;
  bots.forEach(function(b){ if(b._smokeBurst > 0 || (b.ammo < before[b.id] && !b._sawEnemy)) {
    R.hits.forEach(function(h){ if(h.vic === b.id && h.shotBack === null && tick - h.t <= 2*TICK_HZ) h.shotBack = tick - h.t; }); } });
  R.hits.forEach(function(h){ if(h.moved === null && tick - h.t <= 2*TICK_HZ){ var v = bots.filter(function(o){ return o.id === h.vic; })[0];
    if(v && v.alive && Math.hypot(v.x-h.x, v.y-h.y) > 60) h.moved = tick - h.t; } });
}
JSON.stringify(R);
