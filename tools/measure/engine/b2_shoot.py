#!/usr/bin/env python3
"""(Б2, ENGINE_AUDIT шаг 0б) стрельба у про и у ботов — одно определение.
  python3 tools/measure/engine/b2_shoot.py pro <карта>               → tools/measure/runs/b2/<карта>_pro_shoot.pkl
  python3 tools/measure/engine/b2_shoot.py bots <карта> <папка прогона> → tools/measure/runs/b2/<карта>_bots_shoot.pkl
  python3 tools/measure/engine/b2_shoot.py report                     → таблицы (runs/b2/shoot_report.json)
Дуэль — убийство из огнестрела; цепочка выстрелов убийцы в жертву и жертвы в убийцу назад от убийства, пока между соседними
выстрелами ≤ 1 с (у про «в него» — выстрел в сторону соперника ±25°, у ботов — цель выстрела). Начало дуэли — первый выстрел
цепочки, длительность — до убийства. Выстрелы ботов прорежены как в наших демках (первый на игрока в каждом окне 32 тика —
parse_demos.py), иначе сравнение нечестное.
Скорость в момент выстрела — по позициям раз в 16 тиков (у про и у ботов одинаково): v_last — за окно 16 тиков, которое кончается
не позже выстрела, v_prev — за окно перед ним (ед./с). «Стоял» — оба < 40; «остановился» (контрстрейф) — v_prev ≥ 90, v_last < 40;
«шёл» — v_last ≥ 90; остальное — «медленно». У ботов ещё точная скорость в момент выстрела (curSpeed) и макс. за 16 тиков до него.
Время до выстрела (Mirage, геометрия игры — tools/map3d/raycast.py): назад от первого выстрела стрелка по пробам раз в 16 тиков,
пока соперник виден (луч глаза 64/46 → голова 62 / грудь 44 / таз 30 ± 12 ед. вбок) и в поле зрения стрелка (± 55°); появление —
самая ранняя такая проба подряд (до 5 с назад). Шаг 16 тиков: ошибка до 0,25 с, у про и ботов одна и та же.
Точности по выстрелам у про нет (в репо выстрелы прорежены, player_hurt нет) — только доля хэдшотов среди убийств."""
import sys, os, json, glob, gzip, math, pickle, collections
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); MEAS = os.path.dirname(HERE); ROOT = os.path.dirname(os.path.dirname(MEAS))
sys.path.insert(0, os.path.join(ROOT, 'tools')); sys.path.insert(0, os.path.join(ROOT, 'tools', 'map3d'))
import mapdir  # noqa
OUT = os.path.join(MEAS, 'runs', 'b2'); os.makedirs(OUT, exist_ok=True)
GAP, WIN, BACK = 64, 640, 320
CLS = {}
for k in 'ak47 m4a1 m4a1_silencer famas galilar aug sg556 AK M4 M4S GALIL FAMAS AUG SG'.split(): CLS[k] = 'rifle'
for k in 'awp ssg08 g3sg1 scar20 AWP SSG'.split(): CLS[k] = 'sniper'
for k in 'deagle usp_silencer glock hkp2000 p250 tec9 fiveseven elite cz75a revolver DEAGLE GLOCK USP P250 TEC9 FIVE7 CZ DUALS R8'.split(): CLS[k] = 'pistol'
for k in 'mp9 mac10 mp7 ump45 p90 bizon mp5sd MAC10 MP9 MP7 UMP P90'.split(): CLS[k] = 'smg'
for k in 'nova xm1014 mag7 sawedoff NOVA XM MAG7 SAWED negev m249 NEGEV M249'.split(): CLS[k] = 'other'
def wcls(w): w = str(w); w = w[7:] if w.startswith('weapon_') else w; return CLS.get(w)

def spd_class(vp, vl):
    if vp is None or vl is None: return None
    if vl < 40 and vp < 40: return 'stood'
    if vl < 40 and vp >= 90: return 'stopped'
    if vl >= 90: return 'moving'
    return 'slow'

