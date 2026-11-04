// (00_PLAN, пакет 1, 04.11) сторож счётчиков для пакетов 2–3 — только запись, игру не меняет. Вставляется в rec2.js (walk_run.py).
// Каждый счётчик — одна проверенная причина из разбора отметок Mirage 04.11 (docs/reports/MARKS_MIRAGE_2026-11-04.md):
//  falseClear — «чекнул — пусто» (markClear), а живой враг в этой зоне есть (п. «угроза»: зона проверена по 2/3 точек);
//  defSwap    — смены дефузера ретейка за раунд (п.32: CT4 ↔ CT2 каждые 0,5 с);
//  probe      — пробы, снятые до прихода на точку (п.16: срок 9 с от начала);
//  spawnT     — секунды T, стоящих на своём спавне после 5-й с раунда (п.12/13), по зоне «… Spawn» стороны T;
//  nadeTask   — задания гранат: брошено / сгорело по сроку / заменено другим (п.19);
//  nadeWall   — гранат с касанием стены / потолка (п.20, п.23);
//  zJump      — скачки высоты бота > 18 ед. за тик без лестницы и подъёма (п.15: высота участка, а не пол под ногами);
//  lowhpFull  — задача «мало HP» при HP > LOW_HP (п.1).
(function(){
  var GW = {falseClear:[0,0], defSwap:[], probe:[0,0], spawnT:0, nadeTask:{thrown:0, expired:0, replaced:0}, nadeWall:[0,0,0], zJump:0, zJumpEx:[], lowhpFull:[0,0]};
  var g = (typeof window !== "undefined" ? window : globalThis);
  var MC = markClear; markClear = function(team, x, y, who){
    var z = zoneIdAt(x, y), foe = team === "CT" ? "T" : "CT";
    if(z){ GW.falseClear[0]++; if(bots.some(function(e){ return e.alive && e.team === foe && zoneIdAt(e.x, e.y) === z; })) GW.falseClear[1]++; }
    return MC.apply(this, arguments); };
  var TN = throwNade; throwNade = function(b){ var r = TN.apply(this, arguments); if(r && b) b.__gwThrown = tick; return r; };
  var prev = {}, lastDef = null, defR = -1, defN = 0, seenN = new Map();
  GW.tick = function(){
    if(roundState !== "live"){ if(defR === roundNum && defN){ GW.defSwap.push([roundNum, defN]); defN = 0; } return; }
    var R = bomb && bomb.retake;
    if(R && R.defId){ if(defR !== roundNum){ defR = roundNum; defN = 0; lastDef = R.defId; } else if(R.defId !== lastDef){ defN++; lastDef = R.defId; } }
    var rt = (tick - roundStartTick)/TICK_HZ;
    bots.forEach(function(b){
      var P = prev[b.id] || (prev[b.id] = {});
      if(!b.alive){ P.z = null; return; }
      var tag = b.post ? String(b.post.tag) : "";
      if(/^probe/.test(P.tag || "") && !/^probe/.test(tag)){ GW.probe[0]++; if(!P.probeAt) GW.probe[1]++; P.probeAt = 0; }
      if(/^probe/.test(tag) && b.atPost) P.probeAt = 1;
      if(tag === "repos:lowhp" && P.tag !== "repos:lowhp"){ GW.lowhpFull[0]++; if(b.hp > LOW_HP) GW.lowhpFull[1]++; }
      P.tag = tag;
      if(b.team === "T" && rt > 5 && (b.curSpeed||0) < 5){ var zn = zoneUserName(zoneIdAt(b.x, b.y)) || ""; if(/spawn/i.test(zn) && !/^CT/i.test(zn)) GW.spawnT += 1/TICK_HZ; }
      var t = b.nadeTask;
      if(P.nt && P.nt !== t){ if(b.__gwThrown >= tick - 1) GW.nadeTask.thrown++; else if(t) GW.nadeTask.replaced++; else GW.nadeTask.expired++; }
      P.nt = t;
      if(P.z != null && b.z != null && Math.abs(b.z - P.z) > 18 && !b._climb && !b._ladder && !(b._jc)){ GW.zJump++; if(GW.zJumpEx.length < 200) GW.zJumpEx.push([tick, b.id, Math.round(b.x), Math.round(b.y), Math.round(P.z), Math.round(b.z), typeof calloutName === "function" ? calloutName(b.x, b.y) : ""]); }
      P.z = b.z;
    });
    nadesInAir.forEach(function(n){ seenN.set(n, n.bounces || []); });
    seenN.forEach(function(B, n){ if(nadesInAir.indexOf(n) >= 0) return; seenN.delete(n);
      GW.nadeWall[0]++; var w = B.some(function(x){ return x[3] === "wall"; }), c = B.some(function(x){ return x[3] === "wall" && x[6] < -0.5; });
      if(w) GW.nadeWall[1]++; if(c) GW.nadeWall[2]++; });
  };
  GW.report = function(){ var o = {}; for(var k in GW) if(typeof GW[k] !== "function") o[k] = GW[k]; return o; };
  g.GWATCH = GW;
})();
