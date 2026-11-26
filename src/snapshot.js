// ======================= v167: «Отметить момент», перемотка (v397: без разбора нейросетью — М147) =======================
// Инструмент для владельца и Claude, мозг ботов не трогает. Описание — docs/tasks/02-mark-moment.md.
// Снимки состояния: __SNAP (список переменных симулятора) генерирует src/marks_build.py при сборке (build.py, mkpub.py).
  var MK = { cps: [], snap: null, cur: null, list: [], db: null, assets: null, busy: false,
             lastCpTick: -1, cpMatch: -1, pick: false, CP_EVERY: 640, CP_KEEP: 40 };
  var MK_CATS = ["Взгляд", "Позиция", "Команда", "Гранаты", "Закуп", "Темп", "Войс", "Визуал"];
  var MK_SEC = {"Взгляд":"В", "Позиция":"П", "Команда":"К", "Гранаты":"Г", "Закуп":"Э", "Темп":"Т", "Войс":"Н", "Визуал":"И"};

// ---------- снимки и перемотка ----------
function mkSnapList(){
  if(MK.snap) return MK.snap;
  MK.snap = __SNAP.filter(function(e){
    // (Р3.1.3) звук / HUD_*, таблицы кода TASK_PROP / TASK_LEVEL, кэши картинок *IMG — исключены в реестре состояния (rebuild/state_classes.json,
    // колонка snap), в __SNAP их нет; здесь — только то, что видно лишь во время игры: функции (кэш-замыкания — не значения)
    try{ return typeof e[1]() !== "function"; }catch(err){ return false; } });
  return MK.snap;
}
// (v467, п.23 владельца 29.10: «Ошибка игры… HTMLDivElement object could not be cloned», м1 р10 — RP_EL окна повтора) список снимка
// собирается один раз, а показ заводит элементы страницы позже (KF_IMG v295, ZDJ v458, RP_EL v466) — ручной список исключений каждый
// раз отставал. Теперь снимок сам находит переменную, которую нельзя скопировать (элементы страницы, картинки, функции — это показ и
// кэши, не игра), убирает её из списка навсегда и пишет в консоль. Копия — одна на все переменные: общие объекты (бот в bots и в целях)
// остаются общими.
// (Р3.1.4, 25.11) формат содержимого снимка: номер пишется в снимок (__fmt), при открытии старые форматы поднимаются переходниками
// MK_SNAP_UP[n] (n → n+1) по порядку. Снимок без номера — формат 1 (всё до Р3.1.4). Новый формат — когда снимок начинает хранить то,
// чего раньше не было (ремонт Т-1), со своим переходником для старых отметок
// (Т-1, 25.11) формат 2: снимок полон для игры (I-23 — снимок в НОВОЙ странице идёт бит в бит с игрой; разбор — rebuild/evidence/R3/
// r3.1.2_snap_values.json). Сверх переменных (__SNAP) — __ext (mkSnapExt): подсказки броска, посчитанные в игре, и их цена (nadeGuessStore,
// nadeGuess.rt — вне переменных: замыкание и свойство функции; от них зависит расход бюджета подборов тика), живые записи кэша путей
// (PATHQ: старше PATHQ_TTL игра не читает) и счётчик его очистки PATHQ_N. Граф связей zoneGraph не копируется (1–1,5 МБ): он = граф
// загрузки минус NAV_UNLINKED — приводится к снимку по списку (mkGraphTo). Формат 1 (старые отметки): __ext нет — память подсказок и кэш
// путей остаются страничными (как до Т-1), граф — по NAV_UNLINKED, если в нём есть рёбра
var MK_SNAP_FMT = 3, MK_SNAP_UP = {};   // 3 (Т-1б) — __refs: ссылки на объекты неизменяемых данных путём; формат 2 и ниже — без них (копии, как было)
// (Т-2) снимок состояния после загрузки (680, до разминки) и чистый старт матча в странице, где матч уже был: всё — как после загрузки,
// кроме памяти между матчами — MK_KEEP (из реестра состояния: классы «постоянная память», «серия»; вставляет src/marks_build.py)
var MK_LOAD = null;
function mkMatchClean(){
  if(!MK_LOAD) return;
  var keep = {}; MK_KEEP.forEach(function(n){ keep[n] = eval(n); });
  mkRestore(MK_LOAD);
  MK_KEEP.forEach(function(n){ eval(n + " = keep[n]"); });
}
// (Т-1б, 25.11, владелец: «восстанавливать не только значения, но и структуру ссылок») состояние ссылается на объекты неизменяемых данных
// и графа вне снимка (корни — реестр состояния, колонка refs; опись rebuild/evidence/R3/state_refs_*.json): в игре
// это сами объекты таблиц, копия снимка — другие объекты (I-23 Mirage: тождество bots[i]._lkC[].pt). Снимок пишет такие ссылки путём
// (__refs: место в состоянии → путь в корне), открытие ставит на место объект страницы. Индекс корней — один на страницу, пересобирается,
// если корень заменён или граф менялся (NAV_UNLINKED, срез высоких связей)
var MK_REFIX = null;   // MK_REF_ROOTS — список корней из реестра (вставляет src/marks_build.py)
function mkRefIndex(){
  var roots = MK_REF_ROOTS.map(function(n){ try{ return eval(n); }catch(e){ return null; } });
  var key = (typeof NAV_UNLINKED !== "undefined" ? NAV_UNLINKED.length : 0) + "|" + (typeof navTallDone !== "undefined" ? navTallDone : "");
  if(MK_REFIX && MK_REFIX.key === key && MK_REFIX.ids.every(function(r, i){ return r === roots[i]; })) return MK_REFIX;
  var m = new Map();
  roots.forEach(function(r, ri){ if(!r || typeof r !== "object" || m.has(r)) return; m.set(r, [ri, null, null]); var st = [r];
    while(st.length){ var x = st.pop(); if(ArrayBuffer.isView(x) || x instanceof Map || x instanceof Set) continue;
      for(var k in x){ var y; try{ y = x[k]; }catch(e){ continue; }
        if(y && typeof y === "object" && !m.has(y) && !(typeof Node !== "undefined" && y instanceof Node)){ m.set(y, [ri, x, k]); st.push(y); } } } });
  return MK_REFIX = {ids: roots, key: key, m: m};
}
function mkRefPath(I, e){ var p = []; while(e[1] !== null){ p.unshift(e[2]); e = I.m.get(e[1]); } return [MK_REF_ROOTS[e[0]]].concat(p); }   // корень — по имени: порядок списка в другой сборке может отличаться
// ссылки на объекты корней из значений vals (имя → значение): [место — [имя, ключ…] (ключ Map — {m: ключ}), путь — [имя корня, ключ…]]
function mkSnapRefs(vals){
  var I = mkRefIndex(), out = [], seen = new Set();
  function walk(v, at){
    if(v === null || typeof v !== "object") return;
    if(I.m.has(v)){ out.push([at.slice(), mkRefPath(I, I.m.get(v))]); return; }
    if(seen.has(v) || ArrayBuffer.isView(v) || (typeof Node !== "undefined" && v instanceof Node)) return; seen.add(v);
    if(v instanceof Set) return;
    if(v instanceof Map){ v.forEach(function(x, k){ if(k === null || typeof k !== "object"){ at.push({m: k}); walk(x, at); at.pop(); } }); return; }
    for(var k in v){ var x; try{ x = v[k]; }catch(e){ continue; } at.push(k); walk(x, at); at.pop(); }
  }
  for(var n in vals) if(n.slice(0, 2) !== "__" && MK_REF_ROOTS.indexOf(n) < 0) walk(vals[n], [n]);
  return out;
}
// поставить на места ссылок объекты страницы (после восстановления переменных); путь не находится — копия остаётся (счёт в MK.refMiss)
function mkRefsApply(refs, set){
  var miss = 0;
  (refs || []).forEach(function(r){
    var to = r[1], obj; try{ obj = eval(to[0]); for(var i = 1; i < to.length && obj != null; i++) obj = obj[to[i]]; }catch(e){ obj = undefined; }
    if(obj == null || typeof obj !== "object"){ miss++; return; }
    var at = r[0]; if(at.length === 1){ set(at[0], obj); return; }
    var c; try{ c = eval(at[0]); }catch(e){ miss++; return; }
    for(var j = 1; j < at.length - 1 && c != null; j++){ var k = at[j]; c = (k && typeof k === "object") ? c.get(k.m) : c[k]; }
    if(c == null){ miss++; return; } var last = at[at.length - 1];
    if(last && typeof last === "object") c.set(last.m, obj); else c[last] = obj;
  });
  if(typeof MK !== "undefined") MK.refMiss = miss;
}
function mkSnapExt(){
  var G = nadeGuessStore.all(), base = (MAP.nadeguess && MAP.nadeguess.g) || {}, own = {}, k, live = {};
  for(k in G) if(!(k in base) || base[k] !== G[k]) own[k] = G[k];
  for(k in PATHQ){ var q = PATHQ[k]; if(q && tick - q.t <= PATHQ_TTL && q.t <= tick) live[k] = q; }
  return {guess: own, rt: nadeGuess.rt, pathq: live, pathqN: PATHQ_N, sf: mkStaticFields()};
}
// (Т-1б) поля-кэши, которые игра дописывает в объекты неизменяемых данных (MK_STATIC_FIELDS — из реестра, строки f:): [путь объекта, поле, значение]
function mkStaticFields(){
  if(typeof MK_STATIC_FIELDS === "undefined" || !MK_STATIC_FIELDS.length) return null;
  var I = mkRefIndex(), out = [];
  I.m.forEach(function(e, x){ for(var i = 0; i < MK_STATIC_FIELDS.length; i++){ var f = MK_STATIC_FIELDS[i];
    if(Object.prototype.hasOwnProperty.call(x, f)) out.push([mkRefPath(I, e), f, x[f]]); } });
  return out;
}
function mkStaticFieldsRestore(sf){
  if(!sf || typeof MK_STATIC_FIELDS === "undefined") return;
  var I = mkRefIndex();
  I.m.forEach(function(e, x){ for(var i = 0; i < MK_STATIC_FIELDS.length; i++) if(Object.prototype.hasOwnProperty.call(x, MK_STATIC_FIELDS[i])) delete x[MK_STATIC_FIELDS[i]]; });
  sf.forEach(function(r){ var p = r[0], o; try{ o = eval(p[0]); for(var j = 1; j < p.length && o != null; j++) o = o[p[j]]; }catch(e){ o = null; } if(o && typeof o === "object") o[r[1]] = r[2]; });
}
function mkExtRestore(x){
  if(!x) return;
  var G = nadeGuessStore.all(), base = (MAP.nadeguess && MAP.nadeguess.g) || {}, k;
  for(k in G) delete G[k]; for(k in base) G[k] = base[k]; for(k in x.guess) G[k] = x.guess[k];
  var R = nadeGuess.rt; for(k in R) delete R[k]; for(k in x.rt) R[k] = x.rt[k];
  PATHQ = x.pathq; PATHQ_N = x.pathqN;
  if(x.sf) mkStaticFieldsRestore(x.sf);
}
// граф связей → состояние снимка: Lp — вырезанные связи страницы до восстановления, NAV_UNLINKED — уже из снимка. Общая история —
// одинаковое начало списков; вырезанное страницей позже — вернуть (ребро и место хранит запись, 370 navUnlinkBlocked), вырезанное в снимке
// и не вырезанное страницей — вырезать так же, как navUnlinkBlocked (первое ребро с тем же «куда»)
function mkGraphTo(Lp){
  var Ls = NAV_UNLINKED, n = 0, i, ch = false;
  while(n < Lp.length && n < Ls.length && Lp[n][0] === Ls[n][0] && Lp[n][1] === Ls[n][1]) n++;
  for(i = Lp.length - 1; i >= n; i--){ var u = Lp[i], E = zoneGraph[u[0]]; if(!E || !u[3]) continue; E.splice(Math.min(u[2], E.length), 0, u[3]); ch = true; }
  for(i = n; i < Ls.length; i++){ var w = Ls[i], F = zoneGraph[w[0]] || []; for(var j = 0; j < F.length; j++) if(F[j].to === w[1]){ w[2] = j; w[3] = F[j]; F.splice(j, 1); ch = true; break; } }
  // кэш путей без команды (WPM, в снимке) в игре держит ссылку на сам граф (WPM.graph === zoneGraph; вырезание связи её не меняет);
  // в снимке она — копия графа: привязать к графу страницы, иначе кэш сбросится и пути пересчитаются не так, как в игре
  if(typeof WPM !== "undefined" && WPM.graph) WPM.graph = zoneGraph;
  return ch;
}
function mkSnapshot(){
  var list = mkSnapList();
  for(;;){
    var o = {__fmt: MK_SNAP_FMT, __ext: mkSnapExt()}; list.forEach(function(e){ o[e[0]] = e[1](); });
    o.__refs = mkSnapRefs(o);
    try{ return structuredClone(o); }catch(err){
      var bad = list.filter(function(e){ try{ structuredClone(o[e[0]]); return false; }catch(x){ return true; } });
      if(!bad.length) throw err;
      MK.snap = list = list.filter(function(e){ return bad.indexOf(e) < 0; });
      try{ console.warn("снимок: не копируются, убраны из снимка — " + bad.map(function(e){ return e[0]; }).join(", ")); }catch(x){}
    }
  }
}
// (вопрос 13, владелец 26.11, вариант а) снимок формата 1 мог сохранить у CT проверку инфо прежнего вида (до 18.11, f7995ee): одна проверка
// {round, n, by, pt, look, x, y, until, at}; с 18.11 ctInfoCheck ждёт {round, n, P: {по игроку}}. Переходник берёт только то, что есть в
// обоих видах (round, n), по игрокам — пусто, как в начале раунда: отсутствующее не придумывается. Это АДАПТИРОВАННОЕ открытие старой
// ситуации текущим кодом, а не воспроизведение старой сборкой (то — mark_replay.js со сборкой той версии)
MK_SNAP_UP[1] = function(c){
  var ct = c.teamTac && c.teamTac.CT, I = ct && ct._info;
  if(I && typeof I === "object" && !I.P){ ct._info = {round: I.round, n: I.n || 0, P: {}}; (c.__adapted = c.__adapted || []).push("teamTac.CT._info: вид до 18.11 → {round, n, P: {}}"); }
};
function mkRestore(data){ var c = structuredClone(data); for(var f = c.__fmt || 1; f < MK_SNAP_FMT; f++) if(MK_SNAP_UP[f]) MK_SNAP_UP[f](c);
  var Lp = NAV_UNLINKED.slice();
  var L = mkSnapList(); L.forEach(function(e){ if(e[0] in c) e[2](c[e[0]]); });
  if("NAV_UNLINKED" in c) mkGraphTo(Lp);
  if(c.__refs) mkRefsApply(c.__refs, function(n, v){ L.forEach(function(e){ if(e[0] === n) e[2](v); }); });
  mkExtRestore(c.__ext); mkRebaseShow(); }
