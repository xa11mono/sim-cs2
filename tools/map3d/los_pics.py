#!/usr/bin/env python3
"""Картинки А1: python3 tools/map3d/los_pics.py [--map mirage]  (после los_check.py)
docs/reports/map3d/los_overview.png — где закрыто (убийства без прострела, все лучи закрыты) и обратная проверка;
docs/reports/map3d/los_zoom_N.png — крупно по местам: вид сверху (геометрия у луча, цвет — высота верха) и разрез по лучу
(треугольники и блоки в полосе ±20 ед. от вертикальной плоскости луча; человечки — ноги…голова, линия — глаза 64 → грудь)."""
import sys, os, json, collections
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa
from raycast import World  # noqa
MAP = mapdir.current(); ROOT = mapdir.ROOT
R = mapdir.radar(MAP); S2 = R['scale'] / 2.0
m2g = lambda x, y: (x * S2 + R['pos_x'], R['pos_y'] - y * S2)
g2m = mapdir.game_to_map(MAP)
IMG = os.path.join(ROOT, 'docs', 'reports', 'map3d')
CALL = mapdir.callouts(MAP)
def place(x, y): return min(CALL, key=lambda c: (c[1] - x) ** 2 + (c[2] - y) ** 2)[0] if CALL else '?'
K = json.load(open(os.path.join(ROOT, 'tools', 'measure', 'runs', 'e0a_vis', f'{MAP}_kills.json')))
D = json.load(open(os.path.join(ROOT, 'tools', 'measure', 'runs', 'map3d', f'{MAP}_los.json')))
W = World(MAP)
radar = plt.imread(mapdir.path(MAP, 'radar.png'))
closed = [r for r in D['kills'] if r['pen'] == 0 and not r['open']]
stand = [r for r in D['kills'] if r['pen'] == 0 and not r['strict'] and r['open']]

def ends(r):
    k = K[r['i']]; A = m2g(k[3], k[4]); B = m2g(k[6], k[7])
    return np.array([A[0], A[1], k[5]]), np.array([B[0], B[1], k[8]]), k

# ---------- обзор ----------
f, axs = plt.subplots(1, 2, figsize=(20, 10.5))
for ax in axs: ax.imshow(radar, extent=[0, 2048, 2048, 0]); ax.set_xlim(0, 2048); ax.set_ylim(2048, 0); ax.axis('off')
ax = axs[0]
for r in stand:
    k = K[r['i']]; ax.plot([k[3], k[6]], [k[4], k[7]], color='#f2b84b', lw=0.5, alpha=0.35)
for r in closed:
    k = K[r['i']]; ax.plot([k[3], k[6]], [k[4], k[7]], color='#e0301e', lw=1.4)
    ax.scatter([k[3]], [k[4]], s=14, color='#e0301e', zorder=3); ax.scatter([k[6]], [k[7]], s=22, marker='x', color='white', zorder=3)
ax.set_title(f'Убийства без прострела ({len([r for r in D["kills"] if r["pen"] == 0])}): красным — закрыто всеми лучами '
             f'({len(closed)}), жёлтым — закрыто только стоя ({len(stand)})', fontsize=11)
ax = axs[1]
pen = [r for r in D['kills'] if r['pen'] > 0]
for r in pen:
    k = K[r['i']]; c = '#3b82f6' if not r['open'] else '#9ca3af'
    ax.plot([k[3], k[6]], [k[4], k[7]], color=c, lw=0.9, alpha=0.8)
ax.set_title(f'Прострелы (penetrated > 0, {len(pen)}): синим — геометрия закрывает ({sum(1 for r in pen if not r["open"])}), '
             f'серым — линия всё же есть', fontsize=11)
f.tight_layout(); f.savefig(os.path.join(IMG, 'los_overview.png'), dpi=80); plt.close(f)

# ---------- крупно ----------
first = []
for r in closed:
    A, B, k = ends(r); h = W.ray(A + [0, 0, 64], B + [0, 0, 44])
    first.append((r, h))
cl = []
for r, h in first:
    if h is None: continue
    p = h[3]
    for c in cl:
        if np.hypot(*(c['p'][:2] - p[:2])) < 160: c['m'].append((r, h)); break
    else: cl.append({'p': p, 'm': [(r, h)]})
cl.sort(key=lambda c: -len(c['m']))
V = W.z['mesh_v']; T = W.z['mesh_t']; tri = V[T]
def hull_poly_xy(k):
    pts = W.hull_v[W.hv_off[k]:W.hv_off[k + 1], :2]; c = pts.mean(0); a = np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0])
    return pts[np.argsort(a)]
def hull_section(k, P0, u, half=20):
    """блок в разрезе: вершины в полосе → (s, z) выпуклая оболочка (грубо — по вершинам)"""
    pts = W.hull_v[W.hv_off[k]:W.hv_off[k + 1]]; s = (pts[:, :2] - P0[:2]) @ u
    return np.c_[s, pts[:, 2]]
