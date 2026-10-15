#!/usr/bin/env python3
"""Сборка набора карты из исходных файлов (v318, этап 2 из 3 подготовки к 7 картам).

python3 tools/map_build.py <карта> [--only шаг,шаг] [--from шаг]

Вход — папка data/maps/<карта>/: исходники карты (.txt с pos_x/pos_y/scale, .nav, радар, радар Simple Radar, demos/)
и рецепт _build.json (в объект MAP не попадает). Выход — файлы набора рядом с исходниками (map.json, radar.png,
navmesh.json, walls.json, heights.json, cover.json, zones.json, wallbang.json, pro.json, tactics.json, lineups.json).

Шаги (по порядку; рецепт говорит, какие делать для этой карты, остальные файлы набора — «заморожены», см. frozen):
  navmesh  — .nav (tools/nav36.py, перенос разбора awpy) → navmesh.json в пространстве радара 0..2048
  walls    — стены по краям навмеша: всё, что не пол навмеша, — сплошное (walls.json)
  heights  — tools/heights_bake.py --map (высоты, этажи, рампы, уступы, «крыто» по штриховке Simple Radar)
  cover    — tools/cover_bake.py --map (укрытия)
  zones    — нарезка навмеша на зоны + названия по подписям Simple Radar (tools/zones_bake.py)
  wallbang — прострелы: правила CS2 без кусков карты (пусто, этап 3) (tools/wallbang_bake.py --map)
  map      — map.json (масштаб, спавны, подсказки) и radar.png
  demos    — всё из демок про (tools/demos_bake.py --map: места про, взгляды, сетки, позиции знания, лайнапы, тактики)
Каждый шаг можно запустить отдельно (--only). Один и тот же вход даёт те же файлы.
"""
import json, math, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import mapdir  # noqa: E402

STEPS = ['navmesh', 'walls', 'heights', 'cover', 'zones', 'wallbang', 'map', 'demos']


def say(*a):
    print(*a, flush=True)


def run(script, name, *args):
    cmd = [sys.executable, os.path.join(HERE, script), '--map', name] + list(args)
    say('  $', ' '.join(os.path.relpath(c, ROOT) if os.path.isabs(c) else c for c in cmd[1:]))
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode:
        sys.exit('шаг упал: %s' % script)


def radar_txt(name, R):
    """pos_x, pos_y, scale из .txt карты (формат overview CS2)"""
    import re
    txt = open(mapdir.path(name, R['sources']['txt']), encoding='utf-8').read()
    val = lambda k: float(re.search(r'"%s"\s+"([-\d.]+)"' % k, txt).group(1))
    out = {'pos_x': val('pos_x'), 'pos_y': val('pos_y'), 'scale': val('scale')}
    for k in ('CTSpawn', 'TSpawn', 'bombA', 'bombB'):
        out[k] = [val(k + '_x'), val(k + '_y')]
    return out


def write_json_lines(path, obj, one_line_keys=()):
    """JSON: _about — с отступом, остальное поле — одной строкой (как heights.json / cover.json: читается глазами)"""
    parts = []
    for k, v in obj.items():
        if k == '_about':
            parts.append('"_about": ' + json.dumps(v, ensure_ascii=False, indent=1))
        else:
            parts.append('%s: %s' % (json.dumps(k), json.dumps(v, ensure_ascii=False, separators=(',', ':'))))
    open(path, 'w', encoding='utf-8').write('{\n' + ',\n'.join(parts) + '\n}\n')


# ---------------------------------------------------------------- navmesh
def step_navmesh(name, R):
    from nav36 import read_nav
    N = read_nav(mapdir.path(name, R['sources']['nav']))
    tr = mapdir.game_to_map(name)
    areas = []
    ids = {a['id'] for a in N['areas']}
    for a in N['areas']:
        pts = []
        for c in a['corners']:
            x, y = tr(c[0], c[1])
            pts.append({'x': round(x, 1), 'y': round(y, 1)})
        conn = []
        for b in a['conn']:
            if b != a['id'] and b in ids and b not in conn:
                conn.append(b)
        z = sum(c[2] for c in a['corners']) / len(a['corners'])
        areas.append({'id': a['id'], 'z': round(z, 1), 'points': pts, 'conn': conn})
    txt = '{"areas": [\n' + ',\n'.join(json.dumps(a, separators=(',', ':')) for a in areas) + '\n]}\n'
    open(mapdir.path(name, 'navmesh.json'), 'w', encoding='utf-8').write(txt)
    say('  navmesh.json: участков %d (версия .nav %d.%d)' % (len(areas), N['version'], N['sub_version']))


