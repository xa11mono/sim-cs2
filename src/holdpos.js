// =====================================================================
// (v145) ЗАДАЧА "ДЕРЖАТЬ РАЙОН" + ОДНА ОЦЕНКА ПОЗИЦИИ.
// Вместо того чтобы каждая ситуация (клатч, пост-плант, опорник...) выбирала
// точку по своим правилам, задача говорит только ЧТО держать (центр, радиус,
// что обязательно видеть), а точку выбирает одна функция по общим критериям:
//  + видеть главный вход, откуда вероятнее всего придут (по карте вероятностей);
//  − каждый ДОПОЛНИТЕЛЬНЫЙ открытый вход (с учётом его опасности) —
//    "встать под один вход, максимум два";
//  − засвеченная точка (отсюда только что стрелял, тут убили своего);
//  − стоять кучей с тиммейтом; + кроссфаер (тот же вход под другим углом);
//  − долго идти; − далеко от цели; + инерция (не бегать между равными точками).
// =====================================================================
var HOLD = {
  seeMain: 3.0,     // вес "вижу главный вход" (× его доля опасности)
  extraOpen: 1.6,   // штраф за каждый лишний открытый вход (× его доля)
  staticOpen: 0.25, // штраф за открытые направления со стороны врага (статично, по карте)
  burned: 1.5, burnR: 160, burnSec: 8,   // засвеченная точка
  stackR: 110, stack: 1.2,               // двое в одной точке — один пик забирает обоих
  cross: 0.8,       // кроссфаер: тот же главный вход под углом 50–120°
  travel: 0.6,      // штраф за путь, на 1000px
  objDist: 0.3,     // штраф за удалённость от цели (на весь радиус)
  pro: 1.2,         // бонус точке, где обычно стоят про (0..1 из демок)
  keep: 0.35,       // бонус текущей точке
  reeval: 128,      // тиков между пересчётами (2с), раньше — если сменился главный вход
  minW: 0.02        // вход с опасностью ниже — не учитываем
};
var HOLD_CANDS = {};
function holdCands(center, rMin, rMax){
  var k = Math.round(center.x/20)+","+Math.round(center.y/20)+"|"+rMin+"|"+rMax;
  if(HOLD_CANDS[k]) return HOLD_CANDS[k];
  var out = [];
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z), d = Math.hypot(c.x-center.x, c.y-center.y);
    if(d < rMin || d > rMax || insideSolidWall(c.x, c.y)) return;
    if(out.some(function(q){ return Math.hypot(q.x-c.x, q.y-c.y) < 24; })) return;   // прореживание
    out.push({x:c.x, y:c.y, d:d});
  });
  HOLD_CANDS[k] = out; return out;
}
// T: {key, center, rArea, rMin, rMax, must:[pt], mates:[{pt, see}]}
function holdSpot(b, T){
  var team = b.team, center = T.center;
  var E = threatEntrances(team, center, T.rArea || 280).filter(function(e){ return e.w > HOLD.minW; });
  var wmax = E.length ? E[0].w : 1;
  E.forEach(function(e){ e.wn = e.w / wmax; });
  var cands = holdCands(center, T.rMin || 0, T.rMax || 340);
  var mustPts = T.must || [];
  var eval1 = function(c, useMust){
    if(useMust && !mustPts.every(function(m){ return hasLOS(c.x, c.y, m.x, m.y); })) return null;
    var main = 0, mainE = null, open = 0;
    E.forEach(function(e){ if(!hasLOS(c.x, c.y, e.pt.x, e.pt.y)) return; var v = e.wn; open += v; if(v > main){ main = v; mainE = e; } });
    var s = HOLD.seeMain*main - HOLD.extraOpen*(open - main), why = [];
    var ex = spotExposure(team, c.x, c.y); if(ex > 1) s -= HOLD.staticOpen*(ex - 1);
    if(tick - (b.lastShotTick||-1e9) < HOLD.burnSec*TICK_HZ && Math.hypot(c.x-b.x, c.y-b.y) < HOLD.burnR){ s -= HOLD.burned; why.push("засвечен"); }
    if(intelDeathsNear(team, c.x, c.y, HOLD.burnR, 10*TICK_HZ) > 0){ s -= HOLD.burned; why.push("тут убили своего"); }
    (T.mates||[]).forEach(function(m){
      var dm = Math.hypot(m.pt.x-c.x, m.pt.y-c.y);
      if(dm < HOLD.stackR) s -= HOLD.stack;
      else if(mainE && m.see && Math.hypot(m.see.pt.x-mainE.pt.x, m.see.pt.y-mainE.pt.y) < 60 && dm > 90){
        var a1 = Math.atan2(c.y-mainE.pt.y, c.x-mainE.pt.x), a2 = Math.atan2(m.pt.y-mainE.pt.y, m.pt.x-mainE.pt.x);
        var da = _angOff(a1, a2); if(da > 0.87 && da < 2.1) s += HOLD.cross; else if(da > 0.5) s += HOLD.cross*0.4;
      }
    });
    if(BAL.proPrior) s += HOLD.pro * proAt(team, c.x, c.y);
    s -= HOLD.travel * Math.hypot(c.x-b.x, c.y-b.y)*1.2/1000;
    s -= HOLD.objDist * c.d / (T.rMax || 340);
    if(b._hTask && b._hTask.key === T.key && Math.hypot(c.x-b._hTask.pt.x, c.y-b._hTask.pt.y) < 40) s += HOLD.keep;
    return {pt:{x:c.x, y:c.y}, s:s, main:mainE, open:open, why:why};
  };
  var best = null;
  [true, false].some(function(useMust){
    cands.forEach(function(c){ var r = eval1(c, useMust); if(r && (!best || r.s > best.s)) best = r; });
    return !!best;
  });
  if(!best) return null;
  best.look = best.main ? best.main.pt : (E[0] ? E[0].pt : center);
  best.E = E;
  return best;
}
// раздать задачу "держать район" группе: по очереди, каждый учитывает уже выбранные точки тиммейтов
function holdGroup(members, T, tag){
  var chosen = [];
  members.slice().sort(function(a, c){ return Math.hypot(a.x-T.center.x, a.y-T.center.y) - Math.hypot(c.x-T.center.x, c.y-T.center.y); })
  .forEach(function(b){
    var H = b._hTask, same = H && H.key === T.key && H.round === roundNum;
    // издалека точку не перевыбираем (иначе, пока идёт, "сколько идти" меняется
    // и он бегает между почти равными точками) — только если сменился главный вход
    var far = same && Math.hypot(b.x-T.center.x, b.y-T.center.y) > (T.rMax || 340) + 250;
    if(far && tick - H.t >= HOLD.reeval){ var E0 = threatEntrances(b.team, T.center, T.rArea || 280)[0];
      if(E0 && H.see && Math.hypot(E0.pt.x-H.see.pt.x, E0.pt.y-H.see.pt.y) < 60) H.t = tick; }
    var fresh = same && tick - H.t < HOLD.reeval;
    if(!fresh){
      // mustFirst: бомбу (цель) обязательно видит только первый; остальные держат
      // подходы и слушают — как про после планта (не все с линией на бомбу)
      var mustNow = (T.mustFirst && chosen.length > 0) ? [] : T.must;
      var r = holdSpot(b, {key:T.key, center:T.center, rArea:T.rArea, rMin:T.rMin, rMax:(T.mustFirst && chosen.length > 0 && T.rMax2) || T.rMax, must:mustNow, mates:chosen});
      if(r){
        var moved = !H || H.key !== T.key || Math.hypot(r.pt.x-H.pt.x, r.pt.y-H.pt.y) > 40;
        b._hTask = {key:T.key, round:roundNum, t:tick, pt:r.pt, look:r.look, see:r.main, s:r.s};
        if(moved && T.voice) T.voice(b, r);
      }
    }
    if(b._hTask && b._hTask.key === T.key){ chosen.push({pt:b._hTask.pt, see:b._hTask.see}); setPost(b, b._hTask.pt, b._hTask.look, true, tag); }
  });
}
