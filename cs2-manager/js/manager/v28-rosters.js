(() => {
'use strict';
/* =====================================================================
   v28 · Целостность составов и трансферы с учётом ролей
   Было:
   1) один ник в двух командах или дважды в одной (torzsi × 2):
      - основной игрок, заменённый на время, уходил на рынок свободных агентов — его мог
        подписать кто угодно (даже своя команда), а потом его ещё и «возвращали»;
      - свободные агенты генерировались из 5 ников на страну — один ник попадал в разные команды;
   2) два AWPer / два IGL: покупка не смотрела на роль, уходил просто самый слабый игрок;
      проданной команде подбирали замену под роль чужого игрока.
   Стало: ник уникален во всей лиге; роль AWPer и IGL — одна на команду; замена — под роль ушедшего;
   временно заменённый игрок не продаётся. Старые сейвы чинятся при загрузке и после каждого рынка.
   Заменяет функции auto_script_1: findCompatibleFreeAgent, applyPlayerTransfer,
   applyTemporaryStandIn, restoreTemporaryStandIn, generateFreeAgent; оборачивает processTransferMarket.
   ===================================================================== */
if (typeof teams === 'undefined' || typeof transferState === 'undefined') return;
const UNIQUE_ROLES = ['AWPer', 'IGL'];
const log = (t, k) => { try { if (typeof transferLog === 'function') transferLog(t, k || 'market'); } catch (e) {} };
const lc = s => String(s || '').toLowerCase();

function onRoster(nick, exceptTeam) { // команда, в составе которой уже есть этот ник
  const n = lc(nick);
  return teams.find(t => t !== exceptTeam && Array.isArray(t.players) && t.players.some(p => lc(p.nick) === n)) || null;
}
const takenAnywhere = nick => !!onRoster(nick) || (transferState.freeAgents || []).some(p => lc(p.nick) === lc(nick));
function rolesWithout(team, outPlayer) { return (team.players || []).filter(p => p !== outPlayer && p.nick !== outPlayer?.nick).map(p => p.role); }
function roleOk(team, outPlayer, role) { // не будет ли второй AWPer / IGL
  if (!UNIQUE_ROLES.includes(role)) return true;
  return !rolesWithout(team, outPlayer).includes(role);
}
function missingRole(team, outPlayer) { // какой обязательной роли не хватит без этого игрока
  const r = rolesWithout(team, outPlayer);
  return UNIQUE_ROLES.find(x => !r.includes(x)) || null;
}

/* ---- свободные агенты: уникальный ник ---- */
// Ники из коротких списков заканчивались, и появлялись «Karma3», «Nilo2». Теперь — новые ники из слогов, как у настоящих игроков
const hash32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const SYL_A = ['zy', 'kr', 'v', 'sh', 'n', 'bl', 'r', 'fl', 'x', 'dr', 'j', 'st', 'k', 'qu', 'm', 'tr', 'h', 'sk', 'l', 'gr'];
const SYL_B = ['a', 'e', 'i', 'o', 'u', 'y', 'ai', 'ex', 'ix', 'on', 'an', 'er'];
const SYL_C = ['n', 'x', 'k', 'z', 'r', 'ss', 'nt', 'kk', 'lo', 'ro', 'ne', 'ze', 'ka', 'ty', 'yx', 'th', '1x', '0n', 'v1', 'ky'];
function freshNick(seed) {
  for (let i = 0; i < 400; i++) {
    const h = hash32(seed + ':' + i), a = SYL_A[h % SYL_A.length], b = SYL_B[(h >>> 5) % SYL_B.length], c = SYL_C[(h >>> 10) % SYL_C.length];
    let n = a + b + c; if ((h >>> 15) % 3 === 0) n = n[0].toUpperCase() + n.slice(1);
    if (n.length >= 3 && !takenAnywhere(n)) return n;
  }
  return 'player' + (seed % 9000 + 1000);
}
const origGen = typeof generateFreeAgent === 'function' ? generateFreeAgent : null;
if (origGen) {
  generateFreeAgent = function (teamHint, roleHint, seedOffset = 0) { // eslint-disable-line no-global-assign
    let p = origGen(teamHint, roleHint, seedOffset);
    for (let i = 1; i < 40 && takenAnywhere(p.nick); i++) p = origGen(teamHint, roleHint, seedOffset + i * 7);
    if (takenAnywhere(p.nick)) p.nick = freshNick(hash32((teamHint?.name || '') + '|' + seedOffset + '|' + (transferState.marketRuns || 0)));
    return p;
  };
}

/* ---- подбор свободного агента: роль, уникальность, не трогать «зарезервированных» ---- */
findCompatibleFreeAgent = function (team, outPlayer) { // eslint-disable-line no-global-assign
  ensureFreeAgentPool();
  const need = missingRole(team, outPlayer);
  let best = null, bestScore = -999;
  transferState.freeAgents.forEach((p, idx) => {
    if (!p || p.reservedFor) return;                          // временно заменённый — ждёт возвращения
    if (onRoster(p.nick)) return;                              // уже где-то играет
    const fit = teamIdentityFit(team, p);
    if (fit < 0.55) return;
    if (!roleOk(team, outPlayer, p.role)) return;              // второй AWPer / IGL — нет
    const roleFit = p.role === outPlayer?.role ? 25 : (need && p.role === need ? 30 : 0);
    const skill = Math.max(0, playerPower(p) - playerPower(outPlayer || p));
    const score = fit * 100 + roleFit + skill - idx * 0.1;
    if (score > bestScore) { best = { p, idx }; bestScore = score; }
  });
  if (!best) { // никто не подошёл — новый свободный агент нужной роли
    const role = (outPlayer && roleOk(team, outPlayer, outPlayer.role)) ? outPlayer.role : (need || 'Rifler');
    const p = generateFreeAgent(team, role, (transferState.marketRuns || 0) * 13 + transferState.freeAgents.length + 31);
    transferState.freeAgents.push(p);
    best = { p, idx: transferState.freeAgents.length - 1 };
  }
  return best;
};

/* ---- переход игрока: кто уходит из покупающей команды — по роли ---- */
function outFor(toTeam, incoming) {
  const st = [...toTeam.players].filter(p => p.status === 'STARTER' || !p.status);
  if (UNIQUE_ROLES.includes(incoming.role)) { const same = st.find(p => p.role === incoming.role); if (same) return same; }
  const same = st.filter(p => p.role === incoming.role).sort((a, b) => playerPower(a) - playerPower(b))[0];
  if (same) return same;
  // не отдаём единственных AWPer / IGL ради игрока другой роли
  return st.filter(p => !UNIQUE_ROLES.includes(p.role)).sort((a, b) => playerPower(a) - playerPower(b))[0] || null;
}
applyPlayerTransfer = function (fromTeam, toTeam, player, reason) { // eslint-disable-line no-global-assign
  if (!fromTeam || !toTeam || !player || fromTeam === toTeam) return false;
  ensurePlayerLayer(fromTeam); ensurePlayerLayer(toTeam);
  const outIdx = fromTeam.players.findIndex(p => p.nick === player.nick);
  if (outIdx < 0) return false;
  if (toTeam.players.some(p => lc(p.nick) === lc(player.nick))) return false;   // уже в составе
  const run = Number(transferState.marketRuns) || 0;
  if (toTeam.lastBuyRun != null && run - toTeam.lastBuyRun < 2) return false;     // покупает не чаще раза в два окна
  if (player.joinedRun != null && run - player.joinedRun < 3) return false;       // только что купленного не перепродают
  const targetOut = outFor(toTeam, player);
  if (!targetOut) return false;
  if (!roleOk(toTeam, targetOut, player.role)) return false;
  if (!playerWillAccept(player, fromTeam, toTeam)) return false;
  const fa = findCompatibleFreeAgent(fromTeam, player);                         // замена — под роль ушедшего
  if (!fa) return false;
  const replacement = JSON.parse(JSON.stringify(fa.p));
  Object.assign(replacement, { status: 'STARTER', language: replacement.language || 'English', morale: clampNumber(replacement.morale + 4, 40, 100), fatigue: clampNumber(replacement.fatigue, 0, 25) });
  delete replacement.reservedFor;
  const transferred = JSON.parse(JSON.stringify(player)); transferred.status = 'STARTER'; transferred.joinedRun = run;
  toTeam.lastBuyRun = run;
  toTeam.players[toTeam.players.findIndex(p => p.nick === targetOut.nick)] = transferred;
  fromTeam.players[outIdx] = replacement;
  transferState.freeAgents.splice(fa.idx, 1);
  targetOut.status = 'FREE AGENT'; delete targetOut.reservedFor;
  transferState.freeAgents.push(targetOut);
  ensurePlayerLayer(fromTeam); ensurePlayerLayer(toTeam);
  fromTeam.rosterLastChange = { type: 'IN', player: replacement.nick, from: 'Free Agent', reason };
  toTeam.rosterLastChange = { type: 'IN', player: transferred.nick, from: fromTeam.name, reason };
  log(`🔁 ${transferred.nick} (${transferred.role}) перешёл из ${fromTeam.name} в ${toTeam.name}; ${targetOut.nick} (${targetOut.role}) ушёл на рынок. ${fromTeam.name} подписали ${replacement.nick} (${replacement.role}). Причина: ${reason}.`, 'transfer');
  return true;
};

/* ---- временная замена: основной игрок зарезервирован за своей командой ---- */
applyTemporaryStandIn = function (t, reason) { // eslint-disable-line no-global-assign
  if (!t || t.tempStandIn) return false;
  ensurePlayerLayer(t);
  const candidate = [...t.players].sort((a, b) => Number(b.fatigue || 0) - Number(a.fatigue || 0))[0];
  if (!candidate) return false;
  const free = findCompatibleFreeAgent(t, candidate);
  if (!free) return false;
  const replacement = JSON.parse(JSON.stringify(free.p));
  Object.assign(replacement, { status: 'STAND-IN', isStandIn: true, standInReason: reason }); delete replacement.reservedFor;
  t.tempStandIn = { original: JSON.parse(JSON.stringify(candidate)), reason, returnAfterTournament: true };
  t.players[t.players.findIndex(p => p.nick === candidate.nick)] = replacement;
  transferState.freeAgents.splice(free.idx, 1);
  const benched = JSON.parse(JSON.stringify(candidate)); benched.status = 'BENCH'; benched.reservedFor = t.name;
  transferState.freeAgents.push(benched);
  ensurePlayerLayer(t);
  t.rosterLastChange = { type: 'STAND-IN', player: replacement.nick, from: candidate.nick, reason };
  log(`🛡️ ${t.name}: ${candidate.nick} временно заменён на ${replacement.nick} (${reason}).`, 'standin');
  return true;
};
restoreTemporaryStandIn = function (t) { // eslint-disable-line no-global-assign
  if (!t?.tempStandIn?.original) return;
  const original = JSON.parse(JSON.stringify(t.tempStandIn.original));
  const stand = t.players.find(p => p.isStandIn);
  const faIdx = transferState.freeAgents.findIndex(p => lc(p.nick) === lc(original.nick));
  const elsewhere = onRoster(original.nick, t);
  if (stand && !elsewhere && !t.players.some(p => p !== stand && lc(p.nick) === lc(original.nick))) {
    const idx = t.players.findIndex(p => p === stand);
    t.players[idx] = original; t.players[idx].status = 'STARTER'; delete t.players[idx].reservedFor;
    if (faIdx >= 0) transferState.freeAgents.splice(faIdx, 1);
    stand.status = 'FREE AGENT'; delete stand.isStandIn; delete stand.standInReason;
    if (!onRoster(stand.nick)) transferState.freeAgents.push(stand);
  } else if (stand) { // основной уже играет за другую команду — замена остаётся в составе
    stand.status = 'STARTER'; delete stand.isStandIn; delete stand.standInReason;
    if (faIdx >= 0) transferState.freeAgents.splice(faIdx, 1);
    log(`📋 ${t.name}: ${original.nick} не вернулся — ${stand.nick} остаётся в составе.`, 'market');
  }
  t.tempStandIn = null;
  ensurePlayerLayer(t);
};

/* ---- починка составов: дубли ников, лишние AWPer / IGL, рынок ---- */
function repairRosters(silent) {
  let fixed = 0;
  // заглушки «Player1…Player5» у команд без реального состава — настоящие ники (характеристики те же)
  teams.forEach(t => (t.players || []).forEach((p, i) => {
    if (/^Player\d+$/i.test(p.nick || '')) { const old = p.nick; p.nick = freshNick(hash32(t.name + '|' + i)); fixed++; if (!silent) log(`✏️ ${t.name}: ${old} → ${p.nick}.`, 'market'); }
  }));
  const seen = new Map(); // ник → команда
  // порядок: сильные команды первыми — дубль убираем из более слабой
  [...teams].sort((a, b) => (b.pts || 0) - (a.pts || 0)).forEach(t => {
    if (!Array.isArray(t.players)) return;
    t.players.forEach((p, i) => {
      const n = lc(p.nick);
      if (!seen.has(n)) { seen.set(n, t); return; }
      // дубль: этот игрок уже есть (в этой же или другой команде) — ставим свободного агента его роли
      const role = roleOk(t, p, p.role) ? p.role : (missingRole(t, p) || 'Rifler');
      const fa = findCompatibleFreeAgent(t, Object.assign({}, p, { role }));
      const rep = JSON.parse(JSON.stringify(fa.p)); rep.status = 'STARTER'; delete rep.reservedFor;
      transferState.freeAgents.splice(fa.idx, 1);
      t.players[i] = rep; seen.set(lc(rep.nick), t); fixed++;
      if (!silent) log(`🧹 ${t.name}: ${p.nick} числился сразу в двух местах — в состав вошёл ${rep.nick} (${rep.role}).`, 'market');
    });
  });
  teams.forEach(t => { // одна роль AWPer / IGL на команду
    UNIQUE_ROLES.forEach(role => {
      const list = (t.players || []).filter(p => p.role === role).sort((a, b) => (+b.firepower || 0) - (+a.firepower || 0));
      list.slice(1).forEach(p => {
        const need = missingRole(t, p);
        p.role = need && need !== role ? need : (role === 'AWPer' ? 'Rifler' : 'Support'); fixed++;
        if (!silent) log(`🔧 ${t.name}: второй ${role} — ${p.nick} теперь ${p.role}.`, 'market');
      });
    });
  });
  // рынок: без игроков, которые уже в составах, и без дублей
  const fs = new Set();
  transferState.freeAgents = (transferState.freeAgents || []).filter(p => {
    const n = lc(p?.nick); if (!n || fs.has(n) || onRoster(p.nick)) { fixed++; return false; }
    if (p.reservedFor && !teams.some(t => t.name === p.reservedFor && t.tempStandIn)) delete p.reservedFor;
    fs.add(n); return true;
  });
  if (fixed) { try { saveTeams(); saveTransferState(); } catch (e) {} }
  return fixed;
}
window.repairRosters = repairRosters;
if (typeof processTransferMarket === 'function') {
  const origMarket = processTransferMarket;
  processTransferMarket = function () { // eslint-disable-line no-global-assign
    const r = origMarket.apply(this, arguments);
    try { if (repairRosters(false) && typeof renderRating === 'function') renderRating(); } catch (e) { console.warn('[rosters]', e); }
    return r;
  };
}
try {
  const n = repairRosters(true);
  if (n) { console.info('[rosters] исправлено при загрузке:', n); if (typeof renderRating === 'function') setTimeout(() => { try { renderRating(); } catch (e) {} }, 0); }
} catch (e) { console.warn('[rosters] repair', e); }
})();
