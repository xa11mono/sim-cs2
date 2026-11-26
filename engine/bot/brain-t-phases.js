// [хозяева: tBrainExecute, tBrainSetup]

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — ветка строк 396–588 исходного tBrain
function tBrainSetup(K){
  if(K.lurker) lurkerBrain(K.lurker, K.tt, K.other);
    // (v440, док владельца 27.10: «дефолт сравнить с про»; «энтри свою роль не играл») фаза дефолта — у всех тактик с долгим сетапом, и у
    // тактик-«дефолтов» тоже: раньше их группы с первой секунды шли к точке выхода (Connector, Apps) — на 25–50-й с у ботов 0,86 игрока на
    // A Site / Cross / Connector против 0,06 у про (демки Mirage, раунды с поздним плантом). Энтри — у своей цели (у про в дефолте перед A —
    // T Ramp 0,63 игрока), а не у другого сайта: раньше энтри стоял на B в выходе на A и шёл через карту / за лайнапом
    var inDef = K.tt.defUntil && tick < K.tt.defUntil && tick < K.tt.execTick - K.tt.needT*TICK_HZ;
    if(inDef){
      // дефолт: лёркер — у другого сайта (lurkerBrain), остальные — по местам про (ниже)
      if(!K.tt._defLog){ K.tt._defLog = true; logEvent("T: сначала дефолт, "+K.tac.name+" — позже"); }
      // (снайпер — с группой у цели, мид держит поддержка: AWP на миде в дефолте
      // у ботов был первой жертвой в 19% раундов, у про — 4%)
      // (v443, док владельца 27.10 «дефолт сравнить с про») места — из демок (MAP.defaultpos, tools/map/defpos_bake.py): сколько T в среднем
      // в каждой зоне на 20–50-й с раундов с выходом на этот сайт. Раньше трое шли к точке подготовки цели: на Mirage B — 2,1 игрока
      // в T Apps / Stove / B Apartments против 1,1 у про, на миде 1,0 против 1,9. Зоны — жребий раз на раунд по этим долям (без
      // повтора); ближняя к цели — энтри, дальше IGL, AWP, поддержка; взгляд — на ближайший к зоне вход (A, B или мид)
      var DEF_SPAWN_FRAC = 0.3;   // (v519) проектное число
      var DPS = ((MAP.defaultpos || {}).sites || {})[K.tt.site], dm = K.pick(["entry","igl","awp","support"]);
      if(DPS && DPS.length){
        // (v450, док владельца 28.10 №5: «выход через Палас — в Палас никто не пошёл», «Рамп + Палас, а заходят через Рампу и Коннектор»,
        // «тактика одна, а игроки делают другое») места дефолта — по долям про, но в районе своей группы тактики: зона про, ближняя
        // (≤ DEF_GROUP_R) к пути или точке подготовки группы (G.via, G.stage; мид — TMID). У группы нет таких зон — встаёт на точку подготовки
        // группы. Раньше зоны выпадали жребием по всей карте — группа Паласа стояла на миде, и потом шла в Палас через карту и врагов
        // (v570, отметка владельца м1 р4 38 с: «подобрав бомбу, пошёл в Палас дефолт, а не переколил на B, хотя знал, что там стак») после
        // перекола на другой сайт группы тактики (пути к старому сайту — Рамп, Палас) — уже не район места: место дефолта — по долям про
        // у нового сайта. И выбор мест (_defZ) — заново под новый сайт: было — раз на раунд, и после перекола A → B носитель шёл в Палас
        var gOf = function(b){ var r = null; if(K.tac.site && K.tac.site !== K.tt.site) return null; (K.tac.groups || []).forEach(function(G){ if(!r && G.roles.indexOf(b.tRole) >= 0) r = G; }); return r; };
        var laneOf = function(G){ var V = G.via || [], si = G.stage ? V.indexOf(G.stage) : -1; return si >= 0 ? V.slice(0, si + 1) : V.concat(G.stage ? [G.stage] : []); };
        var gPts = function(G){ var P = [];
          if(!G) return P;
          if(G.stage === "TMID"){ var tm = K.tt.tMidPt || GEO.tMid; if(tm) P.push(tm); return P; }
          // (22.11, Ж15, разбор м5 р3: игрок Palace получил дефолт у Tetris — путь группы Palace кончается Pillars / Palace Exit у сайта A, рядом
          // с выходом Ramp) район группы на дефолте — своя дорожка ДО стадии: что после стадии — уже выход, там дорожки групп сходятся у сайта.
          // Было: все точки пути группы
          laneOf(G).forEach(function(n){ var q = zonePoint(n, SITES[K.tt.site]); if(q) P.push(q); });
          return P; };
        var defPick = function(b, used, seed){ var P = gPts(gOf(b));
          // (п.28 владельца 29.10, м1 р8: группа Ramp получила места Mid Boxes / Chair / Connector — по прямой ≤ 450 сквозь стены) район
          // группы — по пути, а не по прямой
          // (Г4, 04.11, владелец: «дефолт играется сразу, на спавне так долго не стоят — возможно, в демках раунды-паузы») зона своего
          // спавна — не место дефолта (в defaultpos.json у сайта A — 0,27 игрока; проверить данные на ПК — 00_PLAN)
          var spZ = zoneIdAt(T_SPAWN.x, T_SPAWN.y);
          // (v519, пак 09.11 п.21; А-24: «многие якоря рядом с T-спавном — их не должно быть») доли про — где T БЫЛИ на 20–50 с, в том числе
          // проходя мимо спавна; место дефолта — не ближе DEF_SPAWN_FRAC пути от спавна T до цели (Mirage: T Spawn 4 %, Side Alley 11–14 %,
          // Apps Ramp 19–25 %, Palace Entry 21–26 %, T Roof 27–34 % — места прохода)
          var spL = polyLen(pathPts(T_SPAWN.x, T_SPAWN.y, SITES[K.tt.site].x, SITES[K.tt.site].y));
          var pool = DPS.filter(function(z){ var q = zonePoint(z[0]); return q && !used[z[0]] && zoneIdAt(q.x, q.y) !== spZ && polyLen(pathPts(T_SPAWN.x, T_SPAWN.y, q.x, q.y)) >= DEF_SPAWN_FRAC*spL && (!P.length || P.some(function(p){ return DM.hypot(p.x-q.x, p.y-q.y) <= DEF_GROUP_R && polyLen(pathPts(p.x, p.y, q.x, q.y)) <= DEF_GROUP_R; })); });
          if(!pool.length) return null;
          var wt = pool.reduce(function(a, z){ return a + z[1]; }, 0), u = hashRand(seed)*wt, di = 0;
          while(di < pool.length - 1 && u > pool[di][1]){ u -= pool[di][1]; di++; }
          return pool[di][0]; };
        if(!K.tt._defZ || K.tt._defZ.n !== dm.length || K.tt._defZ.site !== K.tt.site){
          K.used = {}; var ch = {};
          dm.forEach(function(b, dk){ ch[b.id] = defPick(b, K.used, roundNum*733 + matchNum*91 + dk*17 + 5); if(ch[b.id]) K.used[ch[b.id]] = 1; });
          K.tt._defZ = {n: dm.length, z: ch, site: K.tt.site};
        }
        // (Г3, 04.11, пп. 27/29 и ответ владельца: «в реальности нет таймера — место меняют по ситуации, по геймсенсу») смена места дефолта
        // через DEF_STAND (13 с стояния) убрана: место меняется по событиям — контакт (contact), перестановки (470/480), план IGL (igl)
        dm.forEach(function(b){
          var zn0 = K.tt._defZ.z[b.id], G0 = gOf(b), P = gPts(G0), tgt = SITES[K.tt.site];
          // (22.11, Ж15, владелец: «путь в якорь в Паласе — с T-спавна в Palace Entry, Palace, потом Palace Exit, а не через рампу, через врагов»)
          // к месту дефолта — по дорожке своей группы до стадии (последовательность зон тактики, маршрут 110: пост роли — его конец). Было:
          // маршрут группы на дефолте не запускался (`if(!tt.defUntil)` ниже), к месту — кратчайшим путём (якорь у Palace Exit — через T Ramp)
          if(G0 && G0.stage !== "TMID") startRoute(b, laneOf(G0), K.tac.id + ":lane:" + K.tt.site);
          var Zp = zn0 ? zonePoint(zn0, P[P.length-1] || tgt) : (P[P.length-1] || null), tag = zn0 ? "default:"+zn0 : "default:group";
          if(!Zp) return;
          var lk = [GEO.A.tEntry, GEO.B.tEntry, GEO.tMidLook].filter(Boolean).sort(function(a, c){ return DM.hypot(a.x-Zp.x, a.y-Zp.y) - DM.hypot(c.x-Zp.x, c.y-Zp.y); })[0];
          // (v519, А-27: «не должно быть якорей в полностью открытых местах» — стоял в центре мида под Short, Connector, Window) место — укрытое
          // от сторон CT (мид CT, сайты), видеть вход — как было
          groupPost([b], Zp, lk, tag, {team: "T", rMax:160, minGap:50, see:[lk], zone: zn0 ? zoneIdAt(Zp.x, Zp.y) : null, hideFrom:[GEO.ctMid, GEO.A.anchor, GEO.B.anchor].filter(Boolean)});   // (Г4, п.13: «default:Side Alley» стоял на T Spawn)
        });
      } else {
        groupPost(K.pick(["support"]), K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt);
        stagePost(K.pick(["entry","igl","awp"]), K.tt.site);
      }
    } else if(K.tac.groups && K.tac.style !== "fake" && K.tt.site !== K.tac.site){   // (v365) фейк — своя ветка ниже
      // (этап 2, P1-1) сайт плана сменили: точки подготовки и маршруты групп тактики — под старый сайт (Donut, A Hall…).
      // Раньше группа ставилась на них и с новым сайтом (тег stageB:Donut у A): ждала на старой точке. Теперь — стандартная
      // подготовка нового сайта; мид (TMID) — как был
      var memAll = [];
      K.tac.groups.forEach(function(G){ var mem = K.pick(G.roles); if(!mem.length) return;
        if(G.stage === "TMID"){ mem.forEach(function(b){ b._stageInfo = null; }); groupPost(mem, K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt); return; }
        mem.forEach(function(b){ if(memAll.indexOf(b) < 0) memAll.push(b); }); });
      stagePost(memAll, K.tt.site);
    } else if(K.tac.groups && K.tac.style !== "fake"){
      // (00_PLAN, пакет тактики, ответ владельца 1 от 04.11: «сплит, игрок группы погиб до выхода — продолжить (оставшийся держит позицию),
      // ждать или отменить; оставшийся не обязан идти вместо погибшего — держать пространство или к основной группе; мало времени — группой»)
      // основная группа — та, где больше ролей; в другой группе погиб свой — решение один раз за раунд: мало времени (EXU_LATE) — к основной;
      // оставшиеся на своей точке и без контакта — держат её (сплит продолжается); иначе — к основной. Ключевая граната погибшего — exuBackup (exec-sync)
      var gMain = 0; K.tac.groups.forEach(function(G, gi){ if(G.roles.length > K.tac.groups[gMain].roles.length) gMain = gi; });
      var GN = K.tt._gN && K.tt._gN.r === roundNum ? K.tt._gN : (K.tt._gN = {r: roundNum, n: {}, dec: {}});
      K.tac.groups.forEach(function(G, gi){
        var mem = K.pick(G.roles);
        if(GN.n[gi] == null) GN.n[gi] = mem.length;
        if(!mem.length) return;
        if(gi !== gMain && mem.length < GN.n[gi] && K.tt.phase === "setup"){
          if(!GN.dec[gi]){ var hold = mem.every(function(b){ return b.atPost && !b._sawEnemy && b.post && /^stage/.test(b.post.tag); });
            GN.dec[gi] = (K.secLeft < EXU_LATE || !hold) ? "merge" : "hold";
            voiceLog("T", "splitdec"+gi+roundNum, mem[0].id, GN.dec[gi] === "merge" ? "своего сняли — сплит отменяем, иду к основной" : "своего сняли — держу здесь, отвлекаю ротацию");
            logEvent("T: сплит — в группе «"+(G.stage || "?")+"» погиб свой — "+(GN.dec[gi] === "merge" ? "к основной группе" : "держат позицию")); }
          if(GN.dec[gi] === "merge"){ var GM = K.tac.groups[gMain], spM = GM.stage ? (zonePoint(GM.stage, K.g.tStage) || K.g.tStage) : K.g.tStage, lkM = GM.look ? (zonePoint(GM.look, spM) || K.g.tEntry) : K.g.tEntry;
            mem.forEach(function(b){ routeDrop(b); b._stageInfo = {from:spM, to:lkM, look: GM.look ? SITES[K.tt.site] : K.g.anchor, round:roundNum}; });
            groupPost(mem, spM, lkM, "stage"+K.tt.site+(GM.stage ? ":"+GM.stage : ""), {team: "T", rMax:200, minGap:50, hideFrom:[SITES[K.tt.site], lkM], see:[lkM]});
            return; }
        }
        // после дефолта маршрут "от спавна" уже не нужен — идут к своей точке кратчайшим путём
        if(!K.tt.defUntil) mem.forEach(function(b){ startRoute(b, G.via, K.tac.id+":"+gi); });
        if(G.stage === "TMID"){ mem.forEach(function(b){ b._stageInfo = null; }); groupPost(mem, K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt); return; }
        var sp = G.stage ? (zonePoint(G.stage, K.g.tStage) || K.g.tStage) : K.g.tStage;
        var lk = G.look ? (zonePoint(G.look, sp) || K.g.tEntry) : K.g.tEntry;
        var tag = "stage"+K.tt.site+(G.stage ? ":"+G.stage : "");
        mem.forEach(function(b){ b._stageInfo = {from:sp, to:lk, look: G.look ? SITES[K.tt.site] : K.g.anchor, round:roundNum}; });
        groupPost(mem, sp, lk, tag, {team: "T", rMax:200, minGap:50, hideFrom:[SITES[K.tt.site], lk], see:[lk]});
      });
    } else if(K.tac.style === "exec"){
      stagePost(K.pick(["entry","awp","igl"]), K.tt.site);
      groupPost(K.pick(["support"]), K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt);            // контроль мида
    } else if(K.tac.style === "default"){
      // дефолт: растягиваем CT — двое у другого сайта, AWP на миде, носитель у цели
      stagePost(K.pick(["entry","support"]), K.other);
      groupPost(K.pick(["awp"]), K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt);
      stagePost(K.pick(["igl"]), K.tt.site);
    } else if(K.tac.style === "split"){
      stagePost(K.pick(["entry","igl"]), K.tt.site);
      groupPost(K.pick(["awp","support"]), K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt);
    } else if(K.tac.style === "fake"){
      // раздел 12: фейк-выход. Основная группа тихо ждёт у настоящего сайта;
      // поддержка за ~14с до выхода громко "заходит" на другой сайт — бежит к
      // его входу, показывается, кидает смок/флешку (лёркер и так там же) —
      // чтобы CT перетянули туда ротацию. Потом настоящий выход, а фейкеры
      // догоняют второй волной.
      var fk = K.tac.fake, gf = GEO[fk];
      stagePost(K.pick(["entry","awp","igl"]), K.tt.site);
      var fakers = K.pick(["support"]);
      // копим факт "видели опорника у фейкового сайта" пока не поздно — читать
      // фейк можно только если реально знаем, что там кто-то БЫЛ
      if(!K.tt._fakeCtSeen && intelEstimate("T", gf.anchor.x, gf.anchor.y, 550, 4*TICK_HZ).n > 0) K.tt._fakeCtSeen = tick;
      if(tick < K.tt.execTick - 14*TICK_HZ){
        stagePost(fakers, fk);
      } else {
        if(!K.tt.fakeOn){ K.tt.fakeOn = tick;
          logEvent("T: фейк на "+fk+" — шумим и кидаем гранаты, выход на "+K.tt.site);
          if(fakers[0]) voiceLog("T", "fake"+fk, fakers[0].id, "делаю фейк на "+fk+", вы ждите на "+K.tt.site); }
        var fakeDied = teamIntel.T.sig.some(function(sg){ return sg.type === "died" && tick - sg.tick < 10*TICK_HZ && DM.hypot(sg.x-gf.tEntry.x, sg.y-gf.tEntry.y) < 450; });
        if(fakeDied){ stagePost(fakers, fk); if(!K.tt._fakeHoldLog){ K.tt._fakeHoldLog = true; logEvent("T: на фейке сняли своего — второй не лезет туда же, держит"); } }
        else groupPost(fakers, gf.tEntry, gf.anchor, "fake"+fk, {team: "T", rMax:120, minGap:40, see:[gf.anchor]});
        // раздел 13: "купились ли CT на фейк" — IGL примерно оценивает это по
        // своей же инфе (не телепатия): опорник фейкового сайта, которого
        // фейкеры видели вначале, пропал из поля зрения/по последней инфе
        // (beliefLast+CLEARZ) — похоже, ушёл ротой на настоящий сайт. Читается один
        // раз за фейк, не каждый тик, и не идеально (IGL может ошибиться).
        if(!K.tt._fakeRead && tick - K.tt.fakeOn > 5*TICK_HZ && tick - K.tt.fakeOn < 16*TICK_HZ){
          var fkZ = zoneIdAt(gf.anchor.x, gf.anchor.y);
          var sawCtAtFakeEarly = !!K.tt._fakeCtSeen;
          var clearedNow = fkZ && CLEARZ.T[fkZ] && CLEARZ.T[fkZ].tick > K.tt.fakeOn;
          var stillThere = intelEstimate("T", gf.anchor.x, gf.anchor.y, 450, 5*TICK_HZ).n > 0;
          // "не видно" ≠ "ушёл" — читаем "пусто" только если кто-то из фейкеров
          // реально смотрит туда прямо сейчас (иначе просто не в курсе, а не
          // "точно знаем, что там пусто")
          var watchingNow = K.ts.some(function(o){ return o.alive && (DM.hypot(o.x-gf.anchor.x, o.y-gf.anchor.y) < 380 || (DM.hypot(o.x-gf.anchor.x, o.y-gf.anchor.y) < 600 && hasVision(o.x, o.y, gf.anchor.x, gf.anchor.y))); });
          if(sawCtAtFakeEarly && watchingNow && (clearedNow || !stillThere)){
            K.tt._fakeRead = tick;
            var save = Math.min(8*TICK_HZ, Math.max(0, K.tt.execTick - tick - 4*TICK_HZ));
            if(save > 0){
              K.tt.execTick -= save;
              logEvent("IGL: фейк на "+fk+" сработал — опорник ушёл, ускоряем выход на "+K.tt.site);
              voiceLog("T", "fakeworked", "IGL", "они купились, идём на "+K.tt.site+" раньше");
            }
          } else if(sawCtAtFakeEarly && stillThere && tick - K.tt.fakeOn > 10*TICK_HZ){
            K.tt._fakeRead = tick;
            // (v561, этап 3 docs/tasks/PLAN_TACTICS_V2.md; PRO_PLAY §6з: «фейк не поверили — не ждать бесконечно, фейк может стать настоящим
            // выходом») на фейке — один держит, а на нашем сайте команда знает двоих и больше: фейк становится выходом на сайт фейка (перекол), если
            // бомба не лежит у нашего сайта и время есть; иначе — по плану
            var hereN = siteAssess("T", K.tt.site).near, fkN = siteAssess("T", fk).near;
            if(hereN >= 2 && fkN <= 1 && K.secLeft > 35 && !(bomb.state === "dropped" && DM.hypot(bomb.x-SITES[K.tt.site].x, bomb.y-SITES[K.tt.site].y) < BOMB_HERE_R)){
              var trvF = DM.hypot(SITES[fk].x - SITES[K.tt.site].x, SITES[fk].y - SITES[K.tt.site].y)*1.2/SPEED;
              tSetSite(K.tt, fk); tPhaseSet(K.tt, "setup", "tBrainSetup"); K.tt.execTick = tick + Math.round(Math.min(trvF*0.8, 12)*TICK_HZ);
              logEvent("IGL: на "+fk+" не купились, но там один, а у нас их "+hereN+" — фейк становится выходом на "+fk);
              voiceLog("T", "fakereal", "IGL", "на "+fk+" один и не уходит, у нас их "+hereN+" — заходим на "+fk);
            } else logEvent("IGL: на "+fk+" не купились — держит место, играем по плану");
          }
        }
      }
    }
    tProbes(K.tt, K.ts);
    K.ts.forEach(function(b){
      var MF = b._midFlank; if(!MF || MF.round !== roundNum || b === K.fetcher) return; // за бомбой — не на фланг (посты перебивали друг друга каждый тик)
      var CS = MAP.tactics.plays.midTake.ctSide[K.tt.site === "A" ? "A" : "B"];   // куда выходят на стороне CT и куда смотрят
      var st = zonePoint(CS.stage, SITES[K.tt.site]);
      var lk = zonePoint(CS.look, st) || SITES[K.tt.site];
      if(st) setPost(b, pickSpots("midflank"+K.tt.site, st, 2, {team: "T", rMax:150, minGap:40, see:[lk], hideFrom:[SITES[K.tt.site]]})[fl2idx(b)], lk, true, "stage"+K.tt.site+":CTside");
    });
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — ветка строк 588–850 исходного tBrain
function tBrainExecute(K){
  if(K.lurker) lurkerBrain(K.lurker, K.tt, K.other);
    var since = tick - (K.tt.execStart != null ? K.tt.execStart : tick);   // (v380) выход с тика 0 (раш в 1-м раунде матча): 0 — тоже время, не «нет»
    var DELAY = {entry:0, awp:40, support:20, igl:90};
    // раздел 12: две волны. Первая — энтри (+поддержка сразу за ним на трейд,
    // AWP на линии) берёт первый контакт; вторая — IGL и носитель бомбы —
    // заходит на уже зачищенное: через ~0.75с после первого контакта/размена
    // первой волны или через 4.5с, если контакта так и не было. Раш — все сразу.
    var rush = K.tac.style === "rush";
    if(rush && K.tac.rushVia && tick - roundStartTick < 4*TICK_HZ) K.ts.forEach(function(b){ if(b.tRole !== "lurker") startRoute(b, K.tac.rushVia, K.tac.id); });
    if(!rush && !K.tt.wave2){
      var w1 = K.ts.filter(function(b){ return b.tRole === "entry" || b.tRole === "support" || b.tRole === "awp"; });
      var contact = w1.some(function(b){ return b._sawEnemy; }) ||
        teamIntel.T.sig.some(function(sg){ return (sg.type === "kill" || sg.type === "died") && sg.tick >= (K.tt.execStart != null ? K.tt.execStart : 0); });
      if(contact && !K.tt.w1Contact) K.tt.w1Contact = tick;
      if((K.tt.w1Contact && tick - K.tt.w1Contact > 48) || since > 4.5*TICK_HZ || K.ts.length <= 2){
        K.tt.wave2 = tick; logEvent("T: вторая волна заходит на "+K.tt.site+(K.tt.w1Contact ? " (после первого контакта)" : ""));
      }
    }
    var carrier = bomb.state === "carried" ? bomb.carrier : null;
    // (v346, отметка владельца: «выходят до взрыва флешек и гранат») боец у сайта (≤ 700 ед.) не заходит, пока гранаты своих на этот
    // сайт в воздухе; хлопнула / встала — заходит. Ждёт не дольше UTIL_WAIT с (раш — UTIL_WAIT_RUSH) с момента, как начал ждать:
    // числа проектные — по демкам «ждать после последней флешки» разное (0 / 4 / 8 с по вариантам), не правило
    // (v378) за раунд ждёт один раз (v353): ожидание кончилось по любой причине — второй раз в этом раунде не начинается (раньше
    // условие пропадало и появлялось, носитель переключался «ждать гранаты ↔ ставить» каждые ~0,7 с, таймер начинался заново)
    var utilWait = function(b){ var had = !!(b._utilW && b._utilW.round === roundNum), w = utilWait0(b); if(!w && had) b._utilWDone = roundNum;
      if(!w && b.post && b.post.tag === "utilWait"){ b._utilW = null; clearPost(b); } return w; };   // (v349) ждать нечего — пост ожидания снять
    var utilWait0 = function(b){
      // (v350, владелец: «теперь они все останавливаются далеко, а не только пикающий») ждёт только энтри — первый на угол; кто сам
      // несёт гранату — не ждёт
      // (v352, владелец: «донк стоит далеко от будущего контакта») ждёт у самого выхода на сайт — ближе UTIL_AT_ENTRY ед. к входу T
      // (GEO.tEntry + pos.entries), а не в 700 ед. от центра сайта (там он вставал на T Ramp, и остальные уходили вперёд)
      var S0 = SITES[K.tt.site], gE = GEO[K.tt.site], ents = gE ? [gE.tEntry].concat(entryPts(K.tt.site) || []).filter(Boolean) : [];
      var atExit = ents.some(function(q){ return DM.hypot(b.x-q.x, b.y-q.y) <= UTIL_AT_ENTRY; });
      // (v363, владелец: «до гранат на сайт не выходили, а то в чём смысл гранат») гранаты ждёт каждый, кто стоит у выхода на сайт
      // (не только энтри): у про 75 % смоков выхода встают до того, как первый T зашёл на сайт (демки Mirage, 774 раунда с
      // плантом; флешки — 52 %: их кидают под заход, их не ждут). Размен вдвоём — по-прежнему только энтри
      var secW = ROUND_TIME_SEC - (simTime - roundStartTime);
      if(!S0 || !atExit || b.nadeTask || b._utilWDone === roundNum || secW < UTIL_MIN_LEFT){ b._utilW = null; return false; }   // (v353) за раунд ждёт один раз
      // (тактика 30.10) и критичный смок выхода, который ещё не встал (идут кидать / летит / раскрывается — 366), а не только граната в воздухе
      // (Г3, 04.11, разбор отметок п.30: T0 и T3 ждали «смок выхода» у T1, который уже стоял на сайте, — exuGate в тот момент: можно) ждать ли
      // гранаты выхода — одно решение, exuGate (exec-sync: критичные смоки — назначен / летит / раскрывается / не вышел, замена). Убраны вторые
      // правила здесь: «свой несёт лайнап «(выход, …)»» (v349) и «любой смок T в воздухе у сайта»
      var inAir = !exuGate(K.tt).go;
      var mate = b.tRole !== "entry" || K.ts.some(function(o){ return o !== b && o.alive && o.tRole !== "lurker" && nearP(o.x, o.y, o.z, b.x, b.y, b.z, TRADE_R); });
      // (v555, отметка владельца м300 р3: «ждёт гранаты, когда он один») размен ждать не от кого — живых своих нет (кроме лёрка): не ждёт
      var anyMate = K.ts.some(function(o){ return o !== b && o.alive && o.tRole !== "lurker"; });
      if(!inAir && (mate || !anyMate)){ b._utilW = null; return false; }
      if(!mate && !inAir && !(b._utilW && b._utilW.round === roundNum)) voiceLog("T", "tradewait"+b.id+roundNum, b.id, "жду, выходим вдвоём");
      // (v349, отметка владельца: donk ждал на выходе с T Ramp на виду у NiKo — бой начинался раньше гранат) ждёт в ближайшем
      // укрытии (≤ 150 ед.: не видно с сайта, опорника и входа CT), а не там, где застала проверка
      if(!b._utilW || b._utilW.round !== roundNum){ var g0 = GEO[K.tt.site], hf = [S0, g0 && g0.anchor, g0 && g0.ctEntry].filter(Boolean);
        // (v353, владелец: «донк ждёт там, где его могут убить со Stairs») укрытие — и от мест, где CT держат этот сайт (pos.ctHold/ctSecond)
        var PC = POS[K.tt.site] || {}; (PC.ctHold || []).concat(PC.ctSecond || []).forEach(function(n){ var zp = zonePoint(n, S0); if(zp) hf.push(zp); });
        // (v350) там, где стоит, его не видно — ждёт на месте; видно — в ближайшее укрытие до 80 ед. (было 150 — отходил далеко)
        var seen = hf.some(function(q){ return hasLOS(b.x, b.y, q.x, q.y, b.z); });
        var cov = seen ? pickSpots("utilw"+Math.round(b.x/30)+","+Math.round(b.y/30)+K.tt.site, {x:b.x, y:b.y}, 1, {team: "T", rMax:80, minGap:20, hideFrom:hf})[0] : null;
        if(cov && hf.some(function(q){ return hasLOS(cov.x, cov.y, q.x, q.y); })) cov = null;
        b._utilW = {round: roundNum, t: tick, x: cov ? cov.x : b.x, y: cov ? cov.y : b.y}; }
      // (v485) предел UTIL_WAIT — и для критичного смока: без предела (v481) носитель дольше висел «ждать гранаты ↔ ставить» (прогон 133,
      // Ancient: tug с utilWait 8,7 → 12,1 на 100 раундов, «plantspot → utilWait → plantspot» 3,0). Ждёт ли команда смоков — решает exuGate
      var waitOn = tick - b._utilW.t < (rush ? UTIL_WAIT_RUSH : UTIL_WAIT)*TICK_HZ;
      // (v353, владелец: «в 351 знали про CT, но чего-то ждали и не выходили») ждал до предела — больше в этом раунде не ждёт: раньше
      // условие то пропадало, то появлялось, таймер начинался заново, и выход откладывался без конца
      if(!waitOn) b._utilWDone = roundNum;
      // ждёт — стоит, где начал ждать (прицел на сайт); раньше выданный пост (зачистка угла) иначе вёл его дальше под гранаты
      // (v378) носитель ещё не готов ставить (ждёт гранаты выхода) — свою же задачу плана «ставить» план и снимает: иначе
      // «ставить» (важнее ожидания по таблице арбитра) держала пост, а «готов» не наступало — бот переключался туда-обратно
      if(waitOn && b.post && b.post.tag === "plantspot" && !b.planting) clearPost(b);
      if(waitOn && b.post && b.post.tag === "utilWait") postKeep(b);
      else if(waitOn) setPost(b, {x:b._utilW.x, y:b._utilW.y}, S0, true, "utilWait");
      return waitOn;
    };
    var ready = function(b){
      if(b.tRole !== "lurker" && utilWait(b)) return false;
      // энтри под флешку от тиммейта: входит в угол сразу после хлопка (≤0.5с),
      // а если флешки не будет/не долетела за 3с — идёт без неё
      if(b.tRole === "entry" && nadeFlags.peekFlashPlanned){
        // (тактика 30.10) флешка уже летит — ждёт хлопка (когда — знает физика броска: etaDet), а не уходит по 3 с, пока она в воздухе
        var popped = nadeFlags.peekFlashPop && tick - nadeFlags.peekFlashPop >= 0;
        var flying = nadesInAir.some(function(n){ return n.team === "T" && n.type === "flash" && n.why === "под пик"; });
        return popped || (since > 3*TICK_HZ && !flying);
      }
      if(!rush && (b.tRole === "igl" || (b === carrier && b.tRole !== "entry"))) return !!K.tt.wave2;
      return since >= (DELAY[b.tRole] !== undefined ? DELAY[b.tRole] : 60);
    };
    if(carrier && carrier.alive && !carrier.planting && ready(carrier)){
      // выбор точки — когда носитель уже на подходе к сайту (по ситуации в этот момент)
      if(!K.tt.plantPick && DM.hypot(carrier.x-K.site.x, carrier.y-K.site.y) < 500) choosePlant(K.tt);
      // (v272, пункт 3, просьба владельца 13.10) с бомбой на плант — не в одиночку (как за бомбой — fetchCover): рядом нет
      // своего, который тоже заходит (≤ TRADE_R), — ближайший свой не на сайте и не в бою идёт к носителю и заходит с ним
      // (войс), носитель ждёт его. Идёт один, только если своих нет, все уже на сайте (идёт к ним) или время поджимает
      // (дойти + поставить + 5 с запаса — проектное число). У про носитель за 10 с до планта один (нет своего ≤350 px)
      // 5 % времени, у ботов v269 — 13–16 % (88 демок; tools/measure/audit/carrier_plant.py)
      var ppt = K.tt.plantPick ? K.tt.plantPick.pt : K.plantPt;
      var cm = K.ts.filter(function(o){ return o !== carrier && o.alive && o.tRole !== "lurker"; });
      var cLeft = ROUND_TIME_SEC - (tick - roundStartTick)/TICK_HZ, cWalk = polyLen(pathPts(carrier.x, carrier.y, ppt.x, ppt.y, carrier.z))/SPEED + PLANT_TICKS/TICK_HZ + 5;
      var BE = K.tt.bombEsc && K.tt.bombEsc.round === roundNum && K.tt.bombEsc.cid === carrier.id ? K.tt.bombEsc : null;
      // (п.21 владельца 29.10, м1 р5 т37570: «почему бы не отложить выход… пока игрок 2 не сможет выйти с паласа, чтобы сыграть вдвоём» —
      // TN1R у огня в Palace увидел врага, и magixx в тот же тик пошёл ставить один) назначенный сопровождающий в бою — всё ещё сопровождающий:
      // носитель ждёт его в пределах того же времени ожидания / ESC_MAX_SEC (раньше бой снимал сопровождение сразу)
      var esc = BE ? cm.filter(function(o){ return o.id === BE.id && !o.planting; })[0] : null;
      if(!esc && !cm.some(function(o){ return ready(o) && nearP(o.x, o.y, o.z, carrier.x, carrier.y, carrier.z, TRADE_R); }) && cLeft >= cWalk){
        esc = cm.filter(function(o){ return !o._sawEnemy && !o.planting && !o.nadeTask && !tradeGoing(o) && !(tick < taskKeepUntil(o, "repos")) && DM.hypot(o.x-ppt.x, o.y-ppt.y) > 350; })
          .sort(function(a, c){ return DM.hypot(a.x-carrier.x, a.y-carrier.y) - DM.hypot(c.x-carrier.x, c.y-carrier.y); })[0] || null;
        // (v342, отметка владельца: magixx с бомбой ждал у B «сопровождение» с A — через всю карту) сопровождающий — не дальше
        // ESC_MAX_SEC бега до носителя; иначе носитель идёт ставить сам
        if(esc && pathLenTo(esc, carrier.x, carrier.y)/SPEED > ESC_MAX_SEC) esc = null;
        if(esc){ BE = K.tt.bombEsc = {round: roundNum, cid: carrier.id, id: esc.id, since: tick}; voiceLog("T", "besc"+carrier.id, esc.id, "иду к бомбе — "+carrier.id+", заходим вместе"); }
      }
      // (v342) ждать сопровождение — не дольше времени по ситуации (ниже) и только если он не дальше ESC_MAX_SEC бега (проверка каждые 0,5 с;
      // проектные числа: в демках про — только доля «носитель один», 5 %)
      // (v359, отметка владельца: magixx с бомбой ждал на T Ramp ~10 с, сопровождающий кидал лайнап, а на A уже никого) сайт по
      // знанию пуст (на сайте и у него < 0,5 CT по карте команды) или сопровождающий занят гранатой — не ждём, идём ставить
      if(esc && (beliefCount("T", BZ.siteNear[K.tt.site]||[]) < 0.5 || esc.nadeTask)) esc = null;
      if(esc && BE){ if(BE.since == null) BE.since = tick;
        if(tick - (BE.lenT || -1e9) >= 32){ BE.lenT = tick; BE.far = pathLenTo(esc, carrier.x, carrier.y)/SPEED > ESC_MAX_SEC; }
        // (00_PLAN, пакет тактики, ответ владельца 10 от 04.11: «не 8 с для всех: рядом 1,5–2,5; сопровождающий в бою 2–3; опасный проход
        // 2–3,5; ждём гранаты 3–4,5; 8 с — только при явном «держим»») сколько ждать — по ситуации, середины диапазонов (проектные числа ответа)
        var escW = !exuGate(K.tt).go ? 3.75 : siteAssess("T", K.tt.site).near >= 1 ? 2.75 : esc._sawEnemy ? 2.5 : 2.0;
        if(BE.far || tick - BE.since > escW*TICK_HZ) esc = null; }
      if(esc && cLeft >= cWalk){
        var lnE = DM.hypot(ppt.x-carrier.x, ppt.y-carrier.y) || 1, ePt = walk({x: carrier.x + (ppt.x-carrier.x)/lnE*Math.min(90, lnE), y: carrier.y + (ppt.y-carrier.y)/lnE*Math.min(90, lnE)});
        if(!(esc.post && esc.post.tag === "bombEscort" && DM.hypot(postSrc(esc).x-ePt.x, postSrc(esc).y-ePt.y) < 80)) setPost(esc, ePt, K.g.ctEntry, true, "bombEscort");
        else postKeep(esc);
        esc._probeLock = tick;
        if(nearP(esc.x, esc.y, esc.z, carrier.x, carrier.y, carrier.z, TRADE_R)) setPost(carrier, ppt, K.g.ctEntry, true, "plantspot");   // (v532) напарник рядом — по пути
        else if(carrier.post && carrier.post.tag === "bombWait") postKeep(carrier);
        else setPost(carrier, {x:carrier.x, y:carrier.y}, esc, true, "bombWait");
      } else setPost(carrier, ppt, K.g.ctEntry, true, "plantspot");
    }
    // (п.4 владельца 29.10, м1 р2: «перекол на другой сайт, но туда идут не все») носитель ещё не готов ставить (ждёт вторую волну), а
    // поста нет — после перекола пост старого сайта снят (tSetSite): к точке подготовки нового сайта, как остальные (раньше 3,5 с стоял)
    else if(carrier && carrier.alive && !carrier.planting && !carrier.post) stagePost([carrier], K.tt.site);
    var rest = K.pick(["entry","awp","support","igl"]).filter(function(b){ return b !== carrier && ready(b); });
    // (v350, владелец: «все останавливаются далеко») раш: кто без задачи (поддержка, IGL; AWP без лайнапа) — идёт за энтри и держится
    // позади него (60–110 ед., проектные числа), а не стоит на месте сбора; энтри ждёт гранаты — ждут за ним
    if(rush){ var eB = K.ts.filter(function(o){ return o.tRole === "entry" && o.alive; })[0];
      if(eB) K.ts.forEach(function(o){ if(o === eB || !o.alive || (o === carrier && DM.hypot(o.x-K.site.x, o.y-K.site.y) < 450) || o.tRole === "lurker" || o.nadeTask || o._sawEnemy || (o.post && !taskProp(o.post.tag, "rushFollowable"))) return;   // (v368) носитель — тоже за энтри, в группе, пока не у сайта   // (v352) и пост маршрута — иначе вставал на старой точке маршрута
        var dx = o.x-eB.x, dy = o.y-eB.y, dl = DM.hypot(dx, dy) || 1, k = Math.min(110, Math.max(60, dl));
        var fp = walk({x: eB.x + dx/dl*k, y: eB.y + dy/dl*k});
        // (v353, владелец: «тнир бежит и умирает, а донк ждёт») энтри ждёт — остальные стоят за ним (маршрут раша на паузе)
        if(eB.post && eB.post.tag === "utilWait"){
          if(o.post && o.post.tag === "utilHold" && DM.hypot(postSrc(o).x-eB.x, postSrc(o).y-eB.y) < 160) return;
          var hfF = [SITES[K.tt.site], GEO[K.tt.site].anchor, GEO[K.tt.site].ctEntry].filter(Boolean), PCf = POS[K.tt.site] || {};
          (PCf.ctHold || []).concat(PCf.ctSecond || []).forEach(function(n){ var zp = zonePoint(n, SITES[K.tt.site]); if(zp) hfF.push(zp); });
          var hp = pickSpots("uhold"+o.id+Math.round(fp.x/30)+","+Math.round(fp.y/30), fp, 1, {team: "T", rMax:90, minGap:24, hideFrom:hfF})[0];
          if(hp && hfF.some(function(q){ return hasLOS(hp.x, hp.y, q.x, q.y); })) hp = null;
          setPost(o, hp || fp, SITES[K.tt.site], true, "utilHold"); return; }   // за энтри — в укрытии от мест CT (v353)
        if(o.post && o.post.tag === "rushFollow" && DM.hypot(postSrc(o).x-fp.x, postSrc(o).y-fp.y) < 40) return;   // не дёргать путь каждый тик; (v570) сверка — с точкой задачи (src): пост, сдвинутый раздвиганием на 80, «далеко» всегда — путь ставился каждый тик
        if(o.post && taskProp(o.post.tag, "onRoute") && o._route && o._route.pts[o._route.idx] && DM.hypot(o.post.x-o._route.pts[o._route.idx].x, o.post.y-o._route.pts[o._route.idx].y) < 40) return;   // идёт по маршруту к текущей точке
        setPost(o, fp, SITES[K.tt.site], true, "rushFollow"); }); }
    // (S5) ставят — двое ближних прикрывают подходы к ставящему под разными углами
    if(carrier && carrier.alive && (carrier.planting || (carrier.post && carrier.post.tag === "plantspot" && DM.hypot(carrier.x-carrier.post.x, carrier.y-carrier.post.y) < 90))){
      // (v409, владелец 22.10: «coverplant очень часто меняется, бегают по всему сайту») точки искались каждый тик вокруг того места, где
      // ставящий сейчас (он шёл — набор точек менялся), а какая кому — по тому, кто сейчас ближе (порядок переворачивался — менялись
      // местами): м1 р1 Mirage — ≈ 40 смен точки у двоих за 10 с. Теперь центр — точка планта (не сам ставящий), точки выбираются
      // один раз, кто взял — держит до конца прикрытия; второго добирают, только если прикрывающих меньше двух
      var cp0 = carrier.planting ? {x:carrier.baseX, y:carrier.baseY} : {x:carrier.post.x, y:carrier.post.y};
      var CV = K.tt._cov; if(!CV || CV.round !== roundNum || DM.hypot(CV.x-cp0.x, CV.y-cp0.y) > 90) CV = K.tt._cov = {round:roundNum, x:cp0.x, y:cp0.y, by:{}};
      // (v521, отметка владельца 10.11 м200 р1: двое T стояли на Tetris, пока sh1ro ставил, — «могут пройти в сайт и занять позицию») прикрытие
      // планта — той же системой, что пост-плант (holdGroup): все, кто рядом с точкой планта, видят её и держат разные входы (неизвестный
      // враг может прийти любым — HOLD.anyW, знание сверху). Было: двое ближних на два заданных входа (вход CT, место опорника)
      var okCov = function(b){ return !b._sawEnemy && DM.hypot(b.x-CV.x, b.y-CV.y) < 550 && !tradeGoing(b); };
      var covs = rest.filter(okCov);
      if(covs.length) holdGroup(covs, {key:"cp"+K.tt.site+Math.round(CV.x/30)+","+Math.round(CV.y/30), center:{x:CV.x, y:CV.y}, rArea:320, rMin:60, rMax:420, must:[{x:CV.x, y:CV.y}], anyFrom:true}, "coverplant");
      if(covs.length && !K.tt._covVoice){ K.tt._covVoice = tick; voiceLog("T", "covplant", covs[0].id, "ставь, прикрываю"+(covs[1] ? " с "+covs[1].id : "")); }
      rest = rest.filter(function(b){ return covs.indexOf(b) < 0; });
    }
    K.ts.forEach(function(b){
      if(!K.isMF(b) || b === carrier || b.planting || b === K.fetcher) return; // за бомбой — не держать сайт (раньше посты чередовались и он стоял)
      var bestN = null, bdd = Infinity;
      POS[K.tt.site].tClear.forEach(function(n){ var zp = zonePoint(n, b); if(!zp) return; var d = DM.hypot(zp.x-b.x, zp.y-b.y); if(d < bdd){ bdd = d; bestN = n; } });
      var fp = bestN ? namedSpot(bestN, b, {team: "T", see:[K.g.tEntry, K.plantPt], key:"mf"+K.tt.site}) : K.plantPt;
      setPost(b, fp, K.plantPt, true, "sitehold"+K.tt.site+":CT-"+(bestN||""));
    });
    // раздел 12: "байт и трейд" — пока энтри лезет в первый угол, поддержка не
    // бежит на сайт рядом с ним, а стоит у входа с прицелом туда же: убьют
    // энтри — стрелок уже виден ей и она сразу разменивает
    var entryB = K.ts.filter(function(b){ return b.tRole === "entry"; })[0];
    if(!rush && entryB && !entryB.atPost && since < 5*TICK_HZ){
      rest.filter(function(b){ return b.tRole === "support" && !(b._stageInfo && b._stageInfo.round === roundNum && DM.hypot(b._stageInfo.from.x-K.g.tStage.x, b._stageInfo.from.y-K.g.tStage.y) > 250); }).forEach(function(b){ setPost(b, K.g.tEntry, K.g.anchor, true, "trade"+K.tt.site, 1); rest = rest.filter(function(o){ return o !== b; }); });
    }
    // занять сайт: энтри, поддержка и IGL — каждый на свою названную позицию
    // (Back Site, Triple Box, 90, Second Lane…), ближайшую к тому, откуда он зашёл
    // кто ждал выхода на своей точке с другой стороны (Donut, Dark, CT Lane…) —
    // тоже занимает ближние к себе позиции сайта, а не бежит к стандартному входу
    var sideT = rest.filter(function(b){ var SI = b._stageInfo; return SI && SI.round === roundNum && DM.hypot(SI.from.x-K.g.tStage.x, SI.from.y-K.g.tStage.y) > 250; });
    // (v469, п.1 владельца 29.10, р2 м1: sh1ro с MAC-10 получал «AWP линия») снайпер без AWP — обычный игрок захода: линия AWP — только с AWP
    var takers = rest.filter(function(b){ var r = K.roleT(b); return r==="entry" || r==="support" || r==="igl" || (r==="awp" && b.primary!=="AWP") || sideT.indexOf(b) >= 0; });
    rest = rest.filter(function(b){ return sideT.indexOf(b) < 0; });
    // распределять точки — когда смоки выхода уже встали (≤1.5с) — чтобы
    // занимать места, которые дым закрывает от CT
    var smokeUp = smokes.some(function(sm){ return DM.hypot(sm.x-K.g.ctEntry.x, sm.y-K.g.ctEntry.y) < 300 || DM.hypot(sm.x-K.site.x, sm.y-K.site.y) < 320; });
    if(takers.length && (smokeUp || since > 1.5*TICK_HZ || rush)){
      if(!K.tt.takeAssign) K.tt.takeAssign = {};
      K.used = {};
      Object.keys(K.tt.takeAssign).forEach(function(id){ K.used[K.tt.takeAssign[id]] = true; });
      takers.forEach(function(b){
        var nm = K.tt.takeAssign[b.id];
        if(!nm){
          var best = null, bd = Infinity;
          POS[K.tt.site].tClear.forEach(function(n){ if(K.used[n]) return; var zp = zonePoint(n, K.site); if(!zp) return;
            var d = DM.hypot(zp.x-b.x, zp.y-b.y);
            // точка, которую смок закрывает от входа CT/опорника, — "занимаем под смок"
            if(smokeUp && (smokeBlocks(zp.x, zp.y, K.g.ctEntry.x, K.g.ctEntry.y) || smokeBlocks(zp.x, zp.y, K.g.anchor.x, K.g.anchor.y))) d -= 260;
            if(d < bd){ bd = d; best = n; } });
          nm = best; if(nm){ K.tt.takeAssign[b.id] = nm; K.used[nm] = true;
            if(smokeUp && !K.tt._smokeTakeLog){ K.tt._smokeTakeLog = true; logEvent("T: смоки встали — занимают позиции под смоком ("+nm+")"); } }
        }
        var tp = nm ? namedSpot(nm, K.site, {team: "T", see:[K.g.ctEntry], key:"take"+K.tt.site}) : null;
        // энтри чистит углы по очереди: ближний угол → следующий от него, на
        // каждом короткий чек (~0.5с); чисто — колл "чекнул X — пусто" и дальше
        if(b.tRole === "entry" && !rush){
          var C = b._clr;
          if(!C || C.round !== roundNum || C.site !== K.tt.site){
            var left = POS[K.tt.site].tClear.slice(), from = {x:b.x, y:b.y}, list = [];
            while(left.length && list.length < 3){
              var bi = -1, bdd = Infinity;
              left.forEach(function(n, i){ var zp = zonePoint(n, K.site); if(!zp) return; var dd = DM.hypot(zp.x-from.x, zp.y-from.y); if(dd < bdd){ bdd = dd; bi = i; } });
              if(bi < 0) break; var nn = left.splice(bi, 1)[0]; list.push(nn); from = zonePoint(nn, K.site) || from;
            }
            C = b._clr = {round:roundNum, site:K.tt.site, list:list, i:0, arr:0};
          }
          if(C.list.length){
            var cur = C.list[Math.min(C.i, C.list.length-1)];
            var cp = namedSpot(cur, K.site, {team: "T", see:[K.g.ctEntry], key:"clr"+K.tt.site});
            var nxt = C.list[C.i+1] ? zonePoint(C.list[C.i+1], K.site) : null;
            if(cp){
              if(b.atPost && b.post && b.post.tag === "clear"+K.tt.site+":"+cur && C.i < C.list.length){
                if(!C.arr) C.arr = tick;
                if(tick - C.arr > 32 && !b._sawEnemy){ markClear("T", cp.x, cp.y, b.id); C.i++; C.arr = 0; }
              }
              setPost(b, cp, nxt || K.g.ctEntry, true, "clear"+K.tt.site+":"+cur);
              return;
            }
          }
        }
        // (v370, владелец: «выходят — просто стоят и стреляют, не протягивают выход дальше по зонам») занял точку на сайте и там
        // тихо TAKE_ADV с (не видит врага, не стрелял, нет свежего контакта) — переходит на следующую свободную точку глубже, к
        // стороне CT (ближе к входу CT на TAKE_STEP+, не дальше TAKE_REACH от нынешней), из мест, где T стоят на сайте по демкам
        // (pos.tClear + pos.tPost). Так выход растягивается по зонам до входа CT. Проектные числа
        if(tp && nm){
          var TA = b._takeAt; if(!TA || TA.nm !== nm || TA.round !== roundNum) TA = b._takeAt = {nm:nm, round:roundNum, arr:0};
          if(b.atPost && !TA.arr) TA.arr = tick;
          var calmT = !b._sawEnemy && tick - (b._shotAtT||-1e9) > 2*TICK_HZ && tick - (b.lastShotTick||-1e9) > 2*TICK_HZ && !(b._contact && tick < b._contact.until);
          if(TA.arr && calmT && tick - TA.arr > TAKE_ADV*TICK_HZ){
            var cz = zonePoint(nm, K.site), dC = cz ? DM.hypot(cz.x-K.g.ctEntry.x, cz.y-K.g.ctEntry.y) : 0, nx2 = null, bn = Infinity;
            var pool = (POS[K.tt.site].tClear || []).concat(POS[K.tt.site].tPost || []).filter(function(n, i, a){ return a.indexOf(n) === i; });
            if(cz) pool.forEach(function(n){ if(K.used[n] || n === nm) return; var zp = zonePoint(n, K.site); if(!zp) return;
              if(DM.hypot(zp.x-K.g.ctEntry.x, zp.y-K.g.ctEntry.y) > dC - TAKE_STEP) return; var dz = DM.hypot(zp.x-cz.x, zp.y-cz.y); if(dz > TAKE_REACH) return;
              if(dz < bn){ bn = dz; nx2 = n; } });
            if(nx2){ delete K.used[nm]; K.used[nx2] = true; K.tt.takeAssign[b.id] = nx2; voiceLog("T", "adv"+b.id+nx2+roundNum, b.id, "чисто, иду "+calloutName(zonePoint(nx2, K.site).x, zonePoint(nx2, K.site).y)); nm = nx2;
              tp = namedSpot(nm, K.site, {team: "T", see:[K.g.ctEntry], key:"take"+K.tt.site}); b._takeAt = {nm:nm, round:roundNum, arr:0}; }
            else TA.arr = tick + 10*TICK_HZ;   // глубже некуда — держит
          }
        }
        if(tp) setPost(b, tp, K.g.ctEntry, true, (b.tRole === "entry" ? "clear" : "sitehold")+K.tt.site+":"+nm);
        else groupPost([b], K.plantPt, K.g.ctEntry, "sitehold"+K.tt.site, {team: "T", rMin:40, rMax:210, minGap:60, see:[K.g.ctEntry]});
      });
    }
    groupPost(rest.filter(function(b){ return b.tRole==="awp" && b.primary==="AWP"; }), K.g.tEntry, K.g.ctEntry, "awpline"+K.tt.site, {team: "T", rMax:130, minGap:50, see:[K.g.ctEntry, K.plantPt]});
}
