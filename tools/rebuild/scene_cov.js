// (Р8 п. 10, 27.11) Какие функции игры выполняются в каждой сцене реестра (rebuild/scene_registry.json) — основа анализа влияния правки
// (tools/rebuild/impact.js): правка функции может изменить сцену, только если функция в ней выполняется (игра детерминирована).
// Покрытие V8 (Profiler.takePreciseCoverage, число вызовов, Chromium) — каждая сцена отдельной страницей: в файле сцен аудита остальные сцены
// того же файла заменяются на null (их код не выполняется), сцена по отметке (rebuild/scenarios.json) — как tools/marks/scenarios.js.
// В число входит и загрузка страницы, и подготовка сцены (freshMatch, тики до раунда): они тоже часть сцены.
// Запуск: node tools/rebuild/scene_cov.js <sim-mirage.html> [<sim-ancient.html>] [--only=id,…] [--out=rebuild/gen/scene_funcs.json]
//   сцены аудита — на сборке Ancient (так записан реестр: «Сборка проверки — Ancient»), если её нет — на первой; сцены отметок — по своей карте.
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright'), { runScene } = require('./scene_run.js');
const GS = require('./game_src.js'), ROOT = GS.ROOT;
const A = process.argv.slice(2), opt = (n, d) => { const a = A.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const sims = A.filter(x => !x.startsWith('--')).map(f => path.resolve(f));
const simOf = m => sims.find(f => new RegExp(m, 'i').test(path.basename(f))) || sims[0];
const OUT = path.resolve(opt('out', path.join(ROOT, 'rebuild', 'gen', 'scene_funcs.json')));
const ONLY = opt('only', null) && new Set(opt('only').split(','));
// имена функций верхнего уровня игры (их и ищем в покрытии; вложенные и безымянные — часть своей функции)
function gameFunctions() {
  const S = new Set();
  for (const f of GS.gameFiles()) { if (!/\.(js|ts)$/.test(f)) continue; const t = GS.readGame(f);
    const re = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm; let m; while ((m = re.exec(t))) S.add(m[1]); }
  return S;
}
(async () => {
  const G = gameFunctions(), reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'scene_registry.json'), 'utf8')).scenes;
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { scenes: {} };
  const out = { _: 'функции игры, выполняемые в каждой сцене реестра (tools/rebuild/scene_cov.js; покрытие V8, Chromium); основа tools/rebuild/impact.js', built: {}, scenes: ONLY ? old.scenes : {} };
  const br = await chromium.launch(); const t0 = Date.now();
  for (const s of reg) {
    if (ONLY && !ONLY.has(s.id)) continue;
    const r = await runScene(br, s.id, { mirage: simOf('mirage'), ancient: simOf('ancient') }, true);
    const fn = [...r.F].filter(f => G.has(f)).sort();
    out.scenes[s.id] = { file: s.file, sim: r.sim, functions: fn, result: r.err ? 'ошибка: ' + r.err : r.res };
    console.log(s.id + ': функций игры ' + fn.length + (r.err ? ', ошибка: ' + r.err : ''));
  }
  await br.close();
  out.built = { at: new Date().toISOString(), sims: sims.map(f => path.basename(f)), sec: Math.round((Date.now() - t0) / 1000), game_functions: G.size };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"'));
  console.log('записано: ' + path.relative(ROOT, OUT) + ' (сцен ' + Object.keys(out.scenes).length + ', ' + out.built.sec + ' с)');
})().catch(e => { console.error(e); process.exit(2); });
