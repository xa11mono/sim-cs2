#!/usr/bin/env python3
"""(М140) картинка правки стен tools/wall_fit.py: было (серое) / стало (красное), где стоят про, убийства про, которые режет
стена — до (серые точки) и после (красные). python3 tools/measure/engine/wallfit_shots.py <карта> <стены_до.json> <тег_до> <тег_после> <выход.png> [x0 y0 x1 y1]"""
import sys, os, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', '..'))
import mapdir  # noqa
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt  # noqa
from PIL import Image  # noqa
M, before, t0, t1, out = sys.argv[1:6]; box = list(map(float, sys.argv[6:10])) if len(sys.argv) > 9 else [0, 0, 2048, 2048]
VD = os.path.join(mapdir.ROOT, 'tools', 'measure', 'runs', 'e0a_vis')
W0 = json.load(open(before))['polys']; W1 = json.load(open(mapdir.path(M, 'walls.json')))['polys']
K = json.load(open(os.path.join(VD, f'{M}_kills.json')))
E0 = json.load(open(os.path.join(VD, f'{M}_engine{t0}.json')))['kills']; E1 = json.load(open(os.path.join(VD, f'{M}_engine{t1}.json')))['kills']
H = np.array(json.load(open(os.path.join(VD, f'{M}_hgt.json'))))[::4]
x0, y0, x1, y1 = box; H = H[(H[:, 0] > x0) & (H[:, 0] < x1) & (H[:, 1] > y0) & (H[:, 1] < y1)]
R = np.asarray(Image.open(mapdir.radar_png(M)).convert('RGB'))
sz = 14 if box[2] - box[0] > 1000 else 10
f, ax = plt.subplots(figsize=(sz, sz * (y1 - y0) / (x1 - x0)), dpi=100)
ax.imshow(R, extent=(0, 2048, 2048, 0), alpha=0.75)
ax.scatter(H[:, 0], H[:, 1], s=0.3, c='green', alpha=0.15)
for p in W0:
    q = np.array(p + [p[0]]); ax.fill(q[:, 0], q[:, 1], color='black', alpha=0.25, lw=0); ax.plot(q[:, 0], q[:, 1], color='black', lw=0.8, ls='--')
for p in W1:
    q = np.array(p + [p[0]]); ax.plot(q[:, 0], q[:, 1], color='red', lw=1.2)
c0 = np.array([[e[4], e[5]] for k, e in zip(K, E0) if k[12] == 0 and e[0] == 0 and e[3] == 'wall'])
c1 = np.array([[e[4], e[5]] for k, e in zip(K, E1) if k[12] == 0 and e[0] == 0 and e[3] == 'wall'] or [[-9, -9]])
ax.scatter(c0[:, 0], c0[:, 1], s=6, c='gray', edgecolors='black', linewidths=0.2, label=f'стена режет убийство про — до ({len(c0)})')
ax.scatter(c1[:, 0], c1[:, 1], s=8, c='red', edgecolors='black', linewidths=0.2, label=f'после ({len(c1)})')
for c in mapdir.callouts(M):
    if x0 < c[1] < x1 and y0 < c[2] < y1: ax.text(c[1], c[2] + 10, c[0], fontsize=7, ha='center', bbox=dict(fc='white', alpha=0.6, lw=0, pad=0.4))
ax.set_xlim(x0, x1); ax.set_ylim(y1, y0); ax.set_axis_off(); ax.legend(loc='lower left', fontsize=8)
ax.set_title(f'{mapdir.title(M)}: стены было (серое, пунктир) → стало (красное); зелёное — где стоят про', fontsize=10)
f.savefig(out, bbox_inches='tight'); print(out)
