(() => {
'use strict';
/* =====================================================================
   v27 · HLTV-хаб — сайт внутри игры (кнопка HLTV в шапке, клавиша H)
   Разделы: Главная (новости, рейтинг, результаты, события) · Матчи · События ·
   Статистика (игроки / команды / карты) · Рейтинг · Награды; страницы матча и игрока; поиск.
   Данные: teams, архив сеток (hubArchiveExport), награды игроков (twAwardsExport),
   календарь (seasonState.seasonSchedule / parallelSchedule), трансферы (transferState).
   Статистика игроков считается по сыгранным картам из архива: счёт карты + уровень игрока
   (огневая мощь, клатч, тактика, утилити, роль). Один и тот же матч всегда даёт те же цифры.
   ===================================================================== */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const yearOf = s => 2026 + ((+s || 1) - 1);
const TEAMS = () => (typeof teams !== 'undefined' && Array.isArray(teams)) ? teams : [];
const ranked = () => [...TEAMS()].sort((a, b) => (b.pts || 0) - (a.pts || 0));
const teamBy = n => TEAMS().find(t => t.name === n);
const archive = () => { try { return window.hubArchiveExport ? window.hubArchiveExport() || {} : {}; } catch (e) { return {}; } };
const awards = () => { try { return window.twAwardsExport ? (window.twAwardsExport().p || {}) : {}; } catch (e) { return {}; } };
const ensure = t => { try { if (t && typeof ensurePlayerLayer === 'function') ensurePlayerLayer(t); } catch (e) {} return t; };
function flag(code, fb) { if (/^[A-Z]{2}$/.test(code || '')) return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0))); return fb || '🌍'; }
const pFlag = p => flag(p?.country, p?.flag);
function initials(name) { const w = String(name || '?').replace(/^Team\s+/i, '').split(/[\s.]+/).filter(Boolean); return (w.length >= 2 ? w[0][0] + w[1][0] : String(w[0] || '?').slice(0, 2)).toUpperCase(); }
const photoOf = p => (p && ((window.V31Media && window.V31Media.url('player', p.nick)) || p.photo)) || null; // v31: свои фото пользователя
const photoHtml = (p, full) => { const u = full && p && window.V31Media ? (window.V31Media.full(p.nick) || photoOf(p)) : photoOf(p); return u ? `<img src="${esc(u)}" alt="" loading="lazy">` : SIL; };
function logo(name, cls) {
  const t = teamBy(name), h = 190 + (hash(name) % 140), src = (window.V31Media && window.V31Media.url('team', name)) || t?.logo;
  return src ? `<span class="hs-logo img${window.V31Media && window.V31Media.dark(name) ? ' plate' : ''} ${cls || ''}" style="--h:${h}"><img src="${esc(src)}" alt="" loading="lazy"></span>`
    : `<span class="hs-logo ${cls || ''}" style="--h:${h}">${esc(initials(name))}</span>`;
}
const SIL = '<svg viewBox="0 0 100 110" aria-hidden="true"><circle cx="50" cy="34" r="19" fill="#3a434b"/><path d="M8 110c0-27 17-42 42-42s42 15 42 42z" fill="#3a434b"/></svg>';
const KIND = { major: 'Major', elite: 'S-Tier', regular: 'Tier-1', tier2: 'Tier-2', tier3: 'Tier-3', academy: 'Академии' };
const KIND_ORDER = { major: 0, elite: 1, regular: 2, tier2: 3, tier3: 4, academy: 5 };
const trophy = (name, season, kind) => { const u = window.V31Media && window.V31Media.url('event', name); if (u) return `<img class="ev-logo" src="${esc(u)}" alt="">`; return window.TW ? window.TW.trophySvg(name, season, kind || 'regular') : '🏆'; };
const ratingCls = r => r >= 1.15 ? 'hs-good' : r >= 1.0 ? 'hs-ok' : r >= .9 ? 'hs-meh' : 'hs-bad';

/* ------------------------------------------------------------ матчи из архива */
// Составы на момент турнира: при архивации турнира запоминаем, кто играл (ник, роль, уровень).
// Без этого статистика старых матчей после трансфера уходила новому игроку.
const snapPlayer = p => ({ nick: p.nick, role: p.role, firepower: +p.firepower || 0, clutch: +p.clutch || 0, utility: +p.utility || 0, tacticalIQ: +p.tacticalIQ || 0, country: p.country || '', flag: p.flag || '', age: p.age || null });
function stampRosters(id, names) {
  const arch = archive(), snap = arch[id]; if (!snap || snap.rost) return;
  const rost = {};
  (names || []).forEach(n => { const t = ensure(teamBy(n)); if (t?.players?.length) rost[n] = t.players.slice(0, 5).map(snapPlayer); });
  snap.rost = rost;
}
(() => { // обёртки архивации (после v25 и v26)
  const t1 = window.hubArchiveTier1;
  if (typeof t1 === 'function' && !t1.__v28) {
    const w = function (ct) { const r = t1.apply(this, arguments); try { stampRosters(ct?.hubArchiveId, ct?.participants); } catch (e) {} return r; };
    w.__v28 = true; window.hubArchiveTier1 = w;
  }
  const pa = window.hubArchiveParallel;
  if (typeof pa === 'function' && !pa.__v28) {
    const w = function (ev) { const r = pa.apply(this, arguments); try { stampRosters('P-' + ev?.id, ev?.participants); } catch (e) {} return r; };
    w.__v28 = true; window.hubArchiveParallel = w;
  }
})();
// v30: снимки турниров, которые идут сейчас (основной + параллельные) — их сыгранные матчи тоже в статистике
function liveSnaps() {
  const out = [], arch = archive();
  try { const ct = typeof currentTournament !== 'undefined' ? currentTournament : null;
    if (ct && !ct.completed && window.hubSnapshotTier1) { const s = window.hubSnapshotTier1(ct); if (s && !arch[s.id]) out.push(s); } } catch (e) {}
  try { ((typeof seasonState !== 'undefined' && seasonState.parallelSchedule) || []).forEach(ev => {
    if (ev.status !== 'live' || !ev.br || !window.hubSnapshotParallel || arch['P-' + ev.id]) return; const s = window.hubSnapshotParallel(ev); if (s) out.push(s); }); } catch (e) {}
  return out;
}
// v30: сыгранные матчи архива кэшируются (меняются только при архивации турнира); живые — отдельно и на 1 с
function collectMatches(snaps) {
  const out = [];
  snaps.forEach(snap => {
    if (!snap || !Array.isArray(snap.blocks)) return;
    let k = 0;
    snap.blocks.forEach(b => (b.sections || []).forEach(sec => (sec.rounds || []).forEach(r => (r.ms || []).forEach(m => {
      k++;
      if (!m || !m.a || !m.b || !m.w || m.wo) return;
      out.push({ id: snap.id + '~' + k, ev: snap.name, evId: snap.id, kind: snap.prestige || 'regular', season: snap.season, year: snap.year || yearOf(snap.season),
        ts: (snap.ts || 0) - (1000 - k), stage: [b.title, sec.title, r.title].filter(Boolean).join(' · '), a: m.a, b: m.b, w: m.w, s: m.s, mp: m.mp || [], rost: snap.rost || null, bo: m.bo || null, live: !!snap.live });
    }))));
  });
  return out.sort((x, y) => y.ts - x.ts);
}
let ARCH_MS = null, ARCH_KEY = '', ALL_MS = null, ALL_AT = 0;
function archMatches() {
  const arch = archive(), vals = Object.values(arch), key = vals.length + '|' + vals.reduce((m, x) => Math.max(m, x?.ts || 0), 0);
  if (ARCH_MS && key === ARCH_KEY) return ARCH_MS;
  ARCH_MS = collectMatches(vals); ARCH_KEY = key; return ARCH_MS;
}
function allMatches() {
  const now = Date.now(); if (ALL_MS && now - ALL_AT < 1000) return ALL_MS;
  ALL_MS = collectMatches(liveSnaps()).concat(archMatches()); ALL_AT = now; return ALL_MS;
}
function rosterOf(m, name) { // состав команды в этом матче
  if (m.rost && m.rost[name] && m.rost[name].length) return m.rost[name];
  return (ensure(teamBy(name))?.players || []).slice(0, 5);
}
function playerNow(nick) { for (const t of TEAMS()) { const p = (ensure(t).players || []).find(q => q.nick === nick); if (p) return { p, t }; } return null; }

/* ------------------------------------------------------- расчёт статистики */
const ROLE_K = { AWPer: 1.04, 'Entry-fragger': 1.04, Entry: 1.04, Rifler: 1.01, Lurker: 1, Support: .9, IGL: .85 };
const OPEN_K = { AWPer: 1.25, 'Entry-fragger': 1.45, Entry: 1.45, Rifler: 1, Lurker: .8, Support: .7, IGL: .75 };
function skill(p) { return ((+p.firepower || 70) * .7 + (+p.clutch || 70) * .2 + (+p.utility || 70) * .1) / 100; } // «стрелковый» уровень
let ZP = null; // среднее и разброс уровня по всей лиге → насколько игрок выше / ниже среднего (z)
function zOf(p) {
  if (!ZP) { const v = []; TEAMS().forEach(t => (ensure(t)?.players || []).forEach(q => v.push(skill(q)))); const m = v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, v.length)) || .04; ZP = { m, sd }; }
  return Math.max(-2.6, Math.min(2.6, (skill(p) - ZP.m) / ZP.sd));
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mapLines(matchId, mapIdx, map, own, opp, nameA, nameB, rosA, rosB) { // строки обеих команд на одной карте
  const R = Math.max(1, own + opp);
  const avgZ = ros => ros.length ? ros.reduce((a, p) => a + zOf(p), 0) / ros.length : 0;
  const side = (ros, team, my, th, tag, foeRos) => { const fz = avgZ(foeRos); return ros.map(p => {
    const r = rngOf(hash(matchId + '|' + mapIdx + '|' + tag + '|' + p.nick)), z = zOf(p), won = my > th, role = p.role || 'Rifler', edge = z - fz; // edge — насколько игрок сильнее соперников
    const kpr = .68 * (1 + .095 * z) * (ROLE_K[role] || 1) * (won ? 1.1 : .9) * (.8 + .4 * r()) * clamp(1 + .05 * edge, .85, 1.18);
    const dpr = .66 * (1 - .065 * z) * (won ? .87 : 1.11) * (.86 + .28 * r()) * (/Entry/.test(role) ? 1.07 : 1) * clamp(1 - .035 * edge, .87, 1.14);
    const sk = clamp(.6 + .1 * z, .3, 1), ok = OPEN_K[role] || 1;
    return { nick: p.nick, p, team, k: kpr * R, d: Math.min(R, dpr * R), a: R * (.09 + .09 * r()) * (role === 'Support' ? 1.45 : role === 'IGL' ? 1.2 : 1),
      hs: role === 'AWPer' ? .18 + .14 * r() : .4 + .22 * r() * (.7 + .3 * sk), r1: r(), r2: r(), r3: r(), r4: r(), R, won, ok, z, role };
  }); };
  const A = side(rosA, nameA, own, opp, 'a', rosB), B = side(rosB, nameB, opp, own, 'b', rosA);
  const norm = (X, Y) => { const kx = X.reduce((s, x) => s + x.k, 0), dy = Y.reduce((s, x) => s + x.d, 0); if (kx > 0 && dy > 0) X.forEach(x => { x.k = x.k * dy / kx; }); };
  norm(A, B); norm(B, A);
  const fin = x => {
    x.k = Math.round(x.k); x.d = Math.round(x.d); x.a = Math.round(x.a);
    const kpr = x.k / x.R, dpr = x.d / x.R, apr = x.a / x.R;
    x.adr = Math.max(25, kpr * 110 + apr * 26 + (x.r1 - .5) * 16);
    x.kast = Math.max(40, Math.min(92, 36 + kpr * 30 + apr * 42 + (1 - dpr) * 24 + (x.won ? 3 : -3)));
    const impact = 2.13 * kpr + .42 * apr - .41;
    x.impact = impact;
    x.rating = Math.max(.2, .0073 * x.kast + .3591 * kpr - .5329 * dpr + .2372 * impact + .0032 * x.adr + .1587);
    x.hsk = Math.round(x.k * x.hs);
    // открывающие дуэли, мульти-киллы, клатчи — из тех же чисел, воспроизводимо
    x.ok_ = Math.round(x.R * .1 * x.ok * (kpr / .68) * (.75 + .5 * x.r2)); x.od = Math.round(x.R * .1 * Math.sqrt(x.ok) * (dpr / .66) * (.75 + .5 * x.r3));
    const multi = Math.max(0, x.k - x.R * .45);
    x.k2 = Math.round(multi * .55 + x.k * .08 * x.r4); x.k3 = Math.round(x.k2 * (.22 + .14 * x.r2)); x.k4 = Math.round(x.k3 * (.18 + .2 * x.r3)); x.k5 = x.k4 > 1 && x.r1 > .78 ? 1 : 0;
    x.clA = Math.round(x.R * .045 * (.6 + .8 * x.r3)); x.clW = Math.round(x.clA * clamp(.22 + .05 * x.z + (x.won ? .1 : -.05), .05, .7));
    return x;
  };
  return { A: A.map(fin), B: B.map(fin), map, own, opp };
}
const Z0 = () => ({ maps: 0, mw: 0, R: 0, k: 0, d: 0, a: 0, dmg: 0, hsk: 0, kastR: 0, rt: 0, imp: 0, ok: 0, od: 0, k2: 0, k3: 0, k4: 0, k5: 0, clA: 0, clW: 0 });
function addTo(o, x) {
  o.maps++; if (x.won) o.mw++; o.R += x.R; o.k += x.k; o.d += x.d; o.a += x.a; o.dmg += x.adr * x.R; o.hsk += x.hsk; o.kastR += x.kast * x.R / 100; o.rt += x.rating * x.R; o.imp += x.impact * x.R;
  o.ok += x.ok_; o.od += x.od; o.k2 += x.k2; o.k3 += x.k3; o.k4 += x.k4; o.k5 += x.k5; o.clA += x.clA; o.clW += x.clW;
}
let STATS = null, STATS_KEY = '';
function stats() {
  // агрегаты (Rating 2.0, команды, карты) — по завершённым турнирам архива; пересчёт только при архивации или смене составов
  const ms = archMatches();
  const key = ms.length + '|' + (ms[0]?.id || '') + '|' + hash(TEAMS().map(t => (t.players || []).map(p => p.nick).join(',')).join(';'));
  if (STATS && STATS_KEY === key) { STATS.ms = allMatches(); return STATS; }
  ZP = null;
  const P = {}, T = {}, M = {};
  const pOf = (x) => P[x.nick] || (P[x.nick] = { nick: x.nick, team: x.team, p: x.p, all: Z0(), bySeason: {}, bySK: {}, byMap: {}, byEv: {}, matches: [] });
  const tAdd = (name, won, rw, rl, map, m, isMatch, matchWon) => {
    const o = T[name] || (T[name] = { name, maps: 0, mw: 0, rw: 0, rl: 0, matches: 0, matchW: 0, byMap: {}, form: [], h2h: {} });
    if (isMatch) {
      o.matches++; if (matchWon) o.matchW++; o.form.unshift(matchWon ? 'W' : 'L'); if (o.form.length > 10) o.form.length = 10; // v30: последние матчи, а не первые
      const opp = m.a === name ? m.b : m.a, h = o.h2h[opp] || (o.h2h[opp] = { w: 0, l: 0 }); if (matchWon) h.w++; else h.l++;
      return;
    }
    o.maps++; if (won) o.mw++; o.rw += rw; o.rl += rl;
    const bm = o.byMap[map] || (o.byMap[map] = { n: 0, w: 0, rw: 0, rl: 0 }); bm.n++; if (won) bm.w++; bm.rw += rw; bm.rl += rl;
  };
  [...ms].reverse().forEach(m => { // от старых к новым — так копятся ряды рейтинга по матчам
    tAdd(m.a, 0, 0, 0, 0, m, true, m.w === m.a); tAdd(m.b, 0, 0, 0, 0, m, true, m.w === m.b);
    const rA = rosterOf(m, m.a), rB = rosterOf(m, m.b), per = {};
    m.mp.forEach((mp, i) => {
      const [map, s1, s2] = mp; if (!Number.isFinite(+s1) || !Number.isFinite(+s2) || (+s1 + +s2) === 0) return;
      tAdd(m.a, +s1 > +s2, +s1, +s2, map, m); tAdd(m.b, +s2 > +s1, +s2, +s1, map, m);
      const mm = M[map] || (M[map] = { map, n: 0, rounds: 0, ot: 0, close: 0 }); mm.n++; mm.rounds += +s1 + +s2; if (+s1 + +s2 > 24) mm.ot++; if (Math.abs(s1 - s2) <= 3) mm.close++;
      if (!rA.length || !rB.length) return;
      const L = mapLines(m.id, i, map, +s1, +s2, m.a, m.b, rA, rB);
      L.A.concat(L.B).forEach(x => {
        const o = pOf(x); addTo(o.all, x);
        addTo(o.bySeason[m.season] || (o.bySeason[m.season] = Z0()), x);
        addTo(o.bySK[m.season + '|' + m.kind] || (o.bySK[m.season + '|' + m.kind] = Z0()), x);
        addTo(o.byMap[map] || (o.byMap[map] = Z0()), x);
        const ev = o.byEv[m.evId] || (o.byEv[m.evId] = { id: m.evId, name: m.ev, season: m.season, kind: m.kind, team: x.team, ts: m.ts, s: Z0() }); addTo(ev.s, x);
        const pm = per[x.nick] || (per[x.nick] = { id: m.id, ev: m.ev, kind: m.kind, season: m.season, team: x.team, opp: x.team === m.a ? m.b : m.a, won: m.w === x.team, s: m.s && (x.team === m.a ? m.s : [m.s[1], m.s[0]]), ts: m.ts, z: Z0() });
        addTo(pm.z, x);
      });
    });
    Object.entries(per).forEach(([nick, pm]) => P[nick].matches.unshift(pm)); // новые — первыми
  });
  // текущий клуб / данные игрока — по нынешним составам, если игрок ещё в лиге
  Object.values(P).forEach(o => { const now = playerNow(o.nick); if (now) { o.team = now.t.name; o.p = now.p; } });
  STATS = { P, T, M, ms: allMatches() }; STATS_KEY = key;
  return STATS;
}
function line(o) { // сумма → средние
  const R = Math.max(1, o.R);
  return { maps: o.maps, mw: o.mw, R: o.R, k: o.k, d: o.d, kd: o.d ? o.k / o.d : o.k, diff: o.k - o.d, kpr: o.k / R, dpr: o.d / R, apr: o.a / R,
    adr: o.dmg / R, kast: o.kastR / R * 100, hs: o.k ? o.hsk / o.k * 100 : 0, rating: o.rt / R, impact: o.imp / R,
    ok: o.ok, od: o.od, okpr: o.ok / R, k2: o.k2, k3: o.k3, k4: o.k4, k5: o.k5, clA: o.clA, clW: o.clW, wr: o.maps ? o.mw / o.maps * 100 : 0 };
}
const TIER_KEYS = { all: null, major: ['major'], t1: ['major', 'elite', 'regular'], low: ['tier2', 'tier3', 'academy'] };
function filtered(o, f) { // фильтр по сезону и уровню турниров — сумма нужных ячеек «сезон|уровень»
  const kinds = TIER_KEYS[f?.tier || 'all'], season = f?.season || 'all';
  if (!kinds && season === 'all') return line(o.all);
  const sum = Z0();
  Object.entries(o.bySK).forEach(([key, x]) => {
    const [s, k] = key.split('|');
    if (season !== 'all' && String(s) !== String(season)) return;
    if (kinds && !kinds.includes(k)) return;
    Object.keys(sum).forEach(q => { sum[q] += x[q]; });
  });
  return sum.maps ? line(sum) : null;
}

