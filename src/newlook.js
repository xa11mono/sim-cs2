// =====================================================================
// НОВЫЙ ВЗГЛЯД (v141): одна оценка вместо очереди из ~15 функций.
// Каждые 8 тиков для каждой команды:
//  1) для каждого живого бота собираем кандидатов — зоны, откуда простреливается
//     его позиция (таблица опасности), и точку взгляда на каждую;
//  2) вес кандидата = сколько врагов вероятно выйдет оттуда (карта вероятностей:
//     враг в самой зоне + враг за её входами, если эти входы никто не видит)
//     × открытость линии × близость × поправки на роль/движение;
//  3) команда делит направления: жадно, от самого важного — кто взял
//     направление, у тех, кто рядом, вес этого же направления падает (LOOK.claim);
//  4) инерция: текущее направление держится, пока новое не лучше заметно
//     (LOOK.stick) или не пришла свежая инфа.
// Всё, что раньше было отдельными правилами (звук, смерть тиммейта, колл, LKP,
// привычки соперника, "спину прикрывает свой", "не смотреть в тиммейта"), —
// теперь либо уже в карте вероятностей, либо один множитель ниже.
// =====================================================================
var LOOK = {
  maxDist: 1100,     // дальше этой дистанции зону как угрозу не рассматриваем
  nbrW: 0.6,         // вклад врага за входом в зону (он оттуда выйдет)
  watchedNbr: 0.25,  // …если этот вход видит тиммейт — враг сначала выйдет на него
  habitW: 0.25,      // любимое место соперника (память прошлых раундов)
  distHold: 700,     // затухание веса с расстоянием, стоя
  distMove: 400,     // …на ходу (ближние углы важнее)
  closeR: 280, closeK: 2.0,      // совсем рядом — не стоять к нему спиной
  freshK: 2.5,       // свежая инфа (видели/слышали ≤3с рядом с точкой)
  postK: 1.5,        // направление поста по сетапу — вес роли, не приказ
  headK: 1.3,        // на ходу: по направлению движения
  behindMove: 0.35,  // на ходу: за спиной (>110°)
  behindMoveCov: 0.15, // …и спину рядом прикрывает тиммейт
  behindHold: 0.5,   // стоя: за спиной относительно поста (>125°)
  mateThere: 0.15,   // в этой зоне/у точки стоит свой
  mateInLine: 0.15,  // на линии взгляда стоит свой (смотрел бы ему в спину)
  claim: 0.2,        // это направление уже взял тиммейт рядом
  claimR: 900,       // "рядом" для дележа направлений
  stick: 1.35,       // бонус текущему направлению (инерция)
  minDwell: 48,      // тиков (~0.75с) минимум на одном направлении без свежей инфы
  switchK: 2.0,      // раньше minDwell переключаемся, только если новое в 2 раза лучше
  timingW: 0,        // вес "сюда враг может успеть раньше всего" (когда инфы нет)
  timingSec: 12,     // за сколько секунд до возможного прихода врага начинаем туда смотреть
  entryExp: 0.9,     // открытость прохода в свою зону (он всегда простреливает позицию)
  uncheckW: 0.05,    // вес непроверенного угла, куда враг мог успеть (когда реальной инфы нет)
  reachSlack: 4,     // сек: запас к таймингу — "мог прибежать чуть раньше расчёта"
  recheckSec: 8,     // сек: через сколько проверенный угол снова считается непроверенным
  uncheckWalk: 0.13, // для шифта: непроверенный угол рядом с путём — идём тихо
  contactW: 1.2,     // свежий звук/вижу-потерял рядом (≤1.5с, ≤700px) — даже в своей же зоне
  rearMargin: 150,   // px пути: проход дальше от врага, чем я, на это — мой тыл
  rearInfo: 0.15,    // …но если там по инфе вероятен враг (люркер, фланг) — смотрим
  proLook: 0.035,    // вес "куда смотрят про с этой точки" (× согласованность): ниже любой реальной инфы
  claimMin: 0.08,    // делить направления в команде, только если угроза заметная
  postBase: 0.004,   // вес угла поста, когда угроз нет совсем
  minScore: 0.0005    // ниже — "ничего не угрожает": смотрим по ходу / на пост
};
// "не проверено": зону давно (или никогда) не видел никто из своих, и враг по
// таймингу мог туда успеть (с запасом: тайминг — оценка, враг мог бежать быстрее).
// 0 — только что проверили или враг туда не мог попасть; 1 — давно не смотрели.
var LAST_CLEAR = {CT:{}, T:{}};
var _ED = {};
function enemySpawnDist(team){
  if(_ED[team] && _ED[team].n === BZ.ids.length) return _ED[team].D;
  var sp = team === "CT" ? T_SPAWN : CT_SPAWN, z0 = bzOf(sp.x, sp.y);
  var D = bzDist(z0 >= 0 ? [z0] : []); _ED[team] = {n:BZ.ids.length, D:D}; return D;
}
function uncheckedW(team, j){
  var R = REACH[team];
  if(R && R[j] - tick > LOOK.reachSlack*TICK_HZ) return 0;
  if(R && !isFinite(R[j])) return 0;
  var lc = (LAST_CLEAR[team]||{})[j], age = lc == null ? 1e9 : tick - lc;
  return Math.min(1, age/(LOOK.recheckSec*TICK_HZ));
}
// тыл: зона дальше от вражеского спавна, чем моя, и по инфе там никого — враг
// туда может попасть только через нас или тиммейтов (Alley, 90, First Lane у CT)
function isRearZone(team, zb, j){
  if(!BAL.rearCut) return false;
  var ED = enemySpawnDist(team);
  if(!(ED[j] > ED[zb] + LOOK.rearMargin)) return false;
  if(beliefZoneKnown(team, j) >= LOOK.rearInfo) return false;
  if(BZ.cent[j] && freshThreatNear(team, BZ.cent[j])) return false;
  return true;
}
// (v149) "куда смотреть отсюда без инфы": видимый проход, за которым зона
// ближе всего к вражескому спавну — откуда враг придёт раньше всего. Тыл
// (дальше от врага, чем я) не берётся. Кэш по клетке 24px.
var EWL = {};
function enemywardLook(team, p){
  if(!BZ.portal) bzPortals();
  var k = team+Math.round(p.x/24)+","+Math.round(p.y/24); if(k in EWL) return EWL[k];
  var ED = enemySpawnDist(team), zp = bzOf(p.x, p.y), best = null, bs = Infinity;
  if(zp >= 0) BZ.portal.forEach(function(row, i){ for(var js in row){ var j = +js, q = row[j];
    // проход из зоны i в зону j, смотрим "в сторону j"
    var d = Math.hypot(q.x-p.x, q.y-p.y); if(d < 60 || d > 900) continue;
    if(j === zp) continue;                          // проход в мою же зону (он у меня за спиной)
    if(!(ED[j] < ED[i])) continue;                  // только проходы, ведущие к врагу
    if(ED[j] > ED[zp] + LOOK.rearMargin) continue;  // не в тыл
    if(!hasLOS(p.x, p.y, q.x, q.y)) continue;
    var sc = ED[j] + 0.35*d;                        // раньше всего враг + не слишком далеко
    if(sc < bs){ bs = sc; best = {x:q.x, y:q.y}; } } });
  EWL[k] = best; return best;
}
// (v151) где враг появится, если пойдёт из зоны j ко мне: последняя видимая
// мне точка его пути по навмешу (угол, из-за которого он выйдет) — туда и
// пре-эйм. Кэш по клетке 24px и зоне.
var APPEAR = {};
function appearPoint(o, j){
  var c = BZ.cent[j]; if(!c) return null;
  var k = Math.round(o.x/24)+","+Math.round(o.y/24)+"|"+j;
  if(k in APPEAR) return APPEAR[k];
  var wp = buildWaypointPath(c.x, c.y, 0, o.x, o.y, 0), last = null;
  // идём по пути врага к нам: первая точка, которую видно, — место появления
  for(var i=0; i<wp.length; i++){ var q = {x:wp[i][0], y:wp[i][1]}, d = Math.hypot(q.x-o.x, q.y-o.y);
    if(d < 50) break;
    if(hasLOS(o.x, o.y, q.x, q.y)){ last = q; break; } }
  if(Object.keys(APPEAR).length > 20000) APPEAR = {};
  APPEAR[k] = last; return last;
}
var PL_GRID = {};
function proLookAt(team, x, y){
  if(typeof PRO_LOOK === "undefined") return null;
  var layer = ppLayer(team), G = PL_GRID[layer];
  if(!G){ var L = PRO_LOOK.layers[layer]; if(!L) return null; G = PL_GRID[layer] = {}; L.forEach(function(r){ G[r[0]] = r; }); }
  var n = PRO_LOOK.n, C = PRO_LOOK.cell, cx = Math.floor(x/C), cy = Math.floor(y/C), best = null;
  // своя клетка; если там нет данных — соседние
  for(var dy=-1; dy<=1; dy++) for(var dx=-1; dx<=1; dx++){
    var r = G[(cy+dy)*n + (cx+dx)]; if(!r) continue;
    var w = r[3] * (dx === 0 && dy === 0 ? 1 : 0.6);
    if(!best || w > best.w) best = {dx:r[1], dy:r[2], R:r[3], w:w};
  }
  return best;
}
function _angOff(a, ref){ return Math.abs(((a-ref+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); }
// точка прохода между двумя зонами (середина общей границы полигонов)
function bzPortalPt(za, zb){
  var A = za.points, B = zb.points, sx = 0, sy = 0, n = 0;
  var dSeg = function(px, py, a, b){ var vx=b.x-a.x, vy=b.y-a.y, L=vx*vx+vy*vy, t = L ? Math.max(0, Math.min(1, ((px-a.x)*vx+(py-a.y)*vy)/L)) : 0; return Math.hypot(px-(a.x+vx*t), py-(a.y+vy*t)); };
  for(var i=0;i<A.length;i++){ var a = A[i], a2 = A[(i+1)%A.length];
    for(var s=0;s<=8;s++){ var px = a.x+(a2.x-a.x)*s/8, py = a.y+(a2.y-a.y)*s/8;
      for(var k=0;k<B.length;k++){ if(dSeg(px, py, B[k], B[(k+1)%B.length]) < 10){ sx += px; sy += py; n++; break; } } } }
  return n ? {x:sx/n, y:sy/n} : null;
}
function bzPortals(){
  BZ.portal = BZ.ids.map(function(){ return {}; });
  BZ.nbr.forEach(function(L, i){ L.forEach(function(j){ if(j < i) return;
    var p = bzPortalPt(ZONEMAP.zones[i], ZONEMAP.zones[j]);
    if(!p){ var ci = BZ.cent[i], cj = BZ.cent[j]; p = {x:(ci.x+cj.x)/2, y:(ci.y+cj.y)/2}; }
    BZ.portal[i][j] = p; BZ.portal[j][i] = p; }); });
}
// какие проходы между зонами сейчас видит команда (враг, прошедший через них, был бы замечен)
function portalWatched(team){
  if(!BZ.portal) bzPortals();
  var mates = bots.filter(function(o){ return o.alive && o.team === team && tick >= (o.blindUntil||0); });
  var W = {};
  BZ.portal.forEach(function(row, i){ for(var js in row){ var j = +js; if(j < i) continue; var p = row[j], ok = false;
    for(var m=0;m<mates.length && !ok;m++){ var o = mates[m], d = Math.hypot(p.x-o.x, p.y-o.y);
      if(d < 90) ok = true;
      else if(d < CONE_R*1.4 && inFov(o, p.x, p.y) && hasVision(o.x, o.y, p.x, p.y)) ok = true; }
    if(ok){ W[i+","+j] = 1; W[j+","+i] = 1; } } });
  return W;
}
var PORTAL_W = {CT:{}, T:{}};
// кандидаты взгляда для одного бота: [{j, pt, sc, fresh}]
function lookCands(b, W){
  var zb = (b.atPost && b.post) ? bzOf(b.post.x, b.post.y) : bzOf(b.x, b.y);
  if(zb < 0) zb = bzOf(b.x, b.y); if(zb < 0) return [];
  var team = b.team, out = [], moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var atHold = !moving && b.post && b.post.look && Math.hypot(b.post.x-b.x, b.post.y-b.y) < 160;
  var postA = (b.post && b.post.look && !(b.post.tag === "save")) ? Math.atan2(b.post.look.y-(b.post.y||b.y), b.post.look.x-(b.post.x||b.x)) : null;
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === team; });
  var rearCov = moving && mates.some(function(o){ return Math.hypot(o.x-b.x, o.y-b.y) < 500; });
  var habZ = {};
  if(BAL.habits) bots.forEach(function(o){ if(!o.alive || o.team === team) return; var h = habitTop(o.id, 2); if(h){ var zh = bzOf(h.x, h.y); if(zh >= 0) habZ[zh] = 1; } });
  var Wd = ZONE_DANGER_W[BZ.ids[zb]] || {}, PW = PORTAL_W[team] || {};
  (ZONE_DANGER[BZ.ids[zb]]||[]).forEach(function(zid){
    var j = BZ.idx[zid]; if(j === undefined || j === zb) return;
    var cz = BZ.cent[j]; if(!cz || Math.hypot(cz.x-b.x, cz.y-b.y) > LOOK.maxDist) return;
    if(isRearZone(team, zb, j)) return;   // (v148) свой тыл — не угроза
    // 1) сколько врагов оттуда вероятно выйдет
    var th = beliefZoneKnown(team, j), nBest = -1, nVal = 0;
    BZ.nbr[j].forEach(function(nn){ if(nn === zb) return;
      if(BAL.timing && !reachPossible(team, nn)) return;
      var v = LOOK.nbrW * beliefZoneKnown(team, nn);
      if(PW[j+","+nn]) v *= LOOK.watchedNbr;          // вход видит свой — враг выйдет на него первым
      th += v; if(v > nVal){ nVal = v; nBest = nn; } });
    if(habZ[j] && (!BAL.timing || reachPossible(team, j))) th += LOOK.habitW;
    if(moving) th += LOOK.uncheckW * uncheckedW(team, j);   // стоя — держит главный угол, непроверенные углы чекает на ходу
    // тайминг: инфы ещё нет — смотрим туда, где враг МОЖЕТ появиться раньше всего.
    // Зона, куда враг не может попасть незаметно (тупик за спиной своего), даёт 0
    var R = REACH[team];
    if(R){ var rmin = R[j]; BZ.nbr[j].forEach(function(nn){ if(nn !== zb && R[nn] < rmin) rmin = R[nn]; });
      if(isFinite(rmin)) th += LOOK.timingW * Math.exp(-Math.max(0, rmin - tick)/(LOOK.timingSec*TICK_HZ)); }
    if(th <= 0) return;
    // 2) точка взгляда: видимая точка зоны, ближайшая к проходу, откуда идёт угроза
    var ref = (nBest >= 0 && nVal > beliefZoneKnown(team, j)) ? (BZ.portal && BZ.portal[j][nBest]) || BZ.cent[nBest] : null;
    // врага в этой зоне недавно (≤8с) видели/слышали — целимся туда, где он был,
    // а не в любую точку большой зоны (Mid — это полкарты)
    var BLr = beliefLast[team] || {}, lkBest = null, lkAge = 1e9;
    for(var eidr in BLr){ var lr = BLr[eidr]; if(!lr || tick - lr.tick > 8*TICK_HZ || tick - lr.tick >= lkAge) continue;
      if(bzOf(lr.x, lr.y) !== j) continue;
      var er = bots.filter(function(o){ return o.id === eidr; })[0]; if(!er || !er.alive) continue;
      lkBest = lr; lkAge = tick - lr.tick; }
    if(lkBest && LOOK.lkRef !== false) ref = lkBest;
    var apZ = (BAL.cornerAim && !lkBest) ? appearPoint(b, (nBest >= 0 && nVal > beliefZoneKnown(team, j)) ? nBest : j) : null;
    var smp = ZONE_SAMPLES[zid] || [cz], c = null, cd = Infinity;
    smp.forEach(function(q){ var dq = Math.hypot(q.x-b.x, q.y-b.y); if(dq < 50 || !hasLOS(b.x, b.y, q.x, q.y)) return;
      var key = ref ? Math.hypot(q.x-ref.x, q.y-ref.y) : dq; if(key < cd){ cd = key; c = q; } });
    if(apZ && bzOf(apZ.x, apZ.y) === j || apZ && (nBest >= 0 && bzOf(apZ.x, apZ.y) === nBest)) c = apZ;
    if(!c) return;
    var d = Math.hypot(c.x-b.x, c.y-b.y);
    if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(hasLOS(b.x, b.y, ext.x, ext.y)) c = ext; d = 200; }
    var za = Math.atan2(c.y-b.y, c.x-b.x);
    var fresh = freshThreatNear(team, c);
    // 3) оценка
    var sc = th * (0.4 + (Wd[zid]||0)) / (1 + d/(moving ? LOOK.distMove : LOOK.distHold));
    var behind = moving ? _angOff(za, b.heading) > 1.9 : (atHold && postA !== null && _angOff(za, postA) > 2.2);
    if(d < LOOK.closeR && !behind) sc *= LOOK.closeK;
    if(fresh) sc *= LOOK.freshK;
    if(postA !== null && _angOff(za, postA) < 0.9) sc *= LOOK.postK;
    if(moving){ var hd = _angOff(za, b.heading); if(hd < 0.9) sc *= LOOK.headK; else if(hd > 1.9 && !fresh) sc *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; }
    else if(behind && !fresh) sc *= LOOK.behindHold;
    if(!fresh){
      if(mates.some(function(o){ return Math.hypot(o.x-c.x, o.y-c.y) < 140 || (bzOf(o.x, o.y) === j && Math.hypot(o.x-c.x, o.y-c.y) < 260); })) sc *= LOOK.mateThere;
      else if(mates.some(function(o){ var dm = Math.hypot(o.x-b.x, o.y-b.y); return dm > 20 && dm < Math.min(d, 600) && _angOff(Math.atan2(o.y-b.y, o.x-b.x), za) < 0.22; })) sc *= LOOK.mateInLine;
    }
    out.push({j:j, pt:c, sc:sc, fresh:fresh, a:za});
  });
  // входы в СВОЮ зону: враг из соседней зоны сначала войдёт туда, где стоит бот
  // (раньше такие входы не считались вообще — бот на CT-спавне не смотрел на
  // выходы из Alley/Temple, хотя там был враг). Смотрим на сам проход.
  if(BZ.portal) BZ.nbr[zb].forEach(function(nn){
    var p = BZ.portal[zb][nn]; if(!p) return;
    if(isRearZone(team, zb, nn)) return;   // (v148) проход в свой тыл — не угроза
    var d = Math.hypot(p.x-b.x, p.y-b.y); if(d < 40 || d > LOOK.maxDist || !hasLOS(b.x, b.y, p.x, p.y)) return;
    var th = beliefZoneKnown(team, nn);
    BZ.nbr[nn].forEach(function(n2){ if(n2 === zb) return; if(BAL.timing && !reachPossible(team, n2)) return;
      var v = LOOK.nbrW * beliefZoneKnown(team, n2); if(PW[nn+","+n2]) v *= LOOK.watchedNbr; th += v; });
    if(habZ[nn]) th += LOOK.habitW;
    if(moving) th += LOOK.uncheckW * uncheckedW(team, nn);
    if(th <= 0) return;
    var c = p;
    // (v151) не середина прохода, а место, где враг из этой зоны реально появится
    if(BAL.cornerAim){ var ap = appearPoint(b, nn); if(ap){ c = ap; d = Math.hypot(ap.x-b.x, ap.y-b.y); } }
    if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(hasLOS(b.x, b.y, ext.x, ext.y)) c = ext; }
    var za = Math.atan2(c.y-b.y, c.x-b.x), fresh = freshThreatNear(team, p);
    var sc = th * LOOK.entryExp / (1 + Math.max(d,200)/(moving ? LOOK.distMove : LOOK.distHold));
    var behind = moving ? _angOff(za, b.heading) > 1.9 : (atHold && postA !== null && _angOff(za, postA) > 2.2);
    if(d < LOOK.closeR && !behind) sc *= LOOK.closeK;
    if(fresh) sc *= LOOK.freshK;
    if(postA !== null && _angOff(za, postA) < 0.9) sc *= LOOK.postK;
    if(moving){ var hd = _angOff(za, b.heading); if(hd < 0.9) sc *= LOOK.headK; else if(hd > 1.9 && !fresh) sc *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; }
    else if(behind && !fresh) sc *= LOOK.behindHold;
    if(!fresh && mates.some(function(o){ return Math.hypot(o.x-p.x, o.y-p.y) < 140; })) sc *= LOOK.mateThere;
    out.push({j:1000+nn, pt:c, sc:sc, fresh:fresh, a:za});
  });
  // свежий контакт рядом: услышал шаги/выстрел или только что видел — в упор это
  // главнее всего, даже если враг в той же зоне, что и бот
  var cts = [];
  var hs = b.heardSound; if(hs && tick - hs.tick <= 96) cts.push({x:hs.x, y:hs.y, age:tick-hs.tick});
  var BLc = beliefLast[team] || {};
  for(var eid in BLc){ var lo = BLc[eid]; if(tick - lo.tick > 96) continue;
    var eb = bots.filter(function(o){ return o.id === eid; })[0]; if(!eb || !eb.alive) continue; cts.push({x:lo.x, y:lo.y, age:tick-lo.tick}); }
  cts.forEach(function(q){
    var d = Math.hypot(q.x-b.x, q.y-b.y); if(d > 700 || d < 20) return;
    var za = Math.atan2(q.y-b.y, q.x-b.x);
    // на бегу за спину — только на самый свежий и близкий
    if(moving && _angOff(za, b.heading) > 1.9 && (q.age > 20 || d > 250)) return;
    var pt = cornerLook(b, q) || q;
    out.push({j:"snd"+Math.round(q.x/80)+","+Math.round(q.y/80), pt:pt, sc:LOOK.contactW * (d < 300 ? 2 : 1) / (1 + d/700) * (1 - q.age/192), fresh:true, a:za, snd:true});
  });
  // (v148) без инфы — туда, куда смотрят про с этой точки (по 12 демкам).
  // Вес маленький: реальная угроза его перебивает, а "почти нули" — нет
  if(BAL.proLook){ var PL = proLookAt(team, b.x, b.y);
    if(PL){ var ae = Math.atan2(PL.dy, PL.dx), cl = rayClipWalls(b.x, b.y, b.x+PL.dx*420, b.y+PL.dy*420), dl = Math.hypot(cl.x-b.x, cl.y-b.y);
      if(dl > 90){ var scp = LOOK.proLook * PL.R;
        if(moving){ var hdp = _angOff(ae, b.heading); if(hdp < 0.9) scp *= LOOK.headK; else if(BAL.cornerAim) scp = 0; else if(hdp > 1.9) scp *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; }
        if(scp > 0) out.push({j:"pl", pt:{x:cl.x, y:cl.y}, sc:scp, fresh:false, a:ae, pro:true}); } } }
  // угол поста по сетапу — тоже кандидат (слабый), чтобы и он шёл через делёж:
  // двое на соседних постах не смотрят в одну точку, когда угроз нет
  if(atHold){ var pl = cornerLook(b, b.post.look) || b.post.look;
    // (v149) точку взгляда поста отсюда не видно (стоит на краю поста, за углом) —
    // cornerLook вёл "по пути к ней", часто назад; берём видимый проход к врагу
    if(BAL.enemyward && !hasLOS(b.x, b.y, b.post.look.x, b.post.look.y)){ var ew0 = enemywardLook(team, b); if(ew0) pl = ew0; }
    // (v149) угол поста смотрит в тыл (заданная точка оказалась в своём коридоре) —
    // берём видимый проход, откуда враг придёт раньше всего
    if(BAL.enemyward){ var zpl = bzOf(pl.x, pl.y), zbb = bzOf(b.x, b.y);
      if(zpl >= 0 && zbb >= 0 && zpl !== zbb && isRearZone(team, zbb, zpl) || Math.hypot(pl.x-b.x, pl.y-b.y) < 60){ var ew = enemywardLook(team, b); if(ew) pl = cornerLook(b, ew) || ew; } }
    out.push({j:"post"+b.id, pt:pl, sc:LOOK.postBase, fresh:false, a:Math.atan2(pl.y-b.y, pl.x-b.x)}); }
  return out;
}
// раз в 8 тиков: кандидаты всем + делёж направлений внутри команды
function lookPlan(team){
  PORTAL_W[team] = portalWatched(team);
  var W = PORTAL_W[team];
  var list = bots.filter(function(b){ return b.alive && b.team === team && !b._sawEnemy; });
  list.forEach(function(b){
    b._lkC = lookCands(b, W);
    // инерция: текущее направление получает бонус
    b._lkC.forEach(function(c){ if(c.j === b._lkZ) c.sc *= LOOK.stick; });
    b._lkPick = null;
  });
  // жадный делёж: самый важный угол команды берёт тот, у кого он важнее всего
  var left = list.slice();
  while(left.length){
    var bestB = null, bestC = null;
    left.forEach(function(b){ b._lkC.forEach(function(c){ if(!bestC || c.sc > bestC.sc){ bestC = c; bestB = b; } }); });
    if(!bestB){ left.forEach(function(b){ b._lkPick = null; }); break; }
    bestB._lkPick = bestC;
    left.splice(left.indexOf(bestB), 1);
    if(!(BAL.claimStrong && bestC.sc < LOOK.claimMin)) left.forEach(function(o){ if(Math.hypot(o.x-bestB.x, o.y-bestB.y) > LOOK.claimR) return;
      o._lkC.forEach(function(c){ if(c.fresh) return;
        if(c.j === bestC.j || Math.hypot(c.pt.x-bestC.pt.x, c.pt.y-bestC.pt.y) < 220) c.sc *= LOOK.claim; }); });
  }
  // инерция по времени + итог
  list.forEach(function(b){
    var p = b._lkPick;
    if(p && p.sc < LOOK.minScore) p = null;
    if(p && b._lkZ != null && p.j !== b._lkZ && !p.fresh && tick - (b._lkSince||0) < LOOK.minDwell){
      var cur = b._lkC.filter(function(c){ return c.j === b._lkZ; })[0];
      if(cur && p.sc < LOOK.switchK * cur.sc) p = cur;
    }
    if((p ? p.j : null) !== b._lkZ){ b._lkSince = tick; b._lkZ = p ? p.j : null; }
    b._lkPt = p ? p.pt : null;
    b._lkTop = b._lkC.slice().sort(function(x, y){ return y.sc - x.sc; }).slice(0, 3).map(function(c){ return [c.pro ? "как у про" : c.snd ? "звук/контакт" : typeof c.j === "string" ? "свой угол" : c.j >= 1000 ? "выход из " + (ZONE_NAMES[BZ.ids[c.j-1000]] || BZ.ids[c.j-1000]) : (ZONE_NAMES[BZ.ids[c.j]] || BZ.ids[c.j]), c.sc]; });
  });
}
// итоговая точка взгляда бота (кроме "вижу врага" — это выше)
function newLookFor(b){
  // задачи, где взгляд задан самой задачей
  if(b.roamChecking && b.roamLookPt){ b.lookReason = "roam"; return b.roamLookPt; }
  if(b.fakeHoldUntil && tick < b.fakeHoldUntil && bomb && bomb.site){ b.lookReason = "fake"; return GEO[bomb.site].tEntry; }
  if(b._lkPt){ b.lookReason = "look"; return cornerLook(b, b._lkPt) || b._lkPt; }
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  if(!moving && b.atPost && b.post && b.post.look){ b.lookReason = "post"; return cornerLook(b, b.post.look) || b.post.look; }
  b.lookReason = null; return null;
}

