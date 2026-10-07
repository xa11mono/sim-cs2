// ======================= гранаты: физика и действие (правила CS2) =======================
// Смок (перекрывает обзор), флешка (ослепляет тех, кто смотрит в её сторону),
// HE (урон), молотов/зажигалка (горящая зона, урон по времени). Полёт — по
// прямой с затуханием скорости и отскоком от стен; навесной бросок (лайнап) —
// в точку с небольшим разбросом. Кто, куда и когда кидает — решает мозг
// (сейчас его нет): движок даёт действие «бросить» (функция throwNade).
var NADE = {
  smoke:  {name:"дым",     price:300, fuse:192, radius:BAL.smokeR, life:BAL.smokeLife*64},
  flash:  {name:"флешка",  price:200, fuse:100},
  he:     {name:"HE",      price:300, fuse:100, radius:190, dmg:57},
  molly:  {name:"молотов", price:400, priceCT:500, fuse:90, radius:72, life:BAL.mollyLife*64, dps:40}
};
var NADE_THROW_RANGE = 820;
var NADE_HEAR_R = 550; // раздел 11.1: с какого расстояния слышно чеку/бросок гранаты противника
var nadesInAir = [];   // {type, x,y, vx,vy, born, thrower, team, trail:[]}
var smokes = [];       // {x,y,born,until}
var fires = [];        // {x,y,born,until,team,thrower}
var nadeFx = [];       // визуальные вспышки/взрывы {type,x,y,born}

function emptyNades(){ return {smoke:0, flash:0, he:0, molly:0}; }
bots.forEach(function(b){ b.nades = emptyNades(); b.blindUntil = 0; });


// дым перекрывает обзор: smokeBlocks, smokeRadiusNow, ван-вей — 10_vision.js (v201)
function stepBlocked(x1,y1,x2,y2,b){ return crossesWall(x1,y1,x2,y2); }

