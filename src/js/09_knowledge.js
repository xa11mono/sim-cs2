// ======================= ЗНАНИЕ БОТА О ВРАГАХ (Knowledge) =======================
// Одно место на «что бот знает о врагах» (docs/BRAIN.md, разделы 1–2; шаг 2 PROMPTS.md).
// У каждого бота — своё b.know; истинное состояние мира сюда попадает только
// через то, что мог узнать игрок:
//   • своё зрение — кого бот реально увидел в бою (b._visible из resolveEngagements → visPair);
//   • свой слух — новые записи b.ears (их рождает makeSound, 14_movement.js): «что и
//     примерно откуда», БЕЗ «кто»;
//   • киллфид — кто кого убил (feedKill → knowKill), место смерти своего видно по радару;
//   • плант — объявление «бомба заложена» (сайт CT узнают как игрок: плант слышал/видел, писк бомбы,
//     саму бомбу в поле зрения, от своих в войсе — knowBombSite);
//   • свои глаза на пустой точке — «посмотрел, а там никого»;
//   • войс — что тиммейт договорил в тимспике (knowCall; кто и что говорит — 12_team.js).
//     Чужое b.know отсюда не читается никогда: только произнесённое;
//   • свои гранаты и вход тиммейта (K.nev, шаг 7) — бросил сам / увидел разрыв / услышал в войсе.
//
// Вера в позицию врага — набор гипотез, не число (BRAIN 2):
//   held          — стоит, где его видели в последний раз (точка);
//   moved         — ушёл по маршруту зон-коллаутов (ZONEMAP) к месту, полезному его стороне;
//   moved_unknown — ушёл тихо, куда — неизвестно.
// Веса в сумме 1 и меняются ТОЛЬКО событиями: увидел / потерял из вида, услышал,
// киллфид, плант, «посмотрел — пусто», истекло окно «бегущего врага на этом
// участке маршрута было бы слышно — а шагов не было». Время само веса не трогает.
// held от тишины не слабеет и не падает ниже KNOW.heldFloor — «точно ушёл» бот
// не выводит никогда; знает только когда увидел врага в другом месте или тот умер.
//
// Числа ниже — проектные константы (не из демок): что во что переходит и насколько.
// Кто читает: взгляд и префайр (11_position.js posAhead), гранаты «себе» (13_nades.js), угроза на slot;
// K.nev (свои гранаты и вход тиммейта) — шаги сценария (12_script_runner.js). Плюс знание карты —
// типичные места врага K.spots (шаг 10б, ниже).

var KNOW = {
  heldStill:   0.50,  // стартовый вес held, если враг стоял/крался, когда пропал из вида
  heldMoving:  0.20,  //   … если бежал
  unknownStart:0.10,  // стартовый вес moved_unknown
  dirBoost:    3.0,   // ветка по направлению, куда враг бежал, — ×3; в обратную — ×1/3
  maxBranches: 3,     // moved-веток не больше (BRAIN 8: 3–5 гипотез всего)
  maxHops:     4,     // насколько далеко (в зонах) смотрит ветка от места потери контакта
  quiet:       0.5,   // окно «было бы слышно» прошло без шагов: ветка ×0.5 (мог идти шифтом),
                      //   потерянный вес — в moved_unknown («ушёл тихо, куда — неизвестно»)
  emptyLook:   0.15,  // увидел точку held — никого: held ×0.15 (мог стоять в оффэнгле рядом)
  heldFloor:   0.03,  // ниже held не опускается без факта (увидел в другом месте / умер)
  lookEvery:   8,     // как часто бот «оглядывает» точки гипотез, тиков (~0,12 с)
  lookRange:   1100,  // дальше этого точку не разглядеть, px
  // насколько звук уверенно говорит «враг вот там»: эту долю веса гипотез, которые звук
  // не объясняют, он переносит на объясняющие — умноженную на долю этого врага в звуке
  // (из четырёх одинаково возможных врагов каждому достаётся четверть). Шаги — почти
  // наверняка враг в этом месте; по броску гранаты место понятно хуже
  soundL: {steps:0.85, water:0.85, shots:0.9, hit:0.9, reload:0.8, zoom:0.8, pickup:0.8, nade:0.5, nadefly:0.5, plant:0.9, defuse:0.9},
  // то же для войса (12_team.js): тиммейт видел — почти наверняка; слышал — как свой звук, но
  // со слов и только зона; «меня убил оттуда» — про названного в киллфиде врага
  voiceL: {see:0.9, hear:0.7, death:0.9},
  unknownCompat: 0.3, // moved_unknown объясняет звук хуже, чем конкретная ветка
  sameSource:  1.5,   // тот же звук из того же места в пределах 1,5 с — тот же источник:
                      //   двигает точку «слышал здесь», но новым доводом не считается
  memSec:      20,    // сколько бот помнит услышанное сам (для окон «было бы слышно»), с
  srcApart:    150,   // px: звуки ближе — один источник (knowSources; проектное число, v222)
  srcSec:      3      // с: за сколько считать источники (проектное число, v222)
};
var KNOW_POSITIONS = @@DATA:positions.json@@;
var KNOW_TRACE = null;   // {id: true} — чьи события пишутся в KNOW_LOG (tools/know_log.js)
var KNOW_LOG = [];

