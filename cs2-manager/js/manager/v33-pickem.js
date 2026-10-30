/* v33 — Pick'Em на Major (#/pickem): этапы Stage I–III и плей-офф.
   Слева — команды этапа, в центре — реальная швейцарская сетка этапа, справа — ячейки прогноза:
   3:0 (2 команды), 3:1/3:2 — выход (6), 0:3 (2); в плей-офф — победители ¼ (4), ½ (2) и чемпион.
   Пики принимаются, пока на этапе не сыгран ни один матч. Хранятся в currentPickem.major (по нему считает
   очки движок) и в seasonState.v33Pickem — чтобы пережить перезагрузку. */
(function () {
'use strict';
const H = window.HS; if (!H) return;
const { esc, logo, box, empty } = H;
const CT = () => (typeof currentTournament !== 'undefined' ? currentTournament : null);
const SS = () => (typeof seasonState !== 'undefined' ? seasonState : null);
const ST_CATS = [['threeZero', '3:0', 2, 'adv'], ['advance', '3:1 · 3:2 — выход', 6, 'adv'], ['zeroThree', '0:3', 2, 'out']];
const PO_CATS = [['qf', 'Победители ¼ финала', 4, 'adv'], ['sf', 'Победители ½ финала', 2, 'adv'], ['champion', 'Чемпион', 1, 'gold']];
const UI = { tab: '1', cat: 'threeZero' };

// звания за очки Pick'Em сезона — вместо «Бронза / Серебро / Золото»
const RANKS = [[0, 'Зритель', '#7d8794'], [3, 'Знаток', '#4fa3e0'], [6, 'Аналитик', '#3ecf8e'], [12, 'Эксперт', '#f5a524'], [18, 'Оракул', '#c084fc'], [26, 'Легенда Pick’Em', '#ff5c7a']];
const rankOf = pts => { let r = RANKS[0]; RANKS.forEach(x => { if (pts >= x[0]) r = x; }); const i = RANKS.indexOf(r); return { name: r[1], color: r[2], next: RANKS[i + 1] ? RANKS[i + 1][0] : null, nextName: RANKS[i + 1]?.[1] }; };
window.V33Pickem = { rankOf };

function restore() { // после перезагрузки вернуть пики идущего Major
  const s = SS(), ct = CT(); if (!s || !ct || !ct.isMajor) return;
  const saved = s.v33Pickem; if (saved && saved.t === ct.name && saved.major && typeof currentPickem !== 'undefined') currentPickem.major = saved.major;
}
function persist() {
  const s = SS(), ct = CT(); if (!s || !ct) return;
  s.v33Pickem = { t: ct.name, major: currentPickem.major };
  try { saveSeasonState(); } catch (e) {}
}
const major = () => { if (typeof currentPickem === 'undefined') return null; currentPickem.major = currentPickem.major || { stages: {}, playoffs: { qf: [], sf: [], champion: null } }; return currentPickem.major; };
const stageOf = i => CT()?.majorStages?.[i - 1] || null;
const started = st => (st?.rounds || []).some(r => (r || []).some(m => m && m.winner));
function stagePicks(i) { const m = major(); const p = m.stages[i] || (m.stages[i] = { threeZero: [], advance: [], zeroThree: [] }); return p; }
function poPicks() { const m = major(); m.playoffs = m.playoffs || { qf: [], sf: [], champion: null }; return m.playoffs; }
function poRoster() { const st = stageOf(3); return st?.completed ? st.teams.filter(t => t.wins >= 3).map(t => t.name) : []; }
const poStarted = () => { const ct = CT(); return !!ct && (ct.matches || []).some(m => m && !m.isSwiss && m.winner && /четверть|quarter|¼/i.test(String(m.stage || m.round || ''))); };

function toSnapRounds(st) { return (st.rounds || []).map((r, i) => ({ title: `Раунд ${i + 1}`, ms: (r || []).map(m => ({ a: m.t1, b: m.t2, w: m.winner || null, s: m.score ? String(m.score).match(/\d+/g)?.map(Number) : null, mp: [] })) })); }

function pPickem(arg) {
  restore();
  const ct = CT(), s = SS() || {}, pts = s.pickemScore || 0, rk = rankOf(pts);
  const rankBox = `<div class="pk-rank" style="--rk:${rk.color}"><span class="pk-badge">${esc(rk.name)}</span><b>${pts}</b><small>очков Pick'Em за сезон${rk.next != null ? ` · до «${esc(rk.nextName)}» ${rk.next - pts}` : ''}</small></div>`;
  if (!ct || !ct.isMajor || ct.completed) {
    const nx = (s.seasonSchedule || []).find((e, i) => e && e.type === 'major' && i >= (s.tournamentIndex || 0));
    return `<div class="hs-head"><h1>Pick'Em Major</h1>${rankBox}</div>${box('Прогнозы на Major', empty(nx ? `Пики откроются, когда начнётся ${esc(nx.name)}${nx.calendar?.startMs ? ' (' + H.fdate(nx.calendar.startMs) + ')' : ''}.` : 'Ближайшего Major в этом сезоне нет.'))}`;
  }
  const tabs = [1, 2, 3].map(i => { const st = stageOf(i); return `<button type="button" class="pk-tab${UI.tab === String(i) ? ' on' : ''}${st ? '' : ' off'}" data-pktab="${i}" ${st ? '' : 'disabled'}>${st?.completed ? '✓ ' : ''}Stage ${'I'.repeat(i)}</button>`; }).join('') +
    `<button type="button" class="pk-tab${UI.tab === 'po' ? ' on' : ''}${poRoster().length ? '' : ' off'}" data-pktab="po" ${poRoster().length ? '' : 'disabled'}>Плей-офф</button>`;
  let body = '';
  if (UI.tab === 'po') {
    const ros = poRoster(), p = poPicks(), lock = poStarted();
    const cand = { qf: ros, sf: p.qf, champion: p.sf };
    if (!(UI.cat in cand)) UI.cat = 'qf';
    const all = { qf: p.qf, sf: p.sf, champion: p.champion ? [p.champion] : [] };
    body = layout(cand[UI.cat], PO_CATS, all, lock, 'po', null);
  } else {
    const i = +UI.tab, st = stageOf(i); if (!st) { UI.tab = '1'; return pPickem(arg); }
    if (!ST_CATS.some(c => c[0] === UI.cat)) UI.cat = 'threeZero';
    const p = stagePicks(i), lock = started(st) || st.completed;
    const res = st.completed ? { threeZero: st.teams.filter(t => t.wins === 3 && t.losses === 0).map(t => t.name), advance: st.teams.filter(t => t.wins >= 3).map(t => t.name), zeroThree: st.teams.filter(t => t.wins === 0 && t.losses === 3).map(t => t.name) } : null;
    body = layout(st.teams.map(t => t.name), ST_CATS, p, lock, String(i), res, st);
  }
  return `<div class="hs-head"><h1>Pick'Em · ${esc(ct.name)}</h1>${rankBox}</div><div class="pk-tabs">${tabs}</div>${body}`;
}
// Швейцарская сетка Pick'Em как на Major: все пять раундов сразу (неизвестные пары — «? vs ?»),
// ячейки прогноза встроены в сетку: 3:0 и 0:3 — в 4-й колонке, «3:1 · 3:2 — выход» — в 5-й.
const POOL_N = { '0:0': 8, '1:0': 4, '0:1': 4, '2:0': 2, '1:1': 4, '0:2': 2, '2:1': 3, '1:2': 3, '2:2': 3 };
const COLS = [['0:0'], ['1:0', '0:1'], ['2:0', '1:1', '0:2'], ['@threeZero', '2:1', '1:2', '@zeroThree'], ['@advance', '2:2', '@out']];
function pools(st) {
  const rec = {}, R = n => rec[n] || (rec[n] = { w: 0, l: 0 }), out = {};
  (st?.rounds || []).forEach(r => {
    (r || []).forEach(m => { if (!m || !m.t1) return; const a = R(m.t1), k = `${a.w}:${a.l}`; (out[k] = out[k] || []).push(m); });
    (r || []).forEach(m => { if (!m?.winner) return; const lo = m.winner === m.t1 ? m.t2 : m.t1; R(m.winner).w++; R(lo).l++; });
  });
  return { out, rec };
}
const lg = n => `<span class="pk-lg" title="${esc(n)}">${logo(n, 'sm')}</span>`;
function mrow(m) {
  if (!m) return `<div class="pk-m"><span class="pk-q">?</span><i>vs</i><span class="pk-q">?</span></div>`;
  const w = m.winner, cls = n => w ? (w === n ? ' w' : ' l') : '';
  return `<div class="pk-m${w ? ' done' : ''}"><span class="pk-c${cls(m.t1)}">${lg(m.t1)}</span><i>${w && m.score ? esc(String(m.score).replace(/^Сч[её]т:\s*/, '').replace(/\s/g, '')) : 'vs'}</i><span class="pk-c${cls(m.t2)}">${lg(m.t2)}</span></div>`;
}
function layout(roster, cats, picks, lock, scope, res, st) {
  const placed = new Set(cats.flatMap(([k]) => picks[k] || []));
  const list = roster.map(n => `<button type="button" class="pk-team${placed.has(n) ? ' used' : ''}" data-pkteam="${esc(n)}" ${lock ? 'disabled' : ''} title="${esc(n)}">${logo(n, 'sm')}</button>`).join('');
  const pickBox = k => { const c = cats.find(x => x[0] === k); if (!c) return ''; const [, label, max, cls] = c, arr = picks[k] || [], ok = res ? res[k] : null;
    const cells = Array.from({ length: max }, (_, j) => { const n = arr[j];
      if (!n) return `<span class="pk-slot empty">?</span>`;
      const mark = ok ? (ok.includes(n) ? ' hit' : ' miss') : '';
      return `<button type="button" class="pk-slot${mark}" data-pkdrop="${esc(k)}|${esc(n)}" ${lock ? 'disabled' : ''} title="${esc(n)}">${logo(n, 'sm')}</button>`; }).join('');
    return `<div class="pk-box ${cls}${UI.cat === k && !lock ? ' on' : ''}" data-pkcat="${k}" role="button" tabindex="0"><h6>${label}<i>${arr.length}/${max}</i></h6><div class="pk-cells">${cells}</div></div>`; };
  let board = '';
  if (st) {
    const { out, rec } = pools(st);
    const elim = Object.entries(rec).filter(([, x]) => x.l === 3 && x.w > 0).map(([n]) => n);
    board = `<div class="pk-board">${COLS.map((col, ci) => `<div class="pk-col">${col.map(k => {
      if (k === '@out') return `<div class="pk-box out ro"><h6>2:3 · 1:3 — вылет</h6><div class="pk-cells">${elim.length ? elim.map(n => `<span class="pk-slot">${logo(n, 'sm')}</span>`).join('') : Array.from({ length: 6 }, () => '<span class="pk-slot empty">?</span>').join('')}</div></div>`;
      if (k[0] === '@') return pickBox(k.slice(1));
      const ms = (out[k] || []).slice(); while (ms.length < (POOL_N[k] || 0)) ms.push(null);
      return `<div class="pk-pool"><h6>${k}</h6>${ms.map(mrow).join('')}${ci < COLS.length - 1 ? '<i class="pk-ar up"></i><i class="pk-ar dn"></i>' : ''}</div>`; }).join('')}</div>`).join('')}</div>`;
  } else board = `<div class="pk-po">${cats.map(([k]) => pickBox(k)).join('')}</div>`;
  const score = res ? cats.reduce((s, [k]) => s + (picks[k] || []).filter(n => res[k].includes(n)).length, 0) : null;
  const status = lock ? (res ? `<span class="pk-st done">Этап завершён · угадано ${score}</span>` : '<span class="pk-st lock">Пики закрыты: этап начался</span>') : `<span class="pk-st open">Выберите ячейку и нажимайте на команды слева · пики сохраняются сразу</span>`;
  return `<div class="pk-bar">${status}${lock ? '' : `<button type="button" class="hs-btn ghost sm" data-pkauto>Заполнить по рейтингу</button><button type="button" class="hs-btn ghost sm" data-pkclear>Очистить</button>`}</div>
    <div class="pk"><aside class="pk-list"><small>Команды этапа</small><div>${list}</div></aside><div class="pk-main">${board}</div></div>`;
}
function curPicks() { if (UI.tab === 'po') { const p = poPicks(); return { get: k => k === 'champion' ? (p.champion ? [p.champion] : []) : p[k], set: (k, v) => { if (k === 'champion') p.champion = v[0] || null; else p[k] = v; } }; }
  const p = stagePicks(+UI.tab); return { get: k => p[k], set: (k, v) => { p[k] = v; } }; }
const maxOf = k => ([...ST_CATS, ...PO_CATS].find(c => c[0] === k) || [0, 0, 1])[2];
function addTeam(n) {
  const c = curPicks(), k = UI.cat, arr = (c.get(k) || []).slice();
  if (arr.includes(n)) return;
  if (UI.tab !== 'po') ['threeZero', 'advance', 'zeroThree'].forEach(x => { if (x !== k) c.set(x, (c.get(x) || []).filter(y => y !== n)); });
  if (arr.length >= maxOf(k)) arr.shift();
  arr.push(n); c.set(k, arr);
  if (UI.tab === 'po') { const p = poPicks(); p.sf = p.sf.filter(x => p.qf.includes(x)); if (p.champion && !p.sf.includes(p.champion)) p.champion = null; }
  // ячейка заполнена — переходим к следующей
  const cats = UI.tab === 'po' ? PO_CATS : ST_CATS; if (arr.length >= maxOf(k)) { const nx = cats.find(([x, , m]) => (c.get(x) || []).length < m); if (nx) UI.cat = nx[0]; }
  persist();
}
function autoFill() {
  const strength = n => { const t = H.teamBy(n); return (t?.pts || 0) * ((t?.form || 100) / 100); };
  if (UI.tab === 'po') { const ros = poRoster().slice().sort((a, b) => strength(b) - strength(a)), p = poPicks(); p.qf = ros.slice(0, 4); p.sf = p.qf.slice(0, 2); p.champion = p.sf[0] || null; }
  else { const st = stageOf(+UI.tab), ros = st.teams.map(t => t.name).sort((a, b) => strength(b) - strength(a)), p = stagePicks(+UI.tab); p.threeZero = ros.slice(0, 2); p.advance = ros.slice(2, 8); p.zeroThree = ros.slice(-2); }
  persist();
}
const rer = () => { const y = window.scrollY; H.render(); window.scrollTo(0, y); document.getElementById('hs-page')?.classList.remove('hs-anim'); };
H.PAGES.pickem = pPickem;
H.SECTION_OF.pickem = 'matches';
H.NAV_MORE.unshift(['pickem', "Pick'Em Major"]);
H.CLICKS.push(['[data-pktab]', el => { UI.tab = el.dataset.pktab; UI.cat = UI.tab === 'po' ? 'qf' : 'threeZero'; rer(); }]);
H.CLICKS.push(['[data-pkteam]', el => { addTeam(el.dataset.pkteam); rer(); }]);
H.CLICKS.push(['[data-pkdrop]', el => { const [k, n] = el.dataset.pkdrop.split('|'); const c = curPicks(); c.set(k, (c.get(k) || []).filter(x => x !== n)); if (UI.tab === 'po') { const p = poPicks(); p.sf = p.sf.filter(x => p.qf.includes(x)); if (p.champion && !p.sf.includes(p.champion)) p.champion = null; } UI.cat = k; persist(); rer(); }]);
H.CLICKS.push(['[data-pkcat]', el => { UI.cat = el.dataset.pkcat; rer(); }]);   // ячейка — после клика по команде в ячейке
H.CLICKS.push(['[data-pkauto]', () => { autoFill(); rer(); }]);
H.CLICKS.push(['[data-pkclear]', () => { if (UI.tab === 'po') { const p = poPicks(); p.qf = []; p.sf = []; p.champion = null; } else { const p = stagePicks(+UI.tab); p.threeZero = []; p.advance = []; p.zeroThree = []; } UI.cat = UI.tab === 'po' ? 'qf' : 'threeZero'; persist(); rer(); }]);
// на странице Major — кнопка Pick'Em
const origEvent = H.PAGES.event;
H.PAGES.event = id => { const html = origEvent(id); const ct = CT();
  return ct && ct.isMajor && !ct.completed && (id === 'cur') ? html.replace('</header>', `<div class="ev-pk"><button type="button" class="hs-btn" data-nav="pickem">Pick'Em Major</button></div></header>`) : html; };
setTimeout(restore, 1500);
console.info("[v33] Pick'Em Major");
})();
