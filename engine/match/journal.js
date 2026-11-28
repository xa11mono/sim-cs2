// [хозяева: bombBeepTick, feedBombKill, feedEvent, feedKill, logEvent, showEv, soundEv, voiceFeed, voiceKind] (17.11, перестройка — показ отдельно от симуляции) ЖУРНАЛ МАТЧА — данные игры, не показ: строки консоли (logEvent), войса
// (voiceFeed), киллфида (feedKill, feedBombKill, feedEvent; в feedKill — и знание о смерти, ассист, клатч), «клатч» (clutchInfo читает
// тактика T, 130), серия карт (SERIES). Показ (440 консоль и войс, 630 киллфид, 680 кадр) только рисует: «есть новое» — VOICE_DIRTY,
// LOG_DIRTY, KF_DIRTY; разовые события показа (звук, баннер, карточка раунда, вспышка кромки, закупка на панели) — очередь SHOW_Q
// (showEv / soundEv), её разбирает кадр (680 showSync). Перенесено дословно из 440, 630, 640; инструменты замеров цепляются к тем же
// именам (feedKill, logEvent, voiceFeed). Без кадра (замеры в Node) очередь не растёт больше SHOW_Q_MAX
var SHOW_Q = [], SHOW_Q_MAX = 256, KF_DIRTY = false;
function showEv(){ SHOW_Q.push(Array.prototype.slice.call(arguments)); if(SHOW_Q.length > SHOW_Q_MAX) SHOW_Q.shift(); }
function soundEv(){ showEv.apply(null, ["snd"].concat(Array.prototype.slice.call(arguments))); }
// Идентификатор строки в своём журнале сохраняется при копировании кадра и снимка.
function showStamp(entry, prev){
  entry.rt = tick;
  entry.seq = prev && prev.rt === tick ? prev.seq + 1 : 0;
  return entry;
}
var SERIES = {bo:3, maps:{}};
function seriesNew(bo){ SERIES = {bo:bo, maps:{}}; }   // (Р5, 27.11) новая серия — команда показа (выбор Bo, «новый матч»)
var TEAM_LOG = {round: -1, log: []};   // (v566) решения команд за раунд — журнал; рисует «Разбор команды» (team)
var VOICE_DIRTY = false, LOG_DIRTY = false;

var voiceLines = [];
var VOICE_KIND = {death:"death", plant:"bomb", defuse:"bomb", igl:"plan", see:"see", hear:"hear", script:"nade", flash:"nade"};
// старые коллы v166 (voiceLog) — тип по ключу колла
var VOICE_KEYS = {
  bomb: "bomb bombseen bombw bombrot antidef stop pass ninja deflate dffake dfreal covplant fakeplant alldead",
  see:  "clr clz hurt fin eg rpfast mo midback rotread s sh buy antiawp prt afall presave nostop midtake",
  hear: "zoom rl rushm",
  nade: "awps defsmk hesm hesmk hestack hefin pop psm rtflash rtawp sflash mflash molly early fb tfb dump",
  self: "clutch clutchpos clutchsw tcl tcpp tsave lowhp awpsave awpsaveT midcare rebalOff back cb cov pphold egw",
  plan: "abort allin assist fake fakeworked flank midcover pick reb rebal regroup rgo ppsplit pptime probe saferot solo sv trade upslow rtentry die"
};
var VOICE_KEY_KIND = {};
Object.keys(VOICE_KEYS).forEach(function(k){ VOICE_KEYS[k].split(" ").forEach(function(key){ VOICE_KEY_KIND[key] = k; }); });
function voiceKind(key, text){
  if(/^минус/.test(text)) return "death";
  // (v323, М34) переколл — смена сайта (CT и T): свой цвет
  if(/ПЕРЕКОЛЛ/.test(text) || /^(reb|abort|allin)/.test(String(key))) return "recall";
  // ключ колла = имя + id/зона («hurtCT1», «solo2») — берём самое длинное известное имя в начале
  var k = String(key), best = "";
  for(var name in VOICE_KEY_KIND) if(name.length > best.length && k.lastIndexOf(name, 0) === 0) best = name;
  return VOICE_KEY_KIND[best] || "plan";
}

function voiceFeed(team, who, text, kind){ var _ev = simEvIn("voiceFeed", arguments);
  if(!SIM_SHOW) return simEvOut(_ev);   // (Р5.2) строки войса — только если их кто-то показывает (страница, Worker страницы); в Node — нет
  var sec = roundState === "live" ? Math.max(0, ROUND_TIME_SEC - (simTime - roundStartTime)) : ROUND_TIME_SEC;   // как таймер табло
  var planted = typeof bomb !== "undefined" && bomb && bomb.state === "planted";
  voiceLines.unshift(showStamp({t: planted ? "💣" : Math.floor(sec/60)+":"+("0"+Math.floor(sec%60)).slice(-2), team: team,
                      who: who && who !== team ? nick(who) : "колл", text: nickify(text), kind: kind}, voiceLines[0]));
  if(voiceLines.length > 60) voiceLines.length = 60;
  VOICE_DIRTY = true;   // (15.11, перестройка: показ отдельно от симуляции) рисует кадр (app), не симуляция
 simEvOut(_ev);}

