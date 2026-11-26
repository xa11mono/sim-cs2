// (Р3.6, 26.11) проверка детектора застревания PROB на реальных эпизодах (наборы A / B), независимо от кода детектора:
//   A — каждое событие stall.geom / stall.free / stall.path: по своей истории позиций бот за предыдущие PROB_STALL_SEC стоял (смещение
//       < PROB_STALL_MOVE), хотел идти (пост есть, не на посту, режим patrol, пост дальше 40 px) — иначе событие ложное;
//       stall.block: в следе есть отказы места за PROB_BLOCK_SEC и бот стоял (< PROB_STALL_MOVE·2);
//   B — окна ≥ PROB_STALL_SEC, где бот законно стоит (на посту / держит угол / нет поста) — событий stall.geom / free / path там нет;
//   пропуски — окна «хотел идти и стоял ≥ PROB_STALL_SEC» без события;
//   эпизоды stall.ep: событий в эпизоде ≥ 1, эпизодов ≤ событий (двойной счёт виден как разница).
// Ядро без показа (dist/core-<карта>.js) в Node. Запуск: node tools/measure/audit/prob_ab.js <core.js> [--match=3] [--ticks=20000] [--out=…]
'use strict';
const path = require('path'), fs = require('fs');
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const EV = require(path.resolve(__dirname, '..', '..', 'node', 'core_run.js')).load(path.resolve(process.argv[2]));
const M = +(A.match || 3), T = +(A.ticks || 20000);
const res = JSON.parse(EV(`(function(){
  paused = true; DLOG.on = true; freshMatch(${M}); var M0 = matchNum;   // как tools/measure/fingerprint.js
  var H = {}, every = 16;   // история: тик → [x, y, хочет идти, стоит законно, раунд, пытается идти (скорость > 0,5)]
  var RF = {};   // отказы места по ботам (тик) — во время матча: след хранит только последние секунды
  simEvOn("setPost", function(ph, A, r){ if(ph === "out" && A[0] && r === false) (RF[A[0].id] = RF[A[0].id] || []).push(tick); });
  var P0 = null;   // PROB своего матча: в тике смены матча probTick его обнуляет (новые объекты) — держим прежние
  for(var t = 0; t < ${T}; t++){ P0 = {all: PROB.all, n: PROB.n, sub: PROB.sub, ep: PROB.ep}; stepTick(); if(matchNum !== M0) break;
    if(tick % every === 0 && roundState === "live") bots.forEach(function(b){ if(!b.alive) return;
      var want = !!(b.post && !b.atPost && b.state === "patrol" && !b.holding && DM.hypot(b.post.x-b.baseX, b.post.y-b.baseY) > 40);
      var busy = !!(b.planting || b.defusing || b._climb || b._sawEnemy || b._fc || tick < (b.blindUntil||0) || tick < (b.throwUntil||0));
      (H[b.id] = H[b.id] || []).push([tick, b.baseX, b.baseY, want && !busy ? 1 : 0, (!b.post || b.atPost || b.holding) && !want ? 1 : 0, roundNum, b.curSpeed > 0.5 ? 1 : 0]); }); }
  if(matchNum === M0) P0 = {all: PROB.all, n: PROB.n, sub: PROB.sub, ep: PROB.ep};
  return JSON.stringify({H: H, ev: P0.all || [], sec: PROB_STALL_SEC, mv: PROB_STALL_MOVE, bsec: PROB_BLOCK_SEC, hz: TICK_HZ, ep: P0.ep, n: P0.n, sub: P0.sub,
    dl: RF});
})()`));
const W = res.sec * res.hz, out = { match: M, ticks: T, n: res.n, sub: res.sub, ep: res.ep, A: { ok: 0, bad: [] }, B: { windows: 0, bad: [] } };
const hist = (id, t0, t1) => (res.H[id] || []).filter(h => h[0] > t0 && h[0] <= t1);
for (const e of res.ev.filter(e => e.kind === 'stall')) {
  if (e.sub === 'stall.block') { const L = (res.dl[e.id] || []).filter(t => t <= e.tick && t > e.tick - res.bsec * res.hz - 2 * res.hz), h = hist(e.id, e.tick - res.bsec * res.hz, e.tick);
    const still = h.length && h.every(q => Math.hypot(q[1] - h[0][1], q[2] - h[0][2]) < res.mv * 2);
    if (L.length >= 2 && still) out.A.ok++; else out.A.bad.push({ e: [e.tick, e.id, e.text], refusals: L.length, still }); continue; }
  const h = hist(e.id, e.tick - W, e.tick), net = h.length ? Math.hypot(h[h.length - 1][1] - h[0][1], h[h.length - 1][2] - h[0][2]) : -1,
    span = h.length ? Math.max(...h.map(q => Math.hypot(q[1] - h[0][1], q[2] - h[0][2]))) : -1, want = h.filter(q => q[3]).length / (h.length || 1), tries = h.filter(q => q[6]).length / (h.length || 1);
  // подтверждено: за окно нет продвижения (смещение конец − начало < PROB_STALL_MOVE — определение детектора), хотел и пытался идти
  if (h.length >= W / 16 - 1 && net < res.mv * 1.01 && want >= 0.8 && tries >= 0.8) { out.A.ok++; if (span >= res.mv * 2) out.A.osc = (out.A.osc || 0) + 1; }
  else out.A.bad.push({ e: [e.tick, e.id, e.text], net: Math.round(net), span: Math.round(span), want: +want.toFixed(2), tries: +tries.toFixed(2), samples: h.length });
  if (h.length >= W / 16 - 1 && moved < res.mv * 1.01 && want >= 0.8) out.A.ok++; else out.A.bad.push({ e: [e.tick, e.id, e.text], moved: Math.round(moved), want: +want.toFixed(2), samples: h.length });
}
// B: окна законного стояния (подряд «стоит законно» ≥ W тиков, без смены раунда) — событий geom / free / path внутри нет
const geo = res.ev.filter(e => e.kind === 'stall' && e.sub !== 'stall.block');
for (const [id, H] of Object.entries(res.H)) { let s = null;
  for (let i = 0; i <= H.length; i++) { const q = H[i], ok = q && q[4] && (!s || q[5] === s[5]);
    if (ok && !s) s = q; if (!ok && s) { const end = H[i - 1][0]; if (end - s[0] >= W) { out.B.windows++; const bad = geo.filter(e => e.id === id && e.tick > s[0] + W && e.tick <= end); if (bad.length) out.B.bad.push({ id, from: s[0], to: end, ev: bad.map(e => [e.tick, e.text]) }); } s = q && q[4] ? q : null; } } }
