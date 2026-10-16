"""Сравнение с про по раскладам (v373, этап 1 плана владельца 16.10): без списка ситуаций. Любой момент раунда у про (демки)
и у ботов (замер measure.py) описывается одинаковыми общими признаками; программа сама перебирает все сочетания, где у про
достаточно примеров, и показывает, где боты делают другое.
Признаки момента (у каждого живого игрока, раз в 0,25 с):
  сторона; фаза (до планта / после); сколько живых своих и врагов (перевес: меньше / поровну / +1 / +2 и больше; один ли он);
  время (до планта — секунда раунда; после — сколько до взрыва); HP; расстояние до цели (до планта — ближайший сайт,
  после — бомба)
Что делает (по следующим секундам): двигается (за 1 с сдвинулся > 25 px радара); идёт к цели (за 3 с ближе к цели на > 30 px);
бросил гранату за 5 с (у про — разрыв через 1–6 с); погиб за 5 с.
Отчёт: строки, где доля у ботов отличается от про больше порога (при n про ≥ MIN_PRO и n ботов ≥ MIN_BOT), с моментами ботов
(матч, тик, бот) для проверки. Запуск: python3 tools/measure/situations.py --map mirage <метка замера> [--out=файл.json]"""
import sys, os, json, glob, collections
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.dirname(HERE); ROOT = os.path.dirname(TOOLS)
sys.path.insert(0, TOOLS)
from demos import MAPNAME, DEMOS, demo_names, rounds_of, event  # noqa: E402
import mapdir  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
RUN = args[0]
MIN_PRO, MIN_BOT = 300, 80          # проектные числа: меньше примеров — разницу не показываем
DIFF = 0.15                         # проектное число: разница долей, которую показываем
STEP = 16                           # тиков между моментами (как в демках)

Z = json.load(open(mapdir.path(MAPNAME, 'zones.json'), encoding='utf-8'))['zonemap']['points']
SITES = {}
for p in Z:
    k = p['name'].split('_')[0]
    if k in ('Asite', 'Bsite'): SITES.setdefault(k[0], []).append((p['x'], p['y']))
SITES = {k: (np.mean([q[0] for q in v]), np.mean([q[1] for q in v])) for k, v in SITES.items()}
SX = np.array([v[0] for v in SITES.values()]); SY = np.array([v[1] for v in SITES.values()])


def bucket(side, planted, own, enemy, tsec, bleft, hp, dist):
    d = own - enemy
    adv = 'меньше' if d < 0 else ('поровну' if d == 0 else ('+1' if d == 1 else '+2 и больше'))
    solo = 'один' if own == 1 else ('двое' if own == 2 else '3+')
    if planted: tb = 'до взрыва >25 с' if bleft > 25 else ('15–25 с' if bleft > 15 else ('5–15 с' if bleft > 5 else '<5 с'))
    else: tb = 'раунд 0–20 с' if tsec < 20 else ('20–45 с' if tsec < 45 else ('45–75 с' if tsec < 75 else '75+ с'))
    hb = 'HP<30' if hp < 30 else ('HP 30–70' if hp < 70 else 'HP 70+')
    db = ('у бомбы <150' if dist < 150 else ('бомба 150–400' if dist < 400 else 'бомба 400+')) if planted else \
         ('на сайте <200' if dist < 200 else ('сайт 200–600' if dist < 600 else 'сайт 600+'))
    return (side, 'после планта' if planted else 'до планта', adv, solo, tb, hb, db)


def behave(xs, ys, ts, alive_until, gx, gy, nade_ticks, death_tick):
    """по траектории одного игрока за раунд (шаг STEP): для каждого момента — двигается, идёт к цели, граната, гибель"""
    n = len(ts); out = []
    for i in range(n):
        j1 = i + 4; j3 = i + 12
        mv = np.hypot(xs[j1]-xs[i], ys[j1]-ys[i]) > 25 if j1 < n else None
        ap = None
        if j3 < n:
            d0 = np.hypot(xs[i]-gx[i], ys[i]-gy[i]); d3 = np.hypot(xs[j3]-gx[i], ys[j3]-gy[i]); ap = d0 - d3 > 30
        nd = any(ts[i] < t <= ts[i] + 5*64 for t in nade_ticks)
        dd = death_tick is not None and ts[i] < death_tick <= ts[i] + 5*64
        out.append((mv, ap, nd, dd))
    return out


