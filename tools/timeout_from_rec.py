#!/usr/bin/env python3
"""(v460) Тактические паузы по записям прогонов (rec_<m>.json[.gz]): пауза — закупка дольше обычного (между t1 раунда и t0
следующего), берёт проигравшая раунд сторона. Сколько пауз на матч, после скольких поражений подряд, взяли ли раунд после паузы.
python3 tools/timeout_from_rec.py <папка с rec_*> [--list]"""
import sys, os, json, gzip, glob, collections, statistics
def load(p):
    with (gzip.open(p, 'rt', encoding='utf-8') if p.endswith('.gz') else open(p, encoding='utf-8')) as f: return json.load(f)
d = sys.argv[1]; LIST = '--list' in sys.argv
tot = 0; nm = 0; won = 0; streaks = collections.Counter(); per = []; rows = []
for p in sorted(glob.glob(os.path.join(d, 'rec_*.json*'))):
    R = load(p); rs = [r for r in R.get('rounds', []) if r.get('t0') is not None and r.get('t1') is not None]; nm += 1
    gaps = [(rs[i+1]['t0'] - rs[i]['t1'])/64.0 for i in range(len(rs)-1)]
    if not gaps: continue
    med = statistics.median(gaps); k = 0
    for i, g in enumerate(gaps):
        if g < med + 20: continue
        prev, nxt = rs[i], rs[i+1]
        # перерыв между половинами — та же длина закупки, но стороны меняются: пропускаем по номеру раунда
        if prev['r'] in (12, 24) or (prev['r'] > 24 and (prev['r'] - 24) % 3 == 0): continue
        k += 1; tot += 1
        loser = 'T' if prev.get('winner') == 'CT' else 'CT'
        s = 0; j = i
        while j >= 0 and rs[j].get('winner') and rs[j]['winner'] != loser: s += 1; j -= 1
        streaks[min(s, 5)] += 1
        w = nxt.get('winner') == loser; won += w
        rows.append((R.get('match'), nxt['r'], loser, s, 'взяли' if w else 'проиграли'))
    per.append(k)
print('матчей: %d, пауз: %d (на матч %.2f, обе команды); у про на карту — 3,65' % (nm, tot, tot/max(1, nm)))
print('поражений подряд перед паузой:', dict(sorted(streaks.items())))
print('раунд после паузы у взявших: %d из %d (%.0f%%); у про — 57%%' % (won, tot, 100*won/max(1, tot)))
if LIST:
    for r in rows: print('матч %s раунд %s — пауза %s после %d пораж., раунд %s' % r)
