// (Р3.2, правила сборки Р-1…Р-18 из docs/reports/audit_2026-11-24/stage3/REGRESSION_PROTECTION.md, 26.11) шаблоны «так больше не писать»:
// известные места (файл · функция → число) — rebuild/build_rules_known.json; новое место или больше прежнего — ошибка сборки; стало
// меньше — подсказка обновить список. Исправлять известные места — менять поведение или переносить механику (после Р8 / по своим шагам),
// здесь — только запрет новых. Р-6 (конец задания гранаты), Р-7 (ответ хозяина), Р-9 (текст NADE_FAIL), Р-13 (кэш — строка реестра
// состояния, класс «кэш») — в gen_maps.js; Р-12, Р-14, Р-15 — инварианты прогонов, не сборка; Р-18 (копия правила) = шаблоны Р-3, Р-4, Р-5, Р-6.
// Запуск: node tools/rebuild/build_rules.js [--write]   (--write — записать известные места по текущему коду)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), SRC = require('./game_src.js');
const acorn = require('acorn'), walk = require('acorn-walk');
const KNOWN = path.join(ROOT, 'rebuild', 'build_rules_known.json');
const OWN = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'owners.json'), 'utf8'));
// rule: id, что запрещено, где (part игры / файлы инструментов), шаблон (регулярка по строке кода без комментариев) или ast(node) → bool
const RULES = [
  { id: 'Р-1', what: 'время «успею» по прямой: hypot(…) / SPEED — путь по навмешу (pathLenTo) и шаг / оружие', parts: ['decide'], re: /hypot\([^;]*\)\s*\/\s*\(?\s*SPEED\b/ },
  { id: 'Р-3а', what: 'hasLOS(…) с 4 аргументами — без высоты смотрящего', parts: ['decide', 'engine'], ast: n => n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'hasLOS' && n.arguments.length === 4 },
  { id: 'Р-3б', what: 'этаж по |z| <= число — правило этажа одно (будущий sameFloor)', parts: ['decide', 'engine'], re: /abs\([^()]*\bz\b[^()]*\)\s*<=?\s*[0-9]/ },
  { id: 'Р-4', what: 'нормировка угла своим кодом (% 2π, + 3π) — только DM (dmath)', parts: ['decide', 'engine', 'infra', 'watch'], re: /%\s*\(?\s*2\s*\*\s*(Math|DM)\.PI|(Math|DM)\.PI\s*\*\s*3/ },
  { id: 'Р-5', what: 'зерно случайности от id бота своим кодом: hashRand(… .id …) — будущий botRand(b, соль)', parts: ['decide', 'engine'], re: /hashRand\([^;]*\.id\b/ },
  { id: 'Р-16', what: 'запись перезарядки (_reloading / reloadUntil) — только у боевого цикла', parts: ['decide', 'engine'], re: /\b(_reloading|reloadUntil)\s*=[^=]/ },
  { id: 'Р-17', what: 'сцены проверки пишут позицию бота (x / baseX / y / baseY) напрямую', tools: /^tools\/.*scenarios[^/]*\.js$/, re: /\.(x|baseX|y|baseY)\s*=[^=]/ }
];
function parse(t) { for (const [a, b] of [['', ''], ['', '\n})();'], ['(function(){\n', ''], ['(function(){\n', '\n})();']]) { try { return { ast: acorn.parse(a + t + b, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true }), off: a.length }; } catch (e) {} } return null; }
function scanFile(file, text, rules, U) {
  const P = parse(text.replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' ')));
  // функции верхнего уровня: имя по позиции; комментарии — вырезать из текста для регулярок
  const tops = []; let code = text;
  if (P) { P.ast.body.forEach(st => { if (st.type === 'FunctionDeclaration') tops.push([st.start - P.off, st.end - P.off, st.id.name]); });
    const C = []; try { acorn.parse(text.replace(/@@[A-Z_]+@@/g, m => '0'.padEnd(m.length, ' ')), { ecmaVersion: 'latest', allowReturnOutsideFunction: true, onComment: (b, t, s, e) => C.push([s, e]) }); } catch (e) {}
    C.forEach(([s, e]) => { code = code.slice(0, s) + ' '.repeat(e - s) + code.slice(e); }); }
  const fnAt = pos => { const t = tops.find(([s, e]) => pos >= s && pos < e); return t ? t[2] : '(верх файла)'; };
  for (const r of rules) {
    const add = pos => { const k = r.id + ' · ' + file + ' · ' + fnAt(pos); U[k] = (U[k] || 0) + 1; };
    if (r.re) { const g = new RegExp(r.re.source, 'g'); let m; while ((m = g.exec(code))) {
      // Р-16: gen_maps дополнительно подтверждает ровно одну фактическую запись в функции владельца.
      const owner = r.id === 'Р-16' && OWN[m[1]];
      if (owner?.exclusive && owner.ownerFile === SRC.fileId(file) && owner.writer === fnAt(m.index)) continue;
      add(m.index);
    } }
    if (r.ast && P) walk.simple(P.ast, { CallExpression(n) { if (r.ast(n)) add(n.start - P.off); } });
  }
}
function scan() {
  const U = {};
  for (const f of SRC.gameFiles().filter(f => /\.(js|ts)$/.test(f))) { const part = SRC.filePart(f), rs = RULES.filter(r => r.parts && r.parts.includes(part)); if (rs.length) scanFile(f, SRC.readGame(f), rs, U); }
  const TR = RULES.filter(r => r.tools);
  for (const f of require('child_process').execSync('git ls-files tools', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)) {
    const rs = TR.filter(r => r.tools.test(f)); if (rs.length) scanFile(f, fs.readFileSync(path.join(ROOT, f), 'utf8'), rs, U); }
  return U;
}
function check() {
  const U = scan(), lines = []; let bad = 0, K;
  try { K = JSON.parse(fs.readFileSync(KNOWN, 'utf8')).known; } catch (e) { return { bad: 1, lines: ['  ✗ нет rebuild/build_rules_known.json — node tools/rebuild/build_rules.js --write'] }; }
  const more = Object.entries(U).filter(([k, n]) => n > (K[k] || 0)), less = Object.entries(K).filter(([k, n]) => (U[k] || 0) < n);
  more.forEach(([k, n]) => { bad++; const id = k.split(' · ')[0], r = RULES.find(x => x.id === id); lines.push('  ✗ ' + k + ' ×' + n + ' (известно ' + (K[k] || 0) + '): ' + r.what); });
  const by = {}; Object.entries(U).forEach(([k, n]) => { const id = k.split(' · ')[0]; by[id] = (by[id] || 0) + n; });
  lines.unshift('правила сборки Р-1…Р-17: известных мест ' + RULES.map(r => r.id + ' ' + (by[r.id] || 0)).join(', ') + '; новых ' + bad + (less.length ? '; стало меньше — обновить rebuild/build_rules_known.json (--write): ' + less.length : ''));
  return { bad, lines };
}
if (require.main === module) {
  if (process.argv.includes('--write')) fs.writeFileSync(KNOWN, JSON.stringify({ _: 'Известные места шаблонов правил сборки Р-1…Р-17 (tools/rebuild/build_rules.js): правило · файл · функция → число. Новое место — ошибка сборки; убирать места — по шагам механик (после Р8 / при переносе).', rules: Object.fromEntries(RULES.map(r => [r.id, r.what])), known: Object.fromEntries(Object.entries(scan()).sort()) }, null, 1) + '\n');
  const r = check(); r.lines.forEach(l => console.log(l)); process.exit(r.bad ? 1 : 0);
}
module.exports = { check, RULES };