// (Р5.1, 26.11) кадр показа (frameMake): снимок только переменных, которые читает показ и меняет симуляция (FRAME_VARS — состав из rebuild/gen/frame.json,
// вставляет src/marks_build.py), со ссылками на неизменяемые данные (__refs), как у снимка. frameApply — разложить кадр в переменные этой
// страницы (frameApply — показ, у которого своя симуляция стоит: Worker / процесс Node, Р5.2 / Р5.4). Проверка — tools/page/frame_apply_check.js
// граф связей зон (zoneGraph) показ читает, но в кадр он не идёт (1–1,5 МБ): как у снимка — граф загрузки минус NAV_UNLINKED (mkGraphTo)
function frameList(){ return mkSnapList().filter(function(e){ return FRAME_VARS.indexOf(e[0]) >= 0 || e[0] === "NAV_UNLINKED"; }); }
// (Р5.2, 26.11) кэши — не в кадре: и переменные-кэши (класс «кэш» реестра, src/marks_build.py), и поля-кэши в неизменяемых данных
// (MK_STATIC_FIELDS: _dz, _jcf, _jcq, _npz на графе зон — запомненный ответ от неизменяемой геометрии): страница считает их сама, как в
// обычном режиме; кадр — ~0,3 МБ вместо ~17 МБ (замер передачи — rebuild/R5_1_FRAME.md)
function frameMake(){ var o = {__frame: 1}; frameList().forEach(function(e){ o[e[0]] = e[1](); }); o.__refs = mkSnapRefs(o); return structuredClone(o); }
function frameApply(F){ var c = structuredClone(F), L = frameList(), Lp = NAV_UNLINKED.slice(); L.forEach(function(e){ if(e[0] in c) e[2](c[e[0]]); });
  if("NAV_UNLINKED" in c) mkGraphTo(Lp);
  if(c.__refs) mkRefsApply(c.__refs, function(n, v){ L.forEach(function(e){ if(e[0] === n) e[2](v); }); }); }
