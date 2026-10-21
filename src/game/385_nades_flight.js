// Физика гранаты (В2–В3, 21.10.2026) — ОДИН модуль на полёт гранаты: бросок → дуга → отскоки → разрыв.
// В игре с В3 (бросок — 380_nades_throw: nadeAim; полёт — 400_nades_physics_damage: nadeStep; луч — m3NadeTrace, 035_map3d).
// Здесь нет карты и нет рисования: всё, что модуль знает о мире, — функция trace(A, B) (см. nadeStep). Тот же файл
// берут проверки в node (tools/nades/check.js).
//
// Откуда числа (подробно — docs/reports/NADES.md, «Числа физики»):
//  * устройство броска и полёта — исходники CS:GO (weapon_basecsgrenade.cpp: ThrowGrenade; basecsgrenade_projectile.cpp:
//    ResolveFlyCollisionCustom; baseentity: PhysicsToss / PhysicsAddGravityMove; molotov_projectile.cpp); в CS2 так же,
//    кроме вертикали от игрока (прыжок) и задержки вылета — они из демок;
//  * каждое число проверено бросками про (tools/nades/check.js: точка и время разрыва, 75 тыс. бросков) — помечено «демки»;
//    чего в исходниках нет — подогнано по демкам и помечено «проектное число».
// Единицы — как в игре: ед. (inch), секунды; ось z вверх; yaw/pitch — градусы как в демке (pitch вниз = +).
(function (root) {
  'use strict';
  var P = {
    TICK: 64,              // тиков в секунду (CS2, демки)
    GRAV: 320,             // ед/с²: sv_gravity 800 × гравитация гранаты 0,4 (исходники; демки подтверждают — NADES.md)
    SPEED: 675,            // скорость броска: throw velocity 750 × 0,9 (исходники; демки подтверждают)
    STR_MIN: 0.3,          // сила: скорость × (0,3 + 0,7 × strength); strength 1 — ЛКМ, 0,5 — обе, 0 — ПКМ
    PVEL: 1.25,            // доля скорости игрока по горизонтали, которая добавляется к гранате (исходники; демки 1,19–1,26)
    // вертикаль от игрока (демки; в CS2 не так, как в исходниках CS:GO «× 1,25»):
    JUMP_V: 301.993,       //  прыжок в тот же миг, что бросок (бинд; в демке скорость ещё без прыжка) — sv_jump_impulse
                           //  (демки: подгонка 300–302)
    JUMP_Z: 272,           //  бросок в прыжке (игрок уже поднимается) — постоянная прибавка, от скорости игрока не зависит
                           //  (демки: 270–273; модель «vz × k» хуже: совпадений 30–40 % против 58–68 %) — проектное число
                           //  падение / скаты — 0 (демки: подгонка −0,03…−0,09 × vz)
    AIR_VZ: 60,            // игрок поднимается быстрее 60 ед/с — это прыжок (на земле, на скатах |vz| меньше)
    EYE: 64.06, EYE_DUCK: 46.04,   // высота глаз от ног: стоя / присев (CS2; демки: 63)
    SRC_DZ: 12,            // рука ниже глаз на 12 × (1 − strength) (исходники: vecSrc.z += strength·12 − 12)
    SRC_FWD: 22, SRC_BACK: 6,      // точка вылета: луч от глаз вперёд на 22, граната — на 6 ближе (≈ 16 перед глазами)
    PITCH_LIFT: 10,        // наклон поднимается на (90 − |pitch|) × 10/90 (исходники)
    ELAST: 0.45,           // упругость гранаты (исходники; демки 0,44–0,49); отскок: v ← (v − 2(v·n)n) × 0,45
    STOP_V: 30,            // медленнее 30 ед/с после удара — остановилась (на полу) / прилипла (о стену); демки 29–37
    FLOOR_NZ: 0.7,         // «пол» — нормаль круче 0,7 вверх
    FUSE: { flash: 1.627, he: 1.627 }, // запал от вылета, с (демки: 104,15 тика полёта; разрыв через 110–111 тиков после броска)
    MOLLY_NZ: 0.866,       // молотов рвётся о пол не круче 30° (weapon_molotov_maxdetonateslope 30)
    MOLLY_MAX: 2.0,        // молотов, не коснувшийся пола, рвётся в воздухе через 2 с (molotov_throw_detonate_time)
    SPAWN: 6.3,            // тиков от weapon_fire до вылета (демки: 110,4 − 104,15; молотов в воздухе — через 135–136 ≈ 6 + 2 с)
    PUSH: 0.05,            // после удара граната отодвигается от поверхности на столько (ед.)
    MAXT: 25,              // дольше не считаем (смок, который всё катится)
  };

  var D2R = Math.PI / 180;

  // Бросок: откуда и с какой скоростью вылетает граната.
  // o: {pos:[x,y,z] ноги, yaw, pitch, duck, vel:[vx,vy,vz] игрока, strength 0..1}; trace — как у nadeFly (для точки вылета у стены)
  function nadeLaunch(o, trace) {
    var s = Math.max(0, Math.min(1, o.strength));
    var pit = o.pitch; if (pit > 90) pit -= 360; else if (pit < -90) pit += 360;
    pit -= (90 - Math.abs(pit)) * P.PITCH_LIFT / 90;
    var cp = Math.cos(pit * D2R), yw = o.yaw * D2R;
    var f = [cp * Math.cos(yw), cp * Math.sin(yw), -Math.sin(pit * D2R)];
    var eye = [o.pos[0], o.pos[1], o.pos[2] + (o.duck ? P.EYE_DUCK : P.EYE) + P.SRC_DZ * (s - 1)];
    var end = [eye[0] + f[0] * P.SRC_FWD, eye[1] + f[1] * P.SRC_FWD, eye[2] + f[2] * P.SRC_FWD];
    var h = trace ? trace(eye, end) : null, k = h ? P.SRC_FWD * h.f : P.SRC_FWD;
    k -= P.SRC_BACK;
    var p = [eye[0] + f[0] * k, eye[1] + f[1] * k, eye[2] + f[2] * k];
    var sp = P.SPEED * (P.STR_MIN + (1 - P.STR_MIN) * s), pv = o.vel || [0, 0, 0];
    // вертикаль от игрока: прыжок на бинде — JUMP_V, уже в прыжке (поднимается) — JUMP_Z, иначе — 0
    var vzp = o.jump ? P.JUMP_V : pv[2] > P.AIR_VZ ? P.JUMP_Z : 0;
    var v = [f[0] * sp + pv[0] * P.PVEL, f[1] * sp + pv[1] * P.PVEL, f[2] * sp + vzp];
    return { p: p, v: v };
  }

  // Состояние гранаты в полёте и один тик полёта (игра зовёт nadeStep каждый тик, nadeFly — весь полёт сразу).
  // type: smoke | flash | he | molotov (в игре — molly). trace(A, B) → null (чисто) или {f: доля пути 0..1, n: [nx,ny,nz]
  // нормаль навстречу полёту, sky: bool}. st.how после разрыва: fuse | floor | air | stop | lost | maxt.
  function nadeState(type, p, v) {
    return { type: type, molly: type === 'molotov' || type === 'molly', p: p.slice(), v: v.slice(), t: 0, rest: false,
             bounces: [], how: null };
  }
  function nadeStep(st, trace) {
    var dt = 1 / P.TICK, fuse = P.FUSE[st.type], p = st.p, v = st.v;
    // запал — до шага: граната рвётся там, где она есть в этот тик
    if (fuse !== undefined && st.t >= fuse - 1e-9) return (st.how = 'fuse');
    if (st.molly && st.t >= P.MOLLY_MAX - 1e-9) {
      // разрыв в воздухе: огонь падает на пол под гранатой (inferno_startburn — на полу)
      var hd = trace(p, [p[0], p[1], p[2] - 2000]);
      if (hd) st.p = [p[0], p[1], p[2] - 2000 * hd.f];
      return (st.how = 'air');
    }
    if (st.type === 'smoke' && st.rest) return (st.how = 'stop');
    if (st.rest) { st.t += dt; return st.t >= P.MAXT ? (st.how = 'maxt') : null; }
    // ход с гравитацией: средняя скорость за тик (PhysicsAddGravityMove)
    var vz1 = v[2] - P.GRAV * dt;
    var mv = [v[0] * dt, v[1] * dt, (v[2] + vz1) / 2 * dt];
    v[2] = vz1;
    var frac = 1, guard = 0;
    while (frac > 1e-6 && guard++ < 4) {
      var B = [p[0] + mv[0] * frac, p[1] + mv[1] * frac, p[2] + mv[2] * frac];
      var h = trace(p, B);
      if (!h) { p = B; break; }
      var f = Math.max(0, h.f);
      p = [p[0] + (B[0] - p[0]) * f + h.n[0] * P.PUSH, p[1] + (B[1] - p[1]) * f + h.n[1] * P.PUSH, p[2] + (B[2] - p[2]) * f + h.n[2] * P.PUSH];
      var floor = h.n[2] > P.FLOOR_NZ;
      st.bounces.push([p[0], p[1], p[2], h.sky ? 'sky' : floor ? 'floor' : 'wall']);
      if (st.molly && !h.sky && h.n[2] >= P.MOLLY_NZ) { st.p = p; st.v = v; st.t += dt * (1 - frac + frac * f); return (st.how = 'floor'); }
      // отскок (ResolveFlyCollisionCustom): отражение × упругость
      // (демки: отдельная упругость вдоль поверхности 0,41–0,43 и по материалу 0,9–1,0 ничего не дают — одна на всё)
      var dn = v[0] * h.n[0] + v[1] * h.n[1] + v[2] * h.n[2];
      v = [(v[0] - 2 * dn * h.n[0]) * P.ELAST, (v[1] - 2 * dn * h.n[1]) * P.ELAST, (v[2] - 2 * dn * h.n[2]) * P.ELAST];
      var sp2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
      if (sp2 < P.STOP_V * P.STOP_V) {
        v = [0, 0, 0];
        if (floor) { st.rest = true; break; }
      }
      if (!floor) break;            // от стены: остаток хода в этот тик не доигрывается (как в исходниках)
      frac = frac * (1 - f);        // от пола: остаток хода — с новой скоростью
      mv = [v[0] * dt, v[1] * dt, v[2] * dt];
    }
    st.p = p; st.v = v; st.t += dt;
    if (p[2] < -20000) return (st.how = 'lost');
    if (st.t >= P.MAXT) return (st.how = 'maxt');
    return null;
  }
  // Полёт до разрыва целиком. opt: {path: true — точки по тикам}.
  // Ответ: {det: [x,y,z], t: с от вылета, how, bounces: [[x,y,z,'floor'|'wall'|'sky']], path}
  function nadeFly(type, p, v, trace, opt) {
    var st = nadeState(type, p, v), path = opt && opt.path ? [st.p.slice()] : null;
    while (!nadeStep(st, trace)) if (path) path.push(st.p.slice());
    return { det: st.p.slice(), t: st.t, how: st.how, bounces: st.bounces, path: path };
  }

  // Бросок целиком: o — как у nadeLaunch (+ type); ответ nadeFly + t от weapon_fire (с учётом задержки вылета)
  // o.jump — бросок в тот же миг, что прыжок (в демке скорость игрока ещё без прыжка: «джампбросок» на бинде).
  // Задержка вылета SPAWN тиков (o.spawn — своя, если известна): игрок за это время сдвигается со своей скоростью (вертикаль — как в демке).
  function nadeThrow(o, trace, opt) {
    var spawn = o.spawn !== undefined ? o.spawn : P.SPAWN;
    if (spawn) {
      var tau = spawn / P.TICK, pv = o.vel || [0, 0, 0], air = Math.abs(pv[2]) > P.AIR_VZ;
      o = Object.assign({}, o, { pos: [o.pos[0] + pv[0] * tau, o.pos[1] + pv[1] * tau, o.pos[2] + (air ? pv[2] * tau : 0)] });
    }
    var L = nadeLaunch(o, trace);
    var r = nadeFly(o.type, L.p, L.v, trace, opt);
    r.tFire = r.t + spawn / P.TICK;
    r.p0 = L.p; r.v0 = L.v;
    return r;
  }

  // Как кинуть, чтобы граната разорвалась у цели (бот целится так, как целился бы человек: поворот на цель, наклон и сила).
  // from — ноги [X, Y, Z]; aim — точка [X, Y, Z] (смок / молотов — пол у цели; флешка / HE — над целью); o: {duck, vel, noJump}.
  // Перебор: наклон от −75° до +45° шагом AIM_STEP при каждой силе (ЛКМ, обе, ПКМ), каждый — настоящим полётом (nadeThrow:
  // стены, отскоки, запал, качение); лучший — уточняется наклоном. Не вышло ближе AIM_JUMP_IF — то же с прыжком на бинде
  // (так про кидают дальние смоки); и всё ещё мимо — поворот в сторону на AIM_YAW (обход края, отскок от стены). Ответ — лучший бросок {yaw, pitch, strength, jump, det, t, how, err: ед. по горизонтали,
  // dz, bounces}; null — только если цель на месте бросающего.
  var AIM_STEP = 4, AIM_FINE = [2, 1, 0.5], AIM_JUMP_IF = 48, AIM_YAW = [-3, 3, -7, 7, -12, 12];   // градусы, ед. — проектные числа (скорость ≈ 10 мс на бросок)
  function nadeAim(type, from, aim, trace, o) {
    o = o || {};
    var dx = aim[0] - from[0], dy = aim[1] - from[1];
    if (Math.hypot(dx, dy) < 1) return null;
    var yaw0 = Math.atan2(dy, dx) / D2R, yaw = yaw0, best = null;
    function tryOne(pitch, s, jump) {
      var r = nadeThrow({ type: type, pos: from, yaw: yaw, pitch: pitch, strength: s, duck: o.duck, vel: o.vel, jump: jump, spawn: 0 }, trace);
      var exy = Math.hypot(r.det[0] - aim[0], r.det[1] - aim[1]), dz = r.det[2] - aim[2], sc = exy + Math.abs(dz) * 0.5;
      if (!best || sc < best.sc) best = { yaw: yaw, pitch: pitch, strength: s, jump: !!jump, det: r.det, t: r.t, how: r.how, err: exy, dz: dz,
                                          bounces: r.bounces.length, sc: sc };
    }
    function search(jump) {
      [1, 0.5, 0].forEach(function (s) { for (var pt = -75; pt <= 45; pt += AIM_STEP) tryOne(pt, s, jump); });
      AIM_FINE.forEach(function (st) {
        var b0 = best;
        if (b0.jump !== !!jump) return;
        [-st, st].forEach(function (dp) { tryOne(b0.pitch + dp, b0.strength, jump); });
      });
    }
    search(false);
    if (best.err > AIM_JUMP_IF && !o.noJump) search(true);
    // всё ещё мимо — поворот чуть в сторону (обойти край стены, отскок от стены), наклон — шагом вдвое крупнее
    if (best.err > AIM_JUMP_IF) AIM_YAW.forEach(function (dy_) {
      yaw = yaw0 + dy_;
      for (var pt = -75; pt <= 45; pt += 2 * AIM_STEP) { tryOne(pt, best.strength, best.jump); }
    });
    yaw = best.yaw;
    if (best.yaw !== yaw0) AIM_FINE.forEach(function (st) { var b0 = best; [-st, st].forEach(function (dp) { tryOne(b0.pitch + dp, b0.strength, b0.jump); }); });
    delete best.sc;
    return best;
  }

  var api = { NADE_P: P, nadeLaunch: nadeLaunch, nadeState: nadeState, nadeStep: nadeStep, nadeFly: nadeFly, nadeThrow: nadeThrow, nadeAim: nadeAim };
  for (var k in api) root[k] = api[k];   // игра — глобальные имена
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
