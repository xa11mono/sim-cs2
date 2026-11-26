// (17.11, перестройка — модули, вариант А) сборка игры из модулей каналов: канал = ES-модуль (src/game/<файл>.js, список — rebuild/modules.json),
// остальное — «ядро» (склейка остальных файлов, тело главной функции страницы). Связи import / export генерируются по разбору кода
// (acorn): модуль берёт у ядра то, что объявлено в ядре на верхнем уровне и упомянуто в модуле; ядро — у модуля то же наоборот.
// esbuild собирает всё в один кусок (формат esm, scope hoisting — одно пространство имён, как в склейке) и кладёт вместо тела главной
// функции; запись в чужую переменную (импорт только для чтения) — ошибка сборки. Игра должна совпасть с склейкой бит в бит (отпечаток).
// Запуск (src/gamesrc.py bundle_modules — из build.py и mkpub.py): node tools/rebuild/mod_build.js <страница.html> <папка-модулей> <модуль.js> ...   — страница переписывается на месте
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const NM = process.env.MOD_NODE_MODULES || path.join(__dirname, "node_modules");
const acorn = require(path.join(NM, "acorn")), walk = require(path.join(NM, "acorn-walk")), esbuild = require(path.join(NM, "esbuild"));
const { readGame, GAME } = require("./game_src.js");   // (Р1.1) модуль .ts — текст без типов (позиции те же)
const argv = process.argv.slice(2), COMPACT = argv.includes("--compact");   // --compact — без лишних пробелов (публикуемая страница, mkpub.py)
const [page, srcDir, ...mods] = argv.filter(a => a !== "--compact");
let html = fs.readFileSync(page, "utf8");

// главная функция страницы: «(function(){ "use strict"; … })();» в большом <script> (начало — zones.js)
const sm = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].reduce((a, m) => (m[1].length > (a ? a[1].length : 0) ? m : a), null);
const sOff = sm.index + sm[0].indexOf(">") + 1, script = sm[1];
const ast = acorn.parse(script, { ecmaVersion: "latest", sourceType: "script" });
const main = ast.body.find(st => st.type === "ExpressionStatement" && st.expression.type === "CallExpression" && /Function/.test(st.expression.callee.type));
const fn = main.expression.callee, body = fn.body;   // BlockStatement
let core = script.slice(body.start + 1, body.end - 1);   // тело без { }
core = core.replace(/^\s*"use strict";/, "");

function topNames(src, isModule) {
  const a = acorn.parse(src, { ecmaVersion: "latest", sourceType: isModule ? "module" : "script", allowReturnOutsideFunction: true });
  const N = new Set(); a.body.forEach(st => {
    if (st.type === "FunctionDeclaration") N.add(st.id.name);
    if (st.type === "VariableDeclaration") st.declarations.forEach(d => { if (d.id.type === "Identifier") N.add(d.id.name); });
  }); return { a, N };
}
function usedNames(a) {   // идентификаторы-ссылки (не ключи свойств и не объявления)
  const U = new Set();
  walk.fullAncestor(a, (n, _s, anc) => { if (n.type !== "Identifier") return; const p = anc[anc.length - 2]; if (!p) return;
    if ((p.type === "MemberExpression" && p.property === n && !p.computed) || (p.type === "Property" && p.key === n && !p.computed && !p.shorthand)) return;
    U.add(n.name); });
  return U;
}
// «запуск» модуля: всё, что модуль делает при загрузке (присваивания переменных, вызовы), — в функцию __mi_<файл>, которую ядро
// вызывает на месте метки /*@@MODINIT <файл>@@*/ (gamesrc.py) — порядок выполнения при загрузке тот же, что в склейке. Наверху модуля —
// только объявления функций и переменных (без значений)
const initName = f => "__mi_" + f.replace(/\.(js|ts)$/, "").replace(/[^\w]/g, "_");
function splitInit(src, f) {
  const a = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", allowReturnOutsideFunction: true });
  const top = [], vars = [], init = [];
  a.body.forEach(st => {
    if (st.type === "FunctionDeclaration") { top.push(src.slice(st.start, st.end)); return; }
    if (st.type === "VariableDeclaration") { st.declarations.forEach(d => { vars.push(d.id.name);
      if (d.init) init.push(d.id.name + " = " + src.slice(d.init.start, d.init.end) + ";"); }); return; }
    if (st.type === "EmptyStatement") return;
    init.push(src.slice(st.start, st.end));
  });
  return (vars.length ? "var " + vars.join(", ") + ";\n" : "") + top.join("\n") + "\nfunction " + initName(f) + "(){\n" + init.join("\n") + "\n}\n";
}
const C = topNames(core, false), CU = usedNames(C.a);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "modb_")), coreExp = new Set(), coreImp = {};
const M = mods.map(f => { const src = readGame(path.resolve(srcDir) === path.resolve(GAME) ? f : path.join(srcDir, f)),   // (Р4.2а) каталог игры — путь по описанию
   t = topNames(src, true), U = usedNames(t.a);
  const imp = [...U].filter(n => C.N.has(n) && !t.N.has(n)); imp.forEach(n => coreExp.add(n));
  const exp = [...t.N].filter(n => CU.has(n)); coreImp[f] = exp;
  return { f, src, imp, exp, N: t.N }; });
