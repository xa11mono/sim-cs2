// (шаг 0а) как src/q.js, но код и данные — из файлов (данные демок не влезают в аргумент командной строки).
// node tools/measure/engine/qfile.js <sim.html> <скрипт.js> <данные.json> <вывод.json>
// Скрипт видит данные как переменную DATA и должен вернуть JSON-строку. Игру не меняет: только вызовы функций движка.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const [sim, scr, dat, out] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForTimeout(1200);
  await pg.evaluate(d => { window.__DATA = d; }, fs.readFileSync(dat, 'utf8'));
  const src = 'var DATA = JSON.parse(window.__DATA);\n' + fs.readFileSync(scr, 'utf8');
  const res = await pg.evaluate(s => __ev(s), src);
  fs.writeFileSync(out, res); await br.close();
})();
