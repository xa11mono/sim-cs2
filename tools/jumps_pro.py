"""Прыжки про в демках карты: сколько, где (бой / перемещение), куда (вперёд, назад, вбок) и стрейф в воздухе. Прыжок — по высоте: за ~0,25 с
подъём > JUMP_UP ед. и через ~0,75 с снова на прежнем уровне (± JUMP_BACK) — не лестница. Бой — враг ближе FIGHT_R px карты или выстрел
стрелявшего / в него за ±2 с. Направление — движение за 0,25 с до отрыва относительно взгляда; стрейф в воздухе — направление движения в
полёте отличается от направления до прыжка больше чем на 35°. Запуск: python3 tools/jumps_pro.py --map mirage [--demos=N]"""
import sys, os, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demos  # noqa: E402

N = int(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--demos=')), 20))
JUMP_UP, JUMP_BACK, FIGHT_R = 25, 12, 700


def ang(a, b): return abs((a - b + np.pi) % (2 * np.pi) - np.pi)


def main():
    C = collections.Counter(); rounds = 0; secs = 0.0
    for demo in demos.demo_names()[:N]:
        T = demos.ticks_of(demo); R = demos.rounds_of(demo); rounds += len(R)
        fire = demos.event(demo, 'weapon_fire'); hurt = demos.event(demo, 'player_hurt')
        shotT = collections.defaultdict(list)
        for tk, s in zip(fire.tick, fire.user_steamid): shotT[int(s)].append(int(tk)) if s == s else None
        for tk, s in zip(hurt.tick, hurt.user_steamid): shotT[int(s)].append(int(tk)) if s == s else None
        for k in shotT: shotT[k] = np.array(sorted(shotT[k]))
        step = int(np.median(np.diff(np.unique(T.tick.values[:5000]))))
        for r in R:
            W = T[(T.tick >= r['t0']) & (T.tick < r['t1'])]; secs += (r['t1'] - r['t0']) / 64
            by_t = {tk: g for tk, g in W.groupby('tick')}
            for sid, g in W.groupby('steamid'):
                g = g.sort_values('tick'); tk = g.tick.values; z = g.Z.values; x = g.x.values; y = g.y.values; yaw = np.radians(-g.yaw.values); side = g.side.values[0]
                k1 = max(1, round(16 / step)); k3 = max(3, round(48 / step))
                i = k1
                while i + k3 < len(tk):
                    if tk[i] - tk[i - k1] <= 20 and z[i] - z[i - k1] > JUMP_UP and abs(z[i + k3] - z[i - k1]) < JUMP_BACK and z[i + k1] > z[i - k1] + 5:
                        t = tk[i - k1]; fight = False
                        F = by_t.get(t)
                        if F is not None:
                            e = F[F.side != side]
                            if len(e) and np.min(np.hypot(e.x.values - x[i - k1], e.y.values - y[i - k1])) < FIGHT_R: fight = True
                        st = shotT.get(int(sid))
                        if st is not None and len(st) and np.any(np.abs(st - t) < 128): fight = True
                        mv0 = np.arctan2(y[i - k1] - y[max(0, i - 2 * k1)], x[i - k1] - x[max(0, i - 2 * k1)]); sp0 = np.hypot(y[i - k1] - y[max(0, i - 2 * k1)], x[i - k1] - x[max(0, i - 2 * k1)])
                        mv1 = np.arctan2(y[i + k1] - y[i], x[i + k1] - x[i])
                        rel = ang(mv0, yaw[i - k1]) if sp0 > 3 else None
                        dirn = 'на месте' if rel is None else ('вперёд' if rel < np.radians(45) else ('назад' if rel > np.radians(135) else 'вбок'))
                        strafe = sp0 > 3 and np.hypot(y[i + k1] - y[i], x[i + k1] - x[i]) > 3 and ang(mv0, mv1) > np.radians(35)
                        C[('бой' if fight else 'перемещение', dirn, 'стрейф' if strafe else 'прямо')] += 1
                        i += k3; continue
                    i += 1
    tot = sum(C.values())
    print('демок %d, раундов %d, прыжков %d — %.2f на игрока за раунд' % (N, rounds, tot, tot / max(1, rounds * 10)))
    for k, v in sorted(C.items(), key=lambda kv: -kv[1]): print('  %5d  %4.1f%%  %s' % (v, 100 * v / tot, ' · '.join(k)))


if __name__ == '__main__':
    main()
