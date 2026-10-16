function resolveEngagements(){
  var pairs = [];
  bots.forEach(function(b){ b._sawEnemy = false; b._nearestEnemyDist = Infinity; b._nearestEnemyBot = null; b._visible = []; });
  bots.forEach(function(ct){
    if(ct.team!=="CT"||!ct.alive) return;
    bots.forEach(function(t){
      if(t.team!=="T"||!t.alive) return;
      var dist = Math.hypot(ct.x-t.x, ct.y-t.y);
      var maxRange = Math.max(ct.weapon.range, t.weapon.range);
      if(dist > maxRange) return;
      // шаг 5: обзор перекрывает дым; видит только тот, у кого враг в конусе
      // взгляда (или вплотную, или контакт уже идёт), и кто не ослеплён
      // (v241) что каждый видит у другого — в 3D: стены, укрытия, пол/уступы, крыши (visParts: голова / тело)
      visReady(); if(visWallHit(ct.x,ct.y,t.x,t.y)) return;
      var ctP = visParts(ct.x, ct.y, ct.crouching, t.x, t.y, t.crouching, false, ct.z, t.z), tP = visParts(t.x, t.y, t.crouching, ct.x, ct.y, ct.crouching, false, t.z, ct.z);
      if(!(ctP.head || ctP.body) && !(tP.head || tP.body)) return;
      // ван-вей: стоящий в самом краю дыма видит наружу, а его снаружи — нет
      var smk = smokeBlocks(ct.x,ct.y,t.x,t.y), ctOW = false, tOW = false;
      if(smk){ if(!BAL.oneWay) return; ctOW = oneWaySees(ct, t); tOW = oneWaySees(t, ct); if(!ctOW && !tOW) return; }
      // вне поля зрения видно только того, с кем контакт уже идёт (видел его ≤ 0,125 с назад). (аудит 11.10) Раньше хватало
      // контакта с ЛЮБЫМ врагом (contactStreak > 0): в перестрелке бот видел всех врагов на линии на 360°, и второго за спиной тоже
      var ctSees = (ctP.head || ctP.body) && (!smk || ctOW) && tick >= ct.blindUntil && (inFov(ct, t.x, t.y) || seenRecently(ct, t));
      var tSees  = (tP.head || tP.body) && (!smk || tOW) && tick >= t.blindUntil  && (inFov(t, ct.x, ct.y) || seenRecently(t, ct));
      if(!ctSees && !tSees) return;
      if(ctSees) (ct._seenAt || (ct._seenAt = {}))[t.id] = tick;
      if(tSees) (t._seenAt || (t._seenAt = {}))[ct.id] = tick;
      if(ctSees){ ct._sawEnemy = true; ct._lastSawT = tick; ct._visible.push(t); if(dist < ct._nearestEnemyDist){ ct._nearestEnemyDist = dist; ct._nearestEnemyBot = t; } }
      if(tSees){ t._sawEnemy = true; t._lastSawT = tick; t._visible.push(ct); if(dist < t._nearestEnemyDist){ t._nearestEnemyDist = dist; t._nearestEnemyBot = ct; } }
      pairs.push({ct:ct, t:t, dist:dist, ctSees:ctSees, tSees:tSees});
    });
  });

  // цель держится, пока видна (раньше каждый тик бралась ближайшая: при двух
  // врагах на похожей дистанции прицел метался между ними и выстрелы срывались).
  // Сменить цель (убил / пропала из вида): с шансом по навыку — перевести спрей
  // сразу, иначе короткая пауза и новая очередь
  bots.forEach(function(b){
    if(!b.alive || !b._sawEnemy) return;
    var T0 = b._tgt;
    if(T0 && T0.alive && b._visible.indexOf(T0) >= 0){
      var d0 = Math.hypot(T0.x-b.x, T0.y-b.y);
      if(d0 <= b._nearestEnemyDist*1.4 + 20){ b._nearestEnemyBot = T0; b._nearestEnemyDist = d0; return; }
    }
    var NT = b._nearestEnemyBot;
    if(T0 && NT && T0 !== NT && tick - (b.lastShotTick||-999) < 20){
      var pT = 0.3 + 0.4*Math.max(0, Math.min(1, ((b.skill||1)-0.8)/0.4));
      if(hashRand(tick*37 + b.id.charCodeAt(1)*5) < pT){ if(hashRand(tick+11) < 0.3) logEvent(b.id+": перевёл спрей на "+NT.id); }
      else { b.nextShotTick = Math.max(b.nextShotTick, tick + 8); b.burstCount = 0; }
    }
    b._tgt = NT;
  });
  bots.forEach(function(b){
    if(!b.alive) return;
    if(b._sawEnemy){
      b.contactStreak++;
      var TS = b._ts || (b._ts = {}), vis = {};
      b._visible.forEach(function(e){ vis[e.id] = 1; TS[e.id] = (TS[e.id] || 0) + 1; });
      for(var tsId in TS) if(!vis[tsId]) TS[tsId] = Math.max(0, TS[tsId] - 3);
      // (аудит 11.10) что бот знал ДО этого контакта — префайр в tryShoot только по нему. Раньше lastIntel перезаписывался
      // текущей позицией цели до выстрела, и «держащий» стрелял в только что появившегося без реакции (74 % первых выстрелов,
      // медиана 5 тиков ≈ 80 мс). Контакт непрерывный (lastIntel с прошлого тика) — прежнее «до» сохраняется
      if(!b.lastIntel || b.lastIntel.tick < tick - 1) b._intelPre = b.lastIntel;
      // память для префайра (план §3/§6): "видел врага тут только что" —
      // обновляется каждый тик реального контакта, не только на входе в бой
      b.lastIntel = {x:b._nearestEnemyBot.x, y:b._nearestEnemyBot.y, tick:tick};
    } else {
      // раньше тут было contactStreak = 0 и nextShotTick = 0: один тик без LOS
      // (враг чуть сдвинулся за край угла, пик закончился) — и стрелок заново
      // проходил полную задержку реакции 20-48 тиков, т.е. просто переставал
      // стрелять. Теперь "реакция" остывает постепенно: короткая потеря
      // контакта почти не сбрасывает её, долгая — сбрасывает полностью.
      b.contactStreak = Math.max(0, b.contactStreak - 3);
      if(b._ts) for(var tsId2 in b._ts) b._ts[tsId2] = Math.max(0, b._ts[tsId2] - 3);   // (этап 2, P0-2) по целям — так же
      // holding on stale-but-recent intel = "ещё смотрю на угол, где только что
      // видел врага" — это ровно то состояние, из которого возможен префайр;
      // без этого "hold" схлопывался бы в patrol в тот же тик, когда контакт
      // на миг теряется, и префайру было бы неоткуда взяться
      var stillWatching = b.holding && b.lastIntel && (tick - b.lastIntel.tick) < CAUTION_TICKS;
      if(!stillWatching && b.state !== "patrol"){ b.state = "patrol"; b.holding = false; b.forcedRetreat = false; }
      return;
    }
    if(tick - b.decisionTick < DECISION_INTERVAL_TICKS) return;
    if(b.planting || b.defusing) return; // закладывает/дефузит — решение уже принято
    b.decisionTick = tick;
    var alliesNear = bots.filter(function(o){ return o!==b && o.team===b.team && o.alive && Math.hypot(o.x-b.x,o.y-b.y) < 550; }).length;
    var enemiesSeen = bots.filter(function(o){ return o.team!==b.team && o.alive && Math.hypot(o.x-b.x,o.y-b.y) <= (b._nearestEnemyDist===Infinity? b.weapon.range : Math.max(b.weapon.range, b._nearestEnemyDist)) && hasVision(b.x,b.y,o.x,o.y) && inFov(b, o.x, o.y); }).length;
    var next = decideAction(b, b._nearestEnemyDist, alliesNear, enemiesSeen);
    // гистерезис: в отход и из отхода — не чаще раза в ~1.3с, иначе бот с низким
    // HP дёргался "отступаю / атакую / отступаю" каждые полсекунды
    if(next !== b.state && (next === "retreat" || b.state === "retreat") && tick - (b.stateSince||0) < 160) next = b.state; // ~2.5с
    if(next !== b.state) b.stateSince = tick;
    if(next !== b.state){
      logEvent(b.id+": "+STATE_LABEL[next]+" (HP "+Math.max(0,b.hp)+"%, союзников рядом "+alliesNear+", врагов видит "+enemiesSeen+")");
      if(next === "engage") aggrNote(b.id);   // как выглядывать — fightCycleTick (перестрелка по данным, v250)
    }
    b.state = next;
    if(next !== "patrol") b.roamChecking = false;
    b.holding = (next === "hold");
    b.holdSinceTick = b.holding ? (b.holdSinceTick===-999 ? tick : b.holdSinceTick) : -999;
    b.crouching = b.holding && (tick - b.holdSinceTick > 25);
    if(next === "retreat" && !b.forcedRetreat){
      // роумер отходит на предыдущую точку маршрута, а не на спавн
      var rt = (b.role === "roamer" && b.roamPrevPt) ? b.roamPrevPt : b.spawnPt;
      // опорник отходит не на спавн, а к CT-входу своего сайта — ждать помощь/ретейк;
      // T во время выхода — назад к точке сбора
      if(b.tRole === "anchorA") rt = GEO.A.ctEntry;
      else if(b.tRole === "anchorB") rt = GEO.B.ctEntry;
      else if(b.team === "T" && teamTac.T && GEO[teamTac.T.site]) rt = GEO[teamTac.T.site].tStage;
      var wp = buildWaypointPath(b.baseX, b.baseY, b.z, rt.x, rt.y, rt.z||0, b.team);
      // Отход не должен вести на врага: раньше "дальняя" точка отхода (спавн,
      // вход на сайт, точка сбора) часто лежала ЗА противником, и бот, решив
      // отступать, бежал прямо на него. Теперь, если первый отрезок пути ведёт
      // в сторону врага, бот уходит в ближайшее укрытие — место, откуда врага
      // не видно и которое дальше от него, чем сам бот.
      var foe = b._nearestEnemyBot;
      if(foe){
        var fa = Math.atan2(foe.y-b.baseY, foe.x-b.baseX);
        var w0 = wp.length ? wp[0] : [rt.x, rt.y];
        var wa = Math.atan2(w0[1]-b.baseY, w0[0]-b.baseX);
        var dA = Math.abs(((wa - fa + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
        if(dA < 1.2){ var cov = findCover(b, foe); if(cov) wp = buildWaypointPath(b.baseX, b.baseY, b.z, cov.x, cov.y, 0); }
      }
      b.path = wp; b.pathIdx = 0;
      b.forcedRetreat = true;
    } else if(next !== "retreat"){
      b.forcedRetreat = false;
    }
  });

  // отступающий, который всё равно сближается с врагом (путь позже повернул
  // к нему) — каждые 16 тиков проверяем и, если так, перестраиваем путь в укрытие
  bots.forEach(function(b){
    if(!b.alive || b.state !== "retreat"){ b._rtChk = null; return; }
    var foe = b._nearestEnemyBot || (b.lastIntel ? {x:b.lastIntel.x, y:b.lastIntel.y} : null);
    if(!foe) return;
    var dF = Math.hypot(foe.x-b.baseX, foe.y-b.baseY);
    if(!b._rtChk){ b._rtChk = {t:tick, d:dF}; return; }
    if(tick - b._rtChk.t >= 16){
      if(dF < b._rtChk.d - 4){
        var cv = findCover(b, foe);
        if(cv){ b.path = buildWaypointPath(b.baseX, b.baseY, b.z, cv.x, cv.y, 0); b.pathIdx = 0; }
      }
      b._rtChk = {t:tick, d:dF};
    }
  });

  // ---------- куда смотрит бот ----------
  // приоритет: видимый враг → (если держит угол) свежая память "враг был тут"
  // → свежий звук шагов → иначе направление движения (ставится в движении).
  // Поворот плавный, но быстрый (AIM_TURN_RATE), и стрелять можно только
  // когда прицел уже почти на цели (AIM_FIRE_CONE) — отсюда естественная
  // задержка "развернулся → выстрелил", когда враг появился сбоку/сзади.
  var aimStep = AIM_TURN_RATE / TICK_HZ;
  // (v291, И32, владелец 14.10: раунд 1, тик 3087 — игрок 6 убил в T Lower и отвернулся на Mid «как у про», пока второй T стоял
  // в 35 px от убитого) после фрага оценка взгляда стрелка пересчитывается сразу, а не через до 8 тиков
  if(BAL.newLook && BZ.ids.length){
    if(tick % 8 === 0){ lookPlan("CT"); lookPlan("T"); LOOK_REPLAN.CT = LOOK_REPLAN.T = false; }
    else ["CT","T"].forEach(function(t){ if(LOOK_REPLAN[t]){ LOOK_REPLAN[t] = false; lookPlan(t); } });
  }
  bots.forEach(function(b){
    if(!b.alive) return;
    var look = null;
    if(b._sawEnemy && b._nearestEnemyBot){ look = b._nearestEnemyBot; b.lookReason = "enemy"; }
    else if(BAL.newLook){ look = newLookFor(b); }
    else if(BAL.threatLook){
      // Новая схема (одна оценка вместо очереди): после "вижу врага" —
      // только близкие шаги прямо сейчас (≤1.5с, ≤600px), затем особые режимы
      // (роум-чек, охота, сейв, фейк-дефуз), затем ОДНА оценка угроз по карте
      // зон (threatLook): инфа там не забывается, а расползается по соседним
      // зонам. Пост и план тактики — только вес/запасной вариант.
      var sc0 = b.heardSound, sndAge = sc0 ? tick - sc0.tick : 1e9;
      if(sc0 && sndAge < 96 && Math.hypot(sc0.x-b.x, sc0.y-b.y) < 600){
        look = sc0; b.lookReason = "sound";
        if(b.curSpeed > 60*SPD_K && b.heading !== undefined){
          var sA = Math.atan2(sc0.y-b.y, sc0.x-b.x), sdH = Math.abs(((sA-b.heading+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
          // звук за спиной на бегу: оборачивается только на самый свежий (≤0.3с)
          // и близкий (≤250px); иначе смотрит по ходу, куда бежит
          if(sdH > 1.9 && (sndAge > 20 || Math.hypot(sc0.x-b.x, sc0.y-b.y) > 250)){ look = null; b.lookReason = null; }
        }
      }
      if(!look && BAL.deathLook){ var dLk = deathLook(b); if(dLk){ look = dLk; b.lookReason = "death"; } }
      // (3) тиммейт попросил смотреть второй угол
      if(!look && b._coverDir && tick < b._coverDir.until){ var cvP = hasLOS(b.x, b.y, b._coverDir.pt.x, b._coverDir.pt.y) ? b._coverDir.pt : cornerLook(b, b._coverDir.pt); if(cvP){ look = cvP; b.lookReason = "cover"; } }
      // (1) подходит к углу, за которым может быть враг, — прицел на край угла
      if(!look && BAL.pieSlice && b._pie && b._pie.danger > 0 && tick - b._pie.t < 16 && b._pie.dist < 320 && hasLOS(b.x, b.y, b._pie.pt.x, b._pie.pt.y)){ look = b._pie.pt; b.lookReason = "corner"; }
      if(look && BAL.cornerLook) look = cornerLook(b, look);
      else if(b.roamChecking && b.roamLookPt){ look = b.roamLookPt; b.lookReason = "roam"; }
      else if(b.post && b.post.tag === "endhunt" && b.post.look && !(b.curSpeed > 60*SPD_K && b.heading !== undefined &&
              Math.abs(((Math.atan2(b.post.look.y-b.y, b.post.look.x-b.x)-b.heading+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI) > 1.9)){ look = BAL.cornerLook ? (cornerLook(b, b.post.look) || b.post.look) : b.post.look; b.lookReason = "hunt"; }
      else if(b.fakeHoldUntil && tick < b.fakeHoldUntil && bomb && bomb.site){ look = GEO[bomb.site].tEntry; b.lookReason = "fake"; }
      // сейв: сначала туда, где реально может быть враг (карта угроз), и
      // только без угроз — по очереди дальние проходы (раньше сейв смотрел
      // одну длинную линию на мид, а Alley/Back Halls, откуда шёл T, — нет)
      // (9) на сейве: раньше угрозы по карте всегда перебивали — стоял лицом к
      // бомбе, спиной к проходам. Теперь ~40% времени по очереди чекает проходы
      else if(BAL.saveMove && b.atPost && b.post && b.post.tag === "save" && ((tick + b.id.charCodeAt(1)*37) % 160) < 64 && (look = saveLook(b))){ b.lookReason = "save"; }
      else if((look = threatLook(b))){ b.lookReason = "threat"; }
      else if(b.atPost && b.post && b.post.tag === "save" && (look = saveLook(b))){ b.lookReason = "save"; }
      else if(b.post && !b.atPost && b.post.look && /^(probe|lurk|shift|stage)/.test(b.post.tag) &&
              Math.hypot(b.post.x-b.x, b.post.y-b.y) < 420 && (look = (BAL.cornerLook ? cornerLook(b, b.post.look) : b.post.look))){ b.lookReason = "preaim"; }
      else if(b.atPost && b.post && b.post.look){
        if(BAL.cornerLook){
          if(!b._postCorner || b._postCorner.id !== b.post.id){
            var svT = {k:b._cornerPK, p:b._cornerPt}; b._cornerPK = null;
            b._postCorner = {id:b.post.id, pt: cornerLook(b, b.post.look, b.post)};
            b._cornerPK = svT.k; b._cornerPt = svT.p;
            // "видимый угол по пути к цели" оказался совсем в другой стороне
            // (путь к Lamp Room сначала уходит назад через сайт) — тогда смотрим
            // просто В СТОРОНУ своей цели, а не на этот угол за спиной
            var pc = b._postCorner.pt, pl = b.post.look;
            var aRaw = Math.atan2(pl.y-b.post.y, pl.x-b.post.x);
            if(!pc || Math.abs(((Math.atan2(pc.y-b.post.y, pc.x-b.post.x)-aRaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI) > 1.3){
              var dl = Math.min(220, Math.hypot(pl.x-b.post.x, pl.y-b.post.y));
              b._postCorner.pt = {x: b.post.x + Math.cos(aRaw)*dl, y: b.post.y + Math.sin(aRaw)*dl};
            }
          }
          // (перекрытие 2) угол поста считался от точки поста; бот переминается —
          // и угол оказывался за стеной, его разворачивала страховка "не в стену".
          // Не видно угол ~0.3с — пересчитываем от того места, где бот стоит
          if(BAL.lookFix && b._postCorner.pt && !hasLOS(b.x, b.y, b._postCorner.pt.x, b._postCorner.pt.y)){
            b._pcHid = (b._pcHid||0) + 1;
            if(b._pcHid > 20){ b._pcHid = 0; var pcN = cornerLook(b, b.post.look, b); if(pcN) b._postCorner.pt = pcN; }
          } else b._pcHid = 0;
          look = b._postCorner.pt;
          if(smokes.length){ var seT = smokeEdge(b, look); if(seT) look = seT; }
        } else look = b.post.look;
        b.lookReason = "post"; }
      else b.lookReason = null;
      // (аудит взгляда) угол поста/охоты смотрит на своего (свой стоит на линии
      // или у точки взгляда) — берём другое открытое направление; на ходу за
      // спиной впереди идущего — не в спину ему, а по флангам
      if(BAL.lookFallback && BAL.lookOpen !== false){
        if(look && /^(post|hunt|preaim)$/.test(b.lookReason || "") && lookOnMate(b, look)){ var altO = openDirLook(b); if(altO){ look = altO; b.lookReason = "open"; } }
        else if(BAL.lookFlank !== false && !look && b.curSpeed > 60*SPD_K && b.heading !== undefined && mateAhead(b)){
          var sideF = (Math.floor((tick + b.id.charCodeAt(1)*29)/96) % 2) ? 1 : -1, aF = b.heading + sideF*0.8;
          var cF = rayClipWalls(b.x, b.y, b.x + Math.cos(aF)*420, b.y + Math.sin(aF)*420);
          if(Math.hypot(cF.x-b.x, cF.y-b.y) > 110){ look = {x:cF.x, y:cF.y}; b.lookReason = "flank"; }
        }
      }
      // итоговая точка взгляда на бегу оказалась за спиной (например, угол к
      // звуку спереди, но путь к нему сначала уходит назад) — смотрит по ходу.
      // Исключение — самый свежий близкий звук сзади (≤0.3с, ≤250px)
      if(look && b.curSpeed > 60*SPD_K && b.heading !== undefined && /^(sound|preaim|threat|hunt)$/.test(b.lookReason || "")){
        var fOff = Math.abs(((Math.atan2(look.y-b.y, look.x-b.x)-b.heading+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        var closeFresh = b.lookReason === "sound" && sc0 && sndAge <= 20 && Math.hypot(sc0.x-b.x, sc0.y-b.y) <= 250;
        if(fOff > 1.9 && !closeFresh){ look = null; b.lookReason = null; }
      }
    }
    else {
      var intelFresh =b.lastIntel && (tick - b.lastIntel.tick) < CAUTION_TICKS;
      var soundFresh = b.heardSound && (tick - b.heardSound.tick) < SOUND_CAUTION_TICKS;
      if(intelFresh && soundFresh){
        look = b.heardSound.tick > b.lastIntel.tick ? b.heardSound : b.lastIntel;
        b.lookReason = look === b.heardSound ? "sound" : "intel";
      } else if(intelFresh){ look = b.lastIntel; b.lookReason = "intel"; }
      else if(soundFresh){ look = b.heardSound; b.lookReason = "sound"; }
      // держит установленный угол (стоит на посту с назначенным взглядом) —
      // не отвлекается на дальний шум/инфу из другого места карты, если это
      // не рядом (реальная близкая опасность) и не примерно туда же, куда он
      // и так смотрит: иначе он бросал свой угол ради стрельбы за стеной,
      // которую всё равно не видно и на которую он никак не влияет
      if(look && !holdRelevant(b, look)){ look = null; b.lookReason = null; }
      // идёт вперёд — на несвежий (>0.3с) звук за спиной не оборачивается:
      // иначе выходил на врага спиной, глядя назад на старый шум
      if(look && b.curSpeed > 60*SPD_K && b.heading !== undefined && !(b.lookReason === "sound" && tick - b.heardSound.tick < 20)){
        var lkA = Math.atan2(look.y-b.y, look.x-b.x), dH = Math.abs(((lkA-b.heading+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        if(dH > 1.9){ look = null; b.lookReason = null; }
      }
      if(look && BAL.cornerLook) look = cornerLook(b, look);
      // свежая угроза (враг, засвеченный ≤6с назад, в пределах 850px) важнее,
      // чем преэйм по плану или роум-чек: иначе T шёл мимо Cave, целясь в
      // Ramp "по тактике", и выходил спиной на тех, кто только что снял троих
      else if(BAL.lkp && !(b.post && b.post.tag === "endhunt") && (function(){ var c = lkpLook(b, 6*TICK_HZ); return (c && holdRelevant(b, c)) ? (look = c) : false; })()){ b.lookReason = "lkp"; }
      else if(b.roamChecking && b.roamLookPt){ look = b.roamLookPt; b.lookReason = "roam"; }
      else if(b.post && !b.atPost && b.post.look && /^(probe|lurk|shift|stage)/.test(b.post.tag) &&
              Math.hypot(b.post.x-b.x, b.post.y-b.y) < 420 && (look = (BAL.cornerLook ? cornerLook(b, b.post.look) : b.post.look))){ b.lookReason = "preaim"; }
      else if((function(){ var c = teamCallLook(b); return (c && holdRelevant(b, c)) ? (look = c) : false; })()){ b.lookReason = "call"; }
      else if((function(){ var c = (BAL.lkp && !(b.post && b.post.tag === "endhunt")) ? lkpLook(b) : null; return (c && holdRelevant(b, c)) ? (look = c) : false; })()){ b.lookReason = "lkp"; }
      // раздел 13: стоит без свежей инфы — смотрит туда, откуда его вероятнее
      // всего могут простреливать (карта вероятностей), а не в "пустые" углы
      // …и на ходу тоже: заходящий "прочищает" углы — смотрит не в спину
      // впереди идущему, а туда, откуда вероятнее всего выйдет враг
      else if(b.post && b.post.tag === "endhunt" && b.post.look){ look = BAL.cornerLook ? (cornerLook(b, b.post.look) || b.post.look) : b.post.look; b.lookReason = "hunt"; }
      else if(b.atPost && b.post && b.post.tag === "save" && (look = saveLook(b))){ b.lookReason = "save"; }
      else if((function(){ var c = BAL.habits ? habitLook(b) : null; return (c && holdRelevant(b, c)) ? (look = c) : false; })()){ b.lookReason = "habit"; }
      else if((function(){ var c = BAL.beliefLook ? beliefLook(b) : null; return (c && holdRelevant(b, c)) ? (look = c) : false; })()){ b.lookReason = "belief"; }
      else if(b.fakeHoldUntil && tick < b.fakeHoldUntil && bomb && bomb.site){ look = GEO[bomb.site].tEntry; b.lookReason = "fake"; }
      else if(b.atPost && b.post && b.post.look){
        if(BAL.cornerLook){
          if(!b._postCorner || b._postCorner.id !== b.post.id){
            var sv = {k:b._cornerPK, p:b._cornerPt}; b._cornerPK = null;
            b._postCorner = {id:b.post.id, pt: cornerLook(b, b.post.look, b.post)};
            b._cornerPK = sv.k; b._cornerPt = sv.p;
          }
          look = b._postCorner.pt;
          if(smokes.length){ var se2 = smokeEdge(b, look); if(se2) look = se2; }
        } else look = b.post.look;
        b.lookReason = "post"; }
      else b.lookReason = null;
      // на бегу не оборачивается назад на старую инфу/коллы/догадки: спину
      // прикрывают тиммейты, а сам он смотрит туда, куда идёт (иначе бежал
      // спиной вперёд и выходил на врага затылком)
      if(look && b.curSpeed > 60*SPD_K && b.heading !== undefined && /^(call|lkp|habit|belief)$/.test(b.lookReason || "")){
        var lkA2 = Math.atan2(look.y-b.y, look.x-b.x), dH2 = Math.abs(((lkA2-b.heading+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        if(dH2 > 1.6){ look = null; b.lookReason = null; }
      }
    }
    // страховка "не смотреть в стену": если прямо по взгляду стена ближе ~1м
    // (цель — за стеной: инфа/звук/последний враг), берём ближайшее открытое
    // направление в пределах ±70° — туда, откуда реально можно увидеть выход
    if(!BAL.newLook && BAL.smokeSweep && !b._sawEnemy && !(BAL.lookFix && /^(sound|death|cover)$/.test(b.lookReason || "") && b.heardSound && tick - b.heardSound.tick < 40)){ var swL = smokeSweepLook(b); if(swL){ look = swL; b.lookReason = "sweep"; } }
    var LD = LOOKDBG.on ? {tick: tick, reason: b.lookReason || null, raw: look ? {x: look.x, y: look.y} : null, steps: []} : null;
    if(look && BAL.noWallStare && b.lookReason !== "enemy" && b.lookReason !== "pro"){ var lw0 = look; look = openLook(b, look); if(LD && look !== lw0) LD.steps.push("стена по взгляду — взял открытое направление рядом"); }
    if(BAL.noWallLook && !b._sawEnemy && !/^(enemy|spam|cover)$/.test(b.lookReason || "")){
      var wla = look ? Math.atan2(look.y-b.y, look.x-b.x) : (!(b.curSpeed > 15*SPD_K) && b.facing !== undefined ? b.facing : null);
      if(wla !== null && flatWallAhead(b, wla, 80)){ var wal = openDirNear(b, wla); look = wal || (look ? null : null); if(wal) b.lookReason = (b.lookReason||"") + "+open"; if(LD) LD.steps.push(wal ? "стена в 80 px — повернул на открытое" : "стена в 80 px — открытого нет"); }
    }
    var slUrg = BAL.smoothLook ? lookUrgent(b) : true;
    if(BAL.smoothLook){ var lk0 = look; look = smoothLookFilter(b, look, slUrg);
      if(LD){ LD.urgent = slUrg; if(look !== lk0) LD.steps.push(look ? "плавность: держит прежний угол ещё " + (b._sl ? Math.max(0, ((slUrg ? SL.holdAlert : (b.curSpeed > 60*SPD_K ? SL.holdMove : SL.holdStand)) - (tick - b._sl.since))/TICK_HZ).toFixed(1) : "?") + " с" : "плавность: пока смотрит по ходу");
        if(b.lookReason === "glance") LD.steps.push("на бегу мельком глянул на опасный угол сбоку"); } }
    if(LD){ LD.final = look ? {x: look.x, y: look.y} : null; LD.reasonFinal = b.lookReason || null; b._ld = LD; }
    b.lookTarget = look ? {x:look.x, y:look.y} : null;
    // (v153) бросает гранату — смотрит туда, куда кинул, пока бросок не закончен
    // (раньше за 0,2с после броска взгляд щёлкал обратно — самый частый "рывок")
    if(look && BAL.smoothLook && b.throwUntil && tick < b.throwUntil && !b._sawEnemy) look = null;
    if(look){
      var want = Math.atan2(look.y-b.y, look.x-b.x);
      if(b.facing === undefined) b.facing = want;
      var dd = want - b.facing;
      dd = ((dd + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
      if(slUrg) b.facing += Math.max(-aimStep, Math.min(aimStep, dd));
      else {
        // (v153) вне боя: плавно, с торможением к цели, не быстрее ~260°/с;
        // стоя мелкие поправки (<3°) не делаем — прицел стоит, а не дрожит
        var standing = !(b.curSpeed > 15*SPD_K);
        if(!(standing && Math.abs(dd) < 0.05)){
          var cap = SL.calmRate / TICK_HZ, stp = Math.min(cap, Math.max(SL.minStep, Math.abs(dd)*SL.ease));
          b.facing += Math.max(-stp, Math.min(stp, dd));
        }
      }
    }
  });

  pairs.forEach(function(p){
    if(p.ctSees && p.ct._nearestEnemyBot === p.t) tryShoot(p.ct, p.t, p.dist);
    if(p.tSees && p.t._nearestEnemyBot === p.ct) tryShoot(p.t, p.ct, p.dist);
  });
}

function escapeWallLine(bot){
  for(var rr=3; rr<=18; rr+=3){
    for(var a=0; a<16; a++){
      var ang = a*Math.PI/8;
      var nx = bot.baseX + Math.cos(ang)*rr, ny = bot.baseY + Math.sin(ang)*rr;
      if(insideSolidWall(nx, ny)) continue;
      if(!navFloorNear(nx, ny, NAV_STEP_TOL) && navFloorNear(bot.baseX, bot.baseY, NAV_STEP_TOL)) continue;   // (v336) не с пола в ящик/щель
      if(inFire(nx, ny) && !inFire(bot.baseX, bot.baseY) && !fireCommit(bot)) continue;   // (этап 3, P1-4) не в огонь
      // из новой точки должно быть можно куда-то идти
      var free = 0;
      for(var q=0;q<8;q++){ var qa=q*Math.PI/4; if(!crossesWall(nx,ny,nx+Math.cos(qa)*4,ny+Math.sin(qa)*4)) free++; }
      if(free >= 5){ bot.baseX = nx; bot.baseY = ny; bot.x = nx; bot.y = ny; bot.path = []; bot.pathIdx = 0; return true; }
    }
  }
  return false;
}
function assignNewDestination(bot, tick){
  // отступает, а путь кончился/сброшен — не случайная точка патруля (часто
  // как раз в сторону врага), а укрытие от того, от кого отходит
  if(bot.state === "retreat"){
    var foe = bot._nearestEnemyBot || (bot.lastIntel ? {x:bot.lastIntel.x, y:bot.lastIntel.y} : null);
    var cv = foe ? findCover(bot, foe) : null;
    var tgt = cv || bot.spawnPt;
    bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, tgt.x, tgt.y, 0);
    bot.pathIdx = 0; bot.pickTick = tick;
    return;
  }
  if(bot.post && bot.state === "patrol"){
    if(bot.atPost || bot.planting || bot.defusing) return; // стоит на посту — путь не нужен
    var epp = fireSafe(bot.post, bot);
    bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, epp.x, epp.y, 0);
    bot.pathIdx = 0; bot.pickTick = tick;
    return;
  }
  if(bot.role === "roamer" && bot.state === "patrol"){
    if(bot.roamChecking) return; // стоит на чеке — путь не нужен
    var route = ROAM_ROUTES[bot.team];
    if(route && route.length){
      var rp = route[bot.roamIdx % route.length];
      bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, rp.x, rp.y, 0);
      bot.pathIdx = 0; bot.pickTick = tick; bot.roamTarget = rp;
      return;
    }
  }
  var r = hashRand(bot.id.charCodeAt(0)*97 + bot.id.length*13 + tick*7919 + bot.pickTick);
  var pool = POINT_POOL.length ? POINT_POOL : [bot.spawnPt];
  var target = pool[Math.floor(r * pool.length)];
  // (v342, отметка владельца: magixx (IGL) «спрыгивает, разворачивается на спавн, стоит, потом идёт снова») T без задачи до своей
  // очереди в тактике брал случайную точку всей карты (спавн, потом A, потом спавн). Теперь — место сбора тактики (tStage сайта)
  var tTac = bot.team === "T" && roundState === "live" && teamTac.T && teamTac.T.site && GEO[teamTac.T.site];
  if(tTac && tTac.tStage) target = tTac.tStage;
  // small deterministic jitter around the tactical point (plan discussion: a
  // bot occupying a point shouldn't stand dead-center every time) — seeded off
  // the same pickTick so it's reproducible, not Math.random.
  var jr1 = hashRand(bot.id.charCodeAt(0)*53 + tick*131 + 11);
  var jr2 = hashRand(bot.id.charCodeAt(0)*53 + tick*131 + 22);
  var jitterX = (jr1-0.5)*36, jitterY = (jr2-0.5)*36;
  var tx = target.x+jitterX, ty = target.y+jitterY, tz = target.z||0;
  // тактическая точка могла оказаться внутри стены (рисовалась под старые
  // стены) — идём к ближайшему проходимому месту, а не в стену
  var snapped = snapToWalkable(tx, ty); tx = snapped.x; ty = snapped.y;
  var wp = buildWaypointPath(bot.baseX, bot.baseY, bot.z, tx, ty, tz);
  // если маршрута нет (цель в отрезанном куске навмеша) и путь выродился в
  // прямую линию сквозь стену — берём другую точку, до 6 попыток
  for(var tries=0; tries<6 && wp.length===1 && segCrossesManualWalls(bot.baseX,bot.baseY,wp[0][0],wp[0][1]); tries++){
    var rr = hashRand(bot.id.charCodeAt(0)*197 + tick*31 + tries*7717);
    var t2 = pool[Math.floor(rr*pool.length)];
    var s2 = snapToWalkable(t2.x, t2.y);
    wp = buildWaypointPath(bot.baseX, bot.baseY, bot.z, s2.x, s2.y, t2.z||0);
  }
  bot.path = wp;
  bot.pathIdx = 0;
  bot.pickTick = tick;
}

