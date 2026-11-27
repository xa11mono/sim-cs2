// (Р8, 27.11) Скрытые зависимости показ → игра (класс находки ПК 347: проверка навмеша в показе наполняла кэш путей игры PATHQ только на
// странице). Полное состояние страницы и ядра в Node — КАЖДАЯ общая переменная реестра (rebuild/state_classes.json), кроме класса «показ»,
// в том числе кэши с пометкой «cmp: нет», и все поля ботов — в трёх точках: снимок загрузки MK_LOAD (по ключам), сразу после freshMatch(M),
// после T тиков. Хэш значения — tools/rebuild/state_digest.js (тот же обход, что у реестра). Игру не меняет: только читает.
// node rebuild/evidence/R8/e2_state_all.js <sim.html> <core.js> [матч=29] [тиков=3000]   → JSON: различия по точкам
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const [sim, core, M0, T0] = process.argv.slice(2), M = +(M0 || 29), T = +(T0 || 3000);
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'state_classes.json'), 'utf8'));
const names = Object.keys(REG).filter(k => k.startsWith('g:') && REG[k].class !== 'показ' && !/переменная файла показа/.test(REG[k].cmp || '')).map(k => k.slice(2));
const helper = require(path.join(ROOT, 'tools', 'rebuild', 'state_digest.js')).PAGE.replace('window.SR = ', 'globalThis.SR = ');
const code = helper + `;(function(){ var N = ${JSON.stringify(names)}, out = {};
  var L = typeof MK_LOAD !== 'undefined' && MK_LOAD ? MK_LOAD : {}; out.load = {}; Object.keys(L).forEach(function(k){ try{ out.load[k] = SR.dig(L[k], false); }catch(e){ out.load[k] = '!'; } });
  if(L.__ext) Object.keys(L.__ext).forEach(function(k){ try{ out.load['__ext.' + k] = SR.dig(L.__ext[k], false); }catch(e){} });
  if(typeof clockPause === 'function') clockPause(true);
  freshMatch(${M}); out.start = SR.cp(N);
  while(tick < ${T}) stepTick(); out.after = SR.cp(N);
  return JSON.stringify(out); })()`;
const tmp = path.join(require('os').tmpdir(), 'e2all_' + process.pid + '.js'); fs.writeFileSync(tmp, code);
const run = (cmd, args) => { const r = cp.spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); const t = (r.stdout || '').trim().split('\n').pop();
  if (r.status) throw new Error(cmd + ' ' + (r.stderr || '').slice(-400)); const v = JSON.parse(t); return typeof v === 'string' ? JSON.parse(v) : v; };
const P = run('node', [path.join(ROOT, 'src', 'q.js'), path.resolve(sim), '@' + tmp]), N = run('node', [path.join(ROOT, 'tools', 'node', 'core_run.js'), path.resolve(core), '@' + tmp]);
fs.unlinkSync(tmp);
const diff = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter(k => JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])).sort();
const cls = n => (REG['g:' + n] || {}).class || '?';
const res = { match: M, ticks: T, names: names.length,
  load: diff(P.load, N.load),
  start: { g: diff(P.start.g, N.start.g).map(n => n + ' [' + cls(n) + ']'), b: diff(P.start.b, N.start.b) },
  after: { g: diff(P.after.g, N.after.g).map(n => n + ' [' + cls(n) + ']'), b: diff(P.after.b, N.after.b) } };
console.log(JSON.stringify(res, null, 1));
