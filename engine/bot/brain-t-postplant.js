/* [хозяева: tBrainPostplant] */ 
// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — ветка строк 850–1075 исходного tBrain; true — выйти из мозга
function tBrainPostplant(K){
  var gs = GEO[bomb.site];
    // прочь от бомбы (радиус взрыва убивает и своих). (v373, сторож: на Ancient T с постом «flee» за 2 с до взрыва ещё в зоне —
    // 60 раз на 100 раундов) раньше все уходили за 6 с, кто бы где ни стоял; у про последний раз в 520 px от бомбы — медиана за
    // 5,9 с до взрыва (демки Ancient, 1194 игрока). Теперь каждый — когда до своей точки ухода идти столько, сколько осталось,
    // + запас 2 с (проектное число), но не позже 6 с
    var leftS = bombTimeLeftTicks()/TICK_HZ, defusingNow = bots.some(function(o){ return o.defusing; });
    // (v519, пак 09.11 п.13; Р-17: «частое перебитие путей flee и postplant») решил уходить — уходит до взрыва (защёлка b._flee), точка ухода —
    // одна (b._fleePt), а не пересчёт каждый тик: «оставшийся путь / скорость + 2 с» убывал, пока бот шёл, и он возвращался на пост-плант.
    // Снимает уход только событие — начали дефуз (анти-дефуз важнее)
    var fleeKey = roundNum + ":" + bomb.plantTick;
    // (v530, отметка владельца 10.11: «игрока 0 уводит далеко от бомбы, хотя он знает, что рядом враг» — уход за 18,7 с до взрыва при CT в 58 px
    // от бомбы) пока CT, о котором команда знает (видели / слышали ≤ 10 с — как «свежая позиция» в pathDanger), успевает дойти от того места
    // и дефузнуть (с китом — кита у врага игрок не видит, считает худшее), бомбу не бросают: уйти — отдать раунд
    var BLf = kvLast("T"), ctCanDefuse = false;
    for(var fid in BLf){ var fq = BLf[fid], fo = teamBot(fid); if(!fo || !fo.alive || fo.team !== "CT" || tick - fq.tick > 10*TICK_HZ) continue;
      if(polyLen(pathPts(fq.x, fq.y, bomb.x, bomb.y, fo.z, bomb.z))/SPEED + DEFUSE_KIT_TICKS/TICK_HZ < leftS){ ctCanDefuse = true; break; } }
    if(ctCanDefuse) K.ts.forEach(function(b){ b._flee = null; if(b.post && b.post.tag === "flee") clearPost(b); });
    var fleeing = (defusingNow || ctCanDefuse) ? [] : K.ts.filter(function(b){ if(b.planting) return false;
      if(b._flee === fleeKey) return true;
      var fp = bombFleePoint(b) || gs.tStage;
      if(leftS < 6 || leftS < pathLenTo(b, fp.x, fp.y)/(SPEED*weaponSpeedMul(b)) + 2){ b._flee = fleeKey; b._fleePt = fp; return true; }
      return false; });
    if(defusingNow) K.ts.forEach(function(b){ b._flee = null; });
    if(fleeing.length){
      if(!K.tt.fleeLogged){ K.tt.fleeLogged = true; logEvent("T: уходим от бомбы — сейчас рванёт"); }
      fleeing.forEach(function(b){ setPost(b, b._fleePt || gs.tStage, {x:bomb.x, y:bomb.y}, true, "flee"); });
      K.ts = K.ts.filter(function(b){ return fleeing.indexOf(b) < 0; });
      if(!K.ts.length) return true;
    }
    // решили "не успеваем на дефуз — сейв": держим сейв, пока кто-то дефузит
    // (если дефуз оборвался — фейк/убили — через 2с снова играем бомбу)
    if(K.tt._defLate){
      if(bots.some(function(o){ return o.defusing && o.alive; })) K.tt._defLateSeen = tick;
      if(tick - (K.tt._defLateSeen || K.tt._defLate) > 2*TICK_HZ) K.tt._defLate = null;
      else { K.ts.forEach(function(b){ if(!b._saveSpot) b._saveSpot = pickSaveSpotT(b); if(!b.planting) setPost(b, b._saveSpot, null, true, "save"); }); return true; }
    }
    var antiDef = [], dfGo = false;
    defuseContTick();
    // (v296, владелец 14.10: «фейк-дефуз и обычный — его туда-сюда перенаправляет», отметка: раунд 1, тик 5848 — T2 за 10 тиков
    // «на время» → «на бомбу» → «на время» → «сейв») одно решение на одну попытку дефуза: кто пошёл на бомбу — идёт, пока дефуз
    // идёт, и ещё 2 с после того, как он стих (выглядывает на бомбу, а не разворачивается); «не успеваем — сейв» держит блок выше
    var dfNow = bots.filter(function(o){ return o.defusing && o.alive; })[0], AC = K.tt._adCommit;
    if(AC && (AC.round !== roundNum || (!dfNow && tick - AC.last > 2*TICK_HZ))) AC = K.tt._adCommit = null;
    if(AC){ if(dfNow) AC.last = tick;
      antiDef = K.ts.filter(function(b){ return AC.ids.indexOf(b.id) >= 0 && !b.planting; });
      var bpC = {x:bomb.x, y:bomb.y};
      antiDef.forEach(function(b){
        // (v353, отметка владельца: TN1R «слышит, что не фейк, но не идёт сбивать» — стоял на точке, откуда бомбу закрывает ящик)
        // пришёл на точку, дефуз идёт, а дефузера не видно 0,5 с — идёт прямо на бомбу
        var AS = b._adSpot && b._adSpot.round === roundNum ? b._adSpot : null;
        if(AS && b.atPost && dfNow && !b._sawEnemy){ if(!AS.arr) AS.arr = tick; else if(tick - AS.arr > 32 && !AS.push){ AS.push = true; AS.pt = bpC; voiceLog("T", "adpush"+b.id+roundNum, b.id, "отсюда бомбу не видно — иду прямо на дефуз"); } }
        setPost(b, AS ? AS.pt : bpC, bpC, true, "antidefuse"); b._stopPlantUntil = tick + 30; });
    } else
    if((dfGo = tDefuseGo(K.tt, K.ts))){
      var bpA = {x:bomb.x, y:bomb.y};
      // байт-пик: на первый звук выглядывает один (tDefuseBaiter), остальные держат свои места (bomb: tDefuseGo)
      antiDef = dfGo === "bait" ? K.ts.filter(function(b){ return b.id === K.tt._baiter && !b.planting; }) : K.ts.filter(function(b){ return !b.planting && DM.hypot(b.x-bpA.x, b.y-bpA.y) < 1100; });
      if(dfGo === "bait" && antiDef.length && K.tt._baitV !== K.tt._baitH0){ K.tt._baitV = K.tt._baitH0; voiceLog("T", "bait"+K.tt._baitH0, antiDef[0].id, "звук дефуза — выгляну проверить, прикройте"); }
      // (S6) не успеть — не бежать на троих: сколько осталось дефузить (кит
      // не знаем — считаем, что есть, если у CT был фулл-бай), и сколько бежать
      var dfz = bots.filter(function(o){ return o.defusing && o.alive; })[0];
      var remT = dfz ? Math.max(0, (dfz.defuseUntil||tick) - tick) : 0;
      if(dfz && !(dfz.defuseUntil) ) remT = (teamEco.CT.roundType === "full" ? DEFUSE_KIT_TICKS : DEFUSE_TICKS);
      // (п.17 владельца 29.10, м1 р4 т30711: «могли пикнуть через зону B Short, откуда отлично видно бомбу, и убить дефузера издалека») успеть —
      // дойти до первой точки по пути, откуда бомбу видно (оттуда и стреляют), а не до самой бомбы
      var late = antiDef.filter(function(b){ return bombSightLen(b, bpA)/SPEED*TICK_HZ > remT + 24; });
      if(dfz && late.length === antiDef.length && late.length && !K.tt._defLate){
        K.tt._defLate = tick;
        voiceLog("T", "deflate", late[0].id, "не успеваем на дефуз — сейв");
        late.forEach(function(b){ if(!b._saveSpot) b._saveSpot = pickSaveSpotT(b); setPost(b, b._saveSpot, null, true, "save"); b._stopPlantUntil = 0; });
        antiDef = [];
      } else if(dfz) antiDef = antiDef.filter(function(b){ return late.indexOf(b) < 0; });
      var spA = pickSpots("antidef"+Math.round(bpA.x/30)+","+Math.round(bpA.y/30), bpA, 4, {team: "T", rMin:50, rMax:300, minGap:45, must:[bpA]});
      // (п.16 владельца 29.10, м1 р4 т30561: «они оба стоят в одной позиции») каждый — ближайшая к себе из точек, которую ещё не занял свой
      var adUsed = antiDef.filter(function(o){ return o._adSpot && o._adSpot.round === roundNum; }).map(function(o){ return o._adSpot.pt; });
      antiDef.forEach(function(b){
        if(!b._adSpot || b._adSpot.round !== roundNum){
          var bs2 = null, bd2 = Infinity; spA.forEach(function(q){ if(adUsed.some(function(u){ return u.x === q.x && u.y === q.y; })) return; var d = DM.hypot(q.x-b.x, q.y-b.y); if(d < bd2){ bd2 = d; bs2 = q; } });
          if(bs2) adUsed.push(bs2);
          b._adSpot = {round:roundNum, pt: bs2 || bpA};
        }
        // (v555) с ножом на дефузящего (knifeDefuseTick, items) — точка сбить дефуз — сам дефузящий, а не точка с видом на бомбу
        var kD = b._knife && b._knDef ? bots.filter(function(o){ return o.id === b._knDef && o.alive && o.defusing; })[0] : null;
        setPost(b, kD ? {x:kD.x, y:kD.y} : b._adSpot.pt, kD || bpA, true, "antidefuse"); b._stopPlantUntil = tick + 30; // бегом, не шагом
      });
      if(dfGo === "all" && antiDef.length && K.tt._adVoice !== roundNum){ K.tt._adVoice = roundNum; voiceLog("T", "antidef", antiDef[0].id, "дефузят! все на бомбу!"); }
      // байт — не обязательство: проверяющий не держится за бомбу после звука (снимется с решением «фейк»); все — до конца дефуза (как было)
      if(antiDef.length && dfGo === "all") K.tt._adCommit = {round:roundNum, ids:antiDef.map(function(b){ return b.id; }), last:tick};
    }
    if(K.lurker && antiDef.indexOf(K.lurker) < 0) lurkerBrain(K.lurker, K.tt, K.other);
    var group = K.pick(["entry","awp","support","igl"]).filter(function(b){ return antiDef.indexOf(b) < 0; });
    // лёркер, оставшийся последним (уже не лёркер), — тоже на пост-плант, а не стоит где поставил
    if(!K.lurker) group = group.concat(K.ts.filter(function(b){ return b.tRole === "lurker" && antiDef.indexOf(b) < 0 && group.indexOf(b) < 0 && !b.planting; }));
    // CT ушли в сейв и времени много — пара T идёт выбивать оружие
    // CT не идут на ретейк: после планта прошло 15с+, у бомбы и на подходах их
    // не видели и не слышали 10с, и их меньше нас — похоже на сейв
    var ctNearB = intelEstimate("T", bomb.x, bomb.y, 1200, 10*TICK_HZ);
    var ctSaving = tick - bomb.plantTick > 15*TICK_HZ && (ctNearB.seen + ctNearB.heard) === 0 && aliveCount("CT") < K.ts.length;
    if(ctSaving && bombTimeLeftTicks() > 12*TICK_HZ){
      var hunters = group.filter(function(b){ return b.tRole==="entry" || b.tRole==="support"; });
      // где CT вероятнее всего прячутся: раньше было всего 2-3 фиксированные
      // точки вокруг спавна — хантеры весь раунд бегали туда-обратно между
      // одними и теми же двумя углами. Теперь набираем 5-7 точек по всей
      // стороне CT (как в pickSaveSpot — по навмешу, подальше от бомбы и от
      // сайтов), и обходят их методично: не туда, где уже недавно смотрел
      // кто-то из своих, и не туда же, куда уже идёт другой хантер.
      if(!K.tt.huntPts || K.tt.huntPts.round !== roundNum){
        var cand = [];
        NAVAREAS.forEach(function(z, i){
          if(i % 2) return;
          if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
          var c = zoneCentroid(z);
          if(insideSolidWall(c.x, c.y)) return;
          if(DM.hypot(c.x-bomb.x, c.y-bomb.y) < 500) return; // не отходят от бомбы слишком далеко в другую сторону
          var dSite = Math.min(DM.hypot(c.x-SITES.A.x, c.y-SITES.A.y), DM.hypot(c.x-SITES.B.x, c.y-SITES.B.y));
          if(dSite < 350) return; // сам сайт не проверяем — это не "у CT-спавна"
          cand.push({x:c.x, y:c.y, dCT:DM.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y)});
        });
        cand.sort(function(a, c2){ return a.dCT - c2.dCT; });
        // (v442, док владельца 27.10: «охота на последних — как будто рандомные точки, а не где была инфа») сначала — где по знанию команды
        // могут быть живые CT (гипотезы знания, тяжёлые первыми; точки на сайте — тоже, это и есть «где была инфа»); потом — места у спавна CT
        var minGap = 280, pts = [];
        var kn = []; bots.forEach(function(o){ if(o.team === "CT" && o.alive) knowEnemySpots("T", o.id).forEach(function(q){ if(q.w >= 0.05) kn.push(q); }); });
        kn.sort(function(a, c2){ return c2.w - a.w; });
        kn.forEach(function(q){ if(pts.length < 5 && !insideSolidWall(q.x, q.y) && pts.every(function(p){ return DM.hypot(p.x-q.x, p.y-q.y) > minGap; })) pts.push({x:q.x, y:q.y}); });
        if(pts.every(function(p){ return DM.hypot(p.x-CT_SPAWN.x, p.y-CT_SPAWN.y) > minGap; })) pts.push({x:CT_SPAWN.x, y:CT_SPAWN.y});
        for(var ci=0; ci<cand.length && pts.length<7; ci++){
          var c = cand[ci];
          if(pts.every(function(p){ return DM.hypot(p.x-c.x, p.y-c.y) > minGap; })) pts.push({x:c.x, y:c.y});
        }
        K.tt.huntPts = pts; K.tt.huntPts.round = roundNum; K.tt._huntSeen = {};
      }
      var pickNext = function(b, avoid){
        // методичный обход: сперва ближайшая ещё НЕ проверенная точка (не та,
        // куда уже идёт другой хантер); когда все проверены — начинаем заново
        var free = function(list){ return list.filter(function(hi){ return avoid.indexOf(hi) < 0; }); };
        var unvisited = free(K.tt.huntPts.map(function(hp, hi){ return hi; }).filter(function(hi){ return K.tt._huntSeen[hi] === undefined; }));
        if(!unvisited.length){ K.tt._huntSeen = {}; unvisited = free(K.tt.huntPts.map(function(hp, hi){ return hi; })); }
        var best = -1, bd = Infinity;
        unvisited.forEach(function(hi){ var hp = K.tt.huntPts[hi]; var d = DM.hypot(hp.x-b.x, hp.y-b.y); if(d < bd){ bd = d; best = hi; } });
        return best >= 0 ? best : 0;
      };
      hunters.forEach(function(b, hi){
        var taken = hunters.filter(function(o){ return o !== b && o._huntIdx !== undefined; }).map(function(o){ return o._huntIdx; });
        if(b._huntIdx === undefined){ b._huntIdx = pickNext(b, taken); b._huntStart = tick; }
        // не дошёл за 12с (точка недостижима/далеко) — следующая
        if(!b.atPost && tick - (b._huntStart||tick) > 12*TICK_HZ){ b._huntIdx = pickNext(b, taken); b._huntStart = tick; }
        if(b.atPost && b.post && b.post.tag === "hunt"){
          if(!b._huntArrive){ b._huntArrive = tick; K.tt._huntSeen[b._huntIdx] = tick; }
          if(tick - b._huntArrive > 90){ b._huntIdx = pickNext(b, taken); b._huntArrive = 0; b._huntStart = tick; }
        }
        var hp = K.tt.huntPts[b._huntIdx];
        setPost(b, hp, bomb ? {x:bomb.x, y:bomb.y} : null, true, "hunt");
      });
      if(hunters.length && !K.tt.huntLogged){ K.tt.huntLogged = true; logEvent("T: CT сейвят — "+hunters.map(function(h){return h.id;}).join(", ")+" идут выбивать оружие"); }
      group = group.filter(function(b){ return hunters.indexOf(b) < 0; });
    }
    // пост-плант: видеть бомбу (чтобы снять дефузера), но не стоять на виду у входа CT
    var bp0 = {x:bomb.x, y:bomb.y}, ppLeft = group.slice();
    // (9) играем на время: CT к бомбе не идут (не видели/не слышали их ближе
    // ~900px за 6с) и таймера ещё много — стоять вплотную к бомбе незачем,
    // только дарить ранний контакт. Отходим дальше, в укрытия, в пределах
    // слышимости дефуза; услышали дефуз — "все на бомбу" (анти-дефуз)
    // (5) клатч T после планта: один — сразу играет на время (дальнее укрытие в
    // пределах слышимости дефуза), выходит только на звук дефуза
    if(group.length === 1 && aliveCount("CT") >= 1 && bombTimeLeftTicks() > 6*TICK_HZ){
      // (v443) «я один» — только если T правда один: группа пост-планта без лёркера и охотников бывала из одного при живых других
      if(!K.tt._tcPP){ K.tt._tcPP = tick; if(aliveCount("T") === 1) voiceLog("T", "tcpp", group[0].id, "я один на пост-планте — прячусь, играю на время, выйду на звук дефуза"); }
      if(!ppTimeNamed(group, bp0, bomb.site, DEFUSE_HEAR-90))
        groupPost(group, bp0, gs.ctEntry, "postplant:time", {team: "T", rMin:300, rMax:Math.min(600, DEFUSE_HEAR-90), minGap:110, hideFrom:[gs.ctEntry, bp0]});
      return true;
    }
    // (v469, п.9 владельца 29.10, р5 м1: после планта точки переназначались трижды — через 4 с тишины все уходили «на время» на T Ramp и CT,
    // через 2,7 с при первой инфе возвращались) ответ про-аналитика 29.10: держать расстановку, пока кроссфайр работает и позиции не раскрыты;
    // менять — по событию (раскрыли, граната, кто-то погиб, CT выходят), а не по таймеру. Режим «тихо — отходим на время» (BAL.ppTime) убран:
    // у каждого своя точка у бомбы (holdGroup ниже), смена — реакция на контакт / анти-дефуз
    // (v145) пост-плант у бомбы = "держать район вокруг бомбы": бомбу видеть
    // обязательно (снять дефузера), встать под главный вход ретейка, от
    // остальных закрыться, не стоять кучей, по возможности кроссфаер
    // (v583a, Д14) места про при такой бомбе (MAP.postplant) — ppProGroup (position); нет данных о зоне бомбы — держать район вокруг бомбы
    // (отметка владельца 18.11, м5 р1: место про сдвигали «ради обзора» / «от своего» — T3 со Stairs на открытый Cross, T2 на открытую часть T Ramp)
    // место про — точное (exactSpot, task): «postplant:pro»
    var ppRest = ppProGroup(group, bp0, bomb.site, "postplant:pro"); if(ppRest && !ppRest.length) return true;
    holdGroup(ppRest || group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea: 420, rMin: 180, rMax: 520, must:[bp0], anyFrom:true,   // (v520, владелец 09.11: «занимают позиции, с которых видна бомба») бомбу видят все, не только первый (было mustFirst, до 680 px — встали в Hole)
      // (v442, док владельца 27.10: «войс спамится» — «держу бомбу, смотрю X» каждый игрок при каждой смене угла, 3–4 строки в секунду) — один
      // раз за раунд на игрока: куда смотрит дальше, видно на радаре
      voice:function(b, r){ if(r.main && b._ppSaid !== roundNum && (b._ppSaid = roundNum)) voiceLog("T", "pphold"+b.id, b.id, "смотрю бомбу "+calloutName(r.main.pt.x, r.main.pt.y).replace(/^на /,"")); }}, "postplant:hold");
    return true;
    if(!K.tt.ppAssign) K.tt.ppAssign = {};
    var usedP = {}; Object.keys(K.tt.ppAssign).forEach(function(id){ usedP[K.tt.ppAssign[id]] = true; });
    ppLeft = [];
    group.forEach(function(b){
      if(b._ppSplit && b._ppSplit.round === roundNum){ setPost(b, b._ppSplit.pt, bp0, true, "postplant:split"); return; }
      var nm = K.tt.ppAssign[b.id];
      if(!nm){
        var best = null, bd = Infinity;
        POS[bomb.site].tPost.forEach(function(n){ if(usedP[n]) return; var zp = zonePoint(n, bp0); if(!zp) return;
          var d = DM.hypot(zp.x-b.x, zp.y-b.y); if(DM.hypot(zp.x-bp0.x, zp.y-bp0.y) > 700) return;
          // (1) раньше — просто ближайшая к боту позиция (часто на самом сайте,
          // под входом CT). Теперь "стоимость": видна ли бомба, со скольких
          // выходов CT видно точку, не стоит ли прямо на линии входа CT
          var sp = namedSpot(n, bp0, {team: "T", must:[bp0], see:[gs.ctEntry], rMax:160, key:"pp"+Math.round(bp0.x/30)}) || zp;
          var ex = spotExposure("T", sp.x, sp.y), db = DM.hypot(sp.x-bp0.x, sp.y-bp0.y);
          d = d/500 + 0.9*ex + (hasLOS(sp.x, sp.y, bp0.x, bp0.y) ? 0 : 3) + (db < 150 ? 1.2 : 0) + (hasLOS(sp.x, sp.y, gs.ctEntry.x, gs.ctEntry.y) && db < 260 ? 0.8 : 0) +
              0.6*hashRand(roundNum*131 + matchNum*17 + n.length*7 + b.id.length);
          if(d < bd){ bd = d; best = n; } });
        nm = best; K.tt.ppAssign[b.id] = nm || "-"; if(nm){ usedP[nm] = true; logEvent(b.id+": пост-плант с «"+nm+"»"); }
      }
      var pp = nm && nm !== "-" ? namedSpot(nm, bp0, {team: "T", must:[bp0], see:[gs.ctEntry], rMax:160, key:"pp"+Math.round(bp0.x/30)}) : null;
      if(pp && hasLOS(pp.x, pp.y, bp0.x, bp0.y)) setPost(b, pp, bp0, true, "postplant:"+nm); else ppLeft.push(b);
    });
    groupPost(ppLeft, bp0, gs.ctEntry, "postplant", {team: "T", rMin:90, rMax:340, minGap:70, must:[bp0], hideFrom:[gs.ctEntry], see:[gs.ctEntry]});
    // (S10) двое после планта в одной точке — один пик CT забирает обоих:
    // второй расходится на другой угол к бомбе (кроссфайр)
    if(group.length === 2 && !K.tt._ppSplitDone){
      var g0 = group[0], g1 = group[1];
      if(g0.post && g1.post && DM.hypot(g0.post.x-g1.post.x, g0.post.y-g1.post.y) < 250){
        K.tt._ppSplitDone = tick;
        var cand = pickSpots("ppsplit"+Math.round(bp0.x/30), bp0, 4, {team: "T", rMin:150, rMax:420, minGap:60, must:[bp0]})
          .filter(function(q){ return DM.hypot(q.x-g0.post.x, q.y-g0.post.y) > 300; })[0];
        if(cand){ g1._ppSplit = {round:roundNum, pt:cand}; setPost(g1, cand, bp0, true, "postplant:split");
          voiceLog("T", "ppsplit", g1.id, "расходимся — я с другого угла на бомбу"); }
      }
    }
}

