// (Р5.3) дочерний процесс tools/node/profile_compare.js: страница в основном контексте Node, профиль CPU (node:inspector) и куча на
// отрезке кода из stdin. Запуск: node --expose-gc profile_node_child.js <sim.html> <выход.json>
'use strict';
const fs = require('fs'), inspector = require('node:inspector');
const { load } = require('./run_page.js');
const code = fs.readFileSync(0, 'utf8'), EV = load(fs.readFileSync(process.argv[2], 'utf8'), { global: true });
const mb = v => +(v / 1048576).toFixed(1);
const s = new inspector.Session(); s.connect();
const post = (m, p) => new Promise((res, rej) => s.post(m, p || {}, (e, r) => e ? rej(e) : res(r)));
(async () => {
  global.gc(); const h0 = process.memoryUsage().heapUsed;
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 1000 }); await post('Profiler.start');
  const t0 = Date.now(), out = EV(code), ms = Date.now() - t0;
  const prof = (await post('Profiler.stop')).profile; const h1 = process.memoryUsage().heapUsed; global.gc(); const h1g = process.memoryUsage().heapUsed;
  fs.writeFileSync(process.argv[3], JSON.stringify({ out: String(out), ms, h0: mb(h0), h1: mb(h1), h1g: mb(h1g), rss: mb(process.memoryUsage().rss), prof }));
})();
