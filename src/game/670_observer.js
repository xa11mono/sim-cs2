// ======================= (v304) АВТООБСЕРВЕР — только показ, на игру не влияет =======================
// Сам выбирает, за кем следить (как режиссёр трансляции): бой, плант/дефуз, клатч, только что фраг, по нему стреляют, рядом враг.
// Держит выбранного не меньше 1,2 с (v305), переключается, если новый момент интереснее (×1,15) или выбранный погиб (через 1 с —
// видно смерть). Камера плавно едет и приближает: бой — ближе, спокойно — дальше, между раундами — вся карта.
// Ручное движение камеры, колесо или выбор игрока — обсервер ждёт 6 с. Числа — проектные (это показ, не поведение)
var OBS = {on:true, id:null, since:0, deadAt:0, manualUntil:0, last:0, cx:1024, cy:1024, sc:0, tr:null}, OBS_TR = 0.6, OBS_OFF = 0.3;
// (v321, М10) фокус обсервера: выход T на сайт (15 с от начала выхода), плант и 3 с после — интересный момент; камера
// держится игроков у этого сайта (ближе 900 ед. карты), переключается между ними и показывает выход целиком; бой в другом
// месте его не перебивает (проектные числа)
function obsFocus(){
  var tt = teamTac && teamTac.T; if(roundState !== "live") return null;
  if(bomb && bomb.state === "planted" && bomb.plantTick && tick - bomb.plantTick < 3*TICK_HZ) return {x:bomb.x, y:bomb.y, site:bomb.site, plant:true};
  if(bots.some(function(b){ return b.alive && b.planting; })){ var p = bots.filter(function(b){ return b.alive && b.planting; })[0]; return {x:p.x, y:p.y, site:tt && tt.site, plant:true}; }
  if(tt && tt.phase === "execute" && tt.execStart != null && tick - tt.execStart < 15*TICK_HZ && SITES[tt.site]) return {x:SITES[tt.site].x, y:SITES[tt.site].y, site:tt.site};
  return null;
}
function obsScore(b){
  if(!b.alive) return 0;
  var F = obsFocus();
  // (v368, владелец: «обсервер не переключается на перестрелку») фокус выхода не гасит бой в другом месте: дерущийся вне
  // фокуса — с обычным счётом (раньше 0,2 — бой magixx у T Ramp не показывали, пока шёл выход)
  var fightNow = b._sawEnemy || tick - (b._shotAtT||-1e9) < TICK_HZ || tick - (b.lastShotTick||-1e9) < TICK_HZ;
  if(F && !fightNow){ var dF = Math.hypot(b.x-F.x, b.y-F.y); if(dF > 900) return 0.2; }
  var foe = b.team === "CT" ? "T" : "CT", sc = 1;
  if(b.planting || b.defusing) sc += 9;
  if(b._sawEnemy) sc += 6 + Math.min(4, (b.contactStreak||0)/16);
  if(tick - (b._shotAtT||-1e9) < 64) sc += 5;
  if(tick - (b.lastShotTick||-1e9) < 64) sc += 3;
  if(b._killHowT && tick - b._killHowT < 128) sc += 2;
  var mates = bots.filter(function(o){ return o.alive && o.team === b.team; }).length, foes = aliveCount(foe);
  if(mates === 1 && foes >= 1) sc += 4;                                  // клатч
  if(bomb && bomb.state === "carried" && bomb.carrier === b) sc += 1.5;
  var dmin = Infinity; bots.forEach(function(o){ if(o.alive && o.team === foe) dmin = Math.min(dmin, Math.hypot(o.x-b.x, o.y-b.y)); });
  sc += 3 / (1 + dmin/400);                                               // рядом враг — скоро бой
  // (v307, владелец 14.10: «не успевает переключить — бота убивают») враг уже видит его или вот-вот выйдет: враг ≤ 450 px и видит
  // его / смотрит в его сторону — переключаемся заранее, до выстрелов
  bots.forEach(function(o){ if(!o.alive || o.team !== foe) return; var d = Math.hypot(o.x-b.x, o.y-b.y); if(d > 450) return;
    if(o._sawEnemy && o._nearestEnemyBot === b) sc += 6;
    else if(o.facing !== undefined && _angOff(Math.atan2(b.y-o.y, b.x-o.x), o.facing) < 0.5) sc += 2.5; });
  if(b.id === OBS.id) sc *= 1.05;                                         // инерция (v305: меньше — динамичнее)
  if(b.id === OBS.prev && performance.now() < OBS.prevUntil && !b._sawEnemy) sc *= 0.5;   // (v305) только что показывали — не сразу обратно
  return sc;
}
var OBS_BOUNDS = null, OBS_PLAN_MIN = 3, OBS_WIDE_MAX = 10, OBS_NEAR_CALM = 6;
function obsFullView(r){
  if(!OBS_BOUNDS){ var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    NAVAREAS.forEach(function(a){ a.points.forEach(function(p){ if(p.x < x0) x0 = p.x; if(p.x > x1) x1 = p.x; if(p.y < y0) y0 = p.y; if(p.y > y1) y1 = p.y; }); });
    OBS_BOUNDS = {x0: x0-30, y0: y0-30, x1: x1+30, y1: y1+30}; }
  var B = OBS_BOUNDS, rr = function(id){ var e = document.getElementById(id); if(!e || !e.offsetParent) return null; return e.getBoundingClientRect(); };
  // свободный прямоугольник в координатах холста: слева/справа — панели игроков, сверху — табло (если они видны)
  var L = 0, R = r.width, T = 0, Bt = r.height, pT = rr("plT"), pC = rr("plCT"), sb = rr("scoreboard");
  if(pT && pT.right > r.left && pT.right < r.left + r.width/2) L = pT.right - r.left + 8;
  if(pC && pC.left < r.right && pC.left > r.left + r.width/2) R = pC.left - r.left - 8;
  if(sb && sb.bottom > r.top) T = Math.min(r.height/3, sb.bottom - r.top + 4);
  var pf = rr("plFocus");   // (v364) карточка игрока обсервера внизу по центру — карта над ней, а не под ней
  if(pf && pf.height > 0 && pf.top > r.top + r.height/2 && pf.top < r.bottom) Bt = pf.top - r.top - 4;
  if(R - L < r.width*0.4){ L = 0; R = r.width; }   // узкий экран — панели поверх карты, берём всю ширину
  var sc = Math.min((R - L)/(B.x1 - B.x0), (Bt - T)/(B.y1 - B.y0));
  var cx = (B.x0 + B.x1)/2, cy = (B.y0 + B.y1)/2;
  // центр карты — в центре свободного прямоугольника (камера держит центр экрана): сдвиг в координатах карты
  var offX = ((L + R)/2 - r.width/2)/sc, offY = ((T + Bt)/2 - r.height/2)/sc;
  return {x: cx - offX, y: cy - offY, sc: sc};
}
function obsFrame(ts){
  var btn = document.getElementById("btnObs"); if(btn) btn.className = OBS.on ? "on" : "";
  var btnM = document.getElementById("btnObsMap"); if(btnM) btnM.className = OBS.on && OBS.full ? "on" : "";
  if(!OBS.on) return;
  var dt = OBS.last ? Math.min(0.1, (ts - OBS.last)/1000) : 0.016; OBS.last = ts;
  var r = wrap.getBoundingClientRect(), fitSc = Math.min(r.width/2048, r.height/2048) * 1.08;
  var manual = ts < OBS.manualUntil;
  var tx = 1024, ty = 1024, tsc = fitSc;
  // (v359, владелец: «обсервер мог показывать всю ситуацию, всю карту») режим «Вся карта»: камера на всей карте, игрок не выбирается
  // масштаб — чтобы вся карта (границы навмеша) поместилась в свободной части экрана: между панелями игроков, ниже табло
  if((roundState === "live" || WARM.on) && !manual){
    var cur = OBS.id && bots.filter(function(o){ return o.id === OBS.id; })[0];
    if(cur && !cur.alive && !OBS.deadAt) OBS.deadAt = ts;
    var best = null, bs = 0; bots.forEach(function(o){ var v = obsScore(o); if(v > bs){ bs = v; best = o; } });
    var curS = cur && cur.alive ? obsScore(cur) : 0;
    // (v305, владелец 14.10: «менять игрока чаще») держит ≥ 1,2 с, переключается, если новый момент интереснее на 15 %; спокойный
    // (не в бою) дольше 5 с — смена на другого, чтобы картинка не стояла
    var calm = cur && cur.alive && !cur._sawEnemy && tick - (cur._shotAtT||-1e9) > 64 && tick - (cur.lastShotTick||-1e9) > 64;
    if(calm && ts - OBS.since > 8000 && best === cur){ var b2 = null, s2 = 0; bots.forEach(function(o){ if(o === cur) return; var v = obsScore(o); if(v > s2){ s2 = v; b2 = o; } }); if(b2){ best = b2; bs = s2*2; } }
    var inFight = function(o){ return o && o.alive && (o._sawEnemy || tick - (o._shotAtT||-1e9) < 32); };
    // (v330, М47, владелец) у выбранного перестрелка (видит врага, стрелял или по нему стреляли ≤ 2 с) — не уходим с него, пока
    // бой не кончился или он не погиб; ни другой бой, ни выход на сайт не перебивают
    var curFight = cur && cur.alive && (cur._sawEnemy || tick - (cur._shotAtT||-1e9) < 2*TICK_HZ || tick - (cur.lastShotTick||-1e9) < 2*TICK_HZ);
    // погиб — 1,5 с видно место смерти, потом к убийце, если жив (как режиссёр трансляции)
    if(cur && !cur.alive && cur._killer && ts - OBS.deadAt > 1500){ var kb = bots.filter(function(o){ return o.id === cur._killer && o.alive; })[0]; if(kb){ best = kb; bs = Infinity; } }
    // бой начался у другого, а у выбранного боя нет — сразу, без выдержки 1,2 с
    var urgent = best && best !== cur && inFight(best) && !inFight(cur);
    // (v310, владелец 14.10: «очень быстро стало меняться») держит ≥ 2,5 с, переключается при перевесе ×1,3; срочно (бой у другого) —
    // не чаще раза в 1 с и только если у выбранного боя не было 1,5 с
    if(urgent && (ts - OBS.since < 1000 || tick - Math.max(cur ? (cur._shotAtT||-1e9) : -1e9, cur ? (cur.lastShotTick||-1e9) : -1e9) < 96)) urgent = false;
    var FO = obsFocus();
    if(FO && cur && cur.alive && !curFight && Math.hypot(cur.x-FO.x, cur.y-FO.y) > 900) urgent = true;   // (v321, М10) начался выход — к нему (не посреди дуэли — v330)
    // на выходе — переключение между его игроками: каждого держит 2,5 с, потом следующий интересный у сайта
    if(FO && cur && cur.alive && !curFight && ts - OBS.since > 2500 && best === cur){ var b3 = null, s3 = 0; bots.forEach(function(o){ if(o === cur) return; var v = obsScore(o); if(v > s3){ s3 = v; b3 = o; } }); if(b3 && s3 > 1){ best = b3; bs = curS*2; } }
    var canSwitch = !cur || (!cur.alive && ts - OBS.deadAt > 1500) || (!curFight && (urgent || (ts - OBS.since > 2500 && bs > curS*1.3)));
    if(best && best !== cur && canSwitch){ if(cur){ OBS.prev = cur.id; OBS.prevUntil = ts + 5000; } OBS.id = best.id; OBS.since = ts; OBS.deadAt = 0; cur = best;
      if(OBS.sc) OBS.tr = {t0: ts, fx: OBS.cx, fy: OBS.cy, fsc: OBS.sc};   // (v330, М48) начало перелёта камеры
    }
    // (v305) карточка по центру — всегда игрок обсервера (после ручного выбора обсервер возвращает её себе)
    if(cur && cur.alive && plSelected !== cur.id){ plSelected = cur.id; playersUpdate(); }
    if(cur){
      tx = cur.x; ty = cur.y;
      // (v310, владелец 14.10: «плохо видно, с кем он стреляется») соперник — тот, кого он видит, или кто видит его / стрелял по нему;
      // в кадре оба (центр между ними, запас ×2,4), без боя — ближайший враг в 700 px тоже в кадре
      var e = (cur._sawEnemy && cur._nearestEnemyBot && cur._nearestEnemyBot.alive) ? cur._nearestEnemyBot : null;
      if(!e) bots.forEach(function(o){ if(!e && o.alive && o.team !== cur.team && o._sawEnemy && o._nearestEnemyBot === cur) e = o; });
      var near = null, nd = 700; if(!e) bots.forEach(function(o){ if(o.alive && o.team !== cur.team){ var d = Math.hypot(o.x-cur.x, o.y-cur.y); if(d < nd){ nd = d; near = o; } } });
      var fight = !!e, other = e || near; OBS.foeId = e ? e.id : null;
      if(other){ tx = (cur.x + other.x)/2; ty = (cur.y + other.y)/2; }
      var span = other ? Math.max(fight ? 650 : 900, Math.hypot(other.x-cur.x, other.y-cur.y)*2.4) : 1100;   // сколько карты видно
      if(FO){   // (v321, М10) выход/плант — в кадре все игроки у сайта; (v345) без центра сайта — он тянул кадр на пустой сайт
        var xs = [cur.x], ys = [cur.y];
        bots.forEach(function(o){ if(o.alive && Math.hypot(o.x-FO.x, o.y-FO.y) < 700){ xs.push(o.x); ys.push(o.y); } });
        var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
        tx = (x0+x1)/2; ty = (y0+y1)/2; span = Math.max(700, (x1-x0)*1.3, (y1-y0)*1.3);
      }
      // (v345, владелец: «масштаб и положение иногда странные» — выбранный у края кадра, в центре пустой сайт) игрок обсервера —
      // всегда во внутренней части кадра: центр не дальше OBS_OFF от него (доля видимой области, проектное число)
      var offX = tx - cur.x, offY = ty - cur.y, offL = Math.hypot(offX, offY), offMax = OBS_OFF*span;
      if(offL > offMax){ tx = cur.x + offX*offMax/offL; ty = cur.y + offY*offMax/offL; }
      tsc = Math.max(fitSc, Math.min(r.width, r.height) / span);
    }
  } else if(manual) return;
  // (v364, владелец: «обсервер приближает на игрока, а надо, чтобы всегда была видна вся карта») «Вся карта»: обсервер так же
  // выбирает, за кем следить (карточка игрока), но камера не приближает — вся карта в свободной части экрана
  // (v365, владелец: «зачем всё время — я просил, чтобы чередовалось») как трансляция: когда тихо (ни у кого нет боя, не ставят
  // и не дефузят) — общий план, вся карта; начался бой, плант/дефуз, выход на сайт — камера на игроке. Каждый план держится
  // не меньше OBS_PLAN_MIN с, чтобы не дёргалось; общий план — не дольше OBS_WIDE_MAX с подряд, потом снова игрок (проектные числа)
  if(OBS.full && !manual){
    var hot = bots.some(function(o){ return o.alive && (o._sawEnemy || o.planting || o.defusing || tick - (o._shotAtT||-1e9) < 2*TICK_HZ || tick - (o.lastShotTick||-1e9) < 2*TICK_HZ); }) || !!obsFocus();
    var live = roundState === "live";
    var wantWide = !live || !hot;
    if(OBS.wide === undefined){ OBS.wide = true; OBS.planT = ts; }
    var held = ts - (OBS.planT||0);
    if(live && OBS.wide && held > OBS_WIDE_MAX*1000 && !hot) wantWide = false;          // долго общий план — к игроку
    if(live && !OBS.wide && !hot && held > OBS_NEAR_CALM*1000) wantWide = true;          // на игроке тихо — общий план
    else if(live && !OBS.wide && !hot) wantWide = false;
    if(wantWide !== OBS.wide && (held > OBS_PLAN_MIN*1000 || (hot && OBS.wide))){ OBS.wide = wantWide; OBS.planT = ts; OBS.tr = null;
      // (v368) с общего плана на бой — сразу на того, кто дерётся (а не на последнего выбранного)
      if(!wantWide){ var fb = null, fs = 0; bots.forEach(function(o){ if(!o.alive || !(o._sawEnemy || o.planting || o.defusing || tick - (o.lastShotTick||-1e9) < 2*TICK_HZ)) return; var v = obsScore(o); if(v > fs){ fs = v; fb = o; } });
        if(fb && fb.id !== OBS.id){ OBS.prev = OBS.id; OBS.prevUntil = ts + 5000; OBS.id = fb.id; OBS.since = ts; OBS.deadAt = 0; if(plSelected !== fb.id){ plSelected = fb.id; playersUpdate(); } } } }
    if(OBS.wide){ OBS.tr = null; var FV = obsFullView(r); tx = FV.x; ty = FV.y; tsc = FV.sc; }
  }
  // плавно: камера доезжает за ~0,5 с
  // (v316, владелец 14.10: «далеко — слишком быстро») переезд спокойнее: ~0,8 с на близкое, к дальнему — не быстрее 900 px карты/с
  var k = 1 - Math.exp(-dt*3.2);
  if(!OBS.sc){ OBS.sc = view.scale; OBS.cx = (r.width/2 - view.panX)/view.scale; OBS.cy = (r.height/2 - view.panY)/view.scale; }
  // (v330, М48, владелец: «смена далёких игроков очень резкая») перелёт к новому игроку — OBS_TR с, плавный разгон и торможение;
  // далеко (больше 500 ед. карты) — на середине пути камера отдаляется (до 35 %), чтобы было видно, куда летит. Проектные числа
  if(OBS.tr && OBS.tr.t0 && !manual){
    var T = OBS.tr, p = Math.min(1, (ts - T.t0)/(OBS_TR*1000)), e = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3)/2;
    var dist = Math.hypot(tx - T.fx, ty - T.fy), dip = Math.min(0.35, Math.max(0, (dist - 500)/2000));
    OBS.cx = T.fx + (tx - T.fx)*e; OBS.cy = T.fy + (ty - T.fy)*e;
    OBS.sc = (T.fsc + (tsc - T.fsc)*e) * (1 - dip*Math.sin(Math.PI*p));
    view.scale = OBS.sc; view.panX = r.width/2 - OBS.cx*OBS.sc; view.panY = r.height/2 - OBS.cy*OBS.sc;
    if(p >= 1) OBS.tr = null;
    return;
  }
  var mvx = (tx - OBS.cx)*k, mvy = (ty - OBS.cy)*k, mv = Math.hypot(mvx, mvy), mvMax = 900*dt;
  if(mv > mvMax){ mvx *= mvMax/mv; mvy *= mvMax/mv; }
  OBS.cx += mvx; OBS.cy += mvy;
  // (v314, владелец 14.10: «масштаб резко меняется») масштаб — медленнее позиции (~1,5 с) и не быстрее ±45 % в секунду
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
  var r = wrap.getBoundingClientRect(), vx0 = -view.panX/view.scale, vy0 = -view.panY/view.scale;
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
  if(!OBS.on || !OBS.id || !OBS.foeId) return;
  if(roundState !== "live" && !WARM.on){ OBS.foeId = null; return; }   // (v316) раунд кончился — линии боя нет
  var a = bots.filter(function(o){ return o.id === OBS.id; })[0], e = bots.filter(function(o){ return o.id === OBS.foeId; })[0];
  if(!a || !e || !a.alive || !e.alive) return;
  ctx.save(); ctx.setTransform(view.scale,0,0,view.scale,view.panX,view.panY);
  ctx.strokeStyle = "rgba(255,90,74,.85)"; ctx.lineWidth = 2/view.scale; ctx.setLineDash([6/view.scale, 5/view.scale]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.setLineDash([]);
  var pr = (11 + 2*Math.sin(performance.now()/160))/view.scale; ctx.lineWidth = 2.5/view.scale; ctx.beginPath(); ctx.arc(e.x, e.y, pr, 0, Math.PI*2); ctx.stroke();
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
  ["plT","plCT"].forEach(function(id){ var el = document.getElementById(id); if(el) el.addEventListener("pointerdown", function(){ obsManual(); OBS.id = null; }); });
  window.addEventListener("keydown", function(e){ if((e.key === "o" || e.key === "O" || e.key === "щ" || e.key === "Щ") && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")){ OBS.on = !OBS.on; OBS.sc = 0; OBS.manualUntil = 0; if(!OBS.on) fit(); } });
})();
