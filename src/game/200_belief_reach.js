// ======================= РАЗДЕЛ 13: КАРТА ВЕРОЯТНОСТЕЙ ВРАГА =======================
// Для каждой команды и КАЖДОГО врага отдельно — распределение "где он может
// быть" по ~60 зонам карты (ZONEMAP). Это то, что в голове у игрока: "одного
// видели на А 10с назад — он уже мог дойти до мида или до Б, но не до КТ-спавна,
// потому что оттуда смотрит наш тиммейт".
//  • Движение: раз в 0.25с вероятность перетекает в соседние зоны (враг бежит).
//  • Видимость своих = отрицательная информация: зона, на которую смотрит
//    живой тиммейт и где врага НЕ видно, почти обнуляется, и масса уходит в
//    зоны, которые никто не видит ("там, где он быть не может, не ищем").
//  • Вижу / слышу / бросок гранаты — вероятность стягивается в эту зону.
//  • Погиб тиммейт, а стрелявшего не видели — масса растекается в зоны,
//    ОТКУДА простреливается место смерти (таблица опасности раздела 2).
//  • Убитый враг из карты убирается; в начале раунда враг — на своём спавне.
// Отсюда считаются: сколько врагов вероятно у сайта (колл и число ротирующих),
// куда смотреть, стоя на посту, и не открыта ли точка под два опасных угла.
var BZ = {ids:[], idx:{}, nbr:[], cent:[], grid:{}, siteZ:{A:[],B:[]}, midZ:[]};
function beliefBuild(){
  _zbnCache = {};   // (v334) кэш «зоны по названию» мог заполниться пустыми ответами до графа зон — на Mirage расстановки CT не находили ни одной зоны
  BZ.ids = ZONEMAP.zones.map(function(z){ return z.id; });
  BZ.idx = {}; BZ.ids.forEach(function(id,i){ BZ.idx[id] = i; });
  BZ.nbr = BZ.ids.map(function(){ return []; });
  ZONEMAP.portals.forEach(function(p){
    var a = BZ.idx[p.a], b = BZ.idx[p.b]; if(a === undefined || b === undefined || a === b) return;
    if(BZ.nbr[a].indexOf(b) < 0) BZ.nbr[a].push(b);
    if(BZ.nbr[b].indexOf(a) < 0) BZ.nbr[b].push(a);
  });
  BZ.cent = BZ.ids.map(function(id){ return ZONE_CENTROIDS[id]; });
  BZ.grid = {};
  ["A","B"].forEach(function(k){
    BZ.siteZ[k] = [];
    if(!SITES[k]) return;
    BZ.cent.forEach(function(c,i){ if(Math.hypot(c.x-SITES[k].x, c.y-SITES[k].y) < 240 || bzOf(SITES[k].x, SITES[k].y) === i) BZ.siteZ[k].push(i); });
    BZ.siteNear = BZ.siteNear || {}; BZ.siteNear[k] = [];
    BZ.cent.forEach(function(c,i){ if(Math.hypot(c.x-SITES[k].x, c.y-SITES[k].y) < 400) BZ.siteNear[k].push(i); });
  });
  BZ.midZ = [];
  if(GEO.ctMid) BZ.cent.forEach(function(c,i){ if(Math.hypot(c.x-GEO.ctMid.x, c.y-GEO.ctMid.y) < 260) BZ.midZ.push(i); });
  BZ.DT = null; if(typeof OUTWARD_CACHE !== "undefined") OUTWARD_CACHE = {};
}
function bzDist(src){
  var n = BZ.ids.length, D = new Float32Array(n).fill(1e9), done = new Uint8Array(n);
  src.forEach(function(i){ D[i] = 0; });
  for(var it=0; it<n; it++){
    var u = -1, bd = 1e9;
    for(var i=0;i<n;i++) if(!done[i] && D[i] < bd){ bd = D[i]; u = i; }
    if(u < 0) break; done[u] = 1;
    BZ.nbr[u].forEach(function(v){ var w = Math.hypot(BZ.cent[u].x-BZ.cent[v].x, BZ.cent[u].y-BZ.cent[v].y); if(D[u]+w < D[v]) D[v] = D[u]+w; });
  }
  return D;
}
function bzOf(x, y){
  var k = (x>>4)+","+(y>>4);
  if(k in BZ.grid) return BZ.grid[k];
  var best = -1, bd = Infinity;
  for(var i=0;i<ZONEMAP.zones.length;i++){
    var z = ZONEMAP.zones[i];
    if(pointInPoly(x, y, z.points)){ best = i; break; }
    var c = BZ.cent[i]; if(!c) continue;
    var d = Math.hypot(c.x-x, c.y-y); if(d < bd){ bd = d; best = i; }
  }
  BZ.grid[k] = best;
  return best;
}
var belief = {CT:{}, T:{}};
function beliefReset(){
  if(!BZ.ids.length) beliefBuild();
  var n = BZ.ids.length;
  beliefSeen = {CT:{}, T:{}}; beliefLast = {CT:{}, T:{}}; LAST_CLEAR = {CT:{}, T:{}};
  reachReset();
  bots.forEach(function(o){ o._lkZ = null; o._lkPt = null; o._lkC = null; o._lkTop = null; });
  ["CT","T"].forEach(function(team){
    belief[team] = {};
    bots.forEach(function(e){
      if(e.team === team) return;
      var P = new Float32Array(n), sp = e.team === "CT" ? CT_SPAWN : T_SPAWN, zi = bzOf(sp.x, sp.y);
      if(zi >= 0) P[zi] = 1; belief[team][e.id] = P;
    });
  });
}
var beliefSeen = {CT:{}, T:{}}; // когда по этому врагу последний раз была реальная инфа
// ЕДИНОЕ хранилище инфы о врагах: belief (где вероятно каждый враг, по зонам) +
// beliefLast (последнее реальное наблюдение: точка, когда, видели/слышали).
// Всё остальное — "последняя позиция" (ЛИП), "проверено — пусто", оценка
// "сколько их тут" — теперь только ЧИТАЕТ отсюда и ПИШЕТ сюда, а не хранит
// свою отдельную копию: раньше пять копий расходились между собой
var beliefLast = {CT:{}, T:{}};
// ---- тайминги (как думают про): "видел там 10с назад — сейчас может быть уже здесь" ----
// REACH[team][зона] = самый ранний тик, когда там МОЖЕТ оказаться враг: от его
// спавна бегом; зона, в которую свои сейчас смотрят и там пусто, снова
// "закрыта" и откроется, только когда враг успел бы добежать из соседней
// открытой зоны; увиденный/услышанный враг открывает свою зону сразу.
// Это не вероятность "сколько их", а честное "может ли тут кто-то быть".
var REACH = {CT:null, T:null};
function reachReset(){
  if(!BZ.ids.length) return;
  var n = BZ.ids.length;
  ["CT","T"].forEach(function(team){
    var sp = team === "CT" ? T_SPAWN : CT_SPAWN, z = bzOf(sp.x, sp.y);
    var D = bzDist(z >= 0 ? [z] : []), R = new Float64Array(n);
    for(var i=0;i<n;i++) R[i] = roundStartTick + D[i]/SPEED*TICK_HZ;
    REACH[team] = R;
  });
}
function reachOpen(team, x, y){ var R = REACH[team]; if(!R) return; var zi = bzOf(x, y); if(zi >= 0) R[zi] = Math.min(R[zi], tick); }
function reachPossible(team, i){ var R = REACH[team]; return !R || R[i] <= tick; }
function reachStep(team, clearList){
  var R = REACH[team]; if(!R) return;
  clearList.forEach(function(cz){ if(cz[1] >= 0.5) R[cz[0]] = Math.max(R[cz[0]], tick + BELIEF_STEP + 1); });
  if(BAL.reachBlock){
    // (фото) раньше "куда враг мог успеть" считалось один раз от спавна по
    // свободной карте — и зоны за живым мидером считались достижимыми, хотя
    // пройти туда можно только через него. Теперь каждый шаг: закрытые зоны
    // пересчитываются от открытых, а зона, которую держит/видит свой, — стена:
    // через неё путь не идёт, пока её не "откроет" контакт или уход своего
    var n = R.length, fixed = new Uint8Array(n), D = new Float64Array(n);
    clearList.forEach(function(cz){ if(cz[1] >= 0.5) fixed[cz[0]] = 1; });
    for(var i0=0;i0<n;i0++) D[i0] = (R[i0] <= tick || fixed[i0]) ? R[i0] : Infinity;
    var done = new Uint8Array(n);
    for(var it0=0; it0<n; it0++){
      var u = -1, bd = Infinity;
      for(var i1=0;i1<n;i1++) if(!done[i1] && D[i1] < bd){ bd = D[i1]; u = i1; }
      if(u < 0) break; done[u] = 1;
      if(fixed[u] && R[u] > tick) continue; // держат свои — дальше через неё не пройти
      var nbu = BZ.nbr[u], cu = BZ.cent[u]; if(!cu) continue;
      for(var k0=0;k0<nbu.length;k0++){ var v = nbu[k0], cv = BZ.cent[v]; if(!cv || done[v] || fixed[v] || R[v] <= tick) continue;
        var tv = D[u] + Math.hypot(cu.x-cv.x, cu.y-cv.y)/SPEED*TICK_HZ; if(tv < D[v]) D[v] = tv; }
    }
    for(var i2=0;i2<n;i2++) if(R[i2] > tick && !fixed[i2]) R[i2] = D[i2];
    return;
  }
  for(var it=0; it<3; it++){
    for(var i=0;i<R.length;i++){
      var nb = BZ.nbr[i], ci = BZ.cent[i]; if(!ci) continue;
      for(var k=0;k<nb.length;k++){ var j = nb[k], cj = BZ.cent[j]; if(!cj) continue;
        var t = R[j] + Math.hypot(ci.x-cj.x, ci.y-cj.y)/SPEED*TICK_HZ;
        if(t < R[i]) R[i] = t; }
    }
  }
}
function beliefMassNear(team, eid, x, y, r){
  var P = belief[team] && belief[team][eid]; if(!P) return 0;
  var t = 0, z0 = bzOf(x, y);
  for(var i=0;i<P.length;i++){ if(!P[i]) continue; var c = BZ.cent[i]; if(i === z0 || (c && Math.hypot(c.x-x, c.y-y) <= r)) t += P[i]; }
  return t;
}
