"""(Р3.6, 27.11) перемер решений, принятых по счётчикам (rebuild/R3_6_REVIEW.md), по полным записям 8 + 8 одной версии (прогон ПК, вид rec):
старый stall против разделённого (block — «залип», держание задачи; geom — геометрия; free — «шаг свободен, стоит»; path), эпизоды stall.ep;
старый danger против причин (dangerBy) и danger.flashKnown (флешка, о которой бот знал). Запуск: python3 remeasure.py <папка pc-results/N> <метка rec>"""
import sys, json, gzip, glob, os
root, lab = sys.argv[1], sys.argv[2]
out = {}
for m in ('anc', 'mir'):
    T = {}; by = {}; per = []
    for f in sorted(glob.glob(os.path.join(root, '%s_%s' % (lab, m), 'rec_*.json.gz'))):
        d = json.load(gzip.open(f)); n = d['watch']['n']; db = d['watch'].get('dangerBy', {})
        for k, v in n.items():
            if isinstance(v, (int, float)): T[k] = T.get(k, 0) + v
        for k, v in db.items(): by[k] = by.get(k, 0) + v
        per.append({'match': d.get('match'), 'finished': d.get('finished'), 'stall': n.get('stall', 0), 'stall.block': n.get('stall.block', 0), 'stall.geom': n.get('stall.geom', 0),
                    'stall.free': n.get('stall.free', 0), 'stall.path': n.get('stall.path', 0), 'stall.ep': n.get('stall.ep', 0), 'danger': n.get('danger', 0), 'danger.flashKnown': n.get('danger.flashKnown', 0)})
    st = T.get('stall', 0)
    out[m] = {'matches': len(per), 'totals': {k: T.get(k, 0) for k in ('stall', 'stall.block', 'stall.geom', 'stall.free', 'stall.path', 'stall.ep', 'danger', 'danger.flashKnown', 'nav', 'kills')},
              'share_of_stall': {k: round(T.get(k, 0) / st, 3) if st else None for k in ('stall.block', 'stall.geom', 'stall.free', 'stall.path')},
              'stall_per_episode': round(st / T['stall.ep'], 3) if T.get('stall.ep') else None, 'dangerBy': by,
              'danger_flash_without_knowledge': by.get('флешка без реакции', 0) - T.get('danger.flashKnown', 0), 'per_match': per}
print(json.dumps(out, ensure_ascii=False, indent=1))
