/* v33 — живые комментарии и профиль фаната.
   • Под новостью 10–80 комментариев (зависит от важности): реплики по теме, упоминания игроков и команд из тегов,
     ответы друг другу (@ник), споры, мемы; лайки распределены как в жизни — несколько популярных, много с нулём.
   • Комментарии «приходят» со временем: видны только те, что написаны к текущему игровому моменту; пока статья
     открыта, каждые несколько секунд появляется новый («только что»), раздел обновляется без перерисовки формы.
   • Профиль фаната (#/fan): ник, страна, цвет аватара, любимая команда, статистика; кнопка «Стать фанатом» на
     странице команды. Свои комментарии подписываются ником профиля, на чужие можно отвечать и ставить лайки. */
(function () {
'use strict';
const H = window.HS, N = window.V29News; if (!H || !N) return;
const { esc, logo, box, empty } = H;
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const rng = seed => { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const nowG = () => H.nowMs ? H.nowMs() : Date.now();

/* ---- профиль фаната (localStorage, отдельно от сохранения игры) ---- */
const PK = 'cs2_fan_profile_v1';
const prof = (() => { try { return Object.assign({ nick: '', cc: 'RU', color: '#f5a524', team: '', bio: '', likes: {}, mine: [], since: Date.now() }, JSON.parse(localStorage.getItem(PK) || '{}')); } catch (e) { return { nick: '', cc: 'RU', color: '#f5a524', team: '', bio: '', likes: {}, mine: [], since: Date.now() }; } })();
const saveProf = () => { try { localStorage.setItem(PK, JSON.stringify(prof)); } catch (e) {} };
const myNick = () => prof.nick || 'Гость';

/* ---- генератор ников и текстов ---- */
const NA = ['s1mple', 'donk', 'zywoo', 'niko', 'm0nesy', 'dosia', 'kennys', 'fallen', 'coldzera', 'get_right', 'olof', 'guardian', 'electronic', 'flusha', 'device', 'b1t', 'ropz', 'sh1ro', 'twistzz', 'kscerato', 'awp', 'deagle', 'ak', 'm4', 'flash', 'smoke', 'molly', 'eco', 'rush', 'lurk', 'clutch', 'ace', 'hs', 'retake', 'mid', 'banana', 'connector', 'window', 'apps', 'ramp'];
const NB = ['_fan', 'enjoyer', '_main', 'lover', '_tv', 'god', 'kid', '_hater', 'boy', 'master', '2013', '_pro', 'king', '_ru', 'bro', 'machine', 'onlyhs', '_legend', 'abuser', 'wizard'];
const CCS = ['RU', 'RU', 'RU', 'UA', 'UA', 'KZ', 'BY', 'PL', 'DK', 'SE', 'FI', 'FR', 'DE', 'BR', 'BR', 'US', 'TR', 'CZ', 'LV', 'EE', 'MN', 'RS', 'PT', 'ES', 'NO', 'LT'];
const fanName = r => { const a = pick(r, NA), b = r() < .7 ? pick(r, NB) : '', n = r() < .45 ? String(Math.floor(r() * 2000)) : ''; let s = a + b + n; if (r() < .25) s = s[0].toUpperCase() + s.slice(1); return s; };
const G = { // общие реакции на всё
  any: ['Наконец-то нормальная новость', 'Кто-нибудь объяснит, что происходит?', 'Ну это было ожидаемо', 'Вот это поворот', 'Сохраню, через месяц посмотрим', 'HLTV как всегда быстрее всех', 'Лучший сайт, без шуток', 'Аналитики в комментах уже проснулись', 'Я так и знал', 'Спорно, но интересно', 'Ждём реакцию твиттера', 'Это войдёт в историю', 'Пора делать документалку', 'Подписываюсь под каждым словом', 'Кто ставил против — покажитесь 😂', 'Не ожидал, честно', 'Классика', '+rep автору', 'Сценаристы постарались', 'Мой прогноз опять мимо 😭'],
  match: ['{a} сегодня просто в другой лиге', 'Это был не матч, а избиение', 'Третья карта — кино', '{p} снова тащит', 'Оверы решают всё', 'Пистолетки выиграли — матч выиграли', 'Как {b} проиграли эту экономику?', 'Тактический таймаут на 11:3 — гениально', 'Вето решило исход ещё до старта', '{p} с AWP — это что-то', 'Ставил на {b}, больше не буду', 'Где был {p2} весь матч?', 'GG WP, достойно', 'Ретейк на B — учебник', 'Если бы не 1v3 в конце…', 'MVP — {p}, без вариантов'],
  transfer: ['{p} в {a}? Неожиданно', 'Трансфер года, не меньше', 'Химия будет не сразу, дайте время', '{b} без него уже не те', 'Сколько заплатили, интересно', 'Ждём первый турнир в новом составе', 'Это ошибка, поверьте', 'Наконец-то шейкап', 'Слухи оказались правдой', 'Роль останется та же?'],
  tournament: ['{a} заслужили этот кубок 🏆', 'Финал был огонь', '{p} — MVP турнира без вопросов', 'Самый скучный финал за год, извините', 'Это начало династии', 'Кто следующий их остановит?', '{b} опять не хватило чуть-чуть', 'Сетка была жестокой', 'Турнир года, имхо'],
  award: ['{p} заслужил, весь год был стабилен', 'Где {p2}? Ограбление', 'Топ без {p2} — не топ', 'Рейтинг всё сказал', 'Справедливо', 'Ждал выше в списке', 'Номер один — очевидно', 'Через год будет первым, вот увидите'],
  roster: ['Скамейка — это всегда грустно', 'Ему нужна смена обстановки', 'Правильное решение', 'Рано списывать'],
  rumor: ['Не верю, пока нет официалки', 'Инсайдер проверенный?', 'Было бы круто', 'Опять эти слухи', 'Похоже на правду']
};
const REPLY = ['@{u}, согласен полностью', '@{u}, ты смотрел вообще?', '@{u}, лол нет', '@{u}, база', '@{u}, а аргументы будут?', '@{u}, двачую', '@{u}, это ты зря', '@{u}, через год вспомнишь эти слова', '@{u}, +', '@{u}, вот это мнение'];
const EMO = ['', '', '', ' 🔥', ' 😂', ' 💀', ' 👏', ' 🤡', ' 😭', ' 🐐'];
function textFor(it, r, prev) {
  const tags = it.tags || [], pls = tags.filter(t => t.t === 'player').map(t => t.v), tms = tags.filter(t => t.t === 'team').map(t => t.v);
  const a = it.team || tms[0] || 'они', b = it.loser || it.from || tms[1] || 'соперники', p = it.player || pls[0] || 'их звезда', p2 = pls[1] || pick(r, ['ZywOo', 'donk', 'm0NESY', 'NiKo', 'ropz', 'sh1ro']);
  if (prev.length > 2 && r() < .28) { const u = pick(r, prev.slice(-8)); return pick(r, REPLY).replace('{u}', u.nick) + pick(r, EMO); }
  const cat = /match/.test(it.cat) ? 'match' : /transfer|signing/.test(it.cat) ? 'transfer' : /tournament|major|event/.test(it.cat) ? 'tournament' : /award|ranking|stats/.test(it.cat) ? 'award' : /roster|player|coach/.test(it.cat) ? 'roster' : /rumor/.test(it.cat) ? 'rumor' : 'any';
  const pool = r() < .7 ? G[cat] : G.any;
  return pick(r, pool).replace(/\{a\}/g, a).replace(/\{b\}/g, b).replace(/\{p\}/g, p).replace(/\{p2\}/g, p2) + pick(r, EMO);
}
// все комментарии статьи (детерминированно по id): время появления — от публикации до ~2 игровых суток
const cache = new Map();
function generated(it) {
  if (cache.has(it.id)) return cache.get(it.id);
  const r = rng(h32('c33|' + it.id)), imp = Math.max(1, Math.min(10, +it.imp || 3));
  const n = Math.round(6 + imp * 6.5 + r() * imp * 2), out = [];
  for (let i = 0; i < n; i++) {
    const delay = Math.pow(r(), 2.2) * 48 * 3600e3;                    // большинство — в первые часы
    const nick = fanName(r), likes = Math.floor(Math.pow(r(), 3.2) * imp * 28);
    out.push({ id: it.id + '#' + i, nick, cc: pick(r, CCS), text: textFor(it, r, out), likes, at: (+it.ts || 0) + delay });
  }
  out.sort((x, y) => x.at - y.at);
  cache.set(it.id, out); return out;
}
const liveExtra = new Map();   // комментарии, пришедшие пока статья открыта (в этой сессии)
function visible(it) {
  const now = nowG(), mine = (prof.mine || []).filter(c => c.art === it.id).map(c => ({ ...c, mine: true }));
  const gen = generated(it).filter(c => c.at <= now);
  return mine.concat(liveExtra.get(it.id) || [], gen.slice().reverse());
}
// совместимость: лента и счётчики используют N.comments
N.comments = it => visible(it).map(c => ({ nick: c.nick, cc: c.cc, text: c.text, likes: c.likes + (prof.likes[c.id] ? 1 : 0), mins: Math.max(0, Math.round((nowG() - c.at) / 60000)), mine: !!c.mine }));
N.comment = (id, text) => { text = String(text || '').trim().slice(0, 400); if (!text) return false; prof.mine.unshift({ id: 'me' + Date.now(), art: id, nick: myNick(), cc: prof.cc, text, likes: 0, at: nowG(), real: Date.now() }); if (prof.mine.length > 300) prof.mine.length = 300; saveProf(); return true; };

/* ---- раздел комментариев в статье ---- */
const UI = { sort: 'new', shown: 25, art: null };
const ago = c => { if (c.live || c.mine) { const s = Math.round((Date.now() - (c.real || Date.now())) / 1000); return s < 60 ? 'только что' : Math.round(s / 60) + ' мин назад'; }
  const m = Math.max(0, Math.round((nowG() - c.at) / 60000)); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.floor(m / 60) + ' ч назад' : Math.floor(m / 1440) + ' дн назад'; };
const av = (nick, color) => `<span class="cm-av" style="--av:${color || `hsl(${h32(nick) % 360} 55% 45%)`}">${esc(String(nick).slice(0, 1).toUpperCase())}</span>`;
function cmtsHtml(it) {
  const all = visible(it), list = UI.sort === 'top' ? all.slice().sort((a, b) => (b.likes + (prof.likes[b.id] ? 1 : 0)) - (a.likes + (prof.likes[a.id] ? 1 : 0))) : all;
  const reading = 3 + (h32(it.id + Math.floor(Date.now() / 20000)) % (8 + (+it.imp || 3) * 9));
  const items = list.slice(0, UI.shown).map(c => { const liked = !!prof.likes[c.id], mine = !!c.mine;
    const txt = esc(c.text).replace(/^@([\w.\-]+)/, '<b class="cm-at">@$1</b>');
    return `<div class="cm${mine ? ' mine' : ''}${c.live ? ' fresh' : ''}">${av(c.nick, mine ? prof.color : null)}<div class="cm-b"><div class="cm-h"><b>${c.cc ? H.flag(c.cc) + ' ' : ''}${esc(c.nick)}</b>${mine ? '<span class="cm-you">вы</span>' : ''}<span>${ago(c)}</span></div><p>${txt}</p>
      <div class="cm-a"><button type="button" class="cm-like${liked ? ' on' : ''}" data-cmlike="${esc(c.id)}">▲ ${c.likes + (liked ? 1 : 0)}</button>${mine ? '' : `<button type="button" class="cm-rep" data-cmrep="${esc(c.nick)}">Ответить</button>`}</div></div></div>`; }).join('');
  return `<header class="hs-box-h"><h3>Комментарии · ${all.length}</h3><span class="cm-live"><i></i>${reading} читают сейчас</span>
      <div class="cm-sort"><button type="button" class="${UI.sort === 'new' ? 'on' : ''}" data-cmsort="new">Новые</button><button type="button" class="${UI.sort === 'top' ? 'on' : ''}" data-cmsort="top">Популярные</button></div></header>
    <div class="hs-box-b"><div class="hs-cform">${av(myNick(), prof.color)}<textarea id="hs-ctext" maxlength="400" rows="2" placeholder="Комментарий от имени ${esc(myNick())}… (Ctrl+Enter — отправить)"></textarea><button type="button" class="hs-btn" data-csend="${esc(it.id)}">Отправить</button></div>
      ${prof.nick ? '' : '<p class="hs-note">Задайте ник, страну и любимую команду в <button type="button" class="hs-link" data-nav="fan">профиле фаната</button>.</p>'}
      <div class="cm-list">${items || '<p class="hs-dim">Пока тихо — будьте первым.</p>'}</div>
      ${list.length > UI.shown ? `<button type="button" class="hs-btn ghost cm-more" data-cmmore>Показать ещё ${Math.min(25, list.length - UI.shown)} из ${list.length - UI.shown}</button>` : ''}</div>`;
}
const origArticle = H.PAGES.article;
H.PAGES.article = id => {
  if (UI.art !== id) { UI.art = id; UI.shown = 25; }
  const html = origArticle(id), it = H.findNews(id);
  if (!it || it.legacy) return html;
  return html.replace(/<section class="hs-box hs-cmts">[\s\S]*?<\/section>/, `<section class="hs-box hs-cmts" id="cm-sec" data-art-id="${esc(id)}">${cmtsHtml(it)}</section>`);
};
function refreshSection() {
  const sec = document.getElementById('cm-sec'); if (!sec) return;
  const it = H.findNews(sec.dataset.artId); if (!it) return;
  const ta = document.getElementById('hs-ctext'), val = ta ? ta.value : '', focus = document.activeElement === ta, pos = ta ? ta.selectionStart : 0;
  sec.innerHTML = cmtsHtml(it);
  const nt = document.getElementById('hs-ctext'); if (nt) { nt.value = val; if (focus) { nt.focus(); nt.setSelectionRange(pos, pos); } }
}
// пока статья открыта — новые комментарии каждые 5–14 секунд
let nextLive = Date.now() + 6000;
setInterval(() => {
  if (H.S.page !== 'article' || document.hidden) return;
  const it = H.findNews(H.S.arg); if (!it || it.legacy) return;
  if (Date.now() < nextLive) return;
  const r = rng(h32(it.id + Date.now())), arr = liveExtra.get(it.id) || [];
  const age = (nowG() - (+it.ts || 0)) / 3600e3; if (age > 96 && r() < .7) { nextLive = Date.now() + 15000; return; }   // старые новости обсуждают реже
  arr.unshift({ id: it.id + '#l' + Date.now(), nick: fanName(r), cc: pick(r, CCS), text: textFor(it, r, visible(it).slice(0, 10)), likes: 0, at: nowG(), real: Date.now(), live: true });
  if (arr.length > 40) arr.length = 40; liveExtra.set(it.id, arr);
  nextLive = Date.now() + 5000 + Math.floor(r() * 9000);
  refreshSection();
}, 1000);
H.CLICKS.unshift(['[data-csend]', el => { const ta = document.getElementById('hs-ctext'); if (ta && N.comment(el.dataset.csend, ta.value)) { ta.value = ''; refreshSection(); } }]);
H.CLICKS.push(['[data-cmlike]', el => { const k = el.dataset.cmlike; if (prof.likes[k]) delete prof.likes[k]; else prof.likes[k] = 1; saveProf(); refreshSection(); }]);
H.CLICKS.push(['[data-cmrep]', el => { const ta = document.getElementById('hs-ctext'); if (ta) { ta.value = `@${el.dataset.cmrep}, ` + ta.value.replace(/^@[\w.\-]+,\s*/, ''); ta.focus(); } }]);
H.CLICKS.push(['[data-cmsort]', el => { UI.sort = el.dataset.cmsort; refreshSection(); }]);
H.CLICKS.push(['[data-cmmore]', () => { UI.shown += 25; refreshSection(); }]);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target?.id === 'hs-ctext') { const b = document.querySelector('[data-csend]'); if (b) { e.preventDefault(); b.click(); } } });

