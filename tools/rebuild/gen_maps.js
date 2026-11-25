// Перестройка, фаза 2: карты устройства — генерируются, а не пишутся руками (rebuild/RULES.md п. 8). Игру не меняет (только читает исходник).
// Запуск: NODE_PATH=/opt/node-tools/node_modules node tools/rebuild/gen_maps.js   → rebuild/gen/
//   registry.json / registry.md  — реестр решений: каждая пометка «(vNNN…)» / «(В…)» / «(15.11…)» в коде — файл, строка, функция, система,
//                                  слова владельца / отметка; дубли (одна пометка в нескольких местах)
//   fields.md                    — кто пишет поля бота (facing, walking, curSpeed, post, state, nadeTask, holding, crouching, path, фаза плана):
//                                  функция и файл, сколько мест; хозяин по CLAUDE.md §7 — отдельно, остальные — «в обход хозяина»
//   tick.md                      — порядок тика: что вызывает stepTick (и frame), по порядку, с условием
"use strict";
const acorn = require("acorn"), walk = require("acorn-walk"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..", ".."), GAME = path.join(ROOT, "src", "game"), OUT = path.join(ROOT, "rebuild", "gen");
// --check: только проверка владения (сборка, src/build.py) — ничего не пишет; нарушение поля с enforce — код выхода 1
const CHECK = process.argv.includes("--check");
let VARS_CROSS = [], VARS_CATS = {}, STATE_G = null;   // (17.11) для проверок сборки (раздел 4 → проверка в конце)
if (!CHECK) fs.mkdirSync(OUT, { recursive: true });
const save = (f, s) => { if (!CHECK) fs.writeFileSync(f, s); };

// ---- склейка как src/gamesrc.py, с границами файлов
// (Р1.1) .ts — без типов, позиции те же (tools/rebuild/game_src.js — одно место чтения исходника)
const GS = require("./game_src.js"), files = GS.gameFiles(GAME);
let { all, spans } = GS.concat(GAME);
const fileAt = pos => { for (const sp of spans) if (pos >= sp[0] && pos < sp[1]) return sp; return spans[spans.length - 1]; };
const lineAt = pos => { const sp = fileAt(pos); return all.slice(sp[0], pos).split("\n").length; };
const where = pos => fileAt(pos)[2] + ":" + lineAt(pos);

// ---- блоки <script> (основной скрипт — один большой блок)
const blocks = [];
for (const m of all.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) blocks.push({ off: m.index + m[0].indexOf(">") + 1, src: m[1] });
const tops = [];   // функции верхнего уровня: имя, начало, конец (в координатах склейки)
const asts = [];
for (const b of blocks) {
  const src = b.src.replace(/@@[A-Z_]+@@/g, m => "0".padEnd(m.length, " "));
  let ast; try { ast = acorn.parse(src, { ecmaVersion: "latest", allowReturnOutsideFunction: true, onComment: (block, text, s, e) => (b.comments || (b.comments = [])).push([text, s + b.off]) }); } catch (e) { continue; }
  asts.push({ ast, off: b.off, src });
  const body = [];
  for (const st of ast.body) {
    body.push(st);
    if (st.type === "ExpressionStatement" && st.expression.type === "CallExpression" && /Function/.test(st.expression.callee.type)) body.push(...st.expression.callee.body.body);
  }
  for (const st of body) if (st.type === "FunctionDeclaration") tops.push({ name: st.id.name, s: st.start + b.off, e: st.end + b.off });
}
tops.sort((a, b) => a.s - b.s);
const fnAt = pos => { let r = null; for (const t of tops) if (pos >= t.s && pos < t.e) r = t; return r ? r.name : "(верх файла)"; };
// комментарий вне функции — к функции сразу под ним (между ними только комментарии и пустые строки), иначе «(верх файла)»
const fnFor = pos => { const n = fnAt(pos); if (n !== "(верх файла)") return n; const t = tops.find(x => x.s > pos);
  if (t && /^[^\n]*(\n\s*(\/\/[^\n]*)?)*\s*$/.test(all.slice(pos, t.s))) return t.name; return n; };

// ---- системы: файл → канал (по таблице «Где что» CLAUDE.md §11 и плану фазы 3: взгляд → место → гранаты → бой → ход)
const SYS = [
  [/^535/, "ход"], [/^545/, "наблюдение"], [/^495/, "бой"], [/^(365|366|385)/, "гранаты"], [/^035/, "карта и видимость"],
  [/^(01|02|03|035|04|05)/, "карта и видимость"], [/^06/, "зоны"], [/^07/, "боты, оружие"], [/^08/, "числа BAL"], [/^09/, "игроки, команды"],
  [/^10/, "место"], [/^11/, "место"], [/^12/, "бомба"], [/^13/, "тактики T, память матча"], [/^14/, "место"], [/^15/, "тактики T"],
  [/^16/, "тактики T"], [/^17/, "мозг T"], [/^18/, "сейв, ретейк"], [/^(19|20|21|22|23|24)/, "знание и войс"], [/^(25|26|27)/, "взгляд"],
  [/^28/, "место"], [/^29/, "смоки"], [/^(30|31)/, "роли, про-позиции"], [/^(32|33)/, "эндгейм, клатч, ранний пик"], [/^34/, "мозг CT"],
  [/^35/, "реакция на контакт"], [/^(36|38|385|39|40|41|42)/, "гранаты"], [/^365/, "гранаты"], [/^366/, "гранаты"], [/^37/, "ход (уровни, лестницы, огонь)"],
  [/^43/, "взгляд"], [/^44/, "показ"], [/^45/, "бой"], [/^46/, "звук и ситуации"], [/^(47|48|49|495|50|51)/, "бой"], [/^52/, "экономика"],
  [/^53/, "раунд и стороны"], [/^535/, "ход"], [/^54/, "ход"], [/^545/, "наблюдение"], [/^645/, "наблюдение"], [/^(660|677|678)/, "режимы и инструменты"], [/^[5-9]/, "показ и инструменты"], [/^0/, "разметка"]];   // (17.11) журнал решений — наблюдение; разминка, песочница, демо — режимы игры, не показ
const sysOf = f => { const n = f.slice(0, 3); for (const [re, s] of SYS) if (re.test(n)) return s; return "?"; };

// ---- 1) реестр решений
const MARK = /\((?:v\d{3}[a-zа-я0-9]*|В\d{1,3}|[АБГДЖХ]\d{1,3}|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)[^)]{0,400}\)?/;
const reg = [];
for (const b of blocks) for (const [text, pos] of (b.comments || [])) {
  const t = text.replace(/\s+/g, " ").trim(); if (!MARK.test(t)) continue;
  const ver = (t.match(/\(?(v\d{3}[a-zа-я0-9]*|В\d{1,3}|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)/) || [])[1] || "";
  const f = fileAt(pos)[2];
  reg.push({ ver, file: f, line: lineAt(pos), fn: fnFor(pos), sys: sysOf(f), owner: /владел|отметк|«/.test(t), text: t.slice(0, 600) });
}
// склеить подряд идущие строки одного комментария (// … // …) в одну запись
const R = [];
for (const r of reg) { const p = R[R.length - 1];
  if (p && p.file === r.file && p.fn === r.fn && r.line === p.lineEnd + 1 && !MARK.test(r.text.slice(0, 12))) { p.text += " " + r.text; p.lineEnd = r.line; p.owner = p.owner || r.owner; continue; }
  R.push(Object.assign({ lineEnd: r.line }, r)); }
const byVer = {}; R.forEach(r => { if (r.ver) (byVer[r.ver] = byVer[r.ver] || []).push(r); });
save(path.join(OUT, "registry.json"), JSON.stringify(R, null, 0));
{
  const bySys = {}; R.forEach(r => (bySys[r.sys] = bySys[r.sys] || []).push(r));
  let md = "# Реестр решений (генерируется: `tools/rebuild/gen_maps.js`)\n\nКаждая пометка в коде (`(vNNN …)`, `(ВNN …)`, `(дата …)`) — запись: где (файл:строка, функция), система, есть ли слова владельца / отметка.\n" +
    "Полный список — `registry.json` (поля: ver, file, line, fn, sys, owner, text). Дубли и противоречия решаются с владельцем — до переноса каналов.\n\n";
  md += "| система | пометок | со словами владельца / отметкой | функций с пометками |\n|---|---|---|---|\n";
  Object.entries(bySys).sort((a, b) => b[1].length - a[1].length).forEach(([s, L]) => { md += "| " + s + " | " + L.length + " | " + L.filter(r => r.owner).length + " | " + new Set(L.map(r => r.fn)).size + " |\n"; });
  md += "| **всего** | **" + R.length + "** | **" + R.filter(r => r.owner).length + "** | **" + new Set(R.map(r => r.file + r.fn)).size + "** |\n";
  const multi = Object.entries(byVer).filter(([v, L]) => new Set(L.map(r => r.sys)).size >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 40);
  md += "\n## Одна версия — в трёх и более системах (кандидаты: одно решение, размазанное по каналам)\n\n| версия | мест | систем | системы |\n|---|---|---|---|\n";
  multi.forEach(([v, L]) => { const ss = [...new Set(L.map(r => r.sys))]; md += "| " + v + " | " + L.length + " | " + ss.length + " | " + ss.join(", ") + " |\n"; });
  const fnHot = {}; R.forEach(r => { const k = r.fn + " (" + r.file.slice(0, 3) + ")"; fnHot[k] = (fnHot[k] || 0) + 1; });
  md += "\n## Функции с больше всего пометками (где решения копятся)\n\n" + Object.entries(fnHot).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, n]) => "- `" + k + "` — " + n).join("\n") + "\n";
  save(path.join(OUT, "registry.md"), md);
}

