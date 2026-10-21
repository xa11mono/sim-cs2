#!/usr/bin/env python3
"""А3 (20.10.2026): геометрия столкновений → «столбики» на сетке VIS — основа всех слоёв карты.
python3 tools/map3d/columns.py [--map mirage]   →  data/maps/<карта>/geom3d/columns.npz  (≈ 1–2 мин)

Сетка — та же, что VIS в игре: клетка VIS_CELL = 2 px радара 0..2048 (= scale·1 ед. игры, у Mirage 5 ед.), W = 1024 клетки по
стороне, клетка (i, j) — x игры ∈ [pos_x + i·c, pos_x + (i+1)·c), y игры ∈ (pos_y − (j+1)·c, pos_y − j·c] (c = scale/2·VIS_CELL).
В каждой клетке («столбике») — список занятых отрезков высоты [lo, hi] (целые ед. игры, по возрастанию, не пересекаются):
где по высоте над этим квадратиком есть геометрия. Считается точно: каждый треугольник обрезается квадратом клетки
(Сазерленд — Ходжмен), берётся его z от и до; выпуклый блок (ящик, колонна) — сплошной от низа до верха в клетке. Клетку
задевает хоть краем — отрезок пишется (стены не «протекают» между клетками; толще настоящих не более чем на клетку).

Три набора — по тому, что считается стеной (группы и материалы — из файла игры, А2, raycast.solid_mask):
  sight — взгляд и пули: всё, кроме playerclip / npcclip / ladder / grenadeclip / sky / passbullets / window и прозрачного
          (glass, chainlink); у каждого отрезка — материал (номер в surf_names) — для прострелов;
  walk  — тело игрока: всё, кроме grenadeclip / sky / ladder и групп «игроки проходят» (exclude player); playerclip — стена;
  nade  — граната: всё, кроме playerclip / npcclip / ladder / sky и групп exclude csgo_thrown_grenade (В3); grenadeclip, решётки, стекло — стена. Небо — отдельно: sky_z
          (низ неба над клеткой; граната отскакивает, взгляд и пули его не замечают)."""
import sys, os, json, time
import numpy as np
from scipy.spatial import ConvexHull
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa

VIS_CELL = 2          # px радара 0..2048 — как VIS_CELL в src/game/040_visibility.js
CELL_PX = VIS_CELL    # клетка столбиков, px радара (= клетка VIS; 5 ед. у Mirage); --cell=1 — вдвое мельче
for _a in list(sys.argv[1:]):
    if _a.startswith('--cell='): CELL_PX = int(_a[7:]); sys.argv.remove(_a)
W = 2048 // CELL_PX   # клеток по стороне
GAP = 1               # отрезки ближе 1 ед. сливаются в один


def masks(z):
    A = json.loads(str(z['attr_json'])); S = np.array([s.lower() for s in z['surf_names']])
    tags = [{x.lower() for x in a['as']} for a in A]
    nopl = np.array(['player' in [x.lower() for x in a['exclude']] for a in A])
    def grp(bad, extra=None):
        g = np.array([not (bad & t) for t in tags])
        return g if extra is None else g & extra
    sight_g = grp({'playerclip', 'npcclip', 'ladder', 'csgo_grenadeclip', 'sky', 'passbullets', 'window'})
    walk_g = grp({'csgo_grenadeclip', 'sky', 'ladder'}, ~nopl)
    # (В3) граната пролетает и сквозь группы «кроме брошенной гранаты» (exclude csgo_thrown_grenade — у Ancient детали рельефа,
    # 239 тыс. треугольников): проверено бросками про (docs/reports/NADES.md — с ними совпадений меньше)
    nothrown = np.array(['csgo_thrown_grenade' not in [x.lower() for x in a['exclude']] for a in A])
    nade_g = grp({'playerclip', 'npcclip', 'ladder', 'sky'}, nothrown)
    see = ~np.isin(S, ['glass', 'chainlink'])
    clip = np.array([bool({'playerclip', 'npcclip'} & t) for t in tags])
    def m(attr, surf):
        return {'sight': sight_g[attr] & see[surf], 'walk': walk_g[attr], 'nade': nade_g[attr], 'clip': clip[attr]}
    return m(z['mesh_attr'], z['mesh_surf']), m(z['hull_attr'], z['hull_surf'])


def hull_tris(z):
    hv = z['hull_v'].astype(np.float64); hn = z['hull_vn']; off = np.concatenate([[0], np.cumsum(hn)])
    tris, owner, up = [], [], []
    for k in range(len(hn)):
        P = hv[off[k]:off[k + 1]]
        try: H = ConvexHull(P, qhull_options='QJ')
        except Exception: continue
        tris.append(P[H.simplices]); owner.append(np.full(len(H.simplices), k)); up.append(H.equations[:, 2] >= 0.7)
    return np.concatenate(tris), np.concatenate(owner), np.concatenate(up)


