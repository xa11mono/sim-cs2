// ---------- weapons ----------
// weapon defines what combat is physically capable of; skill (below) decides how a
// given bot *uses* that capability (plan §13: "ошибки исполнения через
// seed-детерминированный навык"). No abstract morale/aggression stat — plan §13
// explicitly rejects that; decisions read real causes (HP, numbers, range) instead.
// Шаг 3 (план §4): полный набор оружия с ценами CS2. price — цена в магазине,
// side — кто может купить ("CT"/"T"/"both"), slot — primary/secondary,
// tier — грубая "сила" для решения "уже есть не хуже, не покупаем",
// killReward — награда за килл (CS2: винтовки/пистолеты 300, SMG 600, AWP 100),
// armorPen — какая доля урона проходит через броню, moveInacc — насколько
// бег портит точность (у AWP почти полностью).
var WEAPONS = {
  // Раздел 14: параметры — по реальным значениям CS2 (округлённо).
  //   dmg      — базовый урон в грудь; голова ×4, живот ×1.25, ноги ×0.75
  //   armorPen — доля урона, проходящая через броню (ноги броня не закрывает)
  //   rm       — падение урона с дистанцией: dmg × rm^(юниты/500)
  //   rpm      — выстрелов в минуту; mag — магазин; reload — перезарядка, с
  //   stand / move — разброс оружия стоя / на полном бегу, мрад (CS inaccuracy)
  //   recoil   — сколько мрад добавляет каждый следующий выстрел очереди
  //              (бот частично компенсирует — зависит от навыка)
  //   spam     — разброс от частой стрельбы, мрад на выстрел: его НЕЛЬЗЯ
  //              компенсировать (в CS это inaccuracy fire)
  //   reset    — за сколько тиков после очереди отдача и разброс полностью
  //              возвращаются (recovery time оружия)
  GLOCK:  {name:"Glock-18",    slot:"secondary", side:"T",    price:200,  tier:0, range: 700, dmg:30,  armorPen:0.47,  rm:0.85, rpm:400, mag:20, reload:2.2, stand:6.0, move:13,  recoil:4,  spam:11, reset:22, killReward:300},
  USP:    {name:"USP-S",       slot:"secondary", side:"CT",   price:200,  tier:0, range: 750, dmg:35,  armorPen:0.505, rm:0.99, rpm:352, mag:12, reload:2.2, stand:3.7, move:11,  recoil:5,  spam:12, reset:22, killReward:300},
  P250:   {name:"P250",        slot:"secondary", side:"both", price:300,  tier:1, range: 750, dmg:38,  armorPen:0.64,  rm:0.85, rpm:400, mag:13, reload:2.2, stand:6.2, move:13,  recoil:6,  spam:14, reset:24, killReward:300},
  TEC9:   {name:"Tec-9",       slot:"secondary", side:"T",    price:500,  tier:2, range: 700, dmg:33,  armorPen:0.906, rm:0.83, rpm:500, mag:18, reload:2.5, stand:7.0, move:14,  recoil:6,  spam:12, reset:20, killReward:300},
  FIVE7:  {name:"Five-SeveN",  slot:"secondary", side:"CT",   price:500,  tier:2, range: 750, dmg:32,  armorPen:0.911, rm:0.81, rpm:400, mag:20, reload:2.2, stand:5.8, move:13,  recoil:5,  spam:12, reset:22, killReward:300},
  DEAGLE: {name:"Desert Eagle",slot:"secondary", side:"both", price:700,  tier:3, range: 900, dmg:53,  armorPen:0.932, rm:0.81, rpm:267, mag:7,  reload:2.2, stand:5.5, move:64,  recoil:22, spam:45, reset:40, killReward:300},
  MAC10:  {name:"MAC-10",      slot:"primary",   side:"T",    price:1050, tier:4, range: 650, dmg:29,  armorPen:0.575, rm:0.80, rpm:800, mag:30, reload:2.6, stand:12,  move:22,  recoil:4,  spam:4, reset:20, killReward:600},
  MP9:    {name:"MP9",         slot:"primary",   side:"CT",   price:1250, tier:4, range: 700, dmg:26,  armorPen:0.60,  rm:0.87, rpm:857, mag:30, reload:2.1, stand:10,  move:20,  recoil:4,  spam:4, reset:20, killReward:600},
  GALIL:  {name:"Galil AR",    slot:"primary",   side:"T",    price:1800, tier:5, range:1000, dmg:30,  armorPen:0.775, rm:0.98, rpm:666, mag:35, reload:3.0, stand:6.5, move:140, recoil:7,  spam:3, reset:24, killReward:300},
  FAMAS:  {name:"FAMAS",       slot:"primary",   side:"CT",   price:2050, tier:5, range:1000, dmg:30,  armorPen:0.70,  rm:0.96, rpm:666, mag:25, reload:3.3, stand:5.5, move:120, recoil:6,  spam:3, reset:24, killReward:300},
  AK:     {name:"AK-47",       slot:"primary",   side:"T",    price:2700, tier:6, range:1100, dmg:36,  armorPen:0.775, rm:0.98, rpm:600, mag:30, reload:2.5, stand:4.8, move:147, recoil:9,  spam:3, reset:24, killReward:300},
  M4:     {name:"M4A4",        slot:"primary",   side:"CT",   price:2900, tier:6, range:1100, dmg:33,  armorPen:0.70,  rm:0.97, rpm:666, mag:30, reload:3.1, stand:3.7, move:110, recoil:7,  spam:2.5, reset:24, killReward:300},
  // AWP: 115 в грудь = фраг даже в броне, в ноги — нет (86); ~1.5с между
  // выстрелами, +0.35с на скоуп перед первым; на бегу почти не попадает
  // (7) новое оружие (CS2, округлённо). special — не берётся "лучшим по тиру",
  // только осознанно: скаут — на форс снайпера, AUG/SG — любителям прицела
  UMP:    {name:"UMP-45",      slot:"primary",   side:"both", price:1200, tier:4, range: 700, dmg:35,  armorPen:0.65,  rm:0.75, rpm:666, mag:25, reload:3.5, stand:10,  move:20,  recoil:5,  spam:4, reset:20, killReward:600},
  MP7:    {name:"MP7",         slot:"primary",   side:"both", price:1500, tier:4, range: 720, dmg:29,  armorPen:0.625, rm:0.85, rpm:800, mag:30, reload:3.1, stand:9,   move:18,  recoil:4,  spam:4, reset:20, killReward:600},
  P90:    {name:"P90",         slot:"primary",   side:"both", price:2350, tier:4, range: 750, dmg:26,  armorPen:0.69,  rm:0.86, rpm:857, mag:50, reload:3.3, stand:11,  move:20,  recoil:3.5,spam:4, reset:20, killReward:300, special:true},
  SSG:    {name:"SSG 08",      slot:"primary",   side:"both", price:1700, tier:5, range:1500, dmg:88,  armorPen:0.85,  rm:0.98, rpm:48,  mag:10, reload:3.7, stand:1.4, move:30,  recoil:0,  spam:0, reset:1, killReward:300, scopeTicks:14, special:true},
  M4S:    {name:"M4A1-S",      slot:"primary",   side:"CT",   price:2900, tier:6, range:1100, dmg:38,  armorPen:0.70,  rm:0.99, rpm:600, mag:20, reload:3.1, stand:3.0, move:110, recoil:5.5,spam:2.2, reset:24, killReward:300, silenced:true, special:true},
  AUG:    {name:"AUG",         slot:"primary",   side:"CT",   price:3300, tier:6, range:1200, dmg:28,  armorPen:0.90,  rm:0.96, rpm:600, mag:30, reload:3.8, stand:3.2, move:120, recoil:6,  spam:2.5, reset:24, killReward:300, scoped:true, special:true},
  SG:     {name:"SG 553",      slot:"primary",   side:"T",    price:3000, tier:6, range:1200, dmg:30,  armorPen:1.0,   rm:0.98, rpm:545, mag:30, reload:2.8, stand:3.4, move:140, recoil:7,  spam:2.5, reset:24, killReward:300, scoped:true, special:true},
  AWP:    {name:"AWP",         slot:"primary",   side:"both", price:4750, tier:7, range:1500, dmg:115, armorPen:0.975, rm:0.99, rpm:41,  mag:5,  reload:3.7, stand:1.0, move:220, recoil:0,  spam:0, reset:1, killReward:100, scopeTicks:22}
};
for(var wk in WEAPONS){ WEAPONS[wk].key = wk; WEAPONS[wk].fireIntervalTicks = 3840/WEAPONS[wk].rpm; } // 64 тика × 60с / rpm

