"""Сколько гранат про бросают за раунд (v357): по демкам карты, на команду, по стороне и типу закупа.
Тип закупа — как в buy_pro.py / ct_cmp.py (rtype по оружию в руках за первые 30 с). Броски — события разрыва
(smokegrenade_detonate, flashbang_detonate, hegrenade_detonate, inferno_startburn) по бросившему.
Пишет в набор карты (v373): pro.json → nadesBy {T|CT: {pistol|eco|force|full: {smoke, flash, he, molly}}} — брошено за раунд на команду.
Запуск: python3 tools/nades_pro.py --map mirage [out.json]"""
import sys, os, re, json, collections
import pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from demos import DEMOS, MAPNAME, demo_names, rounds_of  # noqa: E402
import mapdir  # noqa: E402
from ct_cmp import rtype  # noqa: E402
from eco_est import ALIAS, PRICE  # noqa: E402
PIST = {'GLOCK', 'USP', 'P250', 'FIVE7', 'TEC9', 'CZ', 'DEAGLE', 'ELITE', 'R8'}
EV = {'smoke': 'smokegrenade_detonate', 'flash': 'flashbang_detonate', 'he': 'hegrenade_detonate', 'molly': 'inferno_startburn'}
sumN = collections.defaultdict(collections.Counter)
nteam = collections.Counter()
EXEC_SEC = 20   # (v370) «выход»: гранаты T, разорвавшиеся за 20 с до планта (проектное окно)
exN = collections.defaultdict(collections.Counter); nexec = collections.Counter()
for demo in demo_names():
    t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'active_weapon_name', 'is_alive', 'is_warmup_period'], low_memory=False)
    t = t[(t.is_alive == True) & (t.is_warmup_period != True)]  # noqa: E712
    ev = {}
    for k, e in EV.items():
        f = os.path.join(DEMOS, demo + '_' + e + '.csv.gz')
        ev[k] = pd.read_csv(f, usecols=['tick', 'user_steamid']) if os.path.exists(f) else pd.DataFrame(columns=['tick', 'user_steamid'])
    fp = os.path.join(DEMOS, demo + '_bomb_planted.csv.gz')
    pl = pd.read_csv(fp, usecols=['tick']) if os.path.exists(fp) else pd.DataFrame(columns=['tick'])
    for r in rounds_of(demo):
        if r['num'] >= 24: continue
        w = t[(t.tick >= r['t0']) & (t.tick < r['t0'] + 30 * 64)]
        side_of = {}
        for side, g in w.groupby('team_num'):
            sd = 'CT' if side == 3 else 'T'
            best = []
            for sid, gp in g.groupby('steamid'):
                side_of[int(sid)] = sd
                ks = [ALIAS.get(str(x).lower().replace('weapon_', '')) for x in gp.active_weapon_name.unique()]
                pr = [k for k in ks if k and k not in PIST and k in PRICE and k not in ('HE', 'MOLOTOV', 'ZEUS')]
                p1 = max(pr, key=lambda k: PRICE[k]) if pr else None
                best.append(2 if p1 in ('AK', 'M4', 'M4S', 'AWP', 'FAMAS', 'GALIL', 'AUG', 'SG', 'SSG') else (1 if p1 else 0))
            if len(best) < 4: continue
            typ = 'пистолетка' if r['num'] in (0, 12) else rtype(best)
            nteam[(sd, typ)] += 1
            side_of[(sd, 'typ')] = typ
        pt = pl[(pl.tick >= r['t0']) & (pl.tick < r['t1'])].tick
        if len(pt) and ('T', 'typ') in side_of:
            p0 = int(pt.iloc[0]); tt = side_of[('T', 'typ')]; nexec[tt] += 1
            for k, e in ev.items():
                for sid in e[(e.tick >= p0 - EXEC_SEC * 64) & (e.tick <= p0)].user_steamid:
                    if pd.notna(sid) and side_of.get(int(sid)) == 'T': exN[tt][k] += 1
        for k, e in ev.items():
            x = e[(e.tick >= r['t0']) & (e.tick < r['t1'])]
            for sid in x.user_steamid:
                sd = side_of.get(int(sid)) if pd.notna(sid) else None
                if sd and (sd, 'typ') in side_of: sumN[(sd, side_of[(sd, 'typ')])][k] += 1
res = {}
for key, n in sorted(nteam.items()):
    c = sumN[key]
    res[' / '.join(key)] = dict({k: round(c[k] / n, 2) for k in EV}, всего=round(sum(c.values()) / n, 2), раундов=n)
for typ, n in sorted(nexec.items()):
    c = exN[typ]; res['выход T (за %d с до планта) / %s' % (EXEC_SEC, typ)] = dict({k: round(c[k] / n, 2) for k in EV}, всего=round(sum(c.values()) / n, 2), раундов=n)
txt = json.dumps(res, ensure_ascii=False, indent=1)
args = [a for a in sys.argv[1:] if not a.startswith('--') and a != MAPNAME]
if args: open(args[0], 'w').write(txt)
pp = mapdir.path(MAPNAME, 'pro.json'); src = open(pp, encoding='utf-8').read()
RT = {'пистолетка': 'pistol', 'эко': 'eco', 'форс': 'force', 'фулл': 'full'}
line = '"nadesBy": ' + json.dumps({sd: {RT[r]: {k: res[sd + ' / ' + r][k] for k in EV} for r in RT if sd + ' / ' + r in res} for sd in ('T', 'CT')}) + ','
src = re.sub(r'"pistolNades": \{[^\n]*?\}\},\n?', '', src)   # (v373) заменено на nadesBy — все типы раунда
src = re.sub(r'"nadesBy": \{[^\n]*?\}\}\},\n?', '', src)   # своя строка, остальной файл не трогаем
i = src.index('{') + 1; nl = '\n' if src[i:i+1] == '\n' else ''
open(pp, 'w', encoding='utf-8').write(src[:i] + nl + line + '\n' + src[i+len(nl):])
print(txt)
