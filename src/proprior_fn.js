// =====================================================================
// (v147) ПРО-ПОЗИЦИИ ИЗ ДЕМОК. PRO_PRIOR — где реально стоят про на Ancient
// (12 матчей), по стороне и фазе раунда; после планта — отдельно для A и B.
// Используется двумя способами:
//  1) бонус точке при любом выборе позиции (pickSpots, holdSpot): при прочих
//     равных бот встаёт туда, где обычно стоят про;
//  2) выбор позиции из списка названий (опорник, второй на сайте, роль по
//     сетапу) — не "первые в списке чаще", а пропорционально тому, сколько
//     времени про реально проводят в этой зоне.
// =====================================================================
var PP = {grids:{}, zc:null};
function ppLayer(team){
  if(!team) return null;
  if(bomb && bomb.state === "planted" && bomb.site) return team + "|post" + bomb.site;
  var sec = (tick - roundStartTick)/TICK_HZ;
  return team + "|" + (sec < 20 ? "early" : sec < 50 ? "setup" : "late");
}
function ppGrid(layer){
  if(!layer || typeof PRO_PRIOR === "undefined") return null;
  if(PP.grids[layer]) return PP.grids[layer];
  var L = PRO_PRIOR.layers[layer]; if(!L) return null;
  var g = new Float32Array(PRO_PRIOR.n*PRO_PRIOR.n);
  for(var i=0;i<L.length;i++) g[L[i][0]] = L[i][1]/1000;
  PP.grids[layer] = g; return g;
}
// 0..1: насколько типично для про стоять в этой точке сейчас
function proAt(team, x, y, layer){
  var g = ppGrid(layer || ppLayer(team)); if(!g) return 0;
  var C = PRO_PRIOR.cell, n = PRO_PRIOR.n, cx = Math.floor(x/C), cy = Math.floor(y/C);
  if(cx < 0 || cy < 0 || cx >= n || cy >= n) return 0;
  return g[cy*n + cx];
}
// клетки сетки внутри каждой зоны (один раз)
function ppZoneCells(){
  if(PP.zc) return PP.zc;
  PP.zc = {}; var C = PRO_PRIOR.cell, n = PRO_PRIOR.n;
  ZONEMAP.zones.forEach(function(z){
    var xs = z.points.map(function(p){ return p.x; }), ys = z.points.map(function(p){ return p.y; });
    var x0 = Math.max(0, Math.floor(Math.min.apply(null, xs)/C)), x1 = Math.min(n-1, Math.floor(Math.max.apply(null, xs)/C));
    var y0 = Math.max(0, Math.floor(Math.min.apply(null, ys)/C)), y1 = Math.min(n-1, Math.floor(Math.max.apply(null, ys)/C));
    var cells = [];
    for(var cy=y0; cy<=y1; cy++) for(var cx=x0; cx<=x1; cx++) if(pointInPoly(cx*C+C/2, cy*C+C/2, z.points)) cells.push(cy*n+cx);
    PP.zc[z.id] = cells;
  });
  return PP.zc;
}
// сколько "про-времени" в зоне с таким названием (относительная величина)
function proZoneShare(team, name, layer){
  var g = ppGrid(layer || ppLayer(team)); if(!g) return 0;
  var ZC = ppZoneCells(), t = 0;
  zonesByName(name).forEach(function(id){ (ZC[id]||[]).forEach(function(ci){ t += g[ci]; }); });
  return t;
}
// выбор названия позиции: вероятность ∝ про-времени в зоне (+ небольшой пол,
// чтобы редкие офф-углы тоже иногда случались). Детерминированно по seed.
function proPick(team, names, seed, layer){
  var sh = names.map(function(n){ return proZoneShare(team, n, layer); });
  var mx = Math.max.apply(null, sh.concat([1e-9]));
  var w = sh.map(function(v){ return BAL.proFloor + v/mx; });
  var tot = w.reduce(function(a, v){ return a+v; }, 0), r = hashRand(seed)*tot;
  for(var i=0;i<w.length;i++){ r -= w[i]; if(r <= 0) return i; }
  return w.length-1;
}
// Стандартная расстановка по данным демок (где CT реально стоят на 25-й секунде):
// A держат 1–2 игрока, и половину раундов один из них впереди (Short/Donut);
// на B двое, один из них часто выдвинут (Cave/Lamp Room/Dark); ещё один — сзади,
// на путях ротации (Alley/спавн/Back Halls). Название выбирается по про-частоте.
var PRO_ROLE = {
  anchorA: ["Back Site","A Site","Temple","Short","Donut","Triple Box","Boost","Box","Plat"],
  anchorB: ["B Site","Site B","First Lane","Second Lane","90","Bonger"],
  rot212:  ["Alley","Red Room"],   // (v149) без Back Halls, спавна и CT Lane: оттуда нет полезного угла, про там только проходят
  roam212: ["Cave","Lamp Room","Dark"]
};
function proRolePost(b, key, names, ref, look, tag){
  var P = b._proRole;
  if(!(P && P.round === roundNum && P.m === matchNum && P.key === key)){
    var nm = names[proPick("CT", names, roundNum*389 + matchNum*53 + key.length*7 + b.id.charCodeAt(2||1), "CT|setup")];
    var p = namedSpot(nm, ref, {see: look ? [look] : [], key:"pr"+key+nm});
    if(!p) return false;
    // (v149) взгляд с этой точки — туда, откуда враг придёт раньше всего,
    // а не заданная заранее точка (с Back Halls "на мид" = в свой коридор)
    if(BAL.enemyward){ var ewp = enemywardLook("CT", p); if(ewp) look = ewp; }
    P = b._proRole = {round:roundNum, m:matchNum, key:key, p:p, look:look, nm:nm};
    logEvent(b.id+": "+({rot:"сзади на ротации", roam:"второй на B"})[key]+" — «"+nm+"»");
  }
  setPost(b, P.p, P.look, true, tag);
  return true;
}
// =====================================================================
// (v150) ПРО-ЛАЙНАПЫ ИЗ ДЕМОК: 12 матчей, повторяющиеся броски (одна точка
// броска → одна точка падения, ≥3 раз, ≥2 матча). У каждого — доля раундов,
// в которых про его кидают (prob), и среднее время броска (at, с от начала).
// Каждый раунд лайнап "разыгрывается" с этой вероятностью — так набор гранат
// меняется от раунда к раунду, как у живых команд.
// =====================================================================
var PRO_LINEUPS = null;
function proLineups(){
  if(PRO_LINEUPS) return PRO_LINEUPS;
  if(typeof PRO_LINEUPS_RAW === "undefined") return (PRO_LINEUPS = []);
  PRO_LINEUPS = PRO_LINEUPS_RAW.map(function(L){
    var f = snapToWalkable(L.from.x, L.from.y) || L.from;
    return {id:L.id, team:L.team, type:L.type, trigger:L.trigger, site:L.site, name:L.name, from:{x:f.x, y:f.y}, to:L.to, prob:L.prob, at:L.at, pro:true};
  });
  return PRO_LINEUPS;
}
// встроенная "общая" граната не летит, если про-лайнапы того же типа уже
// покрывают эту ситуацию (сторона, триггер, сайт)
var PRO_COVER = null;
function proCovers(key){
  if(!BAL.proLineups) return false;
  if(!PRO_COVER){ PRO_COVER = {}; proLineups().forEach(function(L){ PRO_COVER[L.team+"|"+L.trigger+"|"+L.site+"|"+L.type] = 1; if(L.site === "any"){ PRO_COVER[L.team+"|"+L.trigger+"|A|"+L.type] = 1; PRO_COVER[L.team+"|"+L.trigger+"|B|"+L.type] = 1; } }); }
  var p = key.split("."), trig = {insta:"insta", exec:"exec", pp:"postplant", call:"call", retake:"retake"}[p[1]];
  if(!trig) return false;
  var bl = (typeof builtinLineups === "function" ? builtinLineups() : []).filter(function(L){ return L.key === key; })[0];
  if(!bl) return false;
  var site = p[1] === "insta" ? "any" : p[p.length-1];
  return !!(PRO_COVER[p[0]+"|"+trig+"|"+site+"|"+bl.type] || PRO_COVER[p[0]+"|"+trig+"|any|"+bl.type]);
}
