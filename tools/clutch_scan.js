// (v459) Найти раунды с выигранным клатчем 1vN (N ≥ 2): матч, раунд, кто, против скольких, чем кончился.
// Игру не меняет (обёртки только читают). Нужен для проверки повтора клатча (675_replay.js).
//   node src/q.js sim.html "$(sed 's/__M__/3/' tools/clutch_scan.js)"
paused = true; freshMatch(__M__);
var M0 = matchNum, OUT = [], oer = endRound;
endRound = function(w, reason){
  var c = clutchInfo;
  if(c && w && c.team === w && c.n >= 2){
    var me = teamBot(c.id);
    OUT.push({match: M0, round: roundNum, id: c.id, nick: nick(c.id), team: TEAM_NAME[c.team], side: c.team, n: c.n, reason: reason,
      alive: !!(me && me.alive), kills: me ? (me.roundKills||0) : 0, hp: me ? me.hp : 0, startTick: roundStartTick, endTick: tick});
  }
  return oer.apply(this, arguments);
};
for(var t = 0; t < 400000; t++){ stepTick(); if(matchNum !== M0) break; }
JSON.stringify(OUT)
