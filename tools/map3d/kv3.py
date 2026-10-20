#!/usr/bin/env python3
"""Чтение файлов ресурсов Source 2 (*_c) и двоичного KV3 (версии 2–5) — без сторонних библиотек (zstd — системный libzstd,
LZ4 — свой разбор блока). Устройство повторяет ValveResourceFormat (BinaryKV3.cs, MIT): заголовок → буфер 1 (строки + «полосы»
1/2/4/8 байт) → буфер 2 (v5: длины объектов, полосы, типы) → блобы; дерево читается по байтам типов.
  import kv3; blocks = kv3.resource_blocks(data)  → {'DATA': bytes, 'PHYS': bytes, …};  obj = kv3.parse(blocks['PHYS'])
  блобы приходят как bytes; объекты — dict, массивы — list (типизированный массив чисел — list).
  kv3.murmur2(s) — хеш имён Source 2 (MurmurHash2, нижний регистр, seed 0x31415926): поверхности, ключи сущностей."""
import struct, ctypes

_Z = None
def _zstd(src, size):
    global _Z
    if _Z is None:
        _Z = ctypes.CDLL('libzstd.so.1')
        for fn in ('ZSTD_decompress', 'ZSTD_findFrameCompressedSize'): getattr(_Z, fn).restype = ctypes.c_size_t
        _Z.ZSTD_isError.restype = ctypes.c_uint
    buf = ctypes.create_string_buffer(max(1, size)); r = _Z.ZSTD_decompress(buf, size, src, len(src))
    assert not _Z.ZSTD_isError(r) and r == size, 'zstd'
    return buf.raw[:r]

def _lz4_block(src, size, out=None):
    """блок LZ4; out — уже распакованное (словарь для цепочки блоков), дописывается"""
    out = bytearray() if out is None else out; start = len(out); i = 0; n = len(src)
    while i < n:
        tok = src[i]; i += 1; L = tok >> 4
        if L == 15:
            while True:
                b = src[i]; i += 1; L += b
                if b != 255: break
        out += src[i:i + L]; i += L
        if i >= n: break
        off = src[i] | (src[i + 1] << 8); i += 2; M = tok & 15
        if M == 15:
            while True:
                b = src[i]; i += 1; M += b
                if b != 255: break
        M += 4; s = len(out) - off
        for k in range(M): out.append(out[s + k])
    assert len(out) - start == size or size < 0, 'lz4'
    return bytes(out[start:])

def _unpack(method, src, size):
    if method == 0: return src[:size]
    if method == 1: return _lz4_block(src, size)
    if method == 2: return _zstd(src, size)
    raise ValueError('сжатие %d' % method)

def resource_blocks(d):
    """файл ресурса Source 2 → {тип блока: байты}"""
    fsize, hv, rv, boff, bcnt = struct.unpack_from('<IHHII', d, 0); q = 8 + boff; out = {}
    for i in range(bcnt):
        t = d[q:q + 4].decode('latin1'); off, sz = struct.unpack_from('<II', d, q + 4)
        out.setdefault(t, d[q + 4 + off:q + 4 + off + sz]); q += 12
    return out

class _Lane:
    __slots__ = ('b', 'p')
    def __init__(self, b): self.b, self.p = b, 0
    def take(self, fmt, n):
        v = struct.unpack_from(fmt, self.b, self.p)[0]; self.p += n; return v

class _Buf:
    def __init__(self, raw, off, c1, c2, c4, c8):
        def al(o, a): return (o + a - 1) // a * a
        self.b1 = _Lane(raw[off:off + c1]); off += c1
        if c2: off = al(off, 2)
        self.b2 = _Lane(raw[off:off + 2 * c2]); off += 2 * c2
        if c4: off = al(off, 4)
        self.b4 = _Lane(raw[off:off + 4 * c4]); off += 4 * c4
        if c8: off = al(off, 8)
        self.b8 = _Lane(raw[off:off + 8 * c8]); off += 8 * c8
        self.end = off

