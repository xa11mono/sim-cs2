#!/usr/bin/env python3
"""Этап 3, P1-4 и P2-2 по записи аудита (aud_*.json): заходы своих в свой огонь по причинам и ослепления своей флешкой.
python3 tools/measure/audit/fire_flash.py <метка до> <метка после>"""
import sys, os, json, glob, collections
HERE = os.path.dirname(os.path.abspath(__file__))

def load(lab):
    D = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(HERE, 'runs', lab, 'aud_*.json'))) if os.path.getsize(f) > 100]
    rounds = sum(d['rounds'] for d in D)
    C = collections.Counter(); hp = collections.Counter(); long_ = 0
    for d in D:
        for e in d.get('molEnt', []):
            cause = e[3] or '?'
            C[cause] += 1
    ff = collections.Counter()
    for d in D:
        for f in d.get('ff', []):
            if len(f) > 5 and 'молотов' in str(f): ff[str(f[5]).split(':')[0]] += 1
    BL = [b for d in D for b in d.get('blinds', [])]
    bl = {k: [sum(1 for b in BL if b[2] == k), round(sum(b[3] for b in BL if b[2] == k), 1)] for k in ('mate', 'self', 'enemy')}
    return rounds, C, bl, len(D)

if __name__ == '__main__':
    for lab in sys.argv[1:]:
        r, C, bl, n = load(lab)
        print(f'== {lab}: матчей {n}, раундов {r}')
        print('  заходы своих в свой огонь (по причине), на 100 раундов:')
        for k, v in C.most_common(): print(f'    {k:55} {v:4d}  {100*v/max(1, r):.1f}')
        print('  ослеплено своей флешкой >0,35 с [случаев, секунд]: тиммейты', bl['mate'], ' сам', bl['self'], ' враги', bl['enemy'])
        print(f'    на 100 раундов: тиммейты {100*bl["mate"][0]/max(1, r):.1f} случаев / {100*bl["mate"][1]/max(1, r):.1f} с; враги {100*bl["enemy"][0]/max(1, r):.1f} / {100*bl["enemy"][1]/max(1, r):.1f} с')
