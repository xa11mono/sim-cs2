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
function resetTeamIntel(){ teamIntel = { CT:{sig:[], carrier:null, said:{}}, T:{sig:[], carrier:null, said:{}} }; VOICE = {CT:[], T:[]}; TALK_PLAN = {CT:"", T:""}; }
resetTeamIntel();
function intelPush(team, sig){ sig.tick = tick; teamIntel[team].sig.push(sig); if(typeof beliefObserve === "function") beliefObserve(team, sig);
  if(sig.type === "carrier"){ teamIntel[team].carrier = {x:sig.x, y:sig.y, tick:tick, by:sig.by}; intelPush(team, {type:"spotted", x:sig.x, y:sig.y, id:sig.id, by:sig.by, conf:1}); }
  // где разорвалась граната врага (услышали/увидели) — читают выход по гранатам
  if(sig.type === "nade"){ var NS = teamIntel[team].nadeSeen || (teamIntel[team].nadeSeen = []); NS.push({x:sig.x, y:sig.y, type:sig.ntype, tick:tick}); if(NS.length > 30) NS.shift(); }
  if(sig.type === "spotted" && sig.id && sig.id !== "?"){ var sf = botById(sig.id); if(sf){ foeSeen(team, sig.id, sig.x, sig.y);
    if(BAL.buyRead && sf.weapon) buyReadSee(team, sig.id, sf.weapon.key);
    if(sf.weapon && sf.weapon.slot === "primary") FOE[team].gun[sig.id] = sf.weapon.key; } } }
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
        newsAdd(checker, {k:"clear", x:e.x, y:e.y});
      }
    });
  });
}
function teamInfoTick(){
  if(roundState !== "live") return;
  bots.forEach(function(b){
    if(!b.alive) return;
    // вижу — в CS2 увиденный враг сразу на радаре у всей команды
    var LS = teamIntel[b.team].lastSpot || (teamIntel[b.team].lastSpot = {});
    (b._visible||[]).forEach(function(e){
      // один и тот же враг — не чаще раза в 8 тиков на команду (память не раздувается)
      if(!(LS[e.id] && tick - LS[e.id] < 8)){ LS[e.id] = tick; intelPush(b.team, {type:"spotted", x:e.x, y:e.y, id:e.id, by:b.id, conf:1}); }
      // бомба у него за спиной — видно; команда узнает, когда скажу
      if(bomb && bomb.state === "carried" && bomb.carrier === e)
        newsAdd(b, {k:"bomb", id:e.id, x:e.x, y:e.y, sigs:[{type:"carrier", x:e.x, y:e.y, id:e.id, by:b.id}]});
    });
    // слышу (свежие звуки этого тика): в свой блокнот — что и откуда; команда
    // узнает, когда я это скажу (talkTick), кому приписать — решит картина
    (b.ears||[]).forEach(function(e){
      if(e.tick !== tick) return;
      var sg = {type: e.kind === "pop" ? "nade" : "sound", x:e.x, y:e.y, id:"?", kind:e.kind, by:b.id, conf:0.4};
      if(e.until) sg.until = e.until; if(e.ntype) sg.ntype = e.ntype;
      if(e.kind === "steps" || e.kind === "water") sg.n = earsSources(b, TICK_HZ, ["steps","water"]);
      newsAdd(b, {k:"hear", kind:e.kind, x:e.x, y:e.y, n:sg.n||1, sigs:[sg]});
    });
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
function aliveCount(team){ return bots.filter(function(b){ return b.team===team && b.alive; }).length; }
function intelDeath(victim, killer){
  if(!victim || roundState !== "live") return;
  var saw = killer && hasVision(victim.x, victim.y, killer.x, killer.y);
  intelPush(victim.team, {type:"died", x:victim.x, y:victim.y, id:victim.id, conf:1, kx: saw ? killer.x : null, ky: saw ? killer.y : null});
  // где убийца по мнению команды: видел — точно; не видел — по тому, откуда
  // прилетели пули (направление попаданий, дистанция примерно); ник — из киллфида
  var kEst = null;
  if(killer){
    var hs0 = victim.heardSound;
    kEst = saw ? {x:killer.x, y:killer.y} : (hs0 && hs0.kind === "hit" && tick - hs0.tick < 8) ? {x:hs0.x, y:hs0.y}
      : hearPos(victim, killer.x, killer.y, tick*31 + (victim.id.charCodeAt(victim.id.length-1)||0), true);
  }
  // откуда убили — команда узнает из «минуса» убитого (он успевает сказать,
  // как в про-матче); убийца говорит «снял X» — своей команде
  victim._deadT = tick;
  newsAdd(victim, {k:"dead", x:victim.x, y:victim.y, kid:killer ? killer.id : null, kx:kEst ? kEst.x : null, ky:kEst ? kEst.y : null, saw:!!saw,
    sigs: killer ? [saw ? {type:"spotted", x:killer.x, y:killer.y, id:killer.id, by:victim.id, conf:1} : {type:"sound", x:kEst.x, y:kEst.y, id:killer.id, by:victim.id, kind:"hit", conf:0.6}] : []});
  // роль убитого — не «знаем», а что команда о нём поняла за матч (foeRole)
  if(killer && killer.alive) newsAdd(killer, {k:"kill", id:victim.id, x:victim.x, y:victim.y,
    sigs:[{type:"kill", x:victim.x, y:victim.y, id:victim.id, role:foeRole(killer.team, victim.id), by:killer.id, conf:1}]});
  // журнал смертей для IGL: кто, где, в какой фазе, откуда стреляли, разменяли ли
  if(teamTac.T && bomb && bomb.state !== "planted"){
    var TTd = teamTac.T; TTd._dl = TTd._dl || [];
    if(victim.team === "T"){
      var kx0 = kEst ? kEst.x : null, ky0 = kEst ? kEst.y : null;
      TTd._dl.push({t:"T", tick:tick, x:victim.x, y:victim.y, kx:kx0, ky:ky0, kid:killer ? killer.id : null, role:victim.tRole, phase:TTd.phase, traded:false});
    } else {
      TTd._dl.push({t:"CT", tick:tick, x:victim.x, y:victim.y, phase:TTd.phase});
      // CT умер в течение 3с после нашей смерти от ЕГО же руки / рядом — наш размен
      TTd._dl.forEach(function(e){ if(e.t === "T" && !e.traded && tick - e.tick < 3*TICK_HZ && (e.kid === victim.id || Math.hypot(e.x-victim.x, e.y-victim.y) < 600)) e.traded = true; });
    }
  }
  // размен — выбор действия (12_team.js): двое ближайших сразу берут линию на убийцу
  // IGL: энтри сняли на выходе — вторая волна не пикает тот же угол "в лоб":
  // ближайший с флешкой кидает поп-флешку на убийцу, размен идёт под неё
  if(BAL.iglReplan && victim.team === "T" && killer && killer.alive && teamTac.T && teamTac.T.phase === "execute" &&
     (victim.tRole === "entry" || !teamTac.T._popDone)){
    var kpF = kEst;
    var flc = bots.filter(function(o){ return o.alive && o.team === "T" && o !== victim && o.nades && o.nades.flash > 0 && !o.planting &&
      !(bomb.state === "carried" && bomb.carrier === o) && Math.hypot(o.x-victim.x, o.y-victim.y) < 750; })
      .sort(function(a, c){ return Math.hypot(a.x-victim.x, a.y-victim.y) - Math.hypot(c.x-victim.x, c.y-victim.y); })[0];
    if(flc && assignNade(flc, "flash", kpF, "поп на убийцу "+victim.id, {now:true, range:900})){
      teamTac.T._popDone = true;
    }
  }
  bots.forEach(function(b){
    if(!b.alive || b.team !== victim.team) return;
    var d = Math.hypot(b.x-victim.x, b.y-victim.y);
    if(d > 550) return;
    // "меня убили отсюда" — ближние тиммейты смотрят туда и идут разменивать
    // стрелка не видели и он не рядом — это не трейд, а второй пик в тот же
    // прострелянный угол: не лезть туда же ~8с (держать, ждать, обходить)
    if(!saw || (killer && Math.hypot(kEst.x-b.x, kEst.y-b.y) > 650)){
      b._avoidPeekUntil = tick + 8*TICK_HZ; b._avoidPeekAt = {x:victim.x, y:victim.y};
      return;
    }
    b._tradeUntil = tick + 150;
  });
}


// ---- кто есть кто у врага (только этот матч) ----
// Ник врага видно, когда он в прицеле и в киллфиде. За матч команда понимает,
// кто у них где играет: CT — по тому, где его видели в начале раунда (A, B,
// мид); T — кто с AWP, кто первым выходит на сайт (энтри), кто ходит один
// далеко от своих (люркер). Роль — где больше всего раз видели, от 2 раз.
// Деньги врага — подсчёт по открытому (как у про): у всех $800 в начале
// половины, + доход по итогу раунда (победа/поражение, лосс-бонус, плант —
// видно всем), + награды за фраги из киллфида, − что он, скорее всего, купил;
// винтовку сохранил тот, кто дожил до конца раунда и с ней был виден.
// Это часть картины команды; между матчами не хранится.
var FOE = {CT:{roles:{}, money:{}, gun:{}}, T:{roles:{}, money:{}, gun:{}}};
function foeReset(){ FOE = {CT:{roles:{}, money:{}, gun:{}}, T:{roles:{}, money:{}, gun:{}}}; }
function foeEcoHalf(){ ["CT","T"].forEach(function(t){ FOE[t].money = {}; FOE[t].gun = {}; }); }
function foeMoney(team, eid){ var m = FOE[team].money[eid]; return m == null ? START_MONEY : m; }
// доход врага за раунд — его считает каждый, кто видел счёт и киллфид
function foeIncome(team, eid, inc){ FOE[team].money[eid] = Math.min(MAX_MONEY, foeMoney(team, eid) + inc); }
// после их закупа: с сохранённой винтовкой — только броня/гранаты; иначе
// фулл, если хватает, или копят (эко). Оружие узнаем, когда увидим
function foeBuyGuess(team){
  bots.forEach(function(e){ if(e.team === team) return; var m = foeMoney(team, e.id), g = FOE[team].gun[e.id];
    var spend = g ? Math.min(m, 1000) : m >= 3900 ? 3700 : m >= 2500 ? m - 600 : 0;
    FOE[team].money[e.id] = m - spend; });
}
function foeNote(team, eid, what){
  var R = FOE[team].roles, F = R[eid] || (R[eid] = {}), key = what+":"+roundNum;
  if(F[key]) return; F[key] = 1; F[what] = (F[what]||0) + 1;
}
function foeRole(team, eid){
  var F = FOE[team] && FOE[team].roles[eid]; if(!F) return null;
  var best = null, bn = 1;
  ["anchorA","anchorB","mid","awp","entry","lurker"].forEach(function(r){ if((F[r]||0) > bn){ bn = F[r]; best = r; } });
  return best;
}
// что видно глазами в момент «вижу»: где стоит (в начале раунда — его место),
// с каким оружием, один ли он
function foeSeen(team, eid, x, y){
  var foe = botById(eid); if(!foe) return;
  var t = tick - roundStartTick;
  if(foe.weapon && foe.weapon.key === "AWP") foeNote(team, eid, "awp");
  if(foe.team === "CT" && t < 35*TICK_HZ){
    var C = [["anchorA", SITES.A], ["anchorB", SITES.B], ["mid", GEO.ctMid]], best = null, bd = 650;
    C.forEach(function(c){ if(!c[1]) return; var d = Math.hypot(c[1].x-x, c[1].y-y); if(d < bd){ bd = d; best = c[0]; } });
    if(best) foeNote(team, eid, best);
  }
  if(foe.team === "T"){
    var L = beliefLast[team], others = 0, firstAtSite = true;
    for(var id in L){ if(id === eid || L[id].gone) continue; var o = botById(id); if(!o || !o.alive) continue;
      if(tick - L[id].tick < 4*TICK_HZ && Math.hypot(L[id].x-x, L[id].y-y) < 700) others++;
      if(L[id].tick >= roundStartTick && SITES.A && Math.min(Math.hypot(L[id].x-SITES.A.x, L[id].y-SITES.A.y), Math.hypot(L[id].x-SITES.B.x, L[id].y-SITES.B.y)) < 600) firstAtSite = false; }
    var atSite = SITES.A && Math.min(Math.hypot(x-SITES.A.x, y-SITES.A.y), Math.hypot(x-SITES.B.x, y-SITES.B.y)) < 600;
    if(atSite && firstAtSite) foeNote(team, eid, "entry");
    // один, а остальных команда за 4 с слышала/видела далеко — ходит один
    var anyFar = Object.keys(L).some(function(id){ return id !== eid && !L[id].gone && tick - L[id].tick < 4*TICK_HZ && Math.hypot(L[id].x-x, L[id].y-y) > 1100; });
    if(!others && anyFar && t > 20*TICK_HZ) foeNote(team, eid, "lurker");
  }
}
// киллфид видят все: кто кого, из чего. Отсюда — закуп врага (оружие убийцы)
// и роль (кто открыл раунд на сайте, кто с AWP)
function killfeedRead(att, vic, wkey){
  if(!att || !vic || att.team === vic.team || roundState !== "live") return;
  var team = vic.team;
  if(wkey === "AWP") foeNote(team, att.id, "awp");
  if(BAL.buyRead && WEAPONS[wkey]) buyReadSee(team, att.id, wkey);
  var W = WEAPONS[wkey];
  foeIncome(team, att.id, W ? (W.killReward || 300) : 300);
  if(W && W.slot === "primary") FOE[team].gun[att.id] = wkey;
  FOE[att.team].gun[vic.id] = null; // убит — оружие осталось лежать
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
  BZ.DT = null;
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
// кому из врагов команда приписывает услышанное: ник по звуку не узнать —
// берём того, кто по картине вероятнее всего там (и не виден прямо сейчас
// в другом месте); n разных источников — n разных врагов. Это догадка команды:
// двоих, идущих вплотную, легко принять за одного
function soundWho(team, x, y, n){
  var B = belief[team], L = beliefLast[team], S = beliefSeen[team], c = [];
  Object.keys(B).forEach(function(eid){
    var lo = L[eid];
    if(lo && !lo.gone && lo.src === "spotted" && tick - lo.tick < 12 && Math.hypot(lo.x-x, lo.y-y) > 250) return;
    var old = S[eid] == null ? 1 : Math.min(1, (tick - S[eid])/(20*TICK_HZ));
    c.push({id:eid, w: beliefMassNear(team, eid, x, y, 300) + 0.001*old});
  });
  c.sort(function(p, q){ return q.w - p.w; });
  return c.slice(0, Math.max(1, n||1)).map(function(q){ return q.id; });
}
// вызывается из intelPush — каждое событие восприятия сразу правит карту
function beliefObserve(team, sg){
  if(!BZ.ids.length) return;
  if(sg.type === "sound" && sg.kind === "plant" && SITES.A && SITES.B){
    var st = Math.hypot(sg.x-SITES.A.x, sg.y-SITES.A.y) < Math.hypot(sg.x-SITES.B.x, sg.y-SITES.B.y) ? "A" : "B";
    teamIntel[team].plantHeard = {site:st, tick:tick, x:sg.x, y:sg.y};
  }
  var ids = [sg.id];
  if(sg.type === "sound" && (!sg.id || sg.id === "?")){ ids = soundWho(team, sg.x, sg.y, sg.n); sg.id = ids[0]; }
  if((sg.type === "spotted" || sg.type === "sound") && sg.id && sg.id !== "?"){
    reachOpen(team, sg.x, sg.y);
    var zn = calloutName(sg.x, sg.y);
    ids.forEach(function(eid){
      var bl = beliefLast[team][eid];
      if(bl && bl.src === "spotted" && sg.type === "sound" && tick - bl.tick < 2*TICK_HZ) return;
      beliefLast[team][eid] = {x:sg.x, y:sg.y, tick:tick, src:sg.type, zn:zn};
    });
  }
  if(sg.type === "spotted") beliefSet(team, sg.id, bzOf(sg.x, sg.y), 1);
  else if(sg.type === "sound") ids.forEach(function(eid){ beliefSet(team, eid, bzOf(sg.x, sg.y), sg.kind === "nade" ? 0.8 : 0.65); });
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


// ======================= ТИМСПИК (К10, rework B2): один общий голосовой канал =======================
// Как войс в CS2. Каждый бот ведёт «блокнот» _news — что он сам узнал или сделал
// (увидел, услышал, умер, убил, ранил, проверил — пусто; его задача сменилась).
// Раз в 1/8 с он решает, что из этого сказать, сверяя с тем, что команда уже
// слышала (teamIntel.said), и добавляет просьбы из того, что делает сам.
// Фраза длится 0,5–2 с по числу слов; команда слышит её целиком, когда она
// договорена, — тогда же инфа попадает в картину (intelPush). Говорить можно
// одновременно; срочное короткое («минус», «вижу двоих», «бомба») доходит всегда,
// а длинное при 3+ голосах сразу может пропасть или дойти позже. Поэтому бот,
// который слышит, что эфир занят, говорит коротко и только срочное.
// Реакции на услышанное здесь нет — это следующий шаг (B3).
var VOICE = {CT:[], T:[]};
var TALK_PLAN = {CT:"", T:""};
var VOICE_STATS = {n:0, sec:0, words:0, lost:0, late:0, urgent:0, stale:0, ex:[]};
var SAID_TTL = 6*64; // тиков (64 в секунду; TICK_HZ объявлен позже, в 17_tick.js)
// сколько запись в блокноте ещё стоит говорить (тиков): шаги и «вижу» — свежие
// только секунду-полторы; минус, бомба, плант — дольше; план — до смены плана
var TALK_TTL = {see:64, hear:96, hurt:128, kill:128, clear:128, nade:96, doing:128, need2:128, askcheck:192, holdmine:128, pull:96, flashme:64,
  dead:192, bomb:192, bombground:192, buy:384, plan:256, _retry:96, take:128, go:96, cant:96};
function talkTTL(it){ return it.k === "hear" && (it.kind === "plant" || it.kind === "defuse") ? 192 : (TALK_TTL[it.k] || 96); }
// не устарело ли (проверка перед тем, как сказать, и когда фраза дошла): говорить
// стоит только то, что тиммейтам ещё полезно и чего они не знают новее
function talkStale(team, byId, it){
  if(it.k === "_retry") return tick - it.t > TALK_TTL._retry || talkStale(team, byId, it.src || {});
  if(tick - it.t > talkTTL(it)) return true;
  var foe = team === "CT" ? "T" : "CT";
  if(!bots.some(function(o){ return o.alive && o.team === team && o.id !== byId; })) return true; // некому слушать
  if(aliveCount(foe) === 0 && it.k !== "plan") return true;                                       // врагов не осталось
  var dead = function(id){ var o = botById(id); return !o || !o.alive; };
  if(it.k === "see") return it.ids.every(dead);
  if(it.k === "hurt" || it.k === "bomb") return dead(it.id);
  if(it.k === "dead") return it.kid && dead(it.kid);
  if(it.k === "hear" || it.k === "clear"){
    if(it.kind === "plant" || it.kind === "defuse") return false;
    var near = function(x, y, r){ return Math.hypot(x-it.x, y-it.y) < r; };
    // там уже бой: свои видят врага рядом с этим местом
    if(bots.some(function(o){ return o.alive && o.team === team && (o._visible||[]).some(function(e){ return near(e.x, e.y, 400); }); })) return true;
    // команда уже знает новее: после этого врага там видели или там кто-то погиб
    var L = beliefLast[team] || {};
    for(var id in L){ var lo = L[id]; if(lo.tick > it.t && lo.src === "spotted" && near(lo.x, lo.y, 400)) return true; }
    if(picEvents(team).some(function(sg){ return sg.tick > it.t && (sg.type === "died" || sg.type === "kill") && near(sg.x, sg.y, 500); })) return true;
  }
  return false;
}
function newsAdd(b, it){ if(!b) return; it.t = tick; (b._news || (b._news = [])).push(it); }
function talkSpeaking(team, except){ return VOICE[team].filter(function(u){ return !u.done && u.end > tick && u.by !== except; }).length; }
var TALK_NUM = ["", "один", "двое", "трое", "четверо", "пятеро"];
var TALK_NADE = {smoke:"смок", flash:"флешку", he:"HE", molly:"молотов"}; // «кидаю …» — что кидаю
var TALK_DO = [["peek","пикну за инфой"], ["probe","пробую"], ["lurk","иду в люрк"], ["save","сейвлю"], ["defuse","дефужу"],
  ["plantspot","ставлю"], ["antidefuse","иду на бомбу"], ["retakeEntry","захожу первым"], ["fetch","беру бомбу"], ["entry","захожу первым"],
  ["trade","иду за энтри"], ["repos","меняю позицию"], ["fallback","отхожу"], ["retakeHold","играю от ретейка"], ["carry","бомба за вами"]];
function talkWhere(x, y, from){ return calloutName(x, y, from).replace(/[«»]/g, ""); }
// из записи блокнота — сообщение: что сказать полностью и коротко, срочно ли, что передаёт
function talkMsg(b, it){
  var team = b.team, foe = team === "CT" ? "T" : "CT", w = it.x != null ? talkWhere(it.x, it.y) : "";
  switch(it.k){
    case "dead": { // счёт живых видят все — в «минусе» только кто и откуда
      var who = it.kid ? (it.saw ? nick(it.kid)+" "+talkWhere(it.kx, it.ky, true) : "стреляли "+talkWhere(it.kx, it.ky, true)) : "";
      return {key:"dead"+b.id, pr:10, urgent:true, short:"минус"+(who ? ", "+who : ""), full:"минус"+(who ? ", "+who : "")}; }
    case "kill": return {key:"kill"+it.id, pr:8, urgent:true, short:"снял "+nick(it.id), full:"снял "+nick(it.id)+" "+w};
    case "bomb": return {key:"bomb"+it.id+w, pr:9, urgent:true, short:"бомба у "+nick(it.id), full:"бомба у "+nick(it.id)+" "+w};
    case "bombground": return {key:"bombg"+w, pr:8, urgent:true, short:"бомба лежит "+w, full:"бомба лежит "+w};
    case "see": return {key:"see"+w+it.n+(it.awp ? "a" : ""), pr:7, urgent:true, short:TALK_NUM[Math.min(5, it.n)]+" "+w+(it.awp ? ", AWP" : ""),
      full:"вижу "+(it.n >= 2 ? TALK_NUM[Math.min(5, it.n)] : nick(it.ids[0]))+" "+w+(it.awp ? " — AWP на линии" : "")};
    case "hear": {
      if(it.kind === "plant") return {key:"plant", pr:10, urgent:true, short:"плант!", full:"плантят "+w+"!"};
      if(it.kind === "defuse") return {key:"defuse", pr:10, urgent:true, short:"дефуз!", full:"дефузят!"};
      if(it.kind === "reload") return {key:"rl"+w, pr:6, short:"перезарядка "+w, full:"перезарядка "+w+"!"};
      if(it.kind === "zoom") return {key:"zoom"+w, pr:6, short:"AWP "+w, full:"слышу зум — AWP "+w};
      if(it.kind === "pop") return {key:"pop"+w, pr:3, short:"гранаты "+w, full:"гранаты "+w};
      if(it.kind === "nadefly") return {key:"nfly"+talkWhere(it.x, it.y, true), pr:4, short:"кинули "+talkWhere(it.x, it.y, true), full:"граната — кинули "+talkWhere(it.x, it.y, true)};
      if(it.kind === "hit") return null; // «по мне стреляют» — сам разберусь; если убьют — скажу в минусе
      var what = SOUND[it.kind] ? SOUND[it.kind].say : "шаги";
      return {key:"hear"+it.kind+w+(it.n||1), pr:5, short:(it.n >= 2 ? TALK_NUM[Math.min(5, it.n)]+" " : "")+w,
        full:"слышу "+what+(it.n >= 2 ? ", их "+TALK_NUM[Math.min(5, it.n)] : "")+" — "+w}; }
    case "hurt": return {key:"hurt"+it.id, pr:6, short:"ранил "+nick(it.id), full:nick(it.id)+" ранен, ~"+it.hp};
    case "clear": return {key:"clr"+w, pr:4, short:"пусто "+w, full:"проверил "+w+" — пусто"};
    case "buy": return {key:"buy"+it.read, pr:3, short:it.read === "eco" ? "у них эко" : "у них закуп", full:it.read === "eco" ? "у них пистолеты — эко" : "у них винтовки — закуп"};
    case "nade": return {key:"nd"+b.id+it.start, pr:5, short:TALK_NADE[it.type]+" "+w, full:"кидаю "+TALK_NADE[it.type]+" "+w};
    case "doing": return {key:"do"+b.id+it.verb+w, pr:3, short:it.verb, full:it.verb+(w ? " — "+w : "")};
    case "need2": return it.push ? {key:"n2"+b.id+w, pr:6, short:"пушу "+w+" — со мной", full:"пушу "+w+" — иди со мной"}
                                 : {key:"n2"+b.id+w, pr:6, short:"нужен второй "+w, full:"иду "+w+" — нужен второй"};
    case "askcheck": return {key:"ask"+it.id, pr:6, short:nick(it.id)+", чекни", full:"давно тихо — "+nick(it.id)+", чекни инфу"};
    case "holdmine": { var wf = talkWhere(it.x, it.y, true); // «с CT Lane», а не «с на CT Lane»
      return {key:"hm"+b.id+w, pr:6, short:"подержите "+w, full:"ухожу "+wf+" — подержите угол"}; }
    case "pull": return {key:"pull"+w, pr:7, short:"стяните одного "+w, full:"их тут больше — стяните одного "+w};
    case "take": return {key:"tk"+b.id+it.side, pr:5, short:"беру "+it.name, full:"беру "+it.name};
    case "go": return {key:"go"+b.id+w, pr:6, short:"иду", full:"иду к тебе "+w};
    case "cant": return {key:"cant"+b.id+w, pr:5, short:"не могу", full:"не могу — держу своё"};
    case "flashme": return {key:"fm"+b.id, pr:6, short:"флешку мне "+w, full:"дайте флешку мне на пик "+w};
    case "plan": return {key:"plan"+it.sig, pr:8, short:it.short, full:it.full};
    case "_retry": return {key:it.m.key, pr:it.m.pr, urgent:it.m.urgent, short:it.m.short, full:it.m.short, retry:true};
  }
  return null;
}
// просьбы и «что делаю» — из своей задачи и картины команды (не из готовых случаев)
function talkSelf(b){
  var team = b.team, mates = bots.filter(function(o){ return o !== b && o.alive && o.team === team; });
  var near = function(p, r){ return mates.some(function(o){ return Math.hypot(o.x-p.x, o.y-p.y) < r; }); };
  var tag = (b.post && b.post.tag) || "";
  // что делаю: задача сменилась на заметную для команды
  var base = tag.split(":")[0];
  if(base !== b._talkTag){ b._talkTag = base;
    var D = TALK_DO.filter(function(d){ return base === d[0]; })[0];
    if(D && b.post) newsAdd(b, {k:"doing", verb:D[1], x:b.post.x, y:b.post.y}); }
  // граната: сказать, куда кидаю (тиммейты ждут хлопка)
  if(b.nadeTask && b._talkNade !== b.nadeTask.start){ b._talkNade = b.nadeTask.start;
    if(b.nadeTask.now) newsAdd(b, {k:"nade", type:b.nadeTask.type, x:b.nadeTask.x, y:b.nadeTask.y, start:b.nadeTask.start}); }
  // «пушу X — иди со мной» говорит сам выбор действия (12_team.js, подпуш)
  // держал угол — ухожу, а там никого из своих не остаётся
  // (CT «ухожу — подержите» говорит выбор действия, 12_team.js)
  if(team === "CT") b._talkHold = null;
  else if(b.atPost && b.post && b.post.look) b._talkHold = {x:b.post.x, y:b.post.y};
  else if(b._talkHold && b.post && Math.hypot(b.post.x-b._talkHold.x, b.post.y-b._talkHold.y) > 250){
    if(!near(b._talkHold, 450) && !(bomb && bomb.state === "planted")) newsAdd(b, {k:"holdmine", x:b._talkHold.x, y:b._talkHold.y});
    b._talkHold = null;
  }
  // по картине их рядом со мной на 2+ больше, чем нас
  if(picOutnumbered(team, b.x, b.y, b)) newsAdd(b, {k:"pull", x:b.x, y:b.y});
  // собираюсь выйти на угол, который держат, а своей флешки нет — у соседа есть
  if(b._peekNeed && tick - b._peekNeed.t < 16 && !(b.nades && b.nades.flash > 0) &&
     mates.some(function(o){ return o.nades && o.nades.flash > 0 && Math.hypot(o.x-b.x, o.y-b.y) < 400; }))
    newsAdd(b, {k:"flashme", x:b._peekNeed.pt.x, y:b._peekNeed.pt.y});
  // вижу: сколько и где (на радаре точка уже есть — голосом «сколько, где, с чем»)
  var vis = (b._visible||[]).filter(function(e){ return e.alive; });
  if(vis.length){ var g = {}; vis.forEach(function(e){ var z = talkWhere(e.x, e.y); (g[z] || (g[z] = [])).push(e); });
    for(var z in g){ var L = g[z]; newsAdd(b, {k:"see", n:L.length, ids:L.map(function(e){ return e.id; }), x:L[0].x, y:L[0].y,
      awp:L.some(function(e){ return e.weapon && e.weapon.key === "AWP"; })}); } }
  // бомба лежит на земле — видно (T видят её на радаре и так)
  if(team === "CT" && bomb && bomb.state === "dropped" && Math.hypot(bomb.x-b.x, bomb.y-b.y) < 1000 && hasVision(b.x, b.y, bomb.x, bomb.y))
    newsAdd(b, {k:"bombground", x:bomb.x, y:bomb.y});
}
// план IGL: что команда делает сейчас — подпись плана; сменилась — IGL говорит
function talkPlan(team){
  var igl = bots.filter(function(b){ return b.alive && b.team === team && (team === "CT" || b.tRole === "igl"); })[0] ||
            bots.filter(function(b){ return b.alive && b.team === team; })[0];
  if(!igl) return;
  var sig = "", full = "", short = "", eco = teamEco[team] && ROUND_TYPE_LABEL[teamEco[team].roundType];
  if(team === "T"){ var tt = teamTac.T; if(!tt) return;
    sig = tt.site+"|"+tt.phase+"|"+(tt.saving ? "s" : "");
    if(tt.saving){ short = "сейв"; full = "сейвимся, не умираем зря"; }
    else if(tt.phase === "postplant"){ short = "пост-плант"; full = "бомба стоит — держим её, играем на время"; }
    else if(tt.phase === "execute"){ short = "заходим "+tt.site; full = "заходим на "+tt.site+"!"; }
    else if(TALK_PLAN.T && TALK_PLAN.T.split("|")[0] !== tt.site){ short = "все на "+tt.site; full = "перекол — все на "+tt.site; }
    else { short = tt.tac.name; full = (eco ? eco+", " : "")+tt.tac.name+(tt.tac.setupEnd ? ", выходим на "+tt.site+" позже" : ""); }
  } else { var ct = teamTac.CT; if(!ct) return;
    var planted = bomb && bomb.state === "planted";
    sig = (ct.setup ? ct.setup.id : "")+"|"+(ct.call ? ct.call.site : "")+"|"+(ct.saving ? "s" : "")+"|"+(planted ? bomb.site : "");
    if(ct.saving){ short = "сейв"; full = "не успеваем — сейв"; }
    else if(planted){ short = "ретейк "+bomb.site; full = "бомба на "+bomb.site+" — собираемся на ретейк"; }
    else if(ct.call){ short = "они на "+ct.call.site; full = "они на "+ct.call.site+" (~"+Math.max(1, Math.round(ct.call.count))+") — ротация"; }
    else { short = ct.setup ? ct.setup.name : "стандарт"; full = (eco ? eco+", " : "")+(ct.setup ? ct.setup.name : "стандарт"); }
  }
  if(sig === TALK_PLAN[team]) return;
  TALK_PLAN[team] = sig;
  newsAdd(igl, {k:"plan", sig:sig, short:short, full:full});
}
function talkWords(t){ return String(t).split(/\s+/).filter(function(w){ return /[0-9A-Za-zА-Яа-яЁё]/.test(w); }).length; }
function talkTick(){
  if(roundState !== "live") return;
  voiceTick();
  if(tick % 8) return;
  ["CT","T"].forEach(function(team){
    talkPlan(team);
    var said = teamIntel[team].said;
    bots.forEach(function(b){
      if(b.team !== team) return;
      var deadOk = !b.alive && b._deadT != null && tick - b._deadT < 3*TICK_HZ;
      if(!b.alive && !deadOk){ b._news = null; return; }
      if(b.alive) talkSelf(b);
      var N = (b._news || []).filter(function(it){ return !talkStale(team, b.id, it); });
      if(!b.alive) N = N.filter(function(it){ return it.k === "dead"; }); // мёртвый успевает сказать только «минус»
      b._news = N;
      if(!N.length || VOICE[team].some(function(u){ return u.by === b.id && !u.done; })) return; // уже говорю
      var talking = talkSpeaking(team, b.id), now = {};
      VOICE[team].forEach(function(u){ if(!u.done) now[u.key] = 1; });
      // одна запись → одно сообщение; одинаковые (тот же ключ) — вместе (сигналы всех)
      var M = {};
      N.forEach(function(it){ var m = talkMsg(b, it); if(!m) return; it._key = m.key;
        if(now[m.key] || (said[m.key] && tick - said[m.key] < (m.key.indexOf("plan") === 0 ? 1e9 : SAID_TTL))) return;
        if(M[m.key]){ M[m.key].sigs = M[m.key].sigs.concat(it.sigs || []); return; }
        m.sigs = (it.sigs || []).slice(); m.it = it; M[m.key] = m; });
      var C = Object.keys(M).map(function(k){ return M[k]; });
      // эфир занят (говорят двое+) — только срочное; кто-то говорит — коротко
      if(talking >= 2) C = C.filter(function(m){ return m.urgent; });
      if(!C.length) return;
      C.sort(function(p, q){ return q.pr - p.pr; });
      var m = C[0], text = (talking >= 1 || m.retry) ? m.short : m.full;
      var words = talkWords(text), dur = Math.round(Math.max(0.5, Math.min(2, 0.25 + 0.17*words))*TICK_HZ);
      VOICE[team].push({by:b.id, key:m.key, text:text, urgent:!!m.urgent, sigs:m.sigs, start:tick, end:tick + dur, words:words, msg:m});
      b._news = N.filter(function(it){ return it._key !== m.key; });
    });
  });
}
// конец фразы: слышат все — или (3+ голоса сразу, несрочное) пропало / опоздало
function voiceTick(){
  ["CT","T"].forEach(function(team){
    var V = VOICE[team];
    V.forEach(function(u){
      if(u.done || u.end > tick) return;
      var over = V.filter(function(o){ return o !== u && o.start < u.end && o.end > u.start; });
      if(over.length + 1 >= 3 && !u.urgent && !u.lateOnce){
        var h = hashRand(u.start*13 + (u.by.charCodeAt(u.by.length-1)||0)*7 + u.words);
        if(h < 0.5){ u.done = true; VOICE_STATS.lost++;
          logEvent("(эфир) "+nick(u.by)+" не услышали: "+u.text);
          var sp = botById(u.by); // говорящий понял, что перебили, — скажет ещё раз коротко, если это ещё важно
          if(sp && sp.alive && !u.msg.retry){ u.msg.retry = true; newsAdd(sp, {k:"_retry", m:u.msg, sigs:u.sigs, src:u.msg.it}); }
          return; }
        var e2 = Math.max.apply(null, over.map(function(o){ return o.end; }));
        if(e2 > tick){ u.end = e2; u.lateOnce = true; VOICE_STATS.late++; return; }
      }
      u.done = true;
      // дошла с опозданием — пока говорил, всё могло кончиться: устаревшее не доходит
      if(u.lateOnce && u.msg.it && talkStale(team, u.by, u.msg.it)){ VOICE_STATS.stale = (VOICE_STATS.stale||0) + 1; return; }
      teamIntel[team].said[u.key] = tick;
      VOICE_STATS.n++; VOICE_STATS.words += u.words; VOICE_STATS.sec += (u.end - u.start)/TICK_HZ; if(u.urgent) VOICE_STATS.urgent++;
      if(roundNum >= 3 && VOICE_STATS.ex.length < 60) VOICE_STATS.ex.push([matchNum, roundNum, tick, team, u.by, u.text]);
      logEvent("[войс "+team+"] "+nick(u.by)+": "+u.text, "voice");
      if(u.msg && u.msg.it) teamHear(team, u.by, u.msg.it);   // таблица команды: кто что держит, просьбы
      (u.sigs || []).forEach(function(sg){ var s2 = {}; for(var k in sg) s2[k] = sg[k]; intelPush(team, s2); });
    });
    VOICE[team] = V.filter(function(u){ return !u.done || tick - u.end < 5*TICK_HZ; });
  });
}
