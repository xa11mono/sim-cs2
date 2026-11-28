'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { gzipSync } = require('node:zlib');
const { packed, stringify } = require('./io.cjs');
const { decode } = require('./mkpack.cjs');
const { inspect } = require('./mark.cjs');

const cli = path.join(__dirname, 'cli.cjs');
const identity = {
  gameVersion: 'v-test', buildHash: 'a'.repeat(64), map: 'mirage', mapHash: 'b'.repeat(64), dmath: 'test',
  seed: 0, match: 3, round: 2, tick: 100, tickHz: 64, settingsHash: 'c'.repeat(64), memoryHash: 'd'.repeat(64), environmentId: 'test'
};

function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-marks-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(dir, name, data) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.isBuffer(data) ? data : stringify(data));
  return file;
}

function pack(tick) {
  return { v: 1, root: { r: 0 }, objs: [
    { o: { matchNum: 3, roundNum: 2, tick, TICK_HZ: 64, cycle: { r: 0 }, map: { r: 1 }, again: { r: 1 },
      set: { r: 2 }, vector: { r: 3 }, nan: { n: 'NaN' }, missing: { u: 1 }, reg: { r: 4 }, date: { r: 5 } } },
    { m: [['root', { r: 0 }]] }, { s: [{ r: 1 }] }, { t: 'Float64Array', d: [{ n: '-0' }, { n: 'I' }, { n: '-I' }] },
    { re: ['a+', 'i'] }, { dt: 1000 }
  ] };
}

function attach(dir, name, bytes, codec, extra) {
  write(dir, name, bytes);
  return packed(name, bytes, codec, 1, extra);
}

function fixture(dir) {
  return {
    format: 'sim-cs2/mark', version: 2, identity: { ...identity }, owner: { text: '# Текст\nСледующая строка', bot: 'CT0' },
    snapshots: {
      moment: attach(dir, 'moment.json', Buffer.from(stringify(pack(100))), 'mkpack', { tick: 100 }),
      before: attach(dir, 'prior.json.gz', gzipSync(stringify(pack(90))), 'mkpack', { tick: 90 })
    },
    summary: { codec: 'legacy-mark-state', data: { bots: [{ id: 'CT0', place: 'Window', hp: 0, sees: [], lookReason: 'старая подпись' }] } }
  };
}

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

