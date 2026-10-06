// Запечь разметку карты (01_markup.js) в src/data/markup.json.
// node tools/markup_bake.js   (сначала python3 src/build.py — нужен свежий sim.html)
// Считает в странице без экрана то же, что посчитала бы игра, округляет числа
// и пишет отпечаток входов (стены, навмеш, зоны, код разметки) — по нему
// сборка понимает, что разметка устарела.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
(async()=>{
  const hash = cp.execSync('python3 ' + path.join(ROOT, 'src/build.py') + ' --markup-hash').toString().trim();
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r=>r.abort());
  await pg.goto('file://' + path.join(ROOT, 'sim.html')); await pg.waitForTimeout(1200);
  const M = JSON.parse(await pg.evaluate(()=>__ev('JSON.stringify(markupBuild())')));
  await br.close();
  const r1 = v => Math.round(v*10)/10, r2 = v => Math.round(v*100)/100;
  const out = {src: hash, ms: M.ms, entries: M.entries.map(E => ({id:E.id, a:E.a, b:E.b, nameA:E.nameA, nameB:E.nameB,
    p:{x:r1(E.p.x), y:r1(E.p.y)}, seg:E.seg.map(q => ({x:r1(q.x), y:r1(q.y)})), w:E.w,
    sides:E.sides.map(S => ({hold:S.hold, from:S.from, covers:S.covers.map(c => ({x:r1(c.x), y:r1(c.y), wall:c.wall, vis:r2(c.vis), open:c.open, dirs:c.dirs, span:c.span,
      meet:{x:r1(c.meet.x), y:r1(c.meet.y)}, look:r2(c.look), sc:c.sc}))}))}))};
  fs.writeFileSync(path.join(ROOT, 'src/data/markup.json'), JSON.stringify(out) + '\n');
  const nc = out.entries.reduce((a, E) => a + E.sides.reduce((b, S) => b + S.covers.length, 0), 0);
  console.log('разметка: входов ' + out.entries.length + ', укрытий ' + nc + ', счёт ' + (M.ms/1000).toFixed(1) + ' с, отпечаток ' + hash);
})();
