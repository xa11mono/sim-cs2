// поле зрения inFov и всё про «кто кого видит» — 10_vision.js (v201)

// Одна запись для консоли. kind — что это для смотрящего: kill (фраг), bomb
// (плант/дефуз/взрыв), team (решение команды: план, перестройка, сейв, ретейк),
// voice (колл в тимспике), round (раунд/матч). Без kind — отладка: только в
// скрытом журнале (галочка «отладка»), в консоль не попадает.
function logEvent(text, kind){
  var e = {t: simTime.toFixed(1), text: nickify(text), kind: kind || "dbg"};
  events.unshift(e);
  if(events.length > 400) events.length = 400;
  if(e.kind !== "dbg") renderLog("log", true);
  if(logDebugOpen) renderLog("logDbg", false);
}
var logDebugOpen = false;
function renderLog(id, mainOnly){
  var el = document.getElementById(id); if(!el) return;
  var h = "", n = 0;
  for(var i = 0; i < events.length && n < (mainOnly ? 40 : 400); i++){
    var e = events[i]; if(mainOnly && e.kind === "dbg") continue; n++;
    h += '<div class="ev '+e.kind+'">['+e.t+'s] '+esc(e.text)+'</div>';
  }
  el.innerHTML = h;
}
var tracers = [];
// (v151) как выглядит выстрел у разного оружия: пистолет — тонкий короткий след и
// маленькая вспышка; ПП — частые тонкие; винтовка — как было; AWP — толстый
// мгновенный луч с ореолом, большая вспышка, след висит дольше
var TRACER_STYLE = {
  pistol:{life:130, travel:55, core:1.2, trailW:0.8, trailA:0.22, tail:0.35, fr:2, fg:2.5, fl:40},
  deagle:{life:210, travel:45, core:1.9, trailW:1.1, trailA:0.3,  tail:0.3,  fr:3, fg:5,   fl:60},
  smg:   {life:110, travel:50, core:1.1, trailW:0.7, trailA:0.18, tail:0.4,  fr:2, fg:2.5, fl:35},
  rifle: {life:170, travel:70, core:1.9, trailW:1.0, trailA:0.32, tail:0.3,  fr:3, fg:4,   fl:55},
  scout: {life:300, travel:30, core:2.3, trailW:1.4, trailA:0.45, tail:0.15, fr:4, fg:6,   fl:70},
  awp:   {life:450, travel:22, core:3.0, trailW:2.0, trailA:0.55, tail:0.05, fr:6, fg:9,   fl:90, glow:7}
};
function tracerClass(w){
  if(!w) return "rifle";
  if(w.key === "AWP") return "awp";
  if(w.key === "SSG") return "scout";
  if(w.key === "DEAGLE") return "deagle";
  if(w.slot === "secondary") return "pistol";
  if(w.tier === 4) return "smg";
  return "rifle";
}
var soundPings = []; // {x,y,team,born,radius} — footstep events, visual only (hearing itself is handled via bot.heardSound)
var nowTs = 0;