// ---------- граф зон-коллаутов (ZONEMAP: ~60 зон, переходы между ними) ----------
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
    g.r[z.id] = 0.5*Math.sqrt(Math.abs(a)/2);   // «полуразмер» зоны, px
    g.adj[z.id] = [];
  });
  ZONEMAP.portals.forEach(function(p){
    if(!g.adj[p.a] || !g.adj[p.b]) return;
    if(g.adj[p.a].indexOf(p.b) < 0) g.adj[p.a].push(p.b);
    if(g.adj[p.b].indexOf(p.a) < 0) g.adj[p.b].push(p.a);
  });
  // где стоит какая сторона (стоянки из positions.json — только сам факт, без долей)
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
// зона колл-аута в точке; в щели между зонами — ближайшая по центру
function knowZoneAt(x, y){
  var z = zoneIdAt(x, y); if(z) return z;
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

// насколько зона полезна стороне врага (смысл места, не частота): сайт / их стоянка / проход
function knowValue(zid, side, K){
  var g = knowGraph(), planted = K.planted, site = g.site[zid];
  if(planted){
    // после планта: T держат сайт (какой — CT знают, только если услышали/им сказали);
    // CT идут на сайт с бомбой (его T знают — бомба у своих)
    if(side === "CT") return site ? (site === K.plantSite ? 4 : 1) : (side === "CT" && g.posCT[zid] ? 1.5 : 1);
    if(site) return (!K.plantSite || site === K.plantSite) ? 4 : 1;
    return g.posT[zid] ? 1.5 : 1;
  }
  if(site) return 3;
  return (side === "T" ? g.posT : g.posCT)[zid] ? 2 : 1;
}

// ---------- построение гипотез от последнего точного контакта ----------
// last: {x, y, zone, tick, stance, source, vx, vy}; side — сторона врага
function knowBuild(K, side, last){
  var g = knowGraph(), Z0 = last.zone, hyps = [];
  var moving = Math.hypot(last.vx||0, last.vy||0) > SPEED*0.3;
  var held = {type: "held", zone: Z0, x: last.x, y: last.y, weight: moving ? KNOW.heldMoving : KNOW.heldStill};
  var unk = {type: "moved_unknown", zone: null, weight: KNOW.unknownStart};
  var branches = [];
  if(Z0 && g.adj[Z0]){
    // все зоны в пределах maxHops (кратчайшие маршруты от Z0); цель ветки — полезное
    // врагу место; ветки — в РАЗНЫЕ стороны: маршрут одной не лежит на маршруте другой
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
        prior *= Math.pow(KNOW.dirBoost, cos);   // по ходу ×3, вбок ×1, назад ×1/3
      }
      branches.push({type: "moved", zone: D, route: route, prior: prior, score: prior - 0.1*depth[D]});
    });
    branches.sort(function(a, b){ return b.score - a.score; });
    // направление ветки — выход из зоны (из зоны с одним выходом, как спавн, — следующая развилка)
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
// окна: когда бегущий враг был бы в каждой зоне маршрута (самый быстрый бег — вход,
// самый медленный бег с винтовкой/AWP — выход)
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

