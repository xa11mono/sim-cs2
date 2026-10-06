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
//    лучший; текущий получает надбавку (не дёргается). Места — любые места карты
//    своей стороны (01_spots.js, v195): бот выбирает по ситуации (что видно, какой
//    вход нужен, укрытие, кто из своих что держит); место из демок своей фазы даёт
//    только небольшой плюс (W.lib) — желательное, не обязательное.
//  • Опустевший угол (свой погиб или сказал «ухожу — подержите») и просьба
//    «нужен второй» достаются тому, кому ближе и кто меньше нужен на своём
//    месте; он говорит «беру X» / «иду» / «не могу».
// =====================================================================
var TEAM = {CT:null, T:null};
// веса целей: размен (trade) весит больше, чем «вижу вход» (threat) — урок отката v173
var ACT = {every:32, W:{need:1.6, threat:1.0, trade:1.3, alone:0.6, stack:0.9, risk:1.0, lib:0.3, dist:0.07, dup:0.4, same:3, cur:0.35, poi:1.0, repos:0.9, deep:0.9, keep:1.2}};
var TEAM_COV = null;   // каталог мест: места карты + места из демок (статичный, считается один раз)
// район точки: зоны мида (Connector, Sniper Nest, Top Mid…) — мид (знание карты:
// так их зовут игроки); иначе ближайший из A / B / мид в пределах радиуса района
var MID_ZONES = {"Mid":1, "Top Mid":1, "Sniper Nest":1, "Connector / Red Room / Red":1, "Jungle / Pit":1, "Xbox":1, "Lower Mid / Start Mid":1, "Chamber Lane":1};
function teamAreaOf(p){
  var zi = bzOf(p.x, p.y), zn = zi >= 0 ? ZONE_NAMES[ZONEMAP.zones[zi].id] : null;
  if(zn && MID_ZONES[zn]) return "M";
  var best = null, bd = 1e9;
  [["A", SITES.A, 620], ["B", SITES.B, 620]].forEach(function(a){ if(!a[1]) return;
    var d = Math.hypot(p.x-a[1].x, p.y-a[1].y); if(d < a[2] && d/a[2] < bd){ bd = d/a[2]; best = a[0]; } });
  return best;
}
// каталог мест (01_spots.js): места карты обеих сторон + места из демок (фаза, взгляд)
function teamCovers(){ return TEAM_COV || (TEAM_COV = placesGet()); }
// места своей стороны, подходящие по условию (из демок или нет — решает сумма целей)
function spotsOf(C, team, ok){ return C.filter(function(c){ return (team === "CT" ? c.ct : c.t) && ok(c); }); }
// вариант «встать на место»: несёт с собой, из демок ли оно и куда с него смотрят
function spotCand(c, extra){ var o = {x:c.x, y:c.y, meet:c.meet, looks:c.looks, lib:c.lib, ph:c.ph, side:c.side, area:c.area, name:c.name, open:c.open, dirs:c.dirs};
  for(var k in extra) o[k] = extra[k]; return o; }
