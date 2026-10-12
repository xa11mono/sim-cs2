// Этап 4, P0: перестрелки по тикам — в том же виде, что новая выгрузка демок (weapon_fire_full / player_hurt / ticks_fight).
// shots: [тик, id, x, y, скорость px/с, доля от макс. скорости оружия, hp, оружие, цель, дистанция]
// hurt:  [тик, жертва, стрелок, урон, hp после, источник]
// snap:  раз в 2 тика, только пока у кого-то идёт бой (стрелял / ранен / видит врага ≤ 3 с назад; +1 с после):
//        [тик, id, x, y, скорость, доля от макс., hp, видит врага 0/1, на линии fightCycle (ph) или "-"]
// deaths: [тик, жертва, убийца]. Только запись: игру не меняет.
freshMatch(__M__);
var M0 = matchNum, TT = __T__;
var R = {match: M0, shots: [], hurt: [], snap: [], deaths: [], rounds: []}, rs = null, cur = null, hot = -9999;
function vfrac(b){ var m = SPEED*weaponSpeedMul(b); return m > 0 ? +((b.curSpeed||0)/m).toFixed(3) : 0; }
var ots = tryShoot; tryShoot = function(sh, tg, dist){ var a0 = sh.ammo, l0 = sh.lastShotTick; var r = ots.apply(this, arguments);
  if(roundState === "live" && (sh.ammo < a0 || sh.lastShotTick !== l0)){ hot = tick;
    R.shots.push([tick, sh.id, Math.round(sh.x), Math.round(sh.y), Math.round(sh.curSpeed||0), vfrac(sh), Math.round(sh.hp), sh.weapon ? sh.weapon.key : "?", tg.id, Math.round(dist)]); }
  return r; };
var oad = applyDamage; applyDamage = function(att, b, dmg, src){ var h0 = b.hp; var r = oad.apply(this, arguments);
  if(roundState === "live" && b.hp < h0){ hot = tick; R.hurt.push([tick, b.id, att ? att.id : null, Math.round(h0 - Math.max(0, b.hp)), Math.max(0, Math.round(b.hp)), String(src)]); }
  return r; };
var ofk = feedKill; feedKill = function(att, vic){ if(roundState === "live") R.deaths.push([tick, vic.id, att ? att.id : null]); return ofk.apply(this, arguments); };
for(var t = 0; t < TT; t++){
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ if(roundState === "live"){ cur = {t0: tick}; R.rounds.push(cur); } else if(cur && cur.t1 == null) cur.t1 = tick; rs = roundState; }
  if(roundState !== "live") continue;
  if(bomb && bomb.state === "planted" && cur && cur.plant == null) cur.plant = tick;
  if(tick % 2) continue;
  var seeing = bots.some(function(b){ return b.alive && b._sawEnemy; });
  if(seeing) hot = Math.max(hot, tick);
  if(tick - hot > 64) continue;
  bots.forEach(function(b){ if(!b.alive) return;
    R.snap.push([tick, b.id, Math.round(b.x), Math.round(b.y), Math.round(b.curSpeed||0), vfrac(b), Math.round(b.hp), b._sawEnemy ? 1 : 0, b._fc ? b._fc.ph + (b._fc.moving ? "*" : "") : "-"]); });
}
if(cur && cur.t1 == null) cur.t1 = tick;
JSON.stringify(R);
