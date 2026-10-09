// ======================= IGL T: ПЛАН НА РАУНД И ЕГО СМЕНА (шаг 6) =======================
// Одно место на «какой execute играет T» (docs/BRAIN.md 5.1, 5.4; шаг 6 PROMPTS.md).
// Варианты — T-сценарии из setups.json (сайт + маршрут, у каждого контрольный тайминг
// timing.startSec — медиана выхода у про). Сценарий здесь только выбирается, исполняет
// его шаг 7 (12_script_runner.js). План пишется только через teamSetPlan (12_team.js).
//
// Во freeze IGL выбирает вариант по весам (PLAN в 12_team.js):
//   частота у про × повтор (прошлый раунд / два подряд) × проигрыш с этим вариантом
//   (и на этот сайт) × экономика (эко — самый ранний выход).
// План раунда: default (контроль карты, цель уже известна команде) → execute.
// Смена посреди раунда — только по поводам BRAIN 5.4:
//   плант           — пост-плант на сайте бомбы (сразу);
//   потеря состава  — fallback: вместе на сайт плана (по киллфиду, его видят все);
//   тайминг         — истёк startSec варианта: default → execute;
//   пики            — пока default: нас больше на PLAN.pickLead (киллфид) — колл «выходим» сейчас;
//   колл IGL        — пока default: IGL сам знает (своё b.know: видел + войс), что на сайте
//                     плана стоят ≥ PLAN.infoN CT — колл «меняем на другой сайт», один за раунд.

function tbSetup(id){
  for(var i = 0; i < POS_SETUPS.t.length; i++) if(POS_SETUPS.t[i].id === id) return POS_SETUPS.t[i];
  return null;
}
function tbName(s){ return s.site + " " + s.route; }
function tbLabel(type, s){
  if(type === "default") return "default (дальше " + tbName(s) + ", выход на " + Math.round(s.timing.startSec) + " с)";
  if(type === "execute") return "execute " + tbName(s);
  return type + " " + tbName(s);
}

// веса вариантов execute на этот раунд; only — только варианты на этот сайт
function tbWeights(only){
  var hist = planHist("T", 2), last = hist[0], prev = hist[1];
  var eco = teamEco.T.roundType === "eco";
  var fast = null;
  POS_SETUPS.t.forEach(function(s){ if(!fast || s.timing.startSec < fast.timing.startSec) fast = s; });
  return POS_SETUPS.t.filter(function(s){ return !only || s.site === only; }).map(function(s){
    var w = s.share, why = [];
    if(last && last.setupId === s.id){
      if(prev && prev.setupId === s.id){ w *= PLAN.repeat2; why.push("два раунда подряд"); }
      else { w *= PLAN.repeat1; why.push("был в прошлом"); }
    }
    var lastSame = hist.filter(function(e){ return e.setupId === s.id; })[0];
    if(lastSame && !lastSame.won){ w *= PLAN.lost; why.push("с ним проиграли"); }
    else if(last && !last.won && last.site === s.site && last.setupId !== s.id){ w *= PLAN.lostSite; why.push("на " + s.site + " проиграли"); }
    if(eco && s === fast){ w *= PLAN.ecoFast; why.push("эко — ранний выход"); }
    return {s: s, w: w, why: why};
  });
}
function tbWhy(list, pick){
  return list.map(function(c){
    return (c === pick ? "[" : "") + tbName(c.s) + " " + c.w.toFixed(2) + (c.why.length ? " (" + c.why.join(", ") + ")" : "") + (c === pick ? "]" : "");
  }).join("; ");
}

// ---------- freeze: выбор на раунд (16_economy.js, resetRound → planRoundStart) ----------
function tBrainRoundStart(){
  var list = tbWeights(null), c = planPick("T", list), T = teamOf("T"), igl = planIgl("T");
  T.roundPick = c.s.id; T.roundSite = c.s.site;
  teamSetPlan("T", {type: "default", site: c.s.site, activeSetupId: c.s.id},
              "раунд " + roundNum + ", " + ROUND_TYPE_LABEL[teamEco.T.roundType] + ", IGL " + (igl ? igl.id : "—") + ": " + tbWhy(list, c),
              tbLabel("default", c.s));
}

// ---------- раз в тик (17_tick.js): смена только по поводам 5.4 ----------
function tBrainTick(){
  if(roundState !== "live") return;
  var T = teamOf("T"), P = T.planState, s = tbSetup(P.activeSetupId);
  if(!s) return;
  // плант: бомба у своих — сайт знают все
  if(bomb && bomb.state === "planted"){
    if(P.type !== "post_plant")
      teamSetPlan("T", {type: "post_plant", site: bomb.site, activeSetupId: s.id}, "бомба заложена на " + bomb.site, "пост-плант " + bomb.site);
    return;
  }
  if(P.type === "post_plant") return;
  // потеря состава: сколько живых у кого — из киллфида
  var us = bots.filter(function(b){ return b.team === "T" && b.alive; }).length;
  var them = bots.filter(function(b){ return b.team === "CT" && b.alive; }).length;
  if(P.type !== "fallback" && (us <= them - PLAN.lossDiff || (us <= PLAN.lossAlive && us < them))){
    teamSetPlan("T", {type: "fallback", site: s.site, activeSetupId: s.id}, "живых " + us + " против " + them, "fallback: вместе на " + s.site);
    return;
  }
  if(P.type !== "default" || !planCanSwitch("T")) return;
  // контрольный тайминг варианта
  var sec = (tick - roundStartTick)/TICK_HZ;
  if(sec >= s.timing.startSec){
    teamSetPlan("T", {type: "execute", site: s.site, activeSetupId: s.id}, "тайминг " + Math.round(s.timing.startSec) + " с", tbLabel("execute", s));
    return;
  }
  // колл IGL по сильной инфе: на сайте плана уже стоят ≥ infoN CT — идём на другой
  var igl = planIgl("T");
  if(T.callMade || !igl || !igl.alive) return;
  // пики: в дефолте убили столько, что нас больше на PLAN.pickLead (киллфид видят все) — выходим сейчас,
  // пока CT не перестроились (docs/PRO_PLAY.md 2.4: «после пиков — execute»)
  if(sec >= PLAN.pickMinSec && us - them >= PLAN.pickLead){
    teamCallPlan(igl, "есть пики, выходим " + s.site,
                 {type: "execute", site: s.site, activeSetupId: s.id},
                 "пики: живых " + us + " против " + them, tbLabel("execute", s));
    return;
  }
  var loc = planLocated(igl);
  if(loc[s.site] < PLAN.infoN) return;
  var other = s.site === "A" ? "B" : "A", list = tbWeights(other);
  if(!list.length) return;
  var best = list[0]; list.forEach(function(c){ if(c.w > best.w) best = c; });
  teamCallPlan(igl, "их " + loc[s.site] + " на " + s.site + ", меняем на " + other,
               {type: "default", site: other, activeSetupId: best.s.id},
               "сильная инфа: " + loc[s.site] + " CT на " + s.site + " (" + planLocatedWhy(igl, s.site) + ")",
               tbLabel("default", best.s));
}
