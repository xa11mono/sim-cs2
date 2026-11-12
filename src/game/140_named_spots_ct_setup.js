// ---- позиции по названиям зон: кто где держит, занимает, ставит, ретейкает ----
// Порядок = приоритет (первые выбираются чаще, последние — реже, как офф-углы).
var POS = MAP.tactics.pos;
// точка на зоне с таким названием: укрытое место внутри/у зоны, откуда видно see
function namedSpot(name, near, o){
  var zp = zonePoint(name, near); if(!zp) return null;
  o = o || {};
  var sp = pickSpots("nm:"+name+":"+(o.key||""), zp, 1, {rMax:o.rMax||110, minGap:40, see:o.see||[], hideFrom:o.hideFrom||[], must:o.must, cross:o.cross})[0];
  return sp || zp;
}
function entryPts(k){ return POS[k].entries.map(function(n){ return zonePoint(n, SITES[k]); }).filter(Boolean); }
// не смотрим "сквозь" своего тиммейта в упор: если по прямой от поста до
// цели взгляда в 15–92% пути стоит живой союзник ближе чем на 70px к этой
// линии — считаем цель загороженной (в реальной игре так не расставляются
// кроссфаером, это выглядит как "уставился на напарника", а не на вход)
function sightBlockedByAlly(b, from, to){
  if(!b || !b.team) return false;
  var dx = to.x-from.x, dy = to.y-from.y, len2 = dx*dx+dy*dy;
  if(len2 < 1) return false;
  return bots.some(function(o){
    if(o === b || !o.alive || o.team !== b.team) return false;
    var t = ((o.x-from.x)*dx + (o.y-from.y)*dy)/len2;
    if(t < 0.15 || t > 0.92) return false;
    return distToSeg(o.x, o.y, [from.x, from.y, to.x, to.y]) < 70;
  });
}
// центр зоны-входа (например, Cave) может оказаться у холда ЗА СПИНОЙ: он
// стоит в дальнем конце коридора, у Dark, а центр Cave — ближе к сайту.
// Тогда "смотреть на вход" = смотреть назад, на свой же сайт. Если по пути
// до T-спавна холд уже ближе, чем центр входа, — смотрим дальше НАРУЖУ по
// этому пути (Dark / Lamp Room / T Upper), а видимый угол найдёт cornerLook
var OUTWARD_CACHE = {};
function outwardLook(p, e){
  // Куда смотреть, стоя В коридоре входа (Cave, Short…): дальше по ЭТОМУ
  // коридору наружу, туда, откуда по нему придут T. Раньше бралось "по пути
  // до T-спавна" — а из верхней части Cave кратчайший путь до T идёт через
  // сайт и Ramp, и холд смотрел на сайт, спиной к Dark. Теперь — по графу
  // зон: из зоны входа — в соседнюю зону, которая ближе всех к T-спавну и не
  // является самим сайтом (для Cave это Dark)
  var key = Math.round(p.x/8)+","+Math.round(p.y/8)+"|"+Math.round(e.x/8)+","+Math.round(e.y/8);
  if(key in OUTWARD_CACHE) return OUTWARD_CACHE[key];
  var res = null;
  if(!BZ.ids.length) beliefBuild();
  var ze = bzOf(e.x, e.y), zp = bzOf(p.x, p.y);
  if(!BZ.DT){ var zs = bzOf(T_SPAWN.x, T_SPAWN.y); BZ.DT = bzDist(zs >= 0 ? [zs] : []); }
  // холд стоит ещё дальше наружу, чем сам вход (опорник "Cave" встал в Dark) —
  // смотрим наружу уже из СВОЕЙ зоны (из Dark — на Lamp Room), а не назад на Cave
  var zb0 = ze;
  if(zp >= 0 && ze >= 0 && zp !== ze && BZ.DT[zp] < BZ.DT[ze] && Math.hypot(p.x-e.x, p.y-e.y) < 350) zb0 = zp;
  if(ze >= 0 && (zp === ze || zb0 === zp || Math.hypot(p.x-e.x, p.y-e.y) < 120)){
    var nearSite = function(i){ var c = BZ.cent[i]; return !c || ["A","B"].some(function(k){ return SITES[k] && Math.hypot(c.x-SITES[k].x, c.y-SITES[k].y) < 200; }); };
    var best = -1, bd = Infinity;
    (BZ.nbr[zb0]||[]).forEach(function(n){ if(nearSite(n)) return; if(BZ.DT[n] < bd){ bd = BZ.DT[n]; best = n; } });
    if(best >= 0 && bd < BZ.DT[zb0]) res = walk(BZ.cent[best]);
  }
  OUTWARD_CACHE[key] = res;
  return res;
}
// куда смотреть из точки: первый видимый вход сайта
function lookFrom(p, list, fb, b){
  // если холд стоит прямо в одном из входов (например, в самом Cave, а не на
  // открытой части сайта) — смотрит дальше в СВОЙ коридор (туда, откуда сам
  // и пришёл бы враг), а не переключается на другой, "главный" вход только
  // потому что он в списке первый и тоже виден — иначе стоял спиной к своему
  // же тоннелю, глядя через сайт на чужой вход
  // не требуем прямой видимости центра зоны-входа — угол к ней всё равно
  // находит cornerLook по пути; тут просто предпочитаем САМЫЙ БЛИЖНИЙ вход,
  // если стоим внутри его коридора, а не первый по списку с видимостью
  var near = null, nd = 350;
  list.forEach(function(e){ if(!e) return; if(sightBlockedByAlly(b, p, e)) return; var d = Math.hypot(e.x-p.x, e.y-p.y); if(d < nd){ nd = d; near = e; } });
  if(near) return outwardLook(p, near) || near;
  for(var i=0;i<list.length;i++){ if(list[i] && !sightBlockedByAlly(b, p, list[i]) && hasLOS(p.x, p.y, list[i].x, list[i].y)) return list[i]; }
  // ничего не подошло по 350px/прямой видимости (это нормально — точную
  // видимость дальше находит cornerLook по пути), но какой-то вход всё же
  // не закрыт союзником — берём ближайший из них, уже без ограничения в 350,
  // лишь бы не смотреть "сквозь" тиммейта
  var near2 = null, nd2 = Infinity;
  list.forEach(function(e){ if(!e || sightBlockedByAlly(b, p, e)) return; var d = Math.hypot(e.x-p.x, e.y-p.y); if(d < nd2){ nd2 = d; near2 = e; } });
  if(near2) return near2;
  // абсолютно все варианты закрыты союзником — лучше смотреть хоть куда-то
  // полезное, чем никуда: берём ближайший вообще, без фильтра по союзнику
  var near3 = null, nd3 = Infinity;
  list.forEach(function(e){ if(!e) return; var d = Math.hypot(e.x-p.x, e.y-p.y); if(d < nd3){ nd3 = d; near3 = e; } });
  return near3 || fb;
}
// ---- пул расстановок CT (раздел 12/13) ----
// roles: позиции по названиям зон; early — куда встать в первые sec секунд
// (выход за инфой), потом — pos. rot: "212" — ротатор вторым на "горячий" сайт,
// "111" — ротатор между сайтами. stack — сайт, на который встаёт роумер.
var CT_SETUPS = MAP.tactics.ctSetups;
var CT_SHARE = MAP.ctshare || null, CT_SHARE_MIN = 0.01;   // доля — не ниже 1 % (проектное: расстановка, не встретившаяся у про, всё же бывает)
function ctShareW(S){
  var rt = teamEco.CT && teamEco.CT.roundType, k = rt === "half" ? "force" : (rt || "full"), B = CT_SHARE && (CT_SHARE.by[k] || CT_SHARE.by.full);
  if(!B) return S.w || 1;
  return Math.max(CT_SHARE_MIN, B[S.id] || 0);
}
var CTSET_DBG = null;
function chooseCtSetup(){
  var last = roundHist.slice(-4), heat = {A:0, B:0}, lost = {A:0, B:0};
  last.forEach(function(r){ heat[r.site]++; if(r.planted && r.winner === "T") lost[r.site]++; });
  var execs = roundHist.slice(-3).map(function(r){ return r.execSec; }).filter(function(x){ return x != null; });
  var avgExec = execs.length ? execs.reduce(function(a,x){ return a+x; }, 0)/execs.length : 45;
  var why = {};
  var weights = CT_SETUPS.map(function(S){
    // (v561, этап 6 docs/tasks/PLAN_TACTICS_V2.md; владелец 11.11: «доли расстановок — по закупу, из демок») исходный вес — доля этой расстановки
    // у про на такой закуп CT (MAP.ctshare: структура A-мид-B к 20 с у про по закупу → наши расстановки той же структуры; tools/ct_setup_bake.py);
    // дальше — сдвиги по знанию команды (ниже). Было — ручные веса («стандарт ×4», проектные)
    var w = ctShareW(S);
    if(S.stack){ var h = heat[S.stack]; if(last.length >= 3 && h >= 3){ w *= 6; why[S.id] = "T ходили на "+S.stack+" "+h+" из "+last.length; } else if(h >= 2) w *= 2; }   // (v561) множители вместо замены веса: доля про остаётся основой (было: стак 0,2 → 1,2 / 0,4 — те же ×6 / ×2)
    if(/^retake/.test(S.id)){ var k = S.id.slice(-1); if(lost[k] >= 2){ w *= 6; why[S.id] = "на "+k+" проигрываем "+lost[k]+" раунда — играем от ретейка"; } }
    if(S.roles && Object.keys(S.roles).some(function(r){ return S.roles[r].early; })){
      if(avgExec < 25) w *= 0.4; else if(avgExec > 45){ w *= BAL.proCtSetup ? 1.15 : 1.6; why[S.id] = "T выходят поздно (~"+Math.round(avgExec)+"с) — есть время за инфой"; }
    }
    var l1 = ctSetupHist[ctSetupHist.length-1], l2 = ctSetupHist[ctSetupHist.length-2];
    if(l1 === S.id && l2 === S.id) w *= 0.15;
    // (1) мидер рано умирал в 2 из 3 последних раундов — агрессивный мид реже
    if(BAL.roundMem && S.midAggressive && rmemRecent(RMEM.midDeath, 3).length >= 2){ w *= 0.2; why[S.id] = null; }
    // CT тоже помнят, какие расстановки в этом матче сработали, а какие нет
    var CM = ctSetupMem[S.id] || {n:0, w:0};
    w *= 0.3 + 1.7*((CM.w + 1)/(CM.n + 2));
    if(BAL.timeouts && roundNum <= TOUT.CT.until){ var CP = TOUT.CT.plan || {};   // (v460) план тренера после паузы
      if(TOUT.CT.avoid.indexOf(S.id) >= 0) w *= 0.15;
      if(CP.stack && S.stack === CP.stack) w *= 6;
      if(CP.avoidZone && setupUsesZone(S, CP.avoidZone)) w *= 0.35;   // (v461) где умирали — эти раунды там не стоим
      if(CP.retake && S.id === "retake" + CP.retake) w *= 4;
      if(CP.midAgg && S.midAggressive) w *= 4; }   // (v469) план «ранний пик AWP на миде»
    return w;
  });
  var S = BAL.ctSetups ? CT_SETUPS[weightedChoice(CT_SETUPS, weights, roundNum*4217 + matchNum*881 + 5)] : (BAL.ctSetup === "1-1-1" ? CT_SETUPS[1] : CT_SETUPS[0]);
  // (v566) для «Разбора команды» (612): из чего выбирали и почему — игру не меняет
  CTSET_DBG = {round: roundNum, buy: teamEco.CT && teamEco.CT.roundType, pick: S.id, list: CT_SETUPS.map(function(X, i){ return {id: X.id, name: X.name, w: weights[i], base: ctShareW(X), why: why[X.id] || ""}; })};
  ctSetupHist.push(S.id);
  teamTac.CT = {call:null, saving:false, stack:S.stack||null, setup:S, setupWhy: why[S.id]||null};
  ctSeatRoles(S);   // (v334, М61) кто какую роль расстановки играет — по своим позициям из демок
  // против эко: без ранних пиков и доборов — не дарить оружие, держать вместе
  // (v559, В76 ч.5) «против эко» — не флаг расстановки, а цель раунда команды (roundGoal, 520: «выиграть, не отдав винтовок»), читается по знанию
  if(BAL.ctAntiEco && roundGoal("CT") === "keepGuns") logEvent("CT: у T, похоже, эко — цель: выиграть, не отдав винтовок");
  logEvent("CT: расстановка «"+S.name+"»"+(why[S.id] ? " — "+why[S.id] : ""));
}
// (v334, М61, владелец: «kyousuke играет Window, а должен Short — рядом с B») роли расстановки CT на раунд — по почерку игроков:
// для каждой роли — насколько её места (pos) похожи на места этого игрока в демках (posPref: почерк + оружие, как posPickName);
// перебор 120 рассадок, берётся с наибольшей суммой (с v409 — доля времени игрока на позициях роли); своя постоянная роль (playerRoles, роли по демкам карты) — бонус
// SEAT_KEEP (проектное число), чтобы опорники не скакали между раундами без причины.
var SEAT_KEEP = 0.15;
// (v567, владелец 12.11: «у меня karrigan всегда опорник B, а в матче 3 он роумер — роли должны быть закреплены, мы это уже 50 раз») своя роль
// игрока из набора карты (tactics.playerRoles — по демкам этой карты) — закреплена: перевешивает любые доли мест; по местам в демках
// распределяются только игроки без своей роли. Было: своя роль весила 0,15 — по долям мест TeSeS забирал опорника B, karrigan уходил в роумеры
// (в матче 1 этого не видно: при загрузке страницы сохранялась готовая рассадка матча 1)
var SEAT_FIXED = 100, PR_FIX = MAP.tactics.playerRoles || {};
// (v555, владелец 11.11, м300: «m0NESY и TeSeS меняются местами каждый раунд — роль игрока (мидер — всегда мидер) не меняется, изредка, как
// решение тренера; расстановки не трогать») рассадка — один раз на половину (сторона CT этой команды): по сумме долей времени игрока на
// местах роли во ВСЕХ расстановках (а не в выпавшей в этом раунде), дальше роль игрока держится; расстановка меняет только места внутри роли.
// Было: перебор заново каждый раунд по местам выпавшей расстановки (+SEAT_KEEP 0,15 за прошлую роль) — опорник A переходил от игрока к игроку
function ctSeatRoles(S){
  if(!S || !S.roles || !BAL.proPrior) return;
  var team = bots.filter(function(b){ return b.team === "CT"; }), roles = Object.keys(S.roles);
  if(team.length !== 5 || roles.length !== 5) return;
  var key = matchNum+':'+SIDE_TEAM.CT+':'+(roundNum > HALF_ROUNDS ? 2 : 1);
  if(team.every(function(b){ return b._seatSide === key && b._seatRole && roles.indexOf(b._seatRole) >= 0; })){
    team.forEach(function(b){ b.tRole = b._seatRole; }); return; }
  // (v409, владелец 22.10: «почему TeSeS опорник?») мера — доля времени игрока в демках на позициях этой роли (сумма, без оружия): кто там
  // чаще стоит, тот и играет
  var NP = {}, share = function(who, q){ if(NP[who] == null){ NP[who] = 0; KNOW_POSITIONS.points.forEach(function(p){ if(p.side === "CT") NP[who] += (p.byP && p.byP[who]) || 0; }); }
    return NP[who] ? ((q.byP && q.byP[who]) || 0)/NP[who] : 0; };
  var setups = CT_SETUPS.filter(function(X){ return X.roles && roles.every(function(r){ return X.roles[r]; }); });
  var A = team.map(function(b){ return roles.map(function(r){
    var sum = 0;
    setups.forEach(function(X){ var names = X.roles[r].pos || [], seen = {};
      names.forEach(function(nm){ var ids = zonesByName(nm);
        KNOW_POSITIONS.points.forEach(function(q){ if(q.side !== "CT" || seen[q.id]) return; if(q.zid === undefined) q.zid = zoneIdAt(q.x, q.y) || null;
          if(q.zid && ids.indexOf(q.zid) >= 0){ seen[q.id] = 1; sum += share(nick(b.id), q); } }); }); });
    var fixR = PR_FIX[nick(b.id)] && PR_FIX[nick(b.id)].CT;
    return sum + (fixR === r ? SEAT_FIXED : 0) + (b.tRole === r ? SEAT_KEEP : 0); }); });
  var bestSum = -1, bestP = null;
  (function perm(arr, k){ if(k === arr.length){ var sm = 0; for(var i=0;i<arr.length;i++) sm += A[i][arr[i]]; if(sm > bestSum){ bestSum = sm; bestP = arr.slice(); } return; }
    for(var i=k;i<arr.length;i++){ var t = arr[k]; arr[k] = arr[i]; arr[i] = t; perm(arr, k+1); t = arr[k]; arr[k] = arr[i]; arr[i] = t; } })([0,1,2,3,4], 0);
  if(!bestP) return;
  team.forEach(function(b, i){ var r = roles[bestP[i]]; b._seatRole = r; b._seatSide = key; if(b.tRole !== r){ logEvent("CT: "+nick(b.id)+" в этой половине — "+r+" (по своим позициям)"); b.tRole = r; } });
}
// роль CT по расстановке: позиция по названию зоны (из нескольких — по раунду)
var CT_ZONE_RES = {k:null, z:{}};   // (v518c) зоны мест CT, занятые в этом раунде: имя зоны → id бота
function ctSetupRole(b, role, ct){
  var S = ct.setup; if(!S || !S.roles || !S.roles[role]) return false;
  var R = S.roles[role];
  // мидер с пистолетом/ПП или с AWP на агрессивной расстановке — позиция мида
  // по оружию (ближний угол / дальняя точка), а не вперёд в дуэль на дистанции
  // (v359) роль mid в раскладке без мида (3-0-2, 4-0-1 — места на сайте) — не мидер: правило «мидер по оружию» не для неё
  var midReal = role === "mid" && (R.pos || []).some(function(n){ return ((POS.M && POS.M.ctHold) || []).indexOf(n) >= 0; });
  if(BAL.midWeapon && midReal && b.weapon && (b.weapon.tier < 5 || ((b.weapon.key === "AWP" || b.weapon.key === "SSG") && R.early))) return false;
  var early = R.early && tick - roundStartTick < R.early.sec*TICK_HZ;
  var P = early ? R.early : R;
  if(early && b._sawEnemy) b._earlySaw = roundNum;
  if(early && b.atPost) b._earlyAt = {round:roundNum, x:b.x, y:b.y};
  // выход за инфой закончился: никого не увидел и не услышал — отметить "пусто"
  if(!early && R.early && b._earlyDone !== roundNum){
    b._earlyDone = roundNum;
    var ea = b._earlyAt && b._earlyAt.round === roundNum ? b._earlyAt : null;
    if(ea && b._earlySaw !== roundNum && lkpNear("CT", ea.x, ea.y, 600) === 0) markClear("CT", ea.x, ea.y, b.id);
  }
  if(!P.pos) return false;
  // (v411, Б5з) к местам роли из расстановки — свои места игрока по демкам этой карты (доля времени выше средней по его местам), кроме
  // мест других ролей этой расстановки: у роли «мид» на Mirage в списке Window / Connector / Underpath, а kyousuke в демках — Short 16 %,
  // B Short, B Plat, Window только 8 %. Демок игрока нет — только места роли, как было. Места других ролей не исключаются: NiKo в
  // демках у Connector 22 %, а Connector — в списке мида; двое в одной точке не встанут — личное место (pickSpots / spotTaken)
  var names = early ? P.pos : posNamesOwn(b, P.pos);
  // (v518c, пак 09.11 п.8; владелец Р-35: «1-3-1 — пошли все трое в Connector и стоят буквально в одном месте») места ролей делятся на команду:
  // зону, которую в этом раунде уже занял другой живой CT, не берёт, пока у роли есть свободная (раньше — «места других ролей не исключаются»,
  // от одной точки на двоих спасал только личный радиус 70 px). Своя зона держится за ботом до конца раунда (не перекидываются)
  var RZ = CT_ZONE_RES.k === matchNum+":"+roundNum ? CT_ZONE_RES : (CT_ZONE_RES = {k: matchNum+":"+roundNum, z:{}});
  var mineZ = names.filter(function(n){ return RZ.z[n] === b.id; })[0];
  var freeZ = names.filter(function(n){ var o = RZ.z[n] ? teamBot(RZ.z[n]) : null; return !o || !o.alive || o === b; });
  if(freeZ.length) names = freeZ;
  var nm0 = mineZ || (BAL.proPrior ? names[posPickName(b, names, roundNum*97 + role.length*13 + matchNum)] : names[Math.floor(hashRand(roundNum*97 + role.length*13 + matchNum) * names.length)]);
  var ref = role === "anchorA" ? GEO.A.anchor : role === "anchorB" ? GEO.B.anchor : GEO.ctMid;
  // (v417, М153) куда смотрят про с этой точки — точка из демок (lookPt, tools/tactics_bake.py / ct_lookpt_add.py); по имени зоны точка
  // бралась рядом с ботом и направление терялось (Mirage, опорник A в ctStd_212: про смотрят на −52° к A, а точка зоны «CT» — на 159°, назад)
  // прятаться от мида по умолчанию — но не тогда, когда сам взгляд НАПРАВЛЕН
  // в сторону мида/тоннеля (Пуш кейва): иначе позицию тянуло в укромный
  // уголок, откуда "спрятанное от мида" направление и есть тот самый Dark/
  // Lamp Room, который нужно смотреть — в итоге стоял к нему спиной
  var hideMid = R.hideFrom === false ? [] : [GEO.tMid];
  // (v520, отметка владельца 09.11 м200 р3: NiKo (rotator, смотреть Top Mid) получил своё место по демкам «Hole» — оттуда Top Mid не виден,
  // точка бралась любая внутри зоны) место роли годно, только если с точки видно то, что роль держит (точка взгляда): выбранное место
  // первым, потом остальные свободные места роли; нигде не видно — как было (выбранное место)
  var tryN = [nm0].concat(names.filter(function(n){ return n !== nm0; })), nm = nm0, c = null, lk = null, spots = null;
  // (v570, владелец 12.11 к отметке м1 р3: «почему не сыграли кроссфайером — все в одной позиции; можно с ладдера через Catwalk / Short,
  // кто-то на Connector») места ролей в данных расстановки совпадают (1-3-1 Mirage: у ротатора и роумера — Window / Connector / Under
  // Window), и трое вставали в одну точку. Место роли — на своей линии: не ближе OWN_LINE_GAP к месту другого CT. Нет такого среди мест
  // роли — места, где у про стоят CT в этом районе (MAP.zoneprops: доля CT в демках, тот же край карты), ближние по пути
  var crossOk = function(q){ return !lineTaken(b, q); };   // одна мерка «своей линии» — lineTaken / OWN_LINE_GAP (110)
  ctProZones(ref).forEach(function(n){ if(tryN.indexOf(n) < 0) tryN.push(n); });
  var crossAlt = null;
  for(var ti = 0; ti < tryN.length; ti++){
    var c1 = zonePoint(tryN[ti], ref); if(!c1) continue;
    var lk1 = (P.lookPt && {x: P.lookPt[0], y: P.lookPt[1]}) || (P.look && zonePoint(P.look, c1)) || ref;
    var sp1 = pickSpots("cts:"+S.id+":"+role+":"+tryN[ti], c1, 6, {rMax:150, minGap:45, see:[lk1], hideFrom:hideMid});
    // (v441, док владельца 27.10, р6: мидер kyousuke с местом «B Short» встал в Stove — за дверью Apps, на стороне T) точка — в зоне своего
    // места: в 150 от точки зоны легко попасть в соседнюю, а соседняя бывает уже чужой стороной. Нет такой — как было
    var in1 = sp1.filter(function(q){ return zoneUserName(zoneIdAt(q.x, q.y)) === tryN[ti]; }); sp1 = in1.length ? in1 : sp1;
    var see1 = sp1.filter(function(q){ return hasLOS(q.x, q.y, lk1.x, lk1.y); });
    // (v570, отметка владельца м1 р3 15,7 с: «все игроки по тактике 1-3-1 стоят в одной точке») — места ролей одной расстановки бывают
    // в одной зоне (мидер, ротатор, роумер — 25–57 ед. друг от друга), а сдвиг в setPost в тесном проходе не находил места. Точка, где уже
    // стоит / куда идёт свой (spotTaken), — не вариант; все заняты — следующее место роли; нигде нет — как было
    var free1 = see1.filter(function(q){ return !spotTakenPost(b, q) && crossOk(q); });   // места своих, а не идущие мимо (иначе выбор менялся каждый тик)
    if(ti === 0){ nm = tryN[0]; c = c1; lk = lk1; spots = sp1.slice(0, 3); }
    if(see1.length && !spots._see){ nm = tryN[ti]; c = c1; lk = lk1; spots = see1.slice(0, 3); spots._see = 1; }
    if(free1.length){ nm = tryN[ti]; c = c1; lk = lk1; spots = free1.slice(0, 3); spots._free = 1; break; }
    var cross1 = sp1.filter(function(q){ return !spotTakenPost(b, q) && crossOk(q); });
    if(cross1.length && !crossAlt) crossAlt = {nm: tryN[ti], c: c1, lk: lk1, spots: cross1.slice(0, 3)};
  }
  // ниоткуда не видно точку взгляда роли (у роумера 1-3-1 Mirage точка из демок не видна ни из одного места мида) — своя линия важнее:
  // место, откуда не видно, но не в точке другого CT (было — первое место роли, в той же точке, что мидер)
  if(spots && !spots._free && crossAlt){ nm = crossAlt.nm; c = crossAlt.c; lk = crossAlt.lk; spots = crossAlt.spots; }
  if(!c) return false;
  Object.keys(RZ.z).forEach(function(n){ if(RZ.z[n] === b.id && n !== nm) delete RZ.z[n]; }); RZ.z[nm] = b.id;
  var tag = (role === "anchorA" || role === "anchorB") ? "anchor" : role === "mid" ? "mid" : "set:"+role;
  var spC = spots[weightedPick(spots.length, roundNum*53 + b.id.charCodeAt(2||1))];
  // (v570, прогон 212: Ancient «застрял (set): шаг проходит, а стоит» — точка роли пересчитывается каждый тик и менялась, путь сбрасывался)
  // выбранная точка держится за ботом в этом раунде и роли, пока её не занял свой (lineTaken)
  var SPK = b._ctSpot; if(SPK && SPK.r === roundNum && SPK.role === role && SPK.nm === nm && !lineTaken(b, SPK.pt)) spC = SPK.pt;
  else if(spC) b._ctSpot = {r: roundNum, role: role, nm: nm, pt: spC};
  // встал в той самой зоне, куда велено смотреть (роумер в Cave с взглядом
  // "на Cave") — смотрим дальше НАРУЖУ по пути к T, а не себе под ноги/на сайт
  if(spC && lk && Math.hypot(spC.x-lk.x, spC.y-lk.y) < 150){ var ow = outwardLook(spC, lk); if(ow) lk = ow; }
  var placed = setPost(b, spC, lk, true, tag);   // (v518a, пак 09.11 п.1) отказ арбитра — роль не обслужена (было: всегда «сделано»)
  if(early && !b._earlyLog){ b._earlyLog = roundNum; }
  if(early && b._earlyLogged !== roundNum){ b._earlyLogged = roundNum; logEvent(b.id+" ("+ROLE_LABEL_CT(role)+"): выход за инфой — "+nm); }
  return placed;
}
var CT_PRO_ZONE = {occ: 0.003, tShare: 0.5, path: 900, n: 6};   // (v570) проектные числа: зона CT у про — доля ≥ 0,3 %, T < половины
function ctProZones(ref){
  var ZP = MAP.zoneprops && MAP.zoneprops.zones; if(!ZP || !ref) return [];
  var zr = ZP[zoneIdAt(ref.x, ref.y)], side = zr && zr.side !== "M" ? zr.side : null, out = [];   // мид — места с обеих сторон рядом (Connector, Short)
  Object.keys(ZP).forEach(function(k){ var z = ZP[k];
    if(!z.name || !(z.occ >= CT_PRO_ZONE.occ) || z.tShare == null || z.tShare >= CT_PRO_ZONE.tShare || (side && z.side !== side && z.side !== "M")) return;
    var q = zonePoint(z.name, ref); if(!q) return; var L = polyLen(pathPts(ref.x, ref.y, q.x, q.y)); if(L > CT_PRO_ZONE.path) return;
    out.push({n: z.name, L: L}); });
  return out.sort(function(a, c){ return a.L - c.L; }).slice(0, CT_PRO_ZONE.n).map(function(o){ return o.n; });
}
function ROLE_LABEL_CT(r){ return {anchorA:"опорник A", anchorB:"опорник B", mid:"мидер", rotator:"ротатор", roamer:"роумер"}[r] || r; }
var events = []; var killfeed = []; // объявлены здесь, до loadOppProfile(), которая пишет в лог сразу при старте
var simTime = 0; // тоже нужен logEvent-у при старте
if(typeof OPP !== "undefined" && OPP) loadOppProfile();
// итог раунда — в память обеих сторон
var RND_PART = {plant: 0.25, kill: 0.1, max: 0.6};   // проектные числа: доля успеха проигранного раунда (плант / не дали поставить, каждый убитый)
function rememberRound(winner){
  bots.forEach(function(b){ var A = aggrObs[b.id] || (aggrObs[b.id] = {e:0, r:0}); A.r++; });
  var tt = teamTac.T; if(!tt) return;
  var TAC0 = tt.open || tt.tac;   // (v561) дефолт с продолжением — в памяти начало (его выбирает chooseTactic)
  var M = tacMem[TAC0.id] || (tacMem[TAC0.id] = {n:0, w:0, plants:0});
  // (v561, этап 8 docs/tasks/PLAN_TACTICS_V2.md; PRO_PLAY §6з: «успех тактики — не только победа: плант, убитые CT») проигранный раунд даёт
  // часть успеха: плант — RND_PART.plant, каждый убитый соперник — RND_PART.kill (вместе — меньше победы); та же мерка у расстановки CT
  var deadCT = bots.filter(function(o){ return o.team === "CT" && !o.alive; }).length, deadT = bots.filter(function(o){ return o.team === "T" && !o.alive; }).length;
  var planted = !!(bomb && bomb.plantTick && bomb.plantTick >= roundStartTick);
  M.n++; M.w += winner === "T" ? 1 : Math.min(RND_PART.max, (planted ? RND_PART.plant : 0) + deadCT*RND_PART.kill); if(bomb && (bomb.state === "planted" || bomb.state === "exploded" || bomb.state === "defused")) M.plants++;
  ctRead.push({A: tt.seenCT.A, B: tt.seenCT.B});
  var cs = teamTac.CT && teamTac.CT.setup;
  if(cs){ var CM = ctSetupMem[cs.id] || (ctSetupMem[cs.id] = {n:0, w:0}); CM.n++; CM.w += winner === "CT" ? 1 : Math.min(RND_PART.max, (planted ? 0 : RND_PART.plant) + deadT*RND_PART.kill); }
  roundHist.push({site: tt.site, planted: !!(bomb && bomb.plantTick && bomb.plantTick >= roundStartTick), winner: winner,
                  execSec: tt.execStart != null ? (tt.execStart - roundStartTick)/TICK_HZ : null, type: teamEco.T && teamEco.T.roundType});   // (v560, В95) закуп T — темп раунда меряется от него
}
// ---- любимые углы CT (для T) ----
// ошибки исполнения — в лог не каждую (чтобы не засорять), но видно, что они есть
function noteMistake(b, what){
  b._mistakes = (b._mistakes||0) + 1;
  if(hashRand(tick*3 + b.id.charCodeAt(1)) < 0.35) logEvent(b.id+": ошибка — "+what);
}
// наблюдённая агрессия игрока: сколько раз за раунд он сам лезет в дуэль (по
// сравнению со средним) — копится у соперника за матч и между матчами
var aggrObs = {};
function aggrNote(id){ var A = aggrObs[id] || (aggrObs[id] = {e:0, r:0}); A.e++; }
function aggrRate(id){
  var A = aggrObs[id]; if(!A || A.r < 3) return 1;
  var tot = 0, n = 0; for(var k in aggrObs){ if(aggrObs[k].r >= 3){ tot += aggrObs[k].e/aggrObs[k].r; n++; } }
  var avg = n ? tot/n : 1; return avg > 0 ? (A.e/A.r)/avg : 1;
}
function habitAdd(ctId, x, y, w){
  var H = ctHabit[ctId] || (ctHabit[ctId] = {}), k = Math.round(x/48)+","+Math.round(y/48);
  var c = H[k] || (H[k] = {x:0, y:0, n:0}); c.x = (c.x*c.n + x*w)/(c.n + w); c.y = (c.y*c.n + y*w)/(c.n + w); c.n += w;
}
function habitTop(ctId, minN){
  var H = ctHabit[ctId], best = null; if(!H) return null;
  for(var k in H){ if(H[k].n >= (minN||2) && (!best || H[k].n > best.n)) best = H[k]; }
  return best;
}
// без свежей инфы — смотрит в любимый угол живого врага (у каждого игрока свой,
// копится за матч и между матчами), если он рядом и виден
function habitLook(b){
  if(!teamTac.T || (b.team === "T" && teamTac.T.phase === "postplant")) return null;
  var best = null, bd = Infinity;
  bots.forEach(function(o){
    if(o.team === b.team || !o.alive) return;
    var h = habitTop(o.id, 2.5); if(!h) return;
    var d = Math.hypot(h.x-b.x, h.y-b.y);
    if(d < 150 || d > 650 || d >= bd) return;
    if(!hasLOS(b.x, b.y, h.x, h.y, b.z)) return;
    bd = d; best = h;
  });
  return best;
}
var roundStartTick = 0;

