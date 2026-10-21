#!/usr/bin/env python3
"""(Б4) Каждый выстрел у про и у ботов — одно определение. Запуск через b2_shoot.py:
  b2_shoot.py shots pro <карта>                → runs/b2/<карта>_pro_shots.pkl  (data/demos…: weapon_fire_full + player_hurt, выгрузка ПК)
  b2_shoot.py shots bots <карта> <папка>       → runs/b2/<карта>_bots_shots.pkl (прогон со сторожем know_watch: shots + know.hit)
  b2_shoot.py shots report [метка=папка …]     → таблицы (runs/b2/shots_report.json)
Выстрел — из огнестрела (винтовка, снайперка, пистолет, ПП; дробовики и пулемёты — нет). Цель выстрела — враг (живой), на которого
смотрит стрелок: отклонение взгляда от направления на него ≤ max(5°, atan(80 / дист.)) (80 ед. — полтела плюс ошибка позиции при
пробах раз в 16 тиков); у ботов цель — та, в которую стреляли. Выстрелы без цели в этом конусе не считаются.
Попадание — урон пулей от этого стрелка в тот же тик (у про — player_hurt, тики t…t+2, каждое событие урона — к одному выстрелу;
у ботов — know.hit). Голова — hitgroup head (у про) / хэдшот (у ботов).
Скорость в момент выстрела — у про velocity_X/Y из события выстрела (точная), у ботов curSpeed. Доля от максимальной скорости
оружия (числа игры CS2, MAXSPD); «точная» скорость — ≤ 34 % максимальной (в CS2 ниже неё разброс как стоя).
Очередь — выстрелы одного игрока из одного оружия с промежутками ≤ 32 тиков (0,5 с)."""
import os, glob, gzip, json, math, pickle, collections
import numpy as np, pandas as pd
import b2_shoot
from b2_shoot import OUT, ROOT, wcls, Track, load_rec, mapdir

# максимальная скорость оружия в CS2, ед./с (числа игры)
MAXSPD = {'ak47': 215, 'm4a1': 225, 'm4a1_silencer': 225, 'galilar': 215, 'famas': 220, 'aug': 220, 'sg556': 210, 'awp': 200,
          'ssg08': 230, 'g3sg1': 215, 'scar20': 215, 'deagle': 230, 'usp_silencer': 240, 'glock': 240, 'hkp2000': 240, 'p250': 240,
          'tec9': 240, 'fiveseven': 240, 'elite': 240, 'cz75a': 240, 'revolver': 220, 'mp9': 240, 'mac10': 240, 'mp7': 220,
          'ump45': 230, 'p90': 230, 'bizon': 240, 'mp5sd': 235}
BOTKEY = {'AK': 'ak47', 'M4': 'm4a1', 'M4S': 'm4a1_silencer', 'GALIL': 'galilar', 'FAMAS': 'famas', 'AUG': 'aug', 'SG': 'sg556',
          'AWP': 'awp', 'SSG': 'ssg08', 'DEAGLE': 'deagle', 'GLOCK': 'glock', 'USP': 'usp_silencer', 'P250': 'p250', 'TEC9': 'tec9',
          'FIVE7': 'fiveseven', 'CZ': 'cz75a', 'DUALS': 'elite', 'R8': 'revolver', 'MAC10': 'mac10', 'MP9': 'mp9', 'MP7': 'mp7',
          'UMP': 'ump45', 'P90': 'p90'}
ACC_FRAC = 0.34
DB = ((0, 500), (500, 1000), (1000, 1500), (1500, 99999))
def wname(w): w = str(w); return w[7:] if w.startswith('weapon_') else w

def vel(tr, t):
    """скорость по позициям раз в 16 тиков (у про и у ботов одинаково): (pos(t+8) − pos(t−8)) / 16 тиков, ед./с"""
    a, b = tr.pos(t - 8), tr.pos(t + 8)
    if a is None or b is None: return None
    return (b[0] - a[0]) * 4.0, (b[1] - a[1]) * 4.0
def vrel(trS, trT, t, sx, sy, tx, ty):
    """относительная скорость цели поперёк линии огня, ед./с (цель минус стрелок) — то, что надо «вести» прицелом"""
    a, b = vel(trS, t), vel(trT, t)
    if a is None or b is None: return None
    L = math.hypot(tx - sx, ty - sy) or 1.0; nx, ny = -(ty - sy) / L, (tx - sx) / L
    return abs((b[0] - a[0]) * nx + (b[1] - a[1]) * ny)
