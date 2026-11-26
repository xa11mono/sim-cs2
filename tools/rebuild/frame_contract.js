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
// (Р5.1, 26.11) косвенные чтения: функции симуляции, которые вызывает показ (calls, fnReads), сами читают переменные симуляции — по графу
// вызовов внутри симуляции (транзитивно). Без них кадр неполон: проверка tools/page/frame_apply_check.js (слои отладки — знание, «простреливается»)
const FG = {};   // функция симуляции → {v: переменные, f: вызванные функции}
for (const f of sim) for (const s of parse(f).body) { if (s.type !== 'FunctionDeclaration') continue;
  const loc = new Set(), V = new Set(), F = new Set();
  walk.full(s, n => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') loc.add(n.id.name); if (/Function/.test(n.type)) n.params.forEach(q => { if (q.type === 'Identifier') loc.add(q.name); });
    if (n.type === 'FunctionDeclaration' && n !== s && n.id) loc.add(n.id.name); });
  walk.ancestor(s, { Identifier(n, anc) { const nm = n.name, p = anc[anc.length - 2]; if (loc.has(nm)) return;
    if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return; if (p && p.type === 'Property' && p.key === n && !p.computed) return;
    if (SIMF[nm]) F.add(nm); else if (SIMV[nm]) V.add(nm); } });
  FG[s.id.name] = { v: V, f: F }; }
const via = {};
// корни — функции симуляции, которые вызывает сам рисунок кадра: функции показа, достижимые из draw / d3Frame (команды — паузу, перемотку,
// песочницу — исполняет симуляция, их чтения в кадр не идут)
const SG = {};
for (const f of show) for (const s of parse(f).body) { if (s.type !== 'FunctionDeclaration') continue; const F = new Set();
  walk.full(s, n => { if (n.type === 'CallExpression' && n.callee.type === 'Identifier') F.add(n.callee.name); }); SG[s.id.name] = F; }
const drawRoots = new Set(), seenS = new Set(), stS = ['draw', 'd3Frame'].filter(x => SG[x]);
while (stS.length) { const fn = stS.pop(); if (seenS.has(fn)) continue; seenS.add(fn); SG[fn].forEach(x => { if (SG[x]) stS.push(x); else if (SIMF[x]) drawRoots.add(x); }); }
for (const root of drawRoots) { const seen = new Set(), st = [root];
  while (st.length) { const fn = st.pop(); if (seen.has(fn) || !FG[fn]) continue; seen.add(fn); FG[fn].v.forEach(v => { (via[v] = via[v] || new Set()).add(root); }); FG[fn].f.forEach(x => st.push(x)); } }
const out = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, { from: SIMV[k] || SIMF[k] || null, by: [...o[k]].sort() }]));
const R = { _: 'генерируется tools/rebuild/frame_contract.js (Р5.1): reads — общие переменные симуляции, которые читает показ (состав Frame); bot — поля бота, которые читает показ (с запасом); calls / writes — команды показа к симуляции (вызов функции симуляции / запись её переменной)',
  reads: out(Object.fromEntries(Object.entries(reads).filter(([k]) => SIMV[k]))), fnReads: out(Object.fromEntries(Object.entries(reads).filter(([k]) => SIMF[k]))),
  readsVia: Object.fromEntries(Object.keys(via).filter(k => !reads[k]).sort().map(k => [k, { from: SIMV[k], via: [...via[k]].sort().slice(0, 12) }])),
  bot: Object.keys(botf).sort(), calls: out(calls), writes: out(writes),
  simNeedsShow: Object.fromEntries(Object.keys(need).sort().map(k => [k, { from: need[k].from, by: [...need[k].by].sort(), how: [...need[k].how] }])) };
fs.writeFileSync(path.join(ROOT, 'rebuild', 'gen', 'frame.json'), JSON.stringify(R, null, 1) + '\n');
console.log('ядро берёт у показа: ' + Object.keys(need).length + ' (' + Object.keys(need).sort().join(', ') + ')');
console.log('Frame: переменных ' + Object.keys(R.reads).length + ' (+ косвенно через вызовы ' + Object.keys(R.readsVia).length + '), полей бота ' + R.bot.length + '; команды: вызовов ' + Object.keys(R.calls).length + ', записей ' + Object.keys(R.writes).length + ' (rebuild/gen/frame.json)');

