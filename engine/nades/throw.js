// [хозяева: nadeSolve, throwNade] ---------- бросок ----------
// (физика гранат, 30.10.2026) бросок — как у человека: поворот на цель, наклон и сила (ЛКМ / обе / ПКМ), подобранные НАСТОЯЩИМ
// полётом (flight: nadeAim — дуга, стены, крыши, отскоки, запал по геометрии игры, m3NadeTrace кубиком гранаты).
// Куда упадёт и долетит ли — решает только физика: прежние навес по прямой к цели (полёт и рисунок — разные дуги), «дуги под
// потолками» (nadeArc / nadeArcClear: у 62–73 % лайнапов про их дуга шла сквозь геометрию) и «упала на крышу» по точке цели удалены.
// Своя граната кидается, если физика доводит её к цели ближе NADE_AIM_OK ед. игры (флешке — вдвое), лайнап (trusted) — лучшим
// броском, если ближе NADE_AIM_OK × 4 (дальше — отсюда туда стоя не кинуть: у про был разбег / прыжок, данных о нём в лайнапе нет).
var NADE_AIM_OK = 100;   // ед. игры (≈ 40 px радара) — проектное число (ветка nades-v398, В3)
var NADE_AIM_DZ = {smoke: 0, molly: 0, flash: 80, he: 20};   // куда целиться по высоте над полом у цели, ед. (проектные числа, В3)
var FLASH_POP_DZ = 112;   // (v554) ед. над полом: медиана высоты разрыва флешек про (демки Mirage, 2960 разрывов, 3D-пол под точкой)
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
  // (v560, В86: «отмотал — раунд сложился по-другому») счёт тика — каждый подбор, и из кэша тоже: было — только не из кэша, а кэш вне снимка
  // (после перемотки в нём уже лежат подборы «из будущего» — бросок выходил на тик раньше, раунд расходился с 9-й секунды). Не время: игра не
  // должна зависеть от скорости компьютера
  if(NADE_TICK.t !== tick){ NADE_TICK.t = tick; NADE_TICK.n = 0; }
  NADE_TICK.n++;
  var c0 = nadeAimCache(key); if(c0 !== undefined) return c0;
  var t0 = (typeof performance !== "undefined") ? performance.now() : 0;
  var F = m3Game(M, x, y), T = m3Game(M, tx, ty), fl = nadeAimFloors(M, tx, ty), lv = nadeLandFloors(M, tx, ty), r = null;
  fl.forEach(function(fz){
    // (v554, владелец 11.11: «флешка не слепит») своя флешка (не лайнап) — разрыв на высоте, как у про (FLASH_POP_DZ), и высота считается в подборе
    // полностью: было 80 ед. и ошибка по высоте вдвое мягче — разрыв выходил в среднем в 14 ед. над полом, за укрытием его не видно. Лайнап — как было
    var own = type === "flash" && !wide;
    var o = {duck: !!duck, wz: type === "flash" && !own ? 0.5 : 1, wide: !!wide, vel: vel || null};
    if(type === "smoke" || type === "molly"){ o.levels = lv; o.levelTol = NADE_LEVEL_TOL; }
    if(!wide) o.need = nadeAimLimit(type, false);   // (v502) своя граната — порог «долетит» (flight: шире поворот, если мимо)
    if((type === "smoke" || type === "molly" || !wide) && NADE_AIM_SCATTER[type]) o.robust = [nadeQuant(NADE_AIM_SCATTER[type].yaw, NADE_ROBUST_Q), nadeQuant(NADE_AIM_SCATTER[type].pitch, NADE_ROBUST_Q)];   // (v501) устойчивость (flight); (v505) и своя граната любого типа   // (этаж) смок и огонь — на полу у цели
    if(guess){ o.guess = guess; o.guessOk = guess.levelOk === false ? 0 : guess.e3 + NADE_GUESS_SLACK; o.wide = false; }   // уточнение не вышло — обычный (не широкий) перебор: дешевле
    var q = nadeAim(type, [F[0], F[1], z], [T[0], T[1], fz + (own ? FLASH_POP_DZ : (NADE_AIM_DZ[type] || 0))], nadeTraceFn(), o);
    if(q && (!r || q.e3 < r.e3)) r = q; });
  if(r){ var R = m3Radar(M, r.det[0], r.det[1]); r.x = R[0]; r.y = R[1]; }
  if(t0){ NADE_SOLVE_MS.push(performance.now() - t0); if(NADE_SOLVE_MS.length > 500) NADE_SOLVE_MS.shift(); }
  return nadeAimCache(key, r);
}
// (30.10, этап 2) разброс прицела про при повторе одного броска — децили |Δповорота| и |Δнаклона|, ° (0, 10, …, 100 %): демки Mirage +
// Ancient (throws.json), броски стоя с места в 8 ед. в одну клетку разрыва 96 ед., групп ≥ 3 (tools/nades/aim_scatter_pro.py; точность
// углов в демке — 0,1°). Разрыв про при этом: смок p50 7 / p90 33 ед., флешка 8 / 36, HE 5 / 20, молотов 6 / 24
var NADE_AIM_SCATTER = {"smoke":{"yaw":[0.0,0.0,0.0,0.1,0.1,0.1,0.2,0.25,0.4,0.7,4.3],"pitch":[0.0,0.0,0.0,0.1,0.1,0.2,0.2,0.4,0.6,1.2,5.0]},"flash":{"yaw":[0.0,0.0,0.05,0.1,0.2,0.3,0.4,0.65,1.0,1.6,4.6],"pitch":[0.0,0.0,0.1,0.15,0.3,0.45,0.7,1.0,1.45,2.25,5.0]},"he":{"yaw":[0.0,0,0.1,0.15,0.25,0.4,0.6,0.85,1.3,2,4.75],"pitch":[0.0,0.0,0.0,0.05,0.15,0.3,0.5,0.7,1.1,1.9,5.0]},"molly":{"yaw":[0.0,0.0,0.05,0.1,0.1,0.2,0.3,0.4,0.6,0.95,4.35],"pitch":[0,0.0,0.05,0.1,0.2,0.2,0.3,0.4,0.7,1.45,5.0]}};
// (v501) устойчивость смока в подборе (flight, o.robust): сдвиг прицела — квантиль 0,8 разброса про (смок: поворот 0,4°, наклон 0,6°) — проектное число
var NADE_ROBUST_Q = 0.8;
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
// чистится целиком после 4000 решений); считается заранее во freeze-тайм (nadePrecalcTick, tick) — в раунде остаётся только уточнение
// из места бойца. Решение — то же самое (тот же nadeSolve, точное состояние): игра бит в бит та же, меняется только когда считается
// (v512, владелец: «первые секунды закупки после начала матча очень лагает» — подбор после v500–v505 до 170 мс, лимит NADE_PRECALC_MS
// проверялся только после него) решения посчитаны заранее при сборке (MAP.nadeguess, tools/nades/guess_bake.py; в MAP — только если
// отпечаток кода подбора и данных карты тот же, src/mapset.py) — те же значения, что посчитал бы nadePrecalcTick; нет — считает он
var nadeGuessStore = (function(){ var C = {}, G = MAP.nadeguess && MAP.nadeguess.g; if(G) for(var k in G) C[k] = G[k];
  var f = function(k, v){ if(v === undefined) return C[k]; return (C[k] = v); }; f.all = function(){ return C; }; return f; })();
