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
  var fcs = !F ? "fc нет" : (F.until ? "fc line: ждёт окно" : "fc line: не стрелял с начала (" + (tick - F.t > 64 ? ">1с" : "<1с") + ")");
  var shot = tick - (b.lastShotTick||-1e9) < 32 ? "стрелял ≤0,5с" : "не стрелял 0,5с";
  if(b._sawEnemy && b.state === "engage") return "engage | " + fcs + " | " + shot;
  if(b.holding) return b._sawEnemy ? "hold видит | " + fcs + " | " + shot : "hold: держит угол после контакта";
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
var AFT = [], E = {};   // открытая встреча пары «b видит e»
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
  // после последнего выстрела (0,5 с без выстрелов): почему остаётся / уходит; сдвиг за следующую 1 с
  bots.forEach(function(b){
    if(!b.alive) return; var ls = b.lastShotTick; if(ls == null || ls < 0) return;
    if(tick - ls === 32){ var e = b._tgt || b._nearestEnemyBot, F = b._fc;
      AFT.push({t: tick, b: b.id, x: b.x, y: b.y, tgt: !e ? "нет цели" : !e.alive ? "цель убита" : (b._visible||[]).indexOf(e) >= 0 ? "цель видна" : "цель скрылась",
        fc: F ? F.ph + (F.until ? "/окно" : "") : "нет fc", st: b.state, hp: b.hp, tag: b.post ? String(b.post.tag).split(":")[0] : "-",
        why: (e && e.alive && (b._visible||[]).indexOf(e) >= 0) ? [b._reloading ? "перезарядка" : "", b.ammo <= 0 ? "пусто" : "", (b._nearestEnemyBot !== e) ? "цель не ближайшая" : "",
          bulletVictim(b, e.x, e.y, e) ? "свой на линии" : "", Math.hypot(e.x-b.x, e.y-b.y) > b.weapon.range ? "далеко" : "",
          (function(){ var dd = Math.hypot(e.x-b.x, e.y-b.y), bA = Math.atan(BODY_HALF/Math.max(8, dd)), aD = Math.abs(((Math.atan2(e.y-b.y, e.x-b.x) - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
            return aD > Math.min(AIM_FIRE_CONE, Math.max(0.05, 2.5*bA)) ? "прицел не на цели" : ""; })(),
          tick < b.nextShotTick ? "темп/пауза очереди" : "", (b.curSpeed > SPEED*0.4 && b.weapon.move >= 60) ? "бежит (контрстрейф)" : "", (b._fc && b._fc.moving) ? "fc идёт" : "",
          (b._ts && (b._ts[e.id]||0) < Math.round(b.reactionTicks*(b._reactMul||1))) || (b.contactStreak < Math.round(b.reactionTicks*(b._reactMul||1))) ? "реакция" : "",
          b.planting || b.defusing ? "плант/дефуз" : "", tick < (b.blindUntil||0) ? "ослеплён" : "", tick < (b.throwUntil||0) ? "бросок" : "", b._knife ? "нож" : ""].filter(Boolean).join("+") || "?" : null}); }
  });
  AFT.forEach(function(x){ if(x.d != null || tick - x.t < 64) return; var bb = bots.filter(function(o){ return o.id === x.b; })[0];
    x.d = bb && bb.alive ? Math.round(Math.hypot(bb.x-x.x, bb.y-x.y)) : -1; A.ex.push([x.tgt, x.fc, x.st, x.tag, x.d, x.hp, x.why]); });
  AFT = AFT.filter(function(x){ return x.d == null; });
  // исход встреч: кто погиб в течение встречи
  A.enc.forEach(function(R){ if(R.res) return; if(tick - R.last > 32){ R.res = "разошлись"; return; }
    var bb = bots.filter(function(o){ return o.id === R.b; })[0], ee = bots.filter(function(o){ return o.id === R.e; })[0];
    if(bb && !bb.alive) R.res = "погиб"; else if(ee && !ee.alive) R.res = "убил"; });
}
A.enc.forEach(function(R){ if(!R.res) R.res = "разошлись"; });
A.enc = A.enc.map(function(R){ return [R.b, R.e, R.t0, R.n, R.still, R.d, R.res]; });
JSON.stringify(A);