// ---- (Р5.1 / Р5.2 / Р5.4 / Р5.10, владелец 26.11: «интерфейс не должен непосредственно изменять игровое состояние») реестр управления и граница
// показ → ядро. Показ — файлы show / page и интерфейс отметок src/marks.js; ядро — остальные файлы игры и src/snapshot.js. Для каждой функции ядра —
// что она пишет (транзитивно по вызовам): игровое состояние (классы реестра «раунд / матч / режим / серия / постоянная память / асинхронное /
// внутри вызова»), входы и данные карты («вход», «неизменяемое»), кэш / показ / диагностика — не игра. Для каждого обработчика интерфейса
// (addEventListener, on…=, таймеры, кадр requestAnimationFrame, клавиши) — то же через функции показа до ядра. Выход: rebuild/gen/ui.json.
// --check: прямые записи показа в игровое состояние (переменная или поле бота по реестру) сверх rebuild/ui_boundary_known.json — код 1.
{
  const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'state_classes.json'), 'utf8')), cls = k => (REG[k] || {}).class;
  const GAME = new Set(['раунд', 'матч', 'режим', 'серия', 'постоянная память', 'асинхронное', 'внутри вызова', 'случайность', 'не размечено']);
  // переменная ядра без класса в реестре — игра (строго); объявленная в показе без класса — показ; MK* — инструмент отметок / перемотки (как у локатора)
  const kindOfVar = v => { const c = cls('g:' + v); if (!c && TOPV[v] && TOPV[v].side === 'показ') return 'не игра'; if (/^MK/.test(v)) return 'не игра'; return GAME.has(c) || !c ? 'игра' : (c === 'вход' || c === 'неизменяемое') ? 'карта/настройки' : 'не игра'; };
  const kindOfField = f => { const c = cls('b:' + f); return !c || c === 'не поле бота' ? null : GAME.has(c) ? 'игра' : 'не игра'; };
  const src = n => path.join(ROOT, 'src', n), rd = f => fs.readFileSync(f, 'utf8');
  const parseText = t => { const o = { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true, ranges: true };
    return acorn.parse(t.replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' ')), o); };
  const UNITS = [...sim.map(f => ({ f, side: 'ядро', ast: parse(f), text: G.readGame(f) })), ...show.map(f => ({ f, side: 'показ', ast: parse(f), text: G.readGame(f) })),
    { f: 'src/snapshot.js', side: 'ядро', ast: parseText(rd(src('snapshot.js'))), text: rd(src('snapshot.js')) },
    { f: 'src/marks.js', side: 'показ', ast: parseText(rd(src('marks.js'))), text: rd(src('marks.js')) }];
  // функции верхнего уровня обеих сторон: прямые записи (переменные верхнего уровня, поля по имени) и вызовы
  const FN = {}, TOPV = {};
  for (const u of UNITS) for (const s of u.ast.body) { if (s.type === 'VariableDeclaration') s.declarations.forEach(d => { if (d.id.type === 'Identifier') TOPV[d.id.name] = u; }); }
  const effects = (node, own) => {   // прямые действия узла функции: w — переменные верхнего уровня, b — поля (по имени), c — вызовы, ls — localStorage.setItem
    const loc = new Set(), w = new Set(), b = new Set(), c = new Set(); let ls = false;
    walk.full(node, n => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') loc.add(n.id.name); if (/Function/.test(n.type)) n.params.forEach(q => { if (q.type === 'Identifier') loc.add(q.name); });
      if (n.type === 'FunctionDeclaration' && n !== own && n.id) loc.add(n.id.name); });
    walk.full(node, n => {
      if (n.type === 'CallExpression') { if (n.callee.type === 'Identifier') c.add(n.callee.name);
        if (n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property.name === 'setItem' && /localStorage/.test(n.callee.object.type === 'Identifier' ? n.callee.object.name : '')) ls = true; }
      const tgt = n.type === 'AssignmentExpression' ? n.left : n.type === 'UpdateExpression' ? n.argument : null; if (!tgt) return;
      // поле — по имени (с запасом), кроме свойств элементов страницы: x.style.display, x.dataset.k, x.classList…, textContent / innerHTML / value
      const DOMP = /^(style|dataset|classList|textContent|innerHTML|innerText|value|checked|disabled|hidden|title|className|src|width|height|onclick)$/;
      let t = tgt; while (t.type === 'MemberExpression') { if (!t.computed && t === tgt && !(t.object.type === 'MemberExpression' && !t.object.computed && DOMP.test(t.object.property.name)) && !DOMP.test(t.property.name)) b.add(t.property.name); t = t.object; }
      if (t.type === 'Identifier' && !loc.has(t.name) && TOPV[t.name]) w.add(t.name); });
    return { w, b, c, ls }; };
  for (const u of UNITS) for (const s of u.ast.body) if (s.type === 'FunctionDeclaration') FN[s.id.name] = Object.assign({ u, line: s.loc.start.line }, effects(s, s));
  // транзитивно: что меняет вызов функции (игра / карта и настройки), с примером цепочки
  const MEMO = {};
  const reach = (name, seen = new Set()) => { if (MEMO[name]) return MEMO[name]; const r = { game: new Set(), map: new Set(), ls: false, via: {} }; if (seen.has(name) || !FN[name]) return r; seen.add(name);
    const F = FN[name];
    F.w.forEach(v => { const k = kindOfVar(v); if (k === 'игра') r.game.add(v); else if (k === 'карта/настройки') r.map.add(v); });
    F.b.forEach(f => { if (kindOfField(f) === 'игра') r.game.add('.' + f); });
    if (F.ls) r.ls = true;
    F.c.forEach(c => { const x = reach(c, seen); x.game.forEach(v => { r.game.add(v); if (!r.via[v]) r.via[v] = c; }); x.map.forEach(v => r.map.add(v)); if (x.ls) r.ls = true; });
    return (MEMO[name] = r); };
  // обработчики интерфейса
  const H = [];
  const ids = {};   // переменная файла → id элемента (var x = document.getElementById("id"))
  const idOf = (e, u) => { if (!e) return null; if (e.type === 'CallExpression' && e.arguments[0] && e.arguments[0].type === 'Literal' && /getElementById|^mkEl$|^mapEdEl$|^\$$|^el$/.test(e.callee.type === 'Identifier' ? e.callee.name : e.callee.property && e.callee.property.name)) return '#' + e.arguments[0].value;
    if (e.type === 'Identifier') return (ids[u.f] || {})[e.name] || e.name; if (e.type === 'MemberExpression') return u.text.slice(e.start, e.end).slice(0, 40); return u.text.slice(e.start, e.end).slice(0, 40); };
  for (const u of UNITS.filter(x => x.side === 'показ')) {
    ids[u.f] = {}; walk.full(u.ast, n => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) { const i = idOf(n.init, { f: '', text: u.text }); if (i && i[0] === '#') ids[u.f][n.id.name] = i; } });
    walk.full(u.ast, n => {
      let what = null, ev = null, fn = null, el = null;
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property.name === 'addEventListener' && n.arguments.length >= 2) {
        ev = n.arguments[0].type === 'Literal' ? n.arguments[0].value : u.text.slice(n.arguments[0].start, n.arguments[0].end).slice(0, 30); fn = n.arguments[1]; el = idOf(n.callee.object, u); what = 'событие'; }
      else if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && /^(setInterval|setTimeout|requestAnimationFrame)$/.test(n.callee.name) && n.arguments[0]) { what = n.callee.name; fn = n.arguments[0]; el = '—'; ev = n.callee.name; }
      else if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && !n.left.computed && /^on[a-z]+$/.test(n.left.property.name) && /Function/.test(n.right.type)) { what = 'событие'; ev = n.left.property.name.slice(2); fn = n.right; el = idOf(n.left.object, u); }
      if (!what) return;
      let eff; if (fn.type === 'Identifier') { eff = FN[fn.name] ? { w: new Set(), b: new Set(), c: new Set([fn.name]), ls: false } : { w: new Set(), b: new Set(), c: new Set(), ls: false }; } else eff = effects(fn, null);
      const keys = []; if (ev === 'keydown' || ev === 'keyup') walk.full(fn, m => { if (m.type === 'BinaryExpression' && /===|==/.test(m.operator) && m.right.type === 'Literal' && m.left.type === 'MemberExpression' && /^(key|code)$/.test(m.left.property.name || '')) keys.push(m.right.value); });
      const direct = { game: [...eff.w].filter(v => kindOfVar(v) === 'игра'), map: [...eff.w].filter(v => kindOfVar(v) === 'карта/настройки'), fields: [...eff.b].filter(f => kindOfField(f) === 'игра') };
      const via = { game: new Set(), map: new Set(), ls: eff.ls, cmd: new Set() };
      eff.c.forEach(c => { const x = reach(c); if (x.game.size) { via.cmd.add(c); x.game.forEach(v => via.game.add(v)); } x.map.forEach(v => via.map.add(v)); if (x.ls) via.ls = true; });
      const cls2 = direct.game.length || direct.fields.length || via.game.size ? 'меняет игру' : (direct.map.length || via.map.size || via.ls) ? 'настройки / данные карты' : 'только показ';
      H.push({ file: u.f, line: n.loc.start.line, what, el, ev, keys: [...new Set(keys)], class: cls2, commands: [...via.cmd].sort(), direct_game: direct.game, direct_fields: direct.fields,
        direct_map: direct.map, game_via_calls: [...via.game].sort().slice(0, 20), map_via_calls: [...via.map].sort().slice(0, 12), localStorage: via.ls });
    });
  }
  // граница: прямые записи показа в игровое состояние — в обработчиках и в функциях показа (рисунок тоже)
  const viol = [];
  for (const [name, F] of Object.entries(FN)) { if (F.u.side !== 'показ') continue;
    F.w.forEach(v => { if (kindOfVar(v) === 'игра') viol.push({ fn: name, file: F.u.f, write: v }); });
    F.b.forEach(f => { if (kindOfField(f) === 'игра') viol.push({ fn: name, file: F.u.f, write: '.' + f }); }); }
  for (const h of H) { h.direct_game.forEach(v => viol.push({ fn: '(обработчик ' + h.ev + ' ' + h.el + ')', file: h.file, write: v })); h.direct_fields.forEach(f => viol.push({ fn: '(обработчик ' + h.ev + ' ' + h.el + ')', file: h.file, write: '.' + f })); }
  // поля показа на объектах игры (класс «показ» у полей бота): пишет показ, читает ли ядро — доказательство «игра их не читает»
  const showFields = Object.keys(REG).filter(k => k.startsWith('b:') && /^(показ|диагностика)$/.test(REG[k].class)).map(k => k.slice(2)).map(f => {
    const readers = []; for (const u of UNITS.filter(x => x.side === 'ядро')) walk.ancestor(u.ast, { MemberExpression(m, anc) { if (m.computed || m.property.name !== f) return; const p = anc[anc.length - 2];
      if (p && p.type === 'AssignmentExpression' && p.left === m) return; readers.push(u.f + ':' + m.loc.start.line); } });   // чтение, не запись
    return { field: f, class: REG['b:' + f].class, read_by_core: readers }; });
  // переменные показа и диагностики в файлах ядра (класс реестра): читает ли их ядро (кроме объявления) — доказательство «игра не читает»
  const showVars = Object.keys(REG).filter(k => k.startsWith('g:') && /^(показ|диагностика)$/.test(REG[k].class)).map(k => k.slice(2)).filter(v => TOPV[v] && TOPV[v].side === 'ядро').map(v => {
    const readers = []; for (const u of UNITS.filter(x => x.side === 'ядро')) walk.ancestor(u.ast, { Identifier(m, anc) { if (m.name !== v) return; const p = anc[anc.length - 2];
      if (p && p.type === 'VariableDeclarator' && p.id === m) return; if (p && p.type === 'MemberExpression' && p.property === m && !p.computed) return;
      if (p && p.type === 'AssignmentExpression' && p.left === m) return; readers.push(u.f + ':' + m.loc.start.line); } });
    return { var: v, class: REG['g:' + v].class, read_by_core: readers }; });
  const U = { _: 'генерируется tools/rebuild/frame_contract.js: реестр управления (handlers), граница показ → игра (boundary), поля показа (showFields), переменные показа / диагностики в ядре (showVars)', handlers: H, showVars,
    boundary: viol.sort((a, b) => (a.file + a.write).localeCompare(b.file + b.write)), showFields };
  fs.writeFileSync(path.join(ROOT, 'rebuild', 'gen', 'ui.json'), JSON.stringify(U, null, 1) + '\n');
  // таблица управления со статусами: «автотест» — элемент (#id) или клавиша есть в проверках состояния (tools/page/ui_state_check.js,
  // tools/page/worker_check.js — настоящие клики / клавиши, сравнение полного состояния); иначе — «нет автотеста»
  // покрытие — по факту успешных прогонов (rebuild/gen/ui_tested.json, ui_state_check.js --record): нажатые элементы и клавиши, кадр, размер окна
  let COV = {}; try { COV = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'gen', 'ui_tested.json'), 'utf8')); } catch (e) {}
  const tested = h => (h.el && h.el[0] === '#' && (COV.ids || []).includes(h.el)) || (h.keys.length && h.keys.some(k => (COV.keys || []).includes(k))) ||
    (h.what === 'requestAnimationFrame' && COV.frame) || (h.ev === 'resize' && COV.resize);
  const esc = t => String(t == null ? '' : t).replace(/\|/g, '\\|');
  let md = '# Реестр управления: интерфейс → ядро (генерируется: `node tools/rebuild/frame_contract.js`, по коду)\n\n' +
    'Класс — по тому, что обработчик делает (через функции показа до ядра, транзитивно): **только показ**; **меняет игру** (вызывает функции ядра, которые пишут ' +
    'игровое состояние по реестру, или пишет его сам); **настройки / данные карты** (входы, данные карты, хранилище браузера). Прямая запись в игру — граница ' +
    'нарушена (`rebuild/ui_boundary_known.json`, проверка `frame_contract.js --check`). Проверка: автотест — настоящий клик / клавиша в ' +
    '`tools/page/ui_state_check.js` или `worker_check.js` со сравнением полного состояния.\n\n' +
    '| файл:строка | элемент | событие / клавиши | класс | команды ядра | прямо пишет в игру | проверка |\n|---|---|---|---|---|---|---|\n';
  H.slice().sort((a, b) => (a.class + a.file).localeCompare(b.class + b.file) || a.line - b.line).forEach(h => {
    md += '| ' + esc(h.file + ':' + h.line) + ' | ' + esc(h.el) + ' | ' + esc(h.ev + (h.keys.length ? ' ' + h.keys.join(' ') : '')) + ' | ' + h.class + ' | ' + esc(h.commands.slice(0, 6).join(', ')) +
      ' | ' + esc(h.direct_game.concat(h.direct_fields.map(f => '.' + f)).slice(0, 6).join(', ')) + ' | ' + (tested(h) ? 'автотест' : 'нет автотеста') + ' |\n'; });
  const nt = H.filter(tested).length;
  md += '\nИтого: обработчиков ' + H.length + ', с автотестом ' + nt + '. Прямых записей показа в игру (функции и обработчики): ' + viol.length + '.\n';
  fs.writeFileSync(path.join(ROOT, 'rebuild', 'gen', 'ui_registry.md'), md);
  const by = {}; H.forEach(h => { by[h.class] = (by[h.class] || 0) + 1; });
  console.log('интерфейс: обработчиков ' + H.length + ' (' + Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ') + '); прямых записей показа в игру ' + viol.length + '; полей показа, которые читает ядро: ' + showFields.filter(x => x.read_by_core.length).map(x => x.field).join(', '));
  if (process.argv.includes('--check')) {
    const KF = path.join(ROOT, 'rebuild', 'ui_boundary_known.json'), known = fs.existsSync(KF) ? JSON.parse(fs.readFileSync(KF, 'utf8')).known || [] : [];
    const key = x => x.file + ' ' + x.fn + ' ' + x.write, K = new Set(known.map(key)), fresh = viol.filter(x => !K.has(key(x)));
    // сверка по файлам-читателям (строки сдвигаются при правках): новый файл, читающий поле показа, — ошибка
    const files = L => [...new Set(L.map(r => r.split(':')[0]))].sort().join(',');
    const okShow = new Set((fs.existsSync(KF) ? JSON.parse(fs.readFileSync(KF, 'utf8')).showFieldsReadByCore || [] : []).map(x => x.field + ' ' + files(x.read_by_core)));
    const badShow = showFields.filter(x => x.read_by_core.length && !okShow.has(x.field + ' ' + files(x.read_by_core)));
    if (fresh.length || badShow.length) { console.error('ОШИБКА границы показ → игра: ' + fresh.map(key).join('; ') + (badShow.length ? '; ядро читает поля показа: ' + badShow.map(x => x.field + ' ← ' + x.read_by_core.slice(0, 3).join(',')).join('; ') : '')); process.exit(1); }
    console.log('граница показ → игра: новых прямых записей нет (известных ' + known.length + ', rebuild/ui_boundary_known.json)');
  }
}
