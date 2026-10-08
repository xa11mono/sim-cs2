"""Демки про Ancient (data/demos) → раунды. Одно место для всех tools/*: номер
раунда (rid), его границы и плант считаются только здесь, поэтому rid у позиций
(positions_bake.py) и у гранат (lineups.py) совпадает по построению.

rid = '<демка>|<номер раунда из демки (total_rounds_played)>'. Если номер
повторяется (рестарт матча) — берётся последний раунд с этим номером: ранние
переигрались и в счёт не пошли.
"""
import glob, os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMOS = os.path.join(ROOT, 'data', 'demos')
TICK = 64
TICK_COLS = ['tick', 'steamid', 'team_num', 'X', 'Y', 'Z', 'yaw', 'is_alive', 'is_warmup_period']


def tr(X, Y):
    """координаты игры → карта 0..2048"""
    return (X + 2953) / 5 * 2, (2164 - Y) / 5 * 2


def demo_names():
    return [os.path.basename(f)[:-len('_ticks.csv.gz')] for f in sorted(glob.glob(os.path.join(DEMOS, '*_ticks.csv.gz')))]


def event(demo, kind):
    """таблица события демки (weapon_fire, bomb_planted, …); нет файла — пустая"""
    f = os.path.join(DEMOS, '%s_%s.csv.gz' % (demo, kind))
    return pd.read_csv(f) if os.path.exists(f) else pd.DataFrame(columns=['tick', 'total_rounds_played'])


def site_of(bx):
    return 'A' if bx < 1024 else 'B'


def rounds_of(demo):
    """[{rid, demo, num, t0, t1, tplant, site, plantXY, planter}] — t в тиках, t0 = конец freeze time"""
    fe = event(demo, 'round_freeze_end').sort_values('tick')
    fe = fe.drop_duplicates('total_rounds_played', keep='last')
    re_ = event(demo, 'round_end')
    pl = event(demo, 'bomb_planted')
    starts = fe.tick.values
    out = []
    for k, (t0, num) in enumerate(zip(fe.tick.values, fe.total_rounds_played.values)):
        e = re_[re_.tick > t0].tick
        t1 = int(e.min()) if len(e) else None
        if k + 1 < len(starts) and (t1 is None or t1 > starts[k + 1]):
            t1 = int(starts[k + 1])   # раунд прервали рестартом — до следующего старта
        if t1 is None:
            continue
        pp = pl[(pl.tick > t0) & (pl.tick < t1)].sort_values('tick')
        r = {'rid': '%s|%d' % (demo, int(num)), 'demo': demo, 'num': int(num), 't0': int(t0), 't1': t1,
             'tplant': None, 'site': None, 'plantXY': None, 'planter': None}
        if len(pp):
            bx, by = tr(float(pp.user_X.iloc[0]), float(pp.user_Y.iloc[0]))
            r.update(tplant=int(pp.tick.iloc[0]), site=site_of(bx), plantXY=(bx, by), planter=int(pp.user_steamid.iloc[0]))
        out.append(r)
    return out


def ticks_of(demo):
    """живые игроки вне разминки: tick, steamid, side, x, y (карта), Z, yaw"""
    t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=TICK_COLS)
    t = t[(t.is_alive == True) & (t.is_warmup_period != True)]  # noqa: E712
    x, y = tr(t.X.values, t.Y.values)
    return pd.DataFrame({'tick': t.tick.values.astype(np.int64), 'steamid': t.steamid.values.astype(np.int64),
                         'side': np.where(t.team_num.values == 3, 'CT', 'T'),
                         'x': x.astype(np.float32), 'y': y.astype(np.float32),
                         'Z': t.Z.values.astype(np.float32), 'yaw': t.yaw.values.astype(np.float32)})


def round_index(rounds, ticks):
    """номер раунда (индекс в rounds) для каждого тика, -1 — вне раундов"""
    t0 = np.array([r['t0'] for r in rounds]); t1 = np.array([r['t1'] for r in rounds])
    i = np.searchsorted(t0, ticks, side='right') - 1
    ok = (i >= 0) & (ticks < t1[np.clip(i, 0, None)])
    return np.where(ok, i, -1)
