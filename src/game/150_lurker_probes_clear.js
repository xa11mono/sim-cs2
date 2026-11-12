// ---------- лёркер (план §5: "держит фланг") ----------
// Раньше: в setup ходил маршрутом роумера, а с выхода и до конца раунда стоял
// на одной точке на миде. Теперь это отдельная линия поведения, всё — тихим
// шагом:
//  • setup — тихо уходит на ДРУГОЙ сайт (не тот, куда выход) и стоит в укрытии
//    у его прохода — собирает инфу и оттягивает на себя внимание;
//  • выход — "режет ротацию": идёт следом за CT, которые побегут с этого сайта
//    на помощь, по маршруту проход → позиция опорника → путь ротации, на каждой
//    точке коротко держит угол;
//  • пост-плант — заходит CT в спину: встаёт за их точкой сбора на ретейк.
// маршруты лёркера по названиям зон: на B — через воду к рампе или через
// мид/лампу к кейву; на A — через лестницу к мейну или через мид к донату
var LURK_PLANS = MAP.tactics.lurkPlans;
var LURK_DEATH_R = 200;   // px: смерть T «на пути лёрка» — ближе этого к точке пути (проектное число)
var LURK_JOIN_SEC = 10, LURK_CHECK = 0.6, TAKE_ADV = 2.5, TAKE_STEP = 120, TAKE_REACH = 500, KILL_MOVE = [50, 140];
function lurkGoNow(tt){ return tt.phase === "setup" && tt.execTick && tick >= tt.execTick - LURK_JOIN_SEC*TICK_HZ; }
function lurkerBrain(b, tt, other){
  var go = GEO[other];
  if(!b._lurkPlan || b._lurkPlan.round !== roundNum || b._lurkPlan.site !== other){
    // (v561, этап 2 docs/tasks/PLAN_TACTICS_V2.md: одиночка T гибнет в первые 30 с в 2–3 раза чаще про; PRO_PLAY §6з: «лёркер не бежит туда,
    // где его ждут: факт прошлых раундов → предположение») путь лёрка — тот, на котором в этом матче T погибали реже (память смертей T, по точкам
    // пути); поровну — жребий, как было
    var opts = LURK_PLANS[other], dng = opts.map(function(P){ return (P.via || []).concat([P.stage, P.entry]).filter(Boolean).reduce(function(a, n){
      var zp = zonePoint(n, go.tStage); return a + (zp ? tDeathsNear(zp.x, zp.y, LURK_DEATH_R) : 0); }, 0); });
    var pi = dng.length > 1 && dng[0] !== dng[1] ? (dng[0] < dng[1] ? 0 : 1) : (hashRand(roundNum*733 + matchNum*19) < 0.5 ? 0 : 1), P = opts[pi];
    var st = P.stage ? zonePoint(P.stage, go.tStage) : null, en = P.entry ? zonePoint(P.entry, st || go.tStage) : null;
    b._lurkPlan = {round:roundNum, site:other, via:P.via, stage: st || go.tStage, entry: en || go.tEntry, name: P.stage || "стандарт"};
    startRoute(b, P.via, "lurk"+other+pi);
  }
  var LP = b._lurkPlan;
  // (00_PLAN, пакет тактики, ответ владельца 05.11: «лёркер сам решает обход — только по информации команды и плану: подтверждённый стак CT на
  // другой стороне, CT не успевают по времени, CT сместились ротацией; не уходит, если выход уже идёт или маршрут опасен; прошёл — «пусто»
  // только про проверенное; дальше — держать проход, резать ротацию, поздний выход со своей стороны, к команде, если мало времени»)
  // до выхода (сетап): у сайта выхода команда недавно (SITE_SEEN_SEC) знает двоих и больше CT (стак / ротация туда) или по таймингам
  // (REACH — знание команды) CT ещё не могли быть ни в одной зоне его пути — проходит свою сторону: вход → точка опорника → проход ротации
  // (LURK_CHECK на точке; «пусто» — tClearCalls / markClear, только про виденное), там держит проход до выхода. Свежая инфа о CT у пути —
  // не идёт (опасно). Мало времени (EXU_LATE) — не начинает
  if(tt.phase === "setup" && !lurkGoNow(tt)){
    var SO = b._lurkSolo && b._lurkSolo.round === roundNum && b._lurkSolo.site === other ? b._lurkSolo : null;
    if(!SO && !b._sawEnemy && ROUND_TIME_SEC - (simTime - roundStartTime) > EXU_LATE){
      var route = [LP.entry, go.anchor, GEO.rotator].filter(Boolean), BLs = beliefLast.T || {};
      // опасно — известный команде (за SITE_SEEN_SEC) CT простреливает точку пути: с его места есть линия на неё
      var danger = route.some(function(p){ return bots.some(function(o){ var e = BLs[o.id]; return o.alive && o.team === "CT" && e && tick - e.tick <= SITE_SEEN_SEC*TICK_HZ && hasLOS(e.x, e.y, p.x, p.y); }); });
      var stack = siteAssess("T", tt.site).near >= 2;
      // CT не успевают: по таймингам команды (REACH: с какого тика враг мог бы быть в зоне) — позже, чем лёркер дойдёт до точки по пути
      var RT = REACH.T, early = !!RT && route.every(function(p){ var z = bzOf(p.x, p.y); return z >= 0 && RT[z] > tick + pathLenTo(b, p.x, p.y)/SPEED*TICK_HZ; });
      if(!danger && (stack || early)){
        SO = b._lurkSolo = {round:roundNum, site:other, route:route, i:0, t:0};
        voiceLog("T", "lurksolo"+roundNum, b.id, "прохожу "+other+(stack ? " — они на "+tt.site : " — туда ещё не успели")+", держу проход");
        logEvent(b.id+": лёркер идёт через "+other+" сам — "+(stack ? "стак CT на "+tt.site : "по таймингам CT там ещё нет"));
      }
    }
    if(SO){
      if(b._sawEnemy || ROUND_TIME_SEC - (simTime - roundStartTime) <= EXU_LATE){ b._lurkSolo = null; }   // бой — свой контакт (350); мало времени — к своим
      else { var si = Math.min(SO.i, SO.route.length-1), lk = si < SO.route.length-1 ? SO.route[si+1] : GEO[tt.site].ctEntry;
        b._route = null; setPost(b, SO.route[si], lk, true, si === SO.route.length-1 ? "lurkRot" : "lurk"+si);
        if(b.atPost){ if(!SO.t) SO.t = tick; if(tick - SO.t > LURK_CHECK*TICK_HZ && si < SO.route.length-1){ SO.i = si+1; SO.t = 0; } }
        return; }
    }
    // не стоит столбом весь сетап: чередует укрытие и короткий выгляд на
    // проход сайта ("есть ли кто?") — ~5с в укрытии, ~2.5с на выгляде
    var hide = pickSpots("lurkStage"+other+LP.name, LP.stage, 1, {rMax:200, minGap:40, hideFrom:[SITES[other], go.anchor], see:[LP.entry]})[0];
    var peek = walk({x: LP.stage.x + (LP.entry.x-LP.stage.x)*0.6, y: LP.stage.y + (LP.entry.y-LP.stage.y)*0.6});
    if(b._lurkPh === undefined){ b._lurkPh = 0; b._lurkArr = 0; }
    var atPeek = b._lurkPh === 1;
    setPost(b, atPeek ? peek : hide, LP.entry, true, atPeek ? "lurkPeek" : "lurkStage"+other);
    if(b.atPost){
      if(!b._lurkArr) b._lurkArr = tick;
      if(tick - b._lurkArr > (atPeek ? 160 : 320)){ b._lurkPh = 1 - b._lurkPh; b._lurkArr = 0; }
    }
    b._lurkIdx = 0;
    return;
  }
  if(tt.phase === "execute" || lurkGoNow(tt)){
    // (v369, владелец: «лёркер не играет, когда тиммейты зашли или пытаются выйти на сайт») у про к выходу лёркер уже рядом: в
    // 94 % раундов с плантом все T за 9 с до планта (≈ выход) ближе 600 ед. карты к точке планта (демки Mirage, 774 раунда); из
    // оставшихся лёркеров половина держит проход ротации, 15 % идёт к своим, 11 % лезет на другой сайт. Поэтому лёркер начинает
    // двигаться за LURK_JOIN_SEC с до выхода: стоит у входа на другой сайт — проходит его (зачистка опорника), режет ротацию через
    // проход между сайтами и заходит на сайт выхода со стороны CT; далеко от входа — идёт к своим (сбор выхода). На точках — по
    // LURK_CHECK с (было 2,3 с на каждой — шёл весь выход). Проектные числа
    var site = SITES[tt.site], gs = GEO[tt.site];
    if(!b._lurkGo || b._lurkGo.round !== roundNum || b._lurkGo.site !== tt.site){
      var nearOther = Math.hypot(b.x-LP.entry.x, b.y-LP.entry.y) < 500, soloOn = b._lurkSolo && b._lurkSolo.round === roundNum;
      b._route = null; b._routeDone = null;   // маршрут лёрка сетапа — закончен
      // (ответ владельца 05.11) прошёл свою сторону сам до выхода — поздний выход оттуда: с прохода ротации в спину сайту выхода
      b._lurkGo = {round:roundNum, site:tt.site, route: soloOn ? [GEO.rotator, gs.ctEntry] : nearOther ? [LP.entry, go.anchor, GEO.rotator, gs.ctEntry] : [gs.tStage || gs.tEntry, gs.tEntry], i:0, t:0};
      voiceLog("T", "lurkgo"+roundNum, b.id, soloOn ? "иду в спину на "+tt.site : nearOther ? "режу ротацию с "+other : "иду к вам на "+tt.site);
    }
    var LG = b._lurkGo, i = Math.min(LG.i, LG.route.length-1);
    var look = i < LG.route.length-1 ? LG.route[i+1] : site;
    setPost(b, LG.route[i], look, true, "lurk"+i);
    if(b.atPost){
      if(!LG.t) LG.t = tick;
      if(tick - LG.t > LURK_CHECK*TICK_HZ && i < LG.route.length-1){ LG.i = i+1; LG.t = 0; }
    }
    return;
  }
  if(tt.phase === "postplant"){
    var R = bomb && bomb.retake;
    if(GEO[tt.site] && GEO[tt.site].ctEntry){ R = {approaches:[GEO[tt.site].ctEntry]}; }
    if(R && R.approaches && R.approaches.length){
      var a = R.approaches[0];
      // за точкой сбора CT, со стороны их спавна — в спину ретейку
      var back = {x: a.x + (a.x-bomb.x)*0.7, y: a.y + (a.y-bomb.y)*0.7};
      var bp = walk(back);
      setPost(b, bp, a, true, "lurkBack");
    } else setPost(b, GEO.rotator, GEO[tt.site].ctEntry, true, "lurkRot");
  }
}
// ---- раздел 12: пробы и подпуши в сетапе ----
// Раньше сетап = "встали на точки и ждём тайминг выхода". Теперь в каждой
// группе (у A, у B, на миде) один игрок играет за инфу: раз в 6–9с выходит
// вперёд — сначала коротким выглядом, потом глубже, до самого входа, "за
// энтри-фрагом" (с флешкой от тиммейта, если есть); и возвращается. Что он
// увидит/кого снимет — читает IGL (соло / стак / минус → выход или перекол).
// куда перетянуть двоих, если подпуш показал "пусто"
var SHIFT_TO = MAP.tactics.shiftTo;
// ---- память смертей T за матч (про меняют паттерн: умер дважды в A Main —
// в третий раз туда иначе или не идут) ----
var TDEATHS = {m:-1, list:[]};
function tDeathAdd(v){ if(TDEATHS.m !== matchNum) TDEATHS = {m:matchNum, list:[]};
  TDEATHS.list.push({x:v.x, y:v.y, round:roundNum, id:v.id, tag: v.post ? v.post.tag : ""}); }
