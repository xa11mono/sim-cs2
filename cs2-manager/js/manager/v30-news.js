(() => {
'use strict';
/* =====================================================================
   v30 · Редакция: новые сюжеты поверх ленты v29
   Каждая новость рождается из факта симуляции:
   • матчи (Tier-1 и финалы Tier-2): сенсация, разгром фаворита, камбэк, пятикарточная драма,
     решающая карта в овертайме, вылет фаворита, выдающаяся игра, провал звезды, превью финалов;
   • турниры: календарь сезона, анонс за 10 дней, определились участники плей-офф, итог с
     «возвращением чемпиона», первые вылеты фаворитов;
   • трансферы (рынок v30): подписание, скамейка, уход в свободные агенты, повышение из академии,
     аренда и возврат, продление, переговоры (слух) → подтверждение или опровержение, тренеры;
   • игроки: игрок месяца, спад и возвращение формы, юбилей карт, Top 20 года, уход легенды;
   • команды: серии побед/поражений, падение в рейтинге, перестройка состава.
   Новость не создаётся, если события не было. Слух помечается rumor:true до развязки.
   ===================================================================== */
const N = window.V29News; if (!N || !N.add) { console.warn('[v30 news] лента v29 не найдена'); return; }
const HS = window.HS;
const { add, H, CT, T, P, E, plural } = N;
const meta = () => N.meta();
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const pk = (arr, seed) => arr[h32(seed) % arr.length];
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
const TEAMS = () => (typeof teams !== 'undefined' && Array.isArray(teams)) ? teams : [];
const teamBy = n => TEAMS().find(t => t.name === n) || null;
const rankMap = () => { const r = {}; TEAMS().filter(t => !t.isAcademy).sort((a, b) => b.pts - a.pts).forEach((t, i) => r[t.name] = i + 1); return r; };
const pow = p => (+p.firepower || 0) * .4 + (+p.tacticalIQ || 0) * .25 + (+p.clutch || 0) * .2 + (+p.utility || 0) * .15;
const f2 = v => (Math.round(v * 100) / 100).toFixed(2);
const season = () => (typeof seasonState !== 'undefined' && seasonState.currentSeason) || 1;
const calNow = () => { try { return Number(seasonState.calendar?.currentMs) || Date.now(); } catch (e) { return Date.now(); } };
const once = k => { const m = meta(); if (m[k]) return false; m[k] = 1; return true; };
const M = (id) => ({ t: 'match', v: id });

/* ------------------------------------------------------------ рубрики */
Object.assign(N.CATS, {
  match: { l: 'Матчи', ic: '⚔' }, roster: { l: 'Ростеры', ic: '👥' }, stats: { l: 'Статистика', ic: '📊' }, tier3: { l: 'Tier-3', ic: '🌿' },
  academy: { l: 'Академии', ic: '🎓' }, award: { l: 'Награды', ic: '🏅' }, analytics: { l: 'Аналитика', ic: '🧭' }, event: { l: 'Анонсы', ic: '📣' }
});

/* ------------------------------------------------------------ комментарии болельщиков */
const MORE_FANS = [['eco_warrior', 'PL'], ['molly_lineup', 'BR'], ['b_site_anchor', 'DK'], ['smoke_criminal', 'UA'], ['entry_or_die', 'FR'], ['tilted_awper', 'DE'], ['demo_reviewer', 'FI'], ['save_round', 'TR'],
  ['half_buy_hero', 'KZ'], ['ct_sided_map', 'SE'], ['retake_or_rotate', 'US'], ['lurk_timing', 'NO'], ['pistol_magic', 'CZ'], ['awp_peek', 'PT'], ['utility_god', 'MN'], ['nade_stack', 'ES']];
N.FANS.push(...MORE_FANS);
Object.assign(CT, {
  match: ['{team} сегодня просто на другом уровне', 'Как {loser} умудрились это проиграть?', 'Вот за такие матчи я и люблю CS', 'Третья карта — это было кино', '{player} снова тащит', 'Аналитики уже пишут «кризис» про {loser}',
    'Ставил на {loser}, больно', 'Экономика {loser} развалилась во второй половине', 'Кто-то видел этот ретейк?', 'Смотрел с открытым ртом', 'Это не апсет, это закономерность', 'Хорошо, что не лёг спать'],
  roster: ['Химия с новым составом придёт не сразу', 'Логичный шаг для {team}', 'Наконец-то перемены', 'Будет интересно посмотреть на первый турнир', 'Скамейка — это всегда грустно', 'Удачи на новом месте'],
  academy: ['Академия {team} снова выдаёт таланты', 'Через год будет в топ-20', 'Молодой, но уже без нервов', 'Пусть растёт спокойно'],
  stats: ['Цифры не врут', 'А теперь посмотрите его KAST', 'Стабильность — признак класса', 'Рейтинг выше единицы третий турнир подряд'],
  award: ['Заслуженно на все сто', 'Я бы поставил его выше', 'Топ-1 очевиден', 'Список спорный, но в целом верный'],
  analytics: ['Интересный разбор', 'Ждём, что скажет плей-офф', 'Посмотрим через месяц'],
  event: ['Уже купил билет (мысленно)', 'Состав участников мощный', 'Формат нравится', 'Жду финал'],
  tier3: ['Тут растут будущие звёзды', 'Ничего не понятно, но очень интересно', 'Следим'],
  rumor: CT.rumor.concat(['Если правда — это бомба', 'Уже второй источник об этом пишет', 'Опять инсайдеры гадают', 'Не верю, он же только что продлил контракт']),
  transfer: CT.transfer.concat(['Посмотрим, как он впишется в систему {team}', 'Для {from} это потеря', 'Скамейка — не конец карьеры', 'Тренер явно хотел этого игрока', 'Хороший трансфер за свои деньги'])
});

/* ------------------------------------------------------------ трансферы */
const TPL = {
  signing: [['{to} подписали {player}', '{player} ({role}) усилил {to}. {why}'], ['{player} — новый игрок {to}', '{to} объявили о подписании {player}. {why}'], ['{to} закрыли позицию: пришёл {player}', '{player} займёт место {out}. {why}'], ['Свежая кровь в {to}: {player}', '{to} подписали {player} — {role} займёт место {out}.']],
  bench: [['{player} отправлен на скамейку {from}', 'Игрок больше не входит в основной состав {from}.'], ['{from} убирают {player} из основы', '{player} остаётся в клубе, но в стартовой пятёрке его нет.']],
  release: [['{player} покидает {from}', '{player} стал свободным агентом: {why}.'], ['{from} расстаются с {player}', 'Контракт расторгнут — {player} ищет новую команду.'], ['{player} — свободный агент', '{from} освободили {player}. Игрок открыт для предложений.']],
  promotion: [['{player} поднимается из {from} в основу {to}', '{to} доверили место в составе воспитаннику академии. Ему {age} лет.'], ['Академия работает: {player} — в основе {to}', 'Молодой {role} из {from} заменит {out}.'], ['{to} делают ставку на молодость: {player}', '{player} ({age}) переходит из {from} в основной состав.']],
  loan: [['{to} берут {player} в аренду', '{player} ({age}) из {from} проведёт несколько турниров за {to}.'], ['Аренда: {player} сыграет за {to}', '{from} отпускают молодого {role} набираться опыта в {to}.']],
  'loan-return': [['{player} возвращается в {to}', 'Аренда в {from} завершена. Место в составе {from} снова занимает {back}.'], ['Аренда {player} подошла к концу', '{player} вернулся в {to} после выступлений за {from}.']],
  extension: [['{player} продлил контракт с {from}', 'Новое соглашение действует до сезона {until}.'], ['{from} сохранили {player}', 'Клуб и игрок договорились о продлении до сезона {until}.']],
  buyout: [['{to} выкупили {player}', '{player} перешёл из {from} после удачной аренды.']]
};
function tpl(kind, d, seed) { const [t, l] = pk(TPL[kind], seed); const o = { ...d, why: d.reason ? d.reason[0].toUpperCase() + d.reason.slice(1) + '.' : '' }; return { title: fill(t, o), lead: fill(l, o).replace(/\s+\./g, '.').trim() }; }
const isStarNick = nick => { for (const t of TEAMS()) { const p = (t.players || []).find(x => x.nick === nick); if (p) return typeof isStarPlayer === 'function' && isStarPlayer(p); } return false; };
const rankOf = n => rankMap()[n] || 99;
H.signing = d => {
  if (d.quiet) return;
  const big = rankOf(d.to) <= 10, x = tpl('signing', d, d.player + d.to);
  add({ cat: 'transfer', ttype: 'подписание', icon: '✍', title: x.title, lead: x.lead, body: [d.from && !/Свободный/.test(d.from) ? `Последней командой игрока была ${d.from}.` : 'Игрок подписан из числа свободных агентов.', d.out ? `${d.out} уходит на скамейку.` : ''].filter(Boolean),
    tags: [P(d.player), T(d.to)].concat(d.out ? [P(d.out)] : []), imp: big ? 5 : 3, team: d.to, from: d.from, player: d.player });
};
H.bench = d => { if (rankOf(d.from) > 20) return; const x = tpl('bench', d, d.player); add({ cat: 'roster', icon: '🪑', title: x.title, lead: x.lead, body: [d.reason ? `Причина: ${d.reason}.` : ''].filter(Boolean), tags: [P(d.player), T(d.from)], imp: 2, team: d.from, player: d.player }); };
H.release = d => { const x = tpl('release', d, d.player + 'r'); add({ cat: 'roster', icon: '📤', title: x.title, lead: x.lead, body: ['Игрок попадает в список свободных агентов — его может подписать любая команда.'], tags: [P(d.player), T(d.from)], imp: 2, team: d.from, player: d.player }); };
H.promotion = d => { const x = tpl('promotion', d, d.player + 'p'); add({ cat: 'academy', ttype: 'повышение', icon: '🎓', title: x.title, lead: x.lead, body: [d.out ? `${d.out} уходит на скамейку.` : '', `Причина: ${d.reason}.`].filter(Boolean), tags: [P(d.player), T(d.to), T(d.from)], imp: 4, team: d.to, from: d.from, player: d.player }); };
H.loan = d => { const x = tpl('loan', d, d.player + 'l'); add({ cat: 'transfer', ttype: 'аренда', icon: '↔', title: x.title, lead: x.lead, body: [`${d.out || 'Игрок основы'} уходит на скамейку на время аренды.`, 'Срок — несколько турниров, затем игрок вернётся в академию, если клубы не договорятся о выкупе.'], tags: [P(d.player), T(d.to), T(d.from)], imp: 3, team: d.to, from: d.from, player: d.player }); };
H['loan-return'] = d => { const x = tpl('loan-return', d, d.player + 'lr'); add({ cat: 'roster', icon: '↩', title: x.title, lead: x.lead, body: [], tags: [P(d.player), T(d.to), T(d.from)], imp: 2, team: d.to, player: d.player }); };
H.extension = d => { const x = tpl('extension', d, d.player + d.until); add({ cat: 'transfer', ttype: 'продление', icon: '🖊', title: x.title, lead: x.lead, body: ['Клуб сохраняет ключевого игрока — слухи о его уходе можно закрывать.'], tags: [P(d.player), T(d.from)], imp: 3, team: d.from, player: d.player }); };
H.negotiation = d => {
  const star = isStarNick(d.player);
  add({ cat: 'rumor', rumor: true, nego: d.id, icon: '🕵', title: pk([`Слухи: ${d.to} ведут переговоры о ${d.player}`, `${d.player} может перейти в ${d.to}`, `Источники: ${d.to} хотят ${d.player}`, `${d.to} нацелились на ${d.player} из ${d.from}`], d.id),
    lead: `По данным источников, ${d.to} обсуждают переход ${d.player} (${d.role || 'игрок'}) из ${d.from}. Официального подтверждения нет.`,
    body: [d.reason ? `Мотив: ${d.reason}.` : '', star ? 'Речь идёт об одном из лучших игроков своей команды — для неё это была бы серьёзная потеря.' : '', 'Статус: переговоры. Слух будет подтверждён или опровергнут, когда стороны примут решение.'].filter(Boolean),
    tags: [P(d.player), T(d.to), T(d.from)], imp: star ? 6 : 4, team: d.to, from: d.from, player: d.player });
};
H['rumor-denied'] = d => {
  const r = N.all().find(x => x.nego === d.id) || N.all().find(x => x.cat === 'rumor' && !x.confirmed && !x.denied && x.player === d.player);
  if (r) { r.denied = true; r.body = (r.body || []).concat([`Обновление: слух не подтвердился — ${d.why}.`]); }
  add({ cat: 'rumor', rumor: true, denied: true, icon: '✕', title: pk([`${d.player} остаётся в ${d.from}`, `Переход ${d.player} в ${d.to} не состоится`, `${d.from} не отпустили ${d.player}`], d.id + 'x'),
    lead: `Переговоры ${d.to} и ${d.from} о ${d.player} завершились без сделки: ${d.why}.`, body: r ? ['Ранее мы сообщали о переговорах — эта информация больше не актуальна.'] : [], tags: [P(d.player), T(d.from), T(d.to)], imp: 3, team: d.from, player: d.player });
};
const baseTransfer = H.transfer;
H.transfer = d => {
  // подтверждение слуха по конкретным переговорам
  const r = d.nego ? N.all().find(x => x.nego === d.nego) : N.all().find(x => x.cat === 'rumor' && x.rumor && !x.confirmed && !x.denied && x.player === d.player && x.team === d.to);
  if (r) { r.confirmed = true; r.body = (r.body || []).concat(['Обновление: сделка подтверждена официально.']); }
  if (d.buyout) { const x = tpl('buyout', d, d.player); add({ cat: 'transfer', ttype: 'выкуп', icon: '⇄', title: x.title, lead: x.lead, body: [], tags: [P(d.player), T(d.to), T(d.from)], imp: 4, team: d.to, from: d.from, player: d.player }); return; }
  baseTransfer(d);
  const it = N.all()[0]; if (it && it.player === d.player) { it.ttype = 'трансфер'; if (r) it.body = (it.body || []).filter(x => !/Слухи, о которых/.test(x)).concat(['Слухи, о которых мы писали ранее, подтвердились.']);
    if (d.window === 'mid' || !d.window) it.body = (it.body || []).map(x => x === 'Редкий случай: сделка прошла по ходу сезона.' ? 'Сделка закрыта по ходу сезона, между турнирами.' : x); }
};
H.coach = d => add({ cat: 'roster', icon: '🧠', title: pk([`${d.team} меняют тренера`, `Новый тренер в ${d.team}: ${d.to}`, `${d.from} больше не тренер ${d.team}`, `${d.team} доверили штаб ${d.to}`], d.team + d.to),
  lead: `${d.to} сменил ${d.from} на посту главного тренера ${d.team}.`, body: [d.reason ? `Причина: ${d.reason}.` : '', 'Новому тренеру предстоит перестроить подготовку к ближайшим турнирам.'].filter(Boolean), tags: [T(d.team)], imp: rankOf(d.team) <= 12 ? 5 : 3, team: d.team });
const baseRetire = H.retire;
H.retire = d => {
  const A = (window.twAwardsExport ? window.twAwardsExport().p : {})[d.player] || {}, titles = (A.ti || []).length, maj = (A.ti || []).filter(x => x.k === 'major').length;
  if (titles >= 3 || maj) add({ cat: 'player', icon: '🎖', title: pick2([`Уходит легенда: ${d.player} завершает карьеру`, `${d.player} объявил о завершении карьеры — конец эпохи`], d.player), lead: `${d.age}-летний ${d.role || 'игрок'} ${d.team} уходит из профессионального CS2.`,
    body: [`За карьеру: ${titles} ${plural(titles, 'трофей', 'трофея', 'трофеев')}${maj ? `, из них ${maj} Major` : ''}${(A.mvp || []).length ? `, ${(A.mvp || []).length} MVP` : ''}${(A.top || []).length ? `, ${(A.top || []).length} раз в Top 20` : ''}.`, d.rep ? `Его место займёт ${d.rep}.` : ''].filter(Boolean), tags: [P(d.player), T(d.team)], imp: 7, team: d.team, player: d.player });
  else if (d.fa) add({ cat: 'player', icon: '👋', title: `${d.player} завершает карьеру`, lead: `${d.age}-летний ${d.role || 'игрок'} так и не нашёл новую команду после ухода из ${d.team}.`, body: [], tags: [P(d.player)], imp: 2, player: d.player });
  else baseRetire(d);
};
const pick2 = (a, s) => a[h32(s) % a.length];

/* ------------------------------------------------------------ турниры и сезон */
const baseTour = H.tournament;
H.tournament = d => {
  baseTour(d);
  const pz = { major: 1250000, elite: 500000 }[d.major ? 'major' : d.elite ? 'elite' : ''] || 250000;
  const it = N.all().find(x => x.ev === d.id && (x.cat === 'tournament' || x.cat === 'major') && x.team === d.champ);
  if (it) it.body = (it.body || []).concat([`Призовые: чемпион получает $${Math.round(pz * .4).toLocaleString('en-US')} из фонда $${pz.toLocaleString('en-US')}.`]);
  const t = teamBy(d.champ), wins = (t?.history || []).filter(h => h.place === 1 && !h.isBootcamp && !h.isSeasonAward);
  const prev = wins[1];
  if (prev && prev.season <= d.season - 2 && once('ret|' + d.champ + '|' + d.id)) add({ cat: 'analytics', icon: '↺', title: `${d.champ} возвращаются на вершину`, lead: `Предыдущий трофей команда выиграла ещё в сезоне ${prev.season} (${prev.tournament}).`,
    body: ['Долгая пауза закончилась: состав снова доказывает, что способен выигрывать турниры высшего уровня.'], tags: [T(d.champ), E(d.id)], imp: 5, team: d.champ });
  // после турнира: серии, игрок месяца, форма, юбилеи, падения
  setTimeout(() => { try { afterTournament(d); } catch (e) { console.warn('[v30 news] after', e); } }, 50);
};
function afterTournament(d) {
  if (!HS) return;
  const st = HS.stats(), rm = rankMap();
  // серии
  Object.values(st.T).forEach(T0 => {
    const rank = rm[T0.name]; if (!rank || rank > 20) return;
    const f = T0.form || []; let w = 0, l = 0; for (const x of f) { if (x === 'W' && !l) w++; else if (x === 'L' && !w) l++; else break; }
    if (w >= 6 && once(`ws|${T0.name}|${season()}|${Math.floor(w / 4)}`)) add({ cat: 'match', icon: '🔥', title: pk([`${T0.name}: ${w} побед подряд`, `${T0.name} не знают поражений — ${w} матчей`], T0.name + w), lead: `Серия ${T0.name} продолжается: ${w} выигранных матчей подряд.`, body: ['Соперникам придётся искать новые решения против этого состава.'], tags: [T(T0.name)], imp: 4, team: T0.name });
    if (l >= 5 && rank <= 15 && once(`ls|${T0.name}|${season()}|${Math.floor(l / 4)}`)) add({ cat: 'match', icon: '📉', title: pk([`${T0.name} проиграли ${l} матчей подряд`, `Чёрная полоса ${T0.name}: ${l} поражений`], T0.name + l), lead: `Команда из топ-15 не может выиграть уже ${l} матчей.`, body: ['Под вопросом — состав и тренерский штаб.'], tags: [T(T0.name)], imp: 4, team: T0.name });
  });
  // падение в рейтинге
  const rb = d.rankBefore || {}, ra = d.rankAfter || {};
  const fall = Object.keys(ra).map(n => ({ n, d: ra[n] - (rb[n] || ra[n]) })).filter(x => (rb[x.n] || 99) <= 15 && x.d >= 4).sort((a, b) => b.d - a.d)[0];
  if (fall) add({ cat: 'ranking', icon: '↘', title: `${fall.n} теряют ${fall.d} ${plural(fall.d, 'позицию', 'позиции', 'позиций')} в рейтинге`, lead: `После ${d.name} команда опустилась с #${rb[fall.n]} на #${ra[fall.n]}.`, body: [], tags: [T(fall.n)], imp: 3, team: fall.n });
  // игрок месяца — каждые два турнира Tier-1
  const m = meta(); m.t1count = (m.t1count || 0) + 1;
  const arch = Object.values(HS.archive()).filter(s => s && ['major', 'elite', 'regular'].includes(s.prestige)).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2);
  const lineOver = (o, snaps) => { const z = HS.Z0(); let n = 0; snaps.forEach(s => { const e = o.byEv[s.id]; if (e) { n++; Object.keys(z).forEach(k => { z[k] += e.s[k]; }); } }); return n ? HS.line(z) : null; };
  if (m.t1count % 2 === 0 && arch.length === 2) {
    let best = null; Object.values(st.P).forEach(o => { const l = lineOver(o, arch); if (l && l.maps >= 6 && (!best || l.rating > best.l.rating)) best = { o, l }; });
    if (best) add({ cat: 'stats', icon: '★', title: pk([`Игрок месяца: ${best.o.nick}`, `${best.o.nick} — лучший игрок последних турниров`], best.o.nick + m.t1count), lead: `${best.o.nick} (${best.o.team}) — Rating 2.0 ${f2(best.l.rating)} на ${best.l.maps} картах ${arch.map(s => s.name).join(' и ')}.`,
      body: [`K–D: ${best.l.k}–${best.l.d}, ADR ${best.l.adr.toFixed(1)}, KAST ${best.l.kast.toFixed(1)}%.`, 'Rating 2.0 — внутренняя метрика игры по сыгранным картам.'], tags: [P(best.o.nick), T(best.o.team)], imp: 5, team: best.o.team, player: best.o.nick });
  }
  // спад и возвращение формы у сильных игроков
  if (arch.length === 2) Object.values(st.P).forEach(o => {
    if (!o.p || pow(o.p) < 84 || o.all.maps < 40) return;
    const car = HS.line(o.all), rec = lineOver(o, arch); if (!rec || rec.maps < 6) return;
    const k = 'slump|' + o.nick + '|' + season();
    if (car.rating >= 1.08 && rec.rating < car.rating - 0.2 && once(k)) add({ cat: 'player', icon: '↓', title: pk([`Спад ${o.nick}: что случилось со звездой ${o.team}?`, `${o.nick} в кризисе формы`], k), lead: `Rating 2.0 ${o.nick} на последних турнирах — ${f2(rec.rating)} при карьерных ${f2(car.rating)}.`, body: [`Выборка: ${rec.maps} карт.`], tags: [P(o.nick), T(o.team)], imp: 3, team: o.team, player: o.nick });
    else if (meta()[k] && rec.rating >= car.rating + 0.08 && once('back|' + o.nick + '|' + season())) add({ cat: 'player', icon: '↑', title: `${o.nick} вернулся: кризис формы позади`, lead: `После спада ${o.nick} выдал ${f2(rec.rating)} Rating 2.0 на ${rec.maps} картах.`, body: [], tags: [P(o.nick), T(o.team)], imp: 4, team: o.team, player: o.nick });
  });
  // юбилеи карт
  let mil = 0; const topPow = TEAMS().filter(t => !t.isAcademy).flatMap(t => t.players || []).map(pow).sort((a, b) => b - a)[30] || 85;
  Object.values(st.P).forEach(o => { [250, 500, 1000].forEach(n => { if (mil < 2 && o.all.maps >= n && o.all.maps < n + 20 && o.p && pow(o.p) >= topPow && once(`mil|${o.nick}|${n}`) && ++mil) add({ cat: 'stats', icon: '#', title: `${o.nick}: ${n} карт в архиве`, lead: `Игрок ${o.team} провёл ${o.all.maps} карт с Rating 2.0 ${f2(HS.line(o.all).rating)}.`, body: [], tags: [P(o.nick), T(o.team)], imp: 2, team: o.team, player: o.nick }); }); });
  // перестройка: 3+ перемещения игроков в команду за сезон
  const mv = (typeof transferState !== 'undefined' && transferState.v30Moves) || [];
  const cnt = {}; mv.filter(x => x.season === season() && ['transfer', 'signing', 'promotion', 'loan', 'buyout'].includes(x.type)).forEach(x => cnt[x.to] = (cnt[x.to] || 0) + 1);
  Object.entries(cnt).filter(([n, c]) => c >= 3 && (rm[n] || 99) <= 25).forEach(([n, c]) => { if (once(`rebuild|${n}|${season()}`)) add({ cat: 'analytics', icon: '🔧', title: `${n} перестраивают состав`, lead: `В сезоне ${season()} в команду пришли уже ${c} ${plural(c, 'новый игрок', 'новых игрока', 'новых игроков')}.`, body: ['Новому составу понадобится время на сыгранность — результаты могут прийти не сразу.'], tags: [T(n)], imp: 4, team: n }); });
}
const baseSeasonEnd = H['season-end'];
H['season-end'] = d => {
  baseSeasonEnd(d);
  const y = 2025 + d.season, A = window.twAwardsExport ? window.twAwardsExport().p || {} : {}, top = [];
  Object.entries(A).forEach(([nick, r]) => (r.top || []).forEach(x => { if (x.y === y) top.push({ nick, r: x.r, team: x.team }); }));
  top.sort((a, b) => a.r - b.r);
  // v33: топ-20 раскрывается по одному игроку в день (js/manager/v33-awards.js) — здесь итоговую новость не публикуем
  if (top.length && window.V33Awards) window.V33Awards.startCountdown(y, top);
  else if (top.length && once('top20|' + y)) add({ cat: 'award', icon: '🏅', title: `Top 20 игроков ${y}: №1 — ${top[0].nick}`, lead: `Названы лучшие игроки сезона ${d.season}. Первое место — ${top[0].nick} (${top[0].team || '—'}).`,
    body: top.slice(0, 10).map(x => `${x.r}. ${x.nick} (${x.team || '—'})`), tags: top.slice(0, 5).map(x => P(x.nick)), imp: 8, player: top[0].nick, team: top[0].team });
  const aw = []; Object.entries(A).forEach(([nick, r]) => (r.aw || []).forEach(x => { if (x.y === y) aw.push({ nick, type: x.type, team: x.team }); }));
  const lbl = { poty: 'Игрок года', rifler: 'Лучший рифлер', awper: 'Лучший снайпер', igl: 'Лучший капитан', rookie: 'Новичок года', coach: 'Тренер года', entry: 'Лучший энтри-фраггер', clutch: 'Мастер клатчей', support: 'Лучший саппорт', breakout: 'Прорыв года' };
  if (aw.length && once('aw|' + y)) add({ cat: 'award', icon: '🏆', title: `Награды года: ${aw.find(x => x.type === 'poty')?.nick || aw[0].nick} — игрок года`, lead: `Итоги индивидуальных номинаций сезона ${d.season}.`, body: aw.map(x => `${lbl[x.type] || x.type}: ${x.nick} (${x.team || '—'})`), tags: aw.slice(0, 5).map(x => P(x.nick)), imp: 7 });
};
// календарь сезона, анонсы, плей-офф, превью финалов, сыгранные матчи
let lastSched = '';
function scanSeason() {
  const st = seasonState, s = st.currentSeason;
  if (Array.isArray(st.seasonSchedule) && st.seasonSchedule.length > 2 && once('cal|' + s)) {
    const t1 = st.seasonSchedule.slice(1).filter(Boolean), majors = t1.filter(e => e.type === 'major'), par = (st.parallelSchedule || []).filter(e => e.season === s);
    add({ cat: 'event', icon: '📣', title: `Календарь сезона ${s}: ${t1.length} турниров Tier-1${majors.length > 1 ? ' и два Major' : ''}`, lead: `Опубликовано расписание ${2025 + s} года: ${majors.map(m => m.name).join(' и ')} — главные события сезона.`,
      body: [`Tier-1: ${t1.length}, Tier-2: ${par.filter(e => e.tier === '2' && e.kind !== 'academy').length}, Tier-3: ${par.filter(e => e.tier === '3').length}, академии: ${par.filter(e => e.kind === 'academy').length}.`, 'Крупнейшие события: ' + t1.filter(e => e.type !== 'regular').slice(0, 6).map(e => e.name).join(', ') + '.'], tags: [], imp: 5 });
  }
  const nx = (st.seasonSchedule || [])[st.tournamentIndex], now = calNow();
  if (nx?.calendar?.startMs && now >= nx.calendar.startMs - 10 * 864e5 && now < nx.calendar.startMs && once('ann|' + s + '|' + nx.name)) {
    const kind = nx.type === 'major' ? 'Major' : nx.type === 'elite' ? 'S-Tier' : 'Tier-1', days = Math.max(1, Math.round((nx.calendar.startMs - now) / 864e5));
    const fav = N.titleChances(TEAMS().filter(t => !t.isAcademy).sort((a, b) => b.pts - a.pts).slice(0, 16).map(t => t.name)).slice(0, 3);
    let meta2 = null; try { meta2 = window.V30Series?.meta(nx.name); } catch (e) {}
    add({ cat: 'event', icon: '📅', img: { name: nx.name, season: s, kind: nx.type === 'major' ? 'major' : nx.type === 'elite' ? 'elite' : 'regular' }, title: `Через ${days} ${plural(days, 'день', 'дня', 'дней')} стартует ${nx.name}`,
      lead: `${kind}${meta2?.city ? ', ' + meta2.city : ''}: ${nx.size || 16} команд, формат — ${({ single: 'Single Elimination', double: 'Double Elimination', swiss: 'Swiss + плей-офф', gsl: 'GSL-группы + плей-офф', bounty: 'Bounty Hunt' })[nx.format] || nx.format}.`,
      body: [`Фавориты по рейтингу: ${fav.map(x => `${x.n} (≈${Math.round(x.p * 100)}%)`).join(', ')}.`, 'Приглашения и посев — по мировому рейтингу на момент старта.'], tags: fav.map(x => T(x.n)), imp: nx.type === 'major' ? 6 : 3 });
  }
}
function scanLive() {
  if (!HS || !HS.indexSnap) return;
  const ct = typeof currentTournament !== 'undefined' ? currentTournament : null;
  if (!ct || ct.completed || !window.hubSnapshotTier1) return;
  const snap = window.hubSnapshotTier1(ct), blocks = snap.blocks || [], ms = HS.indexSnap(snap), rm = rankMap();
  // определились участники плей-офф (после групп)
  const po = blocks.find(b => b.tab === 'playoff'), gr = blocks.some(b => b.tab === 'groups');
  if (po && gr) { const first = (po.sections?.[0]?.rounds?.[0]?.ms || []).filter(Boolean), names = first.flatMap(m => [m.a, m.b]).filter(Boolean);
    if (names.length >= 4 && first.every(m => m.a && m.b) && once('po|' + snap.id)) {
      const out = (ct.participants || []).filter(n => !names.includes(n) && (rm[n] || 99) <= 8);
      add({ cat: ct.isMajor ? 'major' : 'tournament', icon: '🎟', title: `${snap.name}: определились участники плей-офф`, lead: `В плей-офф вышли ${names.length} команд: ${names.join(', ')}.`, body: out.length ? [`За бортом остались фавориты: ${out.join(', ')}.`] : ['Все главные фавориты продолжают борьбу.'], tags: names.slice(0, 6).map(T).concat([E(snap.id)]), imp: ct.isMajor ? 6 : 4, ev: snap.id });
    } }
  // превью полуфиналов и финала
  ms.forEach(m => {
    const stg = (m.__stage || '').split(' · ').pop() || '';
    if (!m.a || !m.b || m.w || !/^(Гранд-финал|Финал)/.test(stg) || !once('pv|' + m.__id)) return;
    let o = null; try { o = calcMatchOdds(m.a, m.b, false); } catch (e) {}
    const st = HS.stats(), prev = st.ms.filter(x => (x.a === m.a && x.b === m.b) || (x.a === m.b && x.b === m.a)), hw = prev.filter(x => x.w === m.a).length;
    add({ cat: ct.isMajor ? 'major' : 'match', icon: '🔎', img: { name: snap.name, season: snap.season, kind: snap.prestige }, title: `Финал ${snap.name}: ${m.a} против ${m.b}`, lead: `${m.a} (#${rm[m.a] || '—'}) и ${m.b} (#${rm[m.b] || '—'}) разыграют трофей.`,
      body: [o ? `Шансы по оценке движка: ${m.a} — ${o.pct1}%, ${m.b} — ${o.pct2}%.` : '', prev.length ? `Личные встречи: ${hw}–${prev.length - hw} в пользу ${hw >= prev.length - hw ? m.a : m.b}.` : 'Раньше эти команды не встречались.'].filter(Boolean), tags: [T(m.a), T(m.b), E(snap.id), M(m.__id)], imp: ct.isMajor ? 8 : 6, team: m.a, loser: m.b, ev: snap.id, match: m.__id });
  });
}
function perfOf(m) {
  const rA = HS.rosterOf(m, m.a), rB = HS.rosterOf(m, m.b), per = {};
  if (!rA.length || !rB.length) return [];
  m.mp.forEach((mp, i) => { if (+mp[1] + +mp[2] === 0) return; const L = HS.mapLines(m.id, i, mp[0], +mp[1], +mp[2], m.a, m.b, rA, rB);
    L.A.concat(L.B).forEach(x => { const o = per[x.nick] || (per[x.nick] = { nick: x.nick, team: x.team, p: x.p, k: 0, d: 0, R: 0, rt: 0, adr: 0 }); o.k += x.k; o.d += x.d; o.R += x.R; o.rt += x.rating * x.R; o.adr += x.adr * x.R; }); });
  return Object.values(per).map(o => ({ ...o, rating: o.rt / Math.max(1, o.R), adr: o.adr / Math.max(1, o.R) })).sort((a, b) => b.rating - a.rating);
}
function scanMatches() {
  if (!HS) return;
  const m0 = meta(); m0.mseen = m0.mseen || [];
  const seen = new Set(m0.mseen), ms = HS.stats().ms.filter(m => m.w && ['major', 'elite', 'regular', 'tier2'].includes(m.kind));
  if (!m0.mseenInit) { m0.mseenInit = 1; m0.mseen = ms.slice(0, 400).map(m => m.id); return; }
  const fresh = ms.filter(m => !seen.has(m.id)).slice(0, 30); if (!fresh.length) return;
  const rm = rankMap();
  fresh.reverse().forEach(m => {
    m0.mseen.unshift(m.id);
    if (!once('mn|' + m.id)) return;
    const stg = (m.stage || '').split(' · ').pop() || '';
    if (/^(Гранд-финал|Финал \()/.test(stg) || (m.kind === 'tier2' && !/Финал/.test(stg))) return;   // финал — в итоговой новости турнира
    const capK = 'mcap|' + m.evId; if ((m0[capK] || 0) >= (m.kind === 'major' ? 9 : 6)) return;
    const W = m.w, L = W === m.a ? m.b : m.a, rw = rm[W] || 60, rl = rm[L] || 60, sW = W === m.a ? 1 : 2;
    const maps = m.mp.filter(x => +x[1] + +x[2] > 0), score = m.s ? (W === m.a ? m.s : [m.s[1], m.s[0]]) : null, sc = score ? `${score[0]}:${score[1]}` : '';
    const mapsTxt = maps.map(x => `${x[0]} ${sW === 1 ? x[1] + ':' + x[2] : x[2] + ':' + x[1]}`).join(', ');
    const lostFirst = maps.length >= 3 && ((sW === 1 && +maps[0][1] < +maps[0][2]) || (sW === 2 && +maps[0][2] < +maps[0][1]));
    const last = maps[maps.length - 1], otDecider = maps.length >= 3 && last && (+last[1] + +last[2]) > 24;
    const margin = maps.length ? maps.reduce((s, x) => s + Math.abs(+x[1] - +x[2]), 0) / maps.length : 0;
    const knockout = !/Верхняя|Swiss|Stage|Раунд \d|Группа|Открытие|Победителей|выход/i.test(m.stage || '') || /Нижняя|нижней/.test(m.stage || '');
    const perf = perfOf(m), best = perf[0], flop = perf.filter(x => x.team === L && x.p && pow(x.p) >= 88).sort((a, b) => a.rating - b.rating)[0];
    const base = { tags: [T(W), T(L), E(m.evId), M(m.id)], team: W, loser: L, ev: m.evId, match: m.id };
    const body = [mapsTxt ? `Карты: ${mapsTxt}.` : '', best ? `Лучший игрок матча — ${best.nick} (${best.team}): ${best.k}–${best.d}, Rating 2.0 ${f2(best.rating)}.` : ''].filter(Boolean);
    let it = null;
    if (rw - rl >= 8 && rl <= 8) it = { cat: 'match', icon: '💥', title: pk([`Сенсация: ${W} (#${rw}) обыгрывают ${L} (#${rl})`, `${L} неожиданно уступают ${W}`, `${W} шокируют ${L} на ${m.ev}`], m.id), lead: `${stg} ${m.ev}: ${W} победили со счётом ${sc}, хотя в рейтинге стоят на ${rw - rl} строк ниже.`, imp: rl <= 3 ? 6 : 5 };
    else if (knockout && rl <= 3 && rw > rl) it = { cat: m.kind === 'major' ? 'major' : 'match', icon: '⛔', title: pk([`${L} вылетают с ${m.ev}`, `Фаворит выбывает: ${L} проигрывают ${W}`], m.id), lead: `${W} выбили ${L} (#${rl}) — ${stg}, ${sc}.`, imp: 6 };
    else if (score && score[0] + score[1] === 5) it = { cat: 'match', icon: '5', title: pk([`Пять карт: ${W} дожали ${L}`, `${W} — ${L}: драма на пять карт`], m.id), lead: `${stg} ${m.ev} ушёл на пятую карту — ${W} сильнее со счётом ${sc}.`, imp: 5 };
    else if (lostFirst) it = { cat: 'match', icon: '↻', title: pk([`Камбэк ${W}: проиграли первую карту и выиграли серию`, `${W} отыгрываются против ${L}`], m.id), lead: `${W} уступили на первой карте, но забрали две следующие — ${sc}.`, imp: 4 };
    else if (otDecider) it = { cat: 'match', icon: '⏱', title: `${W} и ${L}: решающая карта в овертайме`, lead: `Судьбу матча решила ${last[0]} — ${sW === 1 ? last[1] + ':' + last[2] : last[2] + ':' + last[1]} после дополнительного времени.`, imp: 4 };
    else if (maps.length >= 2 && score && score[1] === 0 && margin >= 7 && rl <= 6) it = { cat: 'match', icon: '⚡', title: pk([`Разгром: ${W} не оставили шансов ${L}`, `${W} уничтожили ${L} — ${sc}`], m.id), lead: `${L} (#${rl}) проиграли ${maps.length} ${plural(maps.length, 'карту', 'карты', 'карт')} со средней разницей ${margin.toFixed(1)} раунда.`, imp: 5 };
    else if (best && best.rating >= (maps.length === 1 ? 1.85 : 1.6) && best.R >= 30) it = { cat: 'player', icon: '🎯', title: pk([`${best.nick} выдал ${f2(best.rating)} против ${best.team === W ? L : W}`, `Матч ${best.nick}: ${best.k} убийств`, `${best.nick} в одиночку решил матч`], m.id), lead: `${best.nick} (${best.team}) — ${best.k}–${best.d}, ADR ${best.adr.toFixed(1)}, Rating 2.0 ${f2(best.rating)} (${stg}, ${m.ev}).`, imp: 4, player: best.nick };
    else if (flop && flop.rating < 0.66 && rl <= 6 && once('flop|' + flop.nick + '|' + m.evId)) it = { cat: 'player', icon: '↓', title: `Провал ${flop.nick}: ${f2(flop.rating)} в поражении от ${W}`, lead: `Звезда ${L} закончила матч с ${flop.k}–${flop.d} — ${L} проиграли ${sc}.`, imp: 3, player: flop.nick };
    if (!it) return;
    m0[capK] = (m0[capK] || 0) + 1;
    add(Object.assign({}, base, it, { body: it.body || body, tags: base.tags.concat(it.player ? [P(it.player)] : []) }));
  });
  if (m0.mseen.length > 600) m0.mseen.length = 600;
  N.flush && N.flush();
}
setInterval(() => { try { scanSeason(); scanLive(); scanMatches(); } catch (e) { console.warn('[v30 news] scan', e); } }, 2200);
console.info('[v30] редакция: матчи, турниры, трансферы, игроки, команды');
})();
