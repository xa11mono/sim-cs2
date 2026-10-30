(() => {
'use strict';
/* =====================================================================
   v25 · HLTV-хаб
   1) архив сеток турниров (отдельный ключ localStorage)
   2) профиль команды в стиле HLTV, кубки = реальные победы (place === 1)
   3) окно игрока (статистика игроков убрана из хаба)
   4) окно турнира: групповой этап / плей-офф / итоги
   Хуки, которые вызываются из старого кода:
     hubMakeId, hubCaptureGroupStages, hubArchiveTier1, hubArchiveParallel,
     hubArchiveExport, hubArchiveImport, hubArchiveClear
   ===================================================================== */

const $ = id => document.getElementById(id);
const ARCHIVE_KEY = 'cs2_hltv_archive_v1';
const ARCHIVE_BUDGET = 1500000; // символов JSON; старые снимки вытесняются

/* ---------------------------------------------------------------- утилиты */
const COUNTRY_NAMES = {
  RU:'Россия', UA:'Украина', BY:'Беларусь', DK:'Дания', FR:'Франция', BR:'Бразилия', DE:'Германия',
  IL:'Израиль', EE:'Эстония', GB:'Великобритания', CA:'Канада', NO:'Норвегия', US:'США', CN:'Китай',
  SE:'Швеция', PL:'Польша', SK:'Словакия', HU:'Венгрия', RO:'Румыния', ES:'Испания', FI:'Финляндия',
  BG:'Болгария', AR:'Аргентина', KZ:'Казахстан', BA:'Босния и Герцеговина', XK:'Косово', LV:'Латвия',
  PT:'Португалия', EU:'Европа', MN:'Монголия', TR:'Турция', SA:'Саудовская Аравия'
};
const FLAG_NAMES = {
  '🇷🇺':'Россия', '🇸🇦':'Саудовская Аравия', '🇫🇷':'Франция', '🇩🇪':'Германия', '🇧🇷':'Бразилия',
  '🇺🇦':'Украина', '🇹🇷':'Турция', '🇲🇳':'Монголия', '🇩🇰':'Дания', '🇦🇷':'Аргентина', '🇺🇸':'США',
  '🇸🇪':'Швеция', '🇨🇳':'Китай', '🇪🇺':'Европа', '🇵🇹':'Португалия', '🌍':'Международная'
};
function flagFromCode(code) {
  if (!/^[A-Z]{2}$/.test(code || '')) return '';
  return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
}
const playerFlag = p => flagFromCode(p.country) || p.flag || '🌍';
function teamInitials(name) {
  const words = String(name || '?').replace(/^Team\s+/i, '').split(/[\s.]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return String(words[0] || '?').slice(0, 2).toUpperCase();
}
const teamHue = name => 190 + (hashTeamName(String(name)) % 90); // холодные оттенки, как в палитре HLTV
function logoHtml(t, cls) {
  const name = t?.name || '?';
  if (t?.logo) return `<div class="hl-logo ${cls || ''}" style="--h:${teamHue(name)}"><img src="${esc(t.logo)}" alt=""></div>`;
  return `<div class="hl-logo ${cls || ''}" style="--h:${teamHue(name)}">${esc(teamInitials(name))}</div>`;
}
const SILHOUETTE = '<svg viewBox="0 0 100 110" aria-hidden="true"><circle cx="50" cy="34" r="19" fill="#3a434b"/><path d="M8 110c0-27 17-42 42-42s42 15 42 42z" fill="#3a434b"/></svg>';
const ICON_CROWN = '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';
const ICON_AWP = '<svg viewBox="0 0 24 24"><path d="M11 2h2v4.1A6 6 0 0 1 17.9 11H22v2h-4.1A6 6 0 0 1 13 17.9V22h-2v-4.1A6 6 0 0 1 6.1 13H2v-2h4.1A6 6 0 0 1 11 6.1zm1 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>';

/* --------------------------------------------------------------- архив */
let archive = (() => {
  try { const o = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
  catch (e) { return {}; }
})();
let flushTimer = null;
function archiveFlush() {
  clearTimeout(flushTimer); flushTimer = null;
  const ids = () => Object.keys(archive).sort((a, b) => (archive[a].ts || 0) - (archive[b].ts || 0));
  let json = JSON.stringify(archive);
  while (json.length > ARCHIVE_BUDGET && Object.keys(archive).length > 1) {
    const drop = Math.max(1, Math.round(Object.keys(archive).length * 0.1));
    ids().slice(0, drop).forEach(k => delete archive[k]);
    json = JSON.stringify(archive);
  }
  try { localStorage.setItem(ARCHIVE_KEY, json); }
  catch (e) { // квота: выбрасываем 30% самых старых и пробуем ещё раз
    ids().slice(0, Math.ceil(Object.keys(archive).length * 0.3)).forEach(k => delete archive[k]);
    try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive)); } catch (e2) { console.warn('[hub] архив не сохранён', e2); }
  }
}
function archivePut(snap) {
  archive[snap.id] = snap;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(archiveFlush, 300);
}
window.addEventListener('beforeunload', () => { if (flushTimer) archiveFlush(); });
window.hubArchiveExport = () => archive;
window.hubArchiveImport = obj => { if (obj && typeof obj === 'object') { archive = obj; archiveFlush(); } };
window.hubArchiveClear = () => { archive = {}; try { localStorage.removeItem(ARCHIVE_KEY); } catch (e) {} };
window.hubMakeId = ct => `T${ct.season}-${ct.tourIndex ?? 0}-${(hashTeamName(ct.name) % 46656).toString(36)}-${Date.now().toString(36)}`;

/* -------------------------------------------- снимки: компактные матчи */
function series(m) {
  const br = m.broadcastResult;
  if (br && Number.isFinite(+br.series1) && Array.isArray(br.maps)) {
    return { s: [+br.series1, +br.series2], mp: br.maps.map(x => [x.map, +x.t1Score, +x.t2Score]) };
  }
  const mm = String(m.score || '').match(/(\d+)\s*[-:–]\s*(\d+)/);
  return { s: mm ? [+mm[1], +mm[2]] : null, mp: [] };
}
const hm = m => { // v30: + формат серии и признак «в эфире» (в архив попадает только bo)
  if (!m) return null;
  const o = { a: m.t1 || null, b: m.t2 || null, w: m.winner || null, ...series(m) };
  if (m.isBO1) o.bo = 1; else if (m.isBO5) o.bo = 5;
  if (!m.winner && m.broadcastStatus === 'live') o.lv = 1;
  return o;
};
const tagged = (m, tag) => (m ? { ...m, tag } : m);
const roundsOf = (arr, titleFn) => arr.map((r, i) => ({ title: titleFn(i, arr.length), ms: r.map(hm) }));

function swissBlock(title, rounds, teamRows, extra) {
  const standings = [...teamRows]
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || (b.diff || 0) - (a.diff || 0))
    .map(t => ({ n: t.name, w: t.wins, l: t.losses }));
  return { tab: 'groups', title, ...extra, standings,
    sections: [{ title: null, rounds: rounds.map((r, i) => ({ title: `Раунд ${i + 1}`, ms: r.map(hm) })) }] };
}
function gslBlock(groups) {
  return { tab: 'groups', title: 'GSL · групповой этап',
    sections: groups.map((g, i) => ({
      title: `Группа ${String.fromCharCode(65 + i)}`,
      rounds: [
        { title: 'Открытие', ms: [hm(g.matches.opening1), hm(g.matches.opening2)] },
        { title: 'За выход', ms: [tagged(hm(g.matches.winners), 'Победителей'), tagged(hm(g.matches.losers), 'Проигравших')] },
        { title: 'Решающий матч', ms: [hm(g.matches.decider)] }
      ]
    })) };
}
function bountyBlock(b) {
  return { tab: 'groups', title: 'Bounty Hunt · стадии 1–2',
    sections: [
      { title: 'Стадия 1 (BO1)', rounds: [
        { title: 'Группа A', ms: b.stage1.slice(0, 8).map(hm) },
        { title: 'Группа B', ms: b.stage1.slice(8, 16).map(hm) } ] },
      { title: 'Стадия 2 (BO3) — путёвки на LAN', rounds: [{ title: 'Матчи', ms: b.stage2.map(hm) }] }
    ] };
}

