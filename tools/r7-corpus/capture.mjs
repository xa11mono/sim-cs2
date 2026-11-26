import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { floatBits, loadEngine } from './reference.ts';

const [corePath, map, output, ticks = '5000', quota = '20'] = process.argv.slice(2);
if (!corePath || !['ancient', 'mirage'].includes(map) || !output ||
    !/^[1-9]\d*$/.test(ticks) || !/^[1-9]\d*$/.test(quota)) {
  throw new Error('Usage: node tools/r7-corpus/capture.mjs CORE.js ancient|mirage OUTPUT.json [TICKS] [QUOTA]');
}
const source = readFileSync(corePath, 'utf8');
let active = false;
const buckets = new Map();
const cases = [];
const capture = (kind, result, args, tick, parameters) => {
  if (!active) return;
  const positive = kind === 0 ? result !== 0 : kind === 1 ? result !== -1 : result !== null;
  const bucket = kind + ':' + positive;
  if (!buckets.has(bucket)) buckets.set(bucket, new Set());
  const seen = buckets.get(bucket);
  if (seen.size >= Number(quota)) return;
  let input;
  if (kind === 0) {
    const [a, b, q] = args;
    input = [a.x, a.y, b.x, b.y, q.x, q.y, q.w, ...parameters];
  } else if (kind === 1) {
    const [M, index, ...ray] = args;
    input = [...M.tri.subarray(index * 9, index * 9 + 9), ...ray];
  } else {
    const [planes, ...query] = args;
    input = [...query, ...parameters, ...planes];
  }
  const query = input.map(floatBits).join('');
  if (seen.has(query)) return;
  seen.add(query);
  cases.push([tick, kind, query, result === null ? '' : [result].flat().map(floatBits).join('')]);
};

const engine = loadEngine(source, capture);
assert.equal(engine('MAP.id'), map);
engine('freshMatch(3)');
active = true;
engine(`for (let i = 0; i < ${ticks}; i++) stepTick();`);
assert.equal(buckets.size, 6, 'Both outcomes of all three operations must occur');
const data = {
  schema: 1, map, match: 3, ticks: Number(ticks), quota: Number(quota),
  coreSHA256: createHash('sha256').update(source).digest('hex'),
  cases,
};
const json = JSON.stringify(data) + '\n';
writeFileSync(output, output.endsWith('.gz') ? gzipSync(json, { level: 9 }) : json);
console.log(map, Object.fromEntries([...buckets].map(([key, value]) => [key, value.size])));
