// (Р0.6, 24.11) Инварианты L1 — наблюдатель в странице, ТОЛЬКО ЧИТАЕТ (rebuild/MASTER_PLAN.md Р0.6). Определения — docs/reports/audit_2026-11-24/
// TEST_COVERAGE_PLAN.md §2.2 (I-01…I-18), stage2b/UNKNOWN_DEFECTS.md и stage3/MIGRATION_MATRIX.md (I-19…I-32). Нарушение — не обязательно ошибка
// игры, а эпизод для разбора (матч, тик, бот, данные). Где в определении нет числа (N тиков, N с), число НЕ назначается: инвариант пишется
// счётчиком (распределение), решение о пороге — владельцу. I-15, I-22, I-23, I-24, I-29, I-30, I-32 — отдельные прогоны (tools/measure/inv_run.js).
// Подписка — события симуляции (435 simEvOn); для функций без точек событий — обёртка (как раньше в rec2.js), тоже только чтение.
(typeof window !== "undefined" ? window : globalThis).INV = (function(){
  var R = {}, EPS = 20, prev = {}, st = {};
  function hit(id, b, data){ var r = R[id] || (R[id] = {n: 0, eps: []}); r.n++; var episode = {tick: tick, round: roundNum, bot: b ? b.id : null, data: data}; (r.all || (r.all = [])).push(episode); if(r.eps.length < EPS) r.eps.push(episode); }
  function cnt(id, key, v){ var r = R[id] || (R[id] = {n: 0, eps: [], hist: {}}); r.hist = r.hist || {}; r.hist[key] = Math.max(r.hist[key] || 0, v); }
  function mark(id){ R[id] = R[id] || {n: 0, eps: []}; }
  function on(name, fn){ if(typeof simEvOn === "function") simEvOn(name, fn); }
  function span(id,b,data){
    hit(id,b,data);
    return R[id].all[R[id].all.length-1].data;
  }
  function finish(row,why){ if(row){ row.until = tick; row.end = why; } }
  // кто вызвал функцию name: кадр сразу после последнего кадра name (подписка: подписчик → simEvIn → name → вызвавший; обёртка: подписчик → обёртка name → вызвавший)
  function caller(name){ var fr = String(new Error().stack || '').split('\n'), k = -1, re = new RegExp('at (?:\\S+\\.)?' + name + '\\b');
    fr.forEach(function(l, i){ if(re.test(l)) k = i; }); var m = k >= 0 && fr[k + 1] && fr[k + 1].match(/at (?:\S+\.)?(\w+)/); return m ? m[1] : '?'; }
  var live = function(){ return roundState === 'live'; };
  'I-01 I-02 I-03 I-04 I-05 I-06 I-07 I-08 I-09 I-10 I-11 I-12 I-13 I-14 I-16 I-17 I-18 I-19 I-20 I-21 I-25 I-26 I-27 I-28 I-31'.split(' ').forEach(mark);

  // ---- по событиям ----
  // Серии — длительность по последовательным тикам, все отказы одного тика сгруппированы.
  var refusal = {}, pauses = {};
  on('setPostResult', function(ph, A){
    if(ph !== 'in' || !live()) return;
    var b = A[0], tag = String(A[1] || ''), r = A[2], key = b.id+'|'+tag, p = refusal[key];
    if(r.ok){ finish(p && p.row,'accepted'); delete refusal[key]; return; }
    var holder = b._task ? b._task.tag : null;
    if(p && (p.row.round !== roundNum || p.row.holds !== holder || p.tick < tick-1)){
      finish(p.row,'interrupted'); p = null;
    }
    if(!p){
      var row = span('I-07',b,{tag:tag,holds:holder,round:roundNum,from:tick,last:tick,ticks:0,responses:[]});
      span('I-26',b,row);
      p = refusal[key] = {tick:null,row:row};
    }
    if(p.tick !== tick){ p.tick = tick; p.row.last = tick; p.row.ticks++; }
    var replies = p.row.responses, last = replies[replies.length-1];
    if(last && last[0] === tick && last[1] === r.why) last[2]++;
    else replies.push([tick,r.why,1]);
    cnt('I-07',tag,p.row.ticks); cnt('I-26',holder || 'no-holder',p.row.ticks);
    if(b._task && r.lv === b._task.lv) hit('I-31',b,{want:tag,holds:holder,lv:b._task.lv,why:r.why});
  });
  on('throwNade', function(ph,A,r){
    if(ph !== 'out' || !live() || !A[0]) return;
    var b = A[0], from = A[6], fail = NADE_FAIL, m = st.nt || (st.nt = {});
    if(!r && from && from.x != null){
      var p = m[b.id];
      if(p && p.round === roundNum && p.type === A[1] && p.fx === from.x && p.fy === from.y && p.z !== b.z && p.why === fail)
        hit('I-11',b,{from:[p.fx,p.fy],z:[p.z,b.z],why:fail});
      m[b.id] = {round:roundNum,type:A[1],fx:from.x,fy:from.y,z:b.z,why:fail};
    }
    var q = pauses[b.id], task = A[7], pause = !r && NADE_FC === 'pause';
    if(q && (q.last < tick-1 || q.task !== task || q.type !== A[1] || q.x !== A[2] || q.y !== A[3] || !pause)){
      finish(q.row,'interrupted'); delete pauses[b.id]; q = null;
    }
    if(!pause) return;
    if(!q) q = pauses[b.id] = {from:tick,last:tick,task:task,type:A[1],x:A[2],y:A[3]};
    q.last = tick;
    if(!q.row && tick-q.from >= 3) q.row = span('I-12',b,{from:q.from,last:tick,type:A[1],why:fail});
    if(q.row) q.row.last = tick;
  });
  ['knowSound','knowIntel'].forEach(function(name){ on(name,function(ph,A,r,before){
    var b = A[0], value = A[1], field = name === 'knowSound' ? 'heardSound' : 'lastIntel';
    if(ph === 'in') return b[field];
    if(!live() || !value || value === before) return;
    var origin = A[2] || (value.kind === 'call' || value.kind === 'hit' ? value.kind :
      value.src === 'call' ? 'call' : value.id && (b._visible || []).some(function(e){ return e.id === value.id; }) ? 'vision' : null);
    if(!origin) hit('I-16',b,{field:field,kind:'origin-unavailable',input:value.kind || value.src || value.id || null});
    if(name !== 'knowSound' || origin !== 'hearing') return;
    var replaced = before && before.kind === 'call' && value.tick >= before.tick && value.tick-before.tick <= TICK_HZ;
    var seen = value.tick === tick && (b._visible || []).some(function(e){ return e.id === value.src; });
    if(replaced || seen) hit('I-25',b,{from:replaced ? 'call' : null,seen:seen ? value.src : null,to:value.kind});
  }); });
  // I-20: окно размена (tradeStart) кончилось без knowAvoidPeek у этого бота
  on('tradeStart', function(ph, A){ if(ph === 'in' && A[0]) (st.tr = st.tr || {})[A[0].id] = {t0: tick, until: tick + Math.round(3.5*TICK_HZ), avoided: false}; });
  on('knowAvoidPeek', function(ph, A){ if(ph === 'in' && A[0] && st.tr && st.tr[A[0].id]) st.tr[A[0].id].avoided = true; });
  // I-27: pickSpots без стороны в параметрах — кто зовёт (счётчик мест вызова)
  on('pickSpots', function(ph, A){ if(ph !== 'in') return; var o = A[3]; if(!(o && (o.team || o.side))){ var w = caller('pickSpots'); cnt('I-27', w, (((R['I-27'] || {}).hist || {})[w] || 0) + 1); } });
  // I-28: NADE_FAIL до и после nadeRunPlan различается
  on('nadeRunPlan', function(ph, A, r, s){ if(ph === 'in') return typeof NADE_FAIL !== 'undefined' ? NADE_FAIL : null; var now = typeof NADE_FAIL !== 'undefined' ? NADE_FAIL : null; if(live() && now !== s) hit('I-28', A[0], {before: s, after: now}); });
  // Только поля с явным контрактом сброса. Инвентарь, роли, экономика и координаты зависят от раунда.
  var resetFields = {alive:true,hp:100,atPost:false,pathIdx:0,lastIntel:null,heardSound:null,nadeTask:null,
    _reloading:false,_climb:null,_fall:null,_jc:null,_boost:null,blindUntil:0,throwUntil:0,roundKills:0,roundDmg:0};
  on('resetRound', function(ph){ if(ph !== 'out') return;
    bots.forEach(function(b){ Object.keys(resetFields).forEach(function(k){
      if(b[k] !== resetFields[k]) hit('I-14',b,{field:k,expected:resetFields[k],actual:b[k] === undefined ? 'undefined' : b[k]});
    }); }); });

  // ---- каждый тик (после stepTick) ----
  function tick1(dt){
    if(dt > 50) hit('I-13', null, {ms: Math.round(dt), nadeTasks: bots.filter(function(b){ return b.alive && b.nadeTask; }).length});   // 50 мс — длинная задача браузера
    var L = live();
    Object.keys(refusal).forEach(function(key){ var p = refusal[key];
      if(!L || p.row.round !== roundNum || p.tick < tick-1){ finish(p.row,'series-ended'); delete refusal[key]; }
    });
    Object.keys(pauses).forEach(function(key){ var p = pauses[key];
      if(!L || p.last < tick-1){ finish(p.row,'series-ended'); delete pauses[key]; }
    });
    bots.forEach(function(b){
      var p = prev[b.id] || (prev[b.id] = {});
      var l = L && b.alive, invalidPath = l && b.path && !(b.pathIdx >= 0 && b.pathIdx <= b.path.length);
      if(p.round !== roundNum){ finish(p.path,'round'); finish(p.lineup,'round'); p = prev[b.id] = {round:roundNum}; }
      if(invalidPath && !p.path) p.path = span('I-01',b,{from:tick,idx:b.pathIdx,len:b.path.length});
      if(!invalidPath && p.path){ finish(p.path,'valid-or-inactive'); p.path = null; }
      if(l && b.post && b.post.tag === 'lineup' && !b.nadeTask){
        if(p.luSince == null) p.luSince = tick;
        if(!p.lineup && tick-p.luSince > 16) p.lineup = span('I-04',b,{from:p.luSince,post:[b.post.x,b.post.y,b.post.z]});
      } else { finish(p.lineup,'owner-or-inactive'); p.lineup = null; p.luSince = null; }
      if(L && b.alive){
        if(b.curSpeed < 1 && !(b._stopWhy || (b._fc && b._fc.ph) || b.planting || b.defusing)) hit('I-02', b, {post: b.post && b.post.tag, state: b.state});
        if(!!b.walking !== (b._walkWhy != null)) hit('I-03', b, {walking: b.walking, why: b._walkWhy});
        if(b._probeLock >= tick - 1 && !(b.post && /^probe/.test(b.post.tag))) hit('I-05', b, {post: b.post && b.post.tag});
        if(typeof navOnFloor === 'function' && !navOnFloor(b.x, b.y, b)) hit('I-08', b, {x: Math.round(b.x), y: Math.round(b.y), z: b.z});
        if(Math.abs(b.facing) > Math.PI + 1e-9) hit('I-21', b, {facing: b.facing});
        if(b.holding){ var since = tick - (b._lastSeenEnemy || p.seen || 0); cnt('I-18', 'holding', since); }
        if(b._visible && b._visible.length) p.seen = tick;
        if(b._task){ var age = tick - b._task.t; if(age > TASK_STALE) cnt('I-17', String(b._task.tag).replace(/[:\d].*$/, ''), age); }

      }
      p.x = b.x; p.y = b.y;
    });
    // I-09, I-10 — по журналу сторожа движения (545: перенос «nav», застревание «stall»)
    var PE = (typeof PROB !== 'undefined' && PROB.all) || [];
    if(st.probLog !== PE){ st.probLog = PE; st.pe = 0; st.stall = {}; }
    var from = st.pe || 0;
    for(var i = from; i < PE.length; i++){ var e = PE[i]; if(e.kind === 'nav') hit('I-09', {id: e.id}, {text: e.text, seq: i, eventTick: e.tick, facts: e.facts || null});
      if(e.kind === 'stall'){ var w = st.stall, a = (w[e.id] = (w[e.id] || []).filter(function(old){ return old.round === e.round && e.tick-old.tick < 5*TICK_HZ; }));
        a.push(e);
        if(a.length === 3) hit('I-10',{id:e.id},{from:a[0].tick,until:e.tick,contributors:a.map(function(old){ return old.seq; })}); } }
    st.pe = PE.length;
    // I-06, I-19: фетч бомбы — сборщик далеко от бомбы, стоит, прикрывающий тоже стоит: длительность (счётчик; 5 с из определения — эпизод)
    var tt = typeof teamTac !== 'undefined' && teamTac.T;
    if(L && tt && tt.fetchId && bomb.state === 'dropped'){ var fb = bots.filter(function(o){ return o.id === tt.fetchId; })[0], cv = tt.fetchCover && bots.filter(function(o){ return o.id === tt.fetchCover.id; })[0];
      var near = fb && Math.hypot(fb.x - bomb.x, fb.y - bomb.y) < 36 / (MAP.pxUnits || 1);
      var moving = fb && fb.curSpeed >= 1, coverMoving = cv && cv.curSpeed >= 1;
      if(fb && !near && !moving){ st.fw = st.fw || tick; var d = tick - st.fw; cnt('I-19', 'fetch', d); if(!coverMoving && d > 5*TICK_HZ && !st.fwHit){ st.fwHit = 1; hit('I-06', fb, {waited: d, cover: cv ? cv.id : null, post: fb.post && fb.post.tag}); } }
      else { st.fw = 0; st.fwHit = 0; } }
    else { st.fw = 0; st.fwHit = 0; }
    // I-20: окна размена, которые кончились
    if(st.tr) Object.keys(st.tr).forEach(function(id){ var w = st.tr[id]; if(tick >= w.until){ if(!w.avoided) hit('I-20', {id: id}, {t0: w.t0}); delete st.tr[id]; } });
  }
  return {R: R, tick: tick1};
})();
