"""Разбор навмеша CS2 (.nav, версии 30–36) — перенос на Python из awpy.

Источник: https://github.com/pnxenopoulos/awpy, crates/awpy/src/nav.rs (коммит 1e87b5f, 13.10.2026),
лицензия MIT (c) 2020-2026 Peter Xenopoulos. Перенесено построчно: заголовок, KV3-заглушки версии 36, общая таблица
многоугольников (31+), записи участков. Сама раскладка — по ValveResourceFormat (ссылка в nav.rs).

read_nav(path) → {'version', 'sub_version', 'areas': [{'id', 'flags', 'hull', 'corners': [[x,y,z],…], 'conn': [id,…],
                   'ladders_above', 'ladders_below'}]} — координаты игры (Hammer units).
python3 tools/nav36.py <файл.nav> — сводка.
"""
import struct
import sys

MAGIC = 0xFEEDFACE
MIN_VERSION, MAX_VERSION = 30, 36


class Reader:
    def __init__(self, data):
        self.d, self.p = data, 0

    def take(self, n):
        if self.p + n > len(self.d):
            raise ValueError('nav: unexpected end of data')
        b = self.d[self.p:self.p + n]
        self.p += n
        return b

    def skip(self, n):
        self.take(n)

    def u8(self):
        return self.take(1)[0]

    def u32(self):
        return struct.unpack('<I', self.take(4))[0]

    def i32(self):
        return struct.unpack('<i', self.take(4))[0]

    def i64(self):
        return struct.unpack('<q', self.take(8))[0]

    def vec3(self):
        return list(struct.unpack('<3f', self.take(12)))

    def align8(self):
        self.skip((8 - self.p % 8) % 8)

    def skip_cstring(self):
        while self.u8() != 0:
            pass


def skip_kv3(r):
    """пропустить встроенный документ KV3 (в навах версии 36 — пустые заглушки)"""
    r.align8()
    magic = r.u32()
    if magic == 0x03564B56:
        raise ValueError('nav: KV3 v0 document not supported')
    ver = magic & 0xFF
    if magic & 0xFFFFFF00 != 0x4B563300 or not 1 <= ver <= 5:
        raise ValueError('nav: unsupported KV3 signature %#010x' % magic)
    if ver == 1:
        raise ValueError('nav: KV3 v1 document not supported')
    r.skip(16)                      # format GUID
    method = r.u32()                # 0 — без сжатия, 1 — LZ4, 2 — ZSTD
    r.skip(2 + 2)                   # dictionary id + frame size
    r.skip(4 * 4)                   # countBytes1/4/8 + countTypes
    r.skip(2 + 2)                   # countObjects + countArrays
    unc_total, cmp_total, n_blocks, n_blobs = r.i32(), r.i32(), r.i32(), r.i32()
    block_cmp = 0
    if ver >= 4:
        r.skip(4)                   # countBytes2
        block_cmp = r.i32()
    if ver >= 5:
        unc1, cmp1, unc2, cmp2 = r.i32(), r.i32(), r.i32(), r.i32()
        r.skip(4 * 8)
    else:
        unc1, cmp1, unc2, cmp2 = unc_total, cmp_total, 0, 0
    if method > 2:
        raise ValueError('nav: unsupported KV3 compression method %d' % method)
    if n_blocks or n_blobs:
        raise ValueError('nav: KV3 document with block/blob data unsupported')
    disk = (lambda u, c: u if method == 0 else c)
    r.skip(disk(unc1, cmp1) + disk(unc2, cmp2) + block_cmp)


def read_polygons(r, version):
    corners = [r.vec3() for _ in range(r.u32())]
    polys = []
    for _ in range(r.u32()):
        n = r.u8()
        polys.append([corners[r.u32()] for _ in range(n)])
        if version >= 35:
            r.skip(4)
    return polys


def read_ids(r):
    return [r.u32() for _ in range(r.u32())]


def read_area(r, version, polys):
    aid = r.u32()
    flags = r.i64()
    hull = r.u8()
    if polys is not None and version >= 31:
        corners = polys[r.u32()]
    else:
        corners = [r.vec3() for _ in range(r.u32())]
    r.skip(4)
    conn = []
    for _ in range(len(corners)):          # список соседей на каждое ребро
        for _ in range(r.u32()):
            conn.append(r.u32())
            r.u32()                        # edge id
    r.skip(5)                              # старые счётчики hiding spots / encounter paths
    return {'id': aid, 'flags': flags, 'hull': hull, 'corners': corners, 'conn': conn,
            'ladders_above': read_ids(r), 'ladders_below': read_ids(r)}


def read_nav(path):
    r = Reader(open(path, 'rb').read())
    if r.u32() != MAGIC:
        raise ValueError('nav: bad magic')
    version = r.u32()
    if not MIN_VERSION <= version <= MAX_VERSION:
        raise ValueError('nav: unsupported version %d' % version)
    sub = r.u32()
    r.u32()
    if version >= 36:
        skip_kv3(r)
    polys = read_polygons(r, version) if version >= 31 else None
    if version >= 32:
        r.skip(4)
    if version >= 35:
        for _ in range(r.u32()):
            r.skip_cstring()
            r.skip(48)
    if version >= 36:
        skip_kv3(r)
    areas = [read_area(r, version, polys) for _ in range(r.u32())]
    return {'version': version, 'sub_version': sub, 'areas': areas, 'tail': len(r.d) - r.p}


if __name__ == '__main__':
    N = read_nav(sys.argv[1])
    A = N['areas']
    hulls = {}
    for a in A:
        hulls[a['hull']] = hulls.get(a['hull'], 0) + 1
    xs = [c[0] for a in A for c in a['corners']]
    ys = [c[1] for a in A for c in a['corners']]
    zs = [c[2] for a in A for c in a['corners']]
    print('version %d.%d, areas %d, hulls %s, bytes left %d' % (N['version'], N['sub_version'], len(A), hulls, N['tail']))
    print('x %.0f..%.0f  y %.0f..%.0f  z %.0f..%.0f' % (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)))
    fl = {}
    for a in A:
        fl[a['flags']] = fl.get(a['flags'], 0) + 1
    print('flags', sorted(fl.items(), key=lambda t: -t[1])[:12])
