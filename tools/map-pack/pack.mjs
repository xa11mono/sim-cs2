import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { blockLocation, map3dBlocks, openMapPack, packHeader } from './load.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

export function readLegacyMap(name) {
  // Same field selection and stale-bake policy as the HTML and Node builders.
  const py = 'import sys; sys.path.insert(0, "src"); from mapset import map_js; print(map_js(sys.argv[1])[0])';
  const source = execFileSync(python, ['-c', py, name], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(source);
}

// JSON.stringify canonicalizes -0. Preserve it anywhere in the map object.
function exactJSON(value) {
  if (Object.is(value, -0)) return '-0';
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite map number');
  if (Array.isArray(value)) return '[' + value.map(exactJSON).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ':' + exactJSON(item)).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function packMap(source) {
  const map = structuredClone(source);
  const blocks = map3dBlocks.map(path => {
    const [parent, key] = blockLocation(map.map3d, path);
    if (!Object.hasOwn(parent, key)) return Buffer.alloc(0);
    const encoded = parent[key];
    const block = Buffer.from(encoded, 'base64');
    if (!block.length || block.toString('base64') !== encoded) throw new Error('Invalid map3d block: ' + path.join('.'));
    inflateSync(block); // validate zlib before writing
    parent[key] = null;
    return block;
  });
  const meta = Buffer.from(exactJSON({ map, lengths: blocks.map(block => block.length) }));
  return Buffer.concat([packHeader(meta.length), meta, ...blocks]);
}

export function verifyMapPack(source, bytes) {
  const map = openMapPack(bytes).createMatchMap();
  for (const path of map3dBlocks) {
    const [parent, key] = blockLocation(map.map3d, path);
    if (Object.hasOwn(parent, key)) parent[key] = Buffer.from(parent[key]).toString('base64');
  }
  assert.deepStrictEqual(map, source);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , name, out, ...options] = process.argv;
  if (!/^[a-z0-9][a-z0-9_]*$/.test(name) || !out || options.some(a => a !== '--strict')) {
    throw new Error('Usage: node tools/map-pack/pack.mjs MAP OUTPUT.simmap [--strict]');
  }
  if (options.includes('--strict')) {
    execFileSync(python, ['tools/map/map_check.py', name], { cwd: root, stdio: 'inherit' });
  }
  const source = readLegacyMap(name);
  const bytes = packMap(source);
  verifyMapPack(source, bytes);
  writeFileSync(out, bytes);
}
