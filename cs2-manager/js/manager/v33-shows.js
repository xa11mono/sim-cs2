/* v33 — шоу-турниры и Кубок наций. На рейтинг, призовые клубов и личные титулы не влияют.
   • Streamers Battle (СНГ, Европа, Бразилия) и All-Star Showmatch: команды собираются вокруг капитанов-звёзд
     из реальных игроков региона (змейкой по уровню), без смены клубов; большая аудитория.
   • eSports Nations Cup (декабрь): 8 сильнейших сборных — 5 лучших игроков страны из всех клубов;
     клубы отпускают игроков, составы не меняются.
   Каждый турнир разыгрывается в свой игровой день, попадает в архив (страница турнира, сетка, итоги)
   и в новости — анонс за 3 дня и итог с числом зрителей. */
(function () {
'use strict';
const H = window.HS;
if (typeof teams === 'undefined' || typeof seasonState === 'undefined') return;
const DAY = 864e5;
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const rng = seed => { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pow = p => (+p.firepower || 0) * .4 + (+p.tacticalIQ || 0) * .25 + (+p.clutch || 0) * .2 + (+p.utility || 0) * .15;
const nowMs = () => Number(seasonState.calendar?.currentMs) || Date.now();
const yearOf = s => 2025 + (s || 1);
const CIS = ['RU', 'UA', 'BY', 'KZ', 'UZ', 'KG', 'AM', 'GE', 'MD', 'LV', 'LT', 'EE'];
const EU = ['DK', 'SE', 'NO', 'FI', 'FR', 'DE', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'RS', 'BA', 'HR', 'SI', 'ME', 'MK', 'XK', 'GB', 'IE', 'NL', 'BE', 'PT', 'ES', 'IT', 'TR', 'IL', 'CH', 'AT', 'GR'];
const SA = ['BR', 'AR', 'CL', 'UY', 'PE', 'CO'];
const NATION = { RU: 'Россия', UA: 'Украина', BY: 'Беларусь', KZ: 'Казахстан', DK: 'Дания', SE: 'Швеция', NO: 'Норвегия', FI: 'Финляндия', FR: 'Франция', DE: 'Германия', PL: 'Польша', CZ: 'Чехия', SK: 'Словакия', HU: 'Венгрия', RO: 'Румыния', BG: 'Болгария', RS: 'Сербия', BA: 'Босния и Герцеговина', GB: 'Великобритания', NL: 'Нидерланды', BE: 'Бельгия', PT: 'Португалия', ES: 'Испания', TR: 'Турция', IL: 'Израиль', BR: 'Бразилия', AR: 'Аргентина', CL: 'Чили', US: 'США', CA: 'Канада', AU: 'Австралия', MN: 'Монголия', CN: 'Китай', LV: 'Латвия', LT: 'Литва', EE: 'Эстония', MK: 'Северная Македония', ME: 'Черногория', XK: 'Косово', ZA: 'ЮАР' };
// календарь шоу (месяц 0–11, день)
const SHOWS = [
  { key: 'sb-cis', name: 'Streamers Battle', m: 2, d: 21, region: CIS, kind: 'show', size: 4, viewers: [1.2, 2.6] },
  { key: 'sb-eu', name: 'Streamers Battle Europe', m: 5, d: 13, region: EU, kind: 'show', size: 4, viewers: [0.5, 1.2] },
  { key: 'allstar', name: 'All-Star Showmatch', m: 7, d: 9, region: null, kind: 'show', size: 2, viewers: [0.8, 1.6] },
  { key: 'sb-br', name: 'Streamers Battle Brasil', m: 8, d: 19, region: SA, kind: 'show', size: 4, viewers: [0.7, 1.5] },
  { key: 'nations', name: 'eSports Nations Cup', m: 11, d: 6, region: null, kind: 'nations', size: 8, viewers: [2.4, 4.2] }
];
const S = () => (seasonState.v33Shows = seasonState.v33Shows || {});
const pool = () => teams.filter(t => !t.isAcademy).flatMap(t => (t.players || []).map(p => ({ p, team: t.name })));
const dateOf = (sh, season) => new Date(yearOf(season), sh.m, sh.d, 18, 0, 0, 0).getTime();

function squadsFor(sh, season, r) {
  if (sh.kind === 'nations') {
    const by = {}; pool().forEach(x => { const c = x.p.country; if (/^[A-Z]{2}$/.test(c || '') && NATION[c]) (by[c] = by[c] || []).push(x); });
    return Object.entries(by).filter(([, l]) => l.length >= 5).map(([c, l]) => { const five = l.sort((a, b) => pow(b.p) - pow(a.p)).slice(0, 5); return { name: NATION[c], cc: c, players: five, str: five.reduce((s, x) => s + pow(x.p), 0) / 5 }; })
      .sort((a, b) => b.str - a.str).slice(0, sh.size);
  }
  let list = pool().filter(x => !sh.region || sh.region.includes(x.p.country)).sort((a, b) => pow(b.p) - pow(a.p));
  if (sh.key === 'allstar') { // СНГ против остального мира
    const cis = pool().filter(x => CIS.includes(x.p.country)).sort((a, b) => pow(b.p) - pow(a.p)).slice(0, 5), rest = pool().filter(x => !CIS.includes(x.p.country)).sort((a, b) => pow(b.p) - pow(a.p)).slice(0, 5);
    return cis.length === 5 && rest.length === 5 ? [{ name: 'All-Stars СНГ', players: cis, str: cis.reduce((s, x) => s + pow(x.p), 0) / 5 }, { name: 'All-Stars World', players: rest, str: rest.reduce((s, x) => s + pow(x.p), 0) / 5 }] : [];
  }
  const n = sh.size; list = list.slice(0, n * 5 + 4);
  if (list.length < n * 5) return [];
  const caps = list.slice(0, n), rest = list.slice(n).sort(() => r() - .5).sort((a, b) => pow(b.p) - pow(a.p) + (r() - .5) * 6), sq = caps.map(c => ({ name: `Команда ${c.p.nick}`, players: [c] }));
  for (let i = 0; sq.some(s => s.players.length < 5) && i < rest.length; i++) { const round = Math.floor(i / n), j = round % 2 ? n - 1 - (i % n) : i % n; if (sq[j].players.length < 5) sq[j].players.push(rest[i]); }
  sq.forEach(s => { s.str = s.players.reduce((a, x) => a + pow(x.p), 0) / s.players.length; });
  return sq;
}
const MAPS = ['Mirage', 'Inferno', 'Nuke', 'Dust II', 'Ancient', 'Anubis', 'Train'];
function playSeries(a, b, r, bo) {
  const pA = 1 / (1 + Math.exp(-(a.str - b.str) / 3.5)); let wa = 0, wb = 0; const mp = [], need = Math.ceil(bo / 2), maps = MAPS.slice().sort(() => r() - .5);
  while (wa < need && wb < need) {
    const aw = r() < pA, lo = r() < .12 ? 14 : Math.floor(3 + r() * 9), sc = r() < .12 ? [16, 14] : [13, lo > 11 ? 11 : lo];
    mp.push([maps[mp.length], aw ? sc[0] : sc[1], aw ? sc[1] : sc[0]]); aw ? wa++ : wb++;
  }
  return { a: a.name, b: b.name, w: wa > wb ? a.name : b.name, s: [wa, wb], mp, bo };
}
function run(sh, season) {
  const st = S(), key = sh.key + '|' + season; if (st[key]) return;
  const r = rng(h32(key + (seasonState.v29Salt || ''))), sq = squadsFor(sh, season, r);
  st[key] = { done: true, at: nowMs() };
  if (sq.length < 2) return;
  const seed = sq.slice(); let cur = seed.length === 8 ? [0, 7, 3, 4, 1, 6, 2, 5].map(i => seed[i]) : seed.length === 4 ? [seed[0], seed[3], seed[1], seed[2]] : seed;
  const rounds = [], titles = cur.length === 8 ? ['Четвертьфинал', 'Полуфинал', 'Финал'] : cur.length === 4 ? ['Полуфинал', 'Финал'] : ['Шоуматч'];
  const placed = [];
  titles.forEach((title, i) => {
    const ms = [], next = [];
    for (let j = 0; j < cur.length; j += 2) { const m = playSeries(cur[j], cur[j + 1], r, title === 'Финал' || title === 'Шоуматч' ? (sh.kind === 'nations' ? 5 : 3) : 3); ms.push(m); next.push(cur[j].name === m.w ? cur[j] : cur[j + 1]); placed.unshift(cur[j].name === m.w ? cur[j + 1] : cur[j]); }
    rounds.push({ title, ms }); cur = next;
  });
  const champ = cur[0], results = [{ n: champ.name, p: 1 }].concat(placed.map((x, i) => ({ n: x.name, p: i === 0 ? 2 : i <= 2 ? 3 : 5 })));
  const rost = {}; sq.forEach(s => { rost[s.name] = s.players.map(x => ({ nick: x.p.nick, role: x.p.role, club: x.team, country: x.p.country })); });
  const t = nowMs(), id = `SH${season}-${sh.key}`;
  const snap = { id, v: 1, ts: Date.now(), tier: 'show', prestige: sh.kind, name: `${sh.name} ${yearOf(season)}`, season, year: yearOf(season), format: 'single', size: sq.length, champion: champ.name,
    blocks: [{ tab: 'playoff', title: sh.kind === 'nations' ? 'Плей-офф сборных' : 'Шоу-сетка', sections: [{ title: null, rounds }] }], results, gs: t, ge: t, rost, show: true };
  try { const A = window.hubArchiveExport(); A[id] = snap; window.hubArchiveImport(A); } catch (e) { console.warn('[v33 shows] архив', e); }
  const v = (sh.viewers[0] + r() * (sh.viewers[1] - sh.viewers[0])).toFixed(1), N = window.V29News;
  const final = rounds[rounds.length - 1].ms[0];
  if (N && N.add) N.add({ cat: 'event', icon: sh.kind === 'nations' ? '🌍' : '🎙️', title: sh.kind === 'nations' ? `${champ.name} — чемпион eSports Nations Cup ${yearOf(season)}!` : `${sh.name}: победа «${champ.name}»`,
    lead: `${final.w} обыграли ${final.w === final.a ? final.b : final.a} в финале со счётом ${Math.max(...final.s)}:${Math.min(...final.s)}. Пик зрителей — ${v} млн.`,
    body: [sh.kind === 'nations' ? `Состав: ${champ.players.map(x => `${x.p.nick} (${x.team})`).join(', ')}. Клубы отпустили игроков на турнир; на мировой рейтинг он не влияет.` : `Шоу-турнир звёзд: ${champ.players.map(x => x.p.nick).join(', ')}. На рейтинг и титулы клубов не влияет.`],
    tags: N.P ? champ.players.slice(0, 3).map(x => N.P(x.p.nick)) : [], imp: sh.kind === 'nations' ? 8 : 5, ev: id });
}
function preview(sh, season) {
  const st = S(), key = 'pre|' + sh.key + '|' + season, N = window.V29News; if (st[key] || !N || !N.add) return; st[key] = 1;
  N.add({ cat: 'preview', icon: sh.kind === 'nations' ? '🌍' : '🎙️', title: sh.kind === 'nations' ? `Через три дня — eSports Nations Cup ${yearOf(season)}` : `Скоро ${sh.name}: звёзды сыграют в шоу-турнире`,
    lead: sh.kind === 'nations' ? 'Восемь сильнейших сборных: лучшие пятёрки стран из всех клубов. Турнир не влияет на рейтинг.' : 'Капитаны-звёзды соберут команды из игроков региона. Ждём рекордный онлайн.', imp: 4 });
}
function tick() {
  const s = seasonState.currentSeason || 1, now = nowMs();
  SHOWS.forEach(sh => { const at = dateOf(sh, s); if (now >= at - 3 * DAY && now < at) preview(sh, s); if (now >= at) run(sh, s); });
}
// логотип сборной — нарисованный флаг страны (SVG): полосы, скандинавские кресты, звёзды, канton и т.д.
const NAT_BY_NAME = Object.fromEntries(Object.entries(NATION).map(([c, n]) => [n, c]));
const W = 60, Hh = 40;
const hs = cols => cols.map((c, i) => `<rect x="0" y="${(Hh / cols.length * i).toFixed(2)}" width="${W}" height="${(Hh / cols.length + .1).toFixed(2)}" fill="${c}"/>`).join('');
const vs = cols => cols.map((c, i) => `<rect x="${(W / cols.length * i).toFixed(2)}" y="0" width="${(W / cols.length + .1).toFixed(2)}" height="${Hh}" fill="${c}"/>`).join('');
const nordic = (bg, cr, inner) => `<rect width="${W}" height="${Hh}" fill="${bg}"/><rect x="16" y="0" width="${inner ? 9 : 7}" height="${Hh}" fill="${cr}"/><rect x="0" y="${inner ? 15.5 : 16.5}" width="${W}" height="${inner ? 9 : 7}" fill="${cr}"/>` + (inner ? `<rect x="18" y="0" width="5" height="${Hh}" fill="${inner}"/><rect x="0" y="17.5" width="${W}" height="5" fill="${inner}"/>` : '');
const star = (cx, cy, R, fill) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .4 : R; p.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`); } return `<polygon points="${p.join(' ')}" fill="${fill}"/>`; };
const FLAGS = {
  RU: () => hs(['#fff', '#0039a6', '#d52b1e']), UA: () => hs(['#0057b7', '#ffd700']), BY: () => hs(['#c8313e', '#c8313e', '#4aa657']) + `<rect width="6" height="${Hh}" fill="#fff"/>`,
  KZ: () => `<rect width="${W}" height="${Hh}" fill="#00afca"/><circle cx="30" cy="18" r="7" fill="#fec50c"/><path d="M22 30q8 4 16 0" stroke="#fec50c" stroke-width="2" fill="none"/>`,
  DK: () => nordic('#c8102e', '#fff'), SE: () => nordic('#006aa7', '#fecc00'), NO: () => nordic('#ba0c2f', '#fff', '#00205b'), FI: () => nordic('#fff', '#002f6c'),
  FR: () => vs(['#0055a4', '#fff', '#ef4135']), DE: () => hs(['#000', '#dd0000', '#ffce00']), PL: () => hs(['#fff', '#dc143c']), CZ: () => hs(['#fff', '#d7141a']) + `<path d="M0 0L28 20L0 40z" fill="#11457e"/>`,
  SK: () => hs(['#fff', '#0b4ea2', '#ee1c25']) + `<path d="M10 9h14v14q0 7-7 10q-7-3-7-10z" fill="#fff"/><path d="M11 10h12v13q0 6-6 9q-6-3-6-9z" fill="#ee1c25"/><path d="M16 13h2v14h-2zM13 17h8v2h-8z" fill="#fff"/>`,
  HU: () => hs(['#ce2939', '#fff', '#477050']), RO: () => vs(['#002b7f', '#fcd116', '#ce1126']), BG: () => hs(['#fff', '#00966e', '#d62612']), RS: () => hs(['#c6363c', '#0c4076', '#fff']),
  BA: () => `<rect width="${W}" height="${Hh}" fill="#002395"/><path d="M16 0h28v40z" fill="#fecb00"/>` + [0, 1, 2, 3, 4, 5, 6].map(i => star(12 + i * 4.6, 2 + i * 5.6, 2.2, '#fff')).join(''),
  GB: () => `<rect width="${W}" height="${Hh}" fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width="3"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#c8102e" stroke-width="7"/>`,
  NL: () => hs(['#ae1c28', '#fff', '#21468b']), BE: () => vs(['#000', '#fae042', '#ed2939']), PT: () => `<rect width="${W}" height="${Hh}" fill="#da291c"/><rect width="24" height="${Hh}" fill="#046a38"/><circle cx="24" cy="20" r="7" fill="#ffe900"/><circle cx="24" cy="20" r="4.5" fill="#da291c"/>`,
  ES: () => hs(['#aa151b', '#f1bf00', '#f1bf00', '#aa151b']), TR: () => `<rect width="${W}" height="${Hh}" fill="#e30a17"/><circle cx="22" cy="20" r="10" fill="#fff"/><circle cx="25" cy="20" r="8" fill="#e30a17"/>${star(35, 20, 5, '#fff')}`,
  IL: () => `<rect width="${W}" height="${Hh}" fill="#fff"/><rect y="4" width="${W}" height="5" fill="#0038b8"/><rect y="31" width="${W}" height="5" fill="#0038b8"/><path d="M30 12l7 12h-14zM30 28l-7-12h14z" fill="none" stroke="#0038b8" stroke-width="1.6"/>`,
  BR: () => `<rect width="${W}" height="${Hh}" fill="#009c3b"/><path d="M30 4L56 20L30 36L4 20z" fill="#ffdf00"/><circle cx="30" cy="20" r="9" fill="#002776"/><path d="M21 19q9-4 18 2" stroke="#fff" stroke-width="1.4" fill="none"/>`,
  AR: () => hs(['#74acdf', '#fff', '#74acdf']) + `<circle cx="30" cy="20" r="4" fill="#f6b40e"/>`, CL: () => `<rect width="${W}" height="${Hh}" fill="#fff"/><rect y="20" width="${W}" height="20" fill="#d52b1e"/><rect width="20" height="20" fill="#0039a6"/>${star(10, 10, 5, '#fff')}`,
  US: () => Array.from({ length: 13 }, (_, i) => `<rect y="${(i * Hh / 13).toFixed(2)}" width="${W}" height="${(Hh / 13 + .1).toFixed(2)}" fill="${i % 2 ? '#fff' : '#b22234'}"/>`).join('') + `<rect width="26" height="21.5" fill="#3c3b6e"/>` + Array.from({ length: 12 }, (_, i) => `<circle cx="${3.5 + (i % 4) * 6.3}" cy="${3.5 + Math.floor(i / 4) * 6.5}" r="1.1" fill="#fff"/>`).join(''),
  CA: () => vs(['#d52b1e', '#fff', '#fff', '#d52b1e']) + `<path d="M30 9l2 5 3-1-1 6 3-1-6 8-6-8 3 1-1-6 3 1z" fill="#d52b1e"/><rect x="29.3" y="26" width="1.4" height="5" fill="#d52b1e"/>`,
  AU: () => `<rect width="${W}" height="${Hh}" fill="#012169"/>${star(15, 30, 4, '#fff')}${star(45, 12, 2.4, '#fff')}${star(40, 22, 2.4, '#fff')}${star(50, 24, 2.2, '#fff')}${star(45, 33, 2.4, '#fff')}<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.5"/>`,
  MN: () => vs(['#c4272f', '#015197', '#c4272f']) + `<circle cx="10" cy="14" r="3" fill="#f9cf02"/><rect x="7" y="19" width="6" height="12" fill="#f9cf02"/>`,
  CN: () => `<rect width="${W}" height="${Hh}" fill="#ee1c25"/>${star(11, 11, 6, '#ffff00')}${star(21, 4.5, 2, '#ffff00')}${star(24, 9, 2, '#ffff00')}${star(24, 15, 2, '#ffff00')}${star(21, 19, 2, '#ffff00')}`,
  LV: () => hs(['#9e3039', '#9e3039', '#fff', '#9e3039', '#9e3039']), LT: () => hs(['#fdb913', '#006a44', '#c1272d']), EE: () => hs(['#0072ce', '#000', '#fff']),
  MK: () => `<rect width="${W}" height="${Hh}" fill="#d20000"/><path d="M30 20L0 0h10zM30 20L60 0H50zM30 20L0 40h10zM30 20L60 40H50zM30 20L0 16v8zM30 20L60 16v8zM30 20L26 0h8zM30 20L26 40h8z" fill="#ffe600"/><circle cx="30" cy="20" r="6" fill="#ffe600" stroke="#d20000" stroke-width="1.2"/>`,
  ME: () => `<rect width="${W}" height="${Hh}" fill="#c40308"/><rect x="2" y="2" width="56" height="36" fill="none" stroke="#d3ae3b" stroke-width="2"/><circle cx="30" cy="20" r="7" fill="#d3ae3b"/>`,
  XK: () => `<rect width="${W}" height="${Hh}" fill="#244aa5"/><path d="M22 18l8-6 6 4 2 8-6 6-8-2z" fill="#d0a650"/>` + [0, 1, 2, 3, 4, 5].map(i => star(16 + i * 5.6, 8 - Math.sin(i / 5 * Math.PI) * 3, 1.8, '#fff')).join(''),
  ZA: () => `<rect width="${W}" height="${Hh}" fill="#fff"/><rect width="${W}" height="13" fill="#e03c31"/><rect y="27" width="${W}" height="13" fill="#001489"/><path d="M0 0L26 20L0 40z" fill="#fff"/><path d="M0 4L21 20L0 36z" fill="#000"/><path d="M0 6l18 14L0 34" stroke="#ffb612" stroke-width="2.5" fill="none"/><path d="M24 20H60" stroke="#007749" stroke-width="9"/><path d="M0 0L28 20L0 40" stroke="#007749" stroke-width="6" fill="none"/>`
};
function flagSvg(c) {
  const body = (FLAGS[c] || (() => hs(['#3a4658', '#2a3442'])))();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -12 64 64"><defs><clipPath id="fc"><rect width="${W}" height="${Hh}" rx="4"/></clipPath><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs><g clip-path="url(#fc)">${body}<rect width="${W}" height="${Hh}" fill="url(#fg)"/></g><rect width="${W}" height="${Hh}" rx="4" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".8"/></svg>`;
}
const flagUri = c => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSvg(c));
window.V33Flag = flagSvg;
(function wrapMedia() { const M = window.V31Media; if (!M || M.__v33) return; const orig = M.url; M.url = (kind, name) => (kind === 'team' && NAT_BY_NAME[name]) ? flagUri(NAT_BY_NAME[name]) : orig(kind, name); M.__v33 = true; })();
if (H) { H.KIND.show = 'Шоу'; H.KIND.nations = 'Сборные'; if (H.KIND_ORDER) { H.KIND_ORDER.show = 7; H.KIND_ORDER.nations = 6; } }
setInterval(() => { try { tick(); } catch (e) { console.warn('[v33 shows]', e); } }, 3000);
window.V33Shows = { SHOWS, squadsFor, run, tick, dateOf };
console.info('[v33] шоу-турниры и Кубок наций');
})();
