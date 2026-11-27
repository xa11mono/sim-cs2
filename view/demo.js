// [хозяева: —] ======================= (v571) РАУНД ИЗ ДЕМКИ («режим тени», В136) — одно место =======================
// Владелец 13.11: «перенести раунд из демки полностью и посмотреть, какая механика переключает решение бота»; «чтобы использовалась графика
// нашего радара». Раунд демки про (MAP.demorounds, tools/shadow/bake_demorounds.py) играется нашей страницей: игроки идут и смотрят ровно как
// в демке (каждый тик), выстрелы / попадания / смерти / смоки / плант — из демки; наши боты в их телах видят и слышат по нашей видимости и
// только РЕШАЮТ — куда пошёл бы (задача, post), куда смотрел бы (lookTarget, lookReason). Поверх радара: куда пошёл / смотрел бы бот,
// куда про придёт за 3 с; расхождение с про — красным. Панели «Разбор взгляда» / «Разбор команды» работают как в матче.
// Игру вне режима не меняет: все проверки — DEMOV.on (490 не стреляет, 400 урон — только смерти демки, 530 раунд не кончается сам,
// 120 плант / дефуз — только по демке, 540 — dvTick).
// DEMOV (состояние режима, которое читает ядро) и расчёт режима (dvStart, dvTick, dvPlace, dvStop) — engine/core/modes.js (Р5)
var DV_PANEL_EL = null;
// расхождение с про: ходьба (про стоит — бот ушёл бы; про идёт — бот стоял бы; в разные стороны > 75°), взгляд (> 60°) — то же, что tools/shadow/compare.py
function dvDiff(s, x){ var t = tick - DEMOV.t0, q = dvAt(s, t), q3 = dvAt(s, t + 192), pm = Math.hypot(q3[1]-q[1], q3[2]-q[2]), mv = null, lk = null;
  var P = x.post, bd = P ? Math.hypot(P.x-q[1], P.y-q[2]) : 0, an = function(a, b){ return Math.abs(((a-b+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); };
  if(pm < 60 && bd > 200) mv = "про стоит — бот ушёл бы"; else if(pm > 150 && bd < 100) mv = "про идёт — бот стоял бы";
  else if(pm > 150 && bd > 150 && an(Math.atan2(q3[2]-q[2], q3[1]-q[1]), Math.atan2(P.y-q[2], P.x-q[1])) > 75*Math.PI/180) mv = "идут в разные стороны";
  var L = x.lookTarget; if(L && Math.hypot(L.x-q[1], L.y-q[2]) > 20 && an(Math.atan2(L.y-q[2], L.x-q[1]), q[4]) > Math.PI/3) lk = x.lookReason || "—";
  return {q: q, q3: q3, mv: mv, lk: lk}; }
// поверх радара (draw): куда про придёт за 3 с (точки), куда пошёл бы бот (пунктир с задачей), куда смотрел бы (пунктир); расхождение — красным
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
// (15.11, перестройка) dvEsc — тот же код, что sbEsc: вызовы переведены на sbEsc
function dvPanel(){
  if(DV_PANEL_EL || typeof document === "undefined") return DV_PANEL_EL;
  DV_PANEL_EL = document.createElement("div"); DV_PANEL_EL.id = "dvPanel"; DV_PANEL_EL.className = "dbgPanel"; document.body.appendChild(DV_PANEL_EL);
  DV_PANEL_EL.addEventListener("click", function(e){ var a = e.target.closest("[data-dv]"); if(!a) return; var v = a.getAttribute("data-dv");
    if(v === "stop") dvStop(); else dvStart(+v); dvRender(true); });
  return DV_PANEL_EL;
}
function dvRender(force){
  var el = dvPanel(); if(!el) return; var bt = document.getElementById("btnDemoView"); if(bt) bt.classList.toggle("on", DEMOV.on);
  if(!DEMOV.open){ el.style.display = "none"; return; } el.style.display = "";
  if(!force && nowTs - (dvRender._t || 0) < 300) return; dvRender._t = nowTs;
  var h = ['<div class="ld-h">Раунд из демки · тень</div>'];
  h.push('<div class="ld-s"><div class="ld-k">Раунды</div>' + dvRounds().map(function(r, i){ return '<div><button data-dv="' + i + '"' + (DEMOV.on && DEMOV.i === i ? ' class="on"' : '') + '>' + sbEsc(r.title || (r.demo + " р" + r.num)) + '</button></div>'; }).join('') +
    (DEMOV.on ? '<div><button data-dv="stop">Выключить</button></div>' : '') + '</div>');
  if(DEMOV.on){ var t = tick - DEMOV.t0, nM = 0, nL = 0, rows = [];
    Object.keys(DEMOV.BOT).forEach(function(s){ var x = DEMOV.BOT[s]; if(!x.alive){ rows.push('<div class="ld-f">' + sbEsc(x._dvName) + ' — погиб</div>'); return; } var D = dvDiff(s, x); if(D.mv) nM++; if(D.lk) nL++;
      rows.push('<div>' + '<b style="color:' + (x.team === "T" ? '#e2a03f' : '#5aa3e6') + '">' + sbEsc(x._dvName) + '</b> <span class="ld-f">(' + x.id + ')</span><div class="ld-f">бот: задача ' + sbEsc(x.post ? x.post.tag : '—') + ', взгляд ' + sbEsc(x.lookReason || '—') + '</div>' +
        (D.mv ? '<div style="color:#ff6b5e">' + D.mv + '</div>' : '') + (D.lk ? '<div style="color:#ff6b5e">взгляд не как у про: ' + sbEsc(D.lk) + '</div>' : '') + '</div>'); });
    h.push('<div class="ld-s"><div class="ld-k">' + (t/TICK_HZ).toFixed(1) + ' с из ' + (DEMOV.R.len/TICK_HZ).toFixed(0) + ' · расходятся: ходьба ' + nM + ', взгляд ' + nL + '</div>' + rows.join('') + '</div>');
    h.push('<div class="ld-s ld-f">Зелёные точки — куда про придёт за 3 с; белый пунктир — куда пошёл бы бот (задача); сиреневый — куда смотрел бы; красное — не как у про. План раунда у бота свой — часть расхождений = другой план. Клик по игроку и «Разбор взгляда» — почему бот так решил.</div>'); }
  el.innerHTML = h.join('');
}
function dvToggle(){ DEMOV.open = !DEMOV.open; if(!DEMOV.open && DEMOV.on) dvStop(); dvRender(true); }
if(typeof document !== "undefined") setInterval(function(){ if(DEMOV.open) dvRender(false); }, 300);
(function(){ if(typeof document === "undefined") return; var bt = document.getElementById("btnDemoView"); if(bt) bt.addEventListener("click", dvToggle); if(!dvRounds().length && bt) bt.style.display = "none"; })();
