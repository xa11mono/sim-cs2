// [хозяева: freezeLookTick, handTurn, lookFace, lookReset, lookTick, lookTrack, lookTurnBy] (15.11, перестройка, фаза 3 — канал взгляда, шаг 1: перенос без смены поведения) ПОВОРОТ БОТА — одно место.
// Поле b.facing пишет только этот файл: куда смотреть (арбитр lookArbiter, 270) → как повернуться (рука handTurn, ведение цели lookTrack),
// взгляд во фризе (freezeLookTick). Остальные системы не пишут b.facing, а зовут интерфейс канала (rebuild/DEVICE.md §3а):
//   lookFace(b, угол, причина)   — повернуть сразу к углу (бросок гранаты, первый тик, разминка, демо-вид)
//   lookTurnBy(b, угол, причина) — довернуть на угол (взгляд по ходу на бегу, 540)
//   lookReset(b)                 — сброс к новому раунду (round)
// Причина последней записи извне — b._faceWhy. Код ниже перенесён дословно из engagements.js (resolveEngagements, lookTrack, handTurn)
// и tick.js (фриз); порядок вызовов в тике тот же (lookTick — из resolveEngagements, freezeLookTick — из stepTick).
function lookFace(b: Bot, a: Angle, why: string): void{ b.facing = a; b._faceWhy = why; }
function lookTurnBy(b: Bot, d: Angle, why: string): void{ b.facing! += d; b._faceWhy = why; }   // тип: доворот — после первой записи взгляда (lookTick, freezeLookTick), как в .js
function lookReset(b: Bot): void{ b.facing = undefined; b._faceWhy = "reset"; }

var AIM_TRACK_BAND = 0.03;   // рад (≈ 1,7°) — меньше прицел в бою не доводит (проектное число; конус выстрела вдали — 0,05)
var AIM_TRACK_MIN = 0.002;   // рад за тик — меньше не доворачивает при ведении цели (≈ 7°/с; проектное число)
var HAND_FIGHT = Math.PI/4;   // рад (45°): в бою с этого угла — рывок рукой, меньше — ведение цели (как граница рывка FLICK до В147: с 5° первая пуля — с места 75 % против 33 % у про)

