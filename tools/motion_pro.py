"""В140: модель движения про по выгрузке каждого тика (<демка>_motion.csv.gz, tools/demo_events_pc.py, режим motion). Считает:
контрстрейф (скорость в момент выстрела; противоположная клавиша за 0,2 с до выстрела), джигл / A–D (смены влево ↔ вправо, длина нажатия),
прицел (неподвижен / рывки: размер, длительность, доводка), шаг / присед. Запуск: python3 tools/motion_pro.py --map mirage"""
import sys, os, glob, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demos  # noqa: E402
RIFLES = ('AK-47', 'M4A4', 'M4A1-S', 'Galil AR', 'FAMAS', 'AUG', 'SG 553')


def main():
    sh_v = []; cs = 0; nsh = 0; sw = []; hold = []; still = 0; fr = 0; flick = []; fix = []; walk = 0; duck = 0; alive = 0; mins = 0.0
    for f in sorted(glob.glob(os.path.join(demos.DEMOS, '*_motion.csv.gz'))):
        d = pd.read_csv(f, low_memory=False)
        d = d[d.is_alive == True].sort_values(['steamid', 'tick'])  # noqa: E712
        for sid, g in d.groupby('steamid'):
            tk = g.tick.values; v = np.hypot(g.velocity_X.fillna(0).values, g.velocity_Y.fillna(0).values)
            L = g.LEFT.values.astype(bool); R = g.RIGHT.values.astype(bool); yaw = g.yaw.values.astype(float); w = g.active_weapon_name.astype(str).values
            sf = g.shots_fired.fillna(0).values; cont = np.r_[False, np.diff(tk) == 1]
            alive += len(tk); mins += len(tk) / 64 / 60; walk += int(g.is_walking.sum()); duck += int(g.ducking.sum())
            # выстрелы винтовок: скорость в момент выстрела; контрстрейф — за 12 тиков до выстрела была нажата сторона, а потом противоположная
            for i in np.where((np.diff(sf, prepend=sf[0]) > 0) & cont)[0]:
                if w[i] not in RIFLES or sf[i] != 1: continue   # первая пуля очереди
                nsh += 1; sh_v.append(v[i])
                a, b = max(0, i - 13), i
                if (L[a:b].any() and R[a:b].any()): cs += 1
            # смены сторон A ↔ D (нажата только одна сторона)
            side = np.where(L & ~R, -1, np.where(R & ~L, 1, 0)); last = 0; lt = None
            for i in range(len(tk)):
                if not cont[i]: last = 0; lt = None; continue
                s = side[i]
                if s and s != last:
                    if last and lt is not None and tk[i] - lt < 40: sw.append(tk[i] - lt)
                    last = s; lt = tk[i]
            # нажатие стороны — сколько держат
            run = 0
            for i in range(len(tk)):
                if side[i] and cont[i]: run += 1
                elif run: hold.append(run); run = 0
            # прицел: скорость поворота (°/с), рывки — подряд > 300 °/с
            dy = np.abs((np.diff(yaw) + 180) % 360 - 180) * 64; dy[~cont[1:]] = 0
            still += int((dy < 5).sum()); fr += len(dy)
            i = 0
            while i < len(dy):
                if dy[i] > 300:
                    j = i
                    while j < len(dy) and dy[j] > 60: j += 1
                    size = abs((yaw[j] - yaw[i] + 180) % 360 - 180)
                    if size > 10:
                        flick.append((size, (j - i) / 64))
                        # доводка: за 0,3 с после рывка — ещё движение 2–15°
                        k2 = min(len(yaw) - 1, j + 19); fix.append(2 < abs((yaw[k2] - yaw[j] + 180) % 360 - 180) < 15)
                    i = j
                else: i += 1
    sv = np.array(sh_v); hl = np.array(hold); fl = np.array(flick)
    print('ПРО (Mirage, 12 демок × 4 раунда, каждый тик), игрока-минут: %.0f' % mins)
    print('Контрстрейф: первая пуля винтовки — скорость в момент выстрела: медиана %.0f ед./с, ≤ 40 ед./с (точно) %d%%, ≥ 120 (на бегу) %d%%; A и D за 0,2 с до выстрела — %d%%  (выстрелов %d)' % (
        np.median(sv), 100 * (sv <= 40).mean(), 100 * (sv >= 120).mean(), 100 * cs / max(1, nsh), nsh))
    print('Стрейф A ↔ D: смен стороны (< 0,6 с между ними) %.1f в минуту; нажатие стороны: медиана %.2f с, 25–75 %%: %.2f–%.2f с' % (
        len(sw) / mins, np.median(hl) / 64, np.percentile(hl, 25) / 64, np.percentile(hl, 75) / 64))
    print('Прицел: почти неподвижен (< 5 °/с) %d%% времени; рывков > 10° — %.1f в минуту; размер медиана %.0f° (25–75 %%: %.0f–%.0f°), длительность медиана %.2f с; доводка после рывка %d%%' % (
        100 * still / fr, len(fl) / mins, np.median(fl[:, 0]), np.percentile(fl[:, 0], 25), np.percentile(fl[:, 0], 75), np.median(fl[:, 1]), 100 * np.mean(fix)))
    print('Шаг (Shift) %d%% времени, присед %d%%' % (100 * walk / alive, 100 * duck / alive))


if __name__ == '__main__':
    main()
