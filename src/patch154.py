# v152 шаг 1: воспроизводимый матч.
# freshMatch(n) — матч с номером n всегда с одного и того же чистого состояния:
# tick = 0, никакой памяти прошлых матчей/профиля, пустые кэши и следы.
rep("""function newMatch(){
  matchNum++;""","""// (v152) воспроизводимый старт: всё, что влияет на решения ботов, — с нуля.
// Кэши чистим целиком: часть ключей содержит tick, и после сброса tick старые
// записи прошлого матча подставлялись бы в новый.
function freshMatch(n, keepProfile){
  paused = true;
  tick = 0; simTime = 0; roundStartTick = 0;
  if(!keepProfile) OPP = null;
  var clr = function(o){ for(var k in o) delete o[k]; };
  [spotCache, OUTWARD_CACHE, _ED, EWL, APPEAR, HOLD_CANDS, nadeFlags, comboCd, siteHeatPending].forEach(function(o){ if(o) clr(o); });
  nadeLandHistory = {A:[], B:[]};
  commQueue = []; tracers.length = 0; soundPings.length = 0; nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0;
  groundWeapons.length = 0; events.length = 0; killfeed.length = 0;
  CLEARZ = {CT:{}, T:{}}; LAST_CLEAR = {CT:{}, T:{}};
  if(typeof beliefReset === "function") beliefReset();
  if(typeof lkpReset === "function") lkpReset();
  clutchInfo = null;
  nadeReactCd = {CT:0, T:0}; awpSmokeCd = {CT:0, T:0};
  teamEco = { CT: {lossLevel: 1, roundType: "pistol", lastIncome: 0}, T: {lossLevel: 1, roundType: "pistol", lastIncome: 0} };
  // бот — как при загрузке страницы: лишние поля (накопленные за прошлые матчи)
  // удаляем, простые значения возвращаем к исходным
  bots.forEach(function(b, i){
    var I = BOT_INIT[i] || {};
    for(var k in b){ if(!(k in I.keys)) delete b[k]; else if(k in I.vals) b[k] = I.vals[k]; }
  });
  matchNum = n - 1;
  newMatch();
}
function newMatch(){
  matchNum++;""")
rep("""window.__ev=function(src){return eval(src);};
requestAnimationFrame(frame);""","""var BOT_INIT = bots.map(function(b){ var o = {keys:{}, vals:{}}; for(var k in b){ o.keys[k] = 1; var v = b[k]; if(v === null || (typeof v !== "object" && typeof v !== "function")) o.vals[k] = v; } return o; });
window.__ev=function(src){return eval(src);};
requestAnimationFrame(frame);""")
rep("""    <button id="btnRestartRound" title="Немедленно сбросить текущий раунд — на случай если боты застряли">Рестарт раунда</button>""","""    <button id="btnRestartRound" title="Немедленно сбросить текущий раунд — на случай если боты застряли">Рестарт раунда</button>
    <span class="chk" title="Матч с одним номером всегда проходит одинаково. Увидел баг — запиши номер матча и тик, введи номер и нажми «Сыграть»: матч повторится с начала">матч № <input id="inpMatchNum" type="number" min="1" value="1" style="width:52px"> <button id="btnFreshMatch">Сыграть</button> <span id="matchTick" style="opacity:.75"></span></span>""")
rep("""var BOT_INIT = bots.map(""","""document.getElementById("btnFreshMatch").addEventListener("click", function(){ var n = Math.max(1, parseInt(document.getElementById("inpMatchNum").value, 10) || 1); freshMatch(n); paused = false; var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); } logEvent("Матч №"+n+" с чистого листа (воспроизводимый)", true); });
setInterval(function(){ var el = document.getElementById("matchTick"); if(el) el.textContent = "· сейчас матч "+matchNum+", тик "+tick; }, 250);
var BOT_INIT = bots.map(""")