// модуль ↔ модуль: имена, объявленные в одном модуле и упомянутые в другом
M.forEach(m => M.forEach(o => { if (o === m) return; const U = usedNames(acorn.parse(o.src, { ecmaVersion: "latest", sourceType: "module" }));
  o.fromMods = o.fromMods || {}; const need = [...m.N].filter(n => U.has(n) && !o.N.has(n)); if (need.length) { o.fromMods[m.f] = need; m.exp = [...new Set(m.exp.concat(need))]; } }));
// снимок отметки (__SNAP, 650 — вставляет src/marks_build.py): «записать» переменной модуля — через её сеттер в модуле (__set_<имя>);
// переписывается только список снимка — любая другая запись в чужую переменную остаётся ошибкой сборки (нужен интерфейс по смыслу)
const SNAP = /var __SNAP = \[\r?\n([\s\S]*?)\r?\n\];/.exec(core), setters = {};   // \r\n — страница с Windows (Python пишет так)
if (SNAP) {
  const owner = {}; M.forEach(m => m.N.forEach(n => { owner[n] = m; }));
  const body = SNAP[1].replace(/function\(v\)\{ try\{ ([A-Za-z_$][\w$]*) = v; \}catch\(e\)\{\} \}/g, (all, n) => {
    if (!owner[n]) return all; (setters[owner[n].f] = setters[owner[n].f] || []).push(n); return "function(v){ try{ __set_" + n + "(v); }catch(e){} }"; });
  core = core.replace(SNAP[0], "var __SNAP = [\n" + body + "\n];");
  Object.entries(setters).forEach(([f, L]) => { const m = M.find(x => x.f === f);
    m.src += "\n" + L.map(n => "function __set_" + n + "(v){ " + n + " = v; }").join("\n");
    m.exp = m.exp.concat(L.map(n => "__set_" + n)); coreImp[f] = (coreImp[f] || []).concat(L.map(n => "__set_" + n)); });
}
const jsName = f => f.replace(/\.ts$/, ".js"), js = f => "./" + jsName(f);   // во временной папке модуль .ts — уже без типов, имя .js
M.forEach(m => {
  let head = (m.imp.length ? "import { " + m.imp.join(", ") + " } from \"./__core.js\";\n" : "");
  Object.entries(m.fromMods || {}).forEach(([f, L]) => { head += "import { " + L.join(", ") + " } from \"" + js(f) + "\";\n"; });
  fs.writeFileSync(path.join(tmp, jsName(m.f)), head + splitInit(m.src, m.f) + "\nexport { " + m.exp.concat([initName(m.f)]).join(", ") + " };\n");
});
M.forEach(m => { const mk = "/*@@MODINIT " + m.f + "@@*/"; if (core.indexOf(mk) < 0) throw new Error("нет метки модуля " + m.f);
  core = core.replace(mk, initName(m.f) + "();"); coreImp[m.f] = (coreImp[m.f] || []).concat([initName(m.f)]); });
let coreHead = ""; M.forEach(m => { if (coreImp[m.f].length) coreHead += "import { " + coreImp[m.f].join(", ") + " } from \"" + js(m.f) + "\";\n"; });
fs.writeFileSync(path.join(tmp, "__core.js"), coreHead + core + "\nexport { " + [...coreExp].join(", ") + " };\n");
fs.writeFileSync(path.join(tmp, "__entry.js"), "import \"./__core.js\";\n");
const r = esbuild.buildSync({ entryPoints: [path.join(tmp, "__entry.js")], bundle: true, format: "esm", write: false, target: "esnext",
  logLevel: "silent", legalComments: "none", charset: "utf8", minifyWhitespace: COMPACT });
(r.warnings || []).filter(w => !/direct eval/i.test(w.text)).forEach(w => console.warn("esbuild:", w.text));
let out = r.outputFiles[0].text;
const bundled = "(function(){\n\"use strict\";\n" + out + "\n})();";
const newScript = script.slice(0, main.start) + bundled + script.slice(main.end);
html = html.slice(0, sOff) + newScript + html.slice(sOff + script.length);
fs.writeFileSync(page, html);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("модули: " + mods.join(", ") + " — ядро отдаёт " + coreExp.size + " имён, берёт " + Object.values(coreImp).reduce((s, L) => s + L.length, 0));
