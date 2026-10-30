(() => {
'use strict';
/* =====================================================================
   v30 · Живой трансферный рынок
   Было (v29): по ходу сезона рынок запускался с вероятностью 18% и делал максимум 1 сделку;
   почти все переходы — в окне после Major.
   Стало: периодический анализ составов. Каждый тик (после каждого Tier-1 турнира — «mid»,
   раз в игровую неделю — «week», после Major — «big» поверх окна v29) у каждой команды
   считается давление (результаты против ожиданий по рейтингу, падение в рейтинге, серия
   поражений) и слабое звено состава. Команда под давлением действует:
     • подписывает свободного агента (старый игрок уходит на скамейку, позже — в свободные агенты);
     • покупает игрока у команды слабее (applyPlayerTransfer v28: роли AWPer/IGL, уникальные ники);
     • повышает игрока своей академии;
     • берёт в аренду молодого игрока чужой академии (с возвратом через несколько тиков);
     • меняет тренера.
   Звёзды слабых команд просят перехода (амбиции). Громкие сделки начинаются с переговоров:
   слух публикуется, затем подтверждается сделкой или опровергается, если переговоры сорвались.
   Контракты: у игрока есть contractUntil (сезон); в межсезонье — продления или уход.
   Сильные составы с хорошими результатами почти не трогаются. Перед Major и во время турнира
   команды-участники заморожены (ростер-лок). Все события — через шину v29 → новости, а журнал
   переходов — transferState.v30Moves (единый источник для профилей и страницы трансферов).
   ===================================================================== */
if (typeof teams === 'undefined' || typeof transferState === 'undefined' || typeof seasonState === 'undefined') return;
const DAY = 864e5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const emit = (type, data) => { try { window.v29Emit && window.v29Emit(type, data); } catch (e) {} };
const calNow = () => Number(seasonState.calendar?.currentMs) || Date.now();
const lc = s => String(s || '').toLowerCase();
const UNIQUE = ['AWPer', 'IGL'];
const pow = p => (+p.firepower || 0) * .4 + (+p.tacticalIQ || 0) * .25 + (+p.clutch || 0) * .2 + (+p.utility || 0) * .15;
const pro = () => teams.filter(t => !t.isAcademy);
const rankOf = t => pro().sort((a, b) => b.pts - a.pts).indexOf(t) + 1;
const clone = o => JSON.parse(JSON.stringify(o));
const run = () => Number(transferState.marketRuns) || 0;
const rnd = (() => { let s = (h32(String(seasonState.v29Salt || '') + Date.now()) || 1); return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const M = () => { const s = transferState; if (!Array.isArray(s.v30Moves)) s.v30Moves = []; if (!Array.isArray(s.v30Bench)) s.v30Bench = []; if (!Array.isArray(s.v30Loans)) s.v30Loans = []; if (!Array.isArray(s.v30Nego)) s.v30Nego = []; if (!s.v30Stats) s.v30Stats = {}; return s; };
const save = () => { try { saveTransferState(); saveTeams(); } catch (e) {} };
const onRoster = nick => teams.find(t => (t.players || []).some(p => lc(p.nick) === lc(nick))) || null;
const ACAD_PARENT = { 'Spirit Academy': 'Team Spirit', 'NAVI Junior': 'NAVI', 'G2 Ares': 'G2', 'MOUZ NXT': 'MOUZ' };
const academyFor = t => teams.find(a => a.isAcademy && (a.academyParent || a.parentTeam || ACAD_PARENT[a.name]) === t.name) || null;

/* ------------------------------------------------------------ журнал переходов */
function logMove(m) {
  const s = M(); m.ts = m.ts || calNow(); m.season = m.season || seasonState.currentSeason; m.id = m.id || ('mv' + (s.v30Moves.length + 1).toString(36) + (h32(m.player + m.ts) % 1e4).toString(36));
  s.v30Moves.unshift(m); if (s.v30Moves.length > 500) s.v30Moves.length = 500;
  const st = s.v30Stats[m.season] || (s.v30Stats[m.season] = {}); st[m.type] = (st[m.type] || 0) + 1;
}
// всё, что идёт через шину v29 (в т. ч. трансферы окна после Major), попадает в журнал
function scanBus() {
  (window.__v29Bus || []).forEach(ev => {
    if (!ev || ev.__v30) return; ev.__v30 = true; const d = ev.data || {};
    if (ev.type === 'transfer') {
      logMove({ type: d.buyout ? 'buyout' : 'transfer', player: d.player, role: d.role, from: d.from, to: d.to, reason: d.reason, nego: d.nego || null });
      if (d.out) logMove({ type: 'release', player: d.out, from: d.to, to: 'Свободный агент', reason: `уступил место ${d.player}` });
      if (d.rep) logMove({ type: 'signing', player: d.rep, from: 'Свободный агент', to: d.from, reason: `замена ушедшему ${d.player}` });
    } else if (ev.type === 'coach') logMove({ type: 'coach', player: d.to, from: d.team, to: d.team, reason: `вместо ${d.from}${d.reason ? ' · ' + d.reason : ''}` });
    else if (ev.type === 'standin') logMove({ type: 'standin', player: d.player, from: 'Свободный агент', to: d.team, reason: `временно вместо ${d.out}` });
    else if (ev.type === 'retire') { logMove({ type: 'retire', player: d.player, role: d.role, from: d.team, to: '—', reason: `${d.age} лет` }); if (d.rep) logMove({ type: 'signing', player: d.rep, from: 'Академия / FA', to: d.team, reason: `место ${d.player}` }); }
    else if (['signing', 'bench', 'release', 'promotion', 'loan', 'loan-return', 'extension'].includes(ev.type)) logMove({ type: ev.type, player: d.player, role: d.role, from: d.from, to: d.to, reason: d.reason });
  });
}
(() => { const prev = window.v29OnEvent; window.v29OnEvent = function () { try { scanBus(); } catch (e) {} if (typeof prev === 'function') return prev.apply(this, arguments); }; })();

/* ------------------------------------------------------------ контракты */
function ensureContracts() {
  const s = seasonState.currentSeason || 1;
  teams.forEach(t => (t.players || []).forEach(p => { if (!Number.isFinite(+p.contractUntil) || !p.contractUntil) p.contractUntil = s + 2 + (h32('c' + p.nick) % 3); })); // v33: стартовые контракты на 2–4 сезона
  // v33: один раз для старых сохранений — короткие стартовые контракты продлеваются минимум на 2 сезона вперёд,
  // чтобы исходные составы не распадались в первом же межсезонье
  if (!seasonState.v33LongContracts) { seasonState.v33LongContracts = 1; teams.forEach(t => (t.players || []).forEach(p => { if ((+p.contractUntil || 0) < s + 2) p.contractUntil = s + 2 + (h32('x' + p.nick) % 2); })); }
}
// v33: контракты в основном на 2–3 сезона (звёзды — 3), однолетние — редкость (ветераны, временные замены)
function newContract(p, years) {
  const star = typeof isStarPlayer === 'function' && isStarPlayer(p), old = (+p.age || 25) >= 31;
  p.contractUntil = (seasonState.currentSeason || 1) + (years || (star ? 3 : old ? 1 + Math.floor(rnd() * 2) : (rnd() < 0.1 ? 1 : 2 + Math.floor(rnd() * 2))));
}
/* ---- v33: реалистичные правила рынка ----
   • окна: межсезонье (январь), летний перерыв (июнь–июль) и неделя после Major; вне окон — только экстренные замены;
   • у команды не больше 2 добровольных изменений состава за сезон и пауза 90 игровых дней после каждого;
   • выкуп игрока с действующим контрактом — только при заметном усилении (иначе ждут окончания контракта). */
function windowOpen() { const m = new Date(calNow()).getMonth(); return m === 0 || m === 5 || m === 6 || calNow() <= (+transferState.v33WindowUntil || 0); }
function changes() { const s = seasonState.currentSeason || 1, o = transferState.v33Changes || (transferState.v33Changes = {}); if (o.s !== s) { o.s = s; o.t = {}; } return o.t; }
function canChange(t) { const c = changes()[t.name]; return !c || (c.n < 2 && calNow() - c.ts >= 90 * DAY); }
function noteChange(t) { const o = changes(), c = o[t.name] || (o[t.name] = { n: 0, ts: 0 }); c.n++; c.ts = calNow(); }

/* ------------------------------------------------------------ состояние команд */
function busyTeams() { // участники идущих турниров не меняют состав
  const set = new Set(), ct = typeof currentTournament !== 'undefined' ? currentTournament : null;
  if (ct && !ct.completed) (ct.participants || []).forEach(n => set.add(n));
  (seasonState.parallelSchedule || []).forEach(ev => { if (ev.status === 'live') (ev.participants || []).forEach(x => set.add(typeof x === 'string' ? x : x.name)); });
  return set;
}
function locked() { // ростер-лок перед Major: за 12 игровых дней до старта и до конца
  const st = seasonState, nx = (st.seasonSchedule || [])[st.tournamentIndex], ct = typeof currentTournament !== 'undefined' ? currentTournament : null;
  if (ct && !ct.completed && ct.isMajor) return true;
  if (nx?.type === 'major' && nx.calendar?.startMs && calNow() >= nx.calendar.startMs - 12 * DAY) return true;
  return false;
}
function recent(t, n) { return (t.history || []).filter(h => h && !h.isBootcamp && !h.isSeasonAward && h.place > 0).slice(0, n || 4); }
function pressure(t) {
  const rank = rankOf(t), rec = recent(t, 4);
  const expected = clamp(rank / 2.2, 1.5, 12);
  const avg = rec.length ? rec.reduce((s, h) => s + Math.min(16, h.place), 0) / rec.length : expected;
  const perf = avg / expected;
  const drop = Number(t.seasonStartRank) ? rank - t.seasonStartRank : 0;
  const losses = Math.abs(Math.min(0, Number(t.streak) || 0));
  let p = 0.45 + 0.45 * (perf - 1) + 0.04 * Math.max(0, drop) + (losses >= 3 ? 0.25 : 0) + (rec[0]?.place >= 9 ? 0.15 : 0);
  if (rank <= 5 && perf <= 1.1) p *= 0.3;                                             // сильный состав с результатом — бережём
  if (rec.some(h => h.place === 1) && rank <= 10) p *= 0.5;                           // недавний титул
  if (t.v30LastMoveRun != null && run() - t.v30LastMoveRun < 3) p *= 0.35;            // только что перестраивались
  return clamp(p, 0.05, 2.5);
}
function weakLink(t) {
  const st = (t.players || []).filter(p => !p.status || p.status === 'STARTER');
  if (st.length < 5) return null;
  const avg = st.reduce((s, p) => s + pow(p), 0) / st.length;
  const score = p => pow(p) - avg + ((+p.form || 100) - 100) * 0.15 - Math.max(0, (+p.age || 25) - 30) * 0.8 - (p.onLoan ? 99 : 0);
  const w = st.filter(p => !p.onLoan && !(p.joinedRun != null && run() - p.joinedRun < 3)).sort((a, b) => score(a) - score(b))[0];
  return w ? { p: w, gap: avg - pow(w), avg } : null;
}
const roleOk = (team, out, role) => !UNIQUE.includes(role) || !(team.players || []).some(p => p !== out && p.role === role);
const roleFits = (out, role) => role === out.role || (!UNIQUE.includes(out.role) && !UNIQUE.includes(role));

/* ------------------------------------------------------------ сделки */
function bench(team, out, reason) {
  out.status = 'BENCH'; out.benchFrom = team.name; delete out.reservedFor;
  transferState.freeAgents.push(out);
  M().v30Bench.push({ nick: out.nick, team: team.name, since: run() });
  emit('bench', { player: out.nick, role: out.role, from: team.name, to: 'Скамейка', reason });
}
function signFA(team, out, why) {
  const pool = transferState.freeAgents || [];
  let best = null, bs = 3.5;
  pool.forEach((p, i) => {
    if (!p || p.reservedFor || onRoster(p.nick) || p.onLoan) return;
    const fit = typeof teamIdentityFit === 'function' ? teamIdentityFit(team, p) : 1; if (fit < 0.55) return;
    if (!roleFits(out, p.role) || !roleOk(team, out, p.role)) return;
    if (p.benchFrom === team.name) return;
    const gain = pow(p) - pow(out) + ((+p.form || 100) - (+out.form || 100)) * 0.1 + (fit - 0.7) * 3;
    if (gain > bs) { bs = gain; best = i; }
  });
  if (best == null) return false;
  const fa = pool.splice(best, 1)[0], np = clone(fa), from = fa.benchFrom || lastTeam(fa.nick) || 'Свободный агент';
  Object.assign(np, { status: 'STARTER', joinedRun: run(), morale: clamp((+np.morale || 85) + 5, 40, 100) }); delete np.benchFrom; delete np.reservedFor; newContract(np);
  const idx = team.players.indexOf(out); team.players[idx] = np;
  M().v30Bench = M().v30Bench.filter(b => lc(b.nick) !== lc(np.nick));
  bench(team, out, `место занял ${np.nick}`);
  try { ensurePlayerLayer(team); } catch (e) {}
  team.rosterLastChange = { type: 'IN', player: np.nick, from, reason: why };
  team.v30LastMoveRun = run();
  emit('signing', { player: np.nick, role: np.role, from, to: team.name, out: out.nick, reason: why, gain: Math.round(bs * 10) / 10 });
  return true;
}
function lastTeam(nick) { const m = (M().v30Moves || []).find(x => x.player === nick && x.from && x.type !== 'signing'); return m ? m.from : null; }
function promote(team, why) {
  const ac = academyFor(team); if (!ac) return false;
  const w = weakLink(team); if (!w) return false;
  const cand = (ac.players || []).filter(p => roleFits(w.p, p.role) && roleOk(team, w.p, p.role)).sort((a, b) => pow(b) - pow(a))[0];
  if (!cand || (pow(cand) < pow(w.p) + 0.5 && !((+cand.age || 25) <= 23 && pow(cand) >= pow(w.p) - 1.5))) return false; // молодого и почти равного — повышаем
  let rep = null; try { rep = findCompatibleFreeAgent(ac, cand); } catch (e) {}
  if (!rep) return false;
  const repP = clone(rep.p); transferState.freeAgents.splice(rep.idx, 1); repP.status = 'STARTER'; delete repP.reservedFor; newContract(repP, 1);
  ac.players[ac.players.indexOf(cand)] = repP;
  const np = clone(cand); np.status = 'STARTER'; np.joinedRun = run(); newContract(np, 2 + Math.floor(rnd() * 2));
  team.players[team.players.indexOf(w.p)] = np;
  bench(team, w.p, `место отдано воспитаннику академии ${np.nick}`);
  try { ensurePlayerLayer(team); ensurePlayerLayer(ac); } catch (e) {}
  team.v30LastMoveRun = run();
  emit('promotion', { player: np.nick, role: np.role, from: ac.name, to: team.name, out: w.p.nick, age: np.age, reason: why || 'лучший игрок академии готов к основе' });
  emit('signing', { player: repP.nick, role: repP.role, from: 'Свободный агент', to: ac.name, reason: `замена ушедшему в основу ${np.nick}`, quiet: true });
  return true;
}
function loan(team, why) {
  const w = weakLink(team); if (!w) return false;
  const busy = busyTeams();
  const cands = [];
  teams.filter(a => a.isAcademy && !busy.has(a.name) && (a.academyParent || a.parentTeam || ACAD_PARENT[a.name]) !== team.name).forEach(a => (a.players || []).forEach(p => {
    if (p.onLoan || (+p.age || 25) > 22 || !roleFits(w.p, p.role) || !roleOk(team, w.p, p.role)) return;
    if (pow(p) >= pow(w.p) + 1) cands.push({ a, p });
  }));
  const c = cands.sort((x, y) => pow(y.p) - pow(x.p))[0]; if (!c) return false;
  let rep = null; try { rep = findCompatibleFreeAgent(c.a, c.p); } catch (e) {}
  if (!rep) return false;
  const repP = clone(rep.p); transferState.freeAgents.splice(rep.idx, 1); repP.status = 'STARTER'; delete repP.reservedFor; newContract(repP, 1);
  c.a.players[c.a.players.indexOf(c.p)] = repP;
  const np = clone(c.p); np.status = 'STARTER'; np.onLoan = c.a.name; np.joinedRun = run();
  team.players[team.players.indexOf(w.p)] = np;
  bench(team, w.p, `аренда ${np.nick}`);
  M().v30Loans.push({ nick: np.nick, from: c.a.name, to: team.name, until: run() + 3 + Math.floor(rnd() * 3), repl: repP.nick });
  try { ensurePlayerLayer(team); ensurePlayerLayer(c.a); } catch (e) {}
  team.v30LastMoveRun = run();
  emit('loan', { player: np.nick, role: np.role, from: c.a.name, to: team.name, out: w.p.nick, age: np.age, reason: why || 'нужна свежая кровь в составе' });
  return true;
}
function returnLoans() {
  const s = M(), busy = busyTeams(); let n = 0;
  s.v30Loans = s.v30Loans.filter(l => {
    if (run() < l.until) return true;
    const to = teams.find(t => t.name === l.to), ac = teams.find(t => t.name === l.from);
    if (!to || !ac) return false;
    if (busy.has(to.name) || busy.has(ac.name)) return true;
    const p = (to.players || []).find(x => lc(x.nick) === lc(l.nick)); if (!p) return false;
    // клуб может выкупить арендованного, если он лучше прежнего игрока
    const prevBack = (transferState.freeAgents || []).findIndex(x => x.benchFrom === to.name && !onRoster(x.nick));
    const keep = rnd() < 0.3 && pow(p) >= 80;
    if (keep) { delete p.onLoan; newContract(p, 2); const r = ac.players.find(x => lc(x.nick) === lc(l.repl)); emit('transfer', { player: p.nick, role: p.role, from: ac.name, to: to.name, reason: 'выкуп после удачной аренды', buyout: true, window: 'mid' }); return false; }
    // вернуть: в клуб — прежний игрок со скамейки или свободный агент; в академию — арендованный
    let back = null;
    if (prevBack >= 0) back = transferState.freeAgents.splice(prevBack, 1)[0];
    else { try { const fa = findCompatibleFreeAgent(to, p); if (fa) back = transferState.freeAgents.splice(fa.idx, 1)[0]; } catch (e) {} }
    if (!back) return true;
    back = clone(back); back.status = 'STARTER'; delete back.benchFrom; delete back.reservedFor;
    to.players[to.players.indexOf(p)] = back;
    const r = ac.players.findIndex(x => lc(x.nick) === lc(l.repl));
    const home = clone(p); delete home.onLoan; home.status = 'STARTER';
    if (r >= 0) { const out = ac.players[r]; ac.players[r] = home; out.status = 'FREE AGENT'; transferState.freeAgents.push(out); }
    else { const w = weakLink(ac); if (w) { ac.players[ac.players.indexOf(w.p)] = home; w.p.status = 'FREE AGENT'; transferState.freeAgents.push(w.p); } }
    M().v30Bench = M().v30Bench.filter(b => lc(b.nick) !== lc(back.nick));
    try { ensurePlayerLayer(to); ensurePlayerLayer(ac); } catch (e) {}
    emit('loan-return', { player: home.nick, role: home.role, from: to.name, to: ac.name, back: back.nick, reason: 'аренда завершена' }); n++;
    return false;
  });
  return n;
}
function releaseBench() { // скамейка → свободные агенты через 2 тика
  const s = M(); let n = 0;
  s.v30Bench = s.v30Bench.filter(b => {
    const p = (transferState.freeAgents || []).find(x => lc(x.nick) === lc(b.nick));
    if (!p || onRoster(b.nick)) return false;
    if (run() - b.since < 2) return true;
    p.status = 'FREE AGENT'; delete p.benchFrom; delete p.reservedFor;
    if ((+p.age || 25) >= 33 && rnd() < 0.5) { // ветеран без клуба завершает карьеру
      transferState.freeAgents.splice(transferState.freeAgents.indexOf(p), 1);
      emit('retire', { player: p.nick, team: b.team, age: p.age, role: p.role, rep: null, fa: true });
    } else emit('release', { player: p.nick, role: p.role, from: b.team, to: 'Свободный агент', reason: 'контракт расторгнут после скамейки' });
    n++; return false;
  });
  // пул свободных агентов не разрастается бесконечно
  const fa = transferState.freeAgents || [];
  if (fa.length > 40) { fa.sort((a, b) => pow(b) - pow(a)); fa.length = 40; }
  return n;
}
function buy(team, why, allowNego) {
  const w = weakLink(team); if (!w) return false;
  const rank = rankOf(team), busy = busyTeams();
  let best = null, bs = 4;
  pro().forEach(from => {
    if (from === team || busy.has(from.name)) return;
    const fr = rankOf(from); if (fr < rank - 3) return;                                // у сильных не покупаем
    (from.players || []).forEach(p => {
      if (p.status && p.status !== 'STARTER') return; if (p.onLoan) return;
      if (!roleFits(w.p, p.role) || !roleOk(team, w.p, p.role)) return;
      if (p.joinedRun != null && run() - p.joinedRun < 3) return;
      const fit = typeof teamIdentityFit === 'function' ? teamIdentityFit(team, p) : 1; if (fit < 0.6) return;
      const expiring = (+p.contractUntil || 99) <= (seasonState.currentSeason || 1);
      const gain = pow(p) - pow(w.p) + fit * 2 + (expiring ? 1.5 : 0) - (fr <= 8 ? 1.5 : 0) - (expiring ? 0 : 2.5); // действующий контракт — выкуп дорогой, нужен заметный плюс
      if (window.V33Prestige && V33Prestige.refuses(p, from, team)) return;   // звезда не идёт в куда менее престижный клуб
      if (gain > bs) { bs = gain; best = { from, p, expiring }; }
    });
  });
  if (!best) return false;
  const star = typeof isStarPlayer === 'function' && isStarPlayer(best.p);
  if (allowNego && star && rnd() < 0.7) return startNego(best.p, best.from, team, why);
  const ok = applyPlayerTransfer(best.from, team, best.p, why + (best.expiring ? ' (истекающий контракт)' : ''));
  if (ok) { const np = team.players.find(x => lc(x.nick) === lc(best.p.nick)); if (np) newContract(np, 2 + Math.floor(rnd() * 2)); team.v30LastMoveRun = run(); }
  return ok;
}
/* ---- переговоры и слухи ---- */
function startNego(p, from, to, why) {
  const s = M(); if (s.v30Nego.some(n => n.player === p.nick)) return false;
  const n = { id: 'ng' + run() + (h32(p.nick + to.name) % 1e4).toString(36), player: p.nick, from: from.name, to: to.name, role: p.role, run: run(), why, odds: clamp(0.35 + (rankOf(from) - rankOf(to)) * 0.03 + (window.V33Prestige ? V33Prestige.oddsAdj(from.name, to.name) : 0), 0.15, 0.85) };
  s.v30Nego.push(n);
  emit('negotiation', { ...n, reason: why });
  return true;
}
function progressNego() {
  const s = M(), busy = busyTeams(); let n = 0;
  s.v30Nego = s.v30Nego.filter(x => {
    if (run() - x.run < 1) return true;
    const from = teams.find(t => t.name === x.from), to = teams.find(t => t.name === x.to);
    const p = from?.players.find(q => q.nick === x.player);
    if (!from || !to || !p) { emit('rumor-denied', { ...x, why: 'игрок сменил команду иначе' }); return false; }
    if (busy.has(from.name) || busy.has(to.name)) return true;
    if (rnd() < x.odds) {
      const old = window.playerWillAccept; window.playerWillAccept = () => true;
      let ok = false; try { ok = applyPlayerTransfer(from, to, p, x.why || 'усиление состава'); } finally { window.playerWillAccept = old; }
      if (ok) { const np = to.players.find(q => q.nick === x.player); if (np) newContract(np, 3); to.v30LastMoveRun = run(); n++; return false; }
    }
    if (run() - x.run >= 3 || rnd() < 0.25) { emit('rumor-denied', { ...x, why: pick(['стороны не сошлись в сумме выкупа', 'игрок решил остаться', 'клуб отказался отпускать игрока по ходу сезона', 'переговоры зашли в тупик']) }); return false; }
    return true;
  });
  return n;
}
const pick = a => a[Math.floor(rnd() * a.length)];
/* ---- тренеры ---- */
const CO_A = ['Zon', 'Kel', 'Rav', 'Mor', 'Tav', 'Bri', 'Ste', 'Gul', 'Fen', 'Lio', 'Nad', 'Ork', 'Vas', 'Dem', 'Hel'], CO_B = ['ic', 'ko', 'ex', 'ard', 'iss', 'om', 'ty', 'ven', 'lo', 'ar'];
function coachChange(team, why) {
  const old = team.coach?.name || 'coach';
  if (team.coach?.changedAtSeason === seasonState.currentSeason) return false;
  const used = new Set(teams.map(t => t.coach?.name));
  let nm = null; for (let i = 0; i < 30 && !nm; i++) { const c = CO_A[h32(team.name + i + run()) % CO_A.length] + CO_B[h32(i + team.name) % CO_B.length]; if (!used.has(c)) nm = c; }
  if (!nm) return false;
  team.coach = { name: nm, flag: team.coach?.flag || '', changedAtSeason: seasonState.currentSeason };
  team.rosterLastChange = { type: 'COACH', player: nm, from: old, reason: why };
  team.v30LastMoveRun = run();
  try { transferLog(`🧠 ${team.name} сменили тренера: ${old} → ${nm} (${why}).`, 'coach'); } catch (e) {}
  emit('coach', { team: team.name, from: old, to: nm, reason: why });
  return true;
}
/* ---- амбиции звёзд ---- */
function ambition(limit) {
  let n = 0;
  const all = pro().flatMap(t => (t.players || []).map(p => ({ t, p }))).sort((a, b) => pow(b.p) - pow(a.p)), cut = pow(all[Math.floor(all.length * 0.12)]?.p || {});
  all.filter(x => pow(x.p) >= cut && rankOf(x.t) >= 12 && !x.p.onLoan && !(x.p.joinedRun != null && run() - x.p.joinedRun < 4)).forEach(x => {
    if (n >= limit || rnd() > 0.08) return;
    const buyers = pro().filter(b => rankOf(b) <= 10 && rankOf(b) < rankOf(x.t) - 5).filter(b => { const w = weakLink(b); return w && roleFits(w.p, x.p.role) && roleOk(b, w.p, x.p.role) && pow(x.p) > pow(w.p) + 1; });
    const b = buyers[Math.floor(rnd() * buyers.length)];
    if (b && startNego(x.p, x.t, b, `${x.p.nick} хочет играть за команду из топ-10`)) n++;
  });
  return n;
}
/* ---- межсезонье: контракты ---- */
function contracts() {
  const s = seasonState.currentSeason || 1; let ext = 0, rel = 0;
  pro().forEach(t => (t.players || []).slice().forEach(p => {
    if ((+p.contractUntil || 99) >= s) return;
    const rank = rankOf(t), w = weakLink(t), weakest = w && w.p === p;
    if (!weakest || rank <= 8 || rnd() < 0.6) { newContract(p); if (rank <= 12 && (typeof isStarPlayer === 'function' && isStarPlayer(p))) emit('extension', { player: p.nick, role: p.role, from: t.name, to: t.name, until: p.contractUntil, reason: `новый контракт до сезона ${p.contractUntil}` }); ext++; } // рядовые продления не пишем в журнал — он для заметных событий
    else if (signFA(t, p, `контракт ${p.nick} истёк`)) rel++;
    else newContract(p, 1);
  }));
  return { ext, rel };
}

/* ------------------------------------------------------------ тик рынка */
const INTENSITY = { big: 0.26, mid: 0.045, week: 0.012 };   // v31: рынок спокойнее — сделки только по делу
function tick(kind) {
  if (window.__v30MarketOff) return 0;
  ensureContracts(); M();
  transferState.marketRuns = run() + 1;
  if (locked() && kind !== 'big') { returnLoans(); return 0; }
  if (kind === 'big') transferState.v33WindowUntil = calNow() + 7 * DAY;           // окно после Major
  if (kind !== 'big' && !windowOpen()) { let m = releaseBench() + returnLoans(); scanBus(); save(); return m; } // вне окна сделок нет
  const busy = busyTeams(), base = INTENSITY[kind] || 0.05;
  let moves = 0;
  moves += releaseBench(); moves += returnLoans(); moves += progressNego();
  const cap = kind === 'big' ? 6 : kind === 'mid' ? 2 : 1;
  const list = pro().filter(t => !busy.has(t.name)).map(t => ({ t, pr: pressure(t) })).sort((a, b) => b.pr - a.pr);
  let deals = 0;
  for (const { t, pr } of list) {
    if (deals >= cap) break;
    if (!canChange(t)) continue;                                                       // лимит и пауза после прошлых изменений
    if (window.V34Roster && !window.V34Roster.allowSearch(t)) continue;               // v34: только после подтверждённой потребности (состояние «Поиск игроков»)
    if (kind !== 'big' && pr < 0.95) continue;                                        // по ходу сезона меняются только команды в кризисе
    if (rnd() > base * pr) continue;
    const w = weakLink(t); if (!w) continue;
    if (window.V34Roster && !window.V34Roster.replaceable(t, w.p)) continue;          // v34: меняют того, на кого указывают сигналы
    if (w.gap < 2.5 && (+w.p.age || 25) < 31 && pr < 1.4) continue;                   // нет явного слабого звена — нет повода
    const why = pr > 1.3 ? (recent(t, 1)[0]?.place >= 9 ? `после провала на ${recent(t, 1)[0].tournament}` : 'серия неудачных турниров') : w.gap > 4 ? `${w.p.nick} заметно уступает партнёрам` : (+w.p.age || 25) >= 31 ? `${w.p.nick} (${w.p.age}) теряет форму` : 'усиление состава';
    let ok = false;
    const r = rnd();
    if (academyFor(t) && r < 0.35) ok = promote(t, why);
    if (!ok && pr > 1.15 && rnd() < (kind === 'big' ? 0.4 : 0.3)) ok = coachChange(t, why);
    else if (!ok) {
      ok = r < 0.5 ? signFA(t, w.p, why) || buy(t, why, kind !== 'big') : buy(t, why, kind !== 'big') || signFA(t, w.p, why);
      if (!ok && rankOf(t) >= 15 && rnd() < 0.5) ok = loan(t, why);
    }
    if (ok) { deals++; noteChange(t); }
  }
  // академии тоже живут: подписывают молодых, если кто-то провалился
  teams.filter(a => a.isAcademy && !busy.has(a.name)).forEach(a => { if (deals < cap && rnd() < base * 0.2) { const w = weakLink(a); if (w && signFA(a, w.p, 'ротация в академии')) deals++; } });
  if (kind === 'big') { window.__v34Force = true; try { deals += ambition(2); } finally { window.__v34Force = false; } }   // запрос игрока об уходе — вынужденное событие
  try { if (typeof window.repairRosters === 'function') window.repairRosters(true); } catch (e) {}
  teams.forEach(t => { try { ensurePlayerLayer(t); } catch (e) {} });
  scanBus(); save();
  return moves + deals;
}
window.v30MarketTick = tick;

/* ------------------------------------------------------------ подключение */
const nextStep = () => seasonState.seasonSchedule?.[seasonState.tournamentIndex] || null;
const prevGate = window.processTransferMarket;
if (typeof prevGate === 'function' && !prevGate.__v30) {
  const g = function (reason) {
    if (reason !== 'tournament_end') return prevGate.apply(this, arguments);
    const ct = typeof currentTournament !== 'undefined' ? currentTournament : null;
    if (ct?.isMajor) { const r = prevGate.apply(this, arguments); try { tick('big'); } catch (e) { console.warn('[v30 market]', e); } return r; }
    if (nextStep()?.type === 'major') return prevGate.apply(this, arguments);          // ростер-лок v29 + новость
    try { tick('mid'); } catch (e) { console.warn('[v30 market]', e); }                // вместо «18% случайности»
  };
  g.__v30 = g.__v29 = true; window.processTransferMarket = g; try { processTransferMarket = g; } catch (e) {}
}
// запрет перепродажи игрока в аренде
(() => { const f = window.applyPlayerTransfer; if (typeof f !== 'function' || f.__v30) return;
  const w = function (fromTeam, toTeam, player) { if (player?.onLoan) return false; return f.apply(this, arguments); };
  w.__v30 = true; Object.keys(f).forEach(k => { w[k] = f[k]; }); window.applyPlayerTransfer = w; try { applyPlayerTransfer = w; } catch (e) {} })();
// игровая неделя → тик «week»; новый сезон → контракты
setInterval(() => {
  try {
    const now = calNow(), last = Number(transferState.v30WeekMs) || 0;
    if (!last || now < last) { transferState.v30WeekMs = now; return; }
    if (seasonState.v30ContractSeason !== seasonState.currentSeason) { seasonState.v30ContractSeason = seasonState.currentSeason; if (last) { ensureContracts(); const c = contracts(); scanBus(); if (c.ext + c.rel) save(); } }
    if (now - last >= 7 * DAY) { transferState.v30WeekMs = now; tick('week'); }
  } catch (e) { console.warn('[v30 market week]', e); }
}, 2000);
setTimeout(() => { try { ensureContracts(); M(); if (!seasonState.v30ContractSeason) seasonState.v30ContractSeason = seasonState.currentSeason; } catch (e) {} }, 800);
window.v30MarketDebug = { pressure, weakLink, rankOf, busyTeams, locked, contracts, state: () => M() };
console.info('[v30] трансферный рынок: периодический анализ составов');
})();
