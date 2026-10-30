"""(тактика 30.10) Сводка tools/measure/exec_sync.js: python3 tools/measure/exec_sync_report.py out1.json [out2.json …]
Смоки: время полёта; выход: раундов с выходом, из них — выход раньше, чем раскрылся смок T у сайта (смок сработал позже выхода
или раскрылся позже), сколько с выхода до готовности; записи 366 (если есть): назначено / готово / провал по причинам / переназначено."""
import json, sys, statistics as st, collections
for f in sys.argv[1:]:
    d = json.load(open(f))
    sm = sorted(x[1] for x in d['flights'] if x[0] == 'smoke')
    smT = sorted(x[1] for x in d['flights'] if x[0] == 'smoke' and x[4] == 'T')
    print(f)
    if sm: print('  смоки: %d, полёт медиана %.2f с, p90 %.2f, макс %.2f; T: медиана %.2f' % (len(sm), st.median(sm), sm[int(.9*(len(sm)-1))], sm[-1], st.median(smT) if smT else 0))
    G = d.get('generic', [])
    early = [g for g in G if any(s[1] > g['exec'] for s in g['smokes'])]
    late_s = [ (s[1]-g['exec'])/64 for g in G for s in g['smokes'] if s[1] > g['exec']]
    print('  выходов: %d; с смоком T у сайта: %d; выход раньше готовности смока: %d раунд(ов), смоков %d, на сколько с (медиана) %s' % (
        len(G), sum(1 for g in G if g['smokes']), len(early), len(late_s), ('%.1f' % st.median(late_s)) if late_s else '-'))
    R = d.get('rounds', [])
    if R:
        it = [i for r in R for i in r['items']]
        c = collections.Counter(i['state'] for i in it); fw = collections.Counter(i['fail'] for i in it if i['fail'])
        print('  366: гранат выхода %d (критичных %d); состояния %s; провалы %s; переназначено %d; ожидание %s' % (
            len(it), sum(i['crit'] for i in it), dict(c), dict(fw), sum(i['re'] for i in it),
            sum(1 for r in R for e in r['ev'] if e['kind'] == 'wait')))
        print('  366: выходов %d, критичных не готово на выходе %d (поздних выходов %d)' % (sum(1 for r in R if r['exec']), sum(r['early'] or 0 for r in R), sum(1 for r in R if r['late'])))
    fl = d.get('flashes', [])
    if fl: print('  флешка под пик → энтри на сайте: %s с' % ', '.join('%.1f' % ((b-a)/64) for a, b in fl))