function logEvent(text, isKill){ var _ev = simEvIn("logEvent", arguments);
  text = nickify(text);
  events.unshift({t: simTime.toFixed(1), text: text, kill: !!isKill});
  // (v566) решения команд за раунд — для «Разбора команды» (team)
  if(/^(IGL|T:|CT:|CT |T )/.test(text)){ if(TEAM_LOG.round !== roundNum){ TEAM_LOG.round = roundNum; TEAM_LOG.log = []; }
    TEAM_LOG.log.push({s: roundState === "live" ? Math.round(simTime - roundStartTime) : 0, text: text}); if(TEAM_LOG.log.length > 40) TEAM_LOG.log.shift(); }
  if(events.length > 40) events.length = 40;
  LOG_DIRTY = true;   // (15.11, перестройка) консоль рисует кадр (app): logRender
 simEvOut(_ev);}

var clutchShown = null, clutchInfo = null;

// (v241) киллфид как в CS2 (из переделки): иконка оружия, ассист (40+ урона или флешка), значки
// «в голову», «убийца ослеплён». wkey — ключ WEAPONS, "HE", "MOLOTOV" или "KNIFE"
// (v518d, владелец 09.11) ассист — тот, кто нанёс убитому ≥ ASSIST_DMG (как в CS2 — от 26) или ослепил его своей флешкой, кроме самого убийцы.
// Урон по убитому в _dmgBy — только от его врагов, поэтому при убийстве своего («враг ранил на 30, karrigan случайно добил TeSeS») ассист — враг,
// и в киллфиде он цветом своей команды: «karrigan (CT) + donk (T) → TeSeS». Убийце фраг за своего не идёт (damage), ассист идёт в счёт ассистенту
var ASSIST_DMG = 26;
function killAssist(att, vic){
  var best = null, bd = ASSIST_DMG - 1, D = vic._dmgBy || {};
  for(var id in D) if((!att || id !== att.id) && D[id] > bd){ bd = D[id]; best = id; }
  var fb = vic._blindBy && vic.blindUntil > tick && (!att || vic._blindBy !== att.id) ? teamBot(vic._blindBy) : null;
  if(!best && fb && fb.team !== vic.team) best = fb.id, fb = true; else fb = false;
  var o = best ? teamBot(best) : null; if(!o) return null;
  return {id:best, flash:fb, team:o.team};
}
// ---- (Р0.4, 24.11) события симуляции ТОЛЬКО НА ЧТЕНИЕ: инструменты (отпечаток, запись матча, инварианты, след) подписываются здесь,
// а не подменяют функции игры (с модулями и TS подмена перестаёт работать). Точки: feedKill, logEvent, voiceFeed (journal), endRound (round),
// throwNade (throw), tryShoot (shoot), detonate, applyDamage (damage), exuEv (exec-sync), setPost (task), tSetSite (igl) — вход ('in', аргументы) и выход
// ('out', аргументы, результат, то, что подписчик вернул на входе). Результат функции не меняется; ошибка подписчика игру не трогает
// (копится в simEvIn.errs). Нет подписчиков — один пустой вызов. Подписчик не пишет в состояние игры (правило: rebuild/MASTER_PLAN.md, Р0.4).
function simEvOn(name, fn){ var H = simEvIn.h || (simEvIn.h = {}); (H[name] = H[name] || []).push(fn); return fn; }
function simEvIn(name, args){
  var H = simEvIn.h, L = H && H[name]; if(!L) return null;
  var c = {name: name, args: args, saved: []};
  for(var i = 0; i < L.length; i++){ try{ c.saved[i] = L[i]("in", args); }catch(e){ (simEvIn.errs = simEvIn.errs || []).push(name + ": " + e); } }
  return c;
}
function simEvOut(c, r){
  if(c){ var L = simEvIn.h[c.name]; for(var i = 0; i < L.length; i++){ try{ L[i]("out", c.args, r, c.saved[i]); }catch(e){ (simEvIn.errs = simEvIn.errs || []).push(c.name + ": " + e); } } }
  return r;
}
function feedKill(att, vic, wkey, hs, mods){ var _ev = simEvIn("feedKill", arguments);
  mods = mods || {};
  teamDeath(att, vic);   // до киллфида в знании: видел убийцу — успевает сказать, откуда
  knowKill(att, vic);
  var as = killAssist(att, vic); if(as){ var ab = teamBot(as.id); if(ab) ab.assists = (ab.assists||0) + 1; }   // (v518d) ассист — в счёт
  killfeed.unshift(showStamp({kind:"kill", att:att?nick(att.id):"?", attTeam:att?att.team:"", as:as?nick(as.id):null, asFlash:as&&as.flash, asTeam:as?as.team:"",
    vic:nick(vic.id), vicTeam:vic.team, w:wkey, hs:hs, smoke:!!mods.smoke, wall:!!mods.wall, noscope:!!mods.noscope, blind:!!mods.blind, tk:!!mods.tk, t:nowTs, at:simTime}, killfeed[0]));
  if(killfeed.length > 8) killfeed.length = 8;
  KF_DIRTY = true;   // (17.11) киллфид рисует кадр (app)
  // мультикилл-баннер
  if(att && att.team !== vic.team && att.roundKills >= 2){
    var lbl = ["", "", "2K", "3K", "4K", "ACE"][Math.min(5, att.roundKills)];
    showEv("banner", (att.roundKills >= 5 ? "ACE — " : lbl+" — ")+nick(att.id), att.team, 2200);
  }
  checkClutch();
 simEvOut(_ev);}

