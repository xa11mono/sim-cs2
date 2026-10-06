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
// С1. Режим огня — решение бота, как у игрока, одно место на ритм стрельбы.
// Перед очередью бот прикидывает по своему оружию, сколько пуль подряд ещё лягут
// в корпус на этой дистанции: отдача (часть гасит по навыку), разброс от частой
// стрельбы, разброс стоя / на ходу, своя точность. Далеко — одна (тап), средне —
// короткая очередь, вблизи — спрей; AWP/скаут — выстрел и затвор (темп оружия),
// дигл — тап (большой разброс от частой стрельбы). Внутри очереди — ровно темп
// оружия; после очереди — пауза, пока отдача и разброс не вернутся (w.reset).
// Контрстрейф и фаза шага стрейф-дуэли — здесь же: на бегу винтовкой не стреляет.
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
  if(sh._ds && sh._ds.moving) return false;   // фаза шага стрейфа: выстрел — после остановки
  // контрстрейф: с винтовкой/AWP на бегу не стреляют — сначала стоп.
  // Исключения: в упор, отход под огнём; ПП и пистолеты стреляют на ходу
  if(w.move >= 60 && sh.curSpeed > SPEED*0.4 && dist > 110 && sh.state !== "retreat") return false;
  var F = sh._fire || (sh._fire = {left:0, pause:0});
  if(F.left > 0 && tick - sh.lastShotTick > w.fireIntervalTicks*1.6 + 1){ F.left = 0; F.pause = sh.lastShotTick + w.reset; } // очередь прервалась
  if(F.left > 0) return true;
  if(tick < F.pause) return false;
  sh.burstCount = 0; F.left = burstLen(sh, w, dist, 0);
  return true;
}
function fireShot(sh, w){ var F = sh._fire; if(F && --F.left <= 0){ F.left = 0; F.pause = tick + w.reset; } }
function tryShoot(shooter, target, dist){
  if(!shooter.alive || !target.alive) return;
  if(shooter._knife || (shooter._drawUntil && tick < shooter._drawUntil)){ if(shooter._knife){ shooter._knife = false; shooter._drawUntil = tick + Math.round(0.4*TICK_HZ); } return; } // достаёт оружие
  // отступающий стреляет на отходе (раньше не стрелял вообще — его просто
  // расстреливали в спину); бег и так режет ему точность
  if(shooter.planting || shooter.defusing) return; // руки заняты
  if(tick < shooter.blindUntil || tick < (shooter.throwUntil||0)) return; // ослеплён / бросает гранату
  // план §3: "бот, держащий угол, может выстрелить до того как истечёт обычная
  // реакция на новый визуальный контакт, если есть свежая информация 'враг там',
  // и шанс зависит от точности этой информации" — префайр обходит обычный gate
  // на reactionTicks, но только для того же самого угла (lastIntel рядом с целью)
  var prefire = false, prefireConfidence = 0;
  // Преимущество того, кто держит угол: стоит на месте и уже смотрит туда,
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
  if(BAL.partialVis && shooter.contactStreak <= 1){
    var tsp = target.curSpeed || 0;
    if(tsp < 20 && dist > 350) visLag = Math.round(Math.min(10, 3 + (dist-350)/80) + (target.crouching ? 3 : 0));
    else if(tsp > 100*SPD_K) visLag = -2;
    shooter._visLag = visLag;
  } else if(BAL.partialVis) visLag = shooter._visLag || 0;
  effReaction = Math.max(4, Math.round(shooter.reactionTicks * (shooter._reactMul || 1)) + (shooter._peekLag || 0) + ((BAL.awpClose && shooter.weapon.key === "AWP" && dist < 230) ? 0 : (shooter.weapon.scopeTicks || 0)) + (shooter._hes || 0) + visLag);
  if(shooter._smokeShot){ /* прострел смока — без реакции на "появление", он и не появлялся */ }
  else if(shooter.contactStreak < effReaction){
    // префаер — только по тому, что сам только что видел (≤1.4с), а не по коллу/
    // догадке: раньше ~30% выстрелов были префаерами, и ТТК выглядел мгновенным
    var pfWin = 90;
    if(shooter.holding && shooter.lastIntel && (tick - shooter.lastIntel.tick) < pfWin &&
       Math.hypot(target.x-shooter.lastIntel.x, target.y-shooter.lastIntel.y) < PREFIRE_RADIUS &&
       // перевыход после потери: мгновенно — только если видел <0.5с назад,
       // иначе нужна хотя бы половина реакции (прицел "примерно там", а не на голове)
       ((tick - shooter.lastIntel.tick) < 32 || shooter.contactStreak >= Math.round(effReaction*0.5))){
      prefire = true;
      prefireConfidence = 1 - (tick - shooter.lastIntel.tick)/pfWin; // 1 = только что видел, 0 = на грани "забыл"
    } else {
      return;
    }
  }
  var w = shooter.weapon;
  if(dist > w.range) return;
  if(tick < shooter.nextShotTick) return;
  var thruSmoke = !!shooter._smokeShot;
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
  var trackErr = BAL.duelTrack ? (vPerp/Math.max(40, dist)) * (BAL.trackK||0.035) * (1.25 - 0.4*Math.max(0, Math.min(1, (sk-0.8)/0.4))) : 0;
  // (6) A-D стрейф: цель дёргается туда-обратно — прицел не "ведёт" её, а
  // догоняет после каждой смены направления. Раньше стрейфер стрелял вдвое
  // реже стоящего и при этом попадать в него было так же легко — стоящий
  // выигрывал 8 из 10. Теперь в стрейфера заметно труднее попасть
  if(target._ds && target._ds.moving) trackErr = Math.max(trackErr, 0.010) * 2.2;
  recoilErr *= 0.3; // (6) отдача — паттерн (ниже), тут только её "шум"
  var sigma = Math.sqrt(wSpread*wSpread + recoilErr*recoilErr + spamErr*spamErr + aimErr*aimErr + flick*flick + 0.5*aimD*aimD + trackErr*trackErr);
  if(shooter.onStairs) sigma *= 2.2;
  // AWP в упор — ноускоп: без прицела, быстро, но разброс большой
  var noscope = BAL.awpClose && w.key === "AWP" && dist < 230;
  if(noscope) sigma *= 2.4;
  if(prefire) sigma *= 1.6 + 1.8*(1-prefireConfidence);
  if(thruSmoke) sigma *= 3.2;   // не видит цель — стреляет по памяти, почти вслепую
  if(shooter.atPost && shooter.curSpeed < 10) sigma /= BAL.holdAcc;
  if(w.scoped && shooter.curSpeed < 10 && dist > 300) sigma *= 0.8; // AUG/SG в прицеле на дистанции
  var seedS = tick*104729 + shooter.id.charCodeAt(0)*31 + shooter.id.length*7 + target.id.charCodeAt(0)*17 + Math.floor(shooter.nextShotTick*8);
  // сильные игроки чаще целятся в голову; AWP — всегда в корпус
  var pAimHead = 0.25 + 0.45*Math.max(0, Math.min(1, (sk-0.8)/0.4));
  // первые пули на появление: если прицел стоял на угле и на уровне головы —
  // целит в голову куда чаще (ваншот "на выходе"); если доводил прицел — в тело
  if(BAL.duelPlace && burstIdx <= 1 && shooter._place != null){
    pAimHead = Math.min(0.92, pAimHead * (0.45 + 0.9*shooter._place) * (0.6 + 0.6*(shooter._headLvl||0.7)));
  }
  pAimHead *= (BAL.hbHead || 0.75);
  if(burstIdx >= 3) pAimHead *= 0.35; // спрей — в корпус: отдача сама тянет в голову
  if(w.key === "SSG") pAimHead = Math.max(pAimHead, 0.8); // скаут — в голову (корпус не убивает)
  var aimHead = w.key !== "AWP" && hashRand(seedS+5) < pAimHead;
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
    var sgm = sigma * (BAL.hbK || 1);
    var ex = gr*Math.cos(2*Math.PI*gu2)*sgm + sp.x*(1-cmp), ey = gr*Math.sin(2*Math.PI*gu2)*sgm + sp.y*(1-cmp);
    var ux = ex/u1, uy = aimY + ey/u1;
    if(Math.hypot(ux, uy-hH) < 5.5) hbZone = "head";
    else if(uy >= hH-20*kC && uy < hH-6*kC && Math.abs(ux) < 15) hbZone = "chest";
    else if(uy >= hH-30*kC && uy < hH-20*kC && Math.abs(ux) < 13) hbZone = "stomach";
    else if(uy >= 0 && uy < hH-30*kC && Math.abs(ux) < 10) hbZone = "legs";
    // держит угол из-за укрытия (ящик, край стены): низ модели закрыт — пули
    // в живот/ноги уходят в укрытие. Не на каждом посту есть укрытие — ~60%
    if(BAL.hbCover && hbZone && (hbZone === "stomach" || hbZone === "legs") && target.atPost && target.curSpeed < 10 && target.post && target.post.hold &&
       !target._ds && hashRand(pHash(target.post.id || "p") + 17) < 0.6) hbZone = null;
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
    if(BAL.tagging) target._tagUntil = tick + 16; // попали — на ~0.25с замедлен
    if(target.hp > 0){
      var HT = teamIntel[shooter.team].hurt || (teamIntel[shooter.team].hurt = {});
      var prevH = HT[target.id];
      // сколько у него осталось — по своему урону (стрелок видит, что попал и
      // примерно на сколько), а не настоящее HP
      HT[target.id] = {hp:(prevH ? prevH.hp : 100) - dmg, tick:tick, by:shooter.id};
      var hEst = HT[target.id].hp;
      if(hEst <= 40 && (!prevH || prevH.hp > 40)) voiceLog(shooter.team, "hurt"+target.id, shooter.id, target.id+" сильно ранен, ~"+Math.max(1, Math.round(hEst/10)*10)+"!");
    }
    target._hitFx = {t:nowTs, head:headshot};
    if(target.hp <= 0 && target.alive){
      target.alive = false;
      shooter.kills++; shooter.roundKills++; target.deaths++;
      if(BAL.duelPlace && headshot && burstIdx === 0 && (shooter._place||0) > 0.8 && hashRand(seedS+29) < 0.5) logEvent(shooter.id+": прицел стоял на угле — хэдшот с первой пули по "+target.id);
      shooter.money = Math.min(MAX_MONEY, shooter.money + (w.killReward||300));
      // погибший теряет всё, кроме денег
      dropWeaponOnDeath(target);
      target.primary = null; target.secondary = target.team==="CT" ? "USP" : "GLOCK";
      target.armor = false; target.helmet = false; target.kit = false;
      target.planting = false; target.defusing = false;
      target.nades = emptyNades(); target.nadeTask = null;
      dropBomb(target);
      intelDeath(target, shooter);
      // раздел 12: "засвет" — после килла позиция стрелка известна врагу; если
      // он держал точку, а рядом ещё живые враги, — на несколько секунд уходит
      // на соседнюю позицию, а не ждёт трейда на том же месте
      shooter._exposedUntil = tick + 4*TICK_HZ;
      var postKill = BAL.awpRepos ? afterKillMove(shooter, target, w) : false;
      if(!postKill && BAL.repos && shooter.atPost && shooter.post && shooter.post.hold && !shooter.planting && !shooter.defusing &&
         bots.some(function(o){ return o.alive && o.team === target.team && Math.hypot(o.x-shooter.x, o.y-shooter.y) < 900; })){
        var alt = pickSpots("repos"+Math.round(shooter.post.x/30)+","+Math.round(shooter.post.y/30), shooter.post, 3,
          {rMin:55, rMax:170, minGap:40, see: shooter.post.look ? [shooter.post.look] : [], hideFrom:[{x:target.x, y:target.y}]});
        var ap = alt[hashRand(tick + shooter.id.charCodeAt(0)) < 0.5 ? 0 : Math.min(1, alt.length-1)];
        if(ap && Math.hypot(ap.x-shooter.post.x, ap.y-shooter.post.y) > 40){
          var lk = shooter.post.look;
          
          setPost(shooter, ap, lk, true, "repos"); if(BAL.awpRepos) leaveHold(shooter);
          holdTask(shooter, "repos", tick + 5*TICK_HZ);
          logEvent(shooter.id+": после килла меняет позицию");
        }
      }
      logEvent(shooter.id+" ["+w.name+"] устранил "+target.id+(headshot?" (в голову)":"")+" (дист. "+Math.round(dist)+", +$"+(w.killReward||300)+")", "kill");
      feedKill(shooter, target, w.key, headshot, {smoke:thruSmoke, noscope:noscope, blind:shooter.blindUntil > tick});
    }
  } else {
    // AWP промахнулся, враг близко — не ждёт перезатвора, а достаёт пистолет
    if(BAL.awpClose && w.key === "AWP" && dist < 280 && target.alive && shooter.secondary && hashRand(seedS+41) < 0.6 && pistolSwap(shooter)) logEvent(shooter.id+" (AWP): промах вблизи — на пистолет");
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
  }
  tracers.push({wc:tracerClass(shooter.weapon), x1:shooter.x, y1:shooter.y, x2:endX, y2:endY, team:shooter.team, born:nowTs, hit:hit, head:headshot, prefire:prefire, miss:!hit, zone:hitZone});
  // выстрел слышно далеко (шаг 5: с конусом обзора боты не видят спиной —
  // но разворачиваются на звук стрельбы; в кого попали — точно знает откуда)
  // глушитель — слышно ближе; в кого попали — тот понимает, откуда стреляют
  makeSound(shooter, shooter.x, shooter.y, "shots", {mul: w.silenced ? 0.55 : 1, seed: shooter.nextShotTick|0});
  if(target && target.alive && target.team !== shooter.team) makeSound(shooter, shooter.x, shooter.y, "hit", {only: target, seed: 5});
  if(tracers.length > 60) tracers.shift();
  if(prefire) logEvent(shooter.id+": префайр по памяти о "+target.id+" (увер. "+Math.round(prefireConfidence*100)+"%)"+(hit?" — попал":""));
}

