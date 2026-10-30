(() => {
'use strict';
/* =====================================================================
   v29 · Лента новостей HLTV и интерактив
   • Новости рождаются из событий игры (v29-core → window.v29Emit): итоги турниров
     (разные сюжеты: андердог, серия, первый трофей, «без проигранных карт»),
     апсеты, новый №1 рейтинга, взлёты и кризисы, трансферы, тренеры, стенд-ины,
     завершение карьеры, прорывы игроков, трансферное окно и слухи, ростер-лок,
     превью Major с опросом, старт турниров, Tier-2/академии, итоги сезона.
   • Интерактив: реакции, свои комментарии, опросы, прогнозы на матчи с очками
     и званиями, всплывающие «срочные» новости и мини-лента на главном экране.
   Хранилище: cs2_news_v1 (новости), cs2_fan_v1 (ваши прогнозы, голоса, комментарии).
   ===================================================================== */
const NEWS_KEY = 'cs2_news_v1', FAN_KEY = 'cs2_fan_v1', CAP = 360; // v30: лента шире — пагинация в портале
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const rng = seed => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pick = (arr, seed) => arr[h32(seed) % arr.length];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TEAMS = () => (typeof teams !== 'undefined' && Array.isArray(teams)) ? teams : [];
const teamBy = n => TEAMS().find(t => t.name === n) || null;
const calNow = () => { try { return Number(seasonState.calendar?.currentMs) || Date.now(); } catch (e) { return Date.now(); } };
const season = () => { try { return seasonState.currentSeason || 1; } catch (e) { return 1; } };
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };

function load(key, def) { try { const o = JSON.parse(localStorage.getItem(key) || 'null'); return o && typeof o === 'object' ? o : def; } catch (e) { return def; } }
const store = load(NEWS_KEY, { v: 1, items: [], seq: 0, meta: {} });
store.items = Array.isArray(store.items) ? store.items : []; store.meta = store.meta || {}; store.seq = store.seq || 0;
const fan = load(FAN_KEY, { v: 1, preds: [], pts: 0, won: 0, lost: 0, streak: 0, best: 0, votes: {}, reacts: {}, comments: {} });
['preds'].forEach(k => { if (!Array.isArray(fan[k])) fan[k] = []; }); ['votes', 'reacts', 'comments'].forEach(k => { if (!fan[k] || typeof fan[k] !== 'object') fan[k] = {}; });
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(flush, 250); }
let disabled = false;
window.V29NewsClear = () => { disabled = true; clearTimeout(saveT); try { localStorage.removeItem(NEWS_KEY); localStorage.removeItem(FAN_KEY); } catch (e) {} };
function flush() { clearTimeout(saveT); saveT = null; if (disabled) return; try { localStorage.setItem(NEWS_KEY, JSON.stringify(store)); } catch (e) {} try { localStorage.setItem(FAN_KEY, JSON.stringify(fan)); } catch (e) {} }
window.addEventListener('beforeunload', flush);
window.v29NewsTrim = level => { store.items = store.items.slice(0, level >= 2 ? 90 : 200); fan.preds = fan.preds.slice(0, level >= 2 ? 60 : 150); flush(); };

const CATS = {
  tournament: { l: 'Турниры', ic: '🏆' }, major: { l: 'Major', ic: '⭐' }, transfer: { l: 'Трансферы', ic: '⇄' }, rumor: { l: 'Слухи', ic: '🕵️' },
  ranking: { l: 'Рейтинг', ic: '📈' }, season: { l: 'Сезон', ic: '📜' }, tier2: { l: 'Tier-2', ic: '🌱' }, player: { l: 'Игроки', ic: '👤' }, preview: { l: 'Превью', ic: '🔎' }
};

function add(it) {
  it.id = it.id || ('n' + (++store.seq).toString(36) + '-' + (h32(it.title + calNow()) % 1e6).toString(36));
  if (store.items.some(x => x.id === it.id)) return null;
  if (store.items.slice(0, 60).some(x => x.title === it.title && (x.season || 0) === (it.season || season()))) return null; // v30: без дублей одного сюжета
  it.ts = it.ts || calNow(); it.o = ++store.seq; it.season = it.season || season();
  it.imp = clamp(Number(it.imp) || 3, 1, 10); it.body = it.body || []; it.tags = it.tags || [];
  store.items.unshift(it);
  store.items.sort((a, b) => (b.ts - a.ts) || (b.o - a.o));
  if (store.items.length > CAP) store.items.length = CAP;
  fresh.push(it); save();
  return it;
}
const fresh = [];
const T = n => ({ t: 'team', v: n }), P = n => ({ t: 'player', v: n }), E = id => ({ t: 'event', v: id });

/* ------------------------------------------------------------ сила / шансы */
function str(n) { try { return window.v29Odds ? window.v29Odds(n, n).sA : (teamBy(n)?.pts || 600); } catch (e) { return 0; } }
function titleChances(names) {
  const s = names.map(n => ({ n, s: str(n) })), mx = Math.max(...s.map(x => x.s));
  const w = s.map(x => ({ n: x.n, w: Math.pow(10, (x.s - mx) / 260) })), sum = w.reduce((a, x) => a + x.w, 0) || 1;
  return w.map(x => ({ n: x.n, p: x.w / sum })).sort((a, b) => b.p - a.p);
}
function mvpOf(archiveId) {
  try { const A = window.twAwardsExport ? window.twAwardsExport().p || {} : {}; for (const [nick, r] of Object.entries(A)) if ((r.mvp || []).some(x => x.id === archiveId)) return { nick, team: (r.mvp.find(x => x.id === archiveId) || {}).team }; } catch (e) {}
  return null;
}
function playerTeam(nick) { for (const t of TEAMS()) if ((t.players || []).some(p => p.nick === nick)) return t.name; return ''; }
function starOf(teamName) { const t = teamBy(teamName); const ps = (t?.players || []).slice().sort((a, b) => (b.firepower || 0) - (a.firepower || 0)); return ps[0]?.nick || null; }