function tDeathsNear(x, y, r, id){ if(TDEATHS.m !== matchNum) return 0;
  return TDEATHS.list.filter(function(d){ return d.round < roundNum && Math.hypot(d.x-x, d.y-y) < r && (!id || d.id === id); }).length; }
function tDeathSpots(){ return TDEATHS.m === matchNum ? TDEATHS.list.filter(function(d){ return d.round < roundNum; }) : []; }
function tProbes(tt, ts){
  if(!BAL.tProbe) return;
  if(tick - roundStartTick < 10*TICK_HZ) return;
  if(tick > tt.execTick - 3*TICK_HZ) return;          // перед выходом — все на местах
  var groups = {};
  ts.forEach(function(b){
    if(!b.post || b.planting || (bomb.state === "carried" && bomb.carrier === b)) return;
    if(/^probePair/.test(b.post.tag)) return; // напарник пробы — не сам проба
    if(bomb.state === "dropped" && (tt.fetchId === b.id || (tt.fetchCover && tt.fetchCover.id === b.id))) return; // (v286, И26) за бомбой / прикрывает — не проба
    if(b._midFlank && b._midFlank.round === roundNum) return; // заходит через Red Room — не проба
    var m = /^stage(A|B)(:.*)?$/.exec(b.post.tag) || /^probe(.+)$/.exec(b.post.tag);
    var key = taskProp(b.post.tag, "midTask") ? "M" : m ? (b.post.tag.indexOf("stage") === 0 ? b.post.tag.slice(5) : m[1]) : null;
    // проба этого раунда держит свою группу, пока бот на пробе / в бою (тег поста не стадия); (v423, владелец 25.10, Mirage м1 р2: донк после
    // перевода IGL на A трижды уходил пробой B в B Apartments) — встал на стадию другой группы: старая проба забыта, группа — по стадии
    if(b._probe && b._probe.key && b._probe.round === roundNum){
      if(key && key !== b._probe.key && (/^stage/.test(b.post.tag) || taskProp(b.post.tag, "midTask"))) b._probe = null;
      else key = b._probe.key;
    }
    if(!key) return;
    (groups[key] = groups[key] || []).push(b);
  });
  var PRI = {entry:0, support:1, igl:2, awp:3};
  Object.keys(groups).forEach(function(key){
    var gr = groups[key].filter(function(b){ return b.tRole !== "awp" || key !== "M"; }); // AWP на миде держит линию
    if(!gr.length) return;
    // кто пробует — не всегда один и тот же (иначе CT читают "4-й всегда первый
    // на мид"): роль + случайная добавка на раунд; кто уже умирал на этой пробе
    // в этом матче — реже
    var ordK = function(o){ return (PRI[o.tRole]||9) + (BAL.tAdapt ? 1.3*hashRand(roundNum*97 + matchNum*13 + o.id.charCodeAt(1)*7) : 0) + (BAL.tAdapt ? 1.5*tDeathsNear(o.x, o.y, 700, o.id) : 0); };
    gr.sort(function(a,b2){ return ordK(a) - ordK(b2); });
    var pb = gr[0];
    var from, to, look, SI = pb._stageInfo;
    if(key === "M"){ from = GEO.tMid; to = GEO.ctMid; look = GEO.ctMid; }
    else if(SI && key.indexOf(":") > 0){ from = SI.from; to = SI.to; look = SI.look; }  // своя зона сбора (донат, дарк…)
    else { var kk = key.charAt(0); from = GEO[kk].tStage; to = GEO[kk].tEntry; look = GEO[kk].anchor; }
    var P = pb._probe;
    if(!P || P.key !== key || P.round !== roundNum){
      P = pb._probe = {key:key, round:roundNum, ph:0, n:0, until: tick + (4 + 5*hashRand(roundNum*31 + pb.id.charCodeAt(1)))*TICK_HZ, home:{x:pb.post.x, y:pb.post.y}};
    }
    if(P.ph === 0){ // ждёт в укрытии (пост группы уже стоит)
      // на этом выходе только что убили своего — не пикать туда же ещё раз
      if(tick >= P.until && teamIntel.T.sig.some(function(sg){ return sg.type === "died" && tick - sg.tick < 10*TICK_HZ && Math.hypot(sg.x-to.x, sg.y-to.y) < 400; })){ P.until = tick + 6*TICK_HZ; return; }
      // адаптация: здесь в этом матче уже умирали ≥2 раз — на сухую не пикаем
      if(tick >= P.until && BAL.tAdapt && tDeathsNear(to.x, to.y, 450) >= 2){
        var hasU = ts.some(function(o){ return Math.hypot(o.x-pb.x, o.y-pb.y) < 500 && o.nades && (o.nades.flash > 0 || o.nades.smoke > 0); });
        if(!hasU){ P.until = tick + 30*TICK_HZ; if(!tt["_ad"+key]){ tt["_ad"+key] = true; logEvent("T: на «"+(zoneUserName(zoneIdAt(to.x, to.y)) || key)+"» уже умирали "+tDeathsNear(to.x, to.y, 450)+" раза — без гранат туда не пикаем"); } return; }
        P.needUtil = true;
      }
      if(tick >= P.until){ P.ph = 1; P.n++; P.since = tick;
        // напарник: второй встаёт в 1–2с позади и держит тот же угол — если
        // пробу снимут, он первый на размен
        if(BAL.pairs){
          // (v423, Mirage м1 р2: AWP и саппорт со стадии A уходили напарником пробы B) напарник — из той же группы (стадии), не любой ближайший
          var bud = gr.filter(function(o){ return o !== pb && o.alive && o.tRole !== "lurker" && !(bomb.state === "carried" && bomb.carrier === o) &&
            !(o._probeLock && o._probeLock >= tick-1) && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })
            .sort(function(a, c){ return Math.hypot(a.x-pb.x, a.y-pb.y) - Math.hypot(c.x-pb.x, c.y-pb.y); })[0];
          P.buddy = bud ? bud.id : null;
        }
        // гранаты под пробу: флешка от напарника/тиммейта (на мид — смок на линию
        // CT, если флешки нет); раньше — только на глубокую пробу, чаще на сухую
        if(BAL.probeUtil && roundGoal("T") !== "keepGuns"){
          var uFp = {x: to.x + (look.x-to.x)*0.3, y: to.y + (look.y-to.y)*0.3};
          var uFl = ts.filter(function(o){ return o !== pb && !o.nadeTask && o.nades && o.nades.flash > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })[0];
          var uSm = ts.filter(function(o){ return !o.nadeTask && o.nades && o.nades.smoke > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 600; })[0];
          if(uFl && (P.needUtil || P.n === 1 || hashRand(tick + 3) < 0.6)){ assignNade(uFl, "flash", uFp, "под пробу", {now:true}); P.util = "flash"; }
          else if(uSm && (key === "M" || P.needUtil)){ var smP = {x: to.x + (look.x-to.x)*0.5, y: to.y + (look.y-to.y)*0.5}; if(assignNade(uSm, "smoke", smP, "смок под пробу", {now:true})) P.util = "smoke"; }
        }
        // со второго раза — глубже, за фрагом, но только парой (есть кому
        // разменять) и если по инфе там не стак
        var mate = ts.some(function(o){ return o !== pb && Math.hypot(o.x-pb.x, o.y-pb.y) < 380; });
        var eP = intelEstimate("T", to.x, to.y, 450, 6*TICK_HZ);
        P.deep = P.n >= 2 && mate && eP.n <= 1;
        var f = P.deep ? 0.95 : 0.6;
        P.pt = walk({x: from.x + (to.x-from.x)*f, y: from.y + (to.y-from.y)*f});
        // не "60% пути", а до первого места, откуда ВИДНО, что там дальше
        // (опорника/вход) — иначе подпуш кончался за углом и колл был "пусто"
        if(!P.deep){ var vp = probeViewPoint(from, to, look); if(vp) P.pt = vp; }
        // (Г3, 04.11, разбор отметок п.16: проба снималась через 9 с от начала — шагом до точки у окна не доходила, 211 из 345 проб на
        // 8 матчах Mirage) срок пробы — 9 с (проектное число, как было) после расчётного прихода: дорога шагом по пути + 9 с
        P.dl = tick + Math.ceil((pathLenTo(pb, P.pt.x, P.pt.y)/(SPEED*WALK_SPEED_FRAC) + 9)*TICK_HZ);
        if(P.deep){
          voiceLog("T", "probe"+key+pb.id, pb.id, "подпушу "+(key === "M" ? "мид" : (zoneUserName(zoneIdAt(to.x, to.y)) || key.charAt(0)))+", посмотрю, сколько их там");
          // флешка под подпуш от ближайшего тиммейта (не вся раскидка — одна)
          var fl = ts.filter(function(o){ return o !== pb && !o.nadeTask && o.nades && o.nades.flash > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })[0];
          if(fl && BAL.tUtil && roundGoal("T") !== "keepGuns"){ var fp = {x: to.x + (look.x-to.x)*0.3, y: to.y + (look.y-to.y)*0.3}; assignNade(fl, "flash", fp, "под подпуш", {now:true}); }
        }
      }
      return;
    }
    // выход вперёд / на вход
    setPost(pb, P.pt, look, true, "probe"+key);
    // (v521, отметка владельца 10.11: у TN1R «перебивают путь shift и probeA» — личная перестановка и проба одного уровня сменяли друг друга
    // каждые 1,5 с) проба по решению IGL заменяет личную перестановку этого бота в этом раунде: одна задача, а не две
    if(pb.post && /^probe/.test(pb.post.tag)) pb._shift = null;
    pb._probeLock = tick;
    // напарник — ~150px позади пробы по той же линии, смотрит туда же
    if(BAL.pairs && P.buddy){
      var bu = ts.filter(function(o){ return o.id === P.buddy; })[0];
      // (аудит 11.10) напарник сам вышел пробой своей группы — он занят: раньше обе пробы ставили ему пост каждый тик
      // (probeB ↔ probePairA, сотни смен поста подряд — стоял на месте)
      if(bu && bu._probe && bu._probe !== P && bu._probe.round === roundNum && bu._probe.ph === 1){ P.buddy = null; bu = null; }
      if(bu && bomb.state === "dropped" && (tt.fetchId === bu.id || (tt.fetchCover && tt.fetchCover.id === bu.id))){ P.buddy = null; bu = null; } // (v286) занят бомбой
      if(bu && !bu._sawEnemy && !(bu._tradeLock && bu._tradeLock.until > tick)){
        var ln = Math.hypot(P.pt.x-from.x, P.pt.y-from.y) || 1, back = Math.min(150, ln*0.6);
        var bp = walk({x: P.pt.x + (from.x-P.pt.x)/ln*back, y: P.pt.y + (from.y-P.pt.y)/ln*back});
        setPost(bu, bp, look, true, "probePair"+key); bu._probeLock = tick;
      }
    }
    // выглянул — и назад: проба не стоит в открытую (джиггл, а не холд)
    var stay = P.deep ? 1.5*TICK_HZ : 0.8*TICK_HZ;
    if(pb._sawEnemy && !P.saw){ P.saw = tick; }
    if(P.saw && tick - P.saw > 0.6*TICK_HZ && !pb._sawEnemy) stay = 0; // увидел, дал инфу — уходит
    if(pb.atPost && !P.saw && !P.cleared && tick - (P.at || tick) > stay){
      P.cleared = true;
      var enN = intelEstimate("T", to.x, to.y, 450, 6*TICK_HZ).n;
      if(enN === 0){
        markClear("T", P.pt.x, P.pt.y, pb.id);
        // там пусто — двое из этой группы идут брать контроль в другом месте,
        // пока до выхода есть время (потом зайдут на сайт уже оттуда)
        var tt2 = teamTac.T, SH = SHIFT_TO[key.charAt(0)];
        if(BAL.shiftOnClear && SH && tt2 && tt2.phase === "setup" && tt2.execTick - tick > 10*TICK_HZ && !tt2["_sh"+key]){
          tt2["_sh"+key] = true;
          var movers = ts.filter(function(o){ return o !== pb && o.alive && o.post && o.post.tag.indexOf("stage"+key.charAt(0)) === 0 &&
            !(bomb.state === "carried" && bomb.carrier === o) && o.tRole !== "awp"; }).slice(0, 2);
          movers.forEach(function(o, oi){
            var zn = SH[oi % SH.length], pt = zonePoint(zn.pos, o), lk = zonePoint(zn.look, pt);
            if(!pt) return;
            o._shift = {round:roundNum, pt:pt, look:lk || GEO[key.charAt(0)].anchor, name:zn.pos};
            voiceLog("T", "sh"+o.id, o.id, "там пусто — иду на "+zn.pos);
          });
        }
      }
    }
    // (v519, пак 09.11 п.13; Р-30: «почти дошёл, а пришлось возвращаться на другой конец мида — пусть идёт дальше от того места, докуда дошёл, как
    // продолжение пробы») срок вышел, а бот за последнюю секунду приблизился к точке пробы — проба продолжается (срок — оставшийся путь + запас);
    // снимается по сроку только тот, кто не идёт (застрял / стоит)
    var dPr = Math.hypot(P.pt.x-pb.baseX, P.pt.y-pb.baseY);
    if(!P.prT || tick - P.prT >= TICK_HZ){ P.prog = P.prD != null && dPr < P.prD - 10; P.prD = dPr; P.prT = tick; }
    if(!pb.atPost && P.prog && tick > (P.dl || P.since + 9*TICK_HZ)) P.dl = tick + Math.ceil((pathLenTo(pb, P.pt.x, P.pt.y)/(SPEED*WALK_SPEED_FRAC) + 2)*TICK_HZ);
    if((pb.atPost && tick - (P.at || (P.at = tick)) > stay) || tick > (P.dl || P.since + 9*TICK_HZ)){
      P.prD = null; P.prT = 0; P.prog = false;
      P.ph = 0; P.cleared = false; P.at = 0; P.saw = 0; P.until = tick + (6 + 3*hashRand(tick + pb.id.charCodeAt(1)))*TICK_HZ;
      pb._probeLock = 0; clearPost(pb); // вернётся на пост группы со следующего тика
    }
    if(!pb.atPost) P.at = 0;
  });
}
function probeViewPoint(from, to, look){
  // точки пути from→to; выглядываем не раньше ~55% пути и только там, откуда
  // видно и вход, и дальнюю точку (опорника/сайт) — "дошёл до угла, где видно"
  var wp = buildWaypointPath(from.x, from.y, 0, to.x, to.y, 0), pts = [{x:from.x, y:from.y}];
  wp.forEach(function(w){ pts.push({x:w[0], y:w[1]}); });
  var tot = 0; for(var i=1;i<pts.length;i++) tot += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
  if(tot < 60) return null;
  var cum = 0;
  for(var j=1;j<pts.length;j++){
    var A = pts[j-1], B = pts[j], L = Math.hypot(B.x-A.x, B.y-A.y), n = Math.max(1, Math.ceil(L/35));
    for(var k=1;k<=n;k++){
      var p = {x: A.x + (B.x-A.x)*k/n, y: A.y + (B.y-A.y)*k/n}, c = cum + L*k/n;
      if(c < 0.55*tot) continue;
      if(hasVision(p.x, p.y, look.x, look.y) && hasVision(p.x, p.y, to.x, to.y))
        return walk({x: p.x + (B.x-A.x)/Math.max(1,L)*30, y: p.y + (B.y-A.y)/Math.max(1,L)*30});
    }
    cum += L;
  }
  return walk({x: from.x + (to.x-from.x)*0.9, y: from.y + (to.y-from.y)*0.9});
}
// ---- отмеченные "проверено — пусто" зоны (для слоя «коллы» и решений) ----
var CLEARZ = {CT:{}, T:{}};
// (v281, владелец 14.10: Donut, тики 6190–6250 — трое CT прошли мимо T в известной позиции t_donut_3) известные позиции
// врага из демок (KNOW_POSITIONS): какие команда уже видела пустыми. Позиция «чистая», только если свой реально видел
// именно эту точку (обзор + линия, не сквозь дым); снова опасна, когда враг успел бы добежать до неё из любой зоны,
// где он по таймингу уже может быть (REACH) — бегом, SPEED
var POSCLR = {CT:{}, T:{}};
var _POSL = {};
function enemyPositions(team){
  if(_POSL[team]) return _POSL[team];
  var pts = (typeof KNOW_POSITIONS !== "undefined" && KNOW_POSITIONS.points) || [], side = team === "CT" ? "T" : "CT", L = [], sumZ = {};
  pts.forEach(function(p){ if(p.side !== side || typeof p.x !== "number") return; var z = bzOf(p.x, p.y); if(z < 0) return;
    L.push({id: p.id, x: p.x, y: p.y, z: z, share: p.share || 0.01, r: Math.max(20, p.spread || 30)}); sumZ[z] = (sumZ[z] || 0) + (p.share || 0.01); });
  L.forEach(function(q){ q.frac = q.share / sumZ[q.z]; });
  return (_POSL[team] = L);
}
function posClearValid(team, id){ var c = POSCLR[team][id]; return !!c && tick < c.until; }
function posClearTick(team){
  var L = enemyPositions(team), R = REACH[team];
  bots.forEach(function(b){ if(!b.alive || b.team !== team || tick < (b.blindUntil||0)) return;
    L.forEach(function(q){ var d = Math.hypot(q.x-b.x, q.y-b.y); if(d > 1100 || posClearValid(team, q.id)) return;
      if(!inFov(b, q.x, q.y) || !hasLOS(b.x, b.y, q.x, q.y, b.z) || smokeBlocks(b.x, b.y, q.x, q.y)) return;
      var until = Infinity;
      if(R) for(var k = 0; k < R.length; k++){ if(R[k] > tick || !BZ.cent[k]) continue; var tt = tick + Math.hypot(BZ.cent[k].x-q.x, BZ.cent[k].y-q.y)/SPEED*TICK_HZ; if(tt < until) until = tt; }
      POSCLR[team][q.id] = {tick: tick, until: until, by: b.id}; }); });
}
// (v321, М24, отметка владельца) T, проходя мимо сайта, видит его зоны (pos.tClear, входы) — если там никого, говорит
// «чекнул X — пусто» (как CT на выходе за инфой): команда знает, что там чисто. Одна зона — один колл за раунд.
// (v381, М24, владелец 16.10: «sh1ro чекнул Market — пусто», хотя там не был или видел только часть зоны; «B прочекали — пусто» ещё
// из B Apps) «пусто» — только когда проверены ВСЕ места зоны, где обычно стоят (позиции из демок, KNOW_POSITIONS): каждое было
// в поле зрения и на линии видимости у кого-то из своих (posClearTick) за последние CLR_POS_SEC с. Мест у зоны нет — нужно увидеть
// в поле зрения сам ≥ 2/3 её точек (ZONE_SAMPLES). Говорит тот, кто проверил последнее место
var CLR_POS_SEC = 6;   // проектное число: насколько свежей должна быть проверка каждого места зоны
function tClearCalls(){
  var names = [];
  ["A","B"].forEach(function(k){ if(POS[k]) (POS[k].tClear || []).concat(POS[k].entries || []).forEach(function(n){ if(names.indexOf(n) < 0) names.push(n); }); });
  if(!names.length) return;
  var EP = enemyPositions("T"), ts = bots.filter(function(b){ return b.team === "T" && b.alive; });
  names.forEach(function(n){
    var p = zonePoint(n); if(!p) return;
    var zid = zoneIdAt(p.x, p.y); if(!zid) return;
    var C = CLEARZ.T[zid]; if(C && C.round === roundNum) return;
    var j = BZ.idx[zid], ps = EP.filter(function(q){ return q.z === j; }), who = null;
    if(ps.length){
      var last = -1;
      for(var i = 0; i < ps.length; i++){ var c = POSCLR.T[ps[i].id];
        if(!c || !posClearValid("T", ps[i].id) || tick - c.tick > CLR_POS_SEC*TICK_HZ) return;
        if(c.tick > last){ last = c.tick; who = c.by; } }
    } else {
      var smp = ZONE_SAMPLES[zid] || []; if(smp.length < 3) return;
      who = (ts.filter(function(b){ return zoneSeenAll(b.id, zid); })[0] || {}).id;   // (Г1) все точки зоны, а не 2/3
    }
    var wb = who && ts.filter(function(b){ return b.id === who; })[0]; if(!wb) return;
    // сам сейчас видит врага — ему не до коллов; враг в зоне виден своим — не пусто
    if(bots.some(function(e){ return e.team === "CT" && e.alive && Math.hypot(e.x-wb.x, e.y-wb.y) < 900 && hasVision(wb.x, wb.y, e.x, e.y); })) return;
    if(bots.some(function(e){ return e.team === "CT" && e.alive && zoneIdAt(e.x, e.y) === zid && ts.some(function(b){ return hasVision(b.x, b.y, e.x, e.y); }); })) return;
    if(markClear("T", p.x, p.y, wb.id, ps.length > 0)) CLEARZ.T[zid].round = roundNum;
  });
}
// (Г1, 04.11, разбор отметок «угроза»: «чекнул A Site — пусто», а CT стоял в невидимой трети зоны — 23 из 767 коллов на 8 матчах Mirage)
// «пусто» — только про то, что реально видели: зона пуста, только если тот, кто говорит, сейчас видит все её точки (ZONE_SAMPLES: в поле
// зрения, на линии, ≤ 1100). Раньше звали из пяти мест по разным правилам — проба и ранний пик CT по «команда ничего не знает рядом»,
// зачистка углов T по «0,5 с никого не видно», проверка зон по ≥ 2/3 точек. Исключение — проверка по местам из демок (posChecked: все места
// зоны были в поле зрения своих за CLR_POS_SEC — tClearCalls)
function zoneSeenAll(who, zid){
  var wb = who && bots.filter(function(o){ return o.id === who; })[0], smp = ZONE_SAMPLES[zid] || [];
  if(!wb || !wb.alive || !smp.length || tick < (wb.blindUntil||0)) return false;
  return smp.every(function(q){ return Math.hypot(q.x-wb.x, q.y-wb.y) < 1100 && inFov(wb, q.x, q.y) && hasVision(wb.x, wb.y, q.x, q.y); });
}
function markClear(team, x, y, who, posChecked){
  var zid = zoneIdAt(x, y); if(!zid) return null;
  if(!posChecked && !zoneSeenAll(who, zid)) return null;
  CLEARZ[team][zid] = {tick:tick, x:x, y:y, round:roundNum};
  knowClearZone(team, x, y);
  voiceLog(team, "clz"+zid, who, (zoneUserName(zid) || calloutName(x, y).replace(/^на /, ""))+" чисто");
  return zid;
}
// (v490) оценка сайта k командой team — по тому, где команда недавно видела живых врагов: «не знаем, где» = живые враги, которых своя команда
// не видела / не слышала за SITE_SEEN_SEC с дальше SITE_AWAY от сайта. Ступени: 0 — «вероятно пуст» (все замечены в другом месте), 1 —
// «возможно ослаблен», 2+ — «защищён». Калибровка по факту (прогон 141, v489, 16 матчей на карту, выборки раз в секунду после 40-й с):
//   0 неизвестных — сайт пуст в 94,8 % (Mirage) / 91,1 % (Ancient); 1 — 30 / 36 %; 2 — 12 / 13 %; 3+ — ≤ 5 %.
// Было (v482): все 6 главных точек CT прочеканы за 12 с — почти не срабатывало; до v482: любые 2 зоны — ложно в 90–93 %.
// Свежая инфа о враге у самого сайта (≤ SITE_SEEN_SEC) — «защищён» всегда. Ответ {unknown, near, level: "empty" | "weak" | "held"}
var SITE_SEEN_SEC = 8, SITE_AWAY = 900;   // с, px — как в калибровке (сторож rec2.js); 8 с — окно свежей инфы intelEstimate, 900 — проектное
function siteAssess(team, k){
  var S = SITES[k], BL = beliefLast[team] || {}, foe = team === "T" ? "CT" : "T", unknown = 0, near = 0;
  bots.forEach(function(o){ if(o.team !== foe || !o.alive) return; var q = BL[o.id];
    var fresh = q && tick - q.tick <= SITE_SEEN_SEC*TICK_HZ;
    if(fresh && Math.hypot(q.x-S.x, q.y-S.y) <= SITE_AWAY) near++; else if(!fresh) unknown++; });
  var level = near ? "held" : unknown === 0 ? "empty" : unknown === 1 ? "weak" : "held";
  return {unknown: unknown, near: near, level: level, confirmed: level === "empty" && siteConfirmed(team, k)};
}
// (00_PLAN, пакет тактики, ответ владельца 2 от 04.11: «три уровня — не проверен / вероятно пуст / подтверждённо пуст; одна чистая точка — мало;
// проверены основные позиции, подходы неизвестны — занимать осторожно; подходы проверены или закрыты дымом / своими — можно ставить; пусто = нет
// неустранённых угроз») подтверждённо пуст — для T: все основные позиции сайта (набор карты pos.tClear) проверены командой в этом раунде за
// CLR_POS_SEC («чекнул — пусто», markClear), и каждый подход CT (pos.ctRetake) проверен так же, закрыт дымом или там стоит свой.
// Точки — данные набора карты, не код
function siteConfirmed(team, k){
  var P = POS[k], CZ = CLEARZ[team] || {}, S = SITES[k]; if(!P || !P.tClear || !P.tClear.length) return false;
  var fresh = function(n){ var p = zonePoint(n, S); if(!p) return true; var z = zoneIdAt(p.x, p.y), c = z && CZ[z];
    return !!(c && c.round === roundNum && tick - c.tick <= CLR_POS_SEC*TICK_HZ); };
  if(!P.tClear.every(fresh)) return false;
  return (P.ctRetake || []).every(function(n){ var p = zonePoint(n, S); if(!p) return true; var z = zoneIdAt(p.x, p.y);
    return fresh(n) || smokeCovered(p.x, p.y) || bots.some(function(o){ return o.alive && o.team === team && zoneIdAt(o.x, o.y) === z; }); });
}
// IGL не идеален: примерно в четверти случаев повод для колла (соло, пустой
// сайт, стак) он пропускает — решение принимается один раз на повод за раунд
function iglReads(tt, kind){
  var k = "_ir"+kind; if(tt[k] === undefined) tt[k] = hashRand(roundNum*131 + matchNum*17 + kind.charCodeAt(0)*7) >= (BAL.iglErr||0);
  if(!tt[k] && !tt[k+"log"]){ tt[k+"log"] = true; logEvent("IGL: не среагировал на инфу ("+({po:"пустой сайт", st:"стак", so:"соло"})[kind]+") — играем по плану"); }
  return tt[k];
}
function soloMayWalk(b){
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  if(secLeft < 22) return false;
  var site = teamTac.T && SITES[teamTac.T.site]; if(!site) return false;
  // время на шаг до точки: скорость шифта ~ SPEED*WALK_SPEED_FRAC
  var d = Math.hypot(site.x-b.x, site.y-b.y) * 1.3;
  if(d / (SPEED*WALK_SPEED_FRAC) > secLeft - 12) return false;
  var cts = bots.filter(function(o){ return o.team === "CT" && o.alive; });
  var allKnownFar = cts.every(function(o){ var e = beliefLast.T[o.id]; return e && tick - e.tick < 5*TICK_HZ && Math.hypot(e.x-site.x, e.y-site.y) > 1100; });
  return !allKnownFar;
}