/* ------------------------------------------------------------ состояние и оболочка портала
   v30: портал — основной интерфейс приложения (не overlay). Маршруты в location.hash (#/team/NAVI),
   кнопка «Назад» браузера работает. Старое приложение живёт на странице «Симулятор» (#/sim). */
const S = { page: 'home', arg: null, hist: [], stats: { tab: 'players', season: 'all', tier: 'all', min: 0, sort: 'rating', dir: -1 }, matches: { kind: 'all', q: '', view: 'results', page: 1 }, events: { tab: 'live' } };
let root = null;
const PAGES = {};       // реестр страниц: name → fn(arg) → html  (модули v30 добавляют свои)
const AFTER = [];       // хуки после рендера: fn(page, arg)
const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5.5v13l9-6.5zM14 5.5v13l7-6.5z"/></svg>',
  sim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h5v4H3zM3 15h5v4H3zM8 7h3v10H8M11 12h4M15 10h6v4h-6z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>'
};
const NAV_MAIN = [['home', 'Главная'], ['news', 'Новости'], ['matches', 'Матчи'], ['events', 'Турниры'], ['ranking', 'Рейтинг'], ['players', 'Игроки'], ['teams', 'Команды'], ['transfers', 'Трансферы'], ['stats', 'Статистика'], ['awards', 'Награды'], ['archive', 'Архив']];
const NAV_MORE = [['calendar', 'Календарь сезона'], ['predict', 'Прогнозы и опросы'], ['hof', 'Зал славы'], ['majors', 'Победители Major']];
const NAV_GAME = [['season', 'Сезон и карьера'], ['manage', 'Управление турнирами'], ['settings', 'Настройки и сохранения']];
const SECTION_OF = { article: 'news', match: 'matches', event: 'events', player: 'players', team: 'teams', calendar: 'events', hof: 'awards', majors: 'awards', manage: 'watch' };
function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'hs-root'; root.className = 'on portal';
  root.innerHTML = `
    <header class="pt-top"><div class="pt-top-in">
      <button type="button" class="pt-brand" data-nav="home" aria-label="Главная"><b>HLTV</b><span>CS2 Manager</span></button>
      <div class="hs-search">${ICON.search}<input id="hs-q" type="search" placeholder="Команда, игрок или турнир" autocomplete="off" aria-label="Поиск"><div id="hs-sugg" class="hs-sugg" role="listbox"></div></div>
      <div class="pt-season" id="pt-season"></div>
      <div class="pt-time" role="group" aria-label="Игровое время">
        <button type="button" class="pt-tbtn" id="pt-pause" data-time="pause" aria-label="Пауза">${ICON.pause}</button>
        <span class="pt-speed" role="radiogroup" aria-label="Скорость">${[1, 2, 5].map(s => `<button type="button" data-time="speed" data-v="${s}" role="radio">${s}x</button>`).join('')}</span>
        <button type="button" class="pt-tbtn wide" id="pt-skip" data-time="skip">${ICON.skip}<span id="pt-skip-l">День</span></button>
        <div class="pt-clock"><b id="pt-clock">--:--</b><small id="pt-date">—</small></div>
      </div>
    </div></header>
    <nav class="pt-nav" aria-label="Разделы портала"><div class="pt-nav-in">
      <div class="pt-tabs" role="tablist">${NAV_MAIN.map(([k, l]) => `<button type="button" class="hs-tab" data-nav="${k}">${l}</button>`).join('')}
        <div class="pt-dd"><button type="button" class="hs-tab pt-dd-btn" data-dd="more" aria-haspopup="true">Ещё ${ICON.chev}</button>
          <div class="pt-menu" data-menu="more">${NAV_MORE.map(([k, l]) => `<button type="button" data-nav="${k}">${l}</button>`).join('')}</div></div>
        <i class="pt-ink" aria-hidden="true"></i></div>
      <div class="pt-dd pt-game"><button type="button" class="pt-gamebtn" data-dd="game" aria-haspopup="true">${ICON.sim}<span>Игра</span>${ICON.chev}</button>
        <div class="pt-menu right" data-menu="game">${NAV_GAME.map(([k, l]) => `<button type="button" data-nav="${k}">${l}</button>`).join('')}</div></div>
    </div></nav>
    <main class="hs-body" id="hs-body"><div class="hs-page" id="hs-page"></div><div id="pt-game" class="pt-game-host" hidden></div></main>
    <div id="pt-stash" hidden></div>`;
  document.body.prepend(root);
  document.body.classList.add('portal-on');
  root.addEventListener('click', onClick);
  $('hs-q').addEventListener('input', onSearch);
  $('hs-q').addEventListener('keydown', e => { if (e.key === 'Enter') { const a = root.querySelector('#hs-sugg [data-go]'); if (a) a.click(); } if (e.key === 'Escape') { e.stopPropagation(); $('hs-q').value = ''; $('hs-sugg').classList.remove('on'); } });
  document.addEventListener('mousedown', e => { if (!e.target.closest('.pt-dd')) closeMenus(); if (!e.target.closest('.hs-search')) $('hs-sugg')?.classList.remove('on'); });
  return root;
}
function closeMenus() { root?.querySelectorAll('.pt-dd.open').forEach(d => d.classList.remove('open')); }
const enc = s => encodeURIComponent(String(s));
function routeOf(page, arg) { return '#/' + page + (arg != null && arg !== '' ? '/' + enc(arg) : ''); }
function parseHash() {
  const h = (location.hash || '').replace(/^#\/?/, ''); if (!h) return ['home', null];
  const i = h.indexOf('/'); const page = i < 0 ? h : h.slice(0, i), arg = i < 0 ? null : decodeURIComponent(h.slice(i + 1));
  return [page || 'home', arg];
}
function open(page, arg) { ensureRoot(); nav(page || S.page || 'home', arg); }
function close() { nav('home'); }   // совместимость со старым «закрыть сайт»
function nav(page, arg, noPush) {
  ensureRoot(); closeMenus();
  const r = routeOf(page, arg);
  if (!noPush && location.hash !== r) { S.hist.push([S.page, S.arg]); history.pushState(null, '', r); }
  else if (noPush && location.hash !== r && page !== 'home') history.replaceState(null, '', r);
  const same = S.page === page && S.arg === (arg ?? null);
  S.page = page; S.arg = arg ?? null;
  markNav();
  render();
  if (!same) window.scrollTo(0, 0);
}
function markNav() {
  const sec = SECTION_OF[S.page] || S.page;
  let onBtn = null;
  root.querySelectorAll('.pt-tabs > .hs-tab[data-nav]').forEach(b => { const on = b.dataset.nav === sec; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) onBtn = b; });
  const more = NAV_MORE.some(x => x[0] === S.page), game = NAV_GAME.some(x => x[0] === sec);
  root.querySelector('[data-dd="more"]')?.classList.toggle('on', more); if (more) onBtn = root.querySelector('[data-dd="more"]');
  root.querySelector('[data-dd="game"]')?.classList.toggle('on', game);
  const ink = root.querySelector('.pt-ink');
  if (ink) { if (onBtn) { ink.style.width = onBtn.offsetWidth - 20 + 'px'; ink.style.transform = `translateX(${onBtn.offsetLeft + 10}px)`; ink.style.opacity = 1; } else ink.style.opacity = 0; }
  document.body.classList.toggle('pt-sim', S.page === 'sim' || S.page === 'manage');
}
window.addEventListener('popstate', () => { const [p, a] = parseHash(); S.hist.pop(); nav(p, a, true); });
window.addEventListener('resize', () => { if (root) markNav(); });
window.hltvSiteOpen = open;
window.hltvSiteReset = () => { STATS = null; STATS_KEY = ''; ZP = null; ARCH_MS = null; ALL_MS = null; S.hist = []; S.cmp = null; if (root) render(); };
window.hltvSiteOpenPlayer = nick => { S.ptab = 'overview'; open('player', nick); };
window.hltvMiniTop = n => {
  const st = stats(), season = (typeof seasonState !== 'undefined' && seasonState?.currentSeason) || 1;
  const rows = Object.values(st.P).map(o => ({ o, l: o.bySeason[season] ? line(o.bySeason[season]) : null })).filter(x => x.l);
  const min = Math.max(3, Math.round(rows.reduce((m, x) => Math.max(m, x.l.maps), 0) * .25));
  return rows.filter(x => x.l.maps >= min).sort((a, b) => b.l.rating - a.l.rating).slice(0, n || 6).map(x => ({ nick: x.o.nick, team: x.o.team, rating: x.l.rating, maps: x.l.maps }));
};
window.hltvSiteOpenTeam = name => { S.ttab = 'overview'; open('team', name); };
window.hltvSiteClose = close;
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !root) return;
  if (document.querySelector('.modal-backdrop[style*="flex"], #dice-modal[style*="flex"]')) return;
  if ($('hs-sugg')?.classList.contains('on')) { $('hs-sugg').classList.remove('on'); return; }
  closeMenus();
}, true);

