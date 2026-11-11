// ---------- физика полёта и срабатывание ----------
// (физика гранат, 30.10.2026; так было в В3, ветка nades-v398) смок / молотов лёг на крышу — по настоящему касанию (точка покоя
// физики), высоко над полом, куда можно дойти (выше NADE_ROOF_DZ над самым высоким таким полом под ним): разрыв виден и слышен,
// но дым / огонь не действуют на тех, кто под крышей (дым и огонь у нас без этажа). На ящике, карнизе пониже — действует. Флешка
// и HE рвутся где угодно (в воздухе тоже) — действуют всегда. Прежнее «упала на крышу» — по точке цели и придуманной дуге, без
// касания (граната пропадала) — удалено
var NADE_ROOF_DZ = 120;   // ед. игры — проектное число (ящик ≈ 64, этаж ≈ 128 и выше)
function nadeOnRoof(x, y, z){
  var M = m3(); if(!M) return false;
  var top = -Infinity;
  for(var dj = -1; dj <= 1; dj++) for(var di = -1; di <= 1; di++){
    var f = m3Floors(M, x + di*M.cell, y + dj*M.cell);
    for(var q = 0; q < f.length; q++) if(f[q] <= z + 16 && f[q] > top) top = f[q];
  }
  return top !== -Infinity && z - top > NADE_ROOF_DZ;   // ниже всех известных полов (яма, нижний уровень без этажа в данных) — не крыша
}
// (v321, М20, отметка владельца) откуда прилетела граната: кто из врагов видел её в полёте (линия до точки следа) или
// разрыв рядом — понимает примерно, откуда кинули (как в игре: по дуге видно направление и расстояние). Точка броска с
// разбросом ~120 ед. карты (проектное число) идёт в инфу команды как «слышал там врага» и в войс «граната из X»
function nadeOrigin(n){
  if(roundState !== "live" || !n.thrower || n.ox == null) return;
  // (п.15 владельца 29.10, м1 р4 т28923: смок m0NESY с B Short встал после его смерти — «граната оттуда» ушла в инфу T как «слышал врага»
  // («?») и держала прострел дыма) бросивший уже убит (киллфид видят все) — точка броска не место врага
  if(!n.thrower.alive) return;
  var foe = n.team === "T" ? "CT" : "T";
  var pts = (n.trail || []).slice(-8).concat([[n.x, n.y]]);
  var saw = bots.filter(function(o){ return o.team === foe && o.alive && tick >= (o.blindUntil||0) &&
    pts.some(function(p){ return Math.hypot(p[0]-o.x, p[1]-o.y) < 1100 && hasVision(o.x, o.y, p[0], p[1]); }); })[0];
  if(!saw) return;
  var j = hashRand(tick*31 + n.ox*7), ja = hashRand(tick*17 + n.oy*3)*Math.PI*2, ex = n.ox + Math.cos(ja)*120*j, ey = n.oy + Math.sin(ja)*120*j;
  if(insideSolidWall(ex, ey)){ ex = n.ox; ey = n.oy; }
  // (00_PLAN, аудит 2.2, 05.11) видевший бросок говорит в войс (230: «слышу» — с задержкой фразы), а не мгновенно в память команды
  var zN = knowZoneAt(ex, ey); if(zN && saw.voice) teamPropose(saw, {kind: "hear", zone: zN, sound: "nade", count: 1});
  (saw.ears || (saw.ears = [])).push({x:ex, y:ey, tick:tick, team:n.team, kind:"nade", occl:true});
  // (док 6) в войс — через знание и канал команды (teamNotice: «гранату кинули из X»), а не отдельной надписью
}
function detonate(n){
  var T = n.type;
  if(SND && SND.on) sndNade(T, n.x, n.y);
  if(T !== "decoy") nadeOrigin(n);
  // (11) гранаты видно/слышно: где разорвалась граната врага — это инфа о его плане
  if(BAL.tacRead && roundState === "live" && T !== "decoy"){ var foeT = n.team === "T" ? "CT" : "T"; var NS = teamIntel[foeT].nadeSeen || (teamIntel[foeT].nadeSeen = []); NS.push({x:n.x, y:n.y, type:T, tick:tick}); if(NS.length > 30) NS.shift(); }
  if(T === "smoke"){ exuLanded(n, false); smokes.push({x:n.x, y:n.y, born:tick, until:tick+NADE.smoke.life, team:n.team}); if(BAL.smokeReact) smokeShiftOnDetonate(smokes[smokes.length-1]); }
  else if(T === "molly"){
    // молотов, упавший в дым или рядом так, что огонь касается дыма, гаснет (как в CS2 — наоборот тоже: дым тушит огонь;
    // v321, М12: «чуть касается смока — тушится»)
    if(!smokes.some(function(s){ return Math.hypot(s.x-n.x, s.y-n.y) < smokeRadiusNow(s) + NADE.molly.radius*MOLLY_SMOKE_TOUCH; }))
    { fires.push({x:n.x, y:n.y, z:n.z != null ? visFloorAt(n.x, n.y, n.z) : null, born:tick, until:tick+NADE.molly.life, team:n.team, thrower:n.thrower}); fireRepath(n.x, n.y);   // (v555) z — пол, где горит (fireTouches, 370)
      // (v506, владелец 04.11: «инфа про молотов — просто знали, что кинули молотов, но чтобы это никуда не уводило») враг, который видит
      // огонь, говорит в войс «молотов на …» — только колл в панель войса: знание о врагах и решения не меняются (где разорвалась граната
      // врага, команда и так помнит — nadeSeen выше)
      if(roundState === "live"){ var mSaw = bots.filter(function(o){ return o.alive && o.team !== n.team && hasVision(o.x, o.y, n.x, n.y); })
          .sort(function(p, q){ return Math.hypot(p.x-n.x, p.y-n.y) - Math.hypot(q.x-n.x, q.y-n.y); })[0];
        if(mSaw) voiceLog(mSaw.team, "molly"+Math.round(n.x/40)+","+Math.round(n.y/40)+"@"+roundNum, mSaw.id, "молотов "+calloutName(n.x, n.y)); } }
  }
  else if(T === "flash"){
    if(n.why === "под пик") nadeFlags.peekFlashPop = tick;
    nadeFlags["pop:"+n.why] = tick; // общий "хлопнула" для ожидающих (ретейк, поп на убийцу)
    bots.forEach(function(b){
      if(!b.alive) return;
      var d = n.z != null ? Math.hypot(b.x-n.x, b.y-n.y, (n.z - visFloorAt(b.x, b.y, b.z) - VIS_EYE.stand)/(MAP.pxUnits || 2.5)) : Math.hypot(b.x-n.x, b.y-n.y);   // (v519) в 3D
      var dirK = flashDirK(b, n); if(!dirK) return;
      // враг, который видел/слышал летящую флешку, может успеть отвернуться —
      // тем вероятнее, чем выше навык (раньше флешка слепила "по учебнику" всегда)
      // (этап 3, P2-2) свой отворачивается наверняка (×0,18 ниже), только если дослушал колл «флешу!» до хлопка;
      // не предупреждённый — как враг: увернуться может, если видел/слышал бросок, иначе застаёт врасплох
      var warned = b.team === n.team && (b === n.thrower || (n.warned && n.warned[b.id] !== undefined));
      if(!warned){
        // увернуться можно, только если знал о флешке (видел/слышал бросок);
        // поп-флешка из-за стены почти всегда застаёт врасплох
        var pD = BAL.flashAware ? ((n.aware && n.aware[b.id]) ? 0.5 + 0.3*prof(b, "disc") + 0.1*(b.skill-0.8)/0.4 : 0.3) : 0.25 + 0.3*(b.skill-0.8)/0.4;
        var dodge = hashRand(tick*29 + b.id.charCodeAt(0)*13 + b.id.length*7) < pD;
        if(dodge){ dirK *= 0.3; if(BAL.flashAware && dirK > 0.1) logEvent(b.id+" отвернулся от флешки"); }
      }
      var secs = BAL.flashMax * dirK * Math.max(0, 1 - d/1100);
      // свои, кто знает про флешку (бросил сам / колл «флешу!»), отворачиваются — слепит их редко и слабо
      if(warned) secs *= (b === n.thrower ? 0.05 : 0.18);
      if(secs > 0.35){
        var lkBefore = b.lastIntel || (b._nearestEnemyBot ? {x:b._nearestEnemyBot.x, y:b._nearestEnemyBot.y, tick:tick} : null);
        b.blindUntil = Math.max(b.blindUntil, tick + Math.round(secs*TICK_HZ)); if(n.thrower && n.thrower.team !== b.team) b._blindBy = n.thrower.id;
        b.contactStreak = 0; b._ts = {}; b.lastIntel = null;
        if(secs > 1.2) logEvent(b.id+" ослеплён"+(b.team===n.team?" своей флешкой":"")+" ("+secs.toFixed(1)+"с)");
        if(BAL.blindPlay && b.team !== n.team && secs > 0.8) onBlind(b, lkBefore || {x:n.x, y:n.y});
      }
    });
  }
  else if(T === "he"){
    if(BAL.heClearsSmoke) smokes.forEach(function(sm){
      if(Math.hypot(sm.x-n.x, sm.y-n.y) < NADE.smoke.radius + 40){ sm.holeLen = Math.round(1.3*TICK_HZ); sm.holeUntil = tick + sm.holeLen;
        logEvent("HE разогнал смок "+calloutName(sm.x, sm.y)); }
    });
    bots.forEach(function(b){
      if(!b.alive) return;   // (v263, Б1) HE ранит и своих, и бросившего — множитель в applyDamage
      // (v519, пак 09.11 п.4; А-2: «граната, взорвавшаяся в стене, убивает игрока») урон — от настоящей точки разрыва (высота — физика полёта, 385):
      // расстояние в 3D и линия той же 3D-геометрией карты, что полёт, до корпуса или головы. Было: расстояние по радару и «видно ли» от глаз
      // человека, стоящего на верхнем полу под гранатой (высота разрыва не бралась)
      var bf = visFloorAt(b.x, b.y, b.z), pu = MAP.pxUnits || 2.5, nz = n.z != null ? n.z : bf + VIS_EYE.crouch;
      var d = Math.hypot(b.x-n.x, b.y-n.y, (nz - (bf + 36))/pu);
      if(d > NADE.he.radius) return;
      if(n.z != null ? !(visMarch(n.x, n.y, nz + 4, b.x, b.y, bf + 36) || visMarch(n.x, n.y, nz + 4, b.x, b.y, bf + VIS_EYE.stand)) : !hasLOS(n.x, n.y, b.x, b.y, null, b.z)) return;
      var dmg = NADE.he.dmg * (1 - d/NADE.he.radius);
      applyDamage(n.thrower, b, dmg, "HE", {armorRatio: b.armor ? NADE.he.armorK : null, from:{x:n.x, y:n.y, z:n.z}});
    });
  }
  nadeFx.push({type:T, x:n.x, y:n.y, born:tick});
  recordNadeLand(n);
}
// (v263, Б1) Урон по своим — правила CS2 на про (mp_friendlyfire 1, docs/PRO_PLAY.md «Урон по своим»):
// пуля по своему ×0,33 (ff_damage_reduction_bullets), HE ×0,85 (ff_damage_reduction_grenade), своя граната по себе ×1
// (…_grenade_self); молотов ×0,4 — как «прочее» (ff_damage_reduction_other): к какой группе огонь относится, источника
// нет — проектное число. Убил своего — −$300 (cash_player_killed_teammate), фраг не засчитан.
var FF_MUL = {bullet: 0.33, HE: 0.85, "молотов": 0.4};
var FILL_FUNC_R = 300;   // (v561, этап 5) px: держать линию погибшего — с места не дальше этого от его точки (проектное число)
var FILL_NEAR = 900;   // (v359) подмена «под боком» — путь до места погибшего, ед. карты (проектное число)
var FF_TK_CASH = -300;
// Урон и смерть — одно место для пуль, HE и молотова. o: {wkey, hs, reward, mods, note}. Вернёт true, если убил.
// (v357, владелец: «рассмотри урон и дамаг») броня — прочность 0–100, как в игре: попадание в закрытое место (корпус в кевларе,
// голова в каске) идёт в HP × armorRatio (у оружия — armorPen), в прочность — (урон − в HP) × ARMOR_BONUS; прочности не хватило —
// остаток идёт в HP (урон − прочность / ARMOR_BONUS). Прочность 0 — броня и каска пропадают. Формула CS:GO (CCSPlayer::OnTakeDamage),
// сверено с демками Mirage (player_death: dmg_armor): AK в голову в каске — 15–16 (по формуле 16), в корпус — 3–4 (4), M4A4 в
// голову — 19 (20), AWP в корпус — 1 (1). HE: прочность — 0,66 × урона в HP (демки: 84 смерти от HE в броне, 0,65–0,67);
// молотов броню не трогает (демки: 0 из 25). Бомба — как была (подобрана по демкам на игроках в броне)
var ARMOR_BONUS = 0.5, HE_ARMOR_K = 0.66;
function armorSoak(b, raw, ratio, src){
  if(b.armorHp == null) b.armorHp = b.armor ? 100 : 0;   // снимки до v357
  if(!(b.armorHp > 0)) return raw;
  var h = raw*ratio, a = src === "HE" ? h*HE_ARMOR_K : (raw - h)*ARMOR_BONUS;
  if(a > b.armorHp){ h = src === "HE" ? raw - b.armorHp*(1-ratio)/(ratio*HE_ARMOR_K) : raw - b.armorHp/ARMOR_BONUS; a = b.armorHp; }
  b.armorHp = Math.max(0, Math.round(b.armorHp - a));
  if(b.armorHp <= 0){ b.armor = false; b.helmet = false; }
  return Math.max(0, h);
}
var HURT_SND_GAP = 32;   // (v546) тиков (0,5 с) — проектное число
function applyDamage(att, b, dmg, src, o){
  o = o || {};
  if(!b.alive || dmg <= 0) return false;
  var foe = att && att.team !== b.team ? att : null, mate = att && att !== b && att.team === b.team;
  if(mate) dmg = dmg*FF_MUL[src];
  if(o.armorRatio != null) dmg = armorSoak(b, dmg, o.armorRatio, src);
  if(mate){ var fx = dmg + (b._ffFrac||0); dmg = Math.floor(fx); b._ffFrac = fx - dmg; if(dmg <= 0) return false; }
  else { dmg = Math.round(dmg); if(dmg <= 0) return false; }
  if(foe){ var dl0 = Math.min(dmg, Math.max(0,b.hp)); foe.roundDmg = (foe.roundDmg||0) + dl0; var D0 = b._dmgBy || (b._dmgBy = {}); D0[foe.id] = (D0[foe.id]||0) + dl0;
    // (дуэли 06.11) кто кому сколько в этой перестрелке — 470 duelEval / fin: последние попадания у обоих, [тик, кто, урон]
    var HL = b._hitIn || (b._hitIn = []); HL.push([tick, foe.id, dl0]); if(HL.length > 16) HL.shift();
    var HO = foe._hitOut || (foe._hitOut = []); HO.push([tick, b.id, dl0]); if(HO.length > 16) HO.shift(); }
  // (v518a, пак 09.11 п.6) «ранен» — одно место для пули, HE и огня (раньше ставили только пули, 490 / 450): откуда — то, что знает живой игрок:
  // пуля — откуда стреляли (звук выстрела + сторона попадания), HE / огонь — где разорвалось / горит. Реакция — hurtReactTick (350)
  if(foe){ b._hurtT = tick; b._hurtSrc = src; b._hurtFrom = o.from || {x:foe.x, y:foe.y, z:foe.z}; }
  b.hp -= dmg;
  // (v546, владелец 10.11: «боты слышат, как кто-то подгорает в молотове или получил урон от пули, от гранаты» — это инфа) звук попадания
  // слышат враги раненого (moveSoundEmit — как шаги: за стеной ближе, место — пятно): пуля и HE — как бег (таблица владельца: 800–900 ед.,
  // «как бег / чуть громче»), огонь — 600 / 800 бега. Чаще раза в HURT_SND_GAP у одного игрока не повторяется (проектное число)
  if(roundState === "live" && src !== "C4" && tick - (b._hurtSndT || -1e9) >= HURT_SND_GAP){ b._hurtSndT = tick; var fireH = src === "молотов";
    moveSoundEmit(b, SOUND_RADIUS_RUN*(fireH ? 600/800 : 1), "steps", fireH ? "горит в молотове" : "попадание"); }
  if(b.hp > 0) return false;
  b.alive = false; b.deaths++; b._killer = att && att !== b ? att.id : null;   // (v330) кто убил — для обсервера (показ)
  dropWeaponOnDeath(b);
  b.primary = null; b.secondary = b.team==="CT" ? "USP" : "GLOCK"; b.armor = false; b.helmet = false; b.armorHp = 0; b.kit = false;
  b.planting = false; b.defusing = false; b.nades = emptyNades(); b.nadeTask = null; b.nadeQueue = null;
  dropBomb(b);
  intelDeath(b, foe);   // своего убил свой — в войсе «минус», без «убил X»: враг тут ни при чём
  if(foe){ LOOK_REPLAN[foe.team] = true; foe._killHowT = tick; }   // _killHowT — для обсервера (показ)
  if(foe) hlKill(foe);   // (v447) хайлайт: серия в ударе
  if(foe){ foe.kills++; foe.roundKills++; foe.money = Math.min(MAX_MONEY, foe.money + (o.reward || 300)); ecoKnowKill(foe, o.reward || 300); }   // (Г1) награда видна в киллфиде
  else if(mate) att.money = Math.max(0, att.money + FF_TK_CASH);
  var wkey = o.wkey || (src === "HE" ? "HE" : "MOLOTOV");
  logEvent((att?att.id:(src === "C4" ? "бомба" : "?"))+" ["+(o.wkey ? (WEAPONS[o.wkey] ? WEAPONS[o.wkey].name : o.wkey) : src)+"] "+(mate ? "убил своего " : att === b ? "убил себя " : "устранил ")+b.id+(o.note||""), true);
  var mods = o.mods || {}; if(mate || att === b) mods.tk = true;
  // (v288) чем убит — только для показа: иконка у крестика на радаре
  b._killHow = {round: roundNum, w: src === "C4" ? "C4" : (src === "HE" || src === "молотов") ? wkey : null, smoke: !!mods.smoke, blind: !!mods.blind};
  if(!o.noFeed) feedKill(att, b, wkey, !!o.hs, mods);
  else if(src === "C4") feedBombKill(b);
  return true;
}
// (v321, М13) флешку взрывают в воздухе, часто над крышей/стеной (точки разрыва про из демок лежат «в стене» на радаре);
// стены у нас без высоты, поэтому видно вспышку над крышей — если виден край рядом с ней: точка в 30 или 60 ед. карты от
// разрыва вне стены, до которой у бота есть линия (проектные числа)
// (v419) насколько флешка в точке n слепит b по направлению взгляда: 0 — не видит / дальше 1000, иначе 1 / 0,5 / 0,12 (прямо /
// краем глаза / спиной). Одно место: хлопок (выше) и проверка перед броском «не слепит своих» (flashSafeFor, 350)
function flashDirK(b, n){
  var d = n.z != null ? Math.hypot(b.x-n.x, b.y-n.y, (n.z - visFloorAt(b.x, b.y, b.z) - VIS_EYE.stand)/(MAP.pxUnits || 2.5)) : Math.hypot(b.x-n.x, b.y-n.y);
  if(d > 1000 || !flashSeen(b, n)) return 0;
  var a = Math.atan2(n.y-b.y, n.x-b.x);
  var off = b.facing === undefined ? 0 : Math.abs(((a - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
  // (v554, владелец 11.11: «что там с углом обзора») угол — в 3D: разрыв высоко над головой / под ногами — не «прямо в лицо», хотя по радару
  // направление то же (взгляд — по горизонтали, глаза на высоте роста)
  if(n.z != null){ var K = MAP.pxUnits || 2.5, hd = Math.hypot(n.x-b.x, n.y-b.y)*K, vd = n.z - (visFloorAt(b.x, b.y, b.z) + VIS_EYE.stand);
    off = Math.acos(Math.max(-1, Math.min(1, Math.cos(off)*hd/Math.max(1e-6, Math.hypot(hd, vd))))); }
  return off < 0.55 ? 1 : (off < 1.6 ? 0.5 : 0.12);  // смотрел прямо / краем глаза / спиной
}
function flashSeen(b, n){
  // (v519, пак 09.11 п.4; А-22 / Р-7: «флешка, которая взрывается в стене, — надо учитывать высоту: над крышами на радаре она в стене») разрыв с
  // высотой (флешка в полёте, 385) — линия от глаз бойца (его пол + рост) до точки разрыва той же 3D-геометрией карты: над крышей — видно, за
  // стеной — нет. Точка без высоты (проверка перед броском «не слепит своих», 350) — как было: край в 30 / 60 ед. вне стены
  if(n.z != null){ var ez = visFloorAt(b.x, b.y, b.z) + VIS_EYE.stand;
    return !smokeBlocks(b.x, b.y, n.x, n.y) && (visMarch(b.x, b.y, ez, n.x, n.y, n.z) || visMarch(b.x, b.y, ez, n.x, n.y, n.z + 16)); }
  if(!insideSolidWall(n.x, n.y) && hasVision(b.x, b.y, n.x, n.y)) return true;
  for(var r = 30; r <= 60; r += 30) for(var k = 0; k < 8; k++){
    var a = k*Math.PI/4, x = n.x + Math.cos(a)*r, y = n.y + Math.sin(a)*r;
    if(!insideSolidWall(x, y) && hasVision(b.x, b.y, x, y)) return true;
  }
  return false;
}
function nadesTick(){
  var nTr = nadesInAir.length ? nadeTraceFn() : null;   // луч гранаты (m3NadeTrace); не глобальная var: снимок «Отметить момент» не копирует функции
  for(var i=nadesInAir.length-1;i>=0;i--){
    var n = nadesInAir[i];
    if(!n.p){ nadesInAir.splice(i,1); continue; }   // граната из снимка до физики (без состояния)
    // (физика гранат) полёт — один тик физики (385: nadeStep — тяжесть, касания кубиком по геометрии игры, отскок по нормали, покой,
    // запал); x, y, z и след — те же точки, что рисуются (620). Прежние навес по прямой к цели, «телепорт» от стены и отскок от
    // клеток 2D-сетки удалены
    var nb0 = n.bounces.length, how = nadeStep(n, nTr);
    var R = m3Radar(m3(), n.p[0], n.p[1]); n.x = R[0]; n.y = R[1]; n.z = n.p[2];
    if(n.bounces.length > nb0 && SND && SND.on) sndNade("bounce", n.x, n.y);
    if(tick % 2 === 0){ n.trail.push([n.x, n.y, n.z]); if(n.trail.length > 40) n.trail.shift(); }
    if(!how) continue;
    nadesInAir.splice(i,1);
    if(how === "lost"){ logEvent("граната "+NADE[n.type].name+" ушла за карту (физика) — без срабатывания"); continue; }   // не должно быть: под картой пол
    if((n.type === "smoke" || n.type === "molly") && nadeOnRoof(n.x, n.y, n.z)){ n.onRoof = true; nadeOrigin(n); nadeFx.push({x:n.x, y:n.y, type:n.type, born:tick, roof:true}); if(n.type === "smoke") exuLanded(n, true); continue; }
    detonate(n);
  }
  for(var s=smokes.length-1;s>=0;s--) if(tick >= smokes[s].until) smokes.splice(s,1);
  for(var f=fires.length-1;f>=0;f--){
    var fr = fires[f];
    if(tick >= fr.until){ fires.splice(f,1); fireGoneRepath(fr); continue; }
    // дым, раскрывшийся на огне, тушит его
    if(smokes.some(function(sm){ return Math.hypot(sm.x-fr.x, sm.y-fr.y) < smokeRadiusNow(sm) + NADE.molly.radius*MOLLY_SMOKE_TOUCH; })){ if(SND && SND.on) sndNade("extinguish", fr.x, fr.y); fires.splice(f,1); fireGoneRepath(fr); continue; }
    bots.forEach(function(b){
      if(!b.alive) return;   // (v263, Б1) огонь жжёт и своих — множитель в applyDamage
      if(fireTouches(fr, b.x, b.y, b.z)){
        // (v323, М35) урон за удар растёт 1 → 8, удар раз в 0,2 с — чем дольше в огне, тем сильнее (fireDamageFor)
        if(!b._fireIn || b._fireIn.f !== fr){ b._fireIn = {f:fr, t:tick, hits:0}; }
        var hitsNow = Math.floor((tick - b._fireIn.t)/TICK_HZ/FIRE_HIT_SEC);
        while(b._fireIn.hits < hitsNow && b.alive){ b._fireIn.hits++; if(SND && SND.on && b._fireIn.hits % 3 === 1) sndBody("burn", b.x, b.y); applyDamage(fr.thrower, b, Math.min(FIRE_HIT_MAX, b._fireIn.hits), "молотов", {from:{x:fr.x, y:fr.y}}); }
      } else if(b._fireIn && b._fireIn.f === fr){ b._fireIn = null; }
    });
  }
  for(var x=nadeFx.length-1;x>=0;x--) if(tick - nadeFx[x].born > 40) nadeFx.splice(x,1);
}

