// Перестройка, фаза 1: убрать вечные переключатели BAL (всегда одно значение, нигде не меняются) вместе с их условиями.
// Разбор — acorn (AST), правки — по точным диапазонам исходника; игра не должна меняться (отпечаток бит в бит на ПК).
// Запуск: NODE_PATH=/opt/node-tools/node_modules node tools/rebuild/bal_fold.js <ключи через запятую | all> [--keep=a,b]
// Пишет: правки в src/game/*.js и src/marks.js, строки ключей в tuning.js — удаляет; реестр удалённого — rebuild/archive/bal_removed.md
// (описание ключа из tuning.js дословно, где стоял, и каждый выброшенный кусок кода дословно — ничего не теряется).
// Сворачивает только то, что не меняет значения: `true && X` → X, `false || X` → X, `!true` → false, `T ? A : B` → A,
// `if(true) S` → S, `if(false) S else E` → E; `X && true` / `X || false` — только там, где важна лишь истинность (условие).
// Остальное (`false && X`, `X && false`, `X || true` — может пропасть вызов в X) не трогает и печатает списком «вручную».
"use strict";
const acorn = require("acorn"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const GS = require("./game_src.js"), GAME = GS.GAME;   // (Р4.2а) файлы игры — через описание (gamePath)
const args = process.argv.slice(2);
const keep = new Set(((args.find(a => a.startsWith("--keep=")) || "--keep=").slice(7)).split(",").filter(Boolean));

// ---- значения BAL из tuning.js
const balSrc = fs.readFileSync(GS.gamePath("tuning.js"), "utf8");
const balAst = acorn.parse(balSrc, { ecmaVersion: "latest", ranges: true, locations: true, onComment: [] });
let balObj = null;
for (const st of balAst.body) if (st.type === "VariableDeclaration" && st.declarations[0].id.name === "BAL") balObj = st.declarations[0].init;
const BALV = {};
for (const p of balObj.properties) if (p.value.type === "Literal") BALV[p.key.name] = p.value.value;

const files = GS.gameFiles().filter(f => /\.(js|ts)$/.test(f)).map(f => GS.gamePath(f))   // (Р1.1) .ts — правится как текст.concat([path.join(ROOT, "src", "marks.js")]);
function jsUnder(d) { let r = []; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, f.name);
  if (f.isDirectory()) { if (f.name !== "node_modules" && f.name !== "runs" && f.name !== "results") r = r.concat(jsUnder(q)); } else if (/\.js$/.test(f.name)) r.push(q); } return r; }
// писатели ищутся и в инструментах: ключ, который выключают тесты / замеры (BAL.execErr = false), — не вечный
const allSrc = files.concat(jsUnder(path.join(ROOT, "tools")).filter(f => !/tools[\\/]rebuild[\\/]/.test(f))).map(f => fs.readFileSync(f, "utf8")).join("\n");
const writtenKeys = new Set();
for (const m of allSrc.matchAll(/BAL\.(\w+)\s*(?:=(?!=)|\+\+|--|[-+*/]=)/g)) writtenKeys.add(m[1]);
for (const m of allSrc.matchAll(/BAL\.(\w+)\s*={2,3}/g)) writtenKeys.add(m[1]);   // сравнивают с конкретным значением — не трогаем
let keys = args[0] === "all" ? Object.keys(BALV) : (args[0] || "").split(",").filter(Boolean);
keys = keys.filter(k => typeof BALV[k] === "boolean" && !writtenKeys.has(k) && !keep.has(k));
const KEYS = new Set(keys);

const removed = [];   // {key, file, line, what, text}
const manual = [];
function lineOf(src, pos) { return src.slice(0, pos).split("\n").length; }