// ---------- служебное ----------
function knowNorm(hs){
  var s = 0; hs.forEach(function(h){ s += h.weight; });
  if(s > 0) hs.forEach(function(h){ h.weight /= s; });
  // held не уходит ниже порога без факта
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

// ---------- типичные места врага — знание карты (шаг 10б) ----------
// Любой игрок знает стандартные точки карты, где обычно стоит соперник (positions.json, type
// standard, без подпушей) — без «кто», без весов и долей: только «тут может стоять». Место
// открыто, пока бот сам не увидел его пустым (knowLook); снова открывается, когда он услышал или
// ему сказали о враге в той зоне (knowApply). Свежая инфа о конкретном враге — гипотезы выше.
var KNOW_SPOTS = {};
function knowSpotBase(side){
  if(!KNOW_SPOTS[side]) KNOW_SPOTS[side] = KNOW_POSITIONS.points.filter(function(p){ return p.side === side && p.type === "standard" && !p.push; })
    .map(function(p){
      // сколько бежать до места с их спавна (по навмешу) — раньше там никого быть не может
      var sp = side === "CT" ? CT_SPAWN : T_SPAWN, P = buildWaypointPath(sp.x, sp.y, 0, p.x, p.y, p.z || 0), L = 0, px = sp.x, py = sp.y;
      (P || []).forEach(function(q){ L += Math.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1]; });
      L += Math.hypot(p.x-px, p.y-py);
      return {id: p.id, x: p.x, y: p.y, zone: knowZoneAt(p.x, p.y), run: L};
    });
  return KNOW_SPOTS[side];
}
// мог ли враг уже дойти до места (раунд идёт столько-то, бег с ножом — самый быстрый)
function knowSpotReach(p){ return (tick - roundStartTick)/TICK_HZ*SPEED >= p.run; }
// открытое место врага впереди: в конусе cone° от dir, не дальше far px — ближайшее
function knowSpotAhead(b, dir, cone, far){
  var K = b.know; if(!K || !K.spots || !K.alive) return null;
  var best = null, bd = Infinity, c = cone*Math.PI/180;
  K.spots.forEach(function(p){
    if(!p.open || !knowSpotReach(p)) return;
    var d = Math.hypot(p.x-b.x, p.y-b.y); if(d < 40 || d > far || d >= bd) return;
    var a = Math.atan2(p.y-b.y, p.x-b.x) - dir;
    if(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > c) return;
    best = p; bd = d;
  });
  return best;
}

// ---------- начало раунда: враги на своём спавне (это знают все) ----------
function knowRoundStart(b){
  var K = b.know = {key: matchNum + ":" + roundNum, enemies: {}, heard: [], planted: false, plantSite: null, alive: 0, nev: [], dead: [],
                    spots: knowSpotBase(b.team === "CT" ? "T" : "CT").map(function(p){ return {id: p.id, x: p.x, y: p.y, zone: p.zone, run: p.run, open: true}; })};
  var sp = b.team === "CT" ? T_SPAWN : CT_SPAWN, zone = knowZoneAt(sp.x, sp.y);
  bots.forEach(function(e){
    if(e.team === b.team || !e.alive) return;
    K.alive++;
    // со спавна все выходят — «бежал» без направления
    knowNewBelief(K, b, e, {x: sp.x, y: sp.y, zone: zone, tick: tick, stance: "stand", source: "spawn", vx: SPEED*0.31, vy: 0, nodir: true});
    knowTrace(b, e.id, "начало раунда: враг на своём спавне");
  });
}

