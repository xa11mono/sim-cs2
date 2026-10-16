// ======================= v201: проверка «кто кого видит» для владельца (19_vis_tool.js) =======================
// Галочка «кто кого видит»: клик по радару — точка A; закрашивается, где оттуда виден
// стоящий человек (хоть голова): зелёным — видно и стоя, и присев; жёлтым — только
// стоя (присев закрывает укрытие или край); голубым — только присев (редко: потолок).
// Shift+клик — точка B: строка «A видит B: голова/тело/нет» для стоя/присев.
// Считает та же функция, что и игра (visParts, 10_vision.js) — стены, укрытия,
// пол и уступы, потолки, дым на радаре сейчас. Esc — убрать точки.
// Состояние в снимок игры не попадает (src/build.py, список UI).
var chkVis = document.getElementById("chkVis");
var VT = {a: null, b: null, img: null, key: null, step: 6, ms: 0};
function vtOn(){ return !!(chkVis && chkVis.checked); }
function vtSees(ax, ay, aC, bx, by, bC){
  var p = visParts(ax, ay, aC, bx, by, bC);
  if((p.head || p.body) && smokeBlocks(ax, ay, bx, by)) return {head: false, body: false};
  return p;
}
function vtCompute(){
  visReady();
  var A = VT.a, st = VT.step, n = Math.ceil(2048 / st), t0 = performance.now();
  var cnv = document.createElement("canvas"); cnv.width = n; cnv.height = n;
  var c2 = cnv.getContext("2d"), im = c2.createImageData(n, n), D = im.data;
  var W = VIS.W, F = VIS.floor, S = VIS.solid;
  for(var j = 0; j < n; j++) for(var i = 0; i < n; i++){
    var x = (i + 0.5)*st, y = (j + 0.5)*st, k = Math.floor(y / VIS_CELL)*W + Math.floor(x / VIS_CELL);
    if(F[k] === -Infinity || S[k] > F[k] + VIS_FLOOR_EPS + 1) continue;   // не пол (стена, пустота; верх укрытия — пол, если на нём навмеш)
    var s = vtSees(A.x, A.y, false, x, y, false), c = vtSees(A.x, A.y, true, x, y, false);
    var vs = s.head || s.body, vc = c.head || c.body; if(!vs && !vc) continue;
    var col = vs && vc ? [70, 220, 90] : (vs ? [250, 205, 40] : [70, 170, 250]), o = (j*n + i)*4;
    D[o] = col[0]; D[o+1] = col[1]; D[o+2] = col[2]; D[o+3] = 150;
  }
  c2.putImageData(im, 0, 0);
  VT.img = cnv; VT.ms = Math.round(performance.now() - t0);
  VT.key = vtKey();
}
function vtKey(){ return VIS_GEN + "|" + WALLS_SIG + "|" + smokes.length + "|" + (VT.a ? VT.a.x + "," + VT.a.y : ""); }
// строка для пары A–B: что A видит у B при каждой стойке
function vtPairText(){
  var A = VT.a, B = VT.b; if(!A || !B) return null;
  function t(aC, bC){ return visPartsText(vtSees(A.x, A.y, aC, B.x, B.y, bC)); }
  return ["A видит B (B стоит): A стоя — " + t(false, false) + " · A присев — " + t(true, false),
          "A видит B (B присел): A стоя — " + t(false, true) + " · A присев — " + t(true, true),
          "B видит A (A стоит): B стоя — " + visPartsText(vtSees(B.x, B.y, false, A.x, A.y, false)) + " · B присев — " + visPartsText(vtSees(B.x, B.y, true, A.x, A.y, false))];
}
function visToolDraw(){
  if(!vtOn()) return;
  var S = view.scale;
  if(VT.a){
    if(VT.key !== vtKey()) vtCompute();
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(VT.img, 0, 0, 2048, 2048); ctx.restore();
  }
  function mark(p, lbl, col){
    ctx.beginPath(); ctx.arc(p.x, p.y, 7/S, 0, Math.PI*2); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2/S; ctx.strokeStyle = "#0b0f0b"; ctx.stroke();
    ctx.fillStyle = "#0b0f0b"; ctx.font = "700 " + (9/S) + "px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(lbl, p.x, p.y + 0.5/S); ctx.textBaseline = "alphabetic";
  }
  if(VT.a && VT.b){
    ctx.beginPath(); ctx.moveTo(VT.a.x, VT.a.y); ctx.lineTo(VT.b.x, VT.b.y);
    ctx.setLineDash([6/S, 4/S]); ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.6/S; ctx.stroke(); ctx.setLineDash([]);
  }
  if(VT.a) mark(VT.a, "A", "#ffffff");
  if(VT.b) mark(VT.b, "B", "#ff9ad5");
  // легенда и строка A–B — в углу экрана
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  var lines = VT.a ? ["Кто кого видит: из A виден стоящий человек (голова или тело)",
                      "■ зелёный — видно и стоя, и присев   ■ жёлтый — только стоя   ■ голубой — только присев",
                      "A: пол " + Math.round(visFloorAt(VT.a.x, VT.a.y)) + " · считалось " + VT.ms + " мс · Shift+клик — точка B, Esc — убрать"]
                   : ["Кто кого видит: клик по радару — точка A (откуда смотрим), Shift+клик — точка B"];
  var pt = vtPairText(); if(pt) lines = lines.concat(pt);
  ctx.font = "12px 'IBM Plex Sans',sans-serif";
  var w = 0; lines.forEach(function(l){ w = Math.max(w, ctx.measureText(l).width); });
  var x0 = 14, y0 = 14, h = 18*lines.length + 12;
  ctx.fillStyle = "rgba(10,14,9,0.92)"; ctx.fillRect(x0, y0, w + 20, h);
  ctx.strokeStyle = "rgba(120,140,100,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 + .5, w + 19, h - 1);
  ctx.textAlign = "left";
  lines.forEach(function(l, i){
    ctx.fillStyle = i >= lines.length - (pt ? pt.length : 0) ? "#ffd76a" : (i === 0 ? "#e8ecdd" : "#c9cfbd");
    if(i === 1 && VT.a){   // цветные квадратики легенды
      var parts = [["■ зелёный — видно и стоя, и присев   ", "rgb(70,220,90)"], ["■ жёлтый — только стоя   ", "rgb(250,205,40)"], ["■ голубой — только присев", "rgb(70,170,250)"]], xx = x0 + 10;
      parts.forEach(function(p){ ctx.fillStyle = p[1]; ctx.fillText(p[0], xx, y0 + 20 + 18*i); xx += ctx.measureText(p[0]).width; });
      return;
    }
    ctx.fillText(l, x0 + 10, y0 + 20 + 18*i);
  });
  ctx.restore();
}
cv.addEventListener("mousedown", function(e){
  if(!vtOn() || e.button !== 0 || mapEdOn()) return;
  var w0 = navScreenToWorld(e.clientX, e.clientY), w = snapToWalkable(w0.x, w0.y), p = {x: Math.round(w.x*10)/10, y: Math.round(w.y*10)/10};   // клик в стену — к ближайшему полу
  if(e.shiftKey && VT.a) VT.b = p; else { VT.a = p; VT.b = null; }
  e.stopImmediatePropagation(); e.preventDefault(); draw();
}, true);
window.addEventListener("keydown", function(e){ if(vtOn() && e.key === "Escape"){ VT.a = VT.b = null; draw(); } });
if(chkVis) chkVis.addEventListener("change", function(){ draw(); });


