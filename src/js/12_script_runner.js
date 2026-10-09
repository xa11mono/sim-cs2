// ======================= ИСПОЛНИТЕЛЬ СЦЕНАРИЕВ: steps / dependsOn (шаг 7) =======================
// Одно место на «как команда исполняет сценарий» (docs/BRAIN.md 5.1; шаг 7 PROMPTS.md).
// Сценарий — T-execute из setups.json или ретейк CT (RetakeSetup, 08_retake.js; шаг 8): scrSetupFor.
// Исполнитель от стороны не зависит. У ретейка свои условие шага (teamGatheredAt — команда собралась,
// считает 08_retake.js) и действие (defuse — дефузер идёт к бомбе и дефузит); сбор, «следом за
// энтри» и отказ от ретейка — 08_retake.js.
//
// До execute (план default) команда играет дефолт (12_t_default.js); бросающие уходят к своему лайнапу
// заранее, чтобы успеть к контрольному таймингу (scrTimeToGo), и ждут там. Пока бота ведёт исполнитель
// (b._scrT = тик), дефолт его не трогает. Сценарий выбран во freeze; сменил IGL — заново.
// Старт: план команды стал execute (teamSetPlan, 07_t_brain.js) — это dependsOn.trigger =
// execute_start; его знают все (план команды — общее знание). Дальше у каждого шага свой актёр:
//   throw_smoke / throw_flash / throw_molly — бот с такой гранатой занимает точку броска ЗАРАНЕЕ
//        (как игрок встаёт на лайнап и ждёт) и бросает, когда его условие выполнено;
//   push   — энтри заходит на сайт;
//   plant  — носитель бомбы идёт на сайт и ставит;
//   hold_flank (lurker) — вне сценария: lurker действует по своему знанию, шаг пропускается.
//
// Условие шага — событие, которое САМ актёр узнал (его b.know.nev, 09_knowledge.js): бросил сам /
// увидел разрыв / услышал в войсе. Глобальные smokes[], nadesInAir[] отсюда не читаются. Какое
// событие «то самое» — решает исполнитель по плану (актёр знает, какая граната куда летит): разрыв
// относится к ближайшему к точке шага шагу того же типа.
//   afterSmokeLands / afterFlashPop — разрыв дыма / флешки шага-источника;
//   afterPrev + pauseSec            — разрыв гранаты предыдущего шага, плюс пауза;
//   afterEntryCommitted             — энтри пошёл на сайт (увидел сам / «заходим» в войсе).
// Ожидание ограничено — maxDelayTicks шага (нет — SCR.baseWait), умноженным на RoleProfile.waitK
// роли актёра: entry ждёт меньше, support больше. Отсчёт — от последнего сигнала, который актёр сам
// узнал, но не раньше, чем он занял позицию (дошёл до точки броска / освободился от своих прежних
// шагов): «стою на месте, сигнала нет уже столько-то — иду». Так выпавший шаг (бросавший погиб,
// гранаты нет) не вешает команду; в логе такой шаг помечен ТАЙМАУТ. Шаг, чей источник снят
// (актёр погиб и заменить нечем), тоже снимается.
//
// Граната шага — «закрыть цель» (step.at): способ — лайнап из lineups_pro.json (тип, сторона, сайт,
// to не дальше SCR.lineupR от цели; ближайшая к актёру точка броска), нет — точки броска самого
// шага (ways). Бросок — действие движка (13_nades.js), навесом в точку лайнапа. Закуп гранат под шаги выбранного сценария — scrBuyUtility
// (на деньги после винтовки и брони, заплатка до настоящего закупа).
// Лог: SCR_LOG ({tick, sec, who, ev, why, rel}) + консоль игры; проверка — tools/script_log.js.

var SCR = {
  baseWait: 120,   // тиков: ждать сигнала, если в шаге нет maxDelayTicks — проектная константа, заплатка
  matchR:   220,   // px: упавшая граната — «та самая» шага, если ближе всех к его точке и не дальше (лайнап 120 + разброс 90)
  lineupR:  120,   // px: лайнап из lineups_pro подходит шагу, если его to не дальше от цели шага
  arriveR:  30,    // на точке броска (двое на одном лайнапе стоят рядом; разброс броска всё равно 90)
  repath:   32,    // тиков: движок сбросил путь — снова к той же точке не чаще
  lead:     3,     // с: бросающий приходит к лайнапу за столько до контрольного тайминга
  stuckT:   192,   // тиков (3 с): если за это время до цели не стало ближе хотя бы на stuckPx — застрял, шаг снимается
  stuckPx:  8
};
var SCR_S = {};     // сторона → исполнение {setup, start, steps, entry, over}
var SCR_LOG = [];