// ---------- зрение: вижу / потерял из вида ----------
function knowVision(b){
  var K = b.know, seen = {};
  (b._visible || []).forEach(function(e){
    if(!e.alive) return;   // убит в этот же тик — уже в киллфиде
    seen[e.id] = true;
    var B = K.enemies[e.id];
    var last = {x: e.x, y: e.y, zone: knowZoneAt(e.x, e.y), tick: tick, stance: e.crouching ? "crouch" : "stand",
                source: "vision", vx: (e.x - e.px)*TICK_HZ, vy: (e.y - e.py)*TICK_HZ, weapon: e.weapon && e.weapon.key};
    var was = B && B.visible;
    if(!B) B = K.enemies[e.id] = {id: e.id, side: e.team};
    B.last = last; B.visible = true;
    B.hyps = [{type: "held", zone: last.zone, x: last.x, y: last.y, weight: 1}];
    if(e.planting && !K.planted) K.plantSeen = e.plantSite;   // видел, как ставит, — знает сайт
    if(!was) knowTrace(b, e.id, "увидел (" + knowZoneName(last.zone) + ")" + (e.planting ? ", ставит бомбу" : ""));
  });
  for(var id in K.enemies){
    var B2 = K.enemies[id];
    if(B2.visible && !seen[id]){
      B2.visible = false;
      B2.hyps = knowBuild(K, B2.side, B2.last);
      // точка, где пропал, — край видимости: что её «видно» сейчас, ничего не значит;
      // «пусто» засчитается, только когда бот посмотрит туда заново
      B2.hyps[0].inView = true;
      knowTrace(b, id, "потерял из вида (" + knowZoneName(B2.last.zone) + (Math.hypot(B2.last.vx, B2.last.vy) > SPEED*0.3 ? ", бежал" : ", стоял/шёл тихо") + ")");
    }
  }
}