info = []
for ci, c in enumerate(cl[:8]):
    r, h = c['m'][0]; A, B, k = ends(r); p = c['p']
    f, (a1, a2) = plt.subplots(1, 2, figsize=(17, 7.5), gridspec_kw={'width_ratios': [1, 1.35]})
    # сверху
    R0 = 260; box = (p[0] - R0, p[0] + R0, p[1] - R0, p[1] + R0)
    zlo = min(A[2], B[2]) - 20; zhi = max(A[2], B[2]) + 90
    sel = np.where((tri[:, :, 0].max(1) > box[0]) & (tri[:, :, 0].min(1) < box[1]) & (tri[:, :, 1].max(1) > box[2]) & (tri[:, :, 1].min(1) < box[3])
                   & (tri[:, :, 2].max(1) > zlo) & (tri[:, :, 2].min(1) < zhi))[0]
    top = tri[sel, :, 2].max(1)
    pc = PolyCollection(tri[sel, :, :2], array=top, cmap='viridis', edgecolors='none', alpha=0.55); pc.set_clim(zlo, zhi); a1.add_collection(pc)
    hs = np.where((W.hhi[:, 0] > box[0]) & (W.hlo[:, 0] < box[1]) & (W.hhi[:, 1] > box[2]) & (W.hlo[:, 1] < box[3]) & (W.hhi[:, 2] > zlo) & (W.hlo[:, 2] < zhi))[0]
    blk_h = {hh[2] for rr, hh in c['m'] if hh[1] == 'h'}; blk_t = {hh[2] for rr, hh in c['m'] if hh[1] == 'm'}
    for hk in hs:
        pg = hull_poly_xy(hk); a1.fill(pg[:, 0], pg[:, 1], facecolor='none', edgecolor='#e0301e' if hk in blk_h else '#555', lw=2 if hk in blk_h else 0.6)
    if blk_t:
        bt = tri[list(blk_t)]; a1.add_collection(PolyCollection(bt[:, :, :2], facecolors='none', edgecolors='#e0301e', lw=2.5))
    for rr, hh in c['m']:
        AA, BB, kk = ends(rr); a1.plot([AA[0], BB[0]], [AA[1], BB[1]], color='#e0301e', lw=1)
        a1.scatter([AA[0]], [AA[1]], color='#e0301e', s=25, zorder=4); a1.scatter([BB[0]], [BB[1]], color='k', marker='x', s=30, zorder=4)
        a1.scatter([hh[3][0]], [hh[3][1]], color='yellow', edgecolor='k', s=40, zorder=5)
    a1.set_xlim(box[0], box[1]); a1.set_ylim(box[2], box[3]); a1.set_aspect('equal')
    plt.colorbar(pc, ax=a1, fraction=0.04, label='верх треугольника, ед.')
    nm = place(*g2m(p[0], p[1]))
    a1.set_title(f'{nm}: сверху (±{R0} ед.), {len(c["m"])} убийств; красное — что закрывает, жёлтое — точка удара', fontsize=10)
    # разрез по первому лучу
    E = A + [0, 0, 64]; G = B + [0, 0, 44]; d = (G - E)[:2]; Lxy = np.hypot(*d); u = d / Lxy; nrm = np.array([-u[1], u[0]])
    s3 = (tri[:, :, :2] - E[:2]) @ u; o3 = (tri[:, :, :2] - E[:2]) @ nrm
    near = np.where((np.abs(o3).min(1) < 20) | ((o3.min(1) < 0) & (o3.max(1) > 0)))[0]
    near = near[(s3[near].max(1) > -60) & (s3[near].min(1) < Lxy + 60)]
    polys = np.stack([s3[near], tri[near, :, 2]], -1)
    a2.add_collection(PolyCollection(polys, facecolors='#8b9bb4', edgecolors='#4b5563', lw=0.3, alpha=0.6))
    for hk in hs:
        sc = hull_section(hk, E, u); oo = (W.hull_v[W.hv_off[hk]:W.hv_off[hk + 1], :2] - E[:2]) @ nrm
        if oo.min() < 20 and oo.max() > -20:
            q = sc[np.argsort(np.arctan2(sc[:, 1] - sc[:, 1].mean(), sc[:, 0] - sc[:, 0].mean()))]
            a2.fill(q[:, 0], q[:, 1], facecolor='#e0301e' if hk in blk_h else '#c9a227', alpha=0.45, edgecolor='k', lw=0.5)
    if h[1] == 'm' and h[2] in near:
        j = h[2]; a2.fill(s3[j], tri[j, :, 2], color='#e0301e', alpha=0.9)
    for (x0, z0, lab) in ((0, A[2], 'убийца'), (Lxy, B[2], 'жертва')):
        a2.add_patch(plt.Rectangle((x0 - 16, z0), 32, 72, fill=False, edgecolor='k', lw=1.2)); a2.text(x0, z0 + 76, lab, ha='center', fontsize=9)
    a2.plot([0, Lxy], [E[2], G[2]], color='#e0301e', lw=1.5); a2.plot([0, Lxy], [A[2] + 46, G[2]], color='#e0301e', lw=0.8, ls='--')
    hp = (h[3][:2] - E[:2]) @ u; a2.scatter([hp], [h[3][2]], color='yellow', edgecolor='k', s=60, zorder=5)
    zz = [A[2], B[2], h[3][2]]; a2.set_ylim(min(zz) - 60, max(zz) + 160); a2.set_xlim(-60, Lxy + 60); a2.set_aspect('equal')
    a2.set_xlabel('вдоль луча, ед.'); a2.set_ylabel('высота, ед.')
    what = f'блок h{h[2]}: {np.round(W.hhi[h[2]] - W.hlo[h[2]]).astype(int).tolist()} ед. (ш × д × в)' if h[1] == 'h' else f'треугольник сетки {W.mesh_id[h[2]]}'
    a2.set_title(f'разрез по лучу (полоса ±20 ед.): {what}; сплошная — глаза 64 → грудь, пунктир — глаза 46', fontsize=10)
    f.tight_layout(); fn = f'los_zoom_{ci + 1}.png'; f.savefig(os.path.join(IMG, fn), dpi=75); plt.close(f)
    info.append({'png': fn, 'место': nm, 'убийств': len(c['m']), 'что': what, 'точка': [round(float(x)) for x in p]})