/* ------------------------------------------------------------ производители */
const H = {};
H.tournament = d => {
  if (!d.champ) return;
  const id = d.id || ('t' + d.name);
  const verb = pick(['обыграли', 'переиграли', 'одолели', 'победили'], id + 'v');
  const fm = d.finalMaps || [];
  const cw = fm.filter(x => x.w === d.champ).length, cl = fm.length - cw;
  const score = fm.length ? ` со счётом ${cw}:${cl}` : '';
  const mapsTxt = fm.length ? fm.map(x => `${x.map} ${d.finalT1 === d.champ ? x.a + ':' + x.b : x.b + ':' + x.a}${x.ot ? ' (ОТ)' : ''}`).join(', ') : '';
  const rk = d.champRankBefore || 0;
  let title, imp = d.major ? 10 : d.elite ? 7 : 6, angle = 'std';
  if (d.major) title = pick([`${d.champ} — чемпионы ${d.name}!`, `${d.champ} поднимают трофей мейджора`, `${d.champ} покоряют ${d.name}`], id + 't');
  else if (d.streak >= 3) { title = `${d.champ}: ${d.streak} ${plural(d.streak, 'титул', 'титула', 'титулов')} подряд — начинается эпоха?`; angle = 'streak'; imp++; }
  else if (d.streak === 2) { title = pick([`${d.champ} выигрывают второй турнир подряд`, `Дубль ${d.champ}: теперь и ${d.name}`], id + 't'); angle = 'streak'; }
  else if (d.firstTitle) { title = `Первый трофей в истории: ${d.champ} выигрывают ${d.name}`; angle = 'first'; imp++; }
  else if (rk >= 9) { title = pick([`Сенсация: ${d.champ} (#${rk}) выигрывают ${d.name}`, `${d.champ} из ${rk}-й строчки рейтинга забирают ${d.name}`], id + 't'); angle = 'underdog'; imp++; }
  else if (fm.length && d.mapsLost === 0) { title = `${d.champ} проходят ${d.name}, не отдав ни одной карты`; angle = 'flawless'; }
  else title = pick([`${d.champ} выигрывают ${d.name}`, `${d.champ} забирают ${d.name}`, `${d.name}: трофей у ${d.champ}`, `${d.champ} — лучшие на ${d.name}`], id + 't');
  const lead = d.second ? `В финале ${d.champ} ${verb} ${d.second}${score}.${d.titlesTotal > 1 ? ` Это ${d.titlesTotal}-й трофей команды.` : ''}` : `${d.champ} стали победителями турнира.`;
  const body = [];
  if (mapsTxt) body.push(`Карты финала: ${mapsTxt}.${fm.some(x => x.ot) ? ' Без овертайма не обошлось — нервы у болельщиков были на пределе.' : ''}${fm.length >= 3 && Math.abs(cw - cl) === 1 ? ' Судьба трофея решилась на последней карте.' : ''}`);
  if (angle === 'underdog') body.push(`Перед турниром ${d.champ} занимали лишь ${rk}-е место в мировом рейтинге, и букмекеры не рассматривали их всерьёз. Теперь команда поднимется на #${d.rankAfter?.[d.champ] || '?'}.`);
  if (angle === 'streak') body.push(`Соперники уже вовсю разбирают демки ${d.champ}: чем дольше длится серия, тем сложнее её продолжать.`);
  if (angle === 'first') body.push(`До этого дня в витрине ${d.champ} не было ни одного трофея Tier-1. Исторический день для клуба и его фанатов.`);
  if (angle === 'flawless') body.push(`Ни одной проигранной карты за весь турнир — такой отрезок соперникам придётся долго изучать.`);
  const mvp = d.id ? mvpOf(d.id) : null;
  if (mvp) body.push(`MVP турнира — ${mvp.nick} (${mvp.team || playerTeam(mvp.nick)}).`);
  if (d.third?.length) body.push(`Бронза: ${d.third.join(', ')}.`);
  if (d.major) body.push(`Мейджор завершает сезонный отрезок: следом открывается трансферное окно, и составы многих команд ждут перемены.`);
  const tags = [T(d.champ)]; if (d.second) tags.push(T(d.second)); if (mvp) tags.push(P(mvp.nick)); if (d.id) tags.push(E(d.id));
  add({ cat: d.major ? 'major' : 'tournament', icon: '🏆', img: { name: d.name, season: d.season, kind: d.major ? 'major' : d.elite ? 'elite' : 'regular' }, title, lead, body, tags, imp, team: d.champ, loser: d.second, player: mvp?.nick, ev: d.id });
  // апсет турнира
  const up = (d.upsets || []).slice().sort((a, b) => (b.rw - b.rl) - (a.rw - a.rl))[0];
  if (up && up.w !== d.champ) add({ cat: 'tournament', icon: '💥', title: pick([`Апсет: ${up.w} (#${up.rw}) выбивают ${up.l} (#${up.rl})`, `${up.l} сенсационно уступают ${up.w}`], id + 'u'),
    lead: `На ${d.name} ${up.w} обыграли одного из фаворитов${up.score ? ` (${String(up.score).replace(/Сч[её]т:\s*/i, '')})` : ''}.`, body: up.bo?.length ? [`Карты: ${up.bo.join(', ')}.`] : [], tags: [T(up.w), T(up.l), ...(d.id ? [E(d.id)] : [])], imp: 5, team: up.w, loser: up.l });
  // рейтинг
  if (d.leaderAfter && d.leaderBefore && d.leaderAfter !== d.leaderBefore) {
    const t = teamBy(d.leaderAfter), hist = store.meta.leaders || [], back = hist.slice(-3).includes(d.leaderAfter);
    store.meta.leaders = hist.concat(d.leaderAfter).slice(-6);
    add({ cat: 'ranking', icon: '👑', title: back ? `${d.leaderAfter} возвращают первую строчку рейтинга` : `${d.leaderAfter} — новая команда №1 в мире`, lead: `${d.leaderAfter} обошли ${d.leaderBefore} и ${back ? 'снова' : ''} возглавили мировой рейтинг${t ? ` (${t.pts} очков)` : ''}.`.replace('  ', ' '),
      body: [back ? `Борьба за первое место идёт буквально от турнира к турниру.` : `Смена лидера произошла по итогам ${d.name}. Удержать первую строчку будет непросто — ${d.leaderBefore} отстают совсем немного.`], tags: [T(d.leaderAfter), T(d.leaderBefore)], imp: back ? 5 : 8, team: d.leaderAfter, loser: d.leaderBefore });
  }
  const rb = d.rankBefore || {}, ra = d.rankAfter || {};
  const climb = Object.keys(ra).map(n => ({ n, d: (rb[n] || 99) - ra[n] })).filter(x => ra[x.n] <= 15 && x.d >= 4).sort((a, b) => b.d - a.d)[0];
  if (climb) add({ cat: 'ranking', icon: '📈', title: `${climb.n} взлетают на ${climb.d} ${plural(climb.d, 'позицию', 'позиции', 'позиций')} в рейтинге`, lead: `После ${d.name} команда поднялась с #${rb[climb.n]} на #${ra[climb.n]}.`, body: [], tags: [T(climb.n)], imp: 3, team: climb.n });
  // кризис у топ-команды: три провала подряд
  TEAMS().filter(t => !t.isAcademy && ra[t.name] && ra[t.name] <= 10).forEach(t => {
    const h = (t.history || []).filter(x => !x.isBootcamp && !String(x.archiveId || '').startsWith('P-') && x.place > 0 && !/Фонов/.test(x.placeTitle || '')).slice(0, 3);
    if (h.length === 3 && h.every(x => x.place >= 9) && h[0].tournament === d.name) {
      const k = 'crisis|' + t.name + '|' + d.season; if (store.meta[k]) return; store.meta[k] = 1;
      add({ cat: 'tournament', icon: '📉', title: `Кризис в ${t.name}: третий провал подряд`, lead: `Команда снова не дошла до плей-офф — на этот раз на ${d.name}.`, body: [`Болельщики требуют перемен: в ближайшее трансферное окно у ${t.name} может смениться состав или тренер.`], tags: [T(t.name)], imp: 4, team: t.name });
    }
  });
  // опрос превью Major
  if (d.major) store.items.forEach(it => { if (it.poll && !it.poll.answer && it.poll.ev === d.name) { it.poll.answer = it.poll.opts.includes(d.champ) ? d.champ : 'Другая команда'; const my = fan.votes[it.id]; if (my) { if (my === it.poll.answer) { fan.pollWins = (fan.pollWins || 0) + 1; fan.pts += 25; toastSimple('🗳️', 'Опрос: вы угадали чемпиона!', `${d.champ} выиграли ${d.name} • +25 очков прогнозиста`); } } } });
};
H.transfer = d => {
  const win = window.__v29WindowState;
  if (win) win.moves.push(d);
  const title = d.star ? pick([`Громкий трансфер: ${d.player} переходит в ${d.to}`, `${d.player} покидает ${d.from} ради ${d.to}`], d.player + d.to) : pick([`${d.player} переходит в ${d.to}`, `${d.to} подписали ${d.player}`, `${d.player} — новый игрок ${d.to}`], d.player + d.to);
  const body = [];
  if (d.out) body.push(`Ради нового игрока ${d.to} освободили место: ${d.out} покидает основной состав и выходит на рынок свободных агентов.`);
  if (d.rep) body.push(`${d.from} уже нашли замену — в состав приходит ${d.rep}.`);
  body.push(d.window === 'post-major' ? 'Сделка закрыта в трансферное окно после мейджора.' : 'Редкий случай: сделка прошла по ходу сезона.');
  const rumorHit = store.items.find(x => x.cat === 'rumor' && !x.confirmed && !x.denied && !x.nego && x.player === d.player && x.season === season()); // v30: только слух о самом игроке
  if (rumorHit) { rumorHit.confirmed = true; body.push('Слухи, о которых мы писали ранее, подтвердились.'); }
  add({ cat: 'transfer', icon: '⇄', title, lead: `${d.player} (${d.role || 'игрок'}) меняет ${d.from} на ${d.to}. Причина: ${d.reason || 'усиление состава'}.`, body, tags: [P(d.player), T(d.to), T(d.from)], imp: d.star ? 8 : 5, team: d.to, from: d.from, player: d.player });
};
H.coach = d => add({ cat: 'transfer', icon: '🧠', title: pick([`${d.team} меняют тренера`, `Новый тренер в ${d.team}`], d.team + d.to), lead: `${d.to} сменил ${d.from} на посту главного тренера ${d.team}.`, body: ['В клубе рассчитывают, что свежий взгляд вернёт команде стабильность.'], tags: [T(d.team)], imp: 4, team: d.team });
H.standin = d => add({ cat: 'transfer', icon: '🛡️', title: `${d.team} сыграют со стенд-ином`, lead: `${d.player} временно заменит ${d.out}: ${d.reason || 'по семейным обстоятельствам'}.`, body: [], tags: [T(d.team), P(d.player)], imp: 3, team: d.team, player: d.player });
H.retire = d => add({ cat: 'player', icon: '👋', title: `${d.player} завершает карьеру`, lead: `${d.age}-летний ${d.role || 'игрок'} ${d.team} объявил об уходе из профессионального CS2.`, body: [`Место ветерана в составе займёт молодой ${d.rep}.`, 'Спасибо за игру, легенда.'], tags: [P(d.player), T(d.team), P(d.rep)], imp: 6, team: d.team, player: d.player });
H.breakout = d => {
  const k = 'brk|' + season(); store.meta[k] = (store.meta[k] || 0) + 1; if (store.meta[k] > 3) return; // не больше трёх «прорывов» за межсезонье
  add({ cat: 'player', icon: '🚀', title: `${d.player} — прорыв межсезонья`, lead: `Игрок ${d.team} (${d.age} лет) заметно прибавил за оффсезон.`, body: ['Аналитики ждут от него большого сезона — следите за его рейтингом в статистике.'], tags: [P(d.player), T(d.team)], imp: 4, team: d.team, player: d.player });
};
H['window-open'] = d => {
  window.__v29WindowState = { moves: [], after: d.after };
  add({ cat: 'transfer', icon: '🔓', title: 'Трансферное окно открыто', lead: `После ${d.after} команды снова могут менять составы. Ждём громких переходов.`, body: ['Следите за лентой: все сделки окна появятся здесь, а итоги мы подведём сразу после его закрытия.'], tags: [], imp: 7 });
  // слухи
  const ranked = TEAMS().filter(t => !t.isAcademy).sort((a, b) => b.pts - a.pts);
  const flop = ranked.slice(0, 14).filter(t => { const h = (t.history || [])[0]; return h && h.tournament === d.after && h.place >= 9; }).slice(0, 2);
  flop.forEach(t => add({ cat: 'rumor', icon: '🕵️', title: pick([`Слухи: ${t.name} задумались о перестройке`, `Источники: в ${t.name} грядут перемены`], t.name + d.after), lead: `После неудачи на ${d.after} руководство ${t.name} рассматривает замену в составе.`, body: ['Официальных заявлений пока нет.'], tags: [T(t.name)], imp: 4, team: t.name }));
  const top = ranked.slice(0, 5); const tt = top[h32(d.after + 'star') % Math.max(1, top.length)];
  const star = tt ? starOf(tt.name) : null;
  if (star) add({ cat: 'rumor', icon: '🕵️', title: `Инсайд: ${star} может сменить команду`, lead: `К игроку ${tt.name} проявляют интерес сразу несколько клубов.`, body: ['Сам игрок от комментариев отказался.'], tags: [P(star), T(tt.name)], imp: 5, team: tt.name, player: star });
};
H['window-close'] = d => {
  const w = window.__v29WindowState; window.__v29WindowState = null;
  const moves = w?.moves || [];
  add({ cat: 'transfer', icon: '📋', title: moves.length ? `Итоги трансферного окна: ${moves.length} ${plural(moves.length, 'переход', 'перехода', 'переходов')}` : 'Трансферное окно закрылось без громких сделок',
    lead: moves.length ? `Самая заметная сделка — ${moves.find(m => m.star)?.player || moves[0].player} в ${moves.find(m => m.star)?.to || moves[0].to}.` : 'Команды предпочли сохранить составы.',
    body: moves.map(m => `• ${m.player}: ${m.from} → ${m.to}${m.out ? ` (уходит ${m.out})` : ''}`).concat(d.next ? [`Следующий турнир — ${d.next}.`] : []), tags: moves.slice(0, 6).map(m => T(m.to)), imp: 6, digest: true });
};
H['roster-lock'] = d => add({ cat: 'major', icon: '🔒', title: `Ростер-лок: составы на ${d.major} заморожены`, lead: 'До конца мейджора команды не могут проводить трансферы — только экстренные замены.', body: [], tags: [], imp: 4 });
H['major-preview'] = d => {
  const k = 'preview|' + d.name; if (store.meta[k]) return; store.meta[k] = 1;
  const names = TEAMS().filter(t => !t.isAcademy).sort((a, b) => b.pts - a.pts).slice(0, 24).map(t => t.name);
  const ch = titleChances(names); const fav = ch.slice(0, 5);
  const dark = ch.slice(6, 14).sort((a, b) => (teamBy(b.n)?.form || 100) - (teamBy(a.n)?.form || 100))[0];
  const opts = fav.map(x => x.n).concat(['Другая команда']);
  const base = {}; opts.forEach((o, i) => { base[o] = Math.round((fav[i] ? fav[i].p : Math.max(0.08, 1 - fav.reduce((s, x) => s + x.p, 0))) * 1800 + (h32(o + d.name) % 140)); });
  add({ cat: 'preview', icon: '🔎', img: { name: d.name, season: d.season, kind: 'major' }, title: `Превью ${d.name}: кто фаворит?`, lead: 'Финал сезона уже близко. Собрали главных претендентов на трофей мейджора — и ждём ваш прогноз в опросе.',
    body: fav.map((x, i) => `${i + 1}. ${x.n} — шанс на титул ≈${Math.round(x.p * 100)}%`).concat(dark ? [`Тёмная лошадка: ${dark.n} — команда в отличной форме и может испортить праздник фаворитам.`] : []),
    tags: fav.map(x => T(x.n)), imp: 8, poll: { q: `Кто выиграет ${d.name}?`, opts, base, ev: d.name, answer: null }, team: fav[0]?.n });
};
H['season-end'] = d => {
  const a = d.awards || {};
  add({ cat: 'season', icon: '📜', title: `Итоги сезона ${d.season}: ${a.rosterOfYear || d.champion || '—'} — команда года`, lead: `Сезон ${2025 + d.season} завершён. Подводим итоги и вручаем награды.`,
    body: [a.mvp ? `🥇 Команда-MVP по результатам: ${a.mvp}.` : '', a.breakthrough ? `🚀 Прорыв года: ${a.breakthrough}.` : '', a.disappointment ? `📉 Разочарование сезона: ${a.disappointment}.` : '',
      d.nextTwoMajors ? '⭐ В новом сезоне нас ждёт редкость — сразу два мейджора: в середине сезона и в его финале.' : 'В новом сезоне — один мейджор, как обычно в финале сезона.'].filter(Boolean),
    tags: [a.rosterOfYear || d.champion, a.breakthrough].filter(Boolean).map(T), imp: 9, team: a.rosterOfYear || d.champion });
};
H.parallel = d => {
  if (d.kind === 'academy') add({ cat: 'tier2', icon: '🎓', title: `${d.winner} выигрывают ${d.name}`, lead: `Академический турнир: в финале обыграна ${d.second || 'команда соперника'}.`, body: ['Молодёжь растёт — лучшие таланты академий в межсезонье могут попасть в основу.'], tags: [T(d.winner)], imp: 3, team: d.winner, ev: d.id, ts: d.at });
  else add({ cat: 'tier2', icon: '🌱', title: `${d.winner} выигрывают ${d.name}`, lead: `Tier-2: в финале обыграна ${d.second || 'команда соперника'}.`, body: [], tags: [T(d.winner)], imp: 2, team: d.winner, ev: d.id, ts: d.at });
};
H.start = d => {
  const ch = titleChances(d.participants).slice(0, 3);
  add({ cat: d.major ? 'major' : 'tournament', icon: d.major ? '⭐' : '🎬', img: { name: d.name, season: d.season, kind: d.major ? 'major' : d.elite ? 'elite' : 'regular' }, title: d.major ? `Стартует ${d.name}!` : `Стартует ${d.name}`,
    lead: `${d.participants.length} команд, формат — ${d.format}.${ch[0] ? ` Главный фаворит — ${ch[0].n} (≈${Math.round(ch[0].p * 100)}% на титул).` : ''}`,
    body: ch.length > 1 ? [`Также в числе претендентов: ${ch.slice(1).map(x => `${x.n} (≈${Math.round(x.p * 100)}%)`).join(', ')}.`, 'Сделайте прогнозы на матчи во вкладке «Прогнозы» HLTV.'] : [], tags: ch.map(x => T(x.n)), imp: d.major ? 7 : 3, team: ch[0]?.n });
};

