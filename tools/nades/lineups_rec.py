#!/usr/bin/env python3
"""В4 (21.10.2026): лайнап = записанный бросок про.  python3 tools/nades/lineups_rec.py --map <карта>

Из data/maps/<карта>/throws.json (В1, броски про со связанным разрывом) собирает лайнапы и пишет их в набор карты
(lineups.json: pro / proExtra) ВМЕСТО прежних «откуда → куда» (tools/cluster.py + demos_bake.write_lineups).

1. Вариант броска = один и тот же бросок ≥ VAR_MIN раз (в ≥ VAR_DEMOS демках): та же сторона и граната, место ног ±POS_TOL ед.
   (с хода — ±POS_TOL_MOVE), поворот и наклон ±ANG_TOL°, как двигался (стоял / шёл / бежал / в прыжке), присед, скорость игрока
   ±VEL_TOL ед/с (разбег). Определение «того же броска» — как в В1 / В2б (NADES.md: ±6 ед., ±0,3°).
2. Когда кидают (insta / setup / exec / timed / call …, сайт) — у каждого броска из pro_nades.csv (tools/lineups.py), связь —
   демка, игрок, граната, поворот, время. Гранаты «себе» (purpose) в лайнапы не идут — как и раньше (cluster.py).
3. Лайнап (запись набора) = варианты одной стороны / гранаты / «когда» / сайта, которые рвутся в одном месте (разрыв ±TO_TOL px)
   и кидаются из одного места (±FROM_TOL px) — те же радиусы, что у прежних лайнапов (cluster.py). Доля раундов prob, время at —
   как раньше; отбор в pro / proExtra — те же пороги (demos_bake.py).
4. У варианта — записанные броски про (до KEEP штук): место, поворот, наклон, скорость, присед, разрыв (точка, время), кто,
   раунд, время раунда. Бот кидает один из них (разброс — как у про). Сила (ЛКМ / обе / ПКМ) и прыжок на бинде в демке не
   видны — подбирает tools/nades/lineups_fit.js (физикой, по точке разрыва про) и дописывает в варианты.
"""
import argparse, collections, json, os, sys

import numpy as np
import pandas as pd
from matplotlib.path import Path

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa: E402

POS_TOL, POS_TOL_MOVE, ANG_TOL, VEL_TOL = 6.0, 16.0, 0.3, 40.0   # ед., ед., градусы, ед/с — POS/ANG из В1; MOVE/VEL — проектные числа
VAR_MIN, VAR_DEMOS = 3, 2                                        # «≥ 3 раз» (владелец), ≥ 2 демок — как прежние лайнапы
FROM_TOL, TO_TOL = 70.0, 60.0                                    # px радара 0..2048 — как cluster.py
KEEP, VAR_KEEP = 8, 4                                                        # записанных бросков на вариант, вариантов на запись (самые частые) — страница Ancient у предела 16 МБ
PRO_MIN, EXTRA_MIN, EXTRA_MATCHES, N_MIN = 0.05, 0.015, 3, 4      # как demos_bake.py
TN = {'smoke': 'смок', 'flash': 'флешка', 'he': 'HE', 'molly': 'молотов'}
TR = {'insta': 'инста', 'exec': 'выход', 'setup': 'сетап', 'postplant': 'пост-плант', 'retake': 'ретейк', 'call': 'задержка выхода',
      'timed': 'по времени'}
GT = {'molotov': 'molly'}   # throws.json → имена игры


def move_of(t):
    vz, hs = t['vel'][2], t['hspeed']
    if vz > 60: return 'jump'
    if hs < 10: return 'stand'
    return 'walk' if hs <= 160 else 'run'


def zones(m):
    Z = json.load(open(mapdir.path(m, 'zones.json'), encoding='utf-8'))
    ZL = json.load(open(mapdir.path(m, 'map.json'), encoding='utf-8')).get('zoneLayer', {'dx': 0, 'dy': 0, 'scale': 1})
    zl = lambda p: (1024 + (p['x'] - 1024) * ZL['scale'] + ZL['dx'], 1024 + (p['y'] - 1024) * ZL['scale'] + ZL['dy'])
    P = [(Z['names'].get(z['id']) or z['id'], Path(np.array([zl(p) for p in Z['shapes'].get(z['id'], z['points'])])))
         for z in Z['zonemap']['zones']]
    def zn(x, y):
        for nm, p in P:
            if p.contains_point((x, y)): return nm.split(' / ')[0]
        return None
    return zn


