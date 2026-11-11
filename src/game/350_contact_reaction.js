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
var CONTACT_PUSH = 250;   // (v555) проектное число: ед. — T в выходе заходит в зону врага (точки вокруг полпути к нему, по пути не дальше), если ближе точки с видом на него нет
// (v408, Б5г, владелец 22.10: «игрок 5 стоит на миду и получает contact:hold, потому что 6-й стреляется в Jungle — он должен чекать
// мид; убили 6-го — тогда помогать») контакт — только своё: видел сам (lastIntel без src), слышал сам; знание команды (видели свои,
// коллы) — только если враг на его участке (зона, где он стоит или его пост) или свой рядом только что погиб и он идёт менять
// (_tradeUntil — реакция на смерть тиммейта, 190). Раньше бралась вся память команды в CONTACT_R
function contactInfo(b){
  var best = null, bd = CONTACT_R, BL = beliefLast[b.team] || {}, myZ = {}, trade = tick < (b._tradeUntil || 0);
  myZ[zoneIdAt3(b.x, b.y, b.z)] = 1; if(b.post) myZ[zoneIdAt3(b.post.x, b.post.y, b.post.z != null ? b.post.z : b.z)] = 1;
  // (док 6, п.11: р10 бросок флешки T на T Ramp дал contact:hold kyousuke на Catwalk и m0NESY на миде — 470 / 531 по прямой, 1215 / 937 по пути)
  // враг, которого не видно, «рядом» по пути (откуда он дойдёт), а не по прямой сквозь стены; видимый — по прямой (он уже стреляет)
  // (v469, п.13/24 владельца 29.10, снимок м1 р6 т31475: m0NESY под балконом «держал контакт» на бросок гранаты из Palace Exit — этажом
  // выше, оттуда не видно; zont1x в Palace держал контакт на шаги m0NESY под собой) contact hold — держать линию, по которой враг выйдет
  // (ответ про-аналитика 29.10: на далёкие шаги, пока враг не вошёл в сектор обстрела, и на гранату вдали — не реагировать). Враг, которого
  // сейчас не видно, — контакт, только если его место (с его этажом) видно отсюда или с поста: иначе держать нечего
  var inSector = function(x, y, z){ return hasLOS(b.x, b.y, x, y, b.z, z) || (b.post && Math.hypot(b.post.x-b.x, b.post.y-b.y) < 160 && hasLOS(b.post.x, b.post.y, x, y, b.post.z != null ? b.post.z : b.z, z)); };
  var take = function(x, y, seen, id, z){ var d = Math.hypot(x-b.x, y-b.y); if(d >= bd) return; if(!seen){ d = pathLenTo(b, x, y); if(d >= bd || !inSector(x, y, z)) return; }
    bd = d; best = {x:x, y:y, z:z, seen:seen, id:id || null}; };
  // (v435, М168, скрин владельца 26.10: после фрага «держит свой контакт» на месте убитого) источник — живой враг: убитый (киллфид)
  // контактом не бывает — ни то, где его видел, ни его звук (раньше их брали ещё 2,5 с после смерти и держали взгляд на трупе)
  var deadSrc = function(id){ var o = id ? teamBot(id) : null; return !!o && !o.alive; };
  var li = b.lastIntel; if(li && !li.src && tick - li.tick <= CONTACT_AGE*TICK_HZ && !deadSrc(li.id)) take(li.x, li.y, true, li.id, li.z);
  // (00_PLAN п.17, ответ владельца 8, 05.11: «мидер может помогать, если это не создаёт критическую дыру в контроле мида; помощь — не полная
  // ротация: подойти на дистанцию помощи, прикрыть, разменять, вернуться») заменяет абсолютное правило v408 условным: враг вне его участка —
  // его контакт и тогда, когда свой прямо сейчас стреляется с этим врагом, а на своём участке угрозы нет (свежей инфы о враге там нет, вес
  // карты команды < 0,45 — порог «есть инфа», 250). Подход ≤ CONTACT_SWING и возврат через CONTACT_HOLD — как у любого контакта
  var myThreat = null;
  var calm = function(){ if(myThreat === null){ myThreat = false;
      for(var k in BL){ var q = BL[k], oq = teamBot(k); if(oq && oq.alive && tick - q.tick <= SITE_SEEN_SEC*TICK_HZ && myZ[zoneIdAt3(q.x, q.y, q.z)]){ myThreat = true; break; } }
      if(!myThreat) Object.keys(myZ).forEach(function(z){ var j = BZ.idx[z]; if(j !== undefined && beliefZoneKnown(b.team, j) >= 0.45) myThreat = true; }); }
    return !myThreat; };
  // (прогон 178: перетягивание Ancient 67 → 97 — «пост-плант / лайнап → контакт → обратно») помогает тот, у кого задача не важнее личной
  // перестановки (уровни 1–3: пост роли, маршрут, личное) — держащий бомбу, идущий кидать гранату и т. п. свою задачу ради помощи не бросает
  // (v518a, пак 09.11 п.1: на пост-планте / охоте / ретейке «смотрит, но не идёт» — свой бой рядом отсекался уровнем задачи > 3) помогает,
  // если главная задача терпит отклонение (detourOk, 110: не ставит / не дефузит, не бомба, не сейв, время есть); тянуть туда-обратно
  // (прогон 178) не даёт сам контакт: держится, пока знание свежее + CONTACT_HOLD, повтор — не чаще CONTACT_GAP
  var freeToHelp = !b.post || taskLevel(b.post.tag) <= 3 || detourOk(b, "help");
  var mateFight0 = function(id){ return bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o._sawEnemy && o._nearestEnemyBot && o._nearestEnemyBot.id === id; }); };
  var mateFights = function(id){ return freeToHelp && mateFight0(id); };
  // (v547, владелец 10.11: «в ретейке, пост-планте, охоте боты не помогают») «на своём участке спокойно» (calm, v408 — мидер держит мид) — только
  // у того, кто держит пост роли; у задачи фазы (ретейк, пост-плант, охота: уровень ≥ 7) участок — вся задача, терпит ли она помощь — detourOk
  var lvB = taskAlive(b) ? b._task.lv : 1, phase = lvB >= 7;
  // (v547, ответ владельца 10.11, сейв: «помогать своему — только если перестрелка прямо в зоне видимости бота, бежать и открывать новые позиции не
  // нужно, размен быстрый») на сейве — только враг, с которым свой сейчас стреляется и которого видно с места бота; ноги остаются на сейве
  // (контакт ниже сейва — арбитр места), взгляд и выстрел — туда
  var saving = taskAlive(b) && taskProp(b._task.tag, "saveTask");
  // (v547, ответ владельца 10.11: «CT на ретейке выбивают — их цель убить всех, по которым есть инфа, которые могут помешать дефузу») CT с
  // поставленной бомбой (не сейв) — инфа своих о враге рядом (по пути ≤ CONTACT_R, место видно — take) — его контакт, а не только своя зона
  var retakeHunt = b.team === "CT" && bomb && bomb.state === "planted" && !saving && !(teamTac.CT && teamTac.CT.saving);
  for(var id in BL){ var e = BL[id], ob = teamBot(id); if(!ob || !ob.alive || tick - e.tick > CONTACT_AGE*TICK_HZ) continue;
    if(saving){ if(mateFight0(id) && hasLOS(b.x, b.y, e.x, e.y, b.z, e.z)) take(e.x, e.y, e.src === "spotted", id, e.z); continue; }
    if(trade || retakeHunt || myZ[zoneIdAt3(e.x, e.y, e.z)] || (mateFights(id) && (phase || calm()))) take(e.x, e.y, e.src === "spotted", id, e.z); }
  // (v469) бросок гранаты (слышно чеку / бросок) — не контакт (ответ про-аналитика: на гранату вдали не реагировать); её место знание получает
  var hs = b.heardSound; if(hs && hs.team && hs.team !== b.team && hs.kind !== "nade" && tick - hs.tick <= CONTACT_AGE*TICK_HZ && !deadSrc(hs.src) && (hs.kind !== "call" || trade || myZ[zoneIdAt3(hs.x, hs.y, hs.z)])) take(hs.x, hs.y, false, hs.src, hs.z);
  // (v448, док владельца 28.10 №4: у игрока 1 «якорь контакт холд, когда он далеко, не стрелялся и никого не видел») своя флешка —
  // контакт только если кинута себе под пик («флешу себе и выхожу»); раньше любая своя флешка (на сайт за 700 ед.) давала «держу свой контакт»
  var N = b._lastNade; if(!best && N && N.type === "flash" && N.self && tick - N.t >= NADE.flash.fuse - 8 && tick - N.t < NADE.flash.fuse + 40 && Math.hypot(N.x-b.x, N.y-b.y) < CONTACT_R) best = {x:N.x, y:N.y, own:true};
  return best ? {x:best.x, y:best.y, z:best.z, d:bd, seen:!!best.seen, own:!!best.own, id:best.id || null} : null;
}
function contactCritical(b, C){
  if(b.planting || b.defusing) return true;
  if(bomb && bomb.state === "planted"){
    var left = bombTimeLeftTicks()/TICK_HZ;
    if(b.team === "CT" && !(teamTac.CT && teamTac.CT.saving)){ var need = defuseEta(b) + 1.5; if(left - need < 3) return true; }
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
    if(o === b || !o.alive || o.team !== b.team || !o._sawEnemy || !o._fc || !o._nearestEnemyBot || !nearP(o.x, o.y, o.z, b.x, b.y, b.z, 600)) return false;
    var e = BL[o._nearestEnemyBot.id]; return e && tick - e.tick <= TICK_HZ && nearP(e.x, e.y, e.z, C.x, C.y, C.z, 400); })[0] || null;
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
  // (00_PLAN, аудит 3.4, 05.11: «контакт (ур. 9) держится, когда команде уже критически мало времени на ретейк») начатый контакт пересматривается
  // по событию: стало критично (contactCritical — CT впритык на дефуз, ставит / дефузит, в зоне взрыва) — ноги к своей задаче, взгляд — на контакте.
  // Раньше эта проверка была только для нового контакта, а начатый при той же инфе продлевался
  if(K && K.lock && contactCritical(b, C)){ b._contact = {x:K.x, y:K.y, id:K.id, until:K.until, lock:false}; if(b.post && /^contact/.test(b.post.tag)) clearPost(b); return; }
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
  for(var id in BL){ var e = BL[id], ob = teamBot(id); if(ob && ob.alive && ob.team === foe && tick - BL[id].tick <= 5*TICK_HZ && nearP(e.x, e.y, e.z, b.x, b.y, b.z, 900)) nE++; }
  var nM = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && nearP(o.x, o.y, o.z, b.x, b.y, b.z, 600); }).length;
  // (v469, п.14 владельца, снимок м1 р6 т34149: после колла «T на B (~3)» m0NESY пошёл на B, через 2,5 с его остановил contact hold на
  // люркера и держал 17 с; ответ про-аналитика: ротатор и мидер стягиваются первыми, на одиночного люркера — не отвлекаться) идёт по
  // задаче команды (ротация, сбор, ретейк), а рядом по знанию один враг — взгляд на него, ноги — на задаче
  if(b.post && taskProp(b.post.tag, "teamMove") && nE <= 1){ b._contact = {x:C.x, y:C.y, id:C.id, until: tick + CONTACT_HOLD*TICK_HZ, lock:false}; b._contactT = tick; return; }
  // (v418, скрин владельца 25.10: T впятером вышли на A и стреляются с 9-м, 5-й рядом «держит» — врагов 5 > своих 2 + 1) счёт тел не
  // различал «идут на меня» и «стреляются с моим»: свой рядом в бою с этой группой — выходит (стрелять, пока свой ещё жив, — кроссфайр,
  // PRO_PLAY 3: «кроссфайры — хлеб с маслом»). Только то, что игрок знает: свой стреляется рядом (слышно), его противник — в знании команды
  // (v450, док владельца 28.10 №5: «раш B — слишком долго стояли в B Apps, всех убили по одному, никто не вышел»; м17 р17: T 26 с в Apps с
  // задачей «держу свой контакт») в выходе T (фаза execute до планта) контакт — это заход: выходит, если их не вдвое больше, чем нас рядом
  // (PRO_PLAY: выход — быстро, вместе, с разменом); держать угол — только одному против многих. Носителю — ниже (не выходит, но и не встаёт)
  var tExec = b.team === "T" && teamTac.T && teamTac.T.phase === "execute" && bomb && bomb.state !== "planted";
  // (Г4, 04.11, разбор отметок п.2: T4 вышел на CT3 с 9 патронами в перезарядке) на перезарядке на врага не выходит — держит угол
  var swing = !b._reloading && b.hp > LOW_HP && (Math.max(1, nE) <= nM + 1 || !!contactMateFight(b, C) || hlHot(b) || (tExec && nE <= 2*(nM + 1)));   // (v447) в ударе — выходит и на численный перевес
  // (v469, п.21 владельца 29.10, р9 м1: свой стрелялся с magixx за двумя смоками, m0NESY стоял в contact hold) правило v418б «не выходить
  // из-за дыма на врага» убрано по решению владельца: выход решают те же условия, что без дыма — свой рядом в бою с этой группой
  // (contactMateFight), враги не в численном перевесе, HP; дым больше не запрещает выйти помочь
  // (v440, док владельца 27.10: magixx с бомбой «делал агрессию в андере», р8 — с бомбой и 22 HP ждал файта) носитель бомбы на выход не идёт,
  // пока жив кто-то ещё из своих: бомба в первом бою — потеря раунда; держит угол (последний живой — играет сам)
  // (00_PLAN, ответ владельца 05.11 — схема «после перестрелки»: «противник может повторно выйти — удерживает угол из укрытия; повторный выход —
  // только при преимуществе: союзник готов к размену, флешка, противник перезаряжается, надо сорвать плант; не обязательное желание повторить
  // перестрелку») после СВОЕЙ перестрелки с этим врагом (сам видел его и стрелял за CONTACT_AGE) выход — только с преимуществом; численность
  // (nE ≤ nM + 1) и «в ударе» — не повод. Нет преимущества — «накиньте флешку» (365); некому — держит угол
  var fought = C.seen && C.id && tick - (b.lastShotTick || -1e9) <= CONTACT_AGE*TICK_HZ;
  if(fought && swing){
    var HR = b._heardReload, PHc = teamIntel[b.team] && teamIntel[b.team].plantHeard;
    var adv = !!contactMateFight(b, C)
      || bots.some(function(o){ return o !== b && o.alive && o.team === b.team && !o._sawEnemy && nearP(o.x, o.y, o.z, b.x, b.y, b.z, TRADE_R); })   // размен рядом
      || !!(HR && HR.id === C.id && tick < HR.until)                                                                                            // перезаряжается
      || !!(b.team === "CT" && PHc && tick - PHc.tick < 5*TICK_HZ)                                                                               // сорвать плант
      || duelHits(b._hitOut, tick - CONTACT_AGE*TICK_HZ, C.id) > duelHits(b._hitIn, tick - CONTACT_AGE*TICK_HZ, null)
      // (v521, владелец 10.11: «после боя слишком долго стоят»; ответ про дуэли: «по ситуации — мало HP у обоих: могут отойти, могут допушить»)
      // размен с ним сейчас не проигрышный (та же оценка, что повторный пик в бою — 470 duelOdds) — тоже преимущество
      || !!(function(){ var eo = C.id ? teamBot(C.id) : null, o = eo ? duelOdds(b, eo, C.x, C.y) : null; return o && o.ok; })();                         // (дуэли 06.11) ранил его больше, чем получил, — добить
    if(!adv && !C.own) adv = !!nadeAskFlash(b, look, "флешу под пик "+b.id+" ("+calloutName(look.x, look.y)+")");
    if(!adv) swing = false;
  }
  if(swing && bomb && bomb.state === "carried" && bomb.carrier === b && aliveCount(b.team) > 1) swing = false;
  // (v547, ответ владельца 10.11: «T на пост-планте незачем искать дуэли — сидит, ждёт, смотрит, откуда придут; дефузят — идёт сбивать (антидефуз —
  // задача бомбы)») и на сейве на врага не выходит (держит / смотрит с места)
  if(swing && ((b.team === "T" && bomb && bomb.state === "planted") || (taskAlive(b) && taskProp(b._task.tag, "saveTask")))) swing = false;
  // (v450) носитель в выходе не встаёт «держать контакт»: идёт за своими на точку планта (взгляд — на контакт, задача — прежняя)
  // (v555, м298 р1: бомба лежала на Balcony, идущий за ней 5 с «держал контакт», и выход стоял) и тот, кто идёт за выпавшей бомбой, — тоже
  if(tExec && ((bomb.state === "carried" && bomb.carrier === b) || (bomb.state === "dropped" && teamTac.T.fetchId === b.id)) && aliveCount(b.team) > 1){ b._contact = {x:C.x, y:C.y, id:C.id, until: tick + CONTACT_HOLD*TICK_HZ, lock:false}; b._contactT = tick; return; }
  // (v555, отметка владельца м298 р1: «раш вышел и стоит, перестреливаются; почему не пойти втроём и не задушить одного, занять его зону»)
  // в выходе T на одного врага выходят вместе (размен сразу); вне выхода — по-прежнему один выходит, остальные держат
  if(swing && !tExec && bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o._contact && o._contact.tag === "contact:swing" && tick < o._contact.until && Math.hypot(o._contact.x-C.x, o._contact.y-C.y) < 200; })) swing = false;   // на него уже выходит свой
  // (v438, док владельца 27.10: точка «выхожу на него» на ящике Short / в Underpath без вида на врага — бот стоял 22 с) точка — на полу
  // своего уровня (не крыша ящика, не другой этаж: navAtLevel) и, если выходит, — оттуда видно место врага (3D-видимость с пола точки).
  // Нет такой — не выходит, держит (точку держать ищем так же, но вид не обязателен: держит угол, откуда враг придёт)
  // (v469) и держать — только оттуда, откуда видно место врага (с его этажом): точка «держу» без вида — п.13
  var spotOk = function(q){ var a = b.z == null ? null : navAtLevel(q.x, q.y, b.z); if(b.z != null && !a) return false;
    return hasLOS(q.x, q.y, look.x, look.y, a ? a.z : b.z, C.z); };
  var contactSpots = function(sw, rS){ var c0 = rS ? {x:b.x + (look.x-b.x)*0.5, y:b.y + (look.y-b.y)*0.5} : {x:b.x, y:b.y};   // заход — вокруг полпути к врагу (0,5, 12 точек — проектные)
    return pickSpots("ct"+b.id+Math.round(look.x/40)+","+Math.round(look.y/40)+(sw ? "s"+(rS||"") : "h"), c0, rS ? 12 : 6, {rMax: sw ? (rS || CONTACT_SWING) : 160, minGap:30, see:[look]})
    .filter(function(q){ return Math.hypot(q.x-look.x, q.y-look.y) >= 120 && !spotTaken(b, q) && spotOk(q); }); };
  var cand = contactSpots(swing);
  // (v555, м298 р1: раш стоял в Tetris — точки «выйти на врага» с видом на Cross ближе 220 ед. нет, выход превращался в «держать угол») в выходе
  // T заход — дальше, в зону врага (до CONTACT_PUSH ед.): занять её, а не стоять на краю
  if(swing && !cand.length && tExec) cand = contactSpots(true, CONTACT_PUSH).filter(function(q){ return pathLenTo(b, q.x, q.y) <= CONTACT_PUSH; });
  if(swing && !cand.length){ swing = false; cand = contactSpots(false); }
  if(hasLOS(b.x, b.y, look.x, look.y, b.z, C.z) && !swing) cand.unshift({x:b.x, y:b.y});
  cand.sort(swing ? function(a, c){ return Math.hypot(a.x-look.x, a.y-look.y) - Math.hypot(c.x-look.x, c.y-look.y); }
                  : function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); });
  var sp = cand[0]; if(!sp) return;
  var tag = swing ? "contact:swing" : "contact:hold";
  // (v378) задача важнее контакта (бомба, сейв — арбитр места, setPost) — ноги остаются на ней, взгляд — на контакт
  if(!setPost(b, sp, look, true, tag)){ b._contact = {x:C.x, y:C.y, id:C.id, until: tick + CONTACT_HOLD*TICK_HZ, lock:false}; b._contactT = tick; return; }
  b._contact = {x:C.x, y:C.y, id:C.id, until: tick + CONTACT_HOLD*TICK_HZ, lock:true, pt:sp, tag:tag}; b._contactT = tick;
  b._reposUntil = 0; b._probeLock = 0; b.lastIntel = {x:look.x, y:look.y, tick:tick, src:"call"};
  if(swing && !C.own && b.nades && b.nades.flash > 0 && C.d > 150 && !hasLOS(b.x, b.y, look.x, look.y, b.z)) assignNade(b, "flash", look, "флешка под выход на врага рядом", {now:true, range:900});
  // (v443, док владельца 27.10: «войс раунда спамится») «держу X» — 23 строки за раунд, один бот повторял её ~3 раза: это пересказ своих
  // действий, а в войсе про — враг, где и сколько, свои гранаты (PRO_PLAY, «Войс»). «Держу» не говорится; «выхожу на него» — один раз
  // на врага за раунд (у каждого нового выбора точки раньше — снова)
  if(swing){ var sk = C.id || calloutName(look.x, look.y), SS = b._swSaid && b._swSaid.r === roundNum ? b._swSaid : (b._swSaid = {r:roundNum});
    if(!SS[sk]){ SS[sk] = 1; voiceLog(b.team, "ct"+b.id+Math.round(tick/64), b.id, "выхожу на него "+calloutName(look.x, look.y)); } }
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
// ======================= (v518a, пак владельца 09.11, п.6) РЕАКЦИЯ НА УРОН — одно место для любого состояния =======================
// Владелец (А-28): «игрок стоял на виду, получил урон, но вместо того, чтобы уйти за укрытие или кинуть гранату, просто стоял, ему кинули HE,
// и он умер»; «в постпланте … то же, только в другом состоянии». Было: «ранен» ставили только пули, а читали его три частных правила со своими
// условиями (откат T — только setup до планта, откат CT — только впереди сайтов, «засветился» — только на посту и если сам видел врага).
// Теперь: ранили (пуля, HE; огонь — выходит своим ходом, 540), а стрелка не видит и не в перестрелке (иначе это бой — 470) — уходит из-под
// линии, откуда прилетело (то, что знает живой игрок: откуда выстрел / где разорвалось), на ближайшее место своего этажа, откуда той точки не
// видно, ≤ HURT_R. Это отклонение с возвратом (detourOk / detourStart, 110): главная задача потом ставит свою точку снова (уже от нового места)
// — кроме «ставит / дефузит / бомба» (contactCritical, уровень 11). Взгляд — туда, откуда прилетело (look поста).
var HURT_R = 220, HURT_REACT = 32;   // px, тики (0,5 с — реакция) — проектные числа
function hurtReactTick(b){
  if(!b.alive || !b._hurtT || b._hurtDone === b._hurtT) return;
  b._hurtDone = b._hurtT;
  if(tick - b._hurtT > HURT_REACT || b._sawEnemy || b._fc || b._hurtSrc === "молотов") return;
  var F = b._hurtFrom; if(!F || contactCritical(b)) return;
  if(taskAlive(b) && b._task.lv >= 11) return;
  var fz = F.z != null ? F.z : null;
  var cand = pickSpots("hurt"+Math.round(b.x/30)+","+Math.round(b.y/30)+"|"+Math.round(F.x/60)+","+Math.round(F.y/60), {x:b.x, y:b.y}, 6, {rMax:HURT_R, minGap:30, hideFrom:[F]})
    .filter(function(q){ var a = b.z == null ? null : navAtLevel(q.x, q.y, b.z); if(b.z != null && !a) return false;
      return !spotTaken(b, q) && !hasLOS(q.x, q.y, F.x, F.y, a ? a.z : b.z, fz); })
    .sort(function(p, q){ return Math.hypot(p.x-b.x, p.y-b.y) - Math.hypot(q.x-b.x, q.y-b.y); });
  var sp = cand[0]; if(!sp) return;
  var sec = pathLenTo(b, sp.x, sp.y)/SPEED;
  if(sec > DETOUR_MAX.hurt || (!taskCanSet(b, "repos:hurt") && !detourOk(b, "hurt", sec))) return;
  detourStart(b, "hurt", "repos:hurt", sec + 1.5);
  if(!setPost(b, sp, {x:F.x, y:F.y}, true, "repos:hurt")){ b._detour = null; return; }
  if(b.state === "hold") leaveHold(b);
  b._reposUntil = 0; b._probeLock = 0;
  logEvent(b.id+": ранен ("+b._hurtSrc+") — ухожу из-под линии "+calloutName(F.x, F.y)+" за укрытие");
}
function teamBrains(){
  if(roundState !== "live" || !teamTac.T) return;
  bombTick();
  if(roundState !== "live") return; // дефуз мог только что закончить раунд
  routeTick();
  bots.forEach(function(b){ contactTick(b); hurtReactTick(b); });   // (v367) реакция на контакт — до мозгов, их посты её не перебивают; (v518a) и на урон
  bots.forEach(function(b){ ctDelayNade(b); });   // (v419) задержать гранатой — после реакции на контакт (знает, держит ли угол)
  SPOT_TEAM = "T"; tBrain(); SPOT_TEAM = "CT"; ctBrain(); SPOT_TEAM = null; endgameBrain(); lineupTick(); smokeEdgeTick(); smokeLineTick(); fireSmokeTick(); weaponPickupTick(); itemPickupTick(); lkpTick();
  if(BAL.soundMore) bots.forEach(function(b){ if(b.alive && b._heardReload) reloadPeek(b); });
  if(BAL.assistPeek && tick % 4 === 0) bots.forEach(function(b){ if(b.alive) assistPeek(b); });
  if(BAL.lowHpBack && tick % 8 === 2) bots.forEach(function(b){ if(b.alive) lowHpBack(b); });
  if(BAL.hurtCall && tick % 8 === 4) bots.forEach(function(b){ if(b.alive) finishPush(b); });
  smokeFadeTick(); awpSmokeTick(); bombPassTick();
}

