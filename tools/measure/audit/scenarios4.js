// Сценарии этапа 4: node src/q.js <сборка.html> "$(cat tools/measure/audit/scenarios4.js)" → JSON {сценарий: {ok, valid, ...}}
// Засчитывается, только если нужное событие действительно случилось (valid).
(function(){
  var R = {};
  function bot(id){ return bots.filter(function(b){ return b.id === id; })[0]; }
  function live(m){ freshMatch(m || 3); for(var i = 0; i < 5000 && roundState !== "live"; i++) stepTick(); for(var j = 0; j < 64; j++) stepTick(); }
  function park(keep){ bots.forEach(function(o){ if(keep.indexOf(o) >= 0) return; o.x = o.baseX = (o.team === "CT" ? CT_SPAWN.x : T_SPAWN.x); o.y = o.baseY = (o.team === "CT" ? CT_SPAWN.y : T_SPAWN.y); }); }
  function put(o, p){ o.x = o.baseX = p.x; o.y = o.baseY = p.y; o.px = p.x; o.py = p.y; o.curSpeed = 0; }
  function openSpot(minR){   // точка, от которой влево и вправо на minR px нет стен (бросок по прямой не отскочит)
    for(var k = 0; k < 6000; k++){
      var z = NAVAREAS[Math.floor(hashRand(k*7+3)*NAVAREAS.length)], c = zoneCentroid(z), ok = !insideSolidWall(c.x, c.y) && bzOf(c.x, c.y) >= 0;
      for(var a = 0; a < 2 && ok; a++){ var q = {x: c.x + (a ? -minR : minR), y: c.y}; if(insideSolidWall(q.x, q.y) || crossesWall(c.x, c.y, q.x, q.y)) ok = false; }
      if(ok) return c;
    }
    throw new Error("нет открытого места");
  }

  // P1 (молотов) (а): бросающий не кидает молотов себе под ноги. Прямой бросок в точку в 79 px (как опорник CT «задержать
  // выход», матч 41, тик 6073): огонь вспыхивает на ~27 px ближе цели, т. е. в ~52 px — внутри радиуса 72. Должен не бросить.
  // Контроль: тот же бросок в 220 px — бросает, и огонь не под ним.
  try {
    live(3); var th = bot("CT0"), p = openSpot(260); park([th]); put(th, p); th.nades.molly = 2;
    var r1 = throwNade(th, "molly", p.x + 79, p.y, false, "тест: под ноги");
    var fire1 = null; for(var i = 0; i < 120 && !fire1; i++){ stepTick(); put(th, p); fire1 = fires.filter(function(f){ return f.thrower === th; })[0] || null; }
    var r2 = throwNade(th, "molly", p.x - 220, p.y, false, "тест: далеко");
    var fire2 = null; for(var j = 0; j < 160 && !fire2; j++){ stepTick(); put(th, p); fire2 = fires.filter(function(f){ return f.thrower === th && f !== fire1; })[0] || null; }
    var d1 = fire1 ? Math.round(Math.hypot(fire1.x-p.x, fire1.y-p.y)) : null, d2 = fire2 ? Math.round(Math.hypot(fire2.x-p.x, fire2.y-p.y)) : null;
    R.molly_thrower_not_at_feet = {ok: r1 === false && !fire1 && r2 !== false && !!fire2 && d2 >= NADE.molly.radius, valid: r2 !== false && !!fire2,
      nearThrow: r1 !== false, nearFireDist: d1, farFireDist: d2, radius: NADE.molly.radius};
  } catch(e){ R.molly_thrower_not_at_feet = {ok: false, err: String(e).slice(0, 200)}; }

  // (б): тиммейт стоит там, куда молотов реально упадёт (на 27 px ближе цели), хотя сама цель от него дальше радиуса —
  // бросок не должен состояться. Раньше проверялась только точка цели.
  try {
    live(3); var th2 = bot("CT1"), mt = bot("CT2"), p2 = openSpot(300); park([th2, mt]); put(th2, p2); th2.nades.molly = 1;
    var tgt = {x: p2.x + 200, y: p2.y}, land = {x: p2.x + 200 - 70/TICK_HZ/(1-0.96), y: p2.y};
    put(mt, {x: land.x - 50, y: land.y});   // до точки падения 50 (< 72), до цели 77 (> 72)
    var dT = Math.round(Math.hypot(mt.x-tgt.x, mt.y-tgt.y)), dL = Math.round(Math.hypot(mt.x-land.x, mt.y-land.y));
    var r3 = throwNade(th2, "molly", tgt.x, tgt.y, false, "тест: тиммейт у точки падения");
    var hit = 0; for(var k = 0; k < 200; k++){ stepTick(); put(th2, p2); put(mt, {x: land.x - 50, y: land.y}); if(inFire(mt.x, mt.y)) hit++; }
    R.molly_mate_at_real_landing = {ok: r3 === false && hit === 0, valid: dT > NADE.molly.radius && dL < NADE.molly.radius, thrown: r3 !== false, mateTicksInFire: hit, mateToTarget: dT, mateToLanding: dL};
  } catch(e){ R.molly_mate_at_real_landing = {ok: false, err: String(e).slice(0, 200)}; }

  // P1 (взгляд): запомненный угол cornerLook оказался точкой под ногами (бот потом встал туда, куда «смотрел» по пути:
  // repos:assist, матч 3, раунд 6, T1 — угол = место поста, повороты 78–152° при сдвиге на 6 px). Такой угол не должен
  // браться из памяти: как и новый, он должен быть дальше 30 px. Проверка на всех держащих пост, чья точка взгляда не видна
  try {
    var nH = 0, stale = 0, ex = [];
    [3, 7].forEach(function(mn){
      freshMatch(mn); var seen = {};
      for(var i = 0; i < 300000 && matchNum === mn && Object.keys(seen).length < 6; i++){
        stepTick();
        if(roundState !== "live" || tick - roundStartTick !== 25*TICK_HZ || seen[roundNum]) continue;
        seen[roundNum] = true;
        bots.forEach(function(b){
          if(!b.alive || !b.atPost || !b.post || !b.post.look || hasLOS(b.x, b.y, b.post.look.x, b.post.look.y)) return;
          var L = b.post.look, cpk = b._cornerPK, cpt = b._cornerPt;
          b._cornerPK = Math.round(L.x/80) + "," + Math.round(L.y/80); b._cornerPt = {x: b.x + 4, y: b.y};   // «угол» под ногами
          var q = cornerLook(b, L); nH++;
          if(q && Math.hypot(q.x-b.x, q.y-b.y) <= 30){ stale++; if(ex.length < 5) ex.push(mn + ":" + roundNum + " " + b.id + " " + b.post.tag); }
          b._cornerPK = cpk; b._cornerPt = cpt;
        });
      }
    });
    R.cornerlook_stale_point_at_feet = {ok: nH > 0 && stale === 0, valid: nH > 0, holders: nH, keptPointAtFeet: stale, examples: ex};
  } catch(e){ R.cornerlook_stale_point_at_feet = {ok: false, err: String(e).slice(0, 200)}; }

  // P2 (смена сайта): то же, что switch_residual_classified этапа 3, но направление B→A и случай «бомба лежит у старого
  // сайта» (бомбу роняют на полпути от носителя к старому сайту в момент смены). Классы: лёркер / бомба у старого сайта /
  // мид-нейтрально (<100 px разницы или тег mid) / место броска гранаты / граната до смены / граната после смены / НЕ объяснено
  function switchCases(matches, dir, bombOld, need){
    var rows = [], cnt = {}, bad = [], cases = 0, fetched = 0;
    var dS = function(p, s2){ return Math.hypot(p.x-SITES[s2].x, p.y-SITES[s2].y); };
    for(var mi = 0; mi < matches.length && cases < need; mi++){
      freshMatch(matches[mi]); var done = {};
      for(var i = 0; i < 400000 && matchNum === matches[mi] && cases < need; i++){
        stepTick(); var tt = teamTac.T;
        if(roundState !== "live" || done[roundNum] || tick - roundStartTick !== 6*TICK_HZ || !tt || !tt.tac || !tt.tac.groups || tt.phase !== "setup" || tt.defUntil) continue;
        done[roundNum] = true;
        var old = tt.site; if(dir && old !== dir[0]) continue;
        var nw = old === "A" ? "B" : "A", t0 = tick;
        if(bombOld){
          var c = bomb && bomb.state === "carried" ? bomb.carrier : null; if(!c) continue;
          var bp = null; for(var f = 0.6; f >= 0.2 && !bp; f -= 0.1){ var q = {x: c.x + (SITES[old].x-c.x)*f, y: c.y + (SITES[old].y-c.y)*f}; if(!insideSolidWall(q.x, q.y) && bzOf(q.x, q.y) >= 0) bp = q; }
          if(!bp) continue;
          bomb.state = "dropped"; bomb.carrier = null; bomb.x = bp.x; bomb.y = bp.y;
        }
        cases++; tSetSite(tt, nw);
        var handled = false;   // за 5 с бомбу подняли или за ней назначен кто-то (tt.fetchId; назначенный мог погибнуть по пути)
        for(var k = 0; k < 5*TICK_HZ && roundState === "live"; k++){ stepTick(); if(bombOld && bomb && (bomb.state === "carried" || tt.fetchId)) handled = true; }
        if(roundState !== "live") continue;
        if(handled) fetched++;
        bots.forEach(function(b){
          if(b.team !== "T" || !b.alive) return;
          var tg = [];
          if(b.post) tg.push(["пост", b.post]);
          if(b._route && b._route.pts.length) tg.push(["маршрут", b._route.pts[b._route.pts.length-1]]);
          if(b.nadeTask) tg.push(["граната", b.nadeTask]);
          tg.forEach(function(T2){
            var p = T2[1], dO = dS(p, old), dN = dS(p, nw); if(dO >= dN) return;
            var tag = b.post ? String(b.post.tag) : "";
            var cls = b.tRole === "lurker" ? "лёркер" :
                      (bomb && (bomb.carrier === b || /^fetch/.test(tag)) && dS(bomb, old) < dS(bomb, nw)) ? "бомба у старого сайта" :
                      (dN - dO < 100 || /mid/i.test(tag)) ? "мид / нейтрально" :
                      (T2[0] === "пост" && /^lineup/.test(tag) && b.nadeTask) ? "место броска гранаты" :
                      T2[0] === "граната" ? ((b.nadeTask.start || 0) < t0 ? "граната до смены" : "граната после смены") : "НЕ объяснено";
            cnt[cls] = (cnt[cls] || 0) + 1;
            var row = matches[mi] + ":" + roundNum + " " + old + "→" + nw + " " + b.id + "(" + b.tRole + ") " + T2[0] + " " + tag.slice(0, 20) + (T2[0] === "граната" ? " " + b.nadeTask.type + ":" + String(b.nadeTask.why || "").slice(0, 24) : "") + " → " + cls;
            rows.push(row); if(cls === "НЕ объяснено" || cls === "граната до смены") bad.push(row);
          });
        });
      }
    }
    return {cases: cases, classes: cnt, unexplained: bad, rows: rows.slice(0, 30), bombHandled: fetched};
  }
  try {
    var S1 = switchCases([3, 7, 11, 13, 17, 19, 23], "B", false, 4);
    R.switch_B_to_A = {ok: S1.cases >= 1 && S1.unexplained.length === 0, valid: S1.cases >= 1, cases: S1.cases, classes: S1.classes, unexplained: S1.unexplained, rows: S1.rows};
  } catch(e){ R.switch_B_to_A = {ok: false, err: String(e).slice(0, 200)}; }
  try {
    var S2 = switchCases([3, 7, 11], null, true, 4);
    R.switch_bomb_at_old_site = {ok: S2.cases >= 1 && S2.unexplained.length === 0 && S2.bombHandled === S2.cases, valid: S2.cases >= 1, cases: S2.cases, bombHandled: S2.bombHandled, classes: S2.classes, unexplained: S2.unexplained, rows: S2.rows};
  } catch(e){ R.switch_bomb_at_old_site = {ok: false, err: String(e).slice(0, 200)}; }

  return JSON.stringify(R);
})()