var STATE_LABEL = {patrol:"патруль", hold:"держит угол", engage:"атакует", retreat:"отступает"};
// (v154) обстановка для решения о дуэли
function duelContext(bot, enemiesSeen, alliesNear){
  var o = {trade:0, up:false, forced:false, hurtFoe:false, awpLine:false, flashed:false};
  bots.forEach(function(m){ if(m !== bot && m.alive && m.team === bot.team && Math.hypot(m.x-bot.x, m.y-bot.y) <= 350) o.trade++; });
  var my = aliveCount(bot.team), their = aliveCount(bot.team === "CT" ? "T" : "CT");
  o.up = my > their;
  var tt = teamTac.T, secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  // когда драться обязан: после планта (обе стороны), выход T, ретейк, клатч, время
  if(bomb && bomb.state === "planted") o.forced = true;
  else if(bot.team === "T" && tt && tt.phase && tt.phase !== "setup") o.forced = true;
  else if(my === 1) o.forced = true;
  else if(secLeft < 20) o.forced = true;
  else if(bot.post && /^(retake|defuse|plantspot|antidefuse|endhunt|tradeR)/.test(bot.post.tag || "")) o.forced = true;
  var e = bot._nearestEnemyBot;
  if(e){
    var HT = teamIntel[bot.team] && teamIntel[bot.team].hurt, hk = HT && HT[e.id];
    o.hurtFoe = !!(hk && hk.hp <= 40 && tick - hk.tick < 8*TICK_HZ);
    o.awpLine = !!(e.weapon && e.weapon.key === "AWP");
    o.flashed = tick < (e.blindUntil || 0) && !!e._blindBy; // ослепили мы — видели, что флешка хлопнула на нём
  }
  return o;
}
function decideAction(bot, nearestDist, alliesNear, enemiesSeen){
  var hpFrac = Math.max(0, bot.hp)/100;
  // было enemiesSeen - alliesNear — себя не считали, и КАЖДАЯ дуэль 1 на 1
  // выглядела как "меньшинство" → отступление. Теперь 1v1 — это 0.
  var outnumbered = enemiesSeen - (alliesNear + 1);
  var inRange = nearestDist <= bot.weapon.range;

  var holdScore    = 0.45 + 0.20*(inRange?1:0) + 0.20*hpFrac - 0.15*Math.max(0,outnumbered);
  var engageScore  = 0.35 + 0.30*hpFrac - 0.25*Math.max(0,outnumbered) - 0.15*Math.max(0,nearestDist/bot.weapon.range-0.5);
  var retreatScore = 0.15 + 0.50*(1-hpFrac) + 0.20*Math.max(0,outnumbered);
  // plan §3: on stairs, "приоритет не задерживаться" — holding an angle mid-staircase
  // isn't an option a real player takes, so take it off the table entirely rather
  // than just making it score worse (a bad-enough alternative could still win otherwise).
  if(bot.onStairs) holdScore = -Infinity;
  // роумер играет от информации: увидел — охотнее уходит, чем лезет в дуэль
  if(bot.role === "roamer"){ retreatScore += 0.12; engageScore -= 0.05; }
  // план §5: роль и оружие — это веса в той же формуле, а не отдельный код
  var r = bot.tRole, wk = bot.weapon && bot.weapon.key;
  // (5) клатч T: один против нескольких — дуэли по одной. Видно/известно двоих
  // рядом — отойти за укрытие и взять следующего отдельно (кроме дефуза: тогда надо идти)
  if(BAL.tClutch && bot.team === "T" && aliveCount("T") === 1 && aliveCount("CT") >= 2 && tick - (bot._defuseHeard||-9999) > 110){
    var LKc = picKnown("T") || {}, kF = enemiesSeen;
    for(var eC in LKc){ var qC = LKc[eC]; if(tick - qC.tick < 3*TICK_HZ && Math.hypot(qC.x-bot.x, qC.y-bot.y) < 700 && bots.some(function(o){ return o.id === eC && o.alive; })) kF = Math.max(kF, 1) + (enemiesSeen ? 0 : 0); }
    var kN = 0; for(var eC2 in LKc){ var q2 = LKc[eC2]; if(tick - q2.tick < 3*TICK_HZ && Math.hypot(q2.x-bot.x, q2.y-bot.y) < 700) kN++; }
    if(Math.max(enemiesSeen, kN) >= 2){ retreatScore += 0.4; engageScore -= 0.3;
      if(bot._tcV !== roundNum){ bot._tcV = roundNum; voiceLog("T", "tcl"+roundNum, bot.id, "я один против "+aliveCount("CT")+" — не беру двоих сразу, по одному"); } }
  }
  // (1) мидер/роумер CT против группы T на миде: раньше "союзников рядом" считались
  // все в 550px (стоят на сайте за стеной и помочь не могут) — и мидер держал
  // дуэль против 3–5 T. Считаем тех, кто реально рядом на размен (≤300px);
  // известно 2+ T, а разменять некому — отходит, а не стоит насмерть
  if(BAL.midOutnum && bot.team === "CT" && (r === "mid" || r === "roamer") && !(bomb && bomb.state === "planted")){
    var LKo = picKnown("CT") || {}, knownF = 0;
    for(var eO in LKo){ var qO = LKo[eO]; if(tick - qO.tick < 4*TICK_HZ && Math.hypot(qO.x-bot.x, qO.y-bot.y) < 800 && bots.some(function(o){ return o.id === eO && o.alive; })) knownF++; }
    knownF = Math.max(knownF, enemiesSeen);
    var tradeM = bots.filter(function(o){ return o !== bot && o.alive && o.team === bot.team && Math.hypot(o.x-bot.x, o.y-bot.y) < 300; }).length;
    if(knownF >= 2 && knownF > tradeM + 1){ retreatScore += 0.35 + 0.1*(knownF - tradeM - 2); engageScore -= 0.25; holdScore -= 0.1;
      if(bot._moV !== roundNum){ bot._moV = roundNum; voiceLog("CT", "mo"+bot.id+roundNum, bot.id, "их "+knownF+" на миде, я один — отхожу, не дуэлю"); } }
  }
  // (v154) ценность дуэли. По демкам: у про в момент смерти в 71–77% рядом (≤350px)
  // есть свой на размен, у ботов было 38–54% — боты дерутся в одиночку.
  if(BAL.duelValue){
    var dv = duelContext(bot, enemiesSeen, alliesNear);
    if(!dv.forced){
      if(dv.trade === 0 && !dv.hurtFoe){ engageScore -= 0.18; retreatScore += 0.10; holdScore += 0.04; }
      if(dv.up){ engageScore += 0.08; }
      if(dv.awpLine && !dv.flashed){ engageScore -= 0.12; holdScore += 0.05; }
      // по демкам первым в раунде у T гибнет энтри (22%), лёркер — 13%, AWP — 4%;
      // у ботов было: лёркер 25%, AWP 9%, энтри 9%. Лёркер играет от инфы и
      // тайминга, а не от дуэлей; AWP T в дефолте — не первая жертва
      if(bot.team === "T" && r === "lurker"){ engageScore -= 0.22; retreatScore += 0.14; }
      if(bot.team === "T" && wk === "AWP"){ engageScore -= 0.08; retreatScore += 0.05; }
    }
  }
  if(r === "anchorA" || r === "anchorB"){ holdScore += 0.15; retreatScore -= 0.05; } // опорник держит, ждёт помощь
  if(r === "entry"){ engageScore += 0.15; }                                          // энтри лезет в первую дуэль
  if(r === "lurker"){ holdScore += 0.08; }
  if(wk === "AWP" || wk === "SSG" || (bot.weapon && bot.weapon.scoped)){ holdScore += wk === "AWP" ? 0.15 : 0.08; engageScore -= wk === "AWP" ? 0.10 : 0.05; } // снайперки/прицел — дальняя линия
  var ws = bot.weapon ? bot.weapon.slot : null;
  if(wk === "MAC10" || wk === "MP9" || wk === "UMP" || wk === "MP7" || wk === "P90" || (ws === "secondary" && wk !== "DEAGLE")){ engageScore += 0.08; } // SMG/пистолеты — сближаться
  if(bot.team === "T" && teamTac.T && teamTac.T.saving && !(bomb && bomb.state === "planted")){ engageScore -= 0.25; retreatScore += 0.25; } // сейв T — не лезть в дуэли
  if(bot.team === "CT" && teamTac.CT && teamTac.CT.preSave && !(bomb && bomb.state === "planted")){ engageScore -= 0.25; retreatScore += 0.25; }
  // враг ранен ("он на 20") — не отходить, а добивать
  if(bot._nearestEnemyBot){ var HTd = teamIntel[bot.team].hurt, hk = HTd && HTd[bot._nearestEnemyBot.id];
    if(hk && hk.hp <= 35 && tick - hk.tick < 10*TICK_HZ){ engageScore += 0.2; retreatScore -= 0.15; } }
  // после планта T держат бомбу, CT обязаны идти — время важнее HP
  if(bomb && bomb.state === "planted"){
    if(bot.team === "T"){ holdScore += 0.12; }
    else if(teamTac.CT && teamTac.CT.saving){ engageScore -= 0.25; retreatScore += 0.25; } // сейв — не лезть в дуэли
    else { engageScore += 0.15; retreatScore -= 0.20; holdScore -= 0.30; } // CT не могут "пересидеть" — надо идти на бомбу
  }
  // ---- цель важнее HP: у кого задача по бомбе, тот не бегает туда-сюда ----
  var ttT = teamTac.T;
  if(bot.team === "T" && bomb){
    if(bomb.state === "carried" && bomb.carrier === bot && ttT && ttT.phase !== "setup"){ retreatScore -= 0.5; } // носитель на выходе — ставить
    else if(bomb.state === "carried" && bomb.carrier === bot){
      // план §11.1 п.7: с бомбой не "всегда беги" — если рядом тиммейт для трейда,
      // играет как обычно; если изолирован — бомба дороже ещё одного фрага
      var mate = bots.some(function(o){ return o !== bot && o.alive && o.team === "T" && Math.hypot(o.x-bot.x, o.y-bot.y) < 450; });
      if(!mate){ engageScore -= 0.2; retreatScore += 0.15; }
    }
    if(bomb.state === "planted"){
      var someoneDefusing = tick - (bot._defuseHeard||-9999) < 110; // слышал дефуз (реальный или фейк)
      if(someoneDefusing){ engageScore += 0.4; retreatScore -= 0.6; }   // дефузят — любой ценой сбить дефуз
      else retreatScore -= 0.25;                                        // держим бомбу, а не убегаем
    }
  }
  if(bot._smokePush && tick < bot._smokePush.until){ holdScore -= 0.2; engageScore += 0.05; }
  // только что на этом углу убили тиммейта, а стрелка не видели — не выходить туда же
  if(bot._avoidPeekUntil > tick && bot._avoidPeekAt && Math.hypot(bot._avoidPeekAt.x-bot.x, bot._avoidPeekAt.y-bot.y) < 450){ engageScore -= 0.25; holdScore += 0.1; }
  // сбивает плант — время важнее всего: лезет в дуэль, не отходит
  if(bot._stopPlantUntil > tick){ engageScore += 0.3; holdScore -= 0.15; retreatScore -= 0.25; }
  // раздел 14: перезаряжается посреди боя — не высовываться, уйти за угол
  if(bot._reloading){ retreatScore += 0.35; engageScore -= 0.35; holdScore -= 0.1; }
  // ---- раздел 11: командная информация в весах ----
  // тиммейт только что погиб рядом — идти разменивать, а не прятаться
  if(tick < (bot._tradeUntil||0)){ engageScore += 0.2; retreatScore -= 0.15; }
  // команда знает, что рядом стак (2+ врагов), а своих меньше — в одиночку в дуэль не лезть
  var nearEst = intelEstimate(bot.team, bot.x, bot.y, 500, 4*64);
  if(nearEst.n >= 2 && alliesNear + 1 < nearEst.n){ engageScore -= 0.15; holdScore += 0.08; }
  // ---- инициатива: бесконечно стоять нельзя ----
  // Держать угол без контакта становится всё менее выгодно (через 3с каждая
  // секунда −0.04, до −0.35) — рано или поздно бот либо идёт дальше по своим
  // делам, либо сам пикает. T без планта под конец раунда давит (время против
  // них), CT с бомбой на карте и так обязаны идти.
  if(bot.holding && bot.holdSinceTick > 0){
    var heldSec = (tick - bot.holdSinceTick)/TICK_HZ;
    holdScore -= Math.min(0.35, 0.04*Math.max(0, heldSec - 3));
  }
  if(bot.team === "T" && bomb && bomb.state !== "planted"){
    var secL = ROUND_TIME_SEC - (simTime - roundStartTime);
    if(secL < 30){ engageScore += 0.25; holdScore -= 0.2; retreatScore -= 0.2; }
    // раздел: "T не слишком сильно пытаются взять бомбу, предпочитают холдить
    // углы" — на выходе/постпланте до закладки T должны продавливать контакт,
    // а не садиться в оборону, как только увидели первого CT
    if(ttT && ttT.phase !== "setup"){ engageScore += 0.10; holdScore -= 0.06; }
  }

  // раздел 12: анти-эко — у нас закуп, у них эко: не лезть в упор (там пистолет
  // опасен), держать дистанцию, где винтовка сильнее; не давать "геройский" пик
  var myEco = teamEco[bot.team], enEco = teamEco[bot.team === "CT" ? "T" : "CT"];
  if(myEco && enEco && (BAL.buyRead ? antiEco(bot.team) : ((myEco.roundType === "full" || myEco.roundType === "half") && enEco.roundType === "eco"))){
    if(nearestDist < 220){ retreatScore += 0.12; engageScore -= 0.08; }
    else { holdScore += 0.08; engageScore -= 0.04; }
  }
  // раздел 12: клатч (1 против 2+). Изоляция дуэлей — видит двоих сразу →
  // уйти из линии и ловить по одному; CT до планта время на его стороне —
  // не лезть, держать и тянуть время; T после планта — сидеть и ждать звук дефуза
  var myAlive = aliveCount(bot.team), theirAlive = aliveCount(bot.team === "CT" ? "T" : "CT");
  if(myAlive === 1 && theirAlive >= 2){
    if(enemiesSeen >= 2){ retreatScore += 0.30; engageScore -= 0.15; }
    else if(enemiesSeen === 1){ engageScore += 0.05; }
    if(bot.team === "CT" && bomb && bomb.state !== "planted"){ holdScore += 0.12; engageScore -= 0.08; }
    if(bot.team === "T" && bomb && bomb.state === "planted"){ holdScore += 0.10; }
    // T один до планта: цель — поставить бомбу; дальних дуэлей избегает,
    // стреляет, только если враг совсем рядом
    if(bot.team === "T" && bomb && bomb.state !== "planted" && (bomb.state !== "carried" || bomb.carrier === bot)){
      if(nearestDist > 230){ engageScore -= 0.25; retreatScore += 0.15; holdScore -= 0.05; }
    }
  }
  var best = "hold", bestScore = holdScore;
  if(engageScore > bestScore){ best = "engage"; bestScore = engageScore; }
  if(retreatScore > bestScore){ best = "retreat"; bestScore = retreatScore; }
  return best;
}

