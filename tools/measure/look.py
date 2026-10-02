# Детекторы взгляда (В1, В7/В2, В8/К2) — у про и у ботов одинаково.
#  - «взгляд в стену»: луч взгляда упирается в ровную стену почти в лоб ближе WALL px (~1,2 м), % времени;
#    отдельно стоя и на ходу;
#  - «двое рядом смотрят в одну сторону»: два живых тиммейта стоят ≤400 px друг от
#    друга, оба стоят, направления взгляда расходятся меньше чем на 20°, % времени
#    стоящего бота (у про посчитать нельзя: в данных нет одновременных взглядов);
#  - примеры моментов (матч, тик, бот) — чтобы показать владельцу.
# Стены — data/walls.json (выгрузка MANUAL_WALLS из игры).
import json, os, glob
import numpy as np, pandas as pd
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W = np.array(json.load(open(os.path.join(ROOT, 'data', 'walls.json')))['w'], dtype=float)
WALL = 25.0
def free_dist(x, y, dx, dy, R=200.0):
    """По лучу (x,y)+t*(dx,dy): расстояние до первой стены и «упёрся ли в ровную
    стену» — попал не у края отрезка (≥18 px от конца, как flatWallAhead в игре) и
    смотрит на стену почти в лоб (отклонение от перпендикуляра <45°). Край угла
    держать можно — это не считается."""
    out = np.full(len(x), R); flat = np.zeros(len(x), bool)
    ax, ay, bx, by = W[:, 0], W[:, 1], W[:, 2], W[:, 3]
    sx, sy = bx - ax, by - ay; L = np.hypot(sx, sy); L[L == 0] = 1
    for i in range(0, len(x), 4000):
        X, Y, DX, DY = x[i:i+4000, None], y[i:i+4000, None], dx[i:i+4000, None], dy[i:i+4000, None]
        den = DX * sy - DY * sx
        qx, qy = ax - X, ay - Y
        with np.errstate(divide='ignore', invalid='ignore'):
            t = (qx * sy - qy * sx) / den
            u = (qx * DY - qy * DX) / den
        ok = (np.abs(den) > 1e-9) & (t > 0) & (t < R) & (u >= 0) & (u <= 1)
        t = np.where(ok, t, R)
        k = t.argmin(axis=1); tm = t[np.arange(len(k)), k]
        um = u[np.arange(len(k)), k]; e = np.minimum(um, 1 - um) * L[k]
        cosn = np.abs(den[np.arange(len(k)), k]) / L[k]   # |sin| угла луча к стене = cos к нормали
        out[i:i+4000] = tm
        flat[i:i+4000] = (tm < WALL) & (e > 18) & (cosn > 0.707)
    return out, flat
def pro_look():
    d = pd.read_csv(os.path.join(ROOT, 'data', 'pro', 'pro_samples.csv.gz'))
    d = d[d.phase != 'post'] if 'post' in set(d.phase) else d
    n = np.hypot(d.dx.values, d.dy.values).copy(); n[n == 0] = 1
    fd, wall = free_dist(d.x.values, d.y.values, d.dx.values / n, d.dy.values / n)
    st = d.still.values.astype(bool)
    return {'взгляд в стену стоя %': round(wall[st].mean() * 100, 2), 'взгляд в стену на ходу %': round(wall[~st].mean() * 100, 2)}
def bot_look(files, examples=0):
    wst = wmv = nst = nmv = 0; pair = pst = 0; ex = []
    for f in files:
        d = json.load(open(f)); m = d.get('match')
        p = pd.DataFrame(d['pos'], columns=['tick', 'id', 'ct', 'x', 'y', 'alive', 'f', 'w', 'kn'][:len(d['pos'][0])])
        p = p[p.alive == 1].sort_values(['id', 'tick'])
        p['mv'] = np.hypot(p.groupby('id').x.diff(), p.groupby('id').y.diff()).fillna(0) > 3
        fd, wall = free_dist(p.x.values.astype(float), p.y.values.astype(float), np.cos(p.f.values), np.sin(p.f.values))
        mv = p.mv.values
        wst += (wall & ~mv).sum(); nst += (~mv).sum(); wmv += (wall & mv).sum(); nmv += mv.sum()
        if examples:
            q = p[wall & ~mv]
            for _, r in q.iloc[::max(1, len(q) // examples)].head(examples).iterrows(): ex.append(('стена', m, int(r.tick), r.id))
        # пары: в каждый тик — тиммейты, оба стоят
        s = p[~p.mv]
        for (tk, ct), g in s.groupby(['tick', 'ct']):
            if len(g) < 2: continue
            X, Y, F = g.x.values, g.y.values, g.f.values
            dd = np.hypot(X[:, None] - X[None, :], Y[:, None] - Y[None, :])
            da = np.abs((F[:, None] - F[None, :] + np.pi) % (2 * np.pi) - np.pi)
            same = (dd < 400) & (dd > 0) & (da < 0.35)
            hit = same.any(axis=1)
            pair += hit.sum(); pst += len(g)
            if examples and hit.any() and len(ex) < 2 * examples and tk % 640 == 0:
                ex.append(('один угол', m, int(tk), ','.join(g.id.values[hit])))
    return {'взгляд в стену стоя %': round(wst / max(1, nst) * 100, 2), 'взгляд в стену на ходу %': round(wmv / max(1, nmv) * 100, 2),
            'двое рядом смотрят в одну сторону % (стоя)': round(pair / max(1, pst) * 100, 1)}, ex
if __name__ == '__main__':
    import sys
    if sys.argv[1] == 'pro': print(pro_look())
    else:
        files = sorted(sum([glob.glob(os.path.join(ROOT, 'tools', 'measure', 'runs', r, 'rec_*.json')) for r in sys.argv[1].split(',')], []))
        M, ex = bot_look([f for f in files if os.path.getsize(f) > 0], examples=int(sys.argv[2]) if len(sys.argv) > 2 else 0)
        print(M); [print(e) for e in ex]
