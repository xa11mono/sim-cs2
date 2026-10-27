// ======================= ЗНАНИЕ БОТА О ВРАГАХ (v240, из переделки v197–v238) =======================
// Одно место на «что бот знает о врагах». У каждого бота — своё b.know; правда о мире сюда
// попадает только так, как её мог узнать игрок:
//   • свои глаза (b._visible из resolveEngagements) и радар — враг, которого сейчас видит любой
//     живой тиммейт (в CS2 он сразу точкой на радаре у всей команды);
//   • свои уши — записи b.ears (hearReal: шаги, вода, стрельба, перезарядка, граната, плант, дефуз):
//     «что и примерно откуда», без «кто»;
//   • войс — то, что тиммейт договорил в канале (teamChannel → knowCall): только зона и сколько;
//   • киллфид — кто кого убил (feedKill → knowKill), место смерти своего видно по радару;
//   • плант — объявление «бомба заложена»; свои глаза на пустой точке — «посмотрел, а там никого».
// Вера в позицию врага — набор гипотез: held (стоит, где видели), moved (ушёл по маршруту зон
// к полезному его стороне месту), moved_unknown (ушёл тихо, куда — неизвестно). Веса меняются
// ТОЛЬКО событиями; время само веса не трогает. Карта команды belief[team][враг] (её читают все
// решения v166) собирается из этих гипотез в beliefTick — сама по себе она больше не растекается.
// Числа KNOW — проектные числа переделки (не из демок), первые кандидаты на замену замерами.
var KNOW = {
  heldStill:   0.50,  // проектное число: стартовый вес held, если враг стоял/крался, когда пропал из вида
  heldMoving:  0.20,  // проектное число: … если бежал
  unknownStart:0.10,  // проектное число: стартовый вес moved_unknown
  dirBoost:    3.0,   // проектное число: ветка по направлению бега ×3, в обратную ×1/3
  maxBranches: 3,     // проектное число: moved-веток не больше
  maxHops:     4,     // проектное число: насколько далеко (в зонах) смотрит ветка
  quiet:       0.5,   // проектное число: окно «было бы слышно» прошло без шагов — ветка ×0.5
  emptyLook:   0.15,  // проектное число: посмотрел на точку — никого: ×0.15
  heldFloor:   0.03,  // проектное число: ниже held не опускается без факта
  lookEvery:   8,     // как часто бот «оглядывает» точки гипотез, тиков
  lookRange:   1100,  // проектное число: дальше точку не разглядеть, px
  soundL: {steps:0.85, water:0.85, shots:0.9, hit:0.9, reload:0.8, nade:0.5, plant:0.9, defuse:0.9},  // проектные числа: насколько звук говорит «враг там»
  voiceL: {see:0.9, hear:0.7, death:0.9},   // проектные числа: то же для войса
  unknownCompat: 0.3, // проектное число: moved_unknown объясняет звук хуже конкретной ветки
  sameSource:  1.5,   // с: тот же звук из того же места — тот же источник
  memSec:      20,    // с: сколько бот помнит услышанное сам
  srcApart:    150,   // px: звуки ближе — один источник (knowSources; проектное число переделки)
  srcSec:      3      // с: за сколько считать источники (проектное число переделки)
};
var KNOW_SAY = {steps:"шаги", water:"всплески в воде", shots:"стрельбу", hit:"что стреляют по мне", reload:"перезарядку", nade:"бросок гранаты", plant:"плант", defuse:"дефуз"};
// позиции про из 88 демок Ancient (tools/positions_bake.py в ветке rebuild-v238; поля: сторона, тип, x, y,
// доля раундов, spread, варианты места [x, y, доля]); n / byP / byW — в скольких раундах там стояли все / каждый
// из наших 10 игроков / с каким оружием, repeat — вернулся ли на ту же позицию в следующем раунде, w — в скольких раундах
// на этой и другой позиции одновременно стояли двое из одной команды (tools/player_positions_bake.py, v246/v249). Знание карты: где обычно стоит соперник; и варианты, куда встать самому
var KNOW_POSITIONS = MAP.pro.positions;
var KNOW_TRACE = null;   // {id: true} — чьи события пишутся в KNOW_LOG
var KNOW_LOG = [];

