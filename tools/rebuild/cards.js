// (Р3.5, 25.11) Карточки механик: реестр rebuild/cards.json — у каждого файла кода игры (src/game/*.js / .ts) механика и функции-хозяева
// (через них идут решения механики); проверка сборки (gen_maps --check) падает на расхождении карточки и кода:
//   - у файла нет карточки / карточка у файла, которого нет;
//   - функция из owns не объявлена в этом файле (переименовали / перенесли — карточку поправить вместе с кодом);
//   - хозяин поля из rebuild/owners.json (allow) не записан в owns карточки своего файла (кто пишет поле — видно по карточке).
// Шапка файла (первая строка — комментарий) — краткое описание; карточка — полное: механика, хозяева, файл в таблице «Где что» (AGENTS.md §11).
// --init — первое заполнение: механика — строка таблицы «Где что», где назван файл (иначе — первая строка шапки), хозяева — имена функций
// из этой строки, объявленные в файле, и хозяева полей из owners.json. Дальше реестр правится руками вместе с кодом.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), SRC = require('./game_src.js');
const acorn = require('acorn'), walk = require('acorn-walk');
const CARDS = path.join(ROOT, 'rebuild', 'cards.json');
function decls() {   // файл → множество объявленных функций (верхний уровень и вложенные function name(){})
  const D = {};
  for (const f of SRC.gameFiles().filter(f => /\.(js|ts)$/.test(f))) { const s = new Set(); D[f] = s; let ast;
    try { ast = acorn.parse(SRC.readGame(f), { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); } catch (e) { continue; }
    walk.simple(ast, { FunctionDeclaration(fd) { s.add(fd.id.name); } }); }
  return D;
}
function ownersAllow() {   // хозяева полей: имя функции → поля
  const O = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'owners.json'), 'utf8')), A = {};
  for (const [fl, o] of Object.entries(O)) { if (fl[0] === '_' || !o || !Array.isArray(o.allow)) continue; o.allow.forEach(fn => (A[fn] = A[fn] || []).push(fl)); }
  return A;
}
function table() {   // строки таблицы «Где что» из AGENTS.md §11: [что, файлы]
  const t = fs.readFileSync(path.join(ROOT, 'docs', 'ARCHITECTURE.md'), 'utf8'), i = t.indexOf('## Где что'); if (i < 0) return [];   // (Р4.6) таблица — в ARCHITECTURE
  return t.slice(i).split('\n').filter(l => /^\| /.test(l) && !/^\| что \|/.test(l) && !/^\|---/.test(l)).map(l => { const c = l.split('|').map(x => x.trim()); return [c[1] || '', c[2] || '']; });
}
function init() {
  const D = decls(), A = ownersAllow(), T = table(), C = {};
  for (const f of Object.keys(D)) { const base = f.replace(/\.(js|ts)$/, '');
    const rows = T.filter(([, fl]) => fl.includes('`' + base + '`') || fl.includes(base));
    const head = (SRC.readGame(f).split('\n').find(l => /^\s*\/\//.test(l)) || '').replace(/^\s*\/\/\s*/, '').replace(/^[-=\s]+|[-=\s]+$/g, '').slice(0, 160);
    const mech = rows.length ? rows.map(r => r[0].replace(/\*\*/g, '').replace(/`/g, '')).join('; ').slice(0, 300) : head;
    const named = new Set(); rows.forEach(r => (r[0] + ' ' + r[1]).replace(/`([A-Za-z_$][\w$]*)`/g, (m, n) => { if (D[f].has(n)) named.add(n); return m; }));
    Object.keys(A).forEach(fn => { if (D[f].has(fn)) named.add(fn); });
    C[f] = { mech, owns: [...named].sort(), src: rows.length ? 'таблица «Где что»' : 'шапка файла' };
  }
  fs.writeFileSync(CARDS, JSON.stringify({ _: 'Карточки механик (Р3.5): файл → механика, функции-хозяева (owns). Проверка — tools/rebuild/cards.js из gen_maps --check: правится вместе с кодом.', cards: C }, null, 1) + '\n');
  return C;
}
// (Р3.5, 26.11) шапка файла — часть карточки: первая строка файла несёт «[хозяева: a, b]» (или «[хозяева: —]») — те же функции, что owns
// карточки; строка не добавляется (тег — в начале первой строки: «// [хозяева: …] прежний текст» или «/* [хозяева: …] */ код»), номера
// строк файла не сдвигаются. --headers — записать теги по карточкам
const HEAD_RE = /\[хозяева: ([^\]]*)\]/;
const headTag = owns => '[хозяева: ' + (owns.length ? owns.join(', ') : '—') + ']';
function headers(C) {
  let n = 0;
  for (const [f, c] of Object.entries(C)) { const p = SRC.gamePath(f), s = fs.readFileSync(p, 'utf8'), i = s.indexOf('\n'), l1 = i < 0 ? s : s.slice(0, i), tag = headTag(c.owns || []);
    let nl = HEAD_RE.test(l1) ? l1.replace(HEAD_RE, tag) : /^\/\/ ?/.test(l1) ? l1.replace(/^\/\/ ?/, '// ' + tag + ' ') : '/* ' + tag + ' */ ' + l1;
    if (nl !== l1) { fs.writeFileSync(p, nl + (i < 0 ? '' : s.slice(i))); n++; } }
  return n;
}
function check() {
  const D = decls(), A = ownersAllow(), lines = []; let bad = 0;
  let C; try { C = JSON.parse(fs.readFileSync(CARDS, 'utf8')).cards; } catch (e) { return { bad: 1, lines: ['  ✗ нет rebuild/cards.json — node tools/rebuild/cards.js --init'] }; }
  for (const f of Object.keys(D)) if (!C[f]) { bad++; lines.push('  ✗ у файла ' + f + ' нет карточки механики (rebuild/cards.json)'); }
  for (const [f, c] of Object.entries(C)) {
    if (!D[f]) { bad++; lines.push('  ✗ карточка файла ' + f + ', которого нет'); continue; }
    if (!c.mech) { bad++; lines.push('  ✗ карточка ' + f + ': пустая механика'); }
    (c.owns || []).forEach(fn => { if (!D[f].has(fn)) { bad++; lines.push('  ✗ карточка ' + f + ': функции ' + fn + ' в файле нет (переименована / перенесена?)'); } });
  }
  for (const [fn, fl] of Object.entries(A)) { const f = Object.keys(D).find(x => D[x].has(fn)); if (!f) continue;
    if (!(C[f] && (C[f].owns || []).includes(fn))) { bad++; lines.push('  ✗ хозяин поля ' + fl.join(', ') + ' — ' + fn + ' (' + f + ') не записан в карточку файла'); } }
  for (const [f, c] of Object.entries(C)) { if (!D[f]) continue; const l1 = fs.readFileSync(SRC.gamePath(f), 'utf8').split('\n')[0], m = HEAD_RE.exec(l1);
    const got = m ? (m[1] === '—' ? [] : m[1].split(', ')) : null, want = (c.owns || []).slice();
    if (!got) { bad++; lines.push('  ✗ шапка ' + f + ': в первой строке нет «[хозяева: …]» (node tools/rebuild/cards.js --headers)'); }
    else if (got.slice().sort().join() !== want.slice().sort().join()) { bad++; lines.push('  ✗ шапка ' + f + ': хозяева в шапке «' + got.join(', ') + '» ≠ карточка «' + want.join(', ') + '»'); } }
  lines.unshift('карточки механик: файлов ' + Object.keys(D).length + ', расхождений ' + bad);
  return { bad, lines };
}
if (require.main === module) {
  if (process.argv.includes('--init')) { const C = init(); console.log('карточек ' + Object.keys(C).length + ', из таблицы ' + Object.values(C).filter(c => c.src !== 'шапка файла').length); }
  if (process.argv.includes('--headers')) console.log('шапок записано ' + headers(JSON.parse(fs.readFileSync(CARDS, 'utf8')).cards));
  const r = check(); r.lines.forEach(l => console.log(l)); process.exit(r.bad ? 1 : 0);
}
module.exports = { check, init };
