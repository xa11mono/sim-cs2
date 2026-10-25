// ======================= КОМАНДНЫЙ ПЛАН ГРАНАТ (v428, PRINCIPLES М160) =======================
// Одно место: какие гранаты команда покупает на раунд, у кого какая и на какой момент — и можно ли бойцу кинуть её сейчас.
// Владелец 25.10: «каждый покупает гранаты своей зоны и кидает их в своей зоне (ретейк, выбивание, помощь — исключение); часть
// оставляет на ретейк; у команды общая картина гранат». Данные (Mirage, 33 тыс. бросков про): с сайта на сайт про почти не кидают
// (CT до контакта 1 %, T 0 %); у CT до контакта 9,5 гранаты за раунд, по коллу 0,65, на ретейке 0,34 — у ботов было 5,5 / 2,2 / 0,05.
//   сколько каких гранат на раунд — MAP.pro.nadesBy (tools/nades_pro.py: брошено за раунд на команду по типу раунда);
//   на какой момент и в какую зону — MAP.nadeplan (tools/nadeplan_bake.py: доли бросков про «момент|зона» для каждого типа).
//   момент: CT — now (до контакта) → call (увидели T) → retake;  T — now (сетап) → exec (выход) → postplant.
//   зона: A / B / mid — сторона карты (posSideOf, 280): у CT — сторона его места в расстановке, у T — сайт его группы в тактике.
// План строится в закупе — после выбора тактики и расстановки (buyPhase, 530): команда знает план раунда и покупает под него.
// Гранату на поздний момент раньше не кидают (её берегут) — кроме последнего живого; на свой момент и позже — можно.
var NP_ORDER = {CT: {now: 0, call: 1, retake: 2}, T: {now: 0, exec: 1, postplant: 2}};
var NP_LABEL = {now: "сейчас", call: "колл", retake: "ретейк", exec: "выход", postplant: "после планта"};