// звук дошёл до игрока o: v166 кладёт его в o.heardSound, знание — в o.ears (одно место на «услышал»)
function hearReal(o, s){
  if(roundState === "live"){ var sb = s.src ? teamBot(s.src) : null;   // (v358) этаж слышно (сверху / снизу) — высота источника
    (o.ears || (o.ears = [])).push({x:s.x, y:s.y, z: sb ? sb.z : null, tick:tick, team:s.team, kind:s.kind, occl:!!s.occl}); }
  // (v359, отметка владельца: m0NESY услышал флешку sh1ro из Connector в паре метров, а через 1 с молотов zont1x в 230 ед. —
  // «куда смотреть» перескочило на дальний звук, sh1ro вышел и убил) свежий (≤ 1,5 с) звук того же врага вдвое ближе — главнее
  // нового дальнего: взгляд остаётся на нём (знание получает оба — через ears)
  var cur = o.heardSound;
  if(cur && cur.team && cur.team === s.team && s.kind !== "hit" && tick - cur.tick < 96 &&
     Math.hypot(cur.x-o.x, cur.y-o.y) < 0.5*Math.hypot(s.x-o.x, s.y-o.y)) return cur;
  return s;
}

// ---------- граф зон-коллаутов ----------
var KG = null;
function knowGraph(){
  var sig = ZONEMAP.zones.length + ":" + ZONEMAP.portals.length;
  if(KG && KG.sig === sig) return KG;
  var g = {sig: sig, adj: {}, c: {}, r: {}, posT: {}, posCT: {}, site: {}};
  ZONEMAP.zones.forEach(function(z){
    var sx = 0, sy = 0, a = 0, P = z.points;
    P.forEach(function(p){ sx += p.x; sy += p.y; });
    for(var i = 0, j = P.length-1; i < P.length; j = i++) a += P[j].x*P[i].y - P[i].x*P[j].y;
    g.c[z.id] = {x: sx/P.length, y: sy/P.length};
    g.r[z.id] = 0.5*Math.sqrt(Math.abs(a)/2);
    g.adj[z.id] = [];
  });
  ZONEMAP.portals.forEach(function(p){
    if(!g.adj[p.a] || !g.adj[p.b]) return;
    if(g.adj[p.a].indexOf(p.b) < 0) g.adj[p.a].push(p.b);
    if(g.adj[p.b].indexOf(p.a) < 0) g.adj[p.b].push(p.a);
  });
  KNOW_POSITIONS.points.forEach(function(p){
    var zid = zoneIdAt(p.x, p.y); if(!zid) return;
    (p.side === "T" ? g.posT : g.posCT)[zid] = true;
  });
  for(var k in SITES){
    var zs = zoneIdAt(SITES[k].x, SITES[k].y); if(zs) g.site[zs] = k;
    for(var zid2 in g.c) if(onSite(SITES[k], g.c[zid2].x, g.c[zid2].y)) g.site[zid2] = k;
  }
  KG = g; return g;
}
// (v358, владелец: «не распознают шаги T в Underpass, ложная инфа» — T внизу, а колл «шаги Short») зоны-коллауты — плоские
// (по подписям радара), а там, где этажи друг над другом, у точки две зоны. С высотой: участок навмеша под точкой на этом
// этаже → его зона. Участки, над/под которыми есть другой этаж (> NAVZ_FLOOR ед.), получают зону соседей по своему этажу
// (обход по связям навмеша от ближайших участков без второго этажа), а не плоскую
var NAVZ_FLOOR = 100, NAVZ_NEAR = 120, NAV_ZONE = null;
// (А5) у зон из 3D-геометрии (tools/map3d/zones_game.py) зона каждого участка уже посчитана по этажам — MAP.zones.navZone
function navZoneBuild(){
  if(MAP.zones.navZone){ NAV_ZONE = {}; NAVAREAS.forEach(function(a){ var z = MAP.zones.navZone[a.id]; if(z) NAV_ZONE[a.id] = z; }); return; }
  if(!NAV_GRID) navGridBuild();
  NAV_ZONE = {}; var byId = {}, over = {}, Q = [];
  NAVAREAS.forEach(function(a){ byId[a.id] = a; });
  NAVAREAS.forEach(function(a){
    var cx = 0, cy = 0; a.points.forEach(function(p){ cx += p.x; cy += p.y; }); cx /= a.points.length; cy /= a.points.length;
    var L = NAV_GRID[Math.floor(cx/NAV_GRID_C)+","+Math.floor(cy/NAV_GRID_C)] || [];
    over[a.id] = L.some(function(k){ var o = NAVAREAS[k]; return o !== a && Math.abs(o.z - a.z) > NAVZ_FLOOR && pointInPoly(cx, cy, o.points); });
    if(!over[a.id]){ var zid = zoneIdAt(cx, cy); if(zid){ NAV_ZONE[a.id] = zid; Q.push(a); } }
  });
  for(var qi = 0; qi < Q.length; qi++){ var a = Q[qi];
    (a.conn || []).forEach(function(bid){ var nb = byId[bid]; if(!nb || NAV_ZONE[bid] || !over[bid] || Math.abs(nb.z - a.z) > JUMP_UP) return;
      NAV_ZONE[bid] = NAV_ZONE[a.id]; Q.push(nb); }); }
}
function zoneIdAt3(x, y, z){
  if(z == null) return zoneIdAt(x, y);
  if(!NAV_ZONE) navZoneBuild();
  // под точкой пол другого этажа (звук с разбросом попал «на мост» над Underpass) — ближайший участок своего этажа в
  // NAVZ_NEAR ед. карты (проектное число)
  var a = navNearestZ(x, y, 24, z);
  if(!a || Math.abs(a.z - z) > NAVZ_FLOOR) a = navFloorNear(x, y, NAVZ_NEAR, function(q){ return Math.abs(q.z - z) <= NAVZ_FLOOR; });
  return (a && NAV_ZONE[a.id]) || zoneIdAt(x, y);
}
function knowZoneAt(x, y, zh){
  var z = zoneIdAt3(x, y, zh); if(z) return z;
  var g = knowGraph(), best = null, bd = Infinity;
  for(var id in g.c){ var d = Math.hypot(g.c[id].x-x, g.c[id].y-y) - g.r[id]; if(d < bd){ bd = d; best = id; } }
  return best;
}
function knowNearestSite(x, y){
  var best = null, bd = Infinity;
  for(var k in SITES){ var d = Math.hypot(SITES[k].x-x, SITES[k].y-y); if(d < bd){ bd = d; best = k; } }
  return best;
}
function knowZoneName(zid){ return zid ? (zoneUserName(zid) || zid) : "?"; }
// насколько зона полезна стороне врага (смысл места): сайт / их стоянка / проход
function knowValue(zid, side, K){
  var g = knowGraph(), site = g.site[zid];
  if(K.planted){
    if(side === "CT") return site ? (site === K.plantSite ? 4 : 1) : (g.posCT[zid] ? 1.5 : 1);
    if(site) return (!K.plantSite || site === K.plantSite) ? 4 : 1;
    return g.posT[zid] ? 1.5 : 1;
  }
  if(site) return 3;
  return (side === "T" ? g.posT : g.posCT)[zid] ? 2 : 1;
}

