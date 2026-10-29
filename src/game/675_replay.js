// ======================= (v459, владелец 28.10) ПОВТОР КЛАТЧА — только показ, на игру не влияет =======================
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
  multi2: 0.2,        // двойной — в доле раундов, где больше показать нечего (проектное число: владелец сказал «редко»)
  pre: 2, post: 1.1,  // клип: за pre с до момента и post с после
  merge: 1.6,         // моменты ближе merge с — один кусок
  maxClip: 20,        // клип длиннее maxClip с игры — короче запас до и после
  slowR: 0.45, slow: 0.3,   // замедление ×slow в slowR с вокруг фрага
  cut: 0.6,           // переход между кусками (наложение кадров), с
  startDelay: 1.3,    // повтор начинается через startDelay с после конца раунда (видно карточку раунда и баннер)
  emo: 2.2,           // эмоции: после последней реплики экран ещё стоит emo с
  typing: 0.45,       // реплика: «печатает…» перед фразой, с
  sayMin: 1.1,        // реплика держится до следующей не меньше, с (с голосом — пока голос не кончится, не дольше sayMax)
  sayMax: 3.6,
  quiet: 0.85,        // реплика без голоса — до следующей, с
  voices: 5,          // сколько реплик озвучено (клатчер, двое своих, двое соперников) — остальные только текстом
  intro: 0.7, outro: 0.5,
  tracer: 0.22        // след выстрела в повторе, с игры
};
var RP = {on: false, rec: null, last: null, P: null, enabled: true, mode: "auto", prevRs: null, kfSeen: null, lastTs: 0, holding: false};
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
// «Звук» (кнопка, 680): звук чата (chat_talk — присланный владельцем 15.10) на каждую реплику, свист на смену кадра, удар на фраг;
// голос — синтез речи браузера (speechSynthesis), язык — язык команды; выключить голос — «Инструменты → озвучка реплик»
var SHOW_TTS = true; try{ SHOW_TTS = localStorage.getItem("sim-tts") !== "0"; }catch(e){}
function showSnd(kind, g){
  if(typeof SND === "undefined" || !SND.on || !SND.ctx) return;
  try{
    if(kind === "chat"){ if(!sndPlay("chat_talk", g || 0.6, 0)) sndTone(0.12, 0.05, 1800, "sine"); }
    else if(kind === "whoosh"){ sndNoise((g || 0.22), 0.32, "bandpass", 900, 0.6); sndNoise((g || 0.22)*0.6, 0.45, "highpass", 3200, 0.4, 0.04); }
    else if(kind === "hit"){ sndTone(g || 0.22, 0.2, 95, "sine", 0, 45); sndNoise((g || 0.22)*0.8, 0.14, "lowpass", 420, 0.7); }
    else if(kind === "pop"){ sndTone(g || 0.1, 0.07, 1100, "triangle", 0, 1700); }
  }catch(e){}
}
function showSay(text, lang, lvl, who, onEnd){
  if(!SHOW_TTS || typeof SND === "undefined" || !SND.on || typeof speechSynthesis === "undefined") return false;
  try{
    var u = new SpeechSynthesisUtterance(String(text).toLowerCase()), L = lang === "en" ? "en-US" : "ru-RU", h = rpHash(who || "x");
    u.lang = L; u.pitch = 0.8 + (h % 40)/100; u.rate = lvl === 3 ? 1.15 : lvl === 1 ? 0.95 : 1.05; u.volume = (lvl === 1 ? 0.55 : lvl === 3 ? 1 : 0.85)*(SND.vol != null ? SND.vol : 0.85);
    var vs = speechSynthesis.getVoices().filter(function(v){ return v.lang && v.lang.toLowerCase().indexOf(L.slice(0, 2).toLowerCase()) === 0; });
    if(vs.length) u.voice = vs[h % vs.length];
    if(speechSynthesis.pending) speechSynthesis.cancel();   // не копить очередь: реплика, которая уже на экране, важнее старой
    if(onEnd){ u.onend = onEnd; u.onerror = onEnd; }
    speechSynthesis.speak(u); return true;
  }catch(e){ return false; }
}
function showHush(){ try{ if(typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); }catch(e){} }
var RP_NB = 9;   // чисел на игрока в снимке: x, y, взгляд, жив, hp, присел, этаж (-1 под полом / 1 над), плант(+)/дефуз(−) 0..1, ослеплён
function rpNum(v){ return typeof v === "number" && isFinite(v) ? v : NaN; }
// ---------- запись ----------
function rpNewRec(){
  var nk = {}; bots.forEach(function(b){ nk[b.id] = nick(b.id); });
  var NK = {}; for(var k in NICKS) NK[k] = NICKS[k];
  return {m: matchNum, round: roundNum, t0: tick, s: [], kills: [], tr: [], ev: [], vo: [], nick: nk, NK: NK, side: {CT: SIDE_TEAM.CT, T: SIDE_TEAM.T}, team: {CT: TEAM_NAME.CT, T: TEAM_NAME.T},
          logo: {CT: TEAM_LOGO.CT, T: TEAM_LOGO.T}, score0: {CT: score.CT, T: score.T}, solo: {}, lastBomb: bomb ? bomb.state : null};
}
function rpSample(R){
  var n = bots.length, B = new Float32Array(n*RP_NB);
  bots.forEach(function(b, i){ var o = i*RP_NB;
    var vf = b._visFacing !== undefined ? b._visFacing : b.facing;
    var zb = b._zArea || 0; if(HEIGHTS.over && HEIGHTS.over.length) zb = b._lvl > 0 ? 999 : b._lvl < 0 ? -999 : 0;
    var act = 0;
    if(b.planting) act = Math.max(0.01, Math.min(1, 1 - (b.plantUntil - tick)/PLANT_TICKS));
    else if(b.defusing){ var tot = b.kit ? DEFUSE_KIT_TICKS : DEFUSE_TICKS; act = -Math.max(0.01, Math.min(1, 1 - (b.defuseUntil - tick)/tot)); }
    B[o] = b.x; B[o+1] = b.y; B[o+2] = rpNum(vf); B[o+3] = b.alive ? 1 : 0; B[o+4] = b.hp; B[o+5] = b.crouching ? 1 : 0;
    B[o+6] = zb > 120 ? 1 : zb < -40 ? -1 : 0; B[o+7] = act; B[o+8] = tick < (b.blindUntil||0) ? 1 : 0;
  });
  var sm = [], fi = [], nd = [];
  smokes.forEach(function(s){ var r = smokeRadiusNow(s); if(r > 2) sm.push(s.x, s.y, r); });
  fires.forEach(function(f){ fi.push(f.x, f.y, fireRadiusNow(f)); });
  nadesInAir.forEach(function(q){ nd.push(q.x, q.y, q.team === "CT" ? 1 : 0, q.type === "smoke" ? 0 : q.type === "flash" ? 1 : q.type === "he" ? 2 : 3); });
  var bs = bomb ? bomb.state : null, ci = bomb && bomb.carrier ? bots.indexOf(bomb.carrier) : -1;
  return {t: tick, b: B, sm: sm, fi: fi, nd: nd, bomb: bs ? {st: bs, x: bomb.x, y: bomb.y, c: ci} : null, w: rpWorld()};
}
// (v463) мир тика для кадра повтора: то, что читает draw (620) — поля игроков, дым, огонь, гранаты, эффекты, бомба, вещи на земле
var RP_BF = ["x","y","z","alive","hp","crouching","facing","_visFacing","_reloading","reloadUntil","weapon","_zArea","_lvl","_under","_jump","blindUntil","state","tRole",
  "_knife","planting","defusing","plantUntil","defuseUntil","kit","onStairs","walking","_killHow","_sawEnemy","curSpeed","_idle","_idlePhase","holding","atPost"];
