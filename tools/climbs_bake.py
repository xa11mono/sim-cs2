"""Подъёмы из демок (v372): где про забираются на уступ, который навмеш даёт только спрыгнуть (ящики, выступы — прыжок
с ящика на ящик). В .nav такие места — связь «только вниз» (верхний участок → нижний), и бот путь наверх ищет в обход
(Ancient: Mid ↔ Xbox / Triple — 2400 ед. вместо 100; надпись «навмеш не связывает напрямую»).
Кандидаты — пары «верх → низ» навмеша с перепадом больше прыжка (JUMP_UP 64, как в игре). Подъём есть, если в демках
игроки у этого места переходят с высоты низа на высоту верха за ≤ CLIMB_SEC — так часто, как MIN_N раз в MIN_DEMOS демках.
Выход: data/maps/<карта>/climbs.json → MAP.climbs (игра добавляет связь «вверх» и лезет, как по лестнице).
Запуск: python3 tools/climbs_bake.py --map ancient"""
import sys, os, json, collections
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from demos import MAPNAME, demo_names, ticks_of  # noqa: E402
import mapdir  # noqa: E402

JUMP_UP = 64          # ед. игры, как JUMP_UP в игре
CLIMB_SEC = 2.0       # проектное число: с низа наверх по ящикам — секунда-две
NEAR = 70             # px радара от места стыка
DZ = 25               # допуск высоты, ед. игры
MIN_N, MIN_DEMOS = 20, 10   # (v375, владелец: «забираются наверх укрытий, где нельзя», зацикливание на ящиках) — только частые подъёмы; редкие — бусты и случайные прыжки
STEP = 40             # px радара: подъём почти вертикальный — от последней точки внизу до первой наверху не дальше (проектное)
DETOUR = 3.0          # подъём нужен, только если навмеш ведёт наверх в обход: путь > DETOUR × напрямую и > +150 px
# (v379, владелец: «на ящик в миде не запрыгнуть» — 106 из 159 подъёмов Mirage вели на верх ящиков, куда один не залезет) в демках
# наверх попадают и бустом (стоит на голове у своего) — это не подъём для одного. Не считаются:
#  · буст — в момент, когда игрок уже наверху, прямо под ним (≤ BOOST_R ед. по горизонтали, ниже ≥ BOOST_DZ) стоит свой;
#  · шаг выше прыжка — подъём бывает ящик через ящик (промежуточная стоянка ≥ PLATEAU_T тиков), но каждый шаг ≤ JUMP_UP + DZ
BOOST_R, BOOST_DZ = 40, 40   # ед. игры — проектные числа (игрок ~32 ед. в ширину, ~72 в высоту)
PLATEAU_T = 8                # тиков стоит на промежуточной высоте — проектное число
STEP_MAX = JUMP_UP + DZ      # один шаг подъёма — не выше прыжка (с допуском высоты, как при поиске)
_u0 = mapdir.game_to_map(MAPNAME)(np.array([0.0, BOOST_R]), np.array([0.0, 0.0]))
BOOST_PX = float(abs(_u0[0][1] - _u0[0][0]) + abs(_u0[1][1] - _u0[1][0]))   # BOOST_R в px радара

nav = json.load(open(mapdir.path(MAPNAME, 'navmesh.json'), encoding='utf-8'))['areas']
by = {a['id']: a for a in nav}
cand = []
for hi in nav:
    for lid in hi['conn']:
        lo = by.get(lid)
        if not lo or hi['id'] in lo['conn'] or hi['z'] - lo['z'] <= JUMP_UP: continue
        best = None
        for p in hi['points']:
            for q in lo['points']:
                d = (p['x'] - q['x']) ** 2 + (p['y'] - q['y']) ** 2
                if best is None or d < best[0]: best = (d, (p['x'] + q['x']) / 2, (p['y'] + q['y']) / 2)
        cand.append({'lo': lo, 'hi': hi, 'x': best[1], 'y': best[2]})
import heapq
cen = {a['id']: (sum(p['x'] for p in a['points']) / len(a['points']), sum(p['y'] for p in a['points']) / len(a['points'])) for a in nav}
def nav_len(s, g, cap):
    D = {s: 0.0}; h = [(0.0, s)]
    while h:
        d, u = heapq.heappop(h)
        if u == g: return d
        if d > cap or d > D.get(u, 1e18): continue
        for v in by[u]['conn']:
            if v not in by: continue
            nd = d + ((cen[u][0] - cen[v][0]) ** 2 + (cen[u][1] - cen[v][1]) ** 2) ** 0.5
            if nd < D.get(v, 1e18): D[v] = nd; heapq.heappush(h, (nd, v))
    return 1e18
keep = []
for c in cand:
    st = ((cen[c['lo']['id']][0] - cen[c['hi']['id']][0]) ** 2 + (cen[c['lo']['id']][1] - cen[c['hi']['id']][1]) ** 2) ** 0.5
    if nav_len(c['lo']['id'], c['hi']['id'], max(DETOUR * st, st + 150) + 1) > max(DETOUR * st, st + 150): keep.append(c)
