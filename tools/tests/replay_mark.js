// Повтор после открытия снимка отметки (п.18/22/34): доиграть раунд с записью, как в кадре, и показать, что попало в очередь показа
// и куда пошёл бы каждый показ (клип / реакции). node tools/mark_open.js sim.html снимок.json "$(cat tools/tests/replay_mark.js)"
(function(){
  var r0 = roundNum, g = 0;
  while(g++ < 20000 && roundNum === r0 && roundState !== "freeze"){ stepTick(); rpRecord(); }
  var R = RP.last; if(!R || R.round !== r0) return JSON.stringify({round: r0, list: null});
  // показ — тем же rpPlay, что и в игре: не начался / клип / сразу реакции (кусков нет)
  var out = (R.list || []).map(function(h){ R.clutch = h; var ok = rpPlay(R), P = RP.P;
    var show = !ok ? "нет" : P.segs.length ? "клип" : "реакции"; var title = ok ? document.querySelector(".rp-t2") : null;
    if(RP.on) rpEnd();
    return {id: h.id, side: h.side, multi: !!h.multi, n: h.n, alive: h.alive, show: show, title: title ? title.textContent : null}; });
  return JSON.stringify({round: r0, t0: R.t0, win: R.win, kills: R.kills.length, list: out});
})()