// ---------- начало раунда (resetRound, 16_economy.js): гранаты под выбранный сценарий ----------
function scriptRoundStart(){
  SCR_S = {};
  if(roundNum === 1) SCR_LOG.length = 0;
  bots.forEach(function(b){ b.pushTick = undefined; b.pushSite = undefined; b._rtSafe = undefined; b._rtLook = undefined; b._rtHold = undefined; b._rtVia = undefined; });
  scrBuyUtility("T");
  scrBuyUtility("CT");   // под ретейк: сайт ещё неизвестен — гранаты на любой
}
// Заплатка: что брать — по шагам выбранного сценария, на деньги после винтовки и брони; гранату
// получает тот, у кого их меньше, при равенстве — у кого больше денег; будущий энтри и lurker — в
// последнюю очередь / никогда (энтри ждёт на входе, lurker не в сценарии).
function scrBuyUtility(side){
  var P = teamOf(side).planState, setup = side === "T" ? tbSetup(P.activeSetupId) : rtUtilityPlan();
  if(!setup) return;
  var pool = bots.filter(function(b){ return b.team === side && b.alive && b.role !== "lurker"; }), got = {};
  var entry = scrPickEntry(side, null);   // ему входить — гранаты ему в последнюю очередь
  setup.steps.forEach(function(st){
    var m = /^throw_(smoke|flash|molly|he)$/.exec(st.action); if(!m) return;
    var best = null;
    pool.forEach(function(b){
      if(!nadeCanBuy(b, m[1])) return;
      if(!best || (b === entry) < (best === entry) || ((b === entry) === (best === entry) &&
         (nadeCount(b) < nadeCount(best) || (nadeCount(b) === nadeCount(best) && b.money > best.money)))) best = b;
    });
    if(best && buyNade(best, m[1])){ (got[best.id] = got[best.id] || []).push(NADE[m[1]].name); }
  });
  var txt = Object.keys(got).map(function(id){ return id + ": " + got[id].join(", "); }).join("; ");
  logEvent("Закуп гранат " + side + " под " + setup.id + ": " + (txt || "не на что"), "info");
}

// ---------- раз в тик (17_tick.js, после tBrainTick) ----------
function scriptTick(){
  if(roundState !== "live") return;
  scrSide("T");
  scrSide("CT");
  rtTick();       // ретейк: сбор, остальные — следом за энтри, сейв (08_retake.js)
}
// сценарий плана: T — execute-вариант (на default — подготовка к нему), CT — ретейк сайта бомбы
function scrSetupFor(side, P){
  if(side === "T") return (P.type === "default" || P.type === "execute") && P.activeSetupId ? tbSetup(P.activeSetupId) : null;
  return P.type === "retake" && P.site ? rtSetup(P.site) : null;
}
function scrSide(side){
  var P = teamOf(side).planState, R = SCR_S[side];
  if(R && R.start !== null && R.start > tick) R = SCR_S[side] = null;   // тик пошёл назад — матч заново
  var want = scrSetupFor(side, P);
  if(R && !R.over && !R.started && want && R.setup !== want){   // IGL сменил сценарий до выхода — заново
    scrEnd(R, "IGL сменил сценарий"); R = SCR_S[side] = null;
  }
  if(!R){
    if(!want) return;
    R = SCR_S[side] = scrStart(side, P, want);
    if(!R) return;
  }
  if(R.over) return;
  if(!want){ scrEnd(R, "план сменился: " + P.type); return; }
  // default (контроль карты): актёры занимают позиции под свой сценарий; execute — сценарий пошёл
  if(!R.started && P.type === "execute"){ R.started = true; R.start = P.declaredAt; scrLog(R, null, "execute", "сценарий пошёл (план execute)"); }
  R.steps.forEach(function(S){ scrStep(R, S); });
  if(R.started && R.steps.every(scrTerminal)) scrEnd(R, "все шаги отработаны");
}
function scrTerminal(S){ return S.state === "done" || S.state === "drop" || S.state === "skip"; }

