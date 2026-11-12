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

var SPRAY_RESET_TICKS = 32; // ~0.5с без выстрела — отдача "вернулась"
var PX_UNITS = MAP.pxUnits;   // юнитов CS2 в 1px радара (scale карты × 1024 / 2048; у Ancient 2.5)
var BODY_HALF = 6.4;  // полуширина модели, px (32 юнита)
var HEAD_HALF = 2.2;  // полуразмер головы, px (~11 юнитов)
// (v263, Б1) первый живой игрок на пути пули от стрелка до (ex, ey), кроме skip: тело ближе полуширины модели
// (BODY_HALF, 32 юнита CS2) к линии и стрелку его видно (не за стеной/укрытием)
function bulletVictim(sh, ex, ey, skip){
  var dx = ex-sh.x, dy = ey-sh.y, L = Math.hypot(dx, dy); if(L < 1) return null;
  var ux = dx/L, uy = dy/L, best = null, bt = L;
  for(var i=0;i<bots.length;i++){
    var m = bots[i]; if(m === sh || m === skip || !m.alive) continue;
    var px = m.x-sh.x, py = m.y-sh.y, t = px*ux + py*uy;
    if(t <= 0 || t >= bt) continue;
    if(Math.abs(px*uy - py*ux) > BODY_HALF) continue;
    if(!hasLOS(sh.x, sh.y, m.x, m.y)) continue;
    best = m; bt = t;
  }
  return best;
}
// (Г1, 04.11, разбор отметок п.5) пуля, которая летит дальше (промах, прострел дыма), попадает в первого на линии — одно место для обоих
// (раньше прострел дыма урона не считал вовсе: трассер проходил сквозь игрока). Зона попадания — те же доли, что у промаха без хитбоксов;
// урон — оружия на дистанции до него. Возвращает того, в кого попала, — или null
function bulletLineHit(sh, ex, ey, skip, seed, note){
  var sv = bulletVictim(sh, ex, ey, skip); if(!sv) return null;
  var w = sh.weapon, sd = Math.hypot(sv.x-sh.x, sv.y-sh.y), sz = hashRand(seed);
  var sm = sz < 0.22 ? 0.75 : (sz < 0.42 ? 1.25 : 1.0), sArm = sz >= 0.22 && sv.armor;
  var sdmg = w.dmg * Math.pow(w.rm, sd*PX_UNITS/500) * sm;
  sv._hitFx = {t:nowTs, head:false}; if(BAL.tagging) sv._tagUntil = tick + 16;
  applyDamage(sh, sv, sdmg, "bullet", {armorRatio: sArm ? w.armorPen : null, wkey:w.key, reward:w.killReward||300, note:" ("+note+", дист. "+Math.round(sd)+")", mods:{blind: tick < (sh.blindUntil||0), smoke: !!smokeOnLine(sh.x, sh.y, sv.x, sv.y)}});   // (v554) значки киллфида
  return sv;
}
// (v519, пак 09.11 п.15; Р-2: «трассеры проходят через укрытия») пуля мимо — летит по 3D-геометрии карты (та же, что видимость: ящики, укрытия,
// уступы), а не только до плоских стен редактора: от глаз стрелка к точке на высоте корпуса цели (tz — пол цели, ед. игры) и дальше по той же прямой;
// где упёрлась — там конец трассера и шальной пули (bulletVictim ищет только до этой точки)
function bulletClip3(sh, ex, ey, tgt){
  var c = rayClipWalls(sh.x, sh.y, ex, ey), M = typeof m3 === "function" ? m3() : null; if(!M || !tgt) return c;
  var az = visFloorAt(sh.x, sh.y, sh.z) + (sh.crouching ? VIS_EYE.crouch : VIS_EYE.stand), tz = visFloorAt(tgt.x, tgt.y, tgt.z) + 40;
  var dT = Math.hypot(tgt.x-sh.x, tgt.y-sh.y) || 1, L = Math.hypot(c.x-sh.x, c.y-sh.y), bz = az + (tz - az)*L/dT;
  var h = m3Cast(M, sh.x, sh.y, az, c.x, c.y, bz, "sight", true);
  return h && h.t < 1 ? {x: sh.x + (c.x-sh.x)*h.t, y: sh.y + (c.y-sh.y)*h.t, wall: true} : c;
}
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
// раздел 14: магазин/перезарядка. Пустой магазин — перезарядка сразу; неполный
// (<35%) — перезаряжается, когда секунду нет стрельбы и врага не видно
// ---- оружие на земле: убитый роняет основное оружие, его может подобрать любой
// (в CS так поднимают AWP/AK у убитого и уносят в следующий раунд) ----
var groundWeapons = [];
// (v271) что выпадает при смерти — как на серверах CS2 по умолчанию (mp_death_drop_gun 1,
// mp_death_drop_grenade, mp_death_drop_defuser 1): самое ценное оружие (основное, а без него —
// пистолет), самая ценная граната (молотов > дым > HE > флешка) и кит. Основное — groundWeapons
// (подбор — ниже, как был); пистолет, граната, кит — groundItems: поднимает тот, кто прошёл по ним.
var groundItems = [];
var NADE_DROP_ORDER = ["molly","smoke","he","flash"];
function dropWeaponOnDeath(b){
  var j = function(){ return dropOnFloor(b.x + (hashRand(tick*7 + groundItems.length)*16 - 8), b.y + (hashRand(tick*13 + groundItems.length)*16 - 8), b.z); };   // (00_PLAN) на пол (120)
  var w0 = dropOnFloor(b.x, b.y, b.z);
  if(b.primary && WEAPONS[b.primary]) groundWeapons.push({key:b.primary, x:w0.x, y:w0.y, t:tick, from:b.id});
  else if(b.secondary && WEAPONS[b.secondary]){ var p0 = j(); groundItems.push({kind:"pistol", key:b.secondary, x:p0.x, y:p0.y, t:tick, from:b.id}); }
  var N = b.nades || {}, nt = NADE_DROP_ORDER.filter(function(k){ return (N[k]||0) > 0; })[0];
  if(nt){ var p1 = j(); groundItems.push({kind:"nade", key:nt, x:p1.x, y:p1.y, t:tick, from:b.id}); }
  if(b.team === "CT" && b.kit){ var p2 = j(); groundItems.push({kind:"kit", key:"kit", x:p2.x, y:p2.y, t:tick, from:b.id}); }
}
// пройти по предмету — подобрать, если нужен (как в CS: пистолет — только лучше своего, гранаты — в пределах
// лимита 4, флешек 2, кит — CT без кита)
function itemPickupTick(){
  if(!groundItems.length || (roundState !== "live" && roundState !== "ending")) return;   // (v564, В89) и после конца раунда, до рестарта
  bots.forEach(function(b){
    if(!b.alive) return;
    for(var i = groundItems.length-1; i >= 0; i--){
      var G = groundItems[i];
      if(Math.hypot(G.x-b.x, G.y-b.y) > 38) continue;
      var N = b.nades;
      if(G.kind === "kit"){ if(b.team !== "CT" || b.kit) continue; b.kit = true; }
      else if(G.kind === "nade"){
        var tot = N.smoke + N.flash + N.he + N.molly;
        if(tot >= 4 || (G.key === "flash" ? N.flash >= 2 : N[G.key] >= 1)) continue;
        N[G.key]++;
      }
      else if(G.kind === "pistol"){
        if(!b.secondary || WEAPONS[G.key].tier <= WEAPONS[b.secondary].tier) continue;
        var held = b.weapon === WEAPONS[b.secondary];
        groundItems.push({kind:"pistol", key:b.secondary, x:b.x, y:b.y, t:tick, from:b.id});
        b.secondary = G.key; b._secAmmo = null; if(held){ b.weapon = WEAPONS[G.key]; b._ammoFor = null; }
      } else continue;
      groundItems.splice(i, 1);
      logEvent(b.id+" подобрал "+(G.kind === "kit" ? "кит" : G.kind === "nade" ? NADE[G.key].name : WEAPONS[G.key].name)+(G.from ? " ("+G.from+")" : ""));
      if(G.kind !== "kit") sndPickup(b, G.kind === "nade" ? "nade" : "w");   // (v338) звук подбора — только показ
    }
  });
}
// скорость бега по оружию, CS2 (юниты/с): пистолеты 240 (Deagle 230), MAC-10/MP9 240,
// Galil 215, FAMAS 220, AK 215, M4A4 225, AWP 200 (в прицеле 100). Считаем от M4 (=SPEED),
// чтобы средняя скорость команды почти не изменилась
var WSPEED = {UMP:230, MP7:220, P90:230, SSG:230, M4S:225, AUG:220, SG:210, GLOCK:240, USP:240, P250:240, ELITE:240, TEC9:240, FIVE7:240, DEAGLE:230, MAC10:240, MP9:240, GALIL:215, FAMAS:220, AK:215, M4:225, AWP:200};
// (10) нож в руках. (v269) Как у про (88 демок Ancient, tools/measure/plan_bake.py): нож держат тем чаще, чем дальше
// ближайший враг и чем быстрее идут. Доля с ножом при дистанции < 400 / 400–600 / 600–900 / 900–1200 / дальше, px:
// стоит 2 / 4 / 5 / 6 / 23 %, шагом 5 / 9 / 12 / 12 / 44 %, бежит (> 65 px/с) 12,5 / 31 / 49 / 73 / 83 %; в целом 19 % времени
// (у ботов до v269 — 5 %: только длинная пробежка > 450 px, где врага по таймингу быть не может). Бот не знает, где враг на
// самом деле: берёт свою оценку — ближайшее место, где враг может быть по гипотезам знания (не среднее: среднее
// было слишком оптимистичным — с ножом при враге ближе 600 px 18 % против 8 % у про); про кого не знает ничего —
// ближайшая зона, куда тот уже мог дойти (REACH). Жребий один на отрезок «без контакта» (не мерцает). Увидел врага / в бою —
// достаёт оружие (~0,4 с без выстрела)
var KNIFE_D = [400, 600, 900, 1200, Infinity];
var KNIFE_P = {stand: [0.020, 0.038, 0.046, 0.061, 0.227], walk: [0.050, 0.094, 0.116, 0.119, 0.439], run: [0.125, 0.312, 0.489, 0.729, 0.829]};
function knifeEnemyDist(b){
  var K = b.know, g = knowGraph(), best = Infinity, unknown = false;
  bots.forEach(function(e){
    if(e.team === b.team || !e.alive) return;
    var B = K && K.enemies ? K.enemies[e.id] : null, sw = 0, sd = 0;
    if(B && B.hyps) B.hyps.forEach(function(h){ var p = h.type === "held" ? h : (h.zone && g.c[h.zone]); if(!p || !(h.weight > 0)) return; sw += h.weight; sd = Math.min(sd || Infinity, Math.hypot(p.x-b.x, p.y-b.y)); });
    if(sw > 0) best = Math.min(best, sd); else unknown = true;
  });
  if(unknown) for(var j = 0; j < BZ.cent.length; j++) if(reachPossible(b.team, j)){ var d = Math.hypot(BZ.cent[j].x-b.x, BZ.cent[j].y-b.y); if(d < best) best = d; }
  return best;
}
// (v555, владелец 11.11, отметка м300 р3: «дефузит в смоке — T зажимает обойму; не убил, дефуз идёт — идёт резать: два удара спереди — смерть,
// в спину — один; иногда легче сразу пойти резать») T слышит дефуз (≤ 1 с) и дефузящий рядом: магазин пуст / перезарядка / очередь в дым
// кончилась (или он уже вплотную) — нож и к нему (та же задача «сбить дефуз»), в KNIFE_REACH — удар раз в KNIFE_GAP
var KNIFE_REACH = 20, KNIFE_GAP = 64, KNIFE_STAB = 55, KNIFE_BACK = 180, KNIFE_GO = 300;   // проектные: ед. карты, тики, урон (слова владельца: 2 спереди, 1 в спину)
function knifeDefuseTick(b){
  if(b.team !== "T" || !bomb || bomb.state !== "planted" || tick - (b._defuseHeard || -9999) >= TICK_HZ || b._sawEnemy || b.planting) return false;
  var D = bots.filter(function(o){ return o.alive && o.defusing; })[0]; if(!D) return false;
  var d = Math.hypot(D.x-b.x, D.y-b.y); if(d > KNIFE_GO) return false;
  if(!(b.ammo <= 0 || b._reloading || !b._spam || d <= 3*KNIFE_REACH)) return false;
  b._knife = true; b._knDef = D.id;   // точку «к нему» даёт задача «сбить дефуз» (tBrain, 170); очередь в дым снимает её хозяин (290)
  if(d > KNIFE_REACH) return true;
  if(tick < (b._stabT || 0)) return true;
  b._stabT = tick + KNIFE_GAP;
  var back = D.facing !== undefined && _angOff(Math.atan2(b.y-D.y, b.x-D.x), D.facing) > 2*Math.PI/3;
  applyDamage(b, D, back ? KNIFE_BACK : KNIFE_STAB, "knife", {wkey:"KNIFE_T", reward:1500, note:" (нож"+(back ? ", в спину" : "")+")"});
  D.heardSound = {x:b.x, y:b.y, z:b.z, tick:tick, team:b.team, src:b.id, kind:"hit"};
  return true;
}
function knifeTick(b){
  if(!BAL.knifeRun) return;
  if(b.alive && roundState === "live" && knifeDefuseTick(b)) return;
  var ok = b.alive && roundState === "live" && (b.state === "patrol" || b.state === "hold") && !b._sawEnemy && !b.planting && !b.defusing &&
           !b.nadeTask && !(bomb && bomb.state === "carried" && bomb.carrier === b) && !(b._fc) && !b._reloading;   // (v442) перезаряжается — в руках оружие (замер: 91–112 ножей при перезарядке на 8 матчей)
  if(!ok){ b._knU = null; }
  else if(b._knU == null) b._knU = hashRand(roundNum*7919 + tick*13 + b.id.charCodeAt(0)*31 + b.id.length*101);   // жребий на отрезок
  var want = false;
  if(ok){
    var sp = b.curSpeed || 0, row = sp > 65*SPD_K ? KNIFE_P.run : sp >= 15*SPD_K ? KNIFE_P.walk : KNIFE_P.stand;
    var d = knifeEnemyDist(b), pk = 0; for(var i = 0; i < KNIFE_D.length; i++){ if(d < KNIFE_D[i]){ pk = row[i]; break; } }
    want = b._knU < pk;
  }
  if(want && !b._knife){ b._knife = true; }
  else if(!want && b._knife){ b._knife = false; b._drawUntil = tick + Math.round(0.4*TICK_HZ); }
}
function weaponSpeedMul(b){
  if(BAL.knifeRun && b._knife) return 250/225;
  if(!BAL.weaponSpeed || !b.weapon) return 1;
  var v = WSPEED[b.weapon.key] || 225, m = v/225;
  if(b.weapon.key === "AWP" && (b._sawEnemy || b.state === "engage" || b.state === "hold")) m *= 0.5; // в прицеле
  return m;
}
function weaponValue(k){ return k ? (WEAPONS[k].tier + (k === "AWP" ? 1.5 : 0) + (BAL.pickupMore && k === "AK" ? 0.5 : 0)) : -1; }
// (v334, М60, владелец: «часто подбирают две AWP, хотя лучше АК, если есть деньги на AWP — это для T; для CT почти всегда лучше АК»)
// ценность подбора для этого игрока: вторая AWP у команды — ниже АК; T с деньгами на AWP — АК лучше (AWP купит сам);
// CT — АК выше своей M4 и AWP (кроме снайпера команды без AWP)
function pickValue(b, k){
  var v = weaponValue(k); if(!k) return v;
  if(k === "AWP"){
    var teamAwp = bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.primary === "AWP"; });
    if(teamAwp) return weaponValue("AK") - 1;
    if(b.team === "T" && b.money >= WEAPONS.AWP.price) return weaponValue("AK") - 0.5;
    if(b.team === "CT" && !isSniper(b)) return weaponValue("AK") - 0.5;
  }
  if(k === "AK" && b.team === "CT") v += 0.6;
  return v;
}
// AWP с винтовкой в руках берёт только снайпер/мидер — пока у команды есть свой
// живой снайпер или AWP у кого-то; нет — поднимает любой (AWP не бросают)
function awpAllowed(b){
  if(isSniper(b)) return true;   // (v519) AWP — снайперу команды (было: роль «awp» или «мид» — у CT «мид» переходит по расстановке)
  if(!BAL.pickupMore) return false;
  return !bots.some(function(o){ return o.alive && o.team === b.team && o !== b && (o.primary === "AWP" || isSniper(o)); });
}
// (v518a, пак 09.11 п.1; владелец: «оружие заметно лучше — взять без опасного отклонения от позиции», «бомба взорвётся через 6 с …
// у него есть время подобрать», «по пути пропустил калаш, который мог безопасно подобрать») задача ниже подбора — можно сразу; выше —
// отклонение (detourOk, 110): цена — сколько крюк до оружия добавит к пути до своей точки задачи
var PICK_ECO_K = 2;   // (v559) проектное число
function pickDetour(b, G){
  if(taskCanSet(b, "pickup")) return true;
  var P = b.post, toG = pathLenTo(b, G.x, G.y), cost = toG;
  if(P){ var back = polyLen(pathPts(G.x, G.y, P.x, P.y, b.z)); cost = toG + back - pathLenTo(b, P.x, P.y); }
  cost = Math.max(0, cost)/SPEED + 0.3;
  if(!detourOk(b, "pickup", cost)) return false;
  detourStart(b, "pickup", "pickup", toG/SPEED + 1.5);
  return true;
}
function weaponPickupTick(){
  if(!BAL.weaponDrop || (roundState !== "live" && roundState !== "ending")) return;   // (v564, В89) и после конца раунда, до рестарта
  if(!groundWeapons.length){ bots.forEach(function(b){ if(b.alive && b.post && b.post.tag === "pickup"){ clearPost(b); } b._pickGo = null; }); return; }
  bots.forEach(function(b){
    if(!b.alive || b.planting || b.defusing) return;
    // оружие уже подобрал кто-то другой — пост "за оружием" снять (иначе стоял на пустом месте)
    if(b.post && b.post.tag === "pickup" && !groundWeapons.some(function(G){ return Math.hypot(G.x-b.post.x, G.y-b.post.y) < 40; })){ clearPost(b); b._pickGo = null; }
    // идёт за оружием — держим блок каждый тик: раньше блок жил 1 тик, и через
    // тик пост роли и "за оружием" перебивали друг друга (путь пересчитывался)
    else if(b.post && b.post.tag === "pickup" && b.state === "patrol" && !b._sawEnemy){
      // но не вечно: дошёл и не поднял (не положено по правилам/не лучше) или
      // идёт дольше 6с — бросить затею, вернуться к своей задаче
      if(!b._pickT || b._pickT.x !== b.post.x || b._pickT.y !== b.post.y) b._pickT = {x:b.post.x, y:b.post.y, t:tick};
      // (v136) раньше таймер сбрасывался при смене цели: два оружия рядом — бот
      // метался между ними и стоял на месте (путь пересчитывался). Общий лимит
      // на "хожу за оружием" — 7с, потом 8с не отвлекается на ганы
      if(!b._pickSince || tick - b._pickSeen > 4) b._pickSince = tick; b._pickSeen = tick;
      // (п.10 владельца 29.10, м1 р4 т24280: m0NESY 3,3 с стоял у края молотова на Mid, и «идёт дольше 6 с» сняло затею за 215 ед. до
      // оружия) ждёт, пока погаснет огонь на пути (540: fireWait), — это не «иду слишком долго»: сроки на это время стоят
      if(b._fireWaitT != null && tick - b._fireWaitT <= 1){ b._pickT.t++; b._pickSince++; }
      var pickTooLong = BAL.pickFix && tick - b._pickSince > (b._pickSave === roundNum ? 12 : 7)*TICK_HZ;   // (v334) на сейве идёт шагом — дольше
      if((b.atPost && tick - b._pickT.t > TICK_HZ) || tick - b._pickT.t > (b._pickSave === roundNum ? 12 : 6)*TICK_HZ || pickTooLong){ b._pickIgnore = {x:b.post.x, y:b.post.y, round:roundNum}; if(pickTooLong) b._pickBan = tick + 8*TICK_HZ; clearPost(b); b._pickGo = null; b._pickSince = 0; }
      else postKeep(b);   // идёт за оружием — затея ещё идёт (арбитр места)
    }
    // (v378) за оружием шёл, но задача важнее его увела (арбитр места) — помнит, где лежит, и вернётся, когда та кончится
    else if(b._pickGo && b._pickGo.round === roundNum && !(b.post && b.post.tag === "pickup")){
      var PG = b._pickGo;
      if(!groundWeapons.some(function(G){ return Math.hypot(G.x-PG.x, G.y-PG.y) < 40; })) b._pickGo = null;
      else if(b.state === "patrol" && !b._sawEnemy && !(bomb.state === "carried" && bomb.carrier === b) && pickDetour(b, PG) && setPost(b, {x:PG.x, y:PG.y}, null, true, "pickup")){
        logEvent(b.id+": возвращаюсь за оружием"); return; }
    }
    var cur = pickValue(b, b.primary);
    // подобрать под ногами
    for(var i=0;i<groundWeapons.length;i++){
      var G = groundWeapons[i];
      if(Math.hypot(G.x-b.baseX, G.y-b.baseY) > 38 || pickValue(b, G.key) <= cur) continue; // 38 ≥ радиуса "дошёл" (34), иначе стоял рядом и не поднимал
      if(G.key === "AWP" && !awpAllowed(b) && cur >= 5) continue; // снайпу — снайперу
      groundWeapons.splice(i, 1);
      if(b.primary && !sellItem(b, b.primary)) groundWeapons.push({key:b.primary, x:b.x, y:b.y, t:tick, from:b.id});   // (v334) купил в этом раунде — продаёт
      b.primary = G.key; b.weapon = WEAPONS[G.key]; b._ammoFor = null; b._pickGo = null;
      logEvent(b.id+" подобрал "+WEAPONS[G.key].name+(G.from ? " ("+G.from+")" : ""));
      sndPickup(b, "w");   // (v338) звук подбора — только показ
      return;
    }
    // (9) в бою: с пистолетом/ПП, рядом (≤170px) лежит винтовка/AWP убитого, врага
    // сейчас не видно ~0.5с — быстро поднять (как в CS: "подобрал АК и дальше")
    if(BAL.fightPickup && !b._sawEnemy && (b.state === "hold" || b.state === "engage" || b.state === "patrol") && tick - (b._lastSawT||0) > 32 &&
       !(bomb.state === "carried" && bomb.carrier === b) && b._fpT !== tick){
      // не срывается ради гана с важной позиции: после планта (ретейк/пост-плант)
      // и когда рядом свежая инфа о враге — только если ган почти под ногами
      var LKf = beliefLast[b.team] || {}, foeNear = false;
      for(var eF in LKf){ if(tick - LKf[eF].tick < 3*TICK_HZ && Math.hypot(LKf[eF].x-b.x, LKf[eF].y-b.y) < 900){ foeNear = true; break; } }
      // (v518a) после планта — как везде; терпит ли это главная задача — pickDetour (цена по пути), а не «бомба стоит — только под ногами»
      // (v559, В76 ч.2) цель раунда «на следующий закуп» (эко) — винтовка убитого и есть цель: идёт за ней дальше (×PICK_ECO_K, проектное число)
      var gBest = null, gd = (foeNear ? 80 : 170)*(roundGoal(b.team) === "economy" || roundGoal(b.team) === "hero" ? PICK_ECO_K : 1);
      groundWeapons.forEach(function(G){
        if(pickValue(b, G.key) < cur + 2) return;
        if(G.key === "AWP" && !awpAllowed(b) && cur >= 5) return;
        if(b._pickIgnore && b._pickIgnore.round === roundNum && Math.hypot(G.x-b._pickIgnore.x, G.y-b._pickIgnore.y) < 40) return;
        var dG = Math.hypot(G.x-b.x, G.y-b.y); if(dG < gd && hasLOS(b.x, b.y, G.x, G.y, b.z)){ gd = dG; gBest = G; } });
      if(gBest && (b.state !== "patrol" || intelEstimate(b.team, gBest.x, gBest.y, 450, 3*TICK_HZ).n > 0) && pickDetour(b, gBest)){
        b._fpT = tick;
        if(b.state !== "patrol"){ fightState(b, "patrol", "нож"); b.holding = false; b.stateSince = tick; }
        if(setPost(b, {x:gBest.x, y:gBest.y}, null, true, "pickup")) b._pickGo = {x:gBest.x, y:gBest.y, round:roundNum};
        if(!b._fpV || tick - b._fpV > 5*TICK_HZ){ b._fpV = tick; logEvent(b.id+": в бою — подбираю "+WEAPONS[gBest.key].name); }
        return;
      }
    }
    // сходить за ним: рядом, заметно лучше своего, не в бою, без свежей инфы о враге рядом
    if(b.state !== "patrol" || b._sawEnemy || (bomb.state === "carried" && bomb.carrier === b)) return;
    // (v518a, пак 09.11 п.1) было: «бомба стоит — не ходить» и отдельная ветка сейва, которую арбитр не пускал (сейв 10 > подбор 3).
    // Теперь одно правило для всех задач: ниже подбора — идёт, как было; выше — если главная задача терпит крюк (pickDetour, ниже)
    var savingNow = b.team === "CT" && teamTac.CT && teamTac.CT.saving;
    if(tick < (b._pdT || 0)) return;   // крюк по пути — не чаще раза в 0,25 с на бота (путь на пару «бот — оружие» — раз за решение)
    if(b.post && b.post.tag === "pickup") return;
    // (v469, п.27 владельца 29.10, р12 м1: опорник B karrigan пошёл за оружием с самого B, хотя рядом стояли свои) ответ про-аналитика 29.10:
    // за оружием не ходят, пока рядом бой (свежая инфа о враге ≤ 1200 ед. игры = 480 px); опорник, держащий вход на свой сайт, со своей точки за ним не уходит —
    // только со слабым оружием (пистолет / ПП); идёт второй линии игрок или тот, у кого хуже ствол
    // (v547, владелец 10.11: «в ретейке, пост-планте, сейве не подбирают, даже когда есть возможность») у задачи фазы (уровень ≥ 7) враги рядом
    // есть почти всегда — «бой рядом» её не отменяет: решают опасность у самого оружия (danger ниже) и терпит ли задача крюк (pickDetour)
    var LKp = beliefLast[b.team] || {}, phaseP = taskAlive(b) && b._task.lv >= 7;
    if(!phaseP) for(var eP in LKp){ if(tick - LKp[eP].tick < 3*TICK_HZ && Math.hypot(LKp[eP].x-b.x, LKp[eP].y-b.y) < 1200/MAP.pxUnits) return; }
    if((b.tRole === "anchorA" || b.tRole === "anchorB") && b.primary && WEAPONS[b.primary].tier >= 5) return;
    if(BAL.pickFix && b._pickBan > tick) return;
    var best = null, bd = BAL.pickupMore ? 420 : 230;
    groundWeapons.forEach(function(G){
      if(b._pickIgnore && b._pickIgnore.round === roundNum && Math.hypot(G.x-b._pickIgnore.x, G.y-b._pickIgnore.y) < 40) return;
      if(pickValue(b, G.key) < cur + (BAL.pickupMore ? 1 : 2) && !(G.key === "AWP" && awpAllowed(b) && pickValue(b, G.key) > cur)) return; // своя AWP — за второй не ходит (раньше шёл и стоял над ней)
      // то же правило, что при подборе: AWP с винтовкой в руках берёт только снайпер/мидер
      // (раньше шёл к AWP, а поднять "не имел права" — и стоял над ней)
      if(G.key === "AWP" && !awpAllowed(b) && cur >= 5) return;
      var d = Math.hypot(G.x-b.x, G.y-b.y); if(d < bd){ bd = d; best = G; }
    });
    if(!best) return;
    var danger = intelEstimate(b.team, best.x, best.y, 450, (savingNow ? 5 : 3)*TICK_HZ).n > 0;
    if(danger) return;
    b._pdT = tick + 16;
    if(!pickDetour(b, best)) return;
    if(setPost(b, {x:best.x, y:best.y}, null, true, "pickup")){ b._pickGo = {x:best.x, y:best.y, round:roundNum}; if(savingNow){ b._pickSave = roundNum; logEvent(b.id+": сейв — по пути подбираю "+WEAPONS[best.key].name); } }
  });
}
