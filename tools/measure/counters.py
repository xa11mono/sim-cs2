#!/usr/bin/env python3
"""(15.11, перестройка, фаза 2) Набор счётчиков прогона — одна таблица «было / стало», красное видно сразу.
Запуск: python3 tools/measure/counters.py <метка> [--base=<метка>] [--md=<файл>]   (записи — tools/measure/runs/<метка>/rec_<m>.json)
Счётчики (на 100 раундов, где не сказано иначе): застревания (stall), переносы (nav), перетягивание (tug), опасность (danger) —
сторож матча; смертей к 20 с раунда (на раунд), длина раунда (медиана, с), планты (доля раундов), раунды T (доля), гранат
(на раунд), фрагов (на раунд). «Красное» — сдвиг больше шума 8 матчей (CLAUDE.md §8: stall ≈ 15 %, nav / tug / danger ≈ 20 %,
гранаты ≈ 10 %, планты и раунды T ≈ 20 %) в сторону «хуже»; меньше шума — серое, решений по нему не принимать."""
import json, os, sys, glob, statistics
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runs')
opt = {a.split('=')[0][2:]: (a.split('=', 1)[1] if '=' in a else '1') for a in sys.argv[1:] if a.startswith('--')}
args = [a for a in sys.argv[1:] if not a.startswith('--')]
# счётчик: (имя, шум 8 матчей, «хуже» — больше (+1) / меньше (-1) / нет направления (0))
SPEC = [('застревания (stall), на 100 р.', .15, 1), ('переносы (nav), на 100 р.', .20, 1), ('перетягивание (tug), на 100 р.', .20, 1),
        ('опасность (danger), на 100 р.', .20, 1), ('смертей к 20 с, на раунд', .20, 0), ('длина раунда, медиана с', .10, 0),
        ('планты, доля раундов', .20, 0), ('раунды T, доля', .20, 0), ('гранат на раунд', .10, 0), ('фрагов на раунд', .10, 0)]


def count(label):
    fs = sorted(glob.glob(os.path.join(R, label, 'rec_*.json')))
    if not fs: sys.exit('нет записей: ' + os.path.join(R, label))
    W = {'stall': 0, 'nav': 0, 'tug': 0, 'danger': 0}; nr = 0; early = 0; lens = []; plants = 0; twins = 0; nades = 0; kills = 0
    for f in fs:
        d = json.load(open(f)); rs = d['rounds']; nr += len(rs)
        for k in W: W[k] += (d.get('watch') or {}).get('n', {}).get(k, 0)
        for r in rs:
            if r.get('t1') and r.get('t0') is not None: lens.append((r['t1'] - r['t0']) / 64)
            plants += 1 if r.get('plant') else 0; twins += 1 if r.get('winner') == 'T' else 0
        for k in d.get('kills', []):
            t = k[0]; r = next((r for r in rs if r.get('t0') is not None and r['t0'] <= t <= (r.get('t1') or 1e12)), None)
            if r and t - r['t0'] <= 20 * 64: early += 1
        nades += len(d.get('nades', [])); kills += len(d.get('kills', []))
    p = 100.0 / max(1, nr)
    vals = [W['stall'] * p, W['nav'] * p, W['tug'] * p, W['danger'] * p, early / max(1, nr), statistics.median(lens) if lens else 0,
            plants / max(1, nr), twins / max(1, nr), nades / max(1, nr), kills / max(1, nr)]
    return vals, nr, len(fs)


def fmt(v): return ('%.2f' % v) if abs(v) < 10 else ('%.0f' % v)


lab = args[0]; new, nr, nm = count(lab)
rows = []
if 'base' in opt:
    old, onr, onm = count(opt['base'])
    rows.append('| счётчик | было (%s, %d матчей, %d р.) | стало (%s, %d матчей, %d р.) | сдвиг | |' % (opt['base'], onm, onr, lab, nm, nr))
    rows.append('|---|---|---|---|---|')
    for (name, noise, worse), a, b in zip(SPEC, old, new):
        ch = (b - a) / a if a else 0
        mark = '⚪ шум' if abs(ch) <= noise else ('🔴 хуже' if worse and ch * worse > 0 else ('🟢 лучше' if worse else '🟡 сдвиг'))
        rows.append('| %s | %s | %s | %+.0f %% | %s |' % (name, fmt(a), fmt(b), ch * 100, mark))
else:
    rows.append('| счётчик | %s (%d матчей, %d р.) |' % (lab, nm, nr)); rows.append('|---|---|')
    for (name, _, _), b in zip(SPEC, new): rows.append('| %s | %s |' % (name, fmt(b)))
out = '\n'.join(rows)
print(out)
if 'md' in opt: open(opt['md'], 'w', encoding='utf-8').write(out + '\n')