// зона места на карте: A / B / mid (сторона зоны — posSideOf)
function npZoneAt(x, y){
  var nm = zoneUserName(zoneIdAt(x, y)), s = nm ? posSideOf(nm) : null;
  if(!s){ var c = [["A", SITES.A], ["B", SITES.B], ["M", GEO.ctMid]].map(function(q){ return [q[0], Math.hypot(x-q[1].x, y-q[1].y)]; }).sort(function(a, d){ return a[1]-d[1]; }); s = c[0][0]; }
  return s === "M" ? "mid" : s;
}
// зона бойца в этом раунде — из плана раунда: CT — сторона мест его роли в расстановке; T — сайт его группы тактики (мид — TMID),
// лёркер — другой сайт (lurkerBrain), без группы — как раздаёт tBrain по стилю тактики
function npZoneOf(b){
  if(b.team === "CT"){
    var S = teamTac.CT && teamTac.CT.setup, R = S && S.roles && S.roles[b.tRole];
    var names = (R && R.pos) || (R && R.early && R.early.pos) || [], c = {};
    names.forEach(function(nm){ var s = posSideOf(nm); if(s) c[s] = (c[s]||0) + 1; });
    var s = Object.keys(c).sort(function(a, d){ return c[d] - c[a]; })[0] || (b.tRole === "anchorA" ? "A" : b.tRole === "anchorB" ? "B" : "M");
    return s === "M" ? "mid" : s;
  }
  var tt = teamTac.T, tac = tt && tt.tac; if(!tac) return "mid";
  var other = tac.site === "A" ? "B" : "A";
  if(b.tRole === "lurker") return other;
  if(tac.style === "rush") return tac.site;
  var G = (tac.groups || []).filter(function(g){ return (g.roles || []).indexOf(b.tRole) >= 0; })[0];
  if(G) return G.stage === "TMID" ? "mid" : tac.site;
  if(tac.groups && tac.style !== "fake") return "mid";
  if(tac.style === "default") return (b.tRole === "entry" || b.tRole === "support") ? other : b.tRole === "awp" ? "mid" : tac.site;
  if(tac.style === "split") return (b.tRole === "entry" || b.tRole === "igl") ? tac.site : "mid";
  return b.tRole === "support" ? "mid" : tac.site;   // exec, fake: поддержка — мид / фейк, остальные — у цели
}
// момент раунда для команды бойца сейчас
function npMomentNow(b){
  if(b.team === "CT"){ if(bomb && bomb.state === "planted") return "retake"; var ct = teamTac.CT; return (ct && ct.call && ct.call.count >= 1) ? "call" : "now"; }
  if(bomb && bomb.state === "planted") return "postplant";
  var tt = teamTac.T; return (tt && (tt.phase === "execute" || preExecNow(tt))) ? "exec" : "now";
}
// доля «момент|зона» → выбор по случайному числу u
function npPick(sh, u){
  var ks = Object.keys(sh || {}); if(!ks.length) return ["now", null];
  var tot = ks.reduce(function(a, k){ return a + sh[k]; }, 0), r = u*tot;
  for(var i = 0; i < ks.length; i++){ r -= sh[ks[i]]; if(r <= 0) return ks[i].split("|"); }
  return ks[ks.length-1].split("|");
}
// план гранат команды на раунд: сколько — MAP.pro.nadesBy[team][rt]; каждая граната — момент и зона по долям про (MAP.nadeplan);
// её покупает боец этой зоны (меньше гранат в плане, больше денег), в зоне некому — кому угодно, тогда и зона — его.
// Возвращает {id: [типы]} (для закупа); у плана — items {id: [{t, m, z}]}: хозяин гранаты получает их при покупке (npBought)
function teamNadePlan(team, rt){
  var E = teamEco[team] || (teamEco[team] = {}), key = matchNum+":"+roundNum+":"+rt;
  if(E._tnp && E._tnp.k === key) return E._tnp.plan;
  var hr = function(n){ return hashRand(matchNum*131 + roundNum*17 + (team === "CT" ? 7 : 3) + n*29); };
  var NB = ((MAP.pro.nadesBy || {})[team] || {})[rt] || {}, SH = (MAP.nadeplan || {})[team] || {}, want = [], n = 0;
  ["smoke", "flash", "molly", "he"].forEach(function(t, ti){
    var e = NB[t] || 0, k = Math.floor(e) + (hr(ti+1) < e - Math.floor(e) ? 1 : 0);
    for(var i = 0; i < k; i++){ var mz = npPick(SH[t], hr(50 + n++)); want.push({t:t, m:mz[0], z:mz[1] === "mid" || mz[1] === "A" || mz[1] === "B" ? mz[1] : null}); }
  });
  var ps = bots.filter(function(o){ return o.team === team; }), zone = {}, plan = {}, items = {}, cost = {};
  ps.forEach(function(o){ zone[o.id] = npZoneOf(o); });
  var cap = rt === "pistol" ? function(o){ return 800; } : function(o){ return o.money; };
  want.forEach(function(it){
    var pr = nadePrice(it.t, team);
    var fits = function(o){ var have = plan[o.id] || []; return (cost[o.id]||0) + pr <= cap(o) && have.length < 4 && have.filter(function(x){ return x === it.t; }).length < (it.t === "flash" ? 2 : 1); };
    var ok = ps.filter(fits), inZ = ok.filter(function(o){ return !it.z || zone[o.id] === it.z; }), pool = inZ.length ? inZ : ok;
    if(!pool.length) return;
    pool.sort(function(a, c){ return ((plan[a.id]||[]).length - (plan[c.id]||[]).length) || (c.money - a.money); });
    var o = pool[0];
    (plan[o.id] = plan[o.id] || []).push(it.t); (items[o.id] = items[o.id] || []).push({t:it.t, m:it.m, z:zone[o.id]});
    cost[o.id] = (cost[o.id]||0) + pr;
  });
  E._tnp = {k:key, plan:plan, items:items};
  return plan;
}
// перед закупом: гранаты, оставшиеся с прошлого раунда, — без плана (кидать можно в любой момент)
function npRoundStart(b){ b._nplan = []; if(b.nades) ["smoke","flash","molly","he"].forEach(function(t){ for(var i = 0; i < (b.nades[t]||0); i++) b._nplan.push({t:t, m:"now", z:null}); }); }
// куплена граната t — у бойца появляется запись плана (момент и зона); не из плана — «сейчас», своя зона
function npBought(b, t){
  var E = teamEco[b.team] || {}, L = (E._tnp && E._tnp.items && E._tnp.items[b.id]) || [], i;
  for(i = 0; i < L.length; i++) if(L[i].t === t && !L[i].got){ L[i].got = true; (b._nplan = b._nplan || []).push({t:t, m:L[i].m, z:L[i].z}); return; }
  (b._nplan = b._nplan || []).push({t:t, m:"now", z:npZoneOf(b)});
}
// можно ли бойцу кинуть гранату t на момент m в зону z (z = null — зона не важна): есть граната, отложенная не на более поздний
// момент (и в своей зоне, если зона задана); последний живой — что угодно; граната вне плана (подобрал) — свободна
function npCanUse(b, t, m, z){
  var L = (b._nplan || []).filter(function(it){ return it.t === t; });
  if(!L.length || aliveCount(b.team) === 1) return true;
  var O = NP_ORDER[b.team];
  return L.some(function(it){ return O[it.m] <= O[m] && (!z || !it.z || it.z === z); });
}
// почему нельзя — для лога: на какой момент она отложена
function npWhyNot(b, t){ var it = (b._nplan || []).filter(function(q){ return q.t === t; })[0]; return it ? "бережёт на «"+(NP_LABEL[it.m] || it.m)+"»" : ""; }
// граната брошена — запись плана снята: той, что на этот момент, иначе самой ранней из доступных
function npUse(b, t, m){
  var L = b._nplan || [], O = NP_ORDER[b.team], best = -1;
  for(var i = 0; i < L.length; i++){ if(L[i].t !== t) continue; if(L[i].m === m){ best = i; break; } if(O[L[i].m] <= O[m] && (best < 0 || O[L[i].m] < O[L[best].m])) best = i; }
  if(best < 0) for(i = 0; i < L.length; i++) if(L[i].t === t){ best = i; break; }
  if(best >= 0) L.splice(best, 1);
}
