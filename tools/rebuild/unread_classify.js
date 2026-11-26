// (вопрос 16, владелец 26.11) классификация мест, где решение не читает ответ хозяина (rebuild/unread_results.json): намеренное игнорирование
// / потенциально ошибочное / подтверждённая ошибка / недостаточно данных — с механизмом, последствием отказа и дальнейшим исполнением.
// Без доказательства ошибкой не считается. Источники: (1) разбор кода каждого места (заявка одноразовая — под флагом, который ставится
// рядом; после вызова код пишет состояние, как будто заявка принята); (2) прогоны tools/rebuild/unread_dyn.js (отказы, повтор заявки за
// 1 с, получил ли бот задачу за 5 с); (3) подтверждённые эпизоды (журнал недостатков, аудит этапа 1). Поведение не меняется (после Р8).
// Запуск: node tools/rebuild/unread_classify.js <unread_dyn_1.json> [...]   → rebuild/unread_classified.json, rebuild/UNREAD_CLASSIFIED.md
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), G = require('./game_src.js'), acorn = require('acorn'), walk = require('acorn-walk');
const KNOWN = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'unread_results.json'), 'utf8')).known;
// подтверждённые эпизоды: тег заявки → доказательство
const CONFIRMED = { fetchCover: 'Б-3 (rebuild/BEHAVIOR_BACKLOG.md; аудит этапа 1, stage2b/EXECUTION_ORDER_AUDIT.md «Фетч бомбы — ПОДТВЕРЖДЕНО»): прикрывающему отказал арбитр (уровень 6 выше), отказ не проверен, сборщик ждёт прикрывающего — бомба лежит' };
const DYN = {}, runs = process.argv.slice(2);
for (const f of runs) { const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(d.sites)) { const s = DYN[k] || (DYN[k] = { calls: 0, refused: 0, again: 0, later: 0, why: {} });
    for (const x of ['calls', 'refused', 'again', 'later']) s[x] += v[x]; for (const [w, n] of Object.entries(v.why)) s.why[w] = (s.why[w] || 0) + n; } }
