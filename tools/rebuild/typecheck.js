// (Р1.1, 25.11) Проверка типов. Игра не меняется: tsc только читает исходник (noEmit).
//   node tools/rebuild/typecheck.js            — файлы .ts (tsconfig.json в корне, strict): любая ошибка — код 1 (приёмка Р1)
//   node tools/rebuild/typecheck.js --js [--list]   — .js игры: только предупреждения (код 0). Файлы src/game — куски одной функции
//     страницы (склейка), поэтому проверяется склейка целиком (основной <script>, .ts — без типов), а место ошибки переводится обратно
//     в «файл:строка» (tools/rebuild/game_src.js)
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const ts = require(path.join(process.env.MOD_NODE_MODULES || path.join(__dirname, "node_modules"), "typescript"));
const GS = require("./game_src.js");
const argv = process.argv.slice(2), JS = argv.includes("--js"), LIST = argv.includes("--list");
const msg = d => ts.flattenDiagnosticMessageText(d.messageText, "\n");

function checkTs() {
  const cfgPath = path.join(ROOT, "tsconfig.json");
  const cfg = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, Object.assign({}, ts.sys, { onUnRecoverableConfigFileDiagnostic: d => { throw new Error(msg(d)); } }));
  const noInputs = cfg.fileNames.length === 0;   // TS18003 «нет файлов» — не ошибка, пока .ts нет
  const cfgErr = cfg.errors.filter(d => !(noInputs && d.code === 18003));
  const prog = ts.createProgram({ rootNames: cfg.fileNames, options: cfg.options });
  const diags = cfgErr.concat(noInputs ? [] : ts.getPreEmitDiagnostics(prog));
  for (const d of diags) {
    if (d.file) { const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      console.log(path.relative(ROOT, d.file.fileName) + ":" + (line + 1) + ":" + (character + 1) + " TS" + d.code + " " + msg(d)); }
    else console.log("TS" + d.code + " " + msg(d));
  }
  // имена, которые .d.ts обещают от игры (declare var / function), обязаны быть объявлены в игре на верхнем уровне: описание не расходится с кодом
  const game = gameTopNames(), miss = [];
  for (const f of cfg.fileNames.filter(f => /\.d\.ts$/.test(f))) {
    const sf = prog.getSourceFile(f);
    sf.statements.forEach(st => {
      const dec = st.modifiers && st.modifiers.some(m => m.kind === ts.SyntaxKind.DeclareKeyword); if (!dec) return;
      const names = ts.isVariableStatement(st) ? st.declarationList.declarations.map(d => d.name.getText(sf)) : ts.isFunctionDeclaration(st) && st.name ? [st.name.text] : [];
      names.filter(n => !game.has(n)).forEach(n => { const { line } = sf.getLineAndCharacterOfPosition(st.getStart(sf));
        miss.push(path.relative(ROOT, f) + ":" + (line + 1) + " «" + n + "» — нет в игре (src/game, верхний уровень)"); });
    });
  }
  miss.forEach(m => console.log(m)); diags.push(...miss);
  // (Р2.0, владелец 25.11) строгую типизацию не обходить: any, «as», «!» — только с обоснованием на той же строке («// тип: …»);
  // подавление проверки (@ts-ignore, @ts-nocheck, @ts-expect-error) — нельзя, кроме теста типов src/types/types_test.ts
  const esc = [];
  for (const f of cfg.fileNames.filter(f => !/\.d\.ts$/.test(f))) {
    const sf = prog.getSourceFile(f), lines = sf.text.split("\n"), rel = path.relative(ROOT, f), isTest = /types_test\.ts$/.test(f);
    const why = ln => /\/\/.*тип:/.test(lines[ln]);
    (function visit(n) {
      const kind = n.kind === ts.SyntaxKind.AnyKeyword ? "any" : ts.isAsExpression(n) ? "as" : ts.isNonNullExpression(n) ? "!" : null;
      if (kind) { const ln = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line; if (!why(ln)) esc.push(rel + ":" + (ln + 1) + " «" + kind + "» без обоснования (// тип: …)"); }
      ts.forEachChild(n, visit); })(sf);
    lines.forEach((t, i) => { if (/@ts-(ignore|nocheck)/.test(t) || (!isTest && /@ts-expect-error/.test(t))) esc.push(rel + ":" + (i + 1) + " подавление проверки типов — нельзя"); });
  }
  esc.forEach(m => console.log(m)); diags.push(...esc);
  console.log("typecheck .ts: tsc " + ts.version + ", файлов " + cfg.fileNames.length + " (" + cfg.fileNames.map(f => path.relative(ROOT, f)).join(", ") + "), ошибок " + diags.length);
  return diags.length ? 1 : 0;
}

