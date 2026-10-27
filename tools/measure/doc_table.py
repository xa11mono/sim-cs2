#!/usr/bin/env python3
"""(v438) таблица ошибок дока владельца 27.10 по сторожу doc_watch.js: python3 tools/measure/doc_table.py <метка> [<метка2> ...]
Читает tools/measure/runs/<метка>/rec_<m>.json(.gz). На каждую ошибку — сколько раз и доля (из чего)."""
import sys, os, json, gzip, glob, collections
HERE = os.path.dirname(os.path.abspath(__file__))
def load(lab):
    out = []
    for f in sorted(glob.glob(os.path.join(HERE, 'runs', lab, 'rec_*.json*'))):
        op = gzip.open if f.endswith('.gz') else open
        try: r = json.load(op(f, 'rt', encoding='utf-8'))
        except Exception: continue
        if r.get('doc'): out.append((os.path.basename(f), r, r['doc']))
    return out
def row(lab):
    R = load(lab); S = collections.Counter(); nt = collections.Counter(); rounds = 0
    for name, r, d in R:
        rounds += len(r.get('rounds', []))
        for k in ('fire', 'walk', 'swing', 'known', 'smokeDup', 'pp', 'save', 'rl'):
            for kk, v in d[k].items(): S[k + '.' + kk] += v
        S['voice.n'] += d['voice']['n']; S['path.n'] += d['path']['n']; S['path.ticks'] += d['path']['ticks']; S['path.max'] = max(S['path.max'], d['path']['max'])
        for kk, v in d['nt'].items(): nt[kk] += v
        for t in ('T', 'CT'): S['buy.' + t + '.n'] += d['buy'][t][0]; S['buy.' + t + '.p'] += d['buy'][t][1]; S['thrown.' + t] += d['thrown'][t]
    return R, S, nt, rounds
def pct(a, b): return '%d / %d = %s' % (a, b, ('%.0f %%' % (100.0*a/b)) if b else '—')
for lab in sys.argv[1:]:
    R, S, nt, rounds = row(lab)
    print('##', lab, '—', len(R), 'матчей,', rounds, 'раундов')
    print('выход на врага: точки без вида на врага   ', pct(S['swing.noLos'], S['swing.n']))
    print('выход на врага: точка не на полу бота      ', pct(S['swing.high'], S['swing.n']))
    print('шифт, когда враги дальше 600               ', pct(S['walk.far'], S['walk.n']))
    print('шифт в зоне смертельного взрыва (< 5 с)    ', S['walk.bomb'])
    print('заход в огонь сам (HP хватает)             ', S['fire.commit'], '| молотов упал на него', S['fire.birth'], '| другое', S['fire.other'])
    print('взгляд «путь к врагу» за спиной на ходу    ', pct(S['known.behind'], S['known.n']))
    print('смок ≤160 от своего смока за ≤15 с (дубль) ', pct(S['smokeDup.dup'], S['smokeDup.n']))
    print('T после планта ближе 150 к бомбе (10–40 с)  ', pct(S['pp.near'], S['pp.n']))
    print('сейв T при деньгах команды ≥ 15000          ', pct(S['save.rich'], S['save.n']))
    print('пик на перезарядку, сам перезаряжаясь       ', S['rl.peek'], '| нож при перезарядке', S['rl.knife'])
    print('войс: строк на раунд                       ', round(S['voice.n'] / max(1, rounds), 1))
    print('пути: в среднем за тик / максимум за тик   ', round(S['path.n'] / max(1, S['path.ticks']), 1), '/', S['path.max'])
    for t in ('T', 'CT'): print('гранат куплено на игрока %s' % t, round(S['buy.%s.n' % t] / max(1, S['buy.%s.p' % t]), 2), '| брошено за раунд', round(S['thrown.' + t] / max(1, rounds), 1))
    tot = sum(v for k, v in nt.items()); thr = sum(v for k, v in nt.items() if k.endswith('|thrown'))
    task = sum(v for k, v in nt.items() if '|task:' in k)
    print('задания гранат: брошено', pct(thr, tot), '| сняла задача важнее', pct(task, tot))
    fails = collections.Counter()
    for k, v in nt.items():
        if '|fail:' in k: fails[k.split('|fail:')[1]] += v
        if k.endswith('|expired'): fails['срок вышел'] += v
    print('   отказы:', dict(fails.most_common(6)))
    print()
