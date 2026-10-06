// ======================= РАЗДЕЛ 11: командная информация (коллы) =======================
// Любое событие восприятия одного бота становится общим сигналом команды:
//   spotted  — вижу врага (точная позиция, уверенность 1.0)
//   carrier  — вижу носителя бомбы (отдельный, более приоритетный тип)
//   sound    — слышу шаги/стрельбу (пятно, уверенность 0.4)
//   died     — погиб тиммейт (где, и откуда стреляли, если было видно)
// Командная память держит сигналы ~12с и отвечает на вопросы "сколько врагов
// рядом с точкой и насколько мы уверены" — число берётся по разным врагам,
// которых видели, а по звуку — по числу РАЗНЫХ источников шагов почти
// одновременно (несколько звуков из одной зоны = "стак", а не "один человек").
// Остальные боты реагируют, не дожидаясь личного контакта: CT ротируются,
// бот рядом с погибшим идёт на трейд и смотрит туда, откуда стреляли, в
// одиночку не лезут туда, где стак, T посреди раунда могут перепривязать
// тактику на другой сайт.
var teamIntel = { CT:{sig:[], carrier:null}, T:{sig:[], carrier:null} };
var INTEL_KEEP = 12*64;
// ---- коллы с задержкой (раздел: инфа как у людей) ----
// Увидел/услышал один — тиммейты узнают не в тот же тик, а когда он это
// скажет: через 0.3–0.9с, с погрешностью в позиции. В замесе (много коллов
// за секунду) эфир забит: задержка больше, часть звуковой инфы теряется.
var commQueue = [];
function commSend(team, sig, by){
  // увиденный враг в CS2 сразу появляется на радаре у всей команды — точка
  // без задержки. Задерживается только то, что надо СКАЗАТЬ голосом: звук
  if(sig.type === "spotted"){ intelPush(team, sig); return; }
  // "замес" — за последнюю секунду в эфире инфа про 3+ разных врагов
  var ids = {}; commQueue.forEach(function(q){ if(q.team === team && tick - q.sent < TICK_HZ) ids[q.sig.id] = 1; });
  var busy = Object.keys(ids).length >= 3;
  var hs = tick*41 + (by ? by.charCodeAt(by.length-1)*13 : 7) + (sig.id ? String(sig.id).charCodeAt(String(sig.id).length-1)*3 : 0);
  if(busy && sig.type === "sound" && hashRand(hs+5) < 0.35) return; // не успел сказать — потерялось
  var delay = 20 + Math.round(hashRand(hs)*38) + (busy ? 20 : 0);
  var nx = (hashRand(hs+11)-0.5)*(sig.type === "spotted" ? 50 : 30), ny = (hashRand(hs+17)-0.5)*(sig.type === "spotted" ? 50 : 30);
  var s2 = {}; for(var k in sig) s2[k] = sig[k]; s2.x += nx; s2.y += ny;
  commQueue.push({team:team, sig:s2, sent:tick, at:tick + delay});
}
function commFlush(){
  if(!commQueue.length) return;
  var keep = [];
  commQueue.forEach(function(q){ if(q.at <= tick){ if(roundState === "live") intelPush(q.team, q.sig); } else keep.push(q); });
  commQueue = keep;
}
function resetTeamIntel(){ commQueue = []; teamIntel = { CT:{sig:[], carrier:null, lastCall:{}}, T:{sig:[], carrier:null, lastCall:{}} }; }
resetTeamIntel();
function intelPush(team, sig){ sig.tick = tick; teamIntel[team].sig.push(sig); if(typeof beliefObserve === "function") beliefObserve(team, sig);
  if(BAL.buyRead && sig.type === "spotted" && sig.id && sig.id !== "?") buyReadSee(team, sig.id); }
// ---- КАРТИНА КОМАНДЫ: единственное знание о врагах ----
// belief (где вероятно каждый враг, по зонам) + beliefLast (последнее реальное
// наблюдение по каждому врагу) + LAST_CLEAR/REACH (что проверено, куда враг мог
// успеть). Вход — только общий канал (intelPush). Здесь — чтение «кому из
// последних наблюдений ещё верить» (раньше — отдельное хранилище ЛИП) и
// «проверили — пусто». Инфа не испаряется по таймеру: ей перестают верить,
// только когда враг убит, карта вероятностей увела его от точки, или свой
// посмотрел на это место и там пусто.
var _picCache = {CT:null, T:null, t:-1};
function picKnown(team){
  if(_picCache.t !== tick){ _picCache = {CT:null, T:null, t:tick}; }
  if(_picCache[team]) return _picCache[team];
  var L = beliefLast[team] || {}, out = {};
  for(var id in L){ var e = L[id]; if(e.gone) continue;
    var foe = botById(id); if(!foe || !foe.alive) continue;
    if(tick - e.tick >= 3*TICK_HZ && beliefMassNear(team, id, e.x, e.y, 260) < 0.12) continue;
    out[id] = e; }
  return (_picCache[team] = out);
}
// лента событий картины: смерти, фраги, звуки, «вижу» — по порядку, за ~12 с
// (пишет только общий канал intelPush). Читать события — только отсюда.
function picEvents(team){ return teamIntel[team].sig; }
function picNear(team, x, y, r){ var n = 0, S = beliefSeen[team]; Object.keys(belief[team]).forEach(function(eid){ if(S[eid] != null && beliefMassNear(team, eid, x, y, r) >= 0.35) n++; }); return n; }
// свежие наблюдения команды: [{id,x,y,tick,src}] не старше maxAge тиков
function picRecent(team, maxAge){ var L = beliefLast[team] || {}, out = [];
  for(var id in L){ var e = L[id]; if(tick - e.tick > maxAge) continue; var foe = botById(id); if(!foe || !foe.alive) continue; out.push({id:id, x:e.x, y:e.y, tick:e.tick, src:e.src}); }
  return out; }
