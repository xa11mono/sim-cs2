// [хозяева: rpBuild, rpRecord] ======================= (v459, владелец 28.10) ПОВТОР КЛАТЧА — только показ, на игру не влияет =======================
// Как на трансляции: раунд кончился клатчем 1v2+ — пока закупка, показываем повтор: клип с 2 с до первого фрага клатча, плавные
// переходы к следующим фрагам, плант / дефуз, замедление на фрагах; потом экран размывается и сверху — портреты игроков в строчку:
// что кричат (победители — радуются, проигравшие — расстроены) и что каждый последним сказал в войсе за раунд.
// Запись: каждый кадр (после тиков) — лёгкий снимок того, что видно на радаре (игроки, дым, огонь, гранаты, бомба, выстрелы) и
// киллфид раунда; хранится только текущий раунд и последний клатч. Повтор рисует сам на своём холсте — игра его не видит.
// Если повтор не успел до конца закупки — игра ждёт (тики стоят) и потом идёт дальше теми же тиками: исход не меняется.
// Фразы реакций — проектные (показ, не поведение). Выключить — «Инструменты → повтор клатча» (хранится в браузере).
var RP_K = {
  minN: 2,            // клатч от 1v2
  multiN: 3,          // (v466, владелец 29.10: «на про почти после каждого раунда повтор; мультикиллы с трёх, двойной — редко») мультикилл от 3 фрагов
  pick: {two: 0.65, special: 0.5, last: 0.35},   // (v469, п.26) доля раундов, где второстепенный момент попадает в кандидаты (проектные)        // двойной — в доле раундов, где больше показать нечего (проектное число: владелец сказал «редко»)
  pre: 2, post: 1.1,  // клип: за pre с до момента и post с после
  merge: 1.6,         // моменты ближе merge с — один кусок
  maxClip: 20,        // клип длиннее maxClip с игры — короче запас до и после
  slowR: 0.45, slow: 0.3,   // замедление ×slow в slowR с вокруг фрага
  cut: 0.6,           // переход между кусками (наложение кадров), с
  startDelay: 1.3,    // повтор начинается через startDelay с после конца раунда (видно карточку раунда и баннер)
  emo: 2.2,           // эмоции: после последней реплики экран ещё стоит emo с
  typing: 0.45,       // реплика: «печатает…» перед фразой, с
  sayMin: 1.1,        // реплика держится до следующей не меньше, с
  quiet: 0.85,        // реплика без голоса — до следующей, с
  voices: 5,          // сколько реплик озвучено (клатчер, двое своих, двое соперников) — остальные только текстом
  intro: 0, outro: 0.5,   // (v518d, владелец А-4 / А-40: «не надо писать заголовки на чёрном экране, сразу начинать») заставки нет
  live: 10,           // (v518d, владелец А-40: «до 10 секунд ещё можно забрать у раунда») повтор идёт и в начале нового раунда, пока боты бегут на места
  tracer: 0.22        // след выстрела в повторе, с игры
};
var RP = {on: false, rec: null, last: null, P: null, enabled: true, mode: "auto", prevRs: null, lastTs: 0, holding: false};
try{ RP.enabled = localStorage.getItem("sim-rp") !== "0"; RP.mode = localStorage.getItem("sim-rp-mode") || "auto"; }catch(e){}
// (владелец 28.10) как на трансляции, показ бывает разный: клип + реакция, только клип (фраги с замедлением), только реакция.
// «авто» — выбор по раунду (доли — проектные числа); фрагов и дефуза у клатчера нет — показывать в клипе нечего, только реакция
var RP_MODES = {both: 0.5, clip: 0.3, emo: 0.2};
function rpMode(R, B){
  var has = B.moments.some(function(m){ return m.kind === "kill" || m.kind === "defuse"; });
  var m = RP.mode;
  if(m === "auto"){ var u = (rpHash(R.m + "|" + R.round + "|mode") % 1000)/1000; m = u < RP_MODES.both ? "both" : u < RP_MODES.both + RP_MODES.clip ? "clip" : "emo"; }
  if(!has || !B.segs.length) m = "emo";
  if(R.clutch.multi) m = "clip";   // (v466) реакций на мультикилл нет — фразы написаны про клатч (владелец не расписал реакции на мультикилл)
  return m;
}
// (v462, владелец 29.10: «нет анимаций, звуков… звуки главное») звук и голос показа (повтор, пауза) — одно место. Только если включён
// «Звук» (кнопка, app): звук чата (chat_talk — присланный владельцем 15.10) на каждую реплику, свист на смену кадра, удар на фраг;
// голоса нет (п.18 владельца 29.10: «убрать озвучку игроков в клатчах»; на паузе убран в v469) — реплики только текстом
function showSnd(kind, g){
  if(typeof SND === "undefined" || !SND.on || !SND.ctx) return;
  RP.sndOwn = true;
  try{
    if(kind === "chat"){ if(!sndPlay("chat_talk", g || 0.6, 0)) sndTone(0.12, 0.05, 1800, "sine"); }
    else if(kind === "whoosh"){ sndNoise((g || 0.22), 0.32, "bandpass", 900, 0.6); sndNoise((g || 0.22)*0.6, 0.45, "highpass", 3200, 0.4, 0.04); }
    else if(kind === "hit"){ sndTone(g || 0.22, 0.2, 95, "sine", 0, 45); sndNoise((g || 0.22)*0.8, 0.14, "lowpass", 420, 0.7); }
    else if(kind === "pop"){ sndTone(g || 0.1, 0.07, 1100, "triangle", 0, 1700); }
  }catch(e){}
  RP.sndOwn = false;
}
var RP_NB = 9;   // чисел на игрока в снимке: x, y, взгляд, жив, hp, присел, этаж (-1 под полом / 1 над), плант(+)/дефуз(−) 0..1, ослеплён
function rpNum(v){ return typeof v === "number" && isFinite(v) ? v : NaN; }
// ---------- запись ----------
function rpNewRec(){
  var nk = {}; bots.forEach(function(b){ nk[b.id] = nick(b.id); });
  var NK = {}; for(var k in NICKS) NK[k] = NICKS[k];
  return {m: matchNum, round: roundNum, t0: tick, s: [], kills: [], tr: [], ev: [], vo: [], seen: {tr: new Set(), vo: new Set(), kf: new Set()}, nick: nk, NK: NK, side: {CT: SIDE_TEAM.CT, T: SIDE_TEAM.T}, team: {CT: TEAM_NAME.CT, T: TEAM_NAME.T},
          logo: {CT: TEAM_LOGO.CT, T: TEAM_LOGO.T}, score0: {CT: score.CT, T: score.T}, solo: {}, lastBomb: bomb ? bomb.state : null};
}
function rpSample(R){
  var n = bots.length, B = new Float32Array(n*RP_NB);
  bots.forEach(function(b, i){ var o = i*RP_NB;
    var act = 0;
    if(b.planting) act = Math.max(0.01, Math.min(1, 1 - (b.plantUntil - tick)/PLANT_TICKS));
    else if(b.defusing){ var tot = b.kit ? DEFUSE_KIT_TICKS : DEFUSE_TICKS; act = -Math.max(0.01, Math.min(1, 1 - (b.defuseUntil - tick)/tot)); }
    B[o] = b.x; B[o+1] = b.y; B[o+2] = rpNum(b.facing); B[o+3] = b.alive ? 1 : 0; B[o+4] = b.hp; B[o+5] = b.crouching ? 1 : 0;
    B[o+6] = (b._overV||0) > 0.5 ? 1 : (b._underV||0) > 0.5 ? -1 : 0;   // (v535) этаж — по 3D (floorViewTick)
    B[o+7] = act; B[o+8] = tick < (b.blindUntil||0) ? 1 : 0;
  });
  var sm = [], fi = [], nd = [];
  smokes.forEach(function(s){ var r = smokeRadiusNow(s); if(r > 2) sm.push(s.x, s.y, r); });
  fires.forEach(function(f){ fi.push(f.x, f.y, fireRadiusNow(f)); });
  nadesInAir.forEach(function(q){ nd.push(q.x, q.y, q.team === "CT" ? 1 : 0, q.type === "smoke" ? 0 : q.type === "flash" ? 1 : q.type === "he" ? 2 : 3); });
  var bs = bomb ? bomb.state : null, ci = bomb && bomb.carrier ? bots.indexOf(bomb.carrier) : -1;
  return {t: tick, b: B, sm: sm, fi: fi, nd: nd, bomb: bs ? {st: bs, x: bomb.x, y: bomb.y, c: ci} : null, w: rpWorld()};
}
function rpWorld(){
  var W = {tick: tick, b: bots.map(function(o){
    var c = {_climb: o._climb && {jump: o._climb.jump, air: o._climb.air},
      _visible: (o._visible || []).map(function(b){ return b.id; })};
    RP_BF.forEach(function(k){ c[k] = o[k]; });
    return c;
  }),
    sm: smokes.map(rpCl), fi: fires.map(rpCl), nd: nadesInAir.map(rpCl), fx: nadeFx.map(rpCl),
    bomb: bomb ? rpCl(bomb) : null, bc: bomb && bomb.carrier ? bots.indexOf(bomb.carrier) : -1};
  if(tick % 8 === 0){ W.gw = groundWeapons.map(rpCl); W.gi = groundItems.map(rpCl); }
  return W;
}
function rpIdByNick(nm){ for(var id in NICKS) if(NICKS[id] === nm) return id; return null; }
function rpNewEvent(seen, e){
  var key = showEventKey(e);
  if(seen.has(key)) return false;
  seen.add(key);
  return true;
}
// после тиков кадра (app): записать, что изменилось; конец раунда — проверить клатч
function rpRecord(){
  var rs = roundState;
  if(WARM.on){ RP.rec = null; RP.prevRs = rs; return; }
  if(rs === "freeze") RP.rec = null;   // новый раунд — новая запись (клатч прошлого уже в RP.last)
  // идёт раунд — пишем; после конца раунда (ending) — тоже, пока тот же раунд: последний фраг и «после» в клипе
  var after = (rs === "ending" || rs === "matchover") && RP.rec && RP.rec.m === matchNum && RP.rec.round === roundNum;
  if(rs === "live" || after){
    var R = RP.rec; if(!R || R.m !== matchNum || R.round !== roundNum) R = RP.rec = rpNewRec();
    var S = R.s.length ? R.s[R.s.length-1] : null;
    if(S && tick < S.t){ R = RP.rec = rpNewRec(); S = null; }   // перемотка назад (отметки) — запись раунда заново
    if(!S || S.t !== tick){
      R.s.push(rpSample(R));
      // кто остался один в команде — с какого тика (для «клип с первого фрага клатча»)
      ["CT","T"].forEach(function(s){ var al = bots.filter(function(b){ return b.team === s && b.alive; }); if(al.length === 1 && !R.solo[al[0].id]) R.solo[al[0].id] = tick; });
      // плант / дефуз — моменты
      var bst = bomb ? bomb.state : null;
      if(bst !== R.lastBomb){
        if(bst === "planted"){ var pl = null; if(S){ for(var i = 0; i < bots.length; i++) if(S.b[i*RP_NB+7] > 0) pl = bots[i]; } R.ev.push({t: tick, kind: "plant", id: pl ? pl.id : null}); }
        R.lastBomb = bst;
      }
    }
  }
  RP.lastTs = nowTs;
  if(R){
    tracers.forEach(function(q){
      var t = q.rt ?? q.tk ?? tick;
      if(t < R.t0 || !rpNewEvent(R.seen.tr, q)) return;
      var c = rpCl(q); c.t = t; R.tr.push(c);
    });
    // Войс и киллфид хранят новые записи в начале. Кадр Worker может включать несколько тиков.
    for(var vi = voiceLines.length - 1; vi >= 0; vi--){
      var v = voiceLines[vi], vt = v.rt ?? tick;
      if(vt < R.t0 || !rpNewEvent(R.seen.vo, v)) continue;
      R.vo.push({t: vt, who: v.who, team: v.team, text: v.text, kind: v.kind});
    }
    for(var j = killfeed.length - 1; j >= 0; j--){
      var k = killfeed[j];
      if(!rpNewEvent(R.seen.kf, k)) continue;
      if(k.kind !== "kill") continue;
      // (п.18/22/34 владельца 29.10) после перемотки запись раунда начинается заново, а киллфид — весь раунд: фраги до начала записи
      // в клип не попадут (кадров нет) — это не моменты этой записи (раньше давали мультикилл с пустым клипом → экран «клатч 1v2»)
      var kt = k.rt ?? Math.round((k.at ?? simTime)*TICK_HZ); if(kt < R.t0) continue;
      // (v569, В116) показал ли обсервер этот фраг вживую: и убийца, и жертва — в кадре (иначе — кандидат на повтор «пропущено в эфире»)
      var kA = teamBot(rpIdByNick(k.att)), kV = teamBot(rpIdByNick(k.vic)), kLive = !!(OBS.on && kA && kV && obsShows(kA.x, kA.y) && obsShows(kV.x, kV.y));
      if(OBS.on && kA){ if(OBS_ST.m !== matchNum) OBS_ST = {m: matchNum, kills: 0, live: 0, sw: 0, late: 0}; OBS_ST.kills++; if(kLive) OBS_ST.live++; }
      R.kills.push({t: kt, att: rpIdByNick(k.att), vic: rpIdByNick(k.vic), attTeam: k.attTeam, vicTeam: k.vicTeam,
        w: k.w, hs: k.hs, smoke: k.smoke, wall: k.wall, noscope: k.noscope, blind: k.blind, attN: k.att, vicN: k.vic, live: kLive}); }
  }
  // конец раунда
  if(RP.prevRs === "live" && (rs === "ending" || rs === "matchover") && RP.rec) rpRoundEnd(RP.rec);
  RP.prevRs = rs;
}
function rpRoundEnd(R){
  R.end = Math.round(roundEndTime*TICK_HZ); R.endSim = roundEndTime;
  var win = score.CT > R.score0.CT ? "CT" : score.T > R.score0.T ? "T" : null;
  R.win = win; R.score = {CT: score.CT, T: score.T};
  if(bomb && bomb.state === "defused"){ var df = null; bots.forEach(function(b){ if(b.alive && b.team === "CT" && b.defuseUntil && Math.abs(b.defuseUntil - R.end) < 3) df = b; }); R.ev.push({t: R.end, kind: "defuse", id: df ? df.id : null}); }
  if(bomb && bomb.state === "exploded") R.ev.push({t: R.end, kind: "boom", id: null});
  // (v466) что показать после раунда — по порядку, как было в раунде: выигранный клатч 1v2+ и мультикиллы (3+ фрага; 2 — редко).
  // Клатчер с мультикиллом — один повтор (клатч со всеми его фрагами раунда). Второй повтор — если успевает до конца закупки (rpFrame)
  // (v469, п.26 владельца 29.10: «несколько мультикиллов, даже один килл, который раунд завершает, — больше вариативности») кандидаты
  // раунда с приоритетом: клатч 100, эйс 95, 4к 90, 3к 80, 2к 40, фраг через смок / прострел / без прицела / ослеплённым 30, последний фраг
  // раунда 20. Второстепенные (2к и ниже) — не каждый раунд (доля от раунда, RP_K.pick — проектные числа). В очередь — по приоритету, сколько
  // влезает в паузу до конца закупки (rpEst), показ — по порядку, как было в раунде. Раньше: клатч и 3к+, двойной — редко и только один
  var H = [], c = clutchInfo, kc = {}, k1 = {}, cand = [], usedId = {};
  R.kills.forEach(function(k){ if(!k.att || !k.vic || k.attTeam === k.vicTeam) return; kc[k.att] = (kc[k.att]||0) + 1; if(k1[k.att] == null) k1[k.att] = k.t; });
  var mk = function(id, side){ var me = teamBot(id); return {id: id, side: side, alive: !!(me && me.alive), hp: me ? me.hp : 0, kills: kc[id]||0}; };
  var roll = function(tag){ return (rpHash(R.m + "|" + R.round + "|" + tag) % 1000)/1000; };
  if(c && win && c.team === win && c.n >= RP_K.minN){ var h = mk(c.id, c.team); h.n = c.n; h.t = R.solo[c.id] || R.end; if((kc[c.id]||0) >= RP_K.multiN){ h.all = true; h.t = k1[c.id]; } cand.push({h: h, pri: (kc[c.id]||0) >= 5 ? 100 : (kc[c.id]||0) === 4 ? 95 : 90}); usedId[c.id] = 1; }
  bots.forEach(function(b){ if(usedId[b.id]) return; var n = kc[b.id]||0;
    if(n >= RP_K.multiN || (n === 2 && roll("two" + b.id) < RP_K.pick.two)){ var h2 = mk(b.id, b.team); h2.multi = true; h2.n = n; h2.t = k1[b.id];
      cand.push({h: h2, pri: n >= 5 ? 100 : n === 4 ? 95 : n === 3 ? 80 : 40}); usedId[b.id] = 1; } });
  var SPEC = [["smoke", "Через смок"], ["wall", "Прострел"], ["noscope", "Без прицела"], ["blind", "Ослеплённым"]];
  R.kills.forEach(function(k, ki){ if(!k.att || usedId[k.att] || k.attTeam === k.vicTeam) return;
    var sp = SPEC.filter(function(q){ return k[q[0]]; })[0]; if(!sp || roll("sp" + ki) >= RP_K.pick.special) return;
    var h3 = mk(k.att, k.attTeam); h3.multi = true; h3.single = true; h3.n = 1; h3.kt = k.t; h3.t = k.t; h3.label = sp[1]; cand.push({h: h3, pri: 30}); usedId[k.att] = 1; });
  var lastK = R.kills.filter(function(k){ return k.att && k.attTeam !== k.vicTeam; }).slice(-1)[0];
  if(lastK && win && lastK.attTeam === win && !usedId[lastK.att] && !(bomb && (bomb.state === "exploded" || bomb.state === "defused")) && roll("last") < RP_K.pick.last){
    var h4 = mk(lastK.att, lastK.attTeam); h4.multi = true; h4.single = true; h4.n = 1; h4.kt = lastK.t; h4.t = lastK.t; h4.label = "Последний фраг"; cand.push({h: h4, pri: 20}); }
  // (v569, В116; обсервер про: «пропущенное вживую решающее убийство — в повтор после раунда», delay observer) первый фраг раунда (открытие)
  // или фраг, после которого остался клатч, не попавший в кадр вживую, — повтор «Пропущено в эфире»
  var aliveN = {CT: 5, T: 5}, missK = null;
  R.kills.forEach(function(k, ki){ if(!k.vicTeam) return; aliveN[k.vicTeam]--; var key = ki === 0 || aliveN[k.vicTeam] === 1;
    if(!missK && key && k.live === false && k.att && k.attTeam !== k.vicTeam && !usedId[k.att]) missK = k; });
  if(missK){ var h5 = mk(missK.att, missK.attTeam); h5.multi = true; h5.single = true; h5.n = 1; h5.kt = missK.t; h5.t = missK.t; h5.label = "Пропущено в эфире"; cand.push({h: h5, pri: 60}); usedId[missK.att] = 1; }
  if(!cand.length) return;
  cand.sort(function(a, b){ return b.pri - a.pri || a.h.t - b.h.t; });
  var avail = ROUND_RESTART_DELAY_SEC + BAL.freeze - RP_K.startDelay + RP_K.live, used = 0;
  cand.forEach(function(q, i){ R.clutch = q.h; var e = rpEst(R); if(i === 0 || used + e <= avail){ H.push(q.h); used += e; } });
  // (v518d, владелец А-34: «если есть мультикиллы 4–5, сначала их, потом клатчи и всё остальное») показ — по важности (5к, 4к, клатч, 3к, 2к, особый
  // фраг, последний), а не по времени в раунде; клатчер с 4–5 фрагами — один повтор с важностью мультикилла
  // (v583a, Д19, владелец 18.11: «смок был в начале раунда, одновременно с мультикиллом, а показан в самом конце — странно; сначала смок, потом
  // мультикиллы по очереди») что попало в повторы — по важности (выше), а показ — по времени в раунде (начало момента h.t). Было (v518d, А-34) —
  // показ по важности
  H.sort(function(a, b){ return a.t - b.t; });
  R.list = H; R.clutch = H[0];
  // войс раунда: последнее, что сказал каждый (voiceLines — новые сверху)
  // одинаковый колл у нескольких (часто — общий «B чисто») показываем один раз, у того, кто сказал позже всех
  R.vox = {}; var seenVx = {};
  voiceLines.forEach(function(v){ var id = rpIdByNick(v.who); if(!id || R.vox[id] || v.kind === "death") return;
    var key = String(v.text).toLowerCase(); if(seenVx[key]){ R.vox[id] = ""; return; } seenVx[key] = 1; R.vox[id] = v.text; });
  R.st = {}; bots.forEach(function(b){ R.st[b.id] = {alive: b.alive, hp: b.hp, k: b.roundKills||0, killer: b._killer || null}; });
  RP.last = R;
  if(RP.enabled && typeof document !== "undefined") RP.pending = {rec: R, at: R.endSim + RP_K.startDelay, i: 0};
}
// ---------- клип: куски вокруг моментов клатча ----------
function rpBuild(R){
  var C = R.clutch, from = (C.multi || C.all ? R.t0 : (R.solo[C.id] || R.t0) - RP_K.pre*TICK_HZ), M = [];
  R.kills.forEach(function(k){ if(k.att === C.id && k.vic && k.vicTeam !== C.side && k.t >= from && (!C.single || k.t === C.kt)) M.push({t: k.t, kind: "kill", k: k}); });   // (v469) один фраг — только он
  if(!C.multi) R.ev.forEach(function(e){ if(e.t >= from && (e.id === C.id || e.kind === "boom")) M.push({t: e.t, kind: e.kind}); });   // мультикилл — только его фраги
  M.sort(function(a, b){ return a.t - b.t; });
  var make = function(pre, post){
    var S = [];
    M.forEach(function(m){
      var a = m.t - pre*TICK_HZ, b = Math.min(R.end + 0.6*TICK_HZ, m.t + post*TICK_HZ);
      // дефуз — целиком: с начала дефуза
      if(m.kind === "defuse"){ var i = rpIndexAt(R, m.t), ci = rpBotIdx(C.id);
        while(i > 0 && R.s[i-1].b[ci*RP_NB+7] < 0) i--; a = Math.min(a, R.s[i].t - 0.8*TICK_HZ); }
      a = Math.max(R.t0, a);
      var L = S[S.length-1];
      if(L && a - L.b < RP_K.merge*TICK_HZ){ L.b = Math.max(L.b, b); L.m.push(m); } else S.push({a: a, b: b, m: [m]});
    });
    return S;
  };
  var segs = make(RP_K.pre, RP_K.post), len = function(S){ return S.reduce(function(s, q){ return s + q.b - q.a; }, 0)/TICK_HZ; };
  if(len(segs) > RP_K.maxClip) segs = make(1.2, 0.7);
  while(segs.length > 1 && len(segs) > RP_K.maxClip) segs.shift();   // очень длинный — последние моменты
  return {segs: segs, moments: M};
}
function rpBotIdx(id){ for(var i = 0; i < bots.length; i++) if(bots[i].id === id) return i; return -1; }
function rpIndexAt(R, t){ var lo = 0, hi = R.s.length - 1; if(hi < 0) return 0; while(lo < hi){ var mid = (lo + hi + 1) >> 1; if(R.s[mid].t <= t) lo = mid; else hi = mid - 1; } return lo; }
// ---------- показ ----------
var RP_EL = null;
function rpEls(){
  if(RP_EL) return RP_EL;
  var root = document.getElementById("rp"); if(!root) return null;
  RP_EL = {root: root, cv: document.getElementById("rpCv"), tag: root.querySelector(".rp-tag"), l3: root.querySelector(".rp-l3"), feed: root.querySelector(".rp-feed"),
    slow: root.querySelector(".rp-slow"), emo: root.querySelector(".rp-emo"), vox: root.querySelector(".rp-vox"), shade: root.querySelector(".rp-shade"), skip: root.querySelector(".rp-skip"), title: root.querySelector(".rp-title")};
  RP_EL.ctx = RP_EL.cv.getContext("2d");
  RP_EL.skip.addEventListener("click", function(e){ e.stopPropagation(); rpStop(); });
  window.addEventListener("keydown", function(e){ if(!RP.on) return; if(e.key === "Escape" || e.code === "Space"){ e.preventDefault(); e.stopImmediatePropagation(); rpStop(); } }, true);
  return RP_EL;
}
function rpPlay(R, mode){
  if(!R || !R.clutch || !R.s.length) return false;
  var E = rpEls(); if(!E) return false;
  var B = rpBuild(R), C = R.clutch, md = C.multi ? "clip" : mode || rpMode(R, B);
  // (п.18/22/34 владельца 29.10) мультикилл / фраг — только клип: экран реакций написан про выигранный клатч. Кадров нет — показывать нечего
  // (раньше пустой клип уходил в реакции с заголовком «клатч 1v» + число фрагов, в т.ч. у мёртвого и у проигравшей команды)
  if(C.multi && !B.segs.length) return false;
  if(md === "emo") B.segs = [];
  RP.P = {R: R, mode: md, segs: B.segs, si: 0, rt: B.segs.length ? B.segs[0].a : R.end, phase: B.segs.length ? "clip" : "emo", ph0: performance.now(), last: performance.now(),
          cam: null, feedShown: {}, ci: rpBotIdx(C.id)};
  RP.on = true;
  var tm = C.side, nm = R.nick[C.id];
  E.root.className = "on " + tm.toLowerCase() + (typeof HUD_REDUCED !== "undefined" && HUD_REDUCED ? " rm" : "");
  var what = C.single ? C.label : C.multi ? (C.n >= 5 ? "Эйс" : C.n + " " + (C.n >= 5 ? "киллов" : "килла")) : "Клатч 1v" + C.n;
  E.title.innerHTML = '<div class="rp-t1">ПОВТОР</div><div class="rp-t2">' + what + '</div><div class="rp-t3 ' + tm.toLowerCase() + '">' + esc(nm) + ' · ' + esc(R.team[tm]) + '</div>';
  // (DESIGN.md «Баннер события») нижняя плашка повтора — та же анатомия, что баннер и полоса клатча: плашка события, ник цвета стороны, счётчик
  E.l3.innerHTML = (R.logo[tm] ? '<img alt="" src="' + R.logo[tm] + '">' : '') + '<span class="rp-what">' + esc(what.replace(/1v(\d)/, "1 на $1")) + '</span><b>' + esc(nm) +
    '</b><span class="rp-rd">раунд ' + R.round + '</span><i class="rp-k">0</i>';
  E.feed.innerHTML = ""; E.emo.innerHTML = ""; E.slow.className = "rp-slow";
  return true;
}
// сколько секунд займёт повтор (для «успевает ли второй»): заставка + куски (+ замедление) + реакции + выход
function rpEst(R){ var B = rpBuild(R), md = rpMode(R, B), L = B.segs.reduce(function(a, q){ return a + (q.b - q.a)/TICK_HZ + q.m.length*0.6; }, 0);
  return RP_K.intro + L + (md === "clip" ? 0 : 15) + RP_K.outro; }
