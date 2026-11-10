#!/usr/bin/env python3
"""Сравнение «тот же раунд — две версии» (05.11, план «ускорение проверок»).
python3 tools/measure/replay_cmp.py <база> <переигровка> [<переигровка> …]
База — обычный прогон со снимками ("snaps": true): runs/<база>/rec_<m>.json. Переигровка — прогон с "replay": {"from": <база>,
"rounds": …}: runs/<метка>/rec_<m>_r<R>.json — только выбранные раунды, каждый с того же снимка (конец раунда R−1).
Пары «тот же матч и раунд»: исход (кто выиграл, был ли плант), убийства T / CT до планта, счётчики сторожа за раунд (stall, nav, tug).
Разница по парам: среднее и t (= среднее / ст. ошибка). |t| < 2 — шум. Пары — честнее, чем матчи целиком: раунд начинается с
одинакового состояния (деньги, счёт, память), шум — только от самой правки."""
import sys, os, json, glob, math, re

HERE = os.path.dirname(os.path.abspath(__file__))

def base_rounds(label):
    out = {}
    for f in glob.glob(os.path.join(HERE, 'runs', label, 'rec_*.json')):
        m = re.search(r'rec_(\d+)\.json$', f)
        if not m: continue
        d = json.load(open(f)); ev = (d.get('watch') or {}).get('ev', {})
        for r in d['rounds']:
            out[(int(m.group(1)), r['r'])] = feats(d, r, ev)
    return out

def rep_rounds(label):
    out = {}
    for f in glob.glob(os.path.join(HERE, 'runs', label, 'rec_*_r*.json')):
        m = re.search(r'rec_(\d+)_r(\d+)\.json$', f)
        try: d = json.load(open(f))
        except Exception: continue
        R = int(m.group(2)); rr = [r for r in d['rounds'] if r['r'] == R]
        if rr: out[(int(m.group(1)), R)] = feats(d, rr[0], (d.get('watch') or {}).get('ev', {}))
    return out

def feats(d, r, ev):
    t0, t1 = r['t0'], r.get('t1', 1e18); pl = r.get('plant'); cut = pl or t1
    K = [k for k in d['kills'] if t0 <= k[0] <= cut]
    f = {'T выиграли': 1.0 if r.get('winner') == 'T' else 0.0, 'плант': 1.0 if pl else 0.0,
         'гибнет T до планта': sum(1 for k in K if k[6] == 'T'), 'гибнет CT до планта': sum(1 for k in K if k[6] == 'CT')}
    for k in ('stall', 'nav', 'tug'): f[k] = sum(1 for e in ev.get(k, []) if t0 <= e[0] <= t1 + 64 * 8)
    return f

def main():
    B = base_rounds(sys.argv[1])
    for lab in sys.argv[2:]:
        Rp = rep_rounds(lab); keys = sorted(set(B) & set(Rp))
        print('== %s против %s: пар (матч, раунд) — %d' % (lab, sys.argv[1], len(keys)))
        if not keys: continue
        same = sum(1 for k in keys if B[k] == Rp[k])
        print('  раундов, совпавших во всём: %d' % same)
        for name in B[keys[0]]:
            d = [Rp[k][name] - B[k][name] for k in keys]; n = len(d); m = sum(d) / n
            sd = math.sqrt(sum((x - m) ** 2 for x in d) / (n - 1)) if n > 1 else 0
            t = m / (sd / math.sqrt(n)) if sd > 0 else 0
            mb = sum(B[k][name] for k in keys) / n
            print('  %-20s база %6.2f  разница %+6.2f  t %+5.1f%s' % (name, mb, m, t, '  шум' if abs(t) < 2 else ''))

if __name__ == '__main__':
    main()
