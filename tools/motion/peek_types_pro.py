"""Д30 (18.11, владелец): короткий и широкий пик у про — по демкам с каждым тиком (*_motion.csv.gz).
Пик — выход из стойки: игрок стоял (скорость < STAND 0,3 с и дольше), нажал A или D (без W/S) и пошёл вбок. Дальше:
  короткий — ушёл от места стойки не дальше SHORT ед. и вернулся к нему (ближе SHORT/2) за 1 с;
  широкий  — ушёл дальше WIDE ед. на скорости ≥ RUN ед./с и не вернулся за 1 с;
остальное — «средний». Для каждого: сторона, секунда раунда, у сайта ли, был ли выстрел за 1,5 с, убил ли / погиб за 3 с,
есть ли у живых врагов AWP. Пороги — проектные числа. Запуск: python3 tools/motion/peek_types_pro.py [--map mirage]"""
import sys, os, glob, math, json, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import demos as D  # noqa: E402
STAND, SHORT, WIDE, RUN = 20, 40, 80, 200
RIF = {'AK-47', 'M4A4', 'M4A1-S', 'Galil AR', 'FAMAS', 'AUG', 'SG 553', 'AWP'}
out = collections.defaultdict(collections.Counter)
for f in sorted(glob.glob(os.path.join(D.DEMOS, '*_motion.csv.gz'))):
    demo = os.path.basename(f).replace('_motion.csv.gz', '')
    try: R = D.rounds_of(demo); dth = D.event(demo, 'player_death')
    except Exception: continue
    d = pd.read_csv(f, usecols=['tick', 'steamid', 'team_num', 'LEFT', 'RIGHT', 'FORWARD', 'BACK', 'X', 'Y', 'velocity_X', 'velocity_Y', 'is_alive', 'active_weapon_name', 'shots_fired'], low_memory=False)
    d = d[d.is_alive == True]  # noqa: E712
    awp_t = {}
    for (tk, tm), g in d[d.active_weapon_name == 'AWP'].groupby(['tick', 'team_num']): pass
    awps = d[d.active_weapon_name == 'AWP'][['tick', 'team_num']]
    for r in R:
        w = d[(d.tick >= r['t0']) & (d.tick <= (r['tplant'] or r['t1']))]
        aw = set(awps[(awps.tick >= r['t0']) & (awps.tick <= r['t1'])].team_num.unique())
        kills = dth[(dth.tick >= r['t0']) & (dth.tick <= r['t1'])]
        for sid, g in w.groupby('steamid'):
            g = g.sort_values('tick')
            if g.active_weapon_name.iloc[0] not in RIF and not g.active_weapon_name.isin(RIF).any(): continue
            tk = g.tick.values; x = g.X.values; y = g.Y.values; sp = np.hypot(g.velocity_X.fillna(0), g.velocity_Y.fillna(0)).values
            L = g.LEFT.values.astype(bool); Rr = g.RIGHT.values.astype(bool); Fw = (g.FORWARD.values | g.BACK.values).astype(bool)
            sh = g.shots_fired.values; team = g.team_num.values[0]; side = 'CT' if team == 3 else 'T'
            i = 20; n = len(tk)
            while i < n - 64:
                if sp[i - 1] < STAND and sp[i - 20:i].max() < STAND and (L[i] ^ Rr[i]) and not Fw[i]:
                    x0, y0 = x[i], y[i]; j = i; mx = 0; vmx = 0
                    while j < n and tk[j] - tk[i] <= 64:
                        dd = math.hypot(x[j] - x0, y[j] - y0); mx = max(mx, dd); vmx = max(vmx, sp[j]); j += 1
                    back = math.hypot(x[j - 1] - x0, y[j - 1] - y0) < SHORT / 2
                    kind = 'короткий' if mx <= SHORT and back else ('широкий' if mx >= WIDE and vmx >= RUN and not back else 'средний')
                    t = tk[i]; sec = (t - r['t0']) / 64
                    shot = sh[min(n - 1, i + 96)] > sh[i]
                    kd = kills[(kills.tick >= t) & (kills.tick <= t + 192)]
                    try: kill = (kd.attacker_steamid.astype('int64') == int(sid)).any(); died = (kd.user_steamid.astype('int64') == int(sid)).any()
                    except Exception: kill = died = False
                    awp = (5 - team) in aw
                    for key in ('все', side, 'до 30 с' if sec < 30 else 'после 30 с', 'против AWP' if awp else 'без AWP у врага'):
                        C = out[key]; C[kind] += 1; C[kind + ' выстрел'] += shot; C[kind + ' убил'] += kill; C[kind + ' погиб'] += died
                    i = j; continue
                i += 1
res = {}
for key, C in out.items():
    n = sum(C[k] for k in ('короткий', 'средний', 'широкий'))
    res[key] = {k: {'доля': round(C[k] / n, 3), 'выстрел': round(C[k + ' выстрел'] / max(1, C[k]), 3), 'убил': round(C[k + ' убил'] / max(1, C[k]), 3), 'погиб': round(C[k + ' погиб'] / max(1, C[k]), 3), 'n': C[k]} for k in ('короткий', 'средний', 'широкий')}
    print(key, 'пиков', n, ' | '.join('%s %.0f%% (выстрел %.0f%%, убил %.1f%%, погиб %.1f%%)' % (k, 100 * v['доля'], 100 * v['выстрел'], 100 * v['убил'], 100 * v['погиб']) for k, v in res[key].items()))
json.dump(res, open('/tmp/peek_types_pro.json', 'w'), ensure_ascii=False)
