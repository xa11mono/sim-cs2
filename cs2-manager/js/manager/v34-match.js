/* v34 — страница матча в духе HLTV (#/match/<id>) для сыгранных, идущих и будущих матчей.
   Шапка с градиентом по уровню турнира, карты и вето, трансляции (кастеры по языкам и зрители), составы с
   фото и значками ролей, сравнение лидеров, игрок матча со столбиками показателей, статистика по картам,
   хроника раунда и килфид в эфире (из микросимуляции раундов), статистика карт команд за 3 месяца,
   последние матчи, личные встречи, материалы. Подключается до модулей карьеры и повторов: они дописывают
   свои блоки (тайм-ауты, подготовка, ссылка на повтор) поверх этой страницы. */
(function () {
'use strict';
const H = window.HS; if (!H) return;
const { esc, logo, box, empty } = H;
const DAY = 864e5;
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const nowMs = () => H.nowMs ? H.nowMs() : Date.now();
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const pcol = r => r >= 1.1 ? 'up' : r < .95 ? 'dn' : '';
const KIND_BASE = { major: 950000, elite: 420000, regular: 240000, tier2: 32000, tier3: 7000, academy: 4500, show: 650000, nations: 1500000 };
// кастеры — вымышленные дуэты по языкам; канал стабилен для турнира
const CASTERS = {
  EN: [['Hawk', 'Sage'], ['Vector', 'Mills'], ['Lodge', 'Ferris'], ['Quinn', 'Ashby']], RU: [['Шторм', 'Кот'], ['Гром', 'Лис'], ['Векс', 'Барс'], ['Зима', 'Орёл']],
  PT: [['Rato', 'Gaúcho'], ['Pitbull', 'Mestre']], ES: [['Toro', 'Brujo'], ['Lince', 'Caimán']], PL: [['Wilk', 'Sokół']], TR: [['Kartal', 'Aslan']], FR: [['Loup', 'Corbeau']],
  DE: [['Falke', 'Bär']], UA: [['Сокіл', 'Вовк']], CN: [['Long', 'Feng']]
};
const LANG = [['EN', 'GB', .34], ['RU', 'RU', .28], ['PT', 'BR', .1], ['ES', 'ES', .06], ['PL', 'PL', .05], ['TR', 'TR', .04], ['FR', 'FR', .04], ['DE', 'DE', .03], ['UA', 'UA', .03], ['CN', 'CN', .03]];

function ctx(id) {
  const st = H.stats(), done = st.ms.find(x => x.id === id);
  if (done) return { done, m: done, a: done.a, b: done.b, kind: done.kind, evName: done.ev, evId: done.evId, stage: done.stage, bo: done.bo };
  const fm = H.findMatch(id); if (!fm) return null;
  const { snap, m } = fm, it = H.liveItem(m.a, m.b);
  return { m, snap, a: m.a, b: m.b, kind: snap.prestige || 'regular', evName: snap.name, evId: snap.live && snap.tier === '1' ? 'cur' : snap.id, stage: m.__stage, bo: m.bo || (it?.state?.mode === 'BO1' ? 1 : it?.state?.mode === 'BO5' ? 5 : 3), it, lst: it?.state };
}
const teamOf = n => H.teamBy(n), rankOf = n => { const t = teamOf(n); return t ? H.ranked().indexOf(t) + 1 : 0; };
const prest = n => window.V33Prestige ? window.V33Prestige.prestige(n) : 50;

/* ---- трансляции и зрители ---- */
function viewers(c) {
  const base = KIND_BASE[c.kind] || 150000, pop = (prest(c.a) + prest(c.b)) / 120 + .3;
  const stage = /финал/i.test(c.stage || '') && !/полу|четверт|1\/8/i.test(c.stage || '') ? 1.9 : /полуфинал/i.test(c.stage || '') ? 1.35 : 1;
  const l = c.lst; const close = l && Math.abs((l.map1 || 0) - (l.map2 || 0)) <= 2 ? 1.12 : 1;
  const wave = 1 + .05 * Math.sin(Date.now() / 9000 + h32(c.a + c.b) % 10);
  return Math.round(base * pop * stage * close * (c.lst ? wave : 1));
}
function streams(c, live) {
  const total = viewers(c), seed = h32(c.evName + c.a + c.b);
  const cc = [c.a, c.b].flatMap(n => (teamOf(n)?.players || []).map(p => p.country));
  const boost = code => cc.filter(x => x === code || (code === 'BR' && x === 'BR') || (code === 'GB' && ['GB', 'US', 'CA', 'AU'].includes(x))).length * .015;
  const rows = LANG.map(([lang, flag, share], i) => { const pool = CASTERS[lang] || CASTERS.EN, duo = pool[(seed + i) % pool.length];
    const v = Math.round(total * Math.max(.005, share + boost(flag)) * (.9 + ((seed >> i) % 20) / 100)); return { lang, flag, duo, v }; }).sort((x, y) => y.v - x.v);
  const sum = rows.reduce((s, r) => s + r.v, 0);
  const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(2) + ' млн' : v >= 1000 ? Math.round(v / 1000) + ' тыс.' : String(v);
  return `<div class="mx-watch"><div class="mx-watch-h">${live ? '<span class="hs-live">LIVE</span>' : ''}<b>${live ? 'Смотрят сейчас' : c.done ? 'Пик зрителей' : 'Ожидаемая аудитория'}</b><span>${fmt(sum)}</span></div>
    ${rows.slice(0, 8).map(r => `<div class="mx-stream"><span class="mx-fl">${H.flag(r.flag)}</span><b>${r.lang}</b><span class="mx-cast">${esc(r.duo.join(' & '))}</span><i>${fmt(r.v)}</i></div>`).join('')}
    <p class="hs-note">Кастеры — вымышленные дуэты комментаторов; аудитория зависит от уровня турнира, стадии, популярности команд и напряжённости матча.</p></div>`;
}
/* ---- составы ---- */
const ROLE_IC = { IGL: '<i class="mx-role igl" title="Капитан (IGL)">♛</i>', AWPer: '<i class="mx-role awp" title="Снайпер (AWP)">⌖</i>' };
function lineup(name, ros) {
  const t = teamOf(name), rk = rankOf(name);
  const cards = ros.slice(0, 5).map(p => { const now = H.playerNow(p.nick)?.p || p;
    return `<button type="button" class="mx-pl" data-player="${esc(p.nick)}"><span class="mx-ph">${H.photoHtml(now)}</span>${ROLE_IC[now.role] || ''}<span class="mx-pn">${H.pFlag(now)} ${esc(p.nick)}</span></button>`; }).join('');
  return `<div class="mx-lu"><div class="mx-lu-h">${logo(name, 'sm')}<b data-team="${esc(name)}">${esc(name)}</b>${rk ? `<span class="mx-rk">#${rk} в мире</span>` : ''}</div><div class="mx-lu-b">${cards}</div></div>`;
}
/* ---- игрок матча ---- */
const AVG = { kpr: .68, dpr: .66, kast: 72, impact: 1, adr: 76, rating: 1 };
function potm(x, title) {
  const bars = [['KPR', x.k / Math.max(1, x.R), AVG.kpr, 1.1], ['DPR', x.d / Math.max(1, x.R), AVG.dpr, 1.1, true], ['KAST', x.kast, AVG.kast, 100, false, '%'], ['Impact', x.impact || 1, AVG.impact, 2], ['ADR', x.adr, AVG.adr, 130], ['Rating 2.0', x.rating, AVG.rating, 1.8]];
  const p = H.playerNow(x.nick)?.p || x.p;
  return `<div class="mx-potm"><div class="mx-potm-h">${H.pFlag(p)} <b data-player="${esc(x.nick)}">${esc(x.nick)}</b><span>${esc(title)}</span></div><div class="mx-potm-b"><span class="mx-potm-ph">${H.photoHtml(p, true)}</span>
    <div class="mx-bars"><i class="mx-avg" style="bottom:50%"><span>сред.</span></i>${bars.map(([l, v, avg, max, inv, suf]) => { const h = Math.max(6, Math.min(100, 50 * v / avg)); const good = inv ? v <= avg : v >= avg;
      return `<div class="mx-bar"><b>${l === 'KAST' ? f1(v) + '%' : l === 'ADR' ? f1(v) : f2(v)}</b><i class="${good ? 'g' : 'b'}" style="height:${h}%"></i><span>${l}</span></div>`; }).join('')}</div></div></div>`;
}
/* ---- статистика ---- */
function statTable(name, rows) {
  return `<table class="hs-tbl mx-st"><thead><tr><th class="l">${logo(name, 'sm')} ${esc(name)}</th><th>K-D</th><th>+/-</th><th>ADR</th><th>KAST</th><th>Rating 2.0</th></tr></thead><tbody>${rows.sort((a, b) => b.rating - a.rating).map(x => { const p = H.playerNow(x.nick)?.p || x.p;
    return `<tr><td class="l"><button type="button" class="hs-plink" data-player="${esc(x.nick)}">${H.pFlag(p)} ${esc(x.nick)}</button></td><td>${x.k}-${x.d}</td><td class="${x.k - x.d >= 0 ? 'up' : 'dn'}">${x.k - x.d > 0 ? '+' : ''}${x.k - x.d}</td><td>${f1(x.adr)}</td><td>${f1(x.kast)}%</td><td><b class="${pcol(x.rating)}">${f2(x.rating)}</b></td></tr>`; }).join('')}</tbody></table>`;
}
function doneLines(m, tab) {
  const rA = H.rosterOf(m, m.a), rB = H.rosterOf(m, m.b); if (!rA.length || !rB.length) return null;
  const maps = m.mp.map((mp, i) => ({ i, map: mp[0], s1: +mp[1], s2: +mp[2], L: H.mapLines(m.id, i, mp[0], +mp[1], +mp[2], m.a, m.b, rA, rB) })).filter(x => x.s1 + x.s2 > 0);
  const sum = arr => { const by = {}; arr.forEach(x => { const o = by[x.nick] || (by[x.nick] = { ...x, k: 0, d: 0, a: 0, R: 0, dmgR: 0, kastR: 0, rtR: 0, impR: 0 }); o.k += x.k; o.d += x.d; o.a += x.a; o.R += x.R; o.dmgR += x.adr * x.R; o.kastR += x.kast * x.R; o.rtR += x.rating * x.R; o.impR += (x.impact || 1) * x.R; });
    return Object.values(by).map(o => ({ ...o, adr: o.dmgR / o.R, kast: o.kastR / o.R, rating: o.rtR / o.R, impact: o.impR / o.R })); };
  const sel = tab === 'all' ? maps : maps.filter(x => String(x.i) === String(tab));
  return { maps, A: sum(sel.flatMap(x => x.L.A)), B: sum(sel.flatMap(x => x.L.B)) };
}
function liveLines(c) {
  const L = window.V34Round?.live(c.it.id); if (!L) return null;
  const st = c.lst, M = L.maps[st.mapIndex]; if (!M) return null;
  const rounds = M.rounds.filter(Boolean).length || 1, sideA = c.it.match.t1 === c.a ? 1 : 2;
  const rows = Object.values(M.board).map(b => { const kpr = b.k / rounds, dpr = b.d / rounds, apr = b.a / rounds, adr = b.dmg / rounds;
    const kast = Math.min(95, 35 + kpr * 30 + apr * 40 + (1 - dpr) * 25), impact = 2.13 * kpr + .42 * apr - .41;
    return { nick: b.nick, team: b.team, k: b.k, d: b.d, a: b.a, adr, kast, impact, R: rounds, rating: Math.max(.2, .0073 * kast + .3591 * kpr - .5329 * dpr + .2372 * impact + .0032 * adr + .1587) }; });
  return { A: rows.filter(r => r.team === sideA), B: rows.filter(r => r.team !== sideA), M };
}
const EVT = { kill: '✕', plant: '💣', defuse: '✂', explode: '💥', smoke: '☁', flash: '✦', molotov: '🔥', retake: '↺', save: '⛑', time: '⏱', start: '▶', end: '■', 'trade-try': '⇄' };
function chronicle(c, M) {
  const last = M.rounds.filter(Boolean).slice(-1)[0]; if (!last) return '';
  const sideA = c.it.match.t1 === c.a ? 1 : 2, tm = s => s === sideA ? 'a' : 'b';
  const t = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const why = { elimination: 'все соперники выбиты', bomb: 'бомба взорвалась', defuse: 'бомба обезврежена', time: 'время вышло' }[last.reason] || '';
  const list = last.events.filter(e => e.type !== 'trade-try' && e.type !== 'start').map(e => {
    if (e.type === 'kill') return `<li class="k ${tm(e.team)}"><span>${t(e.t)}</span><b>${esc(e.by)}</b><i>${esc(e.weapon)}${e.hs ? ' · HS' : ''}${e.trade ? ' · размен' : ''}${e.entry ? ' · первое' : ''}</i><b>${esc(e.target)}</b><small>${esc(e.loc || '')}${e.assist ? ' · ассист ' + esc(e.assist) : ''}</small></li>`;
    if (e.type === 'end') return `<li class="end"><span>■</span><b>${esc(e.winner === sideA ? c.a : c.b)}</b> — ${esc(why)}${e.mvp ? ` · MVP раунда <b>${esc(e.mvp)}</b>` : ''}</li>`;
    return `<li class="u ${e.team ? tm(e.team) : ''}"><span>${t(e.t)}</span>${EVT[e.type] || '•'} ${({ plant: 'бомба установлена', defuse: `дефьюз${e.kit ? ' с китом' : ' без кита'}`, explode: 'взрыв', smoke: 'дым', flash: 'флешка', molotov: 'молотов', retake: `ретейк ${e.n || ''}`, save: 'сейв', time: 'время вышло' })[e.type] || e.type}${e.by ? ' — ' + esc(e.by) : ''}${e.loc ? ' · ' + esc(e.loc) : ''}</li>`;
  }).join('');
  return box(`Хроника раунда ${last.r}`, `<ul class="mx-chron">${list}</ul>`, `<span class="hs-dim">${esc(M.map)} · сторона ${esc(c.a)}: ${last.side1 === 'CT' ? (sideA === 1 ? 'CT' : 'T') : (sideA === 1 ? 'T' : 'CT')}</span>`);
}
/* ---- форма, личные встречи, карты команд ---- */
function recent(name, excl) { const t0 = nowMs() - 90 * DAY; return H.stats().ms.filter(x => x.id !== excl && (x.a === name || x.b === name) && x.w && (!x.ts || x.ts >= t0 - 365 * DAY)).slice(0, 6); }
function formBox(name, list) {
  let streak = 0; for (const x of list) { if (x.w === name) streak++; else break; }
  return `<div class="mx-form"><div class="mx-form-h">${logo(name, 'xs')} <b>${esc(name)}</b>${streak >= 3 ? `<span class="mx-streak">🔥 ${streak} побед подряд</span>` : ''}</div>${list.map(x => { const opp = x.a === name ? x.b : x.a, s = x.s ? (x.a === name ? x.s : [x.s[1], x.s[0]]) : null, won = x.w === name;
    return `<button type="button" class="mx-fr" data-match="${esc(x.id)}">${logo(opp, 'xs')}<span>${esc(opp)}</span><small>BO${x.bo || (x.mp.length > 3 ? 5 : x.mp.length > 1 ? 3 : 1)}</small><b class="${won ? 'w' : 'l'}">${s ? s.join(' - ') : won ? 'W' : 'L'}</b></button>`; }).join('') || '<p class="hs-dim">Матчей нет</p>'}</div>`;
}
function mapStats(a, b) {
  const per = name => { const o = {}; H.stats().ms.filter(x => (x.a === name || x.b === name) && x.w).slice(0, 40).forEach(x => x.mp.forEach(mp => { const my = x.a === name ? +mp[1] : +mp[2], th = x.a === name ? +mp[2] : +mp[1]; if (my + th === 0) return; const r = o[mp[0]] || (o[mp[0]] = { n: 0, w: 0 }); r.n++; if (my > th) r.w++; })); return o; };
  const A = per(a), B = per(b), maps = ['Mirage', 'Inferno', 'Nuke', 'Dust II', 'Ancient', 'Anubis', 'Train'];
  const pct = r => r && r.n ? Math.round(r.w / r.n * 100) : null;
  const N = maps.length, cx = 110, cy = 110, R = 80, pt = (i, v) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + Math.cos(ang) * R * v, cy + Math.sin(ang) * R * v]; };
  const poly = (o, cls) => `<polygon class="${cls}" points="${maps.map((m, i) => pt(i, (pct(o[m]) ?? 0) / 100).map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
  const svg = `<svg viewBox="0 0 220 220" class="mx-radar">${[.25, .5, .75, 1].map(k => `<polygon class="g" points="${maps.map((m, i) => pt(i, k).map(v => v.toFixed(1)).join(',')).join(' ')}"/>`).join('')}${maps.map((m, i) => { const [x, y] = pt(i, 1.17); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${m}</text>`; }).join('')}${poly(A, 'a')}${poly(B, 'b')}</svg>`;
  const rows = maps.map(m => { const pa = pct(A[m]), pb = pct(B[m]); return `<div class="mx-mr"><span class="${pa != null && pb != null && pa > pb ? 'w' : ''}">${pa == null ? '—' : pa + '%'}<small>${A[m]?.n || 0} карт</small></span><b>${m}</b><span class="${pa != null && pb != null && pb > pa ? 'w' : ''}">${pb == null ? '—' : pb + '%'}<small>${B[m]?.n || 0} карт</small></span></div>`; }).join('');
  return `<div class="mx-maps-st">${svg}<div class="mx-mrs"><div class="mx-mr h"><span>${logo(a, 'xs')} ${esc(a)}</span><b>Винрейт карт</b><span>${esc(b)} ${logo(b, 'xs')}</span></div>${rows}</div></div>`;
}
/* ---- страница ---- */
const UI = { tab: 'all', id: null };
function page(id) {
  const c = ctx(id); if (!c) return H.back() + empty('Матч не найден.');
  if (UI.id !== id) { UI.id = id; UI.tab = 'all'; }
  const m = c.m, live = !!c.lst, done = !!c.done;
  const sideA = live && c.it.match.t1 === c.a ? 1 : 2;
  const sA = done ? (m.s ? m.s[0] : '') : live ? (sideA === 1 ? c.lst.series1 : c.lst.series2) : '', sB = done ? (m.s ? m.s[1] : '') : live ? (sideA === 1 ? c.lst.series2 : c.lst.series1) : '';
  const pa = !done && !live && H.plannedAt ? (m.at ? { ms: m.at } : H.plannedAt(m)) : null;
  const center = done || live ? `<div class="mx-sc"><b class="${done && m.w === c.a ? 'w' : done ? 'l' : ''}">${sA}</b><i>:</i><b class="${done && m.w === c.b ? 'w' : done ? 'l' : ''}">${sB}</b></div>${live ? `<div class="mx-cur">${esc(c.lst.maps?.[c.lst.mapIndex] || '')} · ${sideA === 1 ? c.lst.map1 : c.lst.map2}:${sideA === 1 ? c.lst.map2 : c.lst.map1}</div><span class="hs-live">LIVE</span>` : '<span class="mx-fin">Матч завершён</span>'}`
    : `<div class="mx-time">${pa ? esc(H.whenTxt(pa.ms, pa.est)) : 'Время уточняется'}</div>`;
  const head = `${H.back()}<div class="mx-head k-${esc(c.kind)}">
    <button type="button" class="mx-team" data-team="${esc(c.a)}">${logo(c.a, 'xl')}<b>${esc(c.a)}</b><small>${rankOf(c.a) ? '#' + rankOf(c.a) + ' в мире' : ''}</small></button>
    <div class="mx-mid"><button type="button" class="mx-ev" data-event="${esc(c.evId)}">${esc(c.evName)}</button><small>${esc(c.stage || '')} · BO${c.bo || 3}</small>${center}</div>
    <button type="button" class="mx-team" data-team="${esc(c.b)}">${logo(c.b, 'xl')}<b>${esc(c.b)}</b><small>${rankOf(c.b) ? '#' + rankOf(c.b) + ' в мире' : ''}</small></button></div>`;
  // карты
  let mapsHtml = '';
  if (done) mapsHtml = (m.mp || []).map((mp, i) => `<button type="button" class="mx-map ${+mp[1] > +mp[2] ? 'wa' : 'wb'}${String(UI.tab) === String(i) ? ' on' : ''}" data-mxtab="${i}"><b>${esc(mp[0])}</b><span><i class="${+mp[1] > +mp[2] ? 'w' : ''}">${mp[1]}</i> : <i class="${+mp[2] > +mp[1] ? 'w' : ''}">${mp[2]}</i></span></button>`).join('');
  else if (live) mapsHtml = (c.lst.maps || []).map((mp, i) => { const r = (c.lst.mapResults || []).find(x => x.map === mp), cur = i === c.lst.mapIndex && !r;
    const a = r ? (r.t1 === c.a ? r.t1Score : r.t2Score) : cur ? (sideA === 1 ? c.lst.map1 : c.lst.map2) : '', b = r ? (r.t1 === c.a ? r.t2Score : r.t1Score) : cur ? (sideA === 1 ? c.lst.map2 : c.lst.map1) : '';
    return `<div class="mx-map${cur ? ' on cur' : ''}${r ? (r.winner === c.a ? ' wa' : ' wb') : ''}"><b>${esc(mp)}</b><span>${r || cur ? `${a} : ${b}` : '—'}</span>${cur ? '<small>идёт</small>' : ''}</div>`; }).join('');
  const veto = live && (c.lst.vetoLog || []).length ? `<ol class="mx-veto">${c.lst.vetoLog.map(v => `<li>${esc(String(v.text || '').replace(/<[^>]*>/g, ''))}</li>`).join('')}</ol>` : '';
  const mapsBox = box('Карты', `${mapsHtml ? `<div class="mx-maps">${mapsHtml}</div>` : '<p class="hs-dim">Карты определятся на вето перед матчем.</p>'}${veto}`);
  // составы
  const rA = done ? H.rosterOf(m, c.a) : (teamOf(c.a)?.players || []), rB = done ? H.rosterOf(m, c.b) : (teamOf(c.b)?.players || []);
  // статистика
  let statsHtml = '', potmHtml = '';
  if (done) { const L = doneLines(m, UI.tab); if (L) { const all = L.A.concat(L.B), best = all.reduce((b, x) => !b || x.rating > b.rating ? x : b, null);
      potmHtml = best ? box('Игрок матча', potm(best, `${UI.tab === 'all' ? 'по всем картам' : 'на карте'} · ${(m.mp || []).length} ${(m.mp || []).length === 1 ? 'карта' : 'карты'}`)) : '';
      statsHtml = box('Статистика матча', `<div class="mx-tabs"><button type="button" class="hs-chip${UI.tab === 'all' ? ' on' : ''}" data-mxtab="all">Все карты</button>${L.maps.map(x => `<button type="button" class="hs-chip${String(UI.tab) === String(x.i) ? ' on' : ''}" data-mxtab="${x.i}">${esc(x.map)}</button>`).join('')}</div>${statTable(c.a, L.A)}${statTable(c.b, L.B)}`); } }
  else if (live) { const L = liveLines(c); if (L) statsHtml = box(`Таблица карты · ${esc(c.lst.maps?.[c.lst.mapIndex] || '')}`, `${statTable(c.a, L.A)}${statTable(c.b, L.B)}<p class="hs-note">Убийства, урон и рейтинг — из розыгрыша каждого раунда в эфире.</p>`) + chronicle(c, L.M); }
  const h2h = H.stats().ms.filter(x => x.id !== m.id && x.w && ((x.a === c.a && x.b === c.b) || (x.a === c.b && x.b === c.a)));
  const hw = h2h.filter(x => x.w === c.a).length, ot = h2h.reduce((s, x) => s + x.mp.filter(mp => +mp[1] + +mp[2] > 24).length, 0);
  const h2hHtml = box('Личные встречи', `<div class="mx-h2h"><span>${logo(c.a, 'lg')}<b>${hw}</b><small>побед</small></span><span><b>${ot}</b><small>овертаймов</small></span><span><b>${h2h.length - hw}</b><small>побед</small>${logo(c.b, 'lg')}</span></div>${h2h.slice(0, 5).map(x => H.matchRow(x)).join('')}`, '', 'tight');
  let odds = null; try { if (!done) odds = calcMatchOdds(c.a, c.b, (c.bo || 3) === 1); } catch (e) {}
  const oddsHtml = odds ? box('Шансы', `<div class="mc-odds"><div style="--p:${odds.pct1}%"><i></i></div><div class="mc-odds-l"><span>${esc(c.a)} <b>${odds.pct1}%</b> · ${odds.c1}x</span><span>${odds.c2}x · <b>${odds.pct2}%</b> ${esc(c.b)}</span></div></div>`) : '';
  const news = done ? H.feed().filter(n => n.match === id || (n.ev === m.evId && n.team && [c.a, c.b].includes(n.team) && n.cat === 'match')).slice(0, 4) : [];
  const watchBtn = live ? `<button type="button" class="hs-btn" data-watch="${esc(c.it.id)}">Режим зрителя</button>` : '';
  return head + `<div class="mx-grid"><div class="mx-col">${mapsBox}${oddsHtml}</div><div class="mx-col">${box('Трансляции', streams(c, live) + watchBtn)}</div></div>
    ${box('Составы', lineup(c.a, rA) + lineup(c.b, rB), '', 'mx-lus')}
    ${potmHtml}${statsHtml}
    ${box('Статистика карт команд', mapStats(c.a, c.b))}
    ${box('Последние матчи', `<div class="mx-forms">${formBox(c.a, recent(c.a, id))}${formBox(c.b, recent(c.b, id))}</div>`)}
    ${h2hHtml}
    ${news.length ? box('Материалы о матче', news.map(n => `<button type="button" class="ev-news" data-art="${esc(n.id)}"><b>${esc(n.title)}</b><small>${H.ndate(n.ts)}</small></button>`).join(''), '', 'flush') : ''}`;
}
H.PAGES.match = page;
H.CLICKS.push(['[data-mxtab]', el => { UI.tab = el.dataset.mxtab; const y = window.scrollY; H.render(); window.scrollTo(0, y); }]);
console.info('[v34] страница матча');
})();