function lookTick(): void{
  // приоритет: видимый враг → (если держит угол) свежая память "враг был тут"
  // → свежий звук шагов → иначе направление движения (ставится в движении).
  // Поворот — рукой (handTurn, по демкам), стрелять можно только когда прицел уже почти на цели (AIM_FIRE_CONE) — отсюда
  // естественная задержка "развернулся → выстрелил", когда враг появился сбоку/сзади.
  // (v291, И32, владелец 14.10: раунд 1, тик 3087 — игрок 6 убил в T Lower и отвернулся на Mid «как у про», пока второй T стоял
  // в 35 px от убитого) после фрага оценка взгляда стрелка пересчитывается сразу, а не через до 8 тиков
  if(BZ.ids.length){
    if(tick % 8 === 0){ lookPlan("CT"); lookPlan("T"); LOOK_REPLAN.CT = LOOK_REPLAN.T = false; }
    else ["CT","T"].forEach(function(t){ if(LOOK_REPLAN[t]){ LOOK_REPLAN[t] = false; lookPlan(t); } });
  }
  bots.forEach(function(b){
    if(!b.alive) return;
    // (v381, М126 шаг 4) куда смотреть — одно место: арбитр взгляда (look.js, LOOK_LEVEL); враг виден — верхний уровень
    var look: P2 | null;
    if(b._sawEnemy && b._nearestEnemyBot) look = lookApply(b, {pt: b._nearestEnemyBot, lvl: LOOK_LEVEL.enemy, kind: "enemy", C: null});   // враг виден — верхний уровень, запись — у исполнения арбитра (look)
    else look = lookArbiter(b);
    var LD: LookDebug | null = LOOKDBG.on ? {tick: tick, reason: b.lookReason || null, raw: look ? {x: look.x, y: look.y} : null, steps: []} : null;
    var LF = lookFilter(b, look, LD), slUrg = LF.urgent; look = LF.look;
    if(LD){ LD.final = look ? {x: look.x, y: look.y} : null; LD.reasonFinal = b.lookReason || null; b._ld = LD; }
    b.lookTarget = look ? {x:look.x, y:look.y} : null;
    // (v153) бросает гранату — смотрит туда, куда кинул, пока бросок не закончен
    // (раньше за 0,2с после броска взгляд щёлкал обратно — самый частый "рывок")
    if(look && b.throwUntil && tick < b.throwUntil && !b._sawEnemy) look = null;
    if(look){
      var want = DM.atan2(look.y-b.y, look.x-b.x);
      if(b.facing === undefined) b.facing = want;
      var dd = want - b.facing;
      dd = ((dd + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
      // (В147) точка та же, что тиком раньше (не враг на виду — он двигается сам), рука не занята (не рывок и не пауза после него) — тело сдвинулось
      // (качание A/D на месте, шаг мимо угла) или точка ползёт: взгляд поворачивается ровно на этот сдвиг, рывок руки — только на остаток
      // (новое намерение, доводка). Было: каждый сдвиг тела на 2° — рывок, пауза, доводка: стоя 30 мелких поворотов в минуту против 9 у про,
      // шагом 61 против 39 (turn_rate.py); с ведением «как в бою» (запаздывание AIM_LAG) у близкой точки отставание 3–4° — рывок с перелётом
      // «та же» — направление на неё сдвинулось меньше AIM_TRACK_BAND (точка «из-за угла» сдвигается сама, пока бот идёт)
      var W0 = b._lkW, same = !b._sawEnemy && W0 && W0.t === tick - 1 && _angOff(want, DM.atan2(W0.y - b.y, W0.x - b.x)) < AIM_TRACK_BAND;
      b._lkW = {x: look.x, y: look.y, w: want, t: tick};
      var hBusy = b._hand && tick < b._hand.t0 + b._hand.T + b._hand.gap;
      if(same && !hBusy){ var dr = want - W0!.w; dr = DM.atan2(DM.sin(dr), DM.cos(dr)); b.facing += dr; dd -= dr; }   // мышь едет вместе со сдвигом (тип: same истинно только при W0 (условие строкой выше))
      if(slUrg){
        // (В147) поворот к врагу — рукой (handTurn, модель «перестрелка» из демок): рывок с колоколом скорости, промах, пауза, доводка.
        // Прицел, ушедший меньше AIM_TRACK_BAND, стоит (в бою прицел про неподвижен ~50 % времени). Было: рывок FLICK (> 45°, проектные
        // числа) и ведение цели с запаздыванием AIM_LAG (доворот 12 % остатка за тик) — длинный хвост поворота (мерка формы: время поворота
        // в перестрелке — разница 45–81 %). AIM_LAG остаётся в расчёте попадания (shoot)
        // большой поворот к врагу (≥ HAND_FIGHT, 45°) — рукой с промахом и паузой; меньше — ведение цели (ниже). Рука на каждый уход ≥ 1,7°
        // давала прицел неподвижен 70 % против 50 % у про и первую пулю с места 75 % против 33 % (run.sh 14.11)
        // (отметка владельца 18.11, м5 р2 т8883, CT3) рывок, начатый к другой точке, — враг появился в стороне больше HAND_FIGHT от того, куда
        // рывок довезёт: рывок прерывается (человек доводит руку к новой цели), а не довозится до конца — было: CT3 вёл прицел на 183°,
        // враг на 347°, рука ещё 20 тиков уводила взгляд от врага
        if(b._sawEnemy && b._hand && tick < b._hand.t0 + b._hand.T){ var rem = 0; b._hand.segs.forEach(function(g){ rem += g.A*(1 - (g.s || 0)); });
          if(_angOff(b.facing + rem, want) > HAND_FIGHT){ b._hand = null; dd = want - b.facing; dd = ((dd + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; } }
        var hA = b._hand && b._hand.f && tick < b._hand.t0 + b._hand.T + b._hand.gap;
        if(Math.abs(dd) >= HAND_FIGHT || hA){ b._aimFix = true; handTurn(b, dd, "f"); if(b._hand) b._hand.f = true; }
        else {
          // (В147) ведение цели — короткими рывками-колоколами подряд (прерывистое слежение человека: Miall, Weir, Stein 1993 — 2–3
          // подвижки в секунду), длительность — по модели «перестрелка» из демок, без промаха и паузы. Было: непрерывное ведение с запаздыванием —
          // у ботов в бою 72 поворота в мин против 140 у про, длительность — медиана 10 тиков против 6 (мерка формы)
          var hT = b._hand && tick < b._hand.t0 + b._hand.T;
          // порог подвижки — как у руки вне боя (2°); меньше — медленное ведение между подвижками (у про в бою прицел движется половину времени)
          if(hT || Math.abs(dd) >= HAND_START){ b._aimTrk = false; b._aimFix = true; handTurn(b, dd, "f", true); } else lookTrack(b, dd);
        }
      }
      else {
        // (v153) вне боя: плавно, с торможением к цели, не быстрее ~260°/с;
        // стоя мелкие поправки (<3°) не делаем — прицел стоит, а не дрожит
        // (v575, В140) и на ходу: поправка — порцией, когда точка уехала больше чем на 3°, до конца (≤ 0,6°). Было: на ходу точка из-за угла
        // (cornerLook) сдвигалась каждый тик и прицел доворачивался непрерывно — неподвижен 35 % на шаге и 36 % на бегу, у про 55 / 52 %
        // (В147, владелец 14.11: «как поворачивается кружочек — точь-в-точь как у про») поворот — рукой (handTurn): рывок с колоколом скорости,
        // длительность по углу, промах и пауза перед доводкой — из демок (MAP.turnmodel). Было: затухание SL.ease с потолком SL.calmRate —
        // ровный медленный разворот (мерка формы tools/motion/motion_shape.py: угол / время / пик поворота вне боя — разница 81 / 63 / 67 %)
        b._aimTrk = false;
        if(Math.abs(dd) >= HAND_START) b._aimFix = true; else if(Math.abs(dd) <= 0.01) b._aimFix = false;
        handTurn(b, dd, "n");
      }
    }
  });
}

// (В147) медленное ведение цели в бою между подвижками (уход < HAND_START): порог AIM_TRACK_BAND, запаздывание AIM_LAG — у про в бою прицел
// движется половину времени
function lookTrack(b: Bot, dd: number): void{
  if(Math.abs(dd) >= AIM_TRACK_BAND) b._aimTrk = true; else if(Math.abs(dd) <= AIM_TRACK_BAND/5) b._aimTrk = false;
  if(b._aimTrk){ var tr = Math.max(AIM_TRACK_MIN, Math.abs(dd)*(1 - DM.exp(-1/(AIM_LAG*TICK_HZ)))); b.facing! += Math.max(-tr, Math.min(tr, dd)); }   // тип: lookTrack зовётся из lookTick после записи взгляда (строка 43)
  b._aimFix = false;
}
// (В147) «рука» — как человек ведёт мышь к цели: рывок (мин. рывок: s = 10τ³ − 15τ⁴ + 6τ⁵ — колокол скорости) за T тиков на угол
// цели с промахом (перелёт / недолёт — доля угла), потом пауза, и только потом — доводка следующим рывком, если осталось больше порога.
// Длительность, промах, доля перелётов, пауза — по корзинам угла из демок карты (MAP.turnmodel, tools/measure/motion/pro_turn_model.py),
// отдельно вне боя (n) и в перестрелке (f); внутри квартилей — жребий (hashRand). Цель сдвинулась во время рывка — рывок доводится как был.
// Рука пишет только b.facing и только отсюда (хозяин поворота — resolveEngagements); состояние рывка — b._hand
var HAND_ERR_MAX = 0.6, HAND_ERR_MAX_F = 0.35;   // в бою недолёт меньше: у про доля угла доводки в бою — медиана 0,17–0,34 (pro_turn_model), большие — уже новое намерение   // доля угла: больше — у про это уже новое намерение, а не промах (проектное число)
var HAND_START = 0.035;   // рад (2°): с какого ухода цели рука начинает рывок — подбор по частоте мелких (< 5°) поворотов про стоя / шагом (9 / 39 в мин): при 0,05 (2,9°) у ботов 5 / 28, при 0,02 — 37 / 77
function handQ(q: Quartiles | undefined, u: number, lo: number, hi: number): number{   // жребий u ∈ [0, 1] по квартилям q = [q25, q50, q75]; края — до lo·q25 и hi·q75
  if(!q) return 0;
  var P = [[0, q[0]*lo], [0.25, q[0]], [0.5, q[1]], [0.75, q[2]], [1, q[2]*hi]];
  for(var i = 1; i < P.length; i++) if(u <= P[i][0]) return P[i-1][1] + (P[i][1] - P[i-1][1])*(u - P[i-1][0])/(P[i][0] - P[i-1][0]);
  return P[P.length-1][1];
}
function handTurn(b: Bot, dd: number, ctx: string, trk?: boolean): void{   // trk — подвижка ведения цели: без промаха и паузы
  var H = b._hand;
  if(H && tick < H.t0 + H.T){   // рывок идёт: сумма колоколов (составной поворот, возврат после перелёта)
    H.segs.forEach(function(g){ var a = tick - g.t0 + 1; if(a < 1 || a > g.T) return; var tau = a/g.T, s = tau*tau*tau*(10 - 15*tau + 6*tau*tau);
      b.facing! += g.A*(s - (g.s || 0)); g.s = s; });   // тип: handTurn зовётся из lookTick после записи взгляда (строка 43)
    return;
  }
  if(H && !H.end) H.end = tick;
  if(H && tick < H.end + H.gap) return;   // пауза перед доводкой
  if(!b._aimFix) return;                  // прицел стоит (порог — как был)
  var TM = MAP.turnmodel, deg = Math.abs(dd)*180/Math.PI;
  if(!TM){ var st0 = Math.min(Math.abs(dd), 4.5/TICK_HZ); b.facing! += dd > 0 ? st0 : -st0; return; }   // набора нет — как раньше (потолок 4,5 рад/с) (тип: handTurn — после записи взгляда (строка 43))
  var Bn = TM.bins, bi = 0; while(bi < Bn.length - 2 && deg >= Bn[bi+1]) bi++;
  var bk = Bn[bi] + "-" + Bn[bi+1], M = TM.model[ctx + "|" + bk] || TM.model["n|" + bk], SB: TurnModelSub = (TM.sub || {} as NonNullable<TurnModel["sub"]>)[ctx + "|" + bk] || {};   // тип: пустая таблица подкорзин, если в наборе карты нет sub
  if(!M){ b.facing! += dd; return; }   // тип: handTurn — после записи взгляда (строка 43)
  var k = b.id.charCodeAt(b.id.length-1)*7 + b.id.charCodeAt(0)*3, U = function(n: number): number{ return hashRand(tick*(17 + 12*n) + k + 6*n); };
  // длительность — из угла и пика: у колокола пик = 1,875·угол / T; пик — жребием по квартилям про для этого угла, T — в пределах квартилей
  // длительности про (у мелких доводок про пик ~0,4°/тик — медленный сдвиг, а не рывок)
  var pk = handQ(M.pk, U(0), 0.7, 1.3), Tq = M.T || [2, 3, 4];
  var T = Math.max(2, Math.round(Math.max(Tq[0]*0.7, Math.min(Tq[2]*1.4, 1.875*deg/Math.max(0.05, pk)))));
  // промах: перелёт — с быстрым возвратом (у про — доля SB.pb поворотов, через 1–3 тика, на долю угла SB.bratio); иначе — недолёт в той доле,
  // за которой у про идёт доводка (M.corr — доля рывков, за которыми в 24 тика рывок туда же и меньше, pro_turn_model 15.11; было — любой следующий
  // рывок: лишняя доводка после 60–70 % поворотов), её делает следующий рывок после паузы
  var back = !trk && U(1) < (SB.pb || 0), A = dd, segs: HandSeg[] = [];
  if(back){ var ob = Math.min(HAND_ERR_MAX*deg, handQ(SB.bdeg, U(2), 0.5, 1.2))*Math.PI/180; A = dd + (dd > 0 ? ob : -ob); }   // перелёт — в градусах (демки: 1–8° медиана)
  else if(!trk && U(3) < (M.corr || 0)) A = dd*(1 - Math.min(ctx === "f" ? HAND_ERR_MAX_F : HAND_ERR_MAX, handQ(M.ratio, U(2), 0.5, 1.2)));
  // составной поворот (у про — доля SB.p): два слитных колокола — разгон и основной, второй с доли SB.at длительности, на долю угла SB.share
  if(!trk && T >= 4 && U(4) < (SB.p || 0)){
    var at = handQ(SB.at, U(5), 0.8, 1.2), sh = handQ(SB.share, U(6), 0.9, 1.05), t2 = Math.max(1, Math.round(at*T));
    segs.push({t0: tick, T: Math.max(2, Math.min(T, Math.round(t2*1.25))), A: A*(1 - sh)}); segs.push({t0: tick + t2, T: Math.max(2, T - t2), A: A*sh});   // первый кончается чуть позже начала второго — провал скорости между пиками, как у про
  } else segs.push({t0: tick, T: T, A: A});
  var Tend = T;
  if(back){ var bg = Math.max(1, Math.round(handQ(SB.bgap, U(7), 0.7, 1.3))), bT = Math.max(2, Math.round(T*0.4));
    segs.push({t0: tick + T + bg - 1, T: bT, A: dd - A}); Tend = T + bg - 1 + bT; }
  b._hand = {t0: tick, T: Tend, segs: segs, end: 0, gap: trk ? 0 : Math.max(1, Math.round(handQ(M.gap, U(8), 0.5, 1.3)))};
  handTurn(b, dd, ctx, trk);
}

// (v322, М14) свободный обзор в закупку: каждый смотрит сам по себе — держит взгляд, потом поворачивает мышь.
// Сколько держат и на сколько поворачивают — из демок про Mirage (25 матчей, фризтайм, взгляд раз в 0,25 с; поворот —
// больше 8° за 0,25 с): держат 0,25 / 0,25 / 1 / 2,5 / 5,75 с, поворот 11 / 21 / 50 / 98 / 145° (10/25/50/75/90 %).
var FREEZE_HOLD = [0.25, 0.25, 1, 2.5, 5.75], FREEZE_TURN = [11, 21, 50, 98, 145], FREEZE_TURN_SPEED = 0.25*Math.PI/16;  // скорость — поворот за ~0,25 с (шаг демок)
function freezePick(q: readonly number[], u: number): number{ var k = Math.min(3, Math.floor(u*4)), f = u*4 - k; return q[k] + (q[k+1]-q[k])*f; }   // доля u → число по процентилям (упрощение)
function freezeLookTick(): void{
  bots.forEach(function(b, i){
    if(!b.alive) return;
    if(!isFinite(b.facing as number)) b.facing = DM.atan2(1024-b.y, 1024-b.x);   // ещё не смотрел никуда — к середине карты (тип: isFinite(undefined) = false — это и есть проверка «взгляда ещё нет»)
    // (v430, М167, владелец: «на закупке крутятся, троятся; на мини-карте нормально») взгляд на начало тика — для сглаживания
    // рисования (draw), как в живом раунде (строка «bot.pfacing» ниже): на закупке не запоминался, и большой радар каждый
    // тик заново проводил взгляд от угла прошлого раунда до нынешнего
    b.pfacing = b.facing;
    var F = b._fz;
    if(!F || F.round !== roundNum){ F = b._fz = {round: roundNum, until: tick, target: b.facing!}; }   // тип: взгляд задан строкой 160
    if(tick >= F.until){
      var seed = roundNum*7919 + i*104729 + tick;
      var turn = freezePick(FREEZE_TURN, hashRand(seed)) * Math.PI/180 * (hashRand(seed+1) < 0.5 ? -1 : 1);
      F.target = b.facing! + turn;   // тип: взгляд задан строкой 160
      F.until = tick + Math.round(freezePick(FREEZE_HOLD, hashRand(seed+2)) * TICK_HZ) + Math.ceil(Math.abs(turn)/FREEZE_TURN_SPEED);
    }
    var d = F.target - b.facing!;   // тип: взгляд задан строкой 160
    b.facing! += Math.max(-FREEZE_TURN_SPEED, Math.min(FREEZE_TURN_SPEED, d));   // тип: взгляд задан строкой 160
  });
}

