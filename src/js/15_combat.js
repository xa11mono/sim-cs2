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
// С1. Режим огня — одно место на ритм стрельбы (сейчас в движке; когда появится
// мозг, выбор «тап / очередь / спрей» — его решение).
// Перед очередью бот прикидывает по своему оружию, сколько пуль подряд ещё лягут
// в корпус на этой дистанции: отдача (часть гасит по навыку), разброс от частой
// стрельбы, разброс стоя / на ходу, своя точность. Далеко — одна (тап), средне —
// короткая очередь, вблизи — спрей; AWP/скаут — выстрел и затвор (темп оружия),
// дигл — тап (большой разброс от частой стрельбы). Внутри очереди — ровно темп
// оружия; после очереди — пауза, пока отдача и разброс не вернутся (w.reset).
// Контрстрейф — здесь же: на бегу винтовкой не стреляет.
function sprayComp(sh){ return 0.55 + 0.35*Math.max(0, Math.min(1, ((sh.skill||1)-0.8)/0.4)); }
// разброс оружия стоя/сидя/на ходу (до ~34% скорости — "шаг", почти без штрафа), рад
function weaponSpread(sh, w){
  var speedFrac = Math.min(1, (sh.curSpeed||0) / SPEED), runK = Math.max(0, (speedFrac - 0.34)/0.66);
  return (w.stand*(sh.crouching ? 0.75 : 1) + w.move*(runK + 0.08*speedFrac)) / 1000;
}
function aimSkillErr(sh){ return 0.0045 + 0.020*Math.max(0, 1.2 - (sh.skill||1)); }   // своя точность наведения, рад
function bulletErr(sh, w, k){   // ожидаемая ошибка k-й пули очереди (рад), без учёта цели
  var wS = weaponSpread(sh, w), aim = aimSkillErr(sh);
  var sp = sprayPat(w, k), res = Math.hypot(sp.x, sp.y) * (1 - Math.min(0.95, sprayComp(sh) + 0.08));
  var spm = (w.spam||0)/1000 * k;
  return Math.sqrt(wS*wS + aim*aim + res*res + spm*spm);
}
// сколько пуль очереди, начиная с k0-й, ещё лягут в корпус на дистанции dist
function burstLen(sh, w, dist, k0){
  var bA = Math.atan(BODY_HALF/Math.max(8, dist)), n = 0, cap = Math.max(1, sh.ammo|0);
  while(n < cap && n < 40 && bulletErr(sh, w, k0 + n) <= bA) n++;
  return k0 === 0 ? Math.max(1, n) : n;   // после паузы первую пулю — всегда (тап)
}
// можно ли выстрелить сейчас по ритму огня (тик и прицел уже проверены)
function fireReady(sh, w, dist){
  // контрстрейф: с винтовкой/AWP на бегу не стреляют — сначала стоп.
  // Исключение: в упор; ПП и пистолеты стреляют на ходу
  if(w.move >= 60 && sh.curSpeed > SPEED*0.4 && dist > 110) return false;
  var F = sh._fire || (sh._fire = {left:0, pause:0});
  if(F.left > 0 && tick - sh.lastShotTick > w.fireIntervalTicks*1.6 + 1){ F.left = 0; F.pause = sh.lastShotTick + w.reset; } // очередь прервалась
  if(F.left > 0) return true;
  if(tick < F.pause) return false;
  sh.burstCount = 0; F.left = burstLen(sh, w, dist, 0);
  return true;
}
function fireShot(sh, w){ var F = sh._fire; if(F && --F.left <= 0){ F.left = 0; F.pause = tick + w.reset; } }
// parts — что у цели видно стрелку ({head, body}, visPair): видна только голова —
// целится только в голову, пули ниже головы попадают в укрытие
function tryShoot(shooter, target, dist, parts){
  if(!shooter.alive || !target.alive) return;
  if(!parts || (!parts.head && !parts.body)) return;   // ничего не видно — не стреляет
  if(shooter.planting || shooter.defusing) return; // руки заняты
  if(tick < shooter.blindUntil || tick < (shooter.throwUntil||0)) return; // ослеплён / бросает гранату
  // Преимущество того, кто стоит на месте и уже смотрит туда,
  // откуда вышел враг — реагирует заметно быстрее того, кто выбегает/бежит
  // и должен сначала развернуть прицел (в реальном CS тот же эффект).
  var effReaction = shooter.reactionTicks;
  if(shooter.contactStreak <= 1){
    var hAim = Math.atan2(target.y-shooter.y, target.x-shooter.x);
    var hD = shooter.facing === undefined ? Math.PI : Math.abs(((hAim - shooter.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
    // раздел 14: реакция. Кто уже целился в эту точку (держит угол ИЛИ заходит
    // с прицелом на типичный угол) — реагирует быстрее; кто смотрел в сторону —
    // медленнее (плюс разворот прицела). И "преимущество пикающего": у того, кто
    // стоит, выглянувший появляется на экране чуть позже (в CS — из-за сети).
    var pre = hD < 0.25 ? (shooter.curSpeed < 45*SPD_K ? BAL.holdReact : BAL.preaimReact) : (hD < 0.6 ? 0.9 : 1.1);
    shooter._reactMul = pre * (shooter.curSpeed > SPEED*0.8 ? BAL.moveReact : 1.0);
    shooter._peekLag = (shooter.curSpeed < 45*SPD_K && target.curSpeed > 60*SPD_K) ? BAL.peekAdv : 0; // преимущество пикающего — только у быстрого выхода; кто режет угол шагом, его не имеет
    // раздел 14: "префайр угла" — кто заходил, уже целясь в типичную точку
    // (прицел почти на цели в момент появления), доводит прицел почти сразу,
    // как и тот, кто держит; разворачиваться на 90° — долго и неточно
    shooter._preAim = hD < 0.25 ? 0.35 : (hD < 0.6 ? 0.65 : 1.0);
    // раздел 14 / про-уровень: "прицел на уровне головы". Насколько точно прицел
    // стоял там, где появился враг: 1 — ровно на угле (враг вышел прямо под
    // прицел), 0 — смотрел в сторону. Плюс по высоте: сильные игроки держат
    // прицел на уровне головы почти всегда, слабые — чаще на уровне тела
    var skN = Math.max(0, Math.min(1, ((shooter.skill||1)-0.8)/0.4));
    shooter._place = Math.max(0, Math.min(1, 1 - hD/0.35));
    shooter._headLvl = 0.55 + 0.4*skN;
  }
  // частичная видимость: неподвижного (особенно сидящего) врага вдали
  // замечают позже — виден кусок модели на фоне угла; бегущего — сразу
  var visLag = 0;
  if(shooter.contactStreak <= 1){
    var tsp = target.curSpeed || 0;
    if(tsp < 20 && dist > 350) visLag = Math.round(Math.min(10, 3 + (dist-350)/80) + (target.crouching ? 3 : 0));
    else if(tsp > 100*SPD_K) visLag = -2;
    shooter._visLag = visLag;
  } else visLag = shooter._visLag || 0;
  effReaction = Math.max(4, Math.round(shooter.reactionTicks * (shooter._reactMul || 1)) + (shooter._peekLag || 0) + (shooter.weapon.scopeTicks || 0) + visLag);
  if(shooter.contactStreak < effReaction) return;
  var w = shooter.weapon;
  if(dist > w.range) return;
  if(tick < shooter.nextShotTick) return;
  // раздел 14: магазин и перезарядка — во время перезарядки не стреляет
  updateReload(shooter);
  if(shooter._reloading || shooter.ammo <= 0) return;
  // угловые размеры цели (px радара ≈ 2.5 юнита CS2): тело ~32u шириной, голова ~11u
  var bA = Math.atan(BODY_HALF/Math.max(8,dist));
  // стреляет только туда, куда смотрит: прицел должен быть почти на цели —
  // вблизи цель большая, можно стрелять сразу; вдали надо довести прицел
  var aimD = 0;
  if(shooter.facing !== undefined){
    var aimA = Math.atan2(target.y-shooter.y, target.x-shooter.x);
    aimD = Math.abs(((aimA - shooter.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
    if(aimD > Math.min(AIM_FIRE_CONE, Math.max(0.05, 2.5*bA))) return;
  }
  if(!fireReady(shooter, w, dist)) return;
  var burstIdx = shooter.burstCount;
  shooter.burstCount++;
  shooter.lastShotTick = tick;
  target._shotAtT = tick; target._shotAtBy = shooter;
  shooter.nextShotTick = tick + w.fireIntervalTicks;
  shooter.ammo--;
  fireShot(shooter, w);

  // ---- раздел 14: попадание — не "шанс N%", а угловая ошибка прицела ----
  // Итоговая ошибка σ (рад) складывается из: разброса оружия (стоя/на бегу,
  // сидя меньше), отдачи в очереди (бот компенсирует часть по навыку),
  // собственной ошибки наведения бота и "доводки" сразу после реакции.
  // Попал ли — сравнение σ с угловым размером головы/тела на этой дистанции:
  // в упор цель огромная и промахнуться почти невозможно, на длинной дистанции
  // в голову попадают редко — как в CS, а не одинаковые 50% на любой дистанции.
  var sk = shooter.skill;
  var wSpread = weaponSpread(shooter, w);
  var comp = sprayComp(shooter);
  var recoilErr = w.recoil/1000 * Math.max(0, burstIdx-1) * (1-comp) * 1.6;
  var spamErr = (w.spam||0)/1000 * burstIdx;   // разброс от частой стрельбы внутри очереди (пауза его сбрасывает)
  var aimErr = aimSkillErr(shooter);
  var settle = Math.max(0, 1 - (shooter.contactStreak - effReaction)/24);
  var flick = 0.018 * settle * Math.min(shooter._preAim||1, (shooter._reactMul||1) < 1 ? 0.35 : 1); // держал угол / заходил с прицелом — уже "на цели"
  // движущуюся цель сложнее вести: ошибка растёт с её угловой скоростью поперёк
  // линии огня. Стоящего убить легко, широкий выход — трудно, джиггл — почти
  // невозможно (за это его и делают: взять инфу, не отдав фраг)
  var tvx = (target.x - target.px)*TICK_HZ, tvy = (target.y - target.py)*TICK_HZ;
  var lx = (target.x - shooter.x)/Math.max(1, dist), ly = (target.y - shooter.y)/Math.max(1, dist);
  var vPerp = Math.abs(tvx*(-ly) + tvy*lx);
  var trackErr = (vPerp/Math.max(40, dist)) * BAL.trackK * (1.25 - 0.4*Math.max(0, Math.min(1, (sk-0.8)/0.4)));
  recoilErr *= 0.3; // (6) отдача — паттерн (ниже), тут только её "шум"
  var sigma = Math.sqrt(wSpread*wSpread + recoilErr*recoilErr + spamErr*spamErr + aimErr*aimErr + flick*flick + 0.5*aimD*aimD + trackErr*trackErr);
  if(shooter.onStairs) sigma *= 2.2;
  if(w.scoped && shooter.curSpeed < 10 && dist > 300) sigma *= 0.8; // AUG/SG в прицеле на дистанции
  var seedS = tick*104729 + shooter.id.charCodeAt(0)*31 + shooter.id.length*7 + target.id.charCodeAt(0)*17 + Math.floor(shooter.nextShotTick*8);
  // сильные игроки чаще целятся в голову; AWP — всегда в корпус
  var pAimHead = 0.25 + 0.45*Math.max(0, Math.min(1, (sk-0.8)/0.4));
  // первые пули на появление: если прицел стоял на угле и на уровне головы —
  // целит в голову куда чаще (ваншот "на выходе"); если доводил прицел — в тело
  if(burstIdx <= 1 && shooter._place != null){
    pAimHead = Math.min(0.92, pAimHead * (0.45 + 0.9*shooter._place) * (0.6 + 0.6*(shooter._headLvl||0.7)));
  }
  pAimHead *= 0.75;
  if(burstIdx >= 3) pAimHead *= 0.35; // спрей — в корпус: отдача сама тянет в голову
  if(w.key === "SSG") pAimHead = Math.max(pAimHead, 0.8); // скаут — в голову (корпус не убивает)
  var aimHead = w.key !== "AWP" && hashRand(seedS+5) < pAimHead;
  if(!parts.body) aimHead = true;        // видна только голова (укрытие по грудь) — только в голову
  else if(!parts.head) aimHead = false;  // голову закрывает (потолок, край) — в тело
  var headshot, hit, hbZone = null;
  {
    // (6) хитбоксы: пуля летит в точку прицела + ошибка по двум осям +
    // паттерн отдачи (вверх, потом влево-вправо), который бот гасит по навыку.
    // Куда попала — голова/грудь/живот/ноги — по реальной высоте модели,
    // а не "случайная зона": спрей в грудь уходит в голову, в голову — выше неё
    var u1 = Math.atan(1/PX_UNITS/Math.max(8, dist));           // рад на 1 юнит на этой дистанции
    var kC = target.crouching ? 0.75 : 1, hH = 64*kC;            // центр головы
    var aimY = aimHead ? hH : 46*kC;
    var sp = sprayPat(w, burstIdx), cmp = Math.min(0.95, comp + 0.08);
    var gu1 = Math.max(1e-9, hashRand(seedS+21)), gu2 = hashRand(seedS+22), gr = Math.sqrt(-2*Math.log(gu1));
    var sgm = sigma * BAL.hbK;
    var ex = gr*Math.cos(2*Math.PI*gu2)*sgm + sp.x*(1-cmp), ey = gr*Math.sin(2*Math.PI*gu2)*sgm + sp.y*(1-cmp);
    var ux = ex/u1, uy = aimY + ey/u1;
    if(Math.hypot(ux, uy-hH) < 5.5) hbZone = "head";
    else if(uy >= hH-20*kC && uy < hH-6*kC && Math.abs(ux) < 15) hbZone = "chest";
    else if(uy >= hH-30*kC && uy < hH-20*kC && Math.abs(ux) < 13) hbZone = "stomach";
    else if(uy >= 0 && uy < hH-30*kC && Math.abs(ux) < 10) hbZone = "legs";
    // пуля в закрытую часть модели — в укрытие (видна только голова — всё ниже головы;
    // не видна голова — голова)
    var coverHit = !!hbZone && ((!parts.body && hbZone !== "head") || (!parts.head && hbZone === "head"));
    if(coverHit) hbZone = null;
    headshot = hbZone === "head"; hit = !!hbZone;
    var bulletDev = ex;   // куда реально ушла пуля по горизонтали (рад) — по ней и трассер
  }
  var endX = target.x, endY = target.y, hitZone = null;
  if(hit){
    var base = w.dmg * Math.pow(w.rm, dist*PX_UNITS/500);
    var mult, armored;
    if(headshot){ mult = 4; armored = target.helmet; hitZone = "head"; }
    else if(hbZone === "legs"){ mult = 0.75; armored = false; hitZone = "legs"; }
    else if(hbZone === "stomach"){ mult = 1.25; armored = target.armor; hitZone = "stomach"; }
    else { mult = 1.0; armored = target.armor; hitZone = "chest"; }
    var dmg = base * mult; if(armored) dmg *= w.armorPen;
    dmg = Math.max(1, Math.round(dmg));
    noteDmg(shooter, target, dmg);
    target.hp -= dmg; target._hurtT = tick;
    target._tagUntil = tick + 16; // попали — на ~0.25с замедлен (как в CS2)
    target._hitFx = {t:nowTs, head:headshot};
    if(target.hp <= 0 && target.alive){
      target.alive = false;
      shooter.kills++; shooter.roundKills++; target.deaths++;
      shooter.money = Math.min(MAX_MONEY, shooter.money + (w.killReward||300));
      // погибший теряет всё, кроме денег
      dropWeaponOnDeath(target);
      target.primary = null; target.secondary = target.team==="CT" ? "USP" : "GLOCK";
      target.armor = false; target.helmet = false; target.kit = false;
      target.planting = false; target.defusing = false;
      target.nades = emptyNades();
      dropBomb(target);
      logEvent(shooter.id+" ["+w.name+"] устранил "+target.id+(headshot?" (в голову)":"")+" (дист. "+Math.round(dist)+", +$"+(w.killReward||300)+")", "kill");
      feedKill(shooter, target, w.key, headshot, {blind:shooter.blindUntil > tick});
    }
  } else {
    // промах: пуля летит туда, куда реально ушла (ошибка прицела + рисунок
    // отдачи по горизонтали), дальше цели до первой стены. Мимо над головой —
    // трассер проходит над целью; спрей — расходится по рисунку отдачи
    var dx = target.x-shooter.x, dy = target.y-shooter.y;
    var ang = Math.atan2(dy,dx);
    var dev = bulletDev;
    var far = Math.min(w.range, Math.hypot(dx,dy)*1.6 + 60);
    var ex = shooter.x + Math.cos(ang+dev)*far, ey = shooter.y + Math.sin(ang+dev)*far;
    var cl = rayClipWalls(shooter.x, shooter.y, ex, ey);
    endX = cl.x; endY = cl.y;
    if(coverHit){ endX = target.x - dx/Math.max(1, Math.hypot(dx, dy))*8; endY = target.y - dy/Math.max(1, Math.hypot(dx, dy))*8; } // в укрытие перед целью
  }
  tracers.push({wc:tracerClass(shooter.weapon), x1:shooter.x, y1:shooter.y, x2:endX, y2:endY, team:shooter.team, born:nowTs, hit:hit, head:headshot, miss:!hit, zone:hitZone});
  // выстрел слышно далеко (шаг 5: с конусом обзора боты не видят спиной —
  // но разворачиваются на звук стрельбы; в кого попали — точно знает откуда)
  // глушитель — слышно ближе; в кого попали — тот понимает, откуда стреляют
  makeSound(shooter, shooter.x, shooter.y, "shots", {mul: w.silenced ? 0.55 : 1, seed: shooter.nextShotTick|0});
  if(target && target.alive && target.team !== shooter.team) makeSound(shooter, shooter.x, shooter.y, "hit", {only: target, seed: 5});
  if(tracers.length > 60) tracers.shift();
}

// ---------- кто кого видит, поворот прицела, выстрел (движок) ----------
// Видит тот, у кого враг в линии взгляда (стены, укрытия, пол и потолки по высоте,
// дым, ван-вей), в конусе обзора (или вплотную, или контакт уже идёт) и кто не
// ослеплён — visPair (10_vision.js); там же — что видно у врага: голова/тело. Видимый враг — цель:
// прицел поворачивается к ней с конечной скоростью (AIM_TURN_RATE), а стреляет
// бот только наведённым (tryShoot). Без врага взгляд — куда велит заглушка
// (posLook в 11_position.js), поворот тот же.
function resolveEngagements(){
  var pairs = [];
  bots.forEach(function(b){ b._sawEnemy = false; b._nearestEnemyDist = Infinity; b._nearestEnemyBot = null; b._visible = []; });
  bots.forEach(function(ct){
    if(ct.team!=="CT"||!ct.alive) return;
    bots.forEach(function(t){
      if(t.team!=="T"||!t.alive) return;
      var dist = Math.hypot(ct.x-t.x, ct.y-t.y);
      var maxRange = Math.max(ct.weapon.range, t.weapon.range);
      if(dist > maxRange) return;
      // кто кого видит и что именно (голова/тело) — одно место, visPair (10_vision.js)
      var vp = visPair(ct, t); if(!vp) return;
      var ctSees = !!vp.ab, tSees = !!vp.ba;
      if(ctSees){ ct._sawEnemy = true; ct._lastSawT = tick; ct._visible.push(t); if(dist < ct._nearestEnemyDist){ ct._nearestEnemyDist = dist; ct._nearestEnemyBot = t; } }
      if(tSees){ t._sawEnemy = true; t._lastSawT = tick; t._visible.push(ct); if(dist < t._nearestEnemyDist){ t._nearestEnemyDist = dist; t._nearestEnemyBot = ct; } }
      pairs.push({ct:ct, t:t, dist:dist, ctSees:ctSees, tSees:tSees, ctParts:vp.ab, tParts:vp.ba});
    });
  });
  // цель держится, пока видна (иначе при двух врагах на похожей дистанции прицел
  // метался бы между ними). Сменить цель посреди очереди: спрей переводится, пока
  // следующие пули ещё лягут в корпус нового врага (режим огня, С1)
  bots.forEach(function(b){
    if(!b.alive || !b._sawEnemy) return;
    var T0 = b._tgt;
    if(T0 && T0.alive && b._visible.indexOf(T0) >= 0){
      var d0 = Math.hypot(T0.x-b.x, T0.y-b.y);
      if(d0 <= b._nearestEnemyDist*1.4 + 20){ b._nearestEnemyBot = T0; b._nearestEnemyDist = d0; return; }
    }
    var NT = b._nearestEnemyBot;
    if(T0 && NT && T0 !== NT && b._fire && b._fire.left > 0 && b.weapon){
      b._fire.left = Math.min(b._fire.left, burstLen(b, b.weapon, Math.hypot(NT.x-b.x, NT.y-b.y), b.burstCount));
      if(!b._fire.left) b._fire.pause = tick + b.weapon.reset;
    }
    b._tgt = NT;
  });
  // реакция: «сколько тиков подряд вижу врага»; короткая потеря контакта
  // почти не сбрасывает её, долгая — сбрасывает полностью
  bots.forEach(function(b){
    if(!b.alive) return;
    if(b._sawEnemy) b.contactStreak++;
    else b.contactStreak = Math.max(0, b.contactStreak - 3);
  });
  // поворот прицела
  var aimStep = AIM_TURN_RATE / TICK_HZ;
  bots.forEach(function(b){
    if(!b.alive) return;
    var seesFoe = b._sawEnemy && b._nearestEnemyBot, look = seesFoe ? b._nearestEnemyBot : posLook(b);
    b.lookReason = seesFoe ? "enemy" : look.why;
    b.lookTarget = look ? {x:look.x, y:look.y} : null;
    if(!look) return;
    var want = Math.atan2(look.y-b.y, look.x-b.x);
    if(b.facing === undefined) b.facing = want;
    var dd = want - b.facing;
    dd = ((dd + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
    b.facing += Math.max(-aimStep, Math.min(aimStep, dd));
  });
  pairs.forEach(function(p){
    if(p.ctSees && p.ct._nearestEnemyBot === p.t) tryShoot(p.ct, p.t, p.dist, p.ctParts);
    if(p.tSees && p.t._nearestEnemyBot === p.ct) tryShoot(p.t, p.ct, p.dist, p.tParts);
  });
}

function escapeWallLine(bot){
  for(var rr=3; rr<=18; rr+=3){
    for(var a=0; a<16; a++){
      var ang = a*Math.PI/8;
      var nx = bot.baseX + Math.cos(ang)*rr, ny = bot.baseY + Math.sin(ang)*rr;
      if(insideSolidWall(nx, ny)) continue;
      // из новой точки должно быть можно куда-то идти
      var free = 0;
      for(var q=0;q<8;q++){ var qa=q*Math.PI/4; if(!crossesWall(nx,ny,nx+Math.cos(qa)*4,ny+Math.sin(qa)*4)) free++; }
      if(free >= 5){ bot.baseX = nx; bot.baseY = ny; bot.x = nx; bot.y = ny; bot.path = []; bot.pathIdx = 0; return true; }
    }
  }
  return false;
}
