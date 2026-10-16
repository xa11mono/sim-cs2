// ======================= ЗВУК: направление, стены, новые источники =======================
// Как слышит человек в CS2: НАПРАВЛЕНИЕ понятно довольно точно (±5–7°), дистанция —
// примерно (±15%). Через стену звук глуше: слышно ближе, направление расплывается
// (±15–20°), дистанция гуляет сильнее (±30%). Раньше услышанная точка = реальная
// + случайный сдвиг в ЛЮБУЮ сторону, одинаковый для открытого места и стен.
function hearPos(o, sx, sy, seed, occl){
  if(!BAL.soundDir) return null;
  var d = Math.hypot(sx-o.x, sy-o.y), a = Math.atan2(sy-o.y, sx-o.x);
  var sa = occl ? 0.30 : 0.10, sd = occl ? 0.30 : 0.15;
  var ra = hashRand(seed) + hashRand(seed*7+3) - 1;       // треугольное −1…1: чаще около нуля
  var rd = hashRand(seed*13+5) + hashRand(seed*17+11) - 1;
  var pd = Math.max(20, d*(1 + rd*sd)), pa = a + ra*sa;
  return {x:o.x + Math.cos(pa)*pd, y:o.y + Math.sin(pa)*pd};
}
var WATER_Z = {};
function inWater(x, y){
  var zid = zoneIdAt(x, y); if(!zid) return false;
  if(!(zid in WATER_Z)) WATER_Z[zid] = !!(MAP.zones.props[zid] && MAP.zones.props[zid].water);   // свойство зоны из набора карты
  return WATER_Z[zid];
}
// один звук для всех врагов в радиусе: по прямой слышно дальше, через стену — ближе
function emitSound(src, x, y, rOpen, rWall, kind, seed){
  var heard = [];
  bots.forEach(function(o){
    if(!o.alive || o.team === src.team) return;
    var d = Math.hypot(o.x-x, o.y-y); if(d > rOpen) return;
    var occl = !hasLOS(o.x, o.y, x, y); if(occl && d > rWall) return;
    var p = hearPos(o, x, y, seed + (o.id.charCodeAt(o.id.length-1)||0)*131, occl) || {x:x, y:y};
    o.heardSound = hearReal(o, {x:p.x, y:p.y, tick:tick, team:src.team, src:src.id, kind:kind, occl:occl});
    heard.push(o);
  });
  return heard;
}
// услышал перезарядку — окно, пока у врага пустой магазин: держащий рядом
// выглядывает на него (у про — классика "он перезаряжается, пушу")
function reloadHeard(b, w){
  var hs = emitSound(b, b.x, b.y, 380, 220, "reload", tick*29 + (b.id.charCodeAt(b.id.length-1)||0)*7);
  hs.forEach(function(o){
    o._heardReload = {id:b.id, x:o.heardSound.x, y:o.heardSound.y, until:b.reloadUntil};
    if(!o._rlVoice || o._rlVoice + 3*TICK_HZ < tick){ o._rlVoice = tick; voiceLog(o.team, "rl"+b.id, o.id, b.id+" перезаряжается "+calloutName(o.heardSound.x, o.heardSound.y)+"!"); }
    // по голосу знают и ближние тиммейты
    bots.forEach(function(m){ if(m !== o && m.alive && m.team === o.team && Math.hypot(m.x-o.x, m.y-o.y) < 500) m._heardReload = o._heardReload; });
  });
}
// пик на перезарядку: держит угол рядом (≤450), сам не в бою, HP > 50 —
// коротко выходит на линию, откуда видно место звука. Агрессивные — чаще.
function reloadPeek(b){
  var R = b._heardReload;
  if(!BAL.soundMore || !R || tick >= R.until || b._sawEnemy || b.planting || b.defusing || b.hp <= 50) return false;
  if(b._rlPeekDone === R.until) return false;
  var d = Math.hypot(R.x-b.x, R.y-b.y); if(d > 450 || d < 60) return false;
  b._rlPeekDone = R.until;
  var downN = BAL.numbersPlay && aliveCount(b.team) < aliveCount(b.team === "CT" ? "T" : "CT");
  if(hashRand(tick*43 + (b.id.charCodeAt(b.id.length-1)||0)*3) > (0.35 + 0.5*prof(b, "aggr"))*(downN ? 0.5 : 1)) return false;
  var sp = pickSpots("rlpeek"+tick+b.id, {x:b.x, y:b.y}, 2, {rMax:140, minGap:40, see:[{x:R.x, y:R.y}]})[0];
  if(!sp) return false;
  b._reposUntil = 0; b._probeLock = 0;
  setPost(b, sp, {x:R.x, y:R.y}, true, "repos:reload");
  if(!b.post || b.post.tag !== "repos:reload") return false;
  b._reposUntil = Math.min(R.until + 32, tick + 3*TICK_HZ);
  logEvent(b.id+": пикает на перезарядку "+R.id);
  return true;
}
// ---- пас бомбы ----
// Про не носят бомбу тем, кто лезет первым или ходит в одиночку: лёркер и
// энтри отдают её тому, кто рядом из основной группы; раненый носитель (≤30 HP)
// рядом со здоровым тиммейтом тоже отдаёт — бомба не должна умереть с ним.
function bombPassTick(){
  if(!BAL.bombPass || tick % 16 || bomb.state !== "carried" || !teamTac.T) return;
  var c = bomb.carrier; if(!c || !c.alive || c.planting || c._sawEnemy) return;
  var tt = teamTac.T, ts = bots.filter(function(b){ return b.team === "T" && b.alive && b !== c; });
  if(!ts.length || tt.phase === "postplant") return;
  var why = null, pool = null;
  if((c.tRole === "lurker" || c.tRole === "entry") && tt.phase === "setup" && ts.length >= 2){
    pool = ts.filter(function(b){ return b.tRole !== "lurker" && b.tRole !== "entry" && b.tRole !== "awp" && b.hp > 50; }); why = c.tRole === "lurker" ? "лёркер" : "энтри";
  } else if(c.hp <= 30){
    pool = ts.filter(function(b){ return b.hp > 60; }); why = "у меня "+c.hp+" HP";
  }
  if(!pool || !pool.length) return;
  var to = pool.filter(function(b){ return Math.hypot(b.x-c.x, b.y-c.y) < 180 && !b._sawEnemy; })
    .sort(function(a, b2){ return Math.hypot(a.x-c.x, a.y-c.y) - Math.hypot(b2.x-c.x, b2.y-c.y); })[0];
  if(!to || c._passTried === roundNum+"|"+to.id) return;
  c._passTried = roundNum+"|"+to.id;
  // бросает под ноги тиммейту — тот подбирает (как дроп в CS)
  bomb.state = "dropped"; bomb.carrier = null; bomb.x = to.baseX; bomb.y = to.baseY;
  tt.fetchId = to.id;
  voiceLog("T", "pass"+c.id, c.id, "отдаю бомбу "+to.id+" ("+why+")");
  logEvent(c.id+" отдал бомбу → "+to.id);
}
// ---- (S1) добить раненого ----
function finishPush(b){
  if(!BAL.hurtCall || b._sawEnemy || b.planting || b.defusing || b.hp <= 50 || tick < (b._finNext||0)) return;
  if(!taskCanSet(b, "repos:finish")) return;   // (v378) идёт по задаче не ниже — арбитр места
  if(bomb && bomb.state === "carried" && bomb.carrier === b) return;
  if((b.team === "CT" && teamTac.CT && teamTac.CT.saving) || (b.team === "T" && teamTac.T && teamTac.T.saving)) return;
  var HT = teamIntel[b.team].hurt; if(!HT) return;
  b._finNext = tick + 16;
  var BL = beliefLast[b.team] || {}, tgt = null, tid = null;
  for(var eid in HT){ var h = HT[eid]; if(h.hp > 35 || tick - h.tick > 8*TICK_HZ) continue;
    var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive) continue;
    var lo = BL[eid]; if(!lo || tick - lo.tick > 4*TICK_HZ || Math.hypot(lo.x-b.x, lo.y-b.y) > 600) continue;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.post && o.post.tag === "repos:finish" && o._finId === eid; })) continue; // уже идёт другой
    tgt = lo; tid = eid; break; }
  if(!tgt) return;
  var sp = pickSpots("finish"+tick+b.id, {x:b.x, y:b.y}, 2, {rMax:200, minGap:40, see:[{x:tgt.x, y:tgt.y}]})[0];
  if(!sp) return;
  b._reposUntil = 0; b._probeLock = 0;
  setPost(b, sp, {x:tgt.x, y:tgt.y}, true, "repos:finish");
  if(!b.post || b.post.tag !== "repos:finish") return;
  b._finId = tid; b._reposUntil = tick + 3*TICK_HZ; b.lastIntel = {x:tgt.x, y:tgt.y, tick:tick, src:"call"};
  voiceLog(b.team, "fin"+tid+b.id, b.id, tid+" на "+HT[tid].hp+" — добиваю");
}
// ---- (S7) смок уходит — готовность к выходу из-за него ----
function smokeFadeTick(){
  if(!BAL.smokeFade || tick % 8) return;
  smokes.forEach(function(sm){
    var left = sm.until - tick; if(left > 2.5*TICK_HZ || left <= 0) return;
    sm._fadeReady = sm._fadeReady || {};
    bots.forEach(function(b){
      if(!b.alive || b._sawEnemy || sm._fadeReady[b.id]) return;
      var d = Math.hypot(b.x-sm.x, b.y-sm.y); if(d > 550 || d < NADE.smoke.radius) return;
      if(!hasLOS(b.x, b.y, sm.x, sm.y)) return;
      // враг вероятно за дымом: свежая инфа за ним (дальше центра от нас)
      var BL = beliefLast[b.team] || {}, far = null;
      for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick > 10*TICK_HZ) continue; if(Math.hypot(lo.x-sm.x, lo.y-sm.y) < 450 && Math.hypot(lo.x-b.x, lo.y-b.y) > d){ far = lo; break; } }
      if(!far) return;
      sm._fadeReady[b.id] = 1;
      var a = Math.atan2(sm.y-b.y, sm.x-b.x), ex = {x: sm.x + Math.cos(a)*NADE.smoke.radius, y: sm.y + Math.sin(a)*NADE.smoke.radius};
      b.lastIntel = {x:ex.x, y:ex.y, tick:tick, src:"call"}; // прицел на выход из дыма — префайр, если выйдет
      b.heardSound = {x:ex.x, y:ex.y, tick:tick, team:b.team === "CT" ? "T" : "CT", src:"?", kind:"call"};
      if(!sm._fadeVoice){ sm._fadeVoice = 1; voiceLog(b.team, "fade"+Math.round(sm.x)+b.team, b.id, "смок уходит — готовы, они за ним"); }
    });
  });
}
// ---- (S3) смок на засвеченного AWP ----
var awpSmokeCd = {CT:0, T:0};
function awpSmokeTick(){
  if(!BAL.awpSmoke || tick % 16) return;
  ["CT","T"].forEach(function(team){
    if(tick < awpSmokeCd[team]) return;
    var BL = beliefLast[team] || {};
    for(var eid in BL){ var lo = BL[eid]; if(lo.src !== "spotted" || tick - lo.tick > 8*TICK_HZ) continue;
      var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive || e.primary !== "AWP") continue;
      var ap = {x:lo.x, y:lo.y};
      var th = bots.filter(function(b){ return b.alive && b.team === team && b.nades && b.nades.smoke > 0 && !b.nadeTask && !b._sawEnemy && b.post &&
        Math.hypot(b.post.x-ap.x, b.post.y-ap.y) > 300 && Math.hypot(b.post.x-ap.x, b.post.y-ap.y) < 1500 && hasLOS(b.post.x, b.post.y, ap.x, ap.y); })
        .sort(function(a, c){ return Math.hypot(a.x-ap.x, a.y-ap.y) - Math.hypot(c.x-ap.x, c.y-ap.y); })[0];
      if(!th) continue;
      var sp = {x: ap.x + (th.post.x-ap.x)*0.35, y: ap.y + (th.post.y-ap.y)*0.35};
      if(Math.hypot(sp.x-th.x, sp.y-th.y) > NADE_THROW_RANGE*1.1 || smokeCovered(sp.x, sp.y)) continue;
      if(assignNade(th, "smoke", sp, "смок на AWP "+eid, {now:true})){ awpSmokeCd[team] = tick + 15*TICK_HZ;
        voiceLog(team, "awps"+eid, th.id, "AWP "+calloutName(ap.x, ap.y)+" — даю смок на его линию"); return; }
    }
  });
}
// ---- ослеплён: не идти дальше вслепую ----
// Про, поймав флешку, не продолжает бежать: отходит на шаг-два назад за угол
// (туда, откуда пришёл — там безопасно) или, если некуда, встаёт/садится и
// держит направление, откуда шёл враг, пока не прозреет.
function onBlind(b, threat){
  if(b.planting || b.defusing) return;
  var back = null, tr = b._trail || [];
  for(var i = tr.length-1; i >= 0; i--){ var q = tr[i]; if(Math.hypot(q.x-b.baseX, q.y-b.baseY) < 40) continue; if(Math.hypot(q.x-b.baseX, q.y-b.baseY) > 220) break;
    if(!hasLOS(q.x, q.y, threat.x, threat.y)){ back = q; break; } }
  b._blind = {until:b.blindUntil, back:back, face:{x:threat.x, y:threat.y}};
  if(back){ b.path = [[back.x, back.y, b.z]]; b.pathIdx = 0; }
  logEvent(b.id+": ослеплён — "+(back ? "отходит за угол" : "присел, держит направление"));
  // (S2) тиммейт рядом закрывает угол ослеплённого: смотрит туда и готов стрелять
  if(BAL.coverBlind){
    var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && !o._sawEnemy && tick >= (o.blindUntil||0) && Math.hypot(o.x-b.x, o.y-b.y) < 260 && !o.planting && !o.defusing; });
    mates.forEach(function(o){ o.heardSound = {x:threat.x, y:threat.y, tick:tick, team:b.team === "CT" ? "T" : "CT", src:"?", kind:"call"}; o.lastIntel = {x:threat.x, y:threat.y, tick:tick, src:"call"}; });
    var cov = mates.filter(function(o){ return o.hp > 50 && !(o.post && /^(defuse|plantspot|lineup|flee|save|tradeR)/.test(o.post.tag)); })
      .sort(function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); })[0];
    if(cov){
      var cs = BAL.coverFix
        // (v151) раньше точка бралась вплотную к ослеплённому — а он в это время
        // отходит по тому же проходу: оба упирались друг в друга и дёргались.
        // Теперь: если угол и так видно — стоим и целимся; иначе шаг рядом с собой,
        // не ближе ~1м к слепому и к точке, куда он отходит
        ? (hasLOS(cov.x, cov.y, threat.x, threat.y) ? null : pickSpots("covblind"+tick+cov.id, {x:cov.x, y:cov.y}, 3, {rMax:130, minGap:24, see:[threat]})
            .filter(function(q){ return hasLOS(q.x, q.y, threat.x, threat.y) && Math.hypot(q.x-b.x, q.y-b.y) > 60 && !(back && Math.hypot(q.x-back.x, q.y-back.y) < 60); })[0])
        : pickSpots("covblind"+tick+cov.id, {x:b.baseX, y:b.baseY}, 2, {rMax:110, minGap:24, see:[threat]})
        .filter(function(q){ return hasLOS(q.x, q.y, threat.x, threat.y); })[0];
      if(BAL.coverFix && !cs){ cov._coverDir = {pt:{x:threat.x, y:threat.y}, until:b.blindUntil}; voiceLog(b.team, "cb"+b.id+tick, cov.id, "держу угол за "+b.id); }
      if(cs){ cov._reposUntil = 0; setPost(cov, cs, threat, true, "repos:coverblind"); if(cov.post && cov.post.tag === "repos:coverblind"){ cov._reposUntil = tick + Math.max(2*TICK_HZ, b.blindUntil - tick); voiceLog(b.team, "cb"+b.id, cov.id, b.id+" слепой — держу его угол"); } }
    }
  }
}
// ---- кончились патроны в бою: пистолет ----
function pistolSwap(b){
  if(!BAL.pistolSwap || !b.primary || !b.secondary || b._onPistol || b.weapon !== WEAPONS[b.primary]) return false;
  var e = b._nearestEnemyBot, near = e && e.alive && Math.hypot(e.x-b.x, e.y-b.y) < 650;
  if(!near && !(b.lastIntel && tick - b.lastIntel.tick < TICK_HZ && Math.hypot(b.lastIntel.x-b.x, b.lastIntel.y-b.y) < 650)) return false;
  var W = WEAPONS[b.secondary];
  b._onPistol = {prim:b.primary, ammo:Math.max(0, b.ammo||0)};
  b.weapon = W; b._ammoFor = W.key; b.ammo = b._secAmmo != null ? b._secAmmo : W.mag; b._reloading = false; b.reloadUntil = 0;
  b.nextShotTick = Math.max(b.nextShotTick||0, tick + 14); // ~0.2с достать пистолет
  b.burstCount = 0;
  logEvent(b.id+": кончились патроны — на пистолет ("+W.name+")");
  return true;
}
function pistolBack(b){
  if(!b._onPistol || b._sawEnemy || tick - (b.lastShotTick||-999) < 96) return;
  if(b.primary !== b._onPistol.prim){ b._onPistol = null; return; }
  b._secAmmo = b.ammo;
  var W = WEAPONS[b.primary];
  b.weapon = W; b._ammoFor = W.key; b.ammo = b._onPistol.ammo; b._reloading = false; b.reloadUntil = 0;
  b._onPistol = null;
}
// ---- стрейф в дальней дуэли (ADAD) ----
// Пистолетом (и винтовкой на большой дистанции) про не стоят столбом: шаг в
// сторону → контр-страф → выстрел → шаг в другую сторону. Двигаясь, в него
// труднее попасть (см. трекинг), а стреляет он только остановившись.
