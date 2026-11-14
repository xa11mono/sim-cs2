"""В142 (13.11.2026): как часто у стороны есть AWP — по демкам про, по стороне и типу закупа → <карта>/pro.json, поле awpBy (игра: MAP.pro.awpBy,
520 teamAwp). Источник — tools/shadow/roles_cmp.py (roles_pro_rounds_<карта>.json: AWP в руках хоть раз за 10–40 с, тип закупа eco_est).
Запуск: python3 tools/awp_bake.py --map mirage [путь к roles_pro_rounds_<карта>.json]"""
import sys, os, json, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import mapdir  # noqa: E402
MAP = mapdir.current()
a = [x for x in sys.argv[1:] if not x.startswith('--')]
R = json.load(open(a[0] if a else os.path.join(HERE, 'shadow', 'roles_pro_rounds_%s.json' % MAP)))
TY = {'фулл': 'full', 'форс': 'force', 'эко': 'eco'}
out = {}
for side, key in (('T', 'tbuy'), ('CT', 'ctbuy')):
    c = collections.defaultdict(lambda: [0, 0])
    for r in R:
        t = TY.get(r[key])
        if not t: continue
        c[t][1] += 1; c[t][0] += r['awp'].get(side, 0) > 0
    out[side] = {t: round(x / n, 3) for t, (x, n) in c.items() if n >= 30}
    if 'force' in out[side]: out[side]['half'] = out[side]['force']
print(out)
f = mapdir.path(MAP, 'pro.json'); s = open(f, encoding='utf-8').read()
if s.startswith('{"awpBy"'): s = '{' + s[s.index('\n') + 1:]
s = '{"awpBy": ' + json.dumps(out) + ',\n' + s[1:]
open(f, 'w', encoding='utf-8').write(s)
