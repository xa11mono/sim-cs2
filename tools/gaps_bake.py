"""Прыжки через щель из демок (v546, владелец 10.11, Mirage A: «залезает на первый ящик, на второй и прыгает на верхний этаж — так
быстрее, игроки ещё не успевают дойти»). В .nav игры между участками, разделёнными щелью (ящик → уступ, уступ → уступ), связи нет,
и бот к месту за щелью шёл в обход. Прыжок есть, если в демках игроки переходят с участка A на участок B (оба — пол, перепад
не выше прыжка) по воздуху — без участка навмеша под ногами между ними — за ≤ GAP_SEC, так часто, как MIN_N раз в MIN_DEMOS демках,
и по навмешу из A в B только обход (как у подъёмов, climbs_bake.py).
Выход: список gaps в data/maps/<карта>/climbs.json (подъёмы не трогает) → MAP.climbs.gaps: игра добавляет связь A → B в граф пути
и прыгает по ней, как лезет по подъёму (ladderTick, 370).
Запуск: python3 tools/gaps_bake.py --map mirage"""
import sys, os, json, collections, heapq
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from demos import MAPNAME, demo_names, ticks_of  # noqa: E402
import mapdir  # noqa: E402

JUMP_UP = 64          # ед. игры, как JUMP_UP в игре и в climbs_bake.py
DZ = 25               # допуск высоты пола участка, ед. игры (как в climbs_bake.py)
GAP_SEC = 1.0         # проектное число: прыжок через щель — меньше секунды в воздухе
SAMPLE = 4            # тиков между отсчётами (16 в секунду)
MIN_N, MIN_DEMOS = 20, 10   # как у подъёмов: только частые прыжки (редкие — случайные)
DETOUR = 3.0          # прыжок нужен, только если навмеш ведёт туда в обход (как у подъёмов)
CELL = 2              # px карты — клетка растра участков

nav = json.load(open(mapdir.path(MAPNAME, 'navmesh.json'), encoding='utf-8'))['areas']
by = {a['id']: a for a in nav}
cen = {a['id']: (sum(p['x'] for p in a['points']) / len(a['points']), sum(p['y'] for p in a['points']) / len(a['points'])) for a in nav}

# растр участков: в клетке — до LAYERS участков разной высоты
LAYERS, N = 4, 2048 // CELL
RID = np.full((LAYERS, N, N), -1, np.int32); RZ = np.full((LAYERS, N, N), np.nan, np.float32)
for a in nav:
    P = np.array([[p['x'], p['y']] for p in a['points']], np.float64)
    x0, y0 = max(0, int(P[:, 0].min() // CELL)), max(0, int(P[:, 1].min() // CELL))
    x1, y1 = min(N - 1, int(P[:, 0].max() // CELL)), min(N - 1, int(P[:, 1].max() // CELL))
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1)); px, py = (gx + 0.5) * CELL, (gy + 0.5) * CELL
    inside = np.zeros(px.shape, bool); j = len(P) - 1
    for i in range(len(P)):
        xi, yi, xj, yj = P[i, 0], P[i, 1], P[j, 0], P[j, 1]
        with np.errstate(divide='ignore', invalid='ignore'):
            cr = ((yi > py) != (yj > py)) & (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
        inside ^= cr; j = i
    for cy, cx in zip(*np.where(inside)):
        Y, X = cy + y0, cx + x0
        for l in range(LAYERS):
            if RID[l, Y, X] < 0: RID[l, Y, X] = a['id']; RZ[l, Y, X] = a['z']; break

def areas_at(x, y, z):
    cx = np.clip((x // CELL).astype(np.int64), 0, N - 1); cy = np.clip((y // CELL).astype(np.int64), 0, N - 1)
    best = np.full(len(x), -1, np.int64); bd = np.full(len(x), DZ, np.float32)
    for l in range(LAYERS):
        d = np.abs(RZ[l, cy, cx] - z); ok = (d < bd) & (RID[l, cy, cx] >= 0)
        best[ok] = RID[l, cy, cx][ok]; bd[ok] = d[ok]
    return best

def nav_len(s, g, cap):
    D = {s: 0.0}; h = [(0.0, s)]
    while h:
        d, u = heapq.heappop(h)
        if u == g: return d
        if d > cap or d > D.get(u, 1e18): continue
        for v in by[u]['conn']:
            if v not in by: continue
            nd = d + ((cen[u][0] - cen[v][0]) ** 2 + (cen[u][1] - cen[v][1]) ** 2) ** 0.5
            if nd < D.get(v, 1e18): D[v] = nd; heapq.heappush(h, (nd, v))
    return 1e18

hits = collections.defaultdict(list)
for demo in demo_names():
    t = ticks_of(demo); t = t[t.tick % SAMPLE == 0]
    t = t.sort_values(['steamid', 'tick'], kind='stable')
    X, Y, Z, S, T = t.x.values, t.y.values, t.Z.values, t.steamid.values, t.tick.values
    A = areas_at(X, Y, Z)
    for sid in np.unique(S):
        w = np.where(S == sid)[0]; last = None
        for k in w:
            a = A[k]
            if a < 0: continue
            if last is not None:
                pa, pk = A[last], last
                if a != pa and T[k] - T[pk] > SAMPLE and T[k] - T[pk] <= GAP_SEC * 64 and \
                        a not in by[pa]['conn'] and pa not in by[a]['conn'] and abs(by[a]['z'] - by[pa]['z']) <= JUMP_UP and \
                        Z[pk:k + 1].min() >= min(by[a]['z'], by[pa]['z']) - DZ:
                    hits[(int(pa), int(a))].append((demo, float(X[pk]), float(Y[pk]), float(X[k]), float(Y[k]), (T[k] - T[pk]) / 64))
            last = k
    del t

out = []
for (pa, a), H in sorted(hits.items()):
    if len(H) < MIN_N or len({h[0] for h in H}) < MIN_DEMOS: continue
    st = ((cen[pa][0] - cen[a][0]) ** 2 + (cen[pa][1] - cen[a][1]) ** 2) ** 0.5; cap = max(DETOUR * st, st + 150)
    if nav_len(pa, a, cap + 1) <= cap: continue
    M = np.array([h[1:6] for h in H])
    out.append({'a': {'area': pa, 'x': round(float(np.median(M[:, 0])), 1), 'y': round(float(np.median(M[:, 1])), 1), 'z': by[pa]['z']},
                'b': {'area': a, 'x': round(float(np.median(M[:, 2])), 1), 'y': round(float(np.median(M[:, 3])), 1), 'z': by[a]['z']},
                'n': len(H), 'demos': len({h[0] for h in H}), 'sec': round(float(np.median(M[:, 4])), 2)})
    print('  прыжок %d → %d (перепад %+d): %d раз в %d демках, медиана %.2f с' % (pa, a, by[a]['z'] - by[pa]['z'], len(H), out[-1]['demos'], out[-1]['sec']))
f = mapdir.path(MAPNAME, 'climbs.json'); C = json.load(open(f, encoding='utf-8')); C['gaps'] = out
json.dump(C, open(f, 'w', encoding='utf-8'), separators=(',', ':'))
print('climbs.json: %d прыжков через щель' % len(out))