function drain() {
  const bus = window.__v29Bus || []; if (!bus.length) return;
  window.__v29Bus = [];
  bus.forEach(ev => { try { (H[ev.type] || (() => {}))(ev.data, ev); } catch (e) { console.warn('[v29 news]', ev.type, e); } });
  announce();
}
window.v29OnEvent = () => { clearTimeout(drainT); drainT = setTimeout(drain, 30); };
let drainT = null;
setInterval(drain, 1500);

// старт Tier-1 турнира → новость
let lastCt = null;
setInterval(() => {
  try {
    const ct = typeof currentTournament !== 'undefined' ? currentTournament : null;
    if (!ct || ct === lastCt || ct.completed) { lastCt = ct || lastCt; return; }
    lastCt = ct;
    const k = 'start|' + ct.season + '|' + ct.tourIndex + '|' + ct.name; if (store.meta[k]) return; store.meta[k] = 1;
    const fmt = ({ major: 'Major (3 стадии Swiss + плей-офф)', double: 'Double Elimination', single: 'Single Elimination', swiss: 'Swiss + плей-офф', gsl: 'GSL-группы + плей-офф', bounty: 'Bounty Hunt' })[ct.isMajor ? 'major' : ct.formatChoice] || ct.formatChoice;
    (window.__v29Bus = window.__v29Bus || []).push({ type: 'start', data: { name: ct.name, season: ct.season, major: !!ct.isMajor, elite: !!ct.isElite, format: fmt, participants: (ct.participants || []).slice() } });
    drain();
  } catch (e) {}
}, 1000);