/* перехват данных группового этапа ДО того, как движок их обнулит */
window.hubCaptureGroupStages = function () {
  const ct = currentTournament; if (!ct) return;
  ct.hubBlocks = ct.hubBlocks || [];
  const put = (key, block) => {
    block.key = key;
    const i = ct.hubBlocks.findIndex(b => b.key === key);
    if (i >= 0) ct.hubBlocks[i] = block; else ct.hubBlocks.push(block);
  };
  if (ct.swiss?.rounds) { ct.hubFormat = ct.hubFormat || 'swiss'; put('swiss', swissBlock('Швейцарский этап', ct.swiss.rounds, ct.swiss.teams)); }
  if (ct.gsl?.groups) { ct.hubFormat = ct.hubFormat || 'gsl'; put('gsl', gslBlock(ct.gsl.groups)); }
  if (ct.bounty?.stage1) { ct.hubFormat = ct.hubFormat || 'bounty'; put('bounty', bountyBlock(ct.bounty)); }
};

const FORMAT_LABELS = {
  single: 'Single Elimination', double: 'Double Elimination', swiss: 'Swiss + плей-офф',
  gsl: 'GSL-группы + плей-офф', bounty: 'Bounty Hunt', major: 'Major (3 × Swiss + плей-офф)'
};

/* основной турнир (Tier-1) */
// v30: снимок турнира без побочных эффектов — для живой страницы турнира в портале
function tier1Blocks(ct) {
  const blocks = (ct.hubBlocks || []).map(b => ({ ...b }));
  const put = (key, block) => { block.key = key; const i = blocks.findIndex(b => b.key === key); if (i >= 0) blocks[i] = block; else blocks.push(block); };
  if (ct.swiss?.rounds) put('swiss', swissBlock('Швейцарский этап', ct.swiss.rounds, ct.swiss.teams));
  if (ct.gsl?.groups) put('gsl', gslBlock(ct.gsl.groups));
  if (ct.bounty?.stage1) put('bounty', bountyBlock(ct.bounty));
  if (ct.majorStages) {
    ct.majorStages.forEach((st, i) => {
      if (st?.rounds?.length) blocks.push(swissBlock(`Major · Stage ${i + 1}`, st.rounds, st.teams));
    });
  }
  const hasGroups = blocks.length > 0;
  const playTitle = ct.isMajor ? 'Champions Stage' : (hasGroups ? 'Плей-офф' : 'Турнирная сетка');
  if (ct.hasLowerBracket && ct.upperRounds?.length) {
    const up = ct.upperRounds, lo = ct.lowerRounds || [];
    blocks.push({ tab: 'playoff', title: playTitle, sections: [
      { title: 'Верхняя сетка', rounds: roundsOf(up, (i, n) => i === n - 1 ? 'Финал верхней' : getPlayoffStageName(i, n)) },
      { title: 'Нижняя сетка', rounds: roundsOf(lo, (i, n) => i === n - 1 ? 'Финал нижней' : `Раунд ${i + 1}`) },
      { title: 'Гранд-финал', rounds: [{ title: `Гранд-финал (${ct.finalFormat})`, ms: [hm(ct.grandFinal)] }] }
    ] });
  } else if (ct.upperRounds?.length) {
    const sections = [{ title: null, rounds: roundsOf(ct.upperRounds, (i, n) => i === n - 1 ? `Финал (${ct.finalFormat})` : getPlayoffStageName(i, n)) }];
    if (ct.bronzeMatch) sections.push({ title: 'Матч за 3-е место', rounds: [{ title: 'За 3-е место', ms: [hm(ct.bronzeMatch)] }] });
    blocks.push({ tab: 'playoff', title: playTitle, sections });
  }
  return blocks.map(({ key, ...rest }) => rest);
}
function gameDates(ct) { // v30: даты игрового календаря (не реального времени)
  try {
    const step = (seasonState.seasonSchedule || [])[ct.tourIndex] || (seasonState.seasonSchedule || []).find(x => x && x.name === ct.name);
    const gs = Number(step?.calendar?.startMs) || 0, now = Number(seasonState.calendar?.currentMs) || 0;
    return gs ? { gs, ge: ct.completed ? Math.max(gs, now) : Number(step.calendar.endMs) || gs } : {};
  } catch (e) { return {}; }
}
function tier1Snap(ct) {
  const placed = Object.entries(ct.placements || {}).map(([n, p]) => ({ n, p: p.place, t: p.title || '', d: ct.pendingDeltas?.[n] ?? 0 }));
  placed.sort((a, b) => a.p - b.p || b.d - a.d);
  return {
    id: ct.hubArchiveId, v: 1, ts: Date.now(), tier: '1',
    prestige: ct.isMajor ? 'major' : ct.isElite ? 'elite' : 'regular',
    name: ct.name, season: ct.season, year: 2026 + (ct.season - 1),
    format: ct.isMajor ? 'major' : (ct.hubFormat || ct.formatChoice), size: (ct.participants || []).length,
    champion: placed.find(x => x.p === 1)?.n || '—', blocks: tier1Blocks(ct), results: placed, ...gameDates(ct)
  };
}
window.hubSnapshotTier1 = ct => { if (!ct) return null; if (!ct.hubArchiveId) ct.hubArchiveId = window.hubMakeId(ct); const s = tier1Snap(ct); s.live = !ct.completed; s.participants = (ct.participants || []).slice(); return s; };

