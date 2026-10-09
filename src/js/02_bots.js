// ---------- weapons ----------
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
var GUN_HEAR_OPEN = 350, GUN_HEAR_WALL = 260; // px — слышно выстрел: по прямой / через стены
var AIM_TURN_RATE = 11;     // рад/с — разворот прицела (180° примерно за 0.3с)
var AIM_FIRE_CONE = 0.30;   // рад (~17°) — насколько прицел должен быть на цели, чтобы стрелять
var SOUND_RADIUS_RUN = 380; // px — бег слышно по прямой (через стену — 0,75); шифт не слышно
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
      skill: 1.0,
      curSpeed: 0,
      crouching: false, onStairs: false,
      burstCount: 0, lastShotTick: -999,
      walking: false, lastStepTick: -999, heardSound: null, ears: [],
      // экономика (шаг 3)
      money: START_MONEY, primary: null, secondary: team==="CT" ? "USP" : "GLOCK",
      armor: false, helmet: false, kills: 0, deaths: 0, roundKills: 0
    });
    bots[bots.length-1].weapon = WEAPONS[bots[bots.length-1].secondary];
  }
}
makeTeam("CT", CT_SPAWN, 5, WEAPONS.M4);
makeTeam("T", T_SPAWN, 5, WEAPONS.AK);

// ---------- роли (шаг 4; профили — RoleProfile в 03_settings.js) ----------
// Роль закреплена за ником (реальный игрок), на каждой стороне своя.
// igl — совмещается с основной ролью (флаг b.igl). Роль бота на матч —
// по нику и стороне, на которой он играет. Пока поведение роль не меняет.
var ROLES_BY_NICK = {
  // Falcons
  karrigan: { T:"entry",   CT:"support", igl:true },
  m0NESY:   { T:"awp",     CT:"awp" },
  NiKo:     { T:"lurker",  CT:"entry" },    // CT: «настоящий инициатор» агрессии на миде (caubycs, docs/PRO_PLAY.md 5)
  kyousuke: { T:"entry",   CT:"entry" },
  TeSeS:    { T:"support", CT:"anchor" },
  // Spirit
  magixx:   { T:"entry",   CT:"support", igl:true },
  donk:     { T:"entry",   CT:"entry" },
  sh1ro:    { T:"awp",     CT:"awp" },
  TN1R:     { T:"lurker",  CT:"support" },
  zont1x:   { T:"support", CT:"anchor" }
};
// вызывается один раз при загрузке (из 16_economy.js, когда ники уже есть);
// freshMatch возвращает b.role/b.igl к этим значениям (BOT_INIT)
function assignRoles(){
  bots.forEach(function(b){
    var r = ROLES_BY_NICK[nick(b.id)] || {};
    b.role = r[b.team] || null;
    b.igl = !!r.igl;
  });
}
function logRoles(){
  ["T", "CT"].forEach(function(team){
    var s = bots.filter(function(b){ return b.team === team; })
      .map(function(b){ return nick(b.id)+" — "+(b.role || "?")+(b.igl ? "+igl" : ""); }).join(", ");
    logEvent("Роли "+team+": "+s, "round");
  });
}