// по картине команды у точки врагов заметно больше, чем своих рядом (на 2+):
// лезть туда в одиночку — умереть зря (размен в стак, добивание под 4 ствола)
function picOutnumbered(team, x, y, except){
  var foes = picNear(team, x, y, 450);
  var mine = bots.filter(function(o){ return o.alive && o.team === team && o !== except && Math.hypot(o.x-x, o.y-y) < 700; }).length + (except ? 1 : 0);
  return foes >= mine + 2;
}
function botById(id){ for(var i=0;i<bots.length;i++) if(bots[i].id === id) return bots[i]; return null; }
// свой посмотрел на место последнего наблюдения — там пусто: перестаём верить
function picCheckTick(){
  if(roundState !== "live" || tick % 16) return;
  ["CT","T"].forEach(function(team){
    var K = picKnown(team);
    Object.keys(K).forEach(function(id){
      var e = K[id], foe = botById(id);
      if(tick - e.tick < 3*TICK_HZ) return;
      var checker = bots.filter(function(b){ return b.alive && b.team === team && Math.hypot(b.x-e.x, b.y-e.y) < 550 &&
        hasVision(b.x, b.y, e.x, e.y) && inFov(b, e.x, e.y) && b._visible.indexOf(foe) < 0; })[0];
      if(checker){
        e.gone = tick; _picCache[team] = null;
        beliefClearAt(team, e.x, e.y, id);
        voiceLog(team, "clr"+id, checker.id, "проверил "+calloutName(e.x, e.y)+" — "+id+" там уже нет");
      }
    });
  });
}
function teamInfoTick(){
  if(roundState !== "live") return;
  commFlush();
  bots.forEach(function(b){
    if(!b.alive) return;
    // вижу
    var LS = teamIntel[b.team].lastSpot || (teamIntel[b.team].lastSpot = {});
    (b._visible||[]).forEach(function(e){
      // один и тот же враг — не чаще раза в 8 тиков на команду (память не раздувается)
      if(!(LS[e.id] && tick - LS[e.id] < 8)){ LS[e.id] = tick;
        // сам видит — знает сразу (lastIntel), команда — через колл
        commSend(b.team, {type:"spotted", x:e.x, y:e.y, id:e.id, by:b.id, conf:1}, b.id);
        if(e.curSpeed < 30 && bomb.state !== "planted") habitAdd(e.id, e.x, e.y, 0.125); }
      if(bomb && bomb.state === "carried" && bomb.carrier === e){
        var prevCar = teamIntel[b.team].carrier;
        if(!prevCar || tick - prevCar.tick > 5*64)
          voiceLog(b.team, "bomb", b.id, "бомба у "+e.id+" "+calloutName(e.x, e.y)+"!");
        teamIntel[b.team].carrier = {x:e.x, y:e.y, tick:tick, by:b.id};
      }
    });
    // слышу (только свежие события этого тика)
    if(b.heardSound && b.heardSound.tick === tick && b.heardSound.team !== b.team &&
       !(LS["snd"+b.heardSound.src] && tick - LS["snd"+b.heardSound.src] < 8)){
      LS["snd"+b.heardSound.src] = tick;
      commSend(b.team, {type:"sound", x:b.heardSound.x, y:b.heardSound.y, id:b.heardSound.src||"?", kind:b.heardSound.kind||"", by:b.id, conf:0.4}, b.id);
    }
  });
  ["CT","T"].forEach(function(t){
    var TI = teamIntel[t];
    TI.sig = TI.sig.filter(function(s){ return tick - s.tick < INTEL_KEEP; });
    if(TI.carrier && tick - TI.carrier.tick > INTEL_KEEP) TI.carrier = null;
  });
}
// сколько врагов команда "знает" рядом с точкой за последние windowTicks
function intelEstimate(team, x, y, r, windowTicks){
  // из картины команды: враг "здесь", пока его вероятность рядом ≥0.35 —
  // не "пока не прошло N секунд". seen/heard — было ли РЕАЛЬНОЕ наблюдение
  // здесь за окно (для решений "видели недавно")
  var B = belief[team], S = beliefSeen[team], L = beliefLast[team], n = 0, sN = 0, hN = 0, cf = 0, ls = -1;
  Object.keys(B).forEach(function(eid){
    if(S[eid] == null) return;
    if(beliefMassNear(team, eid, x, y, r) < 0.35) return;
    n++;
    var lo = L[eid];
    if(lo && tick - lo.tick <= windowTicks && Math.hypot(lo.x-x, lo.y-y) <= r){
      if(lo.src === "spotted"){ sN++; cf = 1; } else { hN++; cf = Math.max(cf, 0.5); }
      ls = Math.max(ls, lo.tick);
    } else cf = Math.max(cf, 0.3);
  });
  return {n: n, seen: sN, heard: hN, conf: cf, last: ls};
}
function intelDeathsNear(team, x, y, r, windowTicks){
  return picEvents(team).filter(function(s){ return s.type === "died" && tick - s.tick <= windowTicks && Math.hypot(s.x-x, s.y-y) < r; }).length;
}
// смерть тиммейта — сигнал для всех + реакция ближних: трейд
// ---- названия зон (редактируются кликом по зоне при включённом слое «зоны») ----
// ZONE_NAMES_BAKED — зашитые в код (присланные через «Экспорт проекта»);
// поверх — правки из этого браузера. Игровая логика опирается на id зон,
// названия только для людей: войс, лог, подписи на карте.
var ZONE_NAMES_BAKED = @@DATA:zone_names.json@@; // из «Экспорт проекта» (сентябрь 2026)
var ZONE_NAMES_KEY = "ancient-live-radar-zonenames-v1";
var ZONE_NAMES = {};
(function(){ for(var k in ZONE_NAMES_BAKED) ZONE_NAMES[k] = ZONE_NAMES_BAKED[k];
  try{ var raw = JSON.parse(localStorage.getItem(ZONE_NAMES_KEY)||"null"); if(raw && typeof raw === "object") for(var k2 in raw){ if(raw[k2]) ZONE_NAMES[k2] = String(raw[k2]).slice(0,32); else delete ZONE_NAMES[k2]; } }catch(e){}
})();
function saveZoneNames(){ try{ localStorage.setItem(ZONE_NAMES_KEY, JSON.stringify(ZONE_NAMES)); }catch(e){} }
var ZONE_DEFAULT_LABEL = {Asite:"сайт A", Bsite:"сайт B", CTspawn:"CT-спавн", Tspawn:"T-спавн"};
function zoneById(id){ for(var i=0;i<ZONEMAP.zones.length;i++) if(ZONEMAP.zones[i].id === id) return ZONEMAP.zones[i]; return null; }
// название для людей: своё → стандартное (сайт/спавн) → null
// "Red Room / Red" — первое название основное (его видно на карте и в войсе),
// остальные — варианты для поиска зон по названию из тактик
function zoneMainName(raw){ return raw ? String(raw).split("/")[0].trim() : raw; }
var ZONE_SYNONYMS = { "red":"red room", "connector":"red room", "b ramp":"ramp", "site a":"a site", "site b":"b site",
  "b main":"t lower", "a long":"long", "mid doors":"mid", "window":"triple", "cat":"triple", "heaven":"t upper",
  "excavation":"lamp room", "house":"cave", "pit":"jungle", "back alley":"back halls", "ninja":"bonger", "candle":"main hall" };