/* основной турнир (Tier-1) */
window.hubArchiveTier1 = function (ct) {
  if (!ct || !ct.completed) return;
  window.hubCaptureGroupStages();
  const id = ct.hubArchiveId || (ct.hubArchiveId = window.hubMakeId(ct));
  archivePut(tier1Snap(ct));
  (ct.participants || []).forEach(name => {
    const t = teams.find(x => x.name === name);
    const h = t?.history?.find(x => x.tournament === ct.name && x.season === ct.season && !x.archiveId && x.place > 0);
    if (h) h.archiveId = id;
  });
};

/* параллельные турниры (Tier-2/3, академии) */
function parallelSnap(ev, live) {
  const br = ev?.br; if (!br?.matches) return null;
  const ix = {}; br.matches.forEach(m => { ix[m.id] = m; });
  const pm = m => {
    if (!m) return null;
    const wo = m.sc === 'w/o';
    const mm = String(m.sc || '').match(/^(\d+)-(\d+)$/);
    const s = mm ? (m.w && m.w === m.t1 ? [+mm[1], +mm[2]] : [+mm[2], +mm[1]]) : null;
    const o = { a: m.t1 || null, b: m.t2 || null, w: (m.w && m.w !== '—') ? m.w : null, s, wo,
      mp: Array.isArray(m.maps) ? m.maps.map(x => [x.map, x.s1, x.s2]) : [] };
    if (live && m.at) o.at = m.at;
    return o;
  };
  const secs = [], by = {};
  br.rounds.forEach(r => {
    const g = r.grp || '';
    const s = by[g] || (by[g] = { grp: g, rounds: [] });
    if (!secs.includes(s)) secs.push(s);
    s.rounds.push({ title: r.name, ms: r.ids.map(id => pm(ix[id])) });
  });
  const isGroup = g => /^Группа/.test(g) || g === 'Швейцарка';
  const blocks = [];
  const gs = secs.filter(s => isGroup(s.grp)), ps = secs.filter(s => !isGroup(s.grp));
  if (gs.length) {
    const swiss = br.swiss;
    blocks.push({ tab: 'groups', title: swiss ? 'Швейцарский этап' : 'Групповой этап',
      sections: gs.map(s => ({ title: swiss ? null : s.grp, rounds: s.rounds })),
      standings: swiss ? (ev.standings || []).map(x => ({ n: x.team, w: x.wins, l: x.losses })) : undefined, noStatus: !!swiss });
  }
  if (ps.length) {
    blocks.push({ tab: 'playoff', title: gs.length ? 'Плей-офф' : 'Турнирная сетка',
      sections: ps.map(s => ({ title: ps.length > 1 ? (s.grp || 'Плей-офф') : null, rounds: s.rounds })) });
  }
  const order = ev.placements || [];
  const award = Math.round(12 * (ev.pointsMult || 0));
  return {
    id: 'P-' + ev.id, v: 1, ts: Date.now(), tier: ev.tier, kind: ev.kind,
    prestige: ev.kind === 'academy' ? 'academy' : (ev.tier === '2' ? 'tier2' : 'tier3'),
    name: ev.name, season: ev.season, year: ev.year, format: ev.format,
    size: (ev.participants || []).length, champion: ev.winner || order[0] || '—',
    blocks, results: order.map((n, i) => ({ n, p: i + 1, t: '', d: i === 0 ? award : 0 })), ordered: true, gs: ev.startMs || 0, ge: ev.completedAt && ev.completedAt < 4e12 && ev.completedAt > (ev.startMs || 0) ? ev.completedAt : (ev.endMs || 0)
  };
}
window.hubSnapshotParallel = ev => { const s = parallelSnap(ev, true); if (s) { s.live = ev.status !== 'completed'; s.participants = (ev.participants || []).map(x => typeof x === 'string' ? x : x.name); } return s; };
window.hubArchiveParallel = function (ev) {
  const snap = parallelSnap(ev, false); if (snap) archivePut(snap);
};