function rpCl(o){ var c = {}; for(var k in o){ var v = o[k]; c[k] = Array.isArray(v) ? v.slice() : v; } return c; }
function rpWorld(){
  var W = {tick: tick, b: bots.map(function(o){ var c = {}; RP_BF.forEach(function(k){ c[k] = o[k]; }); return c; }),
    sm: smokes.map(rpCl), fi: fires.map(rpCl), nd: nadesInAir.map(rpCl), fx: nadeFx.map(rpCl),
    bomb: bomb ? rpCl(bomb) : null, bc: bomb && bomb.carrier ? bots.indexOf(bomb.carrier) : -1};
  if(tick % 8 === 0){ W.gw = groundWeapons.map(rpCl); W.gi = groundItems.map(rpCl); }
  return W;
}
function rpIdByNick(nm){ for(var id in NICKS) if(NICKS[id] === nm) return id; return null; }
// после тиков кадра (680): записать, что изменилось; конец раунда — проверить клатч
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
      // новые выстрелы (по самим записям, а не по времени кадра)
      if(!RP.trSeen || RP.trSeen.r !== R) RP.trSeen = {r: R, set: new WeakSet()};
      tracers.forEach(function(q){ if(RP.trSeen.set.has(q)) return; RP.trSeen.set.add(q); var c = rpCl(q); c.t = tick; R.tr.push(c); });
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
  // (владелец 28.10) войс раунда со временем — в повторе слышно, что говорили в эфире (новые фразы — сверху списка)
  if(RP.rec && (rs === "live" || rs === "ending" || rs === "matchover")){
    if(!RP.voSeen || RP.voSeen.r !== RP.rec) RP.voSeen = {r: RP.rec, set: new WeakSet()};
    for(var vi = voiceLines.length - 1; vi >= 0; vi--){ var v = voiceLines[vi]; if(RP.voSeen.set.has(v)) continue; RP.voSeen.set.add(v);
      RP.rec.vo.push({t: tick, who: v.who, team: v.team, text: v.text, kind: v.kind}); }
  }
  // киллфид раунда — новые строки
  if(RP.rec && (rs === "live" || rs === "ending" || rs === "matchover")){
    if(!RP.kfSeen || RP.kfSeen.r !== RP.rec) RP.kfSeen = {r: RP.rec, set: typeof WeakSet !== "undefined" ? new WeakSet() : null, n: 0};
    var KS = RP.kfSeen;
    for(var j = killfeed.length - 1; j >= 0; j--){ var k = killfeed[j]; if(KS.set ? KS.set.has(k) : k._rp) continue; if(KS.set) KS.set.add(k); else k._rp = 1;
      if(k.kind !== "kill") continue;
      RP.rec.kills.push({t: Math.round((k.at||simTime)*TICK_HZ), att: rpIdByNick(k.att), vic: rpIdByNick(k.vic), attTeam: k.attTeam, vicTeam: k.vicTeam,
        w: k.w, hs: k.hs, smoke: k.smoke, wall: k.wall, noscope: k.noscope, blind: k.blind, attN: k.att, vicN: k.vic}); }
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
  var H = [], c = clutchInfo, kc = {}, k1 = {};
  R.kills.forEach(function(k){ if(!k.att || !k.vic || k.attTeam === k.vicTeam) return; kc[k.att] = (kc[k.att]||0) + 1; if(k1[k.att] == null) k1[k.att] = k.t; });
  var mk = function(id, side){ var me = teamBot(id); return {id: id, side: side, alive: !!(me && me.alive), hp: me ? me.hp : 0, kills: kc[id]||0}; };
  if(c && win && c.team === win && c.n >= RP_K.minN){ var h = mk(c.id, c.team); h.n = c.n; h.t = R.solo[c.id] || R.end; if((kc[c.id]||0) >= RP_K.multiN){ h.all = true; h.t = k1[c.id]; } H.push(h); }
  var two = [];
  bots.forEach(function(b){ if(H.length && H[0].id === b.id) return; var n = kc[b.id]||0;
    if(n >= RP_K.multiN){ var h2 = mk(b.id, b.team); h2.multi = true; h2.n = n; h2.t = k1[b.id]; H.push(h2); }
    else if(n === 2) two.push(b.id); });
  if(!H.length && two.length && (rpHash(R.m + "|" + R.round + "|two") % 1000)/1000 < RP_K.multi2){
    var id2 = two[rpHash(R.m + "|" + R.round + "|two2") % two.length], b2 = teamBot(id2); var h3 = mk(id2, b2.team); h3.multi = true; h3.n = 2; h3.t = k1[id2]; H.push(h3); }
  if(!H.length) return;
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
  R.kills.forEach(function(k){ if(k.att === C.id && k.vic && k.vicTeam !== C.side && k.t >= from) M.push({t: k.t, kind: "kill", k: k}); });
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
  var B = rpBuild(R), C = R.clutch, md = mode || rpMode(R, B);
  if(md === "emo") B.segs = [];
  RP.P = {R: R, mode: md, segs: B.segs, si: 0, rt: B.segs.length ? B.segs[0].a : R.end, phase: "intro", ph0: performance.now(), last: performance.now(),
          cam: null, feedShown: {}, ci: rpBotIdx(C.id)};
  RP.on = true;
  var tm = C.side, nm = R.nick[C.id];
  E.root.className = "on " + tm.toLowerCase() + (typeof HUD_REDUCED !== "undefined" && HUD_REDUCED ? " rm" : "");
  var what = C.multi ? (C.n >= 5 ? "Эйс" : C.n + " " + (C.n >= 5 ? "киллов" : "килла")) : "Клатч 1v" + C.n;
  E.title.innerHTML = '<div class="rp-t1">ПОВТОР</div><div class="rp-t2">' + what + '</div><div class="rp-t3 ' + tm.toLowerCase() + '">' + esc(nm) + ' · ' + esc(R.team[tm]) + '</div>';
  E.l3.innerHTML = (R.logo[tm] ? '<img alt="" src="' + R.logo[tm] + '">' : '') + '<div><b>' + esc(nm) + '</b><span>' + what.toLowerCase() + ' · раунд ' + R.round + '</span></div><i class="rp-k">0</i>';
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
  RP.on = false; RP.P = null; RP.holding = false; showHush();
  var E = rpEls(); if(E){ E.root.className = ""; E.emo.innerHTML = ""; if(E.vox){ E.vox.innerHTML = ""; E.vox._k = ""; } }
  if(typeof OBS !== "undefined") OBS.sc = 0;   // обсервер заново берёт камеру
}
// игра ждёт конца повтора: закупка кончается, а повтор ещё идёт (680: тики не считаются)
function rpHold(){
  var h = RP.on && ((roundState === "freeze" && simTime >= roundStartTime - 0.6) || (roundState === "matchover" && simTime - roundEndTime >= 6.5));
  RP.holding = h; return h;
}
// кадр: true — повтор нарисовал экран сам (обычный draw не нужен)
function rpFrame(ts){
  if(!RP.on && RP.pending && !paused){
    var Pn = RP.pending;
    if(roundState === "live" && roundNum !== Pn.rec.round) RP.pending = null;
    else if(simTime >= Pn.at){
      var Lh = Pn.rec.list || [Pn.rec.clutch], hh = Lh[Pn.i]; Pn.rec.clutch = hh; Pn.i++;
      // следующий повтор — если успевает до конца закупки (владелец: «если успеваешь — по очереди»)
      if(Pn.i > 1 && roundState === "freeze" && roundStartTime - simTime < rpEst(Pn.rec)){ RP.pending = null; }
      else { rpPlay(Pn.rec); RP.pending = Pn.i < Lh.length ? Pn : null; if(RP.pending) Pn.at = 0; }
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
// замедление вокруг фрагов клатча (плавно)
function rpSpeed(P){
  var sg = P.segs[P.si], best = 1; if(!sg) return 1;
  sg.m.forEach(function(m){ if(m.kind !== "kill" && m.kind !== "defuse") return; var d = Math.abs(P.rt - m.t)/TICK_HZ;
    if(d < RP_K.slowR){ var f = d/RP_K.slowR, v = RP_K.slow + (1 - RP_K.slow)*f*f; if(v < best) best = v; } });
  return best;
}
// снимок записи на дробный тик: между двумя соседними — плавно
function rpAt(R, t){
  var i = rpIndexAt(R, t), A = R.s[i], B = R.s[Math.min(R.s.length-1, i+1)];
  var f = B.t > A.t ? Math.max(0, Math.min(1, (t - A.t)/(B.t - A.t))) : 0;
  return {A: A, B: B, f: f};
}
function rpLerpAng(a, b, f){ if(isNaN(a)) return b; if(isNaN(b)) return a; var d = ((b - a + Math.PI*3) % (Math.PI*2)) - Math.PI; return a + d*f; }
function rpDraw(E, x, P, dt, W, H, dpr){
  P.drawn = true;
  var R = P.R, I = rpAt(R, P.rt), A = I.A, B = I.B, f = I.f, n = bots.length, ci = P.ci;   // (v463) x, dpr переопределяются после кадра игры
  var bx = function(i){ return A.b[i*RP_NB] + (B.b[i*RP_NB] - A.b[i*RP_NB])*f; }, by = function(i){ return A.b[i*RP_NB+1] + (B.b[i*RP_NB+1] - A.b[i*RP_NB+1])*f; };
  // камера: клатчер и ближайший живой враг (≤ 800) или тот, кого он убьёт / убил рядом по времени — оба в кадре
  var cx = bx(ci), cy = by(ci), tx = cx, ty = cy, span = 720, foe = -1, fd = 800;
  var sg = P.phase === "clip" || P.phase === "cut" ? P.segs[P.si] : null;
  if(sg) sg.m.forEach(function(m){ if(m.kind === "kill" && Math.abs(m.t - P.rt) < 1.6*TICK_HZ){ var vi = rpBotIdx(m.k.vic); if(vi >= 0){ var d = Math.hypot(bx(vi)-cx, by(vi)-cy); if(d < 900){ foe = vi; fd = -1; } } } });
  if(foe < 0) for(var i = 0; i < n; i++){ if(bots[i].team === R.clutch.side || !A.b[i*RP_NB+3]) continue; var d = Math.hypot(bx(i)-cx, by(i)-cy); if(d < fd){ fd = d; foe = i; } }
  // дефуз / плант клатчера — камера на нём, без дальних врагов
  if(A.b[ci*RP_NB+7]) foe = -1;
  if(foe >= 0){ var ox = bx(foe), oy = by(foe); tx = (cx + ox)/2; ty = (cy + oy)/2; span = Math.min(1150, Math.max(600, Math.hypot(ox-cx, oy-cy)*2.3)); }
  var slowNow = rpSpeed(P) < 0.9; if(slowNow && P.phase === "clip") span *= 0.86;
  var off = Math.hypot(tx-cx, ty-cy), om = 0.3*span; if(off > om){ tx = cx + (tx-cx)*om/off; ty = cy + (ty-cy)*om/off; }
  var top = H*0.09, bot = H*0.09, avH = H - top - bot, sc = Math.min(W, avH)/span;
  if(!P.cam) P.cam = {x: tx, y: ty, s: sc};
  var k = 1 - Math.exp(-dt*3.5), ks = 1 - Math.exp(-dt*2.2);
  P.cam.x += (tx - P.cam.x)*k; P.cam.y += (ty - P.cam.y)*k; P.cam.s += (sc - P.cam.s)*ks;
  var S = P.cam.s, ox0 = W/2 - P.cam.x*S, oy0 = top + avH/2 - P.cam.y*S;
  // (v463, владелец: «повтор без деталей, не тот дизайн, нет анимации стрельбы, взрыва») кадр повтора рисует сама игра (draw, 620) —
  // по записанному миру этого тика (rpWorldPut), со всеми эффектами; поверх — только подсветка клатчера и вспышка фрага
  rpWorldDraw(E, P, I, S, ox0, oy0, W, H);
  x = E.ctx; dpr = 1;
  x.setTransform(S,0,0,S,ox0,oy0);
  var L = 1/S;
  (function(){ var i = ci, px = bx(i), py = by(i);
    if(!A.b[i*RP_NB+3]) return;
    var rad = 7*L, pul = 1 + 0.12*Math.sin(performance.now()/180);
    x.strokeStyle = "rgba(255,214,110,.95)"; x.lineWidth = 2.4*L; x.beginPath(); x.arc(px, py, rad + 7*L*pul, 0, Math.PI*2); x.stroke();
    var nm = R.nick[bots[i].id]; x.font = "600 " + (10*L) + "px 'Roboto Condensed','Golos Text',sans-serif"; x.textAlign = "center"; var tw = x.measureText(nm).width;
    x.fillStyle = "rgba(11,15,11,.8)"; x.fillRect(px - tw/2 - 4*L, py + rad + 9*L, tw + 8*L, 13*L); x.fillStyle = "#ffe49a"; x.textBaseline = "top"; x.fillText(nm, px, py + rad + 10.5*L); x.textBaseline = "alphabetic";
  })();
  // фраг клатчера: вспышка-кольцо у жертвы
  if(sg) sg.m.forEach(function(m){ if(m.kind !== "kill") return; var a2 = (P.rt - m.t)/(0.7*TICK_HZ); if(a2 < 0 || a2 > 1) return; var vi = rpBotIdx(m.k.vic); if(vi < 0) return;
    x.strokeStyle = "rgba(255,228,150," + (1 - a2).toFixed(3) + ")"; x.lineWidth = 3*L; x.beginPath(); x.arc(bx(vi), by(vi), (10 + 34*a2)*L, 0, Math.PI*2); x.stroke(); });
  x.setTransform(1,0,0,1,0,0);
  rpSound(P, R, ci);
}
// (v461) звук повтора: выстрелы и дефуз в свой момент клипа, громкость — по камере повтора. Звуковой движок (680) меряет расстояние от
// центра живого радара — поэтому точка звука переносится: живой центр + (точка − центр камеры повтора). Заплатка (одно место звука)
function rpSound(P, R, ci){
  if(!SND || !SND.on || !SND.ctx || !P.cam) return;
  var from = P.sndRt == null || P.sndRt > P.rt ? P.rt - 1 : P.sndRt; P.sndRt = P.rt;
  if(P.phase !== "clip") return;
  var r = cv.getBoundingClientRect(), c = navScreenToWorld(r.left + r.width/2, r.top + r.height/2);
  var mv = function(x, y){ return {x: c.x + (x - P.cam.x), y: c.y + (y - P.cam.y)}; }, n = 0;
  for(var j = rpTrFrom(R, from); j < R.tr.length && R.tr[j].t <= P.rt && n < 3; j++){ var T = R.tr[j]; if(T.t <= from) continue;
    var q = mv(T.x1, T.y1); sndShot(T.wk ? {key: T.wk, silenced: T.sil} : {key: T.wc === "awp" ? "AWP" : T.wc === "deagle" ? "DEAGLE" : T.wc === "pistol" ? "USP" : T.wc === "smg" ? "MP9" : "M4"}, q.x, q.y); n++; }   // (v465) звук — точного оружия выстрела (wk, глушитель), раньше — по классу следа: AK звучал как M4
  var I = rpAt(R, P.rt), J = rpAt(R, from), a1 = I.A.b[ci*RP_NB+7], a0 = J.A.b[ci*RP_NB+7];
  if(a1 < 0 && !(a0 < 0)){ var q2 = mv(I.A.b[ci*RP_NB], I.A.b[ci*RP_NB+1]); sndBomb("defuse", q2.x, q2.y); }
  R.kills.forEach(function(k){ if(k.att === R.clutch.id && k.t > from && k.t <= P.rt) showSnd("hit", 0.25); });
  R.ev.forEach(function(e){ if(e.kind === "defuse" && e.t > from && e.t <= P.rt){ var q3 = mv(I.A.b[ci*RP_NB], I.A.b[ci*RP_NB+1]); sndBomb("defused", q3.x, q3.y); } });
}
// подставить записанный мир в игру на один вызов draw и вернуть всё обратно (игра этого не видит: между тиками, без изменений)
function rpWorldDraw(E, P, I, S, ox0, oy0, W, H){
  var R = P.R, A = I.A.w, B = (I.B && I.B.w) || A, f = I.f; if(!A){ return; }
  var keep = {tick: tick, simTime: simTime, roundNum: roundNum, roundState: roundState, accumulator: accumulator, smokes: smokes, fires: fires, nadesInAir: nadesInAir,
    nadeFx: nadeFx, bomb: bomb, tracers: tracers, soundPings: soundPings, groundWeapons: groundWeapons, groundItems: groundItems, teamTac: teamTac,
    FREEZE_FX: FREEZE_FX, SIDE_TEAM: SIDE_TEAM, NICKS: NICKS, cv: cv, ctx: ctx, view: {scale: view.scale, panX: view.panX, panY: view.panY}};
  var saved = bots.map(function(o){ var c = {px: o.px, py: o.py, pfacing: o.pfacing, path: o.path, _trail: o._trail}; RP_BF.forEach(function(k){ c[k] = o[k]; }); return c; });
  var gw = null, gi = null; for(var j = R.s.indexOf(I.A); j >= 0; j--){ var w = R.s[j].w; if(w && w.gw){ gw = w.gw; gi = w.gi; break; } }
  try{
    tick = A.tick; simTime = tick*TICK_MS/1000; roundNum = R.round; roundState = "live"; accumulator = f*TICK_MS;
    smokes = A.sm; fires = A.fi; nadesInAir = A.nd; nadeFx = A.fx; groundWeapons = gw || []; groundItems = gi || [];
    bomb = A.bomb ? rpCl(A.bomb) : null; if(bomb) bomb.carrier = A.bc >= 0 ? bots[A.bc] : null;
    var t0 = rpTrFrom(R, P.rt - 0.5*TICK_HZ), tl = [];
    for(var q = t0; q < R.tr.length && R.tr[q].t <= P.rt; q++){ var c = rpCl(R.tr[q]); c.born = nowTs - (P.rt - c.t)*TICK_MS; c.tk = null; tl.push(c); }
    tracers = tl; soundPings = []; teamTac = {T: null, CT: keep.teamTac && keep.teamTac.CT}; FREEZE_FX = [];
    if(R.side){ SIDE_TEAM = R.side; } if(R.NK){ NICKS = R.NK; }
    bots.forEach(function(o, i){ var a = A.b[i], b2 = B.b[i]; RP_BF.forEach(function(k){ o[k] = b2[k]; });
      o.px = a.x; o.py = a.y; o.pfacing = a._visFacing !== undefined ? a._visFacing : a.facing; o.path = null; o._trail = []; });
    cv = E.cv; ctx = E.ctx; view.scale = S; view.panX = ox0; view.panY = oy0;
    draw.noHud = true; draw();
  } catch(e){ /* кадр повтора не нарисовался — дальше игра не страдает: всё возвращается ниже */ }
  finally {
    draw.noHud = false;
    bots.forEach(function(o, i){ var c = saved[i]; RP_BF.forEach(function(k){ o[k] = c[k]; }); o.px = c.px; o.py = c.py; o.pfacing = c.pfacing; o.path = c.path; o._trail = c._trail; });
    tick = keep.tick; simTime = keep.simTime; roundNum = keep.roundNum; roundState = keep.roundState; accumulator = keep.accumulator;
    smokes = keep.smokes; fires = keep.fires; nadesInAir = keep.nadesInAir; nadeFx = keep.nadeFx; bomb = keep.bomb; tracers = keep.tracers; soundPings = keep.soundPings;
    groundWeapons = keep.groundWeapons; groundItems = keep.groundItems; teamTac = keep.teamTac; FREEZE_FX = keep.FREEZE_FX; SIDE_TEAM = keep.SIDE_TEAM; NICKS = keep.NICKS;
    cv = keep.cv; ctx = keep.ctx; view.scale = keep.view.scale; view.panX = keep.view.panX; view.panY = keep.view.panY;
  }
}
function rpTrFrom(R, t){ var lo = 0, hi = R.tr.length; while(lo < hi){ var mid = (lo + hi) >> 1; if(R.tr[mid].t < t) lo = mid + 1; else hi = mid; } return lo; }
// киллфид повтора: строки появляются в момент фрага; счётчик фрагов клатча
function rpFeed(E, P){
  if(P.phase !== "clip" && P.phase !== "cut") return;
  var R = P.R, C = R.clutch, add = false, kc = 0;
  R.kills.forEach(function(k, i){ if(k.t > P.rt) return; if(k.att === C.id && k.vicTeam !== C.side) kc++;
    if(P.feedShown[i] || P.rt - k.t > 4*TICK_HZ) return; if(k.t < P.segs[P.si].a - 0.2*TICK_HZ) return; P.feedShown[i] = 1; add = true;
    var W = WEAPONS[k.w], wn = W ? W.name : k.w, wkey = k.w === "KNIFE" && k.attTeam === "T" ? "KNIFE_T" : k.w;
    var row = document.createElement("div"); row.className = "kf" + (k.att === C.id ? " me" : "");
    var h = k.attN ? '<span class="' + String(k.attTeam).toLowerCase() + '">' + esc(k.attN) + '</span>' : '';
    h += (typeof kfSvg === "function" && kfSvg(wkey, "wp", wn)) || '<span class="w">' + esc(wn) + '</span>';
    ["smoke","wall","hs","noscope","blind"].forEach(function(m){ if(k[m] && typeof kfSvg === "function") h += kfSvg(m, "md", KF_MOD_T[m]); });
    row.innerHTML = h + '<span class="' + String(k.vicTeam).toLowerCase() + '">' + esc(k.vicN) + '</span>';
    E.feed.insertBefore(row, E.feed.firstChild); while(E.feed.children.length > 5) E.feed.removeChild(E.feed.lastChild); });
  var ke = E.l3.querySelector(".rp-k"); if(ke && ke.textContent !== String(kc)){ ke.textContent = String(kc); ke.classList.remove("pop"); void ke.offsetWidth; ke.classList.add("pop"); }
}
// размытие фона без filter (дёшево): последний кадр — в маленький холст и обратно, растянутым, плюс затемнение
function rpBlurBg(E, x){
  var c = E.cv, s = document.createElement("canvas"); s.width = Math.max(8, Math.round(c.width/14)); s.height = Math.max(8, Math.round(c.height/14));
  var sx = s.getContext("2d"); sx.imageSmoothingEnabled = true; sx.drawImage(c, 0, 0, s.width, s.height);
  var m = document.createElement("canvas"); m.width = Math.max(8, Math.round(c.width/5)); m.height = Math.max(8, Math.round(c.height/5));
  var mx = m.getContext("2d"); mx.imageSmoothingEnabled = true; mx.drawImage(s, 0, 0, m.width, m.height);
  x.setTransform(1,0,0,1,0,0); x.imageSmoothingEnabled = true; x.drawImage(m, 0, 0, c.width, c.height);
  x.fillStyle = "rgba(6,8,6,.55)"; x.fillRect(0, 0, c.width, c.height);
}
// ---------- эмоции: портреты в строчку, что кричат и что последним сказали ----------
// Реакции — проектные фразы (показ, владелец 28.10): живые, разговорные, с матом, разной громкости — не все орут: кто-то просто «nice»,
// проигравшие чаще спокойно («nt», «ладно, следующий»). Громкость — значок в начале фразы: «!» — крик (заглавными, встряска),
// без значка — обычным голосом, «~» — тихо. Язык — язык войса команды (Falcons — английский, Spirit — русский); русскоговорящие
// в англоязычной команде иногда срываются на русский, и тиммейты подхватывают («хорош, братан», «бля, nice») — пул mix.
// Вариант — от номера матча/раунда и игрока (повтор того же раунда — те же фразы).
var RP_LANG = {"Team Falcons": "en", "Team Spirit": "ru"};
var RP_RU = {"m0NESY": 1, "kyousuke": 1, "donk": 1, "sh1ro": 1, "zont1x": 1, "magixx": 1};   // говорят по-русски
var RP_SAY = {
  ru: {
    hero: ["!ДА БЛЯТЬ!", "!ИЗИ НАХУЙ!", "!ЗАБРАЛ, СУКА!", "!ДАААА, ЕБАТЬ!", "!ВОТ ЭТО Я ВЫДАЛ!", "!КТО ТАМ ГОВОРИЛ, ЧТО Я НЕ ВЫВОЖУ?!",
      "!АХАХАХ, ДА-ДА-ДА!", "!ОДИН НА {n}, ИЗИ!", "!ПОГНАЛИ, БЛЯТЬ!", "!Я ЖЕ ГОВОРИЛ — ДАЙТЕ ВРЕМЯ!", "!ЕСТЬ!!!", "!ВСЁ, ВСЁ, ВСЁ!",
      "всё, раунд наш", "спокойно, пацаны, спокойно", "ну а кто, если не я", "изи, без нервов", "я знал, что он туда полезет",
      "хорошо, что не спешил", "чё, нормально же", "так и задумывалось", "ну я ж сказал — сейв не нужен", "гоу дальше",
      "~фух…", "~руки трясутся, бля", "~ладно, это было стрёмно", "~сердце сейчас выпрыгнет", "~повезло, честно", "~воды дайте"],
    heroLow: ["!НА {hp} ХП, БЛЯТЬ!", "!С {hp} ХП ЗАБРАЛ, Я ЕБУ!", "на {hp} хп, ребят… на {hp}", "{hp} хп, но кого это волнует",
      "~{hp} хп, я чуть не сдох", "~на {hp} хп… я сам в шоке"],
    mate: ["!ЕБАТЬ ТЫ ВЫДАЛ!", "!ДА ЛАДНО, ОДИН НА {n}!", "!КРАСАВА, БРАТ!", "!ТЫ ЁБАНЫЙ МОНСТР!", "!ЛЮТЫЙ, СУКА!", "!АХАХА, НУ ТЫ ЗВЕРЬ!",
      "!ЗАБИРАЙ… ЗАБРАЛ!", "!ДАВАЙ-ДАВАЙ-ДАВАЙ… ДААА!", "!ВОТ ЭТО ДА!", "!ХОРОШ, ХОРОШ!", "!ДАААА!", "!ПОГНАЛИ!",
      "найс", "найс, брат", "красавчик", "хорош", "сильно", "ну ты дал", "вот это ты молодец", "лучший", "ну ты машина",
      "вот это я понимаю", "держи пять", "чисто сыграл", "ахах, ну ты даёшь", "так и надо",
      "~найс…", "~я в шоке, честно", "~ну красиво, чё", "~ладно, ты гений", "~ну всё, раунд", "~хорош"],
    mateHype: ["!ЭТО ЧТО ВООБЩЕ БЫЛО?!", "!1 НА {n}, Я В АХУЕ!", "!ЕБАТЬ, ЭТО В ХАЙЛАЙТЫ!", "!КЛИПАЙТЕ, КЛИПАЙТЕ!", "!ОН ОДИН ВСЕХ ВЫНЕС!",
      "1 на {n}… я молчу", "это просто нереально", "~я не знаю, что сказать"],
    mateAlive: ["я тут чисто для массовки, ахах", "красава, я прикрывал", "!ДАААА!", "~я даже не стрелял", "!ХОРОШ, БРАТ!", "найс, вместе вытащили"],
    victim: ["да как он меня, блять", "сука, он же один был", "откуда он вылез?", "я его вообще не видел", "сразу в башку, пиздец",
      "бля, я рано вышел", "ну тут я сам виноват", "надо было ждать", "он чё, читер?", "ну это знать надо было",
      "~nice, чё", "~сильно сыграл", "~ну ладно", "~не повезло", "~бывает", "~он хорош, признаю", "!КАК?!", "!ДА ЛАДНО?!"],
    loserAlive: ["бля, я не успел", "сорян, пацаны", "ну я ж бежал…", "мне бы секунду", "~не успел, сорри", "~бомба далеко была",
      "~ну, дефузил же почти", "!БЛЯЯЯТЬ!"],
    loser: ["~нт", "~ладно, следующий", "~найс трай, пацаны", "~собираемся", "~ничего, ничего", "~бывает", "~обидно", "~окей, ресет",
      "~голову не вешаем", "~норм играли, просто он выдал", "сильно он, чё", "минус раунд, ладно", "собрались, следующий",
      "ну это пиздец", "как это можно отдать?", "надо было вдвоём идти", "ну тут без шансов", "!НУ КАК?!", "!ЁБАНЫЙ КЛАТЧ!"]
  },
  en: {
    hero: ["!LET'S FUCKING GOOO!", "!EZ CLAP!", "!WHO ELSE?!", "!TOO EASY!", "!I'M HIM!", "!1V{n}, BABY!", "!YEEEES!", "!COME ON!",
      "!WHAT DID I SAY?!", "!GET IN!", "!ONE MORE TIME!", "calm, calm, calm", "that's our round", "ez, no stress", "knew he'd peek there",
      "patience, boys", "told you, no save", "just how we planned it", "next round, let's go", "~holy…", "~my hands are shaking",
      "~okay, that was close", "~phew", "~lucky, honestly", "~need some water"],
    heroLow: ["!{hp} HP, BABY!", "!ON {hp} HP, LET'S GO!", "{hp} hp… {hp}!", "{hp} hp, who cares", "~{hp} hp, I almost died"],
    mate: ["!WHAT THE FUCK?!", "!HOLY SHIT!", "!1V{n}, ARE YOU KIDDING ME?!", "!INSANE, BRO!", "!YOU'RE A MONSTER!", "!NICE NICE NICE!",
      "!LET'S GOOO!", "!BIG BIG BIG!", "!THAT'S MY BOY!", "!YES YES YES!", "nice", "nice one", "well played", "huge", "clean",
      "beast", "so good, man", "you're crazy", "that's how it's done", "gimme five", "~nice…", "~wow", "~gg, he's cracked",
      "~unreal, bro", "~okay, round"],
    mateHype: ["!1V{n}?! WHAT IS THIS?!", "!ACTUAL MADMAN!", "!HE'S NOT HUMAN!", "!CLIP IT! CLIP IT!", "1v{n}… I'm speechless",
      "that's absurd", "~I have no words"],
    mateAlive: ["I just watched, lol", "!NICE, I HAD YOUR BACK!", "~I didn't even shoot", "!YEEES!", "we got it together, nice"],
    victim: ["how the fuck...", "he was alone, man", "where did he come from?", "no way, dude", "didn't even see him", "my bad, peeked too early",
      "should've waited", "is he walling? lol", "~nice", "~nh", "~he played it well", "~unlucky", "~fair enough", "!HOW?!", "!NO WAY!"],
    loserAlive: ["fuck, too late", "my bad, guys", "couldn't make it...", "needed one more second", "~sorry, too far", "~almost had the defuse",
      "!FUUUCK!"],
    loser: ["~nt", "~nice try, guys", "~next one", "~it's fine, reset", "~unlucky", "~heads up", "~gg on that one", "~we played it fine",
      "he's good, man", "unreal...", "can't lose that round", "reset, next one", "that's on us", "should've gone together",
      "!HOW?!", "!ARE YOU SERIOUS?!"]
  },
  // русский в англоязычной команде: русскоговорящие — часто, остальные — иногда подхватывают
  mix: {
    hero: ["!ДАВАЙ, БЛЯ! LET'S GO!", "!ИЗИ, BOYS!", "!SUKA, YES!", "!ЕСТЬ! EZ!", "~фух, guys", "ez, братва"],
    mate: ["!HOROSH, BRATAN!", "!БЛЯ, NICE!", "!DAVAI DAVAI DAVAI!", "!SUKA, INSANE!", "!ХАРОШ!", "!BRATAN, WHAT?!",
      "nice, братан", "хорош, хорош", "~бля, nice", "!ЕБАТЬ, WHAT A CLUTCH!", "krasava, man", "~харош, bro"],
    loser: ["~бля… nt", "~ладно, next", "!СУКА!", "~ну ок, reset", "~blyat, unlucky"]
  }
};
function rpHash(s){ var h = 2166136261 >>> 0; s = String(s); for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
// фраза и громкость: {t, lvl: 3 крик / 2 обычно / 1 тихо}
function rpPick(list, key, R){
  if(!list || !list.length) return {t: "", lvl: 2};
  var t = list[rpHash(R.m + "|" + R.round + "|" + key) % list.length], lvl = 2;
  if(t.charAt(0) === "!"){ lvl = 3; t = t.slice(1); } else if(t.charAt(0) === "~"){ lvl = 1; t = t.slice(1); }
  t = t.split("{n}").join(R.clutch.n).split("{hp}").join(Math.max(1, Math.round(R.clutch.hp||0)));
  return {t: lvl === 3 ? t.toUpperCase() : t, lvl: lvl};
}
// что говорит игрок: ситуация → категория; язык команды; русскоговорящий в англоязычной команде (или его тиммейт) — иногда mix
function rpSay(R, id, side){
  var C = R.clutch, st = R.st[id] || {}, win = side === C.side, hero = id === C.id, cat;
  if(win) cat = hero ? (C.hp > 0 && C.hp <= 30 && rpHash(R.round + "lo" + id) % 2 ? "heroLow" : "hero") : st.alive ? "mateAlive" : (C.n >= 3 && rpHash(R.round + "hy" + id) % 3 === 0 ? "mateHype" : "mate");
  else cat = st.killer === C.id ? "victim" : st.alive ? "loserAlive" : "loser";
  var lang = RP_LANG[R.team[side]] || "ru", nm = R.nick[id] || id;
  if(lang === "en"){
    var ruMe = !!RP_RU[nm], ruMate = Object.keys(R.nick).some(function(o){ return o !== id && bots.some(function(b){ return b.id === o && b.team === side; }) && RP_RU[R.nick[o]]; });
    var u = (rpHash(R.m + "|" + R.round + "|mix|" + id) % 100)/100, mixCat = cat === "heroLow" ? "hero" : cat === "mateHype" || cat === "mateAlive" ? "mate" : cat === "victim" || cat === "loserAlive" ? "loser" : cat;
    if(RP_SAY.mix[mixCat] && ((ruMe && u < 0.4) || (!ruMe && ruMate && win && u < 0.15))) return rpPick(RP_SAY.mix[mixCat], id + "m", R);
  }
  return rpPick(RP_SAY[lang][cat], id, R);
}
// (v465, владелец: «фразы уже готовые висят — надо как на паузах, что они говорят по очереди») реакции — по очереди: карточка
// подсвечивается, над ней «…» (печатает), потом фраза, звук чата и голос; следующий — когда голос кончился (без голоса — через RP_K.quiet с).
// Сказанное остаётся, приглушённое. Порядок: клатчер → свои → соперники (сначала его жертвы). Раньше 10 голосов запускались за 1,5 с
// и сбрасывали друг друга (showSay отменяет очередь) — слышно было одну-две реплики
function rpTalkOrder(R){
  var C = R.clutch, win = C.side, lose = win === "CT" ? "T" : "CT", L = [];
  var ids = function(side){ return bots.filter(function(b){ return b.team === side; }).map(function(b){ return b.id; }); };
  var w = ids(win).filter(function(id){ return id !== C.id; }).sort(function(a, b){ return rpSay(R, b, win).lvl - rpSay(R, a, win).lvl; });
  var l = ids(lose).sort(function(a, b){ var sa = R.st[a] || {}, sb = R.st[b] || {}; return ((sb.killer === C.id) - (sa.killer === C.id)) || (rpSay(R, b, lose).lvl - rpSay(R, a, lose).lvl); });
  L.push({id: C.id, side: win}); w.forEach(function(id){ L.push({id: id, side: win}); }); l.forEach(function(id){ L.push({id: id, side: lose}); });
  var vw = 0, vl = 0;
  L.forEach(function(q){ q.say = rpSay(R, q.id, q.side); q.lang = RP_LANG[R.team[q.side]] || "ru";
    q.voice = q.id === C.id || (q.side === win ? vw++ < 2 : vl++ < 2); });
  return L;
}
function rpTalkCard(E, q){ var c = E.emo.querySelector('.rp-card[data-id="' + q.id + '"]'); return {c: c, s: c && c.querySelector(".rp-say")}; }
function rpTalkStart(E, T, now){
  var q = T.L[T.i], k = rpTalkCard(E, q); T.st = "type"; T.t0 = now;
  if(k.c) k.c.classList.add("talking"); if(k.s) k.s.className = "rp-say lvl" + q.say.lvl + " typing";
}
// true — все сказали и экран постоял RP_K.emo с
function rpTalkTick(E, P, now){
  var T = P.talk; if(!T) return true;
  var el = (now - T.t0)/1000;
  if(T.i >= T.L.length) return el >= RP_K.emo;
  if(T.st === "wait"){ if(el >= 0.9) rpTalkStart(E, T, now); return false; }   // портреты встали — первый начинает
  var q = T.L[T.i], k = rpTalkCard(E, q);
  if(T.st === "type"){
    if(el < RP_K.typing) return false;
    T.st = "say"; T.t0 = now; T.voiceEnd = true;
    if(k.s) k.s.className = "rp-say lvl" + q.say.lvl + " in";
    showSnd("chat", q.say.lvl === 1 ? 0.35 : 0.6);
    if(q.voice){ var tk = T.tok = {}; T.voiceEnd = false; if(!showSay(q.say.t, q.lang, q.say.lvl, q.id, function(){ if(T.tok === tk) T.voiceEnd = true; })) T.voiceEnd = true; }
    return false;
  }
  if(el < (q.voice ? RP_K.sayMin : RP_K.quiet) || (!T.voiceEnd && el < RP_K.sayMax)) return false;
  if(k.c){ k.c.classList.remove("talking"); k.c.classList.add("said"); }
  T.i++; T.t0 = now; if(T.i < T.L.length) rpTalkStart(E, T, now);
  return false;
}
function rpEmotions(E, R, P){
  var C = R.clutch, win = C.side, lose = win === "CT" ? "T" : "CT";
  var row = function(side, mood){
    var ids = bots.filter(function(b){ return b.team === side; }).map(function(b){ return b.id; });
    if(side === win){ ids.sort(function(a, b){ return (a === C.id ? 0 : 1) - (b === C.id ? 0 : 1); }); var c0 = ids.shift(); ids.splice(Math.floor(ids.length/2), 0, c0); }
    return '<div class="rp-row ' + mood + ' ' + side.toLowerCase() + '">' + ids.map(function(id, i){
      var st = R.st[id] || {}, hero = id === C.id, say = rpSay(R, id, side);
      var vx = R.vox && R.vox[id];
      var pp = PLAYER_PHOTO[R.nick[id]], ph = pp ? '<img alt="" src="' + pp + '">' : PL_SIL;   // (v463) фото — того, кто играл раунд (после раунда стороны могли смениться)
      return '<div class="rp-card' + (hero ? ' hero' : '') + (st.alive ? '' : ' dead') + '" data-id="' + id + '" style="--i:' + i + '">' +
        '<div class="rp-say lvl' + say.lvl + '"><b>' + esc(say.t) + '</b><u><i></i><i></i><i></i></u></div>' +
        '<div class="rp-ph">' + ph + '</div>' +
        '<div class="rp-nm"><span>' + esc(R.nick[id] || id) + '</span>' + (st.k ? '<i>' + st.k + ' уб.</i>' : '') + '</div>' +
        '<div class="rp-vx" title="последнее в войсе за раунд">' + (vx ? '«' + esc(vx) + '»' : '') + '</div></div>';
    }).join("") + '</div>';
  };
  E.emo.innerHTML =
    '<div class="rp-eh ' + win.toLowerCase() + '">' + (R.logo[win] ? '<img alt="" src="' + R.logo[win] + '">' : '') + '<span>' + esc(R.team[win]) + '</span><em>клатч 1v' + C.n + ' — ' + esc(R.nick[C.id]) + '</em></div>' +
    row(win, "hype") +
    '<div class="rp-eh2 ' + lose.toLowerCase() + '">' + esc(R.team[lose]) + ' — реакция</div>' +
    row(lose, "sad") +
    (function(){ var V = rpVoiceClutch(R); if(!V.length) return "";
      return '<div class="rp-air"><div class="rp-air-h">в эфире во время клатча</div>' + V.map(function(v, i){
        return '<div class="rp-vl ' + String(v.team).toLowerCase() + '" style="--i:' + i + '"><b>' + esc(v.who) + '</b><span>' + esc(v.text) + '</span></div>'; }).join("") + '</div>'; })();
  P.talk = {L: rpTalkOrder(R), i: 0, st: "wait", t0: performance.now()};
}
// ---------- переход к раунду (найти и посмотреть клатч): #round=матч.раунд в адресе или rpGoto(матч, раунд) ----------
// Матч перематывается тиками без отрисовки до закупки нужного раунда — дальше идёт обычным ходом (тот же матч бит в бит)
// (v462) мгновенный переход: готовый снимок игры на закупке раунда (посчитан на ПК, tools/snap_round.js; лежит в хранилище файлов
// страницы) — открывается как снимок отметки (mkOpenSnap), дальше игра идёт теми же тиками. Нет снимка или не загрузился — rpGoto
// снимки v461 (м17 р27 и м13 р7, tools/snap_round.js на ПК, прогон pc-results/113: восстановление — бит в бит); лежат в хранилище файлов
// опубликованной страницы Ancient (артефакт владельца); fp — отпечаток настроек, при котором снимок считался
var RP_SNAPS = {"17.27": {url: "/_blob/796483b1a08520d9144489538cc82d9a", fp: "1gecw3a"}, "13.7": {url: "/_blob/f3db2bee0eb3f72bc4f1e76a4fbc0e4a", fp: "1gecw3a"}};
function rpJump(m, r){
  var u = RP_SNAPS[m + "." + r];
  if(!u || typeof mkOpenSnap !== "function" || typeof fetch !== "function"){ rpGoto(m, r); return; }
  var tg = document.createElement("div"); tg.className = "mk-prog"; tg.textContent = "открываю матч " + m + ", раунд " + r + "…"; wrap.appendChild(tg);
  fetch(u.url).then(function(q){ if(!q.ok) throw new Error("HTTP " + q.status); return q.text(); }).then(function(t){
    if(WARM.on) WARM = {on: false};
    if(RP.on) rpEnd(); RP.rec = null; RP.pending = null; if(typeof TS !== "undefined"){ TS.lastRound = -1; if(TS.P) tsEnd(); }
    mkOpenSnap(t); tg.remove(); paused = false;
    var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); }
    if(typeof OBS !== "undefined") OBS.sc = 0;
    logEvent("Матч №" + m + ", раунд " + roundNum + " — открыт из готового снимка", true);
    if(u.fp && typeof mkFp === "function" && mkFp() !== u.fp) showBanner("Свои правки карты или настройки — дальше матч может пойти иначе", null, 3500);
  }).catch(function(e){ tg.remove(); logEvent("Снимок не открылся (" + (e && e.message) + ") — перематываю тиками", true); rpGoto(m, r); });
}
function rpGoto(m, r){
  m = Math.max(1, m|0); r = Math.max(1, r|0);
  freshMatch(m); paused = true; RP.rec = null; RP.pending = null; if(RP.on) rpEnd();
  var M0 = matchNum, tg = document.createElement("div"); tg.className = "mk-prog"; tg.textContent = "перематываю к раунду " + r + "…"; wrap.appendChild(tg);
  var step = function(){
    var t0 = performance.now();
    while(performance.now() - t0 < 40){
      if(matchNum !== M0 || roundNum > r || (roundNum === r && roundState === "freeze")){
        tg.remove(); paused = false; var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); }
        if(typeof logEvent === "function") logEvent("Матч №" + m + ", раунд " + roundNum + " — перемотано", true); return; }
      stepTick();
    }
    tg.textContent = "перематываю к раунду " + r + "… сейчас " + roundNum; setTimeout(step, 0);
  };
  step();
}
(function(){
  if(typeof document === "undefined") return;
  var c = document.getElementById("chkRp"); if(c){ c.checked = RP.enabled; c.addEventListener("change", function(){ RP.enabled = c.checked; try{ localStorage.setItem("sim-rp", c.checked ? "1" : "0"); }catch(e){} if(!c.checked && RP.on) rpStop(); }); }
  var sm = document.getElementById("selRp"); if(sm){ sm.value = RP.mode; sm.addEventListener("change", function(){ RP.mode = sm.value; try{ localStorage.setItem("sim-rp-mode", sm.value); }catch(e){} }); }
  var b = document.getElementById("btnRpLast"); if(b) b.addEventListener("click", function(){ if(RP.last){ rpPlay(RP.last, RP.mode === "auto" ? "both" : RP.mode); } else if(typeof showBanner === "function") showBanner("Клатча в этом матче ещё не было", null, 1800); });
  var hm = /(?:^|[#&])round=(\d+)\.(\d+)/.exec(location.hash || ""); if(hm) setTimeout(function(){ rpGoto(+hm[1], +hm[2]); }, 300);
})();
