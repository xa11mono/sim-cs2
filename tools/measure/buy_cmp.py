"""(v559, В76) сравнение по закупу T: плант, первый фраг, победы T, темп тактики — по записям прогона (rec_<m>.json.gz) и у про
(демки Ancient, PRO_PLAY §4). Запуск: python3 tools/measure/buy_cmp.py <папка_с_метками> <метка> [<метка> …]"""
import sys, os, gzip, json, glob, collections, statistics as st
PRO = {'pistol': (69, 42, 27), 'eco': (24, 48, 27), 'force': (52, 59, 25), 'half': (52, 59, 25), 'full': (59, 70, 22)}   # плант %, плант с, первый фраг с
HERE = os.path.dirname(os.path.abspath(__file__))
STY = {}
for m in ('mirage', 'ancient'):
    for t in json.load(open(os.path.join(HERE, '..', '..', 'data', 'maps', m, 'tactics.json'), encoding='utf-8'))['tTactics']: STY[t['id']] = t['style']
def tempo(t):   # по стилю тактики: раш — быстро, дефолт — поздно, остальное — обычно (не время выхода)
    s = STY.get(t or '', '')
    return 'быстро' if s == 'rush' else ('поздно' if s == 'default' else 'обычно')
root = sys.argv[1]
for lab in sys.argv[2:]:
    S = collections.defaultdict(lambda: collections.defaultdict(list))
    for f in sorted(glob.glob(os.path.join(root, lab, 'rec_*.json*'))):
        R = json.load(gzip.open(f) if f.endswith('.gz') else open(f))
        kills = R.get('kills', [])
        for r in R.get('rounds', []):
            if r.get('t1') is None: continue
            k = r.get('tType'); s = S[k]; s['n'].append(1)
            s['twin'].append(1 if r.get('winner') == 'T' else 0)
            s['plant'].append(1 if r.get('plant') else 0)
            if r.get('plant'): s['tpl'].append((r['plant'] - r['t0'])/64)
            fk = [x[0] for x in kills if r['t0'] <= x[0] <= r['t1']]
            if fk: s['fk'].append((min(fk) - r['t0'])/64)
            s['tempo'].append(tempo(r.get('tac')))
    print('==', lab)
    print('%-7s %4s %6s %6s %8s %8s  %s' % ('закуп', 'n', 'T win', 'плант', 'плант,с', '1-й фраг', 'темп быстро/обычно/поздно  | про: плант %, плант с, 1-й фраг с'))
    for k in ['pistol', 'eco', 'force', 'half', 'full']:
        s = S.get(k)
        if not s: continue
        n = len(s['n']); c = collections.Counter(s['tempo'])
        med = lambda v: ('%.0f' % st.median(v)) if v else '—'
        print('%-7s %4d %5.0f%% %5.0f%% %8s %8s  %3.0f/%3.0f/%3.0f %%  | %s' % (k, n, 100*sum(s['twin'])/n, 100*sum(s['plant'])/n, med(s['tpl']), med(s['fk']),
              100*c['быстро']/n, 100*c['обычно']/n, 100*c['поздно']/n, PRO.get(k)))
