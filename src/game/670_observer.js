// ======================= (v304) АВТООБСЕРВЕР — только показ, на игру не влияет =======================
// Сам выбирает, за кем следить (как режиссёр трансляции): бой, плант/дефуз, клатч, только что фраг, по нему стреляют, рядом враг.
// Держит выбранного не меньше OBS_K.hold с, переключается, если новый момент интереснее (×OBS_K.more), бой начался у другого
// или выбранный погиб (через OBS_K.deathShow с — видно смерть, потом убийца). Камера плавно едет и приближает: бой — ближе,
// спокойно — дальше, между раундами — вся карта. Ручное движение камеры или колесо — обсервер ждёт 6 с; клик по игроку
// (панель или радар) — «слежка» за ним, пока не кликнешь снова или он не погибнет (v459).
// (v459) Часы обсервера — тики игры, а не реальное время: на паузе он стоит (раньше на паузе перебирал игроков).
var OBS = {on:true, id:null, since:0, deadAt:0, manualUntil:0, last:0, cx:1024, cy:1024, sc:0, tr:null, lock:null, mt:-1, tk:0}, OBS_TR = 0.6, OBS_OFF = 0.3;
// (v459) все числа обсервера — одним местом, в секундах игры. Проектные числа (это показ, не поведение)
var OBS_K = {
  hold: 2.5, more: 1.3,           // держать игрока не меньше hold с; сменить, если другой интереснее в more раз
  urgentGap: 1, quietGap: 1.5,    // срочно к чужому бою — не раньше urgentGap с на игроке и если у него боя не было quietGap с
  calm: 8, execCycle: 2.5,        // спокойный дольше calm с — к другому; на выходе на сайт — по execCycle с на каждого
  deathShow: 1.5, prevBlock: 5,   // место смерти видно deathShow с; только что показанного — не раньше prevBlock с обратно
  fightLock: 2, fightScore: 1, fightUrgent: 0.5,   // «бой был» за последние N с — для «не уходить», для очков, для «срочно»
  glimpse: 6,                     // видит врага не меньше glimpse тиков подряд — бой (мелькнул в щели на тик — ещё нет)
  focusR: 900, siteR: 700,        // фокус (выход, плант, дефуз) — кто ближе focusR; в кадре — все ближе siteR
  nearR: 450, losR: 900,          // враг ближе nearR смотрит на игрока — скоро бой; линию видимости проверять ближе losR
  bombLast: 10,                   // последние bombLast с бомбы при CT рядом — фокус на бомбе
  wideToNear: 0.9                 // перелёт с общего плана на бой, с
};
function obsT(sec){ return sec*TICK_HZ; }
// (v459) общее на тик — считается один раз, а не для каждого бота: фокус, кто последним стрелял ПО ИГРОКУ (не в смок), видимость пар
var OBC = null;
function obsCtx(){
  if(OBC && OBC.tick === tick && OBC.m === matchNum && OBC.rs === roundState) return OBC;
  var C = {tick: tick, m: matchNum, rs: roundState, F: null, shotBy: {}, los: {}, alive: {CT: 0, T: 0}};
  OBC = C;
  bots.forEach(function(o){
    if(o.alive) C.alive[o.team]++;
    var s = o._shotAtBy; if(s && s.id && o._shotAtT != null && !(C.shotBy[s.id] >= o._shotAtT)) C.shotBy[s.id] = o._shotAtT;
  });
  C.F = obsFocus();
  return C;
}
// видят ли друг друга (линия без стен и полов, без учёта взгляда и дыма) — для «скоро бой»
function obsLos(a, b){
  var C = obsCtx(), k = a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
  if(!(k in C.los)) C.los[k] = hasLOS(a.x, a.y, b.x, b.y, a.z, b.z);
  return C.los[k];
}
// (v459) ОДНО определение «у игрока бой»: видит врага устойчиво, или по нему стреляли, или он стрелял по игроку за sec с.
// Стрельба в дым (smokeSpamTick) боем не считается — раньше она держала камеру на «спамере», пока бой шёл в другом месте
function obsFight(b, sec){
  if(!b || !b.alive) return false;
  if(b._sawEnemy && (b.contactStreak||0) >= OBS_K.glimpse) return true;
  var w = obsT(sec);
  if(b._shotAtT != null && tick - b._shotAtT < w) return true;
  var sb = obsCtx().shotBy[b.id]; return sb != null && tick - sb < w;
}
// (v321, М10; v459 — дефуз и последние секунды бомбы) фокус обсервера — решающее место раунда: дефуз; плант и 3 с после;
// бомба тикает последние bombLast с, а рядом CT (ретейк); выход T на сайт (15 с от начала выхода). Камера держится игроков
// у фокуса (ближе focusR), бой в другом месте его не перебивает (проектные числа)
function obsFocus(){
  if(roundState !== "live") return null;
  var tt = teamTac && teamTac.T, df = null, pl = null;
  bots.forEach(function(b){ if(!b.alive) return; if(b.defusing && !df) df = b; if(b.planting && !pl) pl = b; });
  if(df) return {x: df.x, y: df.y, site: bomb && bomb.site, key: "defuse"};
  if(bomb && bomb.state === "planted" && bomb.plantTick && tick - bomb.plantTick < 3*TICK_HZ) return {x: bomb.x, y: bomb.y, site: bomb.site, key: "plant"};
  if(pl) return {x: pl.x, y: pl.y, site: tt && tt.site, key: "plant"};
  if(bomb && bomb.state === "planted" && bombTimeLeftTicks() < obsT(OBS_K.bombLast) &&
     bots.some(function(o){ return o.alive && o.team === "CT" && Math.hypot(o.x-bomb.x, o.y-bomb.y) < OBS_K.focusR; }))
    return {x: bomb.x, y: bomb.y, site: bomb.site, key: "bomb"};
  if(tt && tt.phase === "execute" && tt.execStart != null && tick - tt.execStart < 15*TICK_HZ && SITES[tt.site]) return {x: SITES[tt.site].x, y: SITES[tt.site].y, site: tt.site, key: "exec"};
  return null;
}
function obsScore(b){
  if(!b.alive) return 0;
  var C = obsCtx(), F = C.F;
  // (v368) фокус не гасит бой в другом месте: дерущийся вне фокуса — с обычным счётом
  if(F && !obsFight(b, OBS_K.fightScore) && Math.hypot(b.x-F.x, b.y-F.y) > OBS_K.focusR) return 0.2;
  var foe = b.team === "CT" ? "T" : "CT", sc = 1;
  if(b.planting || b.defusing) sc += 9;
  if(b._sawEnemy && (b.contactStreak||0) >= OBS_K.glimpse) sc += 6 + Math.min(4, (b.contactStreak||0)/16);
  if(b._shotAtT != null && tick - b._shotAtT < TICK_HZ) sc += 5;
  var sb = C.shotBy[b.id]; if(sb != null && tick - sb < TICK_HZ) sc += 3;
  if(b._killHowT && tick - b._killHowT < 2*TICK_HZ) sc += 2;
  if(C.alive[b.team] === 1 && C.alive[foe] >= 1) sc += 4;                    // клатч
  if(bomb && bomb.state === "carried" && bomb.carrier === b) sc += 1.5;
  // рядом враг — скоро бой. (v459) Расстояние по прямой — только если они могут увидеть друг друга; за стеной или на другом
  // этаже — меньше (раньше враг этажом ниже считался «вот-вот бой»)
  var near = 0;
  bots.forEach(function(o){ if(!o.alive || o.team !== foe) return;
    var d = Math.hypot(o.x-b.x, o.y-b.y), v = 3/(1 + d/400);
    if(d < OBS_K.losR && !obsLos(b, o)) v *= 0.4;
    if(v > near) near = v;
    // (v307) враг ≤ nearR уже видит его или смотрит в его сторону (и линия открыта) — переключаемся заранее, до выстрелов
    if(d > OBS_K.nearR) return;
    if(o._sawEnemy && o._nearestEnemyBot === b) sc += 6;
    else if(o.facing !== undefined && _angOff(Math.atan2(b.y-o.y, b.x-o.x), o.facing) < 0.5 && obsLos(b, o)) sc += 2.5;
  });
  sc += near;
  if(b.id === OBS.id) sc *= 1.05;                                             // инерция
  if(b.id === OBS.prev && tick < (OBS.prevUntil||0) && !b._sawEnemy) sc *= 0.5;   // только что показывали — не сразу обратно
  return sc;
}
function obsPickBest(except, within){
  var B = null, S = 0;
  bots.forEach(function(o){ if(o === except || !o.alive) return; if(within && Math.hypot(o.x-within.x, o.y-within.y) > OBS_K.focusR) return;
    var v = obsScore(o); if(v > S){ S = v; B = o; } });
  return {b: B, s: S};
}
// сменить игрока обсервера (одно место): прошлого — «только что показывали», карточка по центру — новый
function obsSet(o, ts, fly){
  if(OBS.id && OBS.id !== o.id){ OBS.prev = OBS.id; OBS.prevUntil = tick + obsT(OBS_K.prevBlock); }
  OBS.id = o.id; OBS.since = tick; OBS.deadAt = 0;
  if(fly && OBS.sc) OBS.tr = {t0: ts, fx: OBS.cx, fy: OBS.cy, fsc: OBS.sc};   // (v330, М48) начало перелёта камеры
  if(o.alive && plSelected !== o.id){ plSelected = o.id; playersUpdate(); }
}
var OBS_BOUNDS = null, OBS_PLAN_MIN = 3, OBS_WIDE_MAX = 10, OBS_NEAR_CALM = 6;
// свободная часть экрана (координаты холста): слева/справа — панели игроков, сверху — табло, снизу — карточка игрока (если видны).
// ox/oy — насколько центр свободной части сдвинут от центра экрана (камера держит центр экрана)
function obsFreeRect(r){
  var rr = function(id){ var e = document.getElementById(id); if(!e || !e.offsetParent) return null; return e.getBoundingClientRect(); };
  var L = 0, R = r.width, T = 0, Bt = r.height, pT = rr("plT"), pC = rr("plCT"), sb = rr("scoreboard");
  if(pT && pT.right > r.left && pT.right < r.left + r.width/2) L = pT.right - r.left + 8;
  if(pC && pC.left < r.right && pC.left > r.left + r.width/2) R = pC.left - r.left - 8;
  if(sb && sb.bottom > r.top) T = Math.min(r.height/3, sb.bottom - r.top + 4);
  var pf = rr("plFocus");   // (v364) карточка игрока обсервера внизу по центру — карта над ней, а не под ней
  if(pf && pf.height > 0 && pf.top > r.top + r.height/2 && pf.top < r.bottom) Bt = pf.top - r.top - 4;
  if(R - L < r.width*0.4){ L = 0; R = r.width; }   // узкий экран — панели поверх карты, берём всю ширину
  return {w: R - L, h: Bt - T, ox: (L + R)/2 - r.width/2, oy: (T + Bt)/2 - r.height/2};
}
function obsFullView(r){
  if(!OBS_BOUNDS){ var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    NAVAREAS.forEach(function(a){ a.points.forEach(function(p){ if(p.x < x0) x0 = p.x; if(p.x > x1) x1 = p.x; if(p.y < y0) y0 = p.y; if(p.y > y1) y1 = p.y; }); });
    OBS_BOUNDS = {x0: x0-30, y0: y0-30, x1: x1+30, y1: y1+30}; }
  var B = OBS_BOUNDS, FR = obsFreeRect(r);
  var sc = Math.min(FR.w/(B.x1 - B.x0), FR.h/(B.y1 - B.y0));
  // центр карты — в центре свободного прямоугольника: сдвиг в координатах карты
  return {x: (B.x0 + B.x1)/2 - FR.ox/sc, y: (B.y0 + B.y1)/2 - FR.oy/sc, sc: sc};
}
function obsFrame(ts){
  domClass(document.getElementById("btnObs"), OBS.on ? "on" : "");
  domClass(document.getElementById("btnObsMap"), OBS.on && OBS.full ? "on" : "");
  if(!OBS.on) return;
  var dt = OBS.last ? Math.min(0.1, (ts - OBS.last)/1000) : 0.016; OBS.last = ts;
  // (v459) новый матч (тик снова с нуля) — отметки времени обсервера заново
  if(OBS.mt !== matchNum || tick < OBS.tk){ OBS.mt = matchNum; OBS.since = tick; OBS.deadAt = 0; OBS.prevUntil = 0; OBS.planT = tick; }
  OBS.tk = tick;
  var r = wrapRect(), fitSc = Math.min(r.width/2048, r.height/2048) * 1.08;
  var manual = ts < OBS.manualUntil;
  var tx = 1024, ty = 1024, tsc = fitSc;
  var lockB = OBS.lock ? teamBot(OBS.lock) : null; if(OBS.lock && !lockB) OBS.lock = null;
  if((roundState === "live" || WARM.on) && !manual){
    var cur = OBS.id ? teamBot(OBS.id) : null;
    if(cur && !cur.alive && !OBS.deadAt) OBS.deadAt = tick;
    var deadLong = !!(cur && !cur.alive && tick - OBS.deadAt > obsT(OBS_K.deathShow));
    // (v459) слежка: игрок, которого выбрал владелец; погиб — видно смерть, потом обсервер снова сам
    if(lockB && !lockB.alive && (cur !== lockB || deadLong)){ OBS.lock = null; lockB = null; }
    if(lockB){ if(cur !== lockB){ obsSet(lockB, ts, true); cur = lockB; } }
    else {
      var P = obsPickBest(null), best = P.b, bs = P.s, curS = cur && cur.alive ? obsScore(cur) : 0;
      var curFight = obsFight(cur, OBS_K.fightLock), held = tick - OBS.since, F = obsCtx().F;
      // спокойный (без боя) дольше calm с — смена на другого, чтобы картинка не стояла
      if(cur && cur.alive && !obsFight(cur, OBS_K.fightScore) && held > obsT(OBS_K.calm) && best === cur){ var Q = obsPickBest(cur); if(Q.b){ best = Q.b; bs = Q.s*2; } }
      // погиб — deathShow с видно место смерти, потом к убийце, если жив (как режиссёр трансляции)
      if(deadLong && cur._killer){ var kb = teamBot(cur._killer); if(kb && kb.alive){ best = kb; bs = Infinity; } }
      // бой начался у другого, а у выбранного боя нет — сразу, без выдержки (но не чаще urgentGap и не сразу после его боя)
      var urgent = !!(best && best !== cur && obsFight(best, OBS_K.fightUrgent) && !obsFight(cur, OBS_K.fightUrgent));
      if(urgent && cur && cur.alive && (held < obsT(OBS_K.urgentGap) || obsFight(cur, OBS_K.quietGap))) urgent = false;
      var far = !!(F && cur && cur.alive && Math.hypot(cur.x-F.x, cur.y-F.y) > OBS_K.focusR);
      if(far && !curFight) urgent = true;   // (v321, М10) начался выход — к нему (не посреди дуэли — v330)
      // (v459) дефуз, плант, последние секунды бомбы — к ним даже из перестрелки в другом месте: это решает раунд
      var decisive = far && F.key !== "exec";
      if(decisive){ var D = obsPickBest(null, F); if(D.b){ best = D.b; bs = D.s; } }
      // на выходе — переключение между его игроками: каждого держит execCycle с, потом следующий интересный у сайта
      if(F && cur && cur.alive && !curFight && held > obsT(OBS_K.execCycle) && best === cur){ var E = obsPickBest(cur); if(E.b && E.s > 1){ best = E.b; bs = curS*2; } }
      var canSwitch = !cur || deadLong || decisive || (cur.alive && !curFight && (urgent || (held > obsT(OBS_K.hold) && bs > curS*OBS_K.more)));
      if(best && best !== cur && canSwitch){ obsSet(best, ts, true); cur = best; }
    }
    // (v305) карточка по центру — всегда игрок обсервера
    if(cur && cur.alive && plSelected !== cur.id){ plSelected = cur.id; playersUpdate(); }
    if(cur){
      tx = cur.x; ty = cur.y;
      // (v310) соперник — тот, кого он видит, или кто видит его; в кадре оба (центр между ними, запас ×2,4), без боя — ближайший враг в 700 px
      var e = (cur._sawEnemy && cur._nearestEnemyBot && cur._nearestEnemyBot.alive) ? cur._nearestEnemyBot : null;
      if(!e) bots.forEach(function(o){ if(!e && o.alive && o.team !== cur.team && o._sawEnemy && o._nearestEnemyBot === cur) e = o; });
      var near = null, nd = 700; if(!e) bots.forEach(function(o){ if(o.alive && o.team !== cur.team){ var d = Math.hypot(o.x-cur.x, o.y-cur.y); if(d < nd){ nd = d; near = o; } } });
      var fight = !!e, other = e || near; OBS.foeId = e ? e.id : null;
      if(other){ tx = (cur.x + other.x)/2; ty = (cur.y + other.y)/2; }
      var span = other ? Math.max(fight ? 650 : 900, Math.hypot(other.x-cur.x, other.y-cur.y)*2.4) : 1100;   // сколько карты видно
      var FO = obsCtx().F;
      if(FO && !lockB){   // (v321, М10) выход/плант/дефуз — в кадре все игроки у сайта; (v345) без центра сайта
        var xs = [cur.x], ys = [cur.y];
        bots.forEach(function(o){ if(o.alive && Math.hypot(o.x-FO.x, o.y-FO.y) < OBS_K.siteR){ xs.push(o.x); ys.push(o.y); } });
        var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
        tx = (x0+x1)/2; ty = (y0+y1)/2; span = Math.max(700, (x1-x0)*1.3, (y1-y0)*1.3);
      }
      // (v345) игрок обсервера — всегда во внутренней части кадра: центр не дальше OBS_OFF от него
      var offX = tx - cur.x, offY = ty - cur.y, offL = Math.hypot(offX, offY), offMax = OBS_OFF*span;
      if(offL > offMax){ tx = cur.x + offX*offMax/offL; ty = cur.y + offY*offMax/offL; }
      // (v459) масштаб и центр — по свободной части экрана (между панелями, под табло, над карточкой), как у «Вся карта»;
      // раньше по всему окну — соперник мог оказаться под карточкой игрока
      var FR = obsFreeRect(r);
      tsc = Math.max(fitSc, Math.min(FR.w, FR.h) / span);
      tx -= FR.ox/tsc; ty -= FR.oy/tsc;
    }
  } else if(manual) return;
  // (v359/v364/v365) «Вся карта» — как трансляция: когда тихо — общий план, бой / плант / дефуз / выход — камера на игроке.
  // Каждый план держится не меньше OBS_PLAN_MIN с; общий план — не дольше OBS_WIDE_MAX с подряд. Слежка (v459) — всегда на игроке
  if(OBS.full && !manual){
    var hot = bots.some(function(o){ return o.alive && (o.planting || o.defusing || obsFight(o, OBS_K.fightLock)); }) || !!obsCtx().F;
    var live = roundState === "live";
    var wantWide = !live || !hot;
    if(OBS.wide === undefined){ OBS.wide = true; OBS.planT = tick; }
    var heldP = tick - (OBS.planT||0);
    if(live && OBS.wide && heldP > obsT(OBS_WIDE_MAX) && !hot) wantWide = false;          // долго общий план — к игроку
    if(live && !OBS.wide && !hot && heldP > obsT(OBS_NEAR_CALM)) wantWide = true;         // на игроке тихо — общий план
    else if(live && !OBS.wide && !hot) wantWide = false;
    if(live && lockB) wantWide = false;
    if(wantWide !== OBS.wide && (heldP > obsT(OBS_PLAN_MIN) || (hot && OBS.wide) || (lockB && OBS.wide))){ OBS.wide = wantWide; OBS.planT = tick; OBS.tr = null;
      if(!wantWide){
        // (v368) с общего плана на бой — сразу на того, кто дерётся
        if(!lockB){ var fb = null, fs = 0; bots.forEach(function(o){ if(!o.alive || !(o.planting || o.defusing || obsFight(o, OBS_K.fightLock))) return; var v = obsScore(o); if(v > fs){ fs = v; fb = o; } });
          if(fb && fb.id !== OBS.id) obsSet(fb, ts, false); }
        // (v459) и быстро: перелёт wideToNear с (раньше масштаб полз ~2,5 с — бой кончался раньше, чем камера доезжала)
        if(OBS.sc) OBS.tr = {t0: ts, fx: OBS.cx, fy: OBS.cy, fsc: OBS.sc, dur: OBS_K.wideToNear, noDip: true};
      } }
    if(OBS.wide){ OBS.tr = null; var FV = obsFullView(r); tx = FV.x; ty = FV.y; tsc = FV.sc; }
  }
  // плавно: камера доезжает за ~0,8 с; к дальнему — не быстрее 900 px карты/с (v316)
  var k = 1 - Math.exp(-dt*3.2);
  if(!OBS.sc){ OBS.sc = view.scale; OBS.cx = (r.width/2 - view.panX)/view.scale; OBS.cy = (r.height/2 - view.panY)/view.scale; }
  // (v330, М48) перелёт к новому игроку — OBS_TR с, плавный разгон и торможение; далеко (больше 500 ед. карты) — на середине пути
  // камера отдаляется (до 35 %), чтобы было видно, куда летит. Проектные числа
  if(OBS.tr && OBS.tr.t0 && !manual){
    var T = OBS.tr, p = Math.min(1, (ts - T.t0)/((T.dur || OBS_TR)*1000)), e2 = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3)/2;
    var dist = Math.hypot(tx - T.fx, ty - T.fy), dip = T.noDip ? 0 : Math.min(0.35, Math.max(0, (dist - 500)/2000));
    OBS.cx = T.fx + (tx - T.fx)*e2; OBS.cy = T.fy + (ty - T.fy)*e2;
    OBS.sc = (T.fsc + (tsc - T.fsc)*e2) * (1 - dip*Math.sin(Math.PI*p));
    view.scale = OBS.sc; view.panX = r.width/2 - OBS.cx*OBS.sc; view.panY = r.height/2 - OBS.cy*OBS.sc;
    if(p >= 1) OBS.tr = null;
    return;
  }
  var mvx = (tx - OBS.cx)*k, mvy = (ty - OBS.cy)*k, mv = Math.hypot(mvx, mvy), mvMax = 900*dt;
  if(mv > mvMax){ mvx *= mvMax/mv; mvy *= mvMax/mv; }
  OBS.cx += mvx; OBS.cy += mvy;
  // (v314) масштаб — медленнее позиции (~1,5 с) и не быстрее ±45 % в секунду
  var ks = 1 - Math.exp(-dt*1.6), nsc = OBS.sc + (tsc - OBS.sc)*ks, lim = Math.exp(0.45*dt);
  OBS.sc = Math.max(OBS.sc/lim, Math.min(OBS.sc*lim, nsc));
  view.scale = OBS.sc; view.panX = r.width/2 - OBS.cx*OBS.sc; view.panY = r.height/2 - OBS.cy*OBS.sc;
}
// (v307) мини-радар — вся карта в углу: живые — кружок цвета стороны с номером и чёрточкой взгляда, погибшие — крестик, бомба
var MINI = {cv:null, ctx:null};
function miniDraw(){
  var c = MINI.cv || (MINI.cv = document.getElementById("miniMap")); if(!c) return;
  var x = MINI.ctx || (MINI.ctx = c.getContext("2d")), W = c.width, k = W/2048;
  x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,W,W);
  x.setTransform(k,0,0,k,0,0);
  if(imgReady){ x.globalAlpha = 0.9; x.drawImage(img,0,0,2048,2048); x.globalAlpha = 1; }
  // видимая область большого радара — рамкой
  var r = wrapRect(), vx0 = -view.panX/view.scale, vy0 = -view.panY/view.scale;
  x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2/k; x.strokeRect(vx0, vy0, r.width/view.scale, r.height/view.scale);
  // (v309) гранаты: смоки — серые круги, огонь — оранжевые, летящие — точки цвета стороны
  smokes.forEach(function(sm){ var rr = smokeRadiusNow(sm); if(rr <= 2) return; x.fillStyle = "rgba(210,214,206,.75)"; x.beginPath(); x.arc(sm.x, sm.y, rr, 0, Math.PI*2); x.fill(); });
  fires.forEach(function(f){ x.fillStyle = "rgba(255,120,40,.65)"; x.beginPath(); x.arc(f.x, f.y, NADE.molly.radius, 0, Math.PI*2); x.fill(); });
  nadesInAir.forEach(function(n){ x.fillStyle = n.team === "CT" ? "#a9cdf0" : "#f0cf93"; x.beginPath(); x.arc(n.x, n.y, 4/k, 0, Math.PI*2); x.fill(); });
  bots.forEach(function(b){
    var col = b.team === "CT" ? "#5a9bd9" : "#d9a24a";
    if(!b.alive){ x.strokeStyle = col; x.lineWidth = 3/k; var q = 5/k; x.beginPath(); x.moveTo(b.x-q,b.y-q); x.lineTo(b.x+q,b.y+q); x.moveTo(b.x+q,b.y-q); x.lineTo(b.x-q,b.y+q); x.stroke(); return; }
    var R = 7/k;
    if(b.facing !== undefined){ x.strokeStyle = col; x.lineWidth = 2/k; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(b.x+Math.cos(b.facing)*R*1.9, b.y+Math.sin(b.facing)*R*1.9); x.stroke(); }
    x.fillStyle = col; x.beginPath(); x.arc(b.x, b.y, R, 0, Math.PI*2); x.fill();
    if(plSelected === b.id){ x.strokeStyle = "#fff"; x.lineWidth = 2/k; x.stroke(); }
    x.fillStyle = "#0b0f0b"; x.font = "600 "+(9/k)+"px 'IBM Plex Mono',monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(pnum(b.id)), b.x, b.y+0.5/k);
  });
  // (v309) бомба: у носителя — маленькая иконка рядом, на земле — жёлтая, поставлена — красная мигающая
  if(bomb){
    var bx = bomb.state === "carried" && bomb.carrier ? bomb.carrier.x + 9/k : bomb.x, by = bomb.state === "carried" && bomb.carrier ? bomb.carrier.y - 9/k : bomb.y;
    var on = bomb.state !== "planted" || Math.floor(performance.now()/400) % 2 === 0;
    x.fillStyle = bomb.state === "planted" ? (on ? "#ff5a4a" : "#7a2620") : (bomb.state === "dropped" ? "#ffd25a" : "#ffb347");
    x.fillRect(bx-6/k, by-4/k, 12/k, 8/k); x.strokeStyle = "#0b0f0b"; x.lineWidth = 1.5/k; x.strokeRect(bx-6/k, by-4/k, 12/k, 8/k);
  }
}
// (v310) с кем бой у игрока обсервера — пунктир от него к сопернику и кольцо вокруг соперника
function obsOverlay(){
  if(!OBS.on || !OBS.id) return;
  if(roundState !== "live" && !WARM.on){ OBS.foeId = null; return; }   // (v316) раунд кончился — линии боя нет
  var a = teamBot(OBS.id); if(!a || !a.alive) return;
  ctx.save(); ctx.setTransform(view.scale,0,0,view.scale,view.panX,view.panY);
  var e = OBS.foeId ? teamBot(OBS.foeId) : null;
  if(e && e.alive){
    ctx.strokeStyle = "rgba(255,90,74,.85)"; ctx.lineWidth = 2/view.scale; ctx.setLineDash([6/view.scale, 5/view.scale]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.setLineDash([]);
    var pr = (11 + 2*Math.sin(performance.now()/160))/view.scale; ctx.lineWidth = 2.5/view.scale; ctx.beginPath(); ctx.arc(e.x, e.y, pr, 0, Math.PI*2); ctx.stroke();
  }
  // (v459) слежка за выбранным — метка под игроком
  if(OBS.lock === a.id){
    ctx.font = "600 "+(8/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    var lt = "слежка", tw = ctx.measureText(lt).width, ly = a.y + 11/view.scale;
    ctx.fillStyle = "rgba(11,15,11,.78)"; ctx.fillRect(a.x - tw/2 - 3/view.scale, ly - 1/view.scale, tw + 6/view.scale, 11/view.scale);
    ctx.fillStyle = "#e8ecdd"; ctx.fillText(lt, a.x, ly); ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
}
function obsManual(){ OBS.manualUntil = performance.now() + 6000; OBS.sc = 0; }
(function(){
  var wsk = document.getElementById("btnWarmSkip"); if(wsk) wsk.addEventListener("click", warmEnd);
  // (v307) галочка «разминка» запоминается в этом браузере; снял её во время разминки — разминка сразу заканчивается
  var cw = document.getElementById("chkWarm");
  if(cw){ try{ if(localStorage.getItem("sim-warmup") === "0") cw.checked = false; }catch(e){}
    cw.addEventListener("change", function(){ try{ localStorage.setItem("sim-warmup", cw.checked ? "1" : "0"); }catch(e){} if(!cw.checked) warmEnd(); }); }
  var ss = document.getElementById("selSeries"); if(ss) ss.addEventListener("change", function(){ SERIES = {bo:+ss.value, maps:{}}; seriesUpdate(); });
  var b = document.getElementById("btnObs");
  if(b) b.addEventListener("click", function(){ OBS.on = !OBS.on; OBS.sc = 0; OBS.manualUntil = 0; if(!OBS.on) fit(); });
  OBS.full = true; try{ OBS.full = localStorage.getItem("sim-obs-full") !== "0"; }catch(e){}   // (v364) по умолчанию — вся карта
  var bm = document.getElementById("btnObsMap");
  if(bm) bm.addEventListener("click", function(){ var to = !(OBS.on && OBS.full); OBS.full = to; if(to) OBS.on = true; OBS.manualUntil = 0; OBS.tr = null;
    try{ localStorage.setItem("sim-obs-full", to ? "1" : "0"); }catch(e){} });
  cv.addEventListener("mousedown", obsManual); cv.addEventListener("wheel", obsManual, {passive:true});
  // (v459) клик по игроку (панель или радар) — слежка за ним; повторный клик по нему или клик мимо — обсервер снова сам.
  // Карточку игрока обсервер и так держит выбранной, поэтому решает клик сам по себе, а не plSelected
  var obsLockTo = function(id){ var b = id ? teamBot(id) : null;
    if(!b || !b.alive || OBS.lock === id){ OBS.lock = null; return; }
    OBS.lock = id; OBS.on = true; OBS.manualUntil = 0;
    if(plSelected !== id){ plSelected = id; playersUpdate(); } };
  ["plT","plCT"].forEach(function(id){ var el = document.getElementById(id); if(!el) return;
    el.addEventListener("pointerdown", function(e){ if(e.button !== 0) return; var c = e.target.closest && e.target.closest(".pl-card"); if(c) obsLockTo(c.dataset.id); }); });
  var obsDown = null;
  cv.addEventListener("mousedown", function(e){ obsDown = e.button === 0 ? {x: e.clientX, y: e.clientY} : null; });
  cv.addEventListener("mouseup", function(e){ var d = obsDown; obsDown = null;
    if(!d || e.button !== 0 || Math.hypot(e.clientX-d.x, e.clientY-d.y) > 4) return;   // перетаскивание камеры — ручной режим, как раньше
    var w = navScreenToWorld(e.clientX, e.clientY), best = null, bd = 16/view.scale;
    bots.forEach(function(b){ if(!b.alive) return; var dd = Math.hypot(b.x-w.x, b.y-w.y); if(dd < bd){ bd = dd; best = b; } });
    if(best) obsLockTo(best.id); else OBS.lock = null; });
  window.addEventListener("keydown", function(e){ if((e.key === "o" || e.key === "O" || e.key === "щ" || e.key === "Щ") && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")){ OBS.on = !OBS.on; OBS.sc = 0; OBS.manualUntil = 0; if(!OBS.on) fit(); } });
})();