# ---------------------------------------------------------------- walls
WALL_GROW = 3      # пол навмеша расширяется на 3 ед. карты (7,5 ед. игры): щели между участками — не стены
WALL_SIMPLIFY = 3.0  # упрощение контура стены, ед. карты (7,5 ед. игры); отрезков ~1000 (Ancient — 589): игра перебирает все
WALL_MIN = 40      # кусок «не пол» меньше 40 ед.² (дырка в навмеше на ровном месте) — не стена
WALL_PAD = 40      # стены — до 40 ед. карты за краем навмеша, дальше пустота (её никто не видит и не пересекает)
WALL_TILE = 1024   # сплошное режется на квадраты (четверти карты), квадрат с островком пола внутри — ещё на 4, …


def _simplify(P, eps):
    """Дуглас—Пекер для замкнутого контура"""
    def dp(pts):
        if len(pts) < 3:
            return pts
        (x0, y0), (x1, y1) = pts[0], pts[-1]
        L = math.hypot(x1 - x0, y1 - y0) or 1e-9
        best, bi = -1, 0
        for i in range(1, len(pts) - 1):
            d = abs((x1 - x0) * (y0 - pts[i][1]) - (x0 - pts[i][0]) * (y1 - y0)) / L
            if d > best:
                best, bi = d, i
        if best <= eps:
            return [pts[0], pts[-1]]
        return dp(pts[:bi + 1])[:-1] + dp(pts[bi:])
    far = max(range(len(P)), key=lambda i: (P[i][0] - P[0][0]) ** 2 + (P[i][1] - P[0][1]) ** 2)
    a = dp(P[:far + 1]); b = dp(P[far:] + [P[0]])
    return a[:-1] + b[:-1]


def _area(P):
    return abs(sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))) / 2


def step_walls(name, R):
    """Стены = всё, что не пол. Пол — участки навмеша (на любой высоте), расширенные на WALL_GROW. Сплошное — полоса
    шириной WALL_PAD вокруг пола плюс все закрытые «дыры» внутри (колонны, стены между проходами). Сплошное режется на
    четверти карты (и мельче — только где внутри куска островок пола), чтобы каждый кусок был простым многоугольником
    без дыр (игра считает стену многоугольником). Куски внешнего контура — большие (> 60000 ед.², как у Ancient):
    tools/cover_bake.py не считает их укрытиями."""
    import numpy as np
    from PIL import Image, ImageDraw
    from scipy import ndimage
    import contourpy
    S = 2048
    im = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(im)
    for a in mapdir.load_nav(name):
        d.polygon([(p['x'], p['y']) for p in a['points']], fill=255, outline=255)
    floor = np.asarray(im) > 0
    floor = ndimage.binary_dilation(floor, iterations=WALL_GROW)
    floor = ndimage.binary_closing(floor, iterations=2)
    near = ndimage.binary_dilation(floor, iterations=WALL_PAD)
    lab, n = ndimage.label(~floor)
    outside = lab == lab[0, 0]
    solid = (~floor) & (near | ~outside)
    # мелкие «не пол» (дырка в навмеше посреди площадки) — не стены
    lab, n = ndimage.label(solid)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    for i, s in enumerate(sizes):
        if s < WALL_MIN:
            solid[lab == i + 1] = False
    polys = []

    def tile(tx, ty, T):
        """квадрат T×T: куски сплошного без дыр — стены; кусок с дырой (островок пола) — квадрат делится на 4"""
        z = np.zeros((T + 2, T + 2), dtype=float)
        z[1:-1, 1:-1] = solid[ty:ty + T, tx:tx + T]
        if not z.any():
            return
        pts_offs = list(zip(*contourpy.contour_generator(z=z, line_type='SeparateCode', fill_type='OuterOffset').filled(0.5, 2.0)))
        if any(len(o) > 2 for _, o in pts_offs) and T > 32:
            h = T // 2
            for dy in (0, h):
                for dx in (0, h):
                    tile(tx + dx, ty + dy, h)
            return
        for pts, offs in pts_offs:
            if len(offs) > 2:
                say('  ! островок пола внутри стены у (%.0f, %.0f) — остаётся стеной' % (pts[offs[1]][0] + tx, pts[offs[1]][1] + ty))
            P = [(min(S, max(0, float(x) - 1 + tx)), min(S, max(0, float(y) - 1 + ty))) for x, y in pts[offs[0]:offs[1]][:-1]]
            P = _simplify(P, WALL_SIMPLIFY)
            if len(P) >= 3 and _area(P) >= WALL_MIN:
                polys.append([[round(x, 1), round(y, 1)] for x, y in P])

    for ty in range(0, S, WALL_TILE):
        for tx in range(0, S, WALL_TILE):
            tile(tx, ty, WALL_TILE)
    txt = '{\n"polys": ' + json.dumps(polys, separators=(',', ':')) + '\n}\n'
    open(mapdir.path(name, 'walls.json'), 'w', encoding='utf-8').write(txt)
    say('  walls.json: стен %d, отрезков %d' % (len(polys), sum(len(p) for p in polys)))


