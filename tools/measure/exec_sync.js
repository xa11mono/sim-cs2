// (тактика 30.10) Синхронизация выхода T с гранатами и время полёта гранат — по раундам матча.
// Запуск: node src/q.js sim.html "$(sed 's/__M__/3/;s/__R__/8/' tools/measure/exec_sync.js)" > out.json
// __M__ — матч, __R__ — до какого раунда (включительно). Ответ (JSON):
//   flights: [[тип, с полёта, px от бросавшего, лайнап 0/1, команда, зачем]]           — все сработавшие гранаты
//   rounds:  [{r, site, exec: тик выхода | null, late, items: [записи 366], ev: [события 366], early: критичных не готово на выходе}]
//   flashes: [[тик хлопка «под пик», тик первого шага энтри на сайт]] — флешка под пик и заход энтри
//   generic: [{r, site, exec, smokes: [[тик срабатывания, тик «дым раскрыт» (+40), px от сайта, зачем]]}] — то же для любой версии игры
//   (база без 366): смоки T у сайта выхода (≤ 900 px от центра) за 15 с до выхода и 10 с после
freshMatch(__M__);
var M0 = matchNum, OUT = {flights: [], rounds: [], flashes: [], generic: []}, lastR = null, SM = [], EXT = null, EXS = null;
var odt = detonate; detonate = function(n){
  if(n.type === "smoke" && n.team === "T") SM.push([tick, tick + 40, n.x, n.y, String(n.why).slice(0, 40)]);
  OUT.flights.push([n.type, +((tick - n.born)/TICK_HZ).toFixed(2), Math.round(Math.hypot(n.x-n.ox, n.y-n.oy)), n.lob ? 1 : 0, n.team, String(n.why).slice(0, 40)]);
  return odt.apply(this, arguments); };
function flushRound(){
  if(lastR && EXT != null){ var Sx = SITES[EXS];
    OUT.generic.push({r: lastR, site: EXS, exec: EXT, smokes: SM.filter(function(q){ return Math.hypot(q[2]-Sx.x, q[3]-Sx.y) <= 900 && q[0] >= EXT - 15*TICK_HZ && q[0] <= EXT + 10*TICK_HZ; })
      .map(function(q){ return [q[0], q[1], Math.round(Math.hypot(q[2]-Sx.x, q[3]-Sx.y)), q[4]]; })}); }
  SM = []; EXT = null; EXS = null;
  if(typeof EXU === "undefined" || !EXU || !lastR) return;
  var ex = EXU.ev.filter(function(e){ return e.kind === "exec"; })[0] || null;
  var items = Object.keys(EXU.items).map(function(k){ var it = EXU.items[k];
    return {id: it.id, crit: it.crit, why: it.why, state: it.state, owner: it.owner, at: it.at, thrownAt: it.thrownAt || null, eta: it.eta || null,
            detAt: it.detAt || null, useAt: it.useAt || null, err: it.err == null ? null : it.err, fail: it.failWhy || null, re: it.re}; });
  // на выходе: критичный смок этого сайта, который к тику выхода не готов (не «ready» и не брошен провалом-без-замены раньше)
  var early = ex ? items.filter(function(it){ return it.crit && (it.useAt == null || it.useAt > ex.t) && !(it.fail && it.at <= ex.t) && it.at <= ex.t; }).length : null;
  OUT.rounds.push({r: lastR, site: ex ? ex.site : null, exec: ex ? ex.t : null, late: ex ? !!ex.late : null, items: items, ev: EXU.ev, early: early});
}
var popT = null, entT = null;
for(var t = 0; t < 400000; t++){
  stepTick();
  if(matchNum !== M0 || roundNum > __R__) break;
  if(lastR !== roundNum){ flushRound(); lastR = roundNum; popT = null; entT = null; }
  if(EXT == null && teamTac.T && teamTac.T.phase === "execute"){ EXT = tick; EXS = teamTac.T.site; }
  if(nadeFlags.peekFlashPop && popT !== nadeFlags.peekFlashPop){ popT = nadeFlags.peekFlashPop; }
  if(popT && entT == null && teamTac.T && SITES[teamTac.T.site]){
    var S = SITES[teamTac.T.site], e = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole === "entry"; })[0];
    if(e && onSite(S, e.x, e.y)){ entT = tick; OUT.flashes.push([popT, entT]); }
  }
}
flushRound();
JSON.stringify(OUT)