def clip(P, n, ax, b, sgn):
    """многоугольники P (N×8×3, n вершин) — оставить часть, где sgn·(p[ax] − b) ≥ 0"""
    N = len(P); Q = np.zeros_like(P); m = np.zeros(N, np.int64); r = np.arange(N)
    for k in range(8):
        live = k < n
        if not live.any(): break
        a = P[:, k]; nb = np.where(k + 1 < n, k + 1, 0); c = P[r, nb]
        da = sgn * (a[:, ax] - b); dc = sgn * (c[:, ax] - b)
        ia, ic = da >= 0, dc >= 0
        e1 = live & ia
        Q[r[e1], m[e1]] = a[e1]; m += e1
        e2 = live & (ia != ic)
        if e2.any():
            t = (da[e2] / (da[e2] - dc[e2]))[:, None]
            Q[r[e2], m[e2]] = a[e2] + (c[e2] - a[e2]) * t; m += e2
    return Q, m


def cell_ranges(T, u0, v0):
    """треугольники T (N×3×3; x, y уже в клетках) → пары (номер, клетка, zlo, zhi) для всех задетых клеток"""
    lo = np.floor(T[:, :, :2].min(1)).astype(np.int64); hi = np.floor(T[:, :, :2].max(1)).astype(np.int64)
    lo = np.clip(lo, 0, W - 1); hi = np.clip(hi, 0, W - 1)
    ok = (T[:, :, 0].max(1) >= 0) & (T[:, :, 0].min(1) < W) & (T[:, :, 1].max(1) >= 0) & (T[:, :, 1].min(1) < W)
    w = np.where(ok, hi[:, 0] - lo[:, 0] + 1, 0); h = np.where(ok, hi[:, 1] - lo[:, 1] + 1, 0)
    cnt = w * h; idx = np.repeat(np.arange(len(T)), cnt); start = np.concatenate([[0], np.cumsum(cnt)])[:-1]
    out_i, out_c, out_lo, out_hi = [], [], [], []
    B = 600000
    for s in range(0, len(idx), B):
        ii = idx[s:s + B]; loc = np.arange(s, s + len(ii)) - start[ii]
        ci = lo[ii, 0] + loc % w[ii]; cj = lo[ii, 1] + loc // w[ii]
        P = np.zeros((len(ii), 8, 3)); P[:, :3] = T[ii]; n = np.full(len(ii), 3)
        P, n = clip(P, n, 0, ci, 1); P, n = clip(P, n, 0, ci + 1, -1)
        P, n = clip(P, n, 1, cj, 1); P, n = clip(P, n, 1, cj + 1, -1)
        g = n > 0
        if not g.any(): continue
        zz = P[g][:, :, 2]; valid = np.arange(8)[None, :] < n[g][:, None]
        out_i.append(ii[g]); out_c.append(cj[g] * W + ci[g])
        out_lo.append(np.where(valid, zz, np.inf).min(1)); out_hi.append(np.where(valid, zz, -np.inf).max(1))
    if not out_i:   # (А6) ничего не задето — у Ancient в файле физики нет группы «небо»
        e = np.zeros(0, np.int64); return e, e, np.zeros(0), np.zeros(0)
    return np.concatenate(out_i), np.concatenate(out_c), np.concatenate(out_lo), np.concatenate(out_hi)


def merge(cell, lo, hi, mat=None, up_hi=None, up_clip=None):
    """отрезки по клеткам → слитые: start (W²+1), lo, hi (int16), mat (по самому длинному куску), floor (верх — пол: обращённая
    вверх поверхность у самого верха отрезка)"""
    if len(cell) == 0:   # (А6) пусто (нет неба)
        res = {'start': np.zeros(W * W + 1, np.uint32), 'lo': np.zeros(0, np.int16), 'hi': np.zeros(0, np.int16)}
        if mat is not None: res['mat'] = np.zeros(0, np.uint8)
        if up_hi is not None: res['floor'] = np.zeros(0, np.uint8)
        return res
    lo = np.floor(lo).astype(np.int64); hi = np.ceil(hi).astype(np.int64)
    o = np.lexsort((lo, cell)); cell, lo, hi = cell[o], lo[o], hi[o]
    BIG = 1 << 20; L = lo + cell * BIG; H = hi + cell * BIG
    run = np.maximum.accumulate(H)
    new = np.ones(len(L), bool); new[1:] = L[1:] > run[:-1] + GAP
    gid = np.cumsum(new) - 1; ng = gid[-1] + 1
    glo = lo[new]; ghi = np.full(ng, -BIG); np.maximum.at(ghi, gid, hi)
    gcell = cell[new]
    start = np.searchsorted(gcell, np.arange(W * W + 1))
    res = {'start': start.astype(np.uint32), 'lo': glo.astype(np.int16), 'hi': ghi.astype(np.int16)}
    if mat is not None:
        mat = mat[o]; ln = hi - lo + 1
        key = np.lexsort((-ln, gid)); first = np.ones(len(key), bool); first[1:] = gid[key][1:] != gid[key][:-1]
        gm = np.zeros(ng, np.uint8); gm[gid[key][first]] = mat[key][first]; res['mat'] = gm
    if up_hi is not None:
        u = up_hi[o]; gu = np.full(ng, -np.inf); np.maximum.at(gu, gid, u)
        gc = np.full(ng, -np.inf); np.maximum.at(gc, gid, up_clip[o])
        res['floor'] = np.where(gu >= ghi - 2, 1, np.where(gc >= ghi - 2, 2, 0)).astype(np.uint8)   # 1 — пол, 2 — пол невидимой стены
    return res