// ---------- старт: шаги, зависимости, актёры ----------
function scrStart(side, P, setup){
  if(!setup) return null;
  var go = P.type === "execute" || P.type === "retake";   // ретейк начинается сразу (сбор — его первый этап)
  var R = {side: side, setup: setup, started: go, start: go ? P.declaredAt : null, steps: [], entry: null, over: false};
  setup.steps.forEach(function(st, i){
    var m = /^throw_(smoke|flash|molly|he)$/.exec(st.action);
    var S = {i: i, st: st, actor: st.actor, kind: m ? "throw" : /^(push|plant|defuse)$/.test(st.action) ? st.action : "skip",
             ntype: m ? m[1] : null, at: st.at || null, zone: st.at ? knowZoneAt(st.at[0], st.at[1]) : null,
             state: "wait", bot: null, dep: null, rel: null, opts: [], pick: null};
    R.steps.push(S);
  });
  function byActor(id){ for(var j = 0; j < R.steps.length; j++) if(R.steps[j].actor === id) return R.steps[j]; return null; }
  R.steps.forEach(function(S){
    var dd = S.st.dependsOn || {};
    var on = dd.afterSmokeLands || dd.afterFlashPop || dd.afterPrev || dd.afterEntryCommitted;
    if(dd.trigger === "execute_start") S.dep = {kind: "start"};
    else if(dd.teamGatheredAt) S.dep = {kind: "gather"};
    else if(on) S.dep = {kind: "event", on: on, step: byActor(on), pauseTicks: Math.round((dd.pauseSec || 0)*TICK_HZ), maxDelay: dd.maxDelayTicks || SCR.baseWait};
  });
  R.steps.forEach(function(S){
    if(S.kind === "skip" || !S.dep){ S.state = "skip"; return; }
    if(S.kind === "throw") S.opts = scrOptions(R, S);
    else if(S.kind === "push"){
      R.entry = scrPickEntry(R.side, null); S.bot = R.entry;
      if(!S.bot){ S.state = "drop"; S.why = "энтри нет"; }
    } else if(S.kind === "plant"){
      if(bomb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive) S.bot = bomb.carrier;
      else { S.state = "drop"; S.why = "бомбы нет у живого"; }
    }
  });
  R.steps.forEach(function(S){   // дефузер — когда энтри уже выбран (08_retake.js)
    if(S.kind !== "defuse" || S.state !== "wait") return;
    S.bot = bomb && bomb.state === "planted" ? rtPickDefuser(R, null) : null;
    if(!S.bot){ S.state = "drop"; S.why = "дефузить некому"; }
  });
  scrAssignThrowers(R);
  var lines = R.steps.map(function(S){
    return S.state === "skip" ? S.actor + " — вне сценария" :
      S.actor + " → " + (S.bot ? S.bot.id : "—") + (S.state === "drop" ? " (снят: " + S.why + ")" : "") + (S.pick ? " [" + S.pick.src + "]" : "");
  });
  scrLog(R, null, R.started ? "старт" : "позиции", setup.id + ": " + lines.join("; "));
  return R;
}
// кто какую гранату бросает: перебор по всем способам раздать шаги ботам с нужной гранатой; лучший —
// с наименьшей суммой «когда каждый шаг встанет на точку» (путь бота по его шагам по очереди), так что
// старт-шаги расходятся по разным ботам; энтри — только если больше некому. Шаг без гранаты ни у кого — снят.
function scrAssignThrowers(R){
  var steps = R.steps.filter(function(S){ return S.kind === "throw" && S.state === "wait"; });
  var pool = bots.filter(function(b){ return b.team === R.side && b.alive && b.role !== "lurker"; });
  var cum = {}, last = {}, inv = {}, cur = [], best = {cost: Infinity, pick: null};
  pool.forEach(function(b){ cum[b.id] = 0; last[b.id] = {x: b.x, y: b.y}; inv[b.id] = {smoke: b.nades.smoke, flash: b.nades.flash, molly: b.nades.molly, he: b.nades.he}; });
  function rec(i, cost){
    if(cost >= best.cost) return;
    if(i === steps.length){ best = {cost: cost, pick: cur.slice()}; return; }
    var S = steps[i], any = false;
    pool.forEach(function(b){
      if(inv[b.id][S.ntype] <= 0) return;
      var o = scrNearestFrom(S.opts, last[b.id]); if(!o) return;
      if(R.setup.gather && rtViaSite(b, o.from.x, o.from.y, R.setup.site)) return;   // ретейк: к точке броска не через сайт
      any = true;
      var c0 = cum[b.id], l0 = last[b.id];
      cum[b.id] = c0 + Math.hypot(l0.x - o.from.x, l0.y - o.from.y); last[b.id] = o.from; inv[b.id][S.ntype]--;
      cur[i] = {bot: b, pick: o};
      rec(i + 1, cost + cum[b.id] + (b === R.entry ? 1e5 : 0));
      inv[b.id][S.ntype]++; cum[b.id] = c0; last[b.id] = l0;
    });
    if(!any){ cur[i] = null; rec(i + 1, cost + 1e6); }
  }
  rec(0, 0);
  steps.forEach(function(S, i){
    var c = best.pick && best.pick[i];
    if(c){ S.bot = c.bot; S.pick = c.pick; }
    else { S.state = "drop"; S.why = "гранаты (" + NADE[S.ntype].name + ") нет ни у кого"; }
  });
}
function scrNearestFrom(opts, p){
  var best = null, bd = 1e9;
  opts.forEach(function(o){ var d = Math.hypot(p.x - o.from.x, p.y - o.from.y); if(d < bd){ bd = d; best = o; } });
  return best;
}
function scrWaitK(b){ return (RoleProfile[b.role] || {}).waitK || 1; }

