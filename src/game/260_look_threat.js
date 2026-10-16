// ---- единая оценка "куда смотреть" (BAL.threatLook) ----
// Опасность зоны = вероятность врага в ней по карте belief (она сама
// расползается по соседним зонам со временем и чистится там, куда свои
// реально смотрят). Инфа НЕ забывается по таймеру: враг, которого в этом
// раунде хоть раз видели/слышали, весит полностью всё время; "чистый прогноз"
// (ни разу не засвечен) — 0.3. Кандидаты — только зоны, которые видно с моей
// точки: враг за стеной на T Upper поднимает опасность выхода из Lamp Room,
// который мне виден (через соседей), — поэтому "далёкая стрельба за стеной"
// не отвлекает, а бой в двух шагах по пути — отвлекает.
function beliefZoneKnown(team, i){
  // инфа не забывается, но её ТОЧНОСТЬ со временем падает (враг мог уйти куда
  // угодно, это уже учтено расползанием): свежая (≤6с) — вес 1, к 25с — 0.5,
  // дальше держится на 0.5. Ни разу не засвеченный враг — 0.3 (чистый прогноз)
  var B = belief[team], seen = beliefSeen[team], L = beliefLast[team] || {}, t = 0;
  Object.keys(B).forEach(function(eid){
    var w = 0.3;
    if(seen[eid] != null){ var lo = L[eid], age = lo ? (tick - lo.tick)/TICK_HZ : 30; w = age <= 6 ? 1 : Math.max(0.5, 1 - 0.5*(age-6)/19); }
    t += B[eid][i] * w;
  });
  return t;
}
// в этой зоне (или рядом, ≤400) есть враг, которого видели/слышали ≤3с назад
function freshThreatNear(team, c){
  var L = beliefLast[team] || {};
  for(var eid in L){ var lo = L[eid]; if(tick - lo.tick <= 3*TICK_HZ && Math.hypot(lo.x-c.x, lo.y-c.y) < 400){ var e = bots.filter(function(o){ return o.id === eid; })[0]; if(e && e.alive) return true; } }
  return false;
}
function threatLook(b){
  if(!BZ.ids.length) return null;
  var step = tick - (tick % 8);
  if(b._tLookT === step) return b._tLook;
  b._tLookT = step;
  var zb = (b.atPost && b.post) ? bzOf(b.post.x, b.post.y) : bzOf(b.x, b.y);
  if(zb < 0) zb = bzOf(b.x, b.y);
  var prevLook = b._tLook; b._tLook = null; if(zb < 0) return null;
  if(BAL.tDbg) b._tDbg = [];
  var atHold = b.atPost && b.post && b.post.look;
  // (аудит взгляда) порог был 0.2/0.12: когда по таймингу/тиммейтам все зоны
  // "погашены", threatLook ничего не возвращал — и бот смотрел в фиксированный
  // угол поста (часто туда, где стоит свой) или просто по ходу за спину впереди
  // идущему. Теперь берём лучшую открытую зону даже при слабой угрозе
  var W = ZONE_DANGER_W[BZ.ids[zb]] || {}, best = null, bs0 = BAL.lookFallback ? (atHold ? (BAL.fbHold || 0.2) : (BAL.fbMove || 0.12)) : (atHold ? 0.2 : 0.12), bs = bs0, prevSc = -1;
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var angOff = function(a, ref){ return Math.abs(((a-ref+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); };
  var postA = (atHold && !(BAL.saveMove && b.post.tag === "save")) ? Math.atan2(b.post.look.y-b.y, b.post.look.x-b.x) : null;
  // спину можно "не смотреть", только если её прикрывает живой тиммейт рядом
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team; });
  var rearCovered = moving && mates.some(function(o){ return Math.hypot(o.x-b.x, o.y-b.y) < 500; });
  var LP = {}, rearC = [], SCZ = {}, habZ = {};
  if(BAL.habitLook && BAL.habits) bots.forEach(function(o){ if(!o.alive || o.team === b.team) return; var h = habitTop(o.id, 2); if(h){ var zh = bzOf(h.x, h.y); if(zh >= 0) habZ[zh] = 1; } });
  (ZONE_DANGER[BZ.ids[zb]]||[]).forEach(function(zid){
    var j = BZ.idx[zid]; if(j === undefined || j === zb) return;
    var cz = BZ.cent[j]; if(!cz || Math.hypot(cz.x-b.x, cz.y-b.y) > 1100) return;
    // угроза зоны: враг в ней самой + враг в соседних зонах за ней (оттуда он
    // выйдет в эту зону). Запоминаем, ОТКУДА главная угроза — туда и смотреть
    var own = beliefZoneKnown(b.team, j), th = own, nBest = -1, nVal = 0;
    // (4) по таймингу враг сюда ещё не мог добежать и свежей инфы нет — не смотрим
    if(BAL.lookTiming && BAL.timing && !reachPossible(b.team, j) && own < 0.3 && !BZ.nbr[j].some(function(nn){ return reachPossible(b.team, nn); })) return;
    BZ.nbr[j].forEach(function(nn){ if(nn === zb) return; if(BAL.lookTiming && BAL.timing && !reachPossible(b.team, nn)) return; var v = 0.6*beliefZoneKnown(b.team, nn); th += v; if(v > nVal){ nVal = v; nBest = nn; } });
    // точка взгляда на эту зону: если угроза — в соседней зоне за ней, то
    // видимая точка этой зоны, БЛИЖАЙШАЯ К ТОМУ ПРОХОДУ (а не ближайшая к себе:
    // раньше опорник на сайте "смотрел на B Site" — в пол у своих ног);
    // иначе — ближайшая видимая. На ходу — не за спиной, если есть выбор
    var ref = (nBest >= 0 && nVal > own && BZ.cent[nBest]) ? BZ.cent[nBest] : null;
    var smp = ZONE_SAMPLES[zid] || [cz], lpB = null, lpD = Infinity, lpAny = null, lpAD = Infinity;
    smp.forEach(function(q){ var dq = Math.hypot(q.x-b.x, q.y-b.y); if(dq < 50 || !hasLOS(b.x, b.y, q.x, q.y)) return;
      var key = ref ? Math.hypot(q.x-ref.x, q.y-ref.y) : dq;
      if(key < lpAD){ lpAD = key; lpAny = q; }
      if(moving && angOff(Math.atan2(q.y-b.y, q.x-b.x), b.heading) > 1.9) return;
      if(key < lpD){ lpD = key; lpB = q; } });
    var c = lpB || lpAny; if(!c) return;           // зону не видно ни одной точкой — не кандидат
    // близкая точка взгляда (≤2м): при покачивании на посту угол к ней скачет на
    // 90°+ — продлеваем её вдаль по тому же направлению (направление то же)
    if(BAL.lookCommit){ var dc = Math.hypot(c.x-b.x, c.y-b.y); if(dc > 1 && dc < 200){ var ext = {x: b.x + (c.x-b.x)/dc*200, y: b.y + (c.y-b.y)/dc*200}; c = hasLOS(b.x, b.y, ext.x, ext.y) ? ext : c; } }
    LP[j] = c;
    var d = Math.hypot(c.x-b.x, c.y-b.y); if(d < 50) return;
    var za = Math.atan2(c.y-b.y, c.x-b.x);
    var behind0 = moving && angOff(za, b.heading) > 1.9;
    // холд на посту: "за спиной" = больше ~125° от своего угла
    var behindHold = !moving && atHold && postA !== null && angOff(za, postA) > 2.2;
    var fresh = freshThreatNear(b.team, c);
    // тайминг: сюда враг уже мог добежать и никто из своих не смотрел
    if(BAL.timing && !behind0 && !behindHold && reachPossible(b.team, j)) th += 0.15;
    // (перекрытие 1) привычки соперника: взгляд "в любимый угол" жил в старой
    // цепочке и с новой схемой выпал — теперь это вес в оценке зоны
    if(BAL.habitLook && habZ[j] && (!BAL.timing || reachPossible(b.team, j))) th += 0.25;
    var sc = th * (0.4 + (W[zid]||0)) / (1 + d/(moving ? 400 : 700));
    if(d < 280 && !behind0 && !behindHold) sc *= 2;   // совсем рядом — не стоять к нему спиной
    // (9) спина: если её никто из своих не прикрывает (свой стоит в той стороне
    // и смотрит туда) и там вероятен враг — штраф "за спиной" слабее
    var rearOpen = BAL.rearCheck && behindHold && reachPossible(b.team, j) &&
      (th >= 0.15 || intelDeathsNear(b.team, c.x, c.y, 900, 15*TICK_HZ) > 0) &&
      !mates.some(function(o){ var dm = Math.hypot(o.x-b.x, o.y-b.y); return dm < 700 && angOff(Math.atan2(o.y-b.y, o.x-b.x), za) < 0.9 && inFov(o, c.x, c.y); });
    if(behindHold && !fresh) sc *= rearOpen ? 0.8 : 0.3;
    if(rearOpen) rearC.push({j:j, sc:sc});
    if(postA !== null && angOff(za, postA) < 0.9) sc *= 1.5;   // свой угол — вес, не приказ
    if(moving){
      var hd = angOff(za, b.heading);
      if(hd < 0.9) sc *= 1.3;
      else if(hd > 1.9) sc *= rearCovered ? 0.2 : (fresh ? 1 : 0.35);
    }
    // там уже стоит (или туда уже смотрит, или на линии стоит) свой — это его
    // сектор: не смотреть в спину тиммейту, пока там не свежая угроза
    if(!fresh && mates.some(function(o){ return Math.hypot(o.x-c.x, o.y-c.y) < 140 || (bzOf(o.x, o.y) === j && Math.hypot(o.x-c.x, o.y-c.y) < 260); }) ) sc *= 0.15;
    else if(!fresh && sightBlockedByAlly(b, b, c)) sc *= 0.2;
    // (4) по направлению взгляда стоит тиммейт (ближе, чем точка) — смотрим ему в спину
    else if(BAL.lookTiming && !fresh && mates.some(function(o){ var dm = Math.hypot(o.x-b.x, o.y-b.y); return dm > 20 && dm < Math.min(d, 600) && angOff(Math.atan2(o.y-b.y, o.x-b.x), za) < 0.22; })) sc *= 0.15;
    // (фото, игрок 7/9) свой стоит впереди, ближе к этому выходу, и видит его —
    // враг оттуда сначала встретит его; второй прицел туда не нужен
    else if(BAL.lookTiming && !fresh && mates.some(function(o){ var dmc = Math.hypot(o.x-c.x, o.y-c.y); return dmc < d - 120 && dmc < 450 && angOff(Math.atan2(o.y-b.y, o.x-b.x), za) < 0.7 && hasLOS(o.x, o.y, c.x, c.y); })) sc *= 0.25;
    // (8) это место прямо сейчас смотрит тиммейт (видит его и оно у него в обзоре) —
    // второй раз тот же угол не нужен, если это не мой пост и не свежая угроза
    else if(BAL.lookTiming && !fresh && !(postA !== null && angOff(za, postA) < 0.9) &&
            mates.some(function(o){ return !o._sawEnemy && Math.hypot(o.x-c.x, o.y-c.y) < 900 && inFov(o, c.x, c.y) && hasLOS(o.x, o.y, c.x, c.y); })) sc *= 0.35;
    // (6) сектора: эту же зону уже смотрит тиммейт рядом — берём другую
    if(BAL.sectors && !fresh && mates.some(function(o){ return o._tLookZ === j && o.lookReason === "threat" && Math.hypot(o.x-b.x, o.y-b.y) < 450; })) sc *= 0.45;
    if(j === b._tLookZ) prevSc = sc;
    SCZ[j] = sc;
    if(BAL.tDbg) (b._tDbg = b._tDbg || []).push([BZ.ids[j], Math.round(th*100)/100, Math.round(sc*1000)/1000, Math.round(d)]);
    if(sc > bs){ bs = sc; best = j; }
  });
  // (9) периодический чек спины: раз в ~6с на ~0.7с, если спина открыта и там вероятен враг
  if(BAL.rearCheck && atHold && !b._sawEnemy){
    if(b._rearUntil && tick < b._rearUntil && LP[b._rearZ]){ b._tLookZ = b._rearZ; b._tLook = LP[b._rearZ]; return b._tLook; }
    if(b._rearUntil && tick >= b._rearUntil){ b._rearUntil = 0; b._tLookZ = b._rearPrev; b._tLookSince = tick - 200;
      prevSc = (b._rearPrev != null && SCZ[b._rearPrev] != null) ? SCZ[b._rearPrev] : -1; }
    var rc = rearC.sort(function(a, c2){ return c2.sc - a.sc; })[0];
    if(rc && rc.sc > 0.12*bs && tick >= (b._rearNext||0)){ b._rearPrev = b._tLookZ; b._rearZ = rc.j; b._rearUntil = tick + 45; b._rearNext = tick + 6*TICK_HZ;
      if(!b._rearVoice || tick - b._rearVoice > 20*TICK_HZ){ b._rearVoice = tick; logEvent(b.id+": чекает спину — "+calloutName(LP[rc.j].x, LP[rc.j].y)); }
      b._tLookZ = rc.j; b._tLook = LP[rc.j]; return b._tLook; }
  }
  // гистерезис — не вертеть головой между почти равными углами
  if(best !== null && b._tLookZ != null && b._tLookZ !== best && prevSc >= 0.75*bs) best = b._tLookZ;
  if(best !== null && b._tLookZ != null && b._tLookZ !== best && prevSc > 0 && tick - (b._tLookSince||0) < 96 && bs < 1.6*prevSc) best = b._tLookZ; // (при ≥1.6× — переключается)
  if(best === null && b._tLookZ != null && prevSc >= 0.9*bs0) best = b._tLookZ;
  // аудит конфликтов: оценка зависит от того, где стоят тиммейты (штраф ×0.15
  // "это его сектор" включается/выключается, когда тот проходит мимо) — и бот
  // разворачивался туда-обратно быстрее секунды. Минимум ~0.75с на одном угле,
  // если в новой зоне нет СВЕЖЕЙ угрозы
  if(BAL.lookCommit && best !== null && b._tLookZ != null && b._tLookZ !== best && prevSc > 0 && tick - (b._tLookSince||0) < 48 &&
     !(LP[best] && freshThreatNear(b.team, LP[best])) && !(BAL.lookFix && bs >= 2*prevSc)) best = b._tLookZ;
  var sameZ = best !== null && best === b._tLookZ;
  if(best !== b._tLookZ) b._tLookSince = tick;
  b._tLookZ = best;
  if(sameZ && prevLook && LP[best] && Math.hypot(prevLook.x-LP[best].x, prevLook.y-LP[best].y) < 60 && hasLOS(b.x, b.y, prevLook.x, prevLook.y)){ b._tLook = prevLook; return b._tLook; }
  // та же зона, но точка взгляда прыгнула на другой её край (>70°) — не
  // разворачиваться, пока старая точка видна и не прошло ~1.5с
  if(BAL.lookCommit && sameZ && prevLook && LP[best] && hasLOS(b.x, b.y, prevLook.x, prevLook.y) && tick - (b._tLookPtSince||0) < 96 &&
     angOff(Math.atan2(prevLook.y-b.y, prevLook.x-b.x), Math.atan2(LP[best].y-b.y, LP[best].x-b.x)) > 1.2){ b._tLook = prevLook; return b._tLook; }
  if(best !== null && (!prevLook || !LP[best] || Math.hypot(prevLook.x-LP[best].x, prevLook.y-LP[best].y) >= 60)) b._tLookPtSince = tick;
  if(best !== null) b._tLook = LP[best] || (BAL.cornerLook ? cornerLook(b, BZ.cent[best]) : BZ.cent[best]);
  return b._tLook;
}

