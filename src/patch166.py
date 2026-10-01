# v163: звук/контакт за стеной — смотреть на место, где враг выйдет, а не сквозь стену;
# не нашли открытого направления — держать прежний угол, а не смотреть в стену
rep("var BAL = {", """var BAL = {
  noWallLook: true,   // v163: на звук за стеной — на точку выхода врага по пути к боту; не нашли — не поворачиваться""")
rep("""    var pt = cornerLook(b, q) || q;
    out.push({j:"snd\"""","""    var pt = cornerLook(b, q) || (BAL.noWallLook ? appearFrom(b, q) : q);
    if(!pt) return;
    out.push({j:"snd\"""")
rep("""function cornerLook(b, p, from){""","""// (v163) где враг из точки q выйдет на линию бота: идём по его пути к боту,
// первая точка, которую бот видит (не ближе 50px). Нет такой — null
function appearFrom(b, q){
  var k = Math.round(q.x/40)+","+Math.round(q.y/40)+"|"+Math.round(b.x/16)+","+Math.round(b.y/16);
  if(b._apfK === k) return b._apfV;
  b._apfK = k; b._apfV = null;
  var wp = buildWaypointPath(q.x, q.y, 0, b.x, b.y, 0); if(!wp || !wp.length) return null;
  var prev = {x:q.x, y:q.y};
  for(var i=0;i<wp.length;i++){
    var p = {x:wp[i][0], y:wp[i][1]};
    if(hasLOS(b.x, b.y, p.x, p.y)){
      // уточняем на отрезке prev→p: первая видимая точка
      var lo = 0, hi = 1;
      for(var it=0; it<6; it++){ var m = (lo+hi)/2, mp = {x:prev.x+(p.x-prev.x)*m, y:prev.y+(p.y-prev.y)*m}; if(hasLOS(b.x, b.y, mp.x, mp.y)) hi = m; else lo = m; }
      var r = {x:prev.x+(p.x-prev.x)*hi, y:prev.y+(p.y-prev.y)*hi};
      if(Math.hypot(r.x-b.x, r.y-b.y) < 50) return null;
      b._apfV = r; return r;
    }
    prev = p;
  }
  return null;
}
function cornerLook(b, p, from){""")
rep("""      if(free(an, 220) >= 110){ b._olV = {x:b.x+Math.cos(an)*200, y:b.y+Math.sin(an)*200}; return b._olV; }
    }
  }
  return look;""","""      if(free(an, 220) >= 110){ b._olV = {x:b.x+Math.cos(an)*200, y:b.y+Math.sin(an)*200}; return b._olV; }
    }
  }
  if(BAL.noWallLook){ b._olV = null; return null; }   // открытого направления рядом нет — не поворачиваемся в стену
  return look;""")
rep("версия 162 · 01.10","версия 163 · 01.10")
# общая страховка: прицел упирается в РОВНУЮ стену ближе 80px (не в край угла) —
# ближайшее открытое направление в пределах ±90°; нет — не поворачиваться
rep("""function cornerLook(b, p, from){""","""function flatWallAhead(b, a, R){
  var dx = Math.cos(a), dy = Math.sin(a), best = null;
  for(var i=0;i<MANUAL_WALLS.length;i++){ var w = MANUAL_WALLS[i];
    if(Math.max(w[0],w[2]) < b.x-R || Math.min(w[0],w[2]) > b.x+R || Math.max(w[1],w[3]) < b.y-R || Math.min(w[1],w[3]) > b.y+R) continue;
    var sx = w[2]-w[0], sy = w[3]-w[1], den = dx*sy - dy*sx; if(Math.abs(den) < 1e-9) continue;
    var qx = w[0]-b.x, qy = w[1]-b.y, t = (qx*sy - qy*sx)/den, u = (qx*dy - qy*dx)/den;
    if(t > 0 && t < R && u >= 0 && u <= 1 && (!best || t < best.t)) best = {t:t, e:Math.min(u, 1-u)*Math.hypot(sx, sy)};
  }
  return !!(best && best.e > 18);
}
function openDirNear(b, a){
  var k = Math.round(a*20)+"|"+Math.round(b.x/10)+","+Math.round(b.y/10);
  if(b._odK === k) return b._odV;
  b._odK = k; b._odV = null;
  for(var st=1; st<=9; st++) for(var sg=-1; sg<=1; sg+=2){
    var an = a + sg*st*0.1745, c = rayClipWalls(b.x, b.y, b.x+Math.cos(an)*160, b.y+Math.sin(an)*160);
    if(Math.hypot(c.x-b.x, c.y-b.y) >= 140){ b._odV = {x:b.x+Math.cos(an)*220, y:b.y+Math.sin(an)*220}; return b._odV; }
  }
  return null;
}
function cornerLook(b, p, from){""")
rep("""    if(look && BAL.noWallStare && b.lookReason !== "enemy" && b.lookReason !== "pro") look = openLook(b, look);""","""    if(look && BAL.noWallStare && b.lookReason !== "enemy" && b.lookReason !== "pro") look = openLook(b, look);
    if(BAL.noWallLook && !b._sawEnemy && !/^(enemy|spam|cover)$/.test(b.lookReason || "")){
      var wla = look ? Math.atan2(look.y-b.y, look.x-b.x) : (!(b.curSpeed > 15*SPD_K) && b.facing !== undefined ? b.facing : null);
      if(wla !== null && flatWallAhead(b, wla, 80)){ var wal = openDirNear(b, wla); look = wal || (look ? null : null); if(wal) b.lookReason = (b.lookReason||"") + "+open"; }
    }""")