// пропуски: окна, где бот подряд ≥ PROB_STALL_SEC «хочет идти» (тот же признак, что у детектора: пост, не на посту, patrol, не занят) и
// сместился < PROB_STALL_MOVE, — в конце окна (± 1 с) должно быть событие stall (любой вид) этого бота; нет — пропуск детектора
out.miss = { windows: 0, bad: [] };
const allSt = res.ev.filter(e => e.kind === 'stall');
for (const [id, H] of Object.entries(res.H)) { let s = 0;
  for (let i = 0; i < H.length; i++) { if (!H[i][3] || (i > s && H[i][5] !== H[s][5])) { s = i + (H[i][3] ? 0 : 1); continue; }
    if (H[i][0] - H[s][0] >= W) { const win = H.slice(s, i + 1), mv = Math.hypot(win[win.length - 1][1] - win[0][1], win[win.length - 1][2] - win[0][2]),
        tr = win.filter(q => q[6]).length / win.length;
      if (mv < res.mv && tr >= 0.8) { out.miss.windows++; const ok = allSt.some(e => e.id === id && e.round === H[s][5] && e.tick <= H[i][0] + res.hz && (e.tick >= H[s][0] || Math.hypot(e.x - H[s][1], e.y - H[s][2]) < res.mv * 2));   // детектор не повторяет событие, пока бот не отошёл
        if (!ok) out.miss.bad.push({ id, from: H[s][0], to: H[i][0], moved: Math.round(mv) }); s = i + 1; }
      else s++; } } }
out.verdict = { A: out.A.bad.length ? 'ложные события: ' + out.A.bad.length : 'все ' + out.A.ok + ' событий подтверждены историей', B: out.B.bad.length ? 'срабатывания на законном стоянии: ' + out.B.bad.length : 'на ' + out.B.windows + ' окнах законного стояния — 0 событий',
  пропуски: out.miss.bad.length ? 'стоял ≥ 5 с, хотел идти, события нет: ' + out.miss.bad.length + ' из ' + out.miss.windows : 'окон «хотел идти и стоял» ' + out.miss.windows + ', все с событием' };
if (A.out) fs.writeFileSync(A.out, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ n: out.n, sub: out.sub, ep: out.ep, verdict: out.verdict, Abad: out.A.bad.slice(0, 5), Bbad: out.B.bad.slice(0, 3), miss: out.miss.bad.slice(0, 5) }, null, 1));
