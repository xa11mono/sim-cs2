#!/usr/bin/env python3
"""Пути по этажам геометрии (А3) и зонам (А4): python3 tools/map3d/route.py [--map mirage]  (после layers.py и zones_owner.py)
Владелец 20.10: путь B House → Underpath → Mid; проверить, что из Underpath нельзя попасть на Short и Ladder; путь Short → B House.
Граф — переходы между этажами соседних клеток из layers.py: шаг ≤ 18, спрыгнуть, прыжок ≤ 57, с приседом ≤ 66, лестница (из навмеша);
подсадка (≤ 130) в пути не берётся — для неё нужен второй игрок. Длина — ед. игры; прыжок дороже (+20 ед.), чтобы шли пешком, где можно.
Выход: docs/reports/map3d/route_bhouse_mid.png и сводка в печать / data/maps/<карта>/geom3d/route_check.json."""
import sys, os, json, base64, zlib
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from matplotlib.collections import LineCollection
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa

TYPES = {1: 'шаг', 2: 'спрыгнуть', 3: 'прыжок', 4: 'прыжок с приседом', 5: 'подсадка', 6: 'лестница'}
COST = {1: 0, 2: 0, 3: 20, 4: 30, 6: 10}


def load(name):
    L = np.load(mapdir.path(name, 'geom3d', 'layers.npz')); Z = json.load(open(mapdir.path(name, 'geom3d', 'zones_owner.json')))
    fz = np.frombuffer(zlib.decompress(base64.b64decode(Z['floor_zone'])), np.uint8)
    live = np.where(L['node_kind'] > 0)[0]
    zone = np.full(len(L['node_kind']), -1); zone[live] = np.where(fz < 255, fz.astype(int), -1)
    return L, Z, zone, Z['floor_zone_names']