/* ---------------------------------------------------- типы и эмодзи */
const BRAND_EMOJI = [
  [/major/i, '🏆'], [/bounty/i, '🎯'], [/academy|junior|nxt/i, '🎓'],
  [/\biem\b/i, '💠'], [/esl|epl/i, '🛡️'], [/blast/i, '💥'], [/pgl/i, '🔷'],
  [/starladder|starseries|i-league/i, '🌟'], [/dreamhack/i, '🎮'], [/thunderpick/i, '⚡'],
  [/cct/i, '🌐'], [/dacha|betboom/i, '🏔️'], [/fissure/i, '🌋'], [/fireleague/i, '🔥'],
  [/skyesports/i, '☁️'], [/elisa/i, '❄️'], [/roobet/i, '🎲'], [/\bres\b/i, '📡'],
  [/pinnacle/i, '📍'], [/united21/i, '🔵'], [/yalla/i, '🌴'], [/tipsport/i, '🏟️'],
  [/exort/i, '🧭'], [/european pro league/i, '🦁'],
  [/rookie|open|amateur|novice|underground|grassroots|entry|rising|future|prospects|young/i, '🌱'],
  [/masters/i, '🎖️'], [/world|global|continental/i, '🌍']
];
const tournamentEmoji = name => (BRAND_EMOJI.find(([re]) => re.test(name || '')) || [0, '🏆'])[1];
const TYPE_LABELS = { major: 'Major', elite: 'S-Tier', regular: 'Tier-1', tier2: 'Tier-2', tier3: 'Tier-3', academy: 'Академии' };
function entryKind(h, snap) {
  if (snap?.prestige) return snap.prestige;
  if (h.isMajor) return 'major';
  if (h.isElite) return 'elite';
  if (/Фоновый/.test(h.placeTitle || '')) return /Academy|Junior|NXT|Ares|Академ/i.test(h.tournament) ? 'academy' : (h.fieldProfile === 'medium' ? 'tier2' : 'tier3');
  return 'regular';
}

