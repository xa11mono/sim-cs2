// node scenes_run.js before.html after.html out.json M1,M2,...
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [bf, af, outF, ms] = process.argv.slice(2); const PAGE = fs.readFileSync(path.join(__dirname, 'scenes_page.js'), 'utf8');
async function open(br, f){ const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto(require('url').pathToFileURL(path.resolve(f)).href); await pg.waitForTimeout(1200); await pg.evaluate(s => __ev(s), PAGE); return pg; }
(async () => { const br = await chromium.launch(); const B = await open(br, bf), A = await open(br, af);
  const want = {bullet: 4, he: 4, fire: 4, flash: 4, a2: 4}, got = {bullet: [], he: [], fire: [], flash: [], a2: []}, stat = {};
  for(const m of ms.split(',').map(Number)){
    const eps = await B.evaluate(m => __ev('JSON.stringify(scFind(' + m + ', 400000))'), m).then(JSON.parse);
    for(const e of eps){ stat[e.kind] = (stat[e.kind] || 0) + 1; if(!got[e.kind] || got[e.kind].length >= want[e.kind]) continue;
      const n = e.kind === 'a2' ? 192 + 256 : e.kind === 'flash' ? 320 + 192 : 128 + 256;
      fs.writeFileSync(path.join(__dirname, 'pk.txt'), e.pack);
      const code = 'JSON.stringify(scRecord(' + JSON.stringify(e.pack) + ',' + n + '))';
      const rb = JSON.parse(await B.evaluate(c => __ev(c), code)), ra = JSON.parse(await A.evaluate(c => __ev(c), code));
      delete e.pack; got[e.kind].push({ep: e, before: rb, after: ra}); console.error(m, e.kind, e.id, e.t); }
    console.error('match', m, JSON.stringify(stat));
    if(Object.keys(want).every(k => got[k].length >= want[k])) break; }
  fs.writeFileSync(outF, JSON.stringify({stat, got})); await br.close(); })();