/* ------------------------------------------------------------------ рендер */
function render() {
  const pg = $('hs-page'); if (!pg) return;
  // узлы старого приложения, «смонтированные» в страницу, возвращаем в запас до перерисовки
  pg.querySelectorAll('[data-mounted]').forEach(n => $('pt-stash').appendChild(n));
  const fn = PAGES[S.page] || PAGES.home;
  let html = '';
  try { html = fn(S.arg); } catch (e) { console.warn('[portal]', S.page, e); html = `<div class="hs-empty">Не удалось показать страницу: ${esc(e.message)}</div>`; }
  pg.innerHTML = html;
  pg.classList.remove('hs-anim'); void pg.offsetWidth; pg.classList.add('hs-anim');
  AFTER.forEach(f => { try { f(S.page, S.arg, pg); } catch (e) { console.warn('[portal after]', e); } });
  sigLast = liveSig();
}
// мягкое обновление живых страниц: только если данные изменились и пользователь ничего не вводит
let sigLast = '';
function liveSig() {
  const ct = typeof currentTournament !== 'undefined' ? currentTournament : null;
  const b = ct?.broadcast;
  return [S.page, S.arg, ct?.name, ct?.completed, (b?.active || []).map(i => (i.state?.series1 || 0) + ':' + (i.state?.series2 || 0) + ':' + (i.state?.map1 || 0) + ':' + (i.state?.map2 || 0)).join(','),
    (b?.finished || []).length, (NW()?.all() || []).length, (typeof transferState !== 'undefined' ? (transferState.history || []).length : 0),
    ((typeof seasonState !== 'undefined' && seasonState.parallelSchedule) || []).filter(e => e.status === 'live' || e.status === 'completed').length,
    ((typeof seasonState !== 'undefined' && seasonState.parallelSchedule) || []).reduce((s, e) => s + ((e.br?.matches || []).filter(m => m.w).length), 0)].join('|');
}
const LIVE_PAGES = new Set(['home', 'matches', 'match', 'event', 'events', 'calendar', 'season', 'transfers', 'news', 'ranking']);
setInterval(() => {
  if (!root || !LIVE_PAGES.has(S.page) || document.hidden) return;
  const a = document.activeElement; if (a && root.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  if (root.querySelector('.pt-dd.open')) return;
  const s = liveSig(); if (s === sigLast) return;
  const y = window.scrollY; render(); window.scrollTo(0, y); $('hs-page').classList.remove('hs-anim');
}, 2500);
const box = (title, body, extra, cls) => `<section class="hs-box ${cls || ''}"><header class="hs-box-h"><h3>${title}</h3>${extra || ''}</header><div class="hs-box-b">${body}</div></section>`;
const back = () => S.hist.length ? `<button type="button" class="hs-back" data-back>← Назад</button>` : '';
const empty = t => `<div class="hs-empty">${t}</div>`;

function matchRow(m, focus) { // v30: одна строка — команда · счёт · команда · турнир · стадия
  const sa = m.s ? m.s[0] : (m.w === m.a ? 1 : 0), sb = m.s ? m.s[1] : (m.w === m.b ? 1 : 0);
  const bo = m.bo ? 'BO' + m.bo : m.mp.length === 1 ? 'BO1' : m.s ? 'BO' + (Math.max(sa, sb) * 2 - 1) : '';
  const one = m.mp.length === 1 && bo === 'BO1', ra = one ? m.mp[0][1] : sa, rb = one ? m.mp[0][2] : sb;
  return `<button type="button" class="mrow${focus ? ' focus' : ''}" data-match="${esc(m.id)}">
    <span class="mrow-t a ${m.w === m.a ? 'w' : 'l'}${focus === m.a ? ' f' : ''}">${esc(m.a)}${logo(m.a, 'sm')}</span>
    <span class="mrow-s"><b class="${m.w === m.a ? 'w' : 'l'}">${ra}</b><i>:</i><b class="${m.w === m.b ? 'w' : 'l'}">${rb}</b></span>
    <span class="mrow-t b ${m.w === m.b ? 'w' : 'l'}${focus === m.b ? ' f' : ''}">${logo(m.b, 'sm')}${esc(m.b)}</span>
    <span class="mrow-e"><span class="hs-kind k-${m.kind}">${KIND[m.kind] || ''}</span> ${esc(m.ev)}</span><span class="mrow-x hs-dim">${esc((m.stage || '').split(' · ').slice(-1)[0])} · ${bo}</span></button>`;
}
function calendarEvents() {
  const st = (typeof seasonState !== 'undefined' && seasonState) || {}, out = [], idx = Number(st.tournamentIndex) || 1;
  const act = typeof currentTournament !== 'undefined' && currentTournament && !currentTournament.completed;
  (st.seasonSchedule || []).forEach((e, i) => { if (!e || !e.calendar || !e.calendar.startMs) return;
    out.push({ name: e.name, tier: '1', kind: e.type === 'major' ? 'major' : e.type === 'elite' ? 'elite' : 'regular', startMs: e.calendar.startMs, endMs: e.calendar.endMs || e.calendar.startMs + 864e5,
      status: i < idx ? 'done' : (i === idx && act ? 'live' : 'scheduled'), format: e.format, season: st.currentSeason }); });
  (st.parallelSchedule || []).filter(e => e.season === st.currentSeason).forEach(e => out.push({ name: e.name, tier: e.kind === 'academy' ? 'academy' : e.tier,
    kind: e.kind === 'academy' ? 'academy' : (e.tier === '2' ? 'tier2' : 'tier3'), startMs: e.startMs, endMs: e.endMs || e.startMs + 864e5,
    status: e.status === 'completed' ? 'done' : (e.status === 'live' ? 'live' : 'scheduled'), format: e.format, season: e.season, pid: e.id }));
  return out.sort((a, b) => a.startMs - b.startMs);
}
const fdate = ms => { const d = new Date(ms); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }); };
const nowMs = () => Number(((typeof seasonState !== 'undefined' && seasonState) || {}).calendar?.currentMs) || Date.now();

/* ---- главная ---- */
function pHome() {
  const st = stats(), r = ranked();
  const topT = r.slice(0, 10).map((t, i) => {
    const d = (Number(t.seasonStartRank) || 0) ? t.seasonStartRank - (i + 1) : 0;
    return `<button type="button" class="hs-rk" data-team="${esc(t.name)}"><span class="n">${i + 1}</span>${logo(t.name, 'sm')}<span class="nm">${esc(t.name)}</span><span class="d ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '–'}</span></button>`;
  }).join('');
  const season = (typeof seasonState !== 'undefined' && seasonState?.currentSeason) || 1;
  const seasonRows = Object.values(st.P).map(o => ({ o, l: o.bySeason[season] ? line(o.bySeason[season]) : null })).filter(x => x.l);
  const minMaps = Math.max(3, Math.round(seasonRows.reduce((m, x) => Math.max(m, x.l.maps), 0) * .25)); // как в статистике: четверть от максимума карт
  const topP = seasonRows.filter(x => x.l.maps >= minMaps)
    .sort((a, b) => b.l.rating - a.l.rating).slice(0, 6)
    .map((x, i) => `<button type="button" class="hs-rk" data-player="${esc(x.o.nick)}"><span class="n">${i + 1}</span><span class="fl">${pFlag(x.o.p)}</span><span class="nm">${esc(x.o.nick)}<small>${esc(x.o.team)}</small></span><span class="rt ${ratingCls(x.l.rating)}">${f2(x.l.rating)}</span></button>`).join('');
  const fd = feed(), lead = fd.slice(0, 8).sort((x, y) => (y.imp || 0) - (x.imp || 0))[0];
  const nw = (lead ? topStory(lead) : '') + fd.filter(x => x !== lead).slice(0, 9).map(n => newsRow(n)).join('');
  const res = st.ms.slice(0, 10).map(m => matchRow(m)).join('');
  const now = nowMs(), evs = calendarEvents();
  const live = evs.filter(e => e.status === 'live'), soon = evs.filter(e => e.status === 'scheduled' && e.startMs > now).slice(0, 6);
  const evRow = e => `<div class="hs-evrow ${e.status}"><span class="hs-ev-tr">${trophy(e.name, e.season, e.kind)}</span><span class="hs-ev-nm"><b>${esc(e.name)}</b><small>${fdate(e.startMs)} – ${fdate(e.endMs)} · <span class="hs-kind k-${e.kind}">${KIND[e.kind]}</span></small></span>${e.status === 'live' ? '<span class="hs-live">LIVE</span>' : ''}</div>`;
  const ct = typeof currentTournament !== 'undefined' && currentTournament && !currentTournament.completed ? currentTournament : null;
  const hero = ct ? `<div class="hs-hero"><div class="hs-hero-tr">${trophy(ct.name, ct.season, ct.isMajor ? 'major' : ct.isElite ? 'elite' : 'regular')}</div>
      <div class="hs-hero-t"><span class="hs-live">LIVE</span><h2>${esc(ct.name)}</h2><p>${(ct.participants || []).length} команд · ${ct.isMajor ? 'Major' : ct.isElite ? 'S-Tier' : 'Tier-1'} · идёт сейчас</p>
      <button type="button" class="hs-btn" data-act="bracket">Смотреть сетку →</button></div></div>` : '';
  return `<div class="hs-grid3">
    <div class="hs-col">${box('Рейтинг команд', topT, '<button type="button" class="hs-more" data-nav="ranking">весь →</button>')}
      ${box('Игроки сезона', topP || empty('Статистика появится после первых сыгранных карт'), '<button type="button" class="hs-more" data-nav="stats">статистика →</button>')}</div>
    <div class="hs-col wide">${hero}${box('Новости', nw || empty('Новостей пока нет — сыграйте первый турнир'), '<button type="button" class="hs-more" data-nav="news">вся лента →</button>')}</div>
    <div class="hs-col">${predictMini()}${pollBox()}${box('Последние результаты', res || empty('Результатов пока нет'), '<button type="button" class="hs-more" data-nav="matches">все →</button>', 'tight')}
      ${box('События', (live.map(evRow).join('') + soon.map(evRow).join('')) || empty('Расписание пусто'), '<button type="button" class="hs-more" data-nav="events">все →</button>', 'tight')}</div>
  </div>`;
}