// ---------- bots ----------
var SPEED = 150; // px/sec, full-speed movement
var ACCEL = 700; // px/sec^2 — counter-strafe/acceleration rate (plan §3)
var WALK_SPEED_FRAC = 0.5; // "тихий шаг" (план §3) — медленнее, но тише
// одно окно свежести на два смежных механизма плана §3: как долго "видел
// врага здесь" (§6 память) остаётся годным поводом для префайра, и как
// долго это же ощущение настороженности держит бота на тихом шаге вместо
// бега — оба про одно и то же "я думаю, тут кто-то есть", не про разное
var CAUTION_TICKS = 160; // ~2.5s at 64Hz — свежий визуальный контакт (перестаёт быть "только что видел")
// звук держится в памяти дольше визуального контакта: услышанная позиция —
// это "где он стоял", и если враг не двигался (не шумел дальше), она всё ещё
// актуальна намного дольше 2.5с, которые годятся только для мгновенного виз. контакта
var SOUND_CAUTION_TICKS = 384; // ~6s at 64Hz
var GUN_HEAR_OPEN = 350, GUN_HEAR_WALL = 260; // px — слышно выстрел: по прямой / через стены
var AIM_TURN_RATE = 11;     // рад/с — разворот прицела (180° примерно за 0.3с)
var AIM_FIRE_CONE = 0.30;   // рад (~17°) — насколько прицел должен быть на цели, чтобы стрелять
var PREFIRE_RADIUS = 140; // px — насколько близко цель должна появиться к последней известной позиции, чтобы засчитать префайр
var SOUND_RADIUS_RUN = 380, SOUND_RADIUS_WALK = 130; // v118: слышно дальше (было 250/90) — бег ≈950 юнитов CS2; // бег 250px по фидбеку; тихий шаг в той же пропорции (~0.36 от бега) // px — без учёта затухания через стены (упрощение v1, см. план §13)
var FOOTSTEP_INTERVAL_RUN = 14, FOOTSTEP_INTERVAL_WALK = 20; // ticks между "шагами"-событиями
var bots = [];
var START_MONEY = 800, MAX_MONEY = 16000;
function makeTeam(team, spawnPt, count, weapon){
  for(var i=0;i<count;i++){
    var id = team + i;
    var seed = team.charCodeAt(0)*131 + i*977;
    var ox = (i-count/2)*14, oy = (i%2)*10;
    var sp0 = spawnPosFor(spawnPt, ox, oy); ox = sp0.x-spawnPt.x; oy = sp0.y-spawnPt.y;
    bots.push({
      id: id, team: team,
      x: spawnPt.x+ox, y: spawnPt.y+oy, z: spawnPt.z||0,
      baseX: spawnPt.x+ox, baseY: spawnPt.y+oy,
      px: spawnPt.x+ox, py: spawnPt.y+oy,
      spawnOx: ox, spawnOy: oy, spawnPt: spawnPt,
      path: [], pathIdx: 0, alive: true, hp: 100,
      pickTick: -999, weapon: weapon,
      contactStreak: 0, nextShotTick: 0,
      reactionTicks: 14 + Math.floor(hashRand(seed)*16), // 0.22–0.47с — реакция живого игрока, не 0.3–0.75с
      skill: 0.8 + hashRand(seed+1)*0.4,
      state: "patrol", decisionTick: -999, holding: false,
      curSpeed: 0,
      crouching: false, holdSinceTick: -999, onStairs: false,
      burstCount: 0, lastShotTick: -999,
      peekType: null, peekSinceTick: 0,
      lastIntel: null, walking: false, lastStepTick: -999, heardSound: null,
      // экономика (шаг 3)
      money: START_MONEY, primary: null, secondary: team==="CT" ? "USP" : "GLOCK",
      armor: false, helmet: false, kills: 0, deaths: 0, roundKills: 0
    });
    bots[bots.length-1].weapon = WEAPONS[bots[bots.length-1].secondary];
  }
}
makeTeam("CT", CT_SPAWN, 5, WEAPONS.M4);
makeTeam("T", T_SPAWN, 5, WEAPONS.AK);