// preserveParens: скобки — свои узлы, и подставленный кусок берётся вместе с ними (иначе `true && (a || b) && c` → `a || b && c`,
// ошибка первой свёртки 15.11, найдена отпечатком на ПК: перевыбор носителя бомбы, 120_bomb)
function parse(src) { return acorn.parse(src, { ecmaVersion: "latest", ranges: true, allowReturnOutsideFunction: true, sourceType: "script", preserveParens: true }); }
const unp = n => { while (n && n.type === "ParenthesizedExpression") n = n.expression; return n; };
// обход с родителями
function walk(node, parent, fn) {
  if (!node || typeof node.type !== "string") return;
  fn(node, parent);
  for (const k in node) {
    if (k[0] === "_") continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === "string" && walk(c, node, fn));
    else if (v && typeof v.type === "string") walk(v, node, fn);
  }
}
const isBoolLit = n => { n = unp(n); return !!n && n.type === "Literal" && typeof n.value === "boolean"; };
const litVal = n => unp(n).value;
function boolCtx(n) {   // результат n нужен только как истина / ложь
  let p = n._p; while (p && p.type === "ParenthesizedExpression") { n = p; p = n._p; } if (!p) return false;
  if ((p.type === "IfStatement" || p.type === "WhileStatement" || p.type === "DoWhileStatement" || p.type === "ConditionalExpression") && p.test === n) return true;
  if (p.type === "ForStatement" && p.test === n) return true;
  if (p.type === "UnaryExpression" && p.operator === "!") return true;
  if (p.type === "LogicalExpression" && (p.operator === "&&" || p.operator === "||")) return boolCtx(p);
  return false;
}
function hasBlockDecl(block) {
  return block.body.some(s => (s.type === "VariableDeclaration" && s.kind !== "var") || s.type === "ClassDeclaration" || s.type === "FunctionDeclaration");
}

