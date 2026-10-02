// Открыть отметку владельца из её снимка (без перепроигрывания матча).
//   1) скачать снимок: Artifact read, url страницы, path = snapAsset отметки
//      (поле в базе страницы, коллекция marks) → файл .json
//   2) node tools/mark_open.js sim.html <снимок.json> "<код>"
// Код выполняется в игре сразу после открытия: тот же тик, те же боты, бомба,
// гранаты, смоки, огонь, знания команд — ровно то, что видел владелец.
// Пример кода: JSON.stringify(bots.map(b => [b.id, b.x, b.y, b.hp, b._task && b._task.kind]))
// Шаги дальше — stepTick() в коде.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [sim, snapFile, code] = process.argv.slice(2);
  if(!sim || !snapFile){ console.error('node tools/mark_open.js sim.html снимок.json "код"'); process.exit(2); }
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForTimeout(1200);
  const snap = fs.readFileSync(snapFile, 'utf8');
  await pg.evaluate(t => window.__ev('mkOpenSnap')(t), snap);
  console.log(await pg.evaluate(src => window.__ev(src), code || '"матч " + matchNum + ", раунд " + roundNum + ", тик " + tick'));
  await br.close();
})();