def build(name):
    t0 = time.time()
    z = np.load(mapdir.path(name, 'geom3d', 'world_physics.npz'))
    R = mapdir.radar(name); c = R['scale'] / 2.0 * CELL_PX
    X0, Y0 = R['pos_x'], R['pos_y']
    def to_cells(T):
        T = T.astype(np.float64).copy(); T[..., 0] = (T[..., 0] - X0) / c; T[..., 1] = (Y0 - T[..., 1]) / c; return T
    mm, hm = masks(z)
    V = z['mesh_v']; Tm = to_cells(V[z['mesh_t']])
    Tw = V[z['mesh_t']].astype(np.float64); nz = np.cross(Tw[:, 1] - Tw[:, 0], Tw[:, 2] - Tw[:, 0])
    nl = np.linalg.norm(nz, axis=1) + 1e-12   # нормаль — в ед. игры (не в клетках)
    up_m = np.abs(nz[:, 2] / nl) >= 0.7   # пол — почти горизонтально (порог Source: 0,7)
    Th, h_owner, up_h = hull_tris(z); Th = to_cells(Th)
    any_m = mm['sight'] | mm['walk'] | mm['nade']
    mi = np.where(any_m)[0]
    print('треугольников сеток %d (в дело %d), граней блоков %d' % (len(Tm), len(mi), len(Th)))
    a_i, a_c, a_lo, a_hi = cell_ranges(Tm[mi], 0, 0); a_i = mi[a_i]
    print('  пар «треугольник — клетка»: сетки %.1f млн (%.0f с)' % (len(a_i) / 1e6, time.time() - t0))
    b_i, b_c, b_lo, b_hi = cell_ranges(Th, 0, 0)
    # выпуклый блок в клетке — сплошной от низа до верха: сгруппировать по (блок, клетка)
    bo = h_owner[b_i]; key = bo * (W * W) + b_c
    uk, inv = np.unique(key, return_inverse=True)
    blo = np.full(len(uk), np.inf); bhi = np.full(len(uk), -np.inf); bup = np.full(len(uk), -np.inf)
    np.minimum.at(blo, inv, b_lo); np.maximum.at(bhi, inv, b_hi)
    np.maximum.at(bup, inv, np.where(up_h[b_i], b_hi, -np.inf))
    bk = (uk // (W * W)).astype(np.int64); bc = (uk % (W * W)).astype(np.int64)
    print('  блоков в клетках %.2f млн (%.0f с)' % (len(uk) / 1e6, time.time() - t0))
    out = {'W': W, 'cell_units': c, 'pos_x': X0, 'pos_y': Y0, 'cell_px': CELL_PX}
    for kind in ('sight', 'walk', 'nade'):
        sm = mm[kind][a_i]; sh = hm[kind][bk]
        cell = np.concatenate([a_c[sm], bc[sh]]); lo = np.concatenate([a_lo[sm], blo[sh]]); hi = np.concatenate([a_hi[sm], bhi[sh]])
        mat = np.concatenate([z['mesh_surf'][a_i[sm]], z['hull_surf'][bk[sh]]]) if kind == 'sight' else None
        uph = uphc = None
        if kind == 'walk':   # верх пола: настоящий / невидимая стена (скат поверх ступеней — по нему ходят; крышки над картой — нет)
            cm = np.concatenate([mm['clip'][a_i[sm]], hm['clip'][bk[sh]]])
            u = np.concatenate([np.where(up_m[a_i[sm]], a_hi[sm], -np.inf), bup[sh]])
            uph = np.where(cm, -np.inf, u); uphc = np.where(cm, u, -np.inf)
        r = merge(cell, lo, hi, mat, uph, uphc)
        for k2, v in r.items(): out[kind + '_' + k2] = v
        n = np.diff(r['start'].astype(np.int64))
        print('  %-5s отрезков %d, в клетке: среднее %.2f, макс %d' % (kind, len(r['lo']), n.mean(), n.max()))
    # небо: низ неба над клеткой (треугольники группы sky)
    St = to_cells(z['sky_v'][z['sky_t']])
    s_i, s_c, s_lo, s_hi = cell_ranges(St, 0, 0)
    flat = (s_hi - s_lo) < 4   # потолок неба — почти горизонтальные куски; стенки неба — отдельно (отрезками, как у остальных)
    sky = np.full(W * W, 32767, np.int64); np.minimum.at(sky, s_c[flat], np.floor(s_lo[flat]).astype(np.int64))
    out['sky_z'] = sky.astype(np.int16)
    r = merge(s_c, s_lo, s_hi)
    for k2, v in r.items(): out['sky_' + k2] = v
    out['surf_names'] = np.array([str(s) for s in z['surf_names']])
    np.savez_compressed(mapdir.path(name, 'geom3d', 'columns.npz'), **out)
    print('готово: geom3d/columns.npz (%.0f с)' % (time.time() - t0))


class Columns:
    """чтение columns.npz: C = Columns('mirage'); C.slabs('sight', i, j) → [(lo, hi), …]; перевод координат"""
    def __init__(self, name):
        self.z = z = np.load(mapdir.path(name, 'geom3d', 'columns.npz'))
        self.W = int(z['W']); self.c = float(z['cell_units']); self.X0 = float(z['pos_x']); self.Y0 = float(z['pos_y'])
        self.d = {k: z[k] for k in z.files}

    def slabs(self, kind, i, j):
        s = self.d[kind + '_start']; k = j * self.W + i
        return list(zip(self.d[kind + '_lo'][s[k]:s[k + 1]].tolist(), self.d[kind + '_hi'][s[k]:s[k + 1]].tolist()))

    def ray(self, A, B, kind='sight'):
        """луч A → B (x, y, z — ед. игры) по столбикам: None — чисто, иначе (i, j, lo, hi) первого отрезка на пути.
        Точно: клетки — по пересечениям с линиями сетки (как visWallHit в игре), в каждой клетке — z луча от входа до выхода."""
        st = self.d[kind + '_start']; LO = self.d[kind + '_lo']; HI = self.d[kind + '_hi']; W = self.W
        ax, ay = (A[0] - self.X0) / self.c, (self.Y0 - A[1]) / self.c; bx, by = (B[0] - self.X0) / self.c, (self.Y0 - B[1]) / self.c
        dx, dy, dz = bx - ax, by - ay, B[2] - A[2]
        i, j = int(np.floor(ax)), int(np.floor(ay)); ei, ej = int(np.floor(bx)), int(np.floor(by))
        sx = 1 if dx > 0 else -1; sy = 1 if dy > 0 else -1
        tdx = abs(1 / dx) if dx else np.inf; tdy = abs(1 / dy) if dy else np.inf
        tmx = ((i + 1 - ax) if dx > 0 else (ax - i)) * tdx if dx else np.inf
        tmy = ((j + 1 - ay) if dy > 0 else (ay - j)) * tdy if dy else np.inf
        t0 = 0.0
        for _ in range(4 * W):
            t1 = min(tmx, tmy, 1.0)
            if 0 <= i < W and 0 <= j < W:
                za, zb = A[2] + dz * t0, A[2] + dz * t1; zl, zh = min(za, zb), max(za, zb)
                k = j * W + i
                for q in range(st[k], st[k + 1]):
                    if LO[q] <= zh and HI[q] >= zl: return (i, j, int(LO[q]), int(HI[q]))
            if (i == ei and j == ej) or t1 >= 1.0: break
            if tmx < tmy: t0 = tmx; tmx += tdx; i += sx
            else: t0 = tmy; tmy += tdy; j += sy
        return None

    def padded(self, kind, K=None):
        """(W²×K) lo, hi — пустые места lo = 32767, hi = −32768"""
        s = self.d[kind + '_start'].astype(np.int64); n = np.diff(s); K = K or int(n.max())
        LO = np.full((self.W * self.W, K), 32767, np.int16); HI = np.full((self.W * self.W, K), -32768, np.int16)
        cell = np.repeat(np.arange(self.W * self.W), n); pos = np.arange(len(cell)) - s[cell]
        k = pos < K
        LO[cell[k], pos[k]] = self.d[kind + '_lo'][k]; HI[cell[k], pos[k]] = self.d[kind + '_hi'][k]
        return LO, HI


if __name__ == '__main__':
    build(mapdir.current())
