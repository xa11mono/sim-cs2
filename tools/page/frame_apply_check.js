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
const HASH = `paused = true; nowTs = 1e6; draw(); var c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, x = 2166136261 >>> 0;
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
  const br = await pw.chromium.launch(); const a = await page(br), b = await page(br); let bad = 0;   // B — одна на все тики: показ копит своё (следы), как в режиме Worker
  await a.evaluate(m => __ev('nowTs = 1e6; freshMatch(' + m + '); 1'), M);
  for (const T of TICKS) {
    const hA = await a.evaluate(s => __ev(s), `while(tick < ${T}){ stepTick(); nowTs = 1e6; } ` + HASH);
    const F = await a.evaluate(() => __ev('mkPack(frameMake())'));
    const hB = await b.evaluate(s => __ev(s), 'frameApply(mkUnpack(' + JSON.stringify(F) + ')); ' + HASH);
    const same = hA === hB; if (!same) bad++;
    if (!same) {   // каких переменных не хватило: все, что читает показ (frame.json), — значения A и B (текстом mkPack), и поля ботов
      const R = Object.keys(require(require('path').join(__dirname, '..', '..', 'rebuild', 'gen', 'frame.json')).reads);
      const dump = `(function(){ var R = ${JSON.stringify(R)}, o = {}; R.forEach(function(n){ try{ o[n] = mkPack({v: eval(n)}); }catch(e){ o[n] = '?'; } });
        o.__bots = bots.map(function(b){ var f = {}; Object.keys(b).forEach(function(k){ try{ f[k] = mkPack({v: b[k]}); }catch(e){} }); return f; }); return JSON.stringify(o); })()`;
      const dA = JSON.parse(await a.evaluate(s => __ev(s), dump)), dB = JSON.parse(await b.evaluate(s => __ev(s), dump));
      const diff = Object.keys(dA).filter(k => k !== '__bots' && dA[k] !== dB[k]);
      const bf = new Set(); dA.__bots.forEach((f, i) => Object.keys(f).forEach(k => { if (f[k] !== (dB.__bots[i] || {})[k]) bf.add(k); }));
      console.log('  разные переменные: ' + diff.join(', ') + '\n  разные поля ботов: ' + [...bf].join(', '));
    }
    console.log('тик ' + T + ': A ' + hA + ' / B ' + hB + (same ? ' = равны' : ' — РАЗНЫЕ') + '; кадр ' + Math.round(F.length / 1024) + ' КБ текстом, переменных ' + (await a.evaluate(() => __ev('FRAME_VARS.length'))));
  }
  await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