/* ------------------------------------------------------------ комментарии и реакции */
const FANS = [['s1mple_fan', 'UA'], ['dosia_legacy', 'RU'], ['headshot_only', 'PL'], ['awp_daddy', 'DK'], ['ecoround', 'SE'], ['zywoo_enjoyer', 'FR'], ['pistolround', 'BR'], ['ancient_enjoyer', 'DE'], ['rush_b_pls', 'RU'], ['flashbang_tv', 'US'],
  ['csgo_vet_2013', 'FI'], ['retake_king', 'TR'], ['lurker_main', 'KZ'], ['nade_wizard', 'NO'], ['mapveto', 'ES'], ['clutch_or_kick', 'PT'], ['donk_hairline', 'RU'], ['b1t_bucket', 'UA'], ['jumpthrow', 'CZ'], ['force_buy', 'MN']];
const CT = {
  tournament: ['{team} заслужили, финал был огонь 🔥', 'Кто ещё думал, что {loser} заберут? 😅', 'GG WP, {loser} не хватило совсем чуть-чуть', 'Эта команда сейчас на другом уровне', '{player} просто машина', 'Букмекеры опять мимо', 'Посмотрим, что они покажут на мейджоре', 'Ждал камбэка до последнего раунда', 'Вот это пикбан, тренеру респект', 'Скучный финал, честно говоря'],
  major: ['ИСТОРИЯ! {team} — чемпионы мейджора 🏆', 'Плакал на последнем раунде', 'Лучший мейджор за последние годы', '{loser} не повезло в решающей карте', 'Наклейка этой команды теперь бесценна', 'Заслуженно. Весь сезон к этому шли', '{player} — MVP без вопросов'],
  transfer: ['Странный трансфер, посмотрим', '{team} стали заметно сильнее', 'Жаль {from}, теряют ключевого игрока', 'Через два турнира станет понятно', 'Наконец-то!', 'Химия команды пострадает', 'Отличная сделка для обеих сторон', 'Сколько же они заплатили?'],
  rumor: ['Не верю, пока не будет официально', 'Источник надёжный?', 'Было бы круто', 'Каждое межсезонье одно и то же', 'Похоже на правду'],
  ranking: ['Рейтинг HLTV снова удивляет', '{team} на первой строчке — давно пора', 'Посмотрим, сколько продержатся', 'А я говорил!'],
  season: ['Отличный был сезон', 'Команда года — без вопросов', 'Ждём новый сезон!', 'Разочарование сезона попало в точку 😬'],
  tier2: ['Следим за этой командой', 'Скоро будут в Tier-1', 'Молодцы, растут на глазах'],
  player: ['Легенда!', 'Будем скучать', 'Этот парень ещё всех удивит', 'Уважение'],
  preview: ['Ставлю на {team}', 'Тёмная лошадка выстрелит, вот увидите', 'Фаворит очевиден', 'Мейджор всегда непредсказуем']
};
function fanComments(it) {
  const r = rng(h32(it.id)), n = 3 + Math.floor(r() * 4), pool = CT[it.cat] || CT.tournament, out = [], used = new Set();
  for (let i = 0; i < n; i++) {
    let k = Math.floor(r() * pool.length), tries = 0; while (used.has(k) && tries++ < 6) k = (k + 1) % pool.length; used.add(k);
    const f = FANS[Math.floor(r() * FANS.length)];
    const txt = pool[k].replace(/\{team\}/g, it.team || 'они').replace(/\{loser\}/g, it.loser || 'соперники').replace(/\{player\}/g, it.player || 'их снайпер').replace(/\{from\}/g, it.from || 'прошлую команду');
    out.push({ nick: f[0], cc: f[1], text: txt, likes: Math.floor(r() * 40 * (it.imp / 5)), mins: Math.floor(5 + r() * 600) });
  }
  return out;
}
const REACTS = ['🔥', '👍', '😮', '😢', '😂'];
function reactCounts(it) {
  const r = rng(h32('re' + it.id)), base = it.imp * 9; const o = {};
  REACTS.forEach((e, i) => { o[e] = Math.floor(r() * base * (i === 0 ? 1.4 : i === 1 ? 1.1 : 0.5)); });
  const my = fan.reacts[it.id]; if (my) o[my] = (o[my] || 0) + 1;
  return o;
}