def join_trig(m, T):
    """у каждого броска — trig / site / purpose / sec из pro_nades.csv (та же выгрузка демок)"""
    G = pd.read_csv(os.path.join(mapdir.pro_dir(m), 'pro_nades.csv'))
    ix = collections.defaultdict(list)
    for r in G.itertuples(index=False):
        ix[(r.m, str(r.sid), r.type)].append(r)
    n = 0
    for t in T:
        t['_trig'] = None
        if not t.get('det'): continue
        best = None
        for r in ix.get((t['demo'], str(t['steamid']), GT.get(t['type'], t['type'])), ()):
            dy = abs(((r.yaw - t['yaw']) + 180) % 360 - 180)
            ds = abs(r.sec - t['t'])
            if dy < 0.1 and ds < 0.25 and (best is None or ds < best[0]): best = (ds, r)
        if best:
            r = best[1]; n += 1
            t['_trig'] = (r.trig, r.site, '' if pd.isna(r.purpose) else r.purpose, float(r.sec))
    return n


def variants(T):
    """варианты броска: жадно — самый «плотный» бросок и все свои соседи, пока остались"""
    out = []
    groups = collections.defaultdict(list)
    for i, t in enumerate(T):
        if not t.get('det'): continue
        groups[(t['side'], t['type'], move_of(t), bool(t['duck']))].append(i)
    for (side, ty, mv, duck), I in groups.items():
        I = np.array(I)
        P = np.array([T[i]['pos'] for i in I], float)
        A = np.array([[T[i]['yaw'], T[i]['pitch']] for i in I], float)
        V = np.array([T[i]['vel'] for i in I], float)
        tol = POS_TOL if mv == 'stand' else POS_TOL_MOVE
        cell = collections.defaultdict(list)
        for k, p in enumerate(P): cell[(int(p[0] // tol), int(p[1] // tol))].append(k)
        nb = []
        for k, p in enumerate(P):
            cx, cy = int(p[0] // tol), int(p[1] // tol)
            C = [j for dx in (-1, 0, 1) for dy in (-1, 0, 1) for j in cell.get((cx + dx, cy + dy), ())]
            C = np.array(C)
            d = np.hypot(P[C, 0] - p[0], P[C, 1] - p[1])
            dyaw = np.abs(((A[C, 0] - A[k, 0]) + 180) % 360 - 180)
            ok = (d <= tol) & (np.abs(P[C, 2] - p[2]) <= 8) & (dyaw <= ANG_TOL) & (np.abs(A[C, 1] - A[k, 1]) <= ANG_TOL)
            if mv != 'stand': ok &= np.hypot(V[C, 0] - V[k, 0], V[C, 1] - V[k, 1]) <= VEL_TOL
            nb.append(C[ok])
        used = np.zeros(len(I), bool)
        for k in np.argsort([-len(x) for x in nb], kind='stable'):
            if used[k]: continue
            mem = [j for j in nb[k] if not used[j]]
            used[mem] = True
            if len(mem) < VAR_MIN: continue
            ids = [int(I[j]) for j in mem]
            if len({T[i]['demo'] for i in ids}) < VAR_DEMOS: continue
            out.append({'side': side, 'type': ty, 'move': mv, 'duck': duck, 'ids': ids})
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--map', default='ancient'); a = ap.parse_args()
    m = a.map
    TJ = json.load(open(mapdir.path(m, 'throws.json'), encoding='utf-8'))
    T = TJ['throws']
    nj = join_trig(m, T)
    print('%s: бросков %d, со «когда» из pro_nades.csv %d' % (m, sum(1 for t in T if t.get('det')), nj))
    VA = variants(T)
    print('вариантов (≥%d одинаковых бросков, ≥%d демок): %d, бросков в них %d' % (VAR_MIN, VAR_DEMOS, len(VA), sum(len(v['ids']) for v in VA)))
    tr = mapdir.game_to_map(m)
    px = lambda X, Y: tuple(round(float(v), 1) for v in tr(np.float64(X), np.float64(Y)))
    C = json.load(open(os.path.join(mapdir.pro_dir(m), 'nade_ctx.json')))
    ctxN = lambda site: C['planted'][site] if site in ('A', 'B') else C['rounds']
    zn = zones(m)
    # записи набора («когда / откуда / куда», доля раундов) — прежние (tools/cluster.py → demos_bake.py), не меняются: В4 меняет только
    # то, КАК кидают. К записи — броски про той же стороны / гранаты / «когда» / сайта из её места (±FROM_TOL px) в её место разрыва
    # (±TO_TOL px); из них — варианты (записанные лайнапы). Нет варианта — бросок «на глаз» (до В5 — физикой, как своя граната)
    fo = mapdir.path(m, 'lineups.json')
    old = json.load(open(fo, encoding='utf-8'))
    var_of = {i: vi for vi, v in enumerate(VA) for i in v['ids']}
    G = collections.defaultdict(list)
    for i, t in enumerate(T):
        tg = t.get('_trig')
        if not t.get('det') or not tg or tg[2]: continue
        G[(t['side'], GT.get(t['type'], t['type']), tg[0], tg[1])].append(i)
    FP = {k: (np.array([px(*T[i]['pos'][:2]) for i in I]), np.array([px(*T[i]['det']['pos'][:2]) for i in I])) for k, I in G.items()}
    for l in old['pro'] + old['proExtra']:
        k = (l['team'], l['type'], l['trigger'], l['site'])
        l.pop('throws', None); l.pop('rec', None)
        if k not in G: l['rec'] = 0; l['throws'] = []; continue
        F, D = FP[k]
        ok = (np.hypot(F[:, 0] - l['from']['x'], F[:, 1] - l['from']['y']) < FROM_TOL) & (np.hypot(D[:, 0] - l['to']['x'], D[:, 1] - l['to']['y']) < TO_TOL)
        ids = [G[k][j] for j in np.where(ok)[0]]
        byv = collections.Counter(var_of[i] for i in ids if i in var_of)
        vs = []
        for vi, nv in byv.most_common(VAR_KEEP):
            v = VA[vi]
            rec = sorted([i for i in ids if var_of.get(i) == vi], key=lambda i: (T[i]['demo'], T[i]['tick']))
            if len(rec) > KEEP: rec = [rec[int(j * len(rec) / KEEP)] for j in range(KEEP)]
            f0 = px(*np.median([T[i]['pos'][:2] for i in rec], axis=0))
            vs.append({'n': nv, 'nAll': len(v['ids']), 'move': v['move'], 'duck': v['duck'], 'from': {'x': f0[0], 'y': f0[1]},
                       'rec': [{'p': [round(c, 1) for c in T[i]['pos']], 'yaw': T[i]['yaw'], 'pitch': T[i]['pitch'],
                                'vel': [round(c) for c in T[i]['vel']],
                                'det': [round(c) for c in T[i]['det']['pos']], 'dt': round(T[i]['det']['dt'], 3),
                                'who': T[i]['name'], 'r': T[i]['round'], 't': T[i]['t']} for i in rec]})
        l['rec'] = round(sum(byv.values()) / max(1, len(ids)), 3); l['nRec'] = len(ids); l['throws'] = vs
    pro, ext = old['pro'], old['proExtra']
    out = {'_about': 'В4: лайнап = записанный бросок про (tools/nades/lineups_rec.py → lineups_fit.js); throws[].rec — броски про',
           'pro': pro, 'proExtra': ext, 'baked': old.get('baked', []), 'builtinOff': old.get('builtinOff', {})}
    open(fo, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    cnt = collections.Counter((l['team'], l['trigger']) for l in pro + ext)
    print('lineups.json: pro %d, proExtra %d; %s' % (len(pro), len(ext), dict(cnt)))
    for ty in ('smoke', 'flash', 'he', 'molly'):
        X = [l for l in pro + ext if l['type'] == ty]
        print('  %-6s записей %3d, с записанным лайнапом %3d (%.0f%%), броски про в лайнапах %.0f%%' % (ty, len(X),
              sum(1 for l in X if l['throws']), 100.0 * sum(1 for l in X if l['throws']) / max(1, len(X)),
              100.0 * sum(l['rec'] * l['n'] for l in X) / max(1, sum(l['n'] for l in X))))


def math_d(a, b): return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


if __name__ == '__main__':
    main()
