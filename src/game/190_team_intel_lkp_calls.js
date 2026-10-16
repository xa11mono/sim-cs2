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
// (v242) радар: увиденный врага сразу точкой у всей команды (CS2). Всё, что надо СКАЗАТЬ, — войс (teamChannel)
function commSend(team, sig, by){ intelPush(team, sig); }
function resetTeamIntel(){ if(typeof lkpReset === "function") lkpReset(); teamIntel = { CT:{sig:[], carrier:null, lastCall:{}}, T:{sig:[], carrier:null, lastCall:{}} }; }
resetTeamIntel();
function intelPush(team, sig){ sig.tick = tick; teamIntel[team].sig.push(sig); if(typeof beliefObserve === "function") beliefObserve(team, sig);
  if(BAL.buyRead && sig.type === "spotted" && sig.id && sig.id !== "?") buyReadSee(team, sig.id);
  if((sig.type === "spotted" || sig.type === "sound") && sig.id && sig.id !== "?") lkpSet(team, sig.id, sig.x, sig.y, sig.type); }
// ---- последняя известная позиция (ЛИП) каждого врага ----
// Инфа не "испаряется" через несколько секунд: где врага последний раз видели/
// слышали — там он и считается, пока её не обновят: увидели/услышали в другом
// месте, убили его, или кто-то из своих посмотрел на это место и там пусто
// ("проверили — никого"). Кто не обновляет инфу — играет по старой.
// (v373, этап 4 плана владельца: один источник знаний о врагах) раньше было два хранилища «где враг последний раз»: beliefLast и
// beliefLast — писались из одних и тех же сигналов, но beliefLast стирал метку, когда свои проверили место и там пусто, а beliefLast
// держал. Правила читали кто то, кто другое: одни видели пусто, другие — старую метку (сторож: «пустое чтение» в ctBrain,
// подборе оружия). Теперь хранилище одно — beliefLast; проверка места и «ушёл по карте вероятностей» (lkpTick) стирают в нём
function lkpReset(){ if(typeof CLEARZ !== "undefined") CLEARZ = {CT:{}, T:{}}; }
function lkpSet(team, id, x, y, src){ var e = beliefLast[team][id]; if(e && src === "sound" && e.src === "spotted" && tick - e.tick < 2*TICK_HZ) return;
  beliefLast[team][id] = {x:x, y:y, tick:tick, src:src};
  var zi = zoneIdAt(x, y); if(zi && CLEARZ[team][zi]) delete CLEARZ[team][zi]; }
function lkpTick(){
  if(roundState !== "live" || tick % 16) return;
  ["CT","T"].forEach(function(team){
    var L = beliefLast[team];
    Object.keys(L).forEach(function(id){
      var e = L[id], foe = bots.filter(function(o){ return o.id === id; })[0];
      if(!foe || !foe.alive){ delete L[id]; return; }
      if(tick - e.tick < 3*TICK_HZ) return;
      // единое хранилище: если по карте вероятностей врага у этой точки уже
      // нет (ушёл/вычистили взглядом) — метка ЛИП тоже снимается, без своей логики
      if(BAL.oneStore && BZ.ids.length && beliefMassNear(team, id, e.x, e.y, 260) < 0.12){ delete L[id]; return; }
      // кто-то из своих смотрит на это место (в поле зрения, есть линия) и его там нет
      var checker = bots.filter(function(b){ return b.alive && b.team === team && Math.hypot(b.x-e.x, b.y-e.y) < 550 &&
        hasVision(b.x, b.y, e.x, e.y) && inFov(b, e.x, e.y) && b._visible.indexOf(foe) < 0; })[0];
      if(checker){
        delete L[id]; var zc = zoneIdAt(e.x, e.y); if(zc) CLEARZ[team][zc] = {tick:tick, x:e.x, y:e.y};
        knowClearZone(team, e.x, e.y, id);
        voiceLog(team, "clr"+id, checker.id, "проверил "+calloutName(e.x, e.y)+" — "+id+" там уже нет");
      }
    });
  });
}
function lkpNear(team, x, y, r){
  if(BAL.oneStore && BZ.ids.length && belief[team]){ var n1 = 0, S = beliefSeen[team]; Object.keys(belief[team]).forEach(function(eid){ if(S[eid] != null && beliefMassNear(team, eid, x, y, r) >= 0.35) n1++; }); return n1; }
  var n = 0, L = beliefLast[team]; for(var id in L){ if(Math.hypot(L[id].x-x, L[id].y-y) < r) n++; } return n; }
