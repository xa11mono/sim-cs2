import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { openMapPack } from './load.mjs';

const { compressed, triangles } = workerData;
const match = openMapPack(compressed).createMatchMap();
const block = match.map3d.prims.tri;
assert(block.buffer instanceof SharedArrayBuffer);
assert.equal(block.buffer, compressed.buffer);
assert(triangles.buffer instanceof SharedArrayBuffer);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
parentPort.postMessage({
  compressed: hash(block),
  triangles: hash(new Uint8Array(triangles.buffer)),
});
