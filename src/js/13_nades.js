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
  if(roundState === "live" && T !== "decoy" && n.thrower){
    makeSound(n.thrower, n.x, n.y, "pop", {info:{ntype:T}});
    knowNadePop(n);   // свои узнают о разрыве так, как игрок: сам бросил / увидел (09_knowledge.js)
  }
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
  bots.forEach(function(b){ b.blindUntil = 0; b.throwUntil = 0; b._nadeWait = 0; b._selfDone = null; b._fireAcc = 0; b._fireIn = null; if(!b.nades) b.nades = emptyNades(); });
}

// ======================= ГРАНАТЫ «СЕБЕ» (шаг 10) =======================
// Одно место решения «кинуть себе» — не шаг сценария (их кидает 12_script_runner.js), а
// решение игрока под свою ситуацию, только по тому, что он сам знает (b.know: гипотезы
// о врагах, в том числе из войса). Варианты — разметка демок про (tools/lineups.py, purpose):
//  • флешка под выход — идёт, впереди по пути угол, за которым по его знанию весомо стоит
//    враг (сейчас его не видно, а шагах через 250 px он окажется на линии): флешка между
//    точкой выхода и врагом, ждёт хлопка — выходит;
//  • молотов в угол — то же, но враг по гипотезе «держит» близкий к пути угол: молотов туда,
//    проходит мимо горения;
//  • смок под плант / под дефуз — носитель на сайте (дефузер у бомбы), а по его знанию
//    кто-то видит точку: смок на себя (на бомбу), ставит/дефузит в дыму.
// Без повода — ничего; уже закрыто своими (дым на линии, своя флешка/огонь там же) — тоже.
var SELF = {
  every:   8,    // как часто бот сверяется, тиков
  ahead:   250,  // флешка/молотов: через сколько px пути он выйдет на линию врага
  far:     700,  // и не дальше стольких px до врага по гипотезе
  cone:    75,   // и не шире стольких ° от направления хода
  cornerR: 160,  // молотов: «держит» не дальше стольких px от точки выхода
  spotNear: 350, // по типичному месту (без инфы) — только близкий выход: место не дальше стольких px от точки выхода
  sightR:  900,  // смок под плант/дефуз: гипотеза врага с линией на точку не дальше стольких px
  defuseR: 220,  // смок под дефуз — когда до бомбы не больше стольких px
  teamSec: 3     // своя граната того же типа там же (≤ 150 px) за столько с — уже закрыто
};
var SELF_LOG = [];
function selfHyps(b, fn){   // весомые гипотезы бота о невидимых врагах
  var K = b.know; if(!K) return;
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){ if(h.x !== undefined && h.weight >= POS.threatW) fn(h, id); });
  }
}
function selfTeamDone(b, type, x, y){
  if(type === "smoke") return false;
  if(type === "molly" && fires.some(function(f){ return f.team === b.team && Math.hypot(f.x-x, f.y-y) < 150; })) return true;
  return nadeFx.concat(nadesInAir).some(function(n){ return n.type === type && (n.team === b.team || n.thrower && n.thrower.team === b.team) &&
    Math.hypot(n.x-x, n.y-y) < 150 && tick - n.born < SELF.teamSec*TICK_HZ; });
}
function selfThrow(b, type, x, y, kind, why, waitT){
  if(selfTeamDone(b, type, x, y)) return false;
  if(selfLeft(b, type) <= 0 || !throwNade(b, type, x, y, type !== "smoke", "себе: " + why)) return false;
  b._selfN[type]--;   // смок — под ноги, не навесом
  var n = nadesInAir[nadesInAir.length-1];
  b._nadeWait = tick + (n && n.flight ? n.flight : 30) + waitT;   // стоит, пока своя граната не сработала (стрелять может)
  SELF_LOG.push({tick: tick, round: roundNum, who: b.id, kind: kind, x: Math.round(x), y: Math.round(y), why: why});
  return true;
}
// смок под плант / дефуз: точка p, кто-то по знанию бота её видит
function selfCoverSmoke(b, p, kind){
  if(selfLeft(b, "smoke") <= 0 || smokes.some(function(s){ return Math.hypot(s.x-p.x, s.y-p.y) < smokeRadiusNow(s); })) return false;
  var seen = null;
  selfHyps(b, function(h){
    var d = Math.hypot(h.x-p.x, h.y-p.y);
    if(d <= SELF.sightR && !seen && visLine(h.x, h.y, visFloorAt(h.x, h.y) + 64, p.x, p.y, visFloorAt(p.x, p.y) + 40, true)) seen = h;
  });
  if(!seen) return false;
  return selfThrow(b, "smoke", p.x, p.y, kind, (kind === "smoke_plant" ? "смок под плант" : "смок под дефуз") + " — точку видно с " + calloutName(seen.x, seen.y), 40);
}
// флешка / молотов под выход. Повод — весомая гипотеза врага (свежая инфа) или, если её нет,
// типичное место врага, которое бот ещё не видел пустым (knowSpotAhead — знание карты)
function selfExit(b){
  if(!(b.path.length && b.pathIdx < b.path.length) || b._goDir === undefined) return false;
  if(selfLeft(b, "flash") <= 0 && selfLeft(b, "molly") <= 0) return false;
  b._selfDone = b._selfDone || {};
  var cone = SELF.cone*Math.PI/180, cands = [];
  function ahead(x, y){
    var d = Math.hypot(x-b.x, y-b.y); if(d > SELF.far || d < 60) return false;
    var a = Math.atan2(y-b.y, x-b.x) - b._goDir; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= cone;
  }
  selfHyps(b, function(h, id){ if(ahead(h.x, h.y)) cands.push({x: h.x, y: h.y, w: h.weight, held: h.type === "held", key: id + ":" + h.zone, info: true}); });
  if(!cands.length && b.know && b.know.alive) (b.know.spots || []).forEach(function(p){
    if(p.open && knowSpotReach(p) && ahead(p.x, p.y)) cands.push({x: p.x, y: p.y, w: 0, held: false, key: "spot:" + p.id, info: false});
  });
  var best = null;
  cands.forEach(function(c){
    if(b._selfDone[c.key] || !crossesWall(b.x, b.y, c.x, c.y)) return;   // уже на линии — не выход, это бой/префайр
    // точка выхода: первая точка пути (в пределах SELF.ahead), откуда это место будет видно
    var px = b.x, py = b.y, run = 0, ex = null;
    for(var i = b.pathIdx; i < b.path.length && run <= SELF.ahead; i++){
      var q = b.path[i]; run += Math.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1];
      if(run <= SELF.ahead && !crossesWall(px, py, c.x, c.y)){ ex = {x: px, y: py}; break; }
    }
    if(!ex) return;
    // свой уже вышел туда первым — место смотрят его глаза, флешка ослепила бы его
    if(bots.some(function(m){ return m !== b && m.alive && m.team === b.team && Math.hypot(m.x-ex.x, m.y-ex.y) < 150; })) return;
    if(!c.info && Math.hypot(c.x-ex.x, c.y-ex.y) > SELF.spotNear) return;   // дальний угол без инфы — проверяют прицелом, не флешкой
    var d = Math.hypot(c.x-b.x, c.y-b.y);
    if(!best || c.w > best.c.w || (c.w === best.c.w && d < best.d)) best = {c: c, ex: ex, d: d};
  });
  if(!best) return false;
  var c = best.c, ex = best.ex, dE = Math.hypot(c.x-ex.x, c.y-ex.y);
  b._selfDone[c.key] = true;   // на одну ситуацию — одна граната
  var where = calloutName(c.x, c.y), src = c.info ? "по знанию " : "типичное место ";
  if(c.held && dE <= SELF.cornerR && selfLeft(b, "molly") > 0)
    return selfThrow(b, "molly", c.x, c.y, "molly_clear", "молотов в угол — держат " + where, 16);
  if(selfLeft(b, "flash") > 0){
    var k = Math.min(1, 140/Math.max(1, dE));   // хлопок за углом, со стороны врага от точки выхода
    return selfThrow(b, "flash", ex.x + (c.x-ex.x)*k, ex.y + (c.y-ex.y)*k, "flash_exit", "флешка под выход — " + src + where, 2);
  }
  return false;
}
// сколько гранат этого типа бот купил себе и ещё не кинул (сценарные — не его, их ждут шаги)
function selfLeft(b, type){ return Math.min(b.nades[type], (b._selfN && b._selfN[type]) || 0); }
function selfNadeTick(){
  if(roundState !== "live") return;
  if(tick === roundStartTick + 1 && roundNum === 1) SELF_LOG.length = 0;
  bots.forEach(function(b){
    if(!b.alive || !b.nades || b.planting || b.defusing || b._sawEnemy) return;
    if(tick < (b.throwUntil||0) || tick < (b._nadeWait||0)) return;
    if((tick + b.id.charCodeAt(b.id.length-1)) % SELF.every) return;
    if(b.team === "T" && bomb && bomb.state === "carried" && bomb.carrier === b && bombSiteAt(b.baseX, b.baseY)){
      if(selfCoverSmoke(b, {x: b.x, y: b.y}, "smoke_plant")) return;
    }
    if(b.team === "CT" && bomb && bomb.state === "planted" && b._rtLook && b._rtLook[0] === bomb.x && b._rtLook[1] === bomb.y &&
       Math.hypot(b.x-bomb.x, b.y-bomb.y) <= SELF.defuseR){
      if(selfCoverSmoke(b, {x: bomb.x, y: bomb.y}, "smoke_defuse")) return;
    }
    selfExit(b);
  });
}
