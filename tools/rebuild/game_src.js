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
// (Р4.1, 26.11) порядок загрузки — список rebuild/files.json (как src/gamesrc.py order()); другой каталог (опыты) — по именам, как было
function gameFiles(dir = GAME) {
  if (path.resolve(dir) !== path.resolve(GAME)) return fs.readdirSync(dir).filter(f => SRC_RE.test(f)).sort();
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "rebuild", "files.json"), "utf8")).files;
  const disk = new Set(fs.readdirSync(dir).filter(f => SRC_RE.test(f))), extra = [...disk].filter(f => !L.includes(f)), miss = L.filter(f => !disk.has(f));
  if (extra.length || miss.length) throw new Error("порядок загрузки (rebuild/files.json): " + (extra.length ? "нет в списке: " + extra.join(", ") + "; " : "") + (miss.length ? "нет файла: " + miss.join(", ") : ""));
  return L.slice();
}
// склейка всех файлов с границами: { all, spans: [[начало, конец, файл], …] } — как src/gamesrc.py, но модули — своим текстом
function concat(dir = GAME) {
  let all = ""; const spans = [];
  for (const f of gameFiles(dir)) { const s = readGame(path.join(dir, f)); spans.push([all.length, all.length + s.length, f]); all += s; }
  return { all, spans };
}
// (Р4.2а, 26.11) описание файла игры — rebuild/files.json «game»: id (короткая метка вместо номера в имени), part (page / infra / decide /
// engine / watch / show), sys (система). Инструменты берут это отсюда, а не из номера в имени файла — переименование (Р4.2б) их не ломает
let META = null;
function gameMeta() { if (!META) { META = {}; JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "rebuild", "files.json"), "utf8")).game.forEach(g => { META[g.file] = g; }); } return META; }
const metaOf = f => gameMeta()[path.basename(f)] || { file: path.basename(f), id: "?", part: "?", sys: "?" };
const fileId = f => metaOf(f).id, filePart = f => metaOf(f).part, fileSys = f => metaOf(f).sys;
const isCalc = f => /\.(js|ts)$/.test(f) && !["show", "page"].includes(filePart(f));   // код расчёта (DM.*, без показа)
const isShow = f => ["show", "page"].includes(filePart(f));
module.exports = { GAME, SRC_RE, gameFiles, readGame, stripTs, concat, gameMeta, fileId, filePart, fileSys, isCalc, isShow };

if (require.main === module) {
  const [cmd, file] = process.argv.slice(2);
  if (cmd === "strip" && file) process.stdout.write(readGame(path.resolve(file)));
  else { console.error("node tools/rebuild/game_src.js strip <файл>"); process.exit(2); }
}
