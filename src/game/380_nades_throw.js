// ---------- бросок ----------
// (физика гранат, 30.10.2026) бросок — как у человека: поворот на цель, наклон и сила (ЛКМ / обе / ПКМ), подобранные НАСТОЯЩИМ
// полётом (385_nades_flight: nadeAim — дуга, стены, крыши, отскоки, запал по геометрии игры, m3NadeTrace кубиком гранаты).
// Куда упадёт и долетит ли — решает только физика: прежние навес по прямой к цели (полёт и рисунок — разные дуги), «дуги под
// потолками» (nadeArc / nadeArcClear: у 62–73 % лайнапов про их дуга шла сквозь геометрию) и «упала на крышу» по точке цели удалены.
// Своя граната кидается, если физика доводит её к цели ближе NADE_AIM_OK ед. игры (флешке — вдвое), лайнап (trusted) — лучшим
// броском, если ближе NADE_AIM_OK × 4 (дальше — отсюда туда стоя не кинуть: у про был разбег / прыжок, данных о нём в лайнапе нет).
var NADE_AIM_OK = 100;   // ед. игры (≈ 40 px радара) — проектное число (ветка nades-v398, В3)
var NADE_AIM_DZ = {smoke: 0, molly: 0, flash: 80, he: 20};   // куда целиться по высоте над полом у цели, ед. (проектные числа, В3)
// кэш решений — внутри функции: снимок «Отметить момент» копирует глобальные var, а кэш ему не нужен (и большой)
var nadeAimCache = (function(){ var C = {}, n = 0; return function(k, v){ if(v === undefined) return C[k]; if(++n > 4000){ C = {}; n = 0; } return (C[k] = v); }; })();
function nadeTraceFn(){ var M = m3(); return function(A, B, r){ return m3NadeTrace(M, A, B, r); }; }
// лучший бросок стоя из (x, y) радара с пола z (ед. игры) в точку (tx, ty) радара → решение nadeAim + x, y радара, где сработает
// (той же физикой, что полетит), или null (цель под ногами / нет геометрии). Ошибка e3 — в 3D (флешке высота вдвое легче: ей важно
// хлопнуть на виду). Под целью несколько полов (под балконом, под мостом) — у цели нет высоты: целится в каждый пол, куда можно
// дойти, и берёт тот, куда граната долетает точнее (своя граната под балкон — под балкон, если туда долетает)
// (30.10, ошибка PR #2) кэш — только для ТОГО ЖЕ состояния броска: точное место (x, y, z), присед, перебор; раньше ключ округлялся
// до 4 px и 8 ед. — решение из соседней точки уходило в бросок из другой. vel — (этап 4) скорость бойца в миг броска, ед/с игры
// [vx, vy, vz] (nadeBotVel): та же в подборе и в вылете (×1,25 по горизонтали — 385), и в ключе кэша. guess — готовое решение из
// соседней точки (уточняется рядом с ним, nadeAim o.guess)
function nadeSolve(type, x, y, z, tx, ty, duck, wide, guess, vel){
  var M = m3(); if(!M) return null;
  var key = type+"|"+x+","+y+","+z+"|"+tx+","+ty+(duck ? "d" : "")+(wide ? "w" : "")+(guess ? "|g"+guess.yaw+","+guess.pitch+","+guess.strength+(guess.jump ? "j" : "") : "")+(vel ? "|v"+vel[0]+","+vel[1]+","+vel[2] : "");
  var c0 = nadeAimCache(key); if(c0 !== undefined) return c0;
  var t0 = (typeof performance !== "undefined") ? performance.now() : 0;
  var F = m3Game(M, x, y), T = m3Game(M, tx, ty), fl = nadeAimFloors(M, tx, ty), lv = nadeLandFloors(M, tx, ty), r = null;
  fl.forEach(function(fz){
    var o = {duck: !!duck, wz: type === "flash" ? 0.5 : 1, wide: !!wide, vel: vel || null};
    if(type === "smoke" || type === "molly"){ o.levels = lv; o.levelTol = NADE_LEVEL_TOL; }   // (этаж) смок и огонь — на полу у цели
    if(guess){ o.guess = guess; o.guessOk = guess.levelOk === false ? 0 : guess.e3 + NADE_GUESS_SLACK; o.wide = false; }   // уточнение не вышло — обычный (не широкий) перебор: дешевле
    var q = nadeAim(type, [F[0], F[1], z], [T[0], T[1], fz + (NADE_AIM_DZ[type] || 0)], nadeTraceFn(), o);
    if(q && (!r || q.e3 < r.e3)) r = q; });
  if(r){ var R = m3Radar(M, r.det[0], r.det[1]); r.x = R[0]; r.y = R[1]; }
  if(t0){ NADE_SOLVE_MS.push(performance.now() - t0); if(NADE_SOLVE_MS.length > 500) NADE_SOLVE_MS.shift(); }
  return nadeAimCache(key, r);
}
// (30.10, этап 2) разброс прицела про при повторе одного броска — децили |Δповорота| и |Δнаклона|, ° (0, 10, …, 100 %): демки Mirage +
// Ancient (throws.json), броски стоя с места в 8 ед. в одну клетку разрыва 96 ед., групп ≥ 3 (tools/nades/aim_scatter_pro.py; точность
// углов в демке — 0,1°). Разрыв про при этом: смок p50 7 / p90 33 ед., флешка 8 / 36, HE 5 / 20, молотов 6 / 24
var NADE_AIM_SCATTER = {"smoke":{"yaw":[0.0,0.0,0.0,0.1,0.1,0.1,0.2,0.25,0.4,0.7,4.3],"pitch":[0.0,0.0,0.0,0.1,0.1,0.2,0.2,0.4,0.6,1.2,5.0]},"flash":{"yaw":[0.0,0.0,0.05,0.1,0.2,0.3,0.4,0.65,1.0,1.6,4.6],"pitch":[0.0,0.0,0.1,0.15,0.3,0.45,0.7,1.0,1.45,2.25,5.0]},"he":{"yaw":[0.0,0,0.1,0.15,0.25,0.4,0.6,0.85,1.3,2,4.75],"pitch":[0.0,0.0,0.0,0.05,0.15,0.3,0.5,0.7,1.1,1.9,5.0]},"molly":{"yaw":[0.0,0.0,0.05,0.1,0.1,0.2,0.3,0.4,0.6,0.95,4.35],"pitch":[0,0.0,0.05,0.1,0.2,0.2,0.3,0.4,0.7,1.45,5.0]}};
function nadeQuant(D, u){ var x = u*10, i = Math.min(9, Math.floor(x)); return D[i] + (D[i+1] - D[i])*(x - i); }
var NADE_UTIL0 = null;   // средний множитель навыка (1,5 − util) по профилям — навык меняет разброс относительно среднего про
function nadeUtilMul0(){ if(NADE_UTIL0 == null){ var s = 0, n = 0; for(var k in PROFILES){ s += 1.5 - (PROFILES[k].util != null ? PROFILES[k].util : 0.5); n++; } NADE_UTIL0 = n ? s/n : 1; } return NADE_UTIL0; }
function nadeAimLimit(type, trusted){
  if(!trusted) return NADE_AIM_OK * (type === "flash" ? 2 : 1);
  var M = m3(), R = NADE[type] && NADE[type].radius ? NADE[type].radius * (M ? M.unit / M.cell : 1) : 0;
  return R ? Math.min(NADE_AIM_OK * 4, Math.max(NADE_AIM_OK, R)) : NADE_AIM_OK * 4;
}
var NADE_GUESS_SLACK = 16;
// (этап 3, скорость) решение для точки лайнапа (подсказка подбора из места бойца) — своё хранилище, не вытесняется общим кэшем (тот
// чистится целиком после 4000 решений); считается заранее во freeze-тайм (nadePrecalcTick, 540) — в раунде остаётся только уточнение
// из места бойца. Решение — то же самое (тот же nadeSolve, точное состояние): игра бит в бит та же, меняется только когда считается
var nadeGuessStore = (function(){ var C = {}; return function(k, v){ if(v === undefined) return C[k]; return (C[k] = v); }; })();
function nadeGuess(type, x, y, z, tx, ty, duck, wide){
  var k = type+"|"+x+","+y+","+z+"|"+tx+","+ty+(duck ? "d" : "")+(wide ? "w" : ""), g = nadeGuessStore(k);
  if(g === undefined) g = nadeGuessStore(k, nadeSolve(type, x, y, z, tx, ty, duck, wide));
  return g;
}
var NADE_PRECALC_I = 0, NADE_PRECALC_MS = 12;   // мс за тик freeze-тайма на подсчёт лайнапов (проектное число: < кадра 60 Гц)
function nadePrecalcTick(){
  if(!m3() || typeof allLineups !== "function") return;
  var L = allLineups(), t0 = (typeof performance !== "undefined") ? performance.now() : 0;
  while(NADE_PRECALC_I < L.length){
    var lu = L[NADE_PRECALC_I++]; if(!lu || !lu.from || !lu.to || !NADE[lu.type]) continue;
    var na = navAt(lu.from.x, lu.from.y, null); if(!na) continue;
    nadeGuess(lu.type, lu.from.x, lu.from.y, na.z, lu.to.x, lu.to.y, false, true);
    if(!t0 || performance.now() - t0 >= NADE_PRECALC_MS) break;
  }
}   // ед.: уточнённый бросок из места бойца не хуже решения точки лайнапа + столько — принят (проектное число)
var NADE_SOLVE_MS = [];      // время последних 500 подборов, мс — только для проверки (tools/tests), игра не читает
// (30.10, этаж) где у цели может лечь смок / огонь: полы, куда можно дойти, в клетке цели; нет таких (цель лайнапа — только x, y,
// среднее разрывов про — бывает над верхом ящика: Mirage prx280 / prx282, в клетке только верх ящика −83 вида «подсадка», про — −166)
// — полы, куда можно дойти, в NADE_LEVEL_R px от цели. Соседние полы не берутся, если в клетке цели пол есть: у края спуска рядом
// нижний уровень (Mirage pro68 / pro103 / prx6 / prx47: цель −40, в 13 px — −166, молотов падал вниз, у про — −40). Крыш в полах нет
var NADE_LEVEL_R = 13, NADE_LEVEL_TOL = 64;   // px радара (32 ед. — порог совпадения с про, NADES.md); ед. — «ящик» (проектные числа)
function nadeLandFloors(M, tx, ty){
  var F = M.floors, c0 = m3Cell(M, tx, ty), o = [];
  if(c0 >= 0) for(var q = F.st[c0]; q < F.st[c0+1]; q++) if(F.kind[q] === 1) o.push(F.z[q]);
  if(o.length) return o;
  var n = Math.ceil(NADE_LEVEL_R / M.cell);
  for(var dj = -n; dj <= n; dj++) for(var di = -n; di <= n; di++){
    if(Math.hypot(di, dj)*M.cell > NADE_LEVEL_R) continue;
    var c = m3Cell(M, tx + di*M.cell, ty + dj*M.cell); if(c < 0) continue;
    for(q = F.st[c]; q < F.st[c+1]; q++) if(F.kind[q] === 1 && o.indexOf(F.z[q]) < 0) o.push(F.z[q]);
  }
  return o.length ? o : [visFloorAt(tx, ty)];
}
// полы у цели, куда можно дойти пешком (вид 1 геометрии; нет таких — верхний пол, как visFloorAt)
function nadeAimFloors(M, tx, ty){
  var c = m3Cell(M, tx, ty), F = M.floors, o = [];
  if(c >= 0) for(var q = F.st[c]; q < F.st[c+1]; q++) if(F.kind[q] === 1) o.push(F.z[q]);
  return o.length ? o : [visFloorAt(tx, ty)];
}
// долетит ли своя граната бойца из (x, y) (пол z, null — пол под точкой) в цель — тот же порог, что у своего броска
function nadeLands(type, x, y, z, tx, ty){
  var S = nadeSolve(type, x, y, z != null ? z : visFloorAt(x, y), tx, ty, false);
  return !!S && S.levelOk !== false && S.e3 <= nadeAimLimit(type, false);
}
// (v373) своя граната через стену — только так, как кидают про. Замер (tools/nade_walls_pro.py, Mirage, 35 592 броска): у про 79 %
// бросков прямая «рука → разрыв» проходит сквозь стену радара (через крыши, над ящиками), толщиной — до 290 px у 10 % смоков;
// толщиной стены «можно / нельзя» не отличить (v370 — порог 100 px — резал броски: «стена на пути» — первая причина пропавших
// гранат у сторожа). Теперь: прямая без стен — можно; сквозь стену — если про кидали отсюда (≤ NADE_LANE_FROM) почти туда же
// (≤ NADE_LANE_TO): MAP.nadelanes (tools/nade_lanes_bake.py — все броски из демок карты). Радиусы — проектные числа
var NADE_LANE_FROM = 60, NADE_LANE_TO = 80, NADE_LANE_IDX = null;
function nadeLaneIdx(){
  if(NADE_LANE_IDX) return NADE_LANE_IDX;
  var L = (MAP.nadelanes && MAP.nadelanes.lanes) || [], ix = {};
  for(var i = 0; i + 3 < L.length; i += 4){ var k = Math.floor(L[i+2]/100)+","+Math.floor(L[i+3]/100); (ix[k] || (ix[k] = [])).push(i); }
  return (NADE_LANE_IDX = {L:L, ix:ix});
}
// места, откуда про кидали в точку (ex, ey) — концы бросков в NADE_LANE_TO
function nadeLaneFroms(ex, ey){
  var I = nadeLaneIdx(), L = I.L, out = [], gx = Math.floor(ex/100), gy = Math.floor(ey/100);
  for(var dx = -1; dx <= 1; dx++) for(var dy = -1; dy <= 1; dy++) (I.ix[(gx+dx)+","+(gy+dy)] || []).forEach(function(i){
    if(Math.hypot(L[i+2]-ex, L[i+3]-ey) <= NADE_LANE_TO) out.push({x:L[i], y:L[i+1]}); });
  return out;
}
// флешку, HE и молотов в точку, куда про не кидали, — можно через стену не толще, чем у 90 % бросков про этого типа
// (MAP.pro.nadeWallP90, tools/nade_walls_pro.py: Mirage — флешка 233, HE 96, молотов 142 px); смок — только как про (лайнапы)
function nadeTallWall(x1, y1, x2, y2, type){
  if(!crossesWall(x1, y1, x2, y2)) return false;
  if(nadeLaneFroms(x2, y2).some(function(q){ return Math.hypot(q.x-x1, q.y-y1) <= NADE_LANE_FROM; })) return false;
  var P = (MAP.pro && MAP.pro.nadeWallP90) || {}, lim = type && type !== "smoke" ? P[type] : 0;
  if(!lim) return true;
  // (v375, отметка владельца: «кинул гранату в стену, она залетела внутрь помещения») через стену навесом — только под открытое
  // небо: в помещение (крыша над целью) — через проход или как кидали про
  if(nadeCovered(x2, y2)) return true;
  var d = Math.hypot(x2-x1, y2-y1), n = Math.ceil(d/2), run = 0;
  for(var k = 1; k < n; k++){ var t = k/n; if(insideSolidWall(x1 + (x2-x1)*t, y1 + (y2-y1)*t)){ run += d/n; if(run > lim) return true; } else run = 0; }
  return false;
}
// (А5) по геометрии: над полом точки (верхний этаж, куда дойти пешком) есть преграда для гранат выше роста — крыша, балкон
function nadeCovered(x, y){
  var M = m3();
  if(M){ var c = m3Cell(M, x, y); if(c < 0) return false;
    var C = m3Col(M, "nade"), fz = visFloorAt(x, y);
    for(var q = C.st[c]; q < C.st[c+1]; q++) if(C.lo[q] > fz + 80) return true;
    return false; }
  visReady();
  var i = Math.floor(x / VIS_CELL), j = Math.floor(y / VIS_CELL);
  if(i >= 0 && j >= 0 && i < VIS.W && j < VIS.W && VIS.ceil[j*VIS.W + i] < Infinity) return true;
  if(!NAV_GRID) navGridBuild();
  var L = NAV_GRID[Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C)] || [], lo = Infinity, hi = -Infinity;
  for(var k=0;k<L.length;k++){ var zn = NAVAREAS[L[k]]; if(NAV_BLOCKED[zn.id] || !pointInPoly(x, y, zn.points)) continue; if(zn.z < lo) lo = zn.z; if(zn.z > hi) hi = zn.z; }
  return hi - lo > 100;
}
// (v340, отметка владельца: «две гранаты одновременно» — kyousuke кинул HE и через 0,1 с флешку) между двумя гранатами одного
// игрока — не меньше NADE_GAP с: демки про Mirage, 20 539 пар бросков подряд — минимум 1,1 с (0,5-й процентиль), быстрее 1 с — 0 %
var NADE_GAP = Math.round(1.1*64);
function nadeReady(b){ return tick - (b._nadeT == null ? -1e9 : b._nadeT) >= NADE_GAP; }
var NADE_FAIL = null;   // (v369) почему последний бросок не состоялся — для проверки
// from — (лайнап) точка броска из набора: навигация и подсказка подбора; бросок подбирается и летит из места, где боец стоит
function throwNade(b, type, tx, ty, lob, why, trusted, from){
  NADE_FAIL = null;
  if(!b.nades || b.nades[type] <= 0){ NADE_FAIL = "нет гранаты"; return false; }
  if(!nadeReady(b)){ NADE_FAIL = "пауза между гранатами"; return false; }
  // (док 6, п.10: CT кидали флешку «ретейк» и смоки «иду в бой», когда живых T уже не было, — м1 р7, р10; у про 16 гранат из ~35 тыс.)
  // живых врагов нет (киллфид знают все) — гранату некуда и незачем: одно место для всех бросков
  if(roundState === "live" && aliveCount(b.team === "CT" ? "T" : "CT") === 0){ NADE_FAIL = "врагов нет"; return false; }
  // (v469, п.4/26 владельца 29.10, р3 м1: karrigan кинул лайнап-молотов в B Apps, где 5 с стоял смок — молотов сразу погас) дым и огонь
  // видно и слышно: молотов в дым — погаснет, не летит; смок на свой огонь — потушит свою задержку (ответ про-аналитика: тушить свой
  // молотов — ошибка; чужой на своём проходе — можно), не летит. Те же касания, что гасят огонь при срабатывании (400)
  if(type === "molly" && smokes.some(function(sm){ return Math.hypot(sm.x-tx, sm.y-ty) < smokeRadiusNow(sm) + NADE.molly.radius*MOLLY_SMOKE_TOUCH; })){ NADE_FAIL = "в дыму погаснет"; return false; }
  if(type === "smoke" && fires.some(function(f){ return f.team === b.team && Math.hypot(f.x-tx, f.y-ty) < NADE.smoke.radius + NADE.molly.radius*MOLLY_SMOKE_TOUCH; })){ NADE_FAIL = "потушит свой огонь"; return false; }
  if(lob && !trusted && nadeTallWall(b.x, b.y, tx, ty, type)){ NADE_FAIL = "стена на пути"; return false; }   // (v373) сквозь стену — только как кидают про (MAP.nadelanes)
  if(!m3()){ NADE_FAIL = "нет геометрии карты"; return false; }
  // (физика гранат) как кинуть — подбор физикой (nadeSolve) из ТОГО состояния, из которого граната полетит: место бойца (x, y),
  // его пол (z), присед. Лайнап: from — точка навигации и данных лайнапа, не место вылета (30.10, ошибка PR #2: бросок подбирался для
  // from, а летел из места бойца — до 36 px в стороне, лайнапы ложились в 183–185 px от цели); решение для from — только подсказка
  // (guess), с которой начинается подбор из места бойца. Не нашлось броска отсюда — отказ с причиной (задание снимается, назад не идёт)
  var bz = b.z != null ? b.z : visFloorAt(b.x, b.y), guess = null;
  if(from && (from.x !== b.x || from.y !== b.y)){
    var na = navAtLevel(from.x, from.y, bz), fz = na ? na.z : bz;
    guess = nadeGuess(type, from.x, from.y, fz, tx, ty, b.crouching, !!trusted);
  }
  var V = nadeBotVel(b), S = nadeSolve(type, b.x, b.y, bz, tx, ty, b.crouching, !!trusted, guess, V);
  if(!S){ NADE_FAIL = "цель под ногами"; return false; }
  // своя — ближе NADE_AIM_OK (флешке — вдвое); лайнап — и мимо, но не так, что отсюда туда не кинуть вовсе (× 4)
  // (30.10, этаж) смок / молотов, который отсюда ложится только на другой этаж или крышу, — не кидается (раньше проходил по 3D-ошибке ≤ 400 ед.)
  if(S.levelOk === false){ NADE_FAIL = "не тот этаж / крыша"; return false; }
  // (этап 1б) лайнап — в пределах действия самой гранаты: дым, огонь, HE, сработавшие дальше своего радиуса от цели, цель не накрывают
  // (прогон 126, Mirage м53: молотов «T Ramp» с ошибкой подбора 378 ед. — в пределах прежних 400 — ударил в стену в 25 px и загорелся у
  // своего, тот застрял в огне: 30 «переносов»). Радиус — NADE (px радара → ед. игры); флешке радиуса нет — как было (× 4)
  if(S.e3 > nadeAimLimit(type, trusted)){ NADE_FAIL = "не долетит: стена / потолок"; return false; }
  var a = Math.atan2(ty-b.y, tx-b.x), M = m3(), F = m3Game(M, b.x, b.y);
  // вылет — тот бросок, что подобрала физика (S): в полёте — состояние физики (ед. игры: p, v, t, касания — 385), x, y, z — где
  // граната сейчас (радар; z — ед. игры), tx, ty — где сработает по расчёту той же физики (другие решения смотрят туда)
  // лайнап не идеален: исполнение со своей ошибкой — ошибка прицела (поворот и наклон), куда граната с ней упадёт — решает физика.
  // (30.10, этап 2) величина — разброс прицела про при повторе одного броска (NADE_AIM_SCATTER, демки обеих карт, по типу гранаты) ×
  // навык (util: 1,5 − util к среднему по профилям) × BAL.lobErr (1 — как у про) × 3 при промахе execErr. Было: BAL.lobErr = 90 px
  // точки падения (придумано) → ≈ 4° поворота в медиане, в 10–40 раз больше, чем у про. Бросок прямо (цель видна) — без ошибки
  var tr = nadeTraceFn(), dYaw = 0, dPit = 0, miss = false;
  if(lob){
    var leMul = b.prof ? (1.5 - prof(b, "util")) / nadeUtilMul0() : 1;
    if(BAL.execErr && b.prof && hashRand(tick*43 + b.id.charCodeAt(1)*3) < (1-prof(b, "util"))*0.08){ leMul *= 3; miss = true; }
    var SC = NADE_AIM_SCATTER[type], k0 = BAL.lobErr * leMul, c0 = b.id.charCodeAt(0);
    dYaw = (hashRand(tick*13 + b.id.length*97) < 0.5 ? -1 : 1) * nadeQuant(SC.yaw, hashRand(tick*71 + c0*5)) * k0;
    dPit = (hashRand(tick*37 + c0*11) < 0.5 ? -1 : 1) * nadeQuant(SC.pitch, hashRand(tick*59 + c0*7)) * k0;
  }
  // где сработает — полёт именно этого вылета (из того места, где стоит, с ошибкой исполнения) той же физикой, что полетит:
  // расчёт и полёт совпадают бит в бит
  var L = nadeLaunch({pos: [F[0], F[1], bz], yaw: S.yaw + dYaw, pitch: S.pitch + dPit, strength: S.strength, duck: !!b.crouching, jump: S.jump, vel: V}, tr);
  var Fl = nadeFly(type, L.p, L.v, tr), PR = m3Radar(M, Fl.det[0], Fl.det[1]);
  // (аудит 11.10) проверка прямо перед броском: HE / молотов не летит туда, где стоит свой (в радиусе поражения) —
  // бросок отменяется, граната остаётся. Раньше не проверялось: 37 % HE падали в 300 px от своего, урон по своим от
  // гранат — 88 случаев на 12 матчей (у про из 33 тимкиллов 30 — пули, docs/PRO_PLAY.md 6г)
  // (физика гранат) и там, где граната сработает на самом деле (точка полёта PR), и сам бросающий — тоже «свой»
  if((type === "he" || type === "molly") && bots.some(function(o){ return o.alive && o.team === b.team &&
      (Math.hypot(o.x-tx, o.y-ty) < NADE[type].radius || Math.hypot(o.x-PR[0], o.y-PR[1]) < NADE[type].radius); })){ NADE_FAIL = "свой в зоне"; return false; }
  b.nades[type]--; b._nadeT = tick; b._lastNade = {type:type, x:tx, y:ty, t:tick, self: /себе/.test(String(why || (b.nadeTask && b.nadeTask.why) || ""))};   // (v448) self — флешка себе под пик (контакт — 350)
  npUse(b, type, (b.nadeTask && b.nadeTask.type === type && b.nadeTask.npm) || npMomentNow(b));   // (v428) запись плана гранат снята
  if(miss) noteMistake(b, "промахнулся гранатой ("+NADE[type].name+")");
  var nd = Object.assign(nadeState(type, L.p, L.v), {type:type, x:b.x, y:b.y, z:L.p[2], tx:PR[0], ty:PR[1], born:tick, thrower:b, team:b.team,
            trail:[], why:why||"", ox:b.x, oy:b.y, lob:!!lob, etaDet: tick + Math.ceil(Fl.t*TICK_HZ), aimX:tx, aimY:ty, exec:[+dYaw.toFixed(2), +dPit.toFixed(2)], plan:[S.x, S.y, S.det[2], S.e3], from0:[b.x, b.y, bz], vel0:V});   // exec — ошибка исполнения (поворот, наклон, °); plan — где сработает по подбору (радар x, y; z, ошибка e3); from0 — откуда кинул
  // кто может увернуться от этой флешки: видел бросающего или был рядом (слышит чеку)
  if(type === "flash" && BAL.flashAware){
    nd.aware = {};
    // (этап 3, P2-2) и свои: кто рядом или видел бросок, знает о нём так же, как враг; остальным — колл «флешу!» в войсе
    bots.forEach(function(o){ if(o.alive && o !== b && (Math.hypot(o.x-b.x, o.y-b.y) < 450 || hasVision(o.x, o.y, b.x, b.y))) nd.aware[o.id] = true; });
  }
  nadesInAir.push(nd); if(SND && SND.on) sndNade("throw", b.x, b.y);
  if(b.nadeTask) b.nadeTask.exuThrown = true; exuThrown(b, nd);   // (тактика 30.10) граната выхода T: когда сработает — знает команда (366)
  if(type === "flash" && b.voice) teamPropose(b, {kind: "flash", nade: nd});
  b.throwUntil = tick + 18; // ~0.3с стоит на броске
  b.facing = a;
  logEvent(b.id+" кинул "+NADE[type].name+(why ? " — "+why : "")+(lob ? " (лайнап)" : ""));
  // раздел 11.1: бросок гранаты — тоже источник инфы о враге, не только выстрел/
  // шаги. Кто видел бросок — фиксирует позицию бросавшего как обычный "вижу"
  // (на миг открылся); кто не видел, но был достаточно близко — слышит
  // ЧЕКУ/бросок и понимает направление и примерную дистанцию, откуда кинули,
  // даже без визуального контакта.
  if(typeof teamIntel !== "undefined"){
    var enemyTeam = b.team === "CT" ? "T" : "CT";
    bots.forEach(function(o){
      if(!o.alive || o.team !== enemyTeam) return;
      var dd = Math.hypot(o.x-b.x, o.y-b.y);
      // (v242) видит бросок — только если смотрит туда (поле зрения); услышал — знает сам, команде скажет войс
      // (Б3, З9) «видит» — как радар: visParts (стены, укрытия, пол, стойка — 3D-геометрия игры) и дым; раньше hasVision
      // (стены радара + пол, без укрытий и стойки) — 8–19 % «видел бросок» без линии
      var vpN = visParts(o.x, o.y, o.crouching, b.x, b.y, b.crouching, true, o.z, b.z);
      if((vpN.head || vpN.body) && !smokeBlocks(o.x, o.y, b.x, b.y) && inFov(o, b.x, b.y) && tick >= (o.blindUntil||0)){
        intelPush(enemyTeam, {type:"spotted", x:b.x, y:b.y, id:b.id, by:o.id, conf:1});
        o.lastIntel = {x:b.x, y:b.y, tick:tick};
      } else if(dd <= NADE_HEAR_R){
        o.heardSound = hearReal(o, {x:b.x, y:b.y, tick:tick, team:b.team, src:b.id, kind:"nade"});
      }
    });
  }
  return true;
}
function smokeCovered(x, y){
  // план §7: "два бота не кидают смок в одну точку, пока один ещё не рассеялся"
  // (v438, док владельца 27.10: два смока Stove + B Apps в 128 ед.; у про такая пара — 3 раунда из 742) «то же место» — облака
  // перекрылись бы (центры ближе двух радиусов смока), а не ближе 60
  var R = 2*NADE.smoke.radius;
  if(smokes.some(function(s){ return Math.hypot(s.x-x, s.y-y) < R && s.until - tick > 64; })) return true;
  return nadesInAir.some(function(n){ return n.type === "smoke" && Math.hypot((n.tx||n.x)-x, (n.ty||n.y)-y) < R; });
}
function assignNade(b, type, target, why, opts){
  if(!b || !b.alive || !b.nades || b.nades[type] <= 0) return false;
  if(opts && opts.bkey && !builtinAllowed(opts.bkey)) return false; // встроенная выключена или заменена своим лайнапом
  // (v428) план гранат команды (365): граната, отложенная на более поздний момент (выход, после планта, ретейк), сейчас не тратится;
  // гранаты выхода T — момент «выход» и тогда, когда их кидают заранее, до пика (preExec)
  var npm = (opts && opts.bkey && /^T\.exec\./.test(opts.bkey)) ? "exec" : (opts && opts.bkey && /^T\.fake\./.test(opts.bkey)) ? "fake" : npMomentNow(b);
  if(!npCanUse(b, type, npm, null)){ NADE_FAIL = npWhyNot(b, type); return false; }
  if(b.nadeTask && (b.nadeTask.type === type || b.nadeTask.lineup)) return false; // свой лайнап не перебиваем
  if(type === "smoke" && smokeCovered(target.x, target.y)) return false;
  // одна граната одного типа в одну точку: другие механики (комбо, флешка
  // себе, дамп…) не дублируют уже летящую/назначенную туда же
  if(BAL.nadeDedup && type !== "smoke" && (nadesInAir.some(function(n){ return n.team === b.team && n.type === type && Math.hypot((n.tx||n.x)-target.x, (n.ty||n.y)-target.y) < 120; }) ||
     bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.nadeTask && o.nadeTask.type === type && Math.hypot(o.nadeTask.x-target.x, o.nadeTask.y-target.y) < 120; }))) return false;
  // (v419) here — бросок только с места (задержать гранатой, 350): срок 2 с, на точку броска не идёт
  var here = !!(opts && opts.here);
  b.nadeTask = {type:type, x:target.x, y:target.y, until: tick + (here ? 2 : 10)*64, why:why||"", start:tick, lob:true, range:(opts && opts.range) || NADE_THROW_RANGE, now:!!(opts && opts.now), here:here, npm:npm};
  return true;
}
// задание на гранату выполняется, как только точка видна и в пределах броска
function nadeQueueNext(b){
  // (v355) следующая граната из очереди того же бойца: с той же точки броска, срок 6 с (проектное число)
  if(!b.alive || !b.nadeQueue || !b.nadeQueue.length || b.nadeTask) return;
  var q = b.nadeQueue.shift();
  if(!b.nades || b.nades[q.type] <= 0 || roundState !== "live") return nadeQueueNext(b);
  var qSec = Math.max(6, Math.ceil(pathLenTo(b, q.from.x, q.from.y)/SPEED + LU_REACH_PAD));   // (v359) точка следующей — бывает дальше
  b.nadeTask = {type:q.type, x:q.x, y:q.y, from:q.from, until: tick + qSec*TICK_HZ, why:q.why, start:tick, lob:true, range:4000, now:true, lineup:true, exec:q.exec && q.type === "smoke", npm:q.npm, exu:q.exu};
}
// (этап 4) скорость бойца в миг броска: сдвиг за последний тик (движение идёт после гранат — 540), ед/с игры [vx, vy, 0]; y игры
// противоположен y радара. Обновляется каждый тик раунда для всех живых (nadeVelTrack), до заданий на гранату
// Вертикаль — 0: бот бросает с земли (прыжка у бота нет; подъём по ступеням — не прыжок, а модель CS считает прыжком всё, что
// поднимается быстрее 60 ед/с — 385 AIR_VZ). Сдвиг больше двух полных шагов за тик (SPEED × 2) — перенос (лестница, перемотка), не скорость
function nadeVelTrack(){
  var M = m3(), k = M ? M.unit / M.cell : 1;
  bots.forEach(function(b){ var p = b._nvP, v = null;
    if(p && p[2] === tick - 1 && b.alive){ var dx = b.x - p[0], dy = b.y - p[1]; if(Math.hypot(dx, dy)*TICK_HZ <= 2*SPEED) v = [dx*TICK_HZ*k, -dy*TICK_HZ*k, 0]; }
    b._nv = v; b._nvP = [b.x, b.y, tick]; });
}
function nadeBotVel(b){ var v = b._nv; return v && (v[0] || v[1]) ? v : null; }
// лайнап — бросок стоя (решение для точки лайнапа — стоя): боец, который ещё идёт (скорость > NADE_STILL_V), сначала останавливается
// (на посту лайнапа скорость гасится — 540), бросок — в тот тик, когда стоит. Своя граната летит с хода — со скоростью бойца
var NADE_STILL_V = 5;   // ед/с игры (проектное число: заметно меньше шага 2,5 ед. за тик)
function updateNadeTasks(){
  nadeVelTrack();
  bots.forEach(function(b){
    // (тактика 30.10) граната выхода T снята без броска — почему (NADE_FAIL последней попытки): для журнала 366
    var t0 = b.nadeTask; NADE_FAIL = null; updateNadeTask1(b);
    if(t0 && t0.exu != null && b.nadeTask !== t0 && t0.exuThrown !== true) exuTaskGone(t0, b);
  });
}
function updateNadeTask1(b){
    if(!b.nadeTask && b.nadeQueue && b.nadeQueue.length) nadeQueueNext(b);
    var t = b.nadeTask; if(!t) return;
    if(!b.alive || tick > t.until || !b.nades || b.nades[t.type] <= 0){
      b.nadeTask = null;
      // задание сгорело, а пост "лайнап" остался — снять, иначе стоит на точке броска весь раунд
      if(b.post && b.post.tag === "lineup") clearPost(b);
      return; }
    if(b.planting || b.defusing) return;
    if(t.here && !delaySafe(b)){ b.nadeTask = null; return; }   // (v419) враг виден / в упор — граната убирается, в руках оружие
    // (v359, р7) T уже на сайте выхода, а точка броска позади — задание снимается: с взятого сайта назад за гранатой не уходят
    if(t.lineup && t.from && b.team === "T" && teamTac.T && SITES[teamTac.T.site] && bomb.state !== "planted"){
      var Sx = SITES[teamTac.T.site], dB = Math.hypot(b.x-Sx.x, b.y-Sx.y);
      if((onSite(Sx, b.x, b.y) || dB < 450) && Math.hypot(t.from.x-Sx.x, t.from.y-Sx.y) > dB + 200){ b.nadeTask = null; b.nadeQueue = null; if(b.post && b.post.tag === "lineup") clearPost(b); return; }
    }
    var d = Math.hypot(t.x-b.x, t.y-b.y);
    if(t.type === "smoke" && smokeCovered(t.x, t.y)){ b.nadeTask = null; return; }
    // (док 6, п.1: kyousuke шёл на Connector, контакт увёл его на B Short — и он пошёл назад на Connector) хозяин цели ушёл — точка броска
    // той же цели пересматривается раз в 0,5 с: ближе по пути — туда
    if(t.from && t.luL && tick % 32 === 0 && Math.hypot(t.from.x-b.baseX, t.from.y-b.baseY) > 36){
      var M = luSpotFor(b, t.luL, t.npm);
      if(M && (M.from.x !== t.from.x || M.from.y !== t.from.y) && pathLenTo(b, M.from.x, M.from.y) < pathLenTo(b, t.from.x, t.from.y)){
        t.from = {x:M.from.x, y:M.from.y}; t.x = M.to.x; t.y = M.to.y; t.why = "лайнап «"+(M.name||LU_TYPE[M.type])+"»";
        if(b.post && b.post.tag === "lineup") clearPost(b); } }
    if(t.from){ // свой лайнап: сначала встать ровно в точку броска
      // раньше кидал только ближе 22px к точке, а "дошёл до поста" считается
      // уже с 34px — бот вставал в 23–34px и стоял до конца задания, не кидая
      // (v369, владелец: «пишется "идёт кидать гранату", но как будто не успевают кинуть») бот, стоявший на угле (state hold), к
      // точке броска не шёл вовсе — пост ставился только в patrol, и задание сгорало в 40–60 ед. от точки. Теперь угол он
      // оставляет (кроме боя: engage / retreat — сначала бой)
      if(Math.hypot(t.from.x-b.baseX, t.from.y-b.baseY) > 36 && !(b.atPost && b.post && b.post.tag === "lineup")){
        if(b.state === "hold" && !b._sawEnemy) leaveHold(b);
        // (v378) задача важнее броска (арбитр места) — бросок не идёт, пока она не кончится (с v438 — ждёт, а не отменяется)
        // (v438, док владельца 27.10: «мид взяли без гранат, хотя куплены»; замер: 29 % заданий снимала задача важнее — бой, перестановка)
        // задача важнее — бросок ждёт, пока она кончится (срок задания until остаётся: момент прошёл — граната не летит). Было — снимался сразу
        // (п.2/12 владельца 29.10: «бросать задачи и идти назад и кидать её»; м1 р2 NiKo — отход увёл от Connector, потом снова туда;
        // р4 donk — фланг к миду, потом назад в T Apps) ждёт — пока перебившая задача не увела его от точки броска: вернуться к броску —
        // только если точка не дальше по пути, чем была, когда перебили; ушёл дальше — бросок снят (идти назад за гранатой не надо)
        if(b.state === "patrol") setPost(b, t.from, {x:t.x, y:t.y}, true, "lineup");
        var lu = b.state === "patrol" && b.post && b.post.tag === "lineup";
        if(!lu){ if(!t.int) t.int = {d: pathLenTo(b, t.from.x, t.from.y)}; }
        else if(t.int){ var dI = t.int.d; t.int = null;
          if(pathLenTo(b, t.from.x, t.from.y) > dI + 36){ logEvent(b.id+": граната отменена — после другой задачи точка броска позади ("+t.why+")");
            b.nadeTask = null; b.nadeQueue = null; clearPost(b); return; } }
        return; }
      postKeep(b);   // стоит на точке броска — затея ещё идёт
      if(!nadeReady(b)) return;   // (v340) только что кинул другую — задание ждёт
      var vNow = nadeBotVel(b); if(vNow && Math.hypot(vNow[0], vNow[1]) > NADE_STILL_V) return;   // (этап 4) лайнап — стоя: ещё идёт — ждёт
      // не вышло на время (пауза между гранатами, свой в зоне огня) — задание остаётся, попробует снова; раньше снималось молча
      if(!throwNade(b, t.type, t.x, t.y, true, t.why, !t.gen, t.from) && NADE_FAIL && /пауза|свой/.test(NADE_FAIL)) return;   // своя точка (gen) — дуга проверяется
      b.nadeTask = null; if(b.post && b.post.tag === "lineup") clearPost(b); return;
    }
    if(d <= t.range && hasLOS(b.x, b.y, t.x, t.y, b.z)){
      if(!nadeReady(b)) return;   // (v340) только что кинул другую — задание ждёт
      throwNade(b, t.type, t.x, t.y, false, t.why); b.nadeTask = null;
    } else if(t.lob && d <= t.range*0.85 && (t.now || tick - t.start > 64)){
      // навесом — точки не видно. (v370, отметка владельца: magixx кинул смок из T Ramp в Window сквозь здания) раньше «стены
      // по пути не мешают» для любого броска; теперь сквозь стены летят только лайнапы про (из демок, так кидали на самом деле).
      // Свой бросок — над открытым местом (проходы, окна, укрытия); нет пути — идёт на точку рядом, откуда граната долетает
      // (nadeThrowSpot: безопасную от известных врагов); нет и такой — не кидает
      if(!nadeReady(b)) return;   // (v438) пауза между гранатами — задание ждёт (раньше снималось: 277 заданий на 8 матчей)
      if(throwNade(b, t.type, t.x, t.y, true, t.why) || !/стена|потолок|этаж/.test(NADE_FAIL||"") || t._spotTried || t.here){ b.nadeTask = null; return; }   // (v373) и под крышей — на точку, откуда долетит
      t._spotTried = true;
      var fs = nadeThrowSpot(b, t);
      if(!fs){ b.nadeTask = null; return; }
      t.from = fs; t.gen = !fs.lane; t.until = Math.max(t.until, tick + Math.ceil(pathLenTo(b, fs.x, fs.y)/SPEED + 2)*TICK_HZ);
    }
}