# ---------------------------------------------------------------- шаги через bake-скрипты
def step_heights(name, R):
    sr = R.get('sources', {}).get('simpleRadar')
    run('heights_bake.py', name, *(['--simple-radar', mapdir.path(name, sr)] if sr else []))


def step_cover(name, R):
    run('cover_bake.py', name)


def step_zones(name, R):
    run('zones_bake.py', name)


def step_wallbang(name, R):
    run('wallbang_bake.py', name)


def step_demos(name, R):
    run('demos_bake.py', name)


def step_map(name, R):
    """map.json и radar.png: масштаб из .txt, спавны — точки зон с ролями CTspawn/Tspawn (zones.json)"""
    src = R['sources']
    shutil.copyfile(mapdir.path(name, src['radar']), mapdir.path(name, 'radar.png'))
    rad = radar_txt(name, R)
    Z = json.load(open(mapdir.path(name, 'zones.json'), encoding='utf-8'))['zonemap']
    sp = {p['name'].split('_')[0]: p for p in Z['points']}
    M = R['map']
    meta = {'id': name, 'name': M['name'], 'store': name + '-live-radar', 'db': 'map-' + name, 'radar': 'radar.png',
            'pxUnits': rad['scale'] / 2, 'zoneLayer': {'dx': 0, 'dy': 0, 'scale': 1},
            'spawns': {'CT': sp['CTspawn']['name'], 'T': sp['Tspawn']['name']},
            'spawnFix': {'T': {'x': sp['Tspawn']['x'], 'y': sp['Tspawn']['y']}},   # игра берёт точку спавна T отсюда (у Ancient — поправка)
            'siteAFix': None,
            'ui': M.get('ui', {})}
    open(mapdir.path(name, 'map.json'), 'w', encoding='utf-8').write(json.dumps(meta, ensure_ascii=False, indent=1) + '\n')
    say('  map.json, radar.png (pxUnits %.2f)' % meta['pxUnits'])


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith('-'):
        sys.exit(__doc__)
    name = args[0]
    R = mapdir.recipe(name)
    if not R:
        sys.exit('нет рецепта data/maps/%s/_build.json' % name)
    steps = R.get('steps', [])
    if '--only' in args:
        want = args[args.index('--only') + 1].split(',')
        steps = [s for s in steps if s in want]
    if '--from' in args:
        f = args[args.index('--from') + 1]
        steps = steps[steps.index(f):]
    say('карта %s: шаги %s; заморожено: %s' % (name, ', '.join(steps) or '—', ', '.join(sorted(R.get('frozen', {}))) or '—'))
    for s in steps:
        say('[%s]' % s)
        globals()['step_' + s](name, R)
    for f in R.get('frozen', {}):
        if not os.path.exists(mapdir.path(name, f)):
            sys.exit('замороженного файла нет: %s' % f)


if __name__ == '__main__':
    main()
