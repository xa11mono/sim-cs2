#!/usr/bin/env python3
"""(v460) Тайм-ауты в демках про: в демках нет события паузы, но пауза удлиняет закупку — промежуток «конец раунда → конец
закупки следующего» заметно больше обычного. Берём такие раунды как раунды после паузы и смотрим: после скольких поражений
подряд её брала команда, проигравшая прошлый раунд, на каком счёте, выиграла ли раунд после паузы. Игру не трогает.
python3 tools/timeout_demos.py [папка демок=data/demos] [--map=ancient]"""
import sys, os, gzip, csv, glob, collections, statistics
D = next((a for a in sys.argv[1:] if not a.startswith('--')), os.path.join(os.path.dirname(__file__), '..', 'data', 'demos'))
MAP = next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--map=')), '')
def rows(p):
    with gzip.open(p, 'rt', encoding='utf-8') as f: return list(csv.DictReader(f))
demos = sorted(set(os.path.basename(p)[:-len('_round_end.csv.gz')] for p in glob.glob(os.path.join(D, '*_round_end.csv.gz')) if MAP in p))
gaps = []; out = []
for d in demos:
    re_ = sorted(rows(os.path.join(D, d + '_round_end.csv.gz')), key=lambda r: int(r['tick']))
    fe = sorted(rows(os.path.join(D, d + '_round_freeze_end.csv.gz')), key=lambda r: int(r['tick']))
    fe_t = [int(r['tick']) for r in fe]
    # команда A — та, что в 1-м раунде T; стороны меняются после 12-го, в овертайме — каждые 3 (MR3)
    def side_of_A(n):   # n — номер раунда с 1
        if n <= 12: return 'T'
        if n <= 24: return 'CT'
        k = (n - 25) // 3; return 'T' if k % 2 == 0 else 'CT'   # проектное: ОТ1 первая половина — как начало матча
    # клатч в раунде: у победителя оставался один при ≥ 2 живых соперниках (по смертям раунда)
    deaths = collections.defaultdict(list)
    dp = os.path.join(D, d + '_player_death.csv.gz')
    if os.path.exists(dp):
        for r in rows(dp):
            try: deaths[int(r['total_rounds_played'])].append((int(r['tick']), 'T' if r['user_team_num'].startswith('2') else 'CT'))
            except Exception: pass
    def clutch(n, w):
        al = {'T': 5, 'CT': 5}; lo = 'CT' if w == 'T' else 'T'
        for _, s in sorted(deaths.get(n - 1, [])):
            al[s] -= 1
            if al[w] == 1 and al[lo] >= 2: return True
        return False
    seq = []
    for r in re_:
        n = int(r['total_rounds_played']); w = r['winner']
        if w not in ('T', 'CT') or n <= 0: continue
        A_won = (w == side_of_A(n)); seq.append((n, A_won, int(r['tick']), clutch(n, w)))
    for i, (n, A_won, t_end, _cl) in enumerate(seq[:-1]):
        nxt = next((x for x in fe_t if x > t_end), None)
        if nxt is None: continue
        gaps.append(((nxt - t_end)/64.0, d, n, i, seq))
G = [g[0] for g in gaps]
base = collections.Counter(); hit = collections.Counter(); cl_base = [0, 0]; cl_hit = [0, 0]; med = statistics.median(G)
th = med + 20   # пауза 30 с; техпаузы бывают длиннее — отсекаем совсем длинные (> 5 мин)
print('раундов: %d, обычный промежуток (медиана): %.1f с; пауза — промежуток > %.0f с' % (len(G), med, th))
streak_hist = collections.Counter(); after_win = collections.Counter(); score_diff = collections.Counter(); n_to = 0; per_match = collections.Counter()
for gap, d, n, i, seq in gaps:
    if n in (12, 24) or (n > 24 and (n - 24) % 3 == 0): continue   # перерыв между половинами — не пауза
    if gap > 300: continue
    loser_is_A = not seq[i][1]
    k = 0; j = i
    while j >= 0 and (not seq[j][1]) == loser_is_A: k += 1; j -= 1
    is_to = gap > th
    base[min(k, 5)] += 1; hit[min(k, 5)] += is_to
    cl = seq[i][3]; cl_base[cl] += 1; cl_hit[cl] += is_to
    if not is_to: continue
    n_to += 1; per_match[d] += 1
    streak_hist[min(k, 5)] += 1
    if i + 1 < len(seq): after_win['взяли раунд' if (not seq[i+1][1]) == loser_is_A else 'проиграли'] += 1
    a = sum(1 for x in seq[:i+1] if x[1]); b = (i + 1) - a
    diff = (b - a) if loser_is_A else (a - b)   # счёт команды, проигравшей прошлый раунд, минус соперника
    score_diff[max(-6, min(6, diff))] += 1
print('пауз: %d в %d демках (в среднем %.2f на карту)' % (n_to, len(demos), n_to/max(1, len(demos))))
print('поражений подряд у проигравших прошлый раунд перед паузой:', dict(sorted(streak_hist.items())))
print('раунд после паузы у них:', dict(after_win))
print('разница счёта у них перед паузой:', dict(sorted(score_diff.items())))
print('доля раундов с паузой после N поражений подряд:', {k: '%d/%d = %.0f%%' % (hit[k], base[k], 100*hit[k]/max(1, base[k])) for k in sorted(base)})
print('после проигранного клатча соперника: %d/%d = %.0f%%; после обычного поражения: %d/%d = %.0f%%' % (cl_hit[1], cl_base[1], 100*cl_hit[1]/max(1,cl_base[1]), cl_hit[0], cl_base[0], 100*cl_hit[0]/max(1,cl_base[0])))