// (v288) смерть от взрыва бомбы — строка киллфида без убийцы (как в CS2): иконка C4 и жертва. Только показ —
// знание и войс бомбовой смерти идут как раньше (feedKill не зовётся)
function feedBombKill(vic){
  killfeed.unshift(showStamp({kind:"kill", att:null, attTeam:"", as:null, vic:nick(vic.id), vicTeam:vic.team, w:"C4", t:nowTs, at:simTime}, killfeed[0]));
  if(killfeed.length > 8) killfeed.length = 8;
  KF_DIRTY = true;
}
function feedEvent(kind, text){
  killfeed.unshift(showStamp({kind:kind, text:nickify(text), t:nowTs, at:simTime}, killfeed[0]));
  if(killfeed.length > 8) killfeed.length = 8;
  KF_DIRTY = true;
}

// клатч: один игрок против двух и больше — подсвечиваем, пока не решится
function checkClutch(){
  if(roundState !== "live") return;
  ["CT","T"].forEach(function(team){
    var mine = bots.filter(function(b){ return b.team===team && b.alive; });
    var theirs = bots.filter(function(b){ return b.team!==team && b.alive; });
    // Клатч объявляется, только если он ВЫИГРАН (см. showRoundCard); здесь —
    // тихо запоминаем ситуацию: кто остался один и против скольких (максимум)
    if(mine.length === 1 && theirs.length >= 2){
      if(!clutchInfo || clutchInfo.id !== mine[0].id) clutchInfo = {id:mine[0].id, team:team, n:theirs.length};
      else clutchInfo.n = Math.max(clutchInfo.n, theirs.length);
    }
  });
}

// (17.11) клатч выигран — запись в журнал и баннер (было внутри карточки раунда, 630 showRoundCard)
function roundClutchResult(winner){
  var clutch = clutchInfo && winner && clutchInfo.team === winner;
  if(clutch){
    clutchShown = clutchInfo.id;
    showEv("banner", "КЛАТЧ 1v"+clutchInfo.n+" — "+clutchInfo.id+"!", winner, 3200);
    logEvent("Клатч выигран: "+clutchInfo.id+" (1v"+clutchInfo.n+")", true);
    feedEvent("clutch", "Клатч 1 на "+clutchInfo.n+" — "+clutchInfo.id);
  }
}
// (17.11) расписание писка бомбы — в тике (tick), как было; звук и вспышка кромки — события показа (перенесено из 680)
var BEEP_NEXT = 0;
// (v553, владелец 11.11, запись «звук, когда бомба вот-вот взорвётся») последние C4_FINAL_SEC до взрыва — эта запись (её длина — 1,28 с: кончается
// со взрывом), обычный писк в это время молчит
var C4_FINAL_SEC = 1.28, BEEP_FINAL = null;
function bombBeepTick(){
  if(!bomb || bomb.state !== "planted"){ BEEP_NEXT = 0; BEEP_FINAL = null; return; }
  var left = bombTimeLeftTicks()/TICK_HZ;
  if(left <= C4_FINAL_SEC){ if(BEEP_FINAL !== bomb.plantTick){ BEEP_FINAL = bomb.plantTick; soundEv("sndBomb", "final", bomb.x, bomb.y); } return; }
  if(tick < BEEP_NEXT) return;
  var gap = Math.max(0.1, Math.min(1, 0.1 + 0.9*left/40));
  BEEP_NEXT = tick + Math.round(gap*TICK_HZ);
  soundEv("sndBomb", "beep", bomb.x, bomb.y);
  showEv("bombPulse", gap);
}
