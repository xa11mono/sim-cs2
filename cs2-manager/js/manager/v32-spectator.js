/* v32 — Режим зрителя.
   Только то, что движок трансляции действительно моделирует: победитель каждого раунда, закупки и банки команд,
   хайлайты раундов, live-коэффициенты, паузы. Позиций игроков в симуляции нет, поэтому нет и «камер от первого лица»:
   «камера» здесь — авто-режиссёр, который переключает эфир на самый напряжённый матч.
   Повторы: по окончании карты сохраняются раунды, закупки и хайлайты (seasonState.v32Replays, последние 60 матчей). */
(function () {
'use strict';
const H = window.HS; if (!H) return;
const { esc, logo, box, empty } = H;
const $ = id => document.getElementById(id);
const CT = () => (typeof currentTournament !== 'undefined' ? currentTournament : null);
const SS = () => (typeof seasonState !== 'undefined' ? seasonState : null);
const managed = () => (window.V31 && window.V31.managed && window.V31.managed()) || null;
const strip = s => String(s || '').replace(/<[^>]*>/g, '');
const LS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const LSset = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

/* ------------------------------------------------------------ запись повторов */
const BUY = { full: 'F', half: 'H', smg: 'S', hero: 'R', force: 'X', deagle: 'D', eco: 'E', save: 'V', pistol: 'P' };
const BUY_L = { F: 'полная закупка', H: 'полузакупка', S: 'SMG', R: '«геройская»', X: 'форс', D: 'дигл-раунд', E: 'эко', V: 'сохранение', P: 'пистолетный' };
const live = new Map(); // item.id → { maps: [{ b1, b2, hl }] } — пока матч идёт
const store = () => { const s = SS(); if (!s) return []; return (s.v32Replays = s.v32Replays || []); };

function track(item) {
  const st = item?.state; if (!st || !item.match) return;
  let rec = live.get(item.id); if (!rec) live.set(item.id, rec = { maps: [], seen: new WeakSet() });
  const cur = rec.maps[st.mapIndex] || (rec.maps[st.mapIndex] = { b1: [], b2: [], hl: {} });
  const r = st.round, plan = st.roundBuys?.[r];
  if (r && plan) { cur.b1[r - 1] = BUY[plan.t1?.type] || '-'; cur.b2[r - 1] = BUY[plan.t2?.type] || '-'; }
  const h = st.roundHighlights?.[r];
  if (h && typeof h === 'object' && !rec.seen.has(h)) { rec.seen.add(h); cur.hl[r] = { i: h.icon, l: h.label, t: h.team }; }
}
const pad = (arr, rounds) => Array.from({ length: (rounds || []).length }, (_, i) => (arr && arr[i]) || '-').join(''); // позиция = номер раунда
function finish(item) {
  const st = item?.state, m = item?.match, rec = live.get(item?.id); if (!st || !m || st.v32saved) return;
  st.v32saved = 1;
  const ct = CT(), s = SS();
  const maps = (st.mapResults || []).map((r, i) => {
    const x = rec?.maps[i] || {};
    return { map: r.map, r: (r.rounds || []).map(w => (w === 1 ? '1' : '2')).join(''), s: [r.t1Score, r.t2Score], ot: !!r.overtime,
      b1: pad(x.b1, r.rounds), b2: pad(x.b2, r.rounds), hl: x.hl || {}, sim: !(r.rounds || []).length };
  });
  if (!maps.length) return;
  const list = store();
  list.unshift({ id: 'R' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ev: ct?.name || '', season: s?.currentSeason || 1,
    stage: item.stage || '', a: m.t1, b: m.t2, w: st.series1 > st.series2 ? m.t1 : m.t2, sc: [st.series1, st.series2], maps, at: (s?.calendar?.currentMs) || Date.now() });
  if (list.length > 60) list.length = 60;
  live.delete(item.id);
}
(function wrap() {
  const orig = window.broadcastAdvancePhase;
  if (typeof orig !== 'function' || orig.__v32) return;
  const w = function (item, now) {
    const r = orig.apply(this, arguments);
    try { track(item); if (item?.state?.finished || item?.state?.phase === 'finished') finish(item); } catch (e) { console.warn('[v32 replay]', e); }
    return r;
  };
  w.__v32 = true; window.broadcastAdvancePhase = w; try { broadcastAdvancePhase = w; } catch (e) {}
  const fin = window.finishBroadcastSeries;
  if (typeof fin === 'function' && !fin.__v32) {
    const f = function (item) { try { track(item); } catch (e) {} const r = fin.apply(this, arguments); try { finish(item); } catch (e) { console.warn('[v32 replay]', e); } return r; };
    f.__v32 = true; window.finishBroadcastSeries = f; try { finishBroadcastSeries = f; } catch (e) {}
  }
})();

// Повтор для завершённого матча из архива: тот же турнир, сезон, пара команд и набор карт.
function replayFor(done) {
  if (!done) return null;
  const pair = [done.a, done.b].sort().join('|'), mapsOf = x => (x.mp || []).map(p => String(p[0]).toLowerCase()).sort().join(',');
  return store().find(r => [r.a, r.b].sort().join('|') === pair && (!done.ev || !r.ev || r.ev === done.ev) &&
    (!done.mp || mapsOf(done) === r.maps.map(m => String(m.map).toLowerCase()).sort().join(','))) || null;
}

/* ------------------------------------------------------------ авто-режиссёр */
const MR = 12; // MR12: 13 побед на карте
function items() { return ((CT()?.broadcast?.active) || []).filter(i => i?.match && i.state && !i.state.finished); }
function drama(it) {
  const st = it.state, a = st.map1 || 0, b = st.map2 || 0, r = st.round || 0, me = managed();
  if (st.phase === 'map-draft') return 1 + (me && [it.match.t1, it.match.t2].includes(me) ? 6 : 0);
  const need = st.mode === 'BO1' ? 1 : st.mode === 'BO5' ? 3 : 2;
  let s = 10 - Math.abs(a - b) * 1.1;
  if (r >= 18) s += 3;
  if (Math.max(a, b) >= MR) s += 5;                          // матч-пойнт на карте
  if (st.overtime) s += 6;
  if (st.series1 === need - 1 && st.series2 === need - 1) s += 5; // решающая карта
  else if (st.series1 === need - 1 || st.series2 === need - 1) s += 2;
  if (/финал|final|grand/i.test(it.stage || '')) s += 3;
  if (me && [it.match.t1, it.match.t2].includes(me)) s += 6;
  const w = st.mapRoundWinners || [];
  if (w.length >= 4 && w.slice(-4).every(x => x === w[w.length - 1]) && (w[w.length - 1] === 1 ? a < b : b < a)) s += 2; // камбэк
  return Math.round(s * 10) / 10;
}
const DIR = { focus: null, since: 0, auto: LS('v32_director') !== '0', log: [] };
function direct() {
  const list = items(); if (!list.length) { DIR.focus = null; return null; }
  const cur = list.find(i => i.id === DIR.focus);
  if (!DIR.auto && cur) return cur;
  const best = list.map(i => ({ i, d: drama(i) })).sort((x, y) => y.d - x.d)[0];
  const hold = Date.now() - DIR.since < 15000;
  if (!cur || (DIR.auto && best.i.id !== cur.id && !hold && best.d >= drama(cur) + 3)) {
    if (cur && best.i.id !== cur.id) DIR.log.unshift(`${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} — эфир переключён на ${best.i.match.t1} vs ${best.i.match.t2}`);
    DIR.log.length = Math.min(DIR.log.length, 6);
    DIR.focus = best.i.id; DIR.since = Date.now();
    return best.i;
  }
  return cur;
}

/* ------------------------------------------------------------ элементы */
function roundStrip(rounds, opts = {}) { // rounds: массив 1/2, a = сторона команды слева
  if (!rounds.length) return '<span class="hs-dim">Раунды ещё не сыграны</span>';
  return `<div class="sp-rounds">${rounds.map((w, i) => {
    const hl = opts.hl?.[i + 1];
    return `<button type="button" class="sp-r ${w === opts.left ? 'a' : 'b'}${i === MR - 1 || i === 2 * MR - 1 || (i >= 2 * MR && (i - 2 * MR) % 3 === 2) ? ' half' : ''}${opts.sel === i + 1 ? ' sel' : ''}"${opts.click ? ` data-sprnd="${i + 1}"` : ''} title="Раунд ${i + 1}${hl ? ': ' + esc(hl.l) : ''}">${hl ? '<i></i>' : ''}</button>`;
  }).join('')}</div>`;
}
// График карты: разница в счёте по раундам (выше линии — команда слева впереди).
function flowChart(rounds, left, sel) {
  if (!rounds.length) return '';
  const W = 1000, Hh = 110, n = rounds.length, step = W / Math.max(24, n), mid = Hh / 2;
  let d = 0, max = 4; const pts = [[0, 0]];
  rounds.forEach((w, i) => { d += w === left ? 1 : -1; pts.push([i + 1, d]); max = Math.max(max, Math.abs(d)); });
  const y = v => mid - v / max * (mid - 8), x = i => i * step;
  const path = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${path}L${x(n).toFixed(1)},${mid}L0,${mid}Z`;
  return `<svg class="sp-flow" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Разница в счёте по раундам">
    <line x1="0" y1="${mid}" x2="${W}" y2="${mid}" class="z"/>${n > MR ? `<line x1="${x(MR)}" y1="0" x2="${x(MR)}" y2="${Hh}" class="h"/>` : ''}
    <path d="${area}" class="ar"/><path d="${path}" class="ln"/>${sel ? `<circle cx="${x(sel).toFixed(1)}" cy="${y(pts[sel][1]).toFixed(1)}" r="4" class="pt"/>` : ''}</svg>`;
}
function econ(st, side) {
  const e = st.economy?.['t' + side] || {}, plan = st.roundBuys?.[st.round] || st.roundBuys?.[st.round + 1];
  const buy = plan?.['t' + side]?.type;
  return `<div class="sp-eco"><b>$${(e.money || 0).toLocaleString('ru-RU')}</b><small>${buy ? esc(BUY_L[BUY[buy]] || buy) : '—'}${e.lossStreak ? ` · серия поражений ${e.lossStreak}` : ''}</small></div>`;
}

/* ------------------------------------------------------------ страница «Режим зрителя» */
function pWatch() {
  const list = items(), f = direct();
  const head = `<div class="hs-head"><h1>Режим зрителя</h1><div class="sp-tools"><label class="pt-check"><input type="checkbox" data-spauto ${DIR.auto ? 'checked' : ''}> Авто-режиссёр</label></div></div>`;
  if (!f) {
    const reps = store().slice(0, 12);
    return head + box('Эфир', empty('Сейчас нет матчей в эфире. Запустите время в шапке: эфир начнётся по календарю, а режиссёр сам выберет самый напряжённый матч.')) +
      box('Повторы последних матчей', reps.length ? reps.map(repRow).join('') : empty('Повторы появятся после первых сыгранных в эфире матчей.'), '', 'flush');
  }
  const st = f.state, m = f.match, rw = st.mapRoundWinners || [];
  const odds = st.liveOdds;
  const hl = Object.fromEntries(Object.entries(st.roundHighlights || {}).filter(([r]) => +r <= rw.length));
  const pause = st.phase === 'tactical-pause' || st.phase === 'halftime';
  const board = `<div class="sp-board">
    <div class="sp-team">${logo(m.t1, 'lg')}<b>${esc(m.t1)}</b>${econ(st, 1)}</div>
    <div class="sp-mid"><div class="sp-ev">${esc(CT()?.name || '')} · ${esc(f.stage || '')} · ${esc(st.mode || '')}</div>
      <div class="sp-sc"><b>${st.map1 || 0}</b><i>:</i><b>${st.map2 || 0}</b></div>
      <div class="sp-map">${esc(st.maps?.[st.mapIndex] || '')} · раунд ${Math.min((st.round || 0) + 1, 99)}${st.overtime ? ' · овертайм' : ''}</div>
      <div class="sp-series">Серия ${st.series1 || 0}:${st.series2 || 0}</div>
      ${pause ? `<div class="sp-pause">${esc(strip(st.phaseText))}</div>` : '<span class="hs-live">LIVE</span>'}</div>
    <div class="sp-team r">${logo(m.t2, 'lg')}<b>${esc(m.t2)}</b>${econ(st, 2)}</div></div>`;
  const oddsBar = odds ? `<div class="mc-odds"><div style="--p:${odds.p1}%"><i></i></div><div class="mc-odds-l"><span>${esc(m.t1)} <b>${odds.p1}%</b></span><span><b>${odds.p2}%</b> ${esc(m.t2)}</span></div></div>` : '';
  const mom = rw.slice(-5), m1 = mom.filter(x => x === 1).length;
  const others = list.filter(i => i.id !== f.id).map(i => { const s = i.state;
    return `<button type="button" class="sp-mini" data-spfocus="${esc(i.id)}"><span>${logo(i.match.t1, 'xs')} ${esc(i.match.t1)}</span><b>${s.map1 || 0}:${s.map2 || 0}</b><span>${esc(i.match.t2)} ${logo(i.match.t2, 'xs')}</span><small>${esc(s.maps?.[s.mapIndex] || 'вето')} · напряжение ${drama(i)}</small></button>`; }).join('');
  const feed = (st.events || []).slice(0, 12).map(e => `<li>${esc(strip(e.html))}</li>`).join('');
  return head + board + `<div class="hs-grid2"><div class="hs-col">
      ${box('Ход карты', `${roundStrip(rw, { left: 1, hl })}${flowChart(rw, 1)}<div class="mc-leg"><span><i class="a"></i>${esc(m.t1)}</span><span><i class="b"></i>${esc(m.t2)}</span><span class="hs-dim">точка на раунде — хайлайт</span></div>`)}
      ${box('Лента эфира', feed ? `<ul class="mc-feed">${feed}</ul>` : empty('События появятся с первым раундом'))}</div>
    <div class="hs-col">
      ${box('Шансы на карту', oddsBar || empty('Коэффициенты обновятся после первых раундов'))}
      ${box('Импульс', `<p class="hs-note">Последние ${mom.length} раундов: ${esc(m.t1)} ${m1} — ${esc(m.t2)} ${mom.length - m1}. Паузы: ${st.t1Pauses ?? '–'} / ${st.t2Pauses ?? '–'}.</p>`)}
      ${box('Другие матчи в эфире', others || empty('Других матчей сейчас нет'), '', 'flush')}
      ${DIR.log.length ? box('Режиссёр', `<ul class="mc-feed">${DIR.log.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`) : ''}
      </div></div>`;
}
const repRow = r => `<button type="button" class="sp-rep" data-nav="replay" data-arg="${esc(r.id)}"><span>${logo(r.a, 'xs')} <b class="${r.w === r.a ? 'w' : ''}">${esc(r.a)}</b></span><b>${r.sc[0]}:${r.sc[1]}</b><span><b class="${r.w === r.b ? 'w' : ''}">${esc(r.b)}</b> ${logo(r.b, 'xs')}</span><small>${esc(r.ev)} · ${esc(r.stage)} · сезон ${r.season}</small></button>`;

/* ------------------------------------------------------------ повтор */
const RP = { map: 0, rnd: 0 };
function pReplay(arg) {
  const [id] = String(arg || '').split('/'), r = store().find(x => x.id === id);
  if (!r) return H.back() + empty('Повтор не найден: повторы хранятся для последних 60 матчей, сыгранных в эфире.');
  if (RP.id !== id) Object.assign(RP, { id, map: 0, rnd: 0 });
  const mp = r.maps[RP.map] || r.maps[0], rounds = mp.r.split('').map(Number);
  const sel = Math.min(RP.rnd || rounds.length, rounds.length);
  let a = 0, b = 0; rounds.slice(0, sel).forEach(w => (w === 1 ? a++ : b++));
  const w = rounds[sel - 1], hl = mp.hl?.[sel], buy1 = mp.b1?.[sel - 1], buy2 = mp.b2?.[sel - 1];
  let streak = 0; for (let i = sel - 1; i >= 0 && rounds[i] === w; i--) streak++;
  const tabs = r.maps.map((x, i) => `<button type="button" class="hs-chip${i === RP.map ? ' on' : ''}" data-spmap="${i}">${esc(x.map)} ${x.s[0]}:${x.s[1]}${x.ot ? ' OT' : ''}</button>`).join('');
  const detail = mp.sim ? empty('Эта карта досчитана без эфира — по раундам её не повторить.') : `
    <div class="sp-step"><button type="button" class="hs-btn ghost" data-spstep="-1" ${sel <= 1 ? 'disabled' : ''}>← Раунд</button>
      <input type="range" min="1" max="${rounds.length}" value="${sel}" data-sprange aria-label="Раунд">
      <button type="button" class="hs-btn ghost" data-spstep="1" ${sel >= rounds.length ? 'disabled' : ''}>Раунд →</button></div>
    <div class="sp-rinfo"><div class="sp-sc sm"><b>${a}</b><i>:</i><b>${b}</b></div>
      <p><b>Раунд ${sel}${sel === MR ? ' · конец половины' : sel > 2 * MR ? ' · овертайм' : ''}</b>: выиграли ${esc(w === 1 ? r.a : r.b)}${streak > 2 ? ` (${streak}-й подряд)` : ''}.</p>
      ${BUY_L[buy1] || BUY_L[buy2] ? `<p class="hs-note">Закупки: ${esc(r.a)} — ${esc(BUY_L[buy1] || '—')}, ${esc(r.b)} — ${esc(BUY_L[buy2] || '—')}.</p>` : ''}
      ${hl ? `<p class="sp-hl">${esc(hl.i || '')} ${esc(hl.l)} — ${esc(hl.t)}</p>` : ''}</div>`;
  return `${H.back()}<div class="hs-head"><h1>Повтор: ${esc(r.a)} ${r.sc[0]}:${r.sc[1]} ${esc(r.b)}</h1><span class="hs-dim">${esc(r.ev)} · ${esc(r.stage)} · сезон ${r.season}</span></div>
    <div class="hs-filters" style="margin-bottom:12px">${tabs}</div>
    ${box(`${esc(mp.map)} · ${mp.s[0]}:${mp.s[1]}`, mp.sim ? detail : `${roundStrip(rounds, { left: 1, hl: mp.hl, sel, click: true })}${flowChart(rounds, 1, sel)}${detail}`)}`;
}

/* ------------------------------------------------------------ подключение */
H.PAGES.watch = pWatch;
H.PAGES.replay = pReplay;
H.SECTION_OF.watch = 'matches'; H.SECTION_OF.replay = 'matches';
H.NAV_GAME.unshift(['watch', 'Режим зрителя']);
// Один вход в эфир: старое окно трансляции и страница «Симулятор» ведут сюда.
const focus = id => { if (id) { DIR.focus = id; DIR.since = Date.now(); DIR.auto = false; LSset('v32_director', '0'); } H.nav('watch'); };
H.PAGES.sim = () => { setTimeout(() => H.nav('watch', null, true), 0); return ''; };
window.openBroadcastMatchDetail = focus; try { openBroadcastMatchDetail = focus; } catch (e) {}
const rerender = () => { const y = window.scrollY; H.render(); window.scrollTo(0, y); $('hs-page')?.classList.remove('hs-anim'); };
H.CLICKS.push(['[data-spfocus]', el => { DIR.focus = el.dataset.spfocus; DIR.since = Date.now(); DIR.auto = false; LSset('v32_director', '0'); rerender(); }]);
H.CLICKS.push(['[data-spmap]', el => { RP.map = +el.dataset.spmap; RP.rnd = 0; rerender(); }]);
H.CLICKS.push(['[data-sprnd]', el => { RP.rnd = +el.dataset.sprnd; rerender(); }]);
H.CLICKS.push(['[data-spstep]', el => { const r = store().find(x => x.id === RP.id), n = r ? r.maps[RP.map].r.length : 0; RP.rnd = Math.max(1, Math.min(n, (RP.rnd || n) + +el.dataset.spstep)); rerender(); }]);
document.addEventListener('change', e => {
  const t = e.target; if (!t?.closest?.('#hs-root')) return;
  if (t.matches('[data-spauto]')) { DIR.auto = t.checked; LSset('v32_director', t.checked ? '1' : '0'); DIR.since = 0; rerender(); }
});
document.addEventListener('input', e => { const t = e.target; if (t?.matches?.('[data-sprange]')) { RP.rnd = +t.value; rerender(); const n = document.querySelector('[data-sprange]'); n && n.focus(); } });
// Match Center: ссылки на эфир и повтор
const origMatch = H.PAGES.match;
H.PAGES.match = id => {
  let html = origMatch(id);
  try {
    const done = H.stats().ms.find(x => x.id === id), rep = done && replayFor(done);
    if (rep) html = html.replace(/(<div class="hs-mhead">)/, `<div class="sp-link"><button type="button" class="hs-btn ghost" data-nav="replay" data-arg="${esc(rep.id)}">Повтор матча по раундам</button></div>$1`);
    else if (!done && items().length) html = html.replace(/(<div class="hs-mhead">)/, `<div class="sp-link"><button type="button" class="hs-btn ghost" data-nav="watch">Режим зрителя</button></div>$1`);
  } catch (e) { console.warn('[v32]', e); }
  return html;
};
// Обновление эфира: на каждом раунде, паузе и смене матча, если пользователь не двигает ползунок
let sig = '';
setInterval(() => {
  if (H.S.page !== 'watch' || document.hidden) return;
  const f = direct(), st = f?.state;
  const s = [f?.id, st?.round, st?.phase, st?.mapIndex, st?.series1, st?.series2, items().length, DIR.auto].join('|');
  if (s !== sig) { sig = s; rerender(); }
}, 1200);
H.spectator = { drama, direct, replayFor, store, finish, track, focus };
console.info('[v32] режим зрителя: авто-режиссёр и повторы');
})();
