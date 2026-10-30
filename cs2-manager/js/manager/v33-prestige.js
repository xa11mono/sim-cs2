/* v33 — престиж команды (0–100, 1–5 звёзд).
   Складывается из титулов за всю историю (свежие весят больше: −15% за каждый прошедший сезон) и репутации
   организации. На что влияет:
   • переговоры: агент игрока просит меньше у престижного клуба и больше у непрестижного (±20%);
   • рынок AI: шансы сделки сдвигаются на 0.4% за пункт разницы престижа; звезда не уходит в клуб,
     который на 35+ пунктов менее престижен её нынешнего.
   Показывается в рейтинге команд, на странице команды и в штабе организации. */
(function () {
'use strict';
const H = window.HS;
const W = { major: 18, elite: 9, regular: 5, tier2: 1.5, tier3: 0.6, academy: 0.4 };
let cache = null, cacheKey = '';
function table() {
  const arch = H ? H.archive() : {}, n = Object.keys(arch).length, cur = (typeof seasonState !== 'undefined' && seasonState.currentSeason) || 1;
  const key = n + '|' + cur; if (cache && key === cacheKey) return cache;
  const pts = {};
  Object.values(arch).forEach(s => { if (!s || !s.champion || s.champion === '—') return;
    const w = (W[s.prestige] || 1) * Math.pow(0.85, Math.max(0, cur - (s.season || cur)));
    pts[s.champion] = (pts[s.champion] || 0) + w; });
  cache = pts; cacheKey = key; return pts;
}
function prestige(name) {
  if (!name) return 0;
  const t = typeof teams !== 'undefined' ? teams.find(x => x.name === name) : null;
  const rep = (window.V31 && window.V31.org) ? (+window.V31.org(name).rep || 30) : 30;
  const p = table()[name] || 0;
  // команды без архива (новая игра): стартовый престиж по прошлым трофеям из данных команды
  const hist = ((window.CS2_REAL && window.CS2_REAL.legacy) || {})[name] || 0;   // известность организации до начала игры
  const legacy = hist + (t?.trophies ? (t.trophies.majors || 0) * 10 + (t.trophies.elite || 0) * 4 + (t.trophies.regular || 0) * 2 : 0);
  const v = rep * 0.45 + 55 * (1 - Math.exp(-(p + legacy) / 40));
  return Math.round(Math.max(0, Math.min(100, t?.isAcademy ? v * 0.5 : v)));
}
const stars = v => v >= 80 ? 5 : v >= 60 ? 4 : v >= 40 ? 3 : v >= 20 ? 2 : 1;
const starsHtml = v => `<span class="pr-stars" title="Престиж ${v} из 100">${'★'.repeat(stars(v))}<i>${'★'.repeat(5 - stars(v))}</i></span>`;
// множитель зарплатных требований агента: 0.8 (престиж 100) … 1.2 (престиж 0)
const wageMul = name => 1.2 - prestige(name) / 250;
const oddsAdj = (from, to) => (prestige(to) - prestige(from)) * 0.004;
const refuses = (p, from, to) => { const star = typeof isStarPlayer === 'function' && isStarPlayer(p); return star && prestige(to) < prestige(from) - 35; };
window.V33Prestige = { prestige, stars, starsHtml, wageMul, oddsAdj, refuses };

if (!H) return;
// страница команды: показатель в шапке (колонка в рейтинге — в v30-portal-people.js)
const origTeam = H.PAGES.team;
if (origTeam) H.PAGES.team = arg => {
  const html = origTeam(arg), name = String(arg || '').split('/')[0], v = prestige(name);
  return shelf(name, html.replace('<div><small>Титулы</small>', `<div><small>Престиж</small><b>${starsHtml(v)} <span class="hs-dim">${v}</span></b></div><div><small>Титулы</small>`));
};
// Полка трофеев прямо в шапке команды: Major первыми, затем свежие; клик — страница турнира
const RANK = { major: 0, elite: 1, regular: 2, tier2: 3, tier3: 4, academy: 5 };
function shelf(name, html) {
  // строго по времени: новые слева; Grand Slam — на своём месте по дате
  const cups = Object.values(H.archive()).filter(s => s && s.champion === name && !s.show)
    .map(s => ({ s: s.season || 0, t: s.ge || s.gs || s.ts || 0, html: `<button type="button" class="tm-cup k-${s.prestige}" data-event="${H.esc(s.id)}" data-tip="${H.esc(s.name)} · ${s.year || H.yearOf(s.season)}">${H.trophy(s.name, s.season, s.prestige)}<i>${s.year || H.yearOf(s.season)}</i></button>` }));
  const extra = (window.V33Awards && window.V33Awards.teamShelfItems) ? window.V33Awards.teamShelfItems(name) : [];
  const won = cups.concat(extra).sort((a, b) => (b.s - a.s) || (b.t - a.t));
  if (!won.length) return html;
  const items = won.slice(0, 24).map(x => x.html).join('');
  const more = won.length > 24 ? `<button type="button" class="tm-cup more" data-ttab="ach">+${won.length - 24}</button>` : '';
  const bar = `<div class="tm-shelf" aria-label="Трофеи">${items}${more}</div>`;
  const i = html.indexOf('</header>');
  return i < 0 ? html + bar : html.slice(0, i + 9) + bar + html.slice(i + 9);
}
console.info('[v33] престиж команд');
})();
