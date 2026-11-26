// [хозяева: rpEmotions, rpGoto] замедление вокруг фрагов клатча (плавно)
function rpSpeed(P){
  var sg = P.segs[P.si], best = 1; if(!sg) return 1;
  sg.m.forEach(function(m){ if(m.kind !== "kill" && m.kind !== "defuse") return; var d = Math.abs(P.rt - m.t)/TICK_HZ;
    if(d < RP_K.slowR){ var f = d/RP_K.slowR, v = RP_K.slow + (1 - RP_K.slow)*f*f; if(v < best) best = v; } });
  return best;
}
// снимок записи на дробный тик: между двумя соседними — плавно
function rpAt(R, t){
  var i = rpIndexAt(R, t), A = R.s[i], B = R.s[Math.min(R.s.length-1, i+1)];
  var f = B.t > A.t ? Math.max(0, Math.min(1, (t - A.t)/(B.t - A.t))) : 0;
  return {A: A, B: B, f: f};
}
function rpDraw(E, x, P, dt, W, H, dpr){
  P.drawn = true;
  var R = P.R, I = rpAt(R, P.rt), A = I.A, B = I.B, f = I.f, n = bots.length, ci = P.ci;   // (v463) x, dpr переопределяются после кадра игры
  var bx = function(i){ return A.b[i*RP_NB] + (B.b[i*RP_NB] - A.b[i*RP_NB])*f; }, by = function(i){ return A.b[i*RP_NB+1] + (B.b[i*RP_NB+1] - A.b[i*RP_NB+1])*f; };
  // камера: клатчер и ближайший живой враг (≤ 800) или тот, кого он убьёт / убил рядом по времени — оба в кадре
  var cx = bx(ci), cy = by(ci), tx = cx, ty = cy, span = 720, foe = -1, fd = 800;
  var sg = P.phase === "clip" || P.phase === "cut" ? P.segs[P.si] : null;
  if(sg) sg.m.forEach(function(m){ if(m.kind === "kill" && Math.abs(m.t - P.rt) < 1.6*TICK_HZ){ var vi = rpBotIdx(m.k.vic); if(vi >= 0){ var d = Math.hypot(bx(vi)-cx, by(vi)-cy); if(d < 900){ foe = vi; fd = -1; } } } });
  if(foe < 0) for(var i = 0; i < n; i++){ if(bots[i].team === R.clutch.side || !A.b[i*RP_NB+3]) continue; var d = Math.hypot(bx(i)-cx, by(i)-cy); if(d < fd){ fd = d; foe = i; } }
  // дефуз / плант клатчера — камера на нём, без дальних врагов
  if(A.b[ci*RP_NB+7]) foe = -1;
  if(foe >= 0){ var ox = bx(foe), oy = by(foe); tx = (cx + ox)/2; ty = (cy + oy)/2; span = Math.min(1150, Math.max(600, Math.hypot(ox-cx, oy-cy)*2.3)); }
  var slowNow = rpSpeed(P) < 0.9; if(slowNow && P.phase === "clip") span *= 0.86;
  var off = Math.hypot(tx-cx, ty-cy), om = 0.3*span; if(off > om){ tx = cx + (tx-cx)*om/off; ty = cy + (ty-cy)*om/off; }
  var top = H*0.09, bot = H*0.09, avH = H - top - bot, sc = Math.min(W, avH)/span;
  if(!P.cam) P.cam = {x: tx, y: ty, s: sc};
  var k = 1 - Math.exp(-dt*3.5), ks = 1 - Math.exp(-dt*2.2);
  P.cam.x += (tx - P.cam.x)*k; P.cam.y += (ty - P.cam.y)*k; P.cam.s += (sc - P.cam.s)*ks;
  var S = P.cam.s, ox0 = W/2 - P.cam.x*S, oy0 = top + avH/2 - P.cam.y*S;
  // (v463, владелец: «повтор без деталей, не тот дизайн, нет анимации стрельбы, взрыва») кадр повтора рисует сама игра (draw, draw) —
  // по записанному миру этого тика (rpWorldPut), со всеми эффектами; поверх — только подсветка клатчера и вспышка фрага
  rpWorldDraw(E, P, I, S, ox0, oy0, W, H);
  x = E.ctx; dpr = 1;
  x.setTransform(S,0,0,S,ox0,oy0);
  var L = 1/S;
  var d3on = typeof D3 !== "undefined" && D3.on && D3.gl;   // (v573) в 3D подсветку клатчера рисует 3D (белое кольцо), радарные кольца не нужны
  if(!d3on) (function(){ var i = ci, px = bx(i), py = by(i);
    if(!A.b[i*RP_NB+3]) return;
    var rad = 7*L, pul = 1 + 0.12*Math.sin(performance.now()/180);
    x.strokeStyle = "rgba(255,214,110,.95)"; x.lineWidth = 2.4*L; x.beginPath(); x.arc(px, py, rad + 7*L*pul, 0, Math.PI*2); x.stroke();
    var nm = R.nick[bots[i].id]; x.font = "600 " + (10*L) + "px 'Roboto Condensed','Golos Text',sans-serif"; x.textAlign = "center"; var tw = x.measureText(nm).width;
    x.fillStyle = "rgba(11,15,11,.8)"; x.fillRect(px - tw/2 - 4*L, py + rad + 9*L, tw + 8*L, 13*L); x.fillStyle = "#ffe49a"; x.textBaseline = "top"; x.fillText(nm, px, py + rad + 10.5*L); x.textBaseline = "alphabetic";
  })();
  // фраг клатчера: вспышка-кольцо у жертвы
  if(sg && !d3on) sg.m.forEach(function(m){ if(m.kind !== "kill") return; var a2 = (P.rt - m.t)/(0.7*TICK_HZ); if(a2 < 0 || a2 > 1) return; var vi = rpBotIdx(m.k.vic); if(vi < 0) return;
    x.strokeStyle = "rgba(255,228,150," + (1 - a2).toFixed(3) + ")"; x.lineWidth = 3*L; x.beginPath(); x.arc(bx(vi), by(vi), (10 + 34*a2)*L, 0, Math.PI*2); x.stroke(); });
  x.setTransform(1,0,0,1,0,0);
  RP.sndOwn = true; try{ rpSound(P, R, ci); } finally { RP.sndOwn = false; }
}
// (v461) звук повтора: выстрелы и дефуз в свой момент клипа, громкость — по камере повтора. Звуковой движок (app) меряет расстояние от
// центра живого радара — поэтому точка звука переносится: живой центр + (точка − центр камеры повтора). Заплатка (одно место звука)
function rpSound(P, R, ci){
  if(!SND || !SND.on || !SND.ctx || !P.cam) return;
  var from = P.sndRt == null || P.sndRt > P.rt ? P.rt - 1 : P.sndRt; P.sndRt = P.rt;
  if(P.phase !== "clip") return;
  var r = cv.getBoundingClientRect(), c = navScreenToWorld(r.left + r.width/2, r.top + r.height/2);
  var mv = function(x, y){ return {x: c.x + (x - P.cam.x), y: c.y + (y - P.cam.y)}; }, n = 0;
  for(var j = rpTrFrom(R, from); j < R.tr.length && R.tr[j].t <= P.rt && n < 3; j++){ var T = R.tr[j]; if(T.t <= from) continue;
    var q = mv(T.x1, T.y1); sndShot(T.wk ? {key: T.wk, silenced: T.sil} : {key: T.wc === "awp" ? "AWP" : T.wc === "deagle" ? "DEAGLE" : T.wc === "pistol" ? "USP" : T.wc === "smg" ? "MP9" : "M4"}, q.x, q.y); n++; }   // (v465) звук — точного оружия выстрела (wk, глушитель), раньше — по классу следа: AK звучал как M4
  var I = rpAt(R, P.rt), J = rpAt(R, from), a1 = I.A.b[ci*RP_NB+7], a0 = J.A.b[ci*RP_NB+7];
  if(a1 < 0 && !(a0 < 0)){ var q2 = mv(I.A.b[ci*RP_NB], I.A.b[ci*RP_NB+1]); sndBomb("defuse", q2.x, q2.y); }
  R.kills.forEach(function(k){ if(k.att === R.clutch.id && k.t > from && k.t <= P.rt) showSnd("hit", 0.25); });
  // (v518d, владелец А-35: «в повторах нет пиканья бомбы») писк — по тому же расписанию, что в игре (bombBeepTick, app), по времени повтора
  var PL = R.ev.filter(function(e){ return e.kind === "plant"; })[0];
  if(PL){ var eT = PL.t + BOMB_TICKS, stopT = R.ev.filter(function(e){ return e.kind === "defuse" || e.kind === "boom"; }).reduce(function(m, e){ return Math.min(m, e.t); }, eT);
    if(!R._bp){ var pi = rpBotIdx(PL.id), IP = rpAt(R, PL.t); R._bp = pi >= 0 ? {x: IP.A.b[pi*RP_NB], y: IP.A.b[pi*RP_NB+1]} : null; }
    for(var bt = PL.t, guard = 0; bt <= Math.min(P.rt, stopT) && guard < 800; guard++){
      if(bt > from && R._bp){ var qb = mv(R._bp.x, R._bp.y); sndBomb("beep", qb.x, qb.y); }
      bt += Math.round(Math.max(0.1, Math.min(1, 0.1 + 0.9*((eT - bt)/TICK_HZ)/40))*TICK_HZ); } }
  R.ev.forEach(function(e){ if(e.kind === "defuse" && e.t > from && e.t <= P.rt){ var q3 = mv(I.A.b[ci*RP_NB], I.A.b[ci*RP_NB+1]); sndBomb("defused", q3.x, q3.y); } });
}
// подставить записанный мир в игру на один вызов draw и вернуть всё обратно (игра этого не видит: между тиками, без изменений)
function rpWorldDraw(E, P, I, S, ox0, oy0, W, H){
  var R = P.R, A = I.A.w, B = (I.B && I.B.w) || A, f = I.f; if(!A){ return; }
  var keep = {tick: tick, simTime: simTime, roundNum: roundNum, roundState: roundState, accumulator: accumulator, smokes: smokes, fires: fires, nadesInAir: nadesInAir,
    nadeFx: nadeFx, bomb: bomb, tracers: tracers, soundPings: soundPings, groundWeapons: groundWeapons, groundItems: groundItems, teamTac: teamTac,
    FREEZE_FX: FREEZE_FX, SIDE_TEAM: SIDE_TEAM, NICKS: NICKS, cv: cv, ctx: ctx, view: {scale: view.scale, panX: view.panX, panY: view.panY}};
  var saved = bots.map(function(o){ var c = {px: o.px, py: o.py, pfacing: o.pfacing, path: o.path, _trail: o._trail}; RP_BF.forEach(function(k){ c[k] = o[k]; }); return c; });
  var gw = null, gi = null; for(var j = R.s.indexOf(I.A); j >= 0; j--){ var w = R.s[j].w; if(w && w.gw){ gw = w.gw; gi = w.gi; break; } }
  try{
    clockSet(A.tick); simTime = tick*TICK_MS/1000; roundNum = R.round; roundState = "live"; clockAcc(f*TICK_MS);
    nadeWorldSet(A.sm, A.fi, A.nd, A.fx); groundWeapons = gw || []; groundItems = gi || [];
    bomb = A.bomb ? rpCl(A.bomb) : null; if(bomb) bomb.carrier = A.bc >= 0 ? bots[A.bc] : null;
    var t0 = rpTrFrom(R, P.rt - 0.5*TICK_HZ), tl = [];
    for(var q = t0; q < R.tr.length && R.tr[q].t <= P.rt; q++){ var c = rpCl(R.tr[q]); c.born = nowTs - (P.rt - c.t)*TICK_MS; c.tk = null; tl.push(c); }
    tracers = tl; soundPings = []; teamTac = {T: null, CT: keep.teamTac && keep.teamTac.CT}; FREEZE_FX = [];
    if(R.side){ SIDE_TEAM = R.side; } if(R.NK){ NICKS = R.NK; }
    bots.forEach(function(o, i){ var a = A.b[i], b2 = B.b[i]; RP_BF.forEach(function(k){ o[k] = b2[k]; });
      o.px = a.x; o.py = a.y; o.pfacing = a._visFacing !== undefined ? a._visFacing : a.facing; movePath(o, null, "replay"); o._trail = []; });
    cv = E.cv; ctx = E.ctx; view.scale = S; view.panX = ox0; view.panY = oy0;
    draw.noHud = true; draw();
    // (v573, Д6) включён 3D-вид — кадр повтора в 3D: тот же записанный мир, камера повтора; кадр копируется в холст повтора
    if(typeof D3 !== "undefined" && D3.on && D3.gl){ d3Frame({w: W, h: H, noTags: true, focus: bots[P.ci] && bots[P.ci].id}); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(D3.gl.canvas, 0, 0, W, H); }
  } catch(e){ /* кадр повтора не нарисовался — дальше игра не страдает: всё возвращается ниже */ }
  finally {
    draw.noHud = false;
    bots.forEach(function(o, i){ var c = saved[i]; RP_BF.forEach(function(k){ o[k] = c[k]; }); o.px = c.px; o.py = c.py; o.pfacing = c.pfacing; movePath(o, c.path, "replay"); o._trail = c._trail; });
    clockSet(keep.tick); simTime = keep.simTime; roundNum = keep.roundNum; roundState = keep.roundState; clockAcc(keep.accumulator);
    nadeWorldSet(keep.smokes, keep.fires, keep.nadesInAir, keep.nadeFx); bomb = keep.bomb; tracers = keep.tracers; soundPings = keep.soundPings;
    groundWeapons = keep.groundWeapons; groundItems = keep.groundItems; teamTac = keep.teamTac; FREEZE_FX = keep.FREEZE_FX; SIDE_TEAM = keep.SIDE_TEAM; NICKS = keep.NICKS;
    cv = keep.cv; ctx = keep.ctx; view.scale = keep.view.scale; view.panX = keep.view.panX; view.panY = keep.view.panY;
  }
}
function rpTrFrom(R, t){ var lo = 0, hi = R.tr.length; while(lo < hi){ var mid = (lo + hi) >> 1; if(R.tr[mid].t < t) lo = mid + 1; else hi = mid; } return lo; }
// киллфид повтора: строки появляются в момент фрага; счётчик фрагов клатча
function rpFeed(E, P){
  if(P.phase !== "clip" && P.phase !== "cut") return;
  var R = P.R, C = R.clutch, add = false, kc = 0;
  R.kills.forEach(function(k, i){ if(k.t > P.rt) return; if(k.att === C.id && k.vicTeam !== C.side) kc++;
    if(P.feedShown[i] || P.rt - k.t > 4*TICK_HZ) return; if(k.t < P.segs[P.si].a - 0.2*TICK_HZ) return; P.feedShown[i] = 1; add = true;
    var W = WEAPONS[k.w], wn = W ? W.name : k.w, wkey = k.w === "KNIFE" && k.attTeam === "T" ? "KNIFE_T" : k.w;
    var row = document.createElement("div"); row.className = "kf" + (k.att === C.id ? " me" : "");
    var h = k.attN ? '<span class="' + String(k.attTeam).toLowerCase() + '">' + esc(k.attN) + '</span>' : '';
    h += (typeof kfSvg === "function" && kfSvg(wkey, "wp", wn)) || '<span class="w">' + esc(wn) + '</span>';
    ["smoke","wall","hs","noscope","blind"].forEach(function(m){ if(k[m] && typeof kfSvg === "function") h += kfSvg(m, "md", KF_MOD_T[m]); });
    row.innerHTML = h + '<span class="' + String(k.vicTeam).toLowerCase() + '">' + esc(k.vicN) + '</span>';
    E.feed.insertBefore(row, E.feed.firstChild); while(E.feed.children.length > 5) E.feed.removeChild(E.feed.lastChild); });
  var ke = E.l3.querySelector(".rp-k"); if(ke && ke.textContent !== String(kc)){ ke.textContent = String(kc); ke.classList.remove("pop"); void ke.offsetWidth; ke.classList.add("pop"); }
}
// размытие фона без filter (дёшево): последний кадр — в маленький холст и обратно, растянутым, плюс затемнение
function rpBlurBg(E, x){
  var c = E.cv, s = document.createElement("canvas"); s.width = Math.max(8, Math.round(c.width/14)); s.height = Math.max(8, Math.round(c.height/14));
  var sx = s.getContext("2d"); sx.imageSmoothingEnabled = true; sx.drawImage(c, 0, 0, s.width, s.height);
  var m = document.createElement("canvas"); m.width = Math.max(8, Math.round(c.width/5)); m.height = Math.max(8, Math.round(c.height/5));
  var mx = m.getContext("2d"); mx.imageSmoothingEnabled = true; mx.drawImage(s, 0, 0, m.width, m.height);
  x.setTransform(1,0,0,1,0,0); x.imageSmoothingEnabled = true; x.drawImage(m, 0, 0, c.width, c.height);
  x.fillStyle = "rgba(6,8,6,.55)"; x.fillRect(0, 0, c.width, c.height);
}
// ---------- эмоции: портреты в строчку, что кричат и что последним сказали ----------
// Реакции — проектные фразы (показ, владелец 28.10): живые, разговорные, с матом, разной громкости — не все орут: кто-то просто «nice»,
// проигравшие чаще спокойно («nt», «ладно, следующий»). Громкость — значок в начале фразы: «!» — крик (заглавными, встряска),
// без значка — обычным голосом, «~» — тихо. Язык — язык войса команды (Falcons — английский, Spirit — русский); русскоговорящие
// в англоязычной команде иногда срываются на русский, и тиммейты подхватывают («хорош, братан», «бля, nice») — пул mix.
// Вариант — от номера матча/раунда и игрока (повтор того же раунда — те же фразы).
var RP_LANG = {"Team Falcons": "en", "Team Spirit": "ru"};
var RP_RU = {"m0NESY": 1, "kyousuke": 1, "donk": 1, "sh1ro": 1, "zont1x": 1, "magixx": 1};   // говорят по-русски
var RP_SAY = {
  ru: {
    hero: ["!ДА БЛЯТЬ!", "!ИЗИ НАХУЙ!", "!ЗАБРАЛ, СУКА!", "!ДАААА, ЕБАТЬ!", "!ВОТ ЭТО Я ВЫДАЛ!", "!КТО ТАМ ГОВОРИЛ, ЧТО Я НЕ ВЫВОЖУ?!",
      "!АХАХАХ, ДА-ДА-ДА!", "!ОДИН НА {n}, ИЗИ!", "!ПОГНАЛИ, БЛЯТЬ!", "!Я ЖЕ ГОВОРИЛ — ДАЙТЕ ВРЕМЯ!", "!ЕСТЬ!!!", "!ВСЁ, ВСЁ, ВСЁ!",
      "всё, раунд наш", "спокойно, пацаны, спокойно", "ну а кто, если не я", "изи, без нервов", "я знал, что он туда полезет",
      "хорошо, что не спешил", "чё, нормально же", "так и задумывалось", "ну я ж сказал — сейв не нужен", "гоу дальше",
      "~фух…", "~руки трясутся, бля", "~ладно, это было стрёмно", "~сердце сейчас выпрыгнет", "~повезло, честно", "~воды дайте"],
    heroLow: ["!НА {hp} ХП, БЛЯТЬ!", "!С {hp} ХП ЗАБРАЛ, Я ЕБУ!", "на {hp} хп, ребят… на {hp}", "{hp} хп, но кого это волнует",
      "~{hp} хп, я чуть не сдох", "~на {hp} хп… я сам в шоке"],
    mate: ["!ЕБАТЬ ТЫ ВЫДАЛ!", "!ДА ЛАДНО, ОДИН НА {n}!", "!КРАСАВА, БРАТ!", "!ТЫ ЁБАНЫЙ МОНСТР!", "!ЛЮТЫЙ, СУКА!", "!АХАХА, НУ ТЫ ЗВЕРЬ!",
      "!ЗАБИРАЙ… ЗАБРАЛ!", "!ДАВАЙ-ДАВАЙ-ДАВАЙ… ДААА!", "!ВОТ ЭТО ДА!", "!ХОРОШ, ХОРОШ!", "!ДАААА!", "!ПОГНАЛИ!",
      "найс", "найс, брат", "красавчик", "хорош", "сильно", "ну ты дал", "вот это ты молодец", "лучший", "ну ты машина",
      "вот это я понимаю", "держи пять", "чисто сыграл", "ахах, ну ты даёшь", "так и надо",
      "~найс…", "~я в шоке, честно", "~ну красиво, чё", "~ладно, ты гений", "~ну всё, раунд", "~хорош"],
    mateHype: ["!ЭТО ЧТО ВООБЩЕ БЫЛО?!", "!1 НА {n}, Я В АХУЕ!", "!ЕБАТЬ, ЭТО В ХАЙЛАЙТЫ!", "!КЛИПАЙТЕ, КЛИПАЙТЕ!", "!ОН ОДИН ВСЕХ ВЫНЕС!",
      "1 на {n}… я молчу", "это просто нереально", "~я не знаю, что сказать"],
    mateAlive: ["я тут чисто для массовки, ахах", "красава, я прикрывал", "!ДАААА!", "~я даже не стрелял", "!ХОРОШ, БРАТ!", "найс, вместе вытащили"],
    victim: ["да как он меня, блять", "сука, он же один был", "откуда он вылез?", "я его вообще не видел", "сразу в башку, пиздец",
      "бля, я рано вышел", "ну тут я сам виноват", "надо было ждать", "он чё, читер?", "ну это знать надо было",
      "~nice, чё", "~сильно сыграл", "~ну ладно", "~не повезло", "~бывает", "~он хорош, признаю", "!КАК?!", "!ДА ЛАДНО?!"],
    loserAlive: ["бля, я не успел", "сорян, пацаны", "ну я ж бежал…", "мне бы секунду", "~не успел, сорри", "~бомба далеко была",
      "~ну, дефузил же почти", "!БЛЯЯЯТЬ!"],
    loser: ["~нт", "~ладно, следующий", "~найс трай, пацаны", "~собираемся", "~ничего, ничего", "~бывает", "~обидно", "~окей, ресет",
      "~голову не вешаем", "~норм играли, просто он выдал", "сильно он, чё", "минус раунд, ладно", "собрались, следующий",
      "ну это пиздец", "как это можно отдать?", "надо было вдвоём идти", "ну тут без шансов", "!НУ КАК?!", "!ЁБАНЫЙ КЛАТЧ!"]
  },
  en: {
    hero: ["!LET'S FUCKING GOOO!", "!EZ CLAP!", "!WHO ELSE?!", "!TOO EASY!", "!I'M HIM!", "!1V{n}, BABY!", "!YEEEES!", "!COME ON!",
      "!WHAT DID I SAY?!", "!GET IN!", "!ONE MORE TIME!", "calm, calm, calm", "that's our round", "ez, no stress", "knew he'd peek there",
      "patience, boys", "told you, no save", "just how we planned it", "next round, let's go", "~holy…", "~my hands are shaking",
      "~okay, that was close", "~phew", "~lucky, honestly", "~need some water"],
    heroLow: ["!{hp} HP, BABY!", "!ON {hp} HP, LET'S GO!", "{hp} hp… {hp}!", "{hp} hp, who cares", "~{hp} hp, I almost died"],
    mate: ["!WHAT THE FUCK?!", "!HOLY SHIT!", "!1V{n}, ARE YOU KIDDING ME?!", "!INSANE, BRO!", "!YOU'RE A MONSTER!", "!NICE NICE NICE!",
      "!LET'S GOOO!", "!BIG BIG BIG!", "!THAT'S MY BOY!", "!YES YES YES!", "nice", "nice one", "well played", "huge", "clean",
      "beast", "so good, man", "you're crazy", "that's how it's done", "gimme five", "~nice…", "~wow", "~gg, he's cracked",
      "~unreal, bro", "~okay, round"],
    mateHype: ["!1V{n}?! WHAT IS THIS?!", "!ACTUAL MADMAN!", "!HE'S NOT HUMAN!", "!CLIP IT! CLIP IT!", "1v{n}… I'm speechless",
      "that's absurd", "~I have no words"],
    mateAlive: ["I just watched, lol", "!NICE, I HAD YOUR BACK!", "~I didn't even shoot", "!YEEES!", "we got it together, nice"],
    victim: ["how the fuck...", "he was alone, man", "where did he come from?", "no way, dude", "didn't even see him", "my bad, peeked too early",
      "should've waited", "is he walling? lol", "~nice", "~nh", "~he played it well", "~unlucky", "~fair enough", "!HOW?!", "!NO WAY!"],
    loserAlive: ["fuck, too late", "my bad, guys", "couldn't make it...", "needed one more second", "~sorry, too far", "~almost had the defuse",
      "!FUUUCK!"],
    loser: ["~nt", "~nice try, guys", "~next one", "~it's fine, reset", "~unlucky", "~heads up", "~gg on that one", "~we played it fine",
      "he's good, man", "unreal...", "can't lose that round", "reset, next one", "that's on us", "should've gone together",
      "!HOW?!", "!ARE YOU SERIOUS?!"]
  },
  // русский в англоязычной команде: русскоговорящие — часто, остальные — иногда подхватывают
  mix: {
    hero: ["!ДАВАЙ, БЛЯ! LET'S GO!", "!ИЗИ, BOYS!", "!SUKA, YES!", "!ЕСТЬ! EZ!", "~фух, guys", "ez, братва"],
    mate: ["!HOROSH, BRATAN!", "!БЛЯ, NICE!", "!DAVAI DAVAI DAVAI!", "!SUKA, INSANE!", "!ХАРОШ!", "!BRATAN, WHAT?!",
      "nice, братан", "хорош, хорош", "~бля, nice", "!ЕБАТЬ, WHAT A CLUTCH!", "krasava, man", "~харош, bro"],
    loser: ["~бля… nt", "~ладно, next", "!СУКА!", "~ну ок, reset", "~blyat, unlucky"]
  }
};
function rpHash(s){ var h = 2166136261 >>> 0; s = String(s); for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
// фраза и громкость: {t, lvl: 3 крик / 2 обычно / 1 тихо}
function rpPick(list, key, R){
  if(!list || !list.length) return {t: "", lvl: 2};
  var t = list[rpHash(R.m + "|" + R.round + "|" + key) % list.length], lvl = 2;
  if(t.charAt(0) === "!"){ lvl = 3; t = t.slice(1); } else if(t.charAt(0) === "~"){ lvl = 1; t = t.slice(1); }
  t = t.split("{n}").join(R.clutch.n).split("{hp}").join(Math.max(1, Math.round(R.clutch.hp||0)));
  return {t: lvl === 3 ? t.toUpperCase() : t, lvl: lvl};
}
// что говорит игрок: ситуация → категория; язык команды; русскоговорящий в англоязычной команде (или его тиммейт) — иногда mix
function rpSay(R, id, side){
  var C = R.clutch, st = R.st[id] || {}, win = side === C.side, hero = id === C.id, cat;
  if(win) cat = hero ? (C.hp > 0 && C.hp <= 30 && rpHash(R.round + "lo" + id) % 2 ? "heroLow" : "hero") : st.alive ? "mateAlive" : (C.n >= 3 && rpHash(R.round + "hy" + id) % 3 === 0 ? "mateHype" : "mate");
  else cat = st.killer === C.id ? "victim" : st.alive ? "loserAlive" : "loser";
  var lang = RP_LANG[R.team[side]] || "ru", nm = R.nick[id] || id;
  if(lang === "en"){
    var ruMe = !!RP_RU[nm], ruMate = Object.keys(R.nick).some(function(o){ return o !== id && bots.some(function(b){ return b.id === o && b.team === side; }) && RP_RU[R.nick[o]]; });
    var u = (rpHash(R.m + "|" + R.round + "|mix|" + id) % 100)/100, mixCat = cat === "heroLow" ? "hero" : cat === "mateHype" || cat === "mateAlive" ? "mate" : cat === "victim" || cat === "loserAlive" ? "loser" : cat;
    if(RP_SAY.mix[mixCat] && ((ruMe && u < 0.4) || (!ruMe && ruMate && win && u < 0.15))) return rpPick(RP_SAY.mix[mixCat], id + "m", R);
  }
  return rpPick(RP_SAY[lang][cat], id, R);
}
// (v465, владелец: «фразы уже готовые висят — надо как на паузах, что они говорят по очереди») реакции — по очереди: карточка
// подсвечивается, над ней «…» (печатает), потом фраза, звук чата и голос; следующий — когда голос кончился (без голоса — через RP_K.quiet с).
// Сказанное остаётся, приглушённое. Порядок: клатчер → свои → соперники (сначала его жертвы). Раньше 10 голосов запускались за 1,5 с
// и сбрасывали друг друга — слышно было одну-две реплики
function rpTalkOrder(R){
  var C = R.clutch, win = C.side, lose = win === "CT" ? "T" : "CT", L = [];
  var ids = function(side){ return bots.filter(function(b){ return b.team === side; }).map(function(b){ return b.id; }); };
  var w = ids(win).filter(function(id){ return id !== C.id; }).sort(function(a, b){ return rpSay(R, b, win).lvl - rpSay(R, a, win).lvl; });
  var l = ids(lose).sort(function(a, b){ var sa = R.st[a] || {}, sb = R.st[b] || {}; return ((sb.killer === C.id) - (sa.killer === C.id)) || (rpSay(R, b, lose).lvl - rpSay(R, a, lose).lvl); });
  L.push({id: C.id, side: win}); w.forEach(function(id){ L.push({id: id, side: win}); }); l.forEach(function(id){ L.push({id: id, side: lose}); });
  var vw = 0, vl = 0;
  L.forEach(function(q){ q.say = rpSay(R, q.id, q.side); q.lang = RP_LANG[R.team[q.side]] || "ru";
    q.voice = q.id === C.id || (q.side === win ? vw++ < 2 : vl++ < 2); });
  return L;
}
function rpTalkCard(E, q){ var c = E.emo.querySelector('.rp-card[data-id="' + q.id + '"]'); return {c: c, s: c && c.querySelector(".rp-say")}; }
function rpTalkStart(E, T, now){
  var q = T.L[T.i], k = rpTalkCard(E, q); T.st = "type"; T.t0 = now;
  if(k.c) k.c.classList.add("talking"); if(k.s) k.s.className = "rp-say lvl" + q.say.lvl + " typing";
}
// true — все сказали и экран постоял RP_K.emo с
function rpTalkTick(E, P, now){
  var T = P.talk; if(!T) return true;
  var el = (now - T.t0)/1000;
  if(T.i >= T.L.length) return el >= RP_K.emo;
  if(T.st === "wait"){ if(el >= 0.9) rpTalkStart(E, T, now); return false; }   // портреты встали — первый начинает
  var q = T.L[T.i], k = rpTalkCard(E, q);
  if(T.st === "type"){
    if(el < RP_K.typing) return false;
    T.st = "say"; T.t0 = now;
    if(k.s) k.s.className = "rp-say lvl" + q.say.lvl + " in";
    showSnd("chat", q.say.lvl === 1 ? 0.35 : 0.6);
    return false;
  }
  if(el < (q.voice ? RP_K.sayMin : RP_K.quiet)) return false;
  if(k.c){ k.c.classList.remove("talking"); k.c.classList.add("said"); }
  T.i++; T.t0 = now; if(T.i < T.L.length) rpTalkStart(E, T, now);
  return false;
}
function rpEmotions(E, R, P){
  var C = R.clutch, win = C.side, lose = win === "CT" ? "T" : "CT";
  var row = function(side, mood){
    var ids = bots.filter(function(b){ return b.team === side; }).map(function(b){ return b.id; });
    if(side === win){ ids.sort(function(a, b){ return (a === C.id ? 0 : 1) - (b === C.id ? 0 : 1); }); var c0 = ids.shift(); ids.splice(Math.floor(ids.length/2), 0, c0); }
    return '<div class="rp-row ' + mood + ' ' + side.toLowerCase() + '">' + ids.map(function(id, i){
      var st = R.st[id] || {}, hero = id === C.id, say = rpSay(R, id, side);
      var vx = R.vox && R.vox[id];
      var pp = PLAYER_PHOTO[R.nick[id]], ph = pp ? '<img alt="" src="' + pp + '">' : PL_SIL;   // (v463) фото — того, кто играл раунд (после раунда стороны могли смениться)
      return '<div class="rp-card' + (hero ? ' hero' : '') + (st.alive ? '' : ' dead') + '" data-id="' + id + '" style="--i:' + i + '">' +
        '<div class="rp-say lvl' + say.lvl + '"><b>' + esc(say.t) + '</b><u><i></i><i></i><i></i></u></div>' +
        '<div class="rp-ph">' + ph + '</div>' +
        '<div class="rp-nm"><span>' + esc(R.nick[id] || id) + '</span>' + (st.k ? '<i>' + st.k + ' уб.</i>' : '') + '</div>' +
        '<div class="rp-vx" title="последнее в войсе за раунд">' + (vx ? '«' + esc(vx) + '»' : '') + '</div></div>';
    }).join("") + '</div>';
  };
  E.emo.innerHTML =
    '<div class="rp-eh ' + win.toLowerCase() + '">' + (R.logo[win] ? '<img alt="" src="' + R.logo[win] + '">' : '') + '<span>' + esc(R.team[win]) + '</span><em>клатч 1v' + C.n + ' — ' + esc(R.nick[C.id]) + '</em></div>' +
    row(win, "hype") +
    '<div class="rp-eh2 ' + lose.toLowerCase() + '">' + esc(R.team[lose]) + ' — реакция</div>' +
    row(lose, "sad") +
    (function(){ var V = rpVoiceClutch(R); if(!V.length) return "";
      return '<div class="rp-air"><div class="rp-air-h">в эфире во время клатча</div>' + V.map(function(v, i){
        return '<div class="rp-vl ' + String(v.team).toLowerCase() + '" style="--i:' + i + '"><b>' + esc(v.who) + '</b><span>' + esc(v.text) + '</span></div>'; }).join("") + '</div>'; })();
  P.talk = {L: rpTalkOrder(R), i: 0, st: "wait", t0: performance.now()};
}
// ---------- переход к раунду (найти и посмотреть клатч): #round=матч.раунд в адресе или rpGoto(матч, раунд) ----------
// Матч перематывается тиками без отрисовки до закупки нужного раунда — дальше идёт обычным ходом (тот же матч бит в бит)
// (v462) мгновенный переход: готовый снимок игры на закупке раунда (посчитан на ПК, tools/marks/snap_round.js; лежит в хранилище файлов
// страницы) — открывается как снимок отметки (mkOpenSnap), дальше игра идёт теми же тиками. Нет снимка или не загрузился — rpGoto
// снимки v461 (м17 р27 и м13 р7, tools/marks/snap_round.js на ПК, прогон pc-results/113: восстановление — бит в бит); лежат в хранилище файлов
// опубликованной страницы Ancient (артефакт владельца); fp — отпечаток настроек, при котором снимок считался
var RP_SNAPS = {"17.27": {url: "/_blob/796483b1a08520d9144489538cc82d9a", fp: "1gecw3a"}, "13.7": {url: "/_blob/f3db2bee0eb3f72bc4f1e76a4fbc0e4a", fp: "1gecw3a"}};
function rpJump(m, r){
  var u = RP_SNAPS[m + "." + r];
  if(!u || typeof mkOpenSnap !== "function" || typeof fetch !== "function"){ rpGoto(m, r); return; }
  var tg = document.createElement("div"); tg.className = "mk-prog"; tg.textContent = "открываю матч " + m + ", раунд " + r + "…"; wrap.appendChild(tg);
  fetch(u.url).then(function(q){ if(!q.ok) throw new Error("HTTP " + q.status); return q.text(); }).then(function(t){
    if(WARM.on) WARM = {on: false};
    if(RP.on) rpEnd(); RP.rec = null; RP.pending = null; if(typeof TS !== "undefined"){ TS.lastRound = -1; if(TS.P) tsEnd(); }
    mkOpenSnap(t); tg.remove(); clockPause(false);
    var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); }
    if(typeof OBS !== "undefined") OBS.sc = 0;
    logEvent("Матч №" + m + ", раунд " + roundNum + " — открыт из готового снимка", true);
    if(u.fp && typeof mkFp === "function" && mkFp() !== u.fp) showBanner("Свои правки карты или настройки — дальше матч может пойти иначе", null, 3500);
  }).catch(function(e){ tg.remove(); logEvent("Снимок не открылся (" + (e && e.message) + ") — перематываю тиками", true); rpGoto(m, r); });
}
function rpGoto(m, r){
  m = Math.max(1, m|0); r = Math.max(1, r|0);
  freshMatch(m); clockPause(true); RP.rec = null; RP.pending = null; if(RP.on) rpEnd();
  var M0 = matchNum, tg = document.createElement("div"); tg.className = "mk-prog"; tg.textContent = "перематываю к раунду " + r + "…"; wrap.appendChild(tg);
  var step = function(){
    var t0 = performance.now();
    while(performance.now() - t0 < 40){
      if(matchNum !== M0 || roundNum > r || (roundNum === r && roundState === "freeze")){
        tg.remove(); clockPause(false); var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); }
        if(typeof logEvent === "function") logEvent("Матч №" + m + ", раунд " + roundNum + " — перемотано", true); return; }
      stepTick();
    }
    tg.textContent = "перематываю к раунду " + r + "… сейчас " + roundNum; setTimeout(step, 0);
  };
  step();
}
(function(){
  if(typeof document === "undefined") return;
  var c = document.getElementById("chkRp"); if(c){ c.checked = RP.enabled; c.addEventListener("change", function(){ RP.enabled = c.checked; try{ localStorage.setItem("sim-rp", c.checked ? "1" : "0"); }catch(e){} if(!c.checked && RP.on) rpStop(); }); }
  var sm = document.getElementById("selRp"); if(sm){ sm.value = RP.mode; sm.addEventListener("change", function(){ RP.mode = sm.value; try{ localStorage.setItem("sim-rp-mode", sm.value); }catch(e){} }); }
  var b = document.getElementById("btnRpLast"); if(b) b.addEventListener("click", function(){ if(RP.last){ rpPlay(RP.last, RP.mode === "auto" ? "both" : RP.mode); } else if(typeof showBanner === "function") showBanner("Клатча в этом матче ещё не было", null, 1800); });
  var hm = /(?:^|[#&])round=(\d+)\.(\d+)/.exec(location.hash || ""); if(hm) setTimeout(function(){ rpGoto(+hm[1], +hm[2]); }, 300);
})();
