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
os.makedirs(IMG, exist_ok=True)
CO = mapdir.callouts(MAP)
def place(x, y):
    best, bd = '?', 1e9
    for n, cx, cy in CO:
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
    p = os.path.join(IMG, f'{MAP}_{name}.png'); f.savefig(p, bbox_inches='tight'); plt.close(f); return os.path.relpath(p, ROOT)
def pct(a, b): return round(100.0*a/b, 1) if b else None

if cmd == 'vis':
    K = json.load(open(os.path.join(VD, f'{MAP}_kills.json'))); N = json.load(open(os.path.join(VD, f'{MAP}_neg.json')))
    H = json.load(open(os.path.join(VD, f'{MAP}_hgt.json')))
    rng = np.random.default_rng(2)
    if len(H) > 250000: H = [H[i] for i in sorted(rng.choice(len(H), 250000, replace=False))]
    if len(N) > 150000: N = [N[i] for i in sorted(rng.choice(len(N), 150000, replace=False))]
    dat = os.path.join(VD, f'{MAP}_q.json'); json.dump({'kills': K, 'neg': N, 'hgt': H}, open(dat, 'w'))
    res = os.path.join(VD, f'{MAP}_engine.json')
    if not os.path.exists(res) or '--again' in sys.argv:
        subprocess.run(['node', os.path.join(HERE, 'qfile.js'), opt['sim'], os.path.join(HERE, 'vis_check.js'), dat, res], check=True, cwd=ROOT)
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
    col = {'wall': 'red', 'floor': 'orange', 'cover': 'magenta', 'ceil': 'blue', 'level': 'cyan', '': 'gray'}
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
    json.dump(S, open(os.path.join(VD, f'{MAP}_vis_stats.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(S, ensure_ascii=False, indent=1))

if cmd == 'walk':
    RD = os.path.join(ROOT, 'tools', 'measure', 'runs', opt['runs']); files = sorted(glob.glob(os.path.join(RD, 'rec_*.json')))
    nav, stall, pos, rounds = [], [], [], 0
    for fn in files:
        d = json.load(open(fn)); rounds += len([r for r in d['rounds'] if 't1' in r])
        nav += d['walk']['nav']; stall += d['walk']['stall']
        pos += [(p[3], p[4]) for p in d['pos'] if p[5] == 1]
    S = {'map': MAP, 'матчей': len(files), 'раундов': rounds}
    kinds = collections.Counter(n[1] for n in nav)
    S['nav на 100 раундов'] = {k: round(100.0*v/rounds, 1) for k, v in kinds.items()}
    snap = [n for n in nav if n[1] == 'snap']
    S['перенос: расстояние, медиана px'] = float(np.median([n[8] for n in snap])) if snap else None
    S['перенос со сменой высоты > 30, шт'] = sum(1 for n in snap if n[6] is not None and n[9] is not None and abs(n[9]-n[6]) > 30)
    for k in ('snap', 'noprog', 'wall', 'ledge'):
        S[f'места {k}'] = collections.Counter(place(n[4], n[5]) for n in nav if n[1] == k).most_common(10)
    cant = [s for s in stall if s[9] >= 0.5]; task = [s for s in stall if s[9] < 0.5]
    S['stall на 100 раундов'] = round(100.0*len(stall)/rounds, 1)
    S['stall «не может идти» (хотел идти ≥ 50 % из 5 с), %'] = pct(len(cant), len(stall))
    S['stall «стоит по задаче», почему'] = dict(collections.Counter(s[10] for s in task))
    S['stall «не может идти»: места'] = collections.Counter(place(s[3], s[4]) for s in cant).most_common(12)
    S['stall «по задаче»: места'] = collections.Counter(place(s[3], s[4]) for s in task).most_common(8)
    S['stall «по задаче»: посты'] = collections.Counter(str(s[6]).split(':')[0] for s in task).most_common(8)
    S['stall «не может идти»: посты'] = collections.Counter(str(s[6]).split(':')[0] for s in cant).most_common(8)
    f, ax = fig(f'{mapdir.title(MAP)}: ходьба ботов, {len(files)} матчей ({rounds} раундов)\n'
                'перенос вне навмеша ■ чёрный, нет прогресса ● красный, выход из стены ▲ оранж., stall «не может идти» ✕ малин.')
    for k, c, m in (('snap', 'black', 's'), ('noprog', 'red', 'o'), ('wall', 'orange', '^'), ('ledge', 'green', 'D')):
        a = np.array([[n[4], n[5]] for n in nav if n[1] == k]).reshape(-1, 2); ax.scatter(a[:, 0], a[:, 1], s=8, c=c, marker=m, alpha=0.5)
    a = np.array([[s[3], s[4]] for s in cant]).reshape(-1, 2); ax.scatter(a[:, 0], a[:, 1], s=14, c='magenta', marker='x', alpha=0.7)
    label_places(ax, collections.Counter(place(n[4], n[5]) for n in nav) + collections.Counter(place(s[3], s[4]) for s in cant))
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
    json.dump(S, open(os.path.join(VD, f'{MAP}_walk_stats.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(S, ensure_ascii=False, indent=1))
