import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { blockLocation, map3dBlocks, packHeader } from './load.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

export function readLegacyMap(name) {
  // Same field selection and stale-bake policy as the HTML and Node builders.
  const py = 'import sys; sys.path.insert(0, "src"); from mapset import map_js; print(map_js(sys.argv[1])[0])';
  const source = execFileSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-c', py, name], {
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , name, out] = process.argv;
  if (!['ancient', 'mirage'].includes(name) || !out) {
    throw new Error('Usage: node tools/map-pack/pack.mjs ancient|mirage OUTPUT.simmap');
  }
  writeFileSync(out, packMap(readLegacyMap(name)));
}