/* ------------------------------------------------------------ прогнозы */
const refs = {}; let kseq = 0;
function openMatches() {
  const ct = typeof currentTournament !== 'undefined' ? currentTournament : null; if (!ct || ct.completed) return [];
  const out = [], seen = new Set();
  const push = (m, stage) => { if (!m || seen.has(m)) return; seen.add(m); if (m.t1 && m.t2 && !m.winner) out.push({ m, stage }); };
  try { if (typeof getBroadcastPlayableMatches === 'function') getBroadcastPlayableMatches().forEach(x => push(x.match, x.stage)); } catch (e) {}
  try { const n = getNextPlayableMatch(); if (n) push(n.match, n.stage); } catch (e) {}
  (ct.upperRounds || []).forEach((r, i) => (r || []).forEach(m => push(m, 'Плей-офф')));
  (ct.lowerRounds || []).forEach(r => (r || []).forEach(m => push(m, 'Нижняя сетка')));
  push(ct.grandFinal, 'Гранд-финал'); push(ct.bronzeMatch, 'За 3-е место');
  (ct.swiss?.rounds || []).forEach((r, i) => r.forEach(m => push(m, `Swiss · раунд ${i + 1}`)));
  (ct.majorStages || []).forEach((st, si) => (st?.rounds || []).forEach((r, i) => r.forEach(m => push(m, `Stage ${si + 1} · раунд ${i + 1}`))));
  (ct.gsl?.groups || []).forEach((g, gi) => Object.values(g.matches || {}).forEach(m => push(m, `Группа ${String.fromCharCode(65 + gi)}`)));
  (ct.bounty?.stage1 || []).forEach(m => push(m, 'Bounty · стадия 1')); (ct.bounty?.stage2 || []).forEach(m => push(m, 'Bounty · стадия 2'));
  return out.map(x => {
    if (!x.m.__v29k) x.m.__v29k = 'k' + (++kseq) + '-' + (h32(x.m.t1 + x.m.t2 + Date.now()) % 1e5).toString(36);
    refs[x.m.__v29k] = x.m;
    let o = null; try { o = calcMatchOdds(x.m.t1, x.m.t2, !!x.m.isBO1); } catch (e) {}
    const pr = fan.preds.find(p => p.k === x.m.__v29k);
    return { k: x.m.__v29k, t1: x.m.t1, t2: x.m.t2, stage: x.stage, bo: x.m.isBO1 ? 'BO1' : x.m.isBO5 ? 'BO5' : 'BO3', live: x.m.broadcastStatus === 'live', odds: o, pick: pr?.pick || null, ev: ct.name };
  });
}
function predict(k, team) {
  const m = refs[k]; if (!m || m.winner || m.broadcastStatus === 'live' || (team !== m.t1 && team !== m.t2)) return false;
  let p = fan.preds.find(x => x.k === k);
  let o = null; try { o = calcMatchOdds(m.t1, m.t2, !!m.isBO1); } catch (e) {}
  const c = o ? Number(team === m.t1 ? o.c1 : o.c2) : 1.9;
  if (p) { if (p.st !== 'open') return false; p.pick = team; p.c = c; }
  else { p = { id: 'p' + Date.now().toString(36) + (h32(k) % 999), k, t1: m.t1, t2: m.t2, pick: team, c, ev: currentTournament?.name || '', season: season(), at: calNow(), st: 'open' }; fan.preds.unshift(p); }
  if (fan.preds.length > 200) fan.preds.length = 200;
  save(); return true;
}
const RANKS = [[0, 'Новичок'], [60, 'Болельщик'], [160, 'Аналитик'], [360, 'Эксперт'], [700, 'Оракул'], [1200, 'Легенда HLTV']];
function rankOf(pts) { let r = RANKS[0]; RANKS.forEach(x => { if (pts >= x[0]) r = x; }); const nx = RANKS.find(x => x[0] > pts); return { name: r[1], next: nx ? nx[1] : null, need: nx ? nx[0] - pts : 0, from: r[0], to: nx ? nx[0] : r[0] }; }
setInterval(() => {
  let changed = false;
  fan.preds.forEach(p => {
    if (p.st !== 'open') return;
    const m = refs[p.k];
    if (!m) { const ct = typeof currentTournament !== 'undefined' ? currentTournament : null; if (!ct || ct.name !== p.ev || ct.completed) { p.st = 'void'; changed = true; } return; }
    if (!m.winner) return;
    const ok = m.winner === p.pick; p.st = ok ? 'won' : 'lost'; p.res = m.winner; changed = true;
    if (ok) { const g = Math.round(10 * (p.c || 1.5)); p.g = g; fan.pts += g; fan.won++; fan.streak = Math.max(1, (fan.streak || 0) + 1); fan.best = Math.max(fan.best || 0, fan.streak); toastSimple('🎯', `Прогноз сыграл: ${p.pick}`, `${p.t1} vs ${p.t2} • +${g} очков${fan.streak >= 3 ? ` • серия ${fan.streak} 🔥` : ''}`, 'predict'); }
    else { fan.lost++; fan.streak = 0; toastSimple('❌', `Прогноз не зашёл: ${p.pick}`, `${p.t1} vs ${p.t2} • победили ${m.winner}`, 'predict'); }
  });
  if (changed) save();
}, 1500);

