// ---------- бомба (правила CS2) ----------
// Носитель, дроп при смерти, подбор (T, пробежавший по бомбе), плант 3,2 с
// только внутри зоны сайта, взрыв через 40 с, дефуз 10 с / 5 с с китом.
// Кто и когда ставит/дефузит — решает мозг (сейчас его нет): движок даёт
// действия bombStartPlant(b) и bombStartDefuse(b) и сам ведёт их до конца.
var PLANT_TICKS = Math.round(3.2*64), BOMB_TICKS = 40*64, DEFUSE_TICKS = 10*64, DEFUSE_KIT_TICKS = 5*64;
var BOMB_KILL_RADIUS = 330;
var DEFUSE_HEAR = 700; // px — звук дефуза
var bomb = null;
function resetBomb(){
  // на время закупа — у первого T; кому её отдать, решает команда в начале раунда (tdefBomb, 12_t_default.js)
  var carrier = bots.filter(function(b){ return b.team==="T"; })[0];
  bomb = {state:"carried", carrier:carrier, x:carrier.x, y:carrier.y, site:null, plantTick:-1, explodeTick:-1};
  bots.forEach(function(b){ b.planting = false; b.defusing = false; });
}
function dropBomb(b){
  if(bomb && bomb.state === "carried" && bomb.carrier === b){
    bomb.state = "dropped"; bomb.x = b.x; bomb.y = b.y; bomb.carrier = null;
    logEvent(b.id+" погиб с бомбой — C4 на земле", "bomb");
  }
}
function bombSiteAt(x, y){ return ["A","B"].filter(function(k){ return SITES[k] && onSite(SITES[k], x, y); })[0] || null; }
// действие «ставить бомбу»: носитель, внутри зоны сайта
function bombStartPlant(b){
  if(!bomb || bomb.state !== "carried" || bomb.carrier !== b || b.planting || roundState !== "live" || tick < (b._nadeWait||0)) return false;   // ждёт свой смок
  var site = bombSiteAt(b.baseX, b.baseY); if(!site) return false;
  b.planting = true; b.plantUntil = tick + PLANT_TICKS; b.plantSite = site; b.path = []; b.pathIdx = 0;
  logEvent(b.id+" закладывает бомбу на "+site+"…", "bomb");
  makeSound(b, b.x, b.y, "plant");
  return true;
}
// действие «дефузить»: живой CT рядом с заложенной бомбой
function bombStartDefuse(b){
  if(!bomb || bomb.state !== "planted" || b.team !== "CT" || !b.alive || b.defusing || tick < (b._nadeWait||0)) return false;   // ждёт свой смок
  if(Math.hypot(b.baseX-bomb.x, b.baseY-bomb.y) > 42) return false;
  b.defusing = true; b.defuseUntil = tick + (b.kit ? DEFUSE_KIT_TICKS : DEFUSE_TICKS); b.path = []; b.pathIdx = 0;
  makeSound(b, bomb.x, bomb.y, "defuse");
  logEvent(b.id+" дефузит"+(b.kit?" с китом (5с)":" без кита (10с)")+"…", "bomb");
  return true;
}
function bombTick(){
  if(!bomb) return;
  if(bomb.state === "carried"){
    var c = bomb.carrier;
    if(!c || !c.alive){ dropBomb(c); return; }
    bomb.x = c.x; bomb.y = c.y;
    if(c.planting && tick >= c.plantUntil){
      c.planting = false;
      bomb.state = "planted"; bomb.site = c.plantSite; bomb.x = c.baseX; bomb.y = c.baseY;
      bomb.plantTick = tick; bomb.explodeTick = tick + BOMB_TICKS; bomb.carrier = null; bomb.planter = c;
      c.money = Math.min(MAX_MONEY, c.money + 300);
      logEvent(c.id+" заложил бомбу на "+bomb.site+" (+$300)", "bomb");
      feedEvent("bomb", c.id+" заложил бомбу на "+bomb.site);
    }
  } else if(bomb.state === "dropped"){
    // подбирает любой живой T, пробежавший по бомбе
    var pick = bots.filter(function(b){ return b.team==="T" && b.alive && Math.hypot(b.baseX-bomb.x, b.baseY-bomb.y) < 36; })[0];
    if(pick){ bomb.state = "carried"; bomb.carrier = pick; logEvent(pick.id+" подобрал бомбу"); }
  } else if(bomb.state === "planted"){
    // заложенная бомба пищит (CS2: чем ближе взрыв, тем чаще — здесь раз в секунду, для знания этого хватает)
    if(bomb.planter && (tick - bomb.plantTick) % 64 === 32) makeSound(bomb.planter, bomb.x, bomb.y, "beep");
    var def = bots.filter(function(b){ return b.defusing && b.alive; })[0];
    if(!def) return;
    // звук дефуза продолжается, пока дефузят
    if(tick % 8 === 0) makeSound(def, bomb.x, bomb.y, "defusing");
    if(tick >= def.defuseUntil){
      def.defusing = false; bomb.state = "defused";
      def.money = Math.min(MAX_MONEY, def.money + 300);
      logEvent(def.id+" обезвредил бомбу (+$300)", "bomb");
      feedEvent("defuse", def.id+" обезвредил бомбу");
      endRound("CT", "defuse");
    }
  }
}