// ---------- слух: новые записи b.ears этого тика ----------
// звук не говорит «кто»: каждый враг получает долю по тому, насколько его гипотезы его объясняют
function knowHearing(b){
  var K = b.know, E = b.ears || [];
  for(var i = 0; i < E.length; i++){
    var s = E[i];
    // каждый услышанный звук — один раз (s.known), даже если он прозвучал в прошлом тике ПОСЛЕ knowTick
    // (плант, бросок гранаты, начало дефуза делают решения, которые идут позже знания; v212)
    if(s.known) continue;
    s.known = true;
    if(s.kind === "beep"){ knowBombSite(b, knowNearestSite(s.x, s.y), "услышал писк бомбы"); continue; }
    if(s.kind === "defuse" || s.kind === "defusing") K.defuseT = tick;   // дефузят прямо сейчас (T: пост-плант)
    if(s.kind === "pop" || s.kind === "defusing" || !(s.kind in KNOW.soundL)) continue;
    var d = Math.hypot(s.x-b.x, s.y-b.y), err = d*(s.occl ? 0.3 : 0.15) + 40;
    var zone = knowZoneAt(s.x, s.y);
    K.heard.push({x: s.x, y: s.y, zone: zone, kind: s.kind, tick: tick, err: err});
    while(K.heard.length && tick - K.heard[0].tick > KNOW.memSec*TICK_HZ) K.heard.shift();
    if(s.kind === "plant" && !K.planted) K.plantHeard = knowNearestSite(s.x, s.y);
    knowApply(b, s, err, zone, KNOW.soundL[s.kind], {say: "услышал " + (SOUND[s.kind] ? SOUND[s.kind].say : s.kind)});
  }
}
// сколько разных врагов бот слышал за sec с (шаги / вода / стрельба), где test(h) — «там»: звуки ближе
// KNOW.srcApart друг к другу — один источник. На слух человек так и считает: «двое», «несколько» (v222, v226)
function knowSources(K, test, sec){
  var src = [];
  if(K) K.heard.forEach(function(h){
    if(tick - h.tick > sec*TICK_HZ || (h.kind !== "steps" && h.kind !== "water" && h.kind !== "shots") || !test(h)) return;
    if(!src.some(function(q){ return Math.hypot(q.x - h.x, q.y - h.y) < KNOW.srcApart; })) src.push(h);
  });
  return src;
}
// ---------- войс: тиммейт договорил фразу (12_team.js) ----------
// msg: {zone, count, awp, kind:'see'|'hear'|'death'|'plant'|'defuse', site, enemy, by, text}.
// Фраза говорит только «где (зона колл-аута) и сколько» — точки и «кто» в ней нет;
// исключение — «меня убил …»: кто убил, видно в киллфиде, и фраза — про него.
function knowCall(b, msg){
  var K = b.know; if(!K) return;
  var say = "войс " + msg.by + ": «" + msg.text + "»";
  // свои гранаты и вход тиммейта (шаг 7): место — только зона колл-аута, точки в фразе нет
  if(msg.kind === "script"){ K.nev.push({type: msg.ev, x: null, y: null, zone: msg.zone, tick: tick, src: "voice", by: msg.by}); return; }
  if(msg.kind === "plant"){
    if(!K.planted) K.plantHeard = msg.site;
    else if(!K.plantSite){ K.plantSite = msg.site; for(var id in K.enemies) knowTrace(b, id, say); }
    return;
  }
  if(msg.kind === "defuse"){ K.defuseT = tick; return; }
  if(!msg.zone) return;
  var g = knowGraph(), c = g.c[msg.zone];
  knowApply(b, {x: c.x, y: c.y, kind: "voice"}, g.r[msg.zone] + 60, msg.zone, KNOW.voiceL[msg.kind],
            {say: say, voice: true, mult: msg.count || 1, only: msg.enemy});
}
// довод «враг (кто-то из врагов) вот здесь» — общий для звука и войса.
// s: {x, y, kind}; err — насколько точно понятно место; L — насколько довод уверенный;
// opt: say — запись в лог, voice — со слов тиммейта (не свой звук), mult — сказали «двое»,
//      only — довод про конкретного врага (киллфид назвал его)
function knowApply(b, s, err, zone, L, opt){
  var K = b.know, g = knowGraph();
  if(zone && K.spots) K.spots.forEach(function(p){ if(p.zone === zone) p.open = true; });   // враг в этой зоне — её места снова под вопросом
  // кого из видимых сейчас врагов это объясняет — тот и шумит, гипотезы не трогаем
  var vis = 0;
  (b._visible || []).forEach(function(e){ if(Math.hypot(e.x-s.x, e.y-s.y) <= err + 30) vis++; });
  if(vis >= (opt.mult || 1)) return;
  var expl = {}, tot = 0;
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible || (opt.only && id !== opt.only)) continue;
    var reach = (tick - B.last.tick)/TICK_HZ*SPEED + err + 60, ex = 0;
    if(Math.hypot(s.x-B.last.x, s.y-B.last.y) > reach) { expl[id] = 0; continue; }
    B.hyps.forEach(function(h){ h._c = knowCompat(h, s, err, g); ex += h.weight*h._c; });
    expl[id] = ex; tot += ex;
  }
  if(tot <= 0) return;   // никто из известных не мог
  for(var id2 in expl){
    var r = Math.min(1, expl[id2]/tot*(opt.mult || 1)); if(r < 0.02) continue;
    var B2 = K.enemies[id2], un = knowHyp(B2, "moved_unknown"), specific = false;
    // продолжение того же звука (тот же источник) — только сдвиг точки, не новый довод
    var ls = B2.lastSound, same = !opt.voice && ls && tick - ls.tick <= KNOW.sameSource*TICK_HZ &&
             Math.hypot(ls.x-s.x, ls.y-s.y) <= err + 100 && KNOW.soundL[s.kind] <= KNOW.soundL[ls.kind];
    if(!opt.voice) B2.lastSound = {x: s.x, y: s.y, tick: tick, kind: same ? ls.kind : s.kind};
    var mOk = 0, mNo = 0;
    B2.hyps.forEach(function(h){ if(h._c > 0) mOk += h.weight*h._c; else mNo += h.weight; });
    var move = same ? 0 : r*L;   // доля веса необъясняющих, которая уходит к объясняющим
    B2.hyps.forEach(function(h){
      if(h._c > 0){
        if(mOk > 0) h.weight += move*mNo*(h.weight*h._c/mOk);
        if(h.type !== "moved_unknown") specific = true;
        if(h.heard && zone){ h.x = s.x; h.y = s.y; h.zone = h.route[0] = zone; h.inView = false; }   // «слышал здесь» идёт за звуком
      } else h.weight *= 1 - move;
    });
    if(same && specific){ knowNorm(B2.hyps); continue; }
    // объяснил только «ушёл неизвестно куда» — появляется новая ветка «слышал здесь»:
    // её вес — доля этого врага в доводе × уверенность довода, из всех остальных гипотез
    if(!specific && un && zone){
      var take = r*L*(same ? 0.5 : 1);
      B2.hyps.forEach(function(h){ h.weight *= 1 - take; });
      B2.hyps.splice(B2.hyps.length-1, 0, {type: "moved", zone: zone, x: s.x, y: s.y, route: [zone], windows: [], weight: take, heard: true});
      knowTrim(B2);
    }
    knowNorm(B2.hyps);
    if(!same) knowTrace(b, id2, opt.say + " (" + knowZoneName(zone) + "), доля " + r.toFixed(2));
  }
}
// объясняет ли гипотеза звук в точке s (0…1)
function knowCompat(h, s, err, g){
  if(h.type === "moved_unknown") return KNOW.unknownCompat;
  if(h.type === "held") return Math.hypot(h.x-s.x, h.y-s.y) <= err + 60 ? 1 : 0;
  if(h.heard) return Math.hypot(h.x-s.x, h.y-s.y) <= err + 80 ? 1 : 0;
  for(var i = 0; i < h.route.length; i++){
    var c = g.c[h.route[i]];
    if(Math.hypot(c.x-s.x, c.y-s.y) <= err + g.r[h.route[i]]) return 1;
  }
  return 0;
}
// гипотез не больше 5: самая слабая moved сливается в moved_unknown
function knowTrim(B){
  var moved = B.hyps.filter(function(h){ return h.type === "moved"; });
  while(moved.length > KNOW.maxBranches + 1){
    moved.sort(function(a, b){ return a.weight - b.weight; });
    var w = moved.shift();
    B.hyps.splice(B.hyps.indexOf(w), 1);
    knowHyp(B, "moved_unknown").weight += w.weight;
  }
}

