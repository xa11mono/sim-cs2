// ======================= IGL CT: РАСКЛАДКА НА РАУНД И ЕЁ СМЕНА (шаг 6) =======================
// Одно место на «какой Setup стоит CT» (docs/BRAIN.md 5.3, 5.4; шаг 6 PROMPTS.md).
// Варианты — CT-Setup'ы из setups.json (раскладка «сколько на A / миде / B»; стак — тоже
// раскладка, BRAIN 5.3). Где кто встаёт — 11_position.js: он берёт activeSetupId из плана
// и перестраивает живых CT, когда тот меняется. План пишется только через teamSetPlan.
//
// Во freeze IGL выбирает раскладку по весам (PLAN в 12_team.js):
//   частота у про × повтор × проигрыш с этой раскладкой × где T ставили бомбу за последние
//   раунды (больше людей на том сайте — вес выше) × экономика (эко — стак).
// Смена посреди раунда — только по поводам BRAIN 5.4:
//   плант           — ретейк (сайт — что знает IGL: видел/слышал/сказали; не знает — уточнит);
//                     RetakeSetup'ов пока нет (шаг 8) — раскладка та же, CT стоят где стояли;
//   потеря состава  — fallback (раскладка та же, слоты делит 11_position.js);
//   колл IGL        — до планта: IGL сам знает (своё b.know), что на одной стороне ≥ PLAN.infoN
//                     T — колл на раскладку, где там больше CT; один за раунд.
// Контрольного тайминга у CT нет: защита стоит, пока ничего не узнала.

function cbSetup(id){
  for(var i = 0; i < POS_SETUPS.ct.length; i++) if(POS_SETUPS.ct[i].id === id) return POS_SETUPS.ct[i];
  return null;
}
function cbName(s){ return s.name + " " + s.split.A + "-" + s.split.mid + "-" + s.split.B; }

function cbWeights(){
  var hist = planHist("CT", Math.max(2, PLAN.readN)), last = hist[0], prev = hist[1];
  var eco = teamEco.CT.roundType === "eco";
  var planted = {A: 0, B: 0};
  hist.slice(0, PLAN.readN).forEach(function(e){ if(e.plantSite) planted[e.plantSite]++; });
  return POS_SETUPS.ct.map(function(s){
    var w = s.share, why = [];
    if(last && last.setupId === s.id){
      if(prev && prev.setupId === s.id){ w *= PLAN.repeat2; why.push("два раунда подряд"); }
      else { w *= PLAN.repeat1; why.push("был в прошлом"); }
    }
    var lastSame = hist.filter(function(e){ return e.setupId === s.id; })[0];
    if(lastSame && !lastSame.won){ w *= PLAN.lost; why.push("с ним проиграли"); }
    ["A","B"].forEach(function(k){
      if(!planted[k]) return;
      var m = Math.max(0.2, 1 + PLAN.read*planted[k]*(s.split[k] - 1));
      if(m !== 1){ w *= m; why.push("планты на " + k + ": " + planted[k]); }
    });
    if(eco && s.name.indexOf("stack") === 0){ w *= PLAN.ecoStack; why.push("эко — стак"); }
    return {s: s, w: w, why: why};
  });
}
function cbWhy(list, pick){
  return list.map(function(c){
    return (c === pick ? "[" : "") + cbName(c.s) + " " + c.w.toFixed(2) + (c.why.length ? " (" + c.why.join(", ") + ")" : "") + (c === pick ? "]" : "");
  }).join("; ");
}

// ---------- freeze: выбор на раунд (resetRound → planRoundStart, до posRoundStart) ----------
function ctBrainRoundStart(){
  var list = cbWeights(), c = planPick("CT", list), T = teamOf("CT"), igl = planIgl("CT");
  T.roundPick = c.s.id; T.roundSite = null;
  teamSetPlan("CT", {type: "default", activeSetupId: c.s.id},
              "раунд " + roundNum + ", " + ROUND_TYPE_LABEL[teamEco.CT.roundType] + ", IGL " + (igl ? igl.id : "—") + ": " + cbWhy(list, c),
              cbName(c.s));
}

// ---------- раз в тик (17_tick.js): смена только по поводам 5.4 ----------
function ctBrainTick(){
  if(roundState !== "live") return;
  var T = teamOf("CT"), P = T.planState, s = cbSetup(P.activeSetupId);
  if(!s) return;
  var igl = planIgl("CT");
  // плант: что бомба заложена — объявление слышат все; где — знает тот, кто видел/слышал/кому сказали.
  // Сайт — по знанию IGL; IGL мёртв — того из живых, кто знает (он и скажет)
  if(bomb && bomb.state === "planted"){
    var who = igl && igl.alive ? igl : null;
    if(!who) bots.forEach(function(b){ if(!who && b.team === "CT" && b.alive && b.know && b.know.plantSite) who = b; });
    var site = who && who.know ? who.know.plantSite || null : null;
    if(P.type !== "retake")
      teamSetPlan("CT", {type: "retake", site: site, activeSetupId: s.id},
                  "бомба заложена" + (site ? " на " + site + " (знает " + who.id + ")" : ", где — пока не знаем"),
                  "ретейк " + (site || "?") + " (" + cbName(s) + ")");
    else if(!P.site && site)
      teamSetPlan("CT", {type: "retake", site: site, activeSetupId: s.id}, "узнали сайт: " + site + " (" + who.id + ")",
                  "ретейк " + site + " (" + cbName(s) + ")");
    return;
  }
  // потеря состава
  var us = bots.filter(function(b){ return b.team === "CT" && b.alive; }).length;
  var them = bots.filter(function(b){ return b.team === "T" && b.alive; }).length;
  if(P.type === "default" && (us <= them - PLAN.lossDiff || (us <= PLAN.lossAlive && us < them))){
    teamSetPlan("CT", {type: "fallback", activeSetupId: s.id}, "живых " + us + " против " + them, "fallback (" + cbName(s) + ")");
    return;
  }
  // колл IGL по сильной инфе: на стороне ≥ infoN T — раскладка, где там больше CT
  if(P.type !== "default" || T.callMade || !igl || !igl.alive || !planCanSwitch("CT")) return;
  var loc = planLocated(igl), R = null;
  ["A","B"].forEach(function(k){ if(loc[k] >= PLAN.infoN && (!R || loc[k] > loc[R])) R = k; });
  if(!R) return;
  var best = null;
  POS_SETUPS.ct.forEach(function(c){
    if(!best || c.split[R] > best.split[R] || (c.split[R] === best.split[R] && c.share > best.share)) best = c;
  });
  if(best.split[R] <= s.split[R]) return;   // и так столько, сколько можем
  teamCallPlan(igl, "их " + loc[R] + " на " + R + ", встаём " + best.split[R] + " на " + R,
               {type: "default", activeSetupId: best.id},
               "сильная инфа: " + loc[R] + " T на " + R + " (" + planLocatedWhy(igl, R) + ")",
               cbName(best));
}
