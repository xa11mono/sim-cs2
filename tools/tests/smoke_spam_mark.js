// п.15: кто и когда простреливает дым после открытия снимка (b._spam появляется) — N тиков вперёд.
// node tools/mark_open.js sim.html снимок.json "$(cat tools/tests/smoke_spam_mark.js)"
(function(){
  var N = (typeof SPAM_N !== "undefined" ? SPAM_N : 6*TICK_HZ), out = [], had = {};
  for(var t = 0; t < N; t++){ stepTick();
    bots.forEach(function(b){ var on = !!(b.alive && b._spam); if(on && !had[b.id]) out.push({t: tick, id: b.id, nick: nick(b.id), seen: !!b._spam.seen}); had[b.id] = on; }); }
  return JSON.stringify({from: tick - N, spam: out});
})()
