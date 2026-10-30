"""(аудит 30.10) Смены задач места по REC.task (сторож rec2.js ветки measure/exec-sync): python3 tools/measure/task_report.py <папка> [<папка2> …]
Классы смены (на назначение новой задачи): react — новая важнее (реакция), end — старая кончилась (не подтверждалась / снята),
swap — того же уровня при живой старой, down — ниже при живой старой (арбитр так не должен), same — та же задача заново.
osc — качели A → B → A (B короче 8 с, всё за 16 с). Знаменатели: на 1000 назначений и на 100 игроко-раундов; ± — по матчам (95 %)."""
import json, sys, glob, os, statistics as st, collections
for d in sys.argv[1:]:
    per = collections.defaultdict(list); pat = collections.Counter(); osc = collections.Counter(); N = PR = 0; tot = collections.Counter()
    for f in sorted(glob.glob(os.path.join(d, 'rec_*.json'))):
        if os.path.getsize(f) == 0: continue
        R = json.load(open(f)); T = R.get('task')
        if not T: continue
        n, pr = T['n'] or 1, T['pr'] or 1; N += T['n']; PR += T['pr']
        for k, v in T['cls'].items(): per[k].append(1000 * v / n); tot[k] += v
        per['osc'].append(1000 * T['osc'] / n); tot['osc'] += T['osc']; per['oscThrow'].append(1000 * T.get('oscThrow', 0) / n); tot['oscThrow'] += T.get('oscThrow', 0); per['n/pr'].append(T['n'] / pr)
        pat.update(T['pat']); osc.update(T['oscPat'])
    if not per: print(d, 'нет REC.task'); continue
    ci = lambda v: 2.13 * st.stdev(v) / len(v) ** .5 if len(v) > 1 else 0
    print('==', d, 'матчей', len(per['osc']), 'назначений', N, 'игроко-раундов', PR, 'назначений на игроко-раунд %.1f' % (N / PR))
    for k in ['react', 'end', 'swap', 'down', 'same', 'osc', 'oscThrow']:
        print('  %-6s %6.1f ± %4.1f на 1000 назначений; %6.1f на 100 игроко-раундов' % (k, st.mean(per[k]), ci(per[k]), 100 * tot[k] / PR))
    print('  частые качели:', '; '.join('%s %d' % kv for kv in osc.most_common(8)))
    print('  частые swap/down:', '; '.join('%s %d' % kv for kv in pat.most_common(8)))
