// ---------- тактики T (IGL выбирает под тип раунда) ----------
// Тактики T. groups — кто каким маршрутом (названия зон) идёт и где ждёт выхода:
//   via   — зоны по порядку (маршрут), stage — зона сбора (нет — стандартный
//   подход к сайту), look — куда смотреть/выходить оттуда; "TMID" — мид со
//   стороны T. rushVia — маршрут раша. Названия — из слоя «зоны».
var T_TACTICS = [
  {id:"execA",  name:"Выход A через мейн",   site:"A", pools:["full","half","force"], setupEnd:38, style:"exec",
    groups:[{roles:["entry","awp","igl"], via:["T Ramp","Split","A Stairs","A Hall"]}, {roles:["support"], stage:"TMID"}]},
  {id:"execB",  name:"Выход B через рампу",  site:"B", pools:["full","half","force"], setupEnd:38, style:"exec",
    groups:[{roles:["entry","awp","igl"], via:["T Ramp","Tunnel","Water","Ruins"]}, {roles:["support"], stage:"TMID"}]},
  {id:"defB",   name:"Дефолт → B",           site:"B", pools:["full","half"],         setupEnd:66, style:"default"},
  {id:"defA",   name:"Дефолт → A",           site:"A", pools:["full","half","pistol"],setupEnd:64, style:"default"},
  {id:"splitA", name:"Сплит A (мейн + донат)", site:"A", pools:["full","half"],       setupEnd:54, style:"split",
    groups:[{roles:["entry","igl"], via:["Split","A Stairs","A Hall"]},
            {roles:["awp","support"], via:["Split","Lower Mid","Mid","Chamber Lane"], stage:"Donut", look:"Short"}]},
  {id:"rushB",  name:"Раш B через рампу",    site:"B", pools:["eco","pistol","force"],setupEnd:0,  style:"rush", rushVia:["T Ramp","Tunnel","Water","Ruins","T Lower"]},
  {id:"rushA",  name:"Раш A через мейн",     site:"A", pools:["eco","pistol","force"],setupEnd:0,  style:"rush", rushVia:["T Ramp","Split","A Stairs","A Hall","A Main"]},
  {id:"splitB", name:"Сплит B (рампа + кейв)", site:"B", pools:["full","half"],       setupEnd:54, style:"split",
    groups:[{roles:["entry","igl"], via:["T Ramp","Tunnel","Water","Ruins"]},
            {roles:["awp","support"], via:["T Ramp","Tunnel","Water","Ruins","T Lower","T Upper","Lamp Room"], stage:"Dark", look:"Cave"}]},
  {id:"fakeAB", name:"Фейк A → выход B",     site:"B", fake:"A", pools:["full","half"],         setupEnd:62, style:"fake"},
  {id:"fakeBA", name:"Фейк B → выход A",     site:"A", fake:"B", pools:["full","half","force"], setupEnd:62, style:"fake"},
  // по названиям зон: кейв, донат, через CT
  {id:"caveB",  name:"Выход B через кейв",   site:"B", pools:["full","half","force"], setupEnd:44, style:"exec",
    groups:[{roles:["entry","awp","igl"], via:["T Ramp","Tunnel","Water","Ruins","T Lower","T Upper","Lamp Room"], stage:"Dark", look:"Cave"},
            {roles:["support"], via:["T Ramp","Tunnel","Water"], stage:"T Lower", look:"Ramp"}]},
  {id:"donutA", name:"Выход A через донат",  site:"A", pools:["full","half","force"], setupEnd:44, style:"exec",
    groups:[{roles:["entry","awp","igl"], via:["Split","Lower Mid","Mid","Chamber Lane"], stage:"Donut", look:"Short"},
            {roles:["support"], via:["Split","A Stairs"]}]},
  {id:"ctA",    name:"Мид → CT, A с двух сторон", site:"A", pools:["full","half"],   setupEnd:60, style:"split",
    groups:[{roles:["entry","igl"], via:["T Ramp","Split","A Stairs","A Hall"]},
            {roles:["awp","support"], via:["Split","Lower Mid","Mid","Top Mid","Sniper Nest","Red Room","Alley","CT Spawn"], stage:"CT Lane", look:"Triple Box"}]},
  {id:"shortA", name:"A: мейн + Short через донат", site:"A", pools:["full","half","force"], setupEnd:50, style:"split",
    groups:[{roles:["entry","awp"], via:["T Ramp","Split","A Stairs","A Hall","A Main"], stage:"Long", look:"Back Site"},
            {roles:["support","igl"], via:["Split","Lower Mid","Mid","Chamber Lane"], stage:"Donut", look:"Short"}]},
  {id:"ctB",    name:"Мид → CT, B с двух сторон", site:"B", pools:["full","half"],   setupEnd:60, style:"split",
    groups:[{roles:["entry","igl"], via:["T Ramp","Tunnel","Water","Ruins"]},
            {roles:["awp","support"], via:["Split","Lower Mid","Mid","Top Mid","Sniper Nest","Red Room","Alley"], stage:"Back Halls", look:"Second Lane"}]}
];
var teamTac = { T: null, CT: {call:null} };
var lastTacticId = null;
function weightedChoice(items, weights, seed){
  var tot = weights.reduce(function(a, w){ return a + Math.max(0, w); }, 0), r = hashRand(seed)*tot, acc = 0;
  for(var i=0;i<items.length;i++){ acc += Math.max(0, weights[i]); if(r < acc) return i; }
  return items.length - 1;
}
function chooseTactic(){
  var type = teamEco.T.roundType;
  var pool = T_TACTICS.filter(function(t){ return t.pools.indexOf(type) >= 0; });
  var weights = pool.map(function(t){
    var w = 1;
    if(t.style === "split") w *= 1.6;                    // заходы с двух сторон — чаще
    if(t.id === "caveB") w *= 1.5;                       // кейв — не забывать
    return w;
  });
  // (v155) у про плант раньше 35с — 13% плантов; у ботов было 26%, раши шли
  // в 19% раундов. Доля рашей теперь задана по типу закупа, остальное — выходы
  var RP = {pistol:0.20, eco:0.25, force:0.08, half:0, full:0}[type] || 0;
    var rW = 0, nW = 0; pool.forEach(function(t, i){ if(t.style === "rush") rW += weights[i]; else nW += weights[i]; });
    if(rW > 0 && nW > 0){ var kR = RP > 0 ? (RP/(1-RP))*nW/rW : 0; pool.forEach(function(t, i){ if(t.style === "rush") weights[i] *= kR; }); }
  var tac = pool[weightedChoice(pool, weights, roundNum*7919 + matchNum*104729 + 17)];
  lastTacticId = tac.id;
  // тайминг выхода гуляет от раунда к раунду (иначе его читают): ~25% —
  // быстрый (на 30% раньше), ~50% — обычный ±4с, ~25% — поздний (+10…18с)
  var setupSec = tac.setupEnd, tmode = "";
  if(BAL.timingVar && setupSec > 0){
    var rT = hashRand(roundNum*6271 + matchNum*353 + 29);
    if(rT < 0.25){ tmode = ", быстрый"; setupSec = Math.max(16, Math.round(setupSec*0.7)); }
    else if(rT < 0.75){ setupSec = Math.max(12, Math.round(setupSec + (hashRand(roundNum*97 + matchNum*13)-0.5)*8)); }
    else { tmode = ", поздний"; setupSec = Math.min(ROUND_TIME_SEC - 38, setupSec + 10 + Math.round(hashRand(roundNum*131 + matchNum*7)*8)); }
  }
  var defUntil = null;
  if(tac.setupEnd > 0){
    // длинный сетап: сначала дефолт (контроль карты), свою расстановку тактика
    // занимает за столько же секунд до выхода, сколько ей нужно было с начала раунда
    var need = Math.max(14, tac.setupEnd - 6);
    if(setupSec - need >= 12) defUntil = roundStartTick + (setupSec - need)*64;
  }
  teamTac.T = {tac:tac, site:tac.site, phase: tac.setupEnd > 0 ? "setup" : "execute", execTick: roundStartTick + setupSec*64, defUntil: defUntil, minExec: (tac.setupEnd > 0) ? Math.min(setupSec, 30) : 0, needT: (tac.setupEnd > 0) ? Math.max(14, tac.setupEnd - 6) : 0,
               execStart: tac.setupEnd > 0 ? null : tick, // раш: выход сразу — отсчёт задержек ролей с начала раунда
               setupSec:setupSec};
  var igl = bots.filter(function(b){ return b.team==="T" && b.tRole==="igl"; })[0];
  logEvent("IGL "+(igl?igl.id:"T")+": тактика «"+tac.name+"» ("+ROUND_TYPE_LABEL[type]+(tac.setupEnd?", выход на "+setupSec+"с"+tmode:", сразу")+")");
  chooseCtSetup();
}
// ---- позиции по названиям зон: кто где держит, занимает, ставит, ретейкает ----
// Порядок = приоритет (первые выбираются чаще, последние — реже, как офф-углы).
var POS = {
  A: { ctHold:["A Site","Triple Box","Back Site","Temple","Plat","Single","Box","Boost","Def"],
       tClear:["Back Site","Triple Box","Box","Def","Boost","Temple"],
       tPost:["Long","Short","Boost","Back Site","Box"],
       entries:["Long","Short"] },
  B: { ctHold:["B Site","Site B","90","First Lane","Second Lane","Dark Box","Bonger"],
       tClear:["90","Second Lane","Site B","Dark Box","First Lane"],
       tPost:["Ramp","T Lower","Cave","Dark","Rat"],
       entries:["Ramp","Cave"] },
  M: { ctHold:["Top Mid","Sniper Nest","Jungle","Red Room"],
       tHold:["TMID","Xbox","Jungle","Lower Mid"] }
};
// точка на зоне с таким названием: укрытое место внутри/у зоны, откуда видно see
function namedSpot(name, near, o){
  var zp = zonePoint(name, near); if(!zp) return null;
  o = o || {};
  var sp = pickSpots("nm:"+name+":"+(o.key||""), zp, 1, {rMax:o.rMax||110, minGap:40, see:o.see||[], hideFrom:o.hideFrom||[], must:o.must, cross:o.cross})[0];
  return sp || zp;
}
function entryPts(k){ return POS[k].entries.map(function(n){ return zonePoint(n, SITES[k]); }).filter(Boolean); }
// ---- пул расстановок CT: план IGL — сколько людей в каком районе (CT_NEED,
// 12_ct_brain.js); куда именно встать — выбор действия (12_team.js) ----
var CT_SETUPS = [
  {id:"std212", name:"Стандарт 2-1-2"}, {id:"std111", name:"1-1-1 с ротатором"},
  {id:"stackA", name:"Стак A"}, {id:"stackB", name:"Стак B"}, {id:"midAggro", name:"Двое на миде"},
  {id:"retakeA", name:"Ретейк-сетап A (A отдают, играют ретейк)"}, {id:"retakeB", name:"Ретейк-сетап B"},
  {id:"pickA", name:"Стандарт 2-1-2 (A)"}, {id:"pickB", name:"Стандарт 2-1-2 (B)"}, {id:"cavePush", name:"Стандарт 2-1-2 (кейв)"}, {id:"redRoom", name:"Стандарт 2-1-2 (Red Room)"}
];
function chooseCtSetup(){
  var why = {};
  var weights = CT_SETUPS.map(function(S){
    var w = {std212:4, std111:1.5, midAggro:0.5, pickA:0.4, pickB:0.4, redRoom:0.6, cavePush:0.5, stackA:0.2, stackB:0.2, retakeA:0.2, retakeB:0.2}[S.id] || 1;
    return w;
  });
  var S = BAL.ctSetups ? CT_SETUPS[weightedChoice(CT_SETUPS, weights, roundNum*4217 + matchNum*881 + 5)] : (BAL.ctSetup === "1-1-1" ? CT_SETUPS[1] : CT_SETUPS[0]);
  teamTac.CT = {call:null, saving:false, setup:S, setupWhy: why[S.id]||null};
  // против эко: без ранних пиков и доборов — не дарить оружие, держать вместе
  if(BAL.ctAntiEco){ var Ee = teamEco.CT.enemyGuess || enemyEcoGuess("CT"); if(Ee.eco && (teamEco.CT.roundType === "full" || teamEco.CT.roundType === "force")){ teamTac.CT.antiEco = true; logEvent("CT: у T, похоже, эко — играем аккуратно: без ранних пиков, не отдаём оружие"); } }
  logEvent("CT: расстановка «"+S.name+"»"+(why[S.id] ? " — "+why[S.id] : ""));
}
var events = []; var killfeed = [];
var simTime = 0; // нужен logEvent-у при старте
var roundStartTick = 0;

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
var LURK_PLANS = {
  B: [{via:["T Ramp","Tunnel","Water"]}, {via:["Split","Lower Mid","Mid","Triple","T Upper","Lamp Room"], stage:"Dark", entry:"Cave"}],
  A: [{via:["Split","A Stairs"]}, {via:["Split","Lower Mid","Mid","Chamber Lane"], stage:"Donut", entry:"Short"}]
};
function lurkerBrain(b, tt, other){
  var go = GEO[other];
  if(!b._lurkPlan || b._lurkPlan.round !== roundNum || b._lurkPlan.site !== other){
    var opts = LURK_PLANS[other], pi = hashRand(roundNum*733 + matchNum*19) < 0.5 ? 0 : 1, P = opts[pi];
    var st = P.stage ? zonePoint(P.stage, go.tStage) : null, en = P.entry ? zonePoint(P.entry, st || go.tStage) : null;
    b._lurkPlan = {round:roundNum, site:other, via:P.via, stage: st || go.tStage, entry: en || go.tEntry, name: P.stage || "стандарт"};
    startRoute(b, P.via, "lurk"+other+pi);
  }
  var LP = b._lurkPlan;
  if(tt.phase === "setup"){
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
  if(tt.phase === "execute"){
    var route = [LP.entry, go.anchor, GEO.rotator];
    var i = Math.min(b._lurkIdx||0, route.length-1);
    var look = i < route.length-1 ? route[i+1] : GEO[tt.site].ctEntry;
    setPost(b, route[i], look, true, "lurk"+i);
    if(b.atPost){
      if(!b._lurkArr) b._lurkArr = tick;
      if(tick - b._lurkArr > 150 && i < route.length-1){ b._lurkIdx = i+1; b._lurkArr = 0; }
    }
    return;
  }
  if(tt.phase === "postplant"){
    // откуда пойдёт ретейк — T не знают план CT, только вход CT на этот сайт
    var R = GEO[tt.site] && GEO[tt.site].ctEntry ? {approaches:[GEO[tt.site].ctEntry]} : null;
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
var SHIFT_TO = { A: [{pos:"Donut", look:"Short"}, {pos:"Chamber Lane", look:"Top Mid"}],
                 B: [{pos:"Lamp Room", look:"Cave"}, {pos:"T Upper", look:"Lamp Room"}] };
function tProbes(tt, ts){
  if(tick - roundStartTick < 10*TICK_HZ) return;
  if(tick > tt.execTick - 3*TICK_HZ) return;          // перед выходом — все на местах
  var groups = {};
  ts.forEach(function(b){
    if(!b.post || b.planting || (bomb.state === "carried" && bomb.carrier === b)) return;
    if(/^probePair/.test(b.post.tag)) return; // напарник пробы — не сам проба
    if(b._midFlank && b._midFlank.round === roundNum) return; // заходит через Red Room — не проба
    var m = /^stage(A|B)(:.*)?$/.exec(b.post.tag) || /^probe(.+)$/.exec(b.post.tag);
    var key = b.post.tag === "tmid" ? "M" : m ? (b.post.tag.indexOf("stage") === 0 ? b.post.tag.slice(5) : m[1]) : null;
    if(b._probe && b._probe.key) key = b._probe.key;
    if(!key) return;
    (groups[key] = groups[key] || []).push(b);
  });
  var PRI = {entry:0, support:1, igl:2, awp:3};
  Object.keys(groups).forEach(function(key){
    var gr = groups[key].filter(function(b){ return b.tRole !== "awp" || key !== "M"; }); // AWP на миде держит линию
    if(!gr.length) return;
    // кто пробует — по роли (энтри первым)
    var ordK = function(o){ return PRI[o.tRole]||9; };
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
      if(tick >= P.until && picEvents("T").some(function(sg){ return sg.type === "died" && tick - sg.tick < 10*TICK_HZ && Math.hypot(sg.x-to.x, sg.y-to.y) < 400; })){ P.until = tick + 6*TICK_HZ; return; }
      if(tick >= P.until){ P.ph = 1; P.n++; P.since = tick;
        // напарник: второй встаёт в 1–2с позади и держит тот же угол — если
        // пробу снимут, он первый на размен
        if(BAL.pairs){
          var bud = ts.filter(function(o){ return o !== pb && o.alive && o.tRole !== "lurker" && !(bomb.state === "carried" && bomb.carrier === o) &&
            !taskOn(o, "probe") && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })
            .sort(function(a, c){ return Math.hypot(a.x-pb.x, a.y-pb.y) - Math.hypot(c.x-pb.x, c.y-pb.y); })[0];
          P.buddy = bud ? bud.id : null;
        }
        // гранаты под пробу: флешка от напарника/тиммейта (на мид — смок на линию
        // CT, если флешки нет); раньше — только на глубокую пробу, чаще на сухую
        if(BAL.probeUtil && !antiEco("T")){
          var uFp = {x: to.x + (look.x-to.x)*0.3, y: to.y + (look.y-to.y)*0.3};
          var uFl = ts.filter(function(o){ return o !== pb && !o.nadeTask && o.nades && o.nades.flash > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })[0];
          var uSm = ts.filter(function(o){ return !o.nadeTask && o.nades && o.nades.smoke > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 600; })[0];
          if(uFl && (P.n === 1 || hashRand(tick + 3) < 0.6)){ assignNade(uFl, "flash", uFp, "под пробу", {now:true}); P.util = "flash"; }
          else if(uSm && key === "M" && tSmokeReserveOk()){ var smP = {x: to.x + (look.x-to.x)*0.5, y: to.y + (look.y-to.y)*0.5}; if(assignNade(uSm, "smoke", smP, "смок под пробу", {now:true})) P.util = "smoke"; }
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
        if(P.deep){
          // флешка под подпуш от ближайшего тиммейта (не вся раскидка — одна)
          var fl = ts.filter(function(o){ return o !== pb && !o.nadeTask && o.nades && o.nades.flash > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })[0];
          if(fl && BAL.tUtil && !antiEco("T")){ var fp = {x: to.x + (look.x-to.x)*0.3, y: to.y + (look.y-to.y)*0.3}; assignNade(fl, "flash", fp, "под подпуш", {now:true}); }
        }
      }
      return;
    }
    // выход вперёд / на вход
    setPost(pb, P.pt, look, true, "probe"+key);
    holdTask(pb, "probe", tick+1);
    // напарник — ~150px позади пробы по той же линии, смотрит туда же
    if(BAL.pairs && P.buddy){
      var bu = ts.filter(function(o){ return o.id === P.buddy; })[0];
      if(bu && !bu._sawEnemy && !taskOn(bu, "tradeR")){
        var ln = Math.hypot(P.pt.x-from.x, P.pt.y-from.y) || 1, back = Math.min(150, ln*0.6);
        var bp = walk({x: P.pt.x + (from.x-P.pt.x)/ln*back, y: P.pt.y + (from.y-P.pt.y)/ln*back});
        setPost(bu, bp, look, true, "probePair"+key); holdTask(bu, "probe", tick+1);
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
          });
        }
      }
    }
    if((pb.atPost && tick - (P.at || (P.at = tick)) > stay) || tick - P.since > 9*TICK_HZ){
      P.ph = 0; P.cleared = false; P.at = 0; P.saw = 0; P.until = tick + (6 + 3*hashRand(tick + pb.id.charCodeAt(1)))*TICK_HZ;
      dropTask(pb, "probe"); pb.post = null; // вернётся на пост группы со следующего тика
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
// ---- "проверено — пусто": пишется в картину команды (LAST_CLEAR + карта вероятностей) ----
function markClear(team, x, y, who){
  var zid = zoneIdAt(x, y); if(!zid) return null;
  var zi = bzOf(x, y); if(zi >= 0) (LAST_CLEAR[team] || (LAST_CLEAR[team] = {}))[zi] = tick;
  beliefClearAt(team, x, y);
  return zid;
}
function soloMayWalk(b){
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  if(secLeft < 22) return false;
  var site = teamTac.T && SITES[teamTac.T.site]; if(!site) return false;
  // время на шаг до точки: скорость шифта ~ SPEED*WALK_SPEED_FRAC
  var d = Math.hypot(site.x-b.x, site.y-b.y) * 1.3;
  if(d / (SPEED*WALK_SPEED_FRAC) > secLeft - 12) return false;
  var cts = bots.filter(function(o){ return o.team === "CT" && o.alive; });
  var allKnownFar = cts.every(function(o){ var e = picKnown("T")[o.id]; return e && tick - e.tick < 5*TICK_HZ && Math.hypot(e.x-site.x, e.y-site.y) > 1100; });
  return !allKnownFar;
}
// ---- IGL: перестройка плана по ходу раунда ----
// Раньше IGL менял план в двух случаях (стак на сайте / минус опорника), а в
// остальном играл "по бумажке": потеряли человека на миде — всё равно ждём
// тайминга; энтри и поддержку сняли на входе — оставшиеся двое по одному
// лезли в тот же прострелянный угол. Теперь:
//  1) минус в сетапе, а убийца далеко от нашего сайта — их человек не там,
//     заходим раньше, пока он не вернулся;
//  2) минус двое без размена в сетапе — лёркер возвращается к группе, заход
//     всеми вместе (не распыляемся 3 против 5);
//  3) выход провалился (на входе потеряли двоих больше, чем убили) — не
//     добиваем себя, отходим; если на другом сайте по инфе пусто и время есть —
//     переходим туда, иначе перегруппировка и повторный заход вместе.
// (6) бомба уже на сайте (носитель в ~4м от точки) — никаких переколов:
// раньше колл уводил носителя, и он пробегал сайт, не поставив
function carrierAtSite(tt){
  if(bomb.state !== "carried" || !bomb.carrier || !bomb.carrier.alive) return false;
  var S = SITES[tt.site]; return Math.hypot(bomb.carrier.x-S.x, bomb.carrier.y-S.y) < 330 || onSite(S, bomb.carrier.x, bomb.carrier.y);
}
function tIglReplan(tt, site, other, secLeft){
  var DL = tt._dl || [], aliveT = aliveCount("T"), aliveCT = aliveCount("CT");
  if(bomb.state === "planted" || aliveT <= 1) return false;
  if(carrierAtSite(tt)) return false;
  if(tt.phase === "setup"){
    var sd = DL.filter(function(e){ return e.t === "T" && e.phase === "setup"; });
    var last = sd[sd.length-1];
    // (1) убийца далеко от нашего сайта
    if(last && !tt._rpFast && tick - last.tick > 1.5*TICK_HZ && tick - last.tick < 4*TICK_HZ && last.kx !== null &&
       aliveT >= 3 && tt.execTick - tick > 6*TICK_HZ && !last.traded){
      var dS = Math.hypot(last.kx-site.x, last.ky-site.y);
      if(dS > 1100){
        tt._rpFast = true;
        tt.execTick = Math.max(tick + 4*TICK_HZ, Math.min(tt.execTick, tick + 6*TICK_HZ));
        logEvent("IGL: минус в сетапе, но CT далеко от "+tt.site+" — выход раньше");
      }
    }
    // (0) сняли CT в сетапе, мы в большинстве — не спешим: контроль карты и
    // выход всей группой (не дарить размен, заходя по одному в спешке)
    if(BAL.numbersPlay && !tt._upSlow && aliveT >= aliveCT + 1 && secLeft > 50){
      var cdS = DL.filter(function(e){ return e.t === "CT" && e.phase === "setup"; });
      var lastC = cdS[cdS.length-1];
      if(lastC && tick - lastC.tick < 2*TICK_HZ){
        tt._upSlow = tick; tt._rpFast = true; // и не ускоряемся на следующий минус
        if(tt.execTick - tick < 8*TICK_HZ) tt.execTick = tick + 8*TICK_HZ;
        logEvent("IGL: численный перевес "+aliveT+"v"+aliveCT+" — без спешки, выход всей группой");
      }
    }
    // (2) двое без размена — лёркер к нам
    var untraded = sd.filter(function(e){ return !e.traded; }).length;
    if(!tt.regroup && untraded >= 2 && aliveT <= 3 && aliveCT >= aliveT){
      var lk = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole === "lurker"; })[0];
      tt.regroup = tick;
      if(lk){ lk._route = null; lk._routeDone = null; }
      tt.execTick = Math.max(tt.execTick, tick + 5*TICK_HZ); // дать дойти
      logEvent("IGL: потеряли двоих без размена — перегруппировка"+(lk ? " (лёркер "+lk.id+" к основной группе)" : ""));
    }
    // (S8) слышим ротацию CT на наш сайт — можно перейти на другой. Но это
    // только чтение, не гарантия: IGL верит ему не всегда (~60%), и другой сайт
    // НЕ считается пустым — заходим туда обычным выходом, с гранатами и чеком углов
    if(BAL.rotRead && !tt.rebound && !tt._rotDone && aliveT >= 3 && secLeft > 45 && tick % 16 === 0){
      var RH = tt._rotH || (tt._rotH = {});
      picEvents("T").forEach(function(sg){ if((sg.type !== "spotted" && sg.type !== "sound") || !sg.id || sg.id === "?" || tick - sg.tick > 16) return;
        var h = RH[sg.id] || (RH[sg.id] = []); if(!h.length || sg.tick - h[h.length-1].tick >= TICK_HZ){ h.push({x:sg.x, y:sg.y, tick:sg.tick}); if(h.length > 3) h.shift(); } });
      var toward = [];
      for(var rid in RH){ var h = RH[rid]; if(h.length < 2) continue; var a0 = h[0], a1 = h[h.length-1]; if(tick - a1.tick > 6*TICK_HZ) continue;
        var dS0 = Math.hypot(a0.x-site.x, a0.y-site.y), dS1 = Math.hypot(a1.x-site.x, a1.y-site.y);
        var dO0 = Math.hypot(a0.x-SITES[other].x, a0.y-SITES[other].y), dO1 = Math.hypot(a1.x-SITES[other].x, a1.y-SITES[other].y);
        if(dS0 - dS1 > 120 && dO1 - dO0 > 80 && dS1 < 1400) toward.push(rid); }
      if(toward.length >= (aliveCT <= 3 ? 1 : 2)){
        tt._rotDone = tick;
        if(hashRand(roundNum*389 + matchNum*23 + 7) < 0.6){
          tt.rebound = true;
          var ctrR = {x:0, y:0}, tsR = bots.filter(function(b){ return b.team === "T" && b.alive; });
          tsR.forEach(function(b){ ctrR.x += b.x/tsR.length; ctrR.y += b.y/tsR.length; });
          var trvR = Math.hypot(ctrR.x-SITES[other].x, ctrR.y-SITES[other].y)*1.4/SPEED;
          logEvent("IGL: слышим ротацию CT на "+tt.site+" → перекол на "+other+" (не значит, что там пусто)");
          tt.site = other; tt.phase = "setup"; tt.execStart = null; tt.plantPick = null; tt.takeAssign = null;
          tt.execTick = tick + Math.round(Math.min(Math.max(4, trvR*0.7), 12)*TICK_HZ);
          nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
          bots.forEach(function(b){ if(b.team === "T"){ b._route = null; b._routeDone = null; b._stageInfo = null; } });
          return true;
        } else logEvent("IGL: слышим ротацию CT на "+tt.site+", но это может быть фейк — играем по плану");
      }
    }
    return false;
  }
  if(tt.phase === "execute" && !tt.aborted && tt.execStart && tick - tt.execStart < 10*TICK_HZ && secLeft > 40){
    var tD = DL.filter(function(e){ return e.t === "T" && e.tick >= tt.execStart; }).length;
    var cD = DL.filter(function(e){ return e.t === "CT" && e.tick >= tt.execStart; }).length;
    if(tD - cD >= 2 && aliveT <= 3 && aliveCT >= aliveT){
      tt.aborted = tick;
      var otherB = beliefCount("T", BZ.siteNear[other]||[]);
      var ctr = {x:0, y:0}, tsA = bots.filter(function(b){ return b.team === "T" && b.alive; });
      tsA.forEach(function(b){ ctr.x += b.x/tsA.length; ctr.y += b.y/tsA.length; });
      var travel = Math.hypot(ctr.x-SITES[other].x, ctr.y-SITES[other].y)*1.4/SPEED;
      var goOther = otherB < 1.2 && secLeft > travel + 15;
      tsA.forEach(function(b){ b._route = null; b._routeDone = null; b._stageInfo = null; });
      tt.takeAssign = null; tt.plantPick = null; tt.wave2 = null; tt.w1Contact = null; tt._popDone = false; tt._waitLog = false;
      nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
      if(goOther){
        tt.site = other; tt.phase = "setup"; tt.execStart = null; tt.execTick = tick + Math.round(Math.min(travel*0.8, 14)*TICK_HZ);
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход, перекол на "+other);
      } else {
        tt.phase = "setup"; tt.execStart = null; tt.execTick = tick + 6*TICK_HZ;
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход и повторный заход на "+tt.site);
      }
      return true;
    }
  }
  return false;
}
