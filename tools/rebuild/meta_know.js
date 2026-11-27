// (информационная изоляция, 27.11) Метаморфный тест знания (аудит Codex `rebuild/after_r8/INFORMATION_ISOLATION_AUDIT_codex.md` § 2):
// снимок матча → ход A (как есть) и ход B (скрытое изменение мира, которого наблюдающая сторона не видит, не слышит и о котором ей не
// сообщали). По тикам для каждого бота наблюдающей стороны и её командного агента снимаются три подписи:
//   P — законные входы: своё здоровье (урон — законный сигнал), видимые враги (id, место, поза, оружие в руках, жив),
//       услышанный звук, публичное (счёт, раунд, состояние раунда, «бомба заложена», живых по сторонам);
//   K — знание: b.know, b.lastIntel, b.heardSound, teamIntel[сторона], знание командного агента;
//   D — решения и их следствия: своё место, пост (задача, точка), цель пути, взгляд (причина, угол), граната, состояние, держит / присел / идёт, оружие.
// Утечка (отрицательная проверка) — K или D различаются РАНЬШЕ первого различия P: решение изменилось от того, чего сторона знать не могла.
// Положительная проверка (--positive): изменение законное (наблюдение доступно) — P различается, и K / D обязаны отреагировать.
// Запуск (Node, ядро игры tools/node/core_build.py):
//   node tools/rebuild/meta_know.js <core.js> --family=<c4move|hp|blind|slot|...> [--match=3] [--at=<тик|plant>] [--ticks=640] [--observer=CT]
// Семейства — FAMILIES ниже; каждое меняет только скрытое для наблюдателя и согласует связанные представления.
'use strict';
const path = require('path');
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const EV = require(path.join(__dirname, '..', 'node', 'core_run.js')).load(path.resolve(process.argv[2]));
EV(require('./state_digest.js').PAGE.replace('window.SR = ', 'globalThis.SR = '));
const M = +(A.match || 3), N = +(A.ticks || 640), OBS = A.observer || 'CT', FAM = A.family || 'c4move';
// подписи — в области игры
EV(`globalThis.MK_SIG = function(obs){
  var r6 = function(v){ return typeof v === 'number' ? v : v; };
  var pt = function(p){ return p ? (Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y]) : null; };
  var own = bots.filter(function(b){ return b.team === obs; });
  var P = {pub: [tick, roundNum, roundState, JSON.stringify(score), bomb ? (bomb.state === 'planted' ? 'planted' : bomb.state === 'exploded' || bomb.state === 'defused' ? bomb.state : 'not') : null,
    bots.filter(function(b){ return b.alive && b.team === 'CT'; }).length, bots.filter(function(b){ return b.alive && b.team === 'T'; }).length], b: {},
    // оружие на полу на виду у наблюдателей (тот же взгляд, что датчик knowTeamLook: дальность взгляда, конус, линия)
    items: (typeof groundWeapons !== 'undefined' ? groundWeapons : []).filter(function(G){ return own.some(function(m){ return m.alive && DM.hypot(G.x-m.x, G.y-m.y) <= KNOW.lookRange && inFov(m, G.x, G.y) && hasVision(m.x, m.y, G.x, G.y); }); })
      .map(function(G){ return [G.key, G.x, G.y]; })};
  var K = {team: SR.dig(teamIntel[obs], false), agent: (typeof TEAMK !== 'undefined' && TEAMK[obs] && TEAMK[obs].know) ? SR.dig(TEAMK[obs].know, false) : 0, b: {}};
  var D = {b: {}};
  own.forEach(function(b){
    P.b[b.id] = [b.hp, b.alive, (b._visible || []).map(function(e){ return [e.id, e.x, e.y, e.z, e.crouching, e.alive, e.weapon && e.weapon.key,
      typeof seenPrimary === 'function' ? seenPrimary(e) : null, KNOW.seeOnBack !== false && bomb && bomb.carrier === e]; }),
      b.heardSound ? [b.heardSound.kind, b.heardSound.x, b.heardSound.y, b.heardSound.tick] : null,
      // лежащая / заложенная бомба в поле зрения этого бота (то же зрение, что у датчика knowTeamLook)
      bomb && (bomb.state === 'dropped' || bomb.state === 'planted') && b.alive && tick >= (b.blindUntil||0) && DM.hypot(bomb.x-b.x, bomb.y-b.y) <= KNOW.lookRange && inFov(b, bomb.x, bomb.y) && hasVision(b.x, b.y, bomb.x, bomb.y) ? [bomb.x, bomb.y] : null];
    K.b[b.id] = [SR.dig(b.know, true), SR.dig(b.lastIntel, true)];
    var po = b.post, pa = b.path, nt = b.nadeTask;
    D.b[b.id] = [b.x, b.y, b.z, po ? [po.tag, po.x, po.y] : null, pa && pa.length ? pt(pa[pa.length - 1]) : null, b.lookReason, b.facing, nt ? [nt.kind || nt.type, nt.x, nt.y] : null,
      b.state, !!b.holding, !!b.crouching, !!b.walking, b.weapon && b.weapon.key, b._task ? b._task.tag : null];
  });
  return JSON.stringify({P: P, K: K, D: D});
};`);
// семейства скрытых изменений: (eval в области игры) возвращает описание или null (изменение здесь невозможно — пара не годится)
const FAMILIES = {
  // C4 после планта: другая точка планта того же сайта (данные про-плантов карты), не видимая ни одному живому CT
  c4move: `(function(){ if(!bomb || bomb.state !== 'planted') return null;
    var cts = bots.filter(function(o){ return o.alive && o.team === 'CT'; });
    var hidden = function(q){ return cts.every(function(o){ return DM.hypot(o.x-q.x, o.y-q.y) > 700 && !hasVision(o.x, o.y, q.x, q.y); }); };
    if(!hidden(bomb)) return null;
    var C = sitePlantPro(bomb.site).filter(function(q){ return DM.hypot(q.x-bomb.x, q.y-bomb.y) > 120 && hidden(q); });
    if(!C.length) return null; var q = walk(C[0]), a = {x: bomb.x, y: bomb.y};
    bomb.x = q.x; bomb.y = q.y; var ar = navAt(q.x, q.y, bomb.z); if(ar) bomb.z = navFloorZ(ar, q.x, q.y);
    return 'C4 ' + Math.round(a.x) + ',' + Math.round(a.y) + ' → ' + Math.round(q.x) + ',' + Math.round(q.y) + ' (' + bomb.site + ')'; })()`,
  // ПОЛОЖИТЕЛЬНАЯ: C4 переносится в точку планта того же сайта, которую сейчас видит кто-то из CT — знание CT обязано отреагировать
  c4show: `(function(){ if(!bomb || bomb.state !== 'planted') return null;
    var cts = bots.filter(function(o){ return o.alive && o.team === 'CT' && tick >= (o.blindUntil||0); });
    var seen = function(q){ return cts.some(function(o){ return DM.hypot(o.x-q.x, o.y-q.y) <= KNOW.lookRange && inFov(o, q.x, q.y) && hasVision(o.x, o.y, q.x, q.y); }); };
    var C = sitePlantPro(bomb.site).map(function(q){ return walk(q); }).filter(function(q){ return DM.hypot(q.x-bomb.x, q.y-bomb.y) > 120 && seen(q); });
    if(!C.length) return null; var q = C[0], a = {x: bomb.x, y: bomb.y}; bomb.x = q.x; bomb.y = q.y; var ar = navAt(q.x, q.y, bomb.z); if(ar) bomb.z = navFloorZ(ar, q.x, q.y);
    return 'C4 на виду у CT: ' + Math.round(a.x) + ',' + Math.round(a.y) + ' → ' + Math.round(q.x) + ',' + Math.round(q.y); })()`,
  // скрытый дефуз: CT «дефузит» без звука, все T дальше радиуса звука дефуза (DEFUSE_HEAR) и не видят его — знание T не должно измениться
  defsilent: `(function(){ if(!bomb || bomb.state !== 'planted') return null;
    var ts = bots.filter(function(o){ return o.alive && o.team === 'T'; });
    if(ts.some(function(t){ return DM.hypot(t.x-bomb.x, t.y-bomb.y) < DEFUSE_HEAR; })) return null;
    var c = bots.filter(function(o){ return o.alive && o.team === 'CT' && !o.defusing && !ts.some(function(t){ return (t._visible || []).indexOf(o) >= 0; }); })[0]; if(!c) return null;
    c.defusing = true; c.defuseUntil = tick + DEFUSE_TICKS; return 'скрытый дефуз: ' + c.id; })()`,
  // скрытый остаток дефуза: CT дефузит (это слышно в обоих мирах), другое истинное время окончания — знание T не должно зависеть от него
  defrem: `(function(){ var c = bots.filter(function(o){ return o.alive && o.team === 'CT' && o.defusing; })[0]; if(!c || !c.defuseUntil) return null;
    c.defuseUntil += 2*TICK_HZ; return 'остаток дефуза ' + c.id + ' +2 с'; })()`,
  // скрытые HP врагов наблюдателя (не меньше 1): у видимых тоже — HP не виден
  hp: `(function(){ var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}'; }); if(!E.length) return null;
    E.forEach(function(o){ o.hp = o.hp > 50 ? 27 : 100; }); return 'HP врагов: ' + E.map(function(o){ return o.id + '=' + o.hp; }).join(' '); })()`,
  // скрытое ослепление врагов, которых никто из наблюдателей сейчас не видит (своё ослепление меняет их же поведение — пара годна до первого законного различия)
  blind: `(function(){ var own = bots.filter(function(o){ return o.alive && o.team === '${OBS}'; });
    var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}' && !own.some(function(m){ return (m._visible || []).indexOf(o) >= 0; }); }); if(!E.length) return null;
    E.forEach(function(o){ o.blindUntil = tick + 2*TICK_HZ; }); return 'ослеплены 2 с: ' + E.map(function(o){ return o.id; }).join(' '); })()`,
  // скрытый остаток ослепления у врагов, которых наблюдатели видят (видно тело и ствол, не таймер ослепления)
  blindvis: `(function(){ var own = bots.filter(function(o){ return o.alive && o.team === '${OBS}'; });
    var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}' && own.some(function(m){ return (m._visible || []).indexOf(o) >= 0; }); }); if(!E.length) return null;
    E.forEach(function(o){ o.blindUntil = tick + 2*TICK_HZ; }); return 'ослеплены 2 с (видимые): ' + E.map(function(o){ return o.id; }).join(' '); })()`,
  // положительные (законное знание команды; с --probe --positive ответ обязан измениться):
  // команда попала по каждому врагу на 80 (teamIntel.hurt — оценка по своим попаданиям)
  hurtknown: `(function(){ var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}'; }); if(!E.length) return null;
    var HT = teamIntel['${OBS}'].hurt || (teamIntel['${OBS}'].hurt = {}); E.forEach(function(o){ HT[o.id] = {hp: 20, dmg: 80, tick: tick, by: null}; });
    return 'команда попала по ' + E.map(function(o){ return o.id; }).join(' ') + ' на 80'; })()`,
  // своя флешка хлопнула на глазах у команды: враги ослеплены по оценке ещё 2 с (teamIntel.flashed)
  flashknown: `(function(){ var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}'; }); if(!E.length) return null;
    var TF = teamIntel['${OBS}'].flashed || (teamIntel['${OBS}'].flashed = {}); E.forEach(function(o){ TF[o.id] = {until: tick + 2*TICK_HZ, p: 0.7}; });
    return 'видели, как флешка ослепила ' + E.map(function(o){ return o.id; }).join(' '); })()`,
  // в снимке увиденного у бота другой ствол врага перестрелки (видел AWP / AK)
  seenwpn: `(function(){ var r = []; bots.forEach(function(b){ var F = b._fc; if(!b.alive || b.team !== '${OBS}' || !F || !F.e || (b._visible || []).indexOf(F.e) >= 0) return;
    var B = b.know && b.know.enemies[F.e.id]; if(!B || !B.seen) return; B.seen.weapon = B.seen.weapon === 'AWP' ? 'AK' : 'AWP'; r.push(b.id + ' помнит у ' + F.e.id + ' ' + B.seen.weapon); });
    return r.length ? r.join(', ') : null; })()`,
  // скрытые поза и оружие в руках у врагов, которых наблюдатели сейчас не видят (видели раньше — знание прежнее)
  hidattr: `(function(){ var own = bots.filter(function(o){ return o.alive && o.team === '${OBS}'; });
    var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}' && !own.some(function(m){ return (m._visible || []).indexOf(o) >= 0; }); }); if(!E.length) return null;
    E.forEach(function(o){ o.crouching = !o.crouching; o.weapon = WEAPONS[o.weapon && o.weapon.key === 'AWP' ? 'AK' : 'AWP']; });
    return 'поза и ствол (скрыто): ' + E.map(function(o){ return o.id + '=' + o.weapon.key + (o.crouching ? ' присел' : ''); }).join(' '); })()`,
  // АК на полу рядом с CT (≤ 300 ед.), но там, где его никто из CT не видит (не было на виду и не их): польза сейва не должна измениться
  gunhide: `(function(){ var cts = bots.filter(function(o){ return o.alive && o.team === 'CT'; }); if(!cts.length) return null;
    var seen = function(q){ return cts.some(function(o){ return hasVision(o.x, o.y, q.x, q.y) && DM.hypot(o.x-q.x, o.y-q.y) < 1500; }); };
    for(var i = 0; i < cts.length; i++) for(var k = 0; k < 16; k++){ var a = k*Math.PI/8, q = {x: cts[i].x + Math.cos(a)*120, y: cts[i].y + Math.sin(a)*120};
      if(!insideSolidWall(q.x, q.y) && !seen(q)){ groundWeapons.push({key: 'AK', x: q.x, y: q.y, t: tick, from: 'MK'}); return 'АК на полу у ' + cts[i].id + ' (не на виду)'; } }
    return null; })()`,
  // положительная: АК на полу на виду у CT с пистолетом / ПП (≤ 300 ед., видно глазами) — законный вход; подбор обязан стать возможным
  gunseen: `(function(){ var cts = bots.filter(function(o){ return o.alive && o.team === 'CT' && !(o.primary && WEAPONS[o.primary].tier >= 5); }); if(!cts.length) return null;
    for(var i = 0; i < cts.length; i++){ var c = cts[i]; for(var k = -2; k <= 2; k++){ var a = (c.facing || 0) + k*0.2, q = {x: c.x + Math.cos(a)*90, y: c.y + Math.sin(a)*90};
      if(!insideSolidWall(q.x, q.y) && hasVision(c.x, c.y, q.x, q.y) && inFov(c, q.x, q.y)){ groundWeapons.push({key: 'AK', x: q.x, y: q.y, t: tick, from: 'MK'}); return 'АК на виду у ' + c.id; } } }
    return null; })()`,
  // скрытый основной слот у врага с пистолетом в руках (видимо только оружие в руках)
  slot: `(function(){ var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}' && o.weapon && o.weapon.key !== o.primary; }); if(!E.length) return null;
    E.forEach(function(o){ o.primary = o.primary === 'AK' || o.primary === 'M4' ? null : (o.team === 'T' ? 'AK' : 'M4'); });
    return 'скрытый основной слот: ' + E.map(function(o){ return o.id + '=' + o.primary; }).join(' '); })()`,
};
if (!FAMILIES[FAM]) { console.error('нет семейства ' + FAM + '; есть: ' + Object.keys(FAMILIES).join(', ')); process.exit(2); }
// точка снимка: тик или «plant» (первый тик после планта в матче, не раньше --after)
EV('freshMatch(' + M + '); 1');
const at = A.at || '3000';
if (at === 'defuse') EV(`var __n = 0; while(!bots.some(function(o){ return o.alive && o.team === 'CT' && o.defusing && o.defuseUntil > tick + 64; }) && __n++ < 600000) stepTick(); for(var __k = 0; __k < ${+(A.after || 4)}; __k++) stepTick(); 1`);
else if (at === 'plant') EV(`var __n = 0; while(!(bomb && bomb.state === 'planted' && roundState === 'live') && __n++ < 400000) stepTick(); for(var __k = 0; __k < ${+(A.after || 64)}; __k++) stepTick(); 1`);
else EV('while(tick < ' + (+at) + ') stepTick(); 1');
EV('globalThis.__MK_S = mkSnapshot(); 1'); const t0 = EV('tick');   // снимок — в области игры (объект со ссылками; mkRestore копирует сам)
function run(mutate) {
  EV('mkRestore(__MK_S); 1');
  const desc = mutate ? EV(FAMILIES[FAM]) : 'нет';
  const out = []; for (let i = 0; i < N; i++) { EV('stepTick(); 1'); out.push(JSON.parse(EV('MK_SIG("' + OBS + '")'))); if (EV('roundState') !== 'live') break; }
  return { desc, out };
}
// (27.11) проба (--probe): тот же тик, те же законные входы P — ответы функций решения до и после скрытого изменения (без хода игры; как пробы
// аудита Codex в VM). Различие ответа при равных P — утечка в этой функции. Точка — первый тик от --at, где у наблюдателя есть случай
// (--want: nearest — видит врага; fclost — перестрелка, врага сейчас не видит; any). Функции, которых нет в сборке, — по её версии
const PROBE = `(function(obs){ var R = {}; bots.forEach(function(b){ if(!b.alive || b.team !== obs) return; var o = {};
    if(b._nearestEnemyBot) o.duelContext = duelContext(b, [], 0);
    var F = b._fc; if(F && F.e){ o.duelEval = duelEval(b, F, null); var FE = typeof duelFoe === 'function' ? duelFoe(b, F.e) : F.e;
      o.duelOdds = FE ? duelOdds(b, FE, FE.x, FE.y) : null; }
    if(typeof ninjaOk === 'function' && b.team === 'CT') try { o.ninjaOk = ninjaOk(b); } catch(e) { o.ninjaOk = 'ошибка'; }
    R[b.id] = o; }); return JSON.stringify(R); })`;
