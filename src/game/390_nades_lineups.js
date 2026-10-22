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
// (Г1) лайнапы про больше не разыгрываются здесь по одному — их кидает план гранат тактики (planTick ниже); здесь — свои и зашитые
function allLineups(){ return LINEUPS_BAKED.concat(USER_LINEUPS); }
var LU_TRIG = {insta:"инста", setup:"сетап T", exec:"выход T", postplant:"пост-плант", call:"колл CT", retake:"ретейк"};
var LU_TYPE = {smoke:"смок", flash:"флешка", molly:"молотов", he:"HE"};
// (14) гранаты выхода раньше: смоки/молотов летят за ~4с до выхода (пока
// группа стоит на точках), а не в момент выхода — раньше энтри уже пикал,
// а смок ещё летел или его вообще не успевали кинуть
function preExecNow(tt){
  if(!BAL.nadeEarly || !tt || tt.phase !== "setup" || !tt.execTick || tt.rebound && tick - (tt._rbT||0) < 2*TICK_HZ) return false;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  return tick >= tt.execTick - 4*TICK_HZ && secLeft > 30 && !(tt.tac && (tt.tac.style === "rush" || tt.tac.style === "fake"));
}
function tExecNadesFlying(){
  return nadesInAir.some(function(n){ return n.team === "T" && (n.type === "smoke" || n.type === "molly"); }) ||
    bots.some(function(b){ return b.alive && b.team === "T" && b.nadeTask && (b.nadeTask.type === "smoke") && b.nadeTask.exec; });
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
  planTick();
  var tt = teamTac.T, ct = teamTac.CT, since = tick - roundStartTick;
  allLineups().forEach(function(L){
    var key = "lu"+L.id; if(nadeFlags[key]) return;
    var siteOk = function(k){ return L.site === "any" || L.site === k; };
    var go = false;
    if(L.trigger === "insta") go = since > TICK_HZ;
    else if(L.trigger === "timed") go = bomb.state !== "planted" && since >= (L.at||0)*TICK_HZ && since < ((L.at||0)+12)*TICK_HZ;
    else if(L.team === "T" && L.trigger === "setup") go = tt.phase === "setup" && since > 12*TICK_HZ && siteOk(tt.site);
    else if(L.team === "T" && L.trigger === "exec") go = (tt.phase === "execute" || preExecNow(tt)) && siteOk(tt.site);
    else if(L.team === "T" && L.trigger === "postplant") go = bomb.state === "planted" && siteOk(bomb.site);
    else if(L.team === "CT" && L.trigger === "call") go = ct && ct.call && ct.call.count >= 2 && siteOk(ct.call.site);
    else if(L.team === "CT" && L.trigger === "retake") go = bomb.state === "planted" && siteOk(bomb.site);
    if(!go) return;
    luGive(L, key, since, tt);
  });
}
// кому отдать гранату L (лайнап: точка броска L.from): ближайший свободный в радиусе по фазе; key — флаг «готово» в nadeFlags
// (ok-флаг — key с «ok» после двух букв: luok…, piok…); не нашёлся — ждём до конца окна, потом сдаёмся
function luGive(L, key, since, tt){
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
    var okKey = key.slice(0, 2)+"ok"+key.slice(2), waitKey = "_w"+key;
    var cost = function(b){ return Math.hypot(b.x-L.from.x, b.y-L.from.y) + (b.tRole === "entry" ? 300 : 0) + nadeRoleCost(b); };
    // (v285, владелец 14.10) опорник не уходит со своей точки ради гранаты (опорник A уходил в Top Mid — A пустой): кидает только
    // то, что кидается рядом с его постом (≤300 px — проектное число); по коллу и на ретейке — как раньше
    var leavesSite = function(b){ if(b.team !== "CT" || L.trigger === "retake" || L.trigger === "call") return false; var k = b.tRole === "anchorA" ? "A" : b.tRole === "anchorB" ? "B" : null; if(!k) return false;
      var P0 = b.post && b.post.tag === "anchor" ? b.post : SITES[k]; return Math.hypot(L.from.x-P0.x, L.from.y-P0.y) > 300; };
    var okBot = function(b){ return b.team === L.team && b.alive && b.nades && b.nades[L.type] > 0 && !leavesSite(b) &&
      !b.planting && !b.defusing && !(bomb.state === "carried" && bomb.carrier === b) && Math.hypot(b.x-L.from.x, b.y-L.from.y) < maxD; };
    // (v359, р7) кто уже стоит на сайте T (взял его) — с сайта за гранатой назад не уходит
    var onTSite = function(b){ var S = L.team === "T" && tt && SITES[tt.site]; return !!S && (onSite(S, b.x, b.y) || Math.hypot(b.x-S.x, b.y-S.y) < 450) && Math.hypot(L.from.x-S.x, L.from.y-S.y) > Math.hypot(b.x-S.x, b.y-S.y) + 200; };
    // (Г1) граната плана тактики важнее общего задания бойца (не лайнапа): у про гранаты плана летят всегда, общие — по ходу
    // (v396д, сторож: задания плана снимались у бойца в перестановке / контакте — арбитр места не пускал его к точке броска) гранату
    // плана берёт тот, кого арбитр к лайнапу пустит (taskCanSet); остальные — по ходу, как было
    // (v399) задача ниже TASK_ROUTE_CANCEL лайнап не снимает, а ставит на паузу (updateNadeTasks) — такого бойца тоже можно звать
    var plan = key.slice(0, 2) === "pi", free = function(b){ return (!b.nadeTask || (plan && !b.nadeTask.lineup)) &&
      (!plan || taskCanSet(b, "lineup") || b._task.lv < TASK_ROUTE_CANCEL); };
    var cand = bots.filter(function(b){ return okBot(b) && free(b) && !onTSite(b); }).sort(function(a, b2){ return cost(a) - cost(b2); })[0];
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
        nadeFlags[key] = true; nadeFlags[okKey] = true;
        if(!solo.nadeTask || !solo.nadeTask.lineup){
          var sP = Math.max(7, Math.ceil(pathLenTo(solo, L.from.x, L.from.y)/SPEED + LU_REACH_PAD));
          var A1 = luAssign(L, solo); solo.nadeTask = {type:L.type, x:A1.x, y:A1.y, from:A1.from, rec:A1.rec, until: tick + sP*TICK_HZ, why:"лайнап «"+(L.name||LU_TYPE[L.type])+"»", start:tick, lob:true, range:4000, now:true, lineup:true, exec:L.type === "smoke"};
          logEvent(solo.id+": раскид — идёт на «"+(L.name||LU_TYPE[L.type])+"»");
        } else {
          var A2 = luAssign(L, solo); (solo.nadeQueue = solo.nadeQueue || []).push({type:L.type, x:A2.x, y:A2.y, from:A2.from, rec:A2.rec, why:"лайнап «"+(L.name||LU_TYPE[L.type])+"»", lineup:true, exec:true});
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
        nadeFlags[key] = true; nadeFlags[okKey] = true;
        var A3 = luAssign(L, qb); (qb.nadeQueue = qb.nadeQueue || []).push({type:L.type, x:A3.x, y:A3.y, from:A3.from, rec:A3.rec, why:"лайнап «"+(L.name||LU_TYPE[L.type])+"»", lineup:true, exec:true});
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
      if(!hot || since - (nadeFlags[waitKey] || since) < luWait){
        if(nadeFlags[waitKey] === undefined) nadeFlags[waitKey] = since;
        return;
      }
      nadeFlags[key] = true; return; // так и не нашли, кто бросит — сдаёмся
    }
    nadeFlags[key] = true;
    nadeFlags[okKey] = true;
    // (v340, отметка владельца: sh1ro шёл на смок Connector, задание сгорело у уступа — развернулся, «отталкивает») срок — не
    // меньше дороги до точки броска по пути + LU_REACH_PAD с (проектное число); раньше только 7 / 12 / 20 с
    var luBase = hot ? ((BAL.nadeReach && L.trigger === "timed") ? 12 : 7) : 20, luP = buildWaypointPath(cand.baseX, cand.baseY, cand.z, L.from.x, L.from.y, 0), luLen = 0, luX = cand.baseX, luY = cand.baseY;
    luP.forEach(function(q){ luLen += Math.hypot(q[0]-luX, q[1]-luY); luX = q[0]; luY = q[1]; });
    var luSec = Math.max(luBase, Math.ceil(luLen/(SPEED*weaponSpeedMul(cand)) + LU_REACH_PAD));
    if(cand.nadeTask) logEvent(cand.id+": «"+(cand.nadeTask.why||"")+"» снята — граната плана");
    var A4 = luAssign(L, cand);
    cand.nadeTask = {type:L.type, x:A4.x, y:A4.y, from:A4.from, rec:A4.rec, until: tick + luSec*TICK_HZ, why:"лайнап «"+(L.name||LU_TYPE[L.type])+"»",
                     start:tick, lob:true, range:4000, now:true, lineup:true, exec:execT && L.type === "smoke"};
    logEvent(cand.id+": идёт на лайнап «"+(L.name||LU_TYPE[L.type])+"»");
}
// ======================= (Г1) ПЛАН ГРАНАТ ТАКТИКИ =======================
// Гранаты раунда идут от тактики (владелец 17.10, nades_plan шаг 5), а не каждая своей вероятностью. Набор карты (MAP.tactics.nadePlans,
// tools/route_nades.py — из демок про): у каждого выхода T (тактика несёт поле exit) — сочетания гранат раундов про этим выходом с их
// частотой; IGL берёт одно сочетание на раунд (как про — разные раунды, разные планы), и все гранаты сочетания летят, если граната
// есть и кидающий рядом. Фаза гранаты: start — про кидают её до выхода (с её секунды), exec — после выхода про (со своей секунды
// или в момент выхода ботов, что раньше; от фазы — радиус и окно, кто кидает: luGive).
// CT выход T заранее не знают: их гранаты по времени (ctTimed) — сочетание раунда про, каждая со своей секунды; ответ на выход
// (ctResp[выход]) — когда команда CT по своему знанию (beliefCount — слышали / видели) держит в зоне этого выхода хотя бы
// RESP_BELIEF врага: летит то, что про после такого выхода кидают чаще обычного, если в раунде оно ещё не летело.
var NP = MAP.tactics.nadePlans || null, NADE_PLAN = null, PLAN_LU = null;
var RESP_BELIEF = 1.0;   // «там T» — сумма вероятностей знания ≥ одного врага — проектное число
function planPick(list, seed){
  if(!list || !list.length) return [];
  var tot = 0; list.forEach(function(s){ tot += s[0]; });
  var u = hashRand(seed)*tot;
  for(var i=0;i<list.length;i++){ u -= list[i][0]; if(u < 0) return list[i][1]; }
  return list[list.length-1][1];
}
// на старте раунда (из chooseTactic): сочетание T по выходу тактики, сочетание CT по времени
function planNades(){
  NADE_PLAN = {T:[], CT:[], exit:null};
  if(!NP) return;
  var tac = teamTac.T && teamTac.T.tac, ex = tac && tac.exit && NP.exits[tac.exit] ? tac.exit : null;
  if(ex) NADE_PLAN.T = planPick(NP.exits[ex].T, roundNum*4567 + matchNum*7919 + 3);
  NADE_PLAN.CT = planPick(NP.ctTimed, roundNum*3571 + matchNum*6053 + 11);
  NADE_PLAN.exit = ex;
  var nm = function(L){ return L.map(function(i){ var it = NP.items[i]; return LU_TYPE[it.type]+" "+it.zone; }).join(", ") || "—"; };
  logEvent("план гранат T (выход "+(ex||"—")+"): "+nm(NADE_PLAN.T)+"; CT: "+nm(NADE_PLAN.CT));
}
// лайнап про для гранаты плана: копия лайнапа с триггером фазы (от него в luGive — радиус и окно); кешируется
var PLAN_TRIG = {start:"setup", exec:"exec", timed:"timed", resp:"call"};
function planLineup(i, L){
  PLAN_LU = PLAN_LU || {};
  var k = i+"|"+L.id; if(PLAN_LU[k]) return PLAN_LU[k];
  var it = NP.items[i], C = {}; for(var f in L) C[f] = L[f];
  C.trigger = PLAN_TRIG[it.phase]; C.site = "any"; C.name = "план · "+(L.name||"");
  return (PLAN_LU[k] = C);
}
// (Г1) запас под план: пока граната плана не кинута, общие решения (assignNade без opts.plan) не берут последнюю такую гранату
// команды — заменяет tSmokeReserveOk (держать 2 смока на выход)
function planReserved(b, type){
  if(!NADE_PLAN || !NP || roundState !== "live" || bomb.state === "planted") return false;
  var need = 0; (NADE_PLAN[b.team] || []).forEach(function(i){ var it = NP.items[i]; if(it.type === type && !nadeFlags["pi"+i]) need++; });
  if(!need) return false;
  var have = 0; bots.forEach(function(o){ if(o.alive && o.team === b.team && o.nades) have += o.nades[type] - (o.nadeTask && o.nadeTask.type === type ? 1 : 0); });
  return have - 1 < need;
}
var PRO_BY_ID = null;
function planGive(i, since, tt){
  var it = NP.items[i], key = "pi"+i;
  if(nadeFlags[key]) return;
  if(!it.lineups.length){   // у про нет лайнапа в эту зону — бросок «на глаз»: физика подбирает его с места бойца
    var c = bots.filter(function(b){ return b.team === it.team && b.alive && b.nades && b.nades[it.type] > 0 && !b.nadeTask && !b.planting && !b.defusing &&
        !(bomb.state === "carried" && bomb.carrier === b) && Math.hypot(b.x-it.to.x, b.y-it.to.y) < NADE_THROW_RANGE; })
      .sort(function(a, b2){ return Math.hypot(a.x-it.to.x, a.y-it.to.y) - Math.hypot(b2.x-it.to.x, b2.y-it.to.y); })[0];
    if(c && assignNade(c, it.type, it.to, "план: "+LU_TYPE[it.type]+" "+it.zone, {now:true, plan:true})){ nadeFlags[key] = true; return; }
    if(nadeFlags["_w"+key] === undefined) nadeFlags["_w"+key] = since;
    if(since - nadeFlags["_w"+key] > (it.phase === "timed" ? 10 : EXEC_WAIT_SEC)*TICK_HZ) nadeFlags[key] = true;
    return;
  }
  if(!PRO_BY_ID){ PRO_BY_ID = {}; proLineups().forEach(function(L){ PRO_BY_ID[L.id] = L; }); }
  // из лайнапов этой гранаты — тот, до точки броска которого ближе всего кому-то из своих с этой гранатой
  var best = null, bd = Infinity;
  it.lineups.forEach(function(id){ var L = PRO_BY_ID[id]; if(!L) return;
    bots.forEach(function(b){ if(b.team !== it.team || !b.alive || !b.nades || b.nades[it.type] <= 0) return;
      var d = Math.hypot(b.x-L.from.x, b.y-L.from.y); if(d < bd){ bd = d; best = L; } }); });
  if(!best){ nadeFlags[key] = true; return; }   // гранаты такой ни у кого нет
  luGive(planLineup(i, best), key, since, tt);
}
function planTick(){
  if(!NADE_PLAN || !NP || bomb.state === "planted") return;
  var tt = teamTac.T, since = tick - roundStartTick;
  NADE_PLAN.T.forEach(function(i){ var it = NP.items[i], go;
    if(it.phase === "start") go = since >= Math.max(1, it.t - 1)*TICK_HZ && !(tt.execStart && tick - tt.execStart > 10*TICK_HZ);
    // (v396г, сторож: гранаты выхода, отданные в момент выхода, снимались перестановкой / контактом / смертью — долетало 20 %) у про
    // они летят со своей секунды, пока группа стоит на подходе (смок Cross на 32-й с при выходе позже) — так и здесь; выход раньше
    // этой секунды — в момент выхода, как было
    else go = since >= Math.max(1, it.t - 1)*TICK_HZ || tt.phase === "execute" || preExecNow(tt);
    if(go) planGive(i, since, tt); });
  NADE_PLAN.CT.forEach(function(i){ var it = NP.items[i];
    if(since >= Math.max(0.5, it.t - 0.5)*TICK_HZ && since < (it.t + 12)*TICK_HZ) planGive(i, since, tt); });
  if(tick % 16) return;
  for(var e in NP.ctResp){ var R = NP.ctResp[e]; if(!R.length || nadeFlags["_resp"+e]) continue;
    var zi = zonesByName(e).map(function(id){ return BZ.idx[id]; }).filter(function(x){ return x != null; });
    if(!zi.length || beliefCount("CT", zi) < RESP_BELIEF) continue;
    nadeFlags["_resp"+e] = since;
    logEvent("CT: T идут через "+e+" — ответные гранаты");
  }
  for(var e2 in NP.ctResp) if(nadeFlags["_resp"+e2] != null)
    NP.ctResp[e2].forEach(function(i){
      var it = NP.items[i], dup = NADE_PLAN.CT.some(function(j){ var q = NP.items[j]; return q.type === it.type && q.zone === it.zone && nadeFlags["piok"+j]; });
      if(!dup) planGive(i, since, tt); });
}
var LU_REACH_PAD = 3;
// (В4) куда и откуда кидает этот боец: лайнап с записанными бросками про — записанный бросок (nadeRecPick, 380): место — начало
// разбега, цель — разрыв этого броска у про; без записи (у про это бросок «на глаз», не лайнап) — как раньше: точка набора, бросок
// подбирает физика (своя граната, nadeSolve) — до В5
function luAssign(L, b){
  var R = nadeRecPick(L, b, roundNum*7919 + matchNum*104729 + tick*13 + b.id.charCodeAt(b.id.length-1));
  return R ? {x: R.det.x, y: R.det.y, from: {x: R.start.x, y: R.start.y}, rec: R} : {x: L.to.x, y: L.to.y, from: {x: L.from.x, y: L.from.y}, rec: null};
}
var CLR_REB_SEC = 12, EXEC_REACH = 1000, EXEC_QUEUE_R = 600, EXEC_QUEUE_N = 3, EXEC_WAIT_SEC = 20;   // (v355) проектные числа
