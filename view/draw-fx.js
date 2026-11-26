// [хозяева: drawSmokes, drawTracers] часть draw (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 338–449 исходного draw
function drawSmokes(K){
  smokes.forEach(function(sm){
    var rr = smokeRadiusNow(sm); if(rr < 2) return;
    var left = sm.until - sm.born > 0 ? (sm.until - tick)/(sm.until - sm.born) : 0, fade = Math.min(1, (sm.until - tick)/64), age = tick - sm.born;
    var seed = sm.born*0.37 + sm.x*0.013 + sm.y*0.029;
    // основа — ровно радиус дыма, плотнее к центру
    var g = ctx.createRadialGradient(sm.x, sm.y, rr*0.12, sm.x, sm.y, rr);
    g.addColorStop(0, "rgba(212,215,207,"+(0.88*fade)+")");
    g.addColorStop(0.7, "rgba(194,198,189,"+(0.76*fade)+")");
    g.addColorStop(1, "rgba(172,177,167,"+(0.46*fade)+")");
    ctx.save(); areaPath(sm, rr + 0.5); ctx.clip();   // (М150) дым — полный круг
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sm.x, sm.y, rr, 0, Math.PI*2); ctx.fill();
    // клубы внутри радиуса — медленный дрейф, без пульса
    for(var q=0;q<6;q++){
      var qa = K.fxR(seed+q*1.7)*Math.PI*2 + age*0.0016*(q%2 ? 1 : -1), qd = rr*(0.2+0.4*K.fxR(seed+q*3.1)), qr = rr*(0.3+0.16*K.fxR(seed+q*5.3));
      var cx = sm.x + Math.cos(qa)*qd, cy = sm.y + Math.sin(qa)*qd;
      var pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, qr);
      pg.addColorStop(0, "rgba(238,240,234,"+(0.34*fade)+")"); pg.addColorStop(1, "rgba(238,240,234,0)");
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, qr, 0, Math.PI*2); ctx.fill();
    }
    // край — где дым кончается
    ctx.restore();
    ctx.strokeStyle = "rgba(242,244,238,"+(0.5*fade)+")"; ctx.lineWidth = 1.1/K.S0;
    areaPath(sm, rr); ctx.stroke();
    // (v271) дыры от пуль — тёмный коридор внутри облака, затягивается за SMOKE_HOLE.life
    (sm.bholes || []).forEach(function(h){
      if(h.until <= tick) return;
      ctx.save(); ctx.beginPath(); ctx.arc(sm.x, sm.y, rr, 0, Math.PI*2); ctx.clip();
      ctx.strokeStyle = "rgba(20,24,18,"+(0.55*(h.until - tick)/SMOKE_HOLE.life)+")"; ctx.lineWidth = SMOKE_HOLE.w*2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(h.x1, h.y1); ctx.lineTo(h.x2, h.y2); ctx.stroke(); ctx.restore();
    });
    K.timeArc(sm.x, sm.y, rr + 3.5/K.S0, left, sm.team, fade);
  });
  fires.forEach(function(fr){
    var R = NADE.molly.radius, life = fr.until - tick, fade = Math.min(1, life/40), age = tick - fr.born, r0 = fireRadiusNow(fr);
    ctx.save(); areaPath(fr, r0 + 0.5); ctx.clip();   // (М150) огонь — полный круг
    var seed = fr.born*0.53 + fr.x*0.011 + fr.y*0.017;
    var fg = ctx.createRadialGradient(fr.x, fr.y, 0, fr.x, fr.y, r0);
    fg.addColorStop(0, "rgba(255,196,92,"+(0.72*fade)+")");
    fg.addColorStop(0.55, "rgba(240,116,44,"+(0.5*fade)+")");
    fg.addColorStop(1, "rgba(214,70,30,"+(0.24*fade)+")");
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fr.x, fr.y, r0, 0, Math.PI*2); ctx.fill();
    // языки пламени: место своё у каждого огня, мерцает яркость, а не размер
    for(var e=0;e<9;e++){
      var ea = K.fxR(seed+e*2.3)*Math.PI*2, ed = r0*(0.15+0.72*K.fxR(seed+e*4.1)), fl = 0.55 + 0.45*Math.sin(tick*0.35 + e*1.9);
      ctx.fillStyle = "rgba(255,228,146,"+(0.6*fade*fl)+")";
      ctx.beginPath(); ctx.arc(fr.x + Math.cos(ea)*ed, fr.y + Math.sin(ea)*ed, (2.6+2.4*K.fxR(seed+e*7.7))/K.S0, 0, Math.PI*2); ctx.fill();
    }
    // край — где жжёт
    ctx.restore();
    ctx.strokeStyle = "rgba(255,124,62,"+(0.75*fade)+")"; ctx.lineWidth = 1.2/K.S0;
    areaPath(fr, r0); ctx.stroke();
    K.timeArc(fr.x, fr.y, r0 + 3.5/K.S0, life/NADE.molly.life, fr.team, fade);
  });
  // граната в полёте: форма по типу (не только цвет) — дым кружок, флешка ромб, HE кружок с точкой, молотов треугольник
  // (v437) летящая граната — силуэт гранаты (NADE_ICON, killfeed) вместо фигур; тёмная тень — чтобы читался на светлом полу
  var nadeIcon = function(n, x, y, px){
    var im = nadeImg(n.type, n.team); if(!im || !im.complete || !im.naturalWidth) return;
    var h = px*3.2/K.S0, w = h*im._ar;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 3;
    ctx.drawImage(im, x - w/2, y - h/2, w, h); ctx.restore();
  };
  var nadeRGB = function(t){ return t === "smoke" ? "214,217,209" : t === "flash" ? "255,255,255" : t === "he" ? "232,88,76" : "255,154,60"; };
  nadesInAir.forEach(function(n){
    var rgb = nadeRGB(n.type);
    // (физика гранат, 30.10) всё — из состояния физики (damage: n.x, n.y, n.z, след n.trail — точки полёта по тикам): прежняя
    // нарисованная дуга к цели (подъём по синусу) удалена — рисунок и полёт были разными дугами. Высота над полом под гранатой —
    // размер значка и тень; лайнап — ещё и где сработает (n.tx, n.ty — расчёт той же физикой)
    var hz = n.z != null ? Math.max(0, n.z - visFloorAt(n.x, n.y, n.z)) : 0, hk = Math.min(1, hz/300);
    if(n.trail.length){
      var p0 = n.trail[0], tg = ctx.createLinearGradient(p0[0], p0[1], n.x, n.y);
      tg.addColorStop(0, "rgba("+rgb+",0)"); tg.addColorStop(1, "rgba("+rgb+",0.6)");
      ctx.strokeStyle = tg; ctx.lineWidth = 1.4/K.S0;
      ctx.beginPath(); n.trail.forEach(function(p,i){ if(i===0) ctx.moveTo(p[0],p[1]); else ctx.lineTo(p[0],p[1]); }); ctx.lineTo(n.x,n.y); ctx.stroke();
    }
    if(n.lob && n.tx != null){
      ctx.strokeStyle = "rgba("+rgb+",0.6)"; ctx.lineWidth = 1.1/K.S0;
      ctx.beginPath(); ctx.arc(n.tx, n.ty, 5/K.S0, 0, Math.PI*2); ctx.moveTo(n.tx-8/K.S0, n.ty); ctx.lineTo(n.tx-3/K.S0, n.ty); ctx.moveTo(n.tx+3/K.S0, n.ty); ctx.lineTo(n.tx+8/K.S0, n.ty); ctx.stroke();
    }
    if(hz > 8){ ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.beginPath(); ctx.ellipse(n.x, n.y, 3.2/K.S0, 2/K.S0, 0, 0, Math.PI*2); ctx.fill(); }
    nadeIcon(n, n.x, n.y, 4.2 + 2.6*hk);
  });
  nadeFx.forEach(function(fx){
    var age = tick - fx.born;
    if(fx.type === "flash"){
      // хлопок: короткая вспышка в точке и тонкое кольцо — видно где, и не слепит смотрящего
      if(age < 10){ var c = 1 - age/10; ctx.fillStyle = "rgba(255,255,250,"+(0.85*c)+")"; ctx.beginPath(); ctx.arc(fx.x, fx.y, (6 + 10*(1-c))/K.S0 + 6, 0, Math.PI*2); ctx.fill(); }
      if(age < 26){ var k = age/26, e2 = 1 - (1-k)*(1-k);
        ctx.strokeStyle = "rgba(255,255,245,"+(0.7*(1-k))+")"; ctx.lineWidth = 1.6/K.S0; ctx.beginPath(); ctx.arc(fx.x, fx.y, 14 + 96*e2, 0, Math.PI*2); ctx.stroke(); }
    } else if(fx.type === "he"){
      // ударная волна до настоящего радиуса HE + жар в центре
      var k2 = Math.min(1, age/20), e3 = 1 - (1-k2)*(1-k2)*(1-k2), a2 = 1 - age/40;
      ctx.strokeStyle = "rgba(255,150,72,"+(0.9*a2)+")"; ctx.lineWidth = 2.4/K.S0;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, NADE.he.radius*e3, 0, Math.PI*2); ctx.stroke();
      if(age < 14){ var c2 = 1 - age/14; ctx.fillStyle = "rgba(255,214,140,"+(0.8*c2)+")"; ctx.beginPath(); ctx.arc(fx.x, fx.y, (5 + 14*c2)/K.S0 + 4, 0, Math.PI*2); ctx.fill(); }
    }
  });

  if(soundPings.length){
    var soundLife = 550;
    for(var si=soundPings.length-1; si>=0; si--){
      var sp = soundPings[si];
      var sAge = nowTs - sp.born;
      if(sAge > soundLife){ soundPings.splice(si,1); continue; }
      if(!showSound.checked) continue;
      var sa = 1 - sAge/soundLife;
      var sr = (sp.radius*0.12) + sAge*0.09; // expanding ping, well short of the actual hearing radius — just a marker
      ctx.beginPath(); ctx.arc(sp.x, sp.y, sr, 0, Math.PI*2);
      ctx.strokeStyle = sp.team==="CT" ? "rgba(180,210,255,"+(sa*0.5)+")" : "rgba(255,214,140,"+(sa*0.5)+")";
      ctx.lineWidth = 1.2/view.scale;
      ctx.stroke();
    }
  }
}

