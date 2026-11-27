// (Р8 п. 10, 27.11) Анализ влияния правки (docs/reports/audit_2026-11-24/stage3/REGRESSION_PROTECTION.md §4): изменённые функции игры →
// поля и общие переменные, которые они пишут → функции и механики, которые их читают (карточки rebuild/cards.json) → сцены реестра, где
// изменённые функции выполняются (rebuild/gen/scene_funcs.json, tools/rebuild/scene_cov.js). Правка вне функций (объявления общих
// переменных) → сцены, где выполняются читатели этих переменных. Игру не меняет; читает git и исходник.
// Запуск: node tools/rebuild/impact.js [<база>..<конец> | <коммит>]  (по умолчанию HEAD~1..HEAD; без коммита: --work — рабочее дерево против HEAD)
//         [--json] — машинный ответ (для L1: tools/rebuild/l1.js)
//         [--both] — Машинный ответ и Markdown одного анализа
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const acorn = require('acorn'), walk = require('acorn-walk'), GS = require('./game_src.js'), ROOT = GS.ROOT;
const A = process.argv.slice(2), JSONOUT = A.includes('--json'), BOTH = A.includes('--both'), WORK = A.includes('--work');
const spec = A.find(x => !x.startsWith('--')) || 'HEAD~1..HEAD';
const [BASE, TIP] = WORK ? ['HEAD', null] : spec.includes('..') ? spec.split('..') : [spec + '~1', spec];
const git = (args) => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const show = (rev, p) => { if (rev === null) return fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : null;
  try { return git(['show', rev + ':' + p]); } catch (e) { return null; } };
