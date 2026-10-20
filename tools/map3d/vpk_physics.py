#!/usr/bin/env python3
"""Геометрия столкновений карты из файла игры (20.10.2026): python3 tools/map3d/vpk_physics.py <de_карта.vpk> <карта>
Пишет data/maps/<карта>/geom3d/world_physics.npz: треугольные сетки (mesh_v, mesh_t, mesh_id) и выпуклые блоки (hull_v / hull_vn —
вершины и их число на блок, hull_p / hull_pn — плоскости n·p = d и их число). Координаты — единицы игры (как в демках).
Как устроено (без сторонних библиотек: VPK v2 разбирается здесь, zstd — системный libzstd через ctypes):
  vpk → maps/<карта>/world_physics.vmdl_c → блок PHYS = двоичный KV3 v5 (сжатие zstd: буфер 0, буфер 1, блобы) → таблица размеров
  блобов (13 555 у Mirage) ищется в буфере 1 по сумме → блобы: блок «n байт вершин half-edge, 12n байт координат, рёбра, F байт
  граней, 16F байт плоскостей» = выпуклый блок; пара «треугольники u32×3, вершины f32×3» = сетка.
Что пока не разобрано: материал поверхности (для прострелов) и группа столкновений (стена для пуль / невидимая стена для игроков) —
нужен разбор структуры KV3 (буфер 0). Сетка «небо» (skybox, вся карта, z 946–1024) — отдельным слоем sky_v / sky_t (для гранат), в уровень не входит; находится по высоте — проверять на каждой карте."""
import sys, os, struct, json, ctypes
import numpy as np
VPK, MAPN = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'maps', MAPN, 'geom3d')
d = open(VPK, 'rb').read()
sig, ver, tree = struct.unpack_from('<III', d, 0); hdr = 28 if ver == 2 else 12
p = hdr; files = {}
def cstr():
    global p
    e = d.index(b'\0', p); s = d[p:e].decode('utf-8', 'replace'); p = e + 1; return s
while True:
    ext = cstr()
    if not ext: break
    while True:
        path = cstr()
        if not path: break
        while True:
            name = cstr()
            if not name: break
            crc, pre, arch, off, ln, term = struct.unpack_from('<IHHIIH', d, p); p += 18 + pre
            files[path + '/' + name + '.' + ext] = (hdr + tree + off, ln)
o, n = files['maps/%s/world_physics.vmdl_c' % os.path.basename(VPK)[:-4]]; vm = d[o:o + n]
fsize, hv, rv, boff, bcnt = struct.unpack_from('<IHHII', vm, 0); q = 8 + boff; phys = None
for i in range(bcnt):
    t = vm[q:q + 4].decode(); off, sz = struct.unpack_from('<II', vm, q + 4)
    if t == 'PHYS': phys = vm[q + 4 + off:q + 4 + off + sz]
    q += 12
Z = ctypes.CDLL('libzstd.so.1')
for fn in ('ZSTD_decompress', 'ZSTD_findFrameCompressedSize'): getattr(Z, fn).restype = ctypes.c_size_t
Z.ZSTD_isError.restype = ctypes.c_uint
assert struct.unpack_from('<I', phys, 20)[0] == 2, 'ожидалось сжатие zstd'
blockCount, blockTotal = struct.unpack_from('<II', phys, 20 + 36)
parts = []; i = phys.find(b'\x28\xb5\x2f\xfd'); caps = None
while i >= 0 and len(parts) < 3:
    cs = Z.ZSTD_findFrameCompressedSize(phys[i:], len(phys) - i)
    cap = blockTotal + 16 if len(parts) == 2 else 64 << 20
    buf = ctypes.create_string_buffer(cap); r = Z.ZSTD_decompress(buf, cap, phys[i:i + cs], cs)
    assert not Z.ZSTD_isError(r); parts.append(buf.raw[:r]); i += cs
b1, blobs = parts[1], parts[2]
sizes = None
for off in range(4):
    a = np.frombuffer(b1[off:off + ((len(b1) - off) // 4) * 4], dtype='<u4').astype(np.int64)
    cs = np.concatenate([[0], np.cumsum(a)]); idx = np.where(cs[blockCount:] - cs[:-blockCount] == blockTotal)[0]
    if len(idx): sizes = a[idx[0]:idx[0] + blockCount]; break
assert sizes is not None, 'таблица размеров блобов не найдена'
offs = np.concatenate([[0], np.cumsum(sizes)]); L = [int(s) for s in sizes]
B = lambda k: blobs[offs[k]:offs[k + 1]]
hulls, used = [], set()
for k in range(len(L) - 4):
    nv = L[k]
    if 4 <= nv <= 255 and L[k + 1] == 12 * nv and L[k + 2] % 4 == 0 and L[k + 2] > 0 and 4 <= L[k + 3] <= 255 and L[k + 4] == 16 * L[k + 3]:
        v = np.frombuffer(B(k + 1), dtype='<f4').reshape(-1, 3); pl = np.frombuffer(B(k + 4), dtype='<f4').reshape(-1, 4)
        if np.all(np.abs(pl[:, :3]) <= 1.001): hulls.append((v, pl)); used.update(range(k, k + 5))
meshes = []
for k in range(len(L) - 1):
    if k in used or L[k] % 12 or L[k + 1] % 12 or not L[k] or not L[k + 1]: continue
    t = np.frombuffer(B(k), dtype='<u4'); v = np.frombuffer(B(k + 1), dtype='<f4').reshape(-1, 3)
    if np.all(np.isfinite(v)) and np.abs(v).max() < 20000 and len(v) >= 3 and len(t) >= 3 and t.max() < len(v):
        meshes.append((v, t.reshape(-1, 3)))
sky = [k for k, (v, t) in enumerate(meshes) if v[:, 2].max() > 900 and np.ptp(v[:, 0]) > 3000]   # «потолок / стены неба» (Mirage: z до 946–1024 над всей картой) — проверять картинкой
keep = [m for k, m in enumerate(meshes) if k not in sky]
os.makedirs(OUT, exist_ok=True); base = np.cumsum([0] + [len(m[0]) for m in keep])
np.savez_compressed(os.path.join(OUT, 'world_physics.npz'),
    mesh_v=np.concatenate([m[0] for m in keep]).astype(np.float32),
    mesh_t=np.concatenate([m[1] + base[k] for k, m in enumerate(keep)]).astype(np.int32),
    mesh_id=np.concatenate([np.full(len(m[1]), k, np.int16) for k, m in enumerate(keep)]),
    hull_v=np.concatenate([h[0] for h in hulls]).astype(np.float32), hull_vn=np.array([len(h[0]) for h in hulls], np.int32),
    hull_p=np.concatenate([h[1] for h in hulls]).astype(np.float32), hull_pn=np.array([len(h[1]) for h in hulls], np.int32),
    # (владелец 20.10) «небо» (skybox / потолок карты) — отдельным слоем: взгляд и пули его не касаются, а гранаты от него отскакивают
    # (не перекинуть через всю карту)
    sky_v=np.concatenate([meshes[k][0] for k in sky] or [np.zeros((0, 3))]).astype(np.float32),
    sky_t=np.concatenate([meshes[k][1] + sum(len(meshes[j][0]) for j in sky[:n]) for n, k in enumerate(sky)] or [np.zeros((0, 3))]).astype(np.int32))
print('блоков %d, сеток %d (выкинуто «небо»: %s), треугольников %d' % (len(hulls), len(keep), sky, sum(len(m[1]) for m in keep)))
