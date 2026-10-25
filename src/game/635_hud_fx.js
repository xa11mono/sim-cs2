// ---------- (v430) движение HUD — одно место: масштаб HUD под окно, «прокрутка» чисел, вспышки ----------
// Только вид: игру не читает и не меняет (кроме того, что ей передали). Анимации — transform / opacity через Web Animations
// (без пересчёта раскладки страницы). При «уменьшить движение» в системе — числа сразу, без вспышек
var HUD_REDUCED = false;
try { HUD_REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch(e){}
// масштаб HUD (табло, панели игроков, мини-радар, киллфид…): под окно 1600×900 — 1; меньше — уменьшаем, чтобы панели не налезали
// друг на друга и на карту; больше — чуть крупнее. CSS: zoom:var(--k)
var HUD_K = 1;
function hudScale(){
  if(typeof window === "undefined" || !document.documentElement) return;
  var k = Math.min(window.innerWidth/1600, window.innerHeight/900);
  k = Math.max(0.62, Math.min(1.3, k));
  k = Math.round(k*100)/100;
  if(k !== HUD_K || !hudScale._set){ HUD_K = k; hudScale._set = true; document.documentElement.style.setProperty("--k", String(k)); }
}
if(typeof window !== "undefined"){ hudScale(); window.addEventListener("resize", hudScale); }
// анимация элемента (Web Animations); нет поддержки или «уменьшить движение» — ничего
function hudAnim(el, frames, opts){
  if(!el || HUD_REDUCED || typeof el.animate !== "function") return null;
  try { return el.animate(frames, opts); } catch(e){ return null; }
}
// число «прокручивается» к новому значению (деньги, фраги): ~450 мс, ease-out. Один общий цикл кадров на все числа
var HUD_TW = [], HUD_TW_ON = false;
function hudNum(el, to, fmt){
  if(!el) return;
  to = +to || 0; fmt = fmt || String;
  if(el._nv === undefined || HUD_REDUCED || typeof requestAnimationFrame === "undefined"){ el._nv = to; el._nTo = to; domText(el, fmt(to)); return; }
  if(el._nTo === to) return;
  el._nTo = to; el._nFrom = el._nv; el._nT0 = performance.now(); el._nFmt = fmt;
  if(HUD_TW.indexOf(el) < 0) HUD_TW.push(el);
  if(!HUD_TW_ON){ HUD_TW_ON = true; requestAnimationFrame(hudTwStep); }
}
function hudTwStep(ts){
  for(var i = HUD_TW.length - 1; i >= 0; i--){
    var el = HUD_TW[i], p = Math.min(1, (ts - el._nT0)/450), e = 1 - Math.pow(1 - p, 3);
    el._nv = p >= 1 ? el._nTo : Math.round(el._nFrom + (el._nTo - el._nFrom)*e);
    domText(el, el._nFmt(el._nv));
    if(p >= 1) HUD_TW.splice(i, 1);
  }
  if(HUD_TW.length) requestAnimationFrame(hudTwStep); else HUD_TW_ON = false;
}
// значение сменилось — цифра «выкатывается» сверху (счёт табло, живые)
function hudRoll(el, v){
  if(!el) return;
  v = String(v);
  if(el.textContent === v) return;
  var first = el._rolled === undefined; el._rolled = true;
  el.textContent = v;
  if(!first) hudAnim(el, [{transform:"translateY(-55%) scale(1.15)", opacity:0}, {transform:"none", opacity:1}], {duration:380, easing:"cubic-bezier(.34,1.5,.64,1)"});
}
// значок бомбы в табло / войсе / экономике — SVG вместо эмодзи 💣 (эмодзи рисуется по-разному на разных системах)
function hudC4(cls){
  var ic = typeof KF_ICON !== "undefined" && KF_ICON && KF_ICON.C4;
  return ic ? '<svg class="'+(cls||"")+'" viewBox="'+ic.vb+'" aria-label="бомба">'+ic.svg+'</svg>' : "C4";
}
// пауза — «живая» точка у названия карты гаснет
function hudPaused(on){
  var b = document.body; if(!b) return;
  if(!!b._paused !== !!on){ b._paused = !!on; b.classList.toggle("is-paused", !!on); }
}
// бомба стоит — по краю экрана пульсирует красная кромка (CSS body.bomb-on #main::after); класс меняется только при смене состояния
function hudBombEdge(on){
  var b = document.body; if(!b) return;
  if(!!b._bomb !== !!on){ b._bomb = !!on; b.classList.toggle("bomb-on", !!on); }
}
