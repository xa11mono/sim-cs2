// ======================= (v460, владелец 28.10) ПОКАЗ ТАКТИЧЕСКОЙ ПАУЗЫ — только показ, на игру не влияет =======================
// Пауза (TO_NOW, 130) — закупка дольше на TO_SEC. Пока она идёт, как на трансляции, сцены сменяют друг друга:
//   титр «Тактическая пауза» → доска тренера (план рисуется на мини-радаре) → разговор (портреты: тренер или IGL объясняет план,
//   IGL отвечает, игроки переговариваются — разной громкостью) → камера на спавн команды (живая игра, субтитры разговора) → «погнали».
// Что говорят — из настоящего плана (coachPlan: факты с числами); фразы-связки и болтовня — проектные. Язык — язык войса команды
// (RP_LANG, 675), русскоговорящие в англоязычной команде иногда по-русски (RP_RU). Часы — время игры: на паузе игры показ стоит.
var TS_K = {title: 2.5, board: 8, talk: 10, cam: 6};   // длительность сцен, с игры (сумма ≈ TO_SEC); проектные
var TS = {P: null, el: null, lastRound: -1};
function tsEls(){
  if(TS.el) return TS.el;
  var root = document.getElementById("to"); if(!root) return null;
  TS.el = {root: root, cv: root.querySelector(".to-board canvas"), board: root.querySelector(".to-board"), talk: root.querySelector(".to-talk"),
    title: root.querySelector(".to-title"), l3: root.querySelector(".to-l3"), sub: root.querySelector(".to-sub"), shade: root.querySelector(".to-shade"),
    skip: root.querySelector(".to-skip")};
  TS.el.skip.addEventListener("click", function(e){ e.stopPropagation(); tsStop(); });
  return TS.el;
}
function tsIgl(side){
  var team = bots.filter(function(b){ return b.team === side; });
  return team.filter(function(b){ return b.prof && /IGL/.test(b.prof.style||""); })[0] || team.filter(function(b){ return b.tRole === "igl" || b.tRole === "support"; })[0] || team[0];
}
// ---------- разговор: из фактов плана ----------
var TS_SAY = {
  ru: {
    open:  ["Так, слушаем все.", "Стоп, дышим. Слушаем.", "Ребята, внимание сюда.", "Так, без паники. Смотрим, что у нас."],
    deathsT:["Мы {n} раза из {of} умираем на {zone}. Эти раунды идём в обход.", "{zone} — уже {n} смерти за {of} раунда. Туда не идём, выбираем другой путь."],
    deathsCT:["Мы {n} раза из {of} умираем на {zone}. Эти раунды там не стоим.", "{zone} — {n} смерти за {of} раунда. Уходим оттуда, держим иначе."],
    exclProf:["Достаём «{tac}». В прошлых матчах против них заходила — {w} из {n}.", "У нас есть «{tac}» — против них она работала, {w} из {n}. Играем."],
    failed:["«{tac}» не заходит. Больше не играем.", "«{tac}» они читают. Убираем."],
    stackRead:["Они стакают {S} — {n} раунда из {of}. Идём {T}, быстро и вместе.", "На {S} у них толпа, {n} из {of}. Значит, {T}."],
    weakSite:["На {T} у них меньше людей: {a} против {b} за {of} раунда. Бьём {T}.", "{T} пустой — видели там меньше всех. Туда."],
    excl:  ["Есть заготовка — «{tac}». Они её ещё не видели.", "Достаём «{tac}». Этого они от нас не ждут."],
    tSite: ["Они {n} из {of} раз идут на {S}. Ставим больше людей на {S}.", "{S} — {n} заходов из {of}. Усиливаем {S}."],
    retake:["На {S} мы проигрываем после планта, {n} раза. Играем от ретейка.", "{S} не держим, отдаём и забираем ретейком."],
    readSetup:["Нашу «{setup}» прочитали. Меняем расстановку.", "«{setup}» больше не стоим, они её знают."],
    reset: ["Ничего не меняем. Просто играем свою игру, спокойно.", "Всё нормально, это просто раунды. Перезагрузились."],
    iglOk: ["Понял. Я колю.", "Окей, тогда так и делаем.", "Принял. Работаем.", "Всё ясно, я веду."],
    chat:  ["~спокойно, вывозим", "я флешку дам", "~окей", "давайте с утилитой в этот раз", "!ДАВАЙ, ПОДНЯЛИСЬ!", "~я за тобой зайду", "бля, соберёмся",
            "дайте мне угол на входе", "~норм, норм", "!ВСЁ, ПОГНАЛИ!", "я на трейд, не боимся"],
    close: ["!ПОГНАЛИ!", "!ДАВАЙ, ЗАБИРАЕМ!", "Всё, один раунд. Вперёд.", "!РАБОТАЕМ!"]
  },
  en: {
    open:  ["Okay, listen up.", "Stop, breathe. Listen.", "Guys, eyes here.", "Alright, no panic. Let's look at it."],
    deathsT:["We died at {zone} {n} times in {of}. These rounds we go around it.", "{zone} — {n} deaths in {of} rounds. We take another path."],
    deathsCT:["We died at {zone} {n} times in {of}. Nobody plays there these rounds.", "{zone} — {n} deaths in {of}. We hold it differently."],
    exclProf:["Pull out {tac}. It worked against them before — {w} of {n}.", "We have {tac} — it hit vs them, {w} of {n}. Let's play it."],
    failed:["{tac} isn't working. We drop it.", "They read {tac}. Gone."],
    stackRead:["They stack {S} — {n} of {of}. We go {T}, fast and together.", "{S} is packed, {n} of {of}. So {T}."],
    weakSite:["{T} has fewer guys: {a} vs {b} over {of} rounds. We hit {T}.", "{T} is light, we saw the fewest there. Go."],
    excl:  ["We have one saved — {tac}. They haven't seen it.", "Pull out {tac}. They won't expect it."],
    tSite: ["They hit {S} {n} of {of}. More bodies on {S}.", "{S} — {n} of {of}. Stack it."],
    retake:["We lose {S} after the plant, {n} times. Play it from retake.", "Give {S}, take it back on the retake."],
    readSetup:["They read our {setup}. We change it.", "No more {setup}, they know it."],
    reset: ["Nothing changes. Just play our game, calm.", "We're fine, it's just rounds. Reset."],
    iglOk: ["Got it. I'll call it.", "Okay, we do that.", "Copy. Let's work.", "Clear, I lead."],
    chat:  ["~calm, we got this", "I'll flash it", "~okay", "use the utility this time", "!LET'S GO, BOYS!", "~I'll trade you", "focus up",
            "give me the entry angle", "~fine, fine", "!COME ON!", "I'm on the trade, no fear"],
    close: ["!LET'S GO!", "!WE TAKE THIS!", "One round. Go.", "!LET'S WORK!"]
  },
  mix:  { chat: ["~давай, boys", "харош, focus", "!DAVAI DAVAI!", "~окей, okay", "blyat, focus up", "~спокойно, guys"] }
};
function tsFill(t, f){ return String(t).replace(/\{(\w+)\}/g, function(m, k){ return f[k] != null ? f[k] : m; }); }
function tsPick(list, key, T){ if(!list || !list.length) return {t: "", lvl: 2}; var t = list[rpHash(T.m + "|" + T.round + "|" + key) % list.length], lvl = 2;
  if(t.charAt(0) === "!"){ lvl = 3; t = t.slice(1); } else if(t.charAt(0) === "~"){ lvl = 1; t = t.slice(1); } return {t: lvl === 3 ? t.toUpperCase() : t, lvl: lvl}; }
