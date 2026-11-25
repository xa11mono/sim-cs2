// (Р2.3, 25.11) Замена вызовов одной функции в коде расчёта: Math.<f>(…) → DM.<f>(…) — меняется только имя объекта (та же функция, другая
// реализация); аргументы и формулы вокруг — байт в байт. Код расчёта — src/game/0xx…545 (.js, .ts; показ — 550 и выше — не трогается).
// Разбор — acorn (вызов, а не текст): у hypot с тремя аргументами — DM.hypot3; другое число аргументов, Math.<f> не как вызов — ошибка.
//   node tools/dmath/replace.js <f> [--check]   — --check: только посчитать, ничего не писать
'use strict';
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', 'rebuild', 'node_modules');
const acorn = require(path.join(NM, 'acorn')), walk = require(path.join(NM, 'acorn-walk'));
const { GAME, gameFiles, readGame } = require(path.join(__dirname, '..', 'rebuild', 'game_src.js'));
const [fn] = process.argv.slice(2), CHECK = process.argv.includes('--check');
const FNS = ['hypot', 'atan2', 'sin', 'cos', 'exp', 'log', 'pow', 'atan', 'acos'];
if (!FNS.includes(fn)) { console.error('node tools/dmath/replace.js <' + FNS.join('|') + '> [--check]'); process.exit(2); }
const isCalc = f => /\.(js|ts)$/.test(f) && +f.slice(0, 3) < 550 && f !== '005_dmath.ts';
let total = 0; const per = {}, errs = [], outs = {};
for (const f of gameFiles().filter(isCalc)) {
  const raw = fs.readFileSync(path.join(GAME, f), 'utf8'), src = readGame(f).replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' '));
  // кусок склейки: 010 открывает обёртку игры, 680 закрывает — дописать / снять для разбора (позиции те же)
  let ast; const opts = { ecmaVersion: 'latest', allowReturnOutsideFunction: true, sourceType: 'script' };
  try { ast = acorn.parse(src, opts); } catch (e) { ast = acorn.parse(src + '\n})();', opts); }
  const edits = [];
  walk.full(ast, n => {
    if (n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && n.object.name === 'Math' && n.property.name === fn) n._seen = true;
  });
  const calls = new Set();
  walk.simple(ast, { CallExpression(n) { const c = n.callee;
    if (c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && c.object.name === 'Math' && c.property.name === fn) {
      calls.add(c); const k = n.arguments.length;
      if (n.arguments.some(a => a.type === 'SpreadElement')) { errs.push(f + ': вызов с ... — число аргументов неизвестно'); return; }
      const name = fn === 'hypot' ? (k === 2 ? 'hypot' : k === 3 ? 'hypot3' : null) : ((fn === 'atan2' || fn === 'pow') ? (k === 2 ? fn : null) : (k === 1 ? fn : null));
      if (!name) { errs.push(f + ':' + src.slice(0, n.start).split('\n').length + ' Math.' + fn + ' с ' + k + ' арг.'); return; }
      edits.push([c.start, c.end, 'DM.' + name]); } } });
  walk.full(ast, n => { if (n._seen && !calls.has(n)) errs.push(f + ':' + src.slice(0, n.start).split('\n').length + ' Math.' + fn + ' не как вызов'); });
  if (!edits.length) continue;
  // позиции разбора = позиции файла (.ts без типов — те же позиции, game_src.js); проверка: на месте правки в исходнике — тот же текст
  let out = raw; edits.sort((a, b) => b[0] - a[0]).forEach(([s, e, t]) => { if (raw.slice(s, e) !== 'Math.' + fn) errs.push(f + ': позиция ' + s + ' не Math.' + fn); out = out.slice(0, s) + t + out.slice(e); });
  per[f] = edits.length; total += edits.length;
  outs[f] = out;
}
if (errs.length) { console.error('ОШИБКА (ничего не записано):\n  ' + errs.join('\n  ')); process.exit(1); }
if (!CHECK) for (const [f, out] of Object.entries(outs)) fs.writeFileSync(path.join(GAME, f), out);   // все файлы — только если ошибок нет нигде
console.log((CHECK ? 'найдено' : 'заменено') + ' Math.' + fn + ' → DM.' + fn + ': ' + total + ' вызовов в ' + Object.keys(per).length + ' файлах — ' + Object.entries(per).map(([f, n]) => f.slice(0, 3) + ':' + n).join(' '));
