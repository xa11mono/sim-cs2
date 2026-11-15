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
if (!CHECK) fs.mkdirSync(OUT, { recursive: true });
const save = (f, s) => { if (!CHECK) fs.writeFileSync(f, s); };

// ---- склейка как src/gamesrc.py, с границами файлов
const files = fs.readdirSync(GAME).filter(f => /\.(html|js)$/.test(f)).sort();
let all = "", spans = [];
for (const f of files) { const s = fs.readFileSync(path.join(GAME, f), "utf8"); spans.push([all.length, all.length + s.length, f]); all += s; }
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
  [/^53/, "раунд и стороны"], [/^535/, "ход"], [/^54/, "ход"], [/^545/, "наблюдение"], [/^[5-9]/, "показ и инструменты"], [/^0/, "разметка"]];
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
const FIELDS = ["facing", "walking", "curSpeed", "post", "state", "nadeTask", "holding", "crouching", "path", "phase"];
// хозяева — rebuild/owners.json (одно место; его же читает проверка сборки); поля без хозяина — пусто
const OWN = JSON.parse(fs.readFileSync(path.join(ROOT, "rebuild", "owners.json"), "utf8"));
const OWNER = {}; FIELDS.forEach(f => { OWNER[f] = OWN[f] ? new RegExp("^(" + OWN[f].allow.join("|") + ")$") : /^$/; });
const W = {}, WO = {}; FIELDS.forEach(f => { W[f] = {}; WO[f] = {}; });
// (15.11, замечание владельца) одно имя поля у разных объектов: bot.state ≠ bomb.state ≠ редактор.state. Объект — бот, если в той же
// функции у этого имени читают поля, какие есть только у бота (BOTP); `bots[i].x` — бот; остальное — «другой объект» (чей — по имени).
const BOTP = new Set(["alive", "hp", "tRole", "team", "weapon", "baseX", "baseY", "nades", "primary", "money", "reactionTicks", "skill"]);
const rootOf = e => { while (e && e.type === "MemberExpression") { if (e.object.type === "Identifier" && e.object.name === "bots" && e.computed) return "#bot"; e = e.object; } return e && e.type === "Identifier" ? e.name : e && e.type === "ThisExpression" ? "this" : null; };
for (const { ast, off } of asts) walk.fullAncestor(ast, (n, _st, anc) => {
  let tgt = null;
  if (n.type === "AssignmentExpression") tgt = n.left; else if (n.type === "UpdateExpression") tgt = n.argument;
  if (!tgt || tgt.type !== "MemberExpression" || tgt.computed || !FIELDS.includes(tgt.property.name)) return;
  const fld = tgt.property.name, pos = n.start + off, fn = fnAt(pos), f = fileAt(pos)[2];
  const objTxt = all.slice(tgt.object.start + off, tgt.object.end + off);
  if (fld === "phase") { if (!/tt|tac|teamTac|T0|TT/.test(objTxt)) return; (W[fld][fn + " · " + f.slice(0, 3)] = W[fld][fn + " · " + f.slice(0, 3)] || []).push(lineAt(pos)); return; }   // фаза плана T
  const root = tgt.object.type === "Identifier" ? tgt.object.name : rootOf(tgt.object);
  const NONBOT = new Set(["bomb", "it", "S", "RP", "HGT_C", "E", "MAPED", "DEMOV", "SANDBOX"]), BOTN = new Set(["b", "bot", "bt", "sh", "shooter", "target", "vic", "victim", "att", "killer", "mate"]);
  let isBot = !NONBOT.has(root) && (root === "#bot" || /^bots\[/.test(objTxt) || BOTN.has(root));
  // параметр обхода bots.forEach / filter / … — бот
  if (!isBot && !NONBOT.has(root)) for (let i = anc.length - 1; i >= 1; i--) { const a = anc[i], c = anc[i - 1];
    if (/Function/.test(a.type) && c.type === "CallExpression" && c.callee.type === "MemberExpression" && c.callee.object.type === "Identifier" && c.callee.object.name === "bots" && a.params.some(q => q.name === root)) { isBot = true; break; } }
  if (!isBot && !NONBOT.has(root) && tgt.object.type === "Identifier") {
    const fnNode = [...anc].reverse().find(a => /Function/.test(a.type)) || ast; const props = new Set();
    walk.simple(fnNode, { MemberExpression(m) { if (!m.computed && m.object.type === "Identifier" && m.object.name === root) props.add(m.property.name); } });
    isBot = [...props].some(p => BOTP.has(p));
  }
  const k = fn + " · " + f.slice(0, 3), T = isBot ? W : WO;
  (T[fld][k] = T[fld][k] || []).push(lineAt(pos) + (isBot ? "" : " " + objTxt.slice(0, 24)));
});
{
  let md = "# Кто пишет поля бота (генерируется: `tools/rebuild/gen_maps.js`, статический разбор кода)\n\n" +
    "Запись — присваивание `бот.поле = …` / `++` в функции (файл — номер); то же имя у другого объекта (бомба, редактор, смок выхода) — отдельно. Хозяин — по CLAUDE.md §7; у полей без хозяина его пока нет (назначит перенос каналов).\n" +
    "Живой ловец (кто пишет во время матча, со стеком) — `tools/measure/engine/field_watch.js`.\n\n| поле | мест | функций | из них хозяин |\n|---|---|---|---|\n";
  FIELDS.forEach(fl => { const E = Object.entries(W[fl]); const own = E.filter(([k]) => OWNER[fl].test(k.split(" · ")[0]));
    md += "| `" + fl + "` | " + E.reduce((a, [, L]) => a + L.length, 0) + " | " + E.length + " | " + (own.map(([k]) => "`" + k + "`").join(", ") || "—") + " |\n"; });
  FIELDS.forEach(fl => { const E = Object.entries(W[fl]).sort((a, b) => b[1].length - a[1].length), O = Object.entries(WO[fl]);
    md += "\n## `" + fl + "`\n\n" + E.map(([k, L]) => "- " + (OWNER[fl].test(k.split(" · ")[0]) ? "**хозяин** " : "") + "`" + k + "` — " + L.length + " (стр. " + L.slice(0, 8).join(", ") + (L.length > 8 ? ", …" : "") + ")").join("\n") + "\n";
    if (O.length) md += "\nне бот (то же имя у другого объекта — в проверку владения не идёт): " + O.map(([k, L]) => "`" + k + "` (" + L.slice(0, 3).join("; ") + ")").join(", ") + "\n"; });
  save(path.join(OUT, "fields.md"), md);
}

// ---- 3) порядок тика
// ---- проверка владения: запись поля из функции не из канала (owners.json → allow) — предупреждение, при enforce — ошибка
if (CHECK) {
  let bad = 0, warn = [];
  for (const fl of Object.keys(OWN).filter(k => k !== "_")) {
    const E = Object.entries(W[fl]).filter(([k]) => !OWNER[fl].test(k.split(" · ")[0]));
    if (!E.length) continue;
    const n = E.reduce((a, [, L]) => a + L.length, 0), txt = "`" + fl + "` (" + OWN[fl].channel + "): " + n + " мест мимо хозяина — " + E.map(([k, L]) => k + "×" + L.length).join(", ");
    if (OWN[fl].enforce) { bad++; console.error("ОШИБКА владения " + txt); } else warn.push(txt);
  }
  if (warn.length) console.log("владение полей — предупреждения (" + warn.length + " полей, каналы ещё не перенесены):\n  " + warn.join("\n  "));
  process.exit(bad ? 1 : 0);
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
  body.forEach(st => { if (st.type === "VariableDeclaration") st.declarations.forEach(d => { if (d.id.type === "Identifier") V[d.id.name] = { home: fileAt(st.start + main.off)[2].slice(0, 3), w: {}, r: {} }; }); });
  walk.fullAncestor(main.ast, (n, _s, anc) => {
    if (n.type !== "Identifier" || !V[n.name]) return; const p = anc[anc.length - 2]; if (!p) return;
    if (p.type === "VariableDeclarator" && p.id === n) return;
    if ((p.type === "MemberExpression" && p.property === n && !p.computed) || (p.type === "Property" && p.key === n && !p.computed)) return;
    const f = fileAt(n.start + main.off)[2].slice(0, 3);
    const isW = (p.type === "AssignmentExpression" && p.left === n) || (p.type === "UpdateExpression");
    const T = isW ? V[n.name].w : V[n.name].r; T[f] = (T[f] || 0) + 1;
  });
  let cats = {}; try { cats = JSON.parse(fs.readFileSync(path.join(ROOT, "rebuild", "var_cats.json"), "utf8")); } catch (e) {}
  const cross = Object.entries(V).filter(([k, v]) => Object.keys(v.w).some(f => f !== v.home)).sort((a, b) => Object.keys(b[1].w).length - Object.keys(a[1].w).length);
  let md = "# Общие переменные, которые пишут из чужих файлов (генерируется: `tools/rebuild/gen_maps.js`)\n\nВсего переменных верхнего уровня: " +
    Object.keys(V).length + ", из них пишут не только в своём файле: **" + cross.length + "**. Категория и хозяин — по смыслу (`rebuild/var_cats.json`):\n" +
    "канал (взгляд / место / гранаты / бой / ход / знание), мир (карта, навмеш, видимость), раунд (тик, состояние раунда, бомба, счёт), кэш, временное, показ.\n\n" +
    "| переменная | объявлена | пишут (файл×мест) | читают файлов | категория | хозяин | почему |\n|---|---|---|---|---|---|---|\n";
  cross.forEach(([k, v]) => { const c = cats[k] || {}; md += "| `" + k + "` | " + v.home + " | " + Object.entries(v.w).map(([f, n]) => f + "×" + n).join(" ") + " | " + Object.keys(v.r).length + " | " + (c.cat || "?") + " | " + (c.owner || "") + " | " + (c.why || "") + " |\n"; });
  save(path.join(OUT, "vars.md"), md);
  save(path.join(OUT, "vars.json"), JSON.stringify(Object.fromEntries(cross.map(([k, v]) => [k, v]))));
  console.log("общих переменных", Object.keys(V).length, "из чужих файлов пишут", cross.length);
}
