// [хозяева: ctBrainPlayers]

// часть ctBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 420–745 исходного ctBrain
function ctBrainPlayers(K){
  K.cts.forEach(function(b){
    if(b.defusing) return;
    var role = ctRoleNow(b);   // (18.11) роль погибшего берёт живой ниже по важности (ct-setup)
    if((K.planted || K.ct.preSave) && K.ct.saving){
      // сейв не на CT-спавне (там T как раз и будут искать), а в месте подальше от
      // бомбы и от живых T, откуда их не видно; каждый — своё ближайшее такое место
      if(!b._saveSpot){ b._saveSpot = pickSaveSpot(b); }
      if(b.post && taskProp(b.post.tag, "pickupTask") && taskAlive(b)) return;   // (v334, М63) по пути на сейв подбирает оружие — не перебивать
      setPost(b, b._saveSpot, {x:bomb.x, y:bomb.y}, true, "save"); // взгляд — на угол, из-за которого придут от бомбы
      return;
    }
    if(K.ct.bombDown && K.ct.bombWatch.id === b.id){ // (v262, К5) держит выбитую бомбу и при колле
      setPost(b, K.ct.bombWatch.pt, {x:bomb.x, y:bomb.y}, true, "bombwatch"); return; }
    if(!K.ct.saving && ctLandPunish(b)) return;   // (v547) и на ретейке («CT выбивают всех, по кому есть инфа» — владелец 10.11); терпит ли ретейк — отклонение (setPost)   // (v343) услышал приземление одного рядом — выходит на него
    if(K.ct.flank && !K.ct.flank.dead && K.ct.flank.id === b.id && !K.ct.saving && flankPost(b, K.ct.flank, K.planted)) return;
    // (35) ретейк 2 на 3+ — AWP не несут в почти проигранный ретейк: снайпер сейвит
    if(K.planted && b.primary === "AWP" && K.cts.length === 2 && aliveCount("T") >= 3 && saveWorth("CT")){
      if(!b._saveSpot){ b._saveSpot = pickSaveSpot(b); voiceLog("CT", "awpsave"+b.id, b.id, "2 на "+aliveCount("T")+" — сейвлю AWP"); }
      setPost(b, b._saveSpot, {x:bomb.x, y:bomb.y}, true, "save"); return;
    }
    if(K.planted){ retakePost(b, K.cts); return; }
    if(ctEarlyPeek(b, K.ct)) return;
    if(ctInfoCheck(b, K.ct, K.cts)) return;   // (v555) середина раунда, инфы давно нет — один CT проверяет зону
    // ---- слышно плант рядом: сбить его — выйти на линию, откуда видно того, кто ставит ----
    var PHs = teamIntel.CT.plantHeard;
    // с умом: под плант лезут, только если нас там не меньше, чем их (или время
    // раунда почти вышло — тогда плант решает раунд). Иначе "их больше — под
    // плант не лезу": держит свою линию и играет ретейк вместе, а не бежит
    // в одиночку на 2–3 T, которые прикрывают ставящего
    var spSmart = true;
    if(PHs && tick - PHs.tick < PLANT_TICKS + 32 && DM.hypot(b.x-PHs.x, b.y-PHs.y) < 480 && !K.ct.saving){
      var tNearP = Math.max(1, intelEstimate("CT", PHs.x, PHs.y, 450, 5*TICK_HZ).n);
      var ctNearP = K.cts.filter(function(o){ return DM.hypot(o.x-PHs.x, o.y-PHs.y) < 600; }).length;
      var secLeftP = ROUND_TIME_SEC - (simTime - roundStartTime);
      spSmart = ctNearP >= tNearP || secLeftP < 12 || hasLOS(b.x, b.y, PHs.x, PHs.y, b.z);
      if(!spSmart && b._noStopLog !== PHs.tick){ b._noStopLog = PHs.tick;
        voiceLog("CT", "nostop"+b.id, b.id, "их "+tNearP+", нас "+ctNearP+" — под плант не лезу, держу и играем ретейк"); }
    }
    if(spSmart && PHs && tick - PHs.tick < PLANT_TICKS + 32 && DM.hypot(b.x-PHs.x, b.y-PHs.y) < 480 && !K.ct.saving){
      var ppt = {x:PHs.x, y:PHs.y};
      var sps = pickSpots("stopplant"+Math.round(ppt.x/40)+","+Math.round(ppt.y/40), ppt, 4, {team: "CT", rMin:60, rMax:280, minGap:50, must:[ppt]});
      var bsp = null, bsd = Infinity;
      sps.forEach(function(q){ var d = DM.hypot(q.x-b.x, q.y-b.y); if(d < bsd){ bsd = d; bsp = q; } });
      // (00_PLAN, пакет тактики, ответ владельца 6 от 04.11: «плант идёт (3,2 с): успевает убить — главное; нет — сильная позиция; не бежать
      // через открытое ради безнадёжной попытки») не успевает дойти до места, откуда видно ставящего, до конца планта — не бежит (ретейк)
      if(bsp && !hasLOS(b.x, b.y, PHs.x, PHs.y, b.z) && pathLenTo(b, bsp.x, bsp.y)/SPEED*TICK_HZ > PHs.tick + PLANT_TICKS - tick){
        if(b._noStopLog !== PHs.tick){ b._noStopLog = PHs.tick; voiceLog("CT", "nostopT"+b.id, b.id, "не успеваю сбить плант — держу, играем ретейк"); }
        bsp = null; }
      if(bsp){
        if(b._stopPlantLog !== PHs.tick){ b._stopPlantLog = PHs.tick; voiceLog("CT", "stop"+b.id, b.id, "слышу плант — иду сбивать!"); }
        b._stopPlantUntil = tick + 2*TICK_HZ; taskKeep(b, 0, "ct");
        setPost(b, bsp, ppt, true, "stopplant");
        return;
      }
    }
    // ---- последний CT до планта: одно решение, а не "то ротация, то опорник" ----
    if(K.cts.length === 1 && ctClutch(b, K.ct)) return;
    // ---- минус мидер: мид не бросают пустым ----
    if(!K.ct.call && K.cts.length >= 3 && midCoverPost(b, K.cts)) return;
    // ---- слышит нескольких, но со своей точки их не видно — выйти туда, откуда видно ----
    if(b.atPost && !b._sawEnemy && tick >= (b._reangleNext||0) && taskProp(b.post.tag, "reangleHolder")){
      var sg2 = teamIntel.CT.sig, srcs = {}, sx = 0, sy = 0, sn = 0;
      for(var q2=sg2.length-1; q2>=0; q2--){
        var g2 = sg2[q2]; if(tick - g2.tick > 5*TICK_HZ) break;
        if(g2.type !== "sound" || srcs[g2.id]) continue;
        if(DM.hypot(g2.x-b.x, g2.y-b.y) > 650 || hasLOS(b.x, b.y, g2.x, g2.y, b.z)) continue;
        srcs[g2.id] = true; sx += g2.x; sy += g2.y; sn++;
      }
      if(sn >= 2){
        var sc0 = {x:sx/sn, y:sy/sn}, kk = DM.hypot(b.x-SITES.A.x, b.y-SITES.A.y) < DM.hypot(b.x-SITES.B.x, b.y-SITES.B.y) ? "A" : "B";
        var bestR = null, bestRN = null, brd = Infinity;
        POS[kk].ctHold.forEach(function(n){
          var q = namedSpot(n, b, {team: "CT", see:[sc0], key:"reang"}); if(!q) return;
          var d = DM.hypot(q.x-b.x, q.y-b.y); if(d < 40 || d > 380 || !hasLOS(q.x, q.y, sc0.x, sc0.y)) return;
          if(d < brd){ brd = d; bestR = q; bestRN = n; }
        });
        b._reangleNext = tick + 8*TICK_HZ;
        if(bestR){
          logEvent(b.id+": слышит "+sn+" — выходит на «"+bestRN+"», откуда их видно");
          taskKeep(b, 0, "ct"); setPost(b, bestR, sc0, true, "repos"); taskKeep(b, tick + 6*TICK_HZ, "ct");
          return;
        }
      }
    }
    var call = K.ct.call;
    var strong = call && call.count >= 2;
    // любой колл — ротатор и роумер идут на помощь; подтверждённый выход (2+) — и мидер
    var oldRot = call && (role === "rotator" || role === "roamer" || (strong && role === "mid"));
    if(call && ((K.ct.rot && K.ct.rot[b.id]))){
      var gc = GEO[call.site];
      // раздел: ротация не в одну и ту же открытую точку вслепую по умолчанию —
      // 1) смотрим туда, где враг РЕАЛЬНО известен (свежий вижу/слышу у этого
      //    сайта), а не всегда строго во вход, иначе бот держит вход, пока враг
      //    заходит совсем с другой стороны;
      // 2) если рядом с этим сайтом ещё нет ни одного своего — в одиночку не
      //    лезем на открытую опорную точку (там его просто расстреляют с двух
      //    углов), сначала подтягиваемся до входа на сайт и ждём напарника;
      // 3) когда напарник уже есть — берём одну из нескольких прикрытых точек,
      //    а не всегда одну и ту же (её иначе легко читать по прошлым раундам)
      var siteC = SITES[call.site];
      var threatSig = null, TIsig = teamIntel.CT.sig;
      for(var si=TIsig.length-1; si>=0; si--){
        var sgz = TIsig[si];
        if(tick - sgz.tick > 6*TICK_HZ) break;
        if((sgz.type==="spotted" || sgz.type==="sound") && DM.hypot(sgz.x-siteC.x, sgz.y-siteC.y) < 450){ threatSig = sgz; break; }
      }
      var lookPt = threatSig ? {x:threatSig.x, y:threatSig.y} : gc.tEntry;
      // (плант 74%) ротация по одному в стак — не заходят по одному: первый у
      // входа CT ждёт второго (до ~5с), дальше заходят вместе
      var defOn = K.cts.filter(function(o){ return DM.hypot(o.x-siteC.x, o.y-siteC.y) < 450; }).length;
      if(call.count >= 2.6 && defOn <= 1 && DM.hypot(b.x-siteC.x, b.y-siteC.y) > 380 && !(bomb && bomb.state === "planted")){
        var RG = K.ct._rg || (K.ct._rg = {}); var rg = RG[call.site] || (RG[call.site] = {since:tick, go:false});
        var atEnt = K.cts.filter(function(o){ return K.ct.rot[o.id] && DM.hypot(o.x-gc.ctEntry.x, o.y-gc.ctEntry.y) < 280; }).length;
        if(!rg.go && (atEnt >= 2 || tick - rg.since > 5*TICK_HZ || Object.keys(K.ct.rot).length <= 1)){ rg.go = true;
          if(atEnt >= 2) voiceLog("CT", "rgo"+call.site+roundNum, b.id, "мы вдвоём у входа — заходим вместе"); }
        if(!rg.go){
          var hs0 = pickSpots("rg"+call.site, gc.ctEntry, 3, {team: "CT", rMin:40, rMax:220, minGap:55, hideFrom:[siteC, gc.tEntry], see:[gc.ctEntry]});
          setPost(b, hs0[Object.keys(K.ct.rot).sort().indexOf(b.id) % Math.max(1, hs0.length)] || gc.ctEntry, siteC, true, "rotateHold");
          return;
        }
      }
      if(K.ct.playRetake && K.ct.playRetake.site === call.site && DM.hypot(b.x-siteC.x, b.y-siteC.y) > 380){
        // ждём у входа CT, вне видимости с сайта: подтянуться к бомбе на ретейк
        var hs = pickSpots("prt"+call.site, gc.ctEntry, 4, {team: "CT", rMin:60, rMax:260, minGap:60, hideFrom:[siteC, gc.tEntry], see:[gc.ctEntry]});
        var hi2 = Object.keys(K.ct.rot).sort().indexOf(b.id);
        setPost(b, hs[Math.max(0, hi2) % Math.max(1, hs.length)] || gc.ctEntry, gc.ctEntry, true, "rotateHold");
        return;
      }
      // важно: сайт всё равно надо прикрыть, поэтому НЕ ждём напарника, чтобы
      // не оставить точку вообще пустой — просто не всегда одна и та же открытая
      // точка и не всегда взгляд строго во вход по умолчанию
      var apos = anchorPosOf(call.site);
      var rSpots = pickSpots("rotateSpots"+call.site, gc.anchor, 5, {team: "CT", rMax:230, minGap:60, see:[lookPt], hideFrom:[gc.tStage],
        cross: apos ? {from:apos, pt:gc.tEntry} : null});
      var rPick = weightedPick(rSpots.length, roundNum*271 + (role==="rotator"?11:role==="roamer"?23:37));
      if(DM.hypot(b.x-siteC.x, b.y-siteC.y) > 600) safeRotate(b, rSpots[rPick] || siteC, call.site);
      setPost(b, rSpots[rPick], lookPt, true, "rotate", role==="rotator"?1:-1);
      return;
    }
    // (v342, отметка владельца: «бомба выбита — колл, а NiKo стоит опорником на Palace») C4 лежит у другого сайта (колл «бомба
    // лежит — держим её», ct.bombDown), CT ≤ 3 — опорник идёт к бомбе: на его сайте без бомбы ставить нечего. При 4–5 CT остаётся
    if((role === "anchorA" || role === "anchorB") && K.ct.bombDown && K.cts.length <= 3 && !(bomb && bomb.state === "planted")){
      var kMine = role === "anchorA" ? "A" : "B", kBomb = kMine === "A" ? "B" : "A", bd = K.ct.bombDown;
      if(DM.hypot(bd.x-SITES[kBomb].x, bd.y-SITES[kBomb].y) + 250 < DM.hypot(bd.x-SITES[kMine].x, bd.y-SITES[kMine].y)){
        var bdp = pickSpots("bdrot"+kBomb, GEO[kBomb].anchor, 3, {team: "CT", rMax:260, minGap:60, see:[{x:bd.x, y:bd.y}], hideFrom:[GEO[kBomb].tStage]})[0] || GEO[kBomb].anchor;
        var wasBd = b.post && b.post.tag === "rotate:bomb";
        if(setPost(b, bdp, {x:bd.x, y:bd.y}, true, "rotate:bomb").ok && !wasBd){ voiceLog("CT", "bdrot"+b.id+roundNum, b.id, "бомба "+kBomb+", иду с "+kMine); safeRotate(b, bdp, kBomb); }
        return;
      }
    }
    if(ctSetupRole(b, role, K.ct)) return;
    if(role === "anchorA" || role === "anchorB"){
      // опорник каждый раунд встаёт на одну из нескольких позиций у сайта, а не
      // всегда в одну точку — иначе T кидали бы молотов/флешку ровно в него по
      // заученной точке (в CS тоже меняют позиции, чтобы не читали)
      var kA = role === "anchorA" ? "A" : "B";
      // раздел 11.1: точки оценены и по второму направлению обзора (мид —
      // коннектор, "двойное покрытие"), и со штрафом за места, куда T в этом
      // матче уже кидали молотов/HE по этому сайту ("занимают под раскид")
      var opts = pickSpots("anchorOpts"+kA, GEO[kA].anchor, 5, {team: "CT", rMax:230, minGap:60,
        see:[GEO[kA].tEntry], seeW:[{pt:GEO.ctMid, w:0.6}], hideFrom:[GEO[kA].tStage],
        avoidNades: enemyNadeSpots("CT", kA)});
      var pickI = weightedPick(opts.length, roundNum*131 + matchNum*977 + (kA==="A"?1:2));
      // позиции по названиям зон (Temple, Back Site, 90, First Lane…): каждый
      // раунд — одна из них; первые в списке чаще, последние — как офф-угол
      var names = (PRO_ROLE["anchor"+kA]), ents = [GEO[kA].tEntry].concat(entryPts(kA));
      var ni = posPickName(b, names, roundNum*131 + matchNum*977 + (kA==="A"?1:2));
      var offP = (b.prof) ? 0.08 + 0.3*prof(b, "aggr") : 0.2; // агрессивный чаще берёт нестандартный угол
      var off = hashRand(roundNum*577 + matchNum*31 + (kA==="A"?3:4)) < offP;
      off = false;
      if(off) ni = names.length - 1 - Math.floor(hashRand(roundNum*11 + matchNum)*Math.min(3, names.length));
      var nsp = namedSpot(names[ni], GEO[kA].anchor, {team: "CT", see:ents, hideFrom:[GEO[kA].tStage], key:"hold"+kA});
      var holdPt = nsp || opts[pickI];
      if(nsp && b._holdLog !== roundNum){ b._holdLog = roundNum; logEvent(b.id+": держит "+kA+" с «"+names[ni]+"»"+(off ? " (офф-угол)" : "")); }
      // (плант 74%) опорник один на сайте, а туда идут 3+ (колл/гранаты выхода):
      // раньше стоял на своём угле и умирал первым, и сайт брали 4 на 0. Про в
      // такой ситуации отходит к входу CT, тянет время и остаётся живым на ретейк
      var cl = K.ct.call;
      if(cl && cl.site === kA && cl.count >= 2.6 && !(bomb && bomb.state === "planted") &&
         ((cl.seen || 0) >= 2 || (cl.nades || 0) >= 2 || cl.bombSeen) &&
         !K.cts.some(function(o){ return o !== b && DM.hypot(o.x-SITES[kA].x, o.y-SITES[kA].y) < 450; })){
        if(!b._afPt || b._afPt.round !== roundNum || b._afPt.k !== kA){
          var afp = pickSpots("afall"+kA, GEO[kA].ctEntry, 3, {team: "CT", rMin:40, rMax:260, minGap:50, hideFrom:[GEO[kA].tEntry, SITES[kA]], see:[GEO[kA].ctEntry]})[0];
          b._afPt = {round:roundNum, k:kA, pt: afp || GEO[kA].ctEntry};
          voiceLog("CT", "afall"+kA+roundNum, b.id, "их ~"+Math.round(cl.count)+" на "+kA+", я один — отхожу к CT, тяну время, ретейк с ротацией");
        }
        setPost(b, b._afPt.pt, SITES[kA], true, "anchor:fall");
        return;
      }
      // (v280, владелец 14.10: игрок 7 в Dark шёл петлёй ради 54 px) место сменилось на соседнее (< 100 px — проектное число) —
      // остаётся, где стоит: это то же место
      // (v570, прогон 217: Ancient «застрял (anchor): пост заново 12 раз за 5 с») «то же место» — точка, которую дала задача (post.src), а не
      // сдвинутая setPost'ом (было: сдвинутая шла назад в setPost, сдвигалась снова — два места по очереди каждый тик)
      var hp0 = postSrc(b);
      if(b.post && b.post.tag === "anchor" && holdPt && DM.hypot(holdPt.x-hp0.x, holdPt.y-hp0.y) < 100) holdPt = {x:hp0.x, y:hp0.y};
      setPost(b, holdPt, lookFrom(holdPt, ents, GEO[kA].tEntry, b), true, "anchor");
    }
    else if(role === "mid"){
      // раздел: дефолтная точка мида была одной и той же ВСЕГДА открытой точкой
      // со статичным взглядом — бот стоял в открытую, даже если известно, где
      // враг реально был. Теперь: несколько укрытых вариантов вместо одной
      // открытой точки, и взгляд — туда, где враг реально недавно замечен
      // рядом с мидом, а не всегда в одну сторону по умолчанию
      var midThreat = null, TImid = teamIntel.CT.sig;
      for(var smi=TImid.length-1; smi>=0; smi--){
        var sgm = TImid[smi];
        if(tick - sgm.tick > 6*TICK_HZ) break;
        if((sgm.type==="spotted"||sgm.type==="sound") && DM.hypot(sgm.x-GEO.ctMid.x, sgm.y-GEO.ctMid.y) < 420){ midThreat = sgm; break; }
      }
      var midLook = midThreat ? {x:midThreat.x, y:midThreat.y} : GEO.ctMidLook;
      // мидер с AWP: не всегда мид — иногда встаёт снайпером на сайт (длинная
      // линия), в остальное время пикает/держит мид
      if(b.primary === "AWP" && !midThreat){
        var rr2 = hashRand(roundNum*613 + matchNum*29);
        var AS = MAP.tactics.plays.awpSite, AWPS = null;   // набор карты: none — доля раундов на миде, sets — места по долям
        if(AS && rr2 >= AS.none){ for(var asi = 0; asi < AS.sets.length; asi++){ AWPS = AS.sets[asi].spots; if(rr2 < AS.sets[asi].upTo) break; } }
        if(AWPS){
          var AW = AWPS[Math.floor(hashRand(roundNum*7 + matchNum)*AWPS.length)];
          var awl = zonePoint(AW.l, SITES[AW.k]);
          var awp = namedSpot(AW.n, SITES[AW.k], {team: "CT", see: awl ? [awl] : [], hideFrom:[GEO[AW.k].tStage], key:"awp"+AW.k});
          if(awp){
            if(b._awpLog !== roundNum){ b._awpLog = roundNum; logEvent(b.id+" (AWP): играет на "+AW.k+" с «"+AW.n+"», держит «"+AW.l+"»"); }
            setPost(b, awp, awl || GEO[AW.k].tEntry, true, "mid");
            return;
          }
        }
      }
      // мидер один против мид-группы T: раньше стоял на Top Mid/Sniper Nest
      // до конца и умирал первым в ~40% раундов (двое T на одного). Теперь:
      // на миде слышно/видно двоих+ — отходит на глубокую точку (Red Room/
      // Connector сторона), откуда их встретит вместе с тиммейтами
      if(!b._sawEnemy){
        var nMid = intelEstimate("CT", GEO.ctMid, 750, 4*TICK_HZ).n;
        var midCare = rmemRecent(RMEM.midDeath, 3).length >= 2;   // (10) рано умирал — отходит уже от одного
        if(nMid >= (midCare ? 1 : 2) || (b._midBack && b._midBack.round === roundNum && tick < b._midBack.until)){
          if(!b._midBack || b._midBack.round !== roundNum){
            var MHb = (MAP.tactics.plays.midHold || {}).back;   // куда мидер отходит (набор карты)
            var deep = (MHb && namedSpot(MHb, GEO.ctMid, {team: "CT", hideFrom:[GEO.tMid], see:[GEO.ctMid], key:"midback"})) ||
                       pickSpots("midback", GEO.ctMid, 2, {team: "CT", rMin:180, rMax:420, minGap:60, hideFrom:[GEO.tMid, GEO.ctMidLook]})[0];
            b._midBack = {round:roundNum, pt:deep || GEO.ctMid, until: tick + 12*TICK_HZ};
            voiceLog("CT", "midback", b.id, "на миде их "+nMid+" — отхожу глубже, не дуэлю один");
          }
          if(nMid >= 2) b._midBack.until = tick + 8*TICK_HZ;
          setPost(b, b._midBack.pt, GEO.ctMid, true, "mid:back");
          return;
        }
      }
      var midOpts = pickSpots("ctMidOpts", GEO.ctMid, 5, {team: "CT", rMax:190, minGap:55, see:[midLook], hideFrom:[GEO.tMid]});
      var midPick = weightedPick(midOpts.length, roundNum*191 + matchNum*433);
      // вперёд — реже; чаще глубже (набор карты: tactics.plays.midHold; Ancient — Jungle/Red Room, вперёд Top Mid/Sniper Nest)
      var MH = MAP.tactics.plays.midHold || {};
      // (v411, Б5з) места мида — и свои места игрока по демкам карты, выбор по доле его времени (posPickName)
      var mNames = posNamesOwn(b, MH.safe ? MH.safe : POS.M.ctHold), mi = posOwnZones(b.team, nick(b.id)).length ? posPickName(b, mNames, roundNum*191 + matchNum*433 + 7) : weightedPick(mNames.length, roundNum*191 + matchNum*433 + 7);
      // (10) мидер рано умирал в 2 из 3 последних раундов — в этом раунде глубже
      if(MH.care && rmemRecent(RMEM.midDeath, 3).length >= 2){ mNames = MH.care; mi = weightedPick(MH.care.length, roundNum*191 + matchNum*433 + 7);
        if(b._midCareV !== roundNum){ b._midCareV = roundNum; voiceLog("CT", "midcare"+roundNum, b.id, "меня на миде рано снимают — сегодня играю глубже"); } }
      var mp = !midThreat ? namedSpot(mNames[mi], GEO.ctMid, {team: "CT", see:[GEO.ctMidLook, GEO.tMid], hideFrom:[GEO.tMid], key:"mid"}) : null;
      // (мидер) разбор ранних смертей: в 6 из 14 у мидера был пистолет против AK
      // на 450–530px (заведомо проигранная дуэль), AWP умирал на 250px в упор.
      // Позиция — под оружие: пистолет/ПП — ближний угол у двери (длинные линии
      // закрыты), AWP — самая дальняя точка, откуда виден мид
      if(!midThreat){
        var wT = b.weapon ? b.weapon.tier : 0, isAwp = b.weapon && (b.weapon.key === "AWP" || b.weapon.key === "SSG");
        if(isAwp){
          var ac = pickSpots("midAwpLong", GEO.ctMid, 6, {team: "CT", rMax:340, minGap:50, see:[GEO.ctMidLook], hideFrom:[]})
            .filter(function(q){ return hasLOS(q.x, q.y, GEO.ctMidLook.x, GEO.ctMidLook.y); })
            .sort(function(a, c){ return DM.hypot(c.x-GEO.ctMidLook.x, c.y-GEO.ctMidLook.y) - DM.hypot(a.x-GEO.ctMidLook.x, a.y-GEO.ctMidLook.y); });
          if(ac[0]){ mp = ac[0]; if(b._mwV !== roundNum){ b._mwV = roundNum; logEvent(b.id+" (AWP): мид с дальней точки — дистанция моя"); } }
        }   // (v520) ветка «пистолет / ПП — ближний угол, спрятанный от мида» убрана: правило на оружие ставило мидера за стену (отметка владельца
            // 09.11 м200 р1); место — общий выбор мида (midOpts: видеть мид, прятаться от T-мида), обзор поста проверяет setPost (postViewPoint)
      }
      if(mp && b._holdLog !== roundNum){ b._holdLog = roundNum; logEvent(b.id+": мид с «"+mNames[mi]+"»"); }
      setPost(b, mp || midOpts[midPick], midLook, true, "mid");
    }
    else if(role === "rotator"){
      if(K.ct.setup ? K.ct.setup.rot === "212" : BAL.ctSetup === "2-1-2"){
        // (v285, владелец 14.10: «в 2-1-2 пропадает опорник на A») 2-1-2 — это двое на A, мид, двое на B: роумер — второй на B
        // (roam212), ротатор — второй на A (раньше — к «горячему» сайту или на точку про-ротатора Alley/Red Room между сайтами,
        // и на A оставался один)
        var ks = "A";
        var ap2 = anchorPosOf(ks);
        if(!secondOnSite(b, ks, ap2))
        groupPost([b], GEO[ks].anchor, GEO[ks].tEntry, "anchor2"+ks, {team: "CT", rMin:70, rMax:230, minGap:60, see:[GEO[ks].tEntry], hideFrom:[GEO[ks].tStage],
          cross: ap2 ? {from:ap2, pt:GEO[ks].tEntry} : null});
      } else {
        // 1-1-1: ротатор бегает по первой инфе (это делает блок ротаций выше);
        // погиб мидер — занимает мид; иначе стоит на связке с видом на проход,
        // а не лицом в стену
        var midAlive = K.cts.some(function(o){ return o.tRole === "mid"; });
        if(!midAlive){
          var mn = POS.M.ctHold[weightedPick(POS.M.ctHold.length, roundNum*17 + 3)];
          var mpp = namedSpot(mn, GEO.ctMid, {team: "CT", see:[GEO.ctMidLook, GEO.tMid], hideFrom:[GEO.tMid], key:"rotmid"}) || GEO.ctMid;
          if(b._rotMidLog !== roundNum){ b._rotMidLog = roundNum; logEvent(b.id+": мидер погиб — занимает мид («"+mn+"»)"); }
          setPost(b, mpp, GEO.ctMidLook, true, "mid");
        } else {
          // Alley и так закрывают мид и опорники — ротатор ждёт ближе к сайту,
          // куда T чаще ходят: место ротатора у этого сайта (набор карты: tactics.plays.rotatorHot; Ancient — у A CT Lane,
          // у B Back Halls); оттуда он и помогает быстрее, и сам держит полезный угол на сайт
          var hotR = siteHeat.A >= siteHeat.B ? "A" : "B";
          var rpn = (MAP.tactics.plays.rotatorHot || {})[hotR];
          var rEnts = [GEO[hotR].tEntry].concat(entryPts(hotR)).concat([SITES[hotR]]);
          var rp = (namedSpot(rpn, SITES[hotR], {team: "CT", see:rEnts, key:"rot"+hotR})) || GEO.rotator;
          var rl = lookFrom(rp, rEnts, SITES[hotR], b);
          setPost(b, rp, rl, true, "rotator");
        }
      }
    }
    else if(role === "roamer" && K.ct.stack){
      // раздел 12: стак — роумер не бродит, а третьим встаёт на "горячий" сайт
      var sk = K.ct.stack, apS = anchorPosOf(sk);
      groupPost([b], GEO[sk].anchor, GEO[sk].tEntry, "stack"+sk, {team: "CT", rMin:60, rMax:260, minGap:60, see:[GEO[sk].tEntry], hideFrom:[GEO[sk].tStage],
        cross: apS ? {from:apS, pt:GEO[sk].tEntry} : null});
    }
    else if(role === "roamer" && (K.ct.setup ? K.ct.setup.rot === "212" : BAL.ctSetup === "2-1-2")){
      // 2-1-2 = двое на A, один мид, двое на B: ротатор — вторым на "горячий"
      // сайт, роумер — вторым на другой (раньше роумер бродил своим маршрутом
      // и часто уходил на тот же A, а на B оставался один опорник)
      var hot = siteHeat.A >= siteHeat.B ? "A" : "B", ko2 = hot === "A" ? "B" : "A", apR = anchorPosOf(ko2);
      if(!(proRolePost(b, "roam", PRO_ROLE.roam212, GEO.B.anchor, GEO.B.tEntry, "anchor2B")))
      groupPost([b], GEO[ko2].anchor, GEO[ko2].tEntry, "anchor2"+ko2, {team: "CT", rMin:70, rMax:230, minGap:60, see:[GEO[ko2].tEntry], hideFrom:[GEO[ko2].tStage],
        cross: apR ? {from:apR, pt:GEO[ko2].tEntry} : null});
    }
    // роумер — свой маршрут (пост роли). (v136) Раньше снимал ЛЮБОЙ пост каждый тик — временные затеи чередовались с ним.
    // (v378) снимает только то, что ниже его роли или кончилось — арбитр места
    else if(!b.post || !taskAlive(b) || b._task.lv <= 1) clearPost(b);
  });
}