def bursts(rows):
    """rows: список dict одного стрелка по времени → номер в очереди (0…) и номер очереди"""
    last, lw, k, bid = -10**9, None, 0, 0
    for r in rows:
        if r['t'] - last > 32 or r['w'] != lw: k = 0; bid += 1
        r['k'] = k; r['bid'] = bid; k += 1; last = r['t']; lw = r['w']

def shots_pro(mp, lim=None):
    D = os.path.join(ROOT, 'data', 'demos') if mp == 'ancient' else os.path.join(ROOT, 'data', 'maps', mp, 'demos')
    out = []
    files = sorted(glob.glob(os.path.join(D, f'*-{mp}*_weapon_fire_full.csv.gz')))[:lim]
    geo = mp == 'mirage'
    if geo: b2_shoot.world(mp)
    VC = {}
    for n, ff in enumerate(files):
        base = ff[:-len('_weapon_fire_full.csv.gz')]
        try:
            F = pd.read_csv(ff); H = pd.read_csv(base + '_player_hurt.csv.gz')
            Tk = pd.read_csv(base + '_ticks.csv.gz', usecols=['tick', 'steamid', 'X', 'Y', 'Z', 'yaw', 'is_alive', 'team_num'])
        except Exception as ex:
            print('пропуск', base, ex); continue
        F = F[F.weapon.map(lambda w: wcls(w) in ('rifle', 'sniper', 'pistol', 'smg'))].sort_values('tick')
        H = H[H.weapon.map(lambda w: wcls(w) in ('rifle', 'sniper', 'pistol', 'smg'))]
        ids = np.array(sorted(int(s) for s in Tk.steamid.unique()))
        def sid(x):   # steamid атакующего в CSV — с потерей точности (float): ближайший настоящий
            if x != x: return None
            i = int(np.abs(ids.astype(float) - float(x)).argmin()); return int(ids[i]) if abs(float(ids[i]) - float(x)) < 1e3 else None
        TR, TEAM, ALIVE = {}, {}, {}
        for s, g in Tk.groupby('steamid'):
            g = g.sort_values('tick'); s = int(s)
            TR[s] = Track(g.tick.values, g.X.values, g.Y.values, g.Z.values, g.yaw.values); TEAM[s] = g.team_num.values; ALIVE[s] = g.is_alive.values
        HU = collections.defaultdict(list)
        for r in H.itertuples():
            a = sid(r.attacker_steamid)
            if a is None or r.attacker_team_num == r.user_team_num: continue
            HU[a].append([int(r.tick), r.hitgroup == 'head', False])
        rows = collections.defaultdict(list)
        for r in F.itertuples():
            s = int(r.user_steamid); t = int(r.tick)
            if s not in TR: continue
            best, bd, dist = None, 1e9, None
            for o, tr in TR.items():
                if o == s: continue
                j = tr.le(t)
                if j is None or not ALIVE[o][j] or TEAM[o][j] == r.user_team_num: continue
                p = tr.pos(t)
                if p is None: continue
                d = math.hypot(p[0] - r.user_X, p[1] - r.user_Y)
                br = math.degrees(math.atan2(p[1] - r.user_Y, p[0] - r.user_X)); dd = abs((r.user_yaw - br + 180) % 360 - 180)
                if dd <= max(5.0, math.degrees(math.atan2(80, max(d, 1)))) and dd < bd: best, bd, dist = o, dd, d
            v = math.hypot(r.user_velocity_X, r.user_velocity_Y); w = wname(r.weapon)
            hit = head = False
            for h in HU.get(s, []):
                if not h[2] and t <= h[0] <= t + 2: h[2] = True; hit = True; head = h[1]; break
            vis = None; vr = None
            if best is not None:
                p = TR[best].pos(t); vr = vrel(TR[s], TR[best], t, r.user_X, r.user_Y, p[0], p[1])
            if geo and best is not None:   # (Mirage) цель видна по геометрии игры из глаз стрелка в момент выстрела
                k = (s, best, t // 8)
                if k not in VC:
                    j = TR[best].le(t); p = TR[best].pos(t)
                    VC[k] = b2_shoot.geo_clear((r.user_X, r.user_Y, r.user_Z), (p[0], p[1], TR[best].Z[j]),
                                               eyes=((46.0,) if getattr(r, 'user_ducking', False) else (64.0,)))
                vis = VC[k]
            rows[s].append(dict(t=t, w=w, cls=wcls(w), v=v, vis=vis, vr=vr, f=v / MAXSPD.get(w, 240), tg=best, dist=dist, hit=hit, head=head,
                                ap=getattr(r, 'user_accuracy_penalty', None), duck=bool(getattr(r, 'user_ducking', False)),
                                scoped=bool(getattr(r, 'user_is_scoped', False)), walk=bool(getattr(r, 'user_is_walking', False))))
        for s, L in rows.items():
            bursts(L)
            for x in L: x['who'] = s; x['demo'] = n
            out += L
        print(f'{n+1}/{len(files)} {os.path.basename(base)} выстрелов {len(out)}', flush=True)
    pickle.dump(out, open(os.path.join(OUT, f'{mp}_pro_shots.pkl'), 'wb'))

def shots_bots(mp, run, tag='bots'):
    R0 = mapdir.radar(mp); s = R0['scale'] / 2.0
    out = []
    for f in sorted(glob.glob(os.path.join(run, 'rec_*.json*'))):
        R = load_rec(f); m = int(os.path.basename(f).split('_')[1].split('.')[0]); KW = R.get('know') or {}
        HU = collections.defaultdict(list)
        for h in KW.get('hit', []): HU[(h[0], h[1])].append(h)
        gx = lambda x: x * s + R0['pos_x']; gy = lambda y: R0['pos_y'] - y * s
        P = collections.defaultdict(list)
        for q in R['pos']:
            if q[5]: P[q[1]].append((q[0], gx(q[3]), gy(q[4])))
        TR = {i: Track([p[0] for p in L], [p[1] for p in L], [p[2] for p in L], [0]*len(L), [0]*len(L)) for i, L in P.items() if len(L) > 2}
        rows = collections.defaultdict(list)
        for x in R.get('shots', []):
            t, i, wk, dist, tg, cur = x[0], x[1], x[3], x[4], x[5], x[7]
            w = BOTKEY.get(wk, str(wk).lower())
            if wcls(wk) not in ('rifle', 'sniper', 'pistol', 'smg'): continue
            hs = HU.get((t, i), [])
            hit = bool(hs); head = bool(hs and hs[0][4])
            v = cur * s; vr = None
            if i in TR and tg in TR:
                a, b = TR[i].pos(t), TR[tg].pos(t)
                if a is not None and b is not None: vr = vrel(TR[i], TR[tg], t, a[0], a[1], b[0], b[1])
            rows[i].append(dict(t=t, w=w, cls=wcls(wk), v=v, vr=vr, vis=True, f=v / MAXSPD.get(w, 240), tg=tg, dist=dist * s, hit=hit, head=head,
                                smoke=bool(x[8]), m=m))
        for i, L in rows.items():
            bursts(L)
            for q in L: q['who'] = i
            out += L
    pickle.dump(out, open(os.path.join(OUT, f'{mp}_{tag}_shots.pkl'), 'wb'))
    print(mp, tag, 'выстрелов', len(out))

def band(f): return 'acc' if f <= ACC_FRAC else ('mid' if f <= 0.6 else ('fast' if f <= 0.9 else 'run'))
def r3(x): return None if x is None or x != x else round(float(x), 3)
def table(S):
    S = S[S.tg.notna()].copy(); o = {'shots': len(S)}
    S['db'] = pd.cut(S.dist, [b[0] for b in DB] + [DB[-1][1]], right=False, labels=['%d-%d' % b for b in DB])
    S['sb'] = S.f.map(band)
    o['acc'] = r3(S.hit.mean()); o['head_of_hits'] = r3(S[S.hit]['head'].mean())
    o['acc_cls_dist'] = {c: {str(d): [int(len(g)), r3(g.hit.mean())] for d, g in S[S.cls == c].groupby('db', observed=True)} for c in ('rifle', 'pistol', 'smg', 'sniper')}
    o['head_cls_dist'] = {c: {str(d): [int(g.hit.sum()), r3(g[g.hit]['head'].mean())] for d, g in S[S.cls == c].groupby('db', observed=True)} for c in ('rifle', 'pistol', 'smg', 'sniper')}
    V = S[S.vis == True] if 'vis' in S else S.iloc[0:0]
    o['acc_vis_rifle'] = {str(d): [int(len(g)), r3(g.hit.mean())] for d, g in V[V.cls == 'rifle'].groupby('db', observed=True)}
    o['head_vis'] = {c: r3(V[(V.cls == c) & V.hit]['head'].mean()) for c in ('rifle', 'pistol', 'smg', 'sniper')}
    o['acc_vis_vr'] = {str(b): r3(g.hit.mean()) for b, g in V[V.cls == 'rifle'].groupby(pd.cut(V[V.cls == 'rifle'].vr, [-1, 50, 120, 200, 9999]), observed=True)} if 'vr' in V else {}
    o['acc_first_by_dist'] = {str(d): r3(g.hit.mean()) for d, g in S[(S.k == 0) & (S.cls == 'rifle')].groupby('db', observed=True)}
    o['acc_by_k_rifle'] = {k: r3(S[(S.cls == 'rifle') & (S.k == k)].hit.mean()) for k in (0, 1, 2, 3, 5, 9)}
    # скорость в момент выстрела
    o['spd_all'] = {b: r3((S.sb == b).mean()) for b in ('acc', 'mid', 'fast', 'run')}
    F0 = S[S.k == 0]
    o['spd_first'] = {b: r3((F0.sb == b).mean()) for b in ('acc', 'mid', 'fast', 'run')}
    o['spd_first_cls'] = {c: {b: r3((F0[F0.cls == c].sb == b).mean()) for b in ('acc', 'mid', 'fast', 'run')} for c in ('rifle', 'pistol', 'smg')}
    o['v_first_med'] = r3(F0.v.median()); o['v_first_q'] = [r3(F0.v.quantile(.25)), r3(F0.v.quantile(.75))]
    o['acc_by_spd_rifle'] = {b: [int(len(g)), r3(g.hit.mean())] for b, g in S[S.cls == 'rifle'].groupby('sb')}
    o['acc_by_spd_pistol'] = {b: [int(len(g)), r3(g.hit.mean())] for b, g in S[S.cls == 'pistol'].groupby('sb')}
    # очереди: начатые в движении (> 34 %) — на каком выстреле скорость стала «точной»
    B = S.groupby(['who', 'bid'] + (['demo'] if 'demo' in S else ['m']))
    first = B.f.first(); nb = B.size()
    mv = first[first > ACC_FRAC].index
    acc_at = []
    for key in mv:
        g = B.get_group(key)
        ks = g[g.f <= ACC_FRAC].k
        acc_at.append(int(ks.min()) if len(ks) else None)
    a = pd.Series(acc_at, dtype=float)
    o['bursts'] = int(len(first)); o['burst_len_med'] = r3(nb.median()); o['burst_moving_first'] = r3((first > ACC_FRAC).mean())
    o['moving_burst_stop_at'] = {'1': r3((a == 1).mean()), '2': r3((a == 2).mean()), '3+': r3((a >= 3).mean()), 'never': r3(a.isna().mean())}
    o['v_by_k'] = {k: r3(S[S.k == k].v.median()) for k in range(6)}
    if 'ap' in S and S.ap.notna().any():
        # штраф точности игры у первого выстрела очереди (без отдачи) — по оружию и скорости
        o['ap_first'] = {w: {b: [int(len(g)), r3(g.ap.median())] for b, g in F0[F0.w == w].groupby('sb')} for w in ('ak47', 'm4a1_silencer', 'm4a1', 'galilar', 'awp', 'glock', 'usp_silencer', 'deagle', 'mac10', 'mp9')}
        o['ap_by_k_ak'] = {k: r3(S[(S.w == 'ak47') & (S.k == k) & (S.sb == 'acc')].ap.median()) for k in range(8)}
        o['duck_first'] = r3(F0.duck.mean()); o['walk_first'] = r3(F0.walk.mean())
    return o

def shots_report(extra):
    out = {}
    for mp in ('ancient', 'mirage'):
        fp = os.path.join(OUT, f'{mp}_pro_shots.pkl')
        if os.path.exists(fp): out.setdefault(mp, {})['pro'] = table(pd.DataFrame(pickle.load(open(fp, 'rb'))))
        for tag in ['bots'] + [e for e in extra]:
            fb = os.path.join(OUT, f'{mp}_{tag}_shots.pkl')
            if os.path.exists(fb): out.setdefault(mp, {})[tag] = table(pd.DataFrame(pickle.load(open(fb, 'rb'))))
    json.dump(out, open(os.path.join(OUT, 'shots_report.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))