// ---- после фрага: AWP меняет угол, агрессивный добирает, остальные — как было ----
// Раньше снайпер после килла оставался на том же угле (или сдвигался на пару
// шагов, если стоял на посту) — второй T выходил туда, где у AWP уже стоит
// прицел, но и знал, где он. У про AWP после выстрела почти всегда уходит:
// отскок за укрытие и новый угол на ту же линию (кроссом к старому). Рисковый
// снайпер иногда (≤1 раз за раунд) репикает тот же угол — ставка на то, что
// его не ждут. Агрессивный рисковый игрок с винтовкой, наоборот, добирает:
// выходит на место фрага за вторым, пока тот перезаряжается/не готов.
// сход с позиции после фрага: цель мертва — "смотрю на угол, где только что
// видел врага" (hold по lastIntel) держал бота на месте ещё ~3с, и новый пост
// не срабатывал. Снимаем бой-удержание, чтобы он реально ушёл.
function leaveHold(b){ b.state = "patrol"; b.holding = false; b.crouching = false; b.decisionTick = tick; b.peekType = null; }
// (v156) решение после фрага — только по тому, что команда знает (ЛИП ≤5с),
// а не по настоящим позициям врагов
function postKillDecide(sh, tg, vp, here){
  if(sh.post && /^(lineup|plantspot|defuse|save|fetch|antidefuse|stopplant)/.test(sh.post.tag || "")) return false;
  var known = [], LK = picKnown(sh.team) || {};
  for(var eid in LK){ var q = LK[eid]; if(eid === tg.id || tick - q.tick > 5*TICK_HZ) continue;
    if(!bots.some(function(o){ return o.id === eid && o.alive; })) continue;
    if(Math.hypot(q.x-vp.x, q.y-vp.y) < 700 || Math.hypot(q.x-sh.x, q.y-sh.y) < 700) known.push({id:eid, x:q.x, y:q.y}); }
  var mates = bots.filter(function(o){ return o !== sh && o.alive && o.team === sh.team && Math.hypot(o.x-sh.x, o.y-sh.y) <= 350; }).length;
  var my = aliveCount(sh.team), their = aliveCount(tg.team);
  var HT = teamIntel[sh.team] && teamIntel[sh.team].hurt, hurtK = known.some(function(k){ var h = HT && HT[k.id]; return h && h.hp <= 40 && tick - h.tick < 8*TICK_HZ; });
  var tPP = sh.team === "T" && bomb && bomb.state === "planted";
  var ctMust = sh.team === "CT" && bomb && bomb.state === "planted";
  var seed = tick*53 + (sh.id.charCodeAt(sh.id.length-1)||0)*17;
  // 1) откат: их рядом двое и больше (и нас тут меньше), или мало HP — уйти с засвеченной точки
  if(!ctMust && ((known.length >= 2 && known.length > mates) || sh.hp <= 45)){
    var dvx = here.x - vp.x, dvy = here.y - vp.y, dvl = Math.max(1, Math.hypot(dvx, dvy));
    var back = walk({x: here.x + dvx/dvl*170, y: here.y + dvy/dvl*170});
    var hide = [vp].concat(known.map(function(k){ return {x:k.x, y:k.y}; }));
    var np = pickSpots("pkb"+tick+sh.id, back, 4, {rMin:0, rMax:200, minGap:50, see: sh.post && sh.post.look ? [sh.post.look] : [], hideFrom:hide})
      .filter(function(p){ return Math.hypot(p.x-here.x, p.y-here.y) > 70 && !hasLOS(p.x, p.y, vp.x, vp.y); })[0];
    if(np){
      
      setPost(sh, np, vp, true, "repos:back");
      if(sh.post && sh.post.tag === "repos:back"){ leaveHold(sh); holdTask(sh, "repos", tick + 4*TICK_HZ);
        logEvent(sh.id+": после фрага откат — "+(sh.hp <= 45 ? "мало HP" : "их ещё "+known.length+" рядом")); return true; }
    }
  }
  // 2) добор: известный враг рядом один (или ранен), сам цел, есть размен или перевес
  if(!tPP && known.length <= 1 && sh.hp > 50 && (mates >= 1 || my > their || hurtK || ctMust)){
    var pPush = (ctMust ? 0.75 : 0.55);
    if(hashRand(seed) < pPush){
      var tgt = known[0] ? {x:known[0].x, y:known[0].y} : vp;
      var sw = pickSpots("pkp"+tick+sh.id, vp, 4, {rMax:150, minGap:40, see:[tgt]})
        .filter(function(p){ return Math.hypot(p.x-here.x, p.y-here.y) > 60; })[0] || vp;
      
      setPost(sh, sw, tgt, true, "repos:push");
      if(sh.post && sh.post.tag === "repos:push"){ leaveHold(sh); holdTask(sh, "repos", tick + 3*TICK_HZ);
        logEvent(sh.id+": после фрага добирает — "+(known.length ? "второй рядом" : "дальше по месту фрага")); return true; }
    }
  }
  return false;
}
function afterKillMove(sh, tg, w){
  if(!sh.alive || sh.planting || sh.defusing || (bomb && bomb.state === "carried" && bomb.carrier === sh)) return false;
  // (9) на сейве убил — позиция засвечена (звук выстрела, килфид): уходит на
  // другое укрытие, откуда не видно место убийства и старую точку
  if(BAL.saveMove && sh.post && sh.post.tag === "save" && sh._saveSpot){
    var hereS = {x:sh.x, y:sh.y}, vpS = {x:tg.x, y:tg.y};
    var altS = pickSpots("svmv"+tick+sh.id, hereS, 4, {rMin:170, rMax:480, minGap:60, hideFrom:[vpS, hereS]})
      .filter(function(q){ return Math.hypot(q.x-hereS.x, q.y-hereS.y) > 150 && !hasLOS(q.x, q.y, vpS.x, vpS.y); })[0];
    if(altS){ sh._saveSpot = altS; sh._saveLooks = null; logEvent(sh.id+": на сейве — меняю позицию после фрага ("+calloutName(altS.x, altS.y)+")"); return true; }
  }
  var foesNear = bots.filter(function(o){ return o.alive && o.team === tg.team && Math.hypot(o.x-sh.x, o.y-sh.y) < 1400; });
  if(!foesNear.length) return false;
  // ещё кого-то видит прямо сейчас — продолжает стрелять, не бегает
  if((sh._visible||[]).some(function(o){ return o.alive && o !== tg; })) return false;
  var vp = {x:tg.x, y:tg.y}, here = {x:sh.x, y:sh.y};
  if(BAL.awpRepos && w && w.key === "AWP" && (!BAL.awpSide || BAL.awpSide === sh.team)){
    // новая точка: та же линия под другим углом, и не на виду у остальных
    // известных врагов (иначе по дороге его снимает второй)
    var others = [];
    for(var eidA in picKnown(sh.team)){ var eA = picKnown(sh.team)[eidA]; if(eidA !== tg.id && tick - eA.tick < 8*TICK_HZ && Math.hypot(eA.x-sh.x, eA.y-sh.y) < 1300) others.push({x:eA.x, y:eA.y}); }
    // держал пост (опорник/линия) — новый угол должен видеть и то, что он держал
    var seeA = [vp]; if(sh.post && sh.post.look && sh.post.tag !== "repos") seeA.push(sh.post.look);
    var alt = pickSpots("awpr"+tick+sh.id, here, 4, {rMin:100, rMax:260, minGap:60, see:seeA, hideFrom:others, cross:{from:here, pt:vp}});
    var ap = alt.filter(function(q){ return Math.hypot(q.x-here.x, q.y-here.y) > 90; })[0];
    if(!ap) return false;
    
    setPost(sh, ap, vp, true, "repos");
    if(!sh.post || sh.post.tag !== "repos") return false; // пост перебит (размен/лайнап) — не уходит
    leaveHold(sh);
    holdTask(sh, "repos", tick + 6*TICK_HZ);
    logEvent(sh.id+" (AWP): после фрага уходит с угла — новый угол, держит "+calloutName(vp.x, vp.y));
    return true;
  }
  // (смена позиции после фрага) убил с угла, а живых врагов рядом ещё хватает:
  // по нему есть инфа (килфид, звук) — следующий пойдёт на тот же угол или
  // зайдёт с другой стороны. Уходит чуть глубже, в укрытие от места убийства
  // и от известных врагов, но так, чтобы видеть тот же вход; до конца раунда
  // это его новая точка (роль больше не возвращает на старую)
  if(BAL.postKill){ var pkR = postKillDecide(sh, tg, vp, here); if(pkR) return true; }
  // смена позиции после фрага
  if(BAL.holdShift && foesNear.length >= 1 && shiftHold(sh, vp, tg.id, "после фрага засветился")) return true;
  return false;
}
// уйти с засвеченного угла чуть глубже: скрыто от точки контакта и известных
// врагов, но видно тот же вход; до конца раунда это его новая точка
function shiftHold(sh, vp, exceptId, why){
  if(!(sh.atPost && sh.post && sh.post.hold) || /^(save|repos|defuse|plantspot|lineup|pickup|endhunt|retake|gather|stopplant|antidefuse)/.test(sh.post.tag)) return false;
  if(sh._hs && sh._hs.round === roundNum && tick - sh._hs.t < 8*TICK_HZ) return false;
  var here = {x:sh.x, y:sh.y}, knownE = [], LKs = picKnown(sh.team) || {};
  for(var eH in LKs){ var qH = LKs[eH]; if(eH !== exceptId && tick - qH.tick < 10*TICK_HZ && Math.hypot(qH.x-sh.x, qH.y-sh.y) < 1400) knownE.push({x:qH.x, y:qH.y}); }
  var dvx = here.x - vp.x, dvy = here.y - vp.y, dvl = Math.max(1, Math.hypot(dvx, dvy));
  var back = walk({x: here.x + dvx/dvl*170, y: here.y + dvy/dvl*170});
  var seeL = sh.post.look ? [sh.post.look] : [];
  var np = pickSpots("hs"+tick+sh.id, back, 4, {rMin:0, rMax:200, minGap:50, see:seeL, hideFrom:[vp].concat(knownE)})
    .filter(function(q){ return Math.hypot(q.x-here.x, q.y-here.y) > 80 && !hasLOS(q.x, q.y, vp.x, vp.y); })[0];
  if(!np) return false;
  sh._hs = {round:roundNum, tag:sh.post.tag, pt:np, t:tick};
  var lk0 = sh.post.look, tg0 = sh.post.tag;
  dropTask(sh, "repos"); dropTask(sh, "endhunt"); dropTask(sh, "probe");
  setPost(sh, np, lk0, true, tg0);
  leaveHold(sh);
  sh._avoidPeekUntil = tick + 6*TICK_HZ; sh._avoidPeekAt = {x:vp.x, y:vp.y};
  logEvent(sh.id+": "+why+" — ухожу глубже ("+calloutName(np.x, np.y)+")");
  return true;
}
// ближайшее укрытие от конкретного врага: не видно его, дальше от него, чем
// бот сейчас, и первый шаг пути к укрытию не ведёт в его сторону
function findCover(b, foe){
  var dFoe = Math.hypot(foe.x-b.baseX, foe.y-b.baseY);
  var fa = Math.atan2(foe.y-b.baseY, foe.x-b.baseX);
  var best = null, bd = Infinity;
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    var d = Math.hypot(c.x-b.baseX, c.y-b.baseY);
    if(d < 40 || d > 420) return;
    if(Math.hypot(c.x-foe.x, c.y-foe.y) <= dFoe + 20) return;
    if(hasLOS(c.x, c.y, foe.x, foe.y)) return;
    var ca = Math.atan2(c.y-b.baseY, c.x-b.baseX);
    var dA = Math.abs(((ca - fa + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
    if(dA < 1.3) return;
    if(d < bd){ bd = d; best = c; }
  });
  return best;
}
// раздел 12: стрельба сквозь смок — редко и осознанно: держит угол, только что
// (≤1.2с) видел/слышал врага, и тот сейчас за дымом (стен между нет) — даёт
// короткую очередь в дым по памяти с сильно пониженной точностью
function smokeShots(){
  if(!smokes.length) return;
  bots.forEach(function(b){
    if(!b.alive || b._sawEnemy || b.planting || b.defusing || tick < b.blindUntil || b._reloading) return;
    if(!(b.holding || b.atPost) || b.curSpeed > 40*SPD_K) return;
    var mem = (b.lastIntel && tick - b.lastIntel.tick < 1.5*TICK_HZ) ? b.lastIntel :
              (b.heardSound && tick - b.heardSound.tick < 1.2*TICK_HZ && b.heardSound.team !== b.team) ? b.heardSound : null;
    if(!mem) return;
    if(tick < (b._smokeNext||0)) return;
    var foe = null;
    bots.forEach(function(e){
      if(foe || !e.alive || e.team === b.team) return;
      var d = Math.hypot(e.x-b.x, e.y-b.y);
      if(d > 450 || Math.hypot(e.x-mem.x, e.y-mem.y) > 130) return;
      if(!hasLOS(b.x, b.y, e.x, e.y) || !smokeBlocks(b.x, b.y, e.x, e.y)) return;
      foe = e;
    });
    if(!foe) return;
    // решает не каждый: ~35% шансов на "окно", потом пауза
    if(!b._smokeBurst){
      // смок на входе/выходе сайта — туда стреляют намного чаще: за ним почти
      // наверняка кто-то проходит (T — заходят, CT — держат выход)
      var entrySmoke = BAL.smokeEntry && ["A","B"].some(function(k){ var g = GEO[k];
        return smokes.some(function(sm){ return Math.hypot(sm.x-g.tEntry.x, sm.y-g.tEntry.y) < 220 || Math.hypot(sm.x-g.ctEntry.x, sm.y-g.ctEntry.y) < 220; }); });
      var chance = entrySmoke ? (b.team === "T" ? 0.8 : 0.65) : 0.35;
      if(hashRand(tick*13 + b.id.charCodeAt(0)*7 + b.id.length) > chance){ b._smokeNext = tick + TICK_HZ; return; }
      b._smokeBurst = 3;
      logEvent(b.id+": простреливает смок по "+foe.id);
    }
    b._smokeShot = true;
    var a0 = b.ammo;
    tryShoot(b, foe, Math.hypot(foe.x-b.x, foe.y-b.y));
    b._smokeShot = false;
    if(b.ammo !== a0){ b._smokeBurst--; if(b._smokeBurst <= 0){ b._smokeBurst = 0; b._smokeNext = tick + 1.5*TICK_HZ; } }
  });
}
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
      // шаг 5: обзор перекрывает дым; видит только тот, у кого враг в конусе
      // взгляда (или вплотную, или контакт уже идёт), и кто не ослеплён
      if(!hasLOS(ct.x,ct.y,t.x,t.y)) return;
      // ван-вей: стоящий в самом краю дыма видит наружу, а его снаружи — нет
      var smk = smokeBlocks(ct.x,ct.y,t.x,t.y), ctOW = false, tOW = false;
      if(smk){  ctOW = oneWaySees(ct, t); tOW = oneWaySees(t, ct); if(!ctOW && !tOW) return; }
      var ctSees = (!smk || ctOW) && tick >= ct.blindUntil && (inFov(ct, t.x, t.y) || ct.contactStreak > 0);
      var tSees  = (!smk || tOW) && tick >= t.blindUntil  && (inFov(t, ct.x, ct.y) || t.contactStreak > 0);
      if(!ctSees && !tSees) return;
      if(ctSees){ ct._sawEnemy = true; ct._lastSawT = tick; ct._visible.push(t); if(dist < ct._nearestEnemyDist){ ct._nearestEnemyDist = dist; ct._nearestEnemyBot = t; } }
      if(tSees){ t._sawEnemy = true; t._lastSawT = tick; t._visible.push(ct); if(dist < t._nearestEnemyDist){ t._nearestEnemyDist = dist; t._nearestEnemyBot = ct; } }
      pairs.push({ct:ct, t:t, dist:dist, ctSees:ctSees, tSees:tSees});
    });
  });

  // цель держится, пока видна (раньше каждый тик бралась ближайшая: при двух
  // врагах на похожей дистанции прицел метался между ними и выстрелы срывались).
  // Сменить цель (убил / пропала из вида) посреди очереди: спрей переводится,
  // пока следующие пули ещё лягут в корпус нового врага (режим огня, С1), иначе
  // очередь кончилась — пауза на возврат отдачи. Доводка прицела — сама: прицел
  // поворачивается с конечной скоростью, а стреляет бот только наведённым
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
  bots.forEach(function(b){
    if(!b.alive) return;
    if(b._sawEnemy){
      b.contactStreak++;
      // память для префайра (план §3/§6): "видел врага тут только что" —
      // обновляется каждый тик реального контакта, не только на входе в бой
      b.lastIntel = {x:b._nearestEnemyBot.x, y:b._nearestEnemyBot.y, tick:tick};
    } else {
      // раньше тут было contactStreak = 0 и nextShotTick = 0: один тик без LOS
      // (враг чуть сдвинулся за край угла, пик закончился) — и стрелок заново
      // проходил полную задержку реакции 20-48 тиков, т.е. просто переставал
      // стрелять. Теперь "реакция" остывает постепенно: короткая потеря
      // контакта почти не сбрасывает её, долгая — сбрасывает полностью.
      b.contactStreak = Math.max(0, b.contactStreak - 3);
      // holding on stale-but-recent intel = "ещё смотрю на угол, где только что
      // видел врага" — это ровно то состояние, из которого возможен префайр;
      // без этого "hold" схлопывался бы в patrol в тот же тик, когда контакт
      // на миг теряется, и префайру было бы неоткуда взяться
      var stillWatching = b.holding && b.lastIntel && (tick - b.lastIntel.tick) < CAUTION_TICKS;
      if(!stillWatching && b.state !== "patrol"){ b.state = "patrol"; b.holding = false; b.forcedRetreat = false; }
      return;
    }
    if(tick - b.decisionTick < DECISION_INTERVAL_TICKS) return;
    if(b.planting || b.defusing) return; // закладывает/дефузит — решение уже принято
    b.decisionTick = tick;
    var alliesNear = bots.filter(function(o){ return o!==b && o.team===b.team && o.alive && Math.hypot(o.x-b.x,o.y-b.y) < 550; }).length;
    var enemiesSeen = bots.filter(function(o){ return o.team!==b.team && o.alive && Math.hypot(o.x-b.x,o.y-b.y) <= (b._nearestEnemyDist===Infinity? b.weapon.range : Math.max(b.weapon.range, b._nearestEnemyDist)) && hasVision(b.x,b.y,o.x,o.y) && inFov(b, o.x, o.y); }).length;
    var next = decideAction(b, b._nearestEnemyDist, alliesNear, enemiesSeen);
    // гистерезис: в отход и из отхода — не чаще раза в ~1.3с, иначе бот с низким
    // HP дёргался "отступаю / атакую / отступаю" каждые полсекунды
    if(next !== b.state && (next === "retreat" || b.state === "retreat") && tick - (b.stateSince||0) < 160) next = b.state; // ~2.5с
    if(next !== b.state) b.stateSince = tick;
    if(next !== b.state){
      logEvent(b.id+": "+STATE_LABEL[next]+" (HP "+Math.max(0,b.hp)+"%, союзников рядом "+alliesNear+", врагов видит "+enemiesSeen+")");
      if(next === "engage"){
        var outnum = Math.max(0, enemiesSeen - alliesNear);
        b.peekType = outnum > 0 ? "jiggle" : (alliesNear >= enemiesSeen && b.hp > 60 ? "wide" : "shoulder");
        // против AWP не выходят широко в одиночку: джиггл/плечо — вызвать выстрел
        // и не отдать фраг (байт). Широкий — только если рядом напарник на размен
        var nbA = b._nearestEnemyBot;
        if(BAL.duelPlace && nbA && nbA.weapon && nbA.weapon.key === "AWP" && b.weapon && b.weapon.key !== "AWP"){
          var mate250 = bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) < 250; });
          b.peekType = mate250 && b.hp > 60 ? "wide" : (outnum > 0 ? "jiggle" : "shoulder");
        }
        // (2) тип пика решён ещё до контакта (флешка себе / вдвоём — широкий, один — джиггл)
        if(b._plannedPeek && b._plannedPeek.type && tick - b._plannedPeek.t < 3*TICK_HZ && tick >= b._plannedPeek.t - 2*TICK_HZ) b.peekType = b._plannedPeek.type;
        b.peekSinceTick = tick;
        // направление и сторона пика фиксируются в момент решения: в ту сторону,
        // где после выхода враг остаётся виден и нет стены (раньше сторона
        // бралась по номеру бота, а направление — каждый тик заново: бот
        // "дёргался" то влево, то вправо, иногда выпрыгивая в открытую)
        var nb0 = b._nearestEnemyBot;
        b._peekDir = nb0 ? Math.atan2(nb0.y-b.baseY, nb0.x-b.baseX) : (b.facing||0);
        var pa0 = b._peekDir + Math.PI/2, amp0 = b.peekType === "wide" ? (BAL.smoothPeek ? 42 : 60) : (BAL.smoothPeek ? 16 : 30), sideBest = 0;
        [1, -1].forEach(function(sd){
          if(sideBest) return;
          var px0 = b.baseX + Math.cos(pa0)*sd*amp0, py0 = b.baseY + Math.sin(pa0)*sd*amp0;
          if(crossesWall(b.baseX, b.baseY, px0, py0)) return;
          if(nb0 && !hasLOS(px0, py0, nb0.x, nb0.y)) return;
          sideBest = sd;
        });
        if(!sideBest && b.peekType !== "jiggle") b.peekType = null; // пикнуть некуда — стреляет с места
        b._peekSide = sideBest || 1;
      } else {
        b.peekType = null;
      }
    }
    b.state = next;
    if(next !== "patrol") b.roamChecking = false;
    b.holding = (next === "hold");
    b.holdSinceTick = b.holding ? (b.holdSinceTick===-999 ? tick : b.holdSinceTick) : -999;
    b.crouching = b.holding && (tick - b.holdSinceTick > 25);
    if(next === "retreat" && !b.forcedRetreat){
      // роумер отходит на предыдущую точку маршрута, а не на спавн
      var rt = (b.role === "roamer" && b.roamPrevPt) ? b.roamPrevPt : b.spawnPt;
      // опорник отходит не на спавн, а к CT-входу своего сайта — ждать помощь/ретейк;
      // T во время выхода — назад к точке сбора
      if(b.tRole === "anchorA") rt = GEO.A.ctEntry;
      else if(b.tRole === "anchorB") rt = GEO.B.ctEntry;
      else if(b.team === "T" && teamTac.T && GEO[teamTac.T.site]) rt = GEO[teamTac.T.site].tStage;
      var wp = buildWaypointPath(b.baseX, b.baseY, b.z, rt.x, rt.y, rt.z||0);
      // Отход не должен вести на врага: раньше "дальняя" точка отхода (спавн,
      // вход на сайт, точка сбора) часто лежала ЗА противником, и бот, решив
      // отступать, бежал прямо на него. Теперь, если первый отрезок пути ведёт
      // в сторону врага, бот уходит в ближайшее укрытие — место, откуда врага
      // не видно и которое дальше от него, чем сам бот.
      var foe = b._nearestEnemyBot;
      if(foe){
        var fa = Math.atan2(foe.y-b.baseY, foe.x-b.baseX);
        var w0 = wp.length ? wp[0] : [rt.x, rt.y];
        var wa = Math.atan2(w0[1]-b.baseY, w0[0]-b.baseX);
        var dA = Math.abs(((wa - fa + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
        if(dA < 1.2){ var cov = findCover(b, foe); if(cov) wp = buildWaypointPath(b.baseX, b.baseY, b.z, cov.x, cov.y, 0); }
      }
      b.path = wp; b.pathIdx = 0;
      b.forcedRetreat = true;
    } else if(next !== "retreat"){
      b.forcedRetreat = false;
    }
  });

  // отступающий, который всё равно сближается с врагом (путь позже повернул
  // к нему) — каждые 16 тиков проверяем и, если так, перестраиваем путь в укрытие
  bots.forEach(function(b){
    if(!b.alive || b.state !== "retreat"){ b._rtChk = null; return; }
    var foe = b._nearestEnemyBot || (b.lastIntel ? {x:b.lastIntel.x, y:b.lastIntel.y} : null);
    if(!foe) return;
    var dF = Math.hypot(foe.x-b.baseX, foe.y-b.baseY);
    if(!b._rtChk){ b._rtChk = {t:tick, d:dF}; return; }
    if(tick - b._rtChk.t >= 16){
      if(dF < b._rtChk.d - 4){
        var cv = findCover(b, foe);
        if(cv){ b.path = buildWaypointPath(b.baseX, b.baseY, b.z, cv.x, cv.y, 0); b.pathIdx = 0; }
      }
      b._rtChk = {t:tick, d:dF};
    }
  });

  // ---------- куда смотрит бот ----------
  // видимый враг → задачи со своим взглядом → делёж углов команды (lookPlan,
  // в нём же «как у про» и угол поста как веса) → одна проверка "не в стену"
  // → плавность.
  // Поворот плавный, но быстрый (AIM_TURN_RATE), и стрелять можно только
  // когда прицел уже почти на цели (AIM_FIRE_CONE) — отсюда естественная
  // задержка "развернулся → выстрелил", когда враг появился сбоку/сзади.
  var aimStep = AIM_TURN_RATE / TICK_HZ;
  if(tick % 8 === 0 && BZ.ids.length){ lookPlan("CT"); lookPlan("T"); }
  bots.forEach(function(b){
    if(!b.alive) return;
    var look = null;
    if(b._sawEnemy && b._nearestEnemyBot){ look = b._nearestEnemyBot; b.lookReason = "enemy"; }
    else look = newLookFor(b);
    // страховка "не смотреть в стену": если прямо по взгляду стена ближе ~1м
    // (цель — за стеной: инфа/звук/последний враг), берём ближайшее открытое
    // направление в пределах ±70° — туда, откуда реально можно увидеть выход
    if(BAL.noWallLook && !b._sawEnemy && !/^(enemy|spam|cover)$/.test(b.lookReason || "")) look = wallSafeLook(b, look);
    var slUrg = BAL.smoothLook ? lookUrgent(b) : true;
    if(BAL.smoothLook){ look = smoothLookFilter(b, look, slUrg); }
    b.lookTarget = look ? {x:look.x, y:look.y} : null;
    // (v153) бросает гранату — смотрит туда, куда кинул, пока бросок не закончен
    // (раньше за 0,2с после броска взгляд щёлкал обратно — самый частый "рывок")
    if(look && BAL.smoothLook && b.throwUntil && tick < b.throwUntil && !b._sawEnemy) look = null;
    if(look){
      var want = Math.atan2(look.y-b.y, look.x-b.x);
      if(b.facing === undefined) b.facing = want;
      var dd = want - b.facing;
      dd = ((dd + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
      if(slUrg) b.facing += Math.max(-aimStep, Math.min(aimStep, dd));
      else {
        // (v153) вне боя: плавно, с торможением к цели, не быстрее ~260°/с;
        // стоя мелкие поправки (<3°) не делаем — прицел стоит, а не дрожит
        var standing = !(b.curSpeed > 15*SPD_K);
        if(!(standing && Math.abs(dd) < 0.05)){
          var cap = SL.calmRate / TICK_HZ, stp = Math.min(cap, Math.max(SL.minStep, Math.abs(dd)*SL.ease));
          b.facing += Math.max(-stp, Math.min(stp, dd));
        }
      }
    }
  });

  pairs.forEach(function(p){
    if(p.ctSees && p.ct._nearestEnemyBot === p.t) tryShoot(p.ct, p.t, p.dist);
    if(p.tSees && p.t._nearestEnemyBot === p.ct) tryShoot(p.t, p.ct, p.dist);
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
function assignNewDestination(bot, tick){
  // отступает, а путь кончился/сброшен — не случайная точка патруля (часто
  // как раз в сторону врага), а укрытие от того, от кого отходит
  if(bot.state === "retreat"){
    var foe = bot._nearestEnemyBot || (bot.lastIntel ? {x:bot.lastIntel.x, y:bot.lastIntel.y} : null);
    var cv = foe ? findCover(bot, foe) : null;
    var tgt = cv || bot.spawnPt;
    bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, tgt.x, tgt.y, 0);
    bot.pathIdx = 0; bot.pickTick = tick;
    return;
  }
  if(bot.post && bot.state === "patrol"){
    if(bot.atPost || bot.planting || bot.defusing) return; // стоит на посту — путь не нужен
    var epp = fireSafe(bot.post, bot);
    bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, epp.x, epp.y, 0);
    bot.pathIdx = 0; bot.pickTick = tick;
    return;
  }
  if(bot.role === "roamer" && bot.state === "patrol"){
    if(bot.roamChecking) return; // стоит на чеке — путь не нужен
    var route = ROAM_ROUTES[bot.team];
    if(route && route.length){
      var rp = route[bot.roamIdx % route.length];
      bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, rp.x, rp.y, 0);
      bot.pathIdx = 0; bot.pickTick = tick; bot.roamTarget = rp;
      return;
    }
  }
  var r = hashRand(bot.id.charCodeAt(0)*97 + bot.id.length*13 + tick*7919 + bot.pickTick);
  var pool = POINT_POOL.length ? POINT_POOL : [bot.spawnPt];
  var target = pool[Math.floor(r * pool.length)];
  // small deterministic jitter around the tactical point (plan discussion: a
  // bot occupying a point shouldn't stand dead-center every time) — seeded off
  // the same pickTick so it's reproducible, not Math.random.
  var jr1 = hashRand(bot.id.charCodeAt(0)*53 + tick*131 + 11);
  var jr2 = hashRand(bot.id.charCodeAt(0)*53 + tick*131 + 22);
  var jitterX = (jr1-0.5)*36, jitterY = (jr2-0.5)*36;
  var tx = target.x+jitterX, ty = target.y+jitterY, tz = target.z||0;
  // тактическая точка могла оказаться внутри стены (рисовалась под старые
  // стены) — идём к ближайшему проходимому месту, а не в стену
  var snapped = snapToWalkable(tx, ty); tx = snapped.x; ty = snapped.y;
  var wp = buildWaypointPath(bot.baseX, bot.baseY, bot.z, tx, ty, tz);
  // если маршрута нет (цель в отрезанном куске навмеша) и путь выродился в
  // прямую линию сквозь стену — берём другую точку, до 6 попыток
  for(var tries=0; tries<6 && wp.length===1 && segCrossesManualWalls(bot.baseX,bot.baseY,wp[0][0],wp[0][1]); tries++){
    var rr = hashRand(bot.id.charCodeAt(0)*197 + tick*31 + tries*7717);
    var t2 = pool[Math.floor(rr*pool.length)];
    var s2 = snapToWalkable(t2.x, t2.y);
    wp = buildWaypointPath(bot.baseX, bot.baseY, bot.z, s2.x, s2.y, t2.z||0);
  }
  bot.path = wp;
  bot.pathIdx = 0;
  bot.pickTick = tick;
}