// (v432) где, по знанию команды, враг id сейчас: виден — где виден; иначе точки гипотез с весами (held — где был, moved — центр зоны,
// куда мог уйти с учётом направления хода; moved_unknown — без места). Знание у бойцов одной команды общее по радару — берётся у первого живого
function knowEnemySpots(team, id){
  var g = knowGraph();
  for(var i = 0; i < bots.length; i++){ var b = bots[i]; if(!b.alive || b.team !== team || !b.know || !b.know.enemies) continue;
    var B = b.know.enemies[id]; if(!B) return [];
    if(B.visible) return [{x: B.last.x, y: B.last.y, w: 1}];
    return (B.hyps || []).map(function(h){ var p = h.type === "held" ? h : (h.zone && g.c[h.zone]); return p ? {x: p.x, y: p.y, w: h.weight || 0} : null; }).filter(Boolean);
  }
  return [];
}

// (v438) сколько врагов (сумма весов гипотез знания команды) может быть ближе r хотя бы к одной из точек pts: держит / видели — по точке,
// «ушёл в зону» — по центру зоны, «ушёл неизвестно куда» — не считается. Для «услышит ли кто-то мой бег»
function knowMassNear(team, pts, r){
  var K = null; for(var i = 0; i < bots.length && !K; i++){ var b = bots[i]; if(b.alive && b.team === team && b.know && b.know.enemies) K = b.know.enemies; }
  if(!K) return 0;
  var g = knowGraph(), m = 0;
  bots.forEach(function(e){ if(!e.alive || e.team === team) return; var B = K[e.id]; if(!B) return;
    var near = function(x, y){ return pts.some(function(q){ return Math.hypot(q[0]-x, q[1]-y) <= r; }); };
    if(B.visible){ if(near(B.last.x, B.last.y)) m += 1; return; }
    (B.hyps || []).forEach(function(h){ var w = h.weight || 0; if(!w) return;
      if(h.type === "held"){ if(near(h.x, h.y)) m += w; }
      else if(h.zone && g.c[h.zone] && near(g.c[h.zone].x, g.c[h.zone].y)) m += w; }); });   // зона — по её центру, как knowEnemySpots (по краю зоны — соседняя зона «рядом» почти всегда: замер v438 — шифта стало больше)
  return m;
}
// ---------- гипотезы от последнего точного контакта ----------
function knowBuild(K, side, last){
  var g = knowGraph(), Z0 = last.zone, hyps = [];
  var moving = Math.hypot(last.vx||0, last.vy||0) > SPEED*0.3;
  var held = {type: "held", zone: Z0, x: last.x, y: last.y, weight: moving ? KNOW.heldMoving : KNOW.heldStill};
  var unk = {type: "moved_unknown", zone: null, weight: KNOW.unknownStart};
  var branches = [];
  if(Z0 && g.adj[Z0]){
    var prev = {}, depth = {}, q = [Z0], cand = [];
    prev[Z0] = null; depth[Z0] = 0;
    while(q.length){
      var z = q.shift();
      if(z !== Z0) cand.push(z);
      if(depth[z] >= KNOW.maxHops) continue;
      g.adj[z].forEach(function(n){ if(n in prev) return; prev[n] = z; depth[n] = depth[z]+1; q.push(n); });
    }
    cand.forEach(function(D){
      var route = []; for(var z2 = D; z2 !== Z0; z2 = prev[z2]) route.unshift(z2);
      var prior = knowValue(D, side, K);
      if(moving && !last.nodir){
        var c = g.c[route[0]], dx = c.x-last.x, dy = c.y-last.y, L = Math.hypot(dx, dy)*Math.hypot(last.vx, last.vy);
        var cos = L ? (dx*last.vx + dy*last.vy)/L : 0;
        prior *= Math.pow(KNOW.dirBoost, cos);
      }
      branches.push({type: "moved", zone: D, route: route, prior: prior, score: prior - 0.1*depth[D]});
    });
    branches.sort(function(a, b){ return b.score - a.score; });
    var one = g.adj[Z0].length < 2, chosen = [], dirs = {};
    branches.forEach(function(b){
      if(chosen.length >= KNOW.maxBranches) return;
      var key = one ? (b.route[1] || b.route[0]) : b.route[0];
      if(dirs[key]) return;
      dirs[key] = true; chosen.push(b);
    });
    branches = chosen;
    branches.forEach(function(b){ delete b.score; });
  }
  var rest = 1 - held.weight - unk.weight, sp = 0;
  branches.forEach(function(b){ sp += b.prior; });
  if(!branches.length) held.weight += rest;
  branches.forEach(function(b){ b.weight = rest*b.prior/sp; b.windows = knowWindows(b.route, last); delete b.prior; });
  hyps.push(held); branches.forEach(function(b){ hyps.push(b); }); hyps.push(unk);
  return hyps;
}
// окна: когда бегущий враг был бы в каждой зоне маршрута (самый быстрый бег — вход, медленный — выход)
function knowWindows(route, last){
  var g = knowGraph(), W = [], px = last.x, py = last.y, d = 0;
  var fast = SPEED/TICK_HZ, slow = SPEED*0.8/TICK_HZ;
  route.forEach(function(z){
    var c = g.c[z], r = g.r[z];
    d += Math.hypot(c.x-px, c.y-py); px = c.x; py = c.y;
    W.push({zone: z, t0: last.tick + Math.max(0, d-r)/fast, t1: last.tick + (d+r)/slow, done: false});
  });
  return W;
}
function knowNorm(hs){
  var s = 0; hs.forEach(function(h){ s += h.weight; });
  if(s > 0) hs.forEach(function(h){ h.weight /= s; });
  var held = null; hs.forEach(function(h){ if(h.type === "held") held = h; });
  if(held && held.weight < KNOW.heldFloor){
    var need = KNOW.heldFloor - held.weight, o = 1 - held.weight;
    hs.forEach(function(h){ if(h !== held) h.weight -= need*h.weight/o; });
    held.weight = KNOW.heldFloor;
  }
}
function knowHyp(B, type){ for(var i = 0; i < B.hyps.length; i++) if(B.hyps[i].type === type) return B.hyps[i]; return null; }
function knowTrace(b, enemyId, cause){
  if(!KNOW_TRACE || !KNOW_TRACE[b.id]) return;
  var B = b.know.enemies[enemyId];
  KNOW_LOG.push({tick: tick, who: b.id, enemy: enemyId, cause: cause,
    hyps: B ? B.hyps.map(function(h){ return [h.type, h.type === "moved_unknown" ? "?" : knowZoneName(h.zone), +h.weight.toFixed(3)]; }) : null});
}
function knowNewBelief(K, b, e, last){
  var B = {id: e.id, side: e.team, last: last, visible: false};
  B.hyps = knowBuild(K, e.team, last);
  K.enemies[e.id] = B; return B;
}

