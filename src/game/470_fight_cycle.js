// ---- перестрелка по данным (v250, вместо пиков «широкий/плечо/джиггл» и стрейфа v166) ----
// Как у про в 92 демках Ancient (tools/peek_bake.py → src/data/trades.json, поле peek): игрок стоит на линии,
// пока стреляет (длительность перестрелки), потом уходит с линии за укрытие (сдвиг), пережидает (пауза) и
// с долей repeek выглядывает снова на то же место; иначе перестрелка для него закончена — дальше обычная логика.
// Квантили 10/25/50/75/90 %; длительность — от первого до последнего «окна стрельбы» (окно = 0,5 с).
var PEEK_PRO = {CT:{dur:[0.0, 0.0, 0.55, 1.72, 3.14], pause:[1.08, 1.25, 1.62, 2.17, 2.61], shift:[13.93, 23.6, 40.79, 66.58, 96.11]},
                T:{dur:[0.0, 0.0, 0.41, 1.3, 2.84], pause:[1.09, 1.27, 1.67, 2.23, 2.7], shift:[14.29, 25.12, 47.4, 80.62, 119.72]}};
var PEEK_Q = [0.1, 0.25, 0.5, 0.75, 0.9];
function peekQ(q, u){   // значение распределения по квантилям (между ними — линейно, хвосты — крайние)
  if(u <= PEEK_Q[0]) return q[0];
  for(var i=1;i<PEEK_Q.length;i++) if(u <= PEEK_Q[i]) return q[i-1] + (q[i]-q[i-1])*(u-PEEK_Q[i-1])/(PEEK_Q[i]-PEEK_Q[i-1]);
  return q[q.length-1];
}
// ближайшее место не дальше R, откуда врага e не видно и куда можно дойти по прямой; из равных — дальше от врага
// (М149) «не видно» — враг не видит там ни одной части тела, плечо тоже (visParts), а не только «глаза в глаза» (hasLOS):
// иначе за укрытием торчит плечо, и перестрелка не кончается
// (v410, владелец 22.10: «игрок 9 опять дёргается», м1 р1 Mirage 1:40) укрытие проверялось одним длинным отрезком stepBlocked, а идёт
// бот туда шагами по ≈ 2 ед. — короткий шаг посередине упирался (край пола / уступ), цикл перестрелки сбрасывался (_fc = null), в тот
// же тик «стреляют в плечо» заводил его снова к тому же укрытию — 1160,1581: «за укрытие / сброс» через тик, стоял и дёргался. Теперь
// отрезок проверяется теми же короткими шагами, которыми бот пойдёт (FIGHT_STEP)
var FIGHT_STEP = 4;   // ед. карты — шаг проверки (бег за тик ≈ 2–3 ед.)
function fightPathFree(b, x0, y0, x1, y1){
  var d = Math.hypot(x1-x0, y1-y0), n = Math.max(1, Math.ceil(d/FIGHT_STEP)), px = x0, py = y0;
  for(var i = 1; i <= n; i++){ var x = x0 + (x1-x0)*i/n, y = y0 + (y1-y0)*i/n; if(stepBlocked(px, py, x, y, b)) return false; px = x; py = y; }
  return true;
}
// (v426, владелец 25.10, Mirage м1 р4: donk 1 против 4 «ушёл с линии», а стоит в открытую) укрытие — скрытое и от остальных врагов,
// которых бот знает (видел / слышал за 4 с, ≤ 1200 — exposedTo, то же, что у перезарядки), а не только от того, с кем стреляется. Такого
// рядом нет — как раньше: скрытое от него одного
// (v518b, пак 09.11 п.5; владелец А-5: «раш Б, и все в одном месте толпятся — никто не протягивает раш») укрытие — не туда, где уже стоит / куда
// уходит свой (≤ FIGHT_MATE_R), и при «давить» (fightPush) — не назад: из укрытий выбирается то, что ближе к точке задачи, а не дальше от врага
var FIGHT_MATE_R = 30;   // px — проектное число (укрытие одного человека)
function fightMateAt(b, x, y){ return bots.some(function(o){ return o !== b && o.alive && o.team === b.team && (Math.hypot(o.baseX-x, o.baseY-y) < FIGHT_MATE_R || (o._fc && o._fc.ph === "off" && Math.hypot(o._fc.cx-x, o._fc.cy-y) < FIGHT_MATE_R)); }); }
function fightCover(b, e, R, toward){
  var others = exposedTo(b, 1200, 4*TICK_HZ, true).filter(function(o){ return Math.hypot(o.x-e.x, o.y-e.y) > 60; });
  for(var pass = others.length ? 0 : 1; pass < 2; pass++){
    for(var k=1;k<=3;k++){
      var r = R*k/3, best = null, bd = -Infinity;
      for(var i=0;i<16;i++){
        var a = i*Math.PI/8, x = b.baseX + Math.cos(a)*r, y = b.baseY + Math.sin(a)*r;
        if(insideSolidWall(x, y) || !fightPathFree(b, b.baseX, b.baseY, x, y) || fightSeen(e, x, y, b.z) || fightMateAt(b, x, y)) continue;
        if(pass === 0 && others.some(function(o){ return hasLOS(x, y, o.x, o.y, b.z); })) continue;
        var de = toward ? -Math.hypot(x-toward.x, y-toward.y) : Math.hypot(x-e.x, y-e.y); if(de > bd){ bd = de; best = {x:x, y:y}; }
      }
      if(best) return best;
    }
  }
  return null;
}
function fightSeen(e, x, y, z){ var p = visParts(e.x, e.y, e.crouching, x, y, false, true, e.z, z); return p.head || p.body; }
// (М149) место получше: рядом с укрытием (cx, cy), откуда врага видно целиком — глаза в глаза, а не одно плечо; ближе к укрытию
function fightBetter(b, e, cx, cy, R){
  var best = null, bd = Infinity;
  for(var k=1;k<=3;k++) for(var i=0;i<16;i++){
    var a = i*Math.PI/8, r = R*k/3, x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r;
    if(insideSolidWall(x, y) || !fightPathFree(b, cx, cy, x, y) || !hasLOS(x, y, e.x, e.y, b.z, e.z)) continue;
    var d = Math.hypot(x-cx, y-cy); if(d < bd){ bd = d; best = {x:x, y:y}; }
  }
  return best;
}
// (00_PLAN, ответ владельца 4, 05.11: «за укрытием — держит / джигл / меняет угол; не однообразный джигл; против AWP — плечо»)
// другое место пика: как fightBetter, но не ближе minD к прошлой точке пика (px, py)
function fightBetterAway(b, e, cx, cy, R, px, py, minD){
  var best = null, bd = Infinity;
  for(var k=1;k<=3;k++) for(var i=0;i<16;i++){
    var a = i*Math.PI/8, r = R*k/3, x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r;
    if(Math.hypot(x-px, y-py) < minD || insideSolidWall(x, y) || !fightPathFree(b, cx, cy, x, y) || !hasLOS(x, y, e.x, e.y, b.z, e.z)) continue;
    var d = Math.hypot(x-cx, y-cy); if(d < bd){ bd = d; best = {x:x, y:y}; }
  }
  return best;
}
// (v570) место, откуда врага видно целиком (голова и грудь, и чуть вбок — не впритык над краем), на своём ярусе, ближайшее
var FIGHT_COV = {n: 4, share: 0.6, r: 120, side: 6};   // проектные числа: 4 выстрела, 60 % в укрытие; искать до 120 px; запас вбок 6 px
function fightClearSpot(b, e, R){
  var best = null, bd = Infinity, Bd = VIS_BODY.stand[0], tf = visFloorAt(e.x, e.y, e.z), Hd = e.crouching ? VIS_HEAD.crouch : VIS_HEAD.stand;
  var ux = -(e.y - b.y), uy = e.x - b.x, uL = Math.hypot(ux, uy) || 1; ux /= uL; uy /= uL;
  for(var k=1;k<=4;k++) for(var i=0;i<16;i++){
    var a = i*Math.PI/8, r = R*k/4, x = b.baseX + Math.cos(a)*r, y = b.baseY + Math.sin(a)*r;
    if(insideSolidWall(x, y) || !navAt(x, y) || fightMateAt(b, x, y) || !fightPathFree(b, b.baseX, b.baseY, x, y)) continue;
    var fz = visFloorAt(x, y, b.z); if(b.z != null && Math.abs(fz - b.z) > JUMP_UP) continue;
    var ez = fz + VIS_EYE.stand, ok = true;
    for(var s = -1; s <= 1 && ok; s++){ var tx = e.x + ux*FIGHT_COV.side*s, ty = e.y + uy*FIGHT_COV.side*s;
      ok = visMarch(x, y, ez, tx, ty, tf + (e.crouching ? VIS_BODY.crouch[0] : Bd)) && visMarch(x, y, ez, tx, ty, tf + Hd); }
    if(!ok || smokeBlocks(x, y, e.x, e.y)) continue;
    var d = Math.hypot(x-b.baseX, y-b.baseY); if(d < bd){ bd = d; best = {x:x, y:y}; }
  }
  return best;
}
// место «показать плечо»: на отрезке укрытие → точка пика первое место, где врагу видно только плечо (visParts side), но не голову и тело
function fightShoulderPt(b, e, cx, cy, ax, ay){
  var L = Math.hypot(ax-cx, ay-cy); if(L < FIGHT_STEP) return null;
  for(var d = FIGHT_STEP; d < L; d += FIGHT_STEP){ var x = cx + (ax-cx)*d/L, y = cy + (ay-cy)*d/L;
    var p = visParts(e.x, e.y, e.crouching, x, y, false, true, e.z, b.z); if(p.head || p.body) return null; if(p.side) return {x:x, y:y}; }
  return null;
}
// (Б4) движение на линии (одно место): стрейф поперёк линии огня, перед выстрелом — контрстрейф (встречная клавиша + трение).
// Числа игры CS2: sv_accelerate 5.5, sv_friction 5.2, sv_stopspeed 80 ед./с. Стоял (держал угол) — до первого выстрела стоит;
// вошёл в перестрелку на ходу — гасит ту скорость; между очередями — шаг вбок и обратно (люди всегда в движении)
var CS_ACCEL = 5.5, CS_FRIC = 5.2, CS_STOP = 80;
// шаг стрейфа, ед. игры: сдвиг вбок от взгляда между очередями у про (пауза 0,5–1,5 с; 79 + 85 демок, квантили 10/25/50/75/90 %) —
// tools/measure/engine/b4_strafe.py
var STRAFE_PRO = [3.0, 10.6, 34.9, 73.7, 118.6];
function csDecel(v, vmax){ return CS_FRIC*Math.max(v, CS_STOP/PX_UNITS) + CS_ACCEL*vmax; }   // px/с²
function csTicksTo(v, vT, vmax){ var n = 0; while(v > vT + 0.5 && n < 30){ v -= csDecel(v, vmax)/TICK_HZ; n++; } return n; }
function fightStrafe(b, F, dtSec){
  var e = F.e, fr = b._fire, fresh = fr && tick - fr.t <= 1;
  F.own = !!(e && e.alive && (b._sawEnemy || (fr && tick - fr.t < 16)));
  if(!F.own){ F.sv = undefined; return; }
  var dx = e.x - b.baseX, dy = e.y - b.baseY, L = Math.hypot(dx, dy) || 1, ax = -dy/L, ay = dx/L, vmax = SPEED*weaponSpeedMul(b);
  if(F.sv === undefined){   // скорость, с которой вошёл в перестрелку, — дальше она (её гасит или продолжает стрейфом)
    var TR = b._trail || [], tp = TR.length >= 2 ? TR[TR.length-2] : {x:b.baseX, y:b.baseY};   // куда шёл последние ~0,25–0,5 с
    var pr = (b.baseX - tp.x)*ax + (b.baseY - tp.y)*ay;
    F.sdir = pr >= 0 ? 1 : -1; F.sv = F.sdir*Math.min(vmax, Math.max(b.curSpeed || 0, Math.abs((b._keys || {}).v || 0))); F.leg = 0;   // (v571) и ход качания A / D (540) — дальше он у перestrелки
    if(b._keys) b._keys.v = 0;
  }
  if(b.lastShotTick >= F.t) F.started = true;
  // контрстрейф начинается так, чтобы к моменту, когда можно стрелять, скорость упала до той, на которой выстрел «стоит того»
  // (fireVAcc — то же правило, что в tryShoot): вблизи — почти с ходу, вдали — до остановки
  var v = Math.abs(F.sv), vT = fresh ? fireVAcc(b, e, L) : 0, stop = fresh && fr.inT <= csTicksTo(v, vT, vmax) + 1 && !b._reloading;
  if(stop || (!F.started && v < 1)){ v = Math.max(0, v - csDecel(v, vmax)*dtSec); F.sv = (F.sv < 0 ? -1 : 1)*v; }
  else {
    var so = (b.baseX - F.ax)*ax + (b.baseY - F.ay)*ay;
    if(!F.leg) F.leg = Math.max(1, peekQ(STRAFE_PRO, fightRand(b, 7))/PX_UNITS);
    // (v571, В140) до первого выстрела вышедший с ходу продолжает выход, а гасит ход встречной клавишей прямо перед выстрелом (stop выше):
    // у про первая пуля винтовки при выходе — на 69 ед./с (медиана; 25/75 % — 32/103), у бота разворот на первом шаге стрейфа гасил ход до 0
    if(F.started && F.sdir*so >= F.leg){ F.sdir = -F.sdir; F.leg = Math.max(1, peekQ(STRAFE_PRO, fightRand(b, 8))/PX_UNITS); }
    if(F.sv*F.sdir < 0){ var d = csDecel(v, vmax)*dtSec; F.sv = v <= d ? 0 : F.sv - (F.sv < 0 ? -1 : 1)*d; }
    else F.sv = F.sdir*Math.min(vmax, v + Math.max(0, CS_ACCEL*vmax - CS_FRIC*v)*dtSec);
  }
  var st = F.sv*dtSec, nx = b.baseX + ax*st, ny = b.baseY + ay*st;
  if(Math.abs(st) > 1e-6){
    // (v521, дуэли, замечание владельца 09.11 «2–3 выстрела и оба за стену» — разбор 57 расставаний: 16 — стрейф уводил за край укрытия, врага
    // больше не видно) стрейф — в пределах линии: шаг, после которого врага, видного сейчас, уже не видно, — разворот (как упор в стену)
    // (v571, В140) у края видимости — встречная клавиша: ход гаснет физикой CS2 (как контрстрейф), бот за край не шагает; в стену — стоп сразу
    if(stepBlocked(b.baseX, b.baseY, nx, ny, b)){ F.sv = 0; F.sdir = -F.sdir; F.leg = 0; }
    else if(b._sawEnemy && hasLOS(b.baseX, b.baseY, e.x, e.y, b.z, e.z) && !hasLOS(nx, ny, e.x, e.y, b.z, e.z)){
      var sg = F.sv < 0 ? -1 : 1, dE = csDecel(Math.abs(F.sv), vmax)*dtSec; F.sdir = -sg; F.leg = 0; F.sv = Math.abs(F.sv) <= dE ? 0 : F.sv - sg*dE; }
    else { b.baseX = nx; b.baseY = ny; }
  }
  b.curSpeed = Math.abs(F.sv); b.walking = false;
}
function fightRand(b, salt){ return hashRand(tick*31 + b.id.charCodeAt(0)*17 + b.id.charCodeAt(b.id.length-1)*7 + salt); }
// (дуэли, ответ нейросети владельца 05.11 — docs/tasks/OWNER_PERF_DUELS_2026-11-05.md; замечание владельца Д1: «увидели — сразу за стенку
// и стоят») пик за инфой и дуэль — разные: таймер про (PEEK_PRO dur — окно между первым и последним выстрелом у про, пауза, доля повторного
// пика) — для пика; в дуэли бот остаётся на линии, пока это выгодно, и уходит, когда стало невыгодно. Выгодно: враг этой перестрелки виден
// и жив, бот в обмене не позади (получил от всех с начала перестрелки не больше, чем нанёс ему), второй видимый враг — только если свой рядом
// может его открыть (размен), бот не перезаряжается. Чисел нет: «впереди» — сравнение урона, а не порог HP (в ответе чисел нет)
function duelHits(L, t0, id){ var s = 0; (L || []).forEach(function(h){ if(h[0] >= t0 && (id == null || h[1] === id)) s += h[2]; }); return s; }
// (v518b, пак 09.11 п.5) задача требует давить, а не дуэль «по таблице»: числа перестрелки про (PEEK_PRO) — про одиночную дуэль; а когда сбивают
// дефуз / не успевают дефузнуть (taskSlackSec, 110 — бомба) или T идёт выходом к своей точке на сайте — стоять за укрытием нельзя. Владелец:
// А-39 «трое T просто стоят … не дают даже дефуз сбить», А-5 «никто не протягивает раш». Тогда: на линии — пока не проигрывает обмен
// заметно (FIGHT_PUSH_LOSE HP), укрытие — вперёд по задаче, выглядывает снова всегда
var FIGHT_PUSH_SLACK = 8, FIGHT_PUSH_LOSE = 30;   // с, HP — проектные числа
function fightPush(b){
  if(bomb && bomb.state === "planted") return taskSlackSec(b) < FIGHT_PUSH_SLACK;
  var tt = teamTac.T;
  return b.team === "T" && b.tRole !== "lurker" && !!tt && tt.phase === "execute" && !!b.post && Math.hypot(b.post.x-b.baseX, b.post.y-b.baseY) > 120 && tt.site && SITES[tt.site] && Math.hypot(b.post.x-SITES[tt.site].x, b.post.y-SITES[tt.site].y) < 600;
}
// (v520, отметка владельца 09.11 м200 р3 и ответ владельца: «увидели друг друга — 2–3 выстрела и оба синхронно за стену, вместо того чтобы
// стреляться; уйти — по ситуации: в упор шансов уйти мало, вдалеке с малым HP — уходит; не выходить с малым числом патронов и не перезаряжаться
// в дуэли; двое — по ситуации; задача (сбить дефуз) — быть всегда») уход с линии решала не картина боя, а таймер «длительность пика про» (≈ 1 с)
// и «выгодно ли» в одном тике; повторный выход — жребий 26 %. Теперь одна оценка размена из того, что знает игрок: сколько мне стрелять до фрага
// (урон оружия на дистанции, броня, разброс и прицел, HP врага = 100 − сколько я ему нанёс), сколько им до моего (кто меня видит — их урон
// складывается, их прицел — как мой: чужого умения игрок не знает), сколько мне идти до укрытия, хватит ли патронов
function duelTTK(sh, tg, d, hp, armored, skill){
  var w = sh.weapon; if(!w || !w.dmg || !w.rpm) return {t: Infinity, shots: 0};
  var dmg = w.dmg * Math.pow(w.rm || 1, d*PX_UNITS/500) * (armored ? (w.armorPen || 1) : 1);
  var S = {x: sh.x, y: sh.y, px: sh.px, py: sh.py, skill: skill, weapon: w, crouching: sh.crouching};
  // попадание и в голову — та же модель, что у выстрела (tryShoot: тело BODY_HALF, голова HEAD_HALF; в голову — урон ×4, как в CS2)
  var dd = Math.max(8, d), a = aimSigma(S, tg, d), s2 = Math.pow(shotSpread(S, 0), 2) + a*a, pIn = function(h){ var A = Math.atan(h/dd); return 1 - Math.exp(-(A*A)/(2*s2)); };
  var pAny = Math.max(0.02, pIn(BODY_HALF)), pHead = Math.min(pAny, pIn(HEAD_HALF)), perShot = (pAny - pHead)*dmg + pHead*dmg*4;
  var shots = Math.ceil(Math.max(1, hp)/Math.max(0.5, perShot));
  return {t: shots*60/w.rpm, shots: shots};
}
var DUEL_LOSE_K = 0.6;
// (v524, ответ владельца 10.11: «с полным HP не уходит оттого, что у врага оружие сильнее; уходит, когда реально проигрывает — получил много
// урона»; «уходят, когда магазин пуст»; выжимка: решает реальное преимущество — HP обоих, нанесённый урон, свои рядом, несколько врагов, путь
// отхода, — а не класс оружия) одна оценка из того, что знает игрок. Баланс размена = (сколько нашей стороне до фрага врага) против (сколько
// их стороне до моего): мой огонь + огонь своих, кто этого врага видит (радар); огонь каждого видимого мне врага, делённый на тех наших, по
// кому он может стрелять (я + свои, кто его видит). «Проигрываю» — баланс заметно хуже (< DUEL_LOSE_K, проектное число), чем в таком же бою
// 1 на 1 при полном HP у обоих (r0): само оружие и дистанция в r0 уже учтены, поэтому оружие сильнее — не причина; причина — потерянное HP,
// второй враг без своего на размен. Патроны: стрелять нечем (магазин пуст / перезарядка) — причина уйти; «мало» — нет
function duelBalance(b, e, d, eHp, vis){
  var sk = b.skill || 1, mine = duelTTK(b, e, d, eHp, true, sk), mine0 = duelTTK(b, e, d, 100, true, sk), theirs0 = duelTTK(e, b, d, 100, !!b.armor, sk);
  var mates = bots.filter(function(m){ return m !== b && m.alive && m.team === b.team; });
  var sees = function(o){ return mates.filter(function(m){ return (m._visible || []).indexOf(o) >= 0; }); };
  var myRate = mine.t < Infinity ? 1/mine.t : 0;
  sees(e).forEach(function(m){ var r = duelTTK(m, e, Math.hypot(e.x-m.x, e.y-m.y), eHp, true, sk); if(r.t < Infinity) myRate += 1/r.t; });
  var rate = 0;
  vis.forEach(function(o){ var r = duelTTK(o, b, Math.hypot(o.x-b.x, o.y-b.y), b.hp, !!b.armor, sk); if(r.t < Infinity) rate += (1/r.t)/(1 + sees(o).length); });
  var theirs = rate > 0 ? 1/rate : Infinity, mineT = myRate > 0 ? 1/myRate : Infinity;
  var r0 = mine0.t < Infinity ? theirs0.t/mine0.t : 0;
  return {mine: mine, mineT: mineT, theirs: theirs, r0: r0, lose: !(mineT < Infinity) || theirs < mineT*r0*DUEL_LOSE_K};
}
// выглянуть / выйти снова на врага e в точке (x, y): та же оценка (то, что знает игрок: нанесённый урон, своё HP, оружие врага, дистанция) —
// для повторного пика в бою (fightCycleTick) и для выхода после боя (contactTick). ammoOk — хватает ли патронов на этого врага (мало и есть
// время — перезарядится за укрытием до выхода; времени нет — выходит с остатком)
function duelOdds(b, e, x, y){
  if(!e || !e.alive) return null;
  var d = Math.hypot(x-b.x, y-b.y), P = {x:x, y:y, px:x, py:y, weapon:e.weapon, crouching:e.crouching, alive:true};
  var B = duelBalance(b, P, d, Math.max(1, 100 - duelHits(b._hitOut, roundStartTick, e.id)), [P]);
  var need = Math.min(B.mine.shots, (b.weapon && b.weapon.mag) || B.mine.shots);
  return {mine: B.mine, theirs: B.theirs, ammoOk: !b._reloading && b.ammo >= need, ok: !b._reloading && b.ammo > 0 && !B.lose};
}
function duelEval(b, F, cover){
  var e = F.e; if(!e || !e.alive) return null;
  var vis = (b._visible || []).filter(function(o){ return o.alive && o.team !== b.team; }), seesE = vis.indexOf(e) >= 0;
  var eHp = Math.max(1, 100 - duelHits(b._hitOut, roundStartTick, e.id));
  var B = duelBalance(b, e, Math.hypot(e.x-b.x, e.y-b.y), eHp, vis.length ? vis : [e]);
  var canShoot = !b._reloading && b.ammo > 0;
  var ret = cover ? Math.hypot(cover.x-b.baseX, cover.y-b.baseY)/(SPEED*weaponSpeedMul(b)) : Infinity;
  return {sees: seesE, mine: B.mineT, theirs: B.theirs, ret: ret, ammoOk: canShoot, win: canShoot && !B.lose, trapped: ret >= B.theirs, bal: B.r0 > 0 && B.mineT < Infinity ? (B.theirs/B.mineT)/B.r0 : 0};
}
// (v523) причина последнего решения перестрелки — только запись (подпись на экране, запись матча rec2): почему ушёл с линии / остался / бой кончился
function fcWhy(b, why){ b._fcWhy = why; b._fcWhyT = tick; }
// (v525) перестрелку снаружи (не из fightCycleTick) снимает только эта функция — с причиной
function fcEnd(b, why){ b._fc = null; fcWhy(b, why); }
// каждый тик движения: фазы line (на линии) → off (за укрытием) → back (выглядывает снова) → line …
function fightCycleTick(b, dtSec, busy){
  var F = b._fc, D = PEEK_PRO[b.team];
  if(busy || !b.alive){ b._fc = null; return; }
  // (М149, владелец 20.10) по боту стреляют в плечо, торчащее из-за укрытия, а он стрелка целиком не видит: через время реакции
  // (профиль игрока) — сразу за укрытие, где не видно ничего; выглянет снова (как у про — repeek) — с места, откуда видно врага целиком
  var SS = b._shoulderShot, ssNew = SS && SS.by.alive && tick - SS.t < TICK_HZ && tick - SS.t >= (b.reactionTicks || 0) && (!F || F.ss !== SS.t);
  // (v520) стрелка видно хоть краем (голова, тело, плечо) — отвечать есть по чему: обычная дуэль с оценкой размена; за укрытие — только когда его не видно
  // совсем (было: видно плечо — уходил; оба выглядывали краем — уходили оба)
  if(ssNew){ var mp = visParts(b.x, b.y, b.crouching, SS.by.x, SS.by.y, SS.by.crouching, true, b.z, SS.by.z); if(mp.head || mp.body || mp.side) ssNew = false; }
  if(!F){
    if((!b._sawEnemy && !ssNew) || (b.state !== "engage" && b.state !== "hold")) return;
    F = b._fc = {ph:"line", ax:b.baseX, ay:b.baseY, t:tick, t0:tick, until:0, seen:tick};
  }
  if(b._sawEnemy){ F.seen = tick; F.e = b._nearestEnemyBot; }
  // (v435, М168, скрин владельца 26.10: после фрага «бой · на линии · не видит врага») противник этой перестрелки убит (киллфид), другого
  // не видит и по нему не стреляют — перестрелка кончилась сейчас. Раньше «на линии» держалось до паузы про (до 2,7 с) / конца стрельбы
  // и только тогда проверялось, жив ли враг
  if(F.e && !F.e.alive && !b._sawEnemy && !ssNew){ b._fc = null; fcWhy(b, "конец: враг убит"); return; }
  F.moving = false;
  if(ssNew && F.sh && !F.sh.done){ F.sh.done = true; ssNew = false; F.ss = SS.t; }   // показывал плечо — AWP выстрелил: выглядывает, пока он перезаряжается
  if(ssNew && F.ph !== "off"){
    F.ss = SS.t; F.e = SS.by;
    var cs = fightCover(b, SS.by, peekQ(D.shift, fightRand(b, 5))) || fightCover(b, SS.by, D.shift[4]);
    // (v520) уйти успеваю — ухожу; до укрытия дольше, чем меня убьют, — остаюсь (в упор уйти нельзя)
    var DVs = cs ? duelEval(b, {e: SS.by}, cs) : null; if(DVs && DVs.trapped && b.ammo > 0 && !b._reloading) cs = null;
    if(cs){
      F.ph = "off"; F.mv = 0; F.retreat = true; F.own = false; F.cx = cs.x; F.cy = cs.y; F.ax = b.baseX; F.ay = b.baseY; F.seen = tick;
      F.until = tick + Math.round(peekQ(D.pause, fightRand(b, 6))*TICK_HZ);
      F.better = fightBetter(b, SS.by, cs.x, cs.y, D.shift[4]); fcWhy(b, "ушёл: стреляют в плечо, стрелка не видно");
      if(!b._fcS || tick - b._fcS > 4*TICK_HZ){ b._fcS = tick; logEvent(b.id+": стреляют в плечо из-за укрытия — ухожу за укрытие"); }
    }
  }
  if(F.ph === "line"){
    fightStrafe(b, F, dtSec);
    // (v568, отметка владельца м3 р1 47 с, CT1: «уходит в укрытие и стоит очень долго») враг пропал дольше обычной паузы про между выглядываниями
    // (медиана D.pause[2]: CT 1,62 с, T 1,67 с) — перестрелка кончилась, дальше задача. Было — верхний край (D.pause[4], 2,6–2,7 с): стоял на линии
    if(!b._sawEnemy && tick - F.seen > D.pause[2]*TICK_HZ){ b._fc = null; fcWhy(b, "конец: врага не видно дольше паузы"); return; }   // враг пропал — перестрелка кончилась
    if(!F.until && b.lastShotTick >= F.t) F.until = b.lastShotTick + Math.max(b.reactionTicks || 1, 8);   // (v520) первая оценка размена — через время реакции после первого выстрела (было: таймер «длительность пика про» ≈ 1 с)
    if(F.until && tick >= F.until){
      var e = F.e;
      if(!e){ b._fc = null; return; }
      var push = fightPush(b), tw = push && b.post ? {x:b.post.x, y:b.post.y} : null;
      // (v530, отметка владельца 10.11 «игра снова лагает»: поиск укрытия — 21 мс, а считался при каждой оценке размена — 68 раз за 10 с) укрытие
      // ищется, только когда оно нужно: размен не мой или стрелять нечем. Решение то же (на «вижу врага / размен мой» укрытие не влияло)
      // (v570, отметка владельца м1 р3 28,7 с: «T3 не может попасть в 8 — почему не сменит позицию, а бегает и стреляет, сливая патроны») с
      // верхнего яруса из глубины CT внизу виден впритык: оценка «вижу, размен мой» оставляла на линии, а 35 из 40 пуль уходили в край уступа.
      // Пули в укрытие видны (попадания в стену) — большая их часть в этом отрезке перестрелки: шаг на место рядом, откуда враг виден целиком
      var cvL = b._covLog || [], cvT = b._covT || [], cvN = 0, cvC = 0;
      for(var ci = 0; ci < cvL.length; ci++) if(cvT[ci] >= F.t){ cvN++; cvC += cvL[ci]; }
      if(cvN >= FIGHT_COV.n && cvC >= FIGHT_COV.share*cvN && !b._reloading){
        var cl = fightClearSpot(b, e, Math.max(D.shift[4], FIGHT_COV.r));
        if(cl){ F.ph = "back"; F.mv = 0; F.ax = cl.x; F.ay = cl.y; F.cx = b.baseX; F.cy = b.baseY; b._covLog = []; b._covT = []; fcWhy(b, "меняю угол: пули уходят в укрытие");
          if(!b._fcCv || tick - b._fcCv > 4*TICK_HZ){ b._fcCv = tick; logEvent(b.id+": пули уходят в край — шаг туда, откуда видно целиком"); }
          return; } }
      var c0 = null, DV = duelEval(b, F, null);
      if(DV && DV.sees && !DV.win){ c0 = fightCover(b, e, peekQ(D.shift, fightRand(b, 2)), tw) || fightCover(b, e, D.shift[4], tw); DV = duelEval(b, F, c0); }
      // размен выигрываю (или до укрытия дольше, чем меня убьют — уйти не успею) — стреляю дальше; следующая оценка — через время реакции
      if(DV && !DV.sees){ F.until = tick + 4; return; }   // врага не видно — стрелять не в кого: держит угол на линии (где появится), не отходит; бой кончится по «враг пропал» выше
      if(DV && DV.sees && (DV.win || (DV.trapped && !b._reloading && b.ammo > 0))){ F.until = tick + Math.max(b.reactionTicks || 1, 8); fcWhy(b, DV.win ? "остался: размен мой" : "остался: уйти не успею");
        if(!b._fcD || tick - b._fcD > 4*TICK_HZ){ b._fcD = tick; logEvent(b.id+": "+(DV.win ? "размен мой" : "уйти не успею")+" (мне до фрага "+DV.mine.toFixed(2)+" с, им "+DV.theirs.toFixed(2)+" с, до укрытия "+(DV.ret < 99 ? DV.ret.toFixed(2) : "—")+" с) — стреляю дальше"); }
        return; }
      if(push && duelHits(b._hitIn, F.t0, null) - duelHits(b._hitOut, F.t0, e.id) < FIGHT_PUSH_LOSE && !b._reloading && b.ammo > 0){
        F.until = tick + Math.max(b.reactionTicks || 1, Math.round(peekQ(D.dur, fightRand(b, 9))*TICK_HZ)); fcWhy(b, "остался: давлю по задаче");
        if(!b._fcP || tick - b._fcP > 4*TICK_HZ){ b._fcP = tick; logEvent(b.id+": давлю по задаче — остаюсь на линии"); }
        return; }
      var c = c0 || fightCover(b, e, peekQ(D.shift, fightRand(b, 2)), tw) || fightCover(b, e, D.shift[4], tw);
      if(!c){ F.until = 0; F.t = tick; fcWhy(b, "остался: укрыться негде"); return; }   // укрыться негде — остаётся на линии
      F.ph = "off"; F.mv = 0; F.cx = c.x; F.cy = c.y; F.ax = b.baseX; F.ay = b.baseY; F.own = false;
      F.until = tick + Math.round(peekQ(D.pause, fightRand(b, 3))*TICK_HZ);
      fcWhy(b, "ушёл: " + (!DV ? "нет оценки" : !DV.ammoOk ? (b._reloading ? "перезаряжаюсь" : "магазин пуст") : "проигрываю размен (баланс " + DV.bal.toFixed(2) + " от равного; нам " + (DV.mine < 99 ? DV.mine.toFixed(1) : "—") + " с, им " + (DV.theirs < 99 ? DV.theirs.toFixed(1) : "—") + " с)"));
      if(!b._fcV || tick - b._fcV > 4*TICK_HZ){ b._fcV = tick; logEvent(b.id+": размен не мой"+(DV ? " (мне до фрага "+(DV.mine < 99 ? DV.mine.toFixed(2) : "—")+" с, им "+DV.theirs.toFixed(2)+" с"+(DV.ammoOk ? "" : ", стрелять нечем")+")" : "")+" — ушёл с линии за укрытие"); }
    }
    return;
  }
  // (v415, Б5к шаг 3, М154) снова вижу врага — на линию. Раньше и в фазе «off» сразу: решив уйти, бот на следующем тике ещё видел врага
  // (шага не сделал) — уход отменялся (подпись v414 на м3: 160 снимков за 45 с). Теперь уход доходит до укрытия; на линию — только если
  // и у укрытия враг виден (укрытие не спасает). Уходя от выстрелов в плечо (retreat) — как раньше, не останавливается
  var atCover = F.ph === "off" && Math.hypot(F.cx-b.baseX, F.cy-b.baseY) < 2;
  if(b._sawEnemy && !(F.ph === "off" && (F.retreat || !atCover))){ if(F.ph === "off") b._fcSnap = tick;   // у укрытия видно врага — для подписи «почему»
    F.ph = "line"; F.ax = b.baseX; F.ay = b.baseY; F.t = tick; F.until = 0; F.retreat = false; F.better = null; F.sv = undefined; return; }   // снова вижу врага — на линии (уходя от выстрелов в плечо — не останавливается)
  if(F.ph === "off" && tick >= F.until && (!F.retreat || Math.hypot(F.cx-b.baseX, F.cy-b.baseY) < 2)){
    F.retreat = false;
    // раненого мной врага (в обмене впереди) — выглядывает добить (ответ нейросети: пик становится дуэлью, если «можно добить раненого»);
    // иначе — доля повторного пика про
    var fin = F.e && F.e.alive && duelHits(b._hitOut, F.t0, F.e.id) > duelHits(b._hitIn, F.t0, null);
    // (v520) выглянуть снова — по той же оценке (с места, где враг был виден): размен мой, добить раненого или задача; патронов на врага мало —
    // сначала перезарядка за укрытием (ждёт, не выходит); проигрываю — не выглядывает, перестрелка для него закончена (жребия 26 % больше нет)
    var DO = F.e ? duelOdds(b, F.e, F.e.x, F.e.y) : null;
    // патронов на врага мало — перезаряжается здесь, за укрытием (сам начинает: тактическая перезарядка ниже 35 % магазина могла не включиться —
    // отметка владельца 10.11: karrigan 10/12 ждал перезарядку 4 с и стоял), пока идёт — ждёт
    if(DO && !DO.ammoOk && !b._sawEnemy && !b._reloading && b.weapon && b.ammo < b.weapon.mag && (b.ammo <= 0 || !fightPush(b))){ b._reloading = true; b.reloadUntil = tick + Math.round(b.weapon.reload*TICK_HZ); if(BAL.soundMore) reloadHeard(b, b.weapon); }
    // (v560, В85, разбор владельца 11.11: «пострелялся, остался на месте» — выглянул «добить раненого», когда шла перезарядка, и погиб)
    // перезарядка идёт — ждёт за укрытием всегда (патронов «хватает» по счёту, а стрелять ими нельзя, пока не перезарядился)
    if(b._reloading){ F.until = Math.max(F.until, b.reloadUntil); fcWhy(b, "за укрытием: перезаряжаюсь"); return; }
    if(!fin && !fightPush(b) && !(DO && DO.ok)){ b._fc = null; fcWhy(b, "конец: не выглядываю — " + (!DO ? "врага нет" : "проигрываю размен")); return; }   // не выглядывает снова — перестрелка закончена ((v518b) давить по задаче — выглядывает всегда)
    F.ph = "back"; F.mv = 0; F.nPeek = (F.nPeek || 0) + 1; F.sh = null; fcWhy(b, "выглядываю: " + (fin ? "добить раненого" : (DO && DO.ok) ? "размен мой" : "задача"));
    if(F.better){ F.ax = F.better.x; F.ay = F.better.y; F.better = null; }   // (М149) выглядывает с места, откуда видно врага целиком
    // (ответ 4) второй и дальше пик в этой перестрелке — с другого места (не ближе медианы сдвига про D.shift[2] к прошлому): не однообразный джигл
    // (v521, владелец 10.11: «чередовать, чтобы врагу было тяжелее попасть: можно 2 раза пикнуть с одного места, на третий уйти, можно сразу на
    // второй, можно вообще не пикать — нет конкретного правила») противник видел меня в этой точке и ждёт там же: чем больше раз видел (F.samePk),
    // тем вероятнее выход с другого места (не ближе медианы сдвига про к прошлому) — доля 1 − 0,5^раз (проектное число); выходить ли вообще — оценка
    // размена выше (duelOdds)
    else if(F.nPeek >= 1 && F.e && fightRand(b, 11) >= Math.pow(0.5, F.samePk || 1)){ var nb = fightBetterAway(b, F.e, F.cx, F.cy, D.shift[4], F.ax, F.ay, D.shift[2]); if(nb){ F.ax = nb.x; F.ay = nb.y; F.samePk = 0; } }
    F.samePk = (F.samePk || 0) + 1;
    // (ответ 4) против AWP (оружие врага видно) — сначала плечо: выстрелил — выглядывает целиком, пока он перезаряжается; нет — через паузу про
    if(F.e && F.e.primary === "AWP"){ var shp = fightShoulderPt(b, F.e, F.cx, F.cy, F.ax, F.ay); if(shp) F.sh = {x:shp.x, y:shp.y, t0:0, shot:F.e.lastShotTick || -1, done:false}; }
  }
  var shOn = F.ph === "back" && F.sh && !F.sh.done;
  if(shOn && F.e && (F.e.lastShotTick || -1) > F.sh.shot){ F.sh.done = true; shOn = false; }   // AWP выстрелил (слышно) — выглядывает целиком
  var tx = F.ph === "off" ? F.cx : shOn ? F.sh.x : F.ax, ty = F.ph === "off" ? F.cy : shOn ? F.sh.y : F.ay;
  var d = Math.hypot(tx-b.baseX, ty-b.baseY);
  if(d < 2 && shOn){ if(!F.sh.t0) F.sh.t0 = tick; if(tick - F.sh.t0 >= peekQ(D.pause, fightRand(b, 7))*TICK_HZ) F.sh.done = true; return; }   // плечо показано — ждёт выстрела до паузы про
  if(d < 2){ F.mv = 0; if(F.ph === "back"){ F.ph = "line"; F.t = tick; F.until = 0; F.sv = undefined; } return; }
  // (v524, владелец 10.11: «резко уходят влево-вправо и встают») за укрытие и обратно — той же физикой, что стрейф на линии (разгон CS_ACCEL,
  // трение CS_FRIC, остановка csDecel): с места набирает скорость, перед точкой гасит её; не медленнее CS_STOP, пока не дошёл
  var vmax = SPEED*weaponSpeedMul(b), mv = F.mv || 0;
  if(d <= mv*mv/(2*csDecel(mv, vmax)) + 1) mv = Math.max(CS_STOP/PX_UNITS, mv - csDecel(mv, vmax)*dtSec);
  else mv = Math.min(vmax, mv + Math.max(0, CS_ACCEL*vmax - CS_FRIC*mv)*dtSec);
  F.mv = mv;
  var stp = Math.min(d, mv*dtSec), nx = b.baseX + (tx-b.baseX)/d*stp, ny = b.baseY + (ty-b.baseY)/d*stp;
  if(stepBlocked(b.baseX, b.baseY, nx, ny, b)){ b._fc = null; fcWhy(b, "конец: упёрся по пути к укрытию"); return; }
  b.baseX = nx; b.baseY = ny; F.moving = true; b.crouching = false; b.walking = false;
}
// ---- (3) безопасная ротация: путь мимо известных T ----
// опасность пути: рядом (≤380px) со свежей (≤10с) позицией живого T или через
// зону, где T по карте вероятностей почти наверняка есть
function pathDanger(team, pts){
  var BL = beliefLast[team] || {}, foes = [];
  for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick > 10*TICK_HZ) continue; var e = bots.filter(function(o){ return o.id === eid; })[0]; if(e && e.alive) foes.push(lo); }
  for(var i = 0; i < pts.length; i++){
    var q = pts[i];
    for(var f = 0; f < foes.length; f++) if(Math.hypot(q[0]-foes[f].x, q[1]-foes[f].y) < 380) return true;
    if(i % 2 === 0 && BZ.ids.length){ var zi = bzOf(q[0], q[1]); if(zi >= 0 && beliefZoneKnown(team, zi) >= 0.6) return true; }
  }
  return false;
}
function densify(pts, step){ var out = []; for(var i = 1; i < pts.length; i++){ var a = pts[i-1], b = pts[i], L = Math.hypot(b[0]-a[0], b[1]-a[1]), n = Math.max(1, Math.ceil(L/step)); for(var k = 0; k < n; k++) out.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]); } if(pts.length) out.push(pts[pts.length-1]); return out; }
function safeRotate(b, dest, site){
  if(!BAL.safeRot) return;
  var key = "saferot"+site+roundNum;
  if(b._safeRotK === key) return; b._safeRotK = key;
  if(Math.hypot(b.x-CT_SPAWN.x, b.y-CT_SPAWN.y) < 250) return;
  // у самого сайта T и так ждут (туда и идём) — опасность считаем только на
  // дороге ДО последних ~5м, где выбор маршрута ещё есть
  var far = function(pts){ return densify(pts, 60).filter(function(q){ return Math.hypot(q[0]-dest.x, q[1]-dest.y) > 500; }); };
  var direct = pathPts(b.x, b.y, dest.x, dest.y, b.z);
  if(!pathDanger("CT", far(direct))) return;
  var v1 = pathPts(b.x, b.y, CT_SPAWN.x, CT_SPAWN.y, b.z), v2 = pathPts(CT_SPAWN.x, CT_SPAWN.y, dest.x, dest.y);
  var Ld = polyLen(direct), Lv = polyLen(v1) + polyLen(v2);
  if(Lv > Ld*1.7 + 150) { logEvent(b.id+": путь на "+site+" опасный, но крюк слишком длинный — иду напрямую, тихо"); return; }
  if(pathDanger("CT", far(v1.concat(v2.slice(1))))) { logEvent(b.id+": к "+site+" оба пути опасные — иду напрямую, тихо"); return; }
  var csz = ZONEMAP.zones.filter(function(z){ return z.name === "CTspawn"; })[0];   // зона с ролью «спавн CT»
  startRoute(b, csz ? [zoneUserName(csz.id)] : [], key);
  voiceLog("CT", "saferot"+b.id, b.id, "на "+site+" иду через спавн — там, где короче, их видели");
}
// ---- (4) ниндзя-дефуз ----
// все живые T засвечены недавно (≤8с) и все далеко от бомбы (>700px) — не
// ждём сбора и не кидаем гранат: дефузер идёт сразу, последние метры шифтом
function ninjaOk(){
  var ts = bots.filter(function(o){ return o.team === "T" && o.alive; }); if(!ts.length) return false;
  var BL = beliefLast.CT || {};
  return ts.every(function(t){ var lo = BL[t.id]; return lo && tick - lo.tick < 8*TICK_HZ && Math.hypot(lo.x-bomb.x, lo.y-bomb.y) > 700; });
}
// ---- (7) перезарядка за укрытием ----
function exposedTo(b, maxD, maxAge, anyLos){
  // только реальная угроза выглянуть сейчас: свежая (≤4с) инфа и близко (≤600) —
  // иначе бот уходил с угла на каждую перезарядку и сайт оставался пустым
  maxD = maxD || 600; maxAge = maxAge || 4*TICK_HZ;
  var BL = beliefLast[b.team] || {}, out = [];
  for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick > maxAge) continue; var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive) continue;
    if(Math.hypot(lo.x-b.x, lo.y-b.y) < maxD && (anyLos || hasLOS(b.x, b.y, lo.x, lo.y, b.z))) out.push({x:lo.x, y:lo.y}); }
  // (п.5 владельца 29.10, м1 р2 т12112: zont1x с 16 HP перезаряжался на виду — метку стрелка lkpTick стёр в тот же тик) по нему самому
  // попали — откуда, он знает сам (урон + звук выстрела, heardSound «hit»): это тоже «на виду»
  var hs = b.heardSound;
  if(hs && hs.kind === "hit" && hs.team && hs.team !== b.team && tick - hs.tick <= maxAge && Math.hypot(hs.x-b.x, hs.y-b.y) < maxD &&
     !out.some(function(q){ return Math.hypot(q.x-hs.x, q.y-hs.y) < 60; })) out.push({x:hs.x, y:hs.y});
  return out;
}
var RL_THREAT_W = 0.2;   // (v555) проектное число: вход, где команда ждёт врага с таким весом, — укрытие на перезарядку прячет и от него
function coverForReload(b, from){
  if(b._rlCoverT && tick - b._rlCoverT < 3*TICK_HZ) return true;
  b._rlCoverT = tick;
  // (v555, отметка владельца м298 р1: «ушёл за укрытие — а не открыт ли он с другой позиции, откуда могут убить») прятаться и от входов, где
  // команда ждёт врага (threatEntrances: ожидание зон рядом), а не только от известных: укрытие, открытое туда, — хуже (но не запрещено)
  var thr = threatEntrances(b.team, {x:b.x, y:b.y}, 300).filter(   // 300 ед., 3 входа — проектные
    function(e){ return e.w >= RL_THREAT_W; }).slice(0, 3).map(function(e){ return e.pt; });
  var sp = pickSpots("rlcov"+tick+b.id, {x:b.x, y:b.y}, 3, {rMin:30, rMax:150, minGap:30, hideFrom:from.concat(thr)})
    .filter(function(q){ return from.every(function(f){ return !hasLOS(q.x, q.y, f.x, f.y); }); })[0];
  if(!sp) return false;
  b._reposUntil = 0;
  setPost(b, sp, from[0], true, "repos:rlcover");
  if(!b.post || b.post.tag !== "repos:rlcover") return false;
  b._reposUntil = tick + 3*TICK_HZ;
  logEvent(b.id+": уходит за укрытие перезарядиться");
  return true;
}
// ---- (8) мало HP — к своим ----
// (v292, И33, владелец 14.10) «мало HP» — один порог на всё: откат/держит проход (lowHpBack), не идёт на дабл-пик (assistPeek)
// и не заходит с фланга (flankAssist, «добить последних»). Число — владельца (раньше 30 в одном месте и 35 в двух других)
var LOW_HP = 25;
var LOWHP_MATE_PATH = 600;   // проектное число: px пути (~1500 юнитов, ~6 с бега) — дальше свой «далеко»
// (v284, владелец 14.10 — без демок, правила общие для любой карты, числа «проектные») одно место «отойти/переставиться»:
//  • мало HP (≤30): не бежать к своим через полкарты, а держать проход к своим/к цели, который никто не держит, — из укрытия,
//    не первым контактом (игрок 3 с 22 HP бежал через Xbox к donk, хотя мог встать в Red Room на проход Alley);
//  • остался один (своих ≤350 px нет), а рядом (≤900 px) за 8 с погиб свой и враг рядом известен — уходит к своим
//    (A main после смертей на миду так и стоял один)
function lowHpBack(b){
  if(!BAL.lowHpBack || b._sawEnemy || b.planting || b.defusing || tick < (b._lowHpNext||0)) return;
  var low = b.hp <= LOW_HP;
  // (v531, владелец 10.11: «тиммейтов убили далеко, а игрок в Jungle, ещё не дошедший и не видевший врага, получил „рядом погиб свой“») «рядом» —
  // по пути, а не по прямой сквозь стены: 900 px по прямой через стену — это другая часть карты. Сначала прямая (путь не короче), потом путь
  var nearPath = function(x, y, R){ return nearP(b.x, b.y, b.z, x, y, null, R); };   // (v532) общее «рядом по пути» (100)
  var lostNear = !low && ((teamIntel[b.team] && teamIntel[b.team].sig) || []).some(function(sg){ return sg.type === "died" && sg.id !== b.id && tick - sg.tick < 8*TICK_HZ && nearPath(sg.x, sg.y, 900); });
  if(!low && !lostNear) return;
  // (v547) было «бомба стоит — не отходит» (ретейк / пост-плант важнее): терпит ли задача фазы отход — отклонение (taskCanTry, 110)
  var defending = b.team === "CT" && b.post && taskProp(b.post.tag, "holdsGround");
  if(bomb && bomb.state === "carried" && bomb.carrier === b) return;
  if(!taskCanTry(b, "repos:lowhp")) return;   // (v378) идёт по задаче не ниже — арбитр места; (v547) задача фазы — отклонением
  b._lowHpNext = tick + TICK_HZ;
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team; });
  if(!mates.length) return; // один — отходить не к кому
  if(mates.some(function(o){ return nearP(o.x, o.y, o.z, b.x, b.y, b.z, 350); })) return; // рядом уже есть свой (v532 — по пути)
  var threat = exposedTo(b).concat([]); var BL = beliefLast[b.team] || {};
  var near = false; for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick < 8*TICK_HZ && nearPath(lo.x, lo.y, 700)){ near = true; threat.push({x:lo.x, y:lo.y}); } }   // (v531) враг рядом — тоже по пути
  if(!near) return;
  // опорник на своём сайте с малым HP сайт не бросает — отходит, только если
  // совсем мало (≤20) и на него идут двое+
  if(defending){ var nNear = 0; for(var eid2 in BL){ var lo2 = BL[eid2]; if(tick - lo2.tick < 6*TICK_HZ && Math.hypot(lo2.x-b.x, lo2.y-b.y) < 700) nNear++; } if(b.hp > 20 || nNear < 2) return; }
  // мало HP — роль: держать проход к своим/к цели, который никто не держит (угроза по знанию — threatEntrances), не первым
  // контактом (точка прохода не ближе 250 px к известным врагам) и не дальше по пути, чем пошёл бы к своим
  if(low && !defending){
    var tt0 = teamTac[b.team], cen = null;
    if(b.team === "T" && tt0 && tt0.site && SITES[tt0.site]) cen = SITES[tt0.site];
    else { var cx = 0, cy = 0; mates.forEach(function(o){ cx += o.x; cy += o.y; }); cen = {x: cx/mates.length, y: cy/mates.length}; }
    var ents = threatEntrances(b.team, cen, 700).filter(function(E){
      if(threat.some(function(t){ return Math.hypot(E.pt.x-t.x, E.pt.y-t.y) < 250; })) return false;
      if(mates.some(function(o){ return o.lookTarget && Math.hypot(o.lookTarget.x-E.pt.x, o.lookTarget.y-E.pt.y) < 220; })) return false;
      var pe = pathPts(b.x, b.y, E.pt.x, E.pt.y, b.z); return pe.length && polyLen(pe) <= 1000; });   // 1000 px — проектное число (как у фланга)
    var E0 = ents[0];
    var spE = E0 ? pickSpots("lowhpE"+tick+b.id, E0.pt, 2, {rMin:120, rMax:280, minGap:40, must:[E0.pt], hideFrom:threat.slice(0, 3)})[0] : null;
    if(spE){
      b._reposUntil = 0; b._probeLock = 0;
      setPost(b, spE, E0.pt, true, "repos:lowhp");
      if(b.post && b.post.tag === "repos:lowhp"){
        if(b.state === "hold") leaveHold(b);
        b._reposUntil = tick + 10*TICK_HZ; b._lowHpNext = tick + 10*TICK_HZ;
        voiceLog(b.team, "lowhp"+b.id, b.id, "у меня "+b.hp+" — держу проход "+calloutName(E0.pt.x, E0.pt.y));
        return;
      }
    }
  }
  if(!low && defending) return;   // остался один на своём сайте — сайт не бросает (решение ретейка/ротации — выше)
  // (Г3, 04.11, разбор отметок п.1 и ответ владельца 1: «смерть тиммейта — не повод бросить задачу, но и стоять на месте нельзя: не выходит
  // один на дуэль, отходит за ближайшее укрытие, сохраняя контроль своего фланга») полный HP, рядом погиб свой — своя задача «рядом погиб
  // свой» (repos:mateDown, подпись не «мало HP»): ближайшее укрытие, скрытое от известных врагов; после неё — снова своя задача (уровень
  // перестановки держится _reposUntil). Раньше — та же задача «мало HP» и «остался один — иду к своим» через пол-карты (сторож: 214 из 242
  // «мало HP» — при полном HP)
  if(!low){
    var spC = pickSpots("matedown"+tick+b.id, {x:b.x, y:b.y}, 1, {rMin:30, rMax:200, minGap:30, hideFrom:threat.slice(0, 3)})[0];
    if(!spC) return;
    b._reposUntil = 0; b._probeLock = 0;
    setPost(b, spC, threat[0], true, "repos:mateDown");
    if(!b.post || b.post.tag !== "repos:mateDown") return;
    if(b.state === "hold") leaveHold(b);
    b._reposUntil = tick + 6*TICK_HZ; b._lowHpNext = tick + 10*TICK_HZ;
    return;
  }
  // (v271) мало HP — к своим, только если свой недалеко по пути (LOWHP_MATE_PATH) и путь не идёт мимо известных
  // врагов; иначе бежать через полкарты к далёкому тиммейту — подставиться. Тогда — укрытие рядом,
  // скрытое от врагов: играть от него и ждать своих (раньше шёл к ближайшему тиммейту на любом расстоянии).
  var m = null, mL = Infinity;
  mates.sort(function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); }).slice(0, 2).forEach(function(o){
    var pts = pathPts(b.x, b.y, o.x, o.y, b.z, o.z); if(!pts.length) return;
    var L = polyLen(pts); if(L > LOWHP_MATE_PATH || L >= mL) return;
    var bad = pts.some(function(q, k){ return k > 0 && threat.some(function(t){ return Math.hypot(q[0]-t.x, q[1]-t.y) < 250; }); });
    if(!bad){ m = o; mL = L; }
  });
  var sp = m ? (pickSpots("lowhp"+tick+b.id, {x:m.x, y:m.y}, 2, {rMin:40, rMax:180, minGap:40, hideFrom:threat.slice(0, 3)})[0] || {x:m.x, y:m.y})
             : pickSpots("lowhpc"+tick+b.id, {x:b.x, y:b.y}, 1, {rMin:30, rMax:200, minGap:30, hideFrom:threat.slice(0, 3)})[0];
  if(!sp) return;
  b._reposUntil = 0; b._probeLock = 0;
  setPost(b, sp, threat[0], true, "repos:lowhp");
  if(!b.post || b.post.tag !== "repos:lowhp") return;
  if(b.state === "hold") leaveHold(b);
  b._reposUntil = tick + 6*TICK_HZ; b._lowHpNext = tick + 10*TICK_HZ;
  voiceLog(b.team, "lowhp"+b.id, b.id, m ? "у меня "+b.hp+" — отхожу к "+m.id : "у меня "+b.hp+" — свои далеко, играю от укрытия");
}
// ---- шифт по угрозе ----
// Раньше боты бегали всегда, кроме нескольких частных случаев (слышал/видел
// только что, заход на ретейк, проба, лёркер…). Как будто точно знали, что
// впереди никого. Про-игрок шифтует там, где враг уже МОЖЕТ стоять и слушать:
// смотрим на ~260px вперёд по пути — если в этих зонах (или соседних) по карте
// вероятностей кто-то вероятно есть и по таймингу он уже мог туда добежать,
// идём тихо. Бегом — где пусто/враг ещё не успел, и когда надо спешить:
// выход T, время раунда, размен, бомба, ротация на подтверждённый выход.
// (v438) слышимость бега: тот же радиус, что у звука шагов (540: SOUND_RADIUS_RUN × BAL.stepHearMul)
function STEP_HEAR_R(){ return SOUND_RADIUS_RUN * (BAL.stepHearMul || 1); }
function dangerWalk(b){
  if(!b.post || b.state !== "patrol" || !BZ.ids.length) return false;
  var tag = b.post.tag || "";
  if(taskProp(tag, "dangerWalkSkip")) return false;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime), tt = teamTac.T, ct = teamTac.CT;
  if(b.team === "T"){
    if(secLeft < 30 && bomb.state !== "planted") return false;
    if(tt && tt.phase === "execute" && b.tRole !== "lurker" && tick - (tt.execStart != null ? tt.execStart : tick) < 15*TICK_HZ) return false; // выход — быстро
    if(tt && tt.phase === "setup" && b.post){ // шифтом не успеть к выходу — бегом
      var dP = Math.hypot(b.post.x-b.baseX, b.post.y-b.baseY)*1.3;
      if((tt.execTick - tick)/TICK_HZ < dP/(SPEED*WALK_SPEED_FRAC) + 2) return false;
    }
  } else {
    if(bomb.state === "planted") return false; // ретейк — своя логика подхода
    if(/^rotate/.test(tag) && ct && ct.call && (ct.call.bombSeen || ct.call.count >= 2)) return false; // подтверждённый выход — бегом
  }
  if(b._dwTick && tick - b._dwTick < 8) return !!b._dwVal;
  // включился шифт — держим его хотя бы ~1с (иначе на границе порога бот
  // переключался шаг/бег/шаг несколько раз в секунду)
  if(BAL.lookCommit && b._dwVal && tick - (b._dwOnT||0) < 64){ b._dwTick = tick; return true; }
  b._dwTick = tick; var dwPrev = b._dwVal;
  var foe = b.team, pts = [], acc = 0, px = b.baseX, py = b.baseY;
  for(var i = b.pathIdx; i < b.path.length && acc < 260; i++){
    var q = b.path[i], sl = Math.hypot(q[0]-px, q[1]-py); acc += sl; px = q[0]; py = q[1]; pts.push([px, py]);
  }
  if(!pts.length) pts.push([b.post.x, b.post.y]);
  var seenZ = {}, dz = 0;
  // (v443, док владельца 27.10 р9: «игрок 4 шёл на шифте, где его никто бы не слышал — все CT в B Apps и на маркете») непроверенный
  // угол заставлял идти шагом, если враг мог туда добежать хотя бы через 4 с, — а где команда видела врагов, не смотрел. Замер v442:
  // первые 20 с раунда, враг в 600–900, — шагом 50 % у ботов T против 30 % у про, и в 54 % таких моментов причиной был этот угол.
  // Теперь угол — только если враг мог уже быть там (без запаса) и есть живой враг, которого команда не видела / не слышала
  // за 5 с (проектное число, как «свежая» инфа в 540) дальше слышимости моего бега от пути. Все живые засвечены далеко — бегом
  var foeAll = bots.filter(function(o){ return o.alive && o.team !== b.team; }), BLw = beliefLast[b.team] || {};
  var unacc = foeAll.some(function(o){ var e = BLw[o.id]; if(!e || tick - e.tick > 5*TICK_HZ) return true;
    return pts.some(function(q){ return Math.hypot(q[0]-e.x, q[1]-e.y) <= 1.5*STEP_HEAR_R(); }); });
  var uncW = function(j){ var R = REACH[foe]; return (R && !(R[j] <= tick)) ? 0 : uncheckedW(foe, j); };
  pts.forEach(function(q){
    var zi = bzOf(q[0], q[1]); if(zi < 0 || seenZ[zi]) return; seenZ[zi] = 1;
    var own = reachPossible(foe, zi) ? beliefZoneKnown(foe, zi) : 0;
    var nb = 0; (BZ.nbr[zi]||[]).forEach(function(j){ if(reachPossible(foe, j)) nb = Math.max(nb, beliefZoneKnown(foe, j)); });
    dz = Math.max(dz, own + 0.5*nb);
    // (v143) непроверенный угол вплотную к пути, куда враг мог успеть — тихо,
    // чтобы чекнуть его и не спалиться (у про: "иду шифтом, чекаю каждый угол")
    if(unacc){ var uc = uncW(zi); (BZ.nbr[zi]||[]).forEach(function(j){ var c = BZ.cent[j]; if(c && Math.hypot(c.x-q[0], c.y-q[1]) < 320) uc = Math.max(uc, uncW(j)); });
      if(uc >= 0.8) dz = Math.max(dz, LOOK.uncheckWalk); }
  });
  b._dwVal = dz >= (BAL.dangerWalkThr || 0.12);
  if(b._dwVal && !dwPrev) b._dwOnT = tick;
  // "чисто" в одной зоне ≠ безопасно вокруг: карта вероятностей после колла
  // "проверил — пусто" обнуляет зону, и раньше бот сразу срывался на бег и
  // палил позицию. Если враг недавно (≤15с) был засвечен рядом с путём (≤650px)
  // и он жив — идём тихо, пока его не найдут снова
  if(!b._dwVal && BAL.clearQuiet){
    var L = beliefLast[b.team] || {}, BL = beliefLast[b.team] || {};
    outer: for(var eid in BL){
      var lo = BL[eid]; if(!lo || tick - lo.tick > 15*TICK_HZ) continue;
      var foeB = bots.filter(function(o){ return o.id === eid; })[0]; if(!foeB || !foeB.alive) continue;
      for(var pi = 0; pi < pts.length; pi++) if(Math.hypot(pts[pi][0]-lo.x, pts[pi][1]-lo.y) < 650){ b._dwVal = true; b._dwWhy = "near"; if(!dwPrev) b._dwOnT = tick; break outer; }
    }
  }
  return b._dwVal;
}
