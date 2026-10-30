#!/usr/bin/env python3
"""Точность гранат в матчах замера (30.10, PR #2): python3 tools/nades/match_nade_acc.py <метка> [<метка> …]
Берёт tools/measure/runs/<метка>/rec_*.json (запись rec2.js). На 100 раундов и в px радара:
- от разрыва до точки, куда кидал бот (цель броска из записи бросков), по типу и «лайнап / своя»;
- от первого касания до цели (есть только в записи с полем первого касания — ветка measure/phys-fix);
- на крыше (без действия) — по типу; брошено по типу;
- флешки: хлопков, врагов в 600 px на линии на хлопок, доля «не повернулся» (сторож со счётчиками flash*);
- danger по составляющим; задания: отказы и снятия (lostWhy сторожа) по причинам.
Числа — для сравнения версий на одних и тех же матчах; шум между матчами — tools/measure/noise.py."""
import sys, os, json, glob, math, collections
HERE = os.path.dirname(os.path.abspath(__file__)); RUNS = os.path.join(HERE, '..', 'measure', 'runs')

def q(a, p):
    a = sorted(a); return a[int(p * (len(a) - 1))] if a else float('nan')

for L in sys.argv[1:]:
    R = 0; D = collections.defaultdict(list); F0 = collections.defaultdict(list); roof = collections.Counter(); thrown = collections.Counter()
    N = collections.Counter(); dB = collections.Counter(); lost = collections.Counter()
    for f in sorted(glob.glob(os.path.join(RUNS, L, 'rec_*.json'))):
        d = json.load(open(f)); R += len(d['rounds']); w = d.get('watch', {})
        N.update({k: v for k, v in w.get('n', {}).items() if k.startswith('flash')}); dB.update(w.get('dangerBy', {}))
        lost.update(w.get('nade', {}).get('lostWhy', {}))
        for n in d['nades']: thrown[n[2]] += 1
        for r in d.get('roof', []): roof[r[2]] += 1
        for e in d['det']:
            c = [n for n in d['nades'] if n[2] == e[2] and n[3] == e[6] and 0 <= e[0] - n[0] <= 1500]
            if not c: continue
            n = c[-1]; k = (e[2], 'лайнап' if n[11] else 'своя')
            D[k].append(math.hypot(e[3] - n[7], e[4] - n[8]))
            if len(e) > 9 and e[9]: F0[k].append(math.hypot(e[9][0] - n[7], e[9][1] - n[8]))
    print('==', L, 'раундов', R)
    print('  брошено /100р', {k: round(100 * v / R) for k, v in sorted(thrown.items())}, '| на крыше /100р', {k: round(100 * v / R, 1) for k, v in sorted(roof.items())})
    for k in sorted(D):
        v = D[k]; f0 = F0.get(k, [])
        print('  %-6s %-6s n %5d  разрыв от цели px p50 %5.0f p75 %5.0f ≤13 px %3.0f%%' % (k[0], k[1], len(v), q(v, .5), q(v, .75), 100 * sum(x <= 12.8 for x in v) / len(v)),
              ('| 1-е касание p50 %4.0f p75 %4.0f' % (q(f0, .5), q(f0, .75))) if f0 else '')
    if N.get('flashPop'):
        print('  флешки: хлопков /100р %.0f, врагов на линии на хлопок %.2f, «не повернулся» из проверенных %.3f' % (
            100 * N['flashPop'] / R, N['flashSeen'] / N['flashPop'], dB['флешка без реакции'] / max(1, N['flashChecked'])))
    print('  danger /100р', {k: round(100 * v / R, 1) for k, v in sorted(dB.items())})
    cat = collections.Counter()
    for k, v in lost.items(): cat[k.split('|', 1)[1].split(':')[0] + (': ' + k.split(':', 1)[1].strip() if 'отказ' in k else '')] += v
    print('  задания потеряны /100р', {k: round(100 * v / R) for k, v in cat.most_common(8)})
