// [хозяева: —] ======================= (v306) РАЗМИНКА перед матчем — показ =======================
// (Р5, 27.11) расчёт разминки (warmStart / warmTick / warmEnd, возрождение, бег, стрельба) — engine/core/modes.js; здесь — только то,
// что видно: кнопка «Начать матч», киллфид и войс после разминки, снимки отметок — только из матча (v521)
function warmShow(on){
  var sk = document.getElementById("btnWarmSkip"); if(sk) sk.style.display = on ? "" : "none";
  if(on){ renderFeed(); return; }
  if(typeof MK !== "undefined" && MK){ MK.cps = []; MK.lastCpTick = -1; }   // (v521) снимки для отметок — только из матча, не из разминки
  renderFeed(); if(typeof renderVoice === "function") renderVoice();
}
// враг в поле зрения бота разминки — ближайший живой в радиусе 700 по прямой видимости (было в warmTick, v312; Р5 27.11 — вход расчёта)
function warmFoe(b){
  var foe = null, fd = 700;
  bots.forEach(function(o){ if(o.alive && o.team !== b.team){ var d = Math.hypot(o.x-b.x, o.y-b.y); if(d < fd && hasLOS(b.x, b.y, o.x, o.y, b.z, o.z)){ fd = d; foe = o; } } });
  return foe ? {o: foe, d: fd} : null;
}