/* ------------------------------------------------------------ тосты «срочно» */
let toastBox = null;
function ensureToasts() { if (toastBox && document.body.contains(toastBox)) return toastBox; toastBox = document.createElement('div'); toastBox.id = 'v29-toasts'; toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); return toastBox; }
function toast(html, onClick) {
  const box = ensureToasts(); const el = document.createElement('div'); el.className = 'v29-toast'; el.innerHTML = html + '<button type="button" class="v29-toast-x" aria-label="Закрыть">✕</button>';
  el.addEventListener('click', e => { if (e.target.closest('.v29-toast-x')) { el.remove(); return; } if (onClick) onClick(); el.remove(); });
  box.prepend(el); while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 9000);
}
function toastSimple(ic, title, sub, page) { toast(`<div class="v29-toast-ic">${ic}</div><div class="v29-toast-t"><small>HLTV</small><b>${esc(title)}</b><span>${esc(sub || '')}</span></div>`, () => { if (window.hltvSiteOpen) window.hltvSiteOpen(page || 'predict'); }); }
function announce() {
  if (!fresh.length) return;
  const batch = fresh.splice(0); renderMini();
  const hot = batch.filter(x => x.imp >= 7).sort((a, b) => b.imp - a.imp);
  hot.slice(0, 2).forEach(it => toast(`<div class="v29-toast-ic">${it.icon || '★'}</div><div class="v29-toast-t"><small>HLTV · ${it.imp >= 9 ? 'СРОЧНО' : (CATS[it.cat]?.l || 'Новости')}</small><b>${esc(it.title)}</b><span>${esc(it.lead || '')}</span></div>`, () => window.hltvSiteOpenArticle && window.hltvSiteOpenArticle(it.id)));
  const rest = batch.length - Math.min(2, hot.length);
  if (hot.length && rest > 2) toast(`<div class="v29-toast-ic">📰</div><div class="v29-toast-t"><small>HLTV</small><b>Ещё ${rest} ${plural(rest, 'новость', 'новости', 'новостей')}</b><span>Откройте ленту, чтобы ничего не пропустить</span></div>`, () => window.hltvSiteOpen && window.hltvSiteOpen('news'));
}

