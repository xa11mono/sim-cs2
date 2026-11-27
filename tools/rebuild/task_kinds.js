// (Р3.2 место, Р-6, 26.11) Таблица видов задач TaskKind: каждый тег задачи, который код ставит литералом (setPost / taskCanSet / stagePost),
// описан в rebuild/task_kinds.json — уровень арбитра (TASK_LEVEL) и свойства (TASK_PROP), вычисленные по тем же регуляркам из
// engine/bot/task.js (игра их и читает; таблица — их развёртка по видам, поведение не меняется). Проверка сборки (gen_maps --check):
//   - тег в коде, которого нет в таблице, — ошибка («неописанная задача»);
//   - уровень / свойства в таблице ≠ вычисленным (правили TASK_LEVEL / TASK_PROP) — ошибка: node tools/rebuild/task_kinds.js --write;
//   - вид в таблице, которого нет в коде, — подсказка.
// Тег с переменной частью ("probe" + n, `route:${…}`) — вид по постоянному началу с «…». Теги из данных (позиции роли, тактики) — не литералы:
// их места перечислены в отчёте (dynamic), уровень у них — по TASK_LEVEL как раньше.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), SRC = require('./game_src.js');
const acorn = require('acorn'), walk = require('acorn-walk');
const OUT = path.join(ROOT, 'rebuild', 'task_kinds.json');
function tables() {   // TASK_PROP, TASK_LEVEL — текст литералов из task.js
  const t = SRC.readGame('task.js'), lit = name => { const i = t.indexOf('var ' + name + ' = '), a = t.indexOf(name === 'TASK_PROP' ? '{' : '[', i);
    let d = 0, j = a; for (; j < t.length; j++) { const c = t[j]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) break; } else if (c === '/' && t[j + 1] === '/') j = t.indexOf('\n', j) - 1; else if (c === '/' && t[j - 1] !== '\\') { j = t.indexOf('/', j + 1); while (t[j - 1] === '\\') j = t.indexOf('/', j + 1); } }
    return Function('return ' + t.slice(a, j + 1))(); };
  return { PROP: lit('TASK_PROP'), LEVEL: lit('TASK_LEVEL') };
}
function sites() {
  const lit = n => n.type === 'Literal' ? String(n.value) : n.type === 'TemplateLiteral' ? n.quasis[0].value.cooked + '…' :
    n.type === 'BinaryExpression' && n.operator === '+' ? (() => { const l = lit(n.left); return l == null ? null : [].concat(l).map(x => x.replace(/…$/, '') + '…'); })() :
    n.type === 'ConditionalExpression' ? (() => { const a = lit(n.consequent), b = lit(n.alternate); return a == null || b == null ? null : [].concat(a, b); })() : null;
  const K = {}, dyn = [];
  for (const f of SRC.gameFiles().filter(f => /\.(js|ts)$/.test(f))) { let ast; const t = SRC.readGame(f).replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' '));
    for (const [a, b] of [['', ''], ['', '\n})();'], ['(function(){\n', ''], ['(function(){\n', '\n})();']]) { try { ast = acorn.parse(a + t + b, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true }); break; } catch (e) {} }
    if (!ast) continue;
    walk.simple(ast, { CallExpression(n) { if (n.callee.type !== 'Identifier' || !/^(setPost|setPostRenew|taskCanSet|stagePost)$/.test(n.callee.name)) return;
      const a = n.arguments[n.callee.name === 'taskCanSet' ? 1 : n.callee.name === 'setPostRenew' ? 5 : 4]; if (!a) return;   // setPostRenew(b, why, pt, look, hold, tag)   // stagePost без тега — свой тег внутри
      const v = lit(a); if (v == null) { dyn.push(f + ':' + n.loc.start.line); return; }
      [].concat(v).forEach(x => { (K[x] = K[x] || new Set()).add(f); }); } }); }
  return { K, dyn };
}
function compute() {
  const { PROP, LEVEL } = tables(), { K, dyn } = sites(), kinds = {};
  for (const k of Object.keys(K).sort()) { const tag = k.replace(/…+$/, ''), row = LEVEL.find(r => r.re.test(tag)) || { lv: 1, kind: '?' };
    kinds[k] = { lv: row.lv, level: row.kind, props: Object.keys(PROP).filter(p => PROP[p].test(tag)), files: [...K[k]].sort() }; }
  return { kinds, dyn };
}
function check() {
  const C = compute(), lines = []; let bad = 0, R;
  try { R = JSON.parse(fs.readFileSync(OUT, 'utf8')).kinds; } catch (e) { return { bad: 1, lines: ['  ✗ нет rebuild/task_kinds.json — node tools/rebuild/task_kinds.js --write'] }; }
  for (const [k, v] of Object.entries(C.kinds)) { const r = R[k];
    if (!r) { bad++; lines.push('  ✗ неописанная задача «' + k + '» (' + v.files.join(', ') + ') — вписать вид в TASK_LEVEL / TASK_PROP по смыслу, затем node tools/rebuild/task_kinds.js --write'); continue; }
    if (r.lv !== v.lv || r.props.join() !== v.props.join()) { bad++; lines.push('  ✗ вид «' + k + '»: в таблице ур. ' + r.lv + ' [' + r.props.join(', ') + '], по коду ур. ' + v.lv + ' [' + v.props.join(', ') + '] — node tools/rebuild/task_kinds.js --write'); } }
  const gone = Object.keys(R).filter(k => !C.kinds[k]); if (gone.length) lines.push('  ушло из кода — убрать из rebuild/task_kinds.json: ' + gone.join(', '));
  lines.unshift('виды задач (TaskKind): ' + Object.keys(C.kinds).length + ' литералом, мест с тегом из данных ' + C.dyn.length + ', расхождений ' + bad);
  return { bad, lines };
}
if (require.main === module) {
  if (process.argv.includes('--write')) { const C = compute();
    fs.writeFileSync(OUT, JSON.stringify({ _: 'Таблица видов задач (TaskKind, Р3.2 место, Р-6): тег → уровень арбитра (TASK_LEVEL), свойства (TASK_PROP), файлы. Пишет node tools/rebuild/task_kinds.js --write; проверяет сборка. «…» — переменная часть тега. dynamic — места, где тег из данных (позиция роли, тактика).', kinds: C.kinds, dynamic: C.dyn }, null, 1) + '\n'); }
  const r = check(); r.lines.forEach(l => console.log(l)); process.exit(r.bad ? 1 : 0);
}
module.exports = { check, compute };
