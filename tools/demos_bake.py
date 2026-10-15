#!/usr/bin/env python3
"""Всё из демок про для набора карты (v318): шаг demos в tools/map_build.py.

python3 tools/demos_bake.py --map <карта> [--only скрипт,скрипт] [--assemble]

По порядку (каждый — отдельный bake-скрипт с --map; промежуточное — в <pro_dir>, у новых карт data/maps/<карта>/pro/):
  pro.py                   — сэмплы «где стоят и куда смотрят» (pro_samples.csv.gz)
  progrid_bake.py          — места, сетка «где стоят», взгляды (progrid.json → pro.json: spots, prior, look)
  lineups.py, cluster.py   — гранаты и лайнапы про (pro_nades.csv, pro_lineups.json → lineups.json: pro, proExtra)
  positions_bake.py        — позиции «где стоит → что держит», раскладки CT, выходы T (positions.json, setups.json)
  player_positions_bake.py — кто из наших 10 игроков где стоял и с чем; «не сработало — меняю место» (player_positions.json)
  tactics_bake.py --game   — тактики T и расстановки CT для игры (tactics_game.json → tactics.json)
  roles_bake.py            — роли наших игроков на этой карте (player_roles.json → tactics.json, playerRoles)
  jumps_bake.py            — места прыжка-чека про (jumps.json → pro.json, jumps)
Потом сборка файлов набора: границы сайтов по плантам (zones.json, sites), pro.json, lineups.json, tactics.json
(--assemble — только она).
Отбор лайнапов в набор (как у Ancient v166): pro — частота ≥ 5 % раундов ситуации; proExtra (при BAL.nadeMore) — 1,5–5 %
и хотя бы 3 матча; везде — от 4 бросков; пост-плант и ретейк не берутся (их бросают встроенные решения игры).
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mapdir  # noqa: E402

MAPNAME = mapdir.current()
SCRIPTS = [('pro.py',), ('progrid_bake.py',), ('lineups.py',), ('cluster.py',), ('positions_bake.py',),
           ('player_positions_bake.py',), ('tactics_bake.py', '--game'), ('roles_bake.py',), ('jumps_bake.py',)]
PRO_MIN, EXTRA_MIN, EXTRA_MATCHES, N_MIN = 0.05, 0.015, 3, 4


def run(args):
    cmd = [sys.executable, os.path.join(HERE, args[0]), '--map', MAPNAME] + list(args[1:])
    print('  $', ' '.join(['tools/' + args[0], '--map', MAPNAME] + list(args[1:])), flush=True)
    r = subprocess.run(cmd, cwd=mapdir.ROOT, stderr=subprocess.DEVNULL)
    if r.returncode:
        sys.exit('упал %s' % args[0])


def write_pro(PRO):
    g = json.load(open(os.path.join(PRO, 'progrid.json'), encoding='utf-8'))
    pos = json.load(open(os.path.join(PRO, 'positions.json'), encoding='utf-8'))
    pp = json.load(open(os.path.join(PRO, 'player_positions.json'), encoding='utf-8'))
    pts = []
    for p in pos['points']:
        q = pp['points'].get(p['id'], {})
        pts.append({'id': p['id'], 'side': p['side'], 'type': p['type'], 'push': p['push'], 'x': p['x'], 'y': p['y'],
                    'share': p['share'], 'spread': p['spread'], 'spots': [[s['x'], s['y'], s['share']] for s in p['spots']],
                    'n': q.get('rounds', 0), 'byP': q.get('byPlayer', {}), 'byW': q.get('byWeapon', {}),
                    'w': pp.get('with', {}).get(p['id'], {})})
    out = {'spots': g['spots'], 'positions': {'rounds': pos['rounds'], 'repeat': pp['repeat'], 'points': pts},
           'prior': g['prior'], 'look': g['look']}
    jf = os.path.join(PRO, 'jumps.json')
    if os.path.exists(jf):   # (v334, М58) места прыжка-чека про
        out['jumps'] = [{k: j[k] for k in ('x', 'y', 'side', 'rate')} for j in json.load(open(jf, encoding='utf-8'))['spots']]
    open(mapdir.path(MAPNAME, 'pro.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('  pro.json: мест %s, позиций %d, слоёв prior %d, look %d' % ({k: len(v) for k, v in g['spots'].items()}, len(pts),
                                                                   len(g['prior']['layers']), len(g['look']['layers'])))


def write_lineups(PRO):
    L = json.load(open(os.path.join(PRO, 'pro_lineups.json'), encoding='utf-8'))
    L = [l for l in L if l['trigger'] not in ('postplant', 'retake') and l['n'] >= N_MIN]
    keep = ('team', 'type', 'trigger', 'site', 'name', 'from', 'to', 'prob', 'at', 'n')
    pro = [dict({'id': 'pro%d' % i}, **{k: l[k] for k in keep}) for i, l in enumerate(x for x in L if x['prob'] >= PRO_MIN)]
    ext = [dict({'id': 'prx%d' % i}, **{k: l[k] for k in keep})
           for i, l in enumerate(x for x in L if EXTRA_MIN <= x['prob'] < PRO_MIN and x['matches'] >= EXTRA_MATCHES)]
    out = {'pro': pro, 'proExtra': ext, 'baked': [], 'builtinOff': {}}
    open(mapdir.path(MAPNAME, 'lineups.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print('  lineups.json: pro %d, proExtra %d' % (len(pro), len(ext)))


SITE_Q, SITE_PAD = 0.97, 10   # граница сайта: места 97 % плантов (дальние — выбросы), отступ 10 ед. карты — проектные числа


def red_sites():
    """(v321) зона планта по Simple Radar: красные квадраты сайтов (там плант возможен, кроме ящиков и укрытий) — контур
    закрашенного красного (буква и ящики внутри квадрата — тоже сайт), координаты карты 0..2048; {A|B: [[x, y], …]}"""
    import numpy as np
    from PIL import Image
    from scipy import ndimage
    import contourpy
    sr = mapdir.recipe(MAPNAME).get('sources', {}).get('simpleRadar')
    if not sr:
        return None
    im = np.asarray(Image.open(mapdir.path(MAPNAME, sr)).convert('RGB')).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    m = (abs(r - 90) < 20) & (abs(g - 32) < 15) & (abs(b - 46) < 15)
    white = (r > 200) & (g > 200) & (b > 200)
    lab0, n0 = ndimage.label(ndimage.binary_closing(m, iterations=6))
    for i, sl in enumerate(ndimage.find_objects(lab0)):   # буква сайта (белая) внутри квадрата — тоже сайт
        if sl is not None and (lab0[sl] == i + 1).sum() > 200:
            m[sl] |= white[sl]
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=2))
    lab, n = ndimage.label(m)
    pts = mapdir.site_points(MAPNAME)
    out = {}
    for k, (px, py) in pts.items():
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        best = max(range(1, n + 1), key=lambda i: sizes[i - 1] / (1 + np.hypot(*(np.array(ndimage.center_of_mass(lab == i))[::-1] * 2 - (px, py))) / 100))
        part = lab == best
        z = np.pad(part.astype(float), 1)
        P, O = contourpy.contour_generator(z=z, line_type='SeparateCode', fill_type='OuterOffset').filled(0.5, 2.0)
        ring = max((p[o[0]:o[1]] for p, o in zip(P, O)), key=len)
        out[k] = [[round((float(x) - 1) * 2, 1), round((float(y) - 1) * 2, 1)] for x, y in ring[:-1]]
    return out


def write_sites():
    """(v321) граница сайтов «как в игре»: красные квадраты Simple Radar (red_sites), а без Simple Radar — оболочка мест
    плантов про из демок с отступом → zones.json, поле sites {A: [[x, y], …], B: …}; точки Asite/Bsite — середина плантов"""
    import numpy as np
    from scipy.spatial import ConvexHull
    sys.argv[1:] = ['--map', MAPNAME]
    import demos as D
    P = {'A': [], 'B': []}
    for dm in D.demo_names():
        for r in D.rounds_of(dm):
            if r['site'] in P and r['plantXY']:
                P[r['site']].append(r['plantXY'])
    f = mapdir.path(MAPNAME, 'zones.json')
    Z = json.load(open(f, encoding='utf-8'))
    sites = red_sites() or {}
    src = 'красные квадраты Simple Radar' if sites else 'места плантов'
    for k, pts in P.items():
        X = np.array(pts)
        c = np.median(X, axis=0)
        if k not in sites:
            d = np.hypot(*(X - c).T)
            X = X[d <= np.quantile(d, SITE_Q)]
            H = X[ConvexHull(X).vertices]
            cc = H.mean(axis=0)
            H = cc + (H - cc) * (1 + SITE_PAD / np.maximum(1, np.hypot(*(H - cc).T)))[:, None]
            sites[k] = [[round(float(x), 1), round(float(y), 1)] for x, y in H]
        for p in Z['zonemap']['points']:
            if p['name'].startswith(k + 'site'):
                p['x'], p['y'] = int(round(c[0])), int(round(c[1]))
    Z['sites'] = sites
    open(f, 'w', encoding='utf-8').write(json.dumps(Z, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('  zones.json: границы сайтов — %s (плантов A %d, B %d)' % (src, len(P['A']), len(P['B'])))


def write_tactics(PRO):
    T = json.load(open(os.path.join(PRO, 'tactics_game.json'), encoding='utf-8'))
    for t in T['tTactics']:
        t.pop('n', None)
    rf = os.path.join(PRO, 'player_roles.json')
    if os.path.exists(rf):   # (v321, М21) роли игроков на этой карте — по демкам (tools/roles_bake.py)
        T['playerRoles'] = {n: {'CT': v['CT'], 'T': v['T']} for n, v in json.load(open(rf, encoding='utf-8')).items()}
    open(mapdir.path(MAPNAME, 'tactics.json'), 'w', encoding='utf-8').write(json.dumps(T, ensure_ascii=False, indent=1) + '\n')
    print('  tactics.json: T %d, CT %d' % (len(T['tTactics']), len(T['ctSetups'])))


def main():
    PRO = mapdir.pro_dir(MAPNAME)
    if '--assemble' not in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
        for s in SCRIPTS:
            if only is None or s[0] in only:
                run(s)
    write_sites()
    write_pro(PRO)
    write_lineups(PRO)
    write_tactics(PRO)


if __name__ == '__main__':
    main()
