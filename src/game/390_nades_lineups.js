// ======================= СВОИ ЛАЙНАПЫ =======================
var LINEUPS_BAKED = MAP.lineups.baked; // из «Экспорт проекта» (зашиты в код); (v294) «инстасмок мид» убран — см. nadeBrains
var LINEUPS_KEY = MAP.store + "-lineups-v1";
var USER_LINEUPS = [];
try{ var _lu = JSON.parse(localStorage.getItem(LINEUPS_KEY)||"null"); if(Array.isArray(_lu)) USER_LINEUPS = _lu; }catch(e){}
function saveLineups(){ try{ localStorage.setItem(LINEUPS_KEY, JSON.stringify(USER_LINEUPS)); localStorage.setItem(BUILTIN_OFF_KEY, JSON.stringify(BUILTIN_OFF)); }catch(e){} }
// встроенные гранаты: выключенные и заменённые своими (replaces: ключ встроенной)
var BUILTIN_OFF_BAKED = MAP.lineups.builtinOff, BUILTIN_OFF_KEY = MAP.store + "-builtin-off-v1", BUILTIN_OFF = {};
(function(){ for(var k in BUILTIN_OFF_BAKED) BUILTIN_OFF[k] = BUILTIN_OFF_BAKED[k]; try{ var o = JSON.parse(localStorage.getItem(BUILTIN_OFF_KEY)||"null"); if(o) for(var k2 in o) BUILTIN_OFF[k2] = o[k2]; }catch(e){} })();
function builtinAllowed(key){
  if(BUILTIN_OFF[key]) return false;
  if(proCovers(key)) return false;
  // заменена своим лайнапом — встроенная не летит, если свой в этом раунде назначен
  // кому-то (или ещё ждёт своего момента); если свой не нашёл бросающего — летит встроенная
  var rep = allLineups().filter(function(L){ return L.replaces === key; });
  if(!rep.length) return true;
  return rep.every(function(L){ return nadeFlags["lu"+L.id] && !nadeFlags["luok"+L.id]; });
}
function allLineups(){ var L = LINEUPS_BAKED.concat(USER_LINEUPS); return BAL.proLineups ? L.concat(proLineups()) : L; }
var LU_TRIG = {insta:"инста", setup:"сетап T", exec:"выход T", postplant:"пост-плант", call:"колл CT", retake:"ретейк"};
var LU_TYPE = {smoke:"смок", flash:"флешка", molly:"молотов", he:"HE"};
// (14) гранаты выхода раньше: смоки/молотов летят за ~4с до выхода (пока
// группа стоит на точках), а не в момент выхода — раньше энтри уже пикал,
// а смок ещё летел или его вообще не успевали кинуть
// (v428) запас гранат на выход / после планта / ретейк — в плане гранат команды (365_nade_plan, npCanUse в assignNade и лайнапах);
// было отдельное правило «смоки на выход — последние два не тратить» (tSmokeReserveOk)
function preExecNow(tt){
  if(!BAL.nadeEarly || !tt || tt.phase !== "setup" || !tt.execTick || tt.rebound && tick - (tt._rbT||0) < 2*TICK_HZ) return false;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  return tick >= tt.execTick - 4*TICK_HZ && secLeft > 30 && !(tt.tac && (tt.tac.style === "rush" || tt.tac.style === "fake"));
}
function tExecNadesFlying(){
  return nadesInAir.some(function(n){ return n.team === "T" && (n.type === "smoke" || n.type === "molly"); }) ||
    bots.some(function(b){ return b.alive && b.team === "T" && b.nadeTask && (b.nadeTask.type === "smoke") && b.nadeTask.exec; });
}
// (v359, отметка владельца р6: «почему не кидают гранаты на Connector, когда идут по Short — ситуация общая») про-смок кидается
// с вероятностью, как у про, и в этом раунде его могло не выпасть — тогда T шли по открытому месту под Connector / Window без
// смока. Теперь смок из лайнапов про кидается и вне своей вероятности, если свой T сейчас пойдёт по месту, которое видно из
// точки смока (путь на ближайших шагах), а там по знанию команды может быть CT (≥ CROSS_BELIEF), и рядом с точкой броска есть
// кто-то со смоком. Не больше CROSS_MAX (проектные числа) за раунд; смоки на выход (резерв) не трогаются
var CROSS_BELIEF = 0.3, CROSS_MAX = 2, CROSS_NEAR = 650;
function tCrossSmoke(L){
  if(L.team !== "T" || L.type !== "smoke" || roundState !== "live" || bomb.state === "planted") return false;
  if((nadeFlags._xsN||0) >= CROSS_MAX || smokeCovered(L.to.x, L.to.y)) return false;
  if(tick % 16) return false;
  // CT там могут быть: по знанию команды (≥ CROSS_BELIEF) или это место, где CT держат (pos.ctHold набора карты — по демкам про) и
  // его не чекали пустым последние 10 с
  var zid = zoneIdAt(L.to.x, L.to.y), zi = BZ.idx[zid]; if(zi == null) return false;
  var held = Object.keys(POS).some(function(k){ return (POS[k].ctHold || []).indexOf(zoneUserName(zid)) >= 0; });
  var clr = CLEARZ.T[zid] && tick - CLEARZ.T[zid].tick < 10*TICK_HZ;
  if(beliefCount("T", [zi]) < CROSS_BELIEF && !(held && !clr && aliveCount("CT") >= 2)) return false;
  var thrower = bots.some(function(b){ return b.team === "T" && b.alive && b.nades && b.nades.smoke > 0 && !b.nadeTask && Math.hypot(b.x-L.from.x, b.y-L.from.y) < CROSS_NEAR; });
  if(!thrower) return false;
  var crossing = bots.some(function(b){
    if(b.team !== "T" || !b.alive || !b.path || !b.path.length) return false;
    for(var i = b.pathIdx||0; i < Math.min(b.path.length, (b.pathIdx||0) + 4); i++){ var q = b.path[i];
      if(!hasLOS(b.x, b.y, L.to.x, L.to.y, b.z) && hasLOS(q[0], q[1], L.to.x, L.to.y) && Math.hypot(q[0]-b.x, q[1]-b.y) < 500) return true; }
    return false; });
  if(!crossing) return false;
  nadeFlags._xsN = (nadeFlags._xsN||0) + 1;
  logEvent("T: смок «"+(L.name||"")+"» — свои идут по месту, которое оттуда видно");
  return true;
}
// (v362) раскидчик раунда: с вероятностью SOLO_SHARE (демки Mirage — доля выходов, где один бросил ≥ 60 % гранат) — саппорт или
// IGL (не энтри, не AWP, не носитель бомбы, не лёркер) с наибольшим числом гранат; решение одно на раунд
var SOLO_SHARE = 0.36;
function tSoloThrower(){
  var F = nadeFlags._solo;
  if(F === undefined){
    F = null;
    if(hashRand(roundNum*6007 + matchNum*131 + 17) < SOLO_SHARE){
      var C = bots.filter(function(b){ return b.team === "T" && b.alive && b.nades && b.tRole !== "entry" && b.tRole !== "awp" && b.tRole !== "lurker" && !(bomb.state === "carried" && bomb.carrier === b); })
        .map(function(b){ var S = teamTac.T && SITES[teamTac.T.site], dS = S ? Math.hypot(b.x-S.x, b.y-S.y) : 0;
          var n = b.nades.smoke + b.nades.flash + b.nades.molly + b.nades.he;
          // кто ближе к сайту выхода (точки броска гранат выхода — там же), тот и раскидчик: дальний не успеет
          return {b:b, n:n, s:n + (b.tRole === "support" ? 0.5 : b.tRole === "igl" ? 0.25 : 0) - dS/800}; })
        .filter(function(c){ var S = teamTac.T && SITES[teamTac.T.site]; return c.n >= 3 && !(S && (onSite(S, c.b.x, c.b.y) || Math.hypot(c.b.x-S.x, c.b.y-S.y) < 450)); })   // уже на сайте — назад за гранатами не пойдёт
        .sort(function(a, c){ return c.s - a.s; })[0];
      if(C){ F = C.b.id; voiceLog("T", "solonade"+roundNum, C.b.id, "раскид на мне — пикайте под гранаты"); }
    }
    nadeFlags._solo = F;
  }
  var b = F && teamBot(F);
  return b && b.alive ? b : null;
}
function lineupTick(){
  if(roundState !== "live" || !teamTac.T) return;
  var tt = teamTac.T, ct = teamTac.CT, since = tick - roundStartTick;
  allLineups().forEach(function(L){
    var key = "lu"+L.id; if(nadeFlags[key]) return;
    // (v150) про-лайнап: в этом раунде кидается с вероятностью, как у про
    // (v423, 3в) кубик — на цель (группу лайнапов одной цели, proRollGroup), а не на каждое место броска
    if(L.pro && nadeFlags["pr"+L.id] === undefined) proRollGroup(L);
    if(L.pro && !nadeFlags["pr"+L.id] && tCrossSmoke(L)) nadeFlags["pr"+L.id] = true;
    if(L.pro && !nadeFlags["pr"+L.id]){ if(!(L.team === "T" && L.type === "smoke")) nadeFlags[key] = true; return; }
    var siteOk = function(k){ return L.site === "any" || L.site === k; };
    var go = false;
    if(L.trigger === "insta") go = since > TICK_HZ;
    else if(L.trigger === "timed") go = bomb.state !== "planted" && since >= (L.at||0)*TICK_HZ && since < ((L.at||0)+12)*TICK_HZ;
    else if(L.pro && L.team === "T" && L.trigger === "setup") go = tt.phase === "setup" && since >= Math.max(1, (L.at||12)-1)*TICK_HZ && siteOk(tt.site);
    else if(L.team === "T" && L.trigger === "setup") go = tt.phase === "setup" && since > 12*TICK_HZ && siteOk(tt.site);
    else if(L.team === "T" && L.trigger === "exec") go = (tt.phase === "execute" || preExecNow(tt)) && siteOk(tt.site);
    else if(L.team === "T" && L.trigger === "postplant") go = bomb.state === "planted" && siteOk(bomb.site);
    else if(L.team === "CT" && L.trigger === "call") go = ct && ct.call && ct.call.count >= 2 && siteOk(ct.call.site);
    else if(L.team === "CT" && L.trigger === "retake") go = bomb.state === "planted" && siteOk(bomb.site);
    // (v294) флешки T на сетапе из лайнапов про — только если команда ждёт врага у точки: про кидают их под пик, а боты — по часам
    // (рвались рядом с врагом в 50 % против 88 % у про)
    if(go && L.pro && L.team === "T" && L.trigger === "setup" && L.type === "flash" && !nadeWorth("T", L.to)) go = false;
    // (v429) флешка CT на тайминг — только под пик: рядом с точкой свой собирается выглянуть (ранний пик); нет — остаётся на потом
    if(go && L.pro && L.team === "CT" && L.trigger === "timed" && L.type === "flash" && !npPeekReady("CT", L.to, null)) go = false;
    // (v429) граната на тайминг «на всякий случай» — не туда, где врага точно нет (все живые враги недавно замечены далеко)
    if(go && L.pro && L.type !== "flash" && ((L.team === "CT" && L.trigger === "timed") || (L.team === "T" && L.trigger === "setup")) && !npFoeMaybe(L.team, L.to)) go = false;
    // (v438) цель уже закрыта смоком (свой смок рядом — облака перекрылись бы, smokeCovered) — второй туда не летит, лайнап закрыт
    if(go && L.type === "smoke" && smokeCovered(L.to.x, L.to.y)){ nadeFlags[key] = true; return; }
    // (v438, док владельца 27.10: m0NESY 5 с стоял с молотовом на точке — в 57 ед. от места падения стоял kyousuke) HE / молотов — не туда,
    // где стоит или куда идёт свой: ждёт, пока место освободится (момент лайнапа держит своё окно)
    if(go && (L.type === "molly" || L.type === "he")){ var Rk = NADE[L.type].radius + 40;
      if(bots.some(function(o){ return o.alive && o.team === L.team && (Math.hypot(o.x-L.to.x, o.y-L.to.y) < Rk || (o.post && Math.hypot(o.post.x-L.to.x, o.post.y-L.to.y) < Rk)); })) go = false; }
    if(!go) return;
    // кто кидает: ближайший к точке броска, но не энтри (он заходит первым) и не
    // носитель бомбы; в горячих фазах (выход, колл, ретейк, пост-плант) — только
    // тот, кому до точки броска недалеко, иначе он бросит свою задачу и уйдёт назад
    var hot = L.trigger !== "insta" && L.trigger !== "setup";
    var maxD = hot ? (BAL.nadeReach ? 650 : 480) : 1600;
    // (v355, владелец: «на выходе закрывают максимум один-два выхода, у про много смоков, флешек, молотов») гранаты выхода T
    // берёт тот, кому до точки броска до EXEC_REACH (проектное число) — группа на выходе стоит шире 650
    var execT = L.team === "T" && L.trigger === "exec";
    if(execT && BAL.nadeReach) maxD = EXEC_REACH;
    // (v150) про-лайнапы кидает тот, кто и так рядом: сетап — в пределах ~7 м,
    // "по времени" — ~4 м (не бросать позицию ради гранаты)
    if(L.pro && L.trigger === "setup") maxD = BAL.nadeReach ? 1100 : 700;
    if(L.pro && L.trigger === "timed"){ maxD = BAL.nadeReach ? 850 : 400; hot = true; }
    // (v438, док владельца 27.10: TN1R из Ramp шёл к T Roof «538 по прямой» — 1500 по пути, через спавн) до точки броска — по пути
    // (док 6, п.1/15: kyousuke на B Short получил молотов в Underpass с Connector — путь 704, а с B Short — 239; T1 на T Ramp — смок Stairs
    // с T Roof через спавн, 732, а с T Ramp — 50; у про за 8 с до броска сетапа бросающий в 165 ед. от точки, дальше 500 — 6 %) у цели про
    // несколько точек броска: боец кидает с той, до которой ему ближе по пути (luSpotFor). Можно — с точки зоны его гранаты по плану, с точки
    // зоны, где он сейчас стоит (CT: «кидаю, откуда стою»), а хозяину цели по плану — с любой. Раньше точку давал тот лайнап группы, чьё
    // время наступило первым
    var spotOf = function(b){ return L.pro && L.grp ? luSpotFor(b, L, npMomentOfLineup(L)) : L; };
    var cost = function(b){ var F = spotOf(b).from; return pathLenTo(b, F.x, F.y) + (b.tRole === "entry" ? 300 : 0) + nadeRoleCost(b); };
    // (v428, PRINCIPLES М160; заменяет «опорник — не дальше 300 от поста» v285 и «лайнап сетапа по пути, крюк 300» v424) кидает хозяин
    // гранаты по плану команды (365): граната этого типа отложена на этот момент или раньше и — до контакта / на сетапе / на выходе —
    // для зоны лайнапа (CT — где стоит бросающий, T — куда падает граната; как в tools/nadeplan_bake.py). Колл, ретейк, после
    // планта — помощь: зона не важна, кидает ближайший, у кого есть
    var luM = npMomentOfLineup(L);
    // зона лайнапа — до контакта / на сетапе / на выходе (CT — откуда бросок, T — куда падает); колл, ретейк, после планта — помощь, зона
    // не важна. (v430) у T на сетапе зона снова проверяется: в v428 её сняли, думая, что из-за неё просел сетап, — причина была в другом
    // (v429, гранаты на потом); без неё лайнапы сетапа доставались кому угодно (м1 Mirage: 500–1000 ед. назад за гранатой)
    var luZ = luM === "now" || luM === "exec" ? (L._npz || (L._npz = L.team === "CT" ? npZoneAt(L.from.x, L.from.y) : npZoneAt(L.to.x, L.to.y))) : null;
    var okBot = function(b){ if(!(b.team === L.team && b.alive && b.nades && b.nades[L.type] > 0 &&
      !b.planting && !b.defusing && !(bomb.state === "carried" && bomb.carrier === b))) return false;
      var S = spotOf(b); if(!S || (!(L.pro && L.grp) && !npCanUse(b, L.type, luM, luZ))) return false;
      var F = S.from; return Math.hypot(b.x-F.x, b.y-F.y) < maxD && pathLenTo(b, F.x, F.y) < maxD; };
    // (v359, р7) кто уже стоит на сайте T (взял его) — с сайта за гранатой назад не уходит
    var onTSite = function(b){ var S = L.team === "T" && tt && SITES[tt.site]; return !!S && (onSite(S, b.x, b.y) || Math.hypot(b.x-S.x, b.y-S.y) < 450) && Math.hypot(L.from.x-S.x, L.from.y-S.y) > Math.hypot(b.x-S.x, b.y-S.y) + 200; };
    var cand = bots.filter(function(b){ return okBot(b) && !b.nadeTask && !onTSite(b); }).sort(function(a, b2){ return cost(a) - cost(b2); })[0];
    // (v429) запланированную цель кидает её хозяин по плану гранат; хозяин жив, но сейчас не может (занят, далеко) — ждём его
    if(L.pro && L.grp && bots.some(function(o){ return o.alive && o.team === L.team && npOwner(o, L); }))
      cand = bots.filter(function(b){ return okBot(b) && !b.nadeTask && !onTSite(b) && npOwner(b, L); }).sort(function(a, b2){ return cost(a) - cost(b2); })[0];
    // (v355) свободного нет — граната выхода встаёт в очередь тому, кто уже идёт на лайнап рядом (точки броска ≤ EXEC_QUEUE_R):
    // кинет вторую следом (через NADE_GAP), как про кидают смок + флешку с одной точки. Раньше: одно задание на бойца — лайнап сгорал
    // (v359, владелец: «один и тот же игрок кидает несколько гранат по очереди; обычно гранаты дают одному — чтобы другие пикали не
    // одни, но бывает и несколько») граната выхода, которую взял бы энтри или AWP, — в очередь саппорту/IGL, если он уже идёт на
    // лайнап (точка броска ≤ EXEC_QUEUE_R): раскид кидает он, энтри и AWP остаются на своих углах; очередь — до EXEC_QUEUE_N
    var utilRole = function(b){ return b.tRole === "support" || b.tRole === "igl"; };
    // (v362, владелец: «чередовать с типом, где один в соло всё кидает») в части раундов раскид выхода — на одном игроке
    // (tSoloThrower): все гранаты выхода, которые у него есть, кидает он по очереди, где бы ни была точка броска; чего у него нет —
    // остальные, как обычно. Демки Mirage (352 выхода, гранаты T за 15 с до планта): один игрок бросил ≥ 60 % — в 36 % раундов
    var solo = execT ? tSoloThrower() : null;
    if(solo){
      var busyN = (solo.nadeTask && solo.nadeTask.type === L.type ? 1 : 0) + (solo.nadeQueue||[]).filter(function(q){ return q.type === L.type; }).length;
      if(solo.nades && solo.nades[L.type] > busyN && !solo.planting && (solo.nadeQueue||[]).length < 4 && !onTSite(solo)){
        nadeFlags[key] = true; nadeFlags["luok"+L.id] = true; proGroupDone(L);
        if(!solo.nadeTask){
          var sP = Math.max(7, Math.ceil(pathLenTo(solo, L.from.x, L.from.y)/SPEED + LU_REACH_PAD));
          solo.nadeTask = {type:L.type, x:L.to.x, y:L.to.y, from:{x:L.from.x, y:L.from.y}, until: tick + sP*TICK_HZ, why:"лайнап «"+(L.name||LU_TYPE[L.type])+"»", start:tick, lob:true, range:4000, now:true, lineup:true, exec:L.type === "smoke", npm:luM};
          logEvent(solo.id+": раскид — идёт на «"+(L.name||LU_TYPE[L.type])+"»");
        } else {
          (solo.nadeQueue = solo.nadeQueue || []).push({type:L.type, x:L.to.x, y:L.to.y, from:{x:L.from.x, y:L.from.y}, why:"лайнап «"+(L.name||LU_TYPE[L.type])+"»", lineup:true, exec:true, npm:luM});
          logEvent(solo.id+": раскид — следом «"+(L.name||LU_TYPE[L.type])+"»");
        }
        return;
      }
    }
    if(execT && cand && (cand.tRole === "entry" || cand.tRole === "awp") && bots.some(function(b){ return okBot(b) && utilRole(b) && b.nadeTask && b.nadeTask.lineup; })) cand = null;
    if(!cand && execT){
      var qb = bots.filter(function(b){ var t = b.nadeTask; if(!okBot(b) || !t || !t.lineup || !t.from || (b.nadeQueue||[]).length >= EXEC_QUEUE_N) return false;
        var need = (t.type === L.type ? 1 : 0) + (b.nadeQueue||[]).filter(function(q){ return q.type === L.type; }).length + 1;
        return b.nades[L.type] >= need && Math.hypot(t.from.x-L.from.x, t.from.y-L.from.y) < EXEC_QUEUE_R; })
        .sort(function(a, b2){ return (utilRole(a) ? 0 : 400) + cost(a) - (utilRole(b2) ? 0 : 400) - cost(b2); })[0];
      if(qb){
        nadeFlags[key] = true; nadeFlags["luok"+L.id] = true; proGroupDone(L);
        (qb.nadeQueue = qb.nadeQueue || []).push({type:L.type, x:L.to.x, y:L.to.y, from:{x:L.from.x, y:L.from.y}, why:"лайнап «"+(L.name||LU_TYPE[L.type])+"»", lineup:true, exec:true, npm:luM});
        logEvent(qb.id+": следом кинет «"+(L.name||LU_TYPE[L.type])+"»");
        return;
      }
    }
    // раньше флаг "готово" ставился ДО проверки кандидата — если в момент
    // срабатывания триггера рядом с точкой броска никого не было, лайнап
    // считался выполненным навсегда и боец, который должен был его кинуть,
    // просто стоял без дела весь раунд. Теперь пробуем каждый тик, пока не
    // найдётся боец в радиусе, или пока не истечёт время триггера (~10с для
    // горячих фаз, иначе до конца раунда для сетапа/инсты)
    if(!cand){
      // (v355) граната выхода ждёт бросающего весь выход (пока бомба не стоит, до EXEC_WAIT_SEC — проектное число), а не 10 с
      var luWait = (execT && bomb.state !== "planted" ? EXEC_WAIT_SEC : 10)*TICK_HZ;
      if(!hot || since - (nadeFlags["_lu0"+L.id] || since) < luWait){
        if(nadeFlags["_lu0"+L.id] === undefined) nadeFlags["_lu0"+L.id] = since;
        return;
      }
      nadeFlags[key] = true; return; // так и не нашли, кто бросит — сдаёмся
    }
    nadeFlags[key] = true;
    nadeFlags["luok"+L.id] = true; proGroupDone(L);
    // (v340, отметка владельца: sh1ro шёл на смок Connector, задание сгорело у уступа — развернулся, «отталкивает») срок — не
    // меньше дороги до точки броска по пути + LU_REACH_PAD с (проектное число); раньше только 7 / 12 / 20 с
    var LS = spotOf(cand);
    var luBase = hot ? ((BAL.nadeReach && L.trigger === "timed") ? 12 : 7) : 20, luP = buildWaypointPath(cand.baseX, cand.baseY, cand.z, LS.from.x, LS.from.y, 0), luLen = 0, luX = cand.baseX, luY = cand.baseY;
    luP.forEach(function(q){ luLen += Math.hypot(q[0]-luX, q[1]-luY); luX = q[0]; luY = q[1]; });
    var luSec = Math.max(luBase, Math.ceil(luLen/(SPEED*weaponSpeedMul(cand)) + LU_REACH_PAD));
    cand.nadeTask = {type:L.type, x:LS.to.x, y:LS.to.y, from:{x:LS.from.x, y:LS.from.y}, until: tick + luSec*TICK_HZ, why:"лайнап «"+(LS.name||LU_TYPE[L.type])+"»",
                     start:tick, lob:true, range:4000, now:true, lineup:true, exec:execT && L.type === "smoke", npm:luM, luL: L.pro && L.grp ? L : null};
    logEvent(cand.id+": идёт на лайнап «"+(LS.name||LU_TYPE[L.type])+"»");
  });
}
var LU_REACH_PAD = 3;
// (док 6) точка броска цели L для бойца b: среди лайнапов той же цели (группа про, 320) своей стороны и сайта — ближайшая по пути из тех,
// откуда ему можно: хозяину цели по плану гранат — любая; остальным — в зоне его гранаты (npCanUse) или (CT) в зоне, где он сейчас стоит.
// Зона точки — как у плана: CT — откуда бросок, T — куда падает; колл, ретейк, после планта — зона не важна. Нет такой — null
function luSpotFor(b, L, luM){
  var tt = teamTac.T, best = null, bl = Infinity, own = npOwner(b, L), myZ = L.team === "CT" ? npZoneAt(b.x, b.y) : null;
  (PRO_GROUPS[L.grp] || [L]).forEach(function(M){
    if(M.team !== L.team || (L.team === "T" && M.site !== "any" && tt && M.site !== tt.site)) return;
    if(!own){ var z = luM === "now" || luM === "exec" ? (M.team === "CT" ? npZoneAt(M.from.x, M.from.y) : npZoneAt(M.to.x, M.to.y)) : null;
      if(!npCanUse(b, L.type, luM, z) && !(myZ && z === myZ && npCanUse(b, L.type, luM, null))) return; }
    var d = pathLenTo(b, M.from.x, M.from.y); if(d < bl){ bl = d; best = M; } });
  return best;
}
var CLR_REB_SEC = 12, EXEC_REACH = 1000, EXEC_QUEUE_R = 600, EXEC_QUEUE_N = 3, EXEC_WAIT_SEC = 20;   // (v355) проектные числа
