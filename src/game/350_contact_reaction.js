// ======================= (v367) РЕАКЦИЯ НА КОНТАКТ — одно место для всех ботов и любых задач =======================
// Владелец: «зачем перескакивает, если он должен убить… не хочу миллиард правок под каждую ситуацию» (m0NESY в р3 метался
// взглядом между Connector и выходом из Palms и шёл на дефуз; magixx после флешки уходил по пост-планту). Бот свежо узнал, что
// враг рядом (≤ CONTACT_R ед., ≤ CONTACT_AGE с: видели, слышал сам — шаги, выстрел, откуда кинули гранату — или своя флешка
// туда только что хлопнула), а сам его сейчас не видит:
//  · взгляд закрепляется на нём на CONTACT_HOLD с (lookCands — «контакт»): другие угрозы его не перебивают, новый контакт
//    перебивает только если заметно ближе (×0,7) или его видели;
//  · ноги — туда же: задача (пост, дефуз, пост-плант, сбор, ротация) уступает, пока знание о нём свежее, и ещё CONTACT_HOLD с. Знаем врагов рядом не больше,
//    чем своих рядом + 1, и HP не низкое — выходит на него (точка ≤ CONTACT_SWING ед. от себя, откуда его видно, ближе к нему,
//    но ≥ 120); иначе держит угол (ближайшая точка, откуда видно). Выходя, кидает флешку туда, если есть;
//  · задача важнее контакта (по таблице арбитра места TASK_LEVEL — бомба, сейв), а также: ставит / дефузит, сейв в зоне
//    взрыва, CT до взрыва впритык на дефуз — тогда взгляд на контакт, смок на врага (если есть) и дальше к своей задаче.
// Повтор не чаще раза в CONTACT_GAP с на бота. Числа — проектные. Заменяет частные правки v365–v366 (retakePick, ppCheck).
var CONTACT_R = 700, CONTACT_AGE = 2.5, CONTACT_HOLD = 2.5, CONTACT_SWING = 220, CONTACT_GAP = 4;
// (v408, Б5г, владелец 22.10: «игрок 5 стоит на миду и получает contact:hold, потому что 6-й стреляется в Jungle — он должен чекать
// мид; убили 6-го — тогда помогать») контакт — только своё: видел сам (lastIntel без src), слышал сам; знание команды (видели свои,
// коллы) — только если враг на его участке (зона, где он стоит или его пост) или свой рядом только что погиб и он идёт менять
// (_tradeUntil — реакция на смерть тиммейта, 190). Раньше бралась вся память команды в CONTACT_R
function contactInfo(b){
  var best = null, bd = CONTACT_R, BL = beliefLast[b.team] || {}, myZ = {}, trade = tick < (b._tradeUntil || 0);
  myZ[zoneIdAt3(b.x, b.y, b.z)] = 1; if(b.post) myZ[zoneIdAt3(b.post.x, b.post.y, b.post.z != null ? b.post.z : b.z)] = 1;
  var take = function(x, y, seen, id){ var d = Math.hypot(x-b.x, y-b.y); if(d < bd){ bd = d; best = {x:x, y:y, seen:seen, id:id || null}; } };
  // (v435, М168, скрин владельца 26.10: после фрага «держит свой контакт» на месте убитого) источник — живой враг: убитый (киллфид)
  // контактом не бывает — ни то, где его видел, ни его звук (раньше их брали ещё 2,5 с после смерти и держали взгляд на трупе)
  var deadSrc = function(id){ var o = id ? teamBot(id) : null; return !!o && !o.alive; };
  var li = b.lastIntel; if(li && !li.src && tick - li.tick <= CONTACT_AGE*TICK_HZ && !deadSrc(li.id)) take(li.x, li.y, true, li.id);
  for(var id in BL){ var e = BL[id], ob = teamBot(id); if(!ob || !ob.alive || tick - e.tick > CONTACT_AGE*TICK_HZ) continue;
    if(trade || myZ[zoneIdAt3(e.x, e.y, e.z)]) take(e.x, e.y, e.src === "spotted", id); }
  var hs = b.heardSound; if(hs && hs.team && hs.team !== b.team && tick - hs.tick <= CONTACT_AGE*TICK_HZ && !deadSrc(hs.src) && (hs.kind !== "call" || trade || myZ[zoneIdAt3(hs.x, hs.y, hs.z)])) take(hs.x, hs.y, false, hs.src);
  var N = b._lastNade; if(!best && N && N.type === "flash" && tick - N.t >= NADE.flash.fuse - 8 && tick - N.t < NADE.flash.fuse + 40 && Math.hypot(N.x-b.x, N.y-b.y) < CONTACT_R) best = {x:N.x, y:N.y, own:true};
  return best ? {x:best.x, y:best.y, d:bd, seen:!!best.seen, own:!!best.own, id:best.id || null} : null;
}
function contactCritical(b, C){
  if(b.planting || b.defusing) return true;
  if(bomb && bomb.state === "planted"){
    var left = bombTimeLeftTicks()/TICK_HZ;
    if(b.team === "CT" && !(teamTac.CT && teamTac.CT.saving)){ var need = Math.hypot(b.x-bomb.x, b.y-bomb.y)/SPEED*1.2 + (b.kit ? 5 : 10) + 1.5; if(left - need < 3) return true; }
    if(bombDamageAt(b.x, b.y) >= b.hp*0.6 && left < 10) return true;   // в зоне взрыва и мало времени — бежит, не воюет
  }
  return false;
}
// (v370, владелец: «не стоят в толпе») демки: у T на выходе ближайший свой ближе 60 ед. карты — 11 % (Mirage) / 13 % (Ancient)
// времени, у ботов на снимках — 26 %, и чаще всего двое шли на одну точку (реакция на контакт, размен). Точка занята, если там
// стоит / туда идёт свой (≤ SPOT_PERSONAL); на того же врага, на которого уже выходит свой, второй не выходит, а держит угол
var SPOT_PERSONAL = 70, FOLLOW_GAP = 70;   // проектные числа: «личное место» чуть больше границы 60 из демок
function spotTaken(b, q){ return bots.some(function(o){ return o !== b && o.alive && o.team === b.team && (Math.hypot(o.x-q.x, o.y-q.y) < SPOT_PERSONAL || (o.post && Math.hypot(o.post.x-q.x, o.post.y-q.y) < SPOT_PERSONAL)); }); }
// (v418) свой рядом (≤ 600 — как «своих рядом» в счёте) сейчас в бою, и тот, с кем он стреляется, по знанию команды (≤ 1 с) — у этого
// контакта (≤ 400). 600 — как nM ниже; 400 — проектное число («та же группа»)
function contactMateFight(b, C){
  var BL = beliefLast[b.team] || {};
  return bots.filter(function(o){
    if(o === b || !o.alive || o.team !== b.team || !o._sawEnemy || !o._fc || !o._nearestEnemyBot || Math.hypot(o.x-b.x, o.y-b.y) > 600) return false;
    var e = BL[o._nearestEnemyBot.id]; return e && tick - e.tick <= TICK_HZ && Math.hypot(e.x-C.x, e.y-C.y) <= 400; })[0] || null;
}
function contactTick(b){
  if(!b.alive || roundState !== "live") return;
  var K = b._contact, kd = K && K.id ? teamBot(K.id) : null;
  // (v435, М168) контакт кончается по таймеру — или сразу, когда его враг убит (киллфид): держать взгляд на трупе незачем
  if(K && (tick >= K.until || (kd && !kd.alive))){ K = b._contact = null;
    // (v375, отметка владельца: игрок 8 после смерти тиммейта стоял на спавне CT, «выходит на врага рядом», а врага нет) реакция
    // на контакт кончилась — её точка снимается, бот возвращается к своей задаче (раньше пост «контакт» оставался до конца раунда)
    if(b.post && /^contact/.test(b.post.tag)) clearPost(b); }
  else if(!K && b.post && /^contact/.test(b.post.tag)) clearPost(b);   // точка контакта без самого контакта — тоже снять
  if(b._sawEnemy) return;   // видит врага — это уже бой
  var C = contactInfo(b); if(!C) return;
  if(K && !(C.seen || C.d < 0.7*Math.hypot(K.x-b.x, K.y-b.y) || Math.hypot(C.x-K.x, C.y-K.y) < 120)) return;   // держит прежний контакт
  // тот же — уточнить место и продлить: реакция держится, пока знание о нём свежее (≤ CONTACT_AGE) + CONTACT_HOLD после
  // (Б1, ENGINE_AUDIT Х3: раньше кончалась по таймеру при живом знании — пост снят, бот шёл назад на пост роли, через CONTACT_GAP
  // тот же враг давал контакт снова — половина «ходит туда-сюда»)
  // (v418) держит — а свой рядом начал бой с этой группой: решение «держать / выйти» пересматривается (ниже, contactMateFight)
  var reMate = K && K.tag === "contact:hold" && tick - (b._mateReT||-1e9) >= CONTACT_GAP*TICK_HZ && contactMateFight(b, C);   // не чаще CONTACT_GAP
  // (v438) уточнилось место врага, а с точки выхода его теперь не видно — точка выбирается заново (ниже), а не держится старая
  // не чаще раза в секунду (проектное число): враг на ходу, и точка, выбранная сейчас, через тик снова «не видит» — бот метался бы
  var swLost = K && K.tag === "contact:swing" && K.pt && tick - (b._contactT||0) >= TICK_HZ && !hasLOS(K.pt.x, K.pt.y, C.x, C.y, b.z);
  if(K && Math.hypot(C.x-K.x, C.y-K.y) < 120 && !reMate && !swLost){ K.x = C.x; K.y = C.y; if(C.id) K.id = C.id; K.until = tick + CONTACT_HOLD*TICK_HZ; return; }
  if(reMate) b._mateReT = tick;
  if(b._contactT && tick - b._contactT < CONTACT_GAP*TICK_HZ && !K) return;
  var look = {x:C.x, y:C.y};
  if(contactCritical(b, C)){
    // задача важнее: взгляд — на контакт (не перебивает задачу), а у CT, идущего на бомбу, — смок на врага, если есть
    b._contact = {x:C.x, y:C.y, id:C.id, until: tick + CONTACT_HOLD*TICK_HZ, lock:false}; b._contactT = tick;
    if(b.team === "CT" && bomb && bomb.state === "planted" && b.nades && b.nades.smoke > 0 && !b.defusing && C.d > 150) assignNade(b, "smoke", look, "смок на врага рядом — иду к бомбе", {now:true, range:900});
    return;
  }
  var foe = b.team === "CT" ? "T" : "CT", BL = beliefLast[b.team] || {}, nE = 0;
  for(var id in BL){ var e = BL[id], ob = teamBot(id); if(ob && ob.alive && ob.team === foe && tick - BL[id].tick <= 5*TICK_HZ && Math.hypot(e.x-b.x, e.y-b.y) < 900) nE++; }
  var nM = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) < 600; }).length;
  // (v418, скрин владельца 25.10: T впятером вышли на A и стреляются с 9-м, 5-й рядом «держит» — врагов 5 > своих 2 + 1) счёт тел не
  // различал «идут на меня» и «стреляются с моим»: свой рядом в бою с этой группой — выходит (стрелять, пока свой ещё жив, — кроссфайр,
  // PRO_PLAY 3: «кроссфайры — хлеб с маслом»). Только то, что игрок знает: свой стреляется рядом (слышно), его противник — в знании команды
  var swing = b.hp > LOW_HP && (Math.max(1, nE) <= nM + 1 || !!contactMateFight(b, C));
  // (v418б, владелец 25.10: «про не выпрыгивает из дыма на пятерых даже под стрельбу тиммейта — играет от края дыма») между ним и врагом
  // дым — не выходит, держит (место выхода выбиралось по прямой видимости без дыма)
  if(swing && smokeBlocks(b.x, b.y, look.x, look.y)) swing = false;
  // (v440, док владельца 27.10: magixx с бомбой «делал агрессию в андере», р8 — с бомбой и 22 HP ждал файта) носитель бомбы на выход не идёт,
  // пока жив кто-то ещё из своих: бомба в первом бою — потеря раунда; держит угол (последний живой — играет сам)
  if(swing && bomb && bomb.state === "carried" && bomb.carrier === b && aliveCount(b.team) > 1) swing = false;
  if(swing && bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o._contact && o._contact.tag === "contact:swing" && tick < o._contact.until && Math.hypot(o._contact.x-C.x, o._contact.y-C.y) < 200; })) swing = false;   // на него уже выходит свой
  // (v438, док владельца 27.10: точка «выхожу на него» на ящике Short / в Underpath без вида на врага — бот стоял 22 с) точка — на полу
  // своего уровня (не крыша ящика, не другой этаж: navAtLevel) и, если выходит, — оттуда видно место врага (3D-видимость с пола точки).
  // Нет такой — не выходит, держит (точку держать ищем так же, но вид не обязателен: держит угол, откуда враг придёт)
  var spotOk = function(q, needSee){ var a = b.z == null ? null : navAtLevel(q.x, q.y, b.z); if(b.z != null && !a) return false;
    return !needSee || hasLOS(q.x, q.y, look.x, look.y, a ? a.z : b.z); };
  var contactSpots = function(sw){ return pickSpots("ct"+b.id+Math.round(look.x/40)+","+Math.round(look.y/40)+(sw ? "s" : "h"), {x:b.x, y:b.y}, 6, {rMax: sw ? CONTACT_SWING : 160, minGap:30, see:[look]})
    .filter(function(q){ return Math.hypot(q.x-look.x, q.y-look.y) >= 120 && !spotTaken(b, q) && spotOk(q, sw); }); };
  var cand = contactSpots(swing);
  if(swing && !cand.length){ swing = false; cand = contactSpots(false); }
  if(hasLOS(b.x, b.y, look.x, look.y, b.z) && !swing) cand.unshift({x:b.x, y:b.y});
  cand.sort(swing ? function(a, c){ return Math.hypot(a.x-look.x, a.y-look.y) - Math.hypot(c.x-look.x, c.y-look.y); }
                  : function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); });
  var sp = cand[0]; if(!sp) return;
  var tag = swing ? "contact:swing" : "contact:hold";
  // (v378) задача важнее контакта (бомба, сейв — арбитр места, setPost) — ноги остаются на ней, взгляд — на контакт
  if(!setPost(b, sp, look, true, tag)){ b._contact = {x:C.x, y:C.y, id:C.id, until: tick + CONTACT_HOLD*TICK_HZ, lock:false}; b._contactT = tick; return; }
  b._contact = {x:C.x, y:C.y, id:C.id, until: tick + CONTACT_HOLD*TICK_HZ, lock:true, pt:sp, tag:tag}; b._contactT = tick;
  b._reposUntil = 0; b._probeLock = 0; b.lastIntel = {x:look.x, y:look.y, tick:tick, src:"call"};
  if(swing && !C.own && b.nades && b.nades.flash > 0 && C.d > 150 && !hasLOS(b.x, b.y, look.x, look.y, b.z)) assignNade(b, "flash", look, "флешка под выход на врага рядом", {now:true, range:900});
  voiceLog(b.team, "ct"+b.id+Math.round(tick/64), b.id, (swing ? "выхожу на него " : "держу ")+calloutName(look.x, look.y));
}
// ======================= (v419, хвост 350:70, владелец 25.10) ЗАДЕРЖАТЬ ГРАНАТОЙ — одно место для CT =======================
// PRO_PLAY.md (CT): «отказать и потянуть — утилитой задерживать», «тиммейт держит утилиту и кидает при контакте», «молотов
// останавливает подход». CT знает, что группа T идёт на него: держит угол от контакта (contact:hold) или команда видела / слышала T
// у входа на сайт (в первые 25 с хватает одного, дальше — двое; на сайте уже больше одного — поздно; кидает ближайший к входу CT —
// как было в «молотове на раш»). Кидает, только пока врага сам не видит и известных врагов ближе DELAY_SAFE нет, и только С МЕСТА
// (здесь — here: не идёт на точку броска nadeThrowSpot, не долетает — не кидает; враг появился — задание снимается, в руках оружие):
//  · проход открыт — молотов, нет — смок (не туда, где уже горит);
//  · между ним и группой дым, а свой рядом стреляется с ней (contactMateFight) — HE (не в сам дым: HE его разрывает), нет —
//    флешка, если её хлопок по формуле ослепления (flashDirK) не слепит ни одного своего; свой не в бою — дым держит проход сам.
// Потом — снова угол с оружием. Заменяет «молотов на раш» (410) и молотов / HE опорника «задержать выход» по коллу (420).
var DELAY_SAFE = 350, DELAY_GAP = 6;   // проектные числа: 350 — из ТЗ владельца (300–400, не из демок), 6 с — пауза между бросками
function delaySafe(b){
  if(b._sawEnemy) return false;
  var BL = beliefLast[b.team] || {};
  for(var id in BL){ var e = BL[id], ob = teamBot(id);
    if(ob && ob.alive && ob.team !== b.team && tick - e.tick <= CONTACT_AGE*TICK_HZ && Math.hypot(e.x-b.x, e.y-b.y) < DELAY_SAFE) return false; }
  return true;
}
function flashSafeFor(b, t){
  return !bots.some(function(o){ if(o === b || !o.alive || o.team !== b.team) return false;
    var k = flashDirK(o, t); return k && BAL.flashMax*k*Math.max(0, 1 - Math.hypot(o.x-t.x, o.y-t.y)/1100) > 0.35; });   // как хлопок (400), без увёртки и колла
}
function delayCanThrow(o){ return o.alive && o.team === "CT" && o.nades && (o.nades.molly > 0 || o.nades.smoke > 0) && !o.nadeTask && !o._sawEnemy; }
function delayTarget(b){
  var K = b._contact;
  if(K && K.tag === "contact:hold" && tick < K.until)
    return Math.hypot(K.x-b.x, K.y-b.y) >= DELAY_SAFE ? {x:K.x, y:K.y, why:"держу "+calloutName(K.x, K.y)} : null;   // враг уже в упор — оружие
  if(!delayCanThrow(b)) return null;
  var early = tick - roundStartTick < 25*TICK_HZ, best = null, sig = (teamIntel.CT && teamIntel.CT.sig) || [];
  ["A","B"].forEach(function(k){
    var ent = GEO[k] && GEO[k].tEntry; if(!ent) return;
    var src = {}, onS = {};
    sig.forEach(function(sg){ if(!sg.id || sg.id === "?") return;
      if((sg.type === "sound" || sg.type === "spotted") && tick - sg.tick < 2.5*TICK_HZ && Math.hypot(sg.x-ent.x, sg.y-ent.y) < 700) src[sg.id] = 1;
      if(sg.type === "spotted" && tick - sg.tick < 1.5*TICK_HZ && Math.hypot(sg.x-SITES[k].x, sg.y-SITES[k].y) < 220) onS[sg.id] = 1; });
    if(Object.keys(src).length < (early ? 1 : 2) || Object.keys(onS).length > 1) return;
    var ok = function(o){ var d = Math.hypot(o.x-ent.x, o.y-ent.y); return d < NADE_THROW_RANGE*1.1 && d > 150; };
    if(!ok(b)) return;
    var dB = Math.hypot(b.x-ent.x, b.y-ent.y);
    if(bots.some(function(o){ return o !== b && delayCanThrow(o) && ok(o) && Math.hypot(o.x-ent.x, o.y-ent.y) < dB; })) return;   // кидает ближайший
    if(!best || dB < best.d) best = {x:ent.x, y:ent.y, d:dB, why:"вход "+k};
  });
  return best;
}
function ctDelayNade(b){
  if(b.team !== "CT" || !b.alive || !b.nades || b.nadeTask || b.planting || b.defusing || (bomb && bomb.state === "planted")) return;
  if(tick - (b._delayT == null ? -1e9 : b._delayT) < DELAY_GAP*TICK_HZ || !delaySafe(b)) return;
  var t = delayTarget(b); if(!t) return;
  var type = null, inSmoke = smokeCovered(t.x, t.y);
  if(inSmoke || smokeBlocks(b.x, b.y, t.x, t.y)){
    if(!contactMateFight(b, t)) return;
    if(b.nades.he > 0 && !inSmoke) type = "he";
    else if(b.nades.flash > 0 && flashSafeFor(b, t)) type = "flash";
  } else if(!fires.some(function(f){ return Math.hypot(f.x-t.x, f.y-t.y) < NADE.molly.radius; })){
    type = b.nades.molly > 0 ? "molly" : (b.nades.smoke > 0 ? "smoke" : null);
  }
  if(!type || !assignNade(b, type, t, "задержать: "+t.why, {now:true, here:true})) return;
  b._delayT = tick;
  voiceLog("CT", "dly"+b.id+Math.round(tick/64), b.id, ({molly:"молотов", smoke:"смок", he:"HE", flash:"флешка"})[type]+" — "+t.why);
}
function teamBrains(){
  if(roundState !== "live" || !teamTac.T) return;
  bombTick();
  if(roundState !== "live") return; // дефуз мог только что закончить раунд
  routeTick();
  bots.forEach(function(b){ contactTick(b); });   // (v367) реакция на контакт — до мозгов, их посты её не перебивают
  bots.forEach(function(b){ ctDelayNade(b); });   // (v419) задержать гранатой — после реакции на контакт (знает, держит ли угол)
  SPOT_TEAM = "T"; tBrain(); SPOT_TEAM = "CT"; ctBrain(); SPOT_TEAM = null; endgameBrain(); lineupTick(); smokeEdgeTick(); weaponPickupTick(); itemPickupTick(); lkpTick();
  if(BAL.soundMore) bots.forEach(function(b){ if(b.alive && b._heardReload) reloadPeek(b); });
  if(BAL.assistPeek && tick % 4 === 0) bots.forEach(function(b){ if(b.alive) assistPeek(b); });
  if(BAL.lowHpBack && tick % 8 === 2) bots.forEach(function(b){ if(b.alive) lowHpBack(b); });
  if(BAL.hurtCall && tick % 8 === 4) bots.forEach(function(b){ if(b.alive) finishPush(b); });
  smokeFadeTick(); awpSmokeTick(); bombPassTick();
}