// взгляд без свежей инфы: на угол, за которым последняя известная позиция врага
// Раньше брали просто БЛИЖАЙШУЮ позицию — и бот смотрел на старую инфу про
// одного CT у Cave, хотя 5 секунд назад двое убили троих его тиммейтов на
// миде. Теперь свежесть весит: каждая секунда давности = +40px "расстояния".
// maxAgeT — вариант "только свежая угроза" (выше плана/преэйма в приоритете)
function lkpLook(b, maxAgeT){
  var L = beliefLast[b.team], best = null, bs = Infinity, rMax = maxAgeT ? 850 : 750;
  for(var id in L){ var e = L[id], age = tick - e.tick; if(age < TICK_HZ) continue; if(maxAgeT && age > maxAgeT) continue;
    var d = Math.hypot(e.x-b.x, e.y-b.y); if(d >= rMax) continue;
    var sc = d + 40*age/TICK_HZ; if(sc < bs){ bs = sc; best = e; } }
  return best ? cornerLook(b, best) : null;
}
function teamInfoTick(){
  if(roundState !== "live") return;
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
    // слышу — своё; команде — только то, что сказано в войсе (teamChannel → teamHeardToIntel)
  });
  ["CT","T"].forEach(function(t){
    var TI = teamIntel[t];
    TI.sig = TI.sig.filter(function(s){ return tick - s.tick < INTEL_KEEP; });
    if(TI.carrier && tick - TI.carrier.tick > INTEL_KEEP) TI.carrier = null;
  });
}
// сколько врагов команда "знает" рядом с точкой за последние windowTicks
function intelEstimate(team, x, y, r, windowTicks){
  if(BAL.oneStore && BZ.ids.length && belief[team]){
    // из единого хранилища: враг "здесь", пока его вероятность рядом ≥0.35 —
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
  var TI = teamIntel[team], seen = {}, heard = {}, conf = 0, last = -1;
  TI.sig.forEach(function(s){
    if(tick - s.tick > windowTicks) return;
    if(Math.hypot(s.x-x, s.y-y) > r) return;
    if(s.type === "spotted"){ seen[s.id] = true; conf = 1; }
    else if(s.type === "sound"){ heard[s.id] = true; conf = Math.max(conf, 0.5); }
    last = Math.max(last, s.tick);
  });
  var nSeen = Object.keys(seen).length, nHeard = Object.keys(heard).length;
  return {n: Math.max(nSeen, nHeard), seen: nSeen, heard: nHeard, conf: conf, last: last};
}
function intelDeathsNear(team, x, y, r, windowTicks){
  return teamIntel[team].sig.filter(function(s){ return s.type === "died" && tick - s.tick <= windowTicks && Math.hypot(s.x-x, s.y-y) < r; }).length;
}
// смерть тиммейта — сигнал для всех + реакция ближних: трейд
// ---- названия зон (редактируются кликом по зоне при включённом слое «зоны») ----
// ZONE_NAMES_BAKED — зашитые в код (присланные через «Экспорт проекта»);
// поверх — правки из этого браузера. Игровая логика опирается на id зон,
// названия только для людей: войс, лог, подписи на карте.
var ZONE_NAMES_BAKED = MAP.zones.names; // из «Экспорт проекта» (сентябрь 2026)
var ZONE_NAMES_KEY = MAP.store + "-zonenames-v1";
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
var ZONE_SYNONYMS = MAP.zones.synonyms;
function normZoneName(n){ n = String(n||"").toLowerCase().replace(/\s+/g," ").trim(); return ZONE_SYNONYMS[n] || n; }
function zoneAliases(id){ var raw = ZONE_NAMES[id]; if(!raw) return []; return String(raw).split("/").map(normZoneName); }
var _zbnCache = {};
function zonesByName(name){
  var key = normZoneName(name);
  if(_zbnCache[key]) return _zbnCache[key];
  var out = ZONEMAP.zones.filter(function(z){ return zoneAliases(z.id).indexOf(key) >= 0 && (BZ.nbr[BZ.idx[z.id]]||[]).length; }).map(function(z){ return z.id; });
  if(out.length || BZ.ids.length) _zbnCache[key] = out; return out;   // (v334) до графа зон пустой ответ не запоминаем
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
function calloutName(x, y, from, z){
  var zid = zoneIdAt3(x, y, z), zn = zid && zoneMainName(ZONE_NAMES[zid]);
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
function voiceLog(team, key, who, text){ intelCallLog(team, "v:"+key, text, who, voiceKind(key, text)); }   // (v264) в панель войса, не в консоль
function aliveCount(team){ return bots.filter(function(b){ return b.team===team && b.alive; }).length; }
// (10) память между раундами: откуда стрелял AWP CT, где CT агрессивно
// пикнули на стороне T, какой сайт T рашили, где рано умирал мидер CT
var RMEM = {awp:[], aggro:[], rush:[], midDeath:[]};
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
    if(killer.team === "CT" && killer.weapon && killer.weapon.key === "AWP") RMEM.awp.push({x:killer.x, y:killer.y, round:roundNum});
    if(killer.team === "CT" && victim.team === "T" && secR < 30 && tSideZone(killer.x, killer.y))
      RMEM.aggro.push({x:killer.x, y:killer.y, round:roundNum, id:killer.id});
    if(victim.team === "CT" && victim.tRole === "mid" && secR < 30) RMEM.midDeath.push({round:roundNum});
    ["awp","aggro","midDeath"].forEach(function(k){ if(RMEM[k].length > 12) RMEM[k].shift(); });
  }
  var saw = killer && hasVision(victim.x, victim.y, killer.x, killer.y);
  intelPush(victim.team, {type:"died", x:victim.x, y:victim.y, id:victim.id, conf:1, kid: killer ? killer.id : null, kx: saw ? killer.x : null, ky: saw ? killer.y : null});   // кто убил — видно в киллфиде
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
    (mine > 0 ? " — нас "+mine+" против "+theirs : " — я последний, их "+theirs));   // (v323) последний погибший — без «нас 0»
  if(mine === 1 && theirs >= 2){
    var last = bots.filter(function(o){ return o.team === victim.team && o.alive; })[0];
    if(last) voiceLog(victim.team, "clutch", last.id, "я один против "+theirs+" — "+
      (teamSaving(victim.team) ? "сейвлюсь" :
       victim.team === "CT" && bomb && bomb.state !== "planted" ? "тяну время, беру по одному" :
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
      // (v368, владелец: «тот, кто несёт бомбу, может так же стрелять; ранят — отойдёт, как любой, или отдаст бомбу») носитель меняет,
      // как все; раненый уходит (lowHpBack) или отдаёт бомбу (bombPassTick, HP ≤ 30) — общие правила. Раньше при 3+ живых не менял
      // (v154) снайпер и лёркер T в дефолте на размен не срываются: у про их роль — держать свою линию
      if(BAL.duelValue && !(bomb && bomb.state === "planted") && ((o.weapon && o.weapon.key === "AWP") || (o.team === "T" && o.tRole === "lurker" && teamTac.T && teamTac.T.phase === "setup"))) return;
      if(Math.hypot(o.x-victim.x, o.y-victim.y) > TRADE_R) return;   // (v248) разменивает тот, кто рядом (как у про)
      var L = polyLen(pathPts(o.x, o.y, victim.x, victim.y));
      if(L <= 480) cands.push({b:o, L:L});
    });
    cands.sort(function(a, c){ return a.L - c.L; });
    // (v248) этот убийца уже убил нашего рядом за последние 5 с (тот шёл менять) — в тот же угол по одному
    // не идём: менять только вдвоём; один — держит/обходит (_avoidPeek ниже)
    var chainK = killer && (teamIntel[victim.team].sig || []).some(function(sg){ return sg.type === "died" && sg.id !== victim.id && tick - sg.tick <= 5*TICK_HZ && sg.tick < tick &&
      Math.hypot(sg.x-victim.x, sg.y-victim.y) <= 300 && sg.kid === killer.id; });
    if(chainK && cands.length < 2) cands = [];
    if(cands[0]) traders.push(cands[0]);
    if(cands[1] && cands[1].L <= (BAL.groupPlay ? 450 : 350) && aliveCount(victim.team) >= 3) traders.push(cands[1]);
    if(chainK && traders.length < 2) traders = [];   // вдвоём или никак
    traders.forEach(function(T, k){
      var o = T.b;
      if(teamSaving(o.team)) return;   // (v247) команда сейвит — не меняем
      if(BAL.execErr && o.prof && hashRand(tick*29 + o.id.charCodeAt(1)*11) < (1-prof(o, "disc"))*0.12){ noteMistake(o, "не разменял "+victim.id); return; }
      // выходит НЕ в ту же точку, где умер тиммейт (туда у убийцы уже стоит
      // прицел), а под другим углом — чтобы тому пришлось доводить прицел
      var swAll = pickSpots("tradeR"+tick+o.id, {x:victim.x, y:victim.y}, 5, {rMax:170, minGap:30, see:[kp]}), swC = swAll.filter(function(q){ return !spotTaken(o, q); });   // (v370) не в одну точку с напарником
      if(!swC.length) swC = swAll;
      var aV = Math.atan2(victim.y-kp.y, victim.x-kp.x), sw = null, sBest = -1;
      swC.forEach(function(q){ var da = Math.abs(((Math.atan2(q.y-kp.y, q.x-kp.x)-aV+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        var sc = Math.min(da, 0.8) - Math.hypot(q.x-o.x, q.y-o.y)/1500; if(sc > sBest){ sBest = sc; sw = q; } });
      sw = sw || {x:victim.x, y:victim.y};
      if(!setPost(o, sw, kp, true, "tradeR")) return;   // (v378) занят задачей важнее размена (бомба, сейв) — арбитр места
      o._probeLock = 0; o._reposUntil = 0;
      o._tradeLock = {until: tick + Math.round(3.5*TICK_HZ), at:{x:victim.x, y:victim.y}, kp:kp};
      o._tradeUntil = tick + Math.round(3.5*TICK_HZ);
      o.heardSound = {x:kp.x, y:kp.y, tick:tick, team:killer.team, src:killer.id, kind:"call"};
      if(k === 0) voiceLog(o.team, "trade"+victim.id, o.id, "меняю "+victim.id+"!");
    });
  }
  // ---- подмена (v272, просьба владельца 13.10; из «мозга 2» — tdefRefill, rebuild-v238 12_t_default.js): свой погиб, а
  // рядом никого (менять некому) — его место занимает ближайший из тех, у кого рядом есть напарник (пара не разваливается
  // в одиночку). Знание — войс «минус <место>». У про после смерти до планта к месту смерти (≤400 px) за 15 с никто не
  // приходит в 10 % (T) / 14 % (CT) случаев, у ботов v269 — в 23–24 % / 19–20 % (88 демок; tools/measure/audit/refill.py).
  // Держит место, пока план не сдвинулся: у T — до смены фазы (подготовка → выход), у CT — пока не «играем ретейк»; ≤ 15 с.
  // (13.10, владелец: «подмена — как у про, везде») T — и в подготовке, и на выходе; CT — всегда, кроме «их больше — играем ретейк»
  var fillPh = victim.team === "T" ? !!(teamTac.T && /^(setup|execute)$/.test(teamTac.T.phase)) : !(teamTac.CT && teamTac.CT.playRetake);
  // (v359, отметка владельца р6: роумер m0NESY в Palace «не идёт помогать, хотя 2 раза мог убить, даже после смерти тиммейта
  // остаётся в Palace» — 2 CT живы, а подмена шла только при 3+ и только тем, у кого рядом напарник) свой рядом (по пути ≤ FILL_NEAR)
  // подменяет и в одиночку и при двух живых: дыра у него под боком, его место от этого не открывается
  if(!traders.length && fillPh && !(bomb && bomb.state === "planted") && aliveCount(victim.team) >= 2 && !teamSaving(victim.team)){
    var fc = victim.post && Math.hypot(victim.post.x-victim.x, victim.post.y-victim.y) < 600 ? {x:victim.post.x, y:victim.post.y} : {x:victim.x, y:victim.y};
    var fl = killer ? {x:killer.x + (saw ? 0 : (hashRand(tick*37+7)-0.5)*160), y:killer.y + (saw ? 0 : (hashRand(tick*41+3)-0.5)*160)} : (victim.post && victim.post.look) || null;
    var fBest = null, fL = Infinity;
    // решает по тому, что знает команда (владелец 13.10: «умно, а то будут дырки в защите»): место ещё кто-то держит (свой
    // ≤400 px) — подменять незачем; уходит только тот, чьё место остаётся под присмотром (рядом напарник ≤ TRADE_R) и у кого
    // самого не горячо (команда не знает врагов в 600 px за последние 4 с — иначе ушёл бы из-под контакта и открыл свой вход)
    var covered = bots.some(function(m){ return m !== victim && m.alive && m.team === victim.team && Math.hypot(m.x-fc.x, m.y-fc.y) <= 400; });
    if(!covered) bots.forEach(function(o){
      if(!o.alive || o.team !== victim.team || o === victim || o.planting || o.defusing || o._sawEnemy || o._tradeLock || o._fillLock) return;
      if(o.team === "T" && (o.tRole === "lurker" || (bomb && bomb.carrier === o))) return;
      if(Math.hypot(o.x-fc.x, o.y-fc.y) > 2*FILL_NEAR && aliveCount(victim.team) < 3) return;
      var L = polyLen(pathPts(o.x, o.y, fc.x, fc.y)), near = L <= FILL_NEAR;
      if(!near && aliveCount(victim.team) < 3) return;
      if(!near && !bots.some(function(m){ return m !== o && m.alive && m.team === o.team && Math.hypot(m.x-o.x, m.y-o.y) <= TRADE_R; })) return;
      if(!near && intelEstimate(o.team, o.x, o.y, 600, 4*TICK_HZ).n > 0) return;
      if(L < fL){ fL = L; fBest = o; }
    });
    if(fBest){
      var fp = (fl && pickSpots("fill"+tick+fBest.id, fc, 1, {rMax:170, minGap:30, see:[fl]})[0]) || fc;
      if(setPost(fBest, fp, fl, true, "fill")){ fBest._fillLock = {until: tick + 15*TICK_HZ, team: victim.team, pt: fp, ph: victim.team === "T" ? teamTac.T.phase : null};
      voiceLog(victim.team, "fill"+victim.id, fBest.id, "займу "+calloutName(fc.x, fc.y)+" вместо "+victim.id); }
    }
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
    if(killer){ b.heardSound = {x:killer.x, y:killer.y, tick:tick, team:killer.team, src:killer.id, kind:"call"}; }
  });
}
// префайр по коллу: свежий (≤2с) "вижу" от тиммейта в 150..650px и есть линия — смотреть туда
function teamCallLook(b){
  var sig = teamIntel[b.team].sig, best = null, bd = 650;
  for(var i = sig.length-1; i >= 0; i--){
    var s = sig[i];
    if(tick - s.tick > 2*TICK_HZ) break;
    if(s.type !== "spotted" || s.by === b.id) continue;
    var d = Math.hypot(s.x-b.x, s.y-b.y);
    if(d < 150 || d >= bd) continue;
    if(!hasVision(b.x, b.y, s.x, s.y)) continue;
    best = s; bd = d;
  }
  return best;
}
// лог коллов — не спамить: раз в 4с на команду+зону
function intelCallLog(team, key, text, who, kind){
  var L = teamIntel[team].lastCall;
  if(L[key] && tick - L[key] < 4*64) return;
  L[key] = tick;
  if(kind) voiceFeed(team, who, text, kind); else logEvent(text);
}


