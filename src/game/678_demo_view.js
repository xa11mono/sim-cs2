// ======================= (v571) РАУНД ИЗ ДЕМКИ («режим тени», В136) — одно место =======================
// Владелец 13.11: «перенести раунд из демки полностью и посмотреть, какая механика переключает решение бота»; «чтобы использовалась графика
// нашего радара». Раунд демки про (MAP.demorounds, tools/shadow/bake_demorounds.py) играется нашей страницей: игроки идут и смотрят ровно как
// в демке (каждый тик), выстрелы / попадания / смерти / смоки / плант — из демки; наши боты в их телах видят и слышат по нашей видимости и
// только РЕШАЮТ — куда пошёл бы (задача, post), куда смотрел бы (lookTarget, lookReason). Поверх радара: куда пошёл / смотрел бы бот,
// куда про придёт за 3 с; расхождение с про — красным. Панели «Разбор взгляда» / «Разбор команды» работают как в матче.
// Игру вне режима не меняет: все проверки — DEMOV.on (490 не стреляет, 400 урон — только смерти демки, 530 раунд не кончается сам,
// 120 плант / дефуз — только по демке, 540 — dvTick).
var DEMOV = {on: false, i: 0, R: null, t0: 0, BOT: {}, ei: 0, allow: false};
var DV_PANEL_EL = null;
function dvRounds(){ return (MAP.demorounds && MAP.demorounds.rounds) || []; }
function dvAt(s, t){ var T = DEMOV.R.players[s].track, lo = 0, hi = T.length - 1; if(t <= T[0][0]) return T[0]; if(t >= T[hi][0]) return T[hi];
  while(hi - lo > 1){ var m = (lo + hi) >> 1; if(T[m][0] <= t) lo = m; else hi = m; } var a = T[lo], c = T[hi], k = (t - a[0]) / Math.max(1, c[0] - a[0]);
  var dy = ((c[4]-a[4]+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
  return [t, a[1]+(c[1]-a[1])*k, a[2]+(c[2]-a[2])*k, a[3]+(c[3]-a[3])*k, a[4]+dy*k, a[5], a[6], a[7]]; }
// запуск раунда i: новый матч, закупка пропущена, игроки ↔ боты (сторона; совпал ник — тот, остальные по порядку), оружие из демки
function dvStart(i){
  var R = dvRounds()[i]; if(!R) return;
  DEMOV.on = false;
  if(WARM.on){ WARM = {on:false}; var sk = document.getElementById("btnWarmSkip"); if(sk) sk.style.display = "none"; }   // из разминки — сразу в раунд демки
  freshMatch(1); var guard = 0; while(roundState !== "live" && guard++ < 20000) stepTick();
  DEMOV.R = R; DEMOV.i = i; DEMOV.t0 = tick; DEMOV.ei = 0; DEMOV.BOT = {};
  var P = R.players, ids = Object.keys(P), used = {};
  ["T", "CT"].forEach(function(side){
    var dem = ids.filter(function(s){ return P[s].side === side; }), bs = bots.filter(function(x){ return x.team === side; });
    bs.forEach(function(x){ var n = String(nick(x.id)).toLowerCase(), m = dem.filter(function(s){ return !used[s] && P[s].name.toLowerCase() === n; })[0]; if(m){ DEMOV.BOT[m] = x; used[m] = 1; } });
    bs.forEach(function(x){ for(var k in DEMOV.BOT) if(DEMOV.BOT[k] === x) return; var m = dem.filter(function(s){ return !used[s]; })[0]; if(m){ DEMOV.BOT[m] = x; used[m] = 1; } }); });
  var wkey = {}; Object.keys(WEAPONS).forEach(function(k){ wkey[WEAPONS[k].name] = k; });
  Object.keys(DEMOV.BOT).forEach(function(s){ var x = DEMOV.BOT[s], pr = null, sc = null;
    P[s].track.forEach(function(r){ var k = wkey[r[7]]; if(!k) return; if(WEAPONS[k].slot === "secondary") sc = k; else pr = k; });
    x.primary = pr; if(sc) x.secondary = sc; x.weapon = WEAPONS[pr || x.secondary]; x._ammoFor = null; x.armor = true; x.helmet = true; x._dvName = P[s].name; });
  DEMOV.on = true; dvPlace(); paused = false;
  logEvent("раунд из демки: " + R.demo + " р" + R.num + " — игроки по демке, боты решают («тень»)");
  dvRender(true);
}
function dvStop(){ DEMOV.on = false; bots.forEach(function(x){ x._dvName = null; }); logEvent("раунд из демки — выключен"); dvRender(true); }
// каждый тик (stepTick, 540): события демки до этого момента, игроки — на места демки
function dvTick(){
  var R = DEMOV.R, t = tick - DEMOV.t0, B = DEMOV.BOT;
  if(t >= R.len){ DEMOV.on = false; paused = true; logEvent("раунд из демки кончился"); dvRender(true); return; }
  while(DEMOV.ei < R.ev.length && R.ev[DEMOV.ei][1] <= t){ var e = R.ev[DEMOV.ei++], A = B[e[2]];
    if(e[0] === "shot" && A && A.alive){ A.lastShotTick = tick; dvHearShot(A); }
    else if(e[0] === "hurt" && A && B[e[3]] && B[e[3]].alive){ var V = B[e[3]]; V.heardSound = hearReal(V, {x: A.x, y: A.y, tick: tick, team: A.team, src: A.id, kind: "hit"}); V._shotAtT = tick; V._shotAtBy = A; }
    else if(e[0] === "death" && B[e[3]] && B[e[3]].alive){ DEMOV.allow = true; applyDamage(A || B[e[3]], B[e[3]], 999, "bullet", {}); DEMOV.allow = false; }
    else if(e[0] === "nade" && e[3] === "smoke") smokes.push({x: e[4], y: e[5], born: tick, until: tick + NADE.smoke.life, team: A ? A.team : "T"});
    else if(e[0] === "plant"){ bomb.state = "planted"; bomb.x = e[3]; bomb.y = e[4]; bomb.carrier = null; bomb.plantTick = tick; bomb.explodeTick = tick + BOMB_TICKS; bomb.site = R.site; }
    else if(e[0] === "defused"){ bomb.state = "defused"; }
  }
  dvPlace();
}
function dvPlace(){ var t = tick - DEMOV.t0;
  Object.keys(DEMOV.BOT).forEach(function(s){ var x = DEMOV.BOT[s]; if(!x.alive) return; var q = dvAt(s, t), q1 = dvAt(s, t - 8);
    x.x = x.baseX = x.px = q[1]; x.y = x.baseY = x.py = q[2]; x.facing = q[4]; x.curSpeed = Math.hypot(q[1]-q1[1], q[2]-q1[2]) / (8/TICK_HZ); if(q[6] > 0) x.hp = q[6]; }); }
// выстрел демки слышат враги — как в игре (490: слышимость по прямой / сквозь стены, место — с ошибкой hearPos)
function dvHearShot(sh){ bots.forEach(function(o){ if(!o.alive || o.team === sh.team) return; var dG = Math.hypot(o.x-sh.x, o.y-sh.y);
  var hearR = hasLOS(o.x, o.y, sh.x, sh.y, o.z, sh.z) ? GUN_HEAR_OPEN : GUN_HEAR_WALL; if(dG >= hearR) return;
  var hp = hearPos(o, sh.x, sh.y, tick*17 + o.id.charCodeAt(0)*7, hearR === GUN_HEAR_WALL);
  o.heardSound = hearReal(o, {x: hp ? hp.x : sh.x, y: hp ? hp.y : sh.y, tick: tick, team: sh.team, src: sh.id, kind: "shots"}); }); }
// расхождение с про: ходьба (про стоит — бот ушёл бы; про идёт — бот стоял бы; в разные стороны > 75°), взгляд (> 60°) — то же, что tools/shadow/compare.py
function dvDiff(s, x){ var t = tick - DEMOV.t0, q = dvAt(s, t), q3 = dvAt(s, t + 192), pm = Math.hypot(q3[1]-q[1], q3[2]-q[2]), mv = null, lk = null;
  var P = x.post, bd = P ? Math.hypot(P.x-q[1], P.y-q[2]) : 0, an = function(a, b){ return Math.abs(((a-b+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); };
  if(pm < 60 && bd > 200) mv = "про стоит — бот ушёл бы"; else if(pm > 150 && bd < 100) mv = "про идёт — бот стоял бы";
  else if(pm > 150 && bd > 150 && an(Math.atan2(q3[2]-q[2], q3[1]-q[1]), Math.atan2(P.y-q[2], P.x-q[1])) > 75*Math.PI/180) mv = "идут в разные стороны";
  var L = x.lookTarget; if(L && Math.hypot(L.x-q[1], L.y-q[2]) > 20 && an(Math.atan2(L.y-q[2], L.x-q[1]), q[4]) > Math.PI/3) lk = x.lookReason || "—";
  return {q: q, q3: q3, mv: mv, lk: lk}; }
// поверх радара (620): куда про придёт за 3 с (точки), куда пошёл бы бот (пунктир с задачей), куда смотрел бы (пунктир); расхождение — красным
function dvDraw(){
  if(!DEMOV.on) return; var s1 = 1/view.scale, t = tick - DEMOV.t0; ctx.save();
  Object.keys(DEMOV.BOT).forEach(function(s){ var x = DEMOV.BOT[s]; if(!x.alive) return; var D = dvDiff(s, x), q = D.q;
    ctx.strokeStyle = "rgba(127,209,139,0.9)"; ctx.lineWidth = 2*s1; ctx.setLineDash([3*s1, 5*s1]); ctx.beginPath();
    for(var k = 0; k <= 192; k += 16){ var p = dvAt(s, t + k); if(k) ctx.lineTo(p[1], p[2]); else ctx.moveTo(p[1], p[2]); } ctx.stroke();
    if(x.post && Math.hypot(x.post.x-q[1], x.post.y-q[2]) > 30){ ctx.strokeStyle = D.mv ? "rgba(255,107,94,0.95)" : "rgba(240,240,240,0.8)"; ctx.setLineDash([7*s1, 5*s1]); ctx.lineWidth = 1.6*s1;
      ctx.beginPath(); ctx.moveTo(q[1], q[2]); ctx.lineTo(x.post.x, x.post.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = (12*s1) + "px 'IBM Plex Mono',monospace"; ctx.fillText(String(x.post.tag).split(":")[0], x.post.x + 8*s1, x.post.y + 4*s1); }
    var L = x.lookTarget; if(L){ var la = Math.atan2(L.y-q[2], L.x-q[1]); ctx.strokeStyle = D.lk ? "rgba(255,107,94,0.95)" : "rgba(201,167,255,0.9)"; ctx.lineWidth = 2*s1; ctx.setLineDash([6*s1, 4*s1]);
      ctx.beginPath(); ctx.moveTo(q[1], q[2]); ctx.lineTo(q[1] + Math.cos(la)*110, q[2] + Math.sin(la)*110); ctx.stroke(); }
    ctx.setLineDash([]);
    if(D.mv || D.lk){ ctx.strokeStyle = "rgba(255,107,94,0.95)"; ctx.lineWidth = 2.5*s1; ctx.beginPath(); ctx.arc(q[1], q[2], 24, 0, 7); ctx.stroke(); } });
  ctx.restore();
}
function dvEsc(s){ return String(s == null ? "" : s).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }
function dvPanel(){
  if(DV_PANEL_EL || typeof document === "undefined") return DV_PANEL_EL;
  DV_PANEL_EL = document.createElement("div"); DV_PANEL_EL.id = "dvPanel"; DV_PANEL_EL.className = "dbgPanel"; document.body.appendChild(DV_PANEL_EL);
  DV_PANEL_EL.addEventListener("click", function(e){ var a = e.target.closest("[data-dv]"); if(!a) return; var v = a.getAttribute("data-dv");
    if(v === "stop") dvStop(); else dvStart(+v); });
  return DV_PANEL_EL;
}
function dvRender(force){
  var el = dvPanel(); if(!el) return; var bt = document.getElementById("btnDemoView"); if(bt) bt.classList.toggle("on", DEMOV.on);
  if(!DEMOV.open){ el.style.display = "none"; return; } el.style.display = "";
  if(!force && nowTs - (dvRender._t || 0) < 300) return; dvRender._t = nowTs;
  var h = ['<div class="ld-h">Раунд из демки · тень</div>'];
  h.push('<div class="ld-s"><div class="ld-k">Раунды</div>' + dvRounds().map(function(r, i){ return '<div><button data-dv="' + i + '"' + (DEMOV.on && DEMOV.i === i ? ' class="on"' : '') + '>' + dvEsc(r.title || (r.demo + " р" + r.num)) + '</button></div>'; }).join('') +
    (DEMOV.on ? '<div><button data-dv="stop">Выключить</button></div>' : '') + '</div>');
  if(DEMOV.on){ var t = tick - DEMOV.t0, nM = 0, nL = 0, rows = [];
    Object.keys(DEMOV.BOT).forEach(function(s){ var x = DEMOV.BOT[s]; if(!x.alive){ rows.push('<div class="ld-f">' + dvEsc(x._dvName) + ' — погиб</div>'); return; } var D = dvDiff(s, x); if(D.mv) nM++; if(D.lk) nL++;
      rows.push('<div>' + '<b style="color:' + (x.team === "T" ? '#e2a03f' : '#5aa3e6') + '">' + dvEsc(x._dvName) + '</b> <span class="ld-f">(' + x.id + ')</span><div class="ld-f">бот: задача ' + dvEsc(x.post ? x.post.tag : '—') + ', взгляд ' + dvEsc(x.lookReason || '—') + '</div>' +
        (D.mv ? '<div style="color:#ff6b5e">' + D.mv + '</div>' : '') + (D.lk ? '<div style="color:#ff6b5e">взгляд не как у про: ' + dvEsc(D.lk) + '</div>' : '') + '</div>'); });
    h.push('<div class="ld-s"><div class="ld-k">' + (t/TICK_HZ).toFixed(1) + ' с из ' + (DEMOV.R.len/TICK_HZ).toFixed(0) + ' · расходятся: ходьба ' + nM + ', взгляд ' + nL + '</div>' + rows.join('') + '</div>');
    h.push('<div class="ld-s ld-f">Зелёные точки — куда про придёт за 3 с; белый пунктир — куда пошёл бы бот (задача); сиреневый — куда смотрел бы; красное — не как у про. План раунда у бота свой — часть расхождений = другой план. Клик по игроку и «Разбор взгляда» — почему бот так решил.</div>'); }
  el.innerHTML = h.join('');
}
function dvToggle(){ DEMOV.open = !DEMOV.open; if(!DEMOV.open && DEMOV.on) dvStop(); dvRender(true); }
if(typeof document !== "undefined") setInterval(function(){ if(DEMOV.open) dvRender(false); }, 300);
(function(){ if(typeof document === "undefined") return; var bt = document.getElementById("btnDemoView"); if(bt) bt.addEventListener("click", dvToggle); if(!dvRounds().length && bt) bt.style.display = "none"; })();
