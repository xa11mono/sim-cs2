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
  smoke:  {name:"дым",     price:300, radius:BAL.smokeR, life:BAL.smokeLife*64},
  flash:  {name:"флешка",  price:200, fuse:104},   // (В3) тиков от броска до хлопка — запал физики 1,627 с (385_nades_flight)
  // (v321, М22) урон CS2: 98, сквозь броню 57,5 % (csdb.gg/weapon/he-grenade); радиус 350 ед. игры = 140 ед. карты —
  // число CS:GO (weapons script), для CS2 источник не найден — проектное число. Было: 57 урона, радиус 190, броня ×0,5
  he:     {name:"HE",      price:300, fuse:104, radius:140, dmg:98, armorK:0.575},
  molly:  {name:"молотов", price:400, priceCT:500, radius:72, life:BAL.mollyLife*64, dps:40}
};
var NADE_THROW_RANGE = 820;
var NADE_HEAR_R = 550; // раздел 11.1: с какого расстояния слышно чеку/бросок гранаты противника
var nadesInAir = [];   // {type, x,y, vx,vy, born, thrower, team, trail:[]}
var nadeLandHistory = {A:[], B:[]}; // раздел 11.1: где команда обычно кидает молотов/HE по сайту, по матчу
function recordNadeLand(n){
  if(n.type !== "molly" && n.type !== "he") return;
  ["A","B"].forEach(function(k){
    if(Math.hypot(n.x-SITES[k].x, n.y-SITES[k].y) < 750){
      nadeLandHistory[k].push({x:n.x, y:n.y, team:n.team});
      if(nadeLandHistory[k].length > 14) nadeLandHistory[k].shift();
    }
  });
}
function enemyNadeSpots(team, site){ return nadeLandHistory[site].filter(function(h){ return h.team !== team; }); }
var smokes = [];       // {x,y,born,until}
var fires = [];        // {x,y,born,until,team,thrower}
var nadeFx = [];       // визуальные вспышки/взрывы {type,x,y,born}

function emptyNades(){ return {smoke:0, flash:0, he:0, molly:0}; }
bots.forEach(function(b){ b.nades = emptyNades(); b.nadeTask = null; b.nadeQueue = null; b.blindUntil = 0; });

