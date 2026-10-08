#!/usr/bin/env python3
"""Позиции и Setup'ы для Ancient из демок про → src/data/positions.json, src/data/setups.json.

python3 tools/positions_bake.py [--report]

Этап 2, пункт 1 (docs/BRAIN.md, разделы 4 и 5). Данные, а не формула: всё
выводится из того, где про реально стояли и что делали. Повторяемо — один и
тот же вход (data/demos/*, src/data/*.json) даёт те же файлы.

Что считает:
  * раунды — tools/ancient_demos.py (один rid на всех: позиции и гранаты);
  * стоянка — игрок жив, раунд до планта, скорость < 10 ед. карты/с
    (≈ 25 ед. игры/с, то есть стоит или шевелится на месте) не меньше 2 с подряд.
    Из стоянки: точка (среднее), взгляд (средний yaw), время в раунде;
  * точка (positions.json → points) — группа стоянок одной стороны: от самой
    «густой» стоянки берутся все в пределах CL_DIAM/2 и CL_YAW/2 (диаметр точки
    ≤ CL_DIAM, разброс взгляда ≤ CL_YAW). Потом похожие соседние точки
    склеиваются: крупная забирает мелкие, если центры ближе MERGE_D и взгляд
    отличается меньше MERGE_YAW. Точка остаётся, если встретилась не реже чем в
    MIN_SHARE раундов. area — зона-колл из zonemap.json; angle — куда смотрит:
    луч от точки по среднему взгляду до первой стены, зона-колл в конце луча и
    сама точка конца;
  * standard / off — standard: точка не реже STD_SHARE от самой частой в своей
    area и не реже STD_MIN_SHARE раундов; остальные — off (там тоже стоят, но
    редко — неожиданная позиция). Все пороги — доли раундов, не числа: от
    количества демок не зависят;
  * peek — стоит вплотную за укрытием (луч взгляда < 40): угол — ближайшее к
    взгляду открытое направление ±10–40° (держит из-за края укрытия);
  * crouch — в выгрузке демок нет флага присяда, поэтому false (не измерено);
  * fallback — запасная точка (BRAIN 4.4): ближайшая другая точка той же
    стороны, которая смотрит на тот же вход (та же angle-зона), не дальше
    FALLBACK_MAX; нет такой — null;
  * кроссфайр-пары (BRAIN 4.2) — две CT-точки одной стороны карты, лучи
    взгляда которых сходятся на одном входе с разных сторон (между взглядами
    ≥ 30°), на дистанции размена (≤ TRADE_DIST). rounds — сколько раундов про
    так стояли вдвоём (подтверждение, не фильтр).
CT Setup'ы (BRAIN 4.1, 5.3): раскладка «сколько CT на A / миде / B» по раундам,
до 4 самых частых; слоты — самые занятые точки раскладки, второй на стороне —
кроссфайр-напарник первого. T execute (BRAIN 5.1): раунды с плантом по сайту и
маршруту. Шаг сценария — ЦЕЛЬ гранаты (что она выключает у CT), а не точка:
  * смок — закрыть взгляд: area, где чаще всего стоят CT, чей луч взгляда
    проходит через облако (ближе SMOKE_R к месту разрыва), + зона облака;
  * флешка — ослепить: area, где чаще всего стоят CT, которые видят место
    разрыва (без высоких стен между, ближе FLASH_R);
  * молотов / HE — выжечь: area, где чаще всего стоят CT ближе BURN_R;
  * никого из CT не задевает — цель = зона падения.
«Где стоят CT» — все стоянки CT до планта (не только точки positions.json).
Цель — зона-колл, а не точка, поэтому разные лайнапы на одну и ту же задачу
попадают в один шаг; ways — способы (откуда → куда, сколько бросков).
Гранаты «себе» (data/pro/pro_nades.csv, purpose — см. tools/lineups.py) в шаги
не идут. Люркер — по всем раундам с плантом варианта.
"""
import glob, gzip, json, math, os, sys
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from heights_bake import point_in, centroid, seg_x  # noqa: E402
from ancient_demos import ROOT, TICK, tr, demo_names, rounds_of, ticks_of, round_index  # noqa: E402

DATA = os.path.join(ROOT, 'src', 'data')
OUT_POS = os.path.join(DATA, 'positions.json')
OUT_SET = os.path.join(DATA, 'setups.json')

STILL_SPEED = 10        # ед. карты/с: ниже — «стоит»
STILL_MIN = 2.0         # с подряд, чтобы считать стоянкой
CL_DIAM = 40            # ед. карты (≈ 100 ед. игры): все стоянки точки ближе этого
CL_YAW = 60             # градусов: и взгляд у всех в пределах этого
MERGE_D = 25            # ед. карты: соседние точки ближе этого и
MERGE_YAW = 30          # с взглядом в пределах этого — одна точка
MIN_SHARE = 0.022       # точка — если встретилась хотя бы в 2,2 % раундов (было 6 из 269)
STD_SHARE = 0.35        # standard, если не реже 35 % самой частой точки в area
STD_MIN_SHARE = 0.025   # и хотя бы в 2,5 % раундов: реже — off
RAY_MAX = 900           # ед. карты: дальше луч взгляда не ведём
FALLBACK_MAX = 160      # ед. карты: запасная точка не дальше
TRADE_DIST = 260        # ед. карты ≈ 650 ед. игры: размен успевает
PAIR_MIN_ANGLE = 30     # градусов между взглядами пары
PAIR_AIM_GAP = 60       # ед. карты: лучи взгляда пары сходятся (пересекаются или ближе этого)
START_WAIT = 12         # с: T у своего спавна раньше этого — ждут на старте, не позиция
AIM_MIN = 40            # ед. карты: луч взгляда короче — смотрит в укрытие вплотную
PEEK_MIN = 80           # ед. карты: открытое направление у края укрытия — хотя бы такое
LAYOUT_SEC = 20         # с: на этой секунде — раскладка CT, если игрок ни разу не стоял
LAYOUT_WIN = (8, 50)    # с: окно, где смотрим, на какой стороне CT стоял дольше всего
SETUP_WIN = (5, 45)     # с: окно, в котором точка «занята» в сетапе
SETUP_MIN_SHARE = 0.07  # раскладка в Setup — если не реже 7 % раундов
EXEC_LOOK = 12          # с до планта: где T (маршрут execute)
EXEC_WIN = 25           # с до планта: гранаты execute
EXEC_MIN_SHARE = 0.05   # вариант execute — хотя бы 5 % раундов с плантом (было 8 из 156)
STEP_MIN_SHARE = 0.15   # цель — шаг сценария, если её закрывают хотя бы в 15 % раундов варианта
STEP_MAX = 6            # и не больше 6 целей на сценарий (самые частые)
SMOKE_R = 58            # ед. карты ≈ 144 ед. игры — радиус облака смока
FLASH_R = 350           # ед. карты: флешка слепит CT-точку, если видна и ближе этого
BURN_R = 60             # ед. карты: молотов/HE выжигает CT-точку ближе этого
TGT_CELL, TGT_YAW = 16, 30  # клетка стоянок CT для целей: ед. карты и градусы взгляда
WAY_FROM, WAY_TO = 70, 60  # ед. карты: бросок того же способа — откуда/куда ближе этого
SNAP = 32               # тиков: снимок «где игрок в момент t» — ближайший тик не дальше этого
ENTRY_R = 100           # ед. карты: T «зашёл на сайт» — ближе этого к центру мест планта
LURK_MIN_SHARE = 0.1    # люркер (необязательный шаг) — если в 10 %+ раундов варианта кто-то на другой стороне


