// Сценарии этапа 3: node src/q.js <сборка.html> "$(cat tools/measure/audit/scenarios3.js)" → JSON {сценарий: {ok, ...}}
// Сценарий засчитывается, только если нужное событие действительно произошло (поле valid).
(function(){
  var R = {};
  function bot(id){ return bots.filter(function(b){ return b.id === id; })[0]; }

  // P1-4 (г): путь через свой молотов. Первоначальный случай — матч 3, тик 23300: T1 (siteholdA) шёл к точке сквозь молотов T2,
  // 1,5 с у края, затем «рывок от застревания» на 33 px — в огонь (13 HP). Поскольку игра после правок расходится, случай ищется:
  // первый момент в матчах 3/7/11, когда живой бот у своего огня (≤ радиус+60 px, не в нём), огню гореть ещё ≥ 3 с, а прямая к его
  // точке (post) проходит сквозь огонь. Дальше 900 тиков: не должен заходить в огонь и не должен застрять навсегда
  function segCirc(x1, y1, x2, y2, cx, cy, r){ var dx = x2-x1, dy = y2-y1, L = dx*dx+dy*dy || 1, t = Math.max(0, Math.min(1, ((cx-x1)*dx+(cy-y1)*dy)/L)); return Math.hypot(x1+t*dx-cx, y1+t*dy-cy) < r; }
  try {
    var hit = null;
    [3, 7, 11].forEach(function(mn){
      if(hit) return; freshMatch(mn);
      for(var i = 0; i < 400000 && !hit && matchNum === mn; i++){
        stepTick(); if(roundState !== "live" || tick % 16) continue;
        fires.forEach(function(f){ if(hit || f.until - tick < 3*TICK_HZ) return;
          bots.forEach(function(o){ if(hit || !o.alive || o.team !== f.team || !o.post || inFire(o.x, o.y)) return;
            var d = Math.hypot(o.x-f.x, o.y-f.y); if(d > NADE.molly.radius + 60) return;
            if(Math.hypot(o.post.x-o.x, o.post.y-o.y) > d + 60 && segCirc(o.x, o.y, o.post.x, o.post.y, f.x, f.y, NADE.molly.radius*0.8)) hit = {match: mn, tick: tick, id: o.id, f: f, tag: o.post.tag}; }); });
      }
    });
    if(!hit) throw new Error("случай не найден");
    var b = bot(hit.id), x0 = b.x, y0 = b.y, inF = 0, moved = null, hp0 = b.hp, f = hit.f;
    for(var i = 0; i < 900 && b.alive; i++){ stepTick(); if(inFire(b.x, b.y)) inF++; if(moved === null && Math.hypot(b.x-x0, b.y-y0) > 40) moved = tick; }
    R.molly_path_through_own_fire = {ok: inF === 0 && moved !== null && moved <= f.until + 2*TICK_HZ, valid: true, at: hit.match + ":" + hit.tick + " " + hit.id + " " + hit.tag,
      ticksInFire: inF, movedAt: moved, fireUntil: f.until, hpLost: hp0 - b.hp};
  } catch(e){ R.molly_path_through_own_fire = {ok: false, valid: false, err: String(e).slice(0, 200)}; }

  // P1-4 (а): огонь загорелся прямо под своим (стоял в зоне при поджоге). Должен выйти обычным бегом к краю, не стоять в огне.
  // Порог — время пробежать радиус огня + 28 px (точка выхода в коде) на скорости его оружия, ×1,5 на разгон и обход
  try {
    freshMatch(3); for(var i = 0; i < 5000 && roundState !== "live"; i++) stepTick(); for(var j = 0; j < 64; j++) stepTick();
    var mt = bots.filter(function(o){ return o.team === "T" && o.alive && !inFire(o.x, o.y) && !smokes.some(function(q){ return Math.hypot(q.x-o.x, q.y-o.y) < 200; }); })[1], th = bots.filter(function(o){ return o.team === "T" && o.alive && o !== mt; })[0];
    detonate({type: "molly", x: mt.x, y: mt.y, team: "T", thrower: th, why: "тест"});
    var f = fires.filter(function(q){ return q.thrower === th && q.born === tick; })[0], inF = 0, hp0 = mt.hp, out = null;
    for(var k = 0; k < 6*TICK_HZ && mt.alive; k++){ stepTick(); if(inFire(mt.x, mt.y)) inF++; else if(out === null) out = k; }
    var lim = 1.5*(NADE.molly.radius + 28)/(SPEED*weaponSpeedMul(mt))*TICK_HZ;
    R.molly_ignited_on_mate = {ok: f && out !== null && out <= lim, valid: !!f, ticksToExit: out, limit: Math.round(lim), ticksInFire: inF, hpLost: hp0 - mt.hp, fireCommit: fireCommit(mt)};
  } catch(e){ R.molly_ignited_on_mate = {ok: false, err: String(e).slice(0, 200)}; }

  // P1-4 (в): fireCommit — идти сквозь огонь можно только ради цели (дефуз / плант / ретейк) и если хватит HP пройти диаметр.
  // Проверка самого решения: та же цель, полное HP — можно; HP меньше урона за проход + 10 — нельзя; держит угол — нельзя
  try {
    freshMatch(3); for(var i = 0; i < 5000 && roundState !== "live"; i++) stepTick(); for(var j = 0; j < 64; j++) stepTick();
    var c = bots.filter(function(o){ return o.team === "CT" && o.alive; })[0], hp0 = c.hp, hold0 = c.holding, post0 = c.post;
    c.post = {x: c.x + 500, y: c.y, tag: "retake"}; c.holding = false;
    var need = 2*NADE.molly.radius/(SPEED*weaponSpeedMul(c))*NADE.molly.dps + 10;
    c.hp = 100; var full = fireCommit(c); c.hp = Math.floor(need) - 1; var low = fireCommit(c); c.hp = 100; c.holding = true; var held = fireCommit(c);
    c.hp = hp0; c.holding = hold0; c.post = post0;
    R.molly_firecommit_rule = {ok: full === true && low === false && held === false, valid: true, fullHp: full, lowHp: low, holding: held, hpNeeded: Math.round(need)};
  } catch(e){ R.molly_firecommit_rule = {ok: false, err: String(e).slice(0, 200)}; }

  // P2-2: своя флешка. Настоящий бросок (throwNade) T2 → хлопок; T3 (свой) и CT2 (враг) смотрят на точку хлопка (худший случай).
  // Засчитывается, только если хлопок случился и враг действительно ослеп (флешка «рабочая»). Ищем место, где свой далеко от
  // бросающего (>450 px) и не видит его — тогда знать о флешке он может только из колла «флешу!».
  function park2(keep){ bots.forEach(function(o){ if(keep.indexOf(o) >= 0) return; o.x = o.baseX = (o.team === "CT" ? CT_SPAWN.x : T_SPAWN.x); o.y = o.baseY = (o.team === "CT" ? CT_SPAWN.y : T_SPAWN.y); }); }
  function put2(o, p){ o.x = o.baseX = p.x; o.y = o.baseY = p.y; o.px = p.x; o.py = p.y; o.curSpeed = 0; o.hp = 100000; }
  function sees(a, b){ return hasVision(a.x, a.y, b.x, b.y) && !insideSolidWall(b.x, b.y) && bzOf(b.x, b.y) >= 0; }
  function flashGeo(wantCover){
    for(var k = 0; k < 20000; k++){
      var z = NAVAREAS[Math.floor(hashRand(k*7+5)*NAVAREAS.length)], s0 = zoneCentroid(z), an = hashRand(k*3+2)*Math.PI*2;
      if(insideSolidWall(s0.x, s0.y) || bzOf(s0.x, s0.y) < 0) continue;
      var pt = {x: s0.x + Math.cos(an)*300, y: s0.y + Math.sin(an)*300}; if(!sees(s0, pt)) continue;
      var a2 = an + (hashRand(k*5+3)-0.5)*2.4, m = {x: pt.x + Math.cos(a2)*300, y: pt.y + Math.sin(a2)*300};
      if(bzOf(m.x, m.y) < 0 || insideSolidWall(m.x, m.y)) continue;
      if(Math.hypot(m.x-s0.x, m.y-s0.y) < 480 || hasVision(m.x, m.y, s0.x, s0.y)) continue;
      if(wantCover ? hasVision(m.x, m.y, pt.x, pt.y) : !sees(pt, m)) continue;
      var e = null;   // враг видит точку хлопка, но никто из T не видит его — канал свободен
      for(var q = 0; q < 40 && !e; q++){ var a3 = hashRand(k*13+q*7)*Math.PI*2, r3 = 200 + hashRand(k*17+q*3)*400, c = {x: pt.x + Math.cos(a3)*r3, y: pt.y + Math.sin(a3)*r3};
        if(sees(pt, c) && !hasVision(s0.x, s0.y, c.x, c.y) && !hasVision(m.x, m.y, c.x, c.y)) e = c; }
      if(!e) continue;
      return {s: s0, pt: pt, m: m, e: e};
    }
    throw new Error("нет геометрии");
  }
  function flashCase(mode){   // mode: warned / silent / late / cover
    freshMatch(3); for(var i = 0; i < 5000 && roundState !== "live"; i++) stepTick(); for(var j = 0; j < 64; j++) stepTick();
    var th = bot("T2"), mt = bot("T3"), en = bot("CT2"), G = flashGeo(mode === "cover"); park2([th, mt, en]);
    var P = function(){ put2(th, G.s); put2(mt, G.m); put2(en, G.e); [th, mt, en].forEach(function(o){ o.blindUntil = 0; o.decisionTick = tick + 100000; o.throwUntil = 0; }); };
    P(); th.nades.flash = 1;
    var pop = null, od = detonate;
    detonate = function(n){ if(n.type === "flash" && n.thrower === th){ [mt, en].forEach(function(o){ o.facing = Math.atan2(n.y-o.y, n.x-o.x); }); var r = od.apply(this, arguments);
      pop = {tick: tick, x: n.x, y: n.y, warned: n.warned ? n.warned[mt.id] : undefined, mateAware: !!(n.aware && n.aware[mt.id]), mateSees: hasVision(mt.x, mt.y, n.x, n.y),
             mate: +Math.max(0, (mt.blindUntil - tick)/TICK_HZ).toFixed(2), enemy: +Math.max(0, (en.blindUntil - tick)/TICK_HZ).toFixed(2), thrower: +Math.max(0, (th.blindUntil - tick)/TICK_HZ).toFixed(2)}; return r; } return od.apply(this, arguments); };
    var T = teamOf("T");
    if(mode === "silent") th.voice = null;                                       // не сказал
    if(mode === "late") T.speaking = {msg: {kind: "see", by: "T4", text: "…", zone: null}, end: tick + 2*TICK_HZ};  // канал занят дольше полёта
    var ok0 = throwNade(th, "flash", G.pt.x, G.pt.y, false, "тест");
    for(var t = 0; t < 4*TICK_HZ && !pop; t++){ stepTick(); P(); }
    var d = 0; for(; d < 3*TICK_HZ; d++){ stepTick(); P(); }
    detonate = od;
    var valid = ok0 && !!pop && pop.enemy > 0.35 && (mode === "cover" ? !pop.mateSees : pop.mateSees) && !pop.mateAware;
    return {valid: valid, pop: pop};
  }
  try {
    var c1 = flashCase("warned");
    R.flash_mate_warned = {ok: c1.valid && c1.pop.warned !== undefined && c1.pop.warned <= c1.pop.tick && c1.pop.mate < c1.pop.enemy, valid: c1.valid, pop: c1.pop};
  } catch(e){ R.flash_mate_warned = {ok: false, err: String(e).slice(0, 200)}; }
  try {
    var c2 = flashCase("silent");
    R.flash_mate_unwarned = {ok: c2.valid && c2.pop.warned === undefined && c2.pop.mate > 0.35, valid: c2.valid, pop: c2.pop};
  } catch(e){ R.flash_mate_unwarned = {ok: false, err: String(e).slice(0, 200)}; }
  try {
    var c3 = flashCase("late");
    R.flash_mate_heard_late = {ok: c3.valid && c3.pop.warned === undefined && c3.pop.mate > 0.35, valid: c3.valid, pop: c3.pop};
  } catch(e){ R.flash_mate_heard_late = {ok: false, err: String(e).slice(0, 200)}; }
  try {
    var c4 = flashCase("cover");
    R.flash_mate_behind_cover = {ok: c4.valid && c4.pop.mate === 0, valid: c4.valid, pop: c4.pop};
  } catch(e){ R.flash_mate_behind_cover = {ok: false, err: String(e).slice(0, 200)}; }

  // P1-1: смена сайта A→B и B→A в нескольких раундах с тактикой групп (матчи 3 и 7). Через 5 с после смены у каждого живого T —
  // куда ведут пост, маршрут и граната-задание. Классы: лёркер (по роли играет отдельно) / подбор бомбы у старого сайта (fetch,
  // бомба лежит там) / мид (цель почти на равном расстоянии от сайтов, <100 px разницы) / граната до смены / граната после смены /
  // НЕ объяснено ролью (не лёркер, не бомба, не мид — цель ближе к старому сайту). ok — «не объяснено» нет ни у кого.
  try {
    var rows = [], cnt = {}, unexpl = [];
    [3, 7].forEach(function(mn){
      freshMatch(mn); var done = {}, nRounds = 0;
      for(var i = 0; i < 400000 && matchNum === mn && nRounds < 4; i++){
        stepTick();
        var tt = teamTac.T;
        if(roundState !== "live" || done[roundNum] || tick - roundStartTick !== 6*TICK_HZ || !tt || !tt.tac || !tt.tac.groups || tt.phase !== "setup" || tt.defUntil) continue;
        done[roundNum] = true; nRounds++;
        var old = tt.site, nw = old === "A" ? "B" : "A", t0 = tick;
        tSetSite(tt, nw);
        for(var k = 0; k < 5*TICK_HZ && roundState === "live"; k++) stepTick();
        if(roundState !== "live") continue;
        var dS = function(p, s){ return Math.hypot(p.x-SITES[s].x, p.y-SITES[s].y); };
        bots.forEach(function(b){
          if(b.team !== "T" || !b.alive) return;
          var tgts = [];
          if(b.post) tgts.push(["пост", b.post]);
          if(b._route && b._route.pts.length) tgts.push(["маршрут", b._route.pts[b._route.pts.length-1]]);
          if(b.nadeTask) tgts.push(["граната", b.nadeTask]);
          tgts.forEach(function(T2){
            var p = T2[1], dO = dS(p, old), dN = dS(p, nw); if(dO >= dN) return;
            var tag = b.post ? String(b.post.tag) : "";
            var cls = b.tRole === "lurker" ? "лёркер" :
                      (/^fetch/.test(tag) && bomb && bomb.state === "dropped" && dS(bomb, old) < dS(bomb, nw)) ? "бомба у старого сайта" :
                      (dN - dO < 100 || /mid/i.test(tag)) ? "мид / нейтрально" :
                      (T2[0] === "пост" && /^lineup/.test(tag) && b.nadeTask) ? "место броска гранаты" :
                      T2[0] === "граната" ? ((b.nadeTask.start || 0) < t0 ? "граната до смены" : "граната после смены") : "НЕ объяснено";
            cnt[cls] = (cnt[cls] || 0) + 1;
            var row = mn + ":" + roundNum + " " + old + "→" + nw + " " + b.id + "(" + b.tRole + ") " + T2[0] + " " + tag.slice(0, 20) + (T2[0] === "граната" ? " " + b.nadeTask.type + ":" + String(b.nadeTask.why || "").slice(0, 24) : "") + " → " + cls;
            rows.push(row); if(cls === "НЕ объяснено" || cls === "граната до смены") unexpl.push(row);
          });
        });
      }
    });
    R.switch_residual_classified = {ok: unexpl.length === 0, valid: rows.length >= 0, classes: cnt, unexplained: unexpl, rows: rows.slice(0, 40)};
  } catch(e){ R.switch_residual_classified = {ok: false, err: String(e).slice(0, 200)}; }

  // P2-1: взгляд на угол при переминании. Держащий позицию (atPost, точка взгляда поста не видна напрямую) сдвигается поперёк
  // взгляда на ±24 px шагами по 6 px (туда и обратно, как idle strafe). На каждом шаге — cornerLook(b, post.look). Поворот ≥ 20°
  // между соседними шагами записывается с причиной: «цель стала видна / перестала» (hasLOS до точки поста переключился),
  // «старый угол потерял видимость» (кэш _cornerPt больше не виден), «пересчёт» (иначе). Новой инфы нет (враги не двигаются,
  // пост и цель те же) — значит любой такой поворот лишний.
  try {
    var J = [], nH = 0, causes = {}, pairs = 0;
    [3, 7].forEach(function(mn){
      freshMatch(mn); var seen = {};
      for(var i = 0; i < 300000 && matchNum === mn && Object.keys(seen).length < 8; i++){
        stepTick();
        if(roundState !== "live" || tick - roundStartTick !== 25*TICK_HZ || seen[roundNum]) continue;
        seen[roundNum] = true;
        bots.forEach(function(b){
          if(!b.alive || !b.atPost || !b.post || !b.post.look) return;
          var L = b.post.look; if(hasLOS(b.x, b.y, L.x, L.y)) return;
          nH++;
          var bx = b.x, by = b.y, Hh = b._hold && b._hold.post === b.post ? b._hold : null;   // сдвиги — от точки, где встал (как idle strafe)
          var x0 = Hh ? Hh.ax : b.x, y0 = Hh ? Hh.ay : b.y, cpk = b._cornerPK, cpt = b._cornerPt, a = Math.atan2(L.y-y0, L.x-x0), px = -Math.sin(a), py = Math.cos(a);
          var offs = []; for(var o = 0; o <= 24; o += 6) offs.push(o); for(o = 18; o >= -24; o -= 6) offs.push(o); for(o = -18; o <= 0; o += 6) offs.push(o);
          var prev = null, prevVis = null;
          offs.forEach(function(o){
            var nx = x0 + px*o, ny = y0 + py*o; if(insideSolidWall(nx, ny)) return;
            b.x = nx; b.y = ny;
            var oldPt = b._cornerPt, oldOk = oldPt && hasLOS(nx, ny, oldPt.x, oldPt.y), vis = hasLOS(nx, ny, L.x, L.y);
            var q = cornerLook(b, L); if(!q) return;
            var ang = Math.atan2(q.y-ny, q.x-nx);
            if(prev !== null){ pairs++; var d = Math.abs(((ang-prev+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*180/Math.PI;
              if(d >= 20){ var c = vis !== prevVis ? "цель стала видна/перестала" : (oldPt && !oldOk) ? "старый угол потерял видимость" : "пересчёт";
                causes[c] = (causes[c] || 0) + 1; if(J.length < 12) J.push(mn + ":" + roundNum + " " + b.id + " " + b.post.tag + " сдвиг " + o + " px: " + Math.round(d) + "° — " + c); } }
            prev = ang; prevVis = vis;
          });
          b.x = bx; b.y = by; b._cornerPK = cpk; b._cornerPt = cpt;
        });
      }
    });
    var nJ = Object.keys(causes).reduce(function(s2, k){ return s2 + causes[k]; }, 0);
    R.cornerlook_microshift = {ok: nJ === 0, valid: nH > 0, holders: nH, steps: pairs, turns20: nJ, causes: causes, examples: J};
  } catch(e){ R.cornerlook_microshift = {ok: false, err: String(e).slice(0, 200)}; }

  return JSON.stringify(R);
})()
