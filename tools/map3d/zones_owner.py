#!/usr/bin/env python3
"""А4 (20.10.2026): зоны Mirage по подписям владельца — python3 tools/map3d/zones_owner.py [--map mirage]  (после layers.py)
Вход: data/maps/mirage/callouts/owner_callouts_1.png (прямоугольники и названия — как на Simple Radar; переписаны сюда руками
в пикселях картинки, RECTS) и _2.png (названия мест, которых нет на первой: Short Corner, Under Window, Kitchen Door, CT Box, Danger
Box, 90, E Stairs). Картинка → радар 0..2048: x = SX·u + TX, y = SY·v + TY — подбор по совпадению силуэта карты с radar.png
(доля общего 0,93; FIT ниже). Сайты A / B — точно коробками закладки из файла игры (entities.json, А2).
Как режем:
 1) каждый живой этаж (layers.npz: клетка 5 ед. + высота) — в прямоугольник, который его накрывает (меньший — поверх большего);
    «нижние» прямоугольники (Underpath) берут только нижний этаж клетки, остальные — верхний;
 2) этажи вне прямоугольников: места, которые подписывает только вторая картинка (GAP_NAMES), — свои зоны-зёрна; дальше
    каждый этаж — ближайшей зоне по ходьбе (шаг ≤ 18 между соседними клетками); дальше D_FAR от всех — «подход к <ближайшая>»;
 3) зона рисуется ровными прямоугольниками по клеткам (жадно: самые большие прямоугольники, пока клетки зоны не кончатся).
Выход: data/maps/mirage/geom3d/zones_owner.json (в игру пока не идёт — А5) и картинка docs/reports/map3d/a4_zones.png."""
import sys, os, json
import numpy as np
from scipy import ndimage
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa
from columns import Columns  # noqa
from layers import b64  # noqa

FIT = (2.13, 2.125, 204.0, 178.0)  # SX, SY, TX, TY: owner_callouts_1.png (800×800) → радар 0..2048 (доля общего силуэта 0,93)
D_FAR = 400                        # ед. по ходьбе: дальше от любой подписи — своя зона «подход к …» (проектное число)

