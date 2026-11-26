// (Р3.2, канал «команда») разрезание мозга (tBrain / ctBrain) на функции в ТОМ ЖЕ порядке — механическое преобразование по областям
// видимости (eslint-scope), без ручной правки логики:
//   - части (подряд идущие верхние операторы или ветки цепочки if / else if) выносятся в функции name(K) сразу после мозга;
//   - локальная переменная мозга, которая встречается больше чем в одной части (главная функция — тоже часть), становится полем
//     объекта контекста K (K.x) везде, включая замыкания; встречающаяся в одной части — остаётся локальной в ней;
//   - выход из мозга (return; внутри части, не во вложенной функции) → return true; вызов части — if(name(K)) return;
// Объявление var x = v у поля K → K.x = v (порядок вычислений тот же). Значения те же: K создаётся на каждый вызов мозга, как и локальные.
// Запуск: node tools/rebuild/brain_split.js <файл> <функция> <spec.json> [--dry] — spec: [{name, from, to} | {name, ifLine, branch}]
'use strict';
const fs = require('fs'), acorn = require('acorn'), escope = require('eslint-scope'), walk = require('acorn-walk');
const [file, fname, specFile] = process.argv.slice(2), DRY = process.argv.includes('--dry');
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', ranges: true, locations: true, allowReturnOutsideFunction: true });
const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
const fd = ast.body.find(s => s.type === 'FunctionDeclaration' && s.id.name === fname); if (!fd) throw new Error('нет функции ' + fname);
const top = fd.body.body;
// части: диапазоны исходника [start, end) и вид
const parts = spec.map(p => {
  if (p.ifLine) { let s = top.find(x => x.loc.start.line === p.ifLine); if (!s || s.type !== 'IfStatement') throw new Error('нет if на строке ' + p.ifLine);
    for (let k = 0; k < p.branch; k++) { s = s.alternate; if (!s || s.type !== 'IfStatement') throw new Error('нет ветки ' + p.branch); }
    const c = s.consequent; if (c.type !== 'BlockStatement') throw new Error('ветка без блока');
    return { name: p.name, kind: 'branch', start: c.range[0] + 1, end: c.range[1] - 1, node: c }; }
  const S = top.filter(x => x.loc.start.line >= p.from && x.loc.start.line <= p.to); if (!S.length) throw new Error('пустая часть ' + p.name);
  const i0 = top.indexOf(S[0]), i1 = top.indexOf(S[S.length - 1]); if (i1 - i0 + 1 !== S.length) throw new Error('часть не подряд ' + p.name);
  return { name: p.name, kind: 'stmts', start: S[0].range[0], end: S[S.length - 1].range[1], stmts: S };
});
const partOf = pos => { const p = parts.find(q => pos >= q.start && pos < q.end); return p ? p.name : '(главная)'; };
// переменные мозга и где они встречаются
const scope = sm.acquire(fd), vars = scope.variables.filter(v => v.name !== 'arguments');
const K = new Set(), localOf = {}, FN = [];
for (const v of vars) {
  const where = new Set(v.references.map(r => partOf(r.identifier.range[0])).concat(v.defs.map(d => partOf(d.name.range[0]))));
  // функции-объявления внутри мозга (всплытие) — не переносим в K (не встречались в этом коде; если будут — остановка)
  // объявление функции (всплывает) в главной части, вызываемое из нескольких частей: остаётся в главной, в начале мозга K.f = f
  if (v.defs.some(d => d.type === 'FunctionName') && where.size > 1) {
    if (v.defs.some(d => partOf(d.name.range[0]) !== '(главная)')) throw new Error('объявление функции ' + v.name + ' в выносимой части и используется в нескольких — разобрать вручную');
    FN.push(v.name); }
  if (where.size > 1) K.add(v.name); else localOf[v.name] = [...where][0];
}
// правки: [start, end, текст]
const E = [];
for (const v of vars) if (K.has(v.name)) {
  for (const r of v.references) { const id = r.identifier;
    // объявления var x = v обрабатываются ниже (декларатор целиком)
    if (r.init && v.defs.some(d => d.name === id)) continue;
    E.push([id.range[0], id.range[1], 'K.' + v.name]); }
}
// объявления: var a = 1, b; → K.a = 1; (b без значения — ничего: поле отсутствует = undefined, как неинициализированная var)
walk.ancestor(fd.body, { VariableDeclaration(vd, anc) {
  const kD = vd.declarations.filter(d => d.id.type === 'Identifier' && K.has(d.id.name));
  if (!kD.length) return;
  // объявление внутри вложенной функции — чужая область
  if (anc.slice(0, -1).some(a => a !== fd.body && /Function/.test(a.type))) { const own = sm.acquire(anc.slice(0, -1).reverse().find(a => /Function/.test(a.type)));
    if (own && own.variables.some(x => kD.some(d => d.id.name === x.name))) return; }
  const par = anc[anc.length - 2];
  if (kD.length !== vd.declarations.length) {
    // смешанное объявление вне заголовка цикла: по декларатору в прежнем порядке — K.a = …; var b = …;
    if (!par || /^For/.test(par.type) && (par.init === vd || par.left === vd)) throw new Error('смешанное объявление в заголовке цикла, строка ' + vd.loc.start.line);
    E.push([vd.range[0], vd.range[1], vd.declarations.map(d => K.has(d.id.name) ? (d.init ? 'K.' + d.id.name + ' = ' + applyInner(d.init.range[0], d.init.range[1]) + ';' : '')
      : 'var ' + d.id.name + (d.init ? ' = ' + applyInner(d.init.range[0], d.init.range[1]) : '') + ';').filter(Boolean).join(' '), true]);
    return; }
  const inFor = par && (par.type === 'ForStatement' && par.init === vd || (par.type === 'ForInStatement' || par.type === 'ForOfStatement') && par.left === vd);
  const txt = kD.map(d => d.init ? 'K.' + d.id.name + ' = ' + applyInner(d.init.range[0], d.init.range[1]) : null).filter(Boolean);
  if (par && (par.type === 'ForInStatement' || par.type === 'ForOfStatement') && par.left === vd) { E.push([vd.range[0], vd.range[1], 'K.' + kD[0].id.name, true]); return; }
  const out = txt.length ? txt.join(', ') + (inFor ? '' : ';') : (inFor ? '' : ';');
  E.push([vd.range[0], vd.range[1], out, true]);
} });
// текст диапазона с правками K внутри (для инициализаторов)
function applyInner(a, b) { const ed = E.filter(e => !e[3] && e[0] >= a && e[1] <= b).sort((x, y) => y[0] - x[0]); let t = src.slice(a, b);
  for (const [s, e, r] of ed) t = t.slice(0, s - a) + r + t.slice(e - a); return t; }
