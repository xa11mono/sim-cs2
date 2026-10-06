#!/usr/bin/env python3
"""Библиотека мест из демок (v195): где про стоят и держат угол и куда оттуда смотрят.

python3 tools/spots_bake.py            → src/data/spots.json

Берётся каждый игрок каждые 0,25 с (data/demos/*_ticks.csv.gz). «Держит угол» —
стоит (сдвиг < 4 px за 0,25 с) непрерывно 2+ с, и в это время:
  - не стрелял и не бросал гранату (±2 с);
  - рядом (600 px) никто не погиб (3 с до и 1 с после);
  - ни одного живого врага на прямой видимости (стены data/walls.json, до 2000 px);
  - не ставит бомбу и не дефузит (у бомбы после планта — не берётся).
Фаза: до планта — «pre» (у T — до выхода/сетап, у CT — расстановка); после
планта у T — «post» (держат бомбу), у CT — «retake».
Стояния одной стороны и фазы в 32 px друг от друга сливаются в одно место; место
остаётся, если там стояли хотя бы в 2 разных матчах и 3+ раза.
Куда смотрят: гистограмма взгляда за всё время стояния (шаг 10°), 1-е направление —
самое частое, 2-е — если на него смотрят хотя бы 25% времени и оно на 40°+ в стороне.
Точка взгляда — по лучу до первой стены (120–900 px).
Район: зоны мида — M; иначе ближайший сайт в 620 px — A/B; иначе пусто (вне районов),
как teamAreaOf в игре."""
import glob, gzip, json, os, re, math
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
D = os.path.join(ROOT, 'data', 'demos')
W = np.array(json.load(open(os.path.join(ROOT, 'data', 'walls.json')))['w'], dtype=float)
ZM = json.load(open(os.path.join(ROOT, 'src', 'data', 'zonemap.json')))
ZN = json.load(open(os.path.join(ROOT, 'src', 'data', 'zone_names.json')))
SITES = {'A': (630, 518), 'B': (1533, 845)}
MID = {"Mid", "Top Mid", "Sniper Nest", "Connector / Red Room / Red", "Jungle / Pit", "Xbox", "Lower Mid / Start Mid", "Chamber Lane"}
STILL_PX = 4.0; MIN_RUN = 8; FIRE_S = 2.0; DEATH_R = 600; LOS_R = 2000; MERGE = 32; MIN_MATCH = 2; MIN_SEG = 3

def tr(X, Y): return (np.asarray(X) + 2953) / 5 * 2, (2164 - np.asarray(Y)) / 5 * 2

def los_many(ax, ay, bx, by):
    """видимость для массивов пар точек (True — стен между ними нет)"""
    n = len(ax); ok = np.ones(n, bool)
    if not n: return ok
    p = np.stack([ax, ay], 1)[:, None, :]; r = np.stack([bx - ax, by - ay], 1)[:, None, :]
    q = W[None, :, :2]; s = (W[:, 2:] - W[:, :2])[None]
    rxs = r[..., 0] * s[..., 0] - r[..., 1] * s[..., 1]
    qp = q - p
    t = (qp[..., 0] * s[..., 1] - qp[..., 1] * s[..., 0])
    u = (qp[..., 0] * r[..., 1] - qp[..., 1] * r[..., 0])
    with np.errstate(divide='ignore', invalid='ignore'):
        t = t / rxs; u = u / rxs
    hit = (np.abs(rxs) > 1e-9) & (t > 0) & (t < 1) & (u >= 0) & (u <= 1)
    return ~hit.any(1)

def ray_len(x, y, a, lo=120, hi=900):
    dx, dy = math.cos(a), math.sin(a); best = hi
    for x1, y1, x2, y2 in W:
        sx, sy = x2 - x1, y2 - y1; den = dx * sy - dy * sx
        if abs(den) < 1e-9: continue
        t = ((x1 - x) * sy - (y1 - y) * sx) / den; u = ((x1 - x) * dy - (y1 - y) * dx) / den
        if t > 1 and 0 <= u <= 1 and t < best: best = t
    return max(lo, best)

ZPOLY = []
for z in ZM['zones']:
    pts = z['points'] if isinstance(z['points'], list) else eval(z['points'])
    ZPOLY.append((z['id'], np.array([[p['x'], p['y']] for p in pts], float)))
def zone_name(x, y):
    from matplotlib.path import Path
    best, bd = None, 1e9
    for zid, P in ZPOLY:
        if Path(P).contains_point((x, y)): return ZN.get(zid, zid)
        d = np.min(np.hypot(P[:, 0] - x, P[:, 1] - y))
        if d < bd: bd, best = d, ZN.get(zid, zid)
    return best
