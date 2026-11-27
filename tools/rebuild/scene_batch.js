// Повторно используется процесс Chromium. Исполнитель каждой сцены открывает и закрывает свой контекст.
'use strict';
const { performance } = require('node:perf_hooks');
const { runScene } = require('./scene_run');

async function runBatch(jobs, parallel) {
  if (!Number.isSafeInteger(parallel) || parallel < 1) throw new Error('Некорректное число контекстов');
  if (!jobs.length) return { results: [], browsers: 0 };
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const results = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      const { id, k, sims } = jobs[index];
      const start = performance.now();
      let result;
      try {
        const scene = await runScene(browser, id, sims, false);
        result = scene.err ? { error: scene.err } : { output: String(JSON.stringify(scene.res)) };
      } catch (err) {
        result = { error: String(err.message || err).split('\n')[0] };
      }
      results[index] = { id, k, ...result, ms: performance.now() - start };
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, worker));
    if (!browser.isConnected()) throw new Error('Chromium отключился во время проверки сцен');
    if (browser.contexts().length) throw new Error('Контексты сцен остались открыты');
    return { results, browsers: 1 };
  } finally {
    await browser.close();
  }
}

module.exports = { runBatch };

// Запуск всех сцен реестра для проверки перед публикацией. Остальные проверки L2 — отдельно.
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path');
  (async () => {
    const [mirage, ancient, ...ids] = process.argv.slice(2);
    if (!mirage || !ancient) throw new Error('node tools/rebuild/scene_batch.js mirage.html ancient.html [id …]');
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../../rebuild/scene_registry.json'), 'utf8'));
    const sims = { mirage: path.resolve(mirage), ancient: path.resolve(ancient) };
    const jobs = (ids.length ? ids : registry.scenes.map(scene => scene.id)).map(id => ({ id, k: 'c', sims }));
    const report = await runBatch(jobs, 2);
    console.log(JSON.stringify(report));
    if (report.results.some(result => 'error' in result)) process.exitCode = 1;
  })().catch(err => { console.error(err); process.exitCode = 2; });
}
