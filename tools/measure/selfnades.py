#!/usr/bin/env python3
"""Гранаты «себе» (шаг 10): python3 tools/measure/selfnades.py <папка прогона> [...]
Определения — как у про в tools/lineups.py (self_kind): по месту разрыва и тому, что
бросивший сделал потом (позиции — REC.pos, шаг 16 тиков, отсюда небольшая погрешность):
  flash_exit  — был ближе 300 px к хлопку и за 2 с сдвинулся (≥ 25) и приблизился (≥ 15);
  molly_clear — через 3–10 с сам прошёл ближе 45 px к месту горения;
  smoke_plant — T, плант в 70 px от смока за 18 с после разрыва (кто ставил — не записано).
Считает: по этим определениям — на раунд, у про и у ботов (все гранаты ботов, не только «себе»);
и у ботов — гранаты с причиной «себе: …» (решение selfNadeTick): сколько и сколько подтвердились делом."""
import sys, os, glob, json
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
KIND = {'флешка под выход': 'flash_exit', 'молотов в угол': 'molly_clear', 'смок под плант': 'smoke_plant', 'смок под дефуз': 'smoke_defuse'}

def pro():
    N = pd.read_csv(os.path.join(ROOT, 'data', 'pro', 'pro_nades.csv'), usecols=['side', 'purpose'])
    rounds = sum(len(pd.read_csv(f)) for f in glob.glob(os.path.join(ROOT, 'data', 'demos', '*_round_end.csv.gz')))
    c = N[N.purpose.notna()].groupby(['side', 'purpose']).size()
    return rounds, c

def bots(dirs):
    rows, rounds = [], 0
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(d, 'rec_*.json'))):
            R = json.load(open(f)); rounds += len(R.get('rounds', []))
            P = pd.DataFrame(R.get('pos', []), columns=['tick','id','ct','x','y','alive','f','w','kn'])
            G = {k: g.sort_values('tick') for k, g in P.groupby('id')}
            PL = R.get('plants', [])
            for e in R.get('det', []):
                t, team, typ, x, y, _, who, why = e[:8]
                tr = G.get(who)
                kind = ''
                if tr is not None:
                    if typ == 'flash':
                        p0 = tr[tr.tick <= t].tail(1)
                        w = tr[(tr.tick > t) & (tr.tick <= t + 128)]
                        if len(p0) and len(w):
                            x0, y0 = p0.x.iloc[0], p0.y.iloc[0]; d0 = np.hypot(x0-x, y0-y)
                            if d0 < 300 and np.hypot(w.x-x0, w.y-y0).max() >= 25 and d0 - np.hypot(w.x-x, w.y-y).min() >= 15:
                                kind = 'flash_exit'
                    elif typ == 'molly':
                        w = tr[(tr.tick >= t + 192) & (tr.tick <= t + 640)]
                        if len(w) and np.hypot(w.x-x, w.y-y).min() < 45: kind = 'molly_clear'
                    elif typ == 'smoke' and team == 'T':
                        if any(t <= p[0] <= t + 18*64 and np.hypot(p[2]-x, p[3]-y) < 70 for p in PL): kind = 'smoke_plant'
                self_k = next((v for k, v in KIND.items() if str(why).startswith('себе: ' + k)), None)
                rows.append(dict(side=team, type=typ, kind=kind, self_k=self_k))
    return rounds, pd.DataFrame(rows)

if __name__ == '__main__':
    pr, pc = pro()
    br, B = bots(sys.argv[1:])
    print(f'раундов: про {pr}, боты {br}')
    print('по определению про, на раунд (сторона: про / боты):')
    for (side, k), n in pc.items():
        b = len(B[(B.side == side) & (B.kind == k)]) if len(B) else 0
        print(f'  {side} {k}: {n/pr:.3f} / {b/max(1,br):.3f}')
    S = B[B.self_k.notna()] if len(B) else B
    print(f'решения «себе» ботов: {len(S)} ({len(S)/max(1,br):.2f} на раунд)')
    for k, g in (S.groupby('self_k') if len(S) else []):
        ok = (g.kind == k).mean()*100 if k != 'smoke_defuse' else float('nan')
        print(f'  {k}: {len(g)}, подтвердилось делом {ok:.0f}%')
