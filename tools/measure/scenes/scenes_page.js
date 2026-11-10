// Сцены «до / после»: поиск эпизодов (только наблюдение) и запись проигрывания со снимка. Грузится в обе сборки.
var SC = { ring: [], cand: {}, eps: [], hook: false, log: null, subj: null };
function scHooks(){
  if(SC.hook) return; SC.hook = true;
  var oa = applyDamage;
  applyDamage = function(att, b, dmg, src, o){
    var al = b && b.alive, hp0 = b ? b.hp : 0, r = oa.apply(this, arguments);
    if(SC.log && b && al){ SC.log.push([tick, "dmg", b.id, att ? att.id : "", String(src || ""), Math.round(hp0 - b.hp), b.alive ? 1 : 0, att ? Math.round(att.x) : 0, att ? Math.round(att.y) : 0]); }
    if(SC.find && al && b.alive && att && att.team !== b.team && roundState === "live" && !b._fc && !b.planting && !b.defusing){
      var k = b.id; if(!SC.cand[k]) SC.cand[k] = {t: tick, id: b.id, x: b.x, y: b.y, src: String(src || ""), att: att.id, ax: att.x, ay: att.y, fc: 0};
    }
    return r; };
  var od = detonate;
  detonate = function(n){
    var near = [];
    if(n.type === "flash" && roundState === "live" && n.thrower){
      bots.forEach(function(e){ if(e.alive && e.team !== n.thrower.team && Math.hypot(e.x - n.x, e.y - n.y) < 1000) near.push(e); }); }
    var bl0 = bots.map(function(e){ return e.blindUntil || 0; });
    var r = od.apply(this, arguments);
    if(n.type === "flash" && n.thrower){
      var blE = bots.filter(function(e, i){ return e.team !== n.thrower.team && (e.blindUntil || 0) > bl0[i] && e.blindUntil > tick + 16; }).map(function(e){ return e.id; });
      var blM = bots.filter(function(e, i){ return e.team === n.thrower.team && (e.blindUntil || 0) > bl0[i] && e.blindUntil > tick + 16; }).map(function(e){ return e.id; });
      if(SC.log) SC.log.push([tick, "flash", n.thrower.id, Math.round(n.x), Math.round(n.y), blE.join(","), blM.join(",")]);
      if(SC.find && roundState === "live" && near.length && !blE.length) SC.eps.push({kind: "flash", t: tick, id: n.thrower.id, x: n.x, y: n.y, near: near.map(function(e){ return e.id; })});
    }
    return r; };
  var ot = throwNade;
  throwNade = function(b, type){
    if(typeof NADE_FAIL !== "undefined") NADE_FAIL = "";
    var r = ot.apply(this, arguments);
    if(SC.log && b) SC.log.push([tick, r ? "throw" : "nothrow", b.id, String(type), typeof NADE_FAIL !== "undefined" ? String(NADE_FAIL || "") : ""]);
    return r; };
}
function scFrame(){
  return {t: tick, b: bots.map(function(b){ return [Math.round(b.x), Math.round(b.y), Math.round((b.facing || 0) * 100) / 100, b.alive ? b.hp : 0, b._fc ? b._fc.ph : "", tick < (b.blindUntil || 0) ? 1 : 0, b.post ? String(b.post.tag) : "", b.atPost ? 1 : 0]; }),
    n: nadesInAir.map(function(n){ return [Math.round(n.x), Math.round(n.y), n.type]; }),
    s: smokes.filter(function(s){ return tick < s.until; }).map(function(s){ return [Math.round(s.x), Math.round(s.y)]; }),
    f: fires.filter(function(s){ return tick < s.until; }).map(function(s){ return [Math.round(s.x), Math.round(s.y)]; }),
    bomb: (typeof bomb !== "undefined" && bomb && bomb.planted) ? [Math.round(bomb.x), Math.round(bomb.y)] : null };
}
// поиск: матч M, до maxT тиков; кольцо снимков каждые 64 тика
function scFind(M, maxT){
  scHooks(); freshMatch(M); SC.ring = []; SC.cand = {}; SC.eps = []; SC.find = true;
  var FCP = {}, fcEnd = {}, out = [];
  for(var t = 0; t < maxT; t++){
    stepTick(); if(matchNum !== M) break;
    if(tick % 64 === 0 && roundState === "live"){ SC.ring.push({t: tick, r: roundNum, s: mkSnapshot()}); if(SC.ring.length > 8) SC.ring.shift(); }
    if(roundState !== "live"){ SC.cand = {}; fcEnd = {}; continue; }
    bots.forEach(function(b){
      var ph = b.alive && b._fc ? b._fc.ph : "";
      if(SC.cand[b.id] && ph) SC.cand[b.id].fc = 1;
      if(fcEnd[b.id] && ph) delete fcEnd[b.id];
      if((FCP[b.id] || "") === "off" && ph === "" && b.alive){ var e = b._fcLastE; fcEnd[b.id] = {t: tick, x: b.x, y: b.y}; }
      FCP[b.id] = ph; });
    for(var k in SC.cand){ var c = SC.cand[k], b = bots.find(function(q){ return q.id === c.id; });
      if(tick - c.t === 64){ if(b.alive && !c.fc && Math.hypot(b.x - c.x, b.y - c.y) < 25) SC.eps.push({kind: c.src === "HE" ? "he" : c.src === "молотов" ? "fire" : c.src === "bullet" ? "bullet" : "other", t: c.t, id: c.id, x: c.x, y: c.y, src: c.src, att: c.att, ax: c.ax, ay: c.ay}); delete SC.cand[k]; } }
    for(var k2 in fcEnd){ var f = fcEnd[k2], b2 = bots.find(function(q){ return q.id === k2; });
      if(!b2.alive){ delete fcEnd[k2]; continue; }
      if(Math.hypot(b2.x - f.x, b2.y - f.y) >= 25){ delete fcEnd[k2]; continue; }
      if(tick - f.t === 192){ if(!b2.atPost) SC.eps.push({kind: "a2", t: f.t, id: k2, x: f.x, y: f.y, post: b2.post ? String(b2.post.tag) : ""}); delete fcEnd[k2]; } }
    while(SC.eps.length){ var ep = SC.eps.shift(), back = ep.kind === "flash" ? 320 : ep.kind === "a2" ? 192 : 128;
      var sn = null; for(var i = SC.ring.length - 1; i >= 0; i--) if(SC.ring[i].t <= ep.t - back && SC.ring[i].r === roundNum){ sn = SC.ring[i]; break; }
      if(sn){ ep.snapT = sn.t; ep.round = roundNum; ep.match = M; ep.pack = mkPack(sn.s); out.push(ep); } }
  }
  SC.find = false; return out;
}
// запись: снимок → n тиков, кадр каждые 4 тика
function scRecord(pack, n){
  scHooks(); mkRestore(mkUnpack(pack)); SC.log = []; var fr = [];
  for(var t = 0; t < n; t++){ if(t % 4 === 0) fr.push(scFrame()); stepTick(); if(roundState !== "live" && t > 8) break; }
  var lg = SC.log; SC.log = null;
  return {frames: fr, log: lg, names: bots.map(function(b){ return [b.id, b.name || b.id, b.team]; })};
}
window.SC=SC; window.scHooks=scHooks; window.scFrame=scFrame; window.scFind=scFind; window.scRecord=scRecord; "ok"