// одна правка за проход (самая глубокая первой встретившаяся по порядку) — потом разбор заново
function onePass(src, file, tagOf) {
  const ast = parse(src);
  let edit = null;
  walk(ast, null, (n, p) => { n._p = p; });
  walk(ast, null, (n) => {
    if (edit) return;
    // 1) BAL.key → литерал
    if (n.type === "MemberExpression" && !n.computed && n.object.type === "Identifier" && n.object.name === "BAL" && KEYS.has(n.property.name)) {
      const p = n._p;
      if (p && p.type === "AssignmentExpression" && p.left === n) return;
      edit = { s: n.start, e: n.end, t: String(BALV[n.property.name]), key: n.property.name };
      return;
    }
  });
  if (edit) return edit;
  walk(ast, null, (n) => {
    if (edit) return;
    const S = x => src.slice(x.start, x.end);
    if (n.type === "UnaryExpression" && n.operator === "!" && isBoolLit(n.argument)) { edit = { s: n.start, e: n.end, t: String(!litVal(n.argument)) }; return; }
    if (n.type === "LogicalExpression" && (n.operator === "&&" || n.operator === "||")) {
      const A = n.operator === "&&";
      if (isBoolLit(n.left)) {
        if (litVal(n.left) === A) { edit = { s: n.start, e: n.end, t: S(n.right) }; return; }           // true && X / false || X
        // true || X / false && X — X и раньше никогда не вычислялся (короткое замыкание): остаётся литерал, X — в реестр
        removed.push({ tag: tagOf(n.left.start, n.left.end), file, line: lineOf(src, n.start), what: "правая часть " + n.operator + " (не вычислялась)", text: S(n.right) });
        edit = { s: n.start, e: n.end, t: String(litVal(n.left)) }; return;
      }
      if (isBoolLit(n.right) && litVal(n.right) === A && boolCtx(n)) { edit = { s: n.start, e: n.end, t: S(n.left) }; return; }   // X && true / X || false
      if (isBoolLit(n.right) && !n.right._seen) { n.right._seen = 1; manual.push(file + ":" + lineOf(src, n.start) + "  " + S(n).slice(0, 120)); }
      return;
    }
    if (n.type === "ConditionalExpression" && isBoolLit(n.test)) {
      const tv = litVal(n.test), keepN = tv ? n.consequent : n.alternate, drop = tv ? n.alternate : n.consequent;
      removed.push({ tag: tagOf(n.test.start, n.test.end), file, line: lineOf(src, n.start), what: "ветка ?: (" + (tv ? "ложь" : "истина") + ")", text: S(drop) });
      edit = { s: n.start, e: n.end, t: S(keepN) }; return;
    }
    if (n.type === "IfStatement" && isBoolLit(n.test)) {
      const tv = litVal(n.test), keepN = tv ? n.consequent : n.alternate, drop = tv ? n.alternate : n.consequent;
      if (drop) removed.push({ tag: tagOf(n.test.start, n.test.end), file, line: lineOf(src, n.start), what: tv ? "else" : "if(ложь)", text: S(drop) });
      const par = n._p, inBody = par && (par.type === "BlockStatement" || par.type === "Program" || par.type === "SwitchCase");
      // (ошибка второй свёртки 15.11, найдена отпечатком на ПК 257: `} else if(!BAL.namedPos){…}` убиралось без `else`, и следующая
      // строка (`groupPost(… "awpline" …)`, 170_tbrain) становилась веткой else) — не в теле блока: else уходит вместе с if, иначе — `{}`
      if (!keepN && !inBody) {
        if (par && par.type === "IfStatement" && par.alternate === n) { edit = { s: par.consequent.end, e: n.end, t: "" }; return; }
        edit = { s: n.start, e: n.end, t: "{}" }; return;
      }
      if (!keepN) {   // весь if уходит
        let s = n.start, e = n.end;
        const ls = src.lastIndexOf("\n", s - 1) + 1, le = src.indexOf("\n", e); const le2 = le < 0 ? src.length : le;
        if (/^\s*$/.test(src.slice(ls, s)) && /^\s*$/.test(src.slice(e, le2))) { s = ls; e = le < 0 ? src.length : le + 1; }
        else if (/^\s*$/.test(src.slice(ls, s))) { /* оставить хвост строки */ while (src[e] === " ") e++; s = ls + (s - ls); }
        edit = { s, e, t: "" }; return;
      }
      if (keepN.type === "BlockStatement" && !hasBlockDecl(keepN) && inBody) {   // раскрыть блок — только в теле блока
        let inner = src.slice(keepN.start + 1, keepN.end - 1);
        const ls = src.lastIndexOf("\n", n.start - 1) + 1, ind = src.slice(ls, n.start);
        if (/\n/.test(inner) && /^\s*$/.test(ind)) {   // многострочный блок: снять отступ на шаг, убрать пустые края
          const lines = inner.split("\n"); if (/^\s*$/.test(lines[0])) lines.shift(); if (lines.length && /^\s*$/.test(lines[lines.length - 1])) lines.pop();
          const m = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length); const min = Math.min(...m);
          const cut = Math.max(0, min - ind.length);
          inner = lines.map((l, i) => (i === 0 ? l.slice(min) : l.slice(Math.min(cut, l.match(/^ */)[0].length)))).join("\n");
          edit = { s: n.start, e: n.end, t: inner }; return;
        }
        edit = { s: n.start, e: n.end, t: inner.trim() }; return;
      }
      edit = { s: n.start, e: n.end, t: S(keepN) }; return;
    }
  });
  return edit;
}

const report = {};
for (const f of files) {
  let src = fs.readFileSync(f, "utf8");
  try { parse(src); } catch (e) { if (/BAL\./.test(src)) console.error("НЕ РАЗОБРАН:", f, e.message); continue; }
  const rel = path.relative(ROOT, f);
  const keyAt = [];   // позиция → ключ, для пометки выброшенных кусков
  const tagOf = (s, e) => [...new Set(keyAt.filter(k => k.s >= s && k.s <= e).map(k => k.key))].join(",");
  let n = 0, guard = 0;
  for (;;) {
    const ed = onePass(src, rel, tagOf);
    if (!ed) break;
    if (ed.key) { keyAt.push({ s: ed.s, key: ed.key }); report[ed.key] = report[ed.key] || []; report[ed.key].push(rel + ":" + lineOf(src, ed.s)); }
    const d = ed.t.length - (ed.e - ed.s);
    keyAt.forEach(k => { if (k.s >= ed.e) k.s += d; else if (k.s > ed.s) k.s = ed.s; });
    src = src.slice(0, ed.s) + ed.t + src.slice(ed.e); n++;
    if (++guard > 5000) throw new Error("зациклилось: " + rel);
  }
  if (n) fs.writeFileSync(f, src);
}

