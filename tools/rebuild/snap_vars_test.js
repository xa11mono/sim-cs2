// (26.11, регрессия: владелец — «тест сборщика на обнаруженную потерю объявлений») Список переменных снимка (src/marks_build.py top_vars —
// по тексту) должен содержать каждую переменную верхнего уровня игры, найденную разбором кода (acorn). Было: «/* … */ var X = 1;» в первой
// строке файла — переменная выпадала из снимка и из сравнения локатора (найдено локатором 26.11: SAVE_TOPN, FLASH_EXIT_MAX «undefined»).
// Проверки: (1) синтетика — комментарий перед var, две var в строке, var в функции (не верхний уровень); (2) весь код игры: AST ⊆ список.
// Запуск: node tools/rebuild/snap_vars_test.js   (код выхода 1 — расхождение; входит в sim.js check)
'use strict';
const path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..'), G = require('./game_src.js'), acorn = require('acorn');
const py = code => JSON.parse(cp.execFileSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-c', 'import sys, json; sys.path.insert(0, "src"); import marks_build, gamesrc\n' + code], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }));
let bad = 0; const fail = m => { bad++; console.error('  ✗ ' + m); };
// (1) синтетика
const syn = py('print(json.dumps(marks_build.top_vars("/* [хозяева: a] */ var ZA = 1;\\nvar ZB = 2; var ZC = 3;\\nfunction f(){\\n  var NO = 1;\\n}\\n/* a */ /* b */ var ZD = [1,\\n 2];\\n")))');
['ZA', 'ZB', 'ZC', 'ZD'].forEach(n => { if (!syn.includes(n)) fail('синтетика: нет ' + n + ' (' + syn.join(',') + ')'); });
if (syn.includes('NO')) fail('синтетика: var внутри функции попал в список');
// (2) код игры: верхний уровень каждого файла (файлы — куски тела главной функции страницы)
// список — как в marks_build.snap_vars: склейка + каналы-модули (rebuild/modules.json; в склейке у них метка MODINIT)
const list = new Set(py('print(json.dumps(marks_build.top_vars(gamesrc.game_source()) + marks_build.top_vars(gamesrc.module_source())))'));
const ast = new Set();
for (const f of G.gameFiles().filter(f => /\.(js|ts)$/.test(f))) { const t = G.readGame(f).replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' '));
  let a = null, opened = false; for (const [x, y] of [['', ''], ['', '\n})();'], ['(function(){\n', ''], ['(function(){\n', '\n})();']]) { try { a = acorn.parse(x + t + y, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); opened = x === '' && y !== ''; break; } catch (e) {} }
  if (!a) { fail('не разобран ' + f); continue; }
  let body = a.body;   // файл-начало обёртки (zones.js: открывает главную функцию, закрывает её tail) — верхний уровень — её тело
  if (opened && body.length && body[body.length - 1].type === 'ExpressionStatement' && /Function/.test((body[body.length - 1].expression.callee || {}).type || '')) body = body[body.length - 1].expression.callee.body.body;
  body.forEach(st => { if (st.type === 'VariableDeclaration') st.declarations.forEach(d => { if (d.id.type === 'Identifier') ast.add(d.id.name + '\t' + f); }); }); }
const miss = [...ast].filter(k => !list.has(k.split('\t')[0]));
if (miss.length) fail('переменные верхнего уровня не в списке снимка: ' + miss.slice(0, 20).map(k => k.replace('\t', ' (') + ')').join(', ') + (miss.length > 20 ? ' … ещё ' + (miss.length - 20) : ''));
console.log('список снимка: ' + list.size + ' имён, по разбору кода ' + ast.size + ', пропущено ' + miss.length + '; синтетика ' + (bad && !miss.length ? 'НЕ прошла' : 'прошла'));
process.exit(bad ? 1 : 0);