// ---------- типичные места врага — знание карты ----------
// Стандартные точки соперника из демок (без подпушей), без «кто» и без долей: «тут может стоять».
// Открыто, пока бот сам не увидел место пустым; снова открывается от звука/войса о враге в той зоне.
var KNOW_SPOTS = {};
function knowSpotBase(side){
  if(!KNOW_SPOTS[side]) KNOW_SPOTS[side] = KNOW_POSITIONS.points.filter(function(p){ return p.side === side && p.type === "standard" && !p.push; })
    .map(function(p){
      var sp = side === "CT" ? CT_SPAWN : T_SPAWN, P = buildWaypointPath(sp.x, sp.y, 0, p.x, p.y, 0), L = 0, px = sp.x, py = sp.y;
      (P || []).forEach(function(q){ L += Math.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1]; });
      L += Math.hypot(p.x-px, p.y-py);
      return {id: p.id, x: p.x, y: p.y, zone: knowZoneAt(p.x, p.y), run: L};
    });
  return KNOW_SPOTS[side];
}
function knowSpotReach(p){ return (tick - roundStartTick)/TICK_HZ*SPEED >= p.run; }

// ---------- начало раунда: враги на своём спавне ----------
function knowRoundStart(b){
  var K = b.know = {key: matchNum + ":" + roundNum, enemies: {}, heard: [], planted: false, plantSite: null, alive: 0,
                    spots: knowSpotBase(b.team === "CT" ? "T" : "CT").map(function(p){ return {id: p.id, x: p.x, y: p.y, zone: p.zone, run: p.run, open: true}; })};
  b.ears = [];
  var sp = b.team === "CT" ? T_SPAWN : CT_SPAWN, zone = knowZoneAt(sp.x, sp.y);
  bots.forEach(function(e){
    if(e.team === b.team || !e.alive) return;
    K.alive++;
    knowNewBelief(K, b, e, {x: sp.x, y: sp.y, zone: zone, tick: tick, stance: "stand", source: "spawn", vx: SPEED*0.31, vy: 0, nodir: true});
    knowTrace(b, e.id, "начало раунда: враг на своём спавне");
  });
}

