// (15.11, перестройка, фаза 2) проверки по отметкам владельца: снимок отметки → повторяемый сценарий с ответом «да / нет».
// Список — rebuild/scenarios.json: [{id, map, pre, tick, snap?, ask, steps?, check, expect?}] (pre + tick — главный путь; snap — только если снимка до нет)
//   snap   — файл снимка (tools/marks/snaps/<id>.json — снимок отметки, mkPack), путь от корня репо
//   ask    — вопрос словами владельца («CT0 держит угол на Jungle, а не бежит?»)
//   pre    — снимок за 15 с до отметки (preSnap, есть у отметок с v401) — ГЛАВНЫЙ путь (замечание владельца 15.11): снимок момента
//            уже несёт принятое решение, новый код его не пересматривает; от pre игра пересчитывается до тика отметки (tick) новым кодом
//   tick   — тик отметки (с pre обязателен): до него — пересчёт, потом steps
//   steps  — сколько тиков проиграть после момента отметки перед проверкой (по умолчанию 0)
//   check  — код в игре, возвращает true / false (можно смотреть всё: bots, tick, bomb, b._dlog …)
//   expect — какой ответ правильный (по умолчанию true); «нет» там, где ошибка ушла, — пишется как expect: false
// Запуск: node tools/marks/scenarios.js [--map=mirage] [--only=id1,id2]   (сборка — python3 src/build.py --map <карта> во временную папку)
// Итог — таблица: сценарий, вопрос, ответ, совпало ли с ожидаемым; код выхода 1, если хоть один не совпал.
"use strict";
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");
const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => a.slice(2).split("=")));
(async () => {
  let list = JSON.parse(fs.readFileSync(opt.list ? path.resolve(opt.list) : path.join(ROOT, "rebuild", "scenarios.json"), "utf8"));
  if (opt.map) list = list.filter(s => s.map === opt.map);
  if (opt.only) { const o = new Set(opt.only.split(",")); list = list.filter(s => o.has(s.id)); }
  if (!list.length) { console.log("сценариев нет"); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scen_")), sims = {};
  for (const m of new Set(list.map(s => s.map))) { sims[m] = path.join(tmp, m + ".html"); cp.execFileSync("python3", [path.join(ROOT, "src", "build.py"), "--map", m, sims[m]], { stdio: "ignore" }); }
  const br = await chromium.launch(); let bad = 0; const rows = [];
  for (const s of list) {
    const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
    let ans, err = "";
    try {
      await pg.goto(require("url").pathToFileURL(sims[s.map]).href); await pg.waitForFunction(() => typeof window.__ev === "function", null, { timeout: 60000 });
      await pg.evaluate(t => window.__ev("mkOpenSnap")(t), fs.readFileSync(path.resolve(ROOT, s.pre || s.snap), "utf8"));
      if (s.pre) await pg.evaluate(t => window.__ev("paused = true; var __n = 0; while(tick < " + (t | 0) + " && __n++ < 200000) stepTick(); tick"), s.tick);
      ans = await pg.evaluate(([n, code]) => window.__ev("paused = true; for(var __i = 0; __i < " + (n | 0) + "; __i++) stepTick(); !!(function(){ return (" + code + "); })()"), [s.steps || 0, s.check]);
    } catch (e) { err = String(e.message || e).split("\n")[0]; }
    await pg.close();
    const want = s.expect === undefined ? true : !!s.expect, ok = !err && ans === want; if (!ok) bad++;
    rows.push("| " + s.id + " | " + s.ask + " | " + (err ? "ошибка: " + err : ans ? "да" : "нет") + " | " + (ok ? "✓" : "✗ (ждали " + (want ? "да" : "нет") + ")") + " |");
  }
  await br.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log("| сценарий | вопрос | ответ | |\n|---|---|---|---|\n" + rows.join("\n"));
  console.log(bad ? "НЕ СОВПАЛО: " + bad + " из " + list.length : "всё совпало: " + list.length);
  process.exit(bad ? 1 : 0);
})();
