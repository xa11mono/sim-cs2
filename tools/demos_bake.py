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
Потом сборка файлов набора: pro.json, lineups.json, tactics.json (--assemble — только она).
Отбор лайнапов в набор (как у Ancient v166): pro — частота ≥ 5 % раундов ситуации; proExtra (при BAL.nadeMore) — 1,5–5 %
и хотя бы 3 матча; везде — от 4 бросков; пост-плант и ретейк не берутся (их бросают встроенные решения игры).
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mapdir  # noqa: E402

MAPNAME = mapdir.current()
SCRIPTS = [('pro.py',), ('progrid_bake.py',), ('lineups.py',), ('cluster.py',), ('positions_bake.py',),
           ('player_positions_bake.py',), ('tactics_bake.py', '--game')]
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


def write_tactics(PRO):
    T = json.load(open(os.path.join(PRO, 'tactics_game.json'), encoding='utf-8'))
    for t in T['tTactics']:
        t.pop('n', None)
    open(mapdir.path(MAPNAME, 'tactics.json'), 'w', encoding='utf-8').write(json.dumps(T, ensure_ascii=False, indent=1) + '\n')
    print('  tactics.json: T %d, CT %d' % (len(T['tTactics']), len(T['ctSetups'])))


def main():
    PRO = mapdir.pro_dir(MAPNAME)
    if '--assemble' not in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
        for s in SCRIPTS:
            if only is None or s[0] in only:
                run(s)
    write_pro(PRO)
    write_lineups(PRO)
    write_tactics(PRO)


if __name__ == '__main__':
    main()