// ---------- зрение и радар: вижу / потерял ----------
function knowVision(b){
  var K = b.know, seen = {}, list = [], own = {};
  bots.forEach(function(m){ if(m.alive && m.team === b.team) (m._visible || []).forEach(function(e){ if(e.alive && !seen[e.id]){ seen[e.id] = true; list.push(e); } }); });
  (b._visible || []).forEach(function(e){ own[e.id] = true; });
  list.forEach(function(e){
    var B = K.enemies[e.id];
    var last = {x: e.x, y: e.y, zone: knowZoneAt(e.x, e.y, e.z), tick: tick, stance: e.crouching ? "crouch" : "stand",
                source: "vision", vx: (e.x - (e.px === undefined ? e.x : e.px))*TICK_HZ, vy: (e.y - (e.py === undefined ? e.y : e.py))*TICK_HZ,
                weapon: e.weapon && e.weapon.key};
    var was = B && B.visible;
    if(!B){ B = K.enemies[e.id] = {id: e.id, side: e.team}; }
    B.last = last; B.visible = true; B.mine = !!own[e.id];   // (v432) visible — видит команда (радар), mine — сам (колл «вижу» — только своё)
    B.hyps = [{type: "held", zone: last.zone, x: last.x, y: last.y, weight: 1}];
    if(e.planting && !K.planted) K.plantSeen = knowNearestSite(e.x, e.y);
    if(!was) knowTrace(b, e.id, "увидел (" + knowZoneName(last.zone) + ")");
  });
  for(var id in K.enemies){
    var B2 = K.enemies[id];
    if(B2.visible && !seen[id]){
      B2.visible = false; B2.mine = false;
      B2.hyps = knowBuild(K, B2.side, B2.last);
      B2.hyps[0].inView = true;   // край видимости: «пусто» засчитается, только когда посмотрят заново
      knowTrace(b, id, "потерял из вида (" + knowZoneName(B2.last.zone) + ")");
    }
  }
}