// ---------- окна «было бы слышно на этом участке» ----------
function knowWindowsTick(b){
  var K = b.know, g = knowGraph();
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    if(B.hyps._next !== undefined && tick < B.hyps._next) continue;   // до ближайшего окна — нечего проверять
    var next = Infinity;
    B.hyps.forEach(function(h){ (h.windows || []).forEach(function(w){ if(!w.done && w.t1 > tick) next = Math.min(next, w.t1); }); });
    B.hyps._next = next;
    B.hyps.forEach(function(h){
      if(h.type !== "moved" || !h.windows) return;
      h.windows.forEach(function(w){
        if(w.done || tick < w.t1) return;
        w.done = true;
        var c = g.c[w.zone], dist = Math.hypot(c.x-b.x, c.y-b.y) - g.r[w.zone];
        if(dist > SOUND.steps.wall) return;          // отсюда мог и не услышать — ничего не значит
        var heard = K.heard.some(function(s){
          return (s.kind === "steps" || s.kind === "water") && s.tick >= w.t0 && s.tick <= w.t1 &&
                 Math.hypot(s.x-c.x, s.y-c.y) <= g.r[w.zone] + s.err;
        });
        if(heard) return;                            // слышал — это уже учтено как звук
        var un = knowHyp(B, "moved_unknown"), lost = h.weight*(1 - KNOW.quiet);
        h.weight -= lost; if(un) un.weight += lost;
        knowNorm(B.hyps);
        knowTrace(b, id, "тихо: " + knowZoneName(w.zone) + " — бегущего было бы слышно (ветка → " + knowZoneName(h.zone) + ")");
      });
    });
  }
}

