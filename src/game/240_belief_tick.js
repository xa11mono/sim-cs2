// вызывается из intelPush: последняя реальная инфа по врагу (когда, где) и тайминги REACH.
// Саму карту belief больше не правит — она собирается из гипотез ботов (beliefTick)
function beliefObserve(team, sg){
  if(!BZ.ids.length) return;
  if((sg.type === "spotted" || sg.type === "sound") && sg.id && sg.id !== "?"){
    reachOpen(team, sg.x, sg.y);
    beliefSeen[team][sg.id] = tick;
    var bl = beliefLast[team][sg.id];
    if(!(bl && bl.src === "spotted" && sg.type === "sound" && tick - bl.tick < 2*TICK_HZ)) beliefLast[team][sg.id] = {x:sg.x, y:sg.y, tick:tick, src:sg.type};
  }
}
var BELIEF_STEP = 16; // тиков (0.25с)
// (v354) ПАМЯТЬ МАТЧА ПО ИГРОКАМ: где команда первый раз в раунде видела или слышала каждого соперника (до планта) — сторона
// карты: ближайший сайт в PM_SITE_R ед. (Short — B, Palace — A), иначе мид. Только то, что команда сама знала (beliefLast) — не
// подсказка игры. Свой счёт на каждый матч и каждую сторону соперника (после смены сторон — заново)
var PLAYER_MEM = {key: null, by: {}}, PM_SITE_R = 700, PM_MIN = 2, PM_GAIN = 2;   // проектные числа
function pmRegion(pt){ var best = "M", bd = PM_SITE_R; ["A","B"].forEach(function(k){ var d = Math.hypot(pt.x-SITES[k].x, pt.y-SITES[k].y); if(d < bd){ bd = d; best = k; } }); return best; }
function pmBook(team, e){ var k = matchNum; if(PLAYER_MEM.key !== k){ PLAYER_MEM = {key: k, by: {}}; } var id = team+">"+e.team+":"+e.id; return PLAYER_MEM.by[id] || (PLAYER_MEM.by[id] = {A:0, B:0, M:0, n:0, last:-1}); }
function pmNote(team, e, bl){
  if(!bl || bl.tick < roundStartTick || (bomb && bomb.state === "planted")) return;
  var R = pmBook(team, e); if(R.last === roundNum) return;
  R.last = roundNum; R[pmRegion(bl)]++; R.n++;
}
function pmWeight(team, e, pt){
  if(!e || !pt) return 1; var R = pmBook(team, e); if(R.n < PM_MIN) return 1;
  return 1 + PM_GAIN * R[pmRegion(pt)] / R.n;
}
function beliefTick(){
  if(roundState !== "live" || tick % BELIEF_STEP !== 0 || !BZ.ids.length) return;
  // (этап 2) карта команды = гипотезы знания команды (teamAgent; раньше, с v240, — среднее по живым тиммейтам): held — точка,
  // moved — где бегущий враг был бы сейчас на своём маршруте, moved_unknown — поровну по
  // типичным местам врага, куда он уже мог дойти (проверенные — ноль). Сама по себе (без события) карта не растекается
  var n = BZ.ids.length, key = matchNum + ":" + roundNum;
  ["CT","T"].forEach(function(team){
    var B = belief[team];
    PORTAL_W[team] = portalWatched(team);
    // (этап 2, P1-2) карта команды — из знания команды (teamAgent: радар, войс, киллфид), не из личных гипотез тиммейтов
    var mates = [teamAgent(team)];
    Object.keys(B).forEach(function(eid){
      var e = bots.filter(function(o){ return o.id === eid; })[0];
      if(!e || !e.alive){ delete B[eid]; return; } // смерть врага видна в киллфиде
      var Q = new Float32Array(n), k = 0;
      mates.forEach(function(m){
        var H = m.know.enemies[eid]; if(!H) return; k++;
        H.hyps.forEach(function(h){
          if(h.type === "moved_unknown"){
            // доля на место — от ВСЕХ мест, куда враг уже мог дойти: проверенные (закрытые) свою долю
            // просто теряют, а не перекладывают на непроверенные (иначе вес «где не смотрел» рос бы сам)
            var S = m.know.spots.filter(function(p){ return knowSpotReach(p) && BZ.idx[p.zone] !== undefined; });
            // (v354, владелец: «по никам должны понимать, где примерно игрок — жив kyousuke, а он игрок B, значит скорее всего он там»)
            // доля места — по памяти матча: где этого игрока видели/слышали в прошлых раундах за эту сторону (pmWeight)
            var WS = S.map(function(p){ return pmWeight(team, e, BZ.cent[BZ.idx[p.zone]]); }), WT = WS.reduce(function(a, c){ return a + c; }, 0) || 1;
            S.forEach(function(p, si){ if(p.open) Q[BZ.idx[p.zone]] += h.weight*WS[si]/WT; });
            return;
          }
          knowHypSpread(h, H).forEach(function(q){ Q[q[0]] += q[1]; });
        });
      });
      if(k > 1) for(var i=0;i<n;i++) Q[i] /= k;
      B[eid] = Q;
      // «слышали здесь» — только сказанное в войс (h.voice): вес гипотезы ≥ 0,35 (порог v166 beliefMassNear) —
      // последняя реальная инфа по этому врагу; «кто» — вывод знания (какой враг это объясняет), не подсказка игры.
      // (аудит 11.10) раньше бралось и то, что тиммейт слышал сам и не сказал: общая точка команды (beliefLast) получала
      // услышанное одним ботом без войса ~8 раз за раунд, и в 42 % случаев другой тиммейт сразу смотрел туда
      var hb = null;
      mates.forEach(function(m){ var H = m.know.enemies[eid]; if(!H || H.visible) return;
        H.hyps.forEach(function(h){ if(h.heard && h.voice && h.htick && h.weight >= 0.35 && (!hb || h.htick > hb.htick)) hb = h; }); });
      var bl = beliefLast[team][eid];
      pmNote(team, e, bl);   // (v354) память матча: где этого игрока первый раз в раунде видели/слышали
      if(hb && (!bl || hb.htick > bl.tick) && !(bl && bl.src === "spotted" && hb.htick - bl.tick < 2*TICK_HZ)){
        beliefLast[team][eid] = {x:hb.x, y:hb.y, tick:hb.htick, src:"sound"}; beliefSeen[team][eid] = hb.htick;
        reachOpen(team, hb.x, hb.y); lkpSet(team, eid, hb.x, hb.y, "sound");
      }
    });
    // что видят живые тиммейты — тайминги REACH (может ли там уже кто-то быть)
    var clearAll = [];
    bots.forEach(function(b){
      if(!b.alive || b.team !== team || (b._visible||[]).length) return;
      var zb = bzOf(b.x, b.y); if(zb < 0) return;
      clearAll.push([zb, 0.92]);
      var W = ZONE_DANGER_W[BZ.ids[zb]] || {};
      (ZONE_DANGER[BZ.ids[zb]]||[]).forEach(function(zid){
        var j = BZ.idx[zid]; if(j === undefined) return;
        var c = BZ.cent[j], d = Math.hypot(c.x-b.x, c.y-b.y);
        if(d > CONE_R*1.4) return;
        if(!inFov(b, c.x, c.y) && d > FOV_NEAR*2) return;
        clearAll.push([j, Math.min(0.9, 0.35 + 0.9*(W[zid]||0))]);
      });
    });
    reachStep(team, clearAll);
    var CLT = LAST_CLEAR[team] || (LAST_CLEAR[team] = {}); clearAll.forEach(function(cz){ if(cz[1] >= 0.5) CLT[cz[0]] = tick; });
  });
}
// сколько врагов команда ожидает в наборе зон (сумма по всем живым врагам)
function beliefMass(team, zoneList){
  var B = belief[team], tot = 0;
  Object.keys(B).forEach(function(eid){ var P = B[eid]; zoneList.forEach(function(i){ tot += P[i]; }); });
  return tot;
}
// "сколько их там" для колла: враги, по которым была свежая инфа (≤10с), —
// всей своей вероятностью; остальные ("куда-то идут") — только малой долей,
// иначе априорный дрейф к сайтам сам по себе раздувал бы колл до 3-4
function beliefCount(team, zoneList){
  var B = belief[team], tot = 0;
  Object.keys(B).forEach(function(eid){
    var P = B[eid], pe = 0; zoneList.forEach(function(i){ pe += P[i]; });
    var fresh = tick - (beliefSeen[team][eid] == null ? -1e9 : beliefSeen[team][eid]) < 10*TICK_HZ;
    tot += fresh ? pe : 0.25*pe;
  });
  return tot;
}
function beliefZone(team, i){ var B = belief[team], t = 0; Object.keys(B).forEach(function(eid){ t += B[eid][i]; }); return t; }
// как beliefZone, но дисконтирует "чистый прогноз" (никогда/давно не видели
// этого врага живьём) — иначе идле-боты стоят пред-прицелившись точно в
// статистически вероятную клетку так, будто реально знают, где враг, хотя
// это просто "скорее всего туда пошёл" без единого реального контакта
function beliefZoneFresh(team, i){
  var B = belief[team], seen = beliefSeen[team], t = 0;
  Object.keys(B).forEach(function(eid){
    var fresh = tick - (seen[eid] == null ? -1e9 : seen[eid]) < 10*TICK_HZ;
    t += B[eid][i] * (fresh ? 1 : 0.3);
  });
  return t;
}
