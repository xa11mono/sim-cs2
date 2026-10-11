// Этап 2, P0-1: почему бот стоит в перестрелке. Один воспроизводимый матч, только запись (игру не меняет).
// node src/q.js <сборка.html> "<этот файл с __M__/__T__>"
freshMatch(__M__);
var M0 = matchNum, TT = __T__;
function live(){ return roundState === "live"; }
var A = {match: M0, ticks: 0, st: {}, enc: [], fcStart: 0, fcNoCover: 0, fcOff: 0, fcRepeek: 0, fcEnd: 0, ex: []};
// причина «стоит» в контакте (видит врага сейчас или видел ≤ 0,5 с) — первая подходящая
function why(b){
  if(b.planting || b.defusing) return "плант/дефуз";
  if(tick < (b.blindUntil||0)) return "ослеплён";
  if(tick < (b.throwUntil||0)) return "бросок";
  if(b._reloading) return "перезарядка";
  var F = b._fc;
  if(F && F.ph !== "line") return F.moving ? "fc: идёт" : "fc: не идёт (" + F.ph + ")";
  if(b._sawEnemy && b.state === "engage") return "engage: стоп и стрельба";
  if(b.holding) return b._sawEnemy ? "hold: видит" : "hold: держит угол после контакта";
  if(b.atPost) return "на посту";
  if(!b.path || !b.path.length || b.pathIdx >= b.path.length) return "нет пути";
  return "прочее";
}
var o_fct = fightCycleTick;
fightCycleTick = function(b, dtSec, busy){
  var before = b._fc ? b._fc.ph : null, u0 = b._fc ? b._fc.until : null;
  var r = o_fct.apply(this, arguments);
  if(live()){
    var F = b._fc, after = F ? F.ph : null;
    if(!before && after) A.fcStart++;
    if(before === "line" && after === "off") A.fcOff++;
    if(before === "line" && F && after === "line" && u0 && !F.until) A.fcNoCover++;
    if(before === "off" && after === "back") A.fcRepeek++;
    if(before && !after) A.fcEnd++;
  }
  return r;
};
var E = {};   // открытая встреча пары «b видит e»
var rs = null;
for(var t = 0; t < TT; t++){
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== rs){ rs = roundState; E = {}; }
  if(!live()) continue;
  bots.forEach(function(b){
    if(!b.alive) return;
    var inC = b._sawEnemy || (b._lastSawT != null && tick - b._lastSawT <= 32 && tick >= b._lastSawT);
    if(!inC) return;
    A.ticks++;
    var still = (b.curSpeed||0) < 15;
    var k = still ? why(b) : (b._fc && b._fc.ph !== "line" ? "движется: fc" : "движется: путь/прочее");
    A.st[k] = (A.st[k]||0) + 1;
    (b._visible||[]).forEach(function(e){
      var key = b.id + ">" + e.id, R = E[key];
      if(!R || tick - R.last > 32){ R = E[key] = {b: b.id, e: e.id, t0: tick, last: tick, still: 0, n: 0, shots: 0, s0: b.lastShotTick, d: Math.round(Math.hypot(e.x-b.x, e.y-b.y))}; A.enc.push(R); }
      R.last = tick; R.n++; if(still) R.still++;
    });
  });
  // исход встреч: кто погиб в течение встречи
  A.enc.forEach(function(R){ if(R.res) return; if(tick - R.last > 32){ R.res = "разошлись"; return; }
    var bb = bots.filter(function(o){ return o.id === R.b; })[0], ee = bots.filter(function(o){ return o.id === R.e; })[0];
    if(bb && !bb.alive) R.res = "погиб"; else if(ee && !ee.alive) R.res = "убил"; });
}
A.enc.forEach(function(R){ if(!R.res) R.res = "разошлись"; });
A.enc = A.enc.map(function(R){ return [R.b, R.e, R.t0, R.n, R.still, R.d, R.res]; });
JSON.stringify(A);