// ---------- закуп гранат (вызывается из buyForPlayer) ----------
var NADE_WISH = {
  // T: поддержка и IGL несут смоки, энтри — флешки, молотовы у IGL/энтри
  // (7) у T на фулле в среднем ~3 молотова на команду (выход, зачистка угла, пост-плант)
  entry:["flash","smoke","flash","molly"], awp:["smoke","flash","molly"], support:["smoke","flash","molly","he"], igl:["smoke","molly","flash"], lurker:["flash","smoke"],
  // CT: опорники — зажигалка + смок, ротатор/мидер — смок+флешка, роумер — флешка
  anchorA:["molly","smoke","he"], anchorB:["molly","smoke","he"], rotator:["smoke","flash"], mid:["flash","smoke"], roamer:["flash","he"]
};
function nadePrice(type, team){ return (type === "molly" && team === "CT") ? NADE.molly.priceCT : NADE[type].price; }
// (v151) у про на полном закупе почти каждый берёт 3–4 гранаты (за раунд CT
// кидают ~10, T ~9.4); набор по роли игрока (демки): саппорт/снайпер — больше утилиты
var NADE_WISH_PRO = {
  // (v357, владелец: «гранаты не закупаются так часто») набор на фулле по роли — из ответа Claude + JSON cs2_buy_rules (сверено с
  // ответом Гугла) и поправлен по демкам Mirage (tools/nades_pro.py, броски за фулл-раунд на команду: T смок 4,1, флешка 4,0,
  // молотов 3,0, HE 1,1; CT 3,5 / 3,0 / зажигалка 3,5 / HE 3,0 — у CT HE втрое больше, чем в оценке JSON). Порядок — что держат
  // дольше всего (первое режут последним). Закуп фулла на команду: T 5 смоков, 7 флешек, 4 молотова, 2 HE; CT 5 / 6 / 4 / 4
  entry:["smoke","flash","flash","molly"], support:["smoke","flash","molly","flash"], igl:["smoke","flash","molly","he"],
  lurker:["smoke","flash","molly","he"], awp:["smoke","flash"],
  anchorA:["molly","smoke","flash","he"], anchorB:["molly","smoke","flash","he"], rotator:["smoke","flash","he","flash"],
  mid:["smoke","flash","molly","he"], roamer:["smoke","flash","molly","he"]
};
function buyNades(b, type){
  if(type === "full" && b._fullKit === roundNum) return;   // (v357) на фулле гранаты — в наборе роли (buyFullKit)
  // (v373) эко и форс — план команды из демок (teamNadePlan), как на пистолетке; что не по карману после оружия и брони — не берёт
  if(type === "eco" || type === "force" || type === "half"){
    var TP = teamNadePlan(b.team, type === "eco" ? "eco" : "force")[b.id] || [];
    if(!b.nades) b.nades = emptyNades();
    var keepE = (BAL.nadeBuy && type === "eco") ? fullNeed(b) - nextLossIncome(b.team) : -1e9;
    TP.forEach(function(t){ var pr = nadePrice(t, b.team), tot = b.nades.smoke + b.nades.flash + b.nades.he + b.nades.molly;
      if(tot >= 4 || (t === "flash" ? b.nades.flash >= 2 : b.nades[t] >= 1) || b.money < pr || b.money - pr < keepE) return;
      b.money -= pr; b.nades[t]++; });
    return;
  }
  var wish = (BAL.proNades ? NADE_WISH_PRO[b.tRole] : null) || NADE_WISH[b.tRole] || [];
  var budget = type === "full" ? 99 : (type === "force" || type === "half" ? (BAL.nadeBuy ? 2 : 1) : 0);
  if(type === "eco") budget = BAL.nadeBuy ? 1 : 0;
  if(type === "pistol") budget = 0;   // (v293) на пистолетке гранаты — по плану команды (teamNadePlan)
  var keepEco = (BAL.nadeBuy && type === "eco") ? fullNeed(b) - nextLossIncome(b.team) : -1e9;
  var bought = 0;
  for(var i=0;i<wish.length && bought<budget;i++){
    var t = wish[i], pr = nadePrice(t, b.team);
    var total = b.nades.smoke + b.nades.flash + b.nades.he + b.nades.molly;
    if(total >= 4) break;
    if(t === "flash" ? b.nades.flash >= 2 : b.nades[t] >= 1){ continue; }
    // на хаф/форсе — только если после этого остаётся запас
    if(type !== "full" && b.money - pr < 200 && !(BAL.nadeBuy && type === "pistol" && b.money >= pr)) continue;
    if(BAL.nadeBuy && (type === "eco" || type === "pistol") && t === "molly") continue;
    if(BAL.nadeBuy && type === "eco" && b.money - pr < keepEco) continue;
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
// (v288) для показа (киллфид, радар): линия выстрела прошла через облако — с дырами от пуль или без
function smokeOnLine(x1,y1,x2,y2){
  for(var i=0;i<smokes.length;i++){ var s = smokes[i], r = smokeRadiusNow(s); if(r > 8 && areaSegHits(s, r, x1,y1,x2,y2)) return true; }
  return false;
}
// (М150, 21.10, владелец: «смок и молотов обрезаются по стенам — убери») дым и огонь — полный круг своего радиуса. Раньше
// (v323, М36) круг обрезался стенами радара (areaRays): с А5/А6 они только рисунок, настоящих стен там нет. Сквозь настоящие
// стены сквозь дым всё равно не видно — видимость идёт по 3D-геометрии игры
function areaHas(o, r, px, py){ return Math.hypot(px - o.x, py - o.y) < r; }
function areaSegHits(o, r, x1, y1, x2, y2){ return segHitsCircle(x1,y1,x2,y2,o.x,o.y,r); }
function areaPath(o, r){ ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2); ctx.closePath(); }   // контур области для рисования
function smokeBlocks(x1,y1,x2,y2){
  for(var i=0;i<smokes.length;i++){
    var s = smokes[i], r = smokeRadiusNow(s);
    if(r > 8 && areaSegHits(s, r, x1,y1,x2,y2) && !smokeHoleClear(s, r, x1,y1,x2,y2)) return true;
  }
  return false;
}
// (v271) CS2: пули пробивают в дыме временную дыру. Ширина и время жизни Valve не публикует —
// проектные числа: SMOKE_HOLE.w (≈25 юнитов) и SMOKE_HOLE.life (1 с). Линия взгляда проходит
// сквозь дым, если и вход, и выход её через облако лежат в живой дыре (рядом с линией пуль).
var SMOKE_HOLE = {w:10, life:64};   // проектное число: px, тики
function smokeBulletHole(x1, y1, x2, y2){
  smokes.forEach(function(s){
    var r = smokeRadiusNow(s); if(r <= 8 || !segHitsCircle(x1,y1,x2,y2,s.x,s.y,r)) return;
    var H = s.bholes || (s.bholes = []);
    for(var i = H.length-1; i >= 0; i--) if(H[i].until <= tick) H.splice(i, 1);
    H.push({x1:x1, y1:y1, x2:x2, y2:y2, until:tick + SMOKE_HOLE.life});
    if(H.length > 12) H.shift();
  });
}
function smokeHoleClear(s, r, x1, y1, x2, y2){
  var H = s.bholes; if(!H || !H.length) return false;
  var dx = x2-x1, dy = y2-y1, a = dx*dx + dy*dy; if(a < 1) return false;
  var fx = x1-s.x, fy = y1-s.y, bq = 2*(fx*dx + fy*dy), cq = fx*fx + fy*fy - r*r, D = bq*bq - 4*a*cq;
  if(D < 0) return false;
  var sq = Math.sqrt(D), t1 = Math.max(0, (-bq - sq)/(2*a)), t2 = Math.min(1, (-bq + sq)/(2*a));
  var p = [[x1+dx*t1, y1+dy*t1], [x1+dx*t2, y1+dy*t2]];
  return H.some(function(h){
    if(h.until <= tick) return false;
    var hx = h.x2-h.x1, hy = h.y2-h.y1, hl = Math.hypot(hx, hy); if(hl < 1) return false;
    return p.every(function(q){ return Math.abs((q[0]-h.x1)*hy - (q[1]-h.y1)*hx)/hl < SMOKE_HOLE.w; });
  });
}
var MOLLY_SMOKE_TOUCH = 0.9;   // (v321) огонь гаснет, когда круг огня касается дыма (0,9 радиуса огня — касание с запасом) — проектное число
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
// Молотов — не стена (v323, М35, владелец): через огонь можно пройти, он только жжёт, и чем дольше в нём, тем сильнее —
// урон за удар растёт 1, 2 … 8, удар раз в 0,2 с (до 40/с; CS:GO/CS2, counterstrike.fandom.com/wiki/Molotov, inferno_damage 40).
// Кто идёт по делу (есть путь и не держит угол) — проходит насквозь, если переживёт пересечение (2 радиуса бегом) с запасом
// FIRE_MARGIN HP; плант/дефуз — доделает, если переживёт до конца. Кто стоит с углом — в огонь не заходит
var FIRE_HIT_SEC = 0.2, FIRE_HIT_MAX = 8, FIRE_MARGIN = 20;   // запас 20 HP — проектное число
