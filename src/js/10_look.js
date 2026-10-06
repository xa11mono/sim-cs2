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
      C.danger = open ? (beliefZoneKnown(b.team, zB) + 0.1) : 0;
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
  var info = !!holder || beliefZoneKnown(b.team, zB) >= 0.45;
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
      var bj = beliefZoneKnown(b.team, j); if(bj < 0.04) return;
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
  if(!hPos){ var bz0 = -1, bv0 = 0; [zB].concat(BZ.nbr[zB]||[]).forEach(function(j){ var v = beliefZoneKnown(b.team, j); if(v > bv0 && BZ.cent[j]){ bv0 = v; bz0 = j; } }); if(bz0 >= 0) hPos = BZ.cent[bz0]; }
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
function flatWallAhead(b, a, R){
  var dx = Math.cos(a), dy = Math.sin(a), best = null;
  for(var i=0;i<MANUAL_WALLS.length;i++){ var w = MANUAL_WALLS[i];
    if(Math.max(w[0],w[2]) < b.x-R || Math.min(w[0],w[2]) > b.x+R || Math.max(w[1],w[3]) < b.y-R || Math.min(w[1],w[3]) > b.y+R) continue;
    var sx = w[2]-w[0], sy = w[3]-w[1], den = dx*sy - dy*sx; if(Math.abs(den) < 1e-9) continue;
    var qx = w[0]-b.x, qy = w[1]-b.y, t = (qx*sy - qy*sx)/den, u = (qx*dy - qy*dx)/den;
    if(t > 0 && t < R && u >= 0 && u <= 1 && (!best || t < best.t)) best = {t:t, e:Math.min(u, 1-u)*Math.hypot(sx, sy)};
  }
  return !!(best && best.e > 18);
}
function openDirNear(b, a){
  var k = Math.round(a*20)+"|"+Math.round(b.x/10)+","+Math.round(b.y/10);
  if(b._odK === k) return b._odV;
  b._odK = k; b._odV = null;
  for(var st=1; st<=9; st++) for(var sg=-1; sg<=1; sg+=2){
    var an = a + sg*st*0.1745, c = rayClipWalls(b.x, b.y, b.x+Math.cos(an)*160, b.y+Math.sin(an)*160);
    if(Math.hypot(c.x-b.x, c.y-b.y) >= 140){ b._odV = {x:b.x+Math.cos(an)*220, y:b.y+Math.sin(an)*220}; return b._odV; }
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
  if(flatWallAhead(b, a, 80)){ var wal = openDirNear(b, a); if(wal) b.lookReason = (b.lookReason||"") + "+open"; return wal || null; }
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

// ---- опасность зоны для взгляда (помощники нового взгляда, см. ниже) ----
// Опасность зоны = вероятность врага в ней по карте belief (она сама
// расползается по соседним зонам со временем и чистится там, куда свои
// реально смотрят). Инфа НЕ забывается по таймеру: враг, которого в этом
// раунде хоть раз видели/слышали, весит полностью всё время; "чистый прогноз"
// (ни разу не засвечен) — 0.3. Кандидаты — только зоны, которые видно с моей
// точки: враг за стеной на T Upper поднимает опасность выхода из Lamp Room,
// который мне виден (через соседей), — поэтому "далёкая стрельба за стеной"
// не отвлекает, а бой в двух шагах по пути — отвлекает.
function beliefZoneKnown(team, i){
  // инфа не забывается, но её ТОЧНОСТЬ со временем падает (враг мог уйти куда
  // угодно, это уже учтено расползанием): свежая (≤6с) — вес 1, к 25с — 0.5,
  // дальше держится на 0.5. Ни разу не засвеченный враг — 0.3 (чистый прогноз)
  var B = belief[team], seen = beliefSeen[team], L = beliefLast[team] || {}, t = 0;
  Object.keys(B).forEach(function(eid){
    var w = 0.3;
    if(seen[eid] != null){ var lo = L[eid], age = lo ? (tick - lo.tick)/TICK_HZ : 30; w = age <= 6 ? 1 : Math.max(0.5, 1 - 0.5*(age-6)/19); }
    t += B[eid][i] * w;
  });
  return t;
}
// в этой зоне (или рядом, ≤400) есть враг, которого видели/слышали ≤3с назад
function freshThreatNear(team, c){
  var L = beliefLast[team] || {};
  for(var eid in L){ var lo = L[eid]; if(tick - lo.tick <= 3*TICK_HZ && Math.hypot(lo.x-c.x, lo.y-c.y) < 400){ var e = bots.filter(function(o){ return o.id === eid; })[0]; if(e && e.alive) return true; } }
  return false;
}

// =====================================================================
// НОВЫЙ ВЗГЛЯД (v141): одна оценка вместо очереди из ~15 функций.
// Каждые 8 тиков для каждой команды:
//  1) для каждого живого бота собираем кандидатов — зоны, откуда простреливается
//     его позиция (таблица опасности), и точку взгляда на каждую;
//  2) вес кандидата = сколько врагов вероятно выйдет оттуда (карта вероятностей:
//     враг в самой зоне + враг за её входами, если эти входы никто не видит)
//     × открытость линии × близость × поправки на роль/движение;
//  3) команда делит направления: жадно, от самого важного — кто взял
//     направление, у тех, кто рядом, вес этого же направления падает (LOOK.claim);
//  4) инерция: текущее направление держится, пока новое не лучше заметно
//     (LOOK.stick) или не пришла свежая инфа.
// Всё, что раньше было отдельными правилами (звук, смерть тиммейта, колл, ЛИП,
// привычки соперника, "спину прикрывает свой", "не смотреть в тиммейта"), —
// теперь либо уже в карте вероятностей, либо один множитель ниже.
// =====================================================================
var LOOK = {
  maxDist: 1100,     // дальше этой дистанции зону как угрозу не рассматриваем
  nbrW: 0.6,         // вклад врага за входом в зону (он оттуда выйдет)
  watchedNbr: 0.25,  // …если этот вход видит тиммейт — враг сначала выйдет на него
  distHold: 700,     // затухание веса с расстоянием, стоя
  distMove: 400,     // …на ходу (ближние углы важнее)
  closeR: 280, closeK: 2.0,      // совсем рядом — не стоять к нему спиной
  freshK: 2.5,       // свежая инфа (видели/слышали ≤3с рядом с точкой)
  postK: 1.2,        // (v176) направление поста — подсказка между равными угрозами, не причина
  headK: 1.3,        // на ходу: по направлению движения
  behindMove: 0.35,  // на ходу: за спиной (>110°)
  behindMoveCov: 0.15, // …и спину рядом прикрывает тиммейт
  behindHold: 0.5,   // стоя: за спиной относительно поста (>125°)
  mateThere: 0.15,   // в этой зоне/у точки стоит свой
  mateInLine: 0.15,  // на линии взгляда стоит свой (смотрел бы ему в спину)
  claim: 0.2,        // это направление уже взял тиммейт рядом
  claimR: 900,       // "рядом" для дележа направлений
  stick: 1.35,       // бонус текущему направлению (инерция)
  minDwell: 48,      // тиков (~0.75с) минимум на одном направлении без свежей инфы
  switchK: 2.0,      // раньше minDwell переключаемся, только если новое в 2 раза лучше
  reachW: 0.08,      // (v176) вес "враг мог сюда дойти по времени" (REACH картины команды)
  reachFade: 12,     // сек: угол, открытый давно и без инфы, гаснет — "если бы шёл, уже вышел бы"
  reachFloor: 0.15,  // …но не до нуля: враг мог и ждать
  retakeW: 0.6,      // (v176) сбор на ретейк: выходы с сайта, где бомба, к собирающемуся
  entryExp: 0.9,     // открытость прохода в свою зону (он всегда простреливает позицию)
  uncheckW: 0.05,    // вес непроверенного угла, куда враг мог успеть (когда реальной инфы нет)
  reachSlack: 4,     // сек: запас к таймингу — "мог прибежать чуть раньше расчёта"
  recheckSec: 8,     // сек: через сколько проверенный угол снова считается непроверенным
  uncheckWalk: 0.13, // для шифта: непроверенный угол рядом с путём — идём тихо
  contactW: 1.2,     // свежий звук/вижу-потерял рядом (≤1.5с, ≤700px) — даже в своей же зоне
  rearMargin: 150,   // px пути: проход дальше от врага, чем я, на это — мой тыл
  rearInfo: 0.15,    // …но если там по инфе вероятен враг (люркер, фланг) — смотрим
  claimMin: 0.08,    // делить направления в команде, только если угроза заметная
  postBase: 0.004,   // угол поста — только когда угроз нет совсем (запасной вариант, не соперник угрозам)
  minScore: 0.0005    // ниже — "ничего не угрожает": смотрим по ходу / на пост
};
// "не проверено": зону давно (или никогда) не видел никто из своих, и враг по
// таймингу мог туда успеть (с запасом: тайминг — оценка, враг мог бежать быстрее).
// 0 — только что проверили или враг туда не мог попасть; 1 — давно не смотрели.
var LAST_CLEAR = {CT:{}, T:{}};
var _ED = {};
function enemySpawnDist(team){
  if(_ED[team] && _ED[team].n === BZ.ids.length) return _ED[team].D;
  var sp = team === "CT" ? T_SPAWN : CT_SPAWN, z0 = bzOf(sp.x, sp.y);
  var D = bzDist(z0 >= 0 ? [z0] : []); _ED[team] = {n:BZ.ids.length, D:D}; return D;
}
// (v176) "враг мог сюда дойти": 0 — не мог (по REACH ещё дальше запаса); перед
// возможным приходом растёт, в момент прихода — 1; дальше гаснет до reachFloor:
// путь открыт давно, а никто так и не вышел. Зона и её соседи (кроме зоны бота).
function reachW(team, j, zb){
  var R = REACH[team]; if(!R) return 0;
  var rmin = R[j]; BZ.nbr[j].forEach(function(nn){ if(nn !== zb && R[nn] < rmin) rmin = R[nn]; });
  if(!isFinite(rmin) || rmin - tick > LOOK.reachSlack*TICK_HZ) return 0;
  if(rmin > tick) return Math.exp(-(rmin - tick)/(LOOK.reachSlack*TICK_HZ));
  return Math.max(LOOK.reachFloor, Math.exp(-(tick - rmin)/(LOOK.reachFade*TICK_HZ)));
}
function uncheckedW(team, j){
  var R = REACH[team];
  if(R && R[j] - tick > LOOK.reachSlack*TICK_HZ) return 0;
  if(R && !isFinite(R[j])) return 0;
  var lc = (LAST_CLEAR[team]||{})[j], age = lc == null ? 1e9 : tick - lc;
  return Math.min(1, age/(LOOK.recheckSec*TICK_HZ));
}
// тыл: зона дальше от вражеского спавна, чем моя, и по инфе там никого — враг
// туда может попасть только через нас или тиммейтов (Alley, 90, First Lane у CT)
function isRearZone(team, zb, j){
  var ED = enemySpawnDist(team);
  if(!(ED[j] > ED[zb] + LOOK.rearMargin)) return false;
  if(beliefZoneKnown(team, j) >= LOOK.rearInfo) return false;
  if(BZ.cent[j] && freshThreatNear(team, BZ.cent[j])) return false;
  return true;
}
// (v149) "куда смотреть отсюда без инфы": видимый проход, за которым зона
// ближе всего к вражескому спавну — откуда враг придёт раньше всего. Тыл
// (дальше от врага, чем я) не берётся. Кэш по клетке 24px.
var EWL = {};
function enemywardLook(team, p){
  if(!BZ.portal) bzPortals();
  var k = team+Math.round(p.x/24)+","+Math.round(p.y/24); if(k in EWL) return EWL[k];
  var ED = enemySpawnDist(team), zp = bzOf(p.x, p.y), best = null, bs = Infinity;
  if(zp >= 0) BZ.portal.forEach(function(row, i){ for(var js in row){ var j = +js, q = row[j];
    // проход из зоны i в зону j, смотрим "в сторону j"
    var d = Math.hypot(q.x-p.x, q.y-p.y); if(d < 60 || d > 900) continue;
    if(j === zp) continue;                          // проход в мою же зону (он у меня за спиной)
    if(!(ED[j] < ED[i])) continue;                  // только проходы, ведущие к врагу
    if(ED[j] > ED[zp] + LOOK.rearMargin) continue;  // не в тыл
    if(!hasLOS(p.x, p.y, q.x, q.y)) continue;
    var sc = ED[j] + 0.35*d;                        // раньше всего враг + не слишком далеко
    if(sc < bs){ bs = sc; best = {x:q.x, y:q.y}; } } });
  EWL[k] = best; return best;
}
// (v151) где враг появится, если пойдёт из зоны j ко мне: последняя видимая
// мне точка его пути по навмешу (угол, из-за которого он выйдет) — туда и
// пре-эйм. Кэш по клетке 24px и зоне.
var APPEAR = {};
function appearPoint(o, j){
  var c = BZ.cent[j]; if(!c) return null;
  var k = Math.round(o.x/24)+","+Math.round(o.y/24)+"|"+j;
  if(k in APPEAR) return APPEAR[k];
  var wp = buildWaypointPath(c.x, c.y, 0, o.x, o.y, 0), last = null;
  // идём по пути врага к нам: первая точка, которую видно, — место появления
  for(var i=0; i<wp.length; i++){ var q = {x:wp[i][0], y:wp[i][1]}, d = Math.hypot(q.x-o.x, q.y-o.y);
    if(d < 50) break;
    if(hasLOS(o.x, o.y, q.x, q.y)){ last = q; break; } }
  if(Object.keys(APPEAR).length > 20000) APPEAR = {};
  APPEAR[k] = last; return last;
}
function _angOff(a, ref){ return Math.abs(((a-ref+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); }
// точка прохода между двумя зонами (середина общей границы полигонов)
function bzPortalPt(za, zb){
  var A = za.points, B = zb.points, sx = 0, sy = 0, n = 0;
  var dSeg = function(px, py, a, b){ var vx=b.x-a.x, vy=b.y-a.y, L=vx*vx+vy*vy, t = L ? Math.max(0, Math.min(1, ((px-a.x)*vx+(py-a.y)*vy)/L)) : 0; return Math.hypot(px-(a.x+vx*t), py-(a.y+vy*t)); };
  for(var i=0;i<A.length;i++){ var a = A[i], a2 = A[(i+1)%A.length];
    for(var s=0;s<=8;s++){ var px = a.x+(a2.x-a.x)*s/8, py = a.y+(a2.y-a.y)*s/8;
      for(var k=0;k<B.length;k++){ if(dSeg(px, py, B[k], B[(k+1)%B.length]) < 10){ sx += px; sy += py; n++; break; } } } }
  return n ? {x:sx/n, y:sy/n} : null;
}
function bzPortals(){
  BZ.portal = BZ.ids.map(function(){ return {}; });
  BZ.nbr.forEach(function(L, i){ L.forEach(function(j){ if(j < i) return;
    var p = bzPortalPt(ZONEMAP.zones[i], ZONEMAP.zones[j]);
    if(!p){ var ci = BZ.cent[i], cj = BZ.cent[j]; p = {x:(ci.x+cj.x)/2, y:(ci.y+cj.y)/2}; }
    BZ.portal[i][j] = p; BZ.portal[j][i] = p; }); });
}
// какие проходы между зонами сейчас видит команда (враг, прошедший через них, был бы замечен)
function portalWatched(team){
  if(!BZ.portal) bzPortals();
  var mates = bots.filter(function(o){ return o.alive && o.team === team && tick >= (o.blindUntil||0); });
  var W = {};
  BZ.portal.forEach(function(row, i){ for(var js in row){ var j = +js; if(j < i) continue; var p = row[j], ok = false;
    for(var m=0;m<mates.length && !ok;m++){ var o = mates[m], d = Math.hypot(p.x-o.x, p.y-o.y);
      if(d < 90) ok = true;
      else if(d < CONE_R*1.4 && inFov(o, p.x, p.y) && hasVision(o.x, o.y, p.x, p.y)) ok = true; }
    if(ok){ W[i+","+j] = 1; W[j+","+i] = 1; } } });
  return W;
}
var PORTAL_W = {CT:{}, T:{}};
// кандидаты взгляда для одного бота: [{j, pt, sc, fresh}]
function lookCands(b, W){
  var zb = (b.atPost && b.post) ? bzOf(b.post.x, b.post.y) : bzOf(b.x, b.y);
  if(zb < 0) zb = bzOf(b.x, b.y); if(zb < 0) return [];
  var team = b.team, out = [], moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var atHold = !moving && b.post && b.post.look && Math.hypot(b.post.x-b.x, b.post.y-b.y) < 160;
  var postA = (b.post && b.post.look && !(b.post.tag === "save")) ? Math.atan2(b.post.look.y-(b.post.y||b.y), b.post.look.x-(b.post.x||b.x)) : null;
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === team; });
  var rearCov = moving && mates.some(function(o){ return Math.hypot(o.x-b.x, o.y-b.y) < 500; });
  var Wd = ZONE_DANGER_W[BZ.ids[zb]] || {}, PW = PORTAL_W[team] || {};
  (ZONE_DANGER[BZ.ids[zb]]||[]).forEach(function(zid){
    var j = BZ.idx[zid]; if(j === undefined || j === zb) return;
    var cz = BZ.cent[j]; if(!cz || Math.hypot(cz.x-b.x, cz.y-b.y) > LOOK.maxDist) return;
    if(isRearZone(team, zb, j)) return;   // (v148) свой тыл — не угроза
    // 1) сколько врагов оттуда вероятно выйдет
    var th = beliefZoneKnown(team, j), nBest = -1, nVal = 0;
    BZ.nbr[j].forEach(function(nn){ if(nn === zb) return;
      if(!reachPossible(team, nn)) return;
      var v = LOOK.nbrW * beliefZoneKnown(team, nn);
      if(PW[j+","+nn]) v *= LOOK.watchedNbr;          // вход видит свой — враг выйдет на него первым
      th += v; if(v > nVal){ nVal = v; nBest = nn; } });
    // (v176) реальная угроза: враг мог дойти (гаснет, если путь открыт давно) и
    // давно не проверяли — только если дойти мог. Не мог — 0, кроме инфы (belief выше)
    var rw = reachW(team, j, zb);
    th += LOOK.reachW * rw + (rw > 0 ? LOOK.uncheckW * uncheckedW(team, j) : 0);
    if(th <= 0) return;
    // 2) точка взгляда: видимая точка зоны, ближайшая к проходу, откуда идёт угроза
    var ref = (nBest >= 0 && nVal > beliefZoneKnown(team, j)) ? (BZ.portal && BZ.portal[j][nBest]) || BZ.cent[nBest] : null;
    // врага в этой зоне недавно (≤8с) видели/слышали — целимся туда, где он был,
    // а не в любую точку большой зоны (Mid — это полкарты)
    var BLr = beliefLast[team] || {}, lkBest = null, lkAge = 1e9;
    for(var eidr in BLr){ var lr = BLr[eidr]; if(!lr || tick - lr.tick > 8*TICK_HZ || tick - lr.tick >= lkAge) continue;
      if(bzOf(lr.x, lr.y) !== j) continue;
      var er = bots.filter(function(o){ return o.id === eidr; })[0]; if(!er || !er.alive) continue;
      lkBest = lr; lkAge = tick - lr.tick; }
    if(lkBest && LOOK.lkRef !== false) ref = lkBest;
    var apZ = (BAL.cornerAim && !lkBest) ? appearPoint(b, (nBest >= 0 && nVal > beliefZoneKnown(team, j)) ? nBest : j) : null;
    var smp = ZONE_SAMPLES[zid] || [cz], c = null, cd = Infinity;
    smp.forEach(function(q){ var dq = Math.hypot(q.x-b.x, q.y-b.y); if(dq < 50 || !hasLOS(b.x, b.y, q.x, q.y)) return;
      var key = ref ? Math.hypot(q.x-ref.x, q.y-ref.y) : dq; if(key < cd){ cd = key; c = q; } });
    if(apZ && bzOf(apZ.x, apZ.y) === j || apZ && (nBest >= 0 && bzOf(apZ.x, apZ.y) === nBest)) c = apZ;
    if(!c) return;
    var d = Math.hypot(c.x-b.x, c.y-b.y);
    if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(hasLOS(b.x, b.y, ext.x, ext.y)) c = ext; d = 200; }
    var za = Math.atan2(c.y-b.y, c.x-b.x);
    var fresh = freshThreatNear(team, c);
    // 3) оценка
    var sc = th * (0.4 + (Wd[zid]||0)) / (1 + d/(moving ? LOOK.distMove : LOOK.distHold));
    var behind = moving ? _angOff(za, b.heading) > 1.9 : (atHold && postA !== null && _angOff(za, postA) > 2.2);
    if(d < LOOK.closeR && !behind) sc *= LOOK.closeK;
    if(fresh) sc *= LOOK.freshK;
    if(postA !== null && _angOff(za, postA) < 0.9) sc *= LOOK.postK;
    if(moving){ var hd = _angOff(za, b.heading); if(hd < 0.9) sc *= LOOK.headK; else if(hd > 1.9 && !fresh) sc *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; }
    else if(behind && !fresh) sc *= LOOK.behindHold;
    if(!fresh){
      if(mates.some(function(o){ return Math.hypot(o.x-c.x, o.y-c.y) < 140 || (bzOf(o.x, o.y) === j && Math.hypot(o.x-c.x, o.y-c.y) < 260); })) sc *= LOOK.mateThere;
      else if(mates.some(function(o){ var dm = Math.hypot(o.x-b.x, o.y-b.y); return dm > 20 && dm < Math.min(d, 600) && _angOff(Math.atan2(o.y-b.y, o.x-b.x), za) < 0.22; })) sc *= LOOK.mateInLine;
    }
    out.push({j:j, pt:c, sc:sc, fresh:fresh, a:za});
  });
  // входы в СВОЮ зону: враг из соседней зоны сначала войдёт туда, где стоит бот
  // (раньше такие входы не считались вообще — бот на CT-спавне не смотрел на
  // выходы из Alley/Temple, хотя там был враг). Смотрим на сам проход.
  if(BZ.portal) BZ.nbr[zb].forEach(function(nn){
    var p = BZ.portal[zb][nn]; if(!p) return;
    if(isRearZone(team, zb, nn)) return;   // (v148) проход в свой тыл — не угроза
    var d = Math.hypot(p.x-b.x, p.y-b.y); if(d < 40 || d > LOOK.maxDist || !hasLOS(b.x, b.y, p.x, p.y)) return;
    var th = beliefZoneKnown(team, nn);
    BZ.nbr[nn].forEach(function(n2){ if(n2 === zb) return; if(!reachPossible(team, n2)) return;
      var v = LOOK.nbrW * beliefZoneKnown(team, n2); if(PW[nn+","+n2]) v *= LOOK.watchedNbr; th += v; });
    var rwn = reachW(team, nn, zb);
    th += LOOK.reachW * rwn + (rwn > 0 ? LOOK.uncheckW * uncheckedW(team, nn) : 0);
    if(th <= 0) return;
    var c = p;
    // (v151) не середина прохода, а место, где враг из этой зоны реально появится
    if(BAL.cornerAim){ var ap = appearPoint(b, nn); if(ap){ c = ap; d = Math.hypot(ap.x-b.x, ap.y-b.y); } }
    if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(hasLOS(b.x, b.y, ext.x, ext.y)) c = ext; }
    var za = Math.atan2(c.y-b.y, c.x-b.x), fresh = freshThreatNear(team, p);
    var sc = th * LOOK.entryExp / (1 + Math.max(d,200)/(moving ? LOOK.distMove : LOOK.distHold));
    var behind = moving ? _angOff(za, b.heading) > 1.9 : (atHold && postA !== null && _angOff(za, postA) > 2.2);
    if(d < LOOK.closeR && !behind) sc *= LOOK.closeK;
    if(fresh) sc *= LOOK.freshK;
    if(postA !== null && _angOff(za, postA) < 0.9) sc *= LOOK.postK;
    if(moving){ var hd = _angOff(za, b.heading); if(hd < 0.9) sc *= LOOK.headK; else if(hd > 1.9 && !fresh) sc *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; }
    else if(behind && !fresh) sc *= LOOK.behindHold;
    if(!fresh && mates.some(function(o){ return Math.hypot(o.x-p.x, o.y-p.y) < 140; })) sc *= LOOK.mateThere;
    out.push({j:1000+nn, pt:c, sc:sc, fresh:fresh, a:za});
  });
  // свежий контакт рядом: услышал шаги/выстрел или только что видел — в упор это
  // главнее всего, даже если враг в той же зоне, что и бот
  var cts = [];
  // у контакта — имя врага (а не клетка, где он сейчас): враг сдвинулся — это
  // тот же контакт, и инерция взгляда работает, а не «новый угол» каждые 80 px
  var hs = b.heardSound; if(hs && tick - hs.tick <= 96) cts.push({x:hs.x, y:hs.y, age:tick-hs.tick, id:hs.src && hs.src !== "?" ? hs.src : null});
  var BLc = beliefLast[team] || {};
  for(var eid in BLc){ var lo = BLc[eid]; if(tick - lo.tick > 96) continue;
    var eb = bots.filter(function(o){ return o.id === eid; })[0]; if(!eb || !eb.alive) continue; cts.push({x:lo.x, y:lo.y, age:tick-lo.tick, id:eid}); }
  cts.forEach(function(q){
    var d = Math.hypot(q.x-b.x, q.y-b.y); if(d > 700 || d < 20) return;
    var za = Math.atan2(q.y-b.y, q.x-b.x);
    // на бегу за спину — только на самый свежий и близкий
    if(moving && _angOff(za, b.heading) > 1.9 && (q.age > 20 || d > 250)) return;
    var pt = cornerLook(b, q) || (BAL.noWallLook ? appearFrom(b, q) : q);
    if(!pt) return;
    out.push({j:q.id ? "snd:"+q.id : "snd"+Math.round(q.x/80)+","+Math.round(q.y/80), pt:pt, sc:LOOK.contactW * (d < 300 ? 2 : 1) / (1 + d/700) * (1 - q.age/192), fresh:true, a:za, snd:true});
  });
  // (v176) сбор на ретейк: угроза — T на сайте с бомбой; смотрим туда, где T с
  // сайта появится на пути к нам (выход с сайта), а не на точку бомбы за стеной.
  // Тот, кто смотрит в спину на люрк (backWatch), — по обычным угрозам
  var RT = bomb && bomb.state === "planted" && bomb.retake;
  if(team === "CT" && RT && (RT.phase === "gather" || RT.phase === "util") && b.post && /^gather/.test(b.post.tag||"") && RT.backWatch !== b.id){
    var rz = {}, zb0 = bzOf(bomb.x, bomb.y); if(zb0 >= 0) rz[zb0] = 1;
    BZ.cent.forEach(function(c, i){ if(c && Math.hypot(c.x-bomb.x, c.y-bomb.y) <= 380) rz[i] = 1; });
    Object.keys(rz).forEach(function(is){ var ap = appearPoint(b, +is); if(!ap) return;
      var d = Math.hypot(ap.x-b.x, ap.y-b.y); if(d < 50 || d > LOOK.maxDist) return;
      var c = ap; if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(hasLOS(b.x, b.y, ext.x, ext.y)) c = ext; }
      out.push({j:"rt"+is, pt:c, sc:LOOK.retakeW/(1 + d/LOOK.distHold), fresh:false, a:Math.atan2(c.y-b.y, c.x-b.x), rt:true}); });
  }
  // угол поста — только когда реальной угрозы нет совсем (запасной вариант):
  // не соперник угрозам, а "куда смотреть, если смотреть некуда"
  if(atHold && !out.some(function(c){ return c.sc >= LOOK.minScore; })){ var pl = cornerLook(b, b.post.look) || b.post.look;
    // (v149) точку взгляда поста отсюда не видно (стоит на краю поста, за углом) —
    // cornerLook вёл "по пути к ней", часто назад; берём видимый проход к врагу
    if(BAL.enemyward && !hasLOS(b.x, b.y, b.post.look.x, b.post.look.y)){ var ew0 = enemywardLook(team, b); if(ew0) pl = ew0; }
    // (v149) угол поста смотрит в тыл (заданная точка оказалась в своём коридоре) —
    // берём видимый проход, откуда враг придёт раньше всего
    if(BAL.enemyward){ var zpl = bzOf(pl.x, pl.y), zbb = bzOf(b.x, b.y);
      if(zpl >= 0 && zbb >= 0 && zpl !== zbb && isRearZone(team, zbb, zpl) || Math.hypot(pl.x-b.x, pl.y-b.y) < 60){ var ew = enemywardLook(team, b); if(ew) pl = cornerLook(b, ew) || ew; } }
    out.push({j:"post"+b.id, pt:pl, sc:LOOK.postBase, fresh:false, a:Math.atan2(pl.y-b.y, pl.x-b.x), post:true}); }
  // все кандидаты уже видимые (точка выбирается только с линией видимости)
  return out;
}
// раз в 8 тиков: кандидаты всем + делёж направлений внутри команды
function lookPlan(team){
  PORTAL_W[team] = portalWatched(team);
  var W = PORTAL_W[team];
  var list = bots.filter(function(b){ return b.alive && b.team === team && !b._sawEnemy; });
  list.forEach(function(b){
    b._lkC = lookCands(b, W);
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
    if(!(BAL.claimStrong && bestC.sc < LOOK.claimMin)) left.forEach(function(o){ if(Math.hypot(o.x-bestB.x, o.y-bestB.y) > LOOK.claimR) return;
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
    b._lkTop = b._lkC.slice().sort(function(x, y){ return y.sc - x.sc; }).slice(0, 3).map(function(c){ var nm = c.snd ? "звук/контакт" : c.post ? "свой угол (угроз нет)" : c.rt ? "выход с сайта (ретейк)" : c.j >= 1000 ? "выход из " + (ZONE_NAMES[BZ.ids[c.j-1000]] || BZ.ids[c.j-1000]) : (ZONE_NAMES[BZ.ids[c.j]] || BZ.ids[c.j]); return [nm, c.sc]; });
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


