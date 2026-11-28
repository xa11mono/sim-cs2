'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { runBatch } = require('../rebuild/scene_batch');

test('a failed scene or a previous scene cannot pollute another browser context', async t => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-batch-test-'));
  t.after(() => fs.rmSync(work, { recursive: true, force: true }));
  const sim = path.join(work, 'test.html');
  fs.writeFileSync(sim, `<script>
    window.__ev = code => {
      if (code === 'clockPause(true); 1') return 1;
      const storage = localStorage.getItem('test-counter');
      localStorage.setItem('test-counter', 'written');
      const previous = window.testCounter ?? null;
      window.testCounter = 'written';
      return { no_nade_on_teammate: { storage, previous } };
    };
  </script>`);
  const job = { id: 'no_nade_on_teammate', k: 'p', sims: { ancient: sim } };
  const broken = { ...job, k: 'c', sims: { ancient: path.join(work, 'missing.html') } };
  const following = { ...job, k: 'c' };
  const expectedOutput = JSON.stringify({ storage: null, previous: null });
  for (const parallel of [1, 2]) {
    const { browsers, results } = await runBatch([job, broken, following, job], parallel);
    assert.equal(browsers, 1);
    assert.deepEqual(results.map(result => result.k), ['p', 'c', 'c', 'p']);
    assert.match(results[1].error, /ERR_FILE_NOT_FOUND/);
    assert.deepEqual([results[0], results[2], results[3]].map(result => result.output), Array(3).fill(expectedOutput));
  }
});

test('empty workload does not launch a browser and invalid concurrency fails closed', async () => {
  assert.deepEqual(await runBatch([], 1), { results: [], browsers: 0 });
  await assert.rejects(runBatch([], 0), /Некорректное число контекстов/);
});

test('a hanging scene times out, its context is closed, and the next scene still runs', async t => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-batch-hang-'));
  t.after(() => fs.rmSync(work, { recursive: true, force: true }));
  const hang = path.join(work, 'hang.html'), ok = path.join(work, 'ok.html');
  fs.writeFileSync(hang, `<script>window.__ev = code => { if (code === 'clockPause(true); 1') return 1; for (;;) {} };</script>`);
  fs.writeFileSync(ok, `<script>window.__ev = code => code === 'clockPause(true); 1' ? 1 : { no_nade_on_teammate: 'ok' };</script>`);
  const { results, browsers } = await runBatch([
    { id: 'no_nade_on_teammate', k: 'h', sims: { ancient: hang } },
    { id: 'no_nade_on_teammate', k: 'o', sims: { ancient: ok } }], 1, { timeoutMs: 3000 });
  assert.match(results[0].error, /тайм-аут/);
  assert.equal(results[1].output, JSON.stringify('ok'));
  assert.ok(browsers >= 1);
});
