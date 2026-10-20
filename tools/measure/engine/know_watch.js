// (Б2, ENGINE_AUDIT шаг 0б) сторож знания о врагах и стрельбы — только запись, игру не меняет. Вставляется в rec2.js рядом с
// audit/watch.js и engine/walk_watch.js (walk_run.py). Читает состояние игры и вызывает только функции без побочных действий
// (visParts, visWallHit, smokeBlocks, inFov, beliefZoneKnown, knowHypZoneId, knowHypSpread, calloutName, zoneIdAt).
// anc   — раз в 16 тиков: «якоря» (места, где враг по знанию, вес ≥ ANC_W, разные — дальше ANC_R px; ki — только места из инфы:
//         видели / слышали / войс / киллфид, без веток-прогнозов) на одного живого врага —
//         у знания команды (TEAMK: радар, войс, киллфид) и у каждого бота (b.know); счёт по состоянию (видят / инфа ≤ 10 с /
//         старше) и где на самом деле враг (до ближайшего и до главного якоря). Примеры «≥ 2 якорей» — ancEx.
// dbl   — то, что владелец видит на панели взгляда бота: «звук» (heardSound ≤ 6 с) того же врага, у которого метка команды
//         beliefLast (≤ 15 с) дальше ANC_R — два места на одного врага; и метки beliefLast со звука (на панели подписаны «видели»).
// seen  — каждый сигнал «видели» (intelPush type spotted): кто вызвал, видит ли его движок (visParts, дым, поле зрения, _visible),
//         точки и высоты — для сверки с геометрией игры (Mirage, tools/map3d/raycast.py).
// hatch — штриховка зоны (как в lookDbgDraw: по таймингу враг мог дойти — REACH ≤ tick, — а команда там не ждёт, beliefZoneKnown < 0,03):
//         эпизоды [команда, зона, начало, конец, чем кончилась, доля проверок с живым врагом в зоне]; где на самом деле живые враги.
// ph    — бот не видит врагов, у команды свежая метка «видели» (≤ 3 с, ≤ 1200 px): по фазе (ретейк / пост-плант / прочее) и по
//         причине взгляда — доля, когда смотрит в её сторону (± 35°).
// plant — knowPlantShift: вес свежей инфы до/после, где враг на самом деле (до бомбы / до старой точки).
// app, hit — стрельба: эпизод «враг в _visible» → первый выстрел по нему (время, скорость, макс. скорость за 16 тиков, дистанция);
//         попадания пулей (applyDamage). z — высоты живых раз в 16 тиков (REC.pos их не пишет) — для геометрии.
// voice — коллы «беру …»: где стоял сказавший.
(function(){
  var g = (typeof window !== "undefined" ? window : globalThis);
  var ANC_W = 0.2, ANC_R = 300;   // параметры сторожа (не игры)
  var KW = {anc:{}, ancEx:[], dbl:{n:0, d:0, lbl:[0, 0], ex:[]}, seen:{by:{}, rows:[]}, hatch:[], hatchN:{}, encl:{},
            ph:{}, plant:[], app:[], hit:[], z:[], voice:[], shotx:[]};
  KW.meta = {SPEED:SPEED, SPD_K:SPD_K, TICK_HZ:TICK_HZ, PX_UNITS:(typeof PX_UNITS !== "undefined" ? PX_UNITS : null), FOV_DEG:FOV_DEG, ANC_W:ANC_W, ANC_R:ANC_R};
  function R(v){ return v == null ? null : Math.round(v); }
  function bot(id){ for(var i = 0; i < bots.length; i++) if(bots[i].id === id) return bots[i]; return null; }
  function place(x, y){ try { return String(calloutName(x, y) || ""); } catch(e){ return ""; } }
  function caller(skip){ var st = String(new Error().stack).split("\n").slice(2 + skip);
    for(var i = 0; i < st.length; i++){ var m = /at (?:Object\.|globalThis\.)?([\w$]+) \(/.exec(st[i]);
      if(m && !/^(commSend|intelPush|forEach|Array|some|filter|map|eval)$/.test(m[1])) return m[1]; }
    return "?"; }
  function inc(o, k, n){ o[k] = (o[k]||0) + (n == null ? 1 : n); }

  // ---------- якоря ----------
  function hypPt(h, B){
    if(h.type === "held" && h.x !== undefined) return [h.x, h.y];
    if(h.type === "held" && h.from){ var S = knowHypSpread(h, B), best = null; S.forEach(function(q){ if(!best || q[1] > best[1]) best = q; });
      var c = best ? BZ.cent[best[0]] : null; return c ? [c.x, c.y] : null; }
    if(h.heard) return [h.x, h.y];
    var zid = knowHypZoneId(h, B), gc = knowGraph().c[zid]; return gc ? [gc.x, gc.y] : null;
  }
  function anchors(B){
    if(B.visible) return [{x:B.last.x, y:B.last.y, w:1, t:"vis", i:true}];
    var P = [];
    B.hyps.forEach(function(h){ if(h.type === "moved_unknown" || !(h.weight >= ANC_W)) return; var p = hypPt(h, B); if(!p) return;
      // инфа (видели / слышали / войс / киллфид) — «якорь» в смысле владельца; ветка «ушёл туда» и «у бомбы» — прогноз
      var info = !h.plant && (h.type === "held" || h.heard);
      P.push({x:p[0], y:p[1], w:h.weight, i:info, t:h.type + (h.heard ? (h.voice ? ":voice" : ":heard") : "") + (h.plant ? ":plant" : "") + (h.from ? ":kill" : "")}); });
    P.sort(function(a, c){ return c.w - a.w; });
    var C = []; P.forEach(function(p){ var m = null; C.forEach(function(c){ if(!m && Math.hypot(c.x-p.x, c.y-p.y) < ANC_R) m = c; }); if(m){ m.w += p.w; m.t += "+" + p.t; m.i = m.i || p.i; } else C.push({x:p.x, y:p.y, w:p.w, t:p.t, i:p.i}); });
    return C;
  }
  function ancNote(lvl, team, e, B){
    var C = anchors(B), heardF = B.hyps.some(function(h){ return h.heard && tick - (h.htick||-1e9) <= 10*TICK_HZ; });
    var st = B.visible ? "vis" : (B.last.source === "spawn" && !heardF) ? "spawn" : (tick - B.last.tick <= 10*TICK_HZ || heardF ? "fresh" : "old");
    var key = lvl + "|" + st, A = KW.anc[key] || (KW.anc[key] = {n:0, k:[0,0,0,0], ki:[0,0,0,0], near:[0,0,0], top:[0,0,0], unk:0});
    var ni = C.filter(function(c){ return c.i; }).length;
    A.n++; A.k[Math.min(3, C.length)]++; A.ki[Math.min(3, ni)]++;
    var un = 0; B.hyps.forEach(function(h){ if(h.type === "moved_unknown") un += h.weight; }); A.unk += un;
    if(C.length){ var dn = Infinity; C.forEach(function(c){ dn = Math.min(dn, Math.hypot(c.x-e.x, c.y-e.y)); });
      var dt = Math.hypot(C[0].x-e.x, C[0].y-e.y);
      A.near[dn < 300 ? 0 : dn < 800 ? 1 : 2]++; A.top[dt < 300 ? 0 : dt < 800 ? 1 : 2]++; }
    if(ni >= 2 && st !== "spawn" && KW.ancEx.length < 800 && (lvl === "team" || KW.ancEx.length < 400))
      KW.ancEx.push([tick, lvl, team, e.id, R(e.x), R(e.y), place(e.x, e.y), B.last.source || "", R((tick - B.last.tick)/TICK_HZ*10)/10,
        C.map(function(c){ return [R(c.x), R(c.y), Math.round(c.w*100)/100, c.t, place(c.x, c.y), c.i ? 1 : 0]; })]);
  }

  // ---------- «видели»: сигналы spotted ----------
  var IP = intelPush; intelPush = function(team, sig){
    if(roundState === "live" && sig && sig.type === "spotted" && sig.id && sig.id !== "?"){
      var who = caller(0), by = bot(sig.by), e = bot(sig.id);
      var S = KW.seen.by[who] || (KW.seen.by[who] = {n:0, eng0:0, smoke:0, fov0:0, vis0:0, anyVis0:0});
      S.n++;
      if(by && e){
        var vp = visParts(by.x, by.y, by.crouching, e.x, e.y, e.crouching, true, by.z, e.z), eng = (vp.head ? 1 : 0) + (vp.body ? 2 : 0);
        var sm = smokeBlocks(by.x, by.y, e.x, e.y) ? 1 : 0, fv = inFov(by, e.x, e.y) ? 1 : 0, iv = (by._visible || []).indexOf(e) >= 0 ? 1 : 0;
        var av = bots.some(function(m){ return m.alive && m.team === team && (m._visible || []).indexOf(e) >= 0; }) ? 1 : 0;
        if(!eng) S.eng0++; if(sm) S.smoke++; if(!fv) S.fov0++; if(!iv) S.vis0++; if(!av) S.anyVis0++;
        var k = team + e.id + by.id, last = KW.seen.last || (KW.seen.last = {});
        if(who !== "teamInfoTick" || !last[k] || tick - last[k] >= 32 || !eng){ last[k] = tick;
          if(KW.seen.rows.length < 40000) KW.seen.rows.push([tick, team, who, by.id, e.id, R(by.x), R(by.y), R(by.z), by.crouching ? 1 : 0, R(e.x), R(e.y), R(e.z), e.crouching ? 1 : 0, eng, sm, fv, iv, av, R(Math.hypot(e.x-by.x, e.y-by.y))]); }
      }
    }
    return IP.apply(this, arguments); };

  // ---------- пост-плант: сдвиг знания к бомбе ----------
  var PS = knowPlantShift; knowPlantShift = function(K, site){
    var pre = null, lvl = "bot";
    if(roundState === "live" && K && site && K.plantShift !== site && SITES[site]){
      if((TEAMK.CT && TEAMK.CT.know === K) || (TEAMK.T && TEAMK.T.know === K)) lvl = "team";
      pre = {};
      for(var id in K.enemies){ var B = K.enemies[id]; if(B.visible) continue; var best = null;
        B.hyps.forEach(function(h){ if(h.type === "moved_unknown") return; var p = hypPt(h, B); if(p && (!best || h.weight > best.h.weight)) best = {h:h, p:p, w:h.weight}; });
        if(best) pre[id] = best; } }
    var r = PS.apply(this, arguments);
    if(pre && KW.plant.length < 3000){ var S = SITES[site];
      for(var id2 in pre){ var e = bot(id2), q = pre[id2]; if(!e || !e.alive) continue; var B2 = K.enemies[id2];
        var age = B2 && B2.last ? (tick - B2.last.tick)/TICK_HZ : null, ht = q.h.heard && q.h.htick != null ? (tick - q.h.htick)/TICK_HZ : null;
        KW.plant.push([tick, lvl, site, id2, Math.round(q.w*100)/100, Math.round(q.h.weight*100)/100, q.h.type + (q.h.heard ? ":heard" : ""), age == null ? null : Math.round(age*10)/10,
          ht == null ? null : Math.round(ht*10)/10, R(Math.hypot(e.x-S.x, e.y-S.y)), R(Math.hypot(e.x-q.p[0], e.y-q.p[1])), place(q.p[0], q.p[1]), place(e.x, e.y)]); } }
    return r; };

  // ---------- попадания пулей ----------
  var AD = applyDamage; applyDamage = function(att, b, dmg, src, o){
    var hp0 = b ? b.hp : null, r = AD.apply(this, arguments);
    if(roundState === "live" && src === "bullet" && att && b && att.team !== b.team && KW.hit.length < 60000)
      KW.hit.push([tick, att.id, b.id, R(dmg), o && o.hs ? 1 : 0, o && o.wkey || "", hp0 == null ? null : hp0 - b.hp, r ? 1 : 0]);
    return r; };

  // ---------- выстрелы: скорость за 16 тиков до выстрела ----------
  var TS = tryShoot; tryShoot = function(sh, tg, dist){ var a0 = sh.ammo, l0 = sh.lastShotTick; var r = TS.apply(this, arguments);
    if(roundState === "live" && (sh.ammo < a0 || sh.lastShotTick !== l0)){
      var H = sh.__kv || [], mx = 0; H.forEach(function(v){ if(v > mx) mx = v; });
      var E = KW.__ep[sh.id] && KW.__ep[sh.id][tg.id];
      if(E && E.shot == null){ E.shot = tick;
        if(KW.app.length < 20000) KW.app.push([sh.id, tg.id, E.t0, tick, R(dist), sh.weapon ? sh.weapon.key : "", R(sh.curSpeed||0), R(mx), sh.crouching ? 1 : 0,
          E.fov, R(E.bx), R(E.by), R(E.bz), R(E.ex), R(E.ey), R(E.ez), E.eng]); }
      if(KW.shotx.length < 80000) KW.shotx.push([tick, sh.id, tg.id, R(mx), sh.crouching ? 1 : 0, R(sh.z), R(tg.z), tg.crouching ? 1 : 0]);
    }
    return r; };
  KW.__ep = {};

  // ---------- коллы «беру …» ----------
  var VL = voiceLog; voiceLog = function(team, key, who, text){
    if(roundState === "live" && /беру/.test(String(text)) && KW.voice.length < 3000){ var b = bot(who);
      KW.voice.push([tick, team, who, String(key), String(text), b ? R(b.x) : null, b ? R(b.y) : null, b ? place(b.x, b.y) : "", b && b.post ? String(b.post.tag) : "-"]); }
    return VL.apply(this, arguments); };

  // ---------- штриховка ----------
  var HZ = {CT:{}, T:{}};
  function hatchClose(team, j, why){ var E = HZ[team][j]; if(!E) return; delete HZ[team][j];
    if(KW.hatch.length < 60000) KW.hatch.push([team, BZ.ids[j], E.t0, tick, why, E.n, E.inn]); }
  function hatchTick(){
    ["CT", "T"].forEach(function(team){ var RT = REACH[team]; if(!RT) return;
      var foes = bots.filter(function(o){ return o.alive && o.team !== team; }), fz = {};
      foes.forEach(function(o){ var j = bzOf(o.x, o.y); if(j >= 0) fz[j] = (fz[j]||0) + 1; });
      var nH = 0, inH = 0, inB = 0, inNo = 0;
      for(var j = 0; j < BZ.ids.length; j++){
        var bk = beliefZoneKnown(team, j), h = isFinite(RT[j]) && RT[j] <= tick && !(bk >= 0.03);
        if(h){ nH++; var E = HZ[team][j] || (HZ[team][j] = {t0:tick, n:0, inn:0}); E.n++; if(fz[j]) E.inn++; inH += fz[j]||0; }
        else { if(HZ[team][j]) hatchClose(team, j, bk >= 0.03 ? "info" : (!(RT[j] <= tick) ? "reach" : "?")); if(fz[j]){ if(bk >= 0.03) inB += fz[j]; else inNo += fz[j]; } }
      }
      var N = KW.hatchN[team] || (KW.hatchN[team] = {s:0, zones:0, foes:0, inH:0, inB:0, inNo:0, out:0});
      N.s++; N.zones += nH; N.foes += foes.length; N.inH += inH; N.inB += inB; N.inNo += inNo; N.out += foes.length - inH - inB - inNo;
    });
  }

  // ---------- взгляд при свежей инфе, по фазам ----------
  function phTick(){
    bots.forEach(function(b){
      if(!b.alive || b._sawEnemy || b.facing === undefined) return;
      var L = beliefLast[b.team] || {}, best = null, bd = 1200;
      for(var id in L){ var q = L[id]; if(q.src !== "spotted" || tick - q.tick > 3*TICK_HZ) continue; var e = bot(id); if(!e || !e.alive) continue;
        var d = Math.hypot(q.x-b.x, q.y-b.y); if(d < bd && d > 60){ bd = d; best = q; } }
      if(!best) return;
      var pl = bomb && bomb.state === "planted", tag = b.post ? String(b.post.tag) : "-";
      var phase = pl ? (b.team === "CT" ? (/retake/.test(tag) || b.retakeRole ? "retake" : "postplant-CT") : "postplant-T") :
                  (/retake/.test(tag) ? "retake-pre" : /^(lineup|nade)/.test(tag) ? "lineup" : b.atPost ? "post" : "move");
      var a = Math.atan2(best.y-b.y, best.x-b.x), off = Math.abs(((a - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
      var los = hasLOS(b.x, b.y, best.x, best.y) ? 1 : 0;
      var k = phase + "|" + (b.lookReason || "-") + "|" + los, P = KW.ph[k] || (KW.ph[k] = [0, 0]);
      P[0]++; if(off < 35*Math.PI/180) P[1]++;
    });
  }

  KW.tick = function(){
    if(roundState !== "live"){ for(var t in HZ) for(var j in HZ[t]) hatchClose(t, +j, "round"); KW.__ep = {}; return; }
    // скорость за последние 16 тиков; эпизоды «враг виден»
    bots.forEach(function(b){ var H = b.__kv || (b.__kv = []); H.push(b.curSpeed||0); if(H.length > 16) H.shift();
      if(!b.alive) return; var EP = KW.__ep[b.id] || (KW.__ep[b.id] = {});
      (b._visible || []).forEach(function(e){ var E = EP[e.id];
        if(!E || tick - E.last > 32){ var vp = visParts(b.x, b.y, b.crouching, e.x, e.y, e.crouching, true, b.z, e.z);
          E = EP[e.id] = {t0:tick, last:tick, shot:null, fov:inFov(b, e.x, e.y) ? 1 : 0, bx:b.x, by:b.y, bz:b.z, ex:e.x, ey:e.y, ez:e.z, eng:(vp.head ? 1 : 0) + (vp.body ? 2 : 0)}; }
        E.last = tick; }); });
    if(tick % 16) return;
    bots.forEach(function(b){ if(b.alive) KW.z.push([tick, b.id, R(b.z), b.crouching ? 1 : 0]); });
    var key = matchNum + ":" + roundNum;
    ["CT", "T"].forEach(function(team){
      var A = TEAMK[team], foes = bots.filter(function(o){ return o.alive && o.team !== team; });
      if(A && A.know && A.know.key === key) foes.forEach(function(e){ var B = A.know.enemies[e.id]; if(B && B.hyps) ancNote("team", team, e, B); });
      bots.forEach(function(b){ if(!b.alive || b.team !== team || !b.know || b.know.key !== key) return;
        foes.forEach(function(e){ var B = b.know.enemies[e.id]; if(B && B.hyps) ancNote("bot", team, e, B); }); });
    });
    // панель взгляда: «звук» и «видели» на одного врага в разных местах
    bots.forEach(function(b){ if(!b.alive) return; var hs = b.heardSound;
      if(!hs || !hs.src || hs.team === b.team || tick - hs.tick > 6*TICK_HZ) return; var e = bot(hs.src); if(!e || !e.alive) return;
      var BL = (beliefLast[b.team] || {})[hs.src]; KW.dbl.d++;
      if(BL && tick - BL.tick <= 15*TICK_HZ && Math.hypot(BL.x-hs.x, BL.y-hs.y) > ANC_R){ KW.dbl.n++;
        if(KW.dbl.ex.length < 400) KW.dbl.ex.push([tick, b.id, hs.src, BL.src, R((tick-BL.tick)/TICK_HZ*10)/10, place(BL.x, BL.y), hs.kind, R((tick-hs.tick)/TICK_HZ*10)/10, place(hs.x, hs.y), place(e.x, e.y), R(Math.hypot(BL.x-hs.x, BL.y-hs.y))]); } });
    ["CT", "T"].forEach(function(team){ var L = beliefLast[team] || {}; for(var id in L){ var q = L[id], e = bot(id); if(!e || !e.alive || tick - q.tick > 15*TICK_HZ) continue;
      KW.dbl.lbl[0]++; if(q.src !== "spotted") KW.dbl.lbl[1]++; } });
    hatchTick();
    phTick();
  };
  KW.report = function(){ var o = {}; for(var k in KW) if(typeof KW[k] !== "function" && k.indexOf("__") !== 0) o[k] = KW[k];
    o.seen = {by:KW.seen.by, rows:KW.seen.rows}; o.zones = BZ.ids; return o; };
  g.KNOWW = KW;
})();
