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
function contactInfo(b){
  var best = null, bd = CONTACT_R, BL = beliefLast[b.team] || {};
  for(var id in BL){ var e = BL[id], ob = teamBot(id); if(!ob || !ob.alive || tick - e.tick > CONTACT_AGE*TICK_HZ) continue;
    var d = Math.hypot(e.x-b.x, e.y-b.y); if(d < bd){ bd = d; best = {x:e.x, y:e.y, seen: e.src === "spotted"}; } }
  var hs = b.heardSound; if(hs && hs.team && hs.team !== b.team && tick - hs.tick <= CONTACT_AGE*TICK_HZ){ var dh = Math.hypot(hs.x-b.x, hs.y-b.y); if(dh < bd){ bd = dh; best = {x:hs.x, y:hs.y}; } }
  var N = b._lastNade; if(!best && N && N.type === "flash" && tick - N.t >= NADE.flash.fuse - 8 && tick - N.t < NADE.flash.fuse + 40 && Math.hypot(N.x-b.x, N.y-b.y) < CONTACT_R) best = {x:N.x, y:N.y, own:true};
  return best ? {x:best.x, y:best.y, d:bd, seen:!!best.seen, own:!!best.own} : null;
}
function contactCritical(b, C){
  if(b.planting || b.defusing) return true;
  // (v399в, Г1, решение владельца 22.10 «сначала бросок»; сторож v399: 70 % потерь гранат плана — «снята: контакт») боец уже идёт
  // кидать (у задания есть точка броска — лайнап или место «на глаз»): контакт — враг известен, но не виден — забирает взгляд, ноги
  // доводят бросок; граната и есть ответ на контакт, как у про (сначала граната, потом пик). Увидел врага — бой (_sawEnemy), как было
  if(b.nadeTask && b.nadeTask.from) return true;
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
function contactTick(b){
  if(!b.alive || roundState !== "live") return;
  var K = b._contact;
  if(K && tick >= K.until){ K = b._contact = null;
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
  if(K && Math.hypot(C.x-K.x, C.y-K.y) < 120){ K.x = C.x; K.y = C.y; K.until = tick + CONTACT_HOLD*TICK_HZ; return; }
  if(b._contactT && tick - b._contactT < CONTACT_GAP*TICK_HZ && !K) return;
  var look = {x:C.x, y:C.y};
  if(contactCritical(b, C)){
    // задача важнее: взгляд — на контакт (не перебивает задачу), а у CT, идущего на бомбу, — смок на врага, если есть
    b._contact = {x:C.x, y:C.y, until: tick + CONTACT_HOLD*TICK_HZ, lock:false}; b._contactT = tick;
    if(b.team === "CT" && bomb && bomb.state === "planted" && b.nades && b.nades.smoke > 0 && !b.defusing && C.d > 150) assignNade(b, "smoke", look, "смок на врага рядом — иду к бомбе", {now:true, range:900});
    return;
  }
  var foe = b.team === "CT" ? "T" : "CT", BL = beliefLast[b.team] || {}, nE = 0;
  for(var id in BL){ var e = BL[id], ob = teamBot(id); if(ob && ob.alive && ob.team === foe && tick - BL[id].tick <= 5*TICK_HZ && Math.hypot(e.x-b.x, e.y-b.y) < 900) nE++; }
  var nM = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) < 600; }).length;
  var swing = b.hp > LOW_HP && Math.max(1, nE) <= nM + 1;
  if(swing && bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o._contact && o._contact.tag === "contact:swing" && tick < o._contact.until && Math.hypot(o._contact.x-C.x, o._contact.y-C.y) < 200; })) swing = false;   // на него уже выходит свой
  var cand = pickSpots("ct"+b.id+Math.round(look.x/40)+","+Math.round(look.y/40), {x:b.x, y:b.y}, 4, {rMax: swing ? CONTACT_SWING : 160, minGap:30, see:[look]})
    .filter(function(q){ return Math.hypot(q.x-look.x, q.y-look.y) >= 120 && !spotTaken(b, q); });
  if(hasLOS(b.x, b.y, look.x, look.y, b.z) && !swing) cand.unshift({x:b.x, y:b.y});
  cand.sort(swing ? function(a, c){ return Math.hypot(a.x-look.x, a.y-look.y) - Math.hypot(c.x-look.x, c.y-look.y); }
                  : function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); });
  var sp = cand[0]; if(!sp) return;
  var tag = swing ? "contact:swing" : "contact:hold";
  // (v378) задача важнее контакта (бомба, сейв — арбитр места, setPost) — ноги остаются на ней, взгляд — на контакт
  if(!setPost(b, sp, look, true, tag)){ b._contact = {x:C.x, y:C.y, until: tick + CONTACT_HOLD*TICK_HZ, lock:false}; b._contactT = tick; return; }
  b._contact = {x:C.x, y:C.y, until: tick + CONTACT_HOLD*TICK_HZ, lock:true, pt:sp, tag:tag}; b._contactT = tick;
  b._reposUntil = 0; b._probeLock = 0; b.lastIntel = {x:look.x, y:look.y, tick:tick, src:"call"};
  if(swing && !C.own && b.nades && b.nades.flash > 0 && C.d > 150 && !hasLOS(b.x, b.y, look.x, look.y, b.z)) assignNade(b, "flash", look, "флешка под выход на врага рядом", {now:true, range:900});
  voiceLog(b.team, "ct"+b.id+Math.round(tick/64), b.id, (swing ? "выхожу на него " : "держу ")+calloutName(look.x, look.y));
}
function teamBrains(){
  if(roundState !== "live" || !teamTac.T) return;
  bombTick();
  if(roundState !== "live") return; // дефуз мог только что закончить раунд
  routeTick();
  bots.forEach(function(b){ contactTick(b); });   // (v367) реакция на контакт — до мозгов, их посты её не перебивают
  SPOT_TEAM = "T"; tBrain(); SPOT_TEAM = "CT"; ctBrain(); SPOT_TEAM = null; endgameBrain(); lineupTick(); smokeEdgeTick(); weaponPickupTick(); itemPickupTick(); lkpTick();
  if(BAL.soundMore) bots.forEach(function(b){ if(b.alive && b._heardReload) reloadPeek(b); });
  if(BAL.assistPeek && tick % 4 === 0) bots.forEach(function(b){ if(b.alive) assistPeek(b); });
  if(BAL.lowHpBack && tick % 8 === 2) bots.forEach(function(b){ if(b.alive) lowHpBack(b); });
  if(BAL.hurtCall && tick % 8 === 4) bots.forEach(function(b){ if(b.alive) finishPush(b); });
  smokeFadeTick(); awpSmokeTick(); bombPassTick();
}

