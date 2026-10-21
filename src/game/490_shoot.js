// (Б4) стрелять на ходу или сначала остановиться: выстрел, если попасть в корпус на текущей скорости не меньше FIRE_K от
// «стоя». Проектное число, подобрано по демкам (b4_shots.py: первый выстрел очереди у про — 60–65 % на точной скорости ≤ 34 %
// максимальной, 20–25 % до 60 %, остальное быстрее; медиана скорости 52–62 ед./с)
var FIRE_K = 0.7;
// (Б4) ошибка прицела игрока (рад) — по демкам про (b4_shots.py, Mirage, 66 тыс. выстрелов из винтовки по цели, видной по
// геометрии игры): попадание почти не зависит от дистанции, а зависит от того, как быстро цель идёт поперёк линии огня относительно
// стрелка (vr): ≤ 50 ед./с — 45→33 % (вблизи → > 1500 ед.), 50–120 — 35→24 %, 120–200 — 22→18 %, > 200 — ~10 %. Это ошибка в ед.
// у цели: σ ≈ √(A² + (L·vr)²), A ≈ 14 ед. (+ 2 на 1000 ед. дистанции), L ≈ 0,12 с — запаздывание прицела за целью. У бота A = 11:
// к ней добавляются разброс оружия и отдача, которые у про уже внутри (подобрано прогоном ПК 23: 14 → дуэль 0,34–0,38 с, 11 → 0,33,
// у про 0,30). vr — скорость сейчас (сглаженная за 0,25 с, как в замере про, удлиняла дуэли — прогон ПК 25). Навык — как раньше:
// aimErr (0,0045 + 0,02·(1,2 − навык)) относительно навыка 1,0. AIM_FLICK, AIM_HEAD_PISTOL — ниже, где применяются
var AIM_A = 11, AIM_AD = 0.002, AIM_LAG = 0.12, AIM_FLICK = 0.15, AIM_HEAD_PISTOL = 2.8;
function aimSigma(sh, tg, dist){
  var du = Math.max(8, dist)*PX_UNITS, sk = sh.skill || 1;
  var lx = (tg.x - sh.x)/Math.max(1, dist), ly = (tg.y - sh.y)/Math.max(1, dist);
  var rvx = ((tg.x - tg.px) - (sh.x - sh.px))*TICK_HZ, rvy = ((tg.y - tg.py) - (sh.y - sh.py))*TICK_HZ;
  var vr = Math.abs(rvx*(-ly) + rvy*lx)*PX_UNITS;
  var A = (AIM_A + AIM_AD*du) * (0.0045 + 0.020*Math.max(0, 1.2 - sk)) / 0.0085;
  return Math.sqrt(A*A + AIM_LAG*AIM_LAG*vr*vr) / du;
}
// (Б4) разброс оружия от скорости (рад): доля от максимальной скорости с этим оружием, до 34 % — как стоя (CS2)
function shotSpread(sh, v){ var w = sh.weapon, f = Math.min(1, v / (SPEED*weaponSpeedMul(sh))), rk = Math.max(0, (f - 0.34)/0.66);
  return (w.stand*(sh.crouching ? 0.75 : 1) + w.move*(rk + 0.08*f)) / 1000; }
