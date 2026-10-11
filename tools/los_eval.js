// Видимость пар точек той же функцией, что в игре (hasLOS → visLine, 3D по высотам карты; дым не учитывается).
// node tools/los_eval.js sim.html in.json out.json   in: [[x1,y1,x2,y2],…]  out: строка '0'/'1' на каждую пару
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(1200);
  const P = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); let out = '';
  for (let i = 0; i < P.length; i += 50000) {
    out += await pg.evaluate(ch => { window.__P = ch; return __ev("window.__P.map(function(p){ return hasLOS(p[0], p[1], p[2], p[3]) ? '1' : '0'; }).join('')"); }, P.slice(i, i + 50000));
  }
  fs.writeFileSync(process.argv[4], out); await br.close();
})();
