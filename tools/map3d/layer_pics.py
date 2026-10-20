#!/usr/bin/env python3
"""Картинки А3 владельцу: python3 tools/map3d/layer_pics.py [--map mirage]   (после columns.py и layers.py)
docs/reports/map3d/a3_<слой>.png — вся карта по слоям; a3_zoom_<место>.png — крупно B Apps / Underpass / A сайт (все слои)."""
import sys, os, json
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from matplotlib.lines import Line2D
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa
MAP = mapdir.current(); ROOT = mapdir.ROOT
PFX = 'a3_' if MAP == 'mirage' else MAP + '_a3_'   # (А6) картинки других карт — со своим именем
IMG = os.path.join(ROOT, 'docs', 'reports', 'map3d'); os.makedirs(IMG, exist_ok=True)
L = np.load(mapdir.path(MAP, 'geom3d', 'layers.npz')); Cz = np.load(mapdir.path(MAP, 'geom3d', 'columns.npz'))
W = int(L['W']); PX = 2048 / W
radar = plt.imread(mapdir.radar_png(MAP))
CALL = {c[0]: (c[1], c[2]) for c in mapdir.recipe(MAP)['callouts']}
plt.rcParams.update({'font.size': 11})

nc, nz, nk = L['node_cell'], L['node_z'].astype(int), L['node_kind']
live = nk > 0
# этажи по клетке: верхний и нижний (если их больше одного)
lc, lz, lk = nc[live], nz[live], nk[live]
cnt = np.bincount(lc, minlength=W * W)
top = np.full(W * W, np.nan); bot = np.full(W * W, np.nan)
np.fmax.at(top, lc, lz.astype(float)); np.fmin.at(bot, lc, lz.astype(float))
kind_top = np.zeros(W * W, int); o = np.argsort(lz); kind_top[lc[o]] = lk[o]   # вид верхнего этажа
multi = cnt >= 2
zmin, zmax = np.nanpercentile(top, 1), np.nanpercentile(top, 99)


from matplotlib.colors import LinearSegmentedColormap
FLOOR_CM = LinearSegmentedColormap.from_list('fl', plt.get_cmap('viridis')(np.linspace(0, 0.72, 64)))   # без жёлтого — он у подъёмов


def base(ax, extent=None, title=None, alpha=0.35):
    ax.imshow(radar, extent=[0, 2048, 2048, 0], alpha=alpha)
    if extent: ax.set_xlim(extent[0], extent[1]); ax.set_ylim(extent[3], extent[2])
    else: ax.set_xlim(0, 2048); ax.set_ylim(2048, 0)
    ax.set_xticks([]); ax.set_yticks([])
    if title: ax.set_title(title, fontsize=13)


def grid_img(ax, vals, cmap, vmin, vmax, alpha=1.0):
    A = np.ma.masked_invalid(vals.reshape(W, W))
    return ax.imshow(A, extent=[0, 2048, 2048, 0], cmap=cmap, vmin=vmin, vmax=vmax, alpha=alpha, interpolation='nearest')


def pts_img(ax, cells, colors, size=None):
    """клетки → цветные квадратики (через картинку RGBA, чтобы не рисовать миллион точек)"""
    img = np.zeros((W * W, 4))
    img[cells] = colors
    ax.imshow(img.reshape(W, W, 4), extent=[0, 2048, 2048, 0], interpolation='nearest')


def labels(ax, extent=None, fs=9):
    for n, (x, y) in CALL.items():
        if extent and not (extent[0] <= x <= extent[1] and extent[2] <= y <= extent[3]): continue
        ax.text(x, y, n, fontsize=fs, ha='center', va='center', color='white', weight='bold',
                bbox=dict(boxstyle='round,pad=0.15', fc='black', alpha=0.45, lw=0))


def rgba(hexs, a=1.0):
    h = hexs.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a])


