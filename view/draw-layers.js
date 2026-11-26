// [хозяева: drawLayers] часть draw (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 630–722 исходного draw
function drawLayers(K){
  if(K.chkP && K.chkP.checked){
    var s1 = 1/view.scale;
    bots.forEach(function(b){ if(!b.alive) return;
      var col = b.team === "CT" ? "90,155,217" : "217,162,74";
      var TR = b._trail || [];
      if(TR.length){ ctx.strokeStyle = "rgba("+col+",0.35)"; ctx.lineWidth = 1.2*s1; ctx.setLineDash([2*s1, 3*s1]); ctx.beginPath();
        TR.forEach(function(q, i){ if(i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.lineTo(b.baseX, b.baseY); ctx.stroke(); ctx.setLineDash([]); }
      var P = b.path || [], i0 = b.pathIdx || 0;
      if(i0 < P.length){
        ctx.strokeStyle = "rgba("+col+",0.85)"; ctx.lineWidth = 1.6*s1; ctx.beginPath(); ctx.moveTo(b.baseX, b.baseY);
        // (v541) идёт подъём — линия по самому подъёму (через промежуточный ящик), а не напрямую к следующей точке пути
        var CL = b._climb; if(CL){ if(CL.mid && climbPhase(CL).seg === 1) ctx.lineTo(CL.mid.x, CL.mid.y); ctx.lineTo(CL.to.x, CL.to.y); }
        for(var i = i0; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
        ctx.stroke();
        var pz = b.z;
        for(var k = i0; k < P.length; k++){ var w = P[k], up = w[2] != null && pz != null && w[2] && Math.abs(w[2]-pz) > JUMP_UP;
          ctx.fillStyle = "rgba("+col+",0.95)";
          if(up){ var dn = w[2] < pz, r3 = 4.5*s1; ctx.beginPath(); ctx.moveTo(w[0], w[1] + (dn ? r3 : -r3)); ctx.lineTo(w[0]-r3, w[1] + (dn ? -r3 : r3)); ctx.lineTo(w[0]+r3, w[1] + (dn ? -r3 : r3)); ctx.closePath(); ctx.fill(); }
          else { ctx.beginPath(); ctx.arc(w[0], w[1], 1.8*s1, 0, Math.PI*2); ctx.fill(); }
          if(w[2]) pz = w[2]; }
      }
      if(b.post){ ctx.strokeStyle = "rgba("+col+",0.95)"; ctx.lineWidth = 1.5*s1; ctx.beginPath(); ctx.arc(b.post.x, b.post.y, 5*s1, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = "rgba("+col+",0.95)"; ctx.font = "600 "+(9.5*s1)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "left";
        ctx.fillText(pnum(b.id) + " · " + String(b.post.tag).replace(/[|].*$/, ""), b.post.x + 7*s1, b.post.y + 3*s1); }
    });
  }
  // (v407, владелец 22.10: «галочку, чтобы я видел, когда счётчик у этих трёх повышается») ошибки движения (PROB, problem-watch): кольцо и
  // подпись на PROB_SHOW_SEC с там, где случилось; счёт за матч — плашкой в левом верхнем углу радара
  var chkPr = document.getElementById("chkProb");
  if(chkPr && chkPr.checked && typeof PROB !== "undefined"){
    var s2 = 1/view.scale, PCOL = {stall: "255,150,40", nav: "235,70,60", tug: "190,120,255"}, PNAME = {stall: "застрял", nav: "перенос", tug: "перетягивание"};
    PROB.ev.forEach(function(e){ var age = (tick - e.tick)/TICK_HZ; if(e.round !== roundNum || age < 0 || age > PROB_SHOW_SEC) return;
      var a = 1 - age/PROB_SHOW_SEC, c = PCOL[e.kind];
      ctx.strokeStyle = "rgba("+c+","+(0.4+0.6*a)+")"; ctx.lineWidth = 2*s2; ctx.beginPath(); ctx.arc(e.x, e.y, (10 + 8*(1-a))*s2, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = "rgba("+c+","+(0.5+0.5*a)+")"; ctx.font = "600 "+(10*s2)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "left";
      ctx.fillText(pnum(e.id) + " · " + PNAME[e.kind] + (e.kind === "stall" ? "" : ": " + e.text), e.x + 13*s2, e.y - 6*s2);
      if(e.kind === "stall") ctx.fillText(e.text.replace(/^застрял /, ""), e.x + 13*s2, e.y + 6*s2); });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    var bx = 352, by = 12, line = function(k, i){ ctx.fillStyle = "rgb("+PCOL[k]+")"; ctx.fillText(PNAME[k] + ": " + PROB.n[k], bx + 10, by + 18 + i*16); };
    ctx.fillStyle = "rgba(12,15,11,0.88)"; ctx.fillRect(bx, by, 190, 62); ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, 190, 62);
    ctx.font = "600 12px 'IBM Plex Mono',monospace"; ctx.textAlign = "left"; ["stall", "nav", "tug"].forEach(line);
    ctx.restore();
  }
  // оружие на земле
  groundWeapons.forEach(function(G){
    ctx.save(); ctx.fillStyle = "rgba(210,210,200,0.85)"; ctx.strokeStyle = "rgba(20,20,20,0.8)"; ctx.lineWidth = 1/view.scale;
    var w2 = 9/view.scale, h2 = 3.5/view.scale; ctx.fillRect(G.x-w2, G.y-h2, w2*2, h2*2); ctx.strokeRect(G.x-w2, G.y-h2, w2*2, h2*2);
    ctx.font = (7/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.fillText(WEAPONS[G.key].name.split(" ")[0], G.x, G.y - 6/view.scale);
    ctx.restore();
  });
  // пистолеты, гранаты, киты на земле (v271)
  groundItems.forEach(function(G){
    ctx.save(); ctx.fillStyle = "rgba(210,210,200,0.85)"; ctx.strokeStyle = "rgba(20,20,20,0.8)"; ctx.lineWidth = 1/view.scale;
    var r = 3/view.scale;
    if(G.kind === "nade"){ ctx.beginPath(); ctx.arc(G.x, G.y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
    else if(G.kind === "kit"){ ctx.fillStyle = "rgba(90,160,230,0.9)"; ctx.fillRect(G.x-r, G.y-r, r*2, r*2); ctx.strokeRect(G.x-r, G.y-r, r*2, r*2); }
    else { ctx.fillRect(G.x-5/view.scale, G.y-r*0.8, 10/view.scale, r*1.6); ctx.strokeRect(G.x-5/view.scale, G.y-r*0.8, 10/view.scale, r*1.6); }
    ctx.font = (6.5/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(210,210,200,0.85)";
    ctx.fillText(G.kind === "kit" ? "кит" : G.kind === "nade" ? NADE[G.key].name : WEAPONS[G.key].name.split(" ")[0], G.x, G.y - 5.5/view.scale);
    ctx.restore();
  });
  // где погиб игрок — крестик цвета его стороны (до конца раунда)
  bots.forEach(function(bot){
    if(bot.alive) return;
    var cx2 = bot.x, cy2 = bot.y, rr = 6/view.scale;
    ctx.save(); ctx.strokeStyle = bot.team === "CT" ? "rgba(90,160,230,0.95)" : "rgba(230,160,60,0.95)"; ctx.lineWidth = 2.6/view.scale;
    ctx.beginPath(); ctx.moveTo(cx2-rr, cy2-rr); ctx.lineTo(cx2+rr, cy2+rr); ctx.moveTo(cx2+rr, cy2-rr); ctx.lineTo(cx2-rr, cy2+rr); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.font = "600 "+(7.5/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
    ctx.fillText(String(pnum(bot.id)), cx2, cy2 - 8/view.scale);
    // (v288) чем убит: смок / слепой / HE / молотов / бомба — те же иконки, что в киллфиде, справа от крестика
    var KH = bot._killHow;
    if(KH && KH.round === roundNum){
      var ks = []; if(KH.w) ks.push(KH.w); if(KH.smoke) ks.push("smoke"); if(KH.blind) ks.push("blind");
      var ih = 9/view.scale, ix = cx2 + rr + 2/view.scale;
      ks.forEach(function(key){ var im = kfImg(key); if(!im) return; var ic = KF_ICON[key], iw = ih*ic.w/ic.h;
        ctx.globalAlpha = 0.95; ctx.fillStyle = "rgba(14,16,12,0.72)"; ctx.fillRect(ix-1/view.scale, cy2-ih/2-1/view.scale, iw+2/view.scale, ih+2/view.scale);
        if(im.complete) ctx.drawImage(im, ix, cy2-ih/2, iw, ih); ix += iw + 3/view.scale; });
    }
    ctx.restore();
  });
  // (v321, М14) закупка: дроп — пунктир от того, кто дропнул, к тому, кому, с названием оружия; выкинутое — подпись у ног
  if(roundState === "freeze" && FREEZE_FX.length){
    var byId = {}; bots.forEach(function(o){ byId[o.id] = o; });
    ctx.font = (11/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
    FREEZE_FX.forEach(function(F){ var a = byId[F.from]; if(!a) return; var nm = WEAPONS[F.key] ? WEAPONS[F.key].name : F.key;
      if(F.kind === "drop" && byId[F.to]){ var c = byId[F.to];
        ctx.strokeStyle = "rgba(255,230,150,0.9)"; ctx.lineWidth = 1.5/view.scale; ctx.setLineDash([4/view.scale, 3/view.scale]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,230,150,0.95)"; ctx.fillText("дроп "+nm, (a.x+c.x)/2, (a.y+c.y)/2 - 6/view.scale);
      } else if(F.kind === "throw"){ ctx.fillStyle = "rgba(220,220,220,0.85)"; ctx.fillText("выкинул "+nm, a.x, a.y + 18/view.scale); }
      else if(F.kind === "sell"){ ctx.fillStyle = "rgba(150,220,140,0.9)"; ctx.fillText("продал "+nm, a.x, a.y + 18/view.scale); }   // (v334, М59)
    });
  }
}

