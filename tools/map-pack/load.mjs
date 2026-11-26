// V1: magic, uint32 LE JSON byte length, UTF-8 JSON, compressed map3d blocks.
const MAGIC = 'SIMMAP01';
const HEADER_BYTES = 12;

// Types are those already consumed by engine/map/geometry3d.js. Blocks retain
// their original zlib representation. Non-binary fields remain ordinary JSON.
export const map3dBlocks = [
  ...['sight', 'nade', 'sky'].flatMap(layer => ['n', 'lo', 'hi', 'mat'].map(key => [layer, key])),
  ...['n', 'z', 'kind'].map(key => ['floors', key]),
  ['sky_z'],
  ...['v', 'tri', 'tri_flag', 'tri_mat', 'hull_n', 'hull_p', 'hull_box', 'hull_flag', 'hull_mat'].map(key => ['prims', key]),
];

export function blockLocation(geometry, path) {
  return [path.length === 1 ? geometry : geometry[path[0]], path.at(-1)];
}

export function packHeader(length) {
  const out = new Uint8Array(HEADER_BYTES);
  out.set(new TextEncoder().encode(MAGIC));
  new DataView(out.buffer).setUint32(8, length, true);
  return out;
}

export function openMapPack(bytes) {
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  if (bytes.length < HEADER_BYTES || utf8.decode(bytes.subarray(0, 8)) !== MAGIC) {
    throw new Error('Invalid map package signature');
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset, HEADER_BYTES);
  const end = HEADER_BYTES + header.getUint32(8, true);
  if (end > bytes.length) throw new Error('Truncated map metadata');
  // TextDecoder implementations may reject SharedArrayBuffer views.
  const json = utf8.decode(Uint8Array.from(bytes.subarray(HEADER_BYTES, end)));
  const { map, lengths } = JSON.parse(json);
  if (!map?.map3d || !Array.isArray(lengths) || lengths.length !== map3dBlocks.length) {
    throw new Error('Invalid map package metadata');
  }
  const blocks = [];
  let offset = end;
  map3dBlocks.forEach((path, index) => {
    const length = lengths[index];
    const [parent, key] = blockLocation(map.map3d, path);
    if (!parent || !Number.isSafeInteger(length) || length < 0 || (!length && key !== 'mat') || offset + length > bytes.length ||
        (length ? parent[key] !== null : Object.hasOwn(parent, key))) {
      throw new Error('Invalid map block: ' + path.join('.'));
    }
    blocks.push(bytes.subarray(offset, offset + length));
    offset += length;
  });
  if (offset !== bytes.length) throw new Error('Unexpected bytes after map blocks');

  function createMatchMap() {
    const result = structuredClone(map);
    map3dBlocks.forEach((path, index) => {
      if (!lengths[index]) return;
      const [parent, key] = blockLocation(result.map3d, path);
      parent[key] = blocks[index];
    });
    return result;
  }
  return { createMatchMap };
}

// The prototype launcher passes the existing engine's loader here. Fill,
// ray stamps and the ray's visited-bucket array belong to each match.
export function loadSharedGeometry(map, decode, inflate) {
  const base = decode(map.map3d, inflate);
  base.nade = base.cols(base.J.nade);
  base.skyArr();
  return function createMatchGeometry() {
    return { ...base, fill: [], bSeen: new Uint32Array(base.bSeen.length), bStamp: 0 };
  };
}
