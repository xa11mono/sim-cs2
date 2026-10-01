# ===== v151: визуал выстрелов по оружию + плавные пики =====
rep("  callFix: true,", "  callFix: true,\n  tracerStyle: true,  // v151: трассер и вспышка зависят от оружия (пистолет, ПП, винтовка, AWP)\n  smoothPeek: true,   // v151: пик со скоростью бега, плавно, короче")
rep("var tracers = [];", """var tracers = [];
// (v151) как выглядит выстрел у разного оружия: пистолет — тонкий короткий след и
// маленькая вспышка; ПП — частые тонкие; винтовка — как было; AWP — толстый
// мгновенный луч с ореолом, большая вспышка, след висит дольше
var TRACER_STYLE = {
  pistol:{life:130, travel:55, core:1.2, trailW:0.8, trailA:0.22, tail:0.35, fr:2, fg:2.5, fl:40},
  deagle:{life:210, travel:45, core:1.9, trailW:1.1, trailA:0.3,  tail:0.3,  fr:3, fg:5,   fl:60},
  smg:   {life:110, travel:50, core:1.1, trailW:0.7, trailA:0.18, tail:0.4,  fr:2, fg:2.5, fl:35},
  rifle: {life:170, travel:70, core:1.9, trailW:1.0, trailA:0.32, tail:0.3,  fr:3, fg:4,   fl:55},
  scout: {life:300, travel:30, core:2.3, trailW:1.4, trailA:0.45, tail:0.15, fr:4, fg:6,   fl:70},
  awp:   {life:450, travel:22, core:3.0, trailW:2.0, trailA:0.55, tail:0.05, fr:6, fg:9,   fl:90, glow:7}
};
function tracerClass(w){
  if(!w) return "rifle";
  if(w.key === "AWP") return "awp";
  if(w.key === "SSG") return "scout";
  if(w.key === "DEAGLE") return "deagle";
  if(w.slot === "secondary") return "pistol";
  if(w.tier === 4) return "smg";
  return "rifle";
}""")
rep("var life = 170, TRAVEL = 70;", "var TS0 = BAL.tracerStyle;")
rep("      var tr = tracers[ti];", "      var tr = tracers[ti];\n      var TSt = (TS0 && TRACER_STYLE[tr.wc]) || TRACER_STYLE.rifle, life = TS0 ? TSt.life : 170, TRAVEL = TS0 ? TSt.travel : 70;")
rep('ctx.strokeStyle = "rgba("+col+","+(a*0.32)+")";',
    'if(TS0 && TSt.glow){ ctx.strokeStyle = "rgba(200,235,255,"+(a*0.18)+")"; ctx.lineWidth = TSt.glow/S; ctx.beginPath(); ctx.moveTo(tr.x1,tr.y1); ctx.lineTo(tr.x2,tr.y2); ctx.stroke(); }\n      ctx.strokeStyle = "rgba("+col+","+(a*(TS0 ? TSt.trailA : 0.32))+")";')
rep("      ctx.lineWidth = 1/S;\n      ctx.beginPath(); ctx.moveTo(tr.x1,tr.y1); ctx.lineTo(tr.x2,tr.y2); ctx.stroke();",
    "      ctx.lineWidth = (TS0 ? TSt.trailW : 1)/S;\n      ctx.beginPath(); ctx.moveTo(tr.x1,tr.y1); ctx.lineTo(tr.x2,tr.y2); ctx.stroke();")
rep("var prog = Math.min(1, age/TRAVEL), tail = Math.max(0, prog-0.3);", "var prog = Math.min(1, age/TRAVEL), tail = Math.max(0, prog-(TS0 ? TSt.tail : 0.3));")
rep("        ctx.lineWidth = 1.9/S;", "        ctx.lineWidth = (TS0 ? TSt.core : 1.9)/S;")
rep("      if(age < 55){", "      if(age < (TS0 ? TSt.fl : 55)){")
rep("var mf = 1 - age/55;", "var mf = 1 - age/(TS0 ? TSt.fl : 55);")
rep("ctx.beginPath(); ctx.arc(tr.x1, tr.y1, (3 + 4*mf)/S, 0, Math.PI*2); ctx.fill();",
    "ctx.beginPath(); ctx.arc(tr.x1, tr.y1, ((TS0 ? TSt.fr : 3) + (TS0 ? TSt.fg : 4)*mf)/S, 0, Math.PI*2); ctx.fill();")
