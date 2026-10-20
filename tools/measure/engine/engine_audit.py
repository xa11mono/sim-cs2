#!/usr/bin/env python3
"""(шаг 0а, ENGINE_AUDIT) разбор движка против демок про. Игру не меняет.
  python3 tools/measure/engine/engine_audit.py vis  --map mirage --sim=<sim_mirage.html>   # видимость и высоты (после demo_prep.py)
  python3 tools/measure/engine/engine_audit.py walk --map mirage --runs=e0a_mir            # ходьба (после walk_run.py)
Цифры — tools/measure/runs/e0a_vis/<карта>_*.json, картинки — docs/reports/engine_audit/<карта>_*.png."""
import sys, os, json, math, subprocess, collections, glob
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', '..'))
import mapdir  # noqa
cmd = sys.argv[1]; del sys.argv[1]
MAP = mapdir.current()
opt = {a.split('=')[0][2:]: a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--') and '=' in a}
ROOT = mapdir.ROOT; VD = os.path.join(ROOT, 'tools', 'measure', 'runs', 'e0a_vis'); IMG = os.path.join(ROOT, 'docs', 'reports', 'engine_audit')
# --tag=_v1: сравнение версий — результаты, сетка и картинки с этим хвостом (картинки — в runs/e0a_vis, не в отчёт); сетку пишет grid_dump.js
TAG = opt.get('tag', '')
if TAG: IMG = VD
os.makedirs(IMG, exist_ok=True)
CO = mapdir.callouts(MAP)
def place(x, y):
    best, bd = '?', 1e9
    for c in CO:
        n, cx, cy = c[:3]
        d = (x-cx)**2 + (y-cy)**2
        if d < bd: bd, best = d, n
    return best

import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt  # noqa
from PIL import Image  # noqa
RADAR = np.asarray(Image.open(mapdir.radar_png(MAP)).convert('RGB'))
def fig(title):
    f, ax = plt.subplots(figsize=(9, 9), dpi=100); ax.imshow(RADAR, extent=(0, 2048, 2048, 0), alpha=0.55)
    ax.set_xlim(0, 2048); ax.set_ylim(2048, 0); ax.set_axis_off(); ax.set_title(title, fontsize=11); return f, ax
def label_places(ax, cnt, k=8):
    for n, c in cnt.most_common(k):
        p = [q for q in CO if q[0] == n]
        if p: ax.annotate(f'{n} ({c})', (p[0][1], p[0][2]), fontsize=8, color='black', ha='center',
                          bbox=dict(boxstyle='round,pad=0.2', fc='white', alpha=0.8, lw=0))
def save(f, name):
    p = os.path.join(IMG, f'{MAP}_{name}{TAG}.png'); f.savefig(p, bbox_inches='tight'); plt.close(f); return os.path.relpath(p, ROOT)
def pct(a, b): return round(100.0*a/b, 1) if b else None

if cmd == 'vis':
    K = json.load(open(os.path.join(VD, f'{MAP}_kills.json'))); N = json.load(open(os.path.join(VD, f'{MAP}_neg.json')))
    H = json.load(open(os.path.join(VD, f'{MAP}_hgt.json')))
    rng = np.random.default_rng(2)
    if len(H) > 250000: H = [H[i] for i in sorted(rng.choice(len(H), 250000, replace=False))]
    if len(N) > 150000: N = [N[i] for i in sorted(rng.choice(len(N), 150000, replace=False))]
    dat = os.path.join(VD, f'{MAP}_q.json'); json.dump({'kills': K, 'neg': N, 'hgt': H}, open(dat, 'w'))
    res = os.path.join(VD, f'{MAP}_engine{TAG}.json'); grd = os.path.join(VD, f'{MAP}_grid{TAG}.json')
    if not os.path.exists(res) or '--again' in sys.argv:
        subprocess.run(['node', os.path.join(HERE, 'qfile.js'), opt['sim'], os.path.join(HERE, 'vis_check.js'), dat, res], check=True, cwd=ROOT)
    if not os.path.exists(grd) or '--again' in sys.argv:
        subprocess.run(['node', os.path.join(HERE, 'qfile.js'), opt['sim'], os.path.join(HERE, 'grid_dump.js'), dat, grd], check=True, cwd=ROOT)
    E = json.load(open(res)); S = {'map': MAP}
    # ---------- убийства ----------
    rows = [(k, e) for k, e in zip(K, E['kills'])]
    pen = [(k, e) for k, e in rows if k[12] > 0]; base = [(k, e) for k, e in rows if k[12] == 0]
    gnd = [(k, e) for k, e in base if not k[10] and not k[11]]
    bad = [(k, e) for k, e in base if e[0] == 0]; badA = [(k, e) for k, e in base if e[2] == 0]
    S['kills'] = {'всего пулей/ножом': len(rows), 'с прострелом (penetrated)': len(pen), 'без прострела': len(base),
                  'на земле оба': len(gnd), 'не видно стоя, %': pct(len(bad), len(base)),
                  'не видно ни в одной стойке, %': pct(len(badA), len(base)),
                  'не видно стоя — оба на земле, %': pct(sum(1 for k, e in gnd if e[0] == 0), len(gnd)),
                  'hasLOS нет, %': pct(sum(1 for k, e in base if e[1] == 0), len(base)),
                  'видна только голова, %': pct(sum(1 for k, e in base if e[0] == 2), len(base)),
                  'прострел: движок видит, %': pct(sum(1 for k, e in pen if e[0] > 0), len(pen)),
                  'через дым (thrusmoke), шт': sum(1 for k, e in base if k[13])}
    why = collections.Counter(e[3] for k, e in bad); S['kills']['причина «не видно»'] = dict(why)
    # разбор по первому совпадению: что именно в движке/данных разошлось с демкой
    sys.path.insert(0, HERE); import march  # noqa
    W_, C_, Sg, Clg, Fg = march.load(VD, MAP, TAG)
    def depth(k):
        def fl(x, y, z):
            v = Fg[int(y//C_), int(x//C_)]; v = 0 if v < -9000 else v
            return z if abs(v - z) > 64 else v
        ez = fl(k[3], k[4], k[5]) + 64; ft = fl(k[6], k[7], k[8])
        return min(march.inside(Sg, Clg, C_, k[3], k[4], ez, k[6], k[7], ft + tz)[0] for tz in (68, 52, 32))
    def klass(k, e):
        if e[3] == 'geom': return 'геометрия игры (А5): ' + (str(e[7][0]) if e[7] else '?')
        if e[3] == 'wall': return 'стена набора (высокая)'
        if e[3] == 'level': return 'чужой этаж (levelBlocked)'
        if e[3] == 'ceil': return 'крыша (потолок 130)'
        if e[3] == 'floor' and e[7] and e[7][1] is not None and abs(e[7][1]) < 80 and e[7][3] - k[5] > 60: return 'под верхним полом: сетка знает один пол'
        if len(e) > 8 and e[8]: return 'край тела цели: видно со сдвигом ±14 ед.'
        if depth(k) <= 10: return 'тонкий выступ сетки (≤ 10 ед.)'
        return 'пол/уступ сетки' if e[3] == 'floor' else 'укрытие набора'
    KL = [(k, e, klass(k, e)) for k, e in bad]
    S['kills']['почему «не видно» (разбор), шт'] = collections.Counter(c for k, e, c in KL).most_common()
    S['kills']['почему «не видно»: места по классам'] = {c: collections.Counter(place(e[4], e[5]) for k, e, cc in KL if cc == c).most_common(6) for c in set(c for k, e, c in KL)}
    S['kills']['видно со сдвигом тела цели ±14 ед., % от «не видно»'] = pct(sum(1 for k, e in bad if len(e) > 8 and e[8]), len(bad))
    cw = collections.Counter(place(e[4], e[5]) for k, e in bad)
    S['kills']['где режет линию (место)'] = cw.most_common(15)
    # доля «не видно» по месту убийцы и жертвы (места с ≥ 25 убийствами)
    byp = collections.defaultdict(lambda: [0, 0])
    for k, e in base:
        for p in {place(k[3], k[4]), place(k[6], k[7])}:
            byp[p][0] += 1; byp[p][1] += (e[0] == 0)
    S['kills']['доля «не видно» по месту (убийца или жертва)'] = sorted([(p, n, pct(b, n)) for p, (n, b) in byp.items() if n >= 25], key=lambda r: -r[2])[:15]
    # подъём глаз: движок поставил глаза не по высоте демки (> 18 ед.)
    S['kills']['глаза движка ≠ высота демки (> 18 ед.), %'] = pct(sum(1 for k, e in base if abs(e[6]) > 18), len(base))
    col = {'geom': 'red', 'wall': 'red', 'floor': 'orange', 'cover': 'magenta', 'ceil': 'blue', 'level': 'cyan', '': 'gray'}
    f, ax = fig(f'{mapdir.title(MAP)}: убийства про, где наш движок «не видит» ({len(bad)} из {len(base)})\n'
                'линия убийца→жертва; точка — где режет: красная стена, оранж. пол/уступ, малин. укрытие, синяя крыша, голуб. этаж')
    for k, e in bad:
        ax.plot([k[3], k[6]], [k[4], k[7]], color=col[e[3]], lw=0.5, alpha=0.35)
        ax.scatter([e[4]], [e[5]], s=7, color=col[e[3]], zorder=3)
    label_places(ax, cw); S['img_kills'] = save(f, 'vis_kills')
    # ---------- обратная проверка ----------
    NE = list(zip(N, E['neg'])); NF = [(n, e) for n, e in NE if n[8]]
    S['neg'] = {'пар (не стреляли 2 с)': len(NE), 'движок видит, %': pct(sum(1 for n, e in NE if e[0] > 0), len(NE)),
                'hasLOS видит, %': pct(sum(1 for n, e in NE if e[1] > 0), len(NE)),
                'из них смотрит на врага ±15°': len(NF), 'смотрит — движок видит, %': pct(sum(1 for n, e in NF if e[0] > 0), len(NF))}
    seen = [(n, e) for n, e in NF if e[0] > 0]
    cp = collections.Counter(' ↔ '.join(sorted({place(n[2], n[3]), place(n[5], n[6])})) for n, e in seen)
    S['neg']['где «видит» при взгляде (пары мест)'] = cp.most_common(15)
    f, ax = fig(f'{mapdir.title(MAP)}: пары про, смотрели друг на друга и 2 с не стреляли, а движок «видит» ({len(seen)} из {len(NF)})')
    for n, e in seen: ax.plot([n[2], n[5]], [n[3], n[6]], color='red', lw=0.4, alpha=0.25)
    label_places(ax, collections.Counter(p for n, e in seen for p in (place(n[2], n[3]), place(n[5], n[6]))))
    S['img_neg'] = save(f, 'vis_neg')
    # ---------- высоты ----------
    HE = list(zip(H, E['hgt']))
    dv = np.array([h[2] - e[0] for h, e in HE]); on = np.array([e[2] for h, e in HE]); dn = np.array([(h[2] - e[1]) if e[1] is not None else np.nan for h, e in HE])
    S['hgt'] = {'точек (про на земле, раз в 1 с)': len(HE),
                '|Z − visFloorAt| > 30, %': pct(int((np.abs(dv) > 30).sum()), len(HE)),
                'из них про НИЖЕ верхнего пола (под крышей/этажом), %': pct(int((dv < -30).sum()), len(HE)),
                'из них про ВЫШЕ пола сетки, %': pct(int((dv > 30).sum()), len(HE)),
                '|Z − свой этаж навмеша| > 30, %': pct(int((np.abs(dn) > 30).sum()), len(HE)),
                'нет навмеша под точкой (±6 px), %': pct(int((on == 0).sum()), len(HE)),
                'медиана |Z − этаж навмеша|': round(float(np.nanmedian(np.abs(dn))), 1)}
    bh = [(h, d) for (h, e), d in zip(HE, dn) if d == d and abs(d) > 30]
    S['hgt']['этаж навмеша ≠ Z > 30: места'] = collections.Counter(place(h[0], h[1]) for h, d in bh).most_common(12)
    S['hgt']['нет навмеша: места'] = collections.Counter(place(h[0], h[1]) for (h, e) in HE if e[2] == 0).most_common(12)
    hv = [(h, d) for h, d in zip(H, dv) if d > 30]
    S['hgt']['про выше сетки visFloorAt > 30: места'] = collections.Counter(place(h[0], h[1]) for h, d in hv).most_common(12)
    f, ax = fig(f'{mapdir.title(MAP)}: высота про против нашей (на земле). Красный — про выше нашего пола > 30,\n'
                'синий — ниже своего этажа навмеша > 30, чёрный — навмеша под про нет')
    a = np.array([[h[0], h[1]] for h, d in hv]) if hv else np.zeros((0, 2)); ax.scatter(a[:, 0], a[:, 1], s=1, c='red', alpha=0.3)
    b = np.array([[h[0], h[1]] for h, d in bh if d < 0]) if bh else np.zeros((0, 2)); ax.scatter(b[:, 0], b[:, 1], s=1, c='blue', alpha=0.3)
    c = np.array([[h[0], h[1]] for (h, e) in HE if e[2] == 0]);
    if len(c): ax.scatter(c[:, 0], c[:, 1], s=1, c='black', alpha=0.4)
    label_places(ax, collections.Counter(place(h[0], h[1]) for h, d in bh))
    S['img_hgt'] = save(f, 'heights')
    json.dump(S, open(os.path.join(VD, f'{MAP}_vis_stats{TAG}.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(S, ensure_ascii=False, indent=1))

if cmd == 'walk':
    RD = os.path.join(ROOT, 'tools', 'measure', 'runs', opt['runs']); files = [f for f in sorted(glob.glob(os.path.join(RD, 'rec_*.json'))) if os.path.getsize(f) > 1000]
    nav, stall, pos, rounds = [], [], [], 0; TRK = collections.defaultdict(list); BK = []
    for fn in files:
        d = json.load(open(fn)); rounds += len([r for r in d['rounds'] if 't1' in r])
        BK.extend([(k[3], k[4], k[7], k[8]) for k in d['kills'] if k[3] is not None])
        nav += [n + [fn] for n in d['walk']['nav']]; stall += [x + [fn] for x in d['walk']['stall']]
        pos += [(p[3], p[4]) for p in d['pos'] if p[5] == 1]
        for p in d['pos']:
            if p[5] == 1: TRK[(fn, p[1])].append((p[0], p[3], p[4]))
    S = {'map': MAP, 'матчей': len(files), 'раундов': rounds}
    kinds = collections.Counter(n[1] for n in nav)
    S['nav на 100 раундов'] = {k: round(100.0*v/rounds, 1) for k, v in kinds.items()}
    snap = [n for n in nav if n[1] == 'snap']
    S['перенос: расстояние, медиана px'] = float(np.median([n[8] for n in snap])) if snap else None
    S['перенос со сменой высоты > 30, шт'] = sum(1 for n in snap if n[6] is not None and n[9] is not None and abs(n[9]-n[6]) > 30)
    for k in ('snap', 'noprog', 'wall', 'ledge'):
        S[f'места {k}'] = collections.Counter(place(n[4], n[5]) for n in nav if n[1] == k).most_common(10)
    # stall по классам: не может идти (хотел идти ≥ 50 % из 5 с) / путь сброшен застреванием (nav-событие у этого бота в эти 5 с) /
    # нет пути без застревания / стоит по задаче (holding, скорость 0 по решению, бой)
    NB = collections.defaultdict(list)
    for n in nav: NB[(n[-1], n[2])].append(n[0])
    def scls(s):
        if s[9] >= 0.5:
            if len(s) > 15: L = s[13]   # пройдено ногами (baseX/baseY) за 5 с — из сторожа
            else:
                tr = [q for q in TRK[(s[-1], s[1])] if s[0] - 320 <= q[0] <= s[0]]
                L = sum(math.hypot(b[1]-a[1], b[2]-a[2]) for a, b in zip(tr, tr[1:]))
            return 'ходит туда-сюда (путь есть, прошёл > 60 px, сдвиг < 25)' if L > 60 else 'не может идти (путь есть, шаг не проходит)'
        if s[10] == 'nopath': return 'путь сброшен застреванием' if any(s[0] - 320 <= t <= s[0] for t in NB[(s[-1], s[1])]) else 'нет пути до поста (без застревания)'
        return 'стоит по задаче (' + s[10] + ')'
    SC = [(s, scls(s)) for s in stall]; cant = [s for s, c in SC if c.startswith('не может')]
    S['stall на 100 раундов'] = round(100.0*len(stall)/rounds, 1)
    S['stall по классам, %'] = {c: pct(n, len(stall)) for c, n in collections.Counter(c for s, c in SC).most_common()}
    S['stall по классам: места'] = {c: collections.Counter(place(s[3], s[4]) for s, cc in SC if cc == c).most_common(8) for c in set(c for s, c in SC)}
    S['stall по классам: посты'] = {c: collections.Counter(str(s[6]).split(':')[0] for s, cc in SC if cc == c).most_common(6) for c in set(c for s, c in SC)}
    osc = [s for s, c in SC if c.startswith('ходит') and len(s) > 15]
    S['«ходит туда-сюда»: пройдено за 5 с, px, медиана'] = float(np.median([s[13] for s in osc])) if osc else None
    S['«ходит туда-сюда»: смен пути за 5 с, медиана'] = float(np.median([s[14] for s in osc])) if osc else None
    S['«ходит туда-сюда»: смен пути ≥ 3 за 5 с, %'] = pct(sum(1 for s in osc if s[14] >= 3), len(osc)) if osc else None
    S['stall «не может идти»: остаток пути (точек), медиана'] = float(np.median([s[8] for s in cant])) if cant else None
    f, ax = fig(f'{mapdir.title(MAP)}: ходьба ботов, {len(files)} матчей ({rounds} раундов)\n'
                'вне навмеша — перенесён ■ чёрный, нет прогресса 1,5 с ● красный, топчется → сброс пути ▲ оранж., спрыгнул с уступа ◆ зелёный;\n' 'stall: ходит туда-сюда ✕ малин., путь сброшен + фиол., нет пути + синий, не может идти X красный')
    for k, c, m in (('snap', 'black', 's'), ('noprog', 'red', 'o'), ('wall', 'orange', '^'), ('ledge', 'green', 'D')):  # wall = топчется 1,5 с → escapeWallLine
        a = np.array([[n[4], n[5]] for n in nav if n[1] == k]).reshape(-1, 2); ax.scatter(a[:, 0], a[:, 1], s=8, c=c, marker=m, alpha=0.5)
    for cls, c, m in (('ходит', 'magenta', 'x'), ('путь сброшен', 'purple', '+'), ('нет пути', 'blue', '+'), ('не может', 'red', 'X')):
        a = np.array([[s[3], s[4]] for s, cc in SC if cc.startswith(cls)]).reshape(-1, 2); ax.scatter(a[:, 0], a[:, 1], s=14, c=c, marker=m, alpha=0.6)
    label_places(ax, collections.Counter(place(n[4], n[5]) for n in nav) + collections.Counter(place(s[3], s[4]) for s, cc in SC))
    S['img_nav'] = save(f, 'walk_nav')
    # пути ботов против про: доля времени по клеткам 32 px
    H = json.load(open(os.path.join(VD, f'{MAP}_hgt.json')))
    C = 32; nb = 2048 // C
    def grid(P):
        g = np.zeros((nb, nb))
        for x, y in P:
            i, j = int(x // C), int(y // C)
            if 0 <= i < nb and 0 <= j < nb: g[j, i] += 1
        return g / max(1, g.sum())
    gb = grid(pos); gp = grid([(h[0], h[1]) for h in H])
    onlyB = (gb > 2e-4) & (gp < 1e-5); onlyP = (gp > 2e-4) & (gb < 1e-5)
    S['пути: клеток 32 px, где боты есть, а про нет'] = int(onlyB.sum()); S['доля времени ботов там, %'] = round(100*float(gb[onlyB].sum()), 2)
    S['пути: клеток, где про есть, а боты нет'] = int(onlyP.sum()); S['доля времени про там, %'] = round(100*float(gp[onlyP].sum()), 2)
    cen = lambda m: collections.Counter(place((i+0.5)*C, (j+0.5)*C) for j, i in zip(*np.nonzero(m)))
    S['боты есть, про нет: места'] = cen(onlyB).most_common(12); S['про есть, боты нет: места'] = cen(onlyP).most_common(12)
    # сильный перекос доли времени (клетки, где хоть кто-то бывает заметно)
    both = (gb + gp) > 4e-4; ratio = np.log2((gb + 1e-5)/(gp + 1e-5))
    S['боты в 4+ раза чаще про: места'] = cen(both & (ratio > 2)).most_common(10); S['про в 4+ раза чаще ботов: места'] = cen(both & (ratio < -2)).most_common(10)
    f, ax = fig(f'{mapdir.title(MAP)}: где бывают боты и про (доля времени, клетка 32 px)\n'
                'красное — боты в 4+ раза чаще про (или про нет вовсе), синее — про в 4+ раза чаще ботов (или ботов нет)')
    rgba = np.zeros((nb, nb, 4))
    rgba[(both & (ratio > 2)) | onlyB] = [1, 0, 0, 0.55]; rgba[(both & (ratio < -2)) | onlyP] = [0, 0.2, 1, 0.55]
    ax.imshow(rgba, extent=(0, 2048, 2048, 0), interpolation='nearest')
    S['img_paths'] = save(f, 'walk_paths')
    # где дерутся: место убийцы, доля убийств — боты против про (про — убийства пулей без прострела из демок)
    PK = [(k[3], k[4]) for k in json.load(open(os.path.join(VD, f'{MAP}_kills.json'))) if k[12] == 0]
    cb = collections.Counter(place(x, y) for x, y, _, _ in BK); cpk = collections.Counter(place(x, y) for x, y in PK)
    tb, tp = sum(cb.values()) or 1, sum(cpk.values()) or 1
    D = sorted([(p, round(100*cpk[p]/tp, 1), round(100*cb[p]/tb, 1)) for p in set(cb) | set(cpk)], key=lambda r: r[2]-r[1])
    S['убийства по месту убийцы (место, % у про, % у ботов): про чаще'] = [r for r in D if r[1] - r[2] >= 1.0][:10]
    S['убийства по месту убийцы: боты чаще'] = [r for r in D[::-1] if r[2] - r[1] >= 1.0][:10]
    S['убийств ботов'] = len(BK)
    json.dump(S, open(os.path.join(VD, f'{MAP}_walk_stats.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(S, ensure_ascii=False, indent=1))
