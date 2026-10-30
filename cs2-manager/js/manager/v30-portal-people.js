(() => {
'use strict';
/* =====================================================================
   v30 · Люди и команды в портале
   • История рейтинга: снимки мирового рейтинга (после каждого Tier-1 и раз в игровую неделю)
     в seasonState.v30Rank — отсюда движение за неделю, за сезон и графики позиций.
   • Рейтинг (#/ranking): команды · игроки (Rating 2.0) · история.
   • Игроки (#/players), Команды (#/teams), страница команды (8 вкладок), карьера игрока.
   • Трансферы (#/transfers), Награды: кабинет трофеев, победители Major, зал славы; Архив сезонов.
   Все данные — из teams, архива сеток, transferState, V29News, TW. В HTML ничего не дублируется.
   ===================================================================== */
const H = window.HS; if (!H) return;
const { esc, logo, trophy, KIND, box, empty, fdate, f1, f2, ratingCls, pFlag, flag } = H;
const DAY = 864e5;
const ST = () => (typeof seasonState !== 'undefined' && seasonState) || {};
const TS = () => (typeof transferState !== 'undefined' && transferState) || {};
const proTeams = () => H.ranked().filter(t => !t.isAcademy);

/* ------------------------------------------------------------ история рейтинга */
function rankStore() { const st = ST(); if (!st.v30Rank || !Array.isArray(st.v30Rank.snaps)) st.v30Rank = { snaps: [] }; return st.v30Rank; }
function takeRankSnap(reason) {
  const st = ST(); if (!st.currentSeason) return;
  const r = H.ranked(), now = H.nowMs(), S = rankStore();
  const snap = { ts: now, s: st.currentSeason, why: reason || 'week', n: r.map(t => t.name), p: r.map(t => Math.round(t.pts || 0)) };
  const last = S.snaps[S.snaps.length - 1];
  if (last && last.n.join('|') === snap.n.join('|') && last.p.join('|') === snap.p.join('|')) { last.ts = now; return; }
  S.snaps.push(snap);
  // хранение: последние 60 снимков + по одному на конец каждого прошлого сезона
  if (S.snaps.length > 60) {
    const keep = new Set(), bySeason = {}; S.snaps.forEach((x, i) => { bySeason[x.s] = i; });
    Object.values(bySeason).forEach(i => keep.add(i)); S.snaps.slice(-60).forEach(x => keep.add(S.snaps.indexOf(x)));
    S.snaps = S.snaps.filter((x, i) => keep.has(i));
  }
  try { saveSeasonState(); } catch (e) {}
}
function rankAt(name, snap) { const i = snap ? snap.n.indexOf(name) : -1; return i < 0 ? null : i + 1; }
function snapBefore(ms) { const S = rankStore().snaps; for (let i = S.length - 1; i >= 0; i--) if (S[i].ts <= ms) return S[i]; return null; }
// движение за неделю: позиция сейчас против снимка неделю назад (или предыдущего снимка)
function rankMove(name) {
  const r = H.ranked(), cur = r.findIndex(t => t.name === name) + 1; if (!cur) return 0;
  const prev = snapBefore(H.nowMs() - 7 * DAY) || rankStore().snaps[rankStore().snaps.length - 2];
  const was = rankAt(name, prev); return was ? was - cur : 0;
}
function seasonMove(name) { const t = H.teamBy(name), cur = H.ranked().indexOf(t) + 1; return t && Number(t.seasonStartRank) ? t.seasonStartRank - cur : 0; }
H.rankMove = rankMove; H.seasonMove = seasonMove; H.rankStore = rankStore;
(() => { const f = window.finalizeTournamentRating; if (typeof f !== 'function' || f.__v30) return;
  const w = function () { const r = f.apply(this, arguments); try { takeRankSnap('event'); } catch (e) {} return r; }; w.__v30 = true; window.finalizeTournamentRating = w; try { finalizeTournamentRating = w; } catch (e) {} })();
setInterval(() => { try { const S = rankStore().snaps, last = S[S.length - 1]; if (!last || H.nowMs() - last.ts >= 7 * DAY || H.nowMs() < last.ts) takeRankSnap('week'); } catch (e) {} }, 3000);
setTimeout(() => { try { if (!rankStore().snaps.length) takeRankSnap('init'); } catch (e) {} }, 1500);

function rankChart(name) { // позиция команды по снимкам (лучше — выше)
  const S = rankStore().snaps.filter(x => x.n.includes(name)).slice(-40); if (S.length < 2) return empty('История рейтинга появится через пару игровых недель');
  const W = 640, Hh = 170, pl = 30, pr = 10, pt = 10, pb = 22, vals = S.map(x => rankAt(name, x)), lo = 1, hi = Math.max(10, ...vals) + 1;
  const X = i => pl + i * (W - pl - pr) / (S.length - 1), Y = v => pt + (v - lo) / (hi - lo) * (Hh - pt - pb);
  const path = vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const grid = [1, 5, 10, 20, 30].filter(v => v < hi).map(v => `<line class="cg" x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="cy" x="${pl - 6}" y="${(Y(v) + 3).toFixed(1)}">#${v}</text>`).join('');
  const seasons = []; S.forEach((x, i) => { if (!i || S[i - 1].s !== x.s) seasons.push(`<text class="cy" x="${X(i).toFixed(1)}" y="${Hh - 4}" text-anchor="start">С${x.s}</text>`); });
  return `<svg class="hs-chart" viewBox="0 0 ${W} ${Hh}">${grid}${seasons.join('')}<path class="cline" d="${path}"/>${vals.map((v, i) => `<circle class="cdot up" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" data-tip="#${v} · ${S[i].p[S[i].n.indexOf(name)]} очков · ${fdate(S[i].ts)}"/>`).join('')}</svg>`;
}
H.rankChart = rankChart;

/* ------------------------------------------------------------ журнал переходов (единый) */
// transferState.v30Moves пишет рынок v30; старые сделки берём из новостей v29 (у них нет типа)
function moves() {
  const own = (TS().v30Moves || []).slice();
  const seen = new Set(own.map(m => m.player + '|' + m.to + '|' + m.season));
  (window.V29News?.transfers() || []).forEach(x => { const k = x.player + '|' + x.team + '|' + x.season; if (seen.has(k)) return; seen.add(k);
    own.push({ id: 'n-' + x.id, ts: x.ts, season: x.season, type: 'transfer', player: x.player, from: x.from, to: x.team, reason: (x.lead || '').replace(/^.*Причина:\s*/, '').replace(/\.$/, ''), news: x.id }); });
  return own.sort((a, b) => ((b.season || 0) - (a.season || 0)) || (b.ts - a.ts));
}
H.moves = moves;
const MT = { transfer: 'Трансфер', signing: 'Подписание', release: 'Уход в свободные агенты', bench: 'На скамейку', loan: 'Аренда', 'loan-return': 'Возврат из аренды', promotion: 'Повышение из академии',
  standin: 'Стенд-ин', retire: 'Завершение карьеры', coach: 'Смена тренера', extension: 'Продление контракта', buyout: 'Выкуп контракта' };
H.MT = MT;
function moveRow(m) {
  const who = m.type === 'coach' ? `<b>${esc(m.player)}</b> <small>тренер</small>` : `<button type="button" data-player="${esc(m.player)}"><b>${esc(m.player)}</b></button>${m.role ? ` <small>${esc(m.role)}</small>` : ''}`;
  const tm = n => !n ? '<span class="hs-dim">—</span>' : /^(FA|Free Agent|Свободный агент|Скамейка|Академия)/i.test(n) || !H.teamBy(n) ? `<span class="hs-dim">${esc(n)}</span>` : `<button type="button" data-team="${esc(n)}">${logo(n, 'xs')} ${esc(n)}</button>`;
  return `<tr${m.news ? ` data-art="${esc(m.news)}"` : ''}><td class="l nowrap">${m.ts > 0 ? fdate(m.ts) + (m.season && m.season !== ST().currentSeason ? ' ' + new Date(m.ts).getFullYear() : '') : '—'}</td><td class="l"><span class="mv-t mv-${esc(m.type)}">${esc(MT[m.type] || m.type)}</span></td><td class="l">${who}</td><td class="l">${tm(m.from)}</td><td class="hs-dim">→</td><td class="l">${tm(m.to)}</td><td class="l hs-dim mv-why">${esc(m.reason || '')}</td></tr>`;
}
const movesTable = list => `<table class="hs-tbl hs-stbl mv-tbl"><thead><tr><th class="l">Дата</th><th class="l">Тип</th><th class="l">Кто</th><th class="l">Откуда</th><th></th><th class="l">Куда</th><th class="l">Причина</th></tr></thead><tbody>${list.map(moveRow).join('')}</tbody></table>`;
H.movesTable = movesTable;

/* ------------------------------------------------------------ рейтинг */
H.S.rk = { tab: 'teams', season: 'cur', min: 0, page: 1, academy: false };
H.PAGES.ranking = () => {
  const f = H.S.rk, tabs = [['teams', 'Команды'], ['players', 'Игроки'], ['history', 'История']].map(([k, l]) => `<button type="button" class="hs-chip${f.tab === k ? ' on' : ''}" data-rktab="${k}">${l}</button>`).join('');
  const S = rankStore().snaps, last = S[S.length - 1], cur = ST().currentSeason;
  let body = '';
  if (f.tab === 'teams') {
    const r = H.ranked().filter(t => f.academy || !t.isAcademy), max = Math.max(1, ...r.map(t => t.pts || 0)), st = H.stats();
    body = `<div class="hs-filters" style="margin-bottom:12px"><label class="pt-check"><input type="checkbox" data-rkac${f.academy ? ' checked' : ''}> показать академии</label><span class="hs-sub">Обновлено ${last ? fdate(last.ts) : '—'} · версия: очки рейтинга игры (результаты турниров с весом уровня)</span></div>
    <section class="hs-box"><table class="hs-tbl rk-tbl"><thead><tr><th>#</th><th>Нед.</th><th class="l">Команда</th><th class="l">Состав</th><th>Очки</th><th>Престиж</th><th>Сезон</th><th class="l">Форма</th><th class="l">Последний титул</th></tr></thead><tbody>${r.map((t, i) => {
      H.ensure(t); const w = rankMove(t.name), s = seasonMove(t.name), T = st.T[t.name], last1 = (t.history || []).find(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward);
      return `<tr data-team="${esc(t.name)}" class="${i < 3 ? 'top' : ''}"><td class="n"><b>${i + 1}</b></td><td class="${w > 0 ? 'up' : w < 0 ? 'dn' : 'hs-dim'}">${w > 0 ? '▲' + w : w < 0 ? '▼' + (-w) : '–'}</td>
        <td class="l">${logo(t.name, 'md')}<b class="rk-n">${esc(t.name)}</b></td><td class="l rk-ros">${(t.players || []).slice(0, 5).map(p => `<button type="button" data-player="${esc(p.nick)}">${pFlag(p)} ${esc(p.nick)}</button>`).join('')}</td>
        <td><b>${Math.round(t.pts || 0)}</b><span class="hs-bar"><i style="width:${((t.pts || 0) / max * 100).toFixed(0)}%"></i></span></td><td>${window.V33Prestige ? V33Prestige.starsHtml(V33Prestige.prestige(t.name)) : ''}</td><td class="${s > 0 ? 'up' : s < 0 ? 'dn' : 'hs-dim'}">${s > 0 ? '▲' + s : s < 0 ? '▼' + (-s) : '–'}</td>
        <td class="l"><span class="hs-form">${(T?.form || []).slice(0, 5).map(x => `<i class="${x}">${x}</i>`).join('')}</span></td><td class="l hs-dim">${last1 ? esc(last1.tournament) : '—'}</td></tr>`; }).join('')}</tbody></table></section>`;
  } else if (f.tab === 'players') {
    const st = H.stats(), seasons = [...new Set(st.ms.map(m => m.season))].sort((a, b) => b - a), sv = f.season === 'cur' ? cur : f.season;
    let rows = Object.values(st.P).map(o => ({ o, l: sv === 'all' ? H.line(o.all) : (o.bySeason[sv] ? H.line(o.bySeason[sv]) : null) })).filter(x => x.l);
    const maxMaps = rows.reduce((m, x) => Math.max(m, x.l.maps), 0), min = f.min || Math.max(3, Math.round(maxMaps * .3));
    rows = rows.filter(x => x.l.maps >= min).sort((a, b) => b.l.rating - a.l.rating);
    const pg = H.paginate(rows, 'rk', 50), off = (H.S.rk.page - 1) * 50;
    body = `<div class="hs-filters" style="margin-bottom:12px"><select class="hs-inp sm" data-rkf="season"><option value="cur"${f.season === 'cur' ? ' selected' : ''}>Текущий сезон</option><option value="all"${f.season === 'all' ? ' selected' : ''}>Вся карьера</option>${seasons.map(s => `<option value="${s}"${String(f.season) === String(s) ? ' selected' : ''}>Сезон ${s}</option>`).join('')}</select>
      <select class="hs-inp sm" data-rkf="min">${[0, 10, 20, 40, 80].map(v => `<option value="${v}"${f.min === v ? ' selected' : ''}>${v ? 'мин. ' + v + ' карт' : 'мин. авто (' + Math.max(3, Math.round(maxMaps * .3)) + ')'}</option>`).join('')}</select><span class="hs-sub">Выборка: ${rows.length} игроков · минимум ${min} карт</span></div>
      <section class="hs-box" data-pg-anchor><table class="hs-tbl hs-stbl"><thead><tr><th>#</th><th class="l">Игрок</th><th class="l">Команда</th><th>Карт</th><th>K/D</th><th>ADR</th><th>KAST</th><th>Импакт</th><th>Rating 2.0</th></tr></thead><tbody>${pg.rows.map((x, i) => `<tr data-player="${esc(x.o.nick)}"><td class="n">${off + i + 1}</td><td class="l">${pFlag(x.o.p)} <b>${esc(x.o.nick)}</b></td><td class="l">${logo(x.o.team, 'xs')} ${esc(x.o.team)}</td><td>${x.l.maps}</td><td>${f2(x.l.kd)}</td><td>${f1(x.l.adr)}</td><td>${f1(x.l.kast)}%</td><td>${f2(x.l.impact)}</td><td><b class="hs-rt ${ratingCls(x.l.rating)}">${f2(x.l.rating)}</b></td></tr>`).join('')}</tbody></table>${pg.html}</section>
      ${simRatingNote()}`;
  } else {
    const snaps = S.slice(-12).reverse(), names = proTeams().slice(0, 20).map(t => t.name);
    body = snaps.length ? `<section class="hs-box"><div class="pt-scroll x"><table class="hs-tbl rk-hist"><thead><tr><th class="l">Команда</th>${snaps.map(x => `<th>${fdate(x.ts)}<small>С${x.s}</small></th>`).join('')}</tr></thead><tbody>${names.map(n => `<tr data-team="${esc(n)}"><td class="l">${logo(n, 'xs')} <b>${esc(n)}</b></td>${snaps.map(x => { const r = rankAt(n, x); return `<td>${r || '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></section>
      <p class="hs-note">Снимки: после каждого турнира Tier-1 и раз в игровую неделю. Хранятся последние 60 и итог каждого сезона.</p>` : empty('История рейтинга появится через игровую неделю');
  }
  return `<div class="hs-head"><h1>Рейтинг</h1><div class="hs-filters">${tabs}</div></div>${body}`;
};
function simRatingNote() {
  return `<p class="hs-note"><b>Rating 2.0</b> — внутренняя метрика CS2 Manager, не HLTV Rating 2.0. Для каждой сыгранной карты из архива строится строка игрока: убийства/смерти/ассисты из счёта карты, уровня игрока (огневая мощь, клатч, утилити), роли и силы соперника; затем
    Rating 2.0 = 0.0073·KAST + 0.3591·KPR − 0.5329·DPR + 0.2372·Impact + 0.0032·ADR + 0.1587 (Impact = 2.13·KPR + 0.42·APR − 0.41). Одна и та же карта всегда даёт одинаковые цифры. Средние взвешены по раундам.</p>`;
}
H.simRatingNote = simRatingNote;
H.CLICKS.push(['[data-rktab]', el => { H.S.rk.tab = el.dataset.rktab; H.S.rk.page = 1; H.render(); }]);
document.addEventListener('change', e => {
  const el = e.target.closest?.('#hs-root [data-rkf]'); if (el) { H.S.rk[el.dataset.rkf] = el.dataset.rkf === 'min' ? +el.value : el.value; H.S.rk.page = 1; H.render(); }
  if (e.target.matches?.('#hs-root [data-rkac]')) { H.S.rk.academy = e.target.checked; H.render(); }
});

/* ------------------------------------------------------------ игроки */
H.S.pl = { tab: 'active', q: '', sort: 'rating', page: 1 };
function careerOf(nick) { // команды игрока по архиву составов + журнал переходов
  const arch = H.archive(), stints = [];
  Object.values(arch).filter(s => s && s.rost).sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach(s => {
    const team = Object.keys(s.rost).find(t => (s.rost[t] || []).some(p => p.nick === nick)); if (!team) return;
    const last = stints[stints.length - 1];
    if (last && last.team === team) { last.to = s.season; last.events++; last.lastEv = s.name; if (s.champion === team) last.titles++; }
    else stints.push({ team, from: s.season, to: s.season, events: 1, firstEv: s.name, lastEv: s.name, titles: s.champion === team ? 1 : 0 });
  });
  const now = H.playerNow(nick);
  if (now && (!stints.length || stints[stints.length - 1].team !== now.t.name)) stints.push({ team: now.t.name, from: ST().currentSeason, to: ST().currentSeason, events: 0, titles: 0, current: true });
  else if (now && stints.length) stints[stints.length - 1].current = true;
  return stints;
}
H.careerOf = careerOf;
function allPlayers() {
  const out = [], st = H.stats();
  H.TEAMS().forEach(t => { H.ensure(t); (t.players || []).forEach(p => { const o = st.P[p.nick]; out.push({ p, t, l: o ? H.line(o.all) : null, maps: o ? o.all.maps : 0 }); }); });
  return out;
}
const pow = p => (+p.firepower || 0) * .4 + (+p.tacticalIQ || 0) * .25 + (+p.clutch || 0) * .2 + (+p.utility || 0) * .15;
H.PAGES.players = () => {
  const f = H.S.pl, A = H.awards(), st = H.stats();
  const tabs = [['active', 'Активные'], ['fa', 'Свободные агенты'], ['bench', 'Скамейка'], ['young', 'Молодые таланты'], ['top20', 'Top 20'], ['mvp', 'MVP'], ['hof', 'Hall of Fame'], ['retired', 'Завершили карьеру']]
    .map(([k, l]) => `<button type="button" class="hs-chip${f.tab === k ? ' on' : ''}" data-pltab="${k}">${l}</button>`).join('');
  const q = f.q.trim().toLowerCase();
  const pRow = (x, i, extra) => `<tr data-player="${esc(x.p.nick)}"><td class="n">${i}</td><td class="l">${pFlag(x.p)} <b>${esc(x.p.nick)}</b>${x.p.realName ? `<small>${esc(x.p.realName)}</small>` : ''}</td>
    <td class="l">${x.t ? `${logo(x.t.name, 'xs')} ${esc(x.t.name)}` : `<span class="hs-dim">${esc(x.where || '—')}</span>`}</td><td class="l">${esc(x.p.role || '—')}</td><td>${x.p.age || '—'}</td><td>${Math.round(pow(x.p))}</td>
    <td>${x.maps || '—'}</td><td>${x.l && x.maps >= 3 ? `<b class="hs-rt ${ratingCls(x.l.rating)}">${f2(x.l.rating)}</b>` : '<span class="hs-dim">—</span>'}</td>${extra || ''}</tr>`;
  const head = extra => `<thead><tr><th>#</th><th class="l">Игрок</th><th class="l">Команда</th><th class="l">Роль</th><th>Возраст</th><th>Уровень</th><th>Карт</th><th>Rating 2.0</th>${extra || ''}</tr></thead>`;
  let rows = [], extraH = '', listHtml = '';
  if (f.tab === 'active' || f.tab === 'young') {
    rows = allPlayers().filter(x => !x.t.isAcademy || f.tab === 'young');
    if (f.tab === 'young') rows = rows.filter(x => (+x.p.age || 30) <= 21).sort((a, b) => pow(b.p) - pow(a.p));
    else rows.sort((a, b) => f.sort === 'level' ? pow(b.p) - pow(a.p) : ((b.maps >= 3 ? b.l?.rating : 0) || 0) - ((a.maps >= 3 ? a.l?.rating : 0) || 0));
  } else if (f.tab === 'fa' || f.tab === 'bench') {
    rows = (TS().freeAgents || []).filter(p => f.tab === 'bench' ? (p.status === 'BENCH' || p.reservedFor) : !(p.status === 'BENCH' || p.reservedFor)).map(p => { const o = st.P[p.nick]; return { p, t: null, where: p.reservedFor ? 'скамейка ' + p.reservedFor : p.status === 'BENCH' ? 'скамейка' : 'свободный агент', l: o ? H.line(o.all) : null, maps: o ? o.all.maps : 0 }; }).sort((a, b) => pow(b.p) - pow(a.p));
  } else if (f.tab === 'top20') {
    const years = {}; Object.entries(A).forEach(([nick, r]) => (r.top || []).forEach(x => (years[x.y] = years[x.y] || []).push({ nick, r: x.r, team: x.team })));
    const ys = Object.keys(years).sort((a, b) => b - a);
    listHtml = ys.length ? ys.slice(0, 3).map(y => box(`Top 20 игроков ${y} года`, `<div class="hs-t20grid">${years[y].sort((a, b) => a.r - b.r).map(x => `<button type="button" class="hs-top20" data-player="${esc(x.nick)}"><span class="hs-t20img">${window.TW ? window.TW.top20Svg(x.r) : '#' + x.r}</span><b>${esc(x.nick)}</b><small>${esc(x.team || '')}</small></button>`).join('')}</div>`)).join('') : empty('Top 20 составляется по итогам каждого сезона');
  } else if (f.tab === 'mvp') {
    const list = Object.entries(A).map(([nick, r]) => ({ nick, n: (r.mvp || []).length, maj: (r.mvp || []).filter(x => x.k === 'major').length, last: (r.mvp || [])[0] })).filter(x => x.n).sort((a, b) => b.n - a.n || b.maj - a.maj);
    listHtml = box('MVP турниров', list.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th>#</th><th class="l">Игрок</th><th>MVP</th><th>из них Major</th><th class="l">Последний</th></tr></thead><tbody>${list.map((x, i) => `<tr data-player="${esc(x.nick)}"><td class="n">${i + 1}</td><td class="l"><b>${esc(x.nick)}</b></td><td><b>${x.n}</b></td><td>${x.maj}</td><td class="l hs-dim">${esc(x.last?.n || '')} · ${x.last?.y || ''}</td></tr>`).join('')}</tbody></table>` : empty('MVP вручается лучшему игроку чемпиона турнира'), '', 'flush');
  } else if (f.tab === 'hof') {
    const list = hallOfFame();
    listHtml = box('Hall of Fame', list.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th>Major</th><th>Титулы</th><th>MVP</th><th>Top 20</th><th>Лучшее место</th><th class="l">Статус</th></tr></thead><tbody>${list.map(x => `<tr data-player="${esc(x.nick)}"><td class="l"><b>${esc(x.nick)}</b></td><td>${x.maj}</td><td>${x.ti}</td><td>${x.mvp}</td><td>${x.top}</td><td>${x.best ? '#' + x.best : '—'}</td><td class="l hs-dim">${x.active ? 'играет' : 'завершил'}</td></tr>`).join('')}</tbody></table>` : empty('Зал славы: 2+ Major, или 3+ попадания в Top 20, или 5+ MVP'), '', 'flush')
      + '<p class="hs-note">Критерии зала славы: два и более Major, три и более попадания в Top 20 года или пять и более MVP турниров.</p>';
  } else if (f.tab === 'retired') {
    const list = moves().filter(m => m.type === 'retire');
    const fromNews = (window.V29News?.all() || []).filter(n => n.cat === 'player' && /завершает карьеру/.test(n.title) && n.player && !list.some(m => m.player === n.player)).map(n => ({ type: 'retire', player: n.player, from: n.team, ts: n.ts, reason: n.lead }));
    const all = list.concat(fromNews).sort((a, b) => b.ts - a.ts);
    listHtml = box('Завершили карьеру', all.length ? movesTable(all) : empty('Ветераны уходят после 31 года — чаще всего в межсезонье'), '', 'flush');
  }
  if (q && rows.length) rows = rows.filter(x => (x.p.nick + ' ' + (x.p.realName || '') + ' ' + (x.t?.name || '')).toLowerCase().includes(q));
  const pg = rows.length ? H.paginate(rows, 'pl', 50) : null, off = ((H.S.pl.page || 1) - 1) * 50;
  const tools = `<div class="hs-filters" style="margin-bottom:12px"><input type="search" class="hs-inp" id="pt-plq" placeholder="Ник, имя или команда" value="${esc(f.q)}">${f.tab === 'active' ? `<select class="hs-inp sm" data-plsort><option value="rating"${f.sort === 'rating' ? ' selected' : ''}>по Rating 2.0</option><option value="level"${f.sort === 'level' ? ' selected' : ''}>по уровню игрока</option></select>` : ''}<span class="hs-sub">${rows.length ? rows.length + ' игроков' : ''}</span></div>`;
  const table = pg ? `<section class="hs-box" data-pg-anchor><table class="hs-tbl hs-stbl">${head(extraH)}<tbody>${pg.rows.map((x, i) => pRow(x, off + i + 1)).join('')}</tbody></table>${pg.html}</section><p class="hs-note">Уровень — сводная оценка навыков игрока в игре (огневая мощь, тактика, клатч, утилити). Rating 2.0 — по сыгранным картам, от 3 карт.</p>` : '';
  return `<div class="hs-head"><h1>Игроки</h1></div><div class="hs-filters hs-ptabs-row">${tabs}</div>${rows.length || ['active', 'young', 'fa', 'bench'].includes(f.tab) ? tools : ''}${table || listHtml || empty('Пусто')}`;
};
function hallOfFame() {
  const A = H.awards();
  return Object.entries(A).map(([nick, r]) => ({ nick, maj: (r.ti || []).filter(x => x.k === 'major').length, ti: (r.ti || []).length, mvp: (r.mvp || []).length, top: (r.top || []).length, best: (r.top || []).length ? Math.min(...r.top.map(x => x.r)) : 0, active: !!H.playerNow(nick) }))
    .filter(x => x.maj >= 2 || x.top >= 3 || x.mvp >= 5).sort((a, b) => b.maj - a.maj || b.top - a.top || b.mvp - a.mvp);
}
H.hallOfFame = hallOfFame;
H.CLICKS.push(['[data-pltab]', el => { H.S.pl.tab = el.dataset.pltab; H.S.pl.page = 1; H.render(); }]);
document.addEventListener('change', e => { if (e.target.matches?.('#hs-root [data-plsort]')) { H.S.pl.sort = e.target.value; H.render(); } });
let plT = null;
document.addEventListener('input', e => { if (e.target.id !== 'pt-plq') return; clearTimeout(plT); const v = e.target.value; plT = setTimeout(() => { H.S.pl.q = v; H.S.pl.page = 1; H.render(); const i = document.getElementById('pt-plq'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); });

/* ---------- карьера и трансферы в профиле игрока ---------- */
const origPlayer = H.PAGES.player;
H.PAGES.player = nick => {
  if (H.S.ptab === 'career') {
    const html = origPlayer(nick).replace(/<div class="hs-ptab-body">[\s\S]*$/, '');
    return html.replace(/class="hs-ptab on"/g, 'class="hs-ptab"').replace('data-ptab="career"', 'data-ptab="career" aria-selected="true"').replace('class="hs-ptab" data-ptab="career"', 'class="hs-ptab on" data-ptab="career"') + `<div class="hs-ptab-body">${careerTab(nick)}</div>`;
  }
  return origPlayer(nick);
};
function careerTab(nick) {
  const c = careerOf(nick), mv = moves().filter(m => m.player === nick), st = H.stats(), o = st.P[nick];
  const perTeam = {}; (o?.matches || []).forEach(m => { const z = perTeam[m.team] || (perTeam[m.team] = H.Z0()); Object.keys(z).forEach(k => { z[k] += m.z[k]; }); });
  const rows = c.slice().reverse().map(s => { const l = perTeam[s.team] ? H.line(perTeam[s.team]) : null;
    return `<tr data-team="${esc(s.team)}"><td class="l">${s.from === s.to ? 'Сезон ' + s.from : `Сезоны ${s.from}–${s.to}`}</td><td class="l">${logo(s.team, 'sm')} <b>${esc(s.team)}</b>${s.current ? ' <span class="hs-kind k-regular">сейчас</span>' : ''}</td><td>${s.events}</td><td>${s.titles}</td><td>${l ? l.maps : '—'}</td><td>${l ? `<b class="${ratingCls(l.rating)}">${f2(l.rating)}</b>` : '—'}</td></tr>`; }).join('');
  return box('История команд', rows ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Период</th><th class="l">Команда</th><th>Турниров</th><th>Титулов</th><th>Карт</th><th>Rating 2.0</th></tr></thead><tbody>${rows}</tbody></table>` : empty('Нет данных о командах'), '', 'flush')
    + '<p class="hs-note">История строится по составам, записанным на момент каждого турнира: переход игрока не переносит его прошлую статистику в новую команду.</p>'
    + box('Переходы', mv.length ? movesTable(mv) : empty('Переходов не было'), '', 'flush');
}

/* ------------------------------------------------------------ команды */
H.S.tm = { region: 'all', academy: false, q: '' };
H.PAGES.teams = () => {
  const f = H.S.tm, st = H.stats(), q = f.q.trim().toLowerCase();
  let list = H.ranked().filter(t => f.academy ? t.isAcademy : !t.isAcademy);
  if (q) list = list.filter(t => (t.name + ' ' + (t.players || []).map(p => p.nick).join(' ')).toLowerCase().includes(q));
  const rows = list.map(t => { H.ensure(t); const rk = H.ranked().indexOf(t) + 1, T = st.T[t.name], titles = (t.history || []).filter(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward).length, ages = (t.players || []).map(p => +p.age).filter(Boolean);
    return `<tr data-team="${esc(t.name)}"><td class="n">${rk}</td><td class="l">${logo(t.name, 'md')}<b class="rk-n">${esc(t.name)}</b></td><td class="l">${esc(typeof getTeamFlag === 'function' ? getTeamFlag(t.name) : '')}</td><td>${Math.round(t.pts)}</td>
      <td class="l rk-ros">${(t.players || []).slice(0, 5).map(p => `<button type="button" data-player="${esc(p.nick)}">${esc(p.nick)}</button>`).join('')}</td><td class="l hs-dim">${esc(t.coach?.name || '—')}</td><td>${ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—'}</td><td>${titles}</td>
      <td class="l"><span class="hs-form">${(T?.form || []).slice(0, 5).map(x => `<i class="${x}">${x}</i>`).join('')}</span></td></tr>`; }).join('');
  return `<div class="hs-head"><h1>Команды</h1><div class="hs-filters"><button type="button" class="hs-chip${!f.academy ? ' on' : ''}" data-tmac="0">Профессиональные</button><button type="button" class="hs-chip${f.academy ? ' on' : ''}" data-tmac="1">Академии</button><input type="search" class="hs-inp" id="pt-tmq" placeholder="Команда или игрок" value="${esc(f.q)}"></div></div>
    <section class="hs-box"><table class="hs-tbl hs-stbl rk-tbl"><thead><tr><th>#</th><th class="l">Команда</th><th class="l">Регион</th><th>Очки</th><th class="l">Состав</th><th class="l">Тренер</th><th>Ср. возраст</th><th>Титулы</th><th class="l">Форма</th></tr></thead><tbody>${rows}</tbody></table></section>`;
};
H.CLICKS.push(['[data-tmac]', el => { H.S.tm.academy = el.dataset.tmac === '1'; H.render(); }]);
let tmT = null;
document.addEventListener('input', e => { if (e.target.id !== 'pt-tmq') return; clearTimeout(tmT); const v = e.target.value; tmT = setTimeout(() => { H.S.tm.q = v; H.render(); const i = document.getElementById('pt-tmq'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); });

/* ---------- страница команды ---------- */
const TTABS = [['overview', 'Обзор'], ['roster', 'Состав'], ['matches', 'Матчи'], ['maps', 'Карты'], ['stats', 'Статистика'], ['transfers', 'Трансферы'], ['achievements', 'Достижения'], ['history', 'История']];
function rosterHistory(name) { // составы по архиву: каждое изменение — новая строка
  const arch = H.archive(), out = [];
  Object.values(arch).filter(s => s && s.rost && s.rost[name]).sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach(s => {
    const ros = s.rost[name].map(p => p.nick), key = ros.slice().sort().join(','), last = out[out.length - 1];
    if (last && last.key === key) { last.to = s.season; last.events++; if (s.champion === name) last.titles++; return; }
    out.push({ key, ros, from: s.season, to: s.season, firstEv: s.name, events: 1, titles: s.champion === name ? 1 : 0, prev: last ? last.ros : null });
  });
  return out.reverse();
}
function teamPage(name) {
  const t = H.ensure(H.teamBy(name)); if (!t) return H.back() + empty('Команда не найдена. Возможно, она была удалена или переименована.');
  const st = H.stats(), T = st.T[name], rank = H.ranked().indexOf(t) + 1, tab = TTABS.some(x => x[0] === H.S.ttab) ? H.S.ttab : 'overview';
  const w = rankMove(name), s = seasonMove(name), ms = st.ms.filter(m => m.a === name || m.b === name);
  const wins = (t.history || []).filter(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward), majors = wins.filter(h => h.isMajor).length;
  const arch = H.archive(), kindOf = h => { const sn = h.archiveId ? arch[h.archiveId] : null; return sn?.prestige || (h.isMajor ? 'major' : h.isElite ? 'elite' : /Фонов/.test(h.placeTitle || '') ? 'tier2' : 'regular'); };
  const pcard = p => { const o = st.P[p.nick], L = o ? H.line(o.all) : null;
    return `<button type="button" class="tm-p" data-player="${esc(p.nick)}"><span class="ph">${H.photoHtml(p)}</span><span class="nm">${pFlag(p)} <b>${esc(p.nick)}</b></span><small>${esc(p.role || '')}${p.age ? ' · ' + p.age : ''}</small>${p.status && p.status !== 'STARTER' ? `<span class="tm-st">${esc(p.status)}</span>` : ''}<span class="rt ${L ? ratingCls(L.rating) : ''}">${L && L.maps >= 3 ? f2(L.rating) : '—'}</span></button>`; };
  const head = `${H.back()}<header class="tm-head">${logo(name, 'xl')}<div class="tm-id"><div class="tm-k">${esc(typeof getTeamFlag === 'function' ? getTeamFlag(name) : '')} ${t.isAcademy ? '<span class="hs-kind k-academy">Академия</span>' : ''}<span class="hs-dim">тренер ${esc(t.coach?.name || '—')}</span></div><h1>${esc(name)}</h1>
      <div class="pt-kpis in"><div><small>Мировой рейтинг</small><b>#${rank}</b></div><div><small>Очки</small><b>${Math.round(t.pts || 0)}</b></div><div><small>За неделю</small><b class="${w > 0 ? 'up' : w < 0 ? 'dn' : ''}">${w > 0 ? '▲ ' + w : w < 0 ? '▼ ' + (-w) : '—'}</b></div><div><small>За сезон</small><b class="${s > 0 ? 'up' : s < 0 ? 'dn' : ''}">${s > 0 ? '▲ ' + s : s < 0 ? '▼ ' + (-s) : '—'}</b></div><div><small>Титулы</small><b>${wins.length}${majors ? ` <span class="hs-gold">· ${majors} Major</span>` : ''}</b></div><div><small>Форма</small><b><span class="hs-form">${(T?.form || []).slice(0, 5).map(x => `<i class="${x}">${x}</i>`).join('') || '—'}</span></b></div></div></div></header>
    <div class="tm-roster">${(t.players || []).map(pcard).join('')}</div>
    <div class="hs-ptabs">${TTABS.map(([k, l]) => `<button type="button" class="hs-ptab${tab === k ? ' on' : ''}" data-ttab="${k}">${l}</button>`).join('')}</div>`;
  let body = '';
  const mapRows = T ? Object.entries(T.byMap).sort((a, b) => b[1].n - a[1].n) : [];
  if (tab === 'overview') {
    const tr = moves().filter(m => m.to === name || m.from === name).slice(0, 6);
    const trophies = wins.slice(0, 18).map(h => `<button type="button" class="hs-achi" data-tip="${esc(h.tournament)} · сезон ${h.season}"${h.archiveId ? ` data-event="${esc(h.archiveId)}"` : ''}>${trophy(h.tournament, h.season, kindOf(h))}${h.isMajor ? '<i class="st">★</i>' : ''}</button>`).join('');
    body = `<div class="hs-grid2"><div class="hs-col">${box('Позиция в рейтинге', rankChart(name))}
      ${box('Последние матчи', ms.slice(0, 8).map(m => H.matchRow(m, name)).join('') || empty('Матчей в архиве нет'), '<button type="button" class="hs-more" data-ttab="matches">все →</button>', 'flush')}</div>
      <div class="hs-col">${trophies ? box(`Трофеи · ${wins.length}`, `<div class="hs-achrow">${trophies}</div>`, '<button type="button" class="hs-more" data-ttab="achievements">все →</button>') : ''}
      ${box('Маппул', mapRows.slice(0, 7).map(([k, v]) => `<div class="hs-mprow" data-tip="${v.w}-${v.n - v.w} · раунды ${v.rw}:${v.rl}"><span class="n">${esc(k)}</span><span class="hs-bar big"><i style="width:${f1(v.w / v.n * 100)}%"></i></span><b>${f1(v.w / v.n * 100)}%</b><small>${v.n}</small></div>`).join('') || empty('Нет сыгранных карт'))}
      ${box('Последние трансферы', tr.length ? `<div class="tm-mv">${tr.map(m => `<div><span class="mv-t mv-${esc(m.type)}">${esc(MT[m.type] || m.type)}</span> <b>${esc(m.player)}</b> <span class="hs-dim">${m.to === name ? 'из ' + esc(m.from || '—') : 'в ' + esc(m.to || '—')} · ${m.ts > 0 ? fdate(m.ts) : ''}</span></div>`).join('')}</div>` : empty('Состав без изменений'), '<button type="button" class="hs-more" data-ttab="transfers">все →</button>')}
      ${box('Управление', `<p class="hs-note">Буткемп восстанавливает усталость и форму команды (игровое действие).</p><button type="button" class="hs-btn ghost" data-bootcamp="${esc(name)}">Отправить на буткемп</button>`)}</div></div>`;
  } else if (tab === 'roster') {
    const ps = Object.values(st.P).filter(o => o.matches.some(m => m.team === name)).map(o => { const z = H.Z0(); o.matches.filter(m => m.team === name).forEach(m => Object.keys(z).forEach(k => { z[k] += m.z[k]; })); return { o, l: H.line(z) }; });
    const cur = (t.players || []).map(p => { const x = ps.find(y => y.o.nick === p.nick); return `<tr data-player="${esc(p.nick)}"><td class="l">${pFlag(p)} <b>${esc(p.nick)}</b>${p.realName ? `<small>${esc(p.realName)}</small>` : ''}</td><td class="l">${esc(p.role || '')}</td><td>${p.age || '—'}</td><td>${Math.round(pow(p))}</td><td>${Math.round(+p.form || 100)}</td><td>${Math.round(+p.morale || 0)}</td><td>${x ? x.l.maps : 0}</td><td>${x && x.l.maps >= 3 ? `<b class="${ratingCls(x.l.rating)}">${f2(x.l.rating)}</b>` : '—'}</td><td class="l hs-dim">${esc(p.status || 'STARTER')}${p.contractUntil ? ' · контракт до сезона ' + p.contractUntil : ''}</td></tr>`; }).join('');
    const hist = rosterHistory(name).map(r => `<tr><td class="l">${r.from === r.to ? 'Сезон ' + r.from : `Сезоны ${r.from}–${r.to}`}</td><td class="l">${r.ros.map(n => `<button type="button" data-player="${esc(n)}" class="${r.prev && !r.prev.includes(n) ? 'tm-new' : ''}">${esc(n)}</button>`).join(' · ')}</td><td>${r.events}</td><td>${r.titles}</td></tr>`).join('');
    body = box('Текущий состав', `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th class="l">Роль</th><th>Возраст</th><th>Уровень</th><th>Форма</th><th>Мораль</th><th>Карт за команду</th><th>Rating 2.0</th><th class="l">Статус</th></tr></thead><tbody>${cur}</tbody></table>`, `<span class="hs-sub">Тренер: ${esc(t.coach?.name || '—')}</span>`, 'flush')
      + box('Архив составов', hist ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Период</th><th class="l">Состав (новички выделены)</th><th>Турниров</th><th>Титулов</th></tr></thead><tbody>${hist}</tbody></table>` : empty('Составы записываются при архивации каждого турнира'), '', 'flush');
  } else if (tab === 'matches') {
    const pg = H.paginate(ms, 'tmm', 40);
    body = box(`Матчи · ${T ? T.matchW + '–' + (T.matches - T.matchW) : '0–0'}`, pg.rows.map(m => H.matchRow(m, name)).join('') + pg.html || empty('Матчей нет'), '', 'flush');
  } else if (tab === 'maps') {
    body = box('Карты', mapRows.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Карта</th><th>Сыграно</th><th>W–L</th><th class="l">Винрейт</th><th>Раунды</th><th>Разница</th></tr></thead><tbody>${mapRows.map(([k, v]) => `<tr><td class="l"><b>${esc(k)}</b></td><td>${v.n}</td><td>${v.w}–${v.n - v.w}</td><td class="l"><span class="hs-bar"><i style="width:${f1(v.w / v.n * 100)}%"></i></span>${f1(v.w / v.n * 100)}%</td><td>${v.rw}:${v.rl}</td><td class="${v.rw - v.rl >= 0 ? 'up' : 'dn'}">${v.rw - v.rl > 0 ? '+' : ''}${v.rw - v.rl}</td></tr>`).join('')}</tbody></table>` : empty('Нет сыгранных карт'), '', 'flush');
  } else if (tab === 'stats') {
    const ps = Object.values(st.P).filter(o => o.matches.some(m => m.team === name)).map(o => { const z = H.Z0(); o.matches.filter(m => m.team === name).forEach(m => Object.keys(z).forEach(k => { z[k] += m.z[k]; })); return { o, l: H.line(z), cur: (t.players || []).some(p => p.nick === o.nick) }; }).sort((a, b) => b.l.maps - a.l.maps);
    const h2h = T ? Object.entries(T.h2h).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).slice(0, 15) : [];
    body = box('Игроки за команду', ps.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th>Карт</th><th>K–D</th><th>ADR</th><th>KAST</th><th>Rating 2.0</th></tr></thead><tbody>${ps.map(x => `<tr data-player="${esc(x.o.nick)}"><td class="l">${pFlag(x.o.p)} <b>${esc(x.o.nick)}</b>${x.cur ? '' : '<small>бывший</small>'}</td><td>${x.l.maps}</td><td class="${x.l.diff >= 0 ? 'up' : 'dn'}">${x.l.k}–${x.l.d}</td><td>${f1(x.l.adr)}</td><td>${f1(x.l.kast)}%</td><td><b class="${ratingCls(x.l.rating)}">${f2(x.l.rating)}</b></td></tr>`).join('')}</tbody></table>` : empty('Нет данных'), '', 'flush')
      + '<p class="hs-note">Статистика только за эту команду — у перешедших игроков их цифры остаются здесь.</p>'
      + box('Соперники', h2h.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Соперник</th><th>Матчей</th><th>W–L</th><th class="l">Винрейт</th></tr></thead><tbody>${h2h.map(([k, v]) => `<tr data-team="${esc(k)}"><td class="l">${logo(k, 'sm')} <b>${esc(k)}</b></td><td>${v.w + v.l}</td><td>${v.w}–${v.l}</td><td class="l"><span class="hs-bar"><i style="width:${f1(v.w / (v.w + v.l) * 100)}%"></i></span>${f1(v.w / (v.w + v.l) * 100)}%</td></tr>`).join('')}</tbody></table>` : empty('Нет матчей'), '', 'flush');
  } else if (tab === 'transfers') {
    const list = moves().filter(m => m.to === name || m.from === name);
    body = box('Трансферы', list.length ? movesTable(list) : empty('Переходов не было'), '', 'flush');
  } else if (tab === 'achievements') {
    const places = (t.history || []).filter(h => !h.isBootcamp && !h.isSeasonAward && h.place > 0);
    const cab = wins.map(h => `<button type="button" class="tc-item" ${h.archiveId ? `data-event="${esc(h.archiveId)}"` : ''}><span class="tc-tr">${trophy(h.tournament, h.season, kindOf(h))}</span><b>${esc(h.tournament)}</b><small>Сезон ${h.season} · <span class="hs-kind k-${kindOf(h)}">${KIND[kindOf(h)]}</span></small></button>`).join('');
    body = box(`Кабинет трофеев · ${wins.length}`, cab ? `<div class="tc-grid">${cab}</div>` : empty('Трофей появляется за 1-е место')) +
      box('Все выступления', `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Сезон</th><th class="l">Турнир</th><th>Место</th><th>Очки</th></tr></thead><tbody>${places.slice(0, 80).map(h => `<tr${h.archiveId ? ` data-event="${esc(h.archiveId)}"` : ''}><td class="l">${h.season}</td><td class="l"><span class="hs-kind k-${kindOf(h)}">${KIND[kindOf(h)]}</span> ${esc(h.tournament)}</td><td>${h.place === 1 ? '<b class="hs-gold">1</b>' : h.place}</td><td class="${h.delta > 0 ? 'up' : h.delta < 0 ? 'dn' : ''}">${h.delta ? (h.delta > 0 ? '+' : '') + Math.round(h.delta) : '—'}</td></tr>`).join('')}</tbody></table>`, '', 'flush');
  } else if (tab === 'history') {
    const bySeason = {}; (t.history || []).filter(h => !h.isBootcamp && !h.isSeasonAward && h.place > 0).forEach(h => { const o = bySeason[h.season] || (bySeason[h.season] = { n: 0, titles: 0, best: 99, majors: 0 }); o.n++; if (h.place === 1) o.titles++; if (h.isMajor && h.place === 1) o.majors++; o.best = Math.min(o.best, h.place); });
    const endRank = s => { const sn = rankStore().snaps.filter(x => x.s === +s).pop(); return sn ? rankAt(name, sn) : null; };
    const hof = (ST().hallOfFame || []).filter(h => h.champion === name);
    body = box('По сезонам', Object.keys(bySeason).length ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Сезон</th><th>Турниров</th><th>Титулов</th><th>Major</th><th>Лучшее место</th><th>Место в рейтинге в конце</th></tr></thead><tbody>${Object.entries(bySeason).sort((a, b) => b[0] - a[0]).map(([k, v]) => `<tr><td class="l">Сезон ${k} · ${H.yearOf(k)}</td><td>${v.n}</td><td>${v.titles}</td><td>${v.majors}</td><td>${v.best}</td><td>${endRank(k) ? '#' + endRank(k) : '—'}</td></tr>`).join('')}</tbody></table>` : empty('История пока пуста'), '', 'flush')
      + (hof.length ? box('Команда сезона', hof.map(h => `<div class="tm-hof">${window.TW ? window.TW.awardSvg('team', h.year || H.yearOf(h.season)) : ''}<b>Сезон ${h.season}</b><span class="hs-dim">${h.scorePts} очков</span></div>`).join('')) : '');
  }
  return head + `<div class="hs-ptab-body" data-pg-anchor>${body}</div>`;
}
H.PAGES.team = teamPage;
H.CLICKS.push(['[data-bootcamp]', el => { try { if (typeof window.runManualBootcamp === 'function') window.runManualBootcamp(el.dataset.bootcamp); } catch (e) { console.warn(e); } H.render(); }]);

/* ------------------------------------------------------------ трансферы */
H.S.trf = { tab: 'all', team: '', page: 1 };
H.PAGES.transfers = () => {
  const f = H.S.trf, all = moves();
  const TABS = [['all', 'Все сделки'], ['transfer', 'Трансферы'], ['signing', 'Подписания'], ['rumor', 'Слухи'], ['loan', 'Аренды'], ['standin', 'Стенд-ины'], ['promotion', 'Академия → основа'], ['coach', 'Тренеры'], ['release', 'Уходы и скамейка'], ['fa', 'Свободные агенты']];
  const cnt = k => k === 'rumor' ? (window.V29News?.all() || []).filter(n => n.cat === 'rumor').length : k === 'fa' ? (TS().freeAgents || []).length : k === 'all' ? all.length : all.filter(m => m.type === k || (k === 'loan' && m.type === 'loan-return') || (k === 'release' && ['release', 'bench'].includes(m.type))).length;
  const tabs = TABS.map(([k, l]) => `<button type="button" class="hs-chip${f.tab === k ? ' on' : ''}" data-trtab="${k}">${l} <small>${cnt(k)}</small></button>`).join('');
  const teamsList = [...new Set(all.flatMap(m => [m.from, m.to]).filter(n => n && H.teamBy(n)))].sort();
  const sel = `<select class="hs-inp sm" data-trteam><option value="">Все команды</option>${teamsList.map(t => `<option${f.team === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  let body;
  if (f.tab === 'rumor') {
    const list = (window.V29News?.all() || []).filter(n => n.cat === 'rumor' && (!f.team || n.team === f.team || n.from === f.team));
    body = box('Слухи и переговоры', list.map(n => H.newsLine(n)).join('') || empty('Слухов нет'), '', 'flush') + '<p class="hs-note">Слух остаётся слухом, пока сделка не состоится (подтверждено) или переговоры не сорвутся (опровергнуто).</p>';
  } else if (f.tab === 'fa') {
    const st = H.stats(), list = (TS().freeAgents || []).slice().sort((a, b) => pow(b) - pow(a));
    body = box('Свободные агенты и скамейка', `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th class="l">Статус</th><th class="l">Роль</th><th>Возраст</th><th>Уровень</th><th>Карт</th><th class="l">Последняя команда</th></tr></thead><tbody>${list.map(p => { const o = st.P[p.nick], lastT = careerOf(p.nick).slice(-1)[0]?.team;
      return `<tr data-player="${esc(p.nick)}"><td class="l">${pFlag(p)} <b>${esc(p.nick)}</b></td><td class="l">${p.reservedFor ? 'скамейка ' + esc(p.reservedFor) : p.status === 'BENCH' ? 'скамейка' : 'свободный агент'}</td><td class="l">${esc(p.role || '')}</td><td>${p.age || '—'}</td><td>${Math.round(pow(p))}</td><td>${o ? o.all.maps : 0}</td><td class="l hs-dim">${esc(lastT || '—')}</td></tr>`; }).join('')}</tbody></table>`, '', 'flush');
  } else {
    let list = all.filter(m => f.tab === 'all' || m.type === f.tab || (f.tab === 'loan' && m.type === 'loan-return') || (f.tab === 'release' && ['release', 'bench'].includes(m.type)));
    if (f.team) list = list.filter(m => m.from === f.team || m.to === f.team);
    const pg = H.paginate(list, 'trf', 40);
    body = `<section class="hs-box" data-pg-anchor>${list.length ? movesTable(pg.rows) + pg.html : empty('Сделок по этому фильтру нет')}</section>`;
  }
  const season = ST().currentSeason, thisSeason = all.filter(m => m.season === season && m.type !== 'coach').length;
  return `<div class="hs-head"><h1>Трансферы</h1><div class="hs-filters">${sel}<span class="hs-sub">В сезоне ${season}: ${thisSeason} перемещений игроков</span></div></div><div class="hs-filters hs-ptabs-row">${tabs}</div>${body}`;
};
H.CLICKS.push(['[data-trtab]', el => { H.S.trf.tab = el.dataset.trtab; H.S.trf.page = 1; H.render(); }]);
document.addEventListener('change', e => { if (e.target.matches?.('#hs-root [data-trteam]')) { H.S.trf.team = e.target.value; H.S.trf.page = 1; H.render(); } });

/* ------------------------------------------------------------ награды, трофеи, архив */
const origAwards = H.PAGES.awards;
H.S.aw = { tab: 'year' };
function champions() { return Object.values(H.archive()).filter(s => s && s.champion && s.champion !== '—'); }
H.PAGES.awards = () => {
  const f = H.S.aw, tabs = [['year', 'Награды года'], ['cabinet', 'Кабинет трофеев'], ['majors', 'Победители Major'], ['champs', 'Чемпионы по годам'], ['teams', 'Трофеи команд'], ['hof', 'Hall of Fame']]
    .map(([k, l]) => `<button type="button" class="hs-chip${f.tab === k ? ' on' : ''}" data-awtab="${k}">${l}</button>`).join('');
  let body = '';
  if (f.tab === 'year') return origAwards().replace('<div class="hs-head"><h1>Награды</h1><div class="hs-filters">', `<div class="hs-head"><h1>Награды</h1><div class="hs-filters">${tabs}</div></div><div class="hs-filters" style="margin-bottom:12px">`);
  const ch = champions().sort((a, b) => (b.season - a.season) || ((b.ge || b.ts || 0) - (a.ge || a.ts || 0)));
  if (f.tab === 'cabinet') {
    const series = {}; ch.filter(s => ['major', 'elite', 'regular'].includes(s.prestige)).forEach(s => { const k = window.TW ? window.TW.familyKey(s.name) : s.name; (series[k] = series[k] || []).push(s); });
    body = Object.entries(series).sort((a, b) => b[1].length - a[1].length).map(([k, list]) => `<section class="tc-series"><h3 class="hs-h3">${esc(list[0].name.replace(/\s*\b(19|20)\d\d\b/, ''))} <small class="hs-dim">${list.length} розыгр.</small></h3><div class="tc-grid">${list.map(s => `<button type="button" class="tc-item" data-event="${esc(s.id)}"><span class="tc-tr">${trophy(s.name, s.season, s.prestige)}</span><b>${esc(s.champion)}</b><small>${s.year || H.yearOf(s.season)}</small></button>`).join('')}</div></section>`).join('') || empty('Кубки появятся после первых турниров');
  } else if (f.tab === 'majors') {
    const list = ch.filter(s => s.prestige === 'major');
    body = list.length ? `<div class="tc-majors">${list.map(s => { const mvp = Object.entries(H.awards()).find(([, r]) => (r.mvp || []).some(x => x.id === s.id)); const second = (s.results || []).find(r => r.p === 2)?.n;
      return `<button type="button" class="tc-major" data-event="${esc(s.id)}"><span class="tc-tr big">${trophy(s.name, s.season, 'major')}</span><span class="tc-major-t"><small>${s.year || H.yearOf(s.season)}</small><b>${esc(s.name)}</b><span>${logo(s.champion, 'sm')} ${esc(s.champion)}</span><em>финал против ${esc(second || '—')}${mvp ? ' · MVP ' + esc(mvp[0]) : ''}</em></span></button>`; }).join('')}</div>` : empty('Major ещё не разыгрывались');
  } else if (f.tab === 'champs') {
    const years = {}; ch.forEach(s => (years[s.year || H.yearOf(s.season)] = years[s.year || H.yearOf(s.season)] || []).push(s));
    body = Object.entries(years).sort((a, b) => b[0] - a[0]).map(([y, list]) => box(`${y}`, `<table class="hs-tbl hs-stbl"><tbody>${list.sort((a, b) => (H.KIND_ORDER[a.prestige] ?? 9) - (H.KIND_ORDER[b.prestige] ?? 9)).map(s => `<tr data-event="${esc(s.id)}"><td class="l"><span class="hs-ev-tr sm">${trophy(s.name, s.season, s.prestige)}</span>${esc(s.name)}</td><td class="l"><span class="hs-kind k-${s.prestige}">${KIND[s.prestige]}</span></td><td class="l">${logo(s.champion, 'xs')} <b>${esc(s.champion)}</b></td></tr>`).join('')}</tbody></table>`, '', 'flush')).join('') || empty('Пока пусто');
  } else if (f.tab === 'teams') {
    const by = {}; H.TEAMS().forEach(t => { const w = (t.history || []).filter(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward); if (w.length) by[t.name] = { all: w.length, maj: w.filter(h => h.isMajor).length, el: w.filter(h => h.isElite).length }; });
    body = box('Трофеи команд', `<table class="hs-tbl hs-stbl"><thead><tr><th>#</th><th class="l">Команда</th><th>Всего</th><th>Major</th><th>S-Tier</th><th>Сезонов №1</th></tr></thead><tbody>${Object.entries(by).sort((a, b) => b[1].maj - a[1].maj || b[1].all - a[1].all).map(([n, v], i) => `<tr data-team="${esc(n)}"><td class="n">${i + 1}</td><td class="l">${logo(n, 'sm')} <b>${esc(n)}</b></td><td><b>${v.all}</b></td><td>${v.maj}</td><td>${v.el}</td><td>${(ST().hallOfFame || []).filter(h => h.champion === n).length}</td></tr>`).join('')}</tbody></table>`, '', 'flush');
  } else if (f.tab === 'hof') {
    const teamsHof = (ST().hallOfFame || []).slice().sort((a, b) => b.season - a.season), pl = hallOfFame();
    body = `<div class="hs-grid2"><div class="hs-col">${box('Игроки', pl.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th>Major</th><th>MVP</th><th>Top 20</th></tr></thead><tbody>${pl.map(x => `<tr data-player="${esc(x.nick)}"><td class="l"><b>${esc(x.nick)}</b>${x.active ? '' : '<small>завершил</small>'}</td><td>${x.maj}</td><td>${x.mvp}</td><td>${x.top}</td></tr>`).join('')}</tbody></table>` : empty('Критерии: 2+ Major, 3+ Top 20 или 5+ MVP'), '', 'flush')}</div>
      <div class="hs-col">${box('Команды сезона', teamsHof.map(h => `<button type="button" class="hs-hof" data-team="${esc(h.champion)}"><span class="hs-ev-tr">${window.TW ? window.TW.awardSvg('team', h.year || H.yearOf(h.season)) : ''}</span><span><b>${esc(h.champion)}</b><small>Сезон ${h.season} · ${h.year || H.yearOf(h.season)}</small></span></button>`).join('') || empty('Сезоны ещё не завершены'))}</div></div>`;
  }
  return `<div class="hs-head"><h1>Награды</h1><div class="hs-filters">${tabs}</div></div>${body}`;
};
H.CLICKS.push(['[data-awtab]', el => { H.S.aw.tab = el.dataset.awtab; H.render(); }]);
H.PAGES.hof = () => { H.S.aw.tab = 'hof'; return H.PAGES.awards(); };
H.PAGES.majors = () => { H.S.aw.tab = 'majors'; return H.PAGES.awards(); };

H.S.ar = { season: null };
H.PAGES.archive = () => {
  const ch = Object.values(H.archive()).filter(Boolean), seasons = [...new Set(ch.map(s => s.season))].sort((a, b) => b - a), cur = ST().currentSeason;
  const sel = H.S.ar.season ?? seasons.find(s => s !== cur) ?? seasons[0];
  const chips = seasons.map(s => `<button type="button" class="hs-chip${s === sel ? ' on' : ''}" data-arsea="${s}">Сезон ${s} · ${H.yearOf(s)}${s === cur ? ' (идёт)' : ''}</button>`).join('');
  const list = ch.filter(s => s.season === sel).sort((a, b) => (H.KIND_ORDER[a.prestige] ?? 9) - (H.KIND_ORDER[b.prestige] ?? 9) || (a.gs || a.ts || 0) - (b.gs || b.ts || 0));
  const hof = (ST().hallOfFame || []).find(h => h.season === sel);
  const A = H.awards(), top = []; Object.entries(A).forEach(([nick, r]) => (r.top || []).forEach(x => { if (x.y === H.yearOf(sel)) top.push({ nick, r: x.r, team: x.team }); }));
  const snap = rankStore().snaps.filter(x => x.s === sel).pop();
  return `<div class="hs-head"><h1>Архив</h1></div><div class="hs-filters" style="margin-bottom:12px">${chips || ''}</div>
    ${list.length ? `<div class="hs-grid2"><div class="hs-col">${box(`Турниры сезона ${sel} · ${list.length}`, `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Турнир</th><th class="l">Уровень</th><th class="l">Формат</th><th class="l">Чемпион</th><th class="l">Финалист</th></tr></thead><tbody>${list.map(s => `<tr data-event="${esc(s.id)}"><td class="l"><span class="hs-ev-tr sm">${trophy(s.name, s.season, s.prestige)}</span><b>${esc(s.name)}</b></td><td class="l"><span class="hs-kind k-${s.prestige}">${KIND[s.prestige] || ''}</span></td><td class="l hs-dim">${esc(s.format || '')}</td><td class="l">${s.champion && s.champion !== '—' ? `${logo(s.champion, 'xs')} ${esc(s.champion)}` : '—'}</td><td class="l hs-dim">${esc((s.results || []).find(r => r.p === 2)?.n || '')}</td></tr>`).join('')}</tbody></table>`, '', 'flush')}</div>
      <div class="hs-col">${hof ? box('Команда сезона', `<button type="button" class="hs-hof" data-team="${esc(hof.champion)}"><span class="hs-ev-tr">${window.TW ? window.TW.awardSvg('team', hof.year || H.yearOf(sel)) : ''}</span><span><b>${esc(hof.champion)}</b><small>${hof.scorePts} очков · взлёт: ${esc(hof.risingStar || '—')}</small></span></button>`) : ''}
      ${top.length ? box(`Top 20 · ${H.yearOf(sel)}`, top.sort((a, b) => a.r - b.r).slice(0, 10).map(x => `<button type="button" class="hm-rk" data-player="${esc(x.nick)}"><span class="n">${x.r}</span><span class="nm">${esc(x.nick)}</span><span class="hs-dim">${esc(x.team || '')}</span></button>`).join(''), '', 'flush') : ''}
      ${snap ? box('Итоговый рейтинг', snap.n.slice(0, 10).map((n, i) => `<button type="button" class="hm-rk" data-team="${esc(n)}"><span class="n">${i + 1}</span>${logo(n, 'sm')}<span class="nm">${esc(n)}</span><span class="pts">${snap.p[i]}</span></button>`).join(''), '', 'flush') : ''}</div></div>` : empty('Архив пуст — он пополняется после каждого турнира')}
    <p class="hs-note">Когда хранилище браузера заполняется, самые старые снимки Tier-3 и академий удаляются первыми; титулы команд и награды игроков сохраняются всегда.</p>`;
};
H.CLICKS.push(['[data-arsea]', el => { H.S.ar.season = +el.dataset.arsea; H.render(); }]);
console.info('[v30] профили, рейтинг, трансферы, награды портала');
})();