function rpStop(){
  if(!RP.on) return;
  RP.pending = null;   // «Пропустить» — весь показ этого раунда, не только текущий повтор
  var P = RP.P; if(P && P.phase !== "out"){ P.phase = "out"; P.ph0 = performance.now(); return; }
}
function rpEnd(){
  RP.on = false; RP.P = null; RP.holding = false;
  var E = rpEls(); if(E){ E.root.className = ""; E.emo.innerHTML = ""; if(E.vox){ E.vox.innerHTML = ""; E.vox._k = ""; } }
  if(typeof OBS !== "undefined") OBS.sc = 0;   // обсервер заново берёт камеру
}
// игра ждёт конца повтора: закупка кончается, а повтор ещё идёт (app: тики не считаются)
function rpHold(){
  var h = RP.on && ((roundState === "live" && simTime >= roundStartTime + RP_K.live - 0.6) || (roundState === "matchover" && simTime - roundEndTime >= 6.5));
  RP.holding = h; return h;
}
// кадр: true — повтор нарисовал экран сам (обычный draw не нужен)
function rpFrame(ts){
  if(!RP.on && RP.pending && !paused){
    var Pn = RP.pending;
    if(roundState === "live" && roundNum !== Pn.rec.round && simTime >= roundStartTime + RP_K.live) RP.pending = null;
    else if(simTime >= Pn.at){
      var Lh = Pn.rec.list || [Pn.rec.clutch], hh = Lh[Pn.i]; Pn.rec.clutch = hh; Pn.i++;
      // следующий повтор — если успевает до конца закупки (владелец: «если успеваешь — по очереди»)
      if(Pn.n && roundNum !== Pn.rec.round && roundStartTime + RP_K.live - simTime < rpEst(Pn.rec)){ RP.pending = null; }
      else { if(rpPlay(Pn.rec)) Pn.n = (Pn.n||0) + 1; RP.pending = Pn.i < Lh.length ? Pn : null; if(RP.pending) Pn.at = 0; }
    }
  }
  if(!RP.on) return false;
  var E = rpEls(), P = RP.P; if(!E || !P){ rpEnd(); return false; }
  var now = performance.now(), dt = Math.min(0.1, (now - P.last)/1000); P.last = now;
  var W = E.cv.clientWidth, H = E.cv.clientHeight, dpr = window.devicePixelRatio || 1;
  dpr = 1;   // (v463) кадр повтора рисует draw игры — в пикселях CSS, как основной холст
  if(E.cv.width !== W || E.cv.height !== H){ E.cv.width = W; E.cv.height = H; }
  var x = E.ctx, R = P.R, el = (now - P.ph0)/1000;
  // (v465, владелец: «между повторами моргание и цокает») переход между кусками — без затемнения и без свиста: последний кадр прошлого
  // куска растворяется в новом за RP_K.cut с (наложение, как монтаж трансляции)
  var go = function(ph){ P.phase = ph; P.ph0 = now; el = 0; };
  if(P.phase === "intro"){ if(el >= RP_K.intro) go(P.segs.length ? "clip" : "emo"); }
  if(P.phase === "clip"){
    var sg = P.segs[P.si], sp = rpSpeed(P);
    P.rt += dt*TICK_HZ*sp;
    E.slow.className = "rp-slow" + (sp < 0.9 ? " on" : "");
    if(P.rt >= sg.b){
      if(P.si + 1 < P.segs.length){
        var xc = P.xfc || (P.xfc = document.createElement("canvas")); xc.width = E.cv.width; xc.height = E.cv.height;
        xc.getContext("2d").drawImage(E.cv, 0, 0); P.xfT = now; P.si++; P.rt = P.segs[P.si].a; P.cam = null;
      } else go(P.mode === "clip" ? "out" : "emo");
    }
  }
  if(P.phase === "emo" && !P.emoOn){ if(!P.drawn) rpDraw(E, x, P, dt, W, H, dpr); rpBlurBg(E, x); rpEmotions(E, R, P); P.emoOn = true; E.root.classList.add("emo"); E.slow.className = "rp-slow"; }
  if(P.phase === "emo" && P.emoOn && rpTalkTick(E, P, now)) go("out");
  if(P.phase === "out" && el >= RP_K.outro){ rpEnd(); return false; }
  // картинка: клип и переходы — радар из записи; эмоции — размытый последний кадр (нарисован один раз)
  if(!P.emoOn) rpDraw(E, x, P, dt, W, H, dpr);
  if(P.xfT != null && !P.emoOn){ var xa = 1 - (now - P.xfT)/1000/RP_K.cut;
    if(xa > 0 && P.xfc.width === E.cv.width && P.xfc.height === E.cv.height){ var cx2 = E.ctx; cx2.setTransform(1,0,0,1,0,0); cx2.globalAlpha = xa*xa*(3 - 2*xa); cx2.drawImage(P.xfc, 0, 0); cx2.globalAlpha = 1; }
    else P.xfT = null; }
  // затемнение: начало, переход, конец
  var shade = 0;
  if(P.phase === "intro") shade = 1;   // титр на чёрном
  if(P.phase === "clip" && P.si === 0 && P.rt - P.segs[P.si].a < 0.25*TICK_HZ) shade = Math.max(0, 1 - (P.rt - P.segs[P.si].a)/(0.25*TICK_HZ));
  if(P.phase === "out") shade = Math.min(1, el/RP_K.outro);
  E.shade.style.opacity = shade.toFixed(3);
  E.root.classList.toggle("intro", P.phase === "intro");
  E.root.classList.toggle("out", P.phase === "out");
  rpFeed(E, P);
  rpVoiceLive(E, P);
  return true;
}
// войс в повторе: фразы появляются в свою секунду и держатся 3,5 с игры, не больше 4 строк (обе команды, цвет — сторона)
function rpVoiceLive(E, P){
  var el = E.vox; if(!el) return;
  if(P.phase !== "clip" && P.phase !== "cut"){ if(el.innerHTML) el.innerHTML = ""; return; }
  var R = P.R, from = P.rt - 3.5*TICK_HZ, L = R.vo.filter(function(v){ return v.t <= P.rt && v.t >= from; }).slice(-4);
  var key = L.map(function(v){ return v.t + v.text; }).join("|"); if(el._k === key) return;
  var last = L.length ? L[L.length-1].t + L[L.length-1].text : ""; if(last && last !== el._last){ el._last = last; showSnd("chat"); } el._k = key;
  el.innerHTML = L.map(function(v){ return '<div class="rp-vl ' + String(v.team).toLowerCase() + '"><b>' + esc(v.who) + '</b><span>' + esc(v.text) + '</span></div>'; }).join("");
}
// войс клатча — для экрана реакций: что говорили с начала клатча до конца раунда (последние 6)
function rpVoiceClutch(R){
  var C = R.clutch, from = (R.solo[C.id] || R.t0) - 2*TICK_HZ;
  return R.vo.filter(function(v){ return v.t >= from && v.kind !== "death"; }).slice(-6);
}
