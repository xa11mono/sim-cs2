// (Р8 п. 17, 27.11) Автономные сборки — снимки экрана равны базе: одна и та же точка матча (матч 3, тик T, часы стоят) в обычной сборке
// карты (база), в автономном HTML всех карт (?map=) и в варианте B (движок + пакет; файлы отдаются по http://simcs2.local/ маршрутом
// Playwright, как src/q.js SIM_SERVE). Снимок страницы — PNG; сравнение — байты пикселей после раскодирования (Playwright Chromium).
// node rebuild/evidence/R8/shots17.js <single-mirage.html> <single-ancient.html> <all-maps.html> <variant-b папка> [тик=3000] → JSON
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), url = require('url');
const [sm, sa, am, vb, T0] = process.argv.slice(2), T = +(T0 || 3000);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
async function shot(br, href, serve) {
  const pg = await br.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await pg.route(/^https?:/, r => r.abort());
  if (serve) await pg.route('http://simcs2.local/**', r => { const f = path.join(serve, decodeURIComponent(new URL(r.request().url()).pathname));
    r.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' }); });
  await pg.clock.install({ time: 0 });   // часы страницы стоят: анимации показа от времени одинаковы во всех видах
  await pg.goto(href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, { timeout: 180000 });
  await pg.evaluate(t => window.__ev('clockPause(true); freshMatch(3); while(tick < ' + t + ') stepTick(); 1'), T);
  await pg.clock.runFor(2000);
  // камера показа плавно следует по часам страницы — ставится одна и та же (как tools/page/modes_check.js; показ, не игра), затем кадр
  await pg.evaluate(() => window.__ev('view.scale = 0.5; view.panX = 300; view.panY = 0; 1')); await pg.clock.runFor(100);
  const png = await pg.screenshot({ type: 'png' });
  const px = await pg.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let h = 2166136261 >>> 0; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619) >>> 0; return [c.width, c.height, h]; }, png.toString('base64'));
  await pg.close(); return { px, png };
}
(async () => {
  const br = await chromium.launch(), out = { tick: T, maps: {} };
  for (const [m, single] of [['mirage', sm], ['ancient', sa]]) {
    const A = await shot(br, url.pathToFileURL(path.resolve(single)).href), A2 = await shot(br, url.pathToFileURL(path.resolve(single)).href), B = await shot(br, url.pathToFileURL(path.resolve(am)).href + '?map=' + m),
      C = await shot(br, 'http://simcs2.local/index.html?map=' + m, path.resolve(vb));
    out.maps[m] = { single: A.px, single_repeat_same: A.px.join() === A2.px.join(), all_maps: B.px, variant_b: C.px, all_maps_same: A.px.join() === B.px.join(), variant_b_same: A.px.join() === C.px.join() };
    if (process.env.SHOTS) for (const [k, s] of [['single', A], ['single2', A2], ['all-maps', B], ['variant-b', C]]) fs.writeFileSync(path.join(process.env.SHOTS, m + '-' + k + '.png'), s.png);
  }
  await br.close(); console.log(JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(2); });