// способы бросить «закрыть цель»: лайнапы про (to рядом с целью), иначе точки самого шага
function scrOptions(R, S){
  var out = [], G = R.setup.gather;   // ретейк: бросают от точки сбора, вперёд по одному не уходят
  proLineups().forEach(function(L){
    if(L.team !== R.side || L.type !== S.ntype) return;
    if(L.site && L.site !== "any" && L.site !== R.setup.site) return;
    if(Math.hypot(L.to.x - S.at[0], L.to.y - S.at[1]) > SCR.lineupR) return;
    if(G && Math.hypot(L.from.x - G.at[0], L.from.y - G.at[1]) > RETAKE.fromR) return;
    out.push({from: {x: L.from.x, y: L.from.y}, to: {x: L.to.x, y: L.to.y}, src: "lineups_pro " + L.id});
  });
  if(!out.length) (S.st.ways || []).forEach(function(w){
    out.push({from: {x: w.from[0], y: w.from[1]}, to: {x: w.to[0], y: w.to[1]}, src: (G ? "08_retake.js" : "setups.json") + " ways n=" + w.n});
  });
  return out;
}
function scrNearest(opts, b){
  var best = null, bd = 1e9;
  opts.forEach(function(o){ var d = Math.hypot(b.x - o.from.x, b.y - o.from.y); if(d < bd){ bd = d; best = o; } });
  return best;
}
// сколько гранат типа type у бота не закреплено за другими ещё не брошенными шагами
function scrFree(R, b, type, except){
  var n = b.nades[type];
  R.steps.forEach(function(o){ if(o !== except && o.kind === "throw" && o.ntype === type && o.bot === b && (o.state === "wait")) n--; });
  return n;
}
// кто бросит: у кого есть граната и ближе точка броска; энтри — только если больше некому (ему входить)
function scrChooseThrower(R, S, exclude){
  var best = null, bd = 1e9;
  bots.forEach(function(b){
    if(b.team !== R.side || !b.alive || b === exclude || b.role === "lurker") return;
    if(scrFree(R, b, S.ntype, S) <= 0) return;
    var pick = scrNearest(S.opts, b); if(!pick) return;
    if(R.setup.gather && rtViaSite(b, pick.from.x, pick.from.y, R.setup.site)) return;
    var load = 0; R.steps.forEach(function(o){ if(o !== S && o.bot === b && o.state === "wait" && (o.kind === "throw" || o.kind === "plant")) load++; });
    // ближе точка — лучше; каждый уже закреплённый за ботом шаг — как ещё 700 px пути (шаги бота идут по очереди);
    // энтри — только если больше некому
    var d = Math.hypot(b.x - pick.from.x, b.y - pick.from.y) + load*700 + (b === R.entry ? 1e5 : 0);
    if(d < bd){ bd = d; best = {bot: b, pick: pick}; }
  });
  return best;
}
// энтри: роль entry (не IGL и не носитель бомбы — ей ставить), иначе кто-то из остальных, кроме lurker и AWP
function scrPickEntry(side, except){
  var car = bomb && bomb.state === "carried" ? bomb.carrier : null;
  var alive = bots.filter(function(b){ return b.team === side && b.alive && b !== except; });
  function pool(f){ return alive.filter(f)[0]; }
  return pool(function(b){ return b.role === "entry" && !b.igl && b !== car; })
      || pool(function(b){ return b.role === "entry" && b !== car; })
      || pool(function(b){ return b.role === "entry"; })
      || pool(function(b){ return b.role !== "lurker" && b.role !== "awp" && b !== car; })
      || pool(function(b){ return b.role !== "lurker" && b !== car; }) || null;
}