// ---------- бросок ----------
function throwNade(b, type, tx, ty, lob, why){
  if(!b.nades || b.nades[type] <= 0) return false;
  b.nades[type]--;
  var d = Math.max(60, Math.hypot(tx-b.x, ty-b.y)); if(!lob) d = Math.min(NADE_THROW_RANGE, d);
  var a = Math.atan2(ty-b.y, tx-b.x);
  var v0 = d * (1-0.96) * TICK_HZ; // при затухании 0.96/тик пролетит примерно d
  var nd = {type:type, x:b.x, y:b.y, vx:Math.cos(a)*v0, vy:Math.sin(a)*v0, born:tick, thrower:b, team:b.team, trail:[], why:why||""};
  if(lob){
    // лайнап не идеален: небольшой разброс точки падения
    var le = BAL.lobErr * hashRand(tick*71 + b.id.charCodeAt(0)*5), la2 = hashRand(tick*13 + b.id.length*97)*Math.PI*2;
    nd.lob = true; nd.sx = b.x; nd.sy = b.y; nd.tx = tx + Math.cos(la2)*le; nd.ty = ty + Math.sin(la2)*le; nd.flight = Math.max(30, Math.round(d/650*TICK_HZ));
  }
  nadesInAir.push(nd);
  b.throwUntil = tick + 18; // ~0.3с стоит на броске
  b.facing = a;
  logEvent(b.id+" кинул "+NADE[type].name+(why ? " — "+why : "")+(lob ? " (лайнап)" : ""));
  // бросок слышно (чека/замах), а полёт гранаты видно
  makeSound(b, b.x, b.y, "nade");
  var fx = b.x + ((nd.lob ? nd.tx : tx) - b.x)*0.35, fy = b.y + ((nd.lob ? nd.ty : ty) - b.y)*0.35;
  makeSound(b, b.x, b.y, "nadefly", {via:{x:fx, y:fy}});
  return true;
}
// ======================= СВОИ ЛАЙНАПЫ =======================
var LINEUPS_BAKED = @@DATA:lineups_own.json@@; // свои лайнапы владельца (из «Экспорт проекта», зашиты в код)
var LINEUPS_KEY = "ancient-live-radar-lineups-v1";
var USER_LINEUPS = [];
try{ var _lu = JSON.parse(localStorage.getItem(LINEUPS_KEY)||"null"); if(Array.isArray(_lu)) USER_LINEUPS = _lu; }catch(e){}
function saveLineups(){ try{ localStorage.setItem(LINEUPS_KEY, JSON.stringify(USER_LINEUPS)); }catch(e){} }
// про-лайнапы из демок — как данные (точки «откуда → куда»): показ в редакторе лайнапов
var PRO_LINEUPS_RAW = @@DATA:lineups_pro.json@@.concat(@@DATA:lineups_pro_rare.json@@);
var PRO_LINEUPS = null;
function proLineups(){
  if(PRO_LINEUPS) return PRO_LINEUPS;
  PRO_LINEUPS = PRO_LINEUPS_RAW.map(function(L){
    var f = snapToWalkable(L.from.x, L.from.y) || L.from;
    return {id:L.id, team:L.team, type:L.type, trigger:L.trigger, site:L.site, name:L.name, from:{x:f.x, y:f.y}, to:L.to, prob:L.prob, at:L.at, pro:true};
  });
  return PRO_LINEUPS;
}
function allLineups(){ var L = LINEUPS_BAKED.concat(USER_LINEUPS); return L.concat(proLineups()); }
var LU_TRIG = {insta:"инста", setup:"сетап T", exec:"выход T", postplant:"пост-плант", call:"колл CT", retake:"ретейк"};
var LU_TYPE = {smoke:"смок", flash:"флешка", molly:"молотов", he:"HE"};
function nadeWallHit(x1,y1,x2,y2){
  for(var i=0;i<MANUAL_WALLS.length;i++){
    var s = MANUAL_WALLS[i];
    if(segIntersect(x1,y1,x2,y2,s[0],s[1],s[2],s[3])) return s;
  }
  return null;
}
function detonate(n){
  var T = n.type;
  // разрыв гранаты слышно/видно (makeSound "pop")
  if(roundState === "live" && T !== "decoy" && n.thrower) makeSound(n.thrower, n.x, n.y, "pop", {info:{ntype:T}});
  if(T === "smoke"){ smokes.push({x:n.x, y:n.y, born:tick, until:tick+NADE.smoke.life, team:n.team}); }
  else if(T === "molly"){
    // молотов, упавший в дым, гаснет (как в CS2 — наоборот тоже: дым тушит огонь)
    if(!smokes.some(function(s){ return Math.hypot(s.x-n.x, s.y-n.y) < smokeRadiusNow(s); }))
      fires.push({x:n.x, y:n.y, born:tick, until:tick+NADE.molly.life, team:n.team, thrower:n.thrower});
  }
  else if(T === "flash"){
    bots.forEach(function(b){
      if(!b.alive) return;
      var d = Math.hypot(b.x-n.x, b.y-n.y);
      // видит ли разрыв: глаза → флешка (рвётся в воздухе, ~1 м над полом), дым закрывает
      if(d > 1000 || !visLine(b.x, b.y, visEyeZ(b), n.x, n.y, visFloorAt(n.x, n.y) + 40, true)) return;
      var a = Math.atan2(n.y-b.y, n.x-b.x);
      var off = b.facing === undefined ? 0 : Math.abs(((a - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
      var dirK = off < 0.55 ? 1 : (off < 1.6 ? 0.5 : 0.12);  // смотрел прямо / краем глаза / спиной
      var secs = BAL.flashMax * dirK * Math.max(0, 1 - d/1100);
      // свою флешку бросающий видит — слепит его слабо (своих — в полную силу: «флешу!» — решение тимспика)
      if(b === n.thrower) secs *= 0.05;
      if(secs > 0.35){
        b.blindUntil = Math.max(b.blindUntil, tick + Math.round(secs*TICK_HZ));
        if(n.thrower && n.thrower.team !== b.team) b._blindBy = n.thrower.id; // для киллфида: «+ ослепил»
        b.contactStreak = 0;
        if(secs > 1.2) logEvent(b.id+" ослеплён"+(b.team===n.team?" своей флешкой":"")+" ("+secs.toFixed(1)+"с)");
      }
    });
  }
  else if(T === "he"){
    smokes.forEach(function(sm){
      if(Math.hypot(sm.x-n.x, sm.y-n.y) < NADE.smoke.radius + 40){ sm.holeLen = Math.round(1.3*TICK_HZ); sm.holeUntil = tick + sm.holeLen;
        logEvent("HE разогнал смок "+calloutName(sm.x, sm.y)); }
    });
    bots.forEach(function(b){
      if(!b.alive || b.team === n.team) return;
      var d = Math.hypot(b.x-n.x, b.y-n.y);
      // осколки: от разрыва (у пола) до тела, без дыма
      if(d > NADE.he.radius || !visLine(n.x, n.y, visFloorAt(n.x, n.y) + 10, b.x, b.y, visFloorAt(b.x, b.y) + 36, false)) return;
      var dmg = Math.round(NADE.he.dmg * (1 - d/NADE.he.radius) * (b.armor ? 0.5 : 1));
      applyDamage(n.thrower, b, dmg, "HE");
    });
  }
  nadeFx.push({type:T, x:n.x, y:n.y, born:tick});
}
function applyDamage(att, b, dmg, src){
  if(!b.alive || dmg <= 0) return;
  noteDmg(att, b, dmg);
  b.hp -= dmg;
  if(b.hp <= 0){
    b.alive = false; b.deaths++;
    dropWeaponOnDeath(b);
    b.primary = null; b.secondary = b.team==="CT" ? "USP" : "GLOCK"; b.armor = false; b.helmet = false; b.kit = false;
    b.planting = false; b.defusing = false; b.nades = emptyNades();
    dropBomb(b);
    if(att && att.team !== b.team){ att.kills++; att.roundKills++; att.money = Math.min(MAX_MONEY, att.money + 300); }
    logEvent((att?att.id:"?")+" ["+src+"] устранил "+b.id, "kill");
    feedKill(att, b, src === "HE" ? "HE" : "MOLOTOV", false, {});
  }
}
function nadesTick(){
  var dt = 1/TICK_HZ;
  for(var i=nadesInAir.length-1;i>=0;i--){
    var n = nadesInAir[i];
    if(n.lob){
      var fk = Math.min(1, (tick - n.born)/n.flight);
      n.x = n.sx + (n.tx-n.sx)*fk; n.y = n.sy + (n.ty-n.sy)*fk;
      if(tick % 2 === 0){ n.trail.push([n.x, n.y]); if(n.trail.length > 14) n.trail.shift(); }
      if(fk >= 1){ nadesInAir.splice(i,1); detonate(n); }
      continue;
    }
    var nx = n.x + n.vx*dt, ny = n.y + n.vy*dt;
    var w = nadeWallHit(n.x, n.y, nx, ny);
    if(w){
      // отскок: отражаем скорость от линии стены, теряем половину энергии
      var ex = w[2]-w[0], ey = w[3]-w[1], L = Math.hypot(ex,ey)||1; ex/=L; ey/=L;
      var dot = n.vx*ex + n.vy*ey;
      var px = n.vx - dot*ex, py = n.vy - dot*ey; // нормальная составляющая
      n.vx = (dot*ex - px)*0.5; n.vy = (dot*ey - py)*0.5;
    } else { n.x = nx; n.y = ny; }
    n.vx *= 0.96; n.vy *= 0.96;
    if(tick % 2 === 0){ n.trail.push([n.x, n.y]); if(n.trail.length > 14) n.trail.shift(); }
    var sp = Math.hypot(n.vx, n.vy), age = tick - n.born;
    var def = NADE[n.type];
    var boom = (n.type === "smoke" && (sp < 30 || age > def.fuse)) ||
               (n.type === "molly" && (sp < 70 || age > def.fuse)) ||
               ((n.type === "flash" || n.type === "he") && age >= def.fuse);
    if(boom){ nadesInAir.splice(i,1); detonate(n); }
  }
  for(var s=smokes.length-1;s>=0;s--) if(tick >= smokes[s].until) smokes.splice(s,1);
  for(var f=fires.length-1;f>=0;f--){
    var fr = fires[f];
    if(tick >= fr.until){ fires.splice(f,1); continue; }
    // дым, раскрывшийся на огне, тушит его
    if(smokes.some(function(sm){ return Math.hypot(sm.x-fr.x, sm.y-fr.y) < smokeRadiusNow(sm)*0.8; })){ fires.splice(f,1); continue; }
    bots.forEach(function(b){
      if(!b.alive || b.team === fr.team) return;
      if(Math.hypot(b.x-fr.x, b.y-fr.y) < NADE.molly.radius){
        // Урон по времени (правка по фидбеку): если молотов упал ПОД тебя —
        // огонь только разгорается, урон растёт чем дольше стоишь (8 → 40/с
        // за ~2с), успеешь выбежать с малыми потерями. Если сам зашёл в уже
        // горящий — сразу максимальный урон, но пройти насквозь можно.
        if(!b._fireIn || b._fireIn.f !== fr){ b._fireIn = {f:fr, t:tick, landedOn: (tick - fr.born) < 16}; }
        var inside = (tick - b._fireIn.t)/TICK_HZ;
        var dps = b._fireIn.landedOn ? (8 + 32*Math.min(1, inside/2)) : NADE.molly.dps;
        b._fireAcc = (b._fireAcc||0) + dps/TICK_HZ;
        if(b._fireAcc >= 1){ var dd = Math.floor(b._fireAcc); b._fireAcc -= dd; applyDamage(fr.thrower, b, dd, "молотов"); }
      } else if(b._fireIn && b._fireIn.f === fr){ b._fireIn = null; }
    });
  }
  for(var x=nadeFx.length-1;x>=0;x--) if(tick - nadeFx[x].born > 40) nadeFx.splice(x,1);
}

function resetNades(){
  nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0; groundWeapons.length = 0;
  bots.forEach(function(b){ b.blindUntil = 0; b.throwUntil = 0; b._fireAcc = 0; b._fireIn = null; if(!b.nades) b.nades = emptyNades(); });
}