def area_of(x, y, zn):
    if zn in MID: return 'M'
    best, bd = '', 1e9
    for k, (sx, sy) in SITES.items():
        d = math.hypot(x - sx, y - sy)
        if d < 620 and d / 620 < bd: bd, best = d / 620, k
    return best

def segments_of(base):
    """стояния «держит угол» одного файла демки"""
    t = pd.read_csv(base + '_ticks.csv.gz')
    fe = pd.read_csv(base + '_round_freeze_end.csv.gz'); re_ = pd.read_csv(base + '_round_end.csv.gz')
    pl = pd.read_csv(base + '_bomb_planted.csv.gz'); de = pd.read_csv(base + '_player_death.csv.gz')
    fi = pd.read_csv(base + '_weapon_fire.csv.gz')
    t = t[(t.is_alive == True) & (t.is_warmup_period == False)].copy()
    t['x'], t['y'] = tr(t.X.values, t.Y.values)
    t['side'] = np.where(t.team_num == 3, 'CT', 'T')
    fi = fi[~fi.weapon.astype(str).str.contains('knife|c4', regex=True)]
    dx_, dy_ = tr(de.user_X.values, de.user_Y.values); de = de.assign(x=dx_, y=dy_)
    out = []
    for _, r in fe.iterrows():
        t0 = r.tick; e = re_[re_.tick > t0].tick; t1 = e.min() if len(e) else t.tick.max()
        s = t[(t.tick >= t0) & (t.tick < t1)].sort_values(['steamid', 'tick'])
        if s.empty: continue
        pp = pl[(pl.tick > t0) & (pl.tick < t1)]
        tp = pp.tick.min() if len(pp) else 1e18
        bx, by = (tr(pp.user_X.iloc[0], pp.user_Y.iloc[0]) if len(pp) else (None, None))
        planter = pp.user_steamid.iloc[0] if len(pp) else None
        dR = de[(de.tick >= t0 - 64) & (de.tick < t1 + 64)]; fR = fi[(fi.tick >= t0 - 200) & (fi.tick < t1 + 200)]
        # видимость врагов на каждом тике
        vis = {}
        for tk, g in s.groupby('tick'):
            c = g[g.side == 'CT']; tt = g[g.side == 'T']
            if c.empty or tt.empty: continue
            ci, ti = np.meshgrid(np.arange(len(c)), np.arange(len(tt)), indexing='ij'); ci = ci.ravel(); ti = ti.ravel()
            ax, ay = c.x.values[ci], c.y.values[ci]; bx_, by_ = tt.x.values[ti], tt.y.values[ti]
            near = np.hypot(ax - bx_, ay - by_) < LOS_R
            seen = np.zeros(len(ci), bool); seen[near] = los_many(ax[near], ay[near], bx_[near], by_[near])
            for k in np.nonzero(seen)[0]:
                vis[(tk, c.steamid.values[ci[k]])] = 1; vis[(tk, tt.steamid.values[ti[k]])] = 1
        for sid, g in s.groupby('steamid'):
            g = g.reset_index(drop=True)
            if len(g) < MIN_RUN: continue
            mv = np.hypot(np.diff(g.x.values, prepend=g.x.values[0]), np.diff(g.y.values, prepend=g.y.values[0]))
            ok = mv < STILL_PX
            ftk = fR[fR.user_steamid == sid].tick.values
            for i in range(len(g)):
                if not ok[i]: continue
                tk = g.tick.values[i]
                if vis.get((tk, sid)): ok[i] = False; continue
                if len(ftk) and np.any(np.abs(ftk - tk) < FIRE_S * 64): ok[i] = False; continue
                dd = dR[(dR.tick > tk - 3 * 64) & (dR.tick < tk + 64)]
                if len(dd) and np.any(np.hypot(dd.x.values - g.x.values[i], dd.y.values - g.y.values[i]) < DEATH_R): ok[i] = False; continue
                if tk >= tp and bx is not None and math.hypot(g.x.values[i] - bx, g.y.values[i] - by) < 70: ok[i] = False; continue
                if sid == planter and tp - 5 * 64 < tk < tp + 32: ok[i] = False; continue
            i = 0
            while i < len(g):
                if not ok[i]: i += 1; continue
                j = i
                while j + 1 < len(g) and ok[j + 1] and g.tick.values[j + 1] - g.tick.values[j] <= 16 and (g.tick.values[j + 1] >= tp) == (g.tick.values[i] >= tp): j += 1
                if j - i + 1 >= MIN_RUN:
                    seg = g.iloc[i:j + 1]; side = seg.side.iloc[0]; post = seg.tick.iloc[0] >= tp
                    ph = 'pre' if not post else ('post' if side == 'T' else 'retake')
                    yaw = np.radians(seg.yaw.values)
                    out.append({'x': float(np.median(seg.x)), 'y': float(np.median(seg.y)), 'side': side, 'phase': ph,
                                'ang': np.arctan2(-np.sin(yaw), np.cos(yaw)).tolist(), 'sec': float((seg.tick.iloc[0] - t0) / 64)})
                i = j + 1
    return out

