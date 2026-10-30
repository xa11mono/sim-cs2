#!/usr/bin/env python3
"""Сравнение версий на одних и тех же матчах (30.10): python3 tools/measure/compare_runs.py <база> <версия> [<версия> …]
Цифры на матч — как в noise.py (сторож на 100 раундов, гранат за раунд по сторонам, доли раундов T и с плантом). Для каждой версии
против базы: среднее, разница в %, t = разница / ст. ошибка (Уэлч, σ между матчами). |t| < 2 — шум (≈ 95 %), так и писать."""
import sys, os, json, glob, math
HERE = os.path.dirname(os.path.abspath(__file__))
def rows(run):
    out = {}
    for f in sorted(glob.glob(os.path.join(HERE, 'runs', run, 'rec_*.json'))):
        d = json.load(open(f)); R = d.get('rounds') or []
        if not R: continue
        nr = len(R); w = (d.get('watch') or {}).get('n', {}); r = {}
        for k in ('stall', 'nav', 'tug', 'danger'): r[k] = w.get(k, 0) * 100.0 / nr
        for side in ('CT', 'T'): r['гранат CT' if side == 'CT' else 'гранат T'] = sum(1 for n in d.get('nades', []) if n[1] == side) / nr
        r['доля T'] = sum(1 for q in R if q.get('winner') == 'T') / nr
        r['доля плантов'] = len(d.get('plants', [])) / nr
        out[os.path.basename(f)[4:-5]] = r
    return out
def ms(v):
    m = sum(v) / len(v); return m, math.sqrt(sum((x - m) ** 2 for x in v) / (len(v) - 1))
B = rows(sys.argv[1]); V = [(a, rows(a)) for a in sys.argv[2:]]
keys = list(next(iter(B.values())).keys())
print('%-14s %10s' % ('цифра', sys.argv[1]) + ''.join(' | %-30s' % a for a, _ in V))
for k in keys:
    mb, sb = ms([r[k] for r in B.values()]); line = '%-14s %10.2f' % (k, mb)
    for a, R in V:
        mv, sv = ms([r[k] for r in R.values()]); se = math.sqrt(sb ** 2 / len(B) + sv ** 2 / len(R)) or 1e-9
        t = (mv - mb) / se; line += ' | %8.2f %+6.0f%% t %+5.1f %-6s' % (mv, 100 * (mv - mb) / mb if mb else 0, t, 'шум' if abs(t) < 2 else '')
    print(line)
print('матчей:', len(B), ''.join(' / %d' % len(R) for _, R in V))
