"""В136: раунды демок про для режима «Раунд из демки» в странице (678_demo_view.js) — в набор карты: data/maps/<карта>/demorounds.json
(MAP.demorounds). Берёт выгруженные раунды tools/shadow/round_<демка>_<номер>.json этой карты (export_round.py).
Запуск: python3 tools/shadow/bake_demorounds.py --map mirage"""
import sys, os, json, glob
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
M = mapdir.current(); H = os.path.dirname(os.path.abspath(__file__))
out = []
for f in sorted(glob.glob(os.path.join(H, 'round_*-%s_*.json' % M))):
    import re
    R = json.load(open(f, encoding='utf-8')); mm = re.match(r'(.+)-m(\d+)-' + M + '$', R['demo'])
    t = (mm.group(1) if mm else R['demo']).replace('-vs-', ' — ').replace('-', ' ')
    R['title'] = '%s, карта %s, раунд %d' % (t.title(), mm.group(2) if mm else '?', R['num']); out.append(R)
p = mapdir.path(M, 'demorounds.json'); json.dump({'rounds': out}, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(p, '| раундов', len(out), '|', os.path.getsize(p) // 1024, 'КБ')
