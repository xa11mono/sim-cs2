"""Сэмплы про из демок: где стоят и куда смотрят → <pro_dir>/pro_samples.csv.gz (v318: --map, раунды — tools/demos.py).

python3 tools/pro.py --map <карта>

Строка — живой игрок в раунде (после freeze time, до конца раунда), шаг выгрузки демок — 16 тиков (0,25 с):
x, y — карта 0..2048; dx, dy — взгляд (единичный вектор на радаре, y вниз); side CT/T; phase — early (< 20 с),
setup (< 50 с), late (до планта), post (после планта); still — «стоит» (скорость < 25 ед. карты/с); site — сайт планта
раунда ('-' — без планта); sec — секунда раунда; rid — раунд (tools/demos.py).
Раньше (Ancient, 12 матчей) скрипт читал папку выгрузки по жёсткому пути; формат строк прежний + sec, rid.
"""
import os, sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
import demos as D  # noqa: E402

STILL = 25   # ед. карты/с


def main():
    out = []
    for demo in D.demo_names():
        R = D.rounds_of(demo)
        if not R:
            continue
        t = D.ticks_of(demo)
        ri = D.round_index(R, t.tick.values)
        t = t[ri >= 0].assign(ri=ri[ri >= 0]).sort_values(['steamid', 'tick'], kind='stable')
        yaw = np.radians(t.yaw.values)
        same = (t.steamid.values[1:] == t.steamid.values[:-1]) & (t.ri.values[1:] == t.ri.values[:-1])
        dt = np.diff(t.tick.values) / D.TICK
        sp = np.full(len(t), np.inf)
        d = np.hypot(np.diff(t.x.values), np.diff(t.y.values))
        ok = same & (dt > 0)
        sp[1:][ok] = d[ok] / dt[ok]
        sp[0] = np.inf
        # первая строка игрока в раунде — скорость по следующей
        first = np.r_[True, ~same]
        nxt = np.r_[sp[1:], np.inf]
        sp = np.where(first, nxt, sp)
        t0 = np.array([r['t0'] for r in R])[t.ri.values]
        tp = np.array([r['tplant'] or 1 << 60 for r in R])[t.ri.values]
        sec = (t.tick.values - t0) / D.TICK
        ph = np.where(t.tick.values >= tp, 'post', np.where(sec < 20, 'early', np.where(sec < 50, 'setup', 'late')))
        site = np.array([r['site'] or '-' for r in R])[t.ri.values]
        rid = np.array([r['rid'] for r in R])[t.ri.values]
        out.append(pd.DataFrame({'x': t.x.values.round(2), 'y': t.y.values.round(2), 'dx': np.cos(yaw).round(4),
                                 'dy': (-np.sin(yaw)).round(4), 'side': t.side.values, 'phase': ph, 'still': sp < STILL,
                                 'site': site, 'sec': sec.round(2), 'rid': rid}))
        print(demo, len(out[-1]), file=sys.stderr)
    P = pd.concat(out)
    P = P[(P.x >= 0) & (P.x < 2048) & (P.y >= 0) & (P.y < 2048)]
    f = os.path.join(mapdir.pro_dir(D.MAPNAME), 'pro_samples.csv.gz')
    P.to_csv(f, index=False, compression='gzip')
    print('записано %s: %d строк, демок %d; стоит %.2f' % (os.path.relpath(f, D.ROOT), len(P), P.rid.str.split('|').str[0].nunique(),
                                                         P.still.mean()))


if __name__ == '__main__':
    main()