def collect(samples, side_of, rnd, traj, nades, deaths, hp_of, examples_key=None):
    """traj: {pid: [(tick, x, y)]} за раунд; rnd: {t0, tplant, plantXY}; добавляет в samples[bucket] -> list"""
    t0, tp = rnd['t0'], rnd.get('tplant'); bxy = rnd.get('plantXY')
    alive = {pid: (tr[0][0], tr[-1][0]) for pid, tr in traj.items() if tr}
    for pid, tr in traj.items():
        if len(tr) < 5: continue
        ts = np.array([q[0] for q in tr]); xs = np.array([q[1] for q in tr]); ys = np.array([q[2] for q in tr])
        planted = np.array([tp is not None and t >= tp for t in ts])
        gx = np.where(planted, bxy[0] if bxy else 0, 0.0); gy = np.where(planted, bxy[1] if bxy else 0, 0.0)
        near = np.argmin((xs[:, None]-SX[None, :])**2 + (ys[:, None]-SY[None, :])**2, axis=1)
        gx = np.where(planted, gx, SX[near]); gy = np.where(planted, gy, SY[near])
        beh = behave(xs, ys, ts, None, gx, gy, nades.get(pid, []), deaths.get(pid))
        sd = side_of[pid]
        for i, t in enumerate(ts):
            own = sum(1 for q, (a, b) in alive.items() if side_of[q] == sd and a <= t <= b)
            en = sum(1 for q, (a, b) in alive.items() if side_of[q] != sd and a <= t <= b)
            if own == 0 or en == 0: continue
            hp = hp_of(pid, t)
            bl = (40 - (t - tp)/64) if planted[i] else 0
            key = bucket(sd, planted[i], own, en, (t - t0)/64, bl, hp, np.hypot(xs[i]-gx[i], ys[i]-gy[i]))
            samples[key].append(beh[i] + ((examples_key, int(t), pid) if examples_key is not None else (None, None, None),))


def pro_samples():
    S = collections.defaultdict(list)
    for demo in demo_names()[:int(opt.get('demos', 9999))]:
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'is_alive', 'is_warmup_period', 'health'], low_memory=False)
        t = t[(t.is_alive == True) & (t.is_warmup_period != True)]  # noqa: E712
        tr_ = mapdir.game_to_map(MAPNAME); x, y = tr_(t.X.values, t.Y.values)
        t = t.assign(x=x, y=y)
        de = event(demo, 'player_death'); ev = []
        for k in ('smokegrenade_detonate', 'flashbang_detonate', 'hegrenade_detonate', 'inferno_startburn'):
            e = event(demo, k)
            if len(e) and 'user_steamid' in e: ev.append(e[['tick', 'user_steamid']])
        ev = pd.concat(ev) if ev else pd.DataFrame(columns=['tick', 'user_steamid'])
        for r in rounds_of(demo):
            if r['num'] >= 24: continue
            w = t[(t.tick >= r['t0']) & (t.tick < r['t1'])]
            if not len(w): continue
            side_of = {int(s): ('CT' if g == 3 else 'T') for s, g in zip(w.steamid, w.team_num)}
            traj = {int(s): list(zip(g.tick.values, g.x.values, g.y.values)) for s, g in w.groupby('steamid')}
            hp = {int(s): dict(zip(g.tick.values, g.health.values)) for s, g in w.groupby('steamid')}
            e = ev[(ev.tick >= r['t0']) & (ev.tick < r['t1'] + 64)]
            nades = collections.defaultdict(list)
            for tk, sid in zip(e.tick, e.user_steamid):
                if pd.notna(sid): nades[int(sid)].append(int(tk) - 64)   # разрыв ≈ бросок + 1 с: окно «бросил за 5 с»
            d = de[(de.tick >= r['t0']) & (de.tick < r['t1'])]
            deaths = {int(s): int(tk) for tk, s in zip(d.tick, d.user_steamid) if pd.notna(s)}
            collect(S, side_of, r, traj, nades, deaths, lambda p, tk: hp.get(p, {}).get(tk, 100))
        del t
    return S


