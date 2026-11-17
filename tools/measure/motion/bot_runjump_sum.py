import json, glob, sys, numpy as np
S = sys.argv[1]; A = [json.load(open(f)) for f in glob.glob(S + '/brj_*.json')]
J = [j for a in A for j in a['JJ']]; FB = np.sum([a['FB'] for a in A], 0); RM = sum(a['RM'] for a in A) / 3840
B = [15, 30, 60, 90, 180]; b = lambda x: next(k for k in range(5) if abs(x) <= B[k])
q = lambda a: [round(float(x), 2) for x in np.percentile(a, [10, 25, 50, 75, 90])] if len(a) else None
print('бот: прыжков на бегу %d, спокойного бега %.0f мин — %.2f в мин (про 4,15)' % (len(J), RM, len(J) / max(1e-9, RM)))
print('поворот хода по корзинам, %%: %s (про [39, 14, 16, 13, 18])' % [round(100 * sum(1 for j in J if b(j['mv']) == k) / max(1, len(J))) for k in range(5)])
print('доли поворота пути впереди на спокойном беге, %%: %s' % [round(100 * x / FB.sum(), 1) for x in FB])
print('ход, °: %s (про [0, 5.6, 26, 69, 141])' % q([abs(j['mv']) for j in J]))
print('камера, °: %s (про [1.2, 5.4, 20, 57, 95])' % q([abs(j['cam']) for j in J]))
print('скорость после / до: %s (про [0.22, 0.53, 0.76, 0.84, 0.98])' % q([j['keep'] for j in J]))
print('A/D в воздухе: %d%% (про 95), обе: %d%% (52), доля полёта %s (про [0.23, 0.51, 0.75, 0.91, 1.0])' % (100 * np.mean([j['adf'] > 0 for j in J]), 100 * np.mean([j['both'] for j in J]), q([j['adf'] for j in J])))
cs = [np.sign(j['cam']) == np.sign(j['mv']) for j in J if abs(j['mv']) >= 15 and abs(j['cam']) >= 5]; print('камера в сторону хода: %d%% из %d (про 64)' % (100 * np.mean(cs) if cs else 0, len(cs)))
# матрица: поворот пути впереди при решении → поворот хода за полёт (доли), и подбор частот под доли про (4,15 в мин; 39/14/16/13/18 %)
M = np.zeros((5, 5))
for j in J:
    if j.get('tn') is not None: M[b(j['tn']), b(j['mv'])] += 1
rows = M.sum(1); P = M / np.maximum(1, rows[:, None]); f = FB / FB.sum()
print('решение → исход, %:'); [print('  ', B[k], [round(100 * x) for x in P[k]], 'n', int(rows[k])) for k in range(5)]
tgt = 4.15 * np.array([.39, .14, .16, .13, .18])   # прыжков в мин по исходу
from itertools import product
best = None
import numpy.linalg as la
# прыжков в мин по исходу = sum_k rate_k * f_k * P[k, :]  → решить в неотрицательных
A = (f[:, None] * P).T   # 5 исходов × 5 решений
x = np.clip(la.lstsq(A, tgt, rcond=None)[0], 0.2, None)
for _ in range(200):   # проекция на x ≥ 0,2
    g = A.T @ (A @ x - tgt); x = np.clip(x - 0.5 * g / max(1e-9, (A ** 2).sum()), 0.2, None)
print('частоты по решению (в мин бега в своей корзине):', [round(float(v), 2) for v in x], '→ исход', [round(float(v), 2) for v in A @ x], 'цель', [round(float(v), 2) for v in tgt])