/* ------------------------------------------------------- подсказка */
let tipEl = null;
function tip() { return tipEl || (tipEl = Object.assign(document.body.appendChild(document.createElement('div')), { className: 'hl-tip', role: 'tooltip' })); }
function showTip(anchor, html) {
  const el = tip(); el.innerHTML = html; el.classList.add('on');
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  let x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  let y = r.top - h - 8; if (y < 8) y = r.bottom + 8;
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function hideTip() { tipEl?.classList.remove('on'); }

/* ------------------------------------------------- профиль команды */
let lastHubTeam = null;
let trophyList = [];

function collectTrophies(t) {
  const out = [];
  (seasonState.hallOfFame || []).forEach(h => {
    if (h.champion === t.name) out.push({ crown: true, emoji: '👑', title: `Чемпион сезона ${h.season} (${h.year || 2026})`, sub: `${h.scorePts} pts`, star: true });
  });
  (t.history || []).forEach(h => {
    if (h.place !== 1 || h.isBootcamp || h.isSeasonAward) return;
    const snap = h.archiveId ? archive[h.archiveId] : null;
    const kind = entryKind(h, snap);
    out.push({ h, snap, kind, emoji: tournamentEmoji(h.tournament), star: kind === 'major',
      title: h.tournament, sub: `Сезон ${h.season} · ${TYPE_LABELS[kind]}` });
  });
  return out;
}
function trophiesHtml(list) {
  if (!list.length) return '<div class="hl-trophies-empty">Побед в турнирах пока нет. Кубок появляется за 1 место.</div>';
  return list.map((x, i) => `<button type="button" class="hl-trophy${x.crown ? ' static' : ''}" data-i="${i}" aria-label="${esc(x.title)}">` +
    `<span class="hl-trophy-emoji">${x.emoji}</span>${x.star ? '<span class="hl-trophy-star">★</span>' : ''}</button>`).join('');
}

function rowsHtml(t, rank, trophyCount) {
  const start = Number(t.seasonStartRank) || 0, diff = start ? start - rank : 0;
  const dyn = diff > 0 ? `<span class="hl-up">▲${diff}</span>` : diff < 0 ? `<span class="hl-down">▼${-diff}</span>` : '<span class="hl-same">—</span>';
  const ages = (t.players || []).map(p => +p.age).filter(Boolean);
  const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—';
  const played = (t.history || []).filter(h => !h.isBootcamp && !h.isSeasonAward && h.place > 0).length;
  const coach = t.coach || {};
  return `
    <div class="hl-row2">
      <div class="hl-cell"><span>Рейтинг игры</span><span class="v">#${rank}</span></div>
      <div class="hl-cell"><span>Очки рейтинга</span><span class="v">${Math.round(t.pts)}</span></div>
    </div>
    <div class="hl-row"><span>Динамика за сезон</span><span class="v">${dyn}</span></div>
    <div class="hl-row"><span>Побед в турнирах</span><span class="v">${trophyCount}</span></div>
    <div class="hl-row"><span>Турниров сыграно</span><span class="v">${played}</span></div>
    <div class="hl-row"><span>Средний возраст игроков</span><span class="v">${avgAge}</span></div>
    <div class="hl-row"><span>Тренер</span><span class="v">${esc(coach.flag || '')} <span class="hl-coach">${esc(coach.name || '—')}</span></span></div>`;
}

function rosterHtml(t) {
  const starNick = t.players.reduce((best, p) => (!best || ovr(p) > ovr(best)) ? p : best, null)?.nick;
  return t.players.map(p => {
    const role = p.role === 'IGL' ? `<span class="hl-badge igl" title="IGL">${ICON_CROWN}</span>`
      : p.role === 'AWPer' ? `<span class="hl-badge awp" title="AWPer">${ICON_AWP}</span>` : '';
    const star = p.nick === starNick ? `<span class="hl-badge-star" title="Лучший игрок состава">★</span>` : '';
    const st = p.status && p.status !== 'STARTER' ? `<span class="hl-status ${p.status === 'BENCH' ? 'bench' : ''}">${esc(p.status)}</span>` : '';
    const photo = p.photo ? `<img src="${esc(p.photo)}" alt="">` : SILHOUETTE;
    return `<button type="button" class="hl-pcard" data-team="${esc(t.name)}" data-nick="${esc(p.nick)}" aria-label="Профиль игрока ${esc(p.nick)}">
      <span class="hl-photo">${photo}</span>${role}${star}${st}
      <span class="hl-nickbar"><span>${esc(playerFlag(p))}</span><span>${esc(p.nick)}</span></span></button>`;
  }).join('');
}

function detailsHtml(t, teamName) {
  const mapStrs = Object.entries(t.maps || {}).map(([m, val]) => `<b>${esc(m)}:</b> ${val}%`);
  const recent = (t.mapHistory || []).slice(0, 12);
  const mapHistoryHtml = recent.length ? `<div style="margin-top:4px;"><b>🗺️ Последние карты:</b> ${recent.map(h => `<span style="display:inline-block;margin:2px;padding:2px 4px;border:1px solid ${h.result === 'W' ? 'var(--win)' : 'var(--loss)'};border-radius:3px;color:${h.result === 'W' ? 'var(--win)' : 'var(--loss)'};font-size:8.5px;">${esc(h.map)} ${h.result} ${h.score ? esc(h.score) : ''}</span>`).join('')}</div>` : '';
  const modStr = t.activeModifier ? `<div style="color:#a29bfe; margin-top:2px;"><b>Событие:</b> ${t.activeModifier.icon} ${esc(t.activeModifier.name)} (${t.activeModifier.val > 0 ? '+' : ''}${t.activeModifier.val}% к форме)</div>` : '';
  const h2h = getTeamH2HSummary(teamName);
  let h2hHtml = '';
  if (h2h.list.length > 0) {
    const winrate = Math.round((h2h.totalWins / Math.max(1, h2h.totalWins + h2h.totalLosses)) * 100);
    const top = h2h.list[0];
    const badges = h2h.list.map(item => {
      const c = item.wins > item.rivalWins ? 'var(--win)' : (item.wins < item.rivalWins ? 'var(--loss)' : 'var(--gold)');
      return `<span style="display:inline-block; background:#161c26; border:1px solid #283344; padding:2px 4px; border-radius:3px; margin:2px; font-size:9px;">vs <b>${esc(item.rival)}</b>: <b style="color:${c};">${item.wins}-${item.rivalWins}</b></span>`;
    }).join('');
    h2hHtml = `<div class="h2h-compact-box"><div class="h2h-compact-header">
      <span>⚔️ <b>H2H:</b> <b style="color:var(--win);">${h2h.totalWins}W</b> - <b style="color:var(--loss);">${h2h.totalLosses}L</b> (${winrate}%)</span>
      <button class="secondary" id="h2h-toggle-btn" style="padding:1px 5px; font-size:8.5px;" onclick="toggleH2HDetails()">Детали</button></div>
      <div style="color:var(--text-muted); font-size:9px; margin-top:1px;">Главный соперник: <b>${esc(top.rival)}</b> (${top.wins}-${top.rivalWins})</div>
      <div id="h2h-scroll-details" class="h2h-details-scroll">${badges}</div></div>`;
  }
  const rl = t.rosterLastChange;
  return `
    <div>🗺️ <b>Маппул:</b> ${mapStrs.join(' | ')}</div>
    ${mapHistoryHtml}
    <div style="margin-top:2px;">📈 <b>Форма:</b> ${t.form}% | 💤 <b>Усталость:</b> ${t.fatigue}% | 🧪 <b>Химия:</b> ${t.playerLayer?.chemistry ?? '—'} | 🤝 <b>Сыгранность:</b> ${t.playerLayer?.cohesion ?? '—'}</div>
    ${modStr}${h2hHtml}
    ${rl ? `<div class="transfer-note"><b>🔁 Последнее изменение ростера:</b> ${esc(rl.type === 'COACH' ? `тренер ${rl.from || '—'} → ${rl.player}` : `${rl.from || '—'} → ${rl.player}`)}${rl.reason ? ` · ${esc(rl.reason)}` : ''}</div>` : ''}
    <div class="transfer-note"><b>🧭 Идентичность:</b> ${esc(teamIdentityGroup(t))} · <b>рынок:</b> ${Array.isArray(transferState.freeAgents) ? transferState.freeAgents.length : 0} свободных игроков</div>
    ${Array.isArray(transferState.history) && transferState.history.length ? `<div class="transfer-note"><b>📰 Последнее с рынка:</b> ${esc(transferState.history[0].text)}</div>` : ''}`;
}
function historyHtml(t) {
  if (!t.history || !t.history.length) return "<li style='color:var(--text-muted);'>Нет сыгранных турниров</li>";
  return t.history.map((h, i) => {
    let badge = 'badge-def';
    if (h.isBootcamp) badge = 'badge-bootcamp';
    else if (h.isSeasonAward) badge = 'badge-season';
    else if (h.isMajor && h.place === 1) badge = 'badge-major';
    else if (h.isElite && h.place === 1) badge = 'badge-elite';
    else if (h.place === 1) badge = 'badge-1';
    else if (h.place === 2) badge = 'badge-2';
    else if (h.place === 3) badge = 'badge-3';
    const delta = h.delta !== undefined && h.delta !== 0 ? `(${h.delta >= 0 ? '+' : ''}${h.delta} pts)` : '';
    const link = h.archiveId && !h.isBootcamp;
    return `<li${link ? ` class="has-arch" data-i="${i}"` : ''}><span class="badge ${badge}">${esc(h.placeTitle || h.place + ' место')}</span> <b>${esc(h.tournament)}</b> ${delta}${link ? '<span class="hint">сетка</span>' : ''}</li>`;
  }).join('');
}

window.showHistory = function showHistory(teamName) {
  selectedTeamForDetails = teamName;
  const backdrop = $('hltv-hub-backdrop'), box = $('hltv-profile-box');
  const t = teamName ? teams.find(x => x.name === teamName) : null;
  if (!t) { backdrop.style.display = 'none'; lastHubTeam = null; hideTip(); return; }
  ensurePlayerLayer(t);
  if (!t.coach) t.coach = COACHES_2026[t.name] || { name: 'coach', flag: getTeamFlag(t.name) };
  const same = lastHubTeam === teamName && backdrop.style.display === 'flex';
  backdrop.style.display = 'flex';
  if (!same) {
    Object.assign(box.style, { position: '', left: '', top: '', margin: '' });
    $('hltv-details-block').style.display = 'none';
    $('hltv-details-toggle').classList.remove('open');
    box.scrollTop = 0;
  }
  lastHubTeam = teamName;

  const styleNames = { Aggressive: 'Агрессивный', Discipline: 'Дисциплинированный', Tactical: 'Тактический', Chaos: 'Хаос / Скрим' };
  const flag = getTeamFlag(t.name);
  const rank = teams.findIndex(x => x.name === t.name) + 1;
  trophyList = collectTrophies(t);

  $('history-header').textContent = t.name;
  $('history-team-name').textContent = styleNames[t.style] || t.style || '';
  $('hltv-team-flag').textContent = flag;
  $('hl-country-name').textContent = FLAG_NAMES[flag] || 'Международная';
  $('hl-logo').outerHTML = logoHtml(t).replace('class="hl-logo ', 'id="hl-logo" class="hl-logo ');
  $('hltv-players-row').innerHTML = rosterHtml(t);
  $('hl-rows').innerHTML = rowsHtml(t, rank, trophyList.length);
  $('trophy-cabinet').innerHTML = trophiesHtml(trophyList);
  $('team-extra-stats').innerHTML = detailsHtml(t, teamName);
  $('history-list').innerHTML = historyHtml(t);
  const fanBtn = $('hltv-fan-btn');
  if (fanBtn) {
    fanBtn.classList.toggle('on', !!t.isFan);
    fanBtn.textContent = t.isFan ? '✓ Вы фанат' : '+ Стать фанатом';
  }
};
window.hubToggleFan = function () {
  const t = teams.find(x => x.name === selectedTeamForDetails); if (!t) return;
  t.isFan = !t.isFan;
  if (typeof saveTeams === 'function') saveTeams();
  const fanBtn = $('hltv-fan-btn');
  if (fanBtn) {
    fanBtn.classList.toggle('on', !!t.isFan);
    fanBtn.textContent = t.isFan ? '✓ Вы фанат' : '+ Стать фанатом';
  }
};
window.closeHltvHub = function () {
  selectedTeamForDetails = null; lastHubTeam = null; hideTip();
  $('hltv-hub-backdrop').style.display = 'none';
};
window.toggleHltvDetails = function () {
  const block = $('hltv-details-block'), btn = $('hltv-details-toggle');
  const show = block.style.display === 'none';
  block.style.display = show ? 'block' : 'none';
  btn.classList.toggle('open', show);
  btn.firstChild.textContent = show ? 'Свернуть ' : 'Подробнее ';
  if (show) block.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

/* делегирование событий хаба */
document.addEventListener('click', e => {
  const card = e.target.closest('.hl-pcard');
  if (card) { openPlayer(card.dataset.team, card.dataset.nick); return; }
  const tr = e.target.closest('#trophy-cabinet .hl-trophy');
  if (tr) {
    const x = trophyList[+tr.dataset.i]; if (!x || x.crown) return;
    hideTip(); openTournament(x.h.archiveId, selectedTeamForDetails, x.h); return;
  }
  const li = e.target.closest('#history-list li.has-arch');
  if (li) {
    const t = teams.find(z => z.name === selectedTeamForDetails), h = t?.history?.[+li.dataset.i];
    if (h) openTournament(h.archiveId, t.name, h);
  }
});
const trophyTip = el => {
  const x = trophyList[+el.dataset.i]; if (!x) return;
  const extra = x.crown ? x.sub : (x.h.archiveId ? (archive[x.h.archiveId] ? 'Нажмите, чтобы открыть сетку' : 'Сетка удалена из архива') : 'Сетка не сохранена (турнир сыгран раньше)');
  showTip(el, `<b>${esc(x.title)}</b>${x.crown ? '' : `<small>${esc(x.sub)}</small>`}<small>${esc(extra)}</small>`);
};
document.addEventListener('mouseover', e => { const el = e.target.closest('#trophy-cabinet .hl-trophy'); if (el) trophyTip(el); });
document.addEventListener('mouseout', e => { if (e.target.closest('#trophy-cabinet .hl-trophy')) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest('#trophy-cabinet .hl-trophy'); if (el) trophyTip(el); });
document.addEventListener('focusout', e => { if (e.target.closest('#trophy-cabinet .hl-trophy')) hideTip(); });

/* ------------------------------------------------------ окна поверх */
function makeOverlay(id, narrow) {
  let ov = $(id); if (ov) return ov;
  ov = document.createElement('div'); ov.id = id; ov.className = 'hl-overlay';
  ov.innerHTML = `<div class="hl-window${narrow ? ' narrow' : ''}" role="dialog" aria-modal="true"></div>`;
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeOverlay(ov); });
  document.body.appendChild(ov);
  return ov;
}
function closeOverlay(ov) { ov.classList.remove('open'); hideTip(); }
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  for (const id of ['hl-tour-overlay', 'hl-player-overlay']) { const ov = $(id); if (ov?.classList.contains('open')) { closeOverlay(ov); return; } }
});
document.addEventListener('click', e => { const b = e.target.closest('[data-hl-close]'); if (b) closeOverlay(b.closest('.hl-overlay')); });