// ---------- (v273) разбор взгляда: показ того, что записал выбор взгляда для выбранного бота (игру не меняет) ----------
var chkLookDbg = document.getElementById("chkLookDbg");
var lookDbgEl = document.createElement("div"); lookDbgEl.id = "lookDbg"; document.body.appendChild(lookDbgEl);
if(chkLookDbg) chkLookDbg.addEventListener("change", function(){ LOOKDBG.on = chkLookDbg.checked; lookDbgEl.style.display = LOOKDBG.on ? "block" : "none"; lookDbgPanel(true); });
function lookDbgBot(){ var id = lookDbgId(); if(!id) return null; var b = bots.filter(function(o){ return o.id === id; })[0]; return b && b.alive ? b : null; }
function ldCandName(c){
  if(c.pro) return "как у про";
  if(c.snd) return "звук / контакт";
  if(c.pos) return "позиция " + c.pos;
  if(typeof c.j === "string") return "угол поста";
  if(c.j >= 1000){ var z1 = BZ.ids[c.j-1000]; return "вход из " + (zoneUserName(z1) || z1); }
  var z = BZ.ids[c.j]; return zoneUserName(z) || z;
}
var LD_WHY = {pro:"точка про: с этого места про смотрят сюда", glance:"мельком на опасный угол сбоку на бегу", look:"угроза: лучший вариант из оценки (делёж углов в команде)"};
var LD_URG = ["спокойно — поворот плавный, угол держит ≥0,8 с", "тревога — быстрый поворот (свежий звук/инфа рядом)", "бой — без задержек"];
function ldN(v, k){ return (v === undefined || v === null || !isFinite(v)) ? "—" : (+v).toFixed(k === undefined ? 2 : k); }
function lookDbgPanel(force){
  if(!LOOKDBG.on) return;
  if(!force && nowTs - (lookDbgPanel._t || 0) < 200) return; lookDbgPanel._t = nowTs;
  var b = lookDbgBot();
  if(!b){ lookDbgEl.innerHTML = '<div class="ld-h">Разбор взгляда</div><div class="ld-s">Кликни по живому игроку на радаре или по его карточке.</div>'; return; }
  var esc = function(t){ return String(t).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); };
  var L = b._ld || {}, P = b._ldPlan, h = [];
  if(!b._ld) h.push('<div class="ld-s ld-f">Данных ещё нет: запиши хотя бы один тик с включённой галочкой (сними паузу на миг).</div>');
  var moving = b.curSpeed > 60*SPD_K;
  h.push('<div class="ld-h">' + esc(nick(b.id)) + ' · ' + b.team + ' №' + pnum(b.id) + ' · ' + esc(whyText(b).split(" · ")[0]) + ' · ' + (moving ? "бежит" : b.curSpeed > 15*SPD_K ? "идёт" : "стоит") + '</div>');
  var rs = L.reasonFinal || L.reason, rsT = rs ? (LD_WHY[String(rs).replace("+open","")] || WHY_LOOK[String(rs).replace("+open","")] || rs) + (String(rs).indexOf("+open") > 0 ? " (+ отвернулся от стены)" : "") : "по ходу движения (цели нет)";
  h.push('<div class="ld-s"><div class="ld-k">Смотрит сейчас</div>' + esc(rsT) + (L.final ? ' → ' + esc(calloutName(L.final.x, L.final.y)) : ' → итог: смотрит по ходу движения') +
    '<div class="ld-f">срочность: ' + esc(LD_URG[L.urgent === true ? 2 : (L.urgent||0)] || "") + '</div>' +
    (L.steps && L.steps.length ? '<div class="ld-f">' + L.steps.map(esc).join('<br>') + '</div>' : '') + '</div>');
  // (v381) арбитр взгляда: кандидаты по уровням LOOK_LEVEL (выше — важнее), выбран верхний
  if(b._ldArb && b._ldArb.length) h.push('<div class="ld-s"><div class="ld-k">Арбитр взгляда (уровень · вид · вес)</div>' +
    b._ldArb.slice().sort(function(x, y){ return y.lvl - x.lvl || y.sc - x.sc; }).map(function(c, i){ return (i === 0 ? '<b>' : '') + c.lvl + ' · ' + esc(WHY_LOOK[c.kind] || c.kind) + ' · ' + ldN(c.sc, 2) + (i === 0 ? '</b>' : ''); }).join('<br>') + '</div>');
  if(P && (rs === "look" || !rs)){
    var cs = P.cands.slice().sort(function(x, y){ return y.sc - x.sc; }).slice(0, 8);
    var rows = cs.map(function(c, i){
      var f = (c.f || []).map(function(q){ return esc(q[0]) + ' <span class="ld-n">' + ldN(q[1]) + '</span>'; }).join(' × ');
      return '<tr' + (c.j === P.pick ? ' class="pick"' : '') + '><td class="ld-n">' + (i+1) + '</td><td>' + esc(ldCandName(c)) + (c.fresh ? ' · свежее' : '') +
        '<div class="ld-f">' + f + '</div></td><td class="ld-n" style="text-align:right">' + ldN(c.sc, 3) + '</td></tr>'; }).join('');
    h.push('<div class="ld-s"><div class="ld-k">Варианты взгляда (балл = произведение) · ' + ((tick - P.tick)/TICK_HZ).toFixed(1) + ' с назад</div><table>' + rows + '</table>' +
      (P.why.length ? '<div class="ld-f">' + P.why.map(esc).join('<br>') + '</div>' : '') + '</div>');
  } else if(rs && rs !== "look") h.push('<div class="ld-s ld-f">Оценка угроз сейчас не решает: взгляд задан причиной выше (она важнее). Варианты — на радаре, если были.</div>');
  var src = [], hs = b.heardSound;
  if(hs && tick - hs.tick < 6*TICK_HZ) src.push((hs.team && hs.team !== b.team ? "слышал врага" : "слышал") + " (" + (hs.kind || "звук") + ") " + esc(calloutName(hs.x, hs.y)) + ' · <span class="ld-n">' + ((tick-hs.tick)/TICK_HZ).toFixed(1) + ' с</span>');
  if(b.lastIntel && tick - b.lastIntel.tick < 10*TICK_HZ) src.push("инфа " + esc(calloutName(b.lastIntel.x, b.lastIntel.y)) + ' · <span class="ld-n">' + ((tick-b.lastIntel.tick)/TICK_HZ).toFixed(1) + ' с</span>');
  var BL = beliefLast[b.team] || {}; for(var e in BL){ var q = BL[e]; if(!q || tick - q.tick > 15*TICK_HZ) continue; var eb = bots.filter(function(o){ return o.id === e; })[0]; if(!eb || !eb.alive) continue;
    src.push("команда видела " + esc(nick(e)) + " " + esc(calloutName(q.x, q.y)) + ' · <span class="ld-n">' + ((tick-q.tick)/TICK_HZ).toFixed(1) + ' с</span>'); }
  if(b._coverDir && tick < b._coverDir.until) src.push("просьба прикрыть угол " + esc(calloutName(b._coverDir.pt.x, b._coverDir.pt.y)));
  if(b._spam && tick < b._spam.until) src.push("простреливает смок → " + esc(calloutName(b._spam.pt.x, b._spam.pt.y)));
  if(tick < (b.blindUntil||0)) src.push("ослеплён ещё " + ((b.blindUntil-tick)/TICK_HZ).toFixed(1) + " с");
  h.push('<div class="ld-s"><div class="ld-k">Что он знает (источники)</div>' + (src.length ? src.join('<br>') : '<span class="ld-f">свежего ничего</span>') + '</div>');
  var Z = b._ldZones || {}, zl = Object.keys(Z).map(function(j){ return [+j, Z[j]]; }).filter(function(r){ return (r[1].th||0) > 0.005; }).sort(function(x, y){ return (y[1].th||0) - (x[1].th||0); }).slice(0, 8);
  if(zl.length) h.push('<div class="ld-s"><div class="ld-k">Опасность зон, откуда могут прийти (из оценки взгляда)</div><table><tr class="ld-f"><td>зона</td><td>итог</td><td>враг тут</td><td>соседи</td><td>тайминг</td><td>непров.</td><td>привычка</td></tr>' +
    zl.map(function(r){ var d = r[1], zn = zoneUserName(BZ.ids[r[0]]) || BZ.ids[r[0]];
      return '<tr><td>' + esc(zn) + (d.entry ? ' (вход)' : '') + '</td><td class="ld-n">' + ldN(d.th) + '</td><td class="ld-n">' + ldN(d.bel) + '</td><td class="ld-n">' + ldN(d.nbr) + '</td><td class="ld-n">' + ldN(d.tim) + '</td><td class="ld-n">' + ldN(d.unc) + '</td><td class="ld-n">' + ldN(d.hab) + '</td></tr>'; }).join('') +
    '</table><div class="ld-f">«враг тут» — сколько врагов команда ждёт в зоне (её знание, не правда); на радаре — красным. Штриховка — по таймингу враг уже мог дойти, но команда там никого не ждёт</div></div>');
  var sk = Object.keys(Z).filter(function(j){ return Z[j].skip && Z[j].skip !== "угрозы нет"; }).map(function(j){ return esc(zoneUserName(BZ.ids[j]) || BZ.ids[j]) + " — " + esc(Z[j].skip); });
  if(sk.length) h.push('<div class="ld-s"><div class="ld-k">Зоны, которые не рассматривал</div><div class="ld-f">' + sk.join('; ') + '</div></div>');
  lookDbgEl.innerHTML = h.join('');
}
function lookDbgDraw(){
  if(!LOOKDBG.on) return;
  lookDbgPanel(false);
  var b = lookDbgBot(); if(!b) return;
  var s1 = 1/view.scale;
  ctx.save();
  // 1) что знает команда: сколько врагов ждут в каждой зоне (красный) — число в зоне
  var m = BZ.ids.map(function(id, j){ return beliefZoneKnown(b.team, j); }), mx = Math.max(0.3, Math.max.apply(null, m));
  BZ.ids.forEach(function(id, j){ var v = m[j]; if(!(v >= 0.03)) return; var z = zoneById(id); if(!z) return;
    ctx.beginPath(); z.points.forEach(function(p, i){ if(i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath();
    ctx.fillStyle = "rgba(214,82,70," + (0.08 + 0.32*Math.min(1, v/mx)).toFixed(3) + ")"; ctx.fill(); });
  // 2) опасность для этого бота (оценка взгляда): обводка, толщина по баллу, подпись «угр / враг»
  // по таймингу: враг уже мог дойти, а команда о нём там не знает — штриховка; дойдёт в ближайшие 10 с — «через N с»
  var RT = REACH[b.team];
  if(RT){ if(!lookDbgDraw._pat){ var pc = document.createElement("canvas"); pc.width = pc.height = 10; var px = pc.getContext("2d");
      px.strokeStyle = "rgba(190,150,255,.45)"; px.lineWidth = 1.5; px.beginPath(); px.moveTo(0, 10); px.lineTo(10, 0); px.stroke(); lookDbgDraw._pat = ctx.createPattern(pc, "repeat"); }
    BZ.ids.forEach(function(id, j){ var z = zoneById(id), c = BZ.cent[j]; if(!z || !c || !isFinite(RT[j])) return;
      if(RT[j] <= tick && !(m[j] >= 0.03)){ ctx.beginPath(); z.points.forEach(function(p, i){ if(i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.fillStyle = lookDbgDraw._pat; ctx.fill(); }
      else if((b._ldZones || {})[j] && RT[j] - tick >= TICK_HZ && RT[j] - tick < 10*TICK_HZ){ ctx.font = (8*s1) + "px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(200,170,255,.95)"; ctx.fillText("враг через " + Math.ceil((RT[j]-tick)/TICK_HZ) + " с", c.x, c.y + 10*s1); } }); }
  var Z = b._ldZones || {}, tm = 0.001; for(var j in Z) tm = Math.max(tm, Z[j].th || 0);
  for(var j3 in Z){ var dk = Z[j3]; if(!dk.skip || dk.skip === "угрозы нет") continue; var z3 = zoneById(BZ.ids[j3]), c3 = BZ.cent[+j3]; if(!z3 || !c3) continue;
    ctx.beginPath(); z3.points.forEach(function(p, i){ if(i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath();
    ctx.setLineDash([4*s1, 3*s1]); ctx.strokeStyle = "rgba(170,170,170,.7)"; ctx.lineWidth = 1.2*s1; ctx.stroke(); ctx.setLineDash([]);
    ctx.font = (8*s1) + "px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(200,200,200,.9)"; ctx.fillText("выкинута: " + dk.skip, c3.x, c3.y - 10*s1); }
  for(var j2 in Z){ var d = Z[j2], z2 = zoneById(BZ.ids[j2]); if(!z2 || d.skip || !((d.th||0) > 0.005)) continue; var k = Math.max(0, (d.th||0)/tm);
    ctx.beginPath(); z2.points.forEach(function(p, i){ if(i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath();
    ctx.strokeStyle = "rgba(232,180,80," + (0.25 + 0.7*k).toFixed(3) + ")"; ctx.lineWidth = (1 + 3*k)*s1; ctx.stroke();
    var c = BZ.cent[+j2]; if(!c) continue;
    var t = "угр " + ldN(d.th) + " · враг " + ldN(d.bel);
    ctx.font = (8.5*s1) + "px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; var tw = ctx.measureText(t).width;
    ctx.fillStyle = "rgba(10,12,9,.82)"; ctx.fillRect(c.x - tw/2 - 2*s1, c.y - 8*s1, tw + 4*s1, 11*s1);
    ctx.fillStyle = "#f0d9a0"; ctx.fillText(t, c.x, c.y); }
  // остальные зоны с ожиданием врага — только число
  BZ.ids.forEach(function(id, j){ if(Z[j] || !(m[j] >= 0.05)) return; var c = BZ.cent[j]; if(!c) return;
    ctx.font = (8*s1) + "px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(240,170,160,.9)"; ctx.fillText("враг " + ldN(m[j]), c.x, c.y); });
  // 3) варианты взгляда: лучи с баллами, выбранный — толстый
  var P = b._ldPlan;
  if(P){ var cs = P.cands.slice().sort(function(x, y){ return y.sc - x.sc; }).slice(0, 8), smx = Math.max(0.001, cs.length ? cs[0].sc : 1);
    cs.forEach(function(c, i){ var pick = c.j === P.pick, k = Math.max(0.15, c.sc/smx);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.pt.x, c.pt.y);
      ctx.strokeStyle = pick ? "#e8dc5a" : "rgba(200,220,255," + (0.25 + 0.5*k).toFixed(3) + ")"; ctx.lineWidth = (pick ? 3 : 1 + k)*s1;
      if(!pick) ctx.setLineDash([5*s1, 4*s1]); ctx.stroke(); ctx.setLineDash([]);
      if(c.src){ ctx.beginPath(); ctx.moveTo(c.src.x, c.src.y); ctx.lineTo(c.pt.x, c.pt.y); ctx.strokeStyle = "rgba(127,208,192,.8)"; ctx.lineWidth = 1*s1; ctx.setLineDash([2*s1, 3*s1]); ctx.stroke(); ctx.setLineDash([]); }
      var t = (i+1) + " " + ldCandName(c) + " · " + ldN(c.sc, 3); ctx.font = (pick ? "700 " : "") + (8.5*s1) + "px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
      var tw = ctx.measureText(t).width; ctx.fillStyle = "rgba(10,12,9,.82)"; ctx.fillRect(c.pt.x - tw/2 - 2*s1, c.pt.y - 8*s1, tw + 4*s1, 11*s1);
      ctx.fillStyle = pick ? "#e8dc5a" : "#cfe0f5"; ctx.fillText(t, c.pt.x, c.pt.y); }); }
  // 4) итог: куда смотрит (белая линия) и источники
  var L = b._ld;
  if(L && L.final){ ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(L.final.x, L.final.y); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5*s1; ctx.stroke();
    ctx.beginPath(); ctx.arc(L.final.x, L.final.y, 4*s1, 0, Math.PI*2); ctx.stroke(); }
  var mark = function(p, col, t){ ctx.beginPath(); ctx.arc(p.x, p.y, 5*s1, 0, Math.PI*2); ctx.strokeStyle = col; ctx.lineWidth = 1.5*s1; ctx.stroke();
    ctx.font = (8*s1) + "px 'IBM Plex Mono',monospace"; ctx.textAlign = "left"; ctx.fillStyle = col; ctx.fillText(t, p.x + 7*s1, p.y + 3*s1); };
  var hs = b.heardSound; if(hs && tick - hs.tick < 6*TICK_HZ) mark(hs, "#7fd0c0", "звук " + ((tick-hs.tick)/TICK_HZ).toFixed(1) + " с");
  if(b.lastIntel && tick - b.lastIntel.tick < 10*TICK_HZ) mark(b.lastIntel, "#c9a0ff", "инфа " + ((tick-b.lastIntel.tick)/TICK_HZ).toFixed(1) + " с");
  var BL = beliefLast[b.team] || {}; for(var e in BL){ var q = BL[e]; if(!q || tick - q.tick > 15*TICK_HZ) continue; var eb = bots.filter(function(o){ return o.id === e; })[0]; if(!eb || !eb.alive) continue;
    mark(q, "#f08a7a", "видели №" + pnum(e) + " " + ((tick-q.tick)/TICK_HZ).toFixed(1) + " с"); }
  if(b._coverDir && tick < b._coverDir.until) mark(b._coverDir.pt, "#9fbf6a", "прикрыть");
  // взгляды тиммейтов — тонко (делёж углов)
  bots.forEach(function(o){ if(o === b || !o.alive || o.team !== b.team || !o.lookTarget) return;
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.lookTarget.x, o.lookTarget.y); ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1*s1; ctx.stroke(); });
  ctx.restore();
}
