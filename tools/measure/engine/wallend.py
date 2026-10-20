"""(шаг 0а) убийства про, которые наша высокая стена «режет»: где по линии — у самого игрока (стена набора толще
настоящей, игрок прижат к ней) или посреди линии. Проверка: обрезать линию на d px у концов — пропадает ли пересечение."""
import json, sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', '..')); import mapdir  # noqa
def run(M, VD):
    G = json.load(open(os.path.join(VD, f'{M}_grid.json'))); seg = np.array(G['segs'], float)
    K = json.load(open(os.path.join(VD, f'{M}_kills.json'))); E = json.load(open(os.path.join(VD, f'{M}_engine.json')))['kills']
    B = [(k, e) for k, e in zip(K, E) if k[12] == 0 and e[0] == 0 and e[3] == 'wall']
    def hits(ax, ay, bx, by):
        c, d = seg[:, :2], seg[:, 2:]
        def ccw(p, q, r): return (r[..., 1]-p[..., 1])*(q[..., 0]-p[..., 0]) > (q[..., 1]-p[..., 1])*(r[..., 0]-p[..., 0])
        A = np.array([ax, ay]); Bp = np.array([bx, by])
        return bool(np.any((ccw(A, c, d) != ccw(Bp, c, d)) & (ccw(A, Bp, c) != ccw(A, Bp, d))))
    out = {}
    for dpx in (2, 4, 6, 8, 12):
        n = 0
        for k, e in B:
            ax, ay, bx, by = k[3], k[4], k[6], k[7]; L = np.hypot(bx-ax, by-ay)
            if L <= 2*dpx + 1: n += 1; continue
            ux, uy = (bx-ax)/L, (by-ay)/L
            if not hits(ax+ux*dpx, ay+uy*dpx, bx-ux*dpx, by-uy*dpx): n += 1
        out[dpx] = n
    near = sum(1 for k, e in B if min(np.hypot(e[4]-k[3], e[5]-k[4]), np.hypot(e[4]-k[6], e[5]-k[7])) < 8)
    return len(B), out, near
if __name__ == '__main__':
    M = mapdir.current(); VD = os.path.join(mapdir.ROOT, 'tools', 'measure', 'runs', 'e0a_vis')
    n, out, near = run(M, VD)
    print(M, 'режет стена:', n, '; точка реза ближе 8 px (20 ед.) к игроку:', near, '; пропадает, если обрезать линию у концов на d px:', out)