// (1) места в коде
const sites = [];
const lit = n => n && n.type === 'Literal' ? String(n.value) : n && n.type === 'TemplateLiteral' ? n.quasis[0].value.cooked + '…' : n && n.type === 'BinaryExpression' ? (lit(n.left) || '?') + '…' : n ? '(выражение)' : '';
for (const f of G.gameFiles().filter(f => /\.(js|ts)$/.test(f) && G.filePart(f) === 'decide')) {
  const src = G.readGame(f); let ast = null, pre = 0;
  for (const [a, b] of [['', ''], ['', '\n})();'], ['(function(){\n', ''], ['(function(){\n', '\n})();']]) { try { ast = acorn.parse(a + src + b, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, locations: true }); pre = a ? 1 : 0; break; } catch (e) {} }
  if (!ast) continue;
  const tops = ast.body.filter(s => s.type === 'FunctionDeclaration');
  walk.fullAncestor(ast, (n, _s, anc) => {
    if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || !/^(setPost|assignNade)$/.test(n.callee.name)) return;
    const par = anc[anc.length - 2], g = anc[anc.length - 3];
    const stmt = par.type === 'ExpressionStatement' ? par : par.type === 'SequenceExpression' && g && g.type === 'ExpressionStatement' ? g : null;
    if (!stmt) return;
    const top = tops.find(t => n.start >= t.start && n.end <= t.end), fn = top ? top.id.name : '(верх файла)';
    const owner = n.callee.name, arg0 = n.arguments[0], who = arg0 && arg0.type === 'Identifier' ? arg0.name : null;
    const tag = owner === 'setPost' ? lit(n.arguments[4]) : lit(n.arguments[1]);
    // блок, где стоит вызов: что идёт после него (пишет поля того же бота / флаги / журнал — исполнение «как будто принято»)
    let blk = null, idx = -1; for (let i = anc.length - 2; i >= 0; i--) { const a = anc[i]; if ((a.type === 'BlockStatement' || a.type === 'Program') && a.body.includes(anc[i + 1])) { blk = a; idx = a.body.indexOf(anc[i + 1]); break; } }
    const after = [];
    if (blk) blk.body.slice(idx + 1).forEach(st => walk.simple(st, {
      AssignmentExpression(ae) { const L = src.slice(ae.left.start - (pre ? 13 : 0), ae.left.end - (pre ? 13 : 0)); if (who && L.startsWith(who + '.')) after.push(L); else if (/^(K\.)?(tt|ts|teamTac|nadeFlags|T0|TT)\b/.test(L)) after.push(L); },
      CallExpression(ce) { if (ce.callee.type === 'Identifier' && /^(logEvent|voiceLog|teamNotice|knowCall)$/.test(ce.callee.name)) after.push(ce.callee.name + '()'); } }));
    // одноразовая: под условием, чьё тело ставит флаг, который условие проверяет
    let once = false;
    for (let i = anc.length - 2; i >= 0 && !once; i--) { const a = anc[i]; if (a.type !== 'IfStatement') continue;
      const test = src.slice(a.test.start - (pre ? 13 : 0), a.test.end - (pre ? 13 : 0)), body = src.slice(a.consequent.start - (pre ? 13 : 0), a.consequent.end - (pre ? 13 : 0));
      const flags = [...test.matchAll(/([\w$.]+\.(?:_\w+|\w+Done|\w+Flag)|nadeFlags\[[^\]]+\])/g)].map(m => m[1]);
      if (flags.some(fl => new RegExp(fl.replace(/[.[\]$]/g, '\\$&') + '\\s*=[^=]').test(body))) once = true; }
    sites.push({ key: G.fileId(f) + ' · ' + fn + ' · ' + owner, file: f, line: n.loc.start.line - pre, fn, owner, tag, who, after: [...new Set(after)].slice(0, 6), once });
  });
}
// (2) по ключу — данные прогонов и категория
const out = {};
for (const k of Object.keys(KNOWN)) {
  const S = sites.filter(s => s.key === k), [file, fn, owner] = k.split(' · '), d = DYN[owner + ' · ' + fn] || null;
  const conf = S.map(s => CONFIRMED[s.tag.replace(/…$/, '')]).find(Boolean);
  const anyAfter = S.some(s => s.after.length), anyOnce = S.some(s => s.once);
  const mech = owner === 'setPost' ? 'арбитр места (setPost): отказ, если у бота задача уровня не ниже (TASK_LEVEL) или отклонение / защита от дёрганья; бот продолжает прежнюю задачу'
                                   : 'хозяин гранат (assignNade): отказ — занят заданием, нет гранаты, план гранат, своя граната уже летит / дым стоит; задание не ставится';
  let cat, why;
  if (conf) { cat = 'подтверждённая ошибка'; why = conf; }
  else if (!d || !d.calls) { cat = 'недостаточно данных'; why = 'место не вызывалось в прогонах (' + runs.length + ' матч.)'; }
  else if (!d.refused) { cat = 'недостаточно данных'; why = 'отказов не было в ' + d.calls + ' вызовах — последствия отказа не наблюдались'; }
  else {
    const ag = d.again / d.refused, lt = d.later / d.refused;
    if (ag >= 0.95 && !anyAfter && !anyOnce) { cat = 'намеренное'; why = 'заявка повторяется (за 1 с после отказа — ' + Math.round(ag * 100) + ' %), пока арбитр не пустит: отказ значит «не сейчас»; код после вызова от ответа не зависит'; }
    else { cat = 'потенциально ошибочное'; why = [anyOnce ? 'заявка одноразовая (под флагом, который ставится рядом) — после отказа не повторяется' : '',
      anyAfter ? 'после вызова исполнение идёт как при успехе: ' + [...new Set(S.flatMap(s => s.after))].slice(0, 4).join(', ') : '',
      ag < 0.95 ? 'повтор заявки за 1 с — ' + Math.round(ag * 100) + ' % отказов' : ''].filter(Boolean).join('; ') + '; доказательства ошибки (эпизода с неверным поведением) нет'; }
  }
  out[k] = { category: cat, why, mechanism: mech, consequence: d && d.refused ? 'отказов ' + d.refused + ' из ' + d.calls + '; получил задачу за 5 с после отказа — ' + Math.round(d.later / d.refused * 100) + ' %; причины: ' + Object.entries(d.why).map(([w, n]) => w + ' ' + n).join(', ') : '—',
    sites: S.map(s => ({ line: s.file + ':' + s.line, tag: s.tag, once: s.once, after: s.after })), places: KNOWN[k] };
}
fs.writeFileSync(path.join(ROOT, 'rebuild', 'unread_classified.json'), JSON.stringify({ _: 'вопрос 16: классификация мест с непрочитанным ответом хозяина (tools/rebuild/unread_classify.js); прогоны: ' + runs.map(r => path.basename(r)).join(', '), sites: out }, null, 1) + '\n');
const by = {}; Object.values(out).forEach(o => { by[o.category] = (by[o.category] || 0) + o.places; });
let md = '# Непрочитанный ответ хозяина: 124 места по категориям (вопрос 16, 26.11)\n\nМеханизм отказа, последствие (по прогонам `tools/rebuild/unread_dyn.js`), дальнейшее исполнение — у каждого ключа (файл · функция · хозяин); полные данные — `rebuild/unread_classified.json`. Поведение не менялось; исправление — отдельными задачами после Р8. Без доказательства ошибкой не считается.\n\nИтог (мест): ' + Object.entries(by).map(([c, n]) => c + ' — ' + n).join(', ') + '. Прогоны: ' + runs.map(r => '`' + path.basename(r) + '`').join(', ') + '.\n\n| место | мест | категория | почему | последствие отказа |\n|---|---|---|---|---|\n';
for (const [k, o] of Object.entries(out).sort((a, b) => a[1].category.localeCompare(b[1].category))) md += '| `' + k + '` | ' + o.places + ' | ' + o.category + ' | ' + o.why.replace(/\|/g, '/') + ' | ' + o.consequence.replace(/\|/g, '/') + ' |\n';
fs.writeFileSync(path.join(ROOT, 'rebuild', 'UNREAD_CLASSIFIED.md'), md);
console.log(Object.entries(by).map(([c, n]) => c + ': ' + n).join('; '));