function ok(...args) {
  const result = run(...args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test('mkPack preserves graph identity, Map/Set, special numbers, undefined, Date and RegExp', () => {
  const state = decode(pack(100));
  assert.equal(state.cycle, state);
  assert.equal(state.map, state.again);
  assert.equal(state.map.get('root'), state);
  assert.ok(state.set.has(state.map));
  assert.ok(Object.is(state.vector[0], -0));
  assert.equal(state.vector[1], Infinity);
  assert.equal(state.vector[2], -Infinity);
  assert.ok(Number.isNaN(state.nan));
  assert.ok(Object.hasOwn(state, 'missing'));
  assert.equal(state.missing, undefined);
  assert.ok(state.reg.test('A'));
  assert.equal(+state.date, 1000);
  const unusual = decode(JSON.parse('{"v":1,"root":{"r":0},"objs":[{"o":{"__proto__":{"r":0}}}]}'));
  assert.equal(unusual.__proto__, unusual);
  assert.equal(Object.getPrototypeOf(unusual), Object.prototype);
});

test('check and unpack valid mark, keep checksum and byte-for-byte legacy gzip', t => {
  const dir = scratch(t);
  const mark = fixture(dir);
  const file = write(dir, 'mark.json', mark);
  const expected = write(dir, 'target.json', { ...identity, snapshotCodec: 'mkpack', snapshotVersion: 1 });
  const result = JSON.parse(ok('check', file, '--expect', expected, '--require-compatible'));
  assert.equal(result.compatibility, 'metadata-match');
  assert.equal(result.replay, 'not-run');
  assert.equal(result.snapshots.before.tick, 90);
  const out = path.join(dir, 'unpacked');
  ok('unpack', dir, out);
  const report = fs.readFileSync(path.join(out, 'mark.md'), 'utf8');
  assert.equal(report, ok('open', dir));
  assert.match(report, /CT0.*Window.*0.*старая подпись.*пустой список/);
  assert.match(report, /> # Текст\n> Следующая строка/);
  assert.deepEqual(fs.readFileSync(path.join(out, 'prior.json.gz')), fs.readFileSync(path.join(dir, 'prior.json.gz')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'decoded/before.mkpack.json'))), pack(90));
  assert.equal(run('unpack', dir, out).status, 1);
});

test('old document keeps asset references and recorded facts without inventing missing context', t => {
  const dir = scratch(t);
  const input = write(dir, 'legacy.json', {
    text: 'Запись владельца', match: 3, tick: 100, round: 2, snapAsset: 'existing-asset-id',
    state: { bots: [{ id: 'CT0', log: ['-1 с · позиция: смена'], sees: ['T1'] }] }, env: { build: 'v401' }
  });
  const out = path.join(dir, 'converted');
  const result = JSON.parse(ok('convert', input, out));
  assert.equal(result.identity.gameVersion, 'v401');
  assert.equal(result.identity.seed, undefined);
  assert.equal(result.identity.map, undefined);
  assert.equal(result.snapshots.moment, undefined);
  const md = ok('open', out);
  assert.match(md, /existing-asset-id/);
  assert.match(md, /CT0.*T1/);
  assert.match(md, /Отсутствует причинный след Р3/);
  const own = JSON.parse(fs.readFileSync(path.join(out, 'mark.json')));
  assert.equal(own.trace, undefined);
  assert.equal(own.diagnostics, undefined);
  assert.deepEqual(fs.readFileSync(path.join(out, 'legacy-source.json')), fs.readFileSync(input));
  const before = write(dir, 'before.json.gz', gzipSync(stringify(pack(90))));
  const raw = path.join(dir, 'before-only');
  assert.equal(run('convert', before, raw).status, 1);
  const converted = JSON.parse(ok('convert', before, raw, '--role=before'));
  assert.equal(converted.identity.tick, undefined);
  assert.equal(converted.snapshots.before.tick, 90);
});

test('incomplete mark is readable and cannot pass required compatibility', t => {
  const dir = scratch(t);
  write(dir, 'mark.json', { format: 'sim-cs2/mark', version: 2, identity: {} });
  const expected = write(dir, 'target.json', { seed: 0 });
  const result = JSON.parse(ok('check', dir, '--expect', expected));
  assert.equal(result.compatibility, 'unverified');
  assert.ok(result.notes.includes('Нельзя сверить поле с целевой средой: seed'));
  assert.equal(run('check', dir, '--expect', expected, '--require-compatible').status, 1);
});

test('reject metadata mismatch even if the data has a valid checksum', async t => {
  const dir = scratch(t);
  const mark = fixture(dir);
  for (const [key, value] of Object.entries({ gameVersion: 'v-other', seed: '0', map: 'ancient', snapshotVersion: 5 })) {
    await assert.rejects(inspect(mark, dir, { [key]: value }), /Несовпадение/);
  }
  mark.snapshots.before.tick = 91;
  await assert.rejects(inspect(mark, dir), /Внутренние метаданные/);
  mark.snapshots.before.tick = 100;
  await assert.rejects(inspect(mark, dir), /должен предшествовать/);
  mark.snapshots.before.tick = 90;
  mark.snapshots.before.identity = { map: 'ancient' };
  await assert.rejects(inspect(mark, dir), /Идентичность снимка/);
});

test('reject damaged checksums, truncated inputs, missing assets, malformed graph and newer schema version', async t => {
  const dir = scratch(t);
  const mark = fixture(dir);
  fs.appendFileSync(path.join(dir, 'moment.json'), ' ');
  await assert.rejects(inspect(mark, dir), /SHA-256/);
  fs.unlinkSync(path.join(dir, 'moment.json'));
  await assert.rejects(inspect(mark, dir), /ENOENT/);
  const bad = pack(100);
  bad.objs[0].o.cycle = { r: 10 };
  mark.snapshots.moment = attach(dir, 'moment.json', Buffer.from(stringify(bad)), 'mkpack', { tick: 100 });
  await assert.rejects(inspect(mark, dir), /вне таблицы/);
  mark.snapshots.moment.file = '../moment.json';
  await assert.rejects(inspect(mark, dir), /дескриптор/);
  const file = write(dir, 'broken.json', Buffer.from('{"format":'));
  assert.equal(run('check', file).status, 1);
  mark.version = 3;
  await assert.rejects(inspect(mark, dir), /Неизвестная схема/);
});

test('future registry and R3 trace stay opaque even with matching metadata', async t => {
  const dir = scratch(t);
  const mark = fixture(dir);
  mark.snapshots.moment = attach(dir, 'future.bin', Buffer.from([1, 2, 3]), 'future-codec', { registry: 'r3-v1', tick: 100 });
  delete mark.snapshots.before;
  mark.trace = { fromTick: 80, toTick: 100, asset: attach(dir, 'trace.bin', Buffer.from([4, 5]), 'r3-trace') };
  const expected = { ...identity, snapshotCodec: 'future-codec', snapshotVersion: 1, registry: 'r3-v1' };
  const result = await inspect(mark, dir, expected);
  assert.equal(result.compatibility, 'unverified');
  assert.ok(result.notes.some(note => note.includes('непрозрачное вложение')));
  assert.equal(result.assets.length, 2);
});

function event(seq, tick, outcome = 'counted') {
  return {
    seq, tick, phase: 'resolve', episode: 'same-incident', metric: 'stall', outcome, delta: 1, reason: 'example',
    sourceEvent: 'source-' + seq, actor: 'CT0', facts: { domain: 'observation', ref: 'facts-' + seq }
  };
}

function segment(dir, name, rows, round) {
  const data = gzipSync(rows.map(row => JSON.stringify(row) + '\n').join(''));
  return {
    kind: 'chunk', fromSeq: rows[0].seq, toSeq: rows.at(-1).seq + 1, round,
    fromTick: rows[0].tick, toTick: rows.at(-1).tick, asset: attach(dir, name, data, 'jsonl+gzip')
  };
}

function ledger(dir, rows, next, summary) {
  return {
    version: 1, session: 'test', match: 3, fromSeq: rows[0].seq, toSeq: next.at(-1).seq + 1,
    metrics: { stall: { revision: 'test-1', unit: 'bot-tick' } },
    segments: [segment(dir, 'chunk-1.jsonl.gz', rows, 1), segment(dir, 'chunk-2.jsonl.gz', next, 2)],
    summary: { stall: summary }
  };
}

test('diagnostics keeps every contribution beyond 400 and groups across round chunks by episode', async t => {
  const dir = scratch(t);
  const mark = fixture(dir);
  const rows = Array.from({ length: 405 }, (_, i) => event(i, i));
  const next = [event(405, 405, 'eligible'), event(406, 405, 'excluded'), event(407, 406, 'censored')];
  mark.diagnostics = ledger(dir, rows, next, { counted: 405, eligible: 1, excluded: 1, censored: 1 });
  write(dir, 'mark.json', mark);
  const result = await inspect(mark, dir);
  assert.equal(result.diagnostics.events, 408);
  assert.equal(result.diagnostics.reconciled, true);
  const evidence = ok('events', dir, '--episode=same-incident').trim().split('\n').map(JSON.parse);
  assert.equal(evidence.length, 408);
  assert.equal(evidence[407].reason, 'example');
  assert.equal(evidence[407].round, 2);
  assert.equal(ok('events', dir, '--round=2').trim().split('\n').length, 3);
});

test('diagnostics distinguishes explicit loss, wrong totals, repeated events and corrupt chunks', async t => {
  const dir = scratch(t);
  const mark = fixture(dir);
  const first = [event(0, 1)];
  const next = [event(2, 3)];
  mark.diagnostics = ledger(dir, first, next, { counted: 3, eligible: 0, excluded: 0, censored: 0 });
  await assert.rejects(inspect(mark, dir), /Разрыв/);
  mark.diagnostics.segments.splice(1, 0, { kind: 'gap', fromSeq: 1, toSeq: 2, reason: 'writer disconnected' });
  const result = await inspect(mark, dir);
  assert.equal(result.diagnostics.reconciled, false);
  assert.equal(result.diagnostics.dropped, 1);
  assert.equal(result.diagnostics.totals.stall.counted, 2);
  mark.diagnostics.summary.stall.counted = 1;
  await assert.rejects(inspect(mark, dir), /итог расходится/);
  mark.diagnostics.summary.stall.counted = 3;
  mark.diagnostics.segments[2] = segment(dir, 'chunk-2.jsonl.gz', [event(2, 3), event(2, 3), event(3, 4)], 2);
  mark.diagnostics.toSeq = 4;
  await assert.rejects(inspect(mark, dir), /Повтор или пропуск события/);
  mark.diagnostics.segments[2] = segment(dir, 'chunk-2.jsonl.gz', next, 2);
  mark.diagnostics.toSeq = 3;
  fs.truncateSync(path.join(dir, 'chunk-2.jsonl.gz'), 8);
  await assert.rejects(inspect(mark, dir), /unexpected end|SHA-256/i);
});

test('project checkpoints and R2.1 evidence convert with the original boundaries and bytes', t => {
  const dir = scratch(t);
  const root = path.resolve(__dirname, '../../..');
  const registry = path.join(root, 'rebuild/scenarios.json');
  const cases = [
    ['mir_jump360', 'mir_m1794418376570_v559_m3.5s.json.gz', 69014, 68790, 12],
    ['mir_stuck_window', 'mir_m1794418230042_pre.json.gz', 62402, 61440, 11]
  ];
  for (const [id, name, tick, earlier, round] of cases) {
    const before = path.join(root, 'tools/marks/snaps', name);
    const out = path.join(dir, id);
    const result = JSON.parse(ok('convert', registry, out, '--scenario', id, '--pre', before));
    assert.equal(result.identity.map, 'mirage');
    assert.equal(result.identity.match, 3);
    assert.equal(result.identity.round, round);
    assert.equal(result.identity.tick, tick);
    assert.equal(result.identity.seed, undefined);
    assert.equal(result.snapshots.before.tick, earlier);
    assert.equal(result.snapshots.moment, undefined);
    assert.deepEqual(fs.readFileSync(path.join(out, 'snapshot-before.json.gz')), fs.readFileSync(before));
    const md = fs.readFileSync(path.join(out, 'mark.md'), 'utf8');
    assert.ok(md.includes('Чекпоинт до отметки · тик ' + earlier));
    assert.match(md, /\| CT0 \|/);
  }
  const source = path.join(root, 'rebuild/evidence/R2/r2.1_test_mark.json');
  const out = path.join(dir, 'r2');
  const result = JSON.parse(ok('convert', source, out));
  assert.equal(result.identity.legacySourceHash, '0d4686fe73618d98');
  assert.equal(result.identity.tick, 2224);
  assert.equal(result.snapshots.before, undefined);
  const mark = JSON.parse(fs.readFileSync(path.join(out, 'mark.json')));
  assert.equal(mark.summary.codec, 'legacy-state-hashes');
  assert.equal(Object.keys(mark.summary.data).length, 648);
  assert.match(ok('open', out), /содержит хэши полей состояния/);
});

test('report renders verified R3.3 events with actor, tick, channel and owner data', t => {
  const dir = scratch(t);
  const mark = fixture(dir);
  const trace = { fromTick: 80, toTick: 100, on: true, by: {
    CT0: { _dlogA: [[94,'арбитр','отказ заявки',{why:'уровень выше'}]],
      _dlogK: [[90,'знание','слышал шаги']], _dlog2: [[99,'ход','держит угол']] }
  } };
  mark.trace = { fromTick:80, toTick:100, asset:attach(dir,'trace.json',Buffer.from(stringify(trace)),'sim-cs2/dlog') };
  write(dir,'mark.json',mark);
  const md = ok('open',dir);
  assert.match(md,/Причинный след решений/);
  assert.match(md,/90.*CT0.*знание.*слышал шаги[\s\S]*94.*CT0.*арбитр.*уровень выше[\s\S]*99.*держит угол/);
  trace.by.CT0._dlogA[0][0] = 110;
  mark.trace.asset = attach(dir,'trace.json',Buffer.from(stringify(trace)),'sim-cs2/dlog');
  write(dir,'mark.json',mark);
  assert.equal(run('check',dir).status,1);
});