// ---- tuning.js: убрать ключи из объекта (описание — в реестр)
let bs = fs.readFileSync(GS.gamePath("tuning.js"), "utf8");
const desc = {};
{
  const ast = parse(bs); let obj = null;
  for (const st of ast.body) if (st.type === "VariableDeclaration" && st.declarations[0].id.name === "BAL") obj = st.declarations[0].init;
  const props = obj.properties;
  const cuts = [];
  props.forEach((p, i) => {
    if (!KEYS.has(p.key.name)) return;
    const ls = bs.lastIndexOf("\n", p.start - 1) + 1, le = bs.indexOf("\n", p.end);
    const line = bs.slice(ls, le);
    const cm = line.indexOf("//"); desc[p.key.name] = cm >= 0 ? line.slice(cm + 2).trim() : "";
    // до следующего свойства (с запятой) или до конца объекта
    const next = props[i + 1]; let e = next ? next.start : p.end;
    if (!next) { const prev = props[i - 1]; cuts.push({ s: prev ? prev.end : p.start, e: p.end }); return; }
    // строки-комментарии между ключами (относятся к следующим) — оставить
    const gap = bs.slice(p.end, e), nl = gap.indexOf("\n");
    if (nl >= 0 && /\n[ \t]*\/\//.test(gap.slice(nl))) { const ls2 = bs.lastIndexOf("\n", p.start - 1) + 1;
      const onlyMe = /^[ \t]*$/.test(bs.slice(ls2, p.start)); cuts.push({ s: onlyMe ? ls2 : p.start, e: p.end + nl + 1 }); return; }
    cuts.push({ s: p.start, e });
  });
  cuts.sort((a, b) => b.s - a.s).forEach(c => { bs = bs.slice(0, c.s) + bs.slice(c.e); });
}
fs.writeFileSync(GS.gamePath("tuning.js"), bs);

// ---- реестр
const R = path.join(ROOT, "rebuild", "bal_removed.md");
let out = fs.existsSync(R) ? fs.readFileSync(R, "utf8") : "# Убранные вечные переключатели BAL (перестройка, фаза 1)\n\n" +
  "Каждый ключ всегда имел одно значение и нигде не менялся; условия с ним свёрнуты (`tools/rebuild/bal_fold.js`), игра та же " +
  "(отпечаток на ПК). Здесь — описание ключа из `tuning.js` дословно, где он стоял (файл:строка до свёртки) и выброшенные ветки " +
  "дословно (старое поведение до версии ключа). Решения отсюда переходят в реестр решений фазы 2.\n";
for (const k of keys) {
  out += "\n## `BAL." + k + "` = " + BALV[k] + "\n" + (desc[k] ? "Описание: " + desc[k] + "\n" : "") + "Где стоял: " + ((report[k] || []).join(", ") || "нигде (не использовался)") + "\n";
  const rs = removed.filter(r => r.tag.split(",")[0] === k);
  rs.forEach(r => { out += "- выброшено (" + r.what + (r.tag.includes(",") ? "; условие с " + r.tag : "") + ") `" + r.file + ":" + r.line + "`:\n\n```js\n" + r.text + "\n```\n"; });
}
const orphan = removed.filter(r => !KEYS.has(r.tag.split(",")[0]));
if (orphan.length) { out += "\n## выброшено (ключ не определён по месту)\n"; orphan.forEach(r => { out += "- (" + r.what + ") `" + r.file + ":" + r.line + "`:\n\n```js\n" + r.text + "\n```\n"; }); }
fs.writeFileSync(R, out);
console.log("ключей:", keys.length, "мест:", Object.values(report).reduce((a, b) => a + b.length, 0), "выброшено кусков:", removed.length);
const man = [...new Set(manual)]; if (man.length) { console.log("ВРУЧНУЮ (" + man.length + "):"); man.forEach(m => console.log("  " + m)); }
