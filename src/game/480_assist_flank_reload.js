// ---- дабл-пик: помочь тиммейту в перестрелке ----
// Раньше, если тиммейт в упор рядом перестреливался, а самому врага не видно
// (стоял за углом/смотрел свой угол), бот так и стоял: реакции на "рядом идёт
// бой" не было — только размен ПОСЛЕ смерти. Теперь: тиммейт ≤160px уже ~0.3с
// видит врага и стреляет, мне его не видно — выхожу на соседнюю точку с линией
// на того врага (рядом с тиммейтом, но не в его же клетку), двое на одного.
// (v284, владелец 14.10: «мид не идёт в спину A main» — общее для любой карты) тиммейт дальше (≤900 px) уже ~0,3 с в перестрелке,
// я не в бою и мой пост не держит сайт: захожу на его врага с другой стороны — точка с линией на врага под углом 50–120° к
// линии тиммейта (кроссфаер, pickSpots.cross), путь не дальше 1000 px и не идёт в лоб (≥200 px от врага). Числа — проектные
// (v284 → v292) точка захода с другой стороны: к врагу ep под углом 50–120° от линии тиммейта (перекрёстный огонь), путь ≤ 1000 px
// и не мимо врага ближе 200 px. Одно место — для flankAssist и для «добить последних» (endgameBrain)
function flankSpot(b, mate, ep){
  // уже стою под другим углом (50–120° от линии тиммейта) — не обходить, а дожать со своей стороны: по своему пути к врагу до
  // первой точки, откуда его видно (идёт на неё с прицелом на врага — стрелять начнёт, как только тот покажется; Alley → CT Spawn: враг за углом виден с 5 px). Раньше точки обхода были только «за» врагом, и путь к ним
  // шёл мимо него — заход отменялся (игрок 6 в Connector, отметка 14.10, тик 3865)
  var aMe = _angOff(Math.atan2(b.y-ep.y, b.x-ep.x), Math.atan2(mate.y-ep.y, mate.x-ep.x));
  if(aMe >= 0.87 && aMe <= 2.1){
    var pp = pathPts(b.x, b.y, ep.x, ep.y), prev = {x:b.x, y:b.y};
    if(pp.length && polyLen(pp) <= 1000) for(var i=0;i<pp.length;i++){
      var w = {x:pp[i][0], y:pp[i][1]};
      for(var k=1;k<=4;k++){ var q = {x:prev.x+(w.x-prev.x)*k/4, y:prev.y+(w.y-prev.y)*k/4};
        if(hasLOS(q.x, q.y, ep.x, ep.y)) return walk(q); }
      prev = w; }
  }
  var cand = pickSpots("flank"+tick+b.id, ep, 4, {rMin:150, rMax:420, minGap:40, must:[ep], cross:{from:{x:mate.x, y:mate.y}, pt:ep}});
  var sp = null;
  cand.some(function(q){
    var a1 = Math.atan2(q.y-ep.y, q.x-ep.x), a2 = Math.atan2(mate.y-ep.y, mate.x-ep.x), da = _angOff(a1, a2);
    if(da < 0.87 || da > 2.1) return false;
    var pts = pathPts(b.x, b.y, q.x, q.y); if(!pts.length || polyLen(pts) > 1000) return false;
    if(pts.some(function(w){ return Math.hypot(w[0]-ep.x, w[1]-ep.y) < 200; })) return false;
    sp = q; return true; });
  return sp;
}
// (v295, владелец 14.10: раунд 3 — оба игрока B пошли на T4 «с другой стороны», B опустел) на одного врага заходит один:
// команда помнит, кто уже заходит (6 с — как пост захода), остальные держат свои места
var FLANK_CLAIM = {CT:{}, T:{}};
function flankClaim(b, eid, take){
  var C = FLANK_CLAIM[b.team], c = C[eid];
  var busy = c && c.id !== b.id && c.until > tick && bots.some(function(o){ return o.id === c.id && o.alive; });
  if(take && !busy) C[eid] = {id:b.id, until:tick + 6*TICK_HZ};
  return !busy;
}
function flankAssist(b){
  if(b.hp <= LOW_HP || b._fcFlank && tick < b._fcFlank) return false;
  if(b.team === "CT" && b.post && /^(anchor|stack|set:|cts:|clutch|retake)/.test(b.post.tag)) return false;   // держит сайт — не бросает
  if(b.team === "T" && b.tRole === "lurker") return false;
  var mate = null, E = null;
  bots.forEach(function(m){
    if(mate || m === b || !m.alive || m.team !== b.team || !m._sawEnemy || (m.contactStreak||0) < 20) return;
    var d = Math.hypot(m.x-b.x, m.y-b.y); if(d <= (BAL.groupPlay ? 300 : 160) || d > 900) return;
    var e = m._nearestEnemyBot; if(!e || !e.alive) return; mate = m; E = e; });
  if(!mate) return false;
  if(!flankClaim(b, E.id)) return false;
  b._fcFlank = tick + 3*TICK_HZ;
  var ep = {x:E.x, y:E.y};
  var sp = flankSpot(b, mate, ep);
  if(!sp) return false;
  b._reposUntil = 0; b._probeLock = 0;
  setPost(b, sp, ep, true, "repos:flank");
  if(!b.post || b.post.tag !== "repos:flank") return false;
  if(b.state === "hold") leaveHold(b);
  b._reposUntil = tick + 6*TICK_HZ;
  b.lastIntel = {x:ep.x, y:ep.y, tick:tick, src:"call"};
  flankClaim(b, E.id, true);
  voiceLog(b.team, "flank"+b.id, b.id, "захожу на "+E.id+" с другой стороны — помогаю "+mate.id);
  return true;
}
function assistPeek(b){
  if(!BAL.assistPeek || b._sawEnemy || b.planting || b.defusing || b.hp <= LOW_HP) return false;
  if(tick < (b._assistNext||0)) return false;
  if(b.post && /^(defuse|plantspot|lineup|flee|save|repos|tradeR|stopplant|antidefuse|fetch)/.test(b.post.tag)) return false;
  // (v368) носитель выходит вдвоём с тиммейтом, как все (раньше «в дуэли не лезет» — на раше magixx шёл в 400 ед. позади боя)
  var mate = null, E = null;
  bots.forEach(function(m){
    if(mate || m === b || !m.alive || m.team !== b.team || !m._sawEnemy || (m.contactStreak||0) < 20) return;
    if(Math.hypot(m.x-b.x, m.y-b.y) > (BAL.groupPlay ? 300 : 160)) return;
    var e = m._nearestEnemyBot; if(!e || !e.alive || Math.hypot(e.x-b.x, e.y-b.y) > 900) return;
    mate = m; E = e;
  });
  if(!mate) return flankAssist(b);
  b._assistNext = tick + 24;
  // линия есть, но смотрит в другую сторону — разворот на врага по коллу тиммейта
  if(hasVision(b.x, b.y, E.x, E.y)){ b.heardSound = {x:E.x, y:E.y, tick:tick, team:E.team, src:E.id, kind:"call"}; b.lastIntel = {x:E.x, y:E.y, tick:tick, src:"call"}; return false; }
  var ep = {x:E.x, y:E.y};
  var sp = pickSpots("assist"+tick+b.id, BAL.groupPlay ? {x:mate.x, y:mate.y} : {x:(b.x+mate.x)/2, y:(b.y+mate.y)/2}, 3, {rMax: BAL.groupPlay ? 140 : 110, minGap:24, must:[ep]})
    .filter(function(q){ return !spotTaken(b, q) && hasLOS(q.x, q.y, ep.x, ep.y); })[0];   // (v370) рядом, но не плечом к плечу (было > 22)
  if(!sp) return false;
  b._reposUntil = 0; b._probeLock = 0;
  setPost(b, sp, ep, true, "repos:assist");
  if(!b.post || b.post.tag !== "repos:assist") return false;
  if(b.state === "hold") leaveHold(b);
  b._reposUntil = tick + 2*TICK_HZ;
  b.lastIntel = {x:ep.x, y:ep.y, tick:tick, src:"call"}; // знает, куда выходит — прицел на враге (префайр по коллу)
  if(!b._assistVoice || tick - b._assistVoice > 4*TICK_HZ){ b._assistVoice = tick; voiceLog(b.team, "assist"+b.id, b.id, "выхожу с "+mate.id+" на "+E.id+" — дабл!"); }
  return true;
}
function updateReload(b){
  var w = b.weapon; if(!w || !b.alive) return;
  if(b._ammoFor !== w.key){ b._ammoFor = w.key; b.ammo = w.mag; b._reloading = false; b.reloadUntil = 0; }
  if(b._reloading && tick >= b.reloadUntil){ b._reloading = false; b.ammo = w.mag; }
  if(BAL.pistolSwap && b._onPistol) pistolBack(b);
  if(BAL.pistolSwap && !b._reloading && b.ammo <= 0 && pistolSwap(b)) return;
  // после перестрелки про перезаряжается почти всегда, если магазин заметно
  // потрачен (а не только когда он почти пуст) — отсюда и звук перезарядки,
  // на который пикают
  var rlFrac = BAL.soundMore ? 0.75 : 0.35, rlWait = BAL.soundMore ? 96 : 64;
  var tacRl = !b._reloading && b.ammo > 0 && !b._sawEnemy && b.ammo < w.mag*rlFrac && tick - (b.lastShotTick||-999) > rlWait;
  // тактическая перезарядка на виду у известного врага — сначала за укрытие
  // (если патронов ещё не критично мало)
  if(tacRl && BAL.reloadCover && b.ammo > w.mag*0.2 && !b.planting && !b.defusing){
    // (v296) и враг за углом (≤ 900 px, ≤ 4 с — без линии сейчас): выглянет — застанет на перезарядке; укрытие — скрытое от его места
    var ex = exposedTo(b, 900, 4*TICK_HZ, true);
    if(ex.length){ coverForReload(b, ex); tacRl = false; }
  }
  if(!b._reloading && (b.ammo <= 0 || tacRl)){
    // (v296, владелец 14.10: «во время перезарядки не стояли столбом») пустой магазин на виду у известного врага — перезаряжается на ходу:
    // за укрытие рядом (то же, что у тактической перезарядки), а нет укрытия — шаг вбок от линии врага (стрейф, ~50 px — проектное число)
    if(b.ammo <= 0 && BAL.reloadCover && !b.planting && !b.defusing){
      var exE = exposedTo(b, 900, 4*TICK_HZ, true);
      if(exE.length && !coverForReload(b, exE) && !(b._rlCoverT && tick - b._rlCoverT < 3*TICK_HZ && b.post && b.post.tag === "repos:rlcover")){
        var ea = Math.atan2(exE[0].y-b.y, exE[0].x-b.x), sgn = hashRand(tick + b.id.charCodeAt(1)) < 0.5 ? 1 : -1;
        var sq = walk({x: b.x + Math.cos(ea + sgn*Math.PI/2)*50, y: b.y + Math.sin(ea + sgn*Math.PI/2)*50});
        if(sq && !stepBlocked(b.x, b.y, sq.x, sq.y, b)){ b._reposUntil = 0; setPost(b, sq, exE[0], true, "repos:rlcover"); if(b.post && b.post.tag === "repos:rlcover") b._reposUntil = tick + Math.round(w.reload*TICK_HZ); }
      }
    }
    b._reloading = true; b.reloadUntil = tick + Math.round(w.reload*TICK_HZ);
    if(b.ammo <= 0) logEvent(b.id+": перезарядка ("+w.name+", "+w.reload+"с)");
    if(BAL.soundMore) reloadHeard(b, w);
  }
}
var SPRAY_PATTERN = [0, 0.06, 0.13, 0.22, 0.33, 0.46, 0.60, 0.74, 0.86, 0.95];

// (6) паттерн отдачи CS: первые пули почти в точку, дальше подъём вверх
// (~9 пуль), затем качели влево-вправо. Амплитуда — от отдачи оружия
// (AK сильнее M4, M4A1-S мягче, ПП слабее). Возвращает смещение в радианах
function sprayPat(w, i){
  if(!w.recoil || i <= 0) return {x:0, y:0};
  var Y = w.recoil*0.62, X = w.recoil*0.2, d2r = Math.PI/180;
  var y = Y*(1 - Math.exp(-i/4.2));
  var x = i < 7 ? 0.03*i : X*Math.sin((i-7)/2.6) * (w.key === "AK" ? 1.2 : 1);
  return {x:x*d2r, y:y*d2r};
}