# ---------------- карта: зоны-коллы и стены ----------------
ZM = json.load(open(os.path.join(DATA, 'zonemap.json'), encoding='utf-8'))
ZN = json.load(open(os.path.join(DATA, 'zone_names.json'), encoding='utf-8'))
ZONES = [{'id': q['id'], 'z': q['z'], 'P': [(p['x'], p['y']) for p in q['points']]} for q in ZM['zones']]
for q in ZONES:
    q['c'] = centroid(q['P'])
    q['name'] = ZN.get(q['id'])
WALLS = [[tuple(p) for p in W] for W in json.load(open(os.path.join(DATA, 'walls.json'), encoding='utf-8'))]
# луч взгляда режут только стены выше пояса: низкие ящики (cover.json, cat low/chest)
# стоя простреливаются взглядом
_COV = json.load(open(os.path.join(DATA, 'cover.json'), encoding='utf-8'))['items']
LOW_WALLS = {i['wall'] for i in _COV if i['shape'] == 'wall' and i['cat'] in ('low', 'chest')}
WSEGS = [(W[i], W[(i + 1) % len(W)]) for k, W in enumerate(WALLS) if k not in LOW_WALLS for i in range(len(W))]

# сторона карты. Названия зон в zonemap свои (например, «Rat» и «T Lower» —
# у B), поэтому сторона — по координате точки, а не по названию: левее x=700 —
# A, правее x=1250 — B, между — мид; спавны и задние проходы CT — отдельно.
BACK = {'CT Spawn', 'CT Lane', 'Alley', 'Back Halls / Back Alley'}
TSIDE = {'T Spawn', 'T Ramp'}


def region_of(x, y, name):
    if name in BACK:
        return 'back'
    if name in TSIDE:
        return 'Tside'
    return 'A' if x < 700 else 'B' if x > 1250 else 'mid'


_ZC = {}