// ---------- условие шага: что актёр сам узнал ----------
// событие e (из знания актёра) — это событие шага D? (по плану: ближайший по точке шаг того же типа)
function scrAttr(R, D, e){
  if(e.x === null) return !!e.zone && !!D.zone && teamSamePlace(e.zone, D.zone);   // по войсу — только зона
  var best = null, bd = 1e9;
  R.steps.forEach(function(o){
    if(o.kind !== "throw" || o.ntype !== D.ntype || !o.at) return;
    var d = Math.hypot(e.x - o.at[0], e.y - o.at[1]); if(d < bd){ bd = d; best = o; }
  });
  return best === D && bd <= SCR.matchR;
}
function scrFind(R, b, D){
  var list = [];
  if(D.kind === "throw") list = knowEvents(b, D.ntype, R.start).filter(function(e){ return scrAttr(R, D, e); });
  else if(D.kind === "push") list = knowEvents(b, "commit", R.start).filter(function(e){ return D.bot && e.by === D.bot.id; });
  return list[0] || null;
}
function scrHow(e, D){
  var nm = D.kind === "throw" ? NADE[D.ntype].name : "вход";
  var z = e.zone ? knowZoneName(e.zone) : "?";
  return (e.src === "own" ? "сам: " : e.src === "saw" ? "увидел: " : "услышал в войсе: ") + nm + " " + z;
}
// {} — ещё нет; {ok, how, e, timeout}; {drop}
function scrCue(R, S){
  var b = S.bot, d = S.dep;
  if(d.kind === "start") return {ok: true, how: "старт сценария (план execute)"};
  // ретейк: до сбора не начинается ни один шаг, даже чей источник уже снят (поодиночке не лезут);
  // сбор видят сами — стоят вместе у точки (08_retake.js, rtGather)
  if(R.setup.gather && R.gatheredT === undefined) return {};
  if(d.kind === "gather") return {ok: true, how: "собрались: " + R.gatherN + " у " + R.setup.gather.area};
  var D = d.step;
  if(!D) return {drop: "нет шага «" + d.on + "»"};
  if(D.state === "drop"){   // источник не состоялся: гранаты/вход идут без него, а ставить без входа энтри нельзя
    if(S.kind === "plant") return {drop: "шаг «" + D.actor + "» не состоялся (" + (D.why || "?") + ")"};
    return {ok: true, noSrc: true, how: "«" + D.actor + "» не состоялся (" + (D.why || "?") + ") — иду без него"};
  }
  var e = scrFind(R, b, D);
  if(e){
    if(tick < e.tick + d.pauseTicks) return {};
    return {ok: true, e: e, how: scrHow(e, D) + (d.pauseTicks ? " + пауза " + (d.pauseTicks/TICK_HZ).toFixed(1) + " с" : "")};
  }
  var arm = S.kind === "throw" ? S.arrived : S.activeT;   // занял позицию / освободился от своих прежних шагов
  if(arm === undefined) return {};
  if(R.setup.gather){   // ретейк: бросающий ещё идёт на точку — ждут его (он говорит), пока позволяет таймер бомбы
    if(rtHurry(R)) return {ok: true, timeout: true, how: "ТАЙМАУТ: до взрыва мало — идём без «" + D.actor + "»"};
    if(D.state === "wait" && (D.kind !== "throw" || D.arrived === undefined)) return {};   // источник ещё не начал
    arm = Math.max(arm, D.arrived || 0);
  }
  // вход и плант ждут, пока сценарий хоть где-то пошёл (актёр узнал хоть одно событие): стоят они где
  // стоят, и «тишина» до первого разрыва — это дорога остальных до их точек, а не сбой
  // (у ретейка «сценарий пошёл» — момент сбора: от него и отсчёт)
  if(S.kind !== "throw" && !R.setup.gather && knowEvents(b, "smoke", R.start).concat(knowEvents(b, "flash", R.start), knowEvents(b, "molly", R.start), knowEvents(b, "he", R.start)).length === 0) return {};
  var cap = Math.round(d.maxDelay * scrWaitK(b)), anchor = Math.max(knowLastEvent(b, R.start), arm, R.gatheredT || 0);
  if(tick >= anchor + d.pauseTicks + cap)
    return {ok: true, timeout: true, how: "ТАЙМАУТ: сигнала «" + D.actor + "» нет " + (tick - anchor) + " тиков (предел " + cap + ")"};
  return {};
}
// сигнал получен? записать момент и откуда актёр узнал; true — шаг можно исполнять
function scrRelease(R, S){
  if(S.rel) return true;
  var c = scrCue(R, S);
  if(c.drop){ scrDrop(R, S, c.drop); return false; }
  if(!c.ok) return false;
  S.rel = {tick: tick, how: c.how, timeout: !!c.timeout, noSrc: !!c.noSrc, evTick: c.e ? c.e.tick : null, src: c.e ? c.e.src : null};
  scrLog(R, S, "сигнал", c.how);
  return true;
}
// свои более ранние шаги этого бота важнее: он делает их по очереди
function scrActive(R, S){
  return R.steps.every(function(o){ return o.i >= S.i || o.bot !== S.bot || scrTerminal(o); });
}