def main(name):
    L, Z, zone, names = load(name); W = int(L['W']); PX = 2048 / W; U = mapdir.radar(name)['scale'] / 2 * PX
    nc, nz = L['node_cell'], L['node_z'].astype(float); n = len(nc)
    s, d, t = L['edge_src'], L['edge_dst'], L['edge_type']
    ok = (zone[s] >= 0) & (zone[d] >= 0)
    X, Y = (nc % W + 0.5) * PX, (nc // W + 0.5) * PX
    zid = {nm: i for i, nm in enumerate(names)}

    def graph(allowed):
        m = ok & np.isin(t, allowed)
        w = np.hypot(X[d[m]] - X[s[m]], Y[d[m]] - Y[s[m]]) * mapdir.radar(name)['scale'] / 2 + np.vectorize(COST.get)(t[m], 0)
        return csr_matrix((w, (s[m], d[m])), shape=(n, n)), m

    def center_node(zn):
        mem = np.where(zone == zid[zn])[0]; z = Z['zones'][[q['name'] for q in Z['zones']].index(zn)]
        cx, cy = z['center']; k = mem[np.argmin((X[mem] - cx) ** 2 + (Y[mem] - cy) ** 2 + (nz[mem] - z['z'][1]) ** 2)]
        return k

    def path(G, a, b, via=None):
        if via is None:
            dist, pred = dijkstra(G, indices=a, return_predecessors=True)
            if not np.isfinite(dist[b]): return None, np.inf
            p = [b]
            while p[-1] != a: p.append(pred[p[-1]])
            return p[::-1], dist[b]
        d1, p1 = dijkstra(G, indices=a, return_predecessors=True); d2, p2 = dijkstra(G.T.tocsr(), indices=b, return_predecessors=True)
        mem = np.where(zone == zid[via])[0]; k = mem[np.argmin(d1[mem] + d2[mem])]
        if not np.isfinite(d1[k] + d2[k]): return None, np.inf
        pa = [k]
        while pa[-1] != a: pa.append(p1[pa[-1]])
        pb = [k]
        while pb[-1] != b: pb.append(p2[pb[-1]])
        return pa[::-1] + pb[1:], d1[k] + d2[k]

    T = {(int(a), int(b)): int(c) for a, b, c in zip(s, d, t)}

    def describe(p):
        """последовательность зон с высотами и особыми переходами"""
        out = []
        for i, k in enumerate(p):
            zn = names[zone[k]]
            if not out or out[-1]['zone'] != zn: out.append({'zone': zn, 'z_from': int(nz[k]), 'z_to': int(nz[k])})
            else: out[-1]['z_to'] = int(nz[k])
            if i and T.get((int(p[i - 1]), int(k)), 1) not in (1, 2):
                out[-1].setdefault('moves', []).append(TYPES[T[(int(p[i - 1]), int(k))]])
        return out

    G, _ = graph([1, 2, 3, 4, 6])
    res = {}
    # B House: на второй картинке владельца — здание у Underpath Stairs (на первой — House и Underpath Stairs)
    a, b = center_node('House'), center_node('Mid')
    p1, L1 = path(G, a, b, via='Underpath')
    res['House → Underpath → Mid'] = {'units': round(float(L1)), 'zones': describe(p1)}
    p0, L0 = path(G, a, b)
    res['House → Mid (кратчайший, без условия)'] = {'units': round(float(L0)), 'zones': [q['zone'] for q in describe(p0)]}
    a2, b2 = center_node('Short'), center_node('House')
    p2, L2 = path(G, a2, b2)
    res['Short → House'] = {'units': round(float(L2)), 'zones': describe(p2)}
    mm = ok & np.isin(t, [1, 2, 3, 4, 6]) & (zone[s] != zid['Underpath']) & (zone[d] != zid['Underpath'])
    w = np.hypot(X[d[mm]] - X[s[mm]], Y[d[mm]] - Y[s[mm]]) * mapdir.radar(name)['scale'] / 2 + np.vectorize(COST.get)(t[mm], 0)
    p3, L3 = path(csr_matrix((w, (s[mm], d[mm])), shape=(n, n)), a2, b2)
    res['Short → House, не через Underpath'] = {'units': round(float(L3)), 'zones': [q['zone'] for q in describe(p3)]} if p3 else 'нет пути'
    # выходы из Underpath: все переходы с этажей Underpath на этажи других зон, по видам (подсадка — тоже)
    U_ = zid['Underpath']
    m = ok & (zone[s] == U_) & (zone[d] != U_)
    ex = {}
    for a_, b_, c_ in zip(s[m], d[m], t[m]):
        key = names[zone[b_]]; ex.setdefault(key, {}); ex[key][TYPES[int(c_)]] = ex[key].get(TYPES[int(c_)], 0) + 1
    res['выходы из Underpath (зона: вид перехода → сколько клеток границы)'] = ex
    # можно ли с Underpath на Short / Ladder, не выходя через другие зоны: поиск только по этажам Underpath + цель
    for tgt in ('Short', 'Ladder'):
        for allowed, lab in (([1, 2, 3, 4, 6], 'пешком / прыжком / по лестнице'), ([1, 2, 3, 4, 5, 6], 'с подсадкой')):
            mm = ok & np.isin(t, allowed) & np.isin(zone[s], [U_]) & np.isin(zone[d], [U_, zid[tgt]])
            Gu = csr_matrix((np.ones(mm.sum()), (s[mm], d[mm])), shape=(n, n))
            src = np.where(zone == U_)[0]
            dd = dijkstra(Gu, indices=src, min_only=True)
            hit = np.where(np.isfinite(dd) & (zone == zid[tgt]))[0]
            res.setdefault('прямо из Underpath', {})['%s (%s)' % (tgt, lab)] = 'можно' if len(hit) else 'нельзя'
        # и через любые зоны, но не через Mid и не через Underpath Stairs (т. е. не обходом по карте)
        mm = ok & np.isin(t, [1, 2, 3, 4, 6]) & ~np.isin(zone[d], [zid['Mid'], zid['Underpath Stairs']]) & ~np.isin(zone[s], [zid['Mid'], zid['Underpath Stairs']])
        Gu = csr_matrix((np.ones(mm.sum()), (s[mm], d[mm])), shape=(n, n))
        dd = dijkstra(Gu, indices=np.where(zone == U_)[0], min_only=True)
        res['прямо из Underpath']['%s (через любые зоны, кроме выходов Mid / Underpath Stairs)' % tgt] = \
            'можно' if np.isfinite(dd[zone == zid[tgt]]).any() else 'нельзя'
    json.dump(res, open(mapdir.path(name, 'geom3d', 'route_check.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    picture(name, Z, zone, names, X, Y, nz, [(p1, 'B House → Underpath → Mid', '#ff2d55'), (p2, 'Short → B House', '#2fd1ff')], ex)


def picture(name, Z, zone, names, X, Y, nz, paths, ex):
    radar = plt.imread(mapdir.radar_png(name))
    ext = (760, 1480, 280, 1020)
    f, ax = plt.subplots(figsize=(14, 14.4))
    ax.imshow(radar, extent=[0, 2048, 2048, 0], alpha=0.6)
    show = {'House', 'Underpath Stairs', 'Underpath', 'Short', 'Ladder', 'Vent', 'Mid', 'Stove', 'B Short', 'Catwalk', 'Window',
            'Under Window', 'T Apps', 'Top Mid', 'Arches'}
    for z in Z['zones']:
        if z['name'] not in show: continue
        col = '#ffd23f' if z['name'] in ('Short', 'Ladder') else ('#a06cff' if z['name'] == 'Underpath' else '#ffffff')
        for r in z['rects']:
            ax.add_patch(Rectangle((r[0], r[1]), r[2] - r[0], r[3] - r[1], fc=col, ec='none', alpha=0.18 if col == '#ffffff' else 0.35))
        ax.text(*z['center'], z['name'] + (' (низ)' if z['level'] else ''), fontsize=10, ha='center', va='center', color='white', weight='bold',
                bbox=dict(boxstyle='round,pad=0.15', fc='black', alpha=0.6, lw=0))
    for k, (p, lab, col) in enumerate(paths):
        P = np.stack([X[p] + (k * 6 - 3), Y[p] + (k * 6 - 3)], 1)
        ax.plot(P[:, 0], P[:, 1], color=col, lw=3.2, label=lab, alpha=0.95)
        ax.scatter([P[0, 0]], [P[0, 1]], s=90, color=col, edgecolor='black', zorder=5)
        ax.scatter([P[-1, 0]], [P[-1, 1]], s=140, color=col, marker='*', edgecolor='black', zorder=5)
        for i in range(0, len(p), max(1, len(p) // 9)):   # высота пола на пути
            ax.text(P[i, 0] + 8, P[i, 1] - 8, '%d' % nz[p[i]], fontsize=8, color=col, weight='bold')
    ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[3], ext[2]); ax.set_xticks([]); ax.set_yticks([])
    ax.legend(loc='lower right', fontsize=12, framealpha=0.9)
    ax.set_title('Пути по этажам геометрии (цифры — высота пола, ед.). Жёлтым — Short и Ladder, фиолетовым — Underpath', fontsize=13)
    plt.tight_layout(); plt.savefig(os.path.join(mapdir.ROOT, 'docs', 'reports', 'map3d', 'route_bhouse_mid.png'), dpi=75); plt.close()


if __name__ == '__main__':
    main(mapdir.current())