var PX_UNITS = 2.5;   // 1px радара ≈ 2.5 юнита CS2 (Ancient: scale 5.0 на 1024px, у нас 2048px)
var BODY_HALF = 6.4;  // полуширина модели, px (32 юнита)
var HEAD_HALF = 2.2;  // полуразмер головы, px (~11 юнитов)
function rayClipWalls(x1, y1, x2, y2){
  var best = 1, hit = false;
  for(var i=0;i<MANUAL_WALLS.length;i++){
    var w = MANUAL_WALLS[i];
    var rx = x2-x1, ry = y2-y1, sx = w[2]-w[0], sy = w[3]-w[1];
    var den = rx*sy - ry*sx; if(Math.abs(den) < 1e-9) continue;
    var t = ((w[0]-x1)*sy - (w[1]-y1)*sx)/den, u = ((w[0]-x1)*ry - (w[1]-y1)*rx)/den;
    if(t > 0.001 && t < best && u >= 0 && u <= 1){ best = t; hit = true; }
  }
  return {x: x1 + (x2-x1)*best, y: y1 + (y2-y1)*best, wall: hit};
}
// ---- оружие на земле: убитый роняет основное оружие, его может подобрать любой
// (в CS так поднимают AWP/AK у убитого и уносят в следующий раунд) ----
var groundWeapons = [];
function dropWeaponOnDeath(b){ if(b.primary && WEAPONS[b.primary]) groundWeapons.push({key:b.primary, x:b.x, y:b.y, t:tick, from:b.id}); }
// скорость бега по оружию, CS2 (юниты/с): пистолеты 240 (Deagle 230), MAC-10/MP9 240,
// Galil 215, FAMAS 220, AK 215, M4A4 225, AWP 200 (в прицеле 100). Считаем от M4 (=SPEED),
// чтобы средняя скорость команды почти не изменилась
var WSPEED = {UMP:230, MP7:220, P90:230, SSG:230, M4S:225, AUG:220, SG:210, GLOCK:240, USP:240, P250:240, TEC9:240, FIVE7:240, DEAGLE:230, MAC10:240, MP9:240, GALIL:215, FAMAS:220, AK:215, M4:225, AWP:200};
function weaponSpeedMul(b){
  if(!b.weapon) return 1;
  return (WSPEED[b.weapon.key] || 225)/225;
}
// подбор (правило CS2): оружие поднимается само, если пройти по нему и слот
// основного оружия пуст. Сходить за оружием или поменять своё — решение мозга
function weaponPickupTick(){
  if(roundState !== "live" || !groundWeapons.length) return;
  bots.forEach(function(b){
    if(!b.alive || b.primary) return;
    for(var i=0;i<groundWeapons.length;i++){
      var G = groundWeapons[i];
      if(Math.hypot(G.x-b.baseX, G.y-b.baseY) > 38) continue;
      groundWeapons.splice(i, 1);
      b.primary = G.key; b.weapon = WEAPONS[G.key]; b._ammoFor = null;
      makeSound(b, b.x, b.y, "pickup");
      logEvent(b.id+" подобрал "+WEAPONS[G.key].name+(G.from ? " ("+G.from+")" : ""));
      return;
    }
  });
}
// ======================= ЗВУК: одно место на все звуки (К11) =======================
// Всё, что в CS2 можно услышать, рождается только здесь — makeSound. Слышат
// враги в радиусе своего звука; через стену — ближе и неточнее. Человек по звуку
// понимает НАПРАВЛЕНИЕ довольно точно (±6°), дистанцию — примерно (±15%); через
// стену направление расплывается (±17°), дистанция гуляет (±30%). Ника по звуку
// не узнать: в услышанном нет «кто», только «что и примерно откуда».
// У бота — короткий список услышанного за 3 с (b.ears): по нему видно, один
// источник или несколько с разных сторон. b.heardSound — последний звук.
// Бег слышно, шифт — нет (кроме воды). Прыжков в игре нет — их звука тоже.
var SOUND = {
  steps:   {open:SOUND_RADIUS_RUN, wall:SOUND_RADIUS_RUN*0.75, say:"шаги"},
  water:   {open:460, wall:345, say:"всплески в воде"},
  shots:   {open:GUN_HEAR_OPEN, wall:GUN_HEAR_WALL, say:"стрельбу"},
  hit:     {open:1e9, wall:1e9, say:"что стреляют по мне"},
  reload:  {open:380, wall:220, say:"перезарядку"},
  zoom:    {open:200, wall:120, say:"зум AWP"},
  nade:    {open:NADE_HEAR_R, wall:NADE_HEAR_R, say:"бросок гранаты"},
  pop:     {open:900, wall:650, see:1400, say:"разрыв гранаты"},
  nadefly: {open:0, wall:0, see:1200, say:"гранату — прилетела"},   // видел полёт: откуда кинули — примерно
  plant:   {open:850, wall:520, say:"плант"},
  beep:    {open:850, wall:520, say:"писк бомбы"},   // радиус — как у планта: проектное число, источника нет (заплатка)
  defuse:  {open:DEFUSE_HEAR, wall:DEFUSE_HEAR, say:"дефуз"},
  defusing:{open:DEFUSE_HEAR, wall:DEFUSE_HEAR, say:"дефуз"},   // тот же звук продолжается (не новый)
  pickup:  {open:250, wall:150, say:"подбор оружия"}
};
var EARS_KEEP = 3*64; // тиков (64 в секунду; TICK_HZ объявлен позже, в 17_tick.js)
function hearPos(o, sx, sy, seed, occl){
  var d = Math.hypot(sx-o.x, sy-o.y), a = Math.atan2(sy-o.y, sx-o.x);
  var sa = occl ? 0.30 : 0.10, sd = occl ? 0.30 : 0.15;
  var ra = hashRand(seed) + hashRand(seed*7+3) - 1;       // треугольное −1…1: чаще около нуля
  var rd = hashRand(seed*13+5) + hashRand(seed*17+11) - 1;
  var pd = Math.max(20, d*(1 + rd*sd)), pa = a + ra*sa;
  return {x:o.x + Math.cos(pa)*pd, y:o.y + Math.sin(pa)*pd};
}
// src — кто шумит (только для того, кому звук слышен: враги src); opt:
//   mul — громкость (глушитель 0.55), only — слышит только этот бот (попадание),
//   info — что звук говорит сам по себе (перезарядка: сколько длится по оружию)
function makeSound(src, x, y, kind, opt){
  opt = opt || {};
  var S = SOUND[kind], heard = [], mul = opt.mul || 1, via = opt.via || {x:x, y:y};
  var seed0 = tick*331 + (src.id.charCodeAt(src.id.length-1)||0)*17 + (src.id.charCodeAt(0)||0)*7 + (opt.seed||0);
  bots.forEach(function(o){
    if(!o.alive || o.team === src.team) return;
    if(opt.only && o !== opt.only) return;
    // via — что именно видно/слышно (полёт гранаты), x,y — что из этого понятно (откуда кинули)
    // открыто или через стену: глаза слушающего → источник (полёт гранаты — видно ли его, с дымом)
    var d = Math.hypot(o.x-via.x, o.y-via.y), oz = visEyeZ(o);
    var los = opt.via ? visLine(o.x, o.y, oz, via.x, via.y, visFloorAt(via.x, via.y) + 90, true)
                      : visLine(o.x, o.y, oz, x, y, visFloorAt(x, y) + VIS_EYE.stand);
    var seen = S.see && los && d <= S.see;
    if(!seen && d > (los ? S.open : S.wall)*mul) return;
    if(opt.skip && opt.skip(o)) return; // уже видел сам источник
    var p = hearPos(o, x, y, seed0 + (o.id.charCodeAt(o.id.length-1)||0)*131 + (o.id.charCodeAt(0)||0)*11, !los || !!opt.via);
    var e = {x:p.x, y:p.y, tick:tick, team:src.team, kind:kind, occl:!los};
    if(opt.info) for(var k in opt.info) e[k] = opt.info[k];
    if(kind === "defusing"){ heard.push(o); return; } // продолжение дефуза — не новый звук
    var E = o.ears || (o.ears = []);
    while(E.length && tick - E[0].tick > EARS_KEEP) E.shift();
    E.push(e);
    // последний услышанный человек; разрыв гранаты — это где граната, а не где враг
    if(kind !== "pop") o.heardSound = e;
    heard.push(o);
  });
  return heard;
}
var WATER_Z = {};
function inWater(x, y){
  var zid = zoneIdAt(x, y); if(!zid) return false;
  if(!(zid in WATER_Z)) WATER_Z[zid] = /water|вода/i.test(zoneUserName(zid) || "");
  return WATER_Z[zid];
}
// перезарядка (правило CS2): пустой магазин — перезарядка сама; её слышно
// (по звуку понятно, каким оружием, значит, сколько она длится). Тактическая
// перезарядка и смена на пистолет — решения мозга
function updateReload(b){
  var w = b.weapon; if(!w || !b.alive) return;
  if(b._ammoFor !== w.key){ b._ammoFor = w.key; b.ammo = w.mag; b._reloading = false; b.reloadUntil = 0; }
  if(b._reloading && tick >= b.reloadUntil){ b._reloading = false; b.ammo = w.mag; }
  if(!b._reloading && b.ammo <= 0){
    b._reloading = true; b.reloadUntil = tick + Math.round(w.reload*TICK_HZ);
    logEvent(b.id+": перезарядка ("+w.name+", "+w.reload+"с)");
    makeSound(b, b.x, b.y, "reload", {info:{until: b.reloadUntil}});
  }
}