/* ------------------------------------------------------------ мини-лента на главном экране */
const ago = ts => { const d = Math.max(0, calNow() - ts), m = Math.floor(d / 6e4); if (m < 60) return m <= 1 ? 'только что' : `${m} мин`; const h = Math.floor(m / 60); if (h < 24) return `${h} ч`; const dd = Math.floor(h / 24); return dd < 30 ? `${dd} д` : new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }); };
let miniKey = '';
function renderMini() {
  const rail = document.getElementById('u27-rail'); if (!rail) return;
  let box = document.getElementById('v29-mini-news');
  if (!box) {
    box = document.createElement('section'); box.className = 'panel u27-mini v29-mini'; box.id = 'v29-mini-news';
    box.innerHTML = '<div class="u27-mini-h"><h3>Новости HLTV</h3><button type="button" class="u27-link" data-v29go="news">Все →</button></div><div id="v29-mini-list" class="v29-mini-list"></div>';
    const sw = document.getElementById('v21-tournament-switcher'); if (sw && sw.parentElement === rail) sw.after(box); else rail.prepend(box);
    box.addEventListener('click', e => { const a = e.target.closest('[data-v29art]'); if (a) return window.hltvSiteOpenArticle && window.hltvSiteOpenArticle(a.dataset.v29art); if (e.target.closest('[data-v29go]') && window.hltvSiteOpen) window.hltvSiteOpen('news'); });
  }
  const list = store.items.slice(0, 5);
  const key = list.map(x => x.id).join('|') + '|' + Math.floor(calNow() / 36e5); if (key === miniKey) return; miniKey = key;
  document.getElementById('v29-mini-list').innerHTML = list.length ? list.map(it => `<button type="button" class="v29-mini-row c-${it.cat}${it.imp >= 8 ? ' hot' : ''}" data-v29art="${esc(it.id)}"><span class="ic">${it.icon || '★'}</span><span class="tx"><b>${esc(it.title)}</b><small>${esc(CATS[it.cat]?.l || '')} · ${ago(it.ts)}</small></span></button>`).join('')
    : '<div class="u27-mini-empty">Новости появятся после первых матчей</div>';
}
setInterval(renderMini, 5000);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(renderMini, 300)); else setTimeout(renderMini, 300);

