#!/usr/bin/env python3
"""А1 (М148, 20.10.2026): проверка геометрии столкновений по демкам. python3 tools/map3d/los_check.py [--map mirage]
Вход — tools/measure/runs/e0a_vis/<карта>_{kills,neg}.json (tools/measure/engine/demo_prep.py: XY — player_death, Z — тики).
Луч от глаз убийцы к телу жертвы по треугольникам сеток и выпуклым блокам (tools/map3d/raycast.py).
 «стоя»  — глаза Z+64 → голова (Z+62) или грудь (Z+44) жертвы; хоть один чистый = видно.
 «закрыто» — не видно ни одним из лучей: глаза Z+64 / Z+46 (присел; в демках приседа нет — берём оба) → голова Z+62, грудь Z+44,
            таз Z+30, присевшая голова Z+44, со сдвигом ±12 ед. вбок (плечи) — 2 × 9 лучей.
Где закрыто — первый предмет на луче «глаза 64 → грудь» и все предметы вдоль него; предметы — куски сеток (связные по общим
вершинам) и блоки. Обратная проверка — пары neg (2 с не стреляли, face=1 — смотрели друг на друга): «видно» = Z+64 → голова/грудь.
Пишет tools/measure/runs/map3d/<карта>_los.json и картинки docs/reports/map3d/los_*.png."""
import sys, os, json, math, collections, time
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa
from raycast import World  # noqa
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
MAP = mapdir.current(); ROOT = mapdir.ROOT
R = mapdir.radar(MAP); S2 = R['scale'] / 2.0
m2g = lambda x, y: (x * S2 + R['pos_x'], R['pos_y'] - y * S2)
g2m = mapdir.game_to_map(MAP)
VD = os.path.join(ROOT, 'tools', 'measure', 'runs', 'e0a_vis'); OUT = os.path.join(ROOT, 'tools', 'measure', 'runs', 'map3d'); os.makedirs(OUT, exist_ok=True)
IMG = os.path.join(ROOT, 'docs', 'reports', 'map3d'); os.makedirs(IMG, exist_ok=True)
CALL = mapdir.callouts(MAP)
def place(x, y):
    return min(CALL, key=lambda c: (c[1] - x) ** 2 + (c[2] - y) ** 2)[0] if CALL else '?'

W = World(MAP)
# куски сеток: треугольники, связанные общими вершинами
T = W.z['mesh_t']; nT = len(T)
rows = np.repeat(np.arange(nT), 3); cols = T.ravel()
G = coo_matrix((np.ones(len(rows)), (rows, cols + nT)), shape=(nT + len(W.z['mesh_v']),) * 2)
ncomp, lab = connected_components(G, directed=False); tri_comp = lab[:nT]
def elem(kind, idx): return ('m%d' % tri_comp[idx]) if kind == 'm' else ('h%d' % idx)

EYE = (64.0, 46.0); TGT = (62.0, 44.0, 30.0); SIDE = (0.0, 12.0, -12.0)
def rays_clear(A_xy, za, B_xy, zb, eyes=EYE, tg=TGT, side=SIDE):
    d = np.array([B_xy[0] - A_xy[0], B_xy[1] - A_xy[1]]); L = np.hypot(*d) or 1.0; pn = np.array([-d[1], d[0]]) / L
    for e in eyes:
        A = (A_xy[0], A_xy[1], za + e)
        for t in tg:
            for s in side:
                B = (B_xy[0] + pn[0] * s, B_xy[1] + pn[1] * s, zb + t)
                if W.ray(A, B) is None: return (e, t, s)
    return None

def along(A, B, cap=6):
    """все предметы вдоль луча (по порядку)"""
    A = np.asarray(A, float); B = np.asarray(B, float); out = []; base = 0.0
    while len(out) < cap:
        h = W.ray(A, B)
        if h is None: break
        t, k, i, p = h; e = elem(k, i)
        if not out or out[-1][0] != e: out.append((e, round(base + t * (1 - base), 4), [round(float(v), 1) for v in p]))
        base = base + (t + 0.5 / max(1.0, np.linalg.norm(B - A))) * (1 - base)
        A = A + (B - A) * (t + 0.5 / max(1.0, np.linalg.norm(B - A)))
        if base >= 1: break
    return out

