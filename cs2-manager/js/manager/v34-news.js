/* v34 — разнообразие заголовков и блоки главной.
   1. Заголовки: у новой новости определяется сюжет (по рубрике и иконке) и подставляются её же команды и игроки
      в один из множества вариантов; выбор детерминирован по id новости, ~треть заголовков остаётся исходной.
   2. «Топ-30 трансферов» на главной (вместо короткого списка): самые заметные переходы сезона — уровень игрока,
      престиж клубов, свежесть; со значками «скамейка» и «без команды».
   3. Плашка гранд-финала на главной: турнир, «Гранд-финал», время и дата (или счёт в эфире), составы по краям. */
(function () {
'use strict';
const H = window.HS, N = window.V29News; if (!H || !N) return;
const { esc, logo, box } = H;
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const pickH = (arr, seed) => arr[h32(seed) % arr.length];

/* ---- 1. заголовки ---- */
const POOLS = {
  upset: ['Сенсация дня: {W} обыгрывают {L}', '{W} сотворили апсет против {L}', 'Никто не ставил на {W} — а они победили {L}', '{L} споткнулись о {W}', 'Шок на {ev}: {L} проигрывают {W}', '{W} доказали, что рейтинг — не приговор', 'Аутсайдер против фаворита: {W} сильнее {L}', 'Громкий результат: {W} — {L}', '{L} не справились с {W}', '{W} выбивают почву из-под ног {L}', 'Кто остановит {W}? Даже {L} не смогли', 'Букмекеры в шоке: {W} бьют {L}'],
  sweep: ['{W} разносят {L} всухую', 'Без шансов: {W} — {L}', '{W} не оставили камня на камне от {L}', 'Камень, ножницы, {W}: {L} разбиты', 'Демонстрация силы от {W}', '{L} даже не успели разогреться — победа {W}', '{W} проходят {L} без потерь', 'Чистая работа {W} против {L}', '{W} в огне: {L} повержены', 'Урок от {W} для {L}'],
  five: ['Пять карт нервов: {W} дожимают {L}', '{W} и {L} выжали друг из друга всё', 'Финал, который стоило ждать: {W} — {L}', 'До последнего раунда: {W} сильнее {L}', 'Матч года? {W} — {L} на пять карт', 'Марафон за {W}'],
  comeback: ['Камбэк {W}: отыгрались против {L}', '{W} проиграли первую карту и забрали серию', 'Характер {W}: разворот против {L}', '{L} упустили преимущество — {W} отыгрываются', 'Не списывайте {W}: камбэк против {L}', '{W} восстали после первой карты', 'Разворот серии: {W} — {L}', '{W} вытащили, казалось бы, проигранный матч'],
  ot: ['Овертайм решил всё: {W} — {L}', 'Нервы на пределе: {W} выигрывают в овертайме', '{W} и {L}: дополнительное время и победа {W}', 'Овертаймы любят {W}', '{L} были в шаге — овертайм за {W}', 'Сколько можно? Овертайм и победа {W}'],
  title: ['{W} — чемпионы {ev}!', '{W} забирают {ev}', 'Трофей едет к {W}', '{W} покоряют {ev}', 'Кубок {ev} у {W}', '{W} на вершине: победа на {ev}', 'Чемпионы! {W} выигрывают {ev}', '{W} пишут историю на {ev}', 'Никто не смог остановить {W} на {ev}', '{ev}: золото у {W}', '{W} — лучшие на {ev}', 'Триумф {W} на {ev}', '{W} поднимают трофей {ev}', 'И снова {W}: титул на {ev}', 'Корона {ev} — у {W}'],
  transfer: ['Официально: {P} — игрок {W}', '{W} объявили о переходе {P}', '{P} меняет клуб: теперь {W}', 'Новая глава для {P}: {W}', '{W} усиливаются: {P} в составе', 'Сделка закрыта: {P} в {W}', 'Подтверждено: {P} переходит в {W}', '{P} надевает форму {W}', 'Громкий переход: {P} — в {W}', '{W} заполучили {P}', 'Инсайд подтвердился: {P} в {W}', 'Трансферный рынок: {P} → {W}'],
  bench: ['{P} отправлен на скамейку', '{W} убирают {P} из основы', 'Перемены в {W}: {P} на скамейке', 'Конец эпохи? {P} вне состава {W}', '{P} больше не в стартовой пятёрке', 'Скамейка для {P}: что дальше?', 'Официально: {P} на скамейке {W}', '{W} ищут замену {P}'],
  player: ['{P} в огне!', 'Бенефис {P}', 'Матч одного игрока: {P}', '{P} разобрал соперников в одиночку', 'Цифры {P} впечатляют', '{P} снова тащит {W}', 'Звёздный час {P}', '{P} показал класс', 'Кто остановит {P}?', 'Шоу {P}: невероятная игра'],
  streak: ['{W}: серия продолжается', 'Неудержимые {W}', 'Победная серия {W} растёт', '{W} не умеют проигрывать', 'Сколько ещё продлится серия {W}?', 'Машина {W} набирает ход'],
  slump: ['Кризис в {W}?', 'Чёрная полоса {W} затягивается', '{W} не могут выиграть', 'Что происходит с {W}?', 'Тревожные звоночки для {W}', '{W} ищут выход из кризиса']
};
const PREFIX = ['', '', '', '', 'Официально: ', 'Разбор: ', 'Мнение: ', 'Цифры: ', 'Эксклюзив: '];
function angleOf(it) {
  if (it.cat === 'match') return ({ '💥': 'upset', '⚡': 'sweep', '5': 'five', '↻': 'comeback', '⏱': 'ot', '🔥': 'streak', '📉': 'slump' })[it.icon] || null;
  if (it.cat === 'tournament' || it.cat === 'major') return /чемпион|трофей|покоря|забира|выигрыва/i.test(it.title || '') ? 'title' : null;
  if (it.cat === 'transfer') return it.player ? 'transfer' : null;
  if (it.cat === 'roster') return /скамейк|основ/i.test(it.title || '') && it.player ? 'bench' : null;
  if (it.cat === 'player') return it.icon === '🎯' ? 'player' : null;
  return null;
}
function evName(it) { if (it.ev) { try { const s = (window.hubArchiveExport ? window.hubArchiveExport() : {})[it.ev]; if (s) return s.name; } catch (e) {} } return (it.title || '').match(/на (.+?)$/)?.[1] || 'турнире'; }
let startSeq = null;
function rewrite(it) {
  if (!it || it.v34h || it.legacy) return;
  if (startSeq == null) startSeq = Math.max(0, ...(N.all() || []).map(x => +x.o || 0));
  if ((+it.o || 0) <= startSeq) return;   // старые заголовки не трогаем — только новые материалы
  it.v34h = 1;
  const a = angleOf(it); if (!a) return;
  if (h32('keep' + it.id) % 3 === 0) return;                         // треть — исходный заголовок
  const W = it.team, L = it.loser || it.from, P = it.player;
  if (/[{]W[}]/.test(POOLS[a][0]) && !W) return;
  let t = pickH(POOLS[a], it.id + a);
  if ((/\{L\}/.test(t) && !L) || (/\{P\}/.test(t) && !P)) return;
  t = t.replace(/\{W\}/g, W || '').replace(/\{L\}/g, L || '').replace(/\{P\}/g, P || '').replace(/\{ev\}/g, evName(it));
  const pre = a === 'transfer' || a === 'bench' || /^\{ev\}|^[A-ZА-Я][^:]*:/.test(t) ? '' : pickH(PREFIX, it.id + 'p');
  it.v34orig = it.title; it.title = (pre + t).replace(/\s+/g, ' ').trim();
}
setInterval(() => { try { (N.all() || []).slice(0, 40).forEach(rewrite); } catch (e) {} }, 400);

/* ---- 2. топ-30 трансферов ---- */
const pw = p => p ? (+p.firepower || 70) * .4 + (+p.tacticalIQ || 70) * .25 + (+p.clutch || 70) * .2 + (+p.utility || 70) * .15 : 70;
function topTransfers() {
  const s = (typeof seasonState !== 'undefined' && seasonState.currentSeason) || 1;
  const moves = ((typeof transferState !== 'undefined' && transferState.v30Moves) || []).filter(m => m && m.season >= s - 1 && ['transfer', 'buyout', 'signing', 'release', 'bench', 'promotion', 'loan'].includes(m.type));
  const prest = n => window.V33Prestige ? window.V33Prestige.prestige(n) : 40;
  const score = m => { const p = H.playerNow(m.player)?.p; return pw(p) * 1.2 + Math.max(prest(m.to), prest(m.from)) * .4 + (m.season === s ? 8 : 0) + ({ transfer: 10, buyout: 10, signing: 4, bench: 3, release: 2, promotion: 2, loan: 1 })[m.type]; };
  const seen = new Set();
  return moves.slice().sort((a, b) => score(b) - score(a)).filter(m => { if (seen.has(m.player)) return false; seen.add(m.player); return true; }).slice(0, 30);
}
function side(name, kind) {
  if (!name || name === 'Свободный агент' || name === '—' || /агент/i.test(name)) return `<span class="tt-badge">${kind === 'from' ? 'Без команды' : 'Свободный'}</span>`;
  return `<span class="tt-logo" data-tip="${esc(name)}">${logo(name, 'sm')}</span>`;
}
function ttRow(m) {
  const p = H.playerNow(m.player)?.p, bench = m.type === 'bench';
  return `<button type="button" class="tt-row" data-player="${esc(m.player)}" data-tip="${esc(m.player)}: ${esc(m.from || '—')} → ${esc(bench ? 'скамейка ' + (m.from || '') : m.to || '—')}${m.reason ? ' · ' + esc(m.reason) : ''}">
    <span class="tt-ph">${H.photoHtml(p || { nick: m.player })}</span><span class="tt-n">${esc(m.player)}</span>
    <span class="tt-way">${side(m.from, 'from')}<i>→</i>${bench ? `<span class="tt-logo">${logo(m.from, 'sm')}</span><span class="tt-badge b">Скамейка</span>` : side(m.to, 'to')}</span></button>`;
}
const UI = { all: false };
function ttBox() {
  const list = topTransfers(); if (!list.length) return '';
  return box('Топ-30 трансферов', `<div class="tt">${list.slice(0, UI.all ? 30 : 6).map(ttRow).join('')}</div><button type="button" class="tt-more" ${UI.all ? 'data-nav="transfers"' : 'data-ttall'}>${UI.all ? 'Все трансферы →' : 'Показать топ-30'}</button>`, '', 'flush tt-box');
}
H.CLICKS.push(['[data-ttall]', () => { UI.all = true; H.render(); }]);

/* ---- 3. плашка гранд-финала ---- */
function finalBanner() {
  const lm = H.liveMatches ? H.liveMatches() : [];
  const f = lm.find(x => x.snap && x.snap.tier === '1' && /(^|· )(Гранд-финал|Финал)( \(|$)/.test(x.m.__stage || '') && !/полу|1\/2|четверт/i.test(x.m.__stage || '') && x.m.a && x.m.b);
  if (!f) return '';
  const m = f.m, it = H.liveItem(m.a, m.b), ls = it ? H.liveSc(m) : null, pa = !ls && H.plannedAt ? (m.at ? { ms: m.at } : H.plannedAt(m)) : null;
  const d = pa ? new Date(pa.ms) : null;
  const ros = n => (H.teamBy(n)?.players || []).slice(0, 5).map(p => `<span class="fb-p">${H.photoHtml(p, true)}</span>`).join('');
  const kind = f.snap.prestige || 'regular';
  return `<section class="fb k-${esc(kind)}"><div class="fb-in"><div class="fb-ros a">${ros(m.a)}</div>
    <div class="fb-mid"><h2>${esc(f.snap.name)}</h2><small>Гранд-финал</small>${ls ? `<div class="fb-sc">${ls.a} : ${ls.b}</div><span class="hs-live">LIVE</span>` : `<div class="fb-time">${d ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'}</div><small>${d ? d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''}</small>`}
      <div class="fb-teams">${logo(m.a, 'sm')} ${esc(m.a)} <i>vs</i> ${esc(m.b)} ${logo(m.b, 'sm')}</div></div><div class="fb-ros b">${ros(m.b)}</div></div>
    <nav class="fb-nav"><button type="button" data-event="cur">Обзор</button><button type="button" data-event="cur" data-etab2="matches">Матчи</button><button type="button" data-match="${esc(f.snap.id + '~' + m.__k)}">Матч</button><button type="button" data-nav="pickem">Pick'Em</button></nav></section>`;
}
const origHome = H.PAGES.home;
H.PAGES.home = arg => {
  let html = origHome(arg);
  const tt = ttBox();
  if (tt) { const re = /<section class="hs-box flush"><header class="hs-box-h"><h3>Трансферы<\/h3>[\s\S]*?<\/section>/; html = re.test(html) ? html.replace(re, tt) : html.replace(/(<section class="hs-box[^"]*"><header class="hs-box-h"><h3>Рейтинг команд)/, tt + '$1'); }
  const fb = finalBanner(); if (fb) html = fb + html;
  return html;
};
console.info('[v34] заголовки, топ-30 трансферов, плашка финала');
})();
