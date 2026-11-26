// [хозяева: —] (v575, В140, владелец 13.11: «повтори движение игроков полностью — контрстрейфы, джиглы»; выгрузка каждого тика, 12 демок Mirage,
// tools/motion/motion_ctx.py) вне перестрелки про почти всё время «нажимают» A / D: стоя на угле — 52 смены в минуту, нажатие ~0,11 с, сдвиг ~3 ед.;
// шагом — 46 в минуту, ~0,23 с, ~12 ед.; боты не качались (5,5 смен в минуту всего). Клавиши стрейфа — одно место: бот жмёт сторону по
// расписанию из распределений про (нажатие / пауза, квантили 10/25/50/75/90 %), ход — физикой CS2 (разгон CS_ACCEL, трение CS_FRIC,
// встречная клавиша гасит ход — как стрейф в перестрелке, 470); стоя — не уходит с точки (отъехал дальше KEYS_DRIFT — жмёт обратно).
// Перестрелку ведёт 470 (fightStrafe); бег (≥ 200 ед./с) — без качания (у про 10 в минуту)
// (12 демок Mirage, tools/motion/motion_ctx.py; пауза — вся, включая длинные; same — доля нажатий в ту же сторону, что прошлое)
var KEYS_PRO = {hold: {press: [0.047, 0.078, 0.109, 0.188, 0.422], gap: [0.0, 0.016, 0.078, 0.219, 0.625], same: 0.35}};
// (v583a, Д8, владелец 17.11: «игроки, когда идут, виляют как змейка — чуть вправо, чуть влево; так быть не должно») качание A / D на ходу
// убрано (было v575: шагом — 46 смен в минуту по выгрузке 12 демок, KEYS_PRO.walk, в половине отрезков ходьбы KEYS_WALK_ON = 0,55):
// на ходу A / D только по делу (пик, стрейф в перестрелке — 470), стоя на угле — как было
var KEYS_DRIFT = 22/PX_UNITS;   // ед. → px: стоя дольше 2 с про отходят от середины места не дальше 22 ед. (медиана наибольшего отхода, 1127 отрезков, 12 демок) — дальше жмёт обратно
function keysRand(b, salt){ return hashRand(tick*37 + b.id.charCodeAt(0)*13 + b.id.charCodeAt(b.id.length-1)*29 + salt); }
function strafeKeysTick(b, dt){
  var J = b._keys || (b._keys = {key: 0, until: 0, v: 0, last: 1, ax: null, ay: null, ctx: null});
  var sp = (b.curSpeed || 0)*PX_UNITS, ctx = null;
  if(roundState === "live" && b.alive && !b._fc && !b._boost && !b.planting && !b.defusing && tick >= (b.throwUntil || 0) && !b._climb && !b.onLadder && !b._sbOff){
    // (v575, замер 8 матчей: переносов 21 → 62 на 48 раундов) стоя — только когда дошёл (пути нет): качание у конца пути сбивало бота с края пола
    if(sp < 100 && !(b.path && b.pathIdx < b.path.length) && !b._sawEnemy && !(b.post && taskProp(b.post.tag, "holdStrafeSkip")) && !(b.fakeHoldUntil && tick < b.fakeHoldUntil) && !(tick < (b.blindUntil||0))) ctx = "hold"; }
  if(ctx !== J.ctx){ J.ctx = ctx; J.key = 0; J.until = tick; J.ax = b.baseX; J.ay = b.baseY; }
  // (v575, прогон 233: «застрял (plantspot): шаг проходит, а стоит» 0 → 12) точка, от которой качание держит (стоя и на ходу — снос от линии
  // пути тоже не больше KEYS_DRIFT; было: на ходу без предела — нажатия в ту же сторону копили снос), сдвигается вместе с остальным
  // ходом (путь, торможение у конца пути): иначе бот, идущий медленно к точке, отходил от неё дальше KEYS_DRIFT — и качание тянуло назад
  else if(ctx && J.px != null){ J.ax += b.baseX - J.px; J.ay += b.baseY - J.py; }
  J.px = b.baseX; J.py = b.baseY;
  // качание кончилось (увидел врага, задача, бросок) — клавиша отпущена, ход гасит трение (CS2), а не пропадает мгновенно;
  // перестрелку ведёт 470 — она берёт этот ход себе (fightStrafe, начальная скорость)
  if(!ctx && b._fc) return;   // ход качания забрала перестрелка (fightStrafe обнуляет J.v, когда берёт)
  if(!ctx && (!b.alive || roundState !== "live" || b._climb || b.onLadder)){ J.v = 0; return; }
  if(ctx){   // ось — поперёк взгляда (стоя) / хода (идёт); после конца качания — та же ось, пока ход не погаснет
    var a = b.facing !== undefined ? b.facing : 0; J.ux = -DM.sin(a); J.uy = DM.cos(a);
    if(tick >= J.until){
      if(J.key){ J.key = 0; J.until = tick + Math.max(1, Math.round(peekQ(KEYS_PRO[ctx].gap, keysRand(b, 1))*TICK_HZ)); }
      else { var s = keysRand(b, 3) < KEYS_PRO[ctx].same ? J.last : -J.last;
        if(J.ax != null){ var off = (b.baseX - J.ax)*J.ux + (b.baseY - J.ay)*J.uy; if(Math.abs(off) > KEYS_DRIFT) s = off > 0 ? -1 : 1; }
        J.key = s; J.last = s; J.until = tick + Math.max(1, Math.round(peekQ(KEYS_PRO[ctx].press, keysRand(b, 2))*TICK_HZ)); } }
    // (v583a, Д8) снос держится и во время нажатия: ушёл от линии дальше KEYS_DRIFT в сторону нажатия — клавиша отпущена (пауза — по про).
    // Было: предел проверялся только в начале нажатия, нажатие до 0,8 с — снос 27 px (≈ 67 ед.) против ~12 ед. за нажатие у про
    else if(J.key && J.ax != null && ((b.baseX - J.ax)*J.ux + (b.baseY - J.ay)*J.uy)*J.key > KEYS_DRIFT){ J.key = 0; J.until = tick + Math.max(1, Math.round(peekQ(KEYS_PRO[ctx].gap, keysRand(b, 1))*TICK_HZ)); }
  } else { if(!J.v) return; J.key = 0; }
  var ux = J.ux, uy = J.uy;
  var vmax = SPEED*weaponSpeedMul(b)*(b.walking ? WALK_SPEED_FRAC : 1), v = J.v, av = Math.abs(v);   // (v583a, Д8) на шифте в CS2 и вбок не быстрее шага
  if(J.key && v*J.key >= 0) v = J.key*Math.min(vmax, av + Math.max(0, CS_ACCEL*vmax - CS_FRIC*av)*dt);
  else { var dec = (J.key ? csDecel(av, vmax) : CS_FRIC*Math.max(av, CS_STOP/PX_UNITS))*dt; v = av <= dec ? 0 : v - (v < 0 ? -1 : 1)*dec; }
  J.v = v;
  if(Math.abs(v) < 1e-3) return;
  var nx = b.baseX + ux*v*dt, ny = b.baseY + uy*v*dt;
  // (v575, прогон 233: переносов 59 → 156 на 100 раундов Mirage — качание уводило за край навмеша, где стены нет, потом бота возвращало рывком)
  // шаг качания — только внутрь пола навмеша своего уровня, без допуска у края: с края (допуск 3 ед., у связанных участков до 10) новый путь
  // уводил за край (Mirage B Apps, 454,433: участки 1940 / 1960 кончаются на y 426, бот с 428 шёл на 433 — «вне навмеша», перенос)
  var lvK = navArea(b._area) ? navArea(b._area).z : b.z;
  if(stepBlocked(b.baseX, b.baseY, nx, ny, b) || !navNearLevel(nx, ny, 0, lvK)){ J.v = 0; return; }   // упёрся — клавишу не отпускает (у про длинные нажатия на малой скорости — в стену)
  b.baseX = nx; b.baseY = ny; J.px = nx; J.py = ny;
}