// ---------- шаг в тик ----------
function scrStep(R, S){
  if(scrTerminal(S)) return;
  if(S.bot && !S.bot.alive) scrReplace(R, S);
  if(scrTerminal(S)) return;
  if(S.kind === "throw") scrThrow(R, S);
  else if(S.kind === "push") scrPush(R, S);
  else if(S.kind === "plant") scrPlant(R, S);
  else if(S.kind === "defuse") scrDefuse(R, S);
}
function scrReplace(R, S){
  var was = S.bot.id;
  if(S.kind === "defuse"){   // дефуз доделает любой живой: сигнал уже был — идёт сразу
    var nd = bomb && bomb.state === "planted" ? rtPickDefuser(R, S.bot) : null;
    if(!nd){ scrDrop(R, S, "дефузер " + was + " погиб, дефузить некому"); return; }
    S.bot = nd; S.bestD = undefined; S.pathT = undefined; S.activeT = undefined;
    scrLog(R, S, "замена", was + " погиб → " + nd.id);
    return;
  }
  if(S.state === "go"){   // уже вошёл / пошёл ставить — погиб на деле, заменять нечем
    if(S.kind === "push"){ S.state = "done"; scrLog(R, S, "погиб на входе", ""); }
    else scrDrop(R, S, "носитель погиб");
    return;
  }
  if(S.kind === "throw"){
    var c = scrChooseThrower(R, S, S.bot);
    if(!c){ scrDrop(R, S, "актёр " + was + " погиб, гранаты ни у кого"); return; }
    S.bot = c.bot; S.pick = c.pick;
  } else if(S.kind === "push"){
    var nb = scrPickEntry(R.side, S.bot);
    if(!nb){ scrDrop(R, S, "энтри " + was + " погиб, входить некому"); return; }
    S.bot = R.entry = nb;
  } else return;   // plant: носитель берётся заново в scrPlant
  S.rel = null; S.bestD = undefined; S.pathT = undefined; S.arrived = undefined; S.activeT = undefined;
  scrLog(R, S, "замена", was + " погиб → " + S.bot.id);
}
// застрял? — ближе к цели не становится и сам не двигается (путь не строится / бот упёрся);
// обход стены, когда по прямой сначала дальше, — не застрял: он идёт
function scrStuck(S, d){
  var b = S.bot, moved = S.bestX !== undefined && Math.hypot(b.x - S.bestX, b.y - S.bestY) > SCR.stuckPx;
  if(S.bestD === undefined || d < S.bestD - SCR.stuckPx || moved){ S.bestD = Math.min(d, S.bestD === undefined ? d : S.bestD); S.bestT = tick; S.bestX = b.x; S.bestY = b.y; return false; }
  return tick - S.bestT > SCR.stuckT;
}
function scrGo(S, tx, ty){
  var b = S.bot;
  b._scrT = tick; b.walking = false;   // ведёт исполнитель (дефолт T этого бота не трогает), бегом
  if(b._pathBy === "scr" && b.path.length > 0 && b.pathIdx < b.path.length) return;
  if(b._pathBy === "scr" && S.pathT !== undefined && tick - S.pathT < SCR.repath) return;
  S.pathT = tick; b._pathBy = "scr";
  b.path = buildWaypointPath(b.x, b.y, b.z || 0, tx, ty, 0); b.pathIdx = 0;
}
// бросающий выходит к лайнапу заранее — так, чтобы успеть к контрольному таймингу (дорога ×1,35 к
// прямой + SCR.lead); IGL позвал выход раньше — идёт сразу. До этого он в дефолте (12_t_default.js)
function scrTimeToGo(R, S){
  if(R.started) return true;
  var b = S.bot, f = S.pick.from;
  var due = roundStartTick + Math.round(R.setup.timing.startSec*TICK_HZ);
  var travel = Math.hypot(b.x - f.x, b.y - f.y)*1.35/SPEED*TICK_HZ + SCR.lead*TICK_HZ;
  return tick >= due - travel;
}