// часть draw (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 450–629 исходного draw
function drawTracers(K){
  if(tracers.length){
    // раздел 14: визуал выстрела — вспышка у ствола, пуля бежит от стрелка к
    // точке (~70мс), след гаснет; попадание — красный всплеск (в голову —
    // с белым кольцом), промах — пуля летит мимо цели дальше, до стены (искра)
    ctx.lineCap = "round";
    var TS0 = true;
    for(var ti=tracers.length-1; ti>=0; ti--){
      var tr = tracers[ti];
      // (v414, М154) пока не прошёл следующий тик, стрелок и цель нарисованы со сглаживанием (отстают до тика) — трассер от них же, а не от
      // позиции на конец тика; дальше — на месте, где стреляли
      var X1 = tr.x1, Y1 = tr.y1, X2 = tr.x2, Y2 = tr.y2;
      if(tr.tk === tick){ var kL = 1 - Math.max(0, Math.min(1, accumulator / TICK_MS)); X1 -= (tr.sdx||0)*kL; Y1 -= (tr.sdy||0)*kL; X2 -= (tr.tdx||0)*kL; Y2 -= (tr.tdy||0)*kL; }
      var TSt = (TS0 && TRACER_STYLE[tr.wc]) || TRACER_STYLE.rifle, life = TS0 ? TSt.life : 170, TRAVEL = TS0 ? TSt.travel : 70;
      var age = nowTs - tr.born;
      if(age > life){ tracers.splice(ti,1); continue; }
      if(!showTracers.checked) continue;
      var a = 1 - age/life, S = view.scale;
      var col = tr.team==="CT" ? "126,186,242" : "246,190,96";   // (v258) цвета команд насыщеннее
      if(TS0 && TSt.glow){ ctx.strokeStyle = "rgba(200,235,255,"+(a*0.18)+")"; ctx.lineWidth = TSt.glow/S; ctx.beginPath(); ctx.moveTo(X1,Y1); ctx.lineTo(X2,Y2); ctx.stroke(); }
      // (v258) след светлеет от стрелка к цели — видно, откуда стреляли
      var tGr = ctx.createLinearGradient(X1, Y1, X2, Y2);
      tGr.addColorStop(0, "rgba("+col+","+(a*(TS0 ? TSt.trailA : 0.32)*0.25)+")"); tGr.addColorStop(1, "rgba("+col+","+(a*(TS0 ? TSt.trailA : 0.32)*1.35)+")");
      ctx.strokeStyle = tGr;
      ctx.lineWidth = (TS0 ? TSt.trailW : 1)/S;
      ctx.beginPath(); ctx.moveTo(X1,Y1); ctx.lineTo(X2,Y2); ctx.stroke();
      var prog = Math.min(1, age/TRAVEL), tail = Math.max(0, prog-(TS0 ? TSt.tail : 0.3));
      if(prog < 1 || age < TRAVEL+30){
        ctx.strokeStyle = tr.team==="CT" ? "rgba(228,242,255,"+(0.95*a)+")" : "rgba(255,240,206,"+(0.95*a)+")";
        ctx.lineWidth = (TS0 ? TSt.core : 1.9)/S;
        ctx.beginPath();
        ctx.moveTo(X1+(X2-X1)*tail, Y1+(Y2-Y1)*tail);
        ctx.lineTo(X1+(X2-X1)*prog, Y1+(Y2-Y1)*prog);
        ctx.stroke();
      }
      if(age < (TS0 ? TSt.fl : 55)){
        var mf = 1 - age/(TS0 ? TSt.fl : 55);
        ctx.fillStyle = "rgba(255,210,120,"+(0.85*mf)+")";
        ctx.beginPath(); ctx.arc(X1, Y1, ((TS0 ? TSt.fr : 3) + (TS0 ? TSt.fg : 4)*mf)/S, 0, Math.PI*2); ctx.fill();
      }
      if(prog >= 1 && age < TRAVEL + 100){
        var ia = 1 - (age-TRAVEL)/100;
        if(tr.hit){
          ctx.fillStyle = "rgba(230,40,40,"+(0.75*ia)+")";
          ctx.beginPath(); ctx.arc(X2, Y2, (3 + 7*(1-ia))/S, 0, Math.PI*2); ctx.fill();
          if(tr.head){
            ctx.strokeStyle = "rgba(255,255,255,"+(0.9*ia)+")"; ctx.lineWidth = 1.6/S;
            ctx.beginPath(); ctx.arc(X2, Y2, (6 + 8*(1-ia))/S, 0, Math.PI*2); ctx.stroke();
          }
        } else {
          ctx.fillStyle = "rgba(210,210,200,"+(0.7*ia)+")";
          ctx.beginPath(); ctx.arc(X2, Y2, 2.2/S, 0, Math.PI*2); ctx.fill();
        }
      }
      if(tr.prefire){
        ctx.strokeStyle = "rgba(255,255,255,"+(a*0.45)+")";
        ctx.lineWidth = 0.9/S;
        ctx.setLineDash([4/S, 4/S]);
        ctx.beginPath(); ctx.moveTo(X1,Y1); ctx.lineTo(X2,Y2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // коллы (раздел 11): что знает каждая команда. Для каждого врага — только
  // последняя отметка; старше 4с не рисуем (память живёт дольше, но на радаре шум)
  if(showCalls && showCalls.checked && typeof CLEARZ !== "undefined"){
    ["CT","T"].forEach(function(team){
      for(var zid in CLEARZ[team]){
        var c = CLEARZ[team][zid], age = Math.round((tick-c.tick)/TICK_HZ);
        ctx.save(); ctx.fillStyle = team === "T" ? "rgba(230,160,60,0.85)" : "rgba(90,160,230,0.85)";
        ctx.font = "600 "+(8/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
        ctx.fillText("✓ пусто ("+team+") "+age+"с", c.x, c.y - 12/view.scale); ctx.restore();
      }
    });
  }
  if(showCalls && showCalls.checked && typeof beliefLast !== "undefined"){
    ["CT","T"].forEach(function(team){
      for(var id in beliefLast[team]){
        var e = beliefLast[team][id], col = team === "CT" ? "rgba(230,160,60," : "rgba(90,160,230,"; // цвет — того, кого запомнили
        ctx.save(); ctx.strokeStyle = col+"0.8)"; ctx.fillStyle = col+"0.9)"; ctx.lineWidth = 1.4/view.scale;
        ctx.setLineDash([3/view.scale, 3/view.scale]); ctx.beginPath(); ctx.arc(e.x, e.y, 9/view.scale, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = "600 "+(8/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
        ctx.fillText(pnum(id)+(lkpWord(e) === "видели" ? "" : " слыш")+" · "+Math.round((tick-e.tick)/TICK_HZ)+"с", e.x, e.y + 3/view.scale);   // (Б3, З6) звук — своей подписью
        ctx.restore();
      }
    });
  }
  if(showCalls && showCalls.checked && typeof teamIntel !== "undefined"){
    ["CT","T"].forEach(function(team){
      var col = team === "CT" ? "90,155,217" : "217,162,74";
      var lastBy = {};
      teamIntel[team].sig.forEach(function(sg){ if(tick - sg.tick < 4*TICK_HZ) lastBy[sg.type+sg.id] = sg; });
      Object.keys(lastBy).forEach(function(k){
        var sg = lastBy[k], a = Math.max(0, 1 - (tick - sg.tick)/(4*TICK_HZ)), r = 15/view.scale;
        ctx.lineWidth = 1.6/view.scale;
        if(sg.type === "spotted"){
          ctx.fillStyle = "rgba("+col+","+(0.10*a)+")"; ctx.strokeStyle = "rgba("+col+","+(0.95*a)+")"; ctx.lineWidth = 2.2/view.scale;
          ctx.beginPath(); ctx.moveTo(sg.x, sg.y-r); ctx.lineTo(sg.x+r, sg.y); ctx.lineTo(sg.x, sg.y+r); ctx.lineTo(sg.x-r, sg.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if(sg.type === "sound"){
          ctx.strokeStyle = "rgba("+col+","+(0.6*a)+")"; ctx.setLineDash([3/view.scale, 3/view.scale]);
          ctx.beginPath(); ctx.arc(sg.x, sg.y, 22/view.scale, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        } else if(sg.type === "died"){
          ctx.strokeStyle = "rgba("+col+","+(0.9*a)+")";
          ctx.beginPath(); ctx.moveTo(sg.x-r, sg.y-r); ctx.lineTo(sg.x+r, sg.y+r); ctx.moveTo(sg.x+r, sg.y-r); ctx.lineTo(sg.x-r, sg.y+r); ctx.stroke();
          if(sg.kx != null){ ctx.setLineDash([2/view.scale, 4/view.scale]); ctx.beginPath(); ctx.moveTo(sg.x, sg.y); ctx.lineTo(sg.kx, sg.ky); ctx.stroke(); ctx.setLineDash([]); }
        }
      });
    });
  }

  K.alpha = Math.max(0, Math.min(1, accumulator / TICK_MS));
  // сайты и бомба (шаг 4)
  ["A","B"].forEach(function(k){
    var st = SITES[k]; if(!st) return;
    ctx.fillStyle = "rgba(217,131,47,0.55)"; ctx.font = "700 "+(22/view.scale)+"px 'IBM Plex Sans',sans-serif";
    ctx.textAlign = "center";
    var lp = st.poly ? centroidOf(st.poly) : st;
    ctx.fillText(k, lp.x, lp.y+8/view.scale);
    if(st.poly){
      ctx.strokeStyle = "rgba(217,131,47,0.55)"; ctx.lineWidth = 1.5/view.scale; ctx.setLineDash([5/view.scale,4/view.scale]);
      ctx.beginPath(); st.poly.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    }
  });
  if(bomb && (bomb.state === "dropped" || bomb.state === "planted" || bomb.state === "defused")){
    var pulse = bomb.state === "planted" ? 0.5 + 0.5*Math.sin(tick*0.25) : 1;
    ctx.fillStyle = bomb.state === "defused" ? "#5a9bd9" : "rgba(224,92,82,"+(0.55+0.45*pulse)+")";
    var bs = 6/view.scale;
    ctx.fillRect(bomb.x-bs, bomb.y-bs*0.7, bs*2, bs*1.4);
    ctx.strokeStyle = "#0b0f0b"; ctx.lineWidth = 1/view.scale; ctx.strokeRect(bomb.x-bs, bomb.y-bs*0.7, bs*2, bs*1.4);
    if(bomb.state === "planted"){
      ctx.fillStyle = "#e05c52"; ctx.font = "600 "+(11/view.scale)+"px 'IBM Plex Mono',monospace";
      ctx.fillText(Math.max(0,(bomb.explodeTick-tick)/TICK_HZ).toFixed(1)+"с", bomb.x, bomb.y-10/view.scale);
    }
  }
  // (v437, владелец 27.10) взрыв бомбы — огненное ядро до радиуса смертельного урона (≥ 100, по BOMB_DMG) и ударная волна до
  // края урона (BOMB_DMG.reach); длительности (0,35 / 1,4 / 1,6 с) — проектные числа вида
  if(bomb && bomb.state === "exploded" && bomb.explodeTick != null){
    var ba = (tick - bomb.explodeTick)/TICK_HZ;
    if(ba >= 0 && ba < 2.2){
      var rKill = BOMB_DMG.sigma*Math.sqrt(2*Math.log(BOMB_DMG.max/100));   // урон = max·exp(−L²/2σ²) (bomb)
      var eo = function(p){ p = Math.max(0, Math.min(1, p)); return 1 - Math.pow(1 - p, 3); };
      var ca = Math.max(0, 1 - ba/1.6), rc = Math.max(1, rKill*eo(ba/0.35));
      if(ca > 0){
        var gr = ctx.createRadialGradient(bomb.x, bomb.y, 0, bomb.x, bomb.y, rc);
        gr.addColorStop(0, "rgba(255,236,190,"+(0.85*ca)+")"); gr.addColorStop(0.35, "rgba(255,150,60,"+(0.6*ca)+")");
        gr.addColorStop(1, "rgba(229,89,78,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bomb.x, bomb.y, rc, 0, Math.PI*2); ctx.fill();
      }
      [0, 0.18].forEach(function(dl, wi){
        var p = (ba - dl)/1.4; if(p <= 0 || p >= 1) return;
        ctx.strokeStyle = "rgba(255,"+(wi ? 120 : 190)+",90,"+(0.75*(1 - p))+")"; ctx.lineWidth = (wi ? 1.5 : 3.5)/view.scale;
        ctx.beginPath(); ctx.arc(bomb.x, bomb.y, BOMB_DMG.reach*eo(p), 0, Math.PI*2); ctx.stroke();
      });
    }
  }
  if(document.getElementById("chkRoam").checked){
    ["CT","T"].forEach(function(team){
      var route = ROAM_ROUTES[team]; if(!route.length) return;
      var col = team==="CT" ? "rgba(120,200,255," : "rgba(255,200,110,";
      ctx.strokeStyle = col+"0.45)"; ctx.lineWidth = 1.3/view.scale;
      ctx.setLineDash([6/view.scale, 5/view.scale]);
      ctx.beginPath();
      route.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      if(route.length > 2) ctx.closePath();
      ctx.stroke(); ctx.setLineDash([]);
      route.forEach(function(p){
        var fresh = tick - p.cleared < ROAM_RECHECK_TICKS;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5/view.scale, 0, Math.PI*2);
        ctx.fillStyle = fresh ? col+"0.95)" : "rgba(20,24,20,0.9)"; ctx.fill();
        ctx.strokeStyle = col+"0.9)"; ctx.lineWidth = 1.5/view.scale; ctx.stroke();
        ctx.fillStyle = col+"0.9)";
        ctx.font = (9.5/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "left";
        var lbl = p.name + (p.cleared > 0 ? " · чисто "+((tick-p.cleared)/TICK_HZ).toFixed(0)+"с назад" : "");
        ctx.fillText(lbl, p.x+8/view.scale, p.y+3/view.scale);
      });
    });
  }
  // (v404, владелец 22.10: «видеть пути игроков по кнопке») путь каждого живого игрока: от него по точкам пути (b.path с pathIdx)
  // до точки задачи; подъём / спуск на другой этаж (разница высоты точек > JUMP_UP) — треугольник; пройденное (b._trail) — пунктир
  K.chkP = document.getElementById("chkPaths");
}