// ---- 2) кто пишет поля бота
const FIELDS = ["facing", "walking", "curSpeed", "post", "_task", "_reposUntil", "_waitPopUntil", "_avoidPeekUntil", "_tradeUntil", "_tradeLock", "state", "nadeTask", "holding", "crouching", "path", "phase"];
// хозяева — rebuild/owners.json (одно место; его же читает проверка сборки); поля без хозяина — пусто
const OWN = JSON.parse(fs.readFileSync(path.join(ROOT, "rebuild", "owners.json"), "utf8"));
const OWNER = {}; FIELDS.forEach(f => { OWNER[f] = OWN[f] ? new RegExp("^(" + OWN[f].allow.join("|") + ")$") : /^$/; });
// канал может быть набором файлов (гранаты — 360–420): files — номера файлов канала, запись из любой их функции — своя;
// функция из чужого файла, но в allow (интерфейс канала) — тоже своя
const OWNF = {}; FIELDS.forEach(f => { OWNF[f] = new Set((OWN[f] && OWN[f].files) || []); });
const isOwn = (fl, k) => { const [fn, ff] = k.split(" · "); return OWNER[fl].test(fn) || OWNF[fl].has(ff); };
const W = {}, WO = {}; FIELDS.forEach(f => { W[f] = {}; WO[f] = {}; });
// (15.11, замечание владельца) одно имя поля у разных объектов: bot.state ≠ bomb.state ≠ редактор.state. Объект — бот, если в той же
// функции у этого имени читают поля, какие есть только у бота (BOTP); `bots[i].x` — бот; остальное — «другой объект» (чей — по имени).
const BOTP = new Set(["alive", "hp", "tRole", "team", "weapon", "baseX", "baseY", "nades", "primary", "money", "reactionTicks", "skill"]);
const BOTW = {}, BOTL = {}, BOTR = {}, PROPS = new Map();   // (Р3.1) все поля бота: записи (файл:строка функция) и литералы создания — для реестра состояния
const rootOf = e => { while (e && e.type === "MemberExpression") { if (e.object.type === "Identifier" && e.object.name === "bots" && e.computed) return "#bot"; e = e.object; } return e && e.type === "Identifier" ? e.name : e && e.type === "ThisExpression" ? "this" : null; };
for (const { ast, off } of asts) walk.fullAncestor(ast, (n, _st, anc) => {
  let tgt = null;
  if (n.type === "AssignmentExpression") tgt = n.left; else if (n.type === "UpdateExpression") tgt = n.argument;
  if (!tgt || tgt.type !== "MemberExpression" || tgt.computed) return;
  const fld = tgt.property.name, pos = n.start + off, fn = fnAt(pos), f = fileAt(pos)[2];
  const objTxt = all.slice(tgt.object.start + off, tgt.object.end + off);
  const FLD = FIELDS.includes(fld);   // (Р3.1) остальные поля — только в реестр состояния (BOTW), в fields.md и проверку владения не идут
  if (FLD && fld === "phase") { if (!/tt|tac|teamTac|T0|TT/.test(objTxt)) return; (W[fld][fn + " · " + f.slice(0, 3)] = W[fld][fn + " · " + f.slice(0, 3)] || []).push(lineAt(pos)); return; }   // фаза плана T
  const root = tgt.object.type === "Identifier" ? tgt.object.name : rootOf(tgt.object);
  const NONBOT = new Set(["bomb", "it", "S", "RP", "HGT_C", "E", "MAPED", "DEMOV", "SANDBOX"]), BOTN = new Set(["b", "bot", "bt", "sh", "shooter", "target", "vic", "victim", "att", "killer", "mate"]);
  let isBot = !NONBOT.has(root) && (root === "#bot" || /^bots\[/.test(objTxt) || BOTN.has(root));
  // параметр обхода bots.forEach / filter / … — бот
  if (!isBot && !NONBOT.has(root)) for (let i = anc.length - 1; i >= 1; i--) { const a = anc[i], c = anc[i - 1];
    if (/Function/.test(a.type) && c.type === "CallExpression" && c.callee.type === "MemberExpression" && c.callee.object.type === "Identifier" && c.callee.object.name === "bots" && a.params.some(q => q.name === root)) { isBot = true; break; } }
  if (!isBot && !NONBOT.has(root) && tgt.object.type === "Identifier") {
    const fnNode = [...anc].reverse().find(a => /Function/.test(a.type)) || ast;
    let pm = PROPS.get(fnNode); if (!pm) PROPS.set(fnNode, pm = new Map());   // (Р3.1) кэш: поля по имени объекта в функции
    if (!pm.has(root)) { const props = new Set();
      walk.simple(fnNode, { MemberExpression(m) { if (!m.computed && m.object.type === "Identifier" && m.object.name === root) props.add(m.property.name); } });
      pm.set(root, [...props].some(p => BOTP.has(p))); }
    isBot = pm.get(root);
  }
  const k = fn + " · " + f.slice(0, 3);
  if (isBot) (BOTW[fld] = BOTW[fld] || []).push(f + ":" + lineAt(pos) + " " + fn);
  if (!FLD) return;
  const T = isBot ? W : WO;
  (T[fld][k] = T[fld][k] || []).push(lineAt(pos) + (isBot ? "" : " " + objTxt.slice(0, 24)));
});
// (Р3.1) поля, которые читают у объекта, который точно бот (имя из BOTN, bots[i]): пишут их и через другие имена (cm, best, o) —
// эвристика записи их теряет; для реестра поле бота = записано у бота, или задано при создании, или читается у бота
const BUILTIN = new Set([].concat(Object.getOwnPropertyNames(Array.prototype), Object.getOwnPropertyNames(String.prototype), Object.getOwnPropertyNames(Object.prototype)));
const BOTN0 = new Set(["b", "bot", "bt", "sh", "shooter", "target", "vic", "victim", "att", "killer", "mate"]);
for (const { ast, off } of asts) walk.fullAncestor(ast, (m, _s, anc) => {
  if (m.type !== "MemberExpression" || m.computed || m.property.type !== "Identifier") return;
  const o = m.object, isB = (o.type === "Identifier" && BOTN0.has(o.name)) || (o.type === "MemberExpression" && o.computed && o.object.type === "Identifier" && o.object.name === "bots");
  if (!isB || BUILTIN.has(m.property.name)) return; const pos = m.start + off; if (+fileAt(pos)[2].slice(0, 3) >= 550) return;   // показ зовёт «b» и не бота
  BOTR[m.property.name] = (BOTR[m.property.name] || 0) + 1;
});
// (Р3.1) поля бота, заданные при создании (литерал объекта с полями, какие есть только у бота) — тоже поля бота, даже если потом не пишутся
for (const { ast, off } of asts) walk.simple(ast, { ObjectExpression(o) {
  const keys = o.properties.filter(q => q.type === "Property" && !q.computed && q.key).map(q => q.key.name || q.key.value);
  if (keys.filter(k => BOTP.has(k)).length < 3) return;
  const pos = o.start + off; keys.forEach(k => { (BOTL[k] = BOTL[k] || []).push(fileAt(pos)[2] + ":" + lineAt(pos)); });
} });
{
  let md = "# Кто пишет поля бота (генерируется: `tools/rebuild/gen_maps.js`, статический разбор кода)\n\n" +
    "Запись — присваивание `бот.поле = …` / `++` в функции (файл — номер); то же имя у другого объекта (бомба, редактор, смок выхода) — отдельно. Хозяин — по CLAUDE.md §7; у полей без хозяина его пока нет (назначит перенос каналов).\n" +
    "Живой ловец (кто пишет во время матча, со стеком) — `tools/measure/engine/field_watch.js`.\n\n| поле | мест | функций | из них хозяин |\n|---|---|---|---|\n";
  FIELDS.forEach(fl => { const E = Object.entries(W[fl]); const own = E.filter(([k]) => isOwn(fl, k));
    md += "| `" + fl + "` | " + E.reduce((a, [, L]) => a + L.length, 0) + " | " + E.length + " | " + (own.map(([k]) => "`" + k + "`").join(", ") || "—") + " |\n"; });
  FIELDS.forEach(fl => { const E = Object.entries(W[fl]).sort((a, b) => b[1].length - a[1].length), O = Object.entries(WO[fl]);
    md += "\n## `" + fl + "`\n\n" + E.map(([k, L]) => "- " + (isOwn(fl, k) ? "**хозяин** " : "") + "`" + k + "` — " + L.length + " (стр. " + L.slice(0, 8).join(", ") + (L.length > 8 ? ", …" : "") + ")").join("\n") + "\n";
    if (O.length) md += "\nне бот (то же имя у другого объекта — в проверку владения не идёт): " + O.map(([k, L]) => "`" + k + "` (" + L.slice(0, 3).join("; ") + ")").join(", ") + "\n"; });
  save(path.join(OUT, "fields.md"), md);
}

// ---- 3) порядок тика
// ---- 5) граф зависимостей (вариант А, владелец 15.11: модули — по каналу в фазе 3, сейчас — свои проверки по склейке):
// система → какие системы она использует (вызов функции / чтение / запись имени верхнего уровня, объявленного в другом файле).
// Запрет: симуляция не трогает показ (DEVICE.md §5) — обращения симуляции к именам показа выводятся предупреждениями (--check).
// Приближение: локальная переменная с тем же именем, что и общее имя, считается обращением к общему (таких мало; для графа хватает).
{
  const main = asts.reduce((a, b) => (b.src.length > a.src.length ? b : a));
  let body = main.ast.body; const iife = body.find(st => st.type === "ExpressionStatement" && st.expression.type === "CallExpression" && /Function/.test(st.expression.callee.type));
  if (iife) body = body.concat(iife.expression.callee.body.body);
  const HOME = {};   // имя → файл
  body.forEach(st => {
    if (st.type === "FunctionDeclaration") HOME[st.id.name] = fileAt(st.start + main.off)[2];
    if (st.type === "VariableDeclaration") st.declarations.forEach(d => { if (d.id.type === "Identifier") HOME[d.id.name] = fileAt(st.start + main.off)[2]; });
  });
  const SHOW = new Set(["показ", "показ и инструменты"]), OUTSIDE = new Set(["разметка", "наблюдение", "режимы и инструменты"]);
  const isSim = f => !SHOW.has(sysOf(f)) && !OUTSIDE.has(sysOf(f));
  // локальные имена функции: параметры, var / let / const, вложенные function, catch (вложенные функции тоже — с запасом)
  const WRAP = iife ? iife.expression.callee : null;   // обёртка всей игры — её имена и есть общие
  const LOC = new WeakMap(), pid = (q, S) => { if (!q) return; if (q.type === "Identifier") S.add(q.name); else if (q.type === "AssignmentPattern") pid(q.left, S);
    else if (q.type === "RestElement") pid(q.argument, S); else if (q.type === "ArrayPattern") q.elements.forEach(e => pid(e, S)); else if (q.type === "ObjectPattern") q.properties.forEach(e => pid(e.value || e.argument, S)); };
  const localsOf = fnN => { let S = LOC.get(fnN); if (S) return S; S = new Set(); fnN.params.forEach(q => pid(q, S));
    walk.simple(fnN.body, { VariableDeclarator(d) { pid(d.id, S); }, FunctionDeclaration(f) { if (f.id) S.add(f.id.name); }, CatchClause(c) { pid(c.param, S); } });
    LOC.set(fnN, S); return S; };
  const E = {}, S2V = {};   // E[из][в] = мест; S2V[имя] = {файл: мест, kind}
  walk.fullAncestor(main.ast, (n, _s, anc) => {
    if (n.type !== "Identifier" || !HOME[n.name]) return; const p = anc[anc.length - 2]; if (!p) return;
    if ((p.type === "VariableDeclarator" && p.id === n) || (p.type === "FunctionDeclaration" && p.id === n)) return;
    if ((p.type === "MemberExpression" && p.property === n && !p.computed) || (p.type === "Property" && p.key === n && !p.computed)) return;
    if (/Function/.test(p.type) && p.params && p.params.includes(n)) return;
    for (let i = anc.length - 2; i >= 0; i--) if (/Function/.test(anc[i].type) && anc[i] !== WRAP && localsOf(anc[i]).has(n.name)) return;   // своё локальное имя
    const from = fileAt(n.start + main.off)[2], to = HOME[n.name]; if (from === to) return;
    const a = sysOf(from), b = sysOf(to); if (a !== b) { E[a] = E[a] || {}; E[a][b] = (E[a][b] || 0) + 1; }
    if (isSim(from) && SHOW.has(b) && !(OWN._show_marks || []).includes(n.name)) { const k = n.name, w = (p.type === "AssignmentExpression" && p.left === n) || p.type === "UpdateExpression";
      const x = S2V[k] = S2V[k] || { home: to.slice(0, 3), from: {}, write: false, call: false };
      x.from[from.slice(0, 3)] = (x.from[from.slice(0, 3)] || 0) + 1; if (w) x.write = true; if (p.type === "CallExpression" && p.callee === n) x.call = true; }
  });
  const sim2show = Object.entries(S2V).sort((a, b) => Object.values(b[1].from).reduce((s, v) => s + v, 0) - Object.values(a[1].from).reduce((s, v) => s + v, 0));
  if (CHECK) {
    // (17.11) запрет включён (owners.json "_show_ban": true) — обращение игры к показу останавливает сборку
    if (sim2show.length && OWN._show_ban) { console.error("ОШИБКА: симуляция трогает показ — " + sim2show.map(([k, v]) => k + " ← " + Object.keys(v.from).join(",")).join(", ")); process.exit(1); }
    if (sim2show.length) console.log("симуляция трогает показ — предупреждения (" + sim2show.length + " имён показа; запрет станет ошибкой после переноса):\n  " +
      sim2show.map(([k, v]) => k + (v.write ? " (пишет)" : v.call ? "()" : "") + " ← " + Object.keys(v.from).join(",")).join(", "));
  } else {
    const sys = [...new Set(Object.keys(E).concat(...Object.values(E).map(o => Object.keys(o))))].sort();
    let md = "# Граф зависимостей систем (генерируется: `tools/rebuild/gen_maps.js`, по склейке)\n\n" +
      "Строка — кто использует, столбец — чьё (функция / переменная верхнего уровня из файла этой системы), число — мест в коде. " +
      "Модули с `import` / `export` — по каналу в фазе 3 (вариант А, владелец 15.11); до того граф и запреты — этим скриптом.\n\n";
    md += "| использует ↓ / чьё → | " + sys.join(" | ") + " |\n|" + "---|".repeat(sys.length + 1) + "\n";
    sys.forEach(a => { md += "| **" + a + "** | " + sys.map(b => (E[a] && E[a][b]) || "").join(" | ") + " |\n"; });
    md += "\n## Запрет «симуляция не трогает показ» — нарушения сейчас (" + sim2show.length + " имён)\n\n" +
      "Пишет — симуляция меняет переменную показа; `()` — вызывает функцию показа; иначе читает. Цель — симуляция только отмечает событие, показ рисует (`DEVICE.md` §5).\n\n" +
      "| имя показа | файл | из файлов симуляции (мест) | как |\n|---|---|---|---|\n";
    sim2show.forEach(([k, v]) => { md += "| `" + k + "` | " + v.home + " | " + Object.entries(v.from).map(([f, c]) => f + "×" + c).join(" ") + " | " + (v.write ? "пишет" : v.call ? "вызывает" : "читает") + " |\n"; });
    save(path.join(OUT, "deps.md"), md);
    console.log("граф: систем", sys.length, "| симуляция трогает имён показа", sim2show.length);
  }
}

function callOrder(fnName) {
  const t = tops.find(x => x.name === fnName); if (!t) return [];
  const { ast, off } = asts.find(a => t.s >= a.off && t.e <= a.off + a.src.length);
  let node = null; walk.full(ast, n => { if (n.type === "FunctionDeclaration" && n.id.name === fnName) node = n; });
  const out = [];
  function cond(n, depth, pre) {
    walk.recursive(n, { d: depth, c: pre }, {
      CallExpression(c, st, go) { const callee = c.callee.type === "Identifier" ? c.callee.name : c.callee.type === "MemberExpression" && !c.callee.computed ? (c.callee.object.name || "…") + "." + c.callee.property.name : null;
        if (callee && tops.some(x => x.name === callee)) out.push({ fn: callee, at: lineAt(c.start + off), d: st.d, c: st.c });
        go(c.callee, st); c.arguments.forEach(a => go(a, st)); },
      IfStatement(s, st, go) { const tx = all.slice(s.test.start + off, s.test.end + off).replace(/\s+/g, " ").slice(0, 70);
        go(s.test, st); go(s.consequent, { d: st.d + 1, c: "если " + tx }); if (s.alternate) go(s.alternate, { d: st.d + 1, c: "иначе (" + tx + ")" }); },
      ForStatement(s, st, go) { go(s.body, { d: st.d + 1, c: "цикл" }); },
      FunctionExpression(f, st, go) { go(f.body, { d: st.d + 1, c: "в обходе (forEach и т.п.)" }); },
    });
  }
  cond(node.body, 0, "");
  return out;
}
{
  let md = "# Порядок тика (генерируется: `tools/rebuild/gen_maps.js`)\n\nЧто вызывает `stepTick` по порядку исходника (функции игры; отступ — внутри условия / обхода ботов).\n" +
    "Это порядок вызовов в коде, а не замер: что срабатывает в тике — по условиям. Слои фазы 2 (знания → намерения → согласование → исполнители → физика) — в «Устройстве».\n\n";
  const seen = new Set();
  callOrder("stepTick").forEach(c => { const k = c.fn + c.c; if (seen.has(k)) return; seen.add(k);
    const t = tops.find(x => x.name === c.fn); md += "  ".repeat(c.d) + "- `" + c.fn + "` (" + fileAt(t.s)[2].slice(0, 3) + ")" + (c.c ? " — " + c.c.replace(/\|/g, "/") : "") + "\n"; });
  save(path.join(OUT, "tick.md"), md);
}
console.log("пометок", R.length, "| полей", FIELDS.map(f => f + ":" + Object.keys(W[f]).length).join(" "), "| функций", tops.length);

// ---- 4) общие переменные: где объявлена, кто пишет, кто читает (по файлам) — для категорий (владелец 15.11: канал / мир / раунд /
// кэш / временное; хозяин — по смыслу, не по файлу). Категория — из rebuild/var_cats.json (ставится руками), без неё — «?».
{
  const main = asts.reduce((a, b) => (b.src.length > a.src.length ? b : a));
  let body = main.ast.body; const iife = body.find(st => st.type === "ExpressionStatement" && st.expression.type === "CallExpression" && /Function/.test(st.expression.callee.type));
  if (iife) body = body.concat(iife.expression.callee.body.body);
  const V = {};
  const DECL = {};   // (Р3.1) реестр состояния: где объявлена (файл:строка)
  body.forEach(st => { if (st.type === "VariableDeclaration") st.declarations.forEach(d => { if (d.id.type === "Identifier") { V[d.id.name] = { home: fileAt(st.start + main.off)[2].slice(0, 3), w: {}, r: {} }; DECL[d.id.name] = { at: where(d.start + main.off), init: d.init ? d.init.type : null, wf: {}, mf: {} }; } }); });
  // (Р3.1) изменение содержимого: X.a = …, X.a++, delete X.a, X.push(…) / splice / set / add / … — запись в объект переменной, не в имя
  const MUT = /^(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin|set|add|delete|clear)$/;
  const memRoot = e => { while (e && e.type === "MemberExpression") e = e.object; return e && e.type === "Identifier" ? e.name : null; };
  walk.fullAncestor(main.ast, (n, _s, anc) => {
    if (n.type !== "Identifier" || !V[n.name]) return; const p = anc[anc.length - 2]; if (!p) return;
    if (p.type === "VariableDeclarator" && p.id === n) return;
    if ((p.type === "MemberExpression" && p.property === n && !p.computed) || (p.type === "Property" && p.key === n && !p.computed)) return;
    const pos = n.start + main.off, f = fileAt(pos)[2].slice(0, 3);
    const isW = (p.type === "AssignmentExpression" && p.left === n) || (p.type === "UpdateExpression");
    const T = isW ? V[n.name].w : V[n.name].r; T[f] = (T[f] || 0) + 1;
    if (isW) { const k = fnAt(pos) + " · " + f; DECL[n.name].wf[k] = (DECL[n.name].wf[k] || 0) + 1; }
  });
  walk.fullAncestor(main.ast, (n) => {
    let tgt = null;
    if (n.type === "AssignmentExpression" || n.type === "UpdateExpression") tgt = n.type === "AssignmentExpression" ? n.left : n.argument;
    else if (n.type === "UnaryExpression" && n.operator === "delete") tgt = n.argument;
    else if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed && MUT.test(n.callee.property.name)) tgt = n.callee.object;
    if (!tgt || (tgt.type !== "MemberExpression" && n.type !== "CallExpression")) return;
    const r = memRoot(tgt); if (!r || !DECL[r]) return;
    const pos = n.start + main.off, k = fnAt(pos) + " · " + fileAt(pos)[2].slice(0, 3); DECL[r].mf[k] = (DECL[r].mf[k] || 0) + 1;
  });
  STATE_G = { V, DECL };
  let cats = {}; try { cats = JSON.parse(fs.readFileSync(path.join(ROOT, "rebuild", "var_cats.json"), "utf8")); } catch (e) {}
  VARS_CATS = cats;
  const cross = VARS_CROSS = Object.entries(V).filter(([k, v]) => Object.keys(v.w).some(f => f !== v.home)).sort((a, b) => Object.keys(b[1].w).length - Object.keys(a[1].w).length);
  let md = "# Общие переменные, которые пишут из чужих файлов (генерируется: `tools/rebuild/gen_maps.js`)\n\nВсего переменных верхнего уровня: " +
    Object.keys(V).length + ", из них пишут не только в своём файле: **" + cross.length + "**. Категория и хозяин — по смыслу (`rebuild/var_cats.json`):\n" +
    "канал (взгляд / место / гранаты / бой / ход / знание), мир (карта, навмеш, видимость), раунд (тик, состояние раунда, бомба, счёт), кэш, временное, показ.\n\n" +
    "| переменная | объявлена | пишут (файл×мест) | читают файлов | категория | хозяин | почему |\n|---|---|---|---|---|---|---|\n";
  cross.forEach(([k, v]) => { const c = cats[k] || {}; md += "| `" + k + "` | " + v.home + " | " + Object.entries(v.w).map(([f, n]) => f + "×" + n).join(" ") + " | " + Object.keys(v.r).length + " | " + (c.cat || "?") + " | " + (c.owner || "") + " | " + (c.why || "") + " |\n"; });
  save(path.join(OUT, "vars.md"), md);
  save(path.join(OUT, "vars.json"), JSON.stringify(Object.fromEntries(cross.map(([k, v]) => [k, v]))));
  console.log("общих переменных", Object.keys(V).length, "из чужих файлов пишут", cross.length);
}

