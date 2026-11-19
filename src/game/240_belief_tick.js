// вызывается из intelPush: последняя реальная инфа по врагу (когда, где) и тайминги REACH.
// Саму карту belief больше не правит — она собирается из гипотез ботов (beliefTick)
function beliefObserve(team, sg){
  if(!BZ.ids.length) return;
  if((sg.type === "spotted" || sg.type === "sound") && sg.id && sg.id !== "?" && !(teamBot(sg.id) && !teamBot(sg.id).alive)){   // (v519) убитый — не «где он сейчас»
    reachOpen(team, sg.x, sg.y, sg.id);
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
// раскладка знания (гипотез) m о враге eid по зонам: held — точка, moved — где бегущий был бы сейчас на маршруте, moved_unknown — по типичным
// местам, куда уже мог дойти (проверенные — ноль). Для карты команды (m = teamAgent) и для своей головы бота (b._belOwn)
function beliefKnowQ(team, m, eid, e, n){
  var Q = new Float32Array(n), H = m.know.enemies[eid]; if(!H) return Q;
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
  return Q;
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
      if(!e || !e.alive){ delete B[eid]; delete beliefLast[team][eid]; return; } // смерть врага видна в киллфиде; (v519, пак 09.11 п.10) и его «где видели последний раз» — тоже
      var Q = beliefKnowQ(team, mates[0], eid, e, n);
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
        reachOpen(team, hb.x, hb.y, eid); lkpSet(team, eid, hb.x, hb.y, "sound");
      }
    });
    // (владелец 18.11: «что ещё должно идти в угрозу, кроме войса?» — своя голова) у каждого бота — своё знание (что сам слышал / видел / откуда
    // по нему попали): по врагу, о котором его инфа свежее, чем у команды (не сказал / ещё не дошло), — его раскладка по зонам (b._belOwn), для
    // его взгляда (260: beliefZoneKnown при LOOK_BEL_BOT). Стареет по той же кривой про (knowAge), что и знание команды
    var TA = mates[0];
    bots.forEach(function(b){ if(b.team !== team) return; b._belOwn = null; if(!b.alive || !b.know || b.know.key !== key) return;
      for(var eid in B){ var Ho = b.know.enemies[eid], Ht = TA.know.enemies[eid]; if(!Ho || !Ho.last || Ho.visible) continue;
        var to = Ho.last.tick, tt = Ht && Ht.last ? Ht.last.tick : -1e9;
        Ho.hyps.forEach(function(h){ if(h.heard && h.htick > to) to = h.htick; });
        if(Ht) Ht.hyps.forEach(function(h){ if(h.heard && h.htick > tt) tt = h.htick; });
        if(to <= tt) continue;
        (b._belOwn || (b._belOwn = {}))[eid] = beliefKnowQ(team, b, eid, bots.filter(function(o){ return o.id === eid; })[0], n); } });
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
// ======================= (владелец 19.11) ГДЕ ВРАГ ПО ЗНАНИЮ КОМАНДЫ — одно место для решений, без срока =======================
// «Информация держится, пока её не опровергнут: говорим, что он там, даже если долго не пикает, пока не появится в другом месте» (гайды: колл
// живёт до нового колла; IGL помнит, где кого видели; docs/PRO_PLAY.md). Было: решения брали «последнее, где видели» (beliefLast) и отрезали
// по таймеру (2, 4, 5, 8, 10, 12, 15 с — у каждого места своё) — через 5 с «потерял», хотя никто его нигде больше не видел.
// knowWhere(team, id): видит кто-то из своих сейчас — точка (seen); видели ≤ KNOW_EXACT с назад — точка, где видели (exact: уйти далеко не
// успел); иначе — зона, где его ждёт карта команды (belief: гипотезы «стоит / ушёл по маршруту / ушёл тихо», веса меняют только события —
// увидели в другом месте, проверили «пусто», убил, плант), conf — её доля. age — с последнего точного места (для «насколько свежо», не срок).
// KNOW_EXACT, KNOW_CONF — проектные числа
var KNOW_EXACT = 2, KNOW_CONF = 0.3;
function knowWhere(team, eid){
  var e = teamBot(eid); if(!e || !e.alive || e.team === team) return null;
  if(bots.some(function(o){ return o.alive && o.team === team && o._visible && o._visible.indexOf(e) >= 0; })) return {id: eid, x: e.x, y: e.y, z: e.z, seen: true, exact: true, age: 0, conf: 1};
  var bl = (beliefLast[team] || {})[eid], Q = belief[team] && belief[team][eid], age = bl ? (tick - bl.tick)/TICK_HZ : Infinity;
  if(!bl) return null;   // о нём в раунде инфы не было (ни видели, ни слышали) — где он, не знаем: предположения по таймингам — для карты угроз, не ответ
  if(bl && age <= KNOW_EXACT) return {id: eid, x: bl.x, y: bl.y, z: bl.z, seen: false, exact: true, age: age, conf: 1};
  var bj = -1, bw = 0; if(Q) for(var j = 0; j < Q.length; j++) if(Q[j] > bw){ bw = Q[j]; bj = j; }
  // зона места, где видели, держит свой вес — точка остаётся точной (стоит, где видели); иначе — середина лучшей зоны
  if(bl){ var zl = bzOf(bl.x, bl.y); if(zl >= 0 && Q && Q[zl] >= bw - 1e-6) return {id: eid, x: bl.x, y: bl.y, z: bl.z, seen: false, exact: false, age: age, conf: Q[zl]}; }
  if(bj >= 0 && BZ.cent[bj]) return {id: eid, x: BZ.cent[bj].x, y: BZ.cent[bj].y, z: null, seen: false, exact: false, age: age, conf: bw};
  return {id: eid, x: bl.x, y: bl.y, z: bl.z, seen: false, exact: false, age: age, conf: 0};
}
// все живые враги, о которых команда что-то знает с уверенностью ≥ minConf (по умолчанию KNOW_CONF)
function knowEnemies(team, minConf){ var mc = minConf == null ? KNOW_CONF : minConf, out = [];
  bots.forEach(function(e){ if(!e.alive || e.team === team) return; var k = knowWhere(team, e.id); if(k && k.conf >= mc) out.push(k); }); return out; }
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
// (Г2, 04.11) beliefZone / beliefZoneFresh (×0,3 «чистому прогнозу») убраны — одно чтение карты команды: beliefZoneKnown (260)
