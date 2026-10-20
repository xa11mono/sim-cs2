"""(шаг 0а) повтор visParts движка на выгруженной сетке (numpy) — чтобы мерить, насколько глубоко линия уходит в препятствие
и что будет, если сетка чуть «уже». Только для разбора; совпадение с движком проверяется на тех же убийствах."""
import json, os, numpy as np
from scipy import ndimage
def load(VD, MAP, TAG=''):
    G = json.load(open(os.path.join(VD, f'{MAP}_grid{TAG}.json'))); W = G['W']
    return W, G['cell'], np.array(G['solid'], float).reshape(W, W), np.array(G['ceil'], float).reshape(W, W), np.array(G['floor'], float).reshape(W, W)
EPS = 6
def inside(S, Cl, C, ax, ay, az, bx, by, bz):
    """длина (ед. игры) участка линии, где она ниже верха препятствия; и где выше потолка"""
    W = S.shape[0]; dx, dy, dz = bx-ax, by-ay, bz-az; n = int(np.ceil(np.hypot(dx, dy)/C))
    if n < 2: return 0.0, 0.0
    t = np.arange(1, n)/n; x = ((ax+dx*t)/C).astype(int); y = ((ay+dy*t)/C).astype(int); z = az+dz*t
    ok = (x >= 0) & (y >= 0) & (x < W) & (y < W); x, y, z = x[ok], y[ok], z[ok]
    step = np.hypot(dx, dy)/n*2.5
    return float(((z < S[y, x]-EPS)).sum()*step), float((z > Cl[y, x]).sum()*step)
def erode_raised(S, F, k):
    """препятствия (верх выше соседнего пола) «уже» на k клеток: минимум по окну, но не ниже своего пола"""
    if k <= 0: return S
    m = ndimage.grey_erosion(S, size=(2*k+1, 2*k+1))
    return np.maximum(m, np.where(F > -9000, F, m))
