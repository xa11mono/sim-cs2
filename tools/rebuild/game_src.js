// (Р1.1, 25.11) Исходник игры для инструментов — одно место: список файлов src/game (.html, .js, .ts) по порядку номеров и чтение файла.
// Файл .ts читается без типов: node:module stripTypeScriptTypes (режим strip) заменяет типы пробелами — длина, строки, позиции и
// комментарии те же, что в исходнике, поэтому «файл:строка» в отчётах gen_maps / diverge указывает в .ts верно. TS — только стираемый
// синтаксис (tsconfig.json: erasableSyntaxOnly) — без enum / namespace / свойств в параметрах: такой файл сборка не примет.
// Python (src/gamesrc.py) берёт тот же текст: node tools/rebuild/game_src.js strip <файл.ts>
"use strict";
const fs = require("fs"), path = require("path");
const GAME = path.join(__dirname, "..", "..", "src", "game");
const SRC_RE = /\.(html|js|ts)$/;

function stripTs(src, file) {
  const m = require("node:module");
  if (typeof m.stripTypeScriptTypes !== "function") throw new Error("чтение " + file + ": нужен Node ≥ 22.13 (node:module stripTypeScriptTypes)");
  const ew = process.emitWarning; process.emitWarning = function (w, t) { if ((t && t.type || t) === "ExperimentalWarning") return; return ew.apply(process, arguments); };
  try { return m.stripTypeScriptTypes(src, { mode: "strip" }); } finally { process.emitWarning = ew; }
}
// текст файла игры так, как его видит браузер (для .ts — без типов)
function readGame(file) {
  const p = path.isAbsolute(file) ? file : path.join(GAME, file), s = fs.readFileSync(p, "utf8");
  return /\.ts$/.test(p) ? stripTs(s, p) : s;
}
const gameFiles = (dir = GAME) => fs.readdirSync(dir).filter(f => SRC_RE.test(f)).sort();
// склейка всех файлов с границами: { all, spans: [[начало, конец, файл], …] } — как src/gamesrc.py, но модули — своим текстом
function concat(dir = GAME) {
  let all = ""; const spans = [];
  for (const f of gameFiles(dir)) { const s = readGame(path.join(dir, f)); spans.push([all.length, all.length + s.length, f]); all += s; }
  return { all, spans };
}
module.exports = { GAME, SRC_RE, gameFiles, readGame, stripTs, concat };

if (require.main === module) {
  const [cmd, file] = process.argv.slice(2);
  if (cmd === "strip" && file) process.stdout.write(readGame(path.resolve(file)));
  else { console.error("node tools/rebuild/game_src.js strip <файл>"); process.exit(2); }
}
