// [хозяева: draw]
function draw(){
  // (Р3.2 команда) контекст мозга: общие для частей переменные (S0, alpha, chkP, contacts, fxR, timeArc)
  var K = {};
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = "#060806"; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.save();
  ctx.setTransform(view.scale,0,0,view.scale,view.panX,view.panY);
  if(imgReady) ctx.drawImage(img,0,0,2048,2048);
  else if(imgFailed){
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "#e05c52"; ctx.font = "13px monospace";
    ctx.fillText("не удалось загрузить радар "+MAP.name+" (фон)", 12, 20);
    ctx.restore();
  }
  hgtDraw();          // слой «высоты», если включён
  covDraw();          // слой «укрытия», если включён
  wbDraw();           // слой «прострелы», если включён
  visToolDraw();      // проверка «кто кого видит», если включена

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
  lookDbgDraw();
  if(typeof dvDraw === "function") dvDraw();   // (v571) раунд из демки — что решил бы бот (demo)
  if(typeof teamDbgPanel === "function") teamDbgPanel(false);   // (v566) разбор команды (team)
  if(showZones.checked) drawZoneShapeHandles();
  drawZones(K);
  drawDanger(K);
  drawNav(K);

  // ---------- конусы обзора (вместо линий) ----------
  // Конус — реальное поле зрения бота (FOV_DEG), обрезанное стенами и дымом:
  // лучи от бота до первой стены/облака. Ярче — если прямо сейчас видит врага.
  drawRays(K);
  drawSmokes(K);
  drawTracers(K);
  drawLayers(K);
  drawBots(K);
  if(draw.noHud) return;   // (v463) кадр повтора клатча (replay): только мир, без табло и панелей
  domText(document.getElementById("hContacts"), K.contacts/1);   // (v397, М146) только изменившееся — см. domText
  var ctEl = document.getElementById("contact"), ctD = K.contacts>0 ? "block" : "none"; if(ctEl.style.display !== ctD) ctEl.style.display = ctD;
  domText(document.getElementById("hTick"), tick);
  domText(document.getElementById("hTime"), simTime.toFixed(1)+"s");
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
  domText(document.getElementById("hBomb"), bst);
  scoreboardUpdate(rtLeft);
  if(!draw._plN || ++draw._plN > 6){ draw._plN = 1; playersUpdate(); }
  if(!draw._econN || ++draw._econN > 8){ draw._econN = 1; renderEcon(); }
  kfExpireTick();   // (v437) затухание строк киллфида

  // (v437, владелец 27.10) плашки «ЗАКУПКА · раунд N» больше нет — время закупа на табло, типы закупа и тактика — в «Экономике»
  if(roundState === "matchover"){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "rgba(6,8,6,0.65)"; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle = "#e8ecdd"; ctx.textAlign = "center"; ctx.font = "600 26px 'IBM Plex Sans',sans-serif";
    var mwn = score.CT > score.T ? "ПОБЕДА "+TEAM_NAME.CT : (score.T > score.CT ? "ПОБЕДА "+TEAM_NAME.T : "НИЧЬЯ");
    ctx.fillText("МАТЧ ОКОНЧЕН — "+mwn+"  "+Math.max(score.CT, score.T)+":"+Math.min(score.CT, score.T), cv.width/2, cv.height/2 - 10);
    ctx.font = "13px 'IBM Plex Mono',monospace"; ctx.fillStyle = "#8b9a80";
    ctx.fillText("новый матч через "+Math.max(0, 7-(simTime-roundEndTime)).toFixed(1)+"с", cv.width/2, cv.height/2 + 18);
    ctx.restore();
  }
  if(roundState === "ending"){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "rgba(6,8,6,0.55)"; ctx.fillRect(0,0,cv.width,cv.height);
    // (карточка итога раунда — HTML-оверлей #roundCard; отсчёт до следующего раунда — полоса внизу карточки, 640)
    ctx.restore();
  }
}

