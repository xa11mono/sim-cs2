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
    bots.filter(function(b){ return b.alive && b.team === 'CT'; }).length, bots.filter(function(b){ return b.alive && b.team === 'T'; }).length], b: {}};
  var K = {team: SR.dig(teamIntel[obs], false), agent: (typeof TEAMK !== 'undefined' && TEAMK[obs] && TEAMK[obs].know) ? SR.dig(TEAMK[obs].know, false) : 0, b: {}};
  var D = {b: {}};
  own.forEach(function(b){
    P.b[b.id] = [b.hp, b.alive, (b._visible || []).map(function(e){ return [e.id, e.x, e.y, e.z, e.crouching, e.alive, e.weapon && e.weapon.key]; }),
      b.heardSound ? [b.heardSound.kind, b.heardSound.x, b.heardSound.y, b.heardSound.tick] : null];
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
  // скрытые HP врагов наблюдателя (не меньше 1): у видимых тоже — HP не виден
  hp: `(function(){ var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}'; }); if(!E.length) return null;
    E.forEach(function(o){ o.hp = o.hp > 50 ? 27 : 100; }); return 'HP врагов: ' + E.map(function(o){ return o.id + '=' + o.hp; }).join(' '); })()`,
  // скрытое ослепление врагов, которых никто из наблюдателей сейчас не видит (своё ослепление меняет их же поведение — пара годна до первого законного различия)
  blind: `(function(){ var own = bots.filter(function(o){ return o.alive && o.team === '${OBS}'; });
    var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}' && !own.some(function(m){ return (m._visible || []).indexOf(o) >= 0; }); }); if(!E.length) return null;
    E.forEach(function(o){ o.blindUntil = tick + 2*TICK_HZ; }); return 'ослеплены 2 с: ' + E.map(function(o){ return o.id; }).join(' '); })()`,
  // скрытый основной слот у врага с пистолетом в руках (видимо только оружие в руках)
  slot: `(function(){ var E = bots.filter(function(o){ return o.alive && o.team !== '${OBS}' && o.weapon && o.weapon.key !== o.primary; }); if(!E.length) return null;
    E.forEach(function(o){ o.primary = o.primary === 'AK' || o.primary === 'M4' ? null : (o.team === 'T' ? 'AK' : 'M4'); });
    return 'скрытый основной слот: ' + E.map(function(o){ return o.id + '=' + o.primary; }).join(' '); })()`,
};
if (!FAMILIES[FAM]) { console.error('нет семейства ' + FAM + '; есть: ' + Object.keys(FAMILIES).join(', ')); process.exit(2); }
// точка снимка: тик или «plant» (первый тик после планта в матче, не раньше --after)
EV('freshMatch(' + M + '); 1');
const at = A.at || '3000';
if (at === 'plant') EV(`var __n = 0; while(!(bomb && bomb.state === 'planted' && roundState === 'live') && __n++ < 400000) stepTick(); for(var __k = 0; __k < ${+(A.after || 64)}; __k++) stepTick(); 1`);
else EV('while(tick < ' + (+at) + ') stepTick(); 1');
EV('globalThis.__MK_S = mkSnapshot(); 1'); const t0 = EV('tick');   // снимок — в области игры (объект со ссылками; mkRestore копирует сам)
function run(mutate) {
  EV('mkRestore(__MK_S); 1');
  const desc = mutate ? EV(FAMILIES[FAM]) : 'нет';
  const out = []; for (let i = 0; i < N; i++) { EV('stepTick(); 1'); out.push(JSON.parse(EV('MK_SIG("' + OBS + '")'))); if (EV('roundState') !== 'live') break; }
  return { desc, out };
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
res.verdict = (leakK || leakD) ? 'УТЕЧКА: знание / решение изменились раньше законных входов' : (tp < 0 ? 'нет различий за окно (изменение не дошло до наблюдателя)' : 'чисто: различия только после законного входа');
console.log(JSON.stringify(res, null, 1));