/* ------------------------------------------------------------ API для HLTV-сайта */
window.V29News = {
  CATS, REACTS,
  all: () => store.items,
  get: id => store.items.find(x => x.id === id) || null,
  ago,
  comments: it => { const mine = (fan.comments[it.id] || []).map(c => ({ ...c, mine: true })); return mine.concat(fanComments(it)); },
  comment: (id, text) => { text = String(text || '').trim().slice(0, 400); if (!text) return false; (fan.comments[id] = fan.comments[id] || []).unshift({ nick: 'Вы', cc: '', text, likes: 0, mins: 0, at: calNow() }); save(); return true; },
  reacts: it => reactCounts(it), myReact: id => fan.reacts[id] || null,
  react: (id, e) => { if (!REACTS.includes(e)) return; fan.reacts[id] = fan.reacts[id] === e ? null : e; if (!fan.reacts[id]) delete fan.reacts[id]; save(); },
  vote: (id, opt) => { const it = store.items.find(x => x.id === id); if (!it?.poll || it.poll.answer || fan.votes[id]) return false; if (!it.poll.opts.includes(opt)) return false; fan.votes[id] = opt; save(); return true; },
  myVote: id => fan.votes[id] || null,
  pollCounts: it => { const o = { ...(it.poll?.base || {}) }; const my = fan.votes[it.id]; if (my) o[my] = (o[my] || 0) + 1; return o; },
  activePoll: () => store.items.find(x => x.poll && !x.poll.answer) || null,
  upcoming: openMatches, predict,
  fan: () => ({ pts: fan.pts, won: fan.won, lost: fan.lost, streak: fan.streak, best: fan.best, pollWins: fan.pollWins || 0, rank: rankOf(fan.pts), preds: fan.preds }),
  transfers: () => store.items.filter(x => x.cat === 'transfer' && x.player && x.from && !x.digest && (!x.ttype || ['трансфер', 'выкуп', 'подписание', 'повышение', 'аренда'].includes(x.ttype))),
  legacyBridge: true,
  // v30: расширение редакции (v30-news.js регистрирует свои сюжеты и комментарии)
  add, H, CT, FANS, meta: () => store.meta, pick, plural, T, P, E, titleChances, mvpOf, starOf, playerTeam, fanRaw: () => fan, flush
};
window.V29NewsExport = () => ({ store, fan });
window.V29NewsImport = o => {
  if (!o || typeof o !== 'object') return;
  if (o.store && Array.isArray(o.store.items)) { store.items = o.store.items; store.meta = o.store.meta || {}; store.seq = o.store.seq || store.items.length; }
  if (o.fan && typeof o.fan === 'object') Object.assign(fan, o.fan);
  flush(); miniKey = ''; renderMini();
};
window.hltvSiteOpenArticle = id => { if (window.hltvSiteOpen) window.hltvSiteOpen('article', id); };
console.info('[v29] лента новостей загружена: новостей', store.items.length);
})();
