// куда смотреть, стоя на посту без свежей инфы: зона, откуда меня могут
// простреливать, с наибольшей вероятностью врага (кэш на 0.25с)
// куда смотреть на "невидимую" точку (звук, где только что был враг, вход
// поста за углом): не сквозь стену прямо на неё, а на ближайший видимый угол,
// из-за которого оттуда выйдут — видимую точку её зоны или соседних зон,
// ближайшую к самой точке
// линия взгляда упирается в смок — смотреть на его ближний край (оттуда из дыма
// выйдут), а не на угол за дымом
function smokeEdge(o, p){
  var best = null, bt = Infinity;
  for(var i=0;i<smokes.length;i++){
    var S = smokes[i], r = smokeRadiusNow(S)*0.95; if(r < 25) continue;
    var dx = p.x-o.x, dy = p.y-o.y, fx = o.x-S.x, fy = o.y-S.y;
    var a = dx*dx+dy*dy, bq = 2*(fx*dx+fy*dy), c = fx*fx+fy*fy-r*r;
    if(c <= 0) continue;                      // стоим в дыму — край не ищем
    var disc = bq*bq-4*a*c; if(disc < 0) continue;
    var t = (-bq - Math.sqrt(disc))/(2*a); if(t < 0 || t > 1) continue;
    if(t < bt){ bt = t; best = {x:o.x+dx*t, y:o.y+dy*t}; }
  }
  return best;
}
// ================= ПИКИ ДО КОНТАКТА (v135) =================
// Угол впереди по пути: последняя видимая точка пути, за которой путь уходит
// из видимости. Оттуда и выйдет враг — туда прицел (ближний угол первым), а
// последние метры до него — шагом и медленнее ("режем угол по кусочку").
function aheadCorner(b){
  if(!b.path || !b.path.length || b.pathIdx >= b.path.length) return null;
  var prev = {x:b.x, y:b.y}, acc = 0;
  for(var i=b.pathIdx; i<b.path.length && i < b.pathIdx+8; i++){
    var q = {x:b.path[i][0], y:b.path[i][1]}; acc += Math.hypot(q.x-prev.x, q.y-prev.y); prev = q;
    if(acc > 420) return null;
    if(!hasLOS(b.x, b.y, q.x, q.y)){
      var vis = i > b.pathIdx ? {x:b.path[i-1][0], y:b.path[i-1][1]} : null;
      if(!vis) return null;
      return {pt:vis, beyond:q, dist:Math.hypot(vis.x-b.x, vis.y-b.y)};
    }
  }
  return null;
}
function pieAllowed(b){
  // режут углы и выбирают пик заранее — когда есть время: T до выхода, охота,
  // пробы, лёрк, ранние пики CT, CT без колла. Ротации, выход T, ретейк —
  // бегом и с командой, как у про (там решает скорость и гранаты)
  var tag = (b.post && b.post.tag) || "", tt = teamTac.T, ct = teamTac.CT;
  if(/^(endhunt|hunt|probe|earlyPeek|flank|lurk|midcover|clear|roam|shift|clutch)/.test(tag)) return true;
  if(bomb && bomb.state === "planted") return false;
  if(b.team === "T") return !!(tt && tt.phase === "setup");
  return !(ct && ct.call) && !/^(gather|retake)/.test(tag);
}
function pieBusy(b){
  return !b.alive || !pieAllowed(b) || b.state !== "patrol" || b._sawEnemy || b.planting || b.defusing || b.holding || b.atPost ||
    (b.post && /^(defuse|plantspot|flee|save|antidefuse|stopplant|retake|tradeR|repos|fetch|pickup|lineup)/.test(b.post.tag||"")) ||
    (bomb && bomb.state === "carried" && bomb.carrier === b && (ROUND_TIME_SEC - (simTime - roundStartTime)) < 30);
}
function prePeekTick(b){
  if(pieBusy(b)){ b._pie = null; if(b._ppWaitUntil && b._sawEnemy) b._ppWaitUntil = 0; return; }
  if(tick % 8 === (b.id.charCodeAt(1) % 8)){
    var C = aheadCorner(b);
    if(C){
      var zB = bzOf(C.beyond.x, C.beyond.y);
      // за углом враг может быть (по таймингу/инфе) и там не стоит свой
      var open = zB >= 0 && reachPossible(b.team, zB) &&
        !bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-C.beyond.x, o.y-C.beyond.y) < 160; });
      C.danger = open ? (infoZone(b.team, zB) + 0.1) : 0;
      C.slice = open && C.dist < 110;
      C.t = tick; b._pie = C;
      if(open && C.dist < 150) prePeekDecide(b, C, zB);
    } else b._pie = null;
  }
  // ждёт (флешку/тиммейта/паузу) — но не дольше, и тиммейт подошёл — выходят
  if(b._ppWaitUntil > tick && b._ppMate){
    var m = b._ppMate; if(!m.alive || Math.hypot(m.x-b.x, m.y-b.y) < 110) b._ppWaitUntil = 0;
  }
}
// решение, КАК брать угол, — до контакта, один раз на угол
function prePeekDecide(b, C, zB){
  var key = Math.round(C.pt.x/60)+","+Math.round(C.pt.y/60);
  var PD = b._ppDone || (b._ppDone = {}); if(PD.round !== roundNum){ PD = b._ppDone = {round:roundNum}; }
  if(PD[key]) return; PD[key] = 1;
  // инфа, что угол держат: свежая точка врага за углом или высокая вероятность
  var L = picKnown(b.team) || {}, holder = null;
  for(var e in L){ var q = L[e]; if(tick - q.tick < 8*TICK_HZ && Math.hypot(q.x-C.beyond.x, q.y-C.beyond.y) < 450){ holder = q; break; } }
  var info = !!holder || infoZone(b.team, zB) >= 0.45;
  var heardMe = BAL.heardMe && b._noisyT && tick - b._noisyT < 3*TICK_HZ;       // (4) он меня, скорее всего, слышал
  var repeek = b._avoidPeekUntil > tick && b._avoidPeekAt && Math.hypot(b._avoidPeekAt.x-C.beyond.x, b._avoidPeekAt.y-C.beyond.y) < 450;
  var tt = teamTac.T, execEntry = b.team === "T" && tt && tt.phase === "execute" && b.tRole === "entry";
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) < 320 && !o._sawEnemy; });
  // (3) один угол за раз: из-за угла видно два опасных направления — второе
  // отдаём тиммейту (смотрит туда) или закрываем флешкой
  if(BAL.oneAngle){
    var dirs = [], zs = {};
    // (v136) раньше — только центры зон и вероятность ≥0.12: центры из-за угла
    // почти никогда не видны, и механика не срабатывала. Теперь — любые видимые
    // точки зоны (и соседей соседей), враг там может быть по таймингу
    var addD = function(j){ if(j < 0 || zs[j] || !reachPossible(b.team, j)) return; zs[j] = 1;
      var bj = infoZone(b.team, j) + 0.1;
      var smp = ZONE_SAMPLES[BZ.ids[j]] || (BZ.cent[j] ? [BZ.cent[j]] : []), bestQ = null, bdq = Infinity;
      smp.forEach(function(q){ var dq = Math.hypot(q.x-C.beyond.x, q.y-C.beyond.y); if(dq > 60 && dq < 900 && dq < bdq && hasLOS(C.beyond.x, C.beyond.y, q.x, q.y)){ bdq = dq; bestQ = q; } });
      if(bestQ) dirs.push({pt:bestQ, a:Math.atan2(bestQ.y-C.beyond.y, bestQ.x-C.beyond.x), w:bj, d:bdq}); };
    addD(zB); (BZ.nbr[zB]||[]).forEach(function(j){ addD(j); (BZ.nbr[j]||[]).forEach(addD); });
    dirs.sort(function(a, c){ return a.d - c.d; });
    var second = dirs.slice(1).filter(function(x){ return Math.abs(((x.a-dirs[0].a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI) > 0.9; })[0];
    if(second){
      var cm = mates[0];
      if(cm){ cm._coverDir = {pt:second.pt, until: tick + 4*TICK_HZ}; }
      else if(b.nades && b.nades.flash > 1 && !b.nadeTask && assignNade(b, "flash", second.pt, "закрыть второй угол", {now:true, range:700})) {}
    }
  }
  if(!info && !heardMe && !repeek){ b._plannedPeek = {type: C.danger > 0.3 ? "shoulder" : null, t:tick}; return; }
  // (2) угол держат — прямо не выходим
  // (флешка себе) раньше рвалась в точке за углом — там, куда держащий не
  // смотрит (или вообще не видит): из 13 флешек слепила одна. Поп-флешка
  // должна хлопнуть у него перед глазами: на линии "держащий → край угла"
  var hPos = holder ? {x:holder.x, y:holder.y} : null;
  if(!hPos){ var bz0 = -1, bv0 = 0; [zB].concat(BZ.nbr[zB]||[]).forEach(function(j){ var v = infoZone(b.team, j); if(v > bv0 && BZ.cent[j]){ bv0 = v; bz0 = j; } }); if(bz0 >= 0) hPos = BZ.cent[bz0]; }
  var popPt = C.beyond;
  if(hPos){ var fr = [0.35, 0.5, 0.22, 0.65];
    for(var fi=0; fi<fr.length; fi++){ var P = {x: C.pt.x + (hPos.x-C.pt.x)*fr[fi], y: C.pt.y + (hPos.y-C.pt.y)*fr[fi]};
      if(!insideSolidWall(P.x, P.y) && hasLOS(hPos.x, hPos.y, P.x, P.y) && Math.hypot(P.x-hPos.x, P.y-hPos.y) > 90){ popPt = P; break; } } }
  if(holder && !(b.nades && b.nades.flash > 0)) b._peekNeed = {pt:popPt, t:tick}; // своей флешки нет — попросить (тимспик)
  if(b.nades && b.nades.flash > 0 && !b.nadeTask && b._ppFlashR !== roundNum && holder && assignNade(b, "flash", popPt, "флешу себе под пик", {now:true, range:700})){
    b._ppFlashR = roundNum; b._ppWaitUntil = tick + 40; b._ppMate = null; b._plannedPeek = {type:"wide", t:tick};
    if(!b._ppV || tick - b._ppV > 6*TICK_HZ){ b._ppV = tick; logEvent(b.id+": угол держат — флешу себе и выхожу широко"); }
    return;
  }
  if(!execEntry && mates.length && secLeft > 25){
    b._ppWaitUntil = tick + Math.round(2.5*TICK_HZ); b._ppMate = mates[0]; b._plannedPeek = {type:"wide", t:tick + 2*TICK_HZ};
    if(!b._ppV || tick - b._ppV > 6*TICK_HZ){ b._ppV = tick; logEvent(b.id+": угол держат — жду "+mates[0].id+", выходим вдвоём"); }
    return;
  }
  // один и без флешки: джиггл за инфой; если меня слышали/уже пикал сюда — сначала пауза
  b._plannedPeek = {type:"jiggle", t:tick};
  if((heardMe || repeek) && !execEntry && secLeft > 25){
    b._ppWaitUntil = tick + Math.round(2*TICK_HZ); b._ppMate = null;
    if(!b._ppV || tick - b._ppV > 6*TICK_HZ){ b._ppV = tick; logEvent(b.id+": "+(repeek ? "сюда уже пикал" : "меня, похоже, слышали")+" — не выхожу сразу, джиггл после паузы"); }
  }
}
// (v163) где враг из точки q выйдет на линию бота: идём по его пути к боту,
// первая точка, которую бот видит (не ближе 50px). Нет такой — null
function appearFrom(b, q){
  var k = Math.round(q.x/40)+","+Math.round(q.y/40)+"|"+Math.round(b.x/16)+","+Math.round(b.y/16);
  if(b._apfK === k) return b._apfV;
  b._apfK = k; b._apfV = null;
  var wp = buildWaypointPath(q.x, q.y, 0, b.x, b.y, 0); if(!wp || !wp.length) return null;
  var prev = {x:q.x, y:q.y};
  for(var i=0;i<wp.length;i++){
    var p = {x:wp[i][0], y:wp[i][1]};
    if(hasLOS(b.x, b.y, p.x, p.y)){
      // уточняем на отрезке prev→p: первая видимая точка
      var lo = 0, hi = 1;
      for(var it=0; it<6; it++){ var m = (lo+hi)/2, mp = {x:prev.x+(p.x-prev.x)*m, y:prev.y+(p.y-prev.y)*m}; if(hasLOS(b.x, b.y, mp.x, mp.y)) hi = m; else lo = m; }
      var r = {x:prev.x+(p.x-prev.x)*hi, y:prev.y+(p.y-prev.y)*hi};
      if(Math.hypot(r.x-b.x, r.y-b.y) < 50) return null;
      b._apfV = r; return r;
    }
    prev = p;
  }
  return null;
}
function cornerLook(b, p, from){
  if(!p) return p;
  var o = from || b;
  if(smokes.length){ var se = smokeEdge(o, p); if(se) return se; }
  if(hasLOS(o.x, o.y, p.x, p.y)) return p;
  var pk = Math.round(p.x/80)+","+Math.round(p.y/80);
  // та же цель и прежний угол всё ещё виден — не пересчитываем (переминание на
  // месте иначе меняло "ближайший угол" и бот вертел головой)
  if(b._cornerPK === pk && b._cornerPt && hasLOS(o.x, o.y, b._cornerPt.x, b._cornerPt.y)) return b._cornerPt;
  b._cornerPK = pk;
  // угол — это место, где путь к цели уходит из видимости: последняя видимая
  // точка пути по навмешу (оттуда враг и выйдет). Раньше брались видимые точки
  // соседних зон — и бот часто смотрел в случайный угол
  var wp = buildWaypointPath(o.x, o.y, 0, p.x, p.y, 0), vis = null;
  for(var wi=0; wi<wp.length; wi++){
    var q0 = {x:wp[wi][0], y:wp[wi][1]};
    if(hasLOS(o.x, o.y, q0.x, q0.y)){ if(Math.hypot(q0.x-o.x, q0.y-o.y) > 30) vis = q0; }
    else break;
  }
  if(vis){ b._cornerPt = vis; return vis; }
  var zi = bzOf(p.x, p.y), cand = [];
  var addZ = function(j){ if(j < 0 || j == null) return; (ZONE_SAMPLES[BZ.ids[j]] || [BZ.cent[j]]).forEach(function(q){ cand.push(q); }); };
  addZ(zi); (BZ.nbr[zi]||[]).forEach(addZ);
  var zb = bzOf(o.x, o.y); if(zb >= 0 && zb !== zi) (BZ.nbr[zb]||[]).forEach(function(j){ if(j !== zi) addZ(j); });
  var best = null, bd = Infinity;
  cand.forEach(function(q){
    var dq = Math.hypot(q.x-o.x, q.y-o.y); if(dq < 40) return;
    if(!hasLOS(o.x, o.y, q.x, q.y)) return;
    var sc = Math.hypot(q.x-p.x, q.y-p.y) + 0.15*dq;
    if(sc < bd){ bd = sc; best = q; }
  });
  b._cornerPt = best || null;   // не нашли видимого угла — не смотреть сквозь стену
  return b._cornerPt;
}
// одна последняя проверка «не смотреть в стену» (для взглядов, заданных
// задачей, и когда бот стоит без цели): ровная стена ближе 80 — ближайшее
// открытое направление ±90°; любая стена/угол ближе 45 — открытое ±70°;
// открытого рядом нет — не поворачиваемся в стену
function wallSafeLook(b, look){
  var a = look ? Math.atan2(look.y-b.y, look.x-b.x) : (!(b.curSpeed > 15*SPD_K) && b.facing !== undefined ? b.facing : null);
  if(a === null) return look;
  if(!look) return look;
  var k = Math.round(look.x/24)+","+Math.round(look.y/24)+"|"+Math.round(b.x/12)+","+Math.round(b.y/12);
  if(b._olK === k) return b._olV;
  b._olK = k; b._olV = look;
  if(Math.hypot(look.x-b.x, look.y-b.y) < 60) return look;
  var free = function(an, r){ var c = rayClipWalls(b.x, b.y, b.x+Math.cos(an)*r, b.y+Math.sin(an)*r); return Math.hypot(c.x-b.x, c.y-b.y); };
  if(free(a, 120) >= 45) return look;
  for(var st = 1; st <= 7; st++) for(var sg = -1; sg <= 1; sg += 2){
    var an = a + sg*st*0.1745;
    if(free(an, 220) >= 110){ b._olV = {x:b.x+Math.cos(an)*200, y:b.y+Math.sin(an)*200}; return b._olV; } }
  b._olV = null; return null;
}

// =====================================================================
// ВЗГЛЯД ПО УГЛАМ (v196, В15; заменил взгляд по зонам v141–v195).
// Каждые 8 тиков для каждой команды:
//  1) кандидаты бота — края стен, которые он видит (10_corners.js): за краем
//     может стоять враг; цель — чуть за кромку, на уровне головы;
//  2) вес края = опасность сейчас (cornerDanger: враг мог дойти по REACH — иначе 0;
//     инфа — видели / слышали / колл; за краем свой — почти 0) / расстояние;
//     звук и свежий контакт рядом — отдельные кандидаты, сильнее всего;
//  3) команда делит края: кто взял край, у остальных рядом этот же край ×0,2 —
//     всегда, не только при большой угрозе;
//  4) угроз нет — край, где враг появится раньше всего (по REACH), слабым весом;
//  5) инерция: текущий край держится, пока новый не лучше заметно.
// На ходу: по направлению движения и ближние первыми; проверенный край (смотрел
// на него ≥0,5 с) ×0,3 на 2 с — углы по очереди.
// Удалено (v196): веса зон, «свой угол (угроз нет)», поворот «+open», тыл по
// расстоянию от спавна (isRearZone), видимые проходы (PORTAL_W), выходы с сайта на ретейке.
// =====================================================================
var LOOK = {
  distHold: 700,     // затухание веса с расстоянием, стоя
  distMove: 400,     // …на ходу (ближние углы важнее)
  closeR: 280, closeK: 2.0,      // совсем рядом — не стоять к нему спиной
  headK: 1.3,        // на ходу: по направлению движения
  behindMove: 0.35,  // на ходу: за спиной (>110°), без инфы
  behindMoveCov: 0.15, // …и спину рядом прикрывает тиммейт
  mateInLine: 0.15,  // на линии взгляда стоит свой (враг выйдет сначала на него)
  claim: 0.2,        // этот край уже взял тиммейт рядом
  claimR: 900,       // "рядом" для дележа
  stick: 1.35,       // бонус текущему краю (инерция)
  minDwell: 48,      // тиков (~0.75с) минимум на одном крае без свежей инфы
  switchK: 2.0,      // раньше minDwell переключаемся, только если новый в 2 раза лучше
  reachFade: 12,     // сек: край, открытый давно и без инфы, гаснет — "если бы шёл, уже вышел бы"
  reachFloor: 0.15,  // …но не до нуля: враг мог и ждать
  etaBase: 0.004,    // угроз нет: край, где враг появится раньше всего — слабый вес
  checkedK: 0.3, checkedSec: 2,  // на ходу: только что проверенный край
  libK: 1.3,         // (v195) край в сторону взгляда с места из демок — небольшой плюс
  contactW: 1.2,     // свежий звук/вижу-потерял рядом (≤1.5с, ≤700px)
  recheckSec: 8,     // сек: через сколько проверенная зона снова считается непроверенной
  uncheckWalk: 0.13, // для шифта: непроверенный угол рядом с путём — идём тихо
  minScore: 0.0005
};
// "не проверено": зону давно (или никогда) не видел никто из своих, и враг по
// таймингу мог туда успеть. 0 — только что проверили или враг туда не мог попасть
var LAST_CLEAR = {CT:{}, T:{}};
// "враг мог сюда дойти" по REACH: не мог — 0; в момент прихода — 1; дальше гаснет до
// reachFloor (путь открыт давно, а никто так и не вышел). Зона и её соседи (кроме зоны бота)
function reachW(team, j, zb){
  var R = REACH[team]; if(!R) return 0;
  var rmin = R[j]; BZ.nbr[j].forEach(function(nn){ if(nn !== zb && R[nn] < rmin) rmin = R[nn]; });
  if(!isFinite(rmin) || rmin > tick) return 0;
  return Math.max(LOOK.reachFloor, Math.exp(-(tick - rmin)/(LOOK.reachFade*TICK_HZ)));
}
function uncheckedW(team, j){
  var R = REACH[team];
  if(R && (R[j] > tick || !isFinite(R[j]))) return 0;
  var lc = (LAST_CLEAR[team]||{})[j], age = lc == null ? 1e9 : tick - lc;
  return Math.min(1, age/(LOOK.recheckSec*TICK_HZ));
}
// (v151) где враг появится, если пойдёт из зоны j ко мне: последняя видимая
// мне точка его пути по навмешу (угол, из-за которого он выйдет). Кэш по клетке 24px и зоне.
var APPEAR = {};
function appearPoint(o, j){
  var c = BZ.cent[j]; if(!c) return null;
  var k = Math.round(o.x/24)+","+Math.round(o.y/24)+"|"+j;
  if(k in APPEAR) return APPEAR[k];
  var wp = buildWaypointPath(c.x, c.y, 0, o.x, o.y, 0), last = null;
  for(var i=0; i<wp.length; i++){ var q = {x:wp[i][0], y:wp[i][1]}, d = Math.hypot(q.x-o.x, q.y-o.y);
    if(d < 50) break;
    if(hasLOS(o.x, o.y, q.x, q.y)){ last = q; break; } }
  if(Object.keys(APPEAR).length > 20000) APPEAR = {};
  APPEAR[k] = last; return last;
}
function _angOff(a, ref){ return Math.abs(((a-ref+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); }
// кандидаты взгляда для одного бота: [{j, pt, sc, fresh}]
function lookCands(b){
  var team = b.team, out = [], moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === team; });
  var rearCov = moving && mates.some(function(o){ return Math.hypot(o.x-b.x, o.y-b.y) < 500; });
  var A = b._act, lib = !moving && A && A.round === roundNum && A.looks && Math.hypot(b.x-A.x, b.y-A.y) < 60 ? A.looks : null;
  var CK = b._cChk || (b._cChk = {}), later = [];
  cornersSeen(b.x, b.y).forEach(function(e){
    var D = cornerDanger(team, e, b), za = Math.atan2(e.y-b.y, e.x-b.x), d = Math.hypot(e.x-b.x, e.y-b.y);
    if(D.v <= 0){ if(!D.mate && isFinite(D.eta) && D.eta > 0) later.push({e:e, eta:D.eta, d:d, a:za}); return; }
    var fresh = D.info > 0;
    var sc = D.v / (1 + d/(moving ? LOOK.distMove : LOOK.distHold));
    if(d < LOOK.closeR) sc *= LOOK.closeK;
    if(moving){ var hd = _angOff(za, b.heading); if(hd < 0.9) sc *= LOOK.headK; else if(hd > 1.9 && !fresh) sc *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove;
      if(!fresh && CK[e.key] && tick - CK[e.key] < LOOK.checkedSec*TICK_HZ) sc *= LOOK.checkedK; }
    if(!fresh && mates.some(function(o){ var dm = Math.hypot(o.x-b.x, o.y-b.y); return dm > 20 && dm < d && _angOff(Math.atan2(o.y-b.y, o.x-b.x), za) < 0.3; })) sc *= LOOK.mateInLine;
    if(lib && lib.some(function(l){ return _angOff(Math.atan2(l.y-b.y, l.x-b.x), za) < 0.45; })) sc *= LOOK.libK;
    out.push({j:e.key, pt:{x:e.x, y:e.y}, sc:sc, fresh:fresh, a:za, e:e, D:D});
  });
  // свежий контакт рядом: услышал шаги/выстрел или только что видел — главнее всего,
  // даже если враг в той же зоне. У контакта — имя врага (не клетка): инерция работает
  var cts = [];
  var hs = b.heardSound; if(hs && tick - hs.tick <= 96) cts.push({x:hs.x, y:hs.y, age:tick-hs.tick, id:hs.src && hs.src !== "?" ? hs.src : null});
  var BLc = beliefLast[team] || {};
  for(var eid in BLc){ var lo = BLc[eid]; if(tick - lo.tick > 96) continue;
    var eb = botById(eid); if(!eb || !eb.alive) continue; cts.push({x:lo.x, y:lo.y, age:tick-lo.tick, id:eid}); }
  cts.forEach(function(q){
    var d = Math.hypot(q.x-b.x, q.y-b.y); if(d > 700 || d < 20) return;
    var za = Math.atan2(q.y-b.y, q.x-b.x);
    if(moving && _angOff(za, b.heading) > 1.9 && (q.age > 20 || d > 250)) return;
    var pt = cornerLook(b, q) || appearFrom(b, q);
    if(!pt) return;
    out.push({j:q.id ? "snd:"+q.id : "snd"+Math.round(q.x/80)+","+Math.round(q.y/80), pt:pt, sc:LOOK.contactW * (d < 300 ? 2 : 1) / (1 + d/700) * (1 - q.age/192), fresh:true, a:za, snd:true});
  });
  // угроз нет совсем: края, где враг появится раньше всего (по таймингу) — слабым весом,
  // раньше — сильнее (делятся между тиммейтами, как и угрозы)
  if(!out.some(function(c){ return c.sc >= LOOK.minScore; }))
    later.forEach(function(q){ out.push({j:q.e.key, pt:{x:q.e.x, y:q.e.y}, sc:LOOK.etaBase*Math.exp(-q.eta/6)/(1 + q.d/LOOK.distHold), fresh:false, a:q.a, e:q.e, early:true, eta:q.eta}); });
  return out;
}
// раз в 8 тиков: кандидаты всем + делёж направлений внутри команды
function lookPlan(team){
  var list = bots.filter(function(b){ return b.alive && b.team === team && !b._sawEnemy; });
  list.forEach(function(b){
    b._lkC = lookCands(b);
    // инерция: текущее направление получает бонус
    b._lkC.forEach(function(c){ if(c.j === b._lkZ) c.sc *= LOOK.stick; });
    b._lkPick = null;
  });
  // жадный делёж: самый важный угол команды берёт тот, у кого он важнее всего
  var left = list.slice();
  while(left.length){
    var bestB = null, bestC = null;
    left.forEach(function(b){ b._lkC.forEach(function(c){ if(!bestC || c.sc > bestC.sc){ bestC = c; bestB = b; } }); });
    if(!bestB){ left.forEach(function(b){ b._lkPick = null; }); break; }
    bestB._lkPick = bestC;
    left.splice(left.indexOf(bestB), 1);
    left.forEach(function(o){ if(Math.hypot(o.x-bestB.x, o.y-bestB.y) > LOOK.claimR) return;
      o._lkC.forEach(function(c){ if(c.fresh) return;
        if(c.j === bestC.j || Math.hypot(c.pt.x-bestC.pt.x, c.pt.y-bestC.pt.y) < 220) c.sc *= LOOK.claim; }); });
  }
  // инерция по времени + итог
  list.forEach(function(b){
    var p = b._lkPick;
    if(p && p.sc < LOOK.minScore) p = null;
    if(p && b._lkZ != null && p.j !== b._lkZ && !p.fresh && tick - (b._lkSince||0) < LOOK.minDwell){
      var cur = b._lkC.filter(function(c){ return c.j === b._lkZ; })[0];
      if(cur && p.sc < LOOK.switchK * cur.sc) p = cur;
    }
    if((p ? p.j : null) !== b._lkZ){ b._lkSince = tick; b._lkZ = p ? p.j : null; }
    b._lkPt = p ? p.pt : null;
    if(p && p.e && tick - b._lkSince > 32) (b._cChk || (b._cChk = {}))[p.j] = tick;   // смотрел на край ≥0,5 с — проверен
    b._lkTop = b._lkC.slice().sort(function(x, y){ return y.sc - x.sc; }).slice(0, 3).map(function(c){ var zn = c.e ? (ZONE_NAMES[BZ.ids[c.e.z]] || BZ.ids[c.e.z]) : "";
      var nm = c.snd ? "звук/контакт" : c.early ? "край к "+zn+" (враг через "+Math.round(c.eta)+" с)" : "край к "+zn+(c.D && c.D.info > 0 ? " (инфа)" : ""); return [nm, c.sc]; });
  });
}
// итоговая точка взгляда бота (кроме "вижу врага" — это выше)
// ---------- (v153) плавный взгляд ----------
// У про взгляд "туда-обратно" больше 45° за полсекунды — 0,8 раза в минуту,
// у ботов было 4,6: каждые 8 тиков делёж углов в команде мог перекинуть
// бота на другой вход и тут же вернуть. Теперь: без срочной причины новое
// направление принимается, только если старое продержалось ≥0,8с (стоя) /
// 0,5с (на ходу), и не возвращаемся к только что брошенному направлению 1,5с.
var SL = {holdStand: 51, holdMove: 32, backBlock: 96, holdAlert: 16, backAlert: 40, same: 0.35, calmRate: 4.5, ease: 0.2, minStep: 0.012};
// 2 — бой (враг виден, прикрытие ослеплённого, спам, бросок): без фильтра;
// 1 — тревога (свежий звук/контакт рядом): поворот быстрый, но тоже без
//     метаний — держит новое направление хотя бы 0,25с; 0 — спокойно
function lookUrgent(b){
  if(b.lookReason === "flash") return 2;
  if(b._sawEnemy || b.lookReason === "enemy" || b.lookReason === "cover" || b.lookReason === "spam") return 2;
  if(b.planting || b.defusing) return 2;
  if(tick < (b.blindUntil||0) + 32) return 2;
  // тревога — только от своих глаз и ушей; инфа тиммейтов (картина команды)
  // меняет то, КУДА смотреть (вес кандидата в lookCands), а не плавность
  if(b.lastIntel && tick - b.lastIntel.tick < 48) return 1;
  var hs = b.heardSound;
  if(hs && hs.team && hs.team !== b.team && tick - hs.tick < 24 && Math.hypot(hs.x-b.x, hs.y-b.y) < 700) return 1;
  return 0;
}
function smoothLookFilter(b, look, urgent){
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  if(!look){ if(moving) b._sl = null; return look; }
  var S = b._sl, aN = Math.atan2(look.y-b.y, look.x-b.x);
  if(urgent === 2 || !S){ b._sl = {pt:{x:look.x, y:look.y}, since:tick, prev: S ? S.pt : null, left: tick}; return look; }
  var aS = Math.atan2(S.pt.y-b.y, S.pt.x-b.x);
  var dA = Math.abs(((aN-aS+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
  if(dA < SL.same){ S.pt = {x:look.x, y:look.y}; return look; }            // то же направление — просто уточняем точку
  var hold = urgent ? SL.holdAlert : (moving ? SL.holdMove : SL.holdStand);
  if(tick - S.since < hold) return S.pt;                                    // старое ещё не "досмотрели"
  if(S.prev && tick - S.left < (urgent ? SL.backAlert : SL.backBlock)){                                // не возвращаться сразу к брошенному
    var aP = Math.atan2(S.prev.y-b.y, S.prev.x-b.x);
    var dP = Math.abs(((aN-aP+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
    if(dP < SL.same && tick - S.since < (urgent ? SL.backAlert : SL.backBlock)) return S.pt;
  }
  b._sl = {pt:{x:look.x, y:look.y}, since:tick, prev:S.pt, left:tick};
  return look;
}
// (В12) флешка летит в мою сторону: отвернуться (смотреть от места хлопка, хоть в стену) до хлопка
function flashAwayLook(b){
  var F = b._flashAway; if(!F || tick < F.from) return null;
  if(tick >= F.until){ b._flashAway = null; return null; }
  return {x:b.x - (F.x-b.x), y:b.y - (F.y-b.y)};
}
function newLookFor(b){
  if(BAL.coverFix && b._coverDir && tick < b._coverDir.until && !b._sawEnemy){ b.lookReason = "cover"; return cornerLook(b, b._coverDir.pt) || b._coverDir.pt; }
  if(b._spam && tick < b._spam.until){ b.lookReason = "spam"; return b._spam.pt; }
  // задачи, где взгляд задан самой задачей
  if(b.roamChecking && b.roamLookPt){ b.lookReason = "roam"; return b.roamLookPt; }
  if(b.fakeHoldUntil && tick < b.fakeHoldUntil && bomb && bomb.site){ b.lookReason = "fake"; return GEO[bomb.site].tEntry; }
  // всё остальное — делёж углов команды: угроза, порученный угол, «как у про»,
  // угол поста — веса кандидатов в lookCands, а не отдельные ступени
  if(b._lkPt){ b.lookReason = "look"; return cornerLook(b, b._lkPt) || b._lkPt; }
  b.lookReason = null; return null;
}


