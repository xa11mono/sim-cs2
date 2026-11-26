// (v273) разбор взгляда: какой бот выбран для показа (галочка «разбор взгляда» + клик по игроку). Только для записи —
// игру не меняет: при включённой галочке каждый бот пишет кандидаты взгляда с множителями, зоны с опасностью и этапы
// выбора (всем — чтобы на паузе можно было переключаться между игроками)
var LOOKDBG = {on: false};
function lookDbgId(){ return LOOKDBG.on && typeof plSelected !== "undefined" ? plSelected : null; }
// ======================= АРБИТР ВЗГЛЯДА (v381, М126 шаг 4) =======================
// Одно место выбора, куда смотрит бот (кроме «вижу врага» — это выше, в resolveEngagements). Механики только предлагают
// кандидатов {уровень, вид, точка, вес}; арбитр берёт верхний уровень таблицы LOOK_LEVEL, внутри уровня — больший вес (свежее,
// ближе, важнее). Кандидаты — только из того, что бот знает: свои уши, радар (что видят свои), войс, киллфид. Роль и ситуация в
// таблицу не входят — они только порождают кандидатов (роумер — точку проверки, пост — свой угол). После выбора — один общий
// шаг lookFilter (не в своего, не в стену, плавность). Порядок — ПРОЕКТНЫЙ (docs/ARCHITECTURE.md, «Арбитр взгляда»).
var LOOK_LEVEL = {
  enemy:  12,  // враг виден (resolveEngagements)
  fight:  11,  // бой: свой закреплённый контакт ≤ 1 с, спам в смок, тиммейт попросил держать второй угол
  sound:  10,  // свои уши ≤ 1 с (шаги, выстрел, граната рядом), убили тиммейта рядом ≤ 3 с (киллфид + радар)
  team:    9,  // команда знает сейчас (видят / слышат / сказали ≤ 1 с)
  jump:    8,  // (v548) прыжок через щель: к отталкиванию — по направлению прыжка, в полёте — по дуге к приземлению (углы из демок)
  angle:   7,  // мой угол: поручен задачей (роум-чек, фейк-дефуз, точка про на посту) или выдан делёжом команды (lookPlan);
               // последняя позиция врага (1–8 с) и контакт старше 1 с — веса внутри дележа, чтобы чередовались с открытыми углами
  corner:  6,  // угол по пути, за которым может быть враг (prePeekTick)
  post:    4   // угол поста по сетапу (делёж ничего не выдал)
};
var KNOW_NEAR_SLACK = 60, LOOK_PRO_YIELD = 0.5;   // проектное число: ед. карты — «не дальше ближайшего известного» с запасом
var LOOK_FRESH = 64;   // 1 с (TICK_HZ): «свежее» для уровней fight / sound / team — проектное число (задача шага 4: «свежий, ≤ 1 с»)
function lookContactFresh(b){
  // (отметка владельца 18.11, м5 р2 т6382, CT1: «он должен сосредоточиться на контакте, который перед ним») бот выходит на свой контакт
  // (задача контакта, lock — точка выхода выбрана, 350) — взгляд держит его, пока задача идёт, а не только 1 с: шаги за стеной не перебивают
  var K = b._contact; if(!K || tick >= K.until) return false;
  if(K.lock && b.post && K.tag && b.post.tag === K.tag) return true;
  return tick - Math.max(b._contactT || -1e9, b._lastSawT || -1e9) <= LOOK_FRESH;
}
// точка взгляда на знание «враг там» (звук, контакт, инфа): не сквозь стену, а туда, где он выйдет на линию
// (v520, отметка владельца 09.11 м200 р2 «лагает»: путь «враг → я» для взгляда строился каждый тик у каждого бота на каждое знание — 4949
// путей за 23 с, 2,3 с) путь от места знания до бота — один на участок навмеша, где бот стоит, и обстановку огня; живёт LKP_PATH_TTL тиков
// (проектное число): бот на бегу пересекает участок за доли секунды — путь «откуда враг зайдёт» за это время не меняется
var LKP_PATH = {k: null, m: {}}, LKP_PATH_TTL = 32;
function lookKnowPath(b, q){
  var a = navOwnArea(b, b.x, b.y), fs = fires.map(function(f){ return f.born; }).join(","), kk = matchNum+":"+roundNum;
  if(LKP_PATH.k !== kk || LKP_PATH.n > 20000){ LKP_PATH.n = 0; LKP_PATH.k = kk; LKP_PATH.m = {}; }
  // (отметка владельца 18.11, м5 р2 т6382: шаги в Underpath под B Short) путь — с настоящими высотами: было 0 — путь от звука снизу начинался
  // на верхнем полу, «рядом» по прямой
  var key = Math.round(q.x)+","+Math.round(q.y)+","+(q.z != null ? Math.round(q.z/40) : "")+"|"+(a ? a.id : Math.round(b.x/16)+","+Math.round(b.y/16))+"|"+fs, e = LKP_PATH.m[key];
  if(!e || tick - e.t >= LKP_PATH_TTL || tick < e.t){ LKP_PATH.n = (LKP_PATH.n||0) + 1; e = LKP_PATH.m[key] = {t: tick, p: buildWaypointPath(q.x, q.y, q.z != null ? q.z : null, b.x, b.y, b.z) || []}; }
  return e.p;
}
var MOVE_SEEN = 6, MOVE_MIN = 8, MOVE_FAR = 320;   // проектные числа: с; ед. карты — сдвиг между «видели», дальше линии не продлеваем
function lookMovePt(b, q){
  var S = (teamIntel[b.team] && teamIntel[b.team].sig) || [], last = null, prev = null;
  for(var i = S.length-1; i >= 0 && tick - S[i].tick <= MOVE_SEEN*TICK_HZ; i--){ var s = S[i]; if(s.type !== "spotted" || s.id !== q.id) continue;
    if(!last) last = s; else if(DM.hypot(s.x-last.x, s.y-last.y) >= MOVE_MIN){ prev = s; break; } }
  if(!last || !prev) return null;
  var dx = last.x-prev.x, dy = last.y-prev.y, L = DM.hypot(dx, dy); dx /= L; dy /= L;
  var z0 = last.z != null ? last.z : null;
  for(var d = 40; d <= MOVE_FAR; d += 20){ var x = last.x + dx*d, y = last.y + dy*d, a = navAt(x, y, z0); if(!a || (z0 != null && Math.abs(a.z - z0) > JUMP_UP)) break;
    var fz = navFloorZ(a, x, y); if(hasLOS(b.x, b.y, x, y, b.z, fz)) return {x: x, y: y}; }
  return null;
}
function lookKnowPt(b, q, zb, mates, moving){
  var d = DM.hypot(q.x-b.x, q.y-b.y); if(d > 700 || d < 20) return null;
  // (v279, владелец 14.10: якорь B развернулся спиной к Ramp на бой на миде в 650 px) держит пост — дальняя инфа вне его угла не
  // отвлекает (holdRelevant: > 550 px и вне ±66° от угла поста)
  if(!q.commit && !holdRelevant(b, q)) return null;
  var za = DM.atan2(q.y-b.y, q.x-b.x);
  // (Г2, 04.11, ответ владельца 2: «отходит от известного врага — контролирует направление его повторного появления, не смотрит в одну
  // точку, уходя в другую сторону») правило «на бегу за спину — только самый свежий (≤ 0,3 с) и близкий (≤ 250)» убрано: известный враг
  // за спиной — такой же кандидат; что важнее — решают вес и арбитр (свежесть, дистанция)
  // (v280) туда, где враг от шума появится (первая видимая точка его пути ко мне); (v287) видна с места бота — не пересчитывать
  // (Г2, 04.11, разбор отметок п.18: T4 стрелял сверху из B Apartments через окно, линия видна в обе стороны — CT1 смотрел «где он появится
  // по пути» в Kitchen, себе за спину) место знания видно отсюда (3D, с его высотой) — смотреть на само место; не видно — как раньше
  var srcVis = hasLOS(b.x, b.y, q.x, q.y, b.z, q.z);
  var apf = srcVis ? null : appearFrom(b, q); if(apf) apf = {x: apf.x, y: apf.y, vis: true};
  // (отметка владельца 18.11, м5 р2 т6916, CT1 на Catwalk: «смотреть, куда придёт враг», нарисовал — вниз-влево, куда T0 уходил под Catwalk)
  // свой контакт пропал из вида — сначала туда, где он покажется, если идёт дальше, куда шёл (два последних «видели» команды ≤ MOVE_SEEN с:
  // направление; первая видимая отсюда точка этой линии на его этаже). Его путь ко мне (appearFrom) — если такой точки нет
  var mvp = (!srcVis && q.commit && q.id) ? lookMovePt(b, q) : null;
  var pt = srcVis ? {x: q.x, y: q.y} : (mvp || apf || cornerLook(b, q) || openToward(b, za, LOOK.sndOpen));
  // (v568, отметка владельца м3 р1 47 с, CT1: «смотрит вообще не туда, откуда стреляли») в перестрелке (_fc) враг выйдет на линию, через
  // которую стреляли, а не из прохода по пути пешком: точка по пути дальше CORNER_FIGHT_OFF от направления на него — смотреть по этой линии
  if(b._fc && pt && pt !== mvp && !srcVis && _angOff(DM.atan2(pt.y-b.y, pt.x-b.x), za) > CORNER_FIGHT_OFF){ var dl0 = Math.min(220, d); pt = {x: b.x + DM.cos(za)*dl0, y: b.y + DM.sin(za)*dl0};
    // (владелец 18.11: «всегда в сторону врага; стоит в упор к стенке — не в стенку, а чуть за край стенки, чтобы враг выходил под прицел»)
    if(lookWallClose(b, pt)){ var ce0 = cornerLook(b, q); if(ce0) pt = ce0; } }
  // (v281) видимой точки нет — место, где враг на своём пути зайдёт в мою зону
  if(!pt){ var wq0 = lookKnowPath(b, q);
    for(var wi0 = 0; wi0 < wq0.length; wi0++){ if(bzOf(wq0[wi0][0], wq0[wi0][1]) === zb){ var ep = {x: wq0[wi0][0], y: wq0[wi0][1]}; if(DM.hypot(ep.x-b.x, ep.y-b.y) > 40) pt = ep; break; } } }
  // (v296, И37) враг рядом (≤ 250 px), а ни угла, ни точки появления — смотрим прямо на место, где он был
  if(!pt && d <= 250) pt = {x:q.x, y:q.y};
  if(!pt) return null;
  // (v277) враг от шума к боту сначала выйдет на тиммейта, стоящего на его пути, — угол закрыт им
  var cov = null;
  if(d >= 300){ var wq = lookKnowPath(b, q);
    cov = mates.filter(function(o){ return wq.some(function(w){ return DM.hypot(w[0]-b.x, w[1]-b.y) > 150 && DM.hypot(w[0]-o.x, w[1]-o.y) <= 120; }); })[0] || null; }
  return {pt: pt, d: d, a: za, cov: cov};
}
// кандидаты уровней fight / sound / team: свежее знание
function lookKnowCands(b){
  var out = [], moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var zb = (b.atPost && b.post) ? bzOf(b.post.x, b.post.y) : bzOf(b.x, b.y); if(zb < 0) zb = bzOf(b.x, b.y);
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team; });
  // (отметка владельца 18.11 м33, m0NESY; «чинить механику целиком») знание (звук, инфа команды, «где убили своего») берёт взгляд, только если
  // это место не дальше по пути, чем ближайший враг, известный команде (≤ BACK_KNOW с): дальнее — в общей оценке углов. Свой контакт — всегда
  var BLk = kvLast(b.team), kMin = Infinity;
  for(var ek in BLk){ var lk = BLk[ek], ok = teamBot(ek); if(!lk || !ok || !ok.alive || tick - lk.tick > BACK_KNOW*TICK_HZ) continue;
    var dk = polyLen(pathPts(lk.x, lk.y, b.x, b.y, null, b.z)); if(dk < kMin) kMin = dk; }
  var add = function(lvl, kind, q, k){
    var c = lookKnowPt(b, q, zb, mates, moving); if(!c || (c.cov && !q.commit)) return;   // путь закрывает свой — угол его
    // (отметка владельца 18.11, м5 р2 т6382, CT1 на B Short: шаги T этажом ниже — по прямой 200, по пути 924 — перебили врага, убившего своего,
    // в 422 по пути) «близко» — по пути с высотами (сколько ему идти до меня), а не по прямой
    var dW = c.d; if(!q.commit){ var wp = lookKnowPath(b, q); if(wp.length > 1) dW = Math.max(dW, polyLen(wp)); if(dW > kMin + KNOW_NEAR_SLACK) return; }
    out.push({lvl: lvl, kind: kind, pt: c.pt, sc: LOOK.contactW * (dW < 300 ? 2 : 1) / (1 + dW/700) * Math.max(0.05, 1 - q.age/192) * (k || 1)});
  };
  // бой: прикрыть второй угол по просьбе тиммейта, спам в смок, свой контакт (v367; держится, пока видно или видели ≤ 1 с)
  if(b._coverDir && tick < b._coverDir.until && !b._sawEnemy) out.push({lvl: LOOK_LEVEL.fight, kind: "cover", pt: cornerLook(b, b._coverDir.pt) || b._coverDir.pt, sc: 1});
  if(b._spam && tick < b._spam.until) out.push({lvl: LOOK_LEVEL.fight, kind: "spam", pt: b._spam.pt, sc: 2});
  if(lookContactFresh(b) && !ignoredShooter(b, b._contact.id)) add(LOOK_LEVEL.fight, "contact", {x: b._contact.x, y: b._contact.y, id: b._contact.id, age: 0, commit: true}, 3);
  // свои уши ≤ 1 с; бросок гранаты рядом — враг точно там (v359)
  var hs = b.heardSound;
  // (v570, В135) выстрел / попадание от невидимого стрелка — взгляд, только если бот обратил на него внимание (noticeShooter, 210)
  if(hs && tick - hs.tick <= LOOK_FRESH && !((hs.kind === "shots" || hs.kind === "hit") && !noticeShooter(b, hs.src))) add(LOOK_LEVEL.sound, "sound", {x: hs.x, y: hs.y, z: hs.z, age: tick - hs.tick}, hs.kind === "nade" ? LOOK.freshK : 1);
  // убили тиммейта рядом ≤ 3 с: туда, откуда убили (убийцу видел он — точка на радаре), иначе место смерти.
  // (п.26 владельца 29.10, м1 р7: CT на B смотрели в Kitchen по смерти kyousuke на Ramp — проверки «рядом» в коде не было, срабатывала
  // любая смерть на карте) «рядом» — то же, что у отхода CT «свой убит рядом» (300: FB.deathR по прямой и по пути)
  var sg = teamIntel[b.team] && teamIntel[b.team].sig;
  // (отметка владельца 18.11, м33 р1 т2629, kyousuke: «смотрит Jungle, т. к. убили на миду, но забывает про врага на A») было ≤ 3 с на уровне
  // «свои уши» — вес 0,11 перебивал угрозу 9,4 (арбитр по уровням); теперь, как свой звук и инфа команды, ≤ LOOK_FRESH: дальше убийца уже в
  // знании команды (киллфид) и взвешивается вместе со всеми в оценке углов
  if(sg) for(var i = sg.length-1; i >= 0; i--){ var s = sg[i]; if(tick - s.tick > LOOK_FRESH) break;
    if(s.type !== "died" || s.id === b.id) continue;
    if(DM.hypot(s.x-b.x, s.y-b.y) >= FB.deathR || polyLen(pathPts(b.x, b.y, s.x, s.y, b.z)) >= FB.deathR) continue;
    add(LOOK_LEVEL.sound, "death", {x: s.kx != null ? s.kx : s.x, y: s.kx != null ? s.ky : s.y, age: tick - s.tick}); break; }
  // команда знает сейчас: видят (радар) / слышали / сказали ≤ 1 с; в упор (≤ 250 px) — та же «свежая угроза», что у зоны
  var BL = kvLast(b.team);
  for(var eid in BL){ var lo = BL[eid]; if(!lo || tick - lo.tick > LOOK_FRESH) continue;
    var eb = bots.filter(function(o){ return o.id === eid; })[0]; if(!eb || !eb.alive) continue;
    add(LOOK_LEVEL.team, "team", {x: lo.x, y: lo.y, age: tick - lo.tick}, lo.src === "spotted" && DM.hypot(lo.x-b.x, lo.y-b.y) <= 250 ? LOOK.freshK : 1); }
  return out;
}
// уровень angle: угол, поручённый задачей, иначе угол из дележа команды
// поручённый угол стоя: держит главный — угрозу из дележа, если её вес ≥ LOOK_PRO_YIELD (проектное число), иначе поручённый, — а второй
// (угроза весом ≥ LOOK.claimMin или поручённый) оставляет на «мельком глянуть» (b._lkAltPt → smoothLookFilter: раз в SL.glEvery на SL.glDur —
// те же числа, что мельком на ходу). Угроза в ту же сторону (< SL.glMin) — второго угла нет
function lookAssigned(b, ptA){
  var lpk = b._lkPick, thr = lpk && b._lkPt && lpk.sc >= LOOK.claimMin ? ((b._lkPt.vis ? b._lkPt : cornerLook(b, b._lkPt)) || b._lkPt) : null;
  var A = {lvl: LOOK_LEVEL.angle, kind: "pro", pt: ptA, sc: 1};
  if(!thr || _angOff(DM.atan2(thr.y-b.y, thr.x-b.x), DM.atan2(ptA.y-b.y, ptA.x-b.x)) < SL.glMin) return A;
  if(lpk.sc >= LOOK_PRO_YIELD){ b._lkAltPt = ptA; return {lvl: LOOK_LEVEL.angle, kind: "look", pt: thr, sc: 1}; }
  b._lkAltPt = thr; return A;
}
function lookAngleCand(b, moving){
  if(b.roamChecking && b.roamLookPt) return {lvl: LOOK_LEVEL.angle, kind: "roam", pt: b.roamLookPt, sc: 1};
  if(b.fakeHoldUntil && tick < b.fakeHoldUntil && bomb && bomb.site) return {lvl: LOOK_LEVEL.angle, kind: "fake", pt: GEO[bomb.site].tEntry, sc: 1};
  // (v583a, владелец 17.11: «более живыми — могут смотреть одну позицию, потом распределиться; не только два угла про») место после планта
  // (post.ppAlt, 280) угол про не навязывает: взгляд — по дележу команды (lookPlan), как у всех
  // (отметка владельца 18.11, м1 р2: «игрок 5 не учитывает Under»; «чередовать») поручённый угол (место про — proSpotLook; угол роли сетапа CT из
  // демок — post.setupLook) и угроза из дележа команды — один выбор lookAssigned. Было: поручённый угол всегда, что бы ни было вокруг
  b._lkAltPt = null;
  if(b.atPost && b.post && b.post.pro && !b.post.ppAlt && !moving){ var plk = proSpotLook(b); if(plk) return lookAssigned(b, plk); }
  // (15.11, владелец: «точки в паре, чтобы смотрели все зоны, откуда выходят T») угол роли расстановки CT из демок (spot / lookYaw, 140) — поручен
  // задачей, как точка про на посту. Было: делёж углов команды перебивал его — на 20-й с угол роли держали редко (уход — медиана 27°), выход
  // из Palace закрывали в 0–17 % раундов против 43–66 % у про (tools/ct/ct_cover.js)
  if(b.post && b.post.setupLook && b.post.look && b.atPost && !moving) return lookAssigned(b, b.post.look);
  // (v583a, Д16) шаг-проверка после планта (post.lookMoving, 280) — смотрит на проверяемый вход и на ходу
  if(b.post && b.post.setupLook && b.post.look && b.post.lookMoving) return {lvl: LOOK_LEVEL.angle, kind: "pro", pt: b.post.look, sc: 1};
  if(!b._lkPt) return null;
  // (отметка владельца 18.11, м1 р2, видео игрока 6: «почему жёлтая линия левее») на ходу угол из дележа весом меньше LOOK.claimMin (угрозы почти
  // нет: 0,00–0,03) взгляд не ведёт — смотрит по ходу и на углы по пути (cornerLook). Было: такие углы менялись каждые 0,25–0,5 с (Jungle → Vent →
  // Window → CT Spawn за 0,8 с), рука догоняла их на 90–180° и не успевала
  if(moving && !(b._lkPick && b._lkPick.sc >= LOOK.claimMin)) return null;
  // (v259, В2) после планта на бегу не идёт спиной вперёд ради угла из дележа (догадка, не свежая угроза): смотрит, куда идёт.
  // Отход (repos, flee, save) — исключение. После планта у ботов спиной было T 20 % / CT 15 %, у про 10 / 6,5 %
  if(moving && bomb && bomb.state === "planted" && !(b.post && taskProp(b.post.tag, "lookAlongRetreat")) && !(b.lastIntel && tick - b.lastIntel.tick < CAUTION_TICKS) &&
     _angOff(DM.atan2(b._lkPt.y-b.y, b._lkPt.x-b.x), lookHeading(b)) > 1.9) return null;
  return {lvl: LOOK_LEVEL.angle, kind: "look", pt: (b._lkPt.vis ? b._lkPt : cornerLook(b, b._lkPt)) || b._lkPt, sc: 1};
}
// (Р3.2, канал «взгляд», шаг 1) заявки и ответ арбитра — отдельно от исполнения: lookArbiterR собирает заявки (кандидаты с уровнем
// LOOK_LEVEL) и отвечает {pt, lvl, kind, C} — ничего не пишет в бота; запись причины и уровня — lookApply (одно место, и для «враг виден», 275);
// lookArbiter — прежний ответ «точка» для старого вызова. Порядок заявок и выбор — дословно как было (Э1)
function lookArbiter(b){ return lookApply(b, lookArbiterR(b)); }
function lookApply(b, R){
  b._lookLvl = R.lvl; b.lookReason = R.kind;
  if(LOOKDBG.on) b._ldArb = R.C ? R.C.map(function(c){ return {lvl: c.lvl, kind: c.kind, sc: c.sc, pt: c.pt}; }) : null;
  return R.pt;
}
function lookArbiterR(b){
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var C = lookKnowCands(b), ang = lookAngleCand(b, moving);
  if(ang) C.push(ang);
  else {
    // (v135) угол по пути, за которым может быть враг: прицел на край
    var P = b._pie; if(P && P.danger > 0 && tick - P.t < 16 && P.dist < 320 && hasLOS(b.x, b.y, P.pt.x, P.pt.y, b.z)) C.push({lvl: LOOK_LEVEL.corner, kind: "corner", pt: P.pt, sc: P.danger});
    if(!moving && b.atPost && b.post && b.post.look) C.push({lvl: LOOK_LEVEL.post, kind: "post", pt: cornerLook(b, b.post.look) || b.post.look, sc: 1});
  }
  var jl = jumpLook(b); if(jl) C.push(jl);
  var best = null;
  C.forEach(function(c){ if(c.pt && (!best || c.lvl > best.lvl || c.lvl === best.lvl && c.sc > best.sc)) best = c; });
  return {pt: best ? best.pt : null, lvl: best ? best.lvl : 0, kind: best ? best.kind : null, C: C};
}
// (v548, владелец 10.11, скрины прыжка с фургона на B Apps: «разбег — смотрит на машину; запрыгивает — по дуге поворачивает к приземлению»)
// взгляд у прыжка через щель (NAV_GAPS, 050) — как у про (gaps_bake: yaw0 — при отталкивании, yaw1 — при приземлении, к направлению прыжка):
// у края (≤ JUMP_TURN_R до точки отталкивания, следующий шаг пути — прыжок) — доворот к yaw0; в полёте — плавно от yaw0 к yaw1.
// Про к отталкиванию уже смотрят почти по прыжку (фургон → B Apps: +5° → +11°). JUMP_TURN_R — проектное число
var JUMP_TURN_R = 40;
var LAND_HOLD = [16, 42, 90];   // тики: сколько держится взгляд после приземления (квартили про, выгрузка 64 Гц Mirage)
function landLook(b){ b._land = {t: tick, a: b.facing, h: Math.round(handQ(LAND_HOLD, hashRand(tick*71 + b.id.charCodeAt(b.id.length-1)*13), 0.5, 2.1))}; }   // приземлился — держать этот взгляд (jumpLook)
function jumpLook(b){
  // (v549, владелец 11.11: «прыгает и не поворачивает») углы — на карте, из демок (climbs_bake / gaps_bake): при отталкивании (yaw0), на
  // промежуточной стоянке (yawM), при приземлении (yaw1); между ними — плавно, кратчайшим поворотом. Было (v548): угол к направлению «низ → верх» —
  // у подъёма оно случайное (низ и верх почти друг над другом)
  var R = Math.PI/180, lerp = function(a, c, q){ var d = DM.atan2(DM.sin(c - a), DM.cos(c - a)); return a + d*q; };   // (v560, В105) кратчайший поворот при любых углах: % в JS у отрицательных — отрицателен, был круг 360°
  var cand = function(a){ return {lvl: LOOK_LEVEL.jump, kind: "jump", pt: {x: b.x + DM.cos(a)*200, y: b.y + DM.sin(a)*200}, sc: 1}; };
  var C = b._climb, Y = C && C.jump ? (C.G || C.Y) : null;
  // в полёте — от угла, с которым оттолкнулся сам бот (C.a0; отталкивается он не из той же точки, что про), к углу приземления про
  // (В147) угол на промежуточной стоянке (yawM) не используется: он снят одним кадром выгрузки 4 Гц в миг ухода с ящика — у 37 % подъёмов
  // Mirage он в стороне > 45° от углов отталкивания и приземления (их разница — медиана 5°), а по выгрузке 64 Гц про между прыжками
  // поворачивают на 4,7° (медиана; мерка формы air_between). Было: a0 → yawM → yaw1 — у Window боты разворачивались на 100–145° и обратно
  if(Y){ var ph = climbPhase(C), a0 = C.a0 != null ? C.a0 : Y.yaw0*R;   // (v550) по фазам подъёма (370)
    var q = C.mid ? (ph.seg === 1 ? ph.q*0.5 : ph.seg === 0 ? 0.5 : 0.5 + ph.q*0.5) : ph.q;
    return cand(lerp(a0, Y.yaw1*R, q)); }
  // (В147) после приземления взгляд держится: у про до поворота > 10° проходит q25 / медиана / q75 = 16 / 42 / 90 тиков (выгрузка 64 Гц,
  // 2555 прыжков) — LAND_HOLD; было: сразу осмотр углов / по ходу (между прыжками цепочки поворот 27–31° против 4,7° у про)
  var Ld = b._land; if(Ld && tick - Ld.t <= Ld.h && !b._sawEnemy) return cand(Ld.a);
  var P = b._jumpPrep; if(P && tick - P.t <= 2) return cand(P.a);   // у края — доворот к прыжку (370: jumpFaceWait, подход к подъёму)
  if(b.path && b.pathIdx < b.path.length){
    for(var i = b.pathIdx; i < Math.min(b.path.length, b.pathIdx + 3); i++){ var kk = navGapKey(b.path[i][0], b.path[i][1]), g = NAV_GAP_AT[kk];
      if(g && DM.hypot(g.a.x - b.x, g.a.y - b.y) <= JUMP_TURN_R) return cand(g.yaw0*R);
      // (В147) и подъём из демок впереди (CLIMB_AT — путь идёт через его верх): между прыжками цепочки взгляд остаётся на прыжке — у про между
      // прыжками поворот 4,7° (медиана, мерка формы air_between), у ботов был 27–31°: «осмотр углов» (42 %) и «по ходу» (29 %) между прыжками
      var cu = CLIMB_AT[kk]; if(cu && cu.Y && Math.abs(b.path[i][2] - cu.hi.z) < 1 && DM.hypot(cu.lo.x - b.x, cu.lo.y - b.y) <= JUMP_TURN_R) return cand(cu.Y.yaw0*R); } }
  return null;
}
// общий шаг после выбора: не в спину своему, не в стену, плавный поворот (на бегу без цели — по ходу)
// (v583a, Д9, владелец 17.11: «в 3D боты смотрят в стенку рядом с окном, а не в проём») видна ли точка взгляда из глаз — кэш на бота: бот сдвинулся
// меньше 8 px и точка меньше 16 px — тот же ответ (CLAUDE.md §7: линия видимости на пару «бот — точка» один раз за решение)
function lookVisible(b, p){
  var C = b._lvc; if(C && Math.abs(C.x-b.x) < 8 && Math.abs(C.y-b.y) < 8 && Math.abs(C.lx-p.x) < 16 && Math.abs(C.ly-p.y) < 16) return C.r;
  var r = hasLOS(b.x, b.y, p.x, p.y, b.z); b._lvc = {x: b.x, y: b.y, lx: p.x, ly: p.y, r: r}; return r;
}
// (v583a, владелец 17.11: «взгляд в стену — только когда стоят к стенке впритык: это отворот от флешки») стена по направлению на точку ближе
// LOOK_WALL_CLOSE px — угол про из демок остаётся как есть; дальше — смотреть, откуда выйдет враг (проектное число: 40 px ≈ 100 ед., шаг-полтора)
var LOOK_WALL_CLOSE = 40;
function lookWallClose(b, p){ var a = DM.atan2(p.y-b.y, p.x-b.x); return !hasLOS(b.x, b.y, b.x + DM.cos(a)*LOOK_WALL_CLOSE, b.y + DM.sin(a)*LOOK_WALL_CLOSE, b.z); }
function lookFilter(b, look, LD){
  // (v583a, Д9) точка за стеной (стоя на посту, звук, направление про, зона плана) — не в стену, а туда, где враг из неё выйдет на мою линию
  // (первая видимая точка его пути ко мне — appearFrom; нет — ближайший видимый угол по пути). Враг на виду, прострел (spam), прыжок — как есть;
  // угол про из демок (pro) — только если стена впритык (lookWallClose): отворот от флешки (владелец 17.11); дальше — как все.
  // Было: по всем ботам взгляд в невидимую точку ~19 % времени (м302 р2–р4)
  // (отметка владельца 18.11, м5 р2 т6837, CT1: «увидел игрока 0, посмотрел на него и отвернулся») свой контакт — не сюда: его точку уже
  // считает lookKnowPt (в перестрелке — по линии на врага, 250: CORNER_FIGHT_OFF); здесь её меняли на «где выйдет по пути ко мне» — в сторону
  // (18.11, «чинить механику целиком») и звук / инфа команды / «где убили своего» — их точку тоже уже считает lookKnowPt (видна — сама точка,
  // нет — где он выйдет на линию / по ходу его движения)
  if(look && !b._sawEnemy && !/^(enemy|spam|jump|contact|sound|team|death)$/.test(b.lookReason || "") && !(b.lookReason === "pro" && lookWallClose(b, look)) && !lookVisible(b, look)){
    var apL = appearFrom(b, look) || cornerLook(b, look);
    if(apL && apL !== look && lookVisible(b, apL)){ look = apL; if(LD) LD.steps.push("точка за стеной — смотрю, откуда выйдет"); } }
  if(look && b._lookLvl <= LOOK_LEVEL.angle && lookOnMate(b, look)){ var alt = openDirLook(b);
    if(alt){ look = alt; b.lookReason = "open"; if(LD) LD.steps.push("на линии свой — взял другое открытое направление"); }
    // (v413, Б5д-3) на бегу открытого направления впереди нет — по ходу движения, а не в спину своему
    else if(b.curSpeed > 60*SPD_K){ look = null; b.lookReason = null; if(LD) LD.steps.push("на линии свой, впереди открытого нет — по ходу движения"); } }
  // (п.5 владельца 29.10, м1 р2 т12072: по zont1x стреляли из B Short, арбитр выбрал «на звук», а этот фильтр повернул его на «открытое
  // рядом» — Stove, стрелок в 45–79° от взгляда) на звук / свой контакт — угол, из-за которого враг (cornerLook), даже если стена близко
  // (v551) взгляд на прыжок («jump») — в препятствие, на которое прыгает (фургон, ящик): «стена по взгляду» его не подменяет открытым направлением
  if(look && !/^(enemy|pro|sound|contact|jump)$/.test(b.lookReason || "")){ var lw0 = look; look = openLook(b, look); if(LD && look !== lw0) LD.steps.push("стена по взгляду — взял открытое направление рядом"); }
  if(!b._sawEnemy && !/^(enemy|spam|cover|contact|sound|jump)$/.test(b.lookReason || "")){   // (п.5) и на звук — угол врага, не «открытое»
    var wla = look ? DM.atan2(look.y-b.y, look.x-b.x) : (!(b.curSpeed > 15*SPD_K) && b.facing !== undefined ? b.facing : null);
    if(wla !== null && flatWallAhead(b, wla, 80)){ var wal = openDirNear(b, wla); look = wal || null; if(wal) b.lookReason = (b.lookReason||"") + "+open"; if(LD) LD.steps.push(wal ? "стена в 80 px — повернул на открытое" : "стена в 80 px — открытого нет"); }
  }
  var urg = lookUrgent(b), lk0 = look;
  look = smoothLookFilter(b, look, urg);
  if(LD){ LD.urgent = urg; if(look !== lk0) LD.steps.push(look ? "плавность: держит прежний угол ещё " + (b._sl ? Math.max(0, ((b._sl.hold || 0) - (tick - b._sl.since))/TICK_HZ).toFixed(1) : "?") + " с" : "плавность: пока смотрит по ходу");
    if(b.lookReason === "glance") LD.steps.push("на бегу мельком глянул на опасный угол сбоку"); }
  return {look: look, urgent: urg};
}