rep("  tracers.push({x1:shooter.x, y1:shooter.y, x2:endX, y2:endY, team:shooter.team, born:nowTs,",
    "  tracers.push({wc:tracerClass(shooter.weapon), x1:shooter.x, y1:shooter.y, x2:endX, y2:endY, team:shooter.team, born:nowTs,")
rep("  tracers.push({x1:b.x, y1:b.y, x2:cl.x, y2:cl.y, team:b.team, born:nowTs, hit:false, miss:true});",
    "  tracers.push({wc:tracerClass(b.weapon), x1:b.x, y1:b.y, x2:cl.x, y2:cl.y, team:b.team, born:nowTs, hit:false, miss:true});")
# ---- плавные пики: со скоростью бега, короче, с разгоном/торможением ----
rep("""      if(bot.peekType === "wide"){
        var r1=8, h1=24;
        if(dt2<r1) amp = 60*(dt2/r1);
        else if(dt2<r1+h1) amp = 60;
        else if(dt2<r1*2+h1) amp = 60*(1-(dt2-r1-h1)/r1);
        else stillActive = false;
      } else if(bot.peekType === "shoulder"){
        var r2=4, h2=10;
        if(dt2<r2) amp = 32*(dt2/r2);
        else if(dt2<r2+h2) amp = 32;
        else if(dt2<r2*2+h2) amp = 32*(1-(dt2-r2-h2)/r2);
        else stillActive = false;
      } else if(bot.peekType === "jiggle"){
        amp = 22*Math.sin(dt2*0.35);
      }""","""      // (v151) раньше широкий пик сдвигал на 60px за 0.12с — в ~5 раз быстрее бега.
      // Теперь пик идёт со скоростью бега этим оружием, плавно (разгон/торможение)
      var pkS = BAL.smoothPeek ? SPEED*weaponSpeedMul(bot)/TICK_HZ : 0;
      var ease = function(u){ u = Math.max(0, Math.min(1, u)); return u*u*(3-2*u); };
      if(bot.peekType === "wide"){
        var A1 = BAL.smoothPeek ? 42 : 60, r1 = BAL.smoothPeek ? Math.round(A1/pkS*1.3) : 8, h1 = 24;
        if(dt2<r1) amp = A1*(BAL.smoothPeek ? ease(dt2/r1) : dt2/r1);
        else if(dt2<r1+h1) amp = A1;
        else if(dt2<r1*2+h1) amp = A1*(BAL.smoothPeek ? 1-ease((dt2-r1-h1)/r1) : 1-(dt2-r1-h1)/r1);
        else stillActive = false;
      } else if(bot.peekType === "shoulder"){
        var A2 = BAL.smoothPeek ? 16 : 32, r2 = BAL.smoothPeek ? Math.round(A2/pkS*1.2) : 4, h2 = BAL.smoothPeek ? 6 : 10;
        if(dt2<r2) amp = A2*(BAL.smoothPeek ? ease(dt2/r2) : dt2/r2);
        else if(dt2<r2+h2) amp = A2;
        else if(dt2<r2*2+h2) amp = A2*(BAL.smoothPeek ? 1-ease((dt2-r2-h2)/r2) : 1-(dt2-r2-h2)/r2);
        else stillActive = false;
      } else if(bot.peekType === "jiggle"){
        amp = BAL.smoothPeek ? 12*Math.sin(dt2*0.2) : 22*Math.sin(dt2*0.35);
      }""")
rep("""        var holdEnd = bot.peekType === "wide" ? 8+24-1 : (bot.peekType === "shoulder" ? 4+10-1 : -1);""",
    """        var pkS0 = SPEED*weaponSpeedMul(bot)/TICK_HZ;
        var holdEnd = BAL.smoothPeek ? (bot.peekType === "wide" ? Math.round(42/pkS0*1.3)+24-1 : (bot.peekType === "shoulder" ? Math.round(16/pkS0*1.2)+6-1 : -1))
                                     : (bot.peekType === "wide" ? 8+24-1 : (bot.peekType === "shoulder" ? 4+10-1 : -1));""")
rep("""        var pa0 = b._peekDir + Math.PI/2, amp0 = b.peekType === "wide" ? 60 : 30, sideBest = 0;""",
    """        var pa0 = b._peekDir + Math.PI/2, amp0 = b.peekType === "wide" ? (BAL.smoothPeek ? 42 : 60) : (BAL.smoothPeek ? 16 : 30), sideBest = 0;""")
