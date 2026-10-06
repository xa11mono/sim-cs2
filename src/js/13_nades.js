// ======================= ШАГ 5: гранаты (план §7) =======================
// Смок (перекрывает обзор), флешка (ослепляет тех, кто смотрит в её сторону),
// HE (урон), молотов/зажигалка (горящая зона, в неё не заходят, из неё бегут).
// Полёт — по прямой с затуханием скорости и отскоком от стен (стены у нас
// в полный рост, так что "перекинуть через стену" нельзя — бросают, когда
// точка видна). Покупаются по экономике, используются тактиками: T на выходе
// смокают вход CT и позицию опорника, энтри заходит под свою флешку, молотов
// выжигает опорника; CT молотовом/HE задерживают выход, флешкой заходят на
// ретейк; T на пост-планте кидают молотов на бомбу, когда CT дефузят.
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
bots.forEach(function(b){ b.nades = emptyNades(); b.nadeTask = null; b.blindUntil = 0; });

// ---------- закуп гранат (вызывается из buyForPlayer) ----------
var NADE_WISH = {
  // T: поддержка и IGL несут смоки, энтри — флешки, молотовы у IGL/энтри
  // (7) у T на фулле в среднем ~3 молотова на команду (выход, зачистка угла, пост-плант)
  entry:["flash","smoke","flash","molly"], awp:["smoke","flash","molly"], support:["smoke","flash","molly","he"], igl:["smoke","molly","flash"], lurker:["flash","smoke"],
  // CT: опорники — зажигалка + смок, ротатор/мидер — смок+флешка, роумер — флешка
  anchorA:["molly","smoke","he"], anchorB:["molly","smoke","he"], rotator:["smoke","flash"], mid:["flash","smoke"], roamer:["flash","he"]
};
function nadePrice(type, team){ return (type === "molly" && team === "CT") ? NADE.molly.priceCT : NADE[type].price; }
function buyNades(b, type){
  var wish = NADE_WISH[b.tRole] || [];
  var budget = type === "full" ? 99 : (type === "force" || type === "half" ? 2 : 0);
  if(type === "pistol" || type === "eco") budget = 1;
  var keepEco = (type === "eco") ? fullNeed(b) - nextLossIncome(b.team) : -1e9;
  var bought = 0;
  for(var i=0;i<wish.length && bought<budget;i++){
    var t = wish[i], pr = nadePrice(t, b.team);
    var total = b.nades.smoke + b.nades.flash + b.nades.he + b.nades.molly;
    if(total >= 4) break;
    if(t === "flash" ? b.nades.flash >= 2 : b.nades[t] >= 1){ continue; }
    // на хаф/форсе — только если после этого остаётся запас
    if(type !== "full" && b.money - pr < 200 && !(type === "pistol" && b.money >= pr)) continue;
    if((type === "eco" || type === "pistol") && t === "molly") continue;
    if(type === "eco" && b.money - pr < keepEco) continue;
    if(b.money < pr) continue;
    b.money -= pr; b.nades[t]++; bought++;
  }
}