/* ---- v29: лента новостей, статья, прогнозы ---- */
const NW = () => window.V29News || null;
const NCATS = () => NW()?.CATS || { tournament: { l: 'Турниры', ic: '🏆' }, transfer: { l: 'Трансферы', ic: '⇄' } };
function legacyNews() { // турниры и трансферы из старых сейвов, сыгранные до появления ленты
  const out = [];
  Object.values(archive()).forEach(s => {
    if (!s || !s.champion || s.champion === '—') return;
    const second = (s.results || []).find(r => r.p === 2)?.n, low = ['tier2', 'tier3', 'academy'].includes(s.prestige);
    if (s.prestige === 'tier3') return;
    out.push({ id: 'L-' + s.id, legacy: true, ev: s.id, ts: (s.ts || 0) - 1e13, cat: s.prestige === 'major' ? 'major' : low ? 'tier2' : 'tournament', icon: '🏆',
      img: { name: s.name, season: s.season, kind: s.prestige }, title: `${s.champion} — чемпион ${s.name}`, lead: second ? `В финале обыграна ${second}.` : '',
      body: [`${KIND[s.prestige] || ''} · ${s.size || '?'} команд · сезон ${s.season}.`], tags: [{ t: 'team', v: s.champion }, ...(second ? [{ t: 'team', v: second }] : []), { t: 'event', v: s.id }],
      imp: s.prestige === 'major' ? 9 : low ? 2 : 5, team: s.champion, loser: second, season: s.season });
  });
  return out;
}
function feed() {
  const items = NW() ? NW().all().slice() : [];
  const covered = new Set(items.map(x => x.ev).filter(Boolean));
  return items.concat(legacyNews().filter(x => !covered.has(x.ev)).sort((a, b) => b.ts - a.ts));
}
const findNews = id => feed().find(x => x.id === id) || null;
const newsImg = (n, big) => n.img ? trophy(n.img.name, n.img.season, n.img.kind) : `<span class="hs-news-ic${big ? ' big' : ''}">${esc(n.icon || '★')}</span>`;
const ndate = ts => ts > 0 ? new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'архив';
function newsMeta(n) {
  const N = NW(); if (!N || n.legacy) return `<span>${ndate(n.ts)}</span>`;
  const rc = N.reacts(n), top = Object.entries(rc).sort((a, b) => b[1] - a[1])[0], cm = N.comments(n).length;
  return `<span>${N.ago(n.ts)}</span><span>💬 ${cm}</span>${top ? `<span>${top[0]} ${top[1]}</span>` : ''}${n.poll ? '<span class="hs-pollmark">🗳 опрос</span>' : ''}${n.confirmed ? '<span class="hs-ok">✓ подтвердилось</span>' : ''}`;
}
function newsRow(n) {
  const c = NCATS()[n.cat] || {};
  return `<article class="hs-news k-${esc(n.cat)}${n.imp >= 8 ? ' hot' : ''}" data-art="${esc(n.id)}" tabindex="0">
    <div class="hs-news-img">${newsImg(n)}</div>
    <div class="hs-news-t"><div class="hs-news-k"><span class="hs-ncat c-${esc(n.cat)}">${esc(c.l || '')}</span>${newsMeta(n)}</div><h4>${esc(n.title)}</h4><p>${esc(n.lead || '')}</p></div></article>`;
}
function topStory(n) {
  const c = NCATS()[n.cat] || {};
  return `<article class="hs-top-story k-${esc(n.cat)}" data-art="${esc(n.id)}" tabindex="0"><div class="hs-ts-img">${newsImg(n, true)}</div>
    <div class="hs-ts-t"><div class="hs-news-k"><span class="hs-ncat c-${esc(n.cat)}">${esc(c.l || '')}</span><span class="hs-ts-badge">Главное</span>${newsMeta(n)}</div><h2>${esc(n.title)}</h2><p>${esc(n.lead || '')}</p></div></article>`;
}
function tagChips(n) {
  return (n.tags || []).filter(t => t && t.v).map(t => t.t === 'team' ? `<button type="button" class="hs-chip static hs-tag" data-team="${esc(t.v)}">${logo(t.v, 'sm')} ${esc(t.v)}</button>`
    : t.t === 'player' ? `<button type="button" class="hs-chip static hs-tag" data-player="${esc(t.v)}">👤 ${esc(t.v)}</button>`
    : t.t === 'match' ? `<button type="button" class="hs-chip static hs-tag" data-match="${esc(t.v)}">Match Center</button>`
    : `<button type="button" class="hs-chip static hs-tag" data-event="${esc(t.v)}">Страница турнира</button>`).join('');
}
function pollHtml(n, compact) {
  const N = NW(); if (!N || !n?.poll) return '';
  const counts = N.pollCounts(n), total = Object.values(counts).reduce((a, b) => a + b, 0) || 1, my = N.myVote(n.id), done = !!n.poll.answer, show = !!my || done;
  const rows = n.poll.opts.map(o => { const pc = Math.round((counts[o] || 0) / total * 100), win = done && n.poll.answer === o;
    return show ? `<div class="hs-poll-r${my === o ? ' my' : ''}${win ? ' win' : ''}"><i style="width:${pc}%"></i><span>${o !== 'Другая команда' ? logo(o, 'sm') : ''}${esc(o)}${my === o ? ' · ваш голос' : ''}${win ? ' 🏆' : ''}</span><b>${pc}%</b></div>`
      : `<button type="button" class="hs-poll-o" data-vote="${esc(n.id)}|${esc(o)}">${o !== 'Другая команда' ? logo(o, 'sm') : ''}${esc(o)}</button>`; }).join('');
  const foot = done ? (my ? (my === n.poll.answer ? '<div class="hs-poll-f ok">Вы угадали! +25 очков прогнозиста</div>' : '<div class="hs-poll-f">В этот раз мимо — победили ' + esc(n.poll.answer) + '</div>') : '<div class="hs-poll-f">Опрос завершён</div>')
    : `<div class="hs-poll-f">${my ? 'Голос принят. Угадаете чемпиона — получите +25 очков.' : 'Проголосуйте — результат станет известен после мейджора.'} · ${total.toLocaleString('ru-RU')} голосов</div>`;
  return `<div class="hs-poll${compact ? ' compact' : ''}"><div class="hs-poll-q">🗳 ${esc(n.poll.q)}</div>${rows}${foot}</div>`;
}
function pollBox() { const n = NW()?.activePoll(); return n ? box('Опрос', pollHtml(n, true) + `<button type="button" class="hs-more hs-poll-more" data-art="${esc(n.id)}">читать превью →</button>`) : ''; }
function predictMini() {
  const N = NW(); if (!N) return '';
  const f = N.fan(), up = N.upcoming().filter(x => !x.live).slice(0, 3);
  const body = `<div class="hs-pm-me"><b>${esc(f.rank.name)}</b><span>${f.pts} очк. · ${f.won}/${f.won + f.lost} угадано</span></div>` + (up.length ? up.map(predCard).join('') : '<div class="hs-note">Сейчас нет матчей для прогноза — они появятся, когда сформируется сетка.</div>');
  return box('Ваши прогнозы', body, '<button type="button" class="hs-more" data-nav="predict">все →</button>', 'tight');
}
function predCard(x) {
  const btn = (t, c, p) => `<button type="button" class="hs-pc-t${x.pick === t ? ' on' : ''}" data-pred="${esc(x.k)}|${esc(t)}"${x.live ? ' disabled' : ''}>${logo(t, 'sm')}<span>${esc(t)}</span><small>${c ? c + 'x' : ''}${p != null ? ` · ${p}%` : ''}</small></button>`;
  return `<div class="hs-pc${x.live ? ' live' : ''}"><div class="hs-pc-h"><span>${esc(x.stage || '')} · ${x.bo}</span>${x.live ? '<span class="hs-live">LIVE</span>' : x.pick ? '<span class="hs-ok">прогноз принят</span>' : ''}</div><div class="hs-pc-b">${btn(x.t1, x.odds?.c1, x.odds?.pct1)}<i>vs</i>${btn(x.t2, x.odds?.c2, x.odds?.pct2)}</div></div>`;
}
S.news = { cat: 'all', view: 'feed', team: '' };
function pNews() {
  const f = S.news, fd = feed(), cats = NCATS();
  const used = ['all', ...Object.keys(cats).filter(k => fd.some(x => x.cat === k))];
  const chips = used.map(k => `<button type="button" class="hs-chip${f.cat === k ? ' on' : ''}" data-ncat="${k}">${k === 'all' ? 'Все' : esc((cats[k]?.ic || '') + ' ' + cats[k].l)}</button>`).join('');
  const views = [['feed', 'Лента'], ['transfers', 'Таблица трансферов']].map(([k, l]) => `<button type="button" class="hs-chip${f.view === k ? ' on' : ''}" data-nview="${k}">${l}</button>`).join('');
  if (f.view === 'transfers') {
    const list = (NW()?.transfers() || []).filter(x => !f.team || [x.team, x.from].includes(f.team));
    const tms = [...new Set((NW()?.transfers() || []).flatMap(x => [x.team, x.from]).filter(Boolean))].sort();
    const sel = `<select class="hs-inp sm" data-nteam><option value="">Все команды</option>${tms.map(t => `<option${f.team === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    const rows = list.map(x => `<tr data-art="${esc(x.id)}"><td class="l">${ndate(x.ts)}</td><td class="l"><button type="button" data-player="${esc(x.player)}"><b>${esc(x.player)}</b></button></td><td class="l"><button type="button" data-team="${esc(x.from)}">${logo(x.from, 'sm')} ${esc(x.from)}</button></td><td>→</td><td class="l"><button type="button" data-team="${esc(x.team)}">${logo(x.team, 'sm')} ${esc(x.team)}</button></td><td class="l hs-dim">${esc((x.lead || '').replace(/^.*Причина:\s*/, ''))}</td></tr>`).join('');
    return `<div class="hs-head"><h1>Новости</h1><div class="hs-filters">${views}</div></div><div class="hs-filters" style="margin-bottom:12px">${sel}<span class="hs-sub">${list.length} ${list.length === 1 ? 'переход' : 'переходов'}</span></div>
      ${rows ? `<div style="overflow:auto"><table class="hs-tbl hs-trtable"><thead><tr><th class="l">Дата</th><th class="l">Игрок</th><th class="l">Откуда</th><th></th><th class="l">Куда</th><th class="l">Причина</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('Переходов пока не было. Большое трансферное окно открывается после каждого мейджора.')}`;
  }
  const list = fd.filter(x => f.cat === 'all' || x.cat === f.cat);
  return `<div class="hs-head"><h1>Новости</h1><div class="hs-filters">${views}</div></div><div class="hs-filters hs-ncats">${chips}</div>
    <div class="hs-grid2"><div class="hs-col">${box(f.cat === 'all' ? 'Лента' : esc(cats[f.cat]?.l || ''), list.slice(0, 120).map(newsRow).join('') || empty('В этой рубрике пока пусто'))}</div>
    <div class="hs-col">${pollBox()}${predictMini()}</div></div>`;
}
function pArticle(id) {
  const n = findNews(id); if (!n) return back() + empty('Новость не найдена — возможно, она удалена из архива.');
  const N = NW(), c = NCATS()[n.cat] || {};
  const rc = N && !n.legacy ? N.reacts(n) : null, my = N?.myReact(n.id);
  const reacts = rc ? `<div class="hs-reacts">${(N.REACTS || []).map(e => `<button type="button" class="hs-react${my === e ? ' on' : ''}" data-react="${esc(n.id)}|${e}">${e}<b>${rc[e] || 0}</b></button>`).join('')}</div>` : '';
  const cms = N && !n.legacy ? N.comments(n) : [];
  const comments = N && !n.legacy ? `<section class="hs-box hs-cmts"><header class="hs-box-h"><h3>Комментарии · ${cms.length}</h3></header><div class="hs-box-b">
      <div class="hs-cform"><textarea id="hs-ctext" maxlength="400" rows="2" placeholder="Ваш комментарий… (Ctrl+Enter — отправить)"></textarea><button type="button" class="hs-btn" data-csend="${esc(n.id)}">Отправить</button></div>
      ${cms.map(x => `<div class="hs-cm${x.mine ? ' mine' : ''}"><div class="hs-cm-h"><b>${x.cc ? flag(x.cc) + ' ' : ''}${esc(x.nick)}</b><span>${x.mine ? 'только что' : x.mins < 60 ? x.mins + ' мин назад' : Math.floor(x.mins / 60) + ' ч назад'}</span></div><p>${esc(x.text)}</p>${x.mine ? '' : `<span class="hs-cm-l">▲ ${x.likes}</span>`}</div>`).join('')}</div></section>` : '';
  const more = feed().filter(x => x.id !== n.id).slice(0, 8).map(x => `<button type="button" class="hs-more-n" data-art="${esc(x.id)}"><span>${esc(x.icon || '★')}</span><b>${esc(x.title)}</b></button>`).join('');
  const tm = (n.tags || []).find(t => t.t === 'team' && teamBy(t.v)), tt = tm ? teamBy(tm.v) : null, rk = tt ? ranked().indexOf(tt) + 1 : 0;
  const teamCard = tt ? box('Команда', `<button type="button" class="hs-artteam" data-team="${esc(tt.name)}">${logo(tt.name)}<span><b>${esc(tt.name)}</b><small>#${rk} в мире · ${tt.pts} очков</small><small>${(tt.players || []).slice(0, 5).map(p => esc(p.nick)).join(' · ')}</small></span></button>`) : '';
  return `${back()}<div class="hs-grid2"><div class="hs-col"><article class="hs-box hs-article"><div class="hs-art-in">
      <div class="hs-news-k"><span class="hs-ncat c-${esc(n.cat)}">${esc((c.ic || '') + ' ' + (c.l || ''))}</span><span>${ndate(n.ts)}</span>${n.confirmed ? '<span class="hs-ok">✓ слух подтвердился</span>' : ''}</div>
      <h1>${esc(n.title)}</h1>${n.img ? `<div class="hs-art-img">${newsImg(n, true)}</div>` : ''}
      <p class="hs-art-lead">${esc(n.lead || '')}</p>${(n.body || []).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}
      ${pollHtml(n)}<div class="hs-art-tags">${tagChips(n)}</div>${reacts}</div></article>${comments}</div>
    <div class="hs-col">${teamCard}${box('Ещё новости', more || empty('—'), '<button type="button" class="hs-more" data-nav="news">лента →</button>', 'tight')}</div></div>`;
}
function pPredict() {
  const N = NW(); if (!N) return empty('Модуль прогнозов не загружен');
  const f = N.fan(), r = f.rank, prog = r.next ? Math.round((f.pts - r.from) / Math.max(1, r.to - r.from) * 100) : 100, acc = f.won + f.lost ? Math.round(f.won / (f.won + f.lost) * 100) : 0;
  const up = N.upcoming();
  const prof = `<div class="hs-fan"><div class="hs-fan-r"><small>Ваше звание</small><b>${esc(r.name)}</b><div class="hs-fan-bar"><i style="width:${prog}%"></i></div><small>${r.next ? `до «${esc(r.next)}» — ${r.need} очк.` : 'максимальное звание'}</small></div>
    <div class="hs-fan-s"><b>${f.pts}</b><small>очков</small></div><div class="hs-fan-s"><b>${acc}%</b><small>точность (${f.won}/${f.won + f.lost})</small></div><div class="hs-fan-s"><b>${f.streak}</b><small>серия · рекорд ${f.best}</small></div><div class="hs-fan-s"><b>${f.pollWins}</b><small>угадано опросов</small></div></div>`;
  const hist = f.preds.slice(0, 30).map(p => `<div class="hs-ph ${p.st}"><span class="st">${p.st === 'won' ? '✓' : p.st === 'lost' ? '✕' : p.st === 'void' ? '—' : '…'}</span><span class="m">${esc(p.t1)} vs ${esc(p.t2)}<small>${esc(p.ev)}</small></span><span class="p">${esc(p.pick)} · ${Number(p.c || 0).toFixed(2)}x</span><b>${p.st === 'won' ? '+' + (p.g || 0) : p.st === 'open' ? 'ждём' : p.st === 'void' ? 'отменён' : '0'}</b></div>`).join('');
  return `<div class="hs-head"><h1>Прогнозы</h1><div class="hs-sub">Угадывайте победителей матчей: верный прогноз приносит очки = 10 × коэффициент. Матч в эфире закрыт для прогнозов.</div></div>${prof}
    <div class="hs-grid2"><div class="hs-col">${box('Матчи для прогноза', up.length ? `<div class="hs-pcgrid">${up.map(predCard).join('')}</div>` : empty('Сейчас нет открытых матчей. Сгенерируйте следующий турнир — и возвращайтесь.'))}</div>
    <div class="hs-col">${pollBox()}${box('История прогнозов', hist || empty('Вы ещё не сделали ни одного прогноза'), '', 'tight')}</div></div>`;
}

/* ---- матчи ---- */
function pMatches() {
  const f = S.matches, q = f.q.trim().toLowerCase();
  let ms = stats().ms.filter(m => f.kind === 'all' || (f.kind === 't1' ? ['major', 'elite', 'regular'].includes(m.kind) : f.kind === 'major' ? m.kind === 'major' : ['tier2', 'tier3', 'academy'].includes(m.kind)));
  if (q) ms = ms.filter(m => (m.a + ' ' + m.b + ' ' + m.ev).toLowerCase().includes(q));
  const groups = []; let cur = null;
  ms.slice(0, 300).forEach(m => { if (!cur || cur.id !== m.evId) { cur = { id: m.evId, ev: m.ev, kind: m.kind, season: m.season, list: [] }; groups.push(cur); } cur.list.push(m); });
  const chips = [['all', 'Все'], ['major', 'Major'], ['t1', 'Tier-1'], ['low', 'Tier-2/3 и академии']].map(([k, l]) => `<button type="button" class="hs-chip${f.kind === k ? ' on' : ''}" data-mkind="${k}">${l}</button>`).join('');
  const body = groups.map(g => `<div class="hs-mgroup"><div class="hs-mgroup-h"><span class="hs-ev-tr sm">${trophy(g.ev, g.season, g.kind)}</span><b>${esc(g.ev)}</b><span class="hs-kind k-${g.kind}">${KIND[g.kind]}</span><button type="button" class="hs-more" data-event="${esc(g.id)}">сетка →</button></div>${g.list.map(m => matchRow(m)).join('')}</div>`).join('');
  return `<div class="hs-head"><h1>Результаты</h1><div class="hs-filters">${chips}<input type="text" class="hs-inp" id="hs-mq" placeholder="Фильтр: команда или турнир" value="${esc(f.q)}"></div></div>
    ${body || empty('Сыгранных матчей в архиве пока нет. Архив пополняется после каждого завершённого турнира.')}`;
}
/* ---- события ---- */
function pEvents() {
  const tab = S.events.tab, now = nowMs(), evs = calendarEvents(), arch = archive();
  const tabs = [['live', 'Идут и скоро'], ['done', 'Завершённые']].map(([k, l]) => `<button type="button" class="hs-chip${tab === k ? ' on' : ''}" data-etab="${k}">${l}</button>`).join('');
  let body = '';
  if (tab === 'live') {
    const list = evs.filter(e => e.status === 'live' || (e.status === 'scheduled' && e.endMs > now));
    body = list.map(e => `<div class="hs-evcard ${e.status}"><div class="hs-evcard-tr">${trophy(e.name, e.season, e.kind)}</div><div class="hs-evcard-t">${e.status === 'live' ? '<span class="hs-live">LIVE</span>' : ''}<b>${esc(e.name)}</b>
      <small>${fdate(e.startMs)} – ${fdate(e.endMs)}</small><span class="hs-kind k-${e.kind}">${KIND[e.kind]}</span>${e.format ? `<small>${esc(e.format)}</small>` : ''}</div></div>`).join('');
  } else {
    body = Object.values(arch).filter(s => s && s.name).sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(s => `<button type="button" class="hs-evcard done" data-event="${esc(s.id)}"><div class="hs-evcard-tr">${trophy(s.name, s.season, s.prestige)}</div>
      <div class="hs-evcard-t"><b>${esc(s.name)}</b><small>Сезон ${s.season} (${s.year || yearOf(s.season)}) · ${s.size || '?'} команд</small><span class="hs-kind k-${s.prestige}">${KIND[s.prestige] || ''}</span>
      <span class="hs-evwin">${logo(s.champion, 'sm')} ${esc(s.champion)}</span></div></button>`).join('');
  }
  return `<div class="hs-head"><h1>События</h1><div class="hs-filters">${tabs}</div></div><div class="hs-evgrid">${body || empty(tab === 'live' ? 'Расписание пусто' : 'Завершённых турниров в архиве пока нет')}</div>`;
}

/* ---- статистика ---- */
const COLS_P = [['nick', 'Игрок', 'l'], ['maps', 'Карт'], ['R', 'Раунды'], ['diff', 'K-D'], ['kd', 'K/D'], ['adr', 'ADR'], ['kast', 'KAST'], ['hs', 'HS%'], ['kpr', 'KPR'], ['rating', 'Rating 2.0']];
function pStats() {
  const f = S.stats, st = stats();
  const seasons = [...new Set(st.ms.map(m => m.season))].sort((a, b) => b - a);
  const sel = `<select class="hs-inp sm" data-sf="season"><option value="all">Все сезоны</option>${seasons.map(s => `<option value="${s}"${String(f.season) === String(s) ? ' selected' : ''}>Сезон ${s} (${yearOf(s)})</option>`).join('')}</select>
    <select class="hs-inp sm" data-sf="tier">${[['all', 'Все турниры'], ['major', 'Только Major'], ['t1', 'Tier-1 и выше'], ['low', 'Tier-2/3, академии']].map(([k, l]) => `<option value="${k}"${f.tier === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const tabs = [['players', 'Игроки'], ['teams', 'Команды'], ['maps', 'Карты']].map(([k, l]) => `<button type="button" class="hs-chip${f.tab === k ? ' on' : ''}" data-stab="${k}">${l}</button>`).join('');
  let body = '';
  if (f.tab === 'players') {
    let rows = Object.values(st.P).map(o => ({ o, l: filtered(o, f) })).filter(x => x.l && x.l.maps > 0);
    const min = f.min || Math.max(1, Math.round((rows.reduce((m, x) => Math.max(m, x.l.maps), 0)) * .25));
    rows = rows.filter(x => x.l.maps >= min);
    const key = f.sort, dir = f.dir < 0 ? -1 : 1; // -1 — по убыванию
    rows.sort((a, b) => key === 'nick' ? dir * a.o.nick.localeCompare(b.o.nick) : dir * ((a.l[key] ?? 0) - (b.l[key] ?? 0)));
    const th = COLS_P.map(([k, l, c]) => `<th class="${c || ''}${f.sort === k ? ' on' : ''}"><button type="button" data-sort="${k}">${l}${f.sort === k ? (f.dir < 0 ? ' ▼' : ' ▲') : ''}</button></th>`).join('');
    body = rows.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th>#</th>${th}</tr></thead><tbody>${rows.slice(0, 200).map((x, i) => `<tr data-player="${esc(x.o.nick)}">
      <td class="n">${i + 1}</td><td class="l"><span class="fl">${pFlag(x.o.p)}</span><b>${esc(x.o.nick)}</b><small>${esc(x.o.team)}</small></td><td>${x.l.maps}</td><td>${x.l.R}</td>
      <td class="${x.l.diff >= 0 ? 'up' : 'dn'}">${x.l.diff > 0 ? '+' : ''}${x.l.diff}</td><td>${f2(x.l.kd)}</td><td>${f1(x.l.adr)}</td><td>${f1(x.l.kast)}%</td><td>${f1(x.l.hs)}%</td><td>${f2(x.l.kpr)}</td>
      <td><b class="hs-rt ${ratingCls(x.l.rating)}">${f2(x.l.rating)}</b></td></tr>`).join('')}</tbody></table>
      <p class="hs-note">Минимум карт: ${min}. Rating 2.0 — внутренняя метрика игры (не HLTV Rating 2.0): K/D, ADR, KAST и импакт по сыгранным картам. Формула — в «Рейтинг → Игроки». Нажмите на заголовок столбца — сортировка.</p>` : empty('Пока нет сыгранных карт в архиве.');
  } else if (f.tab === 'teams') {
    const rows = Object.values(st.T).filter(t => t.maps > 0).sort((a, b) => (b.mw / b.maps) - (a.mw / a.maps));
    body = rows.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th>#</th><th class="l">Команда</th><th>Матчи</th><th>W-L</th><th>Карт</th><th>Winrate карт</th><th>Раунды +/-</th><th class="l">Лучшая карта</th><th class="l">Форма</th></tr></thead><tbody>${rows.map((t, i) => {
      const best = Object.entries(t.byMap).filter(([, v]) => v.n >= 2).sort((a, b) => (b[1].w / b[1].n) - (a[1].w / a[1].n))[0];
      const wr = t.mw / t.maps * 100;
      return `<tr data-team="${esc(t.name)}"><td class="n">${i + 1}</td><td class="l">${logo(t.name, 'sm')}<b>${esc(t.name)}</b></td><td>${t.matches}</td><td>${t.matchW}-${t.matches - t.matchW}</td><td>${t.maps}</td>
        <td><span class="hs-bar"><i style="width:${wr.toFixed(0)}%"></i></span>${f1(wr)}%</td><td class="${t.rw - t.rl >= 0 ? 'up' : 'dn'}">${t.rw - t.rl > 0 ? '+' : ''}${t.rw - t.rl}</td>
        <td class="l">${best ? `${esc(best[0])} <small>${Math.round(best[1].w / best[1].n * 100)}%</small>` : '—'}</td><td class="l"><span class="hs-form">${t.form.map(r => `<i class="${r}">${r}</i>`).join('')}</span></td></tr>`;
    }).join('')}</tbody></table>` : empty('Пока нет сыгранных карт в архиве.');
  } else {
    const rows = Object.values(st.M).sort((a, b) => b.n - a.n), total = rows.reduce((s, x) => s + x.n, 0) || 1;
    body = rows.length ? `<div class="hs-mapgrid">${rows.map(x => `<div class="hs-mapstat"><div class="hs-mapstat-h"><b>${esc(x.map)}</b><span>${x.n} карт</span></div>
      <div class="hs-bar big"><i style="width:${(x.n / total * 100).toFixed(1)}%"></i></div>
      <dl><div><dt>Доля пиков</dt><dd>${f1(x.n / total * 100)}%</dd></div><div><dt>Раундов в среднем</dt><dd>${f1(x.rounds / x.n)}</dd></div>
      <div><dt>Овертаймы</dt><dd>${f1(x.ot / x.n * 100)}%</dd></div><div><dt>Близкие (≤3)</dt><dd>${f1(x.close / x.n * 100)}%</dd></div></dl></div>`).join('')}</div>` : empty('Пока нет сыгранных карт в архиве.');
  }
  return `<div class="hs-head"><h1>Статистика</h1><div class="hs-filters">${tabs}<span class="hs-gap"></span>${f.tab === 'maps' ? '' : sel}</div></div>${body}`;
}

/* ---- рейтинг ---- */
function pRanking() {
  const r = ranked(), max = Math.max(1, ...r.map(t => t.pts || 0));
  return `<div class="hs-head"><h1>Рейтинг команд</h1><div class="hs-filters"><span class="hs-sub">Обновляется после каждого турнира · сезон ${(typeof seasonState !== 'undefined' && seasonState?.currentSeason) || 1}</span></div></div>
    <div class="hs-ranklist">${r.map((t, i) => {
      ensure(t); const d = (Number(t.seasonStartRank) || 0) ? t.seasonStartRank - (i + 1) : 0;
      return `<div class="hs-rankrow${i < 3 ? ' top' + (i + 1) : ''}" data-team="${esc(t.name)}"><span class="hs-rnum">#${i + 1}</span>${logo(t.name, 'lg')}
        <div class="hs-rmain"><b>${esc(t.name)}</b><span class="hs-roster">${(t.players || []).map(p => `<button type="button" class="hs-plink" data-player="${esc(p.nick)}">${pFlag(p)} ${esc(p.nick)}</button>`).join('')}</span></div>
        <div class="hs-rpts"><b>${Math.round(t.pts || 0)}</b><small>очков</small><span class="hs-bar"><i style="width:${((t.pts || 0) / max * 100).toFixed(0)}%"></i></span></div>
        <span class="hs-rd ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d > 0 ? '▲ ' + d : d < 0 ? '▼ ' + (-d) : '—'}</span></div>`;
    }).join('')}</div>`;
}

/* ---- награды ---- */
function pAwards() {
  const A = awards(), years = {};
  Object.entries(A).forEach(([nick, rec]) => {
    (rec.top || []).forEach(x => { (years[x.y] || (years[x.y] = { top: [], aw: [] })).top.push({ nick, r: x.r, team: x.team }); });
    (rec.aw || []).forEach(x => { (years[x.y] || (years[x.y] = { top: [], aw: [] })).aw.push({ nick, type: x.type, team: x.team }); });
  });
  const ys = Object.keys(years).sort((a, b) => b - a);
  const y = S.awYear && years[S.awYear] ? S.awYear : ys[0];
  const team = id => { for (const t of TEAMS()) { const p = (t.players || []).find(x => x.nick === id); if (p) return p; } return null; };
  const hof = ((typeof seasonState !== 'undefined' && seasonState?.hallOfFame) || []).map(h => `<div class="hs-hof"><span class="hs-ev-tr">${window.TW ? window.TW.awardSvg('team', h.year || yearOf(h.season)) : ''}</span><span><b>${esc(h.champion)}</b><small>Команда сезона ${h.season} · ${h.year || yearOf(h.season)}</small></span></div>`).join('');
  const mvps = Object.entries(A).map(([nick, r]) => ({ nick, n: (r.mvp || []).length, maj: (r.mvp || []).filter(x => x.k === 'major').length })).filter(x => x.n).sort((a, b) => b.n - a.n || b.maj - a.maj).slice(0, 12);
  const mvpHtml = mvps.map((x, i) => `<button type="button" class="hs-rk" data-player="${esc(x.nick)}"><span class="n">${i + 1}</span><span class="fl">${pFlag(team(x.nick))}</span><span class="nm">${esc(x.nick)}</span><span class="rt">${x.n}<small> MVP</small></span></button>`).join('');
  let yearBody = empty('Награды года вручаются в конце сезона — топ-20 игроков, игрок года, лучшие рифлер, снайпер, капитан и новичок.');
  if (y) {
    const Y = years[y];
    const aw = ['poty', 'rifler', 'awper', 'igl', 'entry', 'clutch', 'support', 'breakout', 'rookie', 'coach'].map(k => { const x = Y.aw.find(a => a.type === k); return x ? `<button type="button" class="hs-awcard" ${k === 'coach' ? `data-team="${esc(x.team || '')}"` : `data-player="${esc(x.nick)}"`}><span class="hs-awimg">${window.TW ? window.TW.awardSvg(k, +y) : ''}</span><small>${esc(window.TW?.AWARD_DEF?.[k]?.title || k)}</small><b>${pFlag(team(x.nick))} ${esc(x.nick)}</b><em>${esc(x.team || '')}</em></button>` : ''; }).join('');
    const top = Y.top.sort((a, b) => a.r - b.r).map(x => `<button type="button" class="hs-top20" data-player="${esc(x.nick)}"><span class="hs-t20img">${window.TW ? window.TW.top20Svg(x.r) : '#' + x.r}</span><b>${pFlag(team(x.nick))} ${esc(x.nick)}</b><small>${esc(x.team || '')}</small></button>`).join('');
    yearBody = `<div class="hs-awrow">${aw}</div><h3 class="hs-h3">Топ-20 игроков ${y} года</h3><div class="hs-t20grid">${top}</div>`;
  }
  const ychips = ys.map(k => `<button type="button" class="hs-chip${String(k) === String(y) ? ' on' : ''}" data-awyear="${k}">${k}</button>`).join('');
  return `<div class="hs-head"><h1>Награды</h1><div class="hs-filters">${ychips}</div></div>
    <div class="hs-grid2"><div>${yearBody}</div><div>${box('Зал славы', hof || empty('Сезоны ещё не завершены'))}${box('Больше всего MVP', mvpHtml || empty('MVP вручаются победителям турниров'))}</div></div>`;
}

/* ---- графики ---- */
const pct = v => clamp(Math.round(v), 0, 100);
function radar(sets, labels) { // sets: [{vals:[0..100], cls}] — до двух игроков поверх
  const N = labels.length, cx = 150, cy = 132, R = 96, ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v / 100, cy + Math.sin(ang(i)) * R * v / 100];
  let g = '';
  [25, 50, 75, 100].forEach(v => { g += `<polygon class="rg" points="${labels.map((_, i) => pt(i, v).map(n2).join(',')).join(' ')}"/>`; });
  labels.forEach((l, i) => { const [x, y] = pt(i, 100), [lx, ly] = pt(i, 122); g += `<line class="ra" x1="${cx}" y1="${cy}" x2="${n2(x)}" y2="${n2(y)}"/><text x="${n2(lx)}" y="${n2(ly)}" class="rl">${esc(l)}</text>`; });
  sets.forEach(s => {
    g += `<polygon class="rp ${s.cls || ''}" points="${s.vals.map((v, i) => pt(i, v).map(n2).join(',')).join(' ')}"/>`;
    s.vals.forEach((v, i) => { const [x, y] = pt(i, v); g += `<circle class="rd ${s.cls || ''}" cx="${n2(x)}" cy="${n2(y)}" r="4" data-tip="${esc(labels[i])}: ${v}${s.name ? ' · ' + esc(s.name) : ''}"/>`; });
  });
  return `<svg class="hs-radar" viewBox="-34 0 368 270" role="img" aria-label="Атрибуты игрока">${g}</svg>`;
}
const n2 = v => Math.round(v * 10) / 10;
function ratingChart(list) { // list — матчи от старых к новым: {v, tip, id}
  if (!list.length) return empty('Матчей пока нет');
  const W = 640, H = 200, pl = 34, pr = 12, pt = 14, pb = 14, lo = Math.min(.85, ...list.map(x => x.v)) - .12, hi = Math.max(1.15, ...list.map(x => x.v)) + .1;
  const X = i => pl + (list.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (list.length - 1)), Y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
  const pts = list.map((x, i) => [X(i), Y(x.v)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + n2(p[0]) + ' ' + n2(p[1])).join('');
  const area = path + `L${n2(pts[pts.length - 1][0])} ${H - pb}L${n2(pts[0][0])} ${H - pb}Z`;
  let grid = '';
  [.4, .6, .8, 1, 1.2, 1.4, 1.6, 1.8].filter(v => v > lo && v < hi).forEach(v => { grid += `<line class="cg${v === 1 ? ' one' : ''}" x1="${pl}" x2="${W - pr}" y1="${n2(Y(v))}" y2="${n2(Y(v))}"/><text class="cy" x="${pl - 6}" y="${n2(Y(v) + 3)}">${v.toFixed(1)}</text>`; });
  const avg = list.reduce((a, x) => a + x.v, 0) / list.length;
  return `<svg class="hs-chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="hsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a1f" stop-opacity=".35"/><stop offset="1" stop-color="#ff8a1f" stop-opacity="0"/></linearGradient></defs>
    ${grid}<line class="cavg" x1="${pl}" x2="${W - pr}" y1="${n2(Y(avg))}" y2="${n2(Y(avg))}"/><path class="carea" d="${area}"/><path class="cline" d="${path}"/>
    ${pts.map((p, i) => `<circle class="cdot ${list[i].v >= 1 ? 'up' : 'dn'}" cx="${n2(p[0])}" cy="${n2(p[1])}" r="4.5" data-tip="${esc(list[i].tip)}" data-match="${esc(list[i].id)}"/>`).join('')}</svg>
    <div class="hs-chart-leg"><span><i class="l1"></i>рейтинг за матч</span><span><i class="l2"></i>средний ${f2(avg)}</span><span><i class="l3"></i>1.00</span></div>`;
}
function attrsOf(o) { // 8 атрибутов (0–100) в духе HLTV: из статистики и уровня игрока
  const L = line(o.all), p = o.p || {}, role = p.role || 'Rifler';
  const rs = o.matches.map(m => m.z.R ? m.z.rt / m.z.R : 1), mean = rs.reduce((a, b) => a + b, 0) / Math.max(1, rs.length);
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, rs.length));
  return [
    pct(((L.kpr - .5) / .42) * 60 + (+p.firepower || 70) * .45 - 5),
    pct(((L.okpr - .05) / .1) * 100),
    pct((L.apr / .2) * 75 + (+p.utility || 70) * .25),
    pct((L.clA ? L.clW / L.clA / .45 * 55 : 25) + (+p.clutch || 70) * .45),
    pct(role === 'AWPer' ? 50 + (+p.firepower || 70) * .5 : 8 + (+p.firepower || 70) * .14),
    pct(+p.utility || 60),
    pct(rs.length > 2 ? 100 - sd * 190 : 50),
    pct(+p.tacticalIQ || 60)
  ];
}
const ATTR_L = ['Огневая мощь', 'Открытие', 'Поддержка', 'Клатчи', 'Снайпинг', 'Утилити', 'Стабильность', 'Тактика'];

/* ---- матч ---- */
function pMatch(id) {
  const st = stats(), m = st.ms.find(x => x.id === id); if (!m) return back() + empty('Матч не найден в архиве.');
  const ta = teamBy(m.a), tb = teamBy(m.b), sa = m.s ? m.s[0] : '', sb = m.s ? m.s[1] : '';
  const rA = rosterOf(m, m.a), rB = rosterOf(m, m.b);
  const maps = m.mp.map((mp, i) => ({ i, map: mp[0], s1: +mp[1], s2: +mp[2], L: rA.length && rB.length ? mapLines(m.id, i, mp[0], +mp[1], +mp[2], m.a, m.b, rA, rB) : null })).filter(x => x.s1 + x.s2 > 0);
  const tab = S.matchTab ?? 'all';
  const sum = arr => { const by = {};
    arr.forEach(x => { const o = by[x.nick] || (by[x.nick] = { ...x, k: 0, d: 0, a: 0, R: 0, dmgR: 0, kastR: 0, rtR: 0, hsk: 0, ok_: 0, od: 0 }); o.k += x.k; o.d += x.d; o.a += x.a; o.R += x.R; o.dmgR += x.adr * x.R; o.kastR += x.kast * x.R; o.rtR += x.rating * x.R; o.hsk += x.hsk; o.ok_ += x.ok_; o.od += x.od; });
    return Object.values(by).map(o => ({ ...o, adr: o.dmgR / o.R, kast: o.kastR / o.R, rating: o.rtR / o.R })); };
  const linesFor = side => tab === 'all' ? sum(maps.flatMap(x => x.L ? x.L[side] : [])) : (maps.find(x => String(x.i) === String(tab))?.L?.[side] || []);
  const all = linesFor('A').concat(linesFor('B')), mvp = all.reduce((b, x) => !b || x.rating > b.rating ? x : b, null);
  const table = (name, rows) => `<table class="hs-tbl hs-sb"><thead><tr><th class="l">${logo(name, 'sm')} ${esc(name)}</th><th>K-D</th><th>+/-</th><th>ADR</th><th>KAST</th><th>Откр.</th><th>Rating 2.0</th></tr></thead><tbody>` +
    rows.sort((a, b) => b.rating - a.rating).map(x => `<tr${mvp && x.nick === mvp.nick ? ' class="mvp"' : ''}><td class="l"><button type="button" class="hs-plink" data-player="${esc(x.nick)}">${pFlag(playerNow(x.nick)?.p || x.p)} ${esc(x.nick)}</button>${mvp && x.nick === mvp.nick ? '<span class="hs-mvp" title="Лучший игрок матча">MVP</span>' : ''}</td><td>${x.k}-${x.d}</td><td class="${x.k - x.d >= 0 ? 'up' : 'dn'}">${x.k - x.d > 0 ? '+' : ''}${x.k - x.d}</td><td>${f1(x.adr)}</td><td>${f1(x.kast)}%</td><td>${x.ok_}:${x.od}</td><td><b class="${ratingCls(x.rating)}">${f2(x.rating)}</b></td></tr>`).join('') + '</tbody></table>';
  const tabs = maps.length ? `<div class="hs-subtabs">${['all', ...maps.map(x => String(x.i))].map(k => `<button type="button" class="hs-chip${String(tab) === k ? ' on' : ''}" data-mtab="${k}">${k === 'all' ? 'Все карты' : esc(maps.find(x => String(x.i) === k).map)}</button>`).join('')}</div>` : '';
  const prev = st.ms.filter(x => x.id !== m.id && ((x.a === m.a && x.b === m.b) || (x.a === m.b && x.b === m.a)));
  const hw = prev.filter(x => x.w === m.a).length, hl = prev.length - hw;
  const mvpCard = mvp ? `<div class="hs-mvpcard"><span class="hs-mvp-l">Лучший игрок ${tab === 'all' ? 'матча' : 'карты'}</span><button type="button" class="hs-mvp-n" data-player="${esc(mvp.nick)}">${pFlag(playerNow(mvp.nick)?.p || mvp.p)} ${esc(mvp.nick)}</button>
      <span class="hs-mvp-t">${logo(mvp.team, 'sm')} ${esc(mvp.team)}</span><span class="hs-mvp-s"><b class="${ratingCls(mvp.rating)}">${f2(mvp.rating)}</b> Rating 2.0 · ${mvp.k}-${mvp.d} · ${f1(mvp.adr)} ADR</span></div>` : '';
  return `${back()}<div class="hs-mhead">
      <button type="button" class="hs-mteam" data-team="${esc(m.a)}">${logo(m.a, 'xl')}<b>${esc(m.a)}</b><small>${ta ? '#' + (ranked().indexOf(ta) + 1) + ' в рейтинге' : ''}</small></button>
      <div class="hs-mscore"><div class="hs-mev">${esc(m.ev)}</div><div class="hs-msc"><b class="${m.w === m.a ? 'w' : 'l'}">${sa}</b><i>:</i><b class="${m.w === m.b ? 'w' : 'l'}">${sb}</b></div>
        <div class="hs-mstage">${esc(m.stage)} · сезон ${m.season} (${m.year})</div><button type="button" class="hs-more" data-event="${esc(m.evId)}">сетка турнира →</button></div>
      <button type="button" class="hs-mteam" data-team="${esc(m.b)}">${logo(m.b, 'xl')}<b>${esc(m.b)}</b><small>${tb ? '#' + (ranked().indexOf(tb) + 1) + ' в рейтинге' : ''}</small></button></div>
    <div class="hs-maps">${maps.map(x => `<button type="button" class="hs-mapcard ${x.s1 > x.s2 ? 'wa' : 'wb'}${String(tab) === String(x.i) ? ' on' : ''}" data-mtab="${x.i}"><span class="hs-mapname">${esc(x.map)}</span><span class="hs-mapsc"><b class="${x.s1 > x.s2 ? 'w' : 'l'}">${x.s1}</b> : <b class="${x.s2 > x.s1 ? 'w' : 'l'}">${x.s2}</b></span></button>`).join('') || empty('Счёт по картам не сохранён')}</div>
    ${mvpCard}
    ${maps.length && rA.length && rB.length ? `${tabs}<div class="hs-sbwrap">${table(m.a, linesFor('A'))}${table(m.b, linesFor('B'))}</div>` : ''}
    ${box('Личные встречи', prev.length ? `<div class="hs-h2h"><span>${logo(m.a, 'lg')}<b>${hw}</b></span><span class="hs-h2h-mid">${prev.length} матч(ей) раньше</span><span><b>${hl}</b>${logo(m.b, 'lg')}</span></div>${prev.slice(0, 5).map(x => matchRow(x)).join('')}` : empty('Раньше эти команды не встречались'), '', 'tight')}
    <p class="hs-note">Статистика рассчитана по счёту карт и уровню игроков${m.rost ? ' (составы на момент турнира)' : ' (текущие составы — турнир сыгран до записи составов)'}.</p>`;
}

/* ---- игрок ---- */
const PTABS = [['overview', 'Обзор'], ['stats', 'Статистика'], ['maps', 'Карты'], ['matches', 'Матчи'], ['events', 'Турниры'], ['awards', 'Достижения'], ['career', 'Карьера'], ['compare', 'Сравнить']];
function achItems(nick) { // list — элементы с годом (для сортировки по времени); html — в прежнем порядке
  const rec = awards()[nick] || { mvp: [], ti: [], top: [], aw: [] }, list = [];
  if (!window.TW) return { rec, html: '', list };
  // одна медаль MVP со счётчиком; в подсказке — все турниры (свежие сверху)
  if (rec.mvp.length) list.push({ lead: true, html: `<span class="hs-achi mvp" data-tip="${esc(`MVP турниров: ${rec.mvp.length}\n` + rec.mvp.slice(0, 14).map(x => `• ${x.n}${x.y ? ' (' + x.y + ')' : ''}${x.team ? ' · ' + x.team : ''}`).join('\n') + (rec.mvp.length > 14 ? `\n… и ещё ${rec.mvp.length - 14}` : ''))}">${window.TW.medalSvg('mvp')}<i class="cnt">${rec.mvp.length}</i></span>` });
  (rec.aw || []).forEach(a => list.push({ y: a.y, o: 3, html: `<span class="hs-achi" data-tip="${esc(window.TW.AWARD_DEF[a.type]?.title || '')} ${a.y}">${window.TW.awardSvg(a.type, a.y)}<i>'${String(a.y).slice(-2)}</i></span>` }));
  (rec.top || []).forEach(x => list.push({ y: x.y, o: 2, html: `<span class="hs-achi" data-tip="Топ-20 ${x.y}: #${x.r}">${window.TW.top20Svg(x.r)}<i>'${String(x.y).slice(-2)}</i></span>` }));
  (rec.ti || []).forEach(x => list.push({ y: x.y, o: 1, html: `<span class="hs-achi" data-tip="${esc(x.n)} · ${x.y} · ${esc(x.team || '')}">${trophy(x.n, x.s, x.k)}${x.k === 'major' ? '<i class="st">★</i>' : ''}</span>` }));
  return { rec, html: list.map(x => x.html).join(''), list };
}
function pPlayer(nick) {
  const now = playerNow(nick), st = stats(), o = st.P[nick];
  if (!now && !o) return back() + empty('Игрок не найден.');
  const p = now?.p || o.p, t = now?.t || null, L = o ? line(o.all) : null, { rec, html: ach } = achItems(nick);
  const tab = S.ptab || 'overview';
  const majors = (rec.ti || []).filter(x => x.k === 'major').length;
  const tile = (n, l, c, tip) => `<div class="hs-ptile ${c || ''}"${tip ? ` data-tip="${esc(tip)}"` : ''}><b>${n}</b><span>${l}</span></div>`;
  const tiles = L ? tile(f2(L.rating), 'Rating 2.0', ratingCls(L.rating), 'Внутренний рейтинг игры (не HLTV 2.0): K/D, ADR, KAST, импакт по сыгранным картам') + tile(f2(L.kpr), 'KPR', '', 'Убийств за раунд') + tile(f2(L.dpr), 'DPR', '', 'Смертей за раунд')
      + tile(f1(L.adr), 'ADR', '', 'Урон за раунд') + tile(f1(L.kast) + '%', 'KAST', '', 'Раунды с убийством, ассистом, выживанием или разменом') + tile(f2(L.impact), 'Импакт', '', 'Открывающие убийства и мульти-киллы') + tile(f1(L.wr) + '%', 'Винрейт карт', '', `${L.mw} побед из ${L.maps} карт`)
    : `<div class="hs-empty">Сыгранных карт в архиве пока нет.</div>`;
  const head = `${back()}<div class="hs-phead"><div class="hs-pphoto">${photoHtml(p, true)}</div>
      <div class="hs-pid"><div class="hs-pcountry">${pFlag(p)} ${esc(p?.country || '')}</div><h1>${esc(nick)}</h1><div class="hs-preal">${esc(p?.realName || '')}</div>
        <div class="hs-pchips"><span class="hs-chip static">${esc(p?.role || '—')}</span>${p?.age ? `<span class="hs-chip static">${p.age} лет</span>` : ''}
          ${majors ? `<span class="hs-chip gold">${majors} x Major winner</span>` : ''}${rec.mvp.length ? `<span class="hs-chip slate">${rec.mvp.length} x MVP</span>` : ''}${(rec.top || []).length ? `<span class="hs-chip orange">Топ-20: лучшее #${Math.min(...rec.top.map(x => x.r))}</span>` : ''}</div>
        ${t ? `<button type="button" class="hs-pteam" data-team="${esc(t.name)}">${logo(t.name, 'sm')} ${esc(t.name)} <small>#${ranked().indexOf(t) + 1}</small></button>` : '<span class="hs-sub">Без команды</span>'}</div>
      <div class="hs-pact"><button type="button" class="hs-btn" data-ptab="compare">Сравнить ⇄</button></div></div>
    <div class="hs-ptiles">${tiles}</div>
    <div class="hs-ptabs">${PTABS.map(([k, l]) => `<button type="button" class="hs-ptab${tab === k ? ' on' : ''}" data-ptab="${k}">${l}</button>`).join('')}</div>`;
  if (!o) return head + empty('Статистика появится после первых сыгранных карт.');
  return head + `<div class="hs-ptab-body">${({ overview: pOverview, stats: pPStats, maps: pPMaps, matches: pPMatches, events: pPEvents, awards: () => box('Достижения', ach ? `<div class="hs-achrow big">${ach}</div>` : empty('Трофеев пока нет')) + pPAwardList(rec), compare: pCompare }[tab] || pOverview)(o, nick)}</div>`;
}
function pOverview(o) {
  const chart = [...o.matches].slice(0, 24).reverse().map(m => ({ v: m.z.rt / Math.max(1, m.z.R), id: m.id, tip: `${m.won ? 'Победа' : 'Поражение'} vs ${m.opp}${m.s ? ' ' + m.s[0] + ':' + m.s[1] : ''} · ${f2(m.z.rt / Math.max(1, m.z.R))} · ${m.ev}` }));
  const maps = Object.entries(o.byMap).map(([k, v]) => ({ k, l: line(v) })).sort((a, b) => b.l.maps - a.l.maps);
  const bestMaps = maps.filter(x => x.l.maps >= Math.min(2, Math.max(...maps.map(y => y.l.maps)))).sort((a, b) => b.l.rating - a.l.rating).slice(0, 3);
  const bestM = [...o.matches].sort((a, b) => b.z.rt / Math.max(1, b.z.R) - a.z.rt / Math.max(1, a.z.R)).slice(0, 5);
  const form = o.matches.slice(0, 10).map(m => `<i class="${m.won ? 'W' : 'L'}" data-tip="${m.won ? 'Победа' : 'Поражение'} vs ${esc(m.opp)} · ${esc(m.ev)}">${m.won ? 'W' : 'L'}</i>`).join('');
  return `<div class="hs-ovgrid">
      ${box('Атрибуты', radar([{ vals: attrsOf(o), name: o.nick }], ATTR_L) + '<p class="hs-note c">Наведите на точку — значение. Атрибуты считаются из статистики и уровня игрока.</p>')}
      ${box('Рейтинг по матчам', ratingChart(chart) + `<div class="hs-formline"><span>Форма:</span><span class="hs-form">${form}</span></div>`)}
    </div>
    <div class="hs-ovgrid b">
      ${box('Лучшие карты', bestMaps.length ? `<div class="hs-bmaps">${bestMaps.map((x, i) => `<div class="hs-bmap r${i}"><span class="hs-bmap-n">${esc(x.k)}</span><b class="${ratingCls(x.l.rating)}">${f2(x.l.rating)}</b><small>${x.l.maps} карт · ${x.l.mw}-${x.l.maps - x.l.mw} · ${f1(x.l.adr)} ADR</small></div>`).join('')}</div>` : empty('Мало карт'))}
      ${box('Лучшие матчи', bestM.map(m => `<button type="button" class="hs-pm" data-match="${esc(m.id)}"><span class="r ${m.won ? 'w' : 'l'}">${m.won ? 'W' : 'L'}</span><span class="o">vs ${logo(m.opp, 'sm')} ${esc(m.opp)}</span><span class="s">${m.s ? m.s[0] + ':' + m.s[1] : ''}</span><span class="e">${esc(m.ev)}</span><span class="kd">${m.z.k}-${m.z.d}</span><b class="${ratingCls(m.z.rt / m.z.R)}">${f2(m.z.rt / m.z.R)}</b></button>`).join(''), '', 'tight')}
    </div>`;
}
function pPStats(o) {
  const seasons = Object.keys(o.bySeason).sort((a, b) => b - a), sel = S.pseason || 'all';
  const L = sel === 'all' ? line(o.all) : (o.bySeason[sel] ? line(o.bySeason[sel]) : line(o.all));
  const row = (l, v, tip) => `<div class="hs-dl"${tip ? ` data-tip="${esc(tip)}"` : ''}><span>${l}</span><b>${v}</b></div>`;
  const chips = `<div class="hs-filters" style="margin-bottom:12px"><button type="button" class="hs-chip${sel === 'all' ? ' on' : ''}" data-pseason="all">Карьера</button>${seasons.map(s => `<button type="button" class="hs-chip${String(sel) === s ? ' on' : ''}" data-pseason="${s}">Сезон ${s} (${yearOf(s)})</button>`).join('')}</div>`;
  return chips + `<div class="hs-stgrid">
    ${box('Общее', row('Карт сыграно', L.maps) + row('Раундов', L.R) + row('Убийств', L.k) + row('Смертей', L.d) + row('K/D', f2(L.kd)) + row('Разница K-D', (L.diff > 0 ? '+' : '') + L.diff) + row('Хедшоты', f1(L.hs) + '%') + row('Урон за раунд', f1(L.adr)) + row('Ассистов за раунд', f2(L.apr)) + row('KAST', f1(L.kast) + '%') + row('Импакт', f2(L.impact)) + row('Rating 2.0', `<span class="${ratingCls(L.rating)}">${f2(L.rating)}</span>`))}
    ${box('Открывающие дуэли', row('Открывающих убийств', L.ok) + row('Открывающих смертей', L.od) + row('Успешность', f1(L.ok + L.od ? L.ok / (L.ok + L.od) * 100 : 0) + '%') + row('Открытий за раунд', f2(L.okpr)) + `<div class="hs-duel"><i style="width:${f1(L.ok + L.od ? L.ok / (L.ok + L.od) * 100 : 50)}%"></i></div>`)}
    ${box('Мульти-киллы', `<div class="hs-multi">${[['2K', L.k2], ['3K', L.k3], ['4K', L.k4], ['ЭЙС', L.k5]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>` + row('Раундов с 2+ убийствами', L.k2 + L.k3 + L.k4 + L.k5) + row('Доля от раундов', f1((L.k2 + L.k3 + L.k4 + L.k5) / Math.max(1, L.R) * 100) + '%'))}
    ${box('Клатчи', `<div class="hs-ring" style="--p:${f1(L.clA ? L.clW / L.clA * 100 : 0)}"><b>${L.clW}/${L.clA}</b><span>выиграно</span></div>` + row('Процент побед', f1(L.clA ? L.clW / L.clA * 100 : 0) + '%') + row('Клатчей за 100 раундов', f1(L.clA / Math.max(1, L.R) * 100)))}
  </div><p class="hs-note">Открывающие дуэли, мульти-киллы и клатчи рассчитаны из тех же данных по картам, что и рейтинг.</p>`;
}
function pPMaps(o) {
  const rows = Object.entries(o.byMap).map(([k, v]) => ({ k, l: line(v) })).sort((a, b) => b.l.maps - a.l.maps);
  return `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Карта</th><th>Карт</th><th>W-L</th><th class="l">Винрейт</th><th>K-D</th><th>ADR</th><th>KAST</th><th>Рейтинг</th></tr></thead><tbody>${rows.map(x => `<tr><td class="l"><b>${esc(x.k)}</b></td><td>${x.l.maps}</td><td>${x.l.mw}-${x.l.maps - x.l.mw}</td>
    <td class="l"><span class="hs-bar"><i style="width:${f1(x.l.wr)}%"></i></span>${f1(x.l.wr)}%</td><td class="${x.l.diff >= 0 ? 'up' : 'dn'}">${x.l.k}-${x.l.d}</td><td>${f1(x.l.adr)}</td><td>${f1(x.l.kast)}%</td><td><b class="hs-rt ${ratingCls(x.l.rating)}">${f2(x.l.rating)}</b></td></tr>`).join('')}</tbody></table>`;
}
function pPMatches(o) {
  const sort = S.pmsort || 'date', list = [...o.matches];
  if (sort === 'rating') list.sort((a, b) => b.z.rt / b.z.R - a.z.rt / a.z.R);
  const chips = `<div class="hs-filters" style="margin-bottom:12px"><button type="button" class="hs-chip${sort === 'date' ? ' on' : ''}" data-pmsort="date">Сначала новые</button><button type="button" class="hs-chip${sort === 'rating' ? ' on' : ''}" data-pmsort="rating">Лучшие по рейтингу</button><span class="hs-sub">${o.matches.length} матчей</span></div>`;
  return chips + box('Матчи', list.slice(0, 80).map(m => `<button type="button" class="hs-pm" data-match="${esc(m.id)}"><span class="r ${m.won ? 'w' : 'l'}">${m.won ? 'W' : 'L'}</span><span class="o">vs ${logo(m.opp, 'sm')} ${esc(m.opp)}</span><span class="s">${m.s ? m.s[0] + ':' + m.s[1] : ''}</span><span class="e">${esc(m.ev)} · ${esc(m.team)}</span><span class="kd">${m.z.k}-${m.z.d}</span><b class="${ratingCls(m.z.rt / m.z.R)}">${f2(m.z.rt / m.z.R)}</b></button>`).join('') || empty('Матчей нет'), '', 'tight');
}
function pPEvents(o) {
  const arch = archive();
  const rows = Object.values(o.byEv).sort((a, b) => b.ts - a.ts).map(e => {
    const snap = arch[e.id], place = snap?.results?.find(r => r.n === e.team)?.p, l = line(e.s);
    return `<tr data-event="${esc(e.id)}"><td class="l"><span class="hs-ev-tr sm">${trophy(e.name, e.season, e.kind)}</span><b>${esc(e.name)}</b><span class="hs-kind k-${e.kind}">${KIND[e.kind] || ''}</span></td><td class="l">${logo(e.team, 'sm')} ${esc(e.team)}</td>
      <td>${place ? (place === 1 ? '<b class="hs-gold">🏆 1</b>' : place) : '—'}</td><td>${l.maps}</td><td class="${l.diff >= 0 ? 'up' : 'dn'}">${l.k}-${l.d}</td><td>${f1(l.adr)}</td><td><b class="hs-rt ${ratingCls(l.rating)}">${f2(l.rating)}</b></td></tr>`;
  }).join('');
  return `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Турнир</th><th class="l">Команда</th><th>Место</th><th>Карт</th><th>K-D</th><th>ADR</th><th>Рейтинг</th></tr></thead><tbody>${rows}</tbody></table><p class="hs-note">Нажмите на турнир — откроется его сетка.</p>`;
}
function pPAwardList(rec) {
  const li = [];
  (rec.aw || []).forEach(a => li.push(`<li><b>${esc(window.TW?.AWARD_DEF?.[a.type]?.title || a.type)}</b> · ${a.y} · ${esc(a.team || '')}</li>`));
  (rec.top || []).forEach(x => li.push(`<li><b>Топ-20 игроков ${x.y}: #${x.r}</b> · ${esc(x.team || '')}</li>`));
  (rec.mvp || []).forEach(x => li.push(`<li>MVP — <b>${esc(x.n)}</b> · ${x.y}</li>`));
  (rec.ti || []).forEach(x => li.push(`<li>🏆 <b>${esc(x.n)}</b> · ${x.y} · ${esc(x.team || '')}</li>`));
  return li.length ? box('Список', `<ul class="hs-awlist">${li.join('')}</ul>`) : '';
}
function pCompare(o, nick) {
  const st = stats(), other = S.cmp && st.P[S.cmp] && S.cmp !== nick ? st.P[S.cmp] : null;
  const pool = Object.values(st.P).filter(x => x.nick !== nick && x.all.maps >= 3).sort((a, b) => line(b.all).rating - line(a.all).rating);
  const pick = `<div class="hs-cmp-pick"><span>Сравнить с:</span><input type="text" class="hs-inp" id="hs-cmpq" list="hs-cmpl" placeholder="Ник игрока…" value="${esc(S.cmp && S.cmp !== nick ? S.cmp : '')}"><datalist id="hs-cmpl">${pool.slice(0, 120).map(x => `<option value="${esc(x.nick)}">${esc(x.team)}</option>`).join('')}</datalist>
    <span class="hs-sub">или</span>${pool.slice(0, 5).map(x => `<button type="button" class="hs-chip" data-cmp="${esc(x.nick)}">${esc(x.nick)}</button>`).join('')}</div>`;
  if (!other) return pick + empty('Выберите игрока для сравнения.');
  const A = line(o.all), B = line(other.all);
  const rows = [['Рейтинг', 'rating', f2], ['K/D', 'kd', f2], ['KPR', 'kpr', f2], ['DPR', 'dpr', f2, true], ['ADR', 'adr', f1], ['KAST, %', 'kast', f1], ['Импакт', 'impact', f2], ['HS, %', 'hs', f1], ['Открытий за раунд', 'okpr', f2], ['Винрейт карт, %', 'wr', f1], ['Карт', 'maps', String]];
  const tr = rows.map(([l, k, fm, low]) => { const a = A[k], b = B[k], aw = low ? a < b : a > b, bw = low ? b < a : b > a, mx = Math.max(Math.abs(a), Math.abs(b)) || 1;
    return `<div class="hs-cmprow"><span class="v ${aw ? 'win' : ''}">${fm(a)}</span><span class="bar l"><i style="width:${f1(Math.abs(a) / mx * 100)}%" class="${aw ? 'win' : ''}"></i></span><span class="lbl">${l}</span><span class="bar r"><i style="width:${f1(Math.abs(b) / mx * 100)}%" class="${bw ? 'win' : ''}"></i></span><span class="v ${bw ? 'win' : ''}">${fm(b)}</span></div>`; }).join('');
  const wins = rows.filter(([, k, , low]) => k !== 'maps' && (low ? A[k] < B[k] : A[k] > B[k])).length, total = rows.length - 1;
  return pick + `<div class="hs-cmp">
      <div class="hs-cmphead"><button type="button" class="hs-cmpp" data-player="${esc(nick)}">${pFlag(o.p)} <b>${esc(nick)}</b><small>${esc(o.team)}</small></button>
        <div class="hs-cmpscore"><b>${wins}</b> : <b>${total - wins}</b><small>по показателям</small></div>
        <button type="button" class="hs-cmpp r" data-player="${esc(other.nick)}">${pFlag(other.p)} <b>${esc(other.nick)}</b><small>${esc(other.team)}</small></button></div>
      <div class="hs-cmpgrid"><div>${tr}</div><div class="hs-cmpradar">${radar([{ vals: attrsOf(o), name: nick, cls: 'a' }, { vals: attrsOf(other), name: other.nick, cls: 'b' }], ATTR_L)}<div class="hs-chart-leg"><span><i class="l1"></i>${esc(nick)}</span><span><i class="lb"></i>${esc(other.nick)}</span></div></div></div></div>`;
}