const WANT = { nearest: `bots.some(function(b){ return b.alive && b.team === '${OBS}' && b._nearestEnemyBot; })`,
  fclost: `bots.some(function(b){ return b.alive && b.team === '${OBS}' && b._fc && b._fc.e && b._fc.e.alive && (b._visible || []).indexOf(b._fc.e) < 0; })`, any: 'true' };
if (A.probe) {
  const w = WANT[A.want || 'nearest']; EV(`var __n = 0; while(!(roundState === 'live' && (${w})) && __n++ < 200000) stepTick(); globalThis.__MK_S = mkSnapshot(); 1`);
  const tP = EV('tick'), sig = () => JSON.parse(EV('MK_SIG("' + OBS + '")')).P, pr = () => JSON.parse(EV(PROBE + '("' + OBS + '")'));
  EV('mkRestore(__MK_S); 1'); const P0 = sig(), R0 = pr(); EV('mkRestore(__MK_S); 1'); const R0b = pr();
  EV('mkRestore(__MK_S); 1'); const desc = EV(FAMILIES[FAM]), P1 = sig(), R1 = pr();
  const res = { family: FAM, match: M, probe: true, want: A.want || 'nearest', at: tP, observer: OBS, change: desc, aa: JSON.stringify(R0) === JSON.stringify(R0b) ? 'A = A' : 'A ≠ A' };
  if (desc === null) res.verdict = 'пара не годится: изменение невозможно в этой точке';
  else if (JSON.stringify(P0) !== JSON.stringify(P1)) res.verdict = 'пара не годится: изменение задело законный вход';
  else { const d = []; for (const id of Object.keys(R0)) for (const f of Object.keys(Object.assign({}, R0[id], R1[id] || {})))
      if (JSON.stringify(R0[id][f]) !== JSON.stringify((R1[id] || {})[f])) d.push({ bot: id, fn: f, A: JSON.stringify(R0[id][f]).slice(0, 200), B: JSON.stringify((R1[id] || {})[f]).slice(0, 200) });
    res.probed = Object.keys(R0).map(id => id + ':' + Object.keys(R0[id]).join('+')).join(' ');
    res.diff = d; res.verdict = A.positive ? (d.length ? 'положительная пройдена: законное знание изменило ответ' : 'ПОЛОЖИТЕЛЬНАЯ не пройдена: законное знание не изменило ответ') :
      d.length ? 'УТЕЧКА: ответ функции решения изменился при тех же законных входах' : (res.probed.indexOf(':d') < 0 && res.probed.indexOf(':n') < 0 ? 'пробовать нечего в этой точке' : 'чисто: ответы те же'); }
  console.log(JSON.stringify(res, null, 1)); process.exit(0);
}
const a = run(false), a2 = run(false), b = run(true);
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const firstDiff = (X, Y, f) => { for (let i = 0; i < Math.min(X.length, Y.length); i++) if (!eq(f(X[i]), f(Y[i]))) return i; return -1; };
const which = (x, y) => { const r = []; for (const k of Object.keys(Object.assign({}, x, y))) if (!eq(x[k], y[k])) r.push(k); return r; };
const res = { family: FAM, match: M, at: t0, observer: OBS, ticks: Math.min(a.out.length, b.out.length), change: b.desc };
res.aa = firstDiff(a.out, a2.out, s => s) < 0 ? 'A = A' : 'A ≠ A — тест недетерминирован';
if (b.desc === null) { res.verdict = 'пара не годится: изменение невозможно в этой точке'; console.log(JSON.stringify(res, null, 1)); process.exit(0); }
const tp = firstDiff(a.out, b.out, s => s.P), tk = firstDiff(a.out, b.out, s => s.K), td = firstDiff(a.out, b.out, s => s.D);
res.first = { P: tp, K: tk, D: td };
const cut = tp < 0 ? Infinity : tp, leakK = tk >= 0 && tk < cut, leakD = td >= 0 && td < cut;
const det = (i, sel) => { const x = sel(a.out[i]), y = sel(b.out[i]); const bs = which(x.b || {}, y.b || {}); const o = { tick: a.out[i].P.pub[0] };
  if (bs.length) o.bots = bs.map(id => ({ id, A: JSON.stringify(x.b[id]).slice(0, 300), B: JSON.stringify(y.b[id]).slice(0, 300) }));
  ['team', 'agent'].forEach(k => { if (x[k] !== undefined && !eq(x[k], y[k])) o[k] = 'различается'; }); return o; };
if (leakK) res.leak_K = det(tk, s => s.K);
if (leakD) res.leak_D = det(td, s => s.D);
if (tp >= 0) res.legal_from = det(tp, s => s.P);
if (A.positive) { res.verdict = tp < 0 ? 'ПОЛОЖИТЕЛЬНАЯ не проверена: законный вход не изменился (изменение не на виду)' : (leakK || leakD) ? 'УТЕЧКА: знание / решение раньше законного входа' :
  (tk >= tp ? 'положительная пройдена: законный вход на тике ' + tp + ' → знание отреагировало на тике ' + tk + (td >= 0 ? ', решение — ' + td : ', решение то же (другой перевес)') : 'ПОЛОЖИТЕЛЬНАЯ НЕ ПРОЙДЕНА: законный вход изменился, знание — нет'); console.log(JSON.stringify(res, null, 1)); process.exit(0); }
res.verdict = (leakK || leakD) ? 'УТЕЧКА: знание / решение изменились раньше законных входов' : (tp < 0 ? 'нет различий за окно (изменение не дошло до наблюдателя)' : 'чисто: различия только после законного входа');
console.log(JSON.stringify(res, null, 1));
