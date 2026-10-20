#!/usr/bin/env python3
"""А3 (20.10.2026): слои карты из «столбиков» геометрии (columns.py) — этажи, стены, укрытия, крыши, проёмы, подъёмы, небо.
python3 tools/map3d/layers.py [--map mirage]   → data/maps/<карта>/geom3d/layers.npz (для картинок и отчёта)
                                                + data/maps/<карта>/geom3d/map3d.json (то, что берёт игра: VIS и гранаты)

Пол (этаж) — верх отрезка walk, у самого верха — поверхность, обращённая вверх (наклон не круче, чем у Source: нормаль z ≥ 0,7),
над ним свободно ≥ 54 ед. (присевший игрок). В одной клетке этажей может быть несколько (Underpass под мидом, второй этаж B Apps).
Какие этажи настоящие — по связности от спавнов T и CT (поиск в ширину по соседним клеткам):
  шаг ≤ STEP 18 (ступенька, CS: sv_stepsize) · спрыгнуть — любая высота · прыжок ≤ JUMP 57 (импульс 301,99, гравитация 800:
  v²/2g = 57) · прыжок с приседом ≤ CJUMP 66 (присед в воздухе поднимает ноги на 9 ед.) · подсадка ≤ BOOST 130 (на голове
  стоящего 72 + прыжок 57 — проектное число). Место прохода — свободно по высоте присевшего (54) над верхним из двух полов.
Этажи, куда не попасть (внутри толстых стен, на крышах без подъёма), в слои не идут.

От каждого настоящего этажа f смотрим на соседние клетки (8 соседей) по геометрии взгляда (sight):
  стена   — на высоте глаз (f+60…f+68) геометрия, которая начинается не выше глаз присевшего (lo ≤ f+46): закрывает и стоя, и сидя;
  укрытие — на высоте глаз свободно, ниже — геометрия с верхом t, 18 < t−f < 64 (настоящий верх, ед. над полом);
  окно    — на высоте глаз свободно, есть подоконник (верх > f+18) и узкая перемычка сверху (≤ f+250);
  проём   — над своим полом узкая перемычка (дверь, арка) — сквозь стену проходят;
  крыша   — над своим полом широкая геометрия ниже неба (высота потолка — ед. над полом);
«перемычка» — узкая поперёк (кончается в обе стороны в пределах 8 клеток, 40 ед.) и вдоль без разрыва доходит до косяков
(стена на высоте глаз) в обе стороны в пределах 30 клеток (150 ед.); иначе это балка или потолок — крыша.
Подъёмы — переходы между этажами соседних клеток выше ступени: прыжок / прыжок с приседом / подсадка; ступени — переходы 4…18 ед."""
import sys, os, json, time, base64, zlib
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import breadth_first_order
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa
from columns import Columns  # noqa

STEP, JUMP, CJUMP, BOOST = 18, 57, 66, 130
CROUCH_H = 54
EYE_ST, EYE_CR = 64, 46
LINTEL_MAX = 250
THIN_R = 8
JAMB_R = 30            # косяк проёма — не дальше 150 ед. (дверь, арка, окно шире 300 ед. не бывает)
MARCH = 8             # до 40 ед. от края пола (невидимые стены держат игрока в 16+ ед. от ящиков)
E_WALK, E_DROP, E_JUMP, E_CJUMP, E_BOOST, E_LADDER = 1, 2, 3, 4, 5, 6
NB8 = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]


def any_overlap(LO, HI, cells, z0, z1):
    """есть ли в клетках cells отрезок, пересекающий (z0, z1) — построчно"""
    return ((LO[cells] < z1[:, None]) & (HI[cells] > z0[:, None])).any(1)


def lowest_above(LO, HI, cells, z):
    """низ первого отрезка, начинающегося выше z (нет — 32767)"""
    L = LO[cells].astype(np.int32); return np.where(L > z[:, None], L, 32767).min(1)


def slab_at(LO, HI, cells, z0, z1):
    """отрезок, пересекающий (z0, z1): (есть, lo самого нижнего такого, hi самого верхнего такого)"""
    L = LO[cells].astype(np.int32); H = HI[cells].astype(np.int32)
    m = (L < z1[:, None]) & (H > z0[:, None])
    return m.any(1), np.where(m, L, 32767).min(1), np.where(m, H, -32768).max(1)