def bot_samples():
    S = collections.defaultdict(list)
    for f in sorted(glob.glob(os.path.join(HERE, 'runs', RUN, 'rec_*.json'))):
        d = json.load(open(f)); m = os.path.basename(f)[4:-5]
        R = d['rounds']
        pos = collections.defaultdict(list); side_of = {}
        for p in d['pos']:
            side_of[p[1]] = 'CT' if p[2] else 'T'
            if p[5]: pos[p[1]].append((p[0], p[3], p[4]))
        hp = {}
        for h in d.get('hp', []): hp[(h[1], h[0])] = h[2]
        for i, r in enumerate(R):
            t1 = r.get('t1') or (R[i+1]['t0'] if i+1 < len(R) else 1e12)
            pl = next((p for p in d['plants'] if r['t0'] <= p[0] < t1), None)
            rnd = {'t0': r['t0'], 'tplant': pl[0] if pl else None, 'plantXY': (pl[2], pl[3]) if pl else None}
            traj = {pid: [q for q in v if r['t0'] <= q[0] < t1 and q[0] % STEP == 0] for pid, v in pos.items()}
            nades = collections.defaultdict(list)
            for n in d['nades']:
                if r['t0'] <= n[0] < t1: nades[n[3]].append(n[0])
            deaths = {k[5]: k[0] for k in d['kills'] if r['t0'] <= k[0] < t1}
            collect(S, side_of, rnd, traj, nades, deaths, lambda p, tk: hp.get((p, tk), 100), examples_key=m)
    return S


def share(rows, k):
    v = [r[k] for r in rows if r[k] is not None]
    return (sum(v) / len(v), len(v)) if v else (None, 0)


P = pro_samples(); B = bot_samples()
NAMES = ['двигается', 'идёт к цели', 'граната за 5 с', 'гибнет за 5 с']
rows = []
for key, pr in P.items():
    br = B.get(key, [])
    if len(pr) < MIN_PRO or len(br) < MIN_BOT: continue
    for k, nm in enumerate(NAMES):
        sp, np_ = share(pr, k); sb, nb = share(br, k)
        if sp is None or sb is None or np_ < MIN_PRO or nb < MIN_BOT: continue
        if abs(sb - sp) >= DIFF or (k == 2 and abs(sb - sp) >= 0.05 and (sb < sp/2 or sb > sp*2)):
            ex = [r[4] for r in br if r[k] is not None and r[k] != (sp > sb)][:3]
            rows.append({'расклад': ' · '.join(key), 'что': nm, 'про': round(sp, 2), 'боты': round(sb, 2), 'n про': np_, 'n боты': nb,
                         'моменты ботов (матч, тик, бот)': ex})
rows.sort(key=lambda r: -abs(r['боты'] - r['про']) * min(r['n боты'], 600))
cover_p = sum(len(v) for k, v in P.items() if len(v) >= MIN_PRO and len(B.get(k, [])) >= MIN_BOT)
summary = {'карта': MAPNAME, 'замер': RUN, 'раскладов у про': len(P), 'сравнимо': sum(1 for k, v in P.items() if len(v) >= MIN_PRO and len(B.get(k, [])) >= MIN_BOT),
           'доля моментов про в сравнимых': round(cover_p / max(1, sum(len(v) for v in P.values())), 2), 'расхождений': len(rows)}
out = {'итог': summary, 'расхождения': rows}
if 'out' in opt: json.dump(out, open(opt['out'], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False))
for r in rows[:25]:
    print('%-95s %-14s про %.2f  боты %.2f  (n %d / %d)' % (r['расклад'][:95], r['что'], r['про'], r['боты'], r['n про'], r['n боты']))