class Track:
    """позиции игрока раз в 16 тиков: t, X, Y, Z (ед. игры), yaw (градусы игры), стойка (у ботов)"""
    def __init__(s, t, X, Y, Z, yaw, cr=None):
        o = np.argsort(t); s.t = np.asarray(t)[o]; s.X = np.asarray(X, float)[o]; s.Y = np.asarray(Y, float)[o]; s.Z = np.asarray(Z, float)[o]
        s.yaw = np.asarray(yaw, float)[o]; s.cr = None if cr is None else np.asarray(cr)[o]
    def idx(s, t):   # проба с тиком t (точно)
        i = np.searchsorted(s.t, t)
        return i if i < len(s.t) and s.t[i] == t else None
    def le(s, t):    # последняя проба ≤ t
        i = np.searchsorted(s.t, t, side='right') - 1
        return i if i >= 0 else None
    def speeds(s, t):
        i = s.le(t)
        if i is None or i < 2 or s.t[i] - s.t[i-1] != 16 or s.t[i-1] - s.t[i-2] != 16: return None, None
        vl = math.hypot(s.X[i]-s.X[i-1], s.Y[i]-s.Y[i-1])*4; vp = math.hypot(s.X[i-1]-s.X[i-2], s.Y[i-1]-s.Y[i-2])*4
        return vp, vl

W = None
def world(mp):
    global W
    if W is None:
        from raycast import World
        W = World(mp, solid='sight')
    return W
EYES = (64.0, 46.0); TGT = (62.0, 44.0, 30.0); SIDE = (0.0, 12.0, -12.0)
def geo_clear(A, B, eyes=EYES):
    d = np.array([B[0]-A[0], B[1]-A[1]]); L = float(np.hypot(*d)) or 1.0; pn = np.array([-d[1], d[0]])/L
    for e in eyes:
        P = (A[0], A[1], A[2]+e)
        for tz in TGT:
            for sd in SIDE:
                if W.ray(P, (B[0]+pn[0]*sd, B[1]+pn[1]*sd, B[2]+tz)) is None: return True
    return False
def in_fov(trS, i, B, half=55.0):
    br = math.degrees(math.atan2(B[1]-trS.Y[i], B[0]-trS.X[i])); dd = (trS.yaw[i] - br + 180) % 360 - 180
    return abs(dd) <= half
_cache = {}
def visible(key, trS, trV, t, fov=True):
    i, j = trS.idx(t), trV.idx(t)
    if i is None or j is None: return None
    A = (trS.X[i], trS.Y[i], trS.Z[i]); B = (trV.X[j], trV.Y[j], trV.Z[j])
    if fov and not in_fov(trS, i, B): return False
    k = (key, t)
    if k not in _cache: _cache[k] = geo_clear(A, B, eyes=((46.0,) if (trS.cr is not None and trS.cr[i]) else EYES))
    return _cache[k]
def react(key, trS, trV, t1):
    """тиков от появления соперника (линия + поле зрения) до выстрела t1; None — на пробе перед выстрелом не виден;
    -1 — виден все 5 с (появление раньше окна)"""
    s0 = int(t1)//16*16
    v = visible(key, trS, trV, s0)
    if not v: return None
    a = s0
    while a - 16 >= t1 - BACK:
        v = visible(key, trS, trV, a - 16)
        if not v: return int(t1 - a)
        a -= 16
    return -1

def chain(sk, sv, T):
    """sk, sv — тики выстрелов убийцы в жертву и жертвы в убийцу (≤ T). → (начало, k-первый?, выстрелов убийцы, жертвы)"""
    ev = sorted([(t, 'k') for t in sk if T - WIN <= t <= T] + [(t, 'v') for t in sv if T - WIN <= t <= T], reverse=True)
    if not ev or not any(e[1] == 'k' for e in ev): return None
    start = T; used = []
    for t, w in ev:
        if start - t > GAP: break
        start = t; used.append((t, w))
    if not any(w == 'k' for _, w in used): return None
    first = min(used)[1]
    return start, first == 'k', sum(1 for _, w in used if w == 'k'), sum(1 for _, w in used if w == 'v')

def row_common(mp, who, T, cls, dist, ch, hs):
    start, kf, nk, nv = ch
    return dict(map=mp, who=who, T=T, cls=cls, dist=dist, dur=T - start, kfirst=kf, two=nv > 0, nk=nk, nv=nv, hs=hs)

