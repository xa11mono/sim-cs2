"""Что делает про в первом контакте, один или с тиммейтом (v250, пункт 1 разбора).
Контакт игрока P (до планта): первая стрельба из оружия (не граната) врага E не дальше 700 ед. карты от P, когда P —
ближайший к E враг (по нему и стреляют), или первая стрельба самого P по ближайшему врагу в 700. «Один» — нет своего
ближе TRADE_R = 272 ед. карты (src/data/trades.json, 80 % разменов). Что дальше за 2 с: отошёл (до E стало дальше
на 40+), вышел вперёд (ближе на 40+), держит (иначе); погиб ли за 5 с. Пишет в src/data/trades.json поле contact.
Запуск: python3 tools/contact_bake.py"""
import json, os, sys, math, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from demos import DEMOS, tr, demo_names, rounds_of
R_TRADE, R_CONTACT, MOVE = 272, 700, 40
S = collections.defaultdict(lambda: collections.Counter())
for demo in demo_names():
    rounds = rounds_of(demo)
    t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'is_alive'])
    t = t[t.is_alive == True]
    x, y = tr(t.X.values, t.Y.values)
    T = {}
    for sid, g in pd.DataFrame({'tick': t.tick.values, 'sid': t.steamid.values, 'team': t.team_num.values, 'x': x, 'y': y}).groupby('sid'):
        g = g.sort_values('tick'); T[sid] = (g.tick.values, g.x.values, g.y.values, int(g.team.values[0]))
    def at(sid, tk):
        if sid not in T: return None
        tt, xx, yy, _ = T[sid]; i = np.searchsorted(tt, tk, side='right') - 1
        if i < 0 or tk - tt[i] > 32: return None
        return xx[i], yy[i]
    team = {s: v[3] for s, v in T.items()}
    deaths = collections.defaultdict(list)
    d = pd.read_csv(os.path.join(DEMOS, demo + '_player_death.csv.gz'))
    for tk, us in zip(d.tick.values, d.user_steamid.values):
        if us == us: deaths[int(us)].append(int(tk))
    wf = pd.read_csv(os.path.join(DEMOS, demo + '_weapon_fire.csv.gz'))
    wf = wf[~wf.weapon.astype(str).str.contains('grenade|molotov|incgrenade|flashbang|decoy|knife|c4|bayonet', case=False)]
    done = set()
    for tk, sid in zip(wf.tick.values, wf.user_steamid.values):
        r = [q for q in rounds if q['t0'] <= tk <= q['t1']]
        if not r or (r[0]['tplant'] and tk >= r[0]['tplant']) or sid != sid: continue
        sid = int(sid); r = r[0]
        pe = at(sid, tk)
        if not pe or sid not in team: continue
        foes = []
        for o, tm in team.items():
            if tm == team[sid]: continue
            po = at(o, tk)
            if po: foes.append((math.hypot(po[0]-pe[0], po[1]-pe[1]), o, po))
        if not foes: continue
        dist, P, pp = min(foes)
        if dist > R_CONTACT: continue
        for who, other, pw, po in ((P, sid, pp, pe), (sid, P, pe, pp)):   # контакт и у цели, и у стрелявшего
            key = (r['rid'], who)
            if key in done: continue
            done.add(key)
            mates = [q for q, tm in team.items() if tm == team[who] and q != who and at(q, tk)]
            alone = not any(math.hypot(at(q, tk)[0]-pw[0], at(q, tk)[1]-pw[1]) <= R_TRADE for q in mates)
            p2 = at(who, tk + 128)
            died = any(tk <= dt <= tk + 5*64 for dt in deaths.get(who, []))
            side = 'CT' if team[who] == 3 else 'T'
            k = side + (' один' if alone else ' с тиммейтом')
            S[k]['n'] += 1; S[k]['died'] += died
            if p2:
                d0 = math.hypot(pw[0]-po[0], pw[1]-po[1]); d1 = math.hypot(p2[0]-po[0], p2[1]-po[1])
                S[k]['back' if d1 - d0 > MOVE else 'fwd' if d0 - d1 > MOVE else 'hold'] += 1
    print(demo, dict(S.get('CT один', {})), file=sys.stderr)
out = {k: {'n': v['n'], 'отошёл': v['back']/max(1, v['n']), 'держит': v['hold']/max(1, v['n']), 'вперёд': v['fwd']/max(1, v['n']),
           'погиб за 5 с': v['died']/max(1, v['n'])} for k, v in S.items()}
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'trades.json')
J = json.load(open(F)); J['contact'] = out; json.dump(J, open(F, 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