def looks_of(angs):
    a = np.asarray(angs); nb = 36
    h = np.bincount(((a + math.pi) / (2 * math.pi) * nb).astype(int) % nb, minlength=nb).astype(float)
    hs = h + 0.5 * np.roll(h, 1) + 0.5 * np.roll(h, -1)
    tot = h.sum(); res = []
    for _ in range(2):
        k = int(np.argmax(hs)); m = h[[(k - 1) % nb, k, (k + 1) % nb]].sum() / tot
        idx = [(k + d) % nb for d in (-1, 0, 1)]
        ang_c = (k + 0.5) / nb * 2 * math.pi - math.pi
        sel = a[np.abs(((a - ang_c + math.pi) % (2 * math.pi)) - math.pi) < 0.27]
        ang = math.atan2(np.mean(np.sin(sel)), np.mean(np.cos(sel))) if len(sel) else ang_c
        if res and (m < 0.25 or abs(((ang - res[0][0] + math.pi) % (2 * math.pi)) - math.pi) < 0.7): break
        res.append((ang, m))
        for d in range(-4, 5): hs[(k + d) % nb] = 0
    return res

def main():
    files = sorted(glob.glob(os.path.join(D, '*_ticks.csv.gz')))
    segs = []
    for f in files:
        base = f[:-len('_ticks.csv.gz')]; match = re.sub(r'-p\d$', '', os.path.basename(base))
        sg = segments_of(base)
        for s in sg: s['m'] = match
        segs += sg; print(os.path.basename(base), len(sg), flush=True)
    spots = []
    for side in ('CT', 'T'):
        for ph in ('pre', 'post', 'retake'):
            S = sorted([s for s in segs if s['side'] == side and s['phase'] == ph], key=lambda s: -len(s['ang']))
            cl = []
            for s in S:
                best, bd = None, MERGE
                for c in cl:
                    d = math.hypot(c['x'] - s['x'], c['y'] - s['y'])
                    if d < bd: bd, best = d, c
                if best is None: cl.append({'x': s['x'], 'y': s['y'], 'S': [s]})
                else:
                    best['S'].append(s); n = sum(len(q['ang']) for q in best['S'])
                    best['x'] = sum(q['x'] * len(q['ang']) for q in best['S']) / n; best['y'] = sum(q['y'] * len(q['ang']) for q in best['S']) / n
            for c in cl:
                ms = {q['m'] for q in c['S']}
                if len(ms) < MIN_MATCH or len(c['S']) < MIN_SEG: continue
                angs = sum((q['ang'] for q in c['S']), [])
                lk = []
                for ang, m in looks_of(angs):
                    L = ray_len(c['x'], c['y'], ang)
                    lk.append({'x': round(c['x'] + math.cos(ang) * L, 1), 'y': round(c['y'] + math.sin(ang) * L, 1), 'w': round(m, 2)})
                zn = zone_name(c['x'], c['y'])
                spots.append({'x': round(c['x'], 1), 'y': round(c['y'], 1), 'side': side, 'phase': ph, 'area': area_of(c['x'], c['y'], zn),
                              'zone': zn, 'looks': lk, 'n': len(c['S']), 'm': len(ms), 'sec': round(len(angs) / 4),
                              't': round(float(np.median([q['sec'] for q in c['S']])))})
    spots.sort(key=lambda p: (p['side'], p['phase'], -p['n']))
    for i, p in enumerate(spots): p['id'] = 's%d' % (i + 1)
    out = {'v': 1, 'note': 'библиотека мест из демок (tools/spots_bake.py): стоят и держат угол, не в бою; looks — 1–2 частых направления взгляда',
           'demos': len({s['m'] for s in segs}), 'segs': len(segs), 'spots': spots}
    json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'spots.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print('стояний', len(segs), 'мест', len(spots), Counter((p['side'], p['phase']) for p in spots), Counter((p['side'], p['area']) for p in spots), 'с 2 взглядами', sum(len(p['looks']) == 2 for p in spots))

if __name__ == '__main__': main()
