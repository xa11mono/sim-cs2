// Сторож устройства (v373, этап 1 плана владельца 16.10). Не список ситуаций, а проверки того, КАК бот решает — ловят и то,
// чего ещё не видели. Подключается в замер матча (rec2.js → REC.watch) и в прогон снимков отметок (watch_snaps.py).
// Использование: eval(этот файл); WATCH.tick() — после каждого stepTick(); WATCH.report() — итог (JSON-объект).
// Классы (каждый — общий, не под одну ситуацию):
//   stall, tug, nav — (v407) из PROB игры (src/game/545_problem_watch.js): застрял (хочет и пытается идти к одной задаче 5 с,
//            сдвинулся < 25 px — с причиной), перенос (видимая позиция за тик дальше шага), перетягивание (A → B → A за 2 с, кроме
//            «кинул гранату и вернулся»); старый счёт (повторы при сдвиге точки, «стоял до задачи») — удалён
//   wait     — ожидание без выхода: стоит на посту ожидания (сбор, ждёт гранат/смока/бомбы…) > 8 с; с раскладом
//              «наших здоровых рядом ≥ живых врагов» — помечается «мог играть»
//   flip     — метание: одна и та же фраза в войсе ≥ 3 раз за 5 с
//   danger   — действие против своего знания: живой в зоне взрыва за 2 с до взрыва; стоит в своём/чужом огне > 0,5 с;
//              вражеская флешка хлопнула в 600 px на виду — через 1,5 с не повернулся к бросавшему (±60°) и не ушёл (> 60 px)
//   empty    — пустое чтение: правило перебирает LKP команды, а там пусто, хотя у команды есть свежее (≤ 2 с, не «проверено — пусто») знание
//              в beliefLast; пишется, какая функция читала
//   nav      — «вне навмеша — перенесён» и застревание (stuckTicks)
//   nade     — цепочка гранат: на руках на старте раунда → задач → дошёл до точки → брошено; задача пропала без броска —
//              по причине (погиб / срок / отказ броска: причина / снята)
(function(){
  var W = {n:{stall:0, wait:0, waitCould:0, tug:0, flip:0, danger:0, empty:0, nav:0}, ev:{stall:[], wait:[], tug:[], flip:[], danger:[], empty:[], nav:[]},
           emptyBy:{}, dangerBy:{}, nade:{rounds:0, hands:{}, intent:{}, reached:{}, thrown:{}, lost:{}, lostWhy:{}}};
  var EVMAX = 40, S = {}, VO = [], LR = null, FL = [], lkpWrapped = null, thrownNow = {}, failNow = {};
  var ev = function(k, row){ W.n[k]++; if(W.ev[k].length < EVMAX) W.ev[k].push(row); };
  var base = function(tag){ return String(tag || "-").replace(/[:|].*$/, "").replace(/\d+$/, ""); };
  var WAIT_RE = /^(gather|bombWait|utilWait|utilHold|smokeWait|retakeCover|rotateHold|waitPop|stage|exec:wait)/;
  var inc = function(o, k, v){ o[k] = (o[k] || 0) + (v == null ? 1 : v); };
  // броски и отказы — для цепочки гранат
  var TN = throwNade;
  throwNade = function(b, type){ var r = TN.apply(this, arguments); if(r) thrownNow[b.id] = {type:type, t:tick}; else failNow[b.id] = {why:String(NADE_FAIL || "?"), t:tick}; return r; };
  // войс: одна фраза ≥ 3 раз за 5 с
  var VL = voiceLog;
  voiceLog = function(team, key, who, text){
    var k = who + "|" + text; VO.push({k:k, t:tick}); VO = VO.filter(function(v){ return tick - v.t <= 5*64; });
    if(VO.filter(function(v){ return v.k === k; }).length === 3) ev("flip", [tick, who, String(text).slice(0, 60)]);
    return VL.apply(this, arguments); };
  // навмеш
  var LE = logEvent;
  logEvent = function(msg){ return LE.apply(this, arguments); };   // (v407) «вне навмеша» — теперь в PROB (перенос)
  // (v375, владелец: «как будто видят сквозь смоки») убийство, когда линия стрелок → жертва проходит через дым: у про —
  // убийств на Mirage — 8,6 % (демки, player_death.thrusmoke)
  var FK = feedKill;
  feedKill = function(att, vic){ if(att && vic && roundState === "live"){ W.n.kills = (W.n.kills||0) + 1; if(typeof smokeBlocks === "function" && smokeBlocks(att.x, att.y, vic.x, vic.y)){ W.n.smokeKill = (W.n.smokeKill||0) + 1; if((W.ev.smoke = W.ev.smoke || []).length < EVMAX) W.ev.smoke.push([tick, att.id, vic.id, Math.round(Math.hypot(att.x-vic.x, att.y-vic.y))]); } } return FK.apply(this, arguments); };
  // флешки: кто должен был отреагировать
  var DT = detonate;
  detonate = function(n){
    if(roundState === "live" && n.type === "flash" && n.thrower) bots.forEach(function(o){
      if(!o.alive || o.team === n.team || Math.hypot(o.x-n.x, o.y-n.y) > 600 || !hasLOS(o.x, o.y, n.x, n.y)) return;
      FL.push({b:o, t:tick, x:o.x, y:o.y, tx:n.ox, ty:n.oy, by:n.thrower.id}); W.n.flashSeen = (W.n.flashSeen||0) + 1; });
    if(roundState === "live" && n.type === "flash" && n.thrower) W.n.flashPop = (W.n.flashPop||0) + 1;   // (30.10) знаменатель «флешка без реакции»: хлопки и враги в 600 px на линии
    return DT.apply(this, arguments); };
  // пустое чтение LKP: перебор ключей пустого LKP команды при свежем знании в beliefLast
  function wrapLKP(){
    if(typeof LKP === "undefined" || LKP === lkpWrapped) return;
    ["CT", "T"].forEach(function(team){ var tgt = LKP[team]; LKP[team] = new Proxy(tgt, {ownKeys:function(t){ var ks = Reflect.ownKeys(t);
      if(!ks.length && roundState === "live"){ var bl = (beliefLast && beliefLast[team]) || {};
        // свежее (≤ 2 с) и место не «проверено — пусто» (CLEARZ): иначе LKP пуст законно — враг ушёл, свои проверили
        var fresh = Object.keys(bl).some(function(e){ var q = bl[e]; if(!q || tick - q.tick > 2*64 || !bots.some(function(x){ return x.id === e && x.alive; })) return false;
          var zi = typeof zoneIdAt === "function" ? zoneIdAt(q.x, q.y) : null; return !(zi && CLEARZ[team] && CLEARZ[team][zi] && CLEARZ[team][zi].tick >= q.tick); });
        if(fresh){ var st = String(new Error().stack).split("\n"), fn = "?";
          for(var i = 2; i < st.length; i++){ var m = /at ([\w$.]+) /.exec(st[i]); if(m && !/Proxy|Reflect|Object\.keys|Array/.test(m[1])){ fn = m[1]; break; } }
          if(/^lkp/.test(fn)) return ks;   // обслуживание самого LKP (срок, сброс) — не правило
          W.n.empty++; inc(W.emptyBy, fn); if(W.ev.empty.length < EVMAX) W.ev.empty.push([tick, team, fn]); } }
      return ks; }}); });
    lkpWrapped = LKP;
  }
  function roundStart(){
    W.nade.rounds++;
    bots.forEach(function(b){ if(!b.nades) return; ["smoke", "flash", "he", "molly"].forEach(function(t){ inc(W.nade.hands, b.team+"|"+(teamEco[b.team]||{}).roundType+"|"+t, b.nades[t]||0); }); });
  }
  // кто снимает задачу на гранату: свойство nadeTask у бота — с записью вызвавшей функции, когда ставят null
  var clrBy = {};
  function hookTask(b){
    if(b.__wt) return; var v = b.nadeTask; b.__wt = 1;
    Object.defineProperty(b, "nadeTask", {configurable:true, enumerable:true, get:function(){ return v; }, set:function(x){
      if(x == null && v != null){ var st = String(new Error().stack).split("\n"), fn = "?";
        for(var i = 2; i < st.length; i++){ var m = /at ([\w$.]+) /.exec(st[i]); if(m && !/^(set|Object|Array)/.test(m[1])){ fn = m[1]; break; } }
        clrBy[b.id] = {fn:fn, t:tick}; }
      v = x; }}); }
  W.tick = function(){
    bots.forEach(hookTask);
    if(roundState !== LR){ if(roundState === "live") roundStart(); LR = roundState; S = {}; FL = []; }
    if(roundState !== "live") return;
    wrapLKP();
    var rtOf = function(b){ return b.team+"|"+(teamEco[b.team]||{}).roundType; };
    // цепочка гранат — каждый тик (задачи живут коротко)
    bots.forEach(function(b){
      var s = S[b.id] || (S[b.id] = {pos:[], tags:[], waitT:0, fireT:0, task:null});
      var t = b.nadeTask;
      if(s.task && s.task.o !== t){
        var k = rtOf(b)+"|"+s.task.type;
        if(thrownNow[b.id] && tick - thrownNow[b.id].t <= 1) inc(W.nade.thrown, k);
        else { inc(W.nade.lost, k); var why = !b.alive ? "погиб" : (tick > s.task.until ? "срок" : (failNow[b.id] && tick - failNow[b.id].t <= 1 ? "отказ: "+failNow[b.id].why : "снята: "+(clrBy[b.id] && tick - clrBy[b.id].t <= 1 ? clrBy[b.id].fn : "?")));
          if(why === "срок"){ var tk = s.task.o, dT = Math.hypot(tk.x-b.x, tk.y-b.y);   // почему не успел: далеко / не видно / не дошёл до точки броска / бой
            why += tk.from ? (Math.hypot(tk.from.x-b.x, tk.from.y-b.y) > 40 ? " — не дошёл до точки броска ("+(b.post ? String(b.post.tag).replace(/[:|].*$/, "") : "-")+")" : " — на точке, не кинул") :
              (b._sawEnemy || b.state === "engage" ? " — бой" : (dT > (tk.range || 600)*0.85 ? " — далеко" : (!hasLOS(b.x, b.y, tk.x, tk.y) ? " — не видно цель" : " — видно, не кинул"))); }
          inc(W.nade.lostWhy, s.task.type+"|"+why); }
        s.task = null; }
      if(t && (!s.task || s.task.o !== t)){ s.task = {o:t, type:t.type, until:t.until, reached:false}; inc(W.nade.intent, rtOf(b)+"|"+t.type); }
      if(s.task && !s.task.reached && t && t.from && Math.hypot(t.from.x-b.x, t.from.y-b.y) < 40){ s.task.reached = true; inc(W.nade.reached, rtOf(b)+"|"+t.type); }
    });
    // опасность: зона взрыва за 2 с до взрыва (раз на бота за раунд)
    if(bomb.state === "planted" && bombTimeLeftTicks() <= 2*64) bots.forEach(function(b){ var s = S[b.id];
      if(b.alive && !s.boom && bombDamageAt(b.x, b.y) >= b.hp){ s.boom = 1; W.n.danger++; inc(W.dangerBy, "взрыв"); if(W.ev.danger.length < EVMAX) W.ev.danger.push([tick, b.id, "в зоне взрыва", b.post ? b.post.tag : "-"]); } });
    // флешки: через 1,5 с — повернулся к бросавшему или ушёл
    FL = FL.filter(function(f){ if(tick - f.t < 96) return true; if(!f.b.alive) return false; W.n.flashChecked = (W.n.flashChecked||0) + 1;
      var a = Math.atan2(f.ty-f.b.y, f.tx-f.b.x), d = Math.abs(Math.atan2(Math.sin(a-(f.b.facing||0)), Math.cos(a-(f.b.facing||0))));
      if(d > Math.PI/3 && Math.hypot(f.b.x-f.x, f.b.y-f.y) < 60){ W.n.danger++; inc(W.dangerBy, "флешка без реакции"); if(W.ev.danger.length < EVMAX) W.ev.danger.push([tick, f.b.id, "флешка "+f.by+" — не повернулся", f.b.post ? f.b.post.tag : "-"]); }
      return false; });
    if(tick % 16) return;
    bots.forEach(function(b){
      var s = S[b.id]; if(!b.alive) return;
      s.pos.push([b.x, b.y, tick]); if(s.pos.length > 21) s.pos.shift();
      // огонь
      var inF = !!inFire(b.x, b.y), pp = s.pos.length >= 3 ? s.pos[s.pos.length-3] : null;   // огонь — как в игре (inFire); стоит — за 0,5 с < 10 px
      s.fireT = inF && pp && Math.hypot(b.x-pp[0], b.y-pp[1]) < 10 ? s.fireT + 16 : 0;
      if(s.fireT === 32){ W.n.danger++; inc(W.dangerBy, "стоит в огне"); if(W.ev.danger.length < EVMAX) W.ev.danger.push([tick, b.id, "стоит в огне", b.post ? b.post.tag : "-"]); }
      // (v407) перетягивание, застой, перенос — одно место в игре: PROB (src/game/545_problem_watch.js); здесь только отчёт
      // ожидание без выхода
      if(b.post && b.atPost && WAIT_RE.test(b.post.tag)){ s.waitT += 16;
        if(s.waitT === 8*64){ var foe = b.team === "T" ? "CT" : "T", nE = aliveCount(foe);
          var near = bots.filter(function(o){ return o.alive && o.team === b.team && o.hp > (typeof LOW_HP !== "undefined" ? LOW_HP : 30) && Math.hypot(o.x-b.x, o.y-b.y) < 600; }).length;
          var could = near >= nE; W.n.wait++; if(could) W.n.waitCould++;
          if(W.ev.wait.length < EVMAX) W.ev.wait.push([tick, b.id, b.post.tag, "наших рядом "+near+", их живых "+nE, could ? "мог играть" : ""]); } }
      else s.waitT = 0;
    });
  };
  W.report = function(){
    // (v407) застой / перетягивание / перенос — из PROB игры (один счёт со слоем «ошибки движения» на странице)
    if(typeof PROB !== "undefined"){ ["stall", "tug", "nav"].forEach(function(k){ W.n[k] = PROB.n[k];
      W.ev[k] = PROB.ev.filter(function(e){ return e.kind === k; }).slice(0, EVMAX).map(function(e){ return [e.tick, e.id, e.text, e.x, e.y, e.round]; }); }); }
    return {n:W.n, ev:W.ev, emptyBy:W.emptyBy, dangerBy:W.dangerBy, nade:W.nade}; };
  (typeof window !== "undefined" ? window : globalThis).WATCH = W;
})();
