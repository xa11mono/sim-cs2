#!/usr/bin/env python3
"""(шаг Б1) кто меняет путь: разбор записи walk_watch.js (поля who / post и два последних столбца stall).
python3 tools/measure/engine/walk_who.py <метка> --sim=<sim.html>   (sim — та сборка, что играла: по ней номера строк → функции)
Печатает: stall / nav / «ходит туда-сюда» на 100 раундов; кто меняет путь (все смены и смены цели > 60 px) — всего и внутри
«туда-сюда»; какие новые посты (тег < кто поставил) случаются внутри «туда-сюда»."""
import sys, os, json, glob, re, collections
HERE = os.path.dirname(os.path.abspath(__file__)); MEAS = os.path.dirname(HERE)
label = [a for a in sys.argv[1:] if not a.startswith('--')][0]
sim = [a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--sim=')]
FN = {}
if sim:
    cur = '?'
    for i, ln in enumerate(open(sim[0], encoding='utf-8'), 1):
        m = re.match(r'\s{0,2}function ([\w$]+)\s*\(', ln)
        if m: cur = m.group(1)
        FN[i] = cur
def name(w):  # '@16330' → 'stepTick:16330'
    return '<'.join((FN.get(int(p[1:]), '?') + ':' + p[1:]) if re.match(r'@\d+$', p) else p for p in w.split('<') if p != '@?')
rounds = 0; stall = []; nav = 0; who = collections.Counter(); whoS = collections.Counter(); whoM = collections.Counter(); post = collections.Counter()
for fn in sorted(glob.glob(os.path.join(MEAS, 'runs', label, 'rec_*.json'))):
    try: d = json.load(open(fn))
    except Exception: print('битый', fn); continue
    rounds += len([r for r in d['rounds'] if 't1' in r]); w = d['walk']
    stall += w['stall']; nav += sum(1 for n in w['nav'] if n[1] == 'snap')
    for k, v in w.get('who', {}).items(): who[name(k)] += v[0]; whoM[name(k)] += v[1]; whoS[name(k)] += v[2] if len(v) > 2 else 0
    for k, v in w.get('post', {}).items(): post[name(k)] += v
tug = [s for s in stall if s[9] >= 0.5 and s[13] > 60]
per = lambda n: round(100.0 * n / max(rounds, 1))
print(f'{label}: раундов {rounds}; stall {per(len(stall))}, nav(перенос) {per(nav)}, туда-сюда {per(len(tug))} на 100 раундов '
      f'({round(100.0*len(tug)/max(len(stall),1))} % stall)')
if tug and len(tug[0]) > 16:
    import statistics
    print('  в «туда-сюда»: смен пути медиана', statistics.median(len(s[15]) for s in tug),
          '; смен цели (*) медиана', statistics.median(sum(1 for c in s[15] if '*' in c) for s in tug))
    tw = collections.Counter(); ts = collections.Counter(); tm = collections.Counter(); tp = collections.Counter()
    for s in tug:
        for c in s[15]: k = name(c.rstrip('*∅')); tw[k] += 1; tm[k] += ('*' in c); ts[k] += ('**' in c)
        for c in s[16]: tp[name(c)] += 1
    print('  кто меняет путь внутри «туда-сюда» (смен / смен цели / из них при том же посте):')
    for k, v in tw.most_common(14): print(f'    {v:5d} {tm[k]:5d} {ts[k]:5d}  {k}')
    print('  новые посты внутри «туда-сюда» (тег < кто):')
    for k, v in tp.most_common(14): print(f'    {v:5d}  {k}')
print('  кто меняет путь, всего (смен / смен цели / при том же посте):')
for k, v in who.most_common(12): print(f'    {v:6d} {whoM[k]:6d} {whoS[k]:6d}  {k}')
print('  новые посты, всего:')
for k, v in post.most_common(12): print(f'    {v:6d}  {k}')
