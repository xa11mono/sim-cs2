/* v34 — микросимуляция раунда в эфире. Раньше движок решал раунд одним броском (Math.random() < prob),
   а «хайлайты» были случайными подписями. Теперь раунд действительно разыгрывается:
   закупка (план закупки движка → оружие), гранаты (влияют на дуэли и время), дуэли игроков с учётом их
   огневой мощи, размены, установка бомбы, ретейк, дефьюз или взрыв, сейвы. Победитель — результат розыгрыша.
   Сила дуэлей калибруется так, что шанс выиграть раунд равен вероятности, которую посчитал движок
   (сила команд, экономика, тайм-ауты, модификатор карьеры) — баланс не меняется.
   Детерминированность: генератор раунда засеян (матч, карта, номер раунда, вероятность) — те же входные
   данные дают тот же раунд. События: id, раунд, время, тип, сторона, игрок, цель, оружие, локация, детали.
   Структура готова для будущего радара (у события есть локация; позиции можно добавить полем pos). */
(function () {
'use strict';
const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const rngOf = seed => { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CALL = {
  Mirage: { A: ['Palace', 'A ramp', 'Tetris'], As: 'A site', Ac: ['Jungle', 'CT', 'Ticket booth'], B: ['B apps', 'Short'], Bs: 'B site', Bc: ['Market', 'Kitchen', 'Van'], mid: ['Mid', 'Window', 'Connector'] },
  Inferno: { A: ['Apartments', 'Second mid', 'Pit'], As: 'A site', Ac: ['Library', 'Arch', 'Graveyard'], B: ['Banana', 'Car'], Bs: 'B site', Bc: ['CT spawn', 'Construction', 'Fountain'], mid: ['Mid', 'Arch side'] },
  Nuke: { A: ['Hut', 'Squeaky', 'Main'], As: 'A site', Ac: ['Heaven', 'Mini', 'Rafters'], B: ['Ramp', 'Secret'], Bs: 'B site', Bc: ['Vents', 'Toxic', 'Back site'], mid: ['Outside', 'Lobby'] },
  'Dust II': { A: ['Long A', 'Short', 'Catwalk'], As: 'A site', Ac: ['CT spawn', 'Goose', 'Car'], B: ['B tunnels', 'Upper tunnels'], Bs: 'B site', Bc: ['B window', 'Back plat', 'Doors'], mid: ['Mid doors', 'Xbox'] },
  Ancient: { A: ['A main', 'Donut'], As: 'A site', Ac: ['Temple', 'Heaven', 'CT'], B: ['B ramp', 'Cave'], Bs: 'B site', Bc: ['Pillar', 'Long'], mid: ['Mid', 'Elbow'] },
  Anubis: { A: ['A main', 'Connector'], As: 'A site', Ac: ['Heaven', 'Walkway'], B: ['B main', 'Canal'], Bs: 'B site', Bc: ['Pillar', 'Palace'], mid: ['Mid', 'Bridge'] },
  Train: { A: ['A main', 'Ivy', 'Popdog'], As: 'A site', Ac: ['Heaven', 'Connector', 'Z'], B: ['B halls', 'Upper B'], Bs: 'B site', Bc: ['Ladder room', 'CT'], mid: ['Popdog', 'Ivy'] }
};
const pick = (r, a) => a[Math.floor(r() * a.length)];
// оружие из плана закупки движка
function weapon(buy, side, role, r) {
  const t = side === 'T';
  if (buy === 'pistol' || buy === 'save') return t ? 'Glock-18' : (r() < .7 ? 'USP-S' : 'P2000');
  if (buy === 'eco') return pick(r, t ? ['Glock-18', 'P250', 'Tec-9'] : ['USP-S', 'P250', 'Five-SeveN']);
  if (buy === 'deagle') return 'Desert Eagle';
  if (buy === 'smg') return t ? pick(r, ['MAC-10', 'UMP-45']) : pick(r, ['MP9', 'UMP-45']);
  if (buy === 'force') return role === 'AWPer' && r() < .5 ? 'SSG 08' : (t ? 'Galil AR' : 'FAMAS');
  if (buy === 'half') return role === 'AWPer' ? 'SSG 08' : (t ? pick(r, ['Galil AR', 'AK-47']) : pick(r, ['FAMAS', 'M4A1-S']));
  if (role === 'AWPer') return 'AWP';
  return t ? 'AK-47' : (r() < .55 ? 'M4A1-S' : 'M4A4');
}
const POWER = { 'AWP': 1.18, 'AK-47': 1.1, 'M4A1-S': 1.04, 'M4A4': 1.03, 'Galil AR': .92, 'FAMAS': .9, 'SSG 08': .95, 'MAC-10': .82, 'MP9': .84, 'UMP-45': .83, 'Desert Eagle': .8, 'P250': .66, 'Tec-9': .68, 'Five-SeveN': .68, 'Glock-18': .58, 'USP-S': .64, 'P2000': .6 };
const UTIL = buy => ['full', 'half', 'hero', 'force'].includes(buy);

// Розыгрыш раунда. q — базовая вероятность дуэли для стороны 1 (калибруется). Возвращает {winner, events, ...}
function simulate(o, q, r) {
  const map = CALL[o.map] || CALL.Mirage, ev = [], add = (t, type, x) => ev.push(Object.assign({ id: o.idp + ev.length, r: o.round, t: Math.max(0, Math.round(t)), type }, x));
  const mk = (list, side, buy) => list.map((p, i) => ({ nick: p.nick, role: p.role, fp: +p.firepower || 75, side, alive: true, k: 0, a: 0, dmg: 0, w: weapon(buy, side, p.role, r), idx: i }));
  const s1T = o.s1side === 'T';
  const A = mk(o.p1, o.s1side, o.buy1), B = mk(o.p2, s1T ? 'CT' : 'T', o.buy2);
  const T = s1T ? A : B, CT = s1T ? B : A, tSide = s1T ? 1 : 2;
  const avg = l => l.reduce((s, x) => s + x.fp, 0) / l.length, a1 = avg(A), a2 = avg(B);
  const alive = l => l.filter(x => x.alive);
  let time = 115, planted = false, site = r() < .5 ? 'A' : 'B', plantAt = 0, bombTime = 40, flashT = 0, mollyDelay = 0, firstKill = null;
  const tBuy = s1T ? o.buy1 : o.buy2, ctBuy = s1T ? o.buy2 : o.buy1;
  // дуэль: x (сторона стороны 1 или 2) против y; q — шанс стороны 1
  const duel = (x, y, loc, bonus1) => {
    const one = x.side === o.s1side ? x : y, two = one === x ? y : x;
    let p = q + (one.fp - a1) * .012 - (two.fp - a2) * .012 + (POWER[one.w] - POWER[two.w]) * .18 + (bonus1 || 0);
    p = clamp(p, .04, .96);
    const win = r() < p ? one : two, lose = win === one ? two : one;
    lose.alive = false; win.k++; win.dmg += 100;
    const hs = r() < clamp(.32 + (win.fp - 75) * .012 + (/AK|Deagle|USP|Desert/.test(win.w) ? .1 : 0) - (win.w === 'AWP' ? .25 : 0), .05, .85);
    const teamOf = win.side === o.s1side ? A : B, helpers = alive(teamOf).filter(z => z !== win);
    let assist = null; if (helpers.length && r() < .3) { assist = pick(r, helpers); assist.a++; assist.dmg += 30 + Math.floor(r() * 50); }
    const isFirst = !firstKill; if (isFirst) firstKill = win;
    add(time, 'kill', { side: win.side === 'T' ? 'T' : 'CT', team: win.side === o.s1side ? 1 : 2, by: win.nick, target: lose.nick, weapon: win.w, hs, loc, assist: assist ? assist.nick : null, entry: isFirst });
    time -= 1 + r() * 4;
    return { win, lose };
  };
  // ранняя фаза: пик на миде/подходе (не каждый раунд)
  add(time, 'start', { buy1: o.buy1, buy2: o.buy2, bank1: o.bank1, bank2: o.bank2 });
  if (r() < .45) { const t = pick(r, alive(T)), c = pick(r, alive(CT)), loc = pick(r, map.mid.concat(map[site])); time -= 12 + r() * 10; const res = duel(t, c, loc); if (r() < .3) { const tr = alive(res.lose.side === 'T' ? T : CT)[0]; if (tr) duel(tr, res.win, loc, (tr.side === o.s1side ? .1 : -.1)); } }
  // гранаты стороны T перед выходом
  time = Math.min(time, 75 + r() * 15);
  if (UTIL(tBuy) && alive(T).length) {
    const sup = alive(T).find(x => x.role === 'Support') || alive(T)[0];
    add(time, 'smoke', { side: 'T', team: tSide, by: sup.nick, loc: pick(r, map[site + 'c']) });
    const fl = alive(T)[Math.floor(r() * alive(T).length)]; add(time - 1, 'flash', { side: 'T', team: tSide, by: fl.nick, loc: map[site + 's'] }); flashT = .06;
    if (r() < .6) add(time - 2, 'molotov', { side: 'T', team: tSide, by: pick(r, alive(T)).nick, loc: map[site + 's'] });
  }
  if (UTIL(ctBuy) && alive(CT).length && r() < .55) { add(time - 3, 'molotov', { side: 'CT', team: 3 - tSide, by: pick(r, alive(CT)).nick, loc: pick(r, map[site]) }); mollyDelay = 6 + r() * 6; }
  time -= 4 + mollyDelay;
  // выход на точку: дуэли до перевеса
  let guard = 0;
  while (alive(T).length && alive(CT).length && !planted && guard++ < 12 && time > 8) {
    const t = alive(T)[0], c = alive(CT)[Math.floor(r() * alive(CT).length)], loc = r() < .6 ? map[site + 's'] : pick(r, map[site]);
    const tb = flashT * (tSide === 1 ? 1 : -1); flashT = 0;
    const res = duel(t, c, loc, tb);
    // размен
    const mates = alive(res.lose.side === 'T' ? T : CT);
    if (mates.length && res.win.alive && r() < .38) { const tr = mates[0]; const b = tr.side === o.s1side ? .12 : -.12; add(time, 'trade-try', { by: tr.nick, target: res.win.nick, loc }); const rr = duel(tr, res.win, loc, b); if (rr.win === tr) ev[ev.length - 1].trade = true; }
    // установка: у T есть люди и их не меньше, чем CT, или CT остался один
    if (alive(T).length && (alive(T).length >= alive(CT).length || alive(CT).length === 1) && r() < .75) {
      const pl = alive(T).find(x => x.role !== 'AWPer') || alive(T)[0]; planted = true; plantAt = time; add(time, 'plant', { side: 'T', team: tSide, by: pl.nick, loc: map[site + 's'] }); time -= 2;
    }
  }
  if (!planted && alive(T).length && alive(CT).length && time > 6) { // поздняя установка
    const pl = alive(T)[0]; planted = true; plantAt = time; add(time, 'plant', { side: 'T', team: tSide, by: pl.nick, loc: map[site + 's'] });
  }
  // ретейк / пост-плант
  let reason = '', winner = 0, defuser = null;
  if (!alive(T).length && !planted) { reason = 'elimination'; winner = 3 - tSide; }
  else if (!alive(CT).length) { reason = planted ? 'bomb' : 'elimination'; winner = tSide; if (planted) add(0, 'explode', { side: 'T', team: tSide, loc: map[site + 's'] }); }
  else if (!planted) { reason = 'time'; winner = 3 - tSide; add(0, 'time', {}); }
  else {
    let left = bombTime; add(plantAt, 'retake', { side: 'CT', team: 3 - tSide, loc: map[site + 's'], n: alive(CT).length + 'v' + alive(T).length });
    // сейв: сильно уступающие в численности CT могут не идти
    if (alive(CT).length === 1 && alive(T).length >= 3 && r() < .5) { add(Math.max(0, plantAt - 10), 'save', { side: 'CT', team: 3 - tSide, by: alive(CT)[0].nick }); add(Math.max(0, plantAt - bombTime), 'explode', { side: 'T', team: tSide, loc: map[site + 's'] }); reason = 'bomb'; winner = tSide; }
    else {
      while (alive(T).length && alive(CT).length && left > 0) {
        const c = alive(CT)[0], t = alive(T)[Math.floor(r() * alive(T).length)], post = tSide === 1 ? .05 : -.05;
        time = plantAt - (bombTime - left); duel(c, t, map[site + 's'], post); left -= 4 + r() * 5;
      }
      const kit = r() < (UTIL(ctBuy) ? .8 : .2), need = kit ? 5 : 10;
      if (!alive(T).length && alive(CT).length && left >= need) { defuser = alive(CT)[0]; reason = 'defuse'; winner = 3 - tSide; add(Math.max(0, plantAt - (bombTime - left) - need), 'defuse', { side: 'CT', team: 3 - tSide, by: defuser.nick, loc: map[site + 's'], kit, left: Math.round(left - need) }); }
      else { reason = 'bomb'; winner = tSide; add(0, 'explode', { side: 'T', team: tSide, loc: map[site + 's'] }); }
    }
  }
  // MVP раунда и хайлайты — из того, что произошло
  const all = A.concat(B), winners = winner === 1 ? A : B;
  const mvp = winners.slice().sort((x, y) => (y.k - x.k) || ((y === defuser) - (x === defuser)) || (y.dmg - x.dmg))[0];
  let hl = null; const top = all.slice().sort((x, y) => y.k - x.k)[0];
  if (top.k >= 5) hl = { icon: '🔥', label: `Эйс ${top.nick}`, team: top.side === o.s1side ? 1 : 2 };
  else if (top.k === 4 && (top.side === o.s1side ? 1 : 2) === winner) hl = { icon: '⚡', label: `4 убийства ${top.nick}`, team: winner };
  // клатч: последний живой победившей стороны в момент, когда против было 2+
  const lastAlive = alive(winners); if (!hl && lastAlive.length === 1) { const kills = ev.filter(e => e.type === 'kill'); let opp = 5, mine = 5, vs = 0; for (const e of kills) { if (e.team === winner) opp--; else mine--; if (mine === 1 && !vs) vs = opp; } if (vs >= 2) hl = { icon: '🎯', label: `Клатч 1v${vs} — ${lastAlive[0].nick}`, team: winner }; }
  if (!hl && reason === 'defuse' && defuser && ev.find(e => e.type === 'defuse')?.left <= 1) hl = { icon: '💣', label: `Дефьюз на последней секунде — ${defuser.nick}`, team: winner };
  const wBuy = winner === 1 ? o.buy1 : o.buy2, lBuy = winner === 1 ? o.buy2 : o.buy1;
  if (!hl && ['eco', 'pistol', 'save', 'deagle'].includes(wBuy) && ['full', 'half', 'hero'].includes(lBuy) && o.round !== 1 && o.round !== 13) hl = { icon: '💰', label: 'Эко-раунд выигран', team: winner };
  add(0, 'end', { winner, reason, mvp: mvp?.nick || null });
  return { winner, reason, events: ev, mvp: mvp?.nick || null, hl, players: all.map(x => ({ nick: x.nick, team: x.side === o.s1side ? 1 : 2, k: x.k, a: x.a, dmg: x.dmg, alive: x.alive })) };
}

// калибровка: g(q) = шанс стороны 1 выиграть раунд при равных составах и закупках; обращаем, чтобы получить q из prob
const CAL = {};
function table(s1side) {
  if (CAL[s1side]) return CAL[s1side];
  const pl = Array.from({ length: 5 }, (_, i) => ({ nick: 'p' + i, role: ['IGL', 'AWPer', 'Rifler', 'Support', 'Lurker'][i], firepower: 80 }));
  const out = [], r = rngOf(h32('cal' + s1side));
  for (let q = .05; q <= .951; q += .025) { let w = 0, n = 600;
    for (let i = 0; i < n; i++) if (simulate({ map: 'Mirage', round: 3, idp: 'c', s1side, p1: pl, p2: pl, buy1: 'full', buy2: 'full' }, q, r).winner === 1) w++;
    out.push([q, w / n]); }
  for (let i = 1; i < out.length; i++) out[i][1] = Math.max(out[i][1], out[i - 1][1]);   // монотонность
  return (CAL[s1side] = out);
}
function qFor(prob, s1side) {
  const t = table(s1side); if (prob <= t[0][1]) return t[0][0]; if (prob >= t[t.length - 1][1]) return t[t.length - 1][0];
  for (let i = 1; i < t.length; i++) if (t[i][1] >= prob) { const [q0, p0] = t[i - 1], [q1, p1] = t[i]; return q0 + (q1 - q0) * ((prob - p0) / Math.max(1e-6, p1 - p0)); }
  return .5;
}
// стороны: первая половина — команда 1 за CT; овертайм — блоки по 3 раунда со сменой сторон
function sideOf(round) { if (round <= 12) return 'CT'; if (round <= 24) return 'T'; const k = Math.floor((round - 25) / 3); return k % 2 ? 'CT' : 'T'; }

const LIVE = new Map(); // item.id → { rounds: [], board: {nick:{k,d,a,dmg,hs,fk,rounds}}, map }
function rosterOf(name) { const t = typeof teams !== 'undefined' ? teams.find(x => x.name === name) : null; const ps = (t?.players || []).slice(0, 5); while (ps.length < 5) ps.push({ nick: `${name} #${ps.length + 1}`, role: 'Rifler', firepower: 75 }); return ps; }
function play(item, prob) {
  const st = item.state, m = item.match, round = st.round, buy = st.roundBuys?.[round] || {};
  const s1side = sideOf(round), map = st.maps?.[st.mapIndex] || 'Mirage';
  const seed = h32([item.id, m.t1, m.t2, st.mapIndex, round, prob.toFixed(4)].join('|'));
  const res = simulate({ map, round, idp: `${item.id}:${st.mapIndex}:${round}:`, s1side, p1: rosterOf(m.t1), p2: rosterOf(m.t2), buy1: buy.t1?.type || (round === 1 || round === 13 ? 'pistol' : 'full'), buy2: buy.t2?.type || (round === 1 || round === 13 ? 'pistol' : 'full'), bank1: buy.t1?.bank, bank2: buy.t2?.bank }, qFor(prob, s1side), rngOf(seed));
  // журнал матча и таблица игроков (по карте)
  let L = LIVE.get(item.id); if (!L) LIVE.set(item.id, L = { maps: {} });
  const M = L.maps[st.mapIndex] || (L.maps[st.mapIndex] = { map, rounds: [], board: {} });
  M.rounds[round - 1] = { r: round, winner: res.winner, reason: res.reason, mvp: res.mvp, side1: s1side, events: res.events, hl: res.hl };
  const kills = res.events.filter(e => e.type === 'kill');
  res.players.forEach(p => { const b = M.board[p.nick] || (M.board[p.nick] = { nick: p.nick, team: p.team, k: 0, d: 0, a: 0, dmg: 0, hs: 0, fk: 0, mvp: 0, rounds: 0 });
    b.k += p.k; b.a += p.a; b.dmg += p.dmg; b.rounds++; if (!p.alive) b.d++; });
  kills.forEach(e => { const b = M.board[e.by]; if (b) { if (e.hs) b.hs++; if (e.entry) b.fk++; } });
  if (res.mvp && M.board[res.mvp]) M.board[res.mvp].mvp++;
  // реальный хайлайт вместо случайного
  st.v34hl = res.hl ? Object.assign({ round }, res.hl, { team: res.hl.team === 1 ? m.t1 : m.t2 }) : null;
  st.v34last = { round, reason: res.reason, mvp: res.mvp };
  // строка ленты эфира — по фактам раунда
  try {
    const name = s => s === 1 ? m.t1 : m.t2, first = kills[0];
    const why = { elimination: 'все соперники выбиты', bomb: 'бомба взорвалась', defuse: 'бомба обезврежена', time: 'время вышло' }[res.reason];
    const plant = res.events.find(e => e.type === 'plant');
    if (typeof addBroadcastEvent === 'function') addBroadcastEvent(st, `🔫 Раунд ${round}: ${first ? `первое убийство — ${first.by} (${first.weapon}) на ${first.loc}` : 'без перестрелок'}${plant ? `; бомба на ${plant.loc}` : ''}; ${name(res.winner)}: ${why}. MVP раунда — ${res.mvp || '—'}.`, 'round-detail');
  } catch (e) {}
  return res.winner;
}
// случайные хайлайты движка заменяем фактическими
(function wrapHL() {
  const f = window.maybeAddBroadcastRoundHighlight; if (typeof f !== 'function' || f.__v34) return;
  const w = function (item) { const st = item?.state; if (!st) return false; const h = st.v34hl; st.v34hl = null; if (!h) return false;
    st.roundHighlights = st.roundHighlights || {}; st.roundHighlights[st.round] = { icon: h.icon, label: h.label, team: h.team, round: st.round };
    try { if (typeof addBroadcastEvent === 'function') addBroadcastEvent(st, `${h.icon} <strong>${h.label}</strong>`, 'highlight'); } catch (e) {}
    return true; };
  w.__v34 = true; window.maybeAddBroadcastRoundHighlight = w; try { maybeAddBroadcastRoundHighlight = w; } catch (e) {}
})();
window.V34Round = { play, simulate, qFor, table, sideOf, LIVE, CALL, live: id => LIVE.get(id) || null };
console.info('[v34] микросимуляция раундов в эфире');
})();
