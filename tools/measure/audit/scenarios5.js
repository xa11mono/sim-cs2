// Сценарии аудита командной игры (v272): node src/q.js <сборка.html> "$(cat tools/measure/audit/scenarios5.js)" → JSON {сценарий: {ok, valid, ...}}
// Засчитывается, только если нужное событие действительно случилось (valid).
(function(){
  var R = {};
  function bot(id){ return bots.filter(function(b){ return b.id === id; })[0]; }
  function live(m){ freshMatch(m || 3); for(var i = 0; i < 5000 && roundState !== "live"; i++) stepTick(); for(var j = 0; j < 64; j++) stepTick(); }
  function park(keep){ bots.forEach(function(o){ if(keep.indexOf(o) >= 0) return; o.x = o.baseX = (o.team === "CT" ? CT_SPAWN.x : T_SPAWN.x); o.y = o.baseY = (o.team === "CT" ? CT_SPAWN.y : T_SPAWN.y); }); }
  function put(o, p){ o.x = o.baseX = p.x; o.y = o.baseY = p.y; o.px = p.x; o.py = p.y; o.curSpeed = 0; }
  function openSpot(minR){
    for(var k = 0; k < 6000; k++){
      var z = NAVAREAS[Math.floor(hashRand(k*7+3)*NAVAREAS.length)], c = zoneCentroid(z), ok = !insideSolidWall(c.x, c.y) && bzOf(c.x, c.y) >= 0;
      for(var a = 0; a < 2 && ok; a++){ var q = {x: c.x + (a ? -minR : minR), y: c.y}; if(insideSolidWall(q.x, q.y) || crossesWall(c.x, c.y, q.x, q.y)) ok = false; }
      if(ok && !hasLOS(c.x - minR, c.y, c.x + minR, c.y)) ok = false;
      if(ok) return c;
    }
    throw new Error("нет открытого места");
  }
  var voice = [];
  var clr = [];
  var omc = markClear; markClear = function(team, x, y, who){ clr.push({t: tick, who: who, team: team}); return omc.apply(this, arguments); };
  var ovl = voiceLog; voiceLog = function(team, key, who, text){ voice.push({t: tick, team: team, who: who, text: text}); return ovl.apply(this, arguments); };

  // П1. Эпизод владельца: матч 1, тик 6640, CT 5 и 9 (CT0, CT4) идут подпушивать мейн A. Пусто — проба доходит дальше
  // входа (E.deep > 0) и говорит «чекнул … — пусто»; знание команды: у остальных CT гипотезы о T в этой зоне ослабли.
  try {
    freshMatch(1); voice = [];
    while(tick < 6640 && matchNum === 1) stepTick();
    voice = []; clr = []; var t0 = tick;
    var rr = roundNum, seen = {}, deep = {}, cleared = null, othersW = null, ended = {};
    for(var i = 0; i < 40*TICK_HZ && roundNum === rr; i++){
      stepTick();
      bots.forEach(function(b){ if(b.team !== "CT" || !b._early || b._early.round !== roundNum) return;
        if(b.post && b.post.tag === "earlyPeek" && b.atPost) seen[b.id] = 1; if(b._early.deep) deep[b.id] = Math.max(deep[b.id] || 0, b._early.deep);
        if(seen[b.id] && b._early.st === 2 && !ended[b.id]) ended[b.id] = (b._early.deepDone ? "дошёл до конца" : "") + (teamTac.CT && teamTac.CT.call ? " / колл команды " + teamTac.CT.call.site : "") + (b._sawEnemy ? " / контакт" : "") + " @" + ((tick-roundStartTick)/TICK_HZ).toFixed(1) + "с"; });
      if(!cleared){ var v = voice.filter(function(q){ return q.team === "CT" && /^чекнул .* — пусто$/.test(q.text) && seen[q.who]; })[0];
        if(v){ cleared = v; othersW = Object.keys(CLEARZ.CT).map(function(z){ return zoneUserName(z); }); } }
    }
    var endOk = Object.keys(ended).some(function(id){ return /колл|контакт/.test(ended[id]); });
    R.probe_ct_main_episode = {ok: Object.keys(deep).length > 0 && ((!!cleared && cleared.t >= t0) || endOk), ended: ended, valid: Object.keys(seen).length > 0, peekers: Object.keys(seen),
      deep: deep, call: cleared ? cleared.who + " @" + ((cleared.t - roundStartTick)/TICK_HZ).toFixed(1) + "с: " + cleared.text : null, teamClearZones: othersW, roundSec: ((t0 - roundStartTick)/TICK_HZ).toFixed(1)};
  } catch(e){ R.probe_ct_main_episode = {ok: false, err: String(e).slice(0, 200)}; }

  // П1 (все подпуши): матчи 3, 7, 11, по 4 раунда — каждая начатая проба (CT «выгляну за инфой», T «подпушу …») в течение 25 с
  // кончается инфой: «чекнул … — пусто» того же бота, или контакт (увидел врага), или смерть (команда узнаёт по киллфиду).
  try {
    var tot = 0, info = 0, list = [], ev = [];
    [3, 7, 11].forEach(function(m){
      freshMatch(m); voice = []; ev = []; clr = []; var chg = [], pc = null, pp = null;
      for(var i = 0; i < 4*120*TICK_HZ && matchNum === m; i++){
        var r0 = roundNum; stepTick();
        if(roundState === "live") bots.forEach(function(b){ if(b._sawEnemy || !b.alive) ev.push({who: b.id, t: tick}); });
        var cc = teamTac.CT && teamTac.CT.call ? teamTac.CT.call.site : null, tp = teamTac.T ? teamTac.T.phase : null;
        if(cc && cc !== pc) chg.push({team: "CT", t: tick}); if(tp !== pp && pp === "setup") chg.push({team: "T", t: tick}); pc = cc; pp = tp;
        if(roundNum !== r0 || i === 4*120*TICK_HZ - 1){
          voice.filter(function(q){ return /^выгляну за инфой|^подпушу /.test(q.text); }).forEach(function(s){ tot++;
            var ch = chg.some(function(q){ return q.team === (s.who.charAt(0) === "C" ? "CT" : "T") && q.t >= s.t && q.t - s.t < 25*TICK_HZ; });
            var got = voice.some(function(q){ return q.who === s.who && q.t >= s.t && q.t - s.t < 25*TICK_HZ && /— пусто$/.test(q.text); }) || clr.some(function(q){ return q.who === s.who && q.t >= s.t && q.t - s.t < 25*TICK_HZ; }) ||
                      ev.some(function(q){ return q.who === s.who && q.t >= s.t && q.t - s.t < 25*TICK_HZ; });
            if(got || ch) info++; if(!got && ch) got = "план сменился"; list.push(s.who + ": " + s.text + (got === "план сменился" ? " → план команды сменился" : got ? " → инфо" : " → тишина")); });
          voice = []; ev = []; clr = []; chg = [];
        }
      }
    });
    R.probe_all_give_info = {ok: tot > 0 && info / tot >= 0.8, valid: tot > 0, probes: tot, withInfo: info, sample: list.slice(0, 10)};
  } catch(e){ R.probe_all_give_info = {ok: false, err: String(e).slice(0, 200)}; }

  // П2. Подмена: «займу <место> вместо X» — тот, кто сказал, за 15 с доходит до места (≤400 px), или контакт/смерть по пути.
  try {
    var fills = [], done = 0;
    [3, 7].forEach(function(m){
      freshMatch(m); voice = []; var open = [];
      for(var i = 0; i < 6*120*TICK_HZ && matchNum === m; i++){
        stepTick();
        voice.forEach(function(q){ var mm = /^займу (.*) вместо (\S+)$/.exec(q.text); if(mm){ var b = bot(q.who); open.push({who: q.who, t: q.t, pt: b && b._fillLock ? b._fillLock.pt : null, text: q.text, res: null}); } });
        voice = [];
        open.forEach(function(f){ if(f.res || !f.pt) return; var b = bot(f.who);
          if(!b.alive || b._sawEnemy) f.res = "контакт"; else if(Math.hypot(b.x-f.pt.x, b.y-f.pt.y) <= 400) f.res = "дошёл"; else if(!b._fillLock) f.res = "план сменился"; else if(tick - f.t > 15*TICK_HZ) f.res = "не дошёл"; });
      }
      fills = fills.concat(open);
    });
    var ok2 = fills.filter(function(f){ return f.res === "дошёл" || f.res === "контакт" || f.res === "план сменился"; }).length;
    R.fill_reaches_spot = {ok: fills.length > 0 && ok2 / fills.length >= 0.8, valid: fills.length > 0, fills: fills.length, reached: ok2,
      sample: fills.slice(0, 6).map(function(f){ return f.who + ": " + f.text + " → " + f.res; })};
  } catch(e){ R.fill_reaches_spot = {ok: false, err: String(e).slice(0, 200)}; }

  // П3. Носитель на плант не один: за 10 с до планта (раз в 0,25 с) — есть ли свой ≤350 px у того, кто поставил (когда свои живы).
  // У про — один 5 % времени (carrier_plant.py). Засчитывается при ≥5 плантах; ok — один ≤ 8 % времени.
  try {
    var pl = [], tot3 = 0, al3 = 0, bj = 0;
    [3, 7, 11].forEach(function(m){
      freshMatch(m); voice = []; var hist = [];
      for(var i = 0; i < 8*120*TICK_HZ && matchNum === m; i++){
        var c = bomb && bomb.state === "carried" ? bomb.carrier : null; stepTick();
        bj += voice.filter(function(q){ return /^бомба у меня — иду к/.test(q.text); }).length; voice = [];
        if(c && i % 16 === 0){ var mates = bots.filter(function(o){ return o !== c && o.alive && o.team === "T"; });
          if(mates.length) hist.push({t: tick, id: c.id, al: !mates.some(function(o){ return Math.hypot(o.x-c.x, o.y-c.y) <= 350; })}); }
        if(c && c.planting && !c._sc5pl){ c._sc5pl = roundNum; var w = hist.filter(function(h){ return h.id === c.id && tick - h.t <= 10*TICK_HZ; });
          if(w.length){ pl.push(w.filter(function(h){ return h.al; }).length / w.length); } }
        if(roundState !== "live") bots.forEach(function(o){ o._sc5pl = 0; });
      }
    });
    var avg = pl.length ? pl.reduce(function(a, b){ return a + b; }, 0) / pl.length : null;
    R.carrier_not_alone_to_plant = {ok: avg !== null && avg <= 0.08, valid: pl.length >= 5, plants: pl.length, aloneShare: avg === null ? null : Math.round(avg*1000)/10, bombjoinCalls: bj};
  } catch(e){ R.carrier_not_alone_to_plant = {ok: false, err: String(e).slice(0, 200)}; }

  // П4. По боту попали сквозь смок — он отвечает огнём в ту сторону за ~2 с (не видит стрелка: дым).
  try {
    live(3); var V = bot("CT0"), S = bot("T0"), p = openSpot(300); park([V, S]);
    var pv = {x: p.x - 280, y: p.y}, ps = {x: p.x + 280, y: p.y}; put(V, pv); put(S, ps);
    smokes.length = 0; smokes.push({x: p.x, y: p.y, born: tick - 200, until: tick + 20*TICK_HZ, team: "T"});
    V._spamDone = {}; V.heardSound = null; var hitT = null, a0 = null, back = null, sawS = false;
    for(var i = 0; i < 6*TICK_HZ; i++){
      if(hitT === null && i % 4 === 0){ S._smokeShot = true; S.nextShotTick = 0; S.facing = Math.atan2(V.y-S.y, V.x-S.x); tryShoot(S, V, Math.hypot(V.x-S.x, V.y-S.y)); S._smokeShot = false;
        if(V.heardSound && V.heardSound.kind === "hit" && V.heardSound.tick === tick){ hitT = tick; a0 = V.ammo; } }
      smokes.forEach(function(q){ q.bholes = []; });   // (слияние с v271: дыры от пуль) — проверяем ответ на попадание, а не бой через дыру
      stepTick(); put(V, pv); put(S, ps); if(!V.alive) break;
      smokes.forEach(function(q){ q.bholes = []; });
      if(V._sawEnemy) sawS = true;
      if(hitT !== null && back === null && V.ammo < a0) back = tick - hitT;
      if(hitT !== null && tick - hitT > 2*TICK_HZ) break;
    }
    R.smoke_hit_returns_fire = {ok: back !== null && back <= 2*TICK_HZ, valid: hitT !== null && V.alive && !sawS, reactTicks: back, smokeBlocks: smokeBlocks(pv.x, pv.y, ps.x, ps.y)};
  } catch(e){ R.smoke_hit_returns_fire = {ok: false, err: String(e).slice(0, 200)}; }
  return JSON.stringify(R);
})();
