// ---------- физика полёта и срабатывание ----------
function nadeWallHit(x1,y1,x2,y2){
  if(MAP3D) return m3SolidHit(x1, y1, x2, y2);   // (А5) край твёрдой клетки геометрии (временно — до полёта по физике, шаг В3)
  for(var i=0;i<MANUAL_WALLS.length;i++){
    var s = MANUAL_WALLS[i];
    if(segIntersect(x1,y1,x2,y2,s[0],s[1],s[2],s[3])) return s;
  }
  return null;
}
// (v321, М20, отметка владельца) откуда прилетела граната: кто из врагов видел её в полёте (линия до точки следа) или
// разрыв рядом — понимает примерно, откуда кинули (как в игре: по дуге видно направление и расстояние). Точка броска с
// разбросом ~120 ед. карты (проектное число) идёт в инфу команды как «слышал там врага» и в войс «граната из X»
function nadeOrigin(n){
  if(roundState !== "live" || !n.thrower || n.ox == null) return;
  var foe = n.team === "T" ? "CT" : "T";
  var pts = (n.trail || []).slice(-8).concat([[n.x, n.y]]);
  var saw = bots.filter(function(o){ return o.team === foe && o.alive && tick >= (o.blindUntil||0) &&
    pts.some(function(p){ return Math.hypot(p[0]-o.x, p[1]-o.y) < 1100 && hasVision(o.x, o.y, p[0], p[1]); }); })[0];
  if(!saw) return;
  var j = hashRand(tick*31 + n.ox*7), ja = hashRand(tick*17 + n.oy*3)*Math.PI*2, ex = n.ox + Math.cos(ja)*120*j, ey = n.oy + Math.sin(ja)*120*j;
  if(insideSolidWall(ex, ey)){ ex = n.ox; ey = n.oy; }
  intelPush(foe, {type:"sound", x:ex, y:ey, id:n.thrower.id, kind:"nade", by:saw.id});
  (saw.ears || (saw.ears = [])).push({x:ex, y:ey, tick:tick, team:n.team, kind:"nade", occl:true});
  var zn = zoneIdAt(ex, ey);
  voiceLog(foe, "nf"+(zn||"")+roundNum+Math.floor(tick/(4*TICK_HZ)), saw.id, NADE[n.type].name+" прилетела из "+(zn ? zoneUserName(zn) : calloutName(ex, ey)));
}
function detonate(n){
  var T = n.type;
  if(SND && SND.on) sndNade(T, n.x, n.y);
  if(T !== "decoy") nadeOrigin(n);
  // (11) гранаты видно/слышно: где разорвалась граната врага — это инфа о его плане
  if(BAL.tacRead && roundState === "live" && T !== "decoy"){ var foeT = n.team === "T" ? "CT" : "T"; var NS = teamIntel[foeT].nadeSeen || (teamIntel[foeT].nadeSeen = []); NS.push({x:n.x, y:n.y, type:T, tick:tick}); if(NS.length > 30) NS.shift(); }
  if(T === "smoke"){ smokes.push({x:n.x, y:n.y, born:tick, until:tick+NADE.smoke.life, team:n.team}); if(BAL.smokeReact) smokeShiftOnDetonate(smokes[smokes.length-1]); }
  else if(T === "molly"){
    // молотов, упавший в дым или рядом так, что огонь касается дыма, гаснет (как в CS2 — наоборот тоже: дым тушит огонь;
    // v321, М12: «чуть касается смока — тушится»)
    if(!smokes.some(function(s){ return Math.hypot(s.x-n.x, s.y-n.y) < smokeRadiusNow(s) + NADE.molly.radius*MOLLY_SMOKE_TOUCH; }))
      fires.push({x:n.x, y:n.y, born:tick, until:tick+NADE.molly.life, team:n.team, thrower:n.thrower});
  }
  else if(T === "flash"){
    if(n.why === "под пик") nadeFlags.peekFlashPop = tick;
    nadeFlags["pop:"+n.why] = tick; // общий "хлопнула" для ожидающих (ретейк, поп на убийцу)
    bots.forEach(function(b){
      if(!b.alive) return;
      var d = Math.hypot(b.x-n.x, b.y-n.y);
      if(d > 1000 || !flashSeen(b, n)) return;
      var a = Math.atan2(n.y-b.y, n.x-b.x);
      var off = b.facing === undefined ? 0 : Math.abs(((a - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
      var dirK = off < 0.55 ? 1 : (off < 1.6 ? 0.5 : 0.12);  // смотрел прямо / краем глаза / спиной
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
      var d = Math.hypot(b.x-n.x, b.y-n.y);
      if(d > NADE.he.radius || !hasLOS(n.x, n.y, b.x, b.y, null, b.z)) return;
      var dmg = NADE.he.dmg * (1 - d/NADE.he.radius);
      applyDamage(n.thrower, b, dmg, "HE", {armorRatio: b.armor ? NADE.he.armorK : null});
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
function applyDamage(att, b, dmg, src, o){
  o = o || {};
  if(!b.alive || dmg <= 0) return false;
  var foe = att && att.team !== b.team ? att : null, mate = att && att !== b && att.team === b.team;
  if(mate) dmg = dmg*FF_MUL[src];
  if(o.armorRatio != null) dmg = armorSoak(b, dmg, o.armorRatio, src);
  if(mate){ var fx = dmg + (b._ffFrac||0); dmg = Math.floor(fx); b._ffFrac = fx - dmg; if(dmg <= 0) return false; }
  else { dmg = Math.round(dmg); if(dmg <= 0) return false; }
  if(foe){ var dl0 = Math.min(dmg, Math.max(0,b.hp)); foe.roundDmg = (foe.roundDmg||0) + dl0; var D0 = b._dmgBy || (b._dmgBy = {}); D0[foe.id] = (D0[foe.id]||0) + dl0; }
  b.hp -= dmg;
  if(b.hp > 0) return false;
  b.alive = false; b.deaths++; b._killer = att && att !== b ? att.id : null;   // (v330) кто убил — для обсервера (показ)
  dropWeaponOnDeath(b);
  b.primary = null; b.secondary = b.team==="CT" ? "USP" : "GLOCK"; b.armor = false; b.helmet = false; b.armorHp = 0; b.kit = false;
  b.planting = false; b.defusing = false; b.nades = emptyNades(); b.nadeTask = null; b.nadeQueue = null;
  dropBomb(b);
  intelDeath(b, foe);   // своего убил свой — в войсе «минус», без «убил X»: враг тут ни при чём
  if(foe){ LOOK_REPLAN[foe.team] = true; foe._killHowT = tick; }   // _killHowT — для обсервера (показ)
  if(foe){ foe.kills++; foe.roundKills++; foe.money = Math.min(MAX_MONEY, foe.money + (o.reward || 300)); }
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
function flashSeen(b, n){
  if(!insideSolidWall(n.x, n.y) && hasVision(b.x, b.y, n.x, n.y)) return true;
  for(var r = 30; r <= 60; r += 30) for(var k = 0; k < 8; k++){
    var a = k*Math.PI/4, x = n.x + Math.cos(a)*r, y = n.y + Math.sin(a)*r;
    if(!insideSolidWall(x, y) && hasVision(b.x, b.y, x, y)) return true;
  }
  return false;
}
function nadesTick(){
  var dt = 1/TICK_HZ;
  for(var i=nadesInAir.length-1;i>=0;i--){
    var n = nadesInAir[i];
    if(n.lob){
      var fk = Math.min(1, (tick - n.born)/n.flight);
      n.x = n.sx + (n.tx-n.sx)*fk; n.y = n.sy + (n.ty-n.sy)*fk;
      if(tick % 2 === 0){ n.trail.push([n.x, n.y]); if(n.trail.length > 14) n.trail.shift(); }
      if(fk >= 1){
        // (v323, М30) упала в стену или разброс унёс её за стену от точки прицела — не взрывается в стене, а отскакивает:
        // встаёт у стены со стороны полёта и дальше катится как обычная (отскок от стен — ниже)
        var hitW = insideSolidWall(n.x, n.y) || nadeWallHit(n.aimX, n.aimY, n.x, n.y);
        // (v323, М33) разброс унёс под крышу — упала на крышу: разрыв виден и слышен, но на тех, кто под ней, не действует
        if(!hitW && !n.under && nadeCovered(n.x, n.y)){ nadesInAir.splice(i,1); n.onRoof = true; nadeOrigin(n); nadeFx.push({x:n.x, y:n.y, type:n.type, born:tick, roof:true}); continue; }
        if(!hitW){ nadesInAir.splice(i,1); detonate(n); continue; }
        var bx = n.aimX, by = n.aimY;
        if(insideSolidWall(bx, by)){ for(var q = 1; q <= 40; q++){ var f2 = 1 - q/40; bx = n.sx + (n.aimX-n.sx)*f2; by = n.sy + (n.aimY-n.sy)*f2; if(!insideSolidWall(bx, by)) break; } }
        var ang = Math.atan2(n.y-by, n.x-bx), sp0 = Math.max(60, Math.hypot(n.x-bx, n.y-by)*(1-0.96)*TICK_HZ);
        n.lob = false; n.x = bx; n.y = by; n.vx = Math.cos(ang)*sp0; n.vy = Math.sin(ang)*sp0;
        if(n.type === "flash" || n.type === "he") n.born = Math.min(n.born, tick - NADE[n.type].fuse + 8);   // запал уже догорел — рвётся у стены через 8 тиков
      }
      continue;
    }
    var nx = n.x + n.vx*dt, ny = n.y + n.vy*dt;
    var w = nadeWallHit(n.x, n.y, nx, ny);
    if(w){
      // отскок: отражаем скорость от линии стены, теряем половину энергии
      var ex = w[2]-w[0], ey = w[3]-w[1], L = Math.hypot(ex,ey)||1; ex/=L; ey/=L;
      var dot = n.vx*ex + n.vy*ey;
      var px = n.vx - dot*ex, py = n.vy - dot*ey; // нормальная составляющая
      n.vx = (dot*ex - px)*0.5; n.vy = (dot*ey - py)*0.5; if(SND && SND.on) sndNade("bounce", n.x, n.y);
    } else { n.x = nx; n.y = ny; }
    n.vx *= 0.96; n.vy *= 0.96;
    if(tick % 2 === 0){ n.trail.push([n.x, n.y]); if(n.trail.length > 14) n.trail.shift(); }
    var sp = Math.hypot(n.vx, n.vy), age = tick - n.born;
    var def = NADE[n.type];
    var boom = (n.type === "smoke" && (sp < 30 || age > def.fuse)) ||
               (n.type === "molly" && (sp < 70 || age > def.fuse)) ||
               ((n.type === "flash" || n.type === "he") && age >= def.fuse);
    if(boom){
      // (v323, М30) не рвётся внутри стены: последняя точка следа вне стены
      if(insideSolidWall(n.x, n.y)) for(var q2 = n.trail.length-1; q2 >= 0; q2--){ if(!insideSolidWall(n.trail[q2][0], n.trail[q2][1])){ n.x = n.trail[q2][0]; n.y = n.trail[q2][1]; break; } }
      nadesInAir.splice(i,1); detonate(n);
    }
  }
  for(var s=smokes.length-1;s>=0;s--) if(tick >= smokes[s].until) smokes.splice(s,1);
  for(var f=fires.length-1;f>=0;f--){
    var fr = fires[f];
    if(tick >= fr.until){ fires.splice(f,1); continue; }
    // дым, раскрывшийся на огне, тушит его
    if(smokes.some(function(sm){ return Math.hypot(sm.x-fr.x, sm.y-fr.y) < smokeRadiusNow(sm) + NADE.molly.radius*MOLLY_SMOKE_TOUCH; })){ if(SND && SND.on) sndNade("extinguish", fr.x, fr.y); fires.splice(f,1); continue; }
    bots.forEach(function(b){
      if(!b.alive) return;   // (v263, Б1) огонь жжёт и своих — множитель в applyDamage
      if(fireTouches(fr, b.x, b.y)){
        // (v323, М35) урон за удар растёт 1 → 8, удар раз в 0,2 с — чем дольше в огне, тем сильнее (fireDamageFor)
        if(!b._fireIn || b._fireIn.f !== fr){ b._fireIn = {f:fr, t:tick, hits:0}; }
        var hitsNow = Math.floor((tick - b._fireIn.t)/TICK_HZ/FIRE_HIT_SEC);
        while(b._fireIn.hits < hitsNow && b.alive){ b._fireIn.hits++; if(SND && SND.on && b._fireIn.hits % 3 === 1) sndBody("burn", b.x, b.y); applyDamage(fr.thrower, b, Math.min(FIRE_HIT_MAX, b._fireIn.hits), "молотов"); }
      } else if(b._fireIn && b._fireIn.f === fr){ b._fireIn = null; }
    });
  }
  for(var x=nadeFx.length-1;x>=0;x--) if(tick - nadeFx[x].born > 40) nadeFx.splice(x,1);
}