function teamRow(team, id){ var T = TEAM[team]; return T && T.rows[id]; }
// новый раунд — пустая таблица
function teamReset(team){ TEAM[team] = {round:roundNum, rows:{}, vac:[], req:[], said:{}, refused:{}}; }
// услышали в тимспике (voiceTick): «беру X» — его вход; «ухожу — подержите» — угол опустел;
// «нужен второй» — просьба; «иду» / «не могу» — ответ
function teamHear(team, byId, it){
  var T = TEAM[team]; if(!T || !it) return;
  if(it.k === "take"){ var r = T.rows[byId] || (T.rows[byId] = {}); r.claim = {side:it.side, x:it.x, y:it.y, area:it.area, t:tick}; }
  // (К13) одна просьба — одна запись: тот же игрок про то же место, пока прежняя жива, — не новая
  var dupOf = function(L){ return L.some(function(q){ return q.by === byId && Math.hypot(q.x-it.x, q.y-it.y) < 300; }); };
  if(it.k === "holdmine" && !dupOf(T.vac)) T.vac.push({x:it.x, y:it.y, side:it.side || null, t:tick, by:byId});
  if(it.k === "need2" && !dupOf(T.req)) T.req.push({x:it.x, y:it.y, t:tick, by:byId});
  if(it.k === "cant") T.refused[byId] = tick;
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
    if(o.curSpeed < 40) C.forEach(function(c){ if(team === "CT" ? !c.ct : !c.t) return; var d = Math.hypot(c.x-o.x, c.y-o.y); if(d < bd){ bd = d; at = c; } });
    var cl = r.claim && tick - r.claim.t < 15*TICK_HZ ? r.claim : null;
    r.side = at ? at.side : cl ? cl.side : null;
    r.area = ((teamTac[team] || {}).assign || {})[o.id] || (at ? at.area : cl ? cl.area : teamAreaOf(o));
  });
  T.vac = T.vac.filter(function(v){ return tick - v.t < 12*TICK_HZ && !v.done; });
  T.req = T.req.filter(function(q){ return tick - q.t < 10*TICK_HZ && !q.done; });
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
  var Rf = (TEAM[team] || {}).refused || {};
  bots.forEach(function(o){ if(!o.alive || o.team !== team || o.id === except || o.defusing || o.planting) return;
    if(tick - (Rf[o.id] == null ? -1e9 : Rf[o.id]) < 20*TICK_HZ) return;   // (К13) ответил «не могу» — его не спрашивают
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
    if(c.v) s += W.need;                                                 // вариант идёт от моего района (пик, подпуш, отход)
    else if(c.area) s += c.area === X.myArea ? W.need : -W.need;         // план IGL: мой район
    if(!c.v) s += W.threat * teamThreat(team, c);                        // держать нужный вход
  }
  s += c.gain || 0;                                                      // выгода варианта (пик, проба, энтри…) минус его риск
  if(c.lib && c.ph === X.ph) s += W.lib;                                 // (v195) место из демок этой фазы — небольшой плюс
  // не стоять одному без размена и не вплотную
  var dm = 1e9; X.mates.forEach(function(m){ var d = Math.hypot(m.x-c.x, m.y-c.y); if(d < dm) dm = d;
    if(m.side && m.side === c.side) s -= W.dup;
    if(Math.hypot(m.x-c.x, m.y-c.y) < 40) s -= W.same; });
  if(X.mates.length){ if(dm < 80) s -= W.stack; else if(dm < 480) s += W.trade; else if(dm > 750) s -= W.alone; }
  // не умереть зря: открытость + известные враги, которые её видят
  var dyn = 0; X.foes.forEach(function(f){ if(Math.hypot(f.x-c.x, f.y-c.y) < 1400 && hasLOS(c.x, c.y, f.x, f.y)) dyn += 0.7; });
  s -= W.risk * X.riskMul * ((c.open || 0) + 0.06*(c.dirs || 0) + Math.min(2, dyn));
  // точки интереса: опустевший угол, просьба, бомба, плант, враг тиммейта (размен)
  X.pois.forEach(function(P){ var d = Math.hypot(P.x-c.x, P.y-c.y);
    if(d > P.r || (P.side && P.side !== c.side && !P.see)) return;
    if(P.see && !hasLOS(c.x, c.y, P.x, P.y)) return;
    s += P.w; });
  // играть от ретейка: точки района у самого сайта отдаём, стоим глубже
  if(X.deep && c.area === X.deep && !c.v){ var dd = Math.hypot(c.x-SITES[X.deep].x, c.y-SITES[X.deep].y); s += dd > 430 ? W.deep : -W.deep; }
  var isCur = X.cur && X.cur.x === c.x && X.cur.y === c.y;
  // смена позиции после контакта: пострелял / ранен / засветился, а их рядом ещё много —
  // соседнее укрытие (враг целится туда, где меня видел)
  if(X.repos && !isCur){ var dr = Math.hypot(c.x-X.repos.x, c.y-X.repos.y); if(dr > 90 && dr < 480) s += W.repos; }
  if(isCur && !X.noCur && !X.repos) s += W.cur;
  if(X.keep && !c.v && Math.hypot(c.x-X.keep.x, c.y-X.keep.y) < 1) s += W.keep;    // (К13) взял угол — держит
  if(X.keep && ACTV[c.v]) s -= W.keep;                          // текущий вариант — надбавка (не дёргаться)
  return s;
}
// выбрать лучшее и встать; короткий ход (пик, подпуш, джиггл, проба) — с фазами
// «выйти → посмотреть → вернуться» (actRun), домой — на прежнюю точку
function actPick(b, cands, X, tag){
  var best = null, bs = -1e9;
  cands.forEach(function(c){ var s = actScore(b, c, X); if(s > bs){ bs = s; best = c; } });
  if(!best) return null;
  var prev = b._act && b._act.round === roundNum && !b._act.v ? b._act : null;
  b._act = {x:best.x, y:best.y, side:best.side || null, from:best.from, hold:best.hold, area:best.area || null, name:best.name || "", sc:bs, mode:X.mode, t:tick, round:roundNum, v:ACTV[best.v] ? best.v : null, looks:best.lib && best.ph === X.ph ? best.looks : null};
  if(b._act.v){ b._act.phase = "out"; b._act.home = best.home || (prev ? {x:prev.x, y:prev.y, meet:null, looks:prev.looks} : {x:b.x, y:b.y, meet:null}); b._act.look = best.look || ACTV[best.v].look; }
  var tg = best.v ? best.v+":"+(best.name || "") : (X.repos && Math.hypot(best.x-X.repos.x, best.y-X.repos.y) > 90 ? "repos:"+(best.name || "") : tag(best));
  setPost(b, {x:best.x, y:best.y}, best.meet || X.look || null, true, tg);
  if(best.say) newsAdd(b, best.say);
  return best;
}
// короткие ходы: сколько смотреть (с) и через сколько можно снова (с)
var ACTV = {peek:{look:1.3, cd:25}, push:{look:9, cd:35}, jiggle:{look:0.35, cd:5}, probe:{look:1.8, cd:16}};
// исполнитель короткого хода: true — бот занят им (обычный выбор не идёт)
function actRun(b, team){
  var A = b._act; if(!A || !A.v || A.round !== roundNum) return false;
  var hit = tick - (b._hurtT||-1e9) < TICK_HZ || tick - (b._shotAtT||-1e9) < TICK_HZ;
  if(A.phase === "out"){
    if(b.atPost || b._sawEnemy || hit || (A.v === "jiggle" && tick - A.t > 40) || tick - A.t > 12*TICK_HZ){ A.phase = "look"; A.tl = tick; }
    return true;
  }
  if(A.phase === "look"){
    if(b._sawEnemy && !b._reloading) return true;                       // в бою место не меняют
    var over = tick - A.tl > A.look*TICK_HZ || (A.v !== "push" && hit) || (A.v === "push" && picOutnumbered(team, b.x, b.y, b));
    if(!over) return true;
    A.phase = "back"; A.tb = tick; setPost(b, {x:A.home.x, y:A.home.y}, A.home.meet || null, true, "back:"+A.v);
    return true;
  }
  if(b.atPost || tick - A.tb > 8*TICK_HZ){ (b._actCd || (b._actCd = {}))[A.v] = tick + ACTV[A.v].cd*TICK_HZ;
    b._act = {x:A.home.x, y:A.home.y, round:roundNum, mode:"hold", t:tick, looks:A.home.looks || null}; return false; }
  return true;
}
function actCdOk(b, v){ return !(b._actCd && b._actCd[v] > tick); }
// у игрока своя манера: в этом раунде кто-то охотнее пикает, кто-то сидит (от раунда к раунду по-разному)
function actMood(b){ return 0.6 + 0.8*hashRand(roundNum*733 + matchNum*97 + b.id.charCodeAt(0)*13 + b.id.length*7); }
// деньги и риск: на эко терять нечего — смелее; на фулле — аккуратнее
function actMoneyRisk(team){ var r = (teamEco[team] || {}).roundType; return r === "eco" ? 0.6 : (r === "force" || r === "pistol") ? 0.8 : 1; }
// когда команда последний раз что-то знала о враге (видели / слышали)
function teamLastInfo(team){ var K = picKnown(team), t = -1e9; for(var id in K) if(K[id].tick > t) t = K[id].tick; return t; }
// раз в 0,5 с (боты по очереди) — обе команды; что именно выбирать — по плану
// своей команды (ctChoose / tChoose)
function teamActTick(team, cts){
  var ct = teamTac[team]; if(!ct) return;
  teamTableTick(team);
  var T = TEAM[team], C = teamCovers();
  var planted = bomb.state === "planted", R = planted ? bomb.retake : null;
  var foes = picRecent(team, 4*TICK_HZ);
  // точки интереса команды (общие)
  var pois = [];
  // бомба на земле на виду — её держат из укрытия
  if(team === "CT" && bomb.state === "dropped"){
    var seer = cts.filter(function(o){ return Math.hypot(o.x-bomb.x, o.y-bomb.y) < 1000 && hasVision(o.x, o.y, bomb.x, bomb.y); })
      .sort(function(a, c){ return Math.hypot(a.x-bomb.x, a.y-bomb.y) - Math.hypot(c.x-bomb.x, c.y-bomb.y); })[0];
    if(seer && cts.length >= 2) pois.push({x:bomb.x, y:bomb.y, r:900, see:true, w:0.8, who:seer.id});
  }
  // плант слышен рядом — выйти на линию, откуда видно ставящего (если нас там не меньше)
  var PH = teamIntel.CT.plantHeard;
  if(team === "CT" && !planted && PH && tick - PH.tick < PLANT_TICKS + 32){
    var tN = Math.max(1, intelEstimate("CT", PH.x, PH.y, 450, 5*TICK_HZ).n), cN = cts.filter(function(o){ return Math.hypot(o.x-PH.x, o.y-PH.y) < 600; }).length;
    if(cN >= tN || ROUND_TIME_SEC - (simTime - roundStartTime) < 12) pois.push({x:PH.x, y:PH.y, r:450, see:true, w:1.5});
  }
  // ставят бомбу — двое ближних прикрывают ставящего (линия на подходы к нему)
  var car = bomb.state === "carried" ? bomb.carrier : null;
  if(team === "T" && car && car.alive && (car.planting || (car.post && car.post.tag === "plantspot" && Math.hypot(car.x-car.post.x, car.y-car.post.y) < 120))){
    var cov = cts.filter(function(o){ return o !== car && !o._sawEnemy && Math.hypot(o.x-car.x, o.y-car.y) < 550; })
      .sort(function(a, c){ return Math.hypot(a.x-car.x, a.y-car.y) - Math.hypot(c.x-car.x, c.y-car.y); }).slice(0, 2);
    cov.forEach(function(o){ pois.push({x:car.x, y:car.y, r:260, see:true, w:1.2, who:o.id}); });
  }
  // размен: враг, которого свои видят/видели только что рядом с тиммейтом, — его линию держат ближние
  foes.forEach(function(f){ if(tick - f.tick > 1.5*TICK_HZ) return;
    if(picEvents(team).some(function(sg){ return sg.type === "died" && tick - sg.tick < 3*TICK_HZ && Math.hypot(sg.x-f.x, sg.y-f.y) < 700; }) ||
       cts.some(function(o){ return o._sawEnemy && Math.hypot(o.x-f.x, o.y-f.y) < 700; }))
      pois.push({x:f.x, y:f.y, r:650, see:true, w:0.9, near:600}); });
  // свой погиб, а где убийца — известно: двое ближайших сразу берут его линию (размен)
  var trades = [];
  picEvents(team).forEach(function(sg){ if(sg.type !== "died" || tick - sg.tick > 3*TICK_HZ) return;
    var k = foes.filter(function(f){ return Math.hypot(f.x-sg.x, f.y-sg.y) < 900 && tick - f.tick < 3*TICK_HZ; })
      .sort(function(a, c){ return c.tick - a.tick; })[0]; if(!k) return;
    var ids = cts.filter(function(o){ return Math.hypot(o.x-sg.x, o.y-sg.y) < 900; })
      .sort(function(a, c){ return Math.hypot(a.x-sg.x, a.y-sg.y) - Math.hypot(c.x-sg.x, c.y-sg.y); }).slice(0, 2).map(function(o){ return o.id; });
    if(ids.length) trades.push({x:k.x, y:k.y, r:650, see:true, w:2.0, ids:ids, key:sg.tick+"|"+k.id}); });
  // опустевшие углы и просьбы — кому они достаются (один раз на запись)
  T.vac.forEach(function(v){ if(!v.resp){ var rp = teamResponder(team, v, v.by); v.resp = rp ? rp.b.id : "-"; v.ok = rp && !teamNeededHere(team, rp.b); } });
  T.req.forEach(function(q){ if(!q.resp){ var rp = teamResponder(team, q, q.by); q.resp = rp ? rp.b.id : "-";
    q.ok = !!(rp && !teamNeededHere(team, rp.b) && rp.cost < 9);
    if(rp) newsAdd(rp.b, {k: q.ok ? "go" : "cant", x:q.x, y:q.y, to:q.by}); } });
  cts.forEach(function(b, i){
    if(b.defusing || b.planting) return;
    var myTr = trades.filter(function(P){ return P.ids.indexOf(b.id) >= 0; });
    var trNew = myTr.some(function(P){ return b._trKey !== P.key; });
    var due = trNew || !b.post || !b._act || b._act.round !== roundNum || (tick + i*6) % ACT.every === 0;
    if(!due) return;
    if(trNew) b._trKey = myTr[myTr.length-1].key;
    if(b.nadeTask || (b.post && /^(lineup|pickup)/.test(b.post.tag||""))) return;   // бросок по лайнапу / подбор — свои исполнители
    if(b._sawEnemy && !b._reloading) return;                                        // в бою место не меняют
    if(tick < (b.blindUntil||0)) return;
    if(!trNew && actRun(b, team)) return;                                           // идёт короткий ход (пик, подпуш, проба…)
    if(trNew && b._act && b._act.v) b._act = null;                                  // размен важнее
    // засветился (стрелял, ранен, по мне стреляли), а их рядом ещё много — сменить позицию
    var burned = tick - (b.lastShotTick||-1e9) < 3*TICK_HZ || tick - (b._hurtT||-1e9) < 4*TICK_HZ || tick - (b._shotAtT||-1e9) < 3*TICK_HZ;
    var foesNear = foes.filter(function(f){ return Math.hypot(f.x-b.x, f.y-b.y) < 1300; }).length + (burned && b.heardSound && tick - b.heardSound.tick < 2*TICK_HZ ? 1 : 0);
    var X = {mode:"hold", ph: planted ? (team === "T" ? "post" : "retake") : "pre", myArea:(ct.assign || {})[b.id] || null, mates:teamMatePts(team, b), foes:foes, pois:[], cur:b._act && b._act.round === roundNum ? b._act : null,
      riskMul: (b.hp < 50 ? 1.6 : 1) * (b._reloading ? 2 : 1) * actMoneyRisk(team), noCur: !!b._reloading,
      repos: burned && foesNear >= 1 && !(planted && team === "CT") ? {x:b.x, y:b.y} : null, foesNear:foesNear, burned:burned};
    myTr.forEach(function(P){ X.pois.push(P); });
    pois.forEach(function(P){ if(P.near && Math.hypot(P.x-b.x, P.y-b.y) > P.near) return; if(P.who && P.who !== b.id) return; X.pois.push(P); });
    T.vac.forEach(function(v){ if(v.resp === b.id && v.ok) X.pois.push({x:v.x, y:v.y, r:300, side:v.side, w:1.4, vac:v}); });
    T.req.forEach(function(q){ if(q.resp === b.id && q.ok) X.pois.push({x:q.x, y:q.y, r:450, w:1.4, req:q}); });
    // (К13) взял угол по просьбе — держит, пока ситуация не изменилась (контакт, размен) или 15 с
    if(b._keep && (b._keep.round !== roundNum || tick > b._keep.until || burned || trNew)) b._keep = null;
    X.keep = b._keep;
    var prev = b._act;
    var picked = team === "CT" ? ctChoose(b, X, ct, cts, C) : tChoose(b, X, ct, cts, C);
    if(!picked || picked === true) return;
    // сказать, что беру вход, если ухожу на другой (команда должна знать, кто где)
    if(!b._keep && X.pois.some(function(P){ return (P.vac || P.req) && Math.hypot(P.x-picked.x, P.y-picked.y) < P.r; })){
      b._keep = {x:picked.x, y:picked.y, until:tick + 15*TICK_HZ, round:roundNum};
      X.pois.forEach(function(P){ if(P.vac) P.vac.done = true; if(P.req) P.req.done = true; });
    }
    var claimed = X.mates.some(function(m){ var r = T.rows[m.id]; return r && r.claim && r.claim.side === picked.side && tick - r.claim.t < 10*TICK_HZ; });
    if(picked && !claimed && X.mode === "hold" && (!prev || prev.round !== roundNum || prev.side !== picked.side) && Math.hypot(picked.x-b.x, picked.y-b.y) > 250)
      newsAdd(b, {k:"take", x:picked.x, y:picked.y, side:picked.side, area:picked.area, name:picked.name.split(" / ")[0]});
    // ухожу из района с угла, откуда может выйти враг, а его больше никто не держит, — «подержите»
    if(picked && prev && prev.round === roundNum && prev.mode === "hold" && prev.side && prev.area !== picked.area && Math.hypot(b.x-prev.x, b.y-prev.y) < 80 &&
       !X.mates.some(function(m){ return m.side === prev.side; }) && teamThreat(team, prev) > 0.15)
      newsAdd(b, {k:"holdmine", x:prev.x, y:prev.y, side:prev.side});
  });
}
// CT: план — район (ct.assign), ретейк (фазы), сейв
function ctChoose(b, X, ct, cts, C){
  // ---- сейв: ретейк безнадёжен — подальше от бомбы и известных T, не на виду ----
  if(ct.saving || b._awpSave){ actSave(b); return true; }
  var picked = null, planted = bomb.state === "planted", R = planted ? bomb.retake : null;
  if(planted && R){
    var bp = ctBombPos();
    if(R.defId === b.id && (R.phase === "go") && retakeDefGo(b, R, cts)){
      b._act = {x:bp.x, y:bp.y, mode:"defuse", round:roundNum, t:tick}; setPost(b, bp, null, true, "defuse"); return true; }
    if(R.phase === "gather" || R.phase === "util"){
      // точка сбора: укрытие своей стороны у входа на сайт с бомбой, бомбу оттуда не видно
      X.mode = "gather"; X.look = bp;
      var G = spotsOf(C, "CT", function(c){ var d = Math.hypot(c.x-bp.x, c.y-bp.y); return d > 220 && d < 700 && !hasLOS(c.x, c.y, bp.x, bp.y); });
      if(!G.length) G = [{x:GEO[bomb.site].ctEntry.x, y:GEO[bomb.site].ctEntry.y, meet:bp}];
      picked = actPick(b, G, X, function(){ return "gather"; });
    } else {
      // заход: укрытия у бомбы с линией на неё
      X.mode = "go"; X.look = bp;
      var Gg = spotsOf(C, "CT", function(c){ var d = Math.hypot(c.x-bp.x, c.y-bp.y); return d > 60 && d < 480 && hasLOS(c.x, c.y, bp.x, bp.y); })
        .map(function(c){ return spotCand(c, {meet:bp, looks:null}); });
      if(!Gg.length) Gg = [{x:bp.x, y:bp.y, meet:bp}];
      picked = actPick(b, Gg, X, function(){ return R.entryId === b.id ? "retakeEntry" : "retake"; });
    }
  } else {
    var H = C.filter(function(c){ return c.ct && c.area; });
    // просьба / опустевший угол достались мне — точки рядом с ними годятся, даже вне районов
    X.pois.forEach(function(P){ if(P.w >= 1.4) C.forEach(function(c){ if(c.ct && !c.area && Math.hypot(c.x-P.x, c.y-P.y) < P.r && H.indexOf(c) < 0) H.push(c); }); });
    var sty = CT_STYLE[(ct.setup && ct.setup.id) || ""] || {};
    // играть от ретейка: по плану (ретейк-сетап) или их стак на моём сайте, а нас там меньше
    var my = X.myArea;
    if(my === "A" || my === "B"){
      var callN = ct.call && ct.call.site === my ? ct.call.count : 0, mineN = teamAreaCount("CT", my, b) + 1;
      if(sty.deep === my || (callN >= 3 && mineN <= callN - 1.5)) X.deep = my;
    }
    picked = actPick(b, H.concat(ctVariants(b, X, ct, cts, C, sty)), X, function(c){ return (X.deep === c.area ? "retakeHold:" : "hold:")+c.name; });
  }
  return picked;
}
// характер расстановки: где охотнее пикают / подпушивают, где играют от ретейка
var CT_STYLE = {midAggro:{M:0.7, push:"M"}, redRoom:{M:0.5}, pickA:{A:0.6}, pickB:{B:0.6}, cavePush:{B:0.5, push:"B"},
  stackA:{A:0.3}, stackB:{B:0.3}, retakeA:{deep:"A"}, retakeB:{deep:"B"}, std111:{}, std212:{}};