# (название, x0, y0, x1, y1 в пикселях owner_callouts_1.png, этаж: '' — верхний, 'low' — нижний)
RECTS = [
    ('Van', 58, 84, 98, 127, ''), ('B Plat', 117, 73, 145, 114, ''), ('B Apartments', 155, 68, 288, 114, ''),
    ('Stove', 286, 81, 324, 172, ''), ('Drop', 163, 115, 225, 147, ''), ('Arches', 226, 133, 282, 176, ''),
    ('Underpath Stairs', 329, 143, 489, 174, ''), ('B Short', 239, 177, 378, 222, ''),
    ('B Default', 93, 153, 114, 174, ''), ('B Boost', 141, 154, 159, 173, ''), ('B Site', 93, 153, 161, 224, ''),
    ('Bench', 43, 169, 54, 191, ''), ('Empty', 88, 230, 130, 247, ''), ('B Trash', 52, 248, 70, 261, ''),
    ('Doors', 53, 272, 90, 296, ''), ('B Window', 143, 273, 160, 296, ''), ('E-Box', 204, 266, 226, 288, ''),
    ('Kitchen', 61, 323, 221, 373, ''), ('Vent', 282, 245, 300, 317, ''), ('Ladder', 301, 245, 332, 280, ''),
    ('Short', 338, 242, 391, 298, ''), ('Window', 273, 320, 302, 383, ''), ('Underpath', 308, 306, 336, 390, 'low'),
    ('Catwalk', 340, 300, 501, 334, ''), ('Mid', 339, 339, 462, 389, ''), ('Mid Bench', 342, 378, 382, 390, ''),
    ('T Apps', 422, 67, 487, 141, ''), ('House', 489, 70, 538, 96, ''), ('TV', 630, 67, 641, 97, ''),
    ('Cart', 541, 105, 599, 128, ''), ('Apps Ramp', 600, 105, 732, 131, ''),
    ('Side Alley', 552, 129, 774, 162, ''), ('Side Alley', 540, 160, 599, 240, ''), ('Side Alley', 712, 136, 776, 212, ''),
    ('T Spawn', 717, 214, 786, 315, ''), ('Top Mid', 542, 255, 613, 336, ''), ('Ramp', 463, 338, 552, 389, ''),
    ('Mid Boxes', 554, 338, 584, 389, ''), ('Chair', 439, 391, 475, 416, ''),
    ('Hole', 236, 411, 303, 463, ''), ('Jungle', 267, 469, 329, 530, ''), ('Connector', 357, 392, 418, 480, ''),
    ('Cross', 344, 481, 411, 551, ''), ('Stairs', 401, 482, 421, 524, ''), ('CT Spawn', 129, 531, 239, 647, ''),
    ('CT', 194, 648, 314, 719, ''), ('A Trash', 329, 661, 343, 676, ''), ('Ticket', 334, 695, 360, 725, ''),
    ('Sandwich', 442, 519, 465, 542, ''), ('Tetris', 468, 503, 505, 534, ''), ('T Ramp', 563, 505, 655, 566, ''),
    ('T Roof', 657, 465, 671, 566, ''), ('T Roof', 657, 465, 732, 478, ''), ('Palace Entry', 754, 368, 782, 520, ''),
    ('Balcony', 504, 584, 525, 650, ''), ('Dark', 526, 596, 544, 632, ''), ('Pillars', 564, 606, 668, 642, ''),
    ('Palace', 670, 570, 720, 656, ''), ('Palace', 563, 656, 720, 690, ''), ('Palace Exit', 515, 652, 562, 689, ''),
    ('A Site', 396, 626, 462, 680, ''), ('A Default', 448, 620, 466, 642, ''), ('Firebox', 441, 656, 478, 692, ''),
    ('Ninja', 410, 682, 432, 698, ''), ('Triple Box', 372, 618, 414, 648, ''),
]
ROLE = {'A Site': 'Asite', 'B Site': 'Bsite', 'CT Spawn': 'CTspawn', 'T Spawn': 'Tspawn'}
# названия для пустот: точка (радар 0..2048) из второй картинки владельца → имя; кусок, который её содержит, получает имя
FIT2 = (1.53, 1.525, -458.0, 196.0)   # owner_callouts_2.png (1920×1080) → радар 0..2048 (тот же подбор; доля общего 0,90)
_G2 = [('Forest', 475, 235), ('Short Corner', 782, 205), ('Kitchen Door', 537, 415), ('Under Window', 880, 490), ('Water', 1222, 553),
       ('Stair', 705, 615), ('E Stairs', 1020, 730), ('90', 1185, 768), ('Palm', 928, 815), ('Danger Box', 1095, 935),
       ('CT Box', 905, 990), ('CT Stairs', 805, 935)]   # середины надписей в пикселях второй картинки
GAP_NAMES = [(n, FIT2[0] * u + FIT2[2], FIT2[1] * v + FIT2[3]) for n, u, v in _G2]


