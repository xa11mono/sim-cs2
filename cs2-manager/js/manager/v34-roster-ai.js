/* v34 — стабильность составов, идентичность организаций, роли.
   1. Решения о составе — через состояния команды: STABLE → MONITORING → UNDER_REVIEW → TRANSFER_SEARCH →
      NEGOTIATION → TRANSITION. Добровольные сделки разрешены только в TRANSFER_SEARCH/NEGOTIATION; после
      любого изменения пятёрки — период адаптации (недели и матчи). Вынужденные события (контракт, пенсия,
      запрос игрока, финансы, замена на время) не блокируются.
   2. Сигналы оцениваются вместе: результаты против ожиданий, длительная форма (Rating 2.0 за последние карты),
      соответствие роли, сыгранность, уверенность, финансы, наличие альтернативы и выигрыш от замены.
      Если плохо играют трое и больше — проблема общая (тактика/тренер), игрока не меняют.
   3. Team DNA — характер организации: терпение, жажда трофеев, ставка на молодёжь, осторожность в деньгах,
      зависимость от звёзд, склонность к перестройкам, ценность стабильности. Меняет пороги и выбор действия.
   4. История состава: первая пятёрка, все составы с датами, капитаны, стаж игроков, чемпионы, выпускники
      академии, перестройки. Ветераны клуба получают вес при сохранении.
   5. Роли: в составе ровно один IGL и один AWPer; явные ошибки ролей в данных исправлены.
   Все пороги — в CFG. */