// (18.11) показ (трассеры, круги звука) помнит время рождения по часам страницы (nowTs), а часы в снимок не входят: после открытия снимка
// «возраст» выходил отрицательным — вспышка выстрела на весь экран (оранжевый кадр), круг звука с отрицательным радиусом ронял кадр.
// Сдвиг: самое свежее из снимка — «сейчас» по часам этой страницы, остальные — на тот же сдвиг
function mkRebaseShow(){
  var L = [typeof tracers !== "undefined" ? tracers : null, typeof soundPings !== "undefined" ? soundPings : null].filter(Boolean), mx = -Infinity;
  L.forEach(function(A){ A.forEach(function(o){ if(o && o.born > mx) mx = o.born; }); });
  if(!(mx > nowTs)) return; var sh = nowTs - mx;
  L.forEach(function(A){ A.forEach(function(o){ if(o && o.born != null) o.born += sh; }); });
}
// (v175) снимок → текст и обратно, чтобы хранить его в отметке файлом. В снимке
// объекты ссылаются друг на друга (бот → цель → бот), поэтому каждый объект
// записывается один раз, а ссылки — номером. Сохраняются Map/Set, массивы чисел,
// регулярные выражения, NaN/Infinity/-0/undefined — ровно то, что умеет structuredClone.
function mkPack(root){
  var ids = new Map(), objs = [];
  function num(v){ return v !== v ? {n:"NaN"} : v === Infinity ? {n:"I"} : v === -Infinity ? {n:"-I"} : (v === 0 && 1/v < 0) ? {n:"-0"} : v; }
  function enc(v){
    if(v === undefined) return {u:1};
    if(typeof v === "number") return num(v);
    if(v === null || typeof v !== "object") return v;
    if(ids.has(v)) return {r:ids.get(v)};
    var id = objs.length, o, i; ids.set(v, id); objs.push(null);
    if(Array.isArray(v)){ o = {a:[]}; for(i = 0; i < v.length; i++) o.a.push(enc(v[i])); }
    else if(v instanceof Map){ o = {m:[]}; v.forEach(function(x, k){ o.m.push([enc(k), enc(x)]); }); }
    else if(v instanceof Set){ o = {s:[]}; v.forEach(function(x){ o.s.push(enc(x)); }); }
    else if(ArrayBuffer.isView(v)){ o = {t:v.constructor.name, d:[]}; for(i = 0; i < v.length; i++) o.d.push(num(v[i])); }
    else if(v instanceof Date){ o = {dt:+v}; }
    else if(v instanceof RegExp){ o = {re:[v.source, v.flags]}; }
    else { o = {o:{}}; for(var k in v) if(Object.prototype.hasOwnProperty.call(v, k)) o.o[k] = enc(v[k]); }
    objs[id] = o; return {r:id};
  }
  var root2 = enc(root);
  return JSON.stringify({v:1, root:root2, objs:objs});
}
function mkUnpack(text){
  var P = JSON.parse(text), objs = P.objs;
  var made = objs.map(function(o){
    return o.a ? new Array(o.a.length) : o.m ? new Map() : o.s ? new Set() : o.t ? new globalThis[o.t](o.d.length) : o.dt != null ? new Date(o.dt) : o.re ? new RegExp(o.re[0], o.re[1]) : {};
  });
  function dec(v){
    if(v === null || typeof v !== "object") return v;
    if(v.r != null) return made[v.r];
    if(v.u) return undefined;
    return v.n === "NaN" ? NaN : v.n === "I" ? Infinity : v.n === "-I" ? -Infinity : -0;
  }
  objs.forEach(function(o, i){ var t = made[i], j;
    if(o.a) for(j = 0; j < o.a.length; j++) t[j] = dec(o.a[j]);
    else if(o.m) o.m.forEach(function(e){ t.set(dec(e[0]), dec(e[1])); });
    else if(o.s) o.s.forEach(function(e){ t.add(dec(e)); });
    else if(o.t) for(j = 0; j < o.d.length; j++) t[j] = dec(o.d[j]);
    else if(o.o) for(var k in o.o) t[k] = dec(o.o[k]);
  });
  return dec(P.root);
}
// открыть момент из снимка отметки: вся игра ровно как в момент нажатия
function mkOpenSnap(text){
  mkRestore(mkUnpack(text));
  clockPause(true); MK.cps = []; MK.cpMatch = matchNum; MK.lastCpTick = -1;
}
// «отпечаток» настроек: если стены/зоны/лайнапы/переключатели поменялись — матч пойдёт иначе
function mkFp(){
  var s = JSON.stringify(BAL) + "|" + WALLS_SIG + "|" + (USER_LINEUPS||[]).length + "|" + (USER_ZONES||[]).length + "|" + JSON.stringify(navTransform||null) + "|" + JSON.stringify(zoneLayer||null);
  var h = 2166136261; for(var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function mkCheckpoint(){
  if(roundState === "matchover") return;
  // (v521, баг владельца 10.11: «отметка до начала матча — физика разминки») в разминке снимков нет: номер матча тот же, снимок разминки попадал
  // в «снимок до» отметки / «назад 10 с» и возвращал игру в разминку (сама разминка, WARM, в снимок не входит)
  if(typeof WARM !== "undefined" && WARM.on) return;
  if(MK.cpMatch !== matchNum){ MK.cps = []; MK.cpMatch = matchNum; }
  var fp = mkFp();
  MK.cps = MK.cps.filter(function(c){ return c.fp === fp && c.tick !== tick; });
  var first = !MK.cps.some(function(c){ return c.round === roundNum; });
  MK.cps.push({tick: tick, match: matchNum, round: roundNum, fp: fp, first: first, data: mkSnapshot()});
  MK.cps.sort(function(a, b){ return a.tick - b.tick; });
  // храним последние CP_KEEP (~7 мин игры) + первый снимок каждого раунда матча
  while(MK.cps.length > MK.CP_KEEP + 32){
    var keepFrom = MK.cps.length - MK.CP_KEEP, idx = -1;
    for(var i=0;i<keepFrom;i++) if(!MK.cps[i].first){ idx = i; break; }
    MK.cps.splice(idx < 0 ? 0 : idx, 1);
  }
  MK.lastCpTick = tick;
}
// вызывается из frame() после шагов симуляции
function mkAfterTicks(){
  if(MK.busy || paused) return;
  // снимок для перемотки не должен останавливать игру: не получился — пропуск (перемотка возьмёт предыдущий), в консоль — причина
  if(MK.cpMatch !== matchNum || tick - MK.lastCpTick >= MK.CP_EVERY || tick < MK.lastCpTick){
    try{ mkCheckpoint(); }catch(e){ MK.lastCpTick = tick; MK.cpMatch = matchNum; if(typeof console !== "undefined") console.warn("снимок для перемотки не сделан:", e); } }
}
// перемотка: ближайший снимок не позже цели (или начало матча) → быстрый пересчёт до тика
function mkGoTo(match, target, done){
  if(MK.busy) return;
  MK.busy = true; clockPause(true); mkPauseLabel();
  var fp = mkFp(), cp = null;
  if(match === matchNum) MK.cps.forEach(function(c){ if(c.fp === fp && c.match === match && c.tick <= target && (!cp || c.tick > cp.tick)) cp = c; });
  if(match === matchNum && tick <= target && (!cp || tick >= cp.tick)){ /* идём вперёд от текущего */ }
  else if(cp) mkRestore(cp.data);
  else { freshMatch(match); MK.cps = []; MK.cpMatch = matchNum; }
  var from = tick, total = Math.max(1, target - from);
  var prog = document.getElementById("mkProg");
  function step(){
    var t0 = performance.now();
    while(tick < target && matchNum === match && performance.now() - t0 < 60){
      stepTick();
      if(tick % MK.CP_EVERY === 0 && tick !== MK.lastCpTick) mkCheckpoint();
    }
    if(tick < target && matchNum === match){
      prog.style.display = "block";
      prog.textContent = "Пересчитываю матч " + match + "… " + Math.round(100*(tick-from)/total) + "%";
      setTimeout(step, 0); return;
    }
    prog.style.display = "none"; MK.busy = false; clockPause(true); mkPauseLabel();
    if(done) done(tick === target && matchNum === match);
  }
  step();
}
