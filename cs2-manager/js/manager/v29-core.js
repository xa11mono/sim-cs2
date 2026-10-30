(() => {
'use strict';
/* =====================================================================
   v29 · ядро: стабильность симуляции, баланс, сезон, трансферные окна
   1) Матч больше не «зависает в эфире» и не оставляет дыр в сетке: любые
      побочные действия после матча (сохранение, статистика) не могут сорвать
      продвижение по сетке; сторож эфира добивает зависшие серии; старые
      повреждённые сетки чинятся автоматически.
   2) Баланс: вероятность раунда выводится из шанса на серию (калибровка по
      модели экономики), рейтинг влияет с убывающей отдачей, усталость
      восстанавливается между турнирами, чемпионов «изучают» соперники,
      игроки стареют/растут — династий навечно больше нет, но и хаоса тоже.
   3) Сезон: Major — в конце сезона; второй Major — редкость (~20%).
   4) Трансферы: большое окно после Major, редкие сделки по ходу сезона,
      ростер-лок перед Major.
   ===================================================================== */
if (typeof teams === 'undefined' || typeof seasonState === 'undefined') return;
const DAY = 864e5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const byName = n => teams.find(t => t && t.name === n) || null;
const calNow = () => { try { return Number(seasonState.calendar?.currentMs) || Date.now(); } catch (e) { return Date.now(); } };
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const emit = (type, data) => { try { (window.__v29Bus = window.__v29Bus || []).push({ type, data, at: calNow() }); if (typeof window.v29OnEvent === 'function') window.v29OnEvent(); } catch (e) {} };
window.v29Emit = emit;
const setStatus = txt => { const el = document.getElementById('tour-status'); if (el) el.innerText = txt; };
function wrapGlobal(name, make) {
  const orig = window[name];
  if (typeof orig !== 'function' || orig.__v29) return;
  const w = make(orig); w.__v29 = true; window[name] = w;
}

/* ===================================================================
   1. СТАБИЛЬНОСТЬ
   =================================================================== */
// побочные эффекты матча не должны прерывать продвижение по сетке
['recordSeriesMapResults', 'recordH2HWin', 'updateFatigueAndForm', 'accumulateMatchRating', 'recordMapResult',
 'saveTournamentToArchive', 'renderTournamentArchive', 'processErasAfterTournament', 'updateAnalyticsDashboard', 'renderSeasonBanner']
  .forEach(n => wrapGlobal(n, orig => function () { try { return orig.apply(this, arguments); } catch (e) { console.error('[v29] ' + n + ' — ошибка проглочена, симуляция продолжается', e); } }));
wrapGlobal('generateMatchEvent', orig => function () { try { return orig.apply(this, arguments); } catch (e) { return ''; } });

// мгновенный матч: колбэк сетки помечаем, чтобы видеть, дошёл ли результат до сетки
wrapGlobal('instantMatch', orig => function (match, cb) {
  const wrapped = function (w, l) { const r = cb(w, l); try { match.__v29cb = true; } catch (e) {} return r; };
  return orig.call(this, match, wrapped);
});

// эфир: досрочное «добивание» серии, если что-то пошло не так
function forceFinishItem(item, why) {
  const b = currentTournament?.broadcast; if (!b || !item) return;
  const st = item.state || {}, m = item.match; if (!m) return;
  console.warn('[v29] принудительное завершение матча эфира', m.t1, 'vs', m.t2, why || '');
  if (!m.winner) {
    let w = null;
    if ((st.series1 || 0) !== (st.series2 || 0)) w = (st.series1 || 0) > (st.series2 || 0) ? m.t1 : m.t2;
    else if ((st.map1 || 0) !== (st.map2 || 0)) w = (st.map1 || 0) > (st.map2 || 0) ? m.t1 : m.t2;
    else { const o = calcMatchOdds(m.t1, m.t2, false); w = Math.random() < (o?.p1_win ?? .5) ? m.t1 : m.t2; }
    m.winner = w; m.score = `Счет: ${st.series1 || 0} - ${st.series2 || 0}`;
  }
  const winner = m.winner, loser = winner === m.t1 ? m.t2 : m.t1;
  st.finished = true; st.phase = 'finished';
  ['launchTimeout', 'vetoTimer', 'timer'].forEach(k => { if (item[k]) { clearTimeout(item[k]); item[k] = null; } });
  const idx = (b.active || []).indexOf(item); if (idx >= 0) b.active.splice(idx, 1);
  if (item.status !== 'done') { item.status = 'done'; item.doneAt = Date.now(); (b.finished = b.finished || []).unshift(item); }
  m.broadcastStatus = 'done'; m.broadcastScore = m.score || `Победа: ${winner}`;
  if (!m.__v29cb && typeof item.callback === 'function') { try { item.callback(winner, loser); m.__v29cb = true; } catch (e) { console.error('[v29] callback', e); } }
  try { if (broadcastDetailViewing && broadcastDetailMatchId === item.id) { document.getElementById('dice-modal').style.display = 'none'; broadcastDetailViewing = false; broadcastDetailMatchId = null; } } catch (e) {}
  try { renderTournament(); renderBroadcastPanel(); } catch (e) {}
  if (currentTournament?.completed) { try { stopTournamentBroadcast(false); } catch (e) {} return; }
  if (b.running && !b.paused && !(b.active || []).length) { try { scheduleNextBroadcastBatch(); } catch (e) {} }
}
wrapGlobal('finishBroadcastSeries', orig => function (item) {
  try { return orig.apply(this, arguments); }
  catch (e) { console.error('[v29] finishBroadcastSeries', e); forceFinishItem(item, 'ошибка при завершении серии'); }
});
wrapGlobal('finishBroadcastMatch', orig => function (item, winner, loser) {
  if (item && typeof item.callback === 'function' && !item.callback.__v29) {
    const cb = item.callback, m = item.match;
    const w = function () { if (m && m.__v29cb) return; const r = cb.apply(this, arguments); if (m) m.__v29cb = true; return r; };
    w.__v29 = true; item.callback = w;
  }
  try { return orig.apply(this, arguments); }
  catch (e) { console.error('[v29] finishBroadcastMatch', e); forceFinishItem(item, 'ошибка в колбэке'); }
});
// сторож эфира: серия закончена, а матч всё ещё «в эфире» → завершаем
setInterval(() => {
  try {
    const b = currentTournament?.broadcast; if (!b || !Array.isArray(b.active) || !b.active.length) return;
    const now = Date.now();
    b.active.slice().forEach(item => {
      const st = item?.state, m = item?.match; if (!st || !m) return;
      const need = st.mode === 'BO1' ? 1 : st.mode === 'BO5' ? 3 : 2;
      const over = st.finished || (st.series1 || 0) >= need || (st.series2 || 0) >= need || (Array.isArray(st.maps) && st.maps.length && st.mapIndex >= st.maps.length);
      if (over || (m.winner && item.status === 'live')) {
        item.__v29over = item.__v29over || now;
        if (now - item.__v29over > 2500) forceFinishItem(item, 'серия окончена, но матч висел в эфире');
      } else item.__v29over = 0;
    });
  } catch (e) {}
}, 1200);

// починка застрявшей сетки (старые сейвы, где результат не дошёл до следующего раунда)
function v29RepairTournament() {
  const ct = currentTournament; if (!ct || ct.completed) return false;
  let fixed = 0;
  const run = (fn, ...a) => { try { fn(...a); fixed++; } catch (e) { console.error('[v29] repair', e); } };
  const has = (m, n) => m && (m.t1 === n || m.t2 === n);
  // Swiss: таблица пересчитывается по фактически сыгранным матчам
  const recount = (teamsArr, rounds) => {
    if (!Array.isArray(teamsArr) || !Array.isArray(rounds)) return;
    const rec = {}; teamsArr.forEach(t => rec[t.name] = { w: 0, l: 0, pa: [] });
    rounds.forEach(r => (r || []).forEach(m => { if (!m?.t1 || !m?.t2) return; if (rec[m.t1]) rec[m.t1].pa.push(m.t2); if (rec[m.t2]) rec[m.t2].pa.push(m.t1);
      if (!m.winner) return; const l = m.winner === m.t1 ? m.t2 : m.t1; if (rec[m.winner]) rec[m.winner].w++; if (rec[l]) rec[l].l++; }));
    teamsArr.forEach(t => { const x = rec[t.name]; if (!x) return; if (t.wins !== x.w || t.losses !== x.l) { t.wins = x.w; t.losses = x.l; t.diff = 2 * (x.w - x.l); fixed++; } t.playedAgainst = x.pa; });
  };
  // Major: стадии Swiss
  if (ct.majorStages) {
    for (let si = 0; si < 3; si++) {
      const st = ct.majorStages[si];
      if (!st) { const prev = ct.majorStages[si - 1]; if (prev && prev.completed) run(finalizeMajorStage, si); break; }
      if (st.completed) { if (si === 2 && !(ct.upperRounds || []).length) run(finalizeMajorStage, 3); continue; }
      recount(st.teams, st.rounds);
      const last = st.rounds[st.rounds.length - 1] || [];
      if (last.length && last.every(x => x.winner)) {
        if (st.currentRound < 5 && st.teams.some(t => t.wins < 3 && t.losses < 3)) { st.currentRound++; run(generateMajorSwissRound, st); }
        else run(finalizeMajorStage, si + 1);
      }
      break;
    }
  }
  if (ct.swiss?.rounds?.length) {
    recount(ct.swiss.teams, ct.swiss.rounds);
    const last = ct.swiss.rounds[ct.swiss.rounds.length - 1] || [];
    if (last.length && last.every(x => x.winner)) {
      if (ct.swiss.currentRound < 5) { ct.swiss.currentRound++; run(generateSwissRound, ct.swiss.currentRound); }
      else run(finalizeSwissStage);
    }
  }
  if (ct.gsl?.groups) {
    ct.gsl.groups.forEach((g, gi) => {
      const M = g.matches || {}; const L = m => m?.winner ? (m.winner === m.t1 ? m.t2 : m.t1) : null;
      g.qualified = g.qualified || []; g.eliminated = g.eliminated || [];
      const setSlot = (m, k, v) => { if (m && v && !m[k] && m[k === 't1' ? 't2' : 't1'] !== v) { m[k] = v; fixed++; } };
      const addTo = (arr, v) => { if (v && !arr.includes(v)) { arr.push(v); fixed++; } };
      if (M.opening1?.winner) { setSlot(M.winners, M.winners.t1 && M.winners.t1 !== M.opening1.winner && !M.winners.t2 ? 't2' : 't1', M.opening1.winner); setSlot(M.losers, M.losers.t1 && M.losers.t1 !== L(M.opening1) && !M.losers.t2 ? 't2' : 't1', L(M.opening1)); }
      if (M.opening2?.winner) { setSlot(M.winners, M.winners.t1 && M.winners.t1 !== M.opening2.winner ? 't2' : 't1', M.opening2.winner); setSlot(M.losers, M.losers.t1 && M.losers.t1 !== L(M.opening2) ? 't2' : 't1', L(M.opening2)); }
      if (M.winners?.winner) { addTo(g.qualified, M.winners.winner); setSlot(M.decider, 't1', L(M.winners)); }
      if (M.losers?.winner) { setSlot(M.decider, 't2', M.losers.winner); addTo(g.eliminated, L(M.losers)); if (!ct.placements[L(M.losers)]) ct.placements[L(M.losers)] = { place: 12, title: `GSL Вылет (Группа ${String.fromCharCode(65 + gi)})` }; }
      if (M.decider?.winner) { addTo(g.qualified, M.decider.winner); addTo(g.eliminated, L(M.decider)); if (!ct.placements[L(M.decider)]) ct.placements[L(M.decider)] = { place: 12, title: `GSL Вылет (Группа ${String.fromCharCode(65 + gi)})` }; }
      Object.values(M).forEach(m => { if (m?.winner) m.__resolved = true; });
    });
    const done = ct.gsl.groups.every(g => ['opening1', 'opening2', 'winners', 'losers', 'decider'].every(k => g.matches?.[k]?.winner));
    if (done) run(finalizeGSLStage);
  }
  if (ct.bounty && !ct.bounty.lanStageStarted) {
    const b = ct.bounty;
    b.stage1.forEach((m, i) => { if (m.winner && !has(b.stage2[Math.floor(i / 2)], m.winner)) run(resolveBountyMatch, 1, i); });
    if (b.stage2.length && b.stage2.every(x => x.winner)) run(resolveBountyMatch, 2, b.stage2.length - 1);
  }
  const up = ct.upperRounds || [], lo = ct.lowerRounds || [];
  // соперник в первом раунде так и не появился → техническая победа (bye)
  (up[0] || []).forEach((m, mi) => { if (m && !m.winner && !!m.t1 !== !!m.t2) { m.winner = m.t1 || m.t2; m.score = 'Счет: 2 - 0'; m.__bye = true; run(resolveUpperMatch, 0, mi); } });
  up.forEach((r, ri) => (r || []).forEach((m, mi) => {
    if (!m?.winner || !m.t1 || !m.t2) return;
    if (ri < up.length - 1) { if (!has(up[ri + 1][Math.floor(mi / 2)], m.winner)) run(resolveUpperMatch, ri, mi); }
    else if (ct.hasLowerBracket) { if (ct.grandFinal && ct.grandFinal.t1 !== m.winner) run(resolveUpperMatch, ri, mi); }
    else if (ct.placements?.[m.winner]?.place !== 1) run(resolveUpperMatch, ri, mi);
  }));
  lo.forEach((r, ri) => (r || []).forEach((m, mi) => {
    if (!m?.winner || !m.t1 || !m.t2) return;
    const later = ri < lo.length - 1 ? lo.slice(ri + 1).some(rr => (rr || []).some(x => has(x, m.winner))) : (ct.grandFinal?.t2 === m.winner);
    if (!later) run(resolveLowerMatch, ri, mi);
  }));
  if (ct.bronzeMatch?.winner && ct.placements?.[ct.bronzeMatch.winner]?.place !== 3) run(resolveBronzeMatch);
  if (ct.grandFinal?.winner && !ct.completed && ct.placements?.[ct.grandFinal.winner]?.place !== 1) run(resolveGrandFinal);
  if (!ct.completed && fixed) { try { checkTournamentCompletion(); } catch (e) {} }
  if (fixed) { console.info('[v29] сетка восстановлена, действий:', fixed); try { renderTournament(); } catch (e) {} }
  return fixed > 0;
}
window.v29RepairTournament = v29RepairTournament;
function isStuck() {
  const ct = currentTournament;
  if (!ct || ct.completed) return false;
  if (isFastSimRunning || isStepSimRunning) return false;
  if ((ct.broadcast?.active || []).length) return false;
  try { return !getNextPlayableMatch(); } catch (e) { return true; }
}
wrapGlobal('simulateWholeTournament', orig => function () {
  const r = orig.apply(this, arguments);
  for (let i = 0; i < 4 && isStuck(); i++) {
    if (!v29RepairTournament()) break;
    orig.apply(this, arguments);
  }
  if (isStuck()) setStatus('⚠️ Сетка этого турнира повреждена старым сохранением. Нажмите «Сгенерировать сетку» — турнир начнётся заново, очки не потеряются.');
  return r;
});
let lastStuckCheck = 0;
setInterval(() => {
  try {
    if (!isStuck() || Date.now() - lastStuckCheck < 4000) return;
    lastStuckCheck = Date.now();
    if (v29RepairTournament()) { setStatus('🔧 Сетка восстановлена — турнир можно продолжать'); return; }
    if (isStuck()) setStatus('⚠️ Сетка этого турнира повреждена старым сохранением. Нажмите «Сгенерировать сетку» — турнир начнётся заново, очки не потеряются.');
  } catch (e) {}
}, 2000);

/* ===================================================================
   2. БАЛАНС
   =================================================================== */
// вероятность выиграть карту при данной вероятности раунда (модель экономики instantMatch)
const RT = [[0.3,0.0124],[0.31,0.0156],[0.32,0.0218],[0.33,0.0289],[0.34,0.0376],[0.35,0.0468],[0.36,0.0599],[0.37,0.0767],[0.38,0.0935],[0.39,0.114],[0.4,0.1366],[0.41,0.167],[0.42,0.1895],[0.43,0.2252],[0.44,0.2596],[0.45,0.295],[0.46,0.3351],[0.47,0.3701],[0.48,0.4144],[0.49,0.458],[0.5,0.5],[0.51,0.5399],[0.52,0.5855],[0.53,0.6278],[0.54,0.6673],[0.55,0.7082],[0.56,0.7404],[0.57,0.7795],[0.58,0.8103],[0.59,0.8374],[0.6,0.8623],[0.61,0.8863],[0.62,0.907],[0.63,0.9215],[0.64,0.9383],[0.65,0.9504],[0.66,0.9623],[0.67,0.971],[0.68,0.9773],[0.69,0.9838],[0.7,0.9867]];
function roundFromMap(M) {
  M = clamp(M, RT[0][1], RT[RT.length - 1][1]);
  for (let i = 1; i < RT.length; i++) if (RT[i][1] >= M) { const [q0, m0] = RT[i - 1], [q1, m1] = RT[i]; return q0 + (q1 - q0) * ((M - m0) / Math.max(1e-9, m1 - m0)); }
  return RT[RT.length - 1][0];
}
function mapFromSeries(P, wins = 2) { // обратная к P = шанс серии BO3/BO5 при шансе карты M
  P = clamp(P, 0.001, 0.999);
  const f = M => wins === 3 ? M * M * M * (10 - 15 * M + 6 * M * M) : M * M * (3 - 2 * M);
  let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (f(mid) < P) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function strength(name) {
  const t = byName(name);
  if (!t) return 30;
  try { ensurePlayerLayer(t); } catch (e) {}
  const pts = Number(getTeamCurrentPts(name)) || Number(t.pts) || 600;
  const R = 330 * Math.tanh((pts - 650) / 330);                     // рейтинг — с убывающей отдачей
  const pl = t.playerLayer || {};
  const P = ((Number(pl.power) || 84) - 85) * 14;                    // уровень игроков
  const F = (clamp(Number(t.form) || 100, 85, 115) - 100) * 2.5;
  const C = ((Number(pl.chemistry) || 80) - 80) * 0.8 + ((Number(pl.morale) || 88) - 88) * 0.4;
  const fat = clamp(Number(t.fatigue) || 0, 0, 85);
  const Fat = fat <= 15 ? 0 : Math.pow(fat - 15, 1.3) * 0.9;           // усталость — плавно
  const Meta = Number(t.v29Meta) || 0;                               // соперники разобрали игру чемпиона
  return R + P + F + C - Fat - Meta;
}
function seriesP(a, b) { return clamp(1 / (1 + Math.pow(10, -(strength(a) - strength(b)) / 520)), 0.1, 0.9); }
window.calcMatchOdds = function (t1Name, t2Name, isBO1 = false) {
  if (!t1Name || !t2Name) return null;
  let p1 = seriesP(t1Name, t2Name);
  if (isBO1) p1 = clamp(mapFromSeries(p1), 0.12, 0.88);
  const pct1 = Math.round(p1 * 100), pct2 = 100 - pct1;
  const c1 = Math.max(1.05, Math.min(7.5, 0.94 / p1)).toFixed(2), c2 = Math.max(1.05, Math.min(7.5, 0.94 / (1 - p1))).toFixed(2);
  return { pct1, pct2, c1, c2, p1_win: p1 };
};
function mapStr(name, map) { const v = Number(byName(name)?.mapStrength?.[map]); return Number.isFinite(v) ? v : 55; }
function liveItem(t1, t2) {
  const b = currentTournament?.broadcast; if (!b) return null;
  return (b.active || []).find(i => i?.match && ((i.match.t1 === t1 && i.match.t2 === t2) || (i.match.t1 === t2 && i.match.t2 === t1))) || null;
}
function mapLevel(t1, t2, map) {
  let M = mapFromSeries(seriesP(t1, t2));
  if (map) M += clamp(mapStr(t1, map) - mapStr(t2, map), -25, 25) * 0.0035;
  return clamp(M, 0.05, 0.95);
}
window.v29MapLevelProb = mapLevel;
window.calcMapWinProbability = function (t1Name, t2Name, mapName) {
  if (!byName(t1Name) || !byName(t2Name)) return 0.5;
  let M = mapLevel(t1Name, t2Name, mapName);
  const item = liveItem(t1Name, t2Name), st = item?.state;
  const sign = st?.__match ? (st.__match.t1 === t1Name ? 1 : -1) : 1;
  if (st && Array.isArray(st.maps)) { if (st.mapIndex === 0) M += 0.04 * sign; else if (st.mapIndex === 1) M -= 0.04 * sign; }
  let q = roundFromMap(clamp(M, 0.03, 0.97));
  if (st && !st.finished) {
    const signed = sign * ((st.map1 || 0) - (st.map2 || 0));
    q += clamp(signed, -6, 6) * 0.0025;
    try { const tr = getBroadcastTeamTrend(st, sign === 1 ? 1 : 2, 5); q += clamp(tr.streak || 0, -5, 5) * 0.002; } catch (e) {}
    const imp = st.v7SpecialImpact; if (imp) { const me = sign === 1 ? 1 : 2, op = me === 1 ? 2 : 1; q += clamp((imp[me]?.value || 0) - (imp[op]?.value || 0), -0.025, 0.025) * 0.6; }
  }
  return clamp(q, 0.3, 0.7);
};
try { calcMapWinProbability = window.calcMapWinProbability; } catch (e) {}
try { calcMatchOdds = window.calcMatchOdds; } catch (e) {}

// усталость: отдых между турнирами восстанавливает силы
function restTeams() {
  const now = calNow();
  teams.forEach(t => {
    try {
      ensurePlayerLayer(t);
      const last = Number(t.v29RestMs) || 0;
      const days = last ? clamp((now - last) / DAY, 0, 120) : 14;
      const rec = clamp(days * 3.2, 6, 70);
      (t.players || []).forEach(p => {
        p.fatigue = clamp((Number(p.fatigue) || 0) - rec, 0, 85);
        p.morale = clamp((Number(p.morale) || 88) + (88 - (Number(p.morale) || 88)) * 0.25, 40, 100);
        p.form = clamp((Number(p.form) || 100) + (100 - (Number(p.form) || 100)) * 0.2, 80, 120);
      });
      ensurePlayerLayer(t);
      t.v29RestMs = now;
    } catch (e) {}
  });
}
wrapGlobal('createTournament', orig => function () {
  try { restTeams(); } catch (e) { console.warn('[v29] rest', e); }
  return orig.apply(this, arguments);
});
try { createTournament = window.createTournament; } catch (e) {}

// игроки: возраст, рост молодых, спад ветеранов, завершение карьеры
function ageOf(p) { if (!Number.isFinite(Number(p.age)) || !p.age) p.age = 19 + (h32(p.nick) % 10); return Number(p.age); }
function developPlayers(season) {
  if (seasonState.v29DevSeason === season) return;
  seasonState.v29DevSeason = season;
  const notes = [];
  teams.forEach(t => {
    try {
      ensurePlayerLayer(t);
      t.players.forEach((p, idx) => {
        const age = ageOf(p) + 1; p.age = age;
        const r = (h32(p.nick + '|' + season) % 1000) / 1000, r2 = (h32('b' + p.nick + season) % 1000) / 1000;
        let d = age <= 20 ? 2 + r * 3 : age <= 23 ? r * 2.6 : age <= 26 ? -0.8 + r * 1.8 : age <= 28 ? -1.8 + r * 1.6 : -3.2 + r * 2;
        if (r2 > 0.95) d += 3.5;                         // неожиданный прорыв
        if (r2 < 0.04 && age > 24) d -= 2.5;             // потеря формы надолго
        const iq = age <= 29 ? 0.6 + r * 0.8 : -0.4 + r * 0.6;
        p.firepower = clamp(Math.round((Number(p.firepower) + d) * 10) / 10, 60, 99);
        p.clutch = clamp(Math.round((Number(p.clutch) + d * 0.6) * 10) / 10, 60, 98);
        p.tacticalIQ = clamp(Math.round((Number(p.tacticalIQ) + iq) * 10) / 10, 60, 99);
        p.utility = clamp(Math.round((Number(p.utility) + iq * 0.6) * 10) / 10, 60, 99);
        if (r2 > 0.95) notes.push({ kind: 'breakout', player: p.nick, team: t.name, age, fp: p.firepower, ac: t.isAcademy ? 1 : 0 });
      });
      // завершение карьеры ветеранов
      if (!t.isAcademy) {
        t.players.slice().forEach(p => {
          const age = Number(p.age) || 25;
          const chance = age >= 37 ? 0.9 : age >= 35 ? 0.55 : age >= 33 ? 0.22 : age >= 31 ? 0.05 : 0; // v33: мягче — многие играют до 33–35
          if (!chance || (h32('ret' + p.nick + season) % 1000) / 1000 > chance) return;
          const i = t.players.indexOf(p);
          let rep = null;
          try { rep = generateFreeAgent(t, p.role, (transferState.marketRuns || 0) * 7 + i + season * 31); } catch (e) {}
          if (!rep) return;
          rep.status = 'STARTER'; rep.age = 18 + (h32(rep.nick) % 3);
          rep.firepower = clamp(Number(p.firepower) - 4 + (h32(rep.nick + 'f') % 6), 66, 92);
          t.players[i] = rep;
          t.rosterLastChange = { type: 'IN', player: rep.nick, from: 'Академия / FA', reason: `${p.nick} завершил карьеру` };
          try { transferLog(`👋 ${p.nick} (${t.name}, ${age} лет) завершил карьеру. Его место занял ${rep.nick} (${rep.role}).`, 'retire'); } catch (e) {}
          emit('retire', { player: p.nick, team: t.name, age, rep: rep.nick, role: p.role });
        });
      }
      ensurePlayerLayer(t);
    } catch (e) { console.warn('[v29] development', t?.name, e); }
  });
  notes.sort((a, b) => (a.ac - b.ac) || (b.fp - a.fp)).slice(0, 3).forEach(n => emit('breakout', n));
}

/* ===================================================================
   3. РАСПИСАНИЕ СЕЗОНА: Major в финале сезона, второй — редко
   =================================================================== */
const MAJOR_NAMES = ['PGL Major', 'BLAST.tv Major', 'IEM Major', 'Perfect World Major', 'StarLadder Major', 'ESL Major', 'PGL Major Copenhagen', 'BLAST.tv Austin Major', 'IEM Cologne Major', 'StarLadder Budapest Major'];
const SLOTS = [ // [тип, название, день, длительность, формат, профиль]
  ['elite', 'IEM Katowice (Spodek Arena)', 12, 5, 'double', 'elite'],
  ['regular', 'BLAST Premier Spring Groups', 36, 4, 'single', 'open'],
  ['elite', 'ESL Pro League Season', 60, 5, 'gsl', 'elite'],
  ['regular', 'PGL Bucharest', 84, 5, 'swiss', 'open'],
  ['elite', 'BLAST Premier Spring Final', 108, 4, 'double', 'elite'],
  ['regular', 'CCT Season Finals Europe', 130, 4, 'single', 'open'],
  ['elite', 'IEM Dallas', 152, 4, 'double', 'elite'],
  ['elite', 'IEM Cologne (Lanxess Arena)', 178, 6, 'double', 'elite'],      // слот второго Major
  ['regular', 'BLAST Premier Fall Groups', 206, 4, 'single', 'open'],
  ['elite', 'ESL Pro League Playoffs', 228, 5, 'gsl', 'elite'],
  ['elite', 'IEM Chengdu', 252, 4, 'double', 'elite'],
  ['regular', 'Thunderpick World Championship', 276, 5, 'swiss', 'open'],
  ['elite', 'BLAST Premier World Final', 300, 4, 'double', 'elite'],
  ['major', null, 330, 7, 'swiss', 'major']                                  // финал сезона
];
const MID_MAJOR_SLOT = 8;
function seasonHasTwoMajors(season) {
  seasonState.v29TwoMajors = seasonState.v29TwoMajors || {};
  if (seasonState.v29TwoMajors[season] !== undefined) return !!seasonState.v29TwoMajors[season];
  const prev = !!seasonState.v29TwoMajors[season - 1];
  const two = !prev && (h32('two|' + season + '|' + (seasonState.v29Salt || '')) % 100) < 20;
  seasonState.v29TwoMajors[season] = two;
  return two;
}
function majorName(season, which) {
  const y = 2026 + (season - 1);
  const pool = MAJOR_NAMES.slice(); const i = h32('mj|' + season + '|' + which) % pool.length;
  let n = pool[i]; if (which === 'mid' && /Cologne/.test(n) === false) n = 'IEM Cologne Major';
  if (which === 'end' && n === 'IEM Cologne Major') n = 'PGL Major';
  return `${n} ${y}`;
}
function slotDef(i, season) { // i = 1..14
  const s = SLOTS[i - 1]; const y = 2026 + (season - 1);
  const two = seasonHasTwoMajors(season);
  if (i === SLOTS.length) return { type: 'major', name: majorName(season, 'end'), format: 'swiss', field: 'major', day: s[2], dur: s[3] };
  if (two && i === MID_MAJOR_SLOT) return { type: 'major', name: majorName(season, 'mid'), format: 'swiss', field: 'major', day: s[2], dur: 7 };
  return { type: s[0], name: `${s[1]} ${y}`, format: s[4], field: s[5], day: s[2], dur: s[3] };
}
function applySlot(step, d, keepDates) {
  step.type = d.type; step.name = d.name; step.format = d.format; step.fieldProfile = d.field; step.size = 16;
  step.min = d.type === 'major' ? 500 : d.type === 'elite' ? 450 : 250; step.max = 2000;
  if (!keepDates) {
    const anchor = Number(seasonState.calendar?.seasonAnchorMs) || new Date(2026 + ((seasonState.currentSeason || 1) - 1), 0, 2, 9).getTime();
    const st = new Date(anchor + d.day * DAY); st.setHours(15, 0, 0, 0);
    step.calendar = Object.assign({}, step.calendar || {}, { dayOffset: d.day, durationDays: d.dur, restBeforeDays: 2, startTime: '15:00', startMs: st.getTime(), endMs: st.getTime() + d.dur * DAY });
  } else if (step.calendar) { step.calendar.durationDays = Math.max(Number(step.calendar.durationDays) || 4, d.dur); step.calendar.endMs = Number(step.calendar.startMs) + step.calendar.durationDays * DAY; }
}
function rewriteSchedule(fromIdx, keepDates) {
  const arr = seasonState.seasonSchedule; if (!Array.isArray(arr) || arr.length < 3) return;
  const season = Number(seasonState.currentSeason) || 1;
  for (let i = Math.max(1, fromIdx); i < arr.length && i <= SLOTS.length; i++) { if (!arr[i]) arr[i] = {}; applySlot(arr[i], slotDef(i, season), keepDates); }
  arr.length = Math.min(arr.length, SLOTS.length + 1);
  seasonState.v29SchedSeason = season;
}
wrapGlobal('generateDynamicSeasonSchedule', orig => function () {
  const r = orig.apply(this, arguments);
  try { rewriteSchedule(1, false); saveSeasonState(); } catch (e) { console.warn('[v29] schedule', e); }
  return r;
});
try { generateDynamicSeasonSchedule = window.generateDynamicSeasonSchedule; } catch (e) {}
// текущий сезон старого сейва: будущие турниры переразмечаем (даты не трогаем)
try {
  if (!seasonState.v29Salt) seasonState.v29Salt = Math.random().toString(36).slice(2, 8);
  if (seasonState.v29SchedSeason !== seasonState.currentSeason && Array.isArray(seasonState.seasonSchedule)) {
    const idx = Number(seasonState.tournamentIndex) || 1, season = seasonState.currentSeason;
    const playedMajors = seasonState.seasonSchedule.slice(1, idx).filter(s => s?.type === 'major').length;
    seasonState.v29TwoMajors = seasonState.v29TwoMajors || {};
    if (playedMajors >= 1) seasonState.v29TwoMajors[season] = false;     // в этом сезоне Major уже был — остаётся только финальный
    rewriteSchedule(idx, idx > 1);   // новый сезон без сыгранных турниров — ставим и новые даты
    const last = seasonState.seasonSchedule[seasonState.seasonSchedule.length - 1];
    if (playedMajors >= 2 && last && seasonState.seasonSchedule.length - 1 >= idx) // переходный сезон: больше двух Major не бывает
      applySlot(last, { type: 'elite', name: `BLAST Premier World Final ${2026 + season - 1}`, format: 'double', field: 'elite', day: 330, dur: 4 }, true);
    saveSeasonState();
    try { updateTournamentSuggestion(); } catch (e) {}
  }
} catch (e) { console.warn('[v29] schedule migrate', e); }

/* ===================================================================
   4. ТРАНСФЕРНЫЕ ОКНА
   =================================================================== */
const nextStep = () => seasonState.seasonSchedule?.[seasonState.tournamentIndex] || null;
// структурированный учёт переходов (для новостей и страницы трансферов HLTV)
wrapGlobal('applyPlayerTransfer', orig => function (fromTeam, toTeam, player, reason) {
  const beforeTo = (toTeam?.players || []).map(p => p.nick), beforeFrom = (fromTeam?.players || []).map(p => p.nick);
  const ok = orig.apply(this, arguments);
  if (ok) {
    const out = beforeTo.find(n => !(toTeam.players || []).some(p => p.nick === n)) || null;
    const rep = (fromTeam.players || []).map(p => p.nick).find(n => !beforeFrom.includes(n)) || null;
    emit('transfer', { player: player.nick, role: player.role, from: fromTeam.name, to: toTeam.name, out, rep, reason, star: (typeof isStarPlayer === 'function' && isStarPlayer(player)), window: window.__v29Window || 'mid' });
  }
  return ok;
});
wrapGlobal('maybeTransferCoach', orig => function (t) {
  const before = t?.coach?.name; const r = orig.apply(this, arguments);
  if (r && t?.coach?.name && t.coach.name !== before) emit('coach', { team: t.name, from: before || '—', to: t.coach.name });
  return r;
});
wrapGlobal('applyTemporaryStandIn', orig => function (t, reason) {
  const r = orig.apply(this, arguments);
  if (r && t?.rosterLastChange?.type === 'STAND-IN') emit('standin', { team: t.name, player: t.rosterLastChange.player, out: t.rosterLastChange.from, reason });
  return r;
});
// «звезда уходит из гранда» — талант перетекает из топ-3 в середину рейтинга (против вечных династий)
function starExodus() {
  const ranked = teams.filter(t => !t.isAcademy).sort((a, b) => b.pts - a.pts);
  const top = ranked.slice(0, 3), mid = ranked.slice(3, 16);
  if (Math.random() > 0.6 || !mid.length) return 0;
  const from = top[Math.floor(Math.random() * top.length)]; ensurePlayerLayer(from);
  const cands = from.players.filter(p => p.status === 'STARTER' && p.role !== 'IGL').sort((a, b) => playerPower(b) - playerPower(a)).slice(0, 3);
  const p = cands[Math.floor(Math.random() * cands.length)]; if (!p) return 0;
  const buyers = mid.filter(t => { try { return teamIdentityFit(t, p) >= 0.5; } catch (e) { return true; } }).sort(() => Math.random() - .5);
  const old = window.playerWillAccept; window.playerWillAccept = () => true;
  try { for (const to of buyers.slice(0, 4)) { if (applyPlayerTransfer(from, to, p, 'ради роли лидера и крупного контракта')) return 1; } }
  finally { window.playerWillAccept = old; }
  return 0;
}
// топ-4 без провала на Major не скупают игроков у середняков — иначе таланты стекаются в 2–3 клуба
wrapGlobal('teamNeedsTransfer', orig => function (t) {
  const info = orig.apply(this, arguments);
  try {
    const rank = teams.filter(x => !x.isAcademy).sort((a, b) => b.pts - a.pts).indexOf(t) + 1;
    if (info && info.trigger && rank > 0 && rank <= 4 && !info.majorFail && (info.losses || 0) < 5) info.trigger = false;
  } catch (e) {}
  return info;
});
// окно открывается после Major; по ходу сезона сделки редки; перед Major — ростер-лок
const baseMarket = window.processTransferMarket;
if (typeof baseMarket === 'function' && !baseMarket.__v29) {
  const gated = function (reason) {
    if (reason !== 'tournament_end') return baseMarket.apply(this, arguments);
    const ct = currentTournament, nx = nextStep();
    const postMajor = !!ct?.isMajor;
    try {
      if (postMajor) {
        window.__v29Window = 'post-major';
        emit('window-open', { after: ct.name, season: ct.season });
        let moves = 0;
        for (let pass = 0; pass < 1; pass++) { /* v33: окно после Major — один круг (дальше рынок v30 по правилам окон) */ transferState.cooldown = 0; const before = (transferState.history || []).length; baseMarket.call(this, reason); moves += Math.max(0, (transferState.history || []).length - before); }
        starExodus();
        transferState.cooldown = 0;
        emit('window-close', { season: ct.season, next: nx?.name || null });
        return;
      }
      if (nx?.type === 'major') {
        transferState.cooldown = 0;
        emit('roster-lock', { major: nx.name, season: seasonState.currentSeason });
        try { transferLog(`🔒 Ростер-лок: до ${nx.name} составы заморожены, трансферов не будет.`, 'market'); saveTransferState(); } catch (e) {}
        return;
      }
      window.__v29Window = 'mid';
      if (Math.random() < 0.18) { transferState.cooldown = 0; baseMarket.call(this, reason); }   // по ходу сезона сделки редки
    } finally { window.__v29Window = null; }
  };
  gated.__v29 = true; window.processTransferMarket = gated;
  try { processTransferMarket = gated; } catch (e) {}
}

/* ===================================================================
   5. ИТОГИ ТУРНИРА: «разбор» чемпиона, развитие игроков, события для новостей
   =================================================================== */
const baseFinalize = window.finalizeTournamentRating;
if (typeof baseFinalize === 'function' && !baseFinalize.__v29) {
  const w = function () {
    const ct = currentTournament;
    if (!ct || ct.completed) return baseFinalize.apply(this, arguments);
    const seasonBefore = seasonState.currentSeason;
    const rankBefore = {}; teams.filter(t => !t.isAcademy).sort((a, b) => b.pts - a.pts).forEach((t, i) => rankBefore[t.name] = i + 1);
    const leaderBefore = Object.keys(rankBefore).find(k => rankBefore[k] === 1);
    let r;
    try { r = baseFinalize.apply(this, arguments); }
    catch (e) { console.error('[v29] finalize', e); ct.completed = true; }
    try {
      const pl = ct.placements || {};
      const champ = Object.keys(pl).find(n => pl[n].place === 1), second = Object.keys(pl).find(n => pl[n].place === 2);
      teams.forEach(t => { t.v29Meta = Math.round((Number(t.v29Meta) || 0) * 0.55 * 10) / 10; });
      const ct1 = byName(champ), ct2 = byName(second);
      if (ct1) { ct1.v29Meta = (ct1.v29Meta || 0) + (ct.isMajor ? 30 : ct.isElite ? 24 : 16); ct1.v29Titles = (ct1.v29Titles || 0) + 1; }
      if (ct2) ct2.v29Meta = (ct2.v29Meta || 0) + 6;
      const rankAfter = {}; teams.filter(t => !t.isAcademy).sort((a, b) => b.pts - a.pts).forEach((t, i) => rankAfter[t.name] = i + 1);
      const leaderAfter = Object.keys(rankAfter).find(k => rankAfter[k] === 1);
      const matches = (typeof collectTournamentMatches === 'function') ? collectTournamentMatches(ct) : [];
      const upsets = matches.filter(m => m.winner && rankBefore[m.winner] && rankBefore[m.winner === m.t1 ? m.t2 : m.t1] && rankBefore[m.winner] - rankBefore[m.winner === m.t1 ? m.t2 : m.t1] >= 8 && rankBefore[m.winner === m.t1 ? m.t2 : m.t1] <= 6)
        .map(m => ({ w: m.winner, l: m.winner === m.t1 ? m.t2 : m.t1, rw: rankBefore[m.winner], rl: rankBefore[m.winner === m.t1 ? m.t2 : m.t1], score: m.score || '', bo: m.broadcastResult?.maps?.map(x => `${x.map} ${x.t1Score}:${x.t2Score}`) || [] }));
      const final = ct.grandFinal?.winner ? ct.grandFinal : (ct.upperRounds?.length ? ct.upperRounds[ct.upperRounds.length - 1]?.[0] : null);
      const finalMaps = final?.broadcastResult?.maps || [];
      const lost = matches.filter(m => m.winner && (m.t1 === champ || m.t2 === champ) && m.broadcastResult).reduce((s, m) => s + (m.broadcastResult.maps || []).filter(x => x.winner && x.winner !== champ).length, 0);
      const champHist = ct1 ? (ct1.history || []).filter(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward) : [];
      const prevT1 = (seasonState.v29LastT1Champs || []);
      emit('tournament', {
        name: ct.name, season: ct.season, id: ct.hubArchiveId || null, major: !!ct.isMajor, elite: !!ct.isElite, size: (ct.participants || []).length,
        champ, second, third: Object.keys(pl).filter(n => pl[n].place === 3), champRankBefore: rankBefore[champ] || null, secondRankBefore: rankBefore[second] || null,
        finalScore: final?.score || '', finalMaps: finalMaps.map(x => ({ map: x.map, a: x.t1Score, b: x.t2Score, w: x.winner, ot: !!x.overtime })), finalT1: final?.t1, finalT2: final?.t2,
        mapsLost: lost, titlesTotal: champHist.length, firstTitle: champHist.length === 1, streak: prevT1[0] === champ ? (prevT1[1] || 1) + 1 : 1,
        upsets: upsets.slice(0, 3), leaderBefore, leaderAfter, rankBefore, rankAfter
      });
      seasonState.v29LastT1Champs = [champ, prevT1[0] === champ ? (prevT1[1] || 1) + 1 : 1];
      if (seasonState.currentSeason !== seasonBefore) {
        developPlayers(seasonState.currentSeason);
        try { window.v29CompactSaves && window.v29CompactSaves(1); } catch (e) {}
        const hof = (seasonState.hallOfFame || []).find(x => x.season === seasonBefore);
        emit('season-end', { season: seasonBefore, champion: hof?.champion, awards: hof?.awards || null, pts: hof?.scorePts, nextTwoMajors: seasonHasTwoMajors(seasonState.currentSeason) });
      }
      const nx = nextStep();
      if (nx?.type === 'major') emit('major-preview', { name: nx.name, season: seasonState.currentSeason, startMs: nx.calendar?.startMs || null });
      saveTeams(); saveSeasonState();
    } catch (e) { console.warn('[v29] after-finalize', e); }
    return r;
  };
  w.__v29 = true; window.finalizeTournamentRating = w;
  try { finalizeTournamentRating = w; } catch (e) {}
}

// параллельные турниры → события для новостей (Tier-2 и академии)
const seenParallel = new Set();
if (!seasonState.v29SeenPInit) { // при первом запуске не публикуем задним числом всё, что уже сыграно
  seasonState.v29SeenPInit = true; seasonState.v29SeenP = {};
  (seasonState.parallelSchedule || []).forEach(ev => { if (ev.status === 'completed') seasonState.v29SeenP[ev.id] = 1; });
}
setInterval(() => {
  try {
    (seasonState.parallelSchedule || []).forEach(ev => {
      if (ev.status !== 'completed' || !ev.winner || seenParallel.has(ev.id)) return;
      seenParallel.add(ev.id);
      if (seasonState.v29SeenP?.[ev.id]) return;
      seasonState.v29SeenP = seasonState.v29SeenP || {}; seasonState.v29SeenP[ev.id] = 1;
      const keys = Object.keys(seasonState.v29SeenP); if (keys.length > 160) keys.slice(0, keys.length - 160).forEach(k => delete seasonState.v29SeenP[k]);
      if (ev.tier === '3' && ev.kind !== 'academy') return;
      emit('parallel', { name: ev.name, id: 'P-' + ev.id, kind: ev.kind, tier: ev.tier, winner: ev.winner, second: ev.placements?.[1] || null, season: ev.season, at: ev.completedAt || calNow() });
    });
  } catch (e) {}
}, 2500);

// инструмент проверки баланса из консоли
window.v29Odds = (a, b) => ({ series: seriesP(a, b), map: mapLevel(a, b), round: roundFromMap(mapLevel(a, b)), sA: strength(a), sB: strength(b) });
console.info('[v29] ядро загружено: стабильность, баланс, сезон, трансферные окна');
})();
