"""(шаг 0а) пол сетки видимости — плоский участок навмеша на средней высоте углов (a.z), а в .nav Mirage у углов своя высота
(лестницы, пандусы). Насколько это ошибка: точки, где линия убийства про режет «пол», — на наклонном участке? и высота
настоящего пола (по углам, билинейно ≈ среднее с весами) против a.z."""
import json, sys, os, numpy as np
from matplotlib.path import Path
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', '..')); import mapdir  # noqa
def zplane(a, x, y):
    """высота пола участка в точке по углам (обратные расстояния — достаточно для разбора)"""
    P = np.array([[p['x'], p['y'], p.get('z', a['z'])] for p in a['points']]); d = np.hypot(P[:, 0]-x, P[:, 1]-y) + 1e-3
    return float((P[:, 2]/d).sum()/(1/d).sum())
def run(M, VD):
    A = mapdir.load_nav(M); paths = [Path([[p['x'], p['y']] for p in a['points']]) for a in A]
    sl = np.array([max(p.get('z', a['z']) for p in a['points']) - min(p.get('z', a['z']) for p in a['points']) for a in A])
    K = json.load(open(os.path.join(VD, f'{M}_kills.json'))); E = json.load(open(os.path.join(VD, f'{M}_engine.json')))['kills']
    B = [(k, e) for k, e in zip(K, E) if k[12] == 0 and e[0] == 0 and e[3] == 'floor' and not e[8]]
    on, err = 0, []
    for k, e in B:
        x, y, top = e[4], e[5], e[7][3] if len(e[7]) > 3 else None
        cand = [i for i, p in enumerate(paths) if p.contains_point((x, y))]
        if not cand or top is None: continue
        i = min(cand, key=lambda i: abs(A[i]['z'] - top))
        if sl[i] > 10: on += 1; err.append(A[i]['z'] - zplane(A[i], x, y))
    return len(B), on, (float(np.median(np.abs(err))) if err else None), int((sl > 10).sum()), int((sl > 30).sum()), float(sl.max())
if __name__ == '__main__':
    M = mapdir.current(); n, on, me, s10, s30, smax = run(M, os.path.join(mapdir.ROOT, 'tools', 'measure', 'runs', 'e0a_vis'))
    print(M, f'«пол режет» (без края тела): {n}; из них на наклонном участке (> 10 ед.): {on}; |a.z − пол по углам| там, медиана {me}; '
          f'наклонных участков > 10: {s10}, > 30: {s30}, макс {smax}')