// основной <script> склейки (.ts — без типов), метки сборки (@@MAP@@ …) заменены числом той же длины — как в tools/measure/diverge.js
function mainScript() {
  const { all, spans } = GS.concat();
  let main = null;
  for (const m of all.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) { const off = m.index + m[0].indexOf(">") + 1; if (!main || m[1].length > main.src.length) main = { off, src: m[1] }; }
  return { all, spans, main, src: main.src.replace(/@@[A-Z_]+@@/g, m => "0".padEnd(m.length, " ")) };
}
// имена верхнего уровня игры: функции и переменные тела главной функции страницы (ядро и модули — одно пространство имён)
function gameTopNames() {
  const sf = ts.createSourceFile("game.js", mainScript().src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), N = new Set();
  const visitBody = stmts => stmts.forEach(st => {
    if (ts.isFunctionDeclaration(st) && st.name) N.add(st.name.text);
    if (ts.isVariableStatement(st)) st.declarationList.declarations.forEach(d => { if (ts.isIdentifier(d.name)) N.add(d.name.text); });
  });
  sf.statements.forEach(st => { if (!ts.isExpressionStatement(st)) return; let e = st.expression; if (!ts.isCallExpression(e)) return;
    let f = e.expression; while (ts.isParenthesizedExpression(f)) f = f.expression;
    if ((ts.isFunctionExpression(f) || ts.isArrowFunction(f)) && f.body && ts.isBlock(f.body) && f.body.statements.length > N.size) { N.clear(); visitBody(f.body.statements); } });
  return N;
}

function checkJs() {
  const { all, spans, main, src } = mainScript();
  const F = path.join(ROOT, ".tmp", "typecheck_game.js"), opts = { allowJs: true, checkJs: true, noEmit: true, strict: false, target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts"], types: [], skipLibCheck: true };
  const host = ts.createCompilerHost(opts), getSF = host.getSourceFile.bind(host);
  host.getSourceFile = (fn, lang) => fn === F ? ts.createSourceFile(F, src, lang, true, ts.ScriptKind.JS) : getSF(fn, lang);
  host.fileExists = (fe => fn => fn === F || fe(fn))(host.fileExists.bind(host));
  const prog = ts.createProgram({ rootNames: [F], options: opts, host });
  const diags = ts.getPreEmitDiagnostics(prog).filter(d => d.file && d.file.fileName === F);
  const byFile = {}, byCode = {}, rows = [];
  for (const d of diags) {
    const p = main.off + d.start, sp = spans.find(s => p >= s[0] && p < s[1]) || spans[spans.length - 1];
    const line = all.slice(sp[0], p).split("\n").length;
    byFile[sp[2]] = (byFile[sp[2]] || 0) + 1; byCode[d.code] = (byCode[d.code] || 0) + 1;
    rows.push(sp[2] + ":" + line + " TS" + d.code + " " + msg(d).split("\n")[0]);
  }
  if (LIST) rows.forEach(r => console.log(r));
  console.log("typecheck --js (только предупреждения): tsc " + ts.version + ", предупреждений " + diags.length);
  console.log("  по файлам: " + Object.entries(byFile).sort((a, b) => b[1] - a[1]).map(([f, n]) => f + " " + n).join(", "));
  console.log("  по кодам: " + Object.entries(byCode).sort((a, b) => b[1] - a[1]).map(([c, n]) => "TS" + c + " " + n).join(", "));
  return 0;
}

process.exit(JS ? checkJs() : checkTs());
