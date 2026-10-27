// ======================= (v323, М40) ЗВУК — только показ, на игру не влияет =======================
// Синтез Web Audio (звуки Valve копировать нельзя): шум и тоны по типу события. Слышно то, что рядом с серединой экрана
// (там камера): громкость 0,15 + 0,85·(1 − d/R), R — дальность слышимости типа (ед. карты; шаги ~ бег 1100 ед. игры = 440). Бомба пикает
// чаще к концу (интервал 1 → 0,1 с — проектное число, как на слух в CS2). При быстрой перемотке — не больше SND_MAX звуков
// за 50 мс. Выключено, пока не нажать «Звук» (браузер не даёт играть звук без клика)
var SND = {on:false, ctx:null, noise:null, slot:0, n:0, buf:{}}, SND_MAX = 6;
// (v329, М46) записи (набор владельца, data/sounds/, вставляет src/mkpub.py) — выстрелы, гранаты, плант; чего нет — синтез ниже
var SND_DATA = null; /*@@SOUNDS@@*/
// (v331) записи по ключам: <ОРУЖИЕ>_1/_2 — варианты, <ОРУЖИЕ>_far — издалека; n_* — гранаты, c4_* — бомба, step_* — шаги
function sndRec(base, far){   // ключ записи: издалека (дальше 55 % слышимости) — дальний вариант, иначе случайный из ближних
  if(far > 0.55 && SND.buf[base+"_far"]) return base+"_far";
  var v = []; for(var i=1;i<=9;i++){ if(SND.buf[base+"_"+i]) v.push(base+"_"+i); else if(i > 2) break; }
  if(!v.length && SND.buf[base]) return base;
  return v.length ? v[Math.floor(Math.random()*v.length)] : null;   // случайность — только показ, на игру не влияет
}
function sndLoad(){
  if(!SND_DATA || !SND.ctx) return;
  Object.keys(SND_DATA).forEach(function(k){
    var bin = atob(SND_DATA[k]), u = new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i] = bin.charCodeAt(i);
    SND.ctx.decodeAudioData(u.buffer, function(b){ SND.buf[k] = b; }, function(){});
  });
}
// запись с громкостью g; вдали глуше (фильтр по расстоянию: far 0..1)
function sndPlay(key, g, far, delay){
  var B = SND.buf[key]; if(!B) return false;
  var c = SND.ctx, t0 = c.currentTime + (delay||0), src = c.createBufferSource(); src.buffer = B;
  var fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 18000 - 15000*Math.min(1, far||0);
  var gn = c.createGain(); gn.gain.value = g;
  src.connect(fl); fl.connect(gn); gn.connect(SND.master); src.start(t0); return true;
}
var SND_R = {step:600, shot:2000, awp:2600, nade:1500, bomb:1200};   // (v326) дальше слышно
function sndInit(){
  if(SND.ctx) return;
  var C = window.AudioContext || window.webkitAudioContext; if(!C) return;
  SND.ctx = new C(); SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.vol != null ? SND.vol : 0.85; SND.master.connect(SND.ctx.destination);   // (v325) громче по просьбе владельца; (v326) соединение с колонками было закомментировано по ошибке — звука не было вовсе
  var len = SND.ctx.sampleRate, buf = SND.ctx.createBuffer(1, len, SND.ctx.sampleRate), d = buf.getChannelData(0), sd = 12345;
  for(var i=0;i<len;i++){ sd = (sd*1103515245 + 12345) & 0x7fffffff; d[i] = sd/0x3fffffff - 1; }
  SND.noise = buf;
  sndLoad();
}
// (v333, М53, владелец: «каша из звуков в толпе») у каждого вида звука свой лимит за 50 мс: шаги — 3, выстрелы — 4, прочее — 3;
// шаги — только трёх ближайших к камере бегущих; громкое рядом (выстрел, взрыв ≤ 0,15 с назад) приглушает шаги вдвое.
// Числа — проектные (на слух)
var SND_CAP = {step:3, shot:4, other:3, fire:2, land:3};
function sndGain(x, y, R, cat){
  if(!SND.on || !SND.ctx || typeof cv === "undefined") return 0;
  cat = cat || "other";
  var t = performance.now(); if(t - SND.slot > 50){ SND.slot = t; SND.cnt = {}; }
  var r = cv.getBoundingClientRect(), c = navScreenToWorld(r.left + r.width/2, r.top + r.height/2), d = Math.hypot(x - c.x, y - c.y);
  var k = 1 - d/R; if(k <= 0) return 0;
  if(cat === "step"){
    var closer = 0; bots.forEach(function(o){ if(o.alive && o.curSpeed > 5 && !o.walking && Math.hypot(o.x - c.x, o.y - c.y) < d - 1) closer++; });
    if(closer >= 3) return 0;
  }
  SND.cnt = SND.cnt || {}; SND.cnt[cat] = (SND.cnt[cat]||0) + 1; if(SND.cnt[cat] > (SND_CAP[cat] || 3)) return 0;
  var g = 0.15 + 0.85*k; SND.far = 1 - k;
  if(cat !== "step" && g > 0.6) SND.loudT = t;
  if(cat === "step" && t - (SND.loudT||0) < 150) g *= 0.5;
  return g;
}
function sndNoise(g, dur, type, f, q, delay){
  var c = SND.ctx, t0 = c.currentTime + (delay||0), src = c.createBufferSource(); src.buffer = SND.noise;
  var fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1;
  var gn = c.createGain(); gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(fl); fl.connect(gn); gn.connect(SND.master); src.start(t0, Math.random()*0.5); src.stop(t0 + dur + 0.02);
}
function sndTone(g, dur, f, type, delay, f2){
  var c = SND.ctx, t0 = c.currentTime + (delay||0), o = c.createOscillator(); o.type = type || "sine"; o.frequency.setValueAtTime(f, t0);
  if(f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  var gn = c.createGain(); gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(gn); gn.connect(SND.master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function sndStep(x, y){   // (v327) шаг как в CS — «тук-тук» пяткой и носком по камню: два коротких щелчка + глухой стук (было 500 Гц и тихо — не слышно)
  var g = sndGain(x, y, SND_R.step, "step"); if(!g) return;
  var sk = "step_0" + (1 + Math.floor(Math.random()*8)); if(sndPlay(sk, 0.9*g, SND.far)) return;   // (v331) запись шага по бетону
  sndNoise(0.75*g, 0.03, "bandpass", 1600, 1.5); sndTone(0.4*g, 0.05, 160, "triangle", 0, 80);
  sndNoise(0.5*g, 0.025, "bandpass", 2100, 1.5, 0.07);
}
// (v338, владелец прислал записи CS2) покупка и подбор: оружие — pickup_weapon_1/_2, граната — pickup_grenade. Слышно рядом
// с игроком (радиус шагов, проектное число); не больше 3 за 50 мс (закуп всей команды — не каша). Только показ.
// chat_talk — звук сообщения в чате: ключ в наборе есть, чата пока нет (добавим позже)
SND_CAP.buy = 3;
// (v339, владелец: «звуков закупок я не слышу») покупка — без расстояния (во фризтайм камера обычно не у спавна, и по радиусу
// шагов громкость была 0): тихо, как звук интерфейса, BUY_GAIN — проектное число. Подбор с земли — как был, там, где игрок
function sndPickup(b, kind, buy){
  if(!kind || !b) return;
  var g, far = 0;
  if(buy){
    if(!SND.on || !SND.ctx) return;
    var t = performance.now(); if(t - SND.slot > 50){ SND.slot = t; SND.cnt = {}; }
    SND.cnt = SND.cnt || {}; SND.cnt.buy = (SND.cnt.buy||0) + 1; if(SND.cnt.buy > SND_CAP.buy) return;
    g = BUY_GAIN;
  } else { g = sndGain(b.x, b.y, SND_R.step, "buy"); if(!g) return; g *= 0.6; far = SND.far; }
  var key = sndRec(kind === "nade" ? "pickup_grenade" : "pickup_weapon", 0); if(key) sndPlay(key, g, far);
}
var BUY_GAIN = 0.35;
// (v333, М55) звуки тела: приземление, попадание (в броню / в тело / в голову — с шлемом и без), горение. Только показ
function sndBody(kind, x, y, o){
  var g = sndGain(x, y, SND_R.step*1.6, kind === "land" ? "land" : "other"); if(!g) return;   // (v335) приземление — свой лимит, не «три ближайших бегущих»
  var base = {land:"b_land", burn:"b_burn", kevlar:"b_kevlar", body:"b_body", hshelm:"b_hshelm", hs:"b_hs"}[kind];
  var key = base && sndRec(base, 0); if(key) sndPlay(key, (kind === "land" ? 1.0 : 0.7)*g, SND.far);
}
// огонь горит — тихий треск, пока горит (одна петля на огонь)
// (звуковые узлы держим в SND.fireMap, а не на объекте огня: огонь идёт в снимок отметок, узлы туда копировать нельзя — v325)
function sndFireTick(){
  if(!SND || !SND.ctx) return;
  var M = SND.fireMap || (SND.fireMap = new Map());
  M.forEach(function(v, f){ if(!SND.on || fires.indexOf(f) < 0){ try{ v.stop(); }catch(e){} M.delete(f); } });
  if(!SND.on || !SND.buf.n_fireloop) return;
  fires.forEach(function(f){
    if(M.has(f)) return; var g = sndGain(f.x, f.y, SND_R.nade, "fire"); if(!g) return;
    var c = SND.ctx, src = c.createBufferSource(); src.buffer = SND.buf.n_fireloop; src.loop = true;
    var gn = c.createGain(); gn.gain.value = 0.35*g; src.connect(gn); gn.connect(SND.master); src.start(); M.set(f, src);
  });
}
// (v327, владелец: «выстрелы громкие, нужно похоже на CS») выстрел — три слоя, как устроен звук выстрела: щелчок (2–3 мс,
// высокие), «хлопок» (полоса 1,5–3 кГц, 30–60 мс), «тело» (низкий тон с падением частоты) и хвост-эхо (низкий шум 0,2–0,6 с).
// Числа слоёв по оружию — на слух (проектные), сами звуки Valve копировать нельзя
var SND_GUN = {
  rifle:  {crack:0.30, cf:2200, body:0.32, bf:150, tail:0.16, tl:0.35},
  ak:     {crack:0.30, cf:1800, body:0.40, bf:120, tail:0.18, tl:0.40},
  pistol: {crack:0.26, cf:2800, body:0.18, bf:220, tail:0.08, tl:0.20},
  deagle: {crack:0.34, cf:2000, body:0.40, bf:110, tail:0.18, tl:0.45},
  smg:    {crack:0.22, cf:2600, body:0.20, bf:190, tail:0.08, tl:0.22},
  awp:    {crack:0.40, cf:1600, body:0.55, bf:90,  tail:0.26, tl:0.80},
  sil:    {crack:0.10, cf:3200, body:0.12, bf:260, tail:0.03, tl:0.10}
};
function sndShot(w, x, y){
  var k = (w && w.key) || "", awp = k === "AWP", g = sndGain(x, y, awp ? SND_R.awp : SND_R.shot, "shot"); if(!g) return;
  var P = w && w.silenced ? SND_GUN.sil : awp ? SND_GUN.awp : /AK|GALIL/.test(k) ? SND_GUN.ak : /DEAGLE|R8/.test(k) ? SND_GUN.deagle :
          /USP|GLOCK|P2000|P250|FIVE|TEC|CZ|DUAL/.test(k) ? SND_GUN.pistol : /MP|MAC|UMP|P90|BIZON/.test(k) ? SND_GUN.smg : SND_GUN.rifle;
  g *= 0.6;   // общий уровень выстрелов — ниже шагов не опускается, но не оглушает
  var rk = sndRec(k, SND.far); if(rk && sndPlay(rk, 0.9*g, SND.far > 0.55 ? 0 : SND.far)) return;   // (v331) есть запись — она (дальняя уже глухая)
  sndNoise(P.crack*1.4*g, 0.004, "highpass", 5000, 0.7);
  sndNoise(P.crack*g, 0.05, "bandpass", P.cf, 0.9);
  sndTone(P.body*g, 0.09, P.bf, "sine", 0, P.bf*0.45);
  sndNoise(P.tail*g, P.tl, "lowpass", 600, 0.5, 0.02);
}
function sndNade(type, x, y){
  var g = sndGain(x, y, SND_R.nade); if(!g) return;
  var rec = type === "extinguish" ? "n_extinguish" : sndRec("n_" + type, SND.far);   // (v331) n_smoke, n_flash, n_he, n_molly, n_throw, n_bounce
  if(rec && sndPlay(rec, (type === "throw" || type === "bounce" ? 0.6 : 1)*g, SND.far > 0.55 ? 0 : SND.far)) return;
  if(type === "smoke"){ sndTone(0.2*g, 0.05, 900, "square"); sndNoise(0.35*g, 1.6, "highpass", 2500, 0.5, 0.03); }
  else if(type === "flash"){ sndNoise(0.8*g, 0.12, "highpass", 1500, 0.7); sndTone(0.12*g, 1.2, 3200, "sine", 0.05); }
  else if(type === "he"){ sndNoise(1.0*g, 0.7, "lowpass", 300, 0.8); sndTone(0.6*g, 0.5, 70, "sine", 0, 35); }
  else if(type === "molly"){ sndTone(0.25*g, 0.12, 2400, "triangle", 0, 1800); sndNoise(0.5*g, 0.9, "bandpass", 900, 0.5, 0.05); }
  else if(type === "throw"){ sndNoise(0.15*g, 0.12, "bandpass", 700, 2); }
  else if(type === "bounce"){ sndTone(0.15*g, 0.04, 1300, "triangle"); }
}
function sndBomb(kind, x, y){
  var g = sndGain(x, y, SND_R.bomb); if(!g) return;
  // (v331) записи: c4_beep, c4_key1..7, c4_initiate, c4_disarmstart, c4_disarmfinish, c4_explode; нет записи — синтез
  var R = {beep:"c4_beep", planted:"c4_initiate", defuse:"c4_disarmstart", defused:"c4_disarmfinish", boom:"c4_explode"}[kind];
  if(R && sndPlay(R, (kind === "beep" ? 0.7 : 0.9)*g, SND.far)) return;
  if(kind === "beep") sndTone(0.25*g, 0.09, 2800, "sine");
  else if(kind === "plant"){ var rk = !!SND.buf.c4_key1; for(var i=0;i<7;i++){ if(!rk || !sndPlay("c4_key"+(i+1), 0.8*g, SND.far, i*0.32)) sndTone(0.18*g, 0.07, 1500 + (i%3)*250, "square", i*0.32); } }
  else if(kind === "planted") sndTone(0.3*g, 0.3, 2000, "sine", 0, 1600);
  else if(kind === "defuse"){ sndNoise(0.3*g, 0.06, "bandpass", 3000, 2); for(var j=0;j<4;j++) sndTone(0.12*g, 0.04, 2200, "square", 0.15 + j*0.12); }
  else if(kind === "boom"){ sndNoise(1.0*g, 2.2, "lowpass", 220, 0.6); sndTone(0.8*g, 1.4, 55, "sine", 0, 25); }
  else if(kind === "defused") sndTone(0.25*g, 0.5, 1200, "sine", 0, 2400);
}
// писк бомбы — одно расписание для звука и для кромки экрана (v437): раз в тик проверка, когда следующий; только вид и звук, игру не меняет
var BEEP_NEXT = 0;
function bombBeepTick(){
  if(!bomb || bomb.state !== "planted"){ BEEP_NEXT = 0; return; }
  if(tick < BEEP_NEXT) return;
  var left = bombTimeLeftTicks()/TICK_HZ, gap = Math.max(0.1, Math.min(1, 0.1 + 0.9*left/40));
  BEEP_NEXT = tick + Math.round(gap*TICK_HZ);
  if(SND.on) sndBomb("beep", bomb.x, bomb.y);
  hudBombPulse(gap);
}
(function(){
  var b = document.getElementById("btnSnd"); if(!b) return;
  // (v346, владелец: «сделай, чтобы звук был включён по умолчанию») звук включён сразу; браузер даёт звук только после действия
  // на странице — запускается при первом клике / клавише где угодно. Выключил кнопкой — запоминается в этом браузере
  var pref = null; try{ pref = localStorage.getItem("sndOff"); }catch(e){}
  SND.on = pref !== "1"; b.className = SND.on ? "on" : ""; b.textContent = "Звук"; b.title = b.title.replace(/ — (вкл|выкл)$/, "") + (SND.on ? " — вкл" : " — выкл");
  var wake = function(){ if(!SND.on) return; sndInit(); if(SND.ctx && SND.ctx.state !== "running") SND.ctx.resume().catch(function(){}); };
  ["pointerdown", "keydown"].forEach(function(ev){ document.addEventListener(ev, wake, {capture:true}); });
  // (v326) включил — сразу короткий сигнал (слышно, что звук работает); если браузер / страница не дали звук — пишем это на кнопке
  // (v425, владелец 25.10: «нужно добавить ползунок громкости звуков игры») общая громкость — SND.master; 0,85 — как было; запоминается
  var vol = document.getElementById("sndVol"), v0 = null; try{ v0 = localStorage.getItem("sndVol"); }catch(e){}
  SND.vol = v0 != null && !isNaN(+v0) ? Math.max(0, Math.min(1, +v0)) : 0.85;
  if(vol){ vol.value = Math.round(SND.vol*100); vol.style.setProperty("--v", vol.value+"%");   // (v430) --v — заполнение дорожки (только вид)
    vol.addEventListener("input", function(){ SND.vol = (+vol.value)/100; if(SND.master) SND.master.gain.value = SND.vol; vol.style.setProperty("--v", vol.value+"%");
      try{ localStorage.setItem("sndVol", String(SND.vol)); }catch(e){} }); }
  b.addEventListener("click", function(){
    sndInit(); if(!SND.ctx){ b.textContent = "Звук: браузер не умеет"; return; }
    SND.on = !SND.on; b.className = SND.on ? "on" : ""; b.textContent = "Звук"; b.title = b.title.replace(/ — (вкл|выкл)$/, "") + (SND.on ? " — вкл" : " — выкл");
    try{ localStorage.setItem("sndOff", SND.on ? "0" : "1"); }catch(e){}
    if(!SND.on) return;
    var go = function(){ sndTone(0.35, 0.12, 880, "sine"); sndTone(0.35, 0.12, 1320, "sine", 0.13); };
    if(SND.ctx.state !== "running") SND.ctx.resume().then(go, function(){}); else go();
    setTimeout(function(){ if(SND.on && SND.ctx.state !== "running") b.textContent = "Звук: заблокирован (" + SND.ctx.state + ")"; }, 600);
  });
})();
var FRAME_CATCHUP_MS = 100;   // (v397, М146) проектное число: ≈ 6 тиков за кадр — при 10+ к/с игра ещё идёт в реальном времени
// (v397, М146) размер области радара — один раз в начале кадра, пока раскладка страницы чистая (до записей draw); обсервер и
// мини-карта берут его отсюда, а не читают заново после записей (тогда браузер пересчитывает раскладку всей страницы)
var frameWrapR = null;
function wrapRect(){ return frameWrapR || (frameWrapR = wrap.getBoundingClientRect()); }
// (v444, владелец 27.10: «симуляция зависла полностью, кнопки работают; свернул — чёрный экран») любая ошибка в тике или рисовании
// раньше обрывала цикл кадров навсегда (requestAnimationFrame — в конце frame): картинка стоит, кнопки живы. Теперь ошибка ставит
// игру на паузу и показывает себя на экране (что, матч, тик) — для скриншота; цикл кадров не умирает
var FATAL = null;
function showFatal(e){
  paused = true; var bp = document.getElementById("btnPause"); if(bp) bp.textContent = "Продолжить";
  if(FATAL) return; FATAL = e;
  var d = document.createElement("div"); d.id = "fatalBox";
  d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:80vw;padding:12px 16px;background:#3a0d0d;border:1px solid #e5484d;color:#ffd7d7;font:12px/1.45 monospace;white-space:pre-wrap;border-radius:6px";
  d.textContent = "Ошибка игры — сделай скриншот этого окна\nматч " + matchNum + " · раунд " + roundNum + " · тик " + tick + "\n" + String(e && e.message || e) + "\n" + String(e && e.stack || "").split("\n").slice(1, 6).join("\n");
  document.body.appendChild(d);
}
window.addEventListener("error", function(ev){ showFatal(ev.error || ev.message); });
function frame(ts){
  try{ frameBody(ts); }catch(e){ showFatal(e); }
  requestAnimationFrame(frame);
}
function frameBody(ts){
  nowTs = ts; frameWrapR = null; wrapRect();
  if(SND && SND.ctx) sndFireTick();   // (v333) треск огня — и останавливается, когда огонь погас / раунд кончился / звук выключен
  if(lastFrame===null) lastFrame = ts;
  var dt = ts - lastFrame; lastFrame = ts;
  if(!paused && WARM.on){ var wdt = Math.min(0.1, dt/1000); warmTick(wdt); accumulator = 0; }
  else if(!paused){
    // (v397, М146) догонять не больше FRAME_CATCHUP_MS за кадр: после скрытой вкладки или долгого кадра цикл раньше считал все
    // пропущенные тики разом (минута вкладки в фоне = ~3800 тиков в одном кадре — страница вставала на секунды, а следующий кадр
    // снова долгий — «снежный ком»). Теперь игра в такой момент идёт медленнее реального времени. Тики те же — игра не меняется
    accumulator += Math.min(dt, FRAME_CATCHUP_MS);
    while(accumulator >= TICK_MS){ stepTick(); accumulator -= TICK_MS; }
    mkAfterTicks();
  }
  obsFrame(ts);
  draw();
  obsOverlay();
  miniDraw();
  frameWrapR = null;   // вне кадра (клики, перемотка) — читать заново
}
document.getElementById("btnFreshMatch").addEventListener("click", function(){ var n = Math.max(1, parseInt(document.getElementById("inpMatchNum").value, 10) || 1); var sel = document.getElementById("selSeries"), bo = sel ? +sel.value : 3; if(bo !== SERIES.bo || seriesDone()) SERIES = {bo:bo, maps:{}}; var cw = document.getElementById("chkWarm"); if(cw && !cw.checked) freshMatch(n); else warmStart(n); paused = false; var bp = document.getElementById("btnPause"); if(bp){ bp.textContent = "Пауза"; bp.classList.remove("active"); } logEvent("Матч №"+n+" с чистого листа (воспроизводимый)", true); });
setInterval(function(){ var el = document.getElementById("matchTick"); if(el) el.textContent = "матч "+matchNum+" · тик "+tick; }, 250);
var BOT_INIT = bots.map(function(b){ var o = {keys:{}, vals:{}}; for(var k in b){ o.keys[k] = 1; var v = b[k]; if(v === null || (typeof v !== "object" && typeof v !== "function")) o.vals[k] = v; } return o; });
window.__ev=function(src){return eval(src);};
/*@@WARM_AUTO@@*/
requestAnimationFrame(frame);

// (v256) меню «Слои» и «Инструменты»: открыто одно, закрываются кликом мимо и Esc
(function(){
  var dds = Array.prototype.slice.call(document.querySelectorAll("#topbar details.dd"));
  dds.forEach(function(d){ d.addEventListener("toggle", function(){ if(d.open) dds.forEach(function(o){ if(o !== d) o.open = false; }); }); });
  document.addEventListener("mousedown", function(e){ dds.forEach(function(d){ if(d.open && !d.contains(e.target)) d.open = false; }); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") dds.forEach(function(d){ d.open = false; }); });
})();
document.getElementById("btnPause").addEventListener("click", function(){
  paused = !paused;
  this.textContent = paused ? "Продолжить" : "Пауза";
  this.classList.toggle("active", paused);
});

document.getElementById("btnExportProject").addEventListener("click", function(){
  // всё состояние, которое живёт только в localStorage этого браузера
  var box = document.getElementById("projectExportBox");
  if(box.style.display === "block"){ box.style.display = "none"; return; }
  var data = {
    walls: WALL_POLYS,
    navAnchors: navAnchors,
    userZones: USER_ZONES.map(function(z){ return { name:z.name, kind:z.kind, points: zoneObjAbsPoints(z).map(function(p){ return {x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10}; }) }; }),
    navTransform: navTransform,
    zoneLayer: zoneLayer,
    zoneNames: ZONE_NAMES,
    lineups: USER_LINEUPS,
    zoneShapes: ZONE_SHAPES,
    oppProfile: OPP,
    builtinOff: BUILTIN_OFF
  };
  var ta = document.getElementById("projectExportArea");
  ta.value = JSON.stringify(data);
  box.style.display = "block";
  ta.focus(); ta.select();
  try{ document.execCommand("copy"); }catch(e){}
});

document.getElementById("btnRestartRound").addEventListener("click", function(){
  // manual escape hatch for stuck bots — resetRound() doesn't care what
  // roundState was (live/ending), it just respawns everyone and sets "live"
  logEvent("Раунд "+roundNum+" сброшен вручную");
  resetRound();
  draw();
});

})();