// (v493) прицел про для точки лайнапа (MAP.luaim, tools/nades/luaim_bake.js: броски про стоя у точки, повторённые нашей физикой ≤ 32 ед.
// от цели) — вторая подсказка: подбор ищет ± 12° от направления на цель и не видит бросков со стены (Mirage «Jungle (выход, A)»: про —
// поворот на ~105°). Из двух решений — лучшее (nadeBetter): Mirage — 26 из 106 таких лайнапов обычный подбор кладёт дальше 32 ед.
var LU_AIM = null;
function luAimFor(type, x, y, tx, ty){
  if(!LU_AIM){ LU_AIM = {}; var A = MAP.luaim || {};
    ((MAP.lineups && MAP.lineups.pro) || []).concat((MAP.lineups && MAP.lineups.proExtra) || []).forEach(function(l){
      if(A[l.id]) LU_AIM[l.type+"|"+l.from.x+","+l.from.y+"|"+l.to.x+","+l.to.y] = A[l.id]; }); }
  return LU_AIM[type+"|"+x+","+y+"|"+tx+","+ty] || null;
}
// лучше: оба в 32 ед. (подбор: AIM_SAME) — смок быстрее; иначе — ближе (с этажом: «не тот этаж» хуже всего)
function nadeBetter(type, a, b){
  if(!a) return b; if(!b) return a;
  if((a.levelOk === false) !== (b.levelOk === false)) return a.levelOk === false ? b : a;
  if(type === "smoke" && a.e3 <= 32 && b.e3 <= 32) return b.t < a.t ? b : a;
  return b.e3 < a.e3 ? b : a;
}
function nadeGuessKey(type, x, y, z, tx, ty, duck, wide){ return type+"|"+x+","+y+","+z+"|"+tx+","+ty+(duck ? "d" : "")+(wide ? "w" : ""); }
var NADE_GUESS_PAID = {};   // (v570) подсказки, цена которых уже списана в лимит тика (переменная — в снимке)
function nadeGuess(type, x, y, z, tx, ty, duck, wide){
  var k = nadeGuessKey(type, x, y, z, tx, ty, duck, wide), g = nadeGuessStore(k);
  // (v560, В86) подсказка, посчитанная в игре (не из набора карты), стоит в счёте тика столько же подборов, сколько стоила в первый раз:
  // память подсказок вне снимка — после перемотки она уже есть, а счёт подборов тика должен выйти тем же
  // (v570, отметка владельца м1 р3 12,1 с, T1: «долго стоит на точке лайнапа и не кидает») — один раз, как будто её посчитали заново: было — при каждом
  // запросе, до проверки лимита тика, и бросок не проходил никогда («пауза: подбор броска» каждый тик). «Уже оплачена» — переменная игры
  // (в снимке): после перемотки цена снова списывается один раз, как в первый раз
  if(g !== undefined && nadeGuess.rt[k] && !NADE_GUESS_PAID[k]){ if(NADE_TICK.t !== tick){ NADE_TICK.t = tick; NADE_TICK.n = 0; } NADE_TICK.n += nadeGuess.rt[k]; NADE_GUESS_PAID[k] = 1; }
  if(g === undefined){ g = nadeSolve(type, x, y, z, tx, ty, duck, wide);
    var A = luAimFor(type, x, y, tx, ty);
    if(A) g = nadeBetter(type, g, nadeSolve(type, x, y, z, tx, ty, duck, wide, {yaw: A.yaw, pitch: A.pitch, strength: A.strength, jump: A.jump, e3: A.err, levelOk: true}));
    nadeGuessStore(k, g); nadeGuess.rt[k] = A ? 2 : 1; NADE_GUESS_PAID[k] = 1; }
  return g;
}
// ключ подсказки, посчитанной в игре → сколько подборов она стоила (В86). Свойство функции, а не переменная: живёт, как память подсказок,
// вне снимка (переменные страницы снимок восстанавливает — счёт откатился бы, а подсказки остались)
nadeGuess.rt = {};
// (v520, отметка владельца 09.11 м200 р3: снимок «до» не доходил до момента отметки — у владельца и в облаке разное) подсчёт лайнапов
// в freeze-тайм был ограничен 12 мс реального времени за тик: сколько успело посчитаться — зависело от скорости компьютера, а от этого —
// подсказка подбора и бюджет подборов в бою: матч расходился. Теперь — не больше NADE_PRECALC_N новых подборов за тик (проектное число;
// из кэша / MAP.nadeguess — не в счёт)
var NADE_PRECALC_I = 0, NADE_PRECALC_N = 1;
function nadePrecalcTick(){
  if(!m3() || typeof allLineups !== "function") return;
  var L = allLineups(), n = 0;
  while(NADE_PRECALC_I < L.length){
    var lu = L[NADE_PRECALC_I++]; if(!lu || !lu.from || !lu.to || !NADE[lu.type]) continue;
    var na = navAt(lu.from.x, lu.from.y, null); if(!na) continue;
    var gk = nadeGuessKey(lu.type, lu.from.x, lu.from.y, na.z, lu.to.x, lu.to.y, false, true), had = nadeGuessStore(gk) !== undefined && !nadeGuess.rt[gk];   // (В86) посчитанная в игре — как новая
    nadeGuess(lu.type, lu.from.x, lu.from.y, na.z, lu.to.x, lu.to.y, false, true);
    if(!had && ++n >= NADE_PRECALC_N) break;
  }
}   // ед.: уточнённый бросок из места бойца не хуже решения точки лайнапа + столько — принят (проектное число)
// (Д3, фризы на гранатах; облако м7: 70 % подборов — без подсказки, 28–93 мс, «не долетает» → подбор с места + с разбега под тремя
// углами в одном тике — до 1,8 с) подборов не из кэша — не больше NADE_BUDGET_N за тик: исчерпано — бросок / разбег — в следующих тиках
// (задание остаётся, «пауза»). Счёт подборов, а не мс: v515 считала время — игра зависела от скорости компьютера (прогон 199 отменён).
// Проектное число. Сдвигает момент броска на тики — проверка прогоном, не бит в бит
var NADE_BUDGET_N = 1, NADE_TICK = {t: -1, n: 0};
function nadeBudgetLeft(){ return NADE_TICK.t !== tick || NADE_TICK.n < NADE_BUDGET_N; }
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
    if(DM.hypot(di, dj)*M.cell > NADE_LEVEL_R) continue;
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
// (v373) своя граната через стену — только так, как кидают про. Замер (tools/pro/nade_walls_pro.py, Mirage, 35 592 броска): у про 79 %
// бросков прямая «рука → разрыв» проходит сквозь стену радара (через крыши, над ящиками), толщиной — до 290 px у 10 % смоков;
// толщиной стены «можно / нельзя» не отличить (v370 — порог 100 px — резал броски: «стена на пути» — первая причина пропавших
// гранат у сторожа). Теперь: прямая без стен — можно; сквозь стену — если про кидали отсюда (≤ NADE_LANE_FROM) почти туда же
// (≤ NADE_LANE_TO): MAP.nadelanes (tools/map/nade_lanes_bake.py — все броски из демок карты). Радиусы — проектные числа
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
    if(DM.hypot(L[i+2]-ex, L[i+3]-ey) <= NADE_LANE_TO) out.push({x:L[i], y:L[i+1]}); });
  return out;
}
// флешку, HE и молотов в точку, куда про не кидали, — можно через стену не толще, чем у 90 % бросков про этого типа
// (MAP.pro.nadeWallP90, tools/pro/nade_walls_pro.py: Mirage — флешка 233, HE 96, молотов 142 px); смок — только как про (лайнапы)
function nadeTallWall(x1, y1, x2, y2, type){
  if(!crossesWall(x1, y1, x2, y2)) return false;
  if(nadeLaneFroms(x2, y2).some(function(q){ return DM.hypot(q.x-x1, q.y-y1) <= NADE_LANE_FROM; })) return false;
  var P = (MAP.pro && MAP.pro.nadeWallP90) || {}, lim = type && type !== "smoke" ? P[type] : 0;
  if(!lim) return true;
  // (v375, отметка владельца: «кинул гранату в стену, она залетела внутрь помещения») через стену навесом — только под открытое
  // небо: в помещение (крыша над целью) — через проход или как кидали про
  if(nadeCovered(x2, y2)) return true;
  var d = DM.hypot(x2-x1, y2-y1), n = Math.ceil(d/2), run = 0;
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
var NADE_FAIL = null;   // (v369) почему последний бросок не состоялся — текст для журнала и инструментов
// (Р3.2 гранаты ш.2, Р-9, 26.11) решения читают код отказа NADE_FC, а не текст (правка формулировки не меняет поведение). Код → текст;
// группы — те же наборы текстов, что ловили прежние регулярки (сверено по всем текстам ниже): ждать — /пауза|свой/, пауза — /пауза/ и
// /^пауза/, далеко — /долетит/, геометрия — /стена|потолок|этаж/ (= /долетит|стена|этаж/, = /долетит|стена|потолок|этаж/), стена —
// /долетит|стена|потолок/ (без «этажа»)
var NADE_FAILS = {corpse: "в труп — врага там уже нет", noNade: "нет гранаты", pause: "пауза между гранатами", noEnemy: "врагов нет",
  smokeOut: "в дыму погаснет", ownFire: "потушит свой огонь", wall: "стена на пути", noGeo: "нет геометрии карты",
  budget: "пауза: подбор броска — в следующем тике", underFeet: "цель под ногами", floor: "не тот этаж / крыша",
  far: "не долетит: стена / потолок", ownZone: "свой в зоне", failedHere: "отсюда уже не долетела"};
var NADE_FAIL_CODE = {}; Object.keys(NADE_FAILS).forEach(function(k){ NADE_FAIL_CODE[NADE_FAILS[k]] = k; });
var NADE_FAIL_G = {wait: ["pause", "budget", "ownFire", "ownZone"], pause: ["pause", "budget"], far: ["far"],
  geo: ["wall", "floor", "far"], wallFar: ["wall", "far"]};
var NADE_FC = null;
// отказ: код (+ текст, если он не из таблицы: причина хозяина плана / своей гранаты); null — сброс перед попыткой
function nadeFail(c, text){ NADE_FC = c; NADE_FAIL = c === null ? null : text !== undefined ? text : NADE_FAILS[c]; }
function nadeFailIs(g){ return NADE_FC !== null && NADE_FAIL_G[g].indexOf(NADE_FC) >= 0; }
// from — (лайнап) точка броска из набора: навигация и подсказка подбора; бросок подбирается и летит из места, где боец стоит
// (v520, отметка владельца 09.11 м200 р2 «лагает»: zont1x на ходу («у меня 6 — кидаю всё») 94 раза подряд подбирал флешку в ту же цель —
// «не долетит: стена / потолок», полный 3D-подбор каждый тик, 3 с за 23 с игры) не долетевший бросок в ту же цель пересчитывается, только
// когда бот сместился на NADE_RETRY_D от места прошлой попытки (проектное число: на ходу это ≈ 6–8 тиков, а не каждый тик) — обстановка
// для полёта поменялась; до того — тот же отказ
var NADE_RETRY_D = 24;
function throwNadeDo(b, type, tx, ty, lob, why, trusted, from){
  var M0 = b._tnMiss;
  if(M0 && M0.r === roundNum && M0.type === type && M0.tx === tx && M0.ty === ty && M0.lob === !!lob && DM.hypot(b.baseX-M0.x, b.baseY-M0.y) < NADE_RETRY_D &&
     b.nades && b.nades[type] > 0 && nadeReady(b)){ nadeFail(NADE_FAIL_CODE[M0.why], M0.why); return false; }
  if(type !== "smoke" && type !== "decoy" && roundState === "live" && knowCorpseOnly(b.team, {x: tx, y: ty})){ nadeFail("corpse"); return false; }   // (22.11, Ж18) и прямые броски мимо задачи
  var ok = throwNadeTry(b, type, tx, ty, lob, why, trusted, from);
  b._tnMiss = (!ok && nadeFailIs("wallFar")) ? {r: roundNum, type: type, tx: tx, ty: ty, lob: !!lob, x: b.baseX, y: b.baseY, why: NADE_FAIL} : null;
  return ok;
}
// (17.11, перестройка — модули) запись в журнал решений (trace) — здесь, у хозяина (было: 645 подменял функцию обёрткой)
function throwNade(b, type, tx, ty, lob, why){ var _ev = simEvIn("throwNade", arguments);
  var r = throwNadeDo.apply(this, arguments);
  if(b) dlog(b, "граната", (r ? "кинул " : "не кинул ") + type + " — " + (why || "") + (r ? "" : ": " + (NADE_FAIL || "?")));
  return simEvOut(_ev, r);
}
function throwNadeTry(b, type, tx, ty, lob, why, trusted, from){
  nadeFail(null);
  if(!b.nades || b.nades[type] <= 0){ nadeFail("noNade"); return false; }
  if(!nadeReady(b)){ nadeFail("pause"); return false; }
  // (док 6, п.10: CT кидали флешку «ретейк» и смоки «иду в бой», когда живых T уже не было, — м1 р7, р10; у про 16 гранат из ~35 тыс.)
  // живых врагов нет (киллфид знают все) — гранату некуда и незачем: одно место для всех бросков
  if(roundState === "live" && aliveCount(b.team === "CT" ? "T" : "CT") === 0){ nadeFail("noEnemy"); return false; }
  // (v469, п.4/26 владельца 29.10, р3 м1: karrigan кинул лайнап-молотов в B Apps, где 5 с стоял смок — молотов сразу погас) дым и огонь
  // видно и слышно: молотов в дым — погаснет, не летит; смок на свой огонь — потушит свою задержку (ответ про-аналитика: тушить свой
  // молотов — ошибка; чужой на своём проходе — можно), не летит. Те же касания, что гасят огонь при срабатывании (damage)
  if(type === "molly" && smokes.some(function(sm){ return DM.hypot(sm.x-tx, sm.y-ty) < smokeRadiusNow(sm) + NADE.molly.radius*MOLLY_SMOKE_TOUCH; })){ nadeFail("smokeOut"); return false; }
  if(type === "smoke" && fires.some(function(f){ return f.team === b.team && DM.hypot(f.x-tx, f.y-ty) < NADE.smoke.radius + NADE.molly.radius*MOLLY_SMOKE_TOUCH; })){ nadeFail("ownFire"); return false; }
  if(lob && !trusted && nadeTallWall(b.x, b.y, tx, ty, type)){ nadeFail("wall"); nadeNoteFail(b, type, tx, ty); return false; }   // (v373) сквозь стену — только как кидают про (MAP.nadelanes)
  if(!m3()){ nadeFail("noGeo"); return false; }
  // (физика гранат) как кинуть — подбор физикой (nadeSolve) из ТОГО состояния, из которого граната полетит: место бойца (x, y),
  // его пол (z), присед. Лайнап: from — точка навигации и данных лайнапа, не место вылета (30.10, ошибка PR #2: бросок подбирался для
  // from, а летел из места бойца — до 36 px в стороне, лайнапы ложились в 183–185 px от цели); решение для from — только подсказка
  // (guess), с которой начинается подбор из места бойца. Не нашлось броска отсюда — отказ с причиной (задание снимается, назад не идёт)
  var bz = b.z != null ? b.z : visFloorAt(b.x, b.y), guess = null;
  if(from){   // (v493) и стоя ровно в точке: решение точки лайнапа — с прицелом про (luAimFor), подбор с нуля его не находит
    var na = navAtLevel(from.x, from.y, bz), fz = na ? na.z : bz;
    guess = nadeGuess(type, from.x, from.y, fz, tx, ty, b.crouching, !!trusted);
  }
  // (разбег) бросок на ходу — подсказка подбора: эталон броска про (поворот, наклон, сила, прыжок на бинде), уточняется с фактической скоростью
  var RG = b.nadeTask && b.nadeTask.runPh === "go" ? runupFor(b.nadeTask) : null;
  if(RG) guess = {yaw: RG.yaw, pitch: RG.pitch, strength: RG.strength, jump: RG.jump, e3: RG.err, levelOk: true};
  if(!nadeBudgetLeft()){ nadeFail("budget"); return false; }
  var V = nadeBotVel(b), S = nadeSolve(type, b.x, b.y, bz, tx, ty, b.crouching, !!trusted, guess, V);
  if(!S){ nadeFail("underFeet"); return false; }
  // своя — ближе NADE_AIM_OK (флешке — вдвое); лайнап — и мимо, но не так, что отсюда туда не кинуть вовсе (× 4)
  // (30.10, этаж) смок / молотов, который отсюда ложится только на другой этаж или крышу, — не кидается (раньше проходил по 3D-ошибке ≤ 400 ед.)
  if(S.levelOk === false){ nadeFail("floor"); nadeNoteFail(b, type, tx, ty); return false; }
  // (этап 1б) лайнап — в пределах действия самой гранаты: дым, огонь, HE, сработавшие дальше своего радиуса от цели, цель не накрывают
  // (прогон 126, Mirage м53: молотов «T Ramp» с ошибкой подбора 378 ед. — в пределах прежних 400 — ударил в стену в 25 px и загорелся у
  // своего, тот застрял в огне: 30 «переносов»). Радиус — NADE (px радара → ед. игры); флешке радиуса нет — как было (× 4)
  if(S.e3 > nadeAimLimit(type, trusted)){ nadeFail("far"); nadeNoteFail(b, type, tx, ty); return false; }
  var a = DM.atan2(ty-b.y, tx-b.x), M = m3(), F = m3Game(M, b.x, b.y);
  // вылет — тот бросок, что подобрала физика (S): в полёте — состояние физики (ед. игры: p, v, t, касания — 385), x, y, z — где
  // граната сейчас (радар; z — ед. игры), tx, ty — где сработает по расчёту той же физики (другие решения смотрят туда)
  // лайнап не идеален: исполнение со своей ошибкой — ошибка прицела (поворот и наклон), куда граната с ней упадёт — решает физика.
  // (30.10, этап 2) величина — разброс прицела про при повторе одного броска (NADE_AIM_SCATTER, демки обеих карт, по типу гранаты) ×
  // навык (util: 1,5 − util к среднему по профилям) × BAL.lobErr (1 — как у про). Было: BAL.lobErr = 90 px
  // точки падения (придумано) → ≈ 4° поворота в медиане, в 10–40 раз больше, чем у про. Бросок прямо (цель видна) — без ошибки
  var tr = nadeTraceFn(), dYaw = 0, dPit = 0;
  if(lob){
    var leMul = b.prof ? (1.5 - prof(b, "util")) / nadeUtilMul0() : 1;
    // (05.11, владелец: «гранаты нравились, только иногда — слева стенка, справа пространство, и он промахивается»; облако, 4 матча: 3 из 4 таких
    // промахов — дуга подобрана верно, сбила ошибка прицела ~4°) «промахнулся гранатой» (× 3 с вероятностью до 8 %, проектное) убран: ошибка
    // исполнения — только разброс про × навык
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
      (DM.hypot(o.x-tx, o.y-ty) < NADE[type].radius || DM.hypot(o.x-PR[0], o.y-PR[1]) < NADE[type].radius); })){ nadeFail("ownZone"); return false; }
  nadeChangeStock(b.nades, type, -1); nadeSetNadeT(b, tick); b._lastNade = {type:type, x:tx, y:ty, t:tick, self: /себе/.test(String(why || (b.nadeTask && b.nadeTask.why) || ""))};   // (v448) self — флешка себе под пик (контакт — 350)
  npUse(b, type, (b.nadeTask && b.nadeTask.type === type && b.nadeTask.npm) || npMomentNow(b), b.nadeTask && b.nadeTask.type === type && b.nadeTask.luL ? b.nadeTask.luL.grp : null);   // (v428) запись плана гранат снята
  var nd = Object.assign(nadeState(type, L.p, L.v), {type:type, x:b.x, y:b.y, z:L.p[2], tx:PR[0], ty:PR[1], born:tick, thrower:b, team:b.team,
            trail:[], why:why||"", ox:b.x, oy:b.y, lob:!!lob, etaDet: tick + Math.ceil(Fl.t*TICK_HZ), aimX:tx, aimY:ty, exec:[+dYaw.toFixed(2), +dPit.toFixed(2)], plan:[S.x, S.y, S.det[2], S.e3], from0:[b.x, b.y, bz], vel0:V});   // exec — ошибка исполнения (поворот, наклон, °); plan — где сработает по подбору (радар x, y; z, ошибка e3); from0 — откуда кинул
  // кто может увернуться от этой флешки: видел бросающего или был рядом (слышит чеку)
  if(type === "flash"){
    nd.aware = {};
    // (этап 3, P2-2) и свои: кто рядом или видел бросок, знает о нём так же, как враг; остальным — колл «флешу!» в войсе
    bots.forEach(function(o){ if(o.alive && o !== b && (DM.hypot(o.x-b.x, o.y-b.y) < 450 || hasVision(o.x, o.y, b.x, b.y))) nd.aware[o.id] = true; });
  }
  nadesInAir.push(nd); soundEv("sndNade", "throw", b.x, b.y);
  b._thrownT = tick;   // (22.11, Ж23-П4) бросок слышно — бот знает, что мог себя выдать (220 knowMeRevealed)
  // (00_PLAN п.14) флешка под чужой пик (nadeTask.peekFor, 390) — выглядывающий ждёт её хлопка (tick: _waitPopKey), до срабатывания по полёту
  var pkT = b.nadeTask && b.nadeTask.type === type && b.nadeTask.peekFor, pkB = pkT && bots.filter(function(o){ return o.id === pkT && o.alive; })[0];
  if(pkB && type === "flash"){ moveWaitPop(pkB, nd.etaDet + 1, "pop:"+nd.why, "peek-flash"); voiceLog(b.team, "pkfl"+b.id+roundNum, b.id, "флешу под пик "+pkB.id+" — выходи на хлопок"); }
  if(b.nadeTask) b.nadeTask.exuThrown = true; exuThrown(b, nd);   // (тактика 30.10) граната выхода T: когда сработает — знает команда (exec-sync)
  if(type === "flash" && b.voice) teamPropose(b, {kind: "flash", nade: nd});
  nadeSetThrowUntil(b, tick + 18); // ~0.3с стоит на броске
  lookFace(b, a, "nade");   // (15.11, фаза 3) поворот — через канал взгляда
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
      var dd = DM.hypot(o.x-b.x, o.y-b.y);
      // (v242) видит бросок — только если смотрит туда (поле зрения); услышал — знает сам, команде скажет войс
      // (Б3, З9) «видит» — как радар: visParts (стены, укрытия, пол, стойка — 3D-геометрия игры) и дым; раньше hasVision
      // (стены радара + пол, без укрытий и стойки) — 8–19 % «видел бросок» без линии
      var vpN = visParts(o.x, o.y, o.crouching, b.x, b.y, b.crouching, true, o.z, b.z);
      if((vpN.head || vpN.body) && !smokeBlocks(o.x, o.y, b.x, b.y) && inFov(o, b.x, b.y) && tick >= (o.blindUntil||0)){
        intelPush(enemyTeam, {type:"spotted", x:b.x, y:b.y, id:b.id, by:o.id, conf:1});
        knowIntel(o, {x:b.x, y:b.y, tick:tick});
      } else if(dd <= NADE_HEAR_R){
        knowHear(o, {x:b.x, y:b.y, tick:tick, team:b.team, src:b.id, kind:"nade"});
      }
    });
  }
  return true;
}