json.dump(info, open(os.path.join(ROOT, 'tools', 'measure', 'runs', 'map3d', f'{MAP}_zoom.json'), 'w'), ensure_ascii=False, indent=0)
print(json.dumps(info, ensure_ascii=False))
print('кластеров', len(cl), [len(c['m']) for c in cl])

# ---------- слои служебной геометрии (А2): что убрано из видимости ----------
z = W.z
if 'mesh_attr' in z:
    A = json.loads(str(z['attr_json'])); SN = [s.lower() for s in z['surf_names']]
    def tags(g): return {x.lower() for x in A[g]['as']}
    LAY = [('playerclip (невидимые стены для игроков; на картинке — только стены до z 150, без «крышек» над картой)', lambda g, s: 'playerclip' in tags(g), '#e0301e'),
           ('csgo_grenadeclip (только для гранат)', lambda g, s: 'csgo_grenadeclip' in tags(g), '#a855f7'),
           ('passbullets (пули проходят)', lambda g, s: 'passbullets' in tags(g), '#22c55e'),
           ('стекло / сетка (видно насквозь)', lambda g, s: not tags(g) and SN[s] in ('glass', 'chainlink'), '#38bdf8')]
    f, ax = plt.subplots(figsize=(12, 12)); ax.imshow(radar, extent=[0, 2048, 2048, 0]); ax.axis('off')
    tv = z['mesh_v'][z['mesh_t']]; ma, ms = z['mesh_attr'], z['mesh_surf']; ha, hsf = z['hull_attr'], z['hull_surf']
    for nm, fn, col in LAY:
        sel = np.array([fn(g, s) for g, s in zip(ma, ms)]); nall = int(sel.sum())
        if 'playerclip' in nm:
            nz = np.abs(np.cross(tv[:, 1] - tv[:, 0], tv[:, 2] - tv[:, 0])[:, 2]) / (np.linalg.norm(np.cross(tv[:, 1] - tv[:, 0], tv[:, 2] - tv[:, 0]), axis=1) + 1e-9)
            sel &= (nz < 0.3) & (tv[:, :, 2].min(1) < 150)
        if sel.any():
            P = tv[sel]; X, Y = g2m(P[:, :, 0], P[:, :, 1])
            ax.add_collection(PolyCollection(np.stack([X, Y], -1), facecolors=col, edgecolors=col, alpha=0.55, lw=0.5))
        for k in np.where([fn(g, s) for g, s in zip(ha, hsf)])[0]:
            pg = hull_poly_xy(k); X, Y = g2m(pg[:, 0], pg[:, 1]); ax.fill(X, Y, facecolor=col, edgecolor='k', lw=0.4, alpha=0.8)
        ax.plot([], [], color=col, lw=6, label='%s: %d треуг., %d блоков' % (nm, nall, sum(fn(g, s) for g, s in zip(ha, hsf))))
    ax.legend(loc='lower left', fontsize=9); ax.set_title('Служебная геометрия из файла игры — не закрывает взгляд', fontsize=11)
    f.tight_layout(); f.savefig(os.path.join(IMG, 'phys_layers.png'), dpi=80); plt.close(f)