// ---------- роумер (план §3 "скаутинг/патрулирование") ----------
// Роумер не стоит на одной точке и не ходит по случайным точкам, как
// остальные в патруле: у него свой маршрут из 3-5 позиций, и цикл
// "дойти (у точки — тихим шагом) → выглянуть и подержать угол → отметить
// «чисто» → следующая". Услышал шаги — меняет порядок и идёт чекать
// ближайшую к звуку точку. Играет от информации: чуть охотнее отходит
// после контакта, и отходит не на спавн, а на предыдущую точку маршрута.
// Маршрут: точки "маршрут роумера CT/T" из инструмента зон (в порядке
// рисования, минимум 2), иначе — автоматически: самые простреливаемые
// позиции своей половины карты по таблице опасности (план §2).
var ROAM_CHECK_TICKS = 96;       // ~1.5с держит угол на каждой точке
var ROAM_RECHECK_TICKS = 64*8;   // точку, проверенную <8с назад, по звуку заново не чекает
var ROAM_QUIET_RADIUS = 260;     // ближе этого к точке — тихий шаг
var ROAM_ROUTES = {CT:[], T:[]};
function buildAutoRoamRoute(team){
  var own = team==="CT" ? CT_SPAWN : T_SPAWN, enemy = team==="CT" ? T_SPAWN : CT_SPAWN;
  var cands = [];
  ZONEMAP.zones.forEach(function(z){
    var c = ZONE_CENTROIDS[z.id]; if(!c) return;
    var dOwn = Math.hypot(c.x-own.x, c.y-own.y), dEn = Math.hypot(c.x-enemy.x, c.y-enemy.y);
    if(dOwn > dEn*0.95 || dOwn < 260) return; // своя половина, но не у самого спавна
    var sp = snapToWalkable(c.x, c.y);
    if(insideSolidWall(sp.x, sp.y)) return;
    cands.push({x:sp.x, y:sp.y, name:z.name||z.id, danger:(ZONE_DANGER[z.id]||[]).length});
  });
  cands.sort(function(a,b){ return b.danger-a.danger; });
  var picked = [];
  cands.forEach(function(c){
    if(picked.length >= 4) return;
    if(picked.some(function(p){ return Math.hypot(p.x-c.x, p.y-c.y) < 240; })) return;
    picked.push(c);
  });
  // порядок обхода — ближайший сосед, начиная от ближайшей к своему спавну
  var route = [], left = picked.slice(), cur = {x:own.x, y:own.y};
  while(left.length){
    var bi = 0, bd = Infinity;
    left.forEach(function(p,i){ var d = Math.hypot(p.x-cur.x, p.y-cur.y); if(d<bd){ bd=d; bi=i; } });
    cur = left.splice(bi,1)[0]; route.push(cur);
  }
  return route;
}
function buildRoamRoutes(){
  ["CT","T"].forEach(function(team){
    var kind = team==="CT" ? "roam_ct" : "roam_t";
    var user = USER_ZONES.filter(function(z){ return z.kind===kind && z.basePoints.length; }).map(function(z, i){
      var c = zoneObjCentroid(z), sp = snapToWalkable(c.x, c.y);
      return {x:sp.x, y:sp.y, name: z.name || ("роум "+team+" "+(i+1))};
    });
    ROAM_ROUTES[team] = user.length >= 2 ? user : buildAutoRoamRoute(team);
    ROAM_ROUTES[team].forEach(function(p){ p.cleared = -99999; });
  });
  bots.forEach(function(b){ if(b.role==="roamer"){ b.roamIdx = 0; b.roamChecking = false; b.roamTarget = null; b.path = []; b.pathIdx = 0; } });
}
function initRoam(b){
  b.roamIdx = 0; b.roamChecking = false; b.roamCheckUntil = 0; b.roamCheckStart = 0;
  b.roamTarget = null; b.roamPrevPt = null; b.roamLookPt = null; b._roamSoundHandled = -1; b._roamSoundLockUntil = 0;
}
// по одному роумеру в команде — последний бот (CT4 / T4)
// роумер — только у CT (CT4); у T последний бот — лёркер со своей логикой (lurkerBrain)
bots.forEach(function(b){ b.role = (b.id==="CT4") ? "roamer" : null; initRoam(b); });
buildRoamRoutes();
ROAM_READY = true;

// ======================= ШАГ 4: роли, тактики, бомба (план §5, §8) =======================
// Роли — это веса и "пост" (куда встать и куда смотреть), а не отдельный код
// под каждую роль. Тактика T — последовательность фаз с таймингами: setup →
// execute → post-plant. CT — расстановка по ролям + ротации по "коллу"
// своего, кто увидел врага у сайта. Бомба — минимальная версия (носитель,
// дроп/подбор, плант 3.2с, взрыв через 40с, дефуз 10с / 5с с китом);
// полноценный синхронный ретейк — шаг 6.