const META = GS.gameMeta(), CARDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'cards.json'), 'utf8')).cards;
const relOf = f => (META[f] ? META[f].dir : 'src/game') + '/' + f;
// разбор файла игры (кусок общей обёртки — те же пробы, что tools/rebuild/build_rules.js): функции верхнего уровня, объявления, чтения и записи
function parse(t) { for (const [a, b] of [['', ''], ['', '\n})();'], ['(function(){\n', ''], ['(function(){\n', '\n})();']]) { try { return { ast: acorn.parse(a + t + b, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true }), off: a.length, lo: a ? 1 : 0 }; } catch (e) {} } return null; }
function index(text, file) {
  if (text == null) return null;
  const src = /\.ts$/.test(file) ? GS.stripTs(text, file) : text, P = parse(src.replace(/@@[A-Z_0-9]+@@/g, m => '0'.padEnd(m.length, ' ')));
  const fns = [], vars = []; if (!P) return { fns, vars, bad: true };
  const e0 = P.ast.body.length === 1 && P.ast.body[0].type === 'ExpressionStatement' ? P.ast.body[0].expression : null;
  const body = e0 && e0.type === 'CallExpression' && e0.callee.type === 'FunctionExpression' ? e0.callee.body.body : P.ast.body;
  for (const st of body) {
    const l0 = st.loc.start.line - P.lo, l1 = st.loc.end.line - P.lo;
    if (st.type === 'FunctionDeclaration') {
      const W = new Set(), R = new Set();
      walk.ancestor(st.body, {
        AssignmentExpression(n) { tgt(n.left, W); }, UpdateExpression(n) { tgt(n.argument, W); },
        CallExpression(n) { const c = n.callee; if (c.type === 'MemberExpression' && !c.computed && MUT.has(c.property.name)) tgt(c.object, W); },   // x.f.push(…), M.cache.set(…)
        MemberExpression(n, anc) { if (!n.computed) R.add('.' + n.property.name); },
        Identifier(n) { R.add(n.name); } });
      fns.push({ name: st.id.name, l0, l1, W, R });
    } else if (st.type === 'VariableDeclaration') st.declarations.forEach(d => { if (d.id.type === 'Identifier') vars.push({ name: d.id.name, l0, l1 }); });
  }
  return { fns, vars };
}
const MUT = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'set', 'add', 'delete', 'clear']);
function tgt(n, W) { if (n.type === 'Identifier') W.add(n.name); else if (n.type === 'MemberExpression') { if (!n.computed) W.add('.' + n.property.name); let o = n.object; while (o.type === 'MemberExpression') o = o.object; if (o.type === 'Identifier') W.add(o.name + '[…]'); } }
// изменённые строки по файлу: [[l0, l1], …] старой и новой стороны
function hunks() {
  const files = GS.gameFiles().filter(f => /\.(js|ts)$/.test(f)).map(relOf);
  const d = git(['diff', '-U0', '--no-color', BASE].concat(TIP ? [TIP] : []).concat(['--']).concat(files));
  const H = {}; let cur = null;
  d.split('\n').forEach(l => { let m;
    if ((m = /^\+\+\+ b\/(.*)$/.exec(l))) { cur = m[1]; H[cur] = H[cur] || { old: [], neu: [] }; }
    else if ((m = /^--- a\/(.*)$/.exec(l))) { if (m[1] !== '/dev/null') { cur = m[1]; H[cur] = H[cur] || { old: [], neu: [] }; } }
    else if (cur && (m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l))) {
      const oa = +m[1], on = m[2] === undefined ? 1 : +m[2], na = +m[3], nn = m[4] === undefined ? 1 : +m[4];
      if (on) H[cur].old.push([oa, oa + on - 1]); if (nn) H[cur].neu.push([na, na + nn - 1]); else H[cur].neu.push([na, na]); } });
  return H;
}
const over = (a, b) => a[0] <= b[1] && b[0] <= a[1];
function main() {
  const H = hunks(), changed = new Map(), topVars = new Set(), files = Object.keys(H);
  for (const rel of files) {
    const f = path.basename(rel), O = index(show(BASE, rel), f), N = index(show(TIP, rel), f);
    for (const [side, I] of [['old', O], ['neu', N]]) { if (!I) continue;
      H[rel][side].forEach(h => {
        I.fns.forEach(fn => { if (over([fn.l0, fn.l1], h)) { const k = fn.name; if (!changed.has(k)) changed.set(k, { file: f, W: new Set() }); fn.W.forEach(w => changed.get(k).W.add(w)); } });
        I.vars.forEach(v => { if (over([v.l0, v.l1], h)) topVars.add(v.name); }); }); }
  }
  // весь исходник (конец диапазона): кто читает записанное
  const all = [], globals = new Set();
  GS.gameFiles().filter(f => /\.(js|ts)$/.test(f)).forEach(f => { const I = index(show(TIP, relOf(f)), f); if (!I) return; I.vars.forEach(v => globals.add(v.name)); I.fns.forEach(fn => all.push(Object.assign({ file: f }, fn))); });
  const written = new Set(); changed.forEach(c => c.W.forEach(w => { if (w.startsWith('.') || globals.has(w)) written.add(w); }));
  topVars.forEach(v => written.add(v));
  const readers = {}; written.forEach(w => { readers[w] = all.filter(fn => fn.R.has(w)).map(fn => fn.name + ' (' + GS.fileId(fn.file) + ')'); });
  const readerFns = new Set(); all.forEach(fn => { for (const w of topVars) if (fn.R.has(w)) { readerFns.add(fn.name); break; } });
  const mechOf = f => (CARDS[f] && CARDS[f].mech) || GS.fileSys(f);
  const mechChanged = [...new Set([...changed.values()].map(c => c.file).concat(files.map(r => path.basename(r))))].map(f => GS.fileId(f) + ': ' + mechOf(f));
  const mechReaders = {}; written.forEach(w => all.filter(fn => fn.R.has(w)).forEach(fn => { const m = GS.fileId(fn.file) + ': ' + mechOf(fn.file); mechReaders[m] = (mechReaders[m] || 0) + 1; }));
  const SF = path.join(ROOT, 'rebuild', 'gen', 'scene_funcs.json'), SC = fs.existsSync(SF) ? JSON.parse(fs.readFileSync(SF, 'utf8')) : null;
  const scenes = []; if (SC) for (const [id, s] of Object.entries(SC.scenes)) { const F = new Set(s.functions);
    const hit = [...changed.keys()].filter(k => F.has(k)), via = [...readerFns].filter(k => F.has(k));
    if (hit.length || via.length) scenes.push({ id, file: s.file, sim: s.sim, functions: hit, readers_of_changed_vars: via.slice(0, 8) }); }
  const res = { range: BASE + '..' + (TIP || 'рабочее дерево'), files: files, changed_functions: [...changed.keys()], top_level_vars: [...topVars],
    written: [...written], mechanics_changed: mechChanged, mechanics_reading: mechReaders, scenes, scenes_total: SC ? Object.keys(SC.scenes).length : 0, scene_map: SC ? SC.built : null };
  if (JSONOUT) { console.log(JSON.stringify(res)); return; }
  const L = []; L.push('# Анализ влияния: ' + res.range, '');
  const emit = () => console.log(BOTH ? JSON.stringify({ impact: res, markdown: L.join('\n') + '\n' }) : L.join('\n'));
  if (!files.length) { L.push('Файлы игры не менялись — механики и сцены не задеты.'); emit(); return; }
  L.push('**Изменены файлы игры:** ' + files.join(', '), '', '**Изменённые функции (' + res.changed_functions.length + '):** ' + (res.changed_functions.join(', ') || '—'));
  if (topVars.size) L.push('', '**Изменены объявления вне функций:** ' + [...topVars].join(', '));
  L.push('', '**Механики изменённых файлов:**', ...mechChanged.map(m => '- ' + m));
  L.push('', '**Что пишут изменённые функции и кто это читает:**');
  [...written].sort().forEach(w => { const r = readers[w]; L.push('- `' + w + '` — читают ' + r.length + ' функций' + (r.length ? ': ' + r.slice(0, 12).join(', ') + (r.length > 12 ? ', …' : '') : '')); });
  L.push('', '**Задетые механики (читатели записанного; число функций):**', ...Object.entries(mechReaders).sort((a, b) => b[1] - a[1]).map(([m, n]) => '- ' + m + ' — ' + n));
  if (!SC) L.push('', '**Сцены:** нет карты сцен (`node tools/rebuild/scene_cov.js <сборки>` → rebuild/gen/scene_funcs.json).');
  else { L.push('', '**Сцены реестра, где выполняются изменённые функции (' + scenes.length + ' из ' + res.scenes_total + '; карта сцен — ' + (SC.built.at || '?') + '):**');
    scenes.forEach(s => L.push('- ' + s.id + ' (' + s.file + ') — ' + (s.functions.length ? s.functions.slice(0, 6).join(', ') + (s.functions.length > 6 ? ', …' : '') : 'читатели изменённых переменных: ' + s.readers_of_changed_vars.join(', '))));
    if (!scenes.length) L.push('- ни одна сцена не выполняет изменённые функции'); }
  emit();
}
main();