// Входы в район (вокруг center, радиус r), взвешенные по тому, сколько врагов
// вероятно за каждым из них. Для выбора позиции: смотреть на главный вход
// (или два), от остальных — закрыться стеной.
function threatEntrances(team, center, r){
  if(!BZ.portal) bzPortals();
  var inside = {}; BZ.cent.forEach(function(c, i){ if(c && DM.hypot(c.x-center.x, c.y-center.y) <= r) inside[i] = 1; });
  var zc = bzOf(center.x, center.y); if(zc >= 0) inside[zc] = 1;
  var E = [];
  Object.keys(inside).forEach(function(is){ var i = +is;
    BZ.nbr[i].forEach(function(nn){ if(inside[nn]) return; var p = BZ.portal[i][nn]; if(!p) return;
      var w = beliefZoneKnown(team, nn);
      // (18.11, «чинить механику целиком») соседи — той же nbrThreat, что во взгляде: враг, чей проход видит свой, — с весом watchedNbr
      BZ.nbr[nn].forEach(function(n2){ if(!inside[n2] && reachPossible(team, n2)) w += LOOK.nbrW * nbrThreat(team, nn, n2, zc); });
      if(reachPossible(team, nn)) w += 0.02;
      var m = E.filter(function(e){ return DM.hypot(e.pt.x-p.x, e.pt.y-p.y) < 120; })[0];
      if(m){ m.w += w; } else E.push({pt:p, w:w, z:nn}); }); });
  E.sort(function(a, b){ return b.w - a.w; });
  return E;
}