// ---------- «посмотрел — пусто» ----------
function knowLook(b){
  var K = b.know;
  if(tick < b.blindUntil || (tick + (b.id.charCodeAt(b.id.length-1)||0)) % KNOW.lookEvery) return;
  var ez = visEyeZ(b);
  (K.spots || []).forEach(function(p){   // типичное место врага: увидел своими глазами — там никого
    if(!p.open || Math.hypot(p.x-b.x, p.y-b.y) > KNOW.lookRange || !inFov(b, p.x, p.y)) return;
    if(!visLine(b.x, b.y, ez, p.x, p.y, visFloorAt(p.x, p.y) + VIS_EYE.crouch, true)) return;
    if(!(b._visible || []).some(function(e){ return Math.hypot(e.x-p.x, e.y-p.y) < 120; })) p.open = false;
  });
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){
      if(h.x === undefined) return;
      var inView = Math.hypot(h.x-b.x, h.y-b.y) <= KNOW.lookRange && inFov(b, h.x, h.y) &&
                   visLine(b.x, b.y, ez, h.x, h.y, visFloorAt(h.x, h.y) + VIS_EYE.crouch, true);
      if(inView && !h.inView){
        h.weight *= KNOW.emptyLook; knowNorm(B.hyps);
        knowTrace(b, id, "посмотрел — пусто: " + (h.type === "held" ? "где стоял" : "где слышал") + " (" + knowZoneName(h.zone) + ")");
      }
      h.inView = inView;
    });
  }
}

// ---------- события сценария: свои гранаты и вход тиммейта (шаг 7, 12_script_runner.js) ----------
// K.nev — что бот сам узнал о событиях СВОЕЙ команды, которые двигают сценарий:
//   {type: smoke|flash|molly|he|commit, x, y, zone, tick, src: own|saw|voice, by}
//   own   — бросил сам;
//   saw   — увидел разрыв гранаты тиммейта (глаза → точка разрыва, дым закрывает, до SOUND.pop.see)
//           либо увидел, как тиммейт пошёл на сайт (commit);
//   voice — тиммейт договорил в войсе «дым Second Lane» / «заходим» (kind "script", 12_team.js):
//           только зона колл-аута (x, y = null).
// Разрыв своей гранаты врагу слышно (makeSound "pop"), своим — нет: свои узнают так, как игрок.
// Какое событие какому шагу сценария соответствует — решает исполнитель (он знает план), а не
// знание: здесь только «что произошло и откуда я это узнал».
function knowNadePop(n){
  if(roundState !== "live" || !n.thrower) return;
  var zone = knowZoneAt(n.x, n.y), key = matchNum + ":" + roundNum;
  bots.forEach(function(b){
    if(!b.alive || b.team !== n.team || !b.know || b.know.key !== key) return;
    var src = null;
    if(b === n.thrower) src = "own";
    else if(Math.hypot(b.x-n.x, b.y-n.y) <= SOUND.pop.see &&
            visLine(b.x, b.y, visEyeZ(b), n.x, n.y, visFloorAt(n.x, n.y) + 40, true)) src = "saw";
    if(!src) return;
    b.know.nev.push({type: n.type, x: n.x, y: n.y, zone: zone, tick: tick, src: src, by: n.thrower.id});
    if(src === "own" && b.voice) teamPropose(b, {kind: "script", ev: n.type, zone: zone});
  });
}
// вход тиммейта на сайт: сам знает; остальные — если видят его (b.pushTick ставит исполнитель)
function knowTeamSight(b){
  var K = b.know;
  bots.forEach(function(m){
    if(m.team !== b.team || !m.alive || m.pushTick === undefined) return;
    if(K.nev.some(function(e){ return e.type === "commit" && e.by === m.id; })) return;
    var own = m === b;
    if(!own && !(Math.hypot(b.x-m.x, b.y-m.y) <= SOUND.pop.see && visLine(b.x, b.y, visEyeZ(b), m.x, m.y, visEyeZ(m), true))) return;
    var zone = m.pushSite && SITES[m.pushSite] ? knowZoneAt(SITES[m.pushSite].x, SITES[m.pushSite].y) : knowZoneAt(m.x, m.y);   // «заходим B» — куда идёт
    K.nev.push({type: "commit", x: m.x, y: m.y, zone: zone, tick: tick, src: own ? "own" : "saw", by: m.id});
    if(own && b.voice) teamPropose(b, {kind: "script", ev: "commit", zone: zone});
  });
}
// события типа type (не раньше since): исполнитель сам выбирает, какое из них «то самое»
function knowEvents(b, type, since){
  var K = b.know, out = [];
  if(!K) return out;
  K.nev.forEach(function(e){ if(e.type === type && e.tick >= (since || 0)) out.push(e); });
  return out;
}
function knowLastEvent(b, since){
  var K = b.know, t = since || 0;
  if(K) K.nev.forEach(function(e){ if(e.tick > t) t = e.tick; });
  return t;
}

