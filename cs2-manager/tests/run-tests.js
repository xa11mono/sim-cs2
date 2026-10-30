// Автотесты подсистем CS2 Manager (портал v30, карьера v31).
// Запуск: node tests/run-tests.js [профиль]  — нужен playwright (chromium). Профиль по умолчанию — временный.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
(async () => {
  const dir = path.resolve(__dirname, '..');
  const udd = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'cs2-test-'));
  const ctx = await chromium.launchPersistentContext(udd, { viewport: { width: 1600, height: 900 } });
  const p = ctx.pages()[0] || await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('file://' + dir + '/index.html'); await p.waitForTimeout(2500);
  // немного истории, чтобы было что разведывать
  await p.evaluate(async () => { for (let i = 0; i < 3; i++) { if (!(currentTournament && !currentTournament.completed)) skipGameCalendarDay(); await new Promise(r => setTimeout(r, 100)); if (currentTournament && !currentTournament.completed) simulateWholeTournament(); for (let k = 0; k < 100 && currentTournament && !currentTournament.completed; k++) await new Promise(r => setTimeout(r, 50)); } });
  const results = await p.evaluate(async () => {
    const R = []; const ok = (name, cond, info) => R.push({ name, pass: !!cond, info: info === undefined ? '' : String(info) });
    const V = window.V31, N = window.V31Nego, H = window.HS;
    const dupes = () => { const seen = {}; let d = 0; teams.forEach(t => t.players.forEach(p => { const k = p.nick.toLowerCase(); if (seen[k]) d++; seen[k] = 1; })); const both = (transferState.freeAgents || []).filter(p => seen[p.nick.toLowerCase()]).length; return d + both; };
    // 1. все страницы портала рисуются
    const pages = ['home', 'news', 'matches', 'events', 'calendar', 'ranking', 'players', 'teams', 'transfers', 'stats', 'awards', 'archive', 'predict', 'season', 'settings', 'sim', 'watch'];
    const broken = []; for (const pg of pages) { H.nav(pg); await new Promise(r => setTimeout(r, 30)); if (/Не удалось показать страницу/.test(document.getElementById('hs-page').innerHTML)) broken.push(pg); }
    ok('портал: все разделы рисуются без ошибок', !broken.length, broken.join(','));
    ok('целостность: игрок не числится в двух местах', dupes() === 0, dupes());
    // карьера за команду середины таблицы
    const me = H.ranked().filter(t => !t.isAcademy)[12].name; V.setManaged(me); V.S(); V.setMode('standard'); V.org(me).budget = 6e6;
    const careerPages = ['org', 'inbox', 'training', 'scout', 'negotiate', 'academy', 'finance', 'career'];
    const br2 = []; for (const pg of careerPages) { H.nav(pg); await new Promise(r => setTimeout(r, 30)); if (/Не удалось показать страницу/.test(document.getElementById('hs-page').innerHTML)) br2.push(pg); }
    ok('карьера: все страницы рисуются', !br2.length, br2.join(','));
    // 2. модификатор ограничен
    let maxM = 0; teams.forEach(a => teams.slice(0, 12).forEach(b => { if (a !== b) maxM = Math.max(maxM, Math.abs(V.careerMod(a.name, b.name, 'Mirage'))); }));
    ok('модификатор карьеры в пределах ±0.03', maxM <= 0.0300001, maxM.toFixed(4));
    // 3. переговоры: оскорбительное предложение → срыв
    const sellers = H.ranked().filter(t => !t.isAcademy && t.name !== me).slice(15, 30);
    const pick = (t) => t.players.find(p => p.role !== 'AWPer' && p.role !== 'IGL');
    let t1 = sellers[0], pl = pick(t1);
    N.startNeg(pl.nick); let n = N.negs()[0]; N.offer(n.id, n.ask * 0.4);
    ok('переговоры: заниженное предложение срывает сделку', n.st === 'failed', n.log.slice(-1)[0]);
    // встречное предложение → условия → подписание
    let t2 = sellers[1], pl2 = pick(t2); N.startNeg(pl2.nick); n = N.negs()[0];
    N.offer(n.id, Math.round(n.ask * 0.88)); const countered = n.st === 'offer' && !!n.counter;
    ok('переговоры: встречное предложение клуба', countered, n.log.slice(-1)[0]);
    N.offer(n.id, n.counter); ok('переговоры: клуб принимает встречную сумму', n.st === 'terms', n.st);
    const d = N.demand(pl2); N.terms(n.id, Math.round(d * 0.5), 2); ok('переговоры: агент отвергает низкую зарплату', n.st === 'terms', n.log.slice(-1)[0]);
    N.terms(n.id, Math.round(d * 1.2), 2); ok('переговоры: условия приняты', n.st === 'ready', n.st);
    const myB = V.org(me).budget, sB = V.org(t2.name).budget, fee = n.fee;
    transferState.marketRuns = (transferState.marketRuns || 0) + 5; H.teamBy(me).lastBuyRun = null;
    N.sign(n.id);
    const onMine = H.teamBy(me).players.some(p => p.nick === pl2.nick), onOld = t2.players.some(p => p.nick === pl2.nick);
    ok('трансфер: игрок в новом составе и не в старом', n.st === 'signed' && onMine && !onOld, n.log.slice(-1)[0]);
    ok('трансфер: деньги переведены (покупатель −, продавец +)', Math.abs((myB - V.org(me).budget) - fee) < 2 && Math.abs((V.org(t2.name).budget - sB) - fee) < 2, `${fee}`);
    ok('трансфер: зарплата и срок из переговоров', H.teamBy(me).players.find(p => p.nick === pl2.nick)?.salary === n.salary, n.salary);
    ok('целостность после трансфера', dupes() === 0, dupes());
    // свободный агент
    const fa = transferState.freeAgents.find(p => !p.reservedFor && p.role !== 'AWPer' && p.role !== 'IGL');
    if (fa) { N.startNeg(fa.nick); n = N.negs()[0]; N.terms(n.id, N.demand(fa) * 1.3, 1); N.sign(n.id);
      ok('свободный агент: подписан, вытесненный — на скамейке', n.st === 'signed' && H.teamBy(me).players.some(p => p.nick === fa.nick) && transferState.freeAgents.some(p => p.status === 'BENCH' && p.benchFrom === me), n.log.slice(-1)[0]); }
    ok('целостность после подписания', dupes() === 0, dupes());
    // 4. AI не покупает за управляемую команду
    const tgt = sellers[3], tp = pick(tgt), before = H.teamBy(me).players.map(p => p.nick).join();
    const r = applyPlayerTransfer(tgt, H.teamBy(me), tp, 'тест AI');
    ok('рынок: AI не покупает за управляемую команду', !r && H.teamBy(me).players.map(p => p.nick).join() === before);
    // 5. подготовка и адаптация соперника
    const opp = H.ranked()[0].name; V.setPrep(me, { opp, maps: ['Mirage'], anti: null }); V.org(me).prep.quality = 0.9;
    const m0 = V.prepMod(me, opp, 'Mirage'); V._t.markPrepUsed(me, opp, 'Mirage'); V._t.markPrepUsed(me, opp, 'Mirage'); const m2 = V.prepMod(me, opp, 'Mirage');
    ok('разведка: подготовка даёт бонус на выбранной карте', m0 > 0 && V.prepMod(me, opp, 'Nuke') === 0, m0.toFixed(4));
    ok('разведка: повтор заготовки слабеет (адаптация)', m2 < m0 * 0.5, `${m0.toFixed(4)} → ${m2.toFixed(4)}`);
    const rep = V.scout(me, opp); ok('разведка: объём ограничен отделом аналитики', rep.studied <= rep.cap, `${rep.studied}/${rep.cap}`);
    // 6. события: защита от повтора и последствия
    const tm = H.teamBy(me), star = tm.players[0]; V.ensurePerson(star);
    const e1 = V._t.raise('unhappy', me, [star.nick], { title: 't', text: 't', options: [{ k: 'raise', l: 'r' }, { k: 'list', l: 'l' }, { k: 'ignore', l: 'i' }], data: { nick: star.nick }, keySuffix: 'test' });
    const e2 = V._t.raise('unhappy', me, [star.nick], { title: 't', text: 't', options: [{ k: 'raise', l: 'r' }], data: { nick: star.nick }, keySuffix: 'test' });
    ok('события: повторное срабатывание блокируется', !!e1 && e2 === null);
    const sal = star.salary; V.resolve(e1.id, 'raise'); ok('события: решение меняет модель (зарплата +25%)', star.salary > sal, `${sal} → ${star.salary}`);
    ok('события: повторная обработка невозможна', V.resolve(e1.id, 'raise').ok === false);
    // 7. призовые платятся один раз
    const snap = Object.values(hubArchiveExport()).find(s => s.prestige === 'regular' || s.prestige === 'elite'); const ch = snap.champion, b0 = V.org(ch).budget;
    delete snap.v31paid; V.payPrizes(snap); const b1 = V.org(ch).budget; V.payPrizes(snap); const b2 = V.org(ch).budget;
    ok('экономика: призовые начисляются ровно один раз', b1 > b0 && b2 === b1, `${b0} → ${b1} → ${b2}`);
    // 8. тренировки: потолок прироста за сезон
    V.org(me).train = { focus: 'utility', intensity: 'high', map: 'Mirage' }; const u0 = tm.players.map(p => +p.utility);
    for (let i = 0; i < 40; i++) V._t.weekTraining();
    const g = tm.players.map((p, i) => +p.utility - u0[i]); ok('тренировки: прирост за сезон не больше +3', Math.max(...g) <= 3.0001, Math.max(...g).toFixed(2));
    ok('тренировки: интенсивность даёт усталость', tm.players.some(p => +p.fatigue > 20), Math.max(...tm.players.map(p => +p.fatigue)).toFixed(0));
    // 9. академия: набор, рост, повышение
    const o = V.org(me); o.fac.academy = 2; o.fac.scouting = 2; o.intake = 0; V._t.youthIntake(); const nPro = (o.prospects || []).length;
    ok('академия: набор талантов зависит от уровня', nPro >= 2, nPro);
    const pr = o.prospects[0], pw0 = V.pow(pr); for (let i = 0; i < 20; i++) V._t.weekYouth(); const pw1 = V.pow(pr);
    ok('академия: таланты развиваются и не превышают потенциал', pw1 > pw0 && pw1 <= pr.pot + 0.01, `${pw0.toFixed(1)} → ${pw1.toFixed(1)} (пот. ${pr.pot})`);
    const est = V.estPot(me, pr); ok('академия: оценка потенциала — диапазон, а не точное число', est.hi > est.lo, `${est.lo}–${est.hi}`);
    const prNick = pr.nick; const okP = V.promoteProspect(me, prNick); ok('академия: повышение в основу', okP && tm.players.some(p => p.nick === prNick), prNick);
    ok('целостность после повышения', dupes() === 0 && tm.players.filter(p => p.role === 'AWPer').length <= 1 && tm.players.filter(p => p.role === 'IGL').length <= 1);
    // 10. тайм-аут и перерыв в эфире (тестовый объект эфира)
    const realCT = currentTournament; const opp2 = H.ranked()[1].name;
    const st = { phase: 'playing', t1Pauses: 3, t2Pauses: 3, round: 6, map1: 2, map2: 4, mapIndex: 0, maps: ['Mirage'], mapRoundWinners: [2, 2, 1, 2, 1, 2], events: [], economy: { t1: { money: 4500 }, t2: { money: 1400 } }, __match: { t1: me, t2: opp2 }, pauseImpact: { 1: null, 2: null }, tacticalHistory: { 1: [], 2: [] } };
    currentTournament = { completed: false, broadcast: { active: [{ id: 'T', match: { t1: me, t2: opp2 }, state: st }] } };
    try {
      const tr = V.userTimeout('T', 'aggr'); ok('тайм-аут: принят во время раунда, пауза списана', tr.ok && st.t1Pauses === 2 && st.phase === 'tactical-pause', JSON.stringify(tr));
      publishPostPauseTactic(st, me, 'Mirage'); ok('тайм-аут: вызов «агрессия» на слабой экономике соперника усиливает команду', st.pauseImpact[1]?.user && st.pauseImpact[1].boost >= 0.049, st.pauseImpact[1]?.boost);
      st.phase = 'playing'; st.t1Pauses = 0; ok('тайм-аут: без оставшихся пауз — отказ', !V.userTimeout('T', 'calm').ok);
      st.round = 12; st.mapRoundWinners = [2, 2, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2];
      const h1 = V.chooseHalf('T', 'switch'); ok('перерыв: решение принято, верный выбор усиливает', h1.ok && h1.good && st.pauseImpact[1].boost > 0, JSON.stringify(h1));
      ok('перерыв: второе решение на ту же карту запрещено', !V.chooseHalf('T', 'stay').ok);
      st.round = 20; delete st.v31Half; ok('перерыв: вне окна 12–15 раундов — отказ', !V.chooseHalf('T', 'stay').ok);
    } finally { currentTournament = realCT; }
    // 11. неделя экономики: деньги не бесконечны, зарплаты списываются
    const bW = V.org(me).budget; V._t.weekEconomy(); ok('экономика: еженедельные доходы и расходы', V.org(me).budget !== bW, `${bW} → ${V.org(me).budget}`);
    { const o = V.org(me), keep = o.budget, cal = seasonState.calendar || (seasonState.calendar = {}), realNow = cal.currentMs; o.budget = 30000000;
      try { cal.currentMs = 4 * 7 * 864e5 * 1000; V._t.ownerDividend(teams.find(t => t.name === me), o); } finally { cal.currentMs = realNow; }
      const took = 30000000 - o.budget; o.budget = keep;
      ok('экономика: владельцы забирают часть излишка сверх резерва', took > 1500000 && took < 3500000, took); }
    // 13. режим зрителя: режиссёр выбирает напряжённый матч, повтор сохраняется и открывается
    { const SP = H.spectator, mk = (id, a, b, st) => ({ id, stage: 'Финал', match: { t1: a, t2: b }, state: Object.assign({ mode: 'BO3', phase: 'playing', mapIndex: 0, series1: 0, series2: 0, maps: ['Mirage'], mapRoundWinners: [], events: [] }, st) });
      const calm = mk('c', 'A', 'B', { map1: 10, map2: 2, round: 12 }), hot = mk('h', 'C', 'D', { map1: 12, map2: 12, round: 24, overtime: true, series1: 1, series2: 1 });
      ok('зритель: напряжённый матч (овертайм на решающей карте) важнее разгромного', SP.drama(hot) > SP.drama(calm) + 3, `${SP.drama(hot)} vs ${SP.drama(calm)}`);
      const rounds = [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1], it = mk('rp', 'Alpha', 'Beta', { series1: 2, series2: 0, finished: true, roundBuys: { 3: { t1: { type: 'full' }, t2: { type: 'eco' } } }, round: 3,
        mapResults: [{ map: 'Mirage', t1: 'Alpha', t2: 'Beta', t1Score: 13, t2Score: 3, winner: 'Alpha', rounds }, { map: 'Nuke', t1: 'Alpha', t2: 'Beta', t1Score: 13, t2Score: 9, winner: 'Alpha', rounds: [] }] });
      const before = SP.store().length; SP.track(it); SP.finish(it); SP.finish(it);
      const r = SP.store()[0];
      ok('зритель: повтор записан один раз, с раундами и закупками', SP.store().length === before + 1 && r.maps[0].r === rounds.join('') && r.maps[0].b1 === '--F' + '-'.repeat(13) && r.maps[1].sim, JSON.stringify(r.maps.map(m => [m.r.length, m.b1, m.sim])));
      H.nav('replay', r.id); await new Promise(x => setTimeout(x, 30));
      const pg = document.getElementById('hs-page').innerHTML;
      ok('зритель: страница повтора с раундами, графиком и закупками', /sp-rounds/.test(pg) && /sp-flow/.test(pg) && /Раунд 16/.test(pg) && /data-sprnd="16"/.test(pg), '');
      SP.store().shift(); }
    return R;
  });
  let fail = 0; results.forEach(r => { if (!r.pass) fail++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.info ? '  [' + r.info + ']' : ''}`); });
  if (errs.length) { console.log('Ошибки страницы:\n' + errs.slice(0, 10).join('\n')); }
  console.log(`\n${results.length - fail}/${results.length} проверок пройдено${errs.length ? `, ошибок страницы: ${errs.length}` : ''}`);
  await ctx.close(); process.exit(fail || errs.length ? 1 : 0);
})();
