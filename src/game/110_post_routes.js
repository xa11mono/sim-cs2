// ---------- посты: "куда встать и куда смотреть" ----------
// Когда у бота в патруле есть пост — он идёт к нему, а дойдя (hold) стоит и
// смотрит в look. Бой (engage/hold/retreat) по-прежнему перебивает всё.
// ---- маршруты по названиям зон ----
// startRoute(b, ["Split","Lower Mid","Mid","Donut"]) — бот сначала проходит эти
// зоны по порядку, а уже потом идёт на пост, который ему выставит мозг роли
// (пост запоминается и применяется в конце маршрута). Бой, ретейк, бомба —
// важнее: маршрут снимается.
function startRoute(b, names, key){
  if(!names || !names.length) return;
  if(b._route && b._route.key === key) return;
  if(b._routeDone === key+"|"+roundNum) return;
  var pts = [], prev = {x:b.x, y:b.y};
  names.forEach(function(n){ var p = zonePoint(n, prev); if(p){ pts.push(p); prev = p; } });
  if(!pts.length) return;
  var bi = 0, bd = Infinity;
  pts.forEach(function(p, i){ var d = Math.hypot(p.x-b.x, p.y-b.y); if(d < bd){ bd = d; bi = i; } });
  if(bd < 90) bi++;
  if(bi >= pts.length) return;
  b._route = {key:key, pts:pts, idx:bi, t0:tick, names:names};
}
function routeTick(){
  bots.forEach(function(b){
    var R = b._route; if(!R) return;
    if(!b.alive || roundState !== "live" || tick - R.t0 > 35*TICK_HZ){ b._route = null; return; }
    var cp = R.pts[R.idx];
    if(cp && Math.hypot(cp.x-b.x, cp.y-b.y) < 70) R.idx++;
    if(R.idx >= R.pts.length){
      var W = R.want; b._routeDone = R.key+"|"+roundNum; b._route = null;
      if(W) setPost(b, W[0], W[1], W[2], W[3], W[4]);
    }
  });
}
// (v162) ПРО-ТОЧКИ: [x, y, раундов, угол1, доля1, угол2?, доля2?] по слоям "сторона|pre/post"
var PRO_SPOTS = MAP.pro.spots;
var PSN = {R:120, occ:45, maxOff:1.05};
var PSN_TAGS = /^(rebal|anchor|rotator|mid$|set:|clutch|stage|lurkStage|lurk$|awpline|postplant|repos:fallback|repos:back|sitehold|rotateHold|midcover|cts:|stack)/;
function proSnap(b, pt, look, tag){
  if(!PSN_TAGS.test(tag || "")) return null;
  var layer = b.team + "|" + (bomb && bomb.state === "planted" ? "post" : "pre");
  var key = layer+"|"+tag+"|"+Math.round(pt.x/8)+","+Math.round(pt.y/8)+"|"+(look ? Math.round(look.x/40)+","+Math.round(look.y/40) : "");
  if(b._psK === key && b._psR === roundNum && b._psM === matchNum) return b._psV;
  b._psK = key; b._psR = roundNum; b._psM = matchNum; b._psV = null;
  var L = PRO_SPOTS[layer]; if(!L) return null;
  var best = null, bs = -1e9;
  for(var i=0;i<L.length;i++){
    var s = L[i], d = Math.hypot(s[0]-pt.x, s[1]-pt.y); if(d > PSN.R) continue;
    if(!hasLOS(s[0], s[1], pt.x, pt.y) || insideSolidWall(s[0], s[1])) continue;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.post && Math.hypot(o.post.x-s[0], o.post.y-s[1]) < PSN.occ; })) continue;
    var modes = [[s[3], s[4]]]; if(s.length > 5) modes.push([s[5], s[6]]);
    var md = 0;
    if(look){ var wa = Math.atan2(look.y-s[1], look.x-s[0]); md = Math.min.apply(null, modes.map(function(m){ return _angOff(m[0], wa); })); if(md > PSN.maxOff) continue; }
    var mk = 1, qs = posAt(b.team, s[0], s[1]);   // (v246) тут в прошлом раунде не сработало — реже, как у про
    if(qs && !(bomb && bomb.state === "planted")){ var qv = posTable(b.team, nick(b.id), posWeaponClass(b))[qs.id] || 0; if(qv > 0) mk = posPref(b, qs, true)/qv; }
    var sc = Math.log(1 + s[2]*mk) - 1.5*d/PSN.R - 0.8*md;
    if(sc > bs){ bs = sc; best = {pt:{x:s[0], y:s[1]}, sp:{m:modes, r:s[2], k:i}}; }
  }
  b._psV = best;
  return best;
}
// взгляд на про-точке: направление, которое там держат про; из двух — ближайшее
// к тому, что команда поручила смотреть (раскладка углов); свежая инфа важнее
function proSpotLook(b){
  var P = b.post.pro; if(!P) return null;
  if(b._lkPick && b._lkPick.fresh && b._lkPt) return null;
  var M = P.m, ref = b._lkPt ? Math.atan2(b._lkPt.y-b.y, b._lkPt.x-b.x) : (b.post.look ? Math.atan2(b.post.look.y-b.post.y, b.post.look.x-b.post.x) : null);
  var S = b._proM;
  if(!S || S.k !== P.k || S.r !== roundNum || tick - S.t > 3*TICK_HZ){
    var bi = 0, bsc = -1e9;
    M.forEach(function(m, i){ var sc = m[1] - (ref === null ? 0 : _angOff(m[0], ref)/Math.PI*0.6); if(sc > bsc){ bsc = sc; bi = i; } });
    if(S && S.k === P.k && S.r === roundNum && S.i !== bi){ var cur = M[S.i]; var curSc = cur ? cur[1] - (ref === null ? 0 : _angOff(cur[0], ref)/Math.PI*0.6) : -1e9; if(curSc > bsc - 0.15) bi = S.i; }
    S = b._proM = {k:P.k, r:roundNum, i:bi, t:tick};
  }
  var a = M[S.i][0];
  return {x: b.x + Math.cos(a)*300, y: b.y + Math.sin(a)*300};
}
// (v162) отдельно стоящие ящики/колонны — небольшие замкнутые контуры стен
var _WB = null, _WBn = -1;
function wallBoxes(){
  if(_WB && _WBn === MANUAL_WALLS.length) return _WB;
  _WBn = MANUAL_WALLS.length; _WB = [];
  var W = MANUAL_WALLS, par = W.map(function(_, i){ return i; });
  var f = function(i){ while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  var K = function(x, y){ return Math.round(x/3)+","+Math.round(y/3); }, idx = {};
  W.forEach(function(w, i){ [[w[0],w[1]],[w[2],w[3]]].forEach(function(p){
    var kx = Math.round(p[0]/3), ky = Math.round(p[1]/3);
    for(var dx=-1;dx<=1;dx++) for(var dy=-1;dy<=1;dy++){ (idx[(kx+dx)+","+(ky+dy)]||[]).forEach(function(j){ par[f(i)] = f(j); }); }
    (idx[kx+","+ky] = idx[kx+","+ky] || []).push(i); }); });
  var comp = {}; W.forEach(function(_, i){ (comp[f(i)] = comp[f(i)] || []).push(i); });
  Object.keys(comp).forEach(function(c){
    var S = comp[c], xs = [], ys = [];
    S.forEach(function(i){ xs.push(W[i][0], W[i][2]); ys.push(W[i][1], W[i][3]); });
    if(Math.max(Math.max.apply(null, xs)-Math.min.apply(null, xs), Math.max.apply(null, ys)-Math.min.apply(null, ys)) >= 90) return;
    // обход контура по сегментам
    var left = S.slice(), poly = [[W[left[0]][0], W[left[0]][1]], [W[left[0]][2], W[left[0]][3]]]; left.shift();
    var guard = 0;
    while(left.length && guard++ < 200){
      var e = poly[poly.length-1], hit = -1, rev = false;
      for(var q=0;q<left.length;q++){ var w = W[left[q]];
        if(Math.hypot(w[0]-e[0], w[1]-e[1]) < 4){ hit = q; break; }
        if(Math.hypot(w[2]-e[0], w[3]-e[1]) < 4){ hit = q; rev = true; break; } }
      if(hit < 0) break;
      var w2 = W[left[hit]]; poly.push(rev ? [w2[0], w2[1]] : [w2[2], w2[3]]); left.splice(hit, 1);
    }
    if(!left.length) _WB.push(poly);
  });
  return _WB;
}
var ENTRY_WAIT = 128;   // (v375) 2 с: напарник на размен у входа на сайт (медиана про) — число, т.к. TICK_HZ объявлен ниже
var POST_DWELL = 96, POST_URGENT = /^(flee|defuse|plantspot|stopplant|antidefuse|save|tradeR|contact|retake|fetch|pickup|clutch|bombwatch|repos:killmove|gather)/;
function setPost(b, pt, look, hold, tag, spreadIdx){
  // сменил позицию после фрага — роль в этом раунде ставит его уже на новую точку
  if(BAL.holdShift && b._hs && b._hs.round === roundNum && b._hs.tag === tag && pt && Math.hypot(pt.x-b._hs.pt.x, pt.y-b._hs.pt.y) < 320) pt = b._hs.pt;
  // (v367) реакция на контакт — задача не перебивает её CONTACT_HOLD с (кроме срочного: бег от бомбы, сбить плант/дефуз, размен)
  if(b._contact && b._contact.lock){
    if(tick >= b._contact.until || !b.alive){ b._contact = null; if(b.post && /^contact/.test(b.post.tag) && !/^contact/.test(tag)) b._postLast = null; }   // (v375) кончилась — новая задача без ожидания POST_DWELL
    else if(!/^(contact|flee|stopplant|antidefuse|tradeR)/.test(tag)) { if(b.post && b.post.tag !== b._contact.tag && b._contact.pt) { b._contact.lock = false; } else return; }
  }
  // размен (рефлекс после смерти тиммейта рядом) — тактика не перебивает его
  // ~3.5с; окно кончилось, а убийцу не сняли — туда же второй раз не лезет
  if(b._tradeLock){
    if(tick >= b._tradeLock.until){ b._avoidPeekUntil = tick + 6*TICK_HZ; b._avoidPeekAt = b._tradeLock.at; b._tradeLock = null; }
    else if(!/^(tradeR|defuse|flee|plantspot|stopplant|antidefuse)/.test(tag)) return;
  }
  // подмена погибшего (v272): держит его место, пока план не сдвинулся (T — смена фазы, CT — «играем ретейк»), бомба, ≤ 15 с
  if(b._fillLock){
    var FL = b._fillLock;
    if(tick >= FL.until || (bomb && bomb.state === "planted") || (FL.team === "T" ? !(teamTac.T && teamTac.T.phase === FL.ph) : !!(teamTac.CT && teamTac.CT.playRetake))) b._fillLock = null;
    else if(!/^(fill|tradeR|defuse|flee|plantspot|stopplant|antidefuse)/.test(tag)) return;
  }
  // эндгейм (все на последнего) — пост роли не перебивает. Раньше роль и эндгейм
  // каждый тик ставили РАЗНЫЕ посты: путь сбрасывался, бот "не доходил" и
  // топтался на месте с кругами шагов, не вставая на угол
  if(b._egLock && b._egLock >= tick-1 && tag !== "endhunt" && !/^(defuse|flee|save|lineup|plantspot|stopplant|smokeWait|antidefuse)/.test(tag)) return;
  // идёт подобрать оружие — пост роли не перебивает (до ~1 тика после решения)
  // (аудит 11.10) срочная задача, которой замок уступает, снимает и саму затею: иначе «за оружием» / «ждёт у смока» / «лайнап»
  // на следующем тике ставили свой пост обратно, и пост менялся каждый тик (путь сбрасывался — бот стоял до 5–6 с)
  if(b._pickLock && b._pickLock >= tick-1 && tag !== "pickup"){
    if(!/^(defuse|flee|save|plantspot|stopplant|antidefuse|retake)/.test(tag)) return;
    if(b.post && b.post.tag === "pickup") b._pickIgnore = {x:b.post.x, y:b.post.y, round:roundNum};
    b._pickLock = 0;
  }
  // ждёт у края смока — пост роли не перебивает (решение ждать/пушить — в smokeEdgeTick)
  if(b._smokeWaitLock && b._smokeWaitLock >= tick-1 && tag !== "smokeWait"){
    if(!/^(defuse|flee|save|lineup|plantspot|stopplant|antidefuse)/.test(tag)){
      if(b._smokeWait) b._smokeWait.want = [pt, look, hold, tag];
      return;
    }
    b._smokeWait = null; b._smokeWaitLock = 0; b._smokePush = {until: tick + 4*TICK_HZ, reason:"срочно"};
  }
  // идёт на свой лайнап — пост роли не перебивает (кроме дефуза/отхода от взрыва/сейва)
  if(b._lineupLock && b._lineupLock >= tick-1 && tag !== "lineup"){
    // (v285, владелец 14.10: игрок 9 в раунде 2 стоял в Short с гранатой, пока вся игра была на B) колл ротации/ретейка/подмены
    // снимает гранату, если она летит не на сайт колла (≤700 px — «у сайта»); граната на сам сайт колла — докидывает
    var csL = b.team === "CT" ? (bomb && bomb.state === "planted" ? bomb.site : (teamTac.CT && teamTac.CT.call ? teamTac.CT.call.site : null)) : null;
    var farNade = !b.nadeTask || !csL || Math.hypot(b.nadeTask.x-SITES[csL].x, b.nadeTask.y-SITES[csL].y) > 700;
    if(!/^(defuse|flee|save|stopplant|antidefuse|fetch|plantspot)/.test(tag) && !(/^(rotate|gather|retake|fill)/.test(tag) && farNade)) return;
    b.nadeTask = null; b.nadeQueue = null; b._lineupLock = 0;   // задача важнее броска — бросок отменён (как живой игрок бросает лайнап ради сейва/дефуза)
  }
  if(tag === "lineup") b._route = null;
  if(b._route && !/^route/.test(tag) && tag !== "utilWait" && tag !== "utilHold"){   // (v349) ожидание гранат — пауза маршрута раша, не отмена
    var R = b._route;
    if(/^(retake|defuse|flee|save|fetch|postplant|hunt|repos|stopplant|antidefuse|endhunt)/.test(tag) || (bomb && bomb.state === "planted" && b.team === "CT")){ b._route = null; }
    else if(R.idx < R.pts.length){
      R.want = [pt, look, hold, tag, spreadIdx];
      var cp = R.pts[R.idx], nx = R.pts[R.idx+1] || pt;
      return setPost(b, cp, nx, true, "route:"+R.names[Math.min(R.idx, R.names.length-1)]);
    }
  }
  if(BAL.siteRebal && b._rebal && b._rebal.round === roundNum && !/^(rebal|retake|defuse|flee|save|fetch|stopplant|antidefuse|tradeR|repos|clutch|rotate|endhunt|gather|midcover|lineup|smokeWait|pickup)/.test(tag)) return;
  // игрок на пробе (вышел вперёд за инфой) — пост группы его не перебивает
  if(b._probeLock && b._probeLock >= tick-1 && !/^(probe|fetchCover|bombEscort)/.test(tag)) return;   // и прикрывающий сборщика бомбы (v269)
  // сменил позицию после килла — пост роли не тянет его обратно на засвеченную
  // точку ещё ~5с (задачи по бомбе и ретейк — важнее)
  // (v257, К2) ротация на колл — решение команды: старая перепозиция (пуш, отход) её не держит
  if(b._reposUntil && tick < b._reposUntil && tag !== "repos" && !/^(retake|defuse|plantspot|flee|save|fetch|postplant|rotate)/.test(tag) && !(bomb && bomb.state === "planted")) return;
  // (v375, этап 5 плана владельца: «решение держится») сторож: «перетягивание» — пост бота за 2 с меняется A → B → A
  // (лайнап ↔ угол, ожидание гранат ↔ маршрут, смена позиции ↔ опорник; 250–340 на 100 раундов): каждая механика каждый тик
  // ставит своё, кто последний — тот и прав, путь сбрасывается, бот топчется. Теперь новая задача обычного уровня не сменяет
  // поставленную раньше POST_DWELL (1,5 с; проектное число); срочные (бой, бомба, огонь, сейв, размен, контакт) — сразу
  var tagB = String(tag).replace(/[:|].*$/, "");
  // (снятый пост — clearPost — не сбрасывает: последняя задача помнится в _postLast)
  if(b._postLast && b._postLast.b !== tagB && tick - b._postLast.t < POST_DWELL && !POST_URGENT.test(tag) && !POST_URGENT.test(b._postLast.tag)) return;
  var psn = (BAL.proSpots && hold && pt) ? proSnap(b, pt, look, tag) : null;
  if(psn){ pt = psn.pt; spreadIdx = 0; }
  var id = tag + "|" + Math.round(pt.x) + "," + Math.round(pt.y);
  // (v260, В3) та же точка и задача — путь не сбрасываем, но новое направление взгляда принимаем
  if(b.post && b.post.id === id){ b.post.look = look || null; return; }
  var x = pt.x, y = pt.y;
  // (v370, владелец: «не стоят в толпе») точка, где уже стоит / куда идёт свой (≤ SPOT_PERSONAL), — встаём рядом поперёк взгляда,
  // а не в него. Одно место для всех постов (было: раздвиг на 22 ед. только по spreadIdx). Точные места (бомба, лайнап, подбор) — как есть
  // (v373, отметка владельца: donk стоял на спавне T весь раунд) точка маршрута — не место, где стоять: маршрут засчитывает её, когда
  // бот ближе 70, а сдвиг на 80 не давал дойти — маршрут вставал. Точки маршрута не сдвигаются
  if((spreadIdx || spotTaken(b, {x:x, y:y})) && !/^(plantspot|defuse|lineup|pickup|fetch|stopplant|antidefuse|ladder|smokeWait|route)/.test(tag)){
    var la = look ? Math.atan2(look.y-y, look.x-x) : 0, x0 = x, y0 = y;
    [Math.PI/2, -Math.PI/2, Math.PI*0.75, -Math.PI*0.75].some(function(da){
      var nx = x0 + Math.cos(la+da)*(SPOT_PERSONAL+10), ny = y0 + Math.sin(la+da)*(SPOT_PERSONAL+10);
      if(insideSolidWall(nx, ny) || segCrossesManualWalls(x0, y0, nx, ny) || !navAt(nx, ny) || spotTaken(b, {x:nx, y:ny})) return false;
      x = nx; y = ny; return true; });
  }
  if(!b._postLast || b._postLast.b !== tagB || b._postLast.round !== roundNum) b._postLast = {b:tagB, tag:String(tag), t:tick, round:roundNum};
  b.post = {id:id, x:x, y:y, look:look||null, hold:hold, tag:tag};
  if(psn) b.post.pro = psn.sp;
  b.atPost = false;
  if(b.state === "patrol"){ b.path = []; b.pathIdx = 0; }
}
function clearPost(b){ if(b.post){ b.post = null; b.atPost = false; if(b.state==="patrol"){ b.path = []; b.pathIdx = 0; } } }
function updatePost(b){
  if(!b.post || b.state !== "patrol"){ b.atPost = false; return; }
  var ep = fireSafe(b.post, b);
  if(ep !== b.post && b.atPost && Math.hypot(ep.x-b.baseX, ep.y-b.baseY) > 34){ b.atPost = false; b.path = []; b.pathIdx = 0; }
  var d = Math.hypot(ep.x-b.baseX, ep.y-b.baseY);
  if(b.post.hold){
    // точка планта: "дошёл" — это именно внутри зоны сайта, а не в 34px от точки
    // (иначе носитель останавливался у края зоны, снаружи, и не мог заложить)
    var arrived = b.post.tag === "plantspot" && teamTac.T && SITES[teamTac.T.site] ? (d < 10 || onSite(SITES[teamTac.T.site], b.baseX, b.baseY) && d < 60) :
      b.post.tag === "defuse" ? d < DEFUSE_R - 8 :   // (v359, отметка: m0NESY «дошёл» до бомбы в 34 ед., а дефуз — с 30: стоял 12 с до взрыва)
      d < ((BAL.proSpots && b.post.pro) ? 9 : 34);
    // (опорник "не дошёл") точка поста чуть внутри угла/стены: бот доходил на
    // 30–60px и крутился рядом, не "вставая" на пост. Не приближается ~1.5с — встал
    if(BAL.arriveNear && !b.atPost && !arrived && b.post.tag !== "plantspot" && b.post.tag !== "defuse"){
      if(b._apId !== b.post.id){ b._apId = b.post.id; b._apBest = d; b._apT = tick; }
      else if(d < b._apBest - 6){ b._apBest = d; b._apT = tick; }
      else if(d < 70 && tick - b._apT > 90) arrived = true;
    }
    if(!b.atPost && arrived){ b.atPost = true; b.path = []; b.pathIdx = 0;
      // встал с AWP на угол — щелчок зума слышно рядом (≤200 по прямой, ≤120 за стеной)
      if(BAL.soundMore && b.weapon && b.weapon.key === "AWP" && roundState === "live" && tick - (b._zoomTick||-9999) > 3*TICK_HZ){
        b._zoomTick = tick;
        emitSound(b, b.x, b.y, 200, 120, "zoom", tick*53 + (b.id.charCodeAt(b.id.length-1)||0)).forEach(function(o){
          voiceLog(o.team, "zoom"+b.id, o.id, "слышу зум AWP "+calloutName(o.heardSound.x, o.heardSound.y));
        });
      }
    }
    else if(b.atPost && (d > 80 || (b.post.tag === "defuse" && d >= DEFUSE_R - 4))){ b.atPost = false; b.path = []; b.pathIdx = 0; }
  } else b.atPost = false;
}