function tsScript(T){
  var lang = RP_LANG[T.name] || "ru", L = TS_SAY[lang], side = T.side, igl = tsIgl(side), lead = T.caller === "coach" ? "coach" : igl.id, S = [];
  var team = bots.filter(function(b){ return b.team === side; });
  var say = function(who, cat, f, key){ var p = tsPick(L[cat], key || cat, T); S.push({who: who, t: tsFill(p.t, f || {}), lvl: p.lvl}); };
  say(lead, "open");
  T.plan.facts.forEach(function(f, i){ var key = f.k === "deaths" ? (side === "T" ? "deathsT" : "deathsCT") : f.k; if(L[key]) say(lead, key, f, key + i); });
  if(T.caller === "coach") say(igl.id, "iglOk");
  var others = team.filter(function(b){ return b.id !== igl.id; });
  for(var i = 0; i < 3 && others.length; i++){
    var b = others[rpHash(T.round + "|ch|" + i) % others.length]; others = others.filter(function(o){ return o !== b; });
    var mix = lang === "en" && RP_RU[nick(b.id)] && rpHash(T.round + "mx" + b.id) % 100 < 40;
    var p = tsPick(mix ? TS_SAY.mix.chat : L.chat, "ch" + b.id, T); S.push({who: b.id, t: p.t, lvl: p.lvl});
  }
  say(igl.id, "close");
  return S;
}
// ---------- доска: мини-радар и план ----------
function tsZoneXY(name){
  var best = null; (ZONEMAP.zones || []).forEach(function(z){ if(best || !z.points || !z.points.length) return; if(zoneMainName(ZONE_NAMES[z.id]) === name){ var c = centroidOf(z.points); best = c; } });
  return best;
}
function tsBoard(E, T, k){
  var c = E.cv, W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1;
  if(c.width !== Math.round(W*dpr) || c.height !== Math.round(H*dpr)){ c.width = Math.round(W*dpr); c.height = Math.round(H*dpr); }
  var x = c.getContext("2d"), B = OBS_BOUNDS || {x0: 0, y0: 0, x1: 2048, y1: 2048};
  if(!OBS_BOUNDS && typeof obsFullView === "function") obsFullView(wrapRect()), B = OBS_BOUNDS || B;
  var sc = Math.min(W/(B.x1 - B.x0), H/(B.y1 - B.y0)) * 0.96, ox = W/2 - (B.x0 + B.x1)/2*sc, oy = H/2 - (B.y0 + B.y1)/2*sc;
  x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0, 0, W, H);
  x.setTransform(dpr*sc,0,0,dpr*sc,dpr*ox,dpr*oy);
  if(imgReady){ x.globalAlpha = 0.55; x.drawImage(img, 0, 0, 2048, 2048); x.globalAlpha = 1; }
  var L = 1/sc, P = T.plan, ease = function(a){ a = Math.max(0, Math.min(1, a)); return 1 - Math.pow(1 - a, 3); };
  var chalk = "rgba(245,244,236,.95)", red = "rgba(255,110,96,.95)", gold = "rgba(255,214,110,.95)";
  var arrow = function(a, b, p, col){ if(!a || !b || p <= 0) return; var ex = a.x + (b.x - a.x)*p, ey = a.y + (b.y - a.y)*p;
    x.strokeStyle = col; x.lineWidth = 5*L; x.lineCap = "round"; x.setLineDash([16*L, 10*L]); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(ex, ey); x.stroke(); x.setLineDash([]);
    if(p >= 1){ var ang = Math.atan2(b.y - a.y, b.x - a.x), h = 22*L; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(b.x - Math.cos(ang - 0.45)*h, b.y - Math.sin(ang - 0.45)*h);
      x.moveTo(b.x, b.y); x.lineTo(b.x - Math.cos(ang + 0.45)*h, b.y - Math.sin(ang + 0.45)*h); x.stroke(); } };
  var ring = function(p0, r, p, col, txt){ if(!p0 || p <= 0) return; x.strokeStyle = col; x.lineWidth = 5*L; x.beginPath(); x.arc(p0.x, p0.y, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*Math.min(1, p)); x.stroke();
    if(txt && p >= 1){ x.fillStyle = col; x.font = "700 " + (30*L) + "px 'Roboto Condensed',sans-serif"; x.textAlign = "center"; x.textBaseline = "bottom"; x.fillText(txt, p0.x, p0.y - r - 8*L); } };
  var cross = function(p0, p, txt){ if(!p0 || p <= 0) return; var r = 20*L*Math.min(1, p*1.4); x.strokeStyle = red; x.lineWidth = 6*L;
    x.beginPath(); x.moveTo(p0.x - r, p0.y - r); x.lineTo(p0.x + r, p0.y + r); x.moveTo(p0.x + r, p0.y - r); x.lineTo(p0.x - r, p0.y + r); x.stroke();
    if(txt && p >= 1){ x.fillStyle = red; x.font = "600 " + (24*L) + "px 'Roboto Condensed',sans-serif"; x.textAlign = "left"; x.textBaseline = "middle"; x.fillText(txt, p0.x + 28*L, p0.y); } };
  var dots = function(p0, n, p, col){ if(!p0 || p <= 0) return; for(var i = 0; i < n; i++){ if(p*n < i + 0.5) break; var a = i/n*Math.PI*2; x.fillStyle = col; x.beginPath(); x.arc(p0.x + Math.cos(a)*40*L, p0.y + Math.sin(a)*40*L, 13*L, 0, Math.PI*2); x.fill(); x.strokeStyle = "#0b0f0b"; x.lineWidth = 2*L; x.stroke(); } };
  var t = 0.6, step = 1.6, isEn = (RP_LANG[T.name] || "ru") === "en";
  P.facts.forEach(function(f){
    var p = ease((k - t)/1.2);
    if(f.k === "deaths") cross(tsZoneXY(f.zone), p, f.zone + " ×" + f.n);
    else if(f.k === "stackRead"){ dots(SITES[f.S], 3, p, "#5a9bd9"); ring(SITES[f.S], 70*L, p, chalk, isEn ? "STACK" : "СТАК"); }
    else if(f.k === "weakSite" || f.k === "excl" || f.k === "exclProf"){ if(f.T){ arrow(T_SPAWN, SITES[f.T], p, gold); ring(SITES[f.T], 60*L, ease((k - t - 1)/0.8), gold, f.k !== "weakSite" ? (isEn ? "SAVED PLAY" : "ЗАГОТОВКА") : f.T); } }
    else if(f.k === "tSite"){ dots(SITES[f.S], 3, p, "#5a9bd9"); arrow(T_SPAWN, SITES[f.S], p, red); }
    else if(f.k === "retake"){ ring(SITES[f.S], 80*L, p, chalk, isEn ? "RETAKE" : "РЕТЕЙК"); if(GEO.rotator) arrow(GEO.rotator, SITES[f.S], ease((k - t - 0.6)/1), chalk); }
    else if(f.k === "failed" || f.k === "readSetup"){ /* в подписи доски */ }
    t += step;
  });
  if(P.side === "T" && P.site && !P.facts.some(function(f){ return f.T; })) arrow(T_SPAWN, SITES[P.site], ease((k - t)/1.2), gold);
  x.setTransform(1,0,0,1,0,0);
}
// ---------- показ ----------
function tsStart(T){
  var E = tsEls(); if(!E || !T) return false;
  TS.P = {T: T, t0: simTime, lines: tsScript(T), side: T.side, shown: -1, phase: "", manual: false};
  var team = bots.filter(function(b){ return b.team === T.side; }), igl = tsIgl(T.side), en = (RP_LANG[T.name] || "ru") === "en";
  var pips = ""; for(var i = 0; i < (T.round > regRounds() ? 1 : 3); i++) pips += '<i class="' + (i < T.left ? "on" : "") + '"></i>';
  var logo = TEAM_LOGO[T.side];
  E.title.innerHTML = '<div class="to-t1">ТАКТИЧЕСКАЯ ПАУЗА</div><div class="to-t2 ' + T.side.toLowerCase() + '">' + (logo ? '<img alt="" src="' + logo + '">' : '') + esc(T.name) + '</div>' +
    '<div class="to-t3">' + (T.caller === "coach" ? "взял тренер" : "взял " + esc(nick(igl.id))) + ' · ' + T.score.CT + ':' + T.score.T + ' · осталось <span class="to-pips">' + pips + '</span></div>';
  E.l3.innerHTML = (logo ? '<img alt="" src="' + logo + '">' : '') + '<div><b>' + esc(T.name) + '</b><span>тактическая пауза · ' + (T.caller === "coach" ? "тренер" : "IGL " + esc(nick(igl.id))) + '</span></div>';
  var cards = [{id: "coach"}].concat(team.map(function(b){ return {id: b.id}; }));
  E.talk.innerHTML = '<div class="to-row ' + T.side.toLowerCase() + '">' + cards.map(function(c, i){
    var b = c.id === "coach" ? null : teamBot(c.id), nm = b ? nick(b.id) : (en ? "Coach" : "Тренер"), ph = b ? plPhoto(b) : PL_SIL;
    var tag = c.id === "coach" ? (en ? "COACH" : "ТРЕНЕР") : (b === igl ? "IGL" : "");
    return '<div class="to-card' + (c.id === "coach" ? " coach" : "") + '" data-id="' + c.id + '" style="--i:' + i + '"><div class="to-say"></div><div class="to-ph">' + ph + '</div>' +
      '<div class="to-nm">' + esc(nm) + (tag ? '<i>' + tag + '</i>' : '') + '</div></div>'; }).join("") + '</div><div class="to-log"></div>';
  E.sub.innerHTML = "";
  E.root.className = "on " + T.side.toLowerCase() + (typeof HUD_REDUCED !== "undefined" && HUD_REDUCED ? " rm" : "");
  return true;
}
function tsStop(){ var P = TS.P; if(P && P.phase !== "out"){ P.outAt = simTime; P.phase = "out"; P.outReal = performance.now(); } }
function tsEnd(){ TS.P = null; var E = tsEls(); if(E){ E.root.className = ""; E.talk.innerHTML = ""; E.sub.innerHTML = ""; } if(typeof OBS !== "undefined") OBS.sc = 0; }
// по кадру (680, после повтора клатча): true — экран нарисован здесь (сцены поверх); false — обычная отрисовка
function tsFrame(ts){
  if(typeof TO_NOW === "undefined") return false;
  // пауза этого раунда: закупка идёт, повтор клатча не играет — начинаем
  if(!TS.P && TO_NOW && roundState === "freeze" && roundNum === TO_NOW.round && TS.lastRound !== roundNum && !(RP && RP.on)){ TS.lastRound = roundNum; tsStart(TO_NOW); }
  var P = TS.P; if(!P) return false;
  var E = tsEls(); if(!E){ TS.P = null; return false; }
  if(!P.manual && (roundState !== "freeze" || roundNum !== P.T.round)){ tsEnd(); return false; }
  var el = P.manual ? (performance.now() - P.r0)/1000 : simTime - P.t0, K = TS_K;
  var tTitle = K.title, tBoard = tTitle + K.board, tTalk = tBoard + K.talk, tCam = tTalk + K.cam, tEnd = tCam + 3.5;
  if(!P.manual && roundStartTime - simTime < 1.2) tsStop();
  var ph = el < tTitle ? "title" : el < tBoard ? "board" : el < tTalk ? "talk" : el < tCam ? "cam" : el < tEnd ? "talk2" : "out";
  if(P.phase === "out"){ ph = "out"; }
  if(ph === "out"){ var oe = (performance.now() - (P.outReal || (P.outReal = performance.now())))/1000; E.shade.style.opacity = Math.min(1, oe/0.5).toFixed(3); if(oe >= 0.5){ tsEnd(); return false; } return true; }
  if(ph !== P.phase){ P.phase = ph; E.root.setAttribute("data-scene", ph); P.phT = el; }
  E.shade.style.opacity = el < 0.4 ? (1 - el/0.4).toFixed(3) : (ph === "talk" && el - tBoard < 0.3) || (ph === "cam" && el - tTalk < 0.3) ? "0.6" : "0";
  // реплики: по одной, равномерно на разговор (talk + cam + talk2), с первой — в сцене talk
  var n = P.lines.length, span = (tEnd - 0.5) - tBoard, li = el < tBoard ? -1 : Math.min(n - 1, Math.floor((el - tBoard)/(span/n)));
  if(li !== P.shown){ P.shown = li; tsLine(E, P, li); }
  if(ph === "board") tsBoard(E, P.T, el - tTitle);
  if(ph === "cam"){ tsCam(P); return false; }   // живая игра под субтитрами: камера на спавне команды
  return true;
}
function tsLine(E, P, li){
  var cards = E.talk.querySelectorAll(".to-card");
  for(var i = 0; i < cards.length; i++){ cards[i].classList.remove("talking"); var sy = cards[i].querySelector(".to-say"); sy.className = "to-say"; sy.innerHTML = ""; }
  if(li < 0) return;
  var L = P.lines[li], c = E.talk.querySelector('.to-card[data-id="' + L.who + '"]');
  if(c){ c.classList.add("talking"); var s = c.querySelector(".to-say"); s.className = "to-say lvl" + L.lvl + " in"; s.innerHTML = "<b>" + esc(L.t) + "</b>"; }
  var who = L.who === "coach" ? ((RP_LANG[P.T.name] || "ru") === "en" ? "Coach" : "Тренер") : nick(L.who);
  var log = E.talk.querySelector(".to-log");
  if(log){ var d = document.createElement("div"); d.className = "to-ll"; d.innerHTML = "<b>" + esc(who) + "</b>" + esc(L.t); log.appendChild(d); while(log.children.length > 4) log.removeChild(log.firstChild); }
  E.sub.innerHTML = '<div class="to-sl lvl' + L.lvl + '"><b>' + esc(who) + '</b>' + esc(L.t) + '</div>';
}
// камера на спавне команды: свой кадр, обсервер не трогает (вызов draw — обычный, 680)
function tsCam(P){
  var team = bots.filter(function(b){ return b.team === P.side && b.alive; }); if(!team.length) return;
  var c = centroidOf(team), r = wrapRect(), span = 520, sc = Math.min(r.width, r.height)/span, k = 0.06;
  if(!P.cam){ P.cam = {x: c.x, y: c.y, s: sc*0.8}; }
  P.cam.x += (c.x - P.cam.x)*k; P.cam.y += (c.y - P.cam.y)*k; P.cam.s += (sc - P.cam.s)*0.04;
  view.scale = P.cam.s; view.panX = r.width/2 - P.cam.x*P.cam.s; view.panY = r.height/2 - P.cam.y*P.cam.s;
}
// показать последнюю паузу ещё раз (кнопка «Инструменты»): по реальному времени, игра идёт своим ходом
function tsReplayLast(){
  if(!TO_LAST){ if(typeof showBanner === "function") showBanner("Пауз в этом матче ещё не было", null, 1800); return; }
  if(tsStart(TO_LAST)){ TS.P.manual = true; TS.P.r0 = performance.now(); }
}
(function(){
  if(typeof document === "undefined") return;
  var b = document.getElementById("btnToLast"); if(b) b.addEventListener("click", tsReplayLast);
  var f = document.getElementById("btnToTake"); if(f) f.addEventListener("click", function(){ TO_FORCE = true; if(typeof showBanner === "function") showBanner("Пауза: возьмёт команда, проигравшая этот раунд", null, 2200); });
  // (v461) раунды для просмотра — из замера v461 на ПК (16 матчей): клатч 1v5 (м17 р27), пауза T, раунд взяли (м13 р7)
  var c = document.getElementById("btnRpGo"); if(c) c.addEventListener("click", function(){ rpGoto(17, 27); });
  var g = document.getElementById("btnToGo"); if(g) g.addEventListener("click", function(){ rpGoto(13, 7); });
})();