COL = {'wall': rgba('#e8463a'), 'cover_lo': rgba('#4fa3ff'), 'cover_hi': rgba('#9a6cff'), 'window': rgba('#ffd23f'),
       'door': rgba('#2fd17a'), 'roof': rgba('#8a5a2b', 0.55), 'jump': rgba('#ffd23f'), 'cjump': rgba('#ff8c1a'), 'boost': rgba('#ff3df2'),
       'step': rgba('#52e0e0'), 'multi': rgba('#ffffff', 0.9)}


# верхний этаж рядом с клеткой (3×3) — чтобы отличать стены и проёмы нижнего этажа (Underpass под мидом)
_t = np.nan_to_num(top.reshape(W, W), nan=-1e4); _p = np.pad(_t, 1, constant_values=-1e4)
top_near = np.max([_p[1 + dj:1 + dj + W, 1 + di:1 + di + W] for dj in (-1, 0, 1) for di in (-1, 0, 1)], 0).ravel()


def lv(cells, z, col):
    """цвета: нижний этаж (пол ниже верхнего рядом на 60+ ед.) — темнее и прозрачнее"""
    low = z < top_near[cells] - 60
    dark = col.copy(); dark[:3] *= 0.45; dark[3] = 0.75
    return np.where(low[:, None], dark, col)


def layer_cells(extent=None):
    """слои для рисования: словарь «имя → (клетки, цвета)»"""
    out = {}
    w = L['walls']; out['wall'] = (w[:, 0], lv(w[:, 0], w[:, 1], COL['wall']))
    c = L['covers']; lo = c[:, 2] <= 40
    out['cover'] = (c[:, 0], np.where(lo[:, None], lv(c[:, 0], c[:, 1], COL['cover_lo']), lv(c[:, 0], c[:, 1], COL['cover_hi'])))
    wn = L['windows']; out['window'] = (wn[:, 0], lv(wn[:, 0], wn[:, 1], COL['window']))
    out['door'] = (L['door_cell'], lv(L['door_cell'], L['door_z'].astype(int), COL['door']))
    out['roof'] = (L['roof_cell'], lv(L['roof_cell'], L['roof_z'].astype(int), COL['roof']))
    return out


LC = layer_cells()


def draw_floors(ax, extent=None):
    base(ax, extent, alpha=0.25)
    im = grid_img(ax, top, FLOOR_CM, zmin, zmax, 0.9)
    m = np.where(multi)[0]; pts_img(ax, m, np.tile(rgba('#ff2d55', 0.85), (len(m), 1)))
    j = np.where(kind_top == 2)[0]; pts_img(ax, j, np.tile(rgba('#ffffff', 0.95), (len(j), 1)))
    b = np.where(kind_top == 3)[0]; pts_img(ax, b, np.tile(rgba('#ff3df2', 0.9), (len(b), 1)))
    return im


def draw_lower(ax, extent=None):
    base(ax, extent, alpha=0.25)
    v = np.where(multi, bot, np.nan)
    return grid_img(ax, v, 'plasma', zmin, zmax, 1.0)


def draw_walls(ax, extent=None):
    base(ax, extent, alpha=0.5)
    for k in ('wall', 'cover'): pts_img(ax, *LC[k])


def draw_open(ax, extent=None):
    base(ax, extent, alpha=0.5)
    pts_img(ax, *LC['roof']); pts_img(ax, *LC['wall'][:1], np.tile(rgba('#e8463a', 0.35), (len(LC['wall'][0]), 1)))
    pts_img(ax, *LC['door']); pts_img(ax, *LC['window'])


