(() => {
'use strict';
/* =====================================================================
   v31 · Карьера в портале (раздел «Игра»)
   #/org         — штаб организации: команда, режим, бюджет, спонсор, объекты, события, цели
   #/training    — тренировочный центр: фокус недели, интенсивность, карта
   #/scout       — разведка соперника и подготовка (карты, игрок, темп)
   #/finance     — финансы: баланс, доходы/расходы по сезонам, журнал
   #/academy     — академия: таланты, оценка потенциала, повышение и продажа
   #/inbox       — центр событий: решения с последствиями
   #/negotiate   — переговоры: выкуп → ответ клуба/встречное → условия агента → подписание
   #/career      — цели, наследие, хроника карьеры
   + Match Center: тайм-ауты и решения в перерыве для вашей команды; профиль игрока: характер и контракт.
   ===================================================================== */
const H = window.HS, V = window.V31; if (!H || !V) return;
const { esc, logo, box, empty, f2, pFlag } = H;
const $ = id => document.getElementById(id);
const me = () => V.managed();
const T = () => H.teamBy(me());
const money = V.money;
const season = () => (typeof seasonState !== 'undefined' && seasonState.currentSeason) || 1;
const bar = (v, max, cls) => `<span class="cr-bar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, v / max * 100)).toFixed(0)}%"></i></span>`;
[['org', 'Штаб организации'], ['inbox', 'Центр событий'], ['training', 'Тренировки'], ['scout', 'Разведка и подготовка'], ['negotiate', 'Переговоры'], ['academy', 'Академия'], ['finance', 'Финансы'], ['career', 'Карьера и наследие']]
  .reverse().forEach(x => H.NAV_GAME.splice(1, 0, x));
const noTeam = () => `<div class="hs-head"><h1>Выберите организацию</h1>${me() ? '' : ''}</div>${box('Ваша команда', `<p class="hs-note">Карьерный режим ведётся за одну организацию. Остальные команды управляются AI по тем же правилам.</p>
  <div class="cr-pick">${H.ranked().filter(t => !t.isAcademy).slice(0, 40).map((t, i) => `<button type="button" class="cr-pickt" data-crpick="${esc(t.name)}">${logo(t.name, 'sm')}<b>${esc(t.name)}</b><small>#${i + 1}</small></button>`).join('')}</div>`)}`;
H.CLICKS.push(['[data-crpick]', el => { const n = el.dataset.crpick; V.setManaged(n); V.careerLog(`Начало карьеры в ${n}`); try { saveSeasonState(); } catch (e) {} H.render(); }]);
const need = fn => arg => me() && T() ? fn(arg) : noTeam();

/* ------------------------------------------------------------ штаб */
H.PAGES.org = need(() => {
  const t = T(), o = V.org(t.name), c = V.S(), rk = V.rankOf(t.name), chem = V.chemistry(t), conf = V.teamConf(t), wage = V.wageBill(t), up = V.facUpkeep(o);
  const open = c.events.filter(e => e.team === t.name && e.status === 'open');
  const modes = Object.keys(V.MODES).map(k => `<button type="button" class="hm-tab${c.mode === k ? ' on' : ''}" data-crmode="${k}">${({ quick: 'Quick', standard: 'Standard', hardcore: 'Hardcore' })[k]}</button>`).join('');
  const autos = [['training', 'Тренировки'], ['scouting', 'Разведка и подготовка'], ['market', 'Трансферы'], ['finance', 'Финансы и объекты'], ['events', 'События']].map(([k, l]) => `<label class="pt-check"><input type="checkbox" data-crauto="${k}"${c.auto[k] ? ' checked' : ''}> ${l} — AI</label>`).join('');
  const fac = Object.entries(V.FAC).map(([k, l]) => { const lv = o.fac[k] || 0, cost = V.FAC_COST[lv + 1];
    return `<tr><td class="l"><b>${l}</b></td><td><span class="cr-lv">${[1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span></td><td>${money(V.FAC_UPKEEP[lv])}</td><td class="r">${lv < 3 ? `<button type="button" class="hs-btn sm ghost" data-crup="${k}"${o.budget < cost ? ' disabled' : ''}>Уровень ${lv + 1} · ${money(cost)}</button>` : '<span class="hs-dim">максимум</span>'}</td></tr>`; }).join('');
  const goals = V.GOALS.map(g => { const a = (c.career.ach[t.name] || {})[g.k]; return `<li class="${a ? 'ok' : ''}"><span>${a ? '✓' : '○'}</span>${esc(g.l)}${a ? `<small>сезон ${a.s}</small>` : ''}</li>`; }).join('');
  return `<div class="hs-head"><h1>${logo(t.name, 'md')} ${esc(t.name)}</h1><div class="hs-filters"><span class="hs-sub">Режим управления</span><div class="hm-tabs">${modes}</div></div></div>
    <div class="pt-kpis"><div><small>Мировой рейтинг</small><b>#${rk}</b></div><div><small>Бюджет</small><b class="${o.budget < 0 ? 'dn' : ''}">${money(o.budget)}</b></div><div><small>Репутация</small><b>${Math.round(o.rep)}</b></div>${window.V33Prestige ? `<div><small>Престиж</small><b>${V33Prestige.starsHtml(V33Prestige.prestige(t.name))}</b></div>` : ''}<div><small>Сыгранность</small><b>${Math.round(chem * 100)}%</b></div><div><small>Уверенность</small><b>${Math.round(conf)}</b></div><div><small>Зарплаты / сезон</small><b>${money(wage)}</b></div></div>
    <div class="hs-grid2"><div class="hs-col">
      ${open.length ? box(`Требуют решения · ${open.length}`, open.slice(0, 4).map(evCard).join(''), '<button type="button" class="hs-more" data-nav="inbox">все →</button>') : ''}
      ${box('Инфраструктура', `<table class="hs-tbl"><thead><tr><th class="l">Объект</th><th>Уровень</th><th>Содержание</th><th></th></tr></thead><tbody>${fac}</tbody></table><p class="hs-note">Тренировочная база ускоряет рост навыков, аналитический отдел расширяет и уточняет разведку, академия и скаутинг дают таланты и точную оценку потенциала, психология защищает уверенность и игру под давлением, медиа растит репутацию и спонсорские выплаты. Содержание списывается еженедельно.</p>`, '', 'flush')}
    </div><div class="hs-col">
      ${box('Спонсор', o.sponsor ? `<div class="cr-sp"><b>${esc(o.sponsor.name)}</b><span>${money(o.sponsor.perSeason)} за сезон · бонус за титул ${money(o.sponsor.bonus)}</span><span>Цель: топ-${o.sponsor.target} · контракт до сезона ${o.sponsor.until}</span>${(o.sponsor.strikes || 0) >= 3 ? `<span class="dn">Спонсор недоволен: ${o.sponsor.strikes} нед. ниже цели</span>` : ''}</div>` : empty('Нет контракта'))}
      ${box('Автоматизация', `<div class="cr-autos">${autos}</div><p class="hs-note">AI использует те же правила и тот же бюджет, что и вы.</p>`)}
      ${box('Цели карьеры', `<ul class="cr-goals">${goals}</ul>`, '<button type="button" class="hs-more" data-nav="career">хроника →</button>')}
    </div></div>`;
});
H.CLICKS.push(['[data-crmode]', el => { V.setMode(el.dataset.crmode); H.render(); }]);
H.CLICKS.push(['[data-crup]', el => { const r = V.upgrade(me(), el.dataset.crup); if (!r.ok) alert(r.why); H.render(); }]);
document.addEventListener('change', e => { if (e.target.matches?.('#hs-root [data-crauto]')) { V.setAuto(e.target.dataset.crauto, e.target.checked); H.render(); } });

/* ------------------------------------------------------------ события */
function evCard(e) {
  return `<div class="cr-ev ${e.status}"><div class="cr-ev-h"><b>${esc(e.title)}</b><small>${H.ndate(e.ts)}${e.status === 'open' ? ` · решить до ${H.fdate(e.until)}` : ''}</small></div><p>${esc(e.text)}</p>
    ${e.status === 'open' ? `<div class="cr-ev-o">${e.options.map(o => `<button type="button" class="cr-opt" data-crev="${esc(e.id)}|${esc(o.k)}"><b>${esc(o.l)}</b><small>${esc(o.d || '')}</small></button>`).join('')}</div>`
      : `<p class="hs-note">Решение: ${esc((e.options.find(o => o.k === e.choice) || {}).l || '—')}${e.result ? ' — ' + esc(e.result) : ''}${e.status === 'expired' ? ' (истёк срок, решение принято автоматически)' : ''}</p>`}</div>`;
}
H.PAGES.inbox = need(() => {
  const c = V.S(), list = c.events.filter(e => e.team === me());
  const open = list.filter(e => e.status === 'open'), done = list.filter(e => e.status !== 'open').slice(0, 30);
  return `<div class="hs-head"><h1>Центр событий</h1><div class="hs-filters"><span class="hs-sub">События возникают из состояния команды: результатов, характера игроков, финансов и спонсора.</span></div></div>
    <div class="hs-grid2"><div class="hs-col">${box(`Открытые · ${open.length}`, open.map(evCard).join('') || empty('Сейчас решений не требуется'))}</div>
    <div class="hs-col">${box('Принятые решения', done.map(evCard).join('') || empty('История пуста'))}</div></div>`;
});
H.CLICKS.push(['[data-crev]', el => { const [id, k] = el.dataset.crev.split('|'); const r = V.resolve(id, k); if (!r.ok) alert(r.why || 'Не удалось'); try { saveTeams(); saveSeasonState(); } catch (e) {} H.render(); }]);

/* ------------------------------------------------------------ тренировки */
H.PAGES.training = need(() => {
  const t = T(), o = V.org(t.name), tr = o.train || V.aiTrainingPlan(t), maps = typeof MAP_POOL !== 'undefined' ? MAP_POOL : [];
  const auto = V.auto('training');
  const opts = Object.entries(V.TRAIN).map(([k, x]) => `<button type="button" class="cr-tr${tr.focus === k ? ' on' : ''}" data-crtf="${k}"${auto ? ' disabled' : ''}><b>${esc(x.l)}</b><small>${esc(x.hint)}</small></button>`).join('');
  const ints = Object.keys(V.INTENS).map(k => `<button type="button" class="hm-tab${tr.intensity === k ? ' on' : ''}" data-crti="${k}"${auto ? ' disabled' : ''}>${({ low: 'Лёгкая', normal: 'Обычная', high: 'Интенсивная' })[k]}</button>`).join('');
  const rows = (t.players || []).map(p => { V.ensurePerson(p); const g = p.v31tg && p.v31tg.s === season() ? p.v31tg.sum : 0;
    return `<tr data-player="${esc(p.nick)}"><td class="l">${pFlag(p)} <b>${esc(p.nick)}</b><small>${esc(p.role || '')}</small></td><td>${Math.round(+p.firepower)}</td><td>${Math.round(+p.tacticalIQ)}</td><td>${Math.round(+p.clutch)}</td><td>${Math.round(+p.utility)}</td><td>${Math.round(+p.fatigue || 0)}</td><td>${p.pers.prof}</td><td class="l">${bar(g, 3)} <small>+${g.toFixed(2)}</small></td></tr>`; }).join('');
  const mp = Object.entries(t.v31map || {}).filter(([, v]) => v > .2).sort((a, b) => b[1] - a[1]);
  return `<div class="hs-head"><h1>Тренировочный центр</h1><div class="hs-filters"><span class="hs-sub">Неделя — один фокус. Эффект применяется раз в игровую неделю.${auto ? ' Сейчас тренировки выбирает AI (Штаб → Автоматизация).' : ''}</span></div></div>
    <div class="hs-grid2"><div class="hs-col">${box('Фокус недели', `<div class="cr-trgrid">${opts}</div>
      <div class="cr-row"><span>Интенсивность</span><div class="hm-tabs">${ints}</div></div>
      <div class="cr-row"><span>Карта для практики</span><select class="hs-inp sm" data-crtm${auto ? ' disabled' : ''}>${maps.map(m => `<option${tr.map === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
      <p class="hs-note">Интенсивная неделя растит навыки быстрее, но добавляет усталость — она снижает силу команды в матчах. Прирост за сезон ограничен (+3 на игрока), ближе к потенциалу рост медленнее, после 29 лет — заметно медленнее. Навык карты без практики выветривается.</p>`)}
      ${box('Игроки', `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th>Огонь</th><th>Тактика</th><th>Клатч</th><th>Утилити</th><th>Усталость</th><th>Проф.</th><th class="l">Прирост за сезон</th></tr></thead><tbody>${rows}</tbody></table>`, '', 'flush')}</div>
    <div class="hs-col">${box('Сыгранность', `<div class="cr-big">${Math.round(V.chemistry(t) * 100)}%</div><p class="hs-note">Складывается из времени, проведённого вместе (до ~8 месяцев), коммуникации и лидерства. Новичок обнуляет свою часть — сыгранность не появляется мгновенно.</p>`)}
      ${box('Практика карт', mp.length ? mp.map(([m, v]) => `<div class="cr-row"><span>${esc(m)}</span>${bar(v, 10)}<b>+${v.toFixed(1)}</b></div>`).join('') : empty('Нет натренированных карт'))}</div></div>`;
});
const setTrain = patch => { const o = V.org(me()); o.train = Object.assign(o.train || V.aiTrainingPlan(T()), patch, { auto: false }); try { saveSeasonState(); } catch (e) {} H.render(); };
H.CLICKS.push(['[data-crtf]', el => setTrain({ focus: el.dataset.crtf })]);
H.CLICKS.push(['[data-crti]', el => setTrain({ intensity: el.dataset.crti })]);
document.addEventListener('change', e => { if (e.target.matches?.('#hs-root [data-crtm]')) setTrain({ map: e.target.value }); });

/* ------------------------------------------------------------ разведка */
function nextOpponent() {
  const lm = H.liveMatches ? H.liveMatches() : [], m = lm.find(x => x.m.a === me() || x.m.b === me());
  return m ? (m.m.a === me() ? m.m.b : m.m.a) : null;
}
H.S.sc = { opp: null };
H.PAGES.scout = need(() => {
  const t = T(), o = V.org(t.name), opp = H.S.sc.opp || nextOpponent() || o.prep?.opp || H.ranked().find(x => x.name !== t.name && !x.isAcademy)?.name;
  const r = V.scout(t.name, opp), list = H.ranked().filter(x => x.name !== t.name && !x.isAcademy).map(x => `<option${x.name === opp ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  const nx = nextOpponent();
  if (!r) return empty('Нет данных');
  const mp = Object.entries(r.maps).sort((a, b) => b[1].n - a[1].n);
  const prep = o.prep && o.prep.opp === opp ? o.prep : null;
  const usedMaps = Object.entries(o.prepUse || {}).filter(([k]) => k.startsWith(opp + '|')).map(([k, v]) => `${k.split('|')[1]} ×${v}`);
  const tempo = o.plan?.tempo || 'default';
  return `<div class="hs-head"><h1>Разведка: ${logo(opp, 'md')} ${esc(opp)}</h1><div class="hs-filters"><select class="hs-inp sm" data-crsopp>${list}</select>${nx ? `<span class="hs-sub">Следующий соперник: <b>${esc(nx)}</b></span>` : ''}</div></div>
    <div class="pt-kpis"><div><small>Изучено матчей</small><b>${r.studied} из ${r.cap}</b></div><div><small>Полнота</small><b>${Math.round(r.completeness * 100)}%</b></div><div><small>Актуальность</small><b class="${r.fresh < 1 ? 'dn' : ''}">${Math.round(r.fresh * 100)}%</b></div><div><small>Качество подготовки</small><b>${Math.round(r.quality * 100)}%</b></div><div><small>Стиль соперника</small><b>${esc(({ Aggressive: 'агрессия', Discipline: 'дисциплина', Tactical: 'тактика', Chaos: 'хаос' })[r.style] || r.style || '—')}</b></div></div>
    ${r.changed.length ? `<div class="hm-warn">Состав изменился с последнего изученного матча: ${r.changed.map(esc).join(', ')} — часть выводов может быть неверной.</div>` : ''}${r.coachMove ? `<div class="hm-warn">У соперника сменился тренер (${esc(r.coachMove.player)}).</div>` : ''}
    <div class="hs-grid2"><div class="hs-col">
      ${box('Карты (по изученным матчам)', mp.length ? `<table class="hs-tbl"><thead><tr><th class="l">Карта</th><th>Сыграно</th><th>Победы</th><th class="l">Винрейт</th><th>Раунды</th></tr></thead><tbody>${mp.map(([k, v]) => `<tr><td class="l"><b>${esc(k)}</b></td><td>${v.n}</td><td>${v.w}</td><td class="l">${bar(v.w, v.n)} ${Math.round(v.w / v.n * 100)}%</td><td>${v.rf}:${v.ra}</td></tr>`).join('')}</tbody></table>` : empty('Нет сыгранных карт в архиве'), '', 'flush')}
      ${box('Игроки (в изученных матчах)', `<table class="hs-tbl"><thead><tr><th class="l">Игрок</th><th class="l">Роль</th><th>Карт</th><th>K–D</th><th>Rating 2.0</th></tr></thead><tbody>${r.players.map(x => `<tr data-player="${esc(x.nick)}"><td class="l"><b>${esc(x.nick)}</b>${r.changed.includes(x.nick) ? ' <small>новичок — данных нет</small>' : ''}</td><td class="l">${esc(x.role || '')}</td><td>${x.l?.maps || 0}</td><td>${x.l?.maps ? x.l.k + '–' + x.l.d : '—'}</td><td>${x.l?.maps ? `<b class="${H.ratingCls(x.l.rating)}">${f2(x.l.rating)}</b>` : '—'}</td></tr>`).join('')}</tbody></table>`, '', 'flush')}
      ${box('Что в отчёте нет', '<p class="hs-note">В архиве матчей хранится счёт карт, составы и итоговая статистика, но не стороны (T/CT), расстановки, маршруты и закупки по раундам. Поэтому разведка не делает выводов о тактике сторон — только о картах, форме и игроках. Пики соперника — из истории вето, если она сохранилась.</p>' + (r.picks.length ? `<p class="hs-note">Частые пики: ${r.picks.slice(0, 4).map(([k, v]) => `${esc(k)} (${v})`).join(', ')}.</p>` : ''))}
    </div><div class="hs-col">
      ${box('Подготовка к матчу', `<p class="hs-note">До двух карт для заготовок и игрок, против которого строится план. Эффект действует 21 игровой день, слабеет при смене состава соперника и при каждом повторе одной заготовки против той же команды (соперник адаптируется).</p>
        <div class="cr-maps">${mp.concat((typeof MAP_POOL !== 'undefined' ? MAP_POOL : []).filter(m => !r.maps[m]).map(m => [m, null])).map(([k]) => `<label class="pt-check"><input type="checkbox" data-crpm value="${esc(k)}"${prep?.maps.includes(k) ? ' checked' : ''}> ${esc(k)}</label>`).join('')}</div>
        <div class="cr-row"><span>Против игрока</span><select class="hs-inp sm" data-crpa><option value="">—</option>${r.players.map(x => `<option${prep?.anti === x.nick ? ' selected' : ''}>${esc(x.nick)}</option>`).join('')}</select></div>
        <button type="button" class="hs-btn" data-crprep="${esc(opp)}"${V.auto('scouting') ? ' disabled' : ''}>Утвердить подготовку</button>
        ${prep ? `<p class="hs-note up">Готово: ${prep.maps.map(esc).join(', ') || 'общий план'}${prep.anti ? ', против ' + esc(prep.anti) : ''} · качество ${Math.round(prep.quality * 100)}% · ${H.fdate(prep.ts)}</p>` : ''}
        ${usedMaps.length ? `<p class="hs-note">Уже применяли против ${esc(opp)}: ${usedMaps.map(esc).join(', ')} — эффект ниже.</p>` : ''}`)}
      ${box('Темп игры (план на все матчи)', `<div class="hm-tabs">${[['slow', 'Медленный'], ['default', 'Стандартный'], ['fast', 'Быстрый']].map(([k, l]) => `<button type="button" class="hm-tab${tempo === k ? ' on' : ''}" data-crtempo="${k}">${l}</button>`).join('')}</div>
        <p class="hs-note">Темп сравнивается со стилем соперника: быстрый темп наказывает тактические команды и вязнет против дисциплинированных; медленный хорош против агрессии и хаоса.</p>`)}
    </div></div>`;
});
document.addEventListener('change', e => { if (e.target.matches?.('#hs-root [data-crsopp]')) { H.S.sc.opp = e.target.value; H.render(); } });
H.CLICKS.push(['[data-crprep]', el => { const maps = [...document.querySelectorAll('#hs-root [data-crpm]:checked')].map(x => x.value).slice(0, 2); const anti = document.querySelector('#hs-root [data-crpa]')?.value || null; V.setPrep(me(), { opp: el.dataset.crprep, maps, anti }); try { saveSeasonState(); } catch (e) {} H.render(); }]);
H.CLICKS.push(['[data-crtempo]', el => { const o = V.org(me()); o.plan = Object.assign(o.plan || {}, { tempo: el.dataset.crtempo }); H.render(); }]);

/* ------------------------------------------------------------ финансы */
H.PAGES.finance = need(() => {
  const t = T(), o = V.org(t.name), hist = Object.entries(o.hist || {}).sort((a, b) => b[0] - a[0]);
  const wage = V.wageBill(t), up = V.facUpkeep(o), spon = (o.sponsor?.perSeason || 0) * (1 + .1 * (o.fac.media || 0));
  const proj = spon - wage - up;
  const rows = hist.map(([s, y]) => `<tr><td class="l">Сезон ${s}</td><td class="up">${money(y.inc)}</td><td class="dn">${money(y.exp)}</td><td>${money(y.prize || 0)}</td><td>${money(y.spon || 0)}</td><td>${money(y.wage || 0)}</td><td>${money(y.trans || 0)}</td><td>${money(y.fac || 0)}</td><td class="${y.inc - y.exp >= 0 ? 'up' : 'dn'}"><b>${money(y.inc - y.exp)}</b></td></tr>`).join('');
  const led = (o.ledger || []).slice(0, 40).map(x => `<tr><td class="l">${H.fdate(x.ts)}</td><td class="l">${esc(x.note)}</td><td class="${x.amt >= 0 ? 'up' : 'dn'}">${money(x.amt)}</td></tr>`).join('');
  const sal = (t.players || []).map(p => `<tr data-player="${esc(p.nick)}"><td class="l"><b>${esc(p.nick)}</b></td><td>${money(V.ensurePerson(p).salary)}</td><td>${p.contractUntil || '—'}</td><td>${money(V.valueOf(p))}</td></tr>`).join('');
  return `<div class="hs-head"><h1>Финансы</h1></div>
    <div class="pt-kpis"><div><small>Баланс</small><b class="${o.budget < 0 ? 'dn' : ''}">${money(o.budget)}</b></div><div><small>Спонсор + медиа / сезон</small><b>${money(spon)}</b></div><div><small>Зарплаты / сезон</small><b>${money(wage)}</b></div><div><small>Объекты / сезон</small><b>${money(up)}</b></div><div><small>Без призовых за сезон</small><b class="${proj >= 0 ? 'up' : 'dn'}">${money(proj)}</b></div>${o.debt ? `<div><small>Долг по кредиту</small><b class="dn">${money(o.debt)}</b></div>` : ''}</div>
    <div class="hs-grid2"><div class="hs-col">${box('По сезонам', rows ? `<div class="pt-scroll x"><table class="hs-tbl"><thead><tr><th class="l">Сезон</th><th>Доходы</th><th>Расходы</th><th>Призовые</th><th>Спонсоры</th><th>Зарплаты</th><th>Трансферы</th><th>Объекты</th><th>Итог</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('Данных пока нет — они копятся каждую игровую неделю'), '', 'flush')}
      ${box('Журнал операций', led ? `<table class="hs-tbl"><tbody>${led}</tbody></table>` : empty('Операций нет'), '', 'flush')}</div>
    <div class="hs-col">${box('Контракты', `<table class="hs-tbl"><thead><tr><th class="l">Игрок</th><th>Зарплата</th><th>До сезона</th><th>Стоимость</th></tr></thead><tbody>${sal}</tbody></table>`, '', 'flush')}
      <p class="hs-note">Внутриигровая экономика: суммы масштабированы под симуляцию и не отражают реальные контракты.</p></div></div>`;
});

/* ------------------------------------------------------------ академия */
H.PAGES.academy = need(() => {
  const t = T(), o = V.org(t.name), ps = o.prospects || [], lvl = o.fac.academy || 0;
  const weakest = (t.players || []).slice().sort((a, b) => V.pow(a) - V.pow(b))[0];
  const rows = ps.map(p => { const e = V.estPot(t.name, p), now = V.pow(p), ready = weakest ? now - V.pow(weakest) : -99;
    return `<tr><td class="l">${pFlag(p)} <b>${esc(p.nick)}</b><small>${esc(p.role)}</small></td><td>${p.age}</td><td><b>${now.toFixed(1)}</b></td><td>${e.lo}–${e.hi}</td><td>${p.pers.prof}</td><td>${(p.exp || 0).toFixed(0)} нед.</td>
      <td class="l">${(p.hist || []).map(h => `<span class="cr-h" title="Сезон ${h.s}">${h.pw.toFixed(0)}</span>`).join('→')}</td><td class="${ready >= -2 ? 'up' : 'hs-dim'}">${ready >= 0 ? 'готов' : ready >= -2 ? 'почти' : (ready).toFixed(1)}</td>
      <td class="r"><button type="button" class="hs-btn sm" data-crpro="${esc(p.nick)}">В основу</button> <button type="button" class="hs-btn sm ghost" data-crsell="${esc(p.nick)}">Продать</button></td></tr>`; }).join('');
  return `<div class="hs-head"><h1>Академия</h1><div class="hs-filters"><span class="hs-sub">Уровень академии ${lvl}, скаутинга ${o.fac.scouting || 0}. Набор — раз в сезон: число игроков зависит от академии и скаутского отдела.</span></div></div>
    ${box(`Таланты · ${ps.length}`, ps.length ? `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th>Возраст</th><th>Уровень</th><th>Потенциал (оценка)</th><th>Проф.</th><th>Опыт</th><th class="l">Развитие</th><th>Готовность</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      : empty(lvl ? 'Новый набор — в начале следующего сезона' : 'Постройте академию в Штабе организации — без неё таланты не приходят'), '', 'flush')}
    <p class="hs-note">Потенциал — оценка скаута с погрешностью ±${V.estPot(t.name, { nick: 'x', pot: 80 }).err}: настоящий потолок неизвестен. Рост зависит от уровня академии, профессионализма и возраста; у каждого таланта бывают сезоны-плато и сезоны-прорывы. После 22 лет игрок покидает академию. «В основу» заменяет самого слабого игрока состава (он уходит на скамейку), роли AWPer и IGL не дублируются.</p>`;
});
H.CLICKS.push(['[data-crpro]', el => { if (!V.promoteProspect(me(), el.dataset.crpro)) alert('Не удалось поднять игрока: проверьте роли в составе'); else V.careerLog(`Воспитанник ${el.dataset.crpro} поднят в основу`); try { saveTeams(); saveSeasonState(); } catch (e) {} H.render(); }]);
H.CLICKS.push(['[data-crsell]', el => { if (!confirm(`Продать ${el.dataset.crsell}?`)) return; const fee = V.sellProspect(me(), el.dataset.crsell); if (fee) V.careerLog(`Талант ${el.dataset.crsell} продан за ${money(fee)}`); H.render(); }]);

/* ------------------------------------------------------------ переговоры */
// стадии: inquiry → offer (ответ клуба / встречное) → terms (агент: зарплата, срок) → signed | failed
function negs() { const c = V.S(); c.nego = Array.isArray(c.nego) ? c.nego : []; return c.nego; }
const findP = nick => { for (const t of H.TEAMS()) { const p = (t.players || []).find(x => x.nick === nick); if (p) return { p, t }; } const fa = (transferState.freeAgents || []).find(x => x.nick === nick); return fa ? { p: fa, t: null } : null; };
function agentOf(p) { V.ensurePerson(p); if (!p.v31agent) { const names = ['North Star Mgmt', 'Baltic Talent', 'Volt Agency', 'Prime Esports Group', 'Lighthouse Sports', 'Red Line Agency']; p.v31agent = { name: names[(p.nick.length * 7 + p.nick.charCodeAt(0)) % names.length], greed: Math.round((0.95 + (p.nick.charCodeAt(0) % 9) * 0.04) * 100) / 100 }; } return p.v31agent; }
function askPrice(p, from) { const rk = V.rankOf(from.name); return Math.round(V.valueOf(p) * (1 + Math.max(0, 12 - rk) * .035) * (p.v31listed ? .8 : 1) / 1000) * 1000; }
function startNeg(nick) {
  const x = findP(nick); if (!x) return alert('Игрок не найден');
  if (x.t && x.t.name === me()) return alert('Это ваш игрок');
  if (negs().some(n => n.nick === nick && !['signed', 'failed'].includes(n.st))) return;
  const p = x.p, n = { id: 'ng' + Date.now().toString(36), nick, from: x.t ? x.t.name : null, st: x.t ? 'offer' : 'terms', rounds: 0, log: [], ts: Date.now() };
  if (x.t) {
    const rk = V.rankOf(x.t.name), best = (x.t.players || []).slice().sort((a, b) => V.pow(b) - V.pow(a))[0];
    if (rk <= 5 && best === p && !p.v31listed) { n.st = 'failed'; n.log.push(`${x.t.name}: игрок не продаётся — ключевой игрок команды из топ-5.`); }
    else { n.ask = askPrice(p, x.t); n.log.push(`${x.t.name} готовы обсуждать. Ориентир по выкупу — около ${money(n.ask)}.`); }
  } else n.log.push('Свободный агент: выкуп не нужен, обсуждаем условия с агентом.');
  negs().unshift(n); if (negs().length > 30) negs().length = 30;
  H.S.ng = n.id; H.render();
}
function offer(id, amount) {
  const n = negs().find(x => x.id === id); if (!n || n.st !== 'offer') return;
  const x = findP(n.nick); if (!x || x.t?.name !== n.from) { n.st = 'failed'; n.log.push('Игрок уже сменил команду.'); return; }
  n.rounds++; amount = Math.round(amount / 1000) * 1000;
  if (amount > V.org(me()).budget + 300000) { n.log.push(`Предложение ${money(amount)} больше, чем позволяет бюджет.`); n.rounds--; return; }
  const ask = n.counter || n.ask;
  if (amount >= ask) { n.fee = amount; n.st = 'terms'; n.log.push(`${n.from} принимают ${money(amount)}. Переходим к условиям игрока.`); }
  else if (amount >= ask * .82 && n.rounds < 3) { n.counter = Math.round((amount + ask) / 2 / 1000) * 1000; n.log.push(`${n.from} отклоняют ${money(amount)} и просят ${money(n.counter)}.`); }
  else if (amount < ask * .6 || n.rounds >= 3) { n.st = 'failed'; n.log.push(`${n.from} прекращают переговоры (${amount < ask * .6 ? 'предложение сочли неуважительным' : 'исчерпан лимит раундов'}).`); }
  else n.log.push(`${n.from} отклоняют ${money(amount)}. Ориентир — ${money(ask)}.`);
}
function demand(p) { const ag = agentOf(p), t = T(), cur = findP(p.nick)?.t; const up = cur ? V.rankOf(t.name) - V.rankOf(cur.name) : 0;
  return Math.round(V.salaryOf(p, t) * ag.greed * (1 + p.pers.amb / 50) * (up > 8 ? 1.25 : 1) * (window.V33Prestige ? V33Prestige.wageMul(t.name) : 1) / 1000) * 1000; }
function terms(id, salary, years) {
  const n = negs().find(x => x.id === id); if (!n || n.st !== 'terms') return;
  const x = findP(n.nick); if (!x) { n.st = 'failed'; return; }
  const p = x.p, d = demand(p), ag = agentOf(p), age = +p.age || 24, want = age <= 23 ? 3 : age >= 29 ? 1 : 2;
  const need = d * (1 + Math.abs(years - want) * .05);
  n.tries = (n.tries || 0) + 1;
  if (salary >= need) { n.salary = salary; n.years = years; n.st = 'ready'; n.log.push(`${ag.name}: условия приняты — ${money(salary)} за сезон, ${years} ${years === 1 ? 'сезон' : 'сезона'}.`); }
  else if (n.tries >= 3) { n.st = 'failed'; n.log.push(`${ag.name}: клиент выбрал другое предложение.`); }
  else n.log.push(`${ag.name}: мало. Клиент хочет не меньше ${money(Math.round(need / 1000) * 1000)}${years !== want ? ` (или контракт на ${want} ${want === 1 ? 'сезон' : 'сезона'})` : ''}.`);
}
function sign(id) {
  const n = negs().find(x => x.id === id); if (!n || n.st !== 'ready') return;
  const x = findP(n.nick), t = T(); if (!x || !t) return;
  if (x.t) {
    window.__v31UserDeal = { fee: n.fee, salary: n.salary, years: n.years };
    const prevAcc = window.playerWillAccept; window.playerWillAccept = () => true;
    let ok = false; try { ok = applyPlayerTransfer(x.t, t, x.p, 'переговоры менеджера'); } finally { window.playerWillAccept = prevAcc; window.__v31UserDeal = null; }
    if (ok) { n.st = 'signed'; n.log.push(`Подписан! ${n.nick} — игрок ${t.name}.`); }
    else n.log.push('Сделку не удалось закрыть: роли в составе (AWPer/IGL), недавняя покупка (не чаще раза в два окна), только что купленный игрок или ростер-лок/турнир.');
  } else { // свободный агент: заменить самого слабого игрока близкой роли
    const uniq = ['AWPer', 'IGL'], p = x.p;
    const out = (t.players || []).filter(q => q.role === p.role || (!uniq.includes(q.role) && !uniq.includes(p.role))).sort((a, b) => V.pow(a) - V.pow(b))[0];
    if (!out) { n.log.push('Нет места под эту роль в составе.'); return; }
    const i = transferState.freeAgents.indexOf(p); if (i < 0) { n.st = 'failed'; return; }
    transferState.freeAgents.splice(i, 1);
    const np = JSON.parse(JSON.stringify(p)); Object.assign(np, { status: 'STARTER', salary: n.salary, contractUntil: season() + n.years, v31team: t.name, v31since: typeof seasonState !== 'undefined' ? Number(seasonState.calendar?.currentMs) || Date.now() : Date.now() }); delete np.reservedFor; delete np.benchFrom;
    t.players[t.players.indexOf(out)] = np; out.status = 'BENCH'; out.benchFrom = t.name; transferState.freeAgents.push(out);
    try { ensurePlayerLayer(t); window.v29Emit && window.v29Emit('signing', { player: np.nick, role: np.role, from: 'Свободный агент', to: t.name, out: out.nick, reason: 'переговоры менеджера' }); window.v29Emit && window.v29Emit('bench', { player: out.nick, role: out.role, from: t.name, to: 'Скамейка', reason: `место занял ${np.nick}` }); } catch (e) {}
    n.st = 'signed'; n.log.push(`Подписан свободный агент ${np.nick}; ${out.nick} уходит на скамейку.`); V.careerLog(`Подписание: ${np.nick} (свободный агент)`);
  }
  try { saveTeams(); saveSeasonState(); } catch (e) {}
}
H.S.ng = null; H.S.ngq = '';
H.PAGES.negotiate = need(() => {
  const t = T(), o = V.org(t.name), q = (H.S.ngq || '').trim().toLowerCase();
  const pool = [];
  H.ranked().filter(x => x.name !== t.name && !x.isAcademy).forEach(x => (x.players || []).forEach(p => pool.push({ p, t: x })));
  (transferState.freeAgents || []).filter(p => !p.reservedFor).forEach(p => pool.push({ p, t: null }));
  const list = pool.filter(x => !q || (x.p.nick + ' ' + (x.t?.name || 'свободный агент')).toLowerCase().includes(q)).sort((a, b) => V.pow(b.p) - V.pow(a.p)).slice(0, 40);
  const n = negs().find(x => x.id === H.S.ng) || negs().find(x => !['signed', 'failed'].includes(x.st));
  let panel = empty('Выберите игрока в списке, чтобы начать переговоры');
  if (n) { const x = findP(n.nick), p = x?.p; const ag = p ? agentOf(p) : null;
    panel = `<div class="ng-h"><b>${esc(n.nick)}</b><span>${esc(n.from || 'свободный агент')} · агент ${esc(ag?.name || '—')}</span><span class="ng-st st-${n.st}">${({ offer: 'Переговоры с клубом', terms: 'Условия игрока', ready: 'Готово к подписанию', signed: 'Подписан', failed: 'Сорвались' })[n.st]}</span></div>
      <ol class="ng-steps">${['Выкуп', 'Условия', 'Подписание'].map((s, i) => `<li class="${(n.st === 'offer' && i === 0) || (n.st === 'terms' && i === 1) || (n.st === 'ready' && i === 2) ? 'on' : (['terms', 'ready', 'signed'].includes(n.st) && i === 0) || (['ready', 'signed'].includes(n.st) && i === 1) || (n.st === 'signed') ? 'ok' : ''}">${s}</li>`).join('')}</ol>
      <ul class="ng-log">${n.log.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      ${n.st === 'offer' ? `<div class="cr-row"><span>Предложение</span><input type="number" class="hs-inp" data-ngamt min="0" step="10000" value="${n.counter || n.ask}"><button type="button" class="hs-btn" data-ngoffer="${n.id}">Отправить</button></div><p class="hs-note">Раунд ${n.rounds + 1} из 3. Бюджет: ${money(o.budget)}.</p>` : ''}
      ${n.st === 'terms' && p ? `<div class="cr-row"><span>Зарплата / сезон</span><input type="number" class="hs-inp" data-ngsal step="10000" value="${demand(p)}"></div><div class="cr-row"><span>Срок</span><select class="hs-inp sm" data-ngyrs>${[1, 2, 3].map(y => `<option value="${y}"${y === 2 ? ' selected' : ''}>${y} ${y === 1 ? 'сезон' : 'сезона'}</option>`).join('')}</select><button type="button" class="hs-btn" data-ngterms="${n.id}">Предложить</button></div><p class="hs-note">Агент знает рынок: требования растут с амбициями игрока и если ваша команда заметно слабее его нынешней; престиж клуба снижает их до 20%. Роль игрока сохраняется — он займёт место по своей роли.</p>` : ''}
      ${n.st === 'ready' ? `<button type="button" class="hs-btn" data-ngsign="${n.id}">Подписать контракт</button>` : ''}`; }
  const rows = list.map(x => { const p = V.ensurePerson(x.p); return `<tr><td class="l">${pFlag(p)} <b>${esc(p.nick)}</b><small>${esc(p.role || '')}</small></td><td class="l">${x.t ? `${logo(x.t.name, 'xs')} ${esc(x.t.name)}` : '<span class="hs-dim">свободный агент</span>'}${p.v31listed ? ' <span class="hs-kind k-tier2">на продаже</span>' : ''}</td><td>${p.age || '—'}</td><td>${V.pow(p).toFixed(1)}</td><td>${x.t ? money(askPrice(p, x.t)) : '—'}</td><td>${p.contractUntil || '—'}</td><td class="r"><button type="button" class="hs-btn sm ghost" data-ngstart="${esc(p.nick)}">Переговоры</button></td></tr>`; }).join('');
  const mine = (t.players || []).map(p => `<tr><td class="l"><b>${esc(p.nick)}</b></td><td>${money(V.valueOf(p))}</td><td class="r"><button type="button" class="hs-btn sm ${p.v31listed ? '' : 'ghost'}" data-nglist="${esc(p.nick)}">${p.v31listed ? 'Снять с продажи' : 'Выставить на трансфер'}</button></td></tr>`).join('');
  return `<div class="hs-head"><h1>Переговоры</h1><div class="hs-filters"><input type="search" class="hs-inp" id="pt-ngq" placeholder="Игрок или команда" value="${esc(H.S.ngq)}"><span class="hs-sub">Бюджет ${money(o.budget)}${V.auto('market') ? ' · трансферы ведёт AI' : ''}</span></div></div>
    <div class="hs-grid2"><div class="hs-col">${box('Рынок', `<table class="hs-tbl hs-stbl"><thead><tr><th class="l">Игрок</th><th class="l">Команда</th><th>Возраст</th><th>Уровень</th><th>Ориентир выкупа</th><th>Контракт до</th><th></th></tr></thead><tbody>${rows}</tbody></table>`, '', 'flush')}</div>
    <div class="hs-col">${box('Текущие переговоры', panel)}${box('Ваш состав на рынке', `<table class="hs-tbl"><tbody>${mine}</tbody></table><p class="hs-note">Выставленного игрока могут купить другие клубы (со скидкой 20%). Без отметки AI не продаёт ваших игроков.</p>`, '', 'flush')}</div></div>`;
});
H.CLICKS.push(['[data-ngstart]', el => { startNeg(el.dataset.ngstart); if (el.hasAttribute('data-ngjump')) H.nav('negotiate'); }]);
H.CLICKS.push(['[data-ngoffer]', el => { offer(el.dataset.ngoffer, +document.querySelector('#hs-root [data-ngamt]').value); H.render(); }]);
H.CLICKS.push(['[data-ngterms]', el => { terms(el.dataset.ngterms, +document.querySelector('#hs-root [data-ngsal]').value, +document.querySelector('#hs-root [data-ngyrs]').value); H.render(); }]);
H.CLICKS.push(['[data-ngsign]', el => { sign(el.dataset.ngsign); H.render(); }]);
H.CLICKS.push(['[data-nglist]', el => { const p = (T()?.players || []).find(x => x.nick === el.dataset.nglist); if (p) { if (p.v31listed) delete p.v31listed; else p.v31listed = Date.now(); } H.render(); }]);
let ngT = null; document.addEventListener('input', e => { if (e.target.id !== 'pt-ngq') return; clearTimeout(ngT); const v = e.target.value; ngT = setTimeout(() => { H.S.ngq = v; H.render(); const i = $('pt-ngq'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); });
window.V31Nego = { startNeg, offer, terms, sign, negs, demand, askPrice };

/* ------------------------------------------------------------ карьера и наследие */
H.PAGES.career = need(() => {
  const t = T(), c = V.S(), ach = c.career.ach[t.name] || {};
  const arch = H.archive(), titles = Object.values(arch).filter(s => s && s.champion === t.name).sort((a, b) => (b.season - a.season) || ((b.ge || b.ts) - (a.ge || a.ts)));
  const prize = Object.values(V.org(t.name).hist || {}).reduce((s, y) => s + (y.prize || 0), 0);
  const riv = (c.rivals.list || []).filter(r => r.a === t.name || r.b === t.name);
  const log = c.career.log.slice(0, 60).map(x => `<li><time>${H.fdate(x.ts)} · С${x.s}</time><span>${esc(x.text)}</span></li>`).join('');
  return `<div class="hs-head"><h1>Карьера и наследие · ${esc(t.name)}</h1></div>
    <div class="pt-kpis"><div><small>Титулы</small><b>${titles.length}</b></div><div><small>Major</small><b>${titles.filter(s => s.prestige === 'major').length}</b></div><div><small>Призовые (с начала учёта)</small><b>${money(prize)}</b></div><div><small>Целей выполнено</small><b>${Object.keys(ach).length} из ${V.GOALS.length}</b></div></div>
    <div class="hs-grid2"><div class="hs-col">${box('Хроника', log ? `<ol class="cr-tl">${log}</ol>` : empty('Хроника пополняется вашими решениями, трансферами и титулами'))}</div>
    <div class="hs-col">${box('Трофеи', titles.length ? `<div class="tc-grid">${titles.slice(0, 18).map(s => `<button type="button" class="tc-item" data-event="${esc(s.id)}"><span class="tc-tr">${H.trophy(s.name, s.season, s.prestige)}</span><b>${esc(s.name)}</b></button>`).join('')}</div>` : empty('Первый трофей ещё впереди'))}
      ${box('Соперничества', riv.length ? riv.map(r => { const o = r.a === t.name ? r.b : r.a, w = r.a === t.name ? r.wa : r.n - r.wa; return `<button type="button" class="hm-rk" data-team="${esc(o)}">${logo(o, 'sm')}<span class="nm">${esc(o)}</span><span class="pts">${w}–${r.n - w}</span><span class="hs-dim">${r.fin} фин.</span></button>`; }).join('') : empty('Соперничество возникает из частых встреч, плей-офф и финалов'), '', 'flush')}</div></div>`;
});

/* ------------------------------------------------------------ Match Center: управление матчем */
const origMatch = H.PAGES.match;
H.PAGES.match = id => {
  let html = origMatch(id);
  const fm = H.findMatch ? H.findMatch(id) : null, m = fm?.m, mine = me();
  if (!m || !mine || (m.a !== mine && m.b !== mine)) return html;
  const it = H.liveItem(m.a, m.b), st = it?.state;
  if (!st) {
    const o = V.org(mine), opp = m.a === mine ? m.b : m.a, prep = o.prep && o.prep.opp === opp;
    return html + box('Подготовка вашей команды', `<p class="hs-note">${prep ? `Подготовка к ${esc(opp)} готова: ${o.prep.maps.map(esc).join(', ') || 'общий план'} (качество ${Math.round(o.prep.quality * 100)}%).` : `Подготовки к ${esc(opp)} нет.`} Темп: ${esc(({ slow: 'медленный', default: 'стандартный', fast: 'быстрый' })[o.plan?.tempo || 'default'])}.</p><button type="button" class="hs-btn ghost" data-crscout="${esc(opp)}">Открыть разведку</button>`);
  }
  const side = it.match.t1 === mine ? 1 : 2, left = side === 1 ? st.t1Pauses : st.t2Pauses;
  const calls = Object.entries(V.CALLS).map(([k, c]) => `<button type="button" class="cr-opt" data-crcall="${esc(it.id)}|${k}"${left <= 0 || st.phase !== 'playing' ? ' disabled' : ''}><b>${esc(c.l)}</b><small>${esc(c.d)}</small></button>`).join('');
  let half = '';
  if (!st.overtime && st.round >= 12 && st.round <= 15 && !st.v31Half?.[st.mapIndex]) {
    const r = V.halfReport(st, side);
    half = box(`Перерыв: ${r.mine}:${r.theirs}`, `<ul class="cr-notes">${r.notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="cr-ev-o">${r.options.map(o => `<button type="button" class="cr-opt" data-crhalf="${esc(it.id)}|${o.k}"><b>${esc(o.l)}</b><small>${esc(o.d)}</small></button>`).join('')}</div><p class="hs-note">Решение действует 6 раундов второй половины. Окно — до 15-го раунда.</p>`);
  } else if (st.v31Half?.[st.mapIndex]) half = `<p class="hs-note">Решение на вторую половину принято: ${esc(V.halfReport(st, side).options.find(o => o.k === st.v31Half[st.mapIndex].key)?.l || '')}.</p>`;
  const lg = (st.v31Log || []).slice(0, 5).map(x => `<li>Раунд ${x.round}: ${esc(V.CALLS[x.call]?.l || x.call)} — ${x.value >= .03 ? 'в точку' : 'не самое удачное время'}</li>`).join('');
  return html + `<div class="hs-grid2"><div class="hs-col">${box(`Тактический тайм-аут · осталось ${left}`, `<div class="cr-ev-o">${calls}</div><p class="hs-note">Тайм-аут доступен во время розыгрыша раунда. Эффект — 3 раунда и зависит от ситуации: «успокоить» помогает после серии поражений, «агрессия» — когда у соперника нет денег, «заготовка» — если была разведка.</p>${lg ? `<ul class="cr-notes">${lg}</ul>` : ''}`)}</div><div class="hs-col">${half}</div></div>`;
};
H.CLICKS.push(['[data-crcall]', el => { const [id, k] = el.dataset.crcall.split('|'); const r = V.userTimeout(id, k); if (!r.ok) alert(r.why); H.render(); }]);
H.CLICKS.push(['[data-crhalf]', el => { const [id, k] = el.dataset.crhalf.split('|'); const r = V.chooseHalf(id, k); if (!r.ok) alert(r.why); H.render(); }]);
H.CLICKS.push(['[data-crscout]', el => { H.S.sc.opp = el.dataset.crscout; H.nav('scout'); }]);

/* ------------------------------------------------------------ профиль игрока: характер и контракт */
const origPlayer = H.PAGES.player;
H.PAGES.player = nick => {
  const html = origPlayer(nick);
  if ((H.S.ptab || 'overview') !== 'overview') return html;
  const now = H.playerNow(nick); if (!now) return html;
  const p = V.ensurePerson(now.p), mineTeam = me();
  const traits = Object.entries(V.TRAIT_L).map(([k, l]) => `<div class="cr-row"><span>${l}</span>${bar(p.pers[k], 20)}<b>${p.pers[k]}</b></div>`).join('');
  const est = mineTeam && (+p.age || 25) <= 23 ? V.estPot(mineTeam, p) : null;
  const extra = `<div class="hs-ovgrid b">${box('Характер', traits + `<div class="cr-row"><span>Уверенность сейчас</span>${bar(p.conf, 100)}<b>${Math.round(p.conf)}</b></div><p class="hs-note">Характер влияет на рост (профессионализм), трансферы (амбиции и лояльность), игру под давлением в финалах и соперничествах, сыгранность (коммуникация, лидерство).</p>`)}
    ${box('Контракт', `<div class="cr-row"><span>Зарплата</span><b>${money(p.salary)} / сезон</b></div><div class="cr-row"><span>Контракт до</span><b>сезона ${p.contractUntil || '—'}</b></div><div class="cr-row"><span>Ориентир стоимости</span><b>${money(V.valueOf(p))}</b></div>${est ? `<div class="cr-row"><span>Потенциал (оценка вашего скаута)</span><b>${est.lo}–${est.hi}</b></div>` : ''}${p.academyGrad ? `<div class="cr-row"><span>Воспитанник</span><b>${esc(p.academyGrad)}</b></div>` : ''}
      ${mineTeam && now.t.name !== mineTeam ? `<button type="button" class="hs-btn ghost" data-ngstart="${esc(nick)}" data-ngjump>Начать переговоры</button>` : ''}`)}</div>`;
  return html + extra;
};
console.info('[v31] карьера в портале');
})();
