import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import { Worker } from 'node:worker_threads';
import { blockLocation, loadSharedGeometry, map3dBlocks, openMapPack } from './load.mjs';
import { readLegacyMap, packMap } from './pack.mjs';
import { enableBinaryGeometry } from './geometry-adapter.mjs';

const require = createRequire(import.meta.url);
const geom = readFileSync(new URL('../../engine/map/geometry3d.js', import.meta.url), 'utf8');
const adapted = { exports: {} };
new Function("module", "DM", enableBinaryGeometry(geom))(adapted, { hypot: Math.hypot, hypot3: Math.hypot });
const { m3Load, m3Hit, m3Floors, m3NadeTrace } = adapted.exports;
const manifest = require('../map/map_manifest.json');
const numericFields = new Map();

function checkNumbers(path, expected, actual) {
  if (typeof expected === 'number') {
    assert(Object.is(actual, expected), path.join('.'));
    const key = path[0];
    if (!numericFields.has(key)) numericFields.set(key, { count: 0, hash: createHash('sha256') });
    const entry = numericFields.get(key);
    const bits = Buffer.alloc(8);
    bits.writeDoubleLE(actual);
    entry.count++;
    entry.hash.update(bits);
  } else if (expected !== null && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual), Object.keys(expected), path.join('.'));
    for (const key of Object.keys(expected)) checkNumbers([...path, key], expected[key], actual[key]);
  } else {
    assert.equal(actual, expected, path.join('.'));
  }
}

function runWorker(bytes) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker-check.mjs', import.meta.url), { workerData: bytes });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', code => { if (code) reject(new Error('Map worker exited ' + code)); });
  });
}

