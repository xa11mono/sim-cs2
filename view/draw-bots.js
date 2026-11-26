// [хозяева: drawBots] часть draw (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 723–845 исходного draw
function drawBots(K){
  bots.forEach(function(bot){
    if(!bot.alive) return;
    var rx = bot.px + (bot.x-bot.px)*K.alpha;
    var ry = bot.py + (bot.y-bot.py)*K.alpha;
    var r = (bot.crouching ? 6.2 : 7)/view.scale; // сидя — чуть меньше (v161: кружки меньше, не закрывают мелкие укрытия)
    if(bot._idle && false){
      var br = r;
      ctx.beginPath(); ctx.arc(rx, ry, br, 0, Math.PI*2);
      ctx.strokeStyle = bot.team==="CT" ? "rgba(90,155,217,0.35)" : "rgba(217,162,74,0.35)";
      ctx.lineWidth = 1.2/view.scale; ctx.stroke();
    }
    if(bot._reloading && bot.weapon){
      // раздел 14: перезарядка — белая дуга заполняется до конца перезарядки
      var rl = bot.weapon.reload*TICK_HZ, done = 1 - Math.max(0, bot.reloadUntil - tick)/rl;
      ctx.beginPath(); ctx.arc(rx, ry, r + 3.5/view.scale, -Math.PI/2, -Math.PI/2 + Math.PI*2*done);
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.8/view.scale; ctx.stroke();
    }
    var tt4 = teamTac.T;
    if(bot.team === "T" && tt4 && tt4.phase === "setup" && bot.atPost && tt4.tac.setupEnd > 0){
      // ждёт выхода — дуга обратного отсчёта до execute
      var total = (tt4.setupSec || tt4.tac.setupEnd)*TICK_HZ, leftT = Math.max(0, tt4.execTick - tick);
      ctx.beginPath(); ctx.arc(rx, ry, r + 6/view.scale, -Math.PI/2, -Math.PI/2 + Math.PI*2*(leftT/total));
      ctx.strokeStyle = "rgba(255,214,140,0.8)"; ctx.lineWidth = 1.8/view.scale; ctx.stroke();
    }
    // этажи (раздел 9): верхний уровень — светлый внешний ободок и тень снизу,
    // нижний (подвал/проходы под картой) — тёмный пунктирный ободок
    var uV = bot._underV || 0, oV = bot._overV || 0;
    // (v543) в прыжке (подъём из демок): тень на земле смещается вниз и кружок чуть больше — по высоте прыжка (дуга 4·q·(1−q), q — доля полёта)
    var CLd = bot._climb, airH = CLd && CLd.jump ? 4*(CLd.air || 0)*(1 - (CLd.air || 0)) : 0;
    // (v550, владелец 11.11: «сделай всё плавно») тень и пунктирный ободок проявляются и гаснут вместе с высотой прыжка (airH), а не включаются
    // сразу; на остановке между двумя прыжками подъёма их нет
    if(CLd && CLd.jump && airH > 0.01){ var sOff = (2 + 4*airH)/view.scale;   // (v551, владелец 11.11: «будто прыгает очень высоко») тень ближе
      ctx.beginPath(); ctx.ellipse(rx + sOff*0.4, ry + sOff, r*(1 - 0.2*airH), r*0.55, 0, 0, Math.PI*2); ctx.fillStyle = "rgba(0,0,0,"+(0.55*Math.min(1, airH*2)).toFixed(3)+")"; ctx.fill();   // тень на земле
      r = r*(1 + 0.12*airH);   // (v551, владелец 11.11: «слишком сильно масштаб увеличивается») до +12 % (было +35 %; DESIGN.md, «Маркер игрока»)
      ctx.beginPath(); ctx.arc(rx, ry, r + 3.5/view.scale, 0, Math.PI*2); ctx.setLineDash([3/view.scale, 2.5/view.scale]);
      ctx.strokeStyle = "rgba(255,255,255,"+(0.85*Math.min(1, airH*2)).toFixed(3)+")"; ctx.lineWidth = 1.4/view.scale; ctx.stroke(); ctx.setLineDash([]); }   // пунктирный ободок — «в воздухе»   // (v535) под / над другим этажом — доля 0..1, плавно (floorViewTick, levels)
    // прыжок / спрыгнул — стрелка у игрока на 0,6 с
    if(bot._jump && tick - bot._jump.t < 0.6*TICK_HZ){
      var jk = 1 - (tick - bot._jump.t)/(0.6*TICK_HZ), jy = bot._jump.up ? -1 : 1, jr = r + 7/view.scale;
      ctx.strokeStyle = "rgba(255,255,255,"+(0.9*jk).toFixed(2)+")"; ctx.lineWidth = 1.8/view.scale;
      ctx.beginPath(); ctx.moveTo(rx - 4/view.scale, ry + jy*(jr - 4/view.scale)); ctx.lineTo(rx, ry + jy*jr); ctx.lineTo(rx + 4/view.scale, ry + jy*(jr - 4/view.scale)); ctx.stroke();
    }
    if(oV > 0.02){   // над другим этажом — тень снизу и светлый ободок, плотность по доле
      ctx.beginPath(); ctx.arc(rx + 2/view.scale, ry + 3/view.scale, r, 0, Math.PI*2); ctx.fillStyle = "rgba(0,0,0,"+(0.45*oV).toFixed(3)+")"; ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ry, r + 2.2/view.scale, 0, Math.PI*2); ctx.strokeStyle = "rgba(255,255,255,"+(0.75*oV).toFixed(3)+")"; ctx.lineWidth = 1.4/view.scale; ctx.stroke();
    }
    // (v548, владелец 10.11: «непонятно, когда бот слепой — рядом с кружком ещё какой-то кружок; в смоке — не видно») состояние — на самом
    // кружке (DESIGN.md, «Маркер игрока»): ослеплён — белеет, в дыму — серый и полупрозрачный. Было: белый круг вокруг (r + 4)
    var blindK = tick < bot.blindUntil ? Math.min(1, (bot.blindUntil - tick)/64*0.5) : 0;
    var smokeIn = smokes.some(function(sm){ var sr = smokeRadiusNow(sm); return sr > 8 && areaHas(sm, sr, bot.x, bot.y); });
    var vf = bot._visFacing !== undefined ? bot._visFacing : bot.facing;
    ctx.beginPath();
    if(vf !== undefined){
      var hw = 0.95, tipR = r*1.85;
      ctx.arc(rx, ry, r, vf + hw, vf - hw + Math.PI*2);
      ctx.lineTo(rx + Math.cos(vf)*tipR, ry + Math.sin(vf)*tipR);
      ctx.closePath();
    } else ctx.arc(rx,ry,r,0,Math.PI*2);
    // (v323, М5) под другим полом (Underpass, Dark) — тусклый и сероватый, как на радаре CS2 игрок под этажом. (v535) Цвет — смесь своего и
    // серого по доле «под этажом» (uV, 0..1): на лестнице меняется плавно, наполовину под полом — наполовину серый
    var under = uV > 0.5;
    var mixC = function(a, b, t){ return "rgba(" + Math.round(a[0] + (b[0]-a[0])*t) + "," + Math.round(a[1] + (b[1]-a[1])*t) + "," + Math.round(a[2] + (b[2]-a[2])*t) + "," + (a[3] + (b[3]-a[3])*t).toFixed(3) + ")"; };
    var baseC = bot.team === "CT" ? [90,155,217,1] : [217,162,74,1], fillC = bot.team === "CT" ? mixC(baseC, [122,140,158,0.55], uV) : mixC(baseC, [158,144,122,0.55], uV);
    if(smokeIn) fillC = mixC(baseC, [baseC[0],baseC[1],baseC[2],0.6], 1);
    if(blindK > 0) fillC = mixC(baseC, [255,255,255,1], 0.75*blindK);
    ctx.fillStyle = fillC; ctx.fill();
    ctx.lineWidth = (blindK > 0 ? 2 : smokeIn ? 2.2 : 1.5)/view.scale; ctx.strokeStyle = blindK > 0 ? "#fff" : smokeIn ? "#2b3029" : under ? "rgba(11,15,11,0.5)" : "#0b0f0b";
    if(smokeIn && !blindK) ctx.setLineDash([1.4/view.scale, 1.4/view.scale]); ctx.stroke(); ctx.setLineDash([]);
    var bw = 18/view.scale, bh = 2.5/view.scale;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(rx-bw/2, ry-r-8/view.scale, bw, bh);
    ctx.fillStyle = bot.hp>50 ? "#94b449" : (bot.hp>25 ? "#d9832f" : "#c1584f");
    ctx.fillRect(rx-bw/2, ry-r-8/view.scale, bw*Math.max(0,bot.hp)/100, bh);
    if(bot.state && bot.state !== "patrol"){
      var stCol = bot.state==="engage" ? "#c1584f" : (bot.state==="hold" ? "#d9832f" : "#8fb3d9");
      var stCh = bot.state==="engage" ? "!" : (bot.state==="hold" ? "=" : "«");
      ctx.fillStyle = stCol;
      ctx.font = (10/view.scale)+"px 'IBM Plex Mono',monospace";
      ctx.textAlign = "center";
      ctx.fillText(stCh, rx, ry-r-11/view.scale);
    }
    if(bot.tRole){
      ctx.fillStyle = "#fff"; ctx.font = "600 "+(7.5/view.scale)+"px 'IBM Plex Mono',monospace";
      ctx.font = "700 "+(8.5/view.scale)+"px 'IBM Plex Mono',monospace";
      ctx.textAlign = "center"; ctx.fillText(String(pnum(bot.id)), rx, ry+3/view.scale);
    }
    if(bot._knife){ ctx.fillStyle = "#e8ecdd"; ctx.font = (7/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.fillText("нож", rx, ry-r-14/view.scale); }
    if(showWhy && showWhy.checked){
      var wt = whyText(bot);
      ctx.font = (7.5/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
      var tw = ctx.measureText(wt).width;
      ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(rx-tw/2-2/view.scale, ry+r+2/view.scale, tw+4/view.scale, 10/view.scale);
      ctx.fillStyle = bot.team === "CT" ? "#cfe4f8" : "#f6ddb3"; ctx.fillText(wt, rx, ry+r+9.5/view.scale);
    }
    if(bomb && bomb.carrier === bot){
      ctx.beginPath(); ctx.arc(rx+r*0.9, ry+r*0.9, 3.2/view.scale, 0, Math.PI*2);
      ctx.fillStyle = "#e05c52"; ctx.fill(); ctx.strokeStyle = "#0b0f0b"; ctx.lineWidth = 1/view.scale; ctx.stroke();
    }
    if(bot.planting || bot.defusing){
      // кольцо прогресса планта/дефуза
      var tot = bot.planting ? PLANT_TICKS : (bot.kit ? DEFUSE_KIT_TICKS : DEFUSE_TICKS);
      var left = (bot.planting ? bot.plantUntil : bot.defuseUntil) - tick;
      var fr = Math.max(0, Math.min(1, 1 - left/tot));
      ctx.beginPath(); ctx.arc(rx, ry, r+5/view.scale, -Math.PI/2, -Math.PI/2 + fr*Math.PI*2);
      ctx.strokeStyle = bot.planting ? "#e05c52" : "#5a9bd9"; ctx.lineWidth = 2.5/view.scale; ctx.stroke();
    }
    if(bot.onStairs){
      // "лестницы" (план §3) — жёлтое кольцо, пока бот физически идёт по
      // отрезку пути с крутым перепадом высоты (см. расчёт в stepTick)
      ctx.beginPath(); ctx.arc(rx, ry, r+3/view.scale, 0, Math.PI*2);
      ctx.strokeStyle = "#e8dc5a"; ctx.lineWidth = 1.5/view.scale;
      ctx.setLineDash([3/view.scale, 3/view.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if(bot.walking){
      // "тихий шаг" (план §3) — маленький голубой полумесяц-индикатор
      // ("осторожничает"), не путать с жёлтым кольцом лестниц
      ctx.beginPath(); ctx.arc(rx, ry+r+6/view.scale, 2.2/view.scale, 0, Math.PI*2);
      ctx.fillStyle = "rgba(143,179,217,0.9)"; ctx.fill();
    }
  });

  ctx.restore();
}
// (17.11) контур круга дыма / огня — рисование (перенесено из 360)
function areaPath(o, r){ ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2); ctx.closePath(); }   // контур области для рисования