/* ---- команда ---- */
const TTABS = [['overview', 'Обзор'], ['maps', 'Карты'], ['matches', 'Матчи'], ['players', 'Игроки'], ['h2h', 'Соперники']];
function pTeam(name) {
  const t = ensure(teamBy(name)); if (!t) return back() + empty('Команда не найдена.');
  const st = stats(), T = st.T[name], rank = ranked().indexOf(t) + 1, tab = S.ttab || 'overview';
  const d = (Number(t.seasonStartRank) || 0) ? t.seasonStartRank - rank : 0;
  const ms = st.ms.filter(m => m.a === name || m.b === name);
  const wins = (t.history || []).filter(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward).length;
  const roster = (t.players || []).map(p => { const o = st.P[p.nick], L = o ? line(o.all) : null;
    return `<button type="button" class="hs-tplayer" data-player="${esc(p.nick)}"><span class="ph">${photoHtml(p)}</span><span class="nm">${pFlag(p)} ${esc(p.nick)}</span><span class="rt ${L ? ratingCls(L.rating) : ''}">${L ? f2(L.rating) : '—'}</span><small>${esc(p.role || '')}</small></button>`; }).join('');
  const head = `${back()}<div class="hs-thead">${logo(name, 'xl')}<div class="hs-tid"><div class="hs-pcountry">${typeof getTeamFlag === 'function' ? esc(getTeamFlag(name)) : ''} ${esc(t.coach?.name ? 'тренер ' + t.coach.name : '')}</div><h1>${esc(name)}</h1>
      <div class="hs-tkpi"><span><b>#${rank}</b> в рейтинге</span><span><b>${Math.round(t.pts || 0)}</b> очков</span><span class="${d > 0 ? 'up' : d < 0 ? 'dn' : ''}"><b>${d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '—'}</b> за сезон</span><span><b>${wins}</b> титулов</span>${T ? `<span><b>${f1(T.maps ? T.mw / T.maps * 100 : 0)}%</b> винрейт карт</span>` : ''}</div></div>
      <div class="hs-pact"><button type="button" class="hs-btn ghost" data-teamcard="${esc(name)}">Профиль команды</button></div></div>
    <div class="hs-troster">${roster}</div>
    <div class="hs-ptabs">${TTABS.map(([k, l]) => `<button type="button" class="hs-ptab${tab === k ? ' on' : ''}" data-ttab="${k}">${l}</button>`).join('')}</div>`;
  if (!T) return head + empty('Матчей в архиве пока нет.');
  const mapRows = Object.entries(T.byMap).sort((a, b) => b[1].n - a[1].n);
  let body = '';
  if (tab === 'overview') {
    const trophies = window.TW ? (t.history || []).filter(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward).slice(0, 14).map(h => `<span class="hs-achi" data-tip="${esc(h.tournament)} · сезон ${h.season}">${window.TW.trophySvg(h.tournament, h.season, h.isMajor ? 'major' : h.isElite ? 'elite' : 'regular')}${h.isMajor ? '<i class="st">★</i>' : ''}</span>`).join('') : '';
    body = `<div class="hs-ovgrid">${box('Маппул', mapRows.map(([k, v]) => `<div class="hs-mprow" data-tip="${v.w}-${v.n - v.w} · раунды ${v.rw}:${v.rl}"><span class="n">${esc(k)}</span><span class="hs-bar big"><i style="width:${f1(v.w / v.n * 100)}%"></i></span><b>${f1(v.w / v.n * 100)}%</b><small>${v.n}</small></div>`).join(''))}
      ${box('Последние матчи', ms.slice(0, 8).map(m => matchRow(m, name)).join(''), '<button type="button" class="hs-more" data-ttab="matches">все →</button>', 'tight')}</div>
      ${trophies ? box('Трофеи', `<div class="hs-achrow">${trophies}</div>`) : ''}`;
  } else if (tab === 'maps') {
    body = `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Карта</th><th>Сыграно</th><th>W-L</th><th class="l">Винрейт</th><th>Раунды</th><th>Разница</th></tr></thead><tbody>${mapRows.map(([k, v]) => `<tr><td class="l"><b>${esc(k)}</b></td><td>${v.n}</td><td>${v.w}-${v.n - v.w}</td><td class="l"><span class="hs-bar"><i style="width:${f1(v.w / v.n * 100)}%"></i></span>${f1(v.w / v.n * 100)}%</td><td>${v.rw}:${v.rl}</td><td class="${v.rw - v.rl >= 0 ? 'up' : 'dn'}">${v.rw - v.rl > 0 ? '+' : ''}${v.rw - v.rl}</td></tr>`).join('')}</tbody></table>`;
  } else if (tab === 'matches') {
    body = box(`Матчи · ${T.matchW}-${T.matches - T.matchW}`, ms.slice(0, 120).map(m => matchRow(m, name)).join(''), '', 'tight');
  } else if (tab === 'players') {
    const ps = Object.values(st.P).filter(o => o.matches.some(m => m.team === name)).map(o => { const z = Z0(); o.matches.filter(m => m.team === name).forEach(m => Object.keys(z).forEach(k => { z[k] += m.z[k]; })); return { o, l: line(z), cur: (t.players || []).some(p => p.nick === o.nick) }; }).sort((a, b) => b.l.rating - a.l.rating);
    body = `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th>Карт</th><th>K-D</th><th>ADR</th><th>KAST</th><th>Рейтинг</th></tr></thead><tbody>${ps.map(x => `<tr data-player="${esc(x.o.nick)}"><td class="l">${pFlag(x.o.p)} <b>${esc(x.o.nick)}</b>${x.cur ? '' : '<small>бывший</small>'}</td><td>${x.l.maps}</td><td class="${x.l.diff >= 0 ? 'up' : 'dn'}">${x.l.k}-${x.l.d}</td><td>${f1(x.l.adr)}</td><td>${f1(x.l.kast)}%</td><td><b class="hs-rt ${ratingCls(x.l.rating)}">${f2(x.l.rating)}</b></td></tr>`).join('')}</tbody></table><p class="hs-note">Статистика за эту команду, включая игроков, которые уже ушли.</p>`;
  } else {
    const rows = Object.entries(T.h2h).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l));
    body = `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Соперник</th><th>Матчи</th><th>W-L</th><th class="l">Винрейт</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr data-team="${esc(k)}"><td class="l">${logo(k, 'sm')} <b>${esc(k)}</b></td><td>${v.w + v.l}</td><td>${v.w}-${v.l}</td><td class="l"><span class="hs-bar"><i style="width:${f1(v.w / (v.w + v.l) * 100)}%"></i></span>${f1(v.w / (v.w + v.l) * 100)}%</td></tr>`).join('')}</tbody></table>`;
  }
  return head + `<div class="hs-ptab-body">${body}</div>`;
}

/* ------------------------------------------------------------- события UI */
const CLICKS = []; // [selector, fn(el, e)] — обработчики модулей v30
function onClick(e) {
  const t = e.target;
  const c = sel => t.closest(sel);
  let el;
  for (const [sel, fn] of CLICKS) { if ((el = c(sel)) && root.contains(el)) { const r = fn(el, e); if (r !== false) return; } }
  if ((el = c('[data-dd]'))) { const d = el.closest('.pt-dd'), was = d.classList.contains('open'); closeMenus(); d.classList.toggle('open', !was); return; }
  if ((el = c('[data-time]'))) {
    const k = el.dataset.time;
    if (k === 'pause' && typeof window.toggleGameCalendarPause === 'function') window.toggleGameCalendarPause();
    if (k === 'speed' && typeof window.setGameCalendarSpeed === 'function') window.setGameCalendarSpeed(+el.dataset.v);
    if (k === 'skip' && typeof window.skipGameCalendarDay === 'function') window.skipGameCalendarDay();
    setTimeout(tickClock, 30); return;
  }
  if (c('[data-radar]')) { closeMenus(); const b = $('cs2-rf-btn'); if (b) b.click(); else if (typeof window.openRadar === 'function') window.openRadar(); return; }
  if (c('[data-back]')) { if (S.hist.length) history.back(); else nav('home'); return; }
  if ((el = c('[data-nav]'))) { const a = el.dataset.arg; return nav(el.dataset.nav, a == null ? null : a); }
  if ((el = c('[data-pred]'))) { const [k, tm] = el.dataset.pred.split('|'); if (NW()?.predict(k, tm)) render(); return; }
  if ((el = c('[data-vote]'))) { const [id, o] = el.dataset.vote.split('|'); if (NW()?.vote(id, o)) render(); return; }
  if ((el = c('[data-react]'))) { const [id, em] = el.dataset.react.split('|'); NW()?.react(id, em); return render(); }
  if ((el = c('[data-csend]'))) { const ta = $('hs-ctext'); if (ta && NW()?.comment(el.dataset.csend, ta.value)) render(); return; }
  if ((el = c('[data-ncat]'))) { S.news.cat = el.dataset.ncat; S.news.page = 1; return render(); }
  if ((el = c('[data-nview]'))) { S.news.view = el.dataset.nview; return render(); }
  if (c('[data-player]') || c('[data-team]') || c('[data-event]') || c('[data-match]')) { /* ниже */ }
  else if ((el = c('[data-art]'))) return nav('article', el.dataset.art);
  if ((el = c('[data-player]')) && !c('[data-sort]')) { e.stopPropagation(); $('hs-sugg').classList.remove('on'); if (S.page !== 'player' || S.arg !== el.dataset.player) S.ptab = 'overview'; return nav('player', el.dataset.player); }
  if ((el = c('[data-match]'))) { S.matchTab = 'all'; return nav('match', el.dataset.match); }
  if ((el = c('[data-team]'))) { $('hs-sugg').classList.remove('on'); if (S.page !== 'team' || S.arg !== el.dataset.team) S.ttab = 'overview'; return nav('team', el.dataset.team); }
  if ((el = c('[data-event]'))) { $('hs-sugg').classList.remove('on'); S.etab = null; return nav('event', el.dataset.event); }
  if ((el = c('[data-ptab]'))) { S.ptab = el.dataset.ptab; return render(); }
  if ((el = c('[data-ttab]'))) { S.ttab = el.dataset.ttab; return render(); }
  if ((el = c('[data-pseason]'))) { S.pseason = el.dataset.pseason; return render(); }
  if ((el = c('[data-pmsort]'))) { S.pmsort = el.dataset.pmsort; return render(); }
  if ((el = c('[data-cmp]'))) { S.cmp = el.dataset.cmp; return render(); }
  if ((el = c('[data-mkind]'))) { S.matches.kind = el.dataset.mkind; S.matches.page = 1; return render(); }
  if ((el = c('[data-mtab]'))) { S.matchTab = el.dataset.mtab; return render(); }
  if ((el = c('[data-etab]'))) { S.events.tab = el.dataset.etab; return render(); }
  if ((el = c('[data-stab]'))) { S.stats.tab = el.dataset.stab; return render(); }
  if ((el = c('[data-awyear]'))) { S.awYear = el.dataset.awyear; return render(); }
  if ((el = c('[data-sort]'))) { const k = el.dataset.sort; if (S.stats.sort === k) S.stats.dir *= -1; else { S.stats.sort = k; S.stats.dir = k === 'nick' ? 1 : -1; } return render(); }
  if ((el = c('[data-pg]'))) { const [key, v] = el.dataset.pg.split('|'); const o = key.split('.').reduce((a, k) => a && a[k], S); if (o) { o.page = +v; render(); window.scrollTo({ top: Math.max(0, ($('hs-page').querySelector('[data-pg-anchor]')?.getBoundingClientRect().top || 0) + scrollY - 120) }); } return; }
}
document.addEventListener('change', e => { const el = e.target.closest?.('#hs-root [data-nteam]'); if (!el) return; S.news.team = el.value; render(); });
document.addEventListener('keydown', e => {
  if (e.target?.id === 'hs-ctext' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const b = document.querySelector('#hs-root [data-csend]'); if (b) b.click(); }
  if (e.key === 'Enter' && e.target?.matches?.('#hs-root [data-art]')) e.target.click();
});
document.addEventListener('change', e => {
  const el = e.target.closest?.('#hs-root [data-sf]'); if (!el) return;
  S.stats[el.dataset.sf] = el.value; render();
});
let mqTimer = null;
document.addEventListener('input', e => {
  if (e.target.id !== 'hs-mq') return;
  clearTimeout(mqTimer); const v = e.target.value;
  mqTimer = setTimeout(() => { S.matches.q = v; render(); const i = $('hs-mq'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 220);
});
document.addEventListener('change', e => { if (e.target.id === 'hs-cmpq') { const v = e.target.value.trim(); if (v && stats().P[v]) { S.cmp = v; render(); } } });
// подсказки [data-tip] внутри сайта
let tipEl = null;
document.addEventListener('mouseover', e => {
  const el = e.target.closest?.('#hs-root [data-tip]');
  if (!el) { tipEl?.classList.remove('on'); return; }
  tipEl = tipEl || Object.assign(document.body.appendChild(document.createElement('div')), { className: 'hs-tip' });
  tipEl.textContent = el.getAttribute('data-tip'); tipEl.classList.add('on');
  const r = el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  tipEl.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + 'px';
});
function onSearch() {
  const q = $('hs-q').value.trim().toLowerCase(), box = $('hs-sugg');
  if (!q) { box.classList.remove('on'); return; }
  const tm = TEAMS().filter(t => t.name.toLowerCase().includes(q)).slice(0, 5);
  const pl = []; TEAMS().forEach(t => (ensure(t).players || []).forEach(p => { if (p.nick.toLowerCase().includes(q) || (p.realName || '').toLowerCase().includes(q)) pl.push({ p, t }); }));
  box.innerHTML = (tm.length ? '<div class="hs-sg-h">Команды</div>' + tm.map(t => `<button type="button" data-go data-team="${esc(t.name)}">${logo(t.name, 'sm')} ${esc(t.name)}</button>`).join('') : '') +
    (pl.length ? '<div class="hs-sg-h">Игроки</div>' + pl.slice(0, 7).map(x => `<button type="button" data-go data-player="${esc(x.p.nick)}">${pFlag(x.p)} ${esc(x.p.nick)} <small>${esc(x.t.name)}</small></button>`).join('') : '') ||
    '<div class="hs-sg-h">Ничего не найдено</div>';
  box.classList.add('on');
}
/* ------------------------------------------------------------- часы, сезон, загрузка */
let clk = { c: '', d: '', s: '', sp: '', sk: '' };
function tickClock() {
  if (!root) return;
  const c = $('calendar-clock')?.textContent || '', d = $('calendar-date')?.textContent || '', s = $('calendar-status-label')?.textContent || '';
  const sk = $('calendar-skip-btn')?.textContent || '';
  let sp = ''; try { sp = String(seasonState.calendar?.speed || ''); } catch (e) {}
  if (c !== clk.c) { clk.c = c; $('pt-clock').textContent = c || '--:--'; }
  if (d !== clk.d) { clk.d = d; $('pt-date').textContent = d || '—'; }
  if (s !== clk.s) { clk.s = s; const paused = !/Идёт|▶/.test(s); const b = $('pt-pause'); b.innerHTML = paused ? ICON.play : ICON.pause; b.setAttribute('aria-label', paused ? 'Продолжить время' : 'Пауза'); b.classList.toggle('paused', paused); }
  if (sk !== clk.sk) { clk.sk = sk; $('pt-skip-l').textContent = sk.replace(/^[^\wА-Яа-яЁё]+/, '').trim() || 'День'; }
  const act = root.querySelector('.pt-speed button.on')?.dataset.v, cur = document.querySelector('[data-calendar-speed].active-speed')?.dataset.calendarSpeed || sp;
  if (cur && act !== String(cur)) root.querySelectorAll('.pt-speed button').forEach(b => { const on = b.dataset.v === String(cur); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
}
function seatSeason() { // сезон и Pick'Em переезжают в шапку портала (id те же — старый код их обновляет)
  const seat = $('pt-season'); if (!seat) return;
  ['season-title', 'season-progress', 'pickem-trophy-display'].forEach(id => { const el = $(id); if (el && el.parentElement !== seat) seat.appendChild(el); });
}
function boot() {
  ensureRoot(); seatSeason();
  const [p, a] = parseHash();
  S.page = null; nav(p, a, true);
  tickClock(); setInterval(tickClock, 500);
}
// API для модулей портала (v30-*): регистрация страниц, кликов и общих помощников
window.HS = {
  S, PAGES, AFTER, CLICKS, ICON, NAV_GAME, NAV_MORE, SECTION_OF, nav, render, esc, hash, rngOf, f1, f2, yearOf, TEAMS, ranked, teamBy, archive, awards, ensure, flag, pFlag, logo, SIL, KIND, KIND_ORDER,
  trophy, photoHtml, photoOf, ratingCls, allMatches, rosterOf, playerNow, stats, line, filtered, Z0, mapLines, box, back, empty, matchRow, calendarEvents, fdate, nowMs, feed, newsRow, topStory,
  findNews, ndate, NW, NCATS, pollBox, predictMini, predCard, radar, ratingChart, attrsOf, ATTR_L, achItems, clamp, enc, routeOf,
  invalidate: () => { STATS = null; STATS_KEY = ''; ZP = null; ARCH_MS = null; ALL_MS = null; }
};
Object.assign(PAGES, { home: pHome, news: pNews, article: pArticle, predict: pPredict, matches: pMatches, match: pMatch, events: pEvents, stats: pStats, ranking: pRanking, awards: pAwards, player: pPlayer, team: pTeam });
// старт после загрузки всех модулей (они регистрируют свои страницы синхронно, ниже по документу)
if (document.readyState === 'complete') setTimeout(boot, 0); else window.addEventListener('load', () => setTimeout(boot, 0));
})();