// ---- (Р3.1, 25.11) реестр состояния — машинная часть: каждая общая переменная (объявление, кто пишет имя, кто меняет содержимое, кто
// читает, в снимке ли сейчас и почему нет) и каждое поле бота (кто пишет, где задаётся при создании). Смысловая разметка (класс, хозяин,
// срок жизни, политика снимка) — отдельно, rebuild/state_classes.json; неизвестное там «не размечено», а не догадка (владелец 25.11).
// Снимок «сейчас» — src/marks_build.py snap_vars (одно место); на --check не считается (только проверка полноты).
const stateNames = () => ({ g: Object.keys(STATE_G.DECL), b: [...new Set(Object.keys(BOTW).concat(Object.keys(BOTL), Object.keys(BOTR)))] });
if (!CHECK) {
  let snap = null, why = {};
  try {
    const py = process.env.SIM_PY || (process.platform === "win32" ? "python" : "python3");
    const out = require("child_process").execFileSync(py, ["-c", "import sys, json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "src")) + "); import marks_build as M; from gamesrc import game_source; " +
      "s = game_source(); print(json.dumps({'snap': M.snap_vars(s), 'why': M.snap_policy()}))"], { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
    const J = JSON.parse(out); snap = new Set(J.snap); for (const [k, w] of Object.entries(J.why)) if (String(w).startsWith("нет")) why[k] = w;
  } catch (e) { console.error("реестр состояния: список снимка не получен (" + String(e.message).slice(0, 120) + ")"); }
  const srt = o => Object.fromEntries(Object.entries(o).sort());
  const G = {}; for (const [k, d] of Object.entries(STATE_G.DECL).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    const v = STATE_G.V[k];
    G[k] = { decl: d.at, init: d.init, w: srt(d.wf), m: srt(d.mf), r: srt(v.r),
      snap: !snap ? null : snap.has(k) ? true : (why[k] || (/^(__|MK|mk)/.test(k) ? "служебное снимка" : "?")) };
  }
  const B = {}; for (const k of stateNames().b.sort()) B[k] = { w: (BOTW[k] || []).slice().sort(), lit: (BOTL[k] || []).slice().sort(), r: BOTR[k] || 0 };
  save(path.join(OUT, "state.json"), JSON.stringify({ _: "реестр состояния, машинная часть (tools/rebuild/gen_maps.js); снимок сейчас: true — в __SNAP; строка — почему нет (колонка snap rebuild/state_classes.json через marks_build.snap_vars); поля бота — в снимке вместе с bots; рантайм-фильтры mkSnapList / mkSnapshot — tools/rebuild/state_snap.js", globals: G, bot: B }, null, 1));
  console.log("реестр состояния: переменных " + Object.keys(G).length + ", полей бота " + Object.keys(B).length);
}

// ---- (17.11, владелец: «чтобы нейронка не создавала новые файлы и дубли») защита устройства — ошибка сборки:
//   новый файл в src/game (нет в rebuild/files.json); новый замок _xxxUntil или новый файл, который пишет замок (owners.json _locks);
//   две функции с одним именем (в склейке вторая молча заменяет первую); общая переменная, которую пишет чужой файл, — без категории и
//   хозяина (rebuild/var_cats.json)
if (CHECK) {
  const G = [];
  let FL = []; try { FL = JSON.parse(fs.readFileSync(path.join(ROOT, "rebuild", "files.json"), "utf8")).files || []; } catch (e) {}
  files.filter(f => FL.indexOf(f) < 0).forEach(f => G.push("новый файл " + f + " — без согласия владельца нельзя (rebuild/files.json, ARCHITECTURE.md); код — в файл своей механики"));
  const LK = OWN._locks || {};
  spans.forEach(([a, b, f]) => { const t = all.slice(a, b); for (const m of t.matchAll(/\b\w+\.(_[A-Za-z]*Until)\s*=[^=]/g)) {
    const n = m[1], ff = f.slice(0, 3); if (!LK[n]) G.push("новый замок " + n + " (" + f + ") — срок решения держит хозяин канала, а не свой таймер");
    else if (LK[n].indexOf(ff) < 0) G.push("замок " + n + " пишет новый файл " + f + " — через интерфейс хозяина"); } });
  const seen = {}; tops.forEach(t => { const f = fileAt(t.s)[2]; if (seen[t.name] && seen[t.name] !== f) G.push("функция " + t.name + " — в двух файлах: " + seen[t.name] + " и " + f); else seen[t.name] = f; });
  VARS_CROSS.forEach(([k]) => { if (!(VARS_CATS[k] && VARS_CATS[k].cat)) G.push("общая переменная " + k + " пишется из чужого файла — сначала категория и хозяин (rebuild/var_cats.json) или интерфейс у хозяина"); });
  // (Р2.4, 25.11) общая математика: в коде расчёта (src/game до 550, кроме 005_dmath.ts) нет Math.sin / cos / tan / atan / atan2 / asin / acos /
  // exp / log / pow / hypot и прочих приближённых функций движка — только DM.* (одинаковые биты в любом браузере и в Rust). Ищется по
  // лексемам (комментарии и строки не считаются); Math.sqrt / abs / floor / ceil / round / trunc / min / max / imul / sign — точные, можно
  const APPROX = /^(sin|cos|tan|atan|atan2|asin|acos|exp|log|pow|hypot|sinh|cosh|tanh|asinh|acosh|atanh|expm1|log1p|log2|log10|cbrt|fround|random)$/;
  for (const b of blocks) {
    const toks = []; try { for (const t of acorn.tokenizer(b.src.replace(/@@[A-Z_]+@@/g, m => "0".padEnd(m.length, " ")), { ecmaVersion: "latest", allowReturnOutsideFunction: true })) toks.push(t); } catch (e) { continue; }
    for (let i = 0; i + 2 < toks.length; i++) {
      if (toks[i].type.label !== "name" || toks[i].value !== "Math" || toks[i + 1].type.label !== "." || !APPROX.test(String(toks[i + 2].value))) continue;
      const pos = b.off + toks[i].start, f = fileAt(pos)[2];
      if (+f.slice(0, 3) < 550 && f !== "005_dmath.ts") G.push("Math." + toks[i + 2].value + " в коде расчёта (" + where(pos) + ") — только DM." + toks[i + 2].value + " (src/game/005_dmath.ts, Р2)");
    }
  }
  if (G.length) { G.forEach(g => console.error("ОШИБКА устройства: " + g)); process.exit(1); }
}
// ---- (Р3.1, владелец 25.11) полнота реестра состояния — ошибка сборки: у каждой общей переменной и каждого поля бота есть строка
// смысловой разметки (rebuild/state_classes.json; новое имя — `python3 tools/rebuild/state_classes.py`, оно получит «не размечено» или
// класс по правилу с доказательством); класс — из списка файла; строки исчезнувших имён убираются
if (CHECK) {
  let SC = null; try { SC = JSON.parse(fs.readFileSync(path.join(ROOT, "rebuild", "state_classes.json"), "utf8")); } catch (e) { console.error("ОШИБКА реестра состояния: нет rebuild/state_classes.json"); process.exit(1); }
  const N = stateNames(), want = new Set(N.g.map(n => "g:" + n).concat(N.b.map(n => "b:" + n))), CL = new Set(SC._classes || []), E = [];
  for (const k of want) if (!SC[k]) E.push("нет строки " + k + " — новая переменная / поле бота: python3 tools/rebuild/state_classes.py, затем разметка");
  for (const [k, o] of Object.entries(SC)) { if (k[0] === "_") continue;
    if (!want.has(k) || o.gone) E.push("строка " + k + " — такого имени в коде больше нет: убрать из реестра (state_classes.py)");
    else if (!CL.has(o.class)) E.push("строка " + k + ": класс «" + o.class + "» не из списка _classes");
    else if (!o.snap || !o.cmp) E.push("строка " + k + ": нет политики снимка (snap) или сравнения (cmp) — реестр пересчитан не тем скриптом?"); }
  if (E.length) { E.slice(0, 30).forEach(e => console.error("ОШИБКА реестра состояния: " + e)); if (E.length > 30) console.error("… и ещё " + (E.length - 30)); process.exit(1); }
  const un = Object.entries(SC).filter(([k, o]) => k[0] !== "_" && o.class === "не размечено").length;
  console.log("реестр состояния: строк " + want.size + ", не размечено " + un);
}
// ---- проверка владения: запись поля из функции не из канала (owners.json → allow) — предупреждение, при enforce — ошибка
if (CHECK) {
  let bad = 0, warn = [];
  for (const fl of Object.keys(OWN).filter(k => k[0] !== "_")) {
    const E = Object.entries(W[fl]).filter(([k]) => !isOwn(fl, k));
    if (!E.length) continue;
    const n = E.reduce((a, [, L]) => a + L.length, 0), txt = "`" + fl + "` (" + OWN[fl].channel + "): " + n + " мест мимо хозяина — " + E.map(([k, L]) => k + "×" + L.length).join(", ");
    if (OWN[fl].enforce) { bad++; console.error("ОШИБКА владения " + txt); } else warn.push(txt);
  }
  if (warn.length) console.log("владение полей — предупреждения (" + warn.length + " полей, каналы ещё не перенесены):\n  " + warn.join("\n  "));
  process.exit(bad ? 1 : 0);
}