// Входы в район (вокруг center, радиус r), взвешенные по тому, сколько врагов
// вероятно за каждым из них. Для выбора позиции: смотреть на главный вход
// (или два), от остальных — закрыться стеной.
function threatEntrances(team, center, r){
  if(!BZ.portal) bzPortals();
  var inside = {}; BZ.cent.forEach(function(c, i){ if(c && Math.hypot(c.x-center.x, c.y-center.y) <= r) inside[i] = 1; });
  var zc = bzOf(center.x, center.y); if(zc >= 0) inside[zc] = 1;
  var E = [];
  Object.keys(inside).forEach(function(is){ var i = +is;
    BZ.nbr[i].forEach(function(nn){ if(inside[nn]) return; var p = BZ.portal[i][nn]; if(!p) return;
      var w = beliefZoneKnown(team, nn);
      BZ.nbr[nn].forEach(function(n2){ if(!inside[n2]) w += LOOK.nbrW * beliefZoneKnown(team, n2); });
      if(!BAL.timing || reachPossible(team, nn)) w += 0.02;
      var m = E.filter(function(e){ return Math.hypot(e.pt.x-p.x, e.pt.y-p.y) < 120; })[0];
      if(m){ m.w += w; } else E.push({pt:p, w:w, z:nn}); }); });
  E.sort(function(a, b){ return b.w - a.w; });
  return E;
}