// (v370) откуда докинуть свою гранату: точка в NADE_SPOT_R от бойца, откуда так кидают про (или без стены на пути), цель в
// пределах броска; не на виду у врагов, которых команда знает (≤ 8 с), и ближе по пути. Владелец: «главное, чтобы не дохли, пока
// шли до точки». Радиус — проектное число
var NADE_SPOT_R = 450;
function nadeThrowSpot(b, t){
  var bl = (typeof beliefLast !== "undefined" && beliefLast[b.team]) || {}, foes = [];
  for(var e in bl){ var q = bl[e]; if(q && tick - q.tick <= 8*TICK_HZ && bots.some(function(o){ return o.id === e && o.alive; })) foes.push({x:q.x, y:q.y}); }
  // (v373) кандидаты — места, откуда про кидали в эту точку (MAP.nadelanes), и точки рядом без стены на пути
  // бросок с места про — как у про (долетит ли — решит бросок); своё место — граната долетает по физике (nadeLands, физика гранат 30.10)
  var c = nadeLaneFroms(t.x, t.y).filter(function(q){ return Math.hypot(q.x-b.x, q.y-b.y) <= NADE_SPOT_R && navAt(q.x, q.y); }).map(function(q){ return {x:q.x, y:q.y, lane:true}; })
    .concat(pickSpots("nthr"+b.id+"_"+Math.round(t.x)+","+Math.round(t.y), {x:b.x, y:b.y}, 8, {rMax:NADE_SPOT_R, minGap:40, hideFrom:foes})
      .filter(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) <= t.range*0.85 && !crossesWall(q.x, q.y, t.x, t.y) && nadeLands(t.type, q.x, q.y, null, t.x, t.y); }))
    .filter(function(q){ return !foes.some(function(f){ return hasLOS(q.x, q.y, f.x, f.y); }) && !luBehind(b, q); });   // (п.12) и не позади по ходу (390)
  if(c.length > 12) c = c.sort(function(a, d){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(d.x-b.x, d.y-b.y); }).slice(0, 12);
  var best = null, bL = Infinity;
  c.forEach(function(q){ var L = pathLenTo(b, q.x, q.y); if(L < bL){ bL = L; best = q; } });
  return best && bL <= NADE_SPOT_R*1.5 ? best : null;
}
