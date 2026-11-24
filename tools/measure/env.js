// (Р0.1, 24.11) Среда проверки одной строкой JSON: Playwright, Chromium, Node / V8, ОС. Пишется рядом с каждым отпечатком и прогоном:
// последние знаки Math зависят от браузера и ОС (rebuild/ENVIRONMENT.md) — результаты сравнимы только в одной среде.
// node tools/measure/env.js [файл]  — без файла печатает
const os = require('os'), fs = require('fs');
(async () => {
  const e = { node: process.version, v8: process.versions.v8, os: os.platform() + ' ' + os.release(), arch: os.arch(), playwright: null, chromium: null };
  try { e.playwright = require('playwright/package.json').version; const b = await require('playwright').chromium.launch(); e.chromium = b.version(); await b.close(); }
  catch (err) { e.error = String(err && err.message || err).slice(0, 200); }
  const s = JSON.stringify(e);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], s + '\n'); else console.log(s);
})();