// ---------- слух: новые записи b.ears ----------
function knowHearing(b){
  var K = b.know, E = b.ears || [];
  for(var i = 0; i < E.length; i++){
    var s = E[i];
    if(s.kind === "defuse") K.defuseT = tick;
    if(!(s.kind in KNOW.soundL)) continue;
    var d = Math.hypot(s.x-b.x, s.y-b.y), err = d*(s.occl ? 0.3 : 0.15) + 40;
    var zone = knowZoneAt(s.x, s.y, s.z);
    K.heard.push({x: s.x, y: s.y, zone: zone, kind: s.kind, tick: tick, err: err});
    if(s.kind === "plant" && !K.planted) K.plantHeard = knowNearestSite(s.x, s.y);
    knowApply(b, s, err, zone, KNOW.soundL[s.kind], {say: "услышал " + (KNOW_SAY[s.kind] || s.kind)});
  }
  b.ears = [];
  while(K.heard.length && tick - K.heard[0].tick > KNOW.memSec*TICK_HZ) K.heard.shift();
}
// сколько разных врагов бот слышал за sec с (шаги / вода / стрельба); звуки ближе KNOW.srcApart — один источник
function knowSources(K, test, sec){
  var src = [];
  if(K) K.heard.forEach(function(h){
    if(tick - h.tick > sec*TICK_HZ || (h.kind !== "steps" && h.kind !== "water" && h.kind !== "shots") || !test(h)) return;
    // (v358, владелец: «пишется двое Underpass, а живой только один») один бегущий враг за sec с шумит в разных местах —
    // раньше каждое место дальше srcApart считалось новым врагом. Теперь источник «идёт» за звуком: тот же, если до его
    // последнего звука не дальше srcApart + путь бегом за прошедшее время
    var q = null;
    for(var qi = 0; qi < src.length && !q; qi++){ var Q = src[qi]; if(Math.hypot(Q.x - h.x, Q.y - h.y) < KNOW.srcApart + SPEED*Math.abs(h.tick - Q.tick)/TICK_HZ) q = Q; }
    if(q){ q.x = h.x; q.y = h.y; q.tick = h.tick; } else src.push({x: h.x, y: h.y, tick: h.tick, zone: h.zone});
  });
  return src;
}
