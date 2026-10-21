// ---- перестрелка по данным (v250, вместо пиков «широкий/плечо/джиггл» и стрейфа v166) ----
// Как у про в 92 демках Ancient (tools/peek_bake.py → src/data/trades.json, поле peek): игрок стоит на линии,
// пока стреляет (длительность перестрелки), потом уходит с линии за укрытие (сдвиг), пережидает (пауза) и
// с долей repeek выглядывает снова на то же место; иначе перестрелка для него закончена — дальше обычная логика.
// Квантили 10/25/50/75/90 %; длительность — от первого до последнего «окна стрельбы» (окно = 0,5 с).
var PEEK_PRO = {CT:{dur:[0.0, 0.0, 0.55, 1.72, 3.14], pause:[1.08, 1.25, 1.62, 2.17, 2.61], shift:[13.93, 23.6, 40.79, 66.58, 96.11], repeek:0.26},
                T:{dur:[0.0, 0.0, 0.41, 1.3, 2.84], pause:[1.09, 1.27, 1.67, 2.23, 2.7], shift:[14.29, 25.12, 47.4, 80.62, 119.72], repeek:0.24}};
var PEEK_Q = [0.1, 0.25, 0.5, 0.75, 0.9];
function peekQ(q, u){   // значение распределения по квантилям (между ними — линейно, хвосты — крайние)
  if(u <= PEEK_Q[0]) return q[0];
  for(var i=1;i<PEEK_Q.length;i++) if(u <= PEEK_Q[i]) return q[i-1] + (q[i]-q[i-1])*(u-PEEK_Q[i-1])/(PEEK_Q[i]-PEEK_Q[i-1]);
  return q[q.length-1];
}
// ближайшее место не дальше R, откуда врага e не видно и куда можно дойти по прямой; из равных — дальше от врага
// (М149) «не видно» — враг не видит там ни одной части тела, плечо тоже (visParts), а не только «глаза в глаза» (hasLOS):
// иначе за укрытием торчит плечо, и перестрелка не кончается
function fightCover(b, e, R){
  for(var k=1;k<=3;k++){
    var r = R*k/3, best = null, bd = -1;
    for(var i=0;i<16;i++){
      var a = i*Math.PI/8, x = b.baseX + Math.cos(a)*r, y = b.baseY + Math.sin(a)*r;
      if(insideSolidWall(x, y) || stepBlocked(b.baseX, b.baseY, x, y, b) || fightSeen(e, x, y, b.z)) continue;
      var de = Math.hypot(x-e.x, y-e.y); if(de > bd){ bd = de; best = {x:x, y:y}; }
    }
    if(best) return best;
  }
  return null;
}
function fightSeen(e, x, y, z){ var p = visParts(e.x, e.y, e.crouching, x, y, false, true, e.z, z); return p.head || p.body; }
// (М149) место получше: рядом с укрытием (cx, cy), откуда врага видно целиком — глаза в глаза, а не одно плечо; ближе к укрытию
function fightBetter(b, e, cx, cy, R){
  var best = null, bd = Infinity;
  for(var k=1;k<=3;k++) for(var i=0;i<16;i++){
    var a = i*Math.PI/8, r = R*k/3, x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r;
    if(insideSolidWall(x, y) || stepBlocked(cx, cy, x, y, b) || !hasLOS(x, y, e.x, e.y, b.z, e.z)) continue;
    var d = Math.hypot(x-cx, y-cy); if(d < bd){ bd = d; best = {x:x, y:y}; }
  }
  return best;
}
// (Б4) движение на линии (одно место): стрейф поперёк линии огня, перед выстрелом — контрстрейф (встречная клавиша + трение).
// Числа игры CS2: sv_accelerate 5.5, sv_friction 5.2, sv_stopspeed 80 ед./с. Стоял (держал угол) — до первого выстрела стоит;
// вошёл в перестрелку на ходу — гасит ту скорость; между очередями — шаг вбок и обратно (люди всегда в движении)
var CS_ACCEL = 5.5, CS_FRIC = 5.2, CS_STOP = 80;
// шаг стрейфа, ед. игры: сдвиг вбок от взгляда между очередями у про (пауза 0,5–1,5 с; 79 + 85 демок, квантили 10/25/50/75/90 %) —
// tools/measure/engine/b4_strafe.py
var STRAFE_PRO = [3.0, 10.6, 34.9, 73.7, 118.6];
function csDecel(v, vmax){ return CS_FRIC*Math.max(v, CS_STOP/PX_UNITS) + CS_ACCEL*vmax; }   // px/с²
function csTicksTo(v, vT, vmax){ var n = 0; while(v > vT + 0.5 && n < 30){ v -= csDecel(v, vmax)/TICK_HZ; n++; } return n; }
function fightStrafe(b, F, dtSec){
  var e = F.e, fr = b._fire, fresh = fr && tick - fr.t <= 1;
  F.own = !!(e && e.alive && (b._sawEnemy || (fr && tick - fr.t < 16)));
  if(!F.own){ F.sv = undefined; return; }
  var dx = e.x - b.baseX, dy = e.y - b.baseY, L = Math.hypot(dx, dy) || 1, ax = -dy/L, ay = dx/L, vmax = SPEED*weaponSpeedMul(b);
  if(F.sv === undefined){   // скорость, с которой вошёл в перестрелку, — дальше она (её гасит или продолжает стрейфом)
    var TR = b._trail || [], tp = TR.length >= 2 ? TR[TR.length-2] : {x:b.baseX, y:b.baseY};   // куда шёл последние ~0,25–0,5 с
    var pr = (b.baseX - tp.x)*ax + (b.baseY - tp.y)*ay;
    F.sdir = pr >= 0 ? 1 : -1; F.sv = F.sdir*Math.min(vmax, b.curSpeed || 0); F.leg = 0;
  }
  if(b.lastShotTick >= F.t) F.started = true;
  // контрстрейф начинается так, чтобы к моменту, когда можно стрелять, скорость упала до той, на которой выстрел «стоит того»
  // (fireVAcc — то же правило, что в tryShoot): вблизи — почти с ходу, вдали — до остановки
  var v = Math.abs(F.sv), vT = fresh ? fireVAcc(b, e, L) : 0, stop = fresh && fr.inT <= csTicksTo(v, vT, vmax) + 1 && !b._reloading;
  if(stop || (!F.started && v < 1)){ v = Math.max(0, v - csDecel(v, vmax)*dtSec); F.sv = (F.sv < 0 ? -1 : 1)*v; }
  else {
    var so = (b.baseX - F.ax)*ax + (b.baseY - F.ay)*ay;
    if(!F.leg) F.leg = Math.max(1, peekQ(STRAFE_PRO, fightRand(b, 7))/PX_UNITS);
    if(F.sdir*so >= F.leg){ F.sdir = -F.sdir; F.leg = Math.max(1, peekQ(STRAFE_PRO, fightRand(b, 8))/PX_UNITS); }
    if(F.sv*F.sdir < 0){ var d = csDecel(v, vmax)*dtSec; F.sv = v <= d ? 0 : F.sv - (F.sv < 0 ? -1 : 1)*d; }
    else F.sv = F.sdir*Math.min(vmax, v + Math.max(0, CS_ACCEL*vmax - CS_FRIC*v)*dtSec);
  }
  var st = F.sv*dtSec, nx = b.baseX + ax*st, ny = b.baseY + ay*st;
  if(Math.abs(st) > 1e-6){
    if(stepBlocked(b.baseX, b.baseY, nx, ny, b)){ F.sv = 0; F.sdir = -F.sdir; F.leg = 0; }
    else { b.baseX = nx; b.baseY = ny; }
  }
  b.curSpeed = Math.abs(F.sv); b.walking = false;
}
function fightRand(b, salt){ return hashRand(tick*31 + b.id.charCodeAt(0)*17 + b.id.charCodeAt(b.id.length-1)*7 + salt); }
// каждый тик движения: фазы line (на линии) → off (за укрытием) → back (выглядывает снова) → line …
function fightCycleTick(b, dtSec, busy){
  var F = b._fc, D = PEEK_PRO[b.team];
  if(busy || !b.alive){ b._fc = null; return; }
  // (М149, владелец 20.10) по боту стреляют в плечо, торчащее из-за укрытия, а он стрелка целиком не видит: через время реакции
  // (профиль игрока) — сразу за укрытие, где не видно ничего; выглянет снова (как у про — repeek) — с места, откуда видно врага целиком
  var SS = b._shoulderShot, ssNew = SS && SS.by.alive && tick - SS.t < TICK_HZ && tick - SS.t >= (b.reactionTicks || 0) && (!F || F.ss !== SS.t);
  if(ssNew){ var mp = visParts(b.x, b.y, b.crouching, SS.by.x, SS.by.y, SS.by.crouching, true, b.z, SS.by.z); if((mp.head || mp.body) && !mp.side) ssNew = false; }
  if(!F){
    if((!b._sawEnemy && !ssNew) || (b.state !== "engage" && b.state !== "hold")) return;
    F = b._fc = {ph:"line", ax:b.baseX, ay:b.baseY, t:tick, until:0, seen:tick};
  }
  if(b._sawEnemy){ F.seen = tick; F.e = b._nearestEnemyBot; }
  F.moving = false;
  if(ssNew && F.ph !== "off"){
    F.ss = SS.t; F.e = SS.by;
    var cs = fightCover(b, SS.by, peekQ(D.shift, fightRand(b, 5))) || fightCover(b, SS.by, D.shift[4]);
    if(cs){
      F.ph = "off"; F.retreat = true; F.own = false; F.cx = cs.x; F.cy = cs.y; F.ax = b.baseX; F.ay = b.baseY; F.seen = tick;
      F.until = tick + Math.round(peekQ(D.pause, fightRand(b, 6))*TICK_HZ);
      F.better = fightBetter(b, SS.by, cs.x, cs.y, D.shift[4]);
      if(!b._fcS || tick - b._fcS > 4*TICK_HZ){ b._fcS = tick; logEvent(b.id+": стреляют в плечо из-за укрытия — ухожу за укрытие"); }
    }
  }
  if(F.ph === "line"){
    fightStrafe(b, F, dtSec);
    if(!b._sawEnemy && tick - F.seen > D.pause[4]*TICK_HZ){ b._fc = null; return; }   // враг пропал — перестрелка кончилась
    if(!F.until && b.lastShotTick >= F.t) F.until = b.lastShotTick + Math.round((peekQ(D.dur, fightRand(b, 1)) + 0.5)*TICK_HZ);
    if(F.until && tick >= F.until){
      var e = F.e;
      if(!e || !e.alive){ b._fc = null; return; }
      var c = fightCover(b, e, peekQ(D.shift, fightRand(b, 2)));
      if(!c) c = fightCover(b, e, D.shift[4]);
      if(!c){ F.until = 0; F.t = tick; return; }   // укрыться негде — остаётся на линии
      F.ph = "off"; F.cx = c.x; F.cy = c.y; F.ax = b.baseX; F.ay = b.baseY; F.own = false;
      F.until = tick + Math.round(peekQ(D.pause, fightRand(b, 3))*TICK_HZ);
      if(!b._fcV || tick - b._fcV > 4*TICK_HZ){ b._fcV = tick; logEvent(b.id+": постреляли — ушёл с линии за укрытие"); }
    }
    return;
  }
  if(b._sawEnemy && !(F.retreat && F.ph === "off")){ F.ph = "line"; F.ax = b.baseX; F.ay = b.baseY; F.t = tick; F.until = 0; F.retreat = false; F.better = null; F.sv = undefined; return; }   // снова вижу врага — на линии (уходя от выстрелов в плечо — не останавливается)
  if(F.ph === "off" && tick >= F.until && (!F.retreat || Math.hypot(F.cx-b.baseX, F.cy-b.baseY) < 2)){
    F.retreat = false;
    if(fightRand(b, 4) >= D.repeek){ b._fc = null; return; }   // не выглядывает снова — перестрелка закончена
    F.ph = "back";
    if(F.better){ F.ax = F.better.x; F.ay = F.better.y; F.better = null; }   // (М149) выглядывает с места, откуда видно врага целиком
  }
  var tx = F.ph === "off" ? F.cx : F.ax, ty = F.ph === "off" ? F.cy : F.ay;
  var d = Math.hypot(tx-b.baseX, ty-b.baseY);
  if(d < 2){ if(F.ph === "back"){ F.ph = "line"; F.t = tick; F.until = 0; F.sv = undefined; } return; }
  var stp = Math.min(d, SPEED*weaponSpeedMul(b)*dtSec), nx = b.baseX + (tx-b.baseX)/d*stp, ny = b.baseY + (ty-b.baseY)/d*stp;
  if(stepBlocked(b.baseX, b.baseY, nx, ny, b)){ b._fc = null; return; }
  b.baseX = nx; b.baseY = ny; F.moving = true; b.crouching = false; b.walking = false;
}
// ---- (3) безопасная ротация: путь мимо известных T ----
// опасность пути: рядом (≤380px) со свежей (≤10с) позицией живого T или через
// зону, где T по карте вероятностей почти наверняка есть
function pathDanger(team, pts){
  var BL = beliefLast[team] || {}, foes = [];
  for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick > 10*TICK_HZ) continue; var e = bots.filter(function(o){ return o.id === eid; })[0]; if(e && e.alive) foes.push(lo); }
  for(var i = 0; i < pts.length; i++){
    var q = pts[i];
    for(var f = 0; f < foes.length; f++) if(Math.hypot(q[0]-foes[f].x, q[1]-foes[f].y) < 380) return true;
    if(i % 2 === 0 && BZ.ids.length){ var zi = bzOf(q[0], q[1]); if(zi >= 0 && beliefZoneKnown(team, zi) >= 0.6) return true; }
  }
  return false;
}
function densify(pts, step){ var out = []; for(var i = 1; i < pts.length; i++){ var a = pts[i-1], b = pts[i], L = Math.hypot(b[0]-a[0], b[1]-a[1]), n = Math.max(1, Math.ceil(L/step)); for(var k = 0; k < n; k++) out.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]); } if(pts.length) out.push(pts[pts.length-1]); return out; }
function safeRotate(b, dest, site){
  if(!BAL.safeRot) return;
  var key = "saferot"+site+roundNum;
  if(b._safeRotK === key) return; b._safeRotK = key;
  if(Math.hypot(b.x-CT_SPAWN.x, b.y-CT_SPAWN.y) < 250) return;
  // у самого сайта T и так ждут (туда и идём) — опасность считаем только на
  // дороге ДО последних ~5м, где выбор маршрута ещё есть
  var far = function(pts){ return densify(pts, 60).filter(function(q){ return Math.hypot(q[0]-dest.x, q[1]-dest.y) > 500; }); };
  var direct = pathPts(b.x, b.y, dest.x, dest.y);
  if(!pathDanger("CT", far(direct))) return;
  var v1 = pathPts(b.x, b.y, CT_SPAWN.x, CT_SPAWN.y), v2 = pathPts(CT_SPAWN.x, CT_SPAWN.y, dest.x, dest.y);
  var Ld = polyLen(direct), Lv = polyLen(v1) + polyLen(v2);
  if(Lv > Ld*1.7 + 150) { logEvent(b.id+": путь на "+site+" опасный, но крюк слишком длинный — иду напрямую, тихо"); return; }
  if(pathDanger("CT", far(v1.concat(v2.slice(1))))) { logEvent(b.id+": к "+site+" оба пути опасные — иду напрямую, тихо"); return; }
  var csz = ZONEMAP.zones.filter(function(z){ return z.name === "CTspawn"; })[0];   // зона с ролью «спавн CT»
  startRoute(b, csz ? [zoneUserName(csz.id)] : [], key);
  voiceLog("CT", "saferot"+b.id, b.id, "на "+site+" иду через спавн — там, где короче, их видели");
}
// ---- (4) ниндзя-дефуз ----
// все живые T засвечены недавно (≤8с) и все далеко от бомбы (>700px) — не
// ждём сбора и не кидаем гранат: дефузер идёт сразу, последние метры шифтом
function ninjaOk(){
  var ts = bots.filter(function(o){ return o.team === "T" && o.alive; }); if(!ts.length) return false;
  var BL = beliefLast.CT || {};
  return ts.every(function(t){ var lo = BL[t.id]; return lo && tick - lo.tick < 8*TICK_HZ && Math.hypot(lo.x-bomb.x, lo.y-bomb.y) > 700; });
}
// ---- (7) перезарядка за укрытием ----
function exposedTo(b, maxD, maxAge, anyLos){
  // только реальная угроза выглянуть сейчас: свежая (≤4с) инфа и близко (≤600) —
  // иначе бот уходил с угла на каждую перезарядку и сайт оставался пустым
  maxD = maxD || 600; maxAge = maxAge || 4*TICK_HZ;
  var BL = beliefLast[b.team] || {}, out = [];
  for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick > maxAge) continue; var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive) continue;
    if(Math.hypot(lo.x-b.x, lo.y-b.y) < maxD && (anyLos || hasLOS(b.x, b.y, lo.x, lo.y, b.z))) out.push({x:lo.x, y:lo.y}); }
  return out;
}
function coverForReload(b, from){
  if(b._rlCoverT && tick - b._rlCoverT < 3*TICK_HZ) return true;
  b._rlCoverT = tick;
  var sp = pickSpots("rlcov"+tick+b.id, {x:b.x, y:b.y}, 2, {rMin:30, rMax:150, minGap:30, hideFrom:from})
    .filter(function(q){ return from.every(function(f){ return !hasLOS(q.x, q.y, f.x, f.y); }); })[0];
  if(!sp) return false;
  b._reposUntil = 0;
  setPost(b, sp, from[0], true, "repos:rlcover");
  if(!b.post || b.post.tag !== "repos:rlcover") return false;
  b._reposUntil = tick + 3*TICK_HZ;
  logEvent(b.id+": уходит за укрытие перезарядиться");
  return true;
}
// ---- (8) мало HP — к своим ----
// (v292, И33, владелец 14.10) «мало HP» — один порог на всё: откат/держит проход (lowHpBack), не идёт на дабл-пик (assistPeek)
// и не заходит с фланга (flankAssist, «добить последних»). Число — владельца (раньше 30 в одном месте и 35 в двух других)
var LOW_HP = 25;
var LOWHP_MATE_PATH = 600;   // проектное число: px пути (~1500 юнитов, ~6 с бега) — дальше свой «далеко»
// (v284, владелец 14.10 — без демок, правила общие для любой карты, числа «проектные») одно место «отойти/переставиться»:
//  • мало HP (≤30): не бежать к своим через полкарты, а держать проход к своим/к цели, который никто не держит, — из укрытия,
//    не первым контактом (игрок 3 с 22 HP бежал через Xbox к donk, хотя мог встать в Red Room на проход Alley);
//  • остался один (своих ≤350 px нет), а рядом (≤900 px) за 8 с погиб свой и враг рядом известен — уходит к своим
//    (A main после смертей на миду так и стоял один)
function lowHpBack(b){
  if(!BAL.lowHpBack || b._sawEnemy || b.planting || b.defusing || tick < (b._lowHpNext||0)) return;
  var low = b.hp <= LOW_HP;
  var lostNear = !low && ((teamIntel[b.team] && teamIntel[b.team].sig) || []).some(function(sg){ return sg.type === "died" && sg.id !== b.id && tick - sg.tick < 8*TICK_HZ && Math.hypot(sg.x-b.x, sg.y-b.y) < 900; });
  if(!low && !lostNear) return;
  if(bomb && bomb.state === "planted") return; // ретейк/пост-плант — бомба важнее
  var defending = b.team === "CT" && b.post && /^(anchor|stack|set:|cts:|clutch|midcover)/.test(b.post.tag);
  if(bomb && bomb.state === "carried" && bomb.carrier === b) return;
  if(!taskCanSet(b, "repos:lowhp")) return;   // (v378) идёт по задаче не ниже — арбитр места
  b._lowHpNext = tick + TICK_HZ;
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team; });
  if(!mates.length) return; // один — отходить не к кому
  if(mates.some(function(o){ return Math.hypot(o.x-b.x, o.y-b.y) < 350; })) return; // рядом уже есть свой
  var threat = exposedTo(b).concat([]); var BL = beliefLast[b.team] || {};
  var near = false; for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick < 8*TICK_HZ && Math.hypot(lo.x-b.x, lo.y-b.y) < 700){ near = true; threat.push({x:lo.x, y:lo.y}); } }
  if(!near) return;
  // опорник на своём сайте с малым HP сайт не бросает — отходит, только если
  // совсем мало (≤20) и на него идут двое+
  if(defending){ var nNear = 0; for(var eid2 in BL){ var lo2 = BL[eid2]; if(tick - lo2.tick < 6*TICK_HZ && Math.hypot(lo2.x-b.x, lo2.y-b.y) < 700) nNear++; } if(b.hp > 20 || nNear < 2) return; }
  // мало HP — роль: держать проход к своим/к цели, который никто не держит (угроза по знанию — threatEntrances), не первым
  // контактом (точка прохода не ближе 250 px к известным врагам) и не дальше по пути, чем пошёл бы к своим
  if(low && !defending){
    var tt0 = teamTac[b.team], cen = null;
    if(b.team === "T" && tt0 && tt0.site && SITES[tt0.site]) cen = SITES[tt0.site];
    else { var cx = 0, cy = 0; mates.forEach(function(o){ cx += o.x; cy += o.y; }); cen = {x: cx/mates.length, y: cy/mates.length}; }
    var ents = threatEntrances(b.team, cen, 700).filter(function(E){
      if(threat.some(function(t){ return Math.hypot(E.pt.x-t.x, E.pt.y-t.y) < 250; })) return false;
      if(mates.some(function(o){ return o.lookTarget && Math.hypot(o.lookTarget.x-E.pt.x, o.lookTarget.y-E.pt.y) < 220; })) return false;
      var pe = pathPts(b.x, b.y, E.pt.x, E.pt.y); return pe.length && polyLen(pe) <= 1000; });   // 1000 px — проектное число (как у фланга)
    var E0 = ents[0];
    var spE = E0 ? pickSpots("lowhpE"+tick+b.id, E0.pt, 2, {rMin:120, rMax:280, minGap:40, must:[E0.pt], hideFrom:threat.slice(0, 3)})[0] : null;
    if(spE){
      b._reposUntil = 0; b._probeLock = 0;
      setPost(b, spE, E0.pt, true, "repos:lowhp");
      if(b.post && b.post.tag === "repos:lowhp"){
        if(b.state === "hold") leaveHold(b);
        b._reposUntil = tick + 10*TICK_HZ; b._lowHpNext = tick + 10*TICK_HZ;
        voiceLog(b.team, "lowhp"+b.id, b.id, "у меня "+b.hp+" — держу проход "+calloutName(E0.pt.x, E0.pt.y));
        return;
      }
    }
  }
  if(!low && defending) return;   // остался один на своём сайте — сайт не бросает (решение ретейка/ротации — выше)
  // (v271) к своим — только если свой недалеко по пути (LOWHP_MATE_PATH) и путь не идёт мимо известных
  // врагов; иначе бежать через полкарты к далёкому тиммейту — подставиться. Тогда — укрытие рядом,
  // скрытое от врагов: играть от него и ждать своих (раньше шёл к ближайшему тиммейту на любом расстоянии).
  var m = null, mL = Infinity;
  mates.sort(function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); }).slice(0, 2).forEach(function(o){
    var pts = pathPts(b.x, b.y, o.x, o.y); if(!pts.length) return;
    var L = polyLen(pts); if(L > LOWHP_MATE_PATH || L >= mL) return;
    var bad = pts.some(function(q, k){ return k > 0 && threat.some(function(t){ return Math.hypot(q[0]-t.x, q[1]-t.y) < 250; }); });
    if(!bad){ m = o; mL = L; }
  });
  var sp = m ? (pickSpots("lowhp"+tick+b.id, {x:m.x, y:m.y}, 2, {rMin:40, rMax:180, minGap:40, hideFrom:threat.slice(0, 3)})[0] || {x:m.x, y:m.y})
             : pickSpots("lowhpc"+tick+b.id, {x:b.x, y:b.y}, 1, {rMin:30, rMax:200, minGap:30, hideFrom:threat.slice(0, 3)})[0];
  if(!sp) return;
  b._reposUntil = 0; b._probeLock = 0;
  setPost(b, sp, threat[0], true, "repos:lowhp");
  if(!b.post || b.post.tag !== "repos:lowhp") return;
  if(b.state === "hold") leaveHold(b);
  b._reposUntil = tick + 6*TICK_HZ; b._lowHpNext = tick + 10*TICK_HZ;
  if(!low && !m) return;   // один, но к своим безопасно не дойти — остаётся играть, как играл
  voiceLog(b.team, "lowhp"+b.id, b.id, low ? (m ? "у меня "+b.hp+" — отхожу к "+m.id : "у меня "+b.hp+" — свои далеко, играю от укрытия") : "остался один — иду к "+m.id);
}
// ---- шифт по угрозе ----
// Раньше боты бегали всегда, кроме нескольких частных случаев (слышал/видел
// только что, заход на ретейк, проба, лёркер…). Как будто точно знали, что
// впереди никого. Про-игрок шифтует там, где враг уже МОЖЕТ стоять и слушать:
// смотрим на ~260px вперёд по пути — если в этих зонах (или соседних) по карте
// вероятностей кто-то вероятно есть и по таймингу он уже мог туда добежать,
// идём тихо. Бегом — где пусто/враг ещё не успел, и когда надо спешить:
// выход T, время раунда, размен, бомба, ротация на подтверждённый выход.
function dangerWalk(b){
  if(!b.post || b.state !== "patrol" || !BZ.ids.length) return false;
  var tag = b.post.tag || "";
  if(/^(tradeR|flee|fetch|stopplant|antidefuse|repos|plantspot|lineup|defuse|smokeWait|pickup|retake|save|trade)/.test(tag)) return false;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime), tt = teamTac.T, ct = teamTac.CT;
  if(b.team === "T"){
    if(secLeft < 30 && bomb.state !== "planted") return false;
    if(tt && tt.phase === "execute" && b.tRole !== "lurker" && tick - (tt.execStart != null ? tt.execStart : tick) < 15*TICK_HZ) return false; // выход — быстро
    if(tt && tt.phase === "setup" && b.post){ // шифтом не успеть к выходу — бегом
      var dP = Math.hypot(b.post.x-b.baseX, b.post.y-b.baseY)*1.3;
      if((tt.execTick - tick)/TICK_HZ < dP/(SPEED*WALK_SPEED_FRAC) + 2) return false;
    }
  } else {
    if(bomb.state === "planted") return false; // ретейк — своя логика подхода
    if(/^rotate/.test(tag) && ct && ct.call && (ct.call.bombSeen || ct.call.count >= 2)) return false; // подтверждённый выход — бегом
  }
  if(b._dwTick && tick - b._dwTick < 8) return !!b._dwVal;
  // включился шифт — держим его хотя бы ~1с (иначе на границе порога бот
  // переключался шаг/бег/шаг несколько раз в секунду)
  if(BAL.lookCommit && b._dwVal && tick - (b._dwOnT||0) < 64){ b._dwTick = tick; return true; }
  b._dwTick = tick; var dwPrev = b._dwVal;
  var foe = b.team, pts = [], acc = 0, px = b.baseX, py = b.baseY;
  for(var i = b.pathIdx; i < b.path.length && acc < 260; i++){
    var q = b.path[i], sl = Math.hypot(q[0]-px, q[1]-py); acc += sl; px = q[0]; py = q[1]; pts.push([px, py]);
  }
  if(!pts.length) pts.push([b.post.x, b.post.y]);
  var seenZ = {}, dz = 0;
  pts.forEach(function(q){
    var zi = bzOf(q[0], q[1]); if(zi < 0 || seenZ[zi]) return; seenZ[zi] = 1;
    var own = reachPossible(foe, zi) ? beliefZoneKnown(foe, zi) : 0;
    var nb = 0; (BZ.nbr[zi]||[]).forEach(function(j){ if(reachPossible(foe, j)) nb = Math.max(nb, beliefZoneKnown(foe, j)); });
    dz = Math.max(dz, own + 0.5*nb);
    // (v143) непроверенный угол вплотную к пути, куда враг мог успеть — тихо,
    // чтобы чекнуть его и не спалиться (у про: "иду шифтом, чекаю каждый угол")
    { var uc = uncheckedW(foe, zi); (BZ.nbr[zi]||[]).forEach(function(j){ var c = BZ.cent[j]; if(c && Math.hypot(c.x-q[0], c.y-q[1]) < 320) uc = Math.max(uc, uncheckedW(foe, j)); });
      if(uc >= 0.8) dz = Math.max(dz, LOOK.uncheckWalk); }
  });
  b._dwVal = dz >= (BAL.dangerWalkThr || 0.12);
  if(b._dwVal && !dwPrev) b._dwOnT = tick;
  // "чисто" в одной зоне ≠ безопасно вокруг: карта вероятностей после колла
  // "проверил — пусто" обнуляет зону, и раньше бот сразу срывался на бег и
  // палил позицию. Если враг недавно (≤15с) был засвечен рядом с путём (≤650px)
  // и он жив — идём тихо, пока его не найдут снова
  if(!b._dwVal && BAL.clearQuiet){
    var L = beliefLast[b.team] || {}, BL = beliefLast[b.team] || {};
    outer: for(var eid in BL){
      var lo = BL[eid]; if(!lo || tick - lo.tick > 15*TICK_HZ) continue;
      var foeB = bots.filter(function(o){ return o.id === eid; })[0]; if(!foeB || !foeB.alive) continue;
      for(var pi = 0; pi < pts.length; pi++) if(Math.hypot(pts[pi][0]-lo.x, pts[pi][1]-lo.y) < 650){ b._dwVal = true; b._dwWhy = "near"; if(!dwPrev) b._dwOnT = tick; break outer; }
    }
  }
  return b._dwVal;
}
