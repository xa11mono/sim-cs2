// (Р5.1, 26.11) контракт Frame — что показ читает у симуляции, и команды — что показ вызывает / пишет в симуляции. Выводится из кода:
// показ — файлы part show / page (rebuild/files.json), симуляция — остальные. Общие переменные: имена верхнего уровня симуляции, на которые
// ссылается показ (чтение — в Frame; запись / вызов функции — команда). Поля бота: свойства, которые показ читает у объектов, где имя
// свойства — поле бота из реестра (rebuild/gen/state.json bot) — с запасом (то же имя у другого объекта тоже попадёт).
// Выход: rebuild/gen/frame.json (+ сводка в консоль). Игру не меняет. Запуск: node tools/rebuild/frame_contract.js
'use strict';
const fs = require('fs'), path = require('path'), acorn = require('acorn'), walk = require('acorn-walk');
const G = require('./game_src.js'), ROOT = G.ROOT;
const code = G.gameFiles().filter(f => /\.(js|ts)$/.test(f));
const sim = code.filter(f => !G.isShow(f)), show = code.filter(f => G.isShow(f));
// файл — кусок одной обёртки игры: первый её открывает, последний закрывает — при разборе обёртка достраивается
const parse = f => { const t = G.readGame(f).replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' ')), o = { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true, ranges: true };
  for (const [a, b] of [['', ''], ['', '\n})();'], ['(function(){\n', ''], ['(function(){\n', '\n})();']]) { try { const ast = acorn.parse(a + t + b, o);
    // тело обёртки (function(){ … })() — на верхний уровень: объявления в нём — верхний уровень игры
    const flat = []; ast.body.forEach(st => { const c = st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && /Function/.test(st.expression.callee.type) ? st.expression.callee : null;
      if (c) flat.push(...c.body.body); else flat.push(st); });
    return { type: 'Program', body: flat }; } catch (e) {} }
  throw new Error('не разобран ' + f); };
// верхний уровень симуляции: функции и var
const SIMV = {}, SIMF = {};
for (const f of sim) { for (const s of parse(f).body) {
  if (s.type === 'FunctionDeclaration') SIMF[s.id.name] = f;
  if (s.type === 'VariableDeclaration') s.declarations.forEach(d => { if (d.id.type === 'Identifier') SIMV[d.id.name] = f; }); } }
const BOT = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'gen', 'state.json'), 'utf8')).bot || {}));
const reads = {}, writes = {}, calls = {}, botf = {};
const add = (M, k, f) => { (M[k] = M[k] || new Set()).add(G.fileId(f)); };
for (const f of show) {
  const ast = parse(f), local = new Set();
  walk.full(ast, n => { if (n.type === 'FunctionDeclaration' && n.id) local.add(n.id.name); if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') local.add(n.id.name);
    if (/Function/.test(n.type)) n.params.forEach(p => { if (p.type === 'Identifier') local.add(p.name); }); });
  walk.ancestor(ast, {
    Identifier(n, anc) { const nm = n.name, p = anc[anc.length - 2]; if (local.has(nm) && !SIMV[nm] && !SIMF[nm]) return;
      if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return;
      if (p && (p.type === 'Property' && p.key === n && !p.computed)) return;
      if (SIMF[nm]) { if (p && p.type === 'CallExpression' && p.callee === n) add(calls, nm, f); else add(reads, nm, f); return; }
      if (!SIMV[nm]) return;
      let w = false; for (let i = anc.length - 2; i >= 0; i--) { const a = anc[i], c = anc[i + 1];
        if (a.type === 'AssignmentExpression' && a.left === c || a.type === 'UpdateExpression') { w = true; break; }
        if (a.type !== 'MemberExpression' || a.object !== c) break; }
      add(w ? writes : reads, nm, f); },
    MemberExpression(m) { if (!m.computed && BOT.has(m.property.name)) add(botf, m.property.name, f); }
  });
}
// обратная сторона (Р5, отделение ядра): что код симуляции берёт у файлов показа — имена верхнего уровня показа, на которые ссылается симуляция
const SHOWV = {}, SHOWF = {};
for (const f of show) { for (const st of parse(f).body) {
  if (st.type === 'FunctionDeclaration') SHOWF[st.id.name] = f;
  if (st.type === 'VariableDeclaration') st.declarations.forEach(d => { if (d.id.type === 'Identifier') SHOWV[d.id.name] = f; }); } }
const need = {}, escope = require('eslint-scope');
for (const f of sim) { const ast = parse(f), sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
  // ссылки, не разрешённые внутри файла (уходят на верхний уровень игры), — на имена показа, которых нет в симуляции
  const glob = sm.globalScope; const refs = glob.through.concat(glob.variables.length ? [] : []);
  for (const r of refs) { const nm = r.identifier.name; if (!(SHOWV[nm] || SHOWF[nm]) || SIMV[nm] || SIMF[nm]) continue;
    // объявлено в этом же файле на верхнем уровне — своё
    if (glob.set && glob.set.has(nm) && glob.set.get(nm).defs.length) continue;
    let typeofG = false; for (let x = r.from; x; x = x.upper) {}
    (need[nm] = need[nm] || { from: SHOWV[nm] || SHOWF[nm], by: new Set(), how: new Set() }).by.add(G.fileId(f)); need[nm].how.add(r.isWrite() ? 'запись' : 'чтение'); } }
const out = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, { from: SIMV[k] || SIMF[k] || null, by: [...o[k]].sort() }]));
const R = { _: 'генерируется tools/rebuild/frame_contract.js (Р5.1): reads — общие переменные симуляции, которые читает показ (состав Frame); bot — поля бота, которые читает показ (с запасом); calls / writes — команды показа к симуляции (вызов функции симуляции / запись её переменной)',
  reads: out(Object.fromEntries(Object.entries(reads).filter(([k]) => SIMV[k]))), fnReads: out(Object.fromEntries(Object.entries(reads).filter(([k]) => SIMF[k]))),
  bot: Object.keys(botf).sort(), calls: out(calls), writes: out(writes),
  simNeedsShow: Object.fromEntries(Object.keys(need).sort().map(k => [k, { from: need[k].from, by: [...need[k].by].sort(), how: [...need[k].how] }])) };
fs.writeFileSync(path.join(ROOT, 'rebuild', 'gen', 'frame.json'), JSON.stringify(R, null, 1) + '\n');
console.log('ядро берёт у показа: ' + Object.keys(need).length + ' (' + Object.keys(need).sort().join(', ') + ')');
console.log('Frame: переменных ' + Object.keys(R.reads).length + ', полей бота ' + R.bot.length + '; команды: вызовов ' + Object.keys(R.calls).length + ', записей ' + Object.keys(R.writes).length + ' (rebuild/gen/frame.json)');
