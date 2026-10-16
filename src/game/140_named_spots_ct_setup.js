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
function chooseCtSetup(){
  var last = roundHist.slice(-4), heat = {A:0, B:0}, lost = {A:0, B:0};
  last.forEach(function(r){ heat[r.site]++; if(r.planted && r.winner === "T") lost[r.site]++; });
  var execs = roundHist.slice(-3).map(function(r){ return r.execSec; }).filter(function(x){ return x != null; });
  var avgExec = execs.length ? execs.reduce(function(a,x){ return a+x; }, 0)/execs.length : 45;
  var why = {};
  var weights = CT_SETUPS.map(function(S){
    var w = (BAL.proCtSetup ? {std212:4, std111:1.5, midAggro:0.5, pickA:0.4, pickB:0.4, redRoom:0.6, cavePush:0.5, stackA:0.2, stackB:0.2, retakeA:0.2, retakeB:0.2}
                            : {std212:3, std111:1.5, midAggro:1, pickA:0.8, pickB:0.8, redRoom:1, cavePush:1, stackA:0.2, stackB:0.2, retakeA:0.2, retakeB:0.2})[S.id] || S.w || 1;
    if(S.stack){ var h = heat[S.stack]; if(last.length >= 3 && h >= 3){ w = BAL.proCtSetup ? 1.2 : 4; why[S.id] = "T ходили на "+S.stack+" "+h+" из "+last.length; } else if(h >= 2) w = BAL.proCtSetup ? 0.4 : 1; }
    if(/^retake/.test(S.id)){ var k = S.id.slice(-1); if(lost[k] >= 2){ w = 1.2; why[S.id] = "на "+k+" проигрываем "+lost[k]+" раунда — играем от ретейка"; } }
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
    if(BAL.timeouts && roundNum <= TOUT.CT.until && TOUT.CT.avoid.indexOf(S.id) >= 0) w *= 0.15; // после тайм-аута
    return w;
  });
  var S = BAL.ctSetups ? CT_SETUPS[weightedChoice(CT_SETUPS, weights, roundNum*4217 + matchNum*881 + 5)] : (BAL.ctSetup === "1-1-1" ? CT_SETUPS[1] : CT_SETUPS[0]);
  ctSetupHist.push(S.id);
  teamTac.CT = {call:null, saving:false, stack:S.stack||null, setup:S, setupWhy: why[S.id]||null};
  ctSeatRoles(S);   // (v334, М61) кто какую роль расстановки играет — по своим позициям из демок
  // против эко: без ранних пиков и доборов — не дарить оружие, держать вместе
  if(BAL.ctAntiEco && BAL.ecoRead){ var Ee = teamEco.CT.enemyGuess || enemyEcoGuess("CT"); if(Ee.eco && (teamEco.CT.roundType === "full" || teamEco.CT.roundType === "force")){ teamTac.CT.antiEco = true; logEvent("CT: у T, похоже, эко — играем аккуратно: без ранних пиков, не отдаём оружие"); } }
  logEvent("CT: расстановка «"+S.name+"»"+(why[S.id] ? " — "+why[S.id] : ""));
}
// (v334, М61, владелец: «kyousuke играет Window, а должен Short — рядом с B») роли расстановки CT на раунд — по почерку игроков:
// для каждой роли — насколько её места (pos) похожи на места этого игрока в демках (posPref: почерк + оружие, как posPickName);
// перебор 120 рассадок, берётся с наибольшей суммой; своя постоянная роль (playerRoles, роли по демкам карты) — бонус
// SEAT_KEEP (проектное число), чтобы опорники не скакали между раундами без причины
var SEAT_KEEP = 0.15;
function ctSeatRoles(S){
  if(!S || !S.roles || !BAL.proPrior) return;
  var team = bots.filter(function(b){ return b.team === "CT"; }), roles = Object.keys(S.roles);
  if(team.length !== 5 || roles.length !== 5) return;
  var base = {}; team.forEach(function(b){ if(!b._seatRole || b._seatSide !== matchNum+':'+b.team+':'+(roundNum > HALF_ROUNDS ? 2 : 1)){ b._seatRole = b.tRole; b._seatSide = matchNum+':'+b.team+':'+(roundNum > HALF_ROUNDS ? 2 : 1); } base[b.id] = b._seatRole; });
  var A = team.map(function(b){ return roles.map(function(r){
    var names = S.roles[r].pos || [], best = 0;
    names.forEach(function(nm){ var ids = zonesByName(nm);
      KNOW_POSITIONS.points.forEach(function(q){ if(q.side !== "CT") return; if(q.zid === undefined) q.zid = zoneIdAt(q.x, q.y) || null;
        if(q.zid && ids.indexOf(q.zid) >= 0) best = Math.max(best, posPref(b, q, true)); }); });
    return best + (base[b.id] === r ? SEAT_KEEP : 0); }); });
  var bestSum = -1, bestP = null;
  (function perm(arr, k){ if(k === arr.length){ var sm = 0; for(var i=0;i<arr.length;i++) sm += A[i][arr[i]]; if(sm > bestSum){ bestSum = sm; bestP = arr.slice(); } return; }
    for(var i=k;i<arr.length;i++){ var t = arr[k]; arr[k] = arr[i]; arr[i] = t; perm(arr, k+1); t = arr[k]; arr[k] = arr[i]; arr[i] = t; } })([0,1,2,3,4], 0);
  if(!bestP) return;
  team.forEach(function(b, i){ var r = roles[bestP[i]]; if(b.tRole !== r){ logEvent("CT: "+nick(b.id)+" в этой расстановке — "+r+" (по своим позициям)"); b.tRole = r; } });
}
// роль CT по расстановке: позиция по названию зоны (из нескольких — по раунду)
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
  var nm = BAL.proPrior ? P.pos[posPickName(b, P.pos, roundNum*97 + role.length*13 + matchNum)] : P.pos[Math.floor(hashRand(roundNum*97 + role.length*13 + matchNum) * P.pos.length)];
  var ref = role === "anchorA" ? GEO.A.anchor : role === "anchorB" ? GEO.B.anchor : GEO.ctMid;
  var c = zonePoint(nm, ref); if(!c) return false;
  var lk = (P.look && zonePoint(P.look, c)) || ref;
  // прятаться от мида по умолчанию — но не тогда, когда сам взгляд НАПРАВЛЕН
  // в сторону мида/тоннеля (Пуш кейва): иначе позицию тянуло в укромный
  // уголок, откуда "спрятанное от мида" направление и есть тот самый Dark/
  // Lamp Room, который нужно смотреть — в итоге стоял к нему спиной
  var hideMid = R.hideFrom === false ? [] : [GEO.tMid];
  var spots = pickSpots("cts:"+S.id+":"+role+":"+nm, c, 3, {rMax:150, minGap:45, see:[lk], hideFrom:hideMid});
  var tag = (role === "anchorA" || role === "anchorB") ? "anchor" : role === "mid" ? "mid" : "set:"+role;
  var spC = spots[weightedPick(spots.length, roundNum*53 + b.id.charCodeAt(2||1))];
  // встал в той самой зоне, куда велено смотреть (роумер в Cave с взглядом
  // "на Cave") — смотрим дальше НАРУЖУ по пути к T, а не себе под ноги/на сайт
  if(spC && lk && Math.hypot(spC.x-lk.x, spC.y-lk.y) < 150){ var ow = outwardLook(spC, lk); if(ow) lk = ow; }
  setPost(b, spC, lk, true, tag);
  if(early && !b._earlyLog){ b._earlyLog = roundNum; }
  if(early && b._earlyLogged !== roundNum){ b._earlyLogged = roundNum; logEvent(b.id+" ("+ROLE_LABEL_CT(role)+"): выход за инфой — "+nm); }
  return true;
}
function ROLE_LABEL_CT(r){ return {anchorA:"опорник A", anchorB:"опорник B", mid:"мидер", rotator:"ротатор", roamer:"роумер"}[r] || r; }
var events = []; var killfeed = []; // объявлены здесь, до loadOppProfile(), которая пишет в лог сразу при старте
var simTime = 0; // тоже нужен logEvent-у при старте
if(typeof OPP !== "undefined" && OPP) loadOppProfile();
// итог раунда — в память обеих сторон
function rememberRound(winner){
  bots.forEach(function(b){ var A = aggrObs[b.id] || (aggrObs[b.id] = {e:0, r:0}); A.r++; });
  var tt = teamTac.T; if(!tt) return;
  var M = tacMem[tt.tac.id] || (tacMem[tt.tac.id] = {n:0, w:0, plants:0});
  M.n++; if(winner === "T") M.w++; if(bomb && (bomb.state === "planted" || bomb.state === "exploded" || bomb.state === "defused")) M.plants++;
  ctRead.push({A: tt.seenCT.A, B: tt.seenCT.B});
  var cs = teamTac.CT && teamTac.CT.setup;
  if(cs){ var CM = ctSetupMem[cs.id] || (ctSetupMem[cs.id] = {n:0, w:0}); CM.n++; if(winner === "CT") CM.w++; }
  roundHist.push({site: tt.site, planted: !!(bomb && bomb.plantTick && bomb.plantTick >= roundStartTick), winner: winner,
                  execSec: tt.execStart != null ? (tt.execStart - roundStartTick)/TICK_HZ : null});
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
    if(!hasLOS(b.x, b.y, h.x, h.y)) return;
    bd = d; best = h;
  });
  return best;
}
var roundStartTick = 0;