function normZoneName(n){ n = String(n||"").toLowerCase().replace(/\s+/g," ").trim(); return ZONE_SYNONYMS[n] || n; }
function zoneAliases(id){ var raw = ZONE_NAMES[id]; if(!raw) return []; return String(raw).split("/").map(normZoneName); }
var _zbnCache = {};
function zonesByName(name){
  var key = normZoneName(name);
  if(_zbnCache[key]) return _zbnCache[key];
  var out = ZONEMAP.zones.filter(function(z){ return zoneAliases(z.id).indexOf(key) >= 0 && (BZ.nbr[BZ.idx[z.id]]||[]).length; }).map(function(z){ return z.id; });
  _zbnCache[key] = out; return out;
}
// точка зоны с таким названием (из нескольких одноимённых — ближайшая к near)
function zonePoint(name, near){
  var ids = zonesByName(name); if(!ids.length) return null;
  var best = null, bd = Infinity;
  ids.forEach(function(id){ var c = BZ.cent[BZ.idx[id]]; var d = near ? Math.hypot(c.x-near.x, c.y-near.y) : 0; if(d < bd){ bd = d; best = c; } });
  return best ? walk(best) : null;
}
function zoneUserName(id){ if(ZONE_NAMES[id]) return zoneMainName(ZONE_NAMES[id]); var z = zoneById(id); return z && z.name ? (ZONE_DEFAULT_LABEL[z.name]||z.name) : null; }
function zoneLabel(id){ return zoneUserName(id) || id; }
function zoneIdAt(x, y){ for(var i=0;i<ZONEMAP.zones.length;i++){ if(pointInPoly(x, y, ZONEMAP.zones[i].points)) return ZONEMAP.zones[i].id; } return null; }
// ---- "войс" (как тимспик): короткие коллы, которые слышит вся команда ----
// где это на карте — простыми словами, по ближайшей известной точке
// from=true — "откуда" (с A), иначе "где" (на A)
function calloutName(x, y, from){
  var zid = zoneIdAt(x, y), zn = zid && zoneMainName(ZONE_NAMES[zid]);
  if(zn) return (from ? "с «" : "на «") + zn + "»";
  var C = [[SITES.A,"на A","с A"],[SITES.B,"на B","с B"],
           [GEO.A&&GEO.A.tEntry,"у входа на A","со входа на A"],[GEO.B&&GEO.B.tEntry,"у входа на B","со входа на B"],
           [GEO.A&&GEO.A.tStage,"на подходе к A","с подхода к A"],[GEO.B&&GEO.B.tStage,"на подходе к B","с подхода к B"],
           [GEO.ctMid,"на миде","с мида"],[GEO.tMid,"на миде со стороны T","с мида со стороны T"],
           [GEO.rotator,"на проходе между сайтами","с прохода между сайтами"],
           [CT_SPAWN,"на CT-спавне","с CT-спавна"],[T_SPAWN,"на T-спавне","с T-спавна"]];
  var best = null, bd = Infinity;
  C.forEach(function(c){ if(!c[0]) return; var d = Math.hypot(c[0].x-x, c[0].y-y); if(d < bd){ bd = d; best = c; } });
  return best ? best[from ? 2 : 1] : "?";
}
function voiceLog(team, key, who, text){ intelCallLog(team, "v:"+key, "[войс "+team+"] "+who+": "+text); }
function aliveCount(team){ return bots.filter(function(b){ return b.team===team && b.alive; }).length; }
// (10) память между раундами: откуда стрелял AWP CT, где CT агрессивно
// пикнули на стороне T, какой сайт T рашили, где рано умирал мидер CT
// зона на "стороне T": до неё от спавна T ближе, чем от спавна CT (агрессия CT)
function tSideZone(x, y){
  var z = bzOf(x, y); if(z < 0) return false;
  ["CT","T"].forEach(function(t){ if(!ED_CACHE[t]){ var sp = t === "CT" ? T_SPAWN : CT_SPAWN, z0 = bzOf(sp.x, sp.y); ED_CACHE[t] = bzDist(z0 >= 0 ? [z0] : []); } });
  return ED_CACHE.CT[z] < ED_CACHE.T[z] * 0.95;   // ED_CACHE.CT — от спавна T
}
function rmemRecent(list, rounds){ return list.filter(function(e){ return roundNum - e.round <= rounds && e.round < roundNum; }); }
function intelDeath(victim, killer){
  if(!victim || roundState !== "live") return;
  if(BAL.roundMem && killer){
    var secR = (tick - roundStartTick)/TICK_HZ;
    if(killer.team === "CT" && victim.team === "T" && secR < 30 && tSideZone(killer.x, killer.y))
      MEMORY.RMEM.aggro.push({x:killer.x, y:killer.y, round:roundNum, id:killer.id});
    if(victim.team === "CT" && victim.tRole === "mid" && secR < 30) MEMORY.RMEM.midDeath.push({round:roundNum});
    ["aggro","midDeath"].forEach(function(k){ if(MEMORY.RMEM[k].length > 12) MEMORY.RMEM[k].shift(); });
  }
  var saw = killer && hasVision(victim.x, victim.y, killer.x, killer.y);
  intelPush(victim.team, {type:"died", x:victim.x, y:victim.y, id:victim.id, conf:1, kx: saw ? killer.x : null, ky: saw ? killer.y : null});
  if(saw) intelPush(victim.team, {type:"spotted", x:killer.x, y:killer.y, id:killer.id, by:victim.id, conf:1});
  else if(killer){
    // не видел, кто убил, но по попаданиям/звуку выстрела понятно, откуда
    // стреляли — примерно (±~90px), как "убили откуда-то с ..." в войсе
    var jx = (hashRand(tick*31 + (victim.id.charCodeAt(victim.id.length-1)||0)) - 0.5) * 180;
    var jy = (hashRand(tick*57 + 7) - 0.5) * 180;
    intelPush(victim.team, {type:"sound", x:killer.x+jx, y:killer.y+jy, id:killer.id, by:victim.id, kind:"shot", conf:0.6});
  }
  var place = calloutName(victim.x, victim.y);
  var mine = aliveCount(victim.team), theirs = aliveCount(victim.team === "CT" ? "T" : "CT");
  voiceLog(victim.team, "die"+victim.id, victim.id, "минус "+place+
    (killer ? (saw ? ", убил "+killer.id+" "+calloutName(killer.x, killer.y, true) : ", стреляли "+calloutName(killer.x, killer.y, true)) : "")+
    " — нас "+mine+" против "+theirs);
  if(mine === 1 && theirs >= 2){
    var last = bots.filter(function(o){ return o.team === victim.team && o.alive; })[0];
    if(last) voiceLog(victim.team, "clutch", last.id, "я один против "+theirs+" — "+
      (victim.team === "CT" && bomb && bomb.state !== "planted" ? "тяну время, беру по одному" :
       victim.team === "T" && bomb && bomb.state === "planted" ? "сижу у бомбы, жду дефуз" : "беру по одному"));
  }
  // команда убийцы тоже "знает", где и кого сняли (свой же игрок сказал "минус ...")
  if(killer) intelPush(killer.team, {type:"kill", x:victim.x, y:victim.y, id:victim.id, role:victim.tRole, by:killer.id, conf:1});
  if(victim.team === "T" && !(bomb && bomb.state === "planted")) tDeathAdd(victim);
  // журнал смертей для IGL: кто, где, в какой фазе, откуда стреляли, разменяли ли
  if(teamTac.T && bomb && bomb.state !== "planted"){
    var TTd = teamTac.T; TTd._dl = TTd._dl || [];
    if(victim.team === "T"){
      var kx0 = killer ? (saw ? killer.x : killer.x + (hashRand(tick*17+3)-0.5)*160) : null, ky0 = killer ? (saw ? killer.y : killer.y + (hashRand(tick*19+5)-0.5)*160) : null;
      TTd._dl.push({t:"T", tick:tick, x:victim.x, y:victim.y, kx:kx0, ky:ky0, kid:killer ? killer.id : null, role:victim.tRole, phase:TTd.phase, traded:false});
    } else {
      TTd._dl.push({t:"CT", tick:tick, x:victim.x, y:victim.y, phase:TTd.phase});
      // CT умер в течение 3с после нашей смерти от ЕГО же руки / рядом — наш размен
      TTd._dl.forEach(function(e){ if(e.t === "T" && !e.traded && tick - e.tick < 3*TICK_HZ && (e.kid === victim.id || Math.hypot(e.x-victim.x, e.y-victim.y) < 600)) e.traded = true; });
    }
  }
  if((victim.curSpeed||0) < 40 && !(bomb && bomb.state === "planted")) habitAdd(victim.id, victim.x, victim.y, 1);
  // ---- размен как рефлекс (про-уровень: тиммейт умер рядом — ближайший
  // сразу выходит на убийцу, пока тот перезаряжается/меняет позицию; это
  // срывает бота с тактики на ~3.5с). Разменивают 1–2 ближайших ПО ПУТИ.
  var traders = [];
  if(BAL.tradeReflex && killer && killer.alive){
    var kp = saw ? {x:killer.x, y:killer.y} : {x:killer.x + (hashRand(tick*31 + 5)-0.5)*160, y:killer.y + (hashRand(tick*57 + 9)-0.5)*160};
    var cands = [];
    bots.forEach(function(o){
      if(!o.alive || o.team !== victim.team || o === victim || o.planting || o.defusing || o._sawEnemy) return;
      if(BAL.bombCarrier && bomb && bomb.state === "carried" && bomb.carrier === o && aliveCount(o.team) >= 3) return; // носитель не бежит менять — бомба не должна умереть на входе
      // (v154) снайпер и лёркер T в дефолте на размен не срываются: у про их роль — держать свою линию
      if(BAL.duelValue && !(bomb && bomb.state === "planted") && ((o.weapon && o.weapon.key === "AWP") || (o.team === "T" && o.tRole === "lurker" && teamTac.T && teamTac.T.phase === "setup"))) return;
      if(Math.hypot(o.x-victim.x, o.y-victim.y) > 700) return;
      var L = polyLen(pathPts(o.x, o.y, victim.x, victim.y));
      if(L <= 480) cands.push({b:o, L:L});
    });
    cands.sort(function(a, c){ return a.L - c.L; });
    // по картине у убийцы стак, а нас тут один-два — не размен, а смерть следом
    if(cands[0] && picOutnumbered(victim.team, kp.x, kp.y, cands[0].b)) cands = [];
    if(cands[0]) traders.push(cands[0]);
    if(cands[1] && cands[1].L <= (BAL.groupPlay ? 450 : 350) && aliveCount(victim.team) >= 3) traders.push(cands[1]);
    traders.forEach(function(T, k){
      var o = T.b;
      if(BAL.execErr && o.prof && hashRand(tick*29 + o.id.charCodeAt(1)*11) < (1-prof(o, "disc"))*0.12){ noteMistake(o, "не разменял "+victim.id); return; }
      // выходит НЕ в ту же точку, где умер тиммейт (туда у убийцы уже стоит
      // прицел), а под другим углом — чтобы тому пришлось доводить прицел
      var swC = pickSpots("tradeR"+tick+o.id, {x:victim.x, y:victim.y}, 5, {rMax:170, minGap:30, see:[kp]});
      var aV = Math.atan2(victim.y-kp.y, victim.x-kp.x), sw = null, sBest = -1;
      swC.forEach(function(q){ var da = Math.abs(((Math.atan2(q.y-kp.y, q.x-kp.x)-aV+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        var sc = Math.min(da, 0.8) - Math.hypot(q.x-o.x, q.y-o.y)/1500; if(sc > sBest){ sBest = sc; sw = q; } });
      sw = sw || {x:victim.x, y:victim.y};
      o._route = null; 
      setPost(o, sw, kp, true, "tradeR");
      holdTask(o, "tradeR", tick + Math.round(3.5*TICK_HZ), {at:{x:victim.x, y:victim.y}, kp:kp});
      o._tradeUntil = tick + Math.round(3.5*TICK_HZ);
      if(k === 0) voiceLog(o.team, "trade"+victim.id, o.id, "меняю "+victim.id+"!");
    });
  }
  // IGL: энтри сняли на выходе — вторая волна не пикает тот же угол "в лоб":
  // ближайший с флешкой кидает поп-флешку на убийцу, размен идёт под неё
  if(BAL.iglReplan && victim.team === "T" && killer && killer.alive && teamTac.T && teamTac.T.phase === "execute" &&
     (victim.tRole === "entry" || !teamTac.T._popDone)){
    var kpF = {x:killer.x + (saw ? 0 : (hashRand(tick*23+1)-0.5)*140), y:killer.y + (saw ? 0 : (hashRand(tick*29+2)-0.5)*140)};
    var flc = bots.filter(function(o){ return o.alive && o.team === "T" && o !== victim && o.nades && o.nades.flash > 0 && !o.planting &&
      !(bomb.state === "carried" && bomb.carrier === o) && Math.hypot(o.x-victim.x, o.y-victim.y) < 750; })
      .sort(function(a, c){ var ta = traders.some(function(T){ return T.b === a; }) ? 200 : 0, tc = traders.some(function(T){ return T.b === c; }) ? 200 : 0;
        return (Math.hypot(a.x-victim.x, a.y-victim.y) + ta) - (Math.hypot(c.x-victim.x, c.y-victim.y) + tc); })[0];
    if(flc && assignNade(flc, "flash", kpF, "поп на убийцу "+victim.id, {now:true, range:900})){
      teamTac.T._popDone = true;
      voiceLog("T", "pop"+victim.id, flc.id, "даю флешку на "+killer.id+" "+calloutName(kpF.x, kpF.y)+" — меняйте под неё!");
      // размен ждёт хлопка (не дольше ~1.2с): не выбегает раньше флешки
      traders.forEach(function(T){ T.b._waitPopUntil = tick + Math.round(1.2*TICK_HZ); T.b._waitPopKey = "pop:поп на убийцу "+victim.id; });
    }
  }
  bots.forEach(function(b){
    if(!b.alive || b.team !== victim.team) return;
    if(traders.some(function(T){ return T.b === b; })) return;
    var d = Math.hypot(b.x-victim.x, b.y-victim.y);
    if(d > 550) return;
    // размен уже взял ближайший — остальные не лезут в тот же прострелянный угол
    if(BAL.tradeReflex && traders.length){ b._avoidPeekUntil = tick + 8*TICK_HZ; b._avoidPeekAt = {x:victim.x, y:victim.y}; return; }
    // "меня убили отсюда" — ближние тиммейты смотрят туда и идут разменивать
    if(BAL.execErr && b.prof && hashRand(tick*29 + b.id.charCodeAt(1)*11) < (1-prof(b, "disc"))*0.12){ noteMistake(b, "не разменял "+victim.id); return; }
    // стрелка не видели и он не рядом — это не трейд, а второй пик в тот же
    // прострелянный угол: не лезть туда же ~8с (держать, ждать, обходить)
    if(!saw || (killer && Math.hypot(killer.x-b.x, killer.y-b.y) > 650)){
      b._avoidPeekUntil = tick + 8*TICK_HZ; b._avoidPeekAt = {x:victim.x, y:victim.y};
      return;
    }
    b._tradeUntil = tick + 150;
  });
}
// лог коллов — не спамить: раз в 4с на команду+зону
function intelCallLog(team, key, text){
  var L = teamIntel[team].lastCall;
  if(L[key] && tick - L[key] < 4*64) return;
  L[key] = tick; logEvent(text);
}


// ======================= РАЗДЕЛ 13: КАРТА ВЕРОЯТНОСТЕЙ ВРАГА =======================
// Для каждой команды и КАЖДОГО врага отдельно — распределение "где он может
// быть" по ~60 зонам карты (ZONEMAP). Это то, что в голове у игрока: "одного
// видели на А 10с назад — он уже мог дойти до мида или до Б, но не до КТ-спавна,
// потому что оттуда смотрит наш тиммейт".
//  • Движение: раз в 0.25с вероятность перетекает в соседние зоны (враг бежит).
//  • Видимость своих = отрицательная информация: зона, на которую смотрит
//    живой тиммейт и где врага НЕ видно, почти обнуляется, и масса уходит в
//    зоны, которые никто не видит ("там, где он быть не может, не ищем").
//  • Вижу / слышу / бросок гранаты — вероятность стягивается в эту зону.
//  • Погиб тиммейт, а стрелявшего не видели — масса растекается в зоны,
//    ОТКУДА простреливается место смерти (таблица опасности раздела 2).
//  • Убитый враг из карты убирается; в начале раунда враг — на своём спавне.
// Отсюда считаются: сколько врагов вероятно у сайта (колл и число ротирующих),
// куда смотреть, стоя на посту, и не открыта ли точка под два опасных угла.
var BZ = {ids:[], idx:{}, nbr:[], cent:[], grid:{}, siteZ:{A:[],B:[]}, midZ:[]};
function beliefBuild(){
  BZ.ids = ZONEMAP.zones.map(function(z){ return z.id; });
  BZ.idx = {}; BZ.ids.forEach(function(id,i){ BZ.idx[id] = i; });
  BZ.nbr = BZ.ids.map(function(){ return []; });
  ZONEMAP.portals.forEach(function(p){
    var a = BZ.idx[p.a], b = BZ.idx[p.b]; if(a === undefined || b === undefined || a === b) return;
    if(BZ.nbr[a].indexOf(b) < 0) BZ.nbr[a].push(b);
    if(BZ.nbr[b].indexOf(a) < 0) BZ.nbr[b].push(a);
  });
  BZ.cent = BZ.ids.map(function(id){ return ZONE_CENTROIDS[id]; });
  BZ.grid = {};
  ["A","B"].forEach(function(k){
    BZ.siteZ[k] = [];
    if(!SITES[k]) return;
    BZ.cent.forEach(function(c,i){ if(Math.hypot(c.x-SITES[k].x, c.y-SITES[k].y) < 240 || bzOf(SITES[k].x, SITES[k].y) === i) BZ.siteZ[k].push(i); });
    BZ.siteNear = BZ.siteNear || {}; BZ.siteNear[k] = [];
    BZ.cent.forEach(function(c,i){ if(Math.hypot(c.x-SITES[k].x, c.y-SITES[k].y) < 400) BZ.siteNear[k].push(i); });
  });
  BZ.midZ = [];
  if(GEO.ctMid) BZ.cent.forEach(function(c,i){ if(Math.hypot(c.x-GEO.ctMid.x, c.y-GEO.ctMid.y) < 260) BZ.midZ.push(i); });
  // модель движения врага — не случайное блуждание, а "идут к цели": потенциал
  // зоны = путь по графу до ближайшей цели. T идут к сайтам; CT — к сайтам и миду
  // (занимают позиции). Вероятность перетекает "под горку" быстрее, чем обратно.
  var sinksT = [], sinksCT = [];
  ["A","B"].forEach(function(k){ if(SITES[k]){ var z = bzOf(SITES[k].x, SITES[k].y); if(z >= 0){ sinksT.push(z); sinksCT.push(z); } } });
  if(GEO.ctMid){ var zm = bzOf(GEO.ctMid.x, GEO.ctMid.y); if(zm >= 0) sinksCT.push(zm); }
  BZ.potT = bzDist(sinksT); BZ.potCT = bzDist(sinksCT);
  BZ.DT = null; if(typeof OUTWARD_CACHE !== "undefined") OUTWARD_CACHE = {};
}
function bzDist(src){
  var n = BZ.ids.length, D = new Float32Array(n).fill(1e9), done = new Uint8Array(n);
  src.forEach(function(i){ D[i] = 0; });
  for(var it=0; it<n; it++){
    var u = -1, bd = 1e9;
    for(var i=0;i<n;i++) if(!done[i] && D[i] < bd){ bd = D[i]; u = i; }
    if(u < 0) break; done[u] = 1;
    BZ.nbr[u].forEach(function(v){ var w = Math.hypot(BZ.cent[u].x-BZ.cent[v].x, BZ.cent[u].y-BZ.cent[v].y); if(D[u]+w < D[v]) D[v] = D[u]+w; });
  }
  return D;
}
function bzOf(x, y){
  var k = (x>>4)+","+(y>>4);
  if(k in BZ.grid) return BZ.grid[k];
  var best = -1, bd = Infinity;
  for(var i=0;i<ZONEMAP.zones.length;i++){
    var z = ZONEMAP.zones[i];
    if(pointInPoly(x, y, z.points)){ best = i; break; }
    var c = BZ.cent[i]; if(!c) continue;
    var d = Math.hypot(c.x-x, c.y-y); if(d < bd){ bd = d; best = i; }
  }
  BZ.grid[k] = best;
  return best;
}
var belief = {CT:{}, T:{}};
function beliefReset(){
  if(!BZ.ids.length) beliefBuild();
  var n = BZ.ids.length;
  beliefSeen = {CT:{}, T:{}}; beliefLast = {CT:{}, T:{}}; LAST_CLEAR = {CT:{}, T:{}};
  reachReset();
  bots.forEach(function(o){ o._tLookZ = null; o._tLook = null; o._tLookT = null; o._lkZ = null; o._lkPt = null; o._lkC = null; o._lkTop = null; });
  ["CT","T"].forEach(function(team){
    belief[team] = {};
    bots.forEach(function(e){
      if(e.team === team) return;
      var P = new Float32Array(n), sp = e.team === "CT" ? CT_SPAWN : T_SPAWN, zi = bzOf(sp.x, sp.y);
      if(zi >= 0) P[zi] = 1; belief[team][e.id] = P;
    });
  });
}
var beliefSeen = {CT:{}, T:{}}; // когда по этому врагу последний раз была реальная инфа
// ЕДИНОЕ хранилище инфы о врагах: belief (где вероятно каждый враг, по зонам) +
// beliefLast (последнее реальное наблюдение: точка, когда, видели/слышали).
// Всё остальное — "последняя позиция" (ЛИП), "проверено — пусто", оценка
// "сколько их тут" — теперь только ЧИТАЕТ отсюда и ПИШЕТ сюда, а не хранит
// свою отдельную копию: раньше пять копий расходились между собой
var beliefLast = {CT:{}, T:{}};
// ---- тайминги (как думают про): "видел там 10с назад — сейчас может быть уже здесь" ----
// REACH[team][зона] = самый ранний тик, когда там МОЖЕТ оказаться враг: от его
// спавна бегом; зона, в которую свои сейчас смотрят и там пусто, снова
// "закрыта" и откроется, только когда враг успел бы добежать из соседней
// открытой зоны; увиденный/услышанный враг открывает свою зону сразу.
// Это не вероятность "сколько их", а честное "может ли тут кто-то быть".
var REACH = {CT:null, T:null};
function reachReset(){
  if(!BZ.ids.length) return;
  var n = BZ.ids.length;
  ["CT","T"].forEach(function(team){
    var sp = team === "CT" ? T_SPAWN : CT_SPAWN, z = bzOf(sp.x, sp.y);
    var D = bzDist(z >= 0 ? [z] : []), R = new Float64Array(n);
    for(var i=0;i<n;i++) R[i] = roundStartTick + D[i]/SPEED*TICK_HZ;
    REACH[team] = R;
  });
}
function reachOpen(team, x, y){ var R = REACH[team]; if(!R) return; var zi = bzOf(x, y); if(zi >= 0) R[zi] = Math.min(R[zi], tick); }
function reachPossible(team, i){ var R = REACH[team]; return !R || R[i] <= tick; }
function reachStep(team, clearList){
  var R = REACH[team]; if(!R) return;
  clearList.forEach(function(cz){ if(cz[1] >= 0.5) R[cz[0]] = Math.max(R[cz[0]], tick + BELIEF_STEP + 1); });
  if(BAL.reachBlock){
    // (фото) раньше "куда враг мог успеть" считалось один раз от спавна по
    // свободной карте — и зоны за живым мидером считались достижимыми, хотя
    // пройти туда можно только через него. Теперь каждый шаг: закрытые зоны
    // пересчитываются от открытых, а зона, которую держит/видит свой, — стена:
    // через неё путь не идёт, пока её не "откроет" контакт или уход своего
    var n = R.length, fixed = new Uint8Array(n), D = new Float64Array(n);
    clearList.forEach(function(cz){ if(cz[1] >= 0.5) fixed[cz[0]] = 1; });
    for(var i0=0;i0<n;i0++) D[i0] = (R[i0] <= tick || fixed[i0]) ? R[i0] : Infinity;
    var done = new Uint8Array(n);
    for(var it0=0; it0<n; it0++){
      var u = -1, bd = Infinity;
      for(var i1=0;i1<n;i1++) if(!done[i1] && D[i1] < bd){ bd = D[i1]; u = i1; }
      if(u < 0) break; done[u] = 1;
      if(fixed[u] && R[u] > tick) continue; // держат свои — дальше через неё не пройти
      var nbu = BZ.nbr[u], cu = BZ.cent[u]; if(!cu) continue;
      for(var k0=0;k0<nbu.length;k0++){ var v = nbu[k0], cv = BZ.cent[v]; if(!cv || done[v] || fixed[v] || R[v] <= tick) continue;
        var tv = D[u] + Math.hypot(cu.x-cv.x, cu.y-cv.y)/SPEED*TICK_HZ; if(tv < D[v]) D[v] = tv; }
    }
    for(var i2=0;i2<n;i2++) if(R[i2] > tick && !fixed[i2]) R[i2] = D[i2];
    return;
  }
  for(var it=0; it<3; it++){
    for(var i=0;i<R.length;i++){
      var nb = BZ.nbr[i], ci = BZ.cent[i]; if(!ci) continue;
      for(var k=0;k<nb.length;k++){ var j = nb[k], cj = BZ.cent[j]; if(!cj) continue;
        var t = R[j] + Math.hypot(ci.x-cj.x, ci.y-cj.y)/SPEED*TICK_HZ;
        if(t < R[i]) R[i] = t; }
    }
  }
}
function beliefMassNear(team, eid, x, y, r){
  var P = belief[team] && belief[team][eid]; if(!P) return 0;
  var t = 0, z0 = bzOf(x, y);
  for(var i=0;i<P.length;i++){ if(!P[i]) continue; var c = BZ.cent[i]; if(i === z0 || (c && Math.hypot(c.x-x, c.y-y) <= r)) t += P[i]; }
  return t;
}
// "проверили — пусто": стираем вероятность врага в этой зоне (и в хранилище)
function beliefClearAt(team, x, y, eidOnly){
  var zi = bzOf(x, y); if(zi < 0 || !belief[team]) return;
  Object.keys(belief[team]).forEach(function(eid){ if(eidOnly && eid !== eidOnly) return; belief[team][eid][zi] *= 0.08; });
}
function beliefSet(team, eid, zi, w){
  var P = belief[team] && belief[team][eid]; if(!P || zi < 0) return;
  beliefSeen[team][eid] = tick;
  for(var i=0;i<P.length;i++) P[i] *= (1-w);
  P[zi] += w;
}
// вызывается из intelPush — каждое событие восприятия сразу правит карту
function beliefObserve(team, sg){
  if(!BZ.ids.length) return;
  if((sg.type === "spotted" || sg.type === "sound") && sg.id && sg.id !== "?"){
    reachOpen(team, sg.x, sg.y);
    var bl = beliefLast[team][sg.id];
    if(!(bl && bl.src === "spotted" && sg.type === "sound" && tick - bl.tick < 2*TICK_HZ)){
      var zn = calloutName(sg.x, sg.y);
      // в войс — только когда инфа НОВАЯ: впервые засветился или перешёл в другую зону
      if(!bl || bl.gone || bl.zn !== zn){ var foe = botById(sg.id);
        intelCallLog(team, "lkp"+sg.id, "[войс "+team+"] инфа: " + sg.id + (foe && foe.primary === "AWP" ? " с AWP" : "") + " — " + zn + (sg.type === "sound" ? " (слышно)" : " (видели)") + (bl && !bl.gone ? ", был " + bl.zn : "")); }
      beliefLast[team][sg.id] = {x:sg.x, y:sg.y, tick:tick, src:sg.type, zn:zn};
    }
  }
  if(sg.type === "spotted") beliefSet(team, sg.id, bzOf(sg.x, sg.y), 1);
  else if(sg.type === "sound") beliefSet(team, sg.id, bzOf(sg.x, sg.y), sg.kind === "nade" ? 0.8 : 0.65);
  else if(sg.type === "died" && sg.kx == null){
    // стрелявшего не видели: он в одной из зон, откуда простреливается место смерти
    var dz = bzOf(sg.x, sg.y); if(dz < 0) return;
    var from = ZONE_DANGER[BZ.ids[dz]] || [], Wd = ZONE_DANGER_W[BZ.ids[dz]] || {};
    var add = new Float32Array(BZ.ids.length), tot = 0;
    from.forEach(function(zid){
      var j = BZ.idx[zid]; if(j === undefined) return;
      var d = Math.hypot(BZ.cent[j].x-sg.x, BZ.cent[j].y-sg.y);
      var w = (Wd[zid]||0.1) / (1 + d/400); add[j] += w; tot += w;
    });
    if(tot <= 0) return;
    Object.keys(belief[team]).forEach(function(eid){
      var P = belief[team][eid];
      for(var i=0;i<P.length;i++) P[i] = P[i]*0.7 + 0.3*add[i]/tot;
    });
  }
}
var BELIEF_STEP = 16; // тиков (0.25с)
function beliefTick(){
  if(roundState !== "live" || tick % BELIEF_STEP !== 0 || !BZ.ids.length) return;
  // средний переход между зонами ~160px ≈ 1с бегом; враг в среднем не бежит всё
  // время по прямой (стоит, чекает углы) — берём ~половину скорости
  var n = BZ.ids.length, m = 0.12;
  ["CT","T"].forEach(function(team){
    var B = belief[team];
    var PWb = PORTAL_W[team] = portalWatched(team);
    Object.keys(B).forEach(function(eid){
      var e = bots.filter(function(o){ return o.id === eid; })[0];
      if(!e || !e.alive){ delete B[eid]; return; } // смерть врага видна в киллфиде
      var P = B[eid], Q = new Float32Array(n), pot = e.team === "T" ? BZ.potT : BZ.potCT;
      // (v144) цель CT после планта — бомба (ретейк), а не "свои позиции"
      if(BAL.ppBelief !== false && e.team === "CT" && bomb && bomb.state === "planted"){
        // CT сначала собираются у входа на сайт со своей стороны, оттуда заходят
        var ge = GEO[bomb.site] && GEO[bomb.site].ctEntry, bzB = ge ? bzOf(ge.x, ge.y) : bzOf(bomb.x, bomb.y);
        if(BAL.ppSinkBomb) bzB = bzOf(bomb.x, bomb.y);
        if(!BZ.potBomb || BZ.potBomb.z !== bzB){ BZ.potBomb = {z:bzB, D: bzDist(bzB >= 0 ? [bzB] : [])}; }
        pot = BZ.potBomb.D;
      }
      for(var i=0;i<n;i++){
        var nb = BZ.nbr[i], deg = nb.length;
        if(!deg || P[i] < 1e-7){ Q[i] += P[i]; continue; }
        // веса соседей: к цели (потенциал ниже) — охотнее, от цели — реже
        var ws = 0, wl = [];
        for(var k=0;k<deg;k++){ var dp = pot[nb[k]] - pot[i]; var w = Math.exp(-Math.max(-2.5, Math.min(2.5, dp/140))); wl.push(w); ws += w; }
        // у самой цели (все соседи "в гору") — чаще остаются на месте: заняли позицию
        var go = m * Math.min(1.3, ws/deg);
        Q[i] += P[i]*(1-go);
        for(var k2=0;k2<deg;k2++){
          // (v141) враг не может незаметно пройти через проход, который видит свой:
          // эта доля вероятности просто исчезает (прошёл бы — его бы увидели)
          if(PWb[i+","+nb[k2]]) continue;
          Q[nb[k2]] += P[i]*go*wl[k2]/ws; }
      }
      B[eid] = Q;
    });
    // отрицательная информация: что видят живые тиммейты — там врага нет
    var clearAll = [];
    bots.forEach(function(b){
      if(!b.alive || b.team !== team) return;
      var zb = bzOf(b.x, b.y); if(zb < 0) return;
      var seenIds = {}; (b._visible||[]).forEach(function(e){ seenIds[e.id] = true; });
      var clear = [[zb, 0.92]];
      var W = ZONE_DANGER_W[BZ.ids[zb]] || {};
      (ZONE_DANGER[BZ.ids[zb]]||[]).forEach(function(zid){
        var j = BZ.idx[zid]; if(j === undefined) return;
        var c = BZ.cent[j], d = Math.hypot(c.x-b.x, c.y-b.y);
        if(d > CONE_R*1.4) return;
        if(!inFov(b, c.x, c.y) && d > FOV_NEAR*2) return;
        clear.push([j, Math.min(0.9, 0.35 + 0.9*(W[zid]||0))]);
      });
      Object.keys(B).forEach(function(eid){
        if(seenIds[eid]) return;
        var P = B[eid];
        clear.forEach(function(cz){ P[cz[0]] *= (1-cz[1]); });
      });
      // зона, где сейчас стоит видимый враг, не "закрывается"
      if(!(b._visible||[]).length) clearAll.push.apply(clearAll, clear);
    });
    reachStep(team, clearAll);
    var CLT = LAST_CLEAR[team] || (LAST_CLEAR[team] = {}); clearAll.forEach(function(cz){ if(cz[1] >= 0.5) CLT[cz[0]] = tick; });
    if(BAL.reachBlock && REACH[team]){ var RR = REACH[team];
      Object.keys(B).forEach(function(eid){ var P = B[eid]; for(var i4=0;i4<n;i4++) if(RR[i4] > tick) P[i4] *= 0.5; }); }
    Object.keys(B).forEach(function(eid){
      var P = B[eid], sum = 0;
      for(var i=0;i<n;i++) sum += P[i];
      if(sum < 1e-6){
        // вся инфа противоречит — не "везде поровну" (тогда и в проверенных
        // тупиках снова появлялся враг), а только там, куда враг мог дойти и
        // что сейчас никто не видит
        var clr = {}; clearAll.forEach(function(cz){ if(cz[1] >= 0.5) clr[cz[0]] = 1; });
        var pot = (bots.filter(function(o){ return o.id === eid; })[0]||{}).team === "T" ? BZ.potT : BZ.potCT, s2 = 0;
        for(var i5=0;i5<n;i5++){ P[i5] = (!clr[i5] && reachPossible(team, i5)) ? Math.exp(-pot[i5]/600) : 0; s2 += P[i5]; }
        if(s2 <= 0){ for(var i6=0;i6<n;i6++) P[i6] = 1/n; } else for(var i7=0;i7<n;i7++) P[i7] /= s2;
      }
      else if(sum < 1e-6){ for(var i2=0;i2<n;i2++) P[i2] = 1/n; }
      else for(var i3=0;i3<n;i3++) P[i3] /= sum;
    });
  });
}
// сколько врагов команда ожидает в наборе зон (сумма по всем живым врагам)
function beliefMass(team, zoneList){
  var B = belief[team], tot = 0;
  Object.keys(B).forEach(function(eid){ var P = B[eid]; zoneList.forEach(function(i){ tot += P[i]; }); });
  return tot;
}
// "сколько их там" для колла: враги, по которым была свежая инфа (≤10с), —
// всей своей вероятностью; остальные ("куда-то идут") — только малой долей,
// иначе априорный дрейф к сайтам сам по себе раздувал бы колл до 3-4
function beliefCount(team, zoneList){
  var B = belief[team], tot = 0;
  Object.keys(B).forEach(function(eid){
    var P = B[eid], pe = 0; zoneList.forEach(function(i){ pe += P[i]; });
    var fresh = tick - (beliefSeen[team][eid] == null ? -1e9 : beliefSeen[team][eid]) < 10*TICK_HZ;
    tot += fresh ? pe : 0.25*pe;
  });
  return tot;
}
// как beliefZone, но дисконтирует "чистый прогноз" (никогда/давно не видели
// этого врага живьём) — иначе идле-боты стоят пред-прицелившись точно в
// статистически вероятную клетку так, будто реально знают, где враг, хотя
// это просто "скорее всего туда пошёл" без единого реального контакта
function beliefZoneFresh(team, i){
  var B = belief[team], seen = beliefSeen[team], t = 0;
  Object.keys(B).forEach(function(eid){
    var fresh = tick - (seen[eid] == null ? -1e9 : seen[eid]) < 10*TICK_HZ;
    t += B[eid][i] * (fresh ? 1 : 0.3);
  });
  return t;
}
