// (Р0.6, 24.11) Инварианты L1 — наблюдатель в странице, ТОЛЬКО ЧИТАЕТ (rebuild/MASTER_PLAN.md Р0.6). Определения — docs/reports/audit_2026-11-24/
// TEST_COVERAGE_PLAN.md §2.2 (I-01…I-18), stage2b/UNKNOWN_DEFECTS.md и stage3/MIGRATION_MATRIX.md (I-19…I-32). Нарушение — не обязательно ошибка
// игры, а эпизод для разбора (матч, тик, бот, данные). Где в определении нет числа (N тиков, N с), число НЕ назначается: инвариант пишется
// счётчиком (распределение), решение о пороге — владельцу. I-15, I-22, I-23, I-24, I-29, I-30, I-32 — отдельные прогоны (tools/measure/inv_run.js).
// Подписка — события симуляции (435 simEvOn); для функций без точек событий — обёртка (как раньше в rec2.js), тоже только чтение.
window.INV = (function(){
  var R = {}, EPS = 20, prev = {}, st = {};
  function hit(id, b, data){ var r = R[id] || (R[id] = {n: 0, eps: []}); r.n++; if(r.eps.length < EPS) r.eps.push({tick: tick, round: roundNum, bot: b ? b.id : null, data: data}); }
  function cnt(id, key, v){ var r = R[id] || (R[id] = {n: 0, eps: [], hist: {}}); r.hist = r.hist || {}; r.hist[key] = Math.max(r.hist[key] || 0, v); }
  function mark(id){ R[id] = R[id] || {n: 0, eps: []}; }
  var EV = ['feedKill','endRound','throwNade','tryShoot','detonate','logEvent','voiceFeed','exuEv','applyDamage','setPost','tSetSite'];
  function on(name, fn){
    if(typeof simEvOn === 'function' && EV.indexOf(name) >= 0) return simEvOn(name, fn);
    var o = eval(name); if(typeof o !== 'function') return;
    eval(name + ' = function(){ var s = fn("in", arguments), r = o.apply(this, arguments); fn("out", arguments, r, s); return r; }');
  }
  // кто вызвал функцию name: кадр сразу после последнего кадра name (подписка: подписчик → simEvIn → name → вызвавший; обёртка: подписчик → обёртка name → вызвавший)
  function caller(name){ var fr = String(new Error().stack || '').split('\n'), k = -1, re = new RegExp('at (?:\\S+\\.)?' + name + '\\b');
    fr.forEach(function(l, i){ if(re.test(l)) k = i; }); var m = k >= 0 && fr[k + 1] && fr[k + 1].match(/at (?:\S+\.)?(\w+)/); return m ? m[1] : '?'; }
  var live = function(){ return roundState === 'live'; };
  'I-01 I-02 I-03 I-04 I-05 I-06 I-07 I-08 I-09 I-10 I-11 I-12 I-13 I-14 I-16 I-17 I-18 I-19 I-20 I-21 I-25 I-26 I-27 I-28 I-31'.split(' ').forEach(mark);

  // ---- по событиям ----
  // I-07, I-26: отказ setPost — серия отказов одного и того же (бот, тег) подряд; кто звал. Порог N не задан — длина серии счётчиком.
  // I-31: отказ при равном уровне (ничья в арбитре места) — победитель тот, кто уже держит.
  on('setPost', function(ph, A, r){ if(ph !== 'out' || !live()) return; var b = A[0], tag = String(A[4] || ''); if(!b) return;
    var k = b.id + '|' + tag, s = st.sp || (st.sp = {});
    if(r === false){ var c = s[k] && s[k].last >= tick - 1 ? s[k].n + 1 : 1; s[k] = {n: c, last: tick};
      cnt('I-07', tag.replace(/[:\d].*$/, ''), c); var who = caller('setPost'); cnt('I-26', who, c);
      if(b._task && typeof taskLevel === 'function' && taskLevel(tag) === b._task.lv) hit('I-31', b, {want: tag, holds: b._task.tag, lv: b._task.lv, by: who}); }
    else if(s[k]) delete s[k]; });
  // I-11: промах подбора броска с той же точки «откуда», отличается только высота бота; I-12: отказ «пауза» у бота > 3 тиков подряд
  on('throwNadeTry', function(ph, A, r){ if(ph !== 'out' || !live()) return; var b = A[0], from = A[7]; if(!b || r !== false) return;
    var fail = String(typeof NADE_FAIL !== 'undefined' ? NADE_FAIL : ''), m = st.nt || (st.nt = {}), k = b.id;
    if(from && from.x != null){ var p = m[k]; if(p && p.fx === Math.round(from.x) && p.fy === Math.round(from.y) && p.z !== b.z && p.why === fail) hit('I-11', b, {from: [p.fx, p.fy], z: [p.z, b.z], why: fail});
      m[k] = {fx: Math.round(from.x), fy: Math.round(from.y), z: b.z, why: fail}; }
    if(/пауз/.test(fail)){ var q = st.np || (st.np = {}); q[k] = q[k] && q[k].last >= tick - 1 ? {n: q[k].n + 1, last: tick} : {n: 1, last: tick}; if(q[k].n > 3) hit('I-12', b, {n: q[k].n, why: fail}); } });
  // I-20: окно размена (tradeStart) кончилось без knowAvoidPeek у этого бота
  on('tradeStart', function(ph, A){ if(ph === 'in' && A[0]) (st.tr = st.tr || {})[A[0].id] = {t0: tick, until: tick + Math.round(3.5*TICK_HZ), avoided: false}; });
  on('knowAvoidPeek', function(ph, A){ if(ph === 'in' && A[0] && st.tr && st.tr[A[0].id]) st.tr[A[0].id].avoided = true; });
  // I-27: pickSpots без стороны в параметрах — кто зовёт (счётчик мест вызова)
  on('pickSpots', function(ph, A){ if(ph !== 'in') return; var o = A[3]; if(!(o && (o.team || o.side))){ var w = caller('pickSpots'); cnt('I-27', w, (((R['I-27'] || {}).hist || {})[w] || 0) + 1); } });
  // I-28: NADE_FAIL до и после nadeRunPlan различается
  on('nadeRunPlan', function(ph, A, r, s){ if(ph === 'in') return typeof NADE_FAIL !== 'undefined' ? NADE_FAIL : null; var now = typeof NADE_FAIL !== 'undefined' ? NADE_FAIL : null; if(live() && now !== s) hit('I-28', A[0], {before: s, after: now}); });
  // I-14: после resetRound — поля бота против исходных (BOT_INIT, 680): какие простые поля не вернулись (счётчик по полю; список раундовых
  // полей в определении не задан — решение по счётчику)
  on('resetRound', function(ph){ if(ph !== 'out' || typeof BOT_INIT === 'undefined') return;
    bots.forEach(function(b, i){ var I = BOT_INIT[i]; if(!I) return; Object.keys(I.vals).forEach(function(k){ if(b[k] !== I.vals[k]) cnt('I-14', k, ((((R['I-14'] || {}).hist) || {})[k] || 0) + 1); }); }); });

  // ---- каждый тик (после stepTick) ----
  function tick1(dt){
    if(dt > 50) hit('I-13', null, {ms: Math.round(dt), nadeTasks: bots.filter(function(b){ return b.alive && b.nadeTask; }).length});   // 50 мс — длинная задача браузера
    var L = live();
    bots.forEach(function(b){
      var p = prev[b.id] || (prev[b.id] = {});
      if(b.path && !(b.pathIdx >= 0 && b.pathIdx <= b.path.length)) hit('I-01', b, {idx: b.pathIdx, len: b.path.length});
      if(L && b.alive){
        if(b.curSpeed < 1 && !(b._stopWhy || (b._fc && b._fc.ph) || b.planting || b.defusing)) hit('I-02', b, {post: b.post && b.post.tag, state: b.state});
        if(!!b.walking !== (b._walkWhy != null)) hit('I-03', b, {walking: b.walking, why: b._walkWhy});
        if(b.post && b.post.tag === 'lineup'){ if(b.nadeTask) p.luOk = tick; else if(tick - (p.luOk == null ? tick : p.luOk) > 16) hit('I-04', b, {since: p.luOk}); } else p.luOk = null;
        if(b._probeLock >= tick - 1 && !(b.post && /^probe/.test(b.post.tag))) hit('I-05', b, {post: b.post && b.post.tag});
        if(typeof navOnFloor === 'function' && !navOnFloor(b.x, b.y, b)) hit('I-08', b, {x: Math.round(b.x), y: Math.round(b.y), z: b.z});
        if(Math.abs(b.facing) > Math.PI + 1e-9) hit('I-21', b, {facing: b.facing});
        if(b.holding){ var since = tick - (b._lastSeenEnemy || p.seen || 0); cnt('I-18', 'holding', since); }
        if(b._visible && b._visible.length) p.seen = tick;
        if(b._task){ var age = tick - b._task.t; if(age > TASK_STALE) cnt('I-17', String(b._task.tag).replace(/[:\d].*$/, ''), age); }
        // I-16: точная запись знания в этот тик без источника у команды
        [['lastIntel', b.lastIntel], ['heardSound', b.heardSound]].forEach(function(e){ var v = e[1]; if(!v || v.tick !== tick) return;
          var en = bots.filter(function(o){ return o.alive && o.team !== b.team && Math.hypot(o.x - v.x, o.y - v.y) < 50; })[0]; if(!en) return;
          var seen = bots.some(function(o){ return o.team === b.team && o.alive && (o._visible || []).some(function(x){ return x.id === en.id; }); });
          if(!seen && v.src !== 'call' && v.kind !== 'call' && v.kind !== 'hit') hit('I-16', b, {field: e[0], src: v.src, kind: v.kind, enemy: en.id}); });
        // I-25: «видел» записан как звук; перезапись колла звуком ≤ 1 с (64 тика = TICK_HZ) — счётчик
        var hs = b.heardSound; if(hs && hs !== p.hs){ if(p.hs && p.hs.kind === 'call' && hs.kind !== 'call' && hs.tick - p.hs.tick <= TICK_HZ) hit('I-25', b, {from: 'call', to: hs.kind});
          if(hs.tick === tick && hs.kind !== 'call' && hs.kind !== 'hit' && (b._visible || []).some(function(x){ return x.id === hs.src; })) hit('I-25', b, {seen: hs.src, kind: hs.kind}); p.hs = hs; }
      }
      p.x = b.x; p.y = b.y;
    });
    // I-09, I-10 — по журналу сторожа движения (545: перенос «nav», застревание «stall»)
    var PE = (typeof PROB !== 'undefined' && PROB.ev) || [], from = st.pe || 0;
    for(var i = from; i < PE.length; i++){ var e = PE[i]; if(e.kind === 'nav') hit('I-09', {id: e.id}, {text: e.text});
      if(e.kind === 'stall'){ var w = (st.stall = st.stall || {}), a = (w[e.id] = (w[e.id] || []).filter(function(t){ return e.tick - t < 5*TICK_HZ; })); a.push(e.tick); if(a.length > 2) hit('I-10', {id: e.id}, {inFiveSec: a.length}); } }
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
