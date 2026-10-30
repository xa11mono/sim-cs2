"""(тактика 30.10) Сводка tools/measure/ct_react.js: python3 tools/measure/ct_react_report.py out1.json [out2.json …]"""
import json, sys
for f in sys.argv[1:]:
    d = json.load(open(f)); R = d['rounds']
    rot = [x for r in R for x in r['rot']]
    blind = [x for x in rot if x[3] and x[3]['seen'] == 0 and x[3]['nades'] >= 2]
    wrong = [x for r in R for x in r['rot'] if r['site'] and x[2] and x[2] != r['site']]
    fake = [r for r in R if r['tac'] == 'fake']
    print(f)
    print('  раундов %d; ротаций CT %d; из них по коллу «гранаты», T не видели: %d; ротаций на сайт не тот, что у T: %d' % (len(R), len(rot), len(blind), len(wrong)))
    print('  раунды-фейки T: %d, в них ротаций на фейковый сайт: %s' % (len(fake), [sum(1 for x in r['rot'] if x[2] != r['site']) for r in fake]))
    print('  фейк-дефуз %d, дефуз %d; переколы T «прочекан — пусто» %d' % (sum(r['fakeDef'] for r in R), sum(r['realDef'] for r in R), sum(len(r['clrReb']) for r in R)))
