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
