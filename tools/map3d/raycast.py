#!/usr/bin/env python3
"""Лучи по геометрии столкновений карты (А1, 20.10.2026) — без сторонних библиотек, только numpy.
from raycast import World; W = World('mirage'); hit = W.ray(A, B)   # A, B — точки (x, y, z) в единицах игры
Геометрия — data/maps/<карта>/geom3d/world_physics.npz: треугольники сеток (mesh_*) и выпуклые блоки (hull_*); небо (sky_*) не
участвует. Ускорение — плоская сетка XY (клетка CELL ед.): каждый треугольник / блок записан во все клетки своего охвата по XY;
луч проходит клетки точно (пересечения с линиями сетки), кандидаты проверяются разом (Мёллер — Трумбор; блок — отсечение
отрезка плоскостями n·p ≤ d).
Ответ ray(): None — чисто; иначе (t, kind, idx, point): t — доля пути до первого попадания, kind 'm' — треугольник сетки (idx —
номер треугольника), 'h' — блок (idx — номер блока)."""
import os
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CELL = 64.0


def _csr(lo, hi, x0, y0, nx, ny):
    """записать предметы с охватом lo..hi (N×2) в клетки: (start, items)"""
    i0 = np.clip(((lo[:, 0] - x0) // CELL).astype(int), 0, nx - 1); i1 = np.clip(((hi[:, 0] - x0) // CELL).astype(int), 0, nx - 1)
    j0 = np.clip(((lo[:, 1] - y0) // CELL).astype(int), 0, ny - 1); j1 = np.clip(((hi[:, 1] - y0) // CELL).astype(int), 0, ny - 1)
    cells, items = [], []
    for k in range(len(lo)):
        ii, jj = np.meshgrid(np.arange(i0[k], i1[k] + 1), np.arange(j0[k], j1[k] + 1), indexing='ij')
        c = (ii * ny + jj).ravel(); cells.append(c); items.append(np.full(len(c), k, np.int32))
    cells = np.concatenate(cells); items = np.concatenate(items); o = np.argsort(cells, kind='stable')
    cells, items = cells[o], items[o]
    start = np.searchsorted(cells, np.arange(nx * ny + 1))
    return start, items


class World:
    def __init__(self, mapname, drop_meshes=(), drop_hulls=None):
        z = np.load(os.path.join(ROOT, 'data', 'maps', mapname, 'geom3d', 'world_physics.npz'))
        self.z = z
        V = z['mesh_v'].astype(np.float64); T = z['mesh_t']; self.mesh_id = z['mesh_id']
        keep = ~np.isin(self.mesh_id, list(drop_meshes))
        self.tri_keep = keep
        P = V[T]                                            # N×3×3
        self.P0 = P[:, 0]; self.E1 = P[:, 1] - P[:, 0]; self.E2 = P[:, 2] - P[:, 0]
        hv = z['hull_v'].astype(np.float64); hn = z['hull_vn']; hp = z['hull_p'].astype(np.float64); pn = z['hull_pn']
        self.hv_off = np.concatenate([[0], np.cumsum(hn)]); self.hp_off = np.concatenate([[0], np.cumsum(pn)])
        self.hp = hp; self.hull_v = hv
        hlo = np.array([hv[self.hv_off[k]:self.hv_off[k + 1]].min(0) for k in range(len(hn))])
        hhi = np.array([hv[self.hv_off[k]:self.hv_off[k + 1]].max(0) for k in range(len(hn))])
        self.hlo, self.hhi = hlo, hhi
        self.hull_keep = np.ones(len(hn), bool) if drop_hulls is None else ~np.isin(np.arange(len(hn)), list(drop_hulls))
        # знак плоскостей: центр блока должен быть «внутри» (n·c − d < 0)
        c = np.array([hv[self.hv_off[k]:self.hv_off[k + 1]].mean(0) for k in range(len(hn))])
        hid = np.repeat(np.arange(len(pn)), pn)
        s = np.einsum('ij,ij->i', hp[:, :3], c[hid]) - hp[:, 3]
        self.plane_sign_ok = float((s < 0).mean())
        if self.plane_sign_ok < 0.5: self.hp = -hp
        tlo = P.min(1); thi = P.max(1); self.tlo, self.thi = tlo, thi
        lo = np.minimum(tlo.min(0), hlo.min(0)); hi = np.maximum(thi.max(0), hhi.max(0))
        self.x0, self.y0 = lo[0] - 1, lo[1] - 1
        self.nx = int((hi[0] - self.x0) // CELL) + 2; self.ny = int((hi[1] - self.y0) // CELL) + 2
        ti = np.where(keep)[0]
        st, it = _csr(tlo[ti, :2], thi[ti, :2], self.x0, self.y0, self.nx, self.ny); self.t_start, self.t_items = st, ti[it]
        hi_ = np.where(self.hull_keep)[0]
        st, it = _csr(hlo[hi_, :2], hhi[hi_, :2], self.x0, self.y0, self.nx, self.ny); self.h_start, self.h_items = st, hi_[it]

    def _cells(self, A, B):
        ax, ay = (A[0] - self.x0) / CELL, (A[1] - self.y0) / CELL
        bx, by = (B[0] - self.x0) / CELL, (B[1] - self.y0) / CELL
        ts = [0.0, 1.0]
        for a, b in ((ax, bx), (ay, by)):
            if abs(b - a) > 1e-9:
                k = np.arange(np.floor(min(a, b)) + 1, np.floor(max(a, b)) + 1)
                ts.append((k - a) / (b - a))
        ts = np.unique(np.concatenate([np.atleast_1d(np.asarray(x, float)) for x in ts]))
        m = (ts[:-1] + ts[1:]) / 2
        i = np.clip(np.floor(ax + (bx - ax) * m).astype(int), 0, self.nx - 1); j = np.clip(np.floor(ay + (by - ay) * m).astype(int), 0, self.ny - 1)
        return np.unique(i * self.ny + j)

    def _gather(self, start, items, cells):
        if not len(cells): return np.zeros(0, np.int32)
        return np.unique(np.concatenate([items[start[c]:start[c + 1]] for c in cells]))

    def ray(self, A, B, eps=1e-4):
        A = np.asarray(A, float); B = np.asarray(B, float); D = B - A
        cells = self._cells(A, B); best = None
        zlo, zhi = min(A[2], B[2]), max(A[2], B[2])
        tc = self._gather(self.t_start, self.t_items, cells)
        if len(tc):
            tc = tc[(self.thi[tc, 2] >= zlo) & (self.tlo[tc, 2] <= zhi)]
        if len(tc):
            e1, e2, p0 = self.E1[tc], self.E2[tc], self.P0[tc]
            h = np.cross(D, e2); a = np.einsum('ij,ij->i', e1, h)
            ok = np.abs(a) > 1e-9; f = np.where(ok, 1.0 / np.where(ok, a, 1), 0)
            s = A - p0; u = f * np.einsum('ij,ij->i', s, h)
            q = np.cross(s, e1); v = f * (q @ D); t = f * np.einsum('ij,ij->i', e2, q)
            hit = ok & (u >= 0) & (u <= 1) & (v >= 0) & (u + v <= 1) & (t > eps) & (t < 1 - eps)
            if hit.any():
                k = np.argmin(np.where(hit, t, 9)); best = (float(t[k]), 'm', int(tc[k]))
        hc = self._gather(self.h_start, self.h_items, cells)
        if len(hc):
            hc = hc[(self.hhi[hc, 2] >= zlo) & (self.hlo[hc, 2] <= zhi)]
        for k in hc:
            pl = self.hp[self.hp_off[k]:self.hp_off[k + 1]]
            dn = pl[:, :3] @ D; num = pl[:, 3] - pl[:, :3] @ A
            if np.any((np.abs(dn) < 1e-12) & (num < 0)): continue
            with np.errstate(divide='ignore', invalid='ignore'):
                tt = num / dn
            t0 = max(0.0, tt[dn < 0].max(initial=-np.inf)); t1 = min(1.0, tt[dn > 0].min(initial=np.inf))
            if t1 - t0 > 1e-6 and t0 < 1 - eps and t1 > eps:
                th = max(t0, eps)
                if best is None or th < best[0]: best = (float(th), 'h', int(k))
        if best is None: return None
        return best + (A + D * best[0],)