function scrThrow(R, S){
  var b = S.bot;
  if(!scrActive(R, S)) return;
  if(!scrTimeToGo(R, S)) return;                   // ещё рано — играет дефолт
  var released = R.started && scrRelease(R, S);   // до execute — только занять точку броска
  if(scrTerminal(S)) return;
  var f = S.pick.from;
  var dist = Math.hypot(b.x - f.x, b.y - f.y);
  if(dist > SCR.arriveR){
    if(scrStuck(S, dist)){ scrDrop(R, S, "застрял на пути к точке броска (осталось " + Math.round(dist) + " px)"); return; }
    scrGo(S, f.x, f.y);
    return;
  }
  b._scrT = tick;   // стоит на лайнапе — это исполнитель
  if(S.arrived === undefined){ S.arrived = tick; scrLog(R, S, "на точке", S.pick.src + (released ? "" : ", ждёт сигнала")); }
  if(!released) return;
  if(tick < (b.throwUntil || 0) || tick < (b.blindUntil || 0)) return;
  var why = NADE[S.ntype].name + " " + (S.zone ? knowZoneName(S.zone) : "") + " — " + S.rel.how;
  if(!throwNade(b, S.ntype, S.pick.to.x, S.pick.to.y, true, why)){ scrDrop(R, S, "гранаты нет"); return; }
  S.state = "done";
  scrLog(R, S, "бросил", why + " [" + S.pick.src + "]");
}

function scrPush(R, S){
  var b = S.bot, site = SITES[S.st.target];
  if(S.state === "wait"){
    if(!R.started || !scrActive(R, S)) return;   // энтри до execute стоит, где стоит
    if(S.activeT === undefined) S.activeT = tick;
    if(!scrRelease(R, S)) return;
    if(scrTerminal(S)) return;
    if(!site){ scrDrop(R, S, "нет сайта «" + S.st.target + "»"); return; }
    S.state = "go"; b.pushTick = tick; b.pushSite = S.st.target;
    scrLog(R, S, "заходит", "на " + S.st.target + " — " + S.rel.how);
  }
  if(bombSiteAt(b.baseX, b.baseY) === S.st.target){ S.state = "done"; scrLog(R, S, "на сайте", S.st.target); return; }
  if(scrStuck(S, Math.hypot(b.x - site.x, b.y - site.y))){ scrDrop(R, S, "застрял на пути к сайту"); return; }
  scrGo(S, site.x, site.y);
}

