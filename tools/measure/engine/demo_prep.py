#!/usr/bin/env python3
"""(шаг 0а, ENGINE_AUDIT) данные демок про для проверки движка: python3 tools/measure/engine/demo_prep.py --map mirage
Пишет tools/measure/runs/e0a_vis/<карта>_{kills,neg,hgt}.json (координаты уже в радаре 0..2048, z — ед. игры, ноги).
 kills — убийства пулей/ножом без прострела (penetrated == 0): убийца и жертва в момент убийства (XY — из player_death,
         Z — ближайший тик ticks того же игрока, ≤ 16 тиков), в прыжке/падении помечены;
 neg   — пары живых врагов (раз в 1 с, ≤ 600 px радара), которые 2 с подряд не стреляли вовсе и не умерли, линия не
         через дым (дым 18 с, радиус 144 ед.); face=1 — хотя бы один смотрит на другого (±15° по горизонтали):
         про, который видит врага перед прицелом, стреляет быстрее 2 с — значит, в демке линии, скорее всего, не было;
 hgt   — игроки на земле (вторая разность Z по тикам < 2 ед.: не прыжок, не падение), раз в 1 с: X, Y, Z."""
import sys, os, glob, json, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import mapdir  # noqa
MAP = mapdir.current()
ROOT = mapdir.ROOT
DEM = os.path.join(ROOT, 'data', 'demos') if MAP == 'ancient' else mapdir.path(MAP, 'demos')
OUT = os.path.join(ROOT, 'tools', 'measure', 'runs', 'e0a_vis'); os.makedirs(OUT, exist_ok=True)
g2m = mapdir.game_to_map(MAP)
NOT_BULLET = {'hegrenade', 'inferno', 'molotov', 'incgrenade', 'flashbang', 'smokegrenade', 'decoy', 'world', 'planted_c4', 'c4', 'trigger_hurt', ''}
rng = np.random.default_rng(1)
kills, neg, hgt = [], [], []
demos = sorted(f[:-len('_ticks.csv.gz')] for f in glob.glob(os.path.join(DEM, f'*{MAP}*_ticks.csv.gz')))
for di, d in enumerate(demos):
    name = os.path.basename(d)
    try:
        T = pd.read_csv(d + '_ticks.csv.gz', usecols=['tick', 'steamid', 'X', 'Y', 'Z', 'is_alive', 'team_num', 'yaw', 'is_warmup_period', 'total_rounds_played'])
        K = pd.read_csv(d + '_player_death.csv.gz')
        FE = pd.read_csv(d + '_freeze_end.csv.gz') if os.path.exists(d + '_freeze_end.csv.gz') else pd.read_csv(d + '_round_freeze_end.csv.gz')
    except Exception as e:
        print('skip', name, e); continue
    W = pd.read_csv(d + '_weapon_fire.csv.gz', usecols=['tick', 'user_steamid', 'weapon']) if os.path.exists(d + '_weapon_fire.csv.gz') else pd.DataFrame(columns=['tick', 'user_steamid', 'weapon'])
    SM = pd.read_csv(d + '_smokegrenade_detonate.csv.gz') if os.path.exists(d + '_smokegrenade_detonate.csv.gz') else pd.DataFrame(columns=['tick', 'x', 'y'])
    T = T[(T.is_warmup_period == False) & (T.tick >= FE.tick.min())]  # noqa: E712
    T = T.sort_values(['steamid', 'tick'])
    # вторая разность Z (тики идут через 16)
    T['z2'] = (T.groupby('steamid').Z.shift(1) + T.groupby('steamid').Z.shift(-1) - 2*T.Z).abs()
    T['dt'] = T.groupby('steamid').tick.diff()
    mx, my = g2m(T.X.values, T.Y.values); T['mx'] = mx; T['my'] = my
    # --- убийства ---
    K = K[K.tick >= FE.tick.min()]
    zi = T.set_index(['steamid', 'tick'])
    for r in K.itertuples():
        if pd.isna(r.attacker_steamid) or r.attacker_steamid == r.user_steamid or str(r.weapon) in NOT_BULLET: continue
        if r.attacker_team_num == r.user_team_num: continue
        def zat(sid, tk):
            s = T[(T.steamid == sid) & (T.tick <= tk + 16) & (T.tick >= tk - 16)]
            if not len(s): return None, None
            i = (s.tick - tk).abs().values.argmin(); return float(s.Z.values[i]), float(s.z2.values[i]) if s.z2.values[i] == s.z2.values[i] else 99.0
        za, a2 = zat(int(r.attacker_steamid), r.tick); zv, v2 = zat(int(r.user_steamid), r.tick)
        if za is None or zv is None: continue
        ax, ay = g2m(r.attacker_X, r.attacker_Y); vx, vy = g2m(r.user_X, r.user_Y)
        kills.append([name, int(r.tick), int(r.total_rounds_played), round(float(ax), 1), round(float(ay), 1), round(za, 1), round(float(vx), 1), round(float(vy), 1), round(zv, 1),
                      str(r.weapon), int(bool(r.attackerinair)) or int(a2 > 2), int(v2 > 2), int(r.penetrated or 0), int(bool(r.thrusmoke)), round(float(r.distance), 1)])
    # прострелы — отдельно (penetrated > 0 уже в списке с флагом)
    # --- отрицательные пары ---
    fire = {}
    for sid, g in W.groupby('user_steamid'): fire[int(sid)] = np.sort(g.tick.values)
    death = {int(s): t for s, t in zip(K.user_steamid, K.tick) if s == s}
    smokes = SM[['tick', 'x', 'y']].values if len(SM) else np.zeros((0, 3))
    ticks = np.sort(T.tick.unique()); samp = ticks[::4]   # раз в 64 тика
    samp = samp[rng.random(len(samp)) < 0.5]
    G = {t: g for t, g in T[T.tick.isin(samp) & (T.is_alive == True)].groupby('tick')}  # noqa: E712
    def fired(sid, t0, t1):
        a = fire.get(sid); return a is not None and np.searchsorted(a, t1, 'right') - np.searchsorted(a, t0, 'left') > 0
    def smoked(t, x1, y1, x2, y2):
        for st, sx, sy in smokes:
            if not (st <= t <= st + 18*64): continue
            dx, dy = x2-x1, y2-y1; L2 = dx*dx + dy*dy or 1; u = max(0, min(1, ((sx-x1)*dx + (sy-y1)*dy)/L2))
            if math.hypot(x1 + dx*u - sx, y1 + dy*u - sy) < 160: return True
        return False
    for t, g in G.items():
        ct = g[g.team_num == 3].values.tolist(); tt = g[g.team_num == 2].values.tolist()
        cols = list(g.columns); I = {c: cols.index(c) for c in cols}
        for a in ct:
            for b in tt:
                dm = math.hypot(a[I['mx']]-b[I['mx']], a[I['my']]-b[I['my']])
                if dm > 600 or dm < 20: continue
                sa, sb = int(a[I['steamid']]), int(b[I['steamid']])
                if fired(sa, t, t + 128) or fired(sb, t, t + 128): continue
                if death.get(sa, 1e12) <= t + 128 or death.get(sb, 1e12) <= t + 128: continue
                if a[I['z2']] > 2 or b[I['z2']] > 2: continue
                if smoked(t, a[I['X']], a[I['Y']], b[I['X']], b[I['Y']]): continue
                def faces(p, q):
                    ang = math.degrees(math.atan2(q[I['Y']]-p[I['Y']], q[I['X']]-p[I['X']])); dd = (ang - p[I['yaw']] + 540) % 360 - 180
                    return abs(dd) < 15
                neg.append([name, int(t), round(a[I['mx']], 1), round(a[I['my']], 1), round(a[I['Z']], 1), round(b[I['mx']], 1), round(b[I['my']], 1), round(b[I['Z']], 1),
                            int(faces(a, b) or faces(b, a))])
    # --- высоты ---
    H = T[(T.is_alive == True) & (T.z2 < 2) & (T.dt == 16)]  # noqa: E712
    H = H[H.tick % 64 == H.tick.min() % 64]
    hgt += [[round(x, 1), round(y, 1), round(z, 1)] for x, y, z in zip(H.mx, H.my, H.Z)]
    print(di, name, len(kills), len(neg), len(hgt), flush=True)
json.dump(kills, open(os.path.join(OUT, f'{MAP}_kills.json'), 'w'))
json.dump(neg, open(os.path.join(OUT, f'{MAP}_neg.json'), 'w'))
json.dump(hgt, open(os.path.join(OUT, f'{MAP}_hgt.json'), 'w'))
print('done', MAP, len(demos), 'demos', len(kills), len(neg), len(hgt))
