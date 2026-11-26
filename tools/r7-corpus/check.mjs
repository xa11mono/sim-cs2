import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { floatBits, loadEngine, runReference } from './reference.ts';

const [corePath, corpusPath, native, wasm] = process.argv.slice(2);
if (!corePath || !corpusPath || !native || !wasm) {
  throw new Error('Usage: node tools/r7-corpus/check.mjs CORE.js CORPUS.json NATIVE_BINARY KERNEL.wasm');
}
const file = readFileSync(corpusPath);
const corpus = JSON.parse((corpusPath.endsWith('.gz') ? gunzipSync(file) : file).toString('utf8'));
const engine = loadEngine(readFileSync(corePath, 'utf8'));
assert(corpus.schema === 1 && corpus.map === engine('MAP.id') && corpus.cases.length > 0);
const wire = (value) => value === null ? '' : [value].flat().map(floatBits).join('');
const { instance } = await WebAssembly.instantiate(readFileSync(wasm));
const abi = instance.exports;
const requests = [];
const expected = [];
const stats = Array.from({ length: 3 }, () => ({ cases: 0, hits: 0, misses: 0 }));
for (const [index, [tick, kind, input, result]] of corpus.cases.entries()) {
  const where = `${corpus.map} match ${corpus.match} tick ${tick} case ${index}, operation ${kind}`;
  assert(kind === 0 || kind === 1 || kind === 2, where);
  assert(Number.isInteger(tick) && tick >= 0 && tick <= corpus.ticks, where);
  assert(/^(?:[0-9a-f]{16})+$/.test(input), where);
  assert(/^(?:[0-9a-f]{16})*$/.test(result), where);
  const bytes = Buffer.from(input, 'hex');
  const size = bytes.length / 8;
  const values = Array.from({ length: size }, (_, i) => bytes.readDoubleLE(i * 8));
  const reference = runReference(engine, kind, values);
  assert.equal(wire(reference), result, 'TS fixture mismatch at ' + where);
  const hit = !(kind === 0 ? reference === 0 : kind === 1 ? reference === -1 : reference === null);
  stats[kind].cases++;
  stats[kind][hit ? 'hits' : 'misses']++;

  const data = abi.allocate(size), out = abi.allocate(4);
  try {
    new Uint8Array(abi.memory.buffer, data, bytes.length).set(bytes);
    const length = abi.request(kind, data, size, out);
    assert(length >= 0 && length <= 4, 'Invalid WASM response at ' + where);
    const actual = Buffer.from(abi.memory.buffer, out, length * 8).toString('hex');
    assert.equal(actual, result, 'WASM mismatch at ' + where);
  } finally {
    abi.release(data, size);
    abi.release(out, 4);
  }
  const header = Buffer.alloc(3);
  header[0] = kind;
  header.writeUInt16LE(size, 1);
  requests.push(header, bytes);
  expected.push({ result, where });
}

const processResult = spawnSync(native, { input: Buffer.concat(requests), maxBuffer: 16 * 1024 * 1024 });
if (processResult.error) throw processResult.error;
assert.equal(processResult.status, 0, processResult.stderr.toString());
let offset = 0;
for (const { result, where } of expected) {
  const count = processResult.stdout[offset++];
  assert(count >= 0 && count <= 4, 'Invalid native response at ' + where);
  const length = count * 8;
  assert.equal(processResult.stdout.subarray(offset, offset + length).toString('hex'), result, 'Native mismatch at ' + where);
  offset += length;
}
assert.equal(offset, processResult.stdout.length, 'Excess bytes in native response');
assert(stats.every(row => row.hits > 0 && row.misses > 0), 'Incomplete branch coverage');
console.log(JSON.stringify({ map: corpus.map, total: corpus.cases.length, stats, native: 'bit-exact', wasm: 'bit-exact' }));
