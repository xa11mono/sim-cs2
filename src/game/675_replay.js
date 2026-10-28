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
  pre: 2, post: 1.1,  // клип: за pre с до момента и post с после
  merge: 1.6,         // моменты ближе merge с — один кусок
  maxClip: 20,        // клип длиннее maxClip с игры — короче запас до и после
  slowR: 0.45, slow: 0.3,   // замедление ×slow в slowR с вокруг фрага
  cut: 0.5,           // переход между кусками (затемнение), с
  startDelay: 1.3,    // повтор начинается через startDelay с после конца раунда (видно карточку раунда и баннер)
  emo: 7,             // эмоции игроков, с
  intro: 0.7, outro: 0.5,
  tracer: 0.22        // след выстрела в повторе, с игры
};
var RP = {on: false, rec: null, last: null, P: null, enabled: true, prevRs: null, kfSeen: null, lastTs: 0, holding: false};
try{ RP.enabled = localStorage.getItem("sim-rp") !== "0"; }catch(e){}
var RP_NB = 9;   // чисел на игрока в снимке: x, y, взгляд, жив, hp, присел, этаж (-1 под полом / 1 над), плант(+)/дефуз(−) 0..1, ослеплён
function rpNum(v){ return typeof v === "number" && isFinite(v) ? v : NaN; }
// ---------- запись ----------
function rpNewRec(){
  var nk = {}; bots.forEach(function(b){ nk[b.id] = nick(b.id); });
  return {m: matchNum, round: roundNum, t0: tick, s: [], kills: [], tr: [], ev: [], nick: nk, team: {CT: TEAM_NAME.CT, T: TEAM_NAME.T},
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
  return {t: tick, b: B, sm: sm, fi: fi, nd: nd, bomb: bs ? {st: bs, x: bomb.x, y: bomb.y, c: ci} : null};
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
      // выстрелы этого кадра (tracers.born — время кадра)
      tracers.forEach(function(q){ if(q.born > RP.lastTs) R.tr.push({t: tick, x1: q.x1, y1: q.y1, x2: q.x2, y2: q.y2, team: q.team, hit: !!q.hit, head: !!q.head}); });
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
  var c = clutchInfo;
  if(!(c && win && c.team === win && c.n >= RP_K.minN)) return;
  var me = teamBot(c.id);
  R.clutch = {id: c.id, side: c.team, n: c.n, alive: !!(me && me.alive), hp: me ? me.hp : 0, kills: me ? (me.roundKills||0) : 0};
  // войс раунда: последнее, что сказал каждый (voiceLines — новые сверху)
  R.vox = {};
  voiceLines.forEach(function(v){ var id = rpIdByNick(v.who); if(id && !R.vox[id] && v.kind !== "death") R.vox[id] = v.text; });
  R.st = {}; bots.forEach(function(b){ R.st[b.id] = {alive: b.alive, hp: b.hp, k: b.roundKills||0, killer: b._killer || null}; });
  RP.last = R;
  if(RP.enabled && typeof document !== "undefined") RP.pending = {rec: R, at: R.endSim + RP_K.startDelay};
}
// ---------- клип: куски вокруг моментов клатча ----------
function rpBuild(R){
  var C = R.clutch, from = (R.solo[C.id] || R.t0) - RP_K.pre*TICK_HZ, M = [];
  R.kills.forEach(function(k){ if(k.att === C.id && k.vic && k.vicTeam !== C.side && k.t >= from) M.push({t: k.t, kind: "kill", k: k}); });
  R.ev.forEach(function(e){ if(e.t >= from && (e.id === C.id || e.kind === "boom")) M.push({t: e.t, kind: e.kind}); });
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
    slow: root.querySelector(".rp-slow"), emo: root.querySelector(".rp-emo"), shade: root.querySelector(".rp-shade"), skip: root.querySelector(".rp-skip"), title: root.querySelector(".rp-title")};
  RP_EL.ctx = RP_EL.cv.getContext("2d");
  RP_EL.skip.addEventListener("click", function(e){ e.stopPropagation(); rpStop(); });
  window.addEventListener("keydown", function(e){ if(!RP.on) return; if(e.key === "Escape" || e.code === "Space"){ e.preventDefault(); e.stopImmediatePropagation(); rpStop(); } }, true);
  return RP_EL;
}
function rpPlay(R){
  if(!R || !R.clutch || !R.s.length) return false;
  var E = rpEls(); if(!E) return false;
  var B = rpBuild(R), C = R.clutch;
  RP.P = {R: R, segs: B.segs, si: 0, rt: B.segs.length ? B.segs[0].a : R.end, phase: "intro", ph0: performance.now(), last: performance.now(),
          cam: null, feedShown: {}, ci: rpBotIdx(C.id)};
  RP.on = true; RP.pending = null;
  var tm = C.side, nm = R.nick[C.id];
  E.root.className = "on " + tm.toLowerCase() + (typeof HUD_REDUCED !== "undefined" && HUD_REDUCED ? " rm" : "");
  E.title.innerHTML = '<div class="rp-t1">ПОВТОР</div><div class="rp-t2">Клатч 1v' + C.n + '</div><div class="rp-t3 ' + tm.toLowerCase() + '">' + esc(nm) + ' · ' + esc(R.team[tm]) + '</div>';
  E.l3.innerHTML = (R.logo[tm] ? '<img alt="" src="' + R.logo[tm] + '">' : '') + '<div><b>' + esc(nm) + '</b><span>клатч 1v' + C.n + ' · раунд ' + R.round + '</span></div><i class="rp-k">0</i>';
  E.feed.innerHTML = ""; E.emo.innerHTML = ""; E.slow.className = "rp-slow";
  return true;
}
function rpStop(){
  if(!RP.on) return;
  var P = RP.P; if(P && P.phase !== "out"){ P.phase = "out"; P.ph0 = performance.now(); return; }
}
function rpEnd(){
  RP.on = false; RP.P = null; RP.holding = false;
  var E = rpEls(); if(E){ E.root.className = ""; E.emo.innerHTML = ""; }
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
    else if(simTime >= Pn.at) rpPlay(Pn.rec);
  }
  if(!RP.on) return false;
  var E = rpEls(), P = RP.P; if(!E || !P){ rpEnd(); return false; }
  var now = performance.now(), dt = Math.min(0.1, (now - P.last)/1000); P.last = now;
  var W = E.cv.clientWidth, H = E.cv.clientHeight, dpr = window.devicePixelRatio || 1;
  if(E.cv.width !== Math.round(W*dpr) || E.cv.height !== Math.round(H*dpr)){ E.cv.width = Math.round(W*dpr); E.cv.height = Math.round(H*dpr); }
  var x = E.ctx, R = P.R, el = (now - P.ph0)/1000;
  var go = function(ph){ P.phase = ph; P.ph0 = now; el = 0; };
  if(P.phase === "intro"){ if(el >= RP_K.intro) go(P.segs.length ? "clip" : "emo"); }
  if(P.phase === "clip"){
    var sg = P.segs[P.si], sp = rpSpeed(P);
    P.rt += dt*TICK_HZ*sp;
    E.slow.className = "rp-slow" + (sp < 0.9 ? " on" : "");
    if(P.rt >= sg.b){ if(P.si + 1 < P.segs.length) go("cut"); else go("emo"); }
  }
  if(P.phase === "cut" && el >= RP_K.cut){ P.si++; P.rt = P.segs[P.si].a; P.cam = null; go("clip"); }
  if(P.phase === "emo" && !P.emoOn){ if(!P.drawn) rpDraw(E, x, P, dt, W, H, dpr); rpBlurBg(E, x); rpEmotions(E, R); P.emoOn = true; E.root.classList.add("emo"); E.slow.className = "rp-slow"; }
  if(P.phase === "emo" && el >= RP_K.emo) go("out");
  if(P.phase === "out" && el >= RP_K.outro){ rpEnd(); return false; }
  // картинка: клип и переходы — радар из записи; эмоции — размытый последний кадр (нарисован один раз)
  if(!P.emoOn) rpDraw(E, x, P, dt, W, H, dpr);
  // затемнение: начало, переход, конец
  var shade = 0;
  if(P.phase === "intro") shade = 1;   // титр на чёрном
  if(P.phase === "cut"){ var h = RP_K.cut/2; shade = el < h ? el/h : Math.max(0, 1 - (el - h)/h); }
  if(P.phase === "clip" && P.rt - P.segs[P.si].a < 0.25*TICK_HZ) shade = Math.max(0, 1 - (P.rt - P.segs[P.si].a)/(0.25*TICK_HZ));
  if(P.phase === "out") shade = Math.min(1, el/RP_K.outro);
  E.shade.style.opacity = shade.toFixed(3);
  E.root.classList.toggle("intro", P.phase === "intro");
  E.root.classList.toggle("out", P.phase === "out");
  rpFeed(E, P);
  return true;
}
// замедление вокруг фрагов клатча (плавно)
function rpSpeed(P){
  var sg = P.segs[P.si], best = 1;
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
  var R = P.R, I = rpAt(R, P.rt), A = I.A, B = I.B, f = I.f, n = bots.length, ci = P.ci;
  var bx = function(i){ return A.b[i*RP_NB] + (B.b[i*RP_NB] - A.b[i*RP_NB])*f; }, by = function(i){ return A.b[i*RP_NB+1] + (B.b[i*RP_NB+1] - A.b[i*RP_NB+1])*f; };
  // камера: клатчер и ближайший живой враг (≤ 800) или тот, кого он убьёт / убил рядом по времени — оба в кадре
  var cx = bx(ci), cy = by(ci), tx = cx, ty = cy, span = 720, foe = -1, fd = 800;
  var sg = P.phase === "clip" || P.phase === "cut" ? P.segs[P.si] : null;
  if(sg) sg.m.forEach(function(m){ if(m.kind === "kill" && Math.abs(m.t - P.rt) < 1.6*TICK_HZ){ var vi = rpBotIdx(m.k.vic); if(vi >= 0){ var d = Math.hypot(bx(vi)-cx, by(vi)-cy); if(d < 1400){ foe = vi; fd = -1; } } } });
  if(foe < 0) for(var i = 0; i < n; i++){ if(bots[i].team === R.clutch.side || !A.b[i*RP_NB+3]) continue; var d = Math.hypot(bx(i)-cx, by(i)-cy); if(d < fd){ fd = d; foe = i; } }
  if(foe >= 0){ var ox = bx(foe), oy = by(foe); tx = (cx + ox)/2; ty = (cy + oy)/2; span = Math.max(600, Math.hypot(ox-cx, oy-cy)*2.3); }
  var slowNow = rpSpeed(P) < 0.9; if(slowNow && P.phase === "clip") span *= 0.86;
  var off = Math.hypot(tx-cx, ty-cy), om = 0.3*span; if(off > om){ tx = cx + (tx-cx)*om/off; ty = cy + (ty-cy)*om/off; }
  var top = H*0.09, bot = H*0.09, avH = H - top - bot, sc = Math.min(W, avH)/span;
  if(!P.cam) P.cam = {x: tx, y: ty, s: sc};
  var k = 1 - Math.exp(-dt*3.5), ks = 1 - Math.exp(-dt*2.2);
  P.cam.x += (tx - P.cam.x)*k; P.cam.y += (ty - P.cam.y)*k; P.cam.s += (sc - P.cam.s)*ks;
  var S = P.cam.s, ox0 = W/2 - P.cam.x*S, oy0 = top + avH/2 - P.cam.y*S;
  x.setTransform(dpr,0,0,dpr,0,0); x.fillStyle = "#060806"; x.fillRect(0,0,W,H);
  x.setTransform(dpr*S,0,0,dpr*S,dpr*ox0,dpr*oy0);
  if(imgReady) x.drawImage(img,0,0,2048,2048);
  var L = 1/S;
  // дым, огонь, гранаты в полёте
  for(var q = 0; q < A.sm.length; q += 3){ var r = A.sm[q+2], g = x.createRadialGradient(A.sm[q], A.sm[q+1], r*0.1, A.sm[q], A.sm[q+1], r);
    g.addColorStop(0, "rgba(214,217,209,.88)"); g.addColorStop(1, "rgba(176,180,170,.5)"); x.fillStyle = g; x.beginPath(); x.arc(A.sm[q], A.sm[q+1], r, 0, Math.PI*2); x.fill(); }
  for(q = 0; q < A.fi.length; q += 3){ var fr = x.createRadialGradient(A.fi[q], A.fi[q+1], 0, A.fi[q], A.fi[q+1], A.fi[q+2]);
    fr.addColorStop(0, "rgba(255,196,92,.72)"); fr.addColorStop(1, "rgba(214,70,30,.25)"); x.fillStyle = fr; x.beginPath(); x.arc(A.fi[q], A.fi[q+1], A.fi[q+2], 0, Math.PI*2); x.fill(); }
  for(q = 0; q < A.nd.length; q += 4){ x.fillStyle = ["#d6d9d1","#ffffff","#e8584c","#ff9a3c"][A.nd[q+3]]; x.beginPath(); x.arc(A.nd[q], A.nd[q+1], 3.2*L, 0, Math.PI*2); x.fill(); x.strokeStyle = "#0b0f0b"; x.lineWidth = L; x.stroke(); }
  // выстрелы: последние tracer с игры
  var tl = RP_K.tracer*TICK_HZ, t0i = rpTrFrom(R, P.rt - tl);
  for(var j = t0i; j < R.tr.length && R.tr[j].t <= P.rt; j++){ var T = R.tr[j], a = 1 - (P.rt - T.t)/tl; if(a <= 0) continue;
    x.strokeStyle = (T.team === "CT" ? "rgba(170,210,250," : "rgba(255,214,140,") + (a*(T.hit ? 0.95 : 0.55)).toFixed(3) + ")"; x.lineWidth = (T.hit ? 1.8 : 1.1)*L;
    x.beginPath(); x.moveTo(T.x1, T.y1); x.lineTo(T.x2, T.y2); x.stroke(); }
  // бомба
  if(A.bomb && A.bomb.st !== "carried"){ var on = A.bomb.st !== "planted" || Math.floor(P.rt/24) % 2 === 0;
    x.fillStyle = A.bomb.st === "planted" ? (on ? "#ff5a4a" : "#7a2620") : "#ffd25a"; x.fillRect(A.bomb.x - 6*L, A.bomb.y - 4*L, 12*L, 8*L); x.strokeStyle = "#0b0f0b"; x.lineWidth = 1.4*L; x.strokeRect(A.bomb.x - 6*L, A.bomb.y - 4*L, 12*L, 8*L); }
  // игроки: погибшие — крестик, живые — кружок с носиком взгляда (как на радаре), hp, номер; клатчер — золотое кольцо и ник
  for(i = 0; i < n; i++){
    var o = i*RP_NB, px = bx(i), py = by(i), team = bots[i].team, col = team === "CT" ? "#5a9bd9" : "#d9a24a";
    if(!A.b[o+3]){ var rr = 6*L; x.strokeStyle = team === "CT" ? "rgba(90,160,230,.95)" : "rgba(230,160,60,.95)"; x.lineWidth = 2.6*L;
      x.beginPath(); x.moveTo(px-rr, py-rr); x.lineTo(px+rr, py+rr); x.moveTo(px+rr, py-rr); x.lineTo(px-rr, py+rr); x.stroke(); continue; }
    var rad = (A.b[o+5] ? 6.2 : 7)*L, vf = rpLerpAng(A.b[o+2], B.b[o+2], f), under = A.b[o+6] < 0;
    if(i === ci){ var pul = 1 + 0.12*Math.sin(performance.now()/180); x.strokeStyle = "rgba(255,214,110,.95)"; x.lineWidth = 2.4*L; x.beginPath(); x.arc(px, py, rad + 6*L*pul, 0, Math.PI*2); x.stroke(); }
    if(A.b[o+8]){ x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.arc(px, py, rad + 4*L, 0, Math.PI*2); x.fill(); }
    x.beginPath();
    if(!isNaN(vf)){ x.arc(px, py, rad, vf + 0.95, vf - 0.95 + Math.PI*2); x.lineTo(px + Math.cos(vf)*rad*1.85, py + Math.sin(vf)*rad*1.85); x.closePath(); }
    else x.arc(px, py, rad, 0, Math.PI*2);
    x.fillStyle = under ? (team === "CT" ? "rgba(122,140,158,.6)" : "rgba(158,144,122,.6)") : col; x.fill(); x.lineWidth = 1.5*L; x.strokeStyle = "#0b0f0b"; x.stroke();
    var hp = A.b[o+4], bw = 18*L, bh = 2.5*L; x.fillStyle = "rgba(0,0,0,.5)"; x.fillRect(px-bw/2, py-rad-8*L, bw, bh);
    x.fillStyle = hp > 50 ? "#94b449" : hp > 25 ? "#d9832f" : "#c1584f"; x.fillRect(px-bw/2, py-rad-8*L, bw*Math.max(0, hp)/100, bh);
    var act = A.b[o+7]; if(act){ x.beginPath(); x.arc(px, py, rad + 5*L, -Math.PI/2, -Math.PI/2 + Math.abs(act)*Math.PI*2); x.strokeStyle = act > 0 ? "#e05c52" : "#5a9bd9"; x.lineWidth = 2.5*L; x.stroke(); }
    x.fillStyle = "#0b0f0b"; x.font = "700 " + (8.5*L) + "px 'IBM Plex Mono',monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(pnum(bots[i].id)), px, py + 0.5*L);
    if(i === ci){ var nm = R.nick[bots[i].id]; x.font = "600 " + (10*L) + "px 'Roboto Condensed','Golos Text',sans-serif"; var tw = x.measureText(nm).width;
      x.fillStyle = "rgba(11,15,11,.8)"; x.fillRect(px - tw/2 - 4*L, py + rad + 5*L, tw + 8*L, 13*L); x.fillStyle = "#ffe49a"; x.textBaseline = "top"; x.fillText(nm, px, py + rad + 6.5*L); }
    x.textBaseline = "alphabetic";
  }
  // фраг клатчера: вспышка-кольцо у жертвы
  if(sg) sg.m.forEach(function(m){ if(m.kind !== "kill") return; var a2 = (P.rt - m.t)/(0.7*TICK_HZ); if(a2 < 0 || a2 > 1) return; var vi = rpBotIdx(m.k.vic); if(vi < 0) return;
    x.strokeStyle = "rgba(255,228,150," + (1 - a2).toFixed(3) + ")"; x.lineWidth = 3*L; x.beginPath(); x.arc(bx(vi), by(vi), (10 + 34*a2)*L, 0, Math.PI*2); x.stroke(); });
  x.setTransform(1,0,0,1,0,0);
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
// реакции — проектные фразы (показ). Выбор — по ситуации игрока, вариант — от номера матча/раунда (повтор того же раунда — те же)
var RP_SAY = {
  hero:   ["ДААААА!", "ВОТ ТАК!", "ИЗИ, ИЗИ!", "Я ЖЕ ГОВОРИЛ!", "ОН МОЙ!"],
  heroLow:["НА {hp} ХП!!!", "ЕЛЕ ЖИВОЙ, НО ЗАБРАЛ!"],
  mate:   ["НАЙС!!", "КРАСАВЧИК!", "ЧТО ТЫ СДЕЛАЛ?!", "ДА-ДА-ДА!", "ЛЕГЕНДА!", "ВАУ, 1 В {n}!", "ЗАБРАЛ!!"],
  mateHype:["ЭЙС-КЛАТЧ! НЕРЕАЛЬНО!", "1 В {n}, ТЫ МОНСТР!", "ОРУ!!!"],
  mateAlive:["ПРИКРЫЛ, ДАВАЙ!", "НАЙС, БРАТ!"],
  victim: ["как он меня...", "ну как так?", "он один был!", "не может быть", "откуда он?!"],
  loserAlive:["я не успел...", "сорри, пацаны", "бомбу не нашёл"],
  loser:  ["собрались, следующий", "так нельзя отдавать", "это был наш раунд...", "эх..."]
};
function rpHash(s){ var h = 2166136261 >>> 0; s = String(s); for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
function rpPick(list, key, R){ var t = list[rpHash(R.m + "|" + R.round + "|" + key) % list.length]; return t.replace("{n}", R.clutch.n).replace("{hp}", Math.max(1, Math.round(R.clutch.hp||0))); }
function rpEmotions(E, R){
  var C = R.clutch, win = C.side, lose = win === "CT" ? "T" : "CT";
  var row = function(side, mood){
    var ids = bots.filter(function(b){ return b.team === side; }).map(function(b){ return b.id; });
    if(side === win){ ids.sort(function(a, b){ return (a === C.id ? 0 : 1) - (b === C.id ? 0 : 1); }); var c0 = ids.shift(); ids.splice(Math.floor(ids.length/2), 0, c0); }
    return '<div class="rp-row ' + mood + ' ' + side.toLowerCase() + '">' + ids.map(function(id, i){
      var st = R.st[id] || {}, hero = id === C.id, say;
      if(side === win) say = hero ? (C.hp > 0 && C.hp <= 30 ? rpPick(RP_SAY.heroLow, id, R) : rpPick(RP_SAY.hero, id, R)) : st.alive ? rpPick(RP_SAY.mateAlive, id, R) : rpPick(C.n >= 4 ? RP_SAY.mateHype : RP_SAY.mate, id, R);
      else say = st.killer === C.id ? rpPick(RP_SAY.victim, id, R) : st.alive ? rpPick(RP_SAY.loserAlive, id, R) : rpPick(RP_SAY.loser, id, R);
      var vx = R.vox && R.vox[id];
      var b = teamBot(id), ph = b ? plPhoto(b) : "";
      return '<div class="rp-card' + (hero ? ' hero' : '') + (st.alive ? '' : ' dead') + '" style="--i:' + i + '">' +
        '<div class="rp-say"><b>' + esc(say) + '</b></div>' +
        '<div class="rp-ph">' + ph + '</div>' +
        '<div class="rp-nm"><span>' + esc(R.nick[id] || id) + '</span>' + (st.k ? '<i>' + st.k + ' уб.</i>' : '') + '</div>' +
        '<div class="rp-vx" title="последнее в войсе за раунд">' + (vx ? '«' + esc(vx) + '»' : '') + '</div></div>';
    }).join("") + '</div>';
  };
  E.emo.innerHTML =
    '<div class="rp-eh ' + win.toLowerCase() + '">' + (R.logo[win] ? '<img alt="" src="' + R.logo[win] + '">' : '') + '<span>' + esc(R.team[win]) + '</span><em>клатч 1v' + C.n + ' — ' + esc(R.nick[C.id]) + '</em></div>' +
    row(win, "hype") +
    '<div class="rp-eh2 ' + lose.toLowerCase() + '">' + esc(R.team[lose]) + ' — реакция</div>' +
    row(lose, "sad");
}
// ---------- переход к раунду (найти и посмотреть клатч): #round=матч.раунд в адресе или rpGoto(матч, раунд) ----------
// Матч перематывается тиками без отрисовки до закупки нужного раунда — дальше идёт обычным ходом (тот же матч бит в бит)
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
  var b = document.getElementById("btnRpLast"); if(b) b.addEventListener("click", function(){ if(RP.last){ rpPlay(RP.last); } else if(typeof showBanner === "function") showBanner("Клатча в этом матче ещё не было", null, 1800); });
  var hm = /(?:^|[#&])round=(\d+)\.(\d+)/.exec(location.hash || ""); if(hm) setTimeout(function(){ rpGoto(+hm[1], +hm[2]); }, 300);
})();
