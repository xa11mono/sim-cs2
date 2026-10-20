#!/usr/bin/env python3
"""(шаг 0а) крупный план места: радар, высота препятствий сетки движка над полом (VIS.solid − нижний пол навмеша),
высокие стены (VIS.segs), линии убийств про, которые движок «не видит» (по причине), и точки про выше/ниже нашего пола.
python3 tools/measure/engine/zoom.py --map mirage <имя> x0 y0 x1 y1"""
import sys, os, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', '..'))
import mapdir  # noqa
MAP = mapdir.current(); name = sys.argv[1]; x0, y0, x1, y1 = map(float, sys.argv[2:6])
VD = os.path.join(mapdir.ROOT, 'tools', 'measure', 'runs', 'e0a_vis'); IMG = os.path.join(mapdir.ROOT, 'docs', 'reports', 'engine_audit')
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt  # noqa
from PIL import Image  # noqa
G = json.load(open(os.path.join(VD, f'{MAP}_grid.json'))); W = G['W']; C = G['cell']
fl = np.array(G['floor'], float).reshape(W, W); so = np.array(G['solid'], float).reshape(W, W); ce = np.array(G['ceil'], float).reshape(W, W)
K = json.load(open(os.path.join(VD, f'{MAP}_kills.json'))); E = json.load(open(os.path.join(VD, f'{MAP}_engine.json')))['kills']
R = np.asarray(Image.open(mapdir.radar_png(MAP)).convert('RGB'))
f, ax = plt.subplots(figsize=(9, 9 * (y1 - y0) / (x1 - x0)), dpi=110)
ax.imshow(R, extent=(0, 2048, 2048, 0), alpha=0.6)
# высота верха препятствия над полом (укрытия), и «пол» сетки — рельефом
h = np.where(so > -9000, so, np.nan); ax.imshow(h, extent=(0, W*C, W*C, 0), cmap='terrain', alpha=0.45, interpolation='nearest')
roof = np.where(ce < 9000, 1.0, np.nan); ax.imshow(roof, extent=(0, W*C, W*C, 0), cmap='Blues', vmin=0, vmax=1.5, alpha=0.25, interpolation='nearest')
for s in G['segs']:
    if min(s[0], s[2]) < x1 and max(s[0], s[2]) > x0 and min(s[1], s[3]) < y1 and max(s[1], s[3]) > y0: ax.plot([s[0], s[2]], [s[1], s[3]], color='black', lw=1.4)
col = {'wall': 'red', 'floor': 'orange', 'cover': 'magenta', 'ceil': 'blue', 'level': 'cyan', '': 'gray'}
n = 0
for k, e in zip(K, E):
    if k[12] or e[0]: continue
    if not (x0 < e[4] < x1 and y0 < e[5] < y1): continue
    ax.plot([k[3], k[6]], [k[4], k[7]], color=col[e[3]], lw=0.6, alpha=0.4); ax.scatter([e[4]], [e[5]], s=10, color=col[e[3]], zorder=3); n += 1
# подписи высот сетки (каждые ~40 px)
for gy in np.arange(y0 + 20, y1, 40):
    for gx in np.arange(x0 + 20, x1, 40):
        i, j = int(gx // C), int(gy // C); v = so[j, i]
        if v > -9000: ax.text(gx, gy, f'{v:.0f}', fontsize=6, ha='center', color='black', alpha=0.8)
ax.set_xlim(x0, x1); ax.set_ylim(y1, y0); ax.set_axis_off()
ax.set_title(f'{mapdir.title(MAP)}, {name}: линии убийств про, где движок «не видит» ({n}); числа — верх препятствия/пол сетки, ед. игры;\n'
             'чёрное — высокие стены; красн. — режет стена, оранж. — пол/уступ, малин. — укрытие, синее — крыша', fontsize=8)
p = os.path.join(IMG, f'{MAP}_zoom_{name}.png'); f.savefig(p, bbox_inches='tight'); print(os.path.relpath(p, mapdir.ROOT))