function scrPlant(R, S){
  var carried = bomb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive;
  if(S.state === "wait"){
    if(!carried){ scrDrop(R, S, "бомбы нет у живого"); return; }
    if(S.bot !== bomb.carrier){ S.bot = bomb.carrier; S.rel = null; }   // бомбу подобрал другой — решает уже он
    if(!R.started || !scrActive(R, S)) return;
    if(S.activeT === undefined) S.activeT = tick;
    if(!scrRelease(R, S)) return;
    if(scrTerminal(S)) return;
    S.state = "go";
    scrLog(R, S, "идёт ставить", "на " + S.st.target + " — " + S.rel.how);
  }
  var b = S.bot, site = SITES[S.st.target];
  if(bomb.state === "planted" || b.planting){ S.state = "done"; return; }
  if(!carried || bomb.carrier !== b){ scrDrop(R, S, "носитель потерял бомбу"); return; }
  if(bombSiteAt(b.baseX, b.baseY) === S.st.target){
    if(bombStartPlant(b)){ S.state = "done"; scrLog(R, S, "ставит бомбу", S.st.target); }
    return;
  }
  if(scrStuck(S, Math.hypot(b.x - site.x, b.y - site.y))){ scrDrop(R, S, "застрял на пути к сайту"); return; }
  scrGo(S, site.x, site.y);
}

// дефуз (ретейк): дефузер ждёт входа энтри (свой сигнал), идёт к бомбе и дефузит; пока дефузит —
// его ведёт исполнитель (стоит). Обезвредил — раунд кончается сам (05_bomb.js)
function scrDefuse(R, S){
  var b = S.bot;
  if(!bomb || bomb.state !== "planted"){
    if(bomb && bomb.state === "defused") S.state = "done"; else scrDrop(R, S, "бомбы нет");
    return;
  }
  if(S.state === "wait"){
    if(!scrActive(R, S)) return;
    if(S.activeT === undefined) S.activeT = tick;
    if(!scrRelease(R, S)) return;
    if(scrTerminal(S)) return;
    S.state = "go";
    scrLog(R, S, "идёт дефузить", S.rel.how);
  }
  b._scrT = tick; b._rtLook = [bomb.x, bomb.y];
  if(b.defusing) return;
  var d = Math.hypot(b.baseX - bomb.x, b.baseY - bomb.y);
  if(d <= 40){
    if(bombStartDefuse(b)) scrLog(R, S, "дефузит", b.kit ? "с китом" : "без кита");
    return;
  }
  if(scrStuck(S, d)){ scrDrop(R, S, "застрял на пути к бомбе"); return; }
  scrGo(S, bomb.x, bomb.y);
}

function scrDrop(R, S, why){
  S.state = "drop"; S.why = why;
  scrLog(R, S, "снят", why);
}
function scrEnd(R, why){
  R.steps.forEach(function(S){ if(!scrTerminal(S)){ S.state = "drop"; S.why = why; scrLog(R, S, "снят", why); } });
  R.over = true;
  var n = R.steps.filter(function(S){ return S.state === "done"; }).length, sk = R.steps.filter(function(S){ return S.state === "skip"; }).length;
  scrLog(R, null, "конец", "сделано " + n + " из " + (R.steps.length - sk) + " шагов" + (sk ? " (вне сценария: " + sk + ")" : "") + "; " + why);
}
function scrLog(R, S, ev, why){
  var r = {tick: tick, sec: +((tick - roundStartTick)/TICK_HZ).toFixed(1), round: roundNum, side: R.side, setup: R.setup.id,
           step: S ? S.i : null, actor: S ? S.actor : "—", act: S ? S.st.action : "", who: S && S.bot ? S.bot.id : null,
           ev: ev, why: why || "", rel: S && S.rel ? {tick: S.rel.tick, timeout: S.rel.timeout, noSrc: S.rel.noSrc, evTick: S.rel.evTick, src: S.rel.src} : null};
  SCR_LOG.push(r);
  logEvent("Сценарий " + R.side + (S ? " · " + S.actor + (S.bot ? " (" + S.bot.id + ")" : "") : "") + ": " + ev + (why ? " — " + why : ""), "info");
}
