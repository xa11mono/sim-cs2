(() => {
'use strict';
/* =====================================================================
   v30 · Главная портала и лента новостей
   Главная: главный материал (выбирается из того, что реально происходит: идущий финал /
   Major, громкая новость, трансферная сенсация, смена №1) + второстепенные материалы;
   матчи (Live · ближайшие · результаты); редакционная лента с рубриками;
   правая колонка — текущие события, крупные турниры впереди, топ команд, трансферы,
   игрок недели, опрос. Новости: рубрики, поиск, сортировка, пагинация по 20.
   ===================================================================== */
const H = window.HS; if (!H) return;
const { esc, logo, trophy, KIND, box, empty, fdate, f2, ratingCls, pFlag } = H;
const NW = () => window.V29News || null;
const CT = () => (typeof currentTournament !== 'undefined' ? currentTournament : null);
const catOf = c => (H.NCATS()[c] || { l: c, ic: '' });
// визуал новости: фото героя материала → логотип команды → кубок турнира → значок рубрики
function newsVisual(n, big) {
  const M = window.V31Media, ph = n.player && M ? M.url('player', n.player) : null, lg = n.team && M ? M.url('team', n.team) : null;
  if (ph && (big || !n.img)) return `<img class="nv-ph" src="${esc(ph)}" alt="">`;
  if (n.img) return trophy(n.img.name, n.img.season, n.img.kind);
  if (lg) return `<img class="nv-lg" src="${esc(lg)}" alt="">`;
  return big ? `<span class="hm-hero-ic">${esc(n.icon || '')}</span>` : `<span class="nl-ic">${esc(n.icon || '')}</span>`;
}

/* ---------- выбор главного материала ---------- */
function lead() {
  const ct = CT(), fd = H.feed();
  if (ct && !ct.completed && window.hubSnapshotTier1) {
    const snap = window.hubSnapshotTier1(ct), ms = H.indexSnap(snap);
    const gf = ms.filter(m => /Гранд|Финал/.test((m.__stage || '').split(' · ').pop()) && m.a && m.b && !m.w)[0];
    if (gf || ct.isMajor) return { type: 'event', snap, m: gf || null };
  }
  const now = H.nowMs(), recent = fd.filter(n => n.ts > now - 21 * 864e5).slice(0, 14);
  const big = recent.filter(n => (n.imp || 0) >= 8).sort((a, b) => (b.imp || 0) - (a.imp || 0) || b.ts - a.ts)[0];
  if (big) return { type: 'news', n: big };
  if (ct && !ct.completed && window.hubSnapshotTier1) return { type: 'event', snap: window.hubSnapshotTier1(ct), m: null };
  const any = (recent.length ? recent : fd.slice(0, 6)).slice().sort((a, b) => (b.imp || 0) - (a.imp || 0))[0];
  return any ? { type: 'news', n: any } : null;
}
function heroHtml(L) {
  if (!L) return `<section class="hm-hero empty"><div class="hm-hero-t"><h2>Сезон начинается</h2><p>Первые новости появятся после стартового турнира. Запустите время в шапке — турниры и эфир идут по календарю.</p><button type="button" class="hs-btn" data-nav="watch">Режим зрителя</button></div></section>`;
  if (L.type === 'event') {
    const s = L.snap, m = L.m, kind = s.prestige;
    const sub = m ? `${esc(m.__stage.split(' · ').pop())}: ${esc(m.a)} — ${esc(m.b)}` : `${s.size} команд · ${KIND[kind]}`;
    return `<section class="hm-hero" data-event="cur"><div class="hm-hero-art">${trophy(s.name, s.season, kind)}</div>
      <div class="hm-hero-t"><div class="hm-k"><span class="hs-live">LIVE</span><span class="hs-kind k-${kind}">${KIND[kind]}</span></div><h2>${esc(s.name)}</h2><p>${sub}</p>
        <div class="hm-hero-a"><button type="button" class="hs-btn" data-event="cur">${m ? 'К финалу' : 'Страница турнира'}</button>${m ? `<button type="button" class="hs-btn ghost" data-match="${esc(m.__id)}">Match Center</button>` : ''}</div></div></section>`;
  }
  const n = L.n, c = catOf(n.cat);
  const art = newsVisual(n, true);
  return `<section class="hm-hero" data-art="${esc(n.id)}" tabindex="0"><div class="hm-hero-art">${art}</div>
    <div class="hm-hero-t"><div class="hm-k"><span class="hs-ncat c-${esc(n.cat)}">${esc(c.l)}</span><span class="hs-dim">${H.ndate(n.ts)}</span>${n.rumor && !n.confirmed ? '<span class="hm-rumor">слух</span>' : ''}</div>
      <h2>${esc(n.title)}</h2><p>${esc(n.lead || '')}</p></div></section>`;
}
function sideStories(exclude) {
  return H.feed().filter(n => n.id !== exclude && (n.imp || 0) >= 5).slice(0, 4).map(n => `<button type="button" class="hm-side" data-art="${esc(n.id)}"><span class="hs-ncat c-${esc(n.cat)}">${esc(catOf(n.cat).l)}</span><b>${esc(n.title)}</b><small>${H.ndate(n.ts)}</small></button>`).join('');
}

/* ---------- блоки ---------- */
H.S.hm = { mt: 'live', nc: 'all' };
function matchesBlock() {
  const f = H.S.hm, lm = H.liveMatches ? H.liveMatches() : [];
  const live = lm.filter(x => x.live), soon = lm.filter(x => !x.live).sort((a, b) => (a.snap.tier === '1' ? -1 : 0) - (b.snap.tier === '1' ? -1 : 0) || (a.at || 0) - (b.at || 0));
  const res = H.stats().ms.filter(m => m.w).slice(0, 8);
  let tab = f.mt; if (tab === 'live' && !live.length) tab = soon.length ? 'soon' : 'res';
  const tabs = [['live', `Live${live.length ? ' · ' + live.length : ''}`], ['soon', 'Ближайшие'], ['res', 'Результаты']].map(([k, l]) => `<button type="button" class="hm-tab${tab === k ? ' on' : ''}" data-hmt="${k}">${l}</button>`).join('');
  const rowEv = x => H.bmatchRow(Object.assign({}, x.m, { __stage: x.snap.name }));
  const body = tab === 'live' ? live.slice(0, 6).map(rowEv).join('') : tab === 'soon' ? soon.slice(0, 7).map(rowEv).join('') : res.map(m => H.matchRow(m)).join('');
  return `<section class="hs-box hm-matches"><header class="hs-box-h"><h3>Матчи</h3><div class="hm-tabs">${tabs}</div><button type="button" class="hs-more" data-nav="matches">все →</button></header><div class="hs-box-b">${body || empty(tab === 'res' ? 'Результатов пока нет' : 'Нет матчей')}</div></section>`;
}
const HOME_CATS = [['all', 'Все'], ['match', 'Матчи'], ['tournament', 'Турниры'], ['transfer', 'Трансферы'], ['rumor', 'Слухи'], ['ranking', 'Рейтинг'], ['player', 'Игроки']];
function newsBlock(skip) {
  const f = H.S.hm, fd = H.feed().filter(n => n.id !== skip);
  const groups = { tournament: ['tournament', 'major', 'event', 'preview'], player: ['player', 'award', 'stats'], transfer: ['transfer', 'roster', 'coach'] };
  const list = fd.filter(n => f.nc === 'all' || n.cat === f.nc || (groups[f.nc] || []).includes(n.cat)).slice(0, 12);
  const chips = HOME_CATS.map(([k, l]) => `<button type="button" class="hm-tab${f.nc === k ? ' on' : ''}" data-hmc="${k}">${l}</button>`).join('');
  return `<section class="hs-box hm-news"><header class="hs-box-h"><h3>Новости</h3><div class="hm-tabs">${chips}</div><button type="button" class="hs-more" data-nav="news">вся лента →</button></header>
    <div class="hs-box-b">${list.map(newsLine).join('') || empty('В этой рубрике пока пусто')}</div></section>`;
}
function newsLine(n) {
  const c = catOf(n.cat), img = newsVisual(n, false);
  return `<article class="nl${(n.imp || 0) >= 8 ? ' hot' : ''}" data-art="${esc(n.id)}" tabindex="0"><div class="nl-img">${img}</div><div class="nl-t"><div class="nl-k"><span class="hs-ncat c-${esc(n.cat)}">${esc(c.l)}</span>${n.rumor ? `<span class="hm-rumor${n.confirmed ? ' ok' : n.denied ? ' no' : ''}">${n.confirmed ? 'подтверждено' : n.denied ? 'опровергнуто' : 'слух'}</span>` : ''}</div><h4>${esc(n.title)}</h4><p>${esc(n.lead || '')}</p></div><time>${H.ndate(n.ts)}</time></article>`;
}
H.newsLine = newsLine;
function rightCol() {
  const evs = H.events ? H.events() : [], now = H.nowMs(), cur = (typeof seasonState !== 'undefined' && seasonState.currentSeason) || 1;
  const live = evs.filter(e => e.status === 'live');
  const big = evs.filter(e => e.status === 'scheduled' && e.season === cur && ['major', 'elite', 'regular'].includes(e.kind)).sort((a, b) => a.startMs - b.startMs).slice(0, 4);
  const evLine = e => `<button type="button" class="hm-ev" data-event="${esc(e.id)}"><span class="hs-ev-tr sm">${trophy(e.name, e.season, e.kind)}</span><span><b>${esc(e.name)}</b><small>${fdate(e.startMs)} – ${fdate(e.endMs)} · <span class="hs-kind k-${e.kind}">${KIND[e.kind]}</span></small></span>${e.status === 'live' ? '<span class="hs-live">LIVE</span>' : ''}</button>`;
  const r = H.ranked().filter(t => !t.isAcademy).slice(0, 10);
  const mv = H.rankMove || (() => 0);
  const top = r.map((t, i) => { const d = mv(t.name); return `<button type="button" class="hm-rk" data-team="${esc(t.name)}"><span class="n">${i + 1}</span>${logo(t.name, 'sm')}<span class="nm">${esc(t.name)}</span><span class="pts">${Math.round(t.pts)}</span><span class="d ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '–'}</span></button>`; }).join('');
  const tr = (NW()?.transfers() || []).slice(0, 5).map(x => `<button type="button" class="hm-tr" data-art="${esc(x.id)}"><b>${esc(x.player)}</b><span>${logo(x.from, 'xs')}<i>→</i>${logo(x.team, 'xs')} ${esc(x.team)}</span><small>${esc(x.ttype || 'трансфер')}</small></button>`).join('');
  const potw = playerOfWeek();
  const potwHtml = potw ? `<button type="button" class="hm-potw" data-player="${esc(potw.nick)}"><span class="hm-potw-ph">${H.photoHtml(potw.p)}</span><span class="hm-potw-t"><b>${pFlag(potw.p)} ${esc(potw.nick)}</b><small>${esc(potw.team)}</small><em><b class="${ratingCls(potw.l.rating)}">${f2(potw.l.rating)}</b> Rating 2.0 · ${potw.l.maps} карт · ${potw.l.k}–${potw.l.d}</em><small>${esc(potw.evs)}</small></span></button>` : '';
  return [
    live.length ? box('Сейчас идут', live.slice(0, 5).map(evLine).join(''), '<button type="button" class="hs-more" data-nav="events">все →</button>', 'flush') : '',
    big.length ? box('Крупные турниры впереди', big.map(evLine).join(''), '<button type="button" class="hs-more" data-nav="calendar">календарь →</button>', 'flush') : '',
    box('Рейтинг команд', top, '<button type="button" class="hs-more" data-nav="ranking">весь →</button>', 'flush'),
    potw ? box('Игрок недели', potwHtml, '', 'flush') : '',
    tr ? box('Трансферы', tr, '<button type="button" class="hs-more" data-nav="transfers">все →</button>', 'flush') : '',
    H.pollBox()
  ].join('');
}
// игрок недели: лучший Rating 2.0 по двум последним завершённым турнирам Tier-1 (минимум 4 карты)
function playerOfWeek() {
  const st = H.stats(), arch = H.archive();
  const ids = Object.values(arch).filter(s => s && ['major', 'elite', 'regular'].includes(s.prestige)).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2);
  if (!ids.length) return null;
  let best = null;
  Object.values(st.P).forEach(o => {
    const z = H.Z0(); let team = o.team, n = 0;
    ids.forEach(s => { const e = o.byEv[s.id]; if (e) { n++; team = e.team; Object.keys(z).forEach(k => { z[k] += e.s[k]; }); } });
    if (!n || z.maps < 4) return; const l = H.line(z);
    if (!best || l.rating > best.l.rating) best = { nick: o.nick, p: o.p, team, l };
  });
  if (best) best.evs = ids.map(s => s.name).join(' · ');
  return best;
}
H.PAGES.home = () => {
  const L = lead(), skip = L?.type === 'news' ? L.n.id : null;
  const warn = (document.getElementById('event-alert-box')?.textContent || '').includes('Хранилище') ? `<div class="hm-warn" role="alert">Хранилище браузера заполнено — часть прогресса может не сохраниться. <button type="button" class="hs-btn sm" data-nav="settings">Экспорт сейва</button></div>` : '';
  return `${warn}<div class="hm-top">${heroHtml(L)}<div class="hm-sides">${sideStories(skip) || ''}</div></div>
    <div class="hs-grid2 hm-grid"><div class="hs-col">${matchesBlock()}${newsBlock(skip)}</div><div class="hs-col">${rightCol()}</div></div>`;
};
H.CLICKS.push(['[data-hmt]', el => { H.S.hm.mt = el.dataset.hmt; H.render(); }]);
H.CLICKS.push(['[data-hmc]', el => { H.S.hm.nc = el.dataset.hmc; H.render(); }]);

/* ---------- лента новостей ---------- */
H.S.news = Object.assign(H.S.news || {}, { cat: 'all', view: 'feed', team: '', q: '', sort: 'new', page: 1 });
H.PAGES.news = () => {
  const f = H.S.news, cats = H.NCATS(), fd = H.feed();
  const counts = {}; fd.forEach(n => counts[n.cat] = (counts[n.cat] || 0) + 1);
  const order = Object.keys(cats).filter(k => counts[k]);
  const chips = ['all', ...order].map(k => `<button type="button" class="hs-chip${f.cat === k ? ' on' : ''}" data-ncat="${k}">${k === 'all' ? 'Все' : esc(cats[k].l)} <small>${k === 'all' ? fd.length : counts[k]}</small></button>`).join('');
  const q = f.q.trim().toLowerCase();
  let list = fd.filter(x => f.cat === 'all' || x.cat === f.cat);
  if (q) list = list.filter(x => (x.title + ' ' + (x.lead || '') + ' ' + (x.tags || []).map(t => t.v).join(' ')).toLowerCase().includes(q));
  if (f.sort === 'imp') list = list.slice().sort((a, b) => (b.imp || 0) - (a.imp || 0) || b.ts - a.ts);
  const pg = H.paginate(list, 'news', 20);
  const tools = `<div class="hs-filters nw-tools"><input type="search" class="hs-inp" id="pt-nq" placeholder="Поиск по новостям" value="${esc(f.q)}">
    <select class="hs-inp sm" data-nsort><option value="new"${f.sort === 'new' ? ' selected' : ''}>Сначала новые</option><option value="imp"${f.sort === 'imp' ? ' selected' : ''}>Сначала важные</option></select></div>`;
  return `<div class="hs-head"><h1>Новости</h1>${tools}</div><div class="hs-filters hs-ncats">${chips}</div>
    <div class="hs-grid2"><div class="hs-col" data-pg-anchor><section class="hs-box"><div class="hs-box-b">${pg.rows.map(newsLine).join('') || empty('Ничего не найдено')}</div>${pg.html}</section></div>
    <div class="hs-col">${H.pollBox()}${box('Рубрики', `<div class="nw-legend">${order.map(k => `<button type="button" data-ncat="${k}"><span class="hs-ncat c-${k}">${esc(cats[k].l)}</span><b>${counts[k]}</b></button>`).join('')}</div>`)}</div></div>`;
};
document.addEventListener('change', e => { if (e.target.matches?.('#hs-root [data-nsort]')) { H.S.news.sort = e.target.value; H.S.news.page = 1; H.render(); } });
let nqT = null;
document.addEventListener('input', e => { if (e.target.id !== 'pt-nq') return; clearTimeout(nqT); const v = e.target.value; nqT = setTimeout(() => { H.S.news.q = v; H.S.news.page = 1; H.render(); const i = document.getElementById('pt-nq'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); });

/* ---------- статья: связанные сущности и турнир внутри портала ---------- */
const origArticle = H.PAGES.article;
H.PAGES.article = id => {
  let html = origArticle(id);
  const n = H.findNews(id);
  if (n?.rumor) html = html.replace('<h1>', `<div class="art-rumor ${n.confirmed ? 'ok' : n.denied ? 'no' : ''}">${n.confirmed ? 'Слух подтвердился' : n.denied ? 'Слух опровергнут' : 'Слух · не подтверждён официально'}</div><h1>`);
  return html.replace(/>🏆 Сетка турнира</g, '>Страница турнира<');
};
console.info('[v30] главная и лента портала');
})();