# ---------------- про ----------------
def pro(mp):
    D = os.path.join(ROOT, 'data', 'demos') if mp == 'ancient' else os.path.join(ROOT, 'data', 'maps', mp, 'demos')
    rows, sp = [], []
    if mp == 'mirage': world(mp)
    files = sorted(glob.glob(os.path.join(D, f'*-{mp}_player_death.csv.gz')))
    for n, fd in enumerate(files):
        base = fd[:-len('_player_death.csv.gz')]
        try:
            K = pd.read_csv(fd); F = pd.read_csv(base + '_weapon_fire.csv.gz')
            Tk = pd.read_csv(base + '_ticks.csv.gz', usecols=['tick', 'steamid', 'X', 'Y', 'Z', 'yaw', 'is_alive'])
        except Exception as ex:
            print('пропуск', base, ex); continue
        F = F[F.weapon.map(lambda w: wcls(w) is not None)]
        K = K[K.weapon.map(lambda w: wcls(w) is not None) & K.attacker_steamid.notna()]
        TR = {int(s): Track(g.tick.values, g.X.values, g.Y.values, g.Z.values, g.yaw.values) for s, g in Tk.groupby('steamid')}
        FS = {int(s): g for s, g in F.groupby('user_steamid')}
        def aimed(sid, oid, t0, t1):
            g = FS.get(sid)
            if g is None or oid not in TR: return []
            g = g[(g.tick >= t0) & (g.tick <= t1)]; out = []
            for r in g.itertuples():
                j = TR[oid].le(r.tick)
                if j is None: continue
                ox, oy = TR[oid].X[j], TR[oid].Y[j]; d = math.hypot(ox - r.user_X, oy - r.user_Y)
                br = math.degrees(math.atan2(oy - r.user_Y, ox - r.user_X)); dd = abs((r.user_yaw - br + 180) % 360 - 180)
                if dd <= max(25.0, math.degrees(math.atan2(48, max(d, 1)))): out.append(int(r.tick))
            return out
        for k in K.itertuples():
            a, v, T = int(k.attacker_steamid), int(k.user_steamid), int(k.tick)
            if a == v or k.attacker_team_num == k.user_team_num or a not in TR or v not in TR: continue
            sk, sv = aimed(a, v, T - WIN, T), aimed(v, a, T - WIN, T)
            ch = chain(sk, sv, T)
            if not ch: continue
            dist = math.hypot(k.attacker_X - k.user_X, k.attacker_Y - k.user_Y)
            r = row_common(mp, 'pro', T, wcls(k.weapon), dist, ch, int(bool(k.headshot)))
            for side, sid, oid, S in (('k', a, v, sk), ('v', v, a, sv)):
                S = [t for t in S if t >= ch[0]]
                if not S: continue
                t1 = min(S); vp, vl = TR[sid].speeds(t1)
                r[side + '_vp'], r[side + '_vl'], r[side + '_spd'] = vp, vl, spd_class(vp, vl)
                if mp == 'mirage': r[side + '_react'] = react((sid, oid), TR[sid], TR[oid], t1)
            rows.append(r)
        print(f'{n+1}/{len(files)} {os.path.basename(base)} дуэлей {len(rows)}', flush=True)
    pickle.dump(rows, open(os.path.join(OUT, f'{mp}_pro_shoot.pkl'), 'wb'))
    return rows

