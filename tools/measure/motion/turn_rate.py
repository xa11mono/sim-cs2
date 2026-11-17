"""В147: частота поворотов взгляда в минуту по ситуациям (бой / стоит / шагом / бегом), мелких (< 5°) и крупных (≥ 5°) — про и боты.
Запуск: python3 tools/measure/motion/turn_rate.py --map mirage [папка bshape_*.json]"""
import sys, os, collections
sys.path[:0] = [os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), g) for g in ('map', 'ct', 'pro', 'marks', 'logs', 'motion', 'page')]   # (15.11) модули tools/ разложены по группам
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import mapdir  # noqa: E402
MAP = mapdir.current()
import motion_shape as M  # noqa: E402


def rate(SER):
    n = collections.Counter(); tk = collections.Counter()
    for s in SER:
        x, y, yaw, shot = s['x'], s['y'], s['yaw'], s['shot']; v = np.r_[0, np.hypot(np.diff(x), np.diff(y))] * 64
        fight = np.zeros(len(x), bool)
        for i in np.where(shot)[0]: fight[max(0, i - 96):i + 96] = True
        sit = np.where(fight, 'бой', np.where(v < 15, 'стоит', np.where(v < 170, 'шагом', 'бегом')))
        for k in ('бой', 'стоит', 'шагом', 'бегом'): tk[k] += int((sit == k).sum())
        dy = np.r_[0, (np.diff(yaw) + 180) % 360 - 180]; ad = np.abs(dy)
        m = np.r_[False, ad > 0.3, False].astype(int); d = np.diff(m)
        for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
            if b - a >= 2: n[(sit[a], '<5' if abs(dy[a:b].sum()) < 5 else '≥5')] += 1
    return {k: (round(n[(k, '<5')] / max(1e-9, tk[k] / 3840), 1), round(n[(k, '≥5')] / max(1e-9, tk[k] / 3840), 1)) for k in ('бой', 'стоит', 'шагом', 'бегом')}


a = [x for x in sys.argv[1:] if not x.startswith('--')]
P = rate(M.series_pro()); B = rate(M.series_bots(a[0])) if a else None
print('поворотов в минуту (мелких < 5° / крупных ≥ 5°):')
for k in P: print('  %-6s про %5.1f / %5.1f' % (k, *P[k]) + ('   боты %5.1f / %5.1f' % B[k] if B else ''))
