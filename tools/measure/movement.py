#!/usr/bin/env python3
"""(v236) Движение: про / сборки ботов. python3 tools/measure/movement.py pro <папка прогона> [...]
Снимки раз в 0,25 с (16 тиков), живые, до планта. Скорость — сдвиг за 0,25 с в px радара (бег ≈ 22–25, шаг ≈ 11–13):
  стоит < 3 · медленно 3–8 · шаг 8–16 · бег ≥ 16 (доли снимков);
  нож в руках — доля снимков на бегу;
  у стены на бегу — медиана расстояния до ближайшей стены (px) и доля «ближе 20 px»;
  поворот хода на бегу — медиана изменения направления движения за 0,25 с (°)."""
import sys, os, json, glob, math, collections
import numpy as np, pandas as pd
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W = np.array(json.load(open(os.path.join(ROOT, 'data', 'walls.json')))['w'], dtype=float)
def wall_dist(x, y):
    ax, ay, bx, by = W[:, 0], W[:, 1], W[:, 2], W[:, 3]
    dx, dy = bx - ax, by - ay; L2 = dx*dx + dy*dy + 1e-9
    u = np.clip(((x - ax)*dx + (y - ay)*dy)/L2, 0, 1)
    return float(np.min(np.hypot(ax + u*dx - x, ay + u*dy - y)))
def summarize(name, seqs):
    # seqs: [(tick[], x[], y[], knife[] or None)]
    sp = []; kn = []; wd = []; turn = []
    for tk, x, y, k in seqs:
        for i in range(1, len(tk)):
            if tk[i] - tk[i-1] != 16: continue
            d = math.hypot(x[i]-x[i-1], y[i]-y[i-1]); sp.append(d)
            if d >= 16:
                if k is not None: kn.append(bool(k[i]))
                if len(wd) < 6000 and i % 3 == 0: wd.append(wall_dist(x[i], y[i]))
                if i >= 2 and tk[i-1] - tk[i-2] == 16 and math.hypot(x[i-1]-x[i-2], y[i-1]-y[i-2]) >= 16:
                    a1 = math.atan2(y[i-1]-y[i-2], x[i-1]-x[i-2]); a2 = math.atan2(y[i]-y[i-1], x[i]-x[i-1])
                    turn.append(abs(math.degrees((a2 - a1 + math.pi) % (2*math.pi) - math.pi)))
    sp = np.array(sp); n = len(sp)
    sh = lambda m: '%.1f%%' % (100*m.sum()/n)
    print('%-16s стоит %s · медленно %s · шаг %s · бег %s | нож на бегу %s | у стены на бегу: медиана %.0f px, <20 px %.0f%% | поворот хода на бегу: медиана %.1f°, >30° %.1f%%' % (
        name, sh(sp < 3), sh((sp >= 3) & (sp < 8)), sh((sp >= 8) & (sp < 16)), sh(sp >= 16),
        ('%.0f%%' % (100*np.mean(kn))) if kn else '—', np.median(wd), 100*np.mean(np.array(wd) < 20), np.median(turn), 100*np.mean(np.array(turn) > 30)))
def pro(nd=10):
    seqs = []; side = {'T': [], 'CT': []}
    for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'demos', '*_ticks.csv.gz')))[:nd]:
        base = f[:-len('_ticks.csv.gz')]
        t = pd.read_csv(f, usecols=['tick', 'steamid', 'X', 'Y', 'is_alive', 'is_warmup_period', 'active_weapon_name', 'team_num'])
        t = t[(~t.is_warmup_period) & t.is_alive & (t.tick % 16 == 0)]
        bp = pd.read_csv(base + '_bomb_planted.csv.gz'); fe = pd.read_csv(base + '_round_freeze_end.csv.gz')
        starts = np.sort(fe.tick.values); plants = np.sort(bp.tick.values)
        ri = np.searchsorted(starts, t.tick.values) - 1
        nxt_pl = np.array([plants[plants > starts[r]].min() if r >= 0 and (plants > starts[r]).any() else 1e12 for r in range(len(starts))])
        ok = (ri >= 0) & (t.tick.values < nxt_pl[np.clip(ri, 0, None)])
        t = t[ok]
        x = (t.X.values + 2953)/2.5; y = (2164 - t.Y.values)/2.5
        t = t.assign(x=x, y=y, kn=t.active_weapon_name.astype(str).str.contains('nife|ayonet|arambit|utterfly|lip|alchion|uicide|ursus|avaja|tiletto|alon|kukri|Bowie|Flip|Gut|Huntsman', regex=True))
        for (sid, tm), g in t.groupby(['steamid', 'team_num']):
            g = g.sort_values('tick'); q = (g.tick.values, g.x.values, g.y.values, g.kn.values); seqs.append(q)
            if tm in (2, 3): side['T' if tm == 2 else 'CT'].append(q)
    summarize('про', seqs); summarize('  про T', side['T']); summarize('  про CT', side['CT'])
def bots(run):
    seqs = []; side = {0: [], 1: []}
    for f in glob.glob(os.path.join(run, 'rec_*.json')):
        d = json.load(open(f)); pl = {}
        for r in d['rounds']:
            pl[r['t0']] = r.get('plant') or r.get('t1', 1e12)
        starts = sorted(pl)
        by = collections.defaultdict(list)
        for p in d['pos']:
            if not p[5]: continue
            i = np.searchsorted(starts, p[0]) - 1
            if i < 0 or p[0] >= pl[starts[i]]: continue
            by[p[1]].append(p)
        for L in by.values():
            L.sort(key=lambda p: p[0])
            q = (np.array([p[0] for p in L]), np.array([p[3] for p in L], float), np.array([p[4] for p in L], float), np.array([p[8] if len(p) > 8 else 0 for p in L]))
            seqs.append(q); side[L[0][2]].append(q)
    nm = os.path.basename(run.rstrip('/')); summarize(nm, seqs); summarize('  T', side[0]); summarize('  CT', side[1])
for a in sys.argv[1:]:
    pro() if a == 'pro' else bots(a)
