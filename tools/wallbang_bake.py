#!/usr/bin/env python3
"""Прострелы Ancient: правила CS2 + разметка карты → src/data/wallbang.json.

python3 tools/wallbang_bake.py [--report]

Что пишет (повторяемо — один и тот же вход даёт тот же файл):
  * rules — формула урона через стену (как в CS:GO/CS2, см. RULES ниже и _about);
  * weapons — «пробитие» оружия CS2 (1 — пистолеты и SMG, 2 — Deagle, R8,
    винтовки, пулемёты, дробовики по источнику, 2,5 — снайперки);
  * materials — материалы поверхностей: модификатор пробития и цвет на радаре
    (числа — surfaceproperties CS:GO, Valve Developer Wiki);
  * items — простреливаемые куски стен и укрытий Ancient. Список — ниже (SPOTS):
    место, материал, толщина в единицах игры, откуда знаем (ссылка или
    «предположение» и почему). Остальная карта — камень/бетон толще 90 ед.,
    не простреливается (Ancient — каменный храм; толщина стен на радаре 30+ ед.
    карты = 75+ ед. игры).
Привязка к стенам — как у укрытий (cover.json): у куска есть точка pt внутри
стены; shape "wall" — форма = та стена walls.json, внутри которой сейчас pt
(ящик целиком); shape "piece" — своя форма poly (часть большой стены). Правки
стен не ломают разметку: pt остаётся внутри.
radar_t — толщина стены на радаре в точке pt (кратчайшая хорда, ед. игры) —
только для сведения: радар грубый, тонкие доски на нём не видны; урон
считается по t (толщина самого простреливаемого куска).
Правки владельца (вкладка «прострелы», документ map/wallbang) — поле own;
вписывает tools/map_pull.py, этот скрипт его сохраняет.
--report — напечатать список и урон AK/AWP через каждый кусок.
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
from heights_bake import point_in, area, namer, MAPNAME, MAP_TITLE   # noqa: E402

OUT = mapdir.path(MAPNAME, 'wallbang.json')
UNIT = mapdir.radar(MAPNAME)['scale'] / 2   # 1 ед. карты (радар 2048) = scale/2 ед. игры (Ancient, Mirage: 2,5)

SRC = {
    'demos': 'демки про этой карты (data/maps/<карта>/demos, player_death: penetrated)',
    'valve_patch': 'https://esportsinsider.com/2025/08/cs2-august-18-update-ancient-changes',
    'gfinity': 'https://www.gfinityesports.com/article/ancient-and-shoots-receives-some-modifications-with-the-latest-cs2-patch',
    'skinclub': 'https://community.skin.club/en/articles/best-wallbang-spots-ancient-cs2',
    'sportskeeda': 'https://sportskeeda.com/esports/best-wall-bang-spots-ancient-cs2',
    'surfaces': 'https://developer.valvesoftware.com/wiki/List_of_CS:GO_Surface_Types',
    'tradeit': 'https://tradeit.gg/blog/cs2-weapon-stats/',
    'csmoney': 'https://cs.money/blog/games/death-through-the-wall/',
    'fandom': 'https://counterstrike.fandom.com/wiki/Bullet_Penetration',
}

# Формула (CS:GO cs_player_shared.cpp, HandleBulletPenetration; CS2 по проверкам
# игроков ведёт себя так же). Числа формулы — по исходному коду CS:GO; на
# найденных страницах они не процитированы (там только «до 4 препятствий»,
# «пробитие 1/2/2,5», модификаторы материалов) — сверить, когда будет доступ.
RULES = {
    'lost_share': 0.16,     # теряется доля текущего урона на входе (решётка/стекло — 0,05)
    'wep_k': 3.75,          # + (3 / пробитие × 1,25) × (1 / мод.) × 3
    'thick_div': 24,        # + (1 / мод.) × толщина² / 24
    'same_mat': {'wood': 3, 'cardboard': 3, 'plastic': 2},   # вход и выход из одного материала — мод. такой
    'grate_mod': 3, 'grate_share': 0.05,
    'max_walls': 4,         # не больше 4 препятствий за выстрел
    'max_thick': 90,        # толще 90 ед. выход не ищется — не пробивает
    'max_dist': 3000,       # дальше 3000 ед. от стрелка пуля стены не пробивает
}

# Пробитие оружия CS2: 1 / 2 / 2,5 (tradeit: 100 / 200 / 250 %, cs.money: «1 у
# пистолетов, 2 у винтовок, 2,5 у снайперок»). Ключи — как WEAPONS в игре
# (02_bots.js); тех, кого в игре нет, — тоже, для полноты таблицы.
WEAPONS = [
    ('GLOCK', 'Glock-18', 1), ('USP', 'USP-S', 1), ('P2000', 'P2000', 1), ('P250', 'P250', 1),
    ('DUALIES', 'Dual Berettas', 1), ('TEC9', 'Tec-9', 1), ('FIVE7', 'Five-SeveN', 1), ('CZ75', 'CZ75-Auto', 1),
    ('DEAGLE', 'Desert Eagle', 2), ('R8', 'R8 Revolver', 2),
    ('MAC10', 'MAC-10', 1), ('MP9', 'MP9', 1), ('MP7', 'MP7', 1), ('MP5', 'MP5-SD', 1), ('UMP', 'UMP-45', 1),
    ('P90', 'P90', 1), ('BIZON', 'PP-Bizon', 1),
    ('NOVA', 'Nova', 2), ('XM1014', 'XM1014', 2), ('MAG7', 'MAG-7', 2), ('SAWEDOFF', 'Sawed-Off', 2),
    ('GALIL', 'Galil AR', 2), ('FAMAS', 'FAMAS', 2), ('AK', 'AK-47', 2), ('M4', 'M4A4', 2), ('M4S', 'M4A1-S', 2),
    ('SG', 'SG 553', 2), ('AUG', 'AUG', 2), ('M249', 'M249', 2), ('NEGEV', 'Negev', 2),
    ('SSG', 'SSG 08', 2.5), ('AWP', 'AWP', 2.5), ('G3SG1', 'G3SG1', 2.5), ('SCAR20', 'SCAR-20', 2.5),
]

# Материалы: pen — penetrationmodifier из surfaceproperties CS:GO (Valve Developer
# Wiki); col — цвет на радаре.
MATERIALS = [
    ('plywood', 'фанера', 0.9, 'wood', [236, 196, 92]),
    ('wood', 'дерево (доски)', 0.9, 'wood', [214, 140, 58]),
    ('wood_crate', 'деревянный ящик', 0.9, 'wood', [176, 112, 50]),
    ('metal_sheet', 'тонкий металл', 0.4, 'metal', [92, 168, 232]),
    ('metal_box', 'металлический ящик', 0.5, 'metal', [120, 120, 220]),
    ('plaster', 'штукатурка', 0.7, 'plaster', [226, 226, 214]),
    ('tile', 'плитка', 0.7, 'tile', [150, 210, 190]),
    ('brick', 'кирпич', 0.47, 'brick', [200, 96, 80]),
    ('concrete', 'бетон / камень', 0.5, 'concrete', [150, 150, 150]),
    ('glass', 'стекло', 0.99, 'glass', [180, 235, 250]),
    ('grate', 'решётка', 0.95, 'grate', [120, 200, 120]),
]

# Куски по картам (v318: --map; у карты без списка — пусто, прострелов нет). Ancient: poly — прямоугольник/многоугольник в ед. карты (0..2048) внутри
# стены; без poly — укрытие (стена) целиком по точке pt. t — толщина в ед. игры.
SPOTS_BY_MAP = {'ancient': [
    dict(key='cave_ply', name='Cave → B сайт: фанера', mat='plywood', t=4,
         poly=[[1410, 812], [1436, 812], [1436, 880], [1410, 880]],
         refs=['valve_patch', 'gfinity', 'skinclub', 'sportskeeda'],
         sure='материал — из обновления CS2 18.08.2025 («вернули прострел фанеры в Cave») и skin.club («деревянная стена в сторону B»)',
         guess='где именно на стене и толщина 4 — предположение: на радаре это перегородка между Cave и сайтом B (27 ед. карты), доски на радаре не видны',
         note='Из Cave на сайт B (дефуз после планта), обратно — с сайта в Cave; sportskeeda: из «кабинки» Cave и на B Main'),
    dict(key='cave_metal', name='Сайт B → Cave: синяя металлическая кромка', mat='metal_sheet', t=2,
         poly=[[1427, 884], [1437, 884], [1437, 918], [1427, 918]],
         refs=['skinclub'],
         sure='материал — skin.club («синяя металлическая кромка стены в сторону Cave», из AK)',
         guess='место — край той же перегородки у выхода из Cave (у серого ящика); толщина 2 — предположение (лист металла)',
         note='С плента B в Cave'),
    dict(key='lamp_wood', name='Lamp Room → Wood / T Lower: деревянная конструкция у лампы', mat='wood', t=8,
         poly=[[1390, 1084], [1420, 1084], [1420, 1146], [1390, 1146]],
         refs=['skinclub'],
         sure='материал — skin.club («деревянная конструкция у лампы», Cat Room → B Ramp, AK или любая винтовка)',
         guess='место — предположение: перегородка между Lamp Room и Wood (у нас Cat Room = низ Lamp Room); толщина 8 — предположение (доски)',
         note='Из комнаты с лампой — по тем, кто идёт с T Lower на B'),
    dict(key='cat_box', name='Lamp Room / Cat: «белый ящик» → Lower Mid', mat='wood_crate', t=16, pt=[1350, 1167],
         refs=['skinclub'],
         sure='skin.club: «между белым ящиком и каменной стеной в сторону Lower Mid», любая винтовка',
         guess='какой ящик — предположение (длинный ящик внизу Lamp Room, 77 в высоту); материал (дерево) — предположение: камень любая винтовка не пробьёт; толщина 16 — угол ящика, не поперёк',
         note='Стреляют у края ящика, где он тоньше; поперёк (≈50 ед.) пробивает только AWP'),
    dict(key='ramp_wood', name='B Ramp: деревянные панели / кабинка', mat='wood', t=8,
         poly=[[1629, 984], [1641, 984], [1641, 1040], [1629, 1040]],
         refs=['sportskeeda'],
         sure='материал — sportskeeda («деревянные панели» у входа на B Ramp; «деревянная кабинка» на B Ramp — прострел на B Long)',
         guess='место — предположение: восточная стенка здания Rat у подъёма с T Lower к Bonger; толщина 8 — предположение (доски)',
         note='С B Ramp — на B Short (Cave) и B Long; простреливают и в обратную сторону'),
]}
_MJ = mapdir.path(MAPNAME, 'map.json')
SPOTS = SPOTS_BY_MAP.get(json.load(open(_MJ, encoding='utf-8'))['id'] if os.path.exists(_MJ) else MAPNAME)

# (v321, М26) карта без своего списка — прострелы из демок про: убийства с penetrated ≥ 1 (пуля прошла сквозь что-то);
# где линия «стрелок → жертва» проходит сквозь стену набора — кусок стены, который пробивают. Кластер — места пересечений
# (сетка DB_CELL), берётся при ≥ DB_MIN убийствах из ≥ 2 матчей; толще DB_THICK ед. карты на радаре — не берётся
# (это толстая стена: пуля прошла выше/ниже неё — на радаре не видно). Материал и толщина из демок не узнать:
# дерево 8 ед. — проектное число (как доски у Ancient), первый кандидат на замену разметкой владельца (поле own).
DB_CELL, DB_MIN, DB_THICK, DB_PAD = 24, 3, 40, 3   # проектные числа


def demo_spots(walls):
    import numpy as np
    from PIL import Image, ImageDraw
    import demos as D
    im = Image.new('1', (2048, 2048), 0)
    dr = ImageDraw.Draw(im)
    for W in walls:
        dr.polygon([tuple(q) for q in W], fill=1)
    M = np.asarray(im)

    def solid(x, y):
        xi, yi = int(x), int(y)
        return 0 <= xi < 2048 and 0 <= yi < 2048 and bool(M[yi, xi])
    cl = {}
    for dm in D.demo_names():
        f = os.path.join(D.DEMOS, dm + '_player_death.csv.gz')
        if not os.path.exists(f):
            continue
        import pandas as pd
        k = pd.read_csv(f, usecols=['attacker_X', 'attacker_Y', 'user_X', 'user_Y', 'penetrated', 'weapon'], low_memory=False)
        k = k[pd.to_numeric(k.penetrated, errors='coerce').fillna(0) >= 1].dropna()
        if not len(k):
            continue
        ax, ay = D.tr(k.attacker_X.values.astype(float), k.attacker_Y.values.astype(float))
        ux, uy = D.tr(k.user_X.values.astype(float), k.user_Y.values.astype(float))
        for x0, y0, x1, y1 in zip(ax, ay, ux, uy):
            if solid(x0, y0) or solid(x1, y1):
                continue
            L = math.hypot(x1 - x0, y1 - y0)
            n = int(L / 0.5) + 1
            runs, cur = [], None
            for i in range(n + 1):
                px, py = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
                if solid(px, py):
                    cur = cur or [(px, py)]
                    cur = [cur[0], (px, py)]
                elif cur:
                    runs.append(cur); cur = None
            if len(runs) != 1:   # одна стена на линии — однозначно; две и больше — не знаем, какую пробили
                continue
            (sx, sy), (ex, ey) = runs[0]
            if math.hypot(ex - sx, ey - sy) > DB_THICK:
                continue
            key = (round((sx + ex) / 2 / DB_CELL), round((sy + ey) / 2 / DB_CELL))
            c = cl.setdefault(key, {'pts': [], 'demos': set(), 'n': 0})
            c['pts'] += [(sx, sy), (ex, ey)]; c['demos'].add(dm); c['n'] += 1
    out = []
    for key, c in sorted(cl.items(), key=lambda t: -t[1]['n']):
        if c['n'] < DB_MIN or len(c['demos']) < 2:
            continue
        xs = [p[0] for p in c['pts']]; ys = [p[1] for p in c['pts']]
        x0, x1, y0, y1 = min(xs) - DB_PAD, max(xs) + DB_PAD, min(ys) - DB_PAD, max(ys) + DB_PAD
        P = [[round(x0, 1), round(y0, 1)], [round(x1, 1), round(y0, 1)], [round(x1, 1), round(y1, 1)], [round(x0, 1), round(y1, 1)]]
        out.append(dict(key='demo%d_%d' % key, name='прострел из демок (%d убийств, %d матчей)' % (c['n'], len(c['demos'])),
                        mat='wood', t=8, poly=P, refs=['demos'],
                        sure='демки про: %d убийств сквозь эту стену (penetrated ≥ 1) в %d матчах' % (c['n'], len(c['demos'])),
                        guess='материал (дерево) и толщина 8 — проектное число: из демок не узнать',
                        note='форма — рамка пересечений линий выстрела со стеной'))
    return out


def wall_at(walls, x, y):
    best, ba = None, float('inf')
    for i, W in enumerate(walls):
        if point_in(W, x, y):
            a = area(W)
            if a < ba:
                ba, best = a, i
    return best


def chord(walls, x, y):
    """толщина стены в точке: кратчайшая хорда через (x, y) по твёрдому, ед. карты"""
    def solid(px, py):
        return any(point_in(W, px, py) for W in walls)
    best = float('inf')
    for k in range(36):
        a = math.pi * k / 36
        dx, dy = math.cos(a), math.sin(a)
        L = 0
        for s in (1, -1):
            d = 0
            while d < 400 and solid(x + s * dx * (d + 0.5), y + s * dy * (d + 0.5)):
                d += 0.5
            L += d
        best = min(best, L)
    return best


def damage(R, mats, pen, dmg, mat, t):
    """урон после стены (как в игре, 19_map_wallbang.js wbAfter)"""
    m = mats[mat]
    if t > R['max_thick']:
        return 0
    if m['kind'] == 'grate':
        mod, share = R['grate_mod'], R['grate_share']
    else:
        mod, share = R['same_mat'].get(m['kind'], m['pen']), R['lost_share']
    pm = 1 / mod
    lost = dmg * share + R['wep_k'] / pen * pm * 3 + pm * t * t / R['thick_div']
    return max(0, dmg - lost)


def write(out):
    txt = '{\n' + ',\n'.join('"%s": %s' % (k, json.dumps(v, ensure_ascii=False, indent=1) if k == '_about'
                                          else json.dumps(v, ensure_ascii=False, separators=(',', ':')))
                             for k, v in out.items()) + '\n}\n'
    txt = txt.replace('"items": [', '"items": [\n').replace('},{"id"', '},\n{"id"')
    open(OUT, 'w', encoding='utf-8').write(txt)


def main():
    walls = mapdir.load_walls(MAPNAME)
    old = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    name = namer()
    mats = {k: {'name': n, 'pen': p, 'kind': kd, 'col': c} for k, n, p, kd, c in MATERIALS}
    items = []
    spots = SPOTS if SPOTS is not None else demo_spots(walls)
    for s in spots:
        if 'poly' in s:
            P = s['poly']
            pt = [round(sum(q[0] for q in P) / len(P), 1), round(sum(q[1] for q in P) / len(P), 1)]
        else:
            pt = s['pt']
        wi = wall_at(walls, pt[0], pt[1])
        if wi is None:
            print('ВНИМАНИЕ: %s — точка %r не внутри стены' % (s['key'], pt))
        it = {'id': 'b%d_%d' % (round(pt[0]), round(pt[1])), 'name': s['name'], 'callout': name(pt[0], pt[1]),
              'pt': pt, 'shape': 'piece' if 'poly' in s else 'wall'}
        if 'poly' in s:
            it['poly'] = s['poly']
        it.update({'mat': s['mat'], 't': s['t'], 'radar_t': round(chord(walls, pt[0], pt[1]) * UNIT),
                   'refs': [SRC[r] for r in s['refs']], 'sure': s['sure'], 'guess': s['guess'], 'note': s['note']})
        items.append(it)
    out = {
        '_about': [
            'Прострелы %s. Делает tools/wallbang_bake.py --map %s; правки' % (MAP_TITLE, MAPNAME) + ' владельца — поле own (вкладка «прострелы», документ map/wallbang, вписывает tools/map_pull.py).',
            'rules — урон через стену (CS:GO HandleBulletPenetration, CS2 так же): mod — модификатор материала (вход и выход из одного дерева/картона — 3, пластика — 2, иначе pen материала);',
            '  потеря = урон × 0,16 + 3,75 / пробитие оружия × 3 / mod + толщина² / (24 × mod); после стены урон = урон − потеря (меньше 1 — пуля застряла).',
            '  Решётка: mod 3, доля 0,05. Не больше 4 препятствий; толще 90 ед. — не пробивает; дальше 3000 ед. — не пробивает.',
            'weapons — пробитие оружия (1 / 2 / 2,5); materials — модификатор пробития pen (surfaceproperties CS:GO), kind — группа для правила «один материал», col — цвет на радаре.',
            'items — простреливаемые куски: pt — точка внутри стены; shape "wall" — укрытие (стена walls.json) целиком по pt, "piece" — своя форма poly (ед. карты 0..2048);',
            '  t — толщина простреливаемого куска, ед. игры; radar_t — толщина стены на радаре в pt (для сведения); refs — источники; sure — что из источников; guess — что предположение и почему.',
            'Всё, чего нет в items, — камень/бетон толще 90 ед.: не простреливается.',
            'own: [{id, pt, on? (false — не простреливается), mat?, t?, poly? (кусок, нарисованный владельцем)}].',
        ],
        'rules': RULES,
        'weapons': {k: {'name': n, 'pen': p} for k, n, p in WEAPONS},
        'materials': mats,
        'items': items,
        'own': old.get('own', []),
    }
    write(out)
    print('записано: %s — кусков %d, правок владельца %d' % (os.path.relpath(OUT, ROOT), len(items), len(out['own'])))
    if '--report' in sys.argv:
        for it in items:
            ak = damage(RULES, mats, 2, 36, it['mat'], it['t'])
            awp = damage(RULES, mats, 2.5, 115, it['mat'], it['t'])
            print('  %-58s %-16s t=%-3s радар %-4s AK %5.1f (в броне %4.1f)  AWP %5.1f (в броне %5.1f)' % (
                it['name'], mats[it['mat']]['name'], it['t'], it['radar_t'], ak, ak * 0.775, awp, awp * 0.975))


if __name__ == '__main__':
    main()
