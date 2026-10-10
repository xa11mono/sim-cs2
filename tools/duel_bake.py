"""Как быстро убивают (v251): по 92 демкам Ancient, до планта.
Для каждого фрага из оружия: сколько выстрелов сделал убийца за 3 с до фрага; сколько прошло от его первого выстрела
в этом окне до фрага (с); стрелял ли жертва в убийцу раньше него (кто начал перестрелку); хэдшот.
Пишет в src/data/trades.json поле duel. Запуск: python3 tools/duel_bake.py"""
import json, os, sys, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ancient_demos import DEMOS, demo_names, rounds_of
NADE = 'grenade|molotov|incgrenade|flashbang|decoy|knife|c4|bayonet|inferno|hegrenade|world'
shots, ttk, first_k, hs, n = [], [], 0, 0, 0
for demo in demo_names():
    rounds = rounds_of(demo)
    d = pd.read_csv(os.path.join(DEMOS, demo + '_player_death.csv.gz'))
    d = d[(d.attacker_team_num != d.user_team_num) & d.attacker_steamid.notna() & ~d.weapon.astype(str).str.contains(NADE, case=False)]
    wf = pd.read_csv(os.path.join(DEMOS, demo + '_weapon_fire.csv.gz'))
    wf = wf[~wf.weapon.astype(str).str.contains(NADE, case=False)]
    F = {s: g.tick.values for s, g in wf.groupby('user_steamid')}
    for tk, a, u, h in zip(d.tick.values, d.attacker_steamid.values, d.user_steamid.values, d.headshot.values):
        r = [q for q in rounds if q['t0'] <= tk <= q['t1']]
        if not r or (r[0]['tplant'] and tk >= r[0]['tplant']): continue
        fa = F.get(a, np.array([])); fa = fa[(fa >= tk - 192) & (fa <= tk)]
        if not len(fa): continue
        n += 1; hs += bool(h); shots.append(len(fa)); ttk.append((tk - fa.min())/64)
        fu = F.get(u, np.array([])); fu = fu[(fu >= tk - 192) & (fu <= tk)]
        if not len(fu) or fa.min() <= fu.min(): first_k += 1
out = {'n': n, 'выстрелов на фраг, медиана': float(np.median(shots)), 'выстрелов на фраг, среднее': float(np.mean(shots)),
       'от первого выстрела до фрага, медиана с': float(np.median(ttk)), 'убийца начал перестрелку %': first_k/n, 'хэдшот %': hs/n}
F2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'trades.json')
J = json.load(open(F2)); J['duel'] = out; json.dump(J, open(F2, 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