// варианты CT кроме «держать»: ранний пик, подпуш парой, джиггл, отход.
// Выгода каждого — из того, что игрок знает: время раунда, картина команды
// (давно ли инфа, мог ли враг дойти), роль, деньги, гранаты, HP, есть ли размен
function ctVariants(b, X, ct, cts, C, sty){
  var out = [], my = X.myArea, sec = simTime - roundStartTime, mood = actMood(b), team = "CT";
  var quiet = (tick - teamLastInfo(team))/TICK_HZ, aT = aliveCount("T"), aC = cts.length;
  var util = b.nades && (b.nades.flash > 0 || b.nades.smoke > 0), aggr = b.tRole === "mid" || b.tRole === "roamer" || b.tRole === "rotator";
  var Tm = TEAM.CT, busy = function(v){ return cts.some(function(o){ return o !== b && o._act && o._act.v === v && o._act.round === roundNum; }); };
  var home = X.cur && !X.cur.v ? {x:X.cur.x, y:X.cur.y, meet:null, looks:X.cur.looks} : null;
  // передние места моего района (ближе к врагу, чем обычно держат): у сайта — ближе к входу T,
  // чем 0,65 пути от центра сайта; на миде — впереди CT-мида в сторону T
  var fwd = C.filter(function(c){ if(!c.ct || !my) return false;
    if(my === "M") return (c.area === "M" || !c.area) && Math.hypot(c.x-GEO.tMid.x, c.y-GEO.tMid.y) < 0.8*Math.hypot(GEO.ctMid.x-GEO.tMid.x, GEO.ctMid.y-GEO.tMid.y);
    var g = GEO[my], s0 = SITES[my]; return (c.area === my || (!c.area && Math.hypot(c.x-s0.x, c.y-s0.y) < 1100)) &&
      Math.hypot(c.x-g.tEntry.x, c.y-g.tEntry.y) < 0.65*Math.hypot(s0.x-g.tEntry.x, s0.y-g.tEntry.y); });
  var foeReach = function(c){ return c.from >= 0 ? reachW("CT", c.from, c.hold) : 0; };
  var wantInfo = ct.wantInfo === b.id;
  // ранний пик за инфой: первые 8–25 с (или IGL просит чекнуть), выйти на линию подхода, увидеть — назад
  if(my && home && actCdOk(b, "peek") && !busy("peek") && !ct.call && aC >= aT && ((sec > 8 && sec < 25) || wantInfo)){
    fwd.forEach(function(c){
      var mate = cts.some(function(o){ return o !== b && Math.hypot(o.x-c.x, o.y-c.y) < 650; });
      var r = foeReach(c), info = picNear("CT", c.x, c.y, 700) ? 0.1 : 0.6;
      var g = (0.5 + info + (aggr ? 0.35 : 0) + (util ? 0.3 : 0) + (mate ? 0.3 : -0.4) + (sty[my] || 0) + (wantInfo ? 0.8 : 0) +
              ((teamEco.CT.enemyGuess || {}).eco ? 0.2 : 0))*mood - 1.4*r*actMoneyRisk(team) - (b.hp < 70 ? 0.6 : 0);
      out.push(spotCand(c, {v:"peek", gain:g, home:home, area:null}));
    });
  }
  // подпуш парой: инфы давно нет, нас не меньше, есть граната — «пушу X, иди со мной»
  if(my && home && actCdOk(b, "push") && !busy("push") && !ct.call && sec > 15 && sec < 70 && aC >= aT && aC >= 3 && (quiet > 14 || sty.push === my)){
    fwd.forEach(function(c){
      var r = foeReach(c);
      var g = (0.3 + Math.min(1, quiet/25)*0.6 + (util ? 0.4 : -0.3) + (aggr ? 0.3 : 0) + (sty.push === my ? 0.6 : 0) + (wantInfo ? 0.6 : 0))*mood - 1.2*r*actMoneyRisk(team) - (b.hp < 70 ? 0.8 : 0);
      out.push(spotCand(c, {v:"push", gain:g, home:home, area:null, say:{k:"need2", push:true, x:c.x, y:c.y}}));
    });
  }
  out = out.concat(sharedVariants(b, X, "CT", C, home));
  return out;
}
// варианты обеих сторон: джиггл на звук и отход
function sharedVariants(b, X, team, C, home){
  var out = [];
  // джиггл: стою на угле, слышу шаги врага, но не вижу — короткий выход-уход
  if(home && b.atPost && b.post && b.post.look && actCdOk(b, "jiggle") && !b._sawEnemy){
    var E = (b.ears || []).filter(function(e){ return e.team !== team && (e.kind === "steps" || e.kind === "water") && tick - e.tick < 1.5*TICK_HZ && Math.hypot(e.x-b.x, e.y-b.y) < 1000; });
    if(E.length){
      var lk = b.post.look, a = Math.atan2(lk.y-b.y, lk.x-b.x), jx = b.x + Math.cos(a)*48, jy = b.y + Math.sin(a)*48;
      if(!insideSolidWall(jx, jy) && !segCrossesManualWalls(b.x, b.y, jx, jy))
        out.push({x:jx, y:jy, meet:lk, v:"jiggle", gain:0.4 + 0.5*actMood(b) + (X.cur ? W_CUR() : 0), home:{x:b.x, y:b.y, meet:lk}, name:"", open:0, dirs:0, area:null});
    }
  }
  // отход: ранен, размена нет, их рядом больше — назад, туда, где меня не видят
  if(b.hp < 50 && X.foesNear >= 2 && !X.mates.some(function(m){ return Math.hypot(m.x-b.x, m.y-b.y) < 500; })){
    C.forEach(function(c){ if(team === "CT" ? !c.ct : !c.t) return; var d = Math.hypot(c.x-b.x, c.y-b.y); if(d < 250 || d > 900) return;
      var seen = X.foes.some(function(f){ return hasLOS(c.x, c.y, f.x, f.y); }); if(seen) return;
      var far = Math.min.apply(null, X.foes.map(function(f){ return Math.hypot(c.x-f.x, c.y-f.y); }).concat([1500]));
      out.push(spotCand(c, {v:"fallback", gain:0.6 + 1.2*(50 - b.hp)/50 + Math.min(1, far/1200)*0.6, area:null})); });
  }
  return out;
}
function W_CUR(){ return ACT.W.cur + 0.1; }
// T: план IGL — у каждого точка сбора (сетап), выход на сайт по готовности,
// бомба (плант, за бомбой), пост-плант, анти-дефуз, отход от взрыва, сейв
function tChoose(b, X, tt, ts, C){
  var A = (tt.stage || {})[b.id], k = tt.site, g = GEO[k], site = SITES[k];
  if(tt.saving || b._awpSave || (tt._defLate && bomb.state === "planted")){ actSave(b); return true; }
  var car = bomb.state === "carried" && bomb.carrier === b;
  if(bomb.state === "planted"){
    var bp = {x:bomb.x, y:bomb.y}, gs = GEO[bomb.site];
    if(tt.flee){ var fp = bombFleePoint(b) || gs.tStage; b._act = {x:fp.x, y:fp.y, mode:"flee", round:roundNum, t:tick}; setPost(b, fp, bp, true, "flee"); return true; }
    if(tt.antiDef && Math.hypot(b.x-bp.x, b.y-bp.y) < 1100 && !(tt.lateIds && tt.lateIds[b.id])){
      // дефузят — все, кто успевает, на линию к бомбе
      X.mode = "anti"; X.look = bp; X.riskMul *= 0.4;
      var AD = spotsOf(C, "T", function(c){ var d = Math.hypot(c.x-bp.x, c.y-bp.y); return d > 40 && d < 360 && hasLOS(c.x, c.y, bp.x, bp.y); });
      if(!AD.length) AD = [{x:bp.x, y:bp.y, meet:bp}];
      b._stopPlantUntil = tick + 30;
      return actPick(b, AD, X, function(){ return "antidefuse"; });
    }
    // пост-плант: разойтись и держать бомбу с дистанции, кроссфаером (не сидеть на ней), тянуть время
    X.mode = "pp"; X.look = bp;
    var mAng = ts.filter(function(o){ return o !== b && Math.hypot(o.x-bp.x, o.y-bp.y) < 1100; }).map(function(o){ return Math.atan2(o.y-bp.y, o.x-bp.x); });
    var ppC = function(c, d){ var a = Math.atan2(c.y-bp.y, c.x-bp.x), cross = mAng.every(function(m){ return Math.abs(((a-m+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI) > 0.8; });
      return spotCand(c, {gain:(cross && mAng.length ? 0.6 : 0) + (d > 350 && d < 750 ? 0.3 : 0)}); };
    var PP = spotsOf(C, "T", function(c){ var d = Math.hypot(c.x-bp.x, c.y-bp.y); return d > 150 && d < 950 && hasLOS(c.x, c.y, bp.x, bp.y); })
      .map(function(c){ return ppC(c, Math.hypot(c.x-bp.x, c.y-bp.y)); });
    if(!PP.length) PP = [{x:gs.tStage.x, y:gs.tStage.y, meet:bp}];
    return actPick(b, PP.concat(sharedVariants(b, X, "T", C, null)), X, function(c){ return "postplant:"+(c.name||""); });
  }
  if(bomb.state === "dropped" && tt.fetchId === b.id){
    b._act = {x:bomb.x, y:bomb.y, mode:"fetch", round:roundNum, t:tick}; setPost(b, {x:bomb.x, y:bomb.y}, null, false, "fetch"); return true; }
  var go = tt.phase === "execute" && (tt.go || {})[b.id], role = b.tRole, secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  var onSiteMates = ts.filter(function(o){ return o !== b && Math.hypot(o.x-site.x, o.y-site.y) < 400; }).length;
  if(go && car){
    // бомба идёт за группой: ставить, когда свои уже на сайте (или время поджимает)
    if(onSiteMates === 0 && secLeft > 25 && tick - (tt.execStart||tick) < 8*TICK_HZ && ts.length > 1){
      b._act = {x:g.tEntry.x, y:g.tEntry.y, mode:"carry", round:roundNum, t:tick}; setPost(b, g.tEntry, site, true, "carry"); return true; }
    if(BAL.plantChoice && !tt.plantPick && Math.hypot(b.x-site.x, b.y-site.y) < 500) choosePlant(tt);
    var pp = tt.plantPick ? tt.plantPick.pt : (site.plant || site);
    b._act = {x:pp.x, y:pp.y, mode:"plant", round:roundNum, t:tick}; setPost(b, pp, g.ctEntry, true, "plantspot"); return true;
  }
  if(go){
    // выход с ролями: энтри — первым и глубже всех; второй — за ним на размен;
    // AWP — линию на подходы CT с дистанции; остальные — укрытия на сайте
    X.mode = "take";
    var entry = ts.filter(function(o){ return o.tRole === "entry"; })[0];
    var buddy = entry && entry !== b ? ts.filter(function(o){ return o !== entry && !(bomb.state === "carried" && bomb.carrier === o); })
      .sort(function(p, q){ return Math.hypot(p.x-entry.x, p.y-entry.y) - Math.hypot(q.x-entry.x, q.y-entry.y); })[0] : null;
    var TK = spotsOf(C, "T", function(c){ return c.area === k; }).map(function(c){
      var depth = Math.min(1, Math.hypot(c.x-g.tStage.x, c.y-g.tStage.y)/700), dS = Math.hypot(c.x-site.x, c.y-site.y);
      var gn = role === "entry" ? 1.0*depth : role === "awp" ? (dS > 350 ? 0.7 : 0) : 0;
      return spotCand(c, {gain:gn}); });
    if(!TK.length) TK = [{x:site.x, y:site.y, meet:g.ctEntry}];
    if(buddy === b){ var ea = Math.atan2(g.tStage.y-entry.y, g.tStage.x-entry.x), fx = entry.x + Math.cos(ea)*170, fy = entry.y + Math.sin(ea)*170;
      if(!insideSolidWall(fx, fy)) TK.push({x:fx, y:fy, meet:entry.post && entry.post.look || g.ctEntry, v:"trade", gain:1.3, name:"за энтри", area:k}); }
    return actPick(b, TK.concat(sharedVariants(b, X, "T", C, null)), X, function(c){ return (role === "entry" ? "entry" : "take")+k+":"+(c.name||""); });
  }
  // сетап: план IGL — точка сбора; там — контроль области (стоять и слушать с разменом),
  // укрытие, проба за инфой; лёркер — тихо у другого сайта
  var P = A ? A.pt : g.tStage, sty = T_STYLE[tt.tac.style] || {}, mood = actMood(b), look = A && A.look || g.tEntry;
  if(A && A.via && A.via.length && !A.routed){ A.routed = true; startRoute(b, A.via, "plan"+roundNum+":"+A.key); }
  X.mode = "stage";
  // контроль области у точки сбора — стоять и слушать с разменом на местах рядом с ней
  // (в 300 px; нет таких — два ближайших в 700 px; нет и их — сама точка сбора)
  var near = C.filter(function(c){ return c.t; }).map(function(c){ return [c, Math.hypot(c.x-P.x, c.y-P.y)]; }).sort(function(a, q){ return a[1] - q[1]; });
  var SC = near.filter(function(e){ return e[1] < 300; }); if(!SC.length) SC = near.filter(function(e){ return e[1] < 700; }).slice(0, 2);
  var ST = SC.map(function(e){ return spotCand(e[0], {gain:0.25 + (sty.control || 0), area:A ? A.area : k}); });
  if(!ST.length) ST.push({x:P.x, y:P.y, meet:look, gain:0.25 + (sty.control || 0), name:"", area:A ? A.area : k});
  var home = {x:ST[0].x, y:ST[0].y, meet:ST[0].meet, looks:ST[0].looks};
  if(role === "lurker"){ var oth = k === "A" ? "B" : "A", ge = GEO[oth].tEntry;
    C.forEach(function(c){ if(c.t && Math.hypot(c.x-ge.x, c.y-ge.y) < 520) ST.push(spotCand(c, {v:"lurk", gain:0.9, area:oth})); }); }
  // проба: инфы нет, до выхода ещё есть время — один выходит под флешку, смотрит, откатывается
  var sec = simTime - roundStartTime, quiet = (tick - teamLastInfo("T"))/TICK_HZ;
  var busyP = ts.some(function(o){ return o !== b && o._act && o._act.v === "probe" && o._act.round === roundNum; });
  if(role !== "lurker" && role !== "awp" && !busyP && actCdOk(b, "probe") && sec > 12 && (tt.execTick - tick) > 9*TICK_HZ && quiet > 8 && Math.hypot(b.x-P.x, b.y-P.y) < 350){
    var pt = null, bd = 450; C.forEach(function(c){ if(!c.t) return; var d = Math.hypot(c.x-look.x, c.y-look.y); if(d < bd){ bd = d; pt = c; } });
    var tgt = pt || {x:look.x, y:look.y, meet:null};
    var util = b.nades && b.nades.flash > 0, mate = ts.some(function(o){ return o !== b && Math.hypot(o.x-P.x, o.y-P.y) < 400; });
    var gp = (0.5 + Math.min(1, quiet/20)*0.5 + (util ? 0.3 : 0) + (mate ? 0.3 : -0.4) + (sty.probe || 0) + (role === "entry" ? 0.2 : 0))*mood - (b.hp < 60 ? 0.6 : 0);
    ST.push({x:tgt.x, y:tgt.y, meet:tgt.meet || site, looks:tgt.looks || null, lib:tgt.lib, ph:tgt.ph, v:"probe", gain:gp, home:home, name:tgt.name || "", open:tgt.open, dirs:tgt.dirs, area:null});
  }
  return actPick(b, ST.concat(sharedVariants(b, X, "T", C, X.cur && !X.cur.v ? {x:X.cur.x, y:X.cur.y, meet:null, looks:X.cur.looks} : null)), X, function(c){ return "stage"+(A ? A.area : k); });
}
// характер тактики T: дефолт — контроль областей и пробы; сплит — контроль; раш — без проб
var T_STYLE = {"default":{probe:0.5, control:0.4}, split:{control:0.3, probe:0.1}, exec:{probe:0.2}, fake:{probe:0.1}, rush:{probe:-9, control:-9}};
// сейв: место своей стороны подальше от бомбы и от известных врагов, откуда их не видно
function actSave(b){
  if(b._act && b._act.mode === "save" && b._act.round === roundNum && b._act.ok){ setPost(b, b._act, null, true, "save"); return; }
  var ts = picRecent(b.team, 15*TICK_HZ), best = null, bs = -1e9, C = teamCovers();
  C.forEach(function(c){
    if(b.team === "CT" ? !c.ct : !c.t) return;
    if(bomb && bomb.state === "planted" && Math.hypot(c.x-bomb.x, c.y-bomb.y) < BOMB_KILL_RADIUS + 150) return;
    var dT = 1e9, seen = false;
    ts.forEach(function(t){ dT = Math.min(dT, Math.hypot(c.x-t.x, c.y-t.y)); if(hasLOS(c.x, c.y, t.x, t.y)) seen = true; });
    if(seen || dT < 500) return;
    if(b.team === "T" && Math.min(Math.hypot(c.x-SITES.A.x, c.y-SITES.A.y), Math.hypot(c.x-SITES.B.x, c.y-SITES.B.y)) < 500) return;
    var s = Math.min(dT, 1200)*0.6 - Math.hypot(c.x-b.x, c.y-b.y) - 300*(c.open || 0) - (b.team === "T" ? 0.15*Math.hypot(c.x-T_SPAWN.x, c.y-T_SPAWN.y) : 0);
    if(s > bs){ bs = s; best = c; }
  });
  var p = best || (b.team === "T" ? {x:T_SPAWN.x, y:T_SPAWN.y} : {x:CT_SPAWN.x, y:CT_SPAWN.y});
  var ph = bomb && bomb.state === "planted" ? (b.team === "T" ? "post" : "retake") : "pre";
  b._act = {x:p.x, y:p.y, mode:"save", round:roundNum, ok:true, t:tick, looks:p.lib && p.ph === ph ? p.looks : null};
  setPost(b, p, bomb && bomb.state === "planted" ? {x:bomb.x, y:bomb.y} : null, true, "save");
}