def parse(d):
    magic = struct.unpack_from('<I', d, 0)[0]; ver = magic & 0xFF
    assert (magic >> 8) == 0x4B5633 and 2 <= ver <= 5, 'KV3 v%d?' % ver
    p = 20
    (method, dict_id, frame, c1, c4, c8, ctypes_, cobj, carr, unc_tot, cmp_tot, nblocks, blob_bytes) = struct.unpack_from('<IHHIIIIHHIIII', d, p)
    p += struct.calcsize('<IHHIIIIHHIIII'); c2 = 0
    if ver >= 4: c2, blk_sizes_bytes = struct.unpack_from('<II', d, p); p += 8
    if ver >= 5:
        (u1, k1, u2, k2, b1_2, b2_2, b4_2, b8_2, nnodes, cobj2, carr2, nelem) = struct.unpack_from('<12I', d, p); p += 48
    else:
        u1, k1 = unc_tot, cmp_tot
    if ver >= 5:
        raw1 = _unpack(method, d[p:p + (k1 if method else u1)], u1); p += (k1 if method else u1)
        raw2 = _unpack(method, d[p:p + (k2 if method else u2)], u2); p += (k2 if method else u2)
        B1 = _Buf(raw1, 0, c1, c2, c4, c8)
        nstr = B1.b4.take('<i', 4); strs = []
        for i in range(nstr):
            e = B1.b1.b.index(b'\0', B1.b1.p); strs.append(B1.b1.b[B1.b1.p:e].decode('utf-8', 'replace')); B1.b1.p = e + 1
        objlen = _Lane(raw2[:4 * cobj2])
        B2 = _Buf(raw2, 4 * cobj2, b1_2, b2_2, b4_2, b8_2)
        types = raw2[B2.end:B2.end + ctypes_]; rest = raw2[B2.end + ctypes_:]
        main, aux = B2, B1
        if nblocks:
            blens = struct.unpack_from('<%di' % nblocks, rest, 0)
            assert struct.unpack_from('<I', rest, 4 * nblocks)[0] == 0xFFEEDD00
            if method == 1:
                # LZ4: блобы — цепочка блоков, длины сжатых блоков (u16) — после таблицы длин блобов
                q = 4 * nblocks + 4; hist = bytearray()
                while len(hist) < blob_bytes:
                    cl = struct.unpack_from('<H', rest, q)[0]; q += 2
                    _lz4_block(d[p:p + cl], -1, hist); p += cl
                blobs = bytes(hist[:blob_bytes])
            elif method == 2:
                blobs = _zstd(d[p:p + cmp_tot - k1 - k2], blob_bytes)
            else:
                blobs = d[p:p + blob_bytes]
        else:
            blens, blobs = (), b''
    else:
        tot = u1 + (blob_bytes if (method == 2 and nblocks) else 0)
        if method == 2:
            # zstd до v5: буфер и блобы — два кадра подряд или один; распаковать целиком
            raw1 = _zstd(d[p:p + cmp_tot], tot); blobs_inline = raw1[u1:]
        else:
            raw1 = _unpack(method, d[p:p + (cmp_tot if method else u1)], u1); blobs_inline = b''
        B1 = _Buf(raw1, 0, c1, c2, c4, c8); off = B1.end
        nstr = B1.b4.take('<i', 4); strs = []
        for i in range(nstr):
            e = raw1.index(b'\0', off); strs.append(raw1[off:e].decode('utf-8', 'replace')); off = e + 1
        tl = ctypes_ - (off - B1.end)
        types = raw1[off:off + tl]; off += tl
        main = aux = B1; objlen = None
        if nblocks:
            blens = struct.unpack_from('<%di' % nblocks, raw1, off)
            blobs = blobs_inline
            assert method != 1, 'LZ4 с блобами не поддержано'
        else:
            blens, blobs = (), b''
    st = {'t': 0, 'bl': 0, 'bo': 0}
    def rtype():
        b = types[st['t']]; st['t'] += 1; fl = 0
        if ver >= 3:
            if b & 0x80: fl = types[st['t']]; st['t'] += 1
            if b & 0x40: st['t'] += 1
            b &= 0x3F
        else:
            if b & 0x80: fl = types[st['t']]; st['t'] += 1
            b &= 0x7F
        return b, fl
    def gs(i): return strs[i] if 0 <= i < len(strs) else ''
    def val(t, lane):
        if t == 1: return None
        if t == 13: return True
        if t == 14: return False
        if t in (15, 26): return 0
        if t in (16, 27): return 1
        if t == 17: return 0.0
        if t == 18: return 1.0
        if t == 2: return lane.b1.take('<B', 1) != 0
        if t == 22: return lane.b1.take('<b', 1)
        if t == 23: return lane.b1.take('<B', 1)
        if t == 20: return lane.b2.take('<h', 2)
        if t == 21: return lane.b2.take('<H', 2)
        if t == 11: return lane.b4.take('<i', 4)
        if t == 12: return lane.b4.take('<I', 4)
        if t == 19: return lane.b4.take('<f', 4)
        if t == 3: return lane.b8.take('<q', 8)
        if t == 4: return lane.b8.take('<Q', 8)
        if t == 5: return lane.b8.take('<d', 8)
        if t == 6: return gs(main.b4.take('<i', 4))
        if t == 7:
            n = blens[st['bl']]; st['bl'] += 1; o = st['bo']; st['bo'] += n; return blobs[o:o + n]
        if t == 8:
            n = main.b4.take('<i', 4); return [val(*rt_lane(main)) for _ in range(n)]
        if t in (10, 24, 25):
            n = main.b4.take('<i', 4) if t == 10 else main.b1.take('<B', 1)
            st_, fl = rtype(); ln = aux if t == 25 else main
            return [val(st_, ln) for _ in range(n)]
        if t == 9:
            n = objlen.take('<i', 4) if objlen is not None else main.b4.take('<i', 4); o = {}
            for _ in range(n):
                tt, fl = rtype(); k = gs(main.b4.take('<i', 4)); o[k] = val(tt, main)
            return o
        raise ValueError('тип KV3 %d' % t)
    def rt_lane(lane):
        t, fl = rtype(); return t, lane
    t, fl = rtype()
    return val(t, main)

def murmur2(s, seed=0x31415926):
    data = s.lower().encode('utf-8'); M = 0x5bd1e995; h = (seed ^ len(data)) & 0xFFFFFFFF; i = 0
    while len(data) - i >= 4:
        k = struct.unpack_from('<I', data, i)[0]; k = (k * M) & 0xFFFFFFFF; k ^= k >> 24; k = (k * M) & 0xFFFFFFFF
        h = ((h * M) & 0xFFFFFFFF) ^ k; i += 4
    r = len(data) - i
    if r:
        tail = 0
        for j in range(len(data) - 1, i - 1, -1): tail = (tail << 8) | data[j]
        h = ((h ^ tail) * M) & 0xFFFFFFFF
    h ^= h >> 13; h = (h * M) & 0xFFFFFFFF; h ^= h >> 15
    return h
