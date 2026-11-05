// ======================= СИНХРОНИЗАЦИЯ ВЫХОДА T С ГРАНАТАМИ (одно место; тактика, 30.10) =======================
// Одно место на вопрос «можно ли команде T выходить на сайт, или ждём гранаты выхода»: раньше этот вопрос решали три
// несвязанных таймера — команда ждала смоки «пока летят», но не дольше 5 с от первого броска и 5 с от тайминга (170); боец у выхода
// ждал гранаты в воздухе ≤ 7 с (170, utilWait); никто не ждал, пока дым раскроется, и никто не проверял, лёг ли смок туда, куда надо.
// Смок, летящий 5–10 с (лайнапы, тактика 30.10: медиана 5,05 с, до 10,5 с у ботов), выход не дожидался.
//
// Здесь у каждой гранаты выхода (смок с меткой exec: 420 — «вход CT», «кросс»; 390 — лайнапы «(выход, сайт)») — жизненный цикл:
//   assigned (задание у исполнителя) → flying (брошена; когда сработает — знает физика броска, 380: n.etaDet) → forming (сработала
//   у цели, дым раскрывается — SMOKE_GROW тиков, та же модель, что smokeRadiusNow) → ready (дым закрыл место)
//   или failed: исполнитель погиб / нет гранаты / задание снято / легла не туда (дальше радиуса дыма от цели) / на крышу.
// Что знает команда — то, что знают игроки: кто идёт кидать (войс), что граната брошена (видно / «смок пошёл»), где встал дым (видно).
// Критичная граната — смок, который закрывает CT вид на вход T на сайт (из точки смока виден вход GEO.tEntry или вход набора
// pos.entries): без него энтри выходит под открытый угол — выход его ждёт. Остальные (поддерживающие) выход не задерживают.
// Не вышло — по порядку PRO_PLAY 6ж: (1) переназначить — резервный исполнитель (выбран заранее, при назначении; проверка на провале:
// жив, есть смок, не энтри / носитель / лёркер, точка броска не позади, успевает до конца раунда); (2) нет резервного — выход без
// этого смока под флешки (войс), а не слепое ожидание. Переназначение — один раз на гранату (не бегать за гранатами без конца).
// Журнал — EXU.ev (для замеров: tools/measure/exec_sync.js) и консоль.
var EXU = null;
var EXU_LATE = 35;   // с до конца раунда: позже — не ждём и не переназначаем (тот же порог, что «поздно — выходим» в tBrain, 170)
function exuCur(){
  var k = matchNum+":"+roundNum;
  if(!EXU || EXU.k !== k) EXU = {k:k, n:0, items:{}, ev:[]};
  return EXU;
}
function exuEv(kind, it, extra){
  var E = exuCur(), e = {t:tick, kind:kind, id:it ? it.id : null, crit:it ? it.crit : null, owner:it ? it.owner : null};
  if(extra) for(var q in extra) e[q] = extra[q];
  E.ev.push(e);
}
// смок закрывает вид на вход T на сайт: из точки смока виден один из входов (если не видно ни одного — он о другом)
function exuCritical(site, x, y){
  var g = GEO[site], ents = (g && g.tEntry ? [g.tEntry] : []).concat(entryPts(site) || []);
  return ents.some(function(q){ return q && hasLOS(x, y, q.x, q.y); });
}
function exuIsExec(t){ return !!(t && t.exec && t.type === "smoke"); }
// задания гранат выхода у живых T (текущее и очередь) → записи; новые получают id и резервного исполнителя
function exuScan(tt){
  var E = exuCur(), seen = {};
  bots.forEach(function(b){
    if(b.team !== "T" || !b.alive) return;
    [b.nadeTask].concat(b.nadeQueue || []).forEach(function(t){
      if(!exuIsExec(t)) return;
      var it = t.exu != null ? E.items[t.exu] : null;
      if(!it){
        it = {id:++E.n, type:t.type, x:t.x, y:t.y, from:t.from ? {x:t.from.x, y:t.from.y} : null, why:t.why, site:tt.site, owner:b.id,
              crit:exuCritical(tt.site, t.x, t.y), state:"assigned", at:tick, re:0};
        E.items[it.id] = it; t.exu = it.id;
        var bk = exuBackup(it, tt, b);
        it.backup = bk ? bk.id : null;
        exuEv("assign", it, {why:t.why, backup:it.backup});
      }
      it.owner = b.id; it.x = t.x; it.y = t.y; if(t.from) it.from = {x:t.from.x, y:t.from.y};   // цель лайнапа могла смениться (380: luSpotFor)
      seen[it.id] = 1;
    });
  });
  return seen;
}
// задание гранаты выхода снято без броска (380: updateNadeTasks) — причина: последняя неудачная попытка броска или срок / смерть / нет гранаты
function exuTaskGone(t, b){
  var it = exuCur().items[t.exu]; if(!it || it.state !== "assigned") return;
  it.goneWhy = !b.alive ? "исполнитель погиб" : !b.nades || b.nades[t.type] <= 0 ? "нет гранаты" : NADE_FAIL ? "не кинуть: "+NADE_FAIL :
    tick > t.until ? "не дошёл до точки броска за срок" : "задание снято (точка позади / сайт взят / перебито)";
}
// граната вышла из рук (380: throwNade) — запись знает, когда она сработает (полёт той же физикой, что летит)
function exuThrown(b, nd){
  var t = b.nadeTask; if(!exuIsExec(t) || t.exu == null || t.type !== nd.type) return;
  var it = exuCur().items[t.exu]; if(!it) return;
  nd.exu = it.id; it.state = "flying"; it.thrownAt = tick; it.eta = nd.etaDet; it.owner = b.id;
  exuEv("throw", it, {eta:nd.etaDet});
}
// граната сработала (400: detonate) или легла на крышу (400: nadesTick, дыма нет)
function exuLanded(n, roof){
  if(n.exu == null || !EXU) return;
  var it = EXU.items[n.exu]; if(!it || it.state !== "flying") return;
  var err = Math.hypot(n.x - it.x, n.y - it.y);
  it.detAt = tick; it.err = Math.round(err);
  if(roof) return exuFail(it, "на крыше");
  // дым закрывает цель, только если цель внутри облака (радиус дыма)
  if(err > NADE.smoke.radius) return exuFail(it, "легла не туда ("+Math.round(err)+" px от цели)");
  it.state = "forming"; it.useAt = tick + SMOKE_GROW;
  exuEv("det", it, {err:it.err, useAt:it.useAt});
}
function exuFail(it, why){
  it.state = "failed"; it.failWhy = why; it.failAt = tick;
  exuEv("fail", it, {why:why});
  logEvent("T: граната выхода не вышла — «"+it.why+"»: "+why);
}
// резервный исполнитель: кто может и успевает (PRO_PLAY 6ж: не обязательно ближайший, не энтри / носитель / лёркер без нужды)
function exuBackup(it, tt, excl){
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime), F = it.from || {x:it.x, y:it.y};
  var busy = function(o){ var n = 0; [o.nadeTask].concat(o.nadeQueue || []).forEach(function(t){ if(t && t.type === "smoke") n++; }); return n; };
  var C = bots.filter(function(o){
    if(o === excl || o.team !== "T" || !o.alive || o.planting || !o.nades || o.nades.smoke - busy(o) <= 0) return false;
    if(o.tRole === "lurker" || (bomb.state === "carried" && bomb.carrier === o)) return false;
    if(o.nadeTask && !exuIsExec(o.nadeTask) && o.nadeTask.lineup) return false;   // свой лайнап не перебиваем
    if(it.from && luBehind(o, it.from)) return false;   // точка броска позади по ходу — назад за гранатой не идут (380)
    return true;
  }).map(function(o){
    // путь до точки броска: лайнап — до его точки, своя граната — докуда долетит (NADE_THROW_RANGE)
    var d = it.from ? pathLenTo(o, F.x, F.y) : Math.max(0, pathLenTo(o, it.x, it.y) - NADE_THROW_RANGE);
    return {o:o, d:d, c:d + (o.tRole === "entry" ? 600 : o.tRole === "awp" ? 300 : 0)};   // энтри / AWP — только если больше некому (проектные надбавки, ед.)
  }).filter(function(c){
    // успевает: дойти + полёт (как у прошлого броска этой гранаты, иначе запал флешки — нижняя граница) + раскрытие — до «поздно»
    var fl = it.eta && it.thrownAt ? (it.eta - it.thrownAt)/TICK_HZ : NADE_P.FUSE.flash;
    return c.d/SPEED + fl + SMOKE_GROW/TICK_HZ < secLeft - EXU_LATE;
  }).sort(function(a, c){ return a.c - c.c; });
  // назначенный заранее резервный — если он всё ещё может и успевает; иначе — лучший из тех, кто может
  var pre = it.backup && C.filter(function(c){ return c.o.id === it.backup; })[0];
  return pre ? pre.o : C.length ? C[0].o : null;
}
// почему резервного нет — для журнала: сколько T со смоком и кто чем занят
function exuNoBackupWhy(it){
  var w = bots.filter(function(o){ return o.team === "T" && o.alive && o.id !== it.owner; }).map(function(o){
    return o.id+(!o.nades || o.nades.smoke <= 0 ? ":нет смока" : o.tRole === "lurker" ? ":лёркер" : bomb.state === "carried" && bomb.carrier === o ? ":бомба" :
      o.nadeTask && o.nadeTask.lineup ? ":свой лайнап" : it.from && luBehind(o, it.from) ? ":точка позади" : ":не успеть / занят"); });
  return w.join(" ");
}
function exuReassign(it, tt){
  var b = exuBackup(it, tt, bots.filter(function(o){ return o.id === it.owner; })[0] || null);
  if(!b) return false;
  var why = it.why+" (вместо "+it.owner+")";
  if(it.from){
    var sec = Math.ceil(pathLenTo(b, it.from.x, it.from.y)/(SPEED*weaponSpeedMul(b)) + LU_REACH_PAD);
    // своя граната резервного — в очередь (380: nadeQueueNext вернёт её после смока выхода — и с точкой броска, и с места)
    if(b.nadeTask) (b.nadeQueue = b.nadeQueue || []).unshift(b.nadeTask);
    b.nadeTask = {type:"smoke", x:it.x, y:it.y, from:{x:it.from.x, y:it.from.y}, until:tick + Math.max(7, sec)*TICK_HZ, why:why, start:tick,
                  lob:true, range:4000, now:true, lineup:true, exec:true, npm:"exec", exu:it.id};
  } else {
    var own = b.nadeTask; b.nadeTask = null;   // своя граната — в очередь, смок выхода вперёд; не вышло назначить — вернуть как было
    if(!assignNade(b, "smoke", {x:it.x, y:it.y}, why, {now:true, range:1300, bkey:"T.exec.re."+it.id})){ b.nadeTask = own; return false; }
    if(own) (b.nadeQueue = b.nadeQueue || []).unshift(own);
    b.nadeTask.exec = true; b.nadeTask.exu = it.id;
  }
  var was = it.owner;
  it.re++; it.state = "assigned"; it.owner = b.id; it.at = tick; it.failWhy = null;
  exuEv("reassign", it, {from:was, to:b.id});
  voiceLog("T", "exure"+it.id, b.id, "смок «"+String(it.why).replace(/^лайнап /, "")+"» — на мне, вместо "+was);
  logEvent("T: граната выхода переназначена "+was+" → "+b.id+" («"+it.why+"»)");
  return true;
}
// каждый тик (из tBrain): задания → записи; пропавшее задание без броска — провал (с причиной); провал критичной до выхода — переназначение
function exuTick(tt){
  if(!tt || !tt.site || roundState !== "live") return;
  var E = exuCur(), seen = exuScan(tt), secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  Object.keys(E.items).forEach(function(k){
    var it = E.items[k];
    if(it.site !== tt.site){ if(it.state !== "void"){ it.state = "void"; exuEv("void", it, {why:"перекол"}); } return; }   // сайт сменили (tSetSite) — граната о другом
    if(it.state === "assigned" && !seen[it.id]){
      if(smokeCovered(it.x, it.y)){ it.state = "ready"; exuEv("covered", it); return; }   // место уже закрыл другой дым (380: задание снято поэтому)
      var o = bots.filter(function(q){ return q.id === it.owner; })[0];
      exuFail(it, !o || !o.alive ? "исполнитель погиб" : !o.nades || o.nades.smoke <= 0 ? "нет гранаты" : it.goneWhy || "задание снято");
    }
    if(it.state === "forming" && tick >= it.useAt){ it.state = "ready"; exuEv("ready", it); }
    if(it.state === "failed" && it.crit && !it.done){
      if(tt.phase === "setup" && bomb.state !== "planted" && secLeft > EXU_LATE && it.re < 1 && exuReassign(it, tt)) return;
      it.done = true;   // переназначить некому / не успеть — выход без этого смока (exuGate)
      exuEv("drop", it, {why: tt.phase !== "setup" ? "выход уже идёт" : it.re >= 1 ? "уже переназначали" : secLeft <= EXU_LATE ? "поздно" : "некому: "+exuNoBackupWhy(it)});
      if(tt.phase === "setup") voiceLog("T", "exudrop"+it.id, "IGL", "смока «"+String(it.why).replace(/^лайнап /, "")+"» не будет — заходим под флешки");
    }
  });
}
// можно ли выходить: критичные смоки этого сайта — готовы, или не будут (провал без замены). Ждём, пока критичная граната назначена
// (исполнитель идёт), летит или раскрывается. Ответ {go, why, eta: когда будет готов последний из летящих / раскрывающихся}
function exuGate(tt){
  var E = exuCur(), wait = null, eta = 0;
  Object.keys(E.items).forEach(function(k){
    var it = E.items[k]; if(!it.crit || it.site !== tt.site) return;
    if(it.state === "assigned"){ wait = wait || "смок «"+it.why+"» — "+it.owner+" идёт на точку"; }
    else if(it.state === "flying"){ wait = wait || "смок «"+it.why+"» летит"; eta = Math.max(eta, (it.eta || tick) + SMOKE_GROW); }
    else if(it.state === "forming"){ wait = wait || "смок «"+it.why+"» раскрывается"; eta = Math.max(eta, it.useAt); }
    else if(it.state === "failed" && !it.done){ wait = wait || "смок «"+it.why+"» не вышел — ищем замену"; }
  });
  return {go: !wait, why: wait, eta: eta};
}
// (v510) быстрый выход (сняли CT на сайте, их ≤ 2, там соло) — не ждёт смоков, которые ещё не брошены, но брошенный критичный смок
// (летит / раскрывается) дожидается: ответ — тик, когда раскроется последний (0 — ждать нечего)
function exuHoldEta(tt){
  var E = exuCur(), eta = 0;
  Object.keys(E.items).forEach(function(k){ var it = E.items[k]; if(!it.crit || it.site !== tt.site) return;
    if(it.state === "flying") eta = Math.max(eta, (it.eta || tick) + SMOKE_GROW);
    else if(it.state === "forming") eta = Math.max(eta, it.useAt); });
  return eta > tick ? eta : 0;
}
// (00_PLAN п.8, ответ владельца 5, 05.11: «мидер ждёт смок, перекрывающий опасную линию на его пути — Mirage Window; смоки синхронно»)
// До выхода (сетап / дефолт) T не выходит на линию, которую закроет свой смок, ещё не вставший: смок назначен (тиммейт идёт кидать —
// войс), летит или раскрывается, а с обычного места CT (KNOW_POSITIONS) на точку бойца есть вид, и линия проходит через место смока
// (≤ радиуса дыма). Ждёт там, где стоит, если оттуда этого места CT не видно (уже на виду — ждать незачем). Ждать перестаёт, когда смок
// встал или его не будет (задание снято, кидающий погиб) — по тем же признакам, что знает команда. Своя граната, контакт, носитель — не ждут
var SLW_R = 1100;   // ед.: места CT дальше — не в счёт (тот же радиус, что проверка мест «пусто», posClearTick 150)
function smokeLinePending(team){
  var L = [];
  bots.forEach(function(o){ if(o.team !== team || !o.alive) return;
    [o.nadeTask].concat(o.nadeQueue || []).forEach(function(t){ if(t && t.type === "smoke" && t.x != null) L.push({x:t.x, y:t.y, owner:o.id, st:"assigned"}); }); });
  nadesInAir.forEach(function(n){ if(n.team === team && n.type === "smoke") L.push({x:n.aimX != null ? n.aimX : n.x, y:n.aimY != null ? n.aimY : n.y, owner:n.thrower ? n.thrower.id : null, st:"flying"}); });
  smokes.forEach(function(s){ if(s.team === team && smokeRadiusNow(s) < NADE.smoke.radius) L.push({x:s.x, y:s.y, owner:null, st:"forming"}); });
  return L;
}
function smokeLineWait(b, P, S){
  if(!S.length) return null;
  var R = NADE.smoke.radius, Q = enemyPositions(b.team);
  for(var i = 0; i < Q.length; i++){ var q = Q[i];
    if(Math.hypot(q.x-P.x, q.y-P.y) > SLW_R) continue;
    var s = S.filter(function(s){ return s.owner !== b.id && segPtDist(s.x, s.y, q.x, q.y, P.x, P.y) <= R; })[0]; if(!s) continue;
    if(!hasLOS(q.x, q.y, P.x, P.y) || hasLOS(q.x, q.y, b.x, b.y, null, b.z)) continue;
    return {s:s, q:q};
  }
  return null;
}
function smokeLineTick(){
  var tt = teamTac.T; if(!tt || tt.phase === "execute" || tt.phase === "postplant" || bomb.state === "planted") return;
  var S = null;
  bots.forEach(function(b){
    var W = b._slw && b._slw.round === roundNum ? b._slw : null, on = !!(W && W.on);
    var stop = function(){ if(on && b.post && b.post.tag === "smokeLine") clearPost(b); b._slw = {round:roundNum, t:tick, on:false}; };
    if(b.team !== "T" || !b.alive) return;
    if(b.nadeTask || b._sawEnemy || (bomb.carrier === b && b.planting)){ if(on) stop(); return; }
    if(W && tick - W.t < 16){ if(on) postKeep(b); return; }   // пересмотр раз в 0,25 с (BELIEF_STEP)
    var P = on ? W.dest : b.post; if(!P){ if(on) stop(); return; }   // ждущий — проверяется точка, куда шёл
    if(on && b.post && b.post.tag !== "smokeLine"){ b._slw = {round:roundNum, t:tick, on:false}; return; }   // пост перебила задача важнее
    if(S === null) S = smokeLinePending("T");
    var w = smokeLineWait(b, P, S);
    if(!w){ if(on) logEvent(b.id+": смок встал / его не будет — идёт дальше"); stop(); return; }
    if(!on){
      if(!setPost(b, {x:b.x, y:b.y}, {x:w.q.x, y:w.q.y}, true, "smokeLine")){ b._slw = {round:roundNum, t:tick, on:false}; return; }   // держит задача важнее
      logEvent(b.id+": ждёт смок у "+calloutName(w.s.x, w.s.y).replace(/^на /, "")+" — не выходит на линию с "+calloutName(w.q.x, w.q.y).replace(/^на /, "")); }
    else postKeep(b);
    b._slw = {round:roundNum, t:tick, on:true, dest:on ? W.dest : {x:P.x, y:P.y}};
  });
}
