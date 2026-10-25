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
  zones3d  — (А5) зоны по подписям владельца из 3D-геометрии игры (tools/map3d/zones_game.py; Mirage — вместо zones)
  wallbang — прострелы: правила CS2 без кусков карты (пусто, этап 3) (tools/wallbang_bake.py --map)
  map      — map.json (масштаб, спавны, подсказки) и radar.png
  demos    — всё из демок про (tools/demos_bake.py --map: места про, взгляды, сетки, позиции знания, лайнапы, тактики,
             границы сайтов)
  spawns   — точки спавна из демок (tools/spawns_bake.py --map → map.json, spawnSpots)
  checklooks — (v421) проверка: взгляды расстановок CT не заданы одним именем зоны и не упираются в стену (tools/ct_look_check.js,
             видимость игры; набор не меняет, отчёт _looks_report.json). Последний шаг: проверяет уже собранный набор
Каждый шаг можно запустить отдельно (--only). Один и тот же вход даёт те же файлы.
"""
import json, math, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import mapdir  # noqa: E402

STEPS = ['navmesh', 'walls', 'heights', 'cover', 'zones', 'zones3d', 'wallbang', 'map', 'demos', 'spawns', 'checklooks']


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
            # (v336) высота угла (ед. игры): участок на лестнице/пандусе наклонный, высота центра у соседей разная, а на
            # общем ребре — одна; по ней игра отличает ступени/пандус от настоящего уступа (прыжок)
            pts.append({'x': round(x, 1), 'y': round(y, 1), 'z': round(c[2], 1)})
        conn = []
        for b in a['conn']:
            if b != a['id'] and b in ids and b not in conn:
                conn.append(b)
        z = sum(c[2] for c in a['corners']) / len(a['corners'])
        areas.append({'id': a['id'], 'z': round(z, 1), 'points': pts, 'conn': conn})
    # (v320) лестницы (ladder): участки, которых касается низ и верх одной лестницы, — связь в обе стороны
    lad = {}
    for a in N['areas']:
        for l in a['ladders_below']:
            lad.setdefault(l, [[], []])[0].append(a['id'])
        for l in a['ladders_above']:
            lad.setdefault(l, [[], []])[1].append(a['id'])
    by = {a['id']: a for a in areas}
    ladders = []
    for l, (lo, hi) in sorted(lad.items()):
        for x in lo:
            for y in hi:
                if y not in by[x]['conn']: by[x]['conn'].append(y)
                if x not in by[y]['conn']: by[y]['conn'].append(x)
        ladders.append({'id': l, 'below': lo, 'above': hi})
    txt = ('{"ladders": ' + json.dumps(ladders, separators=(',', ':')) + ',\n"areas": [\n' +
           ',\n'.join(json.dumps(a, separators=(',', ':')) for a in areas) + '\n]}\n')
    open(mapdir.path(name, 'navmesh.json'), 'w', encoding='utf-8').write(txt)
    one = sum(1 for a in areas for b in a['conn'] if a['id'] not in by[b]['conn'])
    say('  navmesh.json: участков %d, лестниц %d, связей «только спрыгнуть» %d (версия .nav %d.%d)' % (
        len(areas), len(ladders), one, N['version'], N['sub_version']))


# ---------------------------------------------------------------- walls
BRIDGE = 8         # щель между связанными участками до 2×8 ед. карты (40 ед. игры) — пол (уступы, ступени, спуски) — проектное число
WALL_GAP = 2       # стена отступает от пола на 2 ед. карты (5 ед. игры) — проектное число
WALL_SIMPLIFY = 1.5  # упрощение контура стены, ед. карты: меньше отступа — стена не заходит на пол
RADAR_DARK = 45    # (v375) «чёрное» на радаре: яркость меньше — проектное число (стены радара 0–30, пол — от 60)
WALL_MIN = 40      # кусок «не пол» меньше 40 ед.² (дырка в навмеше на ровном месте) — не стена
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
    """Стены = всё, что не пол (v320). Пол — участки навмеша на любой высоте плюс «перемычки» там, где навмеш связывает
    участки через щель (спрыгнуть, запрыгнуть, лестница): стена не должна перекрывать связь. Сплошное — всё остальное до
    края карты (на радаре это чёрное), отступив от пола на WALL_GAP; упрощение контура меньше отступа, поэтому стена
    нигде не заходит на пол. Сплошное режется на четверти карты (и мельче — только где внутри куска островок пола),
    чтобы каждый кусок был простым многоугольником без дыр (игра считает стену многоугольником). Куски внешнего
    контура — большие (> 60000 ед.², как у Ancient): tools/cover_bake.py не считает их укрытиями.
    После сборки — проверка связности как в игре (участок в стене, связь сквозь стену): печатает пропавшие связи."""
    import numpy as np
    from PIL import Image, ImageDraw
    from scipy import ndimage
    import contourpy
    S = 2048
    im = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(im)
    nav = mapdir.load_nav(name)
    by = {a['id']: a for a in nav}
    for a in nav:
        d.polygon([(p['x'], p['y']) for p in a['points']], fill=255, outline=255)
    # перемычки: щель между связанными участками (уступ, ступенька, спуск, лестница) — пол: пересечение обоих участков,
    # расширенных на BRIDGE ед., внутри оболочки пары — ровно полоса между ними, ничего лишнего
    from scipy.spatial import ConvexHull
    BR = np.zeros((S, S), bool)
    def amask(P, x0, y0, w, h):
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).polygon([(x - x0, y - y0) for x, y in P], fill=1, outline=1)
        return np.asarray(m).astype(bool)
    for a in nav:
        for bid in a['conn']:
            b = by.get(bid)
            if not b or bid < a['id'] and a['id'] in b['conn']:
                continue
            PA = [(p['x'], p['y']) for p in a['points']]; PB = [(p['x'], p['y']) for p in b['points']]
            xs = [p[0] for p in PA + PB]; ys = [p[1] for p in PA + PB]
            x0, y0 = max(0, int(min(xs)) - BRIDGE - 2), max(0, int(min(ys)) - BRIDGE - 2)
            x1, y1 = min(S, int(max(xs)) + BRIDGE + 3), min(S, int(max(ys)) + BRIDGE + 3)
            w, h = x1 - x0, y1 - y0
            ma = ndimage.binary_dilation(amask(PA, x0, y0, w, h), iterations=BRIDGE)
            mb = ndimage.binary_dilation(amask(PB, x0, y0, w, h), iterations=BRIDGE)
            try:      # и только внутри оболочки пары — линза не вылезает наружу за край пола (зубцы на стене)
                H = ConvexHull(PA + PB)
                hm = amask([(PA + PB)[i] for i in H.vertices], x0, y0, w, h)
            except Exception:
                hm = np.ones((h, w), bool)
            BR[y0:y1, x0:x1] |= ma & mb & hm
    base = np.asarray(im) > 0
    prev_cut = None
    for attempt in range(4):
        floor = base | BR
        floor = ndimage.binary_closing(floor, iterations=2)     # щели между участками меньше 2 ед. — пол
        solid = ~ndimage.binary_dilation(floor, iterations=WALL_GAP)
        # (v375, владелец: «у Ancient стены ровно по чёрному радара, а у Mirage — по навмешу, а он уже: стены шире») навмеш
        # отступает от настоящих стен на полкорпуса игрока (~16 ед. игры): стены «не пол» шире чёрного радара на 5,7 px медиана
        # (p90 13). wallsFrom = "radar": стена — где радар чёрный (или прозрачный — за картой) и нет пола
        if R.get('wallsFrom') == 'radar':
            rim = Image.open(mapdir.path(name, 'radar.png')).convert('RGBA').resize((S, S), Image.NEAREST)
            ra = np.asarray(rim).astype(float)
            dark = ((0.3 * ra[..., 0] + 0.59 * ra[..., 1] + 0.11 * ra[..., 2]) < RADAR_DARK) | (ra[..., 3] < 20)
            solid = dark & ~floor
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
            if any(len(o) > 2 for _, o in pts_offs) and T > 4:
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
        blocked, cut = check_links(name, polys)
        if not cut or set(cut) == prev_cut:
            if cut:
                say('    оставшиеся связи идут через препятствие (ящик, тележка, перила, окно) — стена там настоящая')
            break
        prev_cut = set(cut)
        # добивка: пары, чья связь всё ещё упирается в стену, — перемычка без ограничения оболочкой
        for aid, bid, _, _ in cut:
            PA = [(p['x'], p['y']) for p in by[aid]['points']]; PB = [(p['x'], p['y']) for p in by[bid]['points']]
            xs = [p[0] for p in PA + PB]; ys = [p[1] for p in PA + PB]
            x0, y0 = max(0, int(min(xs)) - BRIDGE - 2), max(0, int(min(ys)) - BRIDGE - 2)
            x1, y1 = min(S, int(max(xs)) + BRIDGE + 3), min(S, int(max(ys)) + BRIDGE + 3)
            BR[y0:y1, x0:x1] |= (ndimage.binary_dilation(amask(PA, x0, y0, x1 - x0, y1 - y0), iterations=BRIDGE) &
                                 ndimage.binary_dilation(amask(PB, x0, y0, x1 - x0, y1 - y0), iterations=BRIDGE))
        say('    добивка %d: перемычек без оболочки %d' % (attempt + 1, len(cut)))


def check_links(name, polys):
    """связность как в игре (rebuildNav): участок выкидывается, если ≥ 60 % его точек (центр + углы, сдвинутые к центру
    на 35 %) внутри стены; связь — если отрезок «чуть внутри A → середина стыка → чуть внутри B» задевает стену"""
    import numpy as np
    from PIL import Image, ImageDraw
    m = Image.new('L', (2048, 2048), 0)
    d = ImageDraw.Draw(m)
    for P in polys:
        d.polygon([tuple(p) for p in P], fill=1)
    W = np.asarray(m).astype(bool)
    inw = lambda x, y: 0 <= int(x) < 2048 and 0 <= int(y) < 2048 and W[int(y), int(x)]
    nav = mapdir.load_nav(name)
    by = {a['id']: a for a in nav}
    cen = {a['id']: (sum(p['x'] for p in a['points']) / len(a['points']), sum(p['y'] for p in a['points']) / len(a['points'])) for a in nav}
    blocked = set()
    for a in nav:
        c = cen[a['id']]
        pts = [c] + [(p['x'] + (c[0] - p['x']) * 0.35, p['y'] + (c[1] - p['y']) * 0.35) for p in a['points']]
        if sum(inw(*q) for q in pts) >= max(1, -(-len(pts) * 6 // 10)):
            blocked.add(a['id'])
    cut = []
    for a in nav:
        for bid in a['conn']:
            if bid not in by or bid < a['id'] and a['id'] in by[bid]['conn']:
                continue
            b = by[bid]
            # стык: общие углы (как общий край у игры) — пробуем середину и точки вдоль края; нет общего края — ближайшие углы
            sh = [(p['x'], p['y']) for p in a['points'] if any((p['x'] - q['x']) ** 2 + (p['y'] - q['y']) ** 2 < 1 for q in b['points'])]
            if len(sh) >= 2:
                (x0, y0), (x1, y1) = max(((u, v) for u in sh for v in sh), key=lambda t: (t[0][0] - t[1][0]) ** 2 + (t[0][1] - t[1][1]) ** 2)
                mids = [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) for t in (0.5, 0.12, 0.25, 0.38, 0.62, 0.75, 0.88)]
            else:
                pa, pb = min(((p, q) for p in a['points'] for q in b['points']),
                             key=lambda t: (t[0]['x'] - t[1]['x']) ** 2 + (t[0]['y'] - t[1]['y']) ** 2)
                mids = [((pa['x'] + pb['x']) / 2, (pa['y'] + pb['y']) / 2)]
            hit = True
            for mid in mids:
                ends = []
                for c in (cen[a['id']], cen[bid]):
                    L = max(1e-6, ((c[0] - mid[0]) ** 2 + (c[1] - mid[1]) ** 2) ** 0.5)
                    e = min(14, L)
                    ends.append((mid[0] + (c[0] - mid[0]) / L * e, mid[1] + (c[1] - mid[1]) / L * e))
                if not any(inw(ends[0][0] + (mid[0] - ends[0][0]) * t, ends[0][1] + (mid[1] - ends[0][1]) * t) or
                           inw(mid[0] + (ends[1][0] - mid[0]) * t, mid[1] + (ends[1][1] - mid[1]) * t) for t in [i / 10 for i in range(11)]):
                    hit = False
                    break
            if hit:
                cut.append((a['id'], bid, round(mids[0][0]), round(mids[0][1])))
    say('  проверка связности: участков в стене %d, связей сквозь стену %d' % (len(blocked), len(cut)))
    for x in sorted(blocked)[:10]:
        say('    ! участок %d в стене (около %.0f, %.0f)' % (x, cen[x][0], cen[x][1]))
    for x in cut[:10]:
        say('    ! связь %d–%d сквозь стену (около %d, %d)' % x)
    return blocked, cut


# ---------------------------------------------------------------- шаги через bake-скрипты
def step_heights(name, R):
    sr = R.get('sources', {}).get('simpleRadar')
    run('heights_bake.py', name, *(['--simple-radar', mapdir.path(name, sr)] if sr else []))


def step_cover(name, R):
    run('cover_bake.py', name)


def step_zones(name, R):
    run('zones_bake.py', name)


def step_zones3d(name, R):
    """(А5) зоны по подписям владельца из 3D-геометрии игры: geom3d/zones_owner.json (tools/map3d/zones_owner.py) → zones.json"""
    run('map3d/zones_game.py', name)


def step_wallbang(name, R):
    run('wallbang_bake.py', name)


def step_demos(name, R):
    run('demos_bake.py', name)


def step_spawns(name, R):
    run('spawns_bake.py', name)


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


LOOK_ISSUE = {'zone': 'взгляд задан именем зоны, нет точки из демок (lookPt)', 'wall': 'обзор по направлению взгляда закрыт ближе 150 — смотрит в стену',
              'nozone': 'позиция или взгляд не нашлись среди зон карты', 'nospot': 'у позиции не нашлось места'}
LOOK_NOTE = {'far': 'замечание: направление открыто, но сама точка взгляда за препятствием'}


def step_checklooks(name, R):
    """(v421) проверка взглядов расстановок CT (tactics.json → ctSetups) той же логикой, что в игре: tools/ct_look_check.js на сборке
    sim.html этой карты. Только наблюдает — набор не меняет; отчёт — _looks_report.json (в MAP не попадает), итог — в консоль."""
    sim = os.path.join(tempfile.mkdtemp(), 'sim.html')
    subprocess.run([sys.executable, os.path.join(ROOT, 'src', 'build.py'), '--map', name, sim], check=True, stdout=subprocess.DEVNULL)
    rep = mapdir.path(name, '_looks_report.json')
    try:
        subprocess.run(['node', os.path.join(HERE, 'ct_look_check.js'), sim, rep], check=True)
    finally:
        os.remove(sim)
    rows = json.load(open(rep, encoding='utf-8'))['rows']
    bad = [r for r in rows if set(r['issues']) & set(LOOK_ISSUE)]
    say('  взглядов CT проверено: %d, с ошибками: %d (отчёт _looks_report.json)' % (len(rows), len(bad)))
    for k, txt in list(LOOK_ISSUE.items()) + list(LOOK_NOTE.items()):
        n = [r for r in rows if k in r['issues']]
        if not n: continue
        say('  %s — %d:' % (txt, len(n)))
        for r in n[:40]:
            say('    %s / %s%s: стоит %s → смотрит %s%s' % (r['setup'], r['role'], ' (ранний выход)' if r['phase'] else '', r['pos'], r['look'] or 'на опорную точку',
                                                   ', обзор %d из %d' % (r['open'], r['dist']) if 'open' in r and k in ('wall', 'far') else ''))


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
