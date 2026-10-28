#!/usr/bin/env python3
"""(док 6) сверка с про по демкам карты: python3 tools/measure/pro_checks.py --map mirage
  1. откуда кидают гранату: где был бросающий за 8 с до броска (сколько прошёл к точке броска);
  4. на какой дистанции убивают CT с ПП и с винтовкой (player_death.distance, ед. игры);
  8. T до выхода: самая длинная стоянка одного игрока (скорость < 25 ед. карты/с) с 5-й с до 60-й с;
  9. ретейк: от смерти последнего T у бомбы (≤ 600 ед. карты) при живых T где-то ещё — до конца дефуза;
 10. гранаты после того, как живых врагов не осталось;
 13. убийства сквозь стену (penetrated > 0)."""
import os, sys, json, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import mapdir  # noqa
import demos as D  # noqa

SMG = {'mac10', 'mp9', 'mp7', 'mp5sd', 'ump45', 'p90', 'bizon'}
RIFLE = {'ak47', 'm4a1', 'm4a1_silencer', 'galilar', 'famas', 'aug', 'sg556'}
out = {}
pn = pd.read_csv(os.path.join(mapdir.pro_dir(mapdir.current()), 'pro_nades.csv'))
travel = collections.defaultdict(list)
kd = collections.defaultdict(list)
stand = []
retake = []
late_nades = collections.Counter(); all_nades = collections.Counter()
pen = collections.Counter()
for demo in D.demo_names():
    R = D.rounds_of(demo)
    if not R: continue
    t = D.ticks_of(demo)
    ri = D.round_index(R, t.tick.values)
    t = t[ri >= 0].assign(ri=ri[ri >= 0])
    dth = D.event(demo, 'player_death')
    # 13, 4
    for r in dth.itertuples():
        w = str(r.weapon)
        if w in SMG | RIFLE or w in ('awp', 'deagle', 'glock', 'usp_silencer', 'hkp2000', 'p250', 'fiveseven', 'tec9'):
            pen['всего'] += 1
            if (r.penetrated or 0) > 0: pen['сквозь'] += 1
        if r.attacker_team_num == 3 and r.attacker_steamid != r.user_steamid:
            if w in SMG: kd['CT ПП'].append(r.distance)
            elif w in RIFLE: kd['CT винтовка'].append(r.distance)
    # 1: гранаты этого демо
    g = pn[pn.m == demo]
    by = {sid: d.sort_values('tick') for sid, d in t.groupby('steamid')}
    for q in g.itertuples():
        rr = [r for r in R if r['rid'] == q.rid]
        if not rr: continue
        r = rr[0]; tt = r['t0'] + int(q.sec * D.TICK); d = by.get(int(q.sid))
        if d is None: continue
        m = d[(d.tick >= tt - 8 * D.TICK - 32) & (d.tick <= tt - 8 * D.TICK + 32)]
        if not len(m): continue
        dist = float(np.hypot(m.x.values[0] - q.fx, m.y.values[0] - q.fy))
        travel['%s %s' % (q.side, q.trig)].append(dist)
    # 8: самая длинная стоянка T с 5 до 60 с (до планта)
    for k, r in enumerate(R):
        tt = t[(t.ri == k) & (t.side == 'T') & (t.tick >= r['t0'] + 5 * D.TICK) & (t.tick <= r['t0'] + 60 * D.TICK)]
        if r['tplant']: tt = tt[tt.tick < r['tplant']]
        for sid, d in tt.groupby('steamid'):
            d = d.sort_values('tick'); x, y, tk = d.x.values, d.y.values, d.tick.values
            if len(tk) < 3: continue
            sp = np.hypot(np.diff(x), np.diff(y)) / np.maximum(np.diff(tk) / D.TICK, 1e-3)
            best = cur = 0.0
            for s, dt in zip(sp, np.diff(tk) / D.TICK):
                cur = cur + dt if s < 25 else 0.0; best = max(best, cur)
            stand.append(best)
    # 9: ретейк
    df = D.event(demo, 'bomb_defused'); pl = D.event(demo, 'bomb_planted')
    for r in R:
        if not r['tplant']: continue
        dd = df[(df.tick > r['tplant']) & (df.tick <= r['t1'] + 64)]
        if not len(dd): continue
        tdef = int(dd.tick.min()); bx, by_ = r['plantXY']
        dr = dth[(dth.tick > r['tplant']) & (dth.tick < tdef) & (dth.user_team_num == 2)]
        if not len(dr): continue
        ux, uy = D.tr(dr.user_X.values.astype(float), dr.user_Y.values.astype(float))
        near = np.hypot(ux - bx, uy - by_) <= 600
        alive_after = 5 - len(dth[(dth.tick <= tdef) & (dth.user_team_num == 2) & (dth.tick >= r['t0'])])
        if near.any() and alive_after > 0:
            retake.append((tdef - int(dr.tick.values[near].max())) / D.TICK)
    side = {(int(a), int(b)): c for (a, b), c in t.groupby(['ri', 'steamid']).side.first().items()}
    # 10: гранаты после того, как врагов не осталось
    for kind in ('smokegrenade_detonate', 'flashbang_detonate', 'hegrenade_detonate', 'inferno_startburn'):
        e = D.event(demo, kind)
        if not len(e): continue
        for q in e.itertuples():
            k = [i for i, r in enumerate(R) if r['t0'] <= q.tick < r['t1']]
            if not k: continue
            r = R[k[0]]; sd = side.get((k[0], int(q.user_steamid)))
            if not sd: continue
            foe = 2 if sd == 'CT' else 3
            dead = dth[(dth.tick >= r['t0']) & (dth.tick <= q.tick) & (dth.user_team_num == foe)].user_steamid.nunique()
            all_nades[kind] += 1
            if dead >= 5: late_nades[kind] += 1
pc = lambda a, p: round(float(np.percentile(a, p)), 1) if len(a) else None
out['1 бросок: где был за 8 с (ед. карты)'] = {k: {'n': len(v), 'медиана': pc(v, 50), '90%': pc(v, 90), 'доля > 500': round(float(np.mean(np.array(v) > 500)), 3)} for k, v in sorted(travel.items())}
out['4 дистанция убийства CT (ед. игры)'] = {k: {'n': len(v), 'медиана': pc(v, 50), '25%': pc(v, 25), '75%': pc(v, 75)} for k, v in kd.items()}
out['8 самая длинная стоянка T 5–60 с (с)'] = {'n': len(stand), 'медиана': pc(stand, 50), '90%': pc(stand, 90), 'доля ≥ 30 с': round(float(np.mean(np.array(stand) >= 30)), 3)}
out['9 от смерти последнего T у бомбы до конца дефуза (с)'] = {'n': len(retake), 'медиана': pc(retake, 50), '25%': pc(retake, 25), '75%': pc(retake, 75)}
out['10 гранаты, когда врагов уже нет'] = {k: '%d из %d' % (late_nades[k], all_nades[k]) for k in all_nades}
out['13 убийства сквозь стену'] = '%d из %d' % (pen['сквозь'], pen['всего'])
print(json.dumps(out, ensure_ascii=False, indent=1))