(function () {
'use strict';
if (typeof teams === 'undefined' || typeof seasonState === 'undefined') return;
const H = window.HS;
const DAY = 864e5, WEEK = 7 * DAY;
const CFG = {
  adaptWeeks: 7,            // адаптация нового состава, игровых недель
  adaptMatches: 13,         // и не меньше стольких официальных матчей
  minMapsForm: 18,          // карт для оценки длительной формы игрока
  lowRating: 0.93,          // Rating 2.0 ниже — сигнал по игроку
  gapToTeam: 0.08,          // и ниже среднего по команде на столько
  collectiveCount: 3,       // столько игроков в минусе одновременно — общая проблема
  resultsPressure: 1.15,    // давление результатов (v30 pressure) выше — сигнал
  lowChem: 0.33, lowConf: 45,
  weeksToReview: 2, weeksToSearch: 3, weeksToCalm: 3,  // гистерезис между состояниями
  minSignalsReview: 2, minSignalsSearch: 2,
  rebuildWindowDays: 180,   // окно учёта перестроек
  maxPlannedInWindow: 2,    // плановых замен в окне (вторая — только с вескими основаниями)
  legacyDays: 540           // стаж, после которого игрок — «ветеран клуба»
};
const STATES = ['STABLE', 'MONITORING', 'UNDER_REVIEW', 'TRANSFER_SEARCH', 'NEGOTIATION', 'TRANSITION'];
const SL = { STABLE: 'Стабилен', MONITORING: 'Наблюдение', UNDER_REVIEW: 'Оценка состава', TRANSFER_SEARCH: 'Поиск игроков', NEGOTIATION: 'Переговоры', TRANSITION: 'Адаптация' };
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => Number(seasonState.calendar?.currentMs) || Date.now();
const lc = s => String(s || '').toLowerCase();
const S = () => { const o = seasonState.v34 = seasonState.v34 || { v: 1, t: {}, hist: {} }; o.t = o.t || {}; o.hist = o.hist || {}; return o; };
const pro = () => teams.filter(t => !t.isAcademy);
const sig = t => (t.players || []).map(p => p.nick).sort().join('|');

/* ---------------- Team DNA ---------------- */
// Известные организации — характер по их реальной истории; остальные — детерминированно по названию.
const DNA_PRESET = {
  'Team Spirit': { patience: .75, trophies: .8, youth: .9, frugal: .55, stars: .6, rebuild: .3, stability: .75 },
  'NAVI': { patience: .55, trophies: .85, youth: .7, frugal: .5, stars: .5, rebuild: .55, stability: .55 },
  'Team Vitality': { patience: .8, trophies: .9, youth: .4, frugal: .45, stars: .85, rebuild: .25, stability: .8 },
  'Astralis': { patience: .7, trophies: .6, youth: .75, frugal: .6, stars: .3, rebuild: .5, stability: .7 },
  'FAZE': { patience: .35, trophies: .9, youth: .2, frugal: .3, stars: .9, rebuild: .6, stability: .4 },
  'Team Falcons': { patience: .25, trophies: 1, youth: .2, frugal: .05, stars: 1, rebuild: .8, stability: .25 },
  'G2': { patience: .4, trophies: .85, youth: .45, frugal: .35, stars: .8, rebuild: .6, stability: .4 },
  'MOUZ': { patience: .8, trophies: .6, youth: .95, frugal: .6, stars: .4, rebuild: .3, stability: .75 },
  'FURIA': { patience: .7, trophies: .6, youth: .5, frugal: .55, stars: .5, rebuild: .4, stability: .7 },
  'The Mongolz': { patience: .9, trophies: .6, youth: .5, frugal: .7, stars: .4, rebuild: .15, stability: .9 },
  'HEROIC': { patience: .45, trophies: .6, youth: .6, frugal: .65, stars: .4, rebuild: .7, stability: .45 },
  'BC.GAME': { patience: .3, trophies: .8, youth: .2, frugal: .3, stars: .9, rebuild: .7, stability: .35 },
  'Team Liquid': { patience: .45, trophies: .7, youth: .4, frugal: .4, stars: .6, rebuild: .65, stability: .45 },
  'NIP': { patience: .5, trophies: .55, youth: .6, frugal: .55, stars: .5, rebuild: .55, stability: .5 }
};
const DNA_L = { patience: 'Терпение к неудачам', trophies: 'Жажда трофеев', youth: 'Ставка на молодёжь', frugal: 'Финансовая осторожность', stars: 'Зависимость от звёзд', rebuild: 'Склонность к перестройкам', stability: 'Ценность стабильности' };
function dna(name) {
  if (DNA_PRESET[name]) return DNA_PRESET[name];
  const h = h32('dna|' + name), f = k => ((h >>> (k * 4)) % 100) / 100;
  const t = teams.find(x => x.name === name), rich = (t?.pts || 400) > 650;
  return { patience: .35 + f(1) * .5, trophies: rich ? .6 + f(2) * .35 : .3 + f(2) * .4, youth: .3 + f(3) * .6, frugal: rich ? .25 + f(4) * .4 : .5 + f(4) * .45, stars: .3 + f(5) * .5, rebuild: .2 + f(6) * .5, stability: .4 + f(7) * .45 };
}

/* ---------------- состояние команды ---------------- */
function st(name) {
  const o = S().t, x = o[name] || (o[name] = { state: 'TRANSITION', since: now(), sig: '', changeAt: now(), changeMatches: 0, weeks: { bad: 0, calm: 0 }, signals: [], log: [], planned: [] });
  return x;
}
function matchesSince(name, ts) { // официальные карты/матчи команды после момента ts — по архиву
  try { return H.stats().ms.filter(m => (m.a === name || m.b === name) && (m.ts || 0) >= ts).length; } catch (e) { return 0; }
}
function formOf(nick, n) { // Rating 2.0 за последние n карт
  try { const o = H.stats().P[nick]; if (!o) return null; const z = H.Z0(); let maps = 0;
    for (const m of o.matches) { if (maps >= n) break; Object.keys(z).forEach(k => { z[k] += m.z[k] || 0; }); maps += m.z.maps || 1; }
    return maps >= n * .6 ? { r: H.line(z).rating, maps } : null; } catch (e) { return null; }
}
const ROLE_ATTR = { AWPer: 'firepower', IGL: 'tacticalIQ', Support: 'utility', 'Entry-fragger': 'firepower', Lurker: 'clutch', Rifler: 'firepower' };
function signals(t) {
  const out = [], name = t.name, d = dna(name);
  // 1. результаты против ожиданий (давление v30 учитывает силу соперников и рейтинг)
  let pr = 1; try { pr = window.v30MarketDebug.pressure(t); } catch (e) {}
  const prThr = CFG.resultsPressure - (d.trophies - .5) * .15 + (d.patience - .5) * .2;
  if (pr > prThr) out.push({ k: 'results', w: 1, t: `результаты ниже ожиданий (давление ${pr.toFixed(2)})` });
  // 2. длительная форма игроков
  const forms = (t.players || []).map(p => ({ p, f: formOf(p.nick, CFG.minMapsForm) })).filter(x => x.f);
  const avg = forms.length ? forms.reduce((s, x) => s + x.f.r, 0) / forms.length : 1;
  const low = forms.filter(x => x.f.r < CFG.lowRating && x.f.r < avg - CFG.gapToTeam);
  if (low.length >= CFG.collectiveCount) out.push({ k: 'collective', w: 1, t: `${low.length} игрока в спаде одновременно — общая проблема (тактика/тренер)`, players: low.map(x => x.p.nick) });
  else if (low.length) out.push({ k: 'form', w: 1, t: `длительный спад: ${low.map(x => `${x.p.nick} (${x.f.r.toFixed(2)} за ${x.f.maps} карт)`).join(', ')}`, players: low.map(x => x.p.nick) });
  // 3. соответствие роли: ключевой атрибут роли заметно ниже среднего состава
  const attrAvg = k => (t.players || []).reduce((s, p) => s + (+p[k] || 0), 0) / Math.max(1, (t.players || []).length);
  const misfit = (t.players || []).filter(p => { const k = ROLE_ATTR[p.role] || 'firepower'; return (+p[k] || 0) < attrAvg(k) - 7; });
  if (misfit.length === 1) out.push({ k: 'role', w: .6, t: `${misfit[0].nick} слабо закрывает роль ${misfit[0].role}`, players: [misfit[0].nick] });
  // 4–5. сыгранность и уверенность
  try { const V = window.V31; if (V) { const ch = V.chemistry(t), cf = V.teamConf(t);
    if (ch < CFG.lowChem && st(name).state !== 'TRANSITION') out.push({ k: 'chem', w: .6, t: `низкая сыгранность (${Math.round(ch * 100)}%)` });
    if (cf < CFG.lowConf) out.push({ k: 'conf', w: .6, t: `уверенность состава ${Math.round(cf)}` }); } } catch (e) {}
  // 7. финансы
  try { const o = window.V31 && window.V31.org(name); if (o && o.budget < -150000) out.push({ k: 'money', w: 1, forced: true, t: 'организация в долгах' }); } catch (e) {}
  return out;
}
const tenureDays = p => Math.max(0, (now() - (+p.v31since || now())) / DAY);

/* ---------------- переходы состояний ---------------- */
function evaluate(t) {
  const x = st(t.name), d = dna(t.name), cur = sig(t);
  if (x.sig !== cur) { // состав изменился — фиксируем и начинаем адаптацию
    if (x.sig) { x.changeAt = now(); x.state = 'TRANSITION'; x.since = now(); x.weeks = { bad: 0, calm: 0 }; x.log.unshift({ ts: now(), s: 'TRANSITION', why: 'изменился стартовый состав' }); }
    x.sig = cur;
  }
  const sg = signals(t); x.signals = sg;
  const indep = new Set(sg.map(s => s.k)).size, weight = sg.reduce((a, s) => a + s.w, 0);
  const played = matchesSince(t.name, x.changeAt);
  const adaptDone = now() - x.changeAt >= CFG.adaptWeeks * WEEK * (0.8 + d.patience * .4) && played >= CFG.adaptMatches;
  const go = (s, why) => { if (x.state === s) return; x.state = s; x.since = now(); x.log.unshift({ ts: now(), s, why }); if (x.log.length > 30) x.log.length = 30; };
  if (x.state === 'TRANSITION') { if (adaptDone) go('STABLE', `адаптация завершена: ${played} матчей`); return x; }
  if (!sg.length) { x.weeks.calm++; x.weeks.bad = 0; if (x.weeks.calm >= CFG.weeksToCalm && x.state !== 'STABLE') go('STABLE', 'проблемы ушли'); return x; }
  x.weeks.calm = 0; x.weeks.bad++;
  const need = k => Math.round(k * (0.7 + d.patience * .8));
  if (x.state === 'STABLE' && x.weeks.bad >= need(CFG.weeksToReview)) go('MONITORING', sg[0].t);
  else if (x.state === 'MONITORING' && indep >= CFG.minSignalsReview && played >= CFG.adaptMatches && x.weeks.bad >= need(CFG.weeksToReview) + 1) go('UNDER_REVIEW', sg.map(s => s.t).join('; '));
  else if (x.state === 'UNDER_REVIEW' && x.weeks.bad >= need(CFG.weeksToSearch) + 2) {
    const coll = sg.find(s => s.k === 'collective');
    if (coll) { go('MONITORING', 'общая проблема — сначала тактика и тренерский штаб'); x.coachReview = now(); x.weeks.bad = 0; }
    else if (indep >= CFG.minSignalsSearch && weight >= 1.6 && sg.some(s => s.players && s.players.length)) go('TRANSFER_SEARCH', 'подтверждённая потребность: ' + sg.filter(s => s.players).map(s => s.t).join('; '));
  } else if (x.state === 'TRANSFER_SEARCH' && now() - x.since > 10 * WEEK) go('MONITORING', 'подходящего кандидата не нашли');
  return x;
}
// плановые замены за окно перестроек
function plannedRecent(name) { const x = st(name); x.planned = (x.planned || []).filter(ts => now() - ts < CFG.rebuildWindowDays * DAY); return x.planned.length; }

/* ---------------- ворота для рынка ---------------- */
// Добровольное изменение состава команды разрешено?
function allowSearch(t) {
  const x = st(t.name), d = dna(t.name);
  if (!['TRANSFER_SEARCH', 'NEGOTIATION'].includes(x.state)) return false;
  const n = plannedRecent(t.name);
  if (n >= CFG.maxPlannedInWindow + (d.rebuild > .7 ? 1 : 0)) return false;                    // уже была перестройка
  if (n >= 1 && x.signals.reduce((a, s) => a + s.w, 0) < 2.4 && d.rebuild < .55) return false; // вторая — только с вескими основаниями
  return true;
}
// кого можно заменить: игрок из сигналов, не ветеран клуба без явной причины
function replaceable(t, p) {
  const x = st(t.name), flagged = new Set(x.signals.flatMap(s => s.players || []));
  if (!flagged.has(p.nick)) return false;
  if (tenureDays(p) > CFG.legacyDays && dna(t.name).stability > .6 && x.signals.filter(s => (s.players || []).includes(p.nick)).length < 2) return false;
  return true;
}
function notePlanned(t) { const x = st(t.name); (x.planned = x.planned || []).push(now()); x.state = 'TRANSITION'; x.since = now(); x.changeAt = now(); x.log.unshift({ ts: now(), s: 'TRANSITION', why: 'плановая замена' }); }

/* ---------------- роли ---------------- */
const ROLE_FIX = { Techno: 'Rifler', '910': 'AWPer', s1mple: 'AWPer', electroNic: 'Rifler', nafany: 'IGL', Ax1Le: 'Rifler', EliGE: 'Rifler', KRIMZ: 'Rifler', JW: 'AWPer', jL: 'Rifler', 'huNter-': 'IGL', XANTARES: 'Entry-fragger', broky: 'AWPer' };
function fixRoles(t) {
  const ps = t.players || []; if (ps.length < 5) return false; let ch = false;
  ps.forEach(p => { if (ROLE_FIX[p.nick] && p.role !== ROLE_FIX[p.nick] && !p.v34roleFixed) { p.role = ROLE_FIX[p.nick]; p.v34roleFixed = 1; ch = true; } });
  const keepBest = (role, score) => { const list = ps.filter(p => p.role === role);
    if (list.length > 1) { list.sort((a, b) => score(b) - score(a)).slice(1).forEach(p => { p.role = role === 'AWPer' ? 'Rifler' : (ROLE_FIX[p.nick] || 'Rifler'); }); ch = true; } };
  keepBest('IGL', p => (+p.tacticalIQ || 0) + tenureDays(p) / 120 + (ROLE_FIX[p.nick] === 'IGL' ? 50 : 0));
  keepBest('AWPer', p => (+p.firepower || 0) + (ROLE_FIX[p.nick] === 'AWPer' ? 50 : 0));
  if (!ps.some(p => p.role === 'IGL')) { const c = ps.filter(p => p.role !== 'AWPer').sort((a, b) => (+b.tacticalIQ || 0) - (+a.tacticalIQ || 0))[0]; if (c) { c.role = 'IGL'; ch = true; } }
  if (!ps.some(p => p.role === 'AWPer')) { const c = ps.filter(p => p.role !== 'IGL').sort((a, b) => (+b.firepower || 0) - (+a.firepower || 0))[0]; if (c) { c.role = 'AWPer'; ch = true; } }
  return ch;
}

/* ---------------- история состава ---------------- */
function hist(name) { const o = S().hist; return o[name] || (o[name] = { founding: null, rosters: [], captains: [], tenure: {}, champions: {}, grads: [], rebuilds: [] }); }
function recordHistory(t) {
  const h = hist(t.name), nicks = (t.players || []).map(p => p.nick), cur = nicks.slice().sort().join('|'), ts = now();
  if (!h.founding) h.founding = { ts, players: nicks.slice() };
  const last = h.rosters[0];
  if (!last || last.sig !== cur) {
    if (last) { last.to = ts; const out = last.players.filter(n => !nicks.includes(n)), inn = nicks.filter(n => !last.players.includes(n));
      if (out.length >= 2 && ts - (last.from || ts) < 120 * DAY) h.rebuilds.unshift({ ts, out, in: inn }); }
    h.rosters.unshift({ sig: cur, players: nicks.slice(), from: ts, to: null, season: seasonState.currentSeason });
    if (h.rosters.length > 40) h.rosters.length = 40;
  }
  const igl = (t.players || []).find(p => p.role === 'IGL');
  if (igl && (!h.captains[0] || h.captains[0].nick !== igl.nick)) { if (h.captains[0]) h.captains[0].to = ts; h.captains.unshift({ nick: igl.nick, from: ts, to: null }); if (h.captains.length > 20) h.captains.length = 20; }
  (t.players || []).forEach(p => { const r = h.tenure[p.nick] || (h.tenure[p.nick] = { from: +p.v31since || ts, days: 0 }); r.days = Math.max(r.days, Math.round((ts - r.from) / DAY)); r.last = ts; });
}
function collectChampions() {
  try { const A = window.hubArchiveExport ? window.hubArchiveExport() : {};
    Object.values(A).forEach(s => { if (!s || !s.champion || s.show) return; const h = S().hist[s.champion]; if (!h) return;
      (s.rost?.[s.champion] || []).forEach(p => { const l = h.champions[p.nick] = h.champions[p.nick] || []; if (!l.includes(s.id)) l.push(s.id); }); });
    ((transferState.v30Moves) || []).forEach(m => { if (m.type === 'promotion' && m.to) { const h = S().hist[m.to]; if (h && !h.grads.includes(m.player)) h.grads.push(m.player); } });
  } catch (e) {}
}

/* ---------------- подключение к рынку ---------------- */
// applyPlayerTransfer: покупатель вне TRANSFER_SEARCH/NEGOTIATION — сделка не проходит (кроме сделок менеджера и вынужденных)
(function gate() {
  const f = window.applyPlayerTransfer; if (typeof f !== 'function' || f.__v34) return;
  const w = function (fromTeam, toTeam, player) {
    const forced = window.__v31UserDeal || window.__v34Force || (toTeam && toTeam.isAcademy) || (fromTeam && st(fromTeam.name)?.signals?.some(s => s.forced));
    if (!forced && toTeam && !toTeam.isAcademy && !allowSearch(toTeam)) return false;
    const before = toTeam ? sig(toTeam) : '';
    const r = f.apply(this, arguments);
    if (r && toTeam) { if (!forced) notePlanned(toTeam); try { fixRoles(toTeam); if (fromTeam) fixRoles(fromTeam); } catch (e) {} if (sig(toTeam) !== before) recordHistory(toTeam); }
    return r;
  };
  w.__v34 = true; Object.keys(f).forEach(k => { w[k] = f[k]; }); window.applyPlayerTransfer = w; try { applyPlayerTransfer = w; } catch (e) {}
})();
// еженедельная оценка (по игровому времени) + роли + история
function weekly() {
  const o = S(), wk = Math.floor(now() / WEEK); if (o.week === wk) return; o.week = wk;
  pro().forEach(t => { try { evaluate(t); } catch (e) { console.warn('[v34] evaluate', t.name, e); } });
  sweep(); collectChampions();
}
function sweep() { let ch = false; teams.forEach(t => { if (fixRoles(t)) ch = true; recordHistory(t); }); if (ch) { try { saveTeams(); } catch (e) {} } }
setTimeout(() => { try { sweep(); pro().forEach(t => { const x = st(t.name); if (!x.sig) { x.sig = sig(t); x.state = 'STABLE'; x.changeAt = now() - CFG.adaptWeeks * WEEK; } }); } catch (e) { console.warn('[v34]', e); } }, 1200);
setInterval(() => { try { weekly(); } catch (e) { console.warn('[v34] weekly', e); } }, 2500);
window.V34Roster = { CFG, STATES, SL, dna, DNA_L, st, evaluate, signals, allowSearch, replaceable, notePlanned, fixRoles, hist, tenureDays, matchesSince };

/* ---------------- страница команды: идентичность ---------------- */
if (!H) return;
const esc = H.esc, box = H.box;
const origTeam = H.PAGES.team;
H.PAGES.team = arg => {
  const html = origTeam(arg), name = String(arg || '').split('/')[0], t = H.teamBy(name);
  if (!t || t.isAcademy || (H.S.ttab && H.S.ttab !== 'overview')) return html;
  const x = st(name), d = dna(name), h = hist(name);
  const dnaBars = Object.keys(DNA_L).map(k => `<div class="dna-r"><span>${DNA_L[k]}</span><i><b style="width:${Math.round(d[k] * 100)}%"></b></i></div>`).join('');
  const played = matchesSince(name, x.changeAt);
  const stateBox = `<div class="rs-state s-${x.state}"><b>${SL[x.state]}</b>${x.state === 'TRANSITION' ? `<small>адаптация: ${played} из ${CFG.adaptMatches} матчей</small>` : ''}</div>
    ${x.signals.length ? `<ul class="rs-sig">${x.signals.map(s => `<li>${esc(s.t)}</li>`).join('')}</ul>` : '<p class="hs-dim">Тревожных сигналов нет.</p>'}
    ${x.log.slice(0, 4).map(l => `<p class="rs-log"><span>${new Date(l.ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</span> ${SL[l.s]} — ${esc(l.why)}</p>`).join('')}`;
  const ten = Object.entries(h.tenure).sort((a, b) => b[1].days - a[1].days).slice(0, 6);
  const champs = Object.entries(h.champions).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const founding = h.founding ? h.founding.players.map(n => `<button type="button" data-player="${esc(n)}" class="${(t.players || []).some(p => p.nick === n) ? 'in' : ''}">${esc(n)}</button>`).join('') : '';
  const rosters = h.rosters.slice(0, 8).map(r => `<div class="rs-ros"><span>${new Date(r.from).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}${r.to ? ' – ' + new Date(r.to).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) : ' – сейчас'}</span><b>${r.players.map(esc).join(' · ')}</b></div>`).join('');
  const ident = `<section class="hs-box rs-ident"><header class="hs-box-h"><h3>Идентичность клуба</h3></header><div class="hs-box-b rs-grid">
    <div><h4>Состояние состава</h4>${stateBox}</div>
    <div><h4>Team DNA</h4>${dnaBars}</div>
    <div><h4>Первая пятёрка</h4><div class="rs-found">${founding || '<span class="hs-dim">—</span>'}</div>
      <h4>Ветераны клуба</h4>${ten.map(([n, r]) => `<p class="rs-ten"><button type="button" class="hs-link" data-player="${esc(n)}">${esc(n)}</button> — ${Math.round(r.days / 30)} мес.${r.days > CFG.legacyDays ? ' <span class="rs-leg">легенда клуба</span>' : ''}</p>`).join('') || '<p class="hs-dim">—</p>'}
      ${champs.length ? `<h4>Чемпионы в составе</h4>${champs.map(([n, l]) => `<p class="rs-ten">${esc(n)} — ${l.length} ${l.length === 1 ? 'титул' : 'титулов'}</p>`).join('')}` : ''}
      ${h.grads.length ? `<h4>Выпускники академии</h4><p>${h.grads.map(esc).join(', ')}</p>` : ''}
      ${h.captains.length > 1 ? `<h4>Капитаны</h4><p>${h.captains.slice(0, 6).map(c => esc(c.nick)).join(' → ')}</p>` : ''}</div>
    <div class="wide"><h4>История составов</h4>${rosters || '<p class="hs-dim">—</p>'}${h.rebuilds.length ? `<p class="hs-note">Перестроек: ${h.rebuilds.length}</p>` : ''}</div></div></section>`;
  const i = html.lastIndexOf('</div>');
  return html + ident;
};
console.info('[v34] стабильность составов, Team DNA, история, роли');
})();
