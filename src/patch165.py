# v162 шаг 13б: визуал — контуры укрытий под ботами, метка-капля вместо линии
# взгляда, без "дыхания" и покачивания у стоящих, конусы — по галочке (выкл)
rep("""    <label class="chk"><input type="checkbox" id="chkLos" checked> конусы обзора</label>""","""    <label class="chk"><input type="checkbox" id="chkLos"> конусы обзора</label>
    <label class="chk"><input type="checkbox" id="chkOutline" checked> контуры укрытий</label>""")
rep("""      sway = 0.09*Math.sin(nowTs/950 + ph) + 0.04*Math.sin(nowTs/380 + ph*2.3);""","""      sway = 0;""")
# кольцо "дыхания" убрано
rep("""    if(bot._idle){
      // "дыхание": мягкое пульсирующее кольцо, пока стоит и ждёт/держит
      var br = r + (2.5 + 1.3*Math.sin(nowTs/520 + (bot._idlePhase||0)))/view.scale;""","""    if(bot._idle && false){
      var br = r;""")
# капля: кружок с острым краем в сторону взгляда
rep("""    ctx.beginPath(); ctx.arc(rx,ry,r,0,Math.PI*2);
    ctx.fillStyle = bot.team==="CT" ? "#5a9bd9" : "#d9a24a";
    ctx.fill();
    ctx.lineWidth = 1.5/view.scale; ctx.strokeStyle="#0b0f0b"; ctx.stroke();
    var vf = bot._visFacing !== undefined ? bot._visFacing : bot.facing;
    if(vf !== undefined){""","""    var vf = bot._visFacing !== undefined ? bot._visFacing : bot.facing;
    ctx.beginPath();
    if(vf !== undefined){
      var hw = 0.95, tipR = r*1.85;
      ctx.arc(rx, ry, r, vf + hw, vf - hw + Math.PI*2);
      ctx.lineTo(rx + Math.cos(vf)*tipR, ry + Math.sin(vf)*tipR);
      ctx.closePath();
    } else ctx.arc(rx,ry,r,0,Math.PI*2);
    ctx.fillStyle = bot.team==="CT" ? "#5a9bd9" : "#d9a24a";
    ctx.fill();
    ctx.lineWidth = 1.5/view.scale; ctx.strokeStyle="#0b0f0b"; ctx.stroke();
    if(false){""")
# контуры укрытий (под ботами): все стены тонко + заливка отдельных ящиков
rep("""  if(showWalls.checked || chkWallEdit.checked){
    // MANUAL_WALLS — each segment""","""  if(!(showWalls.checked || chkWallEdit.checked) && document.getElementById("chkOutline") && document.getElementById("chkOutline").checked){
    var BX = wallBoxes();
    ctx.fillStyle = "rgba(150,152,146,0.55)";
    BX.forEach(function(poly){ ctx.beginPath(); poly.forEach(function(p, i){ if(i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); });
    ctx.strokeStyle = "rgba(236,234,222,0.55)"; ctx.lineWidth = 1.3/view.scale; ctx.lineCap = "round";
    ctx.beginPath();
    MANUAL_WALLS.forEach(function(s){ ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); });
    ctx.stroke(); ctx.lineCap = "butt";
  }
  if(showWalls.checked || chkWallEdit.checked){
    // MANUAL_WALLS — each segment""")
rep("""function setPost(b, pt, look, hold, tag, spreadIdx){""","""// (v162) отдельно стоящие ящики/колонны — небольшие замкнутые контуры стен
var _WB = null, _WBn = -1;
function wallBoxes(){
  if(_WB && _WBn === MANUAL_WALLS.length) return _WB;
  _WBn = MANUAL_WALLS.length; _WB = [];
  var W = MANUAL_WALLS, par = W.map(function(_, i){ return i; });
  var f = function(i){ while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  var K = function(x, y){ return Math.round(x/3)+","+Math.round(y/3); }, idx = {};
  W.forEach(function(w, i){ [[w[0],w[1]],[w[2],w[3]]].forEach(function(p){
    var kx = Math.round(p[0]/3), ky = Math.round(p[1]/3);
    for(var dx=-1;dx<=1;dx++) for(var dy=-1;dy<=1;dy++){ (idx[(kx+dx)+","+(ky+dy)]||[]).forEach(function(j){ par[f(i)] = f(j); }); }
    (idx[kx+","+ky] = idx[kx+","+ky] || []).push(i); }); });
  var comp = {}; W.forEach(function(_, i){ (comp[f(i)] = comp[f(i)] || []).push(i); });
  Object.keys(comp).forEach(function(c){
    var S = comp[c], xs = [], ys = [];
    S.forEach(function(i){ xs.push(W[i][0], W[i][2]); ys.push(W[i][1], W[i][3]); });
    if(Math.max(Math.max.apply(null, xs)-Math.min.apply(null, xs), Math.max.apply(null, ys)-Math.min.apply(null, ys)) >= 90) return;
    // обход контура по сегментам
    var left = S.slice(), poly = [[W[left[0]][0], W[left[0]][1]], [W[left[0]][2], W[left[0]][3]]]; left.shift();
    var guard = 0;
    while(left.length && guard++ < 200){
      var e = poly[poly.length-1], hit = -1, rev = false;
      for(var q=0;q<left.length;q++){ var w = W[left[q]];
        if(Math.hypot(w[0]-e[0], w[1]-e[1]) < 4){ hit = q; break; }
        if(Math.hypot(w[2]-e[0], w[3]-e[1]) < 4){ hit = q; rev = true; break; } }
      if(hit < 0) break;
      var w2 = W[left[hit]]; poly.push(rev ? [w2[0], w2[1]] : [w2[2], w2[3]]); left.splice(hit, 1);
    }
    if(!left.length) _WB.push(poly);
  });
  return _WB;
}
function setPost(b, pt, look, hold, tag, spreadIdx){""")
