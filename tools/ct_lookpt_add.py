#!/usr/bin/env python3
"""(v417, М153) Добавить в расстановки CT набора карты (tactics.json → ctSetups[].roles[].lookPt) точку, куда смотрят про — то же, что
tools/tactics_bake.py --game делает с v417, без полной пересборки (для неё нужен pro_samples.csv.gz). Слоты и роли — как в tactics_bake
(setups.json + positions.json); lookPt пишется, только если записанный look — зона угла про (не заменён входом).
python3 tools/ct_lookpt_add.py [--map mirage]"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir
MAP = mapdir.current(); PRO = mapdir.path(MAP, 'pro')
sets = json.load(open(os.path.join(PRO, 'setups.json'), encoding='utf-8'))
P = json.load(open(os.path.join(PRO, 'positions.json'), encoding='utf-8'))
byid = {p['id']: p for p in P['points'] + P.get('late', [])}
pts = {}
for x in sets['ct']:
    sp = x['split']; rot = 'stack' if max(sp['A'], sp['B']) >= 3 else ('212' if max(sp['A'], sp['B']) >= 2 else '111')
    sid = 'ct%s_%d%d%d' % ({'stack': 'Stack', '212': 'Std', '111': 'Rot'}[rot], sp['A'], sp['mid'], sp['B'])
    roles, rest = {}, []
    for sl in x['slots']:
        p = byid.get(sl['point'])
        if not p: continue
        role = {'anchor_A': 'anchorA', 'anchor_B': 'anchorB', 'mid_control': 'mid'}.get(sl['role'])
        if role and role not in roles: roles[role] = p
        else: rest.append(p)
    for role, p in zip([r for r in ('rotator', 'roamer', 'mid') if r not in roles], rest): roles[role] = p
    pts[sid] = roles
added = 0
for f in (mapdir.path(MAP, 'tactics.json'), os.path.join(PRO, 'tactics_game.json')):
    T = json.load(open(f, encoding='utf-8'))
    for S in T['ctSetups']:
        for rn, R in S['roles'].items():
            p = pts.get(S['id'], {}).get(rn)
            R.pop('lookPt', None)
            if p and p['angle'].get('x') is not None and p['angle']['zone'].split(' / ')[0] == R['look']:
                R['lookPt'] = [round(p['angle']['x'], 1), round(p['angle']['y'], 1)]
                added += 1
    open(f, 'w', encoding='utf-8').write(json.dumps(T, ensure_ascii=False, indent=1) + '\n')
print('lookPt записано:', added, '(по двум файлам)')
