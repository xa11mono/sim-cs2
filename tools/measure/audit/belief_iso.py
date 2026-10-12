#!/usr/bin/env python3
"""Этап 3: изоляция влияния карты команды (belief) — сборка 519ebea (до P1-2) против c6ab919 (P1-2: teamAgent) на одинаковых
матчах. Наборы A и B — разные фиксированные матчи. По каждому набору и вместе: доля раундов CT, первая смерть (кто, когда),
смерти до 20 / 45 с, исход раунда при первой смерти T до 20 с. Разброс — бутстреп по матчам (90 % интервал разницы).
python3 tools/measure/audit/belief_iso.py p3_519ebea p3_c6ab919 A B"""
import sys, os, json, glob, random
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
R = os.path.join(ROOT, 'tools', 'measure', 'runs')

def rounds_of(run):
    out = {}
    for f in glob.glob(os.path.join(R, run, 'rec_*.json')):
        d = json.load(open(f)); rs = []
        for r in d['rounds']:
            if 't1' not in r or not r.get('winner'): continue
            ks = sorted(k for k in d['kills'] if r['t0'] <= k[0] <= r['t1'])
            fd = ks[0] if ks else None
            cut = r.get('plant') or r['t1']
            rs.append({'ct': r['winner'] == 'CT', 'fd_side': fd[6] if fd else None, 'fd_t': (fd[0] - r['t0']) / 64 if fd else None,
                       'T20': sum(1 for k in ks if k[6] == 'T' and k[0] - r['t0'] <= 20*64 and k[0] <= cut),
                       'CT20': sum(1 for k in ks if k[6] == 'CT' and k[0] - r['t0'] <= 20*64 and k[0] <= cut),
                       'T45': sum(1 for k in ks if k[6] == 'T' and k[0] - r['t0'] <= 45*64 and k[0] <= cut),
                       'CT45': sum(1 for k in ks if k[6] == 'CT' and k[0] - r['t0'] <= 45*64 and k[0] <= cut)})
        out[d['match']] = rs
    return out

def metr(M):
    rs = [r for m in M for r in m]; n = max(1, len(rs))
    early_T = [r for r in rs if r['fd_side'] == 'T' and r['fd_t'] <= 20]
    return {'раундов': len(rs), 'CT выиграли %': 100*sum(r['ct'] for r in rs)/n,
            'первым погиб T %': 100*sum(r['fd_side'] == 'T' for r in rs)/n,
            'первая смерть, медиана с': sorted(r['fd_t'] for r in rs if r['fd_t'] is not None)[len(rs)//2] if rs else None,
            'смертей T до 20 с': sum(r['T20'] for r in rs)/n, 'смертей CT до 20 с': sum(r['CT20'] for r in rs)/n,
            'смертей T до 45 с': sum(r['T45'] for r in rs)/n, 'смертей CT до 45 с': sum(r['CT45'] for r in rs)/n,
            'первым погиб T до 20 с: CT выиграли %': 100*sum(r['ct'] for r in early_T)/max(1, len(early_T))}

def boot(a, b, key, n=400):
    ms = sorted(set(a) & set(b)); rnd = random.Random(1); D = []
    for _ in range(n):
        s = [rnd.choice(ms) for _ in ms]
        D.append(metr([b[m] for m in s])[key] - metr([a[m] for m in s])[key])
    D.sort(); return round(D[int(0.05*n)], 2), round(D[int(0.95*n)], 2)

if __name__ == '__main__':
    pa, pb, sets = sys.argv[1], sys.argv[2], sys.argv[3:]
    A, B = {}, {}
    for s in sets:
        a, b = rounds_of(f'{pa}_{s}'), rounds_of(f'{pb}_{s}')
        A.update(a); B.update(b)
        ma, mb = metr(list(a.values())), metr(list(b.values()))
        print(f'== набор {s} (матчи {sorted(a)})')
        for k in ma: print(f'  {k:42} {ma[k]:8.2f} → {mb[k]:8.2f}   90% разницы {boot(a, b, k)}' if k != 'раундов' else f'  {k:42} {ma[k]} → {mb[k]}')
    ma, mb = metr(list(A.values())), metr(list(B.values()))
    print('== вместе')
    for k in ma: print(f'  {k:42} {ma[k]:8.2f} → {mb[k]:8.2f}   90% разницы {boot(A, B, k)}' if k != 'раундов' else f'  {k:42} {ma[k]} → {mb[k]}')