/* ---------------------------------------------------- окно игрока */
const ovr = p => Math.round((+p.firepower || 0) * .40 + (+p.tacticalIQ || 0) * .25 + (+p.clutch || 0) * .20 + (+p.utility || 0) * .15);
function openPlayer(teamName, nick) {
  const t = teams.find(x => x.name === teamName); if (!t) return;
  ensurePlayerLayer(t);
  const p = t.players.find(x => x.nick === nick) || t.players[0]; if (!p) return;
  const ov = makeOverlay('hl-player-overlay', true), win = ov.firstElementChild;
  const skill = (label, v) => `<div class="hl-skill"><span>${label}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, Math.round(v)))}%"></i></span><span class="val">${Math.round(v)}</span></div>`;
  const chips = [
    `<span class="hl-chip">${esc(ROLE_LABELS[p.role] || p.role || '—')}</span>`,
    p.age ? `<span class="hl-chip">${p.age} лет</span>` : '',
    p.language && p.language !== '—' ? `<span class="hl-chip">${esc(p.language)}</span>` : '',
    p.status && p.status !== 'STARTER' ? `<span class="hl-chip ${p.status === 'BENCH' ? 'red' : 'gold'}">${esc(p.status)}</span>` : ''
  ].join('');
  const rank = teams.findIndex(x => x.name === t.name) + 1;
  win.setAttribute('aria-label', `Игрок ${p.nick}`);
  win.innerHTML = `
    <div class="hl-titlebar-like hl-win-head" style="border-bottom:0">
      <div class="hl-win-titles"><div class="hl-win-sub" style="margin:0">Профиль игрока</div></div>
      <button type="button" class="hl-close" data-hl-close title="Закрыть (Esc)" style="margin-left:auto">✕</button>
    </div>
    <div class="hl-win-body" style="padding:0">
      <div class="hl-pl-top">
        <div class="hl-pl-photo">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : SILHOUETTE}</div>
        <div class="hl-pl-id">
          <div class="hl-pl-country"><span>${esc(playerFlag(p))}</span><span>${esc(COUNTRY_NAMES[p.country] || '—')}</span></div>
          <h2 class="hl-pl-nick">${esc(p.nick)}</h2>
          <div class="hl-pl-real">${esc(p.realName || 'Имя не указано')}</div>
          <div class="hl-pl-chips">${chips}</div>
          <div class="hl-pl-team">${logoHtml(t)}<span>${esc(t.name)}</span><em>рейтинг #${rank}</em></div>
        </div>
      </div>
      <div class="hl-tiles">
        <div class="hl-tile"><div class="n">${ovr(p)}</div><div class="l">Рейтинг игрока</div></div>
        <div class="hl-tile form"><div class="n">${Math.round(p.form)}%</div><div class="l">Форма</div></div>
        <div class="hl-tile morale"><div class="n">${Math.round(p.morale)}</div><div class="l">Мораль</div></div>
        <div class="hl-tile fatigue"><div class="n">${Math.round(p.fatigue)}%</div><div class="l">Усталость</div></div>
      </div>
      <div class="hl-skills">
        ${skill('Огневая мощь', p.firepower)}${skill('Тактика', p.tacticalIQ)}${skill('Клатч', p.clutch)}${skill('Утилити', p.utility)}
      </div>
      <div class="hl-mates"><div class="hl-mates-title">Состав ${esc(t.name)}</div>
        <div class="hl-mates-row">${t.players.map(x => `<button type="button" class="hl-mate${x.nick === p.nick ? ' on' : ''}" data-team="${esc(t.name)}" data-mate="${esc(x.nick)}">${esc(playerFlag(x))} ${esc(x.nick)}</button>`).join('')}</div>
      </div>
    </div>`;
  ov.classList.add('open');
  win.querySelector('.hl-close').focus();
}
document.addEventListener('click', e => {
  const m = e.target.closest('.hl-mate'); if (m && !m.classList.contains('on')) openPlayer(m.dataset.team, m.dataset.mate);
});
window.hubOpenPlayer = openPlayer;