def zone_at(x, y, z=None):
    """то же, что _zone_at, с кэшем по клетке 2×2 ед. карты"""
    k = (int(x // 2), int(y // 2), None if z is None else z > 100)
    if k not in _ZC:
        _ZC[k] = _zone_at(x, y, z)
    return _ZC[k]


def _zone_at(x, y, z=None):
    """зона-колл точки; верхний уровень (z=1 в zonemap) — если игрок выше 100 ед. игры"""
    hit = [q for q in ZONES if point_in(q['P'], x, y)]
    if hit:
        if len(hit) > 1 and z is not None:
            hit.sort(key=lambda q: -q['z'] if z > 100 else q['z'])
        named = [q for q in hit if q['name']]
        if named:
            return named[0]
    named = [q for q in ZONES if q['name']]   # зона без названия — ближайшая с названием
    return min(named, key=lambda q: math.hypot(q['c'][0] - x, q['c'][1] - y))


# пол навмеша сеткой (как VIS.floor в 10_vision.js): клетка без навмеша — сплошная.
# Хранится самый НИЖНИЙ пол клетки: где уровни друг над другом (мост над сайтом),
# взгляд снизу идёт под верхним уровнем, а не упирается в него
CELL = 4
_FLOOR = None


def floor_grid():
    global _FLOOR
    if _FLOOR is None:
        from matplotlib.path import Path
        n = 2048 // CELL
        F = np.full((n, n), np.inf)
        cx = (np.arange(n) + 0.5) * CELL
        for a in json.load(open(os.path.join(DATA, 'navmesh.json'), encoding='utf-8')):
            P = np.array([(p['x'], p['y']) for p in a['points']])
            i0, i1 = max(0, int(P[:, 0].min() // CELL)), min(n - 1, int(P[:, 0].max() // CELL))
            j0, j1 = max(0, int(P[:, 1].min() // CELL)), min(n - 1, int(P[:, 1].max() // CELL))
            gx, gy = np.meshgrid(cx[i0:i1 + 1], cx[j0:j1 + 1])
            m = Path(P).contains_points(np.c_[gx.ravel(), gy.ravel()]).reshape(gx.shape)
            sub = F[j0:j1 + 1, i0:i1 + 1]
            sub[m] = np.minimum(sub[m], a['z'])
        # участки навмеша не стыкуются до пикселя, а игроки стоят у самых краёв —
        # пустые клетки до 2 клеток (8 ед. карты) от пола берут пол соседа
        for _ in range(2):
            G = np.pad(F, 1, constant_values=np.inf)
            nb = np.min([G[1 + dj:G.shape[0] - 1 + dj, 1 + di:G.shape[1] - 1 + di]
                         for dj in (-1, 0, 1) for di in (-1, 0, 1)], axis=0)
            F = np.where(np.isfinite(F), F, nb)
        _FLOOR = F
    return _FLOOR


def floor_at(x, y):
    """самый нижний пол клетки, inf — пола нет"""
    F = floor_grid()
    i, j = int(x // CELL), int(y // CELL)
    if not (0 <= i < F.shape[1] and 0 <= j < F.shape[0]):
        return np.inf
    return F[j, i]


def ray_end(x, y, yaw_deg, z=None):
    """луч взгляда (yaw игры: 0 = +X, против часовой; на карте y вниз) до того, что
    закрывает взгляд в игре: высокая стена, клетка без пола (вне навмеша) или пол
    выше глаз (z игрока + 64)"""
    a = math.radians(yaw_deg)
    dx, dy = math.cos(a), -math.sin(a)
    best = RAY_MAX
    eye = (z if z is not None else floor_at(x, y)) + 64
    F = floor_grid()
    miss = 0
    for k in range(2, int(RAY_MAX / 2)):
        t = k * 2
        i, j = int((x + dx * t) // CELL), int((y + dy * t) // CELL)
        if not (0 <= i < F.shape[1] and 0 <= j < F.shape[0]):
            best = t; break
        f = F[j, i]
        if f > eye:                # нет пола (inf) или даже нижний пол выше глаз
            miss += 1
            if miss >= 3:          # щели навмеша в 1–2 клетки не считаем стеной
                best = t - 4; break
        else:
            miss = 0
    x1, y1 = x + dx * best, y + dy * best
    for p, q in WSEGS:
        if not seg_x((x, y), (x1, y1), p, q):
            continue
        # точка пересечения
        ex, ey = q[0] - p[0], q[1] - p[1]
        den = dx * ey - dy * ex
        if abs(den) < 1e-9:
            continue
        t = ((p[0] - x) * ey - (p[1] - y) * ex) / den
        if 0 < t < best:
            best = t
    return x + dx * best, y + dy * best, best


def circ_mean(deg):
    r = np.radians(deg)
    return math.degrees(math.atan2(np.sin(r).mean(), np.cos(r).mean())) % 360


def ang_diff(a, b):
    return abs((a - b + 180) % 360 - 180)


# ---------------- демки → раунды → стоянки ----------------
def snap(rows, tk, side):
    """где игроки стороны в момент tk: [(sid, x, y, z)] — ближайший тик каждого не дальше SNAP"""
    tick, sid, sd, x, y, z = rows
    m = (sd == side) & (np.abs(tick - tk) <= SNAP)
    out = {}
    for i in np.nonzero(m)[0]:
        k = int(sid[i])
        if k not in out or abs(tick[i] - tk) < abs(tick[out[k]] - tk):
            out[k] = i
    return [(k, float(x[i]), float(y[i]), float(z[i])) for k, i in sorted(out.items())]


def holds_vec(tick, sid, x, y, z, yaw, ri, rounds):
    """стоянки по всем раундам демки сразу (строки отсортированы по раунду, игроку, тику):
    [{rid, sid, side, x, y, z, yaw, s0, s1}] (s — секунды от freeze_end)"""
    n = len(tick)
    if n < 2:
        return []
    new = np.ones(n, bool)
    new[1:] = (ri[1:] != ri[:-1]) | (sid[1:] != sid[:-1])
    dt = np.zeros(n); dt[1:] = np.diff(tick) / TICK
    sp = np.full(n, np.inf)
    sp[1:] = np.hypot(np.diff(x), np.diff(y)) / np.where(dt[1:] > 0, dt[1:], 1)
    still = ~new & (sp < STILL_SPEED) & (dt > 0) & (dt < 1)
    prev = np.r_[False, still[:-1]]; nxt = np.r_[still[1:], False]
    starts = np.nonzero(still & ~prev)[0]; ends = np.nonzero(still & ~nxt)[0]
    a = starts - 1
    ok = (tick[ends] - tick[a]) / TICK >= STILL_MIN
    yr = np.radians(yaw.astype(float))
    C = {k: np.r_[0, np.cumsum(v)] for k, v in (('x', x.astype(float)), ('y', y.astype(float)), ('z', z.astype(float)),
                                                  ('s', np.sin(yr)), ('c', np.cos(yr)))}
    out = []
    for i, j in zip(a[ok], ends[ok]):
        L = j - i + 1
        mean = {k: (v[j + 1] - v[i]) / L for k, v in C.items()}
        r = rounds[ri[i]]
        out.append({'rid': r['rid'], 'sid': int(sid[i]), 'side': None, 'x': mean['x'], 'y': mean['y'], 'z': mean['z'],
                    'yaw': math.degrees(math.atan2(mean['s'], mean['c'])) % 360,
                    's0': (tick[i] - r['t0']) / TICK, 's1': (tick[j] - r['t0']) / TICK})
    return out


def load_rounds():
    """раунды всех демок и стоянки. Тики целиком не храним — только то, что нужно
    дальше: снимки «где CT на 20-й с», «где T за EXEC_LOOK с до планта и в плант»,
    путь T за 40 с до планта (вход на сайт)"""
    R, H = [], []
    for demo in demo_names():
        rounds = rounds_of(demo)
        if not rounds:
            continue
        t = ticks_of(demo)
        ri = round_index(rounds, t.tick.values)
        cut = np.array([r['tplant'] or r['t1'] for r in rounds])
        keep = (ri >= 0) & (t.tick.values < cut[np.clip(ri, 0, None)])
        t = t[keep].assign(ri=ri[keep]).sort_values(['ri', 'steamid', 'tick'], kind='stable')
        tick, sid, sd = t.tick.values, t.steamid.values, t.side.values
        x, y, z, yaw, rv = t.x.values, t.y.values, t.Z.values, t.yaw.values, t.ri.values
        side_of = dict(zip(sid, sd))
        hs = holds_vec(tick, sid, x, y, z, yaw, rv, rounds)
        for h in hs:
            h['side'] = side_of[h['sid']]
        H += hs
        bounds = np.searchsorted(rv, np.arange(len(rounds) + 1))
        for k, r in enumerate(rounds):
            sl = slice(bounds[k], bounds[k + 1])
            if bounds[k + 1] == bounds[k]:
                continue
            rows = (tick[sl], sid[sl], sd[sl], x[sl], y[sl], z[sl])
            r['ct20'] = snap(rows, r['t0'] + LAYOUT_SEC * TICK, 'CT')
            if r['tplant']:
                r['tlook'] = snap(rows, r['tplant'] - EXEC_LOOK * TICK, 'T')
                r['tplant_at'] = snap(rows, r['tplant'] - 1, 'T')
                m = (sd[sl] == 'T') & (tick[sl] >= r['tplant'] - 40 * TICK)
                r['ttrack'] = (tick[sl][m], x[sl][m], y[sl][m])
            R.append(r)
    return R, H


def cluster_holds(H):
    """точки без «расползания»: от самой густой стоянки — все в пределах CL_DIAM/2
    по месту и CL_YAW/2 по взгляду (диаметр ≤ CL_DIAM, разброс взгляда ≤ CL_YAW),
    потом следующая густая из оставшихся. Затем склейка похожих соседей: крупная
    точка забирает более мелкие, центр которых ближе MERGE_D и взгляд — в MERGE_YAW"""
    from scipy.spatial import cKDTree
    if not H:
        return []
    k = 1 / (2 * math.sin(math.radians(CL_YAW / 4)))   # хорда CL_YAW/2 → 1
    Y = np.radians([h['yaw'] for h in H])
    F = np.c_[np.array([h['x'] for h in H]) / (CL_DIAM / 2), np.array([h['y'] for h in H]) / (CL_DIAM / 2),
              np.cos(Y) * k, np.sin(Y) * k]
    tree = cKDTree(F)
    cnt = tree.query_ball_point(F, 1.0, return_length=True)
    free = np.ones(len(H), bool)
    groups = []
    for i in np.argsort(-cnt, kind='stable'):
        if not free[i]:
            continue
        nb = [j for j in tree.query_ball_point(F[i], 1.0) if free[j]]
        free[nb] = False
        groups.append(nb)
    # склейка соседей (без цепочек: забирает только исходный центр крупной)
    groups.sort(key=lambda g: -len(g))
    cen = [(np.mean(F[g, 0]) * CL_DIAM / 2, np.mean(F[g, 1]) * CL_DIAM / 2,
            circ_mean(np.array([H[j]['yaw'] for j in g]))) for g in groups]
    gone = [False] * len(groups)
    global MERGED
    ctree = cKDTree(np.array([(c[0], c[1]) for c in cen]))
    for a in range(len(groups)):
        if gone[a]:
            continue
        for b in sorted(ctree.query_ball_point(cen[a][:2], MERGE_D)):
            if b > a and not gone[b] and ang_diff(cen[a][2], cen[b][2]) < MERGE_YAW:
                groups[a] = groups[a] + groups[b]
                gone[b] = True
                MERGED += 1
    return [[H[j] for j in g] for g, x in zip(groups, gone) if not x]


MERGED = 0
NR = 0   # раундов всего — от него пороги-доли


def make_points(H, side):
    """кластеры стоянок одной стороны → сырые точки (ещё без id и типа)"""
    pts = []
    for g in cluster_holds([h for h in H if h['side'] == side]):
        rids = {h['rid'] for h in g}
        if len(rids) < MIN_SHARE * NR:
            continue
        x = float(np.mean([h['x'] for h in g])); y = float(np.mean([h['y'] for h in g]))
        z = float(np.median([h['z'] for h in g]))
        yaw = circ_mean(np.array([h['yaw'] for h in g]))
        zq = zone_at(x, y, z)
        if zq['name'] in ('T Spawn', 'CT Spawn'):
            continue   # на самом спавне — это не позиция
        ex, ey, dist = ray_end(x, y, yaw, z)
        peek = False
        if dist < AIM_MIN:
            # стоит вплотную за укрытием: держит угол из-за его края — берём ближайшее
            # к взгляду открытое направление; нет такого — ждёт, а не держит угол
            for dy in (10, -10, 20, -20, 30, -30, 40, -40):
                ex2, ey2, d2 = ray_end(x, y, yaw + dy, z)
                if d2 >= PEEK_MIN:
                    yaw, ex, ey, dist, peek = (yaw + dy) % 360, ex2, ey2, d2, True
                    break
            else:
                continue
        sec = float(np.median([h['s0'] for h in g]))
        if region_of(x, y, zq['name']) == 'Tside' and sec < START_WAIT:
            continue   # T у спавна в первые секунды — ждут команду, а не держат позицию
        aq = zone_at(ex - math.cos(math.radians(yaw)) * 6, ey + math.sin(math.radians(yaw)) * 6)
        pts.append({'side': side, 'x': x, 'y': y, 'z': z, 'yaw': yaw, 'peek': peek, 'zone': zq, 'aim': (ex, ey), 'aimDist': dist,
                    'aimZone': aq, 'rounds': rids, 'holds': g, 'region': region_of(x, y, zq['name']),
                    'sec': sec,
                    'dur': float(np.median([h['s1'] - h['s0'] for h in g]))})
    return pts


def slug(name):
    s = name.split(' / ')[0].lower()
    return ''.join(c if c.isalnum() else '_' for c in s).strip('_')


def finalize_points(P):
    """id, standard/off, запасная точка"""
    byarea = defaultdict(list)
    for p in P:
        byarea[(p['side'], p['zone']['name'])].append(p)
    for (side, area), ps in sorted(byarea.items()):
        ps.sort(key=lambda p: (-len(p['rounds']), p['x'], p['y']))
        top = len(ps[0]['rounds'])
        for k, p in enumerate(ps):
            p['id'] = '%s_%s_%d' % (side.lower(), slug(area), k + 1)
            n = len(p['rounds'])
            p['type'] = 'standard' if n >= STD_SHARE * top and n >= STD_MIN_SHARE * NR else 'off'
    for p in P:
        best, bd = None, FALLBACK_MAX
        for q in P:
            if q is p or q['side'] != p['side']:
                continue
            d = math.hypot(q['x'] - p['x'], q['y'] - p['y'])
            same = q['aimZone']['id'] == p['aimZone']['id'] or \
                math.hypot(q['aim'][0] - p['aim'][0], q['aim'][1] - p['aim'][1]) < 100
            if same and CL_DIAM / 2 < d < bd:
                best, bd = q, d
        p['fallback'] = best['id'] if best else None
    return P


def seg_dist(a, b, c, d):
    """минимальное расстояние между отрезками ab и cd"""
    if seg_x(a, b, c, d):
        return 0.0

    def pd(p, q, r):
        vx, vy = r[0] - q[0], r[1] - q[1]
        L = vx * vx + vy * vy
        t = 0 if L == 0 else max(0, min(1, ((p[0] - q[0]) * vx + (p[1] - q[1]) * vy) / L))
        return math.hypot(p[0] - q[0] - t * vx, p[1] - q[1] - t * vy)
    return min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b))


def overlap(h, k):
    """два разных игрока держали точки в одном раунде, оба — в окне сетапа
    (стоянки у про короткие, 2–5 с, точное совпадение по времени слишком редкое)"""
    return h['sid'] != k['sid'] and all(SETUP_WIN[0] < x['s0'] < SETUP_WIN[1] + 15 for x in (h, k))


def make_pairs(P):
    """кроссфайр (BRAIN 4.2): две точки одной стороны карты, лучи взгляда которых
    сходятся на одном входе с разных сторон (между взглядами ≥ PAIR_MIN_ANGLE),
    на дистанции размена. Сами точки — из демок про; что именно эти две стояли
    вдвоём в одном раунде — в 14 демках встречается редко (точки дробятся), поэтому
    это не фильтр, а подтверждение: rounds — сколько раундов так стояли вдвоём"""
    pairs = []
    for i, p in enumerate(P):
        for q in P[i + 1:]:
            if p['side'] != q['side'] or p['region'] != q['region']:
                continue
            d = math.hypot(p['x'] - q['x'], p['y'] - q['y'])
            if not (CL_DIAM < d <= TRADE_DIST) or ang_diff(p['yaw'], q['yaw']) < PAIR_MIN_ANGLE:
                continue
            if seg_dist((p['x'], p['y']), p['aim'], (q['x'], q['y']), q['aim']) > PAIR_AIM_GAP:
                continue
            hq = defaultdict(list)
            for k in q['holds']:
                hq[k['rid']].append(k)
            together = {h['rid'] for h in p['holds'] if any(overlap(h, k) for k in hq.get(h['rid'], []))}
            # вход, который держат вдвоём: зона ближе к концам обоих лучей
            mx, my = (p['aim'][0] + q['aim'][0]) / 2, (p['aim'][1] + q['aim'][1]) / 2
            pairs.append({'a': p['id'], 'b': q['id'], 'entrance': zone_at(mx, my)['name'],
                          'dist': round(d), 'rounds': len(together),
                          'weight': min(len(p['rounds']), len(q['rounds']))})
    pairs.sort(key=lambda r: (-r['rounds'], -r['weight'], r['a'], r['b']))
    return pairs


# ---------------- CT Setup'ы: раскладка «сколько где» ----------------
SITE_C = {}   # центр сайта — среднее мест планта


def ct_layout(r, holds):
    """сторона карты каждого CT: где он дольше всего стоял в окне сетапа (не где
    шёл в моменте — на 15–20 с часть CT ещё идёт со спавна через середину карты).
    Не стоял ни разу — где был на LAYOUT_SEC-й секунде"""
    w = defaultdict(Counter)
    for h in holds:
        if h['side'] == 'CT' and LAYOUT_WIN[0] <= h['s0'] <= LAYOUT_WIN[1]:
            reg = region_of(h['x'], h['y'], zone_at(h['x'], h['y'], h['z'])['name'])
            w[h['sid']]['mid' if reg in ('back', 'Tside') else reg] += h['s1'] - h['s0']
    out = {}
    for sid, x, y, z in r['ct20']:
        if w[sid]:
            out[sid] = w[sid].most_common(1)[0][0]
        else:
            reg = region_of(x, y, zone_at(x, y, z)['name'])
            out[sid] = 'mid' if reg in ('back', 'Tside') else reg
    return out


ROLE_NAMES = {'A': ['anchor_A', 'support_A', 'stack_A'], 'B': ['anchor_B', 'support_B', 'stack_B'],
              'mid': ['mid_control', 'mid_support', 'mid_extra']}


def make_ct_setups(R, H, P):
    ct = [p for p in P if p['side'] == 'CT']
    pair_of = defaultdict(set)
    for pr in PAIRS:
        pair_of[pr['a']].add(pr['b']); pair_of[pr['b']].add(pr['a'])
    hr = defaultdict(list)
    for h in H:
        hr[h['rid']].append(h)
    lay = {}
    for r in R:
        L = ct_layout(r, hr[r['rid']])
        if len(L) == 5:
            c = Counter(L.values())
            lay[r['rid']] = (c['A'], c['mid'], c['B'])
    cnt = Counter(lay.values())
    total = len(lay)
    setups = []
    for (nA, nM, nB), n in cnt.most_common():
        if len(setups) >= 4 or n < SETUP_MIN_SHARE * total:
            break
        rids = {rid for rid, k in lay.items() if k == (nA, nM, nB)}
        # сколько раундов этой раскладки каждая точка была занята в окне сетапа
        used = {p['id']: len({h['rid'] for h in p['holds'] if h['rid'] in rids
                              and h['s0'] < SETUP_WIN[1] and h['s1'] > SETUP_WIN[0]}) for p in ct}
        slots = []
        for reg, k in (('A', nA), ('mid', nM), ('B', nB)):
            # кандидаты: точки этой стороны, сначала занятые в раундах этой раскладки,
            # потом вообще частые (если в раскладке данных на все слоты не хватило)
            cand = sorted([p for p in ct if p['region'] == reg],
                          key=lambda p: (-used[p['id']], -len(p['rounds']), p['id']))
            chosen = []
            for p in cand:
                if len(chosen) >= k:
                    break
                if any(math.hypot(p['x'] - c['x'], p['y'] - c['y']) < CL_DIAM for c in chosen):
                    continue
                chosen.append(p)
                # второй — напарник по кроссфайру первого, если он здесь стоит не реже 30 %
                if len(chosen) == 1 and k >= 2:
                    mates = [q for q in cand if q['id'] in pair_of[p['id']] and used[q['id']] >= 0.3 * used[p['id']]]
                    if mates:
                        chosen.append(mates[0])
            # якорь — тот, кто ближе к сайту (на миде — к центру мида)
            ctr = SITE_C.get(reg, (990, 900))
            chosen.sort(key=lambda p: math.hypot(p['x'] - ctr[0], p['y'] - ctr[1]))
            roles = ROLE_NAMES[reg]
            for i, p in enumerate(chosen):
                alts = [{'id': q['id'], 'type': q['type'], 'n': used[q['id']]} for q in cand
                        if q not in chosen][:4]
                slots.append({'role': roles[min(i, 2)], 'region': reg, 'point': p['id'], 'area': p['zone']['name'],
                              'angle': p['aimZone']['name'], 'prefer': p['type'], 'n': used[p['id']],
                              'alternatives': alts, 'pairWith': None})
            reg_slots = [s for s in slots if s['region'] == reg]
            for s in reg_slots:
                for o in reg_slots:
                    if o is not s and o['point'] in pair_of[s['point']]:
                        s['pairWith'] = o['role']
        name = 'default' if (nA, nM, nB) == (2, 1, 2) else \
            'stack_A' if nA >= 3 else 'stack_B' if nB >= 3 else 'mid_heavy' if nM >= 2 else 'other'
        setups.append({'id': 'ct_%s_%d%d%d_ancient' % (name, nA, nM, nB), 'name': name, 'side': 'CT', 'split': {'A': nA, 'mid': nM, 'B': nB},
                       'rounds': n, 'share': round(n / total, 2), 'slots': slots})
    return setups, total


# ---------------- T execute: маршрут входа + гранаты по цели ----------------
def t_route(r):
    """где T за EXEC_LOOK с до планта: сколько на стороне сайта, сколько на миде"""
    regs = [region_of(x, y, zone_at(x, y, z)['name']) for _, x, y, z in r['tlook']]
    return 'split' if 'mid' in regs and r['site'] in regs else \
        'mid' if all(g in ('mid', 'Tside') for g in regs) else 'main'


def lurk_zones(r):
    """люркер: кто-то из T на другой стороне карты за EXEC_LOOK с до планта или в
    момент планта — зоны, где он был (пусто — люркера не было)"""
    other = 'B' if r['site'] == 'A' else 'A'
    out = []
    for _, x, y, z in r['tlook'] + r['tplant_at']:
        q = zone_at(x, y, z)
        if region_of(x, y, q['name']) == other:
            out.append(q['name'])
    return out


def entry_sec_to_plant(r):
    """за сколько секунд до планта первый T оказался в радиусе ENTRY_R от сайта"""
    tk, x, y = r['ttrack']
    cx, cy = SITE_C[r['site']]
    m = np.hypot(x - cx, y - cy) < ENTRY_R
    return (r['tplant'] - tk[m].min()) / TICK if m.any() else None


_WS = None


def visible_from(a, B):
    """для точек B — видно ли их из a (отрезок не режет высокую стену)"""
    global _WS
    if _WS is None:
        _WS = np.array(WSEGS, float)
    P, Q = _WS[:, 0][None], _WS[:, 1][None]
    A = np.array(a, float)[None, None]
    Bv = np.asarray(B, float)[:, None]

    def o(p, q, r):
        return (q[..., 0] - p[..., 0]) * (r[..., 1] - p[..., 1]) - (q[..., 1] - p[..., 1]) * (r[..., 0] - p[..., 0])
    hit = ((o(A, Bv, P) > 0) != (o(A, Bv, Q) > 0)) & ((o(P, Q, A) > 0) != (o(P, Q, Bv) > 0))
    return ~hit.any(axis=1)


TYPE_RU = {'smoke': 'смок', 'flash': 'флешка', 'molly': 'молотов', 'he': 'HE'}


class Targets:
    """цель гранаты — что она выключает у CT (см. начало файла). Считается не по
    точкам positions.json (их мало, редкие места туда не попадают), а по всем
    стоянкам CT до планта, собранным в клетки TGT_CELL × TGT_CELL и по взгляду
    (TGT_YAW°): вес клетки — сколько там стояли"""

    def __init__(self, H):
        cells = defaultdict(list)
        for h in H:
            if h['side'] == 'CT':
                cells[(int(h['x'] // TGT_CELL), int(h['y'] // TGT_CELL), int(h['yaw'] // TGT_YAW))].append(h)
        self.c = []
        for g in cells.values():
            x = float(np.mean([h['x'] for h in g])); y = float(np.mean([h['y'] for h in g]))
            z = float(np.median([h['z'] for h in g])); yaw = circ_mean(np.array([h['yaw'] for h in g]))
            ex, ey, _ = ray_end(x, y, yaw, z)
            aq = zone_at(ex - math.cos(math.radians(yaw)) * 6, ey + math.sin(math.radians(yaw)) * 6)
            self.c.append({'x': x, 'y': y, 'aim': (ex, ey), 'n': len(g), 'area': zone_at(x, y, z)['name'], 'aimZone': aq['name']})
        self.xy = np.array([(c['x'], c['y']) for c in self.c])
        self.aim = np.array([c['aim'] for c in self.c])
        self.w = np.array([c['n'] for c in self.c], float)

    def of(self, typ, lx, ly):
        L = np.array([lx, ly])
        if typ == 'smoke':
            v = self.aim - self.xy
            t = np.clip(((L - self.xy) * v).sum(1) / np.maximum((v * v).sum(1), 1e-9), 0, 1)
            hit = np.hypot(*(self.xy + v * t[:, None] - L).T) < SMOKE_R
            zn = zone_at(lx, ly)['name']
            if hit.any():
                k = Counter()
                for i in np.nonzero(hit)[0]:
                    k[self.c[i]['area']] += self.w[i]
                area = max(k.items(), key=lambda kv: (kv[1], kv[0]))[0]
                return 'smoke:%s>%s' % (area, zn), ('закрыть взгляд из %s (смок в %s)' % (area, zn) if area != zn
                                                    else 'закрыть CT в %s' % zn)
            return 'smoke:zone:%s' % zn, 'смок в %s' % zn
        if typ == 'flash':
            near = np.nonzero(np.hypot(*(self.xy - L).T) < FLASH_R)[0]
            hit = near[visible_from(L, self.xy[near])] if len(near) else near
        else:
            hit = np.nonzero(np.hypot(*(self.xy - L).T) < BURN_R)[0]
        k = Counter()
        for i in hit:
            k[self.c[i]['area']] += self.w[i]
        area = max(k.items(), key=lambda kv: (kv[1], kv[0]))[0] if k else zone_at(lx, ly)['name']
        verb = {'flash': 'ослепить', 'molly': 'выжечь', 'he': 'HE по'}[typ]
        return '%s:%s' % (typ, area), '%s %s' % (verb, area)


def ways_of(ns):
    """способы одной цели: броски, у которых и «откуда», и «куда» рядом (как tools/cluster.py)"""
    F = np.array([(n.fx, n.fy, n.lx, n.ly) for n in ns])
    left = np.ones(len(F), bool)
    out = []
    while left.any():
        idx = np.nonzero(left)[0]
        best = None
        for i in idx:
            nb = idx[(np.hypot(F[idx, 0] - F[i, 0], F[idx, 1] - F[i, 1]) < WAY_FROM) &
                     (np.hypot(F[idx, 2] - F[i, 2], F[idx, 3] - F[i, 3]) < WAY_TO)]
            if best is None or len(nb) > len(best):
                best = nb
        left[best] = False
        m = np.median(F[best], axis=0)
        out.append({'from': [round(float(m[0]), 1), round(float(m[1]), 1)],
                    'to': [round(float(m[2]), 1), round(float(m[3]), 1)], 'n': int(len(best))})
        if len(out) >= 3:
            break
    return out


def make_t_executes(R, H):
    """сценарии T. Возвращает (сценарии, раундов с плантом, сводка для отчёта)"""
    nades = pd.read_csv(os.path.join(ROOT, 'data', 'pro', 'pro_nades.csv'))
    nades['purpose'] = nades.purpose.fillna('')
    plant_r = {r['rid']: r for r in R if r['site']}
    nades = nades[(nades.side == 'T') & nades.secToPlant.between(0, EXEC_WIN) & nades.rid.isin(plant_r)].copy()
    TG = Targets(H)
    tg = [TG.of(t, x, y) for t, x, y in zip(nades.type, nades.lx, nades.ly)]
    nades['tkey'] = [k for k, _ in tg]
    nades['tname'] = [n for _, n in tg]
    by_rid = defaultdict(list)
    for n in nades.itertuples():
        by_rid[n.rid].append(n)
    groups = defaultdict(list)
    for r in plant_r.values():
        groups[(r['site'], t_route(r))].append(r)
    plants = len(plant_r)
    out = []
    in_step = set()   # (rid, tkey) гранат, ставших шагом
    for (site, route), rr in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        if len(out) >= 4 or len(rr) < EXEC_MIN_SHARE * plants:
            break
        rids = {r['rid'] for r in rr}
        g = defaultdict(list)
        for rid in rids:
            for n in by_rid[rid]:
                if not n.purpose:
                    g[n.tkey].append(n)
        steps = []
        for key, ns in g.items():
            share = len({n.rid for n in ns}) / len(rids)
            if share < STEP_MIN_SHARE:
                continue
            typ = Counter(n.type for n in ns).most_common(1)[0][0]
            steps.append({'type': typ, 'key': key, 'target': ns[0].tname,
                          'x': round(float(np.median([n.lx for n in ns])), 1), 'y': round(float(np.median([n.ly for n in ns])), 1),
                          'secToPlant': float(np.median([n.secToPlant for n in ns])), 'share': round(share, 2),
                          'ways': ways_of(ns), 'n': len(ns)})
        steps = sorted(steps, key=lambda s: (-s['share'], s['key']))[:STEP_MAX]
        steps.sort(key=lambda s: (-s['secToPlant'], s['key']))
        for s_ in steps:
            in_step |= {(rid, s_['key']) for rid in rids}
        entry = [e for e in (entry_sec_to_plant(r) for r in rr) if e is not None]
        entry_s = float(np.median(entry)) if entry else 5.0
        start = max([s['secToPlant'] for s in steps] + [entry_s])
        # шаги сценария: цели по порядку, зависимости — от предыдущего смока
        res, num = [], Counter()
        last = {}
        for s in steps:
            num[s['type']] += 1
            actor = '%s_%d' % (s['type'], num[s['type']])
            act = {'smoke': 'throw_smoke', 'flash': 'throw_flash', 'molly': 'throw_molly', 'he': 'throw_he'}[s['type']]
            # флешка/молотов/HE после смока — ждут, пока ляжет последний смок до них;
            # смок и всё, что раньше первого смока, — по старту execute
            dep = {'afterSmokeLands': last['smoke']} if s['type'] != 'smoke' and 'smoke' in last \
                else {'trigger': 'execute_start'}
            res.append({'actor': actor, 'action': act, 'target': s['target'], 'targetKey': s['key'],
                        'at': [s['x'], s['y']], 'ways': s['ways'], 'sec': round(start - s['secToPlant'], 1),
                        'share': s['share'], 'dependsOn': dep})
            last[s['type']] = actor
        flash_sec = max([x['sec'] for x in res if x['action'] == 'throw_flash'], default=None)
        entry_dep = {'afterFlashPop': last['flash'],
                     'maxDelayTicks': int(round(max(0.0, (start - entry_s) - flash_sec) * TICK))} \
            if 'flash' in last else {'afterSmokeLands': last['smoke']} if 'smoke' in last else {'trigger': 'execute_start'}
        res.append({'actor': 'entry', 'action': 'push', 'target': site, 'sec': round(start - entry_s, 1),
                    'dependsOn': entry_dep})
        res.append({'actor': 'bomb', 'action': 'plant', 'target': site, 'sec': round(start, 1),
                    'dependsOn': {'afterEntryCommitted': 'entry'}})
        lurks = [lurk_zones(r) for r in rr]
        lurks = [l for l in lurks if l]
        if len(lurks) >= LURK_MIN_SHARE * len(rr):
            zc = Counter(z for l in lurks for z in l).most_common(1)[0][0]
            res.append({'actor': 'lurker', 'action': 'hold_flank', 'target': zc, 'optional': True,
                        'share': round(len(lurks) / len(rr), 2), 'dependsOn': {}})
        plant_sec = float(np.median([(r['tplant'] - r['t0']) / TICK for r in rr]))
        out.append({'id': 't_exec_%s_%s_ancient' % (site, route), 'side': 'T', 'site': site, 'route': route,
                    'rounds': len(rr), 'share': round(len(rr) / plants, 2),
                    'timing': {'startSec': round(plant_sec - start, 1), 'plantSec': round(plant_sec, 1)},
                    'steps': res})
    scen = sum((rid, k) in in_step and not p for rid, k, p in zip(nades.rid, nades.tkey, nades.purpose))
    srids = {r['rid'] for (site, route), rr in groups.items()
             if any(e['site'] == site and e['route'] == route for e in out) for r in rr}
    ns = nades[nades.rid.isin(srids)]
    selfn = int((nades.purpose != '').sum())
    stat = {'plants': plants, 'withNades': int(nades.rid.nunique()), 'nades': len(nades),
            'scenario': int(scen), 'self': selfn, 'outside': len(nades) - int(scen) - selfn,
            'selfKinds': nades[nades.purpose != ''].purpose.value_counts().to_dict(),
            'lurkRounds': sum(1 for r in plant_r.values() if lurk_zones(r)),
            'inScenRounds': {'nades': len(ns), 'scenario': int(scen), 'self': int((ns.purpose != '').sum())}}
    return out, plants, stat


# ---------------- запись ----------------
def dump(path, head, lists):
    """каждый элемент списка — одной строкой (файл читается глазами и сравнивается в git)"""
    parts = ['%s: %s' % (json.dumps(k), json.dumps(v, ensure_ascii=False)) for k, v in head.items()]
    for k, L in lists.items():
        parts.append('%s: [\n%s\n]' % (json.dumps(k), ',\n'.join(
            '  ' + json.dumps(x, ensure_ascii=False, separators=(',', ':')) for x in L)))
    open(path, 'w', encoding='utf-8').write('{\n' + ',\n'.join(parts) + '\n}\n')


PAIRS = []


def main():
    global PAIRS, NR
    R, H = load_rounds()
    NR = len(R)
    for site in 'AB':
        xs = [(r['plantXY']) for r in R if r['site'] == site]
        SITE_C[site] = (float(np.mean([x for x, _ in xs])), float(np.mean([y for _, y in xs])))
    P = finalize_points(make_points(H, 'CT') + make_points(H, 'T'))
    PAIRS = make_pairs([p for p in P if p['side'] == 'CT'])
    pair_of = defaultdict(list)
    for pr in PAIRS:
        pair_of[pr['a']].append(pr['b']); pair_of[pr['b']].append(pr['a'])
    nr = len(R)
    points = []
    for p in sorted(P, key=lambda p: (p['side'], p['id'])):
        points.append({'id': p['id'], 'side': p['side'], 'area': p['zone']['name'], 'region': p['region'],
                       'x': round(p['x'], 1), 'y': round(p['y'], 1), 'z': round(p['z']), 'yaw': round(p['yaw']),
                       'angle': {'zone': p['aimZone']['name'], 'x': round(p['aim'][0], 1), 'y': round(p['aim'][1], 1),
                                 'dist': round(p['aimDist'])},
                       'type': p['type'], 'peek': p['peek'], 'crouch': False, 'fallback': p['fallback'], 'pairs': pair_of[p['id']],
                       'rounds': len(p['rounds']), 'share': round(len(p['rounds']) / nr, 3),
                       'sec': round(p['sec']), 'hold': round(p['dur'], 1)})
    ct_setups, nlay = make_ct_setups(R, H, P)
    t_exec, nplant, stat = make_t_executes(R, H)
    # самопроверка: все ссылки ведут на существующие точки
    ids = {p['id'] for p in points}
    refs = [p['fallback'] for p in points if p['fallback']] + [q for p in points for q in p['pairs']] + \
        [x for pr in PAIRS for x in (pr['a'], pr['b'])] + \
        [x for st in ct_setups for sl in st['slots'] for x in [sl['point']] + [a['id'] for a in sl['alternatives']]]
    bad = [x for x in refs if x not in ids]
    assert not bad, 'битые ссылки: %s' % bad[:10]
    demos = sorted({r['demo'] for r in R})
    dump(OUT_POS, {'_about': [
        'Позиции Ancient из демок про. Делает tools/positions_bake.py (docs/BRAIN.md, раздел 4).',
        'Точка — место, где про стояли 2+ с (скорость < 10 ед. карты/с) хотя бы в %.1f %% раундов; '
        'соседние похожие (ближе %d ед. карты, взгляд в %d°) склеены; '
        'координаты — карта 0..2048, z и yaw — как в игре.' % (MIN_SHARE * 100, MERGE_D, MERGE_YAW),
        'area — зона-колл (zonemap.json), region — сторона карты по x (A < 700 < мид < 1250 < B), back — задние проходы CT.',
        'angle — куда смотрит: конец луча взгляда до высокой стены/края навмеша, его зона и длина.',
        'type: standard — частые точки своей area (не реже %d %% самой частой и хотя бы в %.1f %% раундов), off — редкие '
        '(неожиданная позиция).' % (round(STD_SHARE * 100), STD_MIN_SHARE * 100),
        'peek — стоит вплотную за укрытием, угол — ближайшее к взгляду открытое направление (±10–40°, держит из-за края).',
        'crouch — не измерено (в выгрузке демок нет присяда), везде false.',
        'fallback — запасная точка на тот же вход рядом (BRAIN 4.4); pairs — кроссфайр-напарники (список pairs ниже).',
        'rounds/share — в скольких раундах из %d стояли; sec — типичная секунда раунда; hold — типичная длительность, с.' % nr],
        'map': 'ancient', 'demos': demos, 'rounds': nr},
        {'points': points, 'pairs': PAIRS})
    dump(OUT_SET, {'_about': [
        'Setup\'ы Ancient из демок про. Делает tools/positions_bake.py (docs/BRAIN.md, разделы 4.1, 5.1, 5.3).',
        'CT: раскладка «сколько CT на A / миде / B» — по тому, где каждый CT дольше стоял на %d–%d-й секунде, '
        'в раундах с 5 живыми CT (%d раундов); '
        'берутся до 4 самых частых (не реже %d %%). Слоты — самые занятые точки этой раскладки в окне %d–%d с; '
        'второй слот на стороне — кроссфайр-напарник первого, если он есть; anchor — ближе к сайту. '
        'alternatives — другие точки той же стороны (для выбора по роли), pairWith — роль напарника.'
        % (LAYOUT_WIN[0], LAYOUT_WIN[1], nlay, round(SETUP_MIN_SHARE * 100), SETUP_WIN[0], SETUP_WIN[1]),
        'T: раунды с плантом (%d), вариант = сайт + маршрут за %d с до планта (main — все со своей стороны, '
        'split — часть через мид, mid — все через мид), не реже %d %% плантов, до 4 самых частых. '
        'Шаг — ЦЕЛЬ гранаты T за %d с до планта (что она выключает у CT: смок — закрыть взгляд CT-точки, '
        'флешка — ослепить CT-точку, молотов/HE — выжечь CT-точку; иначе — зона падения), которую закрывают '
        'хотя бы в %d %% раундов варианта; targetKey — id цели; at — типичное место разрыва; '
        'ways — способы (откуда → куда, сколько бросков); sec — секунда от начала execute; '
        'entry.maxDelayTicks — сколько вход ждёт после последней флешки (медиана про); '
        'lurker — необязательный шаг: share — в какой доле раундов варианта кто-то из T был на другой стороне '
        'за %d с до планта или в плант.' % (nplant, EXEC_LOOK, round(EXEC_MIN_SHARE * 100), EXEC_WIN,
                                           round(STEP_MIN_SHARE * 100), EXEC_LOOK),
        'Гранаты «себе» (флешка под свой выход, смок на себя под плант/дефуз, молотов в угол перед своим '
        'проходом — purpose в data/pro/pro_nades.csv, tools/lineups.py) в шаги не идут: это решения игрока, '
        'не сценарий. selfNades — сколько их среди гранат T за %d с до планта.' % EXEC_WIN],
        'map': 'ancient', 'selfNades': stat['selfKinds']},
        {'ct': ct_setups, 't': t_exec})
    if '--report' in sys.argv:
        print(len(R), 'раундов,', len(H), 'стоянок,', len(points), 'точек (CT %d, T %d),' % (
            sum(p['side'] == 'CT' for p in points), sum(p['side'] == 'T' for p in points)), len(PAIRS), 'пар')
        for s in ct_setups:
            print(s['id'], s['split'], s['rounds'], [(x['role'], x['point'], x['pairWith']) for x in s['slots']])
        print('склеено соседних точек:', MERGED)
        print('T:', stat)
        for s in t_exec:
            print(s['id'], s['rounds'], s['timing'], [(x['actor'], x.get('target'), x.get('sec'), x.get('share')) for x in s['steps']])


if __name__ == '__main__':
    main()