// =====================================================================
// НОВЫЙ ВЗГЛЯД (v141): одна оценка вместо очереди из ~15 функций.
// Каждые 8 тиков для каждой команды:
//  1) для каждого живого бота собираем кандидатов — зоны, откуда простреливается
//     его позиция (таблица опасности), и точку взгляда на каждую;
//  2) вес кандидата = сколько врагов вероятно выйдет оттуда (карта вероятностей:
//     враг в самой зоне + враг за её входами, если эти входы никто не видит)
//     × открытость линии × близость × поправки на роль/движение;
//  3) команда делит направления: жадно, от самого важного — кто взял
//     направление, у тех, кто рядом, вес этого же направления падает (LOOK.claim);
//  4) инерция: текущее направление держится, пока новое не лучше заметно
//     (LOOK.stick) или не пришла свежая инфа.
// Всё, что раньше было отдельными правилами (звук, смерть тиммейта, колл, beliefLast,
// привычки соперника, "спину прикрывает свой", "не смотреть в тиммейта"), —
// теперь либо уже в карте вероятностей, либо один множитель ниже.
// =====================================================================
var LOOK = {
  maxDist: 1100,     // дальше этой дистанции зону как угрозу не рассматриваем
  nbrW: 0.6,         // вклад врага за входом в зону (он оттуда выйдет)
  checkK: 0.5, checkAng: 1.6, checkEvery: 4, checkDur: 1.2,   // (v260) проверка второго угла стоя: ≥ половины главного, ≥ 90° в сторону, раз в 4–8 с на 1,2 с — проектные числа
  sndOpen: 1.05,     // (v261, В5) шум без видимого угла — открытое направление в пределах ±60° от него — проектное число
  nearPx: 360,       // (v260) враг дальше за входом: вес exp(-путь/nearPx), ~0,5 на 250 px — проектное число
  watchedNbr: 0.25,  // …если этот вход видит тиммейт — враг сначала выйдет на него
  habitW: 0.25,      // любимое место соперника (память прошлых раундов)
  distHold: 700,     // затухание веса с расстоянием, стоя
  distMove: 400,     // …на ходу (ближние углы важнее)
  closeR: 280, closeK: 2.0,      // совсем рядом — не стоять к нему спиной
  freshK: 2.5,       // свежая инфа (видели/слышали ≤3с рядом с точкой)
  postK: 1.5,        // направление поста по сетапу — вес роли, не приказ
  headK: 1.3,        // на ходу: по направлению движения
  behindMove: 0.35,  // на ходу: за спиной (>110°)
  behindMoveCov: 0.15, // …и спину рядом прикрывает тиммейт
  behindHold: 0.5,   // стоя: за спиной относительно поста (>125°)
  mateThere: 0.15,   // в этой зоне/у точки стоит свой
  mateInLine: 0.15,  // на линии взгляда стоит свой (смотрел бы ему в спину)
  claim: 0.2,        // это направление уже взял тиммейт рядом
  claimR: 900,       // "рядом" для дележа направлений
  stick: 1.35,       // бонус текущему направлению (инерция)
  minDwell: 48,      // тиков (~0.75с) минимум на одном направлении без свежей инфы
  switchK: 2.0,      // раньше minDwell переключаемся, только если новое в 2 раза лучше
  timingW: 0,        // вес "сюда враг может успеть раньше всего" (когда инфы нет)
  timingSec: 12,     // за сколько секунд до возможного прихода врага начинаем туда смотреть
  entryExp: 0.9,     // открытость прохода в свою зону (он всегда простреливает позицию)
  uncheckW: 0.05,    // вес непроверенного угла, куда враг мог успеть (когда реальной инфы нет)
  reachSlack: 4,     // сек: запас к таймингу — "мог прибежать чуть раньше расчёта"
  recheckSec: 8,     // сек: через сколько проверенный угол снова считается непроверенным
  uncheckWalk: 0.13, // для шифта: непроверенный угол рядом с путём — идём тихо
  contactW: 1.2,     // свежий звук/вижу-потерял рядом (≤1.5с, ≤700px) — даже в своей же зоне
  rearMargin: 150,   // px пути: проход дальше от врага, чем я, на это — мой тыл
  rearInfo: 0.15,    // …но если там по инфе вероятен враг (люркер, фланг) — смотрим
  proLook: 0.035,    // вес "куда смотрят про с этой точки" (× согласованность): ниже любой реальной инфы
  claimMin: 0.08,    // делить направления в команде, только если угроза заметная
  postBase: 0.004,   // вес угла поста, когда угроз нет совсем
  minScore: 0.0005    // ниже — "ничего не угрожает": смотрим по ходу / на пост
};
// "не проверено": зону давно (или никогда) не видел никто из своих, и враг по
// таймингу мог туда успеть (с запасом: тайминг — оценка, враг мог бежать быстрее).
// 0 — только что проверили или враг туда не мог попасть; 1 — давно не смотрели.
var LAST_CLEAR = {CT:{}, T:{}};
var _ED = {};
function enemySpawnDist(team){
  if(_ED[team] && _ED[team].n === BZ.ids.length) return _ED[team].D;
  var sp = team === "CT" ? T_SPAWN : CT_SPAWN, z0 = bzOf(sp.x, sp.y);
  var D = bzDist(z0 >= 0 ? [z0] : []); _ED[team] = {n:BZ.ids.length, D:D}; return D;
}
function uncheckedW(team, j){
  var R = REACH[team];
  if(R && R[j] - tick > LOOK.reachSlack*TICK_HZ) return 0;
  if(R && !isFinite(R[j])) return 0;
  var lc = (LAST_CLEAR[team]||{})[j], age = lc == null ? 1e9 : tick - lc;
  return Math.min(1, age/(LOOK.recheckSec*TICK_HZ));
}
// тыл: зона дальше от вражеского спавна, чем моя, и по инфе там никого — враг
// туда может попасть только через нас или тиммейтов (Alley, 90, First Lane у CT)
// (v273, разбор взгляда владельца 14.10) тыл — не «всё, что дальше от вражеского спавна, чем я» (вышедшему вперёд CT
// так тылом становились Triple, T Upper, Sniper Nest — откуда шли T), а то, куда враг ещё не мог дойти по таймингу
// (REACH — знание команды) или что держит свой (свой в зоне / ≤ 400 px от её центра). Остальное позади — обычный вариант
// взгляда с ослаблением «за спиной» (LOOK.behindHold / behindMove)
function isRearZone(team, zb, j, b){
  if(!BAL.rearCut) return false;
  // сам слышал/видел врага в этой зоне за последние 3 с — не тыл, даже если команда ещё не знает
  var c0 = BZ.cent[j];
  if(b && c0 && [b.heardSound, b.lastIntel].some(function(q){ return q && (!q.team || q.team !== team) && tick - q.tick <= 3*TICK_HZ && (bzOf(q.x, q.y) === j || Math.hypot(q.x-c0.x, q.y-c0.y) <= 400); })) return false;
  var ED = enemySpawnDist(team);
  if(!(ED[j] > ED[zb] + LOOK.rearMargin)) return false;
  if(beliefZoneKnown(team, j) >= LOOK.rearInfo) return false;
  if(BZ.cent[j] && freshThreatNear(team, BZ.cent[j])) return false;
  // (v280) по таймингу — тыл, только если враг не успеет туда дольше LOOK.timingSec (раньше — «не успел прямо сейчас»:
  // выкидывался угол, куда враг выйдет через 0,1 с); держит — другой тиммейт, не сам бот (игрок 8 «держал» Donut сам)
  if(!BAL.timing || !REACH[team] || REACH[team][j] - tick > LOOK.timingSec*TICK_HZ){ REAR_WHY = "тыл: по таймингу враг не успеет туда " + LOOK.timingSec + "+ с"; return true; }
  var c = BZ.cent[j], m = c ? bots.filter(function(o){ return o !== b && o.alive && o.team === team && (bzOf(o.x, o.y) === j || Math.hypot(o.x-c.x, o.y-c.y) <= 400); })[0] : null;
  if(m){ REAR_WHY = "тыл: держит " + m.id; return true; }
  return false;
}
var REAR_WHY = "тыл";   // (только для разбора взгляда) почему зона — тыл
// (v149) "куда смотреть отсюда без инфы": видимый проход, за которым зона
// ближе всего к вражескому спавну — откуда враг придёт раньше всего. Тыл
// (дальше от врага, чем я) не берётся. Кэш по клетке 24px.
var EWL = {};
function enemywardLook(team, p){
  if(!BZ.portal) bzPortals();
  var k = team+Math.round(p.x/24)+","+Math.round(p.y/24); if(k in EWL) return EWL[k];
  var ED = enemySpawnDist(team), zp = bzOf(p.x, p.y), best = null, bs = Infinity;
  if(zp >= 0) BZ.portal.forEach(function(row, i){ for(var js in row){ var j = +js, q = row[j];
    // проход из зоны i в зону j, смотрим "в сторону j"
    var d = Math.hypot(q.x-p.x, q.y-p.y); if(d < 60 || d > 900) continue;
    if(j === zp) continue;                          // проход в мою же зону (он у меня за спиной)
    if(!(ED[j] < ED[i])) continue;                  // только проходы, ведущие к врагу
    if(ED[j] > ED[zp] + LOOK.rearMargin) continue;  // не в тыл
    if(!hasLOS(p.x, p.y, q.x, q.y)) continue;
    var sc = ED[j] + 0.35*d;                        // раньше всего враг + не слишком далеко
    if(sc < bs){ bs = sc; best = {x:q.x, y:q.y}; } } });
  EWL[k] = best; return best;
}
// (v151) где враг появится, если пойдёт из зоны j ко мне: последняя видимая
// мне точка его пути по навмешу (угол, из-за которого он выйдет) — туда и
// пре-эйм. Кэш по клетке 24px и зоне.
var APPEAR = {};
function appearPoint(o, j){
  var c = BZ.cent[j]; if(!c) return null;
  var k = Math.round(o.x/24)+","+Math.round(o.y/24)+"|"+j;
  if(k in APPEAR) return APPEAR[k];
  var wp = buildWaypointPath(c.x, c.y, 0, o.x, o.y, 0), last = null;
  // идём по пути врага к нам: первая точка, которую видно, — место появления
  for(var i=0; i<wp.length; i++){ var q = {x:wp[i][0], y:wp[i][1]}, d = Math.hypot(q.x-o.x, q.y-o.y);
    if(d < 50) break;
    if(hasLOS(o.x, o.y, q.x, q.y)){ last = q; break; } }
  if(Object.keys(APPEAR).length > 20000) APPEAR = {};
  APPEAR[k] = last; return last;
}
var PL_GRID = {};
function proLookAt(team, x, y){
  if(typeof PRO_LOOK === "undefined") return null;
  var layer = ppLayer(team), G = PL_GRID[layer];
  if(!G){ var L = PRO_LOOK.layers[layer]; if(!L) return null; G = PL_GRID[layer] = {}; L.forEach(function(r){ G[r[0]] = r; }); }
  var n = PRO_LOOK.n, C = PRO_LOOK.cell, cx = Math.floor(x/C), cy = Math.floor(y/C), best = null;
  // своя клетка; если там нет данных — соседние
  for(var dy=-1; dy<=1; dy++) for(var dx=-1; dx<=1; dx++){
    var r = G[(cy+dy)*n + (cx+dx)]; if(!r) continue;
    var w = r[3] * (dx === 0 && dy === 0 ? 1 : 0.6);
    if(!best || w > best.w) best = {dx:r[1], dy:r[2], R:r[3], w:w};
  }
  return best;
}
function _angOff(a, ref){ return Math.abs(((a-ref+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); }
// точка прохода между двумя зонами (середина общей границы полигонов)
function bzPortalPt(za, zb){
  var A = za.points, B = zb.points, sx = 0, sy = 0, n = 0;
  var dSeg = function(px, py, a, b){ var vx=b.x-a.x, vy=b.y-a.y, L=vx*vx+vy*vy, t = L ? Math.max(0, Math.min(1, ((px-a.x)*vx+(py-a.y)*vy)/L)) : 0; return Math.hypot(px-(a.x+vx*t), py-(a.y+vy*t)); };
  for(var i=0;i<A.length;i++){ var a = A[i], a2 = A[(i+1)%A.length];
    for(var s=0;s<=8;s++){ var px = a.x+(a2.x-a.x)*s/8, py = a.y+(a2.y-a.y)*s/8;
      for(var k=0;k<B.length;k++){ if(dSeg(px, py, B[k], B[(k+1)%B.length]) < 10){ sx += px; sy += py; n++; break; } } } }
  return n ? {x:sx/n, y:sy/n} : null;
}
function bzPortals(){
  BZ.portal = BZ.ids.map(function(){ return {}; });
  BZ.nbr.forEach(function(L, i){ L.forEach(function(j){ if(j < i) return;
    var p = bzPortalPt(ZONEMAP.zones[i], ZONEMAP.zones[j]);
    if(!p){ var ci = BZ.cent[i], cj = BZ.cent[j]; p = {x:(ci.x+cj.x)/2, y:(ci.y+cj.y)/2}; }
    BZ.portal[i][j] = p; BZ.portal[j][i] = p; }); });
}
// какие проходы между зонами сейчас видит команда (враг, прошедший через них, был бы замечен)
function portalWatched(team){
  if(!BZ.portal) bzPortals();
  var mates = bots.filter(function(o){ return o.alive && o.team === team && tick >= (o.blindUntil||0); });
  var W = {};
  BZ.portal.forEach(function(row, i){ for(var js in row){ var j = +js; if(j < i) continue; var p = row[j], ok = false;
    for(var m=0;m<mates.length && !ok;m++){ var o = mates[m], d = Math.hypot(p.x-o.x, p.y-o.y);
      if(d < 90) ok = true;
      else if(d < CONE_R*1.4 && inFov(o, p.x, p.y) && hasVision(o.x, o.y, p.x, p.y)) ok = true; }
    if(ok){ W[i+","+j] = 1; W[j+","+i] = 1; } } });
  return W;
}
var PORTAL_W = {CT:{}, T:{}};
// кандидаты взгляда для одного бота: [{j, pt, sc, fresh}]
// (v260, В3) сколько врагов выйдет из зоны j через соседа nn: кто в nn — целиком, кто дальше за nn
// (дойдёт до nn раньше, чем до j) — с весом exp(-путь до nn / LOOK.nearPx). Считаем по длине пути, а не по
// числу зон: Site B → B Site → 90 → First Lane — три зоны, но ~250 px. Свою зону zb и саму j не считаем
var BZ_WALK = null;
function bzWalk(){
  if(BZ_WALK) return BZ_WALK;
  if(!BZ.portal) bzPortals();
  var n = BZ.ids.length;
  BZ_WALK = BZ.ids.map(function(_, s){ var D = new Float32Array(n).fill(Infinity), done = new Uint8Array(n); D[s] = 0;
    for(;;){ var u = -1; for(var i=0;i<n;i++) if(!done[i] && D[i] < Infinity && (u < 0 || D[i] < D[u])) u = i;
      if(u < 0) break; done[u] = 1;
      BZ.nbr[u].forEach(function(v){ var p = BZ.portal[u][v] || BZ.cent[v];
        var w = Math.hypot(p.x-BZ.cent[u].x, p.y-BZ.cent[u].y) + Math.hypot(BZ.cent[v].x-p.x, BZ.cent[v].y-p.y);
        if(D[u] + w < D[v]) D[v] = D[u] + w; }); }
    return D; });
  return BZ_WALK;
}
function nbrThreat(team, j, nn, zb){
  var W = bzWalk(), t = 0;
  for(var k=0;k<W.length;k++){ if(k === j || k === zb) continue;
    var dn = W[k][nn]; if(!(dn < W[k][j])) continue;
    if(k !== nn && BAL.timing && !reachPossible(team, k)) continue;
    var bk = beliefZoneKnown(team, k); if(bk > 0) t += bk * Math.exp(-dn / LOOK.nearPx); }
  return t;
}
// (v261, В5) шум слышен, а видимого угла, откуда выйдет враг, нет (стоит в углу за ящиком) — игрок всё равно
// поворачивается на шум: самое открытое видимое направление в пределах ±span от шума (ближе к шуму — лучше)
function openToward(b, a, span){
  var best = null, bs = 0;
  for(var k = -6; k <= 6; k++){
    var aa = a + span*k/6, off = Math.abs(k)/6, dep = 0;
    [400, 300, 200, 120].some(function(R){ if(hasLOS(b.x, b.y, b.x+Math.cos(aa)*R, b.y+Math.sin(aa)*R)){ dep = R; return true; } return false; });
    var s = dep * (1 - 0.5*off);
    if(dep >= 120 && s > bs){ bs = s; best = {x:b.x+Math.cos(aa)*dep, y:b.y+Math.sin(aa)*dep}; }
  }
  return best;
}
