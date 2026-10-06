function draw(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = "#060806"; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.save();
  ctx.setTransform(view.scale,0,0,view.scale,view.panX,view.panY);
  if(imgReady) ctx.drawImage(img,0,0,2048,2048);
  else if(imgFailed){
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "#e05c52"; ctx.font = "13px monospace";
    ctx.fillText("не удалось загрузить ancient-radar.png (фон)", 12, 20);
    ctx.restore();
  }

  if(showNavmesh.checked){
    // official navmesh areas (1970) — this is the real pathing geometry
    ctx.lineWidth = 1/view.scale;
    ctx.strokeStyle = "rgba(90,155,217,0.35)";
    NAVAREAS.forEach(function(z){
      ctx.beginPath();
      z.points.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.closePath();
      if(NAV_BLOCKED[z.id]){ ctx.fillStyle = "rgba(224,92,82,0.28)"; ctx.fill(); } // внутри стены — выкинут из графа
      ctx.stroke();
    });
  }
  if(showZones.checked || chkZoneAlign.checked){
    // hand-drawn named zones from Zone Editor (ZONEMAP.zones) — semantic layer
    // ("Asite", "Bsite", "CTspawn"...) on top of the navmesh, not pathing geometry
    ctx.lineWidth = 1.4/view.scale;
    ctx.strokeStyle = "rgba(148,180,73,0.55)";
    ctx.fillStyle = "rgba(148,180,73,0.06)";
    ZONEMAP.zones.forEach(function(z){
      ctx.beginPath();
      z.points.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      var zun = zoneUserName(z.id);
      if(z.id === zoneNameSel){ ctx.save(); ctx.fillStyle = "rgba(255,215,106,0.22)"; ctx.strokeStyle = "rgba(255,215,106,0.9)"; ctx.lineWidth = 2.5/view.scale; ctx.fill(); ctx.stroke(); ctx.restore(); }
      var cx=0,cy=0; z.points.forEach(function(p){cx+=p.x;cy+=p.y;}); cx/=z.points.length; cy/=z.points.length;
      ctx.fillStyle = zun ? "rgba(232,236,221,0.85)" : "rgba(232,236,221,0.35)";
      ctx.font = (zun ? 12 : 9)/view.scale+"px 'IBM Plex Mono',monospace";
      ctx.textAlign = "center";
      ctx.fillText(zun || z.id, cx, cy);
      ctx.fillStyle = "rgba(148,180,73,0.06)";
    });
  }
  drawLineups();
  if(showZones.checked) drawZoneShapeHandles();
  if(USER_ZONES.length || zoneDrawing){
    // user-drawn spawn/site zones (see zone editor above) — always shown
    // when any exist, or while actively drawing one, regardless of the
    // "зоны" toggle (that one's for the old ZONEMAP layer specifically)
    ctx.lineWidth = 2/view.scale;
    USER_ZONES.forEach(function(z, zi){
      var pts = zoneObjAbsPoints(z);
      var col = ZONE_KIND_COLORS[z.kind] || ZONE_KIND_COLORS.custom;
      ctx.strokeStyle = col;
      ctx.fillStyle = col.replace("0.9)", "0.12)");
      ctx.beginPath();
      pts.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      var c = zoneObjCentroid(z);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = (12/view.scale)+"px 'IBM Plex Mono',monospace";
      ctx.textAlign = "center";
      ctx.fillText(z.name || ZONE_KIND_LABELS[z.kind], c.x, c.y);
      if(chkZoneEdit.checked && selectedZoneId === zi){
        if(chkZoneVertexEdit.checked){
          var vr = 5.5/view.scale;
          pts.forEach(function(p,vi2){
            var isDrag = zoneVertexDragging && zoneVertexIdx===vi2;
            ctx.beginPath(); ctx.arc(p.x,p.y,vr,0,Math.PI*2);
            ctx.fillStyle = isDrag ? "#ffffff" : col;
            ctx.fill(); ctx.strokeStyle="rgba(20,20,10,0.9)"; ctx.lineWidth=1.2/view.scale; ctx.stroke();
          });
        } else {
          var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
          pts.forEach(function(p){ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
          ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5/view.scale;
          ctx.setLineDash([5/view.scale,4/view.scale]);
          ctx.strokeRect(minX,minY,maxX-minX,maxY-minY);
          ctx.setLineDash([]);
          var hs = 7/view.scale;
          ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(maxX-hs,maxY-hs,hs*2,hs*2);
          ctx.strokeStyle = "rgba(20,20,10,0.9)"; ctx.lineWidth=1/view.scale; ctx.strokeRect(maxX-hs,maxY-hs,hs*2,hs*2);
        }
      }
    });
    if(zoneDrawing && zoneDrawPts.length){
      ctx.strokeStyle = ZONE_KIND_COLORS[zoneKindSelect.value] || "#fff";
      ctx.lineWidth = 2/view.scale;
      ctx.setLineDash([4/view.scale,3/view.scale]);
      ctx.beginPath();
      zoneDrawPts.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      if(zoneDrawCur) ctx.lineTo(zoneDrawCur.x, zoneDrawCur.y);
      ctx.stroke();
      ctx.setLineDash([]);
      zoneDrawPts.forEach(function(p){
        ctx.beginPath(); ctx.arc(p.x,p.y,4/view.scale,0,Math.PI*2);
        ctx.fillStyle = "#fff"; ctx.fill();
      });
    }
  }
  if(showPoints.checked || chkZoneAlign.checked){
    // tactical points from Zone Editor (ZONEMAP.points) — named callout spots,
    // used as patrol targets (POINT_POOL) and the vocabulary for future
    // callouts/memory (plan §3/§11), not pathing nodes
    ZONEMAP.points.forEach(function(p){
      ctx.beginPath(); ctx.arc(p.x, p.y, 6/view.scale, 0, Math.PI*2);
      ctx.fillStyle = "rgba(90,155,217,0.85)"; ctx.fill();
      ctx.lineWidth = 1.5/view.scale; ctx.strokeStyle = "#0b0f0b"; ctx.stroke();
      ctx.fillStyle = "rgba(232,236,221,0.85)";
      ctx.font = (10.5/view.scale)+"px 'IBM Plex Mono',monospace";
      ctx.textAlign = "left";
      ctx.fillText(p.name, p.x+9/view.scale, p.y-9/view.scale);
    });
  }
  if(showDanger.checked && hoverZoneId){
    // предрасчитанная таблица опасности (план §2): зоны, откуда простреливается
    // наведённая — красным; сама наведённая зона — жёлтым контуром
    var dangerIds = ZONE_DANGER[hoverZoneId] || [];
    dangerIds.forEach(function(id){
      var z = ZONEMAP.zones.find(function(zz){ return zz.id===id; });
      if(!z) return;
      // насыщенность = доля видящих пар точек (виден край зоны или почти вся)
      var wg = (ZONE_DANGER_W[hoverZoneId]||{})[id] || 0;
      ctx.beginPath();
      z.points.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.closePath();
      ctx.fillStyle = "rgba(224,92,82,"+(0.12 + 0.45*Math.sqrt(wg))+")";
      ctx.fill();
      ctx.strokeStyle = "rgba(224,92,82,0.85)";
      ctx.lineWidth = 1.5/view.scale;
      ctx.stroke();
      var ln = (ZONE_DANGER_LINE[hoverZoneId]||{})[id];
      if(ln){
        ctx.strokeStyle = "rgba(80,230,220,0.85)"; ctx.lineWidth = 1.4/view.scale;
        ctx.beginPath(); ctx.moveTo(ln[0].x, ln[0].y); ctx.lineTo(ln[1].x, ln[1].y); ctx.stroke();
      }
    });
    (ZONE_SAMPLES[hoverZoneId]||[]).forEach(function(p){
      ctx.fillStyle = "rgba(232,220,90,0.9)"; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5/view.scale, 0, Math.PI*2); ctx.fill();
    });
    var hz = ZONEMAP.zones.find(function(zz){ return zz.id===hoverZoneId; });
    if(hz){
      ctx.beginPath();
      hz.points.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.closePath();
      ctx.fillStyle = "rgba(232,220,90,0.28)";
      ctx.fill();
      ctx.strokeStyle = "rgba(232,220,90,0.95)";
      ctx.lineWidth = 2.2/view.scale;
      ctx.stroke();
      var cx=0,cy=0; hz.points.forEach(function(p){cx+=p.x;cy+=p.y;}); cx/=hz.points.length; cy/=hz.points.length;
      ctx.fillStyle = "#fff";
      ctx.font = (12/view.scale)+"px 'IBM Plex Mono',monospace";
      ctx.textAlign = "center";
      ctx.fillText((hz.name||hz.id)+": простреливается с "+dangerIds.length, cx, cy - 16/view.scale);
    }
  }
  if(!(showWalls.checked || chkWallEdit.checked) && document.getElementById("chkOutline") && document.getElementById("chkOutline").checked){
    var BX = wallBoxes();
    ctx.fillStyle = "rgba(150,152,146,0.55)";
    BX.forEach(function(poly){ ctx.beginPath(); poly.forEach(function(p, i){ if(i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); });
    ctx.strokeStyle = "rgba(236,234,222,0.55)"; ctx.lineWidth = 1.3/view.scale; ctx.lineCap = "round";
    ctx.beginPath();
    MANUAL_WALLS.forEach(function(s){ ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); });
    ctx.stroke(); ctx.lineCap = "butt";
  }
  if(showWalls.checked || chkWallEdit.checked){
    // MANUAL_WALLS — each segment is exactly what the user drew, so unlike
    // the old auto-derived set this needs no cosmetic extension/inset at all.
    ctx.strokeStyle = "rgba(193,88,79,0.85)"; ctx.lineWidth = 2/view.scale;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    MANUAL_WALLS.forEach(function(s){
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
    });
    ctx.stroke();
    ctx.lineCap = "butt"; ctx.lineJoin = "miter";
  }
  if(chkWallEdit.checked){
    // live preview of the wall currently being dragged out
    if(wallDrawing && wallDrawStart && wallDrawCur){
      ctx.strokeStyle = "rgba(232,220,90,0.9)"; ctx.lineWidth = 2/view.scale;
      ctx.setLineDash([6/view.scale, 4/view.scale]);
      ctx.beginPath();
      ctx.moveTo(wallDrawStart.x, wallDrawStart.y);
      ctx.lineTo(wallDrawCur.x, wallDrawCur.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // selected object: dashed bounding box + a square scale handle at its
    // corner, Photoshop-style — drag the box body to move, the handle to scale.
    // In vertex/pen mode this is replaced entirely by per-point handles below —
    // the two modes edit the object in fundamentally different ways (whole
    // object vs. one point), so showing both at once would be misleading.
    if(selectedObjId !== null && WALL_OBJECTS[selectedObjId] && !chkVertexEdit.checked){
      var selPts = objectAbsPoints(WALL_OBJECTS[selectedObjId]);
      var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      selPts.forEach(function(p){ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
      ctx.strokeStyle = "rgba(232,220,90,0.95)"; ctx.lineWidth = 1.5/view.scale;
      ctx.setLineDash([5/view.scale, 4/view.scale]);
      ctx.strokeRect(minX, minY, maxX-minX, maxY-minY);
      ctx.setLineDash([]);
      var hs = 7/view.scale; // handle half-size, in world units so it stays a constant screen size
      ctx.fillStyle = "rgba(232,220,90,0.95)";
      ctx.fillRect(maxX-hs, maxY-hs, hs*2, hs*2);
      ctx.strokeStyle = "rgba(20,20,10,0.9)"; ctx.lineWidth = 1/view.scale;
      ctx.strokeRect(maxX-hs, maxY-hs, hs*2, hs*2);
    }
    // pen/vertex mode: every point of the selected object gets its own
    // draggable handle — click+drag a dot to reshape just that corner,
    // Shift+click a dot to delete it, click a highlighted edge midpoint-ish
    // spot to insert a new point there (see mousedown handler)
    if(selectedObjId !== null && WALL_OBJECTS[selectedObjId] && chkVertexEdit.checked){
      var vPts = objectAbsPoints(WALL_OBJECTS[selectedObjId]);
      var vr = 5.5/view.scale;
      vPts.forEach(function(p, vi){
        var isDrag = vertexDragging && vertexDragObjId===selectedObjId && vertexDragIdx===vi;
        ctx.beginPath(); ctx.arc(p.x, p.y, vr, 0, Math.PI*2);
        ctx.fillStyle = isDrag ? "#ffffff" : "rgba(232,220,90,0.95)";
        ctx.fill();
        ctx.strokeStyle = "rgba(20,20,10,0.9)"; ctx.lineWidth = 1.2/view.scale;
        ctx.stroke();
      });
    }
  }
  if(chkNavWarp.checked){
    // real navmesh perimeter (edges with no neighbor on the other side —
    // by the game's own construction this is what should sit flush against
    // a wall) drawn bright and thick, on top of the normal thin blue mesh —
    // this is what to compare against the red wall outline when deciding
    // where to click an anchor, instead of guessing among interior lines
    ctx.lineWidth = 2.4/view.scale;
    ctx.strokeStyle = "rgba(255,225,60,0.9)";
    NAV_BOUNDARY_SEGS_RAW.forEach(function(s){
      var p1 = navMapPoint(s.x1,s.y1), p2 = navMapPoint(s.x2,s.y2);
      ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
    });
    // confirmed anchors: source point (where the raw navmesh vertex CURRENTLY
    // maps to) → target point (where it was dragged to), connected by a line
    // so it's obvious how far/which direction each anchor is pulling
    ctx.lineWidth = 1.4/view.scale;
    navAnchors.forEach(function(a){
      var cur = navMapPoint(a.sx, a.sy);
      ctx.strokeStyle = "rgba(232,120,90,0.7)";
      ctx.setLineDash([4/view.scale,3/view.scale]);
      ctx.beginPath(); ctx.moveTo(cur.x,cur.y); ctx.lineTo(a.tx,a.ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cur.x,cur.y,5/view.scale,0,Math.PI*2);
      ctx.fillStyle = "rgba(90,155,217,0.9)"; ctx.fill();
      ctx.strokeStyle = "rgba(20,20,10,0.9)"; ctx.stroke();
      ctx.beginPath(); ctx.arc(a.tx,a.ty,5/view.scale,0,Math.PI*2);
      ctx.fillStyle = "rgba(232,120,90,0.95)"; ctx.fill();
      ctx.strokeStyle = "rgba(20,20,10,0.9)"; ctx.stroke();
    });
    if(navWarpPending){
      var pcur = navMapPoint(navWarpPending.x, navWarpPending.y);
      ctx.beginPath(); ctx.arc(pcur.x,pcur.y,7/view.scale,0,Math.PI*2);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2/view.scale; ctx.stroke();
    }
  }
  if(showPortals.checked){
    ctx.strokeStyle = "rgba(148,180,73,0.5)"; ctx.lineWidth = 1.2/view.scale;
    var drawn = {};
    Object.keys(zoneGraph).forEach(function(zid){
      var za = zonesById[zid]; if(!za) return;
      var ca = zoneCentroid(za);
      zoneGraph[zid].forEach(function(edge){
        var key = [zid,edge.to].sort().join("|");
        if(drawn[key]) return; drawn[key]=true;
        ctx.beginPath(); ctx.moveTo(ca.x,ca.y); ctx.lineTo(edge.mid.x,edge.mid.y); ctx.stroke();
        var zb = zonesById[edge.to]; if(!zb) return;
        var cb = zoneCentroid(zb);
        ctx.beginPath(); ctx.moveTo(edge.mid.x,edge.mid.y); ctx.lineTo(cb.x,cb.y); ctx.stroke();
        ctx.fillStyle = "rgba(148,180,73,0.8)";
        ctx.beginPath(); ctx.arc(edge.mid.x, edge.mid.y, 3/view.scale, 0, Math.PI*2); ctx.fill();
      });
    });
  }

  if(chkPtEd.checked) drawPoints();

  var contacts = 0;
  // контакты для HUD — считаем всегда, независимо от отрисовки
  bots.forEach(function(ct){
    if(ct.team!=="CT"||!ct.alive) return;
    bots.forEach(function(t){ if(t.team==="T" && t.alive && hasVision(ct.x,ct.y,t.x,t.y)) contacts++; });
  });

  // ---------- анимация ожидания (только визуал, на симуляцию не влияет) ----------
  // Стоящий на посту / держащий угол / ждущий выхода бот не замирает
  // статуей: взгляд плавно "поводит" по углу, вокруг — едва заметное дыхание.
  bots.forEach(function(b){
    if(!b.alive){ b._visFacing = b.facing; return; }
    var ph = (b.id.charCodeAt(0)*13 + b.id.charCodeAt(b.id.length-1)*7) % 100;
    b._idle = b.curSpeed < 6 && (b.atPost || b.holding || b.roamChecking || b.planting || b.defusing);
    var sway = 0;
    if(b._idle && !b._sawEnemy && !b.planting && !b.defusing){
      sway = 0;
    }
    b._visFacing = b.facing === undefined ? undefined : b.facing + sway;
    b._idlePhase = ph;
  });

  // ---------- конусы обзора (вместо линий) ----------
  // Конус — реальное поле зрения бота (FOV_DEG), обрезанное стенами и дымом:
  // лучи от бота до первой стены/облака. Ярче — если прямо сейчас видит врага.
  if(showLos.checked){
    var RAYS = 34, halfF = FOV_DEG*Math.PI/360;
    bots.forEach(function(b){
      if(!b.alive || b._visFacing === undefined) return;
      var bx = b.x, by = b.y, R = CONE_R;
      // только стены рядом (ускорение: не проверять все ~800 сегментов на каждый луч)
      var near = [];
      for(var wi=0; wi<MANUAL_WALLS.length; wi++){
        var w = MANUAL_WALLS[wi];
        if(Math.max(w[0],w[2]) < bx-R || Math.min(w[0],w[2]) > bx+R || Math.max(w[1],w[3]) < by-R || Math.min(w[1],w[3]) > by+R) continue;
        near.push(w);
      }
      var pts = [];
      for(var ri=0; ri<=RAYS; ri++){
        var a = b._visFacing - halfF + (2*halfF)*ri/RAYS;
        var dx = Math.cos(a), dy = Math.sin(a), tMin = R;
        for(var k=0;k<near.length;k++){
          var w2 = near[k];
          var sx = w2[2]-w2[0], sy = w2[3]-w2[1];
          var den = dx*sy - dy*sx; if(Math.abs(den) < 1e-9) continue;
          var qx = w2[0]-bx, qy = w2[1]-by;
          var t = (qx*sy - qy*sx)/den, u = (qx*dy - qy*dx)/den;
          if(t > 0 && t < tMin && u >= 0 && u <= 1) tMin = t;
        }
        for(var si2=0; si2<smokes.length; si2++){
          var sm = smokes[si2], rr = smokeRadiusNow(sm); if(rr < 8) continue;
          var ox = sm.x-bx, oy = sm.y-by, pr = ox*dx + oy*dy; if(pr < 0) continue;
          var d2 = ox*ox + oy*oy - pr*pr; if(d2 > rr*rr) continue;
          var th = pr - Math.sqrt(rr*rr - d2); if(th > 0 && th < tMin) tMin = th;
        }
        pts.push([bx + dx*tMin, by + dy*tMin]);
      }
      var hot = b._sawEnemy, blind = tick < b.blindUntil;
      var base = b.team === "CT" ? "90,155,217" : "217,162,74";
      if(hot) base = "236,214,96";
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, R);
      var a0 = blind ? 0.05 : (hot ? 0.34 : 0.22);
      g.addColorStop(0, "rgba("+base+","+a0+")");
      g.addColorStop(0.55, "rgba("+base+","+(a0*0.55)+")");
      g.addColorStop(1, "rgba("+base+",0)");
      ctx.beginPath(); ctx.moveTo(bx, by);
      pts.forEach(function(p){ ctx.lineTo(p[0], p[1]); });
      ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      // края конуса — тонкие линии, чтобы читалось направление
      ctx.strokeStyle = "rgba("+base+","+(hot?0.45:0.22)+")"; ctx.lineWidth = 1/view.scale;
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(pts[0][0],pts[0][1]); ctx.moveTo(bx,by); ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]); ctx.stroke();
    });
  }

  // ---------- гранаты ----------
  smokes.forEach(function(sm){
    var rr = smokeRadiusNow(sm); if(rr < 2) return;
    for(var q=0;q<5;q++){
      var qa = q*1.256 + tick*0.004, qr = rr*0.35;
      var cx = sm.x + Math.cos(qa)*qr*0.6, cy = sm.y + Math.sin(qa)*qr*0.6;
      var sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr*0.85);
      sg.addColorStop(0, "rgba(200,204,196,0.55)"); sg.addColorStop(1, "rgba(160,166,158,0)");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, rr*0.85, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = "rgba(188,192,184,0.5)"; ctx.beginPath(); ctx.arc(sm.x, sm.y, rr*0.8, 0, Math.PI*2); ctx.fill();
  });
  fires.forEach(function(fr){
    var left = fr.until - tick, fade = Math.min(1, left/40);
    var fl = 0.85 + 0.15*Math.sin(tick*0.9 + fr.x);
    var fg = ctx.createRadialGradient(fr.x, fr.y, 0, fr.x, fr.y, NADE.molly.radius);
    fg.addColorStop(0, "rgba(255,196,80,"+(0.75*fade*fl)+")");
    fg.addColorStop(0.6, "rgba(232,96,40,"+(0.55*fade*fl)+")");
    fg.addColorStop(1, "rgba(180,40,20,0)");
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fr.x, fr.y, NADE.molly.radius, 0, Math.PI*2); ctx.fill();
    for(var e=0;e<7;e++){ // языки пламени
      var ea = e*0.9 + tick*0.07, er = NADE.molly.radius*(0.3 + 0.5*((e*37+tick) % 20)/20);
      ctx.fillStyle = "rgba(255,220,120,"+(0.5*fade)+")";
      ctx.beginPath(); ctx.arc(fr.x + Math.cos(ea)*er, fr.y + Math.sin(ea)*er, 3.5/view.scale, 0, Math.PI*2); ctx.fill();
    }
  });
  nadesInAir.forEach(function(n){
    var col = n.type==="smoke" ? "#c8ccc4" : (n.type==="flash" ? "#ffffff" : (n.type==="he" ? "#e05c52" : "#ff9a3c"));
    if(n.lob){
      // навес: тень на земле + граната "выше" (крупнее) в середине дуги
      var fk2 = Math.min(1, (tick - n.born)/n.flight), hgt = Math.sin(Math.PI*fk2);
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.arc(n.x, n.y, 2.5/view.scale, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = 1/view.scale; ctx.setLineDash([3/view.scale,3/view.scale]);
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.tx, n.ty); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(n.x, n.y - hgt*22/view.scale, (3 + 2.5*hgt)/view.scale, 0, Math.PI*2); ctx.fill();
      return;
    }
    ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.2/view.scale;
    ctx.beginPath(); n.trail.forEach(function(p,i){ if(i===0) ctx.moveTo(p[0],p[1]); else ctx.lineTo(p[0],p[1]); }); ctx.lineTo(n.x,n.y); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(n.x, n.y, 3/view.scale, 0, Math.PI*2); ctx.fill();
  });
  nadeFx.forEach(function(fx){
    var age = tick - fx.born, k = age/40;
    if(fx.type === "flash"){
      ctx.fillStyle = "rgba(255,255,255,"+(0.8*(1-k))+")";
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 20 + 160*k, 0, Math.PI*2); ctx.fill();
    } else if(fx.type === "he"){
      ctx.strokeStyle = "rgba(255,150,70,"+(1-k)+")"; ctx.lineWidth = 3/view.scale;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, NADE.he.radius*Math.min(1, k*2), 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = "rgba(255,190,90,"+(0.5*(1-k))+")"; ctx.beginPath(); ctx.arc(fx.x, fx.y, 30*(1-k)+8, 0, Math.PI*2); ctx.fill();
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
  if(tracers.length){
    // раздел 14: визуал выстрела — вспышка у ствола, пуля бежит от стрелка к
    // точке (~70мс), след гаснет; попадание — красный всплеск (в голову —
    // с белым кольцом), промах — пуля летит мимо цели дальше, до стены (искра)
    ctx.lineCap = "round";
    var TS0 = BAL.tracerStyle;
    for(var ti=tracers.length-1; ti>=0; ti--){
      var tr = tracers[ti];
      var TSt = (TS0 && TRACER_STYLE[tr.wc]) || TRACER_STYLE.rifle, life = TS0 ? TSt.life : 170, TRAVEL = TS0 ? TSt.travel : 70;
      var age = nowTs - tr.born;
      if(age > life){ tracers.splice(ti,1); continue; }
      if(!showTracers.checked) continue;
      var a = 1 - age/life, S = view.scale;
      var col = tr.team==="CT" ? "180,210,255" : "255,214,140";
      if(TS0 && TSt.glow){ ctx.strokeStyle = "rgba(200,235,255,"+(a*0.18)+")"; ctx.lineWidth = TSt.glow/S; ctx.beginPath(); ctx.moveTo(tr.x1,tr.y1); ctx.lineTo(tr.x2,tr.y2); ctx.stroke(); }
      ctx.strokeStyle = "rgba("+col+","+(a*(TS0 ? TSt.trailA : 0.32))+")";
      ctx.lineWidth = (TS0 ? TSt.trailW : 1)/S;
      ctx.beginPath(); ctx.moveTo(tr.x1,tr.y1); ctx.lineTo(tr.x2,tr.y2); ctx.stroke();
      var prog = Math.min(1, age/TRAVEL), tail = Math.max(0, prog-(TS0 ? TSt.tail : 0.3));
      if(prog < 1 || age < TRAVEL+30){
        ctx.strokeStyle = "rgba(255,246,210,"+(0.95*a)+")";
        ctx.lineWidth = (TS0 ? TSt.core : 1.9)/S;
        ctx.beginPath();
        ctx.moveTo(tr.x1+(tr.x2-tr.x1)*tail, tr.y1+(tr.y2-tr.y1)*tail);
        ctx.lineTo(tr.x1+(tr.x2-tr.x1)*prog, tr.y1+(tr.y2-tr.y1)*prog);
        ctx.stroke();
      }
      if(age < (TS0 ? TSt.fl : 55)){
        var mf = 1 - age/(TS0 ? TSt.fl : 55);
        ctx.fillStyle = "rgba(255,210,120,"+(0.85*mf)+")";
        ctx.beginPath(); ctx.arc(tr.x1, tr.y1, ((TS0 ? TSt.fr : 3) + (TS0 ? TSt.fg : 4)*mf)/S, 0, Math.PI*2); ctx.fill();
      }
      if(prog >= 1 && age < TRAVEL + 100){
        var ia = 1 - (age-TRAVEL)/100;
        if(tr.hit){
          ctx.fillStyle = "rgba(230,40,40,"+(0.75*ia)+")";
          ctx.beginPath(); ctx.arc(tr.x2, tr.y2, (3 + 7*(1-ia))/S, 0, Math.PI*2); ctx.fill();
          if(tr.head){
            ctx.strokeStyle = "rgba(255,255,255,"+(0.9*ia)+")"; ctx.lineWidth = 1.6/S;
            ctx.beginPath(); ctx.arc(tr.x2, tr.y2, (6 + 8*(1-ia))/S, 0, Math.PI*2); ctx.stroke();
          }
        } else {
          ctx.fillStyle = "rgba(210,210,200,"+(0.7*ia)+")";
          ctx.beginPath(); ctx.arc(tr.x2, tr.y2, 2.2/S, 0, Math.PI*2); ctx.fill();
        }
      }
      if(tr.prefire){
        ctx.strokeStyle = "rgba(255,255,255,"+(a*0.45)+")";
        ctx.lineWidth = 0.9/S;
        ctx.setLineDash([4/S, 4/S]);
        ctx.beginPath(); ctx.moveTo(tr.x1,tr.y1); ctx.lineTo(tr.x2,tr.y2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // коллы (раздел 11): что знает каждая команда. Для каждого врага — только
  // последняя отметка; старше 4с не рисуем (память живёт дольше, но на радаре шум)
  // «проверили — пусто»: места последних наблюдений, где свои посмотрели и врага нет
  if(showCalls && showCalls.checked){
    ["CT","T"].forEach(function(team){
      var L = beliefLast[team] || {};
      for(var id in L){
        var c = L[id]; if(!c.gone || tick - c.gone > 15*TICK_HZ) continue;
        var age = Math.round((tick-c.gone)/TICK_HZ);
        ctx.save(); ctx.fillStyle = team === "T" ? "rgba(230,160,60,0.85)" : "rgba(90,160,230,0.85)";
        ctx.font = "600 "+(8/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
        ctx.fillText("✓ пусто ("+team+") "+age+"с", c.x, c.y - 12/view.scale); ctx.restore();
      }
    });
  }
  if(showCalls && showCalls.checked){
    ["CT","T"].forEach(function(team){
      for(var id in picKnown(team)){
        var e = picKnown(team)[id], col = team === "CT" ? "rgba(230,160,60," : "rgba(90,160,230,"; // цвет — того, кого запомнили
        ctx.save(); ctx.strokeStyle = col+"0.8)"; ctx.fillStyle = col+"0.9)"; ctx.lineWidth = 1.4/view.scale;
        ctx.setLineDash([3/view.scale, 3/view.scale]); ctx.beginPath(); ctx.arc(e.x, e.y, 9/view.scale, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = "600 "+(8/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
        ctx.fillText(pnum(id)+" · "+Math.round((tick-e.tick)/TICK_HZ)+"с", e.x, e.y + 3/view.scale);
        ctx.restore();
      }
    });
  }
  if(showCalls && showCalls.checked && typeof teamIntel !== "undefined"){
    ["CT","T"].forEach(function(team){
      var col = team === "CT" ? "90,155,217" : "217,162,74";
      var lastBy = {};
      picEvents(team).forEach(function(sg){ if(tick - sg.tick < 4*TICK_HZ) lastBy[sg.type+sg.id] = sg; });
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

  var alpha = Math.max(0, Math.min(1, accumulator / TICK_MS));
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
  // оружие на земле
  groundWeapons.forEach(function(G){
    ctx.save(); ctx.fillStyle = "rgba(210,210,200,0.85)"; ctx.strokeStyle = "rgba(20,20,20,0.8)"; ctx.lineWidth = 1/view.scale;
    var w2 = 9/view.scale, h2 = 3.5/view.scale; ctx.fillRect(G.x-w2, G.y-h2, w2*2, h2*2); ctx.strokeRect(G.x-w2, G.y-h2, w2*2, h2*2);
    ctx.font = (7/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center"; ctx.fillText(WEAPONS[G.key].name.split(" ")[0], G.x, G.y - 6/view.scale);
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
    ctx.restore();
  });
  bots.forEach(function(bot){
    if(!bot.alive) return;
    var rx = bot.px + (bot.x-bot.px)*alpha;
    var ry = bot.py + (bot.y-bot.py)*alpha;
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
    var zb = bot._zArea || 0;
    if(zb > 120){
      ctx.beginPath(); ctx.arc(rx + 2/view.scale, ry + 3/view.scale, r, 0, Math.PI*2); ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ry, r + 2.2/view.scale, 0, Math.PI*2); ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.4/view.scale; ctx.stroke();
    } else if(zb < -40){
      ctx.beginPath(); ctx.arc(rx, ry, r + 2.2/view.scale, 0, Math.PI*2); ctx.strokeStyle = "rgba(20,30,40,0.9)"; ctx.lineWidth = 2/view.scale;
      ctx.setLineDash([2/view.scale, 2/view.scale]); ctx.stroke(); ctx.setLineDash([]);
    }
    if(tick < bot.blindUntil){
      ctx.beginPath(); ctx.arc(rx, ry, r + 4/view.scale, 0, Math.PI*2);
      ctx.fillStyle = "rgba(255,255,255,"+Math.min(0.8, (bot.blindUntil-tick)/64*0.4)+")"; ctx.fill();
    }
    var vf = bot._visFacing !== undefined ? bot._visFacing : bot.facing;
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
    if(false){
      var fx = rx + Math.cos(vf)*r*1.8;
      var fy = ry + Math.sin(vf)*r*1.8;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2/view.scale;
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(fx,fy); ctx.stroke();
    }
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
  document.getElementById("hContacts").textContent = contacts/1;
  document.getElementById("contact").style.display = contacts>0 ? "block" : "none";
  document.getElementById("hTick").textContent = tick;
  document.getElementById("hTime").textContent = simTime.toFixed(1)+"s";
  var rtLeft = roundState === "live" ? Math.max(0, ROUND_TIME_SEC - (simTime - roundStartTime)) : (roundState === "freeze" ? ROUND_TIME_SEC : 0);
  if(bomb && bomb.state === "planted") rtLeft = Math.max(0, (bomb.explodeTick - tick)/TICK_HZ);
  var bst = "—";
  if(bomb){
    if(bomb.state === "carried") bst = "у "+(bomb.carrier?bomb.carrier.id:"?") + (bomb.carrier && bomb.carrier.planting ? " · закладывает" : "");
    else if(bomb.state === "dropped") bst = "на земле";
    else if(bomb.state === "planted"){
      var dfz = bots.filter(function(b){ return b.defusing; })[0];
      bst = "заложена на "+bomb.site+(dfz ? " · дефуз "+dfz.id+" "+Math.max(0,(dfz.defuseUntil-tick)/TICK_HZ).toFixed(1)+"с" : "");
    } else if(bomb.state === "defused") bst = "обезврежена";
    else if(bomb.state === "exploded") bst = "взорвалась";
  }
  document.getElementById("hBomb").textContent = bst;
  scoreboardUpdate(rtLeft);
  if(!draw._plN || ++draw._plN > 6){ draw._plN = 1; playersUpdate(); }
  if(!draw._econN || ++draw._econN > 8){ draw._econN = 1; renderEcon(); }

  if(roundState === "freeze"){
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    var fzl = Math.max(0, roundStartTime - simTime);
    var fy = 112; // под табло
    ctx.fillStyle = "rgba(10,14,9,0.85)"; ctx.fillRect(cv.width/2-230, fy, 460, 44);
    ctx.strokeStyle = "rgba(148,180,73,0.7)"; ctx.strokeRect(cv.width/2-230, fy, 460, 44);
    ctx.fillStyle = "#e8ecdd"; ctx.textAlign = "center"; ctx.font = "600 15px 'IBM Plex Sans',sans-serif";
    ctx.fillText("ЗАКУПКА · "+fzl.toFixed(1)+"с", cv.width/2, fy+20);
    ctx.font = "11px 'IBM Plex Mono',monospace"; ctx.fillStyle = "#8b9a80";
    ctx.fillText("CT: "+ROUND_TYPE_LABEL[teamEco.CT.roundType]+" · T: "+ROUND_TYPE_LABEL[teamEco.T.roundType]+(teamTac.T?" · «"+teamTac.T.tac.name+"»":""), cv.width/2, fy+36);
    ctx.restore();
  }
  if(roundState === "matchover"){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "rgba(6,8,6,0.65)"; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle = "#e8ecdd"; ctx.textAlign = "center"; ctx.font = "600 26px 'IBM Plex Sans',sans-serif";
    var mwn = score.CT > score.T ? "ПОБЕДА CT" : (score.T > score.CT ? "ПОБЕДА T" : "НИЧЬЯ");
    ctx.fillText("МАТЧ ОКОНЧЕН — "+mwn+"  "+score.CT+":"+score.T, cv.width/2, cv.height/2 - 10);
    ctx.font = "13px 'IBM Plex Mono',monospace"; ctx.fillStyle = "#8b9a80";
    ctx.fillText("новый матч через "+Math.max(0, 7-(simTime-roundEndTime)).toFixed(1)+"с", cv.width/2, cv.height/2 + 18);
    ctx.restore();
  }
  if(roundState === "ending"){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "rgba(6,8,6,0.55)"; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle = "#e8ecdd"; ctx.textAlign = "center"; ctx.font = "600 22px 'IBM Plex Sans',sans-serif";
    // (карточка итога раунда — HTML-оверлей #roundCard)
    ctx.font = "13px 'IBM Plex Mono',monospace"; ctx.fillStyle = "#8b9a80";
    ctx.fillText("следующий раунд через "+Math.max(0, (ROUND_RESTART_DELAY_SEC-(simTime-roundEndTime))).toFixed(1)+"с", cv.width/2, cv.height/2 + 115);
    ctx.restore();
  }
}


// ---------- (v193) слой «точки углов» (01_points.js) — правка в 18_ui_editors.js ----------
// CT — синие, T — оранжевые, обе — зелёные; буква — район; линия — куда смотреть
function drawPoints(){
  var sc = view.scale, P = pointsGet(), sel = PTED.sel, H = PTED.hover, hov = null, bd = 10/sc;
  var COL = {CT:"#5aa8ff", T:"#ffaa3c", both:"#5fe07a"};
  if(H && !PTED.drag) P.forEach(function(p){ if(!ptEdVisible(p)) return; var d = Math.hypot(p.x-H.x, p.y-H.y); if(d < bd){ bd = d; hov = p; } });
  ctx.save();
  P.forEach(function(p){
    if(!ptEdVisible(p)) return;
    var on = p === sel || p === hov, a = sel ? (p === sel ? 1 : 0.45) : 0.85;
    ctx.globalAlpha = a*0.9; ctx.strokeStyle = "#ff5a4e"; ctx.lineWidth = (on ? 1.6 : 1.1)/sc;
    var ang = Math.atan2(p.ly-p.y, p.lx-p.x), L = on ? Math.hypot(p.lx-p.x, p.ly-p.y) : 22/sc;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x+L*Math.cos(ang), p.y+L*Math.sin(ang)); ctx.stroke();
    ctx.globalAlpha = a; ctx.fillStyle = COL[p.side] || "#ccc"; ctx.strokeStyle = "#0b0f0b"; ctx.lineWidth = 1/sc;
    ctx.beginPath(); ctx.arc(p.x, p.y, (on ? 5.5 : 3.6)/sc, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    if(p.area){ ctx.font = (9/sc)+"px sans-serif"; ctx.fillStyle = "#e8eee8"; ctx.fillText(p.area === "M" ? "м" : p.area, p.x+4.5/sc, p.y-3.5/sc); }
  });
  if(sel){ ctx.globalAlpha = 1; ctx.fillStyle = "#ff5a4e"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2/sc;
    ctx.beginPath(); ctx.arc(sel.lx, sel.ly, 6/sc, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
  if(hov && hov !== sel){ var t = hov.id+" · "+(hov.side === "both" ? "обе" : hov.side)+" · "+(hov.area === "M" ? "мид" : hov.area || "вне районов")+(hov.name ? " · выход из «"+hov.name+"»" : "");
    ctx.globalAlpha = 1; ctx.font = (11/sc)+"px sans-serif"; var w = ctx.measureText(t).width;
    ctx.fillStyle = "rgba(6,8,6,0.85)"; ctx.fillRect(hov.x+7/sc, hov.y+2/sc, w+6/sc, 15/sc); ctx.fillStyle = "#e8eee8"; ctx.fillText(t, hov.x+10/sc, hov.y+13/sc); }
  ctx.restore();
}
