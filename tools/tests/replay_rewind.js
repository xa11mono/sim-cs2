// Регрессия п.18/22/34 (владелец 29.10): после перемотки запись раунда начинается заново, фраги до неё — не моменты повтора;
// мультикилл без кадров не уходит в экран реакций «клатч 1vN».
// node src/q.js sim.html @tools/tests/replay_rewind.js   → JSON {ok, ...}
freshMatch(3);
var out = {}, guard = 0;
// играем, пока у кого-то в раунде не будет 2 фрагов (запись — как в кадре, rpRecord)
while(guard++ < 60000){
  stepTick(); rpRecord();
  var kc = {}; RP.rec && RP.rec.kills.forEach(function(k){ if(k.att && k.attTeam !== k.vicTeam) kc[k.att] = (kc[k.att]||0) + 1; });
  var two = Object.keys(kc).filter(function(id){ return kc[id] >= 2; })[0];
  if(two && roundState === "live"){ out.att = two; break; }
}
out.round = roundNum; out.tick = tick; out.killsBefore = RP.rec.kills.length;
// полная запись: тот же 2к показывается клипом (регрессия — не должен пропасть)
var Rf = RP.rec; Rf.end = tick; Rf.clutch = {id: out.att, side: teamBot(out.att).team, multi: true, n: 2, t: Rf.t0, alive: true, hp: 100, kills: 2};
out.fullPlayed = rpPlay(Rf); out.fullSegs = RP.P ? RP.P.segs.length : 0; if(RP.on) rpEnd();
// «перемотка»: запись раунда заново с текущего тика (как rpRecord при tick < последнего кадра)
RP.rec = null; for(var i = 0; i < 3; i++){ stepTick(); rpRecord(); }
out.killsAfterRewind = RP.rec.kills.filter(function(k){ return k.t < RP.rec.t0; }).length;
// мультикилл без кадров: показать нечего
var R = RP.rec; R.end = tick; R.list = null;
R.clutch = {id: out.att, side: teamBot(out.att) ? teamBot(out.att).team : "T", multi: true, n: 2, t: R.t0 - 100, alive: true, hp: 100, kills: 2};
R.kills = [{t: R.t0 - 100, att: out.att, vic: "x", attTeam: "T", vicTeam: "CT"}, {t: R.t0 - 50, att: out.att, vic: "y", attTeam: "T", vicTeam: "CT"}];
var played = rpPlay(R);
out.multiNoFramesPlayed = played; out.mode = RP.P ? RP.P.mode : null;
if(RP.on) rpEnd();
out.ok = out.killsAfterRewind === 0 && played === false && out.fullPlayed === true && out.fullSegs > 0;
JSON.stringify(out)