const evidence = {};
for (const name of ['ancient', 'mirage']) {
  numericFields.clear();
  const legacy = readLegacyMap(name);
  const packed = packMap(legacy);
  const duplicate = packMap(legacy);
  assert(packed.equals(duplicate), 'Package must be reproducible');
  const shared = new Uint8Array(new SharedArrayBuffer(packed.length));
  shared.set(packed);
  const { createMatchMap } = openMapPack(shared);
  const a = createMatchMap();
  const b = createMatchMap();
  const manifestFields = new Set(manifest.items.filter(row => row.file !== '-').map(row => row.file.slice(0, -5)));
  for (const key of manifestFields) {
    if (key === 'map' || key === 'demorounds') continue; // map.json is flattened, demorounds is optional.
    assert(Object.hasOwn(a, key), 'Missing manifest field ' + key);
  }
  assert.throws(() => openMapPack(packed.subarray(0, -1)));
  assert.throws(() => openMapPack(Buffer.concat([packed, Buffer.of(0)])));
  assert.throws(() => openMapPack(Buffer.from('invalid signature')));

  let blockCount = 0;
  let rawBytes = 0;
  const restored = structuredClone(a);
  map3dBlocks.forEach(path => {
    const [parent, key] = blockLocation(legacy.map3d, path);
    if (!Object.hasOwn(parent, key)) return;
    const [from, field] = blockLocation(a.map3d, path);
    const [other] = blockLocation(b.map3d, path);
    const [copy] = blockLocation(restored.map3d, path);
    assert.equal(from[field], other[field]);
    assert.equal(from[field].buffer, shared.buffer);
    const compressed = Buffer.from(from[field]);
    assert.equal(compressed.toString('base64'), parent[key]);
    const raw = inflateSync(compressed);
    assert(raw.equals(inflateSync(Buffer.from(parent[key], 'base64'))), path.join('.'));
    rawBytes += raw.length;
    blockCount++;
    copy[field] = compressed.toString('base64');
  });
  checkNumbers([], legacy, restored);
  const withNegativeZero = { ...legacy, probe: [0, -0, -Number.MIN_VALUE, Number.MAX_VALUE] };
  const roundTrip = openMapPack(packMap(withNegativeZero)).createMatchMap();
  assert.deepEqual(roundTrip.probe, withNegativeZero.probe);
  a.navmesh.areas[0].points[0].x++;
  assert.equal(b.navmesh.areas[0].points[0].x, legacy.navmesh.areas[0].points[0].x);
  a.zones.zonemap.zones[0].points.reverse();
  assert.deepEqual(b.zones.zonemap, legacy.zones.zonemap);

  const create = loadSharedGeometry(b, m3Load, inflateSync);
  const m1 = create();
  const m2 = create();
  const old = m3Load(legacy.map3d, inflateSync);
  // Compare materialized arrays and bucket lists, including deferred layers.
  old.nade = old.cols(old.J.nade);
  old.skyArr();
  assert.deepEqual(Object.keys(m1).sort(), Object.keys(old).concat('fill').sort());
  for (const key of Object.keys(old)) {
    if (['J', 'cols', 'skyArr'].includes(key)) continue;
    assert.deepEqual(m1[key], old[key], key);
  }
  for (const key of ['tri', 'triZ', 'hullP', 'bTri', 'bHull', 'sight', 'floors', 'sky', 'nade']) {
    assert.equal(m1[key], m2[key], key);
  }
  assert.notEqual(m1.bSeen, m2.bSeen);
  assert.notEqual(m1.fill, m2.fill);
  const points = b.navmesh.areas.map(area => area.points[0]);
  const stride = Math.ceil(points.length / 32);
  let rays = 0;
  for (let i = stride; i < points.length; i += stride) {
    const p = points[i - stride], q = points[i];
    const h = (M, kind) => {
      const z1 = m3Floors(M, p.x, p.y)[0] || 0, z2 = m3Floors(M, q.x, q.y)[0] || 0;
      return m3Hit(M, p.x, p.y, z1 + 40, q.x, q.y, z2 + 40, kind);
    };
    for (const kind of ['sight', 'nade']) {
      const stamp = m2.bStamp;
      assert.deepEqual(h(m1, kind), h(old, kind));
      assert.equal(m2.bStamp, stamp);
      assert.deepEqual(h(m2, kind), h(old, kind));
      rays++;
    }
  }
  assert(m1.bStamp > 0 && m2.bSeen.some(value => value !== 0), 'ray scratch should be exercised');
  let grenadeTraces = 0;
  for (let i = 0; i < points.length; i += stride) {
    const p = points[i];
    const z = m3Floors(old, p.x, p.y)[0] ?? 0;
    const scale = old.unit / old.cell;
    const start = [old.X0 + p.x * scale, old.Y0 - p.y * scale, z + 40];
    const end = [start[0], start[1], z - 40];
    const stamp = m2.nStamp;
    const expected = m3NadeTrace(old, start, end, 2);
    assert.deepEqual(m3NadeTrace(m1, start, end, 2), expected);
    assert.equal(m2.nStamp, stamp);
    assert.deepEqual(m3NadeTrace(m2, start, end, 2), expected);
    grenadeTraces++;
  }
  for (const key of ['nTriSeen', 'nHullSeen', 'nTriPl', 'nHullPl', 'nTriXY']) {
    assert(m1[key] && m2[key] && m1[key] !== m2[key], key);
  }
  // A SAB representation is shareable across worker isolates. The ordinary
  // array-of-arrays bucket index is still local until a flat format exists.
  const triBytes = new Uint8Array(m1.tri.buffer);
  const sharedTri = new Float32Array(new SharedArrayBuffer(triBytes.length));
  new Uint8Array(sharedTri.buffer).set(triBytes);
  const payload = { compressed: shared, triangles: sharedTri };
  const workers = await Promise.all([runWorker(payload), runWorker(payload)]);
  assert.deepEqual(workers, [workers[0], workers[0]]);
  assert.equal(workers[0].triangles, createHash('sha256').update(triBytes).digest('hex'));
  evidence[name] = {
    packageBytes: packed.length,
    packageSHA256: createHash('sha256').update(packed).digest('hex'),
    legacyJSONBytes: Buffer.byteLength(JSON.stringify(legacy)),
    blocks: blockCount,
    inflatedBlockBytes: rawBytes,
    sharedTriangleBytes: m1.tri.byteLength + m1.triZ.byteLength,
    localRayScratchBytes: m1.bSeen.byteLength,
    rays,
    grenadeTraces,
    sharedTriangleWorkerBytes: sharedTri.byteLength,
    workers: workers.length,
    fields: Object.fromEntries([...numericFields].map(([key, { count, hash }]) => [key, { count, sha256Float64LE: hash.digest('hex') }])),
  };
  console.log(name, blockCount, 'binary blocks,', rawBytes, 'inflated bytes,', rays, 'paired rays');
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(evidence, null, 2) + '\n');