def build(name):
    L = np.load(mapdir.path(name, 'geom3d', 'layers.npz')); W = int(L['W']); PX = 2048 / W
    C = Columns(name); E = json.load(open(mapdir.path(name, 'geom3d', 'entities.json')))
    nc, nz, nk = L['node_cell'], L['node_z'].astype(int), L['node_kind']
    live = np.where(nk > 0)[0]; lc, lz = nc[live], nz[live]
    # верхний этаж клетки — по этажам, куда ходят пешком (верх ящика, куда только запрыгнуть, этаж не перекрывает)
    walk = nk[live] == 1
    topz = np.full(W * W, -99999); np.maximum.at(topz, lc[walk], lz[walk])
    is_top = lz >= topz[lc] - 60
    sx, sy, tx, ty = FIT
    rects = []
    for (nm, x0, y0, x1, y1, lvl) in RECTS:
        r = [sx * x0 + tx, sy * y0 + ty, sx * x1 + tx, sy * y1 + ty]
        if nm in ('A Site', 'B Site'):   # точно — коробка закладки из файла игры
            b = [s for s in E['bombsites'] if s['targetname'].strip().endswith(nm[0] + ' site')][0]
            P = np.array(b['poly_radar']); r = [P[:, 0].min(), P[:, 1].min(), P[:, 0].max(), P[:, 1].max()]
        r = [round(v / PX) * PX for v in r]   # ровно по клеткам
        rects.append((nm, r, lvl))
    # 1) этажи → прямоугольники (меньший — поверх)
    zone_names = sorted({n for n, _, _ in rects}, key=lambda n: [r[0] for r in rects].index(n))
    zid = {n: i for i, n in enumerate(zone_names)}
    lab = np.full(len(live), -1); area_of = np.full(len(live), np.inf)
    ci, cj = (lc % W + 0.5) * PX, (lc // W + 0.5) * PX
    for nm, r, lvl in rects:
        inside = (ci >= r[0]) & (ci < r[2]) & (cj >= r[1]) & (cj < r[3])
        if lvl == 'low':
            zz = lz[inside]
            if len(zz): inside &= lz <= np.percentile(zz, 5) + 40   # нижний этаж в прямоугольнике
        else: inside &= is_top
        a = (r[2] - r[0]) * (r[3] - r[1])
        upd = inside & (a < area_of)
        lab[upd] = zid[nm]; area_of[upd] = a
    # 2) пустоты: куски, связные по ходьбе
    idx = -np.ones(len(nc), np.int64); idx[live] = np.arange(len(live))
    ns = np.searchsorted(nc, np.arange(W * W + 1))
    A_, B_ = [], []
    for di, dj in ((1, 0), (0, 1), (1, 1), (1, -1)):
        ii, jj = lc % W + di, lc // W + dj; ok = (ii >= 0) & (jj >= 0) & (ii < W) & (jj < W)
        a = np.where(ok)[0]; nb = jj[a] * W + ii[a]
        for k in range(int(np.diff(ns).max())):
            q = ns[nb] + k; h = q < ns[nb + 1]; qq = np.where(h, q, 0)
            b = idx[qq]; h &= (b >= 0)
            h &= np.abs(nz[qq] - lz[a]) <= 18
            A_.append(a[h]); B_.append(b[h])
    A_ = np.concatenate(A_); B_ = np.concatenate(B_)
    cell_area = (C.c) ** 2
    # нижняя зона (Underpath) забирает весь свой этаж: связное по ходьбе в пределах её высот (тоннель под Short, Ladder, B Short) —
    # прямоугольники сверху на картинке владельца плоские и про нижний этаж не знают
    Gw = csr_matrix((np.ones(len(A_)), (A_, B_)), shape=(len(live), len(live)))
    for nm, r, lvl in rects:
        if lvl != 'low': continue
        mine = np.where(lab == zid[nm])[0]
        if not len(mine): continue
        zmax = lz[mine].max() + 10
        okn = lz <= zmax
        m = okn[A_] & okn[B_]
        Gl = csr_matrix((np.ones(m.sum()), (A_[m], B_[m])), shape=(len(live), len(live)))
        d = dijkstra(Gl, directed=False, indices=mine, min_only=True, limit=1e9)
        lab[np.isfinite(d)] = zid[nm]
    # зёрна пустот — места со второй картинки владельца, которые первая не подписывает
    gaps = []
    for gname, gx, gy in GAP_NAMES:
        d2 = (ci - gx) ** 2 + (cj - gy) ** 2; d2 = np.where(is_top, d2, np.inf); k = int(np.argmin(d2))
        if d2[k] > (8 * PX) ** 2 or lab[k] >= 0: continue          # место уже в прямоугольнике — имя не нужно
        if gname not in zid: zid[gname] = len(zone_names); zone_names.append(gname)
        lab[(d2 <= (3 * PX) ** 2) & (lab < 0)] = zid[gname]
    grow(lab, rects, zid, GAP_NAMES, lc, lz, is_top, ci, cj, W, PX)
    # всё остальное — ближайшей зоне по ходьбе (несколько источников разом); дальше D_FAR — «подход к …»
    G = csr_matrix((np.ones(len(A_)), (A_, B_)), shape=(len(live), len(live)))
    low_ids = [zid[nm] for nm, r, lvl in rects if lvl == 'low']
    seeds = np.where((lab >= 0) & ~np.isin(lab, low_ids))[0]   # нижняя зона уже забрала свой этаж — дальше не растёт
    dist, pred, srcs = dijkstra(G, directed=False, indices=seeds, min_only=True, return_predecessors=True)
    un = (lab < 0) & np.isfinite(dist)
    near = un & (dist * C.c <= D_FAR); far = un & ~near
    lab[near] = lab[srcs[near]]
    for z0 in np.unique(lab[srcs[far]]):
        mem = np.where(far & (lab[srcs] == z0))[0]
        nm = 'подход к ' + zone_names[z0]
        if nm not in zid: zid[nm] = len(zone_names); zone_names.append(nm)
        lab[mem] = zid[nm]
    for nm in zone_names:
        if nm in [r[0] for r in rects]: continue
        mem = np.where(lab == zid[nm])[0]
        if len(mem): gaps.append({'name': nm, 'area_u2': int(len(mem) * cell_area),
                                  'center': [round(float(ci[mem].mean())), round(float(cj[mem].mean()))]})
    # остаток (верх ящиков и уступов, куда только запрыгнуть, без хода к зонам) — ближайшая зона по клетке
    un = np.where(lab < 0)[0]
    if len(un):
        grid = np.full((W, W), -1); ok = (lab >= 0) & ~np.isin(lab, low_ids) & is_top; grid[lc[ok] // W, lc[ok] % W] = lab[ok]
        _, (jj, ii) = ndimage.distance_transform_edt(grid < 0, return_indices=True)
        lab[un] = grid[jj[lc[un] // W, lc[un] % W], ii[lc[un] // W, lc[un] % W]]
    left = int((lab < 0).sum())
    # 3) прямоугольники зон (по клеткам верхнего этажа зоны; нижние зоны — отдельно)
    out = []
    for nm in zone_names:
        mem = np.where(lab == zid[nm])[0]
        if not len(mem): continue
        low = any(l == 'low' for n, _, l in rects if n == nm)
        grid = np.zeros((W, W), bool); grid[lc[mem] // W, lc[mem] % W] = True
        rr = []
        g = grid.copy()
        while g.sum() > 0:
            r = biggest_rect(g)
            if r is None: break
            j0, i0, j1, i1 = r
            if (j1 - j0) * (i1 - i0) * cell_area < 20 * 20 and rr: g[j0:j1, i0:i1] = False; continue   # крошки не рисуем
            g[j0:j1, i0:i1] = False
            rr.append([i0 * PX, j0 * PX, i1 * PX, j1 * PX])
        zs = lz[mem]
        out.append({'name': nm, 'role': ROLE.get(nm, ''), 'level': 'low' if low else '', 'z': [int(zs.min()), int(np.median(zs)), int(zs.max())],
                    'cells': int(len(mem)), 'area_u2': int(len(mem) * cell_area),
                    'center': [round(float(((lc[mem] % W + 0.5) * PX).mean())), round(float(((lc[mem] // W + 0.5) * PX).mean()))],
                    'rects': rr, 'owner_rects': [r for n, r, _ in rects if n == nm]})
    # этаж → зона (в порядке этажей map3d.json: клетки по возрастанию, в клетке — по высоте)
    floor_zone = np.where(lab >= 0, lab, 255).astype(np.uint8)
    res = {'_about': 'А4 (20.10.2026): зоны Mirage по подписям владельца — tools/map3d/zones_owner.py; устройство — docs/ARCHITECTURE.md, «Карта 3D»',
           'fit': FIT, 'zones': out, 'gaps': gaps, 'unassigned_floors': left,
           'floor_zone_names': zone_names,
           'floor_zone': b64(floor_zone)}   # зона каждого этажа map3d.json (тот же порядок: клетки по возрастанию, в клетке — по высоте); 255 — нет
    json.dump(res, open(mapdir.path(name, 'geom3d', 'zones_owner.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('зон %d (из прямоугольников %d, пустоты %d), этажей без зоны %d' % (len(out), len(set(n for n, _, _ in rects)), len(gaps), left))
    for g in gaps: print('  пустота →', g)
    picture(name, out, gaps, W, PX)


def grow(lab, rects, zid, seeds, lc, lz_, is_top, ci, cj, W, PX):
    """прямоугольники растут по сторонам на клетку за круг (все по очереди — встречаются посередине), забирая клетки верхнего
    этажа без зоны, которые касаются уже своих; сторона встала — в полосе чужая зона или забирать нечего (стена, пусто).
    Так зоны остаются прямоугольниками, а не ломаной «ближайшего»."""
    top = np.where(is_top)[0]
    G = np.full(W * W, -2, np.int64); G[lc[top]] = lab[top]          # -2 — не пол, -1 — пол без зоны
    pos = np.full(W * W, -1, np.int64); pos[lc[top]] = top
    ZG = np.full(W * W, -99999.0); ZG[lc[top]] = lz_[top]; ZG = ZG.reshape(W, W)
    R = []
    for nm, r, lvl in rects:
        if lvl == 'low': continue
        R.append([zid[nm], int(r[0] / PX), int(r[1] / PX), int(np.ceil(r[2] / PX)), int(np.ceil(r[3] / PX)), [True] * 4])
    for nm, gx, gy in seeds:
        if nm in zid: i, j = int(gx / PX), int(gy / PX); R.append([zid[nm], i - 1, j - 1, i + 2, j + 2, [True] * 4])
    G2 = G.reshape(W, W)
    for it in range(400):
        moved = False
        for rr in R:
            z, i0, j0, i1, j1, act = rr
            for side in range(4):
                if not act[side]: continue
                if side == 0: ni, nj, si, sj, inner = slice(i0 - 1, i0), slice(j0, j1), -1, 0, (slice(i0, i0 + 1), slice(j0, j1))
                elif side == 1: ni, nj, inner = slice(i1, i1 + 1), slice(j0, j1), (slice(i1 - 1, i1), slice(j0, j1))
                elif side == 2: ni, nj, inner = slice(i0, i1), slice(j0 - 1, j0), (slice(i0, i1), slice(j0, j0 + 1))
                else: ni, nj, inner = slice(i0, i1), slice(j1, j1 + 1), (slice(i0, i1), slice(j1 - 1, j1))
                if ni.start < 0 or nj.start < 0 or ni.stop > W or nj.stop > W: act[side] = False; continue
                strip = G2[nj, ni]; ins = G2[inner[1], inner[0]]
                if ((strip >= 0) & (strip != z)).any(): act[side] = False; continue
                take = (strip == -1) & (ins == z) & (np.abs(ZG[nj, ni] - ZG[inner[1], inner[0]]) <= 18)   # только шагом со своей клетки
                if not take.any(): act[side] = False; continue
                strip[take] = z
                if side == 0: rr[1] -= 1
                elif side == 1: rr[3] += 1
                elif side == 2: rr[2] -= 1
                else: rr[4] += 1
                moved = True
        if not moved: break
    got = (G >= 0) & (pos >= 0)
    lab[pos[got]] = G[got]


def biggest_rect(g):
    """самый большой прямоугольник из True (гистограммы по строкам) → (j0, i0, j1, i1) или None"""
    H, Wd = g.shape; h = np.zeros(Wd, int); best = (0, None)
    rows = np.where(g.any(1))[0]
    if not len(rows): return None
    for j in range(rows[0], rows[-1] + 1):
        h = np.where(g[j], h + 1, 0)
        st = []
        for i in range(Wd + 1):
            cur = h[i] if i < Wd else 0
            s = i
            while st and st[-1][1] >= cur:
                s, hh = st.pop()
                a = hh * (i - s)
                if a > best[0]: best = (a, (j - hh + 1, s, j + 1, i))
            st.append((s, cur))
    return best[1]


def picture(name, Z, gaps, W, PX):
    radar = plt.imread(mapdir.radar_png(name))
    f, axs = plt.subplots(1, 2, figsize=(24, 12.4))
    cmap = plt.get_cmap('tab20')
    owner = plt.imread(mapdir.path(name, 'callouts', 'owner_callouts_1.png'))
    sx, sy, tx, ty = FIT
    axs[0].imshow(owner, extent=[tx, tx + sx * 800, ty + sy * 800, ty]); axs[0].imshow(radar, extent=[0, 2048, 2048, 0], alpha=0.0)
    axs[0].set_title('Подписи владельца (owner_callouts_1.png), наложены на радар', fontsize=14)
    ax = axs[1]; ax.imshow(radar, extent=[0, 2048, 2048, 0], alpha=0.55)
    for k, z in enumerate(Z):
        col = cmap(k % 20); gap = z['name'].startswith('подход') or not z['owner_rects']
        for r in z['rects']:
            ax.add_patch(Rectangle((r[0], r[1]), r[2] - r[0], r[3] - r[1], fc=col, ec='black' if not z['level'] else 'white',
                                   lw=0.6, alpha=0.55 if not z['level'] else 0.8, hatch='//' if gap else ('..' if z['level'] else None)))
        cx, cy = z['center']
        ax.text(cx, cy, z['name'] + (' (низ)' if z['level'] else ''), fontsize=8.5 if not gap else 7.5, ha='center', va='center', color='white',
                weight='bold', bbox=dict(boxstyle='round,pad=0.12', fc='black', alpha=0.55, lw=0))
    for a in axs: a.set_xlim(0, 2048); a.set_ylim(2048, 0); a.set_xticks([]); a.set_yticks([])
    ax.set_title('Зоны А4: прямоугольники владельца + пустоты (штрих — «подход к …» / имя со 2-й картинки), сайты — из файла игры', fontsize=13)
    plt.tight_layout(); plt.savefig(os.path.join(mapdir.ROOT, 'docs', 'reports', 'map3d', 'a4_zones.png'), dpi=75); plt.close()


if __name__ == '__main__':
    build(mapdir.current())
