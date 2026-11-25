'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { broker } = require('./shared.cjs');
const { fragments, captureSource } = require('./record.cjs');

function fixture(t, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sim-runner-'));
  const code = path.join(dir, 'test.js');
  writeFileSync(code, 'true\n');
  const sessions = [];
  const browsers = [];
  const pool = broker({
    async startBrowser() {
      const browser = new EventEmitter();
      browser.close = async () => browser.emit('disconnected');
      browser.newContext = async () => {
        const state = { closed: false, local: new Map() };
        state.close = async () => { state.closed = true; state.finish?.(); };
        sessions.push(state);
        return state;
      };
      browsers.push(browser);
      return browser;
    },
    preparePage: async context => context,
    write: async (context, source, output) => {
      assert.equal(context.local.size, 0);
      context.local.set('profile', 'local to the match');
      writeFileSync(output, source);
      return options.write?.(context, source);
    }
  });
  t.after(async () => {
    await pool.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const job = (name, timeoutMs = 3000) => ({ code, timeoutMs, output: path.join(dir, name) });
  return { job, sessions, browsers, pool };
}

test('serializes every record field in JSON.stringify order including holes, snapshots and UTF-8', () => {
  const rows = [, [-0, Infinity], undefined, { sample: 'дым / 雪' }];
  const rec = { rows, skips: undefined, flags: { x: 1, absent: undefined }, snaps: { 4: { s: 'snapshot' } }, nul: null };
  assert.equal([...fragments(rec)].join(''), JSON.stringify(rec) + '\n');
  assert.throws(() => captureSource('JSON.stringify(other)'), /Неизвестный конец/);
  assert.equal(captureSource('check();\nJSON.stringify(REC)\n'), 'check();\nglobalThis.__measureRecord = REC; true');
});

test('reuses one browser across concurrent jobs and new contexts; reconnects after disconnect', async t => {
  const { pool, job, sessions, browsers } = fixture(t);
  const jobs = ['one', 'two', 'three'].map(name => job(name));
  await Promise.all(jobs.slice(0, 2).map(row => pool.submit(row)));
  await pool.submit(jobs[2]);
  assert.equal(sessions.length, 3);
  assert.ok(sessions.every(state => state.closed));
  assert.equal(browsers.length, 1);
  for (const { output } of jobs) assert.equal(readFileSync(output, 'utf8'), 'true\n');
  await browsers[0].close();
  await pool.submit(job('new-browser'));
  assert.equal(browsers.length, 2);
});

test('discards an incomplete file on recorder failure and timeout', async t => {
  const fail = fixture(t, { write: () => { throw new Error('failed'); } });
  const failing = fail.job('bad');
  await assert.rejects(fail.pool.submit(failing), /failed/);
  assert.ok(!existsSync(failing.output));
  assert.ok(!existsSync(failing.output + '.part-' + process.pid));
  assert.ok(fail.sessions[0].closed);

  const hang = fixture(t, { write: state => new Promise(resolve => { state.finish = resolve; }) });
  const timing = hang.job('timeout', 40);
  await assert.rejects(hang.pool.submit(timing), /Таймаут/);
  assert.ok(!existsSync(timing.output));
  assert.ok(!existsSync(timing.output + '.part-' + process.pid));
  assert.ok(hang.sessions[0].closed);
});

test('closing the queue cancels an in-flight recorder and removes its part file', async t => {
  let started;
  const setup = new Promise(resolve => { started = resolve; });
  const { job, pool, sessions } = fixture(t, { write: async state => {
    started();
    return new Promise(resolve => { state.finish = resolve; });
  } });
  const pending = job('cancelled');
  const result = assert.rejects(pool.submit(pending), /Очередь закрыта/);
  await setup;
  await pool.close(true);
  await result;
  assert.ok(sessions[0].closed);
  assert.ok(!existsSync(pending.output + '.part-' + process.pid));
});

test('Chromium keeps page state and localStorage isolated and streams multiple chunks losslessly',
    { skip: !process.env.SIM_RUNNER_BROWSER_TEST }, async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sim-browser-test-'));
  const pool = broker();
  t.after(async () => {
    await pool.close(true);
    rmSync(dir, { recursive: true, force: true });
  });
  const html = path.join(dir, 'fixture.html');
  const code = path.join(dir, 'eval.js');
  writeFileSync(html, '<script>function clockPause(){}; window.__ev = source => eval(source);</script>');
  writeFileSync(code, `
    var REC = { stored: localStorage.getItem('test'), seen: Boolean(globalThis.seen), rows: [] };
    localStorage.setItem('test', 'one match'); globalThis.seen = true;
    for (let i = 0; i < 5000; i++) REC.rows.push([i, 'слово / 雪']);
    JSON.stringify(REC)
  `.replace(/^ +/gm, ''));
  const run = (index, stream) => pool.submit({ html, code, output: path.join(dir, index + '.json'), stream, timeoutMs: 20000 });
  await Promise.all([run(1, false), run(2, true)]);
  await run(3, true);
  const normal = readFileSync(path.join(dir, '1.json'), 'utf8');
  assert.ok(normal.length > 64 * 1024);
  assert.deepEqual([JSON.parse(normal).stored, JSON.parse(normal).seen], [null, false]);
  assert.equal(readFileSync(path.join(dir, '2.json'), 'utf8'), normal);
  assert.equal(readFileSync(path.join(dir, '3.json'), 'utf8'), normal);
});