// выходы из мозга внутри частей
for (const p of parts) walk.ancestor(fd.body, { ReturnStatement(rs, anc) {
  if (rs.range[0] < p.start || rs.range[0] >= p.end) return;
  if (anc.slice(0, -1).some(a => a !== fd.body && /Function/.test(a.type))) return;
  if (rs.argument) throw new Error('return со значением в части ' + p.name + ' (строка ' + rs.loc.start.line + ')');
  E.push([rs.range[0], rs.range[1], 'return true;']); p.ret = true;
} });
// применить правки к диапазону (декларации заменяют целиком — внутренние правки инициализатора уже в тексте)
function apply(a, b) { const all = E.filter(e => e[0] >= a && e[1] <= b), box = all.filter(e => e[3]);
  // правка-объявление заменяет диапазон целиком (её текст уже с внутренними правками) — внутренние правки в нём не применяются
  const ed = all.filter(e => e[3] || !box.some(x => e[0] >= x[0] && e[1] <= x[1])).sort((x, y) => y[0] - x[0]); let t = src.slice(a, b);
  for (const e of ed) t = t.slice(0, e[0] - a) + e[2] + t.slice(e[1] - a);
  return t; }
// главная функция: части → вызовы
let body = '', pos = fd.body.range[0] + 1;
const sorted = parts.slice().sort((a, b) => a.start - b.start);
for (const p of sorted) { body += apply(pos, p.start) + (p.kind === 'branch' ? '\n    ' : '') + (p.ret ? 'if(' + p.name + '(K)) return;' : p.name + '(K);') + (p.kind === 'branch' ? '\n  ' : ''); pos = p.end; }
body += apply(pos, fd.body.range[1] - 1);
const head = src.slice(fd.range[0], fd.body.range[0] + 1);
const kDecl = '\n  // (Р3.2 команда) контекст мозга: общие для частей переменные (' + [...K].sort().join(', ') + ')\n  var K = {};' + FN.map(n => ' K.' + n + ' = ' + n + ';').join('');
const mainTxt = head + kDecl + body + '}';
const fnTxt = sorted.map(p => '\n// часть ' + fname + ' (Р3.2 команда, разрезание в прежнем порядке) — ' + (p.kind === 'branch' ? 'ветка' : 'операторы') + ' строк ' + src.slice(0, p.start).split('\n').length + '–' + src.slice(0, p.end).split('\n').length + ' исходного ' + fname + (p.ret ? '; true — выйти из мозга' : '') + '\nfunction ' + p.name + '(K){\n  ' + apply(p.start, p.end).trim() + '\n}').join('\n');
const out = src.slice(0, fd.range[0]) + mainTxt + '\n' + fnTxt + src.slice(fd.range[1]);
console.log('поля K: ' + K.size + ' (' + [...K].sort().join(', ') + ')');
console.log('части: ' + parts.map(p => p.name + (p.ret ? ' (выход)' : '')).join(', ') + '; локальных в частях: ' + Object.entries(localOf).filter(([, w]) => w !== '(главная)').length);
if (!DRY) fs.writeFileSync(file, out); else fs.writeFileSync('/dev/stdout', '');