// ---------- дым перекрывает обзор ----------
function segHitsCircle(x1,y1,x2,y2,cx,cy,r){
  var dx=x2-x1, dy=y2-y1, L2=dx*dx+dy*dy;
  var t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((cx-x1)*dx+(cy-y1)*dy)/L2));
  var px = x1+t*dx - cx, py = y1+t*dy - cy;
  return px*px+py*py < r*r;
}
function smokeBlocks(x1,y1,x2,y2){
  for(var i=0;i<smokes.length;i++){
    var s = smokes[i], r = smokeRadiusNow(s);
    if(r > 8 && segHitsCircle(x1,y1,x2,y2,s.x,s.y,r)) return true;
  }
  return false;
}
function smokeRadiusNow(s){
  var age = tick - s.born, left = s.until - tick;
  var grow = Math.min(1, age/40), fade = Math.min(1, left/64); // раскрывается ~0.6с, в конце рассеивается
  // HE в дыму: на ~1.3с дым разлетается (дыра), потом снова затягивается
  var hole = 1;
  if(s.holeUntil && tick < s.holeUntil){ var hp = (s.holeUntil - tick)/s.holeLen; hole = 0.3 + 0.7*(1 - Math.min(1, hp*1.4)); }
  return NADE.smoke.radius * grow * (0.4 + 0.6*fade) * hole;
}
function hasVision(x1,y1,x2,y2){ return hasLOS(x1,y1,x2,y2) && !smokeBlocks(x1,y1,x2,y2); }
// видит ли v цель t сквозь дым "ван-веем": v в самом краю дыма (глубина ≤30%
// радиуса) и смотрит НАРУЖУ — видит; снаружи в дым видно только того, кто
// стоит на самой кромке (≤8%). Любой другой дым на линии — закрывает.
function oneWaySees(v, t){
  var ok = true, any = false;
  for(var i=0;i<smokes.length;i++){
    var s = smokes[i], r = smokeRadiusNow(s);
    if(r <= 8 || !segHitsCircle(v.x, v.y, t.x, t.y, s.x, s.y, r)) continue;
    any = true;
    var dv = Math.hypot(v.x-s.x, v.y-s.y), dt = Math.hypot(t.x-s.x, t.y-s.y);
    if(dv < r && dt >= r){
      var depth = (r - dv)/r;
      var ox = v.x-s.x, oy = v.y-s.y, lx = t.x-v.x, ly = t.y-v.y;
      var cosA = (ox*lx + oy*ly)/Math.max(1, Math.hypot(ox, oy)*Math.hypot(lx, ly));
      if(!(depth <= 0.3 && cosA > 0.34)) ok = false;
    } else if(dv >= r && dt < r){
      if((r - dt)/r > 0.08) ok = false;       // цель в дыму глубже кромки — снаружи не видно
    } else ok = false;
  }
  return any && ok;
}
// Молотов — не стена: через горящий огонь МОЖНО пройти, но это стоит HP
// (зашёл в уже горящий — сразу максимальный урон). Поэтому заходят в огонь
// только когда есть ради чего (дефуз/плант/ретейк/сбить дефуз) и HP хватает
// с запасом на проход; иначе ждут у края или обходят.
function fireCommit(b){
  if(!b || b.hp < 55) return false;
  if(b.defusing || b.planting) return true;
  if(b.team === "T" && tick - (b._defuseHeard||-9999) < 110) return true;
  if(b.post && /^(defuse|plantspot|retake)$/.test(b.post.tag)) return true;
  if(bomb && bomb.retake && bomb.retake.phase === "go" && b.team === "CT") return true;
  return false;
}
function stepBlocked(x1,y1,x2,y2,b){
  if(crossesWall(x1,y1,x2,y2)) return true;
  if(!inFire(x1,y1) && inFire(x2,y2)) return !fireCommit(b);
  return false;
}
// точка поста в огне → ждём у края огня (с той же стороны), а не лезем внутрь
function fireSafe(p, b){
  if(b && fireCommit(b)) return p; // идёт по делу — через огонь
  var f = inFire(p.x, p.y); if(!f) return p;
  var a = Math.atan2(p.y-f.y, p.x-f.x); if(!isFinite(a)) a = 0;
  var r = NADE.molly.radius + 26;
  var q = {x:f.x + Math.cos(a)*r, y:f.y + Math.sin(a)*r};
  if(insideSolidWall(q.x, q.y) || segCrossesManualWalls(f.x, f.y, q.x, q.y)){ q = {x:f.x - Math.cos(a)*r, y:f.y - Math.sin(a)*r}; }
  return q;
}
function inFire(x, y){
  for(var i=0;i<fires.length;i++){ if(Math.hypot(x-fires[i].x, y-fires[i].y) < NADE.molly.radius) return fires[i]; }
  return null;
}

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
    var leMul = 1;

    var le = BAL.lobErr * leMul * hashRand(tick*71 + b.id.charCodeAt(0)*5), la2 = hashRand(tick*13 + b.id.length*97)*Math.PI*2;
    nd.lob = true; nd.sx = b.x; nd.sy = b.y; nd.tx = tx + Math.cos(la2)*le; nd.ty = ty + Math.sin(la2)*le; nd.flight = Math.max(30, Math.round(d/650*TICK_HZ));
  }
  // кто может увернуться от этой флешки: видел бросающего или был рядом (слышит чеку)
  if(type === "flash" && BAL.flashAware){
    nd.aware = {};
    bots.forEach(function(o){ if(o.alive && o.team !== b.team && (Math.hypot(o.x-b.x, o.y-b.y) < 450 || hasVision(o.x, o.y, b.x, b.y))) nd.aware[o.id] = true; });
  }
  nadesInAir.push(nd);
  b.throwUntil = tick + 18; // ~0.3с стоит на броске
  b.facing = a;
  logEvent(b.id+" кинул "+NADE[type].name+(why ? " — "+why : "")+(lob ? " (лайнап)" : ""));
  // раздел 11.1: бросок гранаты — тоже источник инфы о враге, не только выстрел/
  // шаги. Кто видел бросок — фиксирует позицию бросавшего как обычный "вижу"
  // (на миг открылся); кто не видел, но был достаточно близко — слышит
  // ЧЕКУ/бросок и понимает направление и примерную дистанцию, откуда кинули,
  // даже без визуального контакта.
  if(typeof teamIntel !== "undefined"){
    var enemyTeam = b.team === "CT" ? "T" : "CT";
    bots.forEach(function(o){
      if(!o.alive || o.team !== enemyTeam) return;
      var dd = Math.hypot(o.x-b.x, o.y-b.y);
      if(hasVision(o.x, o.y, b.x, b.y)){
        intelPush(enemyTeam, {type:"spotted", x:b.x, y:b.y, id:b.id, by:o.id, conf:1});
        o.lastIntel = {x:b.x, y:b.y, tick:tick};
      } else if(dd <= NADE_HEAR_R){
        intelPush(enemyTeam, {type:"sound", x:b.x, y:b.y, id:b.id, by:o.id, conf:0.5, kind:"nade"});
        o.heardSound = {x:b.x, y:b.y, tick:tick, team:b.team, src:b.id, kind:"nade"};
      }
    });
  }
  return true;
}
function smokeCovered(x, y){
  // план §7: "два бота не кидают смок в одну точку, пока один ещё не рассеялся"
  if(smokes.some(function(s){ return Math.hypot(s.x-x, s.y-y) < 60 && s.until - tick > 64; })) return true;
  return nadesInAir.some(function(n){ return n.type === "smoke" && Math.hypot((n.tx||n.x)-x, (n.ty||n.y)-y) < 60; });
}
function assignNade(b, type, target, why, opts){
  if(!b || !b.alive || !b.nades || b.nades[type] <= 0) return false;
  if(opts && opts.bkey && !builtinAllowed(opts.bkey)) return false; // встроенная выключена или заменена своим лайнапом
  if(b.nadeTask && (b.nadeTask.type === type || b.nadeTask.lineup)) return false; // свой лайнап не перебиваем
  if(type === "smoke" && smokeCovered(target.x, target.y)) return false;
  // одна граната одного типа в одну точку: другие механики (комбо, флешка
  // себе, дамп…) не дублируют уже летящую/назначенную туда же
  if(BAL.nadeDedup && type !== "smoke" && (nadesInAir.some(function(n){ return n.team === b.team && n.type === type && Math.hypot((n.tx||n.x)-target.x, (n.ty||n.y)-target.y) < 120; }) ||
     bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.nadeTask && o.nadeTask.type === type && Math.hypot(o.nadeTask.x-target.x, o.nadeTask.y-target.y) < 120; }))) return false;
  b.nadeTask = {type:type, x:target.x, y:target.y, until: tick + ((opts && opts.sec) || 10)*TICK_HZ, why:why||"", start:tick, lob:true, range:(opts && opts.range) || NADE_THROW_RANGE, now:!!(opts && opts.now)};
  if(opts && opts.from){ b.nadeTask.from = {x:opts.from.x, y:opts.from.y}; b.nadeTask.lineup = true; }
  return true;
}
// (Г1) флешка не летит в лицо врагу, с которым уже контакт: по картине команды
// враг виден прямо сейчас (≤0,5 с) в 400 px от точки хлопка — он смотрит в нашу
// сторону и стреляет, флешка его не ослепит, а своих — может. Флешка — до пика.
function flashIntoFight(b, t){
  return picRecent(b.team, TICK_HZ/2).some(function(q){ return q.src === "spotted" && Math.hypot(q.x-t.x, q.y-t.y) < 400; });
}
// задание на гранату выполняется, как только точка видна и в пределах броска
function updateNadeTasks(){
  bots.forEach(function(b){
    var t = b.nadeTask; if(!t) return;
    if(!b.alive || tick > t.until || !b.nades || b.nades[t.type] <= 0){
      b.nadeTask = null;
      // задание сгорело, а пост "лайнап" остался — снять, иначе стоит на точке броска весь раунд
      if(b.post && b.post.tag === "lineup"){ dropTask(b, "lineup"); clearPost(b); }
      return; }
    if(b.planting || b.defusing) return;
    var d = Math.hypot(t.x-b.x, t.y-b.y);
    if((t.type === "smoke" && smokeCovered(t.x, t.y)) || (t.type === "flash" && flashIntoFight(b, t))){
      if(t.type === "flash") logEvent(b.id+": флешку «"+t.why+"» не кидает — там уже стреляют");
      b.nadeTask = null; if(b.post && b.post.tag === "lineup"){ dropTask(b, "lineup"); clearPost(b); } return; }
    if(t.from){ // свой лайнап: сначала встать ровно в точку броска
      // раньше кидал только ближе 22px к точке, а "дошёл до поста" считается
      // уже с 34px — бот вставал в 23–34px и стоял до конца задания, не кидая
      if(Math.hypot(t.from.x-b.baseX, t.from.y-b.baseY) > 36 && !(b.atPost && b.post && b.post.tag === "lineup")){ if(b.state === "patrol"){ setPost(b, t.from, {x:t.x, y:t.y}, true, "lineup"); holdTask(b, "lineup", tick+1); } return; }
      dropTask(b, "lineup"); throwNade(b, t.type, t.x, t.y, true, t.why); b.nadeTask = null; if(b.post && b.post.tag === "lineup") clearPost(b); return;
    }
    if(d <= t.range && hasLOS(b.x, b.y, t.x, t.y)){
      throwNade(b, t.type, t.x, t.y, false, t.why); b.nadeTask = null;
    } else if(t.lob && d <= t.range*0.85 && (t.now || tick - t.start > 64)){
      // "лайнап": граната навесом через постройку (поп-флешка, смок, молотов) — точки не видно, но
      // бросок заученный; прилетает точно в цель, стены по пути не мешают
      throwNade(b, t.type, t.x, t.y, true, t.why); b.nadeTask = null;
    }
  });
}