def build(name):
    t0 = time.time()
    C = Columns(name); W = C.W; N2 = W * W
    LOw, HIw = C.padded('walk'); LOs, HIs = C.padded('sight')
    s = C.d['walk_start'].astype(np.int64); nper = np.diff(s); flv = C.d['walk_floor']; fl = flv > 0
    cell_of = np.repeat(np.arange(N2), nper); pos = np.arange(len(cell_of)) - s[cell_of]
    top = C.d['walk_hi'].astype(np.int32)
    nxt = np.full(len(top), 32767, np.int32); same = np.zeros(len(top), bool); same[:-1] = cell_of[1:] == cell_of[:-1]
    nxt[:-1][same[:-1]] = C.d['walk_lo'][1:][same[:-1]]
    sky = C.d['sky_z'].astype(np.int32)
    isnode = fl & (nxt - top >= CROUCH_H) & (top < sky[cell_of])
    ncell = cell_of[isnode]; nz = top[isnode]; nclip = flv[isnode] == 2; nn = len(nz)
    print('полов-кандидатов %d (%.0f с)' % (nn, time.time() - t0))
    # узлы по клеткам: padded (W², KF)
    ns = np.searchsorted(ncell, np.arange(N2 + 1)); KF = int(np.diff(ns).max())
    NODE = np.full((N2, KF), -1, np.int64)
    p = np.arange(nn) - ns[ncell]; NODE[ncell, p] = np.arange(nn)
    ci, cj = ncell % W, ncell // W
    # ---------- переходы между соседними клетками ----------
    src, dst, typ = [], [], []
    for di, dj in NB8[:4]:
        ii, jj = ci + di, cj + dj; ok = (ii >= 0) & (jj >= 0) & (ii < W) & (jj < W)
        a = np.where(ok)[0]; nb = jj[a] * W + ii[a]
        for k in range(KF):
            b = NODE[nb, k]; h = b >= 0
            A, B = a[h], b[h]
            f, g = nz[A].astype(np.int32), nz[B].astype(np.int32); dz = g - f; hh = np.maximum(f, g)
            cA, cB = ncell[A], ncell[B]
            t = np.zeros(len(A), np.int8)
            free_a = ~any_overlap(LOw, HIw, cA, f + 0.5, hh + CROUCH_H)
            free_b = ~any_overlap(LOw, HIw, cB, g + 0.5, hh + CROUCH_H)
            ok2 = free_a & free_b
            t[ok2 & (np.abs(dz) <= STEP)] = E_WALK
            t[ok2 & (dz < -STEP)] = E_DROP
            t[ok2 & (dz > STEP) & (dz <= JUMP)] = E_JUMP
            t[ok2 & (dz > JUMP) & (dz <= CJUMP)] = E_CJUMP
            t[ok2 & (dz > CJUMP) & (dz <= BOOST)] = E_BOOST
            t[nclip[B] & (t != E_WALK)] = 0   # на скат невидимой стены — только шагом (крышки над картой недостижимы)
            g2 = t > 0; src.append(A[g2]); dst.append(B[g2]); typ.append(t[g2])
    # лестницы (ladder) — из навмеша .nav: участок снизу ↔ участок сверху (в геометрии лестница — только невидимая стена)
    NAV = json.load(open(mapdir.path(name, 'navmesh.json'), encoding='utf-8')); by = {a['id']: a for a in NAV['areas']}
    k2 = 2048 / W
    def node_near(a):
        x = sum(p['x'] for p in a['points']) / len(a['points']) / k2; y = sum(p['y'] for p in a['points']) / len(a['points']) / k2
        best = None
        for dj in range(-3, 4):
            for di in range(-3, 4):
                c = (int(y) + dj) * W + int(x) + di
                for n in NODE[c]:
                    if n >= 0 and abs(nz[n] - a['z']) <= 24 and (best is None or abs(nz[n] - a['z']) < abs(nz[best] - a['z'])): best = n
        return best
    nl = 0
    for Ld in NAV.get('ladders', []):
        for b in Ld.get('below', []):
            for t_ in Ld.get('above', []):
                if b not in by or t_ not in by: continue
                nb_, nt_ = node_near(by[b]), node_near(by[t_])
                if nb_ is None or nt_ is None: continue
                src += [np.array([nb_, nt_])]; dst += [np.array([nt_, nb_])]; typ += [np.array([E_LADDER, E_LADDER], np.int8)]; nl += 1
    print('лестниц (пар участков) %d' % nl)
    src = np.concatenate(src); dst = np.concatenate(dst); typ = np.concatenate(typ)
    print('переходов %d (%.0f с)' % (len(src), time.time() - t0))
    # ---------- достижимость от спавнов ----------
    E = json.load(open(mapdir.path(name, 'geom3d', 'entities.json')))
    seeds = []
    for sp in E['spawns_t'] + E['spawns_ct']:
        x, y, z = sp['origin']; i = int((x - C.X0) // C.c); j = int((C.Y0 - y) // C.c); c = j * W + i
        cand = [n for n in NODE[c] if n >= 0 and not nclip[n] and -48 <= nz[n] - z <= 8]   # пол под точкой спавна
        if cand: seeds.append(min(cand, key=lambda n: abs(nz[n] - z)))
    def reach(types):
        m = np.isin(typ, types); S = nn
        r = np.concatenate([src[m], np.full(len(seeds), S)]); cc = np.concatenate([dst[m], seeds])
        G = csr_matrix((np.ones(len(r), np.int8), (r, cc)), shape=(nn + 1, nn + 1))
        o = breadth_first_order(G, S, directed=True, return_predecessors=False)
        R = np.zeros(nn + 1, bool); R[o] = True; return R[:nn]
    R_self = reach([E_WALK, E_DROP, E_JUMP, E_CJUMP, E_LADDER]); R_all = reach([E_WALK, E_DROP, E_JUMP, E_CJUMP, E_BOOST, E_LADDER])
    R_walk = reach([E_WALK, E_DROP, E_LADDER])
    kind = np.zeros(nn, np.uint8); kind[R_all] = 3; kind[R_self] = 2; kind[R_walk] = 1   # 1 — пешком (и по лестнице), 2 — прыжком, 3 — подсадкой
    print('этажей: пешком %d, + прыжком %d, + подсадкой %d, недостижимо %d (%.0f с)' % (
        R_walk.sum(), (R_self & ~R_walk).sum(), (R_all & ~R_self).sum(), (~R_all).sum(), time.time() - t0))
    live = np.where(kind > 0)[0]
    LIVE = np.zeros(nn, bool); LIVE[live] = True
    # ---------- слои у этажей ----------
    f = nz[live].astype(np.int32); cl = ncell[live]; li, lj = cl % W, cl // W
    # своя клетка: перемычка / крыша
    ceil = lowest_above(LOs, HIs, cl, f + CROUCH_H - 1)
    ceil = np.where(ceil >= sky[cl], 32767, ceil)
    def opening(i0, j0, fl, zb):
        """дыра в стене: перемычка (геометрия на высоте zb..zb+16) узкая поперёк (кончается в обе стороны в пределах THIN_R) и
        вдоль тянется без разрыва до косяков — стены на высоте глаз от пола fl — в обе стороны в пределах JAMB_R.
        Балка через комнату не проходит: она длинная, косяки дальше JAMB_R (или балка кончается раньше стены)."""
        res = np.zeros(len(i0), bool)
        def at(sh_i, sh_j):
            ii = np.clip(i0 + sh_i, 0, W - 1); jj = np.clip(j0 + sh_j, 0, W - 1); return jj * W + ii
        for (ui, uj) in [(1, 0), (0, 1), (1, 1), (1, -1)]:
            vi, vj = -uj, ui
            ok = np.ones(len(i0), bool)
            for sgn in (1, -1):        # поперёк: кончается в пределах THIN_R
                end = np.zeros(len(i0), bool)
                for d in range(1, THIN_R + 1):
                    end |= ~any_overlap(LOs, HIs, at(sgn * vi * d, sgn * vj * d), zb.astype(np.float64), zb + 16.0)
                ok &= end
            for sgn in (1, -1):        # вдоль: до косяка без разрыва перемычки
                found = np.zeros(len(i0), bool); broken = np.zeros(len(i0), bool)
                for d in range(1, JAMB_R + 1):
                    c = at(sgn * ui * d, sgn * uj * d)
                    has, slo, _ = slab_at(LOs, HIs, c, fl + EYE_ST - 4.0, fl + EYE_ST + 4.0)
                    jamb = has & (slo <= fl + EYE_CR) & ~broken
                    found |= jamb
                    broken |= ~found & ~any_overlap(LOs, HIs, c, zb.astype(np.float64), zb + 16.0)
                ok &= found
            res |= ok
        return res
    has_c = ceil < 32767
    th = np.zeros(len(f), bool); q = np.where(has_c & (ceil - f <= LINTEL_MAX))[0]
    th[q] = opening(li[q], lj[q], f[q], ceil[q])
    door = has_c & th
    roof = has_c & ~door
    # от края пола наружу (8 направлений, до MARCH клеток): первая клетка, где на высоте тела есть геометрия взгляда, — стена /
    # укрытие / окно; клетки без геометрии взгляда (невидимая стена-отступ вокруг ящиков, обрыв) — пропускаются
    walls, covers, wins = [], [], []
    def is_cont(nb, fa):
        c = np.zeros(len(nb), bool)
        for k in range(KF):
            b = NODE[nb, k]; h = b >= 0
            c[h] |= LIVE[b[h]] & (np.abs(nz[b[h]].astype(np.int32) - fa[h]) <= STEP)
        return c
    for di, dj in NB8:
        act = np.arange(len(f))
        for d in range(1, MARCH + 1):
            ii, jj = li[act] + di * d, lj[act] + dj * d; ok = (ii >= 0) & (jj >= 0) & (ii < W) & (jj < W)
            act, ii, jj = act[ok], ii[ok], jj[ok]
            nb = jj * W + ii; fa = f[act]
            cont = is_cont(nb, fa)
            act, nb, fa = act[~cont], nb[~cont], fa[~cont]
            if not len(act): break
            has, slo, shi = slab_at(LOs, HIs, nb, fa + EYE_ST - 4.0, fa + EYE_ST + 4.0)
            wall = has & (slo <= fa + EYE_CR)
            walls.append(np.stack([nb[wall], fa[wall], shi[wall] - fa[wall]], 1))
            L_ = LOs[nb].astype(np.int32); H_ = HIs[nb].astype(np.int32)
            below = (H_ > fa[:, None] + STEP) & (H_ < fa[:, None] + EYE_ST) & (L_ < fa[:, None] + EYE_ST)
            t = np.where(below, H_, -32768).max(1)
            cov = ~has & (t > -32768)
            lint = lowest_above(LOs, HIs, nb, fa + EYE_ST + 4)
            cand = np.where(cov & (lint - fa <= LINTEL_MAX))[0]
            isw = np.zeros(len(act), bool)
            if len(cand): isw[cand] = opening(nb[cand] % W, nb[cand] // W, fa[cand], lint[cand])
            wins.append(np.stack([nb[isw], fa[isw], t[isw] - fa[isw]], 1))
            cv = cov & ~isw
            covers.append(np.stack([nb[cv], fa[cv], t[cv] - fa[cv]], 1))
            # дальше идём только там, где на высоте тела пусто (геометрии взгляда от пола+2 до глаз+8 нет)
            body = any_overlap(LOs, HIs, nb, fa + 2.0, fa + EYE_ST + 8.0)
            act = act[~(has | body)]
            if not len(act): break
    def uniq(X):
        X = np.concatenate(X); k = X[:, 0] * 4096 + (X[:, 1] + 2048) // 16
        _, u = np.unique(k, return_index=True); return X[u].astype(np.int32)
    walls, covers, wins = uniq(walls), uniq(covers), uniq(wins)
    # толщина стены (для прострелов): от клетки стены по 8 направлениям — до первой клетки с живым полом той же высоты (±64),
    # где на высоте глаз пусто; меньшая из 8 (по диагонали ×1,41); не нашлось за 16 клеток (80 ед.) — 999 (толстая / край карты)
    wc_, wf_ = walls[:, 0].astype(np.int64), walls[:, 1].astype(np.int32)
    thick = np.full(len(walls), 999.0)
    for di, dj in NB8:
        step = C.c * (1.4142 if di and dj else 1.0)
        act = np.arange(len(walls))
        for d in range(1, 17):
            ii, jj = wc_[act] % W + di * d, wc_[act] // W + dj * d
            ok = (ii >= 0) & (jj >= 0) & (ii < W) & (jj < W); act, ii, jj = act[ok], ii[ok], jj[ok]
            if not len(act): break
            nb = jj * W + ii; fa = wf_[act]
            other = np.zeros(len(act), bool)
            for k in range(KF):
                b = NODE[nb, k]; h = b >= 0
                other[h] |= LIVE[b[h]] & (np.abs(nz[b[h]].astype(np.int32) - fa[h]) <= 64)
            other &= ~any_overlap(LOs, HIs, nb, fa + EYE_ST - 4.0, fa + EYE_ST + 4.0)
            thick[act[other]] = np.minimum(thick[act[other]], d * step)
            act = act[~other]
    # материал на высоте глаз
    st_ = C.d['sight_start'].astype(np.int64); mt_ = C.d['sight_mat']
    wmat = np.zeros(len(walls), np.int32)
    for k in range(int(np.diff(st_).max())):
        q = st_[wc_] + k; okq = q < st_[wc_ + 1]
        qq = np.where(okq, q, 0)
        hit = okq & (C.d['sight_lo'][qq] <= wf_ + EYE_ST) & (C.d['sight_hi'][qq] >= wf_ + EYE_ST) & (wmat == 0)
        wmat[hit] = mt_[qq[hit]] + 1
    walls = np.concatenate([walls, np.round(thick)[:, None].astype(np.int32), (wmat - 1)[:, None]], 1)   # клетка, пол, высота, толщина, материал
    print('стен %d клеток, укрытий %d, окон %d, проёмов %d, крыш %d (%.0f с)' % (len(walls), len(covers), len(wins), door.sum(), roof.sum(), time.time() - t0))
    # подъёмы: переходы между живыми этажами выше ступени; ступени 4..18
    m = LIVE[src] & LIVE[dst]
    dzs = nz[dst].astype(np.int32) - nz[src].astype(np.int32)
    up = m & np.isin(typ, [E_JUMP, E_CJUMP, E_BOOST])
    steps = m & (typ == E_WALK) & (dzs >= 4)
    climbs = np.stack([ncell[src[up]], nz[src[up]], nz[dst[up]], typ[up], ncell[dst[up]]], 1).astype(np.int32)
    stp = np.stack([ncell[src[steps]], nz[src[steps]], dzs[steps]], 1).astype(np.int32)
    print('подъёмов (переходов) %d, ступеней %d' % (len(climbs), len(stp)))
    out = dict(node_cell=ncell.astype(np.int32), node_z=nz.astype(np.int16), node_kind=kind,
               roof_cell=cl[roof].astype(np.int32), roof_z=f[roof].astype(np.int16), roof_h=(ceil[roof] - f[roof]).astype(np.int16),
               door_cell=cl[door].astype(np.int32), door_z=f[door].astype(np.int16), door_h=(ceil[door] - f[door]).astype(np.int16),
               walls=walls, covers=covers, windows=wins, climbs=climbs, steps=stp, W=W,
               edge_src=src.astype(np.int32), edge_dst=dst.astype(np.int32), edge_type=typ)   # переходы между этажами (для путей)
    np.savez_compressed(mapdir.path(name, 'geom3d', 'layers.npz'), **out)
    nav_check(name, C, ncell, nz, kind)
    write_game(name, C, ncell, nz, kind)
    print('готово (%.0f с)' % (time.time() - t0))


def nav_check(name, C, ncell, nz, kind):
    """сверка с навмешем .nav: доля площади навмеша, под которой есть живой этаж той же высоты (±24), и наоборот"""
    from matplotlib.path import Path
    W = C.W; nav = mapdir.load_nav(name); k = 2048 / W
    ok = tot = 0; navmask = {}
    for a in nav:
        P = np.array([[p['x'], p['y']] for p in a['points']]) / k
        i0, j0 = np.floor(P.min(0)).astype(int); i1, j1 = np.floor(P.max(0)).astype(int)
        ii, jj = np.meshgrid(np.arange(i0, i1 + 1), np.arange(j0, j1 + 1)); pts = np.stack([ii.ravel() + .5, jj.ravel() + .5], 1)
        inside = Path(P).contains_points(pts)
        for (i, j) in pts[inside].astype(int):
            c = j * W + i; tot += 1; navmask.setdefault(c, []).append(a['z'])
    s = np.searchsorted(ncell, np.arange(W * W + 1))
    for c, zs in navmask.items():
        zz = nz[s[c]:s[c + 1]].astype(int); kk = kind[s[c]:s[c + 1]]
        for z in zs:
            if ((np.abs(zz - z) <= 24) & (kk > 0)).any(): ok += 1
    live = np.where(kind > 0)[0]; hit = 0
    for n in live[::7]:
        c = int(ncell[n]); zs = navmask.get(c, [])
        if any(abs(z - nz[n]) <= 24 for z in zs): hit += 1
    res = {'nav_cells': tot, 'nav_with_floor': ok / max(tot, 1), 'floor_with_nav': hit / max(len(live[::7]), 1)}
    print('сверка с навмешем: под навмешем есть этаж %.1f %%; на живом этаже есть навмеш %.1f %%' % (100 * res['nav_with_floor'], 100 * res['floor_with_nav']))
    json.dump(res, open(mapdir.path(name, 'geom3d', 'layers_navcheck.json'), 'w'))


def b64(arr):
    return base64.b64encode(zlib.compress(np.ascontiguousarray(arr).tobytes(), 9)).decode()


def prims(name):
    """точная геометрия (узкая проверка после столбиков): треугольники и выпуклые блоки, у которых есть хоть один набор
    (sight / nade). Вершины — ×4 в Int16 (точность 0,25 ед.); блоки — плоскости n·p ≤ d (внутри), Float32."""
    from columns import masks
    z = np.load(mapdir.path(name, 'geom3d', 'world_physics.npz'))
    mm, hm = masks(z)
    tk = mm['sight'] | mm['nade']; T = z['mesh_t'][tk]
    used, inv = np.unique(T.ravel(), return_inverse=True)
    V = np.round(z['mesh_v'][used] * 4).astype('<i2')
    tflag = (mm['sight'][tk] * 1 + mm['nade'][tk] * 2).astype(np.uint8)
    hk = np.where(hm['sight'] | hm['nade'])[0]
    pn = z['hull_pn']; off = np.concatenate([[0], np.cumsum(pn)]); hp = z['hull_p'].astype(np.float64)
    hv = z['hull_v']; voff = np.concatenate([[0], np.cumsum(z['hull_vn'])])
    planes, box = [], []
    for k in hk:
        Q = hv[voff[k]:voff[k + 1]]; box.append(np.concatenate([np.floor(Q.min(0)), np.ceil(Q.max(0))]))
        P = hp[off[k]:off[k + 1]].copy(); c = hv[voff[k]:voff[k + 1]].mean(0)
        if (P[:, :3] @ c - P[:, 3]).mean() > 0: P = -P     # центр — внутри
        planes.append(P)
    return {'v': b64(V), 'tri': b64(inv.reshape(-1, 3).astype('<u2')), 'tri_flag': b64(tflag), 'tri_mat': b64(z['mesh_surf'][tk].astype(np.uint8)),
            'hull_n': b64(pn[hk].astype(np.uint8)), 'hull_p': b64(np.concatenate(planes).astype('<f4')),
            'hull_box': b64(np.array(box).astype('<i2')),
            'hull_flag': b64((hm['sight'][hk] * 1 + hm['nade'][hk] * 2).astype(np.uint8)), 'hull_mat': b64(z['hull_surf'][hk].astype(np.uint8)),
            'counts': {'tri': int(tk.sum()), 'v': int(len(used)), 'hull': int(len(hk))}}


def write_game(name, C, ncell, nz, kind):
    """map3d.json — для игры (А5): столбики sight / nade, небо, этажи. Массивы — deflate (zlib) → base64, little-endian."""
    W = C.W; d = C.d
    def col(kind_):
        s = d[kind_ + '_start'].astype(np.int64)
        return {'n': b64(np.diff(s).astype(np.uint8)), 'lo': b64(d[kind_ + '_lo'].astype('<i2')), 'hi': b64(d[kind_ + '_hi'].astype('<i2'))}
    sight = col('sight'); sight['mat'] = b64(d['sight_mat'].astype(np.uint8))
    live = kind > 0; fc = ncell[live]
    fn = np.bincount(fc, minlength=W * W).astype(np.uint8)
    J = {'_about': 'А3 (20.10.2026): 3D-слои карты из геометрии игры — устройство в docs/ARCHITECTURE.md, «Карта 3D (map3d.json)»',
         'W': W, 'cell': 2048 // W, 'unit': C.c, 'pos_x': C.X0, 'pos_y': C.Y0,
         'mats': [str(x) for x in d['surf_names']],
         'sight': sight, 'nade': col('nade'), 'sky': col('sky'), 'sky_z': b64(d['sky_z'].astype('<i2')),
         'floors': {'n': b64(fn), 'z': b64(nz[live].astype('<i2')), 'kind': b64(kind[live].astype(np.uint8))},
         'prims': prims(name)}
    txt = json.dumps(J, ensure_ascii=False, separators=(',', ':'))
    open(mapdir.path(name, 'geom3d', 'map3d.json'), 'w', encoding='utf-8').write(txt)
    print('map3d.json: %.2f МБ' % (len(txt) / 1e6))


if __name__ == '__main__':
    build(mapdir.current())
