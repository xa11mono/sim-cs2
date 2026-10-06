// =====================================================================
// (v190, rework.md B3 шаг 2а) ТАБЛИЦА КОМАНДЫ «КТО ЧТО ДЕРЖИТ» И ВЫБОР ДЕЙСТВИЯ
// Одно место, где CT решают, куда встать (T — шаг 2б, пока старый мозг).
//  • Таблица команды TEAM[team].rows: у каждого — роль по плану, район (A/B/мид),
//    какой вход держит и где стоит. Где стоят свои — видно на радаре; какой вход
//    кто держит — видно, когда он стоит у его укрытия, или когда он сказал
//    «беру X» в тимспике. Чужие намерения иначе не известны.
//  • План IGL — вход, а не позиция: сколько людей нужно в каждом районе
//    (teamTac.CT.need — 12_ct_brain.js), фаза ретейка, сейв.
//  • Раз в 0,5 с каждый бот оценивает варианты одной суммой целей и берёт
//    лучший; текущий получает надбавку (не дёргается). Варианты — укрытия из
//    разметки (01_markup.js): держать вход, точка сбора на ретейк, заход к
//    бомбе, дефуз, сейв.
//  • Опустевший угол (свой погиб или сказал «ухожу — подержите») и просьба
//    «нужен второй» достаются тому, кому ближе и кто меньше нужен на своём
//    месте; он говорит «беру X» / «иду» / «не могу».
// =====================================================================
var TEAM = {CT:null, T:null};
// веса целей: размен (trade) весит больше, чем «вижу вход» (threat) — урок отката v173
var ACT = {every:32, W:{need:1.6, threat:1.0, trade:1.3, alone:0.6, stack:0.9, risk:1.0, dist:0.07, dup:1.2, same:3, cur:0.35, poi:1.0}};
var TEAM_COV = null;   // каталог укрытий из разметки (статичный, считается один раз)
// район точки: ближайший из A / B / мид (в пределах радиуса района)
function teamAreaOf(p){
  var best = null, bd = 1e9;
  [["A", SITES.A, 620], ["B", SITES.B, 620], ["M", GEO.ctMid, 520]].forEach(function(a){ if(!a[1]) return;
    var d = Math.hypot(p.x-a[1].x, p.y-a[1].y); if(d < a[2] && d/a[2] < bd){ bd = d/a[2]; best = a[0]; } });
  return best;
}
function teamCovers(){
  if(TEAM_COV) return TEAM_COV;
  var M = markupGet(), D = enemySpawnDist("CT"), out = [];
  // насколько вперёд района (ближе к T) ещё можно стоять: от зоны сайта/мида
  var AZ = {A:bzOf(GEO.A.tEntry.x, GEO.A.tEntry.y), B:bzOf(SITES.B.x, SITES.B.y), M:bzOf(GEO.ctMid.x, GEO.ctMid.y)}, FWD = {A:400, B:250, M:250}, zCT = bzOf(CT_SPAWN.x, CT_SPAWN.y);
  M.entries.forEach(function(E){ E.sides.forEach(function(S){
    var key = E.id+":"+S.hold, from = S.from === E.a ? E.nameA : E.nameB;
    S.covers.forEach(function(c){
      // район: укрытие у сайта/мида, держит вход со стороны T (враг придёт спереди,
      // а не из своего тыла) и стоит не впереди района
      var a = teamAreaOf(c), az = a ? AZ[a] : -1;
      if(a && az >= 0 && !(D[S.from] < D[S.hold] && D[S.from] <= D[zCT] - 340 && D[S.hold] >= D[az] - FWD[a])) a = null;
      out.push({x:c.x, y:c.y, meet:c.meet, open:c.open, dirs:c.dirs, side:key, hold:S.hold, from:S.from,
        name:from, ct: D[S.hold] > D[S.from], area:a}); });
  }); });
  return (TEAM_COV = out);
}
function teamRow(team, id){ var T = TEAM[team]; return T && T.rows[id]; }
// новый раунд — пустая таблица
function teamReset(team){ TEAM[team] = {round:roundNum, rows:{}, vac:[], req:[], said:{}}; }
// услышали в тимспике (voiceTick): «беру X» — его вход; «ухожу — подержите» — угол опустел;
// «нужен второй» — просьба; «иду» / «не могу» — ответ
function teamHear(team, byId, it){
  var T = TEAM[team]; if(!T || !it) return;
  if(it.k === "take"){ var r = T.rows[byId] || (T.rows[byId] = {}); r.claim = {side:it.side, x:it.x, y:it.y, area:it.area, t:tick}; }
  if(it.k === "holdmine") T.vac.push({x:it.x, y:it.y, side:it.side || null, t:tick, by:byId});
  if(it.k === "need2") T.req.push({x:it.x, y:it.y, t:tick, by:byId});
}
// таблица из того, что видно и слышно: район и вход каждого
function teamTableTick(team){
  var T = TEAM[team]; if(!T || T.round !== roundNum) teamReset(team), T = TEAM[team];
  var C = teamCovers();
  bots.forEach(function(o){
    if(o.team !== team) return;
    var r = T.rows[o.id] || (T.rows[o.id] = {});
    if(!o.alive){
      // погиб — угол, который он держал, опустел (это видно на радаре сразу)
      if(!r.dead){ r.dead = true; if(r.side) T.vac.push({x:r.x, y:r.y, side:r.side, t:tick, by:o.id}); }
      return;
    }
    r.role = o.tRole; r.x = o.x; r.y = o.y;
    var at = null, bd = 60;
    if(o.curSpeed < 40) C.forEach(function(c){ var d = Math.hypot(c.x-o.x, c.y-o.y); if(d < bd){ bd = d; at = c; } });
    var cl = r.claim && tick - r.claim.t < 15*TICK_HZ ? r.claim : null;
    r.side = at ? at.side : cl ? cl.side : null;
    r.area = ((teamTac[team] || {}).assign || {})[o.id] || (at ? at.area : cl ? cl.area : teamAreaOf(o));
  });
  T.vac = T.vac.filter(function(v){ return tick - v.t < 12*TICK_HZ; });
  T.req = T.req.filter(function(q){ return tick - q.t < 10*TICK_HZ; });
}
// сколько своих (кроме me) уже в районе по таблице
function teamAreaCount(team, area, me){
  var T = TEAM[team], n = 0;
  bots.forEach(function(o){ if(o === me || !o.alive || o.team !== team) return; var r = T.rows[o.id]; if(r && r.area === area) n++; });
  return n;
}
// нужен ли бот там, где он сейчас (уйдёт — район останется без нужного числа)
function teamNeededHere(team, o){
  var r = teamRow(team, o.id), need = (teamTac[team] || {}).need || {};
  if(!r || !r.area || need[r.area] == null) return false;
  return teamAreaCount(team, r.area, o) < need[r.area];
}
// кому достаётся опустевший угол / просьба: ближе всех и меньше нужен на своём месте
function teamResponder(team, p, except){
  var best = null, bs = 1e9;
  bots.forEach(function(o){ if(!o.alive || o.team !== team || o.id === except || o.defusing || o.planting) return;
    var s = Math.hypot(o.x-p.x, o.y-p.y)/SPEED + (teamNeededHere(team, o) ? 4 : 0);
    if(s < bs){ bs = s; best = o; } });
  return best ? {b:best, cost:bs} : null;
}
// угроза входа: сколько врагов по картине команды может выйти оттуда сейчас
var _thr = {t:-1, v:{}};
function teamThreat(team, c){
  if(_thr.t !== tick){ _thr = {t:tick, v:{}}; }
  if(_thr.v[c.side] != null) return _thr.v[c.side];
  var j = c.from, m = beliefZoneKnown(team, j);
  (BZ.nbr[j]||[]).forEach(function(n){ if(n !== c.hold) m += 0.5*beliefZoneKnown(team, n); });
  var v = (1 - Math.exp(-1.5*m)) * Math.max(0.15, reachW(team, j, c.hold));
  return (_thr.v[c.side] = v);
}
// где свои: по таблице (радар), у кого есть сказанная цель — она
function teamMatePts(team, me){
  var T = TEAM[team], out = [];
  bots.forEach(function(o){ if(o === me || !o.alive || o.team !== team) return;
    var r = T.rows[o.id], cl = r && r.claim && tick - r.claim.t < 15*TICK_HZ ? r.claim : null;
    out.push({id:o.id, x:cl && !r.side ? cl.x : o.x, y:cl && !r.side ? cl.y : o.y, side:r ? r.side : null}); });
  return out;
}
// оценка одного варианта (точки) для бота: сумма целей
function actScore(b, c, X){
  var W = ACT.W, s = 0, team = b.team;
  s -= W.dist * Math.hypot(c.x-b.x, c.y-b.y)*1.2/SPEED;                // дойти
  if(X.mode === "hold"){
    s += c.area === X.myArea ? W.need : -W.need;                       // план IGL: мой район
    s += W.threat * teamThreat(team, c);                                 // держать нужный вход
  }
  // не стоять одному без размена и не вплотную
  var dm = 1e9; X.mates.forEach(function(m){ var d = Math.hypot(m.x-c.x, m.y-c.y); if(d < dm) dm = d;
    if(m.side && m.side === c.side) s -= W.dup;
    if(Math.hypot(m.x-c.x, m.y-c.y) < 40) s -= W.same; });
  if(X.mates.length){ if(dm < 110) s -= W.stack; else if(dm < 480) s += W.trade; else if(dm > 750) s -= W.alone; }
  // не умереть зря: открытость + известные враги, которые её видят
  var dyn = 0; X.foes.forEach(function(f){ if(Math.hypot(f.x-c.x, f.y-c.y) < 1400 && hasLOS(c.x, c.y, f.x, f.y)) dyn += 0.7; });
  s -= W.risk * X.riskMul * ((c.open || 0) + 0.12*(c.dirs || 0) + Math.min(2, dyn));
  // точки интереса: опустевший угол, просьба, бомба, плант, враг тиммейта (размен)
  X.pois.forEach(function(P){ var d = Math.hypot(P.x-c.x, P.y-c.y);
    if(d > P.r || (P.side && P.side !== c.side && !P.see)) return;
    if(P.see && !hasLOS(c.x, c.y, P.x, P.y)) return;
    s += P.w; });
  if(X.cur && X.cur.x === c.x && X.cur.y === c.y && !X.noCur) s += W.cur;
  return s;
}
// выбрать лучшее и встать
function actPick(b, cands, X, tag){
  var best = null, bs = -1e9;
  cands.forEach(function(c){ var s = actScore(b, c, X); if(s > bs){ bs = s; best = c; } });
  if(!best) return null;
  b._act = {x:best.x, y:best.y, side:best.side || null, from:best.from, hold:best.hold, area:best.area || null, name:best.name || "", sc:bs, mode:X.mode, t:tick, round:roundNum};
  setPost(b, {x:best.x, y:best.y}, best.meet || X.look || null, true, tag(best));
  return best;
}
// раз в 0,5 с (боты по очереди) — CT
function ctActTick(cts){
  var team = "CT", ct = teamTac.CT; if(!ct) return;
  teamTableTick(team);
  var T = TEAM[team], C = teamCovers();
  var planted = bomb.state === "planted", R = planted ? bomb.retake : null;
  var foes = picRecent(team, 4*TICK_HZ);
  // точки интереса команды (общие)
  var pois = [];
  // бомба на земле на виду — её держат из укрытия
  if(bomb.state === "dropped"){
    var seer = cts.filter(function(o){ return Math.hypot(o.x-bomb.x, o.y-bomb.y) < 1000 && hasVision(o.x, o.y, bomb.x, bomb.y); })
      .sort(function(a, c){ return Math.hypot(a.x-bomb.x, a.y-bomb.y) - Math.hypot(c.x-bomb.x, c.y-bomb.y); })[0];
    if(seer && cts.length >= 2) pois.push({x:bomb.x, y:bomb.y, r:900, see:true, w:0.8, who:seer.id});
  }
  // плант слышен рядом — выйти на линию, откуда видно ставящего (если нас там не меньше)
  var PH = teamIntel.CT.plantHeard;
  if(!planted && PH && tick - PH.tick < PLANT_TICKS + 32){
    var tN = Math.max(1, intelEstimate("CT", PH.x, PH.y, 450, 5*TICK_HZ).n), cN = cts.filter(function(o){ return Math.hypot(o.x-PH.x, o.y-PH.y) < 600; }).length;
    if(cN >= tN || ROUND_TIME_SEC - (simTime - roundStartTime) < 12) pois.push({x:PH.x, y:PH.y, r:450, see:true, w:1.5});
  }
  // размен: враг, которого свои видят/видели только что рядом с тиммейтом, — его линию держат ближние
  foes.forEach(function(f){ if(tick - f.tick > 1.5*TICK_HZ) return;
    if(picEvents(team).some(function(sg){ return sg.type === "died" && tick - sg.tick < 3*TICK_HZ && Math.hypot(sg.x-f.x, sg.y-f.y) < 700; }) ||
       cts.some(function(o){ return o._sawEnemy && Math.hypot(o.x-f.x, o.y-f.y) < 700; }))
      pois.push({x:f.x, y:f.y, r:650, see:true, w:0.9, near:600}); });
  // опустевшие углы и просьбы — кому они достаются (один раз на запись)
  T.vac.forEach(function(v){ if(!v.resp){ var rp = teamResponder(team, v, v.by); v.resp = rp ? rp.b.id : "-"; v.ok = rp && !teamNeededHere(team, rp.b); } });
  T.req.forEach(function(q){ if(!q.resp){ var rp = teamResponder(team, q, q.by); q.resp = rp ? rp.b.id : "-";
    q.ok = !!(rp && !teamNeededHere(team, rp.b) && rp.cost < 9);
    if(rp) newsAdd(rp.b, {k: q.ok ? "go" : "cant", x:q.x, y:q.y, to:q.by}); } });
  cts.forEach(function(b, i){
    if(b.defusing || b.planting) return;
    var due = !b.post || !b._act || b._act.round !== roundNum || (tick + i*6) % ACT.every === 0;
    if(!due) return;
    if(b.nadeTask || (b.post && /^(lineup|pickup)/.test(b.post.tag||""))) return;   // бросок по лайнапу / подбор — свои исполнители
    if(b._sawEnemy && !b._reloading) return;                                        // в бою место не меняют
    if(tick < (b.blindUntil||0)) return;
    var X = {mode:"hold", myArea:(ct.assign || {})[b.id] || null, mates:teamMatePts(team, b), foes:foes, pois:[], cur:b._act && b._act.round === roundNum ? b._act : null,
      riskMul: (b.hp < 50 ? 1.6 : 1) * (b._reloading ? 2 : 1), noCur: !!b._reloading};
    pois.forEach(function(P){ if(P.near && Math.hypot(P.x-b.x, P.y-b.y) > P.near) return; if(P.who && P.who !== b.id) return; X.pois.push(P); });
    T.vac.forEach(function(v){ if(v.resp === b.id && v.ok) X.pois.push({x:v.x, y:v.y, r:300, side:v.side, w:1.4, vac:v}); });
    T.req.forEach(function(q){ if(q.resp === b.id && q.ok) X.pois.push({x:q.x, y:q.y, r:450, w:1.4}); });
    var prev = b._act;
    // ---- сейв: ретейк безнадёжен — подальше от бомбы и известных T, не на виду ----
    if(ct.saving || b._awpSave){ actSave(b); return; }
    var picked = null;
    if(planted && R){
      var bp = ctBombPos();
      if(R.defId === b.id && (R.phase === "go") && retakeDefGo(b, R, cts)){
        b._act = {x:bp.x, y:bp.y, mode:"defuse", round:roundNum, t:tick}; setPost(b, bp, null, true, "defuse"); return; }
      if(R.phase === "gather" || R.phase === "util"){
        // точка сбора: укрытие своей стороны у входа на сайт с бомбой, бомбу оттуда не видно
        X.mode = "gather"; X.look = bp;
        var G = C.filter(function(c){ var d = Math.hypot(c.x-bp.x, c.y-bp.y); return c.ct && d > 220 && d < 700 && !hasLOS(c.x, c.y, bp.x, bp.y); });
        if(!G.length) G = [{x:GEO[bomb.site].ctEntry.x, y:GEO[bomb.site].ctEntry.y, meet:bp}];
        picked = actPick(b, G, X, function(){ return "gather"; });
      } else {
        // заход: укрытия у бомбы с линией на неё
        X.mode = "go"; X.look = bp;
        var Gg = C.filter(function(c){ var d = Math.hypot(c.x-bp.x, c.y-bp.y); return d > 60 && d < 480 && hasLOS(c.x, c.y, bp.x, bp.y); })
          .map(function(c){ return {x:c.x, y:c.y, meet:bp, side:c.side, area:c.area, name:c.name, open:c.open, dirs:c.dirs}; });
        if(!Gg.length) Gg = [{x:bp.x, y:bp.y, meet:bp}];
        picked = actPick(b, Gg, X, function(){ return R.entryId === b.id ? "retakeEntry" : "retake"; });
      }
    } else {
      var H = C.filter(function(c){ return c.ct && c.area; });
      picked = actPick(b, H, X, function(c){ return "hold:"+c.name; });
    }
    // сказать, что беру вход, если ухожу на другой (команда должна знать, кто где)
    if(picked && X.mode === "hold" && (!prev || prev.round !== roundNum || prev.side !== picked.side) && Math.hypot(picked.x-b.x, picked.y-b.y) > 250)
      newsAdd(b, {k:"take", x:picked.x, y:picked.y, side:picked.side, area:picked.area, name:picked.name.split(" / ")[0]});
    // ухожу из района с угла, откуда может выйти враг, а его больше никто не держит, — «подержите»
    if(picked && prev && prev.round === roundNum && prev.mode === "hold" && prev.side && prev.area !== picked.area && Math.hypot(b.x-prev.x, b.y-prev.y) < 80 &&
       !X.mates.some(function(m){ return m.side === prev.side; }) && teamThreat(team, prev) > 0.15)
      newsAdd(b, {k:"holdmine", x:prev.x, y:prev.y, side:prev.side});
  });
}
// сейв: укрытие подальше от бомбы и от известных T, откуда их не видно (из разметки)
function actSave(b){
  if(b._act && b._act.mode === "save" && b._act.round === roundNum && b._act.ok){ setPost(b, b._act, null, true, "save"); return; }
  var ts = picRecent(b.team, 15*TICK_HZ), best = null, bs = -1e9, C = teamCovers();
  C.forEach(function(c){
    if(bomb && bomb.state === "planted" && Math.hypot(c.x-bomb.x, c.y-bomb.y) < BOMB_KILL_RADIUS + 150) return;
    var dT = 1e9, seen = false;
    ts.forEach(function(t){ dT = Math.min(dT, Math.hypot(c.x-t.x, c.y-t.y)); if(hasLOS(c.x, c.y, t.x, t.y)) seen = true; });
    if(seen || dT < 500) return;
    var s = Math.min(dT, 1200)*0.6 - Math.hypot(c.x-b.x, c.y-b.y) - 300*(c.open || 0);
    if(s > bs){ bs = s; best = c; }
  });
  var p = best || {x:CT_SPAWN.x, y:CT_SPAWN.y};
  b._act = {x:p.x, y:p.y, mode:"save", round:roundNum, ok:true, t:tick};
  setPost(b, p, bomb && bomb.state === "planted" ? {x:bomb.x, y:bomb.y} : null, true, "save");
}
