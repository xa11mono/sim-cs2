// (Р5, 26.11) время исполнения кода в ядре без показа — одинаково для любой среды: Node (этот файл) и Chromium (--browser: то же ядро
// в пустой странице about:blank, без DOM игры). Время — только исполнения кода (загрузка ядра не входит), куча JS и полная память
// процесса — до и после. Запуск: <node> tools/node/core_time.js <core.js> <@код.js> [--browser]
'use strict';
const fs = require('fs'), path = require('path');
const [CORE, CODEF] = process.argv.slice(2); const code = fs.readFileSync(CODEF.replace(/^@/, ''), 'utf8');
const mb = v => +(v / 1048576).toFixed(1);
(async () => {
  if (process.argv.includes('--browser')) {
    const pw = require('playwright'); const br = await pw.chromium.launch(); const p = await br.newPage();
    await p.addScriptTag({ content: fs.readFileSync(CORE, 'utf8') });
    const cdp = await p.context().newCDPSession(p); await cdp.send('HeapProfiler.collectGarbage');
    const h0 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    const r = await p.evaluate(c => { const t0 = performance.now(); const out = __ev(c); return { ms: performance.now() - t0, out: String(out) }; }, code);
    const h1 = (await cdp.send('Runtime.getHeapUsage')).usedSize; const bv = (await (await br.newBrowserCDPSession()).send('Browser.getVersion')).jsVersion;
    await br.close();
    console.log(JSON.stringify({ env: 'chromium ' + br.version() + ' v8 ' + bv, ms: Math.round(r.ms), hash: JSON.parse(r.out).hash, heap0: mb(h0), heap1: mb(h1) }));
  } else {
    const { load } = require('./core_run.js'); const EV = load(CORE); global.gc && global.gc();
    const h0 = process.memoryUsage(); const t0 = performance.now(); const out = EV(code); const ms = performance.now() - t0; const h1 = process.memoryUsage();
    console.log(JSON.stringify({ env: 'node ' + process.version + ' v8 ' + process.versions.v8, ms: Math.round(ms), hash: JSON.parse(out).hash, heap0: mb(h0.heapUsed), heap1: mb(h1.heapUsed), rss1: mb(h1.rss) }));
  }
})();
