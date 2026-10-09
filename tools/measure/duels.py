#!/usr/bin/env python3
"""Дуэли (к С1, шаг 9): кто первым стреляет в перестрелках — у про и у ботов, одно определение.
python3 tools/measure/duels.py pro                 — по data/demos (кэш в results/duels_pro.pkl)
python3 tools/measure/duels.py <папка прогона> …   — по rec_*.json (запись rec2.js)

Дуэль — смерть от огнестрела, где и убийца, и погибший стреляли друг в друга за 2 с до неё
(у про «в друг друга» = выстрел, направленный на соперника с точностью 25°).
Начало дуэли — первый из этих выстрелов. «Стоял» — скорость в начале < 35% бега
(про: < 80 u/s, боты: < 32 px/с), скорость — по позициям с шагом 16 тиков.
Считает: % дуэлей, где выиграл выстреливший первым; среди дуэлей «стоял против шёл» —
% где первым выстрелил стоявший и % где он выиграл; у ботов — разбивка по источнику
готовности первого стрелявшего (поле 9 записи стрельбы, с v209)."""
import sys, os, glob, json, math, pickle
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
WIN = 128
GUNS_BOT = {'AK','M4','M4S','GALIL','FAMAS','AUG','SG','AWP','SSG','DEAGLE','GLOCK','USP','P250','TEC9','FIVE7',
            'MAC10','MP9','MP7','UMP','P90','CZ','DUALS','R8','NOVA','XM','MAG7','SAWED','NEGEV','M249'}
NOT_GUN = ('grenade', 'flashbang', 'molotov', 'incgrenade', 'decoy', 'knife', 'c4', 'taser', 'bayonet', 'inferno', 'hegrenade', 'world')

def gun_pro(w):
    w = str(w).lower(); return w != 'nan' and not any(k in w for k in NOT_GUN)

def summarize(D, tag):
    """D: список dict(kf=убийца первым, still_k, still_v, src_first)"""
    if not D: return f'{tag}: дуэлей нет'
    df = pd.DataFrame(D); n = len(df)
    L = [f'{tag}: дуэлей {n}; выиграл выстреливший первым — {df.kf.mean()*100:.1f}%']
    m = df[df.still_k != df.still_v]
    if len(m):
        # стоявший — тот, у кого still=True
        st_first = np.where(m.still_k, m.kf, ~m.kf)
        st_won = m.still_k
        L.append(f'  стоял против шёл: {len(m)} дуэлей; первым выстрелил стоявший {st_first.mean()*100:.1f}%, '
                 f'выиграл стоявший {st_won.mean()*100:.1f}%')
    if 'src' in df and df.src.notna().any():
        for s, g in df[df.src.notna()].groupby('src'):
            L.append(f'  первый выстрел с готовностью «{s}»: {len(g)} дуэлей ({len(g)/n*100:.0f}%), он же выиграл {g.kf.mean()*100:.0f}%')
    return '\n'.join(L)

# ---------- боты ----------
def bots(dirs):
    D = []
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(d, 'rec_*.json'))):
            R = json.load(open(f))
            S = pd.DataFrame([s[:10] + [None]*(10-len(s[:10])) for s in R.get('shots', [])],
                             columns=['tick','id','team','w','d','tg','cs','spd','smoke','src'])
            P = pd.DataFrame(R.get('pos', []), columns=['tick','id','ct','x','y','alive','f','w','kn'])
            P = P.set_index(['id','tick']).sort_index()
            def speed(pid, t):
                t0 = int(t)//16*16
                try: a = P.loc[(pid, t0)]; b = P.loc[(pid, t0-16)]
                except KeyError: return None
                return math.hypot(a.x-b.x, a.y-b.y)*4
            for k in R.get('kills', []):
                T, att, vic, wk = k[0], k[1], k[5], k[11]
                if not att or att == vic or k[2] == k[6] or str(wk).upper() not in GUNS_BOT: continue
                sk = S[(S.id == att) & (S.tg == vic) & (S.tick >= T-WIN) & (S.tick <= T)]
                sv = S[(S.id == vic) & (S.tg == att) & (S.tick >= T-WIN) & (S.tick <= T)]
                if not len(sk) or not len(sv): continue
                fk, fv = sk.tick.min(), sv.tick.min()
                if fk == fv: continue
                t0 = min(fk, fv); vk, vv = speed(att, t0), speed(vic, t0)
                if vk is None or vv is None: continue
                first = sk.iloc[0] if fk < fv else sv.iloc[0]
                D.append(dict(kf=fk < fv, still_k=vk < 32, still_v=vv < 32, src=first.src, first_is_k=fk < fv))
    return D

# ---------- про ----------
def pro():
    cache = os.path.join(HERE, 'results', 'duels_pro.pkl')
    if os.path.exists(cache): return pickle.load(open(cache, 'rb'))
    D = []
    for fd in sorted(glob.glob(os.path.join(ROOT, 'data', 'demos', '*_player_death.csv.gz'))):
        base = fd[:-len('_player_death.csv.gz')]
        try:
            K = pd.read_csv(fd); F = pd.read_csv(base + '_weapon_fire.csv.gz')
            Tk = pd.read_csv(base + '_ticks.csv.gz', usecols=['tick','steamid','X','Y'])
        except Exception: continue
        F = F[F.weapon.map(gun_pro)]
        K = K[K.weapon.map(gun_pro) & K.attacker_steamid.notna()]
        Tk = Tk.set_index(['steamid','tick']).sort_index()
        def speed(sid, t):
            t0 = int(t)//16*16
            try: a = Tk.loc[(sid, t0)]; b = Tk.loc[(sid, t0-16)]
            except KeyError: return None
            if isinstance(a, pd.DataFrame): a = a.iloc[0]
            if isinstance(b, pd.DataFrame): b = b.iloc[0]
            return math.hypot(a.X-b.X, a.Y-b.Y)*4
        def aimed(sh, ox, oy):
            br = np.degrees(np.arctan2(oy-sh.user_Y, ox-sh.user_X))
            dd = (sh.user_yaw - br + 180) % 360 - 180
            return sh[np.abs(dd) < 25]
        for _, k in K.iterrows():
            a, v, T = int(k.attacker_steamid), int(k.user_steamid), k.tick
            if a == v or k.attacker_team_num == k.user_team_num: continue
            fa = aimed(F[(F.user_steamid == a) & (F.tick >= T-WIN) & (F.tick <= T)], k.user_X, k.user_Y)
            fv = aimed(F[(F.user_steamid == v) & (F.tick >= T-WIN) & (F.tick <= T)], k.attacker_X, k.attacker_Y)
            if not len(fa) or not len(fv): continue
            ta, tv = fa.tick.min(), fv.tick.min()
            if ta == tv: continue
            t0 = min(ta, tv); va, vv = speed(a, t0), speed(v, t0)
            if va is None or vv is None: continue
            D.append(dict(kf=ta < tv, still_k=va < 80, still_v=vv < 80, src=None, first_is_k=ta < tv))
    os.makedirs(os.path.dirname(cache), exist_ok=True); pickle.dump(D, open(cache, 'wb'))
    return D

if __name__ == '__main__':
    a = sys.argv[1:]
    if a == ['pro']: print(summarize(pro(), 'про'))
    else: print(summarize(bots(a), 'боты (' + ', '.join(os.path.basename(x.rstrip('/')) for x in a) + ')'))