// ======================= СВОИ ЛАЙНАПЫ =======================
var LINEUPS_BAKED = @@DATA:lineups_own.json@@; // из «Экспорт проекта» (зашиты в код)
var LINEUPS_KEY = "ancient-live-radar-lineups-v1";
var USER_LINEUPS = [];
try{ var _lu = JSON.parse(localStorage.getItem(LINEUPS_KEY)||"null"); if(Array.isArray(_lu)) USER_LINEUPS = _lu; }catch(e){}
function saveLineups(){ try{ localStorage.setItem(LINEUPS_KEY, JSON.stringify(USER_LINEUPS)); localStorage.setItem(BUILTIN_OFF_KEY, JSON.stringify(BUILTIN_OFF)); }catch(e){} }
// встроенные гранаты: выключенные и заменённые своими (replaces: ключ встроенной)
var BUILTIN_OFF_BAKED = {}, BUILTIN_OFF_KEY = "ancient-live-radar-builtin-off-v1", BUILTIN_OFF = {};
(function(){ for(var k in BUILTIN_OFF_BAKED) BUILTIN_OFF[k] = BUILTIN_OFF_BAKED[k]; try{ var o = JSON.parse(localStorage.getItem(BUILTIN_OFF_KEY)||"null"); if(o) for(var k2 in o) BUILTIN_OFF[k2] = o[k2]; }catch(e){} })();
function builtinAllowed(key){
  if(BUILTIN_OFF[key]) return false;
  if(proCovers(key)) return false;
  return !allLineups().some(function(L){ return L.replaces === key; }); // заменена своим лайнапом
}
function allLineups(){ var L = LINEUPS_BAKED.concat(USER_LINEUPS); return L.concat(proLineups()); }
var LU_TRIG = {insta:"инста", setup:"сетап T", exec:"выход T", postplant:"пост-плант", call:"колл CT", retake:"ретейк"};
var LU_TYPE = {smoke:"смок", flash:"флешка", molly:"молотов", he:"HE"};
// (14) гранаты выхода раньше: смоки/молотов летят за ~4с до выхода (пока
// группа стоит на точках), а не в момент выхода — раньше энтри уже пикал,
// а смок ещё летел или его вообще не успевали кинуть
// смоки на выход — неприкосновенный запас: проба/фейк не тратят последние два
function tSmokeReserveOk(){
  var n = 0; bots.forEach(function(b){ if(b.alive && b.team === "T" && b.tRole !== "lurker" && b.nades) n += b.nades.smoke; });
  return n - 1 >= 2;
}
function preExecNow(tt){
  if(!tt || tt.phase !== "setup" || !tt.execTick || tt.rebound && tick - (tt._rbT||0) < 2*TICK_HZ) return false;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  return tick >= tt.execTick - 4*TICK_HZ && secLeft > 30 && !(tt.tac && (tt.tac.style === "rush" || tt.tac.style === "fake"));
}
function tExecNadesFlying(){
  return nadesInAir.some(function(n){ return n.team === "T" && (n.type === "smoke" || n.type === "molly"); }) ||
    bots.some(function(b){ return b.alive && b.team === "T" && b.nadeTask && (b.nadeTask.type === "smoke") && b.nadeTask.exec; });
}
function lineupTick(){
  if(roundState !== "live" || !teamTac.T) return;
  var tt = teamTac.T, ct = teamTac.CT, since = tick - roundStartTick;
  allLineups().forEach(function(L){
    var key = "lu"+L.id; if(nadeFlags[key]) return;
    // (v150) про-лайнап: в этом раунде кидается с вероятностью, как у про
    if(L.pro && nadeFlags["pr"+L.id] === undefined){
      var hid = 0; for(var hi=0; hi<L.id.length; hi++) hid = hid*31 + L.id.charCodeAt(hi);
      nadeFlags["pr"+L.id] = hashRand(roundNum*7919 + matchNum*104729 + hid) < L.prob;
    }
    if(L.pro && !nadeFlags["pr"+L.id]){ nadeFlags[key] = true; return; }
    var siteOk = function(k){ return L.site === "any" || L.site === k; };
    var go = false;
    if(L.trigger === "insta") go = since > TICK_HZ;
    else if(L.trigger === "timed") go = bomb.state !== "planted" && since >= (L.at||0)*TICK_HZ && since < ((L.at||0)+12)*TICK_HZ;
    else if(L.pro && L.team === "T" && L.trigger === "setup") go = tt.phase === "setup" && since >= Math.max(1, (L.at||12)-1)*TICK_HZ && siteOk(tt.site);
    else if(L.team === "T" && L.trigger === "setup") go = tt.phase === "setup" && since > 12*TICK_HZ && siteOk(tt.site);
    else if(L.team === "T" && L.trigger === "exec") go = (tt.phase === "execute" || preExecNow(tt)) && siteOk(tt.site);
    else if(L.team === "T" && L.trigger === "postplant") go = bomb.state === "planted" && siteOk(bomb.site);
    else if(L.team === "CT" && L.trigger === "call") go = ct && ct.call && ct.call.count >= 2 && siteOk(ct.call.site);
    else if(L.team === "CT" && L.trigger === "retake") go = bomb.state === "planted" && siteOk(bomb.site);
    if(!go) return;
    // кто кидает: ближайший к точке броска, но не энтри (он заходит первым) и не
    // носитель бомбы; в горячих фазах (выход, колл, ретейк, пост-плант) — только
    // тот, кому до точки броска недалеко, иначе он бросит свою задачу и уйдёт назад
    var hot = L.trigger !== "insta" && L.trigger !== "setup";
    var maxD = hot ? (BAL.nadeReach ? 650 : 480) : 1600;
    // (v150) про-лайнапы кидает тот, кто и так рядом: сетап — в пределах ~7 м,
    // "по времени" — ~4 м (не бросать позицию ради гранаты)
    if(L.pro && L.trigger === "setup") maxD = BAL.nadeReach ? 1100 : 700;
    if(L.pro && L.trigger === "timed"){ maxD = BAL.nadeReach ? 850 : 400; hot = true; }
    var cost = function(b){ return Math.hypot(b.x-L.from.x, b.y-L.from.y) + (b.tRole === "entry" ? 300 : 0); };
    var cand = bots.filter(function(b){ return b.team === L.team && b.alive && b.nades && b.nades[L.type] > 0 && !b.nadeTask &&
      !b.planting && !b.defusing && !(bomb.state === "carried" && bomb.carrier === b) && Math.hypot(b.x-L.from.x, b.y-L.from.y) < maxD; })
      .sort(function(a, b2){ return cost(a) - cost(b2); })[0];
    // раньше флаг "готово" ставился ДО проверки кандидата — если в момент
    // срабатывания триггера рядом с точкой броска никого не было, лайнап
    // считался выполненным навсегда и боец, который должен был его кинуть,
    // просто стоял без дела весь раунд. Теперь пробуем каждый тик, пока не
    // найдётся боец в радиусе, или пока не истечёт время триггера (~10с для
    // горячих фаз, иначе до конца раунда для сетапа/инсты)
    if(!cand){
      if(!hot || since - (nadeFlags["_lu0"+L.id] || since) < 10*TICK_HZ){
        if(nadeFlags["_lu0"+L.id] === undefined) nadeFlags["_lu0"+L.id] = since;
        return;
      }
      nadeFlags[key] = true; return; // так и не нашли, кто бросит — сдаёмся
    }
    nadeFlags[key] = true;
    if(!assignNade(cand, L.type, L.to, "лайнап «"+(L.name||LU_TYPE[L.type])+"»", {from:L.from, now:true, range:4000, sec: hot ? ((BAL.nadeReach && L.trigger === "timed") ? 12 : 7) : 20})) return;
    logEvent(cand.id+": идёт на лайнап «"+(L.name||LU_TYPE[L.type])+"»");
  });
}
// ---------- физика полёта и срабатывание ----------
function nadeWallHit(x1,y1,x2,y2){
  for(var i=0;i<MANUAL_WALLS.length;i++){
    var s = MANUAL_WALLS[i];
    if(segIntersect(x1,y1,x2,y2,s[0],s[1],s[2],s[3])) return s;
  }
  return null;
}
function detonate(n){
  var T = n.type;
  // (11) гранаты видно/слышно: где разорвалась граната врага — это инфа о его плане
  if(BAL.tacRead && roundState === "live" && T !== "decoy"){ var foeT = n.team === "T" ? "CT" : "T"; var NS = teamIntel[foeT].nadeSeen || (teamIntel[foeT].nadeSeen = []); NS.push({x:n.x, y:n.y, type:T, tick:tick}); if(NS.length > 30) NS.shift(); }
  if(T === "smoke"){ smokes.push({x:n.x, y:n.y, born:tick, until:tick+NADE.smoke.life, team:n.team}); if(BAL.smokeReact) smokeShiftOnDetonate(smokes[smokes.length-1]); }
  else if(T === "molly"){
    // молотов, упавший в дым, гаснет (как в CS2 — наоборот тоже: дым тушит огонь)
    if(!smokes.some(function(s){ return Math.hypot(s.x-n.x, s.y-n.y) < smokeRadiusNow(s); }))
      fires.push({x:n.x, y:n.y, born:tick, until:tick+NADE.molly.life, team:n.team, thrower:n.thrower});
  }
  else if(T === "flash"){
    if(n.why === "под пик") nadeFlags.peekFlashPop = tick;
    nadeFlags["pop:"+n.why] = tick; // общий "хлопнула" для ожидающих (ретейк, поп на убийцу)
    bots.forEach(function(b){
      if(!b.alive) return;
      var d = Math.hypot(b.x-n.x, b.y-n.y);
      if(d > 1000 || !hasVision(b.x, b.y, n.x, n.y)) return;
      var a = Math.atan2(n.y-b.y, n.x-b.x);
      var off = b.facing === undefined ? 0 : Math.abs(((a - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
      var dirK = off < 0.55 ? 1 : (off < 1.6 ? 0.5 : 0.12);  // смотрел прямо / краем глаза / спиной
      // враг, который видел/слышал летящую флешку, может успеть отвернуться —
      // тем вероятнее, чем выше навык (раньше флешка слепила "по учебнику" всегда)
      if(b.team !== n.team){
        // увернуться можно, только если знал о флешке (видел/слышал бросок);
        // поп-флешка из-за стены почти всегда застаёт врасплох
        var pD = BAL.flashAware ? ((n.aware && n.aware[b.id]) ? 0.65 + 0.1*(b.skill-0.8)/0.4 : 0.3) : 0.25 + 0.3*(b.skill-0.8)/0.4;
        var dodge = hashRand(tick*29 + b.id.charCodeAt(0)*13 + b.id.length*7) < pD;
        if(dodge){ dirK *= 0.3; if(BAL.flashAware && dirK > 0.1) logEvent(b.id+" отвернулся от флешки"); }
      }
      var secs = BAL.flashMax * dirK * Math.max(0, 1 - d/1100);
      // свои знают про флешку (колл "флешу!") и отворачиваются — слепит их редко и слабо
      if(b.team === n.team) secs *= (b === n.thrower ? 0.05 : 0.18);
      if(secs > 0.35){
        var lkBefore = b.lastIntel || (b._nearestEnemyBot ? {x:b._nearestEnemyBot.x, y:b._nearestEnemyBot.y, tick:tick} : null);
        b.blindUntil = Math.max(b.blindUntil, tick + Math.round(secs*TICK_HZ));
        if(n.thrower && n.thrower.team !== b.team) b._blindBy = n.thrower.id; // для киллфида: «+ ослепил»
        b.contactStreak = 0; b.lastIntel = null;
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
      if(!b.alive || b.team === n.team) return;
      var d = Math.hypot(b.x-n.x, b.y-n.y);
      if(d > NADE.he.radius || !hasLOS(n.x, n.y, b.x, b.y)) return;
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
    b.planting = false; b.defusing = false; b.nades = emptyNades(); b.nadeTask = null;
    dropBomb(b);
    intelDeath(b, att);
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

// ---------- тактическое использование ----------
var nadeFlags = {};
var comboCd = {}; // раздел 11.1: кулдаун комбо-гранаты на конкретного замеченного врага
function antiEco(team){
  var me = teamEco[team], en = teamEco[team === "CT" ? "T" : "CT"];
  if(BAL.buyRead){
    // не "знаем" чужой закуп, а читаем: по оружию, которое реально увидели
    // (первые контакты), иначе — по оценке денег до раунда
    var R = teamIntel[team] && teamIntel[team].buy;
    var enEco = R && R.n >= 1 ? R.read === "eco" : !!(me && me.enemyGuess && me.enemyGuess.eco);
    return !!(me && (me.roundType === "full" || me.roundType === "half") && enEco);
  }
  return me && en && (me.roundType === "full" || me.roundType === "half") && en.roundType === "eco";
}
// (13) инфа о закупе врага по первым контактам: увидели — запомнили, с чем он.
// Двое+ с пистолетами → эко; хоть одна винтовка/AWP → закуп (эко-оценка снимается)
function buyReadSee(team, eid){
  var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive) return;
  var TI = teamIntel[team], R = TI.buy || (TI.buy = {seen:{}, n:0, pistols:0, rifles:0, smg:0, read:null});
  if(R.seen[eid]) return;
  var k = e.primary || null, W = k && WEAPONS[k];
  R.seen[eid] = k || "pistol"; R.n++;
  if(!W) R.pistols++; else if(W.price >= 2000) R.rifles++; else R.smg++;
  var prev = R.read;
  if(R.rifles >= 1 || (R.smg + R.rifles >= 2)) R.read = "buy";
  else if(R.pistols >= 2) R.read = "eco";
  else if(R.pistols >= 1 && R.n === 1) R.read = R.read || null;
  if(R.read && R.read !== prev && team === "CT" && teamTac.CT){ var myT = teamEco.CT && teamEco.CT.roundType; teamTac.CT.antiEco = R.read === "eco" && (myT === "full" || myT === "force" || myT === "half"); }
  if(R.read && R.read !== prev){
    var mate = bots.filter(function(o){ return o.team === team && o.alive; })[0];
    if(mate) voiceLog(team, "buy"+R.read, mate.id, R.read === "eco" ? "у них пистолеты ("+R.pistols+" видели) — эко, не лезем в упор, держим дистанцию"
      : "у "+eid+" "+(W ? W.name : "оружие")+" — это закуп, не эко");
    logEvent(team+": закуп врага по контактам — "+(R.read === "eco" ? "эко" : "закуп")+" (видели: "+R.n+", винтовок "+R.rifles+", пистолетов "+R.pistols+")");
  }
}
function nadeCombos(){
  ["CT","T"].forEach(function(team){
    if(typeof teamIntel === "undefined") return;
    var mine = bots.filter(function(b){ return b.team===team && b.alive; });
    if(mine.length < 2) return;
    if(antiEco(team)) return; // против эко комбо-гранаты не тратим
    var seen = {};
    // только очень свежий контакт (≤20 тиков, видели) — комбо не по старой памяти
    picRecent(team, 20).forEach(function(q){ if(q.src === "spotted") seen[q.id] = q; });
    Object.keys(seen).forEach(function(eid){
      var key = team+":"+eid;
      if(tick < (comboCd[key]||0)) return;
      var s = seen[eid];
      if(fires.some(function(f){ return Math.hypot(f.x-s.x, f.y-s.y) < 100; })) return;
      var cands = mine.filter(function(b){
        var dd = Math.hypot(b.x-s.x, b.y-s.y);
        return !b.nadeTask && !b.planting && !b.defusing && !b._sawEnemy &&
               dd >= 140 && dd <= NADE_THROW_RANGE && // не кидать себе под ноги в упор
               (b.nades.molly>0 || b.nades.he>0 || b.nades.flash>0);
      });
      if(mine.some(function(o){ return o.alive && !cands.includes(o) && Math.hypot(o.x-s.x, o.y-s.y) < 130; })) return;
      if(cands.length < 2) return;
      cands.sort(function(a,b2){ return Math.hypot(a.x-s.x,a.y-s.y) - Math.hypot(b2.x-s.x,b2.y-s.y); });
      var order = ["molly","he","flash"], typesUsed = {}, thrown = 0;
      for(var ci=0; ci<cands.length && thrown<2; ci++){
        var b = cands[ci];
        var t = order.filter(function(tp){ return b.nades[tp]>0 && !typesUsed[tp]; })[0];
        if(!t) continue;
        assignNade(b, t, {x:s.x, y:s.y}, "комбо по "+eid, {now:true});
        typesUsed[t] = true; thrown++;
      }
      if(thrown >= 2){
        comboCd[key] = tick + 16*TICK_HZ;
        logEvent(team+" комбо-граната по "+eid+": "+Object.keys(typesUsed).join("+"));
      }
    });
  });
}
// ---- гранаты по ситуации (не по сценарию) ----
//  • молотов на раш: CT слышит 2+ бегущих T у входа на свой сайт — молотов во
//    вход, пока они не зашли (раз за раунд на сайт);
//  • HE в стак: двое+ врагов видели/слышали почти в одной точке (≤160px) —
//    HE туда, если рядом нет своих;
//  • флешка себе под пик: идёт один на угол, за которым свежая инфа о враге
//    (≤5с) — кидает флешку через угол и выходит на хлопок.
// ---- граната по свежему врагу: одна реакция, тип и цель по ситуации ----
//  • мало HP (≤25) и враг рядом — выкинуть оставшиеся гранаты в него, пока жив;
//  • раненый (≤28) за укрытием — HE добить;
//  • двое почти в одной точке — HE в стак (раз в 10 с на команду);
//  • сам видел врага, он ушёл за укрытие (0,4–2,5 с назад) — молотов/HE выкурить.
// Не туда, где рядом свои; заказ — через общую дверь.
var nadeReactCd = {CT:0, T:0};
function nadeOnEnemy(){
  var alive = function(id){ return bots.some(function(o){ return o.id === id && o.alive; }); };
  var mateNear = function(team, p, r, ex){ return bots.some(function(o){ return o !== ex && o.alive && o.team === team && Math.hypot(o.x-p.x, o.y-p.y) < r; }); };
  var free = function(b){ return b.alive && b.nades && !b.nadeTask && !b.planting && !b.defusing; };
  var picks = []; // [бот, тип, цель, почему, ключ голоса, фраза, после]
  ["CT","T"].forEach(function(team){
    var BL = beliefLast[team] || {}, fresh = [];
    for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick <= 3*TICK_HZ && alive(eid)) fresh.push({id:eid, x:lo.x, y:lo.y}); }
    var mine = bots.filter(function(b){ return b.team === team && free(b); });
    if(BAL.utilDump) mine.forEach(function(b){
      if(b.hp > 25 || tick < (b._dumpCd||0)) return;
      var tp = b.nades.molly > 0 ? "molly" : b.nades.he > 0 ? "he" : b.nades.flash > 0 ? "flash" : null; if(!tp) return;
      var tg = null, bd = Infinity;
      fresh.forEach(function(q){ var dd = Math.hypot(q.x-b.x, q.y-b.y); if(dd > 140 && dd < NADE_THROW_RANGE && dd < bd){ bd = dd; tg = q; } });
      if(!tg || mateNear(team, tg, 150, b)) return;
      b._dumpCd = tick + 3*TICK_HZ;
      picks.push([b, tp, tg, "у меня "+b.hp+" — кидаю всё", b._dumpVoice ? null : "dump"+b.id, "у меня "+b.hp+" — выкидываю гранаты", function(){ b._dumpVoice = roundNum; }]);
    });
    var HT = BAL.heFinish && teamIntel[team].hurt;
    if(HT) fresh.forEach(function(q){ var h = HT[q.id];
      if(!h || h.hp > 28 || tick - h.tick > 8*TICK_HZ || h._heDone || mateNear(team, q, 170)) return;
      var th = mine.filter(function(b){ var dd = Math.hypot(b.x-q.x, b.y-q.y); return b.nades.he > 0 && !b._sawEnemy && dd > 150 && dd < NADE_THROW_RANGE && !hasLOS(b.x, b.y, q.x, q.y); })[0];
      if(th) picks.push([th, "he", q, "HE добить "+q.id, "hefin"+q.id, q.id+" на "+h.hp+" за углом — HE", function(){ h._heDone = true; }]);
    });
    if(tick >= nadeReactCd[team]) for(var i=0;i<fresh.length;i++) for(var j=i+1;j<fresh.length;j++){
      if(Math.hypot(fresh[i].x-fresh[j].x, fresh[i].y-fresh[j].y) > 160) continue;
      var tg = {x:(fresh[i].x+fresh[j].x)/2, y:(fresh[i].y+fresh[j].y)/2};
      if(mateNear(team, tg, 170)) continue;
      var th = mine.filter(function(b){ var dd = Math.hypot(b.x-tg.x, b.y-tg.y); return b.nades.he > 0 && !b._sawEnemy && dd > 250 && dd < NADE_THROW_RANGE; })
        .sort(function(a, c){ return Math.hypot(a.x-tg.x, a.y-tg.y) - Math.hypot(c.x-tg.x, c.y-tg.y); })[0];
      if(th){ picks.push([th, "he", tg, "HE в стак", "hestack"+tick, "их двое "+calloutName(tg.x, tg.y)+" — кидаю HE", function(){ nadeReactCd[team] = tick + 10*TICK_HZ; }]); i = fresh.length; break; }
    }
    mine.forEach(function(b){
      if(b._sawEnemy || tick < (b._nadeCd||0) || !b.lastIntel) return;
      var age = tick - b.lastIntel.tick; if(age < 26 || age > 160) return;
      var tp = b.nades.molly > 0 ? "molly" : (b.nades.he > 0 ? "he" : null); if(!tp) return;
      var L = b.lastIntel, dd = Math.hypot(L.x-b.x, L.y-b.y);
      if(dd > NADE_THROW_RANGE || dd < 120 || fires.some(function(f){ return Math.hypot(f.x-L.x, f.y-L.y) < 100; }) || mateNear(team, L, 130)) return;
      b._nadeCd = tick + 8*TICK_HZ;
      picks.push([b, tp, {x:L.x, y:L.y}, "по инфе — выкурить", null, null, null]);
    });
  });
  picks.forEach(function(P){
    if(P[0].nadeTask || !assignNade(P[0], P[1], {x:P[2].x, y:P[2].y}, P[3], {now:true})) return;
    if(P[6]) P[6]();
    if(P[4]) voiceLog(P[0].team, P[4], P[0].id, P[5]);
  });
}
function nadeReact(){
  if(tick % 8) return;
  nadeOnEnemy();
  ["A","B"].forEach(function(k){
    if(nadeFlags["rushMolly"+k] || !(bomb.state !== "planted")) return;
    var g = GEO[k], ent = g.tEntry, srcs = {};
    // раньше: только ЗВУК от 2+ T за 1.5с в 550px и ни одного T на сайте —
    // почти не срабатывало (звук через колл приходит с задержкой, часть теряется).
    // Теперь: видели или слышали, окно 2.5с, 700px; в начале раунда (≤25с)
    // хватает одного — это ранний раш; один T уже на сайте — не помеха
    var early = tick - roundStartTick < 25*TICK_HZ;
    picRecent("CT", 2.5*TICK_HZ).forEach(function(q){ if(Math.hypot(q.x-ent.x, q.y-ent.y) < 700) srcs[q.id] = 1; });
    if(Object.keys(srcs).length < (early ? 1 : 2)) return;
    if(BAL.noLeaks){ var onS = {}; picRecent("CT", 1.5*TICK_HZ).forEach(function(q){ if(q.src === "spotted" && Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 220) onS[q.id] = 1; }); if(Object.keys(onS).length > 1) return; }
    else if(bots.filter(function(o){ return o.alive && o.team === "T" && Math.hypot(o.x-SITES[k].x, o.y-SITES[k].y) < 220; }).length > 1) return; // уже зашли — поздно
    var c = bots.filter(function(b){ return b.alive && b.team === "CT" && b.nades && b.nades.molly > 0 && !b.nadeTask && !b._sawEnemy &&
      Math.hypot(b.x-ent.x, b.y-ent.y) < NADE_THROW_RANGE*1.1 && Math.hypot(b.x-ent.x, b.y-ent.y) > 150; })
      .sort(function(a, b2){ return Math.hypot(a.x-ent.x, a.y-ent.y) - Math.hypot(b2.x-ent.x, b2.y-ent.y); })[0];
    if(!c) return;
    if(assignNade(c, "molly", ent, "молотов на раш "+k, {now:true})){ nadeFlags["rushMolly"+k] = tick;
      voiceLog("CT", "rushm"+k, c.id, "слышу раш на "+k+" — молотов во вход!"); }
  });
  // CT ранняя граната на задержку: опорник в первые 7–18с иногда (≈35%) кидает
  // молотов/HE во вход T на своём сайте — сбить ранний раш и время T
  if(BAL.ctEarlyUtil && bomb.state !== "planted"){
    var sinceR = (tick - roundStartTick)/TICK_HZ;
    if(sinceR > 7 && sinceR < 18) ["A","B"].forEach(function(k){
      var key = "ctEarly"+k; if(nadeFlags[key]) return;
      if(hashRand(roundNum*811 + matchNum*37 + (k === "A" ? 3 : 5)) > 0.35){ nadeFlags[key] = true; return; } // в этом раунде не кидаем
      var ent = GEO[k].tEntry, role = k === "A" ? "anchorA" : "anchorB";
      var an = bots.filter(function(b){ return b.alive && b.team === "CT" && b.tRole === role && b.nades && (b.nades.molly > 0 || b.nades.he > 0) && !b.nadeTask &&
        Math.hypot(b.x-ent.x, b.y-ent.y) < NADE_THROW_RANGE*1.1; })[0];
      if(!an || antiEco("CT")) return;
      // (гранаты CT впустую) раньше кидал вслепую в ~35% раундов. Теперь — только
      // если во входе/на подходе к нему есть инфа (видели/слышали за 4с)
      var eI = intelEstimate("CT", ent.x, ent.y, 700, 4*TICK_HZ); if(eI.seen + eI.heard === 0) return;
      var tp = an.nades.molly > 0 ? "molly" : "he";
      if(assignNade(an, tp, ent, "ранняя граната на задержку "+k, {now:true})){ nadeFlags[key] = true; voiceLog("CT", "early"+k, an.id, (tp === "molly" ? "молотов" : "HE")+" во вход "+k+" — задержу, если идут"); }
    });
  }
}
function nadeBrains(){
  var tt = teamTac.T; if(!tt) return;
  var g = GEO[tt.site], site = SITES[tt.site];
  var ts = bots.filter(function(b){ return b.team==="T" && b.alive; });
  var cts = bots.filter(function(b){ return b.team==="CT" && b.alive; });
  function byRole(list, r){ return list.filter(function(b){ return b.tRole===r; })[0]; }
  // план §7: инстасмок — в первые секунды раунда, без всякой инфы ("враг
  // точно там, где всегда"): T закрывают мид от CT (обзор мидера/AWP)
  if(!nadeFlags.insta && tick - roundStartTick > 60 && BAL.tUtil){
    nadeFlags.insta = true;
    var ist = ts.filter(function(b){ return b.nades.smoke > 0 && (b.tRole === "awp" || b.tRole === "lurker"); })[0];
    var midChoke = {x:(GEO.tMid.x+GEO.ctMid.x)/2, y:(GEO.tMid.y+GEO.ctMid.y)/2};
    if(ist) assignNade(ist, "smoke", midChoke, "инстасмок мид", {range:1500, now:true, bkey:"T.insta.mid"});
  }
  // раздел 12: фейк — смок на вход CT и флешка на фейковый сайт, чтобы звучало
  // и выглядело как настоящий выход
  if(tt.fakeOn && !nadeFlags.fakeNades && tt.phase === "setup" && BAL.tUtil){
    nadeFlags.fakeNades = true;
    var gf = GEO[tt.tac.fake], fsite = SITES[tt.tac.fake];
    var fakers = ts.filter(function(b){ return b.tRole === "support" || b.tRole === "lurker"; });
    var fs1 = fakers.filter(function(b){ return b.nades.smoke > 0; })[0];
    if(fs1) assignNade(fs1, "smoke", gf.ctEntry, "фейк-смок", {bkey:"T.fake.smoke."+tt.tac.fake});
    var ff1 = fakers.filter(function(b){ return b !== fs1 && b.nades.flash > 0; })[0] || (fs1 && fs1.nades.flash > 0 ? fs1 : null);
    if(ff1) assignNade(ff1, "flash", {x:gf.tEntry.x + (fsite.x-gf.tEntry.x)*0.4, y:gf.tEntry.y + (fsite.y-gf.tEntry.y)*0.4}, "фейк-флешка", {bkey:"T.fake.flash."+tt.tac.fake});
  }
  // T: выход — два смока (вход CT, линия опорника), флешка ПОД ПИК энтри от
  // поддержки (синхронизация двух ботов: энтри ждёт хлопка), молотов на опорника
  var preEx = preExecNow(tt);
  if((tt.phase === "execute" || preEx) && !nadeFlags.tExecSm && BAL.tUtil){
    nadeFlags.tExecSm = true;
    var smokers = ts.filter(function(b){ return b.nades.smoke > 0 && b.tRole !== "lurker"; });
    var cross = {x:(g.anchor.x+g.ctEntry.x)/2, y:(g.anchor.y+g.ctEntry.y)/2};
    var eo = {now:true, range:1300};
    if(BAL.tSmoke && smokers[0] && assignNade(smokers[0], "smoke", g.ctEntry, "вход CT", Object.assign({bkey:"T.exec.ctEntry."+tt.site}, eo))) smokers[0].nadeTask.exec = true;
    if(BAL.tSmoke && smokers[1] && assignNade(smokers[1], "smoke", cross, "кросс", Object.assign({bkey:"T.exec.cross."+tt.site}, eo))) smokers[1].nadeTask.exec = true;
    if(preEx) logEvent("T: гранаты выхода на "+tt.site+" — заранее, до пика");
    tt._smT = tick;
  }
  if(tt.phase === "execute" && !nadeFlags.tExec && BAL.tUtil){
    nadeFlags.tExec = true;
    var ent = byRole(ts, "entry");
    var fx = g.tEntry.x + (site.x-g.tEntry.x)*0.35, fy = g.tEntry.y + (site.y-g.tEntry.y)*0.35;
    var flasher = ts.filter(function(b){ return b !== ent && b.nades.flash > 0 && (b.tRole === "support" || b.tRole === "awp"); })[0];
    if(BAL.tFlash && ent && flasher){
      nadeFlags.peekFlashPlanned = tick;
      assignNade(flasher, "flash", {x:fx, y:fy}, "под пик", {now:true, bkey:"T.exec.flash."+tt.site});
    } else if(BAL.tFlash && ent && ent.nades.flash > 0){
      assignNade(ent, "flash", {x:fx, y:fy}, "под заход", {bkey:"T.exec.flash."+tt.site}); // некому — сам себе
    }
    var mollies = ts.filter(function(b){ return b.nades.molly > 0; });
    // раздел 12: последний молотов команды не тратим на выход — он нужен на
    // пост-плант, сбить дефуз (если CT мало — выход дожмут и без него)
    var keepMol = BAL.keepMol && mollies.length === 1 && aliveCount("CT") >= 2;
    var mol = keepMol ? null : mollies.filter(function(b){ return !(bomb.state === "carried" && bomb.carrier === b); })[0] || mollies[0];
    if(keepMol) logEvent("T: единственный молотов берегут на пост-плант");
    var molT = g.anchor, molWhy = "выжечь опорника";
    if(BAL.tMolly && mol) assignNade(mol, "molly", molT, molWhy, {bkey:"T.exec.molly."+tt.site, now:true, range:1200});
  }
  // (7) молотов "на всякий" в угол: на выходе, не зная, есть ли там кто, —
  // выжечь ближний угол сайта, куда обычно встают CT (из списка позиций сайта),
  // пока он ещё не виден. По одному на раунд, последний молотов — на пост-плант
  if(BAL.mollyClear && tt.phase === "execute" && !nadeFlags.molClear && tick - (tt.execStart||tick) < 10*TICK_HZ){
    var mc = ts.filter(function(b){ return b.nades.molly > 0 && !b.nadeTask && Math.hypot(b.x-site.x, b.y-site.y) < 750 && !(bomb.state === "carried" && bomb.carrier === b); })[0];
    var molLeft = ts.reduce(function(a, b){ return a + b.nades.molly; }, 0);
    if(mc && (molLeft >= 2 || aliveCount("CT") <= 1)){
      var cands = POS[tt.site].ctHold.map(function(n){ return zonePoint(n, site); }).filter(function(q){ return q && Math.hypot(q.x-mc.x, q.y-mc.y) < 650 && Math.hypot(q.x-mc.x, q.y-mc.y) > 160 && !hasLOS(mc.x, mc.y, q.x, q.y) && !fires.some(function(f){ return Math.hypot(f.x-q.x, f.y-q.y) < 120; }); })
        .sort(function(a, c){ return Math.hypot(a.x-mc.x, a.y-mc.y) - Math.hypot(c.x-mc.x, c.y-mc.y); });
      if(cands[0] && assignNade(mc, "molly", cands[0], "выжечь угол «"+(zoneUserName(zoneIdAt(cands[0].x, cands[0].y)) || "угол")+"»", {now:true, range:700})){
        nadeFlags.molClear = true; logEvent(mc.id+": не знаю, есть ли кто в «"+(zoneUserName(zoneIdAt(cands[0].x, cands[0].y)) || "углу")+"», — выжигаю перед заходом"); }
      else if(tick - (tt.execStart||tick) > 6*TICK_HZ) nadeFlags.molClear = true;
    } else if(!mc) {} else nadeFlags.molClear = true;
  }
  // T пост-плант: CT дефузит — молотов на бомбу
  if(bomb && bomb.state === "planted"){
    var def = bots.filter(function(b){ return b.defusing; })[0];
    if(def && !nadeFlags.antiDef){
      var mt = ts.filter(function(b){ return b.nades.molly > 0 && Math.hypot(b.x-bomb.x, b.y-bomb.y) < NADE_THROW_RANGE; })[0];
      if(mt){ nadeFlags.antiDef = true; if(assignNade(mt, "molly", {x:bomb.x, y:bomb.y}, "на дефуз", {bkey:"T.pp.molly."+bomb.site})) mt.nadeTask.until = tick + 4*64; }
    }
  }
  // CT: T закрыли сайт смоком на выходе — не дать спокойно занять позиции за
  // ним: HE/молотов в точки, куда T встают первыми (вход и первые углы сайта)
  if(BAL.smokeEntry && tt.phase === "execute" && !nadeFlags["ctTake"+tt.site]){
    var gs2 = GEO[tt.site], sT = SITES[tt.site];
    var smokeOn = smokes.some(function(sm){ return tick - sm.born < 3*TICK_HZ && (Math.hypot(sm.x-gs2.ctEntry.x, sm.y-gs2.ctEntry.y) < 260 || Math.hypot(sm.x-sT.x, sm.y-sT.y) < 300); });
    if(smokeOn){
      nadeFlags["ctTake"+tt.site] = true;
      var near = cts.filter(function(b){ return !b.nadeTask && Math.hypot(b.x-sT.x, b.y-sT.y) < 700 && (b.nades.he > 0 || b.nades.molly > 0); });
      var takePt = {x: gs2.tEntry.x + (sT.x-gs2.tEntry.x)*0.35, y: gs2.tEntry.y + (sT.y-gs2.tEntry.y)*0.35};
      near.slice(0, 2).forEach(function(b, i){
        var tp = i === 0 ? takePt : gs2.tEntry;
        if(b.nades.he > 0) assignNade(b, "he", tp, "в смок — не дать занять сайт", {now:true, bkey:"CT.take.he."+tt.site});
        else assignNade(b, "molly", tp, "в смок — не дать занять сайт", {now:true, bkey:"CT.take.he."+tt.site});
      });
      if(near.length) logEvent("CT: T закрыли смоком "+tt.site+" — гранаты туда, где они встают");
    }
  }
  // CT: колл по сайту — опорник того сайта задерживает выход молотовом, при 2+ добавляет HE
  var call = teamTac.CT && teamTac.CT.call;
  if(call && !nadeFlags["ct"+call.site]){
    nadeFlags["ct"+call.site] = true;
    var anc = byRole(cts, call.site === "A" ? "anchorA" : "anchorB");
    var ge = GEO[call.site];
    if(anc){
      if(anc.nades.molly > 0) assignNade(anc, "molly", ge.tEntry, "задержать выход", {bkey:"CT.call.molly."+call.site});
      else if(anc.nades.he > 0) assignNade(anc, "he", ge.tEntry, "по выходу", {bkey:"CT.call.molly."+call.site});
    }
    var rot = byRole(cts, "rotator");
    if(rot && rot.nades.smoke > 0 && (call.count >= 2 || BAL.ctUtilEarly)) assignNade(rot, "smoke", ge.tEntry, "перекрыть вход", {bkey:"CT.call.smoke."+call.site});
    if(BAL.ctUtilEarly && anc && !anc.nadeTask && anc.nades.smoke > 0) assignNade(anc, "smoke", ge.tEntry, "перекрыть вход", {bkey:"CT.call.smoke."+call.site});
  }
  // раздел 11.1: гранатный комбо — не одна граната по инфе от одного бота, а
  // несколько РАЗНЫХ типов от РАЗНЫХ тиммейтов синхронно по одному только что
  // замеченному защитнику, чтобы сдвинуть/выбить его перед проходом
  nadeCombos();
  if(BAL.nadeReact) nadeReact();
  // план §7: граната на отходе — проигрывает дуэль и уходит: смок между собой
  // и врагом (или флешка в него), чтобы выйти живым. Реакция, а не план.
  bots.forEach(function(b){
    if(!b.alive || b.state !== "retreat" || b._retreatNade === roundNum) return;
    var foe = b._nearestEnemyBot; if(!foe || !b._sawEnemy) return;
    var mid = {x:b.x + (foe.x-b.x)*0.35, y:b.y + (foe.y-b.y)*0.35};
    if(b.nades.smoke > 0 && assignNade(b, "smoke", mid, "на отходе", {now:true})) b._retreatNade = roundNum;
    else if(b.nades.flash > 0 && assignNade(b, "flash", {x:foe.x, y:foe.y}, "на отходе", {now:true})) b._retreatNade = roundNum;
  });
}
// смок "отрезать вход T" на ретейке нужен, только если кто-то из T может
// прийти на подмогу снаружи; если все T по инфе уже на сайте — смок пустой
function retakeCutUseful(){
  if(!bomb) return true;
  var ts = bots.filter(function(o){ return o.alive && o.team === "T"; });
  var L = picKnown("CT") || {}, outside = 0, known = 0;
  ts.forEach(function(t){ var e = L[t.id]; if(!e || tick - e.tick > 12*TICK_HZ){ outside++; return; } known++; if(Math.hypot(e.x-bomb.x, e.y-bomb.y) > 650) outside++; });
  return outside > 0;
}
function resetNades(){
  nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0; nadeFlags = {}; groundWeapons.length = 0;
  comboCd = {};
  bots.forEach(function(b){ b._route = null; b.nadeTask = null; b.blindUntil = 0; b.throwUntil = 0; b._fireAcc = 0; b._fireIn = null; b._nadeCd = 0; if(!b.nades) b.nades = emptyNades(); });
}

