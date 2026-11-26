// (Р5.1, 26.11) проверка контракта кадра: страница A играет матч до тика T и рисует; кадр (frameMake — переменные, которые читает показ и
// меняет симуляция) переносится текстом (mkPack / mkUnpack, как снимок отметки) в чистую страницу B той же сборки, где своя симуляция стоит;
// B раскладывает кадр (frameApply) и рисует. Рисунки равны попиксельно — состав кадра полон (показу хватает кадра). Часы, кадры и
// случайность страниц закреплены, как в tools/page/frame_hash.js. Не равны — печатает, каких переменных не хватило (сравнение значений).
// Запуск: node tools/page/frame_apply_check.js <sim.html> [--match=3] [--ticks=3000,9000] [--layers=1]
'use strict';
const pw = require('playwright');
const SIM = require('path').resolve(process.argv[2]);
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const M = +(A.match || 3), TICKS = (A.ticks || '3000,9000').split(',').map(Number);
const HASH = `nowTs = 1e6; draw(); var c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, x = 2166136261 >>> 0;
  for(var i = 0; i < d.length; i += 4) x = Math.imul(x ^ (d[i] | d[i+1] << 8 | d[i+2] << 16), 16777619) >>> 0; c.width + 'x' + c.height + ':' + x`;
async function page(br) {
  const p = await br.newPage({ viewport: { width: 1600, height: 1000 } }); await p.route(/^https?:/, r => r.abort());
  await p.addInitScript(() => { let t = 1000, s = 1; Math.random = () => { s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 >>> 0; return (s >>> 8) / 16777216; }; performance.now = () => t; window.requestAnimationFrame = () => 0;
    window.setTimeout = () => 0; window.setInterval = () => 0; Date.now = () => 1.7e12; });
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(500);
  if (A.layers) await p.evaluate(() => document.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = true; }));
  return p;
}
(async () => {
  const br = await pw.chromium.launch(); const a = await page(br); let bad = 0;
  await a.evaluate(m => __ev('nowTs = 1e6; freshMatch(' + m + '); 1'), M);
  for (const T of TICKS) {
    const hA = await a.evaluate(s => __ev(s), `while(tick < ${T}){ stepTick(); nowTs = 1e6; } ` + HASH);
    const F = await a.evaluate(() => __ev('mkPack(frameMake())'));
    const b = await page(br);
    const hB = await b.evaluate(s => __ev(s), 'frameApply(mkUnpack(' + JSON.stringify(F) + ')); ' + HASH);
    const same = hA === hB; if (!same) bad++;
    console.log('тик ' + T + ': A ' + hA + ' / B ' + hB + (same ? ' = равны' : ' — РАЗНЫЕ') + '; кадр ' + Math.round(F.length / 1024) + ' КБ текстом, переменных ' + (await a.evaluate(() => __ev('FRAME_VARS.length'))));
    await b.close();
  }
  await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
