#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const readline = require('node:readline');
const { launch, prepare, readCode } = require('../../../src/q.js');
const { writeRecord } = require('./record.cjs');

// One Node process and browser per queue. Every job gets its own incognito context.
function broker({ startBrowser = launch, preparePage = prepare, write = writeRecord } = {}) {
  let browserPromise;
  const active = new Map();
  const destinations = new Set();

  function browser() {
    if (!browserPromise) {
      const opening = Promise.resolve().then(startBrowser);
      browserPromise = opening;
      function clear() { if (browserPromise === opening) browserPromise = undefined; }
      opening.then(value => value.once('disconnected', clear), clear);
    }
    return browserPromise;
  }

  async function match(job, controller) {
    const { html, code, output, stream, timeoutMs } = job;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || destinations.has(output)) throw new Error('Некорректный таймаут или повтор пути вывода');
    destinations.add(output);
    const part = output + '.part-' + process.pid;
    let context, browserInstance;
    const { signal } = controller;
    const work = (async () => {
      browserInstance = await browser();
      if (signal.aborted) return;
      context = await browserInstance.newContext();
      if (signal.aborted) { await context.close(); return; }
      const page = await preparePage(context, html);
      await write(page, readCode('@' + code), part, stream);
    })();
    const timer = setTimeout(() => controller.abort(new Error('Таймаут матча')), timeoutMs);
    let abort;
    try {
      await Promise.race([work, new Promise((_, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
      })]);
      await context.close();
      context = undefined;
      await fs.rename(part, output);
    } catch (error) {
      if (context) {
        await context.close().catch(async () => {
          if (browserInstance?.isConnected()) await browserInstance.close();
        });
      }
      // Closing the context interrupts evaluate. Wait before touching its temporary output.
      await work.catch(() => {});
      await fs.rm(part, { force: true });
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      destinations.delete(output);
    }
  }

  function submit(job) {
    const controller = new AbortController();
    const result = match(job, controller);
    active.set(result, controller);
    const done = () => active.delete(result);
    result.then(done, done);
    return result;
  }

  async function close(cancel = false) {
    if (cancel) {
      for (const controller of active.values()) controller.abort(new Error('Очередь закрыта до завершения матча'));
    }
    await Promise.allSettled(active.keys());
    if (browserPromise) {
      const value = await browserPromise.catch(() => null);
      if (value) await value.close();
    }
  }
  return { submit, close };
}

async function main() {
  const pool = broker();
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    const job = JSON.parse(line);
    const reply = error => process.stdout.write(JSON.stringify({ id: job.id, error }) + '\n');
    pool.submit(job).then(() => reply(null), error => reply(error.stack || String(error)));
  }
  await pool.close(true);
}

if (require.main === module) main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
module.exports = { broker };
