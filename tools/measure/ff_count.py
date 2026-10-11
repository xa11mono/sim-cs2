#!/usr/bin/env python3
"""(v263, Б1) Убийства своих в прогоне: python3 tools/measure/ff_count.py tools/measure/runs/<метка>
Читает rec_*.json (kills: [tick, att, attTeam, ax, ay, vic, vicTeam, vx, vy, weap, hs, ...])."""
import sys, json, glob, collections
d = sys.argv[1]
n = tk = deaths = 0; w = collections.Counter(); rounds = 0
for f in sorted(glob.glob(d + '/rec_*.json')):
    try: R = json.load(open(f))
    except ValueError: continue   # матч ещё играется
    n += 1; rounds += len(R['rounds'])
    for k in R['kills']:
        deaths += 1
        if k[1] and k[2] == k[6]:
            tk += 1; w[k[9]] += 1
print(f'матчей {n}, раундов {rounds}, смертей {deaths}, убито своими {tk} '
      f'({tk/max(1,n):.2f} за матч, {100*tk/max(1,deaths):.2f} % смертей), чем: {dict(w)}')
print('у про (88 демок Ancient): 0,37 за матч, 0,25 % смертей; 30 пулями, 2 HE, 1 молотовом')