def draw_climbs(ax, extent=None, big=False):
    base(ax, extent, alpha=0.5)
    pts_img(ax, *LC['wall'][:1], np.tile(rgba('#e8463a', 0.3), (len(LC['wall'][0]), 1)))
    s = L['steps']; pts_img(ax, s[:, 0], np.tile(COL['step'], (len(s), 1)))
    cl = L['climbs']
    for t, k in ((3, 'jump'), (4, 'cjump'), (5, 'boost')):
        m = cl[:, 3] == t; cells = cl[m, 4]
        x = (cells % W + 0.5) * PX; y = (cells // W + 0.5) * PX
        ax.scatter(x, y, s=(10 if big else 2), color=COL[k][:3], marker='s', lw=0)


def legend(ax, items, loc='lower left'):
    ax.legend(handles=[Patch(fc=c[:3], ec='#444', lw=0.5, alpha=c[3] if len(c) > 3 else 1, label=l) for l, c in items], loc=loc, fontsize=10, framealpha=0.85)


FLOOR_LEG = [('2 этажа и больше (красным; нижний — справа)', rgba('#ff2d55')), ('только прыжком / с приседом', rgba('#ffffff')),
             ('только подсадкой', rgba('#ff3df2'))]
WALL_LEG = [('стена: геометрия на высоте глаз (стоя и сидя)', COL['wall']), ('укрытие: верх ≤ 40 ед. над полом (за ним — присев)', COL['cover_lo']),
            ('укрытие: верх 40–64 ед. (по грудь; голова над ним)', COL['cover_hi']), ('темнее — нижний этаж (Underpass и т. п.)', rgba('#6a1a14', 0.75))]
OPEN_LEG = [('окно: дыра в стене с подоконником', COL['window']), ('проём: дверь, арка (перемычка сверху)', COL['door']),
            ('крыша: широкое сверху (ниже неба)', COL['roof']), ('стены (для ориентира)', rgba('#e8463a', 0.35))]
CLIMB_LEG = [('ступени 4–18 ед. (шагом)', COL['step']), ('прыжок 19–57 ед.', COL['jump']), ('прыжок с приседом 58–66 ед.', COL['cjump']),
             ('подсадка 67–130 ед.', COL['boost'])]

# ---------- вся карта ----------
f, axs = plt.subplots(1, 2, figsize=(22, 11.5))
im = draw_floors(axs[0]); axs[0].set_title('Этажи пола: верхний (цвет — высота, ед. игры)', fontsize=14); labels(axs[0])
plt.colorbar(im, ax=axs[0], fraction=0.035, pad=0.01); legend(axs[0], FLOOR_LEG)
im2 = draw_lower(axs[1]); axs[1].set_title('Нижний этаж там, где их два и больше (Underpass под Short, Shadow под балконом)', fontsize=14); labels(axs[1])
plt.colorbar(im2, ax=axs[1], fraction=0.035, pad=0.01)
plt.tight_layout(); plt.savefig(os.path.join(IMG, PFX + 'floors.png'), dpi=80); plt.close()

for fn, fun, title, leg in (('a3_walls.png', draw_walls, 'Стены и укрытия (с настоящим верхом) — от каждого этажа', WALL_LEG),
                            ('a3_openings.png', draw_open, 'Окна, проёмы и крыши', OPEN_LEG),
                            ('a3_climbs.png', draw_climbs, 'Подъёмы: ступени, прыжок, прыжок с приседом, подсадка', CLIMB_LEG)):
    f, ax = plt.subplots(figsize=(14, 14.4)); fun(ax); ax.set_title(title, fontsize=15); labels(ax); legend(ax, leg)
    plt.tight_layout(); plt.savefig(os.path.join(IMG, PFX + fn[3:]), dpi=80); plt.close()

# ---------- небо и прострелы ----------
# потолок неба над игровым местом: самый низкий кусок неба выше верхнего этажа клетки
ss = Cz['sky_start'].astype(np.int64); slo = Cz['sky_lo'].astype(float); sky = np.full(W * W, np.nan)
for c in np.where(~np.isnan(top))[0]:
    v = slo[ss[c]:ss[c + 1]]; v = v[v > top[c]]
    if len(v): sky[c] = v.min()
mats = [str(s).lower() for s in Cz['surf_names']]
PEN = {'wood', 'wood_plank', 'wood_solid', 'wood_panel', 'wood_furniture', 'wood_basket', 'plaster', 'sheetrock', 'cardboard',
       'metalpanel', 'metalvent', 'plastic_box', 'wood_ladder', 'pottery', 'upholstery'}
wc = L['walls'][:, 0]; wth = L['walls'][:, 3]; wmt = L['walls'][:, 4]
pen = np.array([m >= 0 and mats[m] in PEN for m in wmt]) & (wth <= 32)
thin_hard = ~pen & (wth <= 32)
f, axs = plt.subplots(1, 2, figsize=(22, 11.5))
base(axs[0], alpha=0.5); im = grid_img(axs[0], sky, 'Blues_r', np.nanmin(sky), np.nanmax(sky), 0.55)
plt.colorbar(im, ax=axs[0], fraction=0.035, pad=0.01); labels(axs[0])
axs[0].set_title('Небо (skybox) над игровыми местами: высота, ед. игры — граната отскакивает; взгляд и пули не замечают', fontsize=13)
base(axs[1], alpha=0.5)
pts_img(axs[1], wc[~pen & ~thin_hard], np.tile(rgba('#7d7d7d', 0.8), ((~pen & ~thin_hard).sum(), 1)))
pts_img(axs[1], wc[thin_hard], np.tile(rgba('#3b6cff'), (thin_hard.sum(), 1)))
pts_img(axs[1], wc[pen], np.tile(rgba('#ff8c1a'), (pen.sum(), 1)))
try:
    WB = json.load(open(mapdir.path(MAP, 'geom3d', 'wallbang_demo.json')))
    g2m = mapdir.game_to_map(MAP); P = [g2m(*r['p'][:2]) for r in WB['kills'] if r.get('p')]
except Exception: P = []
if P: axs[1].scatter(*zip(*P), s=12, color='#00e5ff', lw=0)
labels(axs[1]); legend(axs[1], [('тонкая (≤ 32 ед.) из пробиваемого: дерево, штукатурка, тонкий металл, картон', rgba('#ff8c1a')),
                                ('тонкая (≤ 32 ед.) из бетона, камня, кирпича, металла', rgba('#3b6cff')),
                                ('толстая (> 32 ед.) или край карты', rgba('#7d7d7d')), ('прострел про (демки, А2)', rgba('#00e5ff'))])
axs[1].set_title('Прострелы: материал и толщина стены на высоте глаз + места прострелов про', fontsize=13)
plt.tight_layout(); plt.savefig(os.path.join(IMG, PFX + 'sky_wallbang.png'), dpi=80); plt.close()

# ---------- крупно ----------
ZOOM = {'b_apps': ('B Apps', 250, (40, 110)), 'underpass': ('Underpass', 260, (0, 0)), 'a_site': ('A Site', 330, (60, -40))} if MAP == 'mirage' else \
       {'long': ('Long', 280, (0, 0)), 'cave': ('Cave', 260, (0, 0)), 'a_site': ('A', 330, (0, 0))}   # (А6) Ancient   # место, полуширина, сдвиг центра (px радара)
for key, (nm, r, sh) in ZOOM.items():
    x, y = CALL[nm][0] + sh[0], CALL[nm][1] + sh[1]; ext = (x - r, x + r, y - r, y + r)
    f, axs = plt.subplots(2, 2, figsize=(18, 18.6))
    im = draw_floors(axs[0, 0], ext); labels(axs[0, 0], ext, 11); legend(axs[0, 0], FLOOR_LEG)
    axs[0, 0].set_title('Этажи (цвет — высота верхнего; красным — 2 этажа)', fontsize=14)
    draw_walls(axs[0, 1], ext); labels(axs[0, 1], ext, 11); legend(axs[0, 1], WALL_LEG); axs[0, 1].set_title('Стены и укрытия', fontsize=14)
    draw_open(axs[1, 0], ext); labels(axs[1, 0], ext, 11); legend(axs[1, 0], OPEN_LEG); axs[1, 0].set_title('Окна, проёмы, крыши', fontsize=14)
    draw_climbs(axs[1, 1], ext, big=True); labels(axs[1, 1], ext, 11); legend(axs[1, 1], CLIMB_LEG); axs[1, 1].set_title('Подъёмы', fontsize=14)
    f.suptitle('%s — крупно (квадрат %d ед. игры)' % (nm, int(2 * r * mapdir.radar(MAP)['scale'] / 2)), fontsize=17)
    plt.tight_layout(); plt.savefig(os.path.join(IMG, PFX + 'zoom_%s.png' % key), dpi=70); plt.close()
print('картинки:', IMG)