cand = keep
print('кандидатов (только спрыгнуть, перепад > %d, наверх — только в обход): %d' % (JUMP_UP, len(cand)))

hits = collections.defaultdict(list); rej = collections.defaultdict(collections.Counter)
for demo in demo_names():
    t = ticks_of(demo)
    X, Y, Z, S, T = t.x.values, t.y.values, t.Z.values, t.steamid.values, t.tick.values
    SD = t.side.values; order = np.argsort(T, kind='stable'); TS = T[order]
    def boosted(k):   # свой прямо под ним в этот тик
        a0, a1 = np.searchsorted(TS, T[k]), np.searchsorted(TS, T[k], side='right'); o = order[a0:a1]
        o = o[(S[o] != S[k]) & (SD[o] == SD[k])]
        return bool(((np.hypot(X[o] - X[k], Y[o] - Y[k]) <= BOOST_PX) & (Z[o] <= Z[k] - BOOST_DZ)).any())
    def max_step(j, i0, k, lo_z, hi_z):   # самый высокий шаг подъёма: с промежуточной стоянкой — два шага
        w = j[(T[j] >= T[i0]) & (T[j] <= T[k])]; zs, ts = Z[w], T[w]; best = hi_z - lo_z
        r0 = 0
        for r in range(1, len(w) + 1):
            if r == len(w) or abs(zs[r] - zs[r0]) > 2:
                zp = float(np.mean(zs[r0:r]))
                if ts[r - 1] - ts[r0] >= PLATEAU_T and lo_z + 20 < zp < hi_z - 20: best = min(best, max(zp - lo_z, hi_z - zp))
                r0 = r
        return best
    for ci, c in enumerate(cand):
        m = (np.abs(X - c['x']) < NEAR) & (np.abs(Y - c['y']) < NEAR)
        if not m.any(): continue
        idx = np.where(m)[0]
        lo_z, hi_z = c['lo']['z'], c['hi']['z']
        for sid in np.unique(S[idx]):
            j = idx[S[idx] == sid]; j = j[np.argsort(T[j])]
            last_lo, cool = None, -1
            for k in j:
                if abs(Z[k] - lo_z) < DZ: last_lo = k
                elif abs(Z[k] - hi_z) < DZ and last_lo is not None and T[k] - T[last_lo] <= CLIMB_SEC * 64 and T[k] > cool and \
                        ((X[k] - X[last_lo]) ** 2 + (Y[k] - Y[last_lo]) ** 2) ** 0.5 <= STEP:
                    kind = 'boost' if boosted(k) else ('tall' if max_step(j, last_lo, k, lo_z, hi_z) > STEP_MAX else 'ok')
                    rej[ci][kind] += 1
                    if kind == 'ok': hits[ci].append((demo, float(X[last_lo]), float(Y[last_lo]), float(X[k]), float(Y[k]), (T[k] - T[last_lo]) / 64))
                    cool = T[k] + 5 * 64; last_lo = None
    del t

# отчёт: что отброшено (буст / шаг выше прыжка) — tools/climbs_report_<карта>.json для сверки владельцем
rep = []
for ci, R in sorted(rej.items()):
    c = cand[ci]; rep.append({'lo': c['lo']['id'], 'hi': c['hi']['id'], 'dz': round(c['hi']['z'] - c['lo']['z']), 'x': round(c['x']), 'y': round(c['y']), 'ok': R['ok'], 'boost': R['boost'], 'tall': R['tall']})
json.dump(rep, open(os.path.join(HERE, 'measure', 'results', 'climbs_report_%s.json' % MAPNAME), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
out = []
for ci, H in sorted(hits.items()):
    if len(H) < MIN_N or len({h[0] for h in H}) < MIN_DEMOS: continue
    c = cand[ci]; a = np.array([h[1:] for h in H])
    out.append({'lo': {'area': c['lo']['id'], 'x': round(float(np.median(a[:, 0])), 1), 'y': round(float(np.median(a[:, 1])), 1), 'z': c['lo']['z']},
                'hi': {'area': c['hi']['id'], 'x': round(float(np.median(a[:, 2])), 1), 'y': round(float(np.median(a[:, 3])), 1), 'z': c['hi']['z']},
                'n': len(H), 'demos': len({h[0] for h in H}), 'sec': round(float(np.median(a[:, 4])), 2)})
    print('  подъём %d → %d (перепад %d): %d раз в %d демках, медиана %.2f с' % (c['lo']['id'], c['hi']['id'], c['hi']['z'] - c['lo']['z'], len(H), out[-1]['demos'], out[-1]['sec']))
# (v375) цепочки (верх одного подъёма — низ другого: ящик на ящике) — бот на них зацикливался (лез, падал); оставляем одиночные
los = {c['lo']['area'] for c in out}
out = [c for c in out if c['hi']['area'] not in los]
json.dump({'climbs': out}, open(mapdir.path(MAPNAME, 'climbs.json'), 'w', encoding='utf-8'), separators=(',', ':'))
print('climbs.json: %d подъёмов' % len(out))