t0 = time.time()
K = json.load(open(os.path.join(VD, f'{MAP}_kills.json'))); N = json.load(open(os.path.join(VD, f'{MAP}_neg.json')))
res = []
for i, k in enumerate(K):
    name, tick, rnd, ax, ay, za, vx, vy, zv, wpn, a_air, v_air, pen, smoke, dist = k
    A = m2g(ax, ay); B = m2g(vx, vy)
    strict = rays_clear(A, za, B, zv, eyes=(64.0,), tg=(62.0, 44.0), side=(0.0,))
    full = strict if strict else rays_clear(A, za, B, zv)
    blk = [] if strict else along((A[0], A[1], za + 64), (B[0], B[1], zv + 44))
    res.append({'i': i, 'strict': int(strict is not None), 'open': int(full is not None), 'how': full, 'blk': blk,
                'pen': pen, 'air': int(a_air or v_air), 'dist': dist})
    if i % 1000 == 0: print(i, len(K), round(time.time() - t0), 's', flush=True)

# обратная проверка: пары, смотревшие друг на друга (face=1) — все; остальные — выборкой
rng = np.random.default_rng(2)
NF = [n for n in N if n[8]]; NO = [n for n in N if not n[8]]; NO = [NO[j] for j in rng.choice(len(NO), min(len(NO), 4000), replace=False)]
neg = []
for n in NF + NO:
    A = m2g(n[2], n[3]); B = m2g(n[5], n[6])
    vis = rays_clear(A, n[4], B, n[7], eyes=(64.0,), tg=(62.0, 44.0), side=(0.0,)) or rays_clear(B, n[7], A, n[4], eyes=(64.0,), tg=(62.0, 44.0), side=(0.0,))
    neg.append([n[8], int(vis is not None)])
print('lines done', round(time.time() - t0), 's')

def pct(a, b): return round(100.0 * a / b, 1) if b else None
base = [r for r in res if r['pen'] == 0]; pen = [r for r in res if r['pen'] > 0]
ground = [r for r in base if not r['air']]
S = {'убийств пулей': len(res), 'без прострела': len(base), 'с прострелом': len(pen),
     'без прострела: закрыто стоя (64 → голова/грудь), %': pct(sum(1 for r in base if not r['strict']), len(base)),
     'без прострела: закрыто всеми лучами (присед, таз, плечи), %': pct(sum(1 for r in base if not r['open']), len(base)),
     'без прострела, не в прыжке: закрыто всеми лучами, %': pct(sum(1 for r in ground if not r['open']), len(ground)),
     'с прострелом: закрыто стоя, %': pct(sum(1 for r in pen if not r['strict']), len(pen)),
     'с прострелом: закрыто всеми лучами, %': pct(sum(1 for r in pen if not r['open']), len(pen)),
     'обратная: смотрели друг на друга, пар': sum(1 for n in neg if n[0]),
     'обратная: смотрели — геометрия «видно», %': pct(sum(1 for n in neg if n[0] and n[1]), sum(1 for n in neg if n[0])),
     'обратная: не смотрели (выборка) — «видно», %': pct(sum(1 for n in neg if not n[0] and n[1]), sum(1 for n in neg if not n[0]))}
# что закрывает: первый предмет и «единственный предмет» на луче
closed = [r for r in base if not r['open']]
first = collections.Counter(r['blk'][0][0] for r in closed if r['blk'])
only = collections.Counter(r['blk'][0][0] for r in closed if len(r['blk']) == 1)
S['закрыто: первый предмет на луче (топ)'] = first.most_common(25)
S['закрыто: единственный предмет на луче (топ)'] = only.most_common(25)
# свойства предметов
def info(e):
    if e[0] == 'm':
        ti = np.where(tri_comp == int(e[1:]))[0]; P = W.z['mesh_v'][W.z['mesh_t'][ti]].reshape(-1, 3)
        nrm = np.cross(W.E1[ti], W.E2[ti]); area = 0.5 * np.linalg.norm(nrm, axis=1)
        vert = float((np.abs(nrm[:, 2]) / np.maximum(1e-9, 2 * area) < 0.3).mean())
        return {'вид': 'сетка', 'mesh': int(np.bincount(W.mesh_id[ti]).argmax()), 'треуг': int(len(ti)), 'площадь': round(float(area.sum())),
                'доля вертикальных': round(vert, 2), 'lo': P.min(0).round().tolist(), 'hi': P.max(0).round().tolist()}
    k = int(e[1:]); return {'вид': 'блок', 'вершин': int(W.z['hull_vn'][k]), 'lo': W.hlo[k].round().tolist(), 'hi': W.hhi[k].round().tolist()}
S['предметы'] = {e: info(e) for e, _ in (first + only).most_common(40)}
S['мест закрыто (убийца или жертва)'] = collections.Counter(place(*(K[r['i']][3:5])) for r in closed).most_common(15)
json.dump({'S': S, 'kills': res, 'neg_n': len(neg)}, open(os.path.join(OUT, f'{MAP}_los.json'), 'w'), ensure_ascii=False)
print(json.dumps({k: v for k, v in S.items() if k != 'предметы'}, ensure_ascii=False, indent=1)[:4000])
print('time', round(time.time() - t0), 's')