# ---------------- боты ----------------
def load_rec(f): return json.load(gzip.open(f, 'rt', encoding='utf-8') if f.endswith('.gz') else open(f, encoding='utf-8'))
def bots(mp, run):
    R0 = mapdir.radar(mp); s = R0['scale'] / 2.0
    gx = lambda x: x * s + R0['pos_x']; gy = lambda y: R0['pos_y'] - y * s
    if mp == 'mirage': world(mp)
    rows, app = [], []
    for f in sorted(glob.glob(os.path.join(run, 'rec_*.json*'))):
        R = load_rec(f); m = int(os.path.basename(f).split('_')[1].split('.')[0]); KW = R.get('know') or {}
        Z = {}
        for t, i, z, c in KW.get('z', []): Z[(i, t)] = (z, c)
        P = collections.defaultdict(list)
        for t, i, ct, x, y, al, fa, w, kn in R['pos']:
            if al and (i, t) in Z: P[i].append((t, gx(x), gy(y), Z[(i, t)][0] if Z[(i, t)][0] is not None else 0, -math.degrees(fa), Z[(i, t)][1]))
        TR = {i: Track([p[0] for p in L], [p[1] for p in L], [p[2] for p in L], [p[3] for p in L], [p[4] for p in L], [p[5] for p in L]) for i, L in P.items() if len(L) > 2}
        # прореживание как в демках: первый выстрел игрока в окне 32 тика
        seen = set(); SH = collections.defaultdict(list); SX = {}
        for x in R.get('shots', []):
            t, i, tg = x[0], x[1], x[5]
            if x[8]: continue   # прострел смока
            SX[(i, t)] = x
            if (i, t // 32) in seen: continue
            seen.add((i, t // 32)); SH[(i, tg)].append(t)
        MX = {(x[1], x[0]): x[3] for x in KW.get('shotx', [])}
        for k in R['kills']:
            T, a, v, wk = k[0], k[1], k[5], k[11]
            if not a or a == v or k[2] == k[6] or wcls(wk) is None: continue
            ch = chain(SH.get((a, v), []), SH.get((v, a), []), T)
            if not ch: continue
            dist = math.hypot(k[3] - k[7], k[4] - k[8]) * s
            r = row_common(mp, 'bot', T, wcls(wk), dist, ch, k[10]); r['m'] = m
            for side, sid, oid in (('k', a, v), ('v', v, a)):
                S = [t for t in SH.get((sid, oid), []) if t >= ch[0]]
                if not S or sid not in TR: continue
                t1 = min(S); vp, vl = TR[sid].speeds(t1)
                r[side + '_vp'], r[side + '_vl'], r[side + '_spd'] = vp, vl, spd_class(vp, vl)
                x = SX.get((sid, t1))
                if x: r[side + '_cur'] = x[7] * s; r[side + '_mx16'] = (MX.get((sid, t1)) or 0) * s
                if mp == 'mirage' and oid in TR:
                    r[side + '_react'] = react((m, sid, oid), TR[sid], TR[oid], t1)
                    i0 = int(t1) // 16 * 16
                    r[side + '_geo'] = visible((m, sid, oid, 'nofov'), TR[sid], TR[oid], i0, fov=False)
            rows.append(r)
        # эпизоды «враг в _visible» → первый выстрел (точно по тикам) + проверка геометрией в момент появления
        for x in KW.get('app', []):
            b, e, t0, ts, dist, wk, cur, mx, cr, fov, bx, by, bz, ex, ey, ez, eng = x
            q = dict(map=mp, m=m, b=b, e=e, t0=t0, ts=ts, dt=ts - t0, dist=dist * s, cls=wcls(wk), cur=cur * s, mx16=mx * s, fov=fov)
            if mp == 'mirage' and bz is not None and ez is not None:
                q['geo0'] = geo_clear((gx(bx), gy(by), bz), (gx(ex), gy(ey), ez), eyes=((46.0,) if cr else EYES))
                if b in TR and e in TR:   # геометрия увидела раньше движка?
                    a0 = int(t0) // 16 * 16; n = 0
                    while n < 20 and visible((m, b, e), TR[b], TR[e], a0 - 16*(n+1)): n += 1
                    q['geo_early'] = n * 16
            app.append(q)
        print(os.path.basename(f), 'дуэлей', len(rows), 'появлений', len(app), flush=True)
    pickle.dump({'rows': rows, 'app': app}, open(os.path.join(OUT, f'{mp}_bots_shoot.pkl'), 'wb'))

# ---------------- отчёт ----------------
def q(a, p): a = [x for x in a if x is not None]; return round(float(np.percentile(a, p)), 2) if a else None
def report():
    out = {}
    for mp in ('ancient', 'mirage'):
        fp, fb = os.path.join(OUT, f'{mp}_pro_shoot.pkl'), os.path.join(OUT, f'{mp}_bots_shoot.pkl')
        if not (os.path.exists(fp) and os.path.exists(fb)): continue
        P = pd.DataFrame(pickle.load(open(fp, 'rb'))); B0 = pickle.load(open(fb, 'rb')); B = pd.DataFrame(B0['rows']); A = pd.DataFrame(B0['app'])
        O = out[mp] = {}
        for nm, D in (('pro', P), ('bot', B)):
            o = O[nm] = {'duels': len(D)}
            o['dur_med_s'] = q(D.dur / 64, 50); o['dur_q'] = [q(D.dur / 64, 25), q(D.dur / 64, 75)]
            o['two_sided'] = round(D.two.mean(), 3); o['kfirst'] = round(D.kfirst.mean(), 3)
            o['dur_two_med'] = q(D[D.two].dur / 64, 50); o['dur_one_med'] = q(D[~D.two].dur / 64, 50)
            o['dur_by_dist'] = {f'{lo}-{hi}': [int(((D.dist >= lo) & (D.dist < hi)).sum()), q(D[(D.dist >= lo) & (D.dist < hi)].dur / 64, 50)] for lo, hi in ((0, 500), (500, 1000), (1000, 1500), (1500, 9999))}
            o['hs'] = round(D.hs.mean(), 3)
            o['hs_by_cls'] = {c: [int((D.cls == c).sum()), round(D[D.cls == c].hs.mean(), 3)] for c in ('rifle', 'sniper', 'pistol', 'smg') if (D.cls == c).sum()}
            o['hs_by_dist'] = {f'{lo}-{hi}': round(D[(D.dist >= lo) & (D.dist < hi)].hs.mean(), 3) for lo, hi in ((0, 500), (500, 1000), (1000, 1500), (1500, 9999))}
            sp = pd.concat([D.get('k_spd', pd.Series(dtype=object)), D.get('v_spd', pd.Series(dtype=object))]).dropna()
            o['spd_first_shot'] = {c: round((sp == c).mean(), 3) for c in ('stood', 'stopped', 'slow', 'moving')}; o['spd_n'] = len(sp)
            vl = pd.concat([D.get('k_vl', pd.Series(dtype=float)), D.get('v_vl', pd.Series(dtype=float))]).dropna()
            o['vl_med'] = q(vl, 50)
            for side in ('k', 'v'):
                c = D.get(side + '_spd')
                if c is not None: o[side + '_spd'] = {x: round((c.dropna() == x).mean(), 3) for x in ('stood', 'stopped', 'slow', 'moving')}
            if 'k_react' in D:
                rc = pd.concat([D.k_react, D.get('v_react', pd.Series(dtype=float))])
                ok = rc.dropna(); ok = ok[ok >= 0]
                o['react_n'] = int(len(ok)); o['react_med_s'] = q(ok / 64, 50); o['react_q'] = [q(ok / 64, 25), q(ok / 64, 75)]
                o['react_nosight'] = round(rc.isna().mean(), 3); o['react_censored'] = round((rc == -1).mean(), 3)
            if 'k_geo' in D:
                g = pd.concat([D.k_geo, D.get('v_geo', pd.Series(dtype=object))]).dropna()
                o['geo_clear_at_first_shot'] = round(g.astype(bool).mean(), 3); o['geo_n'] = len(g)
            if nm == 'bot' and 'k_cur' in D:
                cur = pd.concat([D.k_cur, D.get('v_cur', pd.Series(dtype=float))]).dropna(); mx = pd.concat([D.k_mx16, D.get('v_mx16', pd.Series(dtype=float))]).dropna()
                o['cur_med'] = q(cur, 50); o['cur_lt40'] = round((cur < 40).mean(), 3); o['mx16_ge90'] = round((mx >= 90).mean(), 3)
        if len(A):
            o = O['bot_app'] = {'n': len(A), 'dt_med_s': q(A.dt / 64, 50), 'dt_q': [q(A.dt / 64, 25), q(A.dt / 64, 75)], 'fov0': round(1 - A.fov.mean(), 3),
                                'cur_lt40': round((A.cur < 40).mean(), 3), 'cur_med': q(A.cur, 50)}
            if 'geo0' in A:
                o['geo_blocked_at_appear'] = round(1 - A.geo0.dropna().astype(bool).mean(), 3)
                ge = A.geo_early.dropna(); o['geo_early_ge16'] = round((ge >= 16).mean(), 3); o['geo_early_med_s'] = q(ge / 64, 50)
                o['geo_early_mean_s'] = round(float(ge.mean()) / 64, 3)
    json.dump(out, open(os.path.join(OUT, 'shoot_report.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'pro': pro(a[1])
    elif a[0] == 'bots': bots(a[1], a[2])
    else: report()
