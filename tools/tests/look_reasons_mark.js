// Взгляд живых игроков стороны SIDE после открытия снимка: причина взгляда (lookReason) и куда (зона), раз в 16 тиков N тиков.
// node tools/mark_open.js sim.html снимок.json "var SIDE='CT', N=64; $(cat tools/tests/look_reasons_mark.js)"
(function(){
  var o = [];
  for(var t = 0; t <= N; t++){ if(t) stepTick(); if(t % 16) continue;
    o.push(tick + " " + bots.filter(function(b){ return b.team === SIDE && b.alive; }).map(function(b){
      var f = b.facing, px = b.x + Math.cos(f)*300, py = b.y + Math.sin(f)*300;
      return nick(b.id) + "@" + calloutName(b.x, b.y).replace(/на «|»/g, "") + ":" + b.lookReason + "→" + calloutName(px, py).replace(/на «|»/g, ""); }).join(" | ")); }
  return o.join("\n");
})()