// (Б4) до какой скорости гасить, чтобы выстрел был «стоит того» (то же правило FIRE_K, что в tryShoot, без отдачи), px/с
function fireVAcc(sh, tg, dist){
  var bA = Math.atan(BODY_HALF/Math.max(8, dist)), a = aimSigma(sh, tg, dist), vmax = SPEED*weaponSpeedMul(sh);
  var pB = function(v){ var s2 = Math.pow(shotSpread(sh, v), 2) + a*a; return 1 - Math.exp(-(bA*bA)/(2*s2)); };
  var p0 = pB(0);
  for(var k = 20; k > 0; k--){ var v = vmax*k/20; if(pB(v) >= FIRE_K*p0) return v; }
  return 0;
}
// (Б4) готовность к выстрелу для движения в дуэли (fightCycleTick): через сколько тиков бот мог бы выстрелить в эту цель
// (реакция, темп оружия, остывание разброса); 0 — готов, ждёт только, пока погасит скорость
function fireReady(sh, tg, n){ sh._fire = {t:tick, tg:tg.id, inT:Math.max(0, Math.ceil(n))}; }
function tryShoot(shooter, target, dist){
  // (этап 2, P0-2) реакция и доводка — по ЭТОЙ цели (shooter._ts[id] — сколько тиков подряд её видно, гаснет как contactStreak),
  // а не по контакту бота с кем угодно: раньше вторая цель в живой перестрелке шла без реакции (34 % выстрелов раньше 150 мс)
  var cs = (shooter._ts && shooter._ts[target.id]) || 0;
  if(!shooter.alive || !target.alive) return;
  if(BAL.knifeRun && (shooter._knife || (shooter._drawUntil && tick < shooter._drawUntil))){ if(shooter._knife){ shooter._knife = false; shooter._drawUntil = tick + Math.round(0.4*TICK_HZ); } return; } // достаёт оружие
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
  if(cs <= 1){
    var hAim = Math.atan2(target.y-shooter.y, target.x-shooter.x);
    var hD = shooter.facing === undefined ? Math.PI : Math.abs(((hAim - shooter.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
    // раздел 14: реакция. Кто уже целился в эту точку (держит угол ИЛИ заходит
    // с прицелом на типичный угол) — реагирует быстрее; кто смотрел в сторону —
    // медленнее (плюс разворот прицела). И "преимущество пикающего": у того, кто
    // стоит, выглянувший появляется на экране чуть позже (в CS — из-за сети).
    var pre = hD < 0.25 ? (shooter.curSpeed < 45*SPD_K ? BAL.holdReact : BAL.preaimReact) : (hD < 0.6 ? 0.9 : 1.1);
    shooter._reactMul = pre * (shooter.curSpeed > SPEED*0.8 ? BAL.moveReact : 1.0);
    shooter._peekLag = (shooter.curSpeed < 45*SPD_K && target.curSpeed > (BAL.pieSlice ? 60 : 45)*SPD_K) ? BAL.peekAdv : 0; // преимущество пикающего — только у быстрого выхода; кто режет угол шагом, его не имеет
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
  if(cs <= 1){
    shooter._hes = 0;
    if(BAL.execErr && shooter.prof && hashRand(tick*23 + shooter.id.charCodeAt(1)*13 + target.id.charCodeAt(1)) < 0.015 + (1-prof(shooter,"disc"))*0.05){
      shooter._hes = 8 + Math.floor(hashRand(tick*5 + 3)*10);
      noteMistake(shooter, "замешкался на пике "+target.id);
    }
  }
  // в клатче навык игрока в клатчах немного меняет реакцию
  var clutchMul = (aliveCount(shooter.team) === 1 && shooter.prof) ? (1.1 - 0.2*prof(shooter, "clutch")) : 1;
  // частичная видимость: неподвижного (особенно сидящего) врага вдали
  // замечают позже — виден кусок модели на фоне угла; бегущего — сразу
  var visLag = 0;
  if(BAL.partialVis && cs <= 1){
    var tsp = target.curSpeed || 0;
    if(tsp < 20 && dist > 350) visLag = Math.round(Math.min(10, 3 + (dist-350)/80) + (target.crouching ? 3 : 0));
    else if(tsp > 100*SPD_K) visLag = -2;
    shooter._visLag = visLag;
  } else if(BAL.partialVis) visLag = shooter._visLag || 0;
  effReaction = Math.max(4, Math.round(shooter.reactionTicks * (shooter._reactMul || 1) * clutchMul) + (shooter._peekLag || 0) + ((BAL.awpClose && shooter.weapon.key === "AWP" && dist < 230) ? 0 : (shooter.weapon.scopeTicks || 0)) + (shooter._hes || 0) + visLag);
  if(shooter._smokeShot){ /* прострел смока — без реакции на "появление", он и не появлялся */ }
  else if(cs < effReaction){
    // префаер — только по тому, что сам только что видел (≤1.4с), а не по коллу/
    // догадке: раньше ~30% выстрелов были префаерами, и ТТК выглядел мгновенным
    var pfWin = BAL.prefireStrict ? 90 : CAUTION_TICKS, LI = shooter._intelPre;   // что знал до этого контакта
    if(shooter.holding && LI && (!BAL.prefireStrict || LI.src !== "call") && (tick - LI.tick) < pfWin &&
       Math.hypot(target.x-LI.x, target.y-LI.y) < PREFIRE_RADIUS &&
       // перевыход после потери: мгновенно — только если видел <0.5с назад,
       // иначе нужна хотя бы половина реакции (прицел "примерно там", а не на голове)
       (!BAL.prefireStrict || (tick - LI.tick) < 32 || cs >= Math.round(effReaction*0.5))){
      prefire = true;
      prefireConfidence = 1 - (tick - LI.tick)/pfWin; // 1 = только что видел, 0 = на грани "забыл"
    } else {
      fireReady(shooter, target, effReaction - cs);
      return;
    }
  }
  var w = shooter.weapon;
  if(dist > w.range) return;
  if(tick < shooter.nextShotTick){ fireReady(shooter, target, shooter.nextShotTick - tick); return; }
  if(shooter._fc && shooter._fc.moving) return; // уходит с линии / выглядывает — на бегу не стреляет
  var thruSmoke = !!shooter._smokeShot;
  // раздел 14: магазин и перезарядка — во время перезарядки не стреляет
  updateReload(shooter);
  if(shooter._reloading || shooter.ammo <= 0) return;
  // угловые размеры цели (px радара ≈ 2.5 юнита CS2): тело ~32u шириной, голова ~11u
  var hA = Math.atan(HEAD_HALF/Math.max(8,dist)), bA = Math.atan(BODY_HALF/Math.max(8,dist));
  // стреляет только туда, куда смотрит: прицел должен быть почти на цели —
  // вблизи цель большая, можно стрелять сразу; вдали надо довести прицел
  var aimD = 0;
  if(shooter.facing !== undefined){
    var aimA = Math.atan2(target.y-shooter.y, target.x-shooter.x);
    aimD = Math.abs(((aimA - shooter.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
    if(aimD > Math.min(AIM_FIRE_CONE, Math.max(0.05, 2.5*bA))){ fireReady(shooter, target, 0); return; }
  }
  // (v263, Б1) свой на линии огня — не стреляет, как настоящий игрок: пуля попала бы в него
  var onLine = bulletVictim(shooter, target.x, target.y, target);
  if(onLine && onLine.team === shooter.team) return;

  // раздел 14 (пересмотр): разброс от частой стрельбы — "нагрев", который
  // остывает со временем. Не на близкой дистанции — бот не спамит, а тапает:
  // ждёт, пока разброс остынет настолько, чтобы следующая пуля шла в корпус
  var heat = Math.max(0, (shooter._heat||0) - (tick - shooter.lastShotTick)/(w.recov||8));
  // с какой дистанции уже тапают и насколько строго ждут остывания: USP — почти
  // всегда тапом (быстро жмут только вплотную), дигл — всегда, остальные
  // пистолеты — с ~110px, ПП и винтовки — с ~160px
  var tapFrom = w.key === "USP" ? 45 : (w.spam >= 30 ? 0 : (w.slot === "secondary" ? 110 : 160));
  var tapK = w.key === "USP" ? 0.4 : 0.7;
  if(w.spam && dist > tapFrom && w.spam/1000*heat > tapK*bA){ fireReady(shooter, target, (heat - tapK*bA*1000/w.spam)*(w.recov||8)); return; }
  var burstIdx = tick - shooter.lastShotTick > SPRAY_RESET_TICKS ? 0 : shooter.burstCount;

  // ---- раздел 14: попадание — не "шанс N%", а угловая ошибка прицела ----
  // Итоговая ошибка σ (рад) складывается из: разброса оружия (стоя/на бегу,
  // сидя меньше), отдачи в очереди (бот компенсирует часть по навыку),
  // собственной ошибки наведения бота и "доводки" сразу после реакции.
  // Попал ли — сравнение σ с угловым размером головы/тела на этой дистанции:
  // в упор цель огромная и промахнуться почти невозможно, на длинной дистанции
  // в голову попадают редко — как в CS, а не одинаковые 50% на любой дистанции.
  var sk = shooter.skill;
  var wSpread = shotSpread(shooter, shooter.curSpeed);
  var comp = 0.55 + 0.35*Math.max(0, Math.min(1, (sk-0.8)/0.4));
  var recoilErr = w.recoil/1000 * Math.max(0, burstIdx-1) * (1-comp) * 1.6;
  var spamErr = (w.spam||0)/1000 * heat;
  // (Б4) ошибка прицела игрока — aimSigma (от того, как быстро цель идёт поперёк линии относительно стрелка; числа — демки);
  // первая пуля после реакции чуть хуже (довёл прицел не до конца): у про точность 1-го выстрела очереди 0,34 против 0,39 у
  // следующих (Mirage, видимые цели) → ×(1 + AIM_FLICK); кто держал угол / заходил с прицелом — меньше
  var settle = Math.max(0, 1 - (cs - effReaction)/24);
  var aimS = aimSigma(shooter, target, dist) * (1 + AIM_FLICK * settle * Math.min(shooter._preAim||1, (shooter._reactMul||1) < 1 ? 0.35 : 1));
  if(BAL.hitbox) recoilErr *= 0.3; // (6) отдача теперь — паттерн (ниже), тут только её "шум"
  var rest2 = recoilErr*recoilErr + spamErr*spamErr + aimS*aimS + 0.5*aimD*aimD, sM = 1;
  if(shooter.onStairs) sM *= 2.2;
  // AWP в упор — ноускоп: без прицела, быстро, но разброс большой
  var noscope = BAL.awpClose && w.key === "AWP" && dist < 230;
  if(noscope) sM *= 2.4;
  if(prefire) sM *= BAL.prefireStrict ? 1.6 + 1.8*(1-prefireConfidence) : 1.3 + 1.4*(1-prefireConfidence);
  if(thruSmoke) sM *= 3.2;   // не видит цель — стреляет по памяти, почти вслепую
  if(shooter.atPost && shooter.curSpeed < 10) sM /= BAL.holdAcc;
  if(w.scoped && shooter.curSpeed < 10 && dist > 300) sM *= 0.8; // AUG/SG в прицеле на дистанции
  var sigma = Math.sqrt(wSpread*wSpread + rest2) * sM;
  // (Б4, контрстрейф) стрелять сейчас или сначала погасить скорость: игрок жмёт, когда попасть в корпус на ходу почти так же
  // вероятно, как стоя (не ниже FIRE_K от этого) — вблизи цель большая, и на ходу попадает (пистолет, ПП стреляют с бега),
  // вдали — сначала остановка. Иначе ждёт, пока сбросит скорость (контрстрейф — fightStrafe)
  var w0 = shotSpread(shooter, 0), sig0 = Math.sqrt(w0*w0 + rest2) * sM;
  var pBody = function(sg){ return 1 - Math.exp(-(bA*bA)/(2*sg*sg)); };
  if(wSpread > w0 && pBody(sigma) < FIRE_K * pBody(sig0)){ fireReady(shooter, target, 0); return; }
  shooter._fire = null;
  shooter.burstCount = burstIdx + 1;
  shooter.lastShotTick = tick;
  target._shotAtT = tick; target._shotAtBy = shooter;
  shooter.nextShotTick = tick + w.fireIntervalTicks;
  shooter.ammo--;
  shooter._heat = heat + 1;
  var pIn = function(R){ return 1 - Math.exp(-(R*R)/(2*sigma*sigma)); };
  var seedS = tick*104729 + shooter.id.charCodeAt(0)*31 + shooter.id.length*7 + target.id.charCodeAt(0)*17 + Math.floor(shooter.nextShotTick*8);
  // сильные игроки чаще целятся в голову; AWP — всегда в корпус
  var pAimHead = 0.25 + 0.45*Math.max(0, Math.min(1, (sk-0.8)/0.4));
  // первые пули на появление: если прицел стоял на угле и на уровне головы —
  // целит в голову куда чаще (ваншот "на выходе"); если доводил прицел — в тело
  if(BAL.duelPlace && burstIdx <= 1 && shooter._place != null){
    pAimHead = Math.min(0.92, pAimHead * (0.45 + 0.9*shooter._place) * (0.6 + 0.6*(shooter._headLvl||0.7)));
  }
  if(BAL.hitbox) pAimHead *= (BAL.hbHead || 0.75);
  // (Б4) с пистолетом целятся в голову чаще (тап в голову): у про голова среди попаданий пистолетом 33–38 %, винтовкой 13–24 %
  // (Mirage, видимые цели, b4_shots.py); у ботов было 15–20 % и 18–20 % → множитель подобран по этому отношению (проектное число
  // по демкам, первый кандидат на уточнение)
  if(w.slot === "secondary") pAimHead = Math.min(0.95, pAimHead * AIM_HEAD_PISTOL);
  if(BAL.hitbox && burstIdx >= 3) pAimHead *= 0.35; // спрей — в корпус: отдача сама тянет в голову
  if(w.key === "SSG") pAimHead = Math.max(pAimHead, 0.8); // скаут — в голову (корпус не убивает)
  var aimHead = w.key !== "AWP" && hashRand(seedS+5) < pAimHead;
  // (v241) целится в то, что видно: голова за укрытием не видна — в тело; видна только голова — в голову
  var vParts = visParts(shooter.x, shooter.y, shooter.crouching, target.x, target.y, target.crouching, undefined, shooter.z, target.z);
  if(!vParts.head && vParts.body) aimHead = false; else if(vParts.head && !vParts.body) aimHead = true;
  // (М149, владелец 20.10) видно только плечо (цель за углом или ящиком) — целится в него, а цель это замечает: по ней стреляют,
  // а сама она стрелка целиком не видит — у неё есть время уйти за укрытие или занять место получше (fightCycleTick)
  var aimSide = vParts.side || 0;
  if(aimSide){ aimHead = false; target._shoulderShot = {t: tick, by: shooter}; }
  var pHead, pAny, headshot, hit, hbZone = null;
  if(BAL.hitbox){
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
    var ux = aimSide*VIS_SHOULDER + ex/u1, uy = aimY + ey/u1;   // (М149) поперёк — от видимого плеча
    var hDev = ex;   // (v289) настоящая ошибка вбок, рад — по ней летит трассер промаха
    if(Math.hypot(ux, uy-hH) < 5.5) hbZone = "head";
    else if(uy >= hH-20*kC && uy < hH-6*kC && Math.abs(ux) < 15) hbZone = "chest";
    else if(uy >= hH-30*kC && uy < hH-20*kC && Math.abs(ux) < 13) hbZone = "stomach";
    else if(uy >= 0 && uy < hH-30*kC && Math.abs(ux) < 10) hbZone = "legs";
    // (v241) пуля в точку модели, которую закрывает укрытие / уступ / край пола, — уходит в укрытие (геометрия карты)
    // (v375, отметка владельца: «стреляют в упор и не убивают, выстрелили всю обойму» — T2 на ящике Tetris, z −50, а пол под ним
    // −164: проверка пули шла от пола под ногами, не от бота — пули «уходили в ящик», хотя видимость (visParts) считалась по z)
    // высота — та же, что у видимости: бота (z), иначе пол под точкой
    if(hbZone){ var fz0 = visFloorAt(shooter.x, shooter.y, shooter.z), fz1 = visFloorAt(target.x, target.y, target.z);   // то же правило, что в visParts
      if(shooter.z != null && Math.abs(fz0 - shooter.z) > JUMP_UP) fz0 = shooter.z; if(target.z != null && Math.abs(fz1 - target.z) > JUMP_UP) fz1 = target.z;
      var vz0 = fz0 + (shooter.crouching ? VIS_EYE.crouch : VIS_EYE.stand);
      // (М149) пуля летит в свою точку и поперёк линии (ux): в плечо, видное из-за угла, — попадает, в середину за углом — нет
      var bL = Math.hypot(target.x - shooter.x, target.y - shooter.y) || 1, bk = ux / PX_UNITS / bL;
      var bx = target.x - (target.y - shooter.y)*bk, by = target.y + (target.x - shooter.x)*bk;
      if(!visMarch(shooter.x, shooter.y, vz0, bx, by, fz1 + Math.max(4, uy))) hbZone = null; }
    headshot = hbZone === "head"; hit = !!hbZone;
  } else {
  if(aimHead){ pHead = pIn(hA); pAny = pIn(bA*1.25); }
  else { pAny = pIn(bA*1.6); pHead = 0.10*pAny; }
  var r = hashRand(seedS);
  headshot = r < pHead; hit = r < pAny;
  }
  var endX = target.x, endY = target.y, hitZone = null;
  if(hit){
    var base = w.dmg * Math.pow(w.rm, dist*PX_UNITS/500);
    var zr = hashRand(seedS+11), mult, armored;
    if(headshot){ mult = 4; armored = target.helmet; hitZone = "head"; }
    else if(hbZone === "legs"){ mult = 0.75; armored = false; hitZone = "legs"; }
    else if(hbZone === "stomach"){ mult = 1.25; armored = target.armor; hitZone = "stomach"; }
    else if(hbZone === "chest"){ mult = 1.0; armored = target.armor; hitZone = "chest"; }
    else if(zr < 0.22){ mult = 0.75; armored = false; hitZone = "legs"; }   // ноги броня не закрывает
    else if(zr < 0.42){ mult = 1.25; armored = target.armor; hitZone = "stomach"; }
    else { mult = 1.0; armored = target.armor; hitZone = "chest"; }
    var dmg = Math.max(1, Math.round(base * mult * (armored ? w.armorPen : 1)));   // ожидаемый урон в HP (для логов); сам урон — applyDamage
    target._hurtT = tick;
    if(BAL.tagging) target._tagUntil = tick + 16; // попали — на ~0.25с замедлен
    target._hitFx = {t:nowTs, head:headshot};
    if(BAL.duelPlace && headshot && burstIdx === 0 && (shooter._place||0) > 0.8 && target.hp <= dmg && hashRand(seedS+29) < 0.5) logEvent(shooter.id+": прицел стоял на угле — хэдшот с первой пули по "+target.id);
    if(SND && SND.on) sndBody(headshot ? (target.helmet ? "hshelm" : "hs") : (target.armor ? "kevlar" : "body"), target.x, target.y);
    var killed = applyDamage(shooter, target, base * mult, "bullet", {armorRatio: armored ? w.armorPen : null, wkey:w.key, hs:headshot, reward:w.killReward||300, mods:{blind: shooter.blindUntil > tick, smoke: thruSmoke || smokeOnLine(shooter.x, shooter.y, target.x, target.y)},
      note:(headshot?" (в голову)":"")+" (дист. "+Math.round(dist)+", +$"+(w.killReward||300)+")"});
    if(BAL.hurtCall && !killed){
      var HT = teamIntel[shooter.team].hurt || (teamIntel[shooter.team].hurt = {});
      var prevH = HT[target.id];
      HT[target.id] = {hp:target.hp, tick:tick, by:shooter.id};
      if(target.hp <= 40 && (!prevH || prevH.hp > 40)) voiceLog(shooter.team, "hurt"+target.id, shooter.id, target.id+" на "+target.hp+"!");
    }
    if(killed){
      // раздел 12: "засвет" — после килла позиция стрелка известна врагу; если
      // он держал точку, а рядом ещё живые враги, — на несколько секунд уходит
      // на соседнюю позицию, а не ждёт трейда на том же месте
      shooter._exposedUntil = tick + 4*TICK_HZ;
      var postKill = BAL.awpRepos || BAL.styles ? afterKillMove(shooter, target, w) : false;
      if(!postKill && BAL.repos && shooter.atPost && shooter.post && shooter.post.hold && !shooter.planting && !shooter.defusing &&
         bots.some(function(o){ return o.alive && o.team === target.team && Math.hypot(o.x-shooter.x, o.y-shooter.y) < 900; })){
        var alt = pickSpots("repos"+Math.round(shooter.post.x/30)+","+Math.round(shooter.post.y/30), shooter.post, 3,
          {rMin:55, rMax:170, minGap:40, see: shooter.post.look ? [shooter.post.look] : [], hideFrom:[{x:target.x, y:target.y}]});
        var ap = alt[hashRand(tick + shooter.id.charCodeAt(0)) < 0.5 ? 0 : Math.min(1, alt.length-1)];
        if(ap && Math.hypot(ap.x-shooter.post.x, ap.y-shooter.post.y) > 40){
          var lk = shooter.post.look;
          shooter._reposUntil = 0;
          setPost(shooter, ap, lk, true, "repos"); if(BAL.awpRepos || BAL.styles) leaveHold(shooter);
          shooter._reposUntil = tick + 5*TICK_HZ;
          logEvent(shooter.id+": после килла меняет позицию");
        }
      }
    }
  } else {
    // AWP промахнулся, враг близко — не ждёт перезатвора, а достаёт пистолет
    if(BAL.awpClose && w.key === "AWP" && dist < 280 && target.alive && shooter.secondary && hashRand(seedS+41) < 0.6 && pistolSwap(shooter)) logEvent(shooter.id+" (AWP): промах вблизи — на пистолет");
    // промах: пуля уходит мимо на величину реальной ошибки и летит дальше
    // цели до первой стены (раньше трассер обрывался в воздухе у цели)
    var dx = target.x-shooter.x, dy = target.y-shooter.y;
    var ang = Math.atan2(dy,dx);
    // (v289, И29, владелец 14.10: «вблизи стреляют прям вообще мимо») промах летит по настоящей ошибке выстрела (хитбоксы):
    // над головой / между зонами / в край укрытия — почти через силуэт, вбок — на сколько ушла пуля. Раньше любой промах
    // рисовался вбок не меньше ширины тела +15 % (на 30 px — от 12°), и по этой же линии считалась шальная пуля
    var dev;
    if(hDev !== undefined) dev = hDev;
    else { var sgn = hashRand(seedS+3) < 0.5 ? -1 : 1; dev = sgn * (bA*1.15 + Math.abs(hashRand(seedS+7)-0.5)*2*sigma); }
    var far = Math.min(w.range, Math.hypot(dx,dy)*1.6 + 60);
    var ex = shooter.x + Math.cos(ang+dev)*far, ey = shooter.y + Math.sin(ang+dev)*far;
    var cl = rayClipWalls(shooter.x, shooter.y, ex, ey);
    endX = cl.x; endY = cl.y;
    // (v263, Б1) промах летит дальше и попадает в того, кто на его пути, — в своего тоже (урон по своим — в applyDamage).
    // Куда попала — по той же доле зон, что и без хитбоксов; урон — оружия на дистанции до него
    var sv = bulletVictim(shooter, endX, endY, target);
    if(sv){
      var sd = Math.hypot(sv.x-shooter.x, sv.y-shooter.y), sz = hashRand(seedS+13);
      var sm = sz < 0.22 ? 0.75 : (sz < 0.42 ? 1.25 : 1.0), sArm = sz >= 0.22 && sv.armor;
      var sdmg = w.dmg * Math.pow(w.rm, sd*PX_UNITS/500) * sm;
      sv._hurtT = tick; sv._hitFx = {t:nowTs, head:false}; if(BAL.tagging) sv._tagUntil = tick + 16;
      applyDamage(shooter, sv, sdmg, "bullet", {armorRatio: sArm ? w.armorPen : null, wkey:w.key, reward:w.killReward||300, note:" (шальная пуля, дист. "+Math.round(sd)+")"});
      endX = sv.x; endY = sv.y;
    }
  }
  tracers.push({wc:tracerClass(shooter.weapon), x1:shooter.x, y1:shooter.y, x2:endX, y2:endY, team:shooter.team, born:nowTs, hit:hit, head:headshot, prefire:prefire, miss:!hit, zone:hitZone});
  if(SND && SND.on) sndShot(shooter.weapon, shooter.x, shooter.y);
  // выстрел слышно далеко (шаг 5: с конусом обзора боты не видят спиной —
  // но разворачиваются на звук стрельбы; в кого попали — точно знает откуда)
  bots.forEach(function(o){
    if(!o.alive || o.team === shooter.team) return;
    var dG = Math.hypot(o.x-shooter.x, o.y-shooter.y);
    if(o === target){ o.heardSound = hearReal(o, {x:shooter.x, y:shooter.y, tick:tick, team:shooter.team, src:shooter.id, kind:"hit"}); return; }
    // слышимость выстрела: на прямой видимости дальше, через стены глуше
    // (раньше было 900px во все стороны — слышали полкарты)
    var hearR = (hasLOS(o.x, o.y, shooter.x, shooter.y, o.z, shooter.z) ? GUN_HEAR_OPEN : GUN_HEAR_WALL) * (w.silenced ? 0.55 : 1); // глушитель — слышно ближе
    if(dG < hearR){
      var jg = 15 + dG*0.06, ja = hashRand(tick*17 + o.id.charCodeAt(0)*7 + shooter.nextShotTick)*Math.PI*2;
      var hpS = hearPos(o, shooter.x, shooter.y, tick*17 + o.id.charCodeAt(0)*7 + (shooter.nextShotTick|0), hearR === GUN_HEAR_WALL);
      o.heardSound = hearReal(o, hpS ? {x:hpS.x, y:hpS.y, tick:tick, team:shooter.team, src:shooter.id, kind:"shots", occl:hearR === GUN_HEAR_WALL}
                         : {x:shooter.x+Math.cos(ja)*jg, y:shooter.y+Math.sin(ja)*jg, tick:tick, team:shooter.team, src:shooter.id, kind:"shots"});
    }
  });
  if(tracers.length > 60) tracers.shift();
  if(prefire) logEvent(shooter.id+": префайр по памяти о "+target.id+" (увер. "+Math.round(prefireConfidence*100)+"%)"+(hit?" — попал":""));
}

var STATE_LABEL = {patrol:"патруль", hold:"держит угол", engage:"атакует", retreat:"отступает"};
// (v154) обстановка для решения о дуэли
// (v248) дистанция размена — из демок: в 80 % разменов про разменявший был не дальше стольких ед. карты от места
// смерти своего (tools/trade_bake.py → src/data/trades.json, 92 демки). Одно число на «есть ли кому разменять»
var TRADE_R = 272;
function duelContext(bot, enemiesSeen, alliesNear){
  var o = {trade:0, up:false, forced:false, hurtFoe:false, awpLine:false, flashed:false};
  bots.forEach(function(m){ if(m !== bot && m.alive && m.team === bot.team && Math.hypot(m.x-bot.x, m.y-bot.y) <= TRADE_R) o.trade++; });
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
    o.hurtFoe = !!(hk && hk.hp <= 40 && tick - hk.tick < 8*TICK_HZ) || e.hp <= 40;
    o.awpLine = !!(e.weapon && e.weapon.key === "AWP");
    o.flashed = tick < (e.blindUntil || 0);
  }
  return o;
}
