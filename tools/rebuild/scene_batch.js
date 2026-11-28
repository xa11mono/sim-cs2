// (28.11, система проверок H-3; прототип Codex e94ce460) Сцены реестра в одном процессе Chromium: каждая сцена — свой контекст браузера
// (Browser.newPage создаёт отдельный BrowserContext: своё хранилище, свои куки, своя страница; закрывается вместе со страницей), поэтому
// сцена не видит ни состояния предыдущей, ни упавшей (tools/tests/scene_batch.test.js). Раньше на каждую сцену запускался отдельный node
// и отдельный Chromium (tools/rebuild/scene_run.js из командной строки) — ответ тот же (JSON.stringify ответа сцены), меньше запусков.
// Хозяин браузера SceneHost: run(id, sims) — одна сцена; браузер отключился (упал) — следующий запуск поднимает новый; тайм-аут сцены —
// закрыть её контекст и вернуть ошибку (проверка не висит). Ошибка сцены — { error }, ответ — { output } (строка, как у scene_run.js).
// Запуск всех сцен реестра: node tools/rebuild/scene_batch.js <sim-mirage.html> <sim-ancient.html> [--par=N] [id …] → JSON отчёт
'use strict';
const { performance } = require('node:perf_hooks');
const { runScene } = require('./scene_run');

class SceneHost {
  constructor(o = {}) { this.timeoutMs = o.timeoutMs || 90 * 60 * 1000; this.br = null; this.starting = null; this.launches = 0; this.closed = false; }
  async browser() {
    if (this.br && this.br.isConnected()) return this.br;
    if (!this.starting) this.starting = (async () => { const { chromium } = require('playwright'); this.br = await chromium.launch(); this.launches++; return this.br; })()
      .finally(() => { this.starting = null; });
    return this.starting;
  }
  async run(id, sims) {
    if (this.closed) throw new Error('исполнитель сцен закрыт');
    const t0 = performance.now(), br = await this.browser();
    let timer = null;
    try {
      const work = runScene(br, id, sims, false).then(scene => scene.err ? { error: scene.err } : { output: String(JSON.stringify(scene.res)) },
        e => ({ error: String(e.message || e).split('\n')[0] }));
      const late = new Promise(res => { timer = setTimeout(() => res({ error: 'тайм-аут сцены ' + Math.round(this.timeoutMs / 1000) + ' с', timeout: true }), this.timeoutMs); });
      const r = await Promise.race([work, late]);
      // тайм-аут: страница сцены ещё работает — её контекст закрыть (иначе процессор занят до конца проверки)
      if (r.timeout) for (const c of br.contexts()) { try { await c.close(); } catch (e) {} }
      return Object.assign({ id, ms: performance.now() - t0 }, r);
    } finally { clearTimeout(timer); }
  }
  // после всех сцен контекстов не остаётся (иначе сцена что-то держит — ошибка исполнителя, а не ответ)
  leftContexts() { return this.br && this.br.isConnected() ? this.br.contexts().length : 0; }
  async close() { this.closed = true; if (this.br) { try { await this.br.close(); } catch (e) {} } }
}

// пачка (интерфейс прототипа Codex): jobs [{ id, k, sims }], parallel — сколько контекстов одновременно
async function runBatch(jobs, parallel, o = {}) {
  if (!Number.isSafeInteger(parallel) || parallel < 1) throw new Error('Некорректное число контекстов');
  if (!jobs.length) return { results: [], browsers: 0 };
  const host = new SceneHost(o), results = new Array(jobs.length); let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, async () => {
      while (next < jobs.length) { const i = next++, { id, k, sims } = jobs[i]; results[i] = Object.assign({ k }, await host.run(id, sims)); } }));
    if (host.leftContexts()) throw new Error('Контексты сцен остались открыты');
    return { results, browsers: host.launches };
  } finally { await host.close(); }
}

module.exports = { SceneHost, runBatch };

if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path');
  (async () => {
    const A = process.argv.slice(2), par = +((A.find(a => a.startsWith('--par=')) || '--par=2').slice(6)), [mirage, ancient, ...ids] = A.filter(a => !a.startsWith('--'));
    if (!mirage || !ancient) throw new Error('node tools/rebuild/scene_batch.js mirage.html ancient.html [--par=N] [id …]');
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../../rebuild/scene_registry.json'), 'utf8'));
    const sims = { mirage: path.resolve(mirage), ancient: path.resolve(ancient) };
    const jobs = (ids.length ? ids : registry.scenes.map(scene => scene.id)).map(id => ({ id, k: 'c', sims }));
    const report = await runBatch(jobs, par);
    console.log(JSON.stringify(report));
    if (report.results.some(result => 'error' in result)) process.exitCode = 1;
  })().catch(err => { console.error(err); process.exitCode = 2; });
}