// ---------- где бомба (CT): писк, сама бомба в поле зрения (v212) ----------
// «Бомба заложена» слышат все, а где — CT узнают как игрок: слышал/видел плант, слышит писк
// бомбы (14_movement.js SOUND.beep, 05_bomb.js), видит саму бомбу на земле, ему сказали в войсе.
function knowBombSite(b, site, how){
  var K = b.know; if(!K || !site) return;
  if(!K.planted){ K.plantHeard = site; return; }
  if(K.plantSite) return;
  K.plantSite = site;
  for(var id in K.enemies) knowTrace(b, id, how + " — бомба на " + site);
}
function knowBombSeen(b){
  var K = b.know;
  if(b.team !== "CT" || !K.planted || K.plantSite || !bomb || bomb.state !== "planted" || tick < b.blindUntil) return;
  if(Math.hypot(bomb.x-b.x, bomb.y-b.y) > KNOW.lookRange || !inFov(b, bomb.x, bomb.y)) return;
  if(!visLine(b.x, b.y, visEyeZ(b), bomb.x, bomb.y, visFloorAt(bomb.x, bomb.y) + 5, true)) return;
  knowBombSite(b, bomb.site, "увидел бомбу");
}

// ---------- плант (объявление видят все) ----------
function knowPlant(b){
  var K = b.know;
  if(!bomb || bomb.state !== "planted" || K.planted) return;
  K.planted = true;
  // T знают сайт (бомба у своих); CT — только если сами слышали плант
  K.plantSite = b.team === "T" ? bomb.site : (K.plantSeen || K.plantHeard || null);
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    // смысл мест поменялся: ветки к тому, что теперь важно врагу, — тяжелее
    B.hyps.forEach(function(h){ if(h.type === "moved") h.weight *= knowValue(h.zone, B.side, K); });
    knowNorm(B.hyps);
    knowTrace(b, id, "бомба заложена" + (K.plantSite ? " на " + K.plantSite : " (где — не знаю)"));
  }
}

// ---------- киллфид (вызывает feedKill, 20_hud.js) ----------
function knowKill(att, vic){
  if(roundState !== "live") return;
  bots.forEach(function(b){
    if(!b.alive || !b.know || b === vic) return;
    var K = b.know;
    if(vic.team !== b.team){
      if(K.enemies[vic.id]){ delete K.enemies[vic.id]; K.alive--; knowTrace(b, vic.id, "киллфид: враг убит"); }
      // где убит (v225): убил свой — место он видел и говорит в войс («одного на A»); убил кто-то ещё — киллфид
      if(att && att.team === b.team) K.dead.push({id: vic.id, zone: knowZoneAt(vic.x, vic.y), tick: tick});
      return;
    }
    // своего убил att: att где-то в прострел от места смерти своего (место видно по радару)
    if(!att || att.team === b.team) return;
    var last = {x: vic.x, y: vic.y, zone: knowZoneAt(vic.x, vic.y), tick: tick, stance: "stand",
                source: "killfeed", vx: 0, vy: 0, weapon: att.weapon && att.weapon.key, approx: true};
    var B = K.enemies[att.id];
    if(B && B.visible) return;
    if(!B) B = knowNewBelief(K, b, att, last);
    else { B.last = last; B.hyps = knowBuild(K, B.side, last); }
    B.hyps[0].x = undefined;   // убийца не стоит на месте смерти своего — «посмотрел туда, пусто» о нём не говорит
    knowTrace(b, att.id, "киллфид: убил " + vic.id + " (" + knowZoneName(last.zone) + ")");
  });
}

// ---------- раз в тик, после resolveEngagements (17_tick.js) ----------
function knowTick(){
  var key = matchNum + ":" + roundNum;
  bots.forEach(function(b){
    if(!b.alive) return;
    if(!b.know || b.know.key !== key) knowRoundStart(b);
    knowVision(b);
    knowHearing(b);
    knowPlant(b);
    knowBombSeen(b);
    knowTeamSight(b);
    knowWindowsTick(b);
    knowLook(b);
  });
}
