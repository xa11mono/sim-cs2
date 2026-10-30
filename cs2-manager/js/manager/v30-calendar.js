(() => {
'use strict';
/* =====================================================================
   v30 · Турнирные серии и разнообразие календаря
   • V30Series.meta(name) — идентичность серии: организатор, город/регион, LAN или онлайн, престиж.
   • Tier-1: структура 14 слотов v29 сохраняется (даты, Major в финале сезона, редкий второй Major),
     но каждый новый сезон часть слотов разыгрывают другие серии — со своим форматом.
   • Tier-2/3 и академии: вместо 26 названий по кругу — региональные лиги, национальные
     чемпионаты, открытые/закрытые квалификации, онлайн- и LAN-кубки, академические серии.
     Переименовываются только будущие события (сыгранные и идущие не трогаются).
   ===================================================================== */
if (typeof seasonState === 'undefined') return;
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const yearOf = s => 2026 + ((+s || 1) - 1);

/* ------------------------------------------------------------ библиотека серий */
// [регулярка, серия, организатор, город, регион, lan]
const LIB = [
  [/major/i, 'Major', '', '', 'Мир', true], [/championship finals/i, 'Championship Finals', 'CS2 Manager', 'Лас-Вегас', 'Мир', true],
  [/iem katowice/i, 'Intel Extreme Masters', 'ESL', 'Катовице', 'Европа', true], [/iem cologne/i, 'Intel Extreme Masters', 'ESL', 'Кёльн', 'Европа', true],
  [/iem dallas/i, 'Intel Extreme Masters', 'ESL', 'Даллас', 'Северная Америка', true], [/iem chengdu/i, 'Intel Extreme Masters', 'ESL', 'Чэнду', 'Азия', true],
  [/iem krak/i, 'Intel Extreme Masters', 'ESL', 'Краков', 'Европа', true], [/iem/i, 'Intel Extreme Masters', 'ESL', '', 'Мир', true],
  [/blast.*bounty/i, 'BLAST Bounty', 'BLAST', 'Мальта', 'Европа', true], [/blast.*world final/i, 'BLAST World Final', 'BLAST', 'Абу-Даби', 'Ближний Восток', true],
  [/blast.*rivals/i, 'BLAST Rivals', 'BLAST', 'Гонконг', 'Азия', true], [/blast open/i, 'BLAST Open', 'BLAST', 'Лиссабон', 'Европа', true], [/blast/i, 'BLAST Premier', 'BLAST', 'Копенгаген', 'Европа', true],
  [/esl pro league/i, 'ESL Pro League', 'ESL', 'Сент-Джулианс', 'Европа', true], [/pgl bucharest/i, 'PGL', 'PGL', 'Бухарест', 'Европа', true], [/pgl astana/i, 'PGL', 'PGL', 'Астана', 'Азия', true],
  [/pgl cluj/i, 'PGL', 'PGL', 'Клуж-Напока', 'Европа', true], [/pgl masters/i, 'PGL Masters', 'PGL', 'Бухарест', 'Европа', true], [/pgl/i, 'PGL', 'PGL', '', 'Европа', true],
  [/esports world cup/i, 'Esports World Cup', 'EWC', 'Эр-Рияд', 'Ближний Восток', true], [/thunderpick/i, 'Thunderpick World Championship', 'Thunderpick', 'Мальта', 'Европа', true],
  [/fissure/i, 'FISSURE Playground', 'FISSURE', 'Белград', 'Европа', true], [/starladder|starseries/i, 'StarLadder StarSeries', 'StarLadder', 'Будапешт', 'Европа', true],
  [/cs asia/i, 'CS Asia Championships', 'Perfect World', 'Шанхай', 'Азия', true], [/perfect world/i, 'Perfect World', 'Perfect World', 'Шанхай', 'Азия', true],
  [/cct season finals/i, 'CCT', 'Grid', 'Белград', 'Европа', true], [/cct north america/i, 'CCT', 'Grid', '', 'Северная Америка', false], [/cct south america/i, 'CCT', 'Grid', '', 'Южная Америка', false],
  [/cct/i, 'CCT', 'Grid', '', 'Европа', false], [/esl challenger league/i, 'ESL Challenger League', 'ESL', '', 'Регион', false], [/esl challenger/i, 'ESL Challenger', 'ESL', 'Мельбурн', 'Мир', true],
  [/elisa/i, 'Elisa Masters', 'Elisa', 'Эспоо', 'Северная Европа', true], [/yalla/i, 'YaLLa Compass', 'YaLLa Esports', 'Дубай', 'Ближний Восток', true],
  [/\bres\b.*latin|latin american series/i, 'RES Regional Series', 'RES', '', 'Латинская Америка', false], [/\bres\b/i, 'RES Regional Series', 'RES', '', 'Европа', false],
  [/tipsport/i, 'Tipsport Masters', 'Tipsport', 'Прага', 'Центральная Европа', true], [/european pro league/i, 'European Pro League', 'EPL', '', 'Европа', false],
  [/united21/i, 'United21', 'United21', '', 'Европа', false], [/skyesports/i, 'Skyesports Masters', 'Skyesports', 'Мумбаи', 'Азия', true],
  [/baltic/i, 'Baltic Masters', 'Baltic Esports', 'Рига', 'Прибалтика', true], [/nordic/i, 'Nordic Championship', 'Nordic League', 'Стокгольм', 'Скандинавия', true],
  [/iberian/i, 'Iberian Cup', 'LVP', 'Мадрид', 'Пиренеи', true], [/balkan/i, 'Balkan Showdown', 'BSL', 'Белград', 'Балканы', true],
  [/polish/i, 'Polish Championship', 'ESL Polska', 'Варшава', 'Польша', true], [/brazilian/i, 'Brazilian Championship', 'Gamers Club', 'Сан-Паулу', 'Бразилия', true],
  [/german pro/i, 'German Pro Series', '99Damage', 'Берлин', 'Германия', false], [/uk masters/i, 'UK Masters League', 'Epic', 'Лондон', 'Великобритания', false],
  [/ukrainian cup/i, 'Ukrainian Cup', 'Maincast', 'Киев', 'Украина', false], [/kazakhstan/i, 'Kazakhstan Open', 'KeSPA KZ', 'Алматы', 'Казахстан', true], [/turkish/i, 'Turkish Masters', 'ESL Türkiye', 'Стамбул', 'Турция', true],
  [/open qualifier/i, 'Открытая квалификация', '', '', 'Онлайн', false], [/closed qualifier/i, 'Закрытая квалификация', '', '', 'Онлайн', false],
  [/online cup|weekly/i, 'Онлайн-кубок', '', '', 'Онлайн', false], [/lan cup/i, 'LAN Cup', '', 'Прага', 'Европа', true], [/regional lan finals/i, 'Regional LAN Finals', '', 'Гамбург', 'Европа', true],
  [/academy league/i, 'Academy League', '', '', 'Европа', false], [/academy masters/i, 'Academy Masters', '', 'Берлин', 'Европа', true], [/young talents/i, 'Young Talents Cup', '', '', 'Европа', false],
  [/regional academy finals/i, 'Regional Academy Finals', '', 'Варшава', 'Европа', true], [/prodigy/i, 'Prodigy Invitational', '', 'Копенгаген', 'Европа', true],
  [/academy|junior|rookie|future|prospects|rising|grassroots|entry/i, 'Молодёжные турниры', '', '', 'Онлайн', false]
];
const meta = name => { const x = LIB.find(([re]) => re.test(name || '')); return x ? { series: x[1], org: x[2], city: x[3], region: x[4], lan: x[5] } : null; };
window.V30Series = { meta, LIB };

/* ------------------------------------------------------------ Tier-1: ротация слотов */
// слот (номер в расписании v29) → варианты [название, формат]; первый вариант — исходный
const ROT = {
  2: [['BLAST Premier Spring Groups', 'single'], ['BLAST Open Lisbon', 'double'], ['BLAST Rivals Hong Kong', 'gsl']],
  4: [['PGL Bucharest', 'swiss'], ['PGL Astana', 'swiss'], ['PGL Cluj-Napoca', 'swiss']],
  6: [['CCT Season Finals Europe', 'single'], ['Elisa Masters Espoo', 'gsl'], ['FISSURE Playground', 'double'], ['StarLadder StarSeries', 'swiss'], ['CS Asia Championships', 'double']],
  9: [['BLAST Premier Fall Groups', 'single'], ['Esports World Cup', 'swiss'], ['IEM Kraków', 'gsl']],
  11: [['IEM Chengdu', 'double'], ['PGL Masters', 'gsl'], ['YaLLa Compass Masters', 'double']],
  12: [['Thunderpick World Championship', 'swiss'], ['Esports World Cup', 'swiss'], ['Tipsport Masters Prague', 'gsl']]
};
function rotate() {
  const st = seasonState, arr = st.seasonSchedule, s = Number(st.currentSeason) || 1;
  if (!Array.isArray(arr) || st.v30RotSeason === s) return;
  const idx = Number(st.tournamentIndex) || 1, ct = typeof currentTournament !== 'undefined' ? currentTournament : null;
  const used = new Set();
  Object.entries(ROT).forEach(([slot, opts]) => {
    const i = +slot, e = arr[i]; if (!e || e.type === 'major' || i < idx || (i === idx && ct && !ct.completed)) return;
    const base = String(e.name || '').replace(/\s*\b(19|20)\d\d\b\s*$/, '');
    if (!opts.some(o => o[0] === base)) return;          // слот уже переименован или занят другим событием
    let k = h32('rot|' + s + '|' + i + '|' + (st.v29Salt || '')) % opts.length, o = opts[k];
    for (let j = 0; j < opts.length && used.has(o[0]); j++) o = opts[(k + j) % opts.length];
    used.add(o[0]);
    e.name = `${o[0]} ${yearOf(s)}`; e.format = o[1];
  });
  st.v30RotSeason = s;
  try { saveSeasonState(); } catch (e) {}
  try { if (typeof updateTournamentSuggestion === 'function') updateTournamentSuggestion(); } catch (e) {}
}
(() => { const g = window.generateDynamicSeasonSchedule; if (typeof g !== 'function' || g.__v30) return;
  const w = function () { const r = g.apply(this, arguments); try { seasonState.v30RotSeason = 0; rotate(); } catch (e) { console.warn('[v30 cal]', e); } return r; };
  w.__v30 = true; Object.keys(g).forEach(k => { w[k] = g[k]; }); window.generateDynamicSeasonSchedule = w; try { generateDynamicSeasonSchedule = w; } catch (e) {} })();

/* ------------------------------------------------------------ Tier-2/3 и академии */
const T2 = ['CCT Europe Series', 'CCT North America Series', 'CCT South America Series', 'ESL Challenger League Europe', 'ESL Challenger League North America', 'ESL Challenger League Asia-Pacific', 'Elisa Invitational',
  'YaLLa Compass Contenders', 'RES Regional European Series', 'RES Latin American Series', 'Tipsport Cup', 'European Pro League', 'United21 League', 'Skyesports Masters', 'Baltic Masters Riga', 'Iberian Cup Madrid', 'Balkan Showdown', 'Nordic Championship Finals'];
const T3 = ['Polish Championship', 'Brazilian Championship', 'German Pro Series', 'UK Masters League', 'Ukrainian Cup', 'Kazakhstan Open', 'Turkish Masters', 'Open Qualifier Europe', 'Closed Qualifier Europe',
  'Online Cup Weekly', 'LAN Cup Prague', 'Regional LAN Finals', 'CCT Rising Series', 'United21 Division', 'European Pro League 2nd Division', 'Open Qualifier Americas', 'Future Stars Cup', 'Grassroots CS2 Cup', 'Entry League', 'Nordic National League'];
const AC = ['Academy League', 'Academy Masters', 'Young Talents Cup', 'Regional Academy Finals', 'Prodigy Invitational', 'European Academy League', 'CCT Academy Series', 'Academy Cup Europe'];
function renameParallel() {
  const s = Number(seasonState.currentSeason) || 1, list = (seasonState.parallelSchedule || []).filter(e => e && e.season === s);
  if (!list.length) return;
  let changed = 0;
  const pools = { tier2: T2, tier3: T3, academy: AC }, k = { tier2: 0, tier3: 0, academy: 0 };
  list.sort((a, b) => a.startMs - b.startMs).forEach(ev => {
    const kind = ev.kind === 'academy' ? 'academy' : ev.tier === '2' ? 'tier2' : 'tier3', pool = pools[kind];
    const off = h32(kind + s + (seasonState.v29Salt || '')) % pool.length, name = `${pool[(off + k[kind]++) % pool.length]} ${ev.year || yearOf(ev.season)}`;
    if (ev.v30n || ev.status !== 'scheduled' || (ev.br?.matches || []).some(m => m.w)) { ev.v30n = 1; return; }
    ev.name = name; ev.v30n = 1; changed++;
  });
  if (changed) try { saveSeasonState(); } catch (e) {}
}
setInterval(() => { try { rotate(); renameParallel(); } catch (e) {} }, 3000);
setTimeout(() => { try { rotate(); renameParallel(); } catch (e) {} }, 700);
console.info('[v30] серии турниров и ротация календаря');
})();
