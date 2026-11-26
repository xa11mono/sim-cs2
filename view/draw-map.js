// [хозяева: drawDanger, drawNav, drawRays, drawZones] часть draw (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 57–125 исходного draw
function drawZones(K){
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
}

// часть draw (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 126–191 исходного draw
function drawDanger(K){
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
  if(!showWalls.checked && document.getElementById("chkOutline") && document.getElementById("chkOutline").checked){
    var BX = wallBoxes();
    ctx.fillStyle = "rgba(150,152,146,0.55)";
    BX.forEach(function(poly){ ctx.beginPath(); poly.forEach(function(p, i){ if(i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); });
    ctx.strokeStyle = "rgba(236,234,222,0.55)"; ctx.lineWidth = 1.3/view.scale; ctx.lineCap = "round";
    ctx.beginPath();
    MANUAL_WALLS.forEach(function(s){ ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); });
    ctx.stroke(); ctx.lineCap = "butt";
  }
  if(showWalls.checked){
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
  if(mapEdOn()) mapEdDraw();
}

// часть draw (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 192–273 исходного draw
function drawNav(K){
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

  K.contacts = 0;
  // контакты для HUD — считаем всегда, независимо от отрисовки
  bots.forEach(function(ct){
    // (v560, В83: «плашка контакта остаётся после раунда») после конца раунда шаг игры стоит — `_visible` с последнего тика; контакта нет
    if(ct.team!=="CT"||!ct.alive||roundState!=="live") return;
    // (v545, отметка владельца 10.11: T в Dark под этажом, CT над ним — «ОБНАРУЖЕН КОНТАКТ», хотя друг друга не видят) табличка считала прямую
    // по радару без высот (hasVision — 2D). Контакт — когда кто-то из пары правда видит другого (видимость ботов, 3D, _visible)
    bots.forEach(function(t){ if(t.team==="T" && t.alive && ((ct._visible||[]).indexOf(t) >= 0 || (t._visible||[]).indexOf(ct) >= 0)) K.contacts++; });
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
    // (v414, М154) взгляд — со сглаживанием между тиками, как позиция (alpha ниже, строка с rx): игра 64 тика/с, экран 60–144 кадра —
    // в кадр попадало 0, 1 или 2 тика, и в бою (до ≈ 10° за тик) прицел шёл ступеньками 0 / 10 / 20° за кадр
    var fA = Math.max(0, Math.min(1, accumulator / TICK_MS)), f0 = b.pfacing, f1 = b.facing;
    var fI = f1 === undefined ? undefined : (f0 === undefined ? f1 : f0 + ((((f1 - f0) + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI)*fA);
    b._visFacing = fI === undefined ? undefined : fI + sway;
    b._idlePhase = ph;
  });
}

// часть draw (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 278–337 исходного draw
function drawRays(K){
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

  // ---------- гранаты (v258: только вид эффектов — данные, радиусы и игра прежние) ----------
  K.S0 = view.scale;
  K.fxR = function(n){ var v = Math.sin(n)*43758.5453; return v - Math.floor(v); };   // своя раскладка клубов на эффект, без Math.random
  var teamRGB = function(t){ return t === "CT" ? "120,182,238" : "238,184,92"; };
  // сколько эффекту осталось — дуга цветом команды сверху по часовой (чей и надолго ли)
  K.timeArc = function(x, y, r, frac, team, al){
    if(!(frac > 0)) return;
    ctx.strokeStyle = "rgba("+teamRGB(team)+","+(0.9*al)+")"; ctx.lineWidth = 2.2/K.S0; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*Math.min(1, frac)); ctx.stroke(); ctx.lineCap = "butt";
  };
}