/* ---- профиль фаната ---- */
function pFan() {
  const mine = prof.mine || [], likesGot = mine.reduce((s, c) => s + Math.floor(Math.max(0, (Date.now() - (c.real || Date.now())) / 60000) / 7) % 50, 0);
  const pk = window.V33Pickem ? window.V33Pickem.rankOf((typeof seasonState !== 'undefined' && seasonState.pickemScore) || 0) : null;
  const f = N.fan ? N.fan() : null;
  const teamsOpts = H.ranked().filter(t => !t.isAcademy).map(t => `<option value="${esc(t.name)}"${prof.team === t.name ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
  const ccOpts = [...new Set(['RU', 'UA', 'KZ', 'BY', ...CCS])].map(c => `<option value="${c}"${prof.cc === c ? ' selected' : ''}>${H.flag(c)} ${c}</option>`).join('');
  const head = `<div class="fan-head">${av(myNick(), prof.color).replace('cm-av', 'cm-av xl')}<div><h1>${esc(myNick())}</h1><p class="hs-dim">${H.flag(prof.cc)} ${prof.team ? `фанат <button type="button" class="hs-link" data-team="${esc(prof.team)}">${esc(prof.team)}</button>` : 'без любимой команды'}${prof.bio ? ' · ' + esc(prof.bio) : ''}</p></div>${prof.team ? `<span class="fan-team">${logo(prof.team, 'lg')}</span>` : ''}</div>`;
  const kpis = `<div class="pt-kpis"><div><small>Комментариев</small><b>${mine.length}</b></div><div><small>Лайков получено</small><b>${likesGot}</b></div><div><small>Лайков поставлено</small><b>${Object.keys(prof.likes || {}).length}</b></div><div><small>Pick'Em</small><b>${pk ? esc(pk.name) : '—'}</b></div><div><small>Прогнозов угадано</small><b>${f ? `${f.won}/${f.won + f.lost}` : '—'}</b></div></div>`;
  const form = box('Настройки профиля', `<div class="fan-form"><label>Ник<input class="hs-inp" id="fan-nick" maxlength="24" value="${esc(prof.nick)}" placeholder="например, rush_b_master"></label>
      <label>Страна<select class="hs-inp" id="fan-cc">${ccOpts}</select></label><label>Цвет аватара<input type="color" id="fan-color" value="${esc(prof.color)}"></label>
      <label>Любимая команда<select class="hs-inp" id="fan-team"><option value="">—</option>${teamsOpts}</select></label><label class="wide">О себе<input class="hs-inp" id="fan-bio" maxlength="80" value="${esc(prof.bio)}"></label>
      <button type="button" class="hs-btn" data-fansave>Сохранить</button></div>`);
  const hist = box('Мои комментарии', mine.length ? mine.slice(0, 30).map(c => { const it = H.findNews(c.art); return `<button type="button" class="fan-cm" data-art="${esc(c.art)}"><small>${it ? esc(it.title) : 'новость удалена'}</small><span>${esc(c.text)}</span></button>`; }).join('') : empty('Вы ещё ничего не написали. Откройте любую новость — обсуждение идёт прямо сейчас.'), '', 'flush');
  return `${head}${kpis}<div class="hs-grid2"><div class="hs-col">${form}</div><div class="hs-col">${hist}</div></div>`;
}
H.PAGES.fan = pFan;
H.NAV_MORE.push(['fan', 'Профиль фаната']);
H.CLICKS.push(['[data-fansave]', () => { const v = id => document.getElementById(id)?.value || ''; prof.nick = v('fan-nick').trim().slice(0, 24); prof.cc = v('fan-cc') || 'RU'; prof.color = v('fan-color') || prof.color; prof.team = v('fan-team'); prof.bio = v('fan-bio').trim().slice(0, 80); saveProf(); H.render(); }]);
H.CLICKS.push(['[data-fanof]', el => { prof.team = prof.team === el.dataset.fanof ? '' : el.dataset.fanof; saveProf(); H.render(); }]);
// кнопка «Стать фанатом» на странице команды
const origTeam = H.PAGES.team;
H.PAGES.team = arg => { const html = origTeam(arg), name = String(arg || '').split('/')[0]; if (!H.teamBy(name)) return html;
  const on = prof.team === name;
  return html.replace('</h1>', ` <button type="button" class="hs-btn ${on ? '' : 'ghost'} sm fan-btn" data-fanof="${esc(name)}">${on ? '★ Вы фанат' : '☆ Стать фанатом'}</button></h1>`); };
window.V33Fan = { prof, visible };
console.info('[v33] живые комментарии и профиль фаната');
})();
