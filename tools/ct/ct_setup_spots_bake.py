"""Места ролей расстановок CT — точками из демок про (владелец 15.11: «по демкам, где обычно стоят; точки в паре, чтобы смотрели все зоны,
откуда выходят T; видели, а не стояли за стенками»). Для структуры расстановки (A-мид-B, ctshare.json struct) — CT про на 20-й с
(tools/ct/ct_cover_pro.py): на каждой стороне n CT в каждом раунде → n точек (k-средних, k = n; в раунде каждая точка берёт ближайшего
CT, по разу — разбиение по раундам) и взгляд точки — средний угол про у этой точки. Роли стороны (по нынешнему первому месту роли)
получают точки: опорник (anchorA / anchorB) — ближнюю к сайту, остальные — по порядку. Пишет роли spot [x, y] и lookYaw (рад, оси игры),
место выбирает игра (140 ctSetupRole: точка роли — spot, взгляд — по lookYaw до стены); pos (зоны) — остаются запасными.
Запуск: python3 tools/ct/ct_setup_spots_bake.py --map mirage --pro=<ct_cover_pro.json> [--write]"""
import sys, os, json, math, collections
sys.path[:0] = [os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), g) for g in ('map', 'ct', 'pro', 'marks', 'logs', 'motion', 'page')]   # (15.11) модули tools/ разложены по группам
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shadow'))
import mapdir  # noqa: E402
from pro_tactics import region, SITE  # noqa: E402
MAP = mapdir.current()
YAW_W = 150   # px на единицу направления взгляда в признаке точки (проектное число)
arg = lambda k: next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--' + k + '=')), None)
import round_plan as RP  # noqa: E402


def kspots(rounds, q, n, it=30):
    """n точек стороны q по раундам: в каждом раунде ровно n CT на стороне; разбиение по раундам (жадно — ближайшие пары)"""
    R = [[p for p in r['ct'] if p[4] == q] for r in rounds]; R = [x for x in R if len(x) == n]
    if not R or n == 0: return []
    # признак точки — место и взгляд (YAW_W px на единицу направления): два CT рядом, один на Palace, другой на Ramp, — разные точки
    fe = lambda p: [p[0], p[1], YAW_W * math.cos(p[3]), YAW_W * math.sin(p[3])]
    allp = np.array([fe(p) for x in R for p in x])
    # старт — n самых далёких друг от друга из частых мест
    C = [allp[np.argmin(((allp - allp.mean(0))**2).sum(1))]]
    while len(C) < n: dd = np.min([((allp - c)**2).sum(1) for c in C], axis=0); C.append(allp[np.argmax(dd)])
    C = np.array(C, float)
    for _ in range(it):
        G = [[] for _ in range(n)]
        for x in R:
            P = np.array([fe(p) for p in x]); used = set(); free = set(range(n))
            pairs = sorted(((float(((P[i] - C[j])**2).sum()), i, j) for i in range(n) for j in range(n)))
            for d, i, j in pairs:
                if i in used or j not in free: continue
                used.add(i); free.discard(j); G[j].append(x[i])
        C = np.array([np.median([fe(p) for p in g], axis=0) if g else C[j] for j, g in enumerate(G)])
    out = []
    for j, g in enumerate(G):
        yaw = math.atan2(np.mean([math.sin(p[3]) for p in g]), np.mean([math.cos(p[3]) for p in g]))
        spread = float(np.median([math.hypot(p[0] - C[j][0], p[1] - C[j][1]) for p in g]))
        out.append({'x': round(float(C[j][0]), 1), 'y': round(float(C[j][1]), 1), 'yaw': round(yaw, 3), 'n': len(g), 'r': round(spread, 1),
                    'zone': RP.zkey(RP.zone(C[j][0], C[j][1]))})
    return out


def main():
    P = json.load(open(arg('pro'))); f = mapdir.path(MAP, 'tactics.json'); T = json.load(open(f, encoding='utf-8'))
    CS = json.load(open(mapdir.path(MAP, 'ctshare.json'), encoding='utf-8'))['struct']
    ZC = collections.defaultdict(list)
    for nm, pts in RP.ZP:
        k = RP.zkey(nm)
        if k: ZC[k] += pts
    ZC = {k: (float(np.mean([p[0] for p in v])), float(np.mean([p[1] for p in v]))) for k, v in ZC.items()}
    import re
    MC = np.array(RP.SITE_MID) if hasattr(RP, 'SITE_MID') else None
    for S in T['ctSetups']:
        m = re.search(r'(\d)-(\d)-(\d)', S.get('name', '')); st = '-'.join(m.groups()) if m else CS.get(S['id'])   # структура — из названия (A-мид-B)
        RR = [r for r in P['rounds'] if r['st'] == st]
        if not RR: print(S['id'], 'нет структуры у про', st); continue
        want = dict(zip('AMB', [int(x) for x in st.split('-')]))
        sp = {q: kspots(RR, q, want[q]) for q in 'AMB'}
        print('%s %s (%d раундов про)' % (S['id'], st, len(RR)))
        # роли: опорник A / B — ближняя к своему сайту точка своей стороны; остальные (mid, rotator, roamer) — оставшиеся точки по близости
        # к миду: мид-точки первыми, потом ближние к середине карты (проектное правило раскладки ролей)
        left = [(q, j) for q in 'AMB' for j in range(len(sp[q]))]; asg = {}
        for rn, q in (('anchorA', 'A'), ('anchorB', 'B')):
            c = [(qq, j) for qq, j in left if qq == q]
            if rn in S['roles'] and c and SITE.get(q) is not None:
                sc = SITE[q]; k = min(c, key=lambda t: math.hypot(sp[t[0]][t[1]]['x'] - sc[0], sp[t[0]][t[1]]['y'] - sc[1])); asg[rn] = k; left.remove(k)
        mid = np.mean([[r['ct'][i][0], r['ct'][i][1]] for r in RR for i in range(len(r['ct'])) if r['ct'][i][4] == 'M'] or [[1024, 1024]], axis=0)
        left.sort(key=lambda t: (t[0] != 'M', math.hypot(sp[t[0]][t[1]]['x'] - mid[0], sp[t[0]][t[1]]['y'] - mid[1])))
        for rn in ('mid', 'rotator', 'roamer'):
            if rn in S['roles'] and left: asg[rn] = left.pop(0)
        for rn, (q, j) in asg.items():
            s = sp[q][j]; ro = S['roles'][rn]
            print('   %-9s %-2s → (%6.1f, %6.1f) %-14s взгляд %4d°  разброс %.0f px' % (rn, q, s['x'], s['y'], s['zone'], round(math.degrees(s['yaw'])), s['r']))
            ro['spot'] = [s['x'], s['y']]; ro['lookYaw'] = s['yaw']
    if '--write' in sys.argv:
        open(f, 'w', encoding='utf-8').write(json.dumps(T, ensure_ascii=False, indent=1) + '\n'); print('записано', f)


if __name__ == '__main__':
    main()
