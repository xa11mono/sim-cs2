"""Расстановки CT у про — кто где стоит и куда смотрит к AT-й секунде раунда (владелец 15.11: «точки в паре, чтобы смотрели все зоны,
из которых могут выйти T»). Для каждого раунда демок карты: структура (сколько CT у A / мид / B — pro_tactics.region, как
tools/ct/ct_setup_bake.py), позиции и взгляд CT и позиции T (кадры AT..AT+0,25 с; 4 Гц). Взгляд — в осях игры (рад, как b.facing).
Видимость и покрытие входов считает tools/ct/ct_cover.js той же проверкой, что в игре (hasLOS, конус FOV).
Запуск: python3 tools/ct/ct_cover_pro.py --map mirage --out=<файл.json>"""
import sys, os, json, math
sys.path[:0] = [os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), g) for g in ('map', 'ct', 'pro', 'marks', 'logs', 'motion', 'page')]   # (15.11) модули tools/ разложены по группам
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
from pro_tactics import region, src_demos  # noqa: E402
from demos import ticks_of  # noqa: E402,F401

AT = 20
MAP = mapdir.current()
arg = lambda k: next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--' + k + '=')), None)


def main():
    out = []
    for rs, T, dth, types in src_demos():
        for r in rs:
            tk = r['t0'] + AT * 64
            g = T[(T.tick >= tk) & (T.tick < tk + 16)].drop_duplicates('steamid')
            ct = g[g.side == 'CT']; tt = g[g.side == 'T']
            if len(ct) < 5: continue
            rg = region(ct.x.values.astype(float), ct.y.values.astype(float))
            st = '%d-%d-%d' % ((rg == 'A').sum(), (rg == 'M').sum(), (rg == 'B').sum())
            yaw = ct.yaw.values.astype(float) if 'yaw' in ct else np.zeros(len(ct))
            out.append({'st': st, 'ct': [[round(float(x), 1), round(float(y), 1), round(float(z), 1), round(-math.radians(a), 4), str(q)]
                                         for x, y, z, a, q in zip(ct.x.values, ct.y.values, ct.Z.values, yaw, rg)],
                        't': [[round(float(x), 1), round(float(y), 1), round(float(z), 1)] for x, y, z in zip(tt.x.values, tt.y.values, tt.Z.values)]})
    json.dump({'map': MAP, 'at': AT, 'rounds': out}, open(arg('out'), 'w'))
    from collections import Counter
    print(len(out), 'раундов;', Counter(o['st'] for o in out).most_common(10))


if __name__ == '__main__':
    main()