/* --------------------------------------------------- окно турнира */
let tourState = null;
function matchHtml(m, focus) {
  if (!m) return '';
  const bo1 = m.mp?.length === 1 && m.s && m.s[0] + m.s[1] === 1;
  let sa = '', sb = '';
  if (!m.wo) { if (bo1) { sa = m.mp[0][1]; sb = m.mp[0][2]; } else if (m.s) { sa = m.s[0]; sb = m.s[1]; } }
  const maps = (m.mp || []).map(x => `${x[0]} ${x[1]}:${x[2]}`).join(' · ');
  const row = (name, sc) => {
    const cls = ['hl-mt', !name ? 'tbd' : '', name && m.w === name ? 'win' : '', name && focus === name ? 'focus' : ''].join(' ');
    return `<div class="${cls}"><span class="nm">${name ? esc(name) : 'TBD'}</span><span class="sc">${sc}</span></div>`;
  };
  return `<div class="hl-m"${maps ? ` title="${esc(maps)}"` : ''}>${m.tag ? `<div class="hl-m-tag">${esc(m.tag)}</div>` : ''}${row(m.a, sa)}${row(m.b, sb)}${m.wo ? '<div class="hl-m-wo">техническая победа</div>' : ''}</div>`;
}
function sectionHtml(sec, focus) {
  return `<div class="hl-section">${sec.title ? `<div class="hl-section-title">${esc(sec.title)}</div>` : ''}<div class="hl-rounds">` +
    sec.rounds.map(r => `<div class="hl-round"><div class="hl-round-title">${esc(r.title)}</div><div class="hl-round-col">${r.ms.map(m => matchHtml(m, focus)).join('')}</div></div>`).join('') +
    '</div></div>';
}
function standingsHtml(rows, focus, noStatus) {
  return `<table class="hl-table"><thead><tr><th>#</th><th>Команда</th><th class="num">В–П</th>${noStatus ? '' : '<th>Итог</th>'}</tr></thead><tbody>` +
    rows.map((r, i) => `<tr class="${r.n === focus ? 'focus' : ''}"><td>${i + 1}</td><td>${esc(r.n)}</td><td class="num">${r.w}–${r.l}</td>` +
      (noStatus ? '' : `<td class="${r.w >= 3 ? 'adv' : r.l >= 3 ? 'elim' : ''}">${r.w >= 3 ? 'Проход' : r.l >= 3 ? 'Вылет' : '—'}</td>`) + '</tr>').join('') + '</tbody></table>';
}
function blockHtml(b, focus) {
  return `<section class="hl-block"><h4 class="hl-block-title">${esc(b.title)}</h4>${b.sections.map(s => sectionHtml(s, focus)).join('')}${b.standings ? standingsHtml(b.standings, focus, b.noStatus) : ''}</section>`;
}
function resultsHtml(snap, focus) {
  if (!snap.results?.length) return '<div class="hl-empty">Итоги не сохранены.</div>';
  const count = {}; snap.results.forEach(r => { count[r.p] = (count[r.p] || 0) + 1; });
  return `<table class="hl-table"><thead><tr><th>Место</th><th>Команда</th><th>${snap.ordered ? '' : 'Результат'}</th><th class="num">Рейтинг</th></tr></thead><tbody>` +
    snap.results.map(r => {
      const place = snap.ordered || count[r.p] === 1 ? r.p : `${r.p}–${r.p + count[r.p] - 1}`;
      const d = r.d ? `<span class="${r.d > 0 ? 'adv' : 'elim'}">${r.d > 0 ? '+' : ''}${r.d}</span>` : '<span style="color:#6f7a82">0</span>';
      return `<tr class="${r.n === focus ? 'focus' : ''}"><td>${place}</td><td>${esc(r.n)}</td><td>${esc(r.t || '')}</td><td class="num">${d}</td></tr>`;
    }).join('') + '</tbody></table>';
}
const TAB_LABELS = { groups: 'Групповой этап', playoff: 'Плей-офф', results: 'Итоги' };
function renderTour() {
  const { snap, focus } = tourState, win = $('hl-tour-overlay').firstElementChild;
  const tabs = ['groups', 'playoff'].filter(k => snap.blocks.some(b => b.tab === k));
  if (snap.results?.length) tabs.push('results');
  if (!tabs.includes(tourState.tab)) tourState.tab = tabs.includes('playoff') ? 'playoff' : tabs[0];
  const body = tourState.tab === 'results' ? resultsHtml(snap, focus)
    : snap.blocks.filter(b => b.tab === tourState.tab).map(b => blockHtml(b, focus)).join('') || '<div class="hl-empty">Нет данных.</div>';
  const kind = snap.prestige;
  win.innerHTML = `
    <div class="hl-win-head">
      <div class="hl-win-emoji">${tournamentEmoji(snap.name)}</div>
      <div class="hl-win-titles"><div class="hl-win-title">${esc(snap.name)}</div>
        <div class="hl-win-sub">Сезон ${snap.season} (${snap.year}) · ${TYPE_LABELS[kind] || 'Турнир'} · ${esc(FORMAT_LABELS[snap.format] || snap.format || '')} · ${snap.size} команд</div></div>
      <div class="hl-win-champ">🏆 ${esc(snap.champion)}</div>
      <button type="button" class="hl-close" data-hl-close title="Закрыть (Esc)">✕</button>
    </div>
    <div class="hl-tabs" role="tablist">${tabs.map(k => `<button type="button" role="tab" aria-selected="${k === tourState.tab}" class="hl-tab${k === tourState.tab ? ' on' : ''}" data-tab="${k}">${TAB_LABELS[k]}</button>`).join('')}</div>
    <div class="hl-win-body">${body}</div>`;
  win.querySelector('.hl-close').focus();
}
function renderTourMissing(entry, evicted) {
  const win = $('hl-tour-overlay').firstElementChild;
  win.innerHTML = `
    <div class="hl-win-head">
      <div class="hl-win-emoji">${tournamentEmoji(entry?.tournament)}</div>
      <div class="hl-win-titles"><div class="hl-win-title">${esc(entry?.tournament || 'Турнир')}</div>
        <div class="hl-win-sub">Сезон ${entry?.season ?? '—'} · ${esc(entry?.placeTitle || '')}</div></div>
      <button type="button" class="hl-close" data-hl-close title="Закрыть (Esc)" style="margin-left:auto">✕</button>
    </div>
    <div class="hl-win-body"><div class="hl-empty"><b>Сетка недоступна.</b><br>${evicted
      ? 'Снимок удалён из архива: он превысил лимит хранилища браузера, и самые старые турниры вытесняются.'
      : 'Этот турнир сыгран до появления архива сеток. Сетки сохраняются только у турниров, завершённых после обновления.'}</div></div>`;
  win.querySelector('.hl-close').focus();
}
function openTournament(id, focus, entry) {
  const ov = makeOverlay('hl-tour-overlay', false);
  const snap = id ? archive[id] : null;
  tourState = { snap, focus, tab: null };
  if (snap) renderTour(); else renderTourMissing(entry, !!id);
  ov.classList.add('open');
}
document.addEventListener('click', e => {
  const tab = e.target.closest('.hl-tab'); if (!tab || !tourState?.snap) return;
  tourState.tab = tab.dataset.tab; renderTour();
});
window.hubOpenTournament = openTournament;
})();
